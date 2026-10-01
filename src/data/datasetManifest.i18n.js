/**
 * Strings of src/data/datasetManifest.js — every fault a manifest can have,
 * and the two labels the manifest itself does not carry.
 *
 * A FAULT IS A SENTENCE ADDRESSED TO SOMEBODY WHO CAN FIX IT. The plug panel
 * prints the first one under the field (“À compléter : …” / “To complete: …”),
 * `npm run dataset:manifest` prints them all, and `datasetsCatalog.test.mjs`
 * fails a shipped file by naming them. So each one says the exact key and what
 * that key must hold — never “invalid”. The words match `docs/DATASETS.md`,
 * which is the English contract for the same schema.
 *
 * Keys, JSON paths, source kinds and EPSG codes inside these are the schema's
 * own and are never translated. What moves between the languages is the
 * requirement, and the colon: French keeps its space before it.
 *
 * See docs/i18n/CONVENTIONS.md.
 */
import { defineMessages } from '../i18n/messages.js';

export default defineMessages({
  notAnObject: {
    fr: 'le manifeste doit être un objet',
    en: 'the manifest must be an object',
  },
  missing: {
    fr: (path) => `\`${path}\` manquant`,
    en: (path) => `\`${path}\` missing`,
    note: 'The one fault shape with no requirement to state: the key is simply absent.',
    sample: ['label'],
  },
  oneOf: {
    fr: (path, values) => `\`${path}\` : ${values}`,
    en: (path, values) => `\`${path}\`: ${values}`,
    note: 'An enumeration prints its own values (`live | periodic | static`); '
      + 'there is nothing to translate but the colon.',
    sample: ['cadence', 'live | periodic | static'],
  },

  /** Identity, looks and group. */
  head: {
    id: {
      fr: '`id` : minuscules, chiffres et tirets, 2 à 63 caractères',
      en: '`id`: lowercase, digits and hyphens, 2 to 63 characters',
    },
    labelTooLong: {
      fr: '`label` : 64 caractères au plus',
      en: '`label`: 64 characters at most',
    },
    name: {
      fr: '`name` : chaîne non vide si présent',
      en: '`name`: a non-empty string when present',
    },
    icon: {
      fr: '`icon` : un glyphe (4 caractères au plus)',
      en: '`icon`: one glyph (4 characters at most)',
    },
    color: {
      fr: '`color` : couleur hexadécimale #rrggbb',
      en: '`color`: hexadecimal color #rrggbb',
    },
    category: {
      fr: '`category` : identifiant de groupe (minuscules et tirets)',
      en: '`category`: a group id (lowercase and hyphens)',
    },
    refreshMs: {
      fr: '`refreshMs` : entier ≥ 0 (0 = jamais)',
      en: '`refreshMs`: integer ≥ 0 (0 = never)',
    },
  },

  /** The block that makes this dataset a chip on somebody else's row. */
  fusion: {
    object: {
      fr: '`fusion` : objet { into, chip }',
      en: '`fusion`: an object { into, chip }',
    },
    into: {
      fr: '`fusion.into` : identifiant de la couche hôte',
      en: '`fusion.into`: the id of the host layer',
    },
    chip: {
      fr: '`fusion.chip` : libellé de la puce',
      en: '`fusion.chip`: the chip’s label',
    },
    chipTooLong: {
      fr: (max) => `\`fusion.chip\` : ${max} caractères au plus`,
      en: (max) => `\`fusion.chip\`: ${max} characters at most`,
      sample: [24],
    },
    title: {
      fr: '`fusion.title` : chaîne non vide si présent',
      en: '`fusion.title`: a non-empty string when present',
    },
    optIn: {
      fr: '`fusion.optIn` : booléen',
      en: '`fusion.optIn`: a boolean',
    },
    intoSelf: {
      fr: '`fusion.into` : une couche ne peut pas se fusionner dans elle-même',
      en: '`fusion.into`: a layer cannot fuse into itself',
    },
  },

  /** Where the rows are and how to ask for them. */
  source: {
    resourceId: {
      fr: '`source.resourceId` : identifiant de ressource data.gouv.fr (UUID)',
      en: '`source.resourceId`: a data.gouv.fr resource id (UUID)',
    },
    url: {
      fr: '`source.url` : URL http(s)',
      en: '`source.url`: an http or https URL',
      note: 'Spelled out rather than “http(s)”: the English plural rule reads a bare '
        + '“(s)” as an unchosen plural, and here it is a scheme name.',
    },
    typeName: {
      fr: '`source.typeName` : nom de la couche WFS (ex. BDTOPO_V3:aerodrome)',
      en: '`source.typeName`: the WFS layer name (e.g. BDTOPO_V3:aerodrome)',
    },
    dataset: {
      fr: '`source.dataset` : identifiant du jeu Opendatasoft',
      en: '`source.dataset`: the Opendatasoft dataset id',
    },
    geoField: {
      fr: '`source.geoField` : nom du champ géographique',
      en: '`source.geoField`: the name of the geographic field',
    },
    delimiter: {
      fr: '`source.delimiter` : un caractère',
      en: '`source.delimiter`: one character',
    },
    viewportScope: {
      fr: (kinds) => `\`source.scope\` viewport : réservé à ${kinds}`,
      en: (kinds) => `\`source.scope\` viewport: only for ${kinds}`,
      note: 'Only three platforms can answer to a bounding box.',
      sample: ['datagouv, wfs, opendatasoft'],
    },
    maxFeatures: {
      fr: (ceiling) => `\`source.maxFeatures\` : entier entre 1 et ${ceiling}`,
      en: (ceiling) => `\`source.maxFeatures\`: an integer between 1 and ${ceiling}`,
      sample: [30000],
    },
    maxSpanDeg: {
      fr: '`source.maxSpanDeg` : nombre entre 0 et 90',
      en: '`source.maxSpanDeg`: a number between 0 and 90',
    },
    columns: {
      fr: '`source.columns` : liste de noms de colonnes',
      en: '`source.columns`: a list of column names',
    },
  },

  /** How a row becomes a point. */
  geometry: {
    required: {
      fr: '`geometry` : une source tabulaire doit dire comment une ligne devient un point ({lon,lat} | {point} | {wkt} | {x,y,crs} | {geojson})',
      en: '`geometry`: a tabular source must say how a row becomes a point ({lon,lat} | {point} | {wkt} | {x,y,crs} | {geojson})',
    },
    object: {
      fr: '`geometry` : objet',
      en: '`geometry`: an object',
    },
    crsRequired: {
      fr: '`geometry.crs` : code EPSG (ex. EPSG:2154) obligatoire avec x/y',
      en: '`geometry.crs`: an EPSG code (e.g. EPSG:2154), required with x/y',
    },
    crsUnsupported: {
      fr: '`geometry.crs` : seuls EPSG:2154 (Lambert-93) et EPSG:4326 sont reprojetés',
      en: '`geometry.crs`: only EPSG:2154 (Lambert-93) and EPSG:4326 are reprojected',
    },
  },

  /** What a mark says when it is read. */
  feature: {
    object: {
      fr: '`feature` : objet',
      en: '`feature`: an object',
    },
    title: {
      fr: '`feature.title` : liste de champs, le premier non vide fait le titre',
      en: '`feature.title`: a list of fields, the first non-empty one makes the title',
    },
    blank: {
      fr: '`feature.blank` : liste des écritures qui veulent dire « non renseigné »',
      en: '`feature.blank`: the list of spellings that mean “not filled in”',
      note: 'The register’s own ways of saying it does not know, so a line that would '
        + 'say only that is not written at all.',
    },
    detailsTooMany: {
      fr: (max) => `\`feature.details\` : liste de ${max} lignes au plus`,
      en: (max) => `\`feature.details\`: a list of ${max} lines at most`,
      sample: [8],
    },
    detail: {
      fr: (index, formats) => `\`feature.details[${index}]\` : "champ" ou {field, label?, unit?, format? (${formats}), omitWhen?}`,
      en: (index, formats) => `\`feature.details[${index}]\`: "field" or {field, label?, unit?, format? (${formats}), omitWhen?}`,
      sample: [2, 'list|days'],
    },
  },

  /** One color per value, or an ordered list of rules. */
  group: {
    object: {
      fr: '`feature.group` : objet',
      en: '`feature.group`: an object',
    },
    bothForms: {
      fr: '`feature.group` : `rules` ou `field`/`styles`, pas les deux',
      en: '`feature.group`: `rules` or `field`/`styles`, not both',
    },
    rulesEmpty: {
      fr: '`feature.group.rules` : au moins une règle { key, color, label?, when }',
      en: '`feature.group.rules`: at least one rule { key, color, label?, when }',
    },
    ruleObject: {
      fr: (index) => `\`feature.group.rules[${index}]\` : objet { key, color, label?, when }`,
      en: (index) => `\`feature.group.rules[${index}]\`: an object { key, color, label?, when }`,
      sample: [0],
    },
    ruleKey: {
      fr: (index, reserved) => `\`feature.group.rules[${index}].key\` : identifiant non vide, « ${reserved} » réservé`,
      en: (index, reserved) => `\`feature.group.rules[${index}].key\`: a non-empty id, “${reserved}” is reserved`,
      sample: [0, '__other__'],
    },
    ruleKeyDuplicate: {
      fr: (index, key) => `\`feature.group.rules[${index}].key\` : « ${key} » en double`,
      en: (index, key) => `\`feature.group.rules[${index}].key\`: “${key}” is a duplicate`,
      sample: [1, 'h24'],
    },
    ruleColor: {
      fr: (index) => `\`feature.group.rules[${index}].color\` : couleur hexadécimale #rrggbb`,
      en: (index) => `\`feature.group.rules[${index}].color\`: hexadecimal color #rrggbb`,
      sample: [0],
    },
    ruleLabel: {
      fr: (index) => `\`feature.group.rules[${index}].label\` : chaîne non vide`,
      en: (index) => `\`feature.group.rules[${index}].label\`: a non-empty string`,
      sample: [0],
    },
    ruleWhen: {
      fr: (index) => `\`feature.group.rules[${index}].when\` : { champ: [valeurs acceptées] }`,
      en: (index) => `\`feature.group.rules[${index}].when\`: { field: [accepted values] }`,
      sample: [0],
    },
    ruleWhenField: {
      fr: (index, field) => `\`feature.group.rules[${index}].when["${field}"]\` : liste de valeurs non vides`,
      en: (index, field) => `\`feature.group.rules[${index}].when["${field}"]\`: a list of non-empty values`,
      sample: [0, 'c_dispo_horaires'],
    },
    field: {
      fr: '`feature.group.field` : champ de classement',
      en: '`feature.group.field`: the field to classify on',
    },
    stylesEmpty: {
      fr: '`feature.group.styles` : au moins une valeur { color, label? }',
      en: '`feature.group.styles`: at least one value { color, label? }',
    },
    style: {
      fr: (value) => `\`feature.group.styles["${value}"]\` : { color: #rrggbb, label? }`,
      en: (value) => `\`feature.group.styles["${value}"]\`: { color: #rrggbb, label? }`,
      sample: ['outdoor'],
    },
    other: {
      fr: '`feature.group.other` : { color: #rrggbb, label? }',
      en: '`feature.group.other`: { color: #rrggbb, label? }',
    },
    /** What an unclaimed row is called in the legend when the manifest says nothing. */
    otherLabel: { fr: 'Autre', en: 'Other' },
  },

  /** The row's chips. */
  filters: {
    list: {
      fr: '`feature.filters` : liste de puces { id, label, groups? }',
      en: '`feature.filters`: a list of chips { id, label, groups? }',
    },
    tooMany: {
      fr: (max) => `\`feature.filters\` : ${max} puces au plus`,
      en: (max) => `\`feature.filters\`: ${max} chips at most`,
      sample: [5],
    },
    nothingToFilter: {
      fr: '`feature.filters` : sans `feature.group`, une puce n\'a rien à filtrer',
      en: '`feature.filters`: without `feature.group`, a chip has nothing to filter',
    },
    object: {
      fr: (index) => `\`feature.filters[${index}]\` : objet { id, label, groups? }`,
      en: (index) => `\`feature.filters[${index}]\`: an object { id, label, groups? }`,
      sample: [0],
    },
    id: {
      fr: (index) => `\`feature.filters[${index}].id\` : minuscules, chiffres et tirets`,
      en: (index) => `\`feature.filters[${index}].id\`: lowercase, digits and hyphens`,
      sample: [0],
    },
    idDuplicate: {
      fr: (index, id) => `\`feature.filters[${index}].id\` : « ${id} » en double`,
      en: (index, id) => `\`feature.filters[${index}].id\`: “${id}” is a duplicate`,
      sample: [1, 'all'],
    },
    labelMissing: {
      fr: (index) => `\`feature.filters[${index}].label\` manquant`,
      en: (index) => `\`feature.filters[${index}].label\` missing`,
      sample: [0],
    },
    title: {
      fr: (index) => `\`feature.filters[${index}].title\` : chaîne non vide`,
      en: (index) => `\`feature.filters[${index}].title\`: a non-empty string`,
      sample: [0],
    },
    groups: {
      fr: (index) => `\`feature.filters[${index}].groups\` : liste de clés de groupe`,
      en: (index) => `\`feature.filters[${index}].groups\`: a list of group keys`,
      sample: [0],
    },
    groupUnknown: {
      fr: (index, key) => `\`feature.filters[${index}].groups\` : groupe « ${key} » inconnu`,
      en: (index, key) => `\`feature.filters[${index}].groups\`: unknown group “${key}”`,
      sample: [1, 'dehors'],
    },
    needsEverything: {
      fr: '`feature.filters` : une puce sans `groups` est le retour à « tout »',
      en: '`feature.filters`: a chip without `groups` is the way back to “all”',
    },
  },

  /** Who to thank, and under which terms. */
  attribution: {
    missing: {
      fr: '`attribution` manquant — un jeu sans éditeur ni licence ne s\'affiche pas',
      en: '`attribution` missing — a dataset with no publisher and no license is not shown',
    },
    url: {
      fr: '`attribution.url` : URL http(s)',
      en: '`attribution.url`: an http or https URL',
    },
    text: {
      fr: '`attribution.text` : chaîne non vide',
      en: '`attribution.text`: a non-empty string',
    },
  },

  /** The credit line, when the manifest did not write one itself. */
  credit: {
    fr: (label, publisher, licence) => `${label} : ${publisher} (${licence})`,
    en: (label, publisher, licence) => `${label}: ${publisher} (${licence})`,
    note: 'Publisher and license are the manifest’s own words and stay as written.',
    sample: ['Defibrillators (GeoDAE)', 'Atlasanté — GeoDAE', 'Licence Ouverte 2.0'],
    keep: ['Atlasanté', 'Licence Ouverte'],
  },
});
