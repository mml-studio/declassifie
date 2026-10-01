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
  digilorDocuments,
  digilorIndexBody,
  digilorIndexUrl,
  parseWebdelibActs,
  readAixTables,
  driveFileUrl,
  driveFolderUrl,
  parseDriveFolder,
  typo3ListLinks,
  PERMIT_LIST_TEXT,
  permitListLinks,
  permitListRobotsUrl,
  scrubPermitListRow,
  webdelibFileUrl,
  webdelibLists,
  webdelibMonths,
  webdelibMonthUrl,
  PERMIT_LIST_FIELDS,
  PERMIT_LIST_READERS,
} from '../../src/data/permitListsFeed.js';

/** Where the archive lives, beside the Cart@DS and Sirap ones. */
export const PERMIT_LISTS_ARCHIVE_DIR = path.join('.gev-cache', 'archive', 'permit-lists');

/** Where each edition's rows are kept once read. */
export const PERMIT_LISTS_EDITION_DIR = path.join('.gev-cache', 'permit-lists');

/** Bumped whenever a reader changes, so every edition is read again. */
export const PERMIT_LISTS_READER_SCHEMA = 1;

/**
 * How far back the daily sweep reads a Webdelib+ city. A year of Lyon is
 * some fifty weekly files of 20 to 80 pages, read once: an act never changes,
 * so the next sweeps read two month pages and the new acts only.
 */
export const PERMIT_LISTS_SWEEP_MONTHS = 12;

/** Marseille's page is 430 KB of HTML; a month of Lyon's acts, 3.2 MB. */
const PAGE_MAX_BYTES = 8 * 1024 * 1024;
/** Its list of decisions is 2.5 MB; a list with images could be ten times that. */
const PDF_MAX_BYTES = 32 * 1024 * 1024;
const ROBOTS_MAX_BYTES = 512 * 1024;
/** Argenteuil's index of documents was 10.2 MB on 2026-10-01, and only grows. */
const INDEX_MAX_BYTES = 64 * 1024 * 1024;

/**
 * Files fetched by one reading of a city that publishes one file per dossier
 * (Argenteuil, some 1 400 a year): a scan asks for at most this many it has
 * not read before, the daily sweep for `PERMIT_LISTS_SWEEP_FILES`, so a year's
 * backlog is read over a few days and never by one visitor's scan.
 */
export const PERMIT_LISTS_SCAN_FILES = 60;
export const PERMIT_LISTS_SWEEP_FILES = 400;
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
  // An override asks nothing (see `robots` in `PERMIT_LISTS`).
  if (city.robots === 'overridden') return { allows: () => true, final: true };
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
  // A file that reads as no row at all is a layout this reader does not know,
  // or a scan: a failure, so that the archive keeps what it had, not an
  // empty list that would read as a city with nothing under review.
  const rows = rowsOfPdf(bytes, list.layout, list.board);
  if (!rows) return null;
  await writeEdition(dir, { url: list.url, etag, modified, fields: PERMIT_LIST_FIELDS, rows });
  return { rows, reused: false };
}

/** Parse a PDF's bytes with a list's reader into kept rows, or null. */
function rowsOfPdf(bytes, layout, board) {
  const reader = PERMIT_LIST_READERS[layout];
  let document = null;
  try {
    document = extractPdfText(bytes, {
      inflate: (data) => zlib.inflateSync(data), maxPages: PDF_MAX_PAGES, ...(PERMIT_LIST_TEXT[layout] ?? {}),
    });
  } catch {
    return null;
  }
  const rows = reader && document ? keptRows(reader(document), board) : [];
  return rows.length ? rows : null;
}

/** A month's acts kept on disk once the month is over: it will not change. */
function monthFile(dir, city, { year, month }) {
  return path.join(dir, `webdelib${PERMIT_LISTS_READER_SCHEMA}-${city.key}-${year}-${String(month).padStart(2, '0')}.json`);
}

/**
 * One act of a Webdelib+ city, read: from the edition kept on disk — an act
 * never changes once published, so a kept one is never asked for again — or
 * through `openfile.jsp` and the `showFile.jsp` it names.
 */
async function readWebdelibAct(list, http, { dir, allows }) {
  const kept = await readEdition(dir, list.url);
  if (kept) return { rows: kept.rows, reused: true };
  if (!allows(new URL(list.url).pathname)) return null;
  const opened = await http.fetch(list.url, { headers: { Accept: 'text/html' } });
  if (!opened?.ok) return null;
  const fileUrl = webdelibFileUrl(await http.text(opened, PAGE_MAX_BYTES), list.url);
  if (!fileUrl || !allows(new URL(fileUrl).pathname)) return null;
  const response = await http.fetch(fileUrl);
  if (!response?.ok) return null;
  const bytes = await http.bytes(response, PDF_MAX_BYTES);
  if (!bytes) return null;
  return keepFile(dir, list, bytes);
}

