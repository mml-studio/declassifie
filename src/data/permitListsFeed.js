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
 * ── Trap 6: some cities publish their lists as acts ─────────────────────────
 * Lyon and Béziers post no link to a list: they publish each one as an act on
 * Digitech's Webdelib+ platform, one page per month of acts. A reading walks
 * the months back ({@link webdelibMonths}), keeps the acts whose titles a
 * list names ({@link webdelibLists}) and opens each through the script
 * redirect the platform writes ({@link webdelibFileUrl}). The layouts are two
 * more: Lyon writes records in Word, not a table ({@link readLyonList}), and
 * Béziers exports grids whose cells hang from the top of their row ({@link
 * readGridTable}).
 *
 * ── Trap 7: Lyon's platform forbids robots ─────────────────────────────────
 * `lyon-webdelib.digitechcloud.fr/robots.txt` is `Disallow: /` for every
 * agent (2026-10-01). Lyon is read by the project's decision, as five Cart@DS
 * hosts are (Trap 5 of `cartdsFeed.js`), and says so with `robots:
 * 'overridden'`: what it publishes there is the posting the Code de
 * l'urbanisme makes public, and the platform sets no barrier — no login, no
 * challenge, no cookie.
 *
 * Dependency-free and side-effect-free (no Cesium, no DOM, no fetch): link
 * discovery, table reading and normalisation only. The `/api/ads-fr` proxy and
 * `scripts/lib/permitLists.mjs` import it; nothing in the browser bundle does.
 */

import { foldToCommune } from './communeCode.js';
import { organisationApplicant } from './permitApplicant.js';
import { ADS_KINDS, dossierKey, formatDossier, seriesOfKind } from './adsFeed.js';
import { ADS_STATE_WORDS } from './adsFeed.i18n.js';
import {
  CARTDS_LICENCE, cartdsDate, cartdsKind, cartdsParcelIdus, cartdsProject, cartdsVerdictState, parseCartdsPlace,
} from './cartdsFeed.js';

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
 * 1 874 under review and 825 granted, Nîmes 348 under review and 321 decided,
 * ten files of Lyon's (2 006 numbers) and four of Béziers's (531). Every host
 * but Lyon's lets a robot read the pages and the files (Trap 7).
 *
 * `source` says how the lists are found: absent, from the links of `page`;
 * `webdelib`, as acts on a Webdelib+ platform (Trap 6). `underReview` says the
 * list of filings is a list of dossiers still under review (Trap 3).
 *
 * `communes` is every code the BAN may answer for the city: Marseille's
 * sixteen arrondissements as well as the commune, as for Paris's portal.
 * `link` is matched against a link's words and its address together.
 */
