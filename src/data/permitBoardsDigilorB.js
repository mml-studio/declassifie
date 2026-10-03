/**
 * PDF readers for the Digilor Datahall towns of batch B (`digilorTownsB.js`),
 * by `layout`. See `permitBoards.js` for the contract.
 *
 * Applicants: never a person. Saint-Laurent-du-Var prints the applicant's
 * name and own address in a column of its own: the readers take an
 * organisation's name at most, through `reportApplicant`, and never read the
 * applicant's address.
 */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';
import { readExtendedNotice } from './municipalPermitExtensions.js';
import { listVerdict, verdictCell } from './permitBoardsLists.js';
import { readReportTable, reportApplicant } from './permitBoardsReports.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toUpperCase();

/** `5 804,00`, `6 263,00 m²`: whole square metres, or null. */
function squareMetres(value) {
  const match = /(\d+(?:[\s.]\d{3})*)(?:,(\d+))?/.exec(clean(value));
  if (!match) return null;
  const whole = Number(match[1].replace(/[\s.]/g, ''));
  return Number.isFinite(whole) ? String(whole) : null;
}

/** An organisation's name, or null when the name is a legal form alone (`par SCI`, `SASU représentée par …`). */
function namedOrganisation(lines, options) {
  const found = reportApplicant(lines, options);
  return found && /\s/.test(found) ? found : null;
}

/** `AW320, AW26, a BK449`: the cadastral references a cell lists, letters lot marks dropped. */
function parcelList(lines) {
  const found = [...clean(lines.join(' ')).matchAll(/\b([A-Z]{1,2})\s?(\d{1,4})\b/g)].map((match) => `${match[1]} ${match[2]}`);
  return found.length ? [...new Set(found)].join(', ') : null;
}

