/**
 * @module data/adsFeed
 *
 * *Autorisations du droit des sols* — who has permission to build on this
 * block, and how far along they are.
 *
 * Two registers answer that question in France and they do not answer the same
 * half of it, so this module reads BOTH and merges them on the dossier number.
 *
 * ── Register 1: Sitadel, national, decided only ─────────────────────────────
 * The SDES publishes four files on its DiDo catalogue, one per authorisation
 * family, covering the whole country since 2013 under **Licence Ouverte**.
 * Measured 2026-09-02, from each datafile's own metadata:
 *
 *   logements                    1 917 260 rows   2013-01-01 → 2026-07-31
 *   locaux non résidentiels        792 588 rows   2013-01-01 → 2026-07-31
 *   permis de démolir              202 895 rows   1996-01-01 → 2026-07-31
 *   permis d'aménager              108 006 rows   1996-01-01 → 2026-07-31
 *
 * The publication read on that date was stamped 2026-08-28 and carried
 * authorisations through **July 2026** — so the national register runs about
 * six weeks behind the counter it is filed at.
 *
 * **It contains only permits that were GRANTED.** The dictionary says so in as
 * many words: *"Toutes les DAU du fichier ont été autorisées ; les modalités 4
 * à 6 concernent des DAU pour lesquelles est connu l'état postérieur
 * d'avancement du projet."* There is no national open feed of applications
 * under instruction — Plat'AU, where every dematerialised file transits, is
 * closed to accredited actors. That absence is the whole reason register 2
 * exists here.
 *
 * ── Register 2: three métropoles, live, instruction included ────────────────
 * Paris, Bordeaux Métropole and Nantes Métropole publish their own ADS files
 * on Opendatasoft portals, refreshed daily, and each carries what Sitadel
 * structurally cannot: **dossiers still being instructed**. Measured
 * 2026-09-02 — Paris 8 088 dossiers over a rolling six months, of which 2 296
 * `En cours d'instruction`, deposits as recent as 2026-08-31; Bordeaux 309 094
 * dossiers with real parcel POLYGONS, deposits to 2026-08-31; Nantes 3 960
 * dossiers, in-instruction plus three months of decisions.
 *
 * ── Register 3: the communes' own boards, fresh, every family ───────────────
 * 194 communes post their filing notices and decisions on a Cart@DS
 * « affichage réglementaire » board, days after the fact and including the
 * déclarations préalables Sitadel never holds. `cartdsFeed.js` reads them and
 * normalises them into the shape below, so they merge with Sitadel exactly as
 * the métropole portals do.
 *
 * ── Register 4: the acts a commune publishes ────────────────────────────────
 * Ustaritz, Ciboure and Monts publish their permit decisions as acts on
 * publication-actes.fr, and Ustaritz a fortnightly list of filed dossiers
 * with their parcels. `publicationActesFeed.js` reads both into the same
 * shape.
 *
 * ── Trap 1: Sitadel keys Paris, Lyon and Marseille at COMMUNE level ─────────
 * `COMM=eq:75113` answers *"Le fichier est vide"*; `75056` answers the whole
 * of Paris. So does `13055` against `13201`. This is the exact INVERSE of DVF
 * next door, whose files are published per arrondissement and whose module
 * docstring explains why it must use the BAN's `citycode`. Both layers resolve
 * a point through the same BAN reverse call and then bend the answer in
 * opposite directions — {@link foldToSitadelCommune} is this one's bend, and
 * it exists because getting it wrong yields an empty layer, not an error.
 *
 * ── Trap 2: the four files do not share their key column names ──────────────
 * The two permis-de-construire files carry `TYPE_DAU` / `NUM_DAU` / `ETAT_DAU`.
 * The permis d'aménager file carries `NUM_PA` / `ETAT_PA` and NO type column;
 * the permis de démolir file carries `NUM_PD` / `ETAT_PD`, and also has no
 * `DATE_REELLE_DOC` or `DATE_REELLE_DAACT` at all — a demolition's site
 * progress is simply not tracked. Reading all four through one column list
 * returns HTTP 400 from DiDo, per file, silently dropping two of the four
 * families. {@link SITADEL_FILES} therefore names its columns per file.
 *
 * ── Trap 3: `ETAT` is a chantier ladder, not a decision ─────────────────────
 * Its four values are documented in the SDES dictionary as `2 = Autorisé`,
 * `4 = Annulé`, `5 = Commencé`, `6 = Terminé`, and the file cross-tabulates
 * exactly that way. Measured over the 2 049 housing authorisations of Nantes
 * (44109): every `6` carries a completion date, every `5` an opening date and
 * no completion, every `2` neither. So a Sitadel row does not say "granted" —
 * it says how far the crane got. That is worth MORE than a decision flag, and
 * it is the one thing the métropole feeds do not publish.
 *
 * ── Trap 4: no coordinate anywhere in Sitadel ───────────────────────────────
 * Not one of the four files carries a latitude. Each row carries a postal
 * address and up to three cadastral parcel references, and geolocating it is
 * the reader's problem. This module hands the addresses to the BAN in one bulk
 * CSV call per commune. Measured on the 211 Nantes authorisations since
 * 2024-01-01: **167 resolve to a house number, 33 only to a street, 11 not at
 * all** (median score 0.856). Those three outcomes are three different claims
 * about where a building site is, so the precision travels to the card instead
 * of being flattened into a dot that looks equally sure of itself. The 11 are
 * dropped, not placed at the commune centroid — see {@link applyGeocoding}.
 *
 * ── Trap 5: Paris spells "no coordinate" as Lambert-93 (0, 0) ──────────────
 * Measured 2026-09-02: `where=x=0 or y=0` returns **19 rows**, and
 * `geo_point_2d is null` returns NONE. Worse than a null: Opendatasoft
 * reprojects those zeros faithfully, so `geo_point_2d` comes back as
 * `{lon: -1.3630812, lat: -5.9838563}` — a perfectly well-formed coordinate
 * in the Gulf of Guinea, off São Tomé. Nothing about the WGS84 pair says it is
 * a null; only the published `x`/`y` do. So the guard reads the PROJECTED
 * columns a portal declares in `projectedColumns`, not the reprojected ones, and a
 * layer that checked `lon !== 0` would have drawn nineteen Paris permits in
 * the Atlantic and looked entirely sane doing it.
 *
 * ── Trap 6: the number series are PER FAMILY, and two of the files share one ─
 * The four files are four FILES, not four disjoint sets of dossiers — but they
 * do not all number from the same series either, and both halves of that
 * matter.
 *
 * The two permis-de-construire files share the `NUM_DAU` series, so a mixed
 * operation that builds flats over a shop is filed ONCE and listed in both.
 * Measured over Paris (75056) since 2023-09-01: **151 dossiers appear in both
 * the housing and the non-residential file**, and a further 12 appear twice
 * inside the non-residential file alone — one row per destination. 146 of
 * those 163 carry the same address or the same parcel in every copy, which is
 * what a single operation looks like.
 *
 * `NUM_PA` and `NUM_PD` are their OWN series. Over the same commune and
 * window, **271 numbers collide across series while sitting at completely
 * different addresses** — a permis d'aménager numbered `07511324V0005` has
 * nothing to do with the permis de construire that happens to share its
 * digits. Folding on the bare number would silently glue 271 unrelated Paris
 * dossiers together, each inheriting the other's address, dwellings and dates.
 *
 * So identity here is SERIES + NUMBER, never the number alone — see
 * {@link seriesOfKind} and {@link foldSitadelFamilies}. And the fold has to
 * happen at all, because three rows claiming one entity id is a render Cesium
 * abandons half-finished: measured in the browser, twelve markers drawn and
 * the layer then frozen with no payload, no scan centre and no clickable
 * cards — a failure that looks like anything except a data shape.
 *
 * ── Why the two registers can be merged at all ──────────────────────────────
 * Both number a dossier the same way underneath: département, commune,
 * two-digit year, sequence. Sitadel writes it closed up (`07510826V0143`), the
 * portals write it spaced and prefixed (`DP 075 108 26 V0143`). Stripping the
 * separators and the type prefix makes them equal, which is what
 * {@link dossierKey} does — so one card can say *"déposé le 6 mars, en cours
 * d'instruction"* from the métropole and *"12 logements, 940 m²"* from the
 * State, rather than drawing the same permit twice.
 *
 * Dependency-free and side-effect-free (no Cesium, no DOM, no fetch): URL
 * construction, parsing and projection only. The `/api/ads-fr` proxy imports
 * it; nothing in the browser bundle does.
 */

import { foldToCommune } from './communeCode.js';
import { ringAreaM2, ringLabelAnchor, sanitisePolygonParts } from './ringGeometry.js';
import { ARRONDISSEMENT_COMMUNES, parcelParts, sitadelJoinCommune } from './sitadelFeed.js';
import { ADS_LINEAGE_BASIS, insidePoint, sitadelParcelRefs } from './cadastreLineage.js';
import { organisationApplicant } from './permitApplicant.js';
import { labelFor } from '../i18n/messages.js';
import {
  ADS_KIND_WORDS, ADS_PRECISION_WORDS, ADS_PURPOSE_WORDS, ADS_STATE_WORDS,
} from './adsFeed.i18n.js';

/** A catalog's French side, flat, keyed by the value that rides the payload. */
function frenchTable(catalog) {
  return Object.freeze(Object.fromEntries(
    Object.entries(catalog.definition).map(([key, leaf]) => [key, leaf.fr]),
  ));
}

/** Attribution carried on every payload (see DATA_SOURCES.md). */
// i18n-ignore-next-line — the registry owns a layer's source line (layerTaxonomy.i18n.js)
export const ADS_SOURCE = 'Sitadel — SDES, + portails ADS métropolitains, + affichage réglementaire communal (Cart@DS, Sirap), + listes publiées par les villes';

/** DiDo's per-datafile JSON endpoint. Keyless, `access-control-allow-origin: *`. */
export const SITADEL_JSON_BASE =
  'https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1/datafiles';

/**
 * Columns every one of the four files agrees on.
 *
 * Deliberately narrow. The housing file alone is 92 columns wide and a commune
 * query returns every one of them; asking for the fifteen that reach a card
 * turns a Paris answer from megabytes into tens of kilobytes, over a free
 * public service, on a route that is hit once per commune per scan.
 */
const SITADEL_COMMON_COLUMNS = Object.freeze([
  'COMM',
  'DATE_REELLE_AUTORISATION',
  'AN_DEPOT',
  'DENOM_DEM',
  'ADR_NUM_TER',
  'ADR_LIBVOIE_TER',
  'ADR_LIEUDIT_TER',
  'ADR_LOCALITE_TER',
  'ADR_CODPOST_TER',
  'SEC_CADASTRE1',
  'NUM_CADASTRE1',
  'SEC_CADASTRE2',
  'NUM_CADASTRE2',
  'SEC_CADASTRE3',
  'NUM_CADASTRE3',
  'SUPERFICIE_TERRAIN',
]);

/**
 * The four Sitadel datafiles, each with the column names it actually uses.
 *
 * `rid`s are DiDo resource ids and are stable across monthly republications —
 * the same four were served by the 2026-08-28 edition as by the ones before
 * it. If one ever moves, `/api/ads-fr/status` reports the failure per file
 * rather than blanking the layer: three families out of four is a degraded
 * answer, and a degraded answer that says so beats no answer.
 */
