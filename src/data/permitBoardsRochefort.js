/**
 * Rochefort's legal board, « Affichage Rochefort »: a web app whose Drupal
 * back end answers plain GETs in JSON, no key. `listPublication` gives every
 * document of a category — the Urbanisme one is section 109 of board 108 —
 * with its title, its type and the day it was posted (a Unix timestamp);
 * `getDocument64` gives one document's PDF path. A document typed
 * « Déclaration préalable de travaux », « Permis de construire », « Permis de
 * démolir » or « Décision » is an order, one per dossier, its title the
 * number, the applicant, the site and the works (`DP 017 299 26 00423 [name]
 * 21 Av Marcel Dassault PAC`); the weekly « Avis » lists and the certificates
 * are not read. The PDFs are scans (read on 2026-10-03: an « ARRÊTÉ de
 * non-opposition » with its filing day), read by `dematdoc-notice` by OCR in
 * the daily sweep; meanwhile the title gives the number and a numbered street.
 *
 * Each order's path costs a request: a reading asks for the
 * {@link ROCHEFORT_NEWEST} newest orders of the window, and the archive keeps
 * what earlier readings read. Applicants: only the number and a numbered
 * street — from its house number on — are taken from a title.
 */
import { municipalDossier, municipalSite } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';

const API = 'https://adminrocheaffiche.ville-rochefort.fr/api';
const BOARD = { eid: 108, cid: 92, sid: 109 };
/** Orders whose PDF path one reading asks for, newest first. */
export const ROCHEFORT_NEWEST = 30;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

// i18n-ignore-start — the board's own types and French street words, matched on
const ORDER_TYPE = /^(?:d[ée]claration pr[ée]alable|permis de (?:construire|d[ée]molir|am[ée]nager)|d[ée]cision)/i;
const STREET = 'rue|r|avenue|av|boulevard|bd|place|pl|chemin|ch|all[ée]e|impasse|imp|route|rte|quai|cours|square|sentier|passage|r[ée]sidence|cit[ée]|faubourg|fbg';
const NUMBERED_STREET = new RegExp(`(?:^|\\s)(\\d{1,4}(?:\\s?(?:bis|ter|[a-d]))?\\s+(?:${STREET})\\.?\\s+\\S.*)$`, 'i');
/** A title's works open with one of these words; the street name stops before it. */
const WORKS = /^(?:PAC|habitation|construction|extension|enl[èe]vement|pose|remplacement|division|cr[ée]ation|modification|installation|r[ée]fection|ravalement|cl[ôo]ture|abri|piscine|panneaux|changement|d[ée]molition|isolation|r[ée]novation|am[ée]nagement|travaux|mise|v[ée]randa|carport|garage|fen[êe]tres?|toiture|menuiseries|annexe|surélévation|sur[ée]l[ée]vation|ITE|photovolta[iï]ques?|portail|ouverture|transformation|r[ée]habilitation|lotissement|enseignes?)$/i;
// i18n-ignore-end

/** The day a timestamp falls on in Rochefort, `YYYY-MM-DD`, or null. */
export function rochefortDay(timestamp) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(seconds * 1000));
}

/**
 * A title's numbered street, from its house number to the end of the street
 * name, or null: the works that follow open with a works word (« PAC »,
 * « Habitation », « Enlèvement »), and at most five words follow the street's.
 */
export function rochefortStreet(title) {
  const match = NUMBERED_STREET.exec(clean(title));
  if (!match) return null;
  const words = match[1].split(' ');
  const at = words.findIndex((word) => new RegExp(`^(?:${STREET})\\.?$`, 'i').test(word));
  const end = words.findIndex((word, i) => i > at + 1 && WORKS.test(word));
  return clean(words.slice(0, Math.min(end < 0 ? words.length : end, at + 6)).join(' ')) || null;
}

const listRequest = () => ({
  url: `${API}/listPublication?_format=json&EID=${BOARD.eid}&CID=${BOARD.cid}&SID=${BOARD.sid}`, as: 'json',
});

const rochefortProtocol = {
  start: () => [listRequest()],
  index(city, body, request, { since, day } = {}) {
    if (request.order) {
      const path = body?.fb64;
      if (typeof path !== 'string' || !/^\/sites\/default\/files\/pdf\/[^/?#]+\.pdf$/i.test(path)) return null;
      const { dossier, published, street } = request.order;
      return {
        files: [{
          url: new URL(path, API).href, board: 'decisions', layout: 'dematdoc-notice', published, ocr: true,
          row: { board: 'decisions', dossier, applicant: null, ...(street ? municipalSite(street, city) : { address: null, postcode: city.postcode }),
            postedOn: published, verdict: messages.definition.signed.fr },
        }],
      };
    }
    if (!Array.isArray(body)) return null;
    const orders = [];
    for (const item of body) {
      const published = rochefortDay(item?.timestamp);
      if (!published || published < since || (day && published > day) || !ORDER_TYPE.test(clean(item.type))) continue;
      const dossier = municipalDossier(clean(item.title), city);
      if (!dossier || dossier.startsWith('CU ') || !/^\d+$/.test(String(item.tid)) || !/^\d+$/.test(String(item.fid))) continue;
      orders.push({ published, tid: item.tid, fid: item.fid, dossier, street: rochefortStreet(item.title) });
    }
    orders.sort((a, b) => b.published.localeCompare(a.published) || Number(b.tid) - Number(a.tid));
    return {
      files: [],
      next: orders.slice(0, ROCHEFORT_NEWEST).map((order) => ({
        url: `${API}/getDocument64?_format=json&SID=${order.tid}&DID=${order.fid}&SOURCE=app&UNIQUE=0`, as: 'json',
        order: { dossier: order.dossier, published: order.published, street: order.street },
      })),
    };
  },
};

export const ROCHEFORT_BOARD_PROTOCOLS = Object.freeze({ rochefort: Object.freeze(rochefortProtocol) });
