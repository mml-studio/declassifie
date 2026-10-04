/**
 * Communes whose legal board is a Screensoft Docs2Web kiosk, on
 * `screensoft.eu/Docs2Web/<tenant>/` or under their own site: one protocol
 * (`docs2web`) for all of them. The kiosk renders its cards with JavaScript
 * from the tree its page loads as `params.js` — every folder (`theme`,
 * `subtheme`) and document (`paper`) as XML in a script; a paper has a
 * `name`, a `path` to its PDF under `content/`, and the day it was posted
 * (`real_date_debut`, else `date_debut`, else the upload day,
 * `dateFileInAdmin`). Pantin and L'Haÿ-les-Roses, read before this protocol,
 * keep their own readers (`permitBoardsPages.js`, `permitBoardsActs.js`).
 *
 * A paper is read when a folder above it is urbanism and its name names one of
 * the commune's dossiers (`PC0723502600018 - ACCORD AVEC PRESCRIPTIONS - …`,
 * `Arrêté DP 26 0 0039 - 23 rue de Turenne`, `Avis de dépôt DP26 83 [name]
 * 66b rue de Comines`, `DP 03712225J0355` under `ARRETES MUNICIPAUX > DP`).
 * Its board is what its name says, failing that its folders, failing that a
 * decision; certificates, signs, letters and inquiries are not permits the
 * layer draws. The PDF is read by `dematdoc-notice`, by OCR in the daily sweep
 * for scans; meanwhile the name gives the number, a numbered street and the
 * verdict.
 *
 * Applicants: names often carry them. Only the number, a numbered street —
 * from its house number on, never what precedes it — and the verdict's words
 * are taken from a name; never the name itself.
 *
 * A commune's `source` may say more:
 *
 * - `media`: Screensoft's SaaS tenants (`SAAS - 7500 - …`) send `content/` to
 *   their login; the kiosk page itself opens the PDF in Screensoft's media
 *   store, `/frontend/images/MT_medias` + the paper's `fileInAdmin`
 *   (`/7500/<file>.pdf`), and so does this protocol.
 * - `unnamed`: the names say nothing of the dossier — La Valette-du-Var names
 *   each paper after its applicant, Saint-Ismier after its own act
 *   (`DP2026-106DECI` for DP 038 397 26 10106). Every paper of `folders` is
 *   read, its number and site from the PDF alone; nothing is taken from the
 *   name, and the file is known by the paper's QR link (`media.php?params=…`,
 *   stable, naming nobody) while its bytes are asked at its media address.
 * - `folders`: the last folders read, by name; other folders are left alone
 *   (La Valette's receipts, which never print the site).
 * - `layout`: the reader of every file, for a commune that posts lists, not
 *   acts (Saint-Amand-les-Eaux: `grid`). Such lists are text: never OCR'd.
 * - `scans`: every paper is a scan: never downloaded by a visitor's reading,
 *   read by OCR in the daily sweep.
 */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import { readDematdocNotice } from './dematdocFeed.js';
import messages from './municipalPermitsFeed.i18n.js';

const verdicts = messages.definition;
const MEDIA = 'https://www.screensoft.eu/frontend/images/MT_medias';
const QR_LINK = /^https:\/\/www\.screensoft\.eu\/media\.php\?params=[\w%.~-]+$/;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const xmlEntities = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>' };
const xmlText = (value) => String(value ?? '').replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (whole, name) => {
  if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return xmlEntities[name.toLowerCase()] ?? whole;
});

// i18n-ignore-start — the boards' own words, matched on
const URBANISM_FOLDER = /URBANIS|DROIT DES SOLS|AUTORISATIONS? D.URBANISME/;
const SKIPPED = /\bCU\b|CERTIFICAT|ENSEIGNE|PUBLICIT|ENQUETE|COURRIER/;
const FILING = /RECEPISSE|AVIS DE DEPOT|\bDEPOTS?\b/;
const DECISION = /ARRETES?\b|DECISIONS?\b|ACCORD|REFUS|OPPOSITION|FAVORABLE|TACITE|RETRAIT|TRANSFERT|PROROGATION|DELIVRE/;
const OBJECT_LINE = /^OBJET\s*:\s*(.+)$/;
const STREET = 'rue|avenue|av\\.?|boulevard|bd|bvd|place|chemin|all[ée]es?|impasse|route|rte|quai|cours|faubourg|square|sentier|ruelle|passage|r[ée]sidence|lotissement|voie|cit[ée]|clos|hameau|lieu-dit|dr[èe]ve|mont[ée]e|traverse|zac';
const NUMBERED_STREET = new RegExp(`(?:^|\\s)(\\d{1,4}(?:\\s?(?:bis|ter|[a-d]))?\\s*,?\\s+(?:${STREET})\\b.*)$`, 'i');
// What follows the street in a name: another segment, a copy number, the act's words.
const AFTER_STREET = /\s+[-–—]\s.*$|\s*\(.*$|\s+(?:arr[êe]t[ée]|r[ée]c[ée]piss[ée]|d[ée]cision|accord|refus|favorable|d[ée]favorable|opposition|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})(?=\s|$).*$/i;
// i18n-ignore-end

