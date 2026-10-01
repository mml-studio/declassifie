/**
 * Reading the permit lists a city publishes as PDF files, and keeping their
 * rows — the half that cannot be pure: requests, files and zlib.
 *
 * The twin of `sirapBoards.mjs`. A city is one page and one PDF per list; the
 * rows are kept by the same archive store (`createCartdsArchiveStore` with
 * `PERMIT_LIST_ROWS`), in a directory of their own, and swept once a day by
 * the same server.
 *
 * A PDF IS READ ONCE PER EDITION. Marseille's register is 199 pages, about
 * half a second of parsing, and the city replaces it every few weeks; so the
 * rows of each edition are kept on disk beside the server's other caches,
 * under its address, with the `ETag` and `Last-Modified` it was served with.
 * The next request carries them back, and a `304` — or the same validators on
 * a `200` from a host that ignores them — reuses the rows instead of parsing
 * again. What is kept is what the archive may keep: rows already scrubbed.
 *
 * NETWORK THROUGH THE CALLER, as there: every request goes through the `http`
 * object handed in — `{fetch, text, bytes}`, none of which ever throws.
 */

import { createHash } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { extractPdfText } from '../../src/data/pdfText.js';
import { robotsAllows } from '../../src/data/cartdsFeed.js';
import { cartdsDay } from '../../src/data/cartdsArchive.js';
import {
  permitListLinks,
  permitListRobotsUrl,
  scrubPermitListRow,
  PERMIT_LIST_FIELDS,
  PERMIT_LIST_READERS,
} from '../../src/data/permitListsFeed.js';

/** Where the archive lives, beside the Cart@DS and Sirap ones. */
export const PERMIT_LISTS_ARCHIVE_DIR = path.join('.gev-cache', 'archive', 'permit-lists');

/** Where each edition's rows are kept once read. */
export const PERMIT_LISTS_EDITION_DIR = path.join('.gev-cache', 'permit-lists');

/** Bumped whenever a reader changes, so every edition is read again. */
export const PERMIT_LISTS_READER_SCHEMA = 1;

/** Marseille's page is 430 KB of HTML. */
const PAGE_MAX_BYTES = 4 * 1024 * 1024;
/** Its list of decisions is 2.5 MB; a list with images could be ten times that. */
const PDF_MAX_BYTES = 32 * 1024 * 1024;
const ROBOTS_MAX_BYTES = 512 * 1024;
/** Marseille's register runs to 199 pages; a list ten times as long is not a list. */
const PDF_MAX_PAGES = 2000;

/**
 * What this host's `robots.txt` lets a robot read (RFC 9309), as a test on a
 * path: the page is asked first, each file once its address is known.
 *
 * @param {object} city One of `PERMIT_LISTS`.
 * @param {{fetch: Function, text: Function}} http
 * @returns {Promise<{allows: (pathname: string) => boolean, final: boolean}>}
 *   `final: false` when the host did not answer: ask again next time.
 */
export async function permitListsRobots(city, http) {
  const refuse = { allows: () => false };
  const response = await http.fetch(permitListRobotsUrl(city));
  if (!response) return { ...refuse, final: false };
  if (response.status >= 500) return { ...refuse, final: true };
  if (response.status >= 400 || /html/i.test(response.headers?.get?.('content-type') || '')) {
    await response.body?.cancel?.().catch?.(() => {});
    return { allows: () => true, final: true };
  }
  const body = await http.text(response, ROBOTS_MAX_BYTES);
  if (body === null) return { ...refuse, final: false };
  return { allows: (pathname) => robotsAllows(body, pathname), final: true };
}

/** The file an edition's rows are kept in: one per address. */
function editionFile(dir, url) {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 24);
  return path.join(dir, `list${PERMIT_LISTS_READER_SCHEMA}-${hash}.json`);
}

async function readEdition(dir, url) {
  if (!dir) return null;
  try {
    const kept = JSON.parse(await fsp.readFile(editionFile(dir, url), 'utf8'));
    return kept?.url === url && Array.isArray(kept.rows) ? kept : null;
  } catch {
    return null;
  }
}

async function writeEdition(dir, edition) {
  if (!dir) return;
  const file = editionFile(dir, edition.url);
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(temp, JSON.stringify(edition));
    await fsp.rename(temp, file);
  } catch { /* a cache is an optimisation, never a requirement */ }
}

/** Rows as kept: scrubbed into the archive's cells, each with its board. */
function keptRows(rows, board) {
  const out = [];
  for (const row of rows) {
    const cells = scrubPermitListRow(row);
    if (cells) out.push({ board: row.board ?? board, cells });
  }
  return out;
}

/**
 * One list's rows, from the edition already read or from the file, or null
 * when the file could not be had or read.
 *
 * @param {{board: string, layout: string, url: string}} list From `permitListLinks`.
 * @param {{fetch: Function, bytes: Function}} http
 * @param {{dir?: string}} [options] Where editions are kept; none keeps nothing.
 * @returns {Promise<?{rows: Array<{board: string, cells: Array<?string>}>, reused: boolean}>}
 */
