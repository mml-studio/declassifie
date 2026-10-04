/**
 * PDF readers for the lists communes print from their own instruction
 * software and post on their site, read by `wp-media` or `posted-lists`
 * (`permitBoardsPostedLists.js`) with the commune's own `lists` patterns and
 * `layouts`. See `permitBoards.js` for the contract.
 *
 * Applicants: never a person. Every list here prints the applicant in a
 * column of its own; a reader takes the columns it names and keeps an
 * organisation at most.
 */
import { listVerdict } from './permitBoardsLists.js';
import { paddedDay, readReportTable, reportApplicant, reportDossier } from './permitBoardsReports.js';
import { municipalDate, municipalSite } from './municipalPermitsFeed.js';
import { DIGILOR_C_BOARD_READERS } from './permitBoardsDigilorC.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const joined = (lines) => clean((lines ?? []).join(' ')) || null;
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

// i18n-ignore-start — the lists' own headers and family titles
/** A number's first line: `DP 29150 26 00111`, `PC 017347`. */
const HEAD_RE = /^(?:PC|DP|PA|PD|CU|AT|AP)\s*\d/;
const FAMILY_RE = /^(?:D[ÉE]CLARATION PR[ÉE]ALABLE|PERMIS (?:DE|D'|D’)|AUTORISATION (?:PR[ÉE]ALABLE|DE TRAVAUX)|CERTIFICAT D|SUPPORTANT DE LA PUBLICIT)/i;
const NOISE_RE = /^(?:Page \d+ sur \d+|\d+\s*\/\s*\d+)$/i;
const DAY_RE = /^\d{2}\/\d{2}\/\d{4}$/;
/** « Numéro de dossier » on one line, or « Numéro de » over « dossier ». */
const FILED_BEFORE_COLUMNS = [
  ['filedOn', 'DATE DE DEPOT'], ['dossier', 'NUMERO DE DOSSIER', { optional: true }], ['dossier', 'NUMERO DE', { optional: true }],
  ['applicant', 'PETITIONNAIRE'], ['site', 'ADRESSE DU PROJET'], ['purpose', 'DESCRIPTION DU PROJET'],
];
/** Cesson-Sévigné's export: raw field names, one misspelt (« Natrue »), set over the cells as typed. */
const CIM_COLUMNS = [
  ['dossier', 'NUMERO'], ['decidedOn', 'DATE DECISION'],
  ['code', 'NATRUE DE LA DECISION', { optional: true }], ['code', 'NATURE DE LA DECISION', { optional: true }],
  ['code', 'DOSSIER.DECISIO'], ['code', 'DOSSIER.DECISIO'], ['verdict', 'DOSSIER.DECISIO'],
  ['nature', 'NATURE DU PROJET'], ['site', 'ADRESSE PROJET'], ['purpose', 'DOSS_PCR.TRAV_'],
];
const CIM_EXTRA = ['N_NATURE', 'N_NATURE_LONG', 'DESCRIPTION', 'EXTRACTION CIM'];
const CIM_NOISE = /^(?:Edit[ée] le .*|Page \d+\/\d+)$/i;
/** Aytré's day of filing, `19-juin-26`, `1-avr.-26`. */
const SHORT_DAY_RE = /^(\d{1,2})-([a-zéû]+)\.?-(\d{2})$/i;
const STREET_WORDS = 'rue|avenue|av\\.?|boulevard|bd|place|chemin|all[ée]e|impasse|route|quai|cours|square|sentier|ruelle|passage|r[ée]sidence|lotissement|voie|cit[ée]|clos|hameau|esplanade|venelle';
/** A site's cell: a house number then a street, or a street alone (`Chemin de la Gigas`). */
const ROMAGNAT_VERDICT_RE = /\b(?:ACCORD[ÉE]?E?|NON-OPPOSITION|OPPOSITION|REFUS[ÉE]?E?|FAVORABLE|RETRAIT|SURSIS|TACITE|REJET)\b/i;
const STREET_CELL_RE = new RegExp(`^(?:\\d{1,4}\\s*(?:[a-d]|bis|ter)?\\s*(?:[/-]\\s*\\d{1,4})?\\s+)?(?:${STREET_WORDS})\\b`, 'i');
const MARGNY_COLUMNS = {
  filings: [['dossier', 'N° DE DOSSIER'], ['filedOn', 'DATE DEPOT'], ['applicant', 'DEMANDEUR'], ['site', 'LIEUX DES TRAVAUX'],
    ['purpose', 'NATURE DES TRAVAUX']],
  decisions: [['dossier', 'N° DE DOSSIER'], ['filedOn', 'DATE DEPOT'], ['applicant', 'DEMANDEUR'], ['site', 'LIEUX DES TRAVAUX'],
    ['purpose', 'NATURE DES TRAVAUX'], ['verdict', 'DECISION']],
};
// i18n-ignore-end

/**
 * Where each column's cells start, read off the rows themselves: the median x
 * of each run over the lines that print all `fields` and open with
 * `first` (a filing day). Headers are set over their column in each
 * town's own way — Moëlan's left of its cells, Saint-Jean-d'Angély's centred
 * right of them — and a name must never land in the site's column.
 */
function dataColumns(document, fields, first) {
  const starts = fields.map(() => []);
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    for (const run of runs.filter((item) => first.test(clean(item.text)))) {
      const line = runs.filter((item) => Math.abs(item.y - run.y) < 1.5).sort((a, b) => a.x - b.x);
      if (line.length === fields.length && line[0] === run) line.forEach((item, i) => starts[i].push(item.x));
    }
  }
  if (starts.some((xs) => !xs.length)) return null;
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const columns = starts.map(median);
  return (run) => {
    let best = 0;
    columns.forEach((x, i) => { if (Math.abs(x - run.x) < Math.abs(columns[best] - run.x)) best = i; });
    return fields[best];
  };
}

function row(city, board, fields) {
  const site = municipalSite(fields.site, city);
  return {
    board, dossier: fields.dossier, applicant: fields.applicant ?? null, address: site.address, postcode: site.postcode,
    parcels: site.parcels, purpose: fields.purpose ?? null, filedOn: fields.filedOn ?? null,
    verdict: fields.verdict ?? null, decidedOn: fields.decidedOn ?? null, postedOn: fields.postedOn ?? null,
  };
}

/**
 * « Dossiers déposés avant le 23 septembre 2026 », under « VILLE DE … /
 * URBANISME »: every dossier still under instruction, a family to a section
 * and a row per dossier under Date de dépôt | Numéro de dossier |
 * Pétitionnaire | Adresse du projet | Description du projet, each cell
 * hanging from the row's top, the street over the postcode and town. Moëlan-
 * sur-Mer posts it every month or so (ten pages on 23 September 2026), and
 * its decisions as « Dossiers décidés jusqu'au … », which
 * `digilor-pontdeclaix-decisions` reads; Saint-Jean-d'Angély posts a
 * one-row edition per avis de dépôt. Columns are where the rows' cells start
 * ({@link dataColumns}): a list with no full row is read as none.
 */
export function readFiledBeforeList(document, { city, file }) {
  const field = dataColumns(document, ['filedOn', 'dossier', 'applicant', 'site', 'purpose'], DAY_RE);
  if (!field) return [];
  return readReportTable(document, {
    columns: FILED_BEFORE_COLUMNS, rule: 'nearest', field, place: 'top', head: HEAD_RE, noise: NOISE_RE,
    anchor: (text) => reportDossier(text, city),
    section: (text) => (FAMILY_RE.test(text) ? { title: text } : null),
    build: (cells, section, dossier) => row(city, 'filings', {
      dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant),
      purpose: joined(cells.purpose), filedOn: paddedDay(joined(cells.filedOn)), postedOn: file?.published ?? null,
    }),
  });
}

