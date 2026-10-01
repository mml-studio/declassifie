// src/data/cctvPacks.test.mjs — one JSON file adds one city's cameras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { useTestLocale } from '../i18n/testing.js';
import {
  CCTV_PACK_DEFAULT_MAX,
  CCTV_PACK_HARD_MAX,
  cctvPackCreditHtml,
  cctvPackEnabled,
  isPublicFrameUrl,
  parseCctvPack,
} from './cctvPacks.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const PACK = {
  id: 'rennes-trafic',
  name: 'Rennes Métropole — traffic cameras',
  credit: {
    text: 'Rennes Métropole',
    url: 'https://data.rennesmetropole.fr',
    license: 'Licence Ouverte 2.0',
    licenseUrl: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence',
  },
  defaults: { city: 'Rennes', cityId: 'rennes', pitchDeg: -20, fovDeg: 60, rangeM: 200, mountHeightM: 8 },
  cameras: [
    { id: 'gare', name: 'Gare', lat: 48.1035, lon: -1.6723, headingDeg: 12, snapshotUrl: 'https://example.org/gare.jpg' },
    { id: 'rennes-trafic-mail', name: 'Mail', lat: 48.11, lon: -1.69, url: 'https://example.org/mail.jpg', pitchDeg: -30 },
  ],
};

test('a pack becomes raw sources: ids namespaced once, defaults filled, credit carried', () => {
  const parsed = parseCctvPack(PACK);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.pack.id, 'rennes-trafic');
  assert.deepEqual(parsed.rejected, []);
  const [gare, mail] = parsed.cameras;
  assert.equal(gare.id, 'rennes-trafic-gare');
  assert.equal(mail.id, 'rennes-trafic-mail', 'an id already carrying the pack id is kept');
  assert.equal(gare.city, 'Rennes');
  assert.equal(gare.pitchDeg, -20, 'a default fills a field the camera leaves out');
  assert.equal(mail.pitchDeg, -30, 'the camera wins over the default');
  assert.equal(gare.url, 'https://example.org/gare.jpg', 'a snapshot-only camera is served from its snapshot');
  assert.equal(gare.provider, 'Rennes Métropole');
  assert.equal(gare.license, 'Licence Ouverte 2.0');
  assert.equal(gare.sourceKind, 'pack');
  assert.equal(gare.packId, 'rennes-trafic');
  assert.deepEqual(gare.credit, PACK.credit);
});

test('upstream\'s bare camera arrays load, the file name giving the pack id', () => {
  const upstream = [{
    id: 'warendorf-marktplatz-rathaus',
    name: 'Marktplatz / Historisches Rathaus',
    provider: 'Stadt Warendorf',
    feedType: 'image',
    url: 'http://webcam.warendorf.de/image/jpeg.cgi',
    lat: 51.9526613,
    lon: 7.9908867,
    poseSource: 'curated',
  }];
  const parsed = parseCctvPack(upstream, { fileName: 'cctv_sources.warendorf.json' });
  assert.equal(parsed.pack.id, 'warendorf');
  assert.equal(parsed.cameras[0].id, 'warendorf-marktplatz-rathaus');
  assert.equal(parsed.cameras[0].provider, 'Stadt Warendorf');
  assert.equal(parsed.cameras[0].poseSource, 'curated');
  assert.equal(parsed.pack.credit.text, 'Stadt Warendorf', 'the first camera\'s provider credits the pack');
  assert.match(cctvPackCreditHtml(parsed.pack.credit), /: Stadt Warendorf$/);
});

test('a bad camera is rejected with its reason and the rest of the pack loads', () => {
  const parsed = parseCctvPack({
    ...PACK,
    cameras: [
      ...PACK.cameras,
      { id: 'no-coords', snapshotUrl: 'https://example.org/a.jpg' },
      { id: 'inward', lat: 48, lon: -1, url: 'http://192.168.1.20/cam.jpg' },
      { id: 'file', lat: 48, lon: -1, url: 'file:///etc/passwd' },
      { id: 'gare', lat: 48, lon: -1, url: 'https://example.org/b.jpg' },
      { id: 'weird', lat: 48, lon: -1, url: 'https://example.org/c', feedType: 'rtsp' },
      { id: 'bad id!', lat: 48, lon: -1, url: 'https://example.org/d.jpg' },
    ],
  });
  assert.equal(parsed.cameras.length, 2);
  assert.deepEqual(parsed.rejected.map((entry) => entry.index), [2, 3, 4, 5, 6, 7]);
  assert.match(parsed.rejected[0].reason, /lat\/lon/);
  assert.match(parsed.rejected[1].reason, /public http\(s\)/);
  assert.match(parsed.rejected[3].reason, /repeats/);
  assert.match(parsed.rejected[4].reason, /feedType/);
});

