// scripts/lib/cartdsArchive.test.mjs
// The sweep and the store against a fake board: sessions, robots.txt, retries,
// files. No request leaves the process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import {
  cartdsRobotsVerdict,
  cartdsSweepDue,
  createCartdsArchiveStore,
  readCartdsBoard,
  readCartdsSweepStamp,
  sweepCartdsArchive,
  trustCartdsIntermediates,
  writeCartdsSweepStamp,
  CARTDS_INTERMEDIATES,
} from './cartdsArchive.mjs';
import { CARTDS_INSTANCES } from '../../src/data/cartdsFeed.js';

const OPEN = Object.freeze({
  key: 'open', base: 'https://open.example/guichet-unique', label: 'Open — affichage réglementaire',
  codes: 'number', communes: Object.freeze(['13114', '13113']),
});
const SHUT = Object.freeze({
  key: 'shut', base: 'https://shut.example/guichet-unique', label: 'Shut — affichage réglementaire',
  codes: 'number', communes: Object.freeze(['50129']),
});
const OVERRIDDEN = Object.freeze({ ...SHUT, key: 'overridden', robots: 'overridden' });

const ROW = (dossier, applicant = 'DUPONT Jean') => [
  '29/09/2026', dossier, '28/09/2026', applicant, '3 Chemin des Nourades 13122  (AT 852)', '2000 m²', '', '',
];

/**
 * A fake set of instances. `boards[host][commune][board]` is the rows; a
 * session is valid until `expireAfter` table requests have been made on it.
 */
function fakeHttp({ robots = {}, boards = {}, expireAfter = Infinity } = {}) {
  const calls = [];
  let sessions = 0;
  const live = new Map();
  const response = (status, body, cookie) => ({
    ok: status >= 200 && status < 300,
    status,
    body,
    headers: { getSetCookie: () => (cookie ? [`${cookie}; path=/; HttpOnly`] : []) },
  });
  return {
    calls,
    async fetch(url, init = {}) {
      const { host, pathname } = new URL(url);
      calls.push(`${init.method || 'GET'} ${host}${pathname}`);
      if (pathname === '/robots.txt') {
        const answer = robots[host];
        if (answer === null) return null;
        return answer ? response(200, answer) : response(404, 'no');
      }
      if (pathname.endsWith('/Login/AffichageReglementaire')) {
        sessions += 1;
        const cookie = `.AspNetCore.Antiforgery=c${sessions}`;
        live.set(cookie, 0);
        return response(200, `<input name="__RequestVerificationToken" type="hidden" value="t${sessions}" />`, cookie);
      }
      if (pathname.endsWith('/Login/GetRapportDossier')) {
        const cookie = init.headers?.Cookie;
        const used = live.get(cookie);
        if (used === undefined || used >= expireAfter) return response(200, '<html>error</html>');
        live.set(cookie, used + 1);
        const form = new URLSearchParams(init.body);
        const rows = boards[host]?.[form.get('NCommune')]?.[form.get('TypeInformation')];
        if (rows === null) return response(500, 'boom');
        return response(200, JSON.stringify({ recordsTotal: (rows || []).length, data: rows || [] }));
      }
      return response(404, '');
    },
    async text(res) { return res.body; },
  };
}

async function tempDir() {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'cartds-archive-'));
}

test('robots.txt: a refusal is final, an unreachable host is not, an override asks nothing', async () => {
  const http = fakeHttp({
    robots: { 'shut.example': 'User-agent: *\nDisallow: /', 'open.example': 'User-agent: *\nDisallow: /admin' },
  });
  assert.deepEqual(await cartdsRobotsVerdict(SHUT, http), { allowed: false, final: true });
  assert.deepEqual(await cartdsRobotsVerdict(OPEN, http), { allowed: true, final: true });
  assert.deepEqual(await cartdsRobotsVerdict({ ...OPEN, base: 'https://none.example/g' }, http),
    { allowed: true, final: true });
  const calls = http.calls.length;
  assert.deepEqual(await cartdsRobotsVerdict(OVERRIDDEN, http), { allowed: true, final: true, overridden: true });
  assert.equal(http.calls.length, calls);
  const down = fakeHttp({ robots: { 'open.example': null } });
  assert.deepEqual(await cartdsRobotsVerdict(OPEN, down), { allowed: false, final: false });
});

