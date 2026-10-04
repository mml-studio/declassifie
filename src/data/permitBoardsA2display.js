/**
 * Communes whose legal board is an A2Display kiosk (« Borne Tactile »): its
 * categories answer as JSON at `api.a2display.fr/category/<id>`, every object
 * ever posted with its name, its posting time (`start`) and its file, served
 * at `api.a2display.fr/file?filename=<name>`. One protocol (`a2display-kiosk`)
 * reads the categories a commune names in `source.categories`, its orders one
 * per object. Cergy's A2Display board (a `cvv` key, weekly lists) keeps its
 * own reader (`permitBoardsLists.js`).
 *
 * Chemillé-en-Anjou names each order `2026_ARR_U544_PC2600100_[name]_7_BILANGE_CA`:
 * the act's number, the dossier's (`PC2600100` = PC 049 092 26 00100), the
 * applicant, the site and the delegated commune's two letters. The number is
 * taken, and a site from its house number on, the trailing code dropped;
 * never the name. The PDF, typed, is read by `dematdoc-notice` for the filing
 * day, the site, the parcels and the verdict. The category holds every order
 * since 2020 (9.7 MB on 2026-10-03); only those posted in the window are kept.
 *
 * A legal display (« Affichage légal », a `cvv` key) answers the same objects
 * at `api.a2display.fr/cvv/documents/<key>`, newest first, a category at a
 * time (`fc`). A second protocol (`a2display-display`) reads the categories
 * a commune names there, `source.display` its key. Saint-Étienne-au-Mont
 * posts every step of a dossier as its own file under « Urbanisme » (8137),
 * the step and the site in its name: `DP 26-59 Demande - 49 rue du Calvaire`,
 * `DP 26-59 Décision 49 Rue du Calvaire`, `DP 26-28 Décision Refus 54 Rue du
 * Dr Brousse`, `PC 25-05 M 01 Décision 40 Rue Sené Porion-tampon`. Its
 * requests are the whole application (15 MB, the applicant's form) and its
 * decisions scans whose number OCR misreads; the name says the number, the
 * site and, for a refusal, the verdict. So the rows are the names': a
 * request is a filing, a decision is « Décision signée » unless its name
 * says more; the other steps (completeness, ABF opinion, time limits,
 * missing papers) and the certificates are left. The site is taken from its
 * house number or its way on, never what precedes it. 300 objects reached
 * back to March 2026 on 2026-10-04.
 */
import { municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';

const API = 'https://api.a2display.fr';
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** A name's dossier, `PC2600100` spelled out with the commune's code, else a written one. */
export function a2displayDossier(name, city) {
  const words = clean(String(name ?? '').replace(/_/g, ' '));
  const glued = /\b(PC|DP|PA|PD)(\d{2})(\d{5})(?:\s*([MT])(\d{1,2}))?\b/i.exec(words);
  if (glued) {
    const [, kind, year, counter, step, stepNumber] = glued;
    return `${kind.toUpperCase()} ${city.insee.padStart(6, '0')} ${year} ${counter}${step ? ` ${step.toUpperCase()}${stepNumber.padStart(2, '0')}` : ''}`;
  }
  return municipalDossier(words, city);
}

/** A name's site from its house number on, without the delegated commune's code, or null. */
export function a2displaySite(name) {
  const words = clean(String(name ?? '').replace(/_/g, ' ')).split(' ');
  const number = words.findIndex((word, i) => i > 0 && /^\d{1,4}(?:BIS|TER)?$/i.test(word)
    && !/^(?:PC|DP|PA|PD|U\d+|ARR|\d{4})$/i.test(words[i - 1]) && i + 1 < words.length);
  if (number < 0) return null;
  const rest = words.slice(number);
  while (rest.length > 2 && /^(?:[A-Z]{2}(?:-\d)?|-?\d)$/.test(rest.at(-1))) rest.pop();
  const site = clean(rest.join(' ').replace(/-\d+$/, ''));
  return site.length >= 6 ? site : null;
}

/** The day a kiosk time (`{ date: 'YYYY-MM-DD hh:mm:ss', timezone: 'UTC' }`) falls on in France. */
function kioskDay(time) {
  const iso = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/.exec(String(time?.date ?? ''));
  if (!iso) return null;
  const at = new Date(`${iso[1]}T${iso[2]}Z`);
  return Number.isNaN(at.getTime()) ? null : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(at);
}

/** The order files of a category's objects, posted from `since` to `day`. */
export function a2displayFiles(city, objects, since, day = null) {
  const files = [];
  for (const object of objects) {
    const published = kioskDay(object?.start);
    const file = object?.file?.name;
    if (!published || published < since || (day && published > day) || object.isArchived || object.deleteDatetime) continue;
    if (!/^[\w.-]+\.pdf$/i.test(file ?? '')) continue;
    const dossier = a2displayDossier(object.name, city);
    if (!dossier) continue;
    const site = a2displaySite(String(object.name).split(/_(?:PC|DP|PA|PD)\d{7}(?:[MT]\d{1,2})?_/i).at(-1));
    files.push({
      url: `${API}/file?filename=${encodeURIComponent(file)}`, board: 'decisions', layout: 'dematdoc-notice', published, ocr: true,
      row: { board: 'decisions', dossier, applicant: null, ...(site ? municipalSite(site, city) : { address: null, postcode: city.postcode }),
        postedOn: published, verdict: messages.definition.signed.fr },
    });
  }
  return [...new Map(files.map((file) => [file.url, file])).values()];
}

// i18n-ignore-start — the commune's own names for a dossier's steps, and street words
const STEP_NAME = /^(PC|DP|PA|PD)\s*(\d{2})\s*-\s*(\d{1,5})(?:\s*([MT])\s*(\d{1,2}))?\s*@?\s*-?\s*(Demande|D[ée]cision)\b(.*)$/i;
const WAY = 'rue|route|chemin|avenue|all[ée]e|impasse|place|boulevard|quai|cit[ée]|r[ée]sidence|lotissement|square|sentier|ruelle|voie|hameau';
// A way ends where its word does: `Cité` ends on a letter `\b` does not know.
const SITE_START = new RegExp(`(?<![\\p{L}\\d])(?:\\d{1,4}(?:\\s?(?:bis|ter))?\\s+)?(?:${WAY})(?![\\p{L}\\d])`, 'iu');
const NOT_A_DOSSIER_NAME = /\bCU[a-z]?\b|COMPL[ÉE]TUDE|AVIS|D[ÉE]LAIS?|PI[ÈE]CES|MAJO|COURRIER|R[ÉE]C[ÉE]PISS[ÉE]/i;
// i18n-ignore-end

/**
 * The row a legal display's name says, for a request or a decision, or
 * null: `DP 26-59 Décision 49 Rue du Calvaire` → DP 062 746 26 00059 at
 * 49 Rue du Calvaire, « Décision signée ».
 */
export function a2displayStepRow(city, name, published) {
  const words = clean(name);
  const step = STEP_NAME.exec(words);
  if (!step) return null;
  const [, kind, year, counter, part, partNumber, verb, rest] = step;
  const before = rest.split(SITE_START)[0];
  if (NOT_A_DOSSIER_NAME.test(before)) return null;
  const at = SITE_START.exec(rest);
  const site = at ? clean(rest.slice(at.index).replace(/-?\s*tampon\b.*$/i, '').replace(/\s*\(\d+\)\s*$/, '')
    .replace(/[\s,;-]+$/, '')) : '';
  if (site.length < 6) return null;
  const board = /^demande$/i.test(verb) ? 'filings' : 'decisions';
  const dossier = `${kind.toUpperCase()} ${city.insee.padStart(6, '0')} ${year} ${counter.padStart(5, '0')}${part ? ` ${part.toUpperCase()}${partNumber.padStart(2, '0')}` : ''}`;
  return {
    board, dossier, applicant: null, ...municipalSite(site, city), postedOn: published,
    ...(board === 'decisions' ? { verdict: municipalVerdict(before) ?? messages.definition.signed.fr } : {}),
  };
}

/** The rows of a legal display's objects posted from `since` to `day`, one per board and dossier. */
export function a2displayStepRows(city, items, since, day = null) {
  const rows = new Map();
  for (const item of items) {
    const published = kioskDay(item?.start);
    if (!published || published < since || (day && published > day) || item.isArchived || item.deleteDatetime) continue;
    const row = a2displayStepRow(city, item.name, published);
    const key = row && `${row.board}|${row.dossier}`;
    if (row && !(rows.get(key)?.postedOn > published)) rows.set(key, row);
  }
  return [...rows.values()];
}

const a2displayDisplayProtocol = {
  start: (city) => (city.source?.categories ?? []).map((id) => ({
    url: `${API}/cvv/documents/${city.source.display}?l=300&s=creationDatetime&d=desc&fc=${id}&fo=true&fa=true`, as: 'json',
  })),
  index(city, body, request, { since, day } = {}) {
    const items = body?.data?.items;
    if (!Array.isArray(items)) return null;
    return { rows: a2displayStepRows(city, items, since, day) };
  },
};

const a2displayKioskProtocol = {
  start: (city) => (city.source?.categories ?? []).map((id) => ({ url: `${API}/category/${id}`, as: 'json' })),
  index(city, body, request, { since, day } = {}) {
    const objects = body?.data?.objects;
    if (!Array.isArray(objects)) return null;
    return { files: a2displayFiles(city, objects, since, day) };
  },
};

export const A2DISPLAY_BOARD_PROTOCOLS = Object.freeze({
  'a2display-kiosk': Object.freeze(a2displayKioskProtocol),
  'a2display-display': Object.freeze(a2displayDisplayProtocol),
});
