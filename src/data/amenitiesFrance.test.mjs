// What the DRAWN layer is allowed to claim, once the two feeds have already
// been proved.
//
// One property runs through the whole file: **nothing on this map may be read
// back as a quantity that neither register publishes.** This point set has no
// magnitude — a pharmacy is one pharmacy — so the size channel is a legibility
// rule and the card never turns it back into a number. What the card DOES turn
// into a number is the multiplicity, because 60 270 médecin rows sit on 30 215
// coordinates and the biggest address holds 146 of them.
//
// The second property is that the refusals stay visible. A reader who came for
// schools must be told where they are; a dot the register placed vaguely must
// look different from one it placed at a street number; and a thinned view must
// print both numbers per family or it is claiming the sample is the inventory.
import test from 'node:test';
import { CHOROPLETH_FILL_ALPHA } from './choroplethAlpha.js';
import assert from 'node:assert/strict';

import amenitiesFranceLayer, {
  AMENITIES_FR_LABEL_COHORT_LIMIT,
  AMENITIES_SITES_BAND,
  amenitiesLevelAlphas,
  planAmenitiesLevels,
  _amenitiesDrawLevelsForTest,
  _amenitiesFadeFrameForTest,
  amenitiesSitesBox,
  amenitiesViewSpanDeg,
  cameraAmenitiesBox,
  _amenitiesUpdateRegimeForTest,
  AMENITIES_FR_LAYER_ID,
  AMENITIES_FR_OVERLAY_SOURCE_ID,
  AMENITY_COLORS,
  AMENITY_POINT_PX,
  AMENITY_PRECISION_ALPHA,
  amenitiesDepartementAlpha,
  amenitiesDepartementColor,
  amenityCalloutText,
  amenityFamilyColor,
  amenityFamilyLabel,
  amenityPositionVouched,
  amenityPointSize,
  amenityPrecisionAlpha,
  buildAmenitiesDepartementLabel,
  buildAmenitiesLoadingLabel,
  buildAmenitySelectionLabel,
  createAmenitiesDepartementOverlayEntry,
  createAmenitySelectedOverlayEntry,
  selectAmenitiesLabelCohort,
  _amenitiesDetectablesForTest,
  _amenitiesReconcileForTest,
  _amenitiesReconcileMeshForTest,
  _amenitiesRowControlsForTest,
  _amenitiesSelectedIdForTest,
  _amenitiesStatsForTest,
  _amenitiesTruncatedForTest,
  _clearAmenitiesSelectionForTest,
  _selectAmenityForTest,
  _setAmenitiesStateForTest,
} from './amenitiesFrance.js';
import * as Cesium from 'cesium';
import { AMENITY_FAMILIES } from './amenitiesFeed.js';
import { AMENITY_GLYPH_RASTER_PX, amenityFamilyGlyph } from './amenityFamilyIcons.js';
import { SCHOOL_LEVELS } from './schoolsFeed.js';
import { schoolLevelColor } from './schoolsFrance.js';
import { SUP_KINDS } from './supFeed.js';
import { supKindColor } from './supFrance.js';

// Cesium reads the aliased line-width range off a live WebGL context, and there
// is none under `node --test`, so `ContextLimits._maximumAliasedLineWidth` sits
// at 0 and every `RenderState.fromCache` throws. Priming it is a property of
// the harness, not of the layer.
const { default: ContextLimits } = await import('@cesium/engine/Source/Renderer/ContextLimits.js');
ContextLimits._maximumAliasedLineWidth = 16;

/** `toLocaleString('fr-FR')` separates thousands with U+202F. */
const norm = (value) => String(value).replace(/[\s  ]+/g, ' ');

/**
 * A points collection with the methods the layer and the fade adapter call.
 * Like a Cesium billboard, a mark's `color` setter COPIES what it is given: the
 * adapter writes one scratch colour into every mark.
 */
function fakePoints() {
  const added = [];
  return {
    show: true,
    added,
    add(options) {
      let color = options.color ? Cesium.Color.clone(options.color) : null;
      const point = { ...options, show: true, scale: 1 };
      Object.defineProperty(point, 'color', {
        enumerable: true,
        get: () => color,
        set: (value) => { color = Cesium.Color.clone(value); },
      });
      added.push(point);
      return point;
    },
    get length() { return added.length; },
    get(index) { return added[index]; },
    removeAll() { added.length = 0; },
  };
}

/** An overlay host that records what the layer publishes. */
function fakeOverlayHost() {
  const calls = { entries: new Map(), cleared: [] };
  return {
    calls,
    setEntries(sourceId, entries) { calls.entries.set(sourceId, entries); },
    setVisible() {},
    clearSource(sourceId) { calls.cleared.push(sourceId); calls.entries.delete(sourceId); },
  };
}

const site = (over = {}) => ({
  id: 'a:0:48.83801,2.34276',
  family: 'medecin',
  register: 'bpe',
  lat: 48.83801,
  lon: 2.34276,
  precision: 'numero',
  count: 1,
  names: ['NADJIBA GALOUL, MÉDECIN'],
  moreNames: 0,
  unnamed: 0,
  kinds: ['Médecin généraliste'],
  commune: 'PARIS 14',
  ...over,
});

const record = ({ site: siteOver, ...over } = {}) => {
  const built = site(siteOver);
  return {
    id: over.id || built.id,
    site: built,
    position: { x: 1, y: 2, z: 3 },
    baseColor: amenityFamilyColor(built.family) || AMENITY_COLORS.medecin,
    baseAlpha: 1,
    baseSize: AMENITY_POINT_PX[built.family] || AMENITY_POINT_PX.medecin,
    point: { color: null, width: 0, height: 0, show: true },
    ...over,
  };
};

test.afterEach(() => {
  _clearAmenitiesSelectionForTest();
  _setAmenitiesStateForTest({
    regime: 'national', records: new Map(), national: null, mesh: null, meshPick: null,
    count: 0, status: 'idle', loading: false, error: null, summary: null, selectedId: null,
    enabled: false, points: null, overlayHost: null, truncated: 0,
    meshPoints: null, sharedPoints: null, meshLevel: null, sitesLevel: null, plan: null,
    nationalReady: false, pointsAnswered: false, depShown: false, depEntities: new Map(),
    depPaintedCodes: [], medecinsDrawing: false,
  });
});