/**
 * « Dossiers décidés jusqu'au … », the same software's decisions: Le
 * Pont-de-Claix's columns (`digilor-pontdeclaix-decisions`). A site whose
 * street cell is empty prints the postcode and town alone (Moëlan's
 * « 29350 Moëlan-sur-Mer »): no site, rather than the town's centre.
 */
export function readDecidedUntilList(document, context) {
  return DIGILOR_C_BOARD_READERS['digilor-pontdeclaix-decisions'](document, context)
    .map((item) => (/^\d{5}\b/.test(item.address ?? '') ? { ...item, address: null } : item));
}

/**
 * Cesson-Sévigné's « Permis de construire accordés septembre 2026 », an
 * « Extraction CIM » of the month's granted permits: number, decision day,
 * three decision codes, the decision in words, the project's kind, the site
 * with its postcode and town, the works. No applicant column. Each cell
 * starts near its header's start; 12 permits for September 2026.
 */
export function readCimDecisions(document, { city, file }) {
  return readReportTable(document, {
    columns: CIM_COLUMNS, extra: CIM_EXTRA, rule: 'nearest', place: 'top', head: HEAD_RE, noise: CIM_NOISE,
    anchor: (text) => reportDossier(text, city),
    build: (cells, section, dossier) => row(city, 'decisions', {
      // « 1C rue du chêne Germain Lot B / CURANTIS - campus … »: the site stops at the slash.
      dossier, site: joined(cells.site)?.replace(/\s+\/\s.*$/, '') ?? null, purpose: joined(cells.purpose),
      verdict: listVerdict(joined(cells.verdict)) ?? null, decidedOn: paddedDay(joined(cells.decidedOn)),
      postedOn: file?.published ?? null,
    }),
  });
}

