// ONE PALETTE AND ONE VOCABULARY FOR A BUILDING PROJECT (`permitProjects.js`).
//
// « Urbanisme » draws its permits with two layers, and until 2026-09-23 they
// wore two palettes that contradicted each other on the same street — amber was
// « accordé » in one and « chantier ouvert » in the other. These tests pin the
// one palette both now ask for, the class each register's state lands in, and
// the card the map key prints for a clicked project.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withLocale } from '../i18n/testing.js';
import {
  PERMIT_BADGE_LEGEND_GLYPH,
  PERMIT_PROJECT_CLASS_IDS,
  PERMIT_PROJECT_COLORS,
  permitBadgeImage,
  permitClassOfAdsPermit,
  permitClassOfSitadelBand,
  permitDate,
  permitProjectCard,
  permitProjectLegend,
  permitProjectTag,
} from './permitProjects.js';
import { SITADEL_BANDS } from './sitadelFeed.js';

test('the palette is Sitadel’s, so the parcels, the badges and the key agree', () => {
  for (const band of SITADEL_BANDS) {
    assert.equal(PERMIT_PROJECT_COLORS[permitClassOfSitadelBand(band.id)], band.color, band.id);
  }
  // Seven classes, seven colours: two classes on one colour would be one key
  // line claiming two meanings.
  const colors = Object.values(PERMIT_PROJECT_COLORS);
  assert.equal(new Set(colors).size, colors.length);
  assert.deepEqual(Object.keys(PERMIT_PROJECT_COLORS), [...PERMIT_PROJECT_CLASS_IDS]);
});

test('the two registers land in the same classes, a demolition whatever its state', () => {
  assert.equal(permitClassOfSitadelBand('commence'), 'started');
  assert.equal(permitClassOfSitadelBand('nope'), 'unknown');
  assert.equal(permitClassOfAdsPermit({ state: 'commence' }), 'started');
  assert.equal(permitClassOfAdsPermit({ state: 'instruction' }), 'filed');
  assert.equal(permitClassOfAdsPermit({ state: 'refuse' }), 'cancelled');
  assert.equal(permitClassOfAdsPermit({ state: null }), 'unknown');
  // The register's progress field says nothing for demolitions: the class does.
  assert.equal(permitClassOfAdsPermit({ kind: 'PD', state: 'accorde' }), 'demolition');
});

test('the key prints one plain line per class drawn, in the life of a permit', () => {
  const legend = permitProjectLegend(['completed', 'granted', 'started']);
  assert.deepEqual(legend.map((entry) => entry.label), ['Permis accordé', 'Travaux commencés', 'Travaux terminés']);
  assert.deepEqual(legend.map((entry) => entry.rank), [1, 2, 3]);
  for (const entry of legend) {
    assert.equal(entry.glyph, PERMIT_BADGE_LEGEND_GLYPH, 'the swatch is the badge’s square');
    assert.equal(entry.count, undefined);
    assert.equal(entry.blurb, undefined);
  }
  assert.deepEqual(permitProjectLegend([]), []);
  assert.deepEqual(withLocale('en', () => permitProjectLegend(['granted']).map((entry) => entry.label)),
    ['Permit granted']);
});

test('a badge is one image per class, shared, and the selected one is its own', () => {
  const plain = permitBadgeImage('started');
  assert.match(plain, /^data:image\/svg\+xml;base64,/);
  assert.equal(permitBadgeImage('started'), plain, 'cached: thousands of badges, one atlas entry');
  assert.notEqual(permitBadgeImage('started', { selected: true }), plain);
  const svg = Buffer.from(plain.split(',')[1], 'base64').toString('utf8');
  assert.ok(svg.includes(PERMIT_PROJECT_COLORS.started), 'the colour is in the image, not a tint');
  const demolition = Buffer.from(permitBadgeImage('demolition').split(',')[1], 'base64').toString('utf8');
  assert.ok(demolition.includes('M4 4 20 20'), 'a demolition is struck through');
  assert.equal(permitBadgeImage('not-a-class'), permitBadgeImage('unknown'));
});

