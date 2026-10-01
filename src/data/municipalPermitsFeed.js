/**
 * Six municipal publication formats, folded into the permit-list archive.
 * Discovery and reading are pure; requests and OCR belong to the server.
 * Applicant cells and the address below an applicant's name are never read.
 */
import messages from './municipalPermitsFeed.i18n.js';
const verdicts = messages.definition;
// i18n-ignore-start — publishers' names and words in their published documents
export const MUNICIPAL_PERMIT_SOURCES = Object.freeze([
  { key: 'saint-priest', insee: '69290', postcode: '69800', label: 'Ville de Saint-Priest — autorisations d’urbanisme',
    page: 'https://saint-priest.dematdoc.eu/public/19', robots: 'overridden',
    source: { kind: 'municipal', protocol: 'dematdoc', api: '/api/public/get-documents/19' }, lists: [] },
  { key: 'wattrelos', insee: '59650', postcode: '59150', label: 'Ville de Wattrelos — autorisations d’urbanisme',
    page: 'https://www.ville-wattrelos.fr/kiosque?field_categories_document_target_id=2203&name=', crawlDelayMs: 10_000,
    source: { kind: 'municipal', protocol: 'drupal', maxPages: 25 }, lists: [] },
  { key: 'lambersart', insee: '59328', postcode: '59130', label: 'Ville de Lambersart — autorisations d’urbanisme',
    page: 'https://lambersart.fr/affichage-legal',
    robots: 'overridden', crawlDelayMs: 10_000,
    source: { kind: 'municipal', protocol: 'drupal', maxPages: 40 }, lists: [] },
  { key: 'acheres', insee: '78005', postcode: '78260', label: 'Ville d’Achères — autorisations d’urbanisme',
    page: 'https://mairie-acheres78.fr/accueil/urbanisme/',
    source: { kind: 'municipal', protocol: 'links' }, lists: [] },
  { key: 'balma', insee: '31044', postcode: '31130', label: 'Ville de Balma — autorisations d’urbanisme',
    page: 'https://www.mairie-balma.fr/systeme/documentheque/?category=163',
    source: { kind: 'municipal', protocol: 'links' }, lists: [] },
  { key: 'anzin', insee: '59014', postcode: '59410', label: 'Ville d’Anzin — autorisations d’urbanisme',
    page: 'https://www.anzin.fr/ma-mairie/arretes/affichage-urbanisme.html', robots: 'overridden',
    source: { kind: 'municipal', protocol: 'links' }, lists: [] },
].map((city) => Object.freeze({ ...city, source: Object.freeze(city.source), lists: Object.freeze(city.lists) })));
// Saint-Priest disallows its public portal, Lambersart its files, and Anzin
// /documents/. Read by the user's integration request of 2026-10-01, as the
// existing Lyon and Lille sources are: these are public legal postings.

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const entities = { amp: '&', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', ocirc: 'ô', ecirc: 'ê', agrave: 'à', rsquo: '’', ndash: '–', mdash: '—' };
function decode(value) {
  return String(value ?? '').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, name) => {
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(name[1].toLowerCase() === 'x' ? 2 : 1), name[1].toLowerCase() === 'x' ? 16 : 10));
    return entities[name.toLowerCase()] ?? whole;
  });
}
const plain = (html) => clean(decode(String(html ?? '').replace(/<[^>]*>/g, ' ')));
const MONTHS = ['jan', 'fev', 'mar', 'avr', 'mai', 'juin', 'juil', 'aou', 'sep', 'oct', 'nov', 'dec'];

