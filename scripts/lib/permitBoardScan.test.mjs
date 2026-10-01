// scripts/lib/permitBoardScan.test.mjs
// What the scan keeps from what the boards answered on 2026-10-01. Menu entries
// and counts are copied from those answers; no request leaves the process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  candidatesFromCdx,
  foldCommuneName,
  indexCommunes,
  instanceKey,
  isVendorTenant,
  keepScannedInstances,
  menuCodes,
  renderScannedModule,
  keepScannedSirap,
  renderSirapModule,
  resolveMenuCommune,
  tenantGuesses,
} from './permitBoardScan.mjs';

const COMMUNES = indexCommunes([
  { code: '68066', nom: 'Colmar', codeDepartement: '68', codeEpci: '246800726' },
  { code: '68118', nom: 'Horbourg-Wihr', codeDepartement: '68', codeEpci: '246800726' },
  { code: '03058', nom: 'Châtillon', codeDepartement: '03', codeEpci: '200071140' },
  { code: '92020', nom: 'Châtillon', codeDepartement: '92', codeEpci: '200057966' },
  { code: '77054', nom: 'La Brosse-Montceaux', codeDepartement: '77', codeEpci: '200072346' },
  { code: '83118', nom: 'Saint-Raphaël', codeDepartement: '83', codeEpci: '248300543' },
  { code: '93066', nom: 'Saint-Denis', codeDepartement: '93', codeEpci: '200057867' },
  { code: '97411', nom: 'Saint-Denis', codeDepartement: '974', codeEpci: '249740119' },
]);

test('the archive names the tenants and the board path each one uses', () => {
  const lines = [
    'https://ca-colmar.geosphere.fr/guichet-unique/Login/AffichageReglementaire',
    'https://ca-colmar.geosphere.fr/adscs/Login',
    'https://sete-agglo.geosphere.fr/guichet-urbanisme/Login/AffichageReglementaire',
    'https://sete-agglo.geosphere.fr/images/logo.png',
    'http://saumurvaldeloire.geosphere.fr:80/guichet-doue/Accueil',
    'https://demo.geosphere.fr/guichet-unique/Login/AffichageReglementaire',
    'https://www.geosphere.fr/',
    'https://example.fr/guichet-unique/',
    'https://broken.geosphere.fr/%E9t%/x',
  ];
  const candidates = candidatesFromCdx(lines, 'geosphere.fr');
  assert.deepEqual(candidates.map((c) => c.host), [
    'broken.geosphere.fr', 'ca-colmar.geosphere.fr', 'saumurvaldeloire.geosphere.fr', 'sete-agglo.geosphere.fr',
  ]);
  const by = Object.fromEntries(candidates.map((c) => [c.host, c.prefixes]));
  // `/adscs` is the instructors' back office: its login page is not a board.
  assert.deepEqual(by['ca-colmar.geosphere.fr'], ['/guichet-unique']);
  assert.deepEqual(by['sete-agglo.geosphere.fr'], ['/guichet-urbanisme', '/guichet-unique']);
  assert.deepEqual(by['saumurvaldeloire.geosphere.fr'], ['/guichet-doue', '/guichet-unique']);
});

test('a menu entry is matched by code, by number and name, or by unpadded code', () => {
  assert.equal(foldCommuneName('BROSSE-MONTCEAUX (LA)'), 'la brosse montceaux');
  assert.equal(foldCommuneName('ST RAPHAEL'), 'saint raphael');
  assert.equal(resolveMenuCommune({ value: '68066', name: 'COLMAR' }, COMMUNES), '68066');
  assert.equal(resolveMenuCommune({ value: '66', name: 'COLMAR' }, COMMUNES), '68066');
  assert.equal(resolveMenuCommune({ value: '54', name: 'BROSSE-MONTCEAUX (LA)' }, COMMUNES), '77054');
  assert.equal(resolveMenuCommune({ value: '118', name: 'ST RAPHAEL' }, COMMUNES), '83118');
  // The Allier's agency: 3058 is 03058, and the name agrees.
  assert.equal(resolveMenuCommune({ value: '3058', name: 'CHÂTILLON' }, COMMUNES), '03058');
  // Two Saint-Denis and no usable number: only the department settles it.
  assert.equal(resolveMenuCommune({ value: 'x', name: 'SAINT-DENIS' }, COMMUNES), null);
  assert.equal(resolveMenuCommune({ value: 'x', name: 'SAINT-DENIS' }, COMMUNES, new Set(['93'])), '93066');
  assert.equal(resolveMenuCommune({ value: '999', name: 'NE PAS UTILISER' }, COMMUNES), null);
});

