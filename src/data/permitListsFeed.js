/**
 * @module data/permitListsFeed
 *
 * *Listes d'autorisations d'urbanisme* — the lists of filed and decided
 * permits a city publishes on its own website as PDF files, read as tables.
 *
 * WHY A FIFTH REGISTER. A check of the sixty most populous communes with no
 * fresh permit source, on 2026-10-01, found thirteen that post neither a
 * Cart@DS nor a Sirap board but publish the same information as PDF lists:
 * Marseille and Nîmes among them. Marseille posts two lists on its urbanism
 * page — every dossier still under review (1 874 on 2026-09-28, 1 083 of them
 * filed that year) and every authorisation granted in the last two months
 * (825 from 16 July to 29 September) — where Sitadel's housing file holds 190
 * authorisations for the whole of 2026, the latest decided on 21 September,
 * and never a déclaration préalable that creates no floor area. Nîmes posts
 * one file of 60 pages: 348 dossiers under review and 321 decided, 86 of them
 * refused.
 *
 * ── The protocol ────────────────────────────────────────────────────────────
 * One HTML page per city, read for its links ({@link permitListLinks}), and one
 * PDF per list, read by `pdfText.js` into positioned text runs. A list is found
 * by the words of its link or its file name, never by a file name alone:
 * Marseille names its files by date (`28.09.26.pdf`, `affichage-du-16.07.26-
 * au-29.09.26.pdf`) and replaces them every few weeks.
 *
 * ── Trap 1: two table layouts ───────────────────────────────────────────────
 * The list of dossiers under review is the REGISTER the Cart@DS instruction
 * software prints, the same at Marseille and Nîmes: six columns, each record
 * several lines high, every cell aligned to the record's top line — the line
 * that reads « Déposé le … » ({@link readRegisterList}). The same software
 * prints its register of decisions in the same layout, the deadline column
 * replaced by the decision, and Nîmes appends it to the same file. Marseille's list of
 * granted authorisations is a spreadsheet exported from LibreOffice: thirteen
 * columns, one row per dossier, every cell centred on the row's middle, where
 * the dossier number is ({@link readDecisionTable}). Neither file draws a rule
 * a reader could find, so rows and columns are rebuilt from where the text
 * sits: columns from the header words, rows from the one run every record has.
 *
 * ── Trap 2: the lists forget ────────────────────────────────────────────────
 * A dossier leaves the first list when it is decided and the second two months
 * after, and the files are replaced, not appended to. So every row read is
 * kept, through the same archive as a posted board (`cartdsArchive.js`, {@link
 * PERMIT_LIST_ROWS}) and the same daily sweep, and the layer draws the archive.
 *
 * ── Trap 3: a list of dossiers under review says so, while it is current ────
 * Unlike a filing notice (Trap 4 of `cartdsFeed.js`), the register is titled
 * « dossiers en cours d'instruction » / « Registre des dossiers en cours »: on
 * the edition that lists it, a dossier IS under review, by the city's own
 * statement. Once a later edition no longer lists it, the city has decided it,
 * and Marseille never publishes a refusal — its second list holds grants only
 * (460 « Accord Tacite », 320 « Favorable avec Reserves », 45 « Favorable » on
 * 2026-09-29). So a row of the current edition is `instruction`, and a row an
 * edition has dropped falls back to `depose`, the claim that still holds.
 *
 * ── Trap 4: the lists name private people ───────────────────────────────────
 * The DEMANDEUR column is the applicant as written on the form, with the
 * applicant's own postal address under it. Only the first line is read, cut
 * before anything that looks like an address, and it goes through the same
 * filter as every other register (`permitApplicant.js`) before the row is even
 * stored; the address is never kept.
 *
 * ── Trap 5: Marseille writes its numbers with a suffix ──────────────────────
 * `PC 013055 26 00230P0` on the list, `0130552600230` in Sitadel: the
 * instruction software's `P0` marks the original dossier, and `M01`, `T01` a
 * modification or a transfer. The `P0` is dropped ({@link
 * permitListDossier}) so the two registers meet on `dossierKey`; a
 * modification keeps its suffix, as everywhere else in the layer. Nîmes writes
 * its numbers as Sitadel does (`PC 030189 24 P0240`), and needs nothing.
 *
 * ── Trap 6: some cities publish their lists as acts ─────────────────────────
 * Lyon and Béziers post no link to a list: they publish each one as an act on
 * Digitech's Webdelib+ platform, one page per month of acts. A reading walks
 * the months back ({@link webdelibMonths}), keeps the acts whose titles a
 * list names ({@link webdelibLists}) and opens each through the script
 * redirect the platform writes ({@link webdelibFileUrl}). The layouts are two
 * more: Lyon writes records in Word, not a table ({@link readLyonList}), and
 * Béziers exports grids whose cells hang from the top of their row ({@link
 * readGridTable}).
 *
 * ── Trap 7: Lyon's platform forbids robots ─────────────────────────────────
 * `lyon-webdelib.digitechcloud.fr/robots.txt` is `Disallow: /` for every
 * agent (2026-10-01). Lyon is read by the project's decision, as five Cart@DS
 * hosts are (Trap 5 of `cartdsFeed.js`), and says so with `robots:
 * 'overridden'`: what it publishes there is the posting the Code de
 * l'urbanisme makes public, and the platform sets no barrier — no login, no
 * challenge, no cookie.
 *
 * ── Trap 8: Limoges posts its decisions as scans ───────────────────────────
 * Limoges publishes every act on DigiContent's « Arcade Portail », whose
 * public JSON search answers without a key ({@link arcadeSearchUrl}): 647
 * urbanism acts from 15 June to 1 October 2026, one per decision. The arrêté
 * is a 600-dpi scan with no text, but its TITLE is the dossier number
 * (`PC2600135_DECISION_SIGNEE`, `DP_ARRÊTÉ_2600984 ÉTAT`) and the act carries
 * the day it was signed and the day it was published — so a decision is read
 * without opening its file ({@link limogesDecisionRow}). Not its verdict: the
 * shelf says « délivrés », but 5 of 27 arrêtés read by OCR on 2026-10-01 were
 * no grant (one refused permit, three oppositions to a déclaration préalable,
 * one withdrawal). So the row says what the title says, « Décision signée »,
 * off the ladder, until Sitadel or nothing says more. The place comes from the
 * other kind of act, a list of the dossiers filed over a month or two
 * ({@link readLimogesList}): text, an address and no parcel, folded onto the
 * decision by its number.
 *
 * ── Trap 9: Lille's decisions are scans in a daily bulletin ────────────────
 * Lille publishes every arrêté it signs in its « Bulletin officiel » (BO VDL),
 * one PDF per working day, 181 linked from one page on 2026-10-01 ({@link
 * bulletinLinks}). Every page is a scan — a JPEG background under a JBIG2
 * mask, no text — so the bulletin is read by OCR (`scripts/lib/pdfOcr.mjs`),
 * on the server, in the daily sweep and never for a visitor. Most pages are
 * other acts: 14 bulletins sampled held 703 pages, 290 of them the pages of
 * 95 urbanism arrêtés, in 7 of the 14 (none on 27 March's 148 pages, 25 on
 * 29 September's 78). An urbanism arrêté prints its number at the top of
 * every page (`DOSSIER N° PC 059350 26 00051`, `PAGE 2/3`), so a page is
 * known by its top alone ({@link bulletinPageWorthReading}) and an arrêté is
 * the run of pages its number spans ({@link readLilleBulletin}). The number is
 * voted over those pages ({@link bulletinDossier}): OCR read `00149`, `00140`
 * and `60140` on the three pages of PC 059350 26 00140. Hellemmes and Lomme,
 * Lille's associated communes, are in the same bulletin under the same code,
 * as Sitadel files them (`0593502600024`, 88 bis rue Jules Guesde, Hellemmes).
 * The verdict is the first article's (`Il n'est pas fait opposition`, `Le
 * permis de construire est REFUSE`), the site the first page's « Sur un
 * terrain situé ». The sentence before it names the applicant and their own
 * address: it is never read.
 *
 * Dependency-free and side-effect-free (no Cesium, no DOM, no fetch): link
 * discovery, table reading and normalisation only. The `/api/ads-fr` proxy and
 * `scripts/lib/permitLists.mjs` import it; nothing in the browser bundle does.
 */

import { foldToCommune } from './communeCode.js';
import { organisationApplicant } from './permitApplicant.js';
import { ADS_KINDS, dossierKey, formatDossier, seriesOfKind } from './adsFeed.js';
import { ADS_STATE_WORDS } from './adsFeed.i18n.js';
import {
  MUNICIPAL_PERMIT_SOURCES, municipalDossier, readMunicipalNotice, readBalmaTable, readWattrelosTable, saintPriestGridSpec,
} from './municipalPermitsFeed.js';
import { EXTENDED_PERMIT_SOURCES, readBloisFilings, readExtendedNotice } from './municipalPermitExtensions.js';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { DEMATDOC_PERMIT_SOURCES, readDematdocNotice } from './dematdocFeed.js';
import { DIGILOR_TOWNS } from './digilorTowns.js';
import {
  CARTDS_LICENCE, cartdsDate, cartdsKind, cartdsParcelIdus, cartdsProject, cartdsVerdictState, parseCartdsPlace,
} from './cartdsFeed.js';

/** Trim a value to a non-empty string, or null. */
function text(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).replace(/\s+/g, ' ').trim();
  return trimmed || null;
}

/** The same state words `adsFeed.js` publishes, in the payload's French. */
function stateFrench(state) {
  return ADS_STATE_WORDS.definition[state].fr;
}

/** Upper case, no accents, single spaces: the form header words are matched in. */
function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

/** How the reuse of a published list is licensed: as for a posted board. */
export const PERMIT_LISTS_LICENCE = CARTDS_LICENCE;

/** The two lists a city may publish, as the archive names them. */
export const PERMIT_LIST_BOARDS = Object.freeze({ filings: 'filings', decisions: 'decisions' });

/**
 * The cities read, the page that links their lists, and how each list is
 * found and read.
 *
 * FROM A MEASUREMENT, as `CARTDS_INSTANCES` is: every list here was read on
 * 2026-10-01 and every dossier number it prints came out as a row — Marseille
 * 1 874 under review and 825 granted, Nîmes 348 under review and 321 decided,
 * ten files of Lyon's (2 006 numbers) and four of Béziers's (531). Every host
 * but Lyon's lets a robot read the pages and the files (Trap 7).
 *
 * `source` says how the lists are found: absent, from the links of `page`;
 * `webdelib`, as acts on a Webdelib+ platform (Trap 6); `arcade`, as acts on
 * an Arcade portal, decisions by their titles (Trap 8); `bulletin`, as the
 * scanned arrêtés of a daily bulletin, read by OCR in the daily sweep alone
 * (Trap 9). `underReview` says the list of filings is a list of dossiers
 * still under review (Trap 3). `crawlDelayMs` is a host's own pause between
 * two requests, where it asks for more than the sweep's second.
 *
 * `communes` is every code the BAN may answer for the city: Marseille's
 * sixteen arrondissements as well as the commune, as for Paris's portal.
 * `link` is matched against a link's words and its address together.
 */