/** A publication's calendar date, including French printed month names. */
export function municipalDate(value) {
  const numeric = /\b\d{2}\/\d{2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/.exec(value ?? '')?.[0];
  const valid = (iso) => {
    const date = new Date(`${iso}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
  };
  if (numeric) return valid(numeric.includes('/') ? numeric.split('/').reverse().join('-') : numeric);
  const match = /\b(\d{1,2})(?:er)?\s+([a-zéûô.]+)\s+(20\d{2})/i.exec(value ?? '');
  const month = match ? MONTHS.findIndex((name) => fold(match[2]).toLowerCase().startsWith(name)) : -1;
  return month < 0 ? null : valid(`${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`);
}

/** Full or municipal abbreviated dossier, retaining modifications and transfers. */
export function municipalDossier(value, city) {
  const words = fold(value);
  const code = `0?\\s*${city.insee.slice(0, 2)}\\s*${city.insee.slice(2)}`;
  const full = new RegExp(`\\b(PC|DP|PA|PD|CU)\\s*${code}\\s*(\\d{2})\\s*([A-Z]?\\d{4,5})(?:\\s*([MT]\\s*\\d{1,2}))?(?![\\dA-Z])`).exec(words);
  let match = full;
  if (!match) {
    // A full number of a different commune must never become a short number.
    if (/\b(?:PC|DP|PA|PD|CU)\s*\d{5,6}\b/.test(words)) return null;
    const short = /\b(PC|DP|PA|PD|CU)\s*(\d{2})(?:[\s-]+|(?=[A-Z]))([A-Z]?\d{1,5})(?:\s*([MT])\s*(\d{1,2}))?(?![\dA-Z])/i.exec(words);
    if (!short) return null;
    match = [short[0], short[1], short[2], short[3], short[4] ? `${short[4]}${short[5]}` : ''];
  }
  const counter = /^\d+$/.test(match[3]) ? match[3].padStart(5, '0') : match[3];
  return `${match[1]} ${city.insee.padStart(6, '0')} ${match[2]} ${counter}${match[4] ? ` ${match[4].replace(/\s/g, '')}` : ''}`;
}

/** A site's address and cadastral references, excluding its postcode suffix. */
export function municipalSite(value, city) {
  let address = clean(value);
  const parcels = [];
  address = address.replace(/\(([^)]+)\)/g, (whole, content) => {
    const found = [...content.matchAll(/\b([A-Z]{1,2})\s*(\d{1,4})\b/g)].map((m) => `${m[1]} ${m[2]}`);
    if (!found.length) return whole;
    parcels.push(...found); return '';
  });
  const postcode = /\b\d{5}\b/.exec(address)?.[0] ?? city.postcode;
  address = address.replace(/[,\s]+\d{5}\b.*$/, '').replace(/^[\s:;,]+|[\s:;,]+$/g, '');
  return { address: clean(address) || null, postcode, parcels: parcels.length ? parcels.join(', ') : null };
}

function baseRow(city, board, dossier, address = null) {
  return { board, dossier, applicant: null, ...municipalSite(address, city) };
}

/** Only the verdict in the heading or operative article, never the recitals. */
export function municipalVerdict(value) {
  const words = fold(value);
  if (/RETRAIT|RETIRE|ANNULE/.test(words)) return verdicts.withdrawn.fr;
  if (/NON[- ]?OPPOSITION|PAS FAIT OPPOSITION/.test(words)) return verdicts.unopposed.fr;
  if (/REFUS|DEFAVORABLE|FAIT OPPOSITION|^OPPOSITION\b/.test(words)) return verdicts.refused.fr;
  if (/ACCORD|FAVORABLE|AUTORISE|PEUVENT ETRE EXECUTES/.test(words)) return /TACITE/.test(words) ? verdicts.tacit.fr : verdicts.granted.fr;
  return null;
}

/** Title-derived fields when a scan awaits the daily OCR. No inferred grant. */
export function municipalTitleRow(city, file) {
  const dossier = municipalDossier(file.title, city);
  if (!dossier) return null;
  const bits = file.title.split(/\s*[–—]\s*|\s+-\s*/);
  let address = file.address;
  let purpose = null;
  if (!address && city.key === 'acheres') address = bits[file.board === 'decisions' ? 2 : 1];
  if (!address && city.key === 'anzin') address = file.title.split(/\b(?:AVIS|DECISION|D[ÉE]CISION|ARR[ÊE]T[ÉE])\b/i)[0];
  if (!address && city.key === 'wattrelos') {
    const rest = file.title.replace(/^.*?\b(?:PC|DP|PA|PD)\s*\d{2}[\s-]+\d+\s*/i, '');
    const street = /\b(?:\d+\s*(?:bis|ter)?\s+)?(?:rue|avenue|all[ée]e|boulevard|chemin|place|impasse|square|route)\b/i.exec(rest);
    if (street) { address = rest.slice(street.index); purpose = clean(rest.slice(0, street.index)); }
  }
  if (!address) return null;
  return { ...baseRow(city, file.board, dossier, address), purpose, postedOn: file.published ?? null,
    verdict: file.board === 'decisions' ? municipalVerdict(bits.at(-1)) ?? verdicts.signed.fr : null };
}

function safeFile(city, href, title, extra = {}) {
  let url;
  try { url = new URL(decode(href), city.page); } catch { return null; }
  if (url.origin !== new URL(city.page).origin || !/\.pdf$/i.test(url.pathname)) return null;
  return { url: url.href, title: clean(title), ...extra };
}

/** Legal-board files on a single HTML page; unrelated acts are discarded. */
export function municipalFiles(city, html) {
  const files = [];
  if (city.key === 'lambersart') {
    for (const block of String(html).split(/<div\s+class="views-row\b/).slice(1)) {
      const href = /data-document-pdf-reader="([^"]+)"/.exec(block)?.[1];
      const heading = plain(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(block)?.[1]);
      const detail = plain(/class="card-text">\s*<p>([\s\S]*?)<\/p>/.exec(block)?.[1]);
      const board = /avis.*d[ée]p[ôo]t/i.test(detail) ? 'filings' : 'decisions';
      const file = safeFile(city, href, `${detail} ${heading}`, { address: heading, board,
        published: municipalDate(plain(/class="published-date">([\s\S]*?)<\/p>/.exec(block)?.[1])) });
      if (file && (board === 'filings' || municipalDossier(detail, city))) files.push(file);
    }
  } else if (city.key === 'wattrelos') {
    for (const match of String(html).matchAll(/<li\b[^>]*class="[^"]*kiosque__item[^"]*"[^>]*>([\s\S]*?)<\/li>/g)) {
      const block = match[1];
      const title = plain(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(block)?.[1]);
      const href = /href="([^"]+\.pdf)"/.exec(block)?.[1];
      const filing = /(?:avis|affichage).*d[ée]p[ôo]t|affichage des demandes/i.test(title);
      const file = safeFile(city, href, title, { board: filing ? 'filings' : 'decisions',
        layout: filing ? 'wattrelos-table' : 'municipal-notice',
        published: municipalDate(plain(/class="kiosque__infos">([\s\S]*?)<br/.exec(block)?.[1])) });
      if (file && (filing || municipalDossier(title, city))) files.push(file);
    }
  } else {
    for (const match of String(html).matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const title = plain(match[2]);
      const file = safeFile(city, match[1], title);
      if (!file) continue;
      if (city.key === 'balma') {
        if (!/Droit.doccupation.des.sols/i.test(decodeURIComponent(file.url))) continue;
        file.layout = 'balma-table'; file.board = 'filings';
      } else {
        if (!municipalDossier(title, city)) continue;
        file.board = /\bAFF\b|d[ée]cision|non.opposition|refus|arr[êe]t[ée]/i.test(title) ? 'decisions' : 'filings';
        const day = /\bAFF\s+(\d{4})\.(\d{2})\.(\d{2})/.exec(title);
        file.published = day ? `${day[1]}-${day[2]}-${day[3]}` : null;
      }
      files.push(file);
    }
  }
  return [...new Map(files.map((file) => [file.url, { layout: 'municipal-notice', ...file }])).values()];
}

/** DematDOC's newest aggregate lists, including a decision list mislabelled PC. */
export function dematdocFiles(city, json) {
  if (!Array.isArray(json?.documents)) return null;
  const files = json.documents.flatMap((doc) => {
    const title = doc.name ?? '';
    if (!/Liste des (?:avis|d[ée]cisions)|Permis de construire/i.test(title) || municipalDossier(title, city)) return [];
    const board = /avis.*d[ée]p[ôo]t/i.test(title) ? 'filings' : 'decisions';
    const published = municipalDate(doc.values?.DATEACTE?.displayValue ?? doc.createdAt?.slice(0, 10)) ?? municipalDate(title);
    const file = safeFile(city, doc.path, title, { board, published, layout: 'saint-priest-table' });
    return file ? [file] : [];
  }).sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''));
  return ['filings', 'decisions'].flatMap((board) => files.filter((file) => file.board === board).slice(0, 1));
}

/** Next link on a municipal board, restricted to the same origin and path. */
export function municipalNextPage(city, html, current) {
  for (const match of String(html).matchAll(/<a\b([^>]*\bhref=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (!/rel=["']next|page suivante|pager__item--next|title=["'](?:aller [àa] la )?page suivante/i.test(match[0])) continue;
    try {
      const url = new URL(decode(match[2]), current);
      for (const [key, value] of new URL(city.page).searchParams) {
        if (key !== 'page' && !url.searchParams.has(key)) url.searchParams.set(key, value);
      }
      if (url.origin === new URL(city.page).origin && url.pathname === new URL(city.page).pathname) return url.href;
    } catch { /* a malformed link is not a page */ }
  }
  return null;
}

/** PDF lines without reading order interleaving the two columns of a notice. */
function documentLines(document) {
  return (document?.pages ?? []).flatMap((page) => {
    const out = [];
    for (const run of [...(page.runs ?? [])].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const previous = out.at(-1);
      if (previous && Math.abs(previous.y - run.y) < 2) previous.text += ` ${run.text}`;
      else out.push({ y: run.y, text: run.text });
    }
    return out.map((line) => clean(line.text));
  });
}

/** The left project column of MEL's decision form, below its applicant block. */
function decisionField(document, label) {
  const page = document?.pages?.[0];
  if (!page?.width) return null;
  const runs = page.runs ?? [];
  const heading = runs.find((run) => /^DESCRIPTION\b/.test(fold(run.text)));
  if (!heading) return null;
  const anchor = runs.find((run) => run.y < heading.y - 2 && label.test(fold(run.text)));
  if (!anchor) return null;
  const next = runs.filter((run) => run.y < anchor.y - 2 && /^(?:SUR|TERRAIN|CADASTRE|LE MAIRE)\b/.test(fold(run.text)))
    .sort((a, b) => b.y - a.y)[0];
  const values = runs.filter((run) => run.x >= page.width * 0.23 && run.x < page.width * 0.6
    && run.y <= anchor.y + 2 && run.y > Math.max(anchor.y - 27, next?.y ?? -Infinity) + 2);
  return documentLines({ pages: [{ runs: values }] }).join(' ') || null;
}

/** Individual notices: only labelled terrain/project fields, never applicant fields. */
export function readMunicipalNotice(document, { city, file }) {
  const lines = documentLines(document);
  if (!lines.length) return [];
  const body = lines.join('\n');
  const dossier = municipalDossier(lines.slice(0, 18).join(' '), city) ?? municipalDossier(file.title, city);
  if (!dossier) return [];
  const field = (pattern) => {
    const at = lines.findLastIndex((line) => pattern.test(line));
    if (at < 0) return null;
    const parts = [lines[at].replace(pattern, '')];
    for (const line of lines.slice(at + 1, at + 10)) {
      if (/^(?:superficie|nature|surface|date|demandeur|terrain|travaux|fait|le\s+\d|r[ée]f[ée]rence|cadastre)/i.test(line)) break;
      parts.push(line);
    }
    return clean(parts.join(' ')) || null;
  };
  const decisionAddress = file.board === 'decisions' ? decisionField(document, /^SUR(?: UN.*)?$/) : null;
  const site = file.board === 'filings' ? field(/^(?:Adresse du terrain|Terrain)\s*:?[ ]*/i)
    : /\b(?:rue|avenue|all[ée]e|boulevard|chemin|place|impasse|square|route)\b/i.test(decisionAddress ?? '')
      ? decisionAddress.replace(/\s+-\s+WATTRELOS$/i, '') : null;
  const fallback = municipalTitleRow(city, file);
  const row = { ...fallback, ...baseRow(city, file.board, dossier, site ?? fallback?.address),
    filedOn: municipalDate(/(?:Date de d[ée]p[ôo]t(?: en mairie)?\s*:?[ ]*|Dossier d[ée]pos[ée](?: complet)? le\s*)([^\n]+)/i.exec(body)?.[1]),
    purpose: (file.board === 'filings' ? field(/^(?:Nature des travaux|Travaux)(?! non soumis)\s*:?[ ]*/i)
      : decisionField(document, /^POUR\s*:?$/)) ?? fallback?.purpose ?? null,
    postedOn: file.published ?? null };
  if (row.purpose && /\b(?:monsieur|madame|demandeur)\b/i.test(row.purpose)) row.purpose = null;
  if (file.board === 'decisions') {
    const article = /\bARTICLE\s+(?:1|UNIQUE)\s*[:.\-–]?([\s\S]{0,500})/i.exec(body)?.[1] ?? '';
    row.verdict = municipalVerdict(article) ?? municipalVerdict(lines.slice(0, 8).join(' ')) ?? fallback?.verdict ?? verdicts.signed.fr;
    row.decidedOn = municipalDate(/Fait [\s\S]{0,100}?\bLe\s+([^\n]+)/i.exec(body)?.[1]);
  }
  return row.address ? [row] : [];
}

/** Saint-Priest's Aspose grid specification, consumed by readGridTable. */
export function saintPriestGridSpec({ city, file }) {
  return { board: file.board, columns: [
    ['dossier', 'N° DE DOSSIER'], ['filedOn', 'DATE DEPOT'], ['applicant', 'DEMANDEUR'],
    ['address', 'LIEUX DES'], ['landArea', 'SUPERFICIE'], ['purpose', 'NATURE DES TRAVAUX'],
    ['project', 'PROJET'], ['verdict', 'DECISION', { optional: file.board === 'filings' }],
  ], row: (cells) => {
    const dossier = municipalDossier((cells.dossier ?? []).filter((line) => !/\d{2}\/\d{2}\/\d{4}/.test(line)).join(' '), city);
    if (!dossier) return null;
    const verdict = clean(cells.verdict?.join(' '));
    return { ...baseRow(city, file.board, dossier, cells.address?.join(' ')),
      purpose: clean(cells.purpose?.join(' ')) || null,
      filedOn: municipalDate(cells.filedOn?.join(' ')), postedOn: municipalDate(cells.dossier?.join(' ')),
      verdict: verdict.replace(/\s+le\s+\d.*$/i, '') || null, decidedOn: municipalDate(verdict),
      landArea: /[\d]+(?:[.,]\d+)?/.exec(cells.landArea?.join(' '))?.[0],
      floorArea: /plancher cr[ée][ée]e\s*:\s*([\d.,]+)/i.exec(cells.project?.join(' '))?.[1] ?? null };
  } };
}

/** Balma's centred cells share the clipping rectangle of their table row. */
export function readBalmaTable(document, { city }) {
  const rows = [];
  for (const page of document?.pages ?? []) {
    const runs = page.runs ?? [];
    const heads = ['Nature', 'Date', 'Numéro du dossier', 'Nom et prénom (ou', 'Adresse du terrain', 'Nature des travaux', 'Surface', 'Hauteur']
      .map((name) => runs.find((run) => fold(run.text) === fold(name)));
    if (heads.some((head) => !head)) continue;
    const centres = heads.map((head) => (head.x + head.x1) / 2);
    const anchors = runs.filter((run) => municipalDossier(run.text, city));
    for (const anchor of anchors) {
      const band = runs.filter((run) => run.clip && anchor.clip
        && Math.abs(run.clip.y0 - anchor.clip.y0) < 1 && Math.abs(run.clip.y1 - anchor.clip.y1) < 1);
      const cells = Array.from({ length: 8 }, () => []);
      for (const run of band.sort((a, b) => b.y - a.y || a.x - b.x)) {
        const x = (run.x + run.x1) / 2;
        let at = 0;
        for (let i = 1; i < centres.length; i += 1) if (Math.abs(centres[i] - x) < Math.abs(centres[at] - x)) at = i;
        cells[at].push(run.text);
      }
      const nature = clean(cells[0].join(' '));
      const board = /DEPOT/.test(fold(nature)) ? 'filings' : 'decisions';
      const date = municipalDate(cells[1].join(' '));
      rows.push({ ...baseRow(city, board, municipalDossier(anchor.text, city), cells[4].join(' ')),
        purpose: clean(cells[5].join(' ')), filedOn: board === 'filings' ? date : null,
        verdict: board === 'decisions' ? nature : null, decidedOn: board === 'decisions' ? date : null,
        floorArea: clean(cells[6].join(' ')) || null });
    }
  }
  return rows;
}

/** Find a header phrase among positioned OCR words. */
function phrase(runs, words) {
  const wanted = fold(words).split(' ');
  for (const first of runs.filter((run) => fold(run.text) === wanted[0])) {
    const line = runs.filter((run) => Math.abs(run.y - first.y) < 4 && run.x >= first.x - 0.5).sort((a, b) => a.x - b.x);
    if (wanted.every((word, i) => fold(line[i]?.text) === word)) return { x: first.x, y: first.y };
  }
  return null;
}

/** Wattrelos's scanned filing table: columns preserve the applicant boundary. */
export function readWattrelosTable(document, { city }) {
  const rows = [];
  for (const page of document?.pages ?? []) {
    const runs = page.runs ?? [];
    const headers = ['Date de dépôt', 'Numéro de dossier', 'Pétitionnaire', 'Adresse du projet', 'Description du projet'].map((word) => phrase(runs, word));
    if (headers.some((header) => !header)) continue;
    const column = (run) => {
      let at = 0;
      for (let i = 1; i < headers.length; i += 1) if (run.x >= headers[i].x - 4) at = i;
      return at;
    };
    const body = runs.filter((run) => run.y < Math.min(...headers.map((head) => head.y)) - 5);
    const numberWords = body.filter((run) => column(run) === 1).sort((a, b) => b.y - a.y || a.x - b.x);
    const groups = [];
    for (const word of numberWords) {
      const last = groups.at(-1);
      if (last && Math.abs(last.y - word.y) < 4) last.words.push(word.text);
      else groups.push({ y: word.y, words: [word.text] });
    }
    const anchors = groups.map((group) => ({ y: group.y, dossier: municipalDossier(group.words.join(' '), city) })).filter((group) => group.dossier);
    anchors.forEach((anchor, i) => {
      const floor = anchors[i + 1]?.y ?? -Infinity;
      const cells = Array.from({ length: 5 }, () => []);
      for (const run of body.filter((word) => word.y <= anchor.y + 4 && word.y > floor + 4).sort((a, b) => b.y - a.y || a.x - b.x)) cells[column(run)].push(run.text);
      rows.push({ ...baseRow(city, 'filings', anchor.dossier, cells[3].join(' ')),
        filedOn: municipalDate(cells[0].join(' ')), purpose: clean(cells[4].join(' ')) });
    });
  }
  return rows;
}
// i18n-ignore-end
