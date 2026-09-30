/**
 * @module data/cartdsFeed
 *
 * *Affichage réglementaire* — the permits a commune posts on its own public
 * board, read off the one piece of software a third of the posting communes
 * share.
 *
 * WHY A THIRD REGISTER. Sitadel holds only the authorisations that were
 * GRANTED and that CREATE floor area, about six weeks late; the three
 * métropole portals next door cover 53 communes. What a commune posts itself
 * is neither late nor filtered: the filing notice (*avis de dépôt*) within
 * days of the filing, the decision within days of the decision, every family
 * included — the fence, the pool, the solar panels and the windows that
 * Sitadel never sees. Measured 2026-09-30: Ventabren (13114) had 41 decisions
 * on its board, posted between 11 August and 28 September, where Sitadel's
 * four files hold 14 rows for the whole of 2026.
 *
 * WHY CART@DS. A national inventory drew 200 communes at random, 50 per size
 * band, and checked them by hand: about 4 % post their permits online and up
 * to date, and eight of the 26 that do post them through Inetum's Cart@DS
 * instruction software — the largest single family, ahead of the communes' own
 * websites (PDFs, often scanned). Every Cart@DS instance serves the SAME public
 * table at `<instance>/Login/AffichageReglementaire`, whatever host it runs
 * on, so one reader covers every commune of every instance. Of 75 communes
 * sampled across twelve instances, 68 had posted a decision in the last
 * fourteen days, and 98 % of the rows name their cadastral parcel.
 *
 * ── The protocol ────────────────────────────────────────────────────────────
 * The page is an ASP.NET form. Its GET sets an anti-forgery cookie and prints
 * the matching `__RequestVerificationToken` in a hidden input; the table is
 * then filled by `POST <instance>/Login/GetRapportDossier`, a DataTables
 * server-side request that must carry the token, the cookie, the commune's
 * INSEE code (`NCommune`) and which of the two boards is wanted
 * (`TypeInformation`: 1 = filing notices, 2 = decisions). Without the cookie
 * the POST answers an error page; without the column descriptors DataTables
 * sends, it answers nothing. {@link buildCartdsForm} writes the whole body.
 *
 * ── Trap 1: the board forgets ───────────────────────────────────────────────
 * A row leaves the table when its posting period ends — about two months for a
 * decision, which is the legal posting time. So this register is FRESH and
 * never HISTORICAL: the layer's older dossiers still come from Sitadel, and the
 * two are merged on the dossier number (`dossierKey`) exactly like the
 * métropole portals. Keeping what the board forgets needs a daily archive; it
 * is not this module's job.
 *
 * ── Trap 2: the board names private people ──────────────────────────────────
 * The fourth column is the applicant as written on the form, private
 * individuals included. A commune may post a name; a reuser republishing it is
 * processing personal data for its own purpose, so the name goes through the
 * same filter as the Paris and Nantes portals (`permitApplicant.js`): an
 * organisation keeps its name, a person never reaches the payload.
 *
 * ── Trap 3: one dossier, two boards ─────────────────────────────────────────
 * A dossier is posted once when it is filed and again when it is decided, and
 * the two postings overlap for weeks. They are one dossier: {@link
 * foldCartdsDossiers} keeps one row per number, with the decision's state and
 * date and whichever posting knew the rest.
 *
 * ── Trap 4: a filed dossier is not a dossier under review ───────────────────
 * A filing notice with no decision posted says that the dossier was FILED, and
 * nothing more. A déclaration préalable left unanswered for a month is granted
 * tacitly, and a tacit decision is posted by some communes and not by others.
 * So an undecided row is `depose`, the claim the board supports, and never
 * `instruction`, a claim it does not.
 *
 * ── Trap 5: some instances forbid robots ────────────────────────────────────
 * Measured 2026-09-30: five of the fifteen instances found answer
 * `robots.txt` with `Disallow: /` for every agent — Le Cotentin's among them.
 * They are not in {@link CARTDS_INSTANCES}, and the proxy re-reads each host's
 * `robots.txt` before asking ({@link robotsAllows}), so an instance that adds
 * the rule later is dropped without a code change.
 *
 * Dependency-free and side-effect-free (no Cesium, no DOM, no fetch): URL and
 * body construction, parsing and normalisation only. The `/api/ads-fr` proxy
 * imports it; nothing in the browser bundle does.
 */

