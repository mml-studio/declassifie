// The Planning permits layer in English, on the SAME Bordeaux Métropole
// capture the French tests pin — the one portal in France that publishes the
// ground a file was opened on.
//
// The property that has to survive the translation is the one the layer keeps
// apologising for: almost every coordinate here was COMPUTED, and each way of
// computing it is a different claim. A lot deduced after a division, a parent
// plot drawn because the lot could not be told from its siblings, a point
// geocoded to a street — three sentences in French, three in English.
//
// The last block is the drift guard. `/api/ads-fr` runs in Node and bakes the
// family, the state, the purpose and the placement into the payload in French;
// the browser relabels them from their KEYS, and the two must not drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertNoFrench, useTestLocale, withLocale } from '../i18n/testing.js';
import {
  ADS_KINDS,
  ADS_PRECISION,
  LOCAL_ADS_PORTALS,
  SITADEL_STATES,
  adsKindLabel,
  adsPrecisionLabel,
  adsPurposeLabel,
  adsStateLabel,
  normaliseLocalRow,
  projectAdsPermits,
} from './adsFeed.js';
import {
  ADS_KIND_WORDS, ADS_PRECISION_WORDS, ADS_PURPOSE_WORDS, ADS_STATE_WORDS,
} from './adsFeed.i18n.js';
import adsUrbanismeLayer, {
  ADS_BUILDING_THEME_ID,
  ADS_BUILDING_THEME_LEGEND,
  ADS_WINDOW_DEFAULT,
  adsBuildingThemeLegend,
  adsBuildingThemeLine,
  adsBuildingThemePoints,
  adsDateLine,
  adsPermitPanel,
  adsEmpriseLine,
  adsPrecisionLine,
  adsRowControls,
  adsPeriodSelect,
  adsWindowChips,
  empriseCard,
  empriseProvenanceLine,
  syncAdsBuildingTheme,
} from './adsUrbanisme.js';
import { clearAllBuildingThemes } from './buildingTheme.js';

const PORTALS = JSON.parse(readFileSync(
  new URL('./fixtures/ads-portals-sample.json', import.meta.url), 'utf8',
));
const BORDEAUX = LOCAL_ADS_PORTALS.find((portal) => portal.key === 'bordeaux');

function bordeauxPayload() {
  const permits = PORTALS.bordeaux.map((row) => normaliseLocalRow(BORDEAUX, row));
  return projectAdsPermits({
    permits,
    origin: { lon: permits[0].lon, lat: permits[0].lat },
    radiusM: 200_000,
  });
}

/** Proper nouns the portal publishes and this layer relays. */
const PUBLISHED = ['Bordeaux Métropole'];

test('a municipal refusal or withdrawal carries a decision date, never a grant, in both languages', () => {
  for (const [locale, label, date] of [['fr', 'Décision', '28 sept. 2026'], ['en', 'Decision', 'Sep 28, 2026']]) {
    for (const state of ['refuse', 'annule']) {
      const panel = withLocale(locale, () => adsPermitPanel({
        id: 'permit-list:brive:DP0190312600001', kind: 'DP', state, decidedOn: '2026-09-28',
        address: '34 Rue Exemple', sourceLabel: 'Ville de Brive-la-Gaillarde',
      }));
      assert.equal(panel.steps.items.length, 1);
      assert.equal(panel.steps.items[0].label, label);
      assert.equal(panel.steps.items[0].value, date);
      assert.equal(panel.steps.items[0].done, true);
    }
  }
  const granted = withLocale('en', () => adsPermitPanel({ kind: 'PC', state: 'accorde', decidedOn: '2026-09-28' }));
  assert.equal(granted.steps.items[0].label, 'Permit granted');
});

/* ── the chips ───────────────────────────────────────────────────────────── */