/**
 * Aytré's « URBANISME - AVIS DE DEPOT », a spreadsheet printed to PDF and
 * replaced every week (« Avis de dépôt au 2 octobre 2026 »): every filing
 * since April, one line each — day of filing (`19-juin-26`), the number in
 * four cells (`DP | 17028 | 26 | 59`, a modification glued to the applicant:
 * `177M1TARDY Olivier`), the applicant, the site, the works, floor area and
 * height. Cells of one line may sit a point or two apart. The number is
 * rebuilt from its cells; the site is the cell of the line that reads as a
 * street, right of the number and left of the works; the applicant's cell is
 * never read. 38 filings on 2 October 2026.
 */
export function readAytreFilings(document, { city, file }) {
  const rows = [];
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    const works = runs.find((run) => /^Nature$/i.test(clean(run.text)));
    for (const day of runs.filter((run) => SHORT_DAY_RE.test(clean(run.text)))) {
      const line = runs.filter((run) => Math.abs(run.y - day.y) < 3 && run.x > day.x).sort((a, b) => a.x - b.x);
      const [family, commune, year, counter] = line.slice(0, 4).map((run) => clean(run.text));
      const count = /^(\d{1,5})(M\d{1,2})?/.exec(counter ?? '');
      if (commune !== city.insee || !/^\d{2}$/.test(year ?? '') || !count) continue;
      // `reportDossier` pads the counter and the modification, and knows no AT.
      const dossier = reportDossier(`${family} ${commune} ${year} ${count[1].padStart(5, '0')}${count[2] ? ` ${count[2]}` : ''}`, city);
      if (!dossier) continue;
      const site = line.slice(4).find((run) => (!works || run.x < works.x - 20) && STREET_CELL_RE.test(clean(run.text)));
      const purpose = works ? line.find((run) => run.x >= works.x - 80 && run.x < works.x + 80 && run !== site) : null;
      const [, d, month, y] = SHORT_DAY_RE.exec(clean(day.text));
      rows.push(row(city, 'filings', {
        dossier, site: site ? clean(site.text) : null, purpose: purpose ? clean(purpose.text) : null,
        filedOn: municipalDate(`${d} ${month} 20${y}`), postedOn: file?.published ?? null,
      }));
    }
  }
  return rows;
}

/**
 * Margny-lès-Compiègne's « Liste des avis de dépôt des dossiers
 * d'urbanisme » and « Liste des décisions … », printed from its software
 * every few weeks: every cell centred under its centred header, rows eight
 * points apart and their cells one to eight points off the number's line.
 * A row is the cells within three points of its number, each in the column
 * whose header is centred nearest; the filing day, set lower, is the nearest
 * below the number and above the next. The applicant's column is never
 * read. 9 filings and 14 decisions on 17 September 2026.
 */
function readMargnyList(document, { city, file }, board) {
  const rows = [];
  const centre = (run) => (run.x + (Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x + 4 * clean(run.text).length)) / 2;
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    const header = MARGNY_COLUMNS[board].map(([field, label]) => [field, runs.find((run) => fold(run.text) === label)]);
    if (header.some(([, run]) => !run)) continue;
    const columnOf = (run) => header.reduce((best, item) => (Math.abs(centre(item[1]) - centre(run)) < Math.abs(centre(best[1]) - centre(run)) ? item : best))[0];
    const anchors = runs.filter((run) => run.y < header[0][1].y && HEAD_RE.test(clean(run.text)) && reportDossier(run.text, city))
      .sort((a, b) => b.y - a.y);
    anchors.forEach((anchor, i) => {
      const cells = {};
      for (const run of runs) {
        const field = columnOf(run);
        // The decision, centred on two lines (« FAVORABLE AVEC PRESCRIPTIONS »), may sit five points off.
        if (run === anchor || anchors.includes(run) || Math.abs(run.y - anchor.y) > (field === 'verdict' ? 5 : 3)) continue;
        (cells[field] ??= []).push(clean(run.text));
      }
      const next = anchors[i + 1]?.y ?? -Infinity;
      const filed = runs.filter((run) => columnOf(run) === 'filedOn' && DAY_RE.test(clean(run.text)) && run.y <= anchor.y + 3 && run.y > next && run.y > anchor.y - 10)
        .sort((a, b) => Math.abs(a.y - anchor.y) - Math.abs(b.y - anchor.y))[0];
      rows.push(row(city, board, {
        dossier: reportDossier(anchor.text, city), site: joined(cells.site), purpose: joined(cells.purpose),
        filedOn: filed ? paddedDay(clean(filed.text)) : null, postedOn: file?.published ?? null,
        verdict: board === 'decisions' ? listVerdict(joined(cells.verdict)) ?? null : null,
      }));
    });
  }
  return rows;
}