/** Runs on one height (within `tolerance`), joined left to right, as lines top to bottom. */
function textLines(runs, tolerance = 1.5) {
  const lines = [];
  for (const run of [...runs].sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - run.y) < tolerance) line.runs.push(run);
    else lines.push({ y: run.y, runs: [run] });
  }
  return lines.map((line) => ({ y: line.y, text: clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')) }));
}

// --- Saint-Laurent-du-Var: the weekly lists of dossiers filed ---------------

// i18n-ignore-start — the lists' own headers and page furniture, matched on
const SAINT_LAURENT_COLUMNS = [
  ['filedOn', 'DATE DE DEPOT'], ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'NOM ET ADRESSE DU'],
  ['site', 'ADRESSE DES TRAVAUX'], ['land', 'SUPERFICIE'], ['nature', 'NATURE DES TRAVAUX'],
  ['floor', 'SURFACE DE'], ['housing', 'NOMBRE'], ['levels', 'NOMBRE DE'],
];
const SAINT_LAURENT_EXTRA = ['DEMANDEUR', 'REFERENCES CADASTRALES', 'DU TERRAIN', 'PLANCHER CREEE', 'EN M²', 'EN M2', 'DE', 'LOGEMENT', 'NIVEAUX'];
const SAINT_LAURENT_NOISE = /^(?:Page \d+ sur \d+|Document publi[ée] le\b.*)$/i;
/** Where the applicant's name stops: a representative, a person, or the applicant's own address. */
const SAINT_LAURENT_NAME_END = /^(?:\d|repr[ée]sent[ée]e?s?(?=\s|$)|(?:M|MME|MLLE|MR|MONSIEUR|MADAME)\b)/i;
/** `TOSCANO" SIS`, `SARL BEACH CLUB représentée par`: the address or the representative starting on a name's line. */
const SAINT_LAURENT_SEAT = /\s+(?:SIS|SISE|DEMEURANT|DOMICILI[ÉE]E?|REPR[ÉE]SENT[ÉE]E?S?)(?=\s|$).*$/i;
// i18n-ignore-end

/** The organisation an applicant cell names, its lines read up to whatever follows the name; or null. */
function saintLaurentApplicant(lines) {
  const name = [];
  for (const raw of lines ?? []) {
    const line = clean(raw);
    if (SAINT_LAURENT_NAME_END.test(line)) break;
    const cut = line.replace(SAINT_LAURENT_SEAT, '');
    if (cut) name.push(cut);
    if (cut !== line || name.length >= 6) break;
  }
  return namedOrganisation(name, { wrapped: true });
}

/**
 * Saint-Laurent-du-Var's weekly lists, one per family (« Permis de construire
 * déposés avant le 01.10.2026 », « Déclarations préalables déposées avant le
 * … », « Permis d'aménager », « Permis de démolir »): every dossier still under
 * instruction, newest first, each under a header of its own — Date de dépôt |
 * Numéro de dossier | Nom et adresse du demandeur | Adresse des travaux,
 * Références cadastrales | Superficie du terrain | Nature des travaux |
 * Surface de plancher créée | Nombre de logements | Nombre de niveaux — its
 * cells hanging from the number's line. The site cell prints the street, the
 * postcode and the town over two lines (`06700 Saint-Laurent-` / `du-Var`),
 * then the parcels (`AW320, AW26`). Measured on 2026-10-03: the PC list of
 * 1 October gives 32 of its 33 dossiers (the 33rd's site is `, Rond point
 * Maicon`, no number nor parcel), the DP list of 24 September 23 of 23.
 */
export function readSaintLaurentList(document, { city }) {
  return readReportTable(document, {
    columns: SAINT_LAURENT_COLUMNS, extra: SAINT_LAURENT_EXTRA, noise: SAINT_LAURENT_NOISE,
    rule: 'right', place: 'top', head: /^(?:PC|DP|PA|PD|CU)\s*\d/,
    anchor: (text) => municipalDossier(text, city),
    build: (cells, section, dossier) => {
      const siteLines = (cells.site ?? []).map(clean);
      const postal = siteLines.findIndex((line) => /^\d{5}\b/.test(line));
      const street = clean((postal < 0 ? siteLines.slice(0, 1) : siteLines.slice(0, postal)).join(' ')).split(/\s*,\s*/)[0];
      const site = municipalSite(street, city);
      const parcels = postal < 0 ? null : parcelList(siteLines.slice(postal + 1));
      if (!site.address && !parcels) return null;
      const housing = Number(clean((cells.housing ?? []).join(' ')).match(/^\d+/)?.[0] ?? NaN);
      return {
        board: 'filings', dossier,
        applicant: saintLaurentApplicant(cells.applicant),
        address: site.address, postcode: site.postcode ?? city.postcode, parcels,
        purpose: clean((cells.nature ?? []).join(' ').replace(/^-\s*/, '').replace(/\s+-\s+/g, ' ; ')) || null,
        filedOn: municipalDate(clean((cells.filedOn ?? []).join(' '))),
        landArea: squareMetres((cells.land ?? []).join(' ')),
        floorArea: squareMetres((cells.floor ?? []).join(' ')),
        housing: Number.isFinite(housing) && housing > 0 ? String(housing) : null,
      };
    },
  });
}

// --- Illkirch-Graffenstaden: the weekly lists of filings and decisions ------

// i18n-ignore-start — the lists' own headers, page furniture and verdicts, matched on
const ILLKIRCH_COLUMNS = {
  filings: [
    ['filedOn', 'DATE'], ['dossier', 'N° DOSSIER'], ['applicant', 'DEMANDEUR(S)'], ['site', 'ADRESSE DU TERRAIN'],
    ['nature', 'NATURE ET'], ['housing', 'NOMBRE'], ['floor', 'SURFACE'], ['start', 'DATE DE DEBUT'], ['end', 'DATE DE FIN'],
  ],
  decisions: [
    ['dossier', 'N° DOSSIER'], ['decidedOn', 'DATE'], ['applicant', 'BENEFICIAIRE'], ['site', 'ADRESSE DU TERRAIN'],
    ['nature', 'NATURE ET DESTINATION'], ['start', 'DEBUT'], ['end', 'FIN'],
  ],
};
const ILLKIRCH_EXTRA = ['DE DEPOT', 'DESTINATION', 'DES TRAVAUX', 'LOGTS', 'DE', 'PLANCHERS', "D'AFFICHAGE", "D'ARRETE"];
const ILLKIRCH_NOISE = /^(?:Affich[ée] en Mairie le\b.*|Page \d+|TRANSMISSION|PREFECTURE|Document publi[ée] le\b.*)$/i;
/** `retour dossier sans décision`: the dossier went back to the applicant, nothing was decided. */
const ILLKIRCH_NO_DECISION = /\bsans d[ée]cision\b/i;
/** `BOUYGUES IMMOBILIER représenté` / `par …`: the representative, on the name's line or the next. */
const REPRESENTED_RE = /\s+repr[ée]sent[ée]e?s?(?=\s|$).*$/i;
// i18n-ignore-end

/** A site cell's street: its lines before the postcode's (`67400 ILLKIRCH-` / `GRAFFENSTADEN`). */
function streetBeforePostcode(lines) {
  const cleaned = (lines ?? []).map(clean).filter(Boolean);
  const postal = cleaned.findIndex((line) => /^\d{5}\b/.test(line));
  return clean((postal < 0 ? cleaned.slice(0, 1) : cleaned.slice(0, postal)).join(' '));
}

/**
 * Illkirch-Graffenstaden's weekly lists, « AFFICHAGE des DEPÔTS au
 * 28/09/2026 » and « AFFICHAGE des DECISIONS au 28/09/2026 », printed from a
 * spreadsheet: a row per dossier, every cell centred on its row. The filings
 * read DATE DE DEPOT | N° Dossier | DEMANDEUR(S) | ADRESSE DU TERRAIN | NATURE
 * ET DESTINATION DES TRAVAUX | NOMBRE LOGTS | SURFACE DE PLANCHERS | Date de
 * début / de fin d'affichage; the decisions N° Dossier | DATE D'ARRETE (the
 * day over the verdict: `favorable`, `défavorable`, `favorable avec
 * prescriptions`, `rejet dossier non complété`, `retrait de l'arrêté`) |
 * BENEFICIAIRE | ADRESSE DU TERRAIN | NATURE… | DEBUT / FIN D'AFFICHAGE, and
 * spill a « TRANSMISSION PREFECTURE » column onto pages of their own. The
 * applicant cell holds a name, often a person's with no civility, over the
 * applicant's own address: only an organisation named on its first line is
 * kept. `retour dossier sans décision` rows decide nothing and are left out.
 * Measured on 2026-10-03: the lists of 28 September give 40 filings of 40 and
 * 72 decisions of 77 (the other five sent back undecided), every row with its
 * site. Read live: the eight lists of September give 134 filings and 311
 * decisions (each list repeats the weeks before), every row with its site.
 */
function readIllkirchList(document, { city, file }) {
  const board = file?.board === 'decisions' ? 'decisions' : 'filings';
  return readReportTable(document, {
    columns: ILLKIRCH_COLUMNS[board], extra: ILLKIRCH_EXTRA, noise: ILLKIRCH_NOISE,
    // The decisions' beneficiary starts halfway between two headers: every
    // cell of theirs starts left of its header.
    rule: board === 'decisions' ? 'right' : 'nearest', place: 'centre', gap: 2,
    head: /^(?:PC|DP|PA|PD|CU)\s*\d/, anchor: (text) => municipalDossier(text, city),
    build: (cells, section, dossier) => {
      const site = municipalSite(streetBeforePostcode(cells.site), city);
      if (!site.address) return null;
      const decision = (cells.decidedOn ?? []).map(clean);
      const said = decision.filter((line) => !/^\d{2}\/\d{2}\/\d{4}$/.test(line)).join(' ');
      if (board === 'decisions' && ILLKIRCH_NO_DECISION.test(said)) return null;
      return {
        board, dossier,
        applicant: reportApplicant([clean(cells.applicant?.[0]).replace(REPRESENTED_RE, '')]),
        address: site.address, postcode: site.postcode ?? city.postcode,
        purpose: clean((cells.nature ?? []).join(' ').replace(/\s*-\s*$/, '')) || null,
        filedOn: board === 'filings' ? municipalDate(clean((cells.filedOn ?? []).join(' '))) : null,
        postedOn: municipalDate(clean(cells.start?.[0])) ?? file?.published ?? null,
        verdict: board === 'decisions' ? listVerdict(verdictCell(said ? [said] : [])) ?? verdicts.signed.fr : null,
        decidedOn: board === 'decisions' ? municipalDate(decision.find((line) => /^\d{2}\/\d{2}\/\d{4}$/.test(line))) : null,
      };
    },
  });
}

export { readIllkirchList };

// --- Concarneau: the weekly registers of filings and decisions --------------

// i18n-ignore-start — the registers' own headers, titles and labels, matched on
const CONCARNEAU_COLUMNS = [['dossier', 'DOSSIER'], ['site', 'TERRAIN'], ['purpose', 'DESCRIPTION'], ['decision', 'DECISION', { optional: true }]];
const CONCARNEAU_NOISE = /^(?:REPUBLIQUE FRAN[CÇ]AISE|REGISTRE DES AUTORISATIONS\b.*|Mairie de Concarneau\b.*|Liste des [A-Z]{2}\s*:.*|Document publi[ée] le\b.*)$/i;
const CONCARNEAU_FIELD_RE = /^(Terrain|sis|Surface|Propri[ée]taire|Projet|Nb logements cr[ée]{2}s|Sign[ée]e le|Notifi[ée] le|Nature de la d[ée]cision|D[ée]p[ôo]t le|Complet le|par|Repr[ée]sentant)\b\s*:?\s*(.*)$/i;
// i18n-ignore-end

/**
 * A register prints its header once per family, under the family's title:
 * the rows a page carries above its first header belong to the family before.
 * The header's labels are lifted to the top of every page, so that the table
 * reader keeps those rows.
 */
function headerOnEveryPage(document, labels) {
  const isLabel = (run) => labels.has(fold(run.text));
  const first = (document?.pages ?? []).map((page) => (page.runs ?? []).filter(isLabel)).find((runs) => runs.length >= 3);
  if (!first) return document;
  const header = [...new Map(first.map((run) => [fold(run.text), { ...run, y: 1e4 }])).values()];
  return { ...document, pages: document.pages.map((page) => ({ ...page, runs: [...(page.runs ?? []).filter((run) => !isLabel(run)), ...header] })) };
}

/** A register cell's labelled lines (`Terrain : BI0151`, `sis 25 Rue …`), each label with its text and the lines it wraps onto. */
function labelledCell(lines) {
  const fields = [];
  for (const line of (lines ?? []).map(clean).filter(Boolean)) {
    const match = CONCARNEAU_FIELD_RE.exec(line);
    if (match) fields.push({ label: fold(match[1]), text: clean(match[2]) });
    else if (fields.length) fields.at(-1).text = clean(`${fields.at(-1).text} ${line}`);
  }
  const field = (pattern) => fields.find((item) => pattern.test(item.label))?.text ?? null;
  return field;
}

/**
 * Concarneau's weekly registers, « REGISTRE DES AUTORISATIONS D'URBANISME
 * DEPOSEES » and « … DECIDEES », a family after another (« Liste des DP :
 * Déclaration Préalable de Construction de Concarneau »), every cell centred
 * on its row and made of labelled lines: the number over `Dépôt le`, `par`
 * (the applicant: a person as often as not) and `Représentant :`; `Terrain :
 * BI0151`, `sis 25 Rue Blaise Cendrars`, `Surface : 563m²`, `Propriétaire :`
 * (never read); `Projet :` and `Nb logements créés :`; on the decisions,
 * `Signée le :`, `Notifié le :` and `Nature de la décision : Accord avec
 * prescription`. Measured on 2026-10-03: the registers of 2 October give 17
 * filings of 17 and 12 decisions of 12, every row with its parcels and all
 * but six with a numbered street (`sis Quai de la Croix`, a hamlet's name).
 */
function readConcarneauRegister(document, { city, file }) {
  const board = file?.board === 'decisions' ? 'decisions' : 'filings';
  const labels = new Set(CONCARNEAU_COLUMNS.map(([, label]) => label));
  return readReportTable(headerOnEveryPage(document, labels), {
    columns: CONCARNEAU_COLUMNS, noise: CONCARNEAU_NOISE, rule: 'nearest', place: 'centre',
    // A cell's lines are 8.1 points apart, two rows' cells 11 or more: 1.3 × 7.
    gap: 1.3,
    head: /^(?:PC|DP|PA|PD|CU)\s*\d/, anchor: (text) => municipalDossier(text, city),
    build: (cells, section, dossier) => {
      const head = labelledCell(cells.dossier);
      const land = labelledCell(cells.site);
      const works = labelledCell(cells.purpose);
      const decision = labelledCell(cells.decision);
      const site = municipalSite(land(/^SIS$/), city);
      const parcels = parcelList([land(/^TERRAIN$/) ?? ''].map((value) => value.replace(/\b([A-Z]{1,2})0*(\d{1,4})\b/g, '$1 $2')));
      if (!site.address && !parcels) return null;
      const housing = Number(works(/^NB LOGEMENTS/) ?? NaN);
      return {
        board, dossier, applicant: namedOrganisation([head(/^PAR$/) ?? '']),
        address: site.address, postcode: site.postcode ?? city.postcode, parcels,
        purpose: works(/^PROJET$/) || null,
        filedOn: municipalDate(head(/^DEPOT LE$/)),
        landArea: squareMetres(land(/^SURFACE$/)),
        housing: Number.isFinite(housing) && housing > 0 ? String(housing) : null,
        postedOn: file?.published ?? null,
        verdict: board === 'decisions' ? listVerdict(decision(/^NATURE DE LA DECISION$/)) ?? verdicts.signed.fr : null,
        decidedOn: board === 'decisions' ? municipalDate(decision(/^SIGNEE LE$/)) : null,
      };
    },
  });
}

export { readConcarneauRegister };

// --- Yutz: one scanned order per PDF -------------------------------------------

/** OCR reads a form's ruled cells as pipes: `Par :| `, `| 144 rue …`. */
function withoutRules(document) {
  return { ...document, pages: (document?.pages ?? []).map((page) => ({ ...page,
    runs: (page.runs ?? []).map((run) => ({ ...run, text: String(run.text ?? '').replace(/^[|¦]+|[|¦]+$/g, '') }))
      .filter((run) => clean(run.text)) })) };
}

// i18n-ignore-next-line — the orders' operative article, matched on
const OPERATIVE_RE = /\bARTICLE\s+(?:1(?:ER)?|UNIQUE)\b\s*[:.\-–]?\s*([^\n]*(?:\n[^\n]*){0,2})/i;

/**
 * Yutz's orders, one scan per dossier on « Autorisations d'urbanisme » (DP,
 * PC and PD decisions, one sub-category each), titled by number and
 * applicant (`DP 57 757 2600212 <name>`, `PC 57 757 2600014 REFUS <name>`):
 * the State's form — « Demande déposée le 03/09/2026 N° DP 57 757 26 00212 »,
 * « Par : », « Demeurant à : » (never read), « Pour : », « Sur un terrain sis
 * à : » — which `extended-notice` reads once the sweep's OCR has a text, the
 * form's rules read as pipes taken off first. Its search for the operative
 * article stops at an « Article 2 » these one-article orders never print, so
 * the verdict is read off « Article 1 : Les travaux sont autorisés… » here.
 * The signing day is a stamp OCR misreads (`YUTZ, le 2 f SEP, 2026`).
 * Read live on 2026-10-03 with the sweep's OCR: the sixteen newest acts give
 * 9 filings and 7 decisions, one row each, every one with its site.
 *
 * Hénin-Beaumont's orders are the same form, scanned (`ARRETE DP 26 317`,
 * `DP 2026-335`, `AM_DP_2026_286`): « Sur un terrain sis à : | 442 Rue … ».
 */
function readStateFormOrder(document, context) {
  const cleaned = withoutRules(document);
  return readExtendedNotice(cleaned, context).map((row) => {
    if (row.verdict !== verdicts.signed.fr) return row;
    const lines = (cleaned.pages ?? []).flatMap((page) => textLines(page.runs ?? [], 4)).map((line) => line.text);
    return { ...row, verdict: municipalVerdict(OPERATIVE_RE.exec(lines.join('\n'))?.[1]) ?? row.verdict };
  });
}

export { readStateFormOrder };

// --- Hénin-Beaumont: the weekly table of filings -----------------------------------

// i18n-ignore-start — the table's own headers, matched on
const HENIN_HEADER = [['dossier', /^DOSSIER$/], ['applicant', /^DEMANDEUR$/], ['filed', /^DATE DEPOT$/], ['site', /^ADRESSE$/], ['purpose', /^DESCRIPTION DU PROJET$/]];
/** Every row's number, ERP works (AT) included: each row bounds the description of the row under it. */
const HENIN_ROW_RE = /^[A-Z]{2}\s+62427\b/;
const HENIN_PERMIT_RE = /^(?:PC|DP|PA|PD)\s/;
// i18n-ignore-end

/**
 * Hénin-Beaumont's weekly « TABLEAU AFFICHAGE DU 02 10 26 AU 09 10 2026 »:
 * one line per dossier filed — Dossier | demandeur (a person's name as often
 * as a company's, with no civility) | Date dépôt | adresse | Description du
 * projet — the day and the street often one run (`09/07/2026122 RUE
 * PASTEUR`), and a long description climbing from its row's line up to the
 * row before. Its ERP works (AT) are no building permits: left out, though
 * each bounds the description under it. Measured on 2026-10-03: the table of
 * 2 October gives its 97 permits (beside 11 ERP works), every one with its
 * site.
 */
function readHeninTable(document, { city, file }) {
  const rows = [];
  let columns = null;
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((run) => clean(run.text));
    const found = HENIN_HEADER.map(([field, pattern]) => ({ field, run: runs.find((run) => pattern.test(fold(run.text))) }));
    const headerY = found.every((column) => column.run) ? Math.min(...found.map((column) => column.run.y)) : Infinity;
    if (found.every((column) => column.run)) {
      const xs = found.map((column) => column.run.x);
      // Cells start left of their centred headers: a column runs from halfway to the header before.
      columns = found.map((column, i) => ({ field: column.field, from: i ? (xs[i - 1] + xs[i]) / 2 : -Infinity }));
      columns[2].from = Math.min(columns[2].from, xs[2] - 10);
    }
    if (!columns) continue;
    const fieldOf = (run) => columns.findLast((column) => run.x >= column.from).field;
    const anchors = runs.filter((run) => fieldOf(run) === 'dossier' && HENIN_ROW_RE.test(clean(run.text))).sort((a, b) => b.y - a.y);
    anchors.forEach((anchor, i) => {
      const dossier = HENIN_PERMIT_RE.test(clean(anchor.text)) ? municipalDossier(anchor.text, city) : null;
      if (!dossier) return;
      const same = (field) => clean(runs.filter((run) => Math.abs(run.y - anchor.y) < 2 && fieldOf(run) === field)
        .sort((a, b) => a.x - b.x).map((run) => run.text).join(' '));
      const dated = /^(\d{2}\/\d{2}\/\d{4})\s*(.*)$/.exec(clean(`${same('filed')} ${same('site')}`));
      const site = municipalSite(dated ? dated[2] : same('site'), city);
      if (!site.address) return;
      const above = anchors[i - 1]?.y ?? headerY;
      const works = textLines(runs.filter((run) => fieldOf(run) === 'purpose' && run.y > anchor.y - 2 && run.y < above - 2))
        .map((line) => line.text);
      rows.push({
        board: 'filings', dossier, applicant: namedOrganisation([same('applicant')]),
        address: site.address, postcode: site.postcode ?? city.postcode,
        purpose: clean(works.join(' ').replace(/_/g, ' ')) || null,
        filedOn: municipalDate(dated?.[1]), postedOn: file?.published ?? null,
      });
    });
  }
  return rows;
}

