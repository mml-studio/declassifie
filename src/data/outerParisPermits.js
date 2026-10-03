/** Public permit registers in the four departments around Paris. */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import { readDematdocNotice } from './dematdocFeed.js';
import { readExtendedNotice } from './municipalPermitExtensions.js';
import { readReportTable, reportDossier } from './permitBoardsReports.js';
import { listParcelCell, listVerdict } from './permitBoardsLists.js';
import messages from './municipalPermitsFeed.i18n.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const joined = (value) => clean((value ?? []).join(' '));
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const signed = messages.definition.signed.fr;
const head = /^(?:PC|DP|PA|PD|CU)\s*\d/;
const decode = (value) => String(value ?? '').replace(/&(?:amp|quot|apos|#039|nbsp|rsquo);/g,
  (entity) => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#039;': "'", '&nbsp;': ' ', '&rsquo;': '’' })[entity]);
const decodedPath = (url) => {
  try { return decodeURIComponent(new URL(url).pathname); } catch { return new URL(url).pathname; }
};
const noticeDate = (value) => municipalDate(String(value ?? '').replace(/\b(\d{2})\.(\d{2})\.(\d{4})\b/g, '$1/$2/$3'));

function noticeLines(document) {
  return (document?.pages ?? []).flatMap((page) => {
    const lines = [];
    for (const run of [...page.runs].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const line = lines.at(-1);
      if (line && Math.abs(line.y - run.y) < 2) line.runs.push(run);
      else lines.push({ y: run.y, runs: [run] });
    }
    return lines.map((line) => clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')));
  });
}

function links(html, base) {
  return [...String(html ?? '').matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    try {
      const url = new URL(decode(match[1]), base);
      return /^https?:$/.test(url.protocol) ? [{ url: url.href, title: clean(decode(match[2].replace(/<[^>]*>/g, ' '))) }] : [];
    } catch { return []; }
  });
}

function row(city, board, dossier, cells) {
  const site = municipalSite(joined(cells.site), city);
  return { board, dossier, applicant: null, ...site,
    purpose: joined(cells.purpose) || null,
    parcels: listParcelCell(joined(cells.parcels)) ?? site.parcels,
    filedOn: municipalDate(joined(cells.filedOn)),
    postedOn: municipalDate(joined(cells.postedOn)),
    decidedOn: board === 'decisions' ? municipalDate(joined(cells.decidedOn)) : null,
    verdict: board === 'decisions' ? listVerdict(joined(cells.verdict)) ?? signed : null,
    floorArea: /^\d+(?:[.,]\d+)?$/.test(joined(cells.floor)) ? joined(cells.floor).replace(',', '.') : null };
}

/** Excel's compact dossier number and separate house-number column. */
export function readPontaultTable(document, { city, file }) {
  const board = file.board;
  // i18n-ignore-start — the publisher's column headers
  const columns = board === 'filings' ? [
    ['dossier', 'REF.'], ['filedOn', 'DEPOT'], ['applicant', 'DEMANDEUR'],
    ['purpose', 'NATURE DES TRAVAUX'], ['site', 'LIEUX DES TRAVAUX'],
    ['floor', 'SURFACE DE PLANCHER'], ['postedOn', 'AFFICHE LE'],
  ] : [
    ['dossier', 'REF.'], ['filedOn', 'DEPOT'], ['applicant', 'DEMANDEUR'],
    ['purpose', 'NATURE TRAVAUX'], ['number', 'N° VOIRIE'], ['site', 'ADRESSE DES TRAVAUX'],
    ['decidedOn', 'DATE DECISION'], ['floor', 'SURFACE DE PLANCHER'], ['postedOn', 'AFFICHE LE'],
  ];
  // i18n-ignore-end
  const spec = {
    columns, rule: 'centre', place: 'top', head, anchor: (text) => reportDossier(text, city),
    noise: /^\d+\s*\/\s*\d+$|^Page\s+\d+/i,
    build: (cells, section, dossier) => row(city, board, dossier, { ...cells,
      site: [clean([joined(cells.number), joined(cells.site)].filter(Boolean).join(' '))] }),
  };
  // Each family repeats its header, with different column positions. Read
  // those bands independently rather than letting the last header hide DP.
  return (document?.pages ?? []).flatMap((page) => {
    const headers = page.runs.filter((run) => fold(run.text) === 'REF.').sort((a, b) => b.y - a.y);
    return headers.flatMap((header, index) => readReportTable({ pages: [{ runs: page.runs.filter((run) =>
      run.y <= header.y + 12 && run.y > (headers[index + 1]?.y ?? -Infinity) + 12) }] }, spec));
  });
}

/** Rambouillet's GDS report prints only project fields after the applicant. */
export function readRambouilletFilings(document, { city, file }) {
  return readReportTable(document, {
    // i18n-ignore-start — the GDS report's own headers and footer
    columns: [['dossier', 'REFERENCE DOSSIER'], ['request', 'DEMANDE'], ['filedOn', 'DEPOT'],
      ['decision', 'DECISION'], ['applicant', 'DEMANDEUR'], ['site', 'TERRAIN'], ['parcels', 'PARCELLES'],
      ['purpose', 'NATURE DES TRAVAUX'], ['floor', 'SURF.'], ['land', 'SURF.'], ['housing', 'NB.'], ['level', 'NIV.']],
    extra: ['CREEE(M²)', 'PARC.(M²)', 'LOG.'], noise: /^Edit[ée] le|^Page \d+|^\d+ dossier\(s\)/i,
    // i18n-ignore-end
    rule: 'nearest', place: 'top', head, anchor: (text) => reportDossier(text, city),
    build: (cells, section, dossier) => row(city, 'filings', dossier, { ...cells, postedOn: [file.published] }),
  });
}

/** Vauréal's project cell includes its cadastral references on a second line. */
export function readVaurealTable(document, { city, file }) {
  const board = file.board;
  // i18n-ignore-start — the publisher's column headers
  const columns = board === 'filings' ? [['filedOn', 'DATE DE DEPOT'], ['dossier', 'NUMERO DE DOSSIER'],
    ['applicant', 'PETITIONNAIRE'], ['site', 'ADRESSE DU PROJET'], ['purpose', 'DESCRIPTION DU PROJET']]
    : [['dossier', 'NUMERO DE'], ['applicant', 'PETITIONNAIRE'], ['verdict', 'DECISION'],
      ['decidedOn', 'DATE DE'], ['purpose', 'NATURE DES TRAVAUX'], ['site', 'ADRESSE DES TRAVAUX']];
  // i18n-ignore-end
  return readReportTable(document, {
    columns, extra: ['DOSSIER', 'DECISION'], rule: 'right', place: 'top', head,
    anchor: (text) => reportDossier(text, city),
    build: (cells, section, dossier) => {
      const parcelLines = (cells.site ?? []).filter((line) => /^(?:[A-Z]{1,2}\s*\d{1,4}[\s,;/]*)+$/i.test(clean(line)));
      return row(city, board, dossier, { ...cells, parcels: parcelLines, postedOn: [file.published],
        site: (cells.site ?? []).filter((line) => !parcelLines.includes(line)) });
    },
  });
}

/** A scan's explicit project address, including Le Mée's split table label. */
export function readOuterParisNotice(document, context) {
  // An upload directory names a month, never the actual posting day.
  const noticeContext = { ...context, file: { ...context.file, title: context.file.dossier,
    published: context.file.monthOnly ? null : context.file.published } };
  const dematdoc = readDematdocNotice(document, noticeContext);
  const extended = readExtendedNotice(document, noticeContext);
  let rows = dematdoc.length ? dematdoc.map((item) => {
    const other = extended.find((candidate) => candidate.dossier === item.dossier);
    return { ...other, ...item, filedOn: item.filedOn ?? other?.filedOn ?? null,
      decidedOn: item.decidedOn ?? other?.decidedOn ?? null };
  }) : extended;
  if (!rows.length && context.city.key === 'le-mee-sur-seine') {
    // The label spans two lines, beside the address: "Adresse du" / "terrain".
    const runs = document?.pages?.[0]?.runs ?? [];
    const addressLabel = runs.find((run) => fold(run.text) === 'ADRESSE');
    const terrainLabel = runs.find((run) => fold(run.text) === 'TERRAIN');
    if (!addressLabel || !terrainLabel || Math.abs(addressLabel.x - terrainLabel.x) > 20) return [];
    const addressRuns = runs.filter((run) => Math.abs(run.y - addressLabel.y) < 3 && run.x > addressLabel.x + 90)
      .sort((a, b) => a.x - b.x);
    const site = municipalSite(addressRuns.map((run) => run.text).join(' '), context.city);
    const text = [...runs].sort((a, b) => b.y - a.y || a.x - b.x).map((run) => run.text).join(' ');
    const dossier = municipalDossier(text, context.city);
    if (!dossier || !site.address || !/^\d+\s+\p{L}/u.test(site.address)) return [];
    // i18n-ignore-next-line — the filing notice's labelled date
    const filedOn = municipalDate(/Date de d[ée]p[ôo]t\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(text)?.[1]);
    rows = [{ board: context.file.board, dossier, applicant: null, ...site, filedOn }];
  }
  const lines = noticeLines(document);
  const body = lines.join('\n');
  // i18n-ignore-start — explicit labels and operative wording printed by the municipalities
  const filedOn = noticeDate(/(?:Date (?:de|du) d[ée]p[ôo]t\s*:?|(?:Demande |Dossier )?d[ée]pos[ée]e? le)\s*([^\n]+)/i.exec(body)?.[1]);
  const postedOn = noticeDate(/Document publi[ée] le\s+([^\n]+)/i.exec(body)?.[1]);
  const opening = /(?:^|\n)\s*ARTICLE\s+(?:1(?:er)?|UNIQUE)\b\s*[:.\-–]?/i.exec(body);
  const article = opening ? body.slice(opening.index + opening[0].length, opening.index + opening[0].length + 600)
    .split(/\n\s*ARTICLE\s+\d/i)[0] : null;
  // The operative article makes an order a decision. A recital citing an
  // earlier avis de dépôt cannot turn it into a filing, as Igny's does.
  const board = opening ? 'decisions' : /AVIS.*DEPOT|RECEPISSE/.test(fold(lines.slice(0, 8).join(' '))) ? 'filings' : context.file.board;
  const verdict = /n['’]appelle pas d['’]opposition/i.test(article ?? '') ? messages.definition.unopposed.fr : municipalVerdict(article);
  const articleAt = lines.findIndex((line) => /^ARTICLE\s+(?:1(?:er)?|UNIQUE)\b/i.test(line));
  const signature = articleAt < 0 ? null : lines.slice(articleAt + 1).reverse().map((line) =>
    noticeDate(/^(?:Fait[^\n]{0,70}|[\p{L}'’ -]{2,60},)\s*le\s+(\d.+)$|^Le\s+(\d.+)$/iu.exec(line)?.slice(1).find(Boolean))).find(Boolean);
  // i18n-ignore-end
  // Digilor's display titles abbreviate Villepreux's E0118 as E118. Compare
  // numeric identity, but retain the number printed in the actual document.
  const baseDossier = (dossier) => dossier?.split(' ').slice(0, 4)
    .map((part, i) => i === 3 ? part.replace(/^([A-Z]?)0+(?=\d)/, '$1') : part).join(' ');
  const amendment = (dossier) => / [MT]\d+$/.exec(dossier ?? '')?.[0] ?? '';
  const dated = (value) => value && (!context.file.asOf || value <= context.file.asOf) ? value : null;
  return rows.filter((item) => !context.file.dossier || (baseDossier(item.dossier) === baseDossier(context.file.dossier)
    && (!amendment(item.dossier) || !amendment(context.file.dossier) || amendment(item.dossier) === amendment(context.file.dossier))))
    .map((item) => ({
    ...item, board, dossier: item.dossier + (!amendment(item.dossier) ? amendment(context.file.dossier) : ''), applicant: null,
    filedOn: dated(item.filedOn ?? filedOn),
    postedOn: dated(postedOn ?? item.postedOn ?? (context.file.monthOnly ? null : context.file.published)),
    verdict: board === 'decisions' ? verdict ?? item.verdict ?? signed : null,
    decidedOn: board === 'decisions'
      ? dated(item.decidedOn ?? (signature && (!(item.filedOn ?? filedOn) || signature >= (item.filedOn ?? filedOn)) ? signature : null)) : null }));
}

/** One week per WordPress document, discovered through the public REST API. */
const pontaultProtocol = {
  start: (city, { since }) => [{ url: `${new URL(city.page).origin}/wp-json/wp/v2/docs?${new URLSearchParams({
    search: 'A.U', after: `${since}T00:00:00`, per_page: '100', page: '1', _fields: 'date,title,content',
  })}`, as: 'json' }],
  index(city, documents, request, { since, day }) {
    if (!Array.isArray(documents)) return null;
    const files = [];
    for (const doc of documents) {
      const title = clean(doc?.title?.rendered);
      // i18n-ignore-next-line — the municipality's list titles
      const board = /A\.U\s+D[EÉ]POS[EÉ]ES/i.test(title) ? 'filings' : /A\.U\s+ACCORDEES/i.test(title) ? 'decisions' : null;
      if (!board) continue;
      const published = municipalDate(doc.date?.slice(0, 10));
      if (!published || published < since || published > day) continue;
      const pdf = links(doc.content?.rendered, city.page).find((link) => /\.pdf$/i.test(new URL(link.url).pathname));
      if (!pdf) return null;
      files.push({ url: pdf.url, board, layout: `outer-pontault-${board}`, published, asOf: day });
    }
    const next = [];
    if (documents.length === 100) {
      const url = new URL(request.url); url.searchParams.set('page', String(Number(url.searchParams.get('page')) + 1));
      next.push({ url: url.href, as: 'json' });
    }
    return { files, next };
  },
};

const vaurealProtocol = {
  start: (city) => ['filings', 'decisions'].map((board) => ({ url: new URL(city.source[board], city.page).href, as: 'html', board })),
  index(city, html, request, { day }) {
    if (!/AFFICHAGE DES DOSSIERS/i.test(html)) return null;
    const files = links(html, request.url).filter((link) => /\.pdf$/i.test(new URL(link.url).pathname)
      && /(?:depot|decision)/i.test(link.url)).map((link) => ({ url: link.url, board: request.board,
      layout: `outer-vaureal-${request.board}`, published: municipalDate(decodedPath(link.url).replace(/[-_]/g, '/')), asOf: day }))
      .filter((file) => !file.published || file.published <= day);
    return files.length ? { files } : null;
  },
};

const digilorProtocol = {
  start: (city) => [{ url: 'https://datahall.mydigilor.fr/web/server/index.php', as: 'json', method: 'POST',
    body: JSON.stringify({ controller: 'DocumentController', action: 'getAll', data: { idApp: city.source.app } }) }],
  index(city, documents, request, { since, day }) {
    if (!Array.isArray(documents)) return null;
    const files = [];
    for (const doc of documents) {
      if (Number(doc.id_cat) !== city.source.category) continue;
      const published = municipalDate(doc.aff_deb);
      const path = String(doc.url_uiid ?? '').replace(/^(?:\.\.\/bo\/|bo\/|\.\/)/, '');
      if (!published || published < since || published > day || !new RegExp(`^upload/${city.source.app}/[\\w.-]+\\.pdf$`, 'i').test(path)) continue;
      let board, layout, dossier;
      if (city.key === 'rambouillet') {
        board = Number(doc.id_sscat) === 5299 ? 'filings' : Number(doc.id_sscat) === 5301 ? 'decisions' : null;
        layout = board === 'filings' ? 'outer-rambouillet-filings' : 'outer-notice';
      } else {
        const title = clean(doc.nom_affichage);
        dossier = municipalDossier(title, city);
        if (!dossier) continue;
        // i18n-ignore-next-line — a notice explicitly says it is a filing
        board = /avis.*d[ée]p[ôo]t|r[ée]c[ée]piss[ée]/i.test(title) ? 'filings' : 'decisions';
        layout = 'outer-notice';
      }
      if (!board) continue;
      files.push({ url: `https://datahall.mydigilor.fr/web/server/get_file.php?file=${encodeURIComponent(path)}`,
        board, layout, published, dossier, asOf: day, ocr: layout === 'outer-notice', ocrPages: 4 });
    }
    return { files };
  },
};

/** Explicit permit links only; a generic administrative act is never a permit. */
const noticeProtocol = {
  start: (city) => (city.source.pages ?? [city.page]).map((url) => ({ url, as: 'html' })),
  index(city, html, request, { day }) {
    if (!/<html\b|<a\b/i.test(html)) return null;
    const files = [];
    for (const link of links(html, request.url)) {
      const url = new URL(link.url);
      if (!/\.pdf$/i.test(url.pathname) || url.hostname !== new URL(city.page).hostname) continue;
      const name = decodedPath(link.url);
      const words = `${link.title} ${name}`;
      const dossier = municipalDossier(link.title, city) ?? municipalDossier(name.replace(/[-_]/g, ' '), city);
      if (!dossier) continue;
      // i18n-ignore-next-line — a filing is explicitly named, every other link is an order
      const board = /avis.*d[ée]p[oô]t|r[ée]c[ée]piss[ée]/i.test(words) ? 'filings' : 'decisions';
      const month = /\/(20\d{2})\/(\d{2})\//.exec(url.pathname);
      const published = month ? `${month[1]}-${month[2]}-01` : null;
      if (published && published > day) continue;
      files.push({ url: url.href, board, layout: 'outer-notice', dossier, asOf: day, ocr: true, ocrPages: 4,
        published, monthOnly: true });
    }
    return files.length ? { files } : null;
  },
};

export const OUTER_PARIS_PROTOCOLS = Object.freeze({
  'outer-pontault': Object.freeze(pontaultProtocol),
  'outer-vaureal': Object.freeze(vaurealProtocol),
  'outer-digilor': Object.freeze(digilorProtocol),
  'outer-notices': Object.freeze(noticeProtocol),
});
export const OUTER_PARIS_READERS = Object.freeze({
  'outer-pontault-filings': readPontaultTable, 'outer-pontault-decisions': readPontaultTable,
  'outer-rambouillet-filings': readRambouilletFilings,
  'outer-vaureal-filings': readVaurealTable, 'outer-vaureal-decisions': readVaurealTable,
  'outer-notice': readOuterParisNotice,
});
