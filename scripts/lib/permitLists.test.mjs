// scripts/lib/permitLists.test.mjs
// The PDF list reader and its daily sweep against a fake host: robots.txt, the
// page, a register built here byte by byte, the edition kept on disk. No
// request leaves the process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  permitListsRobots,
  readPermitCity,
  readPermitList,
  sweepPermitLists,
} from './permitLists.mjs';
import { createCartdsArchiveStore } from './cartdsArchive.mjs';
import { PERMIT_LIST_ROWS, PERMIT_LISTS, normalisePermitListRow } from '../../src/data/permitListsFeed.js';
import { MUNICIPAL_PERMIT_SOURCES } from '../../src/data/municipalPermitsFeed.js';
import { EXTENDED_PERMIT_SOURCES } from '../../src/data/municipalPermitExtensions.js';
import { BOARD_PERMIT_SOURCES } from '../../src/data/permitBoardCities.js';
import { DEMATDOC_PERMIT_SOURCES } from '../../src/data/dematdocFeed.js';

test('Lorient requires both boards and rejects a mismatched commune without archiving a partial answer', async () => {
  const city = EXTENDED_PERMIT_SOURCES.find((c) => c.key === 'lorient-56121');
  const board = (type, insee = city.insee) => JSON.stringify({ MSG: 'OK', DATA: {
    INSEE: insee, TYPE_RQ: type, PC: [], DP: [], PA: [], PD: [], CU: [],
  } });
  const http = fakeHttp({ pages: { [city.page]: "local_secret[56121] = '0123456789abcdef01234567';",
    'https://www.lorient-agglo.bzh/apps/ads/api/dossiers.php?TYPE=DEP&ID_COMMUNE=0123456789abcdef01234567': board('DEP'),
    'https://www.lorient-agglo.bzh/apps/ads/api/dossiers.php?TYPE=DEC&ID_COMMUNE=0123456789abcdef01234567': board('DEC'),
  } });
  assert.deepEqual((await readPermitCity(city, http)).boards, { filings: [], decisions: [] });
  assert.equal(await readPermitCity(city, http, { allows: (pathname) => !pathname.endsWith('dossiers.php') }), null);
  const wrong = fakeHttp({ pages: { [city.page]: "local_secret[56121] = '0123456789abcdef01234567';",
    'https://www.lorient-agglo.bzh/apps/ads/api/dossiers.php?TYPE=DEP&ID_COMMUNE=0123456789abcdef01234567': board('DEP', '56162'),
  } });
  assert.equal(await readPermitCity(city, wrong), null);
});

test('Digilor scans await background OCR, retry cached scans once, and never persist titles or applicants', async () => {
  const dir = await tempDir();
  const city = EXTENDED_PERMIT_SOURCES.find((c) => c.key === 'thionville');
  const index = [{ id_cat: 2034, id_sscat: 2544, aff_deb: '2026-09-25',
    nom_affichage: 'PC0576722600001_PRIVATE_PERSON_3_RUE_EXEMPLE_ARRETE_BAN', url_uiid: './upload/222/example.pdf' }];
  const http = datahallHttp({ index, files: { 'upload/222/example.pdf': Buffer.from('%PDF-1.7\nscanned') } });
  let calls = 0;
  const ocr = async () => { calls += 1; return { document: { pages: [{ runs: [
    { text: 'PC 057672 26 00001', x: 30, y: 700 }, { text: 'ARTICLE 1 : Le permis est refusé', x: 30, y: 680 },
  ] }] } }; };
  const first = await readPermitCity(city, http, { dir, ocr, day: '2026-10-01' });
  assert.equal(calls, 0, 'a visitor never runs OCR');
  assert.equal(first.pendingOcr, 1);
  assert.equal(first.boards.decisions[0][8], 'Décision signée');
  const swept = await readPermitCity(city, http, { dir, ocr, background: true, day: '2026-10-01' });
  assert.equal(calls, 1);
  assert.equal(swept.pendingOcr, 0);
  assert.equal(swept.boards.decisions[0][8], 'Refus');
  await readPermitCity(city, http, { dir, ocr, background: true, day: '2026-10-01' });
  assert.equal(calls, 1);
  for (const file of await fsp.readdir(dir)) assert.doesNotMatch(await fsp.readFile(path.join(dir, file), 'utf8'), /PRIVATE|PERSON|ARTICLE|title|scanned/);
  const challenge = datahallHttp({ index, files: { 'upload/222/example.pdf': Buffer.from('<html>challenge</html>') } });
  const failed = await readPermitCity(city, challenge, { day: '2026-10-01' });
  assert.equal(failed.failed, 1);
  assert.deepEqual(failed.boards, {});
});

test('a DematDOC shelf pages until it reaches the window, reads each act once and keeps a scan for the sweep’s OCR', async () => {
  const dir = await tempDir();
  const city = DEMATDOC_PERMIT_SOURCES.find((c) => c.insee === '26198');
  const doc = (id, name, day) => ({ id, name, createdAt: `${day}T09:00:00+02:00`, path: `/repository/${id}.pdf`,
    values: { CI_DATE_DEBUT_AFFICHAGE_PUBLIC: { displayValue: day }, OBJET: { displayValue: 'PRIVATE PERSON' } } });
  const pages = {
    '/api/public/get-documents/14': { documents: [doc(1, 'Urbanisme DP261982600511 du 2026-09-28', '2026-09-28'),
      doc(2, 'Urbanisme PC261982600062 du 2026-09-28 - 4 Avenue Exemple', '2026-09-28')], nextDocsIds: [3, 4] },
    '/api/public/get-documents-lazy': { documents: [doc(3, 'Urbanisme DP261982600300 du 2026-07-20', '2026-07-20')], nextDocsIds: [4] },
  };
  const files = {
    '/repository/1.pdf': noticePdf([[60, 760, 'ARRETE DE NON-OPPOSITION'], [60, 740, 'n DP 26198 26 00511'],
      [60, 720, 'Par : Monsieur PRIVATE PERSON'], [60, 700, 'Sur un terrain sis : 26 Allee Exemple'],
      [60, 680, 'Parcelles : ZI313'], [60, 600, 'Article 1 : Il n est pas fait opposition a la declaration.']]),
    '/repository/2.pdf': noticePdf([]),
  };
  const calls = [];
  const response = (payload, type) => ({ ok: true, status: 200, payload, body: { cancel: async () => {} },
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) } });
  const http = {
    async fetch(url, init = {}) {
      const { pathname } = new URL(url);
      calls.push({ path: pathname, method: init.method ?? 'GET', body: init.body ?? null });
      if (pages[pathname]) return response(JSON.stringify(pages[pathname]), 'application/json');
      return files[pathname] ? response(files[pathname], 'application/pdf') : null;
    },
    text: async (r) => (typeof r.payload === 'string' ? r.payload : null),
    bytes: async (r) => (r.payload instanceof Uint8Array ? r.payload : null),
  };
  const first = await readPermitCity(city, http, { dir, day: '2026-10-02' });
  assert.deepEqual(calls.slice(0, 2).map((call) => [call.path, call.body]), [
    ['/api/public/get-documents/14', '{"filters":{"params":{"archive":false},"indexfields":[],"document":[]},"filtersURL":"14"}'],
    ['/api/public/get-documents-lazy', '[3,4]'],
  ]);
  assert.equal(calls.filter((call) => call.path === '/api/public/get-documents-lazy').length, 1, 'a page older than the window ends the paging');
  assert.equal(calls.some((call) => call.path === '/repository/3.pdf'), false, 'an act before the window is not read');
  const rows = first.boards.decisions.map((cells) => normalisePermitListRow(city, 'decisions', cells))
    .sort((a, b) => a.dossier.localeCompare(b.dossier));
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.stateLabel]), [
    ['DP 026 198 26 00511', '26 Allee Exemple', 'Accordé'],
    ['PC 026 198 26 00062', '4 Avenue Exemple', 'Décision signée'],
  ]);
  assert.equal(first.pendingOcr, 1);
  let ocrCalls = 0;
  const ocr = async () => { ocrCalls += 1; return { document: { pages: [{ runs: [
    { text: 'REFUS DE PERMIS DE CONSTRUIRE', x: 60, y: 760 }, { text: 'PC 26198 26 00062', x: 60, y: 740 },
    { text: 'Sur un terrain sis : 4 Avenue Exemple', x: 60, y: 720 }, { text: 'Article 1 : Le permis est refuse.', x: 60, y: 600 },
  ] }] } }; };
  calls.length = 0;
  const swept = await readPermitCity(city, http, { dir, day: '2026-10-02', ocr, background: true });
  assert.equal(ocrCalls, 1);
  assert.equal(swept.pendingOcr, 0);
  assert.equal(calls.filter((call) => call.path === '/repository/1.pdf').length, 0, 'a text act is read once');
  const scanned = swept.boards.decisions.map((cells) => normalisePermitListRow(city, 'decisions', cells))
    .find((row) => row.dossier.startsWith('PC'));
  assert.equal(scanned.state, 'refuse');
  for (const file of await fsp.readdir(dir)) assert.doesNotMatch(await fsp.readFile(path.join(dir, file), 'utf8'), /PRIVATE|PERSON|Urbanisme/);
});

