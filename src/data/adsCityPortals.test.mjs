// src/data/adsCityPortals.test.mjs
// Pins the two city portals added on 2026-10-01 — Tours (Opendatasoft, one row
// per parcel and per step, a five-digit commune in its dossier numbers) and
// Brest (an ArcGIS map service answering GeoJSON) — against rows shaped like
// the ones they answered that day. Addresses and parcels are invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_ADS_PORTALS,
  SITADEL_FILES,
  buildLocalAdsExcludedCountUrl,
  buildLocalAdsUrl,
  foldLocalRows,
  localDossier,
  localRows,
  localState,
  mergeRegisters,
  normaliseLocalRow,
  normaliseSitadelRow,
  portalsForCommune,
} from './adsFeed.js';

const TOURS = LOCAL_ADS_PORTALS.find((portal) => portal.key === 'tours');
const BREST = LOCAL_ADS_PORTALS.find((portal) => portal.key === 'brest');
const PARIS = LOCAL_ADS_PORTALS.find((portal) => portal.key === 'paris');
const HOUSING_FILE = SITADEL_FILES.find((file) => file.key === 'logements');

/** One Tours dossier on two parcels: filed (two rows), then decided (two). */
const TOURS_ROWS = Object.freeze([
  {
    numero_de_dossier: 'DP 37261 26 T1186', code_insee: '37261',
    type_de_demande_d_autorisation: 'Déclaration Préalable de Construction',
    recu_en_mairie: '2026-09-28', adresse_des_travaux: '12 Rue des Exemples', cp_des_travaux: '37000',
    objet_des_travaux: 'Remplacement des menuiseries', surface_de_plancher_creee: null,
    nature_de_la_decision: null, date_de_la_decision: null, ref_cadastre: 'AO0045',
  },
  {
    numero_de_dossier: 'DP 37261 26 T1186', code_insee: '37261',
    type_de_demande_d_autorisation: 'Déclaration Préalable de Construction',
    recu_en_mairie: '2026-09-28', adresse_des_travaux: '12 Rue des Exemples', cp_des_travaux: '37000',
    objet_des_travaux: 'Remplacement des menuiseries', surface_de_plancher_creee: null,
    nature_de_la_decision: null, date_de_la_decision: null, ref_cadastre: 'AO99',
  },
  {
    numero_de_dossier: 'DP 37261 26 T1186', code_insee: '37261',
    type_de_demande_d_autorisation: 'Déclaration Préalable de Construction',
    recu_en_mairie: '2026-09-28', adresse_des_travaux: '12 Rue des Exemples', cp_des_travaux: '37000',
    objet_des_travaux: 'Remplacement des menuiseries', surface_de_plancher_creee: null,
    nature_de_la_decision: 'Accord avec prescription', date_de_la_decision: '2026-10-20', ref_cadastre: 'AO0045',
  },
  {
    numero_de_dossier: 'DP 37261 26 T1186', code_insee: '37261',
    type_de_demande_d_autorisation: 'Déclaration Préalable de Construction',
    recu_en_mairie: '2026-09-28', adresse_des_travaux: '12 Rue des Exemples', cp_des_travaux: '37000',
    objet_des_travaux: 'Remplacement des menuiseries', surface_de_plancher_creee: null,
    nature_de_la_decision: 'Accord avec prescription', date_de_la_decision: '2026-10-20', ref_cadastre: '0',
  },
]);

/** A Brest answer: one granted permit, its dates in milliseconds. */
const BREST_ANSWER = Object.freeze({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    id: 1,
    geometry: { type: 'Point', coordinates: [-4.4437, 48.4219] },
    properties: {
      NOM_DOSSIER: 'PC 029 075 24 00053', TYPE_DOSSIER: 'PC', ADRESSE: 'RUE DES EXEMPLES',
      PARCELLE: '75 G 865', OBJET_DEMANDE: 'Autre permis de construire',
      PRECISION_TRAVAUX: 'Construction d’un équipement sportif', SF_CREEE: 38949, NB_LOGEMENTS: null,
      // 2024-06-27 22:00 UTC and 2025-12-18 23:00 UTC: the 28th and the 19th in Brest.
      DATE_DEPOT: 1719525600000, DECISION_ARRETE: 'Favorable avec réserve', DATE_ARRETE: 1766098800000,
    },
  }],
});