export { readHeninTable };

// --- Verrières-le-Buisson: one avis or one order per PDF -----------------------

// i18n-ignore-start — the notices' and orders' own labels, matched on
/** The avis' labels, folded, as the town's printer or its scanner's OCR spells them (`Têrrain`, `Superlicie`). */
const VERRIERES_LABEL_RE = /^(NUMERO DOSSIER|DATE D[EÊ] DEPOT|DEMANDEUR|T[EÊ]RRAIN|SUPER[LF]?I?CIE|TRAVAUX)$/;
const VERRIERES_TITLE_RE = /\b(PC|DP|PA|PD)\s*(\d{2})\s*(\d{5})(?:\s*(M\d{2}|T\d{2}))?\b/;
const VERRIERES_SITE_LABEL_RE = /^ADRESSE\s+DES\s+TRAVAUX\s*:?\s*/i;
const VERRIERES_PARCEL_LABEL_RE = /^PARCELLE\s*\(?S?\)?\s+CADASTR\S*\s*(?:\(S\))?\s*:?\s*/i;
/** `91370`, as the town's OCR reads it: `9137 0`, `9 1370`, `9137 O`. */
const VERRIERES_POSTCODE_RE = /(?:^|\s)[9g]\s?[1Il]\s?3\s?7\s?[0O](?=\s|$)/;
const VERRIERES_SIS_RE = /\bterrain\s+sis\s+((?:\d|[lI](?=\d))[^,;\n]*?)(?=\s+[9g]\s?[1Il]\s?3\s?7\s?[0O]\b|\s*[,;\n]|\s+parcelle\b|$)/i;
// i18n-ignore-end

