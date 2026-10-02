/**
 * Brive's public WEBDEV document board: discover its session, menus, folders
 * and four permit tables. The server sends HTML inside JavaScript strings
 * inside XML; only string literals are read, never the JavaScript executed.
 * Folder and file IDs are discovered afresh, not permanent source identifiers.
 * Pure, with no browser, DOM or requests.
 */

function entities(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return String(value ?? '').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, name) => {
    if (name[0] !== '#') return named[name.toLowerCase()] ?? whole;
    const code = Number.parseInt(name.slice(/^#x/i.test(name) ? 2 : 1), /^#x/i.test(name) ? 16 : 10);
    return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

function words(value) {
  return entities(String(value).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map((m) => [m[1].toLowerCase(), entities(m[2] ?? m[3])]));
}

/** The public portal link on the municipality's stable source page. */
export function webdevPortalUrl(city, html) {
  const expected = new URL(city.source.portal);
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*>/gi)) {
    let url;
    try { url = new URL(attributes(match[0]).href, city.page); } catch { continue; }
    if (url.origin === expected.origin && url.pathname === expected.pathname
      && !url.username && !url.password && url.searchParams.get('site')) {
      url.hash = '';
      return url.href;
    }
  }
  return null;
}

/** Indexed menu labels, from the initial HTML or a WEBDEV XML response. */
export function webdevMenu(body, labelField) {
  const pattern = new RegExp(`<div\\b[^>]*\\bid=["']zrl_(\\d+)_${labelField}["'][^>]*>([\\s\\S]*?)<\\/div>`, 'gi');
  return [...String(body ?? '').matchAll(pattern)].map((m) => ({ value: m[1], title: words(m[2]) }));
}

/** An anonymous session's POST target, restricted to this portal's origin. */
export function webdevSession(city, html, portal) {
  const form = /<form\b[^>]*>/i.exec(String(html ?? ''));
  if (!form) return null;
  const publisher = webdevMenu(html, 'A39').find((item) => item.title === city.source.publisher);
  const action = attributes(form[0]).action;
  let url;
  try { url = new URL(action, portal); } catch { return null; }
  if (!publisher || !action || url.origin !== new URL(portal).origin
    || !/^\/service30_publication_reglementaire\/PAGE_accueil_publication_document_html\/[^/]+$/i.test(url.pathname)
    || url.username || url.password) return null;
  return { url: url.href, publisher: publisher.value };
}

/** The small form subset the board needs; no applicant or generated script. */
export function webdevRequestBody(session, { context, category = '1', year = '1', folder = '' }) {
  return new URLSearchParams({
    WD_ACTION_: 'AJAXPAGE', EXECUTE: '16', WD_CONTEXTE_: context,
    WD_JSON_PROPRIETE_: '', WD_BUTTON_CLICK_: '',
    A35: session.publisher, A5: category, A42: year, A14: year,
    A61: '1', A62: '1', A19: folder,
  }).toString();
}

/** Year option values are their positions, not the printed calendar year. */
export function webdevYears(xml) {
  const field = /<CHAMP\b[^>]*\bALIAS="A42"[^>]*>([\s\S]*?)<\/CHAMP>/i.exec(String(xml ?? ''));
  if (!field) return [];
  return [...field[1].matchAll(/<OPTION\b[^>]*>([\s\S]*?)<\/OPTION>/gi)]
    .map((m, i) => ({ value: String(i + 1), year: Number(/\b20\d{2}\b/.exec(words(m[1]))?.[0]) }))
    .filter((item) => Number.isFinite(item.year));
}

/** Decode a JavaScript string as data, including WEBDEV's escaped quotes. */
function literal(value) {
  return value.slice(1, -1).replace(/\\(?:u([\da-f]{4})|x([\da-f]{2})|(\r\n|[\s\S]))/gi, (_, unicode, hex, char) => {
    if (unicode || hex) return String.fromCharCode(Number.parseInt(unicode ?? hex, 16));
    if (char === '\n' || char === '\r' || char === '\r\n') return '';
    return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' })[char] ?? char;
  });
}

/** Only literal HTML anchors from the response's generated display script. */
function anchors(xml) {
  const field = /<CHAMP\b[^>]*\bALIAS="A21"[^>]*>([\s\S]*?)<\/CHAMP>/i.exec(String(xml ?? ''));
  const property = /<PROP\b[^>]*\bNUM="21"[^>]*>([\s\S]*?)<\/PROP>/i.exec(field?.[1] ?? '');
  if (!property) return [];
  const program = entities(property[1]);
  const out = [];
  for (const string of program.matchAll(/"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g)) {
    const html = literal(string[0]);
    for (const match of html.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
      out.push({ ...attributes(match[1]), title: words(match[2]) });
    }
  }
  return out;
}

/** Published folders, identified by their labels rather than their IDs. */
export function webdevFolders(xml) {
  return anchors(xml).filter((a) => /^lienDossier\d+$/.test(a.id ?? ''))
    .map((a) => ({ id: a.id.slice('lienDossier'.length), title: a.title }));
}

/** Newest posting folder in this collection; individual orders are ignored. */
export function webdevLatestPosting(xml) {
  return webdevFolders(xml).flatMap((folder) => {
    // i18n-ignore-next-line — the publisher's folder labels
    const match = /^affichage\s+au\s+(\d{2})\/(\d{2})\/(20\d{2})$/i.exec(folder.title);
    if (!match) return [];
    const day = `${match[3]}-${match[2]}-${match[1]}`;
    const date = new Date(`${day}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? [{ ...folder, day }] : [];
  }).sort((a, b) => b.day.localeCompare(a.day))[0] ?? null;
}

/** All four current lists, or null: a partial posting never replaces them. */
export function webdevLists(city, xml) {
  const documents = anchors(xml);
  const out = [];
  for (const list of city.lists) {
    const document = documents.find((a) => list.title.test(a.title));
    const match = /selectionArrete\([^;]*,\s*'([^']+)'\s*,\s*'(\d+)'\s*\)\s*;?$/i.exec(document?.onclick ?? '');
    if (!match || match[1] !== city.source.directory) return null;
    out.push({ board: list.board, layout: list.layout,
      url: new URL(`DOC_${match[2]}.pdf`, city.source.fileBase).href });
  }
  return out.length && new Set(out.map((list) => list.url)).size === out.length ? out : null;
}