export const PERMIT_LISTS = Object.freeze([
  Object.freeze({
    key: 'brive',
    insee: '19031',
    label: 'Ville de Brive-la-Gaillarde — dossiers d’urbanisme déposés et décidés', // i18n-ignore-line — the publisher and its lists
    page: 'https://www.brive.fr/urbanisme/affichage-municipal-autorisations-durbanisme/',
    source: Object.freeze({
      kind: 'webdev',
      portal: 'https://doc.brive.org/service30_publication_reglementaire/',
      publisher: 'Ville de Brive', // i18n-ignore-line — the publisher's menu label
      directory: 'VDB/DOCUMENTS/',
      fileBase: 'https://dunfw.brive.org/SERVICE30_PUBREG/VDB/DOCUMENTS/',
    }),
    // i18n-ignore-start — the words of the city's four current table links
    lists: Object.freeze([
      Object.freeze({ board: 'filings', layout: 'grid', title: /\bd[ée]p[ôo]t\s+DP$/i }),
      Object.freeze({ board: 'decisions', layout: 'grid', title: /\bd[ée]cision\s+DP$/i }),
      Object.freeze({ board: 'filings', layout: 'grid', title: /\bd[ée]p[ôo]t\s+Permis$/i }),
      Object.freeze({ board: 'decisions', layout: 'grid', title: /\bd[ée]cision\s+Permis$/i }),
    ]),
    // i18n-ignore-end
  }),
  Object.freeze({
    key: 'marseille',
    insee: '13055',
    underReview: true,
    label: 'Ville de Marseille — autorisations d’urbanisme en cours et délivrées', // i18n-ignore-line — the publisher and its lists
    page: 'https://www.marseille.fr/logement-urbanisme/plan-local-durbanisme/renseignements-durbanisme',
    lists: Object.freeze([
      // i18n-ignore-start — the words of the city's own links, matched on
      Object.freeze({ board: 'filings', layout: 'register', link: /dossiers en cours d.instruction/i }),
      Object.freeze({ board: 'decisions', layout: 'decisions', link: /autorisations d[ée]livr[ée]es/i }),
      // i18n-ignore-end
    ]),
  }),
  Object.freeze({
    key: 'nimes',
    insee: '30189',
    underReview: true,
    label: 'Ville de Nîmes — registre des dossiers en cours', // i18n-ignore-line — the publisher and its list
    page: 'https://www.nimes.fr/mon-quotidien/urbanisme/autorisations-durbanisme',
    lists: Object.freeze([
      Object.freeze({ board: 'filings', layout: 'register', link: /registre_dossiers/i }),
    ]),
  }),
  Object.freeze({
    key: 'saint-joseph-974',
    insee: '97412',
    underReview: true,
    label: 'Ville de Saint-Joseph — registre des dossiers en cours', // i18n-ignore-line — the publisher and its list
    page: 'https://saintjoseph.re/Demande-d-urbanisme-en-ligne-3460',
    lists: Object.freeze([
      Object.freeze({ board: 'filings', layout: 'register', link: /registre_dossiers/i }),
    ]),
  }),
  Object.freeze({
    key: 'lyon',
    insee: '69123',
    label: 'Ville de Lyon — autorisations d’urbanisme déposées et délivrées', // i18n-ignore-line — the publisher and its lists
    page: 'https://lyon-webdelib.digitechcloud.fr/webdelibplus_Central/jsp/summary_orders.jsp?role=usager',
    // `Disallow: /` for every agent on 2026-10-01. Read by the project's
    // decision of that day, as five Cart@DS hosts are: what is read is the
    // legal posting of the Code de l'urbanisme (art. R.423-6, R.424-15).
    robots: 'overridden',
    source: Object.freeze({
      kind: 'webdelib',
      base: 'https://lyon-webdelib.digitechcloud.fr/webdelibplus_Central',
      tab: 'summary_orders',
    }),
    lists: Object.freeze([
      // i18n-ignore-next-line — the titles of the city's own acts, matched on
      Object.freeze({ layout: 'lyon', title: /droit des sols|d[ée]clarations pr[ée]alables d[ée]pos[ée]es pendant/i }),
    ]),
  }),
  Object.freeze({
    key: 'beziers',
    insee: '34032',
    label: 'Ville de Béziers — dossiers d’urbanisme déposés et décidés', // i18n-ignore-line — the publisher and its lists
    page: 'https://actes.beziers.fr/webdelibplus/jsp/legal.jsp?role=usager',
    source: Object.freeze({
      kind: 'webdelib',
      base: 'https://actes.beziers.fr/webdelibplus',
      tab: 'legal',
    }),
    lists: Object.freeze([
      // i18n-ignore-start — the titles of the city's own documents, matched on
      // A list of filed dossiers holds every one still open (« déposés avant
      // le … »): the newest of each family says everything the older ones did.
      Object.freeze({ board: 'filings', layout: 'grid', title: /^d[ée]p[ôo]t\s+(PC|DP|PA|PD)\b/i, latest: true }),
      Object.freeze({ board: 'decisions', layout: 'grid', title: /^(PC|DP|PA|PD)\s+d[ée]cid[ée]e?s\b/i }),
      // i18n-ignore-end
    ]),
  }),
  Object.freeze({
    key: 'jouy-en-josas',
    insee: '78322',
    postcode: '78350',
    name: 'Jouy-en-Josas',
    label: 'Ville de Jouy-en-Josas — décisions d’urbanisme', // i18n-ignore-line — the publisher and its acts
    page: 'https://jouyenjosas-webdelibplus.digitechcloud.fr/webdelibplus/jsp/summary_orders.jsp?role=usager',
    // `Disallow: /` for every agent on 2026-10-04, as Lyon's platform (Trap 7):
    // what is read is the legal posting of the Code de l'urbanisme (art. R.424-15).
    robots: 'overridden',
    source: Object.freeze({
      kind: 'webdelib',
      base: 'https://jouyenjosas-webdelibplus.digitechcloud.fr/webdelibplus',
      tab: 'summary_orders',
    }),
    // One act per decision, its title the verdict and the number
    // (« DÉCISION DE NON-OPPOSITION A UNE DÉCLARATION PRÉALABLE N° 0783222600038 … »),
    // its PDF text: number, filing day, site, parcel and the article's verdict.
    // 23 published from July to September 2026, 21 read with their site; two
    // signed for the State are not (a scan, a number short of two digits).
    lists: Object.freeze([
      // i18n-ignore-next-line — the titles of the city's own acts, matched on
      Object.freeze({ board: 'decisions', layout: 'dematdoc-notice', title: /\b(?:PERMIS\s+D(?:E\s+CONSTRUIRE|E\s+D[ÉE]MOLIR|['’]\s*AM[ÉE]NAGER)|D[ÉE]CLARATION\s+PR[ÉE]ALABLE)\b/i }),
    ]),
  }),
  Object.freeze({
    key: 'aix',
    insee: '13001',
    underReview: true,
    label: 'Ville d’Aix-en-Provence — dossiers d’urbanisme déposés et délivrés', // i18n-ignore-line — the publisher and its lists
    page: 'https://sig2aix.mairie-aixenprovence.fr/arcopolepro/resources/jsp/aixenprovence/urbanisme/ADS/view.jsp',
    // Esri's ArcOpole application, one page holding both tables.
    source: Object.freeze({ kind: 'arcopole' }),
    lists: Object.freeze([]),
  }),
  Object.freeze({
    key: 'argenteuil',
    insee: '95018',
    label: 'Ville d’Argenteuil — autorisations d’urbanisme déposées et décidées', // i18n-ignore-line — the publisher and its lists
    page: 'https://datahall.mydigilor.fr/web/',
    source: Object.freeze({
      kind: 'digilor',
      base: 'https://datahall.mydigilor.fr',
      app: 133,
      // « URBANISME / DÉV. DURABLE », and its filings' and decisions' shelves.
      category: 1882,
      filings: 2170,
      decisions: 2172,
    }),
    lists: Object.freeze([Object.freeze({ layout: 'grid' })]),
  }),
  Object.freeze({
    key: 'mulhouse',
    insee: '68224',
    label: 'Ville de Mulhouse — dossiers d’urbanisme déposés et délivrés', // i18n-ignore-line — the publisher and its lists
    page: 'https://www.mulhouse.fr/mes-demarches/proprietaire-locataire/permis-de-construire/',
    lists: Object.freeze([
      // i18n-ignore-start — the words of the city's own links, matched on
      // Every edition covers only the weeks since the one before: all are read.
      Object.freeze({ board: 'filings', layout: 'grid', link: /d[ée]pos[ée]s\s+(?:jusqu|avant)/i, all: true }),
      Object.freeze({ board: 'decisions', layout: 'grid', link: /(?:d[ée]livr[ée]s|d[ée]cid[ée]s)\s+jusqu/i, all: true }),
      // i18n-ignore-end
    ]),
  }),
  Object.freeze({
    key: 'annecy',
    insee: '74010',
    underReview: true,
    label: 'Ville d’Annecy — demandes déposées et autorisations délivrées', // i18n-ignore-line — the publisher and its lists
    page: 'https://www.annecy.fr/ville/amenagement/urbanisme',
    // The page is a JavaScript shell; its content is served as JSON.
    source: Object.freeze({ kind: 'typo3', api: 'https://www.annecy.fr/api/ville/amenagement/urbanisme' }),
    lists: Object.freeze([
      // i18n-ignore-start — the headings of the city's own download blocks
      Object.freeze({ board: 'filings', layout: 'annecy-filings', link: /demandes d[ée]pos[ée]es/i }),
      Object.freeze({ board: 'decisions', layout: 'annecy-decisions', link: /autorisations d[ée]livr[ée]es/i }),
      // i18n-ignore-end
    ]),
  }),
  Object.freeze({
    key: 'clermont',
    insee: '63113',
    underReview: true,
    label: 'Ville de Clermont-Ferrand — autorisations d’urbanisme déposées et décidées', // i18n-ignore-line — the publisher and its lists
    page: 'https://clermont-ferrand.fr/informations-legales-durbanisme',
    // The host sends its certificate without the Sectigo intermediate that
    // signed it, as the `pemb.fr` boards do: the reader supplies it
    // (`trustCartdsIntermediates`).
    intermediate: 'sectigo-ov-r36',
    lists: Object.freeze([
      // i18n-ignore-start — the words of the city's own links, matched on
      Object.freeze({ board: 'decisions', layout: 'clermont', link: /d[ée]cid[ée]es|affichage d[ée]cisions/i }),
      // The filings' link answered 404 on 2026-10-01: a missing list of
      // filings leaves the decisions to be read.
      Object.freeze({ board: 'filings', layout: 'clermont', link: /d[ée]pos[ée]es|affichage d[ée]p[ôo]ts/i, optional: true }),
      // i18n-ignore-end
    ]),
  }),
  Object.freeze({
    key: 'versailles',
    insee: '78646',
    label: 'Ville de Versailles — registres des autorisations d’urbanisme déposées et décidées', // i18n-ignore-line — the publisher and its lists
    page: 'https://drive.google.com/embeddedfolderview?id=0B2R5I00QUlOKUTlya2RCUGpQWFE',
    // Drive's robots.txt disallows a folder's listing and a file's download;
    // read by the project's decision, as Lyon's platform is: the folder is the
    // one the city's urbanism page links, « Tous les dossiers déposés et
    // acceptés par année ».
    robots: 'overridden',
    // A folder per year, in each a folder per board — their names typed by
    // hand: `Dossiers déposés`, ` dossiers déposés`, `Dossiers acceptés`.
    source: Object.freeze({ kind: 'drive', root: '0B2R5I00QUlOKUTlya2RCUGpQWFE' }),
    lists: Object.freeze([
      // i18n-ignore-start — the city's own folder names, matched on
      Object.freeze({ board: 'filings', layout: 'versailles', folder: /d[ée]pos/i }),
      Object.freeze({ board: 'decisions', layout: 'versailles', folder: /d[ée]cid|accept/i }),
      // i18n-ignore-end
    ]),
  }),
  Object.freeze({
    key: 'larochelle',
    insee: '17300',
    label: 'Ville de La Rochelle — demandes et décisions d’urbanisme', // i18n-ignore-line — the publisher and its lists
    page: 'https://affichagelegal.larochelle.fr/demandes-d-autorisations-d-urbanisme/depots-des-demandes-d-urbanisme',
    // `robots.txt` disallows the file proxy of both spaces (`…/-/espace`).
    // Read by the project's decision, as Lyon's platform is: the files are
    // the city's « affichage légal », which keeps them three to five months.
    robots: 'overridden',
    source: Object.freeze({
      kind: 'liferay',
      base: 'https://affichagelegal.larochelle.fr',
      shelves: Object.freeze([
        Object.freeze({
          board: 'filings', layout: 'larochelle-filings',
          path: '/demandes-d-autorisations-d-urbanisme/depots-des-demandes-d-urbanisme',
          instance: 'depotdesdemandesdurbanisme_depotsdesdemandesdurbanisme',
          space: '86c760f0-62f9-47fe-a7c9-918b5ac0830d',
        }),
        // One file per decision, its title the posting day and the number.
        Object.freeze({
          board: 'decisions', layout: 'larochelle-decision',
          path: '/demandes-d-autorisations-d-urbanisme/decisions-des-demandes-d-urbanisme',
          instance: 'decisionsdurbanisme_decisionsdesdemandesdurbanisme',
          space: '8e73c61a-019d-49b1-91dc-0a9e62fe338f',
        }),
      ]),
    }),
    lists: Object.freeze([]),
  }),
  Object.freeze({
    key: 'limoges',
    insee: '87085',
    label: 'Ville de Limoges — autorisations d’urbanisme déposées et décidées', // i18n-ignore-line — the publisher and its lists
    page: 'https://actesreglementaires.limoges.fr/arcade/',
    // DigiContent's « Arcade Portail », its acts searched as JSON (Trap 8).
    source: Object.freeze({ kind: 'arcade', base: 'https://actesreglementaires.limoges.fr' }),
    lists: Object.freeze([]),
  }),
  Object.freeze({
    key: 'lille',
    insee: '59350',
    label: 'Ville de Lille — arrêtés d’urbanisme du Bulletin officiel', // i18n-ignore-line — the publisher and its bulletin
    page: 'https://www.lille.fr/Votre-Mairie/Le-conseil-municipal/Les-arretes-et-deliberations',
    // `Disallow: /content/` and `Disallow: /*.pdf$` on 2026-10-01: read by
    // the project's decision, as Lyon's platform is — the bulletin is the
    // publication the CGCT requires (art. L.2131-1). Its `Crawl-delay: 10`
    // is honoured: ten seconds before every request to the host.
    robots: 'overridden',
    crawlDelayMs: 10_000,
    // Scans in a daily bulletin, read by OCR in the daily sweep alone (Trap 9).
    source: Object.freeze({ kind: 'bulletin' }),
    lists: Object.freeze([
      // i18n-ignore-next-line — the words of the city's own links, matched on
      Object.freeze({ board: 'decisions', layout: 'lille-bulletin', link: /^BO VDL\b/i }),
    ]),
  }),
  ...MUNICIPAL_PERMIT_SOURCES,
  ...EXTENDED_PERMIT_SOURCES,
  ...BOARD_PERMIT_SOURCES,
  ...DEMATDOC_PERMIT_SOURCES,
  ...DIGILOR_TOWNS,
]);

/**
 * The city publishing lists for this commune, or null. An arrondissement code
 * finds its city.
 * @param {?string} communeCode
 * @returns {?object} One of {@link PERMIT_LISTS}.
 */
export function permitListFor(communeCode) {
  const code = foldToCommune(communeCode);
  if (!code) return null;
  return PERMIT_LISTS.find((city) => city.insee === code) ?? null;
}

// --- Webdelib+: a month of published acts per page --------------------------

/**
 * The months a reading of a Webdelib+ city covers, newest first: this month
 * and the `count - 1` before it.
 * @param {string} day `YYYY-MM-DD`.
 * @param {number} count
 * @returns {Array<{year: number, month: number}>}
 */
export function webdelibMonths(day, count) {
  const [year, month] = String(day).split('-').map(Number);
  const out = [];
  for (let i = 0; i < Math.max(1, count); i += 1) {
    const index = year * 12 + (month - 1) - i;
    out.push({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  }
  return out;
}

/**
 * One month's page of a city's acts: Digitech's Webdelib+ lists what was
 * published in a month, `date=MM-YYYY`, one tab per kind of act.
 * @param {object} city A city whose `source.kind` is `webdelib`.
 * @param {{year: number, month: number}} month
 * @returns {string}
 */
export function webdelibMonthUrl(city, { year, month }) {
  return `${city.source.base}/jsp/${city.source.tab}.jsp?role=usager&date=${String(month).padStart(2, '0')}-${year}`;
}

/**
 * The acts of one month's page: title, the address that opens the file, and
 * the day it was published.
 *
 * Each act is a `tableActe` cell — Lyon writes the title before an « Arrêté »
 * link, Béziers makes the title the link — followed by the act's date and its
 * publication date. The link's `pdf` parameter is a token that stays the same
 * from one session to the next (checked 2026-10-01), so an act's address is
 * its identity.
 *
 * @param {string} html
 * @param {string} pageUrl The page's own address, to resolve the links.
 * @returns {Array<{title: string, url: string, published: ?string}>}
 */
export function parseWebdelibActs(html, pageUrl, { actDate = false } = {}) {
  const out = [];
  const chunks = String(html ?? '').split(/<td\b[^>]*class="tableActe"[^>]*>/i).slice(1);
  for (const chunk of chunks) {
    const cell = chunk.split(/<td\b/i)[0];
    const href = /href\s*=\s*"([^"]*openfile\.jsp[^"]*)"/i.exec(cell)?.[1];
    if (!href) continue;
    let url;
    try { url = new URL(decodeEntities(href), pageUrl).href; } catch { continue; }
    const row = chunk.split(/<\/tr>/i)[0];
    const days = [...row.matchAll(/>\s*(\d{2}\/\d{2}\/\d{4})\s*</g)].map((match) => match[1]);
    const title = text(decodeEntities(cell.replace(/<[^>]*>/g, ' '))
      // i18n-ignore-next-line — the platform's own link words, dropped
      .replace(/\s+-\s*(?:arr[êe]t[ée])\s*-\s*\(sans annexe\)\s*$/i, ''));
    if (title) out.push({ title, url, published: listDay(days.at(-1)),
      ...(actDate ? { decidedOn: listDay(days[0]) } : {}) });
  }
  return out;
}

/**
 * The acts a city's lists are made of, each with the list that reads it.
 * A list marked `latest` keeps only the newest act of each title, its count
 * in brackets set aside: Béziers's « Dépôt DP (51) » of 10 September holds
 * every DP still open, the one of 4 September included.
 *
 * @param {object} city
 * @param {Array<{title: string, url: string, published: ?string}>} acts
 * @returns {Array<{board: ?string, layout: string, url: string, title: string, published: ?string, decidedOn?: string}>}
 */
export function webdelibLists(city, acts) {
  const out = [];
  const seen = new Set();
  const newestFirst = [...acts].sort((a, b) => String(b.published ?? '').localeCompare(String(a.published ?? '')));
  for (const act of newestFirst) {
    const list = city.lists.find((candidate) => candidate.title.test(act.title));
    if (!list || seen.has(act.url)) continue;
    if (list.latest) {
      const stem = `${list.layout}|${fold(act.title).replace(/\(\s*\d+\s*\)/g, '').trim()}`;
      if (seen.has(stem)) continue;
      seen.add(stem);
    }
    seen.add(act.url);
    out.push({ board: list.board ?? null, layout: list.layout, url: act.url, title: act.title, published: act.published,
      ...(act.decidedOn ? { decidedOn: act.decidedOn } : {}) });
  }
  return out;
}

/**
 * The file behind an act: the page `openfile.jsp` answers moves the browser on
 * with a script — `document.location.href='../jsp/showFile.jsp?…'` — and that
 * address serves the PDF. A redirect written in a script, not a challenge:
 * no cookie, no computation, the same for every visitor.
 * @param {string} html
 * @param {string} openUrl
 * @returns {?string}
 */
export function webdelibFileUrl(html, openUrl) {
  const match = /(?:\.\.\/jsp\/)?showFile\.jsp\?[^'"\s<>]+/i.exec(String(html ?? ''));
  if (!match) return null;
  try {
    return new URL(match[0].startsWith('..') ? match[0] : `../jsp/${match[0]}`, openUrl).href;
  } catch {
    return null;
  }
}

/** @param {object} city @returns {string} */
export function permitListRobotsUrl(city) {
  return `${new URL(city.page).origin}/robots.txt`;
}

/** The few entities a link's words carry on these pages. */
const ENTITIES = Object.freeze({
  amp: '&', nbsp: ' ', quot: '"', apos: '\'', lt: '<', gt: '>', rsquo: '’', eacute: 'é', egrave: 'è', // i18n-ignore-line — HTML entity names and the characters they stand for
});

function decodeEntities(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X'
        ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * The PDF each of a city's lists is published as today.
 *
 * Every `<a href>` of the page whose address is a PDF, matched by its words
 * and its address together; the first link that matches a list is that list.
 * Null when any list is missing — all or none, as a commune's boards are: a
 * page served without the list of decisions would read as a city that had
 * stopped deciding.
 *
 * @param {object} city One of {@link PERMIT_LISTS}.
 * @param {string} html The page.
 * @returns {?Array<{board: string, layout: string, url: string}>}
 */
export function permitListLinks(city, html) {
  const anchors = [];
  const pattern = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html ?? '').matchAll(pattern)) {
    const href = decodeEntities(match[1] ?? match[2] ?? '').trim();
    let url;
    try { url = new URL(href, city.page); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || !/\.pdf$/i.test(url.pathname)) continue;
    const words = text(decodeEntities(match[3].replace(/<[^>]*>/g, ' '))) ?? '';
    anchors.push({ url: url.href, words: `${words} ${decodeURIComponent(url.pathname)}` });
  }
  const out = [];
  for (const list of city.lists) {
    const found = anchors.filter((anchor) => list.link.test(anchor.words));
    if (!found.length) {
      if (list.optional) continue;
      return null;
    }
    // `all`: every edition the page links is a list of its own (Mulhouse's
    // each cover the weeks since the one before); otherwise the first.
    for (const anchor of list.all ? [...new Map(found.map((item) => [item.url, item])).values()] : found.slice(0, 1)) {
      out.push({
        board: list.board, layout: list.layout, url: anchor.url,
        ...(list.all ? { immutable: true } : {}), ...(list.optional ? { optional: true } : {}),
      });
    }
  }
  return out;
}

/**
 * The files a headless TYPO3 page offers, by the heading of their block:
 * Annecy's page is a JavaScript shell with no link, and the same page as JSON
 * (`/api/<path>`) holds its download blocks — `content.header` over
 * `content.items[].publicUrl`. The file names are not to be trusted (TYPO3
 * renames one that collides, `…-2.pdf`), so they are read every time.
 *
 * @param {object} city
 * @param {*} json The parsed page.
 * @returns {?Array<{board: string, layout: string, url: string}>}
 */
export function typo3ListLinks(city, json) {
  const blocks = [];
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 12) return;
    const content = node.content;
    if (content && typeof content.header === 'string' && Array.isArray(content.items)) {
      for (const item of content.items) {
        const url = item?.publicUrl ?? item?.properties?.publicUrl;
        if (typeof url === 'string' && /\.pdf$/i.test(new URL(url, city.page).pathname)) {
          blocks.push({ words: `${content.header} ${item?.properties?.title ?? ''}`, url: new URL(url, city.page).href });
        }
      }
    }
    for (const value of Array.isArray(node) ? node : Object.values(node)) walk(value, depth + 1);
  };
  walk(json, 0);
  const out = [];
  for (const list of city.lists) {
    const found = blocks.find((block) => list.link.test(block.words));
    if (!found) return null;
    out.push({ board: list.board, layout: list.layout, url: found.url });
  }
  return out;
}

// --- Reading a table out of positioned text --------------------------------

/**
 * A dossier number as the lists print it: family, the commune's code, the
 * year, the counter, and a modification's or transfer's suffix. Five
 * spellings, one grammar:
 *
 *   Marseille  `PC 013055 26 00230P0`, `PC 013055 25 00123M01`
 *   Nîmes      `PC 030189 06 P0166 M01`
 *   Lyon       `DP 069 387 25 00038 M02` — the arrondissement's code, split
 *   Béziers    `DP 34032 26 T0848` — five digits, as at Tours — and
 *              `PC 34032 25T0035` on some lines, the counter stuck to the year
 */
const DOSSIER_RE = /^(PC|DP|PA|PD|CU)\s+(\d{3}\s?\d{3}|\d{5})\s+(\d{2})\s*([A-Z]?\d{4,5})(P0)?(?:\s*([MTP]\d{1,2}))?$/i;

/** The first line of a number a narrow column wraps: `DP 34032 26`. */
const DOSSIER_HEAD_RE = /^(PC|DP|PA|PD|CU)\s+(\d{3}\s?\d{3}|\d{5})\s+\d{2}(?=\s|[A-Z]|$)/i;

/** `Page 3/199`, `Page 2 sur 36`: a page's footer, never a cell. */
const PAGE_FOOTER_RE = /^page\s+\d+\s*(?:\/|sur)\s*\d+$/i;

/** The record's anchor in a register: `Déposé le 03/08/2026`. */
// i18n-ignore-next-line — the software's own label, matched on
const FILED_RE = /^d[ée]pos[ée] le (\d{2}\/\d{2}\/\d{4})$/i;

/**
 * Every page's runs, and a test for its furniture: the `Page n/N` line is
 * dropped outright, and any text printed at the same height on four pages in
 * five of a file of three pages or more — the service's name and the edition
 * date in a footer, which are on every page — is furniture. The test is only
 * ever asked of what lies BELOW a page's last record, and that is the second
 * guard rather than the first: a cell can repeat too, and the commonest do —
 * the first row of Marseille's list of decisions sits at the same height on
 * every page, and « Accord Tacite » is its verdict on half of them.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @returns {{pages: Array<Array<object>>, furniture: (run: object) => boolean}}
 */
function pageRuns(document) {
  const pages = (document?.pages ?? []).map((page) => (page.runs ?? [])
    .filter((run) => !PAGE_FOOTER_RE.test(text(run.text) ?? '')));
  const keyOf = (run) => `${Math.round(run.y)}\u0001${run.text}`;
  if (pages.length < 3) return { pages, furniture: () => false };
  const seen = new Map();
  for (const runs of pages) {
    for (const key of new Set(runs.map(keyOf))) seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const repeated = new Set([...seen].filter(([, count]) => count >= 0.8 * pages.length).map(([key]) => key));
  return { pages, furniture: (run) => repeated.has(keyOf(run)) };
}

/**
 * A `YYYY-MM-DD` day a list could mean, or null. Nîmes prints one decision
 * as taken on `09/04/2201`.
 * @param {?string} value `dd/mm/yyyy`.
 */
function listDay(value) {
  const day = cartdsDate(value);
  const year = day ? Number(day.slice(0, 4)) : 0;
  return year >= 1970 && year <= 2100 ? day : null;
}

/**
 * A register's decision cell: `Rejet tacite le 26/07/2026`, `retiré le
 * 23/07/2026`, `[reprise]Dossier irrecevable le 09/04/2201` — the
 * software's own note of a dossier migrated from an older one dropped.
 *
 * @param {Array<string>} cellLines
 * @returns {{verdict: ?string, decidedOn: ?string}}
 */
export function registerDecision(cellLines) {
  const value = text(cellLines.join(' '))?.replace(/^\[[^\]]*\]\s*/, '') ?? null;
  if (!value) return { verdict: null, decidedOn: null };
  const match = /^(.*?)\s*\ble\s+(\d{2}\/\d{2}\/\d{4})$/i.exec(value);
  return match
    ? { verdict: text(match[1]), decidedOn: listDay(match[2]) }
    : { verdict: value, decidedOn: null };
}

/**
 * The header row of a page: the runs that carry the expected column names.
 *
 * @param {Array<object>} runs
 * @param {Array<[string, string]>} columns `[field, header words]`, in page order.
 * @returns {?{top: number, bottom: number, columns: Array<{field: string, x: number, centre: number}>}}
 *   Null when a column's header is missing from the page.
 */
function headerOf(runs, columns) {
  const found = [];
  for (const [field, words] of columns) {
    const run = runs.find((candidate) => fold(candidate.text) === words);
    if (!run) return null;
    const right = Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x;
    found.push({ field, x: run.x, centre: (run.x + right) / 2, y: run.y });
  }
  return {
    top: Math.max(...found.map((column) => column.y)),
    bottom: Math.min(...found.map((column) => column.y)),
    columns: found.sort((a, b) => a.x - b.x),
  };
}

/** A column's lines, top to bottom — page by page, when a row runs on — as text. */
function lines(runs) {
  return [...runs]
    .sort((a, b) => ((a.page ?? 0) - (b.page ?? 0)) || (b.y - a.y) || (a.x - b.x))
    .map((run) => run.text);
}

/** `77`, `1 865`, `194,07` → a number, or null. */
function number(value) {
  const raw = String(value ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
}

/** `superficie : 1865 m²` anywhere in a record. */
// i18n-ignore-next-line — the software's own label, matched on
const LAND_RE = /^superficie\s*:\s*([\d\s.,]+?)\s*m(?:²|2)?$/i;
/** `nombre de logements : 2`. */
// i18n-ignore-next-line — the software's own label, matched on
const HOUSING_RE = /^nombre de logements\s*:\s*(\d+)$/i;
/** `Arrondissement : 1`, Marseille's own line under the site. */
// i18n-ignore-next-line — the software's own label, matched on
const DISTRICT_RE = /^arrondissement\s*:/i;

/**
 * A site, as the register prints it over two or three lines:
 * `65 La canebière801` / `13001 Marseille`, or `Chemin du Mas de Cheylon` /
 * `Nîmes` with no postcode at all.
 *
 * @param {Array<string>} siteLines
 * @returns {{address: ?string, postcode: ?string, locality: ?string}}
 */
export function registerSite(siteLines) {
  const kept = siteLines.filter((line) => !DISTRICT_RE.test(line) && !LAND_RE.test(line));
  const at = kept.findIndex((line) => /^\d{5}\b/.test(line));
  if (at > 0) {
    const [, postcode, locality] = /^(\d{5})\s*(.*)$/.exec(kept[at]);
    return { address: text(kept.slice(0, at).join(' ')), postcode, locality: text(locality) };
  }
  if (kept.length > 1 && !/\d/.test(kept.at(-1))) {
    return { address: text(kept.slice(0, -1).join(' ')), postcode: null, locality: text(kept.at(-1)) };
  }
  return { address: text(kept.join(' ')), postcode: null, locality: null };
}

/** A legal form alone on its line, its name on the next (`SCI` / `VIEUX PORT`). */
const BARE_FORM_RE = /^(?:s\.?a\.?s\.?u?\.?|s\.?a\.?r\.?l\.?|s\.?c\.?i\.?|s\.?n\.?c\.?|e\.?u\.?r\.?l\.?|sccv|sa|soci[ée]t[ée]|ste)$/i;
/** Where an address starts on a name's line: a house number, or a street. */
// i18n-ignore-next-line — French street words, matched on
const ADDRESS_START_RE = /\s(?:\d{1,5}(?:\s?(?:bis|ter|[a-z]))?\s|(?:rue|avenue|av|bd|boulevard|chemin|place|impasse|route|all[ée]e|quai|cours|lieu-dit|za|zi|zac)\s)/i;
/** A person named after an organisation: `SCI A, SCI B, M.` / `X Patrick`. */
// i18n-ignore-next-line — civilities, matched on
const PERSON_TAIL_RE = /[,;]\s*(?:m|mme|mr|mlle|monsieur|madame)\b\.?.*$/i;

/**
 * The applicant's NAME out of a DEMANDEUR cell, never the address under it.
 *
 * Only the first line, or the first two when the first is a bare legal form;
 * cut where an address starts on the same line (Nîmes writes a company's name
 * and its street on one line) and before a person named after an organisation. What comes
 * out still goes through `organisationApplicant` before it is kept (Trap 4).
 *
 * @param {Array<string>} cellLines
 * @returns {?string}
 */
export function registerApplicant(cellLines) {
  const [first, second] = cellLines;
  let name = text(first);
  if (!name) return null;
  if (BARE_FORM_RE.test(name) && text(second)) name = `${name} ${text(second)}`;
  const address = ADDRESS_START_RE.exec(` ${name} `);
  if (address) name = ` ${name} `.slice(0, address.index);
  return text(name.replace(PERSON_TAIL_RE, ''));
}

/** The register's columns; the last one is LIMITE or DÉCISION (Trap 1). */
const REGISTER_COLUMNS = Object.freeze([
  ['dossier', 'DOSSIER'], ['dates', 'DATES'], ['applicant', 'DEMANDEUR'],
  ['site', 'TERRAIN'], ['information', 'INFORMATIONS'],
]);

/**
 * The register of dossiers, one row per record (Trap 1).
 *
 * The software prints two registers in this layout, and Nîmes puts both in
 * one file: the dossiers under review, whose last column is the deadline
 * (LIMITE), and the dossiers decided, whose last column is the decision
 * (DÉCISION) — refusals and withdrawals included. A row of the second says
 * so with `board: 'decisions'`.
 *
 * Columns by their header: a run belongs to the first column whose header
 * starts to its right, because every cell is written from its column's left
 * edge and every header is centred over it. Records by their anchor: each
 * starts on its « Déposé le » line and runs down to the next one's, cut at the
 * first empty stretch of more than two lines. Inside a record the widest
 * stretch is exactly two — the line left blank over the dossier number, when
 * no other column reaches it.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document From `extractPdfText`.
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw, each
 *   with the `board` it belongs to.
 */
export function readRegisterList(document) {
  const rows = [];
  const { pages, furniture } = pageRuns(document);
  for (const runs of pages) {
    const decisions = headerOf(runs, [...REGISTER_COLUMNS, ['decision', 'DECISION']]);
    const header = decisions ?? headerOf(runs, [...REGISTER_COLUMNS, ['limit', 'LIMITE']]);
    if (!header) continue;
    const below = runs.filter((run) => run.y < header.bottom - 1);
    const anchors = below.filter((run) => FILED_RE.test(run.text)).sort((a, b) => b.y - a.y);
    const lowest = anchors.at(-1)?.y ?? -Infinity;
    const body = below.filter((run) => run.y >= lowest || !furniture(run));
    const columnOf = (run) => (header.columns.find((column) => column.x > run.x + 0.5)
      ?? header.columns.at(-1)).field;
    anchors.forEach((anchor, i) => {
      const floor = anchors[i + 1]?.y ?? -Infinity;
      const band = body.filter((run) => run.y <= anchor.y + 0.5 && run.y > floor + 0.5)
        .sort((a, b) => b.y - a.y);
      const kept = [];
      for (const run of band) {
        const previous = kept.at(-1);
        if (previous && previous.y - run.y > 2.6 * (run.size || 7)) break;
        kept.push(run);
      }
      const cells = { dossier: [], dates: [], applicant: [], site: [], information: [], limit: [], decision: [] };
      for (const run of kept) cells[columnOf(run)].push(run);
      const dossierLines = lines(cells.dossier);
      const dossier = dossierLines.find((line) => DOSSIER_RE.test(line));
      if (!dossier) return;
      const all = lines(kept);
      const land = all.map((line) => LAND_RE.exec(line)).find(Boolean);
      const housing = all.map((line) => HOUSING_RE.exec(line)).find(Boolean);
      const site = registerSite(lines(cells.site));
      const decision = decisions ? registerDecision(lines(cells.decision)) : null;
      rows.push({
        board: decisions ? PERMIT_LIST_BOARDS.decisions : PERMIT_LIST_BOARDS.filings,
        dossier: text(dossier),
        label: text(dossierLines.filter((line) => line !== dossier).join(' ')),
        purpose: null,
        applicant: registerApplicant(lines(cells.applicant)),
        address: site.address,
        postcode: site.postcode,
        locality: site.locality,
        filedOn: listDay(FILED_RE.exec(anchor.text)[1]),
        verdict: decision?.verdict ?? null,
        decidedOn: decision?.decidedOn ?? null,
        postedOn: null,
        landArea: land ? String(number(land[1]) ?? '') || null : null,
        housing: housing ? housing[1] : null,
        lots: null,
        floorArea: null,
      });
    });
  }
  return rows;
}

/** Marseille's list of granted authorisations: header words, in page order. */
const DECISION_COLUMNS = Object.freeze([
  ['postcode', 'CODE POSTAL'], ['dossier', 'DOSSIER'], ['address', 'ADRESSE'],
  ['purpose', 'NATURE TRAVAUX'], ['applicant', 'DEMANDEUR'], ['filedOn', 'DATE DEPOT'],
  ['verdict', 'AVIS DECISION'], ['decidedOn', 'DATE DECISION'], ['postedOn', 'AFFICHAGE'],
  ['housing', 'LOGEMENTS CREES'], ['lots', 'LOTS PROJETS'], ['floorArea', 'SDP'],
  ['competence', 'COMPETENCE'],
]);

/** A cell's text, the spreadsheet's trailing full stops cleaned off. */
function cellText(cellRuns) {
  const value = text(lines(cellRuns).join(' '));
  return value ? text(value.replace(/(?:\s*\.)+$/, '').replace(/\s+([.,)])/g, '$1')) : null;
}

/** `102 rue Grignan 13001` → the street and the postcode. */
function splitPostcode(value) {
  const match = /^(.*?)\s*\b(\d{5})$/.exec(String(value ?? '').trim());
  return match ? { address: text(match[1]), postcode: match[2] } : { address: text(value), postcode: null };
}

/**
 * A list of decisions laid out as a spreadsheet, one row per dossier (Trap 1).
 *
 * Columns by their header: a run belongs to the column whose header is
 * centred nearest its own centre, because both are centred. Rows by their
 * dossier number: every cell of a row is centred on the row's middle, so each
 * line belongs to the nearest number — a cell of seven lines reaches three
 * lines up and three down, and the next row starts past its own half-height.
 * Below a page's last row, a line further down than that row reaches up is
 * the page's footer, not the row's.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document From `extractPdfText`.
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw, each
 *   with `board: 'decisions'`.
 */
export function readDecisionTable(document) {
  const rows = [];
  const { pages, furniture } = pageRuns(document);
  for (const runs of pages) {
    const header = headerOf(runs, DECISION_COLUMNS);
    if (!header) continue;
    const centreOf = (run) => (run.x + (Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x)) / 2;
    const columnOf = (run) => {
      const centre = centreOf(run);
      let best = header.columns[0];
      for (const column of header.columns) {
        if (Math.abs(column.centre - centre) < Math.abs(best.centre - centre)) best = column;
      }
      return best.field;
    };
    const below = runs.filter((run) => run.y < header.bottom - 1);
    const anchors = below.filter((run) => columnOf(run) === 'dossier' && DOSSIER_RE.test(text(run.text) ?? ''))
      .sort((a, b) => b.y - a.y);
    if (!anchors.length) continue;
    const body = below.filter((run) => run.y >= anchors.at(-1).y || !furniture(run));
    const members = anchors.map(() => []);
    for (const run of body) {
      if (anchors.includes(run)) continue;
      let at = 0;
      for (let i = 1; i < anchors.length; i += 1) {
        if (Math.abs(anchors[i].y - run.y) < Math.abs(anchors[at].y - run.y)) at = i;
      }
      members[at].push(run);
    }
    const last = anchors.length - 1;
    const reach = Math.max(0, ...members[last].filter((run) => run.y > anchors[last].y)
      .map((run) => run.y - anchors[last].y));
    members[last] = members[last].filter((run) => run.y >= anchors[last].y
      || anchors[last].y - run.y <= reach + 0.6 * (run.size || 6));
    anchors.forEach((anchor, i) => {
      const cells = {};
      for (const run of members[i]) (cells[columnOf(run)] ??= []).push(run);
      const value = (field) => cellText(cells[field] ?? []);
      const site = splitPostcode(value('address'));
      const postcode = /^\d{5}$/.test(value('postcode') ?? '') ? value('postcode') : site.postcode;
      rows.push({
        board: PERMIT_LIST_BOARDS.decisions,
        dossier: text(anchor.text),
        label: null,
        purpose: value('purpose'),
        applicant: text(lines(cells.applicant ?? [])[0]),
        address: site.address,
        postcode,
        locality: null,
        filedOn: listDay(value('filedOn')),
        verdict: value('verdict'),
        decidedOn: listDay(value('decidedOn')),
        postedOn: listDay(value('postedOn')),
        landArea: null,
        housing: number(value('housing')) === null ? null : value('housing'),
        lots: number(value('lots')) === null ? null : value('lots'),
        floorArea: number(value('floorArea')) === null ? null : value('floorArea'),
      });
    });
  }
  return rows;
}

/** A section heading of Lyon's lists: the family, and filed or issued. */
// i18n-ignore-next-line — the city's own headings, matched on
const LYON_SECTION_RE = /^(d[ée]clarations? pr[ée]alables?|permis de construire|permis d.am[ée]nager|permis de d[ée]molir|changements? d.usage)\s+(d[ée]pos[ée]e?s?|d[ée]livr[ée]e?s?)\s+pendant la p[ée]riode/i;
/** Lyon's record line: the number, then what happened and when, maybe on one run. */
const LYON_RECORD_RE = /^(PC|DP|PA|PD|CU|US)\s+(\d{3})\s+(\d{3})(?:\s+(\d{2}))?(?:\s+(\d{5}))?(?:\s+([MT]\d{1,2}))?(?:\s+(.*))?$/i;
/** The rest of a number wrapped onto the next lines: `17 02570`, `00673 M01`, `T01`. */
const LYON_TAIL_RE = /^(?:(\d{2})\s+)?(\d{5})?(?:\s*([MT]\d{1,2}))?$/;
/** `déposée le 25/09/2026 Modificatif`, `Décision du 28/07/2026 à`, `Arrêté du 28/07/2026`. */
// i18n-ignore-next-line — the city's own words, matched on
const LYON_EVENT_RE = /^(d[ée]pos[ée]e?\s+le|d[ée]cision\s+du|arr[êe]t[ée]\s+du)\s+(\d{2}\/\d{2}\/\d{4})\s*(?:(à)\s*(.*?)|(.*?))\s*$/i;
/** A field's label in the left column, its colon sometimes on the next line. */
// i18n-ignore-next-line — the city's own labels, matched on
const LYON_LABEL_RE = /^(projet|terrain|demandeur|mandataire|auteur|r[ée]gie)\s*(?::\s*(.*))?$/i;
/** The fields of a record that are kept; a mandatary, an architect, a régie never are. */
const LYON_KEPT = new Set(['projet', 'terrain', 'demandeur', 'beneficiary']);
// i18n-ignore-start — the city's own labels, matched on
const LYON_LAND_RE = /^superficie du terrain\s*:\s*([\d\s.,]+?)\s*(?:m²|m2)?$/i;
const LYON_FLOOR_RE = /^surface cr[ée]{2}e\s*:\s*([\d\s.,]+?)\s*(?:m²|m2)?$/i;
const LYON_STEP_RE = /^(modificatif|transfert|prorogation|retrait)$/i;
/** The first half of an event a narrow column wraps: `Décision du` / `31/08/2026 à`. */
const LYON_EVENT_HEAD_RE = /^(d[ée]pos[ée]e?\s+le|d[ée]cision\s+du|arr[êe]t[ée]\s+du)$/i;
// i18n-ignore-end

/**
 * `18 Rue Lortet Lyon 7ème` → the street and the arrondissement's postcode.
 * @param {?string} value
 * @returns {{address: ?string, postcode: ?string}}
 */
export function lyonSite(value) {
  const raw = text(value);
  if (!raw) return { address: null, postcode: null };
  const match = /^(.*?)\s+lyon\s+(\d)\s*(?:er|e|[èe]me)?\.?$/i.exec(raw);
  return match
    ? { address: text(match[1]), postcode: `6900${match[2]}` }
    : { address: raw, postcode: null };
}

/**
 * Lyon's lists, one row per record.
 *
 * NOT A TABLE. The city writes its lists in Word, one record after another:
 * the dossier number with what happened to it (`déposée le …`, `Décision du …
 * à <beneficiary>`, `Arrêté du …`), then a label in the left column and its
 * value in the right — `Projet`, `Terrain`, `Demandeur`, `Mandataire`,
 * `Auteur` — and every week opens a section that names the family and says
 * whether its dossiers were filed or issued (`Déclarations préalables
 * déposées pendant la période du …`, `Permis de construire délivrés …`). A
 * Word file draws its text in reading order, so the records are read in that
 * order: a section sets the board, a number starts a record, a label opens a
 * field, and a line under a value, in the same column, continues it.
 *
 * A number may be wrapped by a narrow column (`DP 069 389 23` / `00673 M01`,
 * 100 of the 221 numbers of the list of 21-27 September 2026, and over three
 * lines in the list of 7-13 September: `DP 069 384` / `17 02570` / `T01`);
 * its tail is the next runs of the same column. So may the event (`Décision
 * du` / `31/08/2026 à`), whose halves are joined, and a label and its colon. A value never continues onto the next page
 * — the page's own header would be read into it — and a mandatary, an
 * architect or a régie is never kept: they are people more often than not.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document From `extractPdfText`.
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw, each
 *   with its `board`.
 */
export function readLyonList(document) {
  const rows = [];
  let board = null;
  let record = null;
  const flush = () => {
    const parts = record?.parts;
    if (parts?.year && parts.counter) {
      record.dossier = `${parts.kind} ${parts.code} ${parts.year} ${parts.counter}${parts.suffix ? ` ${parts.suffix}` : ''}`;
    }
    if (record?.dossier && board) {
      const site = lyonSite(record.fields.terrain);
      const decided = board === PERMIT_LIST_BOARDS.decisions;
      rows.push({
        board,
        dossier: record.dossier,
        label: null,
        purpose: text(record.fields.projet) ?? (record.step ? record.step.toLowerCase() : null),
        applicant: text(record.fields.demandeur) ?? text(record.fields.beneficiary),
        address: site.address,
        postcode: site.postcode,
        locality: null,
        filedOn: decided ? null : record.day,
        verdict: decided ? 'Délivré' : null, // i18n-ignore-line — the section's own word, kept as the verdict
        decidedOn: decided ? record.day : null,
        postedOn: null,
        landArea: record.land,
        housing: null,
        lots: null,
        floorArea: record.floor,
      });
    }
    record = null;
  };
  const event = (words) => {
    const match = LYON_EVENT_RE.exec(words);
    if (!match) return false;
    record.day = listDay(match[2]);
    const rest = text(match[4] ?? match[5]);
    if (match[3]) {
      record.field = 'beneficiary';
      record.column = null;
      if (rest) record.fields.beneficiary = rest;
    } else if (rest && LYON_STEP_RE.test(rest)) record.step = rest;
    return true;
  };
  for (const page of document?.pages ?? []) {
    let last = null;
    for (const run of page.runs ?? []) {
      const words = text(run.text);
      if (!words || PAGE_FOOTER_RE.test(words)) continue;
      const section = LYON_SECTION_RE.exec(words);
      if (section) {
        flush();
        board = /livr/i.test(section[2]) ? PERMIT_LIST_BOARDS.decisions : PERMIT_LIST_BOARDS.filings;
        continue;
      }
      const head = LYON_RECORD_RE.exec(words);
      if (head && run.x < 120) {
        flush();
        const [, kind, dept, commune, year, counter, suffix, tail] = head;
        record = {
          parts: { kind, code: `${dept}${commune}`, year, counter, suffix },
          dossier: null, fields: {}, field: null, column: null, pending: null, day: null,
          step: null, land: null, floor: null, x: run.x, y: run.y,
        };
        if (tail) event(tail);
        last = run;
        continue;
      }
      if (!record) continue;
      // The rest of a wrapped number: the next runs of the number's column,
      // before any label — `17 02570` and then `T01`, or `00673 M01`.
      const rest = !record.field && Math.abs(run.x - record.x) < 2 ? LYON_TAIL_RE.exec(words) : null;
      if (rest && (rest[1] || rest[2] || rest[3])) {
        const { parts } = record;
        if (rest[1] && !parts.year) parts.year = rest[1];
        if (rest[2] && !parts.counter) parts.counter = rest[2];
        if (rest[3] && !parts.suffix) parts.suffix = rest[3];
        continue;
      }
      if (words === ':') continue;
      const land = LYON_LAND_RE.exec(words);
      if (land) { record.land = String(number(land[1]) ?? '') || null; continue; }
      const floor = LYON_FLOOR_RE.exec(words);
      if (floor) { record.floor = String(number(floor[1]) ?? '') || null; continue; }
      if (LYON_EVENT_HEAD_RE.test(words)) { record.pending = words; continue; }
      if (record.pending) {
        const whole = `${record.pending} ${words}`;
        record.pending = null;
        if (event(whole)) { last = run; continue; }
      }
      if (event(words)) { last = run; continue; }
      if (LYON_STEP_RE.test(words)) { record.step = words; continue; }
      const label = run.x < record.x + 10 ? LYON_LABEL_RE.exec(words) : null;
      if (label) {
        record.field = fold(label[1]).toLowerCase();
        record.column = null;
        if (text(label[2]) && LYON_KEPT.has(record.field)) record.fields[record.field] = text(label[2]);
        last = run;
        continue;
      }
      const field = record.field;
      if (!field || !LYON_KEPT.has(field)) continue;
      const pitch = 2 * (run.size || 12);
      // A field's first value sits beside its label, a little lower when Word
      // centres a cell taller than the label's; the lines after it, under it.
      const continues = record.column === null
        ? (last && run.x > last.x && Math.abs(run.y - last.y) < 1.2 * (run.size || 12))
        : Math.abs(run.x - record.column) < 2 && last && last.y - run.y < pitch && last.y - run.y > 0;
      if (!continues) continue;
      record.fields[field] = record.fields[field] ? `${record.fields[field]} ${words}` : words;
      if (record.column === null) record.column = run.x;
      last = run;
    }
  }
  flush();
  return rows;
}

/**
 * The columns of one page of a grid: each cell's text starts at its column's
 * left edge, so the starts cluster, and a cluster belongs to the header whose
 * words it lies under — the header that its widest extent overlaps most. A
 * header centred over a wide column starts far to the right of the column's
 * cells (Béziers's « Description du projet » at 623, its cells at 529.6),
 * which is why neither the header's start nor its centre will do alone.
 *
 * @param {Array<object>} runs The page's body.
 * @param {Array<{field: string, x: number, x1: number}>} columns Its header.
 * @returns {(run: object) => ?string} The field of a run.
 */
function gridColumns(runs, columns) {
  const clusters = [];
  for (const run of [...runs].sort((a, b) => a.x - b.x)) {
    const right = Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x;
    const near = clusters.at(-1);
    if (near && run.x - near.start < 4) { near.end = Math.max(near.end, right); continue; }
    clusters.push({ start: run.x, end: right });
  }
  for (const cluster of clusters) {
    let best = null;
    let score = -Infinity;
    for (const column of columns) {
      const overlap = Math.min(cluster.end, column.x1) - Math.max(cluster.start, column.x);
      if (overlap > score) { score = overlap; best = column; }
    }
    cluster.field = best?.field ?? null;
  }
  return (run) => {
    let found = null;
    for (const cluster of clusters) {
      if (run.x - cluster.start > -0.5) found = cluster; else break;
    }
    return found?.field ?? null;
  };
}

/**
 * A grid: one row per dossier, every cell hanging from the top of its row,
 * the dossier number in its own column and the header repeated — or not — on
 * each page (Béziers's weekly lists, Aspose's export).
 *
 * The header gives the fields, `spec.columns` the words that name them; a
 * page without a header keeps the last page's. A row starts on the line of
 * its dossier number, which a narrow column may wrap (`DP 34032 26` /
 * `T0848`), and runs down to the next number, cut at the first empty stretch
 * of more than two lines. A run as wide as a third of the page is a section's
 * title across the table, not a cell.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document From `extractPdfText`.
 * @param {{board: string, columns: Array<[string, string, {optional?: boolean}?]>,
 *   row: (cells: Record<string, Array<string>>) => object}} spec
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw, each
 *   with `spec.board`.
 */
export function readGridTable(document, spec) {
  const rows = [];
  const { pages, furniture } = pageRuns(document);
  let header = null;
  // The last row of a page, kept open: Word lets a row run on to the top of
  // the next page, above that page's first number (Mulhouse, 43 runs over
  // five pages of one list, the applicant's organisation among them).
  let open = null;
  const close = () => {
    if (!open) return;
    const byField = Object.fromEntries(Object.entries(open).map(([field, cellRuns]) => [field, lines(cellRuns)]));
    const row = spec.row(byField);
    if (row && DOSSIER_RE.test(text(row.dossier) ?? '')) rows.push({ board: spec.board, ...row });
    open = null;
  };
  for (const [index, runs] of pages.entries()) {
    const found = gridHeader(runs, spec.columns);
    if (found) header = found;
    if (!header) continue;
    const columns = [...header.columns].sort((a, b) => a.x - b.x);
    const width = Math.max(...columns.map((column) => column.x1)) - columns[0].x;
    // A section's title runs across the table from its first column; a long
    // description, wide too, starts in its own (Mulhouse's, 240 points).
    const below = runs.filter((run) => (!found || run.y < found.bottom - 1)
      && !header.runs.includes(run)
      && !((Number.isFinite(run.x1) ? run.x1 - run.x : 0) > width / 3 && run.x < (columns[1]?.x ?? Infinity)))
      .map((run) => ({ ...run, page: index }));
    const columnOf = gridColumns(below, header.columns);
    const anchors = below.filter((run) => columnOf(run) === 'dossier' && DOSSIER_HEAD_RE.test(text(run.text) ?? ''))
      .sort((a, b) => b.y - a.y);
    const lowest = anchors.at(-1)?.y ?? -Infinity;
    const body = below.filter((run) => run.y >= lowest || !furniture(run));
    const top = anchors[0]?.y ?? -Infinity;
    if (open) {
      // What runs on is never the page's furniture — Béziers stamps « Publié
      // le … » over every page, and read into the row it became its filing day.
      for (const run of body.filter((item) => item.y > top + 0.5 && !furniture(item))) {
        const field = columnOf(run);
        if (field) (open[field] ??= []).push(run);
      }
    }
    if (!anchors.length) continue;
    close();
    anchors.forEach((anchor, i) => {
      const floor = anchors[i + 1]?.y ?? -Infinity;
      const band = body.filter((run) => run.y <= anchor.y + 0.5 && run.y > floor + 0.5)
        .sort((a, b) => b.y - a.y);
      const kept = [];
      for (const run of band) {
        const previous = kept.at(-1);
        if (previous && previous.y - run.y > 2.6 * (run.size || 7)) break;
        kept.push(run);
      }
      const cells = {};
      for (const run of kept) {
        const field = columnOf(run);
        if (field) (cells[field] ??= []).push(run);
      }
      if (i < anchors.length - 1) {
        open = cells;
        close();
      } else open = cells;
    });
  }
  close();
  return rows;
}

/** A grid's header on this page, or null: every required column's words found. */
function gridHeader(runs, columns) {
  const found = [];
  const used = [];
  for (const [field, words, options] of columns) {
    const run = runs.find((candidate) => fold(candidate.text) === words);
    if (!run) {
      if (options?.optional) continue;
      return null;
    }
    const right = Number.isFinite(run.x1) && run.x1 > run.x ? run.x1 : run.x;
    found.push({ field, x: run.x, x1: right, y: run.y });
    used.push(run);
  }
  // A header split over two lines (`Date de` / `signature`) leaves its second
  // line under the first: it is part of the header, not of the first row.
  const bottom = Math.min(...found.map((column) => column.y));
  const top = Math.max(...found.map((column) => column.y));
  const second = runs.filter((run) => !used.includes(run) && run.y < bottom && bottom - run.y < 1.6 * (run.size || 11)
    && found.some((column) => Math.abs(column.x - run.x) < 1));
  return {
    bottom: Math.min(bottom, ...second.map((run) => run.y)),
    top,
    runs: [...used, ...second],
    columns: found.sort((a, b) => a.x - b.x),
  };
}

/** A grid cell's lines as one value. */
function joined(cellLines) {
  return text((cellLines ?? []).join(' '));
}

/**
 * A grid's applicant: the organisation the cell names, where it names one.
 *
 * The person who signs comes first and the organisation they sign for after
 * — `Monsieur <name>` / `<first name>` / `M2A HABITAT` at Mulhouse, in one row
 * in four; the first line alone would keep the person, whom the filter drops,
 * and lose the organisation. A grid's applicant cell holds no address (the
 * site has its own column), so every line may be tried; the first that reads
 * as an organisation is the applicant, and failing one, the first line, which
 * the filter will judge like any other.
 *
 * @param {Array<string>} cellLines
 * @returns {?string}
 */
export function gridApplicant(cellLines) {
  const all = (cellLines ?? []).map((line) => text(line)).filter(Boolean);
  for (let i = 0; i < all.length; i += 1) {
    const candidate = registerApplicant(all.slice(i));
    if (organisationApplicant(candidate)) return candidate;
  }
  return registerApplicant(all);
}

/**
 * A grid of filed dossiers: Béziers's weekly lists, one per family (`Dépôt DP
 * (51)`), and Argenteuil's sheets, one per dossier — the same export, the
 * same five headers.
 */
const GRID_FILINGS = Object.freeze({
  board: PERMIT_LIST_BOARDS.filings,
  columns: Object.freeze([
    ['filedOn', 'DATE DE DEPOT'], ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'PETITIONNAIRE'],
    ['address', 'ADRESSE DU PROJET'], ['purpose', 'DESCRIPTION DU PROJET'],
  ]),
  row: (cells) => {
    const site = registerSite(cells.address ?? []);
    return {
      dossier: joinDossier(cells.dossier ?? []).dossier,
      label: null,
      purpose: joined(cells.purpose),
      applicant: gridApplicant(cells.applicant),
      address: site.address,
      postcode: site.postcode,
      locality: site.locality,
      filedOn: listDay(joined(cells.filedOn)),
      verdict: null,
      decidedOn: null,
      postedOn: null,
      landArea: null,
      housing: null,
      lots: null,
      floorArea: null,
    };
  },
});

/** A grid of decisions: Béziers's (`DP décidées (25)`) and Argenteuil's. */
const GRID_DECISIONS = Object.freeze({
  board: PERMIT_LIST_BOARDS.decisions,
  columns: Object.freeze([
    ['dossier', 'NUMERO DE DOSSIER'], ['applicant', 'PETITIONNAIRE'], ['verdict', 'DECISION'],
    ['decidedOn', 'DATE DE'], ['purpose', 'NATURE DES TRAVAUX'], ['address', 'ADRESSE DES TRAVAUX'],
    ['floorArea', 'SURFACE', { optional: true }],
  ]),
  row: (cells) => {
    const site = registerSite(cells.address ?? []);
    const floor = number(joined(cells.floorArea)?.replace(/\s*m(?:²|2)$/i, ''));
    return {
      dossier: joinDossier(cells.dossier ?? []).dossier,
      label: null,
      purpose: joined(cells.purpose),
      applicant: gridApplicant(cells.applicant),
      address: site.address,
      postcode: site.postcode,
      locality: site.locality,
      filedOn: null,
      verdict: joined(cells.verdict),
      decidedOn: listDay(joined(cells.decidedOn)),
      postedOn: null,
      landArea: null,
      housing: null,
      lots: null,
      floorArea: floor === null ? null : String(floor),
    };
  },
});

/**
 * A list's parcel cell as the cadastre parcels it names: `AC 0080, AB 0123`
 * at Aix — the section, the number on four digits, a comma between. The
 * three strays of 736 references read on 2026-10-01 are read too: `KD 275p`
 * (part of a parcel, the surveyor's mark kept), `A 2036` (a one-letter
 * section) and `001BX 0101` (the commune's own number in front, which
 * `cartdsParcelIdus` folds away). Anything else is no parcel.
 *
 * @param {?string} cell
 * @returns {Array<{prefix: ?string, section: string, numero: string, label: string}>}
 */
export function listParcels(cell) {
  const out = [];
  for (const piece of String(cell ?? '').split(/[,;]/)) {
    const label = piece.replace(/\s+/g, ' ').trim().toUpperCase();
    const match = /^(?:(\d{1,3})\s*)?([A-Z]{1,2})\s+0*(\d{1,4})(P)?$/.exec(label);
    if (!match) continue;
    out.push({ prefix: match[1] ?? null, section: match[2], numero: `${match[3]}${match[4] ? 'P' : ''}`, label });
  }
  return out;
}

// --- Aix-en-Provence: two HTML tables --------------------------------------

/**
 * A number as Aix writes it, with the commune's code the list leaves out:
 * `PC2600200` → `PC 013001 26 00200`, `PC24J0209 M01` → `PC 013001 24 J0209
 * M01`. Up to 2024 the counter was `J` and four digits, and Sitadel keeps the
 * `J` (`01300124J0180`). `P01` after a number is a PROROGATION here, not
 * Marseille's original. `AT` — a works permit for a building open to the
 * public — is not a family the layer draws.
 *
 * @param {object} city
 * @param {?string} raw
 * @returns {?string}
 */
export function aixDossier(city, raw) {
  const match = /^(PC|DP|PA|PD|CU)\s*(\d{2})\s*([A-Z]?\d{4,5})(?:\s*([MTP]\d{1,2}))?$/i.exec(text(raw) ?? '');
  if (!match) return null;
  const [, kind, year, counter, suffix] = match;
  return `${kind.toUpperCase()} 0${city.insee} ${year} ${counter.toUpperCase()}${suffix ? ` ${suffix.toUpperCase()}` : ''}`;
}

/** A cell of Aix's tables: tags out, `-` for nothing. */
function htmlCell(value) {
  const plain = text(decodeEntities(String(value ?? '').replace(/<[^>]*>/g, ' ')));
  return plain === '-' ? null : plain;
}

/** `2026-09-30 00:00:00.0` → `2026-09-30`. */
function isoDay(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''));
  return match ? match[1] : null;
}

/** `13100 AIX-EN-PROVENCE` at the end of a site, set apart. */
function sitePostcode(value) {
  const match = /^(.*?)\s*\b(\d{5})\s+([^\d]*?)\s*$/.exec(String(value ?? '').trim());
  return match
    ? { address: text(match[1]), postcode: match[2], locality: text(match[3]) }
    : { address: text(value), postcode: null, locality: null };
}

/**
 * Aix's two lists, read off the one page that carries them both.
 *
 * NOT A FILE. The city's ArcOpole application answers a page whose two
 * tables are the lists — « Liste des Dossiers Déposés » and « … Délivrés » —
 * every dossier filed in the last two months and still undecided, and every
 * decision of the same two months, refusals included (52 of 312 on
 * 2026-10-01). The window is recomputed at each request, so the page keeps no
 * history. Each table is found by the legend over it: the tables' own ids are
 * the other way round.
 *
 * @param {object} city
 * @param {string} html
 * @returns {?{filings: Array<object>, decisions: Array<object>}} Null when
 *   either table is missing.
 */
export function readAixTables(city, html) {
  const source = String(html ?? '');
  const tables = {};
  const legends = [...source.matchAll(/<legend[^>]*>([\s\S]*?)<\/legend>/gi)];
  legends.forEach((legend, i) => {
    const words = fold(htmlCell(legend[1]) ?? '');
    // i18n-ignore-next-line — the page's own legends, matched on
    const board = /DOSSIERS DEPOSES/.test(words) ? 'filings' : /DOSSIERS DELIVRES/.test(words) ? 'decisions' : null;
    if (!board) return;
    const part = source.slice(legend.index, legends[i + 1]?.index ?? source.length);
    const heads = [...part.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => fold(htmlCell(match[1]) ?? ''));
    const rows = [];
    for (const tr of part.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => htmlCell(match[1]));
      if (cells.length !== heads.length) continue;
      rows.push(Object.fromEntries(heads.map((head, k) => [head, cells[k]])));
    }
    tables[board] = rows;
  });
  if (!tables.filings || !tables.decisions) return null;
  const row = (board, cells) => {
    const site = sitePostcode(cells['ADRESSE DU TERRAIN']);
    const decided = board === 'decisions';
    // i18n-ignore-start — the page's own column names
    return {
      board,
      dossier: aixDossier(city, cells.DOSSIER),
      label: null,
      purpose: cells.TRAVAUX ?? cells['OBJET / DESTINATION'] ?? null,
      applicant: cells.DEMANDEUR ?? null,
      address: site.address,
      postcode: site.postcode,
      locality: site.locality,
      filedOn: decided ? null : isoDay(cells.DEPOT),
      verdict: decided ? cells.NATURE ?? null : null,
      decidedOn: decided ? isoDay(cells.DELIVRANCE) : null,
      postedOn: null,
      landArea: null,
      housing: number(cells['LOG.']) ? cells['LOG.'] : null,
      lots: null,
      floorArea: number(String(cells.SHON ?? '').replace(',', '.')) ? String(number(String(cells.SHON).replace(',', '.'))) : null,
      parcels: cells.PARCELLE ?? null,
    };
    // i18n-ignore-end
  };
  return {
    filings: tables.filings.map((cells) => row('filings', cells)).filter((item) => item.dossier),
    decisions: tables.decisions.map((cells) => row('decisions', cells)).filter((item) => item.dossier),
  };
}

// --- Argenteuil: Digilor Datahall, one PDF per dossier ---------------------

/**
 * The body that asks a Datahall for every document it holds: the app sends
 * this JSON as the raw body of a POST, and the server reads it whatever the
 * content type says. One answer, no paging — Argenteuil's was 10.2 MB, 10 611
 * documents back to April 2022.
 * @param {object} city A city whose `source.kind` is `digilor`.
 */
export function digilorIndexBody(city) {
  return JSON.stringify({ controller: 'DocumentController', action: 'getAll', data: { idApp: city.source.app } });
}

/** @param {object} city @returns {string} */
export function digilorIndexUrl(city) {
  return `${city.source.base}/web/server/index.php`;
}

/**
 * The permit files of a Datahall index, newest first: the documents of the
 * city's urbanism category whose sub-category is the filings' or the
 * decisions', first shown on or after `since`. Selected by the ids, never by
 * the titles, which are typed by hand (`Décison`, `Déppot`) and name the
 * applicant. Since May 2023 one file holds one dossier.
 *
 * A town whose shelves are not one per board lists them in `source.shelves`
 * instead, the first that matches deciding: `{category, sub?, title?, board,
 * layout?}` — `sub` a sub-category id (0 for none), `title` a pattern the
 * folded title must match (Le Mans posts its filings and decisions lists on
 * one sub-category, named by title), `board` `filings`, `decisions` or
 * `auto` (a receipt or an avis de dépôt is a filing, an order a decision, any
 * other title `fallback`, or nothing), `layout` the file's reader when not
 * `formats[board]`, `numbered` true for a town that titles a file by its
 * site and types the dossier's number in the record's own `numero` field (Le
 * Plessis-Trévise: « 12 allée des Tilleuls », `DP0940592600012`, both
 * invented here) — the number is then put before the title, so that a title
 * row has both. A reader that
 * names the board itself (`dematdoc-notice` reads it from the act's heading)
 * has the last word.
 *
 * @param {object} city
 * @param {*} index The parsed answer.
 * @param {string} since `YYYY-MM-DD`.
 * @returns {?Array<{board: string, url: string, published: ?string}>} Null for
 *   an answer that is not an index.
 */
export function digilorDocuments(city, index, since) {
  if (!Array.isArray(index)) return null;
  const { category, filings, decisions, mixedShelf, formats, shelves } = city.source;
  const out = [];
  for (const doc of index) {
    if (shelves) {
      const file = digilorShelfFile(city, doc, since);
      if (file) out.push(file);
      continue;
    }
    if (Number(doc?.id_cat) !== category) continue;
    const sub = Number(doc.id_sscat);
    const title = text(doc.nom_affichage) ?? '';
    const board = mixedShelf && sub === mixedShelf
      ? /^(?:LISTE|REGISTRE).*DOSSIERS.*DEPOSE/i.test(fold(title)) ? 'filings'
        : /\b(?:PC|DP|PA|PD|CU)\s*0?\s*41\s*018\b/i.test(title) ? 'decisions' : null
      : sub === filings ? 'filings' : sub === decisions ? 'decisions' : null;
    const published = isoDay(doc.aff_deb);
    const file = String(doc.url_uiid ?? '').replace(/^(?:\.\.\/bo\/|bo\/|\.\/)/, '');
    if (!board || !file || !published || published < since) continue;
    out.push({ board, url: `${city.source.base}/web/server/get_file.php?file=${encodeURIComponent(file)}`, published,
      ...(formats ? { layout: formats[board], title } : {}) });
  }
  return out.sort((a, b) => b.published.localeCompare(a.published));
}

// i18n-ignore-start — the words of the towns' own titles, matched on
const DIGILOR_FILING_TITLE = /\b(?:AVIS DE DEPO?T|RECEPISSE|DEPOT DE (?:LA )?DEMANDE|DOSSIERS? DEPOSES?|DEPOTS?)\b/;
const DIGILOR_DECISION_TITLE = /\b(?:ARRETES?|DECISIONS?|ACCORDS?|REFUS|NON[- ]?OPPOSITION|AUTORISATIONS? DELIVREES?)\b/;
// i18n-ignore-end

/** One document of a town that lists its shelves, or null (see {@link digilorDocuments}). */
function digilorShelfFile(city, doc, since) {
  const title = text(doc?.nom_affichage) ?? '';
  const folded = fold(title).replace(/_/g, ' ');
  const shelf = city.source.shelves.find((item) => Number(doc?.id_cat) === item.category
    && (item.sub === undefined || Number(doc.id_sscat) === item.sub)
    && (!item.title || new RegExp(item.title).test(folded)));
  if (!shelf) return null;
  const board = shelf.board !== 'auto' ? shelf.board
    : DIGILOR_FILING_TITLE.test(folded) ? 'filings' : DIGILOR_DECISION_TITLE.test(folded) ? 'decisions' : shelf.fallback ?? null;
  const published = isoDay(doc.aff_deb);
  const file = String(doc.url_uiid ?? '').replace(/^(?:\.\.\/bo\/|bo\/|\.\/)/, '');
  if (!board || !file || !published || published < since) return null;
  const number = shelf.numbered ? text(doc.numero) : null;
  const shown = number ? `${number} ${title}` : title;
  return { board, url: `${city.source.base}/web/server/get_file.php?file=${encodeURIComponent(file)}`, published,
    layout: shelf.layout ?? city.source.formats?.[board] ?? 'grid', title: shown,
    ...(city.source.checkDossier ? { dossier: municipalDossier(shown, city) ?? undefined } : {}) };
}

/** A PDF served under another dossier's indexed URL must never be imported. */
export function digilorMatchingRows(city, file, rows) {
  return city.source.checkDossier && file.dossier
    ? rows.filter((row) => municipalDossier(row.cells[0], city) === file.dossier) : rows;
}

// --- Tables whose cells are centred on their row ----------------------------

/** `27 / 36` alone in a page's bottom margin: Firefox's page footer. */
const BARE_PAGE_FOOTER_RE = /^\d+\s*\/\s*\d+$/;

/**
 * The parts of a number a narrow column prints over several lines, joined:
 * `DP 074 010 24` / `00298 M04`, `PC 063 113 21 G0729` / `M01`, `PC 068224
 * 25 S` / `0089`. Lines that are not part of a number — Annecy prints the
 * posting date under it, in the same column — are handed back apart.
 *
 * @param {Array<string>} cellLines
 * @returns {{dossier: ?string, others: Array<string>}}
 */
export function joinDossier(cellLines) {
  let dossier = null;
  const others = [];
  for (const line of cellLines) {
    const value = text(line);
    if (!value) continue;
    if (!dossier) {
      if (DOSSIER_HEAD_RE.test(value) || DOSSIER_RE.test(value)) dossier = value;
      else others.push(value);
      continue;
    }
    if (DOSSIER_RE.test(dossier) && !/^[MTP]\d{1,2}$/i.test(value)) { others.push(value); continue; }
    if (/^(?:[A-Z]?\d{4,5})?(?:\s*[MTP]\d{1,2})?$/i.test(value) || (/[ A-Z]$/i.test(dossier) && /^\d{4,5}\b/.test(value))) {
      // A lone letter ending the head (`… 25 S`) is the counter's own.
      dossier = /\s[A-Z]$/i.test(dossier) && /^\d/.test(value) ? `${dossier}${value}` : `${dossier} ${value}`;
    } else others.push(value);
  }
  return { dossier, others };
}

/**
 * A table whose cells are centred on their row's middle and left-aligned on
 * their column (Annecy's lists printed from Firefox, Clermont-Ferrand's
 * Géosphère reports). Columns by their header: a run belongs to the last
 * header that starts at or left of it, give or take five points — a centred
 * date starts a little left of its own header — and a run left of every
 * header to the first. Rows one of two ways (`spec.rows`):
 *
 * - `gap`: a row ends where the page leaves an empty stretch taller than
 *   `spec.gap` — Annecy's rows are 16.4 points apart or more and their lines
 *   8, Clermont's decisions 21 and 8.66. A stretch with no number continues
 *   the row above it.
 * - `nearest`: each line goes to the nearest number, as on Marseille's list
 *   of decisions — Clermont's filings, where a four-line applicant leaves a
 *   gap inside a row as tall as the gap between two.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @param {{board: string, columns: Array<[string, string, {optional?: boolean}?]>,
 *   rows: 'gap'|'nearest', gap?: number, build: (cells: Record<string, Array<string>>) => ?object}} spec
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw.
 */
export function readBandTable(document, spec) {
  const rows = [];
  const { pages } = pageRuns(document);
  for (const page of pages) {
    const runs = page.filter((run) => !(BARE_PAGE_FOOTER_RE.test(text(run.text) ?? '') && run.y < 40));
    const header = gridHeader(runs, spec.columns);
    if (!header) continue;
    const columns = [...header.columns].sort((a, b) => a.x - b.x);
    const columnOf = (run) => {
      let found = columns[0];
      for (const column of columns) if (column.x <= run.x + 5) found = column;
      return found.field;
    };
    const isAnchor = (run) => columnOf(run) === 'dossier' && DOSSIER_HEAD_RE.test(text(run.text) ?? '');
    // No furniture test here: the title, the commune and the edition date sit
    // over the header, and the only footer is Firefox's `n / N`, dropped
    // above. A centred row's last lines hang below its number, where a test
    // for repeated text would only ever take a row's own words.
    const body = runs.filter((run) => run.y < header.bottom - 1 && !header.runs.includes(run))
      .sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const groups = [];
    if (spec.rows === 'gap') {
      let current = null;
      let previousY = null;
      for (const run of body) {
        if (!current || previousY - run.y > spec.gap) {
          current = [];
          groups.push(current);
        }
        current.push(run);
        previousY = run.y;
      }
      // A stretch with no number continues the row above; one with two is
      // split between them, each line to the nearer number.
      for (let i = groups.length - 1; i > 0; i -= 1) {
        if (!groups[i].some(isAnchor)) { groups[i - 1].push(...groups[i]); groups.splice(i, 1); }
      }
    } else {
      groups.push(body);
    }
    for (const group of groups) {
      const anchors = group.filter(isAnchor);
      if (!anchors.length) continue;
      const members = anchors.map(() => []);
      for (const run of group) {
        let at = 0;
        for (let i = 1; i < anchors.length; i += 1) {
          if (Math.abs(anchors[i].y - run.y) < Math.abs(anchors[at].y - run.y)) at = i;
        }
        members[at].push(run);
      }
      anchors.forEach((anchor, i) => {
        const cells = {};
        for (const run of members[i]) (cells[columnOf(run)] ??= []).push(run);
        const byField = Object.fromEntries(Object.entries(cells).map(([field, cellRuns]) => [field, sameLines(cellRuns)]));
        const row = spec.build(byField);
        if (row && DOSSIER_RE.test(text(row.dossier) ?? '')) rows.push({ board: spec.board, ...row });
      });
    }
  }
  return rows;
}

/** A cell's lines, the runs that share a line joined in reading order. */
function sameLines(cellRuns) {
  const out = [];
  let line = null;
  for (const run of [...cellRuns].sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
    if (line && Math.abs(line.y - run.y) < 1) { line.text = `${line.text} ${run.text}`; continue; }
    line = { y: run.y, text: run.text };
    out.push(line);
  }
  return out.map((item) => text(item.text)).filter(Boolean);
}

/** `569 m²` → `569`. */
function area(value) {
  const found = number(String(value ?? '').replace(/\s*m(?:²|2)\s*$/i, ''));
  return found === null ? null : String(found);
}

/** Annecy's lists: the columns of both, the decisions' `Décision` the one apart. */
function annecySpec(board) {
  const decided = board === PERMIT_LIST_BOARDS.decisions;
  return Object.freeze({
    board,
    rows: 'gap',
    gap: 12,
    columns: Object.freeze([
      ['dossier', 'N° DE DOSSIER'], ['filedOn', 'DATE DEPOT'], ['applicant', 'DEMANDEUR'],
      ['site', decided ? 'LIEUX DES' : 'LIEUX DES TRAVAUX'], ['landArea', 'SUPERFICIE'],
      ['purpose', 'NATURE DES TRAVAUX'], ['project', 'PROJET'],
      ...(decided ? [['verdict', 'DECISION']] : []),
    ]),
    build: (cells) => {
      const { dossier, others } = joinDossier(cells.dossier ?? []);
      const place = parseCartdsPlace(joined(cells.site));
      const project = cartdsProject(joined(cells.project));
      const decision = decided ? registerDecision(cells.verdict ?? []) : null;
      return {
        dossier,
        label: null,
        purpose: joined(cells.purpose),
        applicant: joined(cells.applicant),
        address: place.address,
        postcode: place.postcode,
        locality: place.locality,
        filedOn: listDay(joined(cells.filedOn)),
        verdict: decision?.verdict ?? null,
        decidedOn: decision?.decidedOn ?? null,
        postedOn: listDay(others.find((line) => /^\d{2}\/\d{2}\/\d{4}$/.test(line))),
        landArea: area(joined(cells.landArea)),
        housing: null,
        lots: project.lots === null ? null : String(project.lots),
        floorArea: project.createdM2 === null ? null : String(project.createdM2),
        parcels: place.parcels.map((parcel) => parcel.label).join(', ') || null,
      };
    },
  });
}

/**
 * Clermont-Ferrand's decisions (« Registre d'affichage de la décision »): the
 * works and the site share a column, the site last and after a dash; `Retiré
 * le` is the day the notice comes down, two months on, not a withdrawal.
 */
const CLERMONT_DECISIONS = Object.freeze({
  board: PERMIT_LIST_BOARDS.decisions,
  rows: 'gap',
  gap: 14,
  columns: Object.freeze([
    ['dossier', 'N° DE DOSSIER'], ['applicant', 'DEMANDEUR'], ['works', 'OBJET DES TRAVAUX'],
    ['decidedOn', 'DATE DE LA DECISION'], ['postedOn', 'DATE AFFICHAGE DECISION'], ['down', 'RETIRE LE'],
    ['verdict', 'NATURE DE LA DECISION'],
  ]),
  build: (cells) => {
    const { dossier } = joinDossier(cells.dossier ?? []);
    const works = cells.works ?? [];
    const at = works.findIndex((line) => /^-\s/.test(line));
    const purpose = text((at < 0 ? works : works.slice(0, at)).join(' '));
    const address = at < 0 ? null : text(works.slice(at).join(' ').replace(/^-\s*/, ''));
    return {
      dossier,
      label: null,
      purpose,
      applicant: registerApplicant(cells.applicant ?? []),
      address,
      postcode: null,
      locality: null,
      filedOn: null,
      verdict: joined(cells.verdict),
      decidedOn: listDay(joined(cells.decidedOn)),
      postedOn: listDay(joined(cells.postedOn)),
      landArea: null,
      housing: null,
      lots: null,
      floorArea: null,
      parcels: null,
    };
  },
});

/** Clermont-Ferrand's decision codes in its list of filings. */
// i18n-ignore-start — the software's own codes and words
const CLERMONT_CODES = Object.freeze({
  F: 'Favorable', FR: 'Favorable avec réserve', D: 'Défavorable', A: 'Annulation',
  FT: 'Favorable tacite', RT: 'Rejet tacite',
});
// i18n-ignore-end

/**
 * Clermont-Ferrand's filings (« Répertoire des dossiers déposés »), every
 * dossier filed since 1 January with its decision once taken: the applicant
 * cell is the name over the applicant's own address (only the name is read),
 * the site cell the address, the works and, last, the parcels.
 */
const CLERMONT_FILINGS = Object.freeze({
  board: PERMIT_LIST_BOARDS.filings,
  rows: 'nearest',
  columns: Object.freeze([
    ['dossier', 'N° DE DOSSIER'], ['filedOn', 'DATE DE DEPOT'], ['applicant', 'DEMANDEUR'],
    ['site', 'ADRESSE DU TERRAIN'], ['floor', 'SHON'], ['housing', 'NB LOGTS'],
    ['decision', 'NATURE ET DATE DE DECISION'],
  ]),
  build: (cells) => {
    const { dossier } = joinDossier(cells.dossier ?? []);
    const site = cells.site ?? [];
    const last = site.at(-1);
    const parcels = site.length > 1 && listParcels(last).length ? last : null;
    const decision = /^([A-Z]{1,2})\s+(\d{2}\/\d{2}\/\d{4})$/.exec(joined(cells.decision) ?? '');
    const floors = (cells.floor ?? []).map((line) => number(line)).filter((value) => value !== null);
    return {
      board: decision ? PERMIT_LIST_BOARDS.decisions : PERMIT_LIST_BOARDS.filings,
      dossier,
      label: null,
      purpose: text(site.slice(1, parcels ? -1 : undefined).join(' ')),
      applicant: registerApplicant(cells.applicant ?? []),
      address: text(site[0]),
      postcode: null,
      locality: null,
      filedOn: listDay(joined(cells.filedOn)),
      verdict: decision ? CLERMONT_CODES[decision[1]] ?? decision[1] : null,
      decidedOn: decision ? listDay(decision[2]) : null,
      postedOn: null,
      landArea: null,
      housing: number(joined(cells.housing)) ? joined(cells.housing) : null,
      lots: null,
      floorArea: floors.at(-1) ? String(floors.at(-1)) : null,
      parcels,
    };
  },
});

// --- Versailles: a register whose every cell is its own clip ---------------

/** The labels Versailles's register writes at the head of a cell's lines. */
// i18n-ignore-next-line — the register's own labels, matched on
const VERSAILLES_LABEL_RE = /^(d[ée]p[ôo]t le|complet le|par|repr[ée]sentant\s*:|auteur\s*:|terrain\s*:|sis|surface\s*:|propri[ée]taire\s*:|projet\s*:|surface de plancher [^\s:]+\s*:|nb logements cr[ée]{2}s\s*:|destination\s*:|hauteur\s*:|sign[ée]e le\s*:|notifi[ée] le\s*:|nature de la d[ée]cision\s*:)\s*(.*)$/i;

/**
 * A cell's lines as labelled values: each labelled line opens a value, the
 * lines after it continue it — `Projet : Remplacement des` / `menuiseries`.
 * @param {Array<string>} cellLines
 * @returns {Map<string, string>} Folded label → value.
 */
function labelled(cellLines) {
  const out = new Map();
  let label = null;
  for (const line of cellLines) {
    const match = VERSAILLES_LABEL_RE.exec(line);
    if (match) {
      label = fold(match[1]).replace(/\s*:$/, '');
      if (!out.has(label)) out.set(label, text(match[2]) ?? '');
      continue;
    }
    if (label) out.set(label, text(`${out.get(label)} ${line}`));
  }
  return out;
}

/**
 * `AX0288 AH0109` — Versailles's parcels, a section of one or two characters
 * and a number on four digits, spaces between — as the list cells write them
 * everywhere else: `AX 0288, AH 0109`.
 * @param {?string} value
 * @returns {?string}
 */
export function versaillesParcels(value) {
  const out = [];
  for (const token of String(value ?? '').toUpperCase().split(/[\s,;]+/)) {
    const match = /^([A-Z0-9]{0,1}[A-Z])(\d{4})$/.exec(token);
    if (match) out.push(`${match[1]} ${match[2]}`);
  }
  return out.length ? out.join(', ') : null;
}

/**
 * Versailles's « Registre des autorisations d'urbanisme déposées / décidées »,
 * fortnightly, one row per dossier.
 *
 * EVERY CELL IS ITS OWN CLIP. Word draws each cell of the table under a clip
 * rectangle, so a row is the runs that share a clip's top and bottom, and a
 * column the header whose clip starts where the run's does — no geometry to
 * infer, where the text itself is centred in each cell and a two-line site
 * starts above the dossier's number. The header (`Dossier`, `Terrain`,
 * `Description`, `Décision`) is printed under each section's title only, so
 * its columns are carried from page to page; a run under the page's own clip
 * — the title, the section headings — is no cell. A row never splits across
 * pages (none of 2 912 in the 34 files of 2026).
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw, each with its board.
 */
export function readVersaillesList(document) {
  const rows = [];
  let board = null;
  let columns = null;
  // i18n-ignore-start — the register's own title and headers, matched on
  const HEADS = Object.freeze({ DOSSIER: 'dossier', TERRAIN: 'site', DESCRIPTION: 'project', DECISION: 'decision' });
  for (const page of document?.pages ?? []) {
    const cells = new Map();
    for (const run of page.runs ?? []) {
      const words = text(run.text);
      if (!words) continue;
      const full = !run.clip || (run.clip.x0 <= 0.5 && run.clip.y0 <= 0.5);
      if (full) {
        const title = /D'URBANISME\s+(DEPOSEES|DECIDEES)/.exec(fold(words));
        if (title) board = title[1] === 'DEPOSEES' ? PERMIT_LIST_BOARDS.filings : PERMIT_LIST_BOARDS.decisions;
        continue;
      }
      const head = HEADS[fold(words)];
      if (head && run.size >= 11) { (columns ??= {})[head] = run.clip; continue; }
      const key = `${run.clip.y0.toFixed(1)}|${run.clip.y1.toFixed(1)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(run);
    }
    // i18n-ignore-end
    if (!columns) continue;
    for (const group of cells.values()) {
      const byField = {};
      for (const run of group) {
        const field = Object.keys(columns).find((name) => Math.abs(columns[name].x0 - run.clip.x0) < 1.5);
        if (field) (byField[field] ??= []).push(run);
      }
      const dossierLines = lines(byField.dossier ?? []);
      const { dossier } = joinDossier(dossierLines);
      if (!dossier || !DOSSIER_RE.test(dossier)) continue;
      const who = labelled(dossierLines);
      const site = labelled(lines(byField.site ?? []));
      const project = labelled(lines(byField.project ?? []));
      const decision = labelled(lines(byField.decision ?? []));
      const decided = Boolean(columns.decision) && board === PERMIT_LIST_BOARDS.decisions;
      rows.push({
        board: decided ? PERMIT_LIST_BOARDS.decisions : (board ?? PERMIT_LIST_BOARDS.filings),
        dossier,
        label: null,
        purpose: project.get('PROJET') ?? null,
        applicant: who.get('PAR') ?? null,
        address: site.get('SIS') ?? null,
        postcode: null,
        locality: null,
        filedOn: listDay(who.get('DEPOT LE')),
        verdict: decided ? decision.get('NATURE DE LA DECISION') ?? null : null,
        decidedOn: decided ? listDay(decision.get('SIGNEE LE')) : null,
        postedOn: null,
        landArea: area(site.get('SURFACE')),
        housing: number(project.get('NB LOGEMENTS CREES')) ? project.get('NB LOGEMENTS CREES') : null,
        lots: null,
        floorArea: area(project.get('SURFACE DE PLANCHER CREEE')),
        parcels: versaillesParcels(site.get('TERRAIN')),
      });
    }
  }
  return rows;
}

// --- Google Drive: a public folder, listed without a key -------------------

/** A public folder's listing, plain HTML, no key, no script. */
export function driveFolderUrl(id) {
  return `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(id)}`;
}

/** A public file's bytes. */
export function driveFileUrl(id) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download`;
}

/**
 * The entries of a folder's listing: each `flip-entry` block holds an id, a
 * link that says whether it is a folder or a file, and a title. The dates the
 * listing prints are the viewer's locale and a re-upload's day: not read.
 * @param {string} html
 * @returns {Array<{id: string, folder: boolean, title: string}>}
 */
export function parseDriveFolder(html) {
  const out = [];
  for (const block of String(html ?? '').split('<div class="flip-entry" id="entry-').slice(1)) {
    const id = block.slice(0, block.indexOf('"'));
    const href = decodeEntities(/<a href="([^"]+)"/.exec(block)?.[1] ?? '');
    const title = text(decodeEntities(/<div class="flip-entry-title">([^<]*)<\/div>/.exec(block)?.[1] ?? ''));
    if (!/^[\w-]{10,}$/.test(id) || !title) continue;
    const folder = href.includes('/drive/folders/');
    if (!folder && !href.includes('/file/d/')) continue;
    out.push({ id, folder, title });
  }
  return out;
}

// --- La Rochelle: a Liferay document space per board ------------------------

/**
 * A number as La Rochelle spells it, the Sitadel way: `DP 17300 26 1032`,
 * `DP 17 300 26 0753`, `PC17300 19 0215 M03`, `DP 17300 26 918 m2` → the
 * commune on five digits, the counter on five, the suffix on two
 * (`DP 17300 26 01032`, `PC 17300 19 00215 M03`). Sitadel writes
 * `0173002601046`.
 * @param {?string} raw
 * @returns {?string}
 */
export function laRochelleDossier(raw) {
  const match = /^(PC|DP|PA|PD|CU)\s*(\d{2})\s?(\d{3})\s+(\d{2})\s+(\d{3,5})(?:\s*([MT])\s*(\d{1,2}))?$/i
    .exec(text(raw) ?? '');
  if (!match) return null;
  const [, kind, dept, commune, year, counter, step, rank] = match;
  const suffix = step ? ` ${step.toUpperCase()}${rank.padStart(2, '0')}` : '';
  return `${kind.toUpperCase()} ${dept}${commune} ${year} ${counter.padStart(5, '0')}${suffix}`;
}

/**
 * The address of a Liferay document space's children: a portlet resource
 * that answers the space's files as JSON. `nbItems` caps the answer silently
 * — the page asks 250, and the decisions' space held 371 on 2026-10-01 — so
 * 5 000 is asked. The portlet's instance is the one the space's own links
 * use (`depotdesdemandesdurbanisme_…`), not the hyphenated one the page
 * embeds, which the file proxy refuses.
 * @param {object} city
 * @param {{path: string, instance: string, space: string}} shelf
 */
export function liferayTreeUrl(city, shelf) {
  const portlet = `10030_WAR_fu_INSTANCE_${shelf.instance}`;
  const p = `_${portlet}_`;
  const params = new URLSearchParams({
    p_p_id: portlet, p_p_lifecycle: '2', p_p_state: 'exclusive', p_p_mode: 'view',
    p_p_resource_id: 'load-espace-children', p_p_cacheability: 'cacheLevelPage',
    [`${p}displayIcons`]: 'false', [`${p}displayLinks`]: 'true', [`${p}displayDate`]: 'false',
    [`${p}displayNbElements`]: 'false', [`${p}tri`]: 'cm:title', [`${p}downloadIcone`]: 'true',
    [`${p}onlyFolders`]: 'false', [`${p}displayThumbnails`]: 'false', [`${p}displaySize`]: 'true',
    [`${p}nbItems`]: '5000', [`${p}espaceId`]: shelf.space,
  });
  return `${city.source.base}${shelf.path}?${params}`;
}

/**
 * The files of a space's answer: each node's `data.attr` holds the title and
 * the link; a folder has no `file-` icon. Null for an answer that is not a
 * list of nodes.
 * @param {*} json
 * @returns {?Array<{title: string, url: string}>}
 */
export function parseLiferayTree(json) {
  if (!Array.isArray(json)) return null;
  const out = [];
  for (const node of json) {
    const data = node?.data;
    if (!/\bfile-/.test(String(data?.icon ?? ''))) continue;
    const title = text(data?.attr?.title);
    const url = text(data?.attr?.href);
    if (title && url && /^https:\/\//.test(url)) out.push({ title, url });
  }
  return out;
}

/**
 * A decision's file title: `2026-09-30 DP 17300 26 01057 <the applicant>`.
 * Only its day — the day the decision was posted, a day after it was signed
 * in the median — and its number are read: the rest names a person.
 * @param {?string} title
 * @returns {?{day: string, dossier: string}}
 */
export function laRochelleDecisionTitle(title) {
  const match = /^(\d{4}-\d{2}-\d{2})[\s_]+((?:PC|DP|PA|PD|CU)\s*\d{2}\s?\d{3}\s+\d{2}\s+\d{3,5}(?:\s*[MT]\s*\d{1,2}\b)?)/i
    .exec(text(title) ?? '');
  const dossier = match ? laRochelleDossier(match[2]) : null;
  return dossier ? { day: match[1], dossier } : null;
}

/**
 * What an arrêté of La Rochelle decides, read from its title block and its
 * first article — loosely, for a third of them are scans read by OCR
 * (`REFUSt`, `SUSV1SEE`). Null when the text says nothing readable: three of
 * 40 sampled were scans without text or fonts without characters.
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @returns {?string} The verdict, in words the shared ladder reads.
 */
export function laRochelleVerdict(document) {
  const all = (document?.pages ?? []).flatMap((page) => [...(page.runs ?? [])]
    .sort((a, b) => (b.y - a.y) || (a.x - b.x)).map((run) => run.text));
  if (!all.length) return null;
  const head = fold(all.slice(0, 14).join(' '));
  const article = fold(/ARTICLE\s*1\s*:?(.{0,200})/i.exec(all.join(' '))?.[1] ?? '');
  const both = `${head} ${article}`;
  // i18n-ignore-start — the arrêtés' own words, matched on; the verdicts in the ladder's words
  if (/RETIR/.test(article) || /PORTANT RETRAIT/.test(head)) return 'Retrait';
  if (/REFUS/.test(head.replace(/NON[- ]?OPPOSITION/g, '')) || /REFUS/.test(article)) return 'Refus';
  if (/OPPOSITION A/.test(head.replace(/NON[- ]?OPPOSITION/g, ''))) return 'Opposition';
  if (/NON[- ]?OPPOSITION/.test(head) || /PEUVENT ETRE EXECUTES/.test(article)) return 'Non-opposition';
  if (/TACI/.test(both)) return 'Accord tacite';
  if (/ACCORDANT|ACCORDE/.test(both) || /AUTORISE A DIVISER/.test(article)) return 'Accord';
  if (/TRANSFER/.test(both)) return 'Accord (transfert)';
  // i18n-ignore-end
  return null;
}

/**
 * One decision file of La Rochelle as a row: the number and the day from the
 * file's title, the verdict from its text.
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @param {{title?: string}} [context]
 * @returns {Array<object>}
 */
export function readLaRochelleDecision(document, context = {}) {
  const head = laRochelleDecisionTitle(context.title);
  const verdict = head ? laRochelleVerdict(document) : null;
  if (!head || !verdict) return [];
  return [{
    board: PERMIT_LIST_BOARDS.decisions, dossier: head.dossier, label: null, purpose: null, applicant: null,
    address: null, postcode: null, locality: null, filedOn: null, verdict, decidedOn: null, postedOn: head.day,
    landArea: null, housing: null, lots: null, floorArea: null, parcels: null,
  }];
}

/** A La Rochelle filing number, `DP 17300 26 01046`, or the date stuck before it. */
const LR_NUMBER_RE = /^(?:PC|DP|PA|PD|CU|AT)\s*\d{2}\s?\d{3}\s+\d{2}\s+\d{3,5}(?:\s*[MT]\s*\d{1,2})?$/i;
const LR_MERGED_RE = /^(\d{2}\/\d{2}\/\d{4})\s*((?:PC|DP|PA|PD|CU|AT)\b.*)$/i;

/**
 * La Rochelle's weekly list of filed dossiers, an Excel sheet printed by
 * Acrobat.
 *
 * BOTTOM-ALIGNED. Excel sits every cell on its row's bottom line: the date,
 * the number and every cell's last line share the row's baseline, and a
 * wrapped cell's other lines rise above it. So a line belongs to the nearest
 * number at or below it. The columns are where the rows' baselines start —
 * five sets of edges over 21 files, the header centred in some and not in
 * others — the floor area and height at the right by their headers. Nine
 * files of 21 draw a row's date and number as one run
 * (`23/04/2026PC 17300 26 00075`): split, the number at the page's number
 * column.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw.
 */
export function readLaRochelleFilings(document) {
  const rows = [];
  const fields = ['filedOn', 'dossier', 'applicant', 'address', 'purpose'];
  for (const page of document?.pages ?? []) {
    const plain = page.runs.filter((run) => LR_NUMBER_RE.test(text(run.text) ?? '')).map((run) => run.x);
    const numberX = plain.length ? plain.sort((a, b) => a - b)[Math.floor(plain.length / 2)] : null;
    const runs = page.runs.flatMap((run) => {
      const merged = LR_MERGED_RE.exec(text(run.text) ?? '');
      if (!merged) return [run];
      const x = numberX ?? run.x + 50;
      return [{ ...run, x1: x - 3, text: merged[1] }, { ...run, x, text: merged[2] }];
    });
    // i18n-ignore-start — the sheet's own header words, matched on
    const surface = runs.find((run) => fold(run.text) === 'SURFACE');
    const height = runs.find((run) => fold(run.text) === 'HAUTEUR');
    const bottoms = runs.filter((run) => /^(DEPOT|PROJETEE|MAXIMALE)$/.test(fold(run.text))).map((run) => run.y);
    if (!surface || !bottoms.length) continue;
    const headerBottom = Math.min(...bottoms);
    const body = runs.filter((run) => run.y < headerBottom - 1 && !/^affich[ée] le /i.test(run.text));
    // i18n-ignore-end
    const anchors = body.filter((run) => LR_NUMBER_RE.test(text(run.text) ?? '')).sort((a, b) => b.y - a.y);
    const edges = [];
    for (const anchor of anchors) {
      for (const run of body) {
        if (Math.abs(run.y - anchor.y) < 1.5 && run.x < surface.x - 15 && !edges.some((edge) => Math.abs(edge - run.x) < 2)) edges.push(run.x);
      }
    }
    edges.sort((a, b) => a - b);
    const centre = (run) => (run.x + (run.x1 > run.x ? run.x1 : run.x)) / 2;
    const columnOf = (run) => {
      if (run.x > surface.x - 15) {
        return !height || Math.abs(centre(run) - centre(surface)) < Math.abs(centre(run) - centre(height)) ? 'floorArea' : 'height';
      }
      let at = -1;
      edges.forEach((edge, k) => { if (edge <= run.x + 2) at = k; });
      return fields[at] ?? null;
    };
    const cells = anchors.map(() => ({}));
    for (const run of body) {
      let best = -1;
      // The nearest number at or below the line: the highest of those under it.
      anchors.forEach((anchor, i) => { if (run.y >= anchor.y - 1.5 && (best < 0 || anchor.y > anchors[best].y)) best = i; });
      const field = best < 0 ? null : columnOf(run);
      if (field) (cells[best][field] ??= []).push(run);
    }
    anchors.forEach((anchor, i) => {
      const value = (field) => text(lines(cells[i][field] ?? []).join(' '));
      const floor = number(value('floorArea'));
      rows.push({
        board: PERMIT_LIST_BOARDS.filings,
        dossier: laRochelleDossier(anchor.text) ?? text(anchor.text),
        label: null,
        purpose: value('purpose'),
        applicant: value('applicant'),
        address: value('address'),
        postcode: null,
        locality: null,
        filedOn: listDay(value('filedOn')),
        verdict: null,
        decidedOn: null,
        postedOn: null,
        landArea: null,
        housing: null,
        lots: null,
        floorArea: floor ? String(floor) : null,
        parcels: null,
      });
    });
  }
  return rows;
}

// --- Limoges: an Arcade portal, decisions by title, filings as tables (Trap 8)

/**
 * A Limoges number as its lists and its acts' titles spell it, Sitadel's way:
 * `DP 87 085 2601030` on a list, `PC07C0325M04_DECISION_SIGNEE`,
 * `DP_ARRÊTÉ_2600984 ÉTAT` and `DP 2600604 DECISION SIGNEE` in a title →
 * `DP 087085 26 01030`, `PC 087085 07 C0325 M04`. The counter is five digits,
 * or a letter and four (`07C0325`, `24A0002`) on the older series, as Sitadel
 * writes it (`08708524C0181`). Three titles of 647 drop the year
 * (`DP00782M02_…`) and are no number.
 * @param {?string} raw
 * @returns {?string}
 */
export function limogesDossier(raw) {
  // i18n-ignore-next-line — the city's own title word, matched on
  const match = /^(PC|DP|PA|PD|CU)[\s_]*(?:87\s?085\s*)?(?:ARR[ÊE]T[ÉE][\s_]*)?(\d{2})\s?([A-Z]?\d{4,5})(?!\d)(?:\s*([MT])\s*(\d{1,2})(?!\d))?/i
    .exec(text(raw) ?? '');
  if (!match) return null;
  const [, kind, year, counter, step, rank] = match;
  const number = /^\d+$/.test(counter) ? counter.padStart(5, '0') : counter.toUpperCase();
  const suffix = step ? ` ${step.toUpperCase()}${rank.padStart(2, '0')}` : '';
  return `${kind.toUpperCase()} 087085 ${year} ${number}${suffix}`;
}

/**
 * An Arcade portal's urbanism acts, newest first, a page at a time. The
 * search is the one the portal's own pages send; 200 acts a page is two
 * weeks of Limoges's in a busy month.
 * @param {object} city A city whose `source.kind` is `arcade`.
 * @param {{page?: number, size?: number}} [options]
 */
export function arcadeSearchUrl(city, { page = 0, size = 200 } = {}) {
  const params = new URLSearchParams({
    viewName: 'fileViewer',
    filter: 'entityType.code = ACTE,parameters.ACTE_TYPE = Urbanisme',
    page: String(page),
    size: String(size),
    sort: 'id,desc',
  });
  return `${city.source.base}/public/api/entities/search/findBySpecification?${params}`;
}

/** The files an act holds: an act is a folder, its PDF a child of it. */
export function arcadeFilesUrl(city, id) {
  const params = new URLSearchParams({ viewName: 'fileViewer', filter: `parent.id = ${id}`, page: '0', size: '10' });
  return `${city.source.base}/public/api/entities/search/findBySpecification?${params}`;
}

/** A file's bytes, by the content id the search gives it. */
export function arcadeContentUrl(city, contentId) {
  return `${city.source.base}/arcade/api/entities/content/${encodeURIComponent(contentId)}`;
}

/**
 * The address an act's rows are kept under once read: never fetched, the
 * act's own place in the portal, which a new edition does not reuse.
 */
export function arcadeActUrl(city, id) {
  return `${city.source.base}/public/api/entities/${id}`;
}

/** `20260928000000` → `2026-09-28`; Limoges's one `00260605000000` is no day. */
function arcadeDay(value) {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(String(value ?? ''));
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1970 && year <= 2100 ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/**
 * One page of an Arcade search as acts: the id, the title, the shelf it is
 * published on (`Permis de construire délivrés`, `Autorisations déposées`),
 * the day it was signed and the day it was published.
 * @param {*} json
 * @returns {?{acts: Array<{id: number, title: string, shelf: ?string, actOn: ?string,
 *   publishedOn: ?string}>, last: boolean}} Null for an answer that is not a page of acts.
 */
export function arcadeActs(json) {
  if (!Array.isArray(json?.content)) return null;
  const acts = [];
  for (const entity of json.content) {
    const values = Object.fromEntries((entity?.parameters ?? []).map((parameter) => [parameter?.propertyTypeCode, parameter?.value]));
    const title = text(values.ACTE_TITLE);
    if (!Number.isInteger(entity?.id) || !title) continue;
    acts.push({
      id: entity.id,
      title,
      shelf: text(values.ACTE_CRAP_PLCL_URBA),
      actOn: arcadeDay(values.ACTE_DATE_ACT) ?? arcadeDay(values.ACTE_RAP_DATE_SIGN),
      publishedOn: arcadeDay(values.ACTE_CRAP_DATE_PUB) ?? arcadeDay(String(entity.publicationDate ?? '').replace(/-/g, '')),
    });
  }
  const { number, totalPages } = json.page ?? {};
  return { acts, last: !Number.isInteger(number) || !Number.isInteger(totalPages) || number >= totalPages - 1 };
}

/**
 * The PDF an act holds, out of its files' answer, or null.
 * @param {*} json
 * @returns {?string} Its content id.
 */
export function arcadeFileContent(json) {
  const file = (Array.isArray(json?.content) ? json.content : [])
    .find((entity) => entity?.mimeType === 'application/pdf' && text(entity.contentId));
  return file ? text(file.contentId) : null;
}

/**
 * Whether an act is a list of filings rather than a decision: its shelf
 * (`Autorisations déposées`) or its title (`LISTE DU 01.09.26 AU 25.09.26`,
 * `AFFICHAGE JUILLET-AOUT 26`, posted under `Documents d'urbanisme`).
 */
export function arcadeIsList(act) {
  // i18n-ignore-next-line — the city's own shelf and title words, matched on
  return /^autorisations d[ée]pos[ée]es$/i.test(act?.shelf ?? '') || /^(liste|affichage)\b/i.test(act?.title ?? '');
}

/** What a Limoges decision says of itself: the title's words, off the ladder (Trap 8). */
// i18n-ignore-next-line — a verdict in the payload's French, as published verdicts are
export const LIMOGES_VERDICT = 'Décision signée';

/**
 * One Limoges decision act as a row, from its title and its days alone, or
 * null for an act that is no decision on a numbered dossier.
 * @param {{title: string, actOn: ?string, publishedOn: ?string}} act From {@link arcadeActs}.
 * @returns {?object}
 */
export function limogesDecisionRow(act) {
  if (arcadeIsList(act)) return null;
  const dossier = limogesDossier(act?.title);
  if (!dossier) return null;
  return {
    board: PERMIT_LIST_BOARDS.decisions, dossier, label: null, purpose: null, applicant: null,
    address: null, postcode: null, locality: null, filedOn: null, verdict: LIMOGES_VERDICT,
    decidedOn: act.actOn ?? null, postedOn: act.publishedOn ?? null,
    landArea: null, housing: null, lots: null, floorArea: null, parcels: null,
  };
}

/** Limoges's list headers, folded, and the fields they name. */
const LIMOGES_HEADERS = Object.freeze({
  // i18n-ignore-start — the lists' own header words, matched on
  NUMERO: 'dossier',
  DEMANDEUR: 'applicant',
  'ADRESSE TRAVAUX': 'address',
  'NATURE DES TRAVAUX': 'purpose',
  'DEPOSE LE': 'filedOn',
  // i18n-ignore-end
});

/** A number as a Limoges list prints it, alone in its cell. */
const LIMOGES_LIST_NUMBER_RE = /^(PC|DP|PA|PD|CU)\s+87\s?085\s+\d{2}\s?[A-Z]?\d{4,5}(?:\s*[MT]\d{1,2})?$/i;

/**
 * The lines of a column, each given to the row whose middle its cell is
 * centred on.
 *
 * A cell centred on its row reaches as far above the row's number as below
 * it, however many lines it has, so neither the nearest number nor the gaps
 * between lines will do: a description of fourteen lines and two blank ones
 * reaches past the numbers of the rows above and below (Limoges, 1 September
 * 2026). Each row takes a run of consecutive lines, in order, and the runs are
 * chosen together so that each is centred on its number as closely as may be
 * — a little of each run's height added, so that three one-line cells are
 * never read as one three-line cell centred on the middle number, and a line's
 * spacing for a row left empty, so that a row is not emptied to centre its
 * neighbour's cell better: a cell may sit half a line off its middle, Excel
 * counting a trailing blank line (`… remise en peinture` / ``, page 2 of the
 * September list).
 *
 * @param {Array<number>} lineYs The lines' heights, top to bottom.
 * @param {Array<number>} anchorYs The rows' numbers' heights, top to bottom.
 * @returns {Array<number>} For each line, the index of its row.
 */
export function centredRows(lineYs, anchorYs) {
  const n = lineYs.length;
  const m = anchorYs.length;
  if (!n || !m) return lineYs.map(() => 0);
  const gaps = lineYs.slice(1).map((y, i) => lineYs[i] - y).filter((gap) => gap > 1).sort((a, b) => a - b);
  const empty = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 10;
  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  const from = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(-1));
  cost[0][0] = 0;
  for (let k = 0; k < m; k += 1) {
    for (let i = 0; i <= n; i += 1) {
      const base = cost[i][k];
      if (base === Infinity) continue;
      if (base + empty < cost[i][k + 1]) { cost[i][k + 1] = base + empty; from[i][k + 1] = i; }
      for (let j = i + 1; j <= n; j += 1) {
        const top = lineYs[i];
        const bottom = lineYs[j - 1];
        const next = base + Math.abs((top + bottom) / 2 - anchorYs[k]) + 0.05 * (top - bottom);
        if (next < cost[j][k + 1]) { cost[j][k + 1] = next; from[j][k + 1] = i; }
      }
    }
  }
  const out = new Array(n).fill(0);
  let i = n;
  for (let k = m; k > 0; k -= 1) {
    const start = from[i][k];
    for (let line = start; line < i; line += 1) out[line] = k - 1;
    i = start;
  }
  return out;
}

/**
 * A run drawn across a column's edge, cut in two there: where capitals meet a
 * capitalised word (`EXEMPLESRemplacement`) or a word runs into a number
 * (`Paul8 RUE DES EXEMPLES`), or else at the start of the word nearest the
 * edge, a house number first (`SAS EXEMPLE rue …`). The edge's place in the
 * text is estimated from the run's width, evenly per character — capitals are
 * wider, so the estimate runs late, and a
 * cut further than a quarter of the run from it is no cut.
 * @param {object} run
 * @param {number} edge
 * @returns {?Array<object>} The two runs, or null.
 */
function cutOverflow(run, edge) {
  const value = String(run.text ?? '');
  const width = run.x1 - run.x;
  if (!(width > 0) || value.length < 2) return null;
  const at = ((edge - run.x) / width) * value.length;
  const near = (list) => list.reduce((best, i) => (best === null || Math.abs(i - at) < Math.abs(best - at) ? i : best), null);
  const turns = [];
  const starts = [];
  for (let i = 1; i < value.length; i += 1) {
    if (value[i - 1] === ' ' && value[i] !== ' ') starts.push(i);
    if ((/[A-Z0-9]/.test(value[i - 1]) && /[A-ZÉ]/.test(value[i]) && /[a-zàâçéèêëîïôûùüœ]/.test(value[i + 1] ?? ''))
      || (/[a-zàâçéèêëîïôûùüœ]/.test(value[i - 1]) && /\d/.test(value[i]))) turns.push(i);
  }
  const fits = (i) => i !== null && Math.abs(i - at) <= value.length / 4;
  // A site starts with its house number: a word that starts with a digit is
  // the likelier edge than the nearest word (`Paul 8 RUE`, not `RUE`).
  const digits = starts.filter((i) => /\d/.test(value[i]));
  const cut = [near(turns), near(digits), near(starts)].find(fits) ?? null;
  if (cut === null) return null;
  return [{ ...run, x1: edge, text: value.slice(0, cut).trim() }, { ...run, x: edge, text: value.slice(cut).trim() }];
}

/**
 * An applicant cell's lines, a name cut after a word that needs the next one
 * joined to it (`Commune de` / `Limoges`): the applicant is the first line,
 * the name of a person or a company, and a contact's first name under it is
 * never joined.
 * @param {?Array<string>} cellLines
 * @returns {Array<string>}
 */
function limogesApplicantLines(cellLines) {
  const out = [];
  for (const line of (cellLines ?? []).map((value) => text(value)).filter(Boolean)) {
    // i18n-ignore-next-line — French connectives, matched on
    if (out.length && /\b(?:de|du|des|d['’]|la|le|les|et|&)$/i.test(out.at(-1))) out[out.length - 1] = `${out.at(-1)} ${line}`;
    else out.push(line);
  }
  return out;
}

/**
 * Limoges's list of the dossiers filed over a month or two, an Excel sheet:
 * number, applicant, site, works and filing day, every cell centred on its
 * row ({@link centredRows}), the header on the first page only.
 *
 * TWO PRINTINGS. The list of 1-25 September 2026 holds the five columns on
 * one page; the July-August one was printed two pages wide, Excel's way: the
 * number, applicant and site of every row down seventeen pages, then the
 * works and the filing day of the same rows down seventeen more, at the same
 * heights. A page with no number is such a second half; the k-th of them
 * finishes the k-th page with numbers, its rows matched by height.
 *
 * A NUMBER MAY WRAP, its step on the line under it (`PC 87 085 21C0042` /
 * `M03`): the two lines are one cell, centred like the others, so the row's
 * middle is between them. A SITE MAY OVERFLOW into the works, drawn as one run
 * (`12 AVENUE DES EXEMPLESRemplacement de menuiserie…`, two rows of 114):
 * cut where the capitals end, at the column's edge.
 *
 * @param {?{pages: Array<{runs: Array<object>}>}} document
 * @returns {Array<object>} Rows of {@link PERMIT_LIST_FIELDS}, raw.
 */
export function readLimogesList(document) {
  const numbered = [];
  const halves = [];
  let numberColumns = null;
  let restColumns = null;
  for (const page of document?.pages ?? []) {
    const runs = page.runs ?? [];
    const heads = runs.filter((run) => Object.hasOwn(LIMOGES_HEADERS, fold(run.text)));
    const bottom = heads.length ? Math.min(...heads.map((run) => run.y)) : Infinity;
    if (heads.length) {
      const columns = heads.map((run) => ({ field: LIMOGES_HEADERS[fold(run.text)], x: run.x })).sort((a, b) => a.x - b.x);
      if (columns.some((column) => column.field === 'dossier')) numberColumns = columns;
      else restColumns = columns;
    }
    const body = runs.filter((run) => run.y < bottom - 1);
    const numbers = body.filter((run) => LIMOGES_LIST_NUMBER_RE.test(text(run.text) ?? '')).sort((a, b) => b.y - a.y);
    const anchors = numbers.map((run) => {
      const step = body.find((other) => Math.abs(other.x - run.x) < 3 && run.y - other.y > 0
        && run.y - other.y < 1.6 * (run.size || 11) && /^[MT]\d{1,2}$/i.test(text(other.text) ?? ''));
      return step
        ? { y: (run.y + step.y) / 2, text: `${text(run.text)} ${text(step.text)}`, runs: [run, step] }
        : { y: run.y, text: text(run.text), runs: [run] };
    });
    if (anchors.length && numberColumns) numbered.push({ body, anchors, columns: numberColumns });
    else if (!anchors.length && restColumns && body.length) halves.push({ body, columns: restColumns });
  }
  const rows = [];
  numbered.forEach((page, k) => {
    const cells = page.anchors.map(() => ({}));
    const numberRuns = new Set(page.anchors.flatMap((anchor) => anchor.runs));
    const fill = (body, columns) => {
      const columnOf = (run) => {
        let found = columns[0];
        for (const column of columns) if (column.x <= run.x + 3) found = column;
        return found.field;
      };
      const pieces = body.flatMap((run) => {
        const next = columns.find((column) => column.x > run.x + 3);
        return (next && run.x1 > next.x + 3 ? cutOverflow(run, next.x) : null) ?? [run];
      });
      const byField = {};
      for (const run of pieces) {
        if (numberRuns.has(run)) continue;
        const field = columnOf(run);
        if (field !== 'dossier') (byField[field] ??= []).push(run);
      }
      for (const [field, fieldRuns] of Object.entries(byField)) {
        const fieldLines = [];
        for (const run of [...fieldRuns].sort((a, b) => (b.y - a.y) || (a.x - b.x))) {
          const line = fieldLines.at(-1);
          if (line && Math.abs(line.y - run.y) < 1) line.text = `${line.text} ${run.text}`;
          else fieldLines.push({ y: run.y, text: run.text });
        }
        const owners = centredRows(fieldLines.map((line) => line.y), page.anchors.map((anchor) => anchor.y));
        fieldLines.forEach((line, i) => { (cells[owners[i]][field] ??= []).push(line.text); });
      }
    };
    fill(page.body, page.columns);
    // The second half only when it is one: as many pages, and its filing days
    // level with this page's numbers.
    const half = halves.length === numbered.length ? halves[k] : null;
    const level = half?.body.filter((run) => page.anchors.some((anchor) => Math.abs(anchor.y - run.y) < 1)).length ?? 0;
    if (half && level >= page.anchors.length / 2) fill(half.body, half.columns);
    page.anchors.forEach((anchor, i) => {
      const value = (field) => joined(cells[i][field]);
      rows.push({
        board: PERMIT_LIST_BOARDS.filings,
        dossier: limogesDossier(anchor.text),
        label: null,
        purpose: value('purpose'),
        applicant: gridApplicant(limogesApplicantLines(cells[i].applicant)),
        address: value('address'),
        postcode: null,
        locality: null,
        filedOn: listDay(value('filedOn')),
        verdict: null,
        decidedOn: null,
        postedOn: null,
        landArea: null,
        housing: null,
        lots: null,
        floorArea: null,
        parcels: null,
      });
    });
  });
  return rows;
}

// --- Lille: arrêtés scanned into a daily bulletin, read by OCR (Trap 9) ------

/** French month names and the abbreviations a date stamp prints, folded, by their first letters. */
const FRENCH_MONTH_STEMS = Object.freeze([
  // i18n-ignore-start — French month names, matched on
  ['JANV', 1], ['FEV', 2], ['MARS', 3], ['AVR', 4], ['MAI', 5], ['JUIN', 6],
  ['JUIL', 7], ['AOU', 8], ['SEP', 9], ['OCT', 10], ['NOV', 11], ['DEC', 12],
  // i18n-ignore-end
]);

/** A French month name or stamp abbreviation, `septembre`, `SEP.`, `AOÛT` → 9, 9, 8; or null. */
function frenchMonth(word) {
  const folded = fold(word).replace(/[^A-Z]/g, '');
  const found = FRENCH_MONTH_STEMS.find(([stem]) => folded.startsWith(stem));
  return found ? found[1] : null;
}

/** `2026`, `9`, `29` → `2026-09-29`, or null for a day the calendar does not have. */
function calendarDay(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** Days between two `YYYY-MM-DD`, `b - a`. */
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * The bulletins a city's page links, each with the day it is dated: Lille
 * writes `BO VDL du 29 septembre 2026`, `BO VDL du 1er juillet 2026`, `BO VDL
 * du 27 mars 2026 Tome 2` (181 links on 2026-10-01, every working day since
 * 2 January). A link's words give the day; its address is its identity, for
 * a bulletin is posted once and never replaced.
 *
 * @param {object} city A city whose `source.kind` is `bulletin`.
 * @param {string} html The page.
 * @returns {Array<{url: string, day: string, title: string}>} Oldest first.
 */
export function bulletinLinks(city, html) {
  const list = city.lists?.[0];
  const out = new Map();
  const pattern = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html ?? '').matchAll(pattern)) {
    let url;
    try { url = new URL(decodeEntities(match[1] ?? match[2] ?? '').trim(), city.page); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || !/\.pdf$/i.test(url.pathname)) continue;
    const title = text(decodeEntities(match[3].replace(/<[^>]*>/g, ' '))) ?? '';
    if (list?.link && !list.link.test(title)) continue;
    // i18n-ignore-next-line — the city's own link words, matched on
    const date = /\b(?:du\s+)?(\d{1,2})(?:er)?\s+([a-zà-ÿ]+)\s+(\d{4})\b/i.exec(title);
    const day = date ? calendarDay(date[3], frenchMonth(date[2]), date[1]) : null;
    if (day && !out.has(url.href)) out.set(url.href, { url: url.href, day, title });
  }
  return [...out.values()].sort((a, b) => a.day.localeCompare(b.day) || a.url.localeCompare(b.url));
}

/**
 * What an answer from a host behind a bot shield looks like when it is not
 * the page: Imperva's interstitial (`_Incapsula_Resource`, « Incapsula
 * incident ID ») or any CAPTCHA. Such an answer is never passed: the reading
 * stops there (Trap 9).
 * @param {?string} html
 * @returns {boolean}
 */
export function bulletinChallenge(html) {
  return /_Incapsula_Resource|Incapsula incident|captcha|cf-challenge|challenge-platform/i.test(String(html ?? ''));
}

/** OCR's confusions in a field that can only be digits. */
const OCR_DIGIT = Object.freeze({ O: '0', o: '0', Q: '0', D: '0', I: '1', l: '1', i: '1', '|': '1', '!': '1' });

function ocrDigits(value) {
  return String(value ?? '').replace(/[OoQDIli|!]/g, (char) => OCR_DIGIT[char]);
}

/**
 * The number at the top of a page: `DOSSIER N° PC 059350 26 00051`, `N° PC
 * 059350 25 00136 M01` on a modification's first page — the family, the
 * commune, the year, the counter, a step. Loose on the characters OCR
 * confuses (`659350`, `O0080`, `MO1`), strict on the shape.
 */
// i18n-ignore-next-line — the arrêtés' own header words, matched on
const BULLETIN_NUMBER_RE = /\bN\s*[°º*o0]?\s*:?\s*(PC|DP|PA|PD|CU)\s*([0-9OoQDIli|]{6,7})\s+([0-9OoQDIli|]{2})\s+([0-9OoQDIli|]{5})(?:\s*([MT])\s*([0-9OoIli|]{1,2}))?(?![0-9A-Za-z])/i;

/** A page's place in its arrêté: `PAGE 2/3`, `PAGE 2 /4`, `PAGE2/3`. */
const BULLETIN_PAGE_RE = /\bPAGE\s*\.?\s*(\d)\s*\/\s*(\d)\b/i;

/**
 * The head of one OCR'd page: the number it prints, and whether it is an
 * arrêté's first page. Null for a page that is no urbanism decision's.
 * @param {?string} pageText
 * @returns {?{reading: ?{kind: string, commune: string, year: string, counter: string, step: string},
 *   first: boolean}}
 */
export function bulletinPageHead(pageText) {
  const lines = String(pageText ?? '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 4);
  // i18n-ignore-start — the arrêtés' own header words, matched on
  const head = lines.find((line) => /DOSSIER|\bN\s*[°º*]\s*:?\s*(?:PC|DP|PA|PD|CU)\b/i.test(line));
  if (!head) return null;
  // The template's own field left unfilled: `DOSSIER N° «DOSSIERNOM» PAGE 3/3`.
  const blank = /DOSSIERNOM/i.test(head);
  // i18n-ignore-end
  const match = blank ? null : BULLETIN_NUMBER_RE.exec(head);
  if (!match && !blank) return null;
  const reading = match ? {
    kind: match[1].toUpperCase(),
    commune: ocrDigits(match[2]),
    year: ocrDigits(match[3]),
    counter: match[4],
    step: match[5] ? `${match[5].toUpperCase()}${ocrDigits(match[6]).padStart(2, '0')}` : '',
  } : null;
  const page = BULLETIN_PAGE_RE.exec(head);
  const first = !blank && !/\bPAGE\b/i.test(head) && !(page && Number(page[1]) > 1);
  return { reading, first };
}

/**
 * The value most readings agree on, character by character: each place takes
 * the character more than half the readings give it, and a place where no
 * character has that many leaves the whole unread. One reading is taken as
 * it is; two that differ anywhere are no answer.
 * @param {Array<string>} readings All of the same length.
 * @returns {?string}
 */
export function majorityReading(readings) {
  if (!readings.length) return null;
  const { length } = readings[0];
  if (readings.some((value) => value.length !== length)) return null;
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const counts = new Map();
    for (const value of readings) counts.set(value[i], (counts.get(value[i]) ?? 0) + 1);
    const [char, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (count * 2 <= readings.length) return null;
    out += char;
  }
  return out;
}

/**
 * An arrêté's number out of every page that prints it, as Sitadel writes it
 * (`dossierKey`), or null when the readings do not settle.
 *
 * STRICT, because a misread number is a decision put on someone else's
 * dossier: the commune must read as the city's own code (`059350`, at most one
 * character off — `659350`, `059356` — or one character too many), the year
 * no later than the bulletin's, and every other character agreed on by most
 * pages ({@link majorityReading}). Lille counted its dossiers `O` and four
 * digits until 2024 (`05935024O0246` in Sitadel) and on five digits since
 * 2025 (`0593502600024`), so the counter's first character is that letter or
 * a zero by the year, whatever the OCR made of it.
 *
 * @param {Array<object>} readings From {@link bulletinPageHead}.
 * @param {{insee: string, day: string}} context
 * @returns {?string} `PC 059350 26 00140`, `DP 059350 19 O0080 M01`.
 */
export function bulletinDossier(readings, { insee, day }) {
  const commune = `0${insee}`;
  const near = (value) => {
    if (value.length === 7) return value.includes(commune.slice(1));
    let off = 0;
    for (let i = 0; i < 6; i += 1) if (value[i] !== commune[i]) off += 1;
    return off <= 1;
  };
  const usable = readings.filter((reading) => reading && near(reading.commune) && /^\d{2}$/.test(reading.year));
  if (!usable.length) return null;
  const kind = majorityReading(usable.map((reading) => reading.kind.padEnd(2)));
  const year = majorityReading(usable.map((reading) => reading.year));
  // The step as a whole: `M01` on two pages and nothing on the third is `M01`.
  const steps = new Map();
  for (const reading of usable) steps.set(reading.step, (steps.get(reading.step) ?? 0) + 1);
  const [topStep, stepCount] = [...steps.entries()].sort((a, b) => b[1] - a[1])[0];
  const step = stepCount * 2 > usable.length ? topStep : null;
  if (!kind || !year || step === null || Number(year) > Number(String(day).slice(2, 4))) return null;
  const old = Number(year) <= 24;
  const counter = majorityReading(usable.map((reading) => {
    const digits = ocrDigits(reading.counter.slice(1));
    // The series letter or its zero, by the year: `O0080` for 2019, `00140` for 2026.
    const lead = /^[0OoQD]$/.test(reading.counter[0]) ? (old ? 'O' : '0') : ocrDigits(reading.counter[0]);
    return `${lead}${digits}`;
  }));
  if (!counter || !(old ? /^O\d{4}$/ : /^\d{5}$/).test(counter)) return null;
  return `${kind} ${commune} ${year} ${counter}${step ? ` ${step}` : ''}`;
}

/**
 * What an arrêté's first article decides, in the ladder's words — loosely,
 * as OCR spells it (`Atticle 1`, `I! n'est pas fait opposition`, `IF est
 * fait OPPOSITION`). Null when no article says.
 * @param {string} body The arrêté's pages, joined.
 * @returns {?string}
 */
export function bulletinVerdict(body) {
  // i18n-ignore-start — the arrêtés' own words, matched on; the verdicts in the ladder's words
  // At the start of a line, so that a recital's « article L. 632-2-1 » is
  // never taken for it.
  const start = /^\s*A[rRtT][tTfF]?[iI][cC][lLiI1tT][eE]\s*[1lI|!]\s*[-—–:]/m.exec(body);
  if (!start) return null;
  const rest = body.slice(start.index + start[0].length);
  const end = /^\s*A[rRtT][tTfF]?[iI][cC][lLiI1tT][eE]\s*2\b/m.exec(rest);
  const article = fold(rest.slice(0, end ? Math.min(end.index, 600) : 400));
  if (/RETIR/.test(article)) return 'Retrait';
  if (/PAS FAIT OPPOSITION/.test(article)) return 'Non-opposition';
  if (/FAIT OPPOSITION/.test(article)) return 'Opposition';
  if (/REFUS/.test(article)) return 'Refus';
  if (/TRANSFER/.test(article)) return 'Accord (transfert)';
  if (/PROROG/.test(article)) return 'Prorogation';
  if (/ACCORD/.test(article)) return 'Accord';
  // i18n-ignore-end
  return null;
}

/**
 * The day an arrêté was signed, from the date stamps of its signature block —
 * `Hôtel de Ville, le 2 9 SEP. 2026`, a stamp OCR reads with a space in the
 * day and a dot, a comma or nothing after the month — or from the typed `Lille,
 * le 27 mars 2026`. A day is taken only if it is at most 62 days before the
 * bulletin's and at most a week after it — the bulletin « du 28 septembre
 * 2026 » holds four arrêtés stamped as published on the 30th — the most
 * frequent wins, the latest of a tie, and a day only one line gives must be
 * the bulletin's own.
 * @param {string} body
 * @param {string} postedOn The bulletin's day.
 * @returns {?string}
 */
export function bulletinSignedOn(body, postedOn) {
  const counts = new Map();
  const year = Number(String(postedOn).slice(0, 4));
  // A stamp prints its month in capitals, so a line is searched as it is;
  // only what follows « Hôtel de Ville, le » or « Lille, le » is searched in
  // any case. The month a sentence spells in full (`en date du 27 avril 2026`)
  // is never a stamp.
  // i18n-ignore-next-line — the stamps' month abbreviations, matched on
  const pattern = /(?:^|[^\dA-Za-z])([0-3OD]\s?[\dOD]|\d)\s*(JANV?|F[EÉ]VR?|MARS|AVR|MAI|JUIN|JUIL|AO[UÛ]T?|SEPT?|OCT|NOV|D[EÉ]C)[A-ZÉÛ]*\s*[.,]?\s*(2\s?0\s?\d\s?\d)(?!\d)/g;
  for (const line of String(body ?? '').split('\n')) {
    // i18n-ignore-next-line — the signature's own words, matched on
    const signed = /\b(?:Ville|Lille)\s*,?\s*le\b(.*)$/i.exec(line)?.[1];
    const found = new Set();
    for (const [i, scope] of [line, signed?.toUpperCase()].entries()) {
      for (const match of String(scope ?? '').matchAll(pattern)) {
        // A stamp prints its day on two digits (`0 7 MAI 2026`): one is a
        // digit the OCR lost — `3 MARS` for `1 3 MARS` on seven of 13 March's
        // arrêtés. Only the typed signature writes `le 3 mars 2026`.
        const typed = i === 1 && !/^[A-ZÉÛ]{3}/.test(signed.substr(match.index + match[0].indexOf(match[2]), 3));
        if (!typed && match[1].replace(/\s/g, '').length < 2) continue;
        const day = calendarDay(match[3].replace(/\s/g, ''), frenchMonth(match[2]), ocrDigits(match[1].replace(/\s/g, '')));
        const at = day ? Number(day.slice(0, 4)) : 0;
        if (at !== year && at !== year - 1) continue;
        const lag = daysBetween(day, postedOn);
        if (lag >= -7 && lag <= 62) found.add(day);
      }
    }
    for (const day of found) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => (b[1] - a[1]) || b[0].localeCompare(a[0]));
  const [best, count] = ranked[0] ?? [];
  // One stamp read alone is taken only when it says the bulletin's own day:
  // OCR read the « 2 9 SEP » of DP 059350 26 01386 as « 23 SEP » (29
  // September 2026), and it was the arrêté's only legible stamp.
  return best && (count >= 2 || best === postedOn) ? best : null;
}

/** The bullet an OCR'd list item starts with: `e`, `e.`, `.`, `°`, `•`, `-`. */
const BULLET_RE = /^(?:[e°•·.*\-—–]\.?\s*_?\s+|[e°•·]\.?(?=[A-ZÉ]))/;

/** Where the place is, and what the commune it is in adds: Hellemmes and Lomme. */
const BULLETIN_LOCALITIES = Object.freeze([
  // i18n-ignore-start — the associated communes' names, matched on
  Object.freeze({ name: 'Hellemmes', postcode: '59260', re: /\bhellemmes\b/i }),
  Object.freeze({ name: 'Lomme', postcode: '59160', re: /\blomme\b/i }),
  Object.freeze({ name: 'Lille', postcode: null, re: /\blille\b/i }),
  // i18n-ignore-end
]);

/**
 * The site of an arrêté's first page: `Sur un terrain situé 138 avenue de
 * Dunkerque (Lille)`, `… au 47 boulevard Vauban`, `… : RUE DU GRAND BUT -
 * LOMME,`, a second line joined when it is short and no item of its own.
 * Never the applicant's address, which the sentence before gives.
 * @param {Array<string>} lines
 * @returns {?{address: string, locality: ?string, postcode: ?string}}
 */
export function bulletinSite(lines) {
  // i18n-ignore-start — the arrêtés' own words, matched on
  const at = lines.findIndex((line) => /terrain\s+situ[ée]/i.test(line));
  if (at < 0) return null;
  let value = lines[at].replace(/^.*?terrain\s+situ[ée]+e?\s*/i, '');
  const next = lines[at + 1];
  // The next item, its bullet read as anything (`Q Référence cadastrale`), is not the site's.
  if (next && next.length < 50 && !BULLET_RE.test(next)
    && !/^(?:\S{1,2}\s+)?(?:vu|consid|pour|destination|r[ée]f[ée]rences?|surface)\b/i.test(next)) {
    value = `${value} ${next}`;
  }
  value = value.replace(/^\s*(?:[:;]\s*)?(?:au\s+)?/i, '').replace(/\s*\S?\s*r[ée]f[ée]rences?\s+cadastrales?\b.*$/i, '');
  // i18n-ignore-end
  // The commune at the end only, after a dash or in brackets: a « rue de
  // Lomme » is a street, not a place in Lomme.
  const tail = /\s*(?:\(\s*([^)]+?)\s*\)|[-—–]+\s*([A-Za-zÀ-ÿ' ]+?))\s*[,.;]?\s*$/.exec(value);
  const locality = tail ? BULLETIN_LOCALITIES.find((place) => place.re.test(tail[1] ?? tail[2])) ?? null : null;
  if (locality) value = value.slice(0, tail.index);
  const address = text(value.replace(/[\s,;.]+$/, ''));
  if (!address || !/[A-Za-zÀ-ÿ]{3}/.test(address)) return null;
  return { address, locality: locality?.name ?? null, postcode: locality?.postcode ?? null };
}

/**
 * The works an arrêté's first page names: the items between « Vu l'objet de
 * la demande : » and the site, each cut of its bullet, the generic « Travaux
 * sur construction existante : » dropped. At most 160 characters.
 * @param {Array<string>} lines
 * @returns {?string}
 */
export function bulletinPurpose(lines) {
  // i18n-ignore-start — the arrêtés' own words, matched on
  const from = lines.findIndex((line) => /objet\s+(?:de\s+la\s+demande|des\s+modifications)/i.test(line));
  // Up to the site, or the next recital when the arrêté names no site.
  const to = lines.findIndex((line, i) => i > from && /terrain\s+situ|^vu\b|^consid[ée]rant\b/i.test(line));
  if (from < 0 || to < 0 || to - from > 12) return null;
  const items = [];
  const head = lines[from].replace(/^.*?objet\s+(?:de\s+la\s+demande|des\s+modifications)(?:\s+initiale)?\s*[:;]?\s*/i, '');
  for (const line of [head, ...lines.slice(from + 1, to)]) {
    if (!line) continue;
    const item = BULLET_RE.test(line);
    const value = line.replace(BULLET_RE, '').trim();
    if (item || !items.length) items.push(value);
    else items[items.length - 1] = `${items.at(-1)} ${value}`;
  }
  const out = text(items
    .map((item) => item.replace(/^travaux\s+sur\s+construction\s+existante?\s*[:;]?\s*/i, '').replace(/^modifications?\s*:\s*/i, ''))
    // What OCR leaves around an item: a stray quote, a closing comma.
    .map((item) => item.replace(/^[^\p{L}\d]+/u, '').replace(/[\s,;:‘’'"]+$/, ''))
    // The figures the page lists as items of their own are read apart.
    .filter((item) => item && !/^(?:pour\s+une\s+)?surface\b|^destination\b|^r[ée]f[ée]rences?\s+cadastrale/i.test(item))
    .join(' ; '));
  // A civility is a person's name to come: the works are not worth it.
  if (!out || /\b(?:monsieur|madame|mademoiselle|mme|mlle|mr|m\.)\s/i.test(out)) return null;
  // i18n-ignore-end
  return out.length > 160 ? `${out.slice(0, 159).replace(/\s+\S*$/, '')}…` : out;
}

/**
 * Whether a page is worth reading whole, from its top alone (`screen` of the
 * OCR runner): an urbanism decision's page prints its number there, and the
 * page of legal notices every decision ends with is not worth the time.
 * @param {string} band The top of the page, OCR'd.
 * @returns {boolean}
 */
export function bulletinPageWorthReading(band) {
  const head = bulletinPageHead(band);
  // i18n-ignore-next-line — the notices page's own title, matched on
  return Boolean(head) && !/INFORMATIONS\s*[-—–]?\s*[AÀ]\s+LIRE/i.test(band);
}

/**
 * One bulletin's urbanism decisions, out of its pages' OCR text (Trap 9).
 *
 * An arrêté is a run of pages: a first page with its number, then pages
 * that say `PAGE 2/3`; a page that prints no number ends it. Its number comes
 * from every page that prints it ({@link bulletinDossier}); the site, the
 * works, the floor area and the filing day from the first page; the verdict
 * from the first article; the signing day from the stamps. The applicant is
 * never read — the sentence that names them gives their own address too.
 *
 * @param {Array<?string>} pages Each page's text; null or a band for a page not read whole.
 * @param {{day: string, insee: string}} context The bulletin's day, the city's code.
 * @returns {{rows: Array<object>, acts: number, dropped: number}} `dropped`:
 *   arrêtés whose number did not settle, left out.
 */
export function readLilleBulletin(pages, { day, insee }) {
  const acts = [];
  let open = null;
  // A page whose year and counter differ from the arrêté's first reading in
  // more than two places is another arrêté's, whatever it says of its rank.
  const far = (a, b) => {
    const x = `${a.year}${a.counter}`;
    const y = `${b.year}${b.counter}`;
    let off = 0;
    for (let i = 0; i < Math.max(x.length, y.length); i += 1) if (x[i] !== y[i]) off += 1;
    return off > 2;
  };
  for (const page of pages ?? []) {
    const head = page ? bulletinPageHead(page) : null;
    if (!head) { open = null; continue; }
    // A notices page with no arrêté open is no arrêté.
    if (!head.first && !head.reading && !open) continue;
    if (head.first || !open || (head.reading && open.readings[0] && far(head.reading, open.readings[0]))) {
      open = { pages: [], readings: [], first: head.first ? page : null };
      acts.push(open);
    }
    open.pages.push(page);
    if (head.reading) open.readings.push(head.reading);
  }
  const rows = [];
  let dropped = 0;
  for (const act of acts) {
    const dossier = bulletinDossier(act.readings, { insee, day });
    if (!dossier) { dropped += 1; continue; }
    const body = act.pages.join('\n');
    const lines = act.first ? act.first.split('\n').map((line) => line.trim()).filter(Boolean) : [];
    const site = bulletinSite(lines);
    // i18n-ignore-start — the arrêtés' own words, matched on
    const filed = /pr[ée]sent[ée]e\s+le\s+(\d{1,2})(?:er)?\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/i.exec(act.first ?? '');
    const floor = /surface\s+de\s+plancher\s+cr[ée]{1,2}e\s*:?\s*([\d\s]+(?:[.,]\d+)?)\s*m/i.exec(act.first ?? '');
    // i18n-ignore-end
    const filedOn = filed ? calendarDay(filed[3], frenchMonth(filed[2]), filed[1]) : null;
    const floorArea = floor ? number(floor[1]) : null;
    const signedOn = bulletinSignedOn(body, day);
    const row = {
      board: PERMIT_LIST_BOARDS.decisions,
      dossier,
      label: null,
      purpose: bulletinPurpose(lines),
      applicant: null,
      address: site?.address ?? null,
      postcode: site?.postcode ?? null,
      locality: site?.locality ?? null,
      filedOn: filedOn && filedOn <= (signedOn && signedOn > day ? signedOn : day) ? filedOn : null,
      verdict: bulletinVerdict(body) ?? LIMOGES_VERDICT,
      decidedOn: signedOn,
      // Posted no sooner than it was signed: a bulletin may hold acts stamped
      // days after the day it is named for.
      postedOn: signedOn && signedOn > day ? signedOn : day,
      landArea: null,
      housing: null,
      lots: null,
      floorArea: floorArea !== null ? String(floorArea) : null,
      parcels: null,
    };
    // The same number on the next pages again is the same decision — an
    // annex, the original arrêté a transfer reprints — one row, the verdict
    // on the ladder kept over « Décision signée ».
    const last = rows.at(-1);
    if (last?.dossier === row.dossier) {
      for (const [field, value] of Object.entries(row)) last[field] ??= value;
      if (!permitListVerdictState(last.verdict) && permitListVerdictState(row.verdict)) last.verdict = row.verdict;
      continue;
    }
    rows.push(row);
  }
  return { rows, acts: acts.length, dropped };
}

/** The readers of bulletins read by OCR, by the `layout` a city's list names. */
export const BULLETIN_READERS = Object.freeze({
  'lille-bulletin': Object.freeze({ read: readLilleBulletin, screen: bulletinPageWorthReading }),
});

/**
 * How a layout's files are turned into text, where it differs from the
 * default (`extractPdfText`'s options): Annecy's, printed from Firefox, draw
 * no space glyph between words, and so did Bizanos's acts on DematDOC (read
 * from e-permis instead). On the 129 other text acts of that platform
 * sampled on 2026-10-02 the option changed no row; it stays as a guard.
 */
export const PERMIT_LIST_TEXT = Object.freeze({
  'annecy-filings': Object.freeze({ wordGapEm: 0.15 }),
  'annecy-decisions': Object.freeze({ wordGapEm: 0.15 }),
  'dematdoc-notice': Object.freeze({ wordGapEm: 0.15 }),
});

/** The readers, by the `layout` a list names. */
export const PERMIT_LIST_READERS = Object.freeze({
  'extended-notice': readExtendedNotice,
  'dematdoc-notice': readDematdocNotice,
  'blois-filings': readBloisFilings,
  'municipal-notice': readMunicipalNotice,
  'balma-table': readBalmaTable,
  'wattrelos-table': readWattrelosTable,
  'saint-priest-table': (document, context) => readGridTable(document, saintPriestGridSpec(context)),
  register: readRegisterList,
  decisions: readDecisionTable,
  lyon: readLyonList,
  // A page says by its header which grid it is: Argenteuil posted two filing
  // sheets among its decisions in 2026, and its own title is what is right.
  grid: (document) => [...readGridTable(document, GRID_FILINGS), ...readGridTable(document, GRID_DECISIONS)],
  'annecy-filings': (document) => readBandTable(document, annecySpec(PERMIT_LIST_BOARDS.filings)),
  'annecy-decisions': (document) => readBandTable(document, annecySpec(PERMIT_LIST_BOARDS.decisions)),
  versailles: readVersaillesList,
  'larochelle-filings': readLaRochelleFilings,
  // One file per decision: the file's title, handed in, gives the number.
  'larochelle-decision': readLaRochelleDecision,
  limoges: readLimogesList,
  // The page's header says which of its two reports it is.
  clermont: (document) => [
    ...readBandTable(document, CLERMONT_DECISIONS),
    // A filing whose decision is listed beside it says so itself.
    ...readBandTable(document, CLERMONT_FILINGS),
  ],
});

// --- Keeping and normalising -----------------------------------------------

/**
 * The fields of a list row that are kept, in a fixed order — the archive's
 * `cells`. Both layouts are read into the same fields, each leaving blank what
 * it does not print.
 */
export const PERMIT_LIST_FIELDS = Object.freeze([
  'dossier', 'label', 'purpose', 'applicant', 'address', 'postcode', 'locality',
  'filedOn', 'verdict', 'decidedOn', 'postedOn', 'landArea', 'housing', 'lots', 'floorArea',
  'parcels',
]);

/** Where the applicant sits in the stored cells. */
const APPLICANT_CELL = PERMIT_LIST_FIELDS.indexOf('applicant');

/**
 * One list row as it may be stored, or null for a row that may not be.
 *
 * TRAP 4 before anything is written: the applicant filtered. A row whose
 * number is not a building authorisation's is not kept at all.
 *
 * @param {object|Array<?string>} input One row from a reader, or cells
 *   already kept — scrubbed again, so the archive's own test holds for both.
 * @returns {?Array<?string>}
 */
export function scrubPermitListRow(input) {
  const row = Array.isArray(input)
    ? Object.fromEntries(PERMIT_LIST_FIELDS.map((field, i) => [field, input[i] ?? null]))
    : input;
  if (!row || typeof row !== 'object') return null;
  if (!DOSSIER_RE.test(text(row.dossier) ?? '') || !cartdsKind(row.dossier)) return null;
  const cells = PERMIT_LIST_FIELDS.map((field) => {
    const value = row[field];
    return value === null || value === undefined ? null : String(value);
  });
  cells[APPLICANT_CELL] = organisationApplicant(cells[APPLICANT_CELL]);
  return cells;
}

/**
 * What a published verdict means, on the shared ladder.
 *
 * The words counted on 2026-10-01: Marseille's `Accord Tacite`, `Favorable
 * avec Reserves`, `Favorable`; Nîmes's same three and `Defavorable`, `Rejet
 * tacite`, `retiré`, `Dossier irrecevable`; Béziers's `Favorable avec
 * prescriptions`; Argenteuil's `Tacite` (four rows of 2026, a tacit grant)
 * and `Rapporté` (two, a decision taken back). Cart@DS's reader takes every
 * one but `retiré` and `Rapporté` — closed, like `Retrait` — `Tacite`, and
 * Lyon's `Délivré`, the word of the section a decision is listed under,
 * which lists grants — and `Octroi` and `Octroi tacite`, Mulhouse's and
 * Versailles's grants (482 rows of Versailles's 2026 lists). `Sursis à
 * statuer` is no decision on the merits, nor `Prorogation` a new one: both
 * keep their own words.
 *
 * @param {?string} verdict
 * @returns {?string} `accorde`, `refuse`, `annule`, or null.
 */
export function permitListVerdictState(verdict) {
  const state = cartdsVerdictState(verdict);
  if (state) return state;
  const value = String(verdict ?? '').trim();
  // i18n-ignore-start — the publishers' own verdicts, matched on
  if (/^retir[ée]|^rapport[ée]|^abrog/i.test(value)) return 'annule';
  if (/^d[ée]livr[ée]|^tacite$|^octroi\b/i.test(value)) return 'accorde';
  // i18n-ignore-end
  return null;
}

/**
 * What the archive needs to keep a city's lists: which lists a row may come
 * from, and how a row is scrubbed. Handed to `createCartdsArchiveStore`.
 */
export const PERMIT_LIST_ROWS = Object.freeze({
  board: (board) => Object.hasOwn(PERMIT_LIST_BOARDS, board),
  scrub: scrubPermitListRow,
});

/**
 * A printed number as the layer keys it, or null (Trap 5).
 *
 * The commune's code goes on six digits — Béziers's `34032` is Sitadel's
 * `034032`, as Tours's is (`localDossier` in `adsFeed.js`) — and Lyon's
 * split `069 387` is joined.
 *
 * @param {?string} raw `PC 013055 26 00230P0`, `PC 030189 06 P0166 M01`,
 *   `DP 069 387 25 00038 M02`, `DP 34032 26 T0848`.
 * @returns {?{kind: string, digits: string}} `digits` as Sitadel writes them,
 *   without the family: `0130552600230`, `03018906P0166M01`,
 *   `0693872500038M02`, `03403226T0848`.
 */
export function permitListDossier(raw) {
  const match = DOSSIER_RE.exec(text(raw) ?? '');
  if (!match) return null;
  const [, kind, commune, year, counter, , suffix] = match;
  const code = commune.replace(/\s/g, '').padStart(6, '0');
  return { kind: kind.toUpperCase(), digits: `${code}${year}${counter.toUpperCase()}${(suffix ?? '').toUpperCase()}` };
}

/**
 * What a register's label says beyond the family it repeats, or null.
 *
 * The label is the form the dossier was filed on and the step it is at:
 * `PERMIS DE CONSTRUIRE DE MAISON INDIVIDUELLE (Initial)`, `DÉCLARATION
 * PRÉALABLE AMÉNAGEMENT (Initiale)`, `PERMIS DE CONSTRUIRE (Modificatif)`. A
 * house, a division of land and a modification are worth a card's line; the
 * original filing is the default and says nothing. Nor does `CONSTRUCTION`,
 * the general form for works that need no permit — a façade, a window, a
 * fence — and printed as the nature it would read as a building that is not
 * there: 590 of Marseille's 1 874 dossiers under review carry it.
 *
 * @param {?string} label
 * @returns {?string}
 */
function registerPurpose(label) {
  const value = text(label);
  if (!value) return null;
  // i18n-ignore-start — the software's own form and step words, matched on
  const step = /\(\s*([^)]*?)\s*\)/.exec(value)?.[1] ?? '';
  const form = text(value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^(?:d[ée]claration pr[ée]alable|permis de (?:construire|d[ée]molir|am[ée]nager)|certificat d.urbanisme)\s*/i, '')
    .replace(/^de\s+/i, ''));
  const parts = [
    form && !/^construction$/i.test(form) ? form : null,
    step && !/^initiale?$/i.test(step) ? step : null,
  ].filter(Boolean);
  // i18n-ignore-end
  return parts.length ? parts.join(', ').toLowerCase() : null;
}

/**
 * One list row → the shape every source of the layer is normalised into.
 *
 * Takes the row as a reader gives it, or as the archive stores it (an array of
 * {@link PERMIT_LIST_FIELDS}); both go through {@link scrubPermitListRow}
 * first, so a person's name cannot get through either way.
 *
 * @param {object} city One of {@link PERMIT_LISTS}.
 * @param {string} board A key of {@link PERMIT_LIST_BOARDS}.
 * @param {object|Array<?string>} input
 * @param {{current?: boolean}} [options] `current`: the row is on the edition
 *   read last (Trap 3); it says « under review » only for a city whose list
 *   of filings is a list of dossiers under review (`underReview`).
 * @returns {?object} Null for a row that is not a building authorisation.
 */
export function normalisePermitListRow(city, board, input, { current = false } = {}) {
  const cells = Array.isArray(input) ? input : scrubPermitListRow(input);
  if (!cells) return null;
  const row = Object.fromEntries(PERMIT_LIST_FIELDS.map((field, i) => [field, cells[i] ?? null]));
  const parsed = permitListDossier(row.dossier);
  if (!parsed) return null;
  const { kind, digits } = parsed;
  const series = seriesOfKind(kind);
  const kindLabel = ADS_KINDS[kind] ?? kind;
  const decided = board === PERMIT_LIST_BOARDS.decisions;
  const verdict = text(row.verdict);
  const verdictState = decided ? permitListVerdictState(verdict) : null;
  let state = 'depose';
  let stateLabel = stateFrench('depose');
  if (decided) {
    state = verdictState ?? 'depose';
    // A verdict off the ladder keeps its own words, as on a posted board.
    stateLabel = verdictState ? stateFrench(verdictState) : (verdict ?? stateLabel);
  } else if (current && city.underReview) {
    state = 'instruction';
    stateLabel = stateFrench('instruction');
  }
  const housing = number(row.housing);
  const parcels = listParcels(row.parcels);
  return {
    id: `permit-list:${city.key}:${kind}${digits}`,
    dossier: formatDossier(kind, digits),
    series,
    key: `${series}|${dossierKey(digits)}`,
    kind,
    kindLabel,
    state,
    stateLabel,
    depositedOn: text(row.filedOn),
    decidedOn: decided ? text(row.decidedOn) : null,
    postedOn: decided ? text(row.postedOn) : null,
    startedOn: null,
    completedOn: null,
    depositYear: null,
    applicant: organisationApplicant(row.applicant),
    purpose: text(row.purpose) ?? registerPurpose(row.label) ?? kindLabel,
    address: text(row.address),
    postcode: text(row.postcode),
    commune: null,
    communeCode: city.insee,
    cadastreCommune: city.insee,
    parcels: parcels.map((parcel) => parcel.label),
    parcelIdus: cartdsParcelIdus(parcels, city.insee),
    landAreaM2: number(row.landArea),
    housing: housing && housing > 0 ? housing : null,
    // `Surface plancher créée : 0 m²` says no floor area is created.
    surfaceCreatedM2: number(row.floorArea) || null,
    lots: number(row.lots),
    lon: null,
    lat: null,
    precision: null,
    geocodeScore: null,
    parts: null,
    source: 'permit-list',
    sourceLabel: city.label,
  };
}
