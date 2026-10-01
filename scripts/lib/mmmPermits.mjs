/**
 * Reading Montpellier Méditerranée Métropole's permit files and keeping their
 * rows — the half that cannot be pure: requests and files.
 *
 * The twin of `permitLists.mjs`. A commune is one CSV, rewritten every night;
 * its rows are kept by the same archive store (`createCartdsArchiveStore` with
 * `MMM_ROWS`), in a directory of their own, and swept once a day by the same
 * server, so the night each row first appeared is known (Trap 5 of
 * `src/data/mmmPermitsFeed.js`). The file is ODbL: the archive is a derived
 * database, kept on the server and never bundled.
 *
 * NETWORK THROUGH THE CALLER, as there: every request goes through the `http`
 * object handed in — `{fetch, text}`, neither of which ever throws.
 */

import path from 'node:path';
import { cartdsDay } from '../../src/data/cartdsArchive.js';
import {
  mmmCsvUrl,
  mmmEditionDay,
  parseMmmCsv,
  rankMmmRows,
  MMM_ARCHIVE_INSTANCE,
  MMM_BOARD,
} from '../../src/data/mmmPermitsFeed.js';
import { cartdsSweepDue } from './cartdsArchive.mjs';

/** Where the archive lives, under the server's persistent cache. */
export const MMM_ARCHIVE_DIR = path.join('.gev-cache', 'archive', 'mmm');

/** `data.montpellier3m.fr/robots.txt` asks ten seconds between two requests. */
export const MMM_CRAWL_DELAY_MS = 10_000;

/** Montpellier's file is 7.9 MB; the ceiling leaves it room to grow. */
export const MMM_CSV_MAX_BYTES = 64 * 1024 * 1024;

/**
 * The export lands at 07:00 Paris time (`Last-Modified` 05:00 UTC, every
 * commune within the same minute on 2026-10-01): a sweep before 08:00 would
 * read yesterday's edition and date every row a day late.
 */
export const MMM_SWEEP_FROM_HOUR = 8;

/** The hour in France, 0–23. */
function parisHour(now) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(now));
}

/**
 * A sweep is due once per French calendar day, once that day's export is out.
 * @param {?object} stamp The last sweep's summary.
 * @param {Date} [now]
 */
export function mmmSweepDue(stamp, now = new Date()) {
  return parisHour(now) >= MMM_SWEEP_FROM_HOUR && cartdsSweepDue(stamp, cartdsDay(now));
}

/**
 * One commune's current edition: its rows, ranked (`rankMmmRows`), and the
 * day it was written, or null when the file did not come.
 *
 * @param {object} commune One of `MMM_COMMUNES`.
 * @param {{fetch: Function, text: Function}} http
 * @returns {Promise<?{rows: Array<object>, day: string}>}
 */
export async function readMmmEdition(commune, http) {
  const response = await http.fetch(mmmCsvUrl(commune), { headers: { Accept: 'text/csv' } });
  if (!response?.ok) return null;
  const csv = await http.text(response, MMM_CSV_MAX_BYTES);
  const rows = csv ? parseMmmCsv(csv) : [];
  if (!rows.length) return null;
  return {
    rows: rankMmmRows(rows),
    day: mmmEditionDay(response.headers?.get?.('last-modified')) ?? cartdsDay(),
  };
}

/**
 * Fold one edition into the commune's archive, dated by the edition, not by
 * the reading: two readings of one edition are one day.
 * @param {ReturnType<import('./cartdsArchive.mjs').createCartdsArchiveStore>} store
 * @param {object} commune
 * @param {{rows: Array<object>, day: string}} edition From {@link readMmmEdition}.
 */
export function recordMmmEdition(store, commune, edition) {
  return store.record(MMM_ARCHIVE_INSTANCE, commune.insee, { [MMM_BOARD]: edition.rows }, edition.day);
}

/**
 * Read every commune's file once and fold it into the archive.
 *
 * One host, so the pause is the one its `robots.txt` asks: 28 files, about
 * 25 MB, some five minutes, once a day. A file that does not come is left for
 * tomorrow and named in the summary; its rows are not lost, only dated a day
 * later.
 *
 * @param {object} options
 * @param {Array<object>} options.communes `MMM_COMMUNES`, or a subset.
 * @param {ReturnType<import('./cartdsArchive.mjs').createCartdsArchiveStore>} options.store
 * @param {{fetch: Function, text: Function}} options.http
 * @param {string} [options.day] The sweep's day, for the stamp.
 * @param {number} [options.pauseMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {{log?: Function}} [options.log]
 * @returns {Promise<object>} The summary, as the stamp stores it.
 */
export async function sweepMmmArchive({
  communes, store, http, day = cartdsDay(), pauseMs = MMM_CRAWL_DELAY_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), log = console,
}) {
  const summary = {
    day,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    communes: communes.length,
    read: 0,
    added: 0,
    rows: 0,
    editions: {},
    failed: [],
    unsaved: [],
  };
  let first = true;
  for (const commune of communes) {
    if (!first && pauseMs > 0) await sleep(pauseMs);
    first = false;
    const edition = await readMmmEdition(commune, http);
    if (!edition) { summary.failed.push(commune.insee); continue; }
    const { archive, added, saved } = await recordMmmEdition(store, commune, edition);
    if (!saved) summary.unsaved.push(commune.insee);
    summary.read += 1;
    summary.added += added;
    summary.rows += archive.rows.length;
    summary.editions[edition.day] = (summary.editions[edition.day] ?? 0) + 1;
  }
  summary.finishedAt = new Date().toISOString();
  log.log?.(`[mmm-archive] ${day}: ${summary.read}/${summary.communes} communes read, `
    + `${summary.added} new rows, ${summary.rows} kept`
    + (summary.failed.length ? `, failed: ${summary.failed.join(' ')}` : ''));
  return summary;
}
