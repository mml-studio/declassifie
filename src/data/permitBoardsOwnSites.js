/**
 * Boards municipalities post on their own sites, each in a shape of its own,
 * read on 2026-10-03 (see `permitBoards.js` for the contract).
 *
 * LE PORT (La Réunion) posts two Word lists a week on its file server, each
 * linked from its legal-notice page: « NN_Dossiers déposés du 24 août au 31
 * août 2026.pdf » (filing day, number, applicant, site, works) and « NN_Dossiers
 * décidés du … .pdf » (number, applicant, verdict, signing day, works, site,
 * floor area) — Operis's exports, with the very headers of Béziers's
 * (`grid`). The file server lists no folder (403) and the names carry the
 * week's two days, typos included (« séposés »): only the page's links are
 * read, and the page runs some five weeks behind the server — on 2026-10-03 it
 * linked lists to 31 August, 32 filing lists and 29 decision lists for 2026.
 * Its numbers use the département's three digits: `DP 974407 26 00135`.
 *
 * LES SABLES-D'OLONNE posts on « Les Sables en 1 clic », a Publik portal
 * (Entr'ouvert). Its « Urbanisme » category of legal display holds every act,
 * scanned (409 documents on 2026-10-03), and each Tuesday the two lists
 * Cart@DS prints, `LISTE-DES-AVIS-DE-DEPOTS-AU-29092026` and
 * `LISTE-DES-DECISIONS-AU-29092026`, which `cartds-report-*` read: every
 * dossier on display, 377 filings and 427 decisions in the lists of
 * 29 September, each with its site. Their applicant cell prints a company
 * over the person who represents it (« EXEMPLE SCCV » / « PRIVATE
 * PERSON »), which the report reader joins: no applicant is kept.
 *
 * SARREGUEMINES posts each order, scanned, as a post of the WordPress behind
 * its town-hall kiosk; CAUDRY, the register its instruction software prints of
 * the year's dossiers; LA QUEUE-EN-BRIE, each order, scanned, on the
 * affichage.legal board it rents; SAINT-GERMAIN-LÈS-ARPAJON, Excel workbooks
 * shared from SharePoint; THORIGNY-SUR-MARNE, two Excel sheets printed to
 * PDF; CLOUANGE, DOUVRIN and MAING, scans of the mayor's orders listed in
 * three shapes of their own — a kiosk's tiles, WordPress download packages, a
 * table of the legal display (read by `dematdoc-notice`, by OCR in the daily
 * sweep); MONTESSON, the HTML lists of an OpenInfoLive site, its filings'
 * table standing as the notice of filing; MORANGIS and AMILLY, sheets
 * printed from Excel; DOURDAN, the lists and the scanned orders of a Creasit
 * document library. See their protocols below.
 *
 * Applicants: only an organisation's name may be kept (`scrubPermitListRow`).
 */
import { municipalDate, municipalDossier, municipalSite, municipalVerdict } from './municipalPermitsFeed.js';
import messages from './municipalPermitsFeed.i18n.js';
import { PERMIT_LIST_READERS } from './permitListsFeed.js';
import { POSTED_LIST_PATTERNS } from './permitBoardsPostedLists.js';
import { REPORT_BOARD_READERS } from './permitBoardsReports.js';
import { readStateFormOrder } from './permitBoardsDigilorB.js';
import { listVerdict } from './permitBoardsLists.js';

const verdicts = messages.definition;
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toUpperCase();
const ENTITIES = { amp: '&', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', eacute: 'é', egrave: 'è', agrave: 'à', ocirc: 'ô' }; // i18n-ignore-line — HTML entity names
const decode = (value) => String(value ?? '').replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (whole, name) => {
  if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return ENTITIES[name.toLowerCase()] ?? whole;
});

/** Every `<a href>` of a page, resolved, with its decoded path. */
function pageLinks(html, base) {
  const out = [];
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi)) {
    let url;
    try { url = new URL(decode(match[1]).trim(), base); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    let path = url.pathname;
    try { path = decodeURIComponent(url.pathname); } catch { /* a stray % keeps the raw path */ }
    out.push({ url: url.href, path });
  }
  return out;
}

// i18n-ignore-start — French month names, matched on
const MONTHS = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE'];
// i18n-ignore-end
const DAY_MONTH = new RegExp(`(?:^|\\D)(\\d{1,2})(?:ER)?\\s*(${MONTHS.join('|')})(?![A-Z])`, 'g');

/**
 * The last day a weekly list's name gives (`du 24 août au 31 août 2026` →
 * `2026-08-31`), in its folder's year, or null. A week across the new year
 * (`du 29 décembre au 05 janvier`) ends in the folder's year.
 */
export function weekEnd(name, year) {
  const found = [...fold(name).matchAll(DAY_MONTH)].at(-1);
  if (!found || !/^20\d{2}$/.test(String(year))) return null;
  const day = Number(found[1]);
  const month = MONTHS.indexOf(found[2]) + 1;
  if (day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * A run's width as its glyphs could fill it at most. Word gives some runs of
 * Le Port's lists an advance far past their last glyph (« photovoltaïques
 * (3kWc) (14m²). », 30 glyphs over 527 points): the grid would take the works
 * column for the site's, which it then overlaps more.
 */
function cappedWidths(document) {
  return {
    ...document,
    pages: (document?.pages ?? []).map((page) => ({
      ...page,
      runs: (page.runs ?? []).map((run) => {
        const most = run.x + 0.62 * (run.size || 11) * String(run.text ?? '').length;
        return Number.isFinite(run.x1) && run.x1 > most ? { ...run, x1: most } : run;
      }),
    })),
  };
}

/** The export's line breaks (`__`) and apostrophes (`d_une`) in a works cell. */
export function tidyWorks(value) {
  const text = clean(value);
  if (!text) return null;
  return clean(text.replace(/_{2,}/g, ' ').replace(/\b(qu|[cdjlmnst])_(?=\p{L})/giu, '$1’').replace(/_/g, ' '));
}

/** One of Le Port's weekly lists, read as Béziers's grid with sane run widths. */
function readOperisWordGrid(board) {
  return (document) => PERMIT_LIST_READERS.grid(cappedWidths(document))
    .filter((row) => row.board === board)
    .map((row) => ({ ...row, purpose: tidyWorks(row.purpose) }));
}

// i18n-ignore-start — the file server's own folder names, matched on
const LE_PORT_FOLDER = /\/Urbanisme\/(D[ée]p[ôo]t|D[ée]cision) des autorisations d.urbanisme\/(20\d{2})\/([^/]+\.pdf)$/i;
// i18n-ignore-end

const lePortProtocol = {
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request, { since } = {}) {
    const files = [];
    let linked = 0;
    for (const link of pageLinks(html, request.url)) {
      if (new URL(link.url).hostname !== 'file.ville-port.re') continue;
      const match = LE_PORT_FOLDER.exec(link.path);
      if (!match) continue;
      linked += 1;
      const [, folder, year, name] = match;
      if (since && year < since.slice(0, 4)) continue;
      const board = /^D[ée]p/i.test(folder) ? 'filings' : 'decisions';
      const published = weekEnd(name, year);
      if (!published || files.some((file) => file.url === link.url)) continue;
      files.push({ url: link.url, board, layout: `le-port-${board}`, published });
    }
    return linked ? { files } : null;
  },
};

// --- Les Sables-d'Olonne: a Publik card cell ---------------------------------

/** The day a list's name gives: `…-AU-29092026` or `…-09-06-2026` → ISO. */
export function sablesListDay(name) {
  const match = /(?:^|\D)(\d{2})[\s_-]?(\d{2})[\s_-]?(20\d{2})(?!\d)/.exec(String(name ?? ''));
  if (!match) return null;
  const [, day, month, year] = match;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${year}-${month}-${day}`;
}

/** What the category's search is asked: the two lists' names begin with it. */
const SABLES_SEARCH = 'LISTE'; // i18n-ignore-line — the lists' own names

/**
 * The category page draws its documents with an XHR: the last card cell of
 * the page (`/ajax/cell/287/wcs_wcscardcell-94/`), asked with the page's
 * signed context and searched for « LISTE » — 21 lists on 2026-10-03, the
 * newest first, ten a page. Each download link holds the anonymous session
 * that answer opened (`/api/wcs/file/<session>/<token>/`) and is refused
 * without that session's cookie (403); with it, the portal redirects to a
 * signed download from its forms server. The file is kept under the list's
 * name, the link being good for that session only. An undated list
 * (`LISTE-DES-DECISIONS`) is an older edition: it is skipped.
 */
const sablesProtocol = {
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request, { since } = {}) {
    const text = String(html ?? '');
    if (!request.cell) {
      const cells = [...text.matchAll(/data-ajax-cell-url="([^"]*\/(wcs_wcscardcell-\d+)\/)"\s+data-extra-context="([^"]+)"/g)];
      const cell = cells.at(-1);
      if (!cell) return null;
      const [, path, slug, context] = cell;
      const url = new URL(path, request.url);
      return { next: [{ url: `${url.href}?ctx=${context}&c${slug}-q=${SABLES_SEARCH}`, as: 'html', cell: url.href, offset: 0 }] };
    }
    if (!/cell-cards|pk-table/.test(text)) return null;
    const files = [];
    let oldest = null;
    for (const match of text.matchAll(/<a\b[^>]*\bhref="(\/api\/wcs\/file\/([a-z0-9]+)\/[^"]+)"[^>]*\bdownload="([^"]+)"/gi)) {
      const [, href, session, name] = match;
      const folded = fold(name.replace(/[_-]+/g, ' '));
      const board = new RegExp(POSTED_LIST_PATTERNS.decisions).test(folded) ? 'decisions'
        : new RegExp(POSTED_LIST_PATTERNS.filings).test(folded) ? 'filings' : null;
      const published = sablesListDay(name);
      if (!board || !published) continue;
      if (!oldest || published < oldest) oldest = published;
      files.push({ url: `${city.page}#${encodeURIComponent(name)}`, requestUrl: new URL(href, request.url).href,
        headers: { Cookie: `${city.source.sessionCookie}=${session}` },
        board, layout: `les-sables-d-olonne-${board}`, published });
    }
    if (!files.length) return null;
    // « (1-10/21) »: the documents this page shows, of how many.
    const [, , last, total] = /\((\d+)-(\d+)\/(\d+)\)/.exec(text) ?? [];
    const more = Number(last) < Number(total) && (!since || oldest >= since);
    const next = more ? [{ ...request, url: `${request.url.replace(/&offset=\d+$/, '')}&offset=${last}`, offset: Number(last) }] : [];
    return { files, next };
  },
};

// --- Sarreguemines: the WordPress behind its kiosk ---------------------------

/** Its WordPress category « Autorisations d'urbanisme »: the decisions, one post each. */
const SARREGUEMINES_DECISIONS = 12;
const SARREGUEMINES_PAGE_SIZE = 100;

/**
 * A post's title, the short number then the applicant (`DP2600190 <name>`,
 * `PC24S0042M01 <name>`): the number, prefixed with the commune's code, and
 * nothing else — the name is never read.
 */
