/** Caluire-et-Cuire's weekly, scanned planning tables. */
import { municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import { paddedDay } from './permitBoardsReports.js';
import { listParcelCell, listVerdict } from './permitBoardsLists.js';
import messages from './municipalPermitsFeed.i18n.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const decode = (value) => String(value ?? '').replace(/&amp;/g, '&').replace(/&#0*39;|&apos;/g, "'")
  .replace(/&eacute;/g, 'é').replace(/&ocirc;/g, 'ô'); // i18n-ignore-line — decoding the publisher's HTML
const ROOT = '/fichiers/documents/vie_municipale_citoyennete/affichage_reglementaire/2-urbanisme/';
const TYPES = /^(?:PC|DP|PA|PD|CU)$/;

const protocol = Object.freeze({
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request, { since, day }) {
    const files = [];
    for (const link of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      let url;
      try { url = new URL(decode(link[1]), city.page); } catch { continue; }
      if (url.origin !== new URL(city.page).origin || !url.pathname.startsWith(ROOT) || !/\.pdf$/i.test(url.pathname)) continue;
      const title = clean(decode(link[2].replace(/<[^>]*>/g, ' ')));
      // i18n-ignore-next-line — the municipal links' own titles
      const board = /Avis des d[ée]p[ôo]ts.*urbanisme/i.test(title) ? 'filings' : /Avis des d[ée]livrances.*urbanisme/i.test(title) ? 'decisions' : null;
      const published = paddedDay(title);
      if (!board || !published || published < since || published > day) continue;
      files.push({ url: url.href, board, published, asOf: day, layout: 'caluire-register', scan: true, ocr: true,
        ocrTypeColumn: { left: board === 'filings' ? 68 : 77, right: board === 'filings' ? 84 : 91,
          yearLeft: 96, yearRight: 112 } });
    }
    return { files };
  },
});

/** The measured columns keep the applicant cell entirely outside project fields. */
export function readCaluireRegister(document, { city, file }) {
  const rows = [];
  const filings = file.board === 'filings';
  const cuts = filings ? { type: [65, 90], year: [94, 112], counter: [118, 141], filed: [148, 178],
    posted: [184, 222], purpose: [226, 446], streetType: [566, 604], street: [609, 666], number: [672, 694],
    section: [700, 734], parcel: [741, 794] }
    : { type: [74, 94], year: [96, 115], counter: [120, 140], filed: [147, 173],
      posted: [177, 212], purpose: [215, 415], streetType: [502, 540], street: [544, 591], number: [598, 615],
      section: [622, 651], parcel: [658, 695], verdict: [702, 730], decided: [735, 759], decisionPosted: [762, 795] };
  for (const page of document?.pages ?? []) {
    const runs = page.runs ?? [];
    const header = runs.find((r) => r.text === 'Type' && r.x >= cuts.type[0] && r.x < cuts.type[1]);
    // A changed or shifted export is withheld rather than reading a name as a site.
    if (!header || !runs.some((r) => r.text === 'adresse' && r.x >= cuts.street[0] && r.x < cuts.street[1]
      && Math.abs(r.y - header.y) < 4)
      // i18n-ignore-next-line — the publisher's applicant-column header
      || !runs.some((r) => r.text === 'pétitionnaire' && Math.abs(r.x - (filings ? 492 : 440)) < 6
        && Math.abs(r.y - header.y) < 4)) continue;
    const anchors = runs.filter((r) => r.x >= cuts.year[0] && r.x < cuts.year[1]
      && /^\d{2}$/.test(r.text) && r.y < header.y - 5).sort((a, b) => b.y - a.y);
    anchors.forEach((anchor, i) => {
      const top = i ? (anchor.y + anchors[i - 1].y) / 2 : header.y - 5;
      const bottom = anchors[i + 1] ? (anchor.y + anchors[i + 1].y) / 2 : anchor.y - 7;
      const body = runs.filter((r) => r.y <= top && r.y > bottom && /[\p{L}\d]/u.test(r.text));
      const cell = (key) => body.filter((r) => r.x >= cuts[key][0] && r.x < cuts[key][1])
        .sort((a, b) => Math.abs(a.y - b.y) < 2 ? a.x - b.x : b.y - a.y).map((r) => r.text).join(' ');
      const family = clean(cell('type'));
      const counter = clean(cell('counter'));
      if (!TYPES.test(family) || !/^\d{1,5}$/.test(counter)) return;
      const dossier = municipalDossier(`${family} 0${city.insee} ${anchor.text} ${counter.padStart(5, '0')}`, city);
      if (!dossier || `20${anchor.text}` > file.asOf.slice(0, 4)) return;
      const number = clean(cell('number'));
      const site = municipalSite(`${/^\d{1,4}(?:\s*(?:bis|ter))?$/i.test(number) ? number : ''} ${cell('streetType')} ${cell('street')}`, city);
      const parcels = listParcelCell(`${cell('section')} ${cell('parcel')}`);
      if (!site.address && !parcels) return;
      const date = (key) => { const value = paddedDay(cell(key)); return value && value <= file.asOf ? value : null; };
      rows.push({ board: file.board, dossier, ...site, parcels, applicant: null,
        purpose: clean(cell('purpose')) || null, filedOn: date('filed'),
        postedOn: date(filings ? 'posted' : 'decisionPosted') ?? file.published,
        ...(filings ? {} : { decidedOn: date('decided'),
          verdict: municipalVerdict(cell('verdict')) ?? listVerdict(cell('verdict')) ?? messages.definition.signed.fr }) });
    });
  }
  return rows;
}

export const CALUIRE_BOARD_PROTOCOLS = Object.freeze({ 'caluire-register': protocol });
export const CALUIRE_BOARD_READERS = Object.freeze({ 'caluire-register': readCaluireRegister });