test('the four window chips and their titles answer in English', (t) => {
  useTestLocale('en', t);
  const chips = adsWindowChips(ADS_WINDOW_DEFAULT, null);
  assert.deepEqual(chips.map((chip) => chip.label), ['6 MONTHS', '1 YEAR', '3 YEARS', '13 YEARS']);
  assert.equal(chips[0].title, 'Permits from the last 6 months — the latest filings and decisions');
  assert.equal(chips[1].title, 'Permits from the last year — the latest filings and decisions');
  assert.equal(chips[2].title, 'Permits from the last 3 years — the pipeline under way');
  assert.equal(chips[3].title, 'Permits from the last 13 years, completed sites included');
  // The window is a share-link token and never moves with the language.
  assert.deepEqual(chips.map((chip) => chip.params.months), ['6', '12', '36', '156']);
  assertNoFrench(chips);
});

test('the period menu names its four windows in English', (t) => {
  useTestLocale('en', t);
  const select = adsPeriodSelect(ADS_WINDOW_DEFAULT, null);
  assert.deepEqual(select.options.map((option) => option.label),
    ['Last 6 months', 'Last year', 'Last 3 years', 'All dates']);
  assertNoFrench(select);
});

test('the ACTIVE chip carries the truncation, in English too', (t) => {
  useTestLocale('en', t);
  const active = (chips) => chips.find((chip) => chip.active);
  const chip = active(adsWindowChips('36', { truncated: true, permitsFound: 400, permitsInRadius: 912 }));
  assert.equal(chip.title,
    'Permits from the last 3 years — 400 files served out of 912 in the radius, nearest first');
  const counted = active(adsWindowChips('36', { permitsFound: 58 }));
  assert.equal(counted.title, 'Permits from the last 3 years — 58 files on this block');
});

/* ── the caveats ─────────────────────────────────────────────────────────── */

test('the three inferred placements stay three different English sentences', () => {
  const line = (permit) => withLocale('en', () => adsPrecisionLine(permit));
  assert.equal(line({ precision: 'enfant', lineage: { basis: 'built' } }),
    'lot deduced — only lot built on since');
  assert.equal(line({ precision: 'enfant', lineage: {} }),
    'lot deduced after the parcel was divided');
  assert.equal(line({ precision: 'mere', lineage: { siblings: 3 } }),
    'extent before the division — 3 lots since, not told apart');
  assert.equal(line({ precision: 'mere', lineage: { siblings: 1 } }),
    'extent before the division — the exact lot is not determined');
  assert.equal(line({ precision: 'street' }), 'approximate position — geocoded to the street');
  assert.equal(line({ precision: 'locality' }), 'approximate position — geocoded to the locality');
  // The three that need no caveat still need none.
  for (const precision of ['published', 'housenumber', 'parcelle']) {
    assert.equal(line({ precision }), null, precision);
  }
  // And French does not move.
  assert.equal(withLocale('fr', () => adsPrecisionLine({ precision: 'street' })),
    'position approchée — géocodée à la rue');
});

test('the date line names the date that is the news, in English', () => {
  const line = (permit) => withLocale('en', () => adsDateLine(permit));
  assert.equal(line({ completedOn: '2026-08-31' }), 'completed on Aug 31, 2026');
  assert.equal(line({ startedOn: '2026-08-31' }), 'site opened on Aug 31, 2026');
  assert.equal(line({ state: 'instruction', depositedOn: '2026-01-04' }), 'filed on Jan 4, 2026');
  assert.equal(line({ decidedOn: '2026-03-02' }), 'decided on Mar 2, 2026');
  assert.equal(withLocale('fr', () => adsDateLine({ completedOn: '2026-08-31' })),
    'achevé le 31/08/2026');
  // Montpellier's export: no decision day, but the day the dossier appeared in it.
  assert.equal(line({ state: 'accorde', postedOn: '2026-10-02' }), 'granted by Oct 2, 2026');
  assert.equal(withLocale('fr', () => adsDateLine({ state: 'accorde', postedOn: '2026-10-02' })),
    'accordé au plus tard le 02/10/2026');
});

/* ── the plot card ───────────────────────────────────────────────────────── */

