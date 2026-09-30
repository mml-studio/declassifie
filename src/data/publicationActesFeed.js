/**
 * @module data/publicationActesFeed
 *
 * *Actes publiés* — the permit decisions a commune publishes as acts on
 * publication-actes.fr, and the lists of filed dossiers it publishes beside
 * them.
 *
 * WHY A FOURTH REGISTER. Since 1 July 2022 a commune's acts are published
 * electronically (CGCT, art. L.2131-1), and a family of communes of the
 * Pays basque, Touraine and the Loiret publish theirs, permit decisions
 * included, through Mégalis Bretagne's white-label platform. Ustaritz (64547)
 * is the case that made the layer read it: 182 decisions published in 2026 by
 * 30 September against 19 rows in Sitadel, because a fence, a pool or a set of
 * windows creates no floor area and Sitadel never holds them. A reader looking
 * for a fence granted there on 21 September found nothing.
 *
 * ── The protocol ────────────────────────────────────────────────────────────
 * One open JSON endpoint, no key: `GET <api>/search?query=&siren=<SIREN>
 * &classifications=2&lignes=100`, paged by the opaque `page_suivante` the
 * previous page returned. `classifications=2` is the @CTES nomenclature's
 * « Urbanisme », subclasses included. Each act carries its title (`objet`),
 * the date it was signed (`date_acte`), the date it was published
 * (`date_publication`) and the URL of its PDF. `nb_resultats` counts more than
 * the pages return — 23 against 5 for one commune, measured 2026-09-30 — so
 * the pages are read to their end and the count is never trusted.
 *
 * ── Trap 1: the act is a scan, its title is the data ────────────────────────
 * The arrêtés are scanned signed paper (Konica, Ricoh copiers): no text, and
 * no OCR on this server. What a decision says is its TITLE, typed by the town
 * hall, and every commune types it its own way — {@link parseActTitle} reads
 * the three spellings of the communes read here:
 *
 *   Ustaritz  `DP2600901 : Opposition modification dépendance`
 *   Ciboure   `DECISION REFUS - DP2600902 - 5 rue X - remplacement clôture`
 *   Monts     `2024-177U DP0371592449901 - 21 rue Y`
 *
 * ── Trap 2: a plain decision is a granted one, where the commune says so ────
 * A title names its verdict only when the verdict is NO: Ustaritz writes
 * `Opposition`, `Refus`, `rejet tacite`, `Annulation` in front of 21 of its
 * 193 dossier titles and nothing in front of the rest; Ciboure writes
 * `DECISION REFUS`, `REJET TACITE`, `SANS SUITE` on 30 of 257 and `DECISION`
 * on the rest. A title with no verdict is therefore read as the commune's
 * grant — but only for the communes whose titles were counted, each flagged
 * `plainDecision: 'accorde'` in {@link PUBLICATION_ACTES_COMMUNES}. The card
 * says « Accordé » for those, which is what the arrêté itself says.
 *
 * ── Trap 3: the decision says what, the list says where ─────────────────────
 * An Ustaritz title carries no address. Every two weeks the commune publishes
 * a « liste des dépôts » — a table exported from Excel with the dossier number,
 * the applicant, the parcels, the nature of the works and the filing date —
 * and it is TEXT, so {@link parseDepositList} reads it (through `pdfText.js`)
 * and {@link foldPublicationActes} joins it to the decision on the dossier
 * number. The list is also the freshest thing published: a dossier is on it
 * within two weeks of its filing, a month or two before any decision.
 * Measured 2026-09-30: 33 lists since November 2025, 28 of them text, five
 * scanned; the fence above is on the list of 21 August, with its parcel.
 *
 * ── Trap 4: the list names private people ───────────────────────────────────
 * The applicant column is a name for most rows, and the titles of other
 * communes carry one too (`Accord Mme …`). A commune may publish them; a
 * reuser republishing them is processing personal data for its own purpose.
 * Only an organisation's name is kept (`permitApplicant.js`), and a title is
 * never relayed whole: the nature and the address are cut out of it.
 *
 * ── Trap 5: one number, three spellings ─────────────────────────────────────
 * `DP2600901` in a title, `DP 64 547 2600901` in a list, `DP 064547 26 00901`
 * on the panneau and in Sitadel. {@link publicationActesDossier} writes all
 * three as the last one, so `dossierKey` joins them to each other and to the
 * State's register.
 *
 * Dependency-free and side-effect-free (no Cesium, no DOM, no fetch): the
 * `/api/ads-fr` proxy imports it; nothing in the browser bundle does.
 */

