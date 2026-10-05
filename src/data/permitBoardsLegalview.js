/**
 * LEGALView (IPO Technologie), a legal-display service at `saas-legalview.fr`.
 * A commune's portal, `/public/legalview/<slug>`, is an Angular app over a
 * public JSON API, no key and no robots.txt (2026-10-04): `/api/public/
 * legalview/org/<slug>/theme/<id>?page=&limit=` answers a theme's documents,
 * newest posted first, each with its title, its posting time (`publishDate`)
 * and the text the platform read from its scan (`ocrText`). The API allows
 * 30 requests a minute; a reading asks for a page of 100 at a time and stops
 * at the window's start, {@link LEGALVIEW_MAX_PAGES} pages at most.
 *
 * Vienne (38) posts each planning order under « Autorisations d'urbanisme »,
 * titled by its clerk: the act's number, the kind of decision, the dossier's
 * number, the applicant, then « pour », the works and the site —
 * `A26_2137-REFUS DE DP 0385442610342 [name] pour remplacement de portes de
 * garage 2 avenue Beauséjour`. The number, the verdict the kind says, the
 * works and the site are taken from the title, never what precedes « pour »;
 * the filing day and the parcels from the platform's text, never the rest of
 * it, which names the applicant and where they live. The stamped signing
 * day is not legible there, so an order has its posting day only. 272 orders
 * reached back to 12 April on 2026-10-04.
 */
import { municipalDate, municipalDossier, municipalSite } from './municipalPermitsFeed.js';
import { listParcelCell } from './permitBoardsLists.js';
import messages from './municipalPermitsFeed.i18n.js';