import { COMMUNE_CODE_PATTERN } from './communeCode.js';
import { sitadelParcelRefs } from './cadastreLineage.js';
import { organisationApplicant } from './permitApplicant.js';
import { ADS_KINDS, dossierKey, seriesOfKind } from './adsFeed.js';
import { ADS_STATE_WORDS } from './adsFeed.i18n.js';

/** Trim a value to a non-empty string, or null. */
function text(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).replace(/\s+/g, ' ').trim();
  return trimmed || null;
}

/** The same state words `adsFeed.js` publishes, in the payload's French. */
function stateFrench(state) {
  return ADS_STATE_WORDS.definition[state].fr;
}

/** The path of the public board, the same on every instance. */
export const CARTDS_PAGE_PATH = '/Login/AffichageReglementaire';

/** The path the board's table is filled from. */
export const CARTDS_DATA_PATH = '/Login/GetRapportDossier';

/** `TypeInformation`: the two boards an instance posts. */
export const CARTDS_BOARDS = Object.freeze({ filings: '1', decisions: '2' });

/**
 * Rows asked for per page. The busiest board measured, Orléans's filing
 * notices, held 525 rows on 2026-09-30; a page this size answers it in one
 * request, and every other board of the 92 communes with it.
 */
export const CARTDS_PAGE_LENGTH = 1000;

/** Pages read per board before giving up, and saying so. */
export const CARTDS_MAX_PAGES = 3;

/** How the reuse of a posted decision is licensed. */
// i18n-ignore-next-line — a legal reference, relayed as metadata
export const CARTDS_LICENCE = 'Information publique — CRPA, art. L.321-1';

/**
 * The Cart@DS instances read, and the communes each one posts for.
 *
 * FROM A MEASUREMENT, NOT A CATALOGUE. Fifteen instances were found by the
 * inventory of 2026-09-30 and every commune each one offers was read on both
 * boards. Kept here: the instances that let a robot in and answer the table,
 * and in each, the communes that had at least one row posted — 92 communes,
 * 5 618 rows that day. Left out, and why:
 *
 * - `robots.txt` says `Disallow: /` — Le Cotentin (`ads.lecotentin.fr`, six
 *   communes), Grand Libournais, Conches-en-Ouche, Sainte-Marie (La Réunion),
 *   Brie Nangissienne. Asking their permission is the way in, not this list;
 * - the table answers an error page — Mauges Communauté;
 * - the certificate chain is incomplete, so Node refuses the connection —
 *   Joinville (`pemb.fr`).
 *
 * `codes` says what the instance's commune menu sends as `NCommune`: the INSEE
 * code (`'insee'`) or the commune's three-digit number with the leading zeros
 * dropped (`'number'`, so Porto-Vecchio, 2A247, is `247`). Ten of the fifteen
 * send the number, and sending the INSEE code to one of them answers an empty
 * table rather than an error.
 *
 * `robots5xx` is set on the one host whose front answers every path outside the
 * application with HTTP 503 — `robots.txt`, and an invented `nope.txt` alike,
 * measured 2026-09-30. RFC 9309 reads a 5xx as "disallow everything" because
 * it usually means a server that is down; here it is the absence of a file,
 * and the flag says so for this host only.
 */
