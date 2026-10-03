// src/data/pdfText.test.mjs
// Pins what `pdfText.js` reads out of a PDF, on files built here byte by
// byte: the lists it exists for name private people and cannot be fixtures.
// Each file below reproduces one trait of the five exports measured on
// 2026-09-30 — Excel's WinAnsi and Identity-H fonts, object streams, a
// PDFCreator row drawn as one `TJ` — and nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  GLYPH_WITHOUT_CHARACTER,
  binaryString,
  extractPdfText,
  parseToUnicode,
} from './pdfText.js';

const inflate = (bytes) => zlib.inflateSync(bytes);

/** A stream object's bytes: its dictionary, then its data, deflated or not. */
function stream(dict, data, { deflate = false } = {}) {
  const body = deflate ? zlib.deflateSync(Buffer.from(data, 'latin1')) : Buffer.from(data, 'latin1');
  const filter = deflate ? ' /Filter /FlateDecode' : '';
  return Buffer.concat([
    Buffer.from(`<< ${dict} /Length ${body.length}${filter} >>\nstream\n`, 'latin1'),
    body,
    Buffer.from('\nendstream', 'latin1'),
  ]);
}

/**
 * A file out of objects, numbered 1, 2, … in order — or by the number given
 * with each as `[num, body]`. The catalog is object 1.
 */
