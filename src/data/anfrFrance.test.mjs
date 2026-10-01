// What the DRAWN layer is allowed to claim, once the feed's fold and the
// mesh's thinning have already been proved.
//
// ONE property runs through the whole file, and it is the one the register
// makes easy to get wrong: **a mast that has never transmitted must never be
// presentable as a mast that transmits.** `Projet approuvé` is 8.05 % of the
// observatoire (66 508 of 826 418 rows, re-counted 2026-09-02) and 3 638
// supports carry nothing else. Each test below shuts one door an approved
// project could come through: the fill, the ring, the DETECT callout, the row
// label, the legend and the card.
//
// The second property is that the two channels never impersonate each other.
// Colour is the newest generation that RADIATES; size is how many operators
// are on the mast. Neither is ever a stand-in for the other, and neither is
// ever silently absent — a support with no readable height says so, a maillage
// dot that cannot draw the upgrade ring says so, and a Cartoradio card that
// has not arrived says so instead of leaving the address out.
//
// The third is that this layer's ids are SUP_ID-keyed. 952 of the 72 700
// supports share a five-decimal coordinate with another (measured on the real
// register), so a coordinate-keyed record map would drop them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Cesium from 'cesium';

import { ANFR_SELECTED_SCALE, anfrGlyphScale } from './anfrGlyphs.js';
import anfrFranceLayer, {
  ANFR_BAND_COLORS,
  ANFR_FR_LAYER_ID,
  ANFR_FR_OVERLAY_SOURCE_ID,
  ANFR_MAST_ENTER_SPAN_DEG,
  ANFR_MAST_EXIT_SPAN_DEG,
  ANFR_MAX_BOX_DEG,
  ANFR_SECTOR_RAY_M,
  anfrBandColor,
  anfrCardOperators,
  anfrExposureLine,
  anfrNetworksLine,
  anfrPlainCommune,
  anfrMastBandsMhz,
  anfrOperatorName,
  anfrOperatorShort,
  anfrPlacementLine,
  anfrPlainText,
  anfrMastHeightM,
  anfrMastLegend,
  ANFR_SHAFT_BAND,
  ANFR_SUPPORTS_BAND,
  anfrLevelAlphas,
  planAnfrLevels,
  anfrSectorRays,
  anfrEditionLabel,
  anfrFrenchDate,
  anfrHasPlannedUpgrade,
  anfrMeshStyle,
  anfrMeshRecordId,
  anfrPointSize,
  anfrSupportId,
  anfrSupportStyle,
  anfrViewSpanDeg,
  buildAnfrLoadingLabel,
  buildAnfrMeshLabel,
  buildAnfrSelectionLabel,
  cameraAnfrBox,
  cameraAnfrMeshBox,
  createAnfrSelectedOverlayEntry,
  anfrSelectionPanel,
  pickAnfrSupportsAt,
  _anfrDetectablesForTest,
  _anfrMastTallyForTest,
  _anfrRecordForTest,
  _anfrRowControlsForTest,
  _anfrSelectedIdForTest,
  _anfrStatsForTest,
  _clearAnfrSelectionForTest,
  _expireAnfrSupportCellsForTest,
  _loadAnfrViewportForTest,
  _anfrFadeFrameForTest,
  _selectAnfrForTest,
  _setAnfrStateForTest,
} from './anfrFrance.js';
import {
  ANFR_GENERATIONS,
  ANFR_HEIGHTLESS_NATURES,
  ANFR_HEIGHT_MISSING,
  ANFR_ID,
  ANFR_LAT,
  ANFR_LON,
  ANFR_NAT,
  ANFR_HAUT,
  ANFR_OPS,
  ANFR_PLAN,
  ANFR_SVC,
  ANFR_LIVE,
  ANFR_SYS,
  anfrCsvColumns,
  anfrDecodeMask,
  anfrDistanceM,
  parseAnfrNatureTable,
  projectAnfrSupports,
  projectCartoradioAntennas,
  projectCartoradioExposure,
  projectCartoradioSupport,
  readAnfrCsvRow,
} from './anfrFeed.js';
import { buildAnfrMesh, selectAnfrMesh } from './anfrMesh.js';

// Cesium reads the aliased line-width range off a live WebGL context, and
// there is none under `node --test`, so `ContextLimits._maximumAliasedLineWidth`
// sits at 0 and every `RenderState.fromCache` throws "renderState.lineWidth is
// out of range". This layer draws points rather than lines, but the primitive
// it seats them in shares the render-state cache, and priming the limit is a
// property of the harness rather than of the layer.
const { default: ContextLimits } = await import('@cesium/engine/Source/Renderer/ContextLimits.js');
ContextLimits._maximumAliasedLineWidth = 16;

// The shafts and the azimuth rays are polylines, and a polyline carries a
// `Material`. Cesium types a material uniform by testing it against the DOM
// image classes — `uniformValue instanceof HTMLCanvasElement` and friends,
// `Material.js:1262` — and under `node --test` those identifiers do not exist,
// so a bare `Material.fromType('Color', …)` throws a ReferenceError before it
// ever reaches a GPU. Declaring the four names is a property of the harness,
// exactly like the aliased line width above: nothing here is ever an instance
// of them, so the `instanceof` chain falls through to the object branch that
// the colour and dash uniforms actually belong in.
for (const name of ['HTMLCanvasElement', 'HTMLImageElement', 'ImageBitmap', 'OffscreenCanvas']) {
  if (!(name in globalThis)) globalThis[name] = class {};
}

const read = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const norm = (value) => String(value).replace(/[\s ]+/g, ' ');

const OBSERVATOIRE = read('anfr-observatoire-sample.json');
const NATURE = read('anfr-nature-sample.json');
const CARTORADIO = read('anfr-cartoradio-sample.json');

const LINES = OBSERVATOIRE.csv.split('\n');
const COLUMNS = anfrCsvColumns(LINES[0]);
const ROWS = LINES.slice(1).filter(Boolean).map((line) => readAnfrCsvRow(line, COLUMNS));
const FOLD = projectAnfrSupports({
  rows: ROWS, natures: parseAnfrNatureTable(NATURE.text), edition: OBSERVATOIRE.edition,
});

/** Exactly what the `/supports` route serves: masks decoded to labels. */
const SUPPORTS = FOLD.supports.map((row) => ({
  id: row[ANFR_ID],
  lat: row[ANFR_LAT],
  lon: row[ANFR_LON],
  svc: row[ANFR_SVC],
  live: row[ANFR_LIVE],
  plan: row[ANFR_PLAN],
  operators: anfrDecodeMask(row[ANFR_OPS], FOLD.operators),
  systems: anfrDecodeMask(row[ANFR_SYS], FOLD.systems),
  nature: FOLD.natures[String(row[ANFR_NAT])] || null,
  heightM: row[ANFR_HAUT],
}));
const NATIONAL = {
  count: FOLD.count,
  live: FOLD.live,
  projectOnly: FOLD.projectOnly,
  plannedUpgrades: FOLD.plannedUpgrades,
  bands: FOLD.bands,
  generations: FOLD.generations,
};
const PACK = {
  supports: SUPPORTS,
  count: SUPPORTS.length,
  inBox: SUPPORTS.length,
  truncated: false,
  edition: OBSERVATOIRE.edition,
  source: FOLD.source,
  national: NATIONAL,
  fetchedAt: 1_767_000_000_000,
};
/**
 * The load-path tests draw the city view, a box under 0.35°, and the fixture's
 * supports are spread over France and its overseas territories. So for those
 * tests they are laid on a small grid in central Paris — 449714 stays where it
 * is, because its card's exposure measurement is anchored there — and the
 * stub answers as the proxy does: the supports inside the box it is asked about.
 */
const CITY_SUPPORTS = SUPPORTS.map((row, i) => (row.id === 449714
  ? row
  : { ...row, lat: 48.851 + (i % 4) * 0.002, lon: 2.326 + Math.floor(i / 4) * 0.003 }));
function supportsAnswer(url, supports = CITY_SUPPORTS) {
  const params = new URLSearchParams(url.split('?')[1]);
  const [south, west, north, east] = ['south', 'west', 'north', 'east'].map((key) => Number(params.get(key)));
  const inside = supports.filter((row) => row.lat >= south && row.lat <= north && row.lon >= west && row.lon <= east);
  return { ...PACK, supports: inside, count: inside.length, inBox: inside.length };
}
const MESH_TUPLES = buildAnfrMesh(FOLD.supports);
const MESH_PAYLOAD = {
  mesh: MESH_TUPLES,
  ...NATIONAL,
  edition: OBSERVATOIRE.edition,
  source: FOLD.source,
  fetchedAt: 1_767_000_000_000,
};
const ANTENNAS = projectCartoradioAntennas(CARTORADIO.antennes.body);
const DETAIL = {
  supId: CARTORADIO.supId,
  site: projectCartoradioSupport(CARTORADIO.site.body),
  antennas: ANTENNAS,
  exposure: projectCartoradioExposure({
    mesures: CARTORADIO.mesures.body,
    report: CARTORADIO.mesure.body,
    lat: 48.85528,
    lon: 2.33167,
    newestService: ANTENNAS.newestService,
  }),
};

const support = (id) => SUPPORTS.find((row) => row.id === id);
const makeHost = () => {
  const host = {
    entries: null,
    visible: new Map(),
    setEntries(sourceId, entries) { host.entries = entries; },
    setVisible(sourceId, value) { host.visible.set(sourceId, value); },
    clearSource() { host.entries = null; },
  };
  return host;
};
const fakeViewer = (west, south, east, north) => ({
  camera: { computeViewRectangle: () => Cesium.Rectangle.fromDegrees(west, south, east, north) },
  scene: { requestRender() {} },
});

/** Every shaft of the field, band by band: `_masts` holds one collection per look. */
const shaftsOf = (masts) => {
  const lines = [];
  for (let b = 0; b < masts.length; b += 1) {
    const band = masts.get(b);
    for (let i = 0; i < band.length; i += 1) lines.push(band.get(i));
  }
  return lines;
};
/** The shafts on screen: a spare one is hidden, waiting for a newcomer of its look. */
const drawnShafts = (masts) => shaftsOf(masts).filter((line) => line.show);

test('the layer object satisfies the manager contract it is registered under', () => {
  assert.equal(anfrFranceLayer.id, ANFR_FR_LAYER_ID);
  assert.equal(ANFR_FR_LAYER_ID, 'anfr-fr');
  assert.match(anfrFranceLayer.id, /^[a-z0-9-]+$/);
  assert.equal(anfrFranceLayer.name, 'Antennes mobiles (ANFR)');
  // NOT the ≋ of the RÉSEAUX & CAPTEURS shelf, and not anything the `radio`
  // row (internet audio streams) could be mistaken for.
  assert.equal(anfrFranceLayer.icon, '📡');
  assert.equal(typeof anfrFranceLayer.source, 'string');
  for (const method of ['init', 'enable', 'disable', 'update', 'getStats', 'getRowControls', 'getDetectableObjects', 'destroy']) {
    assert.equal(typeof anfrFranceLayer[method], 'function', method);
  }
  // The register is rebuilt weekly; the poll must not pretend otherwise.
  assert.ok(anfrFranceLayer.updateInterval >= 60 * 60_000);
});

test('the fill is the newest generation that RADIATES, and a project has none', () => {
  // 278838: eight rows, every one "Projet approuvé", across 2G/3G/4G.
  const planned = anfrSupportStyle(support(278838));
  assert.equal(planned.band, 'projet');
  assert.equal(planned.hollow, true);
  assert.equal(planned.ringed, true);
  assert.ok(planned.alpha < 0.2, 'a project is drawn hollow, not filled');
  assert.equal(planned.color, ANFR_BAND_COLORS.projet);

  // 449714: 5G technically operational over 2G/3G/4G in service.
  const live = anfrSupportStyle(support(449714));
  assert.equal(live.band, '5g');
  assert.equal(live.hollow, false);
  assert.equal(live.alpha, 1);
  assert.equal(live.color, ANFR_BAND_COLORS['5g']);

  // 325857: 3G and 4G, nothing newer.
  assert.equal(anfrSupportStyle(support(325857)).band, '4g');
  // Whatever the plan mask holds, it never reaches the fill.
  for (const row of SUPPORTS) {
    const withoutPlan = anfrSupportStyle({ ...row, plan: 0 });
    assert.equal(anfrSupportStyle(row).band, withoutPlan.band, `support ${row.id}`);
  }
});

