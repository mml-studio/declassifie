/** Public Delibs decisions and Eaubonne's municipal planning orders. */
import { municipalDate, municipalDossier, municipalVerdict } from './municipalPermitsFeed.js';
import { dematdocParcels } from './dematdocFeed.js';
import { readOuterParisNotice } from './outerParisPermits.js';
import messages from './municipalPermitsFeed.i18n.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const decode = (value) => String(value ?? '').replace(/&(#\d+|#x[\da-f]+|amp|quot|apos|nbsp|rsquo|eacute|egrave);/gi, (whole, key) => {
  if (key[0] === '#') return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1)));
  return ({ amp: '&', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', eacute: 'é', egrave: 'è' })[key.toLowerCase()] ?? whole; // i18n-ignore-line — HTML entity decoding
});
const plain = (html) => clean(decode(String(html ?? '').replace(/<[^>]*>/g, ' ')));

// i18n-ignore-start — published act titles, matched but never retained
const PERMIT = /DECLARATION PREALABLE|PERMIS DE (?:CONSTRUIRE|DEMOLIR|AMENAGER)|CERTIFICAT D.URBANISME|\b(?:PC|DP|PA|PD|CU)\s*\d/;
const OTHER_ACT = /PERMIS DE LOUER|CIRCULATION|STATIONNEMENT|PREEMPTION|\bPLUI?\b|ENQUETE PUBLIQUE|DELEGATION|DEPOT D.UN PERMIS|AUTORISATION.*DEPOSER|ENSEIGNE/;
// i18n-ignore-end
const permitTitle = (value) => PERMIT.test(fold(value)) && !OTHER_ACT.test(fold(value));