/**
 * Romagnat's two boards, « DEPOT DOSSIERS D'URBANISME » and « ARRETES
 * DOSSIERS D'URBANISME », one table each replaced in place every week or so
 * (« mis à jour le 01/10/2026 »), printed without a header row: number
 * (`DP 0633072600066@`), filing day, applicant, works, site, parcels, then
 * on the orders the signing day and the verdict (« ACCORDE »,
 * « NON-OPPOSITION »). Cells are centred, so columns drift with their text;
 * the site is the cell of the number's line that reads as a street, the
 * days are told apart by their order, and the applicant's cell is never
 * read; a site wrapped on two lines is read above and below its number, in
 * the column the other rows' sites give. On 1 October 2026: 78 filings since
 * May and 40 orders since July, all but two with their site.
 */
function readRomagnatBoard(document, { city, file }, board) {
  const rows = [];
  const centre = (run) => (run.x + (Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x + 4 * clean(run.text).length)) / 2;
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    const anchors = runs.filter((run) => HEAD_RE.test(clean(run.text)) && reportDossier(run.text, city));
    const lines = anchors.map((anchor) => runs.filter((run) => run !== anchor && Math.abs(run.y - anchor.y) < 2 && run.x > anchor.x).sort((a, b) => a.x - b.x));
    const onLine = lines.map((line) => line.find((run) => STREET_CELL_RE.test(clean(run.text))) ?? null);
    // A site wrapped on two lines sits above and below its number: the column is where the others are.
    const centres = onLine.filter(Boolean).map(centre).sort((a, b) => a - b);
    const column = centres[Math.floor(centres.length / 2)];
    anchors.forEach((anchor, i) => {
      const line = lines[i];
      let site = onLine[i] ? clean(onLine[i].text) : null;
      if (!site && column !== undefined) {
        const parts = runs.filter((run) => !anchors.includes(run) && Math.abs(run.y - anchor.y) < 9 && Math.abs(centre(run) - column) < 40)
          .sort((a, b) => b.y - a.y).map((run) => clean(run.text));
        if (parts.length && STREET_CELL_RE.test(parts[0])) site = parts.join(' ');
      }
      const days = line.filter((run) => DAY_RE.test(clean(run.text)));
      const at = onLine[i]?.x ?? column ?? Infinity;
      const filed = days.find((run) => run.x < at);
      const signed = board === 'decisions' ? days.find((run) => run.x > at) : null;
      const said = board === 'decisions' ? line.map((run) => clean(run.text)).filter((text) => ROMAGNAT_VERDICT_RE.test(text)).at(-1) : null;
      rows.push(row(city, board, {
        dossier: reportDossier(anchor.text, city), site,
        filedOn: filed ? paddedDay(clean(filed.text)) : null, decidedOn: signed ? paddedDay(clean(signed.text)) : null,
        verdict: said ? listVerdict(said) : null, postedOn: file?.published ?? null,
      }));
    });
  }
  return rows;
}

/**
 * La Salvetat-Saint-Gilles's « Autorisations d'urbanisme », one file a
 * family refreshed as decisions are signed (« Mis à jour le: 18/09/2026 »):
 * a card per dossier, labels and values in runs of their own — « Référence
 * : DP0315262600122 », « Déposé le : 28/08/2026 », « Adresse : 24 Avenue … »
 * — beside the applicant's column, the parcels and the decision
 * (« Accord, », « le 16/09/2026 », « Notifié le »). A card spans the space
 * between its neighbours' references; the applicant's column is never read.
 */
