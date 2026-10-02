/**
 * Reading a scanned PDF by OCR: poppler renders each page, Tesseract reads it.
 *
 * The one place the binaries are named. A reader is handed page texts and
 * never knows where they were read — on this server today, somewhere else if
 * the work moves — so the daily sweep takes the function this module builds
 * as an argument (`ocr` of `sweepPermitLists`), and a test hands it a fake.
 *
 * ── Trap 1: a PNG costs more than the OCR ──────────────────────────────────
 * `pdftoppm -png` spent 0.96 s per page of Lille's bulletin compressing an
 * image Tesseract reads once and throws away (Mac, 2026-10-01, 80 pages);
 * the same page as an uncompressed PGM took 0.25 s. So pages are rendered
 * as PGM, one at a time, and deleted as soon as they are read: a 148-page
 * bulletin would be 570 MB of PGM at once.
 *
 * ── Trap 2: most pages are not worth reading ────────────────────────────────
 * A bulletin holds every act of the day: traffic orders, loan contracts,
 * building-safety orders with their twelve pages of quoted code. On 14
 * bulletins sampled, about a third of the pages were urbanism decisions,
 * and those carry their dossier number at the top of every page. With a
 * `screen`, the top of each page is read first (a band of `BAND_INCHES`), and
 * the whole page only when the screen says so: a band costs about a quarter
 * of a page.
 *
 * ── Trap 3: one core, the lowest priority ───────────────────────────────────
 * The server has two cores and serves visitors while the sweep runs. Every
 * process is started with one OpenMP thread (`OMP_THREAD_LIMIT=1`) and at
 * nice 19, so a page waits for a visitor and never the reverse.
 */

import { execFile } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Lille's scans are 200 dpi: rendering finer invents nothing. */
export const PDF_OCR_DPI = 200;
/** The top of a page read before the rest (Trap 2): the dossier number sits at about one inch. */
const BAND_INCHES = 2;
/** A bulletin of 148 pages was the longest sampled; ten times that is not a bulletin. */
const MAX_PAGES = 1500;
const PAGE_TIMEOUT_MS = 120_000;
const TEXT_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Run a program, resolve with its standard output, never throw.
 * @returns {Promise<?string>} Null when the program is missing, failed or ran out of time.
 */
export function runProgram(file, args, { timeoutMs = PAGE_TIMEOUT_MS, priority = 19 } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = execFile(file, args, {
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: TEXT_MAX_BYTES,
        env: { ...process.env, OMP_THREAD_LIMIT: '1' },
      }, (error, stdout) => resolve(error ? null : stdout));
    } catch {
      resolve(null);
      return;
    }
    try { if (child.pid) os.setPriority(child.pid, priority); } catch { /* best effort */ }
  });
}

/**
 * Whether poppler and Tesseract's French are on this machine. A development
 * machine without them answers false, and the city that needs them is left
 * out of the sweep with one line in the log.
 * @param {{run?: Function}} [options]
 * @returns {Promise<boolean>}
 */
export async function pdfOcrAvailable({ run = runProgram } = {}) {
  const [poppler, languages] = await Promise.all([
    run('pdfinfo', ['-v'], { timeoutMs: 10_000 }),
    run('tesseract', ['--list-langs'], { timeoutMs: 10_000 }),
  ]);
  // `pdfinfo -v` prints on stderr and exits 0 (99 on old poppler): ask the
  // renderer instead when it says nothing.
  const renderer = poppler !== null ? poppler : await run('pdftoppm', ['-v'], { timeoutMs: 10_000 });
  return renderer !== null && languages !== null && /^fra$/m.test(languages);
}

/**
 * The function the sweep reads a scanned PDF with.
 *
 * @param {object} [options]
 * @param {Function} [options.run] `(file, args, {timeoutMs}) => Promise<?string>`; tests inject one.
 * @param {string} [options.tmpdir]
 * @param {string} [options.lang]
 * @returns {(bytes: Uint8Array, opts?: {screen?: (band: string) => boolean, positioned?: boolean, rotate?: number,
 *   maxPages?: ?number}) =>
 *   Promise<?{pages: Array<string>, read: number, ms: number}>} Each page's
 *   text — the band's alone for a page the screen set aside — and how many
 *   were read whole; null when the file could not be rendered or read, a
 *   failure the caller keeps for next time. `positioned` also returns a
 *   `document` of word runs in PDF points for column-based list readers.
 *   `maxPages`: the first pages only, for a form whose fields are on page 1.
 */
