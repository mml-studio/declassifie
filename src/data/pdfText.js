/**
 * @module data/pdfText
 *
 * The text a PDF prints, and where on the page it prints it — enough to read a
 * table a spreadsheet exported, and nothing more.
 *
 * WHY NOT A LIBRARY. The one PDF this project reads is a commune's list of
 * filed permits, exported from Excel (`publicationActesFeed.js`), and what it
 * needs out of it is a few hundred text runs with their position and the cell
 * each was clipped to. pdf.js does that and far more, and in Node it pulls a
 * native canvas binary in as an optional dependency; the whole of what is
 * needed here is a tokenizer, an object table, two font decoders and the text
 * operators, and it is tested against hand-built files in `pdfText.test.mjs`.
 *
 * WHAT IS READ. Objects written plainly and objects packed into object streams
 * (Excel 2019 onwards packs its fonts and pages that way), `FlateDecode`
 * streams, the page tree with inherited resources, and three ways a font maps
 * its codes to characters: a `ToUnicode` CMap (one byte or two), the
 * WinAnsi encoding, and a `Differences` array of glyph names.
 *
 * WHAT IS NOT. Encrypted files, scanned pages (no text to read — the arrêtés
 * the same communes publish are scans), form XObjects, and glyph widths: a
 * run's position is where it STARTS, and consecutive runs drawn without a
 * move in between are joined into one, which is how a spreadsheet cell writes
 * a line.
 *
 * Pure: no fetch, no DOM, no Node built-in. Decompression is passed in
 * (`inflate`), so the module runs wherever its caller has zlib.
 */

/** Whitespace, as PDF defines it. */
const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
/** Delimiters: they end a keyword, a number or a name. */
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

/** Bytes → one char per byte, so offsets in the string are offsets in the file. */
export function binaryString(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + 8192)));
  }
  return out;
}