export const PERMIT_LISTS = Object.freeze([
  Object.freeze({
    key: 'marseille',
    insee: '13055',
    underReview: true,
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
    underReview: true,
    label: 'Ville de Nîmes — registre des dossiers en cours', // i18n-ignore-line — the publisher and its list
    page: 'https://www.nimes.fr/mon-quotidien/urbanisme/autorisations-durbanisme',
    lists: Object.freeze([
      Object.freeze({ board: 'filings', layout: 'register', link: /registre_dossiers/i }),
    ]),
  }),
  Object.freeze({
    key: 'lyon',
    insee: '69123',
    label: 'Ville de Lyon — autorisations d’urbanisme déposées et délivrées', // i18n-ignore-line — the publisher and its lists
    page: 'https://lyon-webdelib.digitechcloud.fr/webdelibplus_Central/jsp/summary_orders.jsp?role=usager',
    // `Disallow: /` for every agent on 2026-10-01. Read by the project's
    // decision of that day, as five Cart@DS hosts are: what is read is the
    // legal posting of the Code de l'urbanisme (art. R.423-6, R.424-15).
    robots: 'overridden',
    source: Object.freeze({
      kind: 'webdelib',
      base: 'https://lyon-webdelib.digitechcloud.fr/webdelibplus_Central',
      tab: 'summary_orders',
    }),
    lists: Object.freeze([
      // i18n-ignore-next-line — the titles of the city's own acts, matched on
      Object.freeze({ layout: 'lyon', title: /droit des sols|d[ée]clarations pr[ée]alables d[ée]pos[ée]es pendant/i }),
    ]),
  }),
  Object.freeze({
    key: 'beziers',
    insee: '34032',
    label: 'Ville de Béziers — dossiers d’urbanisme déposés et décidés', // i18n-ignore-line — the publisher and its lists
    page: 'https://actes.beziers.fr/webdelibplus/jsp/legal.jsp?role=usager',
    source: Object.freeze({
      kind: 'webdelib',
      base: 'https://actes.beziers.fr/webdelibplus',
      tab: 'legal',
    }),
    lists: Object.freeze([
      // i18n-ignore-start — the titles of the city's own documents, matched on
      // A list of filed dossiers holds every one still open (« déposés avant
      // le … »): the newest of each family says everything the older ones did.
      Object.freeze({ board: 'filings', layout: 'grid', title: /^d[ée]p[ôo]t\s+(PC|DP|PA|PD)\b/i, latest: true }),
      Object.freeze({ board: 'decisions', layout: 'grid', title: /^(PC|DP|PA|PD)\s+d[ée]cid[ée]e?s\b/i }),
      // i18n-ignore-end
    ]),
  }),
  Object.freeze({
    key: 'aix',
    insee: '13001',
    underReview: true,
    label: 'Ville d’Aix-en-Provence — dossiers d’urbanisme déposés et délivrés', // i18n-ignore-line — the publisher and its lists
    page: 'https://sig2aix.mairie-aixenprovence.fr/arcopolepro/resources/jsp/aixenprovence/urbanisme/ADS/view.jsp',
    // Esri's ArcOpole application, one page holding both tables.
    source: Object.freeze({ kind: 'arcopole' }),
    lists: Object.freeze([]),
  }),
  Object.freeze({
    key: 'argenteuil',
    insee: '95018',
    label: 'Ville d’Argenteuil — autorisations d’urbanisme déposées et décidées', // i18n-ignore-line — the publisher and its lists
    page: 'https://datahall.mydigilor.fr/web/',
    source: Object.freeze({
      kind: 'digilor',
      base: 'https://datahall.mydigilor.fr',
      app: 133,
      // « URBANISME / DÉV. DURABLE », and its filings' and decisions' shelves.
      category: 1882,
      filings: 2170,
      decisions: 2172,
    }),
    lists: Object.freeze([Object.freeze({ layout: 'grid' })]),
  }),
  Object.freeze({
    key: 'mulhouse',
    insee: '68224',
    label: 'Ville de Mulhouse — dossiers d’urbanisme déposés et délivrés', // i18n-ignore-line — the publisher and its lists
    page: 'https://www.mulhouse.fr/mes-demarches/proprietaire-locataire/permis-de-construire/',
    lists: Object.freeze([
      // i18n-ignore-start — the words of the city's own links, matched on
      // Every edition covers only the weeks since the one before: all are read.
      Object.freeze({ board: 'filings', layout: 'grid', link: /d[ée]pos[ée]s\s+(?:jusqu|avant)/i, all: true }),
      Object.freeze({ board: 'decisions', layout: 'grid', link: /(?:d[ée]livr[ée]s|d[ée]cid[ée]s)\s+jusqu/i, all: true }),
      // i18n-ignore-end
    ]),
  }),
  Object.freeze({
    key: 'annecy',
    insee: '74010',
    underReview: true,
    label: 'Ville d’Annecy — demandes déposées et autorisations délivrées', // i18n-ignore-line — the publisher and its lists
    page: 'https://www.annecy.fr/ville/amenagement/urbanisme',
    // The page is a JavaScript shell; its content is served as JSON.
    source: Object.freeze({ kind: 'typo3', api: 'https://www.annecy.fr/api/ville/amenagement/urbanisme' }),
    lists: Object.freeze([
      // i18n-ignore-start — the headings of the city's own download blocks
      Object.freeze({ board: 'filings', layout: 'annecy-filings', link: /demandes d[ée]pos[ée]es/i }),
      Object.freeze({ board: 'decisions', layout: 'annecy-decisions', link: /autorisations d[ée]livr[ée]es/i }),
      // i18n-ignore-end
    ]),
  }),
  Object.freeze({
    key: 'clermont',
    insee: '63113',
    underReview: true,
    label: 'Ville de Clermont-Ferrand — autorisations d’urbanisme déposées et décidées', // i18n-ignore-line — the publisher and its lists
    page: 'https://clermont-ferrand.fr/informations-legales-durbanisme',
    // The host sends its certificate without the Sectigo intermediate that
    // signed it, as the `pemb.fr` boards do: the reader supplies it
    // (`trustCartdsIntermediates`).
    intermediate: 'sectigo-ov-r36',
    lists: Object.freeze([
      // i18n-ignore-start — the words of the city's own links, matched on
      Object.freeze({ board: 'decisions', layout: 'clermont', link: /d[ée]cid[ée]es|affichage d[ée]cisions/i }),
      // The filings' link answered 404 on 2026-10-01: a missing list of
      // filings leaves the decisions to be read.
      Object.freeze({ board: 'filings', layout: 'clermont', link: /d[ée]pos[ée]es|affichage d[ée]p[ôo]ts/i, optional: true }),
      // i18n-ignore-end
    ]),
  }),
  Object.freeze({
    key: 'versailles',
    insee: '78646',
    label: 'Ville de Versailles — registres des autorisations d’urbanisme déposées et décidées', // i18n-ignore-line — the publisher and its lists
    page: 'https://drive.google.com/embeddedfolderview?id=0B2R5I00QUlOKUTlya2RCUGpQWFE',
    // Drive's robots.txt disallows a folder's listing and a file's download;
    // read by the project's decision, as Lyon's platform is: the folder is the
    // one the city's urbanism page links, « Tous les dossiers déposés et
    // acceptés par année ».
    robots: 'overridden',
    // A folder per year, in each a folder per board — their names typed by
    // hand: `Dossiers déposés`, ` dossiers déposés`, `Dossiers acceptés`.
    source: Object.freeze({ kind: 'drive', root: '0B2R5I00QUlOKUTlya2RCUGpQWFE' }),
    lists: Object.freeze([
      // i18n-ignore-start — the city's own folder names, matched on
      Object.freeze({ board: 'filings', layout: 'versailles', folder: /d[ée]pos/i }),
      Object.freeze({ board: 'decisions', layout: 'versailles', folder: /d[ée]cid|accept/i }),
      // i18n-ignore-end
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

// --- Webdelib+: a month of published acts per page --------------------------

/**
 * The months a reading of a Webdelib+ city covers, newest first: this month
 * and the `count - 1` before it.
 * @param {string} day `YYYY-MM-DD`.
 * @param {number} count
 * @returns {Array<{year: number, month: number}>}
 */
export function webdelibMonths(day, count) {
  const [year, month] = String(day).split('-').map(Number);
  const out = [];
  for (let i = 0; i < Math.max(1, count); i += 1) {
    const index = year * 12 + (month - 1) - i;
    out.push({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  }
  return out;
}

/**
 * One month's page of a city's acts: Digitech's Webdelib+ lists what was
 * published in a month, `date=MM-YYYY`, one tab per kind of act.
 * @param {object} city A city whose `source.kind` is `webdelib`.
 * @param {{year: number, month: number}} month
 * @returns {string}
 */
export function webdelibMonthUrl(city, { year, month }) {
  return `${city.source.base}/jsp/${city.source.tab}.jsp?role=usager&date=${String(month).padStart(2, '0')}-${year}`;
}

/**
 * The acts of one month's page: title, the address that opens the file, and
 * the day it was published.
 *
 * Each act is a `tableActe` cell — Lyon writes the title before an « Arrêté »
 * link, Béziers makes the title the link — followed by the act's date and its
 * publication date. The link's `pdf` parameter is a token that stays the same
 * from one session to the next (checked 2026-10-01), so an act's address is
 * its identity.
 *
 * @param {string} html
 * @param {string} pageUrl The page's own address, to resolve the links.
 * @returns {Array<{title: string, url: string, published: ?string}>}
 */
export function parseWebdelibActs(html, pageUrl) {
  const out = [];
  const chunks = String(html ?? '').split(/<td\b[^>]*class="tableActe"[^>]*>/i).slice(1);
  for (const chunk of chunks) {
    const cell = chunk.split(/<td\b/i)[0];
    const href = /href\s*=\s*"([^"]*openfile\.jsp[^"]*)"/i.exec(cell)?.[1];
    if (!href) continue;
    let url;
    try { url = new URL(decodeEntities(href), pageUrl).href; } catch { continue; }
    const row = chunk.split(/<\/tr>/i)[0];
    const days = [...row.matchAll(/>\s*(\d{2}\/\d{2}\/\d{4})\s*</g)].map((match) => match[1]);
    const title = text(decodeEntities(cell.replace(/<[^>]*>/g, ' '))
      // i18n-ignore-next-line — the platform's own link words, dropped
      .replace(/\s+-\s*(?:arr[êe]t[ée])\s*-\s*\(sans annexe\)\s*$/i, ''));
    if (title) out.push({ title, url, published: listDay(days.at(-1)) });
  }
  return out;
}

/**
 * The acts a city's lists are made of, each with the list that reads it.
 * A list marked `latest` keeps only the newest act of each title, its count
 * in brackets set aside: Béziers's « Dépôt DP (51) » of 10 September holds
 * every DP still open, the one of 4 September included.
 *
 * @param {object} city
 * @param {Array<{title: string, url: string, published: ?string}>} acts
 * @returns {Array<{board: ?string, layout: string, url: string, title: string, published: ?string}>}
 */
export function webdelibLists(city, acts) {
  const out = [];
  const seen = new Set();
  const newestFirst = [...acts].sort((a, b) => String(b.published ?? '').localeCompare(String(a.published ?? '')));
  for (const act of newestFirst) {
    const list = city.lists.find((candidate) => candidate.title.test(act.title));
    if (!list || seen.has(act.url)) continue;
    if (list.latest) {
      const stem = `${list.layout}|${fold(act.title).replace(/\(\s*\d+\s*\)/g, '').trim()}`;
      if (seen.has(stem)) continue;
      seen.add(stem);
    }
    seen.add(act.url);
    out.push({ board: list.board ?? null, layout: list.layout, url: act.url, title: act.title, published: act.published });
  }
  return out;
}

/**
 * The file behind an act: the page `openfile.jsp` answers moves the browser on
 * with a script — `document.location.href='../jsp/showFile.jsp?…'` — and that
 * address serves the PDF. A redirect written in a script, not a challenge:
 * no cookie, no computation, the same for every visitor.
 * @param {string} html
 * @param {string} openUrl
 * @returns {?string}
 */
export function webdelibFileUrl(html, openUrl) {
  const match = /(?:\.\.\/jsp\/)?showFile\.jsp\?[^'"\s<>]+/i.exec(String(html ?? ''));
  if (!match) return null;
  try {
    return new URL(match[0].startsWith('..') ? match[0] : `../jsp/${match[0]}`, openUrl).href;
  } catch {
    return null;
  }
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
    const found = anchors.filter((anchor) => list.link.test(anchor.words));
    if (!found.length) {
      if (list.optional) continue;
      return null;
    }
    // `all`: every edition the page links is a list of its own (Mulhouse's
    // each cover the weeks since the one before); otherwise the first.
    for (const anchor of list.all ? [...new Map(found.map((item) => [item.url, item])).values()] : found.slice(0, 1)) {
      out.push({
        board: list.board, layout: list.layout, url: anchor.url,
        ...(list.all ? { immutable: true } : {}), ...(list.optional ? { optional: true } : {}),
      });
    }
  }
  return out;
}

/**
 * The files a headless TYPO3 page offers, by the heading of their block:
 * Annecy's page is a JavaScript shell with no link, and the same page as JSON
 * (`/api/<path>`) holds its download blocks — `content.header` over
 * `content.items[].publicUrl`. The file names are not to be trusted (TYPO3
 * renames one that collides, `…-2.pdf`), so they are read every time.
 *
 * @param {object} city
 * @param {*} json The parsed page.
 * @returns {?Array<{board: string, layout: string, url: string}>}
 */
export function typo3ListLinks(city, json) {
  const blocks = [];
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 12) return;
    const content = node.content;
    if (content && typeof content.header === 'string' && Array.isArray(content.items)) {
      for (const item of content.items) {
        const url = item?.publicUrl ?? item?.properties?.publicUrl;
        if (typeof url === 'string' && /\.pdf$/i.test(new URL(url, city.page).pathname)) {
          blocks.push({ words: `${content.header} ${item?.properties?.title ?? ''}`, url: new URL(url, city.page).href });
        }
      }
    }
    for (const value of Array.isArray(node) ? node : Object.values(node)) walk(value, depth + 1);
  };
  walk(json, 0);
  const out = [];
  for (const list of city.lists) {
    const found = blocks.find((block) => list.link.test(block.words));
    if (!found) return null;
    out.push({ board: list.board, layout: list.layout, url: found.url });
  }
  return out;
}

// --- Reading a table out of positioned text --------------------------------

/**
 * A dossier number as the lists print it: family, the commune's code, the
 * year, the counter, and a modification's or transfer's suffix. Five
 * spellings, one grammar:
 *
 *   Marseille  `PC 013055 26 00230P0`, `PC 013055 25 00123M01`
 *   Nîmes      `PC 030189 06 P0166 M01`
 *   Lyon       `DP 069 387 25 00038 M02` — the arrondissement's code, split
 *   Béziers    `DP 34032 26 T0848` — five digits, as at Tours — and
 *              `PC 34032 25T0035` on some lines, the counter stuck to the year
 */
const DOSSIER_RE = /^(PC|DP|PA|PD|CU)\s+(\d{3}\s?\d{3}|\d{5})\s+(\d{2})\s*([A-Z]?\d{4,5})(P0)?(?:\s*([MTP]\d{1,2}))?$/i;

/** The first line of a number a narrow column wraps: `DP 34032 26`. */
const DOSSIER_HEAD_RE = /^(PC|DP|PA|PD|CU)\s+(\d{3}\s?\d{3}|\d{5})\s+\d{2}(?=\s|[A-Z]|$)/i;

/** `Page 3/199`, `Page 2 sur 36`: a page's footer, never a cell. */
const PAGE_FOOTER_RE = /^page\s+\d+\s*(?:\/|sur)\s*\d+$/i;

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

/** A column's lines, top to bottom — page by page, when a row runs on — as text. */
function lines(runs) {
  return [...runs]
    .sort((a, b) => ((a.page ?? 0) - (b.page ?? 0)) || (b.y - a.y) || (a.x - b.x))
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

/** A section heading of Lyon's lists: the family, and filed or issued. */
// i18n-ignore-next-line — the city's own headings, matched on
const LYON_SECTION_RE = /^(d[ée]clarations? pr[ée]alables?|permis de construire|permis d.am[ée]nager|permis de d[ée]molir|changements? d.usage)\s+(d[ée]pos[ée]e?s?|d[ée]livr[ée]e?s?)\s+pendant la p[ée]riode/i;
/** Lyon's record line: the number, then what happened and when, maybe on one run. */
const LYON_RECORD_RE = /^(PC|DP|PA|PD|CU|US)\s+(\d{3})\s+(\d{3})(?:\s+(\d{2}))?(?:\s+(\d{5}))?(?:\s+([MT]\d{1,2}))?(?:\s+(.*))?$/i;
/** The rest of a number wrapped onto the next lines: `17 02570`, `00673 M01`, `T01`. */
const LYON_TAIL_RE = /^(?:(\d{2})\s+)?(\d{5})?(?:\s*([MT]\d{1,2}))?$/;
/** `déposée le 25/09/2026 Modificatif`, `Décision du 28/07/2026 à`, `Arrêté du 28/07/2026`. */
// i18n-ignore-next-line — the city's own words, matched on
const LYON_EVENT_RE = /^(d[ée]pos[ée]e?\s+le|d[ée]cision\s+du|arr[êe]t[ée]\s+du)\s+(\d{2}\/\d{2}\/\d{4})\s*(?:(à)\s*(.*?)|(.*?))\s*$/i;
/** A field's label in the left column, its colon sometimes on the next line. */
// i18n-ignore-next-line — the city's own labels, matched on
const LYON_LABEL_RE = /^(projet|terrain|demandeur|mandataire|auteur|r[ée]gie)\s*(?::\s*(.*))?$/i;
/** The fields of a record that are kept; a mandatary, an architect, a régie never are. */
const LYON_KEPT = new Set(['projet', 'terrain', 'demandeur', 'beneficiary']);
// i18n-ignore-start — the city's own labels, matched on
const LYON_LAND_RE = /^superficie du terrain\s*:\s*([\d\s.,]+?)\s*(?:m²|m2)?$/i;
const LYON_FLOOR_RE = /^surface cr[ée]{2}e\s*:\s*([\d\s.,]+?)\s*(?:m²|m2)?$/i;
const LYON_STEP_RE = /^(modificatif|transfert|prorogation|retrait)$/i;
/** The first half of an event a narrow column wraps: `Décision du` / `31/08/2026 à`. */
const LYON_EVENT_HEAD_RE = /^(d[ée]pos[ée]e?\s+le|d[ée]cision\s+du|arr[êe]t[ée]\s+du)$/i;
// i18n-ignore-end

/**
 * `18 Rue Lortet Lyon 7ème` → the street and the arrondissement's postcode.
 * @param {?string} value
 * @returns {{address: ?string, postcode: ?string}}
 */
export function lyonSite(value) {
  const raw = text(value);
  if (!raw) return { address: null, postcode: null };
  const match = /^(.*?)\s+lyon\s+(\d)\s*(?:er|e|[èe]me)?\.?$/i.exec(raw);
  return match
    ? { address: text(match[1]), postcode: `6900${match[2]}` }
    : { address: raw, postcode: null };
}

/**
 * Lyon's lists, one row per record.
 *
 * NOT A TABLE. The city writes its lists in Word, one record after another:
 * the dossier number with what happened to it (`déposée le …`, `Décision du …
 * à <beneficiary>`, `Arrêté du …`), then a label in the left column and its
 * value in the right — `Projet`, `Terrain`, `Demandeur`, `Mandataire`,
 * `Auteur` — and every week opens a section that names the family and says
 * whether its dossiers were filed or issued (`Déclarations préalables
 * déposées pendant la période du …`, `Permis de construire délivrés …`). A
 * Word file draws its text in reading order, so the records are read in that
 * order: a section sets the board, a number starts a record, a label opens a
 * field, and a line under a value, in the same column, continues it.
 *
 * A number may be wrapped by a narrow column (`DP 069 389 23` / `00673 M01`,
 * 100 of the 221 numbers of the list of 21-27 September 2026, and over three
 * lines in the list of 7-13 September: `DP 069 384` / `17 02570` / `T01`);
 * its tail is the next runs of the same column. So may the event (`Décision
 * du` / `31/08/2026 à`), whose halves are joined, and a label and its colon. A value never continues onto the next page
 * — the page's own header would be read into it — and a mandatary, an
 * architect or a régie is never kept: they are people more often than not.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document From `extractPdfText`.
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw, each
 *   with its `board`.
 */
export function readLyonList(document) {
  const rows = [];
  let board = null;
  let record = null;
  const flush = () => {
    const parts = record?.parts;
    if (parts?.year && parts.counter) {
      record.dossier = `${parts.kind} ${parts.code} ${parts.year} ${parts.counter}${parts.suffix ? ` ${parts.suffix}` : ''}`;
    }
    if (record?.dossier && board) {
      const site = lyonSite(record.fields.terrain);
      const decided = board === PERMIT_LIST_BOARDS.decisions;
      rows.push({
        board,
        dossier: record.dossier,
        label: null,
        purpose: text(record.fields.projet) ?? (record.step ? record.step.toLowerCase() : null),
        applicant: text(record.fields.demandeur) ?? text(record.fields.beneficiary),
        address: site.address,
        postcode: site.postcode,
        locality: null,
        filedOn: decided ? null : record.day,
        verdict: decided ? 'Délivré' : null, // i18n-ignore-line — the section's own word, kept as the verdict
        decidedOn: decided ? record.day : null,
        postedOn: null,
        landArea: record.land,
        housing: null,
        lots: null,
        floorArea: record.floor,
      });
    }
    record = null;
  };
  const event = (words) => {
    const match = LYON_EVENT_RE.exec(words);
    if (!match) return false;
    record.day = listDay(match[2]);
    const rest = text(match[4] ?? match[5]);
    if (match[3]) {
      record.field = 'beneficiary';
      record.column = null;
      if (rest) record.fields.beneficiary = rest;
    } else if (rest && LYON_STEP_RE.test(rest)) record.step = rest;
    return true;
  };
  for (const page of document?.pages ?? []) {
    let last = null;
    for (const run of page.runs ?? []) {
      const words = text(run.text);
      if (!words || PAGE_FOOTER_RE.test(words)) continue;
      const section = LYON_SECTION_RE.exec(words);
      if (section) {
        flush();
        board = /livr/i.test(section[2]) ? PERMIT_LIST_BOARDS.decisions : PERMIT_LIST_BOARDS.filings;
        continue;
      }
      const head = LYON_RECORD_RE.exec(words);
      if (head && run.x < 120) {
        flush();
        const [, kind, dept, commune, year, counter, suffix, tail] = head;
        record = {
          parts: { kind, code: `${dept}${commune}`, year, counter, suffix },
          dossier: null, fields: {}, field: null, column: null, pending: null, day: null,
          step: null, land: null, floor: null, x: run.x, y: run.y,
        };
        if (tail) event(tail);
        last = run;
        continue;
      }
      if (!record) continue;
      // The rest of a wrapped number: the next runs of the number's column,
      // before any label — `17 02570` and then `T01`, or `00673 M01`.
      const rest = !record.field && Math.abs(run.x - record.x) < 2 ? LYON_TAIL_RE.exec(words) : null;
      if (rest && (rest[1] || rest[2] || rest[3])) {
        const { parts } = record;
        if (rest[1] && !parts.year) parts.year = rest[1];
        if (rest[2] && !parts.counter) parts.counter = rest[2];
        if (rest[3] && !parts.suffix) parts.suffix = rest[3];
        continue;
      }
      if (words === ':') continue;
      const land = LYON_LAND_RE.exec(words);
      if (land) { record.land = String(number(land[1]) ?? '') || null; continue; }
      const floor = LYON_FLOOR_RE.exec(words);
      if (floor) { record.floor = String(number(floor[1]) ?? '') || null; continue; }
      if (LYON_EVENT_HEAD_RE.test(words)) { record.pending = words; continue; }
      if (record.pending) {
        const whole = `${record.pending} ${words}`;
        record.pending = null;
        if (event(whole)) { last = run; continue; }
      }
      if (event(words)) { last = run; continue; }
      if (LYON_STEP_RE.test(words)) { record.step = words; continue; }
      const label = run.x < record.x + 10 ? LYON_LABEL_RE.exec(words) : null;
      if (label) {
        record.field = fold(label[1]).toLowerCase();
        record.column = null;
        if (text(label[2]) && LYON_KEPT.has(record.field)) record.fields[record.field] = text(label[2]);
        last = run;
        continue;
      }
      const field = record.field;
      if (!field || !LYON_KEPT.has(field)) continue;
      const pitch = 2 * (run.size || 12);
      // A field's first value sits beside its label, a little lower when Word
      // centres a cell taller than the label's; the lines after it, under it.
      const continues = record.column === null
        ? (last && run.x > last.x && Math.abs(run.y - last.y) < 1.2 * (run.size || 12))
        : Math.abs(run.x - record.column) < 2 && last && last.y - run.y < pitch && last.y - run.y > 0;
      if (!continues) continue;
      record.fields[field] = record.fields[field] ? `${record.fields[field]} ${words}` : words;
      if (record.column === null) record.column = run.x;
      last = run;
    }
  }
  flush();
  return rows;
}

/**
 * The columns of one page of a grid: each cell's text starts at its column's
 * left edge, so the starts cluster, and a cluster belongs to the header whose
 * words it lies under — the header that its widest extent overlaps most. A
 * header centred over a wide column starts far to the right of the column's
 * cells (Béziers's « Description du projet » at 623, its cells at 529.6),
 * which is why neither the header's start nor its centre will do alone.
 *
 * @param {Array<object>} runs The page's body.
 * @param {Array<{field: string, x: number, x1: number}>} columns Its header.
 * @returns {(run: object) => ?string} The field of a run.
 */
function gridColumns(runs, columns) {
  const clusters = [];
  for (const run of [...runs].sort((a, b) => a.x - b.x)) {
    const right = Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x;
    const near = clusters.at(-1);
    if (near && run.x - near.start < 4) { near.end = Math.max(near.end, right); continue; }
    clusters.push({ start: run.x, end: right });
  }
  for (const cluster of clusters) {
    let best = null;
    let score = -Infinity;
    for (const column of columns) {
      const overlap = Math.min(cluster.end, column.x1) - Math.max(cluster.start, column.x);
      if (overlap > score) { score = overlap; best = column; }
    }
    cluster.field = best?.field ?? null;
  }
  return (run) => {
    let found = null;
    for (const cluster of clusters) {
      if (run.x - cluster.start > -0.5) found = cluster; else break;
    }
    return found?.field ?? null;
  };
}

/**
 * A grid: one row per dossier, every cell hanging from the top of its row,
 * the dossier number in its own column and the header repeated — or not — on
 * each page (Béziers's weekly lists, Aspose's export).
 *
 * The header gives the fields, `spec.columns` the words that name them; a
 * page without a header keeps the last page's. A row starts on the line of
 * its dossier number, which a narrow column may wrap (`DP 34032 26` /
 * `T0848`), and runs down to the next number, cut at the first empty stretch
 * of more than two lines. A run as wide as a third of the page is a section's
 * title across the table, not a cell.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document From `extractPdfText`.
 * @param {{board: string, columns: Array<[string, string, {optional?: boolean}?]>,
 *   row: (cells: Record<string, Array<string>>) => object}} spec
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw, each
 *   with `spec.board`.
 */
export function readGridTable(document, spec) {
  const rows = [];
  const { pages, furniture } = pageRuns(document);
  let header = null;
  // The last row of a page, kept open: Word lets a row run on to the top of
  // the next page, above that page's first number (Mulhouse, 43 runs over
  // five pages of one list, the applicant's organisation among them).
  let open = null;
  const close = () => {
    if (!open) return;
    const byField = Object.fromEntries(Object.entries(open).map(([field, cellRuns]) => [field, lines(cellRuns)]));
    const row = spec.row(byField);
    if (row && DOSSIER_RE.test(text(row.dossier) ?? '')) rows.push({ board: spec.board, ...row });
    open = null;
  };
  for (const [index, runs] of pages.entries()) {
    const found = gridHeader(runs, spec.columns);
    if (found) header = found;
    if (!header) continue;
    const columns = [...header.columns].sort((a, b) => a.x - b.x);
    const width = Math.max(...columns.map((column) => column.x1)) - columns[0].x;
    // A section's title runs across the table from its first column; a long
    // description, wide too, starts in its own (Mulhouse's, 240 points).
    const below = runs.filter((run) => (!found || run.y < found.bottom - 1)
      && !header.runs.includes(run)
      && !((Number.isFinite(run.x1) ? run.x1 - run.x : 0) > width / 3 && run.x < (columns[1]?.x ?? Infinity)))
      .map((run) => ({ ...run, page: index }));
    const columnOf = gridColumns(below, header.columns);
    const anchors = below.filter((run) => columnOf(run) === 'dossier' && DOSSIER_HEAD_RE.test(text(run.text) ?? ''))
      .sort((a, b) => b.y - a.y);
    const lowest = anchors.at(-1)?.y ?? -Infinity;
    const body = below.filter((run) => run.y >= lowest || !furniture(run));
    const top = anchors[0]?.y ?? -Infinity;
    if (open) {
      // What runs on is never the page's furniture — Béziers stamps « Publié
      // le … » over every page, and read into the row it became its filing day.
      for (const run of body.filter((item) => item.y > top + 0.5 && !furniture(item))) {
        const field = columnOf(run);
        if (field) (open[field] ??= []).push(run);
      }
    }
    if (!anchors.length) continue;
    close();
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
      const cells = {};
      for (const run of kept) {
        const field = columnOf(run);
        if (field) (cells[field] ??= []).push(run);
      }
      if (i < anchors.length - 1) {
        open = cells;
        close();
      } else open = cells;
    });
  }
  close();
  return rows;
}

/** A grid's header on this page, or null: every required column's words found. */
function gridHeader(runs, columns) {
  const found = [];
  const used = [];
  for (const [field, words, options] of columns) {
    const run = runs.find((candidate) => fold(candidate.text) === words);
    if (!run) {
      if (options?.optional) continue;
      return null;
    }
    const right = Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x;
    found.push({ field, x: run.x, x1: right, y: run.y });
    used.push(run);
  }
  // A header split over two lines (`Date de` / `signature`) leaves its second
  // line under the first: it is part of the header, not of the first row.
  const bottom = Math.min(...found.map((column) => column.y));
  const top = Math.max(...found.map((column) => column.y));
  const second = runs.filter((run) => !used.includes(run) && run.y < bottom && bottom - run.y < 1.6 * (run.size || 11)
    && found.some((column) => Math.abs(column.x - run.x) < 1));
  return {
    bottom: Math.min(bottom, ...second.map((run) => run.y)),
    top,
    runs: [...used, ...second],
    columns: found.sort((a, b) => a.x - b.x),
  };
}

/** A grid cell's lines as one value. */
function joined(cellLines) {
  return text((cellLines ?? []).join(' '));
}

/**
 * A grid's applicant: the organisation the cell names, where it names one.
 *
 * The person who signs comes first and the organisation they sign for after
 * — `Monsieur <name>` / `<first name>` / `M2A HABITAT` at Mulhouse, in one row
 * in four; the first line alone would keep the person, whom the filter drops,
 * and lose the organisation. A grid's applicant cell holds no address (the
 * site has its own column), so every line may be tried; the first that reads
 * as an organisation is the applicant, and failing one, the first line, which
 * the filter will judge like any other.
 *
 * @param {Array<string>} cellLines
 * @returns {?string}
 */
export function gridApplicant(cellLines) {
  const all = (cellLines ?? []).map((line) => text(line)).filter(Boolean);
  for (let i = 0; i < all.length; i += 1) {
    const candidate = registerApplicant(all.slice(i));
    if (organisationApplicant(candidate)) return candidate;
  }
  return registerApplicant(all);
}

/**
 * A grid of filed dossiers: Béziers's weekly lists, one per family (`Dépôt DP
 * (51)`), and Argenteuil's sheets, one per dossier — the same export, the
 * same five headers.
 */
const GRID_FILINGS = Object.freeze({
  board: PERMIT_LIST_BOARDS.filings,
  columns: Object.freeze([
    ['filedOn', 'DATE DE DEPOT'], ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'PETITIONNAIRE'],
    ['address', 'ADRESSE DU PROJET'], ['purpose', 'DESCRIPTION DU PROJET'],
  ]),
  row: (cells) => {
    const site = registerSite(cells.address ?? []);
    return {
      dossier: joinDossier(cells.dossier ?? []).dossier,
      label: null,
      purpose: joined(cells.purpose),
      applicant: gridApplicant(cells.applicant),
      address: site.address,
      postcode: site.postcode,
      locality: site.locality,
      filedOn: listDay(joined(cells.filedOn)),
      verdict: null,
      decidedOn: null,
      postedOn: null,
      landArea: null,
      housing: null,
      lots: null,
      floorArea: null,
    };
  },
});

/** A grid of decisions: Béziers's (`DP décidées (25)`) and Argenteuil's. */
const GRID_DECISIONS = Object.freeze({
  board: PERMIT_LIST_BOARDS.decisions,
  columns: Object.freeze([
    ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'PETITIONNAIRE'], ['verdict', 'DECISION'],
    ['decidedOn', 'DATE DE'], ['purpose', 'NATURE DES TRAVAUX'], ['address', 'ADRESSE DES TRAVAUX'],
    ['floorArea', 'SURFACE', { optional: true }],
  ]),
  row: (cells) => {
    const site = registerSite(cells.address ?? []);
    const floor = number(joined(cells.floorArea)?.replace(/\s*m(?:²|2)$/i, ''));
    return {
      dossier: joinDossier(cells.dossier ?? []).dossier,
      label: null,
      purpose: joined(cells.purpose),
      applicant: gridApplicant(cells.applicant),
      address: site.address,
      postcode: site.postcode,
      locality: site.locality,
      filedOn: null,
      verdict: joined(cells.verdict),
      decidedOn: listDay(joined(cells.decidedOn)),
      postedOn: null,
      landArea: null,
      housing: null,
      lots: null,
      floorArea: floor === null ? null : String(floor),
    };
  },
});

/**
 * A list's parcel cell as the cadastre parcels it names: `AC 0080, AB 0123`
 * at Aix — the section, the number on four digits, a comma between. The
 * three strays of 736 references read on 2026-10-01 are read too: `KD 275p`
 * (part of a parcel, the surveyor's mark kept), `A 2036` (a one-letter
 * section) and `001BX 0101` (the commune's own number in front, which
 * `cartdsParcelIdus` folds away). Anything else is no parcel.
 *
 * @param {?string} cell
 * @returns {Array<{prefix: ?string, section: string, numero: string, label: string}>}
 */
export function listParcels(cell) {
  const out = [];
  for (const piece of String(cell ?? '').split(/[,;]/)) {
    const label = piece.replace(/\s+/g, ' ').trim().toUpperCase();
    const match = /^(?:(\d{1,3})\s*)?([A-Z]{1,2})\s+0*(\d{1,4})(P)?$/.exec(label);
    if (!match) continue;
    out.push({ prefix: match[1] ?? null, section: match[2], numero: `${match[3]}${match[4] ? 'P' : ''}`, label });
  }
  return out;
}

// --- Aix-en-Provence: two HTML tables --------------------------------------

/**
 * A number as Aix writes it, with the commune's code the list leaves out:
 * `PC2600200` → `PC 013001 26 00200`, `PC24J0209 M01` → `PC 013001 24 J0209
 * M01`. Up to 2024 the counter was `J` and four digits, and Sitadel keeps the
 * `J` (`01300124J0180`). `P01` after a number is a PROROGATION here, not
 * Marseille's original. `AT` — a works permit for a building open to the
 * public — is not a family the layer draws.
 *
 * @param {object} city
 * @param {?string} raw
 * @returns {?string}
 */
export function aixDossier(city, raw) {
  const match = /^(PC|DP|PA|PD|CU)\s*(\d{2})\s*([A-Z]?\d{4,5})(?:\s*([MTP]\d{1,2}))?$/i.exec(text(raw) ?? '');
  if (!match) return null;
  const [, kind, year, counter, suffix] = match;
  return `${kind.toUpperCase()} 0${city.insee} ${year} ${counter.toUpperCase()}${suffix ? ` ${suffix.toUpperCase()}` : ''}`;
}

/** A cell of Aix's tables: tags out, `-` for nothing. */
function htmlCell(value) {
  const plain = text(decodeEntities(String(value ?? '').replace(/<[^>]*>/g, ' ')));
  return plain === '-' ? null : plain;
}

/** `2026-09-30 00:00:00.0` → `2026-09-30`. */
function isoDay(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''));
  return match ? match[1] : null;
}

/** `13100 AIX-EN-PROVENCE` at the end of a site, set apart. */
function sitePostcode(value) {
  const match = /^(.*?)\s*\b(\d{5})\s+([^\d]*?)\s*$/.exec(String(value ?? '').trim());
  return match
    ? { address: text(match[1]), postcode: match[2], locality: text(match[3]) }
    : { address: text(value), postcode: null, locality: null };
}

/**
 * Aix's two lists, read off the one page that carries them both.
 *
 * NOT A FILE. The city's ArcOpole application answers a page whose two
 * tables are the lists — « Liste des Dossiers Déposés » and « … Délivrés » —
 * every dossier filed in the last two months and still undecided, and every
 * decision of the same two months, refusals included (52 of 312 on
 * 2026-10-01). The window is recomputed at each request, so the page keeps no
 * history. Each table is found by the legend over it: the tables' own ids are
 * the other way round.
 *
 * @param {object} city
 * @param {string} html
 * @returns {?{filings: Array<object>, decisions: Array<object>}} Null when
 *   either table is missing.
 */
export function readAixTables(city, html) {
  const source = String(html ?? '');
  const tables = {};
  const legends = [...source.matchAll(/<legend[^>]*>([\s\S]*?)<\/legend>/gi)];
  legends.forEach((legend, i) => {
    const words = fold(htmlCell(legend[1]) ?? '');
    // i18n-ignore-next-line — the page's own legends, matched on
    const board = /DOSSIERS DEPOSES/.test(words) ? 'filings' : /DOSSIERS DELIVRES/.test(words) ? 'decisions' : null;
    if (!board) return;
    const part = source.slice(legend.index, legends[i + 1]?.index ?? source.length);
    const heads = [...part.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => fold(htmlCell(match[1]) ?? ''));
    const rows = [];
    for (const tr of part.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => htmlCell(match[1]));
      if (cells.length !== heads.length) continue;
      rows.push(Object.fromEntries(heads.map((head, k) => [head, cells[k]])));
    }
    tables[board] = rows;
  });
  if (!tables.filings || !tables.decisions) return null;
  const row = (board, cells) => {
    const site = sitePostcode(cells['ADRESSE DU TERRAIN']);
    const decided = board === 'decisions';
    // i18n-ignore-start — the page's own column names
    return {
      board,
      dossier: aixDossier(city, cells.DOSSIER),
      label: null,
      purpose: cells.TRAVAUX ?? cells['OBJET / DESTINATION'] ?? null,
      applicant: cells.DEMANDEUR ?? null,
      address: site.address,
      postcode: site.postcode,
      locality: site.locality,
      filedOn: decided ? null : isoDay(cells.DEPOT),
      verdict: decided ? cells.NATURE ?? null : null,
      decidedOn: decided ? isoDay(cells.DELIVRANCE) : null,
      postedOn: null,
      landArea: null,
      housing: number(cells['LOG.']) ? cells['LOG.'] : null,
      lots: null,
      floorArea: number(String(cells.SHON ?? '').replace(',', '.')) ? String(number(String(cells.SHON).replace(',', '.'))) : null,
      parcels: cells.PARCELLE ?? null,
    };
    // i18n-ignore-end
  };
  return {
    filings: tables.filings.map((cells) => row('filings', cells)).filter((item) => item.dossier),
    decisions: tables.decisions.map((cells) => row('decisions', cells)).filter((item) => item.dossier),
  };
}

