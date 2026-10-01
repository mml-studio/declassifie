// src/data/sirapFeed.test.mjs
// Pins the SHAPE of Sirap's PU boards as they answered on 2026-10-01 at
// Dunkerque, Rennes, Antibes and Asnières-sur-Seine. The rows below are copied
// from those answers with every applicant, architect and address replaced: a
// person's name never reaches this file, as it never reaches the payload.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIRAP_INSTANCES,
  SIRAP_ROWS,
  normaliseSirapRow,
  parseSirapAddress,
  scrubSirapRow,
  sirapBoardCodes,
  sirapBoardUrl,
  sirapDate,
  sirapInstanceFor,
  sirapParcelIdus,
  sirapRobotsUrl,
  sirapVerdictState,
} from './sirapFeed.js';
import { CARTDS_INSTANCES, foldCartdsDossiers } from './cartdsFeed.js';
import { PUBLICATION_ACTES_COMMUNES } from './publicationActesFeed.js';
import { PERMIT_LISTS } from './permitListsFeed.js';
import { LOCAL_ADS_PORTALS, SITADEL_FILES, mergeRegisters, normaliseSitadelRow } from './adsFeed.js';
import { COMMUNE_CODE_PATTERN } from './communeCode.js';
import { readCartdsArchive, recordCartdsBoards, emptyCartdsArchive } from './cartdsArchive.js';

const CUD = SIRAP_INSTANCES.find((instance) => instance.key === 'cud');
const RENNES = SIRAP_INSTANCES.find((instance) => instance.key === 'rennesmetropole');
const HOUSING_FILE = SITADEL_FILES.find((file) => file.key === 'logements');

/** A Dunkerque row, decided, applicant and architect replaced. */
const DECIDED = Object.freeze({
  id: 86389, idCommune: 9555, idDossier: 134044, type: 'DPC', numeroAds: 'DP0591832600421',
  dateDepot: '2026-06-17T00:00:00.000Z', demandeur: 'DUPONT Jean', superficie: 120,
  adresse: '14 Avenue des Exemples 59386 Dunkerque', parcelles: '183000BD0008',
  travauxNature: 'Travaux ou changement de destination sur construction existante',
  descriptionTravaux: 'Ravalement de façade', decision: 'Favorable avec prescriptions (PLATAU)',
  dateDecision: '2026-09-09T00:00:00.000Z', architecte: 'MARTIN Paul',
});

/** A Rennes row, filed only, by a firm. */
const FILED = Object.freeze({
  id: 3169, idCommune: 6151, idDossier: 244432, type: 'PC', numeroAds: 'PC0352382600123',
  dateDepot: '2026-09-29T00:00:00.000Z', demandeur: 'SCI LES EXEMPLES', superficie: 0,
  adresse: '105BIS Rue des Exemples 35000 RENNES', parcelles: '238000DM0625, 238000DM0626',
  travauxNature: 'Nouvelle construction', descriptionTravaux: 'PC', decision: null,
  dateDecision: null, architecte: null,
});

test('the registry is a gate that cannot half-cover or double-cover a commune', () => {
  const seen = new Map();
  for (const instance of SIRAP_INSTANCES) {
    assert.match(instance.base, /^https:\/\/[^/]+$/, instance.key);
    assert.match(instance.label, / — affichage réglementaire$/, instance.key);
    for (const code of instance.communes) {
      assert.match(code, COMMUNE_CODE_PATTERN, `${instance.key} ${code}`);
      assert.ok(!seen.has(code), `${code} is in ${seen.get(code)} and ${instance.key}`);
      seen.set(code, instance.key);
    }
    for (const [commune, boards] of Object.entries(instance.associated ?? {})) {
      assert.ok(instance.communes.includes(commune), `${instance.key}: ${commune} reads boards but is not listed`);
      for (const board of boards) assert.ok(!seen.has(board), `${board} is a commune of its own`);
    }
  }
  // Rennes Métropole 40, Dunkerque 14, Antibes, Asnières.
  assert.equal(seen.size, 56);
  assert.equal(sirapInstanceFor('35238'), RENNES);
  assert.equal(sirapInstanceFor('59183'), CUD);
  assert.equal(sirapInstanceFor('59248'), null, 'Fort-Mardyck is read as Dunkerque');
  assert.equal(sirapInstanceFor('75056'), null);
  assert.equal(sirapInstanceFor(''), null);
  assert.equal(sirapInstanceFor(null), null);
});