export function sarregueminesNumber(title, city) {
  const match = /^\s*(PC|DP|PA|PD)\s*(\d{2})\s*([A-Z]?\d{4,5})\s*([MT]\d{1,2})?(?![\dA-Z])/i.exec(decode(title));
  if (!match) return null;
  const [, kind, year, counter, suffix] = match;
  return municipalDossier(`${kind} ${city.insee.slice(0, 2)} ${city.insee.slice(2)} ${year} ${counter}${suffix ? ` ${suffix}` : ''}`, city);
}

function sarregueminesQuery(city, since, page) {
  const url = new URL(city.source.posts);
  url.search = new URLSearchParams({ categories: String(SARREGUEMINES_DECISIONS), ...(since ? { after: `${since}T00:00:00` } : {}),
    per_page: String(SARREGUEMINES_PAGE_SIZE), page: String(page), orderby: 'date', order: 'desc',
    _fields: 'date,title,content' }).toString();
  return { url: url.href, as: 'json' };
}

/**
 * Sarreguemines posts its acts on a WordPress (`asld2.fr/handon`) that feeds
 * the touch screen in its town hall and its page « Arrêtés urbanisme »:
 * one post per decision under « Autorisations d'urbanisme », titled by the
 * short number and the applicant, holding the signed order as a copier's scan
 * — 65 since 1 July 2026 on 2026-10-03, two of them a picture rather than a
 * PDF. The filing receipts (« Récépissés de dépôt », 48 since 1 July) are
 * screenshots of the instruction software, which no reader reads: they are
 * left aside. The orders are the State's form, read by the sweep's OCR; until
 * then the title's number stands, a signed decision.
 */
const sarregueminesProtocol = {
  start: (city, { since } = {}) => [sarregueminesQuery(city, since, 1)],
  index(city, posts, request, { since } = {}) {
    if (!Array.isArray(posts)) return null;
    const files = [];
    for (const post of posts) {
      const dossier = sarregueminesNumber(post?.title?.rendered, city);
      const href = /href="(https:\/\/[^"]+\/wp-content\/uploads\/\d{4}\/\d{2}\/[^"/]+\.pdf)"/i.exec(post?.content?.rendered ?? '')?.[1];
      const published = municipalDate(String(post?.date ?? '').slice(0, 10));
      if (!dossier || !href || !published) continue;
      files.push({ url: decode(href), board: 'decisions', layout: 'sarreguemines-order', published, scan: true, ocrPages: 1,
        row: { board: 'decisions', dossier, applicant: null, address: null, postcode: city.postcode, postedOn: published,
          verdict: verdicts.signed.fr } });
    }
    const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
    return { files, next: posts.length >= SARREGUEMINES_PAGE_SIZE ? [sarregueminesQuery(city, since, page + 1)] : [] };
  },
};

// --- Caudry: the register printed from its instruction software -------------

// i18n-ignore-start — the page's own headings, matched on
/** `DEPOTS ET DECISIONS D'URBANISME AU 28/08/2026`, `AFFICHAGES ET DECISIONS 2026 AU 15/01/2026`. */
const CAUDRY_HEADING = /^(?:D[EÉ]P[OÔ]TS?|AFFICHAGES?)\s+ET\s+D[EÉ]CISIONS?\b(.*)\bAU\s+([^]*)$/i;
// i18n-ignore-end

/**
 * The day a heading's list was printed and the year its dossiers were filed
 * in: `… 2025 AU 1 JUILLET 2026` is the register of 2025, its decisions to 1
 * July 2026 — not this year's.
 */
export function caudryHeading(value) {
  const match = CAUDRY_HEADING.exec(clean(decode(value)));
  const published = match ? municipalDate(match[2]) : null;
  if (!published) return null;
  const year = /\b(20\d{2})\b/.exec(match[1])?.[1] ?? published.slice(0, 4);
  return year === published.slice(0, 4) ? { published } : null;
}

/**
 * Caudry posts, every two weeks or so, the register its instruction
 * software prints of the year's dossiers « pour affichage », Chrome-printed
 * (« Registre des dossiers pour affichage — Déposés entre le 01/01/2026 et le
 * 28/08/2026 », 40 pages), each edition at a new address
 * (`/techniques/dl/<uuid>/`) under a heading that gives its day. Every
 * edition holds the year from 1 January: only the newest is read. That of
 * 28 August 2026 held 553 dossiers, 149 of them permits (116 DP, 25 PC,
 * 8 PD): 113 decided, 36 pending, each with its site — 145 an address, the
 * others their parcels.
 */
const caudryProtocol = {
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request) {
    let newest = null;
    for (const match of String(html ?? '').matchAll(/<h4>([^<]*)<\/h4>\s*<a\b[^>]*\bhref="(\/techniques\/dl\/[\w-]+\/)"/gi)) {
      const heading = caudryHeading(match[1]);
      if (heading && (!newest || heading.published > newest.published)) newest = { ...heading, url: new URL(match[2], request.url).href };
    }
    if (!newest) return null;
    return { files: [{ url: newest.url, board: 'filings', layout: 'caudry-register', published: newest.published }] };
  },
};

// --- La Queue-en-Brie: affichage.legal ---------------------------------------

// i18n-ignore-start — the board's own titles and types, matched on
/** `ACCORD - DP2600077`, `REFUS - DP2600063`, `ACCORD - PC21N1008T02`: the verdict, then the number. */
const QUEUE_TITLE = /^\s*([A-ZÉ][A-ZÉ ]*?)\s*[-–]\s*(PC|DP|PA|PD)\s*(\d{6})?\s*(\d{2})\s*([A-Z]\d{4}|\d{5})\s*([MT]\d{2})?\s*$/i;
// i18n-ignore-end

/**
 * A post's title: its number, short (`DP2600077`, the commune's code left
 * out) or whole (`PC0940602600007`), and the verdict it states. A counter of
 * four digits (`PC191002M02`, the order's `PC09406019N1002M02`) has lost a
 * letter: it gives no number, the order's own then stands alone.
 */
export function queueTitle(title, city) {
  const match = QUEUE_TITLE.exec(clean(decode(title)));
  if (!match) return null;
  const [, said, kind, code, year, counter, suffix] = match;
  const insee = `0${city.insee}`;
  if (code && code !== insee) return null;
  const dossier = municipalDossier(`${kind} ${insee} ${year} ${counter}${suffix ? ` ${suffix}` : ''}`, city);
  return dossier ? { dossier, verdict: listVerdict(said) } : null;
}

/**
 * La Queue-en-Brie posts on affichage.legal, a board several communes rent:
 * its JSON (`/api/displays/visible`, the tenant in a header) lists every act
 * on display, 2 431 on 2026-10-03, and its category « Urbanisme » 29 — the
 * permits' orders, one post each since August 2026 (18 by 1 October), each
 * kept two months, titled by verdict and number (`ACCORD - DP2600077`) with
 * the works as description. The order is a scan, signed electronically,
 * which a short link (`lgl.pub`) redirects to; the sweep's OCR reads its
 * site. Until then the title's number and verdict stand.
 */
const queueProtocol = {
  start: (city) => [{ url: `https://affichage.legal/api/displays/visible?categories=${city.source.category}`, as: 'json',
    headers: { 'X-Tenant-Id': city.source.tenant } }],
  index(city, posts, request, { since } = {}) {
    if (!Array.isArray(posts)) return null;
    const files = [];
    for (const post of posts) {
      if (post?.tenantId !== city.source.tenant || post?.removedAt) continue;
      const published = municipalDate(String(post.date ?? '').slice(0, 10));
      const link = /^https:\/\/lgl\.pub\/\w+$/.test(post.minurl ?? '') ? post.minurl : null;
      const kind = clean(post.type);
      // i18n-ignore-next-line — the board's own types
      if (!published || !link || !/^(?:D[ée]claration pr[ée]alable|Permis d)/i.test(kind) || (since && published < since)) continue;
      const titled = queueTitle(post.title, city);
      files.push({ url: link, board: 'decisions', layout: 'la-queue-en-brie-order', published, scan: true, ocrPages: 1,
        row: titled ? { board: 'decisions', dossier: titled.dossier, applicant: null, address: null, postcode: city.postcode,
          purpose: clean(decode(post.description)) || null, verdict: titled.verdict ?? verdicts.signed.fr, postedOn: published } : null });
    }
    return { files };
  },
};

// --- Saint-Germain-lès-Arpajon: a SharePoint workbook --------------------------

// i18n-ignore-start — the page's own box title, matched on
const SGLA_FILINGS_BOX = /^Avis de d[ée]p[ôo]t des demandes/i;
// The workbook's one sheet, by its exact name: the opt-in XLSX path reads no other.
const SGLA_FILINGS_SHEET = "Demandes en cours d'instruction";
// i18n-ignore-end

/**
 * The page's boxes and the SharePoint links they open: Divi keeps the links
 * in a script (`et_link_options_data`, `dipi_hover_box_0` → `https://…
 * sharepoint.com/:x:/s/<site>/<share id>?e=…`), the titles in the boxes.
 */
export function sglaBoxes(html) {
  const text = String(html ?? '');
  const data = /et_link_options_data\s*=\s*(\[[\s\S]*?\])\s*;/.exec(text)?.[1];
  let links = [];
  try { links = JSON.parse(data ?? '[]'); } catch { return []; }
  const boxes = [];
  for (const link of Array.isArray(links) ? links : []) {
    const box = /^dipi_hover_box_\d+$/.exec(link?.class ?? '')?.[0];
    const share = /^https:\/\/([\w-]+\.sharepoint\.com)\/:x:\/s\/([\w-]+)\/([\w-]+)(?:\?|$)/.exec(link?.url ?? '');
    if (!box || !share) continue;
    const at = text.search(new RegExp(`class="[^"]*\\b${box}\\b`));
    const title = at < 0 ? '' : clean(decode(text.slice(at, at + 2000).replace(/^[^>]*>/, '').replace(/<[^>]+>/g, ' ')));
    const [, host, site, id] = share;
    boxes.push({ title, url: `https://${host}/sites/${site}/_layouts/15/download.aspx?share=${id}` });
  }
  return boxes;
}

/**
 * Saint-Germain-lès-Arpajon posts its permits as Excel workbooks shared from
 * SharePoint, each opened by a box of its page « Affichage en mairie »: the
 * dossiers under review (« Avis de dépôt des demandes d'autorisation
 * d'urbanisme en cours d'instruction », `Demandes-en-cours.xlsx`) and one
 * workbook of decisions per family. A share link answers a visitor with a
 * guest cookie and a redirect; SharePoint's `download.aspx?share=<id>` gives
 * the same file at once, with its ETag. Only the filings are read: the
 * decisions' workbooks give the number and the posting day, their site only
 * in each decision's own PDF, behind a link of its own. The workbook goes
 * through the board's XLSX path, which reads only the sheet it is named
 * (« Demandes en cours d'instruction » on 2026-10-04).
 */
const sglaProtocol = {
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html) {
    const box = sglaBoxes(html).find((item) => SGLA_FILINGS_BOX.test(item.title));
    if (!box) return null;
    return { files: [{ url: box.url, board: 'filings', layout: 'sgla-filings', format: 'xlsx', sheet: SGLA_FILINGS_SHEET, rolling: true }] };
  },
};