test('dates read the way a person writes them, the 1st included', () => {
  assert.equal(permitDate('2024-12-06'), '6 déc. 2024');
  assert.equal(permitDate('2025-12-01'), '1ᵉʳ déc. 2025');
  assert.equal(withLocale('en', () => permitDate('2025-12-01')), 'Dec 1, 2025');
  assert.equal(permitDate(null), null);
  assert.equal(permitDate('déc. 2024'), null);
});

test('the card is the mock’s: what, how many, where, how far, then the rest folded', () => {
  const card = permitProjectCard({
    key: 'p', type: 'Permis de construire', classId: 'started',
    dwellings: 40, surfaceM2: 2390, demolishedDwellings: 2,
    nature: 'nouvelle construction', address: '27 rue Francon', commune: 'La Teste-de-Buch',
    dates: { granted: '2024-12-06', started: '2025-12-01', completed: null },
    approximate: true, details: ['N° PC 033 529 24 00001'], source: 'Sitadel · SDES',
  });
  assert.equal(card.kicker, 'Permis de construire');
  assert.equal(card.title, '40 logements autorisés');
  assert.deepEqual(card.meta, ['27 rue Francon', 'La Teste-de-Buch']);
  assert.deepEqual(card.badge, { label: 'Travaux commencés', color: PERMIT_PROJECT_COLORS.started });
  assert.deepEqual(card.lines, ['Nouvelle construction']);
  assert.deepEqual(card.rows.items.map((row) => [row.label, row.value.replace(/\s/g, ' ')]), [
    ['Surface déclarée', '2 390 m²'],
    ['Démolition prévue', '2 logements'],
  ]);
  assert.deepEqual(card.steps.items.map((step) => [step.label, step.value, step.done]), [
    ['Permis accordé', '6 déc. 2024', true],
    ['Début des travaux déclaré', '1ᵉʳ déc. 2025', true],
    ['Fin des travaux', 'Non renseignée', false],
  ]);
  assert.deepEqual(card.notice, {
    title: 'Localisation à confirmer', text: 'Le repère sur la carte est approximatif.',
  });
  assert.equal(card.list.summary, 'Voir les détails du permis');
  assert.equal(card.source, 'Source : Sitadel · SDES');
});

test('a grant whose day is unknown but not after its publication says « at the latest »', () => {
  const card = permitProjectCard({
    key: 'm', type: 'Permis de construire', classId: 'granted',
    commune: 'Montpellier', dates: { granted: null, grantedBy: '2026-10-02' },
  });
  assert.deepEqual(card.steps.items[0], {
    label: 'Permis accordé', value: 'Au plus tard le 2 oct. 2026', done: true, color: PERMIT_PROJECT_COLORS.granted,
  });
  // A known day wins.
  const known = permitProjectCard({ key: 'k', type: 'PC', classId: 'granted', dates: { granted: '2026-09-28', grantedBy: '2026-10-02' } });
  assert.equal(known.steps.items[0].value, '28 sept. 2026');
});

test('a card with no dwelling is titled by its address, and a demolition has no work dates', () => {
  const card = permitProjectCard({
    key: 'd', type: 'Permis de démolir', classId: 'demolition',
    address: '4 rue du Port', commune: 'La Teste-de-Buch', dates: { granted: '2023-03-01' },
  });
  assert.equal(card.title, '4 rue du Port');
  assert.deepEqual(card.meta, ['La Teste-de-Buch']);
  assert.deepEqual(card.steps.items.map((step) => step.label), ['Permis accordé']);
  assert.equal(card.notice, null);
  assert.equal(card.list, null);
  // A refused file has no work to come either.
  const refused = permitProjectCard({ key: 'r', type: 'PC', classId: 'cancelled', dates: {} });
  assert.equal(refused.steps.items.length, 1);
  // The globe's tag: the dwellings, and the warning when there is one.
  assert.equal(permitProjectTag({ dwellings: 40, classId: 'started', approximate: true }).replace(/\s/g, ' '),
    '40 logements · Repère approximatif');
  assert.equal(permitProjectTag({ dwellings: null, classId: 'demolition' }), 'Permis de démolir');
});