/** One char per byte → bytes. */
function binaryBytes(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/** A reference to an indirect object. */
class Ref {
  constructor(num) { this.num = num; }
}

/** An operator or bare keyword in a content stream. */
class Op {
  constructor(name) { this.name = name; }
}

/**
 * A tokenizer and value parser over a binary string.
 *
 * Used twice: on the file itself, where `n g obj … endobj` and `n g R` occur,
 * and on content streams, where the same values are operands and every bare
 * word is an operator.
 */
class Lexer {
  constructor(src, pos = 0) {
    this.src = src;
    this.pos = pos;
  }

  skip() {
    const { src } = this;
    while (this.pos < src.length) {
      const c = src.charCodeAt(this.pos);
      if (WS.has(c)) { this.pos += 1; continue; }
      if (c === 0x25) {
        while (this.pos < src.length && src[this.pos] !== '\n' && src[this.pos] !== '\r') this.pos += 1;
        continue;
      }
      break;
    }
  }

  word() {
    const { src } = this;
    const start = this.pos;
    while (this.pos < src.length) {
      const c = src.charCodeAt(this.pos);
      if (WS.has(c) || DELIM.has(c)) break;
      this.pos += 1;
    }
    return src.slice(start, this.pos);
  }

  literal() {
    const { src } = this;
    let depth = 1;
    let out = '';
    this.pos += 1;
    while (this.pos < src.length) {
      const ch = src[this.pos];
      this.pos += 1;
      if (ch === '\\') {
        const next = src[this.pos];
        this.pos += 1;
        if (next === 'n') out += '\n';
        else if (next === 'r') out += '\r';
        else if (next === 't') out += '\t';
        else if (next === 'b') out += '\b';
        else if (next === 'f') out += '\f';
        else if (next === '\r') { if (src[this.pos] === '\n') this.pos += 1; }
        else if (next === '\n') { /* a line continuation */ }
        else if (next >= '0' && next <= '7') {
          let digits = next;
          while (digits.length < 3 && src[this.pos] >= '0' && src[this.pos] <= '7') {
            digits += src[this.pos];
            this.pos += 1;
          }
          out += String.fromCharCode(Number.parseInt(digits, 8) & 0xff);
        } else if (next !== undefined) out += next;
        continue;
      }
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (!depth) break;
      }
      out += ch;
    }
    return { str: out };
  }

  hex() {
    const { src } = this;
    this.pos += 1;
    const end = src.indexOf('>', this.pos);
    const digits = src.slice(this.pos, end < 0 ? src.length : end).replace(/[^0-9a-fA-F]/g, '');
    this.pos = end < 0 ? src.length : end + 1;
    const even = digits.length % 2 ? `${digits}0` : digits;
    let out = '';
    for (let i = 0; i < even.length; i += 2) out += String.fromCharCode(Number.parseInt(even.slice(i, i + 2), 16));
    return { str: out };
  }

  name() {
    this.pos += 1;
    return { name: this.word().replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16))) };
  }

  /**
   * The next value, or an `Op` for a bare word, or undefined at the end.
   * @param {boolean} refs Whether `n g R` is a reference (true in the file,
   *   false in a content stream, where it cannot occur).
   */
  value(refs = true) {
    this.skip();
    const { src } = this;
    if (this.pos >= src.length) return undefined;
    const ch = src[this.pos];
    if (ch === '<' && src[this.pos + 1] === '<') {
      this.pos += 2;
      const dict = {};
      for (;;) {
        this.skip();
        if (this.pos >= src.length) break;
        if (src[this.pos] === '>' && src[this.pos + 1] === '>') { this.pos += 2; break; }
        const key = this.value(refs);
        if (key === undefined) break;
        if (!key || typeof key.name !== 'string') continue;
        dict[key.name] = this.value(refs);
      }
      return dict;
    }
    if (ch === '<') return this.hex();
    if (ch === '(') return this.literal();
    if (ch === '/') return this.name();
    if (ch === '[') {
      this.pos += 1;
      const items = [];
      for (;;) {
        this.skip();
        if (this.pos >= src.length) break;
        if (src[this.pos] === ']') { this.pos += 1; break; }
        const item = this.value(refs);
        if (item === undefined) break;
        items.push(item);
      }
      return items;
    }
    if (ch === ']' || ch === ')' || ch === '>' || ch === '{' || ch === '}') {
      this.pos += 1;
      return new Op(ch);
    }
    const word = this.word();
    if (!word) { this.pos += 1; return new Op(ch); }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
      const number = Number(word);
      if (refs && /^\d+$/.test(word)) {
        const save = this.pos;
        const gen = /^\s+(\d+)\s+R(?![A-Za-z])/.exec(src.slice(this.pos, this.pos + 24));
        if (gen) {
          this.pos = save + gen[0].length;
          return new Ref(number);
        }
      }
      return number;
    }
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null') return null;
    return new Op(word);
  }
}

/**
 * Every object in the file, by number.
 *
 * Found by scanning for `n g obj` rather than through the xref table: the
 * table may be a compressed stream, may be wrong after an incremental save,
 * and is not needed to read a file front to back. A stream's bytes are skipped
 * over, so a byte pattern inside one is never mistaken for an object. The last
 * definition of a number wins, as it does after an incremental update.
 */
function readObjects(src, inflate) {
  const objects = new Map();
  const header = /(\d+)\s+(\d+)\s+obj\b/g;
  let match;
  while ((match = header.exec(src))) {
    const lexer = new Lexer(src, match.index + match[0].length);
    const value = lexer.value(true);
    lexer.skip();
    let stream = null;
    if (src.startsWith('stream', lexer.pos)) {
      let start = lexer.pos + 6;
      if (src[start] === '\r') start += 1;
      if (src[start] === '\n') start += 1;
      const length = value && typeof value.Length === 'number' ? value.Length : null;
      let end = length !== null ? start + length : -1;
      if (end < 0 || !/^\s*endstream/.test(src.slice(end, end + 32))) {
        end = src.indexOf('endstream', start);
        if (end < 0) end = src.length;
        // The EOL before `endstream` is not part of the data.
        if (src[end - 1] === '\n') end -= 1;
        if (src[end - 1] === '\r') end -= 1;
      }
      stream = src.slice(start, end);
      header.lastIndex = Math.max(header.lastIndex, end);
    }
    objects.set(Number(match[1]), { value, stream });
  }
  // Objects packed into object streams, where they were not also written out.
  for (const { value, stream } of [...objects.values()]) {
    if (!value || value.Type?.name !== 'ObjStm' || stream === null) continue;
    const data = decodeStream(value, stream, inflate);
    if (data === null) continue;
    const count = Number(value.N) || 0;
    const first = Number(value.First) || 0;
    const head = new Lexer(data, 0);
    const offsets = [];
    for (let i = 0; i < count; i += 1) {
      const num = head.value(false);
      const offset = head.value(false);
      if (typeof num !== 'number' || typeof offset !== 'number') break;
      offsets.push([num, offset]);
    }
    for (const [num, offset] of offsets) {
      if (objects.has(num)) continue;
      objects.set(num, { value: new Lexer(data, first + offset).value(true), stream: null });
    }
  }
  return objects;
}