/**
 * A file that is one act or one dossier, read and kept. One that holds no row
 * — a scan, two of Argenteuil's 480 decisions of 2026 — is kept as empty, so
 * it is not downloaded again every day to say the same nothing.
 */
async function keepFile(dir, list, bytes) {
  const rows = rowsOfPdf(bytes, list.layout, list.board) ?? [];
  await writeEdition(dir, {
    url: list.url, title: list.title ?? null, published: list.published ?? null, fields: PERMIT_LIST_FIELDS, rows,
  });
  return { rows, reused: false, empty: !rows.length };
}

/**
 * A city whose lists are files in a public Google Drive folder (Versailles):
 * a folder per year, in each a folder per board, in each one file per
 * fortnight. The years the reading's months reach are listed, every file of
 * their boards read once — a file is kept by its Drive id and never asked for
 * again — at most `maxFiles` new ones at a time. Every listing must answer:
 * a year missing would read as a year without permits.
 */
async function readDriveCity(city, http, { dir, allows, months, day, maxFiles }) {
  const list = async (id) => {
    const url = driveFolderUrl(id);
    if (!allows(new URL(url).pathname)) return null;
    const response = await http.fetch(url, { headers: { Accept: 'text/html' } });
    if (!response?.ok) return null;
    const html = await http.text(response, PAGE_MAX_BYTES);
    return html ? parseDriveFolder(html) : null;
  };
  const root = await list(city.source.root);
  if (!root) return null;
  const [first] = webdelibMonths(day, months).slice(-1);
  const years = root.filter((entry) => entry.folder && /^\d{4}$/.test(entry.title) && Number(entry.title) >= first.year);
  const files = [];
  for (const year of years) {
    const boards = await list(year.id);
    if (!boards) return null;
    for (const shelf of city.lists) {
      const folder = boards.find((entry) => entry.folder && shelf.folder.test(entry.title));
      if (!folder) continue;
      const entries = await list(folder.id);
      if (!entries) return null;
      for (const entry of entries) {
        if (entry.folder || !/\.pdf$/i.test(entry.title)) continue;
        files.push({ board: shelf.board, layout: shelf.layout, url: driveFileUrl(entry.id), title: entry.title });
      }
    }
  }
  const boards = {};
  let fetched = 0;
  let failed = 0;
  let skipped = 0;
  let reused = 0;
  for (const file of files) {
    const kept = await readEdition(dir, file.url);
    let answer = kept ? { rows: kept.rows, reused: true } : null;
    if (kept) reused += 1;
    else if (fetched >= maxFiles) { skipped += 1; continue; } else {
      fetched += 1;
      const response = allows(new URL(file.url).pathname) ? await http.fetch(file.url) : null;
      const bytes = response?.ok ? await http.bytes(response, PDF_MAX_BYTES) : null;
      answer = bytes ? await keepFile(dir, file, bytes) : null;
    }
    if (!answer) { failed += 1; continue; }
    for (const row of answer.rows) (boards[row.board] ??= []).push(row.cells);
  }
  return {
    boards,
    lists: [{ url: driveFolderUrl(city.source.root), files: files.length, fetched, reused, skipped }],
    failed,
    skipped,
    incomplete: failed > 0 || skipped > 0,
  };
}

/**
 * Aix's page, both tables read at once (`readAixTables`). The window is the
 * page's, two months recomputed at each request; the archive keeps the rest.
 */
async function readArcopoleCity(city, http, { allows }) {
  if (!allows(new URL(city.page).pathname)) return null;
  const response = await http.fetch(city.page, { headers: { Accept: 'text/html' } });
  if (!response?.ok) return null;
  const html = await http.text(response, PAGE_MAX_BYTES);
  const tables = html ? readAixTables(city, html) : null;
  if (!tables) return null;
  const boards = {};
  const lists = [];
  for (const board of ['filings', 'decisions']) {
    const rows = keptRows(tables[board], board);
    boards[board] = rows.map((row) => row.cells);
    lists.push({ board, url: city.page, rows: rows.length, reused: false });
  }
  return { boards, lists, failed: 0, incomplete: false };
}

/**
 * A Digilor Datahall city: the index of every document, then one file per
 * dossier published in the last `months` months, newest first. A file already
 * read comes from disk; at most `maxFiles` new ones are fetched, and a reading
 * that left some for later says so (`skipped`).
 */