test('Tours and Brest are gated by the communes they publish, and by nothing else', () => {
  assert.deepEqual(portalsForCommune('37261').map((portal) => portal.key), ['tours']);
  // The métropole's other communes publish no file.
  assert.deepEqual(portalsForCommune('37122'), []);
  for (const code of ['29011', '29019', '29061', '29069', '29189', '29212', '29235']) {
    assert.deepEqual(portalsForCommune(code).map((portal) => portal.key), ['brest'], code);
  }
  assert.deepEqual(portalsForCommune('29075'), [], 'Guipavas uses its municipal registers');
  // No commune is claimed twice across the portals.
  const seen = new Set();
  for (const portal of LOCAL_ADS_PORTALS) {
    for (const code of portal.communes) {
      assert.ok(!seen.has(code), `${code} in two portals`);
      seen.add(code);
    }
  }
});

test('Tours is asked by commune, on the date it received the dossier', () => {
  const url = new URL(buildLocalAdsUrl(TOURS, { communeCode: '37261', since: '2023-10-01' }));
  assert.equal(url.host, 'data.tours-metropole.fr');
  assert.match(url.pathname, /dossiers-deposes-urbanisme-tours\/exports\/json$/);
  assert.equal(url.searchParams.get('where'), 'code_insee = "37261" and recu_en_mairie >= date\'2023-10-01\'');
  // The applicant's name and home address are never even asked for.
  assert.ok(!url.searchParams.get('select').includes('demandeur'));
  assert.equal(buildLocalAdsExcludedCountUrl(TOURS, { communeCode: '37261', since: '2023-10-01' }), null);
});

test('Brest is asked by radius, in metres, on its own SQL, for GeoJSON in WGS 84', () => {
  const url = new URL(buildLocalAdsUrl(BREST, { lon: -4.4861, lat: 48.3904, radiusM: 400.4, since: '2023-10-01' }));
  assert.equal(url.origin, 'https://geo.brest-metropole.fr');
  assert.match(url.pathname, /\/MapServer\/2811003\/query$/);
  assert.equal(url.searchParams.get('where'), "DATE_DEPOT >= DATE '2023-10-01'");
  assert.equal(url.searchParams.get('geometry'), '-4.4861,48.3904');
  assert.equal(url.searchParams.get('distance'), '400');
  assert.equal(url.searchParams.get('units'), 'esriSRUnit_Meter');
  assert.equal(url.searchParams.get('inSR'), '4326');
  assert.equal(url.searchParams.get('outSR'), '4326');
  assert.equal(url.searchParams.get('f'), 'geojson');
  assert.equal(buildLocalAdsExcludedCountUrl(BREST, { lon: 0, lat: 0, radiusM: 1, since: '2023-10-01' }), null);
});

test('an ArcGIS answer becomes flat rows, its dates the Paris day they fall on', () => {
  const rows = localRows(BREST, BREST_ANSWER);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].DATE_DEPOT, '2024-06-28');
  assert.equal(rows[0].DATE_ARRETE, '2025-12-19');
  assert.deepEqual(rows[0].geometry.coordinates, [-4.4437, 48.4219]);
  // An error object is a failure, never an empty list — for both kinds.
  assert.equal(localRows(BREST, { error: { code: 400, message: 'Invalid query' } }), null);
  assert.equal(localRows(BREST, []), null);
  assert.deepEqual(localRows(PARIS, []), []);
  assert.equal(localRows(PARIS, { error_code: 'ODSQLError' }), null);
  assert.deepEqual(localRows(BREST, { type: 'FeatureCollection', features: [] }), []);
});

test('a Brest permit is placed by its own point, granted, and keeps its figures', () => {
  const [permit] = localRows(BREST, BREST_ANSWER).map((row) => normaliseLocalRow(BREST, row));
  assert.equal(permit.dossier, 'PC 029 075 24 00053');
  assert.equal(permit.key, 'DAU|0290752400053');
  assert.equal(permit.kind, 'PC');
  assert.equal(permit.state, 'accorde');
  assert.equal(permit.depositedOn, '2024-06-28');
  assert.equal(permit.decidedOn, '2025-12-19');
  assert.equal(permit.lon, -4.4437);
  assert.equal(permit.lat, 48.4219);
  assert.equal(permit.precision, 'published');
  assert.equal(permit.purpose, 'Construction d’un équipement sportif');
  assert.equal(permit.surfaceCreatedM2, 38949);
  // A blank housing count is unknown, not zero.
  assert.equal(permit.housing, null);
  assert.deepEqual(permit.parcels, ['75 G 865']);
  assert.deepEqual(permit.parcelIdus, [], 'a point already places it');
  assert.equal(permit.source, 'brest');
});

