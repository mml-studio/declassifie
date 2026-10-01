/**
 * @module data/permitListsFeed
 *
 * *Listes d'autorisations d'urbanisme* — the lists of filed and decided
 * permits a city publishes on its own website as PDF files, read as tables.
 *
 * WHY A FIFTH REGISTER. A check of the sixty most populous communes with no
 * fresh permit source, on 2026-10-01, found thirteen that post neither a
 * Cart@DS nor a Sirap board but publish the same information as PDF lists:
 * Marseille and Nîmes among them. Marseille posts two lists on its urbanism
 * page — every dossier still under review (1 874 on 2026-09-28, 1 083 of them
 * filed that year) and every authorisation granted in the last two months
 * (825 from 16 July to 29 September) — where Sitadel's housing file holds 190
 * authorisations for the whole of 2026, the latest decided on 21 September,
 * and never a déclaration préalable that creates no floor area. Nîmes posts
 * one file of 60 pages: 348 dossiers under review and 321 decided, 86 of them
 * refused.
 *
 * ── The protocol ────────────────────────────────────────────────────────────
 * One HTML page per city, read for its links ({@link permitListLinks}), and one
 * PDF per list, read by `pdfText.js` into positioned text runs. A list is found
 * by the words of its link or its file name, never by a file name alone:
 * Marseille names its files by date (`28.09.26.pdf`, `affichage-du-16.07.26-
 * au-29.09.26.pdf`) and replaces them every few weeks.
 *
 * ── Trap 1: two table layouts ───────────────────────────────────────────────
 * The list of dossiers under review is the REGISTER the Cart@DS instruction
 * software prints, the same at Marseille and Nîmes: six columns, each record
 * several lines high, every cell aligned to the record's top line — the line
 * that reads « Déposé le … » ({@link readRegisterList}). The same software
 * prints its register of decisions in the same layout, the deadline column
 * replaced by the decision, and Nîmes appends it to the same file. Marseille's list of
 * granted authorisations is a spreadsheet exported from LibreOffice: thirteen
 * columns, one row per dossier, every cell centred on the row's middle, where
 * the dossier number is ({@link readDecisionTable}). Neither file draws a rule
 * a reader could find, so rows and columns are rebuilt from where the text
 * sits: columns from the header words, rows from the one run every record has.
 *
 * ── Trap 2: the lists forget ────────────────────────────────────────────────
 * A dossier leaves the first list when it is decided and the second two months
 * after, and the files are replaced, not appended to. So every row read is
 * kept, through the same archive as a posted board (`cartdsArchive.js`, {@link
 * PERMIT_LIST_ROWS}) and the same daily sweep, and the layer draws the archive.
 *
 * ── Trap 3: a list of dossiers under review says so, while it is current ────
 * Unlike a filing notice (Trap 4 of `cartdsFeed.js`), the register is titled
 * « dossiers en cours d'instruction » / « Registre des dossiers en cours »: on
 * the edition that lists it, a dossier IS under review, by the city's own
 * statement. Once a later edition no longer lists it, the city has decided it,
 * and Marseille never publishes a refusal — its second list holds grants only
 * (460 « Accord Tacite », 320 « Favorable avec Reserves », 45 « Favorable » on
 * 2026-09-29). So a row of the current edition is `instruction`, and a row an
 * edition has dropped falls back to `depose`, the claim that still holds.
 *
 * ── Trap 4: the lists name private people ───────────────────────────────────
 * The DEMANDEUR column is the applicant as written on the form, with the
 * applicant's own postal address under it. Only the first line is read, cut
 * before anything that looks like an address, and it goes through the same
 * filter as every other register (`permitApplicant.js`) before the row is even
 * stored; the address is never kept.
 *
 * ── Trap 5: Marseille writes its numbers with a suffix ──────────────────────
 * `PC 013055 26 00230P0` on the list, `0130552600230` in Sitadel: the
 * instruction software's `P0` marks the original dossier, and `M01`, `T01` a
 * modification or a transfer. The `P0` is dropped ({@link
 * permitListDossier}) so the two registers meet on `dossierKey`; a
 * modification keeps its suffix, as everywhere else in the layer. Nîmes writes
 * its numbers as Sitadel does (`PC 030189 24 P0240`), and needs nothing.
 *
 * Dependency-free and side-effect-free (no Cesium, no DOM, no fetch): link
 * discovery, table reading and normalisation only. The `/api/ads-fr` proxy and
 * `scripts/lib/permitLists.mjs` import it; nothing in the browser bundle does.
 */