// --- Thorigny-sur-Marne: two sheets printed from Excel -------------------------

/**
 * Thorigny-sur-Marne posts its decisions on its page « Affichage
 * règlementaire »: two Excel sheets printed to PDF, one for permits
 * (`decisions_-_pc.xlsx.pdf`) and one for declarations
 * (`decisions_-_dp_13.pdf`, the suffix growing as Drupal keeps each upload),
 * replaced as decisions come — both of 8 September 2026 on 2026-10-03.
 */
const thorignyProtocol = {
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request) {
    const files = pageLinks(html, request.url)
      .filter((link) => /\/sites\/default\/files\/decisions?_-_(?:pc|dp|pa|pd)(?![a-z])[^/]*\.pdf$/i.test(link.path))
      .map((link) => ({ url: link.url, board: 'decisions', layout: 'thorigny-decisions', rolling: true }));
    return files.length ? { files: [...new Map(files.map((file) => [file.url, file])).values()] } : null;
  },
};

// --- Clouange: the town-hall kiosk's web app ----------------------------------

/**
 * Clouange's « Affichage réglementaire » kiosk (`panneau.clouange.fr`) draws
 * one tile per act under « Urbanisme »: a category's tiles are the fragment
 * `/modele/affichage.php?type=N` (2 permits, 3 declarations, 4 the others;
 * empty when nothing is on display), each tile titled by the dossier's
 * number — `DP0571432600034`, `PC 05714324P0004M01` — and its act, a scan
 * of the mayor's order, at `/pdf/pdf/<tile id>.pdf`. No day is printed
 * anywhere: the act says its filing day and, signed, its own. On 2026-10-03
 * seven declarations and a transfer were on display, the newest scanned on
 * 2 October.
 */
const CLOUANGE_TILE = /<div id=(\d+) class="imgPDF">\s*<a><span class="nom">([^<]*)<\/span>/g;

export function clouangeTiles(html, city) {
  const files = [];
  for (const match of String(html ?? '').matchAll(CLOUANGE_TILE)) {
    const dossier = municipalDossier(decode(match[2]), city);
    if (!dossier) continue;
    files.push({ id: match[1], dossier });
  }
  return files;
}

const clouangeProtocol = {
  // The declarations first: an empty category is a valid answer, a first one that fails is not.
  start: (city) => [3, 2, 4].map((type) => ({ url: new URL(`/modele/affichage.php?type=${type}`, city.page).href, as: 'html' })),
  index(city, html, request) {
    if (!/class="imgPDF"/.test(html) && String(html ?? '').trim()) return null;
    const files = clouangeTiles(html, city).map(({ id, dossier }) => ({
      url: new URL(`/pdf/pdf/${id}.pdf`, request.url).href, board: 'decisions', layout: 'dematdoc-notice', scan: true, ocrPages: 2,
      row: { board: 'decisions', dossier, applicant: null, address: null, postcode: city.postcode, verdict: verdicts.signed.fr, postedOn: null },
    }));
    return { files };
  },
};

// --- Douvrin: WordPress Download Manager packages -----------------------------

/**
 * Douvrin's page « Autorisations d'urbanisme » lists the acts as WordPress
 * Download Manager packages under three headings, « Permis de construire »,
 * « Permis de démolition » and « Déclarations préalables »: a title that is
 * the dossier's number (`PC 062 276 26 00018`, the commune's code typed
 * `0620 276` twice) and a button whose `data-downloadurl` names the file —
 * a scan of the mayor's order, stamped by the préfecture, which downloads
 * from the `?wpdmdl=<id>` address alone (the `refresh` token is not needed).
 * The package's day is only on its own page: none is asked for, the order
 * gives its filing day and its signing day (its télétransmission ID). The
 * text layer of these PDFs is drawn sideways (a rotated content stream: the
 * cells come out in the wrong order, the parcels as « DP 62 »), so the
 * sweep's OCR reads the page as it looks. Twenty-one packages on 2026-10-04,
 * 21 decisions with a site, 19 signed since 3 July, the newest on 28 September.
 */
const DOUVRIN_HEADINGS = /^(?:Permis de construire|Permis de d[ée]molition|D[ée]clarations? pr[ée]alables?)$/i; // i18n-ignore-line — the page's headings
const DOUVRIN_ITEM = /<h2\b[^>]*>([\s\S]*?)<\/h2>|<strong class="package-title">([\s\S]*?)<\/strong>[\s\S]*?data-downloadurl="([^"]+)"/g;

export function douvrinPackages(html, city) {
  const files = [];
  let listed = false;
  for (const match of String(html ?? '').matchAll(DOUVRIN_ITEM)) {
    if (match[1] !== undefined) { listed = DOUVRIN_HEADINGS.test(clean(decode(match[1].replace(/<[^>]*>/g, ' ')))); continue; }
    if (!listed) continue;
    const title = clean(decode(match[2].replace(/<[^>]*>/g, ' '))).replace(/\b0620\s*276\b/, '062 276');
    const dossier = municipalDossier(title, city);
    let url;
    try { url = new URL(decode(match[3])); } catch { continue; }
    url.searchParams.delete('refresh');
    if (dossier && url.searchParams.has('wpdmdl')) files.push({ url: url.href, dossier });
  }
  return files;
}

const douvrinProtocol = {
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request, { since } = {}) {
    const packages = douvrinPackages(html, city);
    if (!packages.length) return null;
    // An older year's number is an old file kept on the page.
    const year = since ? Number(since.slice(2, 4)) - 1 : 0;
    return { files: packages.filter(({ dossier }) => Number(dossier.split(' ')[2]) >= year).map(({ url, dossier }) => ({
      url, board: 'decisions', layout: 'dematdoc-notice', scan: true, ocrPages: 2,
      row: { board: 'decisions', dossier, applicant: null, address: null, postcode: city.postcode, verdict: verdicts.signed.fr, postedOn: null },
    })) };
  },
};

// --- Maing: a table of the legal display --------------------------------------

/**
 * Maing's « Affichage légal » is one table of every notice on display, a row
 * each: the day (`29-07-2026`), a category, the notice's title and a « VOIR »
 * link to its scan. The permits are the rows of the category « Droit
 * d'occupation des sols », titled by the dossier's number alone
 * (`DP0593692600046`, `PC 059369 26 00005`), some of them a certificate
 * (`CUo …`) or a trailing amendment the layer does not read. The act, a
 * scan of the mayor's order, gives the site; the row gives the posting day.
 * On 2026-10-03 the table held 26 such rows for 2026, the newest of 29 July.
 */
const MAING_ROW = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>[\s\S]*?<a\b[^>]*\bhref\s*=\s*"([^"]+\.pdf)"/gi;
const MAING_CATEGORY = /^Droit d.occupation des sols$/i; // i18n-ignore-line — the table's own category name

export function maingRows(html, city, base) {
  const text = (cell) => clean(decode(String(cell).replace(/<[^>]*>/g, ' ')));
  const files = [];
  for (const match of String(html ?? '').matchAll(MAING_ROW)) {
    if (!MAING_CATEGORY.test(text(match[2]).replace(/’/g, "'"))) continue;
    const published = municipalDate(text(match[1]).split('-').reverse().join('-'));
    const dossier = municipalDossier(text(match[3]), city);
    let url;
    try { url = new URL(decode(match[4]), base).href; } catch { continue; }
    if (published && dossier) files.push({ url, published, dossier });
  }
  return files;
}

const maingProtocol = {
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request) {
    if (!/<table\b/i.test(html ?? '')) return null;
    return { files: maingRows(html, city, request.url).map(({ url, published, dossier }) => ({
      url, board: 'decisions', layout: 'dematdoc-notice', published, signedBy: published, ocr: true,
      row: { board: 'decisions', dossier, applicant: null, address: null, postcode: city.postcode, verdict: verdicts.signed.fr, postedOn: published },
    })) };
  },
};

// --- Montesson: the pages of an OpenInfoLive site -----------------------------

/** The accents, ligatures and signs an editor writes as named entities (`&ccedil;`, `&oelig;`, `&sup2;`). */
// i18n-ignore-start — HTML entity names and the characters they stand for
const MARKS = { acute: '\u0301', grave: '\u0300', circ: '\u0302', uml: '\u0308', cedil: '\u0327', tilde: '\u0303' };
const SIGNS = { oelig: 'œ', OElig: 'Œ', aelig: 'æ', sup2: '²', sup3: '³', deg: '°', laquo: '«', raquo: '»', hellip: '…',
  ndash: '–', mdash: '—', lsquo: '‘', ldquo: '“', rdquo: '”', euro: '€', middot: '·' };
// i18n-ignore-end
const decodeAll = (value) => decode(String(value ?? '')
  .replace(/&([a-zA-Z])(acute|grave|circ|uml|cedil|tilde);/g, (whole, letter, mark) => `${letter}${MARKS[mark]}`.normalize('NFC'))
  .replace(/&(\w+);/g, (whole, name) => SIGNS[name] ?? whole));

/** Text with a line break where a cell, a paragraph or a line ended (Montesson's editor ends its lines with `\r`). */
const htmlLines = (html) => decodeAll(String(html ?? '')
  .replace(/<(?:br|\/p|\/td|\/th|\/tr|\/li|\/h\d|\/time)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, ' '))
  .split(/\r\n?|\n/).map(clean).filter(Boolean);

// i18n-ignore-start — the town's own column titles, labels and words, matched on
const MONTESSON_COLUMNS = [['filed', /^DATE DE DEPOT/], ['dossier', /^NUMERO DE DOSSIER/], ['type', /^TYPE/],
  ['applicant', /^DEPOSANT/], ['site', /^ADRESSE DU TERRAIN/], ['parcels', /^PARCELLES?\b/],
  ['works', /^DESCRIPTION/], ['posted', /^DATE DE PUBLICATION/]];
const MONTESSON_LABEL = /^(ADRESSE D(?:U PROJET|ES TRAVAUX)|DESCRIPTION DU PROJET|MODIFICATIONS|NATURE DE (?:LA )?DECISION|DECLARANTS?|DEMANDEURS?|PETITIONNAIRES?|BENEFICIAIRES?|DATE DE PUBLICATION INITIALE DE LA DECISION)\s*:\s*(.*)$/;
/** The page's own buttons and file notes, which end a summary. */
const MONTESSON_END = /^(?:LIEN DU FICHIER|TELECHARGER|VISUALISER|VOIR LE RESUME)\b/;
const MONTESSON_TACIT = /\bACQUISE EN DATE DU\s+(.+?20\d{2})/;
const MONTESSON_ORDER = /\bARRETE N\s*[O°º]?\s*[\d-]+\s+(?:EN DATE )?DU\s+(.+?20\d{2})/;
const MONTESSON_SIGNED = /\bDATE DE LA SIGNATURE\s*:\s*(\d{2})-(\d{2})-(20\d{2})/;
const MONTESSON_UNKNOWN = /\bNON RENSEIGNE/;
// i18n-ignore-end

