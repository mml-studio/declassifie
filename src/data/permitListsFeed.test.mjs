// src/data/permitListsFeed.test.mjs
// Pins the two table layouts Marseille and Nîmes published on 2026-10-01, as
// positioned text runs placed where `pdfText.js` found them in those files —
// the column headers, the line pitches, the footers — with every name,
// address and number replaced: a person's name never reaches this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMIT_LISTS,
  PERMIT_LIST_BOARDS,
  PERMIT_LIST_READERS,
  PERMIT_LIST_ROWS,
  normalisePermitListRow,
  permitListDossier,
  permitListFor,
  permitListLinks,
  permitListRobotsUrl,
  permitListVerdictState,
  readDecisionTable,
  readRegisterList,
  registerApplicant,
  registerDecision,
  registerSite,
  scrubPermitListRow,
  PERMIT_LIST_TEXT,
  aixDossier,
  driveFileUrl,
  driveFolderUrl,
  parseDriveFolder,
  readVersaillesList,
  versaillesParcels,
  gridApplicant,
  joinDossier,
  typo3ListLinks,
  digilorDocuments,
  digilorIndexBody,
  digilorIndexUrl,
  listParcels,
  lyonSite,
  parseWebdelibActs,
  readAixTables,
  readLyonList,
  webdelibFileUrl,
  webdelibLists,
  webdelibMonths,
  webdelibMonthUrl,
} from './permitListsFeed.js';
import { SITADEL_FILES, mergeRegisters, normaliseSitadelRow } from './adsFeed.js';
import { COMMUNE_CODE_PATTERN } from './communeCode.js';
import { foldCartdsDossiers } from './cartdsFeed.js';
import { archivedCartdsRows, emptyCartdsArchive, recordCartdsBoards } from './cartdsArchive.js';

const MARSEILLE = PERMIT_LISTS.find((city) => city.key === 'marseille');
const NIMES = PERMIT_LISTS.find((city) => city.key === 'nimes');

/** One text run as `extractPdfText` returns it. */
const run = (text, x, y, { x1 = x, size = 7 } = {}) => ({ x, x1, y, size, text, clip: null });

// --- The register layout (Marseille's list under review, Nîmes's file) ------

const REGISTER_HEADER = [
  run('DOSSIER', 83.5, 448.6), run('DATES', 200.9, 448.6), run('DEMANDEUR', 317.6, 448.6),
  run('TERRAIN', 494.9, 448.6), run('INFORMATIONS', 625.1, 448.6),
];

/**
 * One register page: a record whose number sits on the fourth line, and one
 * whose number sits two lines under its label with nothing in between — the
 * case a gap of two lines must not cut. The second record differs from page
 * to page, as a page's last record does in every real file; only the footer
 * repeats.
 */
function registerPage(n, { last = run('LIMITE', 754.1, 448.6), decision = null } = {}) {
  const tail = (top, words) => (words
    ? [run(words[0], 711.5, top), ...(words[1] ? [run(words[1], 711.5, top - 8.7)] : [])]
    : [run('Délai 2 mois mois', 711.5, top), run(`Date limite le ${10 + n}/11/2026`, 711.5, top - 8.7)]);
  return {
    runs: [
      run('DIRECTION DE L’URBANISME', 143, 563.5, { size: 12 }),
      ...REGISTER_HEADER, last,
      run('DÉCLARATION PRÉALABLE', 52.9, 429.8), run('CONSTRUCTION (Initiale)', 57.6, 421.1),
      run(`DP 013055 26 0${3000 + n}P0`, 61.9, 403.6),
      run('Déposé le 03/08/2026', 178.4, 429.8), run('Complété le 11/08/2026', 175.3, 421.1),
      run('SCI', 258, 429.8), run('DES EXEMPLES', 258, 421.1), run('1 rue du Siège', 258, 412.3),
      run('13008 MARSEILLE', 258, 403.6),
      run('65 La Canebière', 428, 429.8), run('13001 Marseille', 428, 421.1), run('Arrondissement : 1', 428, 412.3),
      run('superficie : 1 865 m²', 590, 429.8), run('nombre de logements : 2', 590, 421.1),
      ...tail(429.8, decision),
      run('DÉCLARATION PRÉALABLE', 52.9, 390.1), run(n === 1 ? 'AMÉNAGEMENT (Initiale)' : 'CONSTRUCTION (Initiale)', 58, 381.4),
      run(`DP 013055 26 0${3100 + n}P0`, 61.9, 363.9),
      run('Déposé le 04/08/2026', 178.4, 390.1),
      run('M. DUPONT JEAN', 258, 390.1), run(`${n} rue Exemple`, 258, 381.4),
      run(`Chemin des Exemples ${n}`, 428, 390.1), run(n === 1 ? 'Marseille' : `130${10 + n} Marseille`, 428, 381.4),
      ...tail(390.1, decision ? ['Favorable le 01/09/2026'] : null),
      // The footer, 17 points under the last line — closer than the gap that
      // ends a record, so only its repetition across pages gives it away.
      run('Service Exemple - SARP', 28, 346.9), run('28/09/2026', 28, 340),
      run(`Page ${n}/3`, 387, 330),
    ],
  };
}

test('the register reads every record, the one with a blank line over its number included', () => {
  const rows = readRegisterList({ pages: [registerPage(1), registerPage(2), registerPage(3)] });
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((row) => row.dossier), [
    'DP 013055 26 03001P0', 'DP 013055 26 03101P0',
    'DP 013055 26 03002P0', 'DP 013055 26 03102P0',
    'DP 013055 26 03003P0', 'DP 013055 26 03103P0',
  ]);
  const [first, second] = rows;
  assert.equal(first.board, PERMIT_LIST_BOARDS.filings);
  assert.equal(first.label, 'DÉCLARATION PRÉALABLE CONSTRUCTION (Initiale)');
  assert.equal(first.filedOn, '2026-08-03');
  assert.equal(first.applicant, 'SCI DES EXEMPLES');
  assert.deepEqual([first.address, first.postcode, first.locality], ['65 La Canebière', '13001', 'Marseille']);
  assert.equal(first.landArea, '1865');
  assert.equal(first.housing, '2');
  assert.equal(first.verdict, null);
  // The footer, the edition date and the page number reach no record.
  assert.deepEqual([second.address, second.postcode, second.locality], ['Chemin des Exemples 1', null, 'Marseille']);
  assert.deepEqual([rows[3].address, rows[3].postcode, rows[3].label],
    ['Chemin des Exemples 2', '13012', 'DÉCLARATION PRÉALABLE CONSTRUCTION (Initiale)']);
  assert.ok(!JSON.stringify(rows).includes('SARP'));
  assert.ok(!JSON.stringify(rows).includes('Page'));
});

test('a register of decisions in the same layout says so, refusals included', () => {
  const decided = readRegisterList({ pages: [
    registerPage(1, { last: run('DÉCISION', 754.1, 448.6), decision: ['Rejet tacite le 26/07/2026'] }),
    registerPage(2, { last: run('DÉCISION', 754.1, 448.6), decision: ['[reprise]Dossier irrecevable le', '09/04/2201'] }),
  ] });
  assert.ok(decided.every((row) => row.board === PERMIT_LIST_BOARDS.decisions));
  assert.deepEqual(decided.map((row) => [row.verdict, row.decidedOn]), [
    ['Rejet tacite', '2026-07-26'],
    ['Favorable', '2026-09-01'],
    // The software's own year typo is no decision date.
    ['Dossier irrecevable', null],
    ['Favorable', '2026-09-01'],
  ]);
  // A page with neither a deadline nor a decision column is no register.
  assert.deepEqual(readRegisterList({ pages: [{ runs: registerPage(1).runs.filter((r) => r.text !== 'LIMITE') }] }), []);
  assert.deepEqual(readRegisterList(null), []);
});

test('a register decision cell is split into its verdict and its day', () => {
  assert.deepEqual(registerDecision(['Favorable avec Reserves le', '12/08/2026']),
    { verdict: 'Favorable avec Reserves', decidedOn: '2026-08-12' });
  assert.deepEqual(registerDecision(['retiré le 23/07/2026']), { verdict: 'retiré', decidedOn: '2026-07-23' });
  assert.deepEqual(registerDecision(['Sans date']), { verdict: 'Sans date', decidedOn: null });
  assert.deepEqual(registerDecision([]), { verdict: null, decidedOn: null });
});