// --- Identity ---------------------------------------------------------------

test('the layer object is the one the registry will hold', () => {
  assert.equal(amenitiesFranceLayer.id, 'amenities-fr');
  assert.equal(AMENITIES_FR_LAYER_ID, 'amenities-fr');
  assert.equal(amenitiesFranceLayer.icon, '🏪');
  assert.match(amenitiesFranceLayer.name, /Équipements du quotidien/);
  assert.equal(typeof amenitiesFranceLayer.init, 'function');
  assert.equal(typeof amenitiesFranceLayer.enable, 'function');
  assert.equal(typeof amenitiesFranceLayer.disable, 'function');
  assert.equal(typeof amenitiesFranceLayer.update, 'function');
  assert.equal(typeof amenitiesFranceLayer.getDetectableObjects, 'function');
  assert.equal(amenitiesFranceLayer.updateInterval, 6 * 60 * 60_000);
});

// --- Colour and size --------------------------------------------------------

test('every family has its own hue and none of them is a neighbour layer’s', () => {
  const seen = new Set();
  for (const family of AMENITY_FAMILIES) {
    const color = amenityFamilyColor(family);
    assert.match(color, /^#[0-9a-f]{6}$/i);
    assert.equal(seen.has(color), false, `${family} reuses a colour`);
    seen.add(color);
  }
  assert.equal(seen.size, AMENITY_FAMILIES.length);
  // schools-fr draws 68 158 dots and sup-fr 6 914 over the same country; a
  // shared hex would make two registers indistinguishable on a stacked address.
  const neighbours = new Set([
    ...SCHOOL_LEVELS.map((level) => schoolLevelColor(level).toLowerCase()),
    ...SUP_KINDS.map((kind) => supKindColor(kind).toLowerCase()),
  ]);
  for (const color of seen) {
    assert.equal(neighbours.has(color.toLowerCase()), false, `${color} collides with a neighbour`);
  }
  assert.equal(amenityFamilyColor('ecole'), null);
  assert.equal(amenityFamilyColor(undefined), null);
});

test('size is a legibility ladder — rarer families are bigger, and it means nothing else', () => {
  // Ascending rarity: médecin 30 215 … hôpital 2 211.
  const order = ['medecin', 'courses', 'pharmacie', 'poste', 'piscine', 'gendarmerie', 'hopital'];
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(AMENITY_POINT_PX[order[i]] >= AMENITY_POINT_PX[order[i - 1]],
      `${order[i]} should not be smaller than ${order[i - 1]}`);
  }
  assert.ok(AMENITY_POINT_PX.hopital > AMENITY_POINT_PX.medecin);
  // Size never varies with anything on the record — there is no magnitude.
  assert.equal(amenityPointSize('medecin'), amenityPointSize('medecin'));
  // A maillage dot is flatter than an exact one, so a sample cannot read as an
  // inventory.
  assert.ok(amenityPointSize('hopital', { mesh: true }) < amenityPointSize('hopital'));
  assert.equal(amenityPointSize('inconnu'), 6);
});

test('the precision channel is real: worse-located dots are softer and lose the halo', () => {
  assert.ok(amenityPrecisionAlpha('numero') > amenityPrecisionAlpha('voie'));
  assert.ok(amenityPrecisionAlpha('voie') > amenityPrecisionAlpha('approchee'));
  assert.ok(amenityPrecisionAlpha('approchee') > amenityPrecisionAlpha('indeterminee'));
  assert.equal(amenityPositionVouched('numero'), true);
  assert.equal(amenityPositionVouched('voie'), true);
  assert.equal(amenityPositionVouched('approchee'), false);
  assert.equal(amenityPositionVouched('indeterminee'), false);
  // An absent band must not default to the best one.
  assert.equal(amenityPrecisionAlpha(undefined), AMENITY_PRECISION_ALPHA.indeterminee);
  assert.equal(amenityPrecisionAlpha(null), AMENITY_PRECISION_ALPHA.indeterminee);
  assert.equal(amenityPositionVouched(undefined), false);
});

