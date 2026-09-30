/**
 * @module data/cartdsArchive
 *
 * What a commune's Cart@DS board posted, kept after the board lets it go.
 *
 * WHY. A decision stays on the board for its posting period, about two months
 * (Code de l'urbanisme, art. R.424-15), and a filing notice until the decision
 * replaces it. Nothing public keeps what leaves: the commune's copy is its
 * instruction file, and Sitadel only ever receives the GRANTED, floor-creating
 * half, weeks later. So every day this server does not read a board, the rows
 * that left it that day are lost for good — the same argument as the
 * chronicle's (`docs/CHRONICLE.md`), on a register instead of a feed.
 *
 * WHAT IS KEPT: THE ROW, NOT THE DOSSIER. Each distinct row a board ever
 * showed is stored once, as published, with the first and last day it was
 * seen. The dossier is rebuilt at read time by the same code that reads the
 * live board (`normaliseCartdsRow`, `foldCartdsDossiers`), so a fix to that
 * code applies to the whole archive, and nothing a later reading would need
 * was thrown away by an earlier one. A row whose text changes — a corrected
 * address, a withdrawn decision — is a new row next to the old one; the fold
 * decides which one the dossier says.
 *
 * WHAT IS NEVER KEPT. The two things the live reader already refuses: a row
 * that is not a building authorisation (`IA` is a property sale with its price)
 * is not stored at all, and the applicant cell is replaced by what
 * `organisationApplicant` lets through before the row is stored — a person's
 * name never reaches the disk. {@link scrubCartdsRow} does both.
 *
 * TWO ARCHIVES MAKE ONE. The server sweeps on the host that serves the map,
 * and `scripts/cartds-archive.mjs` can sweep anywhere else; {@link
 * unionCartdsArchives} folds two copies of one commune into the archive both
 * would have written, so a gap in one is filled from the other.
 *
 * Dependency-free and side-effect-free: no fetch, no file. The I/O is in
 * `scripts/lib/cartdsArchive.mjs`.
 */

import { cartdsKind } from './cartdsFeed.js';
import { organisationApplicant } from './permitApplicant.js';

/** Bumped whenever the stored shape changes; an unknown schema is not read. */
export const CARTDS_ARCHIVE_SCHEMA = 1;

/** Cells kept per row: the nine columns of the decision board. */
const CARTDS_ROW_CELLS = 9;

/** The column that names the applicant, as the page heads it. */
const APPLICANT_CELL = 3;

/** The two boards, as `TypeInformation` sends them. */
const BOARDS = new Set(['1', '2']);

/** A `YYYY-MM-DD` day. */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The calendar day in France, `YYYY-MM-DD`: the unit a board is posted in.
 *
 * Paris time and not UTC, so that a sweep at 00:30 in summer is dated the day
 * the commune is living, whichever zone the server runs in.
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function cartdsDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/**
 * One board row as it may be stored, or null for a row that may not be.
 *
 * @param {Array<?string>} row One row of the table's `data`.
 * @returns {?Array<?string>} Nine cells, strings or null, applicant filtered.
 */
export function scrubCartdsRow(row) {
  if (!Array.isArray(row) || !cartdsKind(row[1])) return null;
  const cells = [];
  for (let i = 0; i < CARTDS_ROW_CELLS && i < row.length; i += 1) {
    const value = row[i];
    cells.push(value === null || value === undefined ? null : String(value));
  }
  cells[APPLICANT_CELL] = organisationApplicant(cells[APPLICANT_CELL]);
  return cells;
}

/** The identity of a stored row: its board and its text. */
function rowKey(board, cells) {
  return `${board}\u0001${JSON.stringify(cells)}`;
}

/**
 * A commune's archive before its first sweep.
 * @param {{key: string}} instance One of `CARTDS_INSTANCES`.
 * @param {string} insee
 */
export function emptyCartdsArchive(instance, insee) {
  return {
    schema: CARTDS_ARCHIVE_SCHEMA,
    instance: instance.key,
    insee: String(insee).toUpperCase(),
    firstDay: null,
    lastDay: null,
    days: 0,
    rows: [],
  };
}

/**
 * A stored archive, checked, or an empty one when it is not usable.
 *
 * An archive of another schema, another commune or another instance is not
 * read — and not overwritten either: {@link recordCartdsBoards} starts a fresh
 * one only in memory, and the caller that finds `usable: false` on the answer
 * sets the file aside rather than writing over it.
 *
 * @param {*} document Parsed JSON, or anything.
 * @param {{key: string}} instance
 * @param {string} insee
 * @returns {{archive: object, usable: boolean}}
 */