test('Tours numbers meet Sitadel’s, which write the département on three digits', () => {
  assert.equal(localDossier(TOURS, 'DP 37261 26 T1181'), 'DP 037 261 26 T1181');
  assert.equal(localDossier(TOURS, 'DP 37261 26 T0020 M01'), 'DP 037 261 26 T0020 M01');
  // Only the flagged portal, and only that exact shape.
  assert.equal(localDossier(PARIS, 'DP 37261 26 T1181'), 'DP 37261 26 T1181');
  assert.equal(localDossier(TOURS, 'DP0441662600106'), 'DP0441662600106');
  assert.equal(localDossier(TOURS, 'DP 075 108 26 V0143'), 'DP 075 108 26 V0143');

  const permit = normaliseLocalRow(TOURS, TOURS_ROWS[0]);
  const twin = normaliseSitadelRow(HOUSING_FILE, {
    NUM_DAU: '03726126T1186', TYPE_DAU: 'DP', ETAT_DAU: '2', COMM: '37261',
    DATE_REELLE_AUTORISATION: '2026-10-20',
  });
  assert.equal(permit.key, twin.key);
  const { permits, merged } = mergeRegisters([twin], [permit]);
  assert.equal(merged, 1);
  assert.equal(permits.length, 1, 'one dossier, not the same one twice');
});

test('a Tours row is filed until a decision says otherwise, and stands on its parcel', () => {
  const filed = normaliseLocalRow(TOURS, TOURS_ROWS[0]);
  assert.equal(filed.kind, 'DP');
  assert.equal(filed.state, 'depose');
  assert.equal(filed.depositedOn, '2026-09-28');
  assert.equal(filed.decidedOn, null);
  assert.equal(filed.postcode, '37000');
  assert.equal(filed.communeCode, '37261');
  assert.equal(filed.cadastreCommune, '37261');
  assert.deepEqual(filed.parcelIdus, [{ idu: '37261000AO0045', provisional: false, label: 'AO 45' }]);
  assert.deepEqual(normaliseLocalRow(TOURS, TOURS_ROWS[1]).parcelIdus.map((ref) => ref.idu), ['37261000AO0099']);

  const decided = normaliseLocalRow(TOURS, TOURS_ROWS[3]);
  assert.equal(decided.state, 'accorde');
  assert.equal(decided.decidedOn, '2026-10-20');
  // `0` is the decision row's blank, not a parcel.
  assert.deepEqual(decided.parcels, []);
  assert.deepEqual(decided.parcelIdus, []);
  assert.equal(decided.cadastreCommune, null);
});

test('four Tours rows are one dossier: the decision leads, the parcels are pooled', () => {
  const { permits, folded } = foldLocalRows(TOURS_ROWS.map((row) => normaliseLocalRow(TOURS, row)));
  assert.equal(permits.length, 1);
  assert.equal(folded, 3);
  const [dossier] = permits;
  assert.equal(dossier.state, 'accorde');
  assert.equal(dossier.decidedOn, '2026-10-20');
  assert.equal(dossier.cadastreCommune, '37261');
  assert.deepEqual(dossier.parcelIdus.map((ref) => ref.idu).sort(), ['37261000AO0045', '37261000AO0099']);
  // A PC and a DP of the same number are two dossiers.
  const pc = normaliseLocalRow(TOURS, {
    ...TOURS_ROWS[0],
    numero_de_dossier: 'PC 37261 26 T1186',
    type_de_demande_d_autorisation: 'Permis de Construire',
  });
  assert.equal(foldLocalRows([pc, normaliseLocalRow(TOURS, TOURS_ROWS[0])]).permits.length, 2);
});

test('the decision words of Tours and Brest land on the ladder, refusals first', () => {
  assert.equal(localState('Défavorable').state, 'refuse');
  assert.equal(localState('Rejet tacite pour incomplétude').state, 'refuse');
  assert.equal(localState('Refus').state, 'refuse');
  assert.equal(localState('Favorable avec réserve').state, 'accorde');
  assert.equal(localState('Favorable tacite').state, 'accorde');
  assert.equal(localState('Accord tacite').state, 'accorde');
  assert.equal(localState('Non opposition').state, 'accorde');
  assert.equal(localState('Opposition').state, 'refuse');
  assert.equal(localState('Annulation').state, 'annule');
  // The Nantes and Paris vocabularies are untouched.
  assert.equal(localState('Dossier avec décision (- de 2 mois)').state, 'depose');
  assert.equal(localState("Dossier déposé (en cours d'instruction)").state, 'instruction');
  assert.equal(localState('Accordé').state, 'accorde');
  assert.equal(localState('Refusé').state, 'refuse');
});