// --- Argenteuil: Digilor Datahall, one PDF per dossier ---------------------

/**
 * The body that asks a Datahall for every document it holds: the app sends
 * this JSON as the raw body of a POST, and the server reads it whatever the
 * content type says. One answer, no paging — Argenteuil's was 10.2 MB, 10 611
 * documents back to April 2022.
 * @param {object} city A city whose `source.kind` is `digilor`.
 */
export function digilorIndexBody(city) {
  return JSON.stringify({ controller: 'DocumentController', action: 'getAll', data: { idApp: city.source.app } });
}

/** @param {object} city @returns {string} */
export function digilorIndexUrl(city) {
  return `${city.source.base}/web/server/index.php`;
}

/**
 * The permit files of a Datahall index, newest first: the documents of the
 * city's urbanism category whose sub-category is the filings' or the
 * decisions', first shown on or after `since`. Selected by the ids, never by
 * the titles, which are typed by hand (`Décison`, `Déppot`) and name the
 * applicant. Since May 2023 one file holds one dossier.
 *
 * @param {object} city
 * @param {*} index The parsed answer.
 * @param {string} since `YYYY-MM-DD`.
 * @returns {?Array<{board: string, url: string, published: ?string}>} Null for
 *   an answer that is not an index.
 */
export function digilorDocuments(city, index, since) {
  if (!Array.isArray(index)) return null;
  const { category, filings, decisions } = city.source;
  const out = [];
  for (const doc of index) {
    if (Number(doc?.id_cat) !== category) continue;
    const sub = Number(doc.id_sscat);
    const board = sub === filings ? 'filings' : sub === decisions ? 'decisions' : null;
    const published = isoDay(doc.aff_deb);
    const file = String(doc.url_uiid ?? '').replace(/^(?:\.\.\/bo\/|bo\/|\.\/)/, '');
    if (!board || !file || !published || published < since) continue;
    out.push({ board, url: `${city.source.base}/web/server/get_file.php?file=${encodeURIComponent(file)}`, published });
  }
  return out.sort((a, b) => b.published.localeCompare(a.published));
}

