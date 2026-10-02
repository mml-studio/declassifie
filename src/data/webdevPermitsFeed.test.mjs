import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERMIT_LISTS, permitListFor } from './permitListsFeed.js';
import {
  webdevPortalUrl, webdevMenu, webdevSession, webdevRequestBody, webdevYears,
  webdevFolders, webdevLatestPosting, webdevLists,
} from './webdevPermitsFeed.js';

const city = PERMIT_LISTS.find((item) => item.key === 'brive');
const portal = `${city.source.portal}?site=public%2Btoken`;
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&apos;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const xml = (html, extra = '') => `<WAJAX><CHAMP ALIAS="A21"><PROP NUM="21">${escapeXml(`${extra};jQuery('#target').append(${JSON.stringify(html)});`)}</PROP></CHAMP></WAJAX>`;
const folder = (id, title) => `<a id='lienDossier${id}' class='dossier'>${title}</a>`;
const document = (id, title, directory = city.source.directory) => `<a id="document${id}" onclick="selectionArrete('A29', 'A19', this, true, '${directory}', '${id}');">${title}<br></a>`;
const tables = (start = 800) => [
  document(start, '20261002 - Dépôt DP'), document(start + 1, '20261002 - Décision DP'),
  document(start + 2, '20261002 - Dépôt Permis'), document(start + 3, '20261002 - Décision Permis'),
].join('');

test('Brive is selected only for its municipality; the current portal token comes from the city page', () => {
  assert.equal(permitListFor('19031'), city);
  for (const neighbour of ['19123', '19274', '19063']) assert.notEqual(permitListFor(neighbour), city);
  assert.equal(city.underReview, undefined, 'a filing notice is not proof that instruction is still open');
  assert.equal(webdevPortalUrl(city, `<a href='${portal}&amp;v=2'>Public posting</a>`), `${portal}&v=2`);
  assert.equal(webdevPortalUrl(city, '<a href="https://other.example/?site=token">Public posting</a>'), null);
  assert.equal(webdevPortalUrl(city, `<a href='https://user@doc.brive.org/service30_publication_reglementaire/?site=x'>Link</a>`), null);
  assert.equal(webdevPortalUrl(city, null), null);
});

test('publisher and session IDs are discovered, and requests do not echo generated scripts', () => {
  const html = `<form action="/service30_publication_reglementaire/PAGE_accueil_publication_document_html/new-session"></form>
    <div id="zrl_1_A39">CABB</div><div id="zrl_7_A39">Ville de Brive</div>`;
  const session = webdevSession(city, html, portal);
  assert.equal(session.publisher, '7');
  assert.ok(session.url.endsWith('/new-session'));
  const body = new URLSearchParams(webdevRequestBody(session, { context: 'A18', category: '9', year: '2', folder: '9001' }));
  assert.equal(body.get('A35'), '7');
  assert.equal(body.get('A19'), '9001');
  assert.equal(body.get('A42'), '2');
  assert.equal(body.get('A14'), '2');
  assert.equal(body.has('A21'), false);
  assert.equal(webdevSession(city, html.replace('action="/', 'action="https://other.example/'), portal), null);
  assert.equal(webdevSession(city, html.replace('Ville de Brive', 'Other publisher'), portal), null);
  assert.equal(webdevSession(city, '<html>Challenge</html>', portal), null);
});

test('menu positions and calendar years are read from WEBDEV replies', () => {
  const reply = `<WAJAX><CHAMP ALIAS="A5"><CORPS><![CDATA[<div id="zrl_9_A9">Documents</div>]]></CORPS></CHAMP>
    <CHAMP ALIAS="A42"><OPTIONS><OPTION>ANNÉE 2027</OPTION><OPTION>ANNÉE 2026</OPTION></OPTIONS></CHAMP></WAJAX>`;
  assert.deepEqual(webdevMenu(reply, 'A9'), [{ value: '9', title: 'Documents' }]);
  assert.deepEqual(webdevYears(reply), [{ value: '1', year: 2027 }, { value: '2', year: 2026 }]);
  assert.deepEqual(webdevYears('<html>Challenge</html>'), []);
});

test('folder discovery reads quoted HTML data, never executes the publisher script, and picks the newest date', () => {
  const reply = xml(folder(9001, 'Urbanisme') + folder(9002, 'Affichage au 30/09/2026')
    + folder(9003, 'Affichage au 02/10/2026') + folder(9004, 'Affichage au 31/02/2026'),
  'throw new Error("A generated script must never run")');
  assert.equal(webdevFolders(reply)[0].id, '9001');
  assert.deepEqual(webdevLatestPosting(reply), { id: '9003', title: 'Affichage au 02/10/2026', day: '2026-10-02' });
  assert.equal(webdevLatestPosting(xml(folder(9005, "Arrêtés d'autorisation d'urbanisme"))), null);
  assert.deepEqual(webdevFolders('<html>Challenge</html>'), []);
});

test('all four tables follow new file IDs; missing tables and another publisher directory fail closed', () => {
  const lists = webdevLists(city, xml(tables()));
  assert.deepEqual(lists.map((list) => list.url), [800, 801, 802, 803].map((id) => `${city.source.fileBase}DOC_${id}.pdf`));
  assert.deepEqual(lists.map((list) => list.board), ['filings', 'decisions', 'filings', 'decisions']);
  assert.equal(webdevLists(city, xml(tables().replace(document(803, '20261002 - Décision Permis'), ''))), null);
  assert.equal(webdevLists(city, xml(tables().replace('VDB/DOCUMENTS/', 'CABB/DOCUMENTS/'))), null);
  assert.equal(webdevLists(city, xml(tables().replace("'800');", "'../800');"))), null);
  assert.equal(webdevLists(city, null), null);
});