/**
 * Verrières-le-Buisson's avis de dépôt, printed, one per dossier: labels down
 * the left (Numéro Dossier, Date de dépôt, Demandeur — a name and the
 * applicant's own address, never read —, Terrain, Superficie, Travaux), each
 * value on its label's line and the lines under it. `Terrain` prints the site
 * with its postcode and town after a comma.
 */
function readVerrieresFiling(document, { city, file }) {
  const page = document?.pages?.[0];
  if (!page) return [];
  const runs = (page.runs ?? []).filter((run) => clean(run.text));
  const valueX = Math.min(...runs.filter((run) => run.x > 140 && run.x < 200).map((run) => run.x)) - 5;
  if (!Number.isFinite(valueX)) return [];
  // A label is one run or several (`Numéro` `Dossier` once the notice was scanned).
  const labels = textLines(runs.filter((run) => run.x < valueX))
    .map((line) => ({ y: line.y, label: VERRIERES_LABEL_RE.exec(fold(line.text))?.[1] ?? null })).filter((line) => line.label);
  const field = (name) => {
    const at = labels.findIndex((line) => line.label.startsWith(name));
    if (at < 0) return [];
    const top = labels[at].y + 4;
    const bottom = labels[at + 1]?.y ?? labels[at].y - 120;
    const lines = textLines(runs.filter((run) => run.x >= valueX && run.y <= top && run.y > bottom + 4)).map((line) => line.text);
    // The last field runs on to the signature: `Fait à VERRIÈRES-LE-` / `BUISSON` / `Le 28 septembre 2026`.
    const end = lines.findIndex((line) => /^Fait [àa](?=\s|$)/i.test(line));
    return end < 0 ? lines : lines.slice(0, end);
  };
  const dossier = municipalDossier(field('NUMERO').join(' '), city) ?? verrieresTitleDossier(file, city);
  const site = municipalSite(ocrStreet(clean(field('T').join(' ')).split(/\s*,\s*/)[0]), city);
  if (!dossier || !site.address) return [];
  return [{
    board: 'filings', dossier, applicant: namedOrganisation(field('DEMANDEUR').slice(0, 1)),
    address: site.address, postcode: site.postcode ?? city.postcode,
    purpose: clean(field('TRAVAUX').join(' ')) || null,
    filedOn: municipalDate(field('DATE')[0]),
    landArea: squareMetres(field('SUPER')[0]),
    postedOn: file?.published ?? null,
  }];
}

