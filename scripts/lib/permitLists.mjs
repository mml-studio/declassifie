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
import { dematdocFiles, municipalFiles, municipalNextPage, municipalTitleRow } from '../../src/data/municipalPermitsFeed.js';
import { digilorTitleRow, lorientBoardUrl, readLorientBoard, rueilTitleRow } from '../../src/data/municipalPermitExtensions.js';
import {
  dematdocDocuments, dematdocLazyRequest, dematdocOldest, dematdocShelfRequest, dematdocTitleRow, DEMATDOC_MAX_PAGES,
} from '../../src/data/dematdocFeed.js';
import municipalMessages from '../../src/data/municipalPermitsFeed.i18n.js';
import { BOARD_READERS, BOARD_TEXT, boardProtocol } from '../../src/data/permitBoards.js';
import {
  webdevPortalUrl, webdevSession, webdevRequestBody, webdevMenu, webdevYears,
  webdevFolders, webdevLatestPosting, webdevLists,
} from '../../src/data/webdevPermitsFeed.js';
import {
  arcadeActs,
  arcadeActUrl,
  arcadeContentUrl,
  arcadeFileContent,
  arcadeFilesUrl,
  arcadeIsList,
  arcadeSearchUrl,
  bulletinChallenge,
  bulletinLinks,
  BULLETIN_READERS,
  digilorDocuments,
  digilorIndexBody,
  digilorIndexUrl,
  parseWebdelibActs,
  readAixTables,
  driveFileUrl,
  laRochelleDecisionTitle,
  limogesDecisionRow,
  liferayTreeUrl,
  parseLiferayTree,
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
export const PERMIT_LISTS_READER_SCHEMA = 3;

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
 * Bulletins read by OCR in one sweep (Lille, Trap 9 of `permitListsFeed.js`):
 * at most this many new ones, and no new one once this many pages have been
 * read. See `readBulletinCity` for the numbers.
 */
export const PERMIT_LISTS_SWEEP_BULLETINS = 40;
export const PERMIT_LISTS_SWEEP_PAGES = 1500;

/** Bumped whenever a bulletin reader changes, so every bulletin is read again. */
export const PERMIT_LISTS_BULLETIN_SCHEMA = 1;

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
  const response = await http.fetch(permitListRobotsUrl(city), city.userAgent ? { headers: { 'User-Agent': city.userAgent } } : undefined);
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
function rowsOfPdf(bytes, layout, board, context = {}) {
  const reader = PERMIT_LIST_READERS[layout] ?? BOARD_READERS[layout];
  let document = null;
  try {
    document = extractPdfText(bytes, {
      inflate: (data) => zlib.inflateSync(data), maxPages: PDF_MAX_PAGES,
      ...(PERMIT_LIST_TEXT[layout] ?? BOARD_TEXT[layout] ?? {}),
    });
  } catch {
    return null;
  }
  const rows = reader && document ? keptRows(reader(document, context), board) : [];
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
async function readWebdelibAct(list, http, { dir, allows }, context = {}) {
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
  return keepFile(dir, list, bytes, context);
}

/**
 * A file that is one act or one dossier, read and kept. One that holds no row
 * — a scan, two of Argenteuil's 480 decisions of 2026 — is kept as empty, so
 * it is not downloaded again every day to say the same nothing.
 */
async function keepFile(dir, list, bytes, context = {}) {
  const rows = rowsOfPdf(bytes, list.layout, list.board, context) ?? [];
  await writeEdition(dir, {
    url: list.url, published: list.published ?? null, fields: PERMIT_LIST_FIELDS, rows,
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
 * A city whose boards are Liferay document spaces (La Rochelle): each space's
 * files listed as JSON, each file read once, at most `maxFiles` new ones a
 * reading. A decision is one file whose title — `2026-09-30 DP 17300 26
 * 01057 <applicant>` — gives the number and the posting day; the title is
 * handed to the reader and never stored, for it names a person. Decisions
 * posted before the reading's months are left alone.
 */
async function readLiferayCity(city, http, { dir, allows, months, day, maxFiles }) {
  const [first] = webdelibMonths(day, months).slice(-1);
  const since = `${first.year}-${String(first.month).padStart(2, '0')}-01`;
  const files = [];
  for (const shelf of city.source.shelves) {
    const url = liferayTreeUrl(city, shelf);
    if (!allows(new URL(url).pathname)) return null;
    const response = await http.fetch(url, { headers: { Accept: 'application/json' } });
    if (!response?.ok) return null;
    let tree = null;
    try { tree = parseLiferayTree(JSON.parse((await http.text(response, PAGE_MAX_BYTES)) ?? '')); } catch { tree = null; }
    if (!tree) return null;
    for (const file of tree) {
      if (shelf.board === 'decisions') {
        const head = laRochelleDecisionTitle(file.title);
        if (!head || head.day < since) continue;
      }
      files.push({ list: { board: shelf.board, layout: shelf.layout, url: file.url }, context: { title: file.title } });
    }
  }
  const boards = {};
  let fetched = 0;
  let failed = 0;
  let skipped = 0;
  let reused = 0;
  for (const { list, context } of files) {
    const kept = await readEdition(dir, list.url);
    let answer = kept ? { rows: kept.rows, reused: true } : null;
    if (kept) reused += 1;
    else if (fetched >= maxFiles) { skipped += 1; continue; } else {
      fetched += 1;
      const response = allows(new URL(list.url).pathname) ? await http.fetch(list.url) : null;
      const bytes = response?.ok ? await http.bytes(response, PDF_MAX_BYTES) : null;
      answer = bytes ? await keepFile(dir, list, bytes, context) : null;
    }
    if (!answer) { failed += 1; continue; }
    for (const row of answer.rows) (boards[row.board] ??= []).push(row.cells);
  }
  return {
    boards,
    lists: [{ url: city.source.base, files: files.length, fetched, reused, skipped }],
    failed,
    skipped,
    incomplete: failed > 0 || skipped > 0,
  };
}

/** An Arcade search page is 200 acts; Limoges posted 647 in three and a half months of 2026. */
const ARCADE_MAX_PAGES = 25;

/**
 * An Arcade city (Limoges, Trap 8 of `permitListsFeed.js`): its urbanism acts
 * newest first, a page of 200 at a time, until one reaches before the
 * reading's months. A decision is its act's title and days, read without its
 * file — a scan. A list of filings is an act whose one PDF is a table: its
 * files asked for once, the PDF read once and kept under the act's address,
 * at most `maxFiles` new ones a reading. ALL OR NONE for the search pages: a
 * page that did not answer would read as weeks without a decision.
 */
async function readArcadeCity(city, http, { dir, allows, months, day, maxFiles }) {
  const [first] = webdelibMonths(day, months).slice(-1);
  const since = `${first.year}-${String(first.month).padStart(2, '0')}-01`;
  const acts = [];
  for (let page = 0; page < ARCADE_MAX_PAGES; page += 1) {
    const url = arcadeSearchUrl(city, { page });
    if (!allows(new URL(url).pathname)) return null;
    const response = await http.fetch(url, { headers: { Accept: 'application/json' } });
    if (!response?.ok) return null;
    let answer = null;
    try { answer = arcadeActs(JSON.parse((await http.text(response, PAGE_MAX_BYTES)) ?? '')); } catch { answer = null; }
    if (!answer) return null;
    acts.push(...answer.acts);
    if (answer.last || answer.acts.some((act) => act.publishedOn && act.publishedOn < since)) break;
  }
  const recent = acts.filter((act) => !act.publishedOn || act.publishedOn >= since);
  const boards = {};
  for (const row of keptRows(recent.map(limogesDecisionRow).filter(Boolean), 'decisions')) {
    (boards[row.board] ??= []).push(row.cells);
  }
  let fetched = 0;
  let failed = 0;
  let skipped = 0;
  let reused = 0;
  for (const act of recent.filter(arcadeIsList)) {
    const list = { board: 'filings', layout: 'limoges', url: arcadeActUrl(city, act.id), published: act.publishedOn };
    const kept = await readEdition(dir, list.url);
    let answer = kept ? { rows: kept.rows, reused: true } : null;
    if (kept) reused += 1;
    else if (fetched >= maxFiles) { skipped += 1; continue; } else {
      fetched += 1;
      const filesUrl = arcadeFilesUrl(city, act.id);
      const files = allows(new URL(filesUrl).pathname)
        ? await http.fetch(filesUrl, { headers: { Accept: 'application/json' } }) : null;
      let contentId = null;
      try { contentId = files?.ok ? arcadeFileContent(JSON.parse((await http.text(files, PAGE_MAX_BYTES)) ?? '')) : null; } catch { contentId = null; }
      const fileUrl = contentId ? arcadeContentUrl(city, contentId) : null;
      const response = fileUrl && allows(new URL(fileUrl).pathname) ? await http.fetch(fileUrl) : null;
      const bytes = response?.ok ? await http.bytes(response, PDF_MAX_BYTES) : null;
      answer = bytes ? await keepFile(dir, list, bytes) : null;
    }
    if (!answer) { failed += 1; continue; }
    for (const row of answer.rows) (boards[row.board] ??= []).push(row.cells);
  }
  return {
    boards,
    lists: [{
      url: city.source.base, acts: recent.length, decisions: boards.decisions?.length ?? 0,
      files: recent.filter(arcadeIsList).length, fetched, reused, skipped,
    }],
    failed,
    skipped,
    incomplete: failed > 0 || skipped > 0,
  };
}

/** The ledger of a city's bulletins: one file, every bulletin read, by address. */
function bulletinLedgerFile(dir, city) {
  return path.join(dir, `bulletin${PERMIT_LISTS_BULLETIN_SCHEMA}-${city.key}.json`);
}

async function readBulletinLedger(dir, city) {
  if (!dir) return { bulletins: {} };
  try {
    const kept = JSON.parse(await fsp.readFile(bulletinLedgerFile(dir, city), 'utf8'));
    return kept && typeof kept.bulletins === 'object' && kept.bulletins ? kept : { bulletins: {} };
  } catch {
    return { bulletins: {} };
  }
}

async function writeBulletinLedger(dir, city, ledger) {
  if (!dir) return;
  const file = bulletinLedgerFile(dir, city);
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(temp, JSON.stringify(ledger));
    await fsp.rename(temp, file);
  } catch { /* the next sweep reads the bulletin again */ }
}

/** Every row the ledger holds, by board. */
function ledgerBoards(ledger) {
  const boards = {};
  for (const bulletin of Object.values(ledger.bulletins)) {
    for (const row of bulletin.rows ?? []) (boards[row.board] ??= []).push(row.cells);
  }
  return boards;
}

/** Whether bytes are a PDF's, not a page a shield served in its place. */
function isPdf(bytes) {
  return bytes?.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/**
 * A city that posts its decisions as scans in a daily bulletin (Lille, Trap 9
 * of `permitListsFeed.js`).
 *
 * READ BY OCR, IN THE DAILY SWEEP ONLY. A scan — a visitor waiting — is given
 * `ocr: null` and draws what the sweep has read, out of the ledger, without a
 * request. The sweep reads the city's page, then every bulletin of the
 * reading's months the ledger does not hold, OLDEST FIRST, so that a day the
 * server missed is read at the next sweep in its turn; at most `maxFiles` new
 * bulletins and no new one past `maxPages` pages, the rest left for the next
 * sweep and said (`skipped`). Each bulletin goes into the ledger as soon as it
 * is read, rows only — never its text, which names the applicants — so that a
 * sweep cut short keeps what it read.
 *
 * FAIL CLOSED. An answer that is a shield's challenge rather than the page or
 * the PDF (`bulletinChallenge`, or bytes that are no PDF), or a refusal
 * (403, 429), ends the reading there: what was read is kept, and nothing is
 * asked again before the next sweep.
 *
 * Measured on 2026-10-01: Lille's page links 181 bulletins since 2 January;
 * 14 sampled were 703 pages, 2 to 148 each, 290 of them pages of 95 urbanism
 * arrêtés in 7 of the 14. On a Mac (M5, one thread) a page set aside by its
 * band costs 0.17 s and a page read whole about 1.4 s.
 */
async function readBulletinCity(city, http, {
  dir, allows, months, day, ocr, maxFiles, maxPages = PERMIT_LISTS_SWEEP_PAGES, log = console,
}) {
  const ledger = await readBulletinLedger(dir, city);
  const read = Object.keys(ledger.bulletins).length;
  if (!ocr) {
    if (!read) return null;
    return { boards: ledgerBoards(ledger), lists: [{ url: city.page, bulletins: read, fetched: 0 }], failed: 0, skipped: 0, incomplete: false };
  }
  const reader = BULLETIN_READERS[city.lists?.[0]?.layout];
  if (!reader || !allows(new URL(city.page).pathname)) return null;
  const response = await http.fetch(city.page, { headers: { Accept: 'text/html' } });
  const html = response?.ok ? await http.text(response, PAGE_MAX_BYTES) : null;
  if (html !== null && bulletinChallenge(html)) {
    log.warn?.(`[permit-lists] ${city.key}: the page answered a challenge, not read`);
    return null;
  }
  const links = html ? bulletinLinks(city, html) : [];
  if (!links.length) return null;
  const [first] = webdelibMonths(day, months).slice(-1);
  const since = `${first.year}-${String(first.month).padStart(2, '0')}-01`;
  const unread = links.filter((link) => link.day >= since && !ledger.bulletins[link.url]);
  let fetched = 0;
  let pages = 0;
  let failed = 0;
  let skipped = 0;
  let stopped = null;
  for (const link of unread) {
    if (stopped || fetched >= maxFiles || pages >= maxPages) { skipped += 1; continue; }
    fetched += 1;
    if (!allows(new URL(link.url).pathname)) { failed += 1; continue; }
    const file = await http.fetch(link.url);
    if (file && [403, 429].includes(file.status)) { stopped = `HTTP ${file.status}`; failed += 1; continue; }
    const bytes = file?.ok ? await http.bytes(file, PDF_MAX_BYTES) : null;
    if (bytes && !isPdf(bytes)) { stopped = 'an answer that is no PDF'; failed += 1; continue; }
    const scanned = bytes ? await ocr(bytes, { screen: reader.screen }) : null;
    if (!scanned) { failed += 1; continue; }
    pages += scanned.pages.length;
    const answer = reader.read(scanned.pages, { day: link.day, insee: city.insee });
    ledger.bulletins[link.url] = {
      day: link.day,
      readOn: day,
      pages: scanned.pages.length,
      readWhole: scanned.read,
      ms: scanned.ms,
      acts: answer.acts,
      dropped: answer.dropped,
      rows: keptRows(answer.rows, 'decisions'),
    };
    await writeBulletinLedger(dir, city, ledger);
  }
  if (stopped) log.warn?.(`[permit-lists] ${city.key}: ${stopped}, the reading stops here until the next sweep`);
  return {
    boards: ledgerBoards(ledger),
    lists: [{
      url: city.page, bulletins: links.length, unread: unread.length, fetched, pages, read: Object.keys(ledger.bulletins).length, skipped,
    }],
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
async function readDigilorCity(city, http, { dir, allows, months, day, maxFiles, ocr }) {
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
  let pendingOcr = 0;
  for (const doc of documents) {
    const list = { ...doc, layout: doc.layout ?? 'grid' };
    let answer = null;
    const kept = await readEdition(dir, doc.url);
    if (kept && !(kept.pendingOcr && ocr)) {
      answer = { ...kept, reused: true };
      reused += 1;
    } else if (fetched >= maxFiles) {
      skipped += 1;
      answer = kept;
      if (!answer) continue;
    } else {
      fetched += 1;
      const file = allows(new URL(doc.url).pathname) ? await http.fetch(doc.url) : null;
      const bytes = file?.ok ? await http.bytes(file, PDF_MAX_BYTES) : null;
      if (city.source.formats && (!bytes || !Buffer.from(bytes.subarray(0, 1024)).includes('%PDF-'))) {
        failed += 1;
        continue;
      }
      if (bytes && city.source.formats) {
        const context = { city, file: list };
        let rows = rowsOfPdf(bytes, list.layout, list.board, context);
        let awaitsOcr = false;
        const needsOcr = list.layout === 'extended-notice' && (!rows?.length
          || rows.some((row) => row.cells[8] === municipalMessages.definition.signed.fr));
        if (needsOcr) {
          // No visitor runs OCR. The daily sweep retries the cached scans.
          const scanned = ocr ? await ocr(bytes, { positioned: true }) : null;
          const scannedRows = scanned?.document ? keptRows(PERMIT_LIST_READERS[list.layout](scanned.document, context), list.board) : [];
          if (scannedRows.length) rows = scannedRows;
          if (!rows?.length) {
            const fallback = digilorTitleRow(city, list);
            rows = fallback ? keptRows([fallback], list.board) : [];
          }
          awaitsOcr = !scanned?.document;
        }
        answer = { url: doc.url, fields: PERMIT_LIST_FIELDS, rows: rows ?? [], pendingOcr: awaitsOcr };
        await writeEdition(dir, answer);
      } else answer = bytes ? await keepFile(dir, list, bytes) : null;
    }
    if (!answer) { failed += 1; continue; }
    if (answer.pendingOcr) pendingOcr += 1;
    if (!answer.rows.length) empty += 1;
    for (const row of answer.rows) (boards[row.board] ??= []).push(row.cells);
  }
  return {
    boards,
    lists: [{ url: indexUrl, files: documents.length, fetched, reused, empty, skipped }],
    failed,
    skipped,
    pendingOcr,
    incomplete: failed > 0 || skipped > 0 || pendingOcr > 0,
  };
}

/**
 * A DematDOC tenant: each urbanism shelf's documents on display, newest
 * first, paged by the ids the API leaves until a page reaches `since`; then
 * one PDF per act, as for Digilor. A file already read comes from disk; at
 * most `maxFiles` new ones are fetched. A scan with no text layer gives the
 * title's number and street meanwhile, and waits for the sweep's OCR.
 */
async function readDematdocCity(city, http, { dir, allows, months, day, maxFiles, ocr }) {
  const [first] = webdelibMonths(day, months).slice(-1);
  const since = `${first.year}-${String(first.month).padStart(2, '0')}-01`;
  const listed = [];
  const post = async ({ url, body }) => {
    if (!allows(new URL(url).pathname)) return null;
    const response = await http.fetch(url, {
      method: 'POST', body, headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
    if (!response?.ok) return null;
    try { return JSON.parse(await http.text(response, INDEX_MAX_BYTES) ?? ''); } catch { return null; }
  };
  for (const doctype of city.source.doctypes) {
    let page = await post(dematdocShelfRequest(city, doctype));
    if (!Array.isArray(page?.documents)) return null;
    listed.push(...page.documents);
    for (let more = 0; more < DEMATDOC_MAX_PAGES && page?.nextDocsIds?.length
      && (dematdocOldest(page.documents) ?? '') >= since; more += 1) {
      page = await post(dematdocLazyRequest(city, page.nextDocsIds));
      if (!Array.isArray(page?.documents)) break;
      listed.push(...page.documents);
    }
  }
  const documents = dematdocDocuments(city, listed, since)
    .sort((a, b) => (b.published ?? '').localeCompare(a.published ?? '') || b.url.localeCompare(a.url));
  const boards = {};
  let fetched = 0;
  let failed = 0;
  let skipped = 0;
  let empty = 0;
  let reused = 0;
  let pendingOcr = 0;
  for (const doc of documents) {
    let answer = null;
    const kept = await readEdition(dir, doc.url);
    if (kept && !(kept.pendingOcr && ocr)) {
      answer = kept;
      reused += 1;
    } else if (fetched >= maxFiles) {
      skipped += 1;
      answer = kept;
      if (!answer) continue;
    } else {
      fetched += 1;
      const file = allows(new URL(doc.url).pathname) ? await http.fetch(doc.url) : null;
      const bytes = file?.ok ? await http.bytes(file, PDF_MAX_BYTES) : null;
      if (!bytes || !Buffer.from(bytes.subarray(0, 1024)).includes('%PDF-')) { failed += 1; continue; }
      const context = { city, file: doc };
      let rows = rowsOfPdf(bytes, doc.layout, doc.board, context);
      let awaitsOcr = false;
      if (!rows?.length) {
        // No visitor runs OCR. The daily sweep retries the cached scans.
        const scanned = ocr ? await ocr(bytes, { positioned: true }) : null;
        rows = scanned?.document ? keptRows(PERMIT_LIST_READERS[doc.layout](scanned.document, context), doc.board) : [];
        if (!rows.length) {
          const fallback = dematdocTitleRow(city, doc);
          rows = fallback ? keptRows([fallback], fallback.board) : [];
        }
        awaitsOcr = !scanned?.document;
      }
      answer = { url: doc.url, fields: PERMIT_LIST_FIELDS, rows, pendingOcr: awaitsOcr };
      await writeEdition(dir, answer);
    }
    if (answer.pendingOcr) pendingOcr += 1;
    if (!answer.rows.length) empty += 1;
    for (const row of answer.rows) (boards[row.board] ??= []).push(row.cells);
  }
  return {
    boards,
    lists: [{ url: city.page, files: documents.length, fetched, reused, empty, skipped }],
    failed,
    skipped,
    pendingOcr,
    incomplete: failed > 0 || skipped > 0 || pendingOcr > 0,
  };
}

/** Lorient is three small requests per commune, with both boards required. */
async function readLorientCity(city, http, { allows }) {
  if (!allows(new URL(city.page).pathname)) return null;
  const page = await http.fetch(city.page);
  const html = page?.ok ? await http.text(page, PAGE_MAX_BYTES) : null;
  if (!html) return null;
  const boards = {};
  const lists = [];
  for (const board of ['filings', 'decisions']) {
    const url = lorientBoardUrl(city, html, board);
    if (!url || !allows(new URL(url).pathname)) return null;
    const response = await http.fetch(url, { headers: { Accept: 'application/json' } });
    if (!response?.ok) return null;
    let rows;
    try { rows = readLorientBoard(city, board, JSON.parse(await http.text(response, PAGE_MAX_BYTES))); } catch { return null; }
    if (!rows) return null;
    boards[board] = keptRows(rows, board).map((row) => row.cells);
    lists.push({ board, url, rows: boards[board].length });
  }
  return { boards, lists, failed: 0, incomplete: false };
}

/** Rueil's month cache contains scrubbed title fields, never raw titles. */
async function readRueilCity(city, http, { dir, allows, months, day, maxFiles }) {
  const acts = [];
  for (const [i, month] of webdelibMonths(day, months).entries()) {
    const closed = i >= 2 && dir;
    const cache = dir ? monthFile(dir, city, month) : null;
    if (closed) {
      try { acts.push(...JSON.parse(await fsp.readFile(cache, 'utf8'))); continue; } catch { /* not read yet */ }
    }
    const url = webdelibMonthUrl(city, month);
    if (!allows(new URL(url).pathname)) return null;
    const response = await http.fetch(url, { headers: { Accept: 'text/html' } });
    const html = response?.ok ? await http.text(response, PAGE_MAX_BYTES) : null;
    if (html === null) return null;
    const found = parseWebdelibActs(html, url, { actDate: true }).flatMap((act) => {
      const row = rueilTitleRow(city, act);
      return row ? [{ url: act.url, published: act.published, row }] : [];
    });
    acts.push(...found);
    if (closed) {
      try { await fsp.mkdir(dir, { recursive: true }); await fsp.writeFile(cache, JSON.stringify(found)); } catch { /* optional cache */ }
    }
  }
  const boards = { decisions: [] };
  const lists = [];
  let fetched = 0;
  let failed = 0;
  let skipped = 0;
  for (const file of [...new Map(acts.map((act) => [act.url, act])).values()]) {
    const kept = await readEdition(dir, file.url);
    let answer = kept;
    if (!kept && fetched < maxFiles) {
      fetched += 1;
      const list = { ...file, board: 'decisions', layout: 'extended-notice' };
      answer = await readWebdelibAct(list, http, { dir, allows }, { city, file: list });
      if (!answer) failed += 1;
    } else if (!kept) skipped += 1;
    const rows = answer?.rows?.length ? answer.rows : keptRows([file.row], 'decisions');
    boards.decisions.push(...rows.map((row) => row.cells));
    lists.push({ url: file.url, board: 'decisions', rows: rows.length, reused: Boolean(kept) });
  }
  return { boards, lists, failed, skipped, incomplete: failed > 0 || skipped > 0 };
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
 *   day?: string, ocr?: ?Function, log?: object, background?: boolean}} [options] `allows`: the
 *   host's `robots.txt`, as `permitListsRobots` reads it. `months`: how far
 *   back a Webdelib+ city is read — two by default, a scan's; the daily sweep
 *   reads further. `ocr`: the function a scanned bulletin is read with
 *   (`createPdfOcr`), handed in by the sweep alone; without it a bulletin
 *   city is drawn from what the sweep has read. `background`: a daily sweep,
 *   which also reads the slow municipal Drupal boards; visitors use their
 *   scrubbed snapshots.
 * @returns {Promise<?{boards: Record<string, Array<Array<?string>>>, lists: Array<object>}>}
 */
export async function readPermitCity(city, http, {
  dir, allows = () => true, months = 2, day = cartdsDay(), maxFiles = PERMIT_LISTS_SCAN_FILES,
  ocr = null, maxPages, log, background = false,
} = {}) {
  if (city.source?.kind === 'board') return readBoardCity(city, http, { dir, allows, months, day, maxFiles, ocr, background, log });
  if (city.source?.kind === 'lorient') return readLorientCity(city, http, { allows });
  if (city.source?.kind === 'rueil') return readRueilCity(city, http, { dir, allows, months, day, maxFiles });
  if (city.source?.kind === 'webdev') return readWebdevCity(city, http, { dir, allows, maxFiles, day });
  if (city.source?.kind === 'municipal') return readMunicipalCity(city, http, { dir, allows, months, day, maxFiles, ocr, background });
  if (city.source?.kind === 'bulletin') return readBulletinCity(city, http, { dir, allows, months, day, ocr, maxFiles, maxPages, log });
  if (city.source?.kind === 'webdelib') return readWebdelibCity(city, http, { dir, allows, months, day });
  if (city.source?.kind === 'arcopole') return readArcopoleCity(city, http, { allows });
  if (city.source?.kind === 'digilor') return readDigilorCity(city, http, { dir, allows, months, day, maxFiles, ocr: background ? ocr : null });
  if (city.source?.kind === 'dematdoc') return readDematdocCity(city, http, { dir, allows, months, day, maxFiles, ocr: background ? ocr : null });
  if (city.source?.kind === 'drive') return readDriveCity(city, http, { dir, allows, months, day, maxFiles });
  if (city.source?.kind === 'liferay') return readLiferayCity(city, http, { dir, allows, months, day, maxFiles });
  if (city.source?.kind === 'arcade') return readArcadeCity(city, http, { dir, allows, months, day, maxFiles });
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

/** Index requests one reading of a board city follows, at most. */
const BOARD_MAX_PAGES = 40;

/**
 * Files one sweep of a board city reads by OCR, at most: La Roche-sur-Yon
 * posts some 955 scanned acts a year, about a second a page to read — the
 * newest forty first, the backlog over the days after.
 */
export const BOARD_SWEEP_OCR_FILES = 40;

/** A request's answer as its protocol reads it, or null. */
async function boardAnswer(city, http, request, allows) {
  if (!allows(new URL(request.url).pathname)) return null;
  const accept = request.as === 'json' ? 'application/json' : request.as === 'html' ? 'text/html' : '*/*';
  const response = await http.fetch(request.url, {
    ...(request.method ? { method: request.method } : {}),
    ...(request.body !== undefined ? { body: request.body } : {}),
    headers: { Accept: accept, ...(city.userAgent ? { 'User-Agent': city.userAgent } : {}), ...(request.headers ?? {}) },
  });
  if (!response?.ok) {
    await response?.body?.cancel?.().catch?.(() => {});
    return null;
  }
  const body = await http.text(response, INDEX_MAX_BYTES);
  if (body === null) return null;
  if (request.as !== 'json') return body;
  try { return JSON.parse(body); } catch { return null; }
}

/**
 * A city of `permitBoardCities.js`: its protocol's index requests, then the
 * files they name, newest first. A file read once is kept by its address and
 * never asked for again unless it is `rolling`; at most `maxFiles` new ones
 * per reading, the others counted as `skipped` and drawn from what their
 * index said of them. OCR runs in the daily sweep only, on at most
 * {@link BOARD_SWEEP_OCR_FILES} files: an `ocr` file whose text yields no
 * row, and a `scan` — a file the board only ever posts scanned, which a
 * visitor's reading does not even download. Until then its index row
 * stands, and the reading says it awaits OCR.
 *
 * ALL OR NONE for the first index: nothing answered is null, and the archive
 * keeps what it had. A later index or a file that fails makes the reading
 * incomplete, never empty.
 */
async function readBoardCity(city, http, { dir, allows, months, day, maxFiles, ocr, background }) {
  const protocol = boardProtocol(city);
  if (!protocol) return null;
  const [first] = webdelibMonths(day, months).slice(-1);
  const since = `${first.year}-${String(first.month).padStart(2, '0')}-01`;
  const options = { since, day };
  const queue = [...protocol.start(city, options)];
  const seen = new Set();
  const files = [];
  const indexRows = [];
  let answered = 0;
  let incomplete = false;
  for (let pages = 0; queue.length; pages += 1) {
    const request = queue.shift();
    const id = `${request.method ?? 'GET'} ${request.url} ${request.body ?? ''}`;
    if (seen.has(id)) continue;
    if (pages >= BOARD_MAX_PAGES) { incomplete = true; break; }
    seen.add(id);
    const body = await boardAnswer(city, http, request, allows);
    const found = body === null ? null : protocol.index(city, body, request, options);
    if (!found) {
      if (!answered) return null;
      incomplete = true;
      continue;
    }
    answered += 1;
    files.push(...(found.files ?? []));
    indexRows.push(...(found.rows ?? []));
    queue.push(...(found.next ?? []));
  }
  const boards = {};
  const lists = [];
  for (const row of keptRows(indexRows)) (boards[row.board] ??= []).push(row.cells);
  if (indexRows.length) lists.push({ url: city.page, rows: indexRows.length, reused: false });
  const selected = [...new Map(files.map((file) => [file.url, file])).values()]
    .filter((file) => !file.published || file.published >= since)
    .sort((a, b) => (b.published ?? '').localeCompare(a.published ?? '') || b.url.localeCompare(a.url));
  let fetched = 0;
  let reused = 0;
  let failed = 0;
  let skipped = 0;
  let pendingOcr = 0;
  let ocrRuns = 0;
  const canOcr = () => Boolean(ocr && background && ocrRuns < BOARD_SWEEP_OCR_FILES);
  const fallback = (file) => (file.row ? keptRows([file.row], file.board) : []);
  for (const file of selected) {
    const kept = await readEdition(dir, file.url);
    let answer = null;
    const retry = kept?.pendingOcr && canOcr();
    if (kept && !file.rolling && !retry) {
      answer = kept;
      reused += 1;
    } else if (file.scan && !kept && !canOcr()) {
      // Nothing a visitor could read: the index row, awaiting the sweep.
      answer = { rows: fallback(file), pendingOcr: true };
    } else if (fetched >= maxFiles) {
      skipped += 1;
      answer = kept ?? { rows: fallback(file), pendingOcr: Boolean(file.ocr) };
    } else {
      fetched += 1;
      // `Accept` tells the proxy a file is coming, whatever its address says
      // (`/download/55135`, `/file?filename=…`): it waits longer for one.
      const headers = { Accept: 'application/pdf', ...(city.userAgent ? { 'User-Agent': city.userAgent } : {}), ...(file.headers ?? {}) };
      if (file.rolling && kept?.etag) headers['If-None-Match'] = kept.etag;
      if (file.rolling && kept?.modified) headers['If-Modified-Since'] = kept.modified;
      const response = allows(new URL(file.url).pathname) ? await http.fetch(file.url, { headers }) : null;
      if (response?.status === 304 && kept) {
        answer = kept;
      } else {
        const bytes = response?.ok ? await http.bytes(response, PDF_MAX_BYTES) : null;
        if (!bytes || !Buffer.from(bytes.subarray(0, 1024)).includes('%PDF-')) {
          failed += 1;
          answer = kept ?? (file.row ? { rows: fallback(file) } : null);
        } else {
          const context = { city, file };
          let rows = file.scan ? null : rowsOfPdf(bytes, file.layout, file.board, context);
          let awaitsOcr = false;
          if (!rows && (file.ocr || file.scan)) {
            let scanned = null;
            if (canOcr()) {
              ocrRuns += 1;
              scanned = await ocr(bytes, { positioned: true, maxPages: file.ocrPages });
            }
            const reader = PERMIT_LIST_READERS[file.layout] ?? BOARD_READERS[file.layout];
            rows = scanned?.document && reader ? keptRows(reader(scanned.document, context), file.board) : null;
            if (!rows?.length) { rows = null; awaitsOcr = !scanned?.document; }
          }
          answer = {
            url: file.url, fields: PERMIT_LIST_FIELDS, rows: rows ?? fallback(file), pendingOcr: awaitsOcr,
            etag: response.headers?.get?.('etag') || null, modified: response.headers?.get?.('last-modified') || null,
          };
          await writeEdition(dir, answer);
        }
      }
    }
    if (!answer) continue;
    if (answer.pendingOcr) pendingOcr += 1;
    for (const row of answer.rows) (boards[row.board] ??= []).push(row.cells);
    lists.push({ url: file.url, board: file.board, rows: answer.rows.length, reused: answer === kept });
  }
  return {
    boards, lists, fetched, reused, failed, skipped, pendingOcr,
    incomplete: incomplete || failed > 0 || skipped > 0 || pendingOcr > 0,
  };
}

/**
 * Brive's anonymous WEBDEV board. Read the stable municipal page for its
 * portal URL, then the live publisher/category/year menus and newest posting
 * folder. Current files are not pinned to yesterday's numeric IDs. The
 * previous year is checked too when January's collection is still empty.
 * Every origin's own robots file applies to its requests. No browser needed.
 */
async function readWebdevCity(city, http, { dir, allows, maxFiles, day }) {
  if (!allows(new URL(city.page).pathname)) return null;
  const page = await http.fetch(city.page);
  const portal = page?.ok ? webdevPortalUrl(city, await http.text(page, PAGE_MAX_BYTES)) : null;
  if (!portal) return null;
  const portalRobots = await permitListsRobots({ page: portal }, http);
  if (!portalRobots.allows(new URL(portal).pathname)) return null;
  const response = await http.fetch(portal, { headers: { Accept: 'text/html' } });
  const session = response?.ok ? webdevSession(city, await http.text(response, PAGE_MAX_BYTES), portal) : null;
  if (!session || !portalRobots.allows(new URL(session.url).pathname)) return null;
  const post = async (options) => {
    const result = await http.fetch(session.url, { method: 'POST', headers: {
      'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/xml',
      Referer: portal, Origin: new URL(portal).origin,
    }, body: webdevRequestBody(session, options) });
    const xml = result?.ok ? await http.text(result, PAGE_MAX_BYTES) : null;
    return /^\s*<\?xml\b[^>]*>\s*<WAJAX\b/i.test(xml ?? '') && /<\/WAJAX>\s*$/.test(xml) ? xml : null;
  };
  const publisher = await post({ context: 'A41' });
  if (!publisher) return null;
  const categories = webdevMenu(publisher, 'A9');
  // i18n-ignore-next-line — the publisher's category names, newest layout first
  for (const title of ['Documents', 'Urbanisme']) {
    const category = categories.find((item) => item.title === title)?.value;
    if (!category) continue;
    const root = await post({ context: 'A16', category });
    if (!root) return null;
    const currentYear = Number(day.slice(0, 4));
    const years = webdevYears(root).filter((item) => item.year <= currentYear && item.year >= currentYear - 1);
    for (const year of years) {
      const options = { category, year: year.value };
      const collection = year.value === '1' ? root : await post({ ...options, context: 'A28' });
      if (!collection) return null;
      // i18n-ignore-next-line — the publisher's folder name
      const urbanism = webdevFolders(collection).find((folder) => /^urbanisme$/i.test(folder.title));
      if (!urbanism) continue;
      const folders = await post({ ...options, context: 'A18', folder: urbanism.id });
      if (!folders) return null;
      const posting = webdevLatestPosting(folders);
      if (!posting) continue;
      const content = await post({ ...options, context: 'A18', folder: posting.id });
      const lists = content ? webdevLists(city, content) : null;
      if (!lists) return null;
      const filesRobots = await permitListsRobots({ page: city.source.fileBase }, http);
      return readLinkedLists(lists, http, { dir, maxFiles, allows: filesRobots.allows });
    }
  }
  return null;
}

/**
 * Municipal boards: JSON aggregate lists, paginated Drupal cards, or PDF
 * links. Each published file is read once. Scans await positioned OCR in
 * the daily sweep; visitors can use a title's site and explicit verdict.
 * Only scrubbed rows are cached, never titles, applicant fields or OCR text.
 * A failed page or file makes the result incomplete, preserving the archive.
 */
async function readMunicipalCity(city, http, { dir, allows, months, day, maxFiles, ocr, background }) {
  const snapshot = dir ? path.join(dir, `municipal${PERMIT_LISTS_READER_SCHEMA}-${city.key}.json`) : null;
  // Drupal boards ask for ten seconds between requests, and list dozens of
  // pages. The sweep does that work; visitors draw its scrubbed snapshot.
  if (city.crawlDelayMs && !background) {
    if (!snapshot) return null;
    try {
      const kept = JSON.parse(await fsp.readFile(snapshot, 'utf8'));
      return kept.city === city.key && kept.boards && Array.isArray(kept.lists) ? kept : null;
    } catch { return null; }
  }
  const files = [];
  let incomplete = false;
  if (city.source.protocol === 'dematdoc') {
    const url = new URL(city.source.api, city.page).href;
    if (!allows(new URL(url).pathname)) return null;
    const response = await http.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ filters: [] }) });
    if (!response?.ok) return null;
    let listed;
    try { listed = dematdocFiles(city, JSON.parse(await http.text(response, PAGE_MAX_BYTES))); } catch { return null; }
    if (!listed?.length) return null;
    files.push(...listed);
  } else {
    let url = city.page;
    const seen = new Set();
    const limit = city.source.maxPages ?? 1;
    for (let page = 0; url && page < limit; page += 1) {
      if (seen.has(url) || !allows(new URL(url).pathname)) { incomplete = true; break; }
      seen.add(url);
      const response = await http.fetch(url, { headers: { Accept: 'text/html' } });
      const html = response?.ok ? await http.text(response, PAGE_MAX_BYTES) : null;
      if (!html) { if (!files.length) return null; incomplete = true; break; }
      files.push(...municipalFiles(city, html));
      url = city.source.protocol === 'drupal' ? municipalNextPage(city, html, url) : null;
      if (url && page === limit - 1) incomplete = true;
    }
    if (!files.length) return null;
  }
  const [first] = webdelibMonths(day, months).slice(-1);
  const since = `${first.year}-${String(first.month).padStart(2, '0')}-01`;
  const fileDay = (file) => file.published ?? /\/(20\d{2})[/-](\d{2})\//.exec(file.url)?.slice(1).join('-') ?? /\/(20\d{2})\//.exec(file.url)?.[1] ?? '';
  const selected = [...new Map(files.map((file) => [file.url, file])).values()]
    .filter((file) => { const date = fileDay(file); return !date || date >= since.slice(0, date.length); })
    .sort((a, b) => fileDay(b).localeCompare(fileDay(a)) || b.url.localeCompare(a.url));
  const boards = {};
  let fetched = 0;
  let reused = 0;
  let failed = 0;
  let skipped = 0;
  let pendingOcr = 0;
  const lists = [];
  for (const file of selected) {
    const kept = await readEdition(dir, file.url);
    let answer = kept;
    const retry = kept?.pendingOcr && ocr;
    if (!kept || retry) {
      if (fetched >= maxFiles) {
        skipped += 1;
        if (!kept) continue;
      } else {
        fetched += 1;
        const response = allows(new URL(file.url).pathname) ? await http.fetch(file.url) : null;
        const bytes = response?.ok ? await http.bytes(response, PDF_MAX_BYTES) : null;
        if (bytes && Buffer.from(bytes.subarray(0, 1024)).includes('%PDF-')) {
          const context = { city, file };
          let rows = rowsOfPdf(bytes, file.layout, file.board, context);
          let awaitsOcr = false;
          if (!rows && file.layout !== 'saint-priest-table') {
            let scanned = ocr ? await ocr(bytes, { positioned: true }) : null;
            rows = scanned?.document ? keptRows(PERMIT_LIST_READERS[file.layout](scanned.document, context), file.board) : null;
            // Wattrelos scans a landscape table sideways on a portrait page.
            if (!rows?.length && ocr && file.layout === 'wattrelos-table') {
              scanned = await ocr(bytes, { positioned: true, rotate: 270 });
              rows = scanned?.document ? keptRows(PERMIT_LIST_READERS[file.layout](scanned.document, context), file.board) : null;
            }
            if (!rows?.length) {
              const fallback = file.layout === 'municipal-notice' ? municipalTitleRow(city, file) : null;
              rows = fallback ? keptRows([fallback], file.board) : [];
              awaitsOcr = true;
            }
          }
          answer = { url: file.url, fields: PERMIT_LIST_FIELDS, rows: rows ?? [], pendingOcr: awaitsOcr };
          await writeEdition(dir, answer);
        } else { failed += 1; if (!kept) continue; }
      }
    } else reused += 1;
    if (answer.pendingOcr) pendingOcr += 1;
    if (!answer.rows.length) { failed += 1; continue; }
    for (const row of answer.rows) (boards[row.board] ??= []).push(row.cells);
    lists.push({ url: file.url, board: file.board, rows: answer.rows.length, reused: answer === kept });
  }
  const answer = { city: city.key, boards, lists, fetched, reused, failed, skipped, pendingOcr,
    incomplete: incomplete || failed > 0 || skipped > 0 || pendingOcr > 0 };
  if (snapshot) {
    const temp = `${snapshot}.${process.pid}.tmp`;
    try {
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(temp, JSON.stringify(answer));
      await fsp.rename(temp, snapshot);
    } catch { /* the archive still keeps these rows */ }
  }
  return answer;
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
 * @param {number} [options.pauseMs] Between two requests; a city's own
 *   `crawlDelayMs` (Lille's `Crawl-delay: 10`) when it asks for more.
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {?Function} [options.ocr] What a scanned bulletin is read with
 *   (`createPdfOcr` of `pdfOcr.mjs`), or null where poppler and Tesseract are
 *   missing: a city that needs it is then left out, with one line in the log.
 * @param {{log?: Function, warn?: Function}} [options.log]
 * @returns {Promise<object>}
 */
export async function sweepPermitLists({
  cities, store, http, robots = (city) => permitListsRobots(city, http), dir, months = PERMIT_LISTS_SWEEP_MONTHS,
  day = cartdsDay(), pauseMs = 1000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ocr = null, log = console,
}) {
  const pacedFor = (city) => {
    const pause = Math.max(pauseMs, city.crawlDelayMs ?? 0);
    return {
      text: http.text,
      bytes: http.bytes,
      fetch: async (url, init) => { if (pause > 0) await sleep(pause); return http.fetch(url, init); },
    };
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
    const bulletin = city.source?.kind === 'bulletin';
    if (bulletin && !ocr) {
      log.log?.(`[permit-lists] ${city.key}: no OCR here (pdftoppm, tesseract with French), its bulletins are not read`);
      (summary.withoutOcr ??= []).push(city.key);
      continue;
    }
    const verdict = await robots(city);
    if (!verdict.allows(new URL(city.page).pathname)) {
      (verdict.final === false ? summary.failed : summary.refused).push(city.key);
      continue;
    }
    // A board city caps its OCR apart (`BOARD_SWEEP_OCR_FILES`): its text
    // files are read at the usual pace.
    const board = city.source?.kind === 'board';
    const scanned = bulletin || city.source?.kind === 'municipal' || (city.source?.ocr && !board);
    const answer = await readPermitCity(city, pacedFor(city), {
      dir, allows: verdict.allows, months, day, log, background: true,
      maxFiles: scanned ? PERMIT_LISTS_SWEEP_BULLETINS : PERMIT_LISTS_SWEEP_FILES,
      ...(scanned || (board && city.source?.ocr) ? { ocr } : {}),
    });
    if (!answer) { summary.failed.push(city.key); continue; }
    if (answer.failed) summary.failed.push(`${city.key}:${answer.failed}`);
    if (answer.skipped) (summary.backlog ??= []).push(`${city.key}:${answer.skipped}`);
    if (answer.pendingOcr) (summary.pendingOcr ??= []).push(`${city.key}:${answer.pendingOcr}`);
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
