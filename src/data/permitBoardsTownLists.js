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
import { listVerdict, verdictCell } from './permitBoardsLists.js';
import { paddedDay, readReportTable, reportApplicant, reportDossier } from './permitBoardsReports.js';
import { municipalDate, municipalSite } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';

const verdicts = messages.definition;

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const joined = (lines) => clean((lines ?? []).join(' ')) || null;
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const area = (value) => /(\d[\d\s]*(?:[.,]\d+)?)/.exec(clean(value))?.[1]?.replace(/\s/g, '') ?? null;

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
/** « Dossiers décidés jusqu'au … »: Noisy-le-Roi breaks « Numéro de dossier » over two lines, Auchel does not. */
const DECIDED_UNTIL_COLUMNS = [
  ['dossier', 'NUMERO DE DOSSIER', { optional: true }], ['dossier', 'NUMERO DE', { optional: true }],
  ['applicant', 'PETITIONNAIRE'], ['verdict', 'DECISION'], ['decidedOn', 'DATE DE'],
  ['purpose', 'NATURE DES TRAVAUX'], ['site', 'ADRESSE DES TRAVAUX'], ['floor', 'SURFACE'],
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
/** Les Houches's site and works headers, on one line or two: « Adresse de » over « l'opération ». */
const HOUCHES_SITE_RE = /^ADRESSE DE(?: L['’]OPERATION)?$/;
const HOUCHES_WORKS_RE = /^NATURE DES(?: TRAVAUX)?$/;
const HOUCHES_VERDICT_RE = /\b(?:OPPOSITION|FAVORABLE|ACCORD|REFUS|REJET|SANS SUITE|RETRAIT|ANNUL|CADUC|SURSIS|IRRECEVABLE)/i;
/** `28/09/26` or `02/10/2026`; Les Houches also prints `02/10/206`, which is no day. */
const ANY_YEAR_DAY_RE = /^\d{2}\/\d{2}\/(?:\d{2}|\d{4})$/;
/** La Flotte's filing day, at the start of a cell it shares with the applicant: `21/08/2026ESSENTIEL NOTAIRES`. */
const LEADING_DAY_RE = /^[[\]|]?\s*(\d{2}\/\d{2}\/\d{4})/;
/** The time allowed, last cell of La Flotte's rows: `2 mois`, `1mois`. */
const DEADLINE_TAIL_RE = /\s*\b\d\s*mois\s*$/i;
/** A line of parcels under Lion-sur-Mer's site: `AC 29`, `AB 1168 et AB 95`, `ZA 72`. */
const PARCELS_LINE_RE = /^[A-Z]{1,2}\s?\d/;
/** Lion-sur-Mer's decision, on its number's line: `accord le 07/08/2026`, `retrait le 17/09/2026`. */
const SAID_ON_RE = /^(\p{L}[\p{L}\s-]*?)\s+le\s+(\d{2}\/\d{2}\/\d{4})$/u;
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

/** The town's name as its label gives it, letters only: `Ville de Limeil-Brévannes — …` → `LIMEILBREVANNES`. */
const townLetters = (city) => fold(String(city?.label ?? '').split(/\s+[—–]\s+/)[0]
  .replace(/^(?:Ville|Commune) (?:de la |de l[’']|de |d[’']|du |des )/i, '')).replace(/[^A-Z]/g, '');

/**
 * A row whose site cell names no site — the postcode and town alone
 * (Moëlan's « 29350 Moëlan-sur-Mer », Saint-Cyr-l'École's « 78210 SAINT-CYR-
 * L'ÉCOLE »), the town's name alone (Limeil-Brévannes), or glyphs the PDF's
 * font maps to nothing (Saint-Cyr-l'École's « ���� ») — keeps its dossier
 * and loses the site, rather than standing at the town's centre.
 */
function namedSite(item, city) {
  const address = item.address ?? '';
  const letters = fold(address).replace(/[^A-Z]/g, '');
  const none = /^\d{5}\b/.test(address) || address.includes('\uFFFD') || !letters || letters === townLetters(city);
  return item.address && none ? { ...item, address: null } : item;
}

/**
 * « Dossiers déposés avant le 23 septembre 2026 », under « VILLE DE … /
 * URBANISME »: every dossier still under instruction, a family to a section
 * and a row per dossier under Date de dépôt | Numéro de dossier |
 * Pétitionnaire | Adresse du projet | Description du projet, each cell
 * hanging from the row's top, the street over the postcode and town. One
 * software prints it, typed over in Word by some towns: Moëlan-sur-Mer
 * (ten pages on 23 September 2026), Limeil-Brévannes, Saint-Cyr-l'École,
 * Noisy-le-Roi, Auchel, Champhol and Saint-Rémy, every few weeks;
 * Saint-Jean-d'Angély posts a one-row edition per avis de dépôt. Columns
 * are where the rows' cells start ({@link dataColumns}), since each town
 * sets its headers its own way: a list with no full row is read as none.
 * On the editions of late September 2026 it read 28 filings at Moëlan
 * where header-placed columns read 25 and Word's cell boxes 23.
 */
export function readFiledBeforeList(document, { city, file }) {
  const field = dataColumns(document, ['filedOn', 'dossier', 'applicant', 'site', 'purpose'], DAY_RE);
  if (!field) return [];
  return readReportTable(document, {
    columns: FILED_BEFORE_COLUMNS, rule: 'nearest', field, place: 'top', head: HEAD_RE, noise: NOISE_RE,
    anchor: (text) => reportDossier(text, city),
    section: (text) => (FAMILY_RE.test(text) ? { title: text } : null),
    build: (cells, section, dossier) => namedSite(row(city, 'filings', {
      dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant),
      purpose: joined(cells.purpose), filedOn: paddedDay(joined(cells.filedOn)), postedOn: file?.published ?? null,
    }), city),
  });
}

/**
 * « Dossiers décidés jusqu'au … », the same software's decisions: Numéro de
 * dossier | Pétitionnaire | Décision | Date de signature | Nature des
 * travaux | Adresse des travaux | Surface. Every cell hangs from its row's
 * top and starts at or a little left of its header: a run goes to the
 * header starting nearest it. The applicant cell stacks a person over a
 * company: its first line that reads as an organisation is kept, never a
 * person ({@link reportApplicant}), as on the filings. A site cell
 * holding the town alone is no site ({@link namedSite}). On the editions of
 * September 2026: Moëlan 65 decisions, Limeil-Brévannes 44, Auchel 42,
 * Noisy-le-Roi 23, Saint-Cyr-l'École 21, Saint-Rémy 19 — at Saint-Rémy two
 * sites on consecutive rows stay apart, where centred columns ran them
 * together.
 */
export function readDecidedUntilList(document, { city, file }) {
  return readReportTable(document, {
    columns: DECIDED_UNTIL_COLUMNS, extra: ['DOSSIER', 'SIGNATURE'], rule: 'nearest', place: 'top',
    head: HEAD_RE, noise: /^Page \d+/i, anchor: (text) => reportDossier(text, city), // i18n-ignore-line — the footer's word
    build: (cells, section, dossier) => namedSite({
      ...row(city, 'decisions', {
        dossier, site: joined(cells.site), applicant: reportApplicant(cells.applicant), purpose: joined(cells.purpose),
        verdict: listVerdict(verdictCell(cells.verdict)) ?? verdicts.signed.fr, decidedOn: paddedDay(joined(cells.decidedOn)),
        postedOn: file?.published ?? null,
      }),
      floorArea: area(joined(cells.floor)),
    }, city),
  });
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

/** A day no later than the edition that prints it: Les Houches dates a decision `08/09/2062`. */
const notAfter = (day, file) => (day && file?.published && day > file.published ? null : day ?? null);

/** The x most runs start at, ties to the right: where a left-aligned column's cells start. */
function cellStart(runs) {
  const counts = new Map();
  for (const run of runs) counts.set(Math.round(run.x), (counts.get(Math.round(run.x)) ?? 0) + 1);
  let best = null;
  for (const [x, count] of counts) if (best === null || count > counts.get(best) || (count === counts.get(best) && x > best)) best = x;
  return best;
}

/**
 * A column's lines in blocks — lines closer than a line and a half — each
 * block given to the number nearest its middle, within `reach` points: a
 * cell centred on its row, however tall, goes to its row.
 */
function blocksByNumber(anchors, runs, reach) {
  const out = new Map();
  const blocks = [];
  for (const run of [...runs].sort((a, b) => b.y - a.y)) {
    const block = blocks.at(-1);
    if (block && block.at(-1).y - run.y <= 1.6 * (run.size || 7)) block.push(run);
    else blocks.push([run]);
  }
  for (const block of blocks) {
    const middle = (block[0].y + block.at(-1).y) / 2;
    const anchor = anchors.reduce((best, item) => (Math.abs(item.y - middle) < Math.abs(best.y - middle) ? item : best));
    if (Math.abs(anchor.y - middle) <= reach) out.set(anchor, [...(out.get(anchor) ?? []), ...block.map((run) => clean(run.text))]);
  }
  return out;
}

/**
 * Les Houches's « Avis de dépôt » and « Décisions », two files posted every
 * Friday (`Avis-de-depot_demandes-durbanisme_02.10.2026.pdf`,
 * `Decisions-autorisations-durbanisme_02.10.2026.pdf`), a table to a family
 * (« AVIS DE DÉPÔT DÉCLARATIONS PRÉALABLES », « DÉCISIONS PERMIS DE
 * CONSTRUIRE » …), each under a header set anew and continued on the next
 * pages without one: the day (filed, or the decision posted), the number,
 * the applicant's name, THE APPLICANT'S OWN POSTAL ADDRESS, the site
 * (« Adresse de l'opération »), the works, the floor area, and on the
 * decisions the verdict and its day. Cells start at their column's left
 * edge under a centred header and are centred on their row. The site is read
 * from its column alone: the runs that start where most cells start under
 * its header — 8 to 25 points left of it, the applicant's address 117 or
 * more — within a line or two of their number. Neither the name nor the
 * applicant's address is ever read. The editions of 2 October 2026: 47
 * filings, filed since 7 April, and 58 decisions, signed since 3 August.
 */
function readHouchesList(document, { city, file }, board) {
  const rows = [];
  let section = null;
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    const anchors = runs.filter((run) => HEAD_RE.test(clean(run.text)) && reportDossier(run.text, city)).sort((a, b) => b.y - a.y);
    const bands = [{ top: Infinity, section }];
    for (const header of runs.filter((run) => fold(run.text) === 'NUMERO DE DOSSIER').sort((a, b) => b.y - a.y)) {
      const near = (re) => runs.filter((run) => re.test(fold(run.text)) && Math.abs(run.y - header.y) < 15)
        .sort((a, b) => Math.abs(a.y - header.y) - Math.abs(b.y - header.y))[0] ?? null;
      section = { site: near(HOUCHES_SITE_RE), works: near(HOUCHES_WORKS_RE) };
      bands.push({ top: header.y, section });
    }
    bands.forEach((band, i) => {
      const bottom = bands[i + 1]?.top ?? -Infinity;
      const mine = anchors.filter((anchor) => anchor.y < band.top && anchor.y > bottom);
      if (!mine.length || !band.section?.site) return;
      const reach = (run, points) => mine.some((anchor) => Math.abs(anchor.y - run.y) <= points);
      const siteHeader = band.section.site;
      const siteX = cellStart(runs.filter((run) => run.x >= siteHeader.x - 45 && run.x <= siteHeader.x + 3 && reach(run, 12)));
      const worksX = siteX === null || !band.section.works ? null
        : cellStart(runs.filter((run) => run.x > siteX + 40 && run.x <= band.section.works.x + 3 && reach(run, 40)));
      const sites = siteX === null ? new Map() : blocksByNumber(mine, runs.filter((run) => Math.abs(run.x - siteX) < 2), 12);
      const works = worksX === null ? new Map() : blocksByNumber(mine, runs.filter((run) => Math.abs(run.x - worksX) < 2), 25);
      for (const anchor of mine) {
        const line = runs.filter((run) => run !== anchor && Math.abs(run.y - anchor.y) < 3);
        const days = line.filter((run) => ANY_YEAR_DAY_RE.test(clean(run.text))).sort((a, b) => a.x - b.x);
        const first = days.find((run) => run.x < anchor.x);
        const last = days.filter((run) => run.x > anchor.x).at(-1);
        const said = line.filter((run) => run.x > anchor.x && HOUCHES_VERDICT_RE.test(clean(run.text))).map((run) => clean(run.text))[0];
        const day = (run) => (run ? notAfter(paddedDay(clean(run.text)), file) : null);
        rows.push(row(city, board, {
          dossier: reportDossier(anchor.text, city), site: joined(sites.get(anchor)), purpose: joined(works.get(anchor)),
          filedOn: board === 'filings' ? day(first) : null,
          postedOn: (board === 'decisions' ? day(first) : null) ?? file?.published ?? null,
          verdict: board === 'decisions' && said ? listVerdict(said) ?? null : null,
          decidedOn: board === 'decisions' ? day(last) : null,
        }));
      }
    });
  }
  return rows;
}

/**
 * La Flotte's « AVIS DE DÉPÔT » of a fortnight or a month (« Du 22 août au
 * 25 septembre 2026 »), a spreadsheet printed to PDF or, most weeks,
 * scanned: number, the filing day run into the applicant's name
 * (`21/08/2026ESSENTIEL NOTAIRES`), parcels, the site (« Adresse du
 * terrain »), the time allowed (« 2 mois »). A scan is read by OCR, a word
 * to a run. Cells sit on their row's last line, a long one wrapped above it:
 * a row is its number's line and the lines above it, up to the row before.
 * The site is what starts right of « Adresse », its deadline cut off; the
 * day is read off the start of its cell, and the applicant's name after it
 * is never read. A number read twice on one list is OCR's misreading of
 * another (the second scan of 25 September 2026 reads DP 00138 as DP
 * 00128, beside the real one): both rows are dropped rather than one site
 * pinned to the wrong dossier. The scan of 25 September 2026: 44 filings
 * and certificates since 25 August.
 */
export function readLaFlotteFilings(document, { city, file }) {
  const rows = [];
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    // OCR may print a cell's rule as a bracket: `[Dossier`.
    const head = runs.find((run) => fold(run.text).replace(/[^A-Z]/g, '') === 'DOSSIER');
    const address = runs.find((run) => /^ADRESSE\b/.test(fold(run.text)));
    if (!head || !address) continue;
    const firsts = runs.filter((run) => run.y < head.y - 3 && Math.abs(run.x - head.x) < 8 && /^(?:PC|DP|PA|PD|CU|AT|AP)\b/.test(clean(run.text)))
      .sort((a, b) => b.y - a.y);
    let above = head.y - 3;
    for (const first of firsts) {
      const line = runs.filter((run) => Math.abs(run.y - first.y) < 3).sort((a, b) => a.x - b.x);
      const dated = line.find((run) => run.x > first.x && LEADING_DAY_RE.test(clean(run.text)));
      const number = line.filter((run) => run.x >= first.x && (!dated || run.x < dated.x)).map((run) => clean(run.text)).join(' ')
        .replace(/\bM[O0](\d)\b/g, 'M0$1'); // OCR reads M01 as `MO1`
      const dossier = reportDossier(number, city);
      const cells = runs.filter((run) => run.y < above && run.y > first.y - 3 && run.x >= address.x - 6)
        .sort((a, b) => (b.y - a.y) || (a.x - b.x));
      above = first.y - 3;
      if (!dossier) continue;
      const site = clean(cells.map((run) => run.text).join(' ').replace(/[[\]|]/g, ' ')).replace(DEADLINE_TAIL_RE, '');
      rows.push(row(city, 'filings', {
        dossier, site: site || null, filedOn: dated ? notAfter(paddedDay(LEADING_DAY_RE.exec(clean(dated.text))[1]), file) : null,
        postedOn: file?.published ?? null,
      }));
    }
  }
  const seen = new Map();
  for (const item of rows) seen.set(item.dossier, (seen.get(item.dossier) ?? 0) + 1);
  return rows.filter((item) => seen.get(item.dossier) === 1);
}

/**
 * Lion-sur-Mer's « LISTE DES AVIS DE DEPOT », a table to a family
 * (« Déclaration Préalable », « Permis de construire »), each row a stack:
 * the number over the day it was posted, the applicant centred beside them,
 * the site over its parcels (« Lieu des travaux » over « Références
 * cadastrales »), the works, floor area, height and filing day. A row runs
 * from its number down to the next number of any kind; the site is the
 * lines of the column under « Références cadastrales » but the parcels; the
 * applicant, centred well left of it, is never read. The list of 2
 * October 2026: 31 rows, filed since 3 April, works authorisations left out.
 */
export function readLionFilings(document, { city, file }) {
  const rows = [];
  let columns = null;
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    const cadastre = runs.find((run) => fold(run.text) === 'REFERENCES CADASTRALES');
    const area = runs.find((run) => fold(run.text) === 'SURFACE');
    if (cadastre) columns = { site: cadastre.x, area: area?.x ?? Infinity };
    if (!columns) continue;
    // Every number bounds a row, a works authorisation's too; a header ends one.
    const bounds = runs.filter((run) => run.x < columns.site - 100 && (HEAD_RE.test(clean(run.text)) || fold(run.text) === 'N° DE DOSSIER'))
      .sort((a, b) => b.y - a.y);
    bounds.forEach((anchor, i) => {
      const dossier = HEAD_RE.test(clean(anchor.text)) ? reportDossier(anchor.text, city) : null;
      if (!dossier) return;
      const below = bounds[i + 1]?.y ?? -Infinity;
      const band = runs.filter((run) => run !== anchor && run.y < anchor.y + 6 && run.y > below + 6);
      const site = band.filter((run) => Math.abs(run.x - columns.site) < 3 && !PARCELS_LINE_RE.test(clean(run.text)))
        .sort((a, b) => b.y - a.y).map((run) => clean(run.text));
      const purpose = band.filter((run) => run.x > columns.site + 150 && run.x < columns.area - 20).sort((a, b) => b.y - a.y).map((run) => clean(run.text));
      const days = band.filter((run) => DAY_RE.test(clean(run.text)));
      const posted = days.find((run) => run.x < columns.site);
      const filed = days.find((run) => run.x > columns.area);
      rows.push(row(city, 'filings', {
        dossier, site: joined(site), purpose: joined(purpose),
        filedOn: filed ? paddedDay(clean(filed.text)) : null, postedOn: (posted ? paddedDay(clean(posted.text)) : null) ?? file?.published ?? null,
      }));
    });
  }
  return rows;
}