// --- Tables whose cells are centred on their row ----------------------------

/** `27 / 36` alone in a page's bottom margin: Firefox's page footer. */
const BARE_PAGE_FOOTER_RE = /^\d+\s*\/\s*\d+$/;

/**
 * The parts of a number a narrow column prints over several lines, joined:
 * `DP 074 010 24` / `00298 M04`, `PC 063 113 21 G0729` / `M01`, `PC 068224
 * 25 S` / `0089`. Lines that are not part of a number — Annecy prints the
 * posting date under it, in the same column — are handed back apart.
 *
 * @param {Array<string>} cellLines
 * @returns {{dossier: ?string, others: Array<string>}}
 */
export function joinDossier(cellLines) {
  let dossier = null;
  const others = [];
  for (const line of cellLines) {
    const value = text(line);
    if (!value) continue;
    if (!dossier) {
      if (DOSSIER_HEAD_RE.test(value) || DOSSIER_RE.test(value)) dossier = value;
      else others.push(value);
      continue;
    }
    if (DOSSIER_RE.test(dossier) && !/^[MTP]\d{1,2}$/i.test(value)) { others.push(value); continue; }
    if (/^(?:[A-Z]?\d{4,5})?(?:\s*[MTP]\d{1,2})?$/i.test(value) || (/[ A-Z]$/i.test(dossier) && /^\d{4,5}\b/.test(value))) {
      // A lone letter ending the head (`… 25 S`) is the counter's own.
      dossier = /\s[A-Z]$/i.test(dossier) && /^\d/.test(value) ? `${dossier}${value}` : `${dossier} ${value}`;
    } else others.push(value);
  }
  return { dossier, others };
}

