/**
 * Reading Sirap PU boards and keeping what they post — the half that cannot be
 * pure: requests and files.
 *
 * The twin of `cartdsArchive.mjs`, and smaller because the protocol is: one
 * GET per board, no session, no form. The rows are kept by the same archive
 * store (`createCartdsArchiveStore` with `SIRAP_ROWS`), in a directory of
 * their own, and swept once a day by the same server.
 *
 * NETWORK THROUGH THE CALLER, as there: every request goes through the `http`
 * object handed in — `{fetch, text}`, neither of which ever throws.
 */

import path from 'node:path';
import {
  sirapBoardCodes,
  sirapBoardUrl,
  sirapRobotsUrl,
} from '../../src/data/sirapFeed.js';
import { robotsAllows } from '../../src/data/cartdsFeed.js';
import { cartdsDay } from '../../src/data/cartdsArchive.js';

/** Where the archive lives, beside the Cart@DS one. */
export const SIRAP_ARCHIVE_DIR = path.join('.gev-cache', 'archive', 'sirap');

/** Rennes's board, the largest, was 400 KB on 2026-10-01. */
const BOARD_MAX_BYTES = 16 * 1024 * 1024;
const ROBOTS_MAX_BYTES = 512 * 1024;

/**
 * Whether this host lets a robot read its boards (RFC 9309).
 *
 * As for a Cart@DS host, with one more case: every PU host answers EVERY path
 * it does not know with its Angular app's `index.html` — `robots.txt`
 * included, HTTP 200 and `text/html`, measured on all four hosts on
 * 2026-10-01. That is the absence of a file, not a rule, as on
 * publication-actes.fr.
 *
 * @param {object} instance One of `SIRAP_INSTANCES`.
 * @param {import('./cartdsArchive.mjs').CartdsHttp} http
 * @returns {Promise<{allowed: boolean, final: boolean}>}
 */
export async function sirapRobotsVerdict(instance, http) {
  const response = await http.fetch(sirapRobotsUrl(instance));
  if (!response) return { allowed: false, final: false };
  if (response.status >= 500) return { allowed: false, final: true };
  if (response.status >= 400) return { allowed: true, final: true };
  if (/html/i.test(response.headers?.get?.('content-type') || '')) {
    await response.body?.cancel?.().catch?.(() => {});
    return { allowed: true, final: true };
  }
  const body = await http.text(response, ROBOTS_MAX_BYTES);
  if (body === null) return { allowed: false, final: false };
  const probe = new URL(sirapBoardUrl(instance, instance.communes[0])).pathname;
  return { allowed: robotsAllows(body, probe), final: true };
}

/**
 * One board, raw, or null when it did not answer. Anything but a JSON array
 * is a failure, not an empty board: an unknown commune answers an error
 * OBJECT, and an empty board answers `[]`.
 *
 * @param {object} instance
 * @param {string} board An INSEE code from `sirapBoardCodes`.
 * @param {import('./cartdsArchive.mjs').CartdsHttp} http
 * @returns {Promise<?Array<object>>}
 */
export async function readSirapBoard(instance, board, http) {
  const response = await http.fetch(sirapBoardUrl(instance, board), {
    headers: { Accept: 'application/json' },
  });
  if (!response?.ok) return null;
  const body = await http.text(response, BOARD_MAX_BYTES);
  let answer = null;
  try { answer = JSON.parse(body ?? ''); } catch { return null; }
  return Array.isArray(answer) ? answer : null;
}

/**
 * Every board a commune reads, raw, or null when any failed.
 *
 * ALL OR NONE, as both Cart@DS boards are: served without Fort-Mardyck's
 * board, Dunkerque would look as if its western quarter had stopped filing.
 *
 * @param {object} instance
 * @param {string} insee
 * @param {import('./cartdsArchive.mjs').CartdsHttp} http
 * @returns {Promise<?{boards: Record<string, Array<object>>}>}
 */
export async function readSirapCommune(instance, insee, http) {
  const boards = {};
  for (const board of sirapBoardCodes(instance, insee)) {
    const rows = await readSirapBoard(instance, board, http);
    if (!rows) return null;
    boards[board] = rows;
  }
  return { boards };
}

/**
 * Read every board of every instance once and fold it into the archive.
 *
 * Sequential, one second apart: 56 communes, 58 boards, one request each and
 * one robots.txt per host — about a minute, once a day. A commune that fails
 * is left for tomorrow and named in the summary. The summary has the shape of
 * the Cart@DS sweep's, so the same stamp functions read it.
 *
 * @param {object} options
 * @param {Array<object>} options.instances `SIRAP_INSTANCES`, or a subset.
 * @param {object} options.store `createCartdsArchiveStore(dir, log, SIRAP_ROWS)`.
 * @param {import('./cartdsArchive.mjs').CartdsHttp} options.http
 * @param {(instance: object) => Promise<{allowed: boolean}>} [options.robots]
 * @param {string} [options.day]
 * @param {number} [options.pauseMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {{log?: Function, warn?: Function}} [options.log]
 * @returns {Promise<object>}
 */
export async function sweepSirapArchive({
  instances, store, http, robots = (instance) => sirapRobotsVerdict(instance, http),
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
    unsaved: [],
  };
  for (const instance of instances) {
    summary.communes += instance.communes.length;
    const verdict = await robots(instance);
    if (!verdict.allowed) { summary.refused.push(instance.key); continue; }
    for (const insee of instance.communes) {
      const answer = await readSirapCommune(instance, insee, paced);
      if (!answer) { summary.failed.push(insee); continue; }
      const { archive, added, saved } = await store.record(instance, insee, answer.boards, day);
      if (!saved) summary.unsaved.push(insee);
      summary.read += 1;
      summary.added += added;
      summary.rows += archive.rows.length;
    }
  }
  summary.finishedAt = new Date().toISOString();
  log.log?.(`[sirap-archive] ${day}: ${summary.read}/${summary.communes} communes read, `
    + `${summary.added} new rows, ${summary.rows} kept`
    + (summary.failed.length ? `, failed: ${summary.failed.join(' ')}` : '')
    + (summary.refused.length ? `, robots.txt refuses: ${summary.refused.join(' ')}` : ''));
  return summary;
}