/**
 * A stream's decoded bytes, as a binary string, or null for a filter this
 * module does not read (an image's DCT, most often, which carries no text).
 */
function decodeStream(dict, raw, inflate) {
  const filters = [].concat(dict?.Filter ?? []).map((filter) => filter?.name);
  let data = raw;
  for (const filter of filters) {
    if (filter !== 'FlateDecode' && filter !== 'Fl') return null;
    if (typeof inflate !== 'function') return null;
    try {
      data = binaryString(inflate(binaryBytes(data)));
    } catch {
      return null;
    }
  }
  return data;
}

/** What a glyph with no character reads as: the replacement character. */
export const GLYPH_WITHOUT_CHARACTER = '\uFFFD';

/** The WinAnsi (Windows-1252) characters that are not Latin-1's. */
const WIN_ANSI_HIGH = Object.freeze({
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
  0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018,
  0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc,
  0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
});

/** @param {number} code @returns {string} */
function winAnsi(code) {
  return String.fromCharCode(WIN_ANSI_HIGH[code] ?? code);
}

/**
 * The glyph names a `Differences` array uses for what French text needs.
 * Anything else is read through `uniXXXX`, or as a single-letter name.
 */
// i18n-ignore-start — glyph names and the characters they stand for
const GLYPH_NAMES = Object.freeze({
  space: ' ', exclam: '!', quotedbl: '"', numbersign: '#', dollar: '$', percent: '%', ampersand: '&',
  quotesingle: '\'', quoteright: '’', quoteleft: '‘', parenleft: '(', parenright: ')', asterisk: '*',
  plus: '+', comma: ',', hyphen: '-', period: '.', slash: '/', colon: ':', semicolon: ';', less: '<',
  equal: '=', greater: '>', question: '?', at: '@', bracketleft: '[', backslash: '\\', bracketright: ']',
  underscore: '_', degree: '°', ordmasculine: 'º', twosuperior: '²', endash: '–', emdash: '—',
  guillemotleft: '«', guillemotright: '»', zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9', agrave: 'à', acircumflex: 'â', ccedilla: 'ç',
  egrave: 'è', eacute: 'é', ecircumflex: 'ê', edieresis: 'ë', icircumflex: 'î', idieresis: 'ï',
  ocircumflex: 'ô', ugrave: 'ù', ucircumflex: 'û', udieresis: 'ü', Agrave: 'À', Acircumflex: 'Â',
  Ccedilla: 'Ç', Egrave: 'È', Eacute: 'É', Ecircumflex: 'Ê', Icircumflex: 'Î', Ocircumflex: 'Ô',
  oe: 'œ', OE: 'Œ', fi: 'fi', fl: 'fl',
});
// i18n-ignore-end

function glyphChar(name) {
  if (Object.hasOwn(GLYPH_NAMES, name)) return GLYPH_NAMES[name];
  const uni = /^uni([0-9A-Fa-f]{4})$/.exec(name);
  if (uni) return String.fromCharCode(Number.parseInt(uni[1], 16));
  return /^[A-Za-z]$/.test(name) ? name : '';
}

/** UTF-16BE bytes (a CMap destination) → text. */
function utf16(bytes) {
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out += String.fromCharCode((bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1));
  }
  return out;
}

function hexBytes(hex) {
  const digits = hex.replace(/[^0-9a-fA-F]/g, '');
  let out = '';
  for (let i = 0; i < digits.length; i += 2) out += String.fromCharCode(Number.parseInt(digits.slice(i, i + 2), 16));
  return out;
}

function codeOf(bytes) {
  let code = 0;
  for (let i = 0; i < bytes.length; i += 1) code = (code * 256) + bytes.charCodeAt(i);
  return code;
}

