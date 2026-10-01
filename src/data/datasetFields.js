/*
 * WHAT A PLUGGED ROW ACTUALLY SAYS.
 *
 * A manifest names the columns a card prints. Until this module existed it
 * printed them RAW, and a raw column from a public register is very often not
 * a sentence. Measured on GeoDAE (`datasets/defibrillateurs-geodae.json`), the
 * 888 defibrillators inside Lyon, read through the Tabular API on 2026-09-14:
 *
 *   `c_disp_j`  `{lundi,mardi,mercredi,jeudi,vendredi}`   338 rows
 *   `c_disp_j`  `{"non renseigné"}`                       326 rows
 *   `c_disp_h`  `{"heures ouvrables"}`                    571 rows
 *   `c_disp_h`  `{"non renseigné"}`                       270 rows
 *   `c_etat_fonct` `En fonctionnement`                    883 of 888 rows
 *   `c_com_nom` `Lyon`                                    888 of 888 rows
 *
 * Three separate problems, and each one costs a whole line of a card:
 *
 *   · A POSTGRES ARRAY LITERAL is not text. `{lundi,mardi,…}` is how a PostGIS
 *     export spells a list, and putting the braces and the quotes on screen
 *     shows the reader the transport instead of the answer. `parseListValue`
 *     unpacks it; `format: "days"` then compacts the French weekday runs it
 *     produces, because "lun–ven" is the same fact as five words.
 *   · AN ABSENCE DRESSED AS A VALUE. `{"non renseigné"}` is the register
 *     saying it does not know, spelled as data. A line that says "we do not
 *     know" is worth strictly less than no line: it costs the same height and
 *     displaces something true. `feature.blank` lists those spellings and they
 *     are dropped, field by field, not globally guessed at.
 *   · A CONSTANT. `État : En fonctionnement` on 99.4 % of the rows is not
 *     information about the row, it is information about the register. But the
 *     five rows where it is NOT that are the only ones a reader must not miss,
 *     so the line is not deleted — `omitWhen` suppresses the majority spelling
 *     and keeps every other one. The exception becomes the only thing printed.
 *
 * A fourth arrived on 2026-10-01, when GeoDAE dropped `c_disp_j` and `c_disp_h`
 * for one `c_dispo_horaires` column in OpenStreetMap's `opening_hours` syntax.
 * Over all 188 147 rows: `Mo-Su off` 149 874, `24/7` 35 911, and 653 other
 * spellings for the remaining 2 362. `Mo-Fr 09:00-18:00; Sa-Su off` is a
 * schedule written for a parser, not a passer-by; `format: "hours"` reads it
 * back in the page's language. `Mo-Su off` is not "closed every day": the same
 * rows carry their hours as free text in `c_disp_complt`, so it is the new
 * spelling of "non renseigné", and the manifest declares it blank.
 *
 * All four are declared in the manifest, never inferred: this module holds no
 * table of column names and knows nothing about defibrillators. Pure and
 * dependency-free (no Cesium, no DOM) so it runs identically in the browser and
 * under `node --test`.
 *
 * @module data/datasetFields
 */

import messages from './datasetFields.i18n.js';

/** Longest rendered detail line, before the ellipsis. */
export const DATASET_FIELD_MAX_LINE = 64;

// i18n-ignore-start — the spellings a French register publishes in a day
// column, matched against `fieldMatchKey`. Data, not prose: an English page
// still meets `{lundi,mardi}` in a GeoDAE cell.
/** French weekdays, Monday first — the order `format: "days"` compacts runs in. */
export const FRENCH_WEEKDAYS = Object.freeze([
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
]);
// i18n-ignore-end

/**
 * Their three-letter forms, same order, in the page's language.
 *
 * A function and not a constant: the catalog is read when the line is drawn,
 * never when the module loads (ratchet R5).
 * @returns {ReadonlyArray<string>}
 */
export function weekdaysShort() {
  return messages().weekdaysShort;
}

/** The short month names, January first, in the page's language. */
export function monthsShort() {
  return messages().monthsShort;
}

/** Whitespace collapsed, ends trimmed; `null`/`undefined` become ''. */
export function cleanFieldText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    try { return JSON.stringify(value).replace(/\s+/g, ' ').trim(); } catch { return ''; }
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