export const SITADEL_FILES = Object.freeze([
  Object.freeze({
    key: 'logements',
    rid: '8b35affb-55fc-4c1f-915b-7750f974446a',
    label: 'autorisations créant des logements', // i18n-ignore-line — DiDo's own datafile title
    // Shared with the non-residential file: one mixed operation, two rows.
    series: 'DAU',
    numberColumn: 'NUM_DAU',
    stateColumn: 'ETAT_DAU',
    typeColumn: 'TYPE_DAU',
    defaultKind: 'PC',
    columns: Object.freeze([
      ...SITADEL_COMMON_COLUMNS,
      'TYPE_DAU', 'NUM_DAU', 'ETAT_DAU',
      'DATE_REELLE_DOC', 'DATE_REELLE_DAACT',
      'NATURE_PROJET_DECLAREE', 'NB_LGT_TOT_CREES', 'SURF_HAB_CREEE',
    ]),
  }),
  Object.freeze({
    key: 'locaux',
    rid: 'f8f0700f-806c-40a7-83b1-f21cf507e7c4',
    label: 'autorisations créant des locaux non résidentiels', // i18n-ignore-line — DiDo's own datafile title
    series: 'DAU',
    numberColumn: 'NUM_DAU',
    stateColumn: 'ETAT_DAU',
    typeColumn: 'TYPE_DAU',
    defaultKind: 'PC',
    columns: Object.freeze([
      ...SITADEL_COMMON_COLUMNS,
      'TYPE_DAU', 'NUM_DAU', 'ETAT_DAU',
      'DATE_REELLE_DOC', 'DATE_REELLE_DAACT',
      'NATURE_PROJET_DECLAREE', 'DESTINATION_PRINCIPALE', 'SURF_LOC_CREEE',
    ]),
  }),
  Object.freeze({
    key: 'amenager',
    rid: '96883f50-538b-41f9-a059-c6eb97e6a23a',
    label: 'permis d’aménager', // i18n-ignore-line — DiDo's own datafile title
    // Its OWN series, which collides with `NUM_DAU` on unrelated dossiers.
    series: 'PA',
    // No TYPE column at all: the file IS the type.
    numberColumn: 'NUM_PA',
    stateColumn: 'ETAT_PA',
    typeColumn: null,
    defaultKind: 'PA',
    columns: Object.freeze([
      ...SITADEL_COMMON_COLUMNS,
      'NUM_PA', 'ETAT_PA', 'DATE_REELLE_DOC', 'DATE_REELLE_DAACT', 'ZONE_OP',
    ]),
  }),
  Object.freeze({
    key: 'demolir',
    rid: '1a9a2f0c-56fe-4e69-84a7-fbbda2121f02',
    label: 'permis de démolir', // i18n-ignore-line — DiDo's own datafile title
    series: 'PD',
    numberColumn: 'NUM_PD',
    stateColumn: 'ETAT_PD',
    typeColumn: null,
    defaultKind: 'PD',
    // No DATE_REELLE_DOC / DATE_REELLE_DAACT in this file — a demolition's
    // site progress is not tracked. Asking for them is an HTTP 400.
    columns: Object.freeze([...SITADEL_COMMON_COLUMNS, 'NUM_PD', 'ETAT_PD']),
  }),
]);

/**
 * `ETAT` → what the site is actually doing, from the SDES variable dictionary.
 *
 * There is no `1` and no `3` in the open files: `availableValues` on the
 * housing datafile lists exactly `[2, 4, 5, 6]`.
 */
export const SITADEL_STATES = Object.freeze({
  2: Object.freeze({ state: 'autorise', label: adsStateFrench('autorise') }),
  4: Object.freeze({ state: 'annule', label: adsStateFrench('annule') }),
  5: Object.freeze({ state: 'commence', label: adsStateFrench('commence') }),
  6: Object.freeze({ state: 'termine', label: adsStateFrench('termine') }),
});

/** One state's FRENCH, which is what the payload carries whatever the reader. */
function adsStateFrench(state) {
  return ADS_STATE_WORDS.definition[state].fr;
}

/**
 * One state in the page's language, for a card being drawn.
 *
 * Read off `permit.state` and not off `permit.stateLabel`: the server composed
 * that label and it is French. A portal whose own wording this ladder did not
 * recognise keeps its words — `localState()` returns them verbatim under
 * `depose` — so the payload's label wins whenever it is NOT this table's own.
 *
 * @param {?object} permit A normalised permit.
 * @returns {?string}
 */
export function adsStateLabel(permit) {
  const state = String(permit?.state ?? '');
  const published = permit?.stateLabel ?? null;
  if (!Object.hasOwn(ADS_STATE_WORDS.definition, state)) return published;
  return published === null || published === adsStateFrench(state)
    ? labelFor(ADS_STATE_WORDS, state)
    : published;
}

/**
 * `NATURE_PROJET_DECLAREE`, per the dictionary. Two values, both worth saying.
 *
 * The arguments below are CATALOG KEYS, not prose: `purpose` is composed in
 * French on the server and `adsPermitTarget()` matches on those exact words.
 */
// i18n-ignore-start — catalog keys, which are the payload's own data values
const SITADEL_NATURES = Object.freeze({
  1: purposeFrench('nouvelle construction'),
  2: purposeFrench('travaux sur construction existante'),
});

/** `DESTINATION_PRINCIPALE` of a non-residential authorisation. */
const SITADEL_DESTINATIONS = Object.freeze({
  1: purposeFrench('logements'),
  3: purposeFrench('bureaux'),
  4: purposeFrench('commerce'),
  6: purposeFrench('industrie'),
  7: purposeFrench('agriculture'),
  8: purposeFrench('entrepôt'),
  9: purposeFrench('service public'),
});

/** `ZONE_OP` of a permis d'aménager. */
const SITADEL_ZONES = Object.freeze({
  1: purposeFrench('lotissement'),
  2: purposeFrench('ZAC'),
  3: purposeFrench('AFU'),
});
// i18n-ignore-end

/** One purpose word's FRENCH — the value the payload carries. */
function purposeFrench(word) {
  return ADS_PURPOSE_WORDS.definition[word].fr;
}

/**
 * One composed `purpose` in the page's language.
 *
 * The sentence arrives ` · `-joined and each part is looked up by its own
 * French, which is what the payload carries. A part the table does not know is
 * a portal's free-text `objet` and is shown exactly as published.
 *
 * @param {?string} purpose
 * @returns {?string}
 */
export function adsPurposeLabel(purpose) {
  const text = String(purpose ?? '').trim();
  if (!text) return null;
  return text.split(' · ')
    .map((part) => {
      if (Object.hasOwn(ADS_PURPOSE_WORDS.definition, part)) {
        return labelFor(ADS_PURPOSE_WORDS, part);
      }
      return Object.hasOwn(ADS_KINDS_BY_LABEL, part)
        ? labelFor(ADS_KIND_WORDS, ADS_KINDS_BY_LABEL[part])
        : part;
    })
    .join(' · ');
}

/** Human label per authorisation family, for cards and the legend. */
export const ADS_KINDS = frenchTable(ADS_KIND_WORDS);

/** The reverse of {@link ADS_KINDS}: a French family name back to its letter. */
const ADS_KINDS_BY_LABEL = Object.freeze(Object.fromEntries(
  Object.entries(ADS_KINDS).map(([kind, label]) => [label, kind]),
));

/**
 * One authorisation family in the page's language.
 * @param {?string} kind `PC`, `DP`, `PA`, `PD`, `CU`.
 * @returns {?string} The family, or the letter itself for one off the list.
 */
export function adsKindLabel(kind) {
  const key = String(kind ?? '').trim();
  return key ? labelFor(ADS_KIND_WORDS, key) : null;
}

/**
 * The métropole and city portals, and what each one's columns are called.
 *
 * Gated by INSEE code rather than by a bounding box: the codes are published
 * by the datasets themselves (`group_by` on the commune column, measured
 * 2026-09-02) and a code test cannot half-cover a commune the way a rectangle
 * drawn around a métropole can.
 *
 * Paris, Bordeaux and Nantes came first, and `normaliseLocalRow` reads their
 * column names directly. Tours and Brest, added on 2026-10-01, name theirs
 * differently and say so in `columns`: the normaliser's own name on the left,
 * the portal's on the right, the first non-blank of a list winning. Brest is
 * not an Opendatasoft portal at all but an ArcGIS map service (`api:
 * 'arcgis'`), asked by radius like Paris and answering GeoJSON.
 */
