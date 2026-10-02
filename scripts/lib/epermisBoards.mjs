/**
 * Reading the e-permis board and keeping what it posts — the half that cannot
 * be pure: a page, its script, a token, the lists, and files.
 *
 * The twin of `sirapBoards.mjs`, with what the API adds: the reader holds the
 * public client it found in the page's script, a one-hour token and the
 * publisher's environment, and renews them itself (Trap 1 of
 * `src/data/epermisFeed.js`). The rows are kept by the same archive store
 * (`createCartdsArchiveStore` with `EPERMIS_ROWS`), one file per commune, in a
 * directory of their own, and swept once a day by the same server.
 *
 * ONE REQUEST AT A TIME. Every request a reader makes — a scan's, the sweep's
 * — goes through one queue, {@link EPERMIS_PAUSE_MS} after the previous answer
 * was read, whoever asked; and the server gives every reader the same gate
 * ({@link createEpermisGate}), so that twenty publishers on one API are
 * still one request at a time: about forty requests for clients that do not
 * exist, in half a minute, got an address refused everything for some three
 * hours (2026-10-01).
 *
 * NETWORK THROUGH THE CALLER, as for the other boards: `{fetch, text}`,
 * neither of which ever throws. Nothing here logs a row, and the client
 * secret is never logged either.
 */

import path from 'node:path';
import {
  EPERMIS_API,
  EPERMIS_BOARDS,
  EPERMIS_MAX_PAGES,
  EPERMIS_SITE,
  EPERMIS_TOKEN_URL,
  buildEpermisTokenForm,
  epermisBoardsByCommune,
  epermisConfigUrl,
  epermisDaysOf,
  epermisHistoryFloor,
  epermisHistoryWindows,
  epermisListUrl,
  epermisPageUrl,
  epermisRecentWindow,
  epermisScriptUrl,
  epermisToken,
  parseEpermisClient,
  parseEpermisConfig,
  parseEpermisPage,
} from '../../src/data/epermisFeed.js';
import { robotsAllows } from '../../src/data/cartdsFeed.js';
import { cartdsDay } from '../../src/data/cartdsArchive.js';

/** Where the archive lives, beside the Cart@DS and Sirap ones. */
export const EPERMIS_ARCHIVE_DIR = path.join('.gev-cache', 'archive', 'epermis');

/** Between the end of one answer and the next request, whoever asks. */
export const EPERMIS_PAUSE_MS = 500;

/** A page of 100 decisions is about 80 KB; the page's script 820 KB. */
const PAGE_MAX_BYTES = 4 * 1024 * 1024;
const SCRIPT_MAX_BYTES = 8 * 1024 * 1024;
const SMALL_MAX_BYTES = 512 * 1024;

/** A token is renewed this long before it expires. */
const TOKEN_MARGIN_MS = 60 * 1000;

/** @param {?string} body @returns {*} */
function parseJson(body) {
  try {
    return JSON.parse(body ?? '');
  } catch {
    return null;
  }
}

/**
 * The hosts the reader asks, and the path it asks of each: the page and its
 * script, the API, the token server.
 * @returns {Array<{url: string, path: string}>}
 */
export function epermisRobotsChecks() {
  return [
    { url: `${EPERMIS_SITE}/robots.txt`, path: '/depot' },
    { url: `${new URL(EPERMIS_API).origin}/robots.txt`, path: new URL(EPERMIS_API).pathname },
    { url: `${new URL(EPERMIS_TOKEN_URL).origin}/robots.txt`, path: new URL(EPERMIS_TOKEN_URL).pathname },
  ];
}

/**
 * Whether the three hosts let a robot read the board (RFC 9309).
 *
 * As for a PU host: no file (4xx) allows, and so does an HTML page served for
 * the path — the app's own page at `affichage.e-permis.fr`, the sign-in page
 * at `auth.clicmap.fr`, both HTTP 200 on 2026-10-01; the API's host answers
 * 404. A file that refuses the path is obeyed; an unreachable host allows
 * nothing and is not `final`.
 *
 * @param {object} instance One of `EPERMIS_INSTANCES` (every one shares the hosts).
 * @param {import('./cartdsArchive.mjs').CartdsHttp} http
 * @returns {Promise<{allowed: boolean, final: boolean}>}
 */
