// scripts/lib/epermisBoards.test.mjs
// The e-permis reader and its daily sweep against a fake clicmap: the page,
// its script, the token server, the configuration, the two lists, files. No
// request leaves the process; every name and secret is invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createEpermisReader,
  epermisRobotsVerdict,
  readEpermisByDay,
  sweepEpermisArchive,
} from './epermisBoards.mjs';
import { createCartdsArchiveStore } from './cartdsArchive.mjs';
import { EPERMIS_ROWS } from '../../src/data/epermisFeed.js';

const NICE = Object.freeze({
  key: 'nice', client: 123, label: 'Nice — affichage réglementaire',
  communes: Object.freeze(['06088', '06147']),
});

const SECRET = 'invented-secret-0001';
const PAGE = '<!DOCTYPE html><title>Affichage</title><script type="module" crossorigin src="/assets/index-Ab12_c.js"></script>';
const SCRIPT = (secret = SECRET) => 'x=1;mC=async()=>{const e="https://auth.clicmap.fr/oauth2/token",'
  + `t="rp-example-public",n="${secret}",r=new URLSearchParams;r.append("grant_type","client_credentials"),`
  + 'r.append("client_id",t),r.append("client_secret",n),r.append("scope","openid")}';

const FILING = (reference, applicant = 'DUPONT Jean') => ({
  REFERENCE: reference, BIE_ADRESSE: '1 Rue des Exemples', BIE_CAD_T: 'AB0012',
  dos_dnm_t: applicant, architecte: 'MARTIN Paul', nature: 'Clôture', surf_cc: '0',
  surface_terrain: '300', date_demande: '25/09/2026', date_affichage: null, srt_3: '2026-09-25',
  decision: null, dt_decision: null, event_id: 1, type_dossier: 'Déclaration préalable de travaux',
});
const DECISION = (reference) => ({
  REFERENCE: reference, BIE_ADRESSE: '2 Rue des Exemples', BIE_CAD_T: '0A0001',
  dos_dnm_t: 'SCI DES EXEMPLES', architecte: null, nature: 'Maison', surf_cc: '120',
  surface_terrain: '800', date_depot: '01/07/2026', date_decision: '20/09/2026', srt_3: '2026-09-20',
  decision: 'Accord', type_evt: 'decision', event_id: 2, type_dossier: 'Permis de construire',
});

/**
 * A fake clicmap. `lists[board](query)` answers the rows of one window (all
 * pages; the fake pages them by 100), `null` for a failure.
 */
function fakeClicmap({
  robots = {}, page = PAGE, script = SCRIPT(), secrets = [SECRET], lists = {}, expiresIn = 3600,
  unauthorisedOnce = false,
} = {}) {
  const calls = [];
  let issued = 0;
  let refused = unauthorisedOnce;
  const tokens = new Set();
  const response = (status, body, type = 'application/json') => ({
    ok: status >= 200 && status < 300,
    status,
    body,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) },
  });
  return {
    calls,
    get issued() { return issued; },
    set script(value) { script = value; },
    async fetch(url, init = {}) {
      const { host, pathname, searchParams } = new URL(url);
      const headers = init.headers || {};
      calls.push({ host, pathname, search: searchParams.toString(), method: init.method || 'GET', headers, body: init.body });
      if (pathname === '/robots.txt') {
        const answer = robots[host];
        if (answer === null) return null;
        if (answer === undefined) return response(host === 'api-v2.clicmap.fr' ? 404 : 200, '<!doctype html>', 'text/html');
        return response(200, answer, 'text/plain');
      }
      if (host === 'affichage.e-permis.fr' && pathname === '/depot') return response(200, page, 'text/html');
      if (host === 'affichage.e-permis.fr' && pathname.startsWith('/assets/')) return response(200, script, 'text/javascript');
      if (host === 'auth.clicmap.fr' && pathname === '/oauth2/token') {
        const form = new URLSearchParams(init.body);
        if (!secrets.includes(form.get('client_secret'))) return response(401, '{"error":"invalid_client"}');
        issued += 1;
        const token = `token-${issued}`;
        tokens.add(token);
        return response(200, JSON.stringify({ token_type: 'Bearer', access_token: token, expires_in: expiresIn }));
      }
      if (host !== 'api-v2.clicmap.fr') return response(404, '');
      const token = String(headers.Authorization || '').replace(/^Bearer /, '');
      if (!tokens.has(token)) return response(401, '<title>401</title>', 'text/html');
      if (pathname === '/ads/exports/config') {
        return response(200, JSON.stringify({
          success: true, data: { id_client: 123, name_client: 'Nice', codes_insee: [6088, 6147], env_id: 4142 },
        }));
      }
      const board = pathname.split('/').pop();
      if (headers.Env !== '4142') return response(500, '{"status":500}');
      if (refused) { refused = false; tokens.clear(); return response(401, '<title>401</title>', 'text/html'); }
      const rows = lists[board] ? lists[board]({ from: searchParams.get('date_min'), to: searchParams.get('date_max') }) : [];
      if (rows === null) return response(500, '{"status":500}');
      const at = Number(searchParams.get('page'));
      const slice = rows.slice((at - 1) * 100, at * 100);
      return response(200, JSON.stringify({ success: true, data: slice, pagination: { current_page: String(at), items_per_page: slice.length } }));
    },
    async text(res) { return res.body; },
  };
}

