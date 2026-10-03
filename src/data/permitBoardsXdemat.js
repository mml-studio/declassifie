/**
 * SPL-Xdemat's legal boards (`opendata.spl-xdemat.fr`), the acts platform the
 * Aube, the Ardennes, the Marne, the Haute-Marne, the Aisne, the Meuse, the
 * Vosges and Meurthe-et-Moselle share with their communes. A member's board
 * is a frame, `/frame/MA<INSEE>/affichage-administratif`; its « Décisions
 * d'urbanisme » tab asks one URL for every commune, twenty postings a page,
 * newest first, back to 2024. See `permitBoards.js` for the contract.
 *
 * Each posting is a dossier's filing receipt (« Récépissé de dépôt ») or its
 * order (« Arrêté de décision »): its full number, the site, the works and
 * the day it was posted. The order's verdict is only in its PDF, which is not
 * read: the row says the decision was signed. Measured on 2026-10-02 over the
 * 479 most populous communes of the eight departments with no other source:
 * 139 have a frame, 31 posted since July (Épinal 416 postings, Lunéville
 * 530, Chaumont 453).
 *
 * Applicants: never read. Each posting names its applicant in a field of its
 * own, private people among them; the reader takes the number, site, works
 * and day and nothing else.
 *
 * `robots.txt` is `Disallow: /` (2026-10-02): read by the project's decision,
 * as DematDOC's boards are — the posting the Code de l'urbanisme makes public
 * (art. R.423-6, R.424-15).
 */
import { municipalDate, municipalDossier, municipalSite } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

export const XDEMAT_ORIGIN = 'https://opendata.spl-xdemat.fr';

/** The server sends twenty postings a page whatever is asked. */
const PAGE_SIZE = 20;

/** Pages read at most per commune and reading: Lunéville posts about 60 a month. */
export const XDEMAT_MAX_PAGES = 15;

/** The frame a member's site embeds: the page a visitor sees. */
export function xdematFrameUrl(insee) {
  return `${XDEMAT_ORIGIN}/frame/MA${insee}/affichage-administratif`;
}

/** One page of a commune's urbanism postings, as the frame asks for it. */
export function xdematRequest(city, page, day) {
  return {
    url: `${XDEMAT_ORIGIN}/ajax/affichage-administratif/ajx_urbanisme.php`,
    as: 'json',
    method: 'POST',
    body: new URLSearchParams({
      isIframe: '1', uid: `MA${city.insee}`, affichage: 'urbanisme',
      anneeCourante: String(day ?? '').slice(0, 4), page: String(page), nbItems: String(PAGE_SIZE),
    }).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
  };
}

function decode(value) {
  const names = { amp: '&', apos: "'", quot: '"', nbsp: ' ', lt: '<', gt: '>' };
  return String(value ?? '').replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (whole, name) => {
    if (name.startsWith('#')) return String.fromCodePoint(parseInt(name.slice(name[1].toLowerCase() === 'x' ? 2 : 1), name[1].toLowerCase() === 'x' ? 16 : 10));
    return names[name.toLowerCase()] ?? whole;
  });
}

// i18n-ignore-start — the board's own labels, matched on
const NUMBER_RE = /N°\s*de\s*dossier\s*:\s*([^<]+)</i;
const SITE_RE = /Adresse du terrain\s*<\/span>\s*:\s*<span[^>]*>([^<]*)</i;
const WORKS_RE = /Description du projet\s*<\/span>\s*:\s*<span[^>]*>([^<]*)</i;
const POSTED_RE = /Publi[ée] le\s*(\d{2}\/\d{2}\/\d{4})/i;
const LINK_RE = /<\/i>\s*([^<]+?)\s*<\/a>/i;
const FILING_RE = /r[ée]c[ée]piss[ée]|avis de d[ée]p[ôo]t/i;
const DECISION_RE = /arr[êe]t[ée]|d[ée]cision/i;
// i18n-ignore-end

/**
 * The postings of one answer: `{rows, oldest}`, or null when the answer is not
 * a board (a non-member's frame answers no `total`). `oldest` is the posting
 * day of the page's last block, which tells whether to read on.
 *
 * @param {object} city One of the SPL-Xdemat communes.
 * @param {{html: string, total: *}} answer The endpoint's JSON.
 */
export function readXdematPage(city, answer) {
  if (!answer || typeof answer.html !== 'string' || !Number.isFinite(Number(answer.total))) return null;
  const rows = [];
  let oldest = null;
  for (const block of answer.html.split(/<div class="padding">/).slice(1)) {
    const postedOn = municipalDate(POSTED_RE.exec(block)?.[1]);
    if (postedOn) oldest = postedOn;
    const link = clean(decode(LINK_RE.exec(block)?.[1]));
    const board = FILING_RE.test(link) ? 'filings' : DECISION_RE.test(link) ? 'decisions' : null;
    const dossier = municipalDossier(clean(decode(NUMBER_RE.exec(block)?.[1])), city);
    if (!board || !dossier) continue;
    const site = clean(decode(SITE_RE.exec(block)?.[1]));
    rows.push({
      board, dossier, applicant: null,
      ...(site ? municipalSite(site, city) : { postcode: city.postcode }),
      purpose: clean(decode(WORKS_RE.exec(block)?.[1])) || null,
      postedOn,
      verdict: board === 'decisions' ? verdicts.signed.fr : null,
    });
  }
  return { rows, oldest, total: Number(answer.total) };
}

/**
 * Pages newest first until one reaches back past `since`, the last page, or
 * {@link XDEMAT_MAX_PAGES}. The page number travels in the request's body.
 */
const xdematProtocol = {
  start(city, { day }) {
    return [xdematRequest(city, 1, day)];
  },
  index(city, answer, request, { since, day }) {
    const read = readXdematPage(city, answer);
    if (!read) return null;
    const page = Number(new URLSearchParams(request.body).get('page')) || 1;
    const rows = read.rows.filter((row) => !row.postedOn || row.postedOn >= since);
    const more = read.oldest && read.oldest >= since && page * PAGE_SIZE < read.total && page < XDEMAT_MAX_PAGES;
    return { rows, next: more ? [xdematRequest(city, page + 1, day)] : [] };
  },
};

export const XDEMAT_BOARD_PROTOCOLS = Object.freeze({ 'spl-xdemat': Object.freeze(xdematProtocol) });
export const XDEMAT_BOARD_READERS = Object.freeze({});
export const XDEMAT_BOARD_TEXT = Object.freeze({});