import { foldToCommune } from './communeCode.js';
import { organisationApplicant } from './permitApplicant.js';
import { ADS_KINDS, dossierKey, formatDossier, seriesOfKind } from './adsFeed.js';
import { ADS_STATE_WORDS } from './adsFeed.i18n.js';
import { CARTDS_LICENCE, cartdsDate, cartdsKind, cartdsVerdictState } from './cartdsFeed.js';

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

/** Upper case, no accents, single spaces: the form header words are matched in. */
function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

/** How the reuse of a published list is licensed: as for a posted board. */
export const PERMIT_LISTS_LICENCE = CARTDS_LICENCE;

/** The two lists a city may publish, as the archive names them. */
export const PERMIT_LIST_BOARDS = Object.freeze({ filings: 'filings', decisions: 'decisions' });

/**
 * The cities read, the page that links their lists, and how each list is
 * found and read.
 *
 * FROM A MEASUREMENT, as `CARTDS_INSTANCES` is: every list here was read on
 * 2026-10-01 and every dossier number it prints came out as a row — Marseille
 * 1 874 under review and 825 granted, Nîmes 348 under review and 321 decided.
 * Both hosts' `robots.txt` let a robot read the pages and the files.
 *
 * `communes` is every code the BAN may answer for the city: Marseille's
 * sixteen arrondissements as well as the commune, as for Paris's portal.
 * `link` is matched against a link's words and its address together.
 */
export const PERMIT_LISTS = Object.freeze([
  Object.freeze({
    key: 'marseille',
    insee: '13055',
    label: 'Ville de Marseille — autorisations d’urbanisme en cours et délivrées', // i18n-ignore-line — the publisher and its lists
    page: 'https://www.marseille.fr/logement-urbanisme/plan-local-durbanisme/renseignements-durbanisme',
    lists: Object.freeze([
      // i18n-ignore-start — the words of the city's own links, matched on
      Object.freeze({ board: 'filings', layout: 'register', link: /dossiers en cours d.instruction/i }),
      Object.freeze({ board: 'decisions', layout: 'decisions', link: /autorisations d[ée]livr[ée]es/i }),
      // i18n-ignore-end
    ]),
  }),
  Object.freeze({
    key: 'nimes',
    insee: '30189',
    label: 'Ville de Nîmes — registre des dossiers en cours', // i18n-ignore-line — the publisher and its list
    page: 'https://www.nimes.fr/mon-quotidien/urbanisme/autorisations-durbanisme',
    lists: Object.freeze([
      Object.freeze({ board: 'filings', layout: 'register', link: /registre_dossiers/i }),
    ]),
  }),
]);

/**
 * The city publishing lists for this commune, or null. An arrondissement code
 * finds its city.
 * @param {?string} communeCode
 * @returns {?object} One of {@link PERMIT_LISTS}.
 */
export function permitListFor(communeCode) {
  const code = foldToCommune(communeCode);
  if (!code) return null;
  return PERMIT_LISTS.find((city) => city.insee === code) ?? null;
}

/** @param {object} city @returns {string} */
export function permitListRobotsUrl(city) {
  return `${new URL(city.page).origin}/robots.txt`;
}

/** The few entities a link's words carry on these pages. */
const ENTITIES = Object.freeze({
  amp: '&', nbsp: ' ', quot: '"', apos: '\'', lt: '<', gt: '>', rsquo: '’', eacute: 'é', egrave: 'è', // i18n-ignore-line — HTML entity names and the characters they stand for
});