test('a site is its street, its postcode and its locality, whatever lines it takes', () => {
  assert.deepEqual(registerSite(['65 La Canebière', '13001 Marseille', 'Arrondissement : 1']),
    { address: '65 La Canebière', postcode: '13001', locality: 'Marseille' });
  assert.deepEqual(registerSite(['1396 B CHEMIN DES TERRES DE', 'ROUVIERE', '30000 Nîmes', 'superficie : 2812 m²']),
    { address: '1396 B CHEMIN DES TERRES DE ROUVIERE', postcode: '30000', locality: 'Nîmes' });
  assert.deepEqual(registerSite(['Chemin du Mas', 'Nîmes', 'superficie : 78749 m²']),
    { address: 'Chemin du Mas', postcode: null, locality: 'Nîmes' });
  assert.deepEqual(registerSite(['1500 le Mas Blanc']), { address: '1500 le Mas Blanc', postcode: null, locality: null });
  assert.deepEqual(registerSite([]), { address: null, postcode: null, locality: null });
});

test('the applicant is the first line of the cell, never the address under it', () => {
  assert.equal(registerApplicant(['EXEMPLE EAUX 281 avenue des Exemples', 'ZI des Exemples']), 'EXEMPLE EAUX');
  assert.equal(registerApplicant(['S.A.S.', 'COMPAGNIE EXEMPLE', '900 rue Ampère']), 'S.A.S. COMPAGNIE EXEMPLE');
  assert.equal(registerApplicant(['SCI A, SCI B, M.', 'DUPONT Jean']), 'SCI A, SCI B');
  assert.equal(registerApplicant(['VILLE DE NIMES place de l’Hôtel de']), 'VILLE DE NIMES');
  assert.equal(registerApplicant([]), null);
});

// --- Marseille's list of decisions: a spreadsheet, every cell centred -------

const DECISION_HEADER = [
  run('CODE POSTAL', 60.1, 676.4, { x1: 104.1, size: 6.1 }), run('DOSSIER', 130.5, 676.4, { x1: 157.9, size: 6.1 }),
  run('ADRESSE', 230.2, 676.4, { x1: 259.7, size: 6.1 }), run('NATURE TRAVAUX', 357.2, 676.4, { x1: 413.8, size: 6.1 }),
  run('DEMANDEUR', 531.4, 680.4, { x1: 571.2, size: 6.1 }), run('DATE DÉPÔT', 650.1, 676.4, { x1: 689.3, size: 6.1 }),
  run('AVIS DÉCISION', 717.4, 676.4, { x1: 762.8, size: 6.1 }), run('DATE DÉCISION', 786.4, 676.4, { x1: 834.2, size: 6.1 }),
  run('DATE', 859, 683, { x1: 878, size: 6.1 }), run('AFFICHAGE', 850, 676.4, { x1: 885, size: 6.1 }),
  run('DÉCISION', 854, 669.6, { x1: 883, size: 6.1 }),
  run('LOGEMENTS CRÉÉS', 897, 673, { x1: 958, size: 6.1 }), run('LOTS PROJETS', 970, 673, { x1: 1017, size: 6.1 }),
  run('SDP', 1039, 676.4, { x1: 1051.5, size: 6.1 }), run('COMPÉTENCE', 1077.1, 676.4, { x1: 1120.2, size: 6.1 }),
];

/** A row's cells at the row's middle `y`, each centred where its header is. */
function decisionRow(y, cells) {
  const centres = {
    postcode: 82, dossier: 144, address: 245, purpose: 385.5, applicant: 551, filedOn: 670,
    verdict: 740, decidedOn: 810, postedOn: 867.5, housing: 927.5, lots: 993.5, floorArea: 1045, competence: 1098.5,
  };
  const out = [];
  for (const [field, value] of Object.entries(cells)) {
    const lines = Array.isArray(value) ? value : [value];
    lines.forEach((line, i) => {
      const width = line.length * 2.6;
      const at = y + ((lines.length - 1) / 2 - i) * 6.2;
      out.push(run(line, centres[field] - width / 2, at, { x1: centres[field] + width / 2, size: 5.5 }));
    });
  }
  return out;
}

function decisionPage(n) {
  return {
    runs: [
      run('Liste des autorisations d’urbanisme délivrées', 373.9, 741.7, { x1: 815.5, size: 13.4 }),
      ...DECISION_HEADER,
      // The first row sits at the same height on every page, and its verdict
      // and its posting day are the same on every page: cells, not furniture.
      ...decisionRow(650, {
        postcode: '13001', dossier: `DP 013055 26 0${2800 + n}P0`, address: '102 rue Exemple 13001',
        purpose: 'ravalement de façades .', applicant: 'EXEMPLE IMMOBILIER', filedOn: '10/07/2026',
        verdict: 'Accord Tacite', decidedOn: '30/08/2026', postedOn: '29/09/2026', competence: 'Commune',
      }),
      ...decisionRow(610, {
        postcode: '13001', dossier: `PC 013055 26 00${200 + n}P0`, address: '24 RUE DES EXEMPLES 13001',
        purpose: ['Réhabilitation d’un bâtiment en résidence', 'étudiante et création d’une terrasse', `végétalisée ${n}..`],
        applicant: 'SCI EXEMPLE RÉSIDENCE', filedOn: '03/03/2026', verdict: 'Favorable avec Reserves',
        decidedOn: '31/08/2026', postedOn: '01/09/2026', housing: '16', floorArea: '1300', competence: 'Métropole',
      }),
      run('Service des Autorisations d’Urbanisme - SAU', 36.8, 74.7, { x1: 183.4, size: 7.3 }),
      run('29/09/2026', 36.8, 58.3, { x1: 73.4, size: 7.3 }),
      run(`Page ${n}/3`, 581.4, 66.9, { x1: 609.2, size: 6.1 }),
    ],
  };
}

test('the list of decisions reads one row per number, its centred cells whole', () => {
  const rows = readDecisionTable({ pages: [decisionPage(1), decisionPage(2), decisionPage(3)] });
  assert.equal(rows.length, 6);
  const [first, second] = rows;
  assert.deepEqual(first, {
    board: PERMIT_LIST_BOARDS.decisions,
    dossier: 'DP 013055 26 02801P0',
    label: null,
    purpose: 'ravalement de façades',
    applicant: 'EXEMPLE IMMOBILIER',
    address: '102 rue Exemple',
    postcode: '13001',
    locality: null,
    filedOn: '2026-07-10',
    verdict: 'Accord Tacite',
    decidedOn: '2026-08-30',
    postedOn: '2026-09-29',
    landArea: null,
    housing: null,
    lots: null,
    floorArea: null,
  });
  assert.equal(second.purpose,
    'Réhabilitation d’un bâtiment en résidence étudiante et création d’une terrasse végétalisée 1');
  assert.deepEqual([second.housing, second.floorArea, second.verdict], ['16', '1300', 'Favorable avec Reserves']);
  // Every first row kept its verdict on every page.
  assert.deepEqual(rows.filter((_, i) => i % 2 === 0).map((row) => row.verdict), Array(3).fill('Accord Tacite'));
  assert.ok(!JSON.stringify(rows).includes('SAU'));
  assert.deepEqual(readDecisionTable({ pages: [{ runs: DECISION_HEADER }] }), []);
});

test('each layout a list names has its reader', () => {
  for (const city of PERMIT_LISTS) {
    for (const list of city.lists) {
      assert.equal(typeof PERMIT_LIST_READERS[list.layout], 'function', `${city.key} ${list.layout}`);
      // A list without a board is one whose reader says, row by row (Lyon's sections).
      assert.ok(list.board === undefined || Object.hasOwn(PERMIT_LIST_BOARDS, list.board));
    }
  }
});

// --- Registry, links ---------------------------------------------------------