test('Rueil caches scrubbed month rows, preserves explicit refusals and never infers a grant from an unread act', async () => {
  const dir = await tempDir();
  const city = EXTENDED_PERMIT_SOURCES.find((c) => c.key === 'rueil');
  const months = {
    '10-2026': monthPage([]),
    '09-2026': monthPage([['ARRETE DP 2600001 PRIVATE PERSON 82 TALUS_001', 'A', '25/09/2026']]),
    '08-2026': monthPage([['REFUS PC 2600002 PRIVATE PERSON 3 EXEMPLE_001', 'B', '25/08/2026']]),
  };
  const http = webdelibHttp({ months });
  const result = await readPermitCity(city, http, { dir, day: '2026-10-01', months: 3, maxFiles: 0 });
  assert.equal(result.skipped, 2);
  assert.deepEqual(result.boards.decisions.map((cells) => cells[8]), ['Décision signée', 'Refus']);
  for (const file of await fsp.readdir(dir)) assert.doesNotMatch(await fsp.readFile(path.join(dir, file), 'utf8'), /PRIVATE|PERSON|title/);
  const second = webdelibHttp({ months });
  await readPermitCity(city, second, { dir, day: '2026-10-01', months: 3, maxFiles: 0 });
  assert.equal(second.calls.filter((call) => call.month === '08-2026').length, 0, 'closed months come from scrubbed cache');
});

const CITY = Object.freeze({
  key: 'ville',
  insee: '30189',
  label: 'Ville — registre des dossiers en cours',
  page: 'https://ville.example/urbanisme/autorisations',
  lists: Object.freeze([Object.freeze({ board: 'filings', layout: 'register', link: /registre_dossiers/i })]),
});
const SHUT = Object.freeze({ ...CITY, key: 'shut', page: 'https://shut.example/urbanisme' });

test('municipal scans await OCR, retry once in the sweep, and cache only scrubbed fields', async () => {
  const dir = await tempDir();
  const city = MUNICIPAL_PERMIT_SOURCES.find((c) => c.key === 'acheres');
  const url = new URL('/files/notice.pdf', city.page).href;
  const http = fakeHttp({ pages: { [city.page]: '<a href="/files/notice.pdf">AFF 2026.09.25 – DP 26A0077 – 2 RUE EXEMPLE – ACCORD</a>' },
    files: { [url]: { bytes: Buffer.from('%PDF-1.7\nscanned') } } });
  const first = await readPermitCity(city, http, { dir });
  assert.equal(first.pendingOcr, 1);
  assert.equal(first.boards.decisions.length, 1);
  let calls = 0;
  const ocr = async (bytes, opts) => {
    calls += 1; assert.equal(opts.positioned, true);
    return { document: { pages: [{ runs: [
      { text: 'DP 078005 26 A0077', x: 30, y: 700 },
      { text: 'ARTICLE 1 : La demande est refusée', x: 30, y: 680 },
    ] }] } };
  };
  const swept = await readPermitCity(city, http, { dir, ocr, background: true });
  assert.equal(swept.pendingOcr, 0);
  assert.equal(calls, 1);
  assert.ok(swept.boards.decisions[0].includes('Refus'));
  await readPermitCity(city, http, { dir, ocr, background: true });
  assert.equal(calls, 1, 'an already read immutable PDF is not read again');
  for (const file of await fsp.readdir(dir)) assert.doesNotMatch(await fsp.readFile(path.join(dir, file), 'utf8'), /ARTICLE|scanned|title/);
});

test('a Drupal board is paginated by the sweep; visitors use its snapshot without requests', async () => {
  const dir = await tempDir();
  const city = MUNICIPAL_PERMIT_SOURCES.find((c) => c.key === 'wattrelos');
  const next = new URL(city.page); next.searchParams.set('page', '1');
  const item = (id) => `<li class="kiosque__item"><h3>PC 26-${id} Extension 15 rue Exemple</h3><a href="/files/${id}.pdf">PDF</a></li>`;
  const http = fakeHttp({ pages: { [city.page]: `${item(47)}<a href="${next.href.replaceAll('&', '&amp;')}" rel="next">Next</a>`, [next.href]: item(48) },
    files: { [new URL('/files/47.pdf', city.page).href]: { bytes: Buffer.from('%PDF-1.7\nscan') }, [new URL('/files/48.pdf', city.page).href]: { bytes: Buffer.from('%PDF-1.7\nscan') } } });
  assert.equal(await readPermitCity(city, http, { dir }), null);
  assert.equal(http.calls.length, 0);
  const answer = await readPermitCity(city, http, { dir, background: true, maxFiles: 1 });
  assert.equal(answer.skipped, 1);
  assert.equal(answer.incomplete, true);
  const before = http.calls.length;
  const visitor = await readPermitCity(city, http, { dir });
  assert.equal(visitor.boards.decisions.length, 1);
  assert.equal(http.calls.length, before);
  const second = await readPermitCity(city, http, { dir, background: true, maxFiles: 1 });
  assert.equal(second.boards.decisions.length, 2, 'the backlog progresses with cached files');
});

test('broken PDFs and HTML challenges preserve the other municipal files', async () => {
  const city = MUNICIPAL_PERMIT_SOURCES.find((c) => c.key === 'acheres');
  const files = { '/good.pdf': { bytes: Buffer.from('%PDF-1.7\nscan') }, '/bad.pdf': { bytes: Buffer.from('<html>challenge</html>') }, '/missing.pdf': 404 };
  const http = fakeHttp({ pages: { [city.page]: Object.keys(files).map((href, i) => `<a href="${href}">DP 078 005 26A00${80 + i} – 2 RUE EXEMPLE</a>`).join('') },
    files: Object.fromEntries(Object.entries(files).map(([url, answer]) => [new URL(url, city.page).href, answer])) });
  const answer = await readPermitCity(city, http);
  assert.equal(answer.boards.filings.length, 1);
  assert.equal(answer.failed, 2);
  assert.equal(answer.incomplete, true);
});