function decodeEntities(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X'
        ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * The PDF each of a city's lists is published as today.
 *
 * Every `<a href>` of the page whose address is a PDF, matched by its words
 * and its address together; the first link that matches a list is that list.
 * Null when any list is missing — all or none, as a commune's boards are: a
 * page served without the list of decisions would read as a city that had
 * stopped deciding.
 *
 * @param {object} city One of {@link PERMIT_LISTS}.
 * @param {string} html The page.
 * @returns {?Array<{board: string, layout: string, url: string}>}
 */
export function permitListLinks(city, html) {
  const anchors = [];
  const pattern = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html ?? '').matchAll(pattern)) {
    const href = decodeEntities(match[1] ?? match[2] ?? '').trim();
    let url;
    try { url = new URL(href, city.page); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || !/\.pdf$/i.test(url.pathname)) continue;
    const words = text(decodeEntities(match[3].replace(/<[^>]*>/g, ' '))) ?? '';
    anchors.push({ url: url.href, words: `${words} ${decodeURIComponent(url.pathname)}` });
  }
  const out = [];
  for (const list of city.lists) {
    const found = anchors.find((anchor) => list.link.test(anchor.words));
    if (!found) return null;
    out.push({ board: list.board, layout: list.layout, url: found.url });
  }
  return out;
}

// --- Reading a table out of positioned text --------------------------------

/**
 * A dossier number as the lists print it: family, the commune's six digits,
 * the year, the counter, and a modification's or transfer's suffix, written
 * apart at Nîmes (`PC 030189 06 P0166 M01`) and joined at Marseille
 * (`PC 013055 25 00123M01`).
 */
const DOSSIER_RE = /^(PC|DP|PA|PD|CU)\s+(\d{6})\s+(\d{2})\s+([A-Z0-9]{4,10})(?:\s+([MT]\d{1,2}))?$/i;

/** `Page 3/199`: a page's footer, never a cell. */
const PAGE_FOOTER_RE = /^page\s+\d+\s*\/\s*\d+$/i;

/** The record's anchor in a register: `Déposé le 03/08/2026`. */
// i18n-ignore-next-line — the software's own label, matched on
const FILED_RE = /^d[ée]pos[ée] le (\d{2}\/\d{2}\/\d{4})$/i;

/**
 * Every page's runs, and a test for its furniture: the `Page n/N` line is
 * dropped outright, and any text printed at the same height on four pages in
 * five of a file of three pages or more — the service's name and the edition
 * date in a footer, which are on every page — is furniture. The test is only
 * ever asked of what lies BELOW a page's last record, and that is the second
 * guard rather than the first: a cell can repeat too, and the commonest do —
 * the first row of Marseille's list of decisions sits at the same height on
 * every page, and « Accord Tacite » is its verdict on half of them.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @returns {{pages: Array<Array<object>>, furniture: (run: object) => boolean}}
 */
function pageRuns(document) {
  const pages = (document?.pages ?? []).map((page) => (page.runs ?? [])
    .filter((run) => !PAGE_FOOTER_RE.test(text(run.text) ?? '')));
  const keyOf = (run) => `${Math.round(run.y)}\u0001${run.text}`;
  if (pages.length < 3) return { pages, furniture: () => false };
  const seen = new Map();
  for (const runs of pages) {
    for (const key of new Set(runs.map(keyOf))) seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const repeated = new Set([...seen].filter(([, count]) => count >= 0.8 * pages.length).map(([key]) => key));
  return { pages, furniture: (run) => repeated.has(keyOf(run)) };
}

/**
 * A `YYYY-MM-DD` day a list could mean, or null. Nîmes prints one decision
 * as taken on `09/04/2201`.
 * @param {?string} value `dd/mm/yyyy`.
 */
function listDay(value) {
  const day = cartdsDate(value);
  const year = day ? Number(day.slice(0, 4)) : 0;
  return year >= 1970 && year <= 2100 ? day : null;
}

/**
 * A register's decision cell: `Rejet tacite le 26/07/2026`, `retiré le
 * 23/07/2026`, `[reprise]Dossier irrecevable le 09/04/2201` — the
 * software's own note of a dossier migrated from an older one dropped.
 *
 * @param {Array<string>} cellLines
 * @returns {{verdict: ?string, decidedOn: ?string}}
 */
export function registerDecision(cellLines) {
  const value = text(cellLines.join(' '))?.replace(/^\[[^\]]*\]\s*/, '') ?? null;
  if (!value) return { verdict: null, decidedOn: null };
  const match = /^(.*?)\s*\ble\s+(\d{2}\/\d{2}\/\d{4})$/i.exec(value);
  return match
    ? { verdict: text(match[1]), decidedOn: listDay(match[2]) }
    : { verdict: value, decidedOn: null };
}