test('the registry gates by commune, and an arrondissement finds its city', () => {
  for (const city of PERMIT_LISTS) {
    assert.match(city.insee, COMMUNE_CODE_PATTERN);
    assert.match(city.page, /^https:\/\//);
    assert.ok(city.label.includes(' — '), 'the card reads the authority before the dash');
  }
  assert.equal(permitListFor('13055'), MARSEILLE);
  assert.equal(permitListFor('13201'), MARSEILLE);
  assert.equal(permitListFor('13216'), MARSEILLE);
  assert.equal(permitListFor('30189'), NIMES);
  assert.equal(permitListFor('75056'), null);
  assert.equal(permitListFor(null), null);
  assert.equal(permitListRobotsUrl(MARSEILLE), 'https://www.marseille.fr/robots.txt');
});

test('a list is found by its words or its address, and a missing one fails the page', () => {
  const page = `
    <a href="/sites/default/files/contenu/logement/ServicesetDemarches/28.09.26.pdf" target="_blank">Liste des&nbsp;dossiers en cours d'instruction classés par arrondissement</a>
    <a href="https://example.org/autorisations-delivrees.html">Liste des autorisations délivrées (page)</a>
    <a href='/sites/default/files/contenu/logement/ServicesetDemarches/affichage-du-16.07.26-au-29.09.26.pdf'><span>Liste des autorisations délivrées</span> ces deux derniers mois</a>`;
  assert.deepEqual(permitListLinks(MARSEILLE, page), [
    {
      board: 'filings',
      layout: 'register',
      url: 'https://www.marseille.fr/sites/default/files/contenu/logement/ServicesetDemarches/28.09.26.pdf',
    },
    {
      board: 'decisions',
      layout: 'decisions',
      url: 'https://www.marseille.fr/sites/default/files/contenu/logement/ServicesetDemarches/affichage-du-16.07.26-au-29.09.26.pdf',
    },
  ]);
  assert.equal(permitListLinks(MARSEILLE, page.split('\n').slice(0, 2).join('\n')), null);
  assert.deepEqual(permitListLinks(NIMES, '<a href="/fileadmin/x/20260921-etat-registre_dossiers_affichage_reglementaire.pdf" class="c"><span></span></a>'), [{
    board: 'filings',
    layout: 'register',
    url: 'https://www.nimes.fr/fileadmin/x/20260921-etat-registre_dossiers_affichage_reglementaire.pdf',
  }]);
  assert.equal(permitListLinks(NIMES, ''), null);
});

// --- Keeping, normalising, merging -------------------------------------------

test('a printed number is keyed as Sitadel writes it, the original\'s suffix dropped', () => {
  assert.deepEqual(permitListDossier('PC 013055 26 00230P0'), { kind: 'PC', digits: '0130552600230' });
  assert.deepEqual(permitListDossier('PC 013055 25 00123M01'), { kind: 'PC', digits: '0130552500123M01' });
  assert.deepEqual(permitListDossier('PC 013055 11 01378T03'), { kind: 'PC', digits: '0130551101378T03' });
  assert.deepEqual(permitListDossier('PC 030189 24 P0240'), { kind: 'PC', digits: '03018924P0240' });
  assert.deepEqual(permitListDossier('PC 030189 06 P0166 M01'), { kind: 'PC', digits: '03018906P0166M01' });
  assert.deepEqual(permitListDossier('dp 030189 25 00715'), { kind: 'DP', digits: '0301892500715' });
  assert.equal(permitListDossier('IA 013055 26 00001P0'), null);
  assert.equal(permitListDossier('Page 1/40'), null);
});

test('a row is stored with an organisation\'s name and never a person\'s', () => {
  const [first, second] = readRegisterList({ pages: [registerPage(1)] });
  const kept = scrubPermitListRow(first);
  assert.equal(kept[3], 'SCI DES EXEMPLES');
  assert.equal(scrubPermitListRow(second)[3], null);
  // Cells already kept are scrubbed again, to the same cells.
  assert.deepEqual(scrubPermitListRow(kept), kept);
  assert.equal(scrubPermitListRow({ ...first, dossier: 'IA 013055 26 00001P0' }), null);
  assert.equal(scrubPermitListRow(null), null);
  assert.ok(PERMIT_LIST_ROWS.board('filings') && PERMIT_LIST_ROWS.board('decisions'));
  assert.ok(!PERMIT_LIST_ROWS.board('1'));
});

test('a filed row is under review on the current edition, and only filed after it', () => {
  const [row] = readRegisterList({ pages: [registerPage(1)] });
  const current = normalisePermitListRow(MARSEILLE, 'filings', row, { current: true });
  const dropped = normalisePermitListRow(MARSEILLE, 'filings', row, { current: false });
  assert.equal(current.state, 'instruction');
  assert.equal(current.stateLabel, 'En cours d’instruction');
  assert.equal(dropped.state, 'depose');
  assert.equal(current.id, 'permit-list:marseille:DP0130552603001');
  assert.equal(current.dossier, 'DP 013 055 26 03001');
  assert.equal(current.key, 'DAU|0130552603001');
  // The general form for works says nothing of the works: the family stands in.
  assert.equal(current.purpose, 'Déclaration préalable');
  const label = (words) => normalisePermitListRow(MARSEILLE, 'filings', { ...row, label: words }).purpose;
  assert.equal(label('PERMIS DE CONSTRUIRE DE MAISON INDIVIDUELLE (Initial)'), 'maison individuelle');
  assert.equal(label('DÉCLARATION PRÉALABLE AMÉNAGEMENT (Initiale)'), 'aménagement');
  assert.equal(label('PERMIS DE CONSTRUIRE (Modificatif)'), 'modificatif');
  assert.equal(label('DÉCLARATION PRÉALABLE MAISON INDIVIDUELLE (Transfert)'), 'maison individuelle, transfert');
  assert.equal(current.communeCode, '13055');
  assert.equal(current.landAreaM2, 1865);
  assert.equal(current.housing, 2);
  assert.equal(current.source, 'permit-list');
  assert.equal(current.sourceLabel, MARSEILLE.label);
  assert.equal(current.decidedOn, null);
});

test('a published verdict reads on the shared ladder, a withdrawal as closed', () => {
  assert.equal(permitListVerdictState('Accord Tacite'), 'accorde');
  assert.equal(permitListVerdictState('Favorable avec Reserves'), 'accorde');
  assert.equal(permitListVerdictState('Defavorable'), 'refuse');
  assert.equal(permitListVerdictState('Rejet tacite'), 'refuse');
  assert.equal(permitListVerdictState('retiré'), 'annule');
  assert.equal(permitListVerdictState('Dossier irrecevable'), 'annule');
  assert.equal(permitListVerdictState('Pièces manquantes'), null);
  const [row] = readDecisionTable({ pages: [decisionPage(1)] });
  const granted = normalisePermitListRow(MARSEILLE, 'decisions', row);
  assert.deepEqual([granted.state, granted.decidedOn, granted.postedOn], ['accorde', '2026-08-30', '2026-09-29']);
  const odd = normalisePermitListRow(MARSEILLE, 'decisions', { ...row, verdict: 'Pièces manquantes' });
  assert.deepEqual([odd.state, odd.stateLabel], ['depose', 'Pièces manquantes']);
});

test('a dossier on both lists folds to its decision, and meets its Sitadel twin', () => {
  const filed = readRegisterList({ pages: [registerPage(1)] })[0];
  const decided = { ...readDecisionTable({ pages: [decisionPage(1)] })[0], dossier: filed.dossier };
  let archive = emptyCartdsArchive(MARSEILLE, MARSEILLE.insee);
  archive = recordCartdsBoards(archive, { filings: [filed] }, '2026-09-28', PERMIT_LIST_ROWS).archive;
  archive = recordCartdsBoards(archive, { decisions: [decided] }, '2026-09-30', PERMIT_LIST_ROWS).archive;
  const rows = archivedCartdsRows(archive).map((stored) => normalisePermitListRow(
    MARSEILLE, stored.board, stored.cells, { current: stored.last === archive.lastDay },
  ));
  // The filing left the list before the decision was read: filed, not under review.
  assert.deepEqual(rows.map((permit) => permit.state), ['depose', 'accorde']);
  const { permits: [dossier], folded } = foldCartdsDossiers(rows);
  assert.equal(folded, 1);
  assert.equal(dossier.state, 'accorde');
  assert.equal(dossier.landAreaM2, 1865);

  const file = SITADEL_FILES.find((candidate) => candidate.key === 'logements');
  const twin = normaliseSitadelRow(file, {
    COMM: '13055', NUM_DAU: '0130552603001', TYPE_DAU: 'DP', ETAT_DAU: '2',
    DATE_REELLE_AUTORISATION: '2026-08-30', ADR_LIBVOIE_TER: 'Rue Exemple', ADR_CODPOST_TER: '13001',
  });
  const { permits, merged } = mergeRegisters([twin], [dossier]);
  assert.equal(merged, 1);
  assert.equal(permits.length, 1);
  assert.deepEqual(permits[0].sources, ['permit-list', 'sitadel']);
});

// --- Lyon: records written in Word, read in drawing order --------------------

test('Lyon\'s records read in order: sections, wrapped numbers, labels and values', () => {
  const page1 = { runs: [
    run('VILLE DE LYON', 230.2, 771.8, { x1: 312.6, size: 10 }),
    run('Déclarations préalables déposées pendant la période du 21/09/2026 au 27/09/2026', 103.3, 750.6, { x1: 439.4, size: 10 }),
    run('DP 069 389 23', 38.5, 712.9, { size: 10 }), run('00673 M01', 38.5, 702.6, { size: 10 }),
    run('déposée le 25/09/2026 Modificatif', 105.4, 707.7, { size: 10 }),
    run('Projet :', 38.5, 687.7, { size: 10 }), run('Installation d’une antenne', 105.4, 687.5, { size: 10 }),
    run('Terrain :', 38.5, 667.7, { size: 10 }), run('10 impasse Exemple Lyon 9ème', 105.4, 667.4, { size: 10 }),
    run('Superficie du terrain : 3610', 380.5, 672.7, { size: 10 }), run('m²', 380.5, 662.3, { size: 10 }),
    run('Demandeur :', 38.5, 646.5, { size: 10 }), run('EXEMPLE TOWERS', 105.4, 646.3, { size: 10 }),
    run('Mandataire :', 38.5, 630.6, { size: 10 }), run('Monsieur DUPONT Jean', 105.4, 630.3, { size: 10 }),
    // A number over three lines, a label and its colon on two.
    run('DP 069 384', 38.5, 612.9, { size: 10 }), run('17 02570', 38.5, 602.6, { size: 10 }),
    run('T01', 38.5, 592.3, { size: 10 }), run('déposée le 10/09/2026 Transfert', 92.3, 602.6, { size: 10 }),
    run('Terrain :', 38.5, 577.4, { size: 10 }), run('8 rue Exemple Lyon 4ème', 92.3, 577.2, { size: 10 }),
    run('Demandeur', 38.5, 564.6, { size: 10 }), run(':', 38.5, 554.3, { size: 10 }),
    run('SCI EXEMPLE', 92.3, 559.2, { size: 10 }),
    run('VILLE DE LYON', 250.4, 485.7, { size: 12 }),
    run('Permis de construire délivrés pendant la période du 27/07/2026 au 02/08/2026', 100.2, 471.9, { size: 12 }),
    run('PC 069 384 25 00265', 22, 449, { size: 12 }), run('Arrêté du 28/07/2026 à', 163.8, 449, { size: 12 }),
    run('SEP EXEMPLE', 301.3, 449, { size: 12 }),
    run('Projet :', 22, 426.8, { size: 12 }),
    run('Construction d’un ensemble immobilier de', 163.8, 426.8, { size: 12 }),
    run('17 logements', 163.8, 413, { size: 12 }), run('Surface créée : 1354 m²', 163.8, 399.2, { size: 12 }),
    run('Terrain :', 22, 384, { size: 12 }), run('77 Rue Exemple Lyon 4ème', 163.8, 377, { size: 12 }),
    run('DP 069 381 26 01234', 22, 321.8, { size: 12 }),
    run('Décision du', 171.1, 328.7, { size: 12 }), run('31/08/2026 à', 171.1, 315, { size: 12 }),
    run('CABINET EXEMPLE', 291.3, 321.8, { size: 12 }),
    run('Terrain :', 22, 299.6, { size: 12 }), run('9 Impasse Exemple Lyon 1er', 171.1, 299.6, { size: 12 }),
  ] };
  const page2 = { runs: [
    run('2', 519, 796.1, { size: 12 }),
    // The mandatary's name runs over onto the next page: never kept.
    run('Madame MARTIN Claire', 156.6, 749.6, { size: 12 }),
    run('Changement d’usage délivrés pendant la période du 27/07/2026 au 02/08/2026', 100, 720, { size: 12 }),
    run('US 069 381 26 00136', 22, 700, { size: 12 }), run('Arrêté du 27/07/2026', 163.8, 700, { size: 12 }),
  ] };
  const rows = readLyonList({ pages: [page1, page2] });
  assert.deepEqual(rows.map((row) => [row.board, row.dossier]), [
    ['filings', 'DP 069389 23 00673 M01'],
    ['filings', 'DP 069384 17 02570 T01'],
    ['decisions', 'PC 069384 25 00265'],
    ['decisions', 'DP 069381 26 01234'],
    ['decisions', 'US 069381 26 00136'],
  ]);
  const [first, second, third, fourth] = rows;
  assert.deepEqual([first.filedOn, first.purpose, first.address, first.postcode, first.landArea, first.applicant],
    ['2026-09-25', 'Installation d’une antenne', '10 impasse Exemple', '69009', '3610', 'EXEMPLE TOWERS']);
  assert.deepEqual([second.filedOn, second.address, second.postcode, second.applicant],
    ['2026-09-10', '8 rue Exemple', '69004', 'SCI EXEMPLE']);
  assert.deepEqual([third.decidedOn, third.verdict, third.applicant, third.floorArea, third.purpose, third.address],
    ['2026-07-28', 'Délivré', 'SEP EXEMPLE', '1354', 'Construction d’un ensemble immobilier de 17 logements', '77 Rue Exemple']);
  assert.deepEqual([fourth.decidedOn, fourth.applicant, fourth.address, fourth.postcode],
    ['2026-08-31', 'CABINET EXEMPLE', '9 Impasse Exemple', '69001']);
  assert.ok(!JSON.stringify(rows).includes('DUPONT') && !JSON.stringify(rows).includes('MARTIN'));
  assert.ok(!JSON.stringify(rows).includes('VILLE DE LYON'));
  // A change of use is no building authorisation, and is not kept.
  assert.equal(scrubPermitListRow(rows[4]), null);
  const lyon = PERMIT_LISTS.find((city) => city.key === 'lyon');
  const granted = normalisePermitListRow(lyon, rows[2].board, rows[2]);
  assert.deepEqual([granted.state, granted.key, granted.dossier], ['accorde', 'DAU|0693842500265', 'PC 069 384 25 00265']);
  // Lyon's lists say a dossier was filed, never that it is still under review.
  assert.equal(normalisePermitListRow(lyon, 'filings', first, { current: true }).state, 'depose');
});

test('a Lyon site gives its street and the arrondissement\'s postcode', () => {
  assert.deepEqual(lyonSite('18 Rue Lortet Lyon 7ème'), { address: '18 Rue Lortet', postcode: '69007' });
  assert.deepEqual(lyonSite('29 Rue des Capucins Lyon 1er'), { address: '29 Rue des Capucins', postcode: '69001' });
  assert.deepEqual(lyonSite('Place Bellecour'), { address: 'Place Bellecour', postcode: null });
  assert.deepEqual(lyonSite(null), { address: null, postcode: null });
});

// --- Béziers: a grid whose cells hang from the top of their row --------------

/** One Béziers page of filings: header or not, one wrapped and one stuck number. */
function beziersFilingsPage(n, { header = true } = {}) {
  const head = header ? [
    run('Date de dépôt', 77.8, 458.4, { x1: 149.7, size: 11 }), run('Numéro de dossier', 176.1, 458.4, { x1: 272, size: 11 }),
    run('Pétitionnaire', 293.9, 458.4, { x1: 358, size: 11 }), run('Adresse du projet', 458.1, 458.4, { x1: 547.4, size: 11 }),
    run('Description du projet', 623.2, 458.4, { x1: 727.2, size: 11 }),
    // A section's title across the table.
    run('DECLARATION PREALABLE - CONSTRUCTIONS ET TRAVAUX NON SOUMIS A PERMIS', 72, 418.7, { x1: 604.1, size: 11 }),
  ] : [];
  return { runs: [
    ...head,
    run('08/09/2026', 78, 379.6, { x1: 135.6, size: 11 }),
    run('DP 34032 26', 180.3, 379.6, { x1: 248.5, size: 11 }), run(`T08${40 + n}`, 180.3, 367.1, { x1: 214.1, size: 11 }),
    run('Madame DUPONT', 274.3, 379.6, { x1: 381.1, size: 11 }), run('Claire', 274.3, 367.1, { x1: 321.7, size: 11 }),
    run('EXEMPLE STUDIO', 274.3, 354.4, { x1: 364.7, size: 11 }),
    run(`${n} Place des Exemples`, 396.9, 379.6, { x1: 521.2, size: 11 }), run('34500 BEZIERS', 396.9, 367.1, { x1: 480.2, size: 11 }),
    run('Rénovation et aménagement d’un', 529.6, 379.6, { x1: 699.3, size: 11 }),
    run('studio', 529.6, 367.1, { x1: 625.2, size: 11 }),
    run('12/03/2025', 78, 330, { x1: 135.6, size: 11 }),
    run('PC 34032 25T0035', 150.6, 330, { x1: 248.5, size: 11 }),
    run('SCI EXEMPLE IMMO', 263.6, 330, { x1: 351.5, size: 11 }),
    run('7 Rue Exemple', 389.9, 330, { x1: 502.3, size: 11 }), run('34500 Béziers', 389.9, 317.3, { x1: 462.6, size: 11 }),
    run('Création d’un atelier', 543.4, 330, { x1: 685.9, size: 11 }),
    run(`Page ${n} sur 3`, 690, 37.3, { x1: 755, size: 9 }),
  ] };
}

test('a Béziers grid reads every row, the header kept from page to page', () => {
  const rows = PERMIT_LIST_READERS.grid({
    pages: [beziersFilingsPage(1), beziersFilingsPage(2, { header: false }), beziersFilingsPage(3, { header: false })],
  });
  assert.equal(rows.length, 6);
  const [first, second] = rows;
  assert.deepEqual(first, {
    board: 'filings',
    dossier: 'DP 34032 26 T0841',
    label: null,
    purpose: 'Rénovation et aménagement d’un studio',
    // The cell's first line names a person: the organisation under it is
    // not worth reading a person's name to reach.
    applicant: 'Madame DUPONT',
    address: '1 Place des Exemples',
    postcode: '34500',
    locality: 'BEZIERS',
    filedOn: '2026-09-08',
    verdict: null,
    decidedOn: null,
    postedOn: null,
    landArea: null,
    housing: null,
    lots: null,
    floorArea: null,
  });
  assert.equal(scrubPermitListRow(first)[3], null);
  assert.deepEqual([second.dossier, second.applicant, second.address], ['PC 34032 25T0035', 'SCI EXEMPLE IMMO', '7 Rue Exemple']);
  assert.ok(!JSON.stringify(rows).includes('DECLARATION PREALABLE'));
  const beziers = PERMIT_LISTS.find((city) => city.key === 'beziers');
  assert.equal(normalisePermitListRow(beziers, 'filings', second).key, 'DAU|03403225T0035');
});

test('a Béziers grid of decisions reads a two-line header and an optional column', () => {
  const page = { runs: [
    run('Numéro de dossier', 34, 457.2, { x1: 130.1, size: 11 }), run('Pétitionnaire', 152.6, 457.2, { x1: 216.9, size: 11 }),
    run('Décision', 281.1, 457.2, { x1: 326.4, size: 11 }), run('Date de', 361.6, 457.2, { x1: 403.4, size: 11 }),
    run('signature', 361.6, 444.7, { x1: 409.9, size: 11 }), run('Nature des travaux', 447.4, 457.2, { x1: 543.5, size: 11 }),
    run('Adresse des travaux', 640.7, 457.2, { x1: 744, size: 11 }), run('Surface', 774.7, 457.2, { x1: 818.8, size: 11 }),
    run('DP 34032 26', 34.3, 368.6, { x1: 101.7, size: 11 }), run('T0807', 34.3, 356.1, { x1: 68, size: 11 }),
    run('SCI EXEMPLE', 142.6, 368.6, { x1: 209.8, size: 11 }),
    run('Favorable', 257.3, 368.6, { x1: 309.6, size: 11 }), run('avec', 257.3, 356.1, { x1: 283.9, size: 11 }),
    run('prescriptions', 257.3, 343.4, { x1: 322.1, size: 11 }),
    run('10/09/2026', 334.9, 368.6, { x1: 392.4, size: 11 }), run('Piscine', 416.1, 368.6, { x1: 463.4, size: 11 }),
    run('213 Chemin Exemple', 592.2, 368.6, { x1: 700.5, size: 11 }), run('34500 BEZIERS', 592.2, 356.1, { x1: 675.5, size: 11 }),
    run('32 m²', 780, 368.6, { x1: 805, size: 11 }),
  ] };
  const [row] = PERMIT_LIST_READERS.grid({ pages: [page] });
  assert.deepEqual([row.board, row.dossier, row.verdict, row.decidedOn, row.purpose, row.address, row.floorArea],
    ['decisions', 'DP 34032 26 T0807', 'Favorable avec prescriptions', '2026-09-10', 'Piscine', '213 Chemin Exemple', '32']);
});

// --- Webdelib+: months, acts, files -----------------------------------------

test('a Webdelib+ reading covers this month and the ones before, across a new year', () => {
  assert.deepEqual(webdelibMonths('2026-01-15', 3), [
    { year: 2026, month: 1 }, { year: 2025, month: 12 }, { year: 2025, month: 11 },
  ]);
  const lyon = PERMIT_LISTS.find((city) => city.key === 'lyon');
  assert.equal(webdelibMonthUrl(lyon, { year: 2026, month: 9 }),
    'https://lyon-webdelib.digitechcloud.fr/webdelibplus_Central/jsp/summary_orders.jsp?role=usager&date=09-2026');
});

test('a month page gives its acts, Lyon\'s titles before the link and Béziers\'s in it', () => {
  const lyonPage = `<table><tr style="width:100%"><td style="width:10%"></td></td><td class="tableActe" style="width:60%">
VILLE DE LYON
Déclarations préalables déposées pendant la période du 07/09/2026 au 13/09/2026
 - <a href="../jsp/openfile.jsp?datePub=14/09/2026&name=Acte n° &pdf=AB%2BCD" target="_blank">Arrêté</a> - (sans annexe)<td style="width:15%">07/09/2026</td><td style="width:15%">14/09/2026</td><td></td></tr>
<tr><td></td><td class="tableActe">Arrêtés individuels - <a href="../jsp/openfile.jsp?datePub=28/09/2026&pdf=EF">Arrêté</a> - (sans annexe)<td>28/09/2026</td><td>28/09/2026</td></tr></table>`;
  const base = 'https://lyon.example/webdelibplus_Central/jsp/summary_orders.jsp?role=usager&date=09-2026';
  const acts = parseWebdelibActs(lyonPage, base);
  assert.deepEqual(acts.map((act) => [act.title, act.published]), [
    ['VILLE DE LYON Déclarations préalables déposées pendant la période du 07/09/2026 au 13/09/2026', '2026-09-14'],
    ['Arrêtés individuels', '2026-09-28'],
  ]);
  assert.equal(acts[0].url,
    'https://lyon.example/webdelibplus_Central/jsp/openfile.jsp?datePub=14/09/2026&name=Acte%20n%C2%B0%20&pdf=AB%2BCD');
  const lyon = PERMIT_LISTS.find((city) => city.key === 'lyon');
  assert.deepEqual(webdelibLists(lyon, acts).map((list) => list.layout), ['lyon']);

  const beziersPage = ['Dépôt DP (51)', 'Dépôt DP (48)', 'DP décidées (25)', 'DP décidées (24)', 'Dépôt CU (9)', 'Avis de rétrocession SAFER']
    .map((title, i) => `<tr><td></td><td class="tableActe"><a href="../jsp/openfile.jsp?name=Acte n° &pdf=T${i}">${title}</a><td style="width:15%"></td><td style="width:15%">${i < 1 || i === 2 ? '10' : '04'}/09/2026</td></tr>`)
    .join('');
  const beziers = PERMIT_LISTS.find((city) => city.key === 'beziers');
  const lists = webdelibLists(beziers, parseWebdelibActs(beziersPage, 'https://actes.example/webdelibplus/jsp/legal.jsp'));
  // The newest list of filed DPs holds the older one; every week's decisions count.
  assert.deepEqual(lists.map((list) => [list.title, list.board]), [
    ['Dépôt DP (51)', 'filings'], ['DP décidées (25)', 'decisions'], ['DP décidées (24)', 'decisions'],
  ]);
});

test('the file behind an act is the address its page moves to', () => {
  const open = 'https://lyon.example/webdelibplus_Central/jsp/openfile.jsp?pdf=AB';
  assert.equal(webdelibFileUrl("<script>document.location.href='../jsp/showFile.jsp?datePub=08/09/2026&pdf=X%2BY';</script>", open),
    'https://lyon.example/webdelibplus_Central/jsp/showFile.jsp?datePub=08/09/2026&pdf=X%2BY');
  assert.equal(webdelibFileUrl('<html>no file</html>', open), null);
});

test('the new numbers key as Sitadel writes them', () => {
  assert.deepEqual(permitListDossier('DP 069 387 25 00038 M02'), { kind: 'DP', digits: '0693872500038M02' });
  assert.deepEqual(permitListDossier('DP 069389 23 00673 M01'), { kind: 'DP', digits: '0693892300673M01' });
  assert.deepEqual(permitListDossier('DP 34032 26 T0848'), { kind: 'DP', digits: '03403226T0848' });
  assert.deepEqual(permitListDossier('PC 34032 25T0035'), { kind: 'PC', digits: '03403225T0035' });
  assert.deepEqual(permitListDossier('PC 34032 24 T0205 T02'), { kind: 'PC', digits: '03403224T0205T02' });
});

// --- Aix: two HTML tables ----------------------------------------------------

test('Aix\'s numbers get the commune they leave out, its J and its prorogation kept', () => {
  const aix = PERMIT_LISTS.find((city) => city.key === 'aix');
  assert.equal(aixDossier(aix, 'PC2600200'), 'PC 013001 26 00200');
  assert.equal(aixDossier(aix, 'PC24J0209 M01'), 'PC 013001 24 J0209 M01');
  assert.equal(aixDossier(aix, 'PC2500054 P01'), 'PC 013001 25 00054 P01');
  assert.equal(aixDossier(aix, 'AT26J0195'), null);
  assert.deepEqual(permitListDossier(aixDossier(aix, 'PC24J0180')), { kind: 'PC', digits: '01300124J0180' });
  assert.deepEqual(permitListDossier(aixDossier(aix, 'PC2500054 P01')), { kind: 'PC', digits: '0130012500054P01' });
});

test('a parcel cell gives every parcel it names, and nothing else', () => {
  assert.deepEqual(listParcels('AC 0080, AB 0123').map((parcel) => [parcel.section, parcel.numero]), [['AC', '80'], ['AB', '123']]);
  assert.deepEqual(listParcels('KD 275p, A 2036, 001BX 0101').map((parcel) => [parcel.prefix, parcel.section, parcel.numero]),
    [[null, 'KD', '275P'], [null, 'A', '2036'], ['001', 'BX', '101']]);
  assert.deepEqual(listParcels('0PK32 3000, 00 0128, -'), []);
  assert.deepEqual(listParcels(null), []);
});

test('Aix\'s page gives its two lists by their legends, the ids the other way round', () => {
  const aix = PERMIT_LISTS.find((city) => city.key === 'aix');
  const head = (words) => `<thead><tr>${words.map((word) => `<th style="text-align: center">${word}</th>`).join('')}</tr></thead>`;
  const cell = (value) => `<td style="text-align: center">${value}</a></td>`;
  const html = `
    <fieldset><legend>Ville d'Aix en Provence <br>Direction</legend></fieldset>
    <fieldset><legend>Liste des Dossiers Déposés</legend><table id="example2">
      ${head(['Dossier', 'Demandeur', 'Adresse du terrain', 'Objet / Destination', 'Travaux', 'Parcelle', 'Dépot', 'SHOB', 'SHON', 'Log.'])}
      <tbody><tr>${['DP2600975', 'SAS EXEMPLE', '6-8 RUE EXEMPLE    13100 AIX-EN-PROVENCE', 'commerce', 'Devanture', 'AB 0142', '2026-09-30 00:00:00.0', '-', '0', '-'].map(cell).join('')}</tr>
      <tr>${['AT26J0195', 'SAS EXEMPLE', '1 RUE EXEMPLE    13100 AIX', '-', 'ERP', '-', '2026-09-29 00:00:00.0', '-', '-', '-'].map(cell).join('')}</tr></tbody></table></fieldset>
    <fieldset><legend>Liste des Dossiers Délivrés</legend><table id="example">
      ${head(['Dossier', 'Demandeur', 'Adresse du terrain', 'Objet / Destination', 'Travaux', 'Parcelle', 'SHOB', 'SHON', 'Log.', 'Délivrance', 'Nature'])}
      <tbody><tr>${['PC24J0209 M01', 'DUPONT Jean', ' CHEMIN EXEMPLE    13090 AIX EN PROVENCE', 'Habitation', 'Maison', 'KD 275p, KD 0276', '-', '73,72', '1', '2026-08-24 00:00:00.0', 'Défavorable'].map(cell).join('')}</tr></tbody></table></fieldset>`;
  const tables = readAixTables(aix, html);
  assert.equal(tables.filings.length, 1);
  assert.deepEqual(tables.filings[0], {
    board: 'filings', dossier: 'DP 013001 26 00975', label: null, purpose: 'Devanture', applicant: 'SAS EXEMPLE',
    address: '6-8 RUE EXEMPLE', postcode: '13100', locality: 'AIX-EN-PROVENCE', filedOn: '2026-09-30',
    verdict: null, decidedOn: null, postedOn: null, landArea: null, housing: null, lots: null, floorArea: null,
    parcels: 'AB 0142',
  });
  const [refused] = tables.decisions;
  assert.deepEqual([refused.dossier, refused.verdict, refused.decidedOn, refused.address, refused.postcode, refused.floorArea, refused.housing],
    ['PC 013001 24 J0209 M01', 'Défavorable', '2026-08-24', 'CHEMIN EXEMPLE', '13090', '73.72', '1']);
  const permit = normalisePermitListRow(aix, 'decisions', refused);
  assert.equal(permit.state, 'refuse');
  assert.equal(permit.applicant, null);
  assert.deepEqual(permit.parcelIdus.map((ref) => [ref.idu, ref.provisional]),
    [['13001000KD0275', true], ['13001000KD0276', false]]);
  const filed = normalisePermitListRow(aix, 'filings', tables.filings[0], { current: true });
  assert.deepEqual([filed.state, filed.parcelIdus[0].idu, filed.key], ['instruction', '13001000AB0142', 'DAU|0130012600975']);
  assert.equal(readAixTables(aix, '<legend>Liste des Dossiers Déposés</legend><table></table>'), null);
});

// --- Argenteuil: Digilor Datahall --------------------------------------------

test('a Datahall index gives the permit files by their shelves, never by their titles', () => {
  const argenteuil = PERMIT_LISTS.find((city) => city.key === 'argenteuil');
  assert.equal(digilorIndexUrl(argenteuil), 'https://datahall.mydigilor.fr/web/server/index.php');
  assert.deepEqual(JSON.parse(digilorIndexBody(argenteuil)),
    { controller: 'DocumentController', action: 'getAll', data: { idApp: 133 } });
  const doc = (id, cat, sub, day, title = 'Décison DP DUPONT') => ({
    id, id_cat: cat, id_sscat: sub, nom_affichage: title, aff_deb: day, url_uiid: `./upload/133/${id}_a b.pdf`,
  });
  const files = digilorDocuments(argenteuil, [
    doc(1, 1882, 2172, '2026-09-25'), doc(2, 1882, 2170, '2026-09-29', 'Déppot PC'), doc(3, 1882, 2166, '2026-09-29'),
    doc(4, 1700, 2172, '2026-09-29'), doc(5, 1882, 2172, '2026-07-31'), doc(6, 1882, 0, '2026-09-30'),
  ], '2026-08-01');
  assert.deepEqual(files, [
    { board: 'filings', url: 'https://datahall.mydigilor.fr/web/server/get_file.php?file=upload%2F133%2F2_a%20b.pdf', published: '2026-09-29' },
    { board: 'decisions', url: 'https://datahall.mydigilor.fr/web/server/get_file.php?file=upload%2F133%2F1_a%20b.pdf', published: '2026-09-25' },
  ]);
  assert.equal(digilorDocuments(argenteuil, { error: 'x' }, '2026-08-01'), null);
});

test('Argenteuil\'s words are read on the ladder', () => {
  assert.equal(permitListVerdictState('Tacite'), 'accorde');
  assert.equal(permitListVerdictState('Rapporté'), 'annule');
  assert.equal(permitListVerdictState('RETRAIT'), 'annule');
  assert.equal(permitListVerdictState('Sursis à statuer'), null);
  const argenteuil = PERMIT_LISTS.find((city) => city.key === 'argenteuil');
  assert.deepEqual(permitListDossier('DP 95018 26 o0413'), { kind: 'DP', digits: '09501826O0413' });
  assert.equal(normalisePermitListRow(argenteuil, 'decisions', {
    dossier: 'PC 95018 18 O0015 M03', verdict: 'Favorable avec prescriptions', decidedOn: '2026-09-25',
  }).key, 'DAU|09501818O0015M03');
});

// --- Centred tables: Annecy and Clermont-Ferrand -----------------------------

test('a number printed over several lines is joined, the lines beside it set apart', () => {
  assert.deepEqual(joinDossier(['DP 074 010 24', '00298 M04', '11/09/2026']),
    { dossier: 'DP 074 010 24 00298 M04', others: ['11/09/2026'] });
  assert.deepEqual(joinDossier(['PC 063 113 21 G0729', 'M01']), { dossier: 'PC 063 113 21 G0729 M01', others: [] });
  assert.deepEqual(joinDossier(['PC 068224 25 S', '0089']), { dossier: 'PC 068224 25 S0089', others: [] });
  assert.deepEqual(joinDossier(['Permis de construire', 'DP 95018 26 o0413']),
    { dossier: 'DP 95018 26 o0413', others: ['Permis de construire'] });
  assert.deepEqual(joinDossier([]), { dossier: null, others: [] });
});

/** One page of Annecy's list of decisions, two rows centred on their middles. */
function annecyPage(n) {
  const r = (t, x, y) => run(t, x, y, { size: 8 });
  return { runs: [
    r('Liste des décisions', 368.4, 568.8), r('10 - ANNECY', 32, 554.4), r('Déclaration préalable', 32, 535.4),
    r('N° de dossier', 34.4, 498.8), r('Lieux des', 285.6, 498.8), r('Date dépôt', 124.8, 494.8),
    r('Demandeur', 185.2, 494.8), r('Superficie', 366, 494.8), r('Nature des travaux', 416.4, 494.8),
    r('Projet', 596.9, 494.8), r('Décision', 757.3, 494.8), r("Date d'affichage", 34.4, 490.7), r('travaux', 285.6, 490.7),
    // Row 1, middle 431.9.
    r('DP 074 010 25', 34.4, 439.9), r(`1 Avenue Exemple ${n}`, 285.6, 439.9), r('CABINET', 185.2, 435.9),
    r('Favorable le', 757.3, 435.9), r('00476 M01', 34.4, 431.9), r('29/06/2026', 124.8, 431.9), r('Port', 285.6, 431.9),
    r('74000', 307.5, 431.9), r('(268 AL', 338.6, 431.9), r('1650 m²', 366, 431.9),
    r('Isolation thermique par l’extérieur', 416.4, 431.9), r('EXEMPLE', 185.2, 427.9), r('29/07/2026', 757.3, 427.9),
    r('31/07/2026', 34.4, 423.9), r('300)', 285.6, 423.9),
    // Row 2, 21 points lower.
    r('PC 074 010 26', 34.4, 398.5), r('00046', 34.4, 390.5), r('15/01/2026', 124.8, 390.5), r('SCI EXEMPLE', 185.2, 390.5),
    r('2 rue Exemple 74000 (AY 30)', 285.6, 390.5), r('600 m²', 366, 390.5), r('Maison', 416.4, 390.5),
    r('- Surface plancher créée : 120,5 m²', 596.9, 390.5), r('Favorable tacite le', 757.3, 394.5), r('02/09/2026', 757.3, 386.5),
    r(`${n} / 3`, 727, 16.9),
  ] };
}

test('Annecy\'s decisions read one row per number, a row ending at the first wide gap', () => {
  const rows = PERMIT_LIST_READERS['annecy-decisions']({ pages: [annecyPage(1), annecyPage(2), annecyPage(3)] });
  assert.equal(rows.length, 6);
  const [first, second] = rows;
  assert.deepEqual(first, {
    board: 'decisions', dossier: 'DP 074 010 25 00476 M01', label: null, purpose: 'Isolation thermique par l’extérieur',
    applicant: 'CABINET EXEMPLE', address: '1 Avenue Exemple 1 Port', postcode: '74000', locality: null,
    filedOn: '2026-06-29', verdict: 'Favorable', decidedOn: '2026-07-29', postedOn: '2026-07-31', landArea: '1650',
    housing: null, lots: null, floorArea: null, parcels: '268 AL 300',
  });
  assert.deepEqual([second.dossier, second.verdict, second.decidedOn, second.floorArea, second.parcels],
    ['PC 074 010 26 00046', 'Favorable tacite', '2026-09-02', '120.5', 'AY 30']);
  const annecy = PERMIT_LISTS.find((city) => city.key === 'annecy');
  // A former commune's sections are keyed under its old number.
  assert.deepEqual(normalisePermitListRow(annecy, 'decisions', first).parcelIdus.map((ref) => ref.idu), ['74010268AL0300']);
});

test('Clermont\'s decisions: the site after a dash, `Retiré le` never read as a withdrawal', () => {
  const r = (t, x, y) => run(t, x, y, { size: 7.5 });
  const page = { runs: [
    r('Registre d\'affichage de la décision', 322.8, 545.2), r('Objet des travaux', 255.9, 498), r('N° de dossier', 31.6, 493.5),
    r('Demandeur', 143.7, 493.5), r('Date de la décision', 387.6, 493.5), r('Date affichage décision', 491.8, 493.5),
    r('Retiré le', 631.1, 493.5), r('Nature de la décision', 720, 493.5), r('Lieux des travaux', 255.9, 489),
    r('Isolation thermique par', 257.4, 473.6), r('l\'extérieur', 257.4, 464.9), r('et remplacement', 291.8, 464.9),
    r('DP 063 113 23 G1238 M01', 31.6, 451.9), r('EXEMPLE HABITAT', 143.7, 451.9), r('17/08/2026', 402.8, 451.9),
    r('17/08/2026', 515, 451.9), r('17/10/2026', 627.1, 451.9), r('Favorable', 741, 451.9), r('- RUE EXEMPLE', 255.9, 437.4),
    r('Piscine', 257.4, 405), r('PC 063 113 26 00042', 31.6, 400.7), r('SCI EXEMPLE', 143.7, 400.7), r('20/08/2026', 402.8, 400.7),
    r('20/08/2026', 515, 400.7), r('20/10/2026', 627.1, 400.7), r('Défavorable', 723, 400.7), r('- 3 rue Exemple', 255.9, 392),
  ] };
  const rows = PERMIT_LIST_READERS.clermont({ pages: [page] });
  assert.deepEqual(rows.map((row) => [row.dossier, row.purpose, row.address, row.verdict, row.decidedOn, row.postedOn]), [
    ['DP 063 113 23 G1238 M01', 'Isolation thermique par l\'extérieur et remplacement', 'RUE EXEMPLE', 'Favorable', '2026-08-17', '2026-08-17'],
    ['PC 063 113 26 00042', 'Piscine', '3 rue Exemple', 'Défavorable', '2026-08-20', '2026-08-20'],
  ]);
});

test('Clermont\'s filings: the name over the applicant\'s own address, the parcels last, a decision code', () => {
  const r = (t, x, y) => run(t, x, y, { size: 7.5 });
  const page = { runs: [
    r('Répertoire des dossiers déposés', 326.9, 545.2), r('N° de dossier', 52.1, 497.7), r('Date de dépôt', 129.8, 497.7),
    r('Demandeur', 187.9, 497.7), r('Adresse du terrain', 376.3, 497.7), r('SHON', 618.8, 497.7), r('Nb logts', 669.6, 497.7),
    r('Nature et date de décision', 716.1, 497.7), r('Objet des travaux', 376.3, 488.8),
    r('79 AVENUE EXEMPLE', 377.1, 466.7), r('SCCV EXEMPLE', 188.6, 462.3), r('DP 063 113 21 G0729', 31.6, 453.7),
    r('2 Rue du Siège', 188.6, 453.7), r('0', 650.3, 453.7), r('27/04/2026', 135.8, 449.3),
    r('Division en vue de construire', 377.1, 449.3), r('RT', 726.7, 449.3), r('20/05/2026', 763.6, 449.3),
    r('M01', 31.6, 445), r('19,83', 650.3, 445), r('69160 TASSIN', 188.6, 436.3), r('CH 107, CH 108', 377.1, 432),
  ] };
  const [row] = PERMIT_LIST_READERS.clermont({ pages: [page] });
  assert.deepEqual([row.board, row.dossier, row.applicant, row.address, row.purpose, row.parcels, row.verdict, row.decidedOn, row.floorArea, row.filedOn],
    ['decisions', 'DP 063 113 21 G0729 M01', 'SCCV EXEMPLE', '79 AVENUE EXEMPLE', 'Division en vue de construire', 'CH 107, CH 108',
      'Rejet tacite', '2026-05-20', '19.83', '2026-04-27']);
  assert.ok(!JSON.stringify(row).includes('TASSIN'), 'the applicant\'s own address is never read');
});

// --- Mulhouse: a grid row that runs on to the next page ---------------------

test('a grid row that runs on to the next page is read whole, the organisation found on its last line', () => {
  const r = (t, x, y, x1) => run(t, x, y, { x1, size: 11 });
  const header = (y) => [
    r('Numéro de dossier', 28.3, y, 124.3), r('Pétitionnaire', 138.7, y, 203), r('Décision', 258.7, y, 304.1),
    r('Date de', 333.8, y, 375.5), r('signature', 333.8, y - 12.6, 382.1), r('Nature des travaux', 413.8, y, 509.9),
    r('Adresse des travaux', 593.8, y, 697.2),
  ];
  const page1 = { runs: [
    ...header(549.1),
    r('DP 068224 26 S0486', 26.8, 113, 135.1), r('Monsieur DUPONT,', 147.1, 113, 242.1), r('Favorable', 257.2, 113, 309.5),
    r('24/07/2026', 339.3, 113, 397.5), r('remplacement de la porte d’entrée et de la fenêtre', 412.3, 113, 650),
    r('27 Rue Exemple', 592.3, 100.4, 691.4), r('Directeur Général', 147.1, 100.4, 237.8), r('avec', 257.2, 100.4, 283.6),
    r('Page 1 sur 2', 738.8, 37.6, 798.3),
  ] };
  const page2 = { runs: [
    ...header(549.1),
    r('Jean', 147.1, 520, 169.2), r('prescriptions', 257.2, 520, 322.7), r('68200 MULHOUSE', 592.3, 520, 691.4),
    r('M2A HABITAT', 147.1, 507.4, 222.4),
    r('DP 068224 26 S0487', 26.8, 480, 135.1), r('SCI EXEMPLE', 147.1, 480, 222), r('Favorable', 257.2, 480, 309.5),
    r('25/07/2026', 339.3, 480, 397.5), r('Clôture', 412.3, 480, 450), r('1 Rue Exemple', 592.3, 480, 691.4),
    r('68100 MULHOUSE', 592.3, 467.4, 691.4), r('Page 2 sur 2', 738.8, 37.6, 798.3),
  ] };
  const rows = PERMIT_LIST_READERS.grid({ pages: [page1, page2] });
  assert.deepEqual(rows.map((row) => [row.dossier, row.applicant, row.verdict, row.address, row.postcode]), [
    ['DP 068224 26 S0486', 'M2A HABITAT', 'Favorable avec prescriptions', '27 Rue Exemple', '68200'],
    ['DP 068224 26 S0487', 'SCI EXEMPLE', 'Favorable', '1 Rue Exemple', '68100'],
  ]);
  assert.equal(gridApplicant(['Monsieur DUPONT', 'Jean']), 'Monsieur DUPONT');
  assert.equal(permitListVerdictState('Octroi tacite'), 'accorde');
  assert.equal(permitListVerdictState('Prorogation'), null);
});

test('a page that links every edition gives them all; an optional list may be missing', () => {
  const mulhouse = PERMIT_LISTS.find((city) => city.key === 'mulhouse');
  const page = ['deposes-jusquau-2-sept', 'delivres-jusquau-4-aout', 'deposes-jusquau-4-aout', 'deposes-jusquau-4-aout']
    .map((name) => `<a href="/wp-content/uploads/2026/09/${name}.pdf">Dossiers ${name.split('-')[0].replace('deposes', 'déposés').replace('delivres', 'délivrés')} jusqu’au …</a>`)
    .join('\n');
  const links = permitListLinks(mulhouse, page);
  assert.deepEqual(links.map((link) => [link.board, link.url.split('/').pop(), link.immutable]), [
    ['filings', 'deposes-jusquau-2-sept.pdf', true], ['filings', 'deposes-jusquau-4-aout.pdf', true],
    ['decisions', 'delivres-jusquau-4-aout.pdf', true],
  ]);
  const clermont = PERMIT_LISTS.find((city) => city.key === 'clermont');
  const only = permitListLinks(clermont, '<a href="https://clermont-ferrand.fr/sites/default/files/2026-09/Affichage décisions urbanisme 23 juil 23 sept 2026_0.pdf"><h4>Affichage arrêtés</h4><p>Affichage des autorisations d\'urbanisme décidées.</p></a>');
  assert.deepEqual(only.map((link) => [link.board, link.url]), [
    ['decisions', 'https://clermont-ferrand.fr/sites/default/files/2026-09/Affichage%20d%C3%A9cisions%20urbanisme%2023%20juil%2023%20sept%202026_0.pdf'],
  ]);
});

test('a headless TYPO3 page gives its files by the heading of their block', () => {
  const annecy = PERMIT_LISTS.find((city) => city.key === 'annecy');
  const block = (header, url) => ({ type: 'mask_bloc_downloads', content: { header, items: [{ publicUrl: url, properties: { title: 'x' } }] } });
  const json = { content: { colPos0: [
    { type: 'text', content: { bodytext: 'Bienvenue' } },
    block('Liste des demandes déposées', 'https://www.annecy.fr/api/fileadmin/x/Demandes-2.pdf'),
    block('Liste des autorisations délivrées', 'https://www.annecy.fr/api/fileadmin/x/Autorisations.pdf'),
  ] } };
  assert.deepEqual(typo3ListLinks(annecy, json), [
    { board: 'filings', layout: 'annecy-filings', url: 'https://www.annecy.fr/api/fileadmin/x/Demandes-2.pdf' },
    { board: 'decisions', layout: 'annecy-decisions', url: 'https://www.annecy.fr/api/fileadmin/x/Autorisations.pdf' },
  ]);
  assert.equal(typo3ListLinks(annecy, { content: { colPos0: [] } }), null);
  assert.deepEqual(PERMIT_LIST_TEXT['annecy-decisions'], { wordGapEm: 0.15 });
});

// --- Versailles: every cell its own clip --------------------------------------

test('Versailles\'s rows are the runs that share a cell\'s clip, wherever their text sits', () => {
  const page = { x0: 0, y0: 0, x1: 841.9, y1: 595.3 };
  const cell = (x0, x1, y0, y1) => ({ x0, y0, x1, y1 });
  const r = (t, x, y, clip, size = 7) => ({ x, x1: x + t.length * 3, y, size, text: t, clip });
  const head = (y) => [
    r('Dossier', 37.2, y, cell(36.7, 228.4, y - 2.5, y + 11.3), 12), r('Terrain', 229.5, y, cell(229, 420.7, y - 2.5, y + 11.3), 12),
    r('Description', 421.8, y, cell(421.3, 612.9, y - 2.5, y + 11.3), 12), r('Décision', 614, y, cell(613.7, 805.3, y - 2.5, y + 11.3), 12),
  ];
  const row = (y0, y1, n, verdict) => {
    const [a, b, c, d] = [cell(36.7, 228.4, y0, y1), cell(229, 420.7, y0, y1), cell(421.3, 612.9, y0, y1), cell(613.7, 805.3, y0, y1)];
    return [
      r(`DP 78646 26 V12${n}`, 37.2, y1 - 12, a, 10), r('Dépôt le 03/08/2026', 37.2, y1 - 20, a), r('par SCI EXEMPLE', 37.2, y1 - 28, a),
      r('Représentant : Monsieur DUPONT', 37.2, y1 - 36, a),
      // Centred: a two-line site starts above the number.
      r('Terrain : AX0288 B0229', 229.5, y1 - 8, b), r('sis 9 Rue Exemple', 229.5, y1 - 16, b), r('Surface : 438m²', 229.5, y1 - 24, b),
      r('Propriétaire : Madame MARTIN', 229.5, y1 - 32, b),
      r('Projet : Remplacement des', 421.8, y1 - 14, c), r('menuiseries', 421.8, y1 - 22, c),
      r('Surface de plancher créée : 25,1m²', 421.8, y1 - 30, c),
      r('Signée le : 10/09/2026', 614, y1 - 14, d), r(`Nature de la décision : ${verdict}`, 614, y1 - 22, d),
    ];
  };
  const doc = { pages: [
    { runs: [
      r('REGISTRE DES AUTORISATIONS D\'URBANISME DECIDEES - Mairie de Versailles du 01/09/2026 au 15/09/2026', 100, 525, page, 12),
      r('Liste des DP : Déclaration Préalable de Construction de Versailles', 36, 497, page, 12),
      ...head(470.1), ...row(420, 464.6, 28, 'Octroi'),
    ] },
    // The header is not repeated: the columns carry over.
    { runs: [...row(500, 550, 29, 'Refus')] },
  ] };
  const rows = readVersaillesList(doc);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    board: 'decisions', dossier: 'DP 78646 26 V1228', label: null, purpose: 'Remplacement des menuiseries',
    applicant: 'SCI EXEMPLE', address: '9 Rue Exemple', postcode: null, locality: null, filedOn: '2026-08-03',
    verdict: 'Octroi', decidedOn: '2026-09-10', postedOn: null, landArea: '438', housing: null, lots: null,
    floorArea: '25.1', parcels: 'AX 0288, B 0229',
  });
  assert.ok(!JSON.stringify(rows).includes('DUPONT') && !JSON.stringify(rows).includes('MARTIN'));
  const versailles = PERMIT_LISTS.find((city) => city.key === 'versailles');
  const granted = normalisePermitListRow(versailles, 'decisions', rows[0]);
  assert.deepEqual([granted.state, granted.key, granted.parcelIdus.map((ref) => ref.idu)],
    ['accorde', 'DAU|07864626V1228', ['78646000AX0288', '786460000B0229']]);
  assert.equal(normalisePermitListRow(versailles, 'decisions', rows[1]).state, 'refuse');
  assert.equal(versaillesParcels('AH0084 AH0109 A10301'), 'AH 0084, AH 0109');
});

