import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_READERS } from './permitBoards.js';
import { permitListFor, normalisePermitListRow, scrubPermitListRow } from './permitListsFeed.js';

const city = permitListFor('74298');
const run = (text, x, y = 700) => ({ text, x, x1: x + text.length * 4, y, size: 8 });
// Synthetic project rows at the measured positions of the four municipal exports.
const profiles = [
  { family: 'PC', board: 'filings', headerX: [27.48, 111.38, 240.74, 392.33, 528.29, 641.83, 833.35, 998.98],
    dataX: [28.2, 89.784, 218.78, 382.01, 503.57, 641.71, 779.83, 971.14],
    labels: ['Date dépôt', 'Numéro de dossier', 'Nom, raison sociale ou', 'Adresse du terrain',
      "Nom de l'architecte", "Adresse postale de l'architecte", 'Liste des parcelles', 'Description synthétique du projet'] },
  { family: 'DP', board: 'filings', headerX: [31.2, 108.5, 250.82, 417.89, 537.89, 646.03, 757.03, 931.78],
    dataX: [26.04, 91.704, 217.94, 394.61, 528, 639, 746.23, 858.91],
    labels: ['Date dépôt', 'Numéro de dossier', 'Nom, raison sociale ou', 'Adresse du terrain',
      "Nom de l'architecte", 'Adresse postale de', 'Liste des parcelles', 'Description synthétique du projet'] },
  { family: 'PC', board: 'decisions', headerX: [41.28, 98.904, 178.94, 301.34, 435.89, 561.65, 709.03, 804.67, 923.26, 1008.94],
    dataX: [33.36, 98.064, 161.66, 300.14, 427.25, 549.05, 681.55, 798.67, 912.7, 1002.94],
    labels: ['Date de', 'délivrance', 'Numéro de dossier', 'Nom, raison sociale ou', 'Adresse du dossier',
      "Nom de l'architecte", 'Adresse de', 'Liste des parcelles', 'Nature de la', 'Description synthétique du'] },
  { family: 'DP', board: 'decisions', headerX: [29.16, 89.424, 167.54, 295.94, 439.73, 563.93, 630.43, 710.83, 821.71, 915.46],
    dataX: [29.88, 88.704, 163.82, 279.62, 418.61, 550.37, 615.41, 697.99, 811.15, 891.43],
    labels: ['Date dépôt', 'délivrance', 'Numéro de dossier', 'Nom, raison sociale ou', 'Adresse du dossier',
      'Nom de', 'adresse de', 'Liste des parcelles', 'Nature de la', 'Description synthétique du projet'] },
];

function fixture(profile, { number, filedOn = '01/09/2026', decidedOn = '15/09/2026', verdict = 'Refus' } = {}) {
  const headers = profile.labels.map((label, i) => run(label, profile.headerX[i]));
  const values = [filedOn, ...(profile.board === 'decisions' ? [decidedOn] : []),
    number ?? `${profile.family} 074 298 26 V 0016.M01`, 'PRIVATE BENEFICIARY WITH A VERY LONG NAME',
    '12 rue Exemple', 'PRIVATE ARCHITECT', '99 rue Private Residence 75000', 'D 101 - 102',
    ...(profile.board === 'decisions' ? [verdict] : []), 'Installation de panneaux photovoltaïques'];
  return { pages: [{ runs: [...headers, ...values.map((value, i) => run(value, profile.dataX[i], 650))] }] };
}
const read = (profile, options = {}, source = city) => BOARD_READERS[`vetraz-${profile.board}`](fixture(profile, options),
  { city: source, file: { board: profile.board, published: '2026-09-29' } });

for (const profile of profiles) {
  test(`Vétraz ${profile.family} ${profile.board} keeps project columns and excludes beneficiaries and architects`, () => {
    const [row] = read(profile);
    assert.equal(row.dossier, `${profile.family} 074298 26 V0016 M01`);
    assert.equal(row.address, '12 rue Exemple');
    assert.equal(row.parcels, 'D 101, D 102');
    assert.equal(row.filedOn, '2026-09-01');
    assert.equal(row.postedOn, '2026-09-29');
    assert.equal(row.applicant, null);
    assert.equal(row.purpose, 'Installation de panneaux photovoltaïques');
    assert.doesNotMatch(JSON.stringify(row), /PRIVATE|Private Residence|75000/);
    const stored = normalisePermitListRow(city, row.board, scrubPermitListRow(row));
    assert.equal(stored.state, profile.board === 'decisions' ? 'refuse' : 'depose');
    if (profile.board === 'decisions') assert.equal(row.decidedOn, '2026-09-15');
  });
}

test('Vétraz requires the municipality identity, verified headers and measured geometry', () => {
  for (const profile of profiles) {
    assert.deepEqual(read(profile, { number: `${profile.family} 074 008 26 V0016` }), []);
    assert.deepEqual(read(profile, {}, { ...city, insee: '74008' }), []);
    const document = fixture(profile);
    document.pages[0].runs.find((item) => item.text === 'Nom, raison sociale ou').text = 'Renamed private column';
    assert.deepEqual(BOARD_READERS[`vetraz-${profile.board}`](document, { city, file: { published: '2026-09-29' } }), []);
    const shifted = fixture(profile);
    shifted.pages[0].runs.forEach((item) => { item.x += 3; });
    assert.deepEqual(BOARD_READERS[`vetraz-${profile.board}`](shifted, { city, file: { published: '2026-09-29' } }), []);
  }
});

test('a repealed Vétraz decision closes the dossier and retains the published verdict', () => {
  const [row] = read(profiles[2], { verdict: 'Abrogation' });
  assert.equal(row.verdict, 'Abrogation');
  assert.equal(normalisePermitListRow(city, row.board, scrubPermitListRow(row)).state, 'annule');
});

test('Vétraz leaves invalid and future dates absent and partial parcel references unplaced', () => {
  const profile = profiles[3];
  const [row] = read(profile, { filedOn: '31/02/2026', decidedOn: '30/09/2026' });
  assert.equal(row.filedOn, null);
  assert.equal(row.decidedOn, null);
  const document = fixture(profile);
  document.pages[0].runs.find((item) => item.text === 'D 101 - 102').text = 'D 101p - 102p';
  const [partial] = BOARD_READERS['vetraz-decisions'](document, { city, file: { published: '2026-09-29' } });
  assert.equal(partial.parcels, null);
  assert.equal(partial.address, '12 rue Exemple');
});

test('an excluded works authorisation keeps its own cells away from the neighbouring permit', () => {
  const profile = profiles[0];
  const document = fixture(profile, { number: 'AT 074 298 26 V0016' });
  const next = fixture(profile, { number: 'PC 074 298 26 V0017' }).pages[0].runs.filter((item) => item.y === 650);
  document.pages[0].runs.push(...next.map((item) => ({ ...item, y: 600 })));
  const rows = BOARD_READERS['vetraz-filings'](document, { city, file: { published: '2026-09-29' } });
  assert.deepEqual(rows.map((row) => row.dossier), ['PC 074298 26 V0017']);
  assert.equal(rows[0].address, '12 rue Exemple');
});