/** The number a file's title gives: `ARRETE DP2610132`, `ARRETE DP1910053M02` (a year and a local counter). */
function verrieresTitleDossier(file, city) {
  const title = VERRIERES_TITLE_RE.exec(fold(file?.title).replace(/_/g, ' '));
  return title ? municipalDossier(`${title[1]} ${city.insee} ${title[2]} ${title[3]}${title[4] ? ` ${title[4]}` : ''}`, city) : null;
}

/** A street as OCR reads its number: `l8bis` for `18bis`, `I allée` for `1 allée`. */
function ocrStreet(value) {
  return clean(value).replace(/^[lI](?=\d)/, '1').replace(/^[lI](?=\s+\p{L}{2})/u, '1');
}

/**
 * Verrières-le-Buisson's orders, scanned and read by the town's own OCR
 * (`No DP 9t6452610132`, `VERRIÈNPS-LE-BUISSON`): the number comes from the
 * file's title (`ARRETE DP2610132`, `RETRAIT PC2410033`, `REJET DP2610084`,
 * the year and a local five-digit counter), the site from the header's right
 * column (« ADRESSE DES TRAVAUX : 15 rue Paul Doumer ») or the recital («
 * sur un terrain sis 15 rue … 91370 Verrières-le-Buisson, parcelle cadastrée
 * AP333 »), never from the left column, which names the applicant and their
 * address. A `REJET` is a letter to the applicant naming no site: nothing.
 * Read live on 2026-10-03 with the avis: the forty newest files give 20
 * filings and 12 decisions, every row with its site; the other 8 are
 * rejection letters.
 */