const quiet = { warn() {}, log() {} };
const noSleep = async () => {};

test('robots.txt: an app page or a 404 is no file; a rule on the API is obeyed', async () => {
  assert.deepEqual(await epermisRobotsVerdict(NICE, fakeClicmap()), { allowed: true, final: true });
  const shut = fakeClicmap({ robots: { 'api-v2.clicmap.fr': 'User-agent: *\nDisallow: /ads/' } });
  assert.deepEqual(await epermisRobotsVerdict(NICE, shut), { allowed: false, final: true });
  const open = fakeClicmap({ robots: { 'api-v2.clicmap.fr': 'User-agent: *\nDisallow: /admin/' } });
  assert.deepEqual(await epermisRobotsVerdict(NICE, open), { allowed: true, final: true });
  assert.deepEqual(await epermisRobotsVerdict(NICE, fakeClicmap({ robots: { 'auth.clicmap.fr': null } })), {
    allowed: false, final: false,
  });
});

test('the reader finds the client, asks a token once, and pages every list to its end', async () => {
  const filings = Array.from({ length: 230 }, (_, i) => FILING(`DP00608826${String(i).padStart(5, '0')}`));
  const http = fakeClicmap({ lists: { depots: () => filings, decisions: () => [DECISION('PC0061472690021')] } });
  const slept = [];
  let clock = 1_000_000;
  const reader = createEpermisReader(NICE, http, {
    now: () => clock, pauseMs: 500, sleep: async (ms) => { slept.push(ms); clock += ms; }, log: quiet,
  });
  const answer = await reader.readWindow({ from: '2026-07-31', to: '2026-10-01' });
  assert.equal(answer.boards.depots.length, 230);
  assert.equal(answer.boards.decisions.length, 1);
  assert.equal(answer.truncated, false);
  assert.deepEqual(http.calls.map((call) => `${call.method} ${call.host}${call.pathname}`), [
    'GET affichage.e-permis.fr/depot',
    'GET affichage.e-permis.fr/assets/index-Ab12_c.js',
    'POST auth.clicmap.fr/oauth2/token',
    'GET api-v2.clicmap.fr/ads/exports/config',
    'GET api-v2.clicmap.fr/ads/exports/depots',
    'GET api-v2.clicmap.fr/ads/exports/depots',
    'GET api-v2.clicmap.fr/ads/exports/depots',
    'GET api-v2.clicmap.fr/ads/exports/decisions',
  ]);
  const list = http.calls[4];
  assert.equal(list.search, 'page=1&json=true&date_min=31-07-2026&date_max=01-10-2026');
  assert.equal(list.headers.Authorization, 'Bearer token-1');
  assert.equal(list.headers.Env, '4142');
  assert.equal(new URLSearchParams(http.calls[2].body).get('client_secret'), SECRET);
  // One request at a time, half a second after the last answer.
  assert.equal(slept.length, http.calls.length - 1);
  assert.ok(slept.every((ms) => ms === 500));
  assert.equal(reader.config.envId, '4142');

  // The token is reused while it lasts, and renewed — without the page — after.
  await reader.readList('decisions', { from: '2026-09-01', to: '2026-09-30' });
  assert.equal(http.issued, 1);
  clock += 3_600_000;
  await reader.readList('decisions', { from: '2026-09-01', to: '2026-09-30' });
  assert.equal(http.issued, 2);
  assert.equal(http.calls.filter((call) => call.pathname === '/depot').length, 1);
});