test('the sweep reads every open board into the archive, one session per instance', async () => {
  const dir = await tempDir();
  const store = createCartdsArchiveStore(dir);
  const http = fakeHttp({
    robots: { 'shut.example': 'User-agent: *\nDisallow: /' },
    boards: {
      'open.example': {
        114: { 1: [ROW('DP 013 114 26 00167')], 2: [ROW('PC 013 114 26 00040', 'SCI LES OLIVIERS')] },
        113: { 1: [ROW('IA 013 113 26 00001')], 2: [] },
      },
      'shut.example': { 129: { 1: [ROW('DP 050 129 26 00001')], 2: [] } },
    },
  });
  const summary = await sweepCartdsArchive({
    instances: [OPEN, SHUT], store, http, day: '2026-09-30', pauseMs: 0, log: {},
  });
  assert.equal(summary.communes, 3);
  assert.equal(summary.read, 2);
  assert.equal(summary.added, 2);
  assert.deepEqual(summary.refused, ['shut']);
  assert.deepEqual(summary.failed, []);
  assert.equal(http.calls.filter((call) => call.endsWith('AffichageReglementaire')).length, 1);
  assert.ok(!http.calls.some((call) => call.includes('shut.example/guichet')));

  const stored = JSON.parse(await fsp.readFile(path.join(dir, '13114.json'), 'utf8'));
  assert.equal(stored.rows.length, 2);
  // A person's name never reaches the disk; an organisation's does.
  assert.equal(stored.rows[0].cells[3], null);
  assert.equal(stored.rows[1].cells[3], 'SCI LES OLIVIERS');
  // A commune that posted only a sale has an archive with nothing in it.
  const onlySale = JSON.parse(await fsp.readFile(path.join(dir, '13113.json'), 'utf8'));
  assert.equal(onlySale.rows.length, 0);
  assert.ok(!JSON.stringify(stored).includes('DUPONT'));

  // The override reads a host whose robots.txt refuses.
  const again = await sweepCartdsArchive({
    instances: [OVERRIDDEN], store, http, day: '2026-09-30', pauseMs: 0, log: {},
  });
  assert.equal(again.read, 1);
  assert.deepEqual(again.refused, []);
});

test('a lapsed session is reopened once; a board that keeps failing is left for tomorrow', async () => {
  const dir = await tempDir();
  const store = createCartdsArchiveStore(dir);
  const boards = {
    'open.example': {
      114: { 1: [ROW('DP 013 114 26 00167')], 2: [] },
      113: { 1: [ROW('DP 013 113 26 00002')], 2: [] },
    },
  };
  // Two table requests per session: the second commune needs a new one.
  const lapsing = fakeHttp({ boards, expireAfter: 2 });
  const summary = await sweepCartdsArchive({
    instances: [OPEN], store, http: lapsing, day: '2026-09-30', pauseMs: 0, log: {},
  });
  assert.equal(summary.read, 2);
  assert.equal(lapsing.calls.filter((call) => call.endsWith('AffichageReglementaire')).length, 2);

  const broken = fakeHttp({ boards: { 'open.example': { ...boards['open.example'], 113: { 1: [], 2: null } } } });
  const partial = await sweepCartdsArchive({
    instances: [OPEN], store, http: broken, day: '2026-10-01', pauseMs: 0, log: {},
  });
  assert.equal(partial.read, 1);
  assert.deepEqual(partial.failed, ['13113']);
  // The failed commune keeps what it had.
  const kept = JSON.parse(await fsp.readFile(path.join(dir, '13113.json'), 'utf8'));
  assert.equal(kept.lastDay, '2026-09-30');
});

test('the pause runs before every request of the sweep', async () => {
  const dir = await tempDir();
  const waits = [];
  const http = fakeHttp({ boards: { 'open.example': { 114: { 1: [], 2: [] }, 113: { 1: [], 2: [] } } } });
  await sweepCartdsArchive({
    instances: [OPEN], store: createCartdsArchiveStore(dir), http, day: '2026-09-30',
    pauseMs: 1000, sleep: async (ms) => { waits.push(ms); }, log: {},
  });
  // robots.txt is asked through the caller's own verdict, unpaced here; the
  // page and four table requests are paced.
  assert.equal(waits.length, http.calls.length - 1);
  assert.ok(waits.every((ms) => ms === 1000));
});

