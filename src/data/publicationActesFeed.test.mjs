// src/data/publicationActesFeed.test.mjs
// Pins how the acts of publication-actes.fr read, as they answered on
// 2026-09-30 for Ustaritz, Ciboure and Monts. Titles keep each commune's
// SHAPE with invented numbers, addresses and names; the list rows are rebuilt
// as text runs at the positions two of Ustaritz's exports draw them, with
// invented dossiers, parcels, addresses and applicants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLICATION_ACTES_COMMUNES,
  foldPublicationActes,
  frenchDay,
  isDepositList,
  normaliseDepositRow,
  normalisePublicationActe,
  parseActTitle,
  parseDepositList,
  publicationActesCommuneFor,
  publicationActesDossier,
  publicationActesSearchUrl,
  publicationActesState,
} from './publicationActesFeed.js';
import { SITADEL_FILES, mergeRegisters, normaliseSitadelRow } from './adsFeed.js';
import { COMMUNE_CODE_PATTERN } from './communeCode.js';

const USTARITZ = publicationActesCommuneFor('64547');
const CIBOURE = publicationActesCommuneFor('64189');
const MONTS = publicationActesCommuneFor('37159');
const HOUSING_FILE = SITADEL_FILES.find((file) => file.key === 'logements');

/** An act as the search endpoint returns it, trimmed to what is read. */
function act(objet, { signed = '2026-09-21', published = '2026-09-22', id = 1 } = {}) {
  return {
    id: `act-${id}`,
    publication_id: id,
    objet,
    date_acte: `${signed}T00:00:00Z`,
    date_publication: `${published}T09:50:09Z`,
    classification_code: '2',
    url: `https://publication-actes.fr/OpenData/216405472/Hors_prefecture/2026/${id}/x.pdf`,
  };
}

test('the registry names each commune by its INSEE code and the SIREN the API is asked with', () => {
  assert.equal(PUBLICATION_ACTES_COMMUNES.length, 3);
  for (const commune of PUBLICATION_ACTES_COMMUNES) {
    assert.match(commune.insee, COMMUNE_CODE_PATTERN);
    // A commune's SIREN is 21, its département, a zero, its number, a key.
    assert.equal(commune.siren.slice(2, 8), `${commune.insee.slice(0, 2)}0${commune.insee.slice(2)}`);
    assert.match(commune.postcode, /^\d{5}$/);
  }
  assert.equal(publicationActesCommuneFor('13114'), null);
  assert.equal(publicationActesCommuneFor('nope'), null);
  assert.equal(USTARITZ.lists, true);
});

test('the search asks for urbanism acts of one SIREN, and pages by the cursor it was given', () => {
  const first = new URL(publicationActesSearchUrl(USTARITZ));
  assert.equal(first.searchParams.get('siren'), '216405472');
  assert.equal(first.searchParams.get('classifications'), '2');
  assert.equal(first.searchParams.get('lignes'), '100');
  assert.equal(first.searchParams.has('page_suivante'), false);
  const next = new URL(publicationActesSearchUrl(USTARITZ, 'AoJw+KAD=='));
  assert.equal(next.searchParams.get('page_suivante'), 'AoJw+KAD==');
});

test('a dossier number reads the same in a title, a list and the State’s register', () => {
  const panneau = 'DP 064547 26 00901';
  assert.equal(publicationActesDossier('DP', 'DP2600901', '64547'), panneau);
  assert.equal(publicationActesDossier('DP', '645472600901', '64547'), panneau);
  assert.equal(publicationActesDossier('DP', '0645472600901', '64547'), panneau);
  // A letter series and a modificatif keep both.
  assert.equal(publicationActesDossier('PC', '22B0901M01', '64547'), 'PC 064547 22 B0901M01');
  assert.equal(publicationActesDossier('PC', '6454722B0913M02', '64547'), 'PC 064547 22 B0913M02');
  assert.equal(publicationActesDossier('PC', '24B0926-M1', '64189'), 'PC 064189 24 B0926M01');
  assert.equal(publicationActesDossier('DP', '0371592449905', '37159'), 'DP 037159 24 49905');
  // Another commune's number is not this commune's dossier.
  assert.equal(publicationActesDossier('DP', '0371542609906', '64547'), null);
  // Veigné's local count (`DP 2026-136`) is not a dossier number at all.
  assert.equal(parseActTitle('DP 2026-136 Accord SARL EXEMPLE'), null);
});

