// The rendering decisions: what a dot claims, and what a card is allowed to
// say when the register has nothing to say.
//
// The recurring property under test is the layer's central honesty rule: this
// register carries no identifier and no appointment book, so a card may report
// who is listed at an address and what they charge, and must never imply
// availability, a headcount, or a precision BAN did not return.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';

import medecinsFranceLayer, {
  APL_BINS,
  FAMILY_COLORS,
  MEDECINS_FR_LAYER_ID,
  MEDECINS_SITES_BAND,
  medecinsLevelAlphas,
  planMedecinsLevels,
  aplBin,
  boxKey,
  buildDepartementCard,
  buildSiteCard,
  createMedecinsLayer,
  medecinMarkPixelSize,
  selectLabelCohort,
  tariffLine,
} from './medecinsFrance.js';
import { MEDECIN_FAMILIES, MEDECINS_MAX_BOX_DEG } from './medecinsFrFeed.js';
import { _resetZoomFadeForTest, getZoomFadeDiagnostics } from './zoomFade.js';
import { _resetRenderGovernorForTest } from '../renderGovernor.js';
import { _resetJoinsForTest } from './layerJoins.js';

const SPECIALITES = { '01': 'Médecin généraliste', 15: 'Ophtalmologiste', '06': 'Radiologue' };
const PRECISION = ['numero', 'voie', 'lieu-dit', 'commune'];
const APL = {
  seuils: { sousDotee: 2.5, bienDotee: 4 },
  bornes: [1.76, 2.18, 2.54, 2.85, 3.19, 3.51, 3.83, 4.3, 4.87, 23.9],
  communes: { 12345: [2.4, 2.1, 1.8, 1.6, 5000, 5100] },
};

const site = ({
  precision = 0, insee = '12345', voie = '12 RUE DES LILAS', ville = 'Ambert',
  cp = '63600', tel = '0473000000', kind = 'liberal', specialties = [['01', 2]],
  practitioners = 2, registre = '',
} = {}) => [45, 3, precision, insee, cp, ville, voie, tel, kind, specialties, practitioners, registre];

test('the layer ships with the id every registry keys it on', () => {
  assert.equal(medecinsFranceLayer.id, MEDECINS_FR_LAYER_ID);
  assert.equal(MEDECINS_FR_LAYER_ID, 'medecins-fr');
  assert.equal(typeof medecinsFranceLayer.init, 'function');
  assert.equal(typeof medecinsFranceLayer.enable, 'function');
  assert.equal(typeof medecinsFranceLayer.disable, 'function');
  assert.equal(typeof medecinsFranceLayer.getStats, 'function');
});