/** Case- and accent-insensitive key for comparing a cell against a declared value. */
export function fieldMatchKey(value) {
  return cleanFieldText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * A cell as a list of values.
 *
 * Handles the three spellings a tabular source actually hands over: a real
 * array, a Postgres text-array literal (`{a,b,"c, d"}` — quotes and backslash
 * escapes included, because a day list with a comma inside a quoted item is
 * legal and splitting on every comma would tear it in half), and a plain
 * scalar, which is a list of one.
 *
 * @param {unknown} raw
 * @returns {string[]} Non-empty values, in source order.
 */
export function parseListValue(raw) {
  if (Array.isArray(raw)) return raw.map(cleanFieldText).filter(Boolean);
  const text = cleanFieldText(raw);
  if (!text) return [];
  if (!(text.startsWith('{') && text.endsWith('}'))) return [text];
  const body = text.slice(1, -1);
  if (!body.trim()) return [];
  const out = [];
  let buffer = '';
  let quoted = false;
  let escaped = false;
  for (const char of body) {
    if (escaped) { buffer += char; escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { out.push(buffer.trim()); buffer = ''; continue; }
    buffer += char;
  }
  out.push(buffer.trim());
  return out.filter(Boolean);
}

/**
 * Compact a list of French weekdays into runs: `lun–ven` / `Mon–Fri`,
 * `lun–mer, ven`.
 *
 * The cells it reads are French — the register publishes `lundi` — and what it
 * writes is in the page's language, because a run of days is a fact, not a
 * quotation. Anything that is not a weekday is kept VERBATIM and in place — a
 * GeoDAE day list legitimately contains `7j/7` and `événements`, and a
 * compactor that dropped what it did not recognise would be deleting the only
 * rows whose opening hours are unusual. Weekdays are gathered and compacted,
 * non-weekdays follow in their own order.
 *
 * @param {string[]} values
 * @returns {string} One rendered line, '' when there is nothing to render.
 */
export function compactFrenchDays(values) {
  const short = weekdaysShort();
  const indices = [];
  const passthrough = [];
  for (const value of values || []) {
    const index = FRENCH_WEEKDAYS.indexOf(fieldMatchKey(value));
    if (index >= 0) {
      if (!indices.includes(index)) indices.push(index);
    } else {
      const text = cleanFieldText(value);
      if (text && !passthrough.includes(text)) passthrough.push(text);
    }
  }
  indices.sort((a, b) => a - b);
  const runs = [];
  let start = null;
  let previous = null;
  const flush = () => {
    if (start === null) return;
    // A two-day "run" is printed as two days: `lun, mar` is no longer than
    // `lun–mar` and does not ask the reader to expand a range to count it.
    runs.push(previous - start >= 2
      ? `${short[start]}–${short[previous]}`
      : Array.from({ length: previous - start + 1 }, (_, offset) => short[start + offset]).join(', '));
    start = null;
  };
  for (const index of indices) {
    if (start === null) { start = index; previous = index; continue; }
    if (index === previous + 1) { previous = index; continue; }
    flush();
    start = index;
    previous = index;
  }
  flush();
  return [...runs, ...passthrough].join(', ');
}

// i18n-ignore-start — the codes of OpenStreetMap's `opening_hours` syntax, as
// a register publishes them. Data, not prose: a French page still meets
// `Mo-Fr` in a GeoDAE cell.
/** OpenStreetMap weekday codes, Monday first — index for index with `weekdaysShort`. */
export const OSM_WEEKDAYS = Object.freeze(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
/** OpenStreetMap month codes, January first — index for index with `monthsShort`. */
export const OSM_MONTHS = Object.freeze([
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);
// i18n-ignore-end

const OSM_DAY = `(${OSM_WEEKDAYS.join('|')})`;
const OSM_DATE = `(${OSM_MONTHS.join('|')}) (\\d{1,2})`;
// One token per syntax element, a range included, so the hyphen that is turned
// into a dash is only ever the syntax's own: a hyphen in a quoted comment is
// the author's and stays.
const OSM_HOURS_TOKEN = new RegExp(
  `\\b(?:${OSM_DAY}(?:-${OSM_DAY})?|${OSM_DATE}(?:-${OSM_DATE})?|(PH)|(off)`
    + '|(\\d{1,2}:\\d{2})-(\\d{1,2}:\\d{2}))\\b',
  'gi',
);
const OSM_ALL_DAY = /^0?0:00$/;
const OSM_END_OF_DAY = /^(23:59|24:00)$/;

/**
 * An OpenStreetMap `opening_hours` value in the page's language:
 * `Mo-Fr 09:00-18:00; Sa-Su off` reads `lun–ven 09:00–18:00 ; sam–dim fermé`.
 *
 * Only the syntax's own vocabulary moves — weekdays, months, `PH`, `off`, and a
 * range that covers the whole day. Times stay as published, and anything the
 * reader does not recognise is kept VERBATIM and in place, for the reason
 * `compactFrenchDays` keeps `7j/7`: the unusual schedules are the ones a
 * reader most needs to see whole.
 *
 * @param {unknown} raw
 * @returns {string} One rendered line, '' when there is nothing to render.
 */
export function formatOpeningHours(raw) {
  const text = cleanFieldText(raw);
  if (!text) return '';
  const m = messages();
  if (/^24\/7$/.test(text)) return m.hoursAlways;
  const days = weekdaysShort();
  const months = monthsShort();
  const indexOf = (codes, code) => codes.findIndex((candidate) => candidate.toLowerCase() === code.toLowerCase());
  return text
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => rule.replace(OSM_HOURS_TOKEN, (
      match, day, lastDay, month, date, lastMonth, lastDate, holiday, off, from, to,
    ) => {
      const weekday = (code) => days[indexOf(OSM_WEEKDAYS, code)];
      const monthDay = (code, number) => m.monthDay(Number(number), months[indexOf(OSM_MONTHS, code)]);
      if (day) return lastDay ? `${weekday(day)}–${weekday(lastDay)}` : weekday(day);
      if (month) return lastMonth ? `${monthDay(month, date)}–${monthDay(lastMonth, lastDate)}` : monthDay(month, date);
      if (holiday) return m.hoursHolidays;
      if (off) return m.hoursClosed;
      if (from) return OSM_ALL_DAY.test(from) && OSM_END_OF_DAY.test(to) ? m.hoursAllDay : `${from}–${to}`;
      return match;
    }).replace(/(\d),(?=\d)/g, '$1, '))
    .join(m.hoursSeparator);
}

/** Truncate to {@link DATASET_FIELD_MAX_LINE}, ellipsis included in the budget. */
export function clampFieldLine(text, max = DATASET_FIELD_MAX_LINE) {
  const limit = Math.max(1, Math.floor(Number(max) || DATASET_FIELD_MAX_LINE));
  const value = String(text ?? '');
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;
}

/**
 * The values of one field, as the manifest asked for them and with the
 * register's spellings of "I do not know" removed.
 *
 * @param {object} row Unwrapped row properties.
 * @param {{field: string, format?: string|null}} detail
 * @param {Set<string>} blankKeys Match keys of `feature.blank`.
 * @returns {string[]}
 */
export function datasetFieldValues(row, detail, blankKeys) {
  const raw = row?.[detail?.field];
  const values = detail?.format === 'list' || detail?.format === 'days'
    ? parseListValue(raw)
    : [cleanFieldText(raw)].filter(Boolean);
  if (!blankKeys || blankKeys.size === 0) return values;
  return values.filter((value) => !blankKeys.has(fieldMatchKey(value)));
}

/**
 * One rendered card line, or null when the field has nothing to say here.
 *
 * Null has three causes and they are deliberately indistinguishable to the
 * caller: the column is empty, everything in it was a declared blank, or the
 * value is the one `omitWhen` spelling this line exists to be silent about. In
 * all three the honest card is one line shorter.
 *
 * @param {object} row
 * @param {{field:string,label?:string|null,unit?:string|null,format?:string|null,omitWhen?:ReadonlyArray<string>|null}} detail
 * @param {{blankKeys?: Set<string>, max?: number}} [options]
 * @returns {string|null}
 */
export function datasetDetailLine(row, detail, { blankKeys = null, max = DATASET_FIELD_MAX_LINE } = {}) {
  if (!detail?.field) return null;
  const values = datasetFieldValues(row, detail, blankKeys);
  if (values.length === 0) return null;
  const omit = detail.omitWhen && detail.omitWhen.length
    ? new Set(detail.omitWhen.map(fieldMatchKey))
    : null;
  // Every value suppressed means the row holds only the majority spelling; a
  // row that ALSO holds something else keeps the line, minus the majority.
  const kept = omit ? values.filter((value) => !omit.has(fieldMatchKey(value))) : values;
  if (kept.length === 0) return null;
  const body = detail.format === 'days' ? compactFrenchDays(kept)
    : detail.format === 'hours' ? kept.map(formatOpeningHours).join(', ')
      : kept.join(', ');
  if (!body) return null;
  const unit = detail.unit ? ` ${detail.unit}` : '';
  const value = `${body}${unit}`;
  // The label is the manifest author's own word and is printed as written;
  // only the separator is ours, and French puts a space before its colon.
  return clampFieldLine(detail.label ? messages().labeled(detail.label, value) : value, max);
}

/**
 * Whether a row satisfies a `when` clause: every named field must hold at
 * least one of the values listed for it.
 *
 * The row's cell is read as a LIST, so `{24h/24}` matches `"24h/24"` without
 * the manifest having to know that the column is a Postgres array — the same
 * blindness to transport the detail lines get.
 *
 * @param {object} row
 * @param {Record<string, ReadonlyArray<string>>} when
 * @returns {boolean}
 */
export function rowMatchesWhen(row, when) {
  if (!when) return false;
  for (const [field, accepted] of Object.entries(when)) {
    const wanted = new Set((accepted || []).map(fieldMatchKey));
    if (wanted.size === 0) return false;
    const present = parseListValue(row?.[field]).map(fieldMatchKey);
    if (!present.some((value) => wanted.has(value))) return false;
  }
  return true;
}