test('Ustaritz’s titles: number first, the verdict only when it is no', () => {
  assert.deepEqual(parseActTitle('DP2600901 : Clôture'), {
    kind: 'DP', number: '2600901', verdict: null, filing: false, address: null, purpose: 'Clôture',
  });
  assert.deepEqual(
    { ...parseActTitle('DP2600902 : Opposition à la réalisation du projet de clôture.') },
    {
      kind: 'DP', number: '2600902', verdict: 'Opposition à la réalisation du projet de',
      filing: false, address: null, purpose: 'clôture.',
    },
  );
  assert.equal(parseActTitle('PC2600903 : Opposition tacite. Délai dépassé').verdict, 'Opposition tacite');
  assert.equal(parseActTitle('DP2600904 : rejet tacite').verdict, 'rejet tacite');
  assert.equal(parseActTitle('PC2600905: annulation à la demande du pétitionnaire').purpose, null);
  assert.equal(parseActTitle('PC22B0901M01 : modifications des façades').number, '22B0901M01');
  assert.equal(parseActTitle('DP645472600906: Détachement d\'un lot à bâtir').number, '645472600906');
});

test('Ciboure’s titles: the verdict before the number, the address after it', () => {
  assert.deepEqual(parseActTitle('DECISION - DP2600911 - 3 rue des Exemples - ravalement façades, menuiseries'), {
    kind: 'DP',
    number: '2600911',
    verdict: null,
    filing: false,
    address: '3 rue des Exemples',
    purpose: 'ravalement façades, menuiseries',
  });
  const refused = parseActTitle('DECISION REFUS - DP2600912 - 5 Impasse du Modèle - remplacement');
  assert.equal(refused.verdict, 'REFUS');
  assert.equal(refused.address, '5 Impasse du Modèle');
  assert.equal(parseActTitle('DECISION REJET TACITE - DP2600913 - 2 rue X - clôture').verdict, 'REJET TACITE');
  assert.equal(parseActTitle('DECISION SANS SUITE - PC2600914 - 1 rue X - maison').verdict, 'SANS SUITE');
  assert.equal(
    parseActTitle('DECISION - PC23B0915 M01 - 20 route du Phare - modification').number,
    '23B0915M01',
  );
});

test('Monts’s titles: an arrêté number, the dossier, the address', () => {
  const plain = parseActTitle('2024-177U DP0371592449901 - 21 rue des Essais');
  assert.equal(plain.verdict, null);
  assert.equal(plain.address, '21 rue des Essais');
  assert.equal(plain.purpose, null);
  const refused = parseActTitle('2023-071U DP0371592349902 REFUS 7 rue des Tests');
  assert.equal(refused.verdict, 'REFUS');
  assert.equal(refused.address, '7 rue des Tests');
  assert.equal(parseActTitle('2022-033U PC0371592149903-RETRAIT').verdict, 'RETRAIT');
});