/** A one-page register: the six headers and one record, WinAnsi text. */
function registerPdf(number = 'DP 030189 26 01093', applicant = 'DUPONT Jean') {
  const text = (x, y, words) => `BT /F1 7 Tf 1 0 0 1 ${x} ${y} Tm (${words}) Tj ET`;
  const content = [
    text(83.5, 451.4, 'DOSSIER'), text(200.9, 451.4, 'DATES'), text(296.3, 451.4, 'DEMANDEUR'),
    text(431.1, 451.4, 'TERRAIN'), text(582.6, 451.4, 'INFORMATIONS'), text(754.1, 451.4, 'LIMITE'),
    text(53, 432.5, 'D\xc9CLARATION PR\xc9ALABLE'), text(58, 423.8, 'CONSTRUCTION \\(Initiale\\)'),
    text(66, 406.3, number), text(178.4, 432.5, 'D\xe9pos\xe9 le 18/09/2026'),
    text(258, 432.5, applicant), text(258, 423.8, '1 rue du Demandeur'),
    text(385.5, 432.5, '23 Rue Exemple'), text(385.5, 423.8, '30000 N\xeemes'),
    text(385.5, 415, 'superficie : 187 m\xb2'),
    text(711.5, 432.5, 'D\xe9lai 1 mois'), text(711.5, 423.8, 'Date limite le 18/10/2026'),
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /TrueType /BaseFont /Arial /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.7\n';
  objects.forEach((body, i) => { out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  out += 'trailer\n<< /Root 1 0 R >>\n%%EOF\n';
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

const PAGE = '<a href="/files/20260921-etat-registre_dossiers_affichage.pdf"><span>Registre</span></a>';

/** `files[url]` is `{bytes, etag}`, a status, or null for no answer. */
function fakeHttp({ robots = {}, pages = {}, files = {}, honour304 = true } = {}) {
  const calls = [];
  const response = (status, body, headers = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    body: { cancel: async () => {} },
    payload: body,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  });
  return {
    calls,
    async fetch(url, init = {}) {
      calls.push({ url, headers: init.headers ?? {} });
      const { host, pathname } = new URL(url);
      if (pathname === '/robots.txt') {
        const answer = robots[host];
        if (answer === null) return null;
        if (answer === undefined) return response(404, 'not found', { 'content-type': 'text/html' });
        if (typeof answer === 'number') return response(answer, '');
        return response(200, answer, { 'content-type': 'text/plain' });
      }
      if (pages[url] !== undefined) return pages[url] === null ? null : response(200, pages[url], { 'content-type': 'text/html' });
      const file = files[url];
      if (file === undefined) return response(404, '');
      if (file === null) return null;
      if (typeof file === 'number') return response(file, '');
      if (honour304 && file.etag && init.headers?.['If-None-Match'] === file.etag) return response(304, '');
      return response(200, file.bytes, { etag: file.etag ?? null, 'content-type': 'application/pdf' });
    },
    text: async (r) => (typeof r.payload === 'string' ? r.payload : null),
    bytes: async (r) => (r.payload instanceof Uint8Array ? r.payload : null),
  };
}

const FILE_URL = 'https://ville.example/files/20260921-etat-registre_dossiers_affichage.pdf';

async function tempDir() {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'permit-lists-'));
}

/** A synthetic Brive table in the same searchable Word PDF layout. */
function brivePdf(board, kind) {
  const entry = kind === 'PC' ? 'PC 19031 26 00042' : `DP 19031 26 ${board === 'filings' ? '00001' : '00002'}`;
  const runs = board === 'filings' ? [
    [40, 500, 'Date de d\xe9p\xf4t'], [140, 500, 'Num\xe9ro de dossier'], [260, 500, 'P\xe9titionnaire'],
    [400, 500, 'Adresse du projet'], [590, 500, 'Description du projet'],
    [40, 475, '25/09/2026'], [140, 475, entry], [260, 475, 'Jane Example'],
    [400, 475, '34 Rue Exemple'], [400, 465, '19100 BRIVE-LA-GAILLARDE'], [590, 475, 'Extension'],
    ...(kind === 'PC' ? [[140, 465, 'M01']] : []),
  ] : [
    [40, 500, 'Num\xe9ro de dossier'], [160, 500, 'P\xe9titionnaire'], [280, 500, 'D\xe9cision'],
    [400, 500, 'Date de'], [400, 490, 'signature'], [460, 500, 'Nature des travaux'],
    [620, 500, 'Adresse des travaux'], [790, 500, 'Surface'],
    [40, 475, entry], [160, 475, 'Jane Example'], [280, 475, kind === 'PC' ? 'D\xe9favorable' : 'Favorable'],
    [400, 475, '28/09/2026'], [460, 475, 'Extension'], [620, 475, '34 Rue Exemple'],
    [620, 465, '19100 BRIVE-LA-GAILLARDE'], [790, 475, '12,5 m\xb2'],
    ...(kind === 'PC' ? [[40, 465, 'M01']] : []),
  ];
  const content = runs.map(([x, y, text]) => `BT /F1 7 Tf 1 0 0 1 ${x} ${y} Tm (${text}) Tj ET`).join('\n');
  return Buffer.from(`%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n`
    + `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >> endobj\n`
    + `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R >> endobj\n`
    + `4 0 obj << /Length ${Buffer.byteLength(content, 'latin1')} >> stream\n${content}\nendstream endobj\n`
    + `5 0 obj << /Type /Font /Subtype /TrueType /BaseFont /Arial /Encoding /WinAnsiEncoding >> endobj\n`
    + `trailer << /Root 1 0 R >>\n%%EOF\n`, 'latin1');
}

/** A one-page portrait act, its runs placed as an ADS template places them. */
function noticePdf(runs) {
  const content = runs.map(([x, y, text]) => `BT /F1 10 Tf 1 0 0 1 ${x} ${y} Tm (${text}) Tj ET`).join('\n');
  return new Uint8Array(Buffer.from(`%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n`
    + `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >> endobj\n`
    + `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj\n`
    + `4 0 obj << /Length ${Buffer.byteLength(content, 'latin1')} >> stream\n${content}\nendstream endobj\n`
    + `5 0 obj << /Type /Font /Subtype /TrueType /BaseFont /Arial /Encoding /WinAnsiEncoding >> endobj\n`
    + `trailer << /Root 1 0 R >>\n%%EOF\n`, 'latin1'));
}

/** Anonymous WEBDEV host: deliberately different menu, folder and file IDs. */
function briveHttp({ start = 800, missingTable = false, failedPdf = false, challenge = false, rollover = false, robots = {} } = {}) {
  const city = PERMIT_LISTS.find((item) => item.key === 'brive');
  const portal = `${city.source.portal}?site=public%2Btoken`;
  const action = `${city.source.portal}PAGE_accueil_publication_document_html/new-session`;
  const escapeXml = (v) => v.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&apos;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const xml = (content) => `<?xml version="1.0"?><WAJAX>${content}</WAJAX>`;
  const folders = (html) => xml(`<CHAMP ALIAS="A21"><PROP NUM="21">${escapeXml(`jQuery('#target').append(${JSON.stringify(html)});`)}</PROP></CHAMP>`);
  const folder = (id, title) => `<a id='lienDossier${id}'>${title}</a>`;
  const years = `<CHAMP ALIAS="A42"><OPTIONS>${rollover ? '<OPTION>ANNÉE 2027</OPTION>' : ''}<OPTION>ANNÉE 2026</OPTION></OPTIONS></CHAMP>`;
  const documents = [
    ['filings', 'DP', 'Dépot DP'], ['decisions', 'DP', 'Décision DP'],
    ['filings', 'PC', 'Dépot Permis'], ['decisions', 'PC', 'Décision Permis'],
  ].map(([board, kind, title], i) => ({ id: start + i, board, kind, title }));
  const base = fakeHttp({ robots, pages: {
    [city.page]: `<a href="${portal}">Public posting</a>`,
    [portal]: `<form action="${action}"></form><div id="zrl_7_A39">Ville de Brive</div>`,
  }, files: Object.fromEntries(documents.map((doc, i) => [`${city.source.fileBase}DOC_${doc.id}.pdf`,
    failedPdf && i === 3 ? 503 : { bytes: brivePdf(doc.board, doc.kind), etag: `"${doc.id}"` }])) });
  const posts = [];
  return { ...base, posts, async fetch(url, init = {}) {
    if (url !== action) return base.fetch(url, init);
    const fields = Object.fromEntries(new URLSearchParams(init.body)); posts.push(fields);
    assert.equal(init.method, 'POST'); assert.equal(fields.A35, '7');
    assert.equal(fields.A21, undefined);
    let body;
    if (challenge) body = '<html>Challenge</html>';
    else if (fields.WD_CONTEXTE_ === 'A41') body = xml('<CHAMP ALIAS="A5"><div id="zrl_9_A9">Documents</div><div id="zrl_4_A9">Urbanisme</div></CHAMP>');
    else if (fields.WD_CONTEXTE_ === 'A16' || fields.WD_CONTEXTE_ === 'A28') {
      const empty = rollover && fields.A42 === '1';
      body = folders(empty ? folder(99, 'Other documents') : folder(9001, 'Urbanisme')).replace('</WAJAX>', `${years}</WAJAX>`);
    } else if (fields.A19 === '9001') body = folders(folder(9002, 'Affichage au 30/09/2026') + folder(9003, 'Affichage au 02/10/2026'));
    else if (fields.A19 === '9003') body = folders(documents.filter((_, i) => !missingTable || i !== 3).map((doc) =>
      `<a onclick="selectionArrete('A29', 'A19', this, true, 'VDB/DOCUMENTS/', '${doc.id}');">20261002 - ${doc.title}</a>`).join(''));
    else throw new Error(`Unexpected WEBDEV request ${JSON.stringify(fields)}`);
    return { ok: true, status: 200, payload: body };
  } };
}

test('Brive discovers all four live tables, retains amendments and refusals, and caches no private applicant', async () => {
  const city = PERMIT_LISTS.find((item) => item.key === 'brive');
  const dir = await tempDir();
  const http = briveHttp();
  const answer = await readPermitCity(city, http, { dir, day: '2026-10-02' });
  assert.equal(answer.boards.filings.length, 2);
  assert.equal(answer.boards.decisions.length, 2);
  assert.ok(http.posts.every((p) => p.A19 !== '9002'), 'only the newest posting is read');
  assert.ok(http.posts.filter((p) => p.WD_CONTEXTE_ !== 'A41').every((p) => p.A5 === '9'), 'category positions are discovered');
  const filed = normalisePermitListRow(city, 'filings', answer.boards.filings[1], { current: true });
  const refused = normalisePermitListRow(city, 'decisions', answer.boards.decisions[1], { current: true });
  assert.equal(filed.state, 'depose');
  assert.equal(filed.depositedOn, '2026-09-25');
  assert.equal(refused.state, 'refuse');
  assert.equal(refused.decidedOn, '2026-09-28');
  assert.equal(filed.dossier, refused.dossier, 'the wrapped amendment number joins the filing to its decision');
  assert.equal(refused.surfaceCreatedM2, 12.5);
  for (const file of await fsp.readdir(dir)) assert.doesNotMatch(await fsp.readFile(path.join(dir, file), 'utf8'), /Jane Example/);
  const again = await readPermitCity(city, http, { dir, day: '2026-10-02' });
  assert.ok(again.lists.every((list) => list.reused), 'validators reuse the scrubbed edition');
  const replaced = await readPermitCity(city, briveHttp({ start: 1000 }), { dir, day: '2026-10-02' });
  assert.ok(replaced.lists.every((list) => /DOC_100\d\.pdf$/.test(list.url)));
});

test('an empty January collection falls back to the previous calendar year', async () => {
  const city = PERMIT_LISTS.find((item) => item.key === 'brive');
  const http = briveHttp({ rollover: true });
  const answer = await readPermitCity(city, http, { day: '2027-01-02' });
  assert.equal(answer.lists.length, 4);
  assert.ok(http.posts.some((p) => p.WD_CONTEXTE_ === 'A28' && p.A42 === '2' && p.A14 === '2'));
});

test('missing Brive tables, failed PDFs, challenges and either host robots refusal do not replace the archive', async () => {
  const city = PERMIT_LISTS.find((item) => item.key === 'brive');
  for (const options of [
    { missingTable: true }, { failedPdf: true }, { challenge: true },
    { robots: { 'doc.brive.org': 'User-agent: *\nDisallow: /' } },
    { robots: { 'dunfw.brive.org': 'User-agent: *\nDisallow: /' } },
  ]) {
    const http = briveHttp(options);
    assert.equal(await readPermitCity(city, http, { day: '2026-10-02' }), null);
    if (options.missingTable || options.challenge || options.robots) {
      assert.ok(!http.calls.some((call) => call.url.endsWith('.pdf')));
    }
  }
});

test('a city\'s list is read off its page, scrubbed, and kept per edition', async () => {
  const dir = await tempDir();
  const http = fakeHttp({
    pages: { [CITY.page]: PAGE },
    files: { [FILE_URL]: { bytes: registerPdf(), etag: '"v1"' } },
  });
  const first = await readPermitCity(CITY, http, { dir });
  assert.deepEqual(first.lists, [{ board: 'filings', url: FILE_URL, rows: 1, reused: false }]);
  const [cells] = first.boards.filings;
  assert.equal(cells[0], 'DP 030189 26 01093');
  // A person's name never reaches the archive, nor the edition on disk.
  assert.equal(cells[3], null);
  const kept = await fsp.readdir(dir);
  assert.equal(kept.length, 1);
  assert.ok(!(await fsp.readFile(path.join(dir, kept[0]), 'utf8')).includes('DUPONT'));

  // The next reading asks with the edition's validator, and a 304 reuses it.
  const again = await readPermitCity(CITY, http, { dir });
  assert.equal(again.lists[0].reused, true);
  assert.deepEqual(again.boards, first.boards);
  assert.equal(http.calls.at(-1).headers['If-None-Match'], '"v1"');

  // A host that ignores the validator but serves the same one is not parsed again.
  const deaf = fakeHttp({ pages: { [CITY.page]: PAGE }, files: { [FILE_URL]: { bytes: new Uint8Array(0), etag: '"v1"' } }, honour304: false });
  assert.equal((await readPermitCity(CITY, deaf, { dir })).lists[0].reused, true);
});

test('a list that is missing, unreadable or empty fails the city, all or none', async () => {
  const dir = await tempDir();
  const page = { [CITY.page]: PAGE };
  assert.equal(await readPermitCity(CITY, fakeHttp({ pages: { [CITY.page]: '<a href="/x.pdf">Autre</a>' } }), { dir }), null);
  assert.equal(await readPermitCity(CITY, fakeHttp({ pages: page, files: { [FILE_URL]: 503 } }), { dir }), null);
  assert.equal(await readPermitCity(CITY, fakeHttp({ pages: page, files: { [FILE_URL]: null } }), { dir }), null);
  // Bytes that are no PDF, or a PDF with no register in it, are no edition.
  assert.equal(await readPermitCity(CITY, fakeHttp({ pages: page, files: { [FILE_URL]: { bytes: new Uint8Array([1, 2, 3]) } } }), { dir }), null);
  assert.equal(await readPermitList({ board: 'filings', layout: 'register', url: FILE_URL },
    fakeHttp({ files: { [FILE_URL]: { bytes: registerPdf('Page 1/1') } } }), { dir }), null);
  assert.equal(await readPermitCity(CITY, fakeHttp({ pages: { [CITY.page]: null } }), { dir }), null);
  assert.deepEqual(await fsp.readdir(dir), []);
});

test('robots.txt is read for the page and for each file', async () => {
  const refuses = fakeHttp({ robots: { 'ville.example': 'User-agent: *\nDisallow: /files/\n' } });
  const verdict = await permitListsRobots(CITY, refuses);
  assert.equal(verdict.final, true);
  assert.equal(verdict.allows('/urbanisme/autorisations'), true);
  assert.equal(verdict.allows('/files/x.pdf'), false);
  const http = fakeHttp({ pages: { [CITY.page]: PAGE }, files: { [FILE_URL]: { bytes: registerPdf() } } });
  assert.equal(await readPermitCity(CITY, http, { allows: verdict.allows }), null);
  assert.ok(!http.calls.some((call) => call.url === FILE_URL), 'the refused file is never asked for');

  assert.equal((await permitListsRobots(CITY, fakeHttp())).allows('/files/x.pdf'), true);
  assert.equal((await permitListsRobots(CITY, fakeHttp({ robots: { 'ville.example': 503 } }))).allows('/'), false);
  const silent = await permitListsRobots(CITY, fakeHttp({ robots: { 'ville.example': null } }));
  assert.deepEqual([silent.final, silent.allows('/')], [false, false]);
});

test('the sweep reads every city once, keeps its rows and names the failures', async () => {
  const dir = await tempDir();
  const store = createCartdsArchiveStore(path.join(dir, 'archive'), { warn: () => {} }, PERMIT_LIST_ROWS);
  const http = fakeHttp({
    robots: { 'shut.example': 'User-agent: *\nDisallow: /\n' },
    pages: { [CITY.page]: PAGE },
    files: { [FILE_URL]: { bytes: registerPdf('DP 030189 26 01093', 'SCI EXEMPLE') } },
  });
  const quiet = { log: () => {} };
  const summary = await sweepPermitLists({
    cities: [CITY, SHUT], store, http, dir: path.join(dir, 'editions'), day: '2026-10-01', pauseMs: 0, log: quiet,
  });
  assert.deepEqual([summary.read, summary.added, summary.rows], [1, 1, 1]);
  assert.deepEqual(summary.refused, ['shut']);
  assert.deepEqual(summary.failed, []);
  const { archive } = await store.load(CITY, CITY.insee);
  assert.equal(archive.rows.length, 1);
  assert.equal(archive.rows[0].board, 'filings');
  assert.equal(archive.rows[0].cells[3], 'SCI EXEMPLE');

  const next = await sweepPermitLists({
    cities: [CITY], store, http: fakeHttp({ pages: { [CITY.page]: null } }), day: '2026-10-02', pauseMs: 0, log: quiet,
  });
  assert.deepEqual(next.failed, ['ville']);
  assert.equal((await store.load(CITY, CITY.insee)).archive.lastDay, '2026-10-01');
});

// --- Webdelib+ ---------------------------------------------------------------

const WEBDELIB = Object.freeze({
  key: 'wd',
  insee: '69123',
  label: 'Ville — autorisations',
  page: 'https://wd.example/webdelibplus/jsp/summary_orders.jsp?role=usager',
  robots: 'overridden',
  source: Object.freeze({ kind: 'webdelib', base: 'https://wd.example/webdelibplus', tab: 'summary_orders' }),
  lists: Object.freeze([Object.freeze({ layout: 'lyon', title: /droit des sols/i })]),
});

/** A one-page Lyon-style list: a section and one record, WinAnsi text. */
function lyonPdf(number) {
  const text = (x, y, words) => `BT /F1 12 Tf 1 0 0 1 ${x} ${y} Tm (${words}) Tj ET`;
  const content = [
    text(100, 470, 'Permis de construire d\xe9livr\xe9s pendant la p\xe9riode du 27/07/2026 au 02/08/2026'),
    text(22, 449, number), text(163.8, 449, 'Arr\xeat\xe9 du 28/07/2026'),
    text(22, 427, 'Projet :'), text(163.8, 427, 'Extension d\x92un h\xf4tel'),
    text(22, 412, 'Terrain :'), text(163.8, 412, '68 Avenue Exemple Lyon 7\xe8me'),
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /TrueType /BaseFont /Arial /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.7\n';
  objects.forEach((body, i) => { out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  out += 'trailer\n<< /Root 1 0 R >>\n%%EOF\n';
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

/** A month page listing `acts` as `[title, token, published]`. */
function monthPage(acts) {
  return acts.map(([title, token, published]) => `<tr><td></td><td class="tableActe">${title} - <a href="../jsp/openfile.jsp?datePub=${published}&pdf=${token}">Arrêté</a> - (sans annexe)<td>${published}</td><td>${published}</td></tr>`).join('');
}

function webdelibHttp({ months = {}, files = {} } = {}) {
  const calls = [];
  const response = (status, payload, type = 'text/html') => ({
    ok: status >= 200 && status < 300, status, payload, body: { cancel: async () => {} },
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) },
  });
  return {
    calls,
    async fetch(url) {
      const { pathname, searchParams } = new URL(url);
      calls.push(`${pathname.split('/').pop()}?${searchParams.get('date') ?? searchParams.get('pdf')}`);
      if (pathname.endsWith('summary_orders.jsp')) {
        const page = months[searchParams.get('date')];
        return page === undefined ? response(200, '<html></html>') : page === null ? null : response(200, page);
      }
      if (pathname.endsWith('openfile.jsp')) {
        return response(200, `<script>document.location.href='../jsp/showFile.jsp?pdf=${searchParams.get('pdf')}x';</script>`);
      }
      if (pathname.endsWith('showFile.jsp')) {
        const file = files[searchParams.get('pdf').slice(0, -1)];
        return file ? response(200, file, 'application/pdf') : response(500, '');
      }
      return response(404, '');
    },
    text: async (r) => (typeof r.payload === 'string' ? r.payload : null),
    bytes: async (r) => (r.payload instanceof Uint8Array ? r.payload : null),
  };
}

test('a Webdelib+ city is read month by month, a closed month and a read act never asked again', async () => {
  const dir = await tempDir();
  const months = {
    '10-2026': monthPage([['Arrêtés individuels', 'Z', '01/10/2026']]),
    '09-2026': monthPage([['Droit des sols : permis du 27 juillet', 'A', '08/09/2026']]),
    '08-2026': monthPage([['Droit des sols : permis du 20 juillet', 'B', '10/08/2026']]),
  };
  const files = { A: lyonPdf('PC 069 387 26 00043'), B: lyonPdf('PC 069 384 25 00265') };
  const http = webdelibHttp({ months, files });
  const first = await readPermitCity(WEBDELIB, http, { dir, months: 3, day: '2026-10-01' });
  assert.equal(first.incomplete, false);
  assert.deepEqual(first.boards.decisions.map((cells) => cells[0]), ['PC 069387 26 00043', 'PC 069384 25 00265']);
  assert.deepEqual(first.lists.map((list) => [list.rows, list.reused]), [[1, false], [1, false]]);

  const again = webdelibHttp({ months, files });
  const second = await readPermitCity(WEBDELIB, again, { dir, months: 3, day: '2026-10-01' });
  assert.deepEqual(second.boards, first.boards);
  // August is over: its page comes from disk. Both acts come from disk.
  assert.deepEqual(again.calls, ['summary_orders.jsp?10-2026', 'summary_orders.jsp?09-2026']);

  // A month page that does not answer fails the reading; an act that does
  // not is left out and said.
  assert.equal(await readPermitCity(WEBDELIB, webdelibHttp({ months: { ...months, '09-2026': null } }), { months: 2, day: '2026-10-01' }), null);
  const partial = await readPermitCity(WEBDELIB, webdelibHttp({ months, files: { B: files.B } }), { months: 3, day: '2026-10-01' });
  assert.deepEqual([partial.incomplete, partial.failed, partial.boards.decisions.length], [true, 1, 1]);
});

test('an overridden robots.txt is not asked for', async () => {
  const http = webdelibHttp();
  const verdict = await permitListsRobots(WEBDELIB, http);
  assert.equal(verdict.allows('/'), true);
  assert.deepEqual(http.calls, []);
});

// --- Aix (ArcOpole) and Argenteuil (Digilor) ----------------------------------

const AIX = Object.freeze({
  key: 'aix', insee: '13001', underReview: true, label: 'Aix — listes',
  page: 'https://aix.example/arcopolepro/view.jsp', source: Object.freeze({ kind: 'arcopole' }), lists: Object.freeze([]),
});

test('Aix\'s page is read in one request, both tables at once', async () => {
  const row = (cells) => `<tr>${cells.map((value) => `<td>${value}</a></td>`).join('')}</tr>`;
  const html = `<legend>Liste des Dossiers Déposés</legend><table><tr><th>Dossier</th><th>Demandeur</th><th>Adresse du terrain</th><th>Objet / Destination</th><th>Travaux</th><th>Parcelle</th><th>Dépot</th><th>SHOB</th><th>SHON</th><th>Log.</th></tr>
    ${row(['DP2600975', 'DUPONT Jean', '1 RUE EXEMPLE    13100 AIX', '-', 'Clôture', 'AB 0142', '2026-09-30 00:00:00.0', '-', '-', '-'])}</table>
    <legend>Liste des Dossiers Délivrés</legend><table><tr><th>Dossier</th><th>Demandeur</th><th>Adresse du terrain</th><th>Objet / Destination</th><th>Travaux</th><th>Parcelle</th><th>SHOB</th><th>SHON</th><th>Log.</th><th>Délivrance</th><th>Nature</th></tr></table>`;
  const http = fakeHttp({ pages: { [AIX.page]: html } });
  const answer = await readPermitCity(AIX, http, {});
  assert.deepEqual(answer.lists.map((list) => [list.board, list.rows]), [['filings', 1], ['decisions', 0]]);
  assert.equal(answer.boards.filings[0][0], 'DP 013001 26 00975');
  assert.equal(answer.boards.filings[0][3], null, 'a person never reaches the archive');
  assert.equal(await readPermitCity(AIX, fakeHttp({ pages: { [AIX.page]: '<html>maintenance</html>' } }), {}), null);
});

const ARGENTEUIL = Object.freeze({
  key: 'arg', insee: '95018', label: 'Argenteuil — listes', page: 'https://dh.example/web/',
  source: Object.freeze({ kind: 'digilor', base: 'https://dh.example', app: 133, category: 1882, filings: 2170, decisions: 2172 }),
  lists: Object.freeze([Object.freeze({ layout: 'grid' })]),
});

/** A one-dossier filing sheet as Argenteuil posts it, glyphs 500 wide. */
function sheetPdf(number) {
  const text = (x, y, words) => `BT /F1 11 Tf 1 0 0 1 ${x} ${y} Tm (${words}) Tj ET`;
  const content = [
    text(28.3, 390.7, 'Date de d\xe9p\xf4t'), text(153.7, 390.7, 'Num\xe9ro de dossier'), text(278.8, 390.7, 'P\xe9titionnaire'),
    text(408.8, 390.7, 'Adresse du projet'), text(573.8, 390.7, 'Description du projet'),
    text(28.3, 314.9, '29/09/2026'), text(153.7, 314.9, number), text(278.8, 314.9, 'SCI EXEMPLE'),
    text(408.8, 314.9, '1 rue Exemple'), text(408.8, 302.2, '95100 Argenteuil'), text(573.8, 314.9, 'Pose d\x92une cl\xf4ture'),
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    `<< /Type /Font /Subtype /TrueType /BaseFont /Arial /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 255 /Widths [${Array(224).fill(500).join(' ')}] >>`,
  ];
  let out = '%PDF-1.7\n';
  objects.forEach((body, i) => { out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  out += 'trailer\n<< /Root 1 0 R >>\n%%EOF\n';
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

function datahallHttp({ index, files = {} }) {
  const calls = [];
  const response = (status, payload, type = 'text/html') => ({
    ok: status >= 200 && status < 300, status, payload, body: { cancel: async () => {} },
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) },
  });
  return {
    calls,
    async fetch(url, init = {}) {
      const { pathname, searchParams } = new URL(url);
      calls.push({ path: pathname, method: init.method ?? 'GET', body: init.body ?? null, file: searchParams.get('file') });
      if (pathname.endsWith('/index.php')) return response(200, JSON.stringify(index));
      const file = files[searchParams.get('file')];
      return file ? response(200, file, 'application/pdf') : response(404, '');
    },
    text: async (r) => (typeof r.payload === 'string' ? r.payload : null),
    bytes: async (r) => (r.payload instanceof Uint8Array ? r.payload : null),
  };
}

test('a Datahall city reads its index, then each new file once, a few at a time', async () => {
  const dir = await tempDir();
  const doc = (id, day) => ({ id, id_cat: 1882, id_sscat: 2170, aff_deb: day, url_uiid: `./upload/133/${id}.pdf` });
  const index = [doc(1, '2026-09-29'), doc(2, '2026-09-28'), doc(3, '2026-09-27')];
  const files = {
    'upload/133/1.pdf': sheetPdf('DP 95018 26 o0413'),
    'upload/133/2.pdf': sheetPdf('PC 95018 26 o0099'),
    // A scan: a PDF with no text, kept as empty and never fetched again.
    'upload/133/3.pdf': new Uint8Array(Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1')),
  };
  const http = datahallHttp({ index, files });
  const first = await readPermitCity(ARGENTEUIL, http, { dir, months: 2, day: '2026-10-01', maxFiles: 2 });
  assert.deepEqual(http.calls[0], {
    path: '/web/server/index.php', method: 'POST',
    body: '{"controller":"DocumentController","action":"getAll","data":{"idApp":133}}', file: null,
  });
  assert.deepEqual(first.boards.filings.map((cells) => cells[0]), ['DP 95018 26 o0413', 'PC 95018 26 o0099']);
  assert.deepEqual([first.skipped, first.incomplete], [1, true]);

  const again = datahallHttp({ index, files });
  const second = await readPermitCity(ARGENTEUIL, again, { dir, months: 2, day: '2026-10-01', maxFiles: 2 });
  assert.deepEqual(again.calls.map((call) => call.file), [null, 'upload/133/3.pdf']);
  assert.deepEqual([second.boards.filings.length, second.skipped, second.lists[0].empty], [2, 0, 1]);

  const third = datahallHttp({ index, files });
  await readPermitCity(ARGENTEUIL, third, { dir, months: 2, day: '2026-10-01', maxFiles: 2 });
  assert.deepEqual(third.calls.map((call) => call.file), [null], 'every file is on disk now, the scan too');
  assert.equal(await readPermitCity(ARGENTEUIL, datahallHttp({ index: { error: 'no' } }), { months: 2, day: '2026-10-01' }), null);
});

test('a page\'s editions are read once each; an optional list that fails leaves the others', async () => {
  const dir = await tempDir();
  const city = Object.freeze({
    key: 'm', insee: '68224', label: 'M — listes', page: 'https://m.example/permis/',
    lists: Object.freeze([
      Object.freeze({ board: 'filings', layout: 'register', link: /registre_dossiers/i, all: true }),
      Object.freeze({ board: 'decisions', layout: 'register', link: /decisions/i, optional: true }),
    ]),
  });
  const page = '<a href="/a-registre_dossiers.pdf">A</a><a href="/b-registre_dossiers.pdf">B</a><a href="/decisions.pdf">D</a>';
  const files = {
    'https://m.example/a-registre_dossiers.pdf': { bytes: registerPdf('DP 030189 26 01093', 'SCI A') },
    'https://m.example/b-registre_dossiers.pdf': { bytes: registerPdf('DP 030189 26 01094', 'SCI B') },
    'https://m.example/decisions.pdf': 404,
  };
  const http = fakeHttp({ pages: { [city.page]: page }, files });
  const first = await readPermitCity(city, http, { dir });
  assert.deepEqual(first.boards.filings.map((cells) => cells[0]), ['DP 030189 26 01093', 'DP 030189 26 01094']);
  assert.deepEqual([first.failed, first.incomplete], [1, true]);
  const again = fakeHttp({ pages: { [city.page]: page }, files });
  const second = await readPermitCity(city, again, { dir });
  assert.deepEqual(second.boards.filings.length, 2);
  // The two editions came from disk; only the page and the failing list were asked for.
  assert.deepEqual(again.calls.map((call) => new URL(call.url).pathname), ['/permis/', '/decisions.pdf']);
});

test('a Drive city lists its year and board folders, then reads each new file once', async () => {
  const dir = await tempDir();
  const city = Object.freeze({
    key: 'v', insee: '78646', label: 'V — registres', page: 'https://drive.google.com/embeddedfolderview?id=ROOT00000000',
    robots: 'overridden', source: Object.freeze({ kind: 'drive', root: 'ROOT00000000' }),
    lists: Object.freeze([Object.freeze({ board: 'filings', layout: 'register', folder: /d[ée]pos/i })]),
  });
  const entry = (id, title, folder) => `<div class="flip-entry" id="entry-${id}"><a href="https://drive.google.com/${folder ? 'drive/folders' : 'file/d'}/${id}"><div class="flip-entry-title">${title}</div></a></div>`;
  const folders = {
    ROOT00000000: entry('YEAR20250000', '2025', true) + entry('YEAR20260000', '2026', true),
    YEAR20260000: entry('DEPOS0000000', ' dossiers déposés', true) + entry('DECID0000000', 'Dossiers décidés', true),
    DEPOS0000000: entry('FILE00000001', '1er_tableau_2026.pdf', false) + entry('FILE00000002', 'note.docx', false),
  };
  const calls = [];
  const http = {
    async fetch(url) {
      const { pathname, searchParams } = new URL(url);
      const id = searchParams.get('id');
      calls.push(`${pathname}?${id}`);
      const ok = (payload, type) => ({ ok: true, status: 200, payload, body: { cancel: async () => {} }, headers: { get: () => type } });
      if (pathname === '/embeddedfolderview') return folders[id] ? ok(folders[id], 'text/html') : { ok: false, status: 404 };
      if (pathname === '/download' && id === 'FILE00000001') return ok(registerPdf('DP 030189 26 01093', 'SCI A'), 'application/octet-stream');
      return { ok: false, status: 404 };
    },
    text: async (r) => r.payload,
    bytes: async (r) => r.payload,
  };
  const first = await readPermitCity(city, http, { dir, months: 2, day: '2026-10-01' });
  assert.deepEqual(first.boards.filings.map((cells) => cells[0]), ['DP 030189 26 01093']);
  assert.ok(!calls.some((call) => call.includes('YEAR20250000')), 'a year before the window is not listed');
  calls.length = 0;
  await readPermitCity(city, http, { dir, months: 2, day: '2026-10-01' });
  assert.ok(!calls.some((call) => call.startsWith('/download')), 'a file read once is not downloaded again');
});

test('a Liferay city reads each space\'s files once, a decision titled by its day and number', async () => {
  const dir = await tempDir();
  const shelf = (board, layout, path, instance, space) => ({ board, layout, path, instance, space });
  const city = Object.freeze({
    key: 'lr', insee: '17300', label: 'LR — listes', page: 'https://lr.example/depots', robots: 'overridden',
    source: Object.freeze({
      kind: 'liferay', base: 'https://lr.example',
      shelves: [shelf('decisions', 'larochelle-decision', '/decisions', 'dec_inst', 'space-dec')],
    }),
    lists: Object.freeze([]),
  });
  const node = (title, uuid) => ({ data: { icon: 'file-anytype file-pdf', attr: { title, href: `https://lr.example/decisions/-/espace/dec_inst/proxy/${uuid}/1.0/x.pdf` } } });
  const tree = [
    node('2026-09-30 PC 17300 26 0078 DUPONT Jean', 'u1'),
    node('2026-06-30 DP 17300 26 0011 MARTIN Claire', 'u2'),
  ];
  const decision = (() => {
    const content = 'BT /F1 12 Tf 1 0 0 1 50 780 Tm (ARR\xcAT\xc9) Tj ET\nBT /F1 12 Tf 1 0 0 1 50 760 Tm (ACCORDANT UN PERMIS DE CONSTRUIRE) Tj ET';
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>',
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
      '<< /Type /Font /Subtype /TrueType /BaseFont /Arial /Encoding /WinAnsiEncoding >>',
    ];
    let out = '%PDF-1.7\n';
    objects.forEach((body, i) => { out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
    return new Uint8Array(Buffer.from(`${out}trailer\n<< /Root 1 0 R >>\n%%EOF\n`, 'latin1'));
  })();
  const calls = [];
  const http = {
    async fetch(url) {
      calls.push(url);
      const ok = (payload) => ({ ok: true, status: 200, payload, body: { cancel: async () => {} }, headers: { get: () => null } });
      if (new URL(url).searchParams.get('p_p_resource_id') === 'load-espace-children') return ok(JSON.stringify(tree));
      if (url.includes('/proxy/u1/')) return ok(decision);
      return { ok: false, status: 404 };
    },
    text: async (r) => r.payload,
    bytes: async (r) => r.payload,
  };
  const answer = await readPermitCity(city, http, { dir, months: 2, day: '2026-10-01' });
  assert.deepEqual(answer.boards.decisions.map((cells) => [cells[0], cells[8], cells[10]]), [['PC 17300 26 00078', 'Accord', '2026-09-30']]);
  assert.ok(!calls.some((url) => url.includes('/proxy/u2/')), 'a decision posted before the window is not fetched');
  const kept = await fsp.readFile(path.join(dir, (await fsp.readdir(dir))[0]), 'utf8');
  assert.ok(!kept.includes('DUPONT'), 'the title, which names the applicant, is never stored');
});

test('an Arcade city reads its decisions off the search and each list of filings once', async () => {
  const dir = await tempDir();
  const city = Object.freeze({
    key: 'arc', insee: '87085', label: 'Arc — actes', page: 'https://arc.example/arcade/',
    source: Object.freeze({ kind: 'arcade', base: 'https://arc.example' }),
    lists: Object.freeze([]),
  });
  const param = (code, value) => ({ propertyTypeCode: code, value });
  const act = (id, title, shelf, published) => ({
    id,
    parameters: [param('ACTE_TITLE', title), param('ACTE_CRAP_PLCL_URBA', shelf),
      param('ACTE_DATE_ACT', published), param('ACTE_CRAP_DATE_PUB', published)],
  });
  const search = {
    content: [
      act(30, 'DP2601030_DECISION_SIGNEE', 'Déclarations préalables de travaux délivrées', '20260928000000'),
      act(20, 'LISTE DU 01.09.26 AU 25.09.26', 'Autorisations déposées', '20260925000000'),
      act(10, 'PC2500001_DECISION_SIGNEE', 'Permis de construire délivrés', '20260615000000'),
    ],
    page: { number: 0, totalPages: 1 },
  };
  const list = (() => {
    const t = (x, y, words) => `BT /F1 11 Tf 1 0 0 1 ${x} ${y} Tm (${words}) Tj ET`;
    const content = [
      t(52.8, 529.6, 'Num\xe9ro'), t(147.9, 529.6, 'Demandeur'), t(236.6, 529.6, 'Adresse travaux'),
      t(373.5, 529.6, 'Nature des travaux'), t(723.2, 529.6, 'D\xe9pos\xe9 le'),
      t(52.8, 500.5, 'DP 87 085 2601030'), t(147.9, 500.5, 'SCI EXEMPLE'), t(236.6, 500.5, '8 RUE DES EXEMPLES'),
      t(373.5, 500.5, 'Pergola'), t(723.2, 500.5, '01/09/2026'),
    ].join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R >>',
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
      '<< /Type /Font /Subtype /TrueType /BaseFont /Arial /Encoding /WinAnsiEncoding >>',
    ];
    let out = '%PDF-1.7\n';
    objects.forEach((body, i) => { out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
    return new Uint8Array(Buffer.from(`${out}trailer\n<< /Root 1 0 R >>\n%%EOF\n`, 'latin1'));
  })();
  const calls = [];
  const http = {
    async fetch(url) {
      calls.push(url);
      const ok = (payload) => ({ ok: true, status: 200, payload, body: { cancel: async () => {} }, headers: { get: () => null } });
      const { pathname, searchParams } = new URL(url);
      if (pathname === '/public/api/entities/search/findBySpecification') {
        return searchParams.get('filter') === 'parent.id = 20'
          ? ok(JSON.stringify({ content: [{ mimeType: 'application/pdf', contentId: 'c-20' }] }))
          : ok(JSON.stringify(search));
      }
      if (pathname === '/arcade/api/entities/content/c-20') return ok(list);
      return { ok: false, status: 404 };
    },
    text: async (r) => r.payload,
    bytes: async (r) => r.payload,
  };
  const answer = await readPermitCity(city, http, { dir, months: 2, day: '2026-10-01' });
  assert.deepEqual(answer.boards.decisions.map((cells) => [cells[0], cells[8], cells[9], cells[10]]),
    [['DP 087085 26 01030', 'Décision signée', '2026-09-28', '2026-09-28']], 'the June decision is before the window');
  assert.deepEqual(answer.boards.filings.map((cells) => [cells[0], cells[4], cells[7]]),
    [['DP 087085 26 01030', '8 RUE DES EXEMPLES', '2026-09-01']]);
  assert.equal(calls.length, 3, 'one search page, the list\'s files, its PDF');
  calls.length = 0;
  const again = await readPermitCity(city, http, { dir, months: 2, day: '2026-10-01' });
  assert.equal(calls.length, 1, 'a list already read is not asked for again');
  assert.equal(again.boards.filings.length, 1);
});

// --- A bulletin of scanned arrêtés, read by OCR (Lille) ----------------------
// No binary runs here: the OCR is a function handed in, and it answers each
// bulletin's pages as the text Tesseract would give.

const BULLETIN = Object.freeze({
  key: 'bo',
  insee: '59350',
  label: 'Ville — arrêtés du bulletin',
  page: 'https://bo.example/arretes',
  robots: 'overridden',
  crawlDelayMs: 10_000,
  source: Object.freeze({ kind: 'bulletin' }),
  lists: Object.freeze([Object.freeze({ board: 'decisions', layout: 'lille-bulletin', link: /^BO VDL\b/i })]),
});

const BO_DAYS = ['28', '29', '30'];
const boUrl = (day) => `https://bo.example/content/download/1/2/file/BO+VDL+du+${day}+septembre+2026.pdf`;
const BO_PAGE = [
  ...BO_DAYS.map((day) => `<li><a href="/content/download/1/2/file/BO+VDL+du+${day}+septembre+2026.pdf"><span>BO VDL du ${day} septembre 2026 (.pdf)</span></a></li>`),
  '<li><a href="/content/download/9/9/file/deliberations.pdf"><span>Délibérations réglementaires (.pdf)</span></a></li>',
].join('\n');

/** One decision a bulletin holds, as OCR text: a first page and the article's. */
function arreteText(counter, day) {
  return [
    `DOSSIER N° DP 059350 26 ${counter}\nDemande de Déclaration préalable\nVu la demande, présentée le 02 septembre 2026 par DUPONT Jean, 1 rue du Demandeur,\n`
      + `Vu l'objet de la demande :\n. Travaux sur construction existante : ravalement de façade\n. Sur un terrain situé ${Number(counter)} rue de l'Exemple (Lille)\nVu les pièces fournies,`,
    `DOSSIER N° DP 059350 26 ${counter} PAGE 2/2\nARRETE\nArticle 1 - Il n'est pas fait opposition aux travaux.\nArticle 2 - Exécution.\nHôtel de Ville, le ${day.split('').join(' ')} SEP. 2026`,
  ];
}

/** The host: its page, each bulletin a "PDF" whose bytes name its day. */
function bulletinHttp({ page = BO_PAGE, files = {} } = {}) {
  const calls = [];
  const response = (status, payload, type) => ({
    ok: status >= 200 && status < 300, status, payload, body: { cancel: async () => {} },
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) },
  });
  return {
    calls,
    async fetch(url) {
      calls.push(url);
      if (url === BULLETIN.page) return page === null ? null : response(200, page, 'text/html');
      const day = BO_DAYS.find((d) => url === boUrl(d));
      if (!day) return response(404, '', 'text/html');
      if (files[day] !== undefined) return files[day];
      return response(200, new Uint8Array(Buffer.from(`%PDF-1.6 bulletin ${day}`, 'latin1')), 'application/pdf');
    },
    text: async (r) => (typeof r.payload === 'string' ? r.payload : null),
    bytes: async (r) => (r.payload instanceof Uint8Array ? r.payload : null),
  };
}

/** The OCR, faked: a bulletin's pages from its bytes, each call recorded. */
function fakeOcr() {
  const calls = [];
  const ocr = async (bytes, { screen } = {}) => {
    const day = /bulletin (\d+)/.exec(Buffer.from(bytes).toString('latin1'))[1];
    calls.push({ day, screen });
    const pages = ['Arrêté Municipal\nN° 12\nARRETE DE STATIONNEMENT', ...arreteText(`01${day}0`, day)];
    return { pages, read: 2, ms: 5 };
  };
  return { ocr, calls };
}

test('a bulletin city is read by OCR in the sweep, oldest first, a few at a time, ten seconds apart', async () => {
  const dir = await tempDir();
  const http = bulletinHttp();
  const { ocr, calls } = fakeOcr();
  const answer = await readPermitCity(BULLETIN, http, { dir, months: 2, day: '2026-10-01', ocr, maxFiles: 2 });
  assert.deepEqual(calls.map((call) => call.day), ['28', '29'], 'the oldest unread first, at most two');
  assert.equal(typeof calls[0].screen, 'function', 'a page is screened by its top');
  assert.deepEqual(answer.boards.decisions.map((cells) => [cells[0], cells[4], cells[8], cells[9], cells[10]]), [
    ['DP 059350 26 01280', '1280 rue de l\'Exemple', 'Non-opposition', '2026-09-28', '2026-09-28'],
    ['DP 059350 26 01290', '1290 rue de l\'Exemple', 'Non-opposition', '2026-09-29', '2026-09-29'],
  ]);
  assert.ok(!JSON.stringify(answer).includes('DUPONT'), 'the applicant is never kept');
  assert.deepEqual([answer.skipped, answer.incomplete], [1, true], 'the 30th is left for the next sweep');
  const ledger = (await fsp.readdir(dir)).find((name) => name.startsWith('bulletin'));
  assert.ok(ledger, 'what was read is kept in a ledger');
  assert.ok(!(await fsp.readFile(path.join(dir, ledger), 'utf8')).includes('DUPONT'), 'rows only, never the text');

  // The next reading catches up with what the first left.
  http.calls.length = 0;
  calls.length = 0;
  const next = await readPermitCity(BULLETIN, http, { dir, months: 2, day: '2026-10-02', ocr, maxFiles: 2 });
  assert.deepEqual(calls.map((call) => call.day), ['30']);
  assert.deepEqual(http.calls, [BULLETIN.page, boUrl('30')]);
  assert.equal(next.boards.decisions.length, 3);

  // A visitor's scan: no OCR handed in, no request, the ledger drawn.
  http.calls.length = 0;
  const scan = await readPermitCity(BULLETIN, http, { dir });
  assert.deepEqual(http.calls, [], 'a scan never asks the host');
  assert.equal(scan.boards.decisions.length, 3);
  assert.equal(await readPermitCity(BULLETIN, http, { dir: await tempDir() }), null, 'nothing read yet is nothing to draw');
});

test('a bulletin city\'s sweep waits its crawl delay before every request', async () => {
  const dir = await tempDir();
  const store = createCartdsArchiveStore(path.join(dir, 'archive'), { warn: () => {} }, PERMIT_LIST_ROWS);
  const http = bulletinHttp();
  const slept = [];
  const { ocr } = fakeOcr();
  const summary = await sweepPermitLists({
    cities: [BULLETIN], store, http, dir: path.join(dir, 'editions'), day: '2026-10-01', pauseMs: 0,
    sleep: async (ms) => { slept.push(ms); }, ocr, log: { log: () => {}, warn: () => {} },
  });
  assert.deepEqual([summary.read, summary.added], [1, 3]);
  assert.equal(http.calls.length, 4, 'the page and three bulletins');
  assert.deepEqual(slept, [10_000, 10_000, 10_000, 10_000], 'ten seconds before each');
  const { archive } = await store.load(BULLETIN, BULLETIN.insee);
  assert.deepEqual(archive.rows.map((row) => row.board), ['decisions', 'decisions', 'decisions']);
});

test('without OCR on the machine, a bulletin city is left out with one line', async () => {
  const dir = await tempDir();
  const store = createCartdsArchiveStore(path.join(dir, 'archive'), { warn: () => {} }, PERMIT_LIST_ROWS);
  const http = bulletinHttp();
  const lines = [];
  const summary = await sweepPermitLists({
    cities: [BULLETIN], store, http, dir, day: '2026-10-01', pauseMs: 0, ocr: null,
    log: { log: (line) => lines.push(line), warn: (line) => lines.push(line) },
  });
  assert.deepEqual(http.calls, []);
  assert.deepEqual(summary.withoutOcr, ['bo']);
  assert.deepEqual(summary.failed, [], 'no error');
  assert.equal(lines.filter((line) => line.includes('bo:')).length, 1);
});

test('a bulletin city fails closed on a challenge, a refusal or an answer that is no PDF', async () => {
  const quiet = { warnings: [], log: () => {}, warn(line) { this.warnings.push(line); } };
  const { ocr, calls } = fakeOcr();
  // The page itself answered by a shield's interstitial.
  const challenged = bulletinHttp({ page: '<html><script src="/_Incapsula_Resource?SWJIYLWA=1"></script></html>' });
  assert.equal(await readPermitCity(BULLETIN, challenged, { dir: await tempDir(), day: '2026-10-01', ocr, log: quiet }), null);
  assert.deepEqual(challenged.calls, [BULLETIN.page], 'no bulletin asked after a challenge');
  assert.match(quiet.warnings.at(-1), /challenge/);
  // A bulletin answered by an HTML page: the reading stops there.
  const html = { ok: true, status: 200, payload: new Uint8Array(Buffer.from('<html>Incapsula incident ID</html>')), headers: { get: () => 'text/html' } };
  const swapped = bulletinHttp({ files: { 28: html } });
  const answer = await readPermitCity(BULLETIN, swapped, { dir: await tempDir(), day: '2026-10-01', ocr, log: quiet });
  assert.deepEqual(swapped.calls, [BULLETIN.page, boUrl('28')], 'nothing more asked');
  assert.deepEqual([answer.failed, answer.skipped], [1, 2]);
  assert.equal(calls.length, 0, 'nothing read by OCR');
  // A refusal does the same.
  const refused = bulletinHttp({ files: { 28: { ok: false, status: 403, payload: '', headers: { get: () => null } } } });
  const after = await readPermitCity(BULLETIN, refused, { dir: await tempDir(), day: '2026-10-01', ocr, log: quiet });
  assert.deepEqual([after.failed, after.skipped, refused.calls.length], [1, 2, 2]);
});

// --- Board cities (`permitBoards.js`) ----------------------------------------

/** A Word-style grid: every cell's text under its own clipping rectangle. */
function cellPdf(cells) {
  const content = cells.map(([x0, y0, x1, y1, words]) => `q ${x0} ${y0} ${x1 - x0} ${y1 - y0} re W n BT /F1 9 Tf 1 0 0 1 ${x0 + 4} ${y0 + 8} Tm (${words}) Tj ET Q`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /TrueType /BaseFont /Arial /Encoding /WinAnsiEncoding >>',
  ];
  // Five blank lines first, as Bourges's portal serves its files.
  let out = '\n\n\n\n\n%PDF-1.7\n';
  objects.forEach((body, i) => { out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  out += 'trailer\n<< /Root 1 0 R >>\n%%EOF\n';
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

function filingGrid(number, applicant) {
  return cellPdf([
    [20, 430, 100, 450, 'Date de d\xe9p\xf4t'], [100, 430, 260, 450, 'Num\xe9ro de dossier'], [260, 430, 420, 450, 'P\xe9titionnaire'],
    [420, 430, 600, 450, 'Adresse du projet'], [600, 430, 820, 450, 'Description du projet'],
    [20, 400, 100, 430, '15/09/2026'], [100, 400, 260, 430, number], [260, 400, 420, 430, applicant],
    [420, 400, 600, 430, '9 All\xe9e Exemple'], [600, 400, 820, 430, 'Extension'],
  ]);
}

test('a board city reads its index, then each file once; a failed file leaves the reading incomplete, not empty', async () => {
  const dir = await tempDir();
  const city = BOARD_PERMIT_SOURCES.find((c) => c.key === 'cergy');
  const index = 'https://api.a2display.fr/cvv/documents/7JTBO0t24L6o8LHEahRkbluhcQStGXNed6DZA1qv8dxpIDXiYVs7CTFwZYiWnfjm?l=100&s=creationDatetime&d=desc&fc=10016&fo=true&fa=true';
  const json = JSON.stringify({ data: { items: [
    { name: 'Affichage dépôt du 24-09-2026', file: { name: 'a1.pdf' } },
    { name: 'Affichage décision du 24-09-2026', file: { name: 'b2.pdf' } },
    { name: 'Affichage dépôt du 02-01-2025', file: { name: 'old.pdf' } },
  ] } });
  const files = {
    'https://api.a2display.fr/file?filename=a1.pdf': { bytes: filingGrid('PC 95127 26 U0034', 'Monsieur PRIVATE PERSON') },
    'https://api.a2display.fr/file?filename=b2.pdf': 503,
  };
  const http = fakeHttp({ pages: { [index]: json }, files });
  const first = await readPermitCity(city, http, { dir, day: '2026-10-02' });
  assert.equal(first.boards.filings.length, 1);
  const [cells] = first.boards.filings;
  assert.deepEqual([cells[0], cells[3], cells[4], cells[7]], ['PC 095127 26 U0034', null, '9 All\xe9e Exemple', '2026-09-15']);
  assert.equal(first.failed, 1);
  assert.equal(first.incomplete, true);
  assert.ok(!http.calls.some((call) => call.url.endsWith('old.pdf')), 'a file older than the window is not asked for');
  for (const file of await fsp.readdir(dir)) assert.doesNotMatch(await fsp.readFile(path.join(dir, file), 'utf8'), /PRIVATE|PERSON/);
  const again = fakeHttp({ pages: { [index]: json }, files });
  await readPermitCity(city, again, { dir, day: '2026-10-02' });
  assert.ok(!again.calls.some((call) => call.url.endsWith('a1.pdf')), 'a file read once is not asked for again');
  assert.ok(again.calls.some((call) => call.url.endsWith('b2.pdf')), 'a failed file is asked for again');
  assert.equal(await readPermitCity(city, fakeHttp({ pages: { [index]: '{"error":1}' } }), { day: '2026-10-02' }), null);
});

test('a board city past its file budget keeps what its index said, and says it is incomplete', async () => {
  const city = BOARD_PERMIT_SOURCES.find((c) => c.key === 'garges');
  const page = '<a href="/sites/default/files/tableau_affichage_depot_01.10.2026.pdf">D</a><a href="/sites/default/files/tableau_affichage_decision_01.10.2026.pdf">D</a>';
  const http = fakeHttp({ pages: { [city.page]: page } });
  const answer = await readPermitCity(city, http, { day: '2026-10-02', maxFiles: 0 });
  assert.equal(answer.skipped, 2);
  assert.equal(answer.incomplete, true);
  assert.deepEqual(answer.boards, {});
  assert.equal(await readPermitCity(city, fakeHttp({ pages: { [city.page]: page.split('</a>')[0] } }), { day: '2026-10-02' }), null);
});

test('a board\'s scans are never downloaded for a visitor, and the sweep reads them by OCR within its budget', async () => {
  const dir = await tempDir();
  const city = BOARD_PERMIT_SOURCES.find((c) => c.key === 'la-roche-sur-yon');
  const link = (n) => `<a href="/wp-content/uploads/2026-09-2${n}_x_2026-Ville-41${n}0-dp-26-0048${n}.pdf">2${n}/09/2026</a>`;
  const page = `<h1>Liste des actes</h1>${[1, 2].map(link).join('')}`;
  const files = Object.fromEntries([1, 2].map((n) => [`https://actes.larochesuryon.fr/wp-content/uploads/2026-09-2${n}_x_2026-Ville-41${n}0-dp-26-0048${n}.pdf`,
    { bytes: new Uint8Array(Buffer.from('%PDF-1.7\nscanned')) }]));
  const visitor = fakeHttp({ pages: { [city.page]: page }, files });
  const seen = await readPermitCity(city, visitor, { dir, day: '2026-10-02' });
  assert.equal(visitor.calls.filter((call) => call.url.endsWith('.pdf')).length, 0);
  assert.equal(seen.pendingOcr, 2);
  assert.deepEqual(seen.boards.decisions.map((cells) => cells[0]).sort(), ['DP 085191 26 00481', 'DP 085191 26 00482']);
  const asked = [];
  const ocr = async (bytes, options) => { asked.push(options); return { document: { pages: [{ width: 595, runs: [
    { text: 'Sur un terrain sis à : 12 rue Exemple', x: 40, y: 600, x1: 200 }, { text: 'LE MAIRE', x: 40, y: 500, x1: 90 },
    { text: 'Article 1 : il n’est pas fait opposition', x: 40, y: 400, x1: 300 },
  ] }] } }; };
  const swept = await readPermitCity(city, fakeHttp({ pages: { [city.page]: page }, files }), { dir, day: '2026-10-02', ocr, background: true });
  assert.equal(asked.length, 2);
  assert.ok(asked.every((options) => options.maxPages === 1 && options.positioned));
  assert.equal(swept.pendingOcr, 0);
  assert.deepEqual(swept.boards.decisions.map((cells) => [cells[4], cells[8]]), [['12 rue Exemple', 'Non-opposition'], ['12 rue Exemple', 'Non-opposition']]);
});

test('Sélestat scans pass their table OCR mode only to the sweep, then visitors reuse scrubbed rows', async () => {
  const dir = await tempDir();
  const city = PERMIT_LISTS.find((c) => c.key === 'selestat');
  const page = '<a href="/filings.pdf">Liste des avis de dépôt au 22 septembre 2026</a>'
    + '<a href="/decisions.pdf">Liste des décisions au 22 septembre 2026</a>';
  const files = Object.fromEntries(['filings', 'decisions'].map((board) => [`https://www.selestat.fr/${board}.pdf`,
    { bytes: new Uint8Array(Buffer.from('%PDF-1.7\nscanned')) }]));
  const visitor = fakeHttp({ pages: { [city.page]: page }, files });
  const seen = await readPermitCity(city, visitor, { dir, day: '2026-10-04' });
  assert.equal(seen.pendingOcr, 2);
  assert.ok(!visitor.calls.some((call) => call.url.endsWith('.pdf')));
  const asked = [];
  const run = (text, x, y) => ({ text, x, x1: x + text.length * 2, y });
  const ocr = async (_bytes, options) => {
    asked.push(options);
    return { document: { pages: [{ width: 842, height: 595, runs: [
      run('67462 - SELESTAT', 58, 548), run('N° de dossier', 58, 502),
      run('Objet des travaux', 480, 502), run('Références cadastrales', 324, 488),
      run('DP 067 462 26 M0012', 58, 470), run('01/09/2026', 58, 451),
      run('PRIVATE PERSON', 186, 470), run('99 rue Private', 186, 451),
      run('12 rue du Projet', 324, 470), run('Pergola', 480, 465), run('26/08/2026', 730, 451),
    ] }] } };
  };
  const swept = await readPermitCity(city, fakeHttp({ pages: { [city.page]: page }, files }),
    { dir, day: '2026-10-04', ocr, background: true });
  assert.equal(swept.pendingOcr, 0);
  assert.equal(asked.length, 2);
  assert.ok(asked.every((options) => options.psm === 6 && options.positioned));
  assert.equal(swept.boards.filings[0][4], '12 rue du Projet');
  const cachedVisitor = fakeHttp({ pages: { [city.page]: page }, files });
  const cached = await readPermitCity(city, cachedVisitor, { dir, day: '2026-10-04', ocr });
  assert.equal(cached.reused, 2);
  assert.equal(asked.length, 2);
  assert.ok(!cachedVisitor.calls.some((call) => call.url.endsWith('.pdf')));
  for (const file of await fsp.readdir(dir)) assert.doesNotMatch(await fsp.readFile(path.join(dir, file), 'utf8'), /PRIVATE|Private|scanned/);
});

test('a city\'s own User-Agent goes with every request to its host, robots.txt included', async () => {
  const city = BOARD_PERMIT_SOURCES.find((c) => c.key === 'boulogne-sur-mer');
  const http = fakeHttp({ robots: { 'www.ville-boulogne-sur-mer.fr': 'User-agent: *\nDisallow: /app/\n' } });
  const robots = await permitListsRobots(city, http);
  assert.equal(robots.allows('/votre-mairie/'), true);
  await readPermitCity(city, http, { day: '2026-10-02' });
  assert.ok(http.calls.length > 1);
  for (const call of http.calls) assert.equal(call.headers['User-Agent'], city.userAgent);
});