test('a pack without an id or a cameras array is refused whole', () => {
  assert.match(parseCctvPack({ cameras: [] }).error, /pack id/);
  assert.match(parseCctvPack({ id: 'Bad Id', cameras: [] }).error, /pack id/);
  assert.match(parseCctvPack({ id: 'ok-id' }).error, /cameras array/);
  assert.match(parseCctvPack(null).error, /not a pack/);
});

test('a pack keeps at most its declared count, never above the hard ceiling', () => {
  const many = Array.from({ length: CCTV_PACK_HARD_MAX + 5 }, (_, i) => ({
    id: `c${i}`, lat: 48, lon: -1, url: `https://example.org/${i}.jpg`,
  }));
  assert.equal(parseCctvPack({ id: 'big', cameras: many }).cameras.length, CCTV_PACK_DEFAULT_MAX);
  assert.equal(parseCctvPack({ id: 'big', maxCameras: 3, cameras: many }).cameras.length, 3);
  assert.equal(parseCctvPack({ id: 'big', maxCameras: 10_000, cameras: many }).cameras.length, CCTV_PACK_HARD_MAX);
});

test('frame URLs must be public http(s)', () => {
  for (const good of ['https://example.org/a.jpg', 'http://webcam.warendorf.de/image/jpeg.cgi', 'https://fcbarcelona.com/cam', 'https://172.15.0.1/x']) {
    assert.equal(isPublicFrameUrl(good), true, good);
  }
  for (const bad of [
    '', 'ftp://example.org/a', 'file:///etc/passwd', 'https://user:pw@example.org/a',
    'http://localhost:5173/a', 'http://cam.local/a', 'http://127.0.0.1/a', 'http://10.0.0.4/a',
    'http://172.16.0.1/a', 'http://192.168.0.2/a', 'http://169.254.169.254/latest', 'http://100.64.0.1/a',
    'http://0.0.0.0/a', 'http://[::1]/a', 'http://[fd00::1]/a', 'http://[fe80::1]/a', 'http://[::ffff:127.0.0.1]/a',
  ]) {
    assert.equal(isPublicFrameUrl(bad), false, bad);
  }
});

test('a pack loads unless its file, CCTV_PACKS_DISABLED or CCTV_PACKS_ENABLED=0 turns it off', () => {
  const pack = { id: 'rennes-trafic', enabled: true };
  assert.equal(cctvPackEnabled(pack, {}), true);
  assert.equal(cctvPackEnabled({ ...pack, enabled: false }, {}), false);
  assert.equal(cctvPackEnabled(pack, { CCTV_PACKS_DISABLED: 'other, rennes-trafic' }), false);
  assert.equal(cctvPackEnabled(pack, { CCTV_PACKS_DISABLED: 'other' }), true);
  assert.equal(cctvPackEnabled(pack, { CCTV_PACKS_ENABLED: '0' }), false);
});

test('the credit names the publisher and licence, linked, escaped, in the reader\'s language', () => {
  assert.equal(
    cctvPackCreditHtml(PACK.credit, 'Rennes'),
    'Caméras publiques et images (Rennes): '
      + '<a href="https://data.rennesmetropole.fr" target="_blank" rel="noopener">Rennes Métropole</a> '
      + '(<a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence" target="_blank" rel="noopener">Licence Ouverte 2.0</a>)',
  );
  const restore = useTestLocale('en');
  try {
    assert.match(cctvPackCreditHtml({ text: 'A <b>' }), /^Public cameras and frames: A &lt;b&gt;$/);
  } finally {
    restore();
  }
  assert.equal(cctvPackCreditHtml({ text: '' }), '');
  const parsed = parseCctvPack({ id: 'x-pack', credit: { text: 'X', url: 'javascript:alert(1)' }, cameras: [] });
  assert.equal(parsed.pack.credit.url, '', 'a non-http link is dropped');
});

test('the shipped pack folder parses: every file is a valid pack', () => {
  const dir = path.join(ROOT, 'config', 'cctv-packs');
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
  for (const name of files) {
    const parsed = parseCctvPack(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')), { fileName: name });
    assert.equal(parsed.error, undefined, `${name}: ${parsed.error}`);
    assert.deepEqual(parsed.rejected, [], `${name} rejects cameras`);
  }
  assert.ok(fs.existsSync(path.join(dir, 'README.md')), 'the folder documents its format');
});

test('the server adds packs to the live catalog and serves their credit', () => {
  const config = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8');
  const refresh = config.slice(config.indexOf('async function refreshCctvSources('));
  assert.match(refresh, /const fromPacks = loadSourcesFromPacks\(\);/);
  assert.match(refresh, /\.\.\.fromLyon, \.\.\.fromPacks, \.\.\.fromFile, \.\.\.fromEnv\]/);
  const needsLive = refresh.slice(0, refresh.indexOf('const merged'));
  assert.doesNotMatch(needsLive.slice(needsLive.indexOf('const needsLiveSources')), /fromPacks/,
    'a pack must not switch the live packs off the way CCTV_SOURCES_FILE does');
  assert.match(config, /packId: source\.packId,\n\s+credit: source\.credit,/);
});
