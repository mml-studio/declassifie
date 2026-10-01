/**
 * @module data/epermisFeed
 *
 * *Affichage réglementaire* — the permits Métropole Nice Côte d'Azur posts for
 * its communes, read off e-permis, the posting app of the vendor clicmap.
 *
 * WHY A THIRD BOARD READER. Nice's site (« Consulter un document
 * d'urbanisme ») links a board per commune at `affichage.e-permis.fr`:
 * `/depot?id=123&insee=06088` for the filings, `/decision?…` for the
 * decisions. Nothing there is Cart@DS's (`cartdsFeed.js`) or Sirap's
 * (`sirapFeed.js`): the page is a Vue app that asks clicmap's API for two
 * lists covering the whole métropole. What it posts is what those boards post
 * — the filing within days, the decision within days, the fence, the pool and
 * the solar panels included — and before this reader the 38 communes that
 * post there, 415 155 inhabitants, had Sitadel alone: the granted permits that
 * create floor area, about six weeks late.
 *
 * ── The protocol ────────────────────────────────────────────────────────────
 * `GET https://api-v2.clicmap.fr/ads/exports/depots` and `…/decisions`, with
 * `page` (from 1), `json=true`, and `date_min`/`date_max` as `dd-mm-YYYY`.
 * Both need `Authorization: Bearer <token>` and `Env: <env_id>`; the
 * environment comes from `…/exports/config?id=123` (Nice's `id`), the token
 * from clicmap's OAuth server (Trap 1). 100 rows a page; the answer is
 * `{success, data, pagination}`.
 *
 * ── Trap 1: the board is public, its API takes a token ──────────────────────
 * Every visitor's browser gets one: the page's script POSTs
 * `grant_type=client_credentials` to `auth.clicmap.fr/oauth2/token` with a
 * client id and secret written in the script itself, no login, no challenge,
 * and gets a one-hour bearer token. Using that public client was accepted by
 * the project owner on 2026-10-01: it is exactly what the page does for anyone
 * who opens it. The secret is NOT copied into this repository: the reader
 * fetches the page, finds its script (`/assets/index-<hash>.js`), and reads
 * the two values next to the token address ({@link parseEpermisClient}), once
 * per process and again on a 401. A script that stops showing them leaves the
 * source closed — logged, the archive still served, never an error.
 *
 * ── Trap 2: one API for the métropole, and `insee` filters nothing ─────────
 * The page sends `insee=[06088]` when opened for one commune; the API answered
 * the same 19 communes on page 1 for `06088`, `6088`, `[06088]`, `[6088]` and
 * `["06088"]` on 2026-10-01 (`insee[]` is a 400). So the métropole is read
 * once and split by commune, and the commune is the one the dossier NUMBER
 * names — `PC0061202600010` is family, then Sitadel's thirteen characters:
 * département `006`, commune `120`, year `26`, counter `00010`. `nom_commune`
 * is free text (`'Valdeblore '`, `NICE`, `'Eze  '`) and disagreed with the
 * number on 4 of the 3 805 rows read that day: on two the parcel is in the
 * number's commune, one names no parcel, and on the fourth (a Venanson number
 * for a site in La Roquette-sur-Var) it is not, and that dossier is placed by
 * its address in Venanson or not at all.
 *
 * ── Trap 3: the pagination names no total ───────────────────────────────────
 * `pagination` is `{current_page, items_per_page}`, and `items_per_page` is
 * the number of rows on THIS page — 78 on a page of 78. The reader pages until
 * a page holds fewer than {@link EPERMIS_PAGE_ROWS}; page 0 answers HTTP 500
 * and a page past the end an empty `data`.
 *
 * ── Trap 4: the decisions reach back decades, slowly ───────────────────────
 * The filter is on `srt_3`, the filing day on `depots` and the decision day on
 * `decisions`, both bounds included. With no dates the filings list answers
 * a year back. Decisions run back to 1990 (one row in 1970), 2 400 to 3 500 a
 * year since 2013, and a page of them takes about 6 s for this year's and 9 s
 * with no dates (Trap 10 has the page that never comes). So every read here
 * is a window: {@link EPERMIS_RECENT_DAYS} back for a scan
 * and the daily sweep, and the sweep walks history a calendar month at a time
 * ({@link epermisHistoryWindows}). The window also ends on the reading day,
 * which keeps out a decision typed as 2103-02-17 that sorts first on every
 * unbounded read.
 *
 * ── Trap 5: the filings list holds what is not decided yet ─────────────────
 * A filing leaves `depots` once its decision is entered: the list holds 235
 * filings for September 2026, 153 for August, 47 for May, and none of
 * August's was among the decisions read. Filings undecided since 1990 are
 * still on it. So a filing row is `depose` — FILED — and never `instruction`
 * (Trap 4 of `cartdsFeed.js`): the list is the legal posting of the filing
 * notice, not a statement that anyone is still reviewing the dossier.
 *
 * ── Trap 6: the words changed in 2025, and some are not verdicts ───────────
 * Over the 9 357 decisions of the three years read on 2026-10-01 the software
 * spoke two vocabularies. Until February 2025: `FAVORABLE` 2 028,
 * `DEFAVORABLE` 852, `FAVORABLE AVEC PRESCRIPTIONS` 713, `rejet implicite`
 * 448, `tacite` 239, `ANNULE` 226, `SANS SUITE` 24, `sans objet` 9. Since
 * December 2024: `Accord` 3 359, `Refus` 990, `Rejet` 442. `Rejet` is the old
 * `rejet implicite` renamed — 116 days after the filing at the median against
 * 113, 43 for an `Accord` — the rejection the code pronounces when the
 * missing pieces never came (R.423-39): a refusal on the shared ladder, as
 * Cart@DS's `Rejet tacite` is. A bare `tacite`, 31 days at the median, is the
 * tacit grant of a DP ({@link epermisVerdictState}). Two kinds of row are
 * not a decision: `x_ recours gracieux du demandeur` and `x_demande de
 * prorogation`, the software's own events (seven rows), say nothing; and an
 * event on a decided permit (`type_evt` `evolution`, eleven rows) is either a
 * prorogation, which keeps the grant and its day, or a withdrawal
 * (`Retrait de décision (bénéficiaire) (Accord)`), which ends it on its own
 * day — a withdrawal reads `annule` although its words hold `Accord`.
 *
 * ── Trap 7: a parcel is spelled six ways ────────────────────────────────────
 * `BIE_CAD_T` lists the parcels, comma-separated: `AB0123`, or `0L0568` for a
 * single-letter section as the cadastre keys it. Seen on 2026-10-01 besides:
 * the letter O for the zero (`OA0753`), the zero left out (`B585`), the two
 * swapped (`C00203`), a number of three digits (`AB216`), a leading dot, and
 * empty pieces. The O cannot simply be read as a zero: Nice has 18 real
 * sections that start with O (`OR`, `OT`), so {@link epermisParcels} asks
 * for both spellings, and placement keeps the one the cadastre holds.
 * Checked against Etalab's edition of 2026-10-01 for all 51 communes (298 780
 * parcels): no commune has both `OX` and `0X` for the same letter, so the two
 * candidates can never both match. Of the 11 343 distinct parcels the three
 * years name, 10 603 are in the cadastre as written and 194 more under the
 * other spelling — 164 of them an O that was a zero, against 387 real `O`
 * sections — 519 are not (a parcel divided since, a typo) and 27 do not read
 * as a parcel at all.
 *
 * ── Trap 8: the lists name private people ──────────────────────────────────
 * `dos_dnm_t` is the applicant as written on the form and `architecte` an
 * architect's name. The applicant goes through `permitApplicant.js` before a
 * row is even stored, the architect is never kept, and neither is logged.
 *
 * ── Trap 9: keep what is read ───────────────────────────────────────────────
 * The decisions do not leave the API after two months as a Cart@DS board's
 * do, but a filing leaves the list once decided (Trap 5), a scan reads only
 * the recent window (Trap 4), and a publisher can switch its board off. So
 * every row read is kept by the same archive as the other boards
 * (`cartdsArchive.js`, {@link EPERMIS_ROWS}), one file per commune, and the
 * layer draws the archive.
 *
 * ── Trap 10: one day the server cannot send ─────────────────────────────────
 * The decisions of 2026-01-16 fail every time. January's window answers page
 * 1 and the server cuts the connection on page 2 (HTTP/2 INTERNAL_ERROR, 2 to
 * 9 s in); the year the list answers with no dates failed on page 21, three
 * tries of three; and every other day of January answers alone, in about a
 * second. One row the server cannot write out, by the look of it, and any
 * window holding it fails whole. So the sweep reads a window that fails again
 * a day and a list at a time (`readEpermisByDay` in
 * `scripts/lib/epermisBoards.mjs`), leaves out the list-day that still fails
 * and names it in its summary; more than four in one window is an outage, not
 * a row, and the walk waits for the next day.
 *
 * Dependency-free and side-effect-free (no Cesium, no DOM, no fetch): URLs,
 * parsing and normalisation only. The `/api/ads-fr` proxy and
 * `scripts/lib/epermisBoards.mjs` import it; nothing in the browser bundle
 * does.
 */