import { COMMUNE_CODE_PATTERN } from './communeCode.js';
import { organisationApplicant } from './permitApplicant.js';
import { ADS_KINDS, dossierKey, seriesOfKind } from './adsFeed.js';
import { ADS_STATE_WORDS } from './adsFeed.i18n.js';
import { cartdsParcelIdus, cartdsVerdictState, foldCartdsDossiers } from './cartdsFeed.js';

/** The search endpoint of the platform's open API. */
export const PUBLICATION_ACTES_API = 'https://data-api.publication-actes.fr/mq_apis/actes/v1/search';

/** Acts asked for per page — the most the endpoint returns. */
export const PUBLICATION_ACTES_PAGE_LENGTH = 100;

/** Pages read per commune before giving up, and saying so. Monts, the
 *  largest, has 602 urbanism acts since 2021: seven pages. */
export const PUBLICATION_ACTES_MAX_PAGES = 12;

/** Lists of filed dossiers read per commune, newest first — a year and a half
 *  of fortnightly lists. */
export const PUBLICATION_ACTES_MAX_LISTS = 40;

/** How the reuse of a published act is licensed. */
// i18n-ignore-next-line — a legal reference, relayed as metadata
export const PUBLICATION_ACTES_LICENCE = 'Information publique — CRPA, art. L.321-1';

/**
 * The communes read, from a measurement and not a catalogue.
 *
 * On 2026-09-30 the platform held 6 307 urbanism acts from 108 authorities. Of
 * those, the ones that publish PERMIT decisions under a dossier number:
 *
 * - Ustaritz (64547): 193 dossier titles, 65 since June, and 28 text lists;
 * - Ciboure (64189): 246, 62 since June, the address in every title;
 * - Monts (37159): 520 from 2021 to February 2026, the address in the title,
 *   and nothing since — kept for the three years the layer draws by default.
 *
 * Left out, and why:
 *
 * - Montbazon (37154, 626): the titles and the receipts name the dossier, the
 *   applicant and nothing of the site; the arrêtés are separate PDFs.
 * - Veigné (37266, 434): a local numbering (`DP 2026-136`) and a name, no site.
 * - Ferrières-en-Gâtinais (45145, 362): no dossier number, a name, a scan.
 *
 * `lists` says the commune publishes text lists of filed dossiers (Trap 3).
 * `plainDecision` is Trap 2's reading, set only where the titles were counted.
 */
export const PUBLICATION_ACTES_COMMUNES = Object.freeze([
  Object.freeze({
    insee: '64547',
    siren: '216405472',
    label: 'Ustaritz — actes publiés', // i18n-ignore-line — the publisher and its page
    postcode: '64480',
    plainDecision: 'accorde',
    lists: true,
  }),
  Object.freeze({
    insee: '64189',
    siren: '216401893',
    label: 'Ciboure — actes publiés', // i18n-ignore-line — the publisher and its page
    postcode: '64500',
    plainDecision: 'accorde',
    lists: false,
  }),
  Object.freeze({
    insee: '37159',
    siren: '213701592',
    label: 'Monts — actes publiés', // i18n-ignore-line — the publisher and its page
    postcode: '37260',
    plainDecision: 'accorde',
    lists: false,
  }),
]);

/**
 * The commune entry for an INSEE code, or null.
 * @param {?string} communeCode
 * @returns {?object} One of {@link PUBLICATION_ACTES_COMMUNES}.
 */
export function publicationActesCommuneFor(communeCode) {
  const code = String(communeCode ?? '').trim().toUpperCase();
  if (!COMMUNE_CODE_PATTERN.test(code)) return null;
  return PUBLICATION_ACTES_COMMUNES.find((commune) => commune.insee === code) ?? null;
}