const API = 'https://www.saas-legalview.fr/api/public/legalview';
const PAGE_SIZE = 100;
/** Pages of {@link PAGE_SIZE} documents one reading asks for at most. */
export const LEGALVIEW_MAX_PAGES = 5;
const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// i18n-ignore-start — the clerk's words for a decision's kind, French street words and the order's own labels
const WAY = '(?:(?:petite|grande)\\s+)?(?:rue|avenue|boulevard|blvd|bd|place|chemin|all[ée]e|impasse|route|quai|cours|square|passage|mont[ée]e|lotissement|clos|hameau|esplanade|c[ôo]te|r[ée]sidence|cit[ée]|faubourg|sentier|promenade|traverse)';
const HOUSE = '\\d{1,4}\\s?(?:bis|ter|[a-z])?(?:\\s*(?:-|à|et|/)\\s*\\d{1,4}\\s?(?:bis|ter|[a-z])?)?,?\\s+';
const NUMBERED_SITE = new RegExp(`(?<![\\p{L}\\d])${HOUSE}${WAY}(?![\\p{L}\\d])`, 'giu');
const BARE_SITE = new RegExp(`(?<![\\p{L}\\d])${WAY}(?![\\p{L}\\d])`, 'giu');
/** A way word after these is the works' (« mise en place », « un lotissement »), not the site's. */
const NOT_A_SITE = /(?:^|\s)(?:en|une?|d['’]une?)\s*$/i;
/** `Déposé le 24/06/2026`, `dossier déposé le 26, juin 2026`, `Déposé le e 26/06/2026` as OCR reads it. */
const FILED = /d[ée]pos[ée]e?\s+le\b(.{0,32})/i;
/** A modification's or transfer's order describes the original dossier after these words. */
const ORIGINAL = /ORIGINE|\bN\s*[°ºo]\s*Dossier\b/i;
const PARCELS = /cadastr[ée]e?s?\s*:?\s*([A-Z]{1,2}\s?\d{1,4}(?:\s*(?:,|;|et|-)\s*[A-Z]{0,2}\s?\d{1,4})*)/i;
/** What parts a title's applicant from the works and site that follow. */
const FOR = ' pour ';
/** An article the works end on when the site follows it (« réaménagement de la place Drapière »). */
const TRAILING_ARTICLE = /\s+(?:de la|de l['’]|du|des|de|la|le|les|à|au|aux|sur)$/i;
// i18n-ignore-end

/**
 * A title's site: the last numbered street, else the last street word the
 * works do not own (« mise en place de volets » is not a place), up to the
 * title's end; or null — a hamlet's name alone (« à Malissol ») is not read.
 */
export function legalviewSite(text) {
  const words = clean(text);
  const numbered = [...words.matchAll(NUMBERED_SITE)].at(-1);
  const bare = numbered ? null : [...words.matchAll(BARE_SITE)].filter((match) => !NOT_A_SITE.test(words.slice(0, match.index))).at(-1);
  const at = numbered ?? bare;
  if (!at) return null;
  const site = clean(words.slice(at.index)).replace(/[\s.,;:-]+$/, '');
  return site.length >= 6 ? { at: at.index, site } : null;
}

/**
 * The verdict a title's kind says (`REFUS DE DP`, `PC MODIFICATIF`,
 * `ANNULATION DE PC`, `TRANSFERT DE PC`), else the dossier's: a declaration
 * not opposed, a permit granted. Undefined for a lapse or an extension,
 * which decide no project.
 */
export function legalviewVerdict(kind, dossier) {
  const words = fold(kind);
  if (/CADUCIT|PROROGATION/.test(words)) return undefined;
  if (/REFUS|(?<!NON[- ]?)OPPOSITION/.test(words)) return verdicts.refused.fr;
  if (/ANNULATION|RETRAIT/.test(words)) return verdicts.withdrawn.fr;
  if (/TRANSFERT/.test(words)) return verdicts.signed.fr;
  return dossier.startsWith('DP ') ? verdicts.unopposed.fr : verdicts.granted.fr;
}

/**
 * The filing day an order's text gives before it describes the original
 * dossier — the original's day is not this step's — and, for a dossier that
 * is not a step, in the dossier's own year; or null.
 */
function orderFiledOn(text, dossier) {
  const match = FILED.exec(text);
  if (!match || ORIGINAL.test(text.slice(0, match.index))) return null;
  const day = municipalDate(clean(match[1].replace(/\s*\/\s*/g, '/').replace(/[,:;]/g, ' ')));
  const [, , year, , step] = dossier.split(' ');
  return day && (step || day.slice(2, 4) === year) ? day : null;
}

/** The day a posting time (`2026-10-01T08:33:36.637Z`) falls on in France, or null. */
function postingDay(time) {
  const at = new Date(String(time ?? ''));
  return Number.isNaN(at.getTime()) ? null : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(at);
}

/**
 * One posted order's row, or null when its title is not an order of the
 * commune's: `{board: 'decisions', dossier, address, postcode, parcels,
 * purpose, filedOn, postedOn, verdict}`, never the applicant.
 */
export function legalviewOrderRow(city, document) {
  const title = clean(document?.title);
  const postedOn = postingDay(document?.publishDate);
  const split = title.indexOf(FOR);
  if (!postedOn || split < 0) return null;
  // The act's number (`A26_2132-`, `A26_818 ` where a tab parted it) goes first.
  const head = title.slice(0, split).replace(/^\S*?\d{3,4}(?:\s*-\s*|\s+)/, '');
  // `PC MODIFICATIF 0385442410008 M01`: the type's qualifier parts it from its number.
  const dossier = municipalDossier(head.replace(/\b(PC|DP|PA|PD)\s+MODIFICATI(?:F|VE)\b/i, '$1'), city);
  if (!dossier || dossier.startsWith('CU ')) return null;
  const verdict = legalviewVerdict(head.slice(0, Math.max(0, head.search(/\d/))), dossier);
  if (!verdict) return null;
  const tail = title.slice(split + FOR.length);
  const site = legalviewSite(tail);
  const text = clean(document?.ocrText);
  const filedOn = orderFiledOn(text, dossier);
  const parcels = listParcelCell(PARCELS.exec(text)?.[1] ?? '');
  return {
    board: 'decisions', dossier, applicant: null,
    ...(site ? municipalSite(site.site, city) : { address: null, postcode: city.postcode }),
    parcels,
    purpose: clean(site ? tail.slice(0, site.at) : tail).replace(/[\s.,;:-]+$/, '').replace(TRAILING_ARTICLE, '') || null,
    filedOn: filedOn && filedOn <= postedOn ? filedOn : null,
    postedOn, verdict,
  };
}

const themeRequest = (city, page) => ({
  url: `${API}/org/${city.source.org}/theme/${city.source.theme}?page=${page}&limit=${PAGE_SIZE}`, as: 'json', page,
});

const legalviewProtocol = {
  start: (city) => [themeRequest(city, 1)],
  index(city, body, request, { since, day } = {}) {
    const documents = body?.documents;
    if (!Array.isArray(documents) || !body?.pagination) return null;
    const rows = [];
    let oldest = null;
    for (const document of documents) {
      const row = legalviewOrderRow(city, document);
      const posted = postingDay(document?.publishDate);
      if (posted && (!oldest || posted < oldest)) oldest = posted;
      if (row && row.postedOn >= since && (!day || row.postedOn <= day)) rows.push(row);
    }
    const page = request.page ?? 1;
    const more = body.pagination.hasMore === true && oldest && oldest >= since && page < LEGALVIEW_MAX_PAGES;
    return { rows, next: more ? [themeRequest(city, page + 1)] : [] };
  },
};

export const LEGALVIEW_BOARD_PROTOCOLS = Object.freeze({ legalview: Object.freeze(legalviewProtocol) });