export async function readPermitList(list, http, { dir } = {}) {
  const kept = await readEdition(dir, list.url);
  const headers = {};
  if (kept?.etag) headers['If-None-Match'] = kept.etag;
  if (kept?.modified) headers['If-Modified-Since'] = kept.modified;
  const response = await http.fetch(list.url, { headers });
  if (!response) return null;
  if (response.status === 304 && kept) return { rows: kept.rows, reused: true };
  if (!response.ok) return null;
  const etag = response.headers?.get?.('etag') || null;
  const modified = response.headers?.get?.('last-modified') || null;
  if (kept && (etag || modified) && kept.etag === etag && kept.modified === modified) {
    await response.body?.cancel?.().catch?.(() => {});
    return { rows: kept.rows, reused: true };
  }
  const bytes = await http.bytes(response, PDF_MAX_BYTES);
  if (!bytes) return null;
  const reader = PERMIT_LIST_READERS[list.layout];
  let document = null;
  try {
    document = extractPdfText(bytes, { inflate: (data) => zlib.inflateSync(data), maxPages: PDF_MAX_PAGES });
  } catch {
    return null;
  }
  const rows = reader && document ? keptRows(reader(document), list.board) : [];
  // A file that reads as no row at all is a layout this reader does not know,
  // or a scan: a failure, so that the archive keeps what it had, not an
  // empty list that would read as a city with nothing under review.
  if (!rows.length) return null;
  await writeEdition(dir, { url: list.url, etag, modified, fields: PERMIT_LIST_FIELDS, rows });
  return { rows, reused: false };
}

/**
 * Every list a city publishes, read, as the archive takes them: rows per
 * board. Null when the page or any list failed — ALL OR NONE, as a commune's
 * boards are (see `permitListLinks`).
 *
 * @param {object} city One of `PERMIT_LISTS`.
 * @param {{fetch: Function, text: Function, bytes: Function}} http
 * @param {{dir?: string, allows?: (pathname: string) => boolean}} [options]
 *   `allows`: the host's `robots.txt`, as `permitListsRobots` reads it.
 * @returns {Promise<?{boards: Record<string, Array<Array<?string>>>, lists: Array<object>}>}
 */
export async function readPermitCity(city, http, { dir, allows = () => true } = {}) {
  if (!allows(new URL(city.page).pathname)) return null;
  const response = await http.fetch(city.page, { headers: { Accept: 'text/html' } });
  if (!response?.ok) return null;
  const html = await http.text(response, PAGE_MAX_BYTES);
  const links = html ? permitListLinks(city, html) : null;
  if (!links) return null;
  const boards = {};
  const lists = [];
  for (const list of links) {
    if (!allows(new URL(list.url).pathname)) return null;
    const answer = await readPermitList(list, http, { dir });
    if (!answer) return null;
    for (const row of answer.rows) (boards[row.board] ??= []).push(row.cells);
    lists.push({ board: list.board, url: list.url, rows: answer.rows.length, reused: answer.reused });
  }
  return { boards, lists };
}

/**
 * Read every city's lists once and fold them into the archive.
 *
 * Sequential, one second apart: two cities, three files and two pages, once a
 * day. A city that fails is left for tomorrow and named in the summary, whose
 * shape is the Cart@DS sweep's, so the same stamp functions read it.
 *
 * @param {object} options
 * @param {Array<object>} options.cities `PERMIT_LISTS`, or a subset.
 * @param {object} options.store `createCartdsArchiveStore(dir, log, PERMIT_LIST_ROWS)`.
 * @param {{fetch: Function, text: Function, bytes: Function}} options.http
 * @param {(city: object) => Promise<{allows: Function, final?: boolean}>} [options.robots]
 * @param {string} [options.dir] Where editions are kept.
 * @param {string} [options.day]
 * @param {number} [options.pauseMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {{log?: Function, warn?: Function}} [options.log]
 * @returns {Promise<object>}
 */
export async function sweepPermitLists({
  cities, store, http, robots = (city) => permitListsRobots(city, http), dir,
  day = cartdsDay(), pauseMs = 1000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console,
}) {
  const paced = {
    text: http.text,
    bytes: http.bytes,
    fetch: async (url, init) => { if (pauseMs > 0) await sleep(pauseMs); return http.fetch(url, init); },
  };
  const summary = {
    day,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    communes: cities.length,
    read: 0,
    added: 0,
    rows: 0,
    refused: [],
    failed: [],
    unsaved: [],
  };
  for (const city of cities) {
    const verdict = await robots(city);
    if (!verdict.allows(new URL(city.page).pathname)) {
      (verdict.final === false ? summary.failed : summary.refused).push(city.key);
      continue;
    }
    const answer = await readPermitCity(city, paced, { dir, allows: verdict.allows });
    if (!answer) { summary.failed.push(city.key); continue; }
    const { archive, added, saved } = await store.record(city, city.insee, answer.boards, day);
    if (!saved) summary.unsaved.push(city.key);
    summary.read += 1;
    summary.added += added;
    summary.rows += archive.rows.length;
  }
  summary.finishedAt = new Date().toISOString();
  log.log?.(`[permit-lists] ${day}: ${summary.read}/${summary.communes} cities read, `
    + `${summary.added} new rows, ${summary.rows} kept`
    + (summary.failed.length ? `, failed: ${summary.failed.join(' ')}` : '')
    + (summary.refused.length ? `, robots.txt refuses: ${summary.refused.join(' ')}` : ''));
  return summary;
}