export async function epermisRobotsVerdict(instance, http) {
  for (const check of epermisRobotsChecks(instance)) {
    const response = await http.fetch(check.url);
    if (!response) return { allowed: false, final: false };
    if (response.status >= 500) return { allowed: false, final: true };
    if (response.status >= 400) continue;
    if (/html/i.test(response.headers?.get?.('content-type') || '')) {
      await response.body?.cancel?.().catch?.(() => {});
      continue;
    }
    const body = await http.text(response, SMALL_MAX_BYTES);
    if (body === null) return { allowed: false, final: false };
    if (!robotsAllows(body, check.path)) return { allowed: false, final: true };
  }
  return { allowed: true, final: true };
}

/**
 * The queue requests to clicmap wait in: each one leaves `pauseMs` after the
 * previous answer was read, whoever asked.
 *
 * @param {object} [options]
 * @param {() => number} [options.now]
 * @param {number} [options.pauseMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @returns {{run: <T>(task: () => Promise<T>) => Promise<T>}}
 */
export function createEpermisGate({
  now = Date.now,
  pauseMs = EPERMIS_PAUSE_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let lastAt = -Infinity;
  let tail = Promise.resolve();
  return {
    run(task) {
      const run = tail.then(async () => {
        const wait = lastAt + pauseMs - now();
        if (wait > 0) await sleep(wait);
        try {
          return await task();
        } finally {
          lastAt = now();
        }
      });
      tail = run.catch(() => {});
      return run;
    },
  };
}

/**
 * A reader for one publisher: the token, the environment and the queue.
 *
 * `readWindow` answers both lists for a window, or null — ALL OR NONE, as a
 * commune's two Cart@DS boards are: served without its decisions, a commune
 * would look as if nothing had been decided. A 401 re-reads the page's script
 * for the client (it may have changed) and asks once more; a request that did
 * not answer is asked once more; anything else is a failure.
 *
 * @param {object} instance One of `EPERMIS_INSTANCES`.
 * @param {import('./cartdsArchive.mjs').CartdsHttp} http
 * @param {object} [options]
 * @param {() => number} [options.now]
 * @param {number} [options.pauseMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {{warn?: Function}} [options.log]
 * @param {{run: Function}} [options.gate] Shared by every publisher's reader; its own by default.
 */
export function createEpermisReader(instance, http, {
  now = Date.now,
  pauseMs = EPERMIS_PAUSE_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console,
  gate = createEpermisGate({ now, pauseMs, sleep }),
} = {}) {
  let client = null;
  let token = null;
  let config = null;
  const warned = new Set();

  /** Said once per process and cause: a daily sweep must not fill the log. */
  function warnOnce(cause, message) {
    if (warned.has(cause)) return;
    warned.add(cause);
    log.warn?.(`[ADS Proxy] e-permis ${instance.key}: ${message}`);
  }

  /** One request, after every earlier one has been read, `pauseMs` later. */
  function send(url, init = {}, maxBytes = PAGE_MAX_BYTES) {
    return gate.run(async () => {
      const response = await http.fetch(url, init);
      if (!response) return null;
      if (!response.ok) {
        await response.body?.cancel?.().catch?.(() => {});
        return { status: response.status, ok: false, body: null };
      }
      const body = await http.text(response, maxBytes);
      return body === null ? null : { status: response.status, ok: true, body };
    });
  }

  /** The public client, read off the page's script (Trap 1). */
  async function readClient() {
    const page = await send(epermisPageUrl(instance), { headers: { Accept: 'text/html' } }, SMALL_MAX_BYTES);
    const scriptUrl = page?.ok ? epermisScriptUrl(page.body) : null;
    if (!scriptUrl) return null;
    const script = await send(scriptUrl, { headers: { Accept: '*/*' } }, SCRIPT_MAX_BYTES);
    return script?.ok ? parseEpermisClient(script.body) : null;
  }

  /** A valid token and the environment, or false — the source is closed. */
  async function authorise(fresh = false) {
    if (!fresh && token && token.expiresAt - TOKEN_MARGIN_MS > now() && config) return true;
    if (fresh || !client) {
      client = await readClient();
      if (!client) {
        warnOnce('client', 'the board’s page no longer shows the client its token is asked with; not read');
        return false;
      }
    }
    const sentAt = now();
    const answer = await send(EPERMIS_TOKEN_URL, {
      method: 'POST',
      body: buildEpermisTokenForm(client),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    }, SMALL_MAX_BYTES);
    token = answer?.ok ? epermisToken(parseJson(answer.body), sentAt) : null;
    if (!token) {
      // Read the script again next time: a refused client may be a new one.
      client = null;
      warnOnce('token', `the token server answered ${answer ? `HTTP ${answer.status}` : 'nothing'}; not read`);
      return false;
    }
    if (!config) {
      const answered = await send(epermisConfigUrl(instance), {
        headers: { Authorization: token.authorization, Accept: 'application/json' },
      }, SMALL_MAX_BYTES);
      config = answered?.ok ? parseEpermisConfig(parseJson(answered.body)) : null;
      if (!config) {
        warnOnce('config', 'the publisher’s configuration did not answer; not read');
        return false;
      }
      const known = [...instance.communes, ...(instance.silent ?? [])];
      const missing = config.communes.filter((code) => !known.includes(code));
      if (missing.length) warnOnce('communes', `the publisher now lists ${missing.join(' ')}, which the registry does not`);
    }
    return true;
  }

  /** One page of a list, or null. */
  async function readPage(url) {
    let fresh = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!(await authorise(fresh))) return null;
      const answer = await send(url, {
        headers: { Authorization: token.authorization, Env: config.envId, Accept: 'application/json' },
      });
      if (answer?.status === 401) { token = null; fresh = true; continue; }
      if (!answer) continue;
      if (!answer.ok) return null;
      return parseEpermisPage(parseJson(answer.body));
    }
    return null;
  }

  /**
   * One list over one window, every page, or null.
   * @param {string} board One of `EPERMIS_BOARDS`.
   * @param {{from: string, to: string}} window
   * @returns {Promise<?{rows: Array<object>, truncated: boolean}>}
   */
  async function readList(board, window) {
    const rows = [];
    for (let page = 1; page <= EPERMIS_MAX_PAGES; page += 1) {
      const answer = await readPage(epermisListUrl(board, page, window));
      if (!answer) return null;
      rows.push(...answer.rows);
      if (!answer.full) return { rows, truncated: false };
    }
    return { rows, truncated: true };
  }

  return {
    /** The configuration the API answered, once asked. */
    get config() { return config; },
    readList,
    /**
     * Both lists over one window, or null.
     * @param {{from: string, to: string}} window
     * @returns {Promise<?{boards: Record<string, Array<object>>, truncated: boolean}>}
     */
    async readWindow(window) {
      const boards = {};
      let truncated = false;
      for (const board of Object.values(EPERMIS_BOARDS)) {
        const list = await readList(board, window);
        if (!list) return null;
        boards[board] = list.rows;
        truncated ||= list.truncated;
      }
      return { boards, truncated };
    },
  };
}