/** A name's numbered street, from its house number on, or null. */
export function docs2webStreet(name) {
  const match = NUMBERED_STREET.exec(clean(name));
  if (!match) return null;
  const street = clean(match[1].replace(AFTER_STREET, '').replace(/[\s,;-]+$/, ''));
  return street.length >= 6 ? street : null;
}

/** Every paper of a `params.js` tree, with the folders above it, or null when the script holds none. */
export function docs2webPapers(script) {
  const xml = String(script ?? '').replace(/\\"/g, '"');
  const stack = [];
  const papers = [];
  for (const [, close, tag, attributes, selfClosing] of xml.matchAll(/<(\/?)(theme|subtheme|paper)\b([^>]*?)(\/?)>/g)) {
    if (close) { if (tag !== 'paper') stack.pop(); continue; }
    const attribute = (name) => clean(xmlText(new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1] ?? ''));
    if (tag !== 'paper') { if (!selfClosing) stack.push(attribute('name')); continue; }
    const posted = municipalDate(attribute('real_date_debut')) ?? municipalDate(attribute('date_debut'))
      ?? municipalDate(attribute('dateFileInAdmin').slice(0, 10));
    papers.push({ folders: [...stack], name: attribute('name'), path: attribute('path'), posted,
      media: attribute('fileInAdmin') || null, qrcode: attribute('qrcode') || null });
  }
  return papers.length ? papers : null;
}