/**
 * The header row of a page: the runs that carry the expected column names.
 *
 * @param {Array<object>} runs
 * @param {Array<[string, string]>} columns `[field, header words]`, in page order.
 * @returns {?{top: number, bottom: number, columns: Array<{field: string, x: number, centre: number}>}}
 *   Null when a column's header is missing from the page.
 */
function headerOf(runs, columns) {
  const found = [];
  for (const [field, words] of columns) {
    const run = runs.find((candidate) => fold(candidate.text) === words);
    if (!run) return null;
    const right = Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x;
    found.push({ field, x: run.x, centre: (run.x + right) / 2, y: run.y });
  }
  return {
    top: Math.max(...found.map((column) => column.y)),
    bottom: Math.min(...found.map((column) => column.y)),
    columns: found.sort((a, b) => a.x - b.x),
  };
}

/** A column's lines, top to bottom, as text. */
function lines(runs) {
  return [...runs]
    .sort((a, b) => (b.y - a.y) || (a.x - b.x))
    .map((run) => run.text);
}

/** `77`, `1 865`, `194,07` → a number, or null. */
function number(value) {
  const raw = String(value ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
}

/** `superficie : 1865 m²` anywhere in a record. */
// i18n-ignore-next-line — the software's own label, matched on
const LAND_RE = /^superficie\s*:\s*([\d\s.,]+?)\s*m(?:²|2)?$/i;
/** `nombre de logements : 2`. */
// i18n-ignore-next-line — the software's own label, matched on
const HOUSING_RE = /^nombre de logements\s*:\s*(\d+)$/i;
/** `Arrondissement : 1`, Marseille's own line under the site. */
// i18n-ignore-next-line — the software's own label, matched on
const DISTRICT_RE = /^arrondissement\s*:/i;

/**
 * A site, as the register prints it over two or three lines:
 * `65 La canebière801` / `13001 Marseille`, or `Chemin du Mas de Cheylon` /
 * `Nîmes` with no postcode at all.
 *
 * @param {Array<string>} siteLines
 * @returns {{address: ?string, postcode: ?string, locality: ?string}}
 */
export function registerSite(siteLines) {
  const kept = siteLines.filter((line) => !DISTRICT_RE.test(line) && !LAND_RE.test(line));
  const at = kept.findIndex((line) => /^\d{5}\b/.test(line));
  if (at > 0) {
    const [, postcode, locality] = /^(\d{5})\s*(.*)$/.exec(kept[at]);
    return { address: text(kept.slice(0, at).join(' ')), postcode, locality: text(locality) };
  }
  if (kept.length > 1 && !/\d/.test(kept.at(-1))) {
    return { address: text(kept.slice(0, -1).join(' ')), postcode: null, locality: text(kept.at(-1)) };
  }
  return { address: text(kept.join(' ')), postcode: null, locality: null };
}

/** A legal form alone on its line, its name on the next (`SCI` / `VIEUX PORT`). */
const BARE_FORM_RE = /^(?:s\.?a\.?s\.?u?\.?|s\.?a\.?r\.?l\.?|s\.?c\.?i\.?|s\.?n\.?c\.?|e\.?u\.?r\.?l\.?|sccv|sa|soci[ée]t[ée]|ste)$/i;
/** Where an address starts on a name's line: a house number, or a street. */
// i18n-ignore-next-line — French street words, matched on
const ADDRESS_START_RE = /\s(?:\d{1,5}(?:\s?(?:bis|ter|[a-z]))?\s|(?:rue|avenue|av|bd|boulevard|chemin|place|impasse|route|all[ée]e|quai|cours|lieu-dit|za|zi|zac)\s)/i;
/** A person named after an organisation: `SCI A, SCI B, M.` / `X Patrick`. */
// i18n-ignore-next-line — civilities, matched on
const PERSON_TAIL_RE = /[,;]\s*(?:m|mme|mr|mlle|monsieur|madame)\b\.?.*$/i;

/**
 * The applicant's NAME out of a DEMANDEUR cell, never the address under it.
 *
 * Only the first line, or the first two when the first is a bare legal form;
 * cut where an address starts on the same line (Nîmes writes a company's name
 * and its street on one line) and before a person named after an organisation. What comes
 * out still goes through `organisationApplicant` before it is kept (Trap 4).
 *
 * @param {Array<string>} cellLines
 * @returns {?string}
 */
export function registerApplicant(cellLines) {
  const [first, second] = cellLines;
  let name = text(first);
  if (!name) return null;
  if (BARE_FORM_RE.test(name) && text(second)) name = `${name} ${text(second)}`;
  const address = ADDRESS_START_RE.exec(` ${name} `);
  if (address) name = ` ${name} `.slice(0, address.index);
  return text(name.replace(PERSON_TAIL_RE, ''));
}

/** The register's columns; the last one is LIMITE or DÉCISION (Trap 1). */
const REGISTER_COLUMNS = Object.freeze([
  ['dossier', 'DOSSIER'], ['dates', 'DATES'], ['applicant', 'DEMANDEUR'],
  ['site', 'TERRAIN'], ['information', 'INFORMATIONS'],
]);

/**
 * The register of dossiers, one row per record (Trap 1).
 *
 * The software prints two registers in this layout, and Nîmes puts both in
 * one file: the dossiers under review, whose last column is the deadline
 * (LIMITE), and the dossiers decided, whose last column is the decision
 * (DÉCISION) — refusals and withdrawals included. A row of the second says
 * so with `board: 'decisions'`.
 *
 * Columns by their header: a run belongs to the first column whose header
 * starts to its right, because every cell is written from its column's left
 * edge and every header is centred over it. Records by their anchor: each
 * starts on its « Déposé le » line and runs down to the next one's, cut at the
 * first empty stretch of more than two lines. Inside a record the widest
 * stretch is exactly two — the line left blank over the dossier number, when
 * no other column reaches it.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document From `extractPdfText`.
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw, each
 *   with the `board` it belongs to.
 */
export function readRegisterList(document) {
  const rows = [];
  const { pages, furniture } = pageRuns(document);
  for (const runs of pages) {
    const decisions = headerOf(runs, [...REGISTER_COLUMNS, ['decision', 'DECISION']]);
    const header = decisions ?? headerOf(runs, [...REGISTER_COLUMNS, ['limit', 'LIMITE']]);
    if (!header) continue;
    const below = runs.filter((run) => run.y < header.bottom - 1);
    const anchors = below.filter((run) => FILED_RE.test(run.text)).sort((a, b) => b.y - a.y);
    const lowest = anchors.at(-1)?.y ?? -Infinity;
    const body = below.filter((run) => run.y >= lowest || !furniture(run));
    const columnOf = (run) => (header.columns.find((column) => column.x > run.x + 0.5)
      ?? header.columns.at(-1)).field;
    anchors.forEach((anchor, i) => {
      const floor = anchors[i + 1]?.y ?? -Infinity;
      const band = body.filter((run) => run.y <= anchor.y + 0.5 && run.y > floor + 0.5)
        .sort((a, b) => b.y - a.y);
      const kept = [];
      for (const run of band) {
        const previous = kept.at(-1);
        if (previous && previous.y - run.y > 2.6 * (run.size || 7)) break;
        kept.push(run);
      }
      const cells = { dossier: [], dates: [], applicant: [], site: [], information: [], limit: [], decision: [] };
      for (const run of kept) cells[columnOf(run)].push(run);
      const dossierLines = lines(cells.dossier);
      const dossier = dossierLines.find((line) => DOSSIER_RE.test(line));
      if (!dossier) return;
      const all = lines(kept);
      const land = all.map((line) => LAND_RE.exec(line)).find(Boolean);
      const housing = all.map((line) => HOUSING_RE.exec(line)).find(Boolean);
      const site = registerSite(lines(cells.site));
      const decision = decisions ? registerDecision(lines(cells.decision)) : null;
      rows.push({
        board: decisions ? PERMIT_LIST_BOARDS.decisions : PERMIT_LIST_BOARDS.filings,
        dossier: text(dossier),
        label: text(dossierLines.filter((line) => line !== dossier).join(' ')),
        purpose: null,
        applicant: registerApplicant(lines(cells.applicant)),
        address: site.address,
        postcode: site.postcode,
        locality: site.locality,
        filedOn: listDay(FILED_RE.exec(anchor.text)[1]),
        verdict: decision?.verdict ?? null,
        decidedOn: decision?.decidedOn ?? null,
        postedOn: null,
        landArea: land ? String(number(land[1]) ?? '') || null : null,
        housing: housing ? housing[1] : null,
        lots: null,
        floorArea: null,
      });
    });
  }
  return rows;
}

/** Marseille's list of granted authorisations: header words, in page order. */
const DECISION_COLUMNS = Object.freeze([
  ['postcode', 'CODE POSTAL'], ['dossier', 'DOSSIER'], ['address', 'ADRESSE'],
  ['purpose', 'NATURE TRAVAUX'], ['applicant', 'DEMANDEUR'], ['filedOn', 'DATE DEPOT'],
  ['verdict', 'AVIS DECISION'], ['decidedOn', 'DATE DECISION'], ['postedOn', 'AFFICHAGE'],
  ['housing', 'LOGEMENTS CREES'], ['lots', 'LOTS PROJETS'], ['floorArea', 'SDP'],
  ['competence', 'COMPETENCE'],
]);

/** A cell's text, the spreadsheet's trailing full stops cleaned off. */
function cellText(cellRuns) {
  const value = text(lines(cellRuns).join(' '));
  return value ? text(value.replace(/(?:\s*\.)+$/, '').replace(/\s+([.,)])/g, '$1')) : null;
}