test('a plot card names its parcels, its ground and who drew the outline', (t) => {
  useTestLocale('en', t);
  const payload = bordeauxPayload();
  const emprise = payload.emprises[0];
  const permits = payload.permits.filter((permit) => permit.empriseId === emprise.id);
  const card = empriseCard(emprise, permits);
  assert.ok(card.name.startsWith('Parcel'), card.name);
  assert.ok(card.description.includes('m² of ground'), card.description);
  assert.ok(card.description.includes('extent published by Bordeaux Métropole'), card.description);
  assertNoFrench(card, { allow: PUBLISHED });
});

test('a published outline and a cadastral one are two different English claims', () => {
  const published = [{ precision: 'published', sourceLabel: 'Bordeaux Métropole — Dossiers' }];
  const cadastral = [{ precision: 'parcelle' }];
  assert.equal(withLocale('en', () => empriseProvenanceLine(published)),
    'extent published by Bordeaux Métropole');
  assert.equal(withLocale('en', () => empriseProvenanceLine(cadastral)),
    'cadastral extent — the parcel the file names');
  assert.equal(withLocale('en', () => empriseProvenanceLine([...published, ...cadastral])),
    'extent published by Bordeaux Métropole · cadastral extent — the parcel the file names');
  // On a dossier's own card the cadastral case is silent; only the portal case
  // is evidence the join cannot give.
  assert.equal(withLocale('en', () => adsEmpriseLine({ empriseId: 1, ...published[0] })),
    'extent published by Bordeaux Métropole');
  assert.equal(withLocale('en', () => adsEmpriseLine({ empriseId: 1, precision: 'parcelle' })), null);
});

/* ── the ramp and the ledger ─────────────────────────────────────────────── */

test('the key and the ramp answer in English, one plain name per colour', (t) => {
  useTestLocale('en', t);
  const controls = adsRowControls({
    permits: [
      { state: 'instruction' }, { state: 'accorde' }, { state: 'commence' },
      { state: 'termine' }, { state: 'refuse' }, { kind: 'PD', state: 'accorde' }, { state: null },
    ],
    emprises: [],
  });
  assert.deepEqual(controls.legend.map((row) => row.label), [
    'Application under review',
    'Permit granted',
    'Work started',
    'Work completed',
    'Canceled or refused',
    'Demolition permit',
    'State not published',
  ]);
  assert.equal(controls.legendFold, 'Project colors');
  assert.deepEqual(adsBuildingThemeLegend().map((row) => row.label), controls.legend.slice(0, -1).map((row) => row.label));
  assertNoFrench(controls.legend);
});

test('the ramp’s colours do not move with the language', () => {
  const en = withLocale('en', () => adsBuildingThemeLegend()).map((row) => row.color);
  const fr = withLocale('fr', () => adsBuildingThemeLegend()).map((row) => row.color);
  assert.deepEqual(en, fr);
  assert.deepEqual(en, ADS_BUILDING_THEME_LEGEND.map((row) => row.color));
});

test('the OFFER ledger reads in English, every reason named', (t) => {
  useTestLocale('en', t);
  const ledger = adsBuildingThemePoints({
    permits: [
      { kind: 'PC', state: 'commence', purpose: 'travaux sur construction existante', lon: 1, lat: 2 },
      { kind: 'PC', state: 'accorde', purpose: 'nouvelle construction · logements', lon: 1, lat: 2 },
      { kind: 'PA', state: 'accorde', purpose: 'lotissement', lon: 1, lat: 2 },
      { kind: 'DP', state: 'instruction', purpose: 'ravalement', lon: 1, lat: 2 },
      { kind: 'PC', state: null, purpose: 'travaux sur construction existante', lon: 1, lat: 2 },
    ],
  });
  const line = adsBuildingThemeLine(ledger);
  assert.ok(line.startsWith('2 of 5 files paint the 3D buildings'), line);
  assert.ok(line.includes('(1 of them on an unpublished nature)'), line);
  assert.ok(line.includes('held back: 1 on new construction, 1 development permits, 1 with no published state'),
    line);
  assert.ok(line.endsWith('· the count of volumes painted is on the 3D buildings row'), line);
  assertNoFrench(line);
});