test('an instance is written with the one way its menu sends communes', () => {
  assert.equal(menuCodes([{ value: '68066', insee: '68066' }]), 'insee');
  assert.equal(menuCodes([{ value: '66', insee: '68066' }, { value: '118', insee: '68118' }]), 'number');
  assert.equal(menuCodes([{ value: '3058', insee: '03058' }]), 'unpadded');
  assert.equal(menuCodes([{ value: '66', insee: '68066' }, { value: '68118', insee: '68118' }]), null);
  assert.equal(menuCodes([]), null);
});

test('the vendor’s demonstration and training tenants are never a board', () => {
  assert.ok(isVendorTenant('demo.geosphere.fr'));
  assert.ok(isVendorTenant('www.online.geosphere.fr'));
  assert.ok(isVendorTenant('formation.geosphere.fr'));
  // A commune whose name contains the word is a commune.
  assert.ok(!isVendorTenant('latestedebuch.geosphere.fr'));
  assert.ok(!isVendorTenant('terresdemontaigu.geosphere.fr'));
  assert.ok(!isVendorTenant('geosphere.fr'));
});

test('the key is the tenant on a hosting family and the city on its own host', () => {
  assert.equal(instanceKey('ca-colmar.geosphere.fr'), 'cacolmar');
  assert.equal(instanceKey('urba.plainecommune.fr'), 'plainecommune');
  assert.equal(instanceKey('urbanisme.saint-etienne-metropole.fr'), 'saintetiennemetropole');
  assert.equal(instanceKey('guichet-unique-bobigny.siib.fr'), 'bobigny');
  assert.equal(instanceKey('demarches-urbanisme.ville-massy.fr'), 'massy');
  assert.equal(instanceKey('urbanisme.mairie-hyeres.com'), 'hyeres');
});

const entry = (value, name, filings, decisions, latestFiling, latestDecision = null) => ({
  value, name, filings, decisions, latestFiling, latestDecision,
});

test('the scan keeps the communes that posted lately and that nobody else reads', () => {
  const probes = [
    {
      host: 'ca-colmar.geosphere.fr',
      base: 'https://ca-colmar.geosphere.fr/guichet-unique',
      robotsAllows: null,
      communes: [
        entry('66', 'COLMAR', 234, 179, '01/10/2026', '29/09/2026'),
        // Posted, but nothing since spring: a board nobody keeps.
        entry('118', 'HORBOURG-WIHR', 3, 0, '12/03/2026'),
      ],
    },
    {
      host: 'atda03.geosphere.fr',
      base: 'https://atda03.geosphere.fr/guichet-unique',
      robotsAllows: false,
      communes: [entry('3058', 'CHÂTILLON', 2, 1, '22/09/2026')],
    },
    {
      // Two boards offer Saint-Raphaël; the one with more rows reads it.
      host: 'small.geosphere.fr',
      base: 'https://small.geosphere.fr/guichet-unique',
      communes: [entry('118', 'SAINT-RAPHAEL', 1, 0, '30/09/2026')],
    },
    {
      host: 'cavem.geosphere.fr',
      base: 'https://cavem.geosphere.fr/guichet-unique',
      robots5xx: true,
      communes: [entry('83118', 'SAINT-RAPHAEL', 40, 22, '30/09/2026')],
    },
    {
      host: 'urba.plainecommune.fr',
      base: 'https://urba.plainecommune.fr/guichet-unique',
      communes: [entry('93066', 'COMMUNE NOUVELLE DE SAINT-DENIS', 138, 88, '01/10/2026')],
    },
    { host: 'down.geosphere.fr', base: null },
    {
      // The vendor's demonstration tenant posts made-up dossiers under real names.
      host: 'demo.geosphere.fr',
      base: 'https://demo.geosphere.fr/guichet-unique',
      communes: [entry('68066', 'COLMAR', 900, 900, '01/10/2026')],
    },
  ];
  for (const probe of probes) {
    for (const item of probe.communes ?? []) item.insee = resolveMenuCommune(item, COMMUNES, new Set(['93', '83', '68', '03']));
  }
  // Saint-Denis's commune nouvelle is named on its menu by what it became.
  probes[4].communes[0].insee = '93066';
  const claimed = new Map([['93066', 'portal:plainecommune']]);
  const { instances, skipped } = keepScannedInstances({
    probes,
    index: COMMUNES,
    claimed,
    epciNames: new Map([['248300543', 'CA Var Estérel Méditerranée']]),
    day: '2026-10-01',
  });
  assert.deepEqual(instances.map((i) => [i.key, i.codes, i.communes]), [
    ['atda03', 'unpadded', ['03058']],
    ['cacolmar', 'number', ['68066']],
    ['cavem', 'insee', ['83118']],
  ]);
  const by = Object.fromEntries(instances.map((i) => [i.key, i]));
  assert.equal(by.atda03.robots, 'overridden');
  assert.equal(by.cacolmar.robots, undefined);
  assert.equal(by.cavem.robots5xx, 'absent');
  assert.equal(by.cacolmar.label, 'Colmar — affichage réglementaire');
  // Plaine Commune's only commune is read already; its board says so by keeping none.
  assert.ok(!instances.some((i) => i.key === 'plainecommune'));
  assert.deepEqual(skipped, []);
  // Asked to respect robots.txt, the scan leaves the refusing board out instead.
  const strict = keepScannedInstances({ probes, index: COMMUNES, claimed, day: '2026-10-01', respectRobots: true });
  assert.ok(!strict.instances.some((i) => i.key === 'atda03'));
  assert.deepEqual(strict.skipped, [{ host: 'atda03.geosphere.fr', why: 'robots.txt refuses' }]);
});