test('the store queues writes to one commune and sets an unreadable file aside', async () => {
  const dir = await tempDir();
  const store = createCartdsArchiveStore(dir, { warn: () => {} });
  const boards = (dossier) => ({ 1: [ROW(dossier)], 2: [] });
  await Promise.all([
    store.record(OPEN, '13114', boards('DP 013 114 26 00001'), '2026-09-30'),
    store.record(OPEN, '13114', boards('DP 013 114 26 00002'), '2026-09-30'),
    store.record(OPEN, '13114', boards('DP 013 114 26 00003'), '2026-09-30'),
  ]);
  assert.equal((await store.load(OPEN, '13114')).archive.rows.length, 3);

  await fsp.writeFile(path.join(dir, '13113.json'), '{ half a file');
  const answer = await store.record(OPEN, '13113', boards('DP 013 113 26 00001'), '2026-09-30');
  assert.equal(answer.saved, true);
  const names = await fsp.readdir(dir);
  assert.ok(names.some((name) => name.startsWith('13113.json.unreadable-')), names.join(' '));
  assert.equal((await store.load(OPEN, '13113')).archive.rows.length, 1);
});

test('a sweep is due once per French calendar day', async () => {
  const dir = await tempDir();
  assert.equal(await readCartdsSweepStamp(dir), null);
  assert.equal(cartdsSweepDue(null, '2026-09-30'), true);
  await writeCartdsSweepStamp(dir, { day: '2026-09-30', read: 129 });
  const stamp = await readCartdsSweepStamp(dir);
  assert.equal(cartdsSweepDue(stamp, '2026-09-30'), false);
  assert.equal(cartdsSweepDue(stamp, '2026-10-01'), true);
  assert.equal(cartdsSweepDue({ read: 3 }, '2026-10-01'), true);
});

test('every intermediate an instance names is a CA signed by a root Node ships', () => {
  const roots = tls.rootCertificates.map((pem) => new X509Certificate(pem));
  const named = new Set(CARTDS_INSTANCES.map((instance) => instance.intermediate).filter(Boolean));
  assert.deepEqual([...named], ['sectigo-dv-r36']);
  for (const name of named) {
    const certificate = new X509Certificate(CARTDS_INTERMEDIATES[name]);
    assert.ok(certificate.ca, name);
    // Not a root itself: the chain must still end at one Node trusts.
    assert.notEqual(certificate.subject, certificate.issuer, name);
    const root = roots.find((candidate) => candidate.subject === certificate.issuer);
    assert.ok(root && certificate.checkIssued(root) && certificate.verify(root.publicKey), name);
    assert.ok(new Date(certificate.validTo) > new Date('2030-01-01'), name);
  }
});

test('the intermediates are added to the default CA list once, after what is already there', () => {
  const intermediate = CARTDS_INTERMEDIATES['sectigo-dv-r36'];
  let list = [tls.rootCertificates[0], tls.rootCertificates[1]];
  let sets = 0;
  const tlsApi = {
    getCACertificates: (which) => { assert.equal(which, 'default'); return [...list]; },
    setDefaultCACertificates: (certificates) => { sets += 1; list = [...certificates]; },
  };
  const incomplete = CARTDS_INSTANCES.filter((instance) => instance.intermediate);
  assert.deepEqual(incomplete.map((instance) => new URL(instance.base).host.split('.').slice(-2).join('.')),
    ['lecotentin.fr', 'pemb.fr', 'pemb.fr', 'pemb.fr', 'pemb.fr']);
  assert.deepEqual(trustCartdsIntermediates(CARTDS_INSTANCES, tlsApi), ['sectigo-dv-r36']);
  assert.deepEqual(list, [tls.rootCertificates[0], tls.rootCertificates[1], intermediate]);
  // A second server start in the same process adds nothing.
  assert.deepEqual(trustCartdsIntermediates(CARTDS_INSTANCES, tlsApi), []);
  assert.equal(sets, 1);
  // Instances that need none leave the list alone.
  assert.deepEqual(trustCartdsIntermediates([OPEN, SHUT], tlsApi), []);
  assert.equal(sets, 1);
});

test('a board\'s POST names the page it comes from, as the page\'s own form does', async () => {
  const seen = [];
  const http = {
    async fetch(url, init = {}) {
      seen.push(init.headers ?? {});
      // A front that refuses a POST from nowhere, as Grand Reims's does.
      const ok = init.headers?.Referer === 'https://open.example/guichet-unique/Login/AffichageReglementaire'
        && init.headers?.Origin === 'https://open.example';
      return ok
        ? { ok: true, status: 200, body: JSON.stringify({ recordsTotal: 1, data: [ROW('DP 013 114 26 00167')] }) }
        : { ok: false, status: 403, body: 'Forbidden' };
    },
    async text(res) { return res.body; },
  };
  const answer = await readCartdsBoard(OPEN, '114', '1', { token: 't', cookie: 'c=1' }, http);
  assert.equal(answer.rows.length, 1);
  assert.equal(seen[0]['User-Agent'], undefined, 'the caller\'s user agent is left alone');
});
