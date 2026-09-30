/**
 * Reading Cart@DS boards and keeping what they post — the half that cannot be
 * pure: requests, sessions, files.
 *
 * Two callers, one code path. `vite.config.js` reads a commune's boards when a
 * scan asks for it and sweeps every board once a day; `scripts/cartds-archive.mjs`
 * sweeps from a shell, anywhere, into the same files. The protocol and the row
 * shapes are in `src/data/cartdsFeed.js`, the archive's arithmetic in
 * `src/data/cartdsArchive.js`; this module only moves bytes between them.
 *
 * NETWORK THROUGH THE CALLER. Every request goes through the `http` object the
 * caller hands in — `{fetch, text}`, neither of which ever throws — so the
 * proxy keeps its upstream pacing and user agent, the script its own, and the
 * tests a fake.
 */

import { promises as fsp } from 'node:fs';
import path from 'node:path';
import {
  CARTDS_BOARDS,
  CARTDS_DATA_PATH,
  CARTDS_MAX_PAGES,
  CARTDS_PAGE_LENGTH,
  CARTDS_PAGE_PATH,
  buildCartdsForm,
  cartdsCommuneValue,
  cartdsDataUrl,
  cartdsPageUrl,
  cartdsRobotsUrl,
  parseCartdsToken,
  robotsAllows,
} from '../../src/data/cartdsFeed.js';
import {
  cartdsDay,
  readCartdsArchive,
  recordCartdsBoards,
  unionCartdsArchives,
} from '../../src/data/cartdsArchive.js';

/** Who is asking, on every request to every instance. */
export const CARTDS_USER_AGENT = 'Surplomb/1.0 (ads scan; +https://github.com/mml-studio/surplomb)';

/** Where the archive lives, under the server's persistent cache. */
export const CARTDS_ARCHIVE_DIR = path.join('.gev-cache', 'archive', 'cartds');

/** The file that says when the last sweep ran and what it found. */
export const CARTDS_SWEEP_STAMP = 'sweep.json';

/** A table page may be large; a robots.txt is a few lines. */
const ROBOTS_MAX_BYTES = 512 * 1024;
const TABLE_MAX_BYTES = 24 * 1024 * 1024;

/**
 * @typedef {object} CartdsHttp
 * @property {(url: string, init?: object) => Promise<?Response>} fetch
 *   One request, or null when it could not be made. Never throws.
 * @property {(response: Response, maxBytes?: number) => Promise<?string>} text
 *   The body under a ceiling, or null. Never throws.
 */

/**
 * Whether this instance's host lets a robot read the board (RFC 9309).
 *
 * No file (4xx) allows everything; a file is read for the two paths the reader
 * asks; an unreachable host allows nothing and is not `final`, so the caller
 * asks again rather than remembering it. A 5xx means "down" to the RFC and is
 * a refusal, except on a host the registry marks as answering 503 for every
 * path (`robots5xx`). An instance marked `robots: 'overridden'` is read
 * whatever its file says, and the file is not fetched — see Trap 5 in
 * `cartdsFeed.js`.
 *
 * @param {object} instance One of `CARTDS_INSTANCES`.
 * @param {CartdsHttp} http
 * @returns {Promise<{allowed: boolean, final: boolean, overridden?: boolean}>}
 */
export async function cartdsRobotsVerdict(instance, http) {
  if (instance.robots === 'overridden') return { allowed: true, final: true, overridden: true };
  const response = await http.fetch(cartdsRobotsUrl(instance));
  if (!response) return { allowed: false, final: false };
  if (response.status >= 500) return { allowed: instance.robots5xx === 'absent', final: true };
  if (response.status >= 400) return { allowed: true, final: true };
  const body = await http.text(response, ROBOTS_MAX_BYTES);
  if (body === null) return { allowed: false, final: false };
  const base = new URL(instance.base).pathname;
  return {
    allowed: robotsAllows(body, `${base}${CARTDS_PAGE_PATH}`) && robotsAllows(body, `${base}${CARTDS_DATA_PATH}`),
    final: true,
  };
}

/**
 * The page's anti-forgery token and the cookie it is bound to, or null.
 *
 * One session serves every commune of the instance: the token belongs to the
 * cookie, not to the commune picked in the menu.
 *
 * @param {object} instance
 * @param {CartdsHttp} http
 * @returns {Promise<?{token: string, cookie: string}>}
 */