test('no commune is read from two of the posted and published registers', () => {
  // The proxy races them and draws whatever each answers; a commune on two
  // would have every dossier twice.
  const claimed = new Map();
  const claim = (code, by) => {
    assert.ok(!claimed.has(code), `${code} is read by ${claimed.get(code)} and ${by}`);
    claimed.set(code, by);
  };
  for (const instance of SIRAP_INSTANCES) instance.communes.forEach((code) => claim(code, `sirap ${instance.key}`));
  for (const instance of CARTDS_INSTANCES) instance.communes.forEach((code) => claim(code, `cartds ${instance.key}`));
  for (const commune of PUBLICATION_ACTES_COMMUNES) claim(commune.insee, 'publication-actes');
  for (const city of PERMIT_LISTS) claim(city.insee, `permit-list ${city.key}`);
  // And none duplicates a métropole portal, which the layer merges as a twin.
  for (const portal of LOCAL_ADS_PORTALS) {
    for (const code of portal.communes) {
      assert.ok(!SIRAP_INSTANCES.some((instance) => instance.communes.includes(code)), `${code} on ${portal.key}`);
      assert.ok(!PERMIT_LISTS.some((city) => city.insee === code), `${code} on ${portal.key}`);
    }
  }
});

test('Dunkerque reads the boards of the communes it absorbed', () => {
  assert.deepEqual(sirapBoardCodes(CUD, '59183'), ['59183', '59248', '59540']);
  assert.deepEqual(sirapBoardCodes(CUD, '59016'), ['59016']);
  assert.deepEqual(sirapBoardCodes(RENNES, '35238'), ['35238']);
  assert.equal(
    sirapBoardUrl(CUD, '59248'),
    'https://urbanisme-cud.pu.sirap.com/api/v1/communes/059248/affichage-reglementaire',
  );
  assert.equal(sirapRobotsUrl(CUD), 'https://urbanisme-cud.pu.sirap.com/robots.txt');
});

test('a date is the day it is published as, never moved by a time zone', () => {
  assert.equal(sirapDate('2026-06-17T00:00:00.000Z'), '2026-06-17');
  assert.equal(sirapDate(null), null);
  assert.equal(sirapDate('soon'), null);
});

test('the address keeps its last five digits as the postcode', () => {
  assert.deepEqual(parseSirapAddress('14 Avenue des Exemples 59386 Dunkerque'), {
    address: '14 Avenue des Exemples', postcode: '59386', locality: 'Dunkerque',
  });
  assert.deepEqual(parseSirapAddress('rue   des Exemples Lot 2 59140 DUNKERQUE'), {
    address: 'rue des Exemples Lot 2', postcode: '59140', locality: 'DUNKERQUE',
  });
  assert.deepEqual(parseSirapAddress('11 Rue des Exemples (Fort-Mardyck) 59430 Dunkerque').postcode, '59430');
  assert.deepEqual(parseSirapAddress('12345 Chemin des Exemples 06600 Antibes').postcode, '06600');
  assert.deepEqual(parseSirapAddress('Lieu-dit des Exemples'), {
    address: 'Lieu-dit des Exemples', postcode: null, locality: null,
  });
  assert.deepEqual(parseSirapAddress(null), { address: null, postcode: null, locality: null });
});

