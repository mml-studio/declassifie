// scripts/lib/mmmPermits.test.mjs
// The métropole's files and their daily sweep against a fake host: two
// editions on two days, a file that does not come, the archive kept on disk.
// No request leaves the process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  mmmSweepDue,
  readMmmEdition,
  sweepMmmArchive,
  MMM_CRAWL_DELAY_MS,
} from './mmmPermits.mjs';
import { createCartdsArchiveStore } from './cartdsArchive.mjs';
import { mmmCommuneFor, mmmPostedOn, foldMmmRows, MMM_ROWS } from '../../src/data/mmmPermitsFeed.js';

const HEADER = 'objectid,modele,annee_depot,nom_commune,code_parcelle,shon_global,nature_travaux,nature_signature,codcomm,x,y,annee_parcelle';
const row = (id, parcel, year = 2025) => `${id},Permis de Construire,${year},MONTPELLIER,340172   ${parcel},-,Construction neuve,Favorable,340172,768489.05,6283221.87,2026`;
const stock = Array.from({ length: 150 }, (_, i) => row(1000 + 10 * i, `AB${String(i).padStart(4, '0')}`));

/** A host that serves each commune's CSV with the `Last-Modified` it is given. */
function fakeHost(files) {
  const asked = [];
  return {
    asked,
    fetch: async (url) => {
      asked.push(url);
      const file = Object.entries(files).find(([name]) => url.endsWith(`/${name}_MMM_PermisConst.csv`))?.[1];
      if (!file) return { ok: false, status: 404, headers: new Headers() };
      return { ok: true, status: 200, headers: new Headers({ 'Last-Modified': file.modified }), body: file.csv };
    },
    text: async (response) => response.body,
  };
}

test('an edition is the file\'s rows, ranked, and the day it was written', async () => {
  const http = fakeHost({ Montpellier: { modified: 'Fri, 02 Oct 2026 05:00:21 GMT', csv: `﻿${[HEADER, ...stock].join('\r\n')}` } });
  const edition = await readMmmEdition(mmmCommuneFor('34172'), http);
  assert.equal(edition.day, '2026-10-02');
  assert.equal(edition.rows.length, 150);
  assert.equal(edition.rows[0].rank, 0);
  assert.equal(await readMmmEdition(mmmCommuneFor('34129'), http), null);
});

test('the sweep archives every file, paced, and the next night\'s new dossier is dated', async (t) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mmm-archive-'));
  t.after(() => fsp.rm(dir, { recursive: true, force: true }));
  const store = createCartdsArchiveStore(dir, { warn: () => {} }, MMM_ROWS);
  const communes = [mmmCommuneFor('34172'), mmmCommuneFor('34129')];
  const pauses = [];
  const sleep = async (ms) => { pauses.push(ms); };
  const quiet = { log: () => {} };

  const night1 = fakeHost({ Montpellier: { modified: 'Thu, 01 Oct 2026 05:00:21 GMT', csv: [HEADER, ...stock].join('\n') } });
  const first = await sweepMmmArchive({ communes, store, http: night1, day: '2026-10-01', sleep, log: quiet });
  assert.deepEqual([first.read, first.added, first.failed, first.editions], [1, 150, ['34129'], { '2026-10-01': 1 }]);
  assert.deepEqual(pauses, [MMM_CRAWL_DELAY_MS]);

  // Every id renumbered overnight, and one dossier more.
  const renumbered = stock.map((text, i) => text.replace(/^\d+/, String(85000000 + 10 * i)));
  const csv2 = [HEADER, ...renumbered, row(86000000, 'AC0001', 2026)].join('\n');
  const night2 = fakeHost({ Montpellier: { modified: 'Fri, 02 Oct 2026 05:00:30 GMT', csv: csv2 } });
  const second = await sweepMmmArchive({ communes, store, http: night2, day: '2026-10-02', sleep, log: quiet });
  assert.equal(second.added, 1);

  const { archive } = await store.load({ key: 'mmm' }, '34172');
  assert.deepEqual([archive.firstDay, archive.lastDay, archive.days, archive.rows.length], ['2026-10-01', '2026-10-02', 2, 151]);
  const edition = await readMmmEdition(communes[0], night2);
  const dated = foldMmmRows(edition.rows, communes[0], mmmPostedOn(archive)).filter((permit) => permit.postedOn);
  assert.deepEqual(dated.map((permit) => [permit.parcels[0], permit.postedOn]), [['AC1', '2026-10-02']]);
});

test('a sweep waits for the day\'s export: once a French day, from 08:00', () => {
  // 05:30 UTC is 07:30 in Paris in October: the export may not be out.
  assert.equal(mmmSweepDue(null, new Date('2026-10-02T05:30:00Z')), false);
  assert.equal(mmmSweepDue(null, new Date('2026-10-02T06:05:00Z')), true);
  assert.equal(mmmSweepDue({ day: '2026-10-02' }, new Date('2026-10-02T12:00:00Z')), false);
  assert.equal(mmmSweepDue({ day: '2026-10-01' }, new Date('2026-10-02T12:00:00Z')), true);
});