function pdf(objects) {
  const parts = [Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  objects.forEach((object, i) => {
    const [num, body] = Array.isArray(object) ? object : [i + 1, object];
    parts.push(Buffer.from(`${num} 0 obj\n`, 'latin1'));
    parts.push(Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'));
    parts.push(Buffer.from('\nendobj\n', 'latin1'));
  });
  parts.push(Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1'));
  return new Uint8Array(Buffer.concat(parts));
}

/** A one-page file with one WinAnsi font whose glyphs are all 500 wide. */
function simplePage(content, { deflate = false, fontExtra = '' } = {}) {
  return pdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R >>',
    stream('', content, { deflate }),
    `<< /Type /Font /Subtype /TrueType /BaseFont /Calibri /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 255 /Widths [${Array(224).fill(500).join(' ')}] ${fontExtra} >>`,
  ]);
}

function runs(bytes) {
  const document = extractPdfText(bytes, { inflate });
  assert.ok(document, 'the file is read');
  return document.pages.flatMap((page) => page.runs);
}

test('a WinAnsi font reads accents, and each positioning starts a run', () => {
  const found = runs(simplePage([
    'BT /F1 10 Tf 1 0 0 1 50 700 Tm (D\xe9pos\xe9 le) Tj',
    '0 -14 Td (Cl\x92ture) Tj',
    '14 TL T* (\x80 et \x9c) Tj ET',
  ].join('\n')));
  assert.deepEqual(found.map((run) => run.text), ['Déposé le', 'Cl’ture', '€ et œ']);
  assert.deepEqual(found.map((run) => [run.x, run.y]), [[50, 700], [50, 686], [50, 672]]);
  assert.equal(found[0].size, 10);
});

test('glyph widths place what follows, and a wide kern starts a new cell', () => {
  // PDFCreator's list of 21 August 2026 draws number, applicant and address in
  // ONE TJ, the cells apart by kerns of half an em to seven em. Every glyph is
  // 500/1000 of a 10-point size here, so « DP 1 » ends 20 points on.
  const found = runs(simplePage('BT /F1 10 Tf 1 0 0 1 50 700 Tm [(DP 1) -3000 (SCI) 5 (X) -600 (rue)] TJ ET'));
  assert.deepEqual(found.map((run) => run.text), ['DP 1', 'SCIX', 'rue']);
  assert.equal(found[1].x, 50 + 20 + 30);
  // A kern of five thousandths is Excel's letter-fitting, not a gap; it
  // still moves the pen, by 0.05 of a point here.
  assert.ok(Math.abs(found[2].x - (50 + 20 + 30 + 20 - 0.05 + 6)) < 1e-9);
  assert.equal(found[0].x1, 70, 'a run knows where it ends');
});

test('two Tj in a row without a move are one run, where the widths say so', () => {
  const found = runs(simplePage('BT /F1 10 Tf 50 700 Td (Nature ) Tj (des travaux) Tj ET'));
  assert.deepEqual(found.map((run) => run.text), ['Nature des travaux']);
});

test('explicit table edges keep gapless neighbouring fields in separate positioned runs', () => {
  const bytes = simplePage('BT /F1 10 Tf 50 700 Td (PC123PRIVATE12 STREET) Tj ET');
  const unchanged = extractPdfText(bytes, { inflate }).pages[0].runs;
  const separated = extractPdfText(bytes, { inflate, columnEdges: [75, 110] }).pages[0].runs;
  assert.deepEqual(unchanged.map((run) => run.text), ['PC123PRIVATE12 STREET']);
  assert.deepEqual(separated.map((run) => run.text), ['PC123', 'PRIVATE', '12 STREET']);
  assert.deepEqual(separated.map((run) => [run.x, run.x1]), [[50, 75], [75, 110], [110, 155]]);
});

test('the page matrix and a clip are applied, and Q restores both', () => {
  const found = runs(simplePage([
    'q 0.12 0 0 0.12 0 0 cm',
    'q 427 6456 114 40 re W n',
    'q 8.33333 0 0 8.33333 0 0 cm BT /F1 4 Tf 1 0 0 1 51.24 775.88 Tm (Num\xe9ro) Tj ET Q',
    'Q',
    'BT /F1 4 Tf 1 0 0 1 100 100 Tm (hors cadre) Tj ET',
    'Q',
  ].join('\n'), { deflate: true }));
  assert.equal(found[0].text, 'Numéro');
  assert.ok(Math.abs(found[0].x - 51.24) < 0.01 && Math.abs(found[0].y - 775.88) < 0.01);
  assert.ok(Math.abs(found[0].size - 4) < 0.01, 'the size is the drawn size, both matrices applied');
  assert.ok(Math.abs(found[0].clip.x0 - 51.24) < 0.01 && Math.abs(found[0].clip.y1 - 779.52) < 0.01);
  assert.equal(found[1].clip, null, 'Q drops the clip it saved');
  assert.ok(Math.abs(found[1].x - 12) < 0.01, 'and the page matrix still scales');
});

test('an Identity-H font packed in an object stream reads through its ToUnicode map', () => {
  // Excel 2019 onwards: the page, its fonts and the CMap's dictionary live in
  // an object stream, the text is two bytes a glyph, and only the CMap says
  // which character a glyph is.
  const cmap = [
    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
    '1 begincodespacerange <0000> <FFFF> endcodespacerange',
    '2 beginbfchar <0003> <0020> <0010> <00E9> endbfchar',
    '1 beginbfrange <0024> <0026> <0041> endbfrange',
    '1 beginbfrange <0030> <0031> [<0050> <0043>] endbfrange',
    '1 beginbfchar <0040> <> endbfchar',
    'endcmap end end',
  ].join('\n');
  const packed = [
    '<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F2 6 0 R >> >> >>',
    '<< /Type /Font /Subtype /Type0 /BaseFont /Calibri /Encoding /Identity-H /DescendantFonts [7 0 R] /ToUnicode 8 0 R >>',
    '<< /Type /Font /Subtype /CIDFontType2 /DW 1000 /W [36 [500 500 500] 48 49 250] >>',
  ];
  let offsets = '';
  let bodies = '';
  [3, 6, 7].forEach((num, i) => {
    offsets += `${num} ${bodies.length} `;
    bodies += `${packed[i]}\n`;
  });
  const objstm = stream(`/Type /ObjStm /N 3 /First ${offsets.length}`, offsets + bodies, { deflate: true });
  const found = runs(pdf([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [4, stream('', 'BT /F2 11.04 Tf 1 0 0 1 52.8 733.3 Tm [<0030>5<0031>-4<00030024002500260010>] TJ ET', { deflate: true })],
    [5, objstm],
    [8, stream('', cmap, { deflate: true })],
  ]));
  assert.deepEqual(found.map((run) => run.text), ['PC ABCé']);
  assert.deepEqual([found[0].x, found[0].y], [52.8, 733.3]);
});

test('a glyph with no character is marked, not dropped', () => {
  const cmap = '1 begincodespacerange <00> <FF> endcodespacerange\n2 beginbfchar <61> <0061> <62> <> endbfchar';
  const bytes = pdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    stream('', 'BT /F1 10 Tf 10 10 Td (aba) Tj ET'),
    '<< /Type /Font /Subtype /TrueType /FirstChar 97 /Widths [500 500] /ToUnicode 6 0 R >>',
    stream('', cmap),
  ]);
  assert.equal(runs(bytes)[0].text, `a${GLYPH_WITHOUT_CHARACTER}a`);
});

