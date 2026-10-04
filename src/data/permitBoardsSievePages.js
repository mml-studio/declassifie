/**
 * Boards found by the sieve of communes' own sites on 2026-10-03 that the
 * `posted-acts` and `posted-lists` protocols (`permitBoardsPostedLists.js`)
 * read once the link or the list is put the way they expect. See
 * `permitBoards.js` for the contract; the communes are in `sievePageCities.js`.
 *
 * `sieve-acts`: a page linking one PDF per act whose links spell the number
 * or the day in a way `posted-acts` does not read — Barentin's dotted
 * `ARRETE-2026.498-DP-076.057.26.00090-…`, La Frette-sur-Seine's
 * `PC 095 257 26 0 0009`, Beaussais-sur-Mer's `ARR_20261002_DP0222092600171.pdf`. Each link is rewritten with them
 * spelled out, those `source.skip` matches are dropped (Panazol's
 * certificates), and the links are put newest number first, so that the forty
 * undated acts `posted-acts` keeps are the newest; then read as it reads them.
 * A town that files its receipts apart (`source.filings`, a pattern on the
 * decoded address) has those acts on the filings board, read by
 * `source.filingLayout` when the act reader does not fit them (`source.layout`
 * for every act); one whose file
 * names mistype the day (`source.dayFromWords`) has it from the link's words.
 *
 * The list readers below are named by a town's `source.layouts`: Word and
 * Excel tables typed by the town itself, read by `readReportTable` — or row
 * by row where its blocks do not hold, a cell's lines as far apart as two
 * rows' (Pomponne) or a row's number printed last (Neuville-de-Poitou).
 * Applicants: an organisation at most, never a person; never the applicant's
 * own address, which four of these tables print.
 */
import { municipalDate, municipalDossier, municipalSite } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';
import { listParcelCell, listVerdict, verdictCell } from './permitBoardsLists.js';
import { POSTED_LIST_PROTOCOLS, postedListDay } from './permitBoardsPostedLists.js';
import { paddedDay, readReportTable, reportApplicant, reportDossier } from './permitBoardsReports.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const ENTITIES = { amp: '&', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ocirc: 'ô', ccedil: 'ç' }; // i18n-ignore-line — HTML entity names
const decode = (value) => String(value ?? '').replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (whole, name) => {
  if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return ENTITIES[name.toLowerCase()] ?? whole;
});
const plain = (html) => clean(decode(String(html ?? '').replace(/<[^>]*>/g, ' ')));
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").toUpperCase();
const joined = (lines) => clean((lines ?? []).join(' ')) || null;
const area = (value) => /(\d[\d\s]*(?:[.,]\d+)?)/.exec(clean(value))?.[1]?.replace(/\s/g, '') ?? null;

// --- One PDF per act, the number spelled out ----------------------------------

/**
 * A link's words with its number and day spelled out: `_` and `-` as spaces,
 * a dot between digits as a space (`076.057.26.00090.M01`), a counter split
 * after its first zero joined (La Frette-sur-Seine's `PC 095 257 26 0 0009`),
 * a day written as eight digits apart (`20261002`) as `2026 10 02`.
 * Garchizy names its declarations `DPC` (`DPC_058_121_26_N0010_…_arrete.pdf`)
 * and drops a digit of its lettered counter now and then (« DP 05812126
 * N007 »): the family is read as `DP`, a letter and three digits as the
 * letter and four, as `municipalDossier` keeps them (`N0007`, like Bégard's
 * `P0048`).
 */
export function spelledNumber(text) {
  return clean(String(text ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/(\d)\.(?=[\dMT])/g, '$1 ')
    .replace(/\b(PC|DP|PA|PD)((?:\s+\d{3}){2}\s+\d{2})\s+0\s+(\d{4})\b/gi, '$1$2 0$3')
    .replace(/\bDPC(?=\s*\d)/gi, 'DP')
    .replace(/\b(PC|DP|PA|PD)(\s*\d{3}\s*\d{3}\s*\d{2})\s*([A-Z])(\d{3})(?!\d)/gi, '$1$2 $30$4')
    .replace(/\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/g, '$1 $2 $3'));
}

/** The year and counter of a link's number, `2600125`, for newest first; '' for none. */
function numberKey(city, text) {
  const dossier = municipalDossier(text, city);
  return dossier ? dossier.split(' ').slice(2, 4).join('') : '';
}