export const CARTDS_INSTANCES = Object.freeze([
  Object.freeze({
    key: 'mamp',
    base: 'https://mamp.geosphere.fr/guichet-unique',
    label: 'Métropole Aix-Marseille-Provence — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    codes: 'insee',
    communes: Object.freeze([
      '13007', '13008', '13012', '13013', '13023', '13024', '13118', '13032',
      '13046', '13028', '13084', '13080', '13109', '13056', '13059', '13073',
      '13077', '13079', '13093', '13098', '13099', '13103', '13105', '13111',
      '13113', '13114',
    ]),
  }),
  Object.freeze({
    key: 'paysdefayence',
    base: 'https://paysdefayence.geosphere.fr/guichet-unique',
    label: 'Pays de Fayence — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    codes: 'number',
    communes: Object.freeze([
      '83008', '83029', '83055', '83080', '83081', '83117', '83124', '83133',
    ]),
  }),
  Object.freeze({
    key: 'portovecchio',
    base: 'https://portovecchio.geosphere.fr/guichet-unique',
    label: 'Porto-Vecchio — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    codes: 'number',
    communes: Object.freeze(['2A247']),
  }),
  Object.freeze({
    key: 'chatillon',
    base: 'https://chatillon.geosphere.fr/guichet-unique',
    label: 'Châtillon — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    codes: 'number',
    communes: Object.freeze(['92020']),
  }),
  Object.freeze({
    key: 'atd24',
    base: 'https://atd24.geosphere.fr/guichet-unique',
    label: 'ATD 24 (Dordogne) — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    codes: 'number',
    communes: Object.freeze(['24037', '24296']),
  }),
  Object.freeze({
    key: 'ccbr',
    base: 'https://ccbr.geosphere.fr/guichet-unique',
    label: 'Bretagne romantique — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    codes: 'insee',
    communes: Object.freeze([
      '35009', '35010', '35029', '35050', '35078', '35092', '35094', '35095',
      '35104', '35130', '35017', '35034', '35056', '35148', '35361', '35134',
      '35156', '35159', '35172', '35308', '35186', '35222', '35225', '35226',
      '35233', '35246', '35247', '35248', '35258', '35259', '35265', '35270',
      '35286', '35291', '35318', '35329', '35337', '35339', '35342', '35345',
      '35346',
    ]),
  }),
  Object.freeze({
    key: 'soultz',
    base: 'https://urbanisme.soultz68.fr/guichet-unique',
    label: 'Soultz-Haut-Rhin — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    codes: 'number',
    communes: Object.freeze(['68315']),
  }),
  Object.freeze({
    key: 'orleans',
    base: 'https://demarchesurbanisme.orleans-metropole.fr/guichet-unique',
    label: 'Orléans Métropole — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    codes: 'insee',
    robots5xx: 'absent',
    communes: Object.freeze([
      '45034', '45075', '45197', '45232', '45234', '45235', '45272', '45274',
      '45284', '45285', '45286', '45298',
    ]),
  }),
]);

/**
 * The instance that posts for this commune, or null.
 * @param {?string} communeCode INSEE code.
 * @returns {?object} One of {@link CARTDS_INSTANCES}.
 */
export function cartdsInstanceFor(communeCode) {
  const code = String(communeCode ?? '').trim().toUpperCase();
  if (!COMMUNE_CODE_PATTERN.test(code)) return null;
  return CARTDS_INSTANCES.find((instance) => instance.communes.includes(code)) ?? null;
}

/**
 * What this instance's commune menu sends for an INSEE code.
 * @param {object} instance One of {@link CARTDS_INSTANCES}.
 * @param {string} insee
 * @returns {string}
 */
export function cartdsCommuneValue(instance, insee) {
  const code = String(insee ?? '').trim().toUpperCase();
  if (instance.codes !== 'number') return code;
  return String(Number.parseInt(code.slice(-3), 10));
}

/** @param {object} instance @returns {string} The board's page. */
export function cartdsPageUrl(instance) {
  return `${instance.base}${CARTDS_PAGE_PATH}`;
}

/** @param {object} instance @returns {string} The table's endpoint. */
export function cartdsDataUrl(instance) {
  return `${instance.base}${CARTDS_DATA_PATH}`;
}

/** @param {object} instance @returns {string} The host's `robots.txt`. */
export function cartdsRobotsUrl(instance) {
  return `${new URL(instance.base).origin}/robots.txt`;
}

/**
 * The anti-forgery token the page printed for its own form.
 *
 * The page carries it twice or more — once per form — and they are the same
 * token for one cookie, so the first is taken.
 *
 * @param {?string} html The board page.
 * @returns {?string}
 */
