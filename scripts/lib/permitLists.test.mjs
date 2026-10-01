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
import { PERMIT_LIST_ROWS } from '../../src/data/permitListsFeed.js';
import { MUNICIPAL_PERMIT_SOURCES } from '../../src/data/municipalPermitsFeed.js';

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
