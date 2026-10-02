/**
 * Boards that post one PDF per dossier: Antony's Dematii board, La
 * Roche-sur-Yon's acts portal and Poissy's register of acts. Each index is
 * one request (Antony, La Roche) or one per month (Poissy); each dossier is a
 * file read once. The applicant's block — name and home address, printed
 * above the site on every one of these forms — is never read: each reader
 * takes the labelled site, parcels, dates and the operative article only.
 */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
/** `municipalSite`, without the dash a form leaves before its postcode. */
const siteOf = (value, city) => {
  const site = municipalSite(value, city);
  return { ...site, address: clean(String(site.address ?? '').replace(/[\s\-–—,;:]+$/, '')) || null };
};
const KINDS = ['PC', 'DP', 'PA', 'PD', 'CU'];

/** Runs grouped on their baseline, split where a column gap opens. */
function pageSegments(page, gap = 24) {
  const lines = [];
  for (const run of [...(page?.runs ?? [])].sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (!clean(run.text)) continue;
    const previous = lines.at(-1);
    if (previous && Math.abs(previous.y - run.y) < 2) previous.runs.push(run);
    else lines.push({ y: run.y, runs: [run] });
  }
  const segments = [];
  for (const line of lines) {
    let current = null;
    for (const run of line.runs.sort((a, b) => a.x - b.x)) {
      const end = current?.runs.at(-1);
      if (current && run.x - (end.x1 ?? end.x + String(end.text).length * 4) <= gap) current.runs.push(run);
      else segments.push(current = { y: line.y, x: run.x, runs: [run] });
    }
  }
  // OCR reads the frame of a field as `|` or `[`; it is never part of a value.
  return segments.map((segment) => ({ ...segment,
    text: clean(segment.runs.map((run) => run.text).join(' ').replace(/[|¦]|\[(?=\d)/g, ' ')) })).filter((segment) => segment.text);
}

/** All pages' lines, columns joined, in reading order. */
function documentText(document) {
  return (document?.pages ?? []).flatMap((page) => {
    const lines = [];
    for (const segment of pageSegments(page, Infinity)) lines.push(segment.text);
    return lines;
  }).join('\n');
}

/** `BZ0207`, `0D36`, `191 DO 204` → `BZ 207`, `D 36`, `DO 204`. */
function parcelList(value) {
  const found = [...clean(value).toUpperCase().matchAll(/(?:^|[\s,;])(?:\d{3}\s+)?0?([A-Z]{1,2})\s*0*(\d{1,4})\b/g)]
    .map((match) => `${match[1]} ${match[2]}`);
  return found.length ? [...new Set(found)].join(', ') : null;
}

/** `2 808.60`, `99,16` → `2808.60`, `99.16`. */
function area(value) {
  const raw = String(value ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  return /^\d+(?:\.\d+)?$/.test(raw) && Number(raw) > 0 ? raw : null;
}

/** A French date as the reader prints it, `26/09/2026` or `2 SEP. 2026`. */
function strictDate(value) {
  const numeric = municipalDate(/\d{2}\/\d{2}\/\d{4}/.exec(value ?? '')?.[0]);
  if (numeric) return numeric;
  // Stamped dates come back from OCR as `2 8 SEP. 202%`: only a day, a month
  // word and a year that read whole are taken.
  // i18n-ignore-next-line — French month words in a printed date
  const match = /^\s*(\d{1,2})(?:er)?\s+([a-zéûô]{3,9})\.?,?\s+(20\d{2})\b/i.exec(value ?? '');
  return match ? municipalDate(`${match[1]} ${match[2]} ${match[3]}`) : null;
}

/** A decision's date only when it falls within the year before its posting. */
function plausibleDecision(date, file) {
  if (!date) return null;
  const posted = file.published ?? file.row?.postedOn;
  if (!posted) return date;
  const days = (Date.parse(posted) - Date.parse(date)) / 86_400_000;
  return days >= 0 && days <= 366 ? date : null;
}

/**
 * The first sentence of a project's own words, 200 characters at most: the
 * applicant writes this field, and past the works it tells their story
 * (« Etant propriétaire bailleur, j'ai… », Antony, 1 Oct 2026).
 */
function purposeOf(lines) {
  // A glyph the PDF cannot map ends what can be read of the sentence.
  let value = clean(lines.join(' ').replace(/\uFFFD[\s\S]*$/, '')).replace(/^[\s:;,.\-–]+/, '').replace(/\s+([,.])/g, '$1');
  value = value.replace(/^(.{20,}?[.!?])\s+(?=\p{Lu})[\s\S]*$/u, '$1');
  if (!value) return null;
  return value.length > 200 ? `${value.slice(0, 199).replace(/\s+\S*$/, '')}…` : value;
}

/** The operative article, else the heading, else what the index said: never a grant inferred. */
function decisionVerdict(body, heading, fallback) {
  // i18n-ignore-next-line — the words of a French arrêté's operative article
  const article = /\bArticle\s+(?:1(?:er)?|unique)\b\s*[:.\-–]?([\s\S]{0,500}?)(?=\bArticle\s+\d|$)/i.exec(body)?.[1];
  return municipalVerdict(article) ?? municipalVerdict(heading) ?? fallback ?? verdicts.signed.fr;
}

/** OCR's `MOL`, `MO1`, `MO02` for a modification's `M01`, `M02`. */
function ocrDossierText(value) {
  return String(value ?? '').replace(/\b([MT])[O0o]{1,2}([1-9lIL])\b/g, (whole, kind, digit) => `${kind}0${/\d/.test(digit) ? digit : '1'}`)
    .replace(/(\d)\/([MT]\d)/g, '$1 $2');
}

// i18n-ignore-start — the French labels, headings and verdicts of the boards read
// --- Antony: Dematii web light ----------------------------------------------

const ANTONY_API = 'https://affichages-legaux.ville-antony.fr/pardiffusion/dematii-web';
const ANTONY_BOARDS = Object.freeze({
  'Urbanisme > Autorisations d’urbanisme dépôt': 'filings',
  "Urbanisme > Autorisations d'urbanisme dépôt": 'filings',
  'Urbanisme > Autorisations d’urbanisme décision': 'decisions',
  "Urbanisme > Autorisations d'urbanisme décision": 'decisions',
});

/** A Dematii timestamp as the day it is in Paris. */
function parisDay(ms) {
  const date = new Date(Number(ms));
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/**
 * Antony posts every legal notice in one Dematii list: 2 070 entries on
 * 2026-10-01, 692 of them avis de dépôt (about 700 a year, text PDFs) and 84
 * decisions (about 70 a year, scanned one-page extracts). The list answers
 * one POST and names each file by its UUID. File names are « applicant -
 * address »: they are never read.
 */
const antonyProtocol = Object.freeze({
  start: () => [{ url: ANTONY_API, as: 'json', method: 'POST', body: JSON.stringify({ sortBy: 1 }),
    headers: { 'Content-Type': 'application/json' } }],
  index(city, body, request, { since, day }) {
    if (!Array.isArray(body) || !body.length || !body.every((item) => item && typeof item === 'object' && 'categoryLabel' in item)) return null;
    const files = [];
    for (const item of body) {
      const board = ANTONY_BOARDS[clean(item.categoryLabel)];
      const published = parisDay(item.releaseDate);
      if (!board || !published || published < since || (day && published > day)) continue;
      if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(item.uuid ?? '')) continue;
      files.push({ url: `${ANTONY_API}/download/${item.uuid.toLowerCase()}`, board, published,
        layout: board === 'filings' ? 'antony-filing' : 'antony-decision', ...(board === 'decisions' ? { scan: true } : {}) });
    }
    return { files };
  },
});

/**
 * Antony's avis de dépôt: labels on the left, values on the right in one
 * flowing column — the applicant and their home address, the nature (up to
 * thirteen lines), the land area, the site, the parcel. So the site is what
 * lies between the land area's line and the parcel's, never what lies above
 * the nature; the nature starts on its label's line.
 */
export function readAntonyFiling(document, { city, file }) {
  const page = document?.pages?.[0];
  const segments = pageSegments(page);
  if (!segments.length) return [];
  const width = page.width ?? 595.28;
  const labels = segments.filter((segment) => segment.x < width * 0.4);
  const values = segments.filter((segment) => segment.x >= width * 0.4);
  const label = (pattern) => labels.find((segment) => pattern.test(segment.text));
  const on = (anchor) => (anchor ? values.filter((segment) => Math.abs(segment.y - anchor.y) < 3).map((segment) => segment.text).join(' ') : null);
  const dossier = municipalDossier(segments.find((segment) => /^Dossier num[ée]ro/i.test(segment.text))?.text, city);
  const site = label(/^Sis [àa] l.adresse/i);
  const parcel = label(/^Parcelle/i);
  const land = label(/^Superficie du terrain/i);
  const nature = label(/^Nature du projet/i);
  if (!dossier || !site || !parcel) return [];
  const top = land?.y ?? site.y + 14;
  const siteLines = values.filter((segment) => segment.y < top - 2 && segment.y > parcel.y + 2)
    .map((segment) => segment.text).filter((text) => !/^(?:\d{5}\s+)?ANTONY$/i.test(text));
  const address = siteLines.join(' ');
  if (!/\p{L}/u.test(address)) return [];
  const natureLines = nature ? values.filter((segment) => segment.y <= nature.y + 2 && segment.y > top + 2) : [];
  return [{ board: 'filings', dossier, applicant: null, ...siteOf(address, city),
    parcels: parcelList(on(parcel)), purpose: purposeOf(natureLines.map((segment) => segment.text)),
    filedOn: municipalDate(on(label(/^Date d.enregistrement/i))), landArea: area(/^([\d\s.,]+)\s*m/.exec(on(land) ?? '')?.[1]),
    postedOn: municipalDate(on(label(/^Affichage du/i))) ?? file.published ?? null }];
}

/**
 * Antony's decisions are a one-page « extrait d'arrêté », scanned: « Par
 * arrêté municipal en date du … le permis de construire n° PC 92002 26 A0029
 * est accordé à [applicant] demeurant [their address], en vue de [works] sur
 * un terrain situé [site] ». The applicant and their address sit between
 * « accordé à » and « en vue de »: only what follows is read. The date is a
 * stamp OCR rarely reads whole; it is kept only when it does.
 */
export function readAntonyDecision(document, { city, file }) {
  const body = documentText(document);
  if (!body) return [];
  const paragraph = clean(/Par arr[êe]t[ée][\s\S]*?(?=Toute personne|$)/i.exec(body)?.[0] ?? body);
  const dossier = municipalDossier(ocrDossierText(paragraph), city);
  const site = /sur un terrain (?:situ[ée]e?|sis)\s+(?:au\s+|[àa]\s+)?(.+?)(?:,?\s*\d{5}\b|\.\s*$|$)/i.exec(paragraph)?.[1];
  if (!dossier || !site || !/\p{L}/u.test(site)) return [];
  const heading = body.split(/\bPar arr[êe]t[ée]/i)[0];
  const signed = /Antony,\s*le\s+([^\n]+)/i.exec(body)?.[1];
  return [{ board: 'decisions', dossier, applicant: null, ...siteOf(site, city),
    purpose: purposeOf([/en vue d[e'’]\s*([\s\S]+?)\s+sur un terrain (?:situ|sis)/i.exec(paragraph)?.[1] ?? '']),
    verdict: municipalVerdict(heading) ?? verdicts.signed.fr,
    decidedOn: plausibleDecision(strictDate(signed), file), postedOn: file.published ?? null }];
}

// --- La Roche-sur-Yon: one WordPress page of acts ---------------------------

/** `…_2026-Ville-4178-dp-26-00480.pdf`, `…-pc24y0146m01.pdf`, `…-dp-26-00466-arrete.pdf`. */
const LA_ROCHE_FILE = /\/wp-content\/uploads\/(\d{4})-(\d{2})-(\d{2})_[^/]*?_(\d{4}-Ville-\d+)-(dp|pc|pa|pd|cu)-?(\d{2})-?([a-z]?\d{4,5})(?:-?([mt])(\d{1,2}))?(?:-[a-z][a-z-]*)?\.pdf$/i;

/**
 * La Roche-sur-Yon lists every act of the city, the agglomeration and their
 * social services on one page: 6 534 links on 2026-10-01, 1 582 acts on
 * permits named by their dossier — 955 in the twelve months to October
 * (693 DP, 201 PC, 39 CU). All the samples read were scans from the town hall's copier, so
 * each file is read by OCR in the daily sweep; until then its row is the
 * file name's number. The same act is linked up to four times, the same
 * bytes each time: the first link is kept.
 */
const laRocheProtocol = Object.freeze({
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, body, request, { since, day }) {
    const html = String(body ?? '');
    if (!/Liste des actes/i.test(html)) return null;
    const files = new Map();
    for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi)) {
      let url;
      try { url = new URL(match[1], city.page); } catch { continue; }
      if (url.origin !== new URL(city.page).origin) continue;
      const name = LA_ROCHE_FILE.exec(decodeURIComponent(url.pathname));
      if (!name) continue;
      const [, year, month, date, act, kind, yy, counter, mod, modNumber] = name;
      const published = municipalDate(match[2]) ?? municipalDate(`${year}-${month}-${date}`);
      if (!published || published < since || (day && published > day) || files.has(act)) continue;
      const number = /^\d+$/.test(counter) ? counter.padStart(5, '0') : counter.toUpperCase();
      const dossier = `${kind.toUpperCase()} ${city.insee.padStart(6, '0')} ${yy} ${number}${mod ? ` ${mod.toUpperCase()}${modNumber.padStart(2, '0')}` : ''}`;
      // The labelled fields are all on page 1: OCR reads no further.
      files.set(act, { url: url.href, board: 'decisions', layout: 'la-roche-sur-yon-decision', published, scan: true, ocrPages: 1,
        row: { board: 'decisions', dossier, applicant: null, address: null, postcode: city.postcode,
          verdict: verdicts.signed.fr, postedOn: published } });
    }
    return files.size || /wp-content\/uploads\/[^"]+\.pdf/i.test(html) ? { files: [...files.values()] } : null;
  },
});

/** The left-hand labels of La Roche-sur-Yon's decision forms. */
const LA_ROCHE_LABELS = [
  // « Surun terrain sie à », as OCR read it on 2026-10-02.
  ['site', /^Sur\s*un\s+terrain\s+(?:sis|situ[ée]e?|si[a-z]?)(?:\s+[àa])?\s*:?\s*/i],
  ['parcels', /^Cadastr[ée]e?s?\s*:?\s*/i],
  // OCR reads « Précisions sur les travaux » as « Précisi one es travaux vau ».
  ['purpose', /^(?:Nature des travaux|Nature de l.op[ée]ration)\s*:?\s*|^Pr[ée]cisi[^:]{0,30}:\s*/i],
  ['filedOn', /^(?:Demande )?d[ée]pos[ée]e?\s+le\s*:?\s*/i],
  ['applicant', /^(?:Par|Demeurant [àa]|Repr[ée]sent[ée]e? par|Type de demande)\s*:?\s*/i],
];

/**
 * La Roche-sur-Yon's decisions, read by OCR: a header of labelled fields
 * (filed on, by, living at, site, cadastre, works) above « LE MAIRE », then
 * the articles and « Fait à LA ROCHE SUR YON, le … ». A value printed on two
 * lines is centred on its label, so each unlabelled line belongs to the
 * label nearest it: the applicant's home address goes to « Demeurant à »,
 * never to the site.
 */
export function readLaRocheDecision(document, { city, file }) {
  const page = document?.pages?.[0];
  const segments = pageSegments(page);
  if (!segments.length) return [];
  const width = page.width ?? 595.28;
  const end = segments.find((segment) => /^(?:LE MAIRE|CERTIFIE)\b/.test(segment.text))?.y ?? -Infinity;
  const header = segments.filter((segment) => segment.y > end + 2);
  const left = header.filter((segment) => segment.x < width * 0.6);
  const fields = [];
  const loose = [];
  for (const segment of left) {
    const found = LA_ROCHE_LABELS.find(([, pattern]) => pattern.test(segment.text));
    if (found) fields.push({ name: found[0], y: segment.y, lines: [{ y: segment.y, text: segment.text.replace(found[1], '') }] });
    else loose.push(segment);
  }
  if (!fields.some((field) => field.name === 'site')) return [];
  for (const segment of loose) {
    if (/^(?:DOSSIER|ARRETE|COMMUNE|LA ROCHE SUR YON|DE LA ROCHE|DESCRIPTION|DECLARATION|PERMIS|CERTIFICAT|N°)\b/i.test(segment.text)) continue;
    const nearest = fields.reduce((best, field) => (Math.abs(field.y - segment.y) < Math.abs(best.y - segment.y) ? field : best));
    // A second line sits 12 points from its label; 25 is the next field's.
    if (Math.abs(nearest.y - segment.y) < 16) nearest.lines.push({ y: segment.y, text: segment.text });
  }
  const value = (name) => fields.filter((field) => field.name === name)
    .flatMap((field) => field.lines).sort((a, b) => b.y - a.y).map((line) => line.text).filter(Boolean);
  const siteLines = value('site');
  const parcels = parcelList([...value('parcels'), ...siteLines.filter((line) => /^\d{3}\s+[A-Z0]{1,2}\s*\d+$/i.test(line))].join(', '));
  // The first line shaped like an address: OCR turns a stamp's or a frame's
  // edge into stray marks (« SI ‘ “ 2 SS 4 ») and misreads the postcode
  // (85090), so the commune's own postcode is used.
  const street = siteLines.find((line) => /^\d{1,4}\s*(?:bis|ter|[a-d])?[\s,]+\p{L}{2,}/iu.test(line)
    || /^(?:rue|impasse|avenue|boulevard|bd|chemin|route|all[ée]e|place|square|quai|cours|passage|voie|sentier|rond-point|lieu-dit|hameau|lotissement|r[ée]sidence|zone|zac?|zi|parc|la|le|les)\b/i.test(line));
  const address = clean(String(street ?? '').replace(/[\s,]+\d{5}\b.*$/, '').replace(/\s+LA ROCHE[- ]SUR[- ]YON\b.*$/i, ''));
  if (!/\p{L}{3}/u.test(address)) return [];
  const headText = header.map((segment) => segment.text).join('\n');
  const dossier = file.row?.dossier ?? municipalDossier(ocrDossierText(headText), city);
  if (!dossier) return [];
  const body = documentText(document);
  const right = header.filter((segment) => segment.x >= width * 0.6).map((segment) => segment.text).join('\n');
  return [{ board: 'decisions', dossier, applicant: null, ...siteOf(address, city), postcode: city.postcode, parcels,
    purpose: purposeOf(value('purpose')),
    filedOn: municipalDate(value('filedOn').join(' ')) ?? municipalDate(/d[ée]pos[ée]e?\s+le\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(headText)?.[1]),
    floorArea: area(/Surface de plancher\s*:?\s*([\d\s.,]+)/i.exec(right)?.[1]?.trim()),
    landArea: area(/Superficie\s*:?\s*([\d\s.,]+)/i.exec(right)?.[1]?.trim()),
    verdict: decisionVerdict(body, headText.split('\n').slice(0, 6).join(' ')),
    decidedOn: plausibleDecision(strictDate(/Fait [àa] [^,\n]*,\s*le\s+([^\n]+)/i.exec(body)?.[1]), file),
    postedOn: file.published ?? null }];
}

// --- Poissy: the register of acts ------------------------------------------

/** The register's own type for urbanism acts (`typedoc_filter`). */
const POISSY_URBANISM = 7;

/** The months from `since` to `day`, as `YYYYMM`. */
function monthsBetween(since, day) {
  const out = [];
  let [year, month] = since.split('-').map(Number);
  const [lastYear, lastMonth] = String(day ?? since).split('-').map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    out.push(`${year}${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return out;
}

const decodeHtml = (value) => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|nbsp|lt|gt|eacute|egrave|ecirc|agrave|ccedil|rsquo);/gi, (whole, name) => {
    if (name[0] === '#') return String.fromCodePoint(Number.parseInt(name.slice(name[1].toLowerCase() === 'x' ? 2 : 1), name[1].toLowerCase() === 'x' ? 16 : 10));
    return { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ccedil: 'ç', rsquo: '’' }[name.toLowerCase()];
  });

/**
 * Poissy's register of acts is one server-rendered table (2 930 rows on
 * 2026-10-01); its form filters by type and by the act's number, so one POST
 * per month asks for that month's urbanism acts only — 60 rows, 150 kB,
 * instead of the 6 MB page. A row reads « DP26Y0167 [applicant] arrêté
 * favorable avec prescriptions »: the number and the verdict are taken, the
 * name between them never. Only files the city marks as published are read
 * (`uploads/`, not `uploads/originals/`, where the certificates it does not
 * publish sit): 186 files in 2025, 188 from January to September 2026,
 * a few of them scans.
 */
const poissyProtocol = Object.freeze({
  start: (city, { since, day }) => monthsBetween(since, day).map((month) => ({
    url: city.page, as: 'html', method: 'POST',
    body: new URLSearchParams({ typedoc_filter: String(POISSY_URBANISM), service_filter: '', numero_filter: `URBA_${month}`, year_filter: '' }).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })),
  index(city, body, request, { since }) {
    const html = String(body ?? '');
    if (!/id="dataTableDocuments"/.test(html)) return null;
    const files = [];
    for (const block of html.split(/<tr\b[^>]*>/i).slice(1)) {
      const cells = [...block.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
      if (cells.length < 9 || clean(decodeHtml(cells[0])) !== 'Urbanisme') continue;
      const ref = /^URBA_(\d{4})(\d{2})(\d{2})_\d+$/.exec(clean(decodeHtml(cells[1])));
      const subject = clean(decodeHtml(cells[4]));
      if (!ref || !new RegExp(`^(?:${KINDS.join('|')})\\b|^(?:${KINDS.join('|')})\\d`, 'i').test(subject)) continue;
      const href = /href="(\.\/uploads\/URBA_\d{8}_\d+\.pdf)"/i.exec(cells[5])?.[1];
      if (!href) continue;
      // « DP26Y136 »: Sitadel writes the counter on four digits, Y0136.
      const dossier = municipalDossier(ocrDossierText(subject), city)?.replace(/^(\S+ \d{6} \d{2} )([A-Z])(\d{1,3})(?= |$)/, (whole, head, letter, digits) => `${head}${letter}${digits.padStart(4, '0')}`);
      if (!dossier) continue;
      const published = municipalDate(clean(decodeHtml(cells[8]))) ?? `${ref[1]}-${ref[2]}-${ref[3]}`;
      if (published < since) continue;
      files.push({ url: new URL(href, city.page).href, board: 'decisions', layout: 'poissy-decision', published, ocr: true,
        row: { board: 'decisions', dossier, applicant: null, address: null, postcode: city.postcode,
          // Only the closing words: the applicant's name sits before them.
          verdict: municipalVerdict(/\b(?:arr[êe]t[ée]\s+)?(?:d[ée]favorable|favorable|accord|refus|non[- ]opposition|opposition|retrait)\b[^\n]*$/i.exec(subject)?.[0]) ?? verdicts.signed.fr,
          decidedOn: municipalDate(clean(decodeHtml(cells[2]))), postedOn: published } });
    }
    return { files };
  },
});

/** Poissy's field labels, which end a multi-line value. */
const POISSY_STOP = /^(?:R[ée]f[ée]rences? cadastrales?|Par\s*:|Pour\s*:|Destination|Surfaces?\b|Dossier|D[ée]pos[ée]|Compl[ée]t[ée]|Affich[ée]|Arr[êe]t[ée]|Adresse|date de d[ée]p[ôo]t|demandeur|°|Le Maire|VU\b)/i;

/** A labelled value of Poissy's form, in its own column, down to the next label. */
function poissyField(segments, pattern, width) {
  const label = segments.find((segment) => pattern.test(segment.text));
  if (!label) return null;
  const inLeft = label.x < width * 0.45;
  const column = segments.filter((segment) => (inLeft ? segment.x < width * 0.5 : segment.x >= label.x - 12) && segment.y < label.y - 1);
  const lines = [label.text.replace(pattern, '')];
  let last = label.y;
  for (const segment of column) {
    if (POISSY_STOP.test(segment.text) || last - segment.y > 18 || lines.length >= 12) break;
    lines.push(segment.text);
    last = segment.y;
  }
  return lines.map(clean).filter(Boolean);
}

/**
 * Poissy's arrêtés, from the urbanism software: a frame of fields (dossier,
 * filed on, by — the applicant and their address —, for, site, cadastre) in
 * two columns, then the recitals and the articles. The site is read in its
 * own column down to the next label, so the applicant's address beside or
 * above it is never taken. The State's own forms (« au nom de l'État ») say
 * « adresse terrain ».
 */
export function readPoissyDecision(document, { city, file }) {
  const SITE = /^Adresse (?:du )?terrain\s*:?\s*/i;
  const pages = (document?.pages ?? []).map((page) => ({ page, segments: pageSegments(page) }));
  const framed = pages.find(({ segments }) => segments.some((segment) => SITE.test(segment.text)));
  if (!framed) return poissyLetter(pages[0]?.segments ?? [], { city, file });
  const { page, segments } = framed;
  const width = page.width ?? 595.28;
  const site = poissyField(segments, SITE, width);
  const address = clean(site?.join(' ')).replace(/,?\s*[àa]\s+Poissy\b.*$/i, '').replace(/\s*\((\d{5})\)\s*$/, ' $1');
  if (!/\p{L}/u.test(address)) return [];
  const mayor = segments.find((segment) => /^Le Maire\b/i.test(segment.text))?.y ?? -Infinity;
  const head = segments.filter((segment) => segment.y > mayor + 2).map((segment) => segment.text).join('\n');
  const dossier = municipalDossier(ocrDossierText(/Dossier n°\s*([^\n]+)/i.exec(head)?.[1] ?? head), city) ?? file.row?.dossier;
  if (!dossier) return [];
  const body = documentText(document);
  const surfaces = segments.filter((segment) => segment.x >= width * 0.45).map((segment) => segment.text).join('\n');
  const parcels = /R[ée]f[ée]rences? cadastrales?\s*:?\s*([^\n]+)/i.exec(head)?.[1];
  return [{ board: 'decisions', dossier, applicant: null, ...siteOf(address, city), parcels: parcelList(parcels),
    purpose: purposeOf(poissyField(segments, /^Pour\s*:\s*/i, width) ?? []),
    filedOn: municipalDate(/(?:D[ée]pos[ée]e? le|date de d[ée]p[ôo]t)\s*:?\s*([^\n]+)/i.exec(head)?.[1]),
    floorArea: area(/Cr[ée]{2}es?\s*:\s*([\d\s.,]+?)\s*m/i.exec(surfaces)?.[1]),
    verdict: decisionVerdict(body, head.split('\n').slice(0, 5).join(' '), file.row?.verdict),
    decidedOn: file.row?.decidedOn ?? null, postedOn: file.published ?? null }];
}
/**
 * Some files are the covering letter alone (« OBJET : DP 78498 26 Y0077 M01 »
 * and the site on the line below), the arrêté left out: 1 of 9 sampled. The
 * letter's addressee block — the applicant — is never read; the verdict is
 * the register's.
 */
function poissyLetter(segments, { city, file }) {
  const at = segments.findIndex((segment) => /^OBJET\s*:/i.test(segment.text));
  if (at < 0) return [];
  const dossier = municipalDossier(ocrDossierText(segments[at].text), city);
  const next = segments.slice(at + 1).find((segment) => segment.x < 200);
  const site = next && /^\d{1,4}\s*(?:bis|ter|[a-d])?\s+\p{L}.*\bPoissy$/iu.test(next.text) ? next.text.replace(/\s+Poissy$/i, '') : null;
  if (!dossier || !site || (file.row?.dossier && file.row.dossier !== dossier)) return [];
  return [{ ...file.row, board: 'decisions', dossier, applicant: null, ...siteOf(site, city),
    verdict: file.row?.verdict ?? verdicts.signed.fr, postedOn: file.published ?? null }];
}
// i18n-ignore-end

/** The protocols of this family, by `source.protocol`. */
export const NOTICE_BOARD_PROTOCOLS = Object.freeze({
  antony: antonyProtocol,
  'la-roche-sur-yon': laRocheProtocol,
  poissy: poissyProtocol,
});

/** The readers its files name, by `layout`. */
export const NOTICE_BOARD_READERS = Object.freeze({
  'antony-filing': readAntonyFiling,
  'antony-decision': readAntonyDecision,
  'la-roche-sur-yon-decision': readLaRocheDecision,
  'poissy-decision': readPoissyDecision,
});

/** No layout here needs its own `extractPdfText` options. */
export const NOTICE_BOARD_TEXT = Object.freeze({});
