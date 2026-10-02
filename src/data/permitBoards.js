/**
 * How the boards of `permitBoardCities.js` are read: one protocol per city,
 * pure, and the PDF readers its files need. `scripts/lib/permitLists.mjs`
 * makes the requests (`readBoardCity`); nothing here fetches.
 *
 * A PROTOCOL is two functions:
 *
 * - `start(city, {since, day})` → the first requests of a reading.
 * - `index(city, body, request, {since, day})` → what one answer holds:
 *   `{files, rows, next}`, or null when the answer is not the board it
 *   should be (a login page, a changed layout) — the reading is then
 *   incomplete, and null if nothing answered at all.
 *
 * A REQUEST is `{url, as, method?, body?, headers?}`, `as` one of `html`,
 * `json` or `text`: how its answer is handed to `index` (JSON parsed).
 *
 * A FILE is a PDF to read: `{url, board, layout, published?, row?, rolling?,
 * ocr?, scan?, ocrPages?, headers?}`. `layout` names its reader in
 * {@link BOARD_READERS} (or in `PERMIT_LIST_READERS`), called as
 * `reader(document, {city, file})`. `row` is what the index itself says of
 * the dossier (a title's number and site): kept when the file yields
 * nothing, and handed to the reader to complete. A file is read once and
 * kept by its address; a `rolling` one — the same address replaced in place
 * — is asked again with its validators. `ocr`: a file that may be a scan,
 * read by OCR in the daily sweep when its text yields no row. `scan`: one
 * that always is, never downloaded by a visitor's reading. `ocrPages`: OCR
 * reads that many pages at most.
 *
 * A ROW is a reader's row (`PERMIT_LIST_FIELDS` and its `board`). Rows an
 * index reads from HTML go through the same scrub as a PDF's: no private
 * applicant is ever kept.
 */
import { LIST_BOARD_PROTOCOLS, LIST_BOARD_READERS, LIST_BOARD_TEXT } from './permitBoardsLists.js';
import { NOTICE_BOARD_PROTOCOLS, NOTICE_BOARD_READERS, NOTICE_BOARD_TEXT } from './permitBoardsNotices.js';
import { PAGE_BOARD_PROTOCOLS, PAGE_BOARD_READERS, PAGE_BOARD_TEXT } from './permitBoardsPages.js';
import { REPORT_BOARD_PROTOCOLS, REPORT_BOARD_READERS, REPORT_BOARD_TEXT } from './permitBoardsReports.js';
import { ACT_BOARD_PROTOCOLS, ACT_BOARD_READERS, ACT_BOARD_TEXT } from './permitBoardsActs.js';
import { OUTER_PARIS_PROTOCOLS, OUTER_PARIS_READERS } from './outerParisPermits.js';

export { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';

/** Every city's protocol, by `source.protocol`. */
export const BOARD_PROTOCOLS = Object.freeze({
  ...LIST_BOARD_PROTOCOLS, ...NOTICE_BOARD_PROTOCOLS, ...PAGE_BOARD_PROTOCOLS,
  ...REPORT_BOARD_PROTOCOLS, ...ACT_BOARD_PROTOCOLS,
  ...OUTER_PARIS_PROTOCOLS,
});

/** The PDF readers the boards' files name, by `layout`. */
export const BOARD_READERS = Object.freeze({
  ...LIST_BOARD_READERS, ...NOTICE_BOARD_READERS, ...PAGE_BOARD_READERS,
  ...REPORT_BOARD_READERS, ...ACT_BOARD_READERS,
  ...OUTER_PARIS_READERS,
});

/** `extractPdfText` options by `layout`, where a layout needs its own. */
export const BOARD_TEXT = Object.freeze({
  ...LIST_BOARD_TEXT, ...NOTICE_BOARD_TEXT, ...PAGE_BOARD_TEXT,
  ...REPORT_BOARD_TEXT, ...ACT_BOARD_TEXT,
});

/** The protocol of a board city, or null. */
export function boardProtocol(city) {
  return city?.source?.kind === 'board' ? BOARD_PROTOCOLS[city.source.protocol] ?? null : null;
}