/**
 * A table whose cells are centred on their row's middle and left-aligned on
 * their column (Annecy's lists printed from Firefox, Clermont-Ferrand's
 * Géosphère reports). Columns by their header: a run belongs to the last
 * header that starts at or left of it, give or take five points — a centred
 * date starts a little left of its own header — and a run left of every
 * header to the first. Rows one of two ways (`spec.rows`):
 *
 * - `gap`: a row ends where the page leaves an empty stretch taller than
 *   `spec.gap` — Annecy's rows are 16.4 points apart or more and their lines
 *   8, Clermont's decisions 21 and 8.66. A stretch with no number continues
 *   the row above it.
 * - `nearest`: each line goes to the nearest number, as on Marseille's list
 *   of decisions — Clermont's filings, where a four-line applicant leaves a
 *   gap inside a row as tall as the gap between two.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @param {{board: string, columns: Array<[string, string, {optional?: boolean}?]>,
 *   rows: 'gap'|'nearest', gap?: number, build: (cells: Record<string, Array<string>>) => ?object}} spec
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw.
 */
export function readBandTable(document, spec) {
  const rows = [];
  const { pages } = pageRuns(document);
  for (const page of pages) {
    const runs = page.filter((run) => !(BARE_PAGE_FOOTER_RE.test(text(run.text) ?? '') && run.y < 40));
    const header = gridHeader(runs, spec.columns);
    if (!header) continue;
    const columns = [...header.columns].sort((a, b) => a.x - b.x);
    const columnOf = (run) => {
      let found = columns[0];
      for (const column of columns) if (column.x <= run.x + 5) found = column;
      return found.field;
    };
    const isAnchor = (run) => columnOf(run) === 'dossier' && DOSSIER_HEAD_RE.test(text(run.text) ?? '');
    // No furniture test here: the title, the commune and the edition date sit
    // over the header, and the only footer is Firefox's `n / N`, dropped
    // above. A centred row's last lines hang below its number, where a test
    // for repeated text would only ever take a row's own words.
    const body = runs.filter((run) => run.y < header.bottom - 1 && !header.runs.includes(run))
      .sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const groups = [];
    if (spec.rows === 'gap') {
      let current = null;
      let previousY = null;
      for (const run of body) {
        if (!current || previousY - run.y > spec.gap) {
          current = [];
          groups.push(current);
        }
        current.push(run);
        previousY = run.y;
      }
      // A stretch with no number continues the row above; one with two is
      // split between them, each line to the nearer number.
      for (let i = groups.length - 1; i > 0; i -= 1) {
        if (!groups[i].some(isAnchor)) { groups[i - 1].push(...groups[i]); groups.splice(i, 1); }
      }
    } else {
      groups.push(body);
    }
    for (const group of groups) {
      const anchors = group.filter(isAnchor);
      if (!anchors.length) continue;
      const members = anchors.map(() => []);
      for (const run of group) {
        let at = 0;
        for (let i = 1; i < anchors.length; i += 1) {
          if (Math.abs(anchors[i].y - run.y) < Math.abs(anchors[at].y - run.y)) at = i;
        }
        members[at].push(run);
      }
      anchors.forEach((anchor, i) => {
        const cells = {};
        for (const run of members[i]) (cells[columnOf(run)] ??= []).push(run);
        const byField = Object.fromEntries(Object.entries(cells).map(([field, cellRuns]) => [field, sameLines(cellRuns)]));
        const row = spec.build(byField);
        if (row && DOSSIER_RE.test(text(row.dossier) ?? '')) rows.push({ board: spec.board, ...row });
      });
    }
  }
  return rows;
}

