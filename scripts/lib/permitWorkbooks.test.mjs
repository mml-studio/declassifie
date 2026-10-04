import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { readXlsxSheet } from './xlsx-sheet.mjs';
import { readPermitCity } from './permitLists.mjs';
import { permitListFor, PERMIT_LIST_FIELDS } from '../../src/data/permitListsFeed.js';

// A synthetic workbook; no publisher's personal data enters a fixture.
function zip(members) {
  const parts = [], directory = [];
  let offset = 0;
  for (const [name, text] of Object.entries(members)) {
    const filename = Buffer.from(name), raw = Buffer.from(text), compressed = zlib.deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    parts.push(local, filename, compressed); directory.push(central, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const end = Buffer.alloc(22), central = Buffer.concat(directory);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(members).length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, central, end]);
}
const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const headers = ['Numéro dossier - entier', 'Date de dépôt', 'Adresse - Terrain', 'Nom de la commune', 'Liste des demandeurs', 'Description du projet'];
function xlsx({ date1904 = false, formula = false, column = 'F', extra = '' } = {}) {
  const row = (values, number) => `<row>${values.map((value, i) => `<c r="${i === 5 ? column : String.fromCharCode(65 + i)}${number}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`).join('')}</row>`;
  return zip({
    'xl/workbook.xml': `<workbook><workbookPr date1904="${date1904 ? '1' : '0'}"/><sheets><sheet name="Liste affichage dépôt" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${row(headers, 1)}${row(['DP 045 147 26 00164', '46297', '8 rue du Projet 45400', 'FLEURY LES AUBRAIS', 'PRIVATE PERSON 99 rue Private', 'Façade'], 2).replace('t="inlineStr"><is><t>46297</t></is>', `>${formula ? '<f>DATE(2026,10,2)</f>' : ''}<v>46297</v>`)}</sheetData></worksheet>`,
    ...(extra ? { 'xl/extra.xml': extra } : {}),
  });
}

test('XLSX reads stored strings and numeric date serials, withholding cached formulas on request', () => {
  assert.equal(readXlsxSheet(xlsx(), 'Liste affichage dépôt')[1][1], '46297');
  assert.equal(readXlsxSheet(xlsx({ formula: true }), 'Liste affichage dépôt', { rejectFormulas: true })[1][1], '');
  assert.throws(() => readXlsxSheet(xlsx({ date1904: true }), 'Liste affichage dépôt', { reject1904: true }), /1904/);
});

test('XLSX bounds compressed expansion and sparse column or row allocation before a reader sees cells', () => {
  assert.throws(() => readXlsxSheet(xlsx({ extra: 'x'.repeat(100000) }), 'Liste affichage dépôt', { maxUncompressedBytes: 20000 }), /byte limit/);
  assert.throws(() => readXlsxSheet(xlsx({ column: 'ZZZZZZ' }), 'Liste affichage dépôt', { maxColumns: 64 }), /column limit/);
  assert.throws(() => readXlsxSheet(xlsx(), 'Liste affichage dépôt', { maxRows: 1 }), /row limit/);
  assert.throws(() => readXlsxSheet(xlsx().subarray(0, 50), 'Liste affichage dépôt'), /ZIP/);
});

const city = permitListFor('45147');
const url = new URL('/uploads/Liste-affichage-depot-02_10_2026.xlsx', city.page).href;
function httpFor(bytes, { modified = false, html = null } = {}) {
  const calls = [];
  return {
    calls,
    async fetch(request, options = {}) {
      calls.push({ url: request, accept: options.headers?.Accept });
      if (request === city.page) return { ok: true, status: 200, payload: html ?? `<a href="${url}">Télécharger</a>` };
      if (request !== url) return null;
      return { ok: !modified, status: modified ? 304 : 200, payload: bytes, headers: { get: () => 'edition' } };
    },
    text: async (r) => typeof r.payload === 'string' ? r.payload : null,
    bytes: async (r) => r.payload instanceof Uint8Array ? r.payload : null,
  };
}

test('the live collector uses the opted-in sheet and caches only scrubbed project rows', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'permit-workbook-'));
  try {
    const http = httpFor(xlsx());
    const result = await readPermitCity(city, http, { day: '2026-10-04', dir });
    assert.equal(result.failed, 0);
    assert.equal(result.boards.filings.length, 1);
    assert.equal(result.boards.filings[0][PERMIT_LIST_FIELDS.indexOf('filedOn')], '2026-10-02');
    assert.match(http.calls[1].accept, /spreadsheetml/);
    for (const name of await readdir(dir)) assert.doesNotMatch(await readFile(path.join(dir, name), 'utf8'), /PRIVATE|Private|<worksheet|<workbook|Liste des demandeurs/);
    const repeated = httpFor(null);
    assert.equal((await readPermitCity(city, repeated, { day: '2026-10-04', dir })).reused, 1);
    assert.equal(repeated.calls.length, 1, 'a dated edition is read once');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a corrupt or unsupported workbook marks the reading incomplete and leaves no empty edition', async () => {
  for (const bytes of [Buffer.from('PK\x03\x04corrupt'), xlsx({ date1904: true }), xlsx({ column: 'ZZZZZZ' })]) {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'permit-workbook-'));
    try {
      const result = await readPermitCity(city, httpFor(bytes), { day: '2026-10-04', dir });
      assert.equal(result.failed, 1);
      assert.equal(result.incomplete, true);
      assert.deepEqual(result.boards, {});
      assert.deepEqual(await readdir(dir), []);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
});