/** List-days a window read a day at a time may lose before it is an outage. */
export const EPERMIS_MAX_SKIPPED = 4;

/**
 * One window read a day and a list at a time, the list-days that fail left
 * out and named — or null when more than `maxSkipped` fail, which is the
 * server down rather than a row it cannot send (Trap 10 of `epermisFeed.js`).
 *
 * @param {ReturnType<typeof createEpermisReader>} reader
 * @param {{from: string, to: string}} window
 * @param {number} [maxSkipped]
 * @returns {Promise<?{boards: Record<string, Array<object>>, truncated: boolean, skipped: Array<string>}>}
 */
export async function readEpermisByDay(reader, window, maxSkipped = EPERMIS_MAX_SKIPPED) {
  const boards = Object.fromEntries(Object.values(EPERMIS_BOARDS).map((board) => [board, []]));
  const skipped = [];
  let truncated = false;
  for (const day of epermisDaysOf(window)) {
    for (const board of Object.values(EPERMIS_BOARDS)) {
      const list = await reader.readList(board, { from: day, to: day });
      if (!list) {
        skipped.push(`${board} ${day}`);
        if (skipped.length > maxSkipped) return null;
        continue;
      }
      boards[board].push(...list.rows);
      truncated ||= list.truncated;
    }
  }
  return { boards, truncated, skipped };
}

/**
 * A window, whole if it answers, else a day at a time (Trap 10).
 * @returns {Promise<?{boards: Record<string, Array<object>>, truncated: boolean, skipped: Array<string>}>}
 */
async function readEpermisWindow(reader, window) {
  const whole = await reader.readWindow(window);
  if (whole) return { ...whole, skipped: [] };
  // No configuration means no token: the source is closed, not a row poisoned.
  if (!reader.config) return null;
  return readEpermisByDay(reader, window);
}

/** A `YYYY-MM-DD` day, or null. */
function dayOrNull(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? value : null;
}