test('what is not a dossier of a drawn family is left out', () => {
  // An accessibility works permit, a sign, a plan, a title with no number.
  assert.equal(parseActTitle('AT6454726B0908Commerce X'), null);
  assert.equal(parseActTitle('Décision - EN2600907 - 14 avenue X - création de 2 enseignes'), null);
  assert.equal(parseActTitle('2026_068P_Délimitation du Domaine Public au droit du terrain'), null);
  assert.equal(parseActTitle('Création garage et piscine'), null);
  assert.equal(parseActTitle('DECISION - 2600925 - 1 rue X - clôture'), null);
  // A list is read as a list, never as a decision.
  assert.equal(parseActTitle('liste des dépôts de dossiers en urbanisme au 18/09/2026'), null);
  assert.equal(isDepositList(act('Liste des dépots d\'autorisations d\'urbanismes au 21/08/2026')), true);
  assert.equal(isDepositList(act('Liste des dossiers en cours d\'instruction MAJ 11/09/2026')), false);
});

test('a plain decision is a grant where the titles were counted, and nothing elsewhere', () => {
  assert.deepEqual(publicationActesState(USTARITZ, null), { state: 'accorde', label: 'Accordé' });
  assert.deepEqual(publicationActesState(USTARITZ, 'Opposition'), { state: 'refuse', label: 'Refusé' });
  assert.deepEqual(publicationActesState(CIBOURE, 'SANS SUITE'), { state: 'annule', label: 'Annulé' });
  assert.deepEqual(publicationActesState({ ...USTARITZ, plainDecision: null }, null), { state: null, label: null });
});

test('a decision act becomes a dossier keyed like its Sitadel row', () => {
  const permit = normalisePublicationActe(USTARITZ, act('DP2600901 : Clôture'));
  assert.equal(permit.id, 'publication-actes:64547:DP 064547 26 00901');
  assert.equal(permit.dossier, 'DP 064547 26 00901');
  assert.equal(permit.state, 'accorde');
  assert.equal(permit.decidedOn, '2026-09-21');
  assert.equal(permit.postedOn, '2026-09-22');
  assert.equal(permit.depositedOn, null);
  assert.equal(permit.purpose, 'Clôture');
  assert.equal(permit.applicant, null);
  assert.equal(permit.source, 'publication-actes');
  assert.equal(permit.cadastreCommune, '64547');
  const state = normaliseSitadelRow(HOUSING_FILE, {
    NUM_DAU: '0645472600901', TYPE_DAU: 'DP', ETAT_DAU: 2, COMM: '64547',
  });
  assert.equal(permit.key, state.key);

  const ciboure = normalisePublicationActe(CIBOURE, act('DECISION REFUS - DP2600912 - 5 Impasse du Modèle - clôture'));
  assert.equal(ciboure.state, 'refuse');
  assert.equal(ciboure.address, '5 Impasse du Modèle');
  assert.equal(ciboure.postcode, '64500', 'a title’s address is geocoded with its commune’s postcode');
  assert.equal(normalisePublicationActe(MONTS, act('2024-177U DP0371592449901 - 21 rue des Essais')).postcode, '37260');
});

test('a receipt says FILED, dated by its signature', () => {
  const filed = normalisePublicationActe(MONTS, act('Récépissé dépôt DP0371592609904 DUPONT', { signed: '2026-09-25' }));
  assert.equal(filed.state, 'depose');
  assert.equal(filed.depositedOn, '2026-09-25');
  assert.equal(filed.decidedOn, null);
});

test('dates are day-first, in four digits or two', () => {
  assert.equal(frenchDay('30/07/2026'), '2026-07-30');
  assert.equal(frenchDay('18/06/26'), '2026-06-18');
  assert.equal(frenchDay('juillet'), null);
});

/** A run as `pdfText.js` returns it. */
function run(x, y, textValue, size = 11) {
  return { x, x1: x + textValue.length * size * 0.45, y, size, text: textValue, clip: null };
}