import { COMMUNE_CODE_PATTERN } from './communeCode.js';
import { organisationApplicant } from './permitApplicant.js';
import { ADS_DEFAULT_MONTHS, ADS_KINDS, adsSince, dossierKey, formatDossier, seriesOfKind } from './adsFeed.js';
import { ADS_STATE_WORDS } from './adsFeed.i18n.js';
import { CARTDS_LICENCE, cartdsDate, cartdsKind } from './cartdsFeed.js';
import { sirapVerdictState } from './sirapFeed.js';

/** The posting app: its page, and the script that page loads. */
export const EPERMIS_SITE = 'https://affichage.e-permis.fr';

/** The two lists and the publisher's configuration. */
export const EPERMIS_API = 'https://api-v2.clicmap.fr/ads/exports';

/** Where the page gets its bearer token (Trap 1). */
export const EPERMIS_TOKEN_URL = 'https://auth.clicmap.fr/oauth2/token';

/** The two lists, by the names the API gives them — the archive's boards. */
export const EPERMIS_BOARDS = Object.freeze({ filings: 'depots', decisions: 'decisions' });

/** Rows on a full page (Trap 3). */
export const EPERMIS_PAGE_ROWS = 100;

/**
 * Pages read per list and window before giving up, and saying so. The
 * busiest window read, a month of decisions, is three pages; two months of
 * filings, four.
 */