/**
 * A page's links as plain anchors `posted-acts` reads: the number spelled
 * out in their words and title, the address's file name added to the title,
 * `source.skip` matches dropped, newest number first. `day` is the day the
 * link's own words name — after « mise en ligne » when they say it — for
 * `source.dayFromWords`.
 */
export function sieveActLinks(city, html) {
  const skip = city.source?.skip ? new RegExp(city.source.skip, 'i') : null;
  const links = [];
  for (const match of String(html ?? '').matchAll(/<a\b([^>]*?)\bhref\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decode(match[2]).trim();
    let path = href;
    try { path = decodeURIComponent(href); } catch { /* a stray % keeps the raw address */ }
    const title = decode(/\btitle\s*=\s*["']([^"']*)["']/i.exec(`${match[1]} ${match[3]}`)?.[1] ?? '');
    const words = plain(match[4]);
    if (skip?.test(`${path} ${words} ${title}`)) continue;
    const file = path.replace(/[?#].*$/, '').replace(/^.*\//, '').replace(/\.pdf$/i, '');
    const spelled = { words: spelledNumber(words), title: spelledNumber(`${title} ${file}`) };
    links.push({ href, ...spelled, day: postedListDay('', /\ben ligne\b(.*)$/i.exec(words)?.[1] ?? words), key: numberKey(city, `${spelled.words} ${spelled.title}`) });
  }
  return links.sort((a, b) => b.key.localeCompare(a.key));
}

const safe = (value) => value.replace(/&/g, '&amp;').replace(/[<>"]/g, ' ');
const postedActs = POSTED_LIST_PROTOCOLS['posted-acts'];

const sieveActsProtocol = {
  start: (city, options) => postedActs.start(city, options),
  index(city, html, request, options = {}) {
    const links = sieveActLinks(city, html);
    const page = links.map((link) => `<a href="${safe(link.href)}" title="${safe(link.title)}">${safe(link.words)}</a>`).join('\n');
    const found = postedActs.index(city, page, request, options);
    if (!found) return null;
    const filings = city.source?.filings ? new RegExp(city.source.filings, 'i') : null;
    // Charnay-lès-Mâcon writes « N° 2026_01_10 Mise en ligne le jeudi 01 octobre
    // 2026 » after each link, day and month swapped in some numbers and names.
    const days = new Map();
    if (city.source?.dayFromWords) {
      for (const link of links) {
        try { if (link.day) days.set(new URL(link.href, city.source?.linkBase ?? request.url).href, link.day); } catch { /* not an address */ }
      }
    }
    return {
      ...found,
      files: found.files.map((file) => {
        let address = file.url;
        try { address = decodeURIComponent(file.url); } catch { /* the raw address */ }
        const board = filings?.test(address) ? 'filings' : file.board;
        const published = days.get(file.url) ?? file.published;
        const layout = (board === 'filings' && city.source?.filingLayout) || city.source?.layout || file.layout;
        if (board === file.board && published === file.published && layout === file.layout) return file;
        return { ...file, board, layout, ...(published ? { published } : {}),
          row: file.row && { ...file.row, board, postedOn: published ?? file.row.postedOn } };
      }),
    };
  },
};

// --- Typed lists ---------------------------------------------------------------

// i18n-ignore-start — the tables' own headers, titles and footers
/** A number's first line, family and commune: `DP 78455 26`, `AT 78455`. */
const HEAD_RE = /^(?:PC|DP|PA|PD|CU|AT|AP)\s*\d/;
// i18n-ignore-end

/** A row with every field of the archive, those the town does not print null. */
function listRow(city, board, fields) {
  const site = municipalSite(fields.site, city);
  return {
    board, dossier: fields.dossier, label: null, purpose: fields.purpose ?? null,
    applicant: fields.applicant ?? null, address: site.address, postcode: site.postcode, locality: null,
    filedOn: fields.filedOn ?? null, verdict: fields.verdict ?? null, decidedOn: fields.decidedOn ?? null,
    postedOn: fields.postedOn ?? null, landArea: fields.landArea ?? null, housing: fields.housing ?? null, lots: null,
    floorArea: fields.floorArea ?? null, parcels: fields.parcels ?? site.parcels ?? null,
  };
}

// i18n-ignore-start — Chambray-lès-Tours's headers, family titles and footer
const CHAMBRAY_COLUMNS = [
  ['filedOn', 'DATE DE DEPOT'], ['dossier', 'NUMERO DU DOSSIER'], ['applicant', 'DEMANDEUR'],
  ['purpose', 'OBJET DES TRAVAUX'], ['site', 'ADRESSE DES TRAVAUX'], ['floor', 'SURFACE DE'],
];
const CHAMBRAY_FAMILY_RE = /^(?:D[ée]claration|Permis|Certificat|Autorisation)\b.*\(\d+\s*\/\s*\d+\)$/i;
const CHAMBRAY_NOISE = /^(?:Edit[ée] et affich[ée] le\b.*|\d+\s*\/\s*\d+|-)$/i;
// i18n-ignore-end

/**
 * Chambray-lès-Tours prints from Excel the dossiers filed and still under
 * review, « Dossiers déposés jusqu'au 29 septembre 2026 », a family to a page,
 * every cell centred on its row. Its applicant cell stacks the name over the
 * applicant's own address: its first line only is looked at, and kept only
 * when it is an organisation. The edition of 29 September 2026: 10 pages.
 */
function chambraySpec(city) {
  return {
    columns: CHAMBRAY_COLUMNS, extra: ['PLANCHER'], rule: 'centre', place: 'centre', gap: 1.6,
    head: HEAD_RE, noise: CHAMBRAY_NOISE, anchor: (text) => reportDossier(text, city),
    section: (text) => (CHAMBRAY_FAMILY_RE.test(text) ? { title: text } : null),
    build: (cells, section, dossier) => listRow(city, 'filings', {
      dossier, site: joined(cells.site), applicant: reportApplicant((cells.applicant ?? []).slice(0, 1)),
      purpose: joined(cells.purpose), filedOn: paddedDay(joined(cells.filedOn)), floorArea: area(joined(cells.floor)),
    }),
  };
}

// i18n-ignore-start — Villeneuve-Tolosane's register headers
const REGISTER_COLUMNS = [
  // The family and the number sit in two columns on one line: one field.
  ['dossier', 'TYPE'], ['dossier', 'N° ENREGISTREMENT'], ['filedOn', 'DATE'], ['applicant', 'DEMANDEUR'],
  // The applicant's own address: read so that it is no other cell, never kept.
  ['home', 'ADRESSE'], ['architect', 'ARCHITECTE'],
  ['site', 'ADRESSE2', { optional: true }], ['site', 'TERRAIN', { optional: true }],
  ['section', 'SECTION', { optional: true }], ['section', 'COLONNE1', { optional: true }],
  ['parcel', 'N°', { optional: true }], ['parcel', 'COLONNE2', { optional: true }],
  ['land', 'SUPERFICIE', { optional: true }], ['land', 'COLONNE3', { optional: true }],
  ['purpose', 'PROJET'], ['floor', 'SURFACE TAXABLE'], ['housing', 'NOMBRE'], ['tax', 'TAXE AMENAGEMENT'],
  ['postedOn', 'DATE AFFICHAGE DEPOT ADS'], ['decidedOn', 'DECISION'], ['verdict', 'COLONNE4'],
];
const REGISTER_EXTRA = ['DEMANDE', 'LOGEME', 'NTS', 'M²', 'ADRESSE2', 'SECTION', 'N°', 'SUPERFICIE', 'DATE', 'NATURE', 'ADRESSE'];
const REGISTER_HEAD_RE = /^(?:PC|DP|PA|PD)?\s*0?\d{2}\s?\d{3}\s/;
// i18n-ignore-end

/**
 * Villeneuve-Tolosane posts its year's registers of declarations and permits
 * from Excel, renamed at each update (`2026 DP 21 09 2026.pdf`): every dossier
 * of the year, its family and number in two cells, the applicant and his own
 * address, the site (`ADRESSE2`, `TERRAIN` on the permits'), its parcels, the
 * works, and the decision's day and verdict once there is one. A row is a
 * decision once it has a verdict, a filing until then. The registers of 21
 * September 2026: 157 declarations, 31 permits.
 */
function registerSpec(city) {
  return {
    columns: REGISTER_COLUMNS, extra: REGISTER_EXTRA, rule: 'centre', place: 'centre', gap: 1.6,
    head: REGISTER_HEAD_RE, noise: /^(?:\d+\s*\/\s*\d+|Page \d+.*)$/i, // i18n-ignore-line — the footer's word
    anchor: (text) => reportDossier(text, city),
    build: (cells, section, dossier) => {
      const verdict = listVerdict(verdictCell(cells.verdict));
      const board = verdict ? 'decisions' : 'filings';
      const section0 = joined(cells.section);
      const parcels = section0 && joined(cells.parcel) ? listParcelCell(`${section0} ${joined(cells.parcel)}`) : null;
      return listRow(city, board, {
        dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant), purpose: joined(cells.purpose),
        filedOn: paddedDay(joined(cells.filedOn)), parcels, landArea: area(joined(cells.land)),
        floorArea: area(joined(cells.floor)), housing: area(joined(cells.housing)),
        verdict, decidedOn: verdict ? paddedDay(joined(cells.decidedOn)) : null,
        postedOn: verdict ? null : paddedDay(joined(cells.postedOn)),
      });
    },
  };
}

// i18n-ignore-start — L'Huisserie's headers
const LHUISSERIE_COLUMNS = [
  ['dossier', 'N° DOSSIER'], ['applicant', 'DEMANDEUR'], ['site', 'ADRESSE DES TRAVAUX'], ['parcels', 'PARCELLE(S)'],
  ['purpose', 'NATURE DES TRAVAUX'], ['filedOn', 'DATE DE DEPOT'], ['verdict', 'DECISION'],
];
/** A number's first line, certificates (`CUB 53 119 …`) included so that their cells stay theirs. */
const LHUISSERIE_HEAD_RE = /^(?:PC|DP|PA|PD|CUB?|AT|AP)\s*\d/;
// i18n-ignore-end

/**
 * L'Huisserie posts two Excel tables refreshed in place and renamed by their
 * day (`Declaration-prealables-au-2-octobre-2026.pdf`, and one of permits and
 * certificates): every dossier of the year, its site, parcels, works, filing
 * day, and its verdict once there is one — a row is a decision then, a filing
 * until; no decision day is printed. Every cell is centred on its row. The
 * declarations of 2 October 2026: 102 dossiers.
 */
function lhuisserieSpec(city) {
  return {
    columns: LHUISSERIE_COLUMNS, rule: 'centre', place: 'centre', gap: 1.6,
    head: LHUISSERIE_HEAD_RE, noise: /^(?:\d+\s*\/\s*\d+|Page \d+.*)$/i, // i18n-ignore-line — the footer's word
    anchor: (text) => reportDossier(text, city),
    build: (cells, section, dossier) => {
      const verdict = listVerdict(verdictCell(cells.verdict));
      return listRow(city, verdict ? 'decisions' : 'filings', {
        dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant, { wrapped: true }),
        purpose: joined(cells.purpose), parcels: listParcelCell(joined(cells.parcels)),
        filedOn: paddedDay(joined(cells.filedOn)), verdict,
      });
    },
  };
}

// i18n-ignore-start — the notices' own labels and titles
/** A label, the field it gives, and whether its value runs on over the next lines. */
const NOTICE_LABELS = [
  // Capitalised, as the labels are: « terrain. » inside the works' paragraph is none.
  ['dossier', /^Num[ée]ro\s+(?:de\s+|du\s+)?[Dd]ossier\s*:?\s*(.+)$/], ['dossier', /^Enregistr[ée]e sous le num[ée]ro\s*:?\s*(.+)$/],
  ['filedOn', /^Date\s+de\s+d[ée]p[ôo]t\s*:?\s*(.+)$/], ['filedOn', /^D[ée]pos[ée]e le\s*:?\s*(.+)$/],
  ['site', /^Terrain\s*:?\s*(.+)$/], ['site', /^Concernant les travaux sis\s*:?\s*(.+)$/],
  ['parcels', /^R[ée]f[ée]rence\(s\) cadastrale\(s\)\s*:?\s*(.+)$/],
  ['purpose', /^Travaux\s*:?\s*(.+)$/, true], ['purpose', /^Nature du projet\s*:?\s*(.+)$/],
];
const NOTICE_END = /^(?:Fait [àa](?:\s|$)|Le \d{1,2}\b)/;
const TACIT_RE = /^D[ée]cision tacite\b/i;
// i18n-ignore-end

/**
 * A notice typed one per dossier, a label and its value on each line, the
 * applicant's name and own address never read. Charnay-lès-Mâcon's « Avis de
 * dépôt » prints « Numéro Dossier », « Date de dépôt », « Terrain » and
 * « Travaux » with its paragraph down to « Fait à »; the notices Rives posts
 * from its online filing service (« Avis de dépôt », « Décision tacite »)
 * print « Enregistrée sous le numéro », « Déposée le », « Concernant les
 * travaux sis », the parcels and « Nature du projet ». The act reader looks
 * for an order's wording and finds none. A tacit decision is a decision.
 */
export function readLabelledNotice(document, context) {
  const city = context?.city;
  const lines = [];
  for (const run of [...(document?.pages?.[0]?.runs ?? [])].sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    const line = lines.at(-1);
    // Rives sets a value two points below its label.
    if (line && Math.abs(line.y - run.y) < 3) line.text = clean(`${line.text} ${run.text}`);
    else lines.push({ y: run.y, text: clean(run.text) });
  }
  const found = {};
  lines.forEach((line, i) => {
    for (const [field, pattern, wraps] of NOTICE_LABELS) {
      const match = found[field] === undefined ? pattern.exec(line.text) : null;
      if (!match) continue;
      found[field] = match[1];
      if (!wraps) continue;
      for (const next of lines.slice(i + 1)) {
        if (NOTICE_END.test(next.text) || NOTICE_LABELS.some(([, label]) => label.test(next.text))) break;
        found[field] = clean(`${found[field]} ${next.text}`);
      }
    }
  });
  const dossier = found.dossier ? reportDossier(found.dossier, city) : null;
  if (!dossier) return [];
  const tacit = lines.slice(0, 3).some((line) => TACIT_RE.test(line.text));
  return [listRow(city, tacit ? 'decisions' : context?.file?.board ?? 'filings', {
    dossier, site: found.site ?? null, filedOn: paddedDay(found.filedOn), purpose: found.purpose ?? null,
    parcels: found.parcels ? listParcelCell(found.parcels.replace(/\b([A-Z]{1,2})0*(\d{1,4})\b/g, '$1 $2')) : null,
    verdict: tacit ? verdicts.tacit.fr : null,
  })];
}

// --- Tables read row by row ----------------------------------------------------

/** A run's centre: its glyphs' advances, or a guess where the font has none. */
const centreOf = (run) => (run.x + (Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x + 0.5 * (run.size || 7) * clean(run.text).length)) / 2;

/** A page's header labels (`[field, label, {optional}?]`, folded), each run used once; null when one is missing. */
function labelledHeader(runs, columns) {
  const used = new Set();
  const found = [];
  for (const [field, label, options] of columns) {
    const run = runs.filter((item) => !used.has(item) && fold(item.text) === label).sort((a, b) => a.x - b.x)[0];
    if (!run) {
      if (options?.optional) continue;
      return null;
    }
    used.add(run);
    found.push({ field, x: run.x, centre: centreOf(run), y: run.y });
  }
  return { bottom: Math.min(...found.map((column) => column.y)), columns: found.sort((a, b) => a.x - b.x) };
}

/** Runs as lines top to bottom, runs of one height joined left to right. */
function runLines(runs) {
  const lines = [];
  for (const run of [...runs].sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - run.y) < 1.5) line.runs.push(run);
    else lines.push({ y: run.y, runs: [run] });
  }
  return lines.map((line) => clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')));
}

// i18n-ignore-start — Pomponne's headers and the months its days print
const POMPONNE_COLUMNS = [
  ['filedOn', 'DATE DE'], ['dossier', 'NUMERO DOSSIER'], ['applicant', 'DEMANDEUR'],
  // The applicant's own address: placed so that it is no other cell, never read.
  ['home', 'ADRESSE DU DEMANDEUR'], ['site', 'ADRESSE DES TRAVAUX'],
  ['parcels', 'REFERENCE CADASTRE', { optional: true }], ['parcels', 'REFERENCE', { optional: true }],
  ['land', 'SURFACE DU'], ['purpose', 'NATURE DES TRAVAUX'], ['verdict', 'DECISION', { optional: true }], ['postedOn', 'AFFICHAGE'],
];
const POMPONNE_HEAD_RE = /^(?:PC|DP|PA|PD|CUB?|AT|AP)\s*\d/i;
const SHORT_MONTHS = ['JAN', 'FEV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOU', 'SEP', 'OCT', 'NOV', 'DEC'];
const DECIDED_RE = /^(.*?)\s+le\s+(\d{1,2}\/\d{1,2}\/\d{4})$/i;
// i18n-ignore-end

/** `4-mai`, `2-juil.`, `31-déc.`: a day and month without their year, `{month, day}`. */
function monthDay(value) {
  const match = /^(\d{1,2})\s*-\s*([A-Z]+)\.?$/.exec(fold(value));
  const month = match ? SHORT_MONTHS.findIndex((stem) => match[2].startsWith(stem)) + 1 : 0;
  return month ? { month, day: Number(match[1]) } : null;
}

const dayIn = (md, year) => (md ? municipalDate(`${year}-${String(md.month).padStart(2, '0')}-${String(md.day).padStart(2, '0')}`) : null);
/** The day and month on the reference day or the last before it. */
function onOrBefore(md, reference) {
  if (!md || !reference) return null;
  const year = Number(reference.slice(0, 4));
  const day = dayIn(md, year);
  return day && day <= reference ? day : dayIn(md, year - 1);
}
/** The day and month on the reference day or the first after it. */
function onOrAfter(md, reference) {
  if (!md || !reference) return null;
  const year = Number(reference.slice(0, 4));
  const day = dayIn(md, year);
  return day && day >= reference ? day : dayIn(md, year + 1);
}

/**
 * Pomponne posts two Excel tables every week, « Tableau d'affichage des
 * dépôts » and « … des décisions – semaine 38 », each every dossier since
 * May under one header: the filing day, the number (a modification on a
 * line below it), the applicant, THE APPLICANT'S OWN ADDRESS, the site, its
 * parcels, the land's area, the works, the decision and its day
 * (« NON-OPPOSITION le 27/07/2026 »), and the day it was posted. Cells are
 * centred both ways, and a cell's lines sit as far apart as two rows' do:
 * a row is the box its number's run is clipped to, and a run goes to the
 * header centred nearest it. Neither the applicant nor his address is read.
 *
 * The filing and posting days print without their year (« 4-mai »,
 * « 31-déc. »): a filing is of its number's year, or the last before the
 * decision; a posting the first on or after the decision or the filing; a
 * modification's filing the last before the newest day the table names.
 * The tables of week 38 of 2026: 14 filings and 10 decisions read, a number
 * mistyped (« PC 077 3372 24 00006 ») and a certificate left out.
 */
export function readPomponneTable(document, context, board) {
  const city = context?.city;
  let header = null;
  const anchors = [];
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    const found = labelledHeader(runs, POMPONNE_COLUMNS);
    if (found) header = found;
    if (!header) continue;
    const columns = header.columns;
    const fieldOf = (run) => columns.reduce((best, column) => (Math.abs(column.centre - centreOf(run)) < Math.abs(best.centre - centreOf(run)) ? column : best)).field;
    const body = runs.filter((run) => !found || run.y < found.bottom - 1);
    const heads = body.filter((run) => fieldOf(run) === 'dossier' && POMPONNE_HEAD_RE.test(clean(run.text))).sort((a, b) => b.y - a.y);
    const rows = heads.map((run, i) => {
      // A row's box is its number's clip; failing one, halfway to its neighbours.
      const clip = run.clip && run.clip.y1 - run.clip.y0 < 150 ? run.clip : null;
      const top = clip ? clip.y1 : i ? (heads[i - 1].y + run.y) / 2 : Infinity;
      const bottom = clip ? clip.y0 : i < heads.length - 1 ? (heads[i + 1].y + run.y) / 2 : -Infinity;
      return { top, bottom, cells: {} };
    });
    for (const run of body) {
      const row = rows.find((item) => run.y <= item.top && run.y >= item.bottom);
      if (row) (row.cells[fieldOf(run)] ??= []).push(run);
    }
    anchors.push(...rows);
  }
  const read = anchors.map(({ cells }) => {
    const lines = Object.fromEntries(Object.entries(cells).map(([field, runs]) => [field, runLines(runs)]));
    const dossier = reportDossier(joined(lines.dossier), city);
    if (!dossier) return null;
    const decision = joined(lines.verdict);
    const said = DECIDED_RE.exec(decision ?? '');
    const land = joined(lines.land);
    return {
      dossier, decidedOn: board === 'decisions' ? paddedDay(said?.[2]) : null,
      verdict: board === 'decisions' ? listVerdict(verdictCell([said ? said[1] : decision])) ?? verdicts.signed.fr : null,
      filed: monthDay(joined(lines.filedOn)), posted: monthDay(joined(lines.postedOn)),
      fields: { site: joined(lines.site), purpose: joined(lines.purpose), parcels: listParcelCell(joined(lines.parcels)),
        landArea: /^\d+$/.test(land ?? '') ? land : null },
    };
  }).filter(Boolean);
  // The filing's year: the decision's, else the number's; a modification's, the table's newest day's.
  for (const row of read) {
    const modified = / [MT]\d{2}$/.test(row.dossier);
    if (row.decidedOn) row.filedOn = onOrBefore(row.filed, row.decidedOn);
    else if (!modified) row.filedOn = dayIn(row.filed, 2000 + Number(row.dossier.split(' ')[2]));
    if (row.filedOn !== undefined || row.decidedOn) row.postedOn = onOrAfter(row.posted, row.decidedOn ?? row.filedOn);
  }
  const newest = context?.file?.published ?? read.map((row) => row.postedOn ?? row.decidedOn).filter(Boolean).sort().at(-1) ?? null;
  for (const row of read.filter((item) => item.filedOn === undefined && !item.decidedOn)) {
    row.filedOn = onOrBefore(row.filed, newest);
    row.postedOn = onOrAfter(row.posted, row.filedOn);
  }
  return read.map((row) => listRow(city, board, {
    dossier: row.dossier, ...row.fields, filedOn: row.filedOn ?? null, postedOn: row.postedOn ?? null,
    verdict: row.verdict, decidedOn: row.decidedOn,
  }));
}

// i18n-ignore-start — Neuville-de-Poitou's register: its headers, labels and footer
const NEUVILLE_COLUMNS = [
  ['dossier', 'DOSSIER'], ['dates', 'DATES'], ['applicant', 'DEMANDEUR'], ['site', 'TERRAIN'],
  // The register of dossiers under review ends on their deadline, the register of decisions on the decision.
  ['details', 'INFORMATIONS'], ['deadline', 'LIMITE', { optional: true }], ['verdict', 'DECISION', { optional: true }],
];
const NEUVILLE_FILED_RE = /^D[ée]pos[ée] le\s+(\d{1,2}\/\d{1,2}\/\d{4})/i;
const NEUVILLE_NUMBER_RE = /^(?:PC|DP|PA|PD|CU|AT)\s*\d/i;
const NEUVILLE_LAND_RE = /^superficie\s*:\s*(\d[\d\s]*(?:[.,]\d+)?)\s*m/i;
const NEUVILLE_WORKS_RE = /^Nature des travaux\s*:\s*(.*)$/i;
const NEUVILLE_HOUSING_RE = /^nombre de logements\s*:\s*(\d+)/i;
const NEUVILLE_FLOOR_RE = /^Surface de plancher totale [àa] construire\s*:\s*(\d[\d\s]*(?:[.,]\d+)?)\s*m/i;
const NEUVILLE_LABEL_RE = /^(?:nombre de logements|Surfaces? (?:de plancher|totales)|destination ou)\b/i;
const NEUVILLE_NOISE_RE = /^Page \d+\s*\/\s*\d+$/i;
// i18n-ignore-end

/**
 * Neuville-de-Poitou posts one file its software prints (TCPDF), refreshed in
 * place: the « Registre des dossiers en cours », every dossier under review
 * however old, then the « Registre des décisions », in six columns whose
 * headers are centred over left-aligned cells. A row hangs from its « Déposé
 * le » line: the family over the number in one cell (`DÉCLARATION PRÉALABLE`
 * / `CONSTRUCTION (Initiale)` / `DP 086177 26 N0062`, the number last), the
 * days, the applicant over HIS OWN ADDRESS, the site over its postcode and
 * the land's area, the works, dwellings and floor areas, and the deadline —
 * or, in the second register, the decision and its day (« Favorable le
 * 06/07/2026 »). A run goes to the first header starting right of it; the
 * applicant's cell is never read. A page whose header ends on « Décision »
 * holds decisions, any other filings. The edition of 4 September 2026:
 * 7 pages, 17 filings and 23 decisions read, works on ERP (`AT …`) left out.
 */
export function readNeuvilleRegister(document, context) {
  const city = context?.city;
  let header = null;
  const rows = [];
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text) && !NEUVILLE_NOISE_RE.test(clean(run.text)));
    const found = labelledHeader(runs, NEUVILLE_COLUMNS);
    if (found) header = found;
    if (!header) continue;
    const columns = header.columns;
    const board = columns.some((column) => column.field === 'verdict') ? 'decisions' : 'filings';
    const fieldOf = (run) => (columns.find((column) => column.x > run.x - 3) ?? columns.at(-1)).field;
    const body = runs.filter((run) => !found || run.y < found.bottom - 1);
    const tops = body.filter((run) => fieldOf(run) === 'dates' && NEUVILLE_FILED_RE.test(clean(run.text))).map((run) => run.y + 2).sort((a, b) => b - a);
    const bands = tops.map((top) => ({ top, board, runs: [] }));
    for (const run of body) {
      const band = bands.findLast((item) => run.y <= item.top);
      // Above the page's first row: the end of the row the page before broke off.
      (band ?? rows.at(-1))?.runs.push({ field: fieldOf(run), run });
    }
    rows.push(...bands);
  }
  return rows.map((row) => {
    const lines = {};
    for (const { field, run } of row.runs) (lines[field] ??= []).push(run);
    for (const field of Object.keys(lines)) lines[field] = runLines(lines[field]);
    const number = (lines.dossier ?? []).find((line) => NEUVILLE_NUMBER_RE.test(line));
    const dossier = number ? reportDossier(number, city) : null;
    if (!dossier) return null;
    const terrain = lines.site ?? [];
    const details = lines.details ?? [];
    const works = details.findIndex((line) => NEUVILLE_WORKS_RE.test(line));
    let purpose = null;
    if (works >= 0) {
      const tail = details.slice(works + 1);
      const end = tail.findIndex((line) => NEUVILLE_LABEL_RE.test(line) || NEUVILLE_WORKS_RE.test(line));
      purpose = joined([NEUVILLE_WORKS_RE.exec(details[works])[1], ...(end < 0 ? tail : tail.slice(0, end))]);
    }
    const first = (pattern, list) => list.map((line) => pattern.exec(line)?.[1]).find(Boolean) ?? null;
    const decision = row.board === 'decisions' ? joined(lines.verdict) : null;
    const said = DECIDED_RE.exec(decision ?? '');
    return listRow(city, row.board, {
      dossier, site: joined(terrain.filter((line) => !NEUVILLE_LAND_RE.test(line))), purpose,
      filedOn: paddedDay(first(NEUVILLE_FILED_RE, lines.dates ?? [])),
      landArea: area(first(NEUVILLE_LAND_RE, terrain)), housing: first(NEUVILLE_HOUSING_RE, details),
      floorArea: area(first(NEUVILLE_FLOOR_RE, details)),
      verdict: decision ? listVerdict(verdictCell([said ? said[1] : decision])) ?? verdicts.signed.fr : null,
      decidedOn: paddedDay(said?.[2]),
    });
  }).filter(Boolean);
}

const cityOf = (context) => context?.city;

export const SIEVE_PAGE_PROTOCOLS = Object.freeze({
  'sieve-acts': Object.freeze(sieveActsProtocol),
});
export const SIEVE_PAGE_READERS = Object.freeze({
  'chambray-filings': (document, context) => readReportTable(document, chambraySpec(cityOf(context))),
  'villeneuve-tolosane-register': (document, context) => readReportTable(document, registerSpec(cityOf(context))),
  'labelled-notice': readLabelledNotice,
  'lhuisserie-list': (document, context) => readReportTable(document, lhuisserieSpec(cityOf(context))),
  'pomponne-filings': (document, context) => readPomponneTable(document, context, 'filings'),
  'pomponne-decisions': (document, context) => readPomponneTable(document, context, 'decisions'),
  'neuville-de-poitou-register': readNeuvilleRegister,
});
export const SIEVE_PAGE_TEXT = Object.freeze({});