export const LOCAL_ADS_PORTALS = Object.freeze([
  Object.freeze({
    key: 'paris',
    // The Opendatasoft host, as for Nantes: the city's `opendata.paris.fr`
    // alias stopped resolving on 2026-09-23 (see `FRAICHEUR_PORTAL`).
    portal: 'parisdata.opendatasoft.com',
    dataset: 'dossiers-recents-durbanisme',
    label: 'Ville de Paris — Autorisations d’urbanisme (6 derniers mois)', // i18n-ignore-line — the portal's own dataset title
    licence: 'ODbL 1.0',
    // Paris publishes at commune level (75056) and at arrondissement level
    // (75101–75120) depending on which referential a caller came through; both
    // are accepted so the gate never depends on which one the BAN answered.
    communes: Object.freeze(['75056',
      ...Array.from({ length: 20 }, (_, i) => `751${String(i + 1).padStart(2, '0')}`)]),
    geoColumn: 'geo_point_2d',
    // TRAP 5: the only columns that can tell a real position from a null here.
    projectedColumns: Object.freeze(['x', 'y']),
    select: Object.freeze([
      'nom_dossier', 'type_dossier', 'demandeur', 'adresse', 'objet',
      'date_depot', 'date_decision', 'etat', 'type_decision', 'x', 'y', 'geo_point_2d',
    ]),
    dateColumn: 'date_depot',
  }),
  Object.freeze({
    key: 'bordeaux',
    portal: 'opendata.bordeaux-metropole.fr',
    dataset: 'u_dosaos_s',
    label: 'Bordeaux Métropole — Dossiers d’autorisation d’occupation du sol', // i18n-ignore-line — the portal's own dataset title
    licence: 'Licence Ouverte',
    communes: Object.freeze([
      '33003', '33004', '33013', '33032', '33039', '33056', '33063', '33065',
      '33069', '33075', '33096', '33119', '33162', '33167', '33192', '33200',
      '33249', '33273', '33281', '33312', '33318', '33376', '33434', '33449',
      '33487', '33519', '33522', '33550',
    ]),
    geoColumn: 'geo_point_2d',
    // This file has NO decision column — not a nullable one, none at all. It
    // records that a dossier was filed and on what parcel, and stops there. So
    // a Bordeaux row is labelled for what it provably is, `déposé`, rather
    // than carrying a null that the card would silently drop and the legend
    // would paint as "state unknown". Where Sitadel has the same dossier, the
    // merge fills in what happened next.
    publishesDecision: false,
    // THE ONLY SOURCE HERE THAT PUBLISHES THE GROUND ITSELF. Every other
    // register in this layer answers with a coordinate at best; this one ships
    // the parcel outline the dossier was filed on, as a GeoJSON MultiPolygon.
    // 308 984 of its 309 094 rows carry one (measured 2026-09-02).
    shapeColumn: 'geo_shape',
    // Filtered UPSTREAM, not after the fact — see `buildLocalAdsUrl`. The
    // projection has always dropped certificats d'urbanisme; asking the portal
    // to leave them out is what pays for the geometry. `!=` and not an
    // allowlist of the four kept kinds: a category Bordeaux adds later should
    // arrive and be classified, even imperfectly, rather than vanish into a
    // list nobody remembers to extend.
    kindColumn: 'type',
    excludedKind: 'CU',
    select: Object.freeze([
      'ident', 'type_libelle', 'nom', 'insee', 'date_depot', 'refcad',
      'superficie', 'surf_creee', 'surf_demolie', 'geo_point_2d', 'geo_shape',
    ]),
    dateColumn: 'date_depot',
  }),
  Object.freeze({
    key: 'nantes',
    portal: 'nantesmetropole.outscale-euw2.opendatasoft.com',
    dataset: '244400404_demandes-autorisations-decisions-urbanisme-nantes-metropole',
    label: 'Nantes Métropole — Demandes et décisions d’urbanisme', // i18n-ignore-line — the portal's own dataset title
    licence: 'Licence Ouverte',
    communes: Object.freeze([
      '44009', '44018', '44020', '44024', '44026', '44035', '44047', '44074',
      '44094', '44101', '44109', '44114', '44120', '44143', '44150', '44162',
      '44166', '44171', '44172', '44190', '44194', '44198', '44204', '44215',
    ]),
    // NO geometry column of any kind: this portal publishes an address string
    // and nothing else. So it is queried BY COMMUNE rather than by distance —
    // a distance filter needs the coordinate this file does not have — and its
    // rows join the Sitadel rows in the same BAN batch, under the same
    // per-commune cache, instead of arriving pre-placed like the other two.
    geoColumn: null,
    // i18n-ignore-next-line — a column name in the portal's schema
    communeColumn: 'code_insee_commune',
    // …and that column is an INTEGER here, so the filter is written unquoted.
    communeIsNumeric: true,
    // i18n-ignore-start — column names in the portal's own schema
    select: Object.freeze([
      'numero_de_dossier', 'type_dossier', 'commune', 'code_insee_commune',
      'date_de_depot', 'date_decision', 'details_du_projet', 'surface_de_plancher',
      'demandeur', 'adresse_du_terrain', 'etat_dossier',
    ]),
    dateColumn: 'date_de_depot',
    // i18n-ignore-end
  }),
  Object.freeze({
    key: 'tours',
    portal: 'data.tours-metropole.fr',
    dataset: 'dossiers-deposes-urbanisme-tours',
    label: 'Ville de Tours — Dossiers d’autorisation du droit des sols', // i18n-ignore-line — the portal's own dataset title
    licence: 'Licence Ouverte 2.0',
    // The commune of Tours alone: the métropole's portal holds no file for
    // its 21 other communes (checked 2026-10-01).
    communes: Object.freeze(['37261']),
    // A `geo_point_2d` column exists and is EMPTY on 2 252 of the 3 198 rows
    // filed in the year to 2026-10-01, so a distance query would miss seven
    // dossiers in ten. Queried by commune instead, like Nantes, and placed on
    // the parcel every row names (`resolveParcels`), the geocoder after.
    geoColumn: null,
    communeColumn: 'code_insee',
    // i18n-ignore-start — column names in the portal's own schema
    select: Object.freeze([
      'numero_de_dossier', 'code_insee', 'type_de_demande_d_autorisation', 'recu_en_mairie',
      'adresse_des_travaux', 'cp_des_travaux', 'objet_des_travaux', 'surface_de_plancher_creee',
      'nature_de_la_decision', 'date_de_la_decision', 'ref_cadastre',
    ]),
    dateColumn: 'recu_en_mairie',
    columns: Object.freeze({
      nom_dossier: 'numero_de_dossier',
      type_dossier: 'type_de_demande_d_autorisation',
      date_depot: 'recu_en_mairie',
      date_decision: 'date_de_la_decision',
      etat: 'nature_de_la_decision',
      adresse: 'adresse_des_travaux',
      code_postal: 'cp_des_travaux',
      objet: 'objet_des_travaux',
      surf_creee: 'surface_de_plancher_creee',
      insee: 'code_insee',
      refcad: 'ref_cadastre',
    }),
    // i18n-ignore-end
    // `DP 37261 26 T1181`: the commune's five-digit code where Sitadel and
    // every other register write six (`037261…`). See `localDossier`.
    fiveDigitDossier: true,
    // ONE ROW PER PARCEL AND PER STEP. A dossier is listed once when filed
    // and again when decided, and once per parcel each time: 3 198 rows for
    // 1 887 dossiers that year. `foldLocalRows` makes them one.
    rowPerParcel: true,
    // A row with no decision is the filing's, so it says FILED.
    blankIsFiled: true,
    resolveParcels: true,
  }),
  Object.freeze({
    key: 'brest',
    api: 'arcgis',
    service: 'https://geo.brest-metropole.fr/arcgis/rest/services/public/GPB_URB/MapServer/2811003',
    label: 'Brest métropole — Dossiers d’urbanisme accordés', // i18n-ignore-line — the portal's own dataset title
    licence: 'Licence Ouverte 2.0',
    communes: Object.freeze([
      '29011', '29019', '29061', '29069', '29075', '29189', '29212', '29235',
    ]),
    // A point on every row (580 of 580 decided in the year to 2026-10-01),
    // asked for in WGS 84 (`outSR=4326`) and answered as GeoJSON.
    geoColumn: 'geometry',
    // i18n-ignore-start — column names in the service's own schema
    select: Object.freeze([
      'NOM_DOSSIER', 'TYPE_DOSSIER', 'ADRESSE', 'PARCELLE', 'OBJET_DEMANDE', 'PRECISION_TRAVAUX',
      'SF_CREEE', 'NB_LOGEMENTS', 'DATE_DEPOT', 'DECISION_ARRETE', 'DATE_ARRETE',
    ]),
    dateColumn: 'DATE_DEPOT',
    columns: Object.freeze({
      nom_dossier: 'NOM_DOSSIER',
      type_dossier: 'TYPE_DOSSIER',
      date_depot: 'DATE_DEPOT',
      date_decision: 'DATE_ARRETE',
      etat: 'DECISION_ARRETE',
      adresse: 'ADRESSE',
      objet: Object.freeze(['PRECISION_TRAVAUX', 'OBJET_DEMANDE']),
      surf_creee: 'SF_CREEE',
      nb_logements: 'NB_LOGEMENTS',
      refcad: 'PARCELLE',
    }),
    // i18n-ignore-end
    // GRANTED PERMITS ONLY: the service publishes the permis de construire and
    // certificats it has granted, and no déclaration préalable, no refusal and
    // nothing still under review. What it adds is the date: decisions three
    // days old on 2026-10-01, where Sitadel is weeks behind.
  }),
]);

/** Default scan radius, in metres. A block, not a district. */
export const ADS_DEFAULT_RADIUS_M = 400;
/** Ceiling on the radius. Past this a dense arrondissement is unreadable. */
export const ADS_MAX_RADIUS_M = 1200;
/** How far back a scan looks, in months. Three years of building work. */
export const ADS_DEFAULT_MONTHS = 36;
/** Ceiling on the window. Sitadel starts in 2013; this keeps a query bounded. */
export const ADS_MAX_MONTHS = 156;
/** Ceiling on permits served in one answer, nearest first. */
export const ADS_MAX_PERMITS = 400;
/**
 * BAN's bulk geocoder. The Géoplateforme mirror at
 * `data.geopf.fr/geocodage/search/csv/` answers HTTP 500 to the same multipart
 * body (measured 2026-09-02), so this is the one host used.
 */
export const BAN_CSV_URL = 'https://api-adresse.data.gouv.fr/search/csv/';

/**
 * Placement outcomes, worst to best, with what each one licenses a reader to
 * believe. `published` is for the two portals that ship their own coordinate:
 * it did not come from an address at all.
 *
 * THE TOP TWO ARE POLYGONS AND THAT IS WHY THEY OUTRANK A PUBLISHED POINT. A
 * portal's `geo_point_2d` is somebody's chosen point on a plot; the parcel the
 * dossier NAMES is the plot. `cadastreLineage.js` resolves both from the open
 * cadastre, so 58.1% of Sitadel rows — measured over Ustaritz — can be drawn
 * as ground rather than geocoded as an address, everywhere in France and not
 * only in the one métropole that publishes shapes.
 *
 * `mere` sits between a house number and a street on purpose. It is a plot
 * that CERTAINLY contains the site, which street level never is, and it is not
 * the lot, which a house number claims to be. A permit filed on a parcel that
 * has since been divided is a real, common thing — 37.3% of the same rows —
 * and the honest drawing of it is the parent, labelled as divided.
 */
export const ADS_PRECISION = Object.freeze(Object.fromEntries(
  ['municipality', 'locality', 'street', 'mere', 'housenumber', 'published', 'enfant', 'parcelle']
    .map((key, rank) => [
      key,
      Object.freeze({ rank, label: ADS_PRECISION_WORDS.definition[key].fr }),
    ]),
));

/**
 * One placement outcome in the page's language.
 * @param {?string} precision A key of {@link ADS_PRECISION}.
 * @returns {string} The words, or the key itself when it is a new one.
 */
export function adsPrecisionLabel(precision) {
  return labelFor(ADS_PRECISION_WORDS, precision);
}

/**
 * Fold an arrondissement code onto the commune Sitadel actually keys.
 *
 * Paris, Lyon and Marseille only. Every other code passes through unchanged,
 * including the Corsican `2A`/`2B` forms and the five-digit overseas ones.
 *
 * @param {?string} code INSEE code, at any level.
 * @returns {?string} The code Sitadel's `COMM` column uses, or null.
 */
export function foldToSitadelCommune(code) {
  // The fold itself lives in `communeCode.js`: four other registers now need
  // the same three ranges — Ma connexion internet and Atmo France key on the
  // parent commune, the carte des loyers on the arrondissement, Melodi on both
  // under two level names — and three cities written out four times is three
  // chances to write one of them down wrong.
  return foldToCommune(code);
}

/**
 * The date floor of a scan, as the `YYYY-MM-DD` DiDo compares against.
 *
 * SNAPPED TO THE FIRST OF THE MONTH, and that is a caching decision rather
 * than an editorial one. The commune editions this floor keys are held on disk
 * for a week; a floor computed to the day would mint a new key every midnight
 * and re-download four national files plus a BAN batch for a commune already
 * on disk. The window is a rough "three years back" either way, and Sitadel
 * republishes monthly, so the day inside the month buys nothing.
 *
 * @param {number} months How far back to look.
 * @param {Date|number} [now] Injected in tests; defaults to the wall clock.
 * @returns {string}
 */
export function adsSince(months, now = Date.now()) {
  const span = Number.isFinite(months) ? Math.max(1, Math.min(ADS_MAX_MONTHS, months)) : ADS_DEFAULT_MONTHS;
  const date = new Date(now);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - span);
  return date.toISOString().slice(0, 10);
}

