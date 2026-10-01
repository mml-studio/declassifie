// scripts/lib/sirapBoards.test.mjs
// The PU reader and its daily sweep against a fake host: robots.txt, boards,
// files. No request leaves the process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readSirapBoard,
  readSirapCommune,
  sirapRobotsVerdict,
  sweepSirapArchive,
} from './sirapBoards.mjs';
import { createCartdsArchiveStore } from './cartdsArchive.mjs';
import { SIRAP_ROWS } from '../../src/data/sirapFeed.js';

const DUNKERQUE = Object.freeze({
  key: 'dk', base: 'https://dk.example', label: 'Dk — affichage réglementaire',
  communes: Object.freeze(['59183', '59016']),
  associated: Object.freeze({ 59183: Object.freeze(['59248']) }),
});
const SHUT = Object.freeze({
  key: 'shut', base: 'https://shut.example', label: 'Shut — affichage réglementaire',
  communes: Object.freeze(['06004']),
});

const ROW = (numero, demandeur = 'DUPONT Jean') => ({
  id: 1, idCommune: 2, idDossier: 3, type: 'DPC', numeroAds: numero,
  dateDepot: '2026-09-01T00:00:00.000Z', demandeur, superficie: 100,
  adresse: '1 Rue des Exemples 59140 Dunkerque', parcelles: '183000AB0012',
  travauxNature: 'Clôture', descriptionTravaux: 'Pose d’une clôture',
  decision: null, dateDecision: null, architecte: 'MARTIN Paul',
});

/** `boards[host][six-digit code]` is the rows, `null` a failure. */
function fakeHttp({ robots = {}, boards = {} } = {}) {
  const calls = [];
  const response = (status, body, type = 'application/json') => ({
    ok: status >= 200 && status < 300,
    status,
    body,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) },
  });
  return {
    calls,
    async fetch(url) {
      const { host, pathname } = new URL(url);
      calls.push(`${host}${pathname}`);
      if (pathname === '/robots.txt') {
        const answer = robots[host];
        if (answer === null) return null;
        if (answer === undefined) return response(200, '<!DOCTYPE html><title>PU</title>', 'text/html; charset=utf-8');
        return response(200, answer, 'text/plain');
      }
      const match = /^\/api\/v1\/communes\/(\w{6})\/affichage-reglementaire$/.exec(pathname);
      if (!match) return response(404, '');
      const rows = boards[host]?.[match[1]];
      if (rows === null) return response(502, 'bad gateway', 'text/html');
      if (rows === undefined) return response(400, '{"message":"Impossible de trouver la commune"}');
      return response(200, JSON.stringify(rows));
    },
    async text(res) { return res.body; },
  };
}

test('robots.txt: the app answering every path is no file; a rule is a rule', async () => {
  const http = fakeHttp({ robots: { 'shut.example': 'User-agent: *\nDisallow: /api/' } });
  assert.deepEqual(await sirapRobotsVerdict(DUNKERQUE, http), { allowed: true, final: true });
  assert.deepEqual(await sirapRobotsVerdict(SHUT, http), { allowed: false, final: true });
  assert.deepEqual(await sirapRobotsVerdict(SHUT, fakeHttp({ robots: { 'shut.example': null } })), {
    allowed: false, final: false,
  });
});

test('a board is its array; an error object or a failed request is null, never []', async () => {
  const http = fakeHttp({ boards: { 'dk.example': { '059183': [ROW('DP0591832600001')], '059016': [] } } });
  assert.equal((await readSirapBoard(DUNKERQUE, '59183', http)).length, 1);
  assert.deepEqual(await readSirapBoard(DUNKERQUE, '59016', http), []);
  assert.equal(await readSirapBoard(DUNKERQUE, '59999', http), null);
  assert.ok(http.calls.includes('dk.example/api/v1/communes/059183/affichage-reglementaire'));
});

test('Dunkerque is read with the boards it absorbed, or not at all', async () => {
  const boards = { '059183': [ROW('DP0591832600001')], '059248': [ROW('DP0592482600002')] };
  const answer = await readSirapCommune(DUNKERQUE, '59183', fakeHttp({ boards: { 'dk.example': boards } }));
  assert.deepEqual(Object.keys(answer.boards).sort(), ['59183', '59248']);
  const broken = { ...boards, '059248': null };
  assert.equal(await readSirapCommune(DUNKERQUE, '59183', fakeHttp({ boards: { 'dk.example': broken } })), null);
});

test('the sweep reads every open board into the archive and names what failed', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'sirap-sweep-'));
  try {
    const store = createCartdsArchiveStore(dir, { warn() {} }, SIRAP_ROWS);
    const http = fakeHttp({
      robots: { 'shut.example': 'User-agent: *\nDisallow: /' },
      boards: {
        'dk.example': {
          '059183': [ROW('DP0591832600001'), ROW('PC0591832600002', 'SCI DES EXEMPLES')],
          '059248': [ROW('DP0592482600003')],
          '059016': null,
        },
      },
    });
    const slept = [];
    const summary = await sweepSirapArchive({
      instances: [DUNKERQUE, SHUT], store, http, day: '2026-10-01',
      pauseMs: 5, sleep: async (ms) => { slept.push(ms); }, log: {},
    });
    assert.equal(summary.communes, 3);
    assert.equal(summary.read, 1);
    assert.equal(summary.added, 3);
    assert.deepEqual(summary.failed, ['59016']);
    assert.deepEqual(summary.refused, ['shut']);
    // One pause before every request but the robots.txt the verdict asked.
    assert.equal(slept.length, http.calls.filter((call) => !call.endsWith('/robots.txt')).length);

    const file = JSON.parse(await fsp.readFile(path.join(dir, '59183.json'), 'utf8'));
    assert.equal(file.rows.length, 3);
    const text = JSON.stringify(file);
    assert.ok(!text.includes('DUPONT'), 'a person never reaches the disk');
    assert.ok(!text.includes('MARTIN'), 'nor an architect');
    assert.ok(text.includes('SCI DES EXEMPLES'));
    // The Cart@DS reader of the same store refuses these boards.
    const cartds = createCartdsArchiveStore(dir, { warn() {} });
    assert.equal((await cartds.load(DUNKERQUE, '59183')).archive.rows.length, 0);
    assert.equal((await store.load(DUNKERQUE, '59183')).archive.rows.length, 3);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});