export function readCartdsArchive(document, instance, insee) {
  const empty = emptyCartdsArchive(instance, insee);
  if (!document || typeof document !== 'object') return { archive: empty, usable: document == null };
  if (document.schema !== CARTDS_ARCHIVE_SCHEMA
    || document.insee !== empty.insee
    || document.instance !== instance.key
    || !Array.isArray(document.rows)) return { archive: empty, usable: false };
  const rows = [];
  for (const row of document.rows) {
    if (!row || !BOARDS.has(row.board) || !Array.isArray(row.cells)) continue;
    if (!DAY_PATTERN.test(row.first) || !DAY_PATTERN.test(row.last)) continue;
    rows.push({ board: row.board, cells: row.cells, first: row.first, last: row.last });
  }
  return {
    archive: {
      ...empty,
      firstDay: DAY_PATTERN.test(document.firstDay) ? document.firstDay : null,
      lastDay: DAY_PATTERN.test(document.lastDay) ? document.lastDay : null,
      days: Number.isInteger(document.days) && document.days > 0 ? document.days : 0,
      rows,
    },
    usable: true,
  };
}

/**
 * Fold one reading of a commune's two boards into its archive.
 *
 * A row already stored has its `last` day moved; a new one is appended with
 * `first` and `last` on this day. The input is not modified.
 *
 * @param {object} archive From {@link readCartdsArchive} or {@link emptyCartdsArchive}.
 * @param {Record<string, Array<Array<?string>>>} boards Raw rows per board (`'1'`, `'2'`).
 * @param {string} day `YYYY-MM-DD`, from {@link cartdsDay}.
 * @returns {{archive: object, added: number, seen: number}}
 */
export function recordCartdsBoards(archive, boards, day) {
  if (!DAY_PATTERN.test(day)) throw new Error(`cartdsArchive: bad day ${day}`);
  const rows = archive.rows.map((row) => ({ ...row }));
  const index = new Map(rows.map((row, i) => [rowKey(row.board, row.cells), i]));
  let added = 0;
  let seen = 0;
  for (const [board, raw] of Object.entries(boards || {})) {
    if (!BOARDS.has(board)) continue;
    for (const row of raw || []) {
      const cells = scrubCartdsRow(row);
      if (!cells) continue;
      const key = rowKey(board, cells);
      const at = index.get(key);
      if (at === undefined) {
        index.set(key, rows.length);
        rows.push({ board, cells, first: day, last: day });
        added += 1;
        continue;
      }
      seen += 1;
      if (rows[at].last < day) rows[at].last = day;
      if (rows[at].first > day) rows[at].first = day;
    }
  }
  const newDay = archive.lastDay !== day;
  return {
    archive: {
      ...archive,
      firstDay: archive.firstDay && archive.firstDay < day ? archive.firstDay : day,
      lastDay: archive.lastDay && archive.lastDay > day ? archive.lastDay : day,
      days: archive.days + (newDay ? 1 : 0),
      rows,
    },
    added,
    seen,
  };
}

/**
 * The stored rows, as the live reader's `normaliseCartdsRow` takes them.
 * @param {object} archive
 * @returns {Array<{board: string, cells: Array<?string>, first: string, last: string}>}
 */
export function archivedCartdsRows(archive) {
  return archive?.rows ?? [];
}

/**
 * Two archives of one commune as one: every row either holds, each with the
 * earliest `first` and the latest `last` the two agree on.
 *
 * `days` is the larger of the two, not their sum: two hosts sweeping the same
 * day saw one day. It is a floor, and says so by being one.
 *
 * @param {object} a
 * @param {object} b Same commune and instance as `a`.
 * @returns {object}
 */
export function unionCartdsArchives(a, b) {
  if (a.insee !== b.insee || a.instance !== b.instance) {
    throw new Error(`cartdsArchive: cannot join ${a.instance}/${a.insee} and ${b.instance}/${b.insee}`);
  }
  const byKey = new Map();
  for (const row of [...a.rows, ...b.rows]) {
    const key = rowKey(row.board, row.cells);
    const held = byKey.get(key);
    if (!held) { byKey.set(key, { ...row }); continue; }
    if (row.first < held.first) held.first = row.first;
    if (row.last > held.last) held.last = row.last;
  }
  const days = [a.firstDay, b.firstDay, a.lastDay, b.lastDay].filter(Boolean).sort();
  return {
    ...a,
    firstDay: days[0] ?? null,
    lastDay: days.at(-1) ?? null,
    days: Math.max(a.days, b.days),
    rows: [...byKey.values()].sort((x, y) => (x.first < y.first ? -1 : x.first > y.first ? 1 : 0)),
  };
}