/**
 * A cadastral cell as a town types it — Montesson's `AO47`, `AV 1256 et
 * 1257`, `AD 184, 185, 218, 221 et 511`, `AI259 à AI263`, `non renseigné`,
 * Amilly's `BN0275 / BN0276 /`, `BP0011 / 0324` — as `AV 1256, AV 1257`: a
 * bare number is of the section before it, a range gives its two ends.
 */
export function typedParcels(cell) {
  const text = fold(cell);
  if (!text || MONTESSON_UNKNOWN.test(text)) return null;
  const out = [];
  let section = null;
  // « et » and « à » join numbers, never a section's letters.
  for (const match of text.replace(/\b(?:ET|A)\b/g, ',').matchAll(/\b([A-Z]{1,2})?\s*(\d{1,4})\b/g)) {
    section = match[1] ?? section;
    const label = section ? `${section} ${match[2]}` : null;
    if (label && !out.includes(label)) out.push(label);
  }
  return out.length ? out.join(', ') : null;
}

/** A day the town writes in words, its month glued to it now and then (`31août 2026`). */
const montessonDay = (value) => municipalDate(String(value ?? '').replace(/(\d)(?=[a-zéû]{3,})/gi, '$1 '));

/**
 * Montesson's « Dossiers déposés en cours d'instruction », the page that
 * « tient lieu d'avis de dépôt » (R.423-6): one HTML table of every dossier
 * under review, its header repeated every dozen rows — the filing day, the
 * number (`PC 078418 26 G0017`), the family, the applicant (« Particulier »
 * for a person, a company's name: never read), the site, its parcels, the
 * works and the day the filing was published. 62 dossiers on 2026-10-03,
 * filed from 10 February to 15 September, every one with its site.
 */
export function montessonFilings(html, city) {
  let columns = null;
  const rows = [];
  for (const [, row] of String(html ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<t([dh])\b[^>]*>([\s\S]*?)<\/t\1>/gi)].map((cell) => ({ head: cell[1] === 'h', text: htmlLines(cell[2]).join(' ') }));
    if (cells.length && cells.every((cell) => cell.head)) {
      const fields = cells.map((cell) => MONTESSON_COLUMNS.find(([, pattern]) => pattern.test(fold(cell.text)))?.[0] ?? null);
      if (['dossier', 'site'].every((field) => fields.includes(field))) columns = fields;
      continue;
    }
    if (!columns || cells.length !== columns.length) continue;
    const cell = (field) => cells[columns.indexOf(field)]?.text ?? null;
    const dossier = municipalDossier(cell('dossier'), city);
    if (!dossier) continue;
    const site = municipalSite(cell('site'), city);
    rows.push({ board: 'filings', dossier, applicant: null, address: site.address, postcode: site.postcode,
      parcels: typedParcels(cell('parcels')), purpose: cell('works') || null,
      filedOn: municipalDate(cell('filed')), postedOn: municipalDate(cell('posted')) });
  }
  return columns ? rows : null;
}

/**
 * Montesson's decisions, as its two lists draw them: one item per dossier,
 * titled by its number, the summary below — the order's number and day
 * (« Arrêté n° 2026-479 en date du 21 septembre 2026 ») or the tacit
 * decision's (« Décision tacite acquise en date du 3 octobre 2026 »), the
 * applicant (never read), the site, the works, the nature of the decision
 * and the day it was first published. The orders the town posts on its
 * legal display since 1 October (`redac_affichagelegal`) print the same
 * summary as their « Objet », the signing day and the posting day apart.
 * The title's number is the one kept: an order's summary once named
 * another (`PD … G0005` over « PD … G0004 »).
 */