test('an Excel list: cells at the top of their row, a nature over two lines', () => {
  const page = {
    runs: [
      run(52.8, 733.3, 'Numéro'), run(147.9, 733.3, 'Demandeur'), run(279.1, 733.3, 'Parcelle(s)'),
      run(550.7, 733.3, 'Destination'), run(614.3, 733.3, 'Nature des travaux'), run(1090.5, 733.3, 'Déposé le'),
      run(52.8, 718.1, 'DP 64 547 2600921'), run(147.9, 718.1, 'DUPONT Jean'), run(279.1, 718.1, 'ZX 0012'),
      run(614.3, 718.1, 'Réalisation d’une piscine enterrée,'), run(614.3, 703.5, 'Autres annexes'),
      run(1090.5, 718.1, '04/09/2026'),
      run(52.8, 689.0, 'DP 64 547 2600922'), run(147.9, 689.0, 'SCI LES OLIVIERS'),
      run(279.1, 689.0, 'ZY 0034, ZY 0035, ZY 0036'), run(550.7, 689.0, 'Habitation'),
      run(614.3, 689.0, 'Modification de la clôture'), run(1090.5, 689.0, '25/08/2026'),
      run(52.8, 660.0, 'AP 64 547 2600923'), run(147.9, 660.0, 'SARL ENSEIGNE'), run(1090.5, 660.0, '03/09/2026'),
    ],
  };
  const rows = parseDepositList({ pages: [page] });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    kind: 'DP',
    number: '645472600921',
    applicant: 'DUPONT Jean',
    address: null,
    parcels: [{ prefix: null, section: 'ZX', numero: '0012', label: 'ZX 12' }],
    purpose: 'Réalisation d’une piscine enterrée, Autres annexes',
    depositedOn: '2026-09-04',
  });
  assert.deepEqual(rows[1].parcels.map((parcel) => parcel.label), ['ZY 34', 'ZY 35', 'ZY 36']);
  assert.equal(rows[1].purpose, 'Modification de la clôture', 'a destination is a column, not a nature');

  // Through the normaliser: FILED, on its parcels, and a person never gets through.
  const filed = normaliseDepositRow(USTARITZ, rows[0], act('liste des dépôts', { published: '2026-09-18' }));
  assert.equal(filed.state, 'depose');
  assert.equal(filed.dossier, 'DP 064547 26 00921');
  assert.equal(filed.depositedOn, '2026-09-04');
  assert.equal(filed.postedOn, '2026-09-18');
  assert.equal(filed.applicant, null);
  assert.deepEqual(filed.parcels, ['ZX 12']);
  assert.deepEqual(filed.parcelIdus.map((ref) => ref.idu), ['64547000ZX0012']);
  assert.equal(normaliseDepositRow(USTARITZ, rows[1]).applicant, 'SCI LES OLIVIERS');
  // A sign's authorisation is not drawn.
  assert.equal(normaliseDepositRow(USTARITZ, rows[2]), null);
});