/** A cell's lines, the runs that share a line joined in reading order. */
function sameLines(cellRuns) {
  const out = [];
  let line = null;
  for (const run of [...cellRuns].sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    if (line && Math.abs(line.y - run.y) < 1) { line.text = `${line.text} ${run.text}`; continue; }
    line = { y: run.y, text: run.text };
    out.push(line);
  }
  return out.map((item) => text(item.text)).filter(Boolean);
}

/** `569 m²` → `569`. */
function area(value) {
  const found = number(String(value ?? '').replace(/\s*m(?:²|2)\s*$/i, ''));
  return found === null ? null : String(found);
}

/** Annecy's lists: the columns of both, the decisions' `Décision` the one apart. */
function annecySpec(board) {
  const decided = board === PERMIT_LIST_BOARDS.decisions;
  return Object.freeze({
    board,
    rows: 'gap',
    gap: 12,
    columns: Object.freeze([
      ['dossier', 'N° DE DOSSIER'], ['filedOn', 'DATE DEPOT'], ['applicant', 'DEMANDEUR'],
      ['site', decided ? 'LIEUX DES' : 'LIEUX DES TRAVAUX'], ['landArea', 'SUPERFICIE'],
      ['purpose', 'NATURE DES TRAVAUX'], ['project', 'PROJET'],
      ...(decided ? [['verdict', 'DECISION']] : []),
    ]),
    build: (cells) => {
      const { dossier, others } = joinDossier(cells.dossier ?? []);
      const place = parseCartdsPlace(joined(cells.site));
      const project = cartdsProject(joined(cells.project));
      const decision = decided ? registerDecision(cells.verdict ?? []) : null;
      return {
        dossier,
        label: null,
        purpose: joined(cells.purpose),
        applicant: joined(cells.applicant),
        address: place.address,
        postcode: place.postcode,
        locality: place.locality,
        filedOn: listDay(joined(cells.filedOn)),
        verdict: decision?.verdict ?? null,
        decidedOn: decision?.decidedOn ?? null,
        postedOn: listDay(others.find((line) => /^\d{2}\/\d{2}\/\d{4}$/.test(line))),
        landArea: area(joined(cells.landArea)),
        housing: null,
        lots: project.lots === null ? null : String(project.lots),
        floorArea: project.createdM2 === null ? null : String(project.createdM2),
        parcels: place.parcels.map((parcel) => parcel.label).join(', ') || null,
      };
    },
  });
}