/** `102 rue Grignan 13001` → the street and the postcode. */
function splitPostcode(value) {
  const match = /^(.*?)\s*\b(\d{5})$/.exec(String(value ?? '').trim());
  return match ? { address: text(match[1]), postcode: match[2] } : { address: text(value), postcode: null };
}

/**
 * A list of decisions laid out as a spreadsheet, one row per dossier (Trap 1).
 *
 * Columns by their header: a run belongs to the column whose header is
 * centred nearest its own centre, because both are centred. Rows by their
 * dossier number: every cell of a row is centred on the row's middle, so each
 * line belongs to the nearest number — a cell of seven lines reaches three
 * lines up and three down, and the next row starts past its own half-height.
 * Below a page's last row, a line further down than that row reaches up is
 * the page's footer, not the row's.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document From `extractPdfText`.
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw, each
 *   with `board: 'decisions'`.
 */
export function readDecisionTable(document) {
  const rows = [];
  const { pages, furniture } = pageRuns(document);
  for (const runs of pages) {
    const header = headerOf(runs, DECISION_COLUMNS);
    if (!header) continue;
    const centreOf = (run) => (run.x + (Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x)) / 2;
    const columnOf = (run) => {
      const centre = centreOf(run);
      let best = header.columns[0];
      for (const column of header.columns) {
        if (Math.abs(column.centre - centre) < Math.abs(best.centre - centre)) best = column;
      }
      return best.field;
    };
    const below = runs.filter((run) => run.y < header.bottom - 1);
    const anchors = below.filter((run) => columnOf(run) === 'dossier' && DOSSIER_RE.test(text(run.text) ?? ''))
      .sort((a, b) => b.y - a.y);
    if (!anchors.length) continue;
    const body = below.filter((run) => run.y >= anchors.at(-1).y || !furniture(run));
    const members = anchors.map(() => []);
    for (const run of body) {
      if (anchors.includes(run)) continue;
      let at = 0;
      for (let i = 1; i < anchors.length; i += 1) {
        if (Math.abs(anchors[i].y - run.y) < Math.abs(anchors[at].y - run.y)) at = i;
      }
      members[at].push(run);
    }
    const last = anchors.length - 1;
    const reach = Math.max(0, ...members[last].filter((run) => run.y > anchors[last].y)
      .map((run) => run.y - anchors[last].y));
    members[last] = members[last].filter((run) => run.y >= anchors[last].y
      || anchors[last].y - run.y <= reach + 0.6 * (run.size || 6));
    anchors.forEach((anchor, i) => {
      const cells = {};
      for (const run of members[i]) (cells[columnOf(run)] ??= []).push(run);
      const value = (field) => cellText(cells[field] ?? []);
      const site = splitPostcode(value('address'));
      const postcode = /^\d{5}$/.test(value('postcode') ?? '') ? value('postcode') : site.postcode;
      rows.push({
        board: PERMIT_LIST_BOARDS.decisions,
        dossier: text(anchor.text),
        label: null,
        purpose: value('purpose'),
        applicant: text(lines(cells.applicant ?? [])[0]),
        address: site.address,
        postcode,
        locality: null,
        filedOn: listDay(value('filedOn')),
        verdict: value('verdict'),
        decidedOn: listDay(value('decidedOn')),
        postedOn: listDay(value('postedOn')),
        landArea: null,
        housing: number(value('housing')) === null ? null : value('housing'),
        lots: number(value('lots')) === null ? null : value('lots'),
        floorArea: number(value('floorArea')) === null ? null : value('floorArea'),
      });
    });
  }
  return rows;
}