test('the pale ring means one thing: an approved project is on file here', () => {
  // 506104 radiates 2G/3G/4G and has 5G approved — the ring is on a filled dot.
  const upgrade = anfrSupportStyle(support(506104));
  assert.equal(upgrade.ringed, true);
  assert.equal(upgrade.hollow, false);
  assert.equal(anfrHasPlannedUpgrade(support(506104)), true);

  // 449714 has a project filed on 5G, which it ALREADY radiates. That is
  // paperwork, not an upgrade, and it earns no ring — 11 830 of the 15 606
  // live supports with a project on file are exactly this case.
  assert.notEqual(support(449714).plan, 0);
  assert.equal(anfrHasPlannedUpgrade(support(449714)), false);
  assert.equal(anfrSupportStyle(support(449714)).ringed, false);

  // 22132 has no project at all.
  assert.equal(support(22132).plan, 0);
  assert.equal(anfrSupportStyle(support(22132)).ringed, false);
  assert.equal(anfrHasPlannedUpgrade({}), false);
});

test('the size is the operator count, capped at the one five-operator mast', () => {
  assert.equal(anfrPointSize(0), anfrPointSize(1));
  assert.ok(anfrPointSize(2) > anfrPointSize(1));
  assert.ok(anfrPointSize(4) > anfrPointSize(3));
  assert.equal(anfrPointSize(5), anfrPointSize(9), 'five is the measured maximum');
  assert.equal(anfrPointSize(null), anfrPointSize(1));
  // The channel is read off the resolved operator list, so the card and the
  // dot cannot disagree.
  assert.equal(anfrSupportStyle(support(506104)).operators, 5);
  assert.equal(anfrSupportStyle(support(506104)).sizePx, anfrPointSize(5));
  assert.equal(anfrSupportStyle(support(325857)).operators, 1);
});

test('the maillage draws the hollow ring and says which ring it cannot draw', () => {
  const byPosition = new Map(MESH_TUPLES.map((t) => [`${t[0]},${t[1]}`, t]));
  const plannedTuple = byPosition.get(`${support(278838).lat},${support(278838).lon}`);
  const style = anfrMeshStyle(plannedTuple);
  assert.equal(style.band, 'projet');
  assert.equal(style.hollow, true);
  assert.equal(style.ringed, true);

  // 506104's upgrade ring CANNOT be drawn from a tuple — there is no plan mask
  // in it — so the maillage draws it as an ordinary 4G dot and the row label
  // is what tells the reader the rings are missing at this zoom.
  const upgradeTuple = byPosition.get(`${support(506104).lat},${support(506104).lon}`);
  assert.equal(anfrMeshStyle(upgradeTuple).ringed, false);
  const label = buildAnfrLoadingLabel({
    regime: 'maillage',
    status: 'ready',
    loading: false,
    count: 6,
    inView: 15,
    national: NATIONAL,
    pick: { thinned: true },
  });
  assert.match(norm(label), /6 points pour 15 supports dans la vue/);
  assert.match(norm(label), /15 en France/);
  assert.match(norm(label), /projets d’extension visibles seulement en zoom/);
});

test('records are keyed by SUP_ID, so two masts on one lattice point both survive', () => {
  const host = makeHost();
  const coSited = [
    { ...support(449714), id: 900001 },
    { ...support(449714), id: 900002 },
  ];
  _setAnfrStateForTest({
    viewer: fakeViewer(2.3, 48.8, 2.4, 48.9),
    overlayHost: host,
    pack: { ...PACK, supports: coSited, count: 2, inBox: 2 },
  });
  assert.equal(_anfrStatsForTest().count, 2);
  assert.ok(_anfrRecordForTest(anfrSupportId(900001)));
  assert.ok(_anfrRecordForTest(anfrSupportId(900002)));
  assert.equal(anfrSupportId(900001), 'anfr-fr:900001');
  // A mesh id is namespaced apart, because it is a position and not an identity.
  assert.equal(anfrMeshRecordId([48.85528, 2.33167, 4, 4]), 'anfr-fr:mesh:48.85528,2.33167');
  // pickAnfrSupportsAt returns BOTH, ordered, so the card can name the co-siting.
  const here = pickAnfrSupportsAt(coSited, 48.85528, 2.33167);
  assert.equal(here.length, 2);
  assert.deepEqual(here.map((row) => row.id), [900001, 900002]);
  assert.deepEqual(pickAnfrSupportsAt(coSited, 0, 0), []);
  assert.deepEqual(pickAnfrSupportsAt(null, 0, 0), []);
  _clearAnfrSelectionForTest();
});

test('a register-wide filing convention is not news about one mast', () => {
  // Measured over the whole file: every technically-operational row is 5G and
  // no 5G row is ever "En service". That is how ANFR files 5G nationally, not
  // a fact about the mast under the cursor — so the card used to carry a
  // caveat that fired on every 5G mast in France, which reads as a caveat
  // about THAT mast. The distinction stays in the DATA and leaves the copy.
  for (const row of SUPPORTS) {
    const fiveG = Boolean(row.live & (1 << ANFR_GENERATIONS.indexOf('5G')));
    assert.equal(Boolean(row.live & ~row.svc), fiveG, `support ${row.id}`);
  }
  const copy = norm(buildAnfrSelectionLabel({ support: support(449714) }, PACK));
  assert.doesNotMatch(copy, /Techniquement opérationnel|déclarée ouverte au public/);
  // Colour still reads `live`, which is the channel the distinction feeds.
  assert.equal(anfrSupportStyle(support(449714)).band, '5g');

  // Nothing anywhere on the card promises a speed, a coverage or a verdict —
  // the three questions people arrive with that this register cannot answer.
  for (const row of SUPPORTS) {
    const card = norm(buildAnfrSelectionLabel({ support: row, detail: DETAIL }, PACK));
    assert.doesNotMatch(card, /débit|Mb\/s|couvert|sans danger|inoffensif|sans risque/i, `support ${row.id}`);
  }
});

test('the networks line says what is on the air, and what a project would ADD — never a re-filing', () => {
  // `Projet approuvé` is the register's phrase and the most misread field in
  // this dataset — 8.05 % of the file, and a reader who takes it for a
  // transmitter has been misled. The card says what it IS: planned.
  assert.equal(anfrNetworksLine(support(506104)), 'Réseaux : 4G, 3G, 2G · 5G prévue');
  assert.equal(anfrNetworksLine(support(278838)), 'Prévu : 4G, 3G, 2G — pas encore installé');
  // A RE-FILING TAKES NO WORD: an operator lodging a dossier for a band
  // already on the air is paperwork, true of 11 830 of the 15 606 live
  // supports that carry a project.
  assert.equal(anfrNetworksLine(support(449714)), 'Réseaux : 5G, 4G, 3G, 2G');
  assert.equal(anfrNetworksLine(support(22132)), 'Réseaux : 4G, 3G, 2G');
  assert.equal(anfrNetworksLine({}), 'N’émet pas');
});

test('the selection card is five short lines a first-time reader can follow', () => {
  const raw = buildAnfrSelectionLabel({ support: support(449714), detail: DETAIL }, PACK);
  // What it is and whose, what it carries, where, the waves, the source — one
  // line each, and nothing a reader would have to look up: no frequency, no
  // register number, no licence, no antenna count.
  assert.deepEqual(raw.split('\n').map(norm), [
    'Antenne 5G · 4 opérateurs',
    'Orange, SFR, Bouygues, Free',
    'Réseaux : 5G, 4G, 3G, 2G',
    'Sur un toit, à 65 m de haut · Paris 6e',
    'Ondes mesurées à 40 m en 2009, avant les antennes actuelles : trop faibles pour être mesurées',
    'Source : ANFR, 27 août 2026',
  ]);
  assert.doesNotMatch(raw, /MHz|GHz|ANFR n°|Licence|FH|Propriétaire|FREE MOBILE|BOUYGUES TELECOM/);

  // 325857 publishes a height of 0 and is an `Intérieur galerie` — the SAME
  // fact: all 551 heightless supports are underground or indoor, so the card
  // says so rather than printing a hole where a number should be.
  const zeroHeight = norm(buildAnfrSelectionLabel({ support: support(325857) }, PACK));
  assert.match(zeroHeight, /Sous terre, sans mât/);
  assert.doesNotMatch(zeroHeight, /de 0 m/);

  // A support that radiates nothing says so in its title, and never as "5G".
  const planned = buildAnfrSelectionLabel({ support: support(278838) }, PACK).split('\n').map(norm);
  assert.equal(planned[0], 'Antenne en projet · 2 opérateurs');
  assert.equal(planned[2], 'Prévu : 4G, 3G, 2G — pas encore installé');
});

test('the plain-French pass expands the register and names what a mast stands on', () => {
  assert.equal(anfrOperatorName('FREE MOBILE'), 'Free Mobile');
  assert.equal(anfrOperatorName('SFR'), 'SFR');
  assert.equal(anfrOperatorName(''), '');
  // ANFR files addresses on a paper form, in capitals and truncations.
  assert.equal(anfrPlainText('30 R PETRICOT RES HORIZON'), '30 rue Petricot résidence Horizon');
  assert.equal(anfrPlainText('PARIS 6E ARRONDISSEMENT'), 'Paris 6e Arrondissement');
  // Mixed case upstream is a name somebody typed: expand, never re-case.
  assert.equal(anfrPlainText('Ets public , Minist, Synd mixt'), 'Établissement public, Ministère, Syndicat mixte');
  assert.equal(anfrPlainText("Lieu d'habitation"), 'Lieu d’habitation');
  assert.equal(anfrPlainText(null), '');
  // The commune alone: `Arrondissement` is dropped, the street is not printed.
  assert.equal(anfrPlainCommune({ address: '9 R DE GRENELLE', commune: 'PARIS 7E ARRONDISSEMENT' }), 'Paris 7e');
  assert.equal(anfrPlainCommune(null), '');

  // The 38 natures fold into what a reader can picture; the rest keep their name.
  assert.equal(anfrPlacementLine('Immeuble', 35), 'Sur un toit, à 35 m de haut');
  assert.equal(anfrPlacementLine('Bâtiment', 12), 'Sur un toit, à 12 m de haut');
  assert.equal(anfrPlacementLine('Pylône autostable', 42), 'Pylône de 42 m');
  assert.equal(anfrPlacementLine('Mât béton', 12.4), 'Mât de 12 m');
  assert.equal(anfrPlacementLine('Intérieur sous-terrain', null), 'Sous terre, sans mât');
  assert.equal(anfrPlacementLine('Phare', 30), 'Phare, 30 m');
  assert.equal(anfrPlacementLine('Pylône haubané', null), 'Pylône');
  assert.equal(anfrPlacementLine(null, null), 'Type de support non publié');

  // The brand, not the corporate name, in the order readers know them.
  assert.equal(anfrOperatorShort('FREE MOBILE'), 'Free');
  assert.equal(anfrOperatorShort('BOUYGUES TELECOM'), 'Bouygues');
  assert.equal(anfrOperatorShort('SFR'), 'SFR');
  assert.deepEqual(anfrCardOperators({ operators: ['FREE MOBILE', 'SFR', 'ORANGE', 'BOUYGUES TELECOM'] }),
    ['Orange', 'SFR', 'Bouygues', 'Free']);
  assert.deepEqual(anfrCardOperators({}), []);
});