test('every family has a colour, and no two share one', () => {
  const colors = MEDECIN_FAMILIES.map((family) => FAMILY_COLORS[family]);
  for (const [index, color] of colors.entries()) {
    assert.match(String(color), /^#[0-9a-f]{6}$/i, `${MEDECIN_FAMILIES[index]} has no colour`);
  }
  assert.equal(new Set(colors).size, colors.length, 'two families share a colour');
});

test('plate size grows with doctors and stays bounded', () => {
  assert.ok(medecinMarkPixelSize(1) < medecinMarkPixelSize(4));
  assert.ok(medecinMarkPixelSize(4) < medecinMarkPixelSize(30));
  assert.ok(medecinMarkPixelSize(500) <= 30, 'a very large practice must not swallow its street');
  // The floor is what a punched silhouette needs to survive inside; a plate
  // smaller than this is a dot again, which is the state this layer left.
  assert.ok(medecinMarkPixelSize(1) >= 17, 'a solo practice must still hold its glyph');
  // A site with no published count is drawn, not deleted.
  assert.equal(medecinMarkPixelSize(0), medecinMarkPixelSize(1));
  assert.ok(Number.isFinite(medecinMarkPixelSize(undefined)));
});

test('the APL ladder is anchored on the two thresholds that are policy', () => {
  const cuts = APL_BINS.map((bin) => bin.max);
  assert.ok(cuts.includes(2.5), 'the under-served threshold must be a bin edge');
  assert.ok(cuts.includes(4), 'the well-served threshold must be a bin edge');
  for (let i = 1; i < cuts.length; i += 1) assert.ok(cuts[i] > cuts[i - 1]);
  assert.equal(aplBin(1.2), 0);
  assert.equal(aplBin(2.5), 1);
  assert.equal(aplBin(2.51), 2);
  assert.equal(aplBin(9), APL_BINS.length - 1);
  // No value is a bin. A département with no APL row is drawn as absence.
  assert.equal(aplBin(null), null);
  assert.equal(aplBin(NaN), null);
});

test('a tariff line is refused when the register publishes no practitioner', () => {
  // "No tariff information" and "free" are not the same sentence, and a health
  // centre publishes specialties without names.
  assert.equal(tariffLine([]), null);
  assert.equal(tariffLine(undefined), null);
  assert.equal(tariffLine([['A', 'M', '01', '1', '']]), 'tarif fixé pour tous (secteur 1)');
  const mixed = tariffLine([['A', 'M', '01', '1', ''], ['B', 'F', '15', '3', '']]);
  assert.match(mixed, /honoraires libres/);
  assert.match(mixed, /tarif fixé/);
});

test('a card leads with where and who, and names the doctors', () => {
  const card = buildSiteCard(
    site(),
    [['MARTIN CLAIRE', 'F', '01', '1', ''], ['DURAND PAUL', 'M', '01', '1', '']],
    { specialites: SPECIALITES, precision: PRECISION, apl: APL },
  );
  const lines = card.split('\n');
  assert.equal(lines[0], '12 RUE DES LILAS');
  assert.ok(lines.includes('63600 Ambert'));
  assert.ok(lines.some((line) => line.startsWith('☎')));
  assert.ok(lines.includes('2 médecins'));
  assert.ok(lines.some((line) => line.includes('Dre MARTIN CLAIRE')));
  assert.ok(lines.some((line) => line.includes('Dr DURAND PAUL')));
});

test('a card never claims a precision BAN did not return', () => {
  const exact = buildSiteCard(site({ precision: 0 }), [], { precision: PRECISION });
  assert.ok(!exact.includes('⚠'), 'an exact address must not disclaim itself');

  const commune = buildSiteCard(site({ precision: 3 }), [], { precision: PRECISION });
  assert.match(commune, /centre de la commune, pas au cabinet/);

  const street = buildSiteCard(site({ precision: 1 }), [], { precision: PRECISION });
  assert.match(street, /pas au numéro/);
});

test('a health centre says its practitioners are unnamed, not that it has none', () => {
  const card = buildSiteCard(
    site({ kind: 'centre-de-sante', practitioners: 0, specialties: [['01', 3]] }),
    [],
    { specialites: SPECIALITES, precision: PRECISION },
  );
  assert.match(card, /Centre de santé/);
  assert.match(card, /Praticiens non nommés/);
  assert.ok(!card.includes('0 médecin'), 'never present an unnamed practice as an empty one');
  // The specialty tally still counts those rows — that is the whole point of
  // keeping it beside the name list.
  assert.match(card, /Médecin généraliste \(3\)/);
});

test('a card carries the local access as a POSITION, not a raw unit', () => {
  const card = buildSiteCard(site(), [], { specialites: SPECIALITES, precision: PRECISION, apl: APL });
  assert.match(card, /Accès local/);
  assert.match(card, /zone sous-dotée/);
  assert.match(card, /dixième de France/);
  // And the retirement cliff, as a percentage of what exists today.
  assert.match(card, /62 ans et plus/);
});

test('a commune with no APL row simply says nothing about access', () => {
  const card = buildSiteCard(site({ insee: '99999' }), [], { precision: PRECISION, apl: APL });
  assert.ok(!card.includes('Accès local'), 'absence must not be drawn as the bottom of the scale');
});

test('the register spelling is shown only when BAN disagrees', () => {
  const agreed = buildSiteCard(site(), [], { precision: PRECISION });
  assert.ok(!agreed.includes('Adresse publiée par le registre'));
  const diverged = buildSiteCard(site({ registre: '63601 AMBERT CEDEX' }), [], { precision: PRECISION });
  assert.match(diverged, /Adresse publiée par le registre : 63601 AMBERT CEDEX/);
});

test('a long practice lists a bounded number of names and says how many remain', () => {
  const many = Array.from({ length: 14 }, (_, i) => [`NOM${i}`, 'M', '01', '1', '']);
  const card = buildSiteCard(site({ practitioners: 14 }), many, { specialites: SPECIALITES, precision: PRECISION });
  const named = card.split('\n').filter((line) => line.startsWith('Dr '));
  assert.equal(named.length, 8);
  assert.match(card, /et 6 autres praticiens/);
});

test('a département card reports access before headcount', () => {
  const card = buildDepartementCard('63', 'Puy-de-Dôme', [1200, 700, 2100], [3.1, 2.8, 2.2, 640000, 464], {
    seuils: { sousDotee: 2.5, bienDotee: 4 },
  });
  const lines = card.split('\n');
  assert.equal(lines[0], 'Puy-de-Dôme');
  assert.match(lines[1], /^APL 2\.80/);
  assert.ok(lines.some((line) => line.includes('médecins')));
  assert.ok(lines.some((line) => line.includes('habitants')));
});

test('the label cohort is bounded and stable', () => {
  const entries = Array.from({ length: 40 }, (_, i) => ({ id: `d${i}`, priority: i % 7 }));
  const picked = selectLabelCohort(entries);
  assert.ok(picked.length <= 14);
  assert.deepEqual(picked.map((e) => e.id), selectLabelCohort(entries).map((e) => e.id));
  assert.deepEqual(selectLabelCohort(entries, 0), []);
  assert.deepEqual(selectLabelCohort(null), []);
});

test('the paint chip switches what the choropleth carries, and reports it', () => {
  const layer = createMedecinsLayer({
    overlayHost: { setEntries() {}, clearSource() {}, setVisible() {} },
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.deepEqual(layer.getParams(), { paint: 'apl' });
  assert.equal(layer.setParams({}), false, 'an empty param set changes nothing');
  assert.equal(layer.setParams({ paint: 'medecins' }), true);
  assert.deepEqual(layer.getParams(), { paint: 'medecins' });
  assert.equal(layer.setParams({ paint: 'medecins' }), false, 'a no-op must report no change');
  // Anything unrecognised falls back to the honest default rather than a blank map.
  layer.setParams({ paint: 'nonsense' });
  assert.deepEqual(layer.getParams(), { paint: 'apl' });
  const { chips } = layer.getRowControls();
  assert.equal(chips.length, 2);
  assert.ok(chips.some((chip) => chip.active));
});

test('stats separate the headcount from the entry count, and never merge them', () => {
  const stats = medecinsFranceLayer.getStats();
  for (const key of ['count', 'medecins', 'entrees', 'adresses', 'aplMillesime']) {
    assert.ok(key in stats, `getStats() must publish ${key}`);
  }
  assert.equal(stats.loading, false);
});

test('two camera events on one gesture resolve to the same view', () => {
  // The real pair that sent an 800 kB box twice: `moveEnd` and `changed`
  // disagree in the twelfth decimal, which is nanometres.
  const a = { south: 48.777034637322785, west: 2.0973017726415866, north: 48.93942141340308, east: 2.31 };
  const b = { south: 48.77703463732277, west: 2.0973017726415644, north: 48.9394214134031, east: 2.31 };
  assert.equal(boxKey(a, 'sites'), boxKey(b, 'sites'));
});

test('but a view a reader could tell apart is never merged', () => {
  const a = { south: 48.7770, west: 2.0973, north: 48.9394, east: 2.31 };
  const b = { south: 48.7780, west: 2.0973, north: 48.9394, east: 2.31 };
  assert.notEqual(boxKey(a, 'sites'), boxKey(b, 'sites'));
  // 11 m is the quantum, and it must be finer than anything the site regime
  // draws — that regime caps at 0.6°, so the quantum is 1/6000th of a box.
  const c = { ...a, south: a.south + 0.0002 };
  assert.notEqual(boxKey(a, 'sites'), boxKey(c, 'sites'));
});

test('crossing a regime boundary always re-asks', () => {
  const box = { south: 45, west: 3, north: 46, east: 4 };
  assert.notEqual(boxKey(box, 'mesh'), boxKey(box, 'sites'));
  assert.notEqual(boxKey(box, 'national'), boxKey(box, 'mesh'));
});

test('a server without names says so where the names would be, and only where there are some', () => {
  // The names are built by each deployment, not shipped in the repository: a
  // clone that never built them must not show an address that looks as
  // though nobody practises there.
  const card = buildSiteCard(site(), [], { specialites: SPECIALITES, precision: PRECISION, names: 'unavailable' });
  assert.match(card, /Noms des praticiens indisponibles sur ce serveur/);
  assert.match(card, /2 médecins/, 'the count is the register’s arithmetic and stays');

  // A health centre publishes no names anywhere; its card already says so.
  const centre = buildSiteCard(
    site({ kind: 'centre-de-sante', practitioners: 0, specialties: [['01', 3]] }),
    [],
    { specialites: SPECIALITES, precision: PRECISION, names: 'unavailable' },
  );
  assert.ok(!centre.includes('indisponibles'));

  // Names that arrived are never followed by a line saying they did not.
  const named = buildSiteCard(site(), [['MARTIN CLAIRE', 'F', '01', '1', '']], { precision: PRECISION });
  assert.ok(!named.includes('indisponibles'));
});

test('a card opened across a server rebuild asks to be reopened instead of guessing', () => {
  const card = buildSiteCard(site(), null, { specialites: SPECIALITES, precision: PRECISION, names: 'stale' });
  assert.match(card, /Annuaire mis à jour/);
  assert.ok(!card.includes('Dr '), 'no name from another pack may reach the card');
});

// --- Fade on zoom -------------------------------------------------------------

test('the practices band starts where `/sites` stops refusing the box, one zoom level and a half wide', () => {
  assert.deepEqual({ ...MEDECINS_SITES_BAND }, { fine: 0.36, coarse: 0.6 });
  // `/sites` takes the camera box unpadded and answers 413 above 0.6° on either
  // axis: the coarse end IS the ceiling, so the request is unchanged.
  assert.equal(MEDECINS_SITES_BAND.coarse, MEDECINS_MAX_BOX_DEG);
  const ratio = MEDECINS_SITES_BAND.coarse / MEDECINS_SITES_BAND.fine;
  assert.ok(ratio >= 1.5 && ratio <= 2, `coarse/fine ${ratio}`);
});

test('a settled view inside the band loads the mesh and the practices, and a view outside drops the other', () => {
  const inBand = planMedecinsLevels({ lat: 0.3, max: 0.5 });
  assert.deepEqual([inBand.mesh, inBand.sites, inBand.dominant], [true, true, 'sites']);
  // A tall-and-narrow view at 0.5° of latitude but 0.8° of longitude is wider
  // than `/sites` answers: the mesh, as the old latitude test fell back to.
  const wide = planMedecinsLevels({ lat: 0.5, max: 0.8 });
  assert.deepEqual([wide.mesh, wide.sites, wide.dominant], [true, false, 'mesh']);
  // The mesh's own dots are gone by 0.6 × 0.6^0.7 = 0.420°.
  const close = planMedecinsLevels({ lat: 0.2, max: 0.41 });
  assert.deepEqual([close.mesh, close.sites, close.dominant], [false, true, 'sites']);
  assert.equal(planMedecinsLevels({ lat: 0.2, max: 0.43 }).mesh, true);
  // The key changes hands where the weights cross, 0.539°.
  assert.equal(planMedecinsLevels({ lat: 0.3, max: 0.55 }).dominant, 'mesh');
  assert.equal(planMedecinsLevels({ lat: 0.3, max: 0.53 }).dominant, 'sites');
  const national = planMedecinsLevels({ lat: 9.6, max: 20 });
  assert.deepEqual([national.national, national.mesh, national.sites], [true, false, false]);
});

test('the APL map and the practices still change on a hard cut that never blanks', () => {
  for (const span of [0.3, 0.5, 2, 9, 12]) {
    for (const regime of ['national', 'mesh', 'sites']) {
      for (const nationalReady of [false, true]) {
        for (const pointsReady of [false, true]) {
          const alphas = medecinsLevelAlphas(span, {
            regime, nationalReady, pointsReady, meshReady: pointsReady, sitesReady: pointsReady, sitesArrival: 0.5,
          });
          assert.ok(alphas.national === 0 || alphas.national === 1, `national ${alphas.national}`);
          assert.ok(alphas.points === 0 || alphas.points === 1, `points ${alphas.points}`);
        }
      }
    }
  }
  assert.equal(medecinsLevelAlphas(2, { regime: 'mesh', nationalReady: true }).national, 1, 'held until the dots land');
  assert.equal(medecinsLevelAlphas(12, { regime: 'national', pointsReady: true, meshReady: true }).mesh, 1, 'held until painted');
});

test('across the band a practice both levels draw never fades', () => {
  const both = { regime: 'sites', nationalReady: true, pointsReady: true, meshReady: true, sitesReady: true };
  let previous = { mesh: 2, sites: -1 };
  for (let span = 0.62; span >= 0.34; span -= 0.01) {
    const alphas = medecinsLevelAlphas(span, both);
    assert.equal(alphas.shared, 1, `shared dipped at ${span}`);
    assert.ok(alphas.mesh <= previous.mesh && alphas.sites >= previous.sites);
    assert.ok(alphas.mesh + alphas.sites >= 1 - 1e-12, `dipped at ${span}`);
    previous = alphas;
  }
  assert.equal(medecinsLevelAlphas(0.51, both).sites, 1, 'in at full strength by 0.515°');
});

// One pack of five practices. The mesh writes one tuple per pack line, in pack
// order — the join this layer relies on.
const PACK_ID = 'pack-test';
const practice = (lat, lon, practitioners = 1) => [
  lat, lon, 0, '75056', '75001', 'PARIS', '1 RUE DE RIVOLI', '', 'liberal', [['01', practitioners]], practitioners, '',
];
const PACK_SITES = [
  practice(48.85, 2.35), practice(48.86, 2.34), practice(48.87, 2.33), practice(48.88, 2.32), practice(48.89, 2.31),
];
const ONE_DEPARTEMENT = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { code: '75', nom: 'Paris' },
    geometry: { type: 'Polygon', coordinates: [[[2.2, 48.8], [2.5, 48.8], [2.5, 48.95], [2.2, 48.95], [2.2, 48.8]]] },
  }],
};