export function montessonDecisions(html, city) {
  const items = String(html ?? '').split(/<div class="redac_(?:telechargement|affichagelegal) item\b/).slice(1);
  const rows = [];
  for (const item of items) {
    const title = /<(h2|p) class="titre\b[^"]*">([\s\S]*?)<\/\1>/.exec(item)?.[2];
    const dossier = municipalDossier(htmlLines(title).join(' '), city);
    if (!dossier) continue;
    const lines = htmlLines(item);
    const fields = {};
    let field = null;
    for (const line of lines) {
      const label = MONTESSON_LABEL.exec(fold(line));
      if (MONTESSON_END.test(fold(line))) field = null;
      else if (label) {
        field = label[1];
        fields[field] = [line.slice(line.indexOf(':') + 1).trim()].filter(Boolean);
      } else if (field) fields[field].push(line);
    }
    const value = (pattern) => clean(Object.entries(fields).find(([name]) => pattern.test(name))?.[1].join(' ')) || null;
    const text = fold(lines.join(' '));
    const tacit = MONTESSON_TACIT.exec(text);
    const order = MONTESSON_ORDER.exec(text);
    const signed = MONTESSON_SIGNED.exec(text);
    const nature = value(/^NATURE/);
    // The site's first line, the postcode and the town's name after it or on the next
    // (`82 rue Jules Ferry - 78360 MONTESSON`).
    const where = Object.entries(fields).find(([name]) => name.startsWith('ADRESSE'))?.[1][0];
    const site = municipalSite(String(where ?? '').replace(/\s+[-–]\s+\d{5}\b.*$/, ''), city);
    rows.push({ board: 'decisions', dossier, applicant: null, address: site.address, postcode: site.postcode,
      purpose: value(/^(?:DESCRIPTION|MODIFICATIONS)/),
      verdict: (nature && (municipalVerdict(`${nature}${tacit ? ' TACITE' : ''}`) ?? nature)) || verdicts.signed.fr,
      decidedOn: tacit ? montessonDay(tacit[1]) : order ? montessonDay(order[1]) : signed ? `${signed[3]}-${signed[2]}-${signed[1]}` : null,
      postedOn: municipalDate(value(/^DATE DE PUBLICATION/)) ?? municipalDate(/<time datetime="?(\d{4}-\d{2}-\d{2})/.exec(item)?.[1]) });
  }
  return rows;
}

/**
 * Montesson (Inexine's OpenInfoLive) draws three lists, each a fragment the
 * page loads: the filings' table, in the page itself; its decisions,
 * eighteen a page (`chargementContenusCritere`, the newest posted first: 100
 * on 2026-10-04, the four newest pages posted from 19 May to 3 October, 39
 * decided since 3 July, every one with its site); and, since 1 October, the
 * orders its legal display posts under « Autorisation d'urbanisme »
 * (`chargementGabaritAffichageLegal`, one so far). The tacit decisions stay
 * on the second list, the orders move to the third. The decisions' pages
 * are followed back to the window's start, fifteen seconds apart in the
 * sweep (`crawlDelayMs`).
 */
const montessonProtocol = {
  start: (city) => [
    { url: city.page, as: 'html', part: 'filings' },
    { url: city.source.decisions, as: 'html', part: 'decisions' },
    { url: city.source.orders, as: 'html', part: 'orders' },
  ],
  index(city, html, request, { since } = {}) {
    if (request.part === 'filings') {
      const rows = montessonFilings(html, city);
      return rows ? { rows } : null;
    }
    // A list says how many items it holds, none included.
    if (!/class="(?:pagination_nombrederesultat|total_resultat)\b/.test(html ?? '')) return null;
    const rows = montessonDecisions(html, city);
    // i18n-ignore-next-line — the list's own count line
    const counted = /R[ée]sultats? de (\d+) [àa] (\d+) sur (\d+)/i.exec(decodeAll(html));
    if (request.part !== 'decisions' || !counted) return { rows };
    const [, , last, total] = counted.map(Number);
    const oldest = rows.map((row) => row.postedOn).filter(Boolean).sort()[0];
    const more = last < total && rows.length > 0 && (!since || Boolean(oldest && oldest >= since));
    const page = (request.page ?? 1) + 1;
    return { rows, next: more ? [{ ...request, url: `${city.source.decisions}&pagination_idxB2=${last + 1}&pagecouranteB2=${page}`, page }] : [] };
  },
};

// --- Morangis: two yearly sheets, replaced in place ---------------------------

/**
 * Morangis posts on its page « Permis de construire » the two sheets its
 * planning service keeps for the year, printed to PDF and uploaded again
 * under the same name as they grow: the permits decided
 * (`decisions-pc.pdf`) and the declarations filed (`depot-dp_6.pdf`, Drupal's
 * suffix growing with each upload), each link titled by its day (« Permis de
 * construire au 2 octobre 2026 »). Both are read again with their validators.
 */
const morangisProtocol = {
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request) {
    const files = [];
    // i18n-ignore-next-line — the links' own words
    const kinds = [[/^PERMIS DE CONSTRUIRE\b/, 'decisions', 'morangis-permits'], [/^DECLARATIONS? PREALABLES?\b/, 'filings', 'morangis-declarations']];
    for (const match of String(html ?? '').matchAll(/<a\b[^>]*?\bhref\s*=\s*"([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const words = fold(decodeAll(match[2].replace(/<[^>]*>/g, ' ')));
      const kind = kinds.find(([pattern]) => pattern.test(words));
      let url;
      try { url = new URL(decode(match[1]), request.url); } catch { continue; }
      if (!kind || !/\/sites\/default\/files\//.test(url.pathname) || files.some((file) => file.layout === kind[2])) continue;
      files.push({ url: url.href, board: kind[1], layout: kind[2], rolling: true });
    }
    return files.length ? { files } : null;
  },
};

// --- Amilly: two weekly sheets ---------------------------------------------------

/** The last day a name or its link's words give: `…-avant-le-23092026`, `… et le 30-09-2026`. */
export function amillyDay(value) {
  const days = [...fold(value).matchAll(/(?:^|\D)(\d{2})[\s/.-]?(\d{2})[\s/.-]?(20\d{2})(?!\d)/g)]
    .map(([, day, month, year]) => municipalDate(`${day}/${month}/${year}`)).filter(Boolean);
  return days.at(-1) ?? null;
}

/**
 * Amilly posts each week, under « Dépôts des demandes » and « Décisions » of
 * its page « Autorisations d'urbanisme », two sheets its planning service
 * prints from Excel, each edition under a name of its own: the dossiers
 * filed and not yet decided (`URBANISME-Dossiers-deposes-avant-le-30-09-2026.pdf`)
 * and those decided over the last three months
 * (`URBANISME-Dossiers-delivres-entre-le-30-06-2026-et-le-30-09-2026.pdf`), the
 * six newest of each linked. Each edition holds the last one's: only the
 * newest of each is read, dated by « Publié le » or, failing it, the last
 * day its name gives.
 */
const amillyProtocol = {
  start: (city) => [{ url: city.page, as: 'html' }],
  index(city, html, request) {
    const newest = {};
    for (const match of String(html ?? '').matchAll(/<a\b[^>]*?\bhref\s*=\s*"([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      let url;
      try { url = new URL(decode(match[1]), request.url); } catch { continue; }
      if (!/\/wp-content\/uploads\//.test(url.pathname)) continue;
      let name = url.pathname;
      try { name = decodeURIComponent(name); } catch { /* a stray % keeps the raw path */ }
      const words = decodeAll(match[2].replace(/<[^>]*>/g, ' '));
      const folded = fold(`${name} ${words}`.replace(/[_-]+/g, ' '));
      // i18n-ignore-next-line — the sheets' own titles
      const board = /\bDOSSIERS DELIVRES\b/.test(folded) ? 'decisions' : /\bDOSSIERS DEPOSES\b/.test(folded) ? 'filings' : null;
      // i18n-ignore-next-line — the link's own words
      const published = municipalDate(/\bPubli[ée] le\s+(\d{2}\/\d{2}\/20\d{2})/i.exec(words)?.[1]) ?? amillyDay(name.replace(/^.*\//, ''));
      if (!board || !published || (newest[board] && newest[board].published >= published)) continue;
      newest[board] = { url: url.href, board, layout: 'amilly-list', published };
    }
    const files = Object.values(newest);
    return files.length ? { files } : null;
  },
};

// --- Dourdan: the document library's urbanism category ---------------------------

/** One card of a Creasit document library: its title, its day and its file. */
function creasitCards(posts) {
  const cards = [];
  for (const post of Array.isArray(posts) ? posts : []) {
    const html = String(post ?? '');
    const title = clean(htmlLines(/class="listing__title[^"]*">([\s\S]*?)<\/p>/.exec(html)?.[1]).join(' '));
    const day = municipalDate(htmlLines(/files-infos__date">([\s\S]*?)<\/li>/.exec(html)?.[1]).join(' '));
    const href = /\bdata-href="([^"]+\.pdf)"/i.exec(html)?.[1] ?? /\bhref="(https?:[^"]+\.pdf)"/i.exec(html)?.[1];
    if (title && href) cards.push({ title, day, url: decode(href) });
  }
  return cards;
}

/** Documents a page of the library's API asks for (it gives thirty at most). */
const DOURDAN_PAGE_SIZE = 30;
const dourdanQuery = (city, page) => {
  const url = new URL('/wp-json/creasit/postsQuery', city.page);
  url.search = new URLSearchParams({ pages: String(page), cpt: 'documents', numberPosts: String(DOURDAN_PAGE_SIZE),
    orderBy: 'meta_value', order: 'DESC', post_status: 'publish', category: String(city.source.category) }).toString();
  return { url: url.href, as: 'json', page };
};

/**
 * Dourdan posts in the « E-Ressources - urbanisme » category of its document
 * library (147 documents on 2026-10-04, the newest first) the list of the
 * dossiers filed every two weeks or so (« Dossiers déposés au 15 septembre
 * 2026 », a Word table through Ghostscript, `dourdan-filings`) and each
 * decision's order, scanned on a copier, titled by its number and its site
 * (« DP 91200 26 10089 - 32 rue de Rouillon »; file names, some of them an
 * applicant's, are never read). The page draws ten documents, the rest by
 * its theme's API (`/wp-json/creasit/postsQuery`), asked here thirty at a
 * time back to the window's start. An order is read by OCR in the sweep
 * (`dourdan-order`); until then its title's number and site stand, a signed
 * decision. Signs (`AP`) and works in buildings open to the public (`AT`)
 * are not permits. On 2026-10-04, four months back: 6 lists (44 permits
 * and declarations filed from 4 March, 22 of them since 3 July) and 15
 * orders posted from 10 August to 28 September, 11 of them with the
 * verdict OCR read.
 */
const dourdanProtocol = {
  start: (city) => [dourdanQuery(city, 1)],
  index(city, answer, request, { since } = {}) {
    if (!Array.isArray(answer?.posts)) return null;
    const files = [];
    let oldest = null;
    for (const card of creasitCards(answer.posts)) {
      if (card.day && (!oldest || card.day < oldest)) oldest = card.day;
      const title = fold(card.title);
      // i18n-ignore-next-line — the lists' own titles
      if (/^(?:DOSSIERS? (?:DEPOSES?|EN COURS)|LISTE DES DOSSIERS)\b/.test(title)) {
        if (card.day) files.push({ url: card.url, board: 'filings', layout: 'dourdan-filings', published: card.day });
        continue;
      }
      const dossier = municipalDossier(card.title, city);
      if (!dossier || !card.day) continue;
      const at = card.title.search(/\s*-\s+/);
      const site = municipalSite(at < 0 ? null : card.title.slice(at).replace(/^\s*-\s*/, ''), city);
      files.push({ url: card.url, board: 'decisions', layout: 'dourdan-order', scan: true, ocr: true, ocrPages: 2, published: card.day,
        row: { board: 'decisions', dossier, applicant: null, address: site.address, postcode: site.postcode,
          verdict: verdicts.signed.fr, postedOn: card.day } });
    }
    const found = Number(answer.pagination_infos?.foundPosts ?? 0);
    const more = request.page * DOURDAN_PAGE_SIZE < found && (!since || Boolean(oldest && oldest >= since));
    return { files, next: more ? [dourdanQuery(city, request.page + 1)] : [] };
  },
};

export const OWN_SITE_BOARD_PROTOCOLS = Object.freeze({
  'le-port': Object.freeze(lePortProtocol),
  'les-sables-d-olonne': Object.freeze(sablesProtocol),
  sarreguemines: Object.freeze(sarregueminesProtocol),
  caudry: Object.freeze(caudryProtocol),
  'la-queue-en-brie': Object.freeze(queueProtocol),
  'saint-germain-les-arpajon': Object.freeze(sglaProtocol),
  'thorigny-sur-marne': Object.freeze(thorignyProtocol),
  clouange: Object.freeze(clouangeProtocol),
  douvrin: Object.freeze(douvrinProtocol),
  maing: Object.freeze(maingProtocol),
  montesson: Object.freeze(montessonProtocol),
  morangis: Object.freeze(morangisProtocol),
  amilly: Object.freeze(amillyProtocol),
  dourdan: Object.freeze(dourdanProtocol),
});

/** Cart@DS's report, its applicant cell — a company and its representative — left out. */
const readSablesList = (board) => (document, context) => REPORT_BOARD_READERS[`cartds-report-${board}`](document, context)
  .map((row) => ({ ...row, applicant: null }));

// i18n-ignore-next-line — the order's own signing line, matched on
const SARREGUEMINES_SIGNED = /SARREGUEMINES\s*,?\s*le\s+(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/i;

/**
 * One order, the State's form (« Sur un terrain sis à : | 14 rue … »), its
 * signing day off « SARREGUEMINES, le 04.09.2026 » under the articles. On
 * four orders read by OCR on 2026-10-03, every one gave its site and verdict;
 * one lost its number in the scan's box, which the title gives.
 */
function readSarregueminesOrder(document, context) {
  const text = (document?.pages ?? []).flatMap((page) => page.runs ?? []).map((item) => item.text).join(' ');
  const [, day, month, year] = SARREGUEMINES_SIGNED.exec(text) ?? [];
  const signed = day ? municipalDate(`${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`) : null;
  // The title's number is typed; the scan's, read by OCR, may lose a digit.
  return readStateFormOrder(document, context)
    .map((row) => ({ ...row, dossier: context?.file?.row?.dossier ?? row.dossier, decidedOn: row.decidedOn ?? signed }));
}

// i18n-ignore-start — the register's own headers, matched on
/** Its columns, by header word; the applicant's, the owner's and the works' dates are found only to be left out. */
const CAUDRY_COLUMNS = [['type', 'TYPE DE'], ['dossier', 'NUMERO'], ['asked', 'DEMANDE'], ['filed', 'DEPOT'],
  ['complete', 'COMPLET'], ['deadline', 'LIMITE'], ['applicant', 'DEMANDEUR'], ['site', 'ADRESSE TERRAIN'],
  ['owner', 'PROPRIETAIRE'], ['land', 'SF. TERR.(M²)'], ['floor', 'SF. CREEE'], ['parcels', 'PARCELLES'],
  ['works', 'NATURE DES'], ['decision', 'DECISION'], ['opened', 'DOC'], ['completed', 'DAACT']];
const CAUDRY_TOTALS = /^(?:TYPE DE PERMIS|NBRE\. DEPOSE|NOMBRE TOTAL DE DOSSIER)/;
// i18n-ignore-end
/** The permits the layer draws: certificates, pre-emption notices, works in public buildings and signs are not. */
const CAUDRY_PERMIT = /^(?:PC|PCMI|PA|PD|DP|DPC|DPA|DPMI|DPL)$/;

/** `139000AC0147`, `1390000A0819`: commune, prefix, section, number → `AC 0147`. */
export function caudryParcel(value) {
  const match = /^\d{3}\d{3}([A-Z0-9]{2})(\d{4})$/.exec(clean(value));
  if (!match || !/[A-Z]/.test(match[1]) || !Number(match[2])) return null;
  return `${match[1].replace(/^0/, '')} ${match[2]}`;
}

/**
 * The register, one row per dossier, every cell centred in its row and in
 * its column. A run's column is the header nearest its centre; a row is a
 * band of lines, the bands parted by more than a line's pitch — 6.75 points
 * inside a row, 9.75 between two on 28 Aug 2026 (fonts of 6). A band without
 * a type at the top of a page is the end of the last page's row, and the
 * totals by family (« Type de permis », « Nbre. déposé ») end it. A decided
 * dossier is a decision (« 26/01/2026 Accord avec prescriptions »), the
 * others filings. The applicant and the owner, people as often as not, are
 * never read.
 */
function readCaudryRegister(document, { city } = {}) {
  const rows = [];
  let open = null;
  const close = () => {
    if (!open) return;
    const row = caudryRow(open, city);
    if (row) rows.push(row);
    open = null;
  };
  let centres = null;
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((item) => clean(item.text));
    const headers = [];
    for (const [field, words] of CAUDRY_COLUMNS) {
      // `Demande` heads a column, and `demande` is the second line of `Type de`'s: the higher.
      const found = runs.filter((item) => fold(item.text) === words).sort((a, b) => b.y - a.y)[0];
      if (found) headers.push({ field, centre: (found.x + (found.x1 ?? found.x)) / 2, y: found.y });
    }
    // The header heads the first page only; the others keep its columns.
    const header = headers.length === CAUDRY_COLUMNS.length;
    if (header) centres = headers.sort((a, b) => a.centre - b.centre);
    if (!centres) continue;
    const top = header ? Math.min(...headers.map((item) => item.y)) : Infinity;
    const columnOf = (item) => {
      const centre = (item.x + (Number.isFinite(item.x1) ? item.x1 : item.x)) / 2;
      return centres.reduce((best, column) => (Math.abs(column.centre - centre) < Math.abs(best.centre - centre) ? column : best)).field;
    };
    // The header's second line (`demande`, `d'instruction`, `travaux`) sits a line under its first.
    const body = runs.filter((item) => item.y < top - 1.2 * (item.size || 6)).sort((a, b) => b.y - a.y || a.x - b.x);
    const bands = [];
    for (const item of body) {
      const band = bands.at(-1);
      if (band && band.bottom - item.y <= 1.35 * (item.size || 6)) { band.runs.push(item); band.bottom = item.y; } else bands.push({ bottom: item.y, runs: [item] });
    }
    for (const [i, band] of bands.entries()) {
      // The totals by family close the register.
      if (band.runs.some((item) => CAUDRY_TOTALS.test(fold(item.text)))) { close(); return rows; }
      const cells = {};
      for (const item of band.runs) (cells[columnOf(item)] ??= []).push(clean(item.text));
      // A row's type is a code (`DPC`, `CUa`, `AP-REMPL`); the page's footer, a print time, falls under it too.
      if (/^[A-Z]{2,}[A-Za-z-]*$/.test(clean(cells.type?.join(' ')))) {
        close();
        open = cells;
      } else if (i === 0 && open) {
        // Only the first band may run on from the last page; the others are its footer.
        for (const [field, lines] of Object.entries(cells)) (open[field] ??= []).push(...lines);
      }
    }
  }
  close();
  return rows;
}

function caudryRow(cells, city) {
  const join = (field) => clean((cells[field] ?? []).join(' '));
  if (!CAUDRY_PERMIT.test(join('type'))) return null;
  const dossier = municipalDossier((cells.dossier ?? []).join(''), city);
  if (!dossier) return null;
  // `0033 Rue Albert Calmette`: the software pads the house number; `59540 Caudry` alone is no site.
  const site = municipalSite(join('site').replace(/^0+(?=\d)/, ''), city);
  if (/^\d{5}\b/.test(site.address ?? '')) site.address = null;
  const parcels = (cells.parcels ?? []).join(' ').split(/[,\s]+/).map(caudryParcel).filter(Boolean);
  const decision = join('decision');
  const decidedOn = municipalDate(decision);
  const said = clean(decision.replace(/\b\d{2}\/\d{2}\/\d{4}\b/, ''));
  const square = (field) => (/^\d+$/.test(join(field)) && Number(join(field)) > 0 ? join(field) : null);
  return {
    board: decidedOn ? 'decisions' : 'filings', dossier, applicant: null,
    address: site.address, postcode: site.postcode, parcels: parcels.length ? parcels.join(', ') : null,
    purpose: join('works') || null, filedOn: municipalDate(join('filed')),
    verdict: decidedOn ? listVerdict(said) ?? verdicts.signed.fr : null, decidedOn,
    landArea: square('land'), floorArea: square('floor'),
  };
}

// i18n-ignore-start — the order's own labels, matched on
const QUEUE_LABELS = {
  /** « Sur un terrain sis: », which OCR may glue (`terrainsis:`); « Cadastré : »; « Déposé le : ». */
  site: /^(?:Sur|un|terrain|sis|terrainsis|unterrain)\s*:?$/i,
  siteEnd: /sis\s*:?$/i,
  parcels: /^(?:Cadastr[ée]e?s?)\s*:?$/i,
  filed: /^(?:D[ée]pos[ée]e?|le)\s*:?$/i,
  number: /\bN°\s*((?:PC|DP|PA|PD)\s*0?94\s*060\s*\d{2}\s*[A-Z]?\d{4,5}\s*(?:[MT]\d{2})?)/i,
  signed: /Queue[- ]en[- ]Brie\s*,?\s*le\s+(.{6,24})/i,
  operative: /^ARTICLE\s*1\b\s*:?\s*(.*)$/i,
  /** The right-hand column beside the site: `… Brie Destination : habitation`, `… d'intérêt collectif`. */
  aside: /\s+(?:Destination|Surface de plancher|d.int[ée]r[êe]t collectif)\b.*$/i,
};
// i18n-ignore-end

/**
 * The words beside a label, left to right: those of its line (give or take
 * a few points — Tesseract may read the labels as a block of their own, a
 * point or two off their values' baseline) that are not the label's own.
 * OCR glues and misplaces the label's words (`terrainsis:` at 65 points,
 * `un` at 81), so they are told by what they say, not where they sit.
 */
function besideLabel(page, last, words) {
  const runs = page?.runs ?? [];
  const anchor = runs.find((item) => last.test(clean(item.text)));
  if (!anchor) return null;
  return clean(runs.filter((item) => Math.abs(item.y - anchor.y) <= 3.5 && item.x > anchor.x - 20 && !words.test(clean(item.text)))
    .sort((a, b) => a.x - b.x).map((item) => item.text).join(' ').replace(/\s*[|¦{}:]\s*/g, ' ')) || null;
}

/**
 * OCR words in lines, top first. Tesseract gives a line's words one height
 * and in reading order, which is kept: a word's box may start left of the
 * one before it (« Sur un terrain », « terrain » at 55 points, « un » at 73).
 */
function ocrLines(page) {
  const lines = new Map();
  for (const item of page?.runs ?? []) {
    const y = Math.round(item.y * 10) / 10;
    lines.set(y, [...(lines.get(y) ?? []), item.text]);
  }
  return [...lines.entries()].sort((a, b) => b[0] - a[0])
    .map(([, words]) => clean(words.join(' ').replace(/\s*[|¦]\s*/g, ' ')));
}

/**
 * One of La Queue-en-Brie's orders, read by OCR: « N° DP0940602600077 »,
 * « Déposé le : 18/09/2026 », « Sur un terrain sis: | 4, rue … - 94510 La
 * Queue-en-Brie », « Cadastré : AC-0320 », the heading or the operative
 * article, and « La Queue-en-Brie, le 30/09/2026 » (on the second page of a
 * permit, unread). « Par » and « Demeurant », the applicant and their
 * address, are never read. On six orders read on 2026-10-03, every one gave
 * its number, site, parcel and filing day.
 */
function readQueueOrder(document, { city, file } = {}) {
  const [page] = document?.pages ?? [];
  const lines = ocrLines(page);
  const body = lines.join('\n');
  const titled = file?.row ?? null;
  const dossier = municipalDossier(QUEUE_LABELS.number.exec(body)?.[1]?.replace(/\s+/g, '') ?? '', city) ?? titled?.dossier;
  const siteText = besideLabel(page, QUEUE_LABELS.siteEnd, QUEUE_LABELS.site);
  if (!dossier || !siteText) return [];
  const site = municipalSite(clean(siteText.replace(QUEUE_LABELS.aside, '').replace(/\s*[-—–]\s*(?=\d{5}\b)/, ' ')), city);
  if (!site.address) return [];
  const parcels = [...String(besideLabel(page, QUEUE_LABELS.parcels, QUEUE_LABELS.parcels) ?? '').matchAll(/\b([A-Z]{1,2})\s*[-–]\s*(\d{1,4})\b/g)]
    .map(([, section, number]) => `${section} ${number.padStart(4, '0')}`);
  // The heading says it first (« NON-OPPOSITION A UNE DECLARATION », « OPPOSITION A … »); a permit's, its article.
  const heading = municipalVerdict(lines.slice(0, 6).join(' '));
  const operative = municipalVerdict(lines.map((line) => QUEUE_LABELS.operative.exec(line)?.[1]).find(Boolean));
  const signed = QUEUE_LABELS.signed.exec(body)?.[1]?.replace(/(\d)\s*[°º]/, '$1');
  return [{
    ...titled, board: 'decisions', dossier, applicant: null, address: site.address, postcode: site.postcode,
    parcels: parcels.length ? parcels.join(', ') : null, filedOn: municipalDate(besideLabel(page, /^D[ée]pos[ée]e?$/i, QUEUE_LABELS.filed)),
    verdict: heading ?? operative ?? titled?.verdict ?? verdicts.signed.fr, decidedOn: municipalDate(signed),
    postedOn: file?.published ?? titled?.postedOn ?? null,
  }];
}

/** Excel's serial day (`46136`) as ISO (`2026-04-24`), or null. */
export function excelDay(value) {
  const serial = Number(clean(value));
  if (!Number.isInteger(serial) || serial < 40000 || serial > 60000) return null;
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
}

// i18n-ignore-start — the workbook's own headers, matched on
const SGLA_HEADERS = { dossier: /^NUMERO$/, filed: /^DATE DEPOT$/, site: /^ADRESSE DU PROJET$/, works: /^NATURE DU PROJET$/, posted: /^AFFICHAGE LE$/ };
// i18n-ignore-end

/**
 * The workbook's sheet of dossiers under review, as the XLSX path hands it
 * (`{sheet, rows}`): under its header (Numéro, Date
 * dépôt, Demandeur désigné, Adresse du projet, Nature du projet, Affichage
 * le), a row per dossier in sections by family — 18 permits on 2026-10-03,
 * filed from 24 April to 29 September, each with its site. The number is
 * Operis's, its counter split (`PC 091 552 26 1 0006` → `PC 091552 26
 * 10006`); certificates and works in public buildings are left out. The
 * applicant's column, people and companies, is never read.
 */
function readSglaFilings(sheet, { city } = {}) {
  const rows = [];
  let columns = null;
  for (const cells of sheet?.rows ?? []) {
    const folded = cells.map(fold);
    if (!columns) {
      const found = Object.fromEntries(Object.entries(SGLA_HEADERS).map(([field, header]) => [field, folded.findIndex((cell) => header.test(cell))]));
      if (Object.values(found).every((index) => index >= 0)) columns = found;
      continue;
    }
    const number = /^(PC|DP|PA|PD)\s*0?91\s*552\s*(\d{2})\s*(\d)\s*(\d{4})\s*([MT]\s*\d{2})?$/.exec(folded[columns.dossier]);
    const dossier = number ? municipalDossier(`${number[1]} 091552 ${number[2]} ${number[3]}${number[4]}${number[5] ? ` ${number[5].replace(/\s+/g, '')}` : ''}`, city) : null;
    const site = municipalSite(clean(cells[columns.site]), city);
    if (!dossier || !site.address) continue;
    rows.push({ board: 'filings', dossier, applicant: null, address: site.address, postcode: site.postcode,
      purpose: clean(cells[columns.works]) || null, filedOn: excelDay(cells[columns.filed]), postedOn: excelDay(cells[columns.posted]) });
  }
  return rows;
}

// i18n-ignore-start — the sheets' own headers, matched on
const THORIGNY_HEADERS = [['type', /^TYPE$/], ['dossier', /^NUMERO$/], ['filed', /^DATE(?: DE DEPOT)?$/], ['applicant', /^NOM DU DEMANDEUR$/],
  ['site', /^ADRESSE DES TRAVAUX$/], ['works', /^DESCRIPTION DU PROJET$|^DESCRIPTION DES TRAVAUX$/], ['decision', /^DECISION$/],
  ['posted', /^AFFICHE LE$/], ['ends', /^FIN$/]];
// i18n-ignore-end
/** `PD 077 464 26 000 02`, or `077 464 25 000 60 M01` beside its type (`DP`, `DPM`). */
const THORIGNY_NUMBER = /^(?:(PC|DP|PA|PD)M?\s+)?0?77\s*464\s*(\d{2})\s*(\d{3})\s*(\d{2})\s*(?:\/?\s*([MT]\d{2}))?$/i;

/**
 * The columns of a sheet printed from Excel: each cell starts at its
 * column's left edge and the header is centred over it, so the starts are
 * clustered, and a cluster belongs to the header its widest run overlaps
 * most — a short « Pose d'un portail » starts with the long works beside it.
 */
function sheetColumns(runs, headers) {
  const clusters = [];
  for (const item of [...runs].sort((a, b) => a.x - b.x)) {
    const right = Number.isFinite(item.x1) ? item.x1 : item.x;
    const near = clusters.at(-1);
    if (near && item.x - near.start < 4) near.end = Math.max(near.end, right); else clusters.push({ start: item.x, end: right });
  }
  for (const cluster of clusters) {
    cluster.field = headers.reduce((best, header) => {
      const overlap = Math.min(cluster.end, header.x1) - Math.max(cluster.start, header.x);
      return overlap > best.overlap ? { overlap, field: header.field } : best;
    }, { overlap: -Infinity, field: null }).field;
  }
  return (item) => [...clusters].reverse().find((cluster) => item.x - cluster.start > -0.5)?.field ?? null;
}

/**
 * One of Thorigny's sheets: a row per decision, Excel's cells set a few
 * points off one another (`PD 077 464 26 000 02` at 447, its site at 451),
 * so a row is the runs within five points of its number. A works cell of
 * several lines is read for its line beside the number only. The
 * applicant's column, people mostly, is never read. On 2026-10-03: 5 permits
 * decided from 9 July to 28 August and 13 declarations from 6 July to
 * 2 September, every one with its site.
 */
function readThorignyDecisions(document, { city } = {}) {
  const rows = [];
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((item) => clean(item.text));
    const headers = [];
    for (const [field, pattern] of THORIGNY_HEADERS) {
      const found = runs.find((item) => pattern.test(fold(item.text)));
      if (found) headers.push({ field, x: found.x, x1: Number.isFinite(found.x1) ? found.x1 : found.x, y: found.y });
    }
    if (!['dossier', 'site', 'decision', 'posted'].every((field) => headers.some((header) => header.field === field))) continue;
    const bottom = Math.min(...headers.map((header) => header.y));
    const body = runs.filter((item) => item.y < bottom - 4);
    const columnOf = sheetColumns(body, headers);
    for (const anchor of body.filter((item) => THORIGNY_NUMBER.test(clean(item.text)))) {
      const band = body.filter((item) => Math.abs(item.y - anchor.y) <= 5 && item !== anchor);
      const cell = (field) => clean(band.filter((item) => columnOf(item) === field).sort((a, b) => a.x - b.x).map((item) => item.text).join(' '));
      const [, prefix, year, hundreds, units, suffix] = THORIGNY_NUMBER.exec(clean(anchor.text));
      const kind = prefix ?? /^(PC|DP|PA|PD)/i.exec(cell('type'))?.[1];
      const dossier = kind ? municipalDossier(`${kind.toUpperCase()} 077464 ${year} ${hundreds}${units}${suffix ? ` ${suffix}` : ''}`, city) : null;
      const site = municipalSite(cell('site').replace(/\s+,/g, ','), city);
      if (!dossier || !site.address) continue;
      const decision = cell('decision');
      const decidedOn = municipalDate(decision);
      rows.push({ board: 'decisions', dossier, applicant: null, address: site.address, postcode: site.postcode,
        purpose: cell('works') || null, filedOn: municipalDate(cell('filed')),
        verdict: (decidedOn && listVerdict(clean(decision.replace(/^.*?\d{2}\/\d{2}\/\d{4}\s*-?\s*/, '')))) || verdicts.signed.fr,
        decidedOn, postedOn: municipalDate(cell('posted')) });
    }
  }
  return rows;
}

// --- Morangis: two sheets printed from Excel ---------------------------------

// i18n-ignore-start — the sheets' own column titles and the town's street kinds
/**
 * Where each column of Morangis's sheets starts, in points right of a header
 * word's own start — « Voirie » on the permits', « ADRESSE » on the
 * declarations' — measured on the editions of 2 October 2026.
 */
const MORANGIS_SHEETS = Object.freeze({
  permits: { header: /^VOIRIE$/, columns: [[-207, 'verdict'], [-151, 'applicant'], [-7, 'number'], [33, 'street'], [164, 'works'], [309, 'decided'], [364, 'posted']] },
  declarations: { header: /^ADRESSE$/, columns: [[-520, 'filed'], [-453, 'applicant'], [-289, 'works'], [-85, 'number'], [-50, 'street'], [95, 'verdict'], [155, 'decided']] },
});
const MORANGIS_KINDS = Object.freeze({ av: 'avenue', bd: 'boulevard', pl: 'place', place: 'place', rue: 'rue', all: 'allée',
  allee: 'allée', 'allée': 'allée', imp: 'impasse', impasse: 'impasse', ch: 'chemin', chemin: 'chemin', sq: 'square',
  square: 'square', sente: 'sente', sentier: 'sentier', voie: 'voie', cours: 'cours', quai: 'quai', rte: 'route', route: 'route',
  passage: 'passage', villa: 'villa', mail: 'mail' });
// i18n-ignore-end

/**
 * A street as the sheets index it, its kind after its name — « Armée Leclerc
 * (av de l') », « Hirondelles (rue des) », « Lucien Boilleau (place) » — put
 * back in order: « avenue de l'Armée Leclerc ».
 */
export function morangisStreet(value) {
  const text = clean(value);
  const match = /^(.+?)\s*\(\s*([\p{L}]+)\.?(?:\s+(.*?))?\s*\)$/u.exec(text);
  if (!match) return text || null;
  const [, name, kind, article] = match;
  const join = article ? (/['’]$/.test(article) ? article : `${article} `) : '';
  return clean(`${MORANGIS_KINDS[kind.toLowerCase()] ?? kind} ${join}${name}`);
}

/** A day typed with a slash missing (`26/022026`). */
const morangisDay = (value) => municipalDate(clean(value).replace(/\b(\d{2})\/(\d{2})(\d{4})\b/, '$1/$2/$3'));

/**
 * One page's runs by column, or null before the sheet's header: a run is the
 * column whose start is the last at or left of it, and a page printed
 * without the header (the declarations' after the first) keeps the last
 * one's columns. A house number glued to its street (`119 bisCour de France
 * (av de la)`) is split.
 */
function morangisCells(page, sheet, last = null) {
  const runs = (page.runs ?? []).filter((item) => clean(item.text));
  const found = runs.find((item) => sheet.header.test(fold(item.text)));
  const header = found ?? (last ? { x: last.x, y: Infinity } : null);
  if (!header) return null;
  const fieldOf = (item) => sheet.columns.findLast(([offset]) => item.x >= header.x + offset - 0.5)?.[1] ?? 'dossier';
  const body = [];
  // The sheet's title and the page's number, printed on every page.
  for (const item of runs.filter((candidate) => candidate.y < header.y - 4 && !/^(?:PAGE \d+|DP 20\d{2})$/.test(fold(candidate.text)))) {
    const field = fieldOf(item);
    const glued = field === 'number' ? /^(\d{1,4}\s*(?:bis|ter)?)\s*(\p{Lu}.*)$/u.exec(clean(item.text)) : null;
    if (glued) body.push({ ...item, field, text: glued[1] }, { ...item, field: 'street', text: glued[2] });
    else body.push({ ...item, field });
  }
  return { body, header };
}

/** A band's cell: its runs top to bottom, left to right. */
const morangisCell = (band, field) => clean(band.filter((item) => item.field === field)
  .sort((a, b) => (b.y - a.y) || (a.x - b.x)).map((item) => item.text).join(' ')) || null;

function morangisSite(band, city) {
  const indexed = morangisCell(band, 'street');
  const street = morangisStreet(indexed);
  // A second house number under the first (`11` / `15`) is the same site's.
  const number = clean(band.filter((item) => item.field === 'number').sort((a, b) => b.y - a.y)[0]?.text);
  // A cell with neither a number nor a street's kind names no site here (« SAVIGNY-SUR-ORGE »).
  const site = street && (number || /\(/.test(indexed)) ? clean(`${number} ${street}`) : null;
  return municipalSite(site, city);
}

/** `091 432 23 1 0021` over `M 01`, `091 432 25 0005 M 01`: the commune's code, the year, the counter. */
const MORANGIS_PERMIT = /^0?91\s*432\s*(\d{2})\s*((?:\d\s*)?\d{4,5})\s*(?:([MT])\s*(\d{1,2}))?$/;

/**
 * Morangis's permits decided in the year: a row per decision — the number,
 * the decision (ACCORD, REFUS, RETRAIT, annulation), the applicant, the
 * house number and the street, the works, the day of the decision and of its
 * posting. The works cell grows upwards from the row's line, and a
 * modification's number takes two lines (`091 432 24 1 0017` / `T 02`): a
 * row is every run from just under the row above down to its own line,
 * which the decision marks. The applicant's column is never read. The
 * edition of 2 October 2026: 28 decisions, 26 January to 28 September, each
 * with its site.
 */
function readMorangisPermits(document, { city } = {}) {
  const rows = [];
  let header = null;
  for (const page of document?.pages ?? []) {
    const cells = morangisCells(page, MORANGIS_SHEETS.permits, header);
    if (!cells) continue;
    const { body } = cells;
    header = cells.header;
    const anchors = body.filter((item) => item.field === 'verdict').sort((a, b) => b.y - a.y);
    anchors.forEach((anchor, i) => {
      const top = i ? anchors[i - 1].y - 4 : Infinity;
      const band = body.filter((item) => item.y > anchor.y - 4 && item.y <= top);
      const number = MORANGIS_PERMIT.exec(morangisCell(band, 'dossier') ?? '');
      if (!number) return;
      const [, year, counter, kind, rank] = number;
      const dossier = municipalDossier(`PC 091432 ${year} ${counter.replace(/\s/g, '').padStart(5, '0')}${kind ? ` ${kind}${rank.padStart(2, '0')}` : ''}`, city);
      const site = morangisSite(band, city);
      const said = morangisCell(band, 'verdict');
      if (!dossier) return;
      rows.push({ board: 'decisions', dossier, applicant: null, address: site.address, postcode: site.postcode,
        purpose: morangisCell(band, 'works'), verdict: municipalVerdict(said) ?? listVerdict(said) ?? verdicts.signed.fr,
        decidedOn: morangisDay(morangisCell(band, 'decided')), postedOn: morangisDay(morangisCell(band, 'posted')) });
    });
  }
  return rows;
}

/**
 * Morangis's declarations of the year: a row per dossier — its short number
 * (`26 00099`, the commune's code left out), the filing day, the applicant,
 * the works, the house number and the street, the decision (« Non /
 * opposition ») and its day, each cell centred on the row's line: a row is
 * the band halfway to its neighbours. A declaration not yet decided is a
 * filing. The applicant's column is never read. The edition of 2 October
 * 2026: 95 declarations filed from 8 January to 7 September, 93 decided (17
 * opposed) to 17 September, all but one with its site.
 */
function readMorangisDeclarations(document, { city } = {}) {
  const rows = [];
  let header = null;
  for (const page of document?.pages ?? []) {
    const cells = morangisCells(page, MORANGIS_SHEETS.declarations, header);
    if (!cells) continue;
    const { body } = cells;
    header = cells.header;
    const anchors = body.filter((item) => item.field === 'dossier' && /^\d{2}\s*\d{4,5}\b/.test(clean(item.text))).sort((a, b) => b.y - a.y);
    anchors.forEach((anchor, i) => {
      // A cell of four lines reaches 24 points either side of its row's line.
      const top = i ? (anchors[i - 1].y + anchor.y) / 2 : anchor.y + 28;
      const bottom = anchors[i + 1] ? (anchor.y + anchors[i + 1].y) / 2 : anchor.y - 28;
      const band = body.filter((item) => item.y < top && item.y >= bottom);
      const dossier = municipalDossier(`DP ${clean(anchor.text)}`, city);
      if (!dossier) return;
      const site = morangisSite(band, city);
      const said = morangisCell(band, 'verdict');
      const decidedOn = morangisDay(morangisCell(band, 'decided'));
      const decided = Boolean(said || decidedOn);
      rows.push({ board: decided ? 'decisions' : 'filings', dossier, applicant: null, address: site.address, postcode: site.postcode,
        purpose: morangisCell(band, 'works'), filedOn: morangisDay(morangisCell(band, 'filed')),
        ...(decided ? { verdict: municipalVerdict(said) ?? listVerdict(said) ?? verdicts.signed.fr, decidedOn } : {}) });
    });
  }
  return rows;
}

// --- Amilly: two sheets printed from Excel -------------------------------------

// i18n-ignore-start — the sheets' own column titles
const AMILLY_COLUMNS = [['filed', /^DATE DE DEPOT\b/], ['dossier', /^NUMERO DE DEMANDE$/], ['applicant', /^NOM DU DEMANDEUR$/],
  ['site', /^ADRESSE DU LOT$/], ['parcels', /^PARCELLES?$/], ['kind', /^OBJET DU DOSSIER$|^OBJET DE L.ARRETE$/],
  ['verdict', /^DECISION$/], ['decided', /^DATE DE SIGNATURE\b/]];
// i18n-ignore-end

/**
 * Amilly's two sheets: one row per dossier, every cell centred on its column
 * and on its row — a run is the column whose title's middle is nearest its
 * own, and the row whose number's line is nearest its line (a site's
 * parcels may take three lines across it). The filings' sheet gives the
 * filing day, the number (`DP0450042600100`), the applicant, the site, the
 * parcels and the family; the decisions' the number, the applicant, the
 * site, the parcels — under no title of their own, between the site's and
 * the family's — the family, the decision and the day it was signed. The
 * applicant's column, persons mostly, is never read; certificates and
 * alignment orders are not the layer's. The editions of 30 September 2026:
 * 46 permits and declarations filed from 10 March to 1 October, and 77
 * decisions (74 dossiers) signed from 30 June to 30 September, each with
 * its site and its parcels.
 */
function readAmillyList(document, { city } = {}) {
  const rows = [];
  for (const page of document?.pages ?? []) {
    const runs = (page.runs ?? []).filter((item) => clean(item.text));
    const headers = [];
    for (const [field, pattern] of AMILLY_COLUMNS) {
      const found = runs.find((item) => pattern.test(fold(item.text)));
      if (found) headers.push({ field, middle: (found.x + (Number.isFinite(found.x1) ? found.x1 : found.x)) / 2, y: found.y, run: found });
    }
    if (!['dossier', 'site'].every((field) => headers.some((header) => header.field === field))) continue;
    const middleOf = (field) => headers.find((header) => header.field === field)?.middle;
    // The decisions' parcels have no title: their column lies between the site's and the family's.
    if (!middleOf('parcels') && middleOf('kind')) headers.push({ field: 'parcels', middle: (middleOf('site') + middleOf('kind')) / 2 });
    const decided = headers.some((header) => header.field === 'verdict');
    const top = Math.min(...headers.filter((header) => header.run).map((header) => header.y));
    const columnOf = (item) => {
      const middle = (item.x + (Number.isFinite(item.x1) ? item.x1 : item.x)) / 2;
      return headers.reduce((best, header) => (Math.abs(header.middle - middle) < Math.abs((best?.middle ?? Infinity) - middle) ? header : best), null)?.field;
    };
    const body = runs.filter((item) => item.y < top - 1 && !headers.some((header) => header.run === item))
      .map((item) => ({ ...item, field: columnOf(item) }));
    // Every number cell holds a row, a row without one too (`NEANT`, an order on ownerless land): its cells are its own.
    const anchors = body.filter((item) => item.field === 'dossier').sort((a, b) => b.y - a.y);
    const cells = anchors.map(() => ({}));
    for (const field of new Set(body.map((item) => item.field))) {
      if (field === 'applicant' || field === 'dossier') continue;
      // A column's runs in blocks of lines eight points apart (rows are twelve or more):
      // a block is one cell, the row's whose number is nearest its middle.
      const blocks = [];
      for (const item of body.filter((candidate) => candidate.field === field).sort((a, b) => b.y - a.y)) {
        const block = blocks.at(-1);
        if (block && block.at(-1).y - item.y < 9) block.push(item); else blocks.push([item]);
      }
      for (const block of blocks) {
        const middle = (block[0].y + block.at(-1).y) / 2;
        let at = -1;
        anchors.forEach((anchor, i) => { if (at < 0 || Math.abs(anchor.y - middle) < Math.abs(anchors[at].y - middle)) at = i; });
        if (at >= 0 && Math.abs(anchors[at].y - middle) < 20) (cells[at][field] ??= []).push(...block);
      }
    }
    anchors.forEach((anchor, i) => {
      const cell = (field) => clean((cells[i][field] ?? []).sort((a, b) => (b.y - a.y) || (a.x - b.x)).map((item) => item.text).join(' ')) || null;
      const dossier = municipalDossier(anchor.text, city);
      if (!dossier || dossier.startsWith('CU')) return;
      const site = municipalSite(cell('site'), city);
      const said = cell('verdict');
      rows.push({ board: decided ? 'decisions' : 'filings', dossier, applicant: null, address: site.address, postcode: site.postcode,
        parcels: typedParcels(cell('parcels')),
        ...(decided ? { verdict: listVerdict(said) ?? verdicts.signed.fr, decidedOn: municipalDate(cell('decided')) }
          : { filedOn: municipalDate(cell('filed')) }) });
    });
  }
  return rows;
}

// --- Dourdan: a Word table through Ghostscript, and scanned orders ---------------

// i18n-ignore-start — the table's own column titles
const DOURDAN_COLUMNS = [['filed', /^DATE DE DEPOT$/], ['dossier', /^NUMERO DE DOSSIER$/], ['applicant', /^PETITIONNAIRE$/],
  ['site', /^ADRESSE DU PROJET$/], ['works', /^DESCRIPTION DU PROJET$/]];
const DOURDAN_FOOTER = /^PAGE \d+ SUR \d+$/;
// i18n-ignore-end

/**
 * Dourdan's list of the dossiers filed (« VILLE DE DOURDAN — Dossiers
 * déposés au 15 septembre 2026 »): a Word table printed through Ghostscript,
 * which keeps none of its cells' rectangles — the filing day, the number
 * (`DP 91200 26 10089`, a modification's `M01` under it), the applicant,
 * the site over its postcode and the works, each cell hanging from its
 * row's top and left-aligned under its title. A row runs from its number
 * down to the next, on to the top of the next page; signs (`AP`) and works
 * in buildings open to the public (`AT`) bound their rows and are not kept.
 * The applicant's column is never read. The edition of 15 September 2026:
 * 22 permits and declarations filed from 3 June, each with its site.
 */
function readDourdanFilings(document, { city } = {}) {
  const rows = [];
  let columns = null;
  let open = null;
  const close = () => {
    if (!open) return;
    // Some editions print an apostrophe as an underscore (« Rue de l_Ermitage »).
    const cell = (field) => clean((open.cells[field] ?? []).sort((a, b) => (a.page - b.page) || (b.y - a.y) || (a.x - b.x))
      .map((item) => item.text).join(' ').replace(/(?<=\p{L})_(?=\p{L})/gu, '’')) || null;
    const dossier = municipalDossier(cell('dossier'), city);
    const site = municipalSite(cell('site'), city);
    if (dossier && site.address) {
      rows.push({ board: 'filings', dossier, applicant: null, address: site.address, postcode: site.postcode,
        purpose: cell('works'), filedOn: municipalDate(cell('filed')) });
    }
    open = null;
  };
  (document?.pages ?? []).forEach((page, index) => {
    const runs = (page.runs ?? []).filter((item) => clean(item.text) && !DOURDAN_FOOTER.test(fold(item.text)));
    const found = [];
    for (const [field, pattern] of DOURDAN_COLUMNS) {
      const run = runs.find((item) => pattern.test(fold(item.text)));
      if (run) found.push({ field, x: run.x, y: run.y });
    }
    if (found.length === DOURDAN_COLUMNS.length) columns = found.sort((a, b) => a.x - b.x);
    if (!columns) return;
    const top = found.length === DOURDAN_COLUMNS.length ? Math.min(...found.map((column) => column.y)) - 2 : Infinity;
    const fieldOf = (item) => columns.findLast((column) => item.x >= column.x - 5)?.field ?? columns[0].field;
    const body = runs.filter((item) => item.y < top).map((item) => ({ ...item, page: index, field: fieldOf(item) }));
    // A row's cells hang from its number's line: a run a few points above it (another font's
    // baseline) is its row's already, one above that is the row before — or the last page's.
    const anchors = body.filter((item) => item.field === 'dossier' && /^[A-Z]{2}\s*\d/.test(clean(item.text))).sort((a, b) => b.y - a.y);
    const opened = anchors.map(() => ({ cells: {} }));
    const carried = open;
    for (const item of body) {
      if (item.field === 'applicant') continue;
      const at = anchors.findLastIndex((anchor) => anchor.y + 3 >= item.y);
      const row = at < 0 ? carried : opened[at];
      if (row) (row.cells[item.field] ??= []).push(item);
    }
    for (const row of opened) {
      close();
      open = row;
    }
  });
  close();
  return rows;
}

/**
 * A Dourdan order, scanned, read by OCR as DematDOC's notices are: its
 * verdict, works, filing day and parcels. Its number and site are its
 * title's, typed by the service, where OCR's may run on into the next
 * label (« lot 8 Destination : Habitation »).
 */
function readDourdanOrder(document, context) {
  const title = context?.file?.row;
  return PERMIT_LIST_READERS['dematdoc-notice'](document, context).map((row) => (title
    ? { ...row, dossier: title.dossier, address: title.address ?? row.address, postcode: title.postcode ?? row.postcode, postedOn: title.postedOn }
    : row));
}

export const OWN_SITE_BOARD_READERS = Object.freeze({
  'le-port-filings': readOperisWordGrid('filings'),
  'le-port-decisions': readOperisWordGrid('decisions'),
  'les-sables-d-olonne-filings': readSablesList('filings'),
  'les-sables-d-olonne-decisions': readSablesList('decisions'),
  'sarreguemines-order': readSarregueminesOrder,
  'caudry-register': readCaudryRegister,
  'la-queue-en-brie-order': readQueueOrder,
  'sgla-filings': readSglaFilings,
  'thorigny-decisions': readThorignyDecisions,
  'morangis-permits': readMorangisPermits,
  'morangis-declarations': readMorangisDeclarations,
  'amilly-list': readAmillyList,
  'dourdan-filings': readDourdanFilings,
  'dourdan-order': readDourdanOrder,
});
