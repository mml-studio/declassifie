/**
 * Communes whose website IntraMuros builds post their urbanism acts on its
 * « Documents administratifs » page: one protocol (`intramuros`) for all of
 * them. The page is rendered on the server with the whole legal board as
 * JSON in `__NEXT_DATA__` (`props.pageProps.legalDisplayDocuments`): each
 * document has a category, a title, the day it was published and its PDFs on
 * `files.appli-intramuros.com`. See `permitBoards.js` for the contract.
 *
 * A document is read when its category is urbanism and its title, or a
 * file's, names one of the commune's dossiers (`DP0596632600093 …`,
 * `Récépissé N°DP07838226M0040 du 26/06/2026`). Most PDFs are signed scans
 * whose only text is IntraMuros's stamp: they are read by OCR in the daily
 * sweep (`extended-notice`), and meanwhile the title gives the number, a
 * numbered street when it ends with one, and a verdict when it says one. A
 * title that names neither a receipt nor an order is a filing: Wormhout's
 * `DP0596632600093 [name] 23 rue … 01-10-2026` is its « Dossiers déposés »
 * notice (2026-10-03); a town may say otherwise in `source.board`.
 *
 * Applicants: titles often name them (« DP… [name] 23 rue … »). Only the
 * number, a numbered street — from its house number on, never what precedes
 * it — and the verdict's words are taken from a title; never the title itself.
 * IntraMuros's own host (`intramuros.org`) refuses robots; the communes'
 * domains do not, and are the ones read.
 */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

// i18n-ignore-start — the boards' own words, matched on
const URBANISM_CATEGORY = /urbanis|droit des sols|autorisations? d.urbanisme|permis/i;
const FILING_WORDS = /r[ée]c[ée]piss[ée]|avis de d[ée]p[ôo]t|d[ée]p[ôo]t de (?:la )?demande|\bAD\b/i;
const DECISION_WORDS = /arr[êe]t[ée]|d[ée]cision|accord|refus|opposition|favorable|retrait|transfert|prorogation|annulation/i;
const STREET = 'rue|avenue|av\\.?|boulevard|bd|place|chemin|all[ée]es?|impasse|route|rte|quai|cours|faubourg|chauss[ée]e|square|promenade|sentier|ruelle|passage|r[ée]sidence|lotissement|esplanade|voie|cit[ée]|clos|hameau|lieu-dit|dr[èe]ve|mont[ée]e|traverse|zac|za|zi';
const NUMBERED_STREET = new RegExp(`(?:^|\\s)(\\d{1,4}(?:\\s?(?:bis|ter|[a-d]))?\\s*,?\\s+(?:${STREET})\\b.*)$`, 'i');
// What follows the street in a title: the act's words, a date, a sheet number.
const AFTER_STREET = /\s+(?:arr[êe]t[ée]|r[ée]c[ée]piss[ée]|d[ée]cision|accord|refus|favorable|d[ée]favorable|non[- ]?opposition|opposition|avec prescriptions?|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|du \d[\d/.-]*)(?=\s|$).*$/i;
// i18n-ignore-end

/** A title's numbered street, from its house number on, or null. */
export function intramurosStreet(title) {
  const match = NUMBERED_STREET.exec(clean(title));
  if (!match) return null;
  const street = clean(match[1].replace(AFTER_STREET, '').replace(/[\s,;-]+$/, ''));
  return street.length >= 6 ? street : null;
}

/** The legal board of an IntraMuros page, or null when the page has none. */
export function intramurosDocuments(html) {
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(String(html ?? ''));
  if (!match) return null;
  try {
    const documents = JSON.parse(match[1])?.props?.pageProps?.legalDisplayDocuments;
    return Array.isArray(documents) ? documents : null;
  } catch {
    return null;
  }
}

/**
 * The permit files of a board, one per PDF of an urbanism document posted on
 * or after `since`, each with the row its title gives.
 *
 * @param {object} city One of the IntraMuros communes.
 * @param {Array<object>} documents `legalDisplayDocuments`.
 * @param {string} since `YYYY-MM-DD`.
 */
export function intramurosFiles(city, documents, since) {
  const files = [];
  for (const doc of documents) {
    if (!URBANISM_CATEGORY.test(clean(doc?.category_name))) continue;
    const published = municipalDate(String(doc.published_at ?? doc.created_at ?? '').slice(0, 10));
    if (!published || published < since) continue;
    for (const file of Array.isArray(doc.files) ? doc.files : []) {
      let url;
      try { url = new URL(file.file); } catch { continue; }
      if (!/\.pdf$/i.test(url.pathname)) continue;
      const title = clean(`${file.name ?? ''} ${doc.name ?? ''}`);
      const dossier = municipalDossier(clean(file.name), city) ?? municipalDossier(clean(doc.name), city);
      if (!dossier) continue;
      const board = FILING_WORDS.test(title) ? 'filings'
        : DECISION_WORDS.test(title) ? 'decisions' : city.source?.board ?? 'filings';
      const street = intramurosStreet(clean(doc.name)) ?? intramurosStreet(clean(file.name));
      const said = board === 'decisions' ? municipalVerdict(title) : null;
      files.push({
        url: url.href, board, layout: 'extended-notice', published, ocr: true,
        row: {
          board, dossier, applicant: null, ...(street ? municipalSite(street, city) : { address: null, postcode: city.postcode }),
          postedOn: published, ...(board === 'decisions' ? { verdict: said ?? verdicts.signed.fr } : {}),
        },
      });
    }
  }
  return [...new Map(files.map((file) => [file.url, file])).values()];
}

const intramurosProtocol = {
  start(city) {
    return [{ url: city.page, as: 'html' }];
  },
  index(city, html, request, { since }) {
    const documents = intramurosDocuments(html);
    return documents ? { files: intramurosFiles(city, documents, since) } : null;
  },
};

export const INTRAMUROS_BOARD_PROTOCOLS = Object.freeze({ intramuros: Object.freeze(intramurosProtocol) });
export const INTRAMUROS_BOARD_READERS = Object.freeze({});
export const INTRAMUROS_BOARD_TEXT = Object.freeze({});