/** `/sites` answers lines 0, 1 and 4 — and 4 is not in the mesh this test serves. */
function medecinsFetch() {
  const json = (body) => ({ ok: true, status: 200, json: async () => body });
  return async (url) => {
    const href = String(url);
    if (href.endsWith('departements.geojson')) return json(ONE_DEPARTEMENT);
    if (href.startsWith('/api/medecins-fr/national')) {
      return json({ etablissements: [], apl: { departements: { 75: [3.1, 3, 2.9, 2.8, 2_100_000] } }, departements: {} });
    }
    if (href.startsWith('/api/medecins-fr/mesh')) {
      // Lines 0-3 only: line 4 stands for a practice the mesh does not hold.
      return json({ packId: PACK_ID, sites: PACK_SITES.slice(0, 4).map((site) => [site[0], site[1], site[10], 0]) });
    }
    if (href.startsWith('/api/medecins-fr/sites')) {
      return json({ packId: PACK_ID, sites: [0, 1, 4].map((index) => ({ index, site: PACK_SITES[index] })), truncated: false });
    }
    throw new Error(`unexpected ${href}`);
  };
}

/** A viewer whose camera sees a box, with a preRender event the fade listens to. */
function fakeViewer() {
  const listeners = new Set();
  const viewer = {
    rect: null,
    primitives: [],
    look(south, west, north, east) {
      const r = Cesium.Math.toRadians;
      viewer.rect = new Cesium.Rectangle(r(west), r(south), r(east), r(north));
    },
    camera: {
      computeViewRectangle: () => viewer.rect,
      positionCartographic: { height: 60_000 },
    },
    scene: {
      frameState: { mode: Cesium.SceneMode.SCENE3D },
      globe: { ellipsoid: Cesium.Ellipsoid.WGS84 },
      requestRenderMode: true,
      requestRender() {},
      primitives: { add: (primitive) => { viewer.primitives.push(primitive); return primitive; }, remove: () => true },
      preRender: { addEventListener: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } },
    },
    dataSources: { add: async () => {}, remove: () => {} },
    render() { for (const fn of [...listeners]) fn(); },
  };
  return viewer;
}