export function parseCartdsToken(html) {
  const match = /name="__RequestVerificationToken"[^>]*value="([^"]+)"/.exec(String(html ?? ''))
    ?? /value="([^"]+)"[^>]*name="__RequestVerificationToken"/.exec(String(html ?? ''));
  return match ? match[1] : null;
}

/** The five entities ASP.NET writes into an option, and numeric ones. */
function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * The communes the board's menu offers, as `{value, name}`.
 *
 * Not read by the proxy — the gate is {@link CARTDS_INSTANCES}, measured — but
 * it is how that list is rebuilt, and the test pins the menu's shape.
 *
 * @param {?string} html The board page.
 * @returns {Array<{value: string, name: string}>}
 */
export function parseCartdsCommunes(html) {
  const select = /id="Communes_OptionSelectionnee"[\s\S]*?<\/select>/.exec(String(html ?? ''));
  if (!select) return [];
  const out = [];
  for (const match of select[0].matchAll(/<option[^>]*value="([^"]+)"[^>]*>\s*([^<]+)/g)) {
    out.push({ value: match[1], name: decodeEntities(match[2]).trim() });
  }
  return out;
}

/**
 * The body of one table request.
 *
 * DataTables' server-side protocol, as the page's own script sends it. The
 * column descriptors are not decoration: without them the instance answers an
 * empty table. Nine are sent, one more than the filing board shows, because
 * the decision board has nine and a descriptor too many is ignored.
 *
 * @param {{commune: string, board: string, token: string, start?: number, length?: number}} query
 * @returns {string} `application/x-www-form-urlencoded`.
 */
export function buildCartdsForm({
  commune, board, token, start = 0, length = CARTDS_PAGE_LENGTH,
}) {
  const params = new URLSearchParams();
  params.set('NCommune', String(commune));
  params.set('CoTypeDossier', '');
  params.set('TypeInformation', String(board));
  params.set('__RequestVerificationToken', String(token));
  params.set('draw', '1');
  params.set('start', String(start));
  params.set('length', String(length));
  params.set('search[value]', '');
  params.set('search[regex]', 'false');
  params.set('order[0][column]', '0');
  params.set('order[0][dir]', 'desc');
  for (let i = 0; i < 9; i += 1) {
    params.set(`columns[${i}][data]`, String(i));
    params.set(`columns[${i}][name]`, '');
    params.set(`columns[${i}][searchable]`, 'true');
    params.set(`columns[${i}][orderable]`, 'true');
    params.set(`columns[${i}][search][value]`, '');
    params.set(`columns[${i}][search][regex]`, 'false');
  }
  return params.toString();
}

