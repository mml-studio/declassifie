/** Municipal PDF registers discovered on 3 October 2026. */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import { readReportTable } from './permitBoardsReports.js';
import { listParcelCell, listVerdict } from './permitBoardsLists.js';
import { dematdocParcels } from './dematdocFeed.js';
import messages from './municipalPermitsFeed.i18n.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const decode = (value) => String(value ?? '').replace(/&(#\d+|amp|quot|apos|nbsp|rsquo|eacute|ecirc|ocirc|ucirc|agrave);/gi, (all, key) =>
  key[0] === '#' ? String.fromCodePoint(Number(key.slice(1))) :
    ({ amp: '&', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', eacute: 'é', ecirc: 'ê', ocirc: 'ô', ucirc: 'û', agrave: 'à' })[key.toLowerCase()] ?? all); // i18n-ignore-line — HTML entities
const joined = (lines) => clean((lines ?? []).join(' '));
const dated = (value, file) => {
  const date = municipalDate(value);
  return date && (!file.asOf || date <= file.asOf) ? date : null;
};
function lines(runs) {
  const out = [];
  for (const run of [...runs].sort((a, b) => b.y - a.y || a.x - b.x)) {
    let line = out.at(-1);
    if (!line || Math.abs(line.y - run.y) > 2) out.push(line = { y: run.y, runs: [] });
    line.runs.push(run);
  }
  return out.map((line) => ({ y: line.y, text: clean(line.runs.sort((a, b) => a.x - b.x).map((run) => run.text).join(' ')) }));
}
function registerRow(city, file, dossier, cells) {
  const site = municipalSite(joined(cells.site), city);
  if (!dossier) return null;
  const localParcels = [...joined(cells.parcels).matchAll(/\b(\d{3})(\d{3})([0A-Z]{2})(\d{4})\b/g)]
    .filter((match) => match[1] === city.insee.slice(-3)).map((match) =>
      `${match[2] === '000' ? '' : `${match[2]} `}${match[3].replace(/^0/, '')} ${Number(match[4])}`);
  const parcels = localParcels.length ? [...new Set(localParcels)].join(', ')
    : dematdocParcels(joined(cells.parcels), city) ?? listParcelCell(joined(cells.parcels)) ?? site.parcels;
  if (!site.address && !parcels) return null;
  const decision = joined(cells.verdict).replace(/^[^\p{L}]+/u, '');
  // i18n-ignore-next-line — DDC's grant labels may include prescriptions
  const verdict = municipalVerdict(listVerdict(decision)) ?? (/^(?:OCTROI|REALISABLE)\b/.test(fold(decision))
    ? messages.definition.granted.fr : messages.definition.signed.fr);
  return { board: file.board, dossier, applicant: null, ...site, parcels,
    purpose: joined(cells.purpose) || null, filedOn: dated(joined(cells.filedOn), file),
    postedOn: dated(joined(cells.postedOn), file) ?? file.published ?? null,
    ...(file.board === 'decisions' ? { verdict,
      decidedOn: dated(joined(cells.decidedOn ?? cells.verdict), file) } : {}) };
}

// i18n-ignore-start — published headers, field labels and link captions
/** Aiffres's DDC registers repeat their three/four-column header per family. */
export function readAiffresRegister(document, { city, file }) {
  const rows = [];
  for (const page of document?.pages ?? []) {
    const runs = page.runs ?? [];
    const headers = runs.filter((run) => fold(run.text) === 'DOSSIER').sort((a, b) => b.y - a.y);
    for (const [i, header] of headers.entries()) {
      const band = runs.filter((run) => run.y <= header.y + 2 && run.y > (headers[i + 1]?.y ?? 20) + 2);
      const column = (name) => band.find((run) => fold(run.text) === name && Math.abs(run.y - header.y) < 2)?.x;
      const terrain = column('TERRAIN'), description = column('DESCRIPTION'), decision = column('DECISION');
      if (!Number.isFinite(terrain) || !Number.isFinite(description) || (file.board === 'decisions' && !Number.isFinite(decision))) continue;
      const anchors = band.filter((run) => run.x < terrain - 5 && /^(?:PC|DP|PA|PD|CU)\s*\d/.test(clean(run.text))).sort((a, b) => b.y - a.y);
      anchors.forEach((anchor, n) => {
        const dossier = municipalDossier(anchor.text, city);
        const body = band.filter((run) => run.y <= anchor.y + 7 && run.y > (anchors[n + 1]?.y ?? headers[i + 1]?.y ?? 20) + 7);
        const siteLines = lines(body.filter((run) => run.x >= terrain - 2 && run.x < description - 5)).map((line) => line.text);
        // The owner in the Terrain cell is never part of the project site.
        const site = siteLines.find((line) => /^sis\s+/i.test(line))?.replace(/^sis\s+/i, '');
        const row = registerRow(city, file, dossier, { site: [site],
          parcels: [siteLines.find((line) => /^Terrain\s*:/i.test(line))?.replace(/^Terrain\s*:/i, '')],
          filedOn: lines(body.filter((run) => run.x < terrain - 5)).map((line) => line.text).filter((line) => /^D.p.t le/i.test(line)),
          purpose: lines(body.filter((run) => run.x >= description - 2 && run.x < (decision ?? Infinity) - 5))
            .map((line) => line.text.replace(/^Projet\s*:\s*/i, '')),
          verdict: lines(body.filter((run) => run.x >= (decision ?? Infinity) - 2)).map((line) => line.text)
            .filter((line) => !/^(?:SIGNEE?|NOTIFIEE?) LE/.test(fold(line))).map((line) => line.replace(/^Nature de la d.cision\s*:\s*/i, '')
              .replace(/^N.gatif$/i, messages.definition.refused.fr).replace(/^Positif$/i, messages.definition.granted.fr)),
          decidedOn: lines(body.filter((run) => run.x >= (decision ?? Infinity) - 2)).map((line) => line.text)
            .filter((line) => /^SIGNEE? LE/.test(fold(line))) });
        if (row) rows.push(row);
      });
    }
  }
  return rows;
}

/** Saint-Raphaël's Word tables: every project cell hangs from its row's top. */
export function readRaphaelRegister(document, { city, file }) {
  const columns = file.board === 'filings' ? [
    ['filedOn', 'DATE'], ['dossier', 'NUMERO'], ['applicant', 'PETITIONNAIRE'],
    ['site', 'ADRESSE DU PROJET'], ['purpose', 'DESCRIPTION DU PROJET'], ['parcels', 'PARCELLE'], ['postedOn', 'DATE'],
  ] : [['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'NOM DU DEMANDEUR'], ['site', 'ADRESSE DU PROJET'],
    ['purpose', 'NATURE DES TRAVAUX'], ['parcels', 'PARCELLE'], ['verdict', 'AVIS ET DATE DE'], ['postedOn', 'DATE PREMIER']];
  return readReportTable(document, { columns, extra: ['DE', 'DEPOT', 'DOSSIER', 'AFFICHAGE', 'DECISION'],
    noise: /^Page \d+ sur \d+$/i, rule: 'nearest', place: 'top', head: /^(?:PC|DP|PA|PD|CU)\s*\d/,
    anchor: (text) => municipalDossier(text, city), build: (cells, section, dossier) => registerRow(city, file, dossier, cells) });
}

/** Scionzier's spreadsheet cells are centered; measured column edges avoid names. */
export function readScionzierRegister(document, { city, file }) {
  const filings = file.board === 'filings';
  const runs = document?.pages?.[0]?.runs ?? [];
  const compact = (words) => fold(words).replace(/[^A-Z]/g, '');
  const headers = compact(joined(lines(runs.filter((run) => run.y > 500)).map((line) => line.text)));
  if (!['NUMERO', 'DEMANDEUR', 'ADRESSE', 'PARCELLES'].every((label) => headers.includes(label))) return [];
  const title = compact(joined(lines(runs.filter((run) => run.y > 550)).map((line) => line.text)));
  if (!title.includes(filings ? 'LISTEDESAVISDEDEPOT' : 'AUTORISATIONSDURBANISMEACCORDEES')) return [];
  const field = (run) => {
    const edges = filings ? [[102, 'dossier'], [147, 'postedOn'], [215, 'applicant'], [268, 'site'], [331, 'parcels'],
      [405, 'purpose'], [792, 'ignored'], [Infinity, 'filedOn']]
      : [[64, 'filedOn'], [169, 'dossier'], [219, 'decidedOn'], [282, 'applicant'], [349, 'site'], [421, 'parcels'],
        [471, 'postedOn'], [764, 'ignored'], [Infinity, 'purpose']];
    return edges.find(([right]) => run.x < right)[1];
  };
  const header = runs.find((run) => fold(run.text) === 'NUMERO' && run.y > 500);
  if (!header) return [];
  return readReportTable({ pages: document.pages.map((page, i) => ({ runs: i ? page.runs : [header, ...runs.filter((run) => run.y < 500)] })) }, {
    columns: [['dossier', 'NUMERO']], field, rule: 'nearest', place: 'centre', gap: 1.6,
    extra: ['TERRAIN', 'DOSSIER', 'TRAVAUX', 'DECISION', 'ARRETE'], noise: /^\d+\s*\/\s*\d+$/,
    head: /^(?:PC|DP|PA|PD|CU)\s*\d/, anchor: (text) => municipalDossier(text, city),
    build: (cells, section, dossier) => registerRow(city, file, dossier, { ...cells,
      // This board explicitly lists authorizations granted, not all signed acts.
      verdict: filings ? [] : [messages.definition.granted.fr] }) });
}

/** Bry's rotated Cart@DS print: unread numbers remain row boundaries, not guesses. */
export function readBryRegister(document, { city, file }) {
  const rows = [];
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).map((run) => ({ ...run, text: clean(run.text.replace(/[|¦]/g, ' ')) }));
    const title = joined(runs.filter((run) => run.y > 550).sort((a, b) => a.x - b.x).map((run) => run.text));
    const board = /Liste des avis de d.p.t/i.test(title) ? 'filings' : /Liste des d.cisions/i.test(title) ? 'decisions' : null;
    const family = joined(runs.filter((run) => run.y > 520 && run.y < 540).sort((a, b) => a.x - b.x).map((run) => run.text));
    if (!board || !/Permis|D.claration pr.alable/i.test(family) || /ERP|IGH/.test(family)) continue;
    const edges = board === 'filings' ? [[130, 'dossier'], [190, 'filedOn'], [315, 'applicant'], [410, 'site'],
      [470, 'ignored'], [695, 'purpose'], [Infinity, 'ignored']]
      : [[130, 'dossier'], [186, 'filedOn'], [279, 'applicant'], [367, 'site'], [415, 'ignored'],
        [588, 'purpose'], [742, 'ignored'], [Infinity, 'verdict']];
    const field = (run) => edges.find(([right]) => run.x < right)[1];
    const body = runs.filter((run) => run.y < 480 && run.y > 30);
    const anchors = lines(body.filter((run) => field(run) === 'dossier')).filter((line) => /^(?:PC|DP|PA|PD|CU)\s|^\S+\s+094\s*015\s*\d{2}/i.test(line.text));
    anchors.forEach((anchor, i) => {
      const bottom = anchors[i + 1]?.y ?? 30;
      const cells = {};
      for (const run of body.filter((run) => run.y <= anchor.y + 10 && run.y > bottom + 10)) (cells[field(run)] ??= []).push(run);
      const text = Object.fromEntries(Object.entries(cells).map(([key, value]) => [key, lines(value).map((line) => line.text)]));
      const number = fold(joined(text.dossier?.filter((line) => !municipalDate(line))));
      // Require the full local code and counter in the scan, never its short fallback.
      if (!/\b(?:PC|DP|PA|PD|CU)\s*094\s*015\s*\d{2}\s*\d{5}(?:\s*[MT]\s*\d{1,2})?(?!\d)/.test(number)) return;
      const site = joined(text.site).split(/\b94360\b|\(/)[0];
      if (!/\b(?:rue|avenue|av\.?|boulevard|bd|chemin|route|impasse|all.ee|place|quai|square)\b/i.test(site)) return;
      const row = registerRow(city, { ...file, board }, municipalDossier(number, city), { ...text, site: [site],
        postedOn: text.dossier?.filter((line) => municipalDate(line)) });
      if (row) rows.push(row);
    });
  }
  return rows;
}

function links(html, base) {
  return [...String(html ?? '').matchAll(/<a\b([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    try {
      const requestUrl = new URL(decode(match[2]), base);
      const href = /runtime_url=["']([^"']+)["']/.exec(match[1])?.[1] ?? match[2];
      const url = new URL(decode(href), base);
      if (requestUrl.origin !== url.origin || requestUrl.pathname !== url.pathname) return [];
      return url.protocol === 'https:' && /\.pdf$/i.test(url.pathname)
        ? [{ url: url.href, ...(requestUrl.href !== url.href ? { requestUrl: requestUrl.href } : {}),
          title: clean(decode(match[3].replace(/<[^>]*>/g, ' '))) }] : [];
    } catch { return []; }
  });
}
function protocol(key, select) {
  return Object.freeze({ start: (city) => [{ url: city.page, as: 'html' }],
    index(city, html, request, options) {
      const files = links(html, request.url).flatMap((link) => {
        const selected = select(link, city, options);
        return selected ? [{ url: link.url, ...(link.requestUrl ? { requestUrl: link.requestUrl } : {}),
          layout: `${key}-register`, asOf: options.day, ...selected }] : [];
      });
      return files.length ? { files } : null;
    } });
}
export const MUNICIPAL_REGISTER_PROTOCOLS = Object.freeze({
  aiffres: protocol('aiffres', (link, city, { since, day }) => {
    if (new URL(link.url).origin !== 'https://cdn.website-editor.net'
      || !new URL(link.url).pathname.startsWith('/s/2a96eec688514d96ac7ad6bc097f71c1/files/uploaded/')) return null;
    const board = /Liste des demandes.*urbanisme/i.test(link.title) ? 'filings' : /Liste des arr.t.s.*urbanisme/i.test(link.title) ? 'decisions' : null;
    const published = municipalDate(link.title);
    return board && published && published >= since && published <= day ? { board, published } : null;
  }),
  scionzier: protocol('scionzier', (link, city, { day }) => {
    if (new URL(link.url).origin !== new URL(city.page).origin) return null;
    const board = /Liste des avis de d.p.t/i.test(link.title) ? 'filings' : /Autorisations.*urbanisme accord.es/i.test(link.title) ? 'decisions' : null;
    const published = municipalDate(link.title);
    return board && published && published <= day ? { board, published,
      layout: `scionzier-${board}` } : null;
  }),
  'saint-raphael': protocol('saint-raphael', (link, city) => {
    if (new URL(link.url).origin !== new URL(city.page).origin
      || !new URL(link.url).pathname.startsWith('/fileadmin/ARBORESCENCE/UTILE/Urbanisme/Depots_et_decisions/')) return null;
    const board = /D.p.t de demande de/i.test(link.title) ? 'filings' : /accord.s|accord.es/i.test(link.title) ? 'decisions' : null;
    return board ? { board, rolling: true } : null;
  }),
  'bry-sur-marne': protocol('bry', (link, city, { since, day }) => {
    if (new URL(link.url).origin !== new URL(city.page).origin) return null;
    const date = /Affichage[^/]*?(\d{2})[.\-_](\d{2})[.\-_](\d{4})\.pdf$/i.exec(decodeURIComponent(new URL(link.url).pathname));
    const published = date ? municipalDate(`${date[1]}/${date[2]}/${date[3]}`) : null;
    return published && published >= since && published <= day
      ? { board: 'filings', published, scan: true, ocr: true, ocrRotate: 90 } : null;
  }),
});
// i18n-ignore-end

export const MUNICIPAL_REGISTER_READERS = Object.freeze({ 'aiffres-register': readAiffresRegister,
  'scionzier-filings': readScionzierRegister, 'scionzier-decisions': readScionzierRegister,
  'saint-raphael-register': readRaphaelRegister, 'bry-register': readBryRegister });

// The exporter paints neighbouring cells without any gap. Preserve their
// measured edges while extracting glyphs, before an applicant can join a site.
export const MUNICIPAL_REGISTER_TEXT = Object.freeze({
  'scionzier-filings': { columnEdges: [102, 147, 215, 268, 331, 405, 480, 672, 710, 792] },
  'scionzier-decisions': { columnEdges: [64, 169, 219, 282, 349, 421, 471, 523, 568, 613, 650, 696, 764] },
});
