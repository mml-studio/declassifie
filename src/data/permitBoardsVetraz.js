/** Vétraz-Monthoux's Excel-exported permit tables, with private columns excluded. */
import { municipalDate, municipalDossier, municipalSite } from './municipalPermitsFeed.js';
import { readReportTable } from './permitBoardsReports.js';
import { listParcelCell } from './permitBoardsLists.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const joined = (lines) => clean((lines ?? []).join(' '));

// i18n-ignore-start — exact headers of the publisher's PC/PA and DP tables
const COMMON = [
  ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'NOM, RAISON SOCIALE OU'],
  ['site', 'ADRESSE DU TERRAIN'], ['architect', "NOM DE L'ARCHITECTE"],
  ['architectAddress', "ADRESSE POSTALE DE L'ARCHITECTE"],
  ['parcels', 'LISTE DES PARCELLES'], ['purpose', 'DESCRIPTION SYNTHETIQUE DU PROJET'],
];
const EXTRA = ['DENOMINATION SOCIALE DU', 'DENOMINATION SOCIALE', 'BENEFICIAIRE', 'DU BENEFICIAIRE',
  'DEPOT', 'DE LA', 'DECISION', "L'ARCHITECTE", 'PROJET'];
// i18n-ignore-end

// Measured cell boundaries of the four exports, in PDF points. Header positions
// must match before these boundaries are used; changed geometry is withheld.
const PROFILES = {
  filings: [
    { header: [27.48, 111.38, 240.74, 392.33, 528.29, 641.83, 833.35, 998.98],
      starts: [15.36, 88.22, 217.46, 364.12, 502.25, 640.39, 778.27, 969.82] },
    { header: [31.2, 108.5, 250.82, 417.89, 537.89, 646.03, 757.03, 931.78],
      starts: [24.6, 90.26, 216.5, 393.16, 520, 637.51, 744.79, 857.47] },
  ],
  decisions: [
    { header: [41.28, 98.904, 178.94, 301.34, 435.89, 561.65, 709.03, 804.67, 923.26, 1008.94],
      starts: [30.72, 93.504, 160.104, 298.58, 425.68, 547.49, 679.99, 797.11, 911.14, 1001.38] },
    { header: [29.16, 89.424, 167.54, 295.94, 439.73, 563.93, 630.43, 710.83, 821.71, 915.46],
      starts: [25.32, 83.664, 142.944, 278.3, 417.28, 549.05, 614.09, 696.67, 809.83, 890.11] },
  ],
};

/** Full local identity only; the service letter and modification are printed separately. */
function dossierOf(value, city) {
  const text = clean(value).replace(/\b([A-Z])\s+(\d{4})\b/g, '$1$2')
    .replace(/[.,]\s*([MT]\d{1,2})\b/g, ' $1');
  return municipalDossier(text, city);
}

function readVetrazTable(document, { city, file }, board) {
  if (city.insee !== '74298') return [];
  const day = (value) => {
    const parsed = municipalDate(joined(value));
    return parsed && file.published && parsed <= file.published ? parsed : null;
  };
  return (document?.pages ?? []).flatMap((page) => {
    const runs = page.runs ?? [];
    const find = (label) => runs.filter((run) => fold(run.text) === label).sort((a, b) => b.y - a.y || a.x - b.x)[0];
    const alternatives = (labels) => labels.find(find);
    // Both families print these columns; missing or renamed headers withhold the page.
    const columns = COMMON.map(([field, label]) => [field, label]);
    if (board === 'decisions') {
      columns.find(([field]) => field === 'site')[1] = 'ADRESSE DU DOSSIER'; // i18n-ignore-line
      columns.push(['verdict', 'NATURE DE LA']); // i18n-ignore-line
    }
    columns.find(([field]) => field === 'architect')[1] = alternatives(["NOM DE L'ARCHITECTE", 'NOM DE']); // i18n-ignore-line
    columns.find(([field]) => field === 'architectAddress')[1] = alternatives([
      "ADRESSE POSTALE DE L'ARCHITECTE", 'ADRESSE POSTALE DE', 'ADRESSE DE', // i18n-ignore-line
    ]);
    columns.find(([field]) => field === 'purpose')[1] = alternatives([
      'DESCRIPTION SYNTHETIQUE DU PROJET', 'DESCRIPTION SYNTHETIQUE DU', // i18n-ignore-line
    ]);
    // PC/PA decisions wrap both date labels; DP decisions keep the filing label whole.
    const filingLabel = alternatives(['DATE DEPOT', 'DATE DE']); // i18n-ignore-line
    columns.unshift(['filedOn', filingLabel]);
    if (board === 'decisions') columns.splice(1, 0, ['decidedOn', 'DELIVRANCE']); // i18n-ignore-line
    if (columns.some(([, label]) => !label || !find(label))) return [];
    const located = columns.map(([field, label]) => {
      const run = field === 'filedOn' ? runs.filter((item) => fold(item.text) === label).sort((a, b) => a.x - b.x)[0] : find(label);
      return { field, run };
    }).sort((a, b) => a.run.x - b.run.x);
    if (located.map((item) => item.field).join(',') !== [
      'filedOn', ...(board === 'decisions' ? ['decidedOn'] : []), 'dossier', 'applicant', 'site',
      'architect', 'architectAddress', 'parcels', ...(board === 'decisions' ? ['verdict'] : []), 'purpose',
    ].join(',')) return [];
    const profile = PROFILES[board].find(({ header }) => header.every((x, i) => Math.abs(x - located[i].run.x) < 1));
    if (!profile) return [];
    // Classify by the line's starting position: a long private name or address
    // stays in its own column even if its glyphs extend into the project column.
    return readReportTable({ pages: [page] }, {
      columns: located.map(({ field, run }) => [field, fold(run.text)]), extra: EXTRA,
      rule: 'nearest', place: 'centre', head: /^(?:PC|DP|PA|PD|CU|AT)\s*\d/,
      field: (run) => located[Math.max(0, profile.starts.findLastIndex((x) => run.x >= x))].field,
      anchor: (value) => dossierOf(value, city),
      build: (cells, section, dossier) => {
        const site = municipalSite(joined(cells.site), city);
        return { board, dossier, ...site, applicant: null,
          parcels: listParcelCell(joined(cells.parcels)), purpose: joined(cells.purpose) || null,
          filedOn: day(cells.filedOn), postedOn: file.published,
          ...(board === 'decisions' ? { decidedOn: day(cells.decidedOn), verdict: joined(cells.verdict) || null } : {}),
        };
      },
    });
  });
}

export const VETRAZ_BOARD_READERS = Object.freeze({
  'vetraz-filings': (document, context) => readVetrazTable(document, context, 'filings'),
  'vetraz-decisions': (document, context) => readVetrazTable(document, context, 'decisions'),
});