/**
 * A `ToUnicode` CMap: code → text, and how many bytes a code takes.
 * @param {string} text The decoded CMap program.
 * @returns {{map: Map<number, string>, bytes: ?number}}
 */
export function parseToUnicode(text) {
  const map = new Map();
  const source = String(text ?? '');
  let bytes = null;
  const space = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(source);
  if (space) bytes = Math.max(1, Math.ceil(space[1].length / 2));
  for (const block of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) {
      map.set(codeOf(hexBytes(pair[1])), utf16(hexBytes(pair[2])));
      bytes ??= Math.ceil(pair[1].length / 2);
    }
  }
  for (const block of source.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const ranges = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]*)>|\[([^\]]*)\])/g;
    for (const range of block[1].matchAll(ranges)) {
      const lo = codeOf(hexBytes(range[1]));
      const hi = codeOf(hexBytes(range[2]));
      bytes ??= Math.ceil(range[1].length / 2);
      if (hi - lo > 0xffff) continue;
      if (range[4] !== undefined) {
        const items = [...range[4].matchAll(/<([0-9a-fA-F]*)>/g)].map((item) => utf16(hexBytes(item[1])));
        items.forEach((value, i) => { if (lo + i <= hi) map.set(lo + i, value); });
        continue;
      }
      const start = hexBytes(range[3]);
      for (let code = lo; code <= hi; code += 1) {
        // The last UTF-16 unit counts up with the code, as the spec says.
        const offset = code - lo;
        const last = start.length >= 2
          ? ((start.charCodeAt(start.length - 2) << 8) | start.charCodeAt(start.length - 1)) + offset
          : offset;
        map.set(code, utf16(start.slice(0, -2)) + String.fromCharCode(last & 0xffff));
      }
    }
  }
  return { map, bytes };
}

/**
 * A font: the bytes a string operand carries → glyphs, each with its text and
 * its advance.
 *
 * A composite (Type0) font reads two bytes a code and says nothing without a
 * `ToUnicode` map; a simple font reads one, prefers its `ToUnicode` map and
 * falls back to its encoding. A code that maps to nothing keeps its advance
 * and prints nothing, which is what a reader of the printed page sees of a
 * glyph with no character.
 *
 * THE WIDTHS ARE READ because a spreadsheet does not always start a cell with
 * a move: the list of 21 August 2026 draws a row's first four cells in ONE
 * `TJ`, separated by kerns of half an em to seven em, and the only way to know
 * where the applicant ends and the address starts is to add the glyphs up.
 */
function fontDecoder(font, resolve, inflate) {
  const dict = resolve(font) || {};
  const composite = dict.Subtype?.name === 'Type0';
  let unicode = null;
  const cmapRef = dict.ToUnicode;
  if (cmapRef instanceof Ref) {
    const entry = resolve.entry(cmapRef);
    const data = entry?.stream !== null && entry?.stream !== undefined
      ? decodeStream(entry.value, entry.stream, inflate)
      : null;
    if (data !== null) unicode = parseToUnicode(data);
  }
  // A simple font's codes are one byte, whatever its ToUnicode map declares:
  // Acrobat's PDFMaker writes `<0000> <FFFF>` as the codespace of a WinAnsi
  // TrueType font whose map then lists one-byte codes (Lyon's list of 7-13
  // September 2026), and reading that file two bytes a code printed CJK.
  const bytesPerCode = composite ? (unicode?.bytes ?? 2) : 1;
  const differences = new Map();
  const encoding = resolve(dict.Encoding);
  if (encoding && Array.isArray(resolve(encoding.Differences))) {
    let code = 0;
    for (const item of resolve(encoding.Differences)) {
      if (typeof item === 'number') code = item;
      else if (item && typeof item.name === 'string') { differences.set(code, glyphChar(item.name)); code += 1; }
    }
  }
  // Advances, in thousandths of the font size.
  const widths = new Map();
  let fallback = 0;
  if (composite) {
    const descendant = resolve(resolve(dict.DescendantFonts)?.[0]) || {};
    fallback = typeof descendant.DW === 'number' ? descendant.DW : 1000;
    const list = resolve(descendant.W) || [];
    for (let i = 0; i < list.length;) {
      const first = list[i];
      const next = resolve(list[i + 1]);
      if (Array.isArray(next)) {
        next.forEach((w, k) => widths.set(first + k, Number(w) || 0));
        i += 2;
      } else {
        for (let code = first; code <= next && code - first < 0xffff; code += 1) widths.set(code, Number(list[i + 2]) || 0);
        i += 3;
      }
    }
  } else {
    const first = Number(dict.FirstChar) || 0;
    (resolve(dict.Widths) || []).forEach((w, k) => widths.set(first + k, Number(resolve(w)) || 0));
    fallback = Number(resolve(dict.FontDescriptor)?.MissingWidth) || 0;
  }
  return (bytes) => {
    const glyphs = [];
    for (let i = 0; i + bytesPerCode <= bytes.length; i += bytesPerCode) {
      const code = codeOf(bytes.slice(i, i + bytesPerCode));
      let text = unicode?.map.get(code);
      if (text === undefined) {
        if (composite) text = '';
        else if (differences.has(code)) text = differences.get(code);
        else text = winAnsi(code);
      }
      // A glyph printed with no character is MARKED, not dropped: Office sets
      // French in Calibri with a « ti » ligature it maps to nothing, and a
      // reader of the text can only mend a hole it can see.
      if (text === '') text = GLYPH_WITHOUT_CHARACTER;
      glyphs.push({
        text,
        width: widths.get(code) ?? fallback,
        // Word spacing applies to the single byte 32, and only there.
        space: bytesPerCode === 1 && code === 32,
      });
    }
    return glyphs;
  };
}