/** The readers, by the `layout` a list names. */
export const PERMIT_LIST_READERS = Object.freeze({
  register: readRegisterList,
  decisions: readDecisionTable,
});

// --- Keeping and normalising -----------------------------------------------

/**
 * The fields of a list row that are kept, in a fixed order — the archive's
 * `cells`. Both layouts are read into the same fields, each leaving blank what
 * it does not print.
 */
export const PERMIT_LIST_FIELDS = Object.freeze([
  'dossier', 'label', 'purpose', 'applicant', 'address', 'postcode', 'locality',
  'filedOn', 'verdict', 'decidedOn', 'postedOn', 'landArea', 'housing', 'lots', 'floorArea',
]);

/** Where the applicant sits in the stored cells. */
const APPLICANT_CELL = PERMIT_LIST_FIELDS.indexOf('applicant');

/**
 * One list row as it may be stored, or null for a row that may not be.
 *
 * TRAP 4 before anything is written: the applicant filtered. A row whose
 * number is not a building authorisation's is not kept at all.
 *
 * @param {object|Array<?string>} input One row from a reader, or cells
 *   already kept — scrubbed again, so the archive's own test holds for both.
 * @returns {?Array<?string>}
 */
export function scrubPermitListRow(input) {
  const row = Array.isArray(input)
    ? Object.fromEntries(PERMIT_LIST_FIELDS.map((field, i) => [field, input[i] ?? null]))
    : input;
  if (!row || typeof row !== 'object') return null;
  if (!DOSSIER_RE.test(text(row.dossier) ?? '') || !cartdsKind(row.dossier)) return null;
  const cells = PERMIT_LIST_FIELDS.map((field) => {
    const value = row[field];
    return value === null || value === undefined ? null : String(value);
  });
  cells[APPLICANT_CELL] = organisationApplicant(cells[APPLICANT_CELL]);
  return cells;
}