/** A `robots.txt` path pattern as a RegExp: `*` any run, a final `$` the end. */
function robotsPattern(rule) {
  const anchored = rule.endsWith('$');
  const body = (anchored ? rule.slice(0, -1) : rule)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/**
 * Whether a `robots.txt` lets this agent fetch this path (RFC 9309).
 *
 * The groups naming the agent win over the `*` group; inside the chosen rules
 * the longest match wins, and `Allow` wins a tie. An empty `Disallow:` allows
 * everything, as the RFC says.
 *
 * @param {?string} robotsTxt The file's text. Null or empty allows all.
 * @param {string} path The path to fetch.
 * @param {string} [agent] The product token of our user agent.
 * @returns {boolean}
 */
export function robotsAllows(robotsTxt, path, agent = 'surplomb') {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(robotsTxt ?? '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === 'user-agent') {
      if (!lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current || (field !== 'allow' && field !== 'disallow')) continue;
    if (field === 'disallow' && !value) continue;
    current.rules.push({ allow: field === 'allow', value });
  }
  const token = agent.toLowerCase();
  const named = groups.filter((group) => group.agents.some((name) => name !== '*' && token.includes(name)));
  const chosen = named.length ? named : groups.filter((group) => group.agents.includes('*'));
  let best = null;
  for (const rule of chosen.flatMap((group) => group.rules)) {
    if (!robotsPattern(rule.value).test(path)) continue;
    if (!best || rule.value.length > best.value.length
      || (rule.value.length === best.value.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}

/**
 * `28/09/2026` → `2026-09-28`, or null.
 * @param {?string} value
 * @returns {?string}
 */
export function cartdsDate(value) {
  const match = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(value ?? ''));
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/**
 * The address cell, split into what it holds.
 *
 * `313 Chemin de la Bertrane 13122  (AI 255)`: the site, its postcode, and the
 * parcels in brackets at the end. A locality sometimes follows the postcode
 * (`1 A Rue des Mouettes 13500 CARRO`) and the street is sometimes missing
 * altogether (`  13121 `), so every part is optional.
 *
 * A PARCEL MAY CARRY A PREFIX. Three shapes were seen across 5 618 rows:
 * `AI 255`, `01 73` (Alsace, whose sections are numbered), and `147 AC 137` —
 * a section of a commune nouvelle that belonged to another commune before the
 * merger, which the cadastre keys by that commune's old number. The prefix is
 * kept for {@link cartdsParcelIdus}; the published text is kept for the card.
 *
 * @param {?string} cell
 * @returns {{address: ?string, postcode: ?string, locality: ?string,
 *   parcels: Array<{prefix: ?string, section: string, numero: string, label: string}>}}
 */
export function parseCartdsPlace(cell) {
  let rest = String(cell ?? '').replace(/\s+/g, ' ').trim();
  const parcels = [];
  const bracket = /\(([^()]*)\)\s*$/.exec(rest);
  if (bracket) {
    rest = rest.slice(0, bracket.index).trim();
    for (const piece of bracket[1].split(',')) {
      const label = piece.replace(/\s+/g, ' ').trim().toUpperCase();
      const match = /^(?:(\d{1,3}) )?([A-Z0-9]{1,2}) (\d{1,4}[A-Z]?)$/.exec(label);
      if (!match) continue;
      parcels.push({ prefix: match[1] ?? null, section: match[2], numero: match[3], label });
    }
  }
  const postal = /^(.*?)\s*\b(\d{5})\b\s*(.*)$/.exec(rest);
  return {
    address: text(postal ? postal[1] : rest),
    postcode: postal ? postal[2] : null,
    locality: postal ? text(postal[3]) : null,
    parcels,
  };
}

/**
 * The parcels as the cadastre keys them: `<INSEE><prefix><section><number>`.
 *
 * The prefix is `000` for a commune's own sections. A board that writes the
 * commune's OWN number in front (`93 B 817` at Saint-Estève-Janson, 13093) is
 * saying the same thing, so that number folds to `000`; any other number is
 * the former commune of a merger and is kept, which is how the cadastre spells
 * those sections too.
 *
 * @param {Array<{prefix: ?string, section: string, numero: string}>} parcels
 * @param {string} insee
 * @returns {Array<{idu: string, provisional: boolean, label: string}>}
 */
export function cartdsParcelIdus(parcels, insee) {
  const commune = String(insee ?? '').trim().toUpperCase();
  if (!COMMUNE_CODE_PATTERN.test(commune)) return [];
  const own = Number.parseInt(commune.slice(-3), 10);
  const out = [];
  for (const parcel of parcels || []) {
    const digits = String(parcel.numero ?? '').replace(/[^0-9]/g, '');
    if (!digits || !parcel.section) continue;
    const prefix = parcel.prefix && Number.parseInt(parcel.prefix, 10) !== own
      ? parcel.prefix.padStart(3, '0')
      : '000';
    const idu = `${commune}${prefix}${parcel.section.padStart(2, '0')}${digits.padStart(4, '0')}`;
    if (out.some((ref) => ref.idu === idu)) continue;
    out.push({
      idu,
      // The surveyor's mark for part of a parcel, as in Sitadel's column.
      provisional: /[A-Z]$/.test(parcel.numero),
      label: `${parcel.section}${digits}`,
    });
  }
  return out;
}

/** Lower case, no accents: the form the verdict tests read. */
function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * What a posted verdict means, on the shared ladder.
 *
 * The software's words, counted over the 3 324 decisions posted on 2026-09-30:
 * `Favorable` 1 057, `Favorable avec réserve` 880, `Défavorable` 268,
 * `Annulation` 200, `Rejet implicite` 141, `Favorable tacite` 76,
 * `Rejet tacite` 26, `Défavorable tacite` 22, `Accord tacite` 14, `Sans suite`
 * 8, `Classement sans suite` 6, `Caduc` 2, `Non opposition` 1, `Irrecevable`
 * 1, `Rejet` 1. The rest are a certificat's answer (`Simple information`,
 * `Réalisable`, `Non réalisable`) or a pre-emption's, whose rows never get
 * this far.
 *
 * REFUSAL IS TESTED FIRST because `défavorable` contains `favorable`, and
 * `non opposition` before `opposition` for the same reason.
 *
 * @param {?string} verdict The words before « le <date> ».
 * @returns {?string} `accorde`, `refuse`, `annule`, or null for none of them.
 */
export function cartdsVerdictState(verdict) {
  const value = fold(verdict);
  if (!value) return null;
  // i18n-ignore-start — the software's own verdicts, matched on
  if (/\bnon[\s-]opposition\b/.test(value)) return 'accorde';
  if (/\bdefavorable\b|\brejet\b|\bopposition\b|\brefus/.test(value)) return 'refuse';
  if (/\bfavorable\b|\baccord\b/.test(value)) return 'accorde';
  if (/annul|renonciation|sans suite|\bcaduc|irrecevab|retrait|desist/.test(value)) return 'annule';
  // i18n-ignore-end
  return null;
}

/**
 * The decision cell: `Favorable avec réserve le 24/09/2026`.
 *
 * @param {?string} cell
 * @returns {{state: string, label: string, decidedOn: ?string, verdict: ?string}}
 */
export function cartdsDecision(cell) {
  const raw = text(cell);
  const match = raw ? /^(.*?)\s+le\s+(\d{2}\/\d{2}\/\d{4})$/.exec(raw) : null;
  const verdict = text(match ? match[1] : raw);
  const decidedOn = match ? cartdsDate(match[2]) : null;
  const state = cartdsVerdictState(verdict);
  if (state) return { state, label: stateFrench(state), decidedOn, verdict };
  // A verdict off the ladder keeps its own words, as `localState` does for the
  // métropole portals; the card prints them as published.
  return { state: 'depose', label: verdict ?? stateFrench('depose'), decidedOn, verdict };
}

/** `194,07` → 194.07, or null. */
function frenchNumber(value) {
  const raw = String(value ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  return Number(raw);
}

/**
 * The project cell: floor area created and demolished, lots.
 *
 * `- Surface plancher créée : 194,07 m²<br>- Surface plancher démolie : 0 m²`.
 * An empty figure (`créée :  m²`, nine rows) is a blank, not a zero.
 *
 * @param {?string} cell
 * @returns {{createdM2: ?number, demolishedM2: ?number, lots: ?number}}
 */
export function cartdsProject(cell) {
  const value = String(cell ?? '');
  // i18n-ignore-start — the software's own labels, matched on
  const created = /Surface plancher cr[ée]{2}e\s*:\s*([\d\s,.]*)m/i.exec(value);
  const demolished = /Surface plancher d[ée]molie\s*:\s*([\d\s,.]*)m/i.exec(value);
  const lots = /Lotissement\s*:\s*(\d+)\s*lot/i.exec(value);
  // i18n-ignore-end
  return {
    createdM2: created ? frenchNumber(created[1]) : null,
    demolishedM2: demolished ? frenchNumber(demolished[1]) : null,
    lots: lots ? Number(lots[1]) : null,
  };
}

/**
 * The family a posted dossier belongs to, from its number, or null.
 *
 * The board also posts what is NOT a building authorisation, and those rows
 * stop here: `IA` is a *déclaration d'intention d'aliéner* — a property SALE,
 * with its price, which this layer has no business publishing — `AT` an
 * accessibility and fire-safety authorisation under the building code, `DC`
 * a rarity with one row in 5 618. Certificats (`CU`) are kept: the layer
 * counts them rather than drawing them, as it does Bordeaux's.
 *
 * @param {?string} dossier
 * @returns {?string}
 */
export function cartdsKind(dossier) {
  const prefix = String(dossier ?? '').trim().toUpperCase().slice(0, 2);
  return ['PC', 'DP', 'PA', 'PD', 'CU'].includes(prefix) ? prefix : null;
}

/**
 * One board row → the shape every source of the layer is normalised into.
 *
 * The columns, as the page heads them: display date, dossier number, filing
 * date, applicant, site and parcels, land area, nature of the works, project
 * figures — and on the decision board only, the decision.
 *
 * @param {object} instance One of {@link CARTDS_INSTANCES}.
 * @param {string} insee The commune asked for.
 * @param {string} board `CARTDS_BOARDS.filings` or `.decisions`.
 * @param {Array<?string>} row One row of the table's `data`.
 * @returns {?object} Null for a row that is not a building authorisation.
 */
export function normaliseCartdsRow(instance, insee, board, row) {
  if (!Array.isArray(row)) return null;
  const dossier = text(row[1]);
  const kind = cartdsKind(dossier);
  if (!kind) return null;
  const place = parseCartdsPlace(row[4]);
  const project = cartdsProject(row[7]);
  const decided = board === CARTDS_BOARDS.decisions ? cartdsDecision(row[8]) : null;
  const series = seriesOfKind(kind);
  const commune = String(insee).toUpperCase();
  return {
    id: `cartds:${instance.key}:${dossier}`,
    dossier,
    series,
    key: `${series}|${dossierKey(dossier)}`,
    kind,
    kindLabel: ADS_KINDS[kind] ?? kind,
    // TRAP 4: a filing notice says FILED, and nothing about a review.
    state: decided?.state ?? 'depose',
    stateLabel: decided?.label ?? stateFrench('depose'),
    depositedOn: cartdsDate(row[2]),
    decidedOn: decided?.decidedOn ?? null,
    postedOn: cartdsDate(row[0]),
    startedOn: null,
    completedOn: null,
    depositYear: null,
    // TRAP 2: an organisation keeps its name, a person never gets through.
    applicant: organisationApplicant(row[3]),
    purpose: text(row[6]) ?? (ADS_KINDS[kind] ?? null),
    address: place.address,
    postcode: place.postcode,
    commune: null,
    communeCode: commune,
    cadastreCommune: commune,
    parcels: place.parcels.map((parcel) => parcel.label),
    parcelIdus: cartdsParcelIdus(place.parcels, commune),
    landAreaM2: frenchNumber(String(row[5] ?? '').replace(/m²|m2/i, '')),
    housing: null,
    surfaceCreatedM2: project.createdM2,
    lots: project.lots,
    lon: null,
    lat: null,
    precision: null,
    geocodeScore: null,
    parts: null,
    source: 'cartds',
    sourceLabel: instance.label,
  };
}

/**
 * One row per dossier out of the two boards.
 *
 * TRAP 3. A dossier filed in August and decided in September is on both
 * boards in September. The decision's row carries the state and its date; the
 * rest is taken from whichever row knew it, so a decision posted with an empty
 * nature still says what the filing said.
 *
 * @param {Array<object>} permits Normalised rows, both boards, any order.
 * @returns {{permits: Array<object>, folded: number}}
 */
export function foldCartdsDossiers(permits) {
  const byKey = new Map();
  let folded = 0;
  for (const permit of permits) {
    // The FAMILY is part of the identity here. These communes count their
    // PC and their DP separately: 115 numbers were carried by both a PC and
    // a DP on the boards of 2026-09-30, 11 of them at La Ciotat alone.
    const identity = `${permit.kind}|${permit.key}`;
    const seen = byKey.get(identity);
    if (!seen) { byKey.set(identity, permit); continue; }
    folded += 1;
    const [decision, other] = permit.decidedOn && !seen.decidedOn ? [permit, seen] : [seen, permit];
    const merged = { ...decision };
    for (const [field, value] of Object.entries(other)) {
      const mine = merged[field];
      if (mine === null || mine === undefined || (Array.isArray(mine) && !mine.length)) merged[field] = value;
    }
    // A nature the software filled in with the family's own name is a blank.
    if (merged.purpose === merged.kindLabel && other.purpose) merged.purpose = other.purpose;
    byKey.set(identity, merged);
  }
  return { permits: [...byKey.values()], folded };
}