test('the card says it is loading, and answers who is on the mast before the detail lands', () => {
  const pending = buildAnfrSelectionLabel({ support: support(449714), detailPending: true }, PACK);
  assert.match(norm(pending), /Chargement…/);
  // A failed detail costs its two lines — the commune and the waves — and no
  // error message a reader cannot act on.
  const failed = norm(buildAnfrSelectionLabel({ support: support(449714), detailError: 'HTTP 503' }, PACK));
  assert.doesNotMatch(failed, /HTTP 503|⚠/);
  // "Who is on this mast" is the reason the reader clicked, and the
  // observatoire answers it without waiting for Cartoradio.
  const bare = norm(buildAnfrSelectionLabel({ support: support(449714) }, PACK));
  assert.match(bare, /Orange, SFR, Bouygues, Free/);
  assert.match(bare, /Réseaux : 5G, 4G, 3G, 2G/);
  assert.doesNotMatch(bare, /V\/m|Ondes/);
});

test('the waves are ONE line: how far, when, and a multiple of the legal limit — never a verdict', () => {
  // 0,0 V/m measured in 2009, forty metres away, beside equipment from 2025,
  // and blind to 700, 800, 2600 and 3500 MHz: a global of zero is the
  // protocol's floor, not a reassuring number, and a report older than the
  // antennas beside it measured a DIFFERENT installation.
  assert.equal(norm(anfrExposureLine(DETAIL)),
    'Ondes mesurées à 40 m en 2009, avant les antennes actuelles : trop faibles pour être mesurées');
  assert.deepEqual(anfrMastBandsMhz(DETAIL), [700, 800, 900, 1800, 2100, 2600, 3500]);
  assert.deepEqual(anfrMastBandsMhz(null), []);

  // A RECENT report: 0,55 V/m against the strictest ceiling in its own report,
  // 28 V/m — "51 fois sous la limite légale", a multiple a worried reader can
  // hold. Still older than the 2025 equipment, and still said.
  const recent = {
    ...DETAIL,
    exposure: projectCartoradioExposure({
      mesures: CARTORADIO.mesures.body,
      report: CARTORADIO.mesureRecente.body,
      lat: 48.85528,
      lon: 2.33167,
      newestService: ANTENNAS.newestService,
    }),
  };
  const fresh = norm(anfrExposureLine(recent));
  assert.equal(fresh, 'Ondes mesurées à 40 m en 2024, avant les antennes actuelles : 51 fois sous la limite légale');
  assert.doesNotMatch(fresh, /sans danger|conforme aux normes|aucun risque/i);

  // No measurement in the radius is stated, not left blank.
  assert.equal(norm(anfrExposureLine({ exposure: { within: 0, radiusM: 300, nearest: null, report: null } })),
    'Aucune mesure d’ondes publiée à moins de 300 m');
  assert.equal(anfrExposureLine(null), null);
  assert.equal(anfrFrenchDate('2025-07-18'), '18/07/2025');
  assert.equal(anfrFrenchDate('18/07/2025'), null);
  assert.equal(anfrEditionLabel('2026-08-27'), '27 août 2026');
  assert.equal(anfrEditionLabel('nope'), null);
});

test('the maillage card is true at first paint, and short', () => {
  const tuple = MESH_TUPLES.find((t) => t[3] === 4);
  // The tuple carries the newest generation and the operator count, so the
  // title is already the support's own.
  assert.equal(norm(buildAnfrMeshLabel({ tuple })), 'Antenne 5G · 2 opérateurs');
  assert.equal(buildAnfrMeshLabel({ tuple, lookupPending: true }), 'Antenne 5G · 2 opérateurs\nChargement…');
  for (const record of [{ tuple, lookupError: 'HTTP 500' }, { tuple, lookupEmpty: true }]) {
    assert.match(norm(buildAnfrMeshLabel(record)), /Rapprochez-vous pour voir cette antenne en détail\./);
  }
  const planned = MESH_TUPLES.find((t) => t[3] === 0);
  if (planned) assert.match(norm(buildAnfrMeshLabel({ tuple: planned })), /^Antenne en projet/);
});

test('selecting a support runs the production path and publishes one protected card', async () => {
  const host = makeHost();
  const calls = [];
  const http = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => DETAIL };
  };
  _setAnfrStateForTest({
    viewer: fakeViewer(2.3, 48.8, 2.4, 48.9), overlayHost: host, pack: PACK, http,
  });
  const id = anfrSupportId(449714);
  _selectAnfrForTest(id);
  assert.equal(_anfrSelectedIdForTest(), id);
  assert.equal(host.entries.length, 1);
  const entry = host.entries[0];
  assert.equal(entry.id, id);
  assert.equal(entry.protected, true);
  assert.equal(entry.selected, true);
  assert.equal(entry.priority, Number.MAX_SAFE_INTEGER);
  assert.equal(norm(entry.title), 'Antenne 5G · 4 opérateurs');

  // The Cartoradio fetch is one call for the clicked mast, and the card is
  // repainted with it when it lands.
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['/api/anfr-fr/support/449714']);
  assert.match(norm(host.entries[0].details.join('\n')), /Paris 6e/);
  assert.ok(host.entries[0].details.some((line) => line.startsWith('Ondes mesurées à 40 m')));

  // Selecting the same mast again does not re-ask.
  _selectAnfrForTest(id);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls.length, 1);

  _clearAnfrSelectionForTest();
  assert.equal(_anfrSelectedIdForTest(), null);
  assert.equal(host.entries, null);
});

test('the key card names the place, rings each network in its dot colour, and folds what each operator runs', () => {
  // Lot 2 of the approved mock (2026-09-22): the card moved from over the
  // mast to the map key, under the classes it is read against.
  const record = { id: anfrSupportId(449714), support: support(449714), detail: DETAIL };
  const panel = anfrSelectionPanel(record, PACK, { recordId: record.id, status: 'ready', share: 0.28, radiusM: 39_000 });
  assert.equal(panel.key, record.id, 'one key for the life of the selection, so the key reveals it once');
  assert.equal(panel.title, 'Paris 6e', 'the place is the name once Cartoradio has answered');
  assert.deepEqual(panel.meta.map(norm), ['Sur un toit, à 65 m de haut', 'Orange · SFR · Bouygues · Free']);
  assert.equal(panel.chips.outline, true, 'ringed: the 2G slate cannot carry black text');
  assert.deepEqual(panel.chips.items, ['2G', '3G', '4G', '5G'].map((label) => ({
    label, color: ANFR_BAND_COLORS[label.toLowerCase()],
  })));
  assert.equal(norm(panel.metric.value), '28 % · rayon 39 km');
  assert.equal(panel.metric.heading, 'Visibilité du terrain');
  assert.match(panel.metric.caption, /pas une couverture radio/, 'the line of sight is never called coverage');
  assert.deepEqual(panel.lines.map(norm), [
    'Ondes mesurées à 40 m en 2009, avant les antennes actuelles : trop faibles pour être mesurées',
  ]);
  assert.equal(norm(panel.footnote), 'Source : ANFR, 27 août 2026');
  assert.equal(norm(panel.list.summary), 'Voir les équipements · 30 antennes');
  assert.deepEqual(panel.list.items.map((item) => norm(item.text)), [
    'Orange · 5G, 4G, 3G, 2G · 8 antennes',
    'SFR · 5G, 4G, 3G, 2G · 6 antennes',
    'Bouygues · 5G, 4G · 8 antennes',
    'Free · 5G, 4G · 8 antennes',
  ]);
  // The card's refusals hold in the key: no frequency, no corporate name.
  assert.doesNotMatch(JSON.stringify(panel), /MHz|GHz|FREE MOBILE|BOUYGUES TELECOM/);
});

test('before Cartoradio answers, the key card is titled like the globe card and says what it waits for', () => {
  const id = anfrSupportId(449714);
  const pending = anfrSelectionPanel({ id, support: support(449714), detailPending: true }, PACK,
    { recordId: id, status: 'loading' });
  assert.equal(norm(pending.title), 'Antenne 5G · 4 opérateurs');
  assert.equal(pending.key, id);
  assert.deepEqual(pending.lines.map(norm), ['Chargement…', 'Calcul de la zone d’où l’on voit l’antenne…']);
  assert.equal(pending.metric, null);
  assert.equal(pending.list, null, 'no button that opens onto nothing');
  // Another mast's line of sight is not this one's.
  assert.equal(anfrSelectionPanel({ id, support: support(449714) }, PACK,
    { recordId: 'anfr-fr:1', status: 'ready', share: 0.5, radiusM: 10_000 }).metric, null);

  // A planned antenna has no plate: nothing is on the air.
  const planned = anfrSelectionPanel({ id: anfrSupportId(278838), support: support(278838) }, PACK);
  assert.equal(norm(planned.title), 'Antenne en projet · 2 opérateurs');
  assert.equal(planned.chips, null);
  assert.deepEqual(planned.lines.map(norm), ['Prévu : 4G, 3G, 2G — pas encore installé']);

  // A maillage dot whose support is not known yet prints the globe card's lines.
  const tuple = MESH_TUPLES.find((t) => t[3] === 4);
  const dot = anfrSelectionPanel({ id: 'anfr-fr:mesh:1', mesh: true, tuple, lookupPending: true }, PACK);
  assert.equal(norm(dot.title), 'Antenne 5G · 2 opérateurs');
  assert.deepEqual(dot.lines, ['Chargement…']);
  assert.equal(anfrSelectionPanel(null), null);
});