/**
 * What a published verdict means, on the shared ladder.
 *
 * The words counted on 2026-10-01: Marseille's `Accord Tacite`, `Favorable
 * avec Reserves`, `Favorable`; Nîmes's same three and `Defavorable`, `Rejet
 * tacite`, `retiré`, `Dossier irrecevable`. Cart@DS's reader takes every one
 * but `retiré`, a dossier its applicant withdrew — closed, like `Retrait`.
 *
 * @param {?string} verdict
 * @returns {?string} `accorde`, `refuse`, `annule`, or null.
 */
export function permitListVerdictState(verdict) {
  const state = cartdsVerdictState(verdict);
  if (state) return state;
  // i18n-ignore-next-line — the software's own verdict, matched on
  return /^retir[ée]/i.test(String(verdict ?? '').trim()) ? 'annule' : null;
}

/**
 * What the archive needs to keep a city's lists: which lists a row may come
 * from, and how a row is scrubbed. Handed to `createCartdsArchiveStore`.
 */
export const PERMIT_LIST_ROWS = Object.freeze({
  board: (board) => Object.hasOwn(PERMIT_LIST_BOARDS, board),
  scrub: scrubPermitListRow,
});

/**
 * A printed number as the layer keys it, or null (Trap 5).
 *
 * @param {?string} raw `PC 013055 26 00230P0`, `PC 030189 06 P0166 M01`.
 * @returns {?{kind: string, digits: string}} `digits` as Sitadel writes them,
 *   without the family: `0130552600230`, `03018906P0166M01`.
 */
export function permitListDossier(raw) {
  const match = DOSSIER_RE.exec(text(raw) ?? '');
  if (!match) return null;
  const [, kind, commune, year, counter, suffix] = match;
  const count = counter.toUpperCase().replace(/^(\d{5})P0$/, '$1');
  return { kind: kind.toUpperCase(), digits: `${commune}${year}${count}${(suffix ?? '').toUpperCase()}` };
}