/** `[a b c d e f]` × `[a b c d e f]`, row vectors as PDF writes them. */
function multiply(m, n) {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);

/**
 * The gap, in ems, past which the next glyph starts a new run. A word space is
 * a quarter of an em; the narrowest gap between two cells measured in the lists
 * read here is half of one.
 */
const RUN_GAP_EM = 0.4;

/** The Unicode ligatures a spreadsheet's fonts print, spelt out. */
const LIGATURES = Object.freeze({
  'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st',
});

function spellOut(text) {
  return text.replace(/[ﬀ-ﬆ]/g, (ch) => LIGATURES[ch] ?? ch);
}

/**
 * Run one page's content: the text runs it draws, positioned in page space.
 *
 * A run is text drawn on one baseline without a gap: a glyph that lands more
 * than {@link RUN_GAP_EM} of an em past where the previous one ended starts a
 * new run, whichever operator put it there. The clip each run was drawn under
 * is kept too, as the layout hint it is.
 */
function runContent(content, decoders, wordGapEm = null, columnEdges = []) {
  const lexer = new Lexer(content, 0);
  const runs = [];
  let operands = [];
  let ctm = IDENTITY;
  let clip = null;
  const stack = [];
  let tm = IDENTITY;
  let tlm = IDENTITY;
  let leading = 0;
  let charSpacing = 0;
  let wordSpacing = 0;
  let scale = 1;
  let font = null;
  let size = 0;
  let rect = null;
  let pendingClip = false;
  // Where, in page space, the last glyph drawn ended.
  let pen = null;

  /** Draw glyphs at the text matrix, advancing it, joining or starting runs. */
  const draw = (glyphs) => {
    for (const glyph of glyphs) {
      const trm = multiply(tm, ctm);
      const [x, y] = apply(trm, 0, 0);
      const em = Math.abs(size * Math.hypot(trm[2], trm[3])) || 1;
      const last = runs[runs.length - 1];
      const joined = pen && last && Math.abs(y - pen.y) < em * 0.2
        && x - pen.x < em * RUN_GAP_EM && x - pen.x > -em * 0.5
        && !columnEdges.some((edge) => last.x < edge && x >= edge);
      if (!joined && glyph.text && glyph.text.trim()) {
        runs.push({ x, x1: x, y, size: em, text: '', clip });
      }
      // A word gap drawn as a move rather than a space glyph, for a caller that
      // says its file is written that way (`wordGapEm`). Cairo — Firefox's
      // print to PDF — writes no space at all and moves every word 0.34 em on
      // (4 329 gaps of Annecy's two lists of 25 September 2026): read glued,
      // `DP 074 010 25` was `DP07401025`. Not by default: Word and Excel
      // justify with gaps of that size inside words (`photovoltaïqu es`).
      if (wordGapEm && joined && glyph.text && glyph.text.trim() && x - pen.x > em * wordGapEm
        && !/\s$/.test(runs[runs.length - 1].text)) runs[runs.length - 1].text += ' ';
      if (joined || (glyph.text && glyph.text.trim())) runs[runs.length - 1].text += spellOut(glyph.text);
      const advance = ((glyph.width / 1000) * size + charSpacing + (glyph.space ? wordSpacing : 0)) * scale;
      tm = multiply([1, 0, 0, 1, advance, 0], tm);
      const [ex, ey] = apply(multiply(tm, ctm), 0, 0);
      if (joined || (glyph.text && glyph.text.trim())) {
        pen = { x: ex, y: ey };
        runs[runs.length - 1].x1 = ex;
      }
    }
  };
  const move = (tx, ty) => {
    tlm = multiply([1, 0, 0, 1, tx, ty], tlm);
    tm = tlm;
  };

  for (;;) {
    const token = lexer.value(false);
    if (token === undefined) break;
    if (!(token instanceof Op)) { operands.push(token); continue; }
    const op = token.name;
    const n = (i) => (typeof operands[i] === 'number' ? operands[i] : 0);
    switch (op) {
      case 'q': stack.push({ ctm, clip }); break;
      case 'Q': ({ ctm, clip } = stack.pop() ?? { ctm: IDENTITY, clip: null }); break;
      case 'cm': ctm = multiply([n(0), n(1), n(2), n(3), n(4), n(5)], ctm); break;
      case 're': {
        const corners = [[n(0), n(1)], [n(0) + n(2), n(1) + n(3)]].map(([x, y]) => apply(ctm, x, y));
        rect = {
          x0: Math.min(corners[0][0], corners[1][0]),
          y0: Math.min(corners[0][1], corners[1][1]),
          x1: Math.max(corners[0][0], corners[1][0]),
          y1: Math.max(corners[0][1], corners[1][1]),
        };
        break;
      }
      case 'W': case 'W*': pendingClip = true; break;
      case 'n': case 'f': case 'f*': case 'F': case 'S': case 's': case 'B': case 'B*': case 'b': case 'b*':
        if (pendingClip && rect) {
          clip = clip
            ? {
              x0: Math.max(clip.x0, rect.x0),
              y0: Math.max(clip.y0, rect.y0),
              x1: Math.min(clip.x1, rect.x1),
              y1: Math.min(clip.y1, rect.y1),
            }
            : rect;
        }
        pendingClip = false;
        rect = null;
        break;
      case 'BT': tm = IDENTITY; tlm = IDENTITY; break;
      case 'Tf': font = operands[0]?.name ?? null; size = n(1); break;
      case 'Tc': charSpacing = n(0); break;
      case 'Tw': wordSpacing = n(0); break;
      case 'Tz': scale = n(0) / 100; break;
      case 'Td': move(n(0), n(1)); break;
      case 'TD': leading = -n(1); move(n(0), n(1)); break;
      case 'TL': leading = n(0); break;
      case 'Tm': tlm = [n(0), n(1), n(2), n(3), n(4), n(5)]; tm = tlm; break;
      case 'T*': move(0, -leading); break;
      case 'Tj':
        if (font && operands[0]?.str !== undefined) draw(decoders(font)(operands[0].str));
        break;
      case '\'':
        move(0, -leading);
        if (font && operands[0]?.str !== undefined) draw(decoders(font)(operands[0].str));
        break;
      case '"':
        wordSpacing = n(0);
        charSpacing = n(1);
        move(0, -leading);
        if (font && operands[2]?.str !== undefined) draw(decoders(font)(operands[2].str));
        break;
      case 'TJ': {
        if (!font) break;
        const decode = decoders(font);
        for (const item of Array.isArray(operands[0]) ? operands[0] : []) {
          if (item?.str !== undefined) draw(decode(item.str));
          else if (typeof item === 'number') tm = multiply([1, 0, 0, 1, (-item / 1000) * size * scale, 0], tm);
        }
        break;
      }
      case 'BI': {
        // An inline image: its bytes run to `EI`, and none of them is text.
        const end = content.indexOf('EI', lexer.pos);
        lexer.pos = end < 0 ? content.length : end + 2;
        break;
      }
      default: break;
    }
    operands = [];
  }
  return runs.map((run) => ({ ...run, text: run.text.replace(/\s+/g, ' ').trim() })).filter((run) => run.text);
}