/**
 * Clermont-Ferrand's decisions (« Registre d'affichage de la décision »): the
 * works and the site share a column, the site last and after a dash; `Retiré
 * le` is the day the notice comes down, two months on, not a withdrawal.
 */
const CLERMONT_DECISIONS = Object.freeze({
  board: PERMIT_LIST_BOARDS.decisions,
  rows: 'gap',
  gap: 14,
  columns: Object.freeze([
    ['dossier', 'N° DE DOSSIER'], ['applicant', 'DEMANDEUR'], ['works', 'OBJET DES TRAVAUX'],
    ['decidedOn', 'DATE DE LA DECISION'], ['postedOn', 'DATE AFFICHAGE DECISION'], ['down', 'RETIRE LE'],
    ['verdict', 'NATURE DE LA DECISION'],
  ]),
  build: (cells) => {
    const { dossier } = joinDossier(cells.dossier ?? []);
    const works = cells.works ?? [];
    const at = works.findIndex((line) => /^-\s/.test(line));
    const purpose = text((at < 0 ? works : works.slice(0, at)).join(' '));
    const address = at < 0 ? null : text(works.slice(at).join(' ').replace(/^-\s*/, ''));
    return {
      dossier,
      label: null,
      purpose,
      applicant: registerApplicant(cells.applicant ?? []),
      address,
      postcode: null,
      locality: null,
      filedOn: null,
      verdict: joined(cells.verdict),
      decidedOn: listDay(joined(cells.decidedOn)),
      postedOn: listDay(joined(cells.postedOn)),
      landArea: null,
      housing: null,
      lots: null,
      floorArea: null,
      parcels: null,
    };
  },
});

/** Clermont-Ferrand's decision codes in its list of filings. */
// i18n-ignore-start — the software's own codes and words
const CLERMONT_CODES = Object.freeze({
  F: 'Favorable', FR: 'Favorable avec réserve', D: 'Défavorable', A: 'Annulation',
  FT: 'Favorable tacite', RT: 'Rejet tacite',
});
// i18n-ignore-end

/**
 * Clermont-Ferrand's filings (« Répertoire des dossiers déposés »), every
 * dossier filed since 1 January with its decision once taken: the applicant
 * cell is the name over the applicant's own address (only the name is read),
 * the site cell the address, the works and, last, the parcels.
 */
const CLERMONT_FILINGS = Object.freeze({
  board: PERMIT_LIST_BOARDS.filings,
  rows: 'nearest',
  columns: Object.freeze([
    ['dossier', 'N° DE DOSSIER'], ['filedOn', 'DATE DE DEPOT'], ['applicant', 'DEMANDEUR'],
    ['site', 'ADRESSE DU TERRAIN'], ['floor', 'SHON'], ['housing', 'NB LOGTS'],
    ['decision', 'NATURE ET DATE DE DECISION'],
  ]),
  build: (cells) => {
    const { dossier } = joinDossier(cells.dossier ?? []);
    const site = cells.site ?? [];
    const last = site.at(-1);
    const parcels = site.length > 1 && listParcels(last).length ? last : null;
    const decision = /^([A-Z]{1,2})\s+(\d{2}\/\d{2}\/\d{4})$/.exec(joined(cells.decision) ?? '');
    const floors = (cells.floor ?? []).map((line) => number(line)).filter((value) => value !== null);
    return {
      board: decision ? PERMIT_LIST_BOARDS.decisions : PERMIT_LIST_BOARDS.filings,
      dossier,
      label: null,
      purpose: text(site.slice(1, parcels ? -1 : undefined).join(' ')),
      applicant: registerApplicant(cells.applicant ?? []),
      address: text(site[0]),
      postcode: null,
      locality: null,
      filedOn: listDay(joined(cells.filedOn)),
      verdict: decision ? CLERMONT_CODES[decision[1]] ?? decision[1] : null,
      decidedOn: decision ? listDay(decision[2]) : null,
      postedOn: null,
      landArea: null,
      housing: number(joined(cells.housing)) ? joined(cells.housing) : null,
      lots: null,
      floorArea: floors.at(-1) ? String(floors.at(-1)) : null,
      parcels,
    };
  },
});

// --- Versailles: a register whose every cell is its own clip ---------------

/** The labels Versailles's register writes at the head of a cell's lines. */
// i18n-ignore-next-line — the register's own labels, matched on
const VERSAILLES_LABEL_RE = /^(d[ée]p[ôo]t le|complet le|par|repr[ée]sentant\s*:|auteur\s*:|terrain\s*:|sis|surface\s*:|propri[ée]taire\s*:|projet\s*:|surface de plancher [^\s:]+\s*:|nb logements cr[ée]{2}s\s*:|destination\s*:|hauteur\s*:|sign[ée]e le\s*:|notifi[ée] le\s*:|nature de la d[ée]cision\s*:)\s*(.*)$/i;

/**
 * A cell's lines as labelled values: each labelled line opens a value, the
 * lines after it continue it — `Projet : Remplacement des` / `menuiseries`.
 * @param {Array<string>} cellLines
 * @returns {Map<string, string>} Folded label → value.
 */
function labelled(cellLines) {
  const out = new Map();
  let label = null;
  for (const line of cellLines) {
    const match = VERSAILLES_LABEL_RE.exec(line);
    if (match) {
      label = fold(match[1]).replace(/\s*:$/, '');
      if (!out.has(label)) out.set(label, text(match[2]) ?? '');
      continue;
    }
    if (label) out.set(label, text(`${out.get(label)} ${line}`));
  }
  return out;
}

/**
 * `AX0288 AH0109` — Versailles's parcels, a section of one or two characters
 * and a number on four digits, spaces between — as the list cells write them
 * everywhere else: `AX 0288, AH 0109`.
 * @param {?string} value
 * @returns {?string}
 */
export function versaillesParcels(value) {
  const out = [];
  for (const token of String(value ?? '').toUpperCase().split(/[\s,;]+/)) {
    const match = /^([A-Z0-9]{0,1}[A-Z])(\d{4})$/.exec(token);
    if (match) out.push(`${match[1]} ${match[2]}`);
  }
  return out.length ? out.join(', ') : null;
}

/**
 * Versailles's « Registre des autorisations d'urbanisme déposées / décidées »,
 * fortnightly, one row per dossier.
 *
 * EVERY CELL IS ITS OWN CLIP. Word draws each cell of the table under a clip
 * rectangle, so a row is the runs that share a clip's top and bottom, and a
 * column the header whose clip starts where the run's does — no geometry to
 * infer, where the text itself is centred in each cell and a two-line site
 * starts above the dossier's number. The header (`Dossier`, `Terrain`,
 * `Description`, `Décision`) is printed under each section's title only, so
 * its columns are carried from page to page; a run under the page's own clip
 * — the title, the section headings — is no cell. A row never splits across
 * pages (none of 2 912 in the 34 files of 2026).
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw, each with its board.
 */
