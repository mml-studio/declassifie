/** Fleury-les-Aubrais's project-only spreadsheet and PDF registers. */
import { municipalDate, municipalDossier, municipalSite } from './municipalPermitsFeed.js';
import { readReportTable, reportDossier } from './permitBoardsReports.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
// i18n-ignore-start — the publisher's table headers and municipality name
const COLUMNS = [
  ['dossier', 'NUMERO DOSSIER - ENTIER'], ['filedOn', 'DATE DE DEPOT'],
  ['site', 'ADRESSE - TERRAIN'], ['town', 'NOM DE LA COMMUNE'],
  ['applicant', 'LISTE DES DEMANDEURS'], ['purpose', 'DESCRIPTION DU PROJET'],
];
const DECISION_COLUMNS = [...COLUMNS, ['decidedOn', 'DATE DE LA DECISION'], ['verdict', 'DECISION PRISE']];
const TOWN = 'FLEURY LES AUBRAIS';
const SHEET = 'Liste affichage dépôt';
// i18n-ignore-end

/** Windows Excel dates are days from 1899-12-30; formatted dates stay explicit. */
export function fleuryDay(value, latest) {
  const text = clean(value);
  let day = municipalDate(text);
  if (!day && /^\d{5}$/.test(text)) {
    const serial = Number(text);
    if (serial >= 42005 && serial <= 73050) day = new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  }
  return day && (!latest || day <= latest) ? day : null;
}

function projectRow(cells, { city, file }, board) {
  if (city.insee !== '45147' || fold(cells.town) !== TOWN) return null;
  // Require the full printed identity; an abbreviated or foreign number is withheld.
  const printed = clean(cells.dossier);
  if (!/^(?:PC|DP|PA|PD|CU)\s+045\s+147\s+\d{2}\s+[A-Z]?\d{4,5}(?:\s+[MT]\d{1,2})?$/.test(printed)) return null;
  const dossier = municipalDossier(printed, city);
  if (!dossier) return null;
  const site = municipalSite(cells.site, city);
  // Some published project cells carry another municipality's postcode.
  // Keep the dossier, but leave that conflicting site unplaced.
  if (site.postcode !== city.postcode) { site.address = null; site.parcels = null; }
  return {
    board, dossier, ...site, applicant: null,
    purpose: clean(cells.purpose) || null,
    filedOn: fleuryDay(cells.filedOn, file?.published),
    ...(board === 'decisions' ? {
      decidedOn: fleuryDay(cells.decidedOn, file?.published), verdict: clean(cells.verdict) || null,
    } : {}),
    postedOn: file?.published ?? null,
  };
}

/** Only the six verified columns are read; the applicant cell is never copied. */
export function readFleuryFilings(document, context) {
  if (document?.sheet !== undefined) {
    if (document.sheet !== SHEET || !Array.isArray(document.rows)) return [];
    const [header, ...rows] = document.rows;
    if (header?.length !== COLUMNS.length || !COLUMNS.every(([, label], i) => fold(header[i]) === label)) return [];
    return rows.filter((row) => row.length === COLUMNS.length).map((row) => projectRow({
      dossier: row[0], filedOn: row[1], site: row[2], town: row[3], purpose: row[5],
    }, context, 'filings')).filter(Boolean);
  }
  return readPdfRegister(document, context, 'filings');
}

function readPdfRegister(document, context, board) {
  return readReportTable(document, {
    columns: board === 'decisions' ? DECISION_COLUMNS : COLUMNS,
    rule: 'nearest', place: 'top', head: /^(?:PC|DP|PA|PD|CU|AT|AP)\s*\d/,
    anchor: (text) => reportDossier(text, context.city),
    build: (cells) => projectRow(Object.fromEntries(
      Object.entries(cells).filter(([field]) => field !== 'applicant').map(([field, lines]) => [field, clean(lines.join(' '))]),
    ), context, board),
  });
}

export const FLEURY_BOARD_READERS = Object.freeze({
  'fleury-filings': readFleuryFilings,
  'fleury-decisions': (document, context) => readPdfRegister(document, context, 'decisions'),
});