function documentLines(document) {
  return (document?.pages ?? []).flatMap((page) => {
    const lines = [];
    for (const run of [...(page.runs ?? [])].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const line = lines.at(-1);
      if (line && Math.abs(line.y - run.y) < 2) line.runs.push(run);
      else lines.push({ y: run.y, runs: [run] });
    }
    return lines.map((line) => clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')));
  });
}

function decisionVerdict(document) {
  const lines = documentLines(document);
  const body = lines.join('\n');
  const opening = /(?:^|\n)\s*ARTICLE\s+(?:1(?:er)?|UNIQUE)\b\s*[:.\-–]?/i.exec(body);
  if (opening) {
    const article = body.slice(opening.index + opening[0].length, opening.index + opening[0].length + 600)
      .split(/\n\s*ARTICLE\s+\d/i)[0];
    return municipalVerdict(article) ?? messages.definition.signed.fr;
  }
  const headings = documentLines({ pages: document?.pages?.slice(0, 1) }).map(fold);
  // i18n-ignore-start — the certificates' explicit headings, not their recitals
  if (headings.some((line) => /^CERTIFICAT D['’](?:UNE DECLARATION PREALABLE|UN PERMIS DE (?:CONSTRUIRE|DEMOLIR|AMENAGER)) TACITE$/.test(line))) return messages.definition.tacit.fr;
  if (headings.some((line) => /^CERTIFICAT DE DECISION DE NON OPPOSITION A UNE DECLARATION PREALABLE$/.test(line))) return messages.definition.unopposed.fr;
  // i18n-ignore-end
  return messages.definition.signed.fr;
}

function delibsRequest(city, page = 1) {
  const url = new URL(`/api/organismes/${city.source.tenant}/actes`, city.page);
  // The public legal board is two months deep. Use its supported page size:
  // larger sizes change nombrePages but still return only twenty acts.
  url.search = new URLSearchParams({ noeud: 'affichage-legal', page: String(page), parPage: '20' });
  return { url: url.href, as: 'json' };
}

const delibs = {
  start: (city) => [delibsRequest(city)],
  index(city, body, request, { since, day }) {
    const page = Number(new URL(request.url).searchParams.get('page'));
    if (!Array.isArray(body?.actes) || body.page !== page || !Number.isInteger(body.total) || body.total < 0
      || !Number.isInteger(body.nombrePages) || body.nombrePages < 0
      || (body.total > 0 && (!body.actes.length || body.nombrePages < page))) return null;
    const files = [];
    for (const act of body.actes) {
      if (!Array.isArray(act?.objet) || act.type !== 'arrete' || !permitTitle(act.objet.join(' '))) continue;
      const published = municipalDate(act.datePublication);
      if (!published || published < since || published > day) continue;
      let url;
      try { url = new URL(act.urlPdf, city.page); } catch { continue; }
      if (url.origin !== new URL(city.page).origin
        || url.pathname !== `/api/organismes/${city.source.tenant}/documents/acte-${act.id}.pdf`
        || !Number.isSafeInteger(act.id) || act.id < 1 || url.search || url.hash) continue;
      files.push({ url: url.href, board: 'decisions', layout: 'published-permit-notice', published,
        dossier: municipalDossier(act.objet.join(' '), city), asOf: day, scan: true, ocr: true, ocrPages: 4 });
    }
    // Do not stop at a page without planning acts: other municipal acts
    // occupy the first pages. Annexes (CERFA, applicant files) are not read.
    return { files, next: page < body.nombrePages ? [delibsRequest(city, page + 1)] : [] };
  },
};

const eaubonne = {
  start(city, { since, day }) {
    const url = new URL(city.page);
    const month = (date) => `${date.slice(5, 7)}/${date.slice(0, 4)}`;
    // The "Urbanisme" act-type filter is empty; the theme has the orders.
    url.search = new URLSearchParams({ f: '1', 'theme[]': 'urbanisme', date_debut: month(since), date_fin: month(day) });
    return [{ url: url.href, as: 'html' }];
  },
  index(city, html, request, { since, day }) {
    if (!/page-posts-count/.test(html ?? '') || !/Liste des annonces l[ée]gales/i.test(plain(html))) return null;
    const files = [];
    for (const match of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)) {
      const article = match[1];
      const title = plain(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(article)?.[1]);
      if (!permitTitle(title)) continue;
      const published = municipalDate(/<time\b[^>]*datetime=["']([^"']+)["']/i.exec(article)?.[1]);
      if (!published || published < since || published > day) continue;
      for (const link of article.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
        let url;
        try { url = new URL(decode(link[1]), request.url); } catch { continue; }
        if (url.origin !== new URL(city.page).origin || !/\.pdf$/i.test(url.pathname)) continue;
        files.push({ url: url.href, board: 'decisions', layout: 'published-permit-notice', published,
          dossier: municipalDossier(title, city), asOf: day, scan: true, ocr: true, ocrPages: 4 });
      }
    }
    const next = [];
    const current = new URL(request.url);
    const currentPage = Number(/\/page\/(\d+)\//.exec(current.pathname)?.[1] ?? 1);
    for (const link of html.matchAll(/<a\b([^>]*href=["']([^"']+)["'][^>]*)>/gi)) {
      if (!/\bnext\b|rel=["']next["']/i.test(link[1])) continue;
      let url;
      try { url = new URL(decode(link[2]), request.url); } catch { continue; }
      if (url.origin !== current.origin || url.pathname !== `${new URL(city.page).pathname}page/${currentPage + 1}/`) continue;
      // Preserve every collection filter even if a pagination link drops it.
      url.search = current.search;
      next.push({ url: url.href, as: 'html' });
    }
    return { files, next };
  },
};

/** Only project fields from the order, with cadastral/zone suffixes removed. */
export function readPublishedPermitNotice(document, context) {
  const runs = (document?.pages ?? []).flatMap((page) => page.runs ?? []);
  const frontRuns = document?.pages?.[0]?.runs ?? [];
  // Require a number in the actual order; the index alone is not evidence.
  if (!municipalDossier(runs.map((run) => run.text).join(' '), context.city)) return [];
  return readOuterParisNotice(document, context).map((row) => {
    let address = row.address;
    let parcels = row.parcels;
    // i18n-ignore-start — the orders' field labels and appended cadastral zone
    const suffix = /\s+[-–—]\s+((?:[A-Z]{1,2}\s*\d{1,4}[, /]*)+)?\s*(?:[-–—]\s*)?(?:ZONE\b.*)?$/i.exec(address ?? '');
    if (suffix) {
      address = address.slice(0, suffix.index);
      // OCR's "Ki9" may be K19, not section KI parcel 9. Keep the street
      // and leave an ambiguous parcel unread instead of repairing it.
      if (suffix[1] && /[a-z]/.test(suffix[1])) parcels = null;
      else parcels ??= dematdocParcels(suffix[1], context.city);
    }
    if (!parcels) {
      const siteLabel = frontRuns.find((run) => /^(?:terrain|sis)\b/i.test(run.text));
      if (siteLabel) {
        const below = frontRuns.filter((run) => run.y < siteLabel.y && siteLabel.y - run.y < 30);
        const parcel = below.find((run) => /^(?:[A-Z]{1,2}\s*\d{1,4}[, /]*)+$/.test(clean(run.text)));
        if (parcel) parcels = dematdocParcels(parcel.text, context.city);
      }
    }
    const purpose = row.purpose?.replace(/\s+ARR[ÊE]T[ÉE]\b.*$/i, '').trim() || null;
    // i18n-ignore-end
    const verdict = decisionVerdict(document);
    return { ...row, address: clean(address) || null, parcels, purpose, verdict };
  });
}

export const PUBLISHED_PERMIT_PROTOCOLS = Object.freeze({
  delibs: Object.freeze(delibs), eaubonne: Object.freeze(eaubonne),
});
export const PUBLISHED_PERMIT_READERS = Object.freeze({ 'published-permit-notice': readPublishedPermitNotice });