async function readDigilorCity(city, http, { dir, allows, months, day, maxFiles }) {
  const indexUrl = digilorIndexUrl(city);
  if (!allows(new URL(indexUrl).pathname)) return null;
  const response = await http.fetch(indexUrl, {
    method: 'POST',
    body: digilorIndexBody(city),
    headers: { 'Content-Type': 'text/plain', Accept: 'application/json' },
  });
  if (!response?.ok) return null;
  const body = await http.text(response, INDEX_MAX_BYTES);
  let index = null;
  try { index = JSON.parse(body ?? ''); } catch { return null; }
  const [first] = webdelibMonths(day, months).slice(-1);
  const since = `${first.year}-${String(first.month).padStart(2, '0')}-01`;
  const documents = digilorDocuments(city, index, since);
  if (!documents) return null;
  const boards = {};
  let fetched = 0;
  let failed = 0;
  let skipped = 0;
  let empty = 0;
  let reused = 0;
  for (const doc of documents) {
    const list = { ...doc, layout: 'grid' };
    let answer = null;
    const kept = await readEdition(dir, doc.url);
    if (kept) {
      answer = { rows: kept.rows, reused: true };
      reused += 1;
    } else if (fetched >= maxFiles) {
      skipped += 1;
      continue;
    } else {
      fetched += 1;
      const file = allows(new URL(doc.url).pathname) ? await http.fetch(doc.url) : null;
      const bytes = file?.ok ? await http.bytes(file, PDF_MAX_BYTES) : null;
      answer = bytes ? await keepFile(dir, list, bytes) : null;
    }
    if (!answer) { failed += 1; continue; }
    if (!answer.rows.length) empty += 1;
    for (const row of answer.rows) (boards[row.board] ??= []).push(row.cells);
  }
  return {
    boards,
    lists: [{ url: indexUrl, files: documents.length, fetched, reused, empty, skipped }],
    failed,
    skipped,
    incomplete: failed > 0 || skipped > 0,
  };
}

/**
 * A Webdelib+ city's lists over the last `months` months.
 *
 * The month pages are read first — a month that is over comes from disk —
 * then every act a list names. ALL OR NONE for the pages: a month that did not
 * answer would read as a month with no permit. An act whose file fails is
 * left out and counted, and the reading says it is incomplete: its rows are
 * real, and the act is asked for again next time.
 */
async function readWebdelibCity(city, http, { dir, allows, months, day }) {
  const acts = [];
  const span = webdelibMonths(day, months);
  for (const [i, month] of span.entries()) {
    const closed = i >= 2 && dir;
    if (closed) {
      try {
        acts.push(...JSON.parse(await fsp.readFile(monthFile(dir, city, month), 'utf8')));
        continue;
      } catch { /* not kept yet */ }
    }
    const url = webdelibMonthUrl(city, month);
    if (!allows(new URL(url).pathname)) return null;
    const response = await http.fetch(url, { headers: { Accept: 'text/html' } });
    if (!response?.ok) return null;
    const html = await http.text(response, PAGE_MAX_BYTES);
    if (html === null) return null;
    const found = parseWebdelibActs(html, url);
    acts.push(...found);
    if (closed) {
      try {
        await fsp.mkdir(dir, { recursive: true });
        await fsp.writeFile(monthFile(dir, city, month), JSON.stringify(found));
      } catch { /* a cache is an optimisation, never a requirement */ }
    }
  }
  const boards = {};
  const lists = [];
  let failed = 0;
  for (const list of webdelibLists(city, acts)) {
    const answer = await readWebdelibAct(list, http, { dir, allows });
    if (!answer) { failed += 1; continue; }
    for (const row of answer.rows) (boards[row.board] ??= []).push(row.cells);
    lists.push({ board: list.board, url: list.url, title: list.title, rows: answer.rows.length, reused: answer.reused });
  }
  return { boards, lists, failed, incomplete: failed > 0 };
}

/**
 * Every list a city publishes, read, as the archive takes them: rows per
 * board. Null when the page or any list failed — ALL OR NONE, as a commune's
 * boards are (see `permitListLinks`); a Webdelib+ city is read act by act
 * (see `readWebdelibCity`).
 *
 * @param {object} city One of `PERMIT_LISTS`.
 * @param {{fetch: Function, text: Function, bytes: Function}} http
 * @param {{dir?: string, allows?: (pathname: string) => boolean, months?: number,
 *   day?: string}} [options] `allows`: the host's `robots.txt`, as
 *   `permitListsRobots` reads it. `months`: how far back a Webdelib+ city is
 *   read — two by default, a scan's; the daily sweep reads further.
 * @returns {Promise<?{boards: Record<string, Array<Array<?string>>>, lists: Array<object>}>}
 */