test('with the map key on screen the globe keeps a tag, the key gets the card, and its close clears both', async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const events = [];
  globalThis.window = { dispatchEvent: (event) => events.push(event) };
  globalThis.document = {
    documentElement: { dataset: {} },
    getElementById: (id) => (id === 'map-legend'
      ? { hidden: false, classList: { contains: () => false }, getClientRects: () => [{}] }
      : null),
    addEventListener() {},
    removeEventListener() {},
  };
  try {
    const host = makeHost();
    _setAnfrStateForTest({
      viewer: fakeViewer(2.3, 48.8, 2.4, 48.9),
      overlayHost: host,
      pack: PACK,
      http: async () => ({ ok: true, json: async () => DETAIL }),
    });
    const id = anfrSupportId(449714);
    _selectAnfrForTest(id);
    assert.equal(norm(host.entries[0].title), 'Antenne 5G · 4 opérateurs');
    assert.deepEqual(host.entries[0].details, [], 'a tag, not a card, over the mast');
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(host.entries[0].title, 'Paris 6e', 'the tag takes the place name with the card');
    assert.ok(events.some((event) => event.type === 'gev:layer-draw-changed'),
      'the key is asked to repaint at once rather than at the six-hour poll');

    const controls = _anfrRowControlsForTest();
    assert.equal(controls.legendSelection.title, 'Paris 6e');

    events.length = 0;
    assert.equal(anfrFranceLayer.clearSelectedCard(), true);
    assert.equal(_anfrSelectedIdForTest(), null);
    assert.equal(host.entries, null);
    assert.equal(events.length, 1);
    assert.equal(_anfrRowControlsForTest().legendSelection, undefined);
    assert.equal(anfrFranceLayer.clearSelectedCard(), false, 'nothing left to close');
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('a maillage click asks the register for the identity, once, and caches a miss', async () => {
  const host = makeHost();
  const calls = [];
  const http = async (url) => {
    calls.push(url);
    if (url.startsWith('/api/anfr-fr/supports')) {
      return { ok: true, json: async () => ({ supports: [support(449714)] }) };
    }
    return { ok: true, json: async () => DETAIL };
  };
  const pick = selectAnfrMesh(MESH_TUPLES, { box: { south: 48.8, west: 2.3, north: 48.9, east: 2.4 } });
  _setAnfrStateForTest({
    viewer: fakeViewer(2.3, 48.8, 2.4, 48.9),
    overlayHost: host,
    mesh: MESH_PAYLOAD,
    meshPick: pick,
    regime: 'maillage',
    http,
  });
  const id = anfrMeshRecordId([48.85528, 2.33167, 4, 4]);
  assert.ok(_anfrRecordForTest(id), 'the Paris dot is in the pick');
  _selectAnfrForTest(id);
  // First paint: the band and the operator count, truthfully, with no identity.
  assert.match(norm(host.entries[0].title), /^Antenne 5G · \d+ opérateurs?$/);
  assert.deepEqual(host.entries[0].details, ['Chargement…']);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls[0].startsWith('/api/anfr-fr/supports?'), true);
  // The lookup box is ~110 m wide, because ANFR positions sit on a ~31 m
  // arc-second lattice and a wider box would sweep in the neighbour.
  const params = new URLSearchParams(calls[0].split('?')[1]);
  assert.ok(Number(params.get('north')) - Number(params.get('south')) < 0.002);
  assert.equal(norm(host.entries[0].title), 'Antenne 5G · 4 opérateurs');
  assert.equal(host.entries[0].details[0], 'Orange, SFR, Bouygues, Free');

  // A dot the register cannot name is cached as unnameable, not re-asked.
  const missHost = makeHost();
  const missCalls = [];
  const missHttp = async (url) => {
    missCalls.push(url);
    return { ok: true, json: async () => ({ supports: [] }) };
  };
  _setAnfrStateForTest({
    viewer: fakeViewer(2.3, 48.8, 2.4, 48.9),
    overlayHost: missHost,
    mesh: MESH_PAYLOAD,
    meshPick: pick,
    regime: 'maillage',
    http: missHttp,
  });
  _selectAnfrForTest(id);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(missHost.entries[0].details, ['Rapprochez-vous pour voir cette antenne en détail.']);
  _selectAnfrForTest(id);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(missCalls.length, 1);
  _clearAnfrSelectionForTest();
});

test('DETECT is never offered a mast that has never transmitted', () => {
  const host = makeHost();
  _setAnfrStateForTest({ viewer: fakeViewer(2.3, 48.8, 2.4, 48.9), overlayHost: host, pack: PACK });
  const candidates = _anfrDetectablesForTest();
  assert.equal(candidates.length, SUPPORTS.length - FOLD.projectOnly);
  assert.equal(candidates.some((c) => c.sourceId === anfrSupportId(278838)), false);
  for (const candidate of candidates) {
    assert.equal(candidate.type, 'Antenna mast');
    assert.doesNotMatch(candidate.id, /PROJET/);
    assert.ok(candidate.position instanceof Cesium.Cartesian3);
    assert.match(candidate.id, /^(2G|3G|4G|5G)/);
  }
  // The cap and the stride are honoured, so the detector never gets more than
  // it asked for.
  assert.equal(_anfrDetectablesForTest({ maxCount: 3 }).length, 3);
  assert.equal(_anfrDetectablesForTest({ maxCount: 1, seed: 7 }).length, 1);
  _clearAnfrSelectionForTest();
  assert.deepEqual(_anfrDetectablesForTest(), [], 'a disabled layer offers nothing');
});

test('the legend is one plain name per colour, and keeps the project row at zero', () => {
  const host = makeHost();
  _setAnfrStateForTest({ viewer: fakeViewer(2.3, 48.8, 2.4, 48.9), overlayHost: host, pack: PACK });
  const { legend, chips } = _anfrRowControlsForTest();
  // No chips while the server has no coverage map: a chip is a clickable
  // button that dispatches `chip.params`, and one that does nothing is a lie.
  assert.deepEqual(chips, []);
  // Newest generation first, which is the order the map is read in.
  assert.deepEqual(legend.map((row) => row.color).slice(0, 2), [
    ANFR_BAND_COLORS['5g'], ANFR_BAND_COLORS['4g'],
  ]);
  assert.deepEqual(legend.map((row) => row.label), ['Antenne 5G', 'Antenne 4G', 'En projet, n’émet pas']);
  assert.equal(legend.find((row) => row.color === ANFR_BAND_COLORS['5g']).count, FOLD.bands['5g']);
  // A colour key names the colour. The national statistics it used to carry
  // were true and were a paragraph under every swatch.
  for (const row of legend) assert.equal(row.blurb, undefined, row.label);

  // With nothing drawn there is no legend to draw either.
  _clearAnfrSelectionForTest();
  assert.deepEqual(_anfrRowControlsForTest(), { chips: [], legend: [] });
});

test('the row label counts the rings it is drawing, in the singular when there is one', () => {
  const host = makeHost();
  _setAnfrStateForTest({ viewer: fakeViewer(2.3, 48.8, 2.4, 48.9), overlayHost: host, pack: PACK });
  const label = norm(buildAnfrLoadingLabel());
  assert.match(label, /^15 supports/);
  assert.match(label, /1 projet approuvé, rien n’émet/);
  assert.match(label, /4 extensions autorisées/);
  assert.equal(norm(buildAnfrLoadingLabel({ loading: true })), 'lecture du registre ANFR...');
  assert.equal(buildAnfrLoadingLabel({ status: 'error' }), '');
  assert.equal(
    buildAnfrLoadingLabel({ regime: 'supports', count: 0, records: new Map() }),
    'aucun support ANFR dans cette vue',
  );
  _clearAnfrSelectionForTest();
});

test('getStats surfaces the honesty numbers and the guidance, never a fake zero', () => {
  const host = makeHost();
  _setAnfrStateForTest({ viewer: fakeViewer(2.3, 48.8, 2.4, 48.9), overlayHost: host, pack: PACK });
  const stats = _anfrStatsForTest();
  assert.equal(stats.status, 'ok');
  assert.equal(stats.count, 15);
  assert.equal(stats.regime, 'supports');
  assert.equal(stats.supportsNational, FOLD.count);
  assert.equal(stats.projectOnly, FOLD.projectOnly);
  assert.equal(stats.plannedUpgrades, FOLD.plannedUpgrades);
  assert.equal(stats.edition, '2026-08-27');
  assert.equal('error' in stats, false);
  assert.ok(stats.loadingLabel);
  const summary = anfrFranceLayer.getViewportSummary();
  assert.equal(summary.regime, 'supports');
  assert.equal(summary.drawn, 15);
  assert.equal('supports' in summary, false, 'the rows are not repeated into the summary');
  _clearAnfrSelectionForTest();
});

test('the camera decides the regime, and never asks for a box the proxy refuses', async () => {
  assert.equal(ANFR_MAX_BOX_DEG, 0.35);
  const wide = fakeViewer(-5, 41, 10, 51.5);
  assert.equal(cameraAnfrBox(wide), null, 'a national view is above the ceiling');
  assert.ok(cameraAnfrMeshBox(wide), 'the maillage has no ceiling');
  assert.ok(anfrViewSpanDeg(wide).lat > 10);
  const tight = fakeViewer(2.30, 48.84, 2.36, 48.88);
  const box = cameraAnfrBox(tight);
  assert.ok(box.north - box.south <= ANFR_MAX_BOX_DEG);
  assert.ok(box.east - box.west <= ANFR_MAX_BOX_DEG);
  // The padded maillage box is wider than the view, so a dot does not pop in
  // at the screen edge.
  const padded = cameraAnfrMeshBox(tight);
  assert.ok(padded.north > box.north && padded.south < box.south);
  assert.equal(anfrViewSpanDeg({}).lat, Infinity);
  assert.equal(cameraAnfrBox({}), null);
  assert.equal(cameraAnfrMeshBox({}), null);
});

test('a wide view loads the maillage and a tight one loads the supports', async () => {
  const host = makeHost();
  const asked = [];
  const http = async (url) => {
    asked.push(url.split('?')[0]);
    if (url.startsWith('/api/anfr-fr/mesh')) return { ok: true, json: async () => MESH_PAYLOAD };
    if (url.startsWith('/api/anfr-fr/supports')) return { ok: true, json: async () => supportsAnswer(url) };
    return { ok: true, json: async () => DETAIL };
  };
  _setAnfrStateForTest({ overlayHost: host, http, regime: 'maillage' });
  const national = await _loadAnfrViewportForTest(fakeViewer(-5, 41, 10, 51.5));
  assert.equal(national.regime, 'maillage');
  assert.equal(asked[0], '/api/anfr-fr/mesh');
  assert.ok(national.count > 0);
  assert.equal(national.status, 'ready');

  const street = await _loadAnfrViewportForTest(fakeViewer(2.30, 48.84, 2.36, 48.88));
  assert.equal(street.regime, 'supports');
  assert.equal(asked[asked.length - 1], '/api/anfr-fr/supports');
  assert.equal(street.count, 15);
  _clearAnfrSelectionForTest();
});

test('in the city view a pan of 11 m, a zoom in and a return ask the register nothing', async () => {
  const asked = [];
  const http = async (url) => {
    asked.push(url);
    return { ok: true, json: async () => supportsAnswer(url) };
  };
  _setAnfrStateForTest({ overlayHost: makeHost(), http, regime: 'maillage' });
  const first = await _loadAnfrViewportForTest(fakeViewer(2.3013, 48.8413, 2.3587, 48.8787));
  assert.equal(first.regime, 'supports');
  assert.equal(first.count, 15);
  assert.equal(asked.length, 1);
  // The box the register is asked about is snapped to the cell grid, so the
  // same ground is always the same URL — which the browser can then keep.
  const params = new URLSearchParams(asked[0].split('?')[1]);
  assert.equal(params.get('south'), '48.82500');
  assert.equal(params.get('east'), '2.37500');

  assert.equal((await _loadAnfrViewportForTest(fakeViewer(2.3014, 48.8414, 2.3588, 48.8788))).count, 15);
  const closer = await _loadAnfrViewportForTest(fakeViewer(2.330, 48.853, 2.334, 48.857));
  const inCloser = CITY_SUPPORTS.filter((row) => row.lat >= 48.853 && row.lat <= 48.857
    && row.lon >= 2.330 && row.lon <= 2.334);
  assert.ok(inCloser.length > 0 && inCloser.length < 15);
  assert.equal(closer.count, inCloser.length, 'the zoom draws what is inside the new box, and only that');
  assert.equal((await _loadAnfrViewportForTest(fakeViewer(2.3013, 48.8413, 2.3587, 48.8787))).count, 15);
  assert.equal(asked.length, 1, 'three camera stops, no request');
  _clearAnfrSelectionForTest();
});

test('with the masts put out the layer asks the register nothing and keys no mast, and they come back on request', async () => {
  const host = makeHost();
  const asked = [];
  const http = async (url) => {
    asked.push(url.split('?')[0]);
    if (url.startsWith('/api/anfr-fr/mesh')) return { ok: true, json: async () => MESH_PAYLOAD };
    return { ok: true, json: async () => supportsAnswer(url) };
  };
  const viewer = fakeViewer(2.30, 48.84, 2.36, 48.88);
  _setAnfrStateForTest({ viewer, overlayHost: host, http, pack: PACK });
  _selectAnfrForTest(anfrSupportId(SUPPORTS[0].id));
  assert.ok(_anfrSelectedIdForTest());

  // The « Antennes » tile put out while « Couverture 4G » is lit.
  assert.equal(anfrFranceLayer.setParams({ masts: false }), true);
  assert.equal(_anfrSelectedIdForTest(), null, 'the selected mast goes with the masts');
  assert.deepEqual(_anfrRowControlsForTest().legend, [], 'no mast class for masts nobody sees');
  assert.equal(anfrFranceLayer.getStats().count, 0);
  assert.equal(anfrFranceLayer.getStats().mastsShown, false);
  assert.deepEqual(_anfrDetectablesForTest(), []);
  asked.length = 0;
  const hidden = await _loadAnfrViewportForTest(viewer);
  assert.deepEqual(asked, [], 'a pan asks the register nothing');
  assert.equal(hidden.count, 0);

  anfrFranceLayer.setParams({ masts: true });
  const shown = await _loadAnfrViewportForTest(viewer);
  assert.equal(shown.count, 15);
  assert.ok(asked.includes('/api/anfr-fr/supports'));
  _clearAnfrSelectionForTest();
});

test('a failed refresh keeps the map it has and says the refresh failed', async () => {
  const host = makeHost();
  let fail = false;
  const http = async (url) => {
    if (fail) throw new Error('ECONNREFUSED');
    if (url.startsWith('/api/anfr-fr/supports')) return { ok: true, json: async () => supportsAnswer(url) };
    return { ok: true, json: async () => MESH_PAYLOAD };
  };
  _setAnfrStateForTest({ overlayHost: host, http, regime: 'maillage' });
  const first = await _loadAnfrViewportForTest(fakeViewer(2.30, 48.84, 2.36, 48.88));
  assert.equal(first.count, 15);
  fail = true;
  // Six hours later: the poll asks the register again, and the register is down.
  _expireAnfrSupportCellsForTest();
  const second = await _loadAnfrViewportForTest(fakeViewer(2.30, 48.84, 2.36, 48.88), { force: true });
  // Fifteen real masts are still fifteen real masts. Blanking the screen would
  // say France has no antennas.
  assert.equal(second.count, 15);
  assert.equal(second.status, 'ready');
  assert.match(second.error, /rafraîchissement du registre ANFR indisponible/);

  // With nothing drawn at all, the failure is an error state and not an empty
  // country.
  _setAnfrStateForTest({ overlayHost: host, http, regime: 'maillage' });
  const cold = await _loadAnfrViewportForTest(fakeViewer(2.30, 48.84, 2.36, 48.88), { force: true });
  assert.equal(cold.count, 0);
  assert.equal(cold.status, 'error');
  assert.match(cold.error, /registre ANFR indisponible/);
  assert.equal(_anfrStatsForTest().status, 'error');
  _clearAnfrSelectionForTest();
});

test('a malformed payload is refused rather than drawn as an empty France', async () => {
  const host = makeHost();
  const http = async () => ({ ok: true, json: async () => ({ nope: true }) });
  _setAnfrStateForTest({ overlayHost: host, http, regime: 'maillage' });
  const result = await _loadAnfrViewportForTest(fakeViewer(-5, 41, 10, 51.5));
  assert.equal(result.count, 0);
  assert.equal(result.status, 'error');
  // The reader gets a French sentence; `malformed payload` stays in the console.
  assert.equal(result.error, 'maillage national ANFR indisponible');
  _clearAnfrSelectionForTest();
});

test('the maillage says when the camera is simply not over France', () => {
  // `layerFeedState()` renders `empty` as a green ON chip, so a blank row and a
  // broken row look identical. The sentence is what tells them apart.
  assert.equal(
    buildAnfrLoadingLabel({
      regime: 'maillage', status: 'ready', loading: false, count: 0, inView: 0, national: NATIONAL,
    }),
    'aucun support ANFR dans cette vue',
  );
  // Before anything at all has loaded there is nothing honest to say.
  assert.equal(
    buildAnfrLoadingLabel({
      regime: 'maillage', status: 'ready', loading: false, count: 0, inView: 0, national: null,
    }),
    '',
  );
});

test('init builds the three real collections, and the draw path fills them', async () => {
  // The seams above run the card and legend paths with `point: null`. This one
  // runs the production `reconcileSupports` against a real
  // BillboardCollection, so the style a test asserts on is the style a
  // primitive actually receives. (There is no canvas under node, so the
  // billboards carry no image: what is asserted is their scale.) The two polyline collections beside it are
  // the world-space channel: shafts, and the selected mast's azimuth rays.
  const added = [];
  const viewer = {
    ...fakeViewer(2.30, 48.84, 2.36, 48.88),
    scene: {
      requestRender() {},
      primitives: {
        add(primitive) { added.push(primitive); return primitive; },
        remove(primitive) { return added.splice(added.indexOf(primitive), 1).length > 0; },
        contains() { return true; },
        raiseToTop() {},
      },
    },
  };
  anfrFranceLayer.init(viewer);
  assert.equal(added.length, 5);
  assert.equal(added[0].constructor, Cesium.BillboardCollection);
  assert.equal(added[1].constructor, Cesium.PrimitiveCollection, 'the shafts, one collection per look');
  assert.equal(added[2].constructor, Cesium.PolylineCollection, 'the azimuth rays');
  // The two other classes of marks the fade on zoom draws: the maillage's
  // dots, and the supports the maillage also draws.
  assert.equal(added[3].constructor, Cesium.BillboardCollection);
  assert.equal(added[4].constructor, Cesium.BillboardCollection);

  const http = async (url) => ({
    ok: true,
    json: async () => (url.startsWith('/api/anfr-fr/supports') ? supportsAnswer(url) : MESH_PAYLOAD),
  });
  _setAnfrStateForTest({ viewer, overlayHost: makeHost(), http, regime: 'maillage' });
  // `_setAnfrStateForTest` does not touch the collection init() made, so the
  // real load path below is what puts primitives in it.
  const result = await _loadAnfrViewportForTest(viewer);
  assert.equal(result.regime, 'supports');
  assert.equal(added[0].length, 15, 'one primitive per support in the box');

  const record = _anfrRecordForTest(anfrSupportId(449714));
  assert.ok(record.point, 'the record holds its primitive');
  assert.equal(record.point.scale, anfrGlyphScale(record.style.sizePx));
  const before = record.point.scale;
  _selectAnfrForTest(record.id);
  assert.ok(record.point.scale > before, 'selection grows the real primitive');
  _clearAnfrSelectionForTest();
  assert.equal(record.point.scale, before, 'and clearing restores it');

  anfrFranceLayer.destroy(viewer);
  assert.equal(added.length, 0, 'destroy removes every collection it added');
});

test('a reload of the view keeps the selected mast and its card, and lets go once it leaves', async () => {
  // Every camera settle rebuilds the dots. It used to clear the selection with
  // them, so the card the reader had just opened closed on the next pan.
  const added = [];
  const viewer = {
    ...fakeViewer(2.30, 48.84, 2.36, 48.88),
    scene: {
      requestRender() {},
      primitives: {
        add(primitive) { added.push(primitive); return primitive; },
        remove(primitive) { return added.splice(added.indexOf(primitive), 1).length > 0; },
        contains() { return true; },
        raiseToTop() {},
      },
    },
  };
  anfrFranceLayer.init(viewer);
  let pack = PACK;
  const http = async (url) => ({
    ok: true,
    json: async () => (url.startsWith('/api/anfr-fr/supports') ? pack : MESH_PAYLOAD),
  });
  const host = makeHost();
  _setAnfrStateForTest({ viewer, overlayHost: host, http, regime: 'maillage' });
  await _loadAnfrViewportForTest(viewer);
  const id = anfrSupportId(449714);
  _selectAnfrForTest(id);
  const selectedSize = _anfrRecordForTest(id).point.scale;
  assert.equal(selectedSize, ANFR_SELECTED_SCALE);

  await _loadAnfrViewportForTest(viewer, { force: true });
  assert.equal(_anfrSelectedIdForTest(), id, 'still selected after the rebuild');
  assert.equal(_anfrRecordForTest(id).point.scale, selectedSize, 'and still lit, on its new dot');
  assert.equal(host.entries?.[0]?.id, id, 'its card is still published');

  pack = { ...PACK, supports: PACK.supports.filter((row) => row.id !== 449714) };
  _expireAnfrSupportCellsForTest();
  await _loadAnfrViewportForTest(viewer, { force: true });
  assert.equal(_anfrSelectedIdForTest(), null, 'gone from the view, gone from the selection');
  assert.equal(host.entries, null);

  anfrFranceLayer.destroy(viewer);
});

test('the overlay entry is anchored, protected and single', () => {
  const record = {
    id: anfrSupportId(449714),
    support: support(449714),
    position: Cesium.Cartesian3.fromDegrees(2.33167, 48.85528, 2.5),
  };
  const entry = createAnfrSelectedOverlayEntry(record, PACK);
  assert.equal(entry.collisionGroup, 'ambient-card');
  assert.equal(entry.paintLane, 'selected');
  assert.equal(entry.interactive, false);
  assert.equal(entry.horizonCull, true);
  // Before the detail lands: who, what, where, and the source.
  assert.equal(entry.title, 'Antenne 5G · 4 opérateurs');
  assert.deepEqual(entry.details, [
    'Orange, SFR, Bouygues, Free', 'Réseaux : 5G, 4G, 3G, 2G', 'Sur un toit, à 65 m de haut', 'Source : ANFR, 27 août 2026',
  ]);
  assert.equal(createAnfrSelectedOverlayEntry({ id: 'x' }), null);
  assert.equal(createAnfrSelectedOverlayEntry(null), null);
  assert.equal(ANFR_FR_OVERLAY_SOURCE_ID, 'anfr-fr-selected');
  assert.equal(anfrBandColor('nope'), ANFR_BAND_COLORS.projet);
});

// ── The world-space channel: the support drawn at its real height ───────────
// One property holds through the six tests below, and it is B2's: the QUANTITY
// is a length in metres of the world, and no screen-space channel is composed
// with it. The dot's pixel size is still the operator count and is multiplied
// by nothing; the shaft's pixel width is a constant that carries nothing. The
// second property is A1's: 551 supports of the register publish no height, and
// none of them gets a default one — they get no shaft at all, and the count
// travels with the row label, the legend and the card.

const heightlessId = anfrSupportId(325857);

test('the shaft is the published height, and there is none where there is none', () => {
  // 325857 is the fixture's underground support: the register leaves its
  // height blank because there is no mast to measure. It is one of the three
  // natures that hold all 551 blanks nationally.
  const blank = support(325857);
  assert.equal(blank.heightM, null);
  assert.ok(ANFR_HEIGHTLESS_NATURES.includes(blank.nature));
  assert.equal(anfrMastHeightM(blank), null);
  // A zero and a negative are the same refusal, for the same reason: the
  // register writes 0 where nobody filled the field in.
  assert.equal(anfrMastHeightM({ heightM: 0 }), null);
  assert.equal(anfrMastHeightM({ heightM: -12 }), null);
  assert.equal(anfrMastHeightM({}), null);
  assert.equal(anfrMastHeightM(null), null);
  // And a published one is passed through in metres, unscaled and unclassed —
  // there is no thematic mapping to invert here.
  assert.equal(anfrMastHeightM(support(437710)), 308);
  assert.equal(anfrMastHeightM(support(449714)), 65);

  _setAnfrStateForTest({ overlayHost: makeHost(), pack: PACK, regime: 'supports', mastRegime: true });
  const tally = _anfrMastTallyForTest();
  assert.equal(tally.masts + tally.unpublished, SUPPORTS.length);
  assert.equal(tally.unpublished, 1, 'the one blank in the fixture, counted');
  assert.equal(tally.clipped, 0);
  _clearAnfrSelectionForTest();
});

test('the dot rides the top of its shaft, and stays on the ground without one', () => {
  _setAnfrStateForTest({ overlayHost: makeHost(), pack: PACK, regime: 'supports', mastRegime: true });
  const tall = _anfrRecordForTest(anfrSupportId(437710));
  const flat = _anfrRecordForTest(heightlessId);
  const lift = (record) => Cesium.Cartographic.fromCartesian(record.position).height
    - Cesium.Cartographic.fromCartesian(record.groundPosition).height;
  // 308 m of support is 308 m of lift, to within the ellipsoid round trip.
  assert.ok(Math.abs(lift(tall) - 308) < 0.5);
  // No height, no lift: the dot and the foot of the missing shaft are the same
  // point, which is exactly what "no measurement" should look like.
  assert.ok(Math.abs(lift(flat)) < 1e-6);
  // The pixel channel is untouched by any of it — the dot is still sized by
  // the operator count, and nothing multiplies it (B2).
  assert.equal(tall.style.sizePx, anfrPointSize(tall.support.operators.length));
  assert.equal(flat.style.sizePx, anfrPointSize(flat.support.operators.length));
  _clearAnfrSelectionForTest();
});

test('the shafts fade in across their own band, nested inside the exact regime', () => {
  // The old enter / exit pair is now the band's two ends: nothing left to
  // flicker, since inside it the field is drawn at a weight, not switched.
  assert.deepEqual({ ...ANFR_SHAFT_BAND }, { fine: ANFR_MAST_ENTER_SPAN_DEG, coarse: ANFR_MAST_EXIT_SPAN_DEG });
  assert.equal(ANFR_SHAFT_BAND.coarse / ANFR_SHAFT_BAND.fine, 1.5);
  assert.ok(ANFR_MAST_EXIT_SPAN_DEG < ANFR_SUPPORTS_BAND.fine, 'and the whole band sits under the supports at full strength');
  assert.equal(planAnfrLevels(0.05).shafts, true);
  assert.equal(planAnfrLevels(0.085).shafts, true, 'inside the band the field is built, faint');
  assert.equal(planAnfrLevels(0.1).shafts, false);
  assert.equal(planAnfrLevels(Infinity).shafts, false);
  assert.equal(planAnfrLevels(NaN).shafts, false);
  // Full strength from 0.09 × (2/3)^0.3 = 0.080°, so every view that drew
  // shafts before still draws them whole.
  const close = { supportsReady: true, shaftsReady: true };
  assert.equal(anfrLevelAlphas(0.079, close).shafts, 1);
  assert.equal(anfrLevelAlphas(0.06, close).shafts, 1);
  assert.ok(anfrLevelAlphas(0.085, close).shafts > 0 && anfrLevelAlphas(0.085, close).shafts < 1);
  assert.equal(anfrLevelAlphas(0.1, close).shafts, 0);
  // A field built where there was none ramps in, and none stands on nothing.
  assert.equal(anfrLevelAlphas(0.05, { ...close, shaftsArrival: 0.5 }).shafts, 0.5);
  assert.equal(anfrLevelAlphas(0.05, { shaftsReady: true }).shafts, 0);

  // The maillage tuple has no height in it, so the shafts cannot follow the
  // camera down there even if the span would allow it.
  _setAnfrStateForTest({
    overlayHost: makeHost(), mesh: MESH_PAYLOAD, regime: 'maillage', mastRegime: true,
  });
  assert.equal(_anfrMastTallyForTest().mastRegime, false);
  assert.equal(_anfrMastTallyForTest().masts, 0);
  assert.deepEqual(anfrMastLegend({ regime: 'maillage', mastRegime: true }), [],
    'and no height key is published beside a map that draws no shafts');
  _clearAnfrSelectionForTest();
});

test('the mast key states the ABSENCES and publishes no size ladder', () => {
  // The house rule (PR #138): `#map-legend` carries the COLOUR channel, not the
  // FORM channel. A shaft under a dot is decoded right without a key.
  _setAnfrStateForTest({ overlayHost: makeHost(), pack: PACK, regime: 'supports', mastRegime: true });
  const { legend } = _anfrRowControlsForTest();
  const labels = legend.map((row) => row.label);
  assert.equal(labels.filter((label) => /^\d+ m$/.test(label)).length, 0, 'the size ladder is gone');

  // A1 — what survives is the mark that is NOT THERE. A dot with no shaft reads
  // as a short mast, which is the one way a form is decoded WRONG unaided, so
  // it keeps its row, its count and a hatch rather than a tint (D3).
  const blank = legend.find((row) => row.label === 'Sous terre, sans mât');
  assert.equal(blank.count, 1);
  assert.ok(blank.glyph?.startsWith('data:image/svg+xml'));
  // The band ramp is untouched: the absence rows are appended, never mixed in.
  assert.equal(labels.indexOf('Antenne 5G'), 0);
  _clearAnfrSelectionForTest();
});

test('the ceiling and the azimuths only take a row when they have something to say', () => {
  assert.deepEqual(
    anfrMastLegend({
      regime: 'supports', mastRegime: true, mastsUnpublished: 0, mastsClipped: 0, sectors: 0,
    }),
    [],
    'every shaft drawn at its height is a key with nothing to disclose',
  );
  const full = anfrMastLegend({
    regime: 'supports', mastRegime: true, mastsUnpublished: 2, mastsClipped: 7, sectors: 3,
  });
  assert.deepEqual(full.map((row) => row.label), [
    'Sous terre, sans mât', 'Mâts non dessinés : trop nombreux ici', 'Direction des antennes',
  ]);
  assert.deepEqual(full.map((row) => row.count), [2, 7, 3]);
  // The rays are bearings; their length is a drawing convention, and the one
  // row that shows them says so.
  assert.equal(full[2].blurb, 'Longueur des traits indicative.');
});

test('the row label tells the three empties apart', () => {
  // A4 — no shaft on screen can mean too far to draw one, no height published,
  // or the cap biting. Three causes, three sentences.
  const far = buildAnfrLoadingLabel({
    regime: 'supports', status: 'ready', loading: false, count: 15, inView: 15,
    records: new Map(), mastRegime: false, masts: 0, mastsUnpublished: 0, mastsClipped: 0,
  });
  assert.ok(far.includes('vue rapprochée'));
  assert.ok(!far.includes('sans hauteur publiée'));

  const near = buildAnfrLoadingLabel({
    regime: 'supports', status: 'ready', loading: false, count: 15, inView: 15,
    records: new Map(), mastRegime: true, masts: 14, mastsUnpublished: 1, mastsClipped: 3,
  });
  assert.ok(near.includes('14 fûts à leur hauteur'));
  assert.ok(near.includes('1 sans hauteur publiée, sans fût'), 'singular, and A1');
  assert.ok(near.includes('3 fûts écrêtés par le plafond'), 'A5 — the cap declares itself');

  const plural = buildAnfrLoadingLabel({
    regime: 'supports', status: 'ready', loading: false, count: 15, inView: 15,
    records: new Map(), mastRegime: true, masts: 10, mastsUnpublished: 5, mastsClipped: 0,
  });
  assert.ok(plural.includes('5 sans hauteur publiée, sans fût'));
  // The maillage never mentions shafts at all: it has no heights to draw.
  const mesh = buildAnfrLoadingLabel({
    regime: 'maillage', status: 'ready', loading: false, count: 3, inView: 9,
    national: NATIONAL, pick: { thinned: true }, mastRegime: false,
  });
  assert.ok(!mesh.includes('fût'));
});

test('the rays are the published bearings, and refuse to imply a range', () => {
  // The azimuth is NOT in the observatoire — it comes from the Cartoradio card
  // of the mast the reader clicked, one mast at a time. What is drawn is a
  // bearing at a published mounting height, and nothing else.
  const { rays, bearings, unplaced, unaimed } = anfrSectorRays(DETAIL);
  assert.ok(rays.length > 0);
  assert.equal(unplaced, 0);
  assert.equal(unaimed, 0);
  assert.ok(bearings.includes(0), 'zero is north, and it is drawn');
  assert.deepEqual(bearings, [...new Set(bearings)].sort((a, b) => a - b));
  assert.ok(bearings.length < rays.length, 'the card lists bearings, the map draws pairs');

  // A bearing with no mounting height is REFUSED, not seated on the mast's own
  // height: those are two different published numbers and swapping them would
  // be an invention that looks measured.
  const partial = anfrSectorRays({
    antennas: {
      withoutAzimuth: 2,
      azimuths: [
        { deg: 120, heightM: 30, antennas: 3 },
        { deg: 240, heightM: null, antennas: 1 },
        { deg: NaN, heightM: 30, antennas: 1 },
      ],
    },
  });
  assert.deepEqual(partial.rays, [{ deg: 120, heightM: 30, antennas: 3 }]);
  assert.equal(partial.unplaced, 1);
  assert.equal(partial.unaimed, 2);
  assert.deepEqual(anfrSectorRays(null).rays, []);

  // The card no longer lists them: the rays ARE the bearings, drawn.
});

test('the drawn shafts and rays are world geometry, and go away with the selection', async () => {
  // The production path, against real primitive collections: this is where a
  // length in metres either is a length in metres or is not.
  const added = [];
  const viewer = {
    ...fakeViewer(2.325, 48.850, 2.340, 48.860),
    scene: {
      requestRender() {},
      canvas: {},
      preRender: { addEventListener: () => () => {} },
      primitives: {
        add(primitive) { added.push(primitive); return primitive; },
        remove(primitive) { return added.splice(added.indexOf(primitive), 1).length > 0; },
        contains() { return true; },
        raiseToTop() {},
      },
    },
  };
  anfrFranceLayer.init(viewer);
  const [, masts, sectors] = added;

  const http = async (url) => ({ ok: true, json: async () => supportsAnswer(url) });
  _setAnfrStateForTest({ viewer, overlayHost: makeHost(), http, regime: 'maillage' });
  // A 0.015° box is inside the shaft sub-regime, so the load path draws them.
  await _loadAnfrViewportForTest(viewer);
  assert.equal(_anfrMastTallyForTest().mastRegime, true);
  assert.equal(drawnShafts(masts).length, 14, 'one shaft per published height, and none for the blank');
  assert.equal(masts.show, true);

  // The shaft's LENGTH is the support's height, in metres of the world. This
  // is the B2 assertion: nothing screen-space is composed with it.
  const line = drawnShafts(masts)[0];
  const foot = Cesium.Cartographic.fromCartesian(line.positions[0]);
  const top = Cesium.Cartographic.fromCartesian(line.positions[1]);
  assert.ok(Math.abs(foot.longitude - top.longitude) < 1e-12, 'the shaft is vertical');
  const drawn = top.height - foot.height;
  const heights = SUPPORTS.map((row) => row.heightM).filter((value) => value > 0);
  assert.ok(heights.some((value) => Math.abs(value - drawn) < 0.5), `${drawn} is a published height`);

  // A support that radiates nothing gets a dashed shaft: its height is a
  // figure on an authorised file, not a measurement of something built.
  const materials = new Set();
  for (const shaft of drawnShafts(masts)) materials.add(shaft.material.type);
  assert.ok(materials.has('Color'));
  assert.ok(materials.has('PolylineDash'), 'the project-only support is dashed');

  // Now the rays. Nothing is drawn until a support is selected AND its
  // Cartoradio card has arrived, because that card is where the bearings are.
  assert.equal(sectors.show, false);
  _setAnfrStateForTest({
    viewer, overlayHost: makeHost(), http, pack: PACK, regime: 'supports',
    mastRegime: true, details: [[449714, DETAIL]],
  });
  _selectAnfrForTest(anfrSupportId(449714));
  const expected = anfrSectorRays(DETAIL).rays.length;
  assert.equal(_anfrMastTallyForTest().sectors, expected);
  assert.equal(sectors.length, expected);
  assert.equal(sectors.show, true);
  // Every ray is exactly the declared 60 m, horizontal, at its own mounting
  // height — a direction, never a coverage radius.
  for (let i = 0; i < sectors.length; i += 1) {
    const [near, far] = sectors.get(i).positions;
    const a = Cesium.Cartographic.fromCartesian(near);
    const b = Cesium.Cartographic.fromCartesian(far);
    assert.ok(Math.abs(a.height - b.height) < 0.5, 'horizontal');
    const metres = anfrDistanceM(
      Cesium.Math.toDegrees(a.latitude), Cesium.Math.toDegrees(a.longitude),
      Cesium.Math.toDegrees(b.latitude), Cesium.Math.toDegrees(b.longitude),
    );
    assert.ok(Math.abs(metres - ANFR_SECTOR_RAY_M) < 0.5, `${metres} m`);
  }
  // ONE MATERIAL PER RAY, and the same colour on every one of them.
  //
  // The instances have to be distinct because `Polyline._destroy()` destroys
  // its own material and Cesium's `destroyObject` is not idempotent: a fan of
  // 33 rays sharing one instance is 32 throws waiting for the next teardown.
  // The COLOUR has to be identical because that — not the instance — is what
  // Cesium batches on: `sortPolylinesIntoBuckets` keys on `material.type` and
  // the draw pass splits commands on type plus uniform VALUES, so 33 cyan
  // instances are still one draw command.
  const rayMaterials = [...Array(sectors.length)].map((_, i) => sectors.get(i).material);
  assert.equal(new Set(rayMaterials).size, sectors.length, 'no ray shares an instance');
  assert.equal(new Set(rayMaterials.map((m) => `${m.type}|${m.uniforms.color.toCssColorString()}`)).size, 1,
    'and they all wear the same cyan, so they still batch into one command');

  // Deselecting takes the rays down and leaves the shafts alone: they belong
  // to two different questions.
  _clearAnfrSelectionForTest();
  assert.equal(sectors.show, false);
  for (let i = 0; i < sectors.length; i += 1) assert.equal(sectors.get(i).show, false);

  anfrFranceLayer.destroy(viewer);
  assert.equal(added.length, 0);
});

test('a shaft owns its material, so a teardown does not destroy the same one twice', async () => {
  // The bug this closes was silent in every previous test because the fake
  // `primitives.remove` above never destroys. Cesium's does — and
  // `Polyline._destroy()` calls `this._material.destroy()` unconditionally
  // while `destroyObject` replaces every method with a thrower. So two shafts
  // holding one memoized material meant the second `destroy()` threw
  // `DeveloperError`, on `disable()` (which calls `removeAll()`) and on
  // `destroy()` (which calls `primitives.remove()`) alike.
  //
  // Proved first on bare Cesium so the property is anchored to the engine and
  // not to this layer's plumbing.
  const positions = [Cesium.Cartesian3.fromDegrees(2.3, 48.8), Cesium.Cartesian3.fromDegrees(2.4, 48.9)];
  const shared = Cesium.Material.fromType('Color', { color: Cesium.Color.RED });
  const sharing = new Cesium.PolylineCollection();
  sharing.add({ positions, width: 2, material: shared });
  sharing.add({ positions, width: 2, material: shared });
  assert.throws(() => sharing.destroy(), /destroyed/, 'a shared material throws on the second destroy');

  const owning = new Cesium.PolylineCollection();
  owning.add({ positions, width: 2, material: Cesium.Material.fromType('Color', { color: Cesium.Color.RED }) });
  owning.add({ positions, width: 2, material: Cesium.Material.fromType('Color', { color: Cesium.Color.RED }) });
  owning.destroy();

  // Now the layer itself, on real collections, torn down twice over: the
  // `removeAll()` inside `disable()` and then a real `destroy()`.
  const added = [];
  const viewer = {
    ...fakeViewer(2.325, 48.850, 2.340, 48.860),
    scene: {
      requestRender() {},
      canvas: {},
      preRender: { addEventListener: () => () => {} },
      primitives: {
        add(primitive) { added.push(primitive); return primitive; },
        // The real thing: `PrimitiveCollection.remove` destroys what it drops.
        remove(primitive) {
          const at = added.indexOf(primitive);
          if (at < 0) return false;
          added.splice(at, 1);
          primitive.destroy();
          return true;
        },
        contains() { return true; },
        raiseToTop() {},
      },
    },
  };
  anfrFranceLayer.init(viewer);
  const [, masts, sectors] = added;
  const http = async (url) => ({ ok: true, json: async () => supportsAnswer(url) });
  _setAnfrStateForTest({ viewer, overlayHost: makeHost(), http, regime: 'maillage' });
  await _loadAnfrViewportForTest(viewer);
  const shafts = shaftsOf(masts);
  assert.ok(shafts.length > 1, 'more than one shaft, or there is nothing to double-destroy');
  const shaftMaterials = shafts.map((shaft) => shaft.material);
  assert.equal(new Set(shaftMaterials).size, shafts.length, 'no shaft shares an instance');

  _setAnfrStateForTest({
    viewer, overlayHost: makeHost(), http, pack: PACK, regime: 'supports',
    mastRegime: true, details: [[449714, DETAIL]],
  });
  _selectAnfrForTest(anfrSupportId(449714));
  assert.ok(sectors.length > 1, 'more than one ray, likewise');

  anfrFranceLayer.disable(viewer);
  anfrFranceLayer.destroy(viewer);
  assert.equal(added.length, 0);
  assert.equal(masts.isDestroyed(), true);
  assert.equal(sectors.isDestroyed(), true);
});

test('the drawn shafts are one collection per look, so the field is a handful of draw commands', async () => {
  // Cesium opens a new `DrawCommand` every time two CONSECUTIVE polylines of a
  // bucket disagree on `type + uniform values`. In register order the five
  // appearances interleave, so the fullest 0.09° box (1 913 shafts) could cost
  // 1 913 commands for what is at most five distinct looks. One collection per
  // look is what collapses that — whatever order its shafts come and go in,
  // which is what lets a rest keep a shaft by its support rather than rewrite
  // the field in band order.
  const added = [];
  const viewer = {
    ...fakeViewer(2.325, 48.850, 2.340, 48.860),
    scene: {
      requestRender() {},
      canvas: {},
      preRender: { addEventListener: () => () => {} },
      primitives: {
        add(primitive) { added.push(primitive); return primitive; },
        remove(primitive) { return added.splice(added.indexOf(primitive), 1).length > 0; },
        contains() { return true; },
        raiseToTop() {},
      },
    },
  };
  anfrFranceLayer.init(viewer);
  const [, masts] = added;
  const http = async (url) => ({ ok: true, json: async () => supportsAnswer(url) });
  _setAnfrStateForTest({ viewer, overlayHost: makeHost(), http, regime: 'maillage' });
  await _loadAnfrViewportForTest(viewer);

  const looks = new Set();
  for (let b = 0; b < masts.length; b += 1) {
    const band = masts.get(b);
    assert.equal(band.constructor, Cesium.PolylineCollection);
    const inBand = new Set();
    for (let i = 0; i < band.length; i += 1) {
      const material = band.get(i).material;
      inBand.add(`${material.type}|${material.uniforms.color.toCssColorString()}`);
    }
    assert.equal(inBand.size, 1, 'a collection holds one look, so it is one command in any order');
    looks.add([...inBand][0]);
  }
  assert.ok(looks.size > 1, 'this fixture has more than one band, or the test proves nothing');
  assert.equal(looks.size, masts.length, 'and no look is split over two collections');
  assert.ok(masts.length <= 5);
  assert.equal(drawnShafts(masts).length, _anfrMastTallyForTest().masts);

  anfrFranceLayer.destroy(viewer);
});

/** A viewer whose camera box a test can move, over real collections that count their adds. */
function countingViewer(box) {
  const added = [];
  const counts = { billboards: 0, removed: 0, shafts: 0 };
  const viewer = {
    camera: { computeViewRectangle: () => Cesium.Rectangle.fromDegrees(box.west, box.south, box.east, box.north) },
    scene: {
      requestRender() {},
      canvas: {},
      preRender: { addEventListener: () => () => {} },
      primitives: {
        add(primitive) { added.push(primitive); return primitive; },
        remove(primitive) { return added.splice(added.indexOf(primitive), 1).length > 0; },
        contains() { return true; },
        raiseToTop() {},
      },
    },
  };
  anfrFranceLayer.init(viewer);
  // The supports, the shafts, the rays, then the maillage's dots and the
  // supports the maillage also draws: every billboard class is counted.
  const [points, masts, , meshPoints, sharedPoints] = added;
  for (const collection of [points, meshPoints, sharedPoints]) {
    const addBillboard = collection.add.bind(collection);
    collection.add = (options) => {
      counts.billboards += 1;
      return addBillboard(options);
    };
    const removeBillboard = collection.remove.bind(collection);
    collection.remove = (billboard) => {
      counts.removed += 1;
      return removeBillboard(billboard);
    };
  }
  const addBand = masts.add.bind(masts);
  masts.add = (band, index) => {
    const addShaft = band.add.bind(band);
    band.add = (options) => {
      counts.shafts += 1;
      return addShaft(options);
    };
    return addBand(band, index);
  };
  return { viewer, points, meshPoints, sharedPoints, masts, counts };
}

test('a rest on the same masts creates no primitive, and a pan creates only its newcomers', async () => {
  // Every rest used to empty the dots and add one per mast in view: 2 954
  // billboards destroyed and re-created per rest over Paris at 5 km. A mast
  // that stays in view now keeps its record, its billboard and its shaft; a
  // leaver's billboard is removed and a newcomer's added, and a newcomer's
  // shaft is one a leaver of the same look put away.
  const box = { west: 2.325, south: 48.850, east: 2.340, north: 48.860 };
  const { viewer, points, masts, counts } = countingViewer(box);
  let rows = CITY_SUPPORTS;
  const http = async (url) => ({ ok: true, json: async () => supportsAnswer(url, rows) });
  _setAnfrStateForTest({ viewer, overlayHost: makeHost(), http, regime: 'maillage' });
  await _loadAnfrViewportForTest(viewer);
  assert.equal(_anfrMastTallyForTest().mastRegime, true, 'close enough for shafts');
  assert.equal(counts.billboards, SUPPORTS.length);
  assert.equal(counts.shafts, 14);
  const record = (row) => _anfrRecordForTest(anfrSupportId(row.id));
  const first = new Map(CITY_SUPPORTS.map((row) => [row.id, record(row)]));
  const billboards = new Map(CITY_SUPPORTS.map((row) => [row.id, record(row).point]));
  const shafts = new Set(drawnShafts(masts));

  // The same masts again — a rest that did not move, or a refresh.
  await _loadAnfrViewportForTest(viewer, { force: true });
  assert.equal(counts.billboards, SUPPORTS.length, 'no billboard created');
  assert.equal(counts.removed, 0, 'none removed');
  assert.equal(counts.shafts, 14, 'no shaft created');
  for (const row of CITY_SUPPORTS) {
    assert.equal(record(row), first.get(row.id), 'the same record');
    assert.equal(record(row).point, billboards.get(row.id), 'on the same billboard');
  }
  assert.deepEqual(new Set(drawnShafts(masts)), shafts, 'the same shafts');

  // A pan: three masts leave, three arrive with the same looks.
  const leaving = CITY_SUPPORTS.slice(0, 3);
  const arriving = leaving.map((row, i) => ({ ...row, id: 990_000 + i, lat: row.lat + 0.002 }));
  rows = [...CITY_SUPPORTS.slice(3), ...arriving];
  // The register answers differently now: the cells are asked for again.
  _expireAnfrSupportCellsForTest();
  await _loadAnfrViewportForTest(viewer, { force: true });
  assert.equal(counts.billboards, SUPPORTS.length + 3, 'three billboards for three newcomers');
  assert.equal(counts.removed, 3, 'and three removed for three leavers');
  assert.equal(points.length, SUPPORTS.length);
  assert.equal(counts.shafts, 14, 'the newcomers stand on the leavers\' shafts');
  for (const row of CITY_SUPPORTS.slice(3)) {
    assert.equal(record(row), first.get(row.id));
    assert.equal(record(row).point, billboards.get(row.id));
  }
  for (const row of leaving) assert.equal(record(row), null);
  for (const row of arriving) {
    const arrived = record(row);
    assert.equal(arrived.point.id, arrived.id);
    assert.ok(Cesium.Cartesian3.equals(arrived.point.position, arrived.position));
  }
  assert.equal(drawnShafts(masts).length, _anfrMastTallyForTest().masts);

  // A rest that only re-dresses masts it kept — here the register lit 5G on
  // one of them — writes that billboard and asks for one vertex rebuild,
  // through one hidden add and remove (see `rebuildMarksOnce`).
  const upgraded = CITY_SUPPORTS.slice(3).find((row) => row.live && !(row.live & 8));
  assert.ok(upgraded, 'the fixture has a mast without 5G');
  rows = rows.map((row) => (row === upgraded ? { ...row, live: row.live | 8 } : row));
  const before = { ...counts };
  _expireAnfrSupportCellsForTest();
  await _loadAnfrViewportForTest(viewer, { force: true });
  assert.equal(record(upgraded).style.band, '5g');
  assert.equal(record(upgraded).point, billboards.get(upgraded.id), 'the same billboard, re-dressed');
  assert.equal(record(upgraded).point.scale, anfrGlyphScale(record(upgraded).style.sizePx));
  assert.equal(counts.billboards - before.billboards, 1);
  assert.equal(counts.removed - before.removed, 1);
  assert.equal(points.length, SUPPORTS.length, 'and the collection holds one billboard per mast');

  anfrFranceLayer.destroy(viewer);
});

test('the maillage keeps its dots across a pan and draws only the ones that come back', async () => {
  const box = { west: -5, south: 41, east: 10, north: 51.5 };
  const { viewer, meshPoints: points, counts } = countingViewer(box);
  const http = async () => ({ ok: true, json: async () => MESH_PAYLOAD });
  _setAnfrStateForTest({ viewer, overlayHost: makeHost(), http, regime: 'maillage' });
  const all = await _loadAnfrViewportForTest(viewer);
  assert.equal(all.regime, 'maillage');
  const drawn = all.count;
  assert.ok(drawn > 5);
  assert.equal(counts.billboards, drawn);
  const billboardOf = new Map(MESH_TUPLES.map((tuple) => [anfrMeshRecordId(tuple), _anfrRecordForTest(anfrMeshRecordId(tuple))?.point]));

  // A pan that keeps every dot in view re-picks the same dots: nothing is drawn.
  Object.assign(box, { west: -4.5, east: 10.5 });
  await _loadAnfrViewportForTest(viewer, { force: true });
  assert.equal(counts.billboards, drawn);
  assert.equal(counts.removed, 0);
  for (const [id, point] of billboardOf) if (point) assert.equal(_anfrRecordForTest(id).point, point);

  // A pan that leaves part of Paris behind the west edge: the leavers go, and
  // the ones that stay keep their billboards.
  Object.assign(box, { west: 2.448, south: 48.5, east: 3.448, north: 49.5 });
  const part = await _loadAnfrViewportForTest(viewer, { force: true });
  assert.ok(part.count > 0 && part.count < drawn, `${part.count} of ${drawn} still in view`);
  assert.equal(counts.billboards, drawn, 'nothing created to draw fewer');
  assert.equal(counts.removed, drawn - part.count);
  assert.equal(points.length, part.count);
  for (const [id, point] of billboardOf) {
    const kept = _anfrRecordForTest(id);
    if (kept) assert.equal(kept.point, point);
  }

  // And back: only the dots that left are drawn again.
  Object.assign(box, { west: -5, south: 41, east: 10, north: 51.5 });
  const back = await _loadAnfrViewportForTest(viewer, { force: true });
  assert.equal(back.count, drawn);
  assert.equal(counts.billboards, drawn + (drawn - part.count));
  assert.equal(points.length, drawn);

  anfrFranceLayer.destroy(viewer);
});

// --- Fade on zoom: maillage → supports ---------------------------------------

test('the supports band ends at the box ceiling, one zoom level and a half wide', () => {
  assert.deepEqual({ ...ANFR_SUPPORTS_BAND }, { fine: 0.21, coarse: ANFR_MAX_BOX_DEG });
  const ratio = ANFR_SUPPORTS_BAND.coarse / ANFR_SUPPORTS_BAND.fine;
  assert.ok(ratio >= 1.5 && ratio <= 2, `coarse/fine ${ratio}`);
  // `/supports` is asked about the camera box unpadded: a view at the coarse
  // end is a box the proxy answers, and its fullest case is still under the
  // render cap.
  const edge = fakeViewer(2.2, 48.7, 2.549, 49.049);
  assert.ok(cameraAnfrBox(edge));
  assert.equal(planAnfrLevels(0.349).supports, true, 'and the supports are asked for there');
});

test('a settled view inside the band loads the maillage and the supports, and a view outside drops the other', () => {
  const inBand = planAnfrLevels(0.33);
  assert.deepEqual([inBand.mesh, inBand.supports, inBand.shafts, inBand.dominant], [true, true, false, 'maillage']);
  // The supports own the key from 0.314°, where the two weights cross.
  assert.equal(planAnfrLevels(0.31).dominant, 'supports');
  assert.equal(planAnfrLevels(0.32).dominant, 'maillage');
  // The maillage's own dots are gone by 0.35 × 0.6^0.7 = 0.245°.
  assert.deepEqual([planAnfrLevels(0.24).mesh, planAnfrLevels(0.24).supports], [false, true]);
  assert.equal(planAnfrLevels(0.25).mesh, true);
  // Above the ceiling, the maillage alone; with no box to ask about, too.
  assert.deepEqual([planAnfrLevels(0.5).mesh, planAnfrLevels(0.5).supports], [true, false]);
  assert.deepEqual([planAnfrLevels(0.3, { supportsBox: false }).supports, planAnfrLevels(0.3, { supportsBox: false }).dominant],
    [false, 'maillage']);
});

test('across the band a support the maillage also draws stays at full strength, and only the others fade', () => {
  const both = { meshReady: true, supportsReady: true };
  let previous = { mesh: 2, supports: -1 };
  for (let span = 0.37; span >= 0.2; span -= 0.005) {
    const alphas = anfrLevelAlphas(span, both);
    assert.equal(alphas.shared, 1, `shared dipped at ${span}`);
    assert.ok(alphas.mesh <= previous.mesh && alphas.supports >= previous.supports);
    assert.ok(alphas.mesh + alphas.supports >= 1 - 1e-12, `dipped at ${span}`);
    // A shared support (alpha 1, about 0.8 from its own distance fade) over
    // its fading maillage dot: the mark goes from the dot's 1.0 to the
    // support's 0.8 without ever going under it.
    const composite = 1 - (1 - 0.8 * alphas.shared) * (1 - alphas.mesh);
    assert.ok(composite >= 0.8 - 1e-12 && composite <= 1 + 1e-12);
    previous = alphas;
  }
  // The supports landing over a drawn maillage ramp in; the maillage holds for them until then.
  assert.equal(anfrLevelAlphas(0.15, { meshReady: true }).mesh, 1);
  const ramp = anfrLevelAlphas(0.15, { ...both, supportsArrival: 0.5 });
  assert.ok(Math.abs(ramp.supports - 0.5) < 1e-12 && Math.abs(ramp.mesh - 0.5) < 1e-12 && ramp.shared === 1);
});

test('inside the band a support the maillage draws is shared, one the maillage thinned away comes in, and the edge goes out', async () => {
  const added = [];
  // 0.3° of view: inside the band, both levels loaded.
  const viewer = {
    ...fakeViewer(2.20, 48.70, 2.50, 49.00),
    scene: {
      requestRender() {},
      primitives: {
        add(primitive) { added.push(primitive); return primitive; },
        remove(primitive) { return added.splice(added.indexOf(primitive), 1).length > 0; },
        contains() { return true; },
        raiseToTop() {},
      },
    },
  };
  anfrFranceLayer.init(viewer);
  const [supportsOnly, , , mesh, shared] = added;
  // The maillage holds three of the city supports' coordinates and one dot
  // outside the box the supports are asked about; the supports answer all fifteen.
  const tuples = [
    ...CITY_SUPPORTS.slice(0, 3).map((row) => [row.lat, row.lon, 2, 4]),
    [48.98, 2.48, 1, 4],
  ];
  const http = async (url) => ({
    ok: true,
    json: async () => (url.startsWith('/api/anfr-fr/supports')
      ? supportsAnswer(url)
      : { ...MESH_PAYLOAD, mesh: tuples }),
  });
  _setAnfrStateForTest({ viewer, overlayHost: makeHost(), http, regime: 'maillage' });
  const result = await _loadAnfrViewportForTest(viewer);
  assert.equal(result.regime, 'supports', 'past 0.314° the supports own the key');
  const idsOf = (collection) => Array.from({ length: collection.length }, (_, i) => collection.get(i).id);
  const sharedIds = new Set(CITY_SUPPORTS.slice(0, 3).map((row) => anfrSupportId(row.id)));
  assert.deepEqual(new Set(idsOf(shared)), sharedIds, 'the supports at a maillage coordinate are shared');
  assert.equal(supportsOnly.length, CITY_SUPPORTS.filter((row) => row.lat >= 48.70 && row.lat <= 49.00
    && row.lon >= 2.20 && row.lon <= 2.50).length - 3);
  assert.equal(mesh.length, 4, 'every maillage dot, the shared ones fading under their supports');
  // The count is the dominant level's: every support, shared or not.
  assert.equal(result.count, supportsOnly.length + shared.length);
  assert.equal(_anfrStatsForTest().regime, 'supports');

  // One frame at 0.3°: each class at its own weight, the shared supports whole.
  _anfrFadeFrameForTest(0.3);
  const expected = anfrLevelAlphas(0.3, { meshReady: true, supportsReady: true });
  const quantised = (value) => Math.round(value * 64) / 64;
  assert.ok(expected.mesh > 0 && expected.mesh < 1);
  assert.ok(Math.abs(mesh.get(0).color.alpha - quantised(expected.mesh)) < 1e-9);
  assert.equal(shared.get(0).color.alpha, 1);
  assert.deepEqual([mesh.show, supportsOnly.show, shared.show], [true, true, true]);

  // The camera settles at 0.2°: the maillage is not wanted any more, and the
  // frame that finds it at zero drops it. The shared supports stay put.
  Object.assign(viewer.camera, { computeViewRectangle: () => Cesium.Rectangle.fromDegrees(2.25, 48.75, 2.45, 48.95) });
  await _loadAnfrViewportForTest(viewer);
  const frame = _anfrFadeFrameForTest(0.2);
  assert.equal(frame.meshDrawn, false);
  assert.equal(mesh.length, 0);
  assert.ok(shared.length > 0, 'the shared supports were not rebuilt to change hands');
  anfrFranceLayer.destroy(viewer);
  _clearAnfrSelectionForTest();
});

test('the shaft field fades by its materials, hidden as a whole above its band', async () => {
  const added = [];
  const viewer = {
    ...fakeViewer(2.325, 48.850, 2.340, 48.860),
    scene: {
      requestRender() {},
      primitives: {
        add(primitive) { added.push(primitive); return primitive; },
        remove(primitive) { return added.splice(added.indexOf(primitive), 1).length > 0; },
        contains() { return true; },
        raiseToTop() {},
      },
    },
  };
  anfrFranceLayer.init(viewer);
  const [, masts] = added;
  const http = async (url) => ({ ok: true, json: async () => supportsAnswer(url) });
  _setAnfrStateForTest({ viewer, overlayHost: makeHost(), http, regime: 'maillage' });
  await _loadAnfrViewportForTest(viewer);
  assert.ok(drawnShafts(masts).length > 0);
  const alphas = () => new Set(drawnShafts(masts).map((line) => line.material.uniforms.color.alpha));
  // Inside the band the whole field is at one weight: still five draw commands.
  _anfrFadeFrameForTest(0.085);
  const faint = [...alphas()];
  assert.equal(faint.length, 1);
  assert.ok(faint[0] > 0 && faint[0] < 0.7, `shaft alpha ${faint[0]}`);
  // Below it, the shafts' own 0.7.
  _anfrFadeFrameForTest(0.05);
  assert.deepEqual([...alphas()], [0.7]);
  assert.equal(masts.show, true);
  // Above it, hidden as a collection rather than drawn transparent.
  assert.equal(_anfrFadeFrameForTest(0.2).shaftsShown, false);
  anfrFranceLayer.destroy(viewer);
  _clearAnfrSelectionForTest();
});