/**
 * Read every publisher once and fold what it posts into the archive.
 *
 * Each sweep reads the recent window ({@link epermisRecentWindow}) and then
 * walks history back a year at most (`EPERMIS_HISTORY_MONTHS_PER_SWEEP`, a
 * calendar month a window), from where the previous sweep stopped down to the
 * layer's default window (`epermisHistoryFloor`): three sweeps fill three
 * years, about fifty more requests a day while they do, and about ten a day
 * afterwards. A window that fails whole is read again a day and a list at a
 * time ({@link readEpermisByDay}): the list-days that still fail are left out
 * and named in `skipped` — one, measured, the decisions of 2026-01-16 — and
 * when more fail than one poisoned row explains, the walk stops for the day
 * and the next sweep resumes there. `history` in the summary — kept in
 * `sweep.json` — is the earliest day read.
 *
 * Every listed commune is recorded, posted or not, so its archive says it was
 * read that day. The summary has the shape of the other sweeps', so the same
 * stamp functions read it. A row filed nowhere is counted on one of two
 * lines (`epermisBoardsByCommune`): `notPermits`, which needs nothing, and
 * `unlisted`, a permit for a commune the publisher does not list, with the
 * communes it names in `unlistedCommunes` and in the log line — so that the
 * one count worth a look names what to look at.
 *
 * @param {object} options
 * @param {Array<object>} options.instances `EPERMIS_INSTANCES`, or a subset.
 * @param {object} options.store `createCartdsArchiveStore(dir, log, EPERMIS_ROWS)`.
 * @param {(instance: object) => ReturnType<typeof createEpermisReader>} options.readerFor
 * @param {(instance: object) => Promise<{allowed: boolean}>} options.robots
 * @param {string} [options.day]
 * @param {?object} [options.previous] The last sweep's summary, from `sweep.json`.
 * @param {{log?: Function, warn?: Function}} [options.log]
 * @returns {Promise<object>}
 */
export async function sweepEpermisArchive({
  instances, store, readerFor, robots, day = cartdsDay(), previous = null, log = console,
}) {
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
    unsaved: [],
    truncated: [],
    skipped: [],
    unlisted: 0,
    unlistedCommunes: {},
    notPermits: 0,
    history: { ...(previous?.history && typeof previous.history === 'object' ? previous.history : {}) },
  };
  for (const instance of instances) {
    summary.communes += instance.communes.length;
    if (!(await robots(instance)).allowed) { summary.refused.push(instance.key); continue; }
    const reader = readerFor(instance);
    const recentWindow = epermisRecentWindow(day);
    const recent = await readEpermisWindow(reader, recentWindow);
    if (!recent) { summary.failed.push(instance.key); continue; }
    const boards = Object.fromEntries(Object.entries(recent.boards).map(([board, rows]) => [board, [...rows]]));
    let truncated = recent.truncated;
    summary.skipped.push(...recent.skipped);
    const earlier = dayOrNull(summary.history[instance.key]);
    let from = earlier && earlier < recentWindow.from ? earlier : recentWindow.from;
    for (const window of epermisHistoryWindows(from, epermisHistoryFloor(day))) {
      const slice = await readEpermisWindow(reader, window);
      if (!slice) break;
      for (const [board, rows] of Object.entries(slice.boards)) boards[board].push(...rows);
      truncated ||= slice.truncated;
      summary.skipped.push(...slice.skipped);
      from = window.from;
    }
    summary.history[instance.key] = from;
    if (truncated) summary.truncated.push(instance.key);
    const { communes, unlisted, notPermits } = epermisBoardsByCommune(instance, boards);
    summary.unlisted += unlisted.length;
    for (const code of unlisted) {
      const key = code ?? 'unread';
      summary.unlistedCommunes[key] = (summary.unlistedCommunes[key] ?? 0) + 1;
    }
    summary.notPermits += notPermits;
    for (const [insee, mine] of communes) {
      const { archive, added, saved } = await store.record(instance, insee, mine, day);
      if (!saved) summary.unsaved.push(insee);
      summary.read += 1;
      summary.added += added;
      summary.rows += archive.rows.length;
    }
  }
  summary.finishedAt = new Date().toISOString();
  log.log?.(`[epermis-archive] ${day}: ${summary.read}/${summary.communes} communes read, `
    + `${summary.added} new rows, ${summary.rows} kept`
    + (Object.keys(summary.history).length
      ? `, history from ${Object.entries(summary.history).map(([key, since]) => `${key} ${since}`).join(' ')}`
      : '')
    + (summary.notPermits ? `, ${summary.notPermits} rows not permits` : '')
    + (summary.unlisted
      ? `, permits for communes not listed: ${Object.entries(summary.unlistedCommunes).map(([code, rows]) => `${code} ×${rows}`).join(' ')}`
      : '')
    + (summary.skipped.length ? `, skipped: ${summary.skipped.join(', ')}` : '')
    + (summary.failed.length ? `, failed: ${summary.failed.join(' ')}` : '')
    + (summary.refused.length ? `, robots.txt refuses: ${summary.refused.join(' ')}` : ''));
  return summary;
}