test('the module the scan writes is the instances it kept', async () => {
  const instances = [
    { key: 'cacolmar', base: 'https://ca-colmar.geosphere.fr/guichet-unique', label: "Colmar — affichage réglementaire", codes: 'number', communes: ['68066'] },
    {
      key: 'atda03', base: 'https://atda03.geosphere.fr/guichet-unique', label: "L'Allier — affichage réglementaire", codes: 'unpadded',
      robots: 'overridden', communes: ['03001', '03002', '03003', '03004', '03005', '03006', '03007', '03008', '03009'],
    },
  ];
  const source = renderScannedModule(instances, { day: '2026-10-01', hosts: 320, boards: 252 });
  assert.match(source, /^\/\/ GENERATED by `npm run permits:scan`/);
  const module = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  assert.deepEqual(JSON.parse(JSON.stringify(module.CARTDS_SCANNED_INSTANCES)), instances);
  assert.ok(Object.isFrozen(module.CARTDS_SCANNED_INSTANCES[1].communes));
});

test('tenant names are guessed the ways the tenants found were written', () => {
  const guesses = new Set(tenantGuesses(
    [{ nom: 'Le Cannet', population: 41000 }, { nom: 'Saint-Zacharie', population: 5800 }, { nom: 'Ollioules', population: 14500 }],
    [{ nom: 'CA de Cambrai' }, { nom: 'CC du Pays Sabolien' }],
  ));
  // Each of these answered the DNS on 2026-10-01.
  for (const tenant of ['le-cannet', 'stzacharie', 'ollioules', 'ca-cambrai', 'pays-sabolien']) {
    assert.ok(guesses.has(tenant), tenant);
  }
  assert.ok([...guesses].every((name) => /^[a-z0-9-]{3,63}$/.test(name)));
  // Only the most populous communes are guessed.
  assert.ok(!tenantGuesses([{ nom: 'A', population: 1 }, { nom: 'Bbb', population: 0 }], [], 1).includes('bbb'));
});

test('Sirap communes are kept one per instance, named after the commune', () => {
  const probes = [
    {
      host: 'portail-usager.sirap.com',
      communes: [
        { insee: '095555', name: 'Saint-Gratien', rows: 64, latest: '2026-09-30' },
        // Listed but empty, or quiet since winter: not kept.
        { insee: '006155', name: 'Vallauris', rows: 0, latest: null },
        { insee: '068118', name: 'Horbourg-Wihr', rows: 3, latest: '2026-01-12' },
        // A date the board got wrong by two years is not a sign of life.
        { insee: '068066', name: 'Colmar', rows: 2, latest: '2028-09-01' },
      ],
    },
    { host: 'cholet.pu.sirap.com', communes: [{ insee: '093066', name: 'Saint-Denis', rows: 9, latest: '2026-09-29' }] },
  ];
  const index = indexCommunes([
    { code: '95555', nom: 'Saint-Gratien' }, { code: '06155', nom: 'Vallauris' }, { code: '68118', nom: 'Horbourg-Wihr' },
    { code: '68066', nom: 'Colmar' }, { code: '93066', nom: 'Saint-Denis' },
  ]);
  const instances = keepScannedSirap({ probes, index, claimed: new Map([['93066', 'cartds:scanned']]), day: '2026-10-01' });
  assert.deepEqual(instances, [{
    key: 'pu95555', base: 'https://portail-usager.sirap.com', label: 'Saint-Gratien — affichage réglementaire', communes: ['95555'],
  }]);
  const source = renderSirapModule(instances, { day: '2026-10-01', hosts: 2, listed: 5 });
  assert.match(source, /i18n-ignore-line/);
});