const ids = (collection) => Array.from({ length: collection.length }, (_, i) => collection.get(i).id).sort();

test('a view inside the band draws each practice once: shared, practices-only and mesh-only', async (t) => {
  t.after(() => { _resetZoomFadeForTest(); _resetRenderGovernorForTest(); _resetJoinsForTest(); });
  const viewer = fakeViewer();
  viewer.look(48.6, 2.1, 49.1, 2.6); // 0.5°: inside the band, the practices dominant
  const layer = createMedecinsLayer({
    overlayHost: { setEntries() {}, clearSource() {}, setVisible() {} },
    fetchImpl: medecinsFetch(),
  });
  layer.init(viewer);
  await layer.enable();
  const [mesh, practices, shared] = viewer.primitives;
  // Lines 0 and 1 are in both levels: drawn once, as the practice, in the shared class.
  assert.deepEqual(ids(shared), ['medecins-fr:site:0', 'medecins-fr:site:1']);
  // Line 4 only the practices hold; lines 2 and 3 only the mesh holds.
  assert.deepEqual(ids(practices), ['medecins-fr:site:4']);
  assert.deepEqual(ids(mesh), ['medecins-fr:site:2', 'medecins-fr:site:3']);
  // The practices own the count: their three, not the five marks on screen.
  assert.equal(layer.getStats().count, 3);
  assert.equal(layer.getStats().regime, 'sites');

  viewer.render();
  const state = getZoomFadeDiagnostics().owners.find((owner) => owner.ownerId === MEDECINS_FR_LAYER_ID).state;
  const expected = medecinsLevelAlphas(0.5, {
    regime: 'sites', pointsReady: true, meshReady: true, sitesReady: true,
  });
  assert.equal(state.levels.shared, 1);
  assert.equal(state.levels.sites, 1);
  assert.ok(Math.abs(state.levels.mesh - expected.mesh) < 1e-12 && state.levels.mesh > 0);
  assert.deepEqual(state.bands['mesh-sites'], { fine: 0.36, coarse: 0.6, unit: 'deg-max' });
  assert.equal(state.dominant, 'sites');
  assert.equal(shared.get(0).color.alpha, 1);
  assert.equal(mesh.show, true);

  // Closer: the settled view no longer wants the mesh, and once its dots are
  // at zero they go — the shared practices stay where they were.
  viewer.look(48.75, 2.2, 49.05, 2.5);
  await layer.update();
  viewer.render();
  assert.equal(mesh.length, 0);
  assert.equal(mesh.show, false);
  assert.deepEqual(ids(shared), ['medecins-fr:site:0', 'medecins-fr:site:1']);
  assert.equal(layer.getStats().count, 3);

  // Out to France: the APL map takes the screen in one frame once painted,
  // and the practices go with it.
  viewer.look(41, -5, 51, 10);
  await layer.update();
  assert.equal(layer.getStats().regime, 'national');
  assert.equal(practices.length + shared.length + mesh.length, 0);
  const after = getZoomFadeDiagnostics().owners.find((owner) => owner.ownerId === MEDECINS_FR_LAYER_ID).state;
  assert.deepEqual([after.levels.national, after.levels.sites, after.levels.shared], [1, 0, 0]);
  layer.disable();
});
