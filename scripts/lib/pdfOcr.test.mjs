// scripts/lib/pdfOcr.test.mjs
// The OCR runner with its programs faked: what it asks poppler and Tesseract,
// in what order, and what it hands back. No binary runs here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPdfOcr, pdfOcrAvailable, ocrTsvPage, rotatePgm } from './pdfOcr.mjs';

test('positioned OCR converts pixels to PDF points and ignores a tall table border', () => {
  const tsv = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'
    + '1\t1\t0\t0\t0\t0\t0\t0\t2000\t1000\t-1\t\n'
    + '5\t1\t1\t1\t1\t1\t100\t100\t40\t20\t95\tDate\n'
    + '5\t1\t1\t1\t1\t2\t145\t104\t30\t16\t95\tde\n'
    + '5\t1\t1\t1\t1\t3\t180\t100\t60\t20\t95\tdépôt\n'
    + '5\t1\t1\t1\t1\t4\t80\t100\t2\t100\t20\t|\n';
  const page = ocrTsvPage(tsv);
  assert.equal(page.width, 720);
  assert.equal(page.height, 360);
  assert.equal(page.runs[0].x, 36);
  assert.equal(page.runs[0].y, 316.8);
  assert.ok(page.runs.every((r) => r.y === page.runs[0].y));
  assert.equal(ocrTsvPage('bad TSV'), null);
});

test('sideways eight-bit grey tables rotate without changing pixels', () => {
  const pgm = Buffer.concat([Buffer.from('P5\n2 3\n255\n'), Buffer.from([1, 2, 3, 4, 5, 6])]);
  assert.deepEqual(rotatePgm(pgm, 270), Buffer.concat([Buffer.from('P5\n3 2\n255\n'), Buffer.from([2, 4, 6, 1, 3, 5])]));
  assert.deepEqual(rotatePgm(pgm, 90), Buffer.concat([Buffer.from('P5\n3 2\n255\n'), Buffer.from([5, 3, 1, 6, 4, 2])]));
  assert.throws(() => rotatePgm(pgm.subarray(0, -1), 270), /Truncated/);
});

test('positioned mode requests TSV and returns words to the list readers', async () => {
  const tsv = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'
    + '1\t1\t0\t0\t0\t0\t0\t0\t1000\t2000\t-1\t\n'
    + '5\t1\t1\t1\t1\t1\t100\t100\t40\t20\t95\tDP\n';
  const { run, calls } = fakePrograms([tsv]);
  const answer = await createPdfOcr({ run })(new Uint8Array([1]), { positioned: true });
  assert.equal(answer.document.pages[0].runs[0].text, 'DP');
  assert.equal(calls.find(([file]) => file === 'tesseract').at(-1), 'tsv');
});

/** Programs that answer as poppler and Tesseract would, for a PDF of `pages`. */
function fakePrograms(pages, { failOn = null } = {}) {
  const calls = [];
  let page = 0;
  let band = false;
  const run = async (file, args) => {
    calls.push([file, ...args]);
    if (failOn && failOn(file, args)) return null;
    if (file === 'pdfinfo') return `Producer: Adobe Acrobat 9.5.5\nPages:           ${pages.length}\n`;
    if (file === 'pdftoppm') {
      page = Number(args[args.indexOf('-f') + 1]);
      band = args.includes('-H');
      return '';
    }
    if (file === 'tesseract') {
      const text = pages[page - 1];
      return band ? text.split('\n')[0] : text;
    }
    return null;
  };
  return { run, calls };
}

test('every page is rendered as a grey PGM and read in French, one at a time', async () => {
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pdf-ocr-'));
  const { run, calls } = fakePrograms(['Page un', 'Page deux']);
  const answer = await createPdfOcr({ run, tmpdir })(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  assert.deepEqual(answer.pages, ['Page un', 'Page deux']);
  assert.equal(answer.read, 2);
  const renders = calls.filter(([file]) => file === 'pdftoppm');
  assert.equal(renders.length, 2);
  for (const call of renders) {
    assert.ok(call.includes('-gray') && !call.includes('-png'), 'a PGM: a PNG costs more than the OCR');
    assert.ok(call.includes('-r') && call[call.indexOf('-r') + 1] === '200');
  }
  for (const call of calls.filter(([file]) => file === 'tesseract')) {
    assert.deepEqual(call.slice(2), ['-', '-l', 'fra', '--psm', '4']);
  }
  assert.deepEqual(await fsp.readdir(tmpdir), [], 'nothing left behind');
});

test('with a screen, a page is read whole only when its top says so, its band kept otherwise', async () => {
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pdf-ocr-'));
  const { run, calls } = fakePrograms(['Arrêté Municipal\nN° 12', 'DOSSIER N° PC 059350 26 00051\nDemande', 'DOSSIER N° «DOSSIERNOM» PAGE 3/3\nINFORMATIONS']);
  const answer = await createPdfOcr({ run, tmpdir })(new Uint8Array([1]), { screen: (band) => /DOSSIER N° PC/.test(band) });
  assert.deepEqual(answer.pages, ['Arrêté Municipal', 'DOSSIER N° PC 059350 26 00051\nDemande', 'DOSSIER N° «DOSSIERNOM» PAGE 3/3']);
  assert.equal(answer.read, 1);
  assert.equal(calls.filter(([file, ...args]) => file === 'pdftoppm' && args.includes('-H')).length, 3, 'three bands');
  assert.equal(calls.filter(([file, ...args]) => file === 'pdftoppm' && !args.includes('-H')).length, 1, 'one page whole');
});

test('a file that cannot be rendered or read is a failure, nothing kept', async () => {
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pdf-ocr-'));
  const ocr = (failOn) => createPdfOcr({ run: fakePrograms(['Page un', 'Page deux'], { failOn }).run, tmpdir });
  assert.equal(await ocr((file) => file === 'pdfinfo')(new Uint8Array([1])), null);
  assert.equal(await ocr((file, args) => file === 'tesseract' && args[0].endsWith('page.pgm'))(new Uint8Array([1])), null);
  assert.deepEqual(await fsp.readdir(tmpdir), []);
});

test('OCR is there only when poppler and Tesseract\'s French both answer', async () => {
  const answering = (languages) => async (file) => {
    if (file === 'tesseract') return languages;
    if (file === 'pdfinfo' || file === 'pdftoppm') return '';
    return null;
  };
  assert.equal(await pdfOcrAvailable({ run: answering('List of available languages (3):\neng\nfra\nosd\n') }), true);
  assert.equal(await pdfOcrAvailable({ run: answering('List of available languages (2):\neng\nosd\n') }), false);
  assert.equal(await pdfOcrAvailable({ run: async () => null }), false, 'a machine without them');
});