export const EPERMIS_MAX_PAGES = 30;

/**
 * How far back a scan and the daily sweep read: the two months a decision
 * stays posted at the town hall (R.424-15), so that a decision entered late
 * is still caught by a later read.
 */
export const EPERMIS_RECENT_DAYS = 62;

/** Months of history the daily sweep adds to the archive, at most, per sweep. */
export const EPERMIS_HISTORY_MONTHS_PER_SWEEP = 12;

/** How the reuse of a posted decision is licensed: as for any other board. */
export const EPERMIS_LICENCE = CARTDS_LICENCE;

/** The same state words `adsFeed.js` publishes, in the payload's French. */
function stateFrench(state) {
  return ADS_STATE_WORDS.definition[state].fr;
}

/** The five entities the lists use, and numeric ones. */
function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * A cell as plain text, or null. The nature of the works carries the form's
 * own markup — `<br/>` between lines on 945 of the 3 805 rows of 2026-10-01 —
 * which becomes a space.
 */
function text(value) {
  if (value === null || value === undefined) return null;
  const plain = decodeEntities(String(value).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return plain && plain.toLowerCase() !== 'null' ? plain : null;
}

/**
 * The publishers read, and the communes each one posts for.
 *
 * FROM A MEASUREMENT, as `CARTDS_INSTANCES` is. Nice's configuration
 * (`exports/config?id=123`, 2026-10-01) lists the 51 communes of the
 * métropole, without their leading zero (`6088`), under `name_client`
 * « Nice métropole ». Read over three years on 2026-10-01, 38 of them had
 * posted — 11 154 dossiers, 7 616 at Nice; Bairols, the quietest, 7 — and they
 * are `communes`, 415 155 inhabitants. The other 13 posted nothing, not once
 * in a month-by-month reading back to November 2012 (39 248 decisions, 4 256
 * filings still undecided): Cagnes-sur-Mer, Saint-Laurent-du-Var, Vence,
 * Carros, La Trinité and eight smaller ones instruct elsewhere (Cagnes files
 * through Sirap's portal). They are `silent`:
 * not read, so that no other register is refused them (`sirapFeed.test.mjs`,
 * `npm run permits:scan`), and named, so that the reader says when the
 * publisher lists a commune the registry has never heard of. `client` is the
 * `id` of the board's address.
 */
export const EPERMIS_INSTANCES = Object.freeze([
  Object.freeze({
    key: 'nicecotedazur',
    client: 123,
    label: 'Métropole Nice Côte d’Azur — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    communes: Object.freeze([
      '06006', '06009', '06011', '06013', '06020', '06039', '06042', '06046',
      '06054', '06055', '06059', '06060', '06066', '06072', '06073', '06074',
      '06075', '06080', '06088', '06102', '06103', '06109', '06110', '06111',
      '06117', '06119', '06120', '06121', '06122', '06127', '06129', '06144',
      '06146', '06147', '06151', '06153', '06156', '06159',
    ]),
    silent: Object.freeze([
      '06021', '06025', '06027', '06032', '06033', '06034', '06064', '06065',
      '06114', '06123', '06126', '06149', '06157',
    ]),
  }),
]);