/**
 * What a register's label says beyond the family it repeats, or null.
 *
 * The label is the form the dossier was filed on and the step it is at:
 * `PERMIS DE CONSTRUIRE DE MAISON INDIVIDUELLE (Initial)`, `DÉCLARATION
 * PRÉALABLE AMÉNAGEMENT (Initiale)`, `PERMIS DE CONSTRUIRE (Modificatif)`. A
 * house, a division of land and a modification are worth a card's line; the
 * original filing is the default and says nothing. Nor does `CONSTRUCTION`,
 * the general form for works that need no permit — a façade, a window, a
 * fence — and printed as the nature it would read as a building that is not
 * there: 590 of Marseille's 1 874 dossiers under review carry it.
 *
 * @param {?string} label
 * @returns {?string}
 */
function registerPurpose(label) {
  const value = text(label);
  if (!value) return null;
  // i18n-ignore-start — the software's own form and step words, matched on
  const step = /\(\s*([^)]*?)\s*\)/.exec(value)?.[1] ?? '';
  const form = text(value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^(?:d[ée]claration pr[ée]alable|permis de (?:construire|d[ée]molir|am[ée]nager)|certificat d.urbanisme)\s*/i, '')
    .replace(/^de\s+/i, ''));
  const parts = [
    form && !/^construction$/i.test(form) ? form : null,
    step && !/^initiale?$/i.test(step) ? step : null,
  ].filter(Boolean);
  // i18n-ignore-end
  return parts.length ? parts.join(', ').toLowerCase() : null;
}

/**
 * One list row → the shape every source of the layer is normalised into.
 *
 * Takes the row as a reader gives it, or as the archive stores it (an array of
 * {@link PERMIT_LIST_FIELDS}); both go through {@link scrubPermitListRow}
 * first, so a person's name cannot get through either way.
 *
 * @param {object} city One of {@link PERMIT_LISTS}.
 * @param {string} board A key of {@link PERMIT_LIST_BOARDS}.
 * @param {object|Array<?string>} input
 * @param {{current?: boolean}} [options] `current`: the row is on the edition
 *   read last (Trap 3).
 * @returns {?object} Null for a row that is not a building authorisation.
 */
export function normalisePermitListRow(city, board, input, { current = false } = {}) {
  const cells = Array.isArray(input) ? input : scrubPermitListRow(input);
  if (!cells) return null;
  const row = Object.fromEntries(PERMIT_LIST_FIELDS.map((field, i) => [field, cells[i] ?? null]));
  const parsed = permitListDossier(row.dossier);
  if (!parsed) return null;
  const { kind, digits } = parsed;
  const series = seriesOfKind(kind);
  const kindLabel = ADS_KINDS[kind] ?? kind;
  const decided = board === PERMIT_LIST_BOARDS.decisions;
  const verdict = text(row.verdict);
  const verdictState = decided ? permitListVerdictState(verdict) : null;
  let state = 'depose';
  let stateLabel = stateFrench('depose');
  if (decided) {
    state = verdictState ?? 'depose';
    // A verdict off the ladder keeps its own words, as on a posted board.
    stateLabel = verdictState ? stateFrench(verdictState) : (verdict ?? stateLabel);
  } else if (current) {
    state = 'instruction';
    stateLabel = stateFrench('instruction');
  }
  const housing = number(row.housing);
  return {
    id: `permit-list:${city.key}:${kind}${digits}`,
    dossier: formatDossier(kind, digits),
    series,
    key: `${series}|${dossierKey(digits)}`,
    kind,
    kindLabel,
    state,
    stateLabel,
    depositedOn: text(row.filedOn),
    decidedOn: decided ? text(row.decidedOn) : null,
    postedOn: decided ? text(row.postedOn) : null,
    startedOn: null,
    completedOn: null,
    depositYear: null,
    applicant: organisationApplicant(row.applicant),
    purpose: text(row.purpose) ?? registerPurpose(row.label) ?? kindLabel,
    address: text(row.address),
    postcode: text(row.postcode),
    commune: null,
    communeCode: city.insee,
    cadastreCommune: city.insee,
    parcels: [],
    parcelIdus: [],
    landAreaM2: number(row.landArea),
    housing: housing && housing > 0 ? housing : null,
    surfaceCreatedM2: number(row.floorArea),
    lots: number(row.lots),
    lon: null,
    lat: null,
    precision: null,
    geocodeScore: null,
    parts: null,
    source: 'permit-list',
    sourceLabel: city.label,
  };
}
