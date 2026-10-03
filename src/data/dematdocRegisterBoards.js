/** DematDOC shelves containing aggregate planning registers as well as acts. */
import { dematdocDocuments, dematdocLazyRequest, dematdocOldest, dematdocShelfRequest, readDematdocNotice } from './dematdocFeed.js';
import { municipalDate, municipalDossier, municipalSite } from './municipalPermitsFeed.js';
import { REPORT_BOARD_READERS, readReportTable } from './permitBoardsReports.js';
import { listParcelCell } from './permitBoardsLists.js';
import messages from './municipalPermitsFeed.i18n.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const joined = (value) => clean((value ?? []).join(' '));
const field = (doc, key) => clean(doc?.values?.[key]?.displayValue);
const jsonPost = (request) => ({ ...request, method: 'POST', as: 'json',
  headers: { 'Content-Type': 'application/json' } });

// i18n-ignore-start — the publishers' register titles and column headings
const REGISTER = /liste des (?:avis de d[ée]p[ôo]t|d[ée]cisions|(?:PC|DP|PA|PD|CU)\b)|(?:d[ée]clarations pr[ée]alables|permis de construire) d[ée]pos[ée]e?s au|d[ée]cisions urbanisme/i;
const FILINGS = /avis de d[ée]p[ôo]t|d[ée]pos[ée]e?s au/i;
const MILLERY_COLUMNS = [
  ['dossier', 'REFERENCE DOSSIER'], ['requestedOn', 'DEMANDE'], ['filedOn', 'DEPOT'],
  ['decidedOn', 'DECISION'], ['applicant', 'DEMANDEUR'], ['site', 'TERRAIN'],
  ['parcels', 'PARCELLES'], ['purpose', 'NATURE DES TRAVAUX'],
  ['floor', 'SURF.'], ['land', 'SURF.'], ['housing', 'NB.'], ['levels', 'NIV.'],
];
// i18n-ignore-end

/** Only a local dossier with a project site reaches the archive. */
function projectRows(rows, file) {
  return rows.filter((row) => row.dossier && (row.address || row.parcels)).map((row) => ({
    ...row, applicant: null,
    ...Object.fromEntries(['filedOn', 'decidedOn', 'postedOn'].map((key) => [key,
      row[key] && (!file.asOf || row[key] <= file.asOf) ? row[key] : null])),
  }));
}

export function readMilleryRegister(document, { city, file }) {
  return projectRows(readReportTable(document, {
    columns: MILLERY_COLUMNS, extra: ['CREEE(M²)', 'PARC.(M²)', 'LOG.'],
    rule: 'nearest', place: 'top', head: /^(?:PC|DP|PA|PD|CU)\s*\d/,
    noise: /^Page \d+\/\d+$/i, anchor: (text) => municipalDossier(text, city),
    build: (cells, section, dossier) => {
      const site = municipalSite(joined(cells.site), city);
      const decidedOn = municipalDate(joined(cells.decidedOn));
      const board = decidedOn ? 'decisions' : 'filings';
      return { board, dossier, applicant: null, ...site,
        parcels: listParcelCell(joined(cells.parcels)) ?? site.parcels,
        purpose: joined(cells.purpose) || null, filedOn: municipalDate(joined(cells.filedOn)),
        postedOn: file.published ?? null,
        // This report prints a decision date, but no verdict column.
        ...(board === 'decisions' ? { decidedOn,
          verdict: messages.definition.signed.fr } : {}),
      };
    },
  }), file);
}

export function readDematdocRegisterNotice(document, context) {
  // Vernaison's filing template labels the project site simply “Adresse”.
  // Its applicant address is under a different label and remains unread.
  const first = document?.pages?.[0];
  const isVernaisonFiling = context.city.insee === '69260'
    && first?.runs.some((run) => /^AVIS DE DEPOT$/i.test(clean(run.text)));
  const adapted = isVernaisonFiling ? { ...document, pages: document.pages.map((page, index) => index ? page : {
    ...page, runs: page.runs.map((run) => /^Adresse\s*:\s*$/i.test(clean(run.text))
      ? { ...run, text: 'Adresse terrain :' } : run), // i18n-ignore-line — the notice reader's project-site label
  }) } : document;
  return projectRows(readDematdocNotice(adapted, context), context.file);
}

const protocol = Object.freeze({
  start: (city) => city.source.doctypes.map((id) => ({ ...jsonPost(dematdocShelfRequest(city, id)), page: 1 })),
  index(city, answer, request, { since, day }) {
    if (!Array.isArray(answer?.documents)) return null;
    const files = [];
    for (const doc of answer.documents) {
      const title = clean([doc.name, field(doc, 'OBJET')].join(' '));
      const published = municipalDate(field(doc, 'CI_DATE_DEBUT_AFFICHAGE_PUBLIC'))
        ?? municipalDate(field(doc, 'DATEACTE')) ?? municipalDate(String(doc.createdAt ?? '').slice(0, 10));
      if (!published || published < since || published > day) continue;
      if (REGISTER.test(title)) {
        let url;
        try { url = new URL(doc.bifferPath || doc.path, city.source.base); } catch { continue; }
        if (url.origin !== new URL(city.source.base).origin || !/\.pdf$/i.test(url.pathname)) continue;
        const board = FILINGS.test(title) ? 'filings' : 'decisions';
        files.push({ url: url.href, board, published, asOf: day, ocr: true,
          layout: city.source.registerLayout === 'millery' ? 'millery-register' : `dematdoc-report-${board}` });
      } else {
        for (const file of dematdocDocuments(city, [doc], since)) {
          // The act title can name a private applicant. Only its dossier
          // identity is passed to the reader; the raw title is never retained.
          files.push({ ...file, title: municipalDossier(file.title, city) ?? '',
            layout: 'dematdoc-register-notice', ocr: true, asOf: day });
        }
      }
    }
    const page = request.page ?? 1;
    const next = page < 6 && answer.nextDocsIds?.length && (dematdocOldest(answer.documents) ?? '') >= since
      ? [{ ...jsonPost(dematdocLazyRequest(city, answer.nextDocsIds)), page: page + 1 }] : [];
    return { files, next };
  },
});

export const DEMATDOC_REGISTER_PROTOCOLS = Object.freeze({ 'dematdoc-registers': protocol });
export const DEMATDOC_REGISTER_READERS = Object.freeze({
  'dematdoc-report-filings': (document, context) => projectRows(REPORT_BOARD_READERS['cartds-report-filings'](document, context), context.file),
  'dematdoc-report-decisions': (document, context) => projectRows(REPORT_BOARD_READERS['cartds-report-decisions'](document, context), context.file),
  'millery-register': readMilleryRegister,
  'dematdoc-register-notice': readDematdocRegisterNotice,
});