/**
 * Build one DiDo query: a commune, a date floor, and only the columns a card
 * reads.
 *
 * DiDo's filter grammar is `field=<op>:<value>` — a bare `COMM=75056` is
 * rejected as *"La chaîne 75056 dans l'url n'est pas valide"*, and the
 * operators it accepts differ by column type (a text column offers
 * `contains, eq, ne, startsWith, endsWith, in, nin`; a date column swaps the
 * string operators for `gt, gte, lt, lte`).
 *
 * @param {object} file One of {@link SITADEL_FILES}.
 * @param {{communeCode: string, since: string}} query
 * @returns {string}
 */
export function buildSitadelUrl(file, { communeCode, since }) {
  const code = foldToSitadelCommune(communeCode);
  // i18n-ignore-next-line — a developer error, never shown to a reader
  if (!code) throw new Error(`ads: invalid commune code ${communeCode}`);
  const params = new URLSearchParams({
    COMM: `eq:${code}`,
    DATE_REELLE_AUTORISATION: `gte:${since}`,
    columns: file.columns.join(','),
  });
  return `${SITADEL_JSON_BASE}/${file.rid}/json?${params}`;
}

/**
 * Build one métropole-portal query.
 *
 * Bounded by DISTANCE where the portal publishes a coordinate, and by COMMUNE
 * where it does not — a `distance()` filter needs the very column Nantes is
 * missing, and a commune query is what makes that portal cacheable alongside
 * the Sitadel rows it will be geocoded with.
 *
 * The date floor is never optional: Bordeaux's file starts in 2003 and a 300 m
 * circle in the centre holds 2 604 dossiers (measured 2026-09-02).
 *
 * WHY THE KIND EXCLUSION IS UPSTREAM AND NOT IN THE PROJECTION. It always had
 * to happen — `projectAdsPermits` has never drawn a certificat d'urbanisme —
 * but doing it here is what makes Bordeaux's polygons affordable. Measured on
 * the default scan (400 m, 36 months, place Pey-Berland):
 *
 *   points only, all kinds, as this shipped         416 KB   1 412 rows
 *   + geo_shape, all kinds                        1 338 KB   1 412 rows
 *   + geo_shape, certificats left upstream          391 KB     469 rows
 *
 * Two thirds of that circle are certificats, and their outlines were being
 * downloaded only to be discarded a function later. Dropping them pays for
 * every emprise the layer now draws, with 25 KB to spare against the version
 * that drew none.
 *
 * @param {object} portal One of {@link LOCAL_ADS_PORTALS}.
 * @param {{lon?: number, lat?: number, radiusM?: number, communeCode?: string,
 *   since: string, onlyKind?: string}} query `onlyKind` INVERTS the exclusion,
 *   which is how the excluded rows get counted without being fetched.
 * @returns {string}
 */
export function buildLocalAdsUrl(portal, {
  lon, lat, radiusM, communeCode, since, onlyKind = null,
}) {
  if (portal.api === 'arcgis') return buildArcgisAdsUrl(portal, { lon, lat, radiusM, since });
  const clauses = [`${portal.dateColumn} >= date'${since}'`];
  if (portal.geoColumn) {
    clauses.unshift(`distance(${portal.geoColumn}, geom'POINT(${lon} ${lat})', ${Math.round(radiusM)}m)`);
  } else if (portal.communeColumn) {
    const code = String(communeCode ?? '').trim();
    // i18n-ignore-next-line — a developer error, never shown to a reader
    if (!code) throw new Error(`ads: ${portal.key} needs a commune code`);
    clauses.unshift(portal.communeIsNumeric
      ? `${portal.communeColumn} = ${Number.parseInt(code, 10)}`
      : `${portal.communeColumn} = "${code}"`);
  }
  // ODSQL has no `<>`. Writing one is not a filter that misses: the export
  // endpoint answers an ODSQL syntax error with a JSON error OBJECT and
  // HTTP 200, which reads as a short answer rather than as a failure.
  if (portal.kindColumn && (onlyKind || portal.excludedKind)) {
    clauses.push(onlyKind
      ? `${portal.kindColumn} = "${onlyKind}"`
      : `${portal.kindColumn} != "${portal.excludedKind}"`);
  }
  const params = new URLSearchParams({
    select: portal.select.join(','),
    where: clauses.join(' and '),
    limit: '-1',
  });
  return `https://${portal.portal}/api/explore/v2.1/catalog/datasets/${portal.dataset}/exports/json?${params}`;
}

/**
 * The same query, asked of an ArcGIS map service (`api: 'arcgis'`).
 *
 * A layer's `query` operation takes the circle as a point and a distance in
 * metres, the date floor in the service's SQL (`DATE '…'`, the standardised
 * form, which Brest's server accepted on 2026-10-01), and answers GeoJSON in
 * WGS 84 when asked for `outSR=4326` — the same `{lon, lat}` a row's position
 * is read from everywhere else, one level down in its `geometry`. 2 000 rows
 * is the service's own ceiling per answer; a 1 200 m circle over thirteen
 * years in the centre of Brest holds fewer.
 *
 * @param {object} portal An `api: 'arcgis'` portal.
 * @param {{lon: number, lat: number, radiusM: number, since: string}} query
 * @returns {string}
 */
function buildArcgisAdsUrl(portal, { lon, lat, radiusM, since }) {
  const params = new URLSearchParams({
    where: `${portal.dateColumn} >= DATE '${since}'`,
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    distance: String(Math.round(radiusM)),
    units: 'esriSRUnit_Meter',
    outFields: portal.select.join(','),
    outSR: '4326',
    resultRecordCount: '2000',
    f: 'geojson',
  });
  return `${portal.service}/query?${params}`;
}

/**
 * The rows of a portal's answer, or null when it did not answer with rows.
 *
 * An Opendatasoft export is an array already. An ArcGIS service answers a
 * GeoJSON FeatureCollection, its columns under each feature's `properties`
 * and its dates as milliseconds since 1970; each feature becomes one flat row
 * with the point under `geometry` and its dates as the Paris day they fall
 * on — 1766098800000 is 23:00 UTC on 18 December 2025, the 19th in Brest. An
 * answer that is neither — an error object, which both kinds of portal send
 * with HTTP 200 — is null, never an empty list.
 *
 * @param {object} portal One of {@link LOCAL_ADS_PORTALS}.
 * @param {*} answer The parsed body.
 * @returns {?Array<object>}
 */
export function localRows(portal, answer) {
  if (portal.api !== 'arcgis') return Array.isArray(answer) ? answer : null;
  if (!answer || answer.type !== 'FeatureCollection' || !Array.isArray(answer.features)) return null;
  const dates = Object.values(portal.columns ?? {}).flat()
    .filter((column) => /^DATE_/.test(column));
  return answer.features.map((feature) => {
    const row = { ...(feature?.properties ?? {}), geometry: feature?.geometry ?? null };
    for (const column of dates) row[column] = parisDay(row[column]);
    return row;
  });
}

/** Milliseconds since 1970 → the `YYYY-MM-DD` it is in Paris, or null. */
function parisDay(value) {
  const ms = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
}

/**
 * Count the rows a portal was asked to leave out, without fetching them.
 *
 * The certificats are excluded from the map on principle, and the count of
 * them is what keeps that an editorial line rather than a hole: a block whose
 * scan says "0 permits, 47 certificats" is a block where somebody is asking
 * questions, and that is worth a sentence. `records` rather than
 * `exports/json`, so the answer is a number and not a file.
 *
 * @param {object} portal One of {@link LOCAL_ADS_PORTALS}.
 * @param {object} query Same shape as {@link buildLocalAdsUrl}.
 * @returns {?string} Null for a portal that excludes nothing.
 */
export function buildLocalAdsExcludedCountUrl(portal, query) {
  if (!portal.kindColumn || !portal.excludedKind) return null;
  const url = new URL(buildLocalAdsUrl(portal, { ...query, onlyKind: portal.excludedKind }));
  const params = new URLSearchParams({
    select: 'count(*) as n',
    where: url.searchParams.get('where'),
    limit: '1',
  });
  return `https://${portal.portal}/api/explore/v2.1/catalog/datasets/${portal.dataset}/records?${params}`;
}

/**
 * The portals that publish anything about this commune.
 *
 * Accepts either level of the Paris/Lyon/Marseille code so the gate never
 * depends on which referential the caller resolved through.
 *
 * @param {?string} communeCode
 * @returns {Array<object>} Subset of {@link LOCAL_ADS_PORTALS}.
 */
export function portalsForCommune(communeCode) {
  const raw = String(communeCode ?? '').trim().toUpperCase();
  const folded = foldToSitadelCommune(raw);
  if (!folded) return [];
  return LOCAL_ADS_PORTALS.filter((portal) => portal.communes.includes(raw)
    || portal.communes.includes(folded));
}

/**
 * Canonical identity of a dossier across the two registers.
 *
 * Sitadel writes `07510826V0143`; Paris writes the same dossier as
 * `DP 075 108 26 V0143`; Nantes writes `DP0441662600106` and Bordeaux
 * `CU 033 519 17 Z0225`. Uppercase, drop everything that is not a letter or a
 * digit, drop a leading family prefix, and all four spellings meet.
 *
 * A modificatif suffix (`… M01`) is deliberately KEPT. It is a separately
 * filed decision on the same project, Sitadel folds it into the parent row,
 * and merging the two would silently replace "modified in June" with the
 * original permit's dates.
 *
 * @param {?string} raw Any published dossier reference.
 * @returns {?string}
 */
export function dossierKey(raw) {
  const flat = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!flat) return null;
  return flat.replace(/^(PC|DP|PA|PD|CU)/, '');
}

/**
 * The number series a family's dossiers are counted in.
 *
 * TRAP 6: `NUM_DAU`, `NUM_PA` and `NUM_PD` are three independent counters, and
 * their digits collide on unrelated dossiers — 271 such collisions over Paris
 * alone in a three-year window. Every identity in this module is therefore
 * SERIES + NUMBER, and this is the function that names the series for a
 * dossier that arrived from a portal rather than from a file.
 *
 * `PC` and `DP` share `DAU` because the register does: the same operation is
 * listed in both permis-de-construire files under one number.
 *
 * @param {?string} kind Family letter.
 * @returns {string}
 */
export function seriesOfKind(kind) {
  const family = String(kind ?? '').toUpperCase();
  if (family === 'PA' || family === 'PD' || family === 'CU') return family;
  return 'DAU';
}

/**
 * Print a Sitadel dossier number the way it is printed everywhere else.
 *
 * Sitadel stores `04410925A0227`; the yellow panneau on the fence, the
 * préfecture's recueil and all three métropole portals write the same
 * reference as `DP 044 109 25 A0227`. The grammar is fixed — three digits of
 * département, three of commune, two of year, then the counter's own sequence
 * — so this is a re-spacing, not an interpretation, and a reader can hold the
 * card up against the sign. Anything that does not match the grammar is
 * returned untouched rather than sliced into a shape it does not have.
 *
 * @param {string} kind Family letter (`PC`, `DP`, `PA`, `PD`).
 * @param {string} raw Sitadel's `NUM_DAU` / `NUM_PA` / `NUM_PD`.
 * @returns {string}
 */