test('the parcels resolve to the cadastre’s key, in all the spellings seen', () => {
  const idus = (cell, insee) => sirapParcelIdus(cell, insee).map((ref) => ref.idu);
  assert.deepEqual(idus('183000BD0008', '59183'), ['59183000BD0008']);
  assert.deepEqual(idus('183000AB0012, 183000AB0013', '59183'), ['59183000AB0012', '59183000AB0013']);
  // Leading zeros eaten, a space before the section, a one-letter section.
  assert.deepEqual(idus('4000DW0249', '06004'), ['06004000DW0249']);
  assert.deepEqual(idus('16000AE0080', '59016'), ['59016000AE0080']);
  assert.deepEqual(idus('004000 BS0348', '06004'), ['06004000BS0348']);
  assert.deepEqual(idus('0040000L0005', '92004'), ['920040000L0005']);
  // An absorbed commune's sections live under its number, prefix written or not.
  assert.deepEqual(idus('248248AB0396', '59183'), ['59183248AB0396']);
  assert.deepEqual(idus('248000AC0328', '59183'), ['59183248AC0328']);
  assert.deepEqual(idus('540540AL0204', '59183'), ['59183540AL0204']);
  // No parcel: the address places the dossier.
  for (const cell of ['None', '', null, '238000000484', '004000A00000', '238000DP356p']) {
    assert.deepEqual(idus(cell, '35238'), [], String(cell));
  }
  assert.deepEqual(idus('183000BD0008', 'bogus'), []);
  assert.deepEqual(sirapParcelIdus('248248AB0396', '59183')[0].label, '248 AB 396');
  assert.deepEqual(sirapParcelIdus('0040000L0005', '92004')[0].label, 'L 5');
});

test('the verdicts of three instruction services land on the ladder', () => {
  for (const verdict of ['Favorable', 'Favorable avec prescriptions', 'Accord', 'Accord tacite',
    'Accord avec prescriptions', 'FAVORABLE ET PRESCRIPTIONS', 'NON OPPOSITION', 'TACITE', 'Tacite']) {
    assert.equal(sirapVerdictState(verdict), 'accorde', verdict);
  }
  for (const verdict of ['Défavorable', 'DEFAVORABLE', 'Refus', 'Rejet', 'Rejet tacite', 'Refus tacite']) {
    assert.equal(sirapVerdictState(verdict), 'refuse', verdict);
  }
  for (const verdict of ['Annulé', 'SANS SUITE', 'RETRAIT par le pétitionnaire', 'CADUC', 'SANS OBJET']) {
    assert.equal(sirapVerdictState(verdict), 'annule', verdict);
  }
  // A certificat's answer is nobody's verdict.
  assert.equal(sirapVerdictState('INFORMATION'), null);
  assert.equal(sirapVerdictState(null), null);
});

test('a scrubbed row keeps no person and no platform id', () => {
  const cells = scrubSirapRow(DECIDED);
  assert.equal(cells.length, 11);
  assert.ok(!cells.includes('DUPONT Jean'));
  assert.ok(!cells.includes('MARTIN Paul'));
  assert.ok(!cells.includes('86389'));
  assert.equal(scrubSirapRow(FILED)[3], 'SCI LES EXEMPLES', 'a firm keeps its name');
  // A change of use of a dwelling is not a building authorisation.
  assert.equal(scrubSirapRow({ ...FILED, type: 'CH', numeroAds: 'CH0352382600001' }), null);
  assert.equal(scrubSirapRow(null), null);
  assert.equal(scrubSirapRow(['DP0591832600421']), null);
});

test('a decided row is a granted dossier on its parcel, under Sitadel’s number', () => {
  const permit = normaliseSirapRow(CUD, '59183', DECIDED);
  assert.equal(permit.id, 'sirap:cud:DP0591832600421');
  assert.equal(permit.dossier, 'DP 059 183 26 00421');
  assert.equal(permit.key, 'DAU|0591832600421');
  assert.equal(permit.kind, 'DP');
  assert.equal(permit.state, 'accorde');
  assert.equal(permit.depositedOn, '2026-06-17');
  assert.equal(permit.decidedOn, '2026-09-09');
  assert.equal(permit.applicant, null, 'a person never reaches the payload');
  assert.equal(permit.purpose, 'Ravalement de façade');
  assert.equal(permit.address, '14 Avenue des Exemples');
  assert.equal(permit.postcode, '59386');
  assert.equal(permit.communeCode, '59183');
  assert.equal(permit.cadastreCommune, '59183');
  assert.deepEqual(permit.parcelIdus.map((ref) => ref.idu), ['59183000BD0008']);
  assert.equal(permit.landAreaM2, 120);
  assert.equal(permit.source, 'sirap');
  assert.equal(permit.sourceLabel, CUD.label);

  // Sitadel holds the same dossier under the same digits: one dossier.
  const twin = normaliseSitadelRow(HOUSING_FILE, {
    NUM_DAU: '0591832600421', TYPE_DAU: 'DP', ETAT_DAU: '2', COMM: '59183',
  });
  assert.equal(mergeRegisters([twin], [permit]).merged, 1);
});