export function readLabelledCards(document, { city, file }) {
  const rows = [];
  const label = (runs, word) => runs.filter((run) => fold(run.text) === word);
  const valueOf = (runs, at) => {
    const value = runs.filter((run) => Math.abs(run.y - at.y) < 2 && run.x > at.x).sort((a, b) => a.x - b.x)[0];
    return value ? clean(value.text).replace(/^:\s*/, '') : null;
  };
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    const references = label(runs, 'REFERENCE').sort((a, b) => b.y - a.y);
    references.forEach((reference, i) => {
      const top = i ? (references[i - 1].y + reference.y) / 2 : Infinity;
      const bottom = i + 1 < references.length ? (reference.y + references[i + 1].y) / 2 : -Infinity;
      const card = runs.filter((run) => run.y < top && run.y > bottom);
      const dossier = reportDossier(valueOf(runs, reference) ?? '', city);
      if (!dossier) return;
      const near = (word) => label(card, word).sort((a, b) => Math.abs(a.y - reference.y) - Math.abs(b.y - reference.y))[0];
      const address = near('ADRESSE');
      const filed = near('DEPOSE LE');
      const right = card.filter((run) => run.x > (address?.x ?? 0) + 150).sort((a, b) => b.y - a.y).map((run) => clean(run.text));
      const said = right.find((text) => /^(?:Accord|Refus|Rejet|Opposition|Non[- ]opposition|Favorable|D[ée]favorable|Sursis|Retrait|Annulation|Caduc)/i.test(text));
      const signed = right.map((text) => /^le\s+(\d{2}\/\d{2}\/\d{4})$/i.exec(text)?.[1]).find(Boolean);
      rows.push(row(city, said ? 'decisions' : 'filings', {
        dossier, site: address ? valueOf(runs, address) : null, filedOn: filed ? paddedDay(valueOf(runs, filed)) : null,
        verdict: said ? listVerdict(said.replace(/[,\s]+$/, '')) : null, decidedOn: signed ? paddedDay(signed) : null,
        postedOn: file?.published ?? null,
      }));
    });
  }
  return rows;
}

/**
 * Quimperlé's PDF24 A3 lists have /Rotate 90: the text extractor's x runs
 * down the displayed page and its y runs across it. Rotate the coordinates
 * only after the table headers confirm that orientation. No page height is
 * needed: the existing readers use relative row positions. Page-coordinate
 * clipping boxes are discarded; absent advances use the table's width fallback.
 */
function quarterTurnList(document, context, reader, labels) {
  const first = document?.pages?.[0]?.runs ?? [];
  const headers = labels.map((label) => first.find((run) => clean(run.text) === label));
  if (headers.some((header) => !header)
    || headers.some((header) => Math.abs(header.x - headers[0].x) > 2)
    || headers.some((header, i) => i > 0 && header.y <= headers[i - 1].y)) return [];
  const pages = document.pages.map((page) => ({ runs: (page.runs ?? []).map((run) => ({
    ...run, x: run.y, x1: run.y, y: -run.x, clip: null,
  })) }));
  return reader({ pages }, context);
}

// i18n-ignore-start — the printed headers that confirm the rotated table
export const readQuarterTurnFilings = (document, context) => quarterTurnList(document, context, readFiledBeforeList,
  ['Date de dépôt', 'Numéro de', 'Pétitionnaire', 'Adresse du projet', 'Description du projet']);
export const readQuarterTurnDecisions = (document, context) => quarterTurnList(document, context, readDecidedUntilList,
  ['Numéro de dossier', 'Pétitionnaire', 'Décision', 'Date de', 'Nature des travaux', 'Adresse des travaux', 'Surface']);
// i18n-ignore-end

export const TOWN_LIST_READERS = Object.freeze({
  'town-labelled-cards': readLabelledCards,
  'town-romagnat-filings': (document, context) => readRomagnatBoard(document, context, 'filings'),
  'town-romagnat-decisions': (document, context) => readRomagnatBoard(document, context, 'decisions'),
  'town-margny-filings': (document, context) => readMargnyList(document, context, 'filings'),
  'town-margny-decisions': (document, context) => readMargnyList(document, context, 'decisions'),
  'town-aytre-filings': readAytreFilings,
  'town-cim-decisions': readCimDecisions,
  'town-filed-before': readFiledBeforeList,
  'town-decided-until': readDecidedUntilList,
  'town-quarter-turn-filings': readQuarterTurnFilings,
  'town-quarter-turn-decisions': readQuarterTurnDecisions,
});
export const TOWN_LIST_TEXT = Object.freeze({});
