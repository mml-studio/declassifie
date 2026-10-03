import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIGILOR_TOWNS_ACTS } from './digilorTownsActs.js';
import { DIGILOR_TOWNS } from './digilorTowns.js';
import { PERMIT_LIST_READERS, digilorDocuments, permitListFor } from './permitListsFeed.js';

test('the small Digilor towns are permit lists of their own, read act by act', () => {
  assert.equal(DIGILOR_TOWNS_ACTS.length, 15);
  assert.equal(typeof PERMIT_LIST_READERS['dematdoc-notice'], 'function');
  for (const raw of DIGILOR_TOWNS_ACTS) {
    const town = DIGILOR_TOWNS.find((item) => item.key === raw.key);
    assert.equal(permitListFor(town.insee), town, town.key);
    assert.match(town.postcode, /^\d{5}$/);
    assert.ok(town.source.shelves.length > 0);
    for (const shelf of town.source.shelves) assert.deepEqual([shelf.board, shelf.fallback, shelf.layout], ['auto', 'decisions', 'dematdoc-notice']);
  }
});

test('an act whose title names no board is asked anyway, the act’s heading to decide', () => {
  const trets = DIGILOR_TOWNS.find((item) => item.insee === '13110');
  const [category] = trets.source.shelves.map((shelf) => shelf.category);
  const doc = (id, title) => ({ id, id_cat: category, id_sscat: 0, nom_affichage: title, aff_deb: '2026-09-20', url_uiid: `./upload/294/${id}.pdf` });
  const files = digilorDocuments(trets, [doc(1, 'AvisDeDepot DP 0131102600108 PRIVATE'), doc(2, 'DP 013110 26 00150'), doc(3, 'Arrêté DP 013110 26 00099')], '2026-08-01');
  assert.deepEqual(files.map((file) => [file.url.replace(/^.*%2F/, ''), file.board, file.layout]).sort(),
    [['1.pdf', 'decisions', 'dematdoc-notice'], ['2.pdf', 'decisions', 'dematdoc-notice'], ['3.pdf', 'decisions', 'dematdoc-notice']]);
});