function readVerrieresOrder(document, { city, file }) {
  const dossier = verrieresTitleDossier(file, city);
  if (!dossier) return [];
  const pages = document?.pages ?? [];
  const first = pages[0]?.runs ?? [];
  const lines = textLines(first, 3);
  const siteLabel = first.find((run) => /^ADRESSE$/i.test(clean(run.text))
    && first.some((other) => Math.abs(other.y - run.y) < 3 && other.x > run.x && /^DES$/i.test(clean(other.text))) && run.x > 200);
  let street = null;
  let parcelText = null;
  if (siteLabel) {
    const right = textLines(first.filter((run) => run.x >= siteLabel.x - 10 && run.y <= siteLabel.y + 2 && run.y > siteLabel.y - 90), 3)
      .map((line) => line.text);
    const [head, ...below] = right;
    const rest = clean(head.replace(VERRIERES_SITE_LABEL_RE, ''));
    // OCR reads `18bis` as `l8bis`; the street may wrap onto the postcode's line (`22 rue Jules` / `choppin 9137 0 …`).
    const candidates = [rest, ...below].filter(Boolean).map((line) => line.replace(/^[lI](?=\d)/, '1'));
    const at = candidates.findIndex((line) => /^\d/.test(line) && !VERRIERES_POSTCODE_RE.test(line) && !VERRIERES_PARCEL_LABEL_RE.test(line));
    if (at >= 0) {
      const parts = [];
      for (const line of candidates.slice(at)) {
        if (parts.length && (/^\d/.test(line) || VERRIERES_PARCEL_LABEL_RE.test(line))) break;
        const cut = clean(line.split(VERRIERES_POSTCODE_RE)[0]);
        if (cut) parts.push(cut);
        if (cut !== clean(line)) break;
      }
      street = clean(parts.join(' ')) || null;
    }
    // The references follow their label, or sit on the line under it.
    const parcelAt = right.findIndex((line) => VERRIERES_PARCEL_LABEL_RE.test(line));
    parcelText = parcelAt < 0 ? null : clean(right[parcelAt].replace(VERRIERES_PARCEL_LABEL_RE, '')) || right[parcelAt + 1] || null;
  }
  const body = pages.flatMap((page) => textLines(page.runs ?? [], 3)).map((line) => line.text).join('\n');
  street ??= VERRIERES_SIS_RE.exec(body)?.[1] ?? null;
  parcelText ??= /\bparcelle\s+cadastr[ée]e\s+([A-Z]{1,2}\s?\d{1,4})/i.exec(body)?.[1] ?? null;
  const site = municipalSite(street && ocrStreet(street), city);
  const parcels = parcelText ? parcelList([parcelText]) : null;
  if (!site.address && !parcels) return [];
  const operative = /\bARTICLE\s+(?:1|I|l)\s*[.:'’]+\s*([^\n]*(?:\n[^\n]*)?)/i.exec(body)?.[1];
  const word = /^(ARRETE|RETRAIT|REJET|REFUS)\b/.exec(fold(file?.title))?.[1];
  const verdict = word === 'RETRAIT' ? verdicts.withdrawn.fr : word === 'REJET' || word === 'REFUS' ? verdicts.refused.fr
    : municipalVerdict(operative) ?? verdicts.signed.fr;
  return [{
    board: 'decisions', dossier, applicant: null, address: site.address, postcode: site.postcode ?? city.postcode, parcels,
    postedOn: file?.published ?? null, verdict,
  }];
}

export { readVerrieresFiling, readVerrieresOrder };

// --- Harnes: one avis or one order per PDF, titled by its site --------------------

// i18n-ignore-start — the avis' own labels, matched on
const HARNES_LABEL_RE = /^(DEPOSE LE|PAR|POUR UN PROJET DE|SIS A L'ADRESSE|PARCELLE CADASTRALE|SUPERFICIE DU TERRAIN|SURFACE DE PLANCHER CREEE|HAUTEUR DU PROJET|NOMBRE DE LOGEMENTS|AFFICHE LE)$/;
// i18n-ignore-end

/**
 * Harnes's avis de dépôt (« URBANISME » / sub-category 5279), one per
 * dossier, titled by the site (`22 rue André Desprez`): the number, then
 * labels down the left (Déposé le, Par — the applicant, often a person —,
 * Pour un projet de, Sis à l'adresse, Parcelle cadastrale, Superficie du
 * terrain, Surface de plancher créée, Nombre de logements, Affiché le), each
 * value on its label's line but the works, a block centred on theirs.
 */
function readHarnesFiling(document, { city, file }) {
  const runs = (document?.pages?.[0]?.runs ?? []).filter((run) => clean(run.text));
  const labelled = textLines(runs.filter((run) => run.x < 200))
    .map((line) => ({ y: line.y, label: HARNES_LABEL_RE.exec(fold(line.text).replace(/[’‘]/g, "'"))?.[1] ?? null }))
    .filter((line) => line.label);
  const values = textLines(runs.filter((run) => run.x >= 200));
  const at = (label) => labelled.find((line) => line.label === label);
  const value = (label) => {
    const line = at(label);
    return line ? values.find((item) => Math.abs(item.y - line.y) < 2)?.text ?? null : null;
  };
  const dossier = municipalDossier(runs.filter((run) => run.x < 200).slice(0, 40).map((run) => run.text).join(' '), city);
  const street = clean(value("SIS A L'ADRESSE")).replace(/\s+\d{5}\b.*$/, ''); // i18n-ignore-line — the order's own label, matched on
  const site = municipalSite(street || clean(file?.title), city);
  const parcels = parcelList([clean(value('PARCELLE CADASTRALE')).replace(/\b([A-Z]{1,2})\s?0*(\d{1,4})\b/g, '$1 $2')]);
  if (!dossier || (!site.address && !parcels)) return [];
  const [after, before] = [at('PAR') ?? at('DEPOSE LE'), at("SIS A L'ADRESSE")]; // i18n-ignore-line — the order's own labels, matched on
  const works = after && before ? values.filter((line) => line.y < after.y - 2 && line.y > before.y + 2).map((line) => line.text) : [];
  const housing = Number(value('NOMBRE DE LOGEMENTS') ?? NaN);
  return [{
    board: 'filings', dossier, applicant: namedOrganisation([value('PAR') ?? '']),
    address: site.address, postcode: site.postcode ?? city.postcode, parcels,
    purpose: clean(works.join(' ').replace(/_-?\s*/g, ' ')) || null,
    filedOn: municipalDate(value('DEPOSE LE')), postedOn: municipalDate(value('AFFICHE LE')) ?? file?.published ?? null,
    landArea: squareMetres(value('SUPERFICIE DU TERRAIN')), floorArea: squareMetres(value('SURFACE DE PLANCHER CREEE')),
    housing: Number.isFinite(housing) && housing > 0 ? String(housing) : null,
  }];
}

/**
 * Harnes's orders (sub-category 2078), one per dossier, titled by the site
 * (`73 avenue des Saules`): the State's form, which `extended-notice` reads.
 * Some print their labels with no value beside them (`Sis à :` and nothing
 * the PDF's text holds, 1 of the 2 orders sampled): the number is then read
 * off the page and the site off the title. Read live on 2026-10-03: the
 * thirty newest files give 18 filings and 12 decisions, one row each, every
 * one with its site.
 */
function readHarnesOrder(document, { city, file }) {
  const lines = (document?.pages ?? []).flatMap((page) => textLines(page.runs ?? [])).map((line) => line.text);
  const dossier = municipalDossier(lines.slice(0, 30).join(' '), city);
  const site = municipalSite(clean(file?.title), city);
  const row = dossier && site.address ? { board: 'decisions', dossier, applicant: null, ...site, postedOn: file?.published ?? null } : null;
  return readExtendedNotice(document, { city, file: { ...file, row } });
}

export { readHarnesFiling, readHarnesOrder };


export const DIGILOR_B_BOARD_READERS = Object.freeze({
  'digilor-saint-laurent-list': readSaintLaurentList,
  'digilor-illkirch-list': readIllkirchList,
  'digilor-concarneau-register': readConcarneauRegister,
  'digilor-yutz-order': readStateFormOrder,
  'digilor-henin-beaumont-order': readStateFormOrder,
  'digilor-henin-beaumont-table': readHeninTable,
  'digilor-verrieres-filing': readVerrieresFiling,
  'digilor-verrieres-order': readVerrieresOrder,
  'digilor-harnes-filing': readHarnesFiling,
  'digilor-harnes-order': readHarnesOrder,
});
export const DIGILOR_B_BOARD_TEXT = Object.freeze({});
