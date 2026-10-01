// scripts/lib/pdfOcr.test.mjs
// The OCR runner with its programs faked: what it asks poppler and Tesseract,
// in what order, and what it hands back. No binary runs here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPdfOcr, pdfOcrAvailable } from './pdfOcr.mjs';

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