/**
 * Lion-sur-Mer's « AUTORISATIONS D'URBANISME DÉLIVRÉES », two cards to a
 * row: the number and, on its line, the decision with its day (« accord le
 * 07/08/2026 », « refus le … », « retrait le … »), then a label to a line —
 * « Avis de dépôt en date du : », « Bénéficaire : », « Sur un terrain sis
 * : », « nature des travaux : », « Affichage en mairie le : » — and its
 * value in the card's second column. A card runs down to the next number on
 * its side; a value belongs to the label whose line is nearest, the site
 * only on its label's own line; the beneficiary's value is never read. 21
 * decisions on 2 October 2026, signed since 7 August.
 */
export function readLionDecisions(document, { city, file }) {
  const rows = [];
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    const right = Math.max(...runs.filter((run) => fold(run.text).startsWith('SUR UN TERRAIN SIS')).map((run) => run.x)) - 5;
    const sideOf = (run) => (run.x >= right ? 'right' : 'left');
    const heads = runs.filter((run) => /^[A-Z]{2}\s*\d/.test(clean(run.text)) && runs.some((label) => Math.abs(label.x - run.x) < 5 && fold(label.text).startsWith('SUR UN TERRAIN SIS')))
      .sort((a, b) => b.y - a.y);
    for (const anchor of heads) {
      const dossier = HEAD_RE.test(clean(anchor.text)) ? reportDossier(anchor.text, city) : null;
      if (!dossier) continue;
      const below = heads.find((run) => run.y < anchor.y - 3 && sideOf(run) === sideOf(anchor))?.y ?? -Infinity;
      const card = runs.filter((run) => run !== anchor && sideOf(run) === sideOf(anchor) && run.y < anchor.y + 4 && run.y > below + 4);
      const labels = card.filter((run) => Math.abs(run.x - anchor.x) < 5 && run.y < anchor.y - 3);
      const values = card.filter((run) => run.x > anchor.x + 100);
      const said = values.map((run) => Math.abs(run.y - anchor.y) <= 3 ? SAID_ON_RE.exec(clean(run.text)) : null).find(Boolean);
      const valueOf = (word, { ownLine = false } = {}) => {
        const label = labels.find((run) => fold(run.text).startsWith(word));
        if (!label) return null;
        return joined(values.filter((run) => run.y < anchor.y - 3 && (ownLine ? Math.abs(run.y - label.y) <= 2
          : labels.reduce((best, item) => (Math.abs(item.y - run.y) < Math.abs(best.y - run.y) ? item : best)) === label))
          .sort((a, b) => b.y - a.y).map((run) => run.text));
      };
      rows.push(row(city, 'decisions', {
        dossier, site: valueOf('SUR UN TERRAIN SIS', { ownLine: true }), purpose: valueOf('NATURE DES TRAVAUX'),
        filedOn: paddedDay(valueOf('AVIS DE DEPOT EN DATE DU') ?? valueOf('DATE DE DEPOT')),
        postedOn: paddedDay(valueOf('AFFICHAGE EN MAIRIE LE')) ?? file?.published ?? null,
        verdict: said ? listVerdict(said[1]) ?? null : null, decidedOn: said ? paddedDay(said[2]) : null,
      }));
    }
  }
  return rows;
}

export const TOWN_LIST_READERS = Object.freeze({
  'town-houches-filings': (document, context) => readHouchesList(document, context, 'filings'),
  'town-houches-decisions': (document, context) => readHouchesList(document, context, 'decisions'),
  'town-laflotte-filings': readLaFlotteFilings,
  'town-lion-filings': readLionFilings,
  'town-lion-decisions': readLionDecisions,
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