/**
 * The publisher posting for this commune, or null.
 * @param {?string} communeCode
 * @returns {?object} One of {@link EPERMIS_INSTANCES}.
 */
export function epermisInstanceFor(communeCode) {
  const code = String(communeCode ?? '').trim().toUpperCase();
  if (!COMMUNE_CODE_PATTERN.test(code)) return null;
  return EPERMIS_INSTANCES.find((instance) => instance.communes.includes(code)) ?? null;
}

/** @param {object} instance @returns {string} The board's page, filings side. */
export function epermisPageUrl(instance) {
  return `${EPERMIS_SITE}/depot?id=${instance.client}`;
}

/** @param {object} instance @returns {string} The publisher's configuration. */
export function epermisConfigUrl(instance) {
  return `${EPERMIS_API}/config?id=${instance.client}`;
}

/**
 * The script the page loads, as an absolute address, or null.
 * @param {?string} html The board's page.
 * @returns {?string}
 */
export function epermisScriptUrl(html) {
  const match = /src=["']((?:https:\/\/affichage\.e-permis\.fr)?\/assets\/index-[\w-]+\.js)["']/.exec(String(html ?? ''));
  if (!match) return null;
  return new URL(match[1], EPERMIS_SITE).href;
}

/** Escape a string for a RegExp. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The public client the page asks its token with (Trap 1), or null.
 *
 * Read from the minified script, where the token request is written as
 * `const e="https://auth.clicmap.fr/oauth2/token",t="<id>",n="<secret>",…;
 * r.append("client_id",t),r.append("client_secret",n)` — so a value is either
 * a string literal in the `append` or a name declared near the token address.
 * An object literal (`client_id:"…"`) is read too. Anything else is null: the
 * minifier's next spelling is a failure to log, not a value to guess.
 *
 * @param {?string} script The page's script.
 * @returns {?{clientId: string, clientSecret: string}}
 */
export function parseEpermisClient(script) {
  const source = String(script ?? '');
  const at = source.indexOf('auth.clicmap.fr/oauth2/token');
  if (at < 0) return null;
  const start = Math.max(0, at - 400);
  const near = source.slice(start, at + 2000);
  const read = (field) => {
    const appended = new RegExp(
      `append\\(\\s*(["'])${field}\\1\\s*,\\s*(?:(["'])([^"'\\\\]+)\\2|([A-Za-z_$][\\w$]*))\\s*\\)`,
    ).exec(near);
    if (appended?.[3]) return appended[3];
    if (appended?.[4]) {
      // The LAST declaration of that name before the append: a minifier
      // reuses one-letter names, and the one in force is the nearest.
      const before = near.slice(0, appended.index);
      const declared = [...before.matchAll(
        new RegExp(`(?:^|[^\\w$.])${escapeRegExp(appended[4])}\\s*=\\s*(["'])([^"'\\\\]+)\\1`, 'g'),
      )].at(-1);
      return declared?.[2] ?? null;
    }
    const property = new RegExp(`["']?${field}["']?\\s*:\\s*(["'])([^"'\\\\]+)\\1`).exec(near);
    return property?.[2] ?? null;
  };
  const clientId = read('client_id');
  const clientSecret = read('client_secret');
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/**
 * The token request's body, as the page sends it.
 * @param {{clientId: string, clientSecret: string}} client
 * @returns {string} `application/x-www-form-urlencoded`.
 */
export function buildEpermisTokenForm(client) {
  const params = new URLSearchParams();
  params.set('grant_type', 'client_credentials');
  params.set('client_id', client.clientId);
  params.set('client_secret', client.clientSecret);
  params.set('scope', 'openid');
  return params.toString();
}

/** A JWT's `exp`, in milliseconds, or null. */
function jwtExpiry(token) {
  try {
    const payload = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return Number.isFinite(json?.exp) ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * The token server's answer as a header and an expiry, or null.
 *
 * `expires_in` (3 600 s on 2026-10-01) first, the token's own `exp` second,
 * and a token that says neither is held for ten minutes.
 *
 * @param {*} answer Parsed JSON.
 * @param {number} now Epoch milliseconds when the request was sent.
 * @returns {?{authorization: string, expiresAt: number}}
 */
export function epermisToken(answer, now) {
  const token = typeof answer?.access_token === 'string' ? answer.access_token.trim() : '';
  if (!token) return null;
  const type = typeof answer.token_type === 'string' && answer.token_type.trim() ? answer.token_type.trim() : 'Bearer';
  const seconds = Number(answer.expires_in);
  const expiresAt = Number.isFinite(seconds) && seconds > 0
    ? now + seconds * 1000
    : jwtExpiry(token) ?? now + 10 * 60 * 1000;
  return { authorization: `${type} ${token}`, expiresAt };
}

/**
 * The publisher's configuration: the environment the lists are asked in, and
 * the communes it posts for, on five characters.
 * @param {*} answer Parsed JSON of `exports/config`.
 * @returns {?{envId: string, communes: Array<string>, name: ?string}}
 */
export function parseEpermisConfig(answer) {
  const data = answer?.success ? answer.data : null;
  const envId = data?.env_id;
  if (envId === null || envId === undefined || !/^\d+$/.test(String(envId))) return null;
  const communes = (Array.isArray(data.codes_insee) ? data.codes_insee : [])
    .map((code) => String(code).trim().toUpperCase().padStart(5, '0'))
    .filter((code) => COMMUNE_CODE_PATTERN.test(code));
  return { envId: String(envId), communes, name: typeof data.name_client === 'string' ? data.name_client : null };
}

/** `2026-10-01` → `01-10-2026`, the API's spelling. */
export function epermisDay(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day ?? ''));
  if (!match) throw new Error(`epermisFeed: bad day ${day}`);
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** A `YYYY-MM-DD` day moved by whole days, in UTC so no clock change moves it. */
function shiftDay(day, days) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * One page of a list.
 * @param {string} board One of {@link EPERMIS_BOARDS}.
 * @param {number} page From 1.
 * @param {{from: string, to: string}} window `YYYY-MM-DD`, both included.
 * @returns {string}
 */
export function epermisListUrl(board, page, window) {
  const params = new URLSearchParams({
    page: String(page),
    json: 'true',
    date_min: epermisDay(window.from),
    date_max: epermisDay(window.to),
  });
  return `${EPERMIS_API}/${board}?${params}`;
}

/**
 * The window a scan and the daily sweep read: {@link EPERMIS_RECENT_DAYS}
 * back, through the reading day.
 * @param {string} day `YYYY-MM-DD`, from `cartdsDay`.
 * @param {number} [days]
 * @returns {{from: string, to: string}}
 */
export function epermisRecentWindow(day, days = EPERMIS_RECENT_DAYS) {
  return { from: shiftDay(day, -days), to: day };
}

/**
 * How far back history is read: the layer's default window
 * (`ADS_DEFAULT_MONTHS`, three years), counted from the reading day.
 *
 * Not its longest (13 years): every row kept is normalised and placed on each
 * rebuild of its commune, and Nice alone posts some 2 500 decisions a year.
 * Three years is about 9 000 rows for Nice; older dossiers come from Sitadel,
 * as they do for every other board.
 *
 * @param {string} day
 * @returns {string}
 */
export function epermisHistoryFloor(day) {
  return adsSince(ADS_DEFAULT_MONTHS, Date.parse(`${day}T12:00:00Z`));
}

/**
 * The next stretch of history to read, newest first, a calendar month a
 * window (Trap 4): the months before `before`, down to `floor`, at most
 * `months` of them. Empty once `before` has reached the floor.
 *
 * @param {string} before The earliest day already read; the windows end the day before.
 * @param {string} floor {@link epermisHistoryFloor}.
 * @param {number} [months]
 * @returns {Array<{from: string, to: string}>}
 */
export function epermisHistoryWindows(before, floor, months = EPERMIS_HISTORY_MONTHS_PER_SWEEP) {
  const out = [];
  let to = shiftDay(before, -1);
  while (to >= floor && out.length < months) {
    const monthStart = `${to.slice(0, 7)}-01`;
    const from = monthStart < floor ? floor : monthStart;
    out.push({ from, to });
    to = shiftDay(from, -1);
  }
  return out;
}

/**
 * Every day of a window, newest first, `YYYY-MM-DD`.
 * @param {{from: string, to: string}} window
 * @returns {Array<string>}
 */
export function epermisDaysOf(window) {
  const out = [];
  for (let day = window.to; day >= window.from; day = shiftDay(day, -1)) out.push(day);
  return out;
}

/**
 * One page of a list, or null when the answer is not one. `{success: true,
 * data: []}` is an empty page; anything without that shape is a failure.
 * @param {*} answer Parsed JSON.
 * @returns {?{rows: Array<object>, full: boolean}}
 */
export function parseEpermisPage(answer) {
  if (!answer || answer.success !== true || !Array.isArray(answer.data)) return null;
  const rows = answer.data.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  return { rows, full: answer.data.length >= EPERMIS_PAGE_ROWS };
}

/**
 * The commune a dossier number names, on five characters, or null (Trap 2).
 *
 * Sitadel's grammar: three characters of département, three of commune. A
 * metropolitan département is written with a zero in front (`006`, `02A`),
 * an overseas one in full (`974`, whose communes are `974xx`).
 * `PC0061202600010` → `06120`; `DP02A2472600001` → `2A247`.
 *
 * @param {?string} reference
 * @returns {?string}
 */
export function epermisCommuneOf(reference) {
  const flat = String(reference ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = /^(?:PC|DP|PA|PD|CU)(0[0-9][0-9AB]|97\d)(\d{3})\d{2}/.exec(flat);
  if (!match) return null;
  const code = match[1].startsWith('0') ? `${match[1].slice(1)}${match[2]}` : `${match[1].slice(0, 2)}${match[2]}`;
  return COMMUNE_CODE_PATTERN.test(code) ? code : null;
}

/**
 * One reading of the métropole's two lists, split by commune.
 *
 * Every listed commune gets an entry, empty or not, so that the archive
 * records a day on which it posted nothing. A row whose number names a
 * commune the publisher does not list is not filed anywhere, and counted.
 *
 * @param {object} instance One of {@link EPERMIS_INSTANCES}.
 * @param {Record<string, Array<object>>} boards Raw rows per list.
 * @returns {{communes: Map<string, Record<string, Array<object>>>, unlisted: number}}
 */
export function epermisBoardsByCommune(instance, boards) {
  const communes = new Map(instance.communes.map((code) => [code, { depots: [], decisions: [] }]));
  let unlisted = 0;
  for (const board of Object.values(EPERMIS_BOARDS)) {
    for (const row of boards?.[board] || []) {
      const entry = communes.get(epermisCommuneOf(row?.REFERENCE));
      if (entry) entry[board].push(row); else unlisted += 1;
    }
  }
  return { communes, unlisted };
}

/**
 * The parcels as the cadastre keys them (Trap 7).
 *
 * `labels` is what the card prints, one per parcel written; `idus` is what
 * placement looks up, with both spellings of a section written `O` + letter.
 *
 * @param {?string} cell `BIE_CAD_T`, comma-separated.
 * @param {string} insee The commune whose cadastre holds them.
 * @returns {{labels: Array<string>, idus: Array<{idu: string, provisional: boolean, label: string}>}}
 */
export function epermisParcels(cell, insee) {
  const commune = String(insee ?? '').trim().toUpperCase();
  const labels = [];
  const idus = [];
  if (!COMMUNE_CODE_PATTERN.test(commune)) return { labels, idus };
  for (const piece of String(cell ?? '').split(/[,;]/)) {
    const flat = piece.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const match = /^([A-Z]{2}|[0O][A-Z]|[A-Z]0|[A-Z])(\d{1,4})$/.exec(flat);
    if (!match) continue;
    const [, written, digits] = match;
    if (/^0+$/.test(digits)) continue;
    let sections;
    if (written.length === 1) sections = [`0${written}`];
    else if (/^[A-Z]0$/.test(written)) sections = [`0${written[0]}`];
    else if (/^O[A-Z]$/.test(written)) sections = [written, `0${written[1]}`];
    else sections = [written];
    // The card prints the section as written, an `O` included: which of the
    // two it is, only the cadastre knows.
    const label = `${/^[A-Z]0$/.test(written) ? written[0] : written.replace(/^0/, '')} ${Number.parseInt(digits, 10)}`;
    if (labels.includes(label)) continue;
    labels.push(label);
    for (const section of sections) {
      const idu = `${commune}000${section}${digits.padStart(4, '0')}`;
      if (!idus.some((ref) => ref.idu === idu)) idus.push({ idu, provisional: false, label });
    }
  }
  return { labels, idus };
}

/** Lower case, no accents: the form the verdict tests read. */
function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * What a posted verdict means, on the shared ladder (Trap 6).
 *
 * The PU's reader first (`sirapVerdictState`: Cart@DS's words, a bare
 * `tacite`, `sans objet`), after two e-permis words: a withdrawal
 * (`Retrait de décision …`) and a decision `rapporté` end the permit, whatever
 * verdict their words recall.
 *
 * @param {?string} verdict
 * @returns {?string} `accorde`, `refuse`, `annule`, or null.
 */
export function epermisVerdictState(verdict) {
  const value = fold(verdict);
  if (!value || value.startsWith('x_')) return null;
  // i18n-ignore-next-line — the software's own verdicts, matched on
  if (/^retrait\b|^rapporte\b/.test(value)) return 'annule';
  return sirapVerdictState(verdict);
}

/**
 * The verdict a row posts, and the day it was taken, or nulls.
 *
 * A decision row carries both in `decision` and `date_decision`. A filing row
 * now and then carries one too — `"Refus" du 27/08/2026`, three rows of 971
 * on 2026-10-01 — or a bare number (`1`, `3`, nine rows), a status code the
 * page never explains, which says nothing here.
 *
 * @param {object} row
 * @param {string} board One of {@link EPERMIS_BOARDS}.
 * @returns {{verdict: ?string, decidedOn: ?string}}
 */
export function epermisVerdict(row, board) {
  const raw = text(row?.decision);
  // A number is a status code; `x_` the software's own event (Trap 6).
  if (!raw || /^\d+$/.test(raw) || /^x_/i.test(raw)) return { verdict: null, decidedOn: null };
  if (board === EPERMIS_BOARDS.decisions) {
    // Trap 6: a prorogation keeps the grant's day; a withdrawal has its own.
    const event = text(row.type_evt);
    const ownDay = !event || event === 'decision' || epermisVerdictState(raw) !== 'accorde';
    return { verdict: raw, decidedOn: ownDay ? cartdsDate(row.date_decision) : null };
  }
  // i18n-ignore-next-line — the app's own wording, matched on
  const quoted = /^["“”]?\s*(.+?)\s*["“”]?\s+du\s+(\d{2}\/\d{2}\/\d{4})$/i.exec(raw);
  if (quoted) return { verdict: quoted[1], decidedOn: cartdsDate(quoted[2]) };
  return { verdict: raw, decidedOn: null };
}

/**
 * The fields of a row that are kept, in a fixed order — the archive's `cells`
 * (see {@link scrubEpermisRow}). Both lists in one shape: a filing has
 * `date_demande`, a decision `date_depot`, `date_decision` and `type_evt`.
 */
export const EPERMIS_ROW_FIELDS = Object.freeze([
  'REFERENCE', 'type_dossier', 'BIE_ADRESSE', 'BIE_CAD_T', 'nature', 'surf_cc',
  'surface_terrain', 'date_demande', 'date_depot', 'decision', 'date_decision',
  'type_evt', 'date_affichage', 'dos_dnm_t',
]);

/** Where the applicant sits in the stored cells. */
const APPLICANT_CELL = EPERMIS_ROW_FIELDS.indexOf('dos_dnm_t');

/**
 * One row as it may be stored, or null for a row that may not be.
 *
 * TRAP 8 before anything is written: the applicant filtered, the architect and
 * the platform's own ids left behind. A row whose number is not a building
 * authorisation is not kept at all.
 *
 * @param {object} row One object of a list's `data`.
 * @returns {?Array<?string>}
 */
export function scrubEpermisRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row) || !cartdsKind(row.REFERENCE)) return null;
  const cells = EPERMIS_ROW_FIELDS.map((field) => {
    const value = row[field];
    return value === null || value === undefined ? null : String(value);
  });
  cells[APPLICANT_CELL] = organisationApplicant(cells[APPLICANT_CELL]);
  return cells;
}