export function formatDossier(kind, raw) {
  const value = String(raw ?? '').trim().toUpperCase();
  const match = /^(\d{3})(\d{3})(\d{2})(.+)$/.exec(value);
  if (!match) return value;
  return `${kind} ${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
}

/** Trim a value to a non-empty string, or null. Upstreams spell empty four ways. */
function text(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed && trimmed.toLowerCase() !== 'null' ? trimmed : null;
}

/** Read a finite number, or null. `0` is a real surface and survives. */
function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `AV` + `351` → `AV 351`. Up to three per dossier; empties collapse away. */
function parcelRefs(row) {
  const refs = [];
  for (let i = 1; i <= 3; i += 1) {
    const section = text(row[`SEC_CADASTRE${i}`]);
    const parcel = text(row[`NUM_CADASTRE${i}`]);
    if (section && parcel) refs.push(`${section} ${parcel}`);
  }
  return refs;
}

/** The one-line "what is being built" a card leads with. */
function sitadelPurpose(file, row) {
  const parts = [];
  const nature = SITADEL_NATURES[row.NATURE_PROJET_DECLAREE];
  if (nature) parts.push(nature);
  const destination = SITADEL_DESTINATIONS[row.DESTINATION_PRINCIPALE];
  if (destination) parts.push(destination);
  const zone = SITADEL_ZONES[row.ZONE_OP];
  if (zone) parts.push(zone);
  if (!parts.length) parts.push(ADS_KINDS[file.defaultKind] ?? file.label);
  return parts.join(' · ');
}

/**
 * One Sitadel row → the shape every source is normalised into.
 *
 * @param {object} file One of {@link SITADEL_FILES}.
 * @param {object} row One JSON record as DiDo returns it.
 * @returns {?object} Null when the row carries no dossier number.
 */
export function normaliseSitadelRow(file, row) {
  const raw = text(row[file.numberColumn]);
  if (!raw) return null;
  const kind = (file.typeColumn && text(row[file.typeColumn])) || file.defaultKind;
  const dossier = formatDossier(kind, raw);
  const status = SITADEL_STATES[row[file.stateColumn]] ?? null;
  const street = text(row.ADR_LIBVOIE_TER) || text(row.ADR_LIEUDIT_TER);
  const houseNumber = text(row.ADR_NUM_TER);
  // WHICH CADASTRE FILE THIS ROW'S PARCEL LIVES IN, which is not `COMM` in the
  // three cities that have arrondissements: Sitadel writes 75056 and Etalab
  // publishes no cadastre under it. `sitadelJoinCommune` reads the
  // arrondissement out of the dossier number, falling back to the postcode —
  // the same resolution the sibling `sitadel-fr` layer uses, so a permit is
  // never looked up in one commune's parcels and drawn in another's.
  const cadastreCommune = sitadelJoinCommune(row, ARRONDISSEMENT_COMMUNES[text(row.COMM)] ?? null);
  return {
    // Keyed on the SERIES and the RAW number. The series because three
    // counters collide (TRAP 6); the raw number because this id is the CSV
    // `ref` the BAN answer is joined back on and the entity id the globe picks
    // by, and neither should move because a display format changed.
    id: `sitadel:${file.series}:${raw}`,
    dossier,
    series: file.series,
    key: `${file.series}|${dossierKey(raw)}`,
    kind,
    kindLabel: ADS_KINDS[kind] ?? kind,
    state: status?.state ?? null,
    stateLabel: status?.label ?? null,
    depositedOn: null,
    decidedOn: text(row.DATE_REELLE_AUTORISATION),
    startedOn: text(row.DATE_REELLE_DOC),
    completedOn: text(row.DATE_REELLE_DAACT),
    depositYear: number(row.AN_DEPOT),
    applicant: text(row.DENOM_DEM),
    purpose: sitadelPurpose(file, row),
    address: [houseNumber, street].filter(Boolean).join(' ') || null,
    postcode: text(row.ADR_CODPOST_TER),
    commune: text(row.ADR_LOCALITE_TER),
    communeCode: text(row.COMM),
    cadastreCommune,
    parcels: parcelRefs(row),
    // The same references as `parcels`, in the 14-character form the cadastre
    // is keyed by. Both are kept: one is printed on the card, the other joins.
    parcelIdus: sitadelParcelRefs(row, cadastreCommune),
    landAreaM2: number(row.SUPERFICIE_TERRAIN),
    housing: number(row.NB_LGT_TOT_CREES),
    surfaceCreatedM2: number(row.SURF_HAB_CREEE) ?? number(row.SURF_LOC_CREEE),
    lon: null,
    lat: null,
    precision: null,
    geocodeScore: null,
    source: 'sitadel',
    // i18n-ignore-next-line — the register's own name, relayed as attribution
    sourceLabel: 'Sitadel — SDES',
  };
}

/** The family letter a portal's free-text `type_dossier` is really naming. */
function localKind(label, dossier) {
  const value = String(label ?? '').toLowerCase();
  // i18n-ignore-start — the portals' own `type_dossier` wording, matched on
  if (value.includes('démolir') || value.includes('demolir')) return 'PD';
  if (value.includes('aménager') || value.includes('amenager')) return 'PA';
  if (value.includes('préalable') || value.includes('prealable')) return 'DP';
  // i18n-ignore-end
  if (value.includes('certificat')) return 'CU';
  if (value.includes('construire')) return 'PC';
  const prefix = String(dossier ?? '').trim().toUpperCase().slice(0, 2);
  return Object.hasOwn(ADS_KINDS, prefix) ? prefix : 'PC';
}

/**
 * Fold a portal's own wording for where a dossier stands onto a shared ladder.
 *
 * The three portals disagree about the vocabulary and only overlap on the one
 * value Sitadel cannot express: Paris says `En cours d'instruction`, Nantes
 * `Dossier déposé (en cours d'instruction)`, and Bordeaux says nothing at all
 * — its file carries no decision column, so a Bordeaux dossier is drawn as
 * filed and its card says only when.
 *
 * Tours and Brest write a decision the way the boards do — `Défavorable`,
 * `Rejet tacite pour incomplétude`, `Favorable avec réserve` — so REFUSAL IS
 * TESTED FIRST, because `défavorable` contains `favorable`, and `non
 * opposition` is a grant before `opposition` is a refusal. Neither word is in
 * the Paris or Nantes vocabulary (all five values checked 2026-10-01).
 *
 * @param {?string} raw
 * @returns {{state: ?string, label: ?string}}
 */
export function localState(raw) {
  const value = String(raw ?? '').toLowerCase();
  if (!value) return { state: null, label: null };
  if (value.includes('instruction')) return { state: 'instruction', label: adsStateFrench('instruction') };
  // i18n-ignore-start — the portals' own decision wording, matched on
  const granted = /non[\s-]opposition/.test(value);
  if (!granted && /refus|rejet|d[ée]favorable|opposition/.test(value)) {
    return { state: 'refuse', label: adsStateFrench('refuse') };
  }
  if (granted || /accord|autoris|favorable/.test(value)) return { state: 'accorde', label: adsStateFrench('accorde') };
  // i18n-ignore-end
  if (value.includes('annul') || value.includes('retir')) return { state: 'annule', label: adsStateFrench('annule') };
  return { state: 'depose', label: String(raw).trim() };
}

/**
 * Pull `{lon, lat}` out of whichever shape the portal answered with.
 *
 * Both Paris and Bordeaux answer `exports/json` with a `{lon, lat}` OBJECT
 * (measured 2026-09-02) — the same shape as `records`. The array branch is
 * kept because Opendatasoft's own docs describe `geo_point_2d` as a
 * `[lat, lon]` pair and a portal upgrade that starts honouring that would
 * otherwise put every dossier in the Indian Ocean without erroring.
 */
function localPoint(portal, record) {
  if (!portal.geoColumn) return { lon: null, lat: null };
  const value = record[portal.geoColumn];
  // An ArcGIS service's GeoJSON point: `[lon, lat]`, the GeoJSON order.
  if (value?.type === 'Point' && Array.isArray(value.coordinates)) {
    return { lon: number(value.coordinates[0]), lat: number(value.coordinates[1]) };
  }
  if (Array.isArray(value) && value.length >= 2) return { lat: number(value[0]), lon: number(value[1]) };
  if (value && typeof value === 'object') return { lon: number(value.lon), lat: number(value.lat) };
  return { lon: null, lat: null };
}

/**
 * Pull the parcel outline out of a portal row, cleaned and ready to draw.
 *
 * WHY BORDEAUX GETS A SHAPE AND THE OTHER TWO DO NOT. It is not a difference
 * of effort, it is what the three files contain: Paris publishes a point per
 * dossier, Nantes an address string, and only Bordeaux publishes the emprise —
 * the outline of the parcels the dossier names. So this returns null for the
 * other two and the layer keeps drawing them as points, which is the whole
 * truth about them.
 *
 * WHAT THE OUTLINE IS. The parcels, not the project: it is the land the file
 * concerns, and the building it authorises may cover a corner of it. The card
 * says so. Verified against the IGN cadastre on 2026-09-02 — parcel
 * `33063000KD0112` comes back from `apicarto.ign.fr` with the same ring to the
 * seventh decimal — which is also how the shape was shown to be the reliable
 * half of the row: that parcel's published `superficie` reads 5 471 m² where
 * the cadastre and the polygon both say 45.
 *
 * @param {object} portal One of {@link LOCAL_ADS_PORTALS}.
 * @param {object} record One raw row.
 * @returns {?Array<Array<Array<number[]>>>} Parts, or null.
 */
export function localEmprise(portal, record) {
  if (!portal.shapeColumn) return null;
  const shape = record[portal.shapeColumn];
  // Opendatasoft wraps `geo_shape` in a GeoJSON Feature, so the geometry is
  // one level down; a bare geometry is accepted too rather than assumed away.
  const geometry = shape?.geometry ?? shape;
  const type = geometry?.type;
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;
  let parts;
  if (type === 'MultiPolygon') parts = coordinates;
  else if (type === 'Polygon') parts = [coordinates];
  else return null;
  const clean = sanitisePolygonParts(parts);
  return clean.length ? clean : null;
}

/**
 * Is this row's position the projected origin dressed up as a real coordinate?
 *
 * TRAP 5, and the reason it needs its own function: Paris writes a missing
 * position as Lambert-93 `(0, 0)`, and the portal reprojects that into a
 * WGS84 pair that looks like any other. The published projected columns are
 * the only witness, so a portal that has them declares them and a row whose
 * easting or northing is zero is treated as unplaced.
 *
 * @param {object} portal One of {@link LOCAL_ADS_PORTALS}.
 * @param {object} record One raw row.
 * @returns {boolean}
 */
function isProjectedOrigin(portal, record) {
  const columns = portal.projectedColumns;
  if (!columns) return false;
  return columns.some((column) => {
    const value = Number(record[column]);
    return Number.isFinite(value) && value === 0;
  });
}

/**
 * Strip the markup a portal put inside a plain-text field.
 *
 * Nantes writes multi-line project descriptions as `<br/>`-separated HTML
 * inside `details_du_projet` — *"changement porte d'entrée et porte de
 * garage&lt;br/&gt;peinture des volets"*. The card renders text, so the tag
 * would show through as literal characters.
 */
function plain(value) {
  const raw = text(value);
  if (!raw) return null;
  return text(raw.replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

/**
 * An INSEE code as the five-character string it is.
 *
 * Nantes publishes `code_insee_commune` as an INTEGER (44166), which is
 * lossless for a 44 département and silently wrong for an 01 one.
 */
function inseeCode(value) {
  const raw = text(value);
  if (!raw) return null;
  return /^\d{1,5}$/.test(raw) ? raw.padStart(5, '0') : raw.toUpperCase();
}

/**
 * A portal row under the normaliser's own column names, for a portal that
 * declares `columns`; the others are read as they come.
 */
function canonicalRow(portal, record) {
  if (!portal.columns) return record;
  const row = { ...record };
  for (const [ours, theirs] of Object.entries(portal.columns)) {
    const names = Array.isArray(theirs) ? theirs : [theirs];
    row[ours] = names.map((name) => record[name]).find((value) => text(value) !== null) ?? null;
  }
  return row;
}

/**
 * A portal's dossier number, spelled the way Sitadel's is.
 *
 * Tours writes `DP 37261 26 T1181`: the commune's five-digit INSEE code where
 * Sitadel writes the département on three digits (`03726126T1181`), so the
 * two never met on `dossierKey` and every Tours dossier Sitadel also held was
 * drawn twice. Only a portal flagged `fiveDigitDossier` is rewritten, and only
 * a number of exactly that spaced shape: `DP 037 261 26 T1181`.
 *
 * @param {object} portal One of {@link LOCAL_ADS_PORTALS}.
 * @param {*} raw
 * @returns {?string}
 */
export function localDossier(portal, raw) {
  const value = text(raw);
  if (!value || !portal.fiveDigitDossier) return value;
  const match = /^([A-Z]{2})\s+(\d{2})(\d{3})\s+(\d{2})\s+(\S.*)$/.exec(value.toUpperCase());
  return match ? `${match[1]} 0${match[2]} ${match[3]} ${match[4]} ${match[5]}` : value;
}

/**
 * A portal's parcel references as the cadastre keys them, for a portal that
 * asks for it (`resolveParcels`): Tours writes `BV366`, `CV0548`, and `0` for
 * none. The section is padded to two characters and the number to four, with
 * the prefix `000` — the only one in Tours's cadastre (30 628 parcels in
 * Etalab's edition of 2026-06-01). 1 738 of the 1 887 dossiers filed in the
 * year to 2026-10-01 name a parcel found there.
 *
 * @param {Array<string>} refs
 * @param {?string} insee
 * @returns {Array<{idu: string, provisional: boolean, label: string}>}
 */
function localParcelIdus(refs, insee) {
  if (!insee || !/^\d{5}$/.test(insee)) return [];
  const out = [];
  for (const ref of refs) {
    const match = /^([A-Z]{1,2})(\d{1,4})$/.exec(String(ref).replace(/\s+/g, '').toUpperCase());
    if (!match || /^0+$/.test(match[2])) continue;
    const idu = `${insee}000${match[1].padStart(2, '0')}${match[2].padStart(4, '0')}`;
    if (!out.some((known) => known.idu === idu)) {
      out.push({ idu, provisional: false, label: `${match[1]} ${Number.parseInt(match[2], 10)}` });
    }
  }
  return out;
}

/**
 * One métropole record → the same normalised shape.
 *
 * @param {object} portal One of {@link LOCAL_ADS_PORTALS}.
 * @param {object} input One row as `exports/json` returns it, or as
 *   {@link localRows} flattens an ArcGIS feature.
 * @returns {?object}
 */
export function normaliseLocalRow(portal, input) {
  const record = canonicalRow(portal, input);
  const dossier = localDossier(portal, record.nom_dossier ?? record.ident ?? record.numero_de_dossier);
  if (!dossier) return null;
  const kind = localKind(record.type_dossier ?? record.type_libelle, dossier);
  const verdict = record.etat ?? record.etat_dossier;
  const status = portal.publishesDecision === false || (portal.blankIsFiled && !text(verdict))
    ? { state: 'depose', label: adsStateFrench('depose') }
    : localState(verdict);
  const { lon, lat } = localPoint(portal, record);
  const placed = Number.isFinite(lon) && Number.isFinite(lat)
    && (lon !== 0 || lat !== 0)
    && !isProjectedOrigin(portal, record);
  const refcad = record.refcad;
  const parcels = (Array.isArray(refcad) ? refcad.map(text) : [text(refcad)])
    // `0` is how Tours writes a decision row's missing parcel.
    .filter((ref) => ref && !/^0+$/.test(ref));
  const communeCode = inseeCode(record.insee ?? record.code_insee_commune);
  const parcelIdus = portal.resolveParcels ? localParcelIdus(parcels, communeCode) : [];
  return {
    id: `${portal.key}:${dossier}`,
    dossier,
    series: seriesOfKind(kind),
    key: `${seriesOfKind(kind)}|${dossierKey(dossier)}`,
    kind,
    kindLabel: ADS_KINDS[kind] ?? kind,
    state: status.state,
    stateLabel: status.label,
    depositedOn: text(record.date_depot ?? record.date_de_depot),
    decidedOn: text(record.date_decision),
    startedOn: null,
    completedOn: null,
    depositYear: null,
    // A city portal names private applicants too; only an organisation's
    // name reaches the card (see permitApplicant.js).
    applicant: organisationApplicant(record.demandeur),
    purpose: plain(record.objet ?? record.details_du_projet) ?? (ADS_KINDS[kind] ?? null),
    address: plain(record.adresse ?? record.adresse_du_terrain),
    postcode: text(record.code_postal),
    commune: text(record.commune ?? record.nom),
    communeCode,
    // A portal's `refcad` is resolved against the cadastre only where the
    // portal asks (`resolveParcels`, Tours). Bordeaux publishes the OUTLINE
    // beside its reference, so there is nothing left to look up; Brest a
    // point on every row, which already places it.
    cadastreCommune: parcelIdus.length ? communeCode : null,
    parcelIdus,
    parcels: parcelIdus.length ? parcelIdus.map((ref) => ref.label) : parcels,
    landAreaM2: number(record.superficie),
    // Blank is not none: `number(null)` would read 0.
    housing: text(record.nb_logements) === null ? null : number(record.nb_logements),
    surfaceCreatedM2: number(record.surf_creee) ?? number(record.surface_de_plancher),
    lon: placed ? lon : null,
    lat: placed ? lat : null,
    precision: placed ? 'published' : null,
    geocodeScore: null,
    // The parcel outline, where the portal publishes one. Stripped from the
    // permit before it is served — see `projectAdsPermits`, which lifts it
    // into a table of its own so one plot is sent once however many dossiers
    // stand on it.
    parts: localEmprise(portal, record),
    source: portal.key,
    sourceLabel: portal.label,
  };
}

/**
 * One dossier per number, for a portal that lists a dossier on several rows
 * (`rowPerParcel`).
 *
 * Tours lists a dossier once when it is filed and again when it is decided,
 * and once per parcel each time — four rows for a decision on two parcels.
 * The decided row leads, the blanks are taken from the others, and the
 * parcels are the union of all of them, so a dossier filed on two lots is
 * drawn on both.
 *
 * @param {Array<object>} permits Normalised rows of ONE portal.
 * @returns {{permits: Array<object>, folded: number}}
 */
export function foldLocalRows(permits) {
  const byKey = new Map();
  let folded = 0;
  for (const permit of permits) {
    const identity = `${permit.kind}|${permit.key}`;
    const seen = byKey.get(identity);
    if (!seen) { byKey.set(identity, permit); continue; }
    folded += 1;
    const later = Boolean(permit.decidedOn) !== Boolean(seen.decidedOn)
      ? Boolean(permit.decidedOn)
      : String(permit.decidedOn ?? '') > String(seen.decidedOn ?? '');
    const [lead, other] = later ? [permit, seen] : [seen, permit];
    const merged = { ...lead };
    for (const [field, value] of Object.entries(other)) {
      const mine = merged[field];
      if (mine === null || mine === undefined) merged[field] = value;
    }
    merged.parcels = [...new Set([...(lead.parcels || []), ...(other.parcels || [])])];
    merged.parcelIdus = [...(lead.parcelIdus || [])];
    for (const ref of other.parcelIdus || []) {
      if (!merged.parcelIdus.some((known) => known.idu === ref.idu)) merged.parcelIdus.push(ref);
    }
    merged.cadastreCommune = lead.cadastreCommune ?? other.cadastreCommune;
    byKey.set(identity, merged);
  }
  return { permits: [...byKey.values()], folded };
}

/**
 * Draw the permits that name a parcel the cadastre still has.
 *
 * THE CHEAP HALF OF THE WHOLE IDEA, and it runs before the geocoder rather
 * than after it: a row placed here never enters the BAN batch, so this both
 * improves the placement and shrinks the call. Measured over Ustaritz's 543
 * Sitadel rows, 58.1% name a parcel that is alive today — those stop being an
 * address to be guessed at and become the plot the dossier was filed on.
 *
 * Several parcels on one dossier become ONE emprise, not several: a permit
 * filed on three adjoining lots is one operation on one piece of ground, and
 * `liftEmprises` downstream will key it by that geometry.
 *
 * @param {Array<object>} permits Normalised permits.
 * @param {Map<string, object>} index Today's cadastre, IDU → GeoJSON feature.
 * @returns {{permits: Array<object>, placed: number, divided: Array<object>}}
 *   `divided` are the rows that named a parcel and found none — the input to
 *   {@link applyLineage}, and the reason this function reports them.
 */
export function placeOnParcels(permits, index) {
  const out = [];
  const divided = [];
  let placed = 0;
  for (const permit of permits) {
    const refs = permit.parcelIdus || [];
    if (permit.lon !== null || !refs.length) { out.push(permit); continue; }
    const features = refs.map((ref) => index?.get(ref.idu)).filter(Boolean);
    if (!features.length) {
      divided.push(permit);
      out.push(permit);
      continue;
    }
    const parts = sanitisePolygonParts(features.flatMap((feature) => parcelParts(feature.geometry)));
    const point = parts.length ? insidePoint(parts) : null;
    // A parcel whose rings did not survive the sanitiser is not a placement.
    // It falls through to the geocoder rather than being drawn at a NaN.
    if (!point) { out.push(permit); continue; }
    placed += 1;
    out.push({
      ...permit,
      lon: point.lon,
      lat: point.lat,
      parts,
      precision: 'parcelle',
      geocodeScore: null,
    });
  }
  return { permits: out, placed, divided };
}

/**
 * Draw the permits whose parcel was divided out from under them.
 *
 * The resolution itself lives in `cadastreLineage.js` and is done by the proxy,
 * which is the half that needs the network; this applies the verdict. Two
 * different verdicts arrive here and they are drawn differently on purpose:
 *
 * - a CHILD was identified — by the BAL's own number, by being the only lot
 *   that gained a building, or by being the only lot at all — and the permit
 *   is drawn on it as `enfant`;
 * - no child could be told from its siblings, and the permit is drawn on the
 *   PARENT as `mere`. That is the honest answer two thirds of the time and it
 *   is still a plot rather than a point on a road.
 *
 * The basis travels with the permit so the card can say which of the two it is
 * looking at. An inference drawn identically to a record is the failure this
 * whole module exists to avoid.
 *
 * @param {Array<object>} permits Normalised permits.
 * @param {Map<string, object>} verdicts Permit id → the resolution.
 * @returns {{permits: Array<object>, children: number, parents: number}}
 */
export function applyLineage(permits, verdicts) {
  const out = [];
  let children = 0;
  let parents = 0;
  for (const permit of permits) {
    const verdict = verdicts?.get(permit.id);
    if (permit.lon !== null || !verdict) { out.push(permit); continue; }
    const feature = verdict.feature ?? verdict.parent ?? null;
    const parts = sanitisePolygonParts(parcelParts(feature?.geometry));
    const point = parts.length ? insidePoint(parts) : null;
    if (!point) { out.push(permit); continue; }
    const onChild = Boolean(verdict.feature);
    if (onChild) children += 1; else parents += 1;
    out.push({
      ...permit,
      lon: point.lon,
      lat: point.lat,
      parts,
      precision: onChild ? 'enfant' : 'mere',
      geocodeScore: null,
      lineage: {
        basis: verdict.basis,
        basisLabel: ADS_LINEAGE_BASIS[verdict.basis]?.label ?? null,
        // The edition the parent was found in, which is also the date before
        // which the division had not happened yet.
        millesime: verdict.millesime ?? null,
        parcel: feature?.properties?.id ?? null,
        parent: verdict.parent?.properties?.id ?? null,
        siblings: Number.isFinite(verdict.children) ? verdict.children : null,
      },
    });
  }
  return { permits: out, children, parents };
}

/**
 * Build the CSV body the BAN's bulk endpoint is posted.
 *
 * One row per permit that still has no coordinate, keyed by its own id so the
 * answer can be joined back without depending on row order. `citycode` is sent
 * as well as the postcode because it is the stronger hint and because a
 * Sitadel row's `ADR_CODPOST_TER` is the postal code of the SITE, which in a
 * commune with several does not identify the commune.
 *
 * @param {Array<object>} permits Normalised permits.
 * @returns {?string} CSV text, or null when nothing needs geocoding.
 */
export function buildGeocodeCsv(permits) {
  const rows = permits.filter((permit) => permit.address && permit.lon === null);
  if (!rows.length) return null;
  const escape = (value) => {
    const cell = String(value ?? '');
    return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  };
  const lines = ['ref,adresse,codepostal,citycode'];
  for (const permit of rows) {
    lines.push([
      permit.id,
      permit.address,
      permit.postcode ?? '',
      foldToSitadelCommune(permit.communeCode) ?? '',
    ].map(escape).join(','));
  }
  return lines.join('\n');
}

/**
 * Parse a BAN CSV answer.
 *
 * Quote-aware, because `result_label` routinely contains a comma and a naive
 * `split(',')` shifts every column after it — which lands longitudes in the
 * score column and score values on the map.
 *
 * @param {string} text Raw CSV body.
 * @returns {Array<Record<string, string>>}
 */
export function parseGeocodedCsv(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const pushCell = () => { row.push(cell); cell = ''; };
  const pushRow = () => { pushCell(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { pushCell(); continue; }
    if (char === '\r') continue;
    if (char === '\n') { pushRow(); continue; }
    cell += char;
  }
  if (cell || row.length) pushRow();
  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((cells) => cells.length >= header.length)
    .map((cells) => Object.fromEntries(header.map((name, i) => [name.trim(), cells[i]])));
}

/**
 * Merge a BAN answer back onto the permits that asked for it.
 *
 * A row the BAN could not place, or placed no better than its commune, is
 * DROPPED rather than drawn at the centroid. A commune centroid is
 * indistinguishable from a real position once it is a dot on a globe, and the
 * layer would be silently claiming to know where a building site is. The count
 * of what was dropped travels to the client so the shortfall is stated.
 *
 * @param {Array<object>} permits Normalised permits, some without coordinates.
 * @param {string} csv Raw BAN CSV answer.
 * @returns {{permits: Array<object>, geocoded: number, unplaced: number}}
 */
export function applyGeocoding(permits, csv) {
  const byRef = new Map();
  for (const row of parseGeocodedCsv(csv)) {
    if (row.ref) byRef.set(row.ref, row);
  }
  const placed = [];
  let geocoded = 0;
  let unplaced = 0;
  for (const permit of permits) {
    if (permit.lon !== null && permit.lat !== null) {
      placed.push(permit);
      continue;
    }
    const row = byRef.get(permit.id);
    const lon = Number(row?.longitude);
    const lat = Number(row?.latitude);
    const type = String(row?.result_type || '').trim();
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Object.hasOwn(ADS_PRECISION, type)
      || ADS_PRECISION[type].rank < ADS_PRECISION.locality.rank) {
      unplaced += 1;
      continue;
    }
    geocoded += 1;
    placed.push({
      ...permit,
      lon,
      lat,
      precision: type,
      geocodeScore: Number.isFinite(Number(row.result_score)) ? Number(row.result_score) : null,
    });
  }
  return { permits: placed, geocoded, unplaced };
}

/**
 * Family precedence when one dossier number is listed in several files.
 *
 * A permis de construire outranks the déclaration préalable it may also be
 * recorded as, and both outrank the aménager/démolir facets of the same
 * operation: the strongest authorisation is the one a reader is asking about.
 */
const FAMILY_RANK = Object.freeze({ PC: 4, DP: 3, PA: 2, PD: 1, CU: 0 });

/**
 * Fold the Sitadel families into one row per dossier.
 *
 * TRAP 6. A mixed operation — flats over a shop — is filed ONCE and listed in
 * both permis-de-construire files, which share the `NUM_DAU` series: 151 such
 * pairs over Paris in a three-year window, plus 12 dossiers listed twice
 * inside the non-residential file alone, one row per destination. Each row
 * knows a different part of the same permit, so the fold UNIONS what they know
 * rather than letting the last one read win.
 *
 * It folds on `key`, which carries the SERIES — never on the bare number. Over
 * the same commune, 271 numbers collide between the DAU, PA and PD counters at
 * completely different addresses, and folding those would glue unrelated
 * dossiers together, each inheriting the other's address and dwellings.
 *
 * The returned ids are unique by construction. That is not a nicety: the globe
 * keys entities by id, and Cesium throws on the second entity to claim one —
 * mid-render, after some markers are already on screen, which looks like a
 * layer that half-works rather than like a data shape.
 *
 * @param {Array<object>} permits Normalised Sitadel permits, any families.
 * @returns {{permits: Array<object>, folded: number}}
 */
export function foldSitadelFamilies(permits) {
  const byKey = new Map();
  let folded = 0;
  for (const permit of permits) {
    const key = permit.key || permit.id;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { ...permit, families: [permit.kind] });
      continue;
    }
    folded += 1;
    const strongest = (FAMILY_RANK[permit.kind] ?? 0) > (FAMILY_RANK[seen.kind] ?? 0) ? permit : seen;
    byKey.set(key, {
      ...seen,
      id: seen.id,
      kind: strongest.kind,
      kindLabel: strongest.kindLabel,
      dossier: strongest.dossier,
      // The union: whichever file knew a fact, keep it.
      housing: seen.housing ?? permit.housing,
      surfaceCreatedM2: seen.surfaceCreatedM2 ?? permit.surfaceCreatedM2,
      landAreaM2: seen.landAreaM2 ?? permit.landAreaM2,
      startedOn: seen.startedOn ?? permit.startedOn,
      completedOn: seen.completedOn ?? permit.completedOn,
      decidedOn: seen.decidedOn ?? permit.decidedOn,
      applicant: seen.applicant ?? permit.applicant,
      address: seen.address ?? permit.address,
      postcode: seen.postcode ?? permit.postcode,
      parcels: seen.parcels.length ? seen.parcels : permit.parcels,
      // The most advanced state wins: a dossier whose démolition is finished
      // and whose construction is open is an OPEN SITE.
      state: seen.state ?? permit.state,
      stateLabel: seen.stateLabel ?? permit.stateLabel,
      // What the operation actually covers, said on the card rather than
      // implied by three dots on one address.
      families: [...new Set([...seen.families, permit.kind])],
      purpose: seen.purpose === permit.purpose
        ? seen.purpose
        : [seen.purpose, permit.purpose].filter(Boolean).join(' · '),
    });
  }
  return { permits: [...byKey.values()], folded };
}

/**
 * Fold the two registers into one list of dossiers.
 *
 * The métropole record WINS the identity — it is the one that knows whether a
 * dossier is still being instructed, and it is days rather than weeks old —
 * but everything Sitadel knows and it does not is grafted on: the housing
 * count, the created surface, the site-progress dates. That graft is the whole
 * point of merging rather than layering, and it is why a Paris card can say
 * "en cours d'instruction" and "12 logements" at once.
 *
 * @param {Array<object>} sitadel Normalised Sitadel permits.
 * @param {Array<object>} local Normalised métropole permits.
 * @returns {{permits: Array<object>, merged: number}}
 */
/**
 * What a métropole dossier inherits of its Sitadel twin's ground.
 *
 * The rank test is the whole rule and it runs in one direction only. A
 * `parcelle` outranks a `published` point (see {@link ADS_PRECISION}), so a
 * Paris or Nantes dossier whose twin resolved to a cadastral parcel is upgraded
 * from a dot to a plot. A Bordeaux dossier is not: it arrives with the portal's
 * own `geo_shape`, which is the same plot drawn by the publisher rather than
 * inferred from a reference, and swapping one for the other would churn a
 * tested behaviour to gain nothing.
 *
 * @param {object} permit The métropole row.
 * @param {object} twin Its Sitadel twin.
 * @returns {object} Fields to spread, empty when nothing is worth grafting.
 */
function graftEmprise(permit, twin) {
  if (permit.parts?.length || !twin.parts?.length) return {};
  const here = ADS_PRECISION[permit.precision]?.rank ?? -1;
  const there = ADS_PRECISION[twin.precision]?.rank ?? -1;
  if (there <= here) return { parts: twin.parts };
  return {
    parts: twin.parts,
    lon: twin.lon,
    lat: twin.lat,
    precision: twin.precision,
    ...(twin.lineage ? { lineage: twin.lineage } : {}),
  };
}

export function mergeRegisters(sitadel, local) {
  const byKey = new Map();
  for (const permit of sitadel) {
    if (permit.key) byKey.set(permit.key, permit);
  }
  const out = [];
  let merged = 0;
  const claimed = new Set();
  for (const permit of local) {
    // SAME NUMBER IS NOT SAME DOSSIER UNLESS IT IS THE SAME FAMILY. `DAU` is
    // one series in the register, but many communes count their permis de
    // construire and their déclarations préalables separately, so a PC and a
    // DP can carry the same digits: Sitadel alone holds 2 to 8 such pairs per
    // commune since 2020 at La Ciotat, Martigues, Orléans and Dol-de-Bretagne,
    // at different addresses every time. Measured 2026-09-30 over deposits
    // since 2024-01-01, every portal row whose Sitadel twin was of another
    // family was another dossier — Nantes 5 of 5 matches, Paris 22 of 365 —
    // and `graftEmprise` then drew it on that dossier's parcel.
    const found = permit.key ? byKey.get(permit.key) : null;
    const twin = found && found.kind === permit.kind ? found : null;
    if (!twin) {
      // `sources` is set on EVERY branch, including this one. It is what the
      // card reads to say which register a dossier came from, and a permit
      // that reached the client without it read as sourceless rather than as
      // local-only.
      out.push({ ...permit, sources: [permit.source] });
      continue;
    }
    claimed.add(permit.key);
    merged += 1;
    out.push({
      ...permit,
      // Everything the State knows that the counter does not publish.
      housing: permit.housing ?? twin.housing,
      surfaceCreatedM2: permit.surfaceCreatedM2 ?? twin.surfaceCreatedM2,
      landAreaM2: permit.landAreaM2 ?? twin.landAreaM2,
      startedOn: permit.startedOn ?? twin.startedOn,
      completedOn: permit.completedOn ?? twin.completedOn,
      decidedOn: permit.decidedOn ?? twin.decidedOn,
      applicant: permit.applicant ?? twin.applicant,
      postcode: permit.postcode ?? twin.postcode,
      parcels: permit.parcels.length ? permit.parcels : twin.parcels,
      // THE GROUND, WHERE THE COUNTER PUBLISHED NONE. Bordeaux ships its own
      // emprise and keeps it; Paris and Nantes ship no shape at all, so a
      // dossier the State could resolve to a cadastral parcel hands its
      // outline over here. Only ever ADDITIVE — a local row that already has a
      // polygon is never overwritten by one resolved from a reference, because
      // the portal drew the plot it meant and this side only inferred it.
      ...graftEmprise(permit, twin),
      // The chantier ladder is Sitadel's alone; it never overwrites a live
      // instruction state, but it is what fills a blank Bordeaux row — and a
      // row that only says FILED. A commune's filing notice or list of filed
      // dossiers claims nothing past the filing (Trap 4 of `cartdsFeed.js`),
      // and a twin in Sitadel proves the dossier was granted since: an
      // Ustaritz permit filed in November 2025 and granted in January read
      // « Déposé » beside its own decision date.
      ...(permit.state === 'depose' && twin.state
        ? { state: twin.state, stateLabel: twin.stateLabel }
        : { state: permit.state ?? twin.state, stateLabel: permit.stateLabel ?? twin.stateLabel }),
      siteState: twin.state,
      siteStateLabel: twin.stateLabel,
      // i18n-ignore-next-line — two registers' own names, relayed as attribution
      sourceLabel: `${permit.sourceLabel} + Sitadel`,
      sources: [permit.source, 'sitadel'],
    });
  }
  for (const permit of sitadel) {
    if (!permit.key || !claimed.has(permit.key)) out.push({ ...permit, sources: ['sitadel'] });
  }
  return { permits: out, merged };
}

/**
 * Lift the parcel outlines out of the permits into a table of their own.
 *
 * THE SHAPE BELONGS TO THE PLOT, NOT TO THE DOSSIER. This is the whole reason
 * the function exists. Bordeaux ships the emprise on every row, and a plot
 * with a long paperwork history repeats the same outline once per file: on the
 * default scan of place Pey-Berland, 469 rows carry 300 distinct outlines, and
 * before certificats were left upstream one parcel accounted for 81 of 1 412.
 *
 * Sending it once per dossier is wrong three times over, worst first:
 *
 * - **On screen, and this is the one that lies.** Translucent fills ADD. At
 *   the wash alpha this layer uses, one copy of a plot reads at 0.18 and the
 *   nine copies of the busiest plot in that scan read at 0.83 — four and a
 *   half times the ink, on the plot with the thickest FILE rather than the
 *   biggest project. Nothing on screen says why, and the reader has no way to
 *   discount it.
 * - **On the wire.** 202 KB of repeated geometry against 117 KB of distinct
 *   geometry, for the same 469 dossiers.
 * - **In Cesium.** `StaticGroundGeometryColorBatch` opens a NEW batch — a
 *   `GroundPrimitive` of its own, tessellated and drawn separately — whenever
 *   an incoming instance's bounding rectangle collides with one already in
 *   that batch, and two copies of a parcel share a rectangle exactly. Modest
 *   but real, and measured by replaying Cesium's own greedy first-fit over the
 *   scan's rectangles: 469 instances fall into 12 batches, 300 into 7, and the
 *   vertex count drops from 7 485 to 4 330.
 *
 * KEYED ON THE GEOMETRY, NAMED BY THE PARCELS. The obvious key is `refcad`,
 * and it is wrong in two measured ways: it is written in the short
 * `063KH215` form on 2026 deposits and occasionally in the full 14-character
 * IDU form on older ones (47 of 3 927 rows in 2022 Q1), and one row in a few
 * thousand lists the same parcel twice (`['063KN138', '063KN138']`). Either
 * spelling difference splits one plot into two. The geometry has no such
 * freedom: across 5 186 rows, 2 737 distinct parcel sets produced exactly
 * 2 737 distinct outlines and no outline was shared by two different sets.
 * So the outline is the identity and `refcad` is the label.
 *
 * @param {Array<object>} permits Permits already cut to the scan.
 * @returns {{permits: Array<object>, emprises: Array<object>}} Permits with
 *   `parts` replaced by an `empriseId`, and the outlines, once each.
 */
export function liftEmprises(permits) {
  const emprises = [];
  const byGeometry = new Map();
  const out = [];
  for (const permit of permits) {
    const { parts, ...rest } = permit;
    if (!Array.isArray(parts) || !parts.length) {
      out.push({ ...rest, empriseId: null });
      continue;
    }
    // The full coordinate text, not a hash: this Map lives for one scan and a
    // few hundred keys, and an exact key cannot collide two neighbouring
    // plots into one the way a truncated digest can.
    const key = JSON.stringify(parts);
    let id = byGeometry.get(key);
    if (id === undefined) {
      id = emprises.length;
      byGeometry.set(key, id);
      let areaM2 = 0;
      for (const part of parts) {
        areaM2 += ringAreaM2(part[0]);
        for (let h = 1; h < part.length; h += 1) areaM2 -= ringAreaM2(part[h]);
      }
      // Somewhere strictly inside the widest part, for the card to hang on.
      // The widest, because an emprise made of a house and its garage strip
      // should be labelled on the house. `widthDeg` is how that choice is
      // made and is dropped afterwards: it is a server-side comparison, and
      // shipping it costs 5 KB a scan to say nothing the client reads.
      const widest = parts
        .map((part) => ringLabelAnchor(part))
        .filter(Boolean)
        .sort((a, b) => b.widthDeg - a.widthDeg)[0] ?? null;
      emprises.push({
        id,
        parts,
        anchor: widest ? { lon: widest.lon, lat: widest.lat } : null,
        // Measured off the outline itself rather than copied from the row's
        // `superficie`. The two agree within 10% on 97.9% of rows, and where
        // they disagree the outline is the one that matches the IGN cadastre
        // — parcel 33063000KD0112 is 45 m² in both, and 5 471 m² in the
        // column. A number printed beside a shape has to be that shape's.
        areaM2: Math.round(areaM2),
        parcels: [],
      });
    }
    const emprise = emprises[id];
    for (const parcel of permit.parcels || []) {
      if (parcel && !emprise.parcels.includes(parcel)) emprise.parcels.push(parcel);
    }
    // No list of dossiers here. Every permit already carries its own number
    // and the `empriseId` that groups it, so a list on the plot would be the
    // same 8.9 KB of a Bordeaux scan said twice — which is the exact mistake
    // this function exists to undo, wearing different clothes.
    out.push({ ...rest, empriseId: id });
  }
  return { permits: out, emprises };
}

/**
 * How many certificats d'urbanisme this scan stepped over.
 *
 * @param {number} seen Certificats among the rows actually fetched.
 * @param {object} context Projection context, carrying the upstream tally.
 * @returns {?number} Null when a count was asked for and not answered.
 */
function certificateTally(seen, context) {
  if (!context.certificatesAsked) return seen;
  if (!Number.isFinite(context.certificatesUpstream)) return null;
  return context.certificatesUpstream + seen;
}

/** Metres between two coordinates. Local, like `dvfFeed` and `georisquesFeed`. */
function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Cut the merged register down to the scan and describe what came back.
 *
 * @param {object} input
 * @param {Array<object>} input.permits Merged, placed permits.
 * @param {{lon: number, lat: number}} input.origin Scan centre.
 * @param {number} input.radiusM Scan radius.
 * @param {object} input.context Commune, window, provenance, shortfalls.
 * @returns {object} Client payload.
 */
export function projectAdsPermits({ permits, origin, radiusM, context = {} }) {
  const near = [];
  let certificates = 0;
  for (const permit of permits) {
    if (!Number.isFinite(permit.lon) || !Number.isFinite(permit.lat)) continue;
    const distanceM = haversineM(origin.lat, origin.lon, permit.lat, permit.lon);
    if (distanceM > radiusM) continue;
    // A CERTIFICAT D'URBANISME IS NOT AN AUTHORISATION. It is an information
    // note stating what the rules would allow on a parcel; nothing may be
    // built on one. Only Bordeaux publishes them — 174 662 of its 309 094
    // rows, measured 2026-09-02 — and keeping them would make that one
    // métropole look three times busier than Paris for a category no other
    // source here has, while displacing real permits under `ADS_MAX_PERMITS`.
    // They are counted and reported rather than silently dropped, so the
    // exclusion is a stated editorial line and not a missing number.
    if (permit.kind === 'CU') { certificates += 1; continue; }
    near.push({ ...permit, distanceM: Math.round(distanceM) });
  }
  near.sort((a, b) => a.distanceM - b.distanceM);
  const kept = near.slice(0, ADS_MAX_PERMITS);
  const { permits: drawn, emprises } = liftEmprises(kept);

  const byKind = {};
  const byState = {};
  let housing = 0;
  let underInstruction = 0;
  for (const permit of drawn) {
    byKind[permit.kind] = (byKind[permit.kind] ?? 0) + 1;
    if (permit.state) byState[permit.state] = (byState[permit.state] ?? 0) + 1;
    if (Number.isFinite(permit.housing)) housing += permit.housing;
    if (permit.state === 'instruction') underInstruction += 1;
  }

  return {
    origin,
    radiusM,
    permits: drawn,
    // One entry per PLOT, not per dossier — see `liftEmprises`.
    emprises,
    summary: {
      count: drawn.length,
      // The gap between these two is the honesty of the radius: a truncated
      // scan is a scan that stopped, not a block with fewer permits on it.
      found: near.length,
      truncated: near.length > kept.length,
      byKind,
      byState,
      housing,
      underInstruction,
      // Excluded from the map on purpose; see the loop above. A portal asked
      // to leave them out upstream answers with a COUNT instead of rows, and
      // that count is added to whatever the loop still saw — the loop can only
      // count what was fetched. Null, not zero, when the count was asked for
      // and did not come back: "there are none here" and "nobody answered" are
      // different sentences and the card prints one of them.
      certificates: certificateTally(certificates, context),
      // How much of the block the layer can actually outline. The gap between
      // this and `count` is Sitadel, Paris and Nantes, none of which publish a
      // shape — it is a property of the registers, not of the block.
      empriseCount: emprises.length,
      withEmprise: drawn.filter((permit) => permit.empriseId !== null).length,
    },
    ...context,
    source: ADS_SOURCE,
  };
}