test('a 401 re-reads the page’s script for the client and asks once more', async () => {
  const http = fakeClicmap({ unauthorisedOnce: true, lists: { depots: () => [FILING('DP0060882600001')], decisions: () => [] } });
  const reader = createEpermisReader(NICE, http, { pauseMs: 0, sleep: noSleep, log: quiet });
  const answer = await reader.readWindow({ from: '2026-09-01', to: '2026-09-30' });
  assert.equal(answer.boards.depots.length, 1);
  assert.equal(http.calls.filter((call) => call.pathname.startsWith('/assets/')).length, 2);
  assert.equal(http.issued, 2);
});

test('a script that no longer shows its client closes the source, said once, secret never logged', async () => {
  const warnings = [];
  const log = { warn: (line) => warnings.push(line) };
  const http = fakeClicmap({ script: 'console.log("rewritten")', lists: { depots: () => [], decisions: () => [] } });
  const reader = createEpermisReader(NICE, http, { pauseMs: 0, sleep: noSleep, log });
  assert.equal(await reader.readWindow({ from: '2026-09-01', to: '2026-09-30' }), null);
  assert.equal(await reader.readWindow({ from: '2026-09-01', to: '2026-09-30' }), null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /no longer shows the client/);
  assert.ok(!http.calls.some((call) => call.host === 'api-v2.clicmap.fr'), 'no list is asked without a token');

  // A rotated secret: the old one is refused, the script is read again next time.
  const rotated = fakeClicmap({ secrets: ['new-invented-secret'], lists: { depots: () => [], decisions: () => [] } });
  const second = createEpermisReader(NICE, rotated, { pauseMs: 0, sleep: noSleep, log });
  assert.equal(await second.readWindow({ from: '2026-09-01', to: '2026-09-30' }), null);
  rotated.script = SCRIPT('new-invented-secret');
  assert.ok(await second.readWindow({ from: '2026-09-01', to: '2026-09-30' }));
  assert.ok(warnings.every((line) => !line.includes(SECRET) && !line.includes('new-invented-secret')));
});