export function createPdfOcr({ run = runProgram, tmpdir = os.tmpdir(), lang = 'fra' } = {}) {
  return async function readScannedPdf(bytes, { screen = null, positioned = false, rotate = 0, maxPages = null } = {}) {
    const started = Date.now();
    let dir = null;
    try {
      dir = await fsp.mkdtemp(path.join(tmpdir, 'surplomb-ocr-'));
      const pdf = path.join(dir, 'in.pdf');
      await fsp.writeFile(pdf, bytes);
      const info = await run('pdfinfo', [pdf]);
      const count = Number(/^Pages:\s+(\d+)/m.exec(info ?? '')?.[1]);
      if (!Number.isInteger(count) || count < 1 || count > MAX_PAGES) return null;
      const pages = [];
      const positionedPages = [];
      let read = 0;
      for (let page = 1; page <= Math.min(count, maxPages ?? count); page += 1) {
        const at = ['-r', String(PDF_OCR_DPI), '-gray', '-f', String(page), '-l', String(page), '-singlefile'];
        if (screen) {
          const band = path.join(dir, 'band');
          const size = String(Math.round(BAND_INCHES * PDF_OCR_DPI));
          if (await run('pdftoppm', [...at, '-x', '0', '-y', '0', '-W', String(12 * PDF_OCR_DPI), '-H', size, pdf, band]) === null) return null;
          const head = await run('tesseract', [`${band}.pgm`, '-', '-l', lang, '--psm', '4']);
          await fsp.rm(`${band}.pgm`, { force: true });
          if (head === null) return null;
          // A page set aside is its band: the number it prints still counts.
          if (!screen(head)) { pages.push(head); continue; }
        }
        const image = path.join(dir, 'page');
        if (await run('pdftoppm', [...at, pdf, image]) === null) return null;
        if (rotate) await fsp.writeFile(`${image}.pgm`, rotatePgm(await fsp.readFile(`${image}.pgm`), rotate));
        const text = await run('tesseract', [`${image}.pgm`, '-', '-l', lang, '--psm', '4', ...(positioned ? ['tsv'] : [])]);
        await fsp.rm(`${image}.pgm`, { force: true });
        if (text === null) return null;
        if (positioned) {
          const pageText = ocrTsvPage(text);
          if (!pageText) return null;
          positionedPages.push(pageText);
          pages.push(pageText.runs.map((word) => word.text).join(' '));
        } else pages.push(text);
        read += 1;
      }
      return { pages, read, ms: Date.now() - started, ...(positioned ? { document: { pages: positionedPages } } : {}) };
    } catch {
      return null;
    } finally {
      if (dir) await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  };
}

/** Tesseract's words in PDF points, with the same upward y axis as pdfText.js. */
export function ocrTsvPage(tsv) {
  const rows = String(tsv ?? '').trim().split('\n').slice(1).map((line) => line.split('\t'));
  const page = rows.find((row) => row[0] === '1');
  const scale = 72 / PDF_OCR_DPI;
  const height = Number(page?.[9]) * scale;
  if (!height) return null;
  const lineKey = (row) => row.slice(1, 5).join(':');
  const words = rows.filter((row) => row[0] === '5' && row[11]?.trim());
  const bottoms = new Map();
  for (const word of words.filter((row) => /[\p{L}\d]/u.test(row[11]))) {
    const key = lineKey(word);
    if (!bottoms.has(key)) bottoms.set(key, []);
    bottoms.get(key).push(Number(word[7]) + Number(word[9]));
  }
  // A table border sometimes becomes a tall word in the line box. The
  // median of the actual words keeps it from moving a row's baseline.
  const baselines = new Map([...bottoms].map(([key, values]) => [key, values.sort((a, b) => a - b)[Math.floor(values.length / 2)]]));
  const runs = words.map((row) => ({
    x: Number(row[6]) * scale,
    x1: (Number(row[6]) + Number(row[8])) * scale,
    y: height - (baselines.get(lineKey(row)) ?? Number(row[7]) + Number(row[9])) * scale,
    size: Number(row[9]) * scale,
    text: row.slice(11).join('\t').trim(),
    clip: null,
  }));
  return { width: Number(page[8]) * scale, height, runs };
}

/** Rotate poppler's eight-bit grey PGM without another image binary. */
export function rotatePgm(bytes, degrees) {
  const head = /^P5\s+(?:#[^\n]*\n\s*)?(\d+)\s+(\d+)\s+255(?:\r\n|\n| )/.exec(bytes.subarray(0, 256).toString('ascii'));
  if (!head || ![90, 270].includes(degrees)) throw new Error('Unsupported grey PGM rotation');
  const width = Number(head[1]);
  const height = Number(head[2]);
  const pixels = bytes.subarray(head[0].length);
  if (pixels.length !== width * height) throw new Error('Truncated grey PGM');
  const rotated = Buffer.alloc(pixels.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const targetX = degrees === 270 ? y : height - 1 - y;
      const targetY = degrees === 270 ? width - 1 - x : x;
      rotated[targetY * height + targetX] = pixels[y * width + x];
    }
  }
  return Buffer.concat([Buffer.from(`P5\n${height} ${width}\n255\n`), rotated]);
}