test('a Differences array names its glyphs', () => {
  const found = runs(simplePage('BT /F1 10 Tf 10 10 Td (\x01t\x02) Tj ET', {
    fontExtra: '/Encoding << /Differences [1 /eacute /ecircumflex] >>',
  }));
  assert.equal(found[0].text, 'étê');
});

test('what is not a PDF, or is encrypted, reads as null', () => {
  assert.equal(extractPdfText(new Uint8Array(0), { inflate }), null);
  assert.equal(extractPdfText(Uint8Array.from(Buffer.from('<html></html>')), { inflate }), null);
  const locked = Buffer.concat([
    Buffer.from(simplePage('BT /F1 10 Tf 10 10 Td (x) Tj ET')),
    Buffer.from('trailer << /Root 1 0 R /Encrypt 9 0 R >>\n', 'latin1'),
  ]);
  assert.equal(extractPdfText(new Uint8Array(locked), { inflate }), null);
});

test('a simple font reads one byte a code, whatever codespace its ToUnicode map declares', () => {
  // Acrobat PDFMaker for Word: a WinAnsi TrueType font whose map says
  // `<0000> <FFFF>` and lists one-byte codes. Read two bytes at a time, the
  // pair « Dé » became one CJK character.
  const cmap = [
    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
    '1 begincodespacerange <0000> <FFFF> endcodespacerange',
    '3 beginbfchar <44> <0044> <E9> <00E9> <20> <0020> endbfchar',
    'endcmap end end',
  ].join('\n');
  const found = runs(pdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R >>',
    stream('', 'BT /F1 10 Tf 1 0 0 1 50 700 Tm (D\xe9pos\xe9e le) Tj ET'),
    '<< /Type /Font /Subtype /TrueType /BaseFont /ArialMT /Encoding /WinAnsiEncoding /ToUnicode 6 0 R >>',
    stream('', cmap),
  ]));
  assert.deepEqual(found.map((run) => run.text), ['Déposée le']);
});

test('a scanned page has no text, and says so with an empty page', () => {
  const document = extractPdfText(simplePage('q 595 0 0 842 0 0 cm /Im0 Do Q'), { inflate });
  assert.equal(document.pages.length, 1);
  assert.deepEqual(document.pages[0].runs, []);
});

test('a ToUnicode range counts up, and an array range maps one by one', () => {
  const { map, bytes } = parseToUnicode([
    '1 begincodespacerange <0000> <FFFF> endcodespacerange',
    '1 beginbfrange <0010> <0012> <0061> endbfrange',
    '1 beginbfrange <0020> <0021> [<0066006C> <00E9>] endbfrange',
  ].join('\n'));
  assert.equal(bytes, 2);
  assert.deepEqual([0x10, 0x11, 0x12, 0x20, 0x21].map((code) => map.get(code)), ['a', 'b', 'c', 'fl', 'é']);
});

test('a file that draws no space glyph reads its word gaps as spaces, when asked to', () => {
  // Firefox's print to PDF (cairo): every word placed by its own move, 0.34 em
  // past the end of the one before, and no space glyph anywhere.
  const content = 'BT /F1 10 Tf 1 0 0 1 50 700 Tm (DP) Tj 1 0 0 1 63.4 700 Tm (074) Tj 1 0 0 1 81.9 700 Tm (010) Tj ET';
  const file = simplePage(content);
  assert.deepEqual(runs(file).map((run) => run.text), ['DP074010']);
  const spaced = extractPdfText(file, { inflate, wordGapEm: 0.15 }).pages[0].runs;
  assert.deepEqual(spaced.map((run) => run.text), ['DP 074 010']);
});