export function readVersaillesList(document) {
  const rows = [];
  let board = null;
  let columns = null;
  // i18n-ignore-start — the register's own title and headers, matched on
  const HEADS = Object.freeze({ DOSSIER: 'dossier', TERRAIN: 'site', DESCRIPTION: 'project', DECISION: 'decision' });
  for (const page of document?.pages ?? []) {
    const cells = new Map();
    for (const run of page.runs ?? []) {
      const words = text(run.text);
      if (!words) continue;
      const full = !run.clip || (run.clip.x0 <= 0.5 && run.clip.y0 <= 0.5);
      if (full) {
        const title = /D'URBANISME\s+(DEPOSEES|DECIDEES)/.exec(fold(words));
        if (title) board = title[1] === 'DEPOSEES' ? PERMIT_LIST_BOARDS.filings : PERMIT_LIST_BOARDS.decisions;
        continue;
      }
      const head = HEADS[fold(words)];
      if (head && run.size >= 11) { (columns ??= {})[head] = run.clip; continue; }
      const key = `${run.clip.y0.toFixed(1)}|${run.clip.y1.toFixed(1)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(run);
    }
    // i18n-ignore-end
    if (!columns) continue;
    for (const group of cells.values()) {
      const byField = {};
      for (const run of group) {
        const field = Object.keys(columns).find((name) => Math.abs(columns[name].x0 - run.clip.x0) < 1.5);
        if (field) (byField[field] ??= []).push(run);
      }
      const dossierLines = lines(byField.dossier ?? []);
      const { dossier } = joinDossier(dossierLines);
      if (!dossier || !DOSSIER_RE.test(dossier)) continue;
      const who = labelled(dossierLines);
      const site = labelled(lines(byField.site ?? []));
      const project = labelled(lines(byField.project ?? []));
      const decision = labelled(lines(byField.decision ?? []));
      const decided = Boolean(columns.decision) && board === PERMIT_LIST_BOARDS.decisions;
      rows.push({
        board: decided ? PERMIT_LIST_BOARDS.decisions : (board ?? PERMIT_LIST_BOARDS.filings),
        dossier,
        label: null,
        purpose: project.get('PROJET') ?? null,
        applicant: who.get('PAR') ?? null,
        address: site.get('SIS') ?? null,
        postcode: null,
        locality: null,
        filedOn: listDay(who.get('DEPOT LE')),
        verdict: decided ? decision.get('NATURE DE LA DECISION') ?? null : null,
        decidedOn: decided ? listDay(decision.get('SIGNEE LE')) : null,
        postedOn: null,
        landArea: area(site.get('SURFACE')),
        housing: number(project.get('NB LOGEMENTS CREES')) ? project.get('NB LOGEMENTS CREES') : null,
        lots: null,
        floorArea: area(project.get('SURFACE DE PLANCHER CREEE')),
        parcels: versaillesParcels(site.get('TERRAIN')),
      });
    }
  }
  return rows;
}

// --- Google Drive: a public folder, listed without a key -------------------

/** A public folder's listing, plain HTML, no key, no script. */
export function driveFolderUrl(id) {
  return `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(id)}`;
}

/** A public file's bytes. */
export function driveFileUrl(id) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download`;
}

/**
 * The entries of a folder's listing: each `flip-entry` block holds an id, a
 * link that says whether it is a folder or a file, and a title. The dates the
 * listing prints are the viewer's locale and a re-upload's day: not read.
 * @param {string} html
 * @returns {Array<{id: string, folder: boolean, title: string}>}
 */
export function parseDriveFolder(html) {
  const out = [];
  for (const block of String(html ?? '').split('<div class="flip-entry" id="entry-').slice(1)) {
    const id = block.slice(0, block.indexOf('"'));
    const href = decodeEntities(/<a href="([^"]+)"/.exec(block)?.[1] ?? '');
    const title = text(decodeEntities(/<div class="flip-entry-title">([^<]*)<\/div>/.exec(block)?.[1] ?? ''));
    if (!/^[\w-]{10,}$/.test(id) || !title) continue;
    const folder = href.includes('/drive/folders/');
    if (!folder && !href.includes('/file/d/')) continue;
    out.push({ id, folder, title });
  }
  return out;
}

/**
 * How a layout's files are turned into text, where it differs from the
 * default (`extractPdfText`'s options): Annecy's, printed from Firefox, draw
 * no space glyph between words.
 */
export const PERMIT_LIST_TEXT = Object.freeze({
  'annecy-filings': Object.freeze({ wordGapEm: 0.15 }),
  'annecy-decisions': Object.freeze({ wordGapEm: 0.15 }),
});

/** The readers, by the `layout` a list names. */
export const PERMIT_LIST_READERS = Object.freeze({
  register: readRegisterList,
  decisions: readDecisionTable,
  lyon: readLyonList,
  // A page says by its header which grid it is: Argenteuil posted two filing
  // sheets among its decisions in 2026, and its own title is what is right.
  grid: (document) => [...readGridTable(document, GRID_FILINGS), ...readGridTable(document, GRID_DECISIONS)],
  'annecy-filings': (document) => readBandTable(document, annecySpec(PERMIT_LIST_BOARDS.filings)),
  'annecy-decisions': (document) => readBandTable(document, annecySpec(PERMIT_LIST_BOARDS.decisions)),
  versailles: readVersaillesList,
  // The page's header says which of its two reports it is.
  clermont: (document) => [
    ...readBandTable(document, CLERMONT_DECISIONS),
    // A filing whose decision is listed beside it says so itself.
    ...readBandTable(document, CLERMONT_FILINGS),
  ],
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
  'parcels',
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
 * tacite`, `retiré`, `Dossier irrecevable`; Béziers's `Favorable avec
 * prescriptions`; Argenteuil's `Tacite` (four rows of 2026, a tacit grant)
 * and `Rapporté` (two, a decision taken back). Cart@DS's reader takes every
 * one but `retiré` and `Rapporté` — closed, like `Retrait` — `Tacite`, and
 * Lyon's `Délivré`, the word of the section a decision is listed under,
 * which lists grants — and `Octroi` and `Octroi tacite`, Mulhouse's and
 * Versailles's grants (482 rows of Versailles's 2026 lists). `Sursis à
 * statuer` is no decision on the merits, nor `Prorogation` a new one: both
 * keep their own words.
 *
 * @param {?string} verdict
 * @returns {?string} `accorde`, `refuse`, `annule`, or null.
 */
export function permitListVerdictState(verdict) {
  const state = cartdsVerdictState(verdict);
  if (state) return state;
  const value = String(verdict ?? '').trim();
  // i18n-ignore-start — the publishers' own verdicts, matched on
  if (/^retir[ée]|^rapport[ée]/i.test(value)) return 'annule';
  if (/^d[ée]livr[ée]|^tacite$|^octroi\b/i.test(value)) return 'accorde';
  // i18n-ignore-end
  return null;
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
 * The commune's code goes on six digits — Béziers's `34032` is Sitadel's
 * `034032`, as Tours's is (`localDossier` in `adsFeed.js`) — and Lyon's
 * split `069 387` is joined.
 *
 * @param {?string} raw `PC 013055 26 00230P0`, `PC 030189 06 P0166 M01`,
 *   `DP 069 387 25 00038 M02`, `DP 34032 26 T0848`.
 * @returns {?{kind: string, digits: string}} `digits` as Sitadel writes them,
 *   without the family: `0130552600230`, `03018906P0166M01`,
 *   `0693872500038M02`, `03403226T0848`.
 */
export function permitListDossier(raw) {
  const match = DOSSIER_RE.exec(text(raw) ?? '');
  if (!match) return null;
  const [, kind, commune, year, counter, , suffix] = match;
  const code = commune.replace(/\s/g, '').padStart(6, '0');
  return { kind: kind.toUpperCase(), digits: `${code}${year}${counter.toUpperCase()}${(suffix ?? '').toUpperCase()}` };
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
 *   read last (Trap 3); it says « under review » only for a city whose list
 *   of filings is a list of dossiers under review (`underReview`).
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
  } else if (current && city.underReview) {
    state = 'instruction';
    stateLabel = stateFrench('instruction');
  }
  const housing = number(row.housing);
  const parcels = listParcels(row.parcels);
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
    parcels: parcels.map((parcel) => parcel.label),
    parcelIdus: cartdsParcelIdus(parcels, city.insee),
    landAreaM2: number(row.landArea),
    housing: housing && housing > 0 ? housing : null,
    // `Surface plancher créée : 0 m²` says no floor area is created.
    surfaceCreatedM2: number(row.floorArea) || null,
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
