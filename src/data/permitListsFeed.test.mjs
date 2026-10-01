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
      assert.ok(Object.hasOwn(PERMIT_LIST_BOARDS, list.board));
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