/**
 * One page of a commune's urbanism acts.
 * @param {object} commune One of {@link PUBLICATION_ACTES_COMMUNES}.
 * @param {?string} [cursor] The previous page's `page_suivante`.
 * @returns {string}
 */
export function publicationActesSearchUrl(commune, cursor = null) {
  const params = new URLSearchParams({
    query: '',
    siren: commune.siren,
    classifications: '2',
    lignes: String(PUBLICATION_ACTES_PAGE_LENGTH),
  });
  if (cursor) params.set('page_suivante', cursor);
  return `${PUBLICATION_ACTES_API}?${params}`;
}

/** Trim a value to a non-empty string, or null. */
function text(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).replace(/\s+/g, ' ').trim();
  return trimmed || null;
}

/** `2026-09-24T00:00:00Z` → `2026-09-24`, or null. */
function isoDay(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''));
  return match ? match[1] : null;
}

/** `30/07/2026` or `30/07/26` → `2026-07-30`, or null. */
export function frenchDay(value) {
  const match = /(\d{2})\/(\d{2})\/(\d{4}|\d{2})\b/.exec(String(value ?? ''));
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2]}-${match[1]}`;
}

/** The families the layer draws; `AT`, `AP` (signs) and the rest are not. */
const KINDS = ['PC', 'DP', 'PA', 'PD', 'CU'];

/**
 * A dossier number, in any of Trap 5's spellings, as the panneau prints it.
 *
 * @param {string} kind `PC`, `DP`…
 * @param {?string} raw The number as published, with or without its family.
 * @param {string} insee The commune that published it.
 * @returns {?string} `DP 064547 26 00901`, or null for a number that is not
 *   one of the three spellings.
 */
export function publicationActesDossier(kind, raw, insee) {
  const commune = String(insee ?? '').toUpperCase();
  let flat = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (flat.startsWith(kind)) flat = flat.slice(kind.length);
  const suffix = /(?:M|T)\d{1,2}$/.exec(flat);
  let tail = '';
  if (suffix && flat.length - suffix[0].length >= 7) {
    tail = `${suffix[0][0]}${suffix[0].slice(1).padStart(2, '0')}`;
    flat = flat.slice(0, -suffix[0].length);
  }
  if (flat.startsWith(`0${commune}`)) flat = flat.slice(6);
  else if (flat.startsWith(commune) && flat.length > 9) flat = flat.slice(5);
  if (!/^\d{2}[A-Z]?\d{4,5}$/.test(flat)) return null;
  return `${kind} 0${commune} ${flat.slice(0, 2)} ${flat.slice(2)}${tail}`;
}

/**
 * The dossier token in a title: its family and its number as written.
 *
 * `DP2600901`, `PC22B0901M01`, `PC23B0902 M01`, `PC24B0903-M1`,
 * `DP645472600904`, `DP0371592449905`. A bare number with no family
 * (`DECISION - 2600125 - …`, seven Ciboure titles) is not a dossier this
 * reader can place in a series, and is left out.
 */
const DOSSIER_TOKEN = /\b(PC|DP|PA|PD|CU)\s?((?:\d\s?){5,13}|\d{2}\s?[A-Z]\s?\d{4})(\s?-?\s?[MT]\s?\d{1,2})?(?![0-9])/i;

/** A title that is a list of filed dossiers, not a decision. */
const LIST_TITLE = /\blistes?\b.{0,12}\bd[ée]p[oô]ts?\b/i;

/** A title that says a dossier was FILED — a receipt or a filing notice. */
const FILING_TITLE = /r[ée]c[ée]piss[ée]|avis de d[ée]p[oô]t|\bd[ée]p[oô]t d/i;

/**
 * The verdict words a title opens with (Trap 2), longest first so that
 * « Opposition tacite » is not read as « Opposition » and a nature left over.
 */
// i18n-ignore-start — the communes' own words, matched on
const VERDICT_WORDS = /^(?:d[ée]cision\s+)?(non[\s-]opposition|opposition\s+tacite|opposition(?:\s+[àa]\s+(?:la\s+r[ée]alisation\s+du\s+projet\s+de|une?|la|l[’']))?|refus(?:\s+tacite)?|rejet\s+tacite|rejet|annulation(?:\s+[àa]\s+la\s+demande\s+du\s+p[ée]titionnaire)?|retrait|sans\s+suite|accord(?:\s+avec\s+prescriptions?)?)\b[\s.:,;-]*/i;
// i18n-ignore-end

/** A segment that starts like a street address. */
// i18n-ignore-next-line — French street words, matched on
const ADDRESS_START = /^(?:\d+\s*(?:bis|ter|[A-Z])?\s*,?\s*)?(?:rue|avenue|av\.?|impasse|imp\.?|chemin|chem\.?|all[ée]e|route|rte|place|boulevard|bd|quai|lotissement|lot\.?|square|cours|r[ée]sidence|hameau|voie|passage|sentier|rond-point|esplanade|cit[ée]|domaine|clos|carrefour|mail)\b/i;

/**
 * What a title says, cut into the parts the layer relays.
 *
 * Never the title whole: some carry the applicant's name (Trap 4), and the
 * parts are what the card prints anyway.
 *
 * @param {?string} title The act's `objet`.
 * @returns {?{kind: string, number: string, verdict: ?string,
 *   filing: boolean, address: ?string, purpose: ?string}}
 *   Null for a title with no dossier of a drawn family.
 */
export function parseActTitle(title) {
  const value = text(title);
  if (!value || LIST_TITLE.test(value)) return null;
  const token = DOSSIER_TOKEN.exec(value);
  if (!token) return null;
  const kind = token[1].toUpperCase();
  if (!KINDS.includes(kind)) return null;
  const number = `${token[2]}${token[3] ?? ''}`.replace(/\s+/g, '');
  const before = value.slice(0, token.index);
  let rest = value.slice(token.index + token[0].length).replace(/^[\s:;,–-]+/, '');
  // The verdict may come before the number (Ciboure) or after it (Ustaritz,
  // Monts), and only in the first words either way.
  let verdict = null;
  const lead = VERDICT_WORDS.exec(before.replace(/^[\s\d_U/-]+/, '').replace(/[\s:;,–-]+$/, ''));
  if (lead) verdict = lead[1];
  const after = VERDICT_WORDS.exec(rest);
  if (after) {
    verdict ??= after[1];
    rest = rest.slice(after[0].length);
  }
  const parts = rest.split(/\s+[-–]\s+|\s*[-–]\s+|\s+[-–]\s*/).map(text).filter(Boolean);
  let address = null;
  if (parts.length && ADDRESS_START.test(parts[0])) address = parts.shift();
  const purpose = text(parts.join(' – '));
  return {
    kind,
    number,
    verdict: text(verdict),
    filing: FILING_TITLE.test(value),
    address,
    purpose,
  };
}

/** Whether an act is a list of filed dossiers (Trap 3). */
export function isDepositList(act) {
  return LIST_TITLE.test(String(act?.objet ?? ''));
}

/** The same state words `adsFeed.js` publishes, in the payload's French. */
function stateFrench(state) {
  return ADS_STATE_WORDS.definition[state].fr;
}

/**
 * Where a decision leaves its dossier, on the shared ladder.
 *
 * A verdict the title names is read like a Cart@DS verdict. A title that names
 * none is the commune's `plainDecision` (Trap 2), or no state at all where the
 * titles were not counted — drawn as « État non publié », which is true.
 *
 * @param {object} commune One of {@link PUBLICATION_ACTES_COMMUNES}.
 * @param {?string} verdict
 * @returns {{state: ?string, label: ?string}}
 */
export function publicationActesState(commune, verdict) {
  const read = cartdsVerdictState(verdict);
  if (read) return { state: read, label: stateFrench(read) };
  if (verdict) return { state: null, label: text(verdict) };
  const plain = commune?.plainDecision ?? null;
  return plain ? { state: plain, label: stateFrench(plain) } : { state: null, label: null };
}

/** Shape shared by both halves of the register. */
function basePermit(commune, kind, dossier) {
  const series = seriesOfKind(kind);
  return {
    dossier,
    series,
    key: `${series}|${dossierKey(dossier)}`,
    kind,
    kindLabel: ADS_KINDS[kind] ?? kind,
    startedOn: null,
    completedOn: null,
    depositYear: null,
    commune: null,
    communeCode: commune.insee,
    cadastreCommune: commune.insee,
    landAreaM2: null,
    housing: null,
    surfaceCreatedM2: null,
    lots: null,
    lon: null,
    lat: null,
    precision: null,
    geocodeScore: null,
    parts: null,
    source: 'publication-actes',
    sourceLabel: commune.label,
  };
}

/**
 * One published act → the shape every source of the layer is normalised into.
 *
 * @param {object} commune One of {@link PUBLICATION_ACTES_COMMUNES}.
 * @param {object} act One `resultats` entry of the search endpoint.
 * @returns {?object} Null for an act that is not a dossier decision or filing.
 */
export function normalisePublicationActe(commune, act) {
  const title = parseActTitle(act?.objet);
  if (!title) return null;
  const dossier = publicationActesDossier(title.kind, title.number, commune.insee);
  if (!dossier) return null;
  const signed = isoDay(act.date_acte);
  const decided = title.filing ? null : publicationActesState(commune, title.verdict);
  return {
    ...basePermit(commune, title.kind, dossier),
    id: `publication-actes:${commune.insee}:${dossier}`,
    state: decided ? decided.state : 'depose',
    stateLabel: decided ? decided.label : stateFrench('depose'),
    depositedOn: title.filing ? signed : null,
    decidedOn: title.filing ? null : signed,
    postedOn: isoDay(act.date_publication),
    applicant: null,
    purpose: title.purpose ?? (ADS_KINDS[title.kind] ?? null),
    address: title.address,
    postcode: title.address ? commune.postcode : null,
    parcels: [],
    parcelIdus: [],
  };
}

/**
 * A cell's text, with Office's lost ligature put back.
 *
 * Word and Excel set French in Calibri with a « ti » ligature, and two of the
 * five exports read here print it with no character: `pdfText.js` marks the
 * hole, PDFCreator writes a `?`. Across the 28 text lists of Ustaritz, 22
 * distinct words carry the hole between two letters, and 21 of them read
 * right with « ti » (`Construc·on`, `bâ·r`, `Lo·ssement`); the 22nd is
 * Calibri's « tt » (`perme·ra`), which nothing on the page tells apart.
 */
function mendCell(value) {
  return text(String(value ?? '')
    .replace(/(?<=\p{L})[?\uFFFD](?=\p{L})/gu, 'ti')
    .replace(/\uFFFD/g, ''));
}

/** A list row's number: `DP 64 547 2600901`, family first. */
const LIST_NUMBER = /^(PC|DP|PA|PD|CU|AP|AT)\s*((?:\d\s?){10,13}|(?:\d\s?){5,8}[A-Z]?\s?\d{0,4})(\s?[MT]\s?\d{1,2})?\b/i;

/** One parcel in a list cell: `AB 0012`, `ZC 0159`. */
const LIST_PARCEL = /\b([A-Z]{1,2}|0[A-Z])\s?(\d{1,4})\b/g;

/** A cell that is nothing but parcels: `ZC 0159, ZC 0161, ZC 0162`. */
const PARCEL_CELL = /^(?:(?:[A-Z]{1,2}|0[A-Z])\s?\d{1,4}[A-Z]?\s*[,;/et]*\s*)+$/i;

/** A cell that is nothing but a date. */
const DATE_CELL = /^\d{2}\/\d{2}\/(?:\d{4}|\d{2})$/;

/** The destinations the software offers — a column, not a nature. */
// i18n-ignore-next-line — the software's own vocabulary, matched on
const DESTINATION_CELL = /^(?:habitation|autres annexes|commerce|bureaux?|artisanat|industrie|entrep[oô]t|exploitation (?:agricole|foresti[èe]re)|h[ée]bergement|restauration|constructions?,? installations? (?:n[ée]cessaires? )?(?:aux |de )?services publics.*|[ée]quipements? d.int[ée]r[êe]t collectif.*)$/i;

/**
 * The rows of a list of filed dossiers.
 *
 * A row starts at a run that reads as a dossier number, at the left of the
 * table. The other runs are first gathered into CELLS — runs drawn one after
 * the other at the same left edge, a line apart — and a cell belongs to the
 * row whose number sits within its height. Not to the nearest number, and not
 * to the band below a number: the lists read here align their cells both
 * ways. Excel's own export puts a three-line nature at the top of its row,
 * level with the number; the PDFCreator print of 21 August 2026 centres it,
 * so its first line sits ABOVE the number, and a band would give it to the
 * row before.
 *
 * A cell's field is read from WHAT IT HOLDS and where it stands in the row,
 * not from the header's position: four of the five exports centre their
 * headers over left-aligned data, and one prints two headers as one run. The
 * parcels and the filing date say what they are; the applicant is the first
 * cell after the number, the address the one after it where the list has an
 * address column, and the nature the last cell before the date.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document `extractPdfText`'s answer.
 * @returns {Array<{kind: string, number: string, applicant: ?string,
 *   address: ?string, parcels: Array<{prefix: null, section: string,
 *   numero: string, label: string}>, purpose: ?string, depositedOn: ?string}>}
 */
export function parseDepositList(document) {
  const rows = [];
  let hasAddress = false;
  for (const page of document?.pages || []) {
    const runs = page.runs || [];
    const header = runs.find((run) => /^num[ée]ro\b/i.test(run.text));
    if (header) {
      hasAddress = runs.some((run) => Math.abs(run.y - header.y) <= header.size * 1.6
        && /\badresse\b/i.test(run.text));
    }
    const below = (run) => !header || run.y < header.y - header.size * 0.5;
    const candidates = runs.filter((run) => below(run) && LIST_NUMBER.test(run.text));
    if (!candidates.length) continue;
    const left = Math.min(...candidates.map((run) => run.x));
    const anchors = candidates
      .filter((run) => run.x - left < run.size * 2)
      .sort((a, b) => b.y - a.y);
    const anchorSet = new Set(anchors);

    // Cells: consecutive runs at one left edge, each a line below the last.
    const cells = [];
    let open = null;
    for (const run of runs) {
      if (anchorSet.has(run) || !below(run) || run.x - left < run.size * 2) { open = null; continue; }
      const last = open?.runs[open.runs.length - 1];
      const drop = last ? last.y - run.y : null;
      if (open && Math.abs(last.x - run.x) < run.size * 0.5 && drop > 0 && drop <= run.size * 1.8) {
        open.runs.push(run);
        continue;
      }
      open = { x: run.x, runs: [run] };
      cells.push(open);
    }

    const byAnchor = new Map(anchors.map((anchor) => [anchor, []]));
    for (const cell of cells) {
      const ys = cell.runs.map((run) => run.y);
      const slack = cell.runs[0].size * 0.6;
      const top = Math.max(...ys) + slack;
      const bottom = Math.min(...ys) - slack;
      const middle = (top + bottom) / 2;
      const inside = anchors.filter((anchor) => anchor.y <= top && anchor.y >= bottom);
      const pool = inside.length ? inside : anchors;
      let owner = pool[0];
      for (const anchor of pool) {
        if (Math.abs(anchor.y - middle) < Math.abs(owner.y - middle)) owner = anchor;
      }
      byAnchor.get(owner).push(cell);
    }

    for (const anchor of anchors) {
      // Two cells at one left edge in one row are one cell, split by a gap.
      const merged = new Map();
      for (const cell of byAnchor.get(anchor)) {
        const key = [...merged.keys()].find((x) => Math.abs(x - cell.x) < cell.runs[0].size * 0.5) ?? cell.x;
        merged.set(key, [...(merged.get(key) || []), ...cell.runs]);
      }
      const ordered = [...merged.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, list]) => mendCell(list.sort((a, b) => (b.y - a.y) || (a.x - b.x)).map((run) => run.text).join(' ')))
        .filter(Boolean);
      const parcelAt = ordered.findIndex((cell) => PARCEL_CELL.test(cell));
      const dateAt = ordered.findIndex((cell) => DATE_CELL.test(cell));
      const end = dateAt >= 0 ? dateAt : ordered.length;
      const head = ordered.slice(0, parcelAt >= 0 ? parcelAt : Math.min(end, hasAddress ? 2 : 1));
      const tail = ordered.slice(parcelAt >= 0 ? parcelAt + 1 : head.length, end)
        .filter((cell) => !DESTINATION_CELL.test(cell) && !PARCEL_CELL.test(cell));
      let applicant = head[0] ?? null;
      let address = hasAddress ? (head[1] ?? null) : null;
      if (hasAddress && head.length === 1 && ADDRESS_START.test(head[0])) {
        address = head[0];
        applicant = null;
      }
      const token = LIST_NUMBER.exec(anchor.text);
      const parcels = [];
      const parcelText = parcelAt >= 0 ? ordered[parcelAt].toUpperCase() : '';
      for (const match of parcelText.matchAll(LIST_PARCEL)) {
        const label = `${match[1]} ${Number.parseInt(match[2], 10)}`;
        if (parcels.some((parcel) => parcel.label === label)) continue;
        parcels.push({ prefix: null, section: match[1], numero: match[2], label });
      }
      rows.push({
        kind: token[1].toUpperCase(),
        number: `${token[2]}${token[3] ?? ''}`.replace(/\s+/g, ''),
        applicant,
        address,
        parcels,
        purpose: tail.length ? text(tail.join(' ')) : null,
        depositedOn: dateAt >= 0 ? frenchDay(ordered[dateAt]) : null,
      });
    }
  }
  return rows;
}

/**
 * One row of a list → a FILED dossier, in the shared shape.
 *
 * @param {object} commune One of {@link PUBLICATION_ACTES_COMMUNES}.
 * @param {object} row One of {@link parseDepositList}'s rows.
 * @param {?object} [act] The list's act, for the date it was published.
 * @returns {?object} Null for a family the layer does not draw.
 */
export function normaliseDepositRow(commune, row, act = null) {
  if (!row || !KINDS.includes(row.kind)) return null;
  const dossier = publicationActesDossier(row.kind, row.number, commune.insee);
  if (!dossier) return null;
  return {
    ...basePermit(commune, row.kind, dossier),
    id: `publication-actes:${commune.insee}:${dossier}`,
    // A list says FILED, and nothing about a review (Cart@DS's Trap 4).
    state: 'depose',
    stateLabel: stateFrench('depose'),
    depositedOn: row.depositedOn,
    decidedOn: null,
    postedOn: isoDay(act?.date_publication) ?? isoDay(act?.date_acte),
    // TRAP 4: an organisation keeps its name, a person never gets through.
    applicant: organisationApplicant(row.applicant),
    purpose: row.purpose ?? (ADS_KINDS[row.kind] ?? null),
    address: row.address,
    postcode: row.address ? commune.postcode : null,
    parcels: row.parcels.map((parcel) => parcel.label),
    parcelIdus: cartdsParcelIdus(row.parcels, commune.insee),
  };
}

/**
 * One row per dossier out of the decisions and the lists.
 *
 * The same fold as a Cart@DS commune's two boards, for the same reason: a
 * decision knows the state and its date, the list knows the ground, the filing
 * date and the fuller nature, and a dossier is both. The decision wins the
 * state; the nature the list typed wins over a title's short one.
 *
 * @param {Array<object>} permits Normalised acts and list rows, any order.
 * @returns {{permits: Array<object>, folded: number}}
 */
export function foldPublicationActes(permits) {
  const { permits: folded, folded: count } = foldCartdsDossiers(permits);
  const listed = new Map();
  for (const permit of permits) {
    if (permit.decidedOn === null && permit.parcels.length && permit.purpose) {
      listed.set(`${permit.kind}|${permit.key}`, permit.purpose);
    }
  }
  return {
    permits: folded.map((permit) => {
      const nature = listed.get(`${permit.kind}|${permit.key}`);
      return nature && permit.decidedOn ? { ...permit, purpose: nature } : permit;
    }),
    folded: count,
  };
}