test('a choropleth bin that is not an integer bin gets no colour at all', () => {
  assert.match(amenitiesDepartementColor(0), /^#[0-9a-f]{6}$/i);
  assert.match(amenitiesDepartementColor(5), /^#[0-9a-f]{6}$/i);
  // -1 is "this département is not in the fold" and must draw as absence.
  assert.equal(amenitiesDepartementColor(-1), null);
  assert.equal(amenitiesDepartementColor(6), null);
  // The three shapes a coercing guard would have turned into bin 0.
  assert.equal(amenitiesDepartementColor(null), null);
  assert.equal(amenitiesDepartementColor(undefined), null);
  assert.equal(amenitiesDepartementColor('0'), null);
  assert.equal(amenitiesDepartementColor(1.5), null);
  // The alpha ladder is shared and DESCENDING (see choroplethAlpha.js); a
  // non-bin clamps to its first entry, which is now the heaviest, not the
  // lightest.
  assert.equal(amenitiesDepartementAlpha(null), CHOROPLETH_FILL_ALPHA[0]);
});

test('the ramp is a different colour family from the two national views beside it', () => {
  const mine = [0, 1, 2, 3, 4, 5].map((bin) => amenitiesDepartementColor(bin).toLowerCase());
  assert.equal(new Set(mine).size, 6);
  for (const color of mine) {
    assert.equal(SCHOOL_LEVELS.some((level) => schoolLevelColor(level).toLowerCase() === color), false);
  }
});

// --- Cards ------------------------------------------------------------------

test('a card with several practitioners at one address says how many, and names four', () => {
  const label = buildAmenitySelectionLabel(record({
    site: {
      count: 146,
      names: ['A, MÉDECIN', 'B, MÉDECIN', 'C, MÉDECIN', 'D, MÉDECIN'],
      moreNames: 142,
      unnamed: 0,
    },
  }));
  assert.match(norm(label), /146 médecins généralistes à cette adresse/);
  assert.match(norm(label), /et 142 autres/);
  assert.match(label, /B, MÉDECIN/);
});

test('a single-row dot does not claim a multiplicity it does not have', () => {
  const label = buildAmenitySelectionLabel(record());
  assert.equal(/à cette adresse/.test(label), false);
  assert.match(label, /^NADJIBA GALOUL, MÉDECIN\n/);
  assert.match(label, /Base permanente des équipements 2025 — Insee/);
});

test('a row whose raison sociale is not published says so instead of showing a blank title', () => {
  const label = buildAmenitySelectionLabel(record({ site: { names: [], count: 1 } }));
  assert.match(label, /^Médecin généraliste\n/);
  assert.match(label, /Raison sociale non diffusée/);
});

test('a vaguely-located dot carries a warning and a precisely-located one does not', () => {
  const vague = buildAmenitySelectionLabel(record({ site: { precision: 'indeterminee' } }));
  assert.match(vague, /⚠ Position : Précision non publiée/);
  const exact = buildAmenitySelectionLabel(record());
  assert.match(exact, /Position : Numéro trouvé dans une voie sûre/);
  assert.equal(/⚠/.test(exact), false);
});

test('a FINESS card names the register, the geocoding score and the CRS it was reprojected from', () => {
  const label = buildAmenitySelectionLabel(record({
    site: {
      family: 'hopital',
      register: 'finess',
      names: ['CH DE FLEYRIAT'],
      kinds: ['Centre Hospitalier (C.H.)'],
      score: 96,
      geocoder: 'BAN',
      crs: 'RGF93 / Lambert-93 (Métropole)',
      finess: ['010000024'],
      uai: '0691234X',
    },
  }));
  assert.match(norm(label), /Géocodage BAN — score 96\/100/);
  assert.match(label, /Coordonnées reprojetées depuis RGF93 \/ Lambert-93/);
  assert.match(label, /FINESS 010000024/);
  assert.match(label, /UAI 0691234X — aussi dans schools-fr \/ sup-fr/);
  assert.match(label, /FINESS — ARS \/ Agence du Numérique en Santé/);
});

test('a maillage dot says it is one, instead of letting its empty card read as an absence', () => {
  const label = buildAmenitySelectionLabel({
    mesh: true,
    site: { family: 'hopital', precision: 'voie', count: 0, names: [], kinds: [] },
  });
  assert.match(label, /^Hôpital\n/);
  assert.match(label, /Point du maillage — zoomer pour la fiche complète/);
});

test('the département card gives the ratio, the mix, and the ratio’s own blind spot', () => {
  const label = buildAmenitiesDepartementLabel({
    code: '32', name: 'Gers', share: 21.6, covered: 99, communes: 458, amenities: 380,
    families: { medecin: 47, courses: 80, pharmacie: 60, poste: 150, piscine: 10, gendarmerie: 33, hopital: 0 },
    bin: 0,
  });
  assert.match(norm(label), /21,6 % des communes équipées — 99 sur 458/);
  assert.match(norm(label), /380 équipements dessinés/);
  assert.match(norm(label), /47 médecins généralistes/);
  // The family with zero is not listed as a zero.
  assert.equal(/hôpitaux/.test(label), false);
  assert.match(label, /FINESS ne publie pas de code commune/);
});

test('a département with no communes in the fold says so rather than printing 0 %', () => {
  const label = buildAmenitiesDepartementLabel({
    code: '90', name: 'Territoire de Belfort', share: 0, covered: 0, communes: 0,
    amenities: 186, families: {}, bin: -1,
  });
  assert.match(label, /Aucune commune rattachée à ce polygone/);
});

// --- Status line ------------------------------------------------------------

test('the national line leads with the share and states what the choropleth cannot paint', () => {
  const label = buildAmenitiesLoadingLabel({
    regime: 'national',
    status: 'ready',
    loading: false,
    national: {
      nationalShare: 43.7, communesPlaced: 34778, assigned: 92725, painted: 96, unassigned: 2681,
    },
  });
  assert.match(norm(label), /43,7 % des 34 778 communes équipées/);
  assert.match(norm(label), /92 725 équipements sur 96 départements/);
  assert.match(norm(label), /2 681 hors métropole non peints/);
});

test('the maillage line names both numbers, because a thinned map that does not is lying', () => {
  const label = buildAmenitiesLoadingLabel({
    regime: 'maillage',
    status: 'ready',
    loading: false,
    meshPick: { picked: new Array(1100), inBox: 92748, thinned: true },
  });
  assert.match(norm(label), /1 100 tracés sur 92 748 dans la vue/);
  assert.match(label, /échantillon par famille/);
  // Under budget, it is not an échantillon and must not claim to be one.
  const whole = buildAmenitiesLoadingLabel({
    regime: 'maillage',
    status: 'ready',
    loading: false,
    meshPick: { picked: new Array(12), inBox: 12, thinned: false },
  });
  assert.match(norm(whole), /12 équipements dans la vue/);
  assert.equal(/échantillon/.test(whole), false);
});

test('the sites line reports what it received and did not draw, without naming a cause it cannot prove', () => {
  const label = buildAmenitiesLoadingLabel({
    regime: 'sites', status: 'ready', loading: false, count: 9000, truncated: 1234,
  });
  assert.match(norm(label), /9 000 équipements/);
  assert.match(norm(label), /1 234 reçus mais non tracés/);
  // Nothing dropped, nothing claimed.
  const clean = buildAmenitiesLoadingLabel({
    regime: 'sites', status: 'ready', loading: false, count: 9000, truncated: 0,
  });
  assert.equal(/non tracés/.test(clean), false);
});

test('the proxy’s own cap is named, because it is the one that now bites', () => {
  // Measured 2026-09-08 over the densest 0.349° square France allows —
  // 48.65 N, 2.20 E — after the Cityscan catch-up: 53 121 dots in the box, of
  // which the proxy answers 12 000. Silently drawing 12 000 and calling it the
  // view would understate that square by three quarters.
  const label = buildAmenitiesLoadingLabel({
    regime: 'sites',
    status: 'ready',
    loading: false,
    count: 12000,
    truncated: 0,
    summary: { rows: 67900, capped: 41121 },
  });
  assert.match(norm(label), /12 000 équipements/);
  assert.match(norm(label), /41 121 au-delà du plafond de la réponse/);
  assert.match(label, /dézoome pour le maillage/);
  // A view under the cap claims nothing.
  const clean = buildAmenitiesLoadingLabel({
    regime: 'sites', status: 'ready', loading: false, count: 268, summary: { rows: 284, capped: 0 },
  });
  assert.equal(/plafond/.test(clean), false);
});

test('an empty view says it is empty, and a loading one says what it is loading', () => {
  assert.equal(buildAmenitiesLoadingLabel({ regime: 'sites', status: 'empty', loading: false, count: 0 }),
    'aucun équipement dans cette vue');
  assert.match(buildAmenitiesLoadingLabel({ regime: 'national', loading: true }), /registre national/);
  assert.match(buildAmenitiesLoadingLabel({ regime: 'maillage', loading: true }), /maillage national/);
  // An error state prints nothing here — the error belongs in stats.error.
  assert.equal(buildAmenitiesLoadingLabel({ regime: 'sites', status: 'error', loading: false }), '');
});

// --- Legend -----------------------------------------------------------------

test('the legend always carries the écoles refusal, with the count and where they are', () => {
  _setAmenitiesStateForTest({
    regime: 'sites',
    records: new Map([['a', record()]]),
  });
  const { legend } = _amenitiesRowControlsForTest();
  const refusal = legend.at(-1);
  assert.match(refusal.label, /Écoles — non dessinées ici/);
  assert.equal(refusal.color, null);
  assert.match(refusal.blurb, /79 743/);
  assert.match(refusal.blurb, /schools-fr/);
  assert.match(refusal.blurb, /sup-fr/);
});

test('the maillage legend prints kept-against-in-view per family, because the mix on screen is bent', () => {
  _setAmenitiesStateForTest({
    regime: 'maillage',
    records: new Map([
      ['a', record({ id: 'a' })],
      ['b', record({ id: 'b', site: { family: 'piscine' } })],
    ]),
    meshPick: {
      picked: [], inBox: 92748, thinned: true,
      perFamily: [
        { family: 'medecin', inBox: 29000, kept: 331 },
        { family: 'piscine', inBox: 2100, kept: 39 },
      ],
    },
  });
  const { legend } = _amenitiesRowControlsForTest();
  const piscine = legend.find((row) => row.label === 'Bassin de natation');
  assert.match(norm(piscine.blurb), /Échantillon : 1 tracé sur 2 100 dans la vue/);
});

test('every family the layer draws has a key row, whether or not it is in view', () => {
  // The key is the CONTROL now: each row is that family's switch, so a row that
  // disappeared because the view holds none of it would be a switch a reader
  // cannot press back on.
  _setAmenitiesStateForTest({
    regime: 'sites',
    records: new Map([['a', record({ id: 'a' })]]),
  });
  const { legend } = _amenitiesRowControlsForTest();
  const families = legend.filter((row) => row.toggle);
  assert.equal(families.length, 13, 'thirteen drawn families, thirteen switches');
  assert.equal(families.filter((row) => row.count === 0).length, 12);
  for (const row of families) {
    assert.equal(row.toggle.param, 'basculer');
    assert.match(row.glyph, /^data:image\/svg\+xml;base64,/, `${row.label} has no mark`);
  }
  // And the hospital is named as gone rather than silently absent.
  const withdrawn = legend.find((row) => /Hôpitaux/.test(row.label));
  assert.equal(withdrawn.color, null);
  assert.match(withdrawn.blurb, /Santé & secours/);
});

test('switching a family off re-asks the view, and a share link can restore it', () => {
  _setAmenitiesStateForTest({
    regime: 'sites', enabled: false, records: new Map([['a', record({ id: 'a' })]]),
  });
  assert.deepEqual(amenitiesFranceLayer.getParams(), { familles: '' });

  // `basculer` flips one family against the current set, which starts "all on".
  assert.equal(amenitiesFranceLayer.setParams({ basculer: 'piscine' }), true);
  const off = amenitiesFranceLayer.getParams().familles.split(',');
  assert.equal(off.includes('piscine'), false);
  assert.equal(off.length, 12);

  // Pressing the same row again puts it back, and "everything" normalises to ''
  // so the link cannot carry two spellings of "no filter".
  assert.equal(amenitiesFranceLayer.setParams({ basculer: 'piscine' }), true);
  assert.deepEqual(amenitiesFranceLayer.getParams(), { familles: '' });

  // `familles` ASSIGNS, and one name is a selection of one — never a toggle.
  // Overloading the two is what made a share link carrying a single family
  // reopen showing the other twelve.
  assert.equal(amenitiesFranceLayer.setParams({ familles: 'boulangerie' }), true);
  assert.deepEqual(amenitiesFranceLayer.getParams(), { familles: 'boulangerie' });

  // A whole selection, which is the shape a share link restores.
  assert.equal(amenitiesFranceLayer.setParams({ familles: 'piscine,pharmacie' }), true);
  assert.deepEqual(amenitiesFranceLayer.getParams(), { familles: 'pharmacie,piscine' });
  const { legend, chips } = _amenitiesRowControlsForTest();
  assert.equal(legend.filter((row) => row.off).length, 11);
  assert.equal(chips.length, 1, 'a filtered key offers the way back');
  assert.deepEqual(chips[0].params, { familles: '' });

  // A family this layer does not draw is refused rather than stored.
  assert.equal(amenitiesFranceLayer.setParams({ basculer: 'hopital' }), false);
  assert.equal(amenitiesFranceLayer.setParams({ paint: 'apl' }), false);
  // And an unknown name in an ASSIGNMENT is dropped, leaving "no filter" —
  // never a filter that matches nothing.
  assert.equal(amenitiesFranceLayer.setParams({ familles: 'ecole' }), true);
  assert.deepEqual(amenitiesFranceLayer.getParams(), { familles: '' });
  amenitiesFranceLayer.setParams({ familles: '' });
});

test('the national legend is the percentage ramp and names the ratio’s blind spot', () => {
  _setAmenitiesStateForTest({
    regime: 'national',
    national: {
      thresholds: [29, 43, 49, 56, 69],
      departements: [
        { code: '32', name: 'Gers', share: 21.6, bin: 0, communes: 458 },
        { code: '75', name: 'Paris', share: 100, bin: 5, communes: 20 },
        { code: '90', name: 'Belfort', share: 0, bin: -1, communes: 0 },
      ],
    },
  });
  const { legend } = _amenitiesRowControlsForTest();
  assert.equal(legend.length, 2);
  for (const row of legend) assert.match(row.label, /%/);
  // A bin nobody is in is not a legend row.
  assert.equal(legend.some((row) => row.count === 0), false);
  assert.match(legend.at(-1).blurb, /FINESS ne publie pas de code commune/);
});

test('the national legend is empty until the rollup arrives', () => {
  _setAmenitiesStateForTest({ regime: 'national', national: null });
  assert.deepEqual(_amenitiesRowControlsForTest(), { chips: [], legend: [] });
});

// --- Reconcile, selection, detection ----------------------------------------

test('a viewport payload draws one point per record, styled by family and precision', () => {
  const points = fakePoints();
  _setAmenitiesStateForTest({ regime: 'sites', enabled: true, points, records: new Map() });
  _amenitiesReconcileForTest({
    sites: [
      site(),
      site({ id: 'a:6:48.8,2.3', family: 'piscine', lat: 48.8, lon: 2.3, precision: 'approchee' }),
      // A family the palette does not know is dropped, not drawn grey.
      site({ id: 'a:9:48.7,2.2', family: 'ecole', lat: 48.7, lon: 2.2 }),
    ],
  });
  assert.equal(points.added.length, 2);
  // A PLATE, not a dot: the side is square and the family is in the image.
  assert.equal(points.added[0].width, AMENITY_POINT_PX.medecin);
  assert.equal(points.added[0].height, AMENITY_POINT_PX.medecin);
  assert.equal(points.added[0].image, amenityFamilyGlyph('medecin', { px: AMENITY_GLYPH_RASTER_PX }));
  assert.equal(points.added[1].image, amenityFamilyGlyph('piscine', { px: AMENITY_GLYPH_RASTER_PX }));
  // Precision rides in the alpha now that every plate carries the same ring.
  assert.ok(points.added[1].color.alpha < points.added[0].color.alpha);
  assert.equal(_amenitiesStatsForTest().count, 2);
  assert.equal(_amenitiesTruncatedForTest(), 1);
});

test('the maillage draws the tuples the thinning kept and marks every record as a sample', () => {
  const points = fakePoints();
  const rows = [
    [45.0, 3.0, 3, AMENITY_FAMILIES.indexOf('medecin')],
    [45.5, 3.5, 0, AMENITY_FAMILIES.indexOf('piscine')],
  ];
  _setAmenitiesStateForTest({
    regime: 'maillage', enabled: true, meshPoints: points, records: new Map(), mesh: { rows, rowCount: 2 },
  });
  _amenitiesReconcileMeshForTest({ south: 44, west: 2, north: 46, east: 4 });
  assert.equal(points.added.length, 2);
  const summary = amenitiesFranceLayer.getMeshSummary();
  assert.equal(summary.inBox, 2);
  assert.equal(summary.shown, 2);
  assert.equal(summary.nationalRows, 2);
  assert.equal(summary.perFamily.length, 2);
  // The 'indeterminee' tuple is drawn softer, exactly as in the exact regime.
  const alphas = points.added.map((point) => point.color.alpha).sort((x, y) => x - y);
  assert.ok(alphas[0] < alphas[1], 'a tuple with no published precision must be drawn softer');
});

test('selecting a dot publishes a protected card and restores the dot on clear', () => {
  const points = fakePoints();
  const host = fakeOverlayHost();
  const entry = record();
  _setAmenitiesStateForTest({
    regime: 'sites', enabled: true, points, overlayHost: host,
    records: new Map([[entry.id, entry]]),
  });
  _selectAmenityForTest(entry.id);
  assert.equal(_amenitiesSelectedIdForTest(), entry.id);
  const published = host.calls.entries.get(AMENITIES_FR_OVERLAY_SOURCE_ID);
  assert.equal(published.length, 1);
  assert.equal(published[0].protected, true);
  assert.equal(published[0].selected, true);
  assert.match(published[0].title, /NADJIBA GALOUL/);
  // Cesium MULTIPLIES a billboard's colour, so the selected plate goes white —
  // any tint would repaint the artwork and lose the family. The card carries
  // the family colour instead.
  assert.equal(entry.point.width, 30);
  assert.equal(published[0].accent, AMENITY_COLORS.medecin);
  assert.equal(entry.point.color, Cesium.Color.WHITE);
  _clearAmenitiesSelectionForTest();
  assert.equal(_amenitiesSelectedIdForTest(), null);
  assert.equal(entry.point.width, AMENITY_POINT_PX.medecin);
  assert.ok(host.calls.cleared.includes(AMENITIES_FR_OVERLAY_SOURCE_ID));
});

test('a selection for an id the layer does not hold changes nothing', () => {
  const host = fakeOverlayHost();
  _setAmenitiesStateForTest({
    regime: 'sites', enabled: true, points: fakePoints(), overlayHost: host, records: new Map(),
  });
  _selectAmenityForTest('a:0:0,0');
  assert.equal(_amenitiesSelectedIdForTest(), null);
  assert.equal(host.calls.entries.has(AMENITIES_FR_OVERLAY_SOURCE_ID), false);
});

test('a selected overlay entry needs both an id and a position, or it is not built', () => {
  assert.equal(createAmenitySelectedOverlayEntry(null), null);
  assert.equal(createAmenitySelectedOverlayEntry({ id: 'x' }), null);
  assert.equal(createAmenitySelectedOverlayEntry({ position: {} }), null);
});

test('the DETECT callout names the thing, and falls back to the family for a nameless maillage dot', () => {
  assert.equal(amenityCalloutText(record()), 'NADJIBA GALOUL, MÉDECIN');
  assert.equal(norm(amenityCalloutText(record({ site: { count: 3 } }))),
    'NADJIBA GALOUL, MÉDECIN · +2');
  assert.equal(amenityCalloutText({ site: { family: 'hopital', names: [] } }), 'Hôpital');
  assert.equal(amenityCalloutText(null), '');
});

test('detection is bounded, deterministic and skips the already-labelled selection', () => {
  const points = fakePoints();
  const records = new Map();
  for (let i = 0; i < 40; i += 1) {
    const id = `a:0:48.${i},2.0`;
    records.set(id, record({ id, site: { id } }));
  }
  _setAmenitiesStateForTest({ regime: 'sites', enabled: true, points, records });
  const detectables = _amenitiesDetectablesForTest({ maxCount: 7, seed: 3 });
  assert.equal(detectables.length, 7);
  assert.deepEqual(detectables, _amenitiesDetectablesForTest({ maxCount: 7, seed: 3 }));
  for (const item of detectables) {
    assert.equal(item.type, 'Amenity');
    assert.ok(records.has(item.sourceId));
    assert.equal(item.skipLabel, false);
  }
  // With the layer off, nothing is detectable.
  _setAmenitiesStateForTest({ enabled: false });
  assert.deepEqual(_amenitiesDetectablesForTest({ maxCount: 7 }), []);
});

// --- Stats ------------------------------------------------------------------

test('a zoom or empty state is guidance, not an error', () => {
  _setAmenitiesStateForTest({
    regime: 'sites', status: 'empty', count: 0, loading: false, error: null,
  });
  const stats = _amenitiesStatsForTest();
  assert.equal(stats.status, 'empty');
  assert.equal(stats.error, undefined);
  assert.match(stats.loadingLabel, /aucun équipement/);
});

test('a stale national payload is flagged, and a failed one carries a sentence', () => {
  _setAmenitiesStateForTest({
    regime: 'national', national: { stale: true, departements: [], nationalShare: 43.7, communesPlaced: 1, assigned: 1, painted: 1, unassigned: 0 },
    status: 'ok', count: 96,
  });
  assert.equal(_amenitiesStatsForTest().stale, true);
  _setAmenitiesStateForTest({ regime: 'national', national: null, status: 'error', error: 'HTTP 503' });
  const stats = _amenitiesStatsForTest();
  assert.equal(stats.error, 'HTTP 503');
  assert.equal(stats.status, 'error');
});

// --- Overlay labels ---------------------------------------------------------

test('the ambient département labels favour the LEAST equipped, which is the point of the map', () => {
  const gers = createAmenitiesDepartementOverlayEntry(
    { code: '32', name: 'Gers', share: 21.6, bin: 0 }, { x: 0, y: 0, z: 0 },
  );
  const paris = createAmenitiesDepartementOverlayEntry(
    { code: '75', name: 'Paris', share: 100, bin: 5 }, { x: 0, y: 0, z: 0 },
  );
  assert.ok(gers.priority > paris.priority);
  assert.match(norm(gers.title), /Gers · 21,6 %/);
  const cohort = selectAmenitiesLabelCohort([paris, gers], 1);
  assert.equal(cohort.length, 1);
  assert.equal(cohort[0].id, 'amenities-fr:dep:32');
  assert.equal(selectAmenitiesLabelCohort([paris, gers], 0).length, 0);
  assert.equal(selectAmenitiesLabelCohort(null).length, 0);
  assert.ok(selectAmenitiesLabelCohort(new Array(50).fill(paris)).length <= AMENITIES_FR_LABEL_COHORT_LIMIT);
});

test('the family labels are French and none of them says "école"', () => {
  for (const family of AMENITY_FAMILIES) {
    const label = amenityFamilyLabel(family);
    assert.ok(label.length > 0);
    assert.equal(/école/i.test(label), false, `${family} must not claim schools`);
  }
  assert.equal(amenityFamilyLabel(undefined), '');
});

// --- Regime ------------------------------------------------------------------

/** A camera rectangle is radians; Cesium is only asked to convert it. */
const viewerSpanning = (latDeg, lonDeg) => ({
  camera: {
    computeViewRectangle: () => ({
      south: (46 - latDeg / 2) * Math.PI / 180,
      north: (46 + latDeg / 2) * Math.PI / 180,
      west: (2 - lonDeg / 2) * Math.PI / 180,
      east: (2 + lonDeg / 2) * Math.PI / 180,
    }),
  },
});

test('the national view is entered on latitude with hysteresis, and the key changes hands inside the band', () => {
  _setAmenitiesStateForTest({ regime: 'sites' });
  // Metropolitan France is 9.8° tall; the national view starts at 9.5°.
  assert.equal(_amenitiesUpdateRegimeForTest(viewerSpanning(10, 24)), 'national');
  // 8.5° is below the enter threshold but above the exit one — it stays.
  assert.equal(_amenitiesUpdateRegimeForTest(viewerSpanning(8.5, 20)), 'national');
  assert.equal(_amenitiesUpdateRegimeForTest(viewerSpanning(4, 10)), 'maillage');
  // The LARGER span decides, because the proxy refuses a box too wide on
  // either axis. 0.30° is the band's coarse end: the sites weigh nothing yet.
  assert.equal(_amenitiesUpdateRegimeForTest(viewerSpanning(0.2, 0.3)), 'maillage');
  // Past the crossing of the two weights (0.270°) the sites own the key, and
  // the way back is the same line: inside the band both levels are drawn, so
  // there is nothing left to flicker and no hysteresis to keep.
  assert.equal(_amenitiesUpdateRegimeForTest(viewerSpanning(0.2, 0.25)), 'sites');
  assert.equal(_amenitiesUpdateRegimeForTest(viewerSpanning(0.2, 0.29)), 'maillage');
  assert.equal(_amenitiesUpdateRegimeForTest(viewerSpanning(0.2, 0.5)), 'maillage');
  _setAmenitiesStateForTest({ regime: 'national' });
});

test('a camera past the limb yields no box and an infinite span, not a NaN one', () => {
  const blind = { camera: { computeViewRectangle: () => undefined } };
  assert.deepEqual(amenitiesViewSpanDeg(blind), { lat: Infinity, max: Infinity });
  assert.equal(cameraAmenitiesBox(blind), null);
  assert.equal(amenitiesSitesBox(blind), null);
  assert.equal(amenitiesViewSpanDeg(null).lat, Infinity);
});

test('the sites box is refused by the SAME ceiling the proxy enforces', () => {
  // 0.3° of latitude and longitude, padded by 8% each way, still fits.
  assert.ok(amenitiesSitesBox(viewerSpanning(0.3, 0.3)));
  // 0.34° padded by 8% is 0.367° and does not.
  assert.equal(amenitiesSitesBox(viewerSpanning(0.34, 0.34)), null);
  assert.equal(amenitiesSitesBox(viewerSpanning(1, 1)), null);
});

// --- Fade on zoom -------------------------------------------------------------

/** Both mark levels drawn, the départements painted: the band's own state. */
const bothLevels = Object.freeze({
  regime: 'maillage', nationalReady: true, pointsReady: true, meshReady: true, sitesReady: true,
});

test('the sites band starts where the exact marks could actually load, one zoom level and a half wide', () => {
  assert.deepEqual({ ...AMENITIES_SITES_BAND }, { fine: 0.18, coarse: 0.3 });
  const ratio = AMENITIES_SITES_BAND.coarse / AMENITIES_SITES_BAND.fine;
  assert.ok(ratio >= 1.5 && ratio <= 2, `coarse/fine ${ratio}`);
  // At the coarse end the box `/sites` is asked for — the view padded by 8 %
  // each way — still fits under the proxy's 0.35° ceiling, so the request,
  // its 12 000-row cap and its rarest-first order are unchanged...
  assert.ok(amenitiesSitesBox(viewerSpanning(AMENITIES_SITES_BAND.coarse, AMENITIES_SITES_BAND.coarse)));
  // ...and the old 0.32° entry never did: the layer fell back to the maillage there.
  assert.equal(amenitiesSitesBox(viewerSpanning(0.32, 0.32)), null);
});

test('a settled view inside the band loads both levels, and a view outside it drops the other', () => {
  const inBand = planAmenitiesLevels({ lat: 0.2, max: 0.25 }, { regime: 'maillage' });
  assert.deepEqual([inBand.mesh, inBand.sites, inBand.dominant], [true, true, 'sites']);
  const close = planAmenitiesLevels({ lat: 0.1, max: 0.15 }, { regime: 'sites' });
  assert.deepEqual([close.mesh, close.sites, close.dominant], [false, true, 'sites']);
  const wide = planAmenitiesLevels({ lat: 1, max: 1.5 }, { regime: 'sites' });
  assert.deepEqual([wide.mesh, wide.sites, wide.dominant], [true, false, 'maillage']);
  // The maillage's own marks are gone by 0.30 × 0.6^0.7 = 0.210°.
  assert.equal(planAmenitiesLevels({ lat: 0.2, max: 0.205 }, { regime: 'sites' }).mesh, false);
  assert.equal(planAmenitiesLevels({ lat: 0.2, max: 0.215 }, { regime: 'sites' }).mesh, true);
  // No box the proxy would answer (a dateline view): the maillage, never a blank.
  const noBox = planAmenitiesLevels({ lat: 0.1, max: 0.15 }, { regime: 'sites', sitesBox: false });
  assert.deepEqual([noBox.mesh, noBox.sites, noBox.dominant], [true, false, 'maillage']);
  // And the national view excludes the marks altogether.
  const national = planAmenitiesLevels({ lat: 9, max: 20 }, { regime: 'national' });
  assert.deepEqual([national.national, national.mesh, national.sites], [true, false, false]);
});

test('the départements and the marks still change on a hard cut, and the level being left holds until its replacement is drawn', () => {
  for (const span of [0.15, 0.25, 0.5, 5, 9, 12, Infinity]) {
    for (const regime of ['national', 'maillage', 'sites']) {
      for (const nationalReady of [false, true]) {
        for (const pointsReady of [false, true]) {
          const alphas = amenitiesLevelAlphas(span, {
            regime, nationalReady, pointsReady, meshReady: pointsReady, sitesReady: pointsReady,
            meshArrival: 0.5, sitesArrival: 0.5,
          });
          // A share of communes is never drawn through the plates, not even mid-ramp.
          assert.ok(alphas.national === 0 || alphas.national === 1, `national ${alphas.national}`);
          assert.ok(alphas.points === 0 || alphas.points === 1, `points ${alphas.points}`);
        }
      }
    }
  }
  // Zooming in: until the marks have answered, the départements stay.
  assert.equal(amenitiesLevelAlphas(5, { regime: 'maillage', nationalReady: true }).national, 1);
  const inMarks = amenitiesLevelAlphas(5, { regime: 'maillage', nationalReady: true, pointsReady: true, meshReady: true });
  assert.deepEqual([inMarks.national, inMarks.mesh], [0, 1]);
  // Zooming out: the marks stay until the départements are painted.
  assert.equal(amenitiesLevelAlphas(12, { regime: 'national', pointsReady: true, meshReady: true }).mesh, 1);
  const out = amenitiesLevelAlphas(12, { regime: 'national', nationalReady: true, pointsReady: true, meshReady: true });
  assert.deepEqual([out.national, out.mesh, out.shared], [1, 0, 0]);
});

test('across the band a mark both levels hold stays at full strength, and only the others fade', () => {
  let previous = { mesh: 2, sites: -1 };
  for (let span = 0.32; span >= 0.16; span -= 0.005) {
    const alphas = amenitiesLevelAlphas(span, bothLevels);
    assert.equal(alphas.shared, 1, `shared mark dipped at ${span}`);
    assert.ok(alphas.mesh <= previous.mesh && alphas.sites >= previous.sites, `not monotonic at ${span}`);
    assert.ok(alphas.mesh + alphas.sites >= 1 - 1e-12, `the layer dipped at ${span}`);
    previous = alphas;
  }
  // `reveal`: the detail is in at full strength from 0.258°, well inside the band.
  assert.equal(amenitiesLevelAlphas(0.255, bothLevels).sites, 1);
  assert.ok(amenitiesLevelAlphas(0.255, bothLevels).mesh > 0);
  // Shared plates grow from the maillage's size to the exact one with the sites.
  assert.equal(amenitiesLevelAlphas(0.31, bothLevels).sharedScale, 0.8);
  assert.equal(amenitiesLevelAlphas(0.2, bothLevels).sharedScale, 1);
  // The sites landing over a drawn maillage ramp in, the maillage's own marks
  // step down in proportion, and the shared ones do not move.
  const ramp = amenitiesLevelAlphas(0.15, { ...bothLevels, sitesArrival: 0.5 });
  assert.equal(ramp.shared, 1);
  assert.ok(Math.abs(ramp.sites - 0.5) < 1e-12 && Math.abs(ramp.mesh - 0.5) < 1e-12);
  // Until the sites land, the maillage holds whatever the camera does.
  assert.equal(amenitiesLevelAlphas(0.15, { ...bothLevels, sitesReady: false }).mesh, 1);
});

const MEDECIN = AMENITY_FAMILIES.indexOf('medecin');
const PISCINE = AMENITY_FAMILIES.indexOf('piscine');
const PARIS_BOX = Object.freeze({ south: 48.7, west: 2.2, north: 48.9, east: 2.4 });

/** A maillage of two tuples and a `/sites` answer sharing one of them. */
function drawBothLevels() {
  const marks = { sites: fakePoints(), mesh: fakePoints(), shared: fakePoints() };
  const rows = [
    [48.83801, 2.34276, 3, MEDECIN],
    [48.85, 2.3, 3, PISCINE],
  ];
  _setAmenitiesStateForTest({
    regime: 'sites', enabled: true, records: new Map(), mesh: { rows, rowCount: 2 },
    points: marks.sites, meshPoints: marks.mesh, sharedPoints: marks.shared,
  });
  _amenitiesDrawLevelsForTest({
    meshBox: PARIS_BOX,
    payload: {
      sites: [
        site({ id: `a:${MEDECIN}:48.83801,2.34276` }),
        site({ id: `a:${MEDECIN}:48.84000,2.35000`, lat: 48.84, lon: 2.35 }),
      ],
    },
  });
  return marks;
}

test('inside the band a position both levels hold is drawn once, as the exact mark', () => {
  const marks = drawBothLevels();
  // The shared GP is the exact mark, at the exact plate size; the second GP
  // only the sites hold; the bassin only the maillage holds.
  assert.deepEqual(marks.shared.added.map((point) => point.id), [`a:${MEDECIN}:48.83801,2.34276`]);
  assert.equal(marks.shared.added[0].width, AMENITY_POINT_PX.medecin);
  assert.deepEqual(marks.sites.added.map((point) => point.id), [`a:${MEDECIN}:48.84000,2.35000`]);
  assert.deepEqual(marks.mesh.added.map((point) => point.id), [`a:${PISCINE}:48.85000,2.30000`]);
  assert.equal(marks.mesh.added[0].width, amenityPointSize('piscine', { mesh: true }));
  const ids = [...marks.shared.added, ...marks.sites.added, ...marks.mesh.added].map((point) => point.id);
  assert.equal(new Set(ids).size, ids.length, 'no mark is drawn twice');
  // The key belongs to the dominant level: the sites count their two marks...
  assert.equal(_amenitiesStatsForTest().count, 2);
  const sitesKey = _amenitiesRowControlsForTest().legend;
  assert.equal(sitesKey.find((row) => row.label === amenityFamilyLabel('medecin')).count, 2);
  assert.equal(sitesKey.find((row) => row.label === amenityFamilyLabel('piscine')).count, 0);
  // ...and the maillage, owning the key, counts its own two.
  _setAmenitiesStateForTest({ regime: 'maillage' });
  const meshKey = _amenitiesRowControlsForTest().legend;
  assert.equal(meshKey.find((row) => row.label === amenityFamilyLabel('medecin')).count, 1);
  assert.equal(meshKey.find((row) => row.label === amenityFamilyLabel('piscine')).count, 1);
});

test('a frame fades each class by its own weight and drops the maillage once it is out', () => {
  const marks = drawBothLevels();
  _setAmenitiesStateForTest({
    plan: planAmenitiesLevels({ lat: 0.2, max: 0.25 }, { regime: 'sites' }),
    nationalReady: true, pointsAnswered: true,
  });
  // 0.29°: the sites are coming in, the maillage's own bassin is still up.
  let frame = _amenitiesFadeFrameForTest(0.29);
  const expected = amenitiesLevelAlphas(0.29, bothLevels);
  assert.ok(expected.sites > 0 && expected.sites < 1);
  const quantised = (value) => Math.round(value * 64) / 64;
  assert.ok(Math.abs(marks.sites.added[0].color.alpha - quantised(expected.sites)) < 1e-9);
  assert.equal(marks.shared.added[0].color.alpha, 1, 'the shared mark is not faded');
  assert.ok(marks.shared.added[0].scale > 0.8 && marks.shared.added[0].scale < 1);
  assert.ok(frame.meshLevel, 'the settled view still wants the maillage');
  // The camera settles at 0.15°: the maillage is not wanted, and at zero it goes.
  _setAmenitiesStateForTest({ plan: planAmenitiesLevels({ lat: 0.1, max: 0.15 }, { regime: 'sites' }) });
  frame = _amenitiesFadeFrameForTest(0.15);
  assert.equal(frame.meshLevel, null);
  assert.equal(marks.mesh.added.length, 0);
  assert.equal(marks.mesh.show, false);
  assert.equal(frame.records.size, 2);
  assert.equal(marks.shared.added[0].scale, 1);
  assert.equal(marks.sites.added[0].color.alpha, 1);
});

test('zooming out to France swaps the marks for the départements in one frame, once they are painted', () => {
  const marks = drawBothLevels();
  const entity = { show: false };
  _setAmenitiesStateForTest({
    regime: 'national',
    plan: planAmenitiesLevels({ lat: 12, max: 20 }, { regime: 'maillage' }),
    pointsAnswered: true, nationalReady: false, overlayHost: fakeOverlayHost(),
    depEntities: new Map([['32', [entity]]]), depPaintedCodes: ['32'],
  });
  let frame = _amenitiesFadeFrameForTest(12);
  assert.equal(entity.show, false, 'the outlines are not painted yet');
  assert.equal(marks.mesh.show, true, 'so the marks hold');
  assert.ok(frame.meshLevel && frame.sitesLevel);
  _setAmenitiesStateForTest({ nationalReady: true });
  frame = _amenitiesFadeFrameForTest(12);
  assert.equal(entity.show, true);
  assert.equal(frame.depShown, true);
  assert.deepEqual([frame.meshLevel, frame.sitesLevel, frame.pointsAnswered], [null, null, false]);
  assert.equal(frame.records.size, 0);
});