test('a PDFCreator list: a row’s nature centred, its first line ABOVE the number', () => {
  // Rebuilt from the print of 21 August 2026, every value invented. Read as a
  // band below each number, « Création d’un garage » went to the row before.
  const page = {
    runs: [
      run(51.2, 775.9, 'Numéro', 4.1), run(85.7, 775.9, 'Demandeur', 4.1), run(145.1, 775.9, 'Adresse travaux', 4.1),
      run(201.4, 775.9, 'Parcelle(s)', 4.1), run(232.8, 775.9, 'Destination', 4.1),
      run(320.3, 775.9, 'Nature des travaux', 4.1), run(528.1, 775.9, 'Déposé le', 4.1),
      run(51.2, 770.6, 'DP 64 547 2600931', 4.1), run(85.7, 770.6, 'MARTIN Paul', 4.1),
      run(145.1, 770.6, '141 chemin des Exemples', 4.1), run(201.4, 770.6, 'ZW 0017', 4.1),
      run(528.1, 770.6, '11/08/2026', 4.1),
      run(51.2, 759.8, 'DP 64 547 2600932', 4.1), run(85.7, 759.8, 'DURAND Luc', 4.1),
      run(145.1, 759.8, '676 chemin du Modèle', 4.1), run(201.4, 759.8, 'ZV 0437, ZV 0434', 4.1),
      run(320.3, 765.2, 'Création d’un garage', 4.1), run(320.3, 759.9, 'Construction d’une piscine creusée', 4.1),
      run(528.1, 759.8, '25/07/2026', 4.1),
      run(51.2, 750.4, 'DP 64 547 2600933', 4.1), run(85.7, 750.4, 'BERNARD Anne', 4.1),
      run(145.1, 750.4, '8 impasse des Essais', 4.1), run(201.4, 750.4, 'ZU 0051', 4.1),
      run(232.8, 750.4, 'Habitation', 4.1),
      run(320.3, 750.4, 'Édifica?on de clôtures', 4.1), run(528.1, 750.4, '30/07/2026', 4.1),
    ],
  };
  const rows = parseDepositList({ pages: [page] });
  assert.deepEqual(rows.map((row) => row.purpose), [
    null,
    'Création d’un garage Construction d’une piscine creusée',
    // Office's « ti » ligature, printed as `?` by this exporter, put back.
    'Édification de clôtures',
  ]);
  assert.deepEqual(rows.map((row) => row.address), [
    '141 chemin des Exemples', '676 chemin du Modèle', '8 impasse des Essais',
  ]);
  assert.deepEqual(rows[2].parcels.map((parcel) => parcel.label), ['ZU 51']);
  assert.equal(rows[2].depositedOn, '2026-07-30');
});

test('a scanned list has no rows, and a page with no header reuses nothing it did not see', () => {
  assert.deepEqual(parseDepositList({ pages: [{ runs: [] }] }), []);
  assert.deepEqual(parseDepositList(null), []);
});

test('the list and the decision are one dossier: the list’s ground, the decision’s state', () => {
  const decision = normalisePublicationActe(USTARITZ, act('DP2600901 : Clôture'));
  const listed = normaliseDepositRow(USTARITZ, {
    kind: 'DP',
    number: '645472600901',
    applicant: 'BERNARD Anne',
    address: '8 impasse des Essais',
    parcels: [{ prefix: null, section: 'ZU', numero: '0051', label: 'ZU 51' }],
    purpose: 'Édification de clôtures et d’un mur de soutènement',
    depositedOn: '2026-07-30',
  }, act('Liste des dépôts', { published: '2026-08-21' }));
  const { permits, folded } = foldPublicationActes([listed, decision]);
  assert.equal(folded, 1);
  assert.equal(permits.length, 1);
  const [dossier] = permits;
  assert.equal(dossier.state, 'accorde');
  assert.equal(dossier.decidedOn, '2026-09-21');
  assert.equal(dossier.depositedOn, '2026-07-30');
  assert.deepEqual(dossier.parcels, ['ZU 51']);
  assert.equal(dossier.parcelIdus[0].idu, '64547000ZU0051');
  assert.equal(dossier.address, '8 impasse des Essais');
  assert.equal(dossier.purpose, 'Édification de clôtures et d’un mur de soutènement');
  assert.equal(dossier.applicant, null);
});

test('a filed dossier the State has since granted reads as granted', () => {
  const listed = normaliseDepositRow(USTARITZ, {
    kind: 'PC', number: '645472509951', applicant: null, address: null,
    parcels: [{ prefix: null, section: 'ZT', numero: '0105', label: 'ZT 105' }],
    purpose: 'Modification de façades', depositedOn: '2025-11-13',
  });
  const state = normaliseSitadelRow(HOUSING_FILE, {
    NUM_DAU: '0645472509951', TYPE_DAU: 'PC', ETAT_DAU: 2, COMM: '64547',
  });
  const { permits, merged } = mergeRegisters([state], [listed]);
  assert.equal(merged, 1);
  assert.equal(permits[0].state, 'autorise');
  assert.deepEqual(permits[0].sources, ['publication-actes', 'sitadel']);
});
