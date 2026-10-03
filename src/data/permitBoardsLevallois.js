/** Levallois's public Webdelib urbanism tab: rolling filing lists and orders. */
import { parseWebdelibActs, webdelibMonths, webdelibMonthUrl } from './permitListsFeed.js';
import { municipalDossier, municipalVerdict } from './municipalPermitsFeed.js';

// i18n-ignore-start — titles in the publisher's public index
const FAMILIES = [
  /(?:liste.*(?:permis de construire|depot.pc))/i,
  /(?:liste.*(?:d[ée]claration pr[ée]alable|depot.dp))/i,
  /(?:liste.*(?:permis de d[ée]molir|depot.pd))/i,
];
// i18n-ignore-end

/** The public showFile endpoint uses only the index's document token. */
export function levalloisFileUrl(url, city) {
  const opened = new URL(url);
  const base = new URL(city.source.base);
  const token = opened.searchParams.get('pdf');
  if (opened.origin !== base.origin || opened.pathname !== `${base.pathname}/jsp/openfile.jsp` || !token) return null;
  const file = new URL(`${base.pathname}/jsp/showFile.jsp`, base.origin);
  file.searchParams.set('pdf', token);
  return file.href;
}

export function levalloisActs(city, acts, since, day) {
  const lists = new Set();
  const seen = new Set();
  return [...acts].filter((act) => act.published && act.published >= since && act.published <= day)
    .sort((a, b) => b.published.localeCompare(a.published)).flatMap((act) => {
      if (seen.has(act.url)) return [];
      seen.add(act.url);
      const url = levalloisFileUrl(act.url, city);
      if (!url) return [];
      const family = FAMILIES.findIndex((pattern) => pattern.test(act.title));
      if (family >= 0) {
        if (lists.has(family)) return [];
        lists.add(family);
        return [{ url, board: 'filings', layout: 'levallois-filings', published: act.published }];
      }
      const dossier = municipalDossier(act.title, city);
      if (!dossier || !/^(?:PC|DP|PA|PD) /.test(dossier) || dossier.split(' ')[1] !== city.insee.padStart(6, '0')) return [];
      // The first page holds the dossier and project; unread signing dates
      // stay unknown instead of being replaced by the publication date.
      return [{ url, board: 'decisions', layout: 'dematdoc-notice', published: act.published, ocr: true, ocrPages: 1,
        row: { board: 'decisions', dossier, applicant: null, address: null, postcode: city.postcode,
          postedOn: act.published, verdict: municipalVerdict(act.title) } }];
    });
}

const protocol = {
  start(city, { since, day }) {
    const count = (Number(day.slice(0, 4)) - Number(since.slice(0, 4))) * 12
      + Number(day.slice(5, 7)) - Number(since.slice(5, 7)) + 1;
    const [month, ...remaining] = webdelibMonths(day, count);
    return [{ url: webdelibMonthUrl(city, month), as: 'html', remaining, acts: [] }];
  },
  index(city, html, request, { since, day }) {
    // The expected urbanism table must be present, including an empty month.
    if (!/tableActe|D[ée]cisions urbanisme|Avis de d[ée]p[ôo]t/i.test(html ?? '')) return null;
    const acts = [...request.acts, ...parseWebdelibActs(html, request.url)];
    const [month, ...remaining] = request.remaining;
    if (month) return { next: [{ url: webdelibMonthUrl(city, month), as: 'html', remaining, acts }] };
    return { files: levalloisActs(city, acts, since, day) };
  },
};

export const LEVALLOIS_BOARD_PROTOCOLS = Object.freeze({ levallois: Object.freeze(protocol) });
