/**
 * Strings of src/data/datasetFields.js — the two places a card line is words
 * rather than a column's own value.
 *
 * The weekday MATCH table is not here: `lundi`…`dimanche` are the spellings a
 * French register publishes, and matching them is reading data, not writing
 * prose. What a reader sees of that match — the compacted run `lun–ven` — is
 * here, because `Mon–Fri` is the same fact in English.
 *
 * See docs/i18n/CONVENTIONS.md.
 */
import { defineMessages } from '../i18n/messages.js';

export default defineMessages({
  /**
   * The three-letter weekday, Monday first — the display half of
   * `FRENCH_WEEKDAYS`, index for index.
   */
  weekdaysShort: {
    fr: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    note: 'Three letters, no period: the run `lun–ven` / `Mon–Fri` is drawn from these.',
  },
  /** The short month, January first — the display half of `OSM_MONTHS`. */
  monthsShort: {
    fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
  /** A date inside an opening-hours exception: `Dec 25` in the source. */
  monthDay: {
    fr: (day, month) => `${day} ${month}`,
    en: (day, month) => `${month} ${day}`,
    sample: [25, 'Dec'],
  },
  /** `24/7`, the whole value. */
  hoursAlways: { fr: '24 h/24, 7 j/7', en: '24/7' },
  /** `00:00-23:59` inside a rule: the day selector before it says which days. */
  hoursAllDay: { fr: '24 h/24', en: 'all day' },
  /** `PH`, the public-holiday selector. */
  hoursHolidays: { fr: 'fériés', en: 'holidays' },
  /** `off` after a selector. */
  hoursClosed: { fr: 'fermé', en: 'closed' },
  /** Between two rules of one schedule; French puts a space before its semicolon. */
  hoursSeparator: { fr: ' ; ', en: '; ' },
  /** One detail line of a card: the manifest's label, then the cell. */
  labeled: {
    fr: (label, value) => `${label} : ${value}`,
    en: (label, value) => `${label}: ${value}`,
    note: '`label` comes from the manifest and stays as its author wrote it; only the '
      + 'separator moves, French putting a space before the colon.',
    sample: ['Town', 'Lyon'],
  },
});