/**
 * The text runs of every page, in drawing order.
 *
 * @param {Uint8Array} bytes The file.
 * @param {{inflate: function(Uint8Array): Uint8Array, maxPages?: number, wordGapEm?: ?number, columnEdges?: number[]}} options
 *   `inflate` is zlib's `inflateSync` or anything with its contract.
 *   `wordGapEm`: inside a run, a gap wider than this many ems reads as a
 *   space — for a file that draws no space glyphs (Firefox's print to PDF).
 *   `columnEdges`: measured table edges in page points; split a run there
 *   even when the publisher paints adjacent cells without any gap.
 * @returns {?{pages: Array<{runs: Array<{x: number, x1: number, y: number, size: number,
 *   text: string, clip: ?{x0: number, y0: number, x1: number, y1: number}}>}>}}
 *   Null for a file that is not a PDF or is encrypted. Blank lines before
 *   the header are allowed.
 */
export function extractPdfText(bytes, { inflate, maxPages = 40, wordGapEm = null, columnEdges = [] } = {}) {
  if (!bytes || !bytes.length) return null;
  const src = binaryString(bytes);
  // A header after a few stray bytes is still a PDF, as readers take it:
  // Bourges's portal serves its lists behind five blank lines.
  const header = src.indexOf('%PDF-');
  if (header < 0 || header > 1024 || /\S/.test(src.slice(0, header))) return null;
  if (/\/Encrypt\s*\d+\s+\d+\s+R|\/Encrypt\s*<</.test(src.slice(-4096))) return null;
  const objects = readObjects(src, inflate);
  const resolve = (value) => {
    let current = value;
    for (let guard = 0; current instanceof Ref && guard < 16; guard += 1) {
      current = objects.get(current.num)?.value;
    }
    return current;
  };
  resolve.entry = (ref) => objects.get(ref.num);

  // The page tree, in order, each page with the resources it inherits.
  const pages = [];
  const catalog = [...objects.values()].find((entry) => entry.value?.Type?.name === 'Catalog');
  const walk = (node, inherited, depth) => {
    const dict = resolve(node);
    if (!dict || depth > 32 || pages.length >= maxPages) return;
    const resources = dict.Resources !== undefined ? dict.Resources : inherited;
    if (dict.Type?.name === 'Pages' || Array.isArray(resolve(dict.Kids))) {
      for (const kid of resolve(dict.Kids) || []) walk(kid, resources, depth + 1);
      return;
    }
    pages.push({ dict, resources });
  };
  if (catalog) walk(catalog.value.Pages, undefined, 0);
  if (!pages.length) {
    const numbers = [...objects.keys()].sort((a, b) => a - b);
    for (const num of numbers) {
      const value = objects.get(num).value;
      if (value?.Type?.name === 'Page' && pages.length < maxPages) pages.push({ dict: value, resources: value.Resources });
    }
  }

  const out = [];
  for (const page of pages) {
    const fontDict = resolve(resolve(page.resources)?.Font) || {};
    const cache = new Map();
    const decoders = (name) => {
      if (!cache.has(name)) cache.set(name, fontDecoder(fontDict[name], resolve, inflate));
      return cache.get(name);
    };
    let content = '';
    for (const ref of [].concat(page.dict.Contents ?? [])) {
      const entry = ref instanceof Ref ? objects.get(ref.num) : null;
      const target = entry?.value;
      if (Array.isArray(target)) {
        for (const inner of target) {
          const part = inner instanceof Ref ? objects.get(inner.num) : null;
          const data = part?.stream !== null && part?.stream !== undefined
            ? decodeStream(part.value, part.stream, inflate) : null;
          if (data !== null) content += `${data}\n`;
        }
        continue;
      }
      const data = entry?.stream !== null && entry?.stream !== undefined
        ? decodeStream(entry.value, entry.stream, inflate) : null;
      if (data !== null) content += `${data}\n`;
    }
    out.push({ runs: runContent(content, decoders, wordGapEm, columnEdges) });
  }
  return { pages: out };
}