export async function openCartdsSession(instance, http) {
  const page = await http.fetch(cartdsPageUrl(instance));
  const html = page?.ok ? await http.text(page) : null;
  const token = parseCartdsToken(html);
  const cookie = (page?.headers?.getSetCookie?.() ?? [])
    .map((line) => line.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
  return token && cookie ? { token, cookie } : null;
}

/**
 * Every row of one board, page by page, or null when it did not answer.
 *
 * A JSON answer without a `data` array is a failure, not an empty board: an
 * instance that lost the session answers its error PAGE with HTTP 200.
 *
 * @param {object} instance
 * @param {string} commune What the menu sends (`cartdsCommuneValue`).
 * @param {string} board
 * @param {{token: string, cookie: string}} session
 * @param {CartdsHttp} http
 * @returns {Promise<?{rows: Array, truncated: boolean}>}
 */
export async function readCartdsBoard(instance, commune, board, session, http) {
  const rows = [];
  let total = null;
  for (let page = 0; page < CARTDS_MAX_PAGES; page += 1) {
    const response = await http.fetch(cartdsDataUrl(instance), {
      method: 'POST',
      body: buildCartdsForm({ commune, board, token: session.token, start: page * CARTDS_PAGE_LENGTH }),
      headers: {
        Cookie: session.cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!response?.ok) return null;
    const body = await http.text(response, TABLE_MAX_BYTES);
    let answer = null;
    try { answer = JSON.parse(body ?? ''); } catch { return null; }
    if (!Array.isArray(answer?.data)) return null;
    rows.push(...answer.data);
    total = Number(answer.recordsTotal);
    if (!Number.isFinite(total) || rows.length >= total || !answer.data.length) break;
  }
  return { rows, truncated: Number.isFinite(total) && rows.length < total };
}

/**
 * Both boards of one commune, raw, or null when either failed.
 *
 * BOTH OR NEITHER: served alone, the filing board would draw every dossier as
 * filed, including the ones the other board says were decided.
 *
 * @param {object} instance
 * @param {string} insee
 * @param {{token: string, cookie: string}} session
 * @param {CartdsHttp} http
 * @returns {Promise<?{boards: Record<string, Array>, truncated: boolean}>}
 */
export async function readCartdsCommune(instance, insee, session, http) {
  const commune = cartdsCommuneValue(instance, insee);
  const boards = {};
  let truncated = false;
  for (const board of [CARTDS_BOARDS.filings, CARTDS_BOARDS.decisions]) {
    const answer = await readCartdsBoard(instance, commune, board, session, http);
    if (!answer) return null;
    boards[board] = answer.rows;
    truncated ||= answer.truncated;
  }
  return { boards, truncated };
}

/** Write a file whole or not at all. */
async function writeAtomic(file, text) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(temp, text);
  await fsp.rename(temp, file);
}

/**
 * The archive on disk: one JSON file per commune, `<insee>.json`.
 *
 * Writes to one commune are queued, so the daily sweep and a scan reading the
 * same commune at the same moment cannot interleave a load and a write. A
 * file that cannot be read as this commune's archive is renamed aside, never
 * written over: it may be the only copy of something.
 *
 * @param {string} dir
 * @param {{warn?: (message: string) => void}} [log]
 */
export function createCartdsArchiveStore(dir, log = console) {
  const queues = new Map();
  const fileOf = (insee) => path.join(dir, `${String(insee).toUpperCase()}.json`);

  /** Run `task` after every earlier task on this commune. */
  function queued(insee, task) {
    const key = String(insee).toUpperCase();
    const run = (queues.get(key) ?? Promise.resolve()).then(task, task);
    const tail = run.catch(() => {});
    queues.set(key, tail);
    tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
    return run;
  }

  async function loadFile(instance, insee) {
    let document = null;
    try {
      document = JSON.parse(await fsp.readFile(fileOf(insee), 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') document = { unreadable: String(error?.message || error) };
    }
    return readCartdsArchive(document, instance, insee);
  }

  async function setAside(insee) {
    const file = fileOf(insee);
    const aside = `${file}.unreadable-${Date.now()}`;
    try {
      await fsp.rename(file, aside);
      log.warn?.(`[cartds-archive] ${insee}: unreadable archive set aside as ${path.basename(aside)}`);
    } catch { /* nothing to set aside */ }
  }

  async function save(archive) {
    try {
      await writeAtomic(fileOf(archive.insee), JSON.stringify(archive));
      return true;
    } catch (error) {
      log.warn?.(`[cartds-archive] ${archive.insee}: write failed: ${error?.message || error}`);
      return false;
    }
  }

  return {
    dir,
    fileOf,
    /** The commune's archive as stored, or an empty one. */
    load: (instance, insee) => queued(insee, () => loadFile(instance, insee)),
    /**
     * Fold one reading into the stored archive and write it back. Resolves
     * with the merged archive even when the write failed (`saved: false`).
     */
    record: (instance, insee, boards, day = cartdsDay()) => queued(insee, async () => {
      const { archive, usable } = await loadFile(instance, insee);
      if (!usable) await setAside(insee);
      const answer = recordCartdsBoards(archive, boards, day);
      return { ...answer, saved: await save(answer.archive) };
    }),
    /** Join another copy of the commune's archive into the stored one. */
    join: (instance, insee, other) => queued(insee, async () => {
      const { archive, usable } = await loadFile(instance, insee);
      if (!usable) await setAside(insee);
      const joined = unionCartdsArchives(archive, other);
      return { archive: joined, saved: await save(joined) };
    }),
  };
}

/** The last sweep's summary, or null. */
export async function readCartdsSweepStamp(dir) {
  try {
    return JSON.parse(await fsp.readFile(path.join(dir, CARTDS_SWEEP_STAMP), 'utf8'));
  } catch {
    return null;
  }
}

/** @param {string} dir @param {object} summary */
export async function writeCartdsSweepStamp(dir, summary) {
  await writeAtomic(path.join(dir, CARTDS_SWEEP_STAMP), `${JSON.stringify(summary, null, 1)}\n`);
}

/** A sweep is due once per French calendar day. */
export function cartdsSweepDue(stamp, day = cartdsDay()) {
  return !stamp || typeof stamp.day !== 'string' || stamp.day < day;
}

/**
 * Read every board of every instance once and fold it into the archive.
 *
 * SEQUENTIAL AND SLOW ON PURPOSE. Eleven of the thirteen instances sit on one
 * host family (`*.geosphere.fr`), so the pause is between any two requests of
 * the sweep, not per host: 129 communes, two table requests each, plus one
 * page per instance — about 270 requests, some seven minutes at one second
 * apart, once a day. A commune whose read fails is retried once on a fresh
 * session (a session can lapse during a 41-commune instance) and otherwise
 * left for tomorrow and named in the summary.
 *
 * @param {object} options
 * @param {Array<object>} options.instances `CARTDS_INSTANCES`, or a subset.
 * @param {ReturnType<typeof createCartdsArchiveStore>} options.store
 * @param {CartdsHttp} options.http
 * @param {(instance: object) => Promise<{allowed: boolean}>} [options.robots]
 *   The verdict to use; defaults to asking the host.
 * @param {string} [options.day]
 * @param {number} [options.pauseMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {{log?: Function, warn?: Function}} [options.log]
 * @returns {Promise<object>} The summary, as the stamp stores it.
 */
export async function sweepCartdsArchive({
  instances, store, http, robots = (instance) => cartdsRobotsVerdict(instance, http),
  day = cartdsDay(), pauseMs = 1000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console,
}) {
  const paced = {
    text: http.text,
    fetch: async (url, init) => { if (pauseMs > 0) await sleep(pauseMs); return http.fetch(url, init); },
  };
  const summary = {
    day,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    communes: 0,
    read: 0,
    added: 0,
    rows: 0,
    refused: [],
    failed: [],
    truncated: [],
    unsaved: [],
  };
  for (const instance of instances) {
    summary.communes += instance.communes.length;
    const verdict = await robots(instance);
    if (!verdict.allowed) { summary.refused.push(instance.key); continue; }
    let session = await openCartdsSession(instance, paced);
    for (const insee of instance.communes) {
      let answer = session ? await readCartdsCommune(instance, insee, session, paced) : null;
      if (!answer) {
        session = await openCartdsSession(instance, paced);
        answer = session ? await readCartdsCommune(instance, insee, session, paced) : null;
      }
      if (!answer) { summary.failed.push(insee); continue; }
      if (answer.truncated) summary.truncated.push(insee);
      const { archive, added, saved } = await store.record(instance, insee, answer.boards, day);
      if (!saved) summary.unsaved.push(insee);
      summary.read += 1;
      summary.added += added;
      summary.rows += archive.rows.length;
    }
  }
  summary.finishedAt = new Date().toISOString();
  log.log?.(`[cartds-archive] ${day}: ${summary.read}/${summary.communes} communes read, `
    + `${summary.added} new rows, ${summary.rows} kept`
    + (summary.failed.length ? `, failed: ${summary.failed.join(' ')}` : '')
    + (summary.refused.length ? `, robots.txt refuses: ${summary.refused.join(' ')}` : ''));
  return summary;
}