test('a filed row says filed, and a blank description falls back to the works', () => {
  const permit = normaliseSirapRow(RENNES, '35238', FILED);
  assert.equal(permit.state, 'depose');
  assert.equal(permit.decidedOn, null);
  assert.equal(permit.applicant, 'SCI LES EXEMPLES');
  // Rennes writes the type where the description should be.
  assert.equal(permit.purpose, 'Nouvelle construction');
  assert.equal(permit.landAreaM2, null, '0 m² is the field’s blank');
  assert.equal(permit.parcelIdus.length, 2);
  // A Fort-Mardyck row is drawn in Dunkerque, on Dunkerque's cadastre.
  const absorbed = normaliseSirapRow(CUD, '59183', { ...DECIDED, numeroAds: 'DP0592482600012', parcelles: '248248AB0396' });
  assert.equal(absorbed.communeCode, '59183');
  assert.deepEqual(absorbed.parcelIdus.map((ref) => ref.idu), ['59183248AB0396']);
  // A verdict off the ladder keeps its words, as on a Cart@DS board.
  const odd = normaliseSirapRow(CUD, '59183', { ...DECIDED, decision: 'Sursis à statuer' });
  assert.equal(odd.state, 'depose');
  assert.equal(odd.stateLabel, 'Sursis à statuer');
});

test('the archive keeps a PU board by the board it came from, scrubbed', () => {
  const instance = CUD;
  let { archive } = recordCartdsBoards(emptyCartdsArchive(instance, '59183'), {
    59183: [FILED, DECIDED],
    59248: [{ ...DECIDED, numeroAds: 'DP0592482600012' }],
    // Not a board this register has: dropped.
    2: [DECIDED],
  }, '2026-10-01', SIRAP_ROWS);
  assert.equal(archive.rows.length, 3);
  assert.deepEqual([...new Set(archive.rows.map((row) => row.board))].sort(), ['59183', '59248']);
  assert.ok(!JSON.stringify(archive).includes('DUPONT'));
  assert.ok(!JSON.stringify(archive).includes('MARTIN'));
  // The next day's reading moves `last` and adds nothing.
  ({ archive } = recordCartdsBoards(archive, { 59183: [FILED, DECIDED] }, '2026-10-02', SIRAP_ROWS));
  assert.equal(archive.rows.length, 3);
  assert.equal(archive.days, 2);
  // Read back through the same kind, and refused through the Cart@DS one.
  const document = JSON.parse(JSON.stringify(archive));
  assert.equal(readCartdsArchive(document, instance, '59183', SIRAP_ROWS).archive.rows.length, 3);
  assert.equal(readCartdsArchive(document, instance, '59183').archive.rows.length, 0);
  // And rebuilt into dossiers by the live reader's code.
  const permits = archive.rows.map((row) => normaliseSirapRow(instance, '59183', row.cells)).filter(Boolean);
  assert.equal(foldCartdsDossiers(permits).permits.length, 3);
});

test('the filing and the decision of one dossier, both kept, are one dossier', () => {
  const filed = { ...DECIDED, decision: null, dateDecision: null };
  const { archive } = recordCartdsBoards(emptyCartdsArchive(CUD, '59183'), { 59183: [filed] }, '2026-09-01', SIRAP_ROWS);
  const later = recordCartdsBoards(archive, { 59183: [DECIDED] }, '2026-09-10', SIRAP_ROWS).archive;
  assert.equal(later.rows.length, 2);
  const { permits, folded } = foldCartdsDossiers(later.rows.map((row) => normaliseSirapRow(CUD, '59183', row.cells)));
  assert.equal(permits.length, 1);
  assert.equal(folded, 1);
  assert.equal(permits[0].state, 'accorde');
});
