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
 */
import { municipalDossier, municipalSite } from './municipalPermitsFeed.js';
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

const a2displayKioskProtocol = {
  start: (city) => (city.source?.categories ?? []).map((id) => ({ url: `${API}/category/${id}`, as: 'json' })),
  index(city, body, request, { since, day } = {}) {
    const objects = body?.data?.objects;
    if (!Array.isArray(objects)) return null;
    return { files: a2displayFiles(city, objects, since, day) };
  },
};

export const A2DISPLAY_BOARD_PROTOCOLS = Object.freeze({ 'a2display-kiosk': Object.freeze(a2displayKioskProtocol) });