/* ── the drift guard: four tables, a server with no locale ───────────────── */

test('the payload keeps the producer’s French, and the browser relabels the key', () => {
  for (const [table, catalog] of [
    [ADS_KINDS, ADS_KIND_WORDS],
    [Object.fromEntries(Object.entries(ADS_PRECISION).map(([k, v]) => [k, v.label])), ADS_PRECISION_WORDS],
  ]) {
    for (const [key, label] of Object.entries(table)) {
      assert.equal(label, catalog('fr')[key], `${key} drifted from the catalog`);
      assertNoFrench(catalog('en')[key], { message: `${key} in English` });
    }
  }
  for (const entry of Object.values(SITADEL_STATES)) {
    assert.equal(entry.label, ADS_STATE_WORDS('fr')[entry.state], `${entry.state} drifted`);
  }
  assert.equal(withLocale('en', () => adsKindLabel('PA')), 'Development permit');
  assert.equal(withLocale('en', () => adsPrecisionLabel('mere')), 'parcel divided since');
  // A key the payload carries and this build does not know is shown as it came.
  assert.equal(withLocale('en', () => adsKindLabel('ZZ')), 'ZZ');
  assert.equal(adsKindLabel(''), null);
});

test('a state the ladder knows is translated; a portal’s own wording is kept', () => {
  const label = (permit) => withLocale('en', () => adsStateLabel(permit));
  assert.equal(label({ state: 'instruction', stateLabel: 'En cours d’instruction' }), 'Under review');
  assert.equal(label({ state: 'commence', stateLabel: 'Chantier ouvert' }), 'Site opened');
  // `localState()` falls back to the portal's own words under `depose`; those
  // are data and are shown exactly as the portal published them.
  assert.equal(label({ state: 'depose', stateLabel: 'Dossier déposé (pièces manquantes)' }),
    'Dossier déposé (pièces manquantes)');
  assert.equal(label({ state: 'depose', stateLabel: 'Déposé' }), 'Filed');
  assert.equal(label({ state: null, stateLabel: null }), null);
});

test('a purpose is translated word by word, and free text is left alone', () => {
  const label = (purpose) => withLocale('en', () => adsPurposeLabel(purpose));
  assert.equal(label('nouvelle construction · logements'), 'new construction · dwellings');
  assert.equal(label('travaux sur construction existante · entrepôt'),
    'work on an existing building · warehouse');
  assert.equal(label('lotissement'), 'housing subdivision');
  // The kind fallback `sitadelPurpose()` uses when the row declares nothing.
  assert.equal(label('Permis de démolir'), 'Demolition permit');
  // A Bordeaux or Nantes `objet` is the applicant's own sentence: data.
  assert.equal(label('Ravalement de façade sur rue'), 'Ravalement de façade sur rue');
  assert.equal(label(''), null);
  // And every word of the table has an English that is not French.
  for (const key of Object.keys(ADS_PURPOSE_WORDS.definition)) {
    assertNoFrench(ADS_PURPOSE_WORDS('en')[key], { message: `purpose ${key}` });
  }
});

test('the row’s stats name the theme in English, from the layer itself', (t) => {
  useTestLocale('en', t);
  clearAllBuildingThemes();
  // `getStats()` is the one place `themeLabel` is read, and a dangling
  // reference there boots the globe and then kills the layer — which is what
  // the English scanner caught and this pins.
  syncAdsBuildingTheme(bordeauxPayload());
  const stats = adsUrbanismeLayer.getStats();
  assert.equal(stats.theme, ADS_BUILDING_THEME_ID);
  assert.equal(stats.themeLabel, 'Planning permits');
  assert.equal(withLocale('fr', () => adsUrbanismeLayer.getStats()).themeLabel,
    'Autorisations d’urbanisme');
  clearAllBuildingThemes();
});