export async function readPermitCity(city, http, {
  dir, allows = () => true, months = 2, day = cartdsDay(), maxFiles = PERMIT_LISTS_SCAN_FILES,
} = {}) {
  if (city.source?.kind === 'webdelib') return readWebdelibCity(city, http, { dir, allows, months, day });
  if (city.source?.kind === 'arcopole') return readArcopoleCity(city, http, { allows });
  if (city.source?.kind === 'digilor') return readDigilorCity(city, http, { dir, allows, months, day, maxFiles });
  if (city.source?.kind === 'drive') return readDriveCity(city, http, { dir, allows, months, day, maxFiles });
  const pageUrl = city.source?.kind === 'typo3' ? city.source.api : city.page;
  if (!allows(new URL(pageUrl).pathname)) return null;
  const response = await http.fetch(pageUrl, {
    headers: { Accept: city.source?.kind === 'typo3' ? 'application/json' : 'text/html' },
  });
  if (!response?.ok) return null;
  const body = await http.text(response, PAGE_MAX_BYTES);
  let links = null;
  if (city.source?.kind === 'typo3') {
    try { links = typo3ListLinks(city, JSON.parse(body ?? '')); } catch { links = null; }
  } else links = body ? permitListLinks(city, body) : null;
  if (!links) return null;
  return readLinkedLists(links, http, { dir, allows, maxFiles });
}

/**
 * The files a page links, read: ALL OR NONE, except a list marked optional
 * (Clermont's filings, whose link answered 404 on 2026-10-01) and the
 * editions of a list marked `all` (Mulhouse's), which never change once
 * posted — one already read is not asked for again, and at most `maxFiles`
 * new ones are read at a time.
 */
async function readLinkedLists(links, http, { dir, allows, maxFiles }) {
  const boards = {};
  const lists = [];
  let fetched = 0;
  let skipped = 0;
  let failed = 0;
  for (const list of links) {
    const kept = list.immutable ? await readEdition(dir, list.url) : null;
    let answer = kept ? { rows: kept.rows, reused: true } : null;
    if (!answer && list.immutable && fetched >= maxFiles) { skipped += 1; continue; }
    if (!answer) {
      if (list.immutable) fetched += 1;
      answer = allows(new URL(list.url).pathname) ? await readPermitList(list, http, { dir }) : null;
    }
    if (!answer) {
      if (list.optional || list.immutable) { failed += 1; continue; }
      return null;
    }
    for (const row of answer.rows) (boards[row.board] ??= []).push(row.cells);
    lists.push({ board: list.board, url: list.url, rows: answer.rows.length, reused: answer.reused });
  }
  return { boards, lists, failed, skipped, incomplete: failed > 0 || skipped > 0 };
}

/**
 * Read every city's lists once and fold them into the archive.
 *
 * Sequential, one second apart, once a day: a page and a file per list for a
 * city that links its lists, two month pages and the acts not yet read for a
 * Webdelib+ city. An act that failed is named as `<city>:<count>`. A city that fails is left for tomorrow and named in the summary, whose
 * shape is the Cart@DS sweep's, so the same stamp functions read it.
 *
 * @param {object} options
 * @param {Array<object>} options.cities `PERMIT_LISTS`, or a subset.
 * @param {object} options.store `createCartdsArchiveStore(dir, log, PERMIT_LIST_ROWS)`.
 * @param {{fetch: Function, text: Function, bytes: Function}} options.http
 * @param {(city: object) => Promise<{allows: Function, final?: boolean}>} [options.robots]
 * @param {string} [options.dir] Where editions are kept.
 * @param {number} [options.months] How far back a Webdelib+ city is read.
 * @param {string} [options.day]
 * @param {number} [options.pauseMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {{log?: Function, warn?: Function}} [options.log]
 * @returns {Promise<object>}
 */
export async function sweepPermitLists({
  cities, store, http, robots = (city) => permitListsRobots(city, http), dir, months = PERMIT_LISTS_SWEEP_MONTHS,
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
    const answer = await readPermitCity(city, paced, {
      dir, allows: verdict.allows, months, day, maxFiles: PERMIT_LISTS_SWEEP_FILES,
    });
    if (!answer) { summary.failed.push(city.key); continue; }
    if (answer.failed) summary.failed.push(`${city.key}:${answer.failed}`);
    if (answer.skipped) (summary.backlog ??= []).push(`${city.key}:${answer.skipped}`);
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