/** A stored row back into the object the normaliser reads. */
function rowOfCells(cells) {
  return Object.fromEntries(EPERMIS_ROW_FIELDS.map((field, i) => [field, cells[i] ?? null]));
}

/**
 * What the archive needs to keep an e-permis board: which lists a row may
 * come from, and how it is scrubbed. Handed to `createCartdsArchiveStore`.
 */
export const EPERMIS_ROWS = Object.freeze({
  board: (board) => Object.values(EPERMIS_BOARDS).includes(board),
  scrub: scrubEpermisRow,
});

/** `0` is the field's blank: 2 924 rows of 3 805 say it, most of them a DP. */
function area(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * One row → the shape every source of the layer is normalised into.
 *
 * Takes the row as the API answers it, or as the archive stores it (an array
 * of {@link EPERMIS_ROW_FIELDS}); both go through {@link scrubEpermisRow}
 * first, so a person's name cannot get through either way.
 *
 * @param {object} instance One of {@link EPERMIS_INSTANCES}.
 * @param {string} board One of {@link EPERMIS_BOARDS}.
 * @param {object|Array<?string>} input
 * @returns {?object} Null for a row that is not a building authorisation, or
 *   whose number names no commune.
 */
export function normaliseEpermisRow(instance, board, input) {
  const cells = Array.isArray(input) ? input : scrubEpermisRow(input);
  if (!cells) return null;
  const row = rowOfCells(cells);
  const number = String(row.REFERENCE ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const kind = cartdsKind(number);
  const commune = epermisCommuneOf(number);
  if (!kind || !commune) return null;
  const series = seriesOfKind(kind);
  const kindLabel = ADS_KINDS[kind] ?? kind;
  const { verdict, decidedOn } = epermisVerdict(row, board);
  const state = epermisVerdictState(verdict);
  const parcels = epermisParcels(row.BIE_CAD_T, commune);
  const filed = board === EPERMIS_BOARDS.decisions ? row.date_depot : row.date_demande;
  return {
    id: `epermis:${instance.key}:${number}`,
    dossier: formatDossier(kind, number.slice(2)),
    series,
    key: `${series}|${dossierKey(number)}`,
    kind,
    kindLabel,
    // TRAP 5: no decision posted says FILED, and nothing about a review. A
    // verdict off the ladder keeps its own words, as on a Cart@DS board.
    state: state ?? 'depose',
    stateLabel: state ? stateFrench(state) : (verdict ?? stateFrench('depose')),
    depositedOn: cartdsDate(filed),
    decidedOn,
    postedOn: cartdsDate(row.date_affichage),
    startedOn: null,
    completedOn: null,
    depositYear: null,
    applicant: organisationApplicant(row.dos_dnm_t),
    purpose: text(row.nature) ?? kindLabel,
    // No postcode on 3 804 of 3 805 rows: the geocoder is given the commune.
    address: text(row.BIE_ADRESSE)?.replace(/[\s,]+$/, '') || null,
    postcode: null,
    commune: null,
    communeCode: commune,
    cadastreCommune: commune,
    parcels: parcels.labels,
    parcelIdus: parcels.idus,
    landAreaM2: area(row.surface_terrain),
    housing: null,
    surfaceCreatedM2: area(row.surf_cc),
    lon: null,
    lat: null,
    precision: null,
    geocodeScore: null,
    parts: null,
    source: 'epermis',
    sourceLabel: instance.label,
  };
}