test('a public Drive folder lists its folders and files by id', () => {
  const html = `
    <div class="flip-entry" id="entry-1BU0Xze_7wMzKt4hbOUalhJgFIODrMTaB" tabindex="0"><a href="https://drive.google.com/drive/folders/1BU0Xze_7wMzKt4hbOUalhJgFIODrMTaB" target="_blank"><div class="flip-entry-info"><div class="flip-entry-title">2026</div></div></a></div>
    <div class="flip-entry" id="entry-1uOj7yM-C09gvaYZ1UzgK8pVZIMEhYEJi" tabindex="0"><a href="https://drive.google.com/file/d/1uOj7yM-C09gvaYZ1UzgK8pVZIMEhYEJi/view?usp=drive_web" target="_blank"><div class="flip-entry-title">17eme_tableau_2026.pdf</div><div class="flip-entry-last-modified"><div>Sep 16</div></div></a></div>`;
  assert.deepEqual(parseDriveFolder(html), [
    { id: '1BU0Xze_7wMzKt4hbOUalhJgFIODrMTaB', folder: true, title: '2026' },
    { id: '1uOj7yM-C09gvaYZ1UzgK8pVZIMEhYEJi', folder: false, title: '17eme_tableau_2026.pdf' },
  ]);
  assert.equal(driveFolderUrl('abc'), 'https://drive.google.com/embeddedfolderview?id=abc');
  assert.equal(driveFileUrl('abc'), 'https://drive.usercontent.google.com/download?id=abc&export=download');
});
