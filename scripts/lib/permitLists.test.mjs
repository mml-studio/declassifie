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

const CITY = Object.freeze({
  key: 'ville',
  insee: '30189',
  label: 'Ville — registre des dossiers en cours',
  page: 'https://ville.example/urbanisme/autorisations',
  lists: Object.freeze([Object.freeze({ board: 'filings', layout: 'register', link: /registre_dossiers/i })]),
});
const SHUT = Object.freeze({ ...CITY, key: 'shut', page: 'https://shut.example/urbanisme' });

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