test('a commune the publisher adds is said once; one it lists and never posts for is not', async () => {
  const warnings = [];
  const log = { warn: (line) => warnings.push(line) };
  const lists = { depots: () => [], decisions: () => [] };
  const quietOne = Object.freeze({ ...NICE, communes: Object.freeze(['06088']), silent: Object.freeze(['06147']) });
  await createEpermisReader(quietOne, fakeClicmap({ lists }), { pauseMs: 0, sleep: noSleep, log }).readWindow({ from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(warnings, []);
  const short = Object.freeze({ ...NICE, communes: Object.freeze(['06088']) });
  const reader = createEpermisReader(short, fakeClicmap({ lists }), { pauseMs: 0, sleep: noSleep, log });
  await reader.readWindow({ from: '2026-09-01', to: '2026-09-30' });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /now lists 06147/);
});

test('both lists or none: a commune is never served without its decisions', async () => {
  const http = fakeClicmap({ lists: { depots: () => [FILING('DP0060882600001')], decisions: () => null } });
  const reader = createEpermisReader(NICE, http, { pauseMs: 0, sleep: noSleep, log: quiet });
  assert.equal(await reader.readWindow({ from: '2026-09-01', to: '2026-09-30' }), null);
});

test('a day the server cannot send is left out and named; an outage stops the walk', async () => {
  const iso = (day) => day.split('-').reverse().join('-');
  const poisoned = (query) => iso(query.from) <= '2026-07-15' && '2026-07-15' <= iso(query.to);
  const http = fakeClicmap({
    lists: {
      depots: () => [],
      decisions: (query) => (poisoned(query) ? null : (query.from === query.to && query.from === '14-07-2026' ? [DECISION('PC0060882600014')] : [])),
    },
  });
  const reader = createEpermisReader(NICE, http, { pauseMs: 0, sleep: noSleep, log: quiet });
  const july = await readEpermisByDay(reader, { from: '2026-07-01', to: '2026-07-30' });
  assert.deepEqual(july.skipped, ['decisions 2026-07-15']);
  assert.equal(july.boards.decisions.length, 1);
  assert.equal(july.boards.depots.length, 0);

  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'epermis-poison-'));
  try {
    const store = createCartdsArchiveStore(dir, quiet, EPERMIS_ROWS);
    const summary = await sweepEpermisArchive({
      instances: [NICE], store, readerFor: () => reader, robots: async () => ({ allowed: true }),
      day: '2026-10-01', log: quiet,
    });
    assert.deepEqual(summary.skipped, ['decisions 2026-07-15']);
    assert.equal(summary.history.nice, '2025-08-01', 'the walk went past the poisoned day');

    const down = fakeClicmap({ lists: { depots: () => [], decisions: (query) => (iso(query.to) < '2026-07-31' ? null : []) } });
    const stopped = await sweepEpermisArchive({
      instances: [NICE], store, readerFor: () => createEpermisReader(NICE, down, { pauseMs: 0, sleep: noSleep, log: quiet }),
      robots: async () => ({ allowed: true }), day: '2026-10-01', log: quiet,
    });
    assert.equal(stopped.history.nice, '2026-07-31', 'an outage is not skipped over');
    assert.equal(stopped.read, 2, 'the recent window is still recorded');
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('the sweep files every commune, walks history a year a day, and keeps no person', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'epermis-sweep-'));
  try {
    const store = createCartdsArchiveStore(dir, quiet, EPERMIS_ROWS);
    const windows = [];
    const http = fakeClicmap({
      lists: {
        depots: (query) => {
          windows.push(query);
          return query.to === '01-10-2026'
            ? [FILING('DP0060882600001'), FILING('DP0061472600002', 'SCI DES EXEMPLES'), FILING('DP0130552600003')]
            : [];
        },
        decisions: (query) => (query.from === '01-06-2026' ? [DECISION('PC0060882500009')] : []),
      },
    });
    const reader = createEpermisReader(NICE, http, { pauseMs: 0, sleep: noSleep, log: quiet });
    const summary = await sweepEpermisArchive({
      instances: [NICE], store, readerFor: () => reader, robots: async () => ({ allowed: true }),
      day: '2026-10-01', log: quiet,
    });
    assert.equal(summary.communes, 2);
    assert.equal(summary.read, 2);
    assert.equal(summary.added, 3);
    assert.equal(summary.unlisted, 1, 'a Marseille-area number is filed nowhere');
    assert.deepEqual(summary.failed, []);
    // The recent window, then twelve calendar months before it.
    assert.deepEqual(windows[0], { from: '31-07-2026', to: '01-10-2026' });
    assert.deepEqual(windows[1], { from: '01-07-2026', to: '30-07-2026' });
    assert.equal(windows.length, 13);
    assert.equal(summary.history.nice, '2025-08-01');

    const nice = JSON.parse(await fsp.readFile(path.join(dir, '06088.json'), 'utf8'));
    assert.deepEqual(nice.rows.map((row) => row.board).sort(), ['decisions', 'depots']);
    const text = JSON.stringify(nice) + await fsp.readFile(path.join(dir, '06147.json'), 'utf8');
    assert.ok(!text.includes('DUPONT'), 'a person never reaches the disk');
    assert.ok(!text.includes('MARTIN'), 'nor an architect');
    assert.ok(text.includes('SCI DES EXEMPLES'));

    // The next day resumes history where this one stopped; a failed month
    // stops the walk there, and the recent window is still recorded.
    windows.length = 0;
    const failing = fakeClicmap({
      lists: {
        // June 2025 is down, whole and day by day: an outage.
        depots: (query) => { windows.push(query); return query.from.endsWith('-06-2025') ? null : []; },
        decisions: () => [],
      },
    });
    const next = await sweepEpermisArchive({
      instances: [NICE], store,
      readerFor: () => createEpermisReader(NICE, failing, { pauseMs: 0, sleep: noSleep, log: quiet }),
      robots: async () => ({ allowed: true }), day: '2026-10-02', previous: summary, log: quiet,
    });
    assert.deepEqual(windows.slice(0, 3).map((query) => query.from), ['01-08-2026', '01-07-2025', '01-06-2025']);
    assert.equal(windows.length, 3 + 5, 'June a day at a time, until five list-days had failed');
    assert.equal(next.history.nice, '2025-07-01');
    assert.equal(next.read, 2);

    // A refusal leaves the archive and the history pointer alone.
    const refused = await sweepEpermisArchive({
      instances: [NICE], store, readerFor: () => reader, robots: async () => ({ allowed: false }),
      day: '2026-10-03', previous: next, log: quiet,
    });
    assert.deepEqual(refused.refused, ['nice']);
    assert.equal(refused.history.nice, '2025-07-01');
    assert.equal(refused.read, 0);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});