/** Where a paper's PDF is asked: beside the kiosk, or in Screensoft's media store (`media`). */
function paperUrl(city, paper) {
  if (!city.source?.media) return /^\/[^/?#]+\.pdf$/i.test(paper.path) ? new URL(`content${paper.path}`, city.page).href : null;
  return /^\/\d+\/[^/?#]+\.pdf$/i.test(paper.media ?? '') ? `${MEDIA}${paper.media}` : null;
}

/**
 * The permit files of a tree, one per PDF posted from `since` to `day`, each
 * with the row its name gives — none for an `unnamed` commune.
 *
 * @param {object} city One of the Docs2Web communes.
 * @param {Array<object>} papers {@link docs2webPapers}.
 * @param {string} since `YYYY-MM-DD`.
 * @param {string} [day] `YYYY-MM-DD`: a paper scheduled after it is left out.
 */
export function docs2webFiles(city, papers, since, day = null) {
  const { unnamed = false, folders: kept = null, layout = null, scans = false } = city.source ?? {};
  const folderNames = kept ? new Set(kept.map(fold)) : null;
  const files = new Map();
  for (const paper of papers) {
    const folders = fold(paper.folders.join(' > '));
    if (!URBANISM_FOLDER.test(folders) || !paper.posted || paper.posted < since || (day && paper.posted > day)) continue;
    if (folderNames && !folderNames.has(fold(paper.folders.at(-1)))) continue;
    const requestUrl = paperUrl(city, paper);
    if (!requestUrl) continue;
    const name = fold(paper.name);
    if (SKIPPED.test(name) || SKIPPED.test(fold(paper.folders.at(-1)))) continue;
    // Bousbecque types the counter's first digit apart: `DP 26 0 0039`.
    const dossier = unnamed ? null : municipalDossier(paper.name.replace(/\b(\d{2}) (\d) (\d{4})\b/g, '$1 $2$3'), city);
    if (!dossier && !unnamed) continue;
    const inner = fold([...paper.folders].reverse().join(' > '));
    const board = (!unnamed && FILING.test(name)) ? 'filings' : (!unnamed && DECISION.test(name)) ? 'decisions'
      : FILING.exec(inner)?.index < (DECISION.exec(inner)?.index ?? Infinity) ? 'filings'
        : DECISION.test(inner) ? 'decisions' : city.source?.board ?? 'decisions';
    // An unnamed paper is known by its QR link, which names nobody.
    const url = unnamed && QR_LINK.test(paper.qrcode ?? '') ? paper.qrcode : requestUrl;
    const known = files.get(url);
    if (known && known.published <= paper.posted) continue;
    const file = {
      url, board, layout: layout ?? (unnamed ? 'docs2web-act' : 'dematdoc-notice'), published: paper.posted,
      ocr: !layout, ...(scans ? { scan: true } : {}), ...(url !== requestUrl ? { requestUrl } : {}),
    };
    if (dossier) {
      const street = docs2webStreet(paper.name);
      file.row = {
        board, dossier, applicant: null, ...(street ? municipalSite(street, city) : { address: null, postcode: city.postcode }),
        postedOn: paper.posted, ...(board === 'decisions' ? { verdict: municipalVerdict(paper.name) ?? (/\bTACITE\b/.test(name) ? verdicts.tacit.fr : verdicts.signed.fr) } : {}),
      };
    }
    files.set(url, file);
  }
  return [...files.values()];
}

// OCR reads a capital I as a small l: `Saint-lsmier`.
const ocrName = (value) => fold(value).replace(/[^A-Z0-9]+/g, ' ').trim().replace(/L/g, 'I');

/**
 * A site without what OCR leaves after it: Saint-Ismier prints the postcode
 * spaced and the commune after a dash (`357 Chemin du Grand Torrent - 38 330`,
 * `148 chemin de la source - Saint-lsmier`).
 */
function actSite(address, city) {
  if (!address) return address;
  let site = address.replace(/[\s,]*[-–—]+\s*\d{2}\s?\d{3}\b.*$/, '');
  const pieces = site.split(/\s[-–—]+\s/);
  if (pieces.length > 1 && city?.name && ocrName(pieces.at(-1)) === ocrName(city.name)) site = pieces.slice(0, -1).join(' - ');
  return clean(site) || address;
}

/**
 * A Docs2Web act read without its name: the DematDOC act reader, and where
 * it finds no verdict, the one the act's heading or its `Objet` line gives —
 * La Valette's letters (`OBJET : Retrait avant décision d'une Déclaration
 * Préalable`), Saint-Ismier's certificates (`CERTIFICAT DE NON OPPPOSITION A
 * UNE DEMANDE DE DECLARATION PREALABLE TACITE`). A certificate of urbanism
 * is not a permit the layer draws.
 */
export function readDocs2webAct(document, context) {
  const rows = readDematdocNotice(document, context).filter((row) => !/^CU\b/i.test(row.dossier ?? ''))
    .map((row) => ({ ...row, address: actSite(row.address, context?.city) }));
  if (!rows.some((row) => row.board === 'decisions' && row.verdict === verdicts.signed.fr)) return rows;
  const runs = [...(document?.pages?.[0]?.runs ?? [])].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const run of runs) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - run.y) < 2.5) line.text += ` ${run.text}`;
    else lines.push({ y: run.y, text: String(run.text ?? '') });
  }
  const head = lines.slice(0, 30).map((line) => fold(line.text));
  const object = head.map((line) => OBJECT_LINE.exec(line)?.[1]).find(Boolean);
  const verdict = (object && municipalVerdict(object))
    ?? (head.slice(0, 12).some((line) => /\bCERTIFICAT\b/.test(line)) && head.slice(0, 12).some((line) => /\bTACITE\b/.test(line)) ? verdicts.tacit.fr : null);
  return verdict ? rows.map((row) => (row.board === 'decisions' && row.verdict === verdicts.signed.fr ? { ...row, verdict } : row)) : rows;
}

const docs2webProtocol = {
  start(city) {
    return [{ url: new URL('params.js', city.page).href, as: 'text' }];
  },
  index(city, script, request, { since, day } = {}) {
    const papers = docs2webPapers(script);
    return papers ? { files: docs2webFiles(city, papers, since, day) } : null;
  },
};

export const DOCS2WEB_BOARD_PROTOCOLS = Object.freeze({ docs2web: Object.freeze(docs2webProtocol) });
export const DOCS2WEB_BOARD_READERS = Object.freeze({ 'docs2web-act': readDocs2webAct });
// The DematDOC reader's own spacing, for an act that is text.
export const DOCS2WEB_BOARD_TEXT = Object.freeze({ 'docs2web-act': Object.freeze({ wordGapEm: 0.15 }) });
