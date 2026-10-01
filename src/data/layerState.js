const VALID_DISPOSITIONS = new Set([
  'enabled-only',
  'enabled+options',
  'enabled+mirrored-options',
]);

export const LAYER_STATE_VERSION = 2;
/** Re-check cadence while a shared subject waits for its feed row to arrive. */
const PENDING_TRACKING_POLL_MS = 1_000;
/**
 * A tracking ID is a transponder address, not free text: 6 hex digits for an
 * ICAO24, with slack for TIS-B (`~abc123`) and similar prefixed forms. Bounding
 * it at the codec keeps an arbitrarily long string out of durable state, the
 * generated URL, and local storage. Identity is never TRUNCATED to fit — an
 * out-of-grammar ID is rejected outright, because half an address is a
 * DIFFERENT aircraft, not a shorter name for the same one.
 */
const TRACKING_ID_GRAMMAR = /^[0-9a-z~_-]{1,16}$/;
/**
 * Ceilings for the untrusted v2 layer fields. Both are far above any legitimate
 * payload, so a value past them is malformed or hostile. Reject the WHOLE
 * payload, matching the unknown-token rule — never salvage a prefix.
 *
 * 64 WAS NOT ABOVE A LEGITIMATE PAYLOAD ANY MORE, and had quietly stopped
 * being so before this branch touched it: the comment was written against 16
 * layers, and at 35 the everything-on link was already 69 characters. A user
 * who turned on every layer and shared the result got a link that decoded to
 * `null` — the failure the ceiling exists to produce, aimed at the one payload
 * it should never fire on. 40 two-character tokens and their separators is
 * 119, so the number is now DERIVED from the registry with room to grow, and
 * `layerState.test.mjs` asserts the whole registry still fits rather than
 * leaving the next person to find out by sharing a link.
 */
const MAX_ENABLED_LAYERS_CHARS = 256;
const MAX_LAYER_OPTIONS_CHARS = 512;
export const LAYER_STATE_STORAGE_KEY = 'gev:layer-state:v2';
export const LAYER_RESTORE_ORIGINS = Object.freeze({
  share: 'share-restore',
  local: 'local-restore',
  defaults: 'default-restore',
});

/**
 * The layers a reader who has never chosen anything arrives with.
 *
 * ── Why the globe is not empty any more ───────────────────────────────────
 * Until now every boot with no share link and no stored session put the
 * reader on a photographic city with nothing happening on it, and the product
 * only became itself on their first toggle. The first thing a visitor should
 * see is the thing they came for: a city that is alive.
 *
 * ── Why THIS layer, and only this one ─────────────────────────────────────
 * Traffic is the only layer that is legible at the altitude the boot flight
 * lands on, moves on its own so the picture reads as live within a second,
 * and costs the SAME upstream request however many readers arrive — the
 * Overpass box is one cache cell for the whole default view
 * (`tierFetchBox`, and `scripts/qa-span-par-viewport.mjs` measures it at one
 * key across eleven window sizes), and TomTom's flow tiles are shared behind
 * a 120 s proxy TTL. A second default layer would be a second cold fetch on a
 * thread that has just finished landing an animation.
 *
 * ── What this cost before it was allowed ──────────────────────────────────
 * A layer that is on before the reader arrives works THROUGH the boot flight,
 * and that was measured to take the arrival from 6.4–6.8 s to 25.5–27.2 s
 * (`scripts/qa-traffic-boot.mjs`). `src/bootFlight.js` is what makes this
 * affordable: the layer waits out the descent and loads onto the parked view,
 * which is both the view the reader looks at and the one whose Overpass
 * answer is already warm. Re-measured with the gate in place, the arrival is
 * indistinguishable from an empty one.
 *
 * ── What it must never override ───────────────────────────────────────────
 * A default is not a preference. It applies only when there is no share state
 * AND no stored session, so a reader who switched traffic off keeps it off,
 * and a share link shows exactly what its sender framed — including a link
 * with no layers at all. See `start()`.
 */
export const DEFAULT_ENABLED_LAYER_IDS = Object.freeze(['traffic']);

const RADIO_FILTER_CODES = Object.freeze({
  all: 'a',
  news: 'n',
  talk: 't',
  weather: 'w',
  'public-safety': 'p',
  'aviation-marine': 'v',
  'traffic-transit': 'x',
  music: 'm',
  other: 'o',
});
const RADIO_CODE_FILTERS = Object.freeze(
  Object.fromEntries(Object.entries(RADIO_FILTER_CODES).map(([key, value]) => [value, key])),
);

function normalizeBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

function normalizeEnum(values, value) {
  return values.includes(value) ? value : null;
}

export function normalizeRadioFilter(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (Object.hasOwn(RADIO_FILTER_CODES, normalized)) return normalized;
  if (/^genre:[a-z0-9][a-z0-9 &-]{0,31}$/.test(normalized)) return normalized;
  return null;
}

function encodeRadioFilter(value) {
  return RADIO_FILTER_CODES[value] || `g-${value.slice('genre:'.length)}`;
}

function decodeRadioFilter(value) {
  if (Object.hasOwn(RADIO_CODE_FILTERS, value)) return RADIO_CODE_FILTERS[value];
  if (/^g-[a-z0-9][a-z0-9 &-]{0,31}$/.test(value)) return `genre:${value.slice(2)}`;
  return null;
}

function normalizeVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(Math.max(0, Math.min(1, numeric)) * 100) / 100;
}

function booleanOption(key, token, defaultValue, { absentValue = defaultValue } = {}) {
  return Object.freeze({
    key,
    token,
    defaultValue,
    absentValue,
    normalize: normalizeBoolean,
    encode: (value) => (value ? '1' : '0'),
    decode: (value) => (value === '1' ? true : value === '0' ? false : null),
  });
}

/**
 * What an ABSENT token means for this option inside the CURRENT schema version.
 *
 * Usually that is simply the default: the encoder omits default-valued fields to
 * keep the URL short and the decoder fills the default back in. But a DEFAULT CAN
 * MOVE while the schema version does not, and every link already in the wild was
 * authored under the old one. `absentValue` is that frozen historical meaning —
 * what an omitted token meant when links like it were being written — so a
 * default flip cannot silently rewrite what an existing link SAYS. A share link
 * is authored state; the only honest reading of `v=2&l=f` is the one its author
 * saw.
 *
 * The consequence is not cosmetic: once `absentValue` and `defaultValue` differ,
 * the NEW default has to be emitted EXPLICITLY, or one omission would mean two
 * different things inside a single schema version. Both sides of the codec read
 * this function so they cannot disagree about which it is.
 *
 * (This is the same rule `scf` follows in sharelink.js by hand. `models3d` is the
 * first option in THIS codec to need it — flipped to default-ON on 2026-08-22.)
 */
function absentTokenValue(spec) {
  return Object.hasOwn(spec, 'absentValue') ? spec.absentValue : spec.defaultValue;
}

function trackingIdOption(key, token, defaultValue = null) {
  const bounded = (candidate) => {
    if (candidate === null || candidate === undefined) return null;
    const raw = typeof candidate === 'number' && Number.isFinite(candidate)
      ? String(candidate)
      : (typeof candidate === 'string' ? candidate : null);
    if (raw === null) return null;
    const normalized = raw.trim().toLowerCase();
    return TRACKING_ID_GRAMMAR.test(normalized) ? normalized : null;
  };
  return Object.freeze({
    key,
    token,
    defaultValue,
    normalize: bounded,
    encode: (value) => String(value),
    decode: bounded,
  });
}

function stringOption(key, token, defaultValue) {
  return Object.freeze({
    key,
    token,
    defaultValue,
    normalize: (value) => {
      if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim().toLowerCase();
      if (typeof value !== 'string') return null;
      const normalized = value.trim().toLowerCase();
      return normalized ? normalized : null;
    },
    encode: (value) => String(value),
    decode: (value) => (typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null),
  });
}

/**
 * `retired` maps the code of a value the option no longer offers to the value a
 * link carrying it now opens on. Decode-only: nothing writes a retired code, and
 * a code stays retired forever, so a new value never reuses one.
 */
function enumOption(key, token, defaultValue, values, codes, retired = {}) {
  const reverse = Object.fromEntries(Object.entries(codes).map(([name, code]) => [code, name]));
  return Object.freeze({
    key,
    token,
    defaultValue,
    normalize: (value) => normalizeEnum(values, value),
    encode: (value) => codes[value],
    decode: (value) => reverse[value] || retired[value] || null,
  });
}

/**
 * A SET of enum members, encoded as one compact token string.
 *
 * Written for « Équipements du quotidien », whose reader can switch any of
 * thirteen families on or off. The obvious encodings both fail: a comma list of
 * names is 90 characters in a field with a 512-character ceiling shared by
 * every layer, and a bitmask is unreadable and breaks the moment the vocabulary
 * gains a member.
 *
 * So each member gets a one-character code and the set is their concatenation —
 * `familles=boulangerie,pharmacie` travels as `bp`. The codes are FROZEN from
 * the moment the first link carrying one is copied, which is why they are
 * declared here beside every other frozen token rather than derived from the
 * family names.
 *
 * The default is the EMPTY set, meaning "no filter, draw everything". A link
 * therefore carries this field only when a reader actually filtered something,
 * and a full selection normalises back to empty so the two ways of saying "all"
 * cannot produce two different links.
 */
function enumSetOption(key, token, values, codes) {
  const reverse = Object.fromEntries(Object.entries(codes).map(([name, code]) => [code, name]));
  const canonical = (names) => values.filter((value) => names.includes(value));
  return Object.freeze({
    key,
    token,
    defaultValue: '',
    normalize: (value) => {
      if (value === null || value === undefined) return null;
      const names = (Array.isArray(value) ? value : String(value).split(','))
        .map((name) => String(name).trim().toLowerCase())
        .filter((name) => values.includes(name));
      const picked = canonical(names);
      // Everything selected IS no filter. Folding the two together here means
      // `getParams()` and the link can never disagree about which state a
      // fully-lit key is in.
      return picked.length === values.length ? '' : picked.join(',');
    },
    encode: (value) => canonical(String(value).split(',')).map((name) => codes[name]).join(''),
    decode: (value) => {
      const names = String(value).split('').map((code) => reverse[code]).filter(Boolean);
      const picked = canonical(names);
      return picked.length && picked.length < values.length ? picked.join(',') : null;
    },
  });
}

function integerOption(key, token, defaultValue) {
  return Object.freeze({
    key,
    token,
    defaultValue,
    normalize: (value) => {
      if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
      const candidate = typeof value === 'string' ? value.trim() : '';
      const parsed = Number(candidate);
      if (!candidate || !Number.isInteger(parsed) || parsed <= 0) return null;
      return parsed;
    },
    encode: (value) => String(Math.trunc(value)),
    decode: (value) => {
      const candidate = Number(value);
      if (!Number.isInteger(candidate) || candidate <= 0) return null;
      return candidate;
    },
  });
}

const OPTION_GROUPS = Object.freeze({
  flights: Object.freeze([
    // Product invariant 2026-08-22: the fleet's 3D models are DEFAULT-ON in
    // PROXIMITY mode. Proximity is itself the altitude/count gate — models only
    // materialize once the camera is close enough and only for the nearest
    // contacts in view — so "on" costs nothing at globe scale, and an operator
    // who wants every in-view plane still opts into `all` deliberately.
    // This default must stay in lockstep with `_models3dEnabled` in BOTH flight
    // layers, `this._models3dEnabled` in ui.js, and the `active` / `visible`
    // classes in index.html: the fresh-boot path skips restoration entirely (see
    // `start()` below), so nothing ever pushes this value into the layers — those
    // four initializers ARE the agreement, and they are pinned together in
    // layerState.test.mjs.
    //
    // `absentValue: false` is what keeps the flip out of links already in the
    // wild. Schema v2 shipped with OFF as the omitted default, so `v=2&l=f`
    // MEANS off — and it has to keep meaning that. Moving the default without
    // this would have silently turned 3D on for every existing v2 link, and
    // `v=2&l=f&lo=f.m.a` (an OFF link that remembered mode All) would have come
    // back as ON+All. The price is that ON is now written explicitly (`f.e.1`)
    // instead of ridden in on the omission; see `absentTokenValue`.
    booleanOption('models3d', 'e', true, { absentValue: false }),
    enumOption('models3dMode', 'm', 'proximity', ['proximity', 'all'], {
      proximity: 'p',
      all: 'a',
    }),
    trackingIdOption('selectedFlightsTrackingId', 't', null),
    trackingIdOption('selectedMilitaryTrackingId', 'u', null),
  ]),
  // The permit window, and the FIRST option on any of the six address layers.
  // It is here rather than in the layer because a window is a question, and a
  // link that reopens the same block on a different question is a different
  // answer — `au.w.1` is the whole of "this street, over the last year".
  //
  // The codes are the years and not the months: `1`, `3`, `d` for the whole
  // register, and `h` for the half year, chosen so a link stays legible to the
  // person pasting it. The months are what the layer and the proxy speak, and
  // `adsUrbanisme.js` owns the mapping.
  //
  // `6` was six years until 2026-10-01, when the half year and the year took
  // its place. A link written before opens on the whole register — the window
  // that still holds every permit its author saw — and `6` is never handed to
  // another window.
  //
  // Keyed by the LAYER ID and not by a family name: `encodeLayerStateParams`
  // looks the owner up in the layer registry to find the token it writes into
  // the link, so an owner that is not a registered layer id throws at boot.
  'ads-fr': Object.freeze([
    enumOption('months', 'w', '36', ['6', '12', '36', '156'], { 6: 'h', 12: '1', 36: '3', 156: 'd' },
      // Retired CODE → months: `au.w.6` (six years) opens on the whole register.
      { '6': '156' }),
  ]),
  // WHICH COVERAGE THE GROUND UNDER THE MASTS IS PAINTED WITH — the ARCEP's
  // 4G map, counted (`z`, the dead zones) or one operator's own levels. It is
  // what the map says, not a preference: the same masts over Orange's gaps and
  // over the dead zones are two different arguments. One letter each, frozen
  // from the first link copied; the values are `mobileCoverage.js`'s modes.
  //
  // AND WHETHER THE MASTS ARE ON IT (`m`), since the coverage has a tile of
  // its own in the key (2026-09-22): the dead zones read with no dot over them
  // are a third argument. Omitted while the masts are drawn, which is every
  // link written before it.
  'anfr-fr': Object.freeze([
    enumOption('coverage', 'c', 'off', ['off', 'gaps', 'orange', 'sfr', 'bouygues', 'free'], {
      off: '0',
      gaps: 'z',
      orange: 'o',
      sfr: 's',
      bouygues: 'b',
      free: 'f',
    }),
    booleanOption('masts', 'm', true),
  ]),
  // THE SUBJECT OF THE ESTIMATE, and it has to travel. `a 60 m² flat here` and
  // `a 150 m² house here` are two different numbers over one doorway, and a
  // link that dropped either token would reopen the right address under the
  // wrong headline — the same failure `filosofi-fr` describes for its
  // indicator, with a price on it.
  //
  // The surface codes are the size class and not the number (`s`, `m`, `l`,
  // `x`), because they are frozen the moment the first link is copied and a
  // future 45 m² anchor must not have to renumber the ones already sent. The
  // CENTRE is deliberately absent: every option in this file is an enum, a
  // pinned coordinate is not, and a link that carried one would also have to
  // carry the promise that the pin still means the same thing — so a shared
  // link reopens following the camera, on the view its sender was looking at.
  // WHICH MUTATIONS ARE ON THE MAP. It travels for the same reason the
  // estimate's subject does: « les appartements autour d'ici » and « tout ce
  // qui s'est vendu autour d'ici » are two different maps of one doorway, and
  // a link that dropped the token would reopen the right street showing a
  // population its sender never looked at. One letter each, frozen from the
  // first link copied.
  // i18n-ignore-start — DATA, not labels: `tous` is a share-link value and
  // `Appartement` / `Maison` are DVF's own `type_local`, which travel in the
  // URL and are matched against the register. Their DISPLAY is translated
  // where they are drawn (`labelFor`, see docs/i18n/CONVENTIONS.md § 4); here
  // a translation would break every link ever copied.
  'dvf-sales': Object.freeze([
    enumOption('type', 't', 'tous', ['tous', 'Appartement', 'Maison'], { tous: 't', Appartement: 'a', Maison: 'm' }),
  ]),
  'avis-valeur': Object.freeze([
    enumOption('type', 't', 'Appartement', ['Appartement', 'Maison'], { Appartement: 'a', Maison: 'm' }),
    enumOption('surface', 's', '60', ['30', '60', '100', '150'], { 30: 's', 60: 'm', 100: 'l', 150: 'x' }),
  ]),
  // i18n-ignore-end
  satellites: Object.freeze([
    enumOption('catalog', 'c', 'core', ['core', 'dense'], { core: 'c', dense: 'd' }),
    integerOption('selectedSatTrackingId', 't', null),
  ]),
  // WHICH INDICATOR THE CARROYAGE IS COLOURED BY. Serialized because it is not
  // a preference, it is what the map SAYS: the same 146 squares over Lyon are a
  // wealth map, a poverty map or an age map depending on this one token, and a
  // share link that dropped it would send the reader a different argument than
  // the one that was shared. One letter each, and the codes are frozen — they
  // are in URLs the moment the first link is copied, so renaming `n` later
  // would silently re-colour every link already sent.
  // Keyed by the LAYER ID, not by a friendly name: `encodeLayerStateParams`
  // resolves the owner's share token with `REGISTRY_BY_ID.get(ownerId)`, so an
  // owner that is not itself a registered layer id resolves to undefined and
  // the encoder throws the moment a non-default option is set. Every other
  // group here — `flights`, `satellites`, `cctv`, `radio` — is a layer id for
  // exactly this reason.
  // WHICH RING the fiche is computed on. Serialized because the number on the
  // card is a function of it: "9 700 habitants" at ten minutes and at fifteen
  // are two different claims about the same door, and a link that dropped the
  // duration would restore the wrong one under the right headline.
  'implantation-fr': Object.freeze([
    enumOption('seconds', 's', 600, [300, 600, 900], { 300: '5', 600: '0', 900: '9' }),
  ]),
  // `now` is the DEFAULT and it is deliberately not frozen in time: it means
  // "the hour of the week it currently is", so a link shared on a Tuesday
  // morning opens on a Tuesday morning for its reader too, whenever they read
  // it. Only `week` and `peak` are absolute states, and both encode.
  // The thirteen families the key can switch. One character each, frozen:
  // `r`estaurant, `b`oulangerie, `c`ommerce, `m`édecin, ban`q`ue, `s`port,
  // c`u`lture, c`o`urses, `p`harmacie, pos`t`e, carbura`n`t, `g`endarmerie,
  // p`i`scine. `hopital` has no code because this layer does not draw it — see
  // `AMENITIES_WITHDRAWN_FAMILIES` — and giving a withdrawn family a share
  // token would let an old link ask for a mark that can never appear.
  'amenities-fr': Object.freeze([
    // i18n-ignore-start — the family keys the pack and the link use, not words
    // on screen: the amenities layer draws them through its own labels.
    enumSetOption('familles', 'f', [
      'restaurant', 'boulangerie', 'commerce', 'medecin', 'banque', 'sport',
      'culture', 'courses', 'pharmacie', 'poste', 'carburant', 'gendarmerie',
      'piscine',
      // i18n-ignore-end
    ], {
      restaurant: 'r',
      boulangerie: 'b',
      commerce: 'c',
      medecin: 'm',
      banque: 'q',
      sport: 's',
      culture: 'u',
      courses: 'o',
      pharmacie: 'p',
      poste: 't',
      carburant: 'n',
      gendarmerie: 'g',
      piscine: 'i',
    }),
  ]),
  'velo-pulse-fr': Object.freeze([
    enumOption('mode', 'm', 'now', ['now', 'week', 'peak'], { now: 'n', week: 'w', peak: 'p' }),
  ]),
  // All three modes the layer can MEASURE. `bike` joined the enum on
  // 2026-09-02, when cycling stopped being an unanswerable question: IGN still
  // rejects the profile, so a cycling ring is measured on the OSM cycling
  // network instead and comes back flagged as an envelope. The token is `b`,
  // and it is frozen from the moment the first link carrying it is copied.
  //
  // The centre is deliberately NOT here. A pinned centre is a coordinate, every
  // option in this file is an enum, and a link that carried a pin would also
  // have to carry the promise that the same pin still means the same thing —
  // so a shared link reopens following the camera, which lands on the view the
  // sender was looking at anyway.
  //
  // `max` and `view` joined on 2026-09-24 with the approved mock: how far the
  // drawing goes (« Durée maximale ») and whether the zones are washed or only
  // outlined (« Vue »). Both are drawing choices over the same three measured
  // rings, and a link that carries them reopens the picture its sender saw.
  'isochrone-fr': Object.freeze([
    enumOption('profile', 'p', 'foot', ['foot', 'car', 'bike'], { foot: 'f', car: 'c', bike: 'b' }),
    enumOption('max', 'd', '15', ['5', '10', '15'], { 5: '5', 10: 'a', 15: 'f' }),
    enumOption('view', 'v', 'zones', ['zones', 'contours'], { zones: 'z', contours: 'c' }),
  ]),
  'filosofi-fr': Object.freeze([
    enumOption('metric', 'm', 'niveau', [
      'niveau', 'pauvrete', 'population', 'social',
      'jeunes', 'aines', 'proprietaires', 'solo',
    ], {
      niveau: 'n',
      pauvrete: 'p',
      population: 'h',
      social: 's',
      jeunes: 'j',
      aines: 'a',
      proprietaires: 'o',
      solo: '1',
    }),
  ]),
  cctv: Object.freeze([
    enumOption('coverageMode', 'c', 'on', ['off', 'on', 'viewshed'], {
      off: '0',
      on: '1',
      viewshed: 'v',
    }),
    booleanOption('showProjection', 'p', true),
    booleanOption('autoHop', 'a', false),
  ]),
  radio: Object.freeze([
    Object.freeze({
      key: 'filter',
      token: 'f',
      defaultValue: 'all',
      normalize: normalizeRadioFilter,
      encode: encodeRadioFilter,
      decode: decodeRadioFilter,
    }),
    Object.freeze({
      key: 'volume',
      token: 'v',
      defaultValue: 0.8,
      normalize: normalizeVolume,
      encode: (value) => String(Math.round(value * 100)),
      decode: (value) => (/^\d{1,3}$/.test(value) ? normalizeVolume(Number(value) / 100) : null),
    }),
  ]),
});

const TRACKING_OPTION_KEY_BY_LAYER = Object.freeze({
  flights: 'selectedFlightsTrackingId',
  military: 'selectedMilitaryTrackingId',
  satellites: 'selectedSatTrackingId',
});

// i18n-ignore-start — `label` here is a DIAGNOSTIC name for the restore log,
// in the vocabulary of the share link ("flight", "satellite"); nothing draws
// it, and the panel's own names come from the registry.
export const SHARE_TRACKING_RESTORE_POLICIES = Object.freeze({
  flights: Object.freeze({
    optionOwner: 'flights',
    optionKey: 'selectedFlightsTrackingId',
    expiryWindowMs: 90_000,
    label: 'flight',
  }),
  military: Object.freeze({
    optionOwner: 'flights',
    optionKey: 'selectedMilitaryTrackingId',
    expiryWindowMs: 45_000,
    label: 'military flight',
  }),
  satellites: Object.freeze({
    optionOwner: 'satellites',
    optionKey: 'selectedSatTrackingId',
    expiryWindowMs: 300_000,
    label: 'satellite',
  }),
});
// i18n-ignore-end

/**
 * Canonical serialization registry. Its order, not runtime registration order,
 * owns stable URL ordering.
 */
export const LAYER_STATE_REGISTRY = Object.freeze([
  // TWO CHARACTERS, in the space `sup-fr` and the five address layers opened.
  // `au` for *autorisations d'urbanisme*: `a` is AIS and `u` is the submarine
  // cables, and `ur` next door is the GPU/PLU layer this one sits beside —
  // near enough to read as a pair, distinct enough that a share link cannot
  // enable one for the other. A duplicate here is a BOOT failure
  // (`validateLayerStateRegistry` throws), not a review nit.
  // i18n-ignore-next-line — `au` is a two-character share token, not a word.
  Object.freeze({ id: 'ads-fr', token: 'au', disposition: 'enabled+options', optionOwner: 'ads-fr' }),
  Object.freeze({ id: 'ais-live-vessels', token: 'a', disposition: 'enabled-only' }),
  // A DIGIT for the same reason as `gas-fr` and `power-grid` below: every
  // letter is taken and `z` is the canonical UNKNOWN token two tests assert on.
  // `5` and not `4`: this branch claimed `4` while `fr-hydro-plants` claimed it
  // too on main, and the two only met at the merge. That is exactly the failure
  // the duplicate-token assertion exists to catch — a silent collision would
  // make one share link enable the wrong layer — so it is worth restating that
  // a duplicate here is a BOOT failure, not a review nit.
  // `bq` for base des équipements. `b` is bikeshare, `bz` is bruit-fr, and `be`
  // reads like a word; `bq` is unmistakable and unused.
  // `enabled+options` since 2026-09-15: the thirteen families are switchable
  // from the key, and a link that dropped the selection would reopen showing
  // twelve families the sender had turned off.
  Object.freeze({ id: 'amenities-fr', token: 'bq', disposition: 'enabled+options', optionOwner: 'amenities-fr' }),
  // `an` for ANFR. The agency's own initials; `a` is airports. The `radio`
  // layer next door is radio-browser.info AUDIO streams and shares nothing with
  // this but a word, which is exactly why the token had to be unmistakable.
  Object.freeze({ id: 'anfr-fr', token: 'an', disposition: 'enabled+options', optionOwner: 'anfr-fr' }),
  // `vv` for valeur vénale, and NOT the `av` this layer was first written
  // against. `av` is one character from `au` (ads-fr), the other layer about a
  // property dossier at the same doorway, and this file already records what a
  // near-collision costs: a share link that enabled the wrong one of two
  // adjacent property layers would look like it worked. `vv` cannot be
  // mistyped into anything claimed. `enabled+options` because the SUBJECT is
  // what the map claims — see the option group above.
  Object.freeze({ id: 'avis-valeur', token: 'vv', disposition: 'enabled+options', optionOwner: 'avis-valeur' }),
  Object.freeze({ id: 'bdtopo-buildings', token: '5', disposition: 'enabled-only' }),
  Object.freeze({ id: 'bikeshare', token: 'b', disposition: 'enabled-only' }),
  // TWO CHARACTERS, because the single-character scheme is spent: a-y are taken,
  // `z` is the canonical UNKNOWN token two existing tests assert on, and 0-9
  // belong to schools-fr, gas-fr, power-grid, rte-generation, fr-hydro-plants,
  // bdtopo-buildings, local-airports, road-status-fr, road-events-fr and
  // irve-fr. This branch had claimed `0` while `schools-fr` was claiming the
  // same character on main, which is exactly the silent collision the
  // duplicate-token assertion exists to catch — and it caught it, at the merge,
  // as a BOOT failure. `schools-fr` keeps `0` because it has already shipped
  // and links carrying it exist; the unshipped layer is the one that moves.
  // The field is dot-separated, so a wider token costs one character and needs
  // no codec change — `dp`, `dv`, `gr` and `if` already read this way.
  // `enabled-only`: the layer has no runtime option to serialize.
  // `bz` for bruit. `b` is bikeshare and `br` would collide with nothing today
  // but reads as an abbreviation of the word rather than a token; `bz` is the
  // one nobody will guess wrong.
  Object.freeze({ id: 'bruit-fr', token: 'bz', disposition: 'enabled-only' }),
  Object.freeze({ id: 'cadastre-fr', token: 'cd', disposition: 'enabled-only' }),
  Object.freeze({ id: 'cctv', token: 'c', disposition: 'enabled+options', optionOwner: 'cctv' }),
  // `cp` for comparables. `c` is cctv, `cd` is the cadastre and `cr` is the
  // road counts, so the two-character space is where this had to land anyway —
  // and `cp` is far enough from `cr` that a mistyped link enables neither.
  //
  // `enabled-only`, and this one is not a shortage of options — it is the
  // layer's whole privacy property. The dossier is a client's property, its
  // address and its price; it lives in `localStorage` and moves as a file. A
  // share link that carried it would be the one place in this application
  // where somebody else's valuation left the machine that typed it. What the
  // link carries is that the layer is on; what the recipient sees is their own
  // dossier, which is exactly right.
  Object.freeze({ id: 'comparables-fr', token: 'cp', disposition: 'enabled-only' }),
  // `cr` for comptages routiers. `c` is cctv and `co` reads like a prefix of
  // nothing in particular; `cr` says what the layer counts. Two characters
  // because there is no single one left — see the block below, which predicted
  // exactly this and has now been true for every layer added since.
  Object.freeze({ id: 'comptages-fr', token: 'cr', disposition: 'enabled-only' }),
  // `dl` for délinquance. `d` is dams and `dp`/`dv` are dpe-fr and dvf-sales, so
  // the two-character space is where this had to land anyway.
  Object.freeze({ id: 'delinquance-fr', token: 'dl', disposition: 'enabled-only' }),
  // THE LAST FIVE TOKENS, claimed together by the five French address layers.
  // a–y are taken, `z` is the canonical UNKNOWN token two existing tests assert
  // on, and 1–5 belong to gas-fr, power-grid, rte-generation, fr-hydro-plants
  // and bdtopo-buildings. `0` and `6`–`9` are all that remain. The next layer
  // after these has no single-character token left and will need the codec
  // widened — a deliberate design decision, not something to discover at a
  // merge. A duplicate here is a BOOT failure, not a review nit.
  Object.freeze({ id: 'dpe-fr', token: 'dp', disposition: 'enabled-only' }),
  Object.freeze({ id: 'dvf-sales', token: 'dv', disposition: 'enabled-only' }),
  Object.freeze({ id: 'earthquakes', token: 'e', disposition: 'enabled-only' }),
  Object.freeze({ id: 'edf-power-plants', token: 'l', disposition: 'enabled-only' }),
  // TWO CHARACTERS, like every layer added since the single-character scheme
  // ran out. `fi` and not `f`: `f` is `flights` and has shipped in links since
  // the beginning. `enabled+options`, because the chosen INDICATOR is part of
  // what a share link means here — a carroyage coloured by niveau de vie and
  // the same carroyage coloured by poverty are two different maps, and a link
  // that dropped the choice would restore the wrong one.
  Object.freeze({ id: 'filosofi-fr', token: 'fi', disposition: 'enabled+options', optionOwner: 'filosofi-fr' }),
  Object.freeze({ id: 'flights', token: 'f', disposition: 'enabled+options', optionOwner: 'flights' }),
  // A DIGIT, for the third time and the same reason: a–y are all taken, `z` is
  // the canonical UNKNOWN token two existing tests assert on, and 1–3 belong to
  // gas-fr, power-grid and rte-generation. `enabled-only` rather than
  // `enabled+options`: the layer's one runtime param is a display floor, and a
  // shared link that silently hid two thousand plants would be a worse surprise
  // than one that shows the register whole.
  Object.freeze({ id: 'fr-hydro-plants', token: '4', disposition: 'enabled-only' }),
  // `fh` for fraîcheur. `f` is flights and `fr` would read as the country
  // suffix every other French layer carries, which is the one thing a share
  // token must never look like.
  Object.freeze({ id: 'fraicheur-fr', token: 'fh', disposition: 'enabled-only' }),
  Object.freeze({ id: 'france-energy', token: 'j', disposition: 'enabled-only' }),
  // A DIGIT, not a letter: every letter of "gas" is taken (g by
  // military-awareness, a by AIS, s by satellites), and `z` is the token two
  // existing tests use as their canonical UNKNOWN token — claiming it would
  // silently turn "reject an unknown link" into "enable the gas layer".
  Object.freeze({ id: 'gas-fr', token: '1', disposition: 'enabled-only' }),
  Object.freeze({ id: 'georisques', token: 'gr', disposition: 'enabled-only' }),
  // TWO characters, because every single one is gone: a–y are claimed and `z`
  // is the canonical UNKNOWN token two tests assert on. `gi` for Gironde and
  // not `mf` for mégafeu — a token is read next to `gr` (georisques) and `gs`
  // would have been a coin toss between them.
  //
  // `enabled-only`, so the cursor is NOT serialized. A link that pinned
  // somebody else's instant would open on a half-burnt forest with no way for
  // the reader to know an hour had been chosen for them; the layer's own
  // default — the closing frame — is the only state still true today.
  Object.freeze({ id: 'gironde-megafire-2026', token: 'gi', disposition: 'enabled-only' }),
  Object.freeze({ id: 'hubeau-hydro', token: 'h', disposition: 'enabled-only' }),
  // A DIGIT, and NOT the `l` this layer was written against: `l` went to
  // edf-power-plants while this branch sat unmerged, and `8` — this layer's
  // first re-pick — went to road-events-fr in the days it stayed unmerged
  // after that. Twice, the same lesson: two layers on one token is a share
  // link that silently enables the wrong one. 1-8 are gas-fr, power-grid,
  // rte-generation, fr-hydro-plants, bdtopo-buildings, local-airports,
  // road-status-fr and road-events-fr, so IRVE takes `9`.
  // `fq` was `idfm-frequency` and is RETIRED, not reassigned: the two layers
  // drew the same stops and became one on 2026-09-10, so `if` now carries the
  // network AND its hourly offer. The token is left unclaimed rather than
  // handed to the next layer — a link in the wild that still says `fq` is
  // rejected whole by `decodeLayerStateParams`, which is the honest outcome,
  // and giving `fq` to a different subject would silently draw that one instead.
  Object.freeze({ id: 'idfm-network', token: 'if', disposition: 'enabled-only' }),
  // `im`, alphabetically between `idfm-network` and `irve-fr`. The registry is
  // asserted sorted, so position here is not a preference.
  Object.freeze({ id: 'implantation-fr', token: 'im', disposition: 'enabled+options', optionOwner: 'implantation-fr' }),
  Object.freeze({ id: 'irve-fr', token: '9', disposition: 'enabled-only' }),
  // TWO CHARACTERS, and `is` rather than `i`: `i` is `military-installations`
  // and has shipped in links since the beginning. `enabled+options`, because
  // the travel MODE is what the map claims — a fifteen-minute drive and a
  // fifteen-minute walk from the same address are different arguments about
  // the same plot, and a link that dropped the mode would restore the wrong one.
  Object.freeze({ id: 'isochrone-fr', token: 'is', disposition: 'enabled+options', optionOwner: 'isochrone-fr' }),
  // A DIGIT, for the sixth time and always for the same reason: a–y are all
  // taken and `z` is the canonical UNKNOWN token two tests assert on. `6`
  // because 1–5 belong to gas-fr, power-grid, rte-generation, fr-hydro-plants
  // and bdtopo-buildings. Not `a` for "airports" — that is the AIS layer, and a
  // duplicate token is a share link that silently enables the wrong one.
  Object.freeze({ id: 'local-airports', token: '6', disposition: 'enabled-only' }),
  Object.freeze({ id: 'local-dams', token: 'q', disposition: 'enabled-only' }),
  Object.freeze({ id: 'local-datacenters', token: 'd', disposition: 'enabled-only' }),
  Object.freeze({ id: 'local-firms', token: 'w', disposition: 'enabled-only' }),
  Object.freeze({ id: 'local-ports', token: 'o', disposition: 'enabled-only' }),
  Object.freeze({ id: 'marine-buoys', token: 'y', disposition: 'enabled-only' }),
  // Two characters, and the grammar was widened for exactly this before the
  // five address layers landed (`gr`, `dv`, `dp`, `ur`, `if`). Every single
  // character is taken: a–y, `z` is the canonical UNKNOWN token two tests
  // assert on, and 0–9 went to schools-fr, gas-fr, power-grid, rte-generation,
  // fr-hydro-plants, bdtopo-buildings, local-airports, road-status-fr,
  // road-events-fr and irve-fr. `md` for médecins.
  //
  // `enabled-only`, although the layer owns a paint chip: the chip changes
  // WHICH value the national choropleth carries, never what is hidden, so a
  // shared link that opens on the author's default surprises nobody.
  Object.freeze({ id: 'medecins-fr', token: 'md', disposition: 'enabled-only' }),
  // Two characters, like its four neighbours, and NOT `m` or `n`: `m` is the
  // military fleet and `n` is Vigilance météo — the layer this one is most
  // likely to be confused with and the one it must never be swapped for in a
  // share link. `mt` for météo. There were no open pull requests claiming a
  // token when this landed, which is the only thing that makes a two-character
  // pick safe: a duplicate here is a BOOT failure, not a merge conflict anyone
  // would notice.
  //
  // `enabled-only`, although the layer owns four filter chips: a chip selects
  // WHICH stations are shown, so a shared link opening on `VENT` would hide
  // 60 % of the network from its recipient with no way to know it had. The
  // author's filter is a view, not a fact about France.
  Object.freeze({ id: 'meteo-stations-fr', token: 'mt', disposition: 'enabled-only' }),
  Object.freeze({ id: 'meteofrance-vigilance', token: 'n', disposition: 'enabled-only' }),
  Object.freeze({ id: 'military', token: 'm', disposition: 'enabled+mirrored-options', optionOwner: 'flights' }),
  Object.freeze({ id: 'military-awareness', token: 'g', disposition: 'enabled-only' }),
  Object.freeze({ id: 'military-installations', token: 'i', disposition: 'enabled-only' }),
  // A DIGIT, following `gas-fr` above, and for the same reason twice over:
  // every letter of "power"/"grid" is taken (p by transit-fr, g by
  // military-awareness, r by radio, i by military-installations, d by
  // datacenters), `z` is the canonical UNKNOWN token two existing tests assert
  // on, and `l` — the last free letter when this layer was written — was
  // claimed by `edf-power-plants` before this branch merged. A share link that
  // silently enabled the wrong layer is exactly what the duplicate-token
  // assertion in this file exists to prevent.
  // TWO CHARACTERS, in the space the five French address layers widened.
  // `pe` for petite enfance; `p` is transit-fr and every other single letter
  // is taken. A duplicate here is a BOOT failure, not a review nit.
  Object.freeze({ id: 'petite-enfance-fr', token: 'pe', disposition: 'enabled-only' }),
  Object.freeze({ id: 'power-grid', token: '2', disposition: 'enabled-only' }),
  Object.freeze({ id: 'radio', token: 'r', disposition: 'enabled+options', optionOwner: 'radio' }),
  // Two road layers, and the digits are how they are told apart in a share
  // link. `road-status-fr` keeps `7`: it is already on `main`, so links
  // carrying that token exist, and re-lettering it would silently enable a
  // DIFFERENT layer for whoever opens one. `road-events-fr` landed after it and
  // is unreleased, so it takes the next free digit — `1`-`5` are gas-fr,
  // power-grid, rte-generation, fr-hydro-plants and bdtopo-buildings, `6` is
  // the airports pack, and `z` is the canonical UNKNOWN token two existing
  // tests assert on.
  //
  // `enabled-only`, although the events layer owns a runtime chip. The chip
  // selects which temporal scope the row SHOWS, and a share link that silently
  // hid every planned closure from its recipient would be a worse surprise than
  // one that opens on the default its author saw.
  Object.freeze({ id: 'road-events-fr', token: '8', disposition: 'enabled-only' }),
  Object.freeze({ id: 'road-status-fr', token: '7', disposition: 'enabled-only' }),
  Object.freeze({ id: 'rocket-launches', token: 'x', disposition: 'enabled-only' }),
  // A DIGIT, because the letters ran out: a–y are all taken (every letter of
  // "rte"/"gen"/"prod" among them — r by radio, t by traffic, e by earthquakes,
  // g by military-awareness, n by meteofrance-vigilance, p by transit-fr, d by
  // datacenters, o by ports), and `z` is the canonical UNKNOWN token two
  // existing tests assert on. `1` is the gas layer's; `2` is deliberately
  // skipped because the power-grid layer's open pull request already claims it,
  // and a duplicate token is a boot failure (`validateLayerStateRegistry`
  // throws), not a merge conflict anyone would notice.
  Object.freeze({ id: 'rte-generation', token: '3', disposition: 'enabled-only' }),
  Object.freeze({ id: 'satellites', token: 's', disposition: 'enabled+options', optionOwner: 'satellites' }),
  // `0`, and it is the LAST free token in the alphabet-plus-digits space: a–y
  // are taken, `z` is the canonical UNKNOWN token two tests assert on, and
  // 1–9 went to gas-fr, power-grid, rte-generation, fr-hydro-plants,
  // bdtopo-buildings, local-airports, road-status-fr, road-events-fr and
  // irve-fr. The next layer to land here cannot take a single character and
  // will have to widen the token grammar — which is a real decision, and one
  // this comment exists to hand over rather than leave as a surprise.
  Object.freeze({ id: 'schools-fr', token: '0', disposition: 'enabled-only' }),
  Object.freeze({ id: 'shared-mobility-fr', token: 'k', disposition: 'enabled-only' }),
  // TWO CHARACTERS, and the comment above `schools-fr` is the reason: it
  // predicted that the next layer would have to widen the grammar, the five
  // French address layers did exactly that, and this is the first layer to
  // arrive with the widened space already available rather than to discover
  // the problem. `su` for supérieur; `s` is satellites and `0` is schools-fr.
  // A duplicate here is a BOOT failure (`validateLayerStateRegistry` throws),
  // not a review nit — two layers on one token is a share link that silently
  // enables the wrong one.
  // `sd` for Sitadel. `s` is satellites, `su` is sup-fr — the third `s` layer,
  // and the last one that could still take two characters comfortably.
  //
  // MIRRORS `ads-fr`'s options since 2026-09-23, as `military` mirrors
  // `flights`: the « Urbanisme » row's « Période » steers both permit layers,
  // and a link carries it once, as `au.w`. A link written before keeps
  // opening Sitadel on the three years `au.w` then said by default.
  Object.freeze({ id: 'sitadel-fr', token: 'sd', disposition: 'enabled+mirrored-options', optionOwner: 'ads-fr' }),
  Object.freeze({ id: 'sup-fr', token: 'su', disposition: 'enabled-only' }),
  Object.freeze({ id: 'telegeography-submarine-cables', token: 'u', disposition: 'enabled-only' }),
  Object.freeze({ id: 'traffic', token: 't', disposition: 'enabled-only' }),
  Object.freeze({ id: 'transit-fr', token: 'p', disposition: 'enabled-only' }),
  Object.freeze({ id: 'urbanisme-gpu', token: 'ur', disposition: 'enabled-only' }),
  // `vp`, and `enabled+options` because the MODE is what the layer is showing:
  // the same 533 columns at Tuesday 08:00 and at Sunday 04:00 are two different
  // pictures, and a link that dropped the hour would restore the wrong one.
  Object.freeze({ id: 'velo-pulse-fr', token: 'vp', disposition: 'enabled+options', optionOwner: 'velo-pulse-fr' }),
  Object.freeze({ id: 'vigicrues', token: 'v', disposition: 'enabled-only' }),
]);

export const REGISTERED_LAYER_IDS = Object.freeze(LAYER_STATE_REGISTRY.map((entry) => entry.id));

/**
 * Layers that stay REGISTERED but are WITHDRAWN FROM THE INTERFACE.
 *
 * A withdrawn layer keeps everything a layer has — its module, its entry in
 * this registry, its share token, its taxonomy row, its credit line, its QA
 * harness. What it loses is every way a reader can ASK for it: no row and no
 * chip in the Data Layers panel (`layerFusions.js` drops it from the row's
 * offered companions), no name the voice model may speak
 * (`voice/layerVocabulary.js`), and no resurrection at boot — which is this
 * file's half of the job.
 *
 * THE BOOT HALF IS WHY THIS LIST IS HERE AND NOT ONLY IN THE PANEL. A reader
 * who had the layer switched on before it was withdrawn carries that ON in
 * `localStorage`, and an old share link carries it in `l=`. Restoring either
 * would put a layer on the globe with no control anywhere to switch it off —
 * the one failure mode that is strictly worse than the layer existing. So the
 * ingested state is pruned before the restore runs.
 *
 * It is pruned on INGESTION ONLY, never in `normalizeLayerState`: an explicit
 * `setEnabled(id, true, { origin: 'user' })` still records and still encodes,
 * which is what keeps `scripts/qa-velo-pulse.mjs` and the layer's own tests
 * able to drive it. Withdrawn is a product decision about the interface, not a
 * kill switch on the module.
 *
 * @type {ReadonlyArray<string>}
 */
export const DISABLED_LAYER_IDS = Object.freeze([
  // « Pouls vélo (semaine type) » — the « Semaine type » chip on the « Vélos et
  // véhicules partagés » row, withdrawn 2026-09-14. See `layerFusions.js`.
  'velo-pulse-fr',
]);

const DISABLED_LAYER_ID_SET = new Set(DISABLED_LAYER_IDS);

/**
 * Whether a layer is registered but withdrawn from the interface.
 * @param {string} layerId Registered layer id.
 * @returns {boolean} True when nothing in the UI may offer it.
 */
export function isLayerDisabled(layerId) {
  return DISABLED_LAYER_ID_SET.has(layerId);
}

const REGISTRY_BY_ID = new Map(LAYER_STATE_REGISTRY.map((entry) => [entry.id, entry]));
const REGISTRY_BY_TOKEN = new Map(LAYER_STATE_REGISTRY.map((entry) => [entry.token, entry]));
const OPTION_OWNER_IDS = Object.freeze([...new Set(
  LAYER_STATE_REGISTRY.map((entry) => entry.optionOwner).filter(Boolean),
)]);

function optionSpecs(ownerId) {
  return OPTION_GROUPS[ownerId] || [];
}

function defaultsForOwner(ownerId) {
  return Object.fromEntries(optionSpecs(ownerId).map((spec) => [spec.key, spec.defaultValue]));
}

function normalizeOwnerOptions(ownerId, candidate = {}) {
  const input = candidate && typeof candidate === 'object' ? candidate : {};
  const normalized = {};
  for (const spec of optionSpecs(ownerId)) {
    const value = Object.hasOwn(input, spec.key) ? spec.normalize(input[spec.key]) : null;
    normalized[spec.key] = value === null ? spec.defaultValue : value;
  }
  return normalized;
}

/** Return whether an event origin represents durable direct intent. */
export function isExplicitLayerStateOrigin(origin) {
  return origin === 'user' || origin === 'voice' || origin === 'tool';
}

/** Validate the static registry itself before it is used to seal a manager. */
export function validateLayerStateRegistry(registry = LAYER_STATE_REGISTRY) {
  if (!Array.isArray(registry) || registry.length === 0) {
    throw new Error('Layer-state registry must be a non-empty array');
  }
  const ids = new Set();
  const tokens = new Set();
  for (const entry of registry) {
    if (!entry || typeof entry.id !== 'string' || !entry.id) throw new Error('Layer-state entry missing id');
    if (!/^[a-z0-9-]+$/.test(entry.id)) throw new Error(`Invalid layer-state id: ${entry.id}`);
    if (ids.has(entry.id)) throw new Error(`Duplicate layer-state id: ${entry.id}`);
    ids.add(entry.id);
    // ONE OR TWO CHARACTERS. The single-character space ran out exactly where
    // this file kept predicting it would: 0-9 and a-y are all claimed and `z`
    // is the canonical UNKNOWN token two tests assert on, so the five French
    // address layers had nowhere left to go. Widening costs nothing on the
    // wire — `l=` has always been DOT-SEPARATED, so `l=f.dv.p` parses by the
    // same split that read `l=f.7.p`, and every link ever issued still decodes
    // to exactly what it decoded to before. A two-character token can never
    // collide with a one-character one, which is what makes this safe to
    // settle at a merge rather than a thing to schedule.
    if (!/^[a-z0-9]{1,2}$/.test(entry.token || '')) throw new Error(`Invalid layer-state token: ${entry.id}`);
    if (tokens.has(entry.token)) throw new Error(`Duplicate layer-state token: ${entry.token}`);
    tokens.add(entry.token);
    if (!VALID_DISPOSITIONS.has(entry.disposition)) {
      throw new Error(`Invalid layer-state disposition: ${entry.id}`);
    }
    if (entry.disposition !== 'enabled-only') {
      if (!entry.optionOwner || optionSpecs(entry.optionOwner).length === 0) {
        throw new Error(`Layer-state option owner missing: ${entry.id}`);
      }
    } else if (entry.optionOwner) {
      throw new Error(`Enabled-only layer cannot own options: ${entry.id}`);
    }
  }
  return true;
}

validateLayerStateRegistry();

/**
 * Produce the ZERO durable state: every option at its default, nothing on.
 *
 * Deliberately not the same thing as {@link createSeededLayerState}. This one
 * is the empty sheet — what a coordinator holds before `start()` has decided
 * anything, and what a reader gets when their own stored session or an
 * incoming share says "nothing". Seeding it here would put the product
 * defaults into both of those, which are exactly the two cases a default must
 * not touch.
 */
export function createDefaultLayerState() {
  return {
    version: LAYER_STATE_VERSION,
    enabledLayerIds: [],
    options: Object.fromEntries(OPTION_OWNER_IDS.map((ownerId) => [
      ownerId,
      defaultsForOwner(ownerId),
    ])),
  };
}

/**
 * The zero state with the product defaults switched on.
 *
 * Reached from one place only — a `start()` that found neither a share nor a
 * stored session. See {@link DEFAULT_ENABLED_LAYER_IDS}.
 *
 * The list is a PARAMETER, not the constant, because what counts as an
 * affordable default depends on the machine: a phone is handed `[]`. Doing it
 * here rather than coupling this file to the render profile keeps the codec a
 * pure function of its inputs — the caller that knows what device this is
 * (`src/ui.js`) is the one that decides.
 *
 * @param {{enabledLayerIds?: string[]}} [options]
 */
export function createSeededLayerState({ enabledLayerIds = DEFAULT_ENABLED_LAYER_IDS } = {}) {
  return normalizeLayerState({
    ...createDefaultLayerState(),
    // Through `normalizeLayerState` rather than assigned, so a default naming
    // a layer that has since been withdrawn or renamed is dropped here instead
    // of surfacing later as a layer with no control anywhere.
    enabledLayerIds: [...enabledLayerIds],
  });
}

/** Sanitize and canonicalize an externally supplied layer-state object. */
export function normalizeLayerState(candidate) {
  const input = candidate && typeof candidate === 'object' ? candidate : {};
  const requestedEnabled = new Set(
    Array.isArray(input.enabledLayerIds) ? input.enabledLayerIds.map(String) : [],
  );
  const enabledLayerIds = REGISTERED_LAYER_IDS.filter((id) => requestedEnabled.has(id));
  const enabled = new Set(enabledLayerIds);
  const options = Object.fromEntries(OPTION_OWNER_IDS.map((ownerId) => [
    ownerId,
    normalizeOwnerOptions(ownerId, input.options?.[ownerId]),
  ]));
  // A selected entity cannot outlive an explicitly disabled owner layer.
  // Keeping these IDs would resurrect tracking when that layer is enabled
  // later, even though OFF was newer explicit intent.
  if (!enabled.has('flights')) options.flights.selectedFlightsTrackingId = null;
  if (!enabled.has('military')) options.flights.selectedMilitaryTrackingId = null;
  if (!enabled.has('satellites')) options.satellites.selectedSatTrackingId = null;
  // The codec has no cross-family recency field, so multiple tracking IDs are
  // ambiguous rather than an ordered handoff. Fail closed instead of letting
  // asynchronous feed arrival decide which tracker and camera owner wins.
  const trackingSelectionCount = [
    options.flights.selectedFlightsTrackingId,
    options.flights.selectedMilitaryTrackingId,
    options.satellites.selectedSatTrackingId,
  ].filter((value) => value !== null).length;
  if (trackingSelectionCount > 1) {
    options.flights.selectedFlightsTrackingId = null;
    options.flights.selectedMilitaryTrackingId = null;
    options.satellites.selectedSatTrackingId = null;
  }
  return {
    version: LAYER_STATE_VERSION,
    enabledLayerIds,
    options,
  };
}

/**
 * Drop the withdrawn layers from a state's enabled set, keeping their options.
 *
 * Options survive on purpose: a layer can come back (the flag in
 * `layerFusions.js` is one line), and a reader who had it on POINTE should get
 * POINTE back rather than the default, exactly as a reader who simply switched
 * it off would.
 * @param {object} state Already-normalized layer state.
 * @returns {object} The same object when nothing was withdrawn, a pruned one otherwise.
 */
export function pruneDisabledLayers(state) {
  const enabled = Array.isArray(state?.enabledLayerIds) ? state.enabledLayerIds : [];
  if (!enabled.some((id) => isLayerDisabled(id))) return state;
  return normalizeLayerState({
    ...state,
    enabledLayerIds: enabled.filter((id) => !isLayerDisabled(id)),
  });
}

export function cloneLayerState(state) {
  const normalized = normalizeLayerState(state);
  return {
    ...normalized,
    enabledLayerIds: [...normalized.enabledLayerIds],
    options: Object.fromEntries(
      Object.entries(normalized.options).map(([id, options]) => [id, { ...options }]),
    ),
  };
}

/** Append the compact v2 layer fields to an existing URLSearchParams object. */
export function encodeLayerStateParams(params, state) {
  const normalized = normalizeLayerState(state);
  const enabled = new Set(normalized.enabledLayerIds);
  params.set('l', LAYER_STATE_REGISTRY
    .filter((entry) => enabled.has(entry.id))
    .map((entry) => entry.token)
    .join('.'));
  const encodedOptions = [];
  for (const ownerId of OPTION_OWNER_IDS) {
    const ownerEntry = REGISTRY_BY_ID.get(ownerId);
    const ownerOptions = normalized.options[ownerId];
    for (const spec of optionSpecs(ownerId)) {
      // Omit against what an ABSENT token means to a DECODER, not against the
      // current default — those are the same thing for every option whose
      // default never moved, and deliberately different for one whose did.
      if (ownerOptions[spec.key] === absentTokenValue(spec)) continue;
      encodedOptions.push(`${ownerEntry.token}.${spec.token}.${spec.encode(ownerOptions[spec.key])}`);
    }
  }
  if (encodedOptions.length) params.set('lo', encodedOptions.join('_'));
  else params.delete('lo');
  return params;
}

/** Decode v2 fields. Null means that the layer payload is absent. */
export function decodeLayerStateParams(params) {
  if (params.get('v') !== String(LAYER_STATE_VERSION) || !params.has('l')) return null;
  const rawLayers = String(params.get('l') || '');
  const rawOptionsField = String(params.get('lo') || '');
  // Fail closed on an oversized payload rather than decoding a truncated one.
  if (rawLayers.length > MAX_ENABLED_LAYERS_CHARS) return null;
  if (rawOptionsField.length > MAX_LAYER_OPTIONS_CHARS) return null;
  const layerTokens = rawLayers.split('.').filter(Boolean);
  // `l=` is the one valid explicit-empty representation. Any non-empty token
  // set containing an unknown member rejects the complete layer payload so a
  // typo or future token cannot silently become an authoritative empty set.
  if (layerTokens.some((token) => !REGISTRY_BY_TOKEN.has(token))) return null;
  const enabledLayerIds = layerTokens.map((token) => REGISTRY_BY_TOKEN.get(token).id);
  const rawOptions = {};
  for (const assignment of rawOptionsField.split('_')) {
    if (!assignment) continue;
    const [layerToken, optionToken, encodedValue, ...extra] = assignment.split('.');
    if (extra.length) continue;
    const entry = REGISTRY_BY_TOKEN.get(layerToken);
    const ownerId = entry?.optionOwner || null;
    if (!ownerId) continue;
    const spec = optionSpecs(ownerId).find((candidate) => candidate.token === optionToken);
    if (!spec) continue;
    const decoded = spec.decode(encodedValue);
    if (decoded === null) continue;
    if (!rawOptions[ownerId]) rawOptions[ownerId] = {};
    rawOptions[ownerId][spec.key] = decoded;
  }
  // Fill every token the link did NOT carry with its absent-meaning before
  // normalization, which would otherwise substitute the CURRENT default. For all
  // but one option those are identical and this is a no-op; for `models3d` it is
  // the whole point — an omitted `e` is a v2 author saying OFF, not a v2 author
  // saying "whatever the default happens to be today". See `absentTokenValue`.
  for (const ownerId of OPTION_OWNER_IDS) {
    for (const spec of optionSpecs(ownerId)) {
      if (rawOptions[ownerId] && Object.hasOwn(rawOptions[ownerId], spec.key)) continue;
      if (!rawOptions[ownerId]) rawOptions[ownerId] = {};
      rawOptions[ownerId][spec.key] = absentTokenValue(spec);
    }
  }
  return normalizeLayerState({ enabledLayerIds, options: rawOptions });
}

/**
 * What a STORED session meant when it was written, as opposed to how it is
 * spelled (`LAYER_STATE_VERSION`, shared with the share link).
 *
 * The spelling can hold still while the meaning moves: a row whose primary
 * changes keeps every token, but an ON saved under the old row is not the ON
 * a reader would give the new one. A session saved before a revision runs
 * that revision's step once, on the way in; the next save carries the current
 * revision, so a choice made after it is never undone. Written as `r`, absent
 * before the first step.
 *
 * Stored sessions only. A share link reproduces what its sender had on screen,
 * whenever that was.
 */
export const STORED_LAYER_STATE_REVISION = 2;

const STORED_LAYER_STATE_STEPS = Object.freeze([
  // 1 — « Règles d'urbanisme » stops coming on with « Urbanisme » (2026-09-23).
  // Until #360 the zoning WAS the row's primary, so every session saved with
  // the row on carries `urbanisme-gpu`, and it came back after #360 painting
  // every plot in PLU colours — the default #360 removed. A session that old
  // cannot tell a reader who asked for the zoning from one who switched the
  // row on, so it drops the zoning; the tile lights it again in one press.
  Object.freeze({ revision: 1, dropLayerIds: Object.freeze(['urbanisme-gpu']) }),
  // 2 — « Fiche implantation » is set aside (2026-09-24, src/data/pausedLayers.js).
  // A session saved with it on would otherwise ask for it at every visit and be
  // refused every time; it is dropped once, silently.
  Object.freeze({ revision: 2, dropLayerIds: Object.freeze(['implantation-fr']) }),
]);

/** Stable local-storage representation (full IDs for debuggability). */
export function serializeStoredLayerState(state) {
  const normalized = normalizeLayerState(state);
  return JSON.stringify({
    v: LAYER_STATE_VERSION,
    r: STORED_LAYER_STATE_REVISION,
    l: normalized.enabledLayerIds,
    o: normalized.options,
  });
}

export function parseStoredLayerState(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.v !== LAYER_STATE_VERSION || !Array.isArray(parsed.l)) return null;
    const revision = Number.isInteger(parsed.r) ? parsed.r : 0;
    const dropped = new Set(STORED_LAYER_STATE_STEPS
      .filter((step) => step.revision > revision)
      .flatMap((step) => step.dropLayerIds));
    return normalizeLayerState({
      enabledLayerIds: parsed.l.filter((id) => !dropped.has(id)),
      options: parsed.o,
    });
  } catch {
    return null;
  }
}

/** Return sanitized options to apply to one registered module. */
export function layerOptionsForRestore(state, layerId) {
  const entry = REGISTRY_BY_ID.get(layerId);
  if (!entry?.optionOwner) return null;
  return { ...normalizeLayerState(state).options[entry.optionOwner] };
}

function safeStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

function currentLayerOutcome(dataManager, layerId) {
  const state = dataManager.getLayerLifecycleState?.(layerId);
  return {
    settledEnabled: Boolean(state?.enabled),
    lifecycleState: state?.lifecycleState || 'missing',
    lifecycleUncertain: Boolean(state?.uncertain),
  };
}

/**
 * Owns durable user layer preferences independently from transient runtime
 * choreography, and coordinates passive post-registration restoration.
 */
export class LayerStateCoordinator {
  constructor(dataManager, shareLinkManager, {
    storage = safeStorage(),
    restoreGate = null,
    onDurableStateChange = null,
    onTrackingRestoreStatus = null,
    now = () => Date.now(),
    // Injectable so the pending-window behavior is deterministically testable
    // without sleeping out a 90 s expiry.
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle),
  } = {}) {
    if (!dataManager?.registrationsFinalized) {
      throw new Error('Layer state requires finalized data-layer registrations');
    }
    this.dataManager = dataManager;
    this.shareLinkManager = shareLinkManager || null;
    this.storage = storage;
    this.restoreGate = restoreGate;
    this.onDurableStateChange = onDurableStateChange;
    this.onTrackingRestoreStatus = onTrackingRestoreStatus;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this._durableState = createDefaultLayerState();
    this._source = 'defaults';
    this._destroyed = false;
    this._restoreControllers = new Map();
    this._shareCreatedAtMs = null;
    this._trackingRestoreController = null;
    this._trackingRestoreGeneration = 0;
    this._pendingTrackingTimer = null;
    this._pendingTrackingContext = null;
    this._unsubscribe = this.dataManager.subscribe((change) => this._handleManagerChange(change));
    this._unsubscribeVisibilityRequests = this.dataManager.subscribeVisibilityRequests(
      (change) => this._handleVisibilityRequest(change),
    );
    this.restorePromise = Promise.resolve([]);
    this.lastRestoreResults = [];
  }

  start({
    shareLayerState = null,
    allowLocalState = true,
    shareCreatedAtMs = null,
    // What "no choice was made" means on this machine. `src/ui.js` hands a
    // phone an empty list: traffic ON is a continuous-render hold for as long
    // as the tab lives (`holdContinuousRender('traffic')`), which is a battery
    // and a thermal budget a handset does not have to spend on a layer nobody
    // asked for. A default is not a preference — a stored session or a share
    // link still restores traffic on any device.
    defaultEnabledLayerIds = DEFAULT_ENABLED_LAYER_IDS,
  } = {}) {
    if (this._destroyed) throw new Error('Layer-state coordinator is destroyed');
    let selected = shareLayerState ? normalizeLayerState(shareLayerState) : null;
    if (selected) {
      this._source = 'share';
      this._shareCreatedAtMs = Number.isFinite(shareCreatedAtMs) ? shareCreatedAtMs : null;
    } else if (allowLocalState) {
      let stored = null;
      try { stored = parseStoredLayerState(this.storage?.getItem?.(LAYER_STATE_STORAGE_KEY)); } catch { /* best effort */ }
      if (stored) {
        selected = stored;
        this._source = 'local';
      }
    } else {
      // A valid historical camera/style share with no v2 layer payload keeps
      // the exact legacy default-layer behavior. It must not inherit an
      // unrelated recipient's saved local layer preferences.
      this._source = 'legacy-share';
    }
    // Withdrawn layers are dropped HERE, at the one door both sources come
    // through, and before anything reads the state back: a stored session or an
    // old `l=` that still carries one would otherwise restore a layer the panel
    // has no control for. See `DISABLED_LAYER_IDS`.
    // The product defaults are seeded ONLY for a boot that chose nothing and
    // was sent nothing. `legacy-share` is excluded with the same reasoning the
    // branch above uses to refuse it local preferences: a v1 camera/style link
    // predates layer payloads, so "the sender chose nothing" and "the format
    // could not carry it" are indistinguishable, and adding a layer to
    // somebody else's framed view is the mistake either way.
    const seedDefaults = !selected && this._source === 'defaults';
    this._durableState = pruneDisabledLayers(
      selected || (seedDefaults
        ? createSeededLayerState({ enabledLayerIds: defaultEnabledLayerIds })
        : createDefaultLayerState()),
    );
    this.shareLinkManager?.setLayerStateProvider?.(() => this.getDurableState());
    this.shareLinkManager?.onLayerStateChange?.();
    this._notifyDurableState();
    if (!selected) {
      // A seeded default has to be RESTORED, not merely recorded: the durable
      // state is what the panel and the share link read, and a layer that is
      // ticked there but never enabled on the manager is the worst of both.
      if (!seedDefaults || this._durableState.enabledLayerIds.length === 0) {
        return this.restorePromise;
      }
      this.restorePromise = this._restoreSelectedState(
        LAYER_RESTORE_ORIGINS.defaults, this._durableState.enabledLayerIds,
      );
      return this.restorePromise;
    }
    this.restorePromise = this._restoreSelectedState(
      this._source === 'share' ? LAYER_RESTORE_ORIGINS.share : LAYER_RESTORE_ORIGINS.local,
    );
    return this.restorePromise;
  }

  get source() {
    return this._source;
  }

  getDurableState() {
    return cloneLayerState(this._durableState);
  }

  _notifyDurableState() {
    try { this.onDurableStateChange?.(this.getDurableState()); } catch { /* UI sync is best effort */ }
  }

  _handleVisibilityRequest(change) {
    if (!isExplicitLayerStateOrigin(change?.origin)) return;
    this._restoreControllers.get(change.layerId)?.abort('superseded-by-explicit-visibility');
    if (SHARE_TRACKING_RESTORE_POLICIES[change.layerId]) {
      this._revokePendingTrackingWatch('superseded-by-explicit-visibility');
    }
  }

  /** Revoke every passive restore before explicit navigation can be reclaimed. */
  cancelPendingRestores(reason = 'superseded-by-explicit-navigation') {
    for (const controller of this._restoreControllers.values()) controller.abort(reason);
    this._revokePendingTrackingWatch(reason);
  }

  /**
   * Revoke a pending shared Follow. Physical navigation may also clear only
   * the exact passive selection, without writing recipient preferences.
   */
  cancelPendingShareTracking(reason = 'superseded-by-explicit-navigation', {
    clearSelection = false,
  } = {}) {
    this._revokePendingTrackingWatch(reason);
    if (!clearSelection) return false;
    const selected = this._selectedShareTrackingTarget();
    return selected ? this._passivelyClearTrackingSelection(selected) : false;
  }

  _handleManagerChange(change) {
    if (!change || this._destroyed) return;
    // Parameter and visibility ownership are independent. A newer explicit
    // option request may replace passive share options, but it must not abort
    // the same layer's visibility lifecycle.
    if (change.type === 'params-requested') {
      if (isExplicitLayerStateOrigin(change.origin)
          && SHARE_TRACKING_RESTORE_POLICIES[change.layerId]) {
        this._revokePendingTrackingWatch('superseded-by-explicit-params');
      }
      return;
    }
    // A layer that goes away takes its latch with it, at ANY origin — a
    // programmatic disable or teardown never reaches the explicit-intent path
    // below, so revoke here before that early return.
    if (change.type === 'visibility'
        && change.enabled === false
        && SHARE_TRACKING_RESTORE_POLICIES[change.layerId]) {
      this._revokePendingTrackingWatch('owner-layer-disabled');
    }
    if (!isExplicitLayerStateOrigin(change.origin)) return;
    if (change.type === 'visibility') {
      this._restoreControllers.get(change.layerId)?.abort('superseded-by-explicit-visibility');
      if (SHARE_TRACKING_RESTORE_POLICIES[change.layerId]) {
        this._revokePendingTrackingWatch('superseded-by-explicit-visibility');
      }
      const enabled = new Set(this._durableState.enabledLayerIds);
      if (change.enabled) enabled.add(change.layerId);
      else enabled.delete(change.layerId);
      this._commitExplicit({ ...this._durableState, enabledLayerIds: [...enabled] });
      return;
    }
    if (change.type !== 'params') return;
    const entry = REGISTRY_BY_ID.get(change.layerId);
    if (!entry?.optionOwner) return;
    const ownerId = entry.optionOwner;
    const nextOwnerOptions = { ...this._durableState.options[ownerId] };
    const requestedParams = change.requestedParams || {};
    const trackingOptionKey = TRACKING_OPTION_KEY_BY_LAYER[change.layerId] || null;
    let changed = false;
    for (const spec of optionSpecs(ownerId)) {
      // Only persist keys present in this explicit request. getLayerParams()
      // can return a wider live snapshot containing transient or passively
      // changed values that this user action did not own. Tracking is the one
      // exception: an unrelated explicit option cancels a pending restoration
      // in that family, so its wider live value (active ID or null) must replace
      // the formerly durable pending ID instead of allowing reload resurrection.
      const explicitlyRequested = Object.hasOwn(requestedParams, spec.key);
      const implicitTrackingSync = !explicitlyRequested && spec.key === trackingOptionKey;
      if (!explicitlyRequested && !implicitTrackingSync) continue;
      const value = spec.normalize(change.params[spec.key]);
      if (value === null) {
        if (implicitTrackingSync) {
          nextOwnerOptions[spec.key] = null;
          changed = true;
          continue;
        }
        if (spec.defaultValue !== null || change.params[spec.key] !== null) continue;
      }
      nextOwnerOptions[spec.key] = value;
      changed = true;
    }
    if (!changed) return;
    this._commitExplicit({
      ...this._durableState,
      options: { ...this._durableState.options, [ownerId]: nextOwnerOptions },
    });
  }

  _commitExplicit(candidate) {
    this._durableState = normalizeLayerState(candidate);
    const serialized = serializeStoredLayerState(this._durableState);
    try {
      if (this.storage?.getItem?.(LAYER_STATE_STORAGE_KEY) !== serialized) {
        this.storage?.setItem?.(LAYER_STATE_STORAGE_KEY, serialized);
      }
    } catch { /* storage can be unavailable or quota-limited */ }
    this.shareLinkManager?.onLayerStateChange?.();
    this._notifyDurableState();
  }

  async _waitForRestoreGate() {
    if (!this.restoreGate) return;
    await (typeof this.restoreGate === 'function' ? this.restoreGate() : this.restoreGate);
  }

  /**
   * Apply a selected durable state to the manager.
   *
   * @param {string} origin One of `LAYER_RESTORE_ORIGINS`.
   * @param {?Array<string>} [only] Restrict the pass to these layer IDs.
   *   Used by the DEFAULTS origin, and the restriction is the point: a share
   *   or a stored session is a complete picture and every layer has to be put
   *   where it says, including the ones it says are off. A product default is
   *   a nudge on one layer, and sweeping the other fifty-nine to push them
   *   options nobody asked for would make a first boot do more work than a
   *   restored one, not less.
   */
  async _restoreSelectedState(origin, only = null) {
    const scope = only
      ? LAYER_STATE_REGISTRY.filter((entry) => only.includes(entry.id))
      : LAYER_STATE_REGISTRY;
    for (const entry of scope) {
      this._restoreControllers.set(entry.id, new AbortController());
    }
    try {
      await this._waitForRestoreGate();
      const enabled = new Set(this._durableState.enabledLayerIds);
      const settled = await Promise.allSettled(scope.map(async (entry) => {
        const controller = this._restoreControllers.get(entry.id);
        const targetEnabled = enabled.has(entry.id);
        const options = layerOptionsForRestore(this._durableState, entry.id);
        if (origin === LAYER_RESTORE_ORIGINS.share && options) {
          for (const trackingKey of Object.values(TRACKING_OPTION_KEY_BY_LAYER)) {
            delete options[trackingKey];
          }
        }
        if (this._destroyed || controller?.signal.aborted) {
          return {
            layerId: entry.id,
            targetEnabled,
            origin,
            phase: 'reserved',
            ...currentLayerOutcome(this.dataManager, entry.id),
            appliedOptions: {},
            cancellationReason: this._destroyed ? 'destroyed' : 'superseded',
            errorClass: 'cancelled',
            persistenceWrite: false,
            succeeded: false,
          };
        }
        // Reserve passive option state before any asynchronous lifecycle work.
        // A later explicit params intent then wins on its own lane without
        // cancelling or being overwritten by the visibility restore.
        const paramsSucceeded = !options || Object.keys(options).length === 0
          || this.dataManager.setLayerParams(entry.id, options, { origin });
        return this.dataManager.restoreLayerState(entry.id, {
          enabled: targetEnabled,
          params: null,
        }, { origin, signal: controller.signal }).then((result) => ({
          ...result,
          appliedOptions: paramsSucceeded && options ? options : {},
          errorClass: paramsSucceeded ? result.errorClass : 'ParamsRejected',
          succeeded: paramsSucceeded && result.succeeded,
        }));
      }));
      this.lastRestoreResults = settled.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        const entry = LAYER_STATE_REGISTRY[index];
        return {
          layerId: entry.id,
          targetEnabled: enabled.has(entry.id),
          origin,
          phase: 'coordinator',
          ...currentLayerOutcome(this.dataManager, entry.id),
          appliedOptions: {},
          cancellationReason: null,
          errorClass: result.reason?.name || 'Error',
          error: String(result.reason?.message || result.reason),
          persistenceWrite: false,
          succeeded: false,
        };
      });
      return this.lastRestoreResults.map((result) => ({ ...result }));
    } finally {
      this._restoreControllers.clear();
      this._notifyDurableState();
    }
  }

  _selectedShareTrackingTarget() {
    if (this._source !== 'share') return null;
    for (const [layerId, policy] of Object.entries(SHARE_TRACKING_RESTORE_POLICIES)) {
      const targetId = this._durableState.options?.[policy.optionOwner]?.[policy.optionKey];
      if (targetId !== null && targetId !== undefined && targetId !== '') {
        return { layerId, targetId, ...policy };
      }
    }
    return null;
  }

  _passivelyClearTrackingSelection(selected) {
    const current = this._durableState.options?.[selected.optionOwner]?.[selected.optionKey];
    if (String(current) !== String(selected.targetId)) return false;
    const ownerOptions = {
      ...this._durableState.options[selected.optionOwner],
      [selected.optionKey]: null,
    };
    this._durableState = normalizeLayerState({
      ...this._durableState,
      options: {
        ...this._durableState.options,
        [selected.optionOwner]: ownerOptions,
      },
    });
    this.dataManager.setLayerParams?.(
      selected.layerId,
      { [selected.optionKey]: null },
      { origin: LAYER_RESTORE_ORIGINS.share },
    );
    this.shareLinkManager?.onLayerStateChange?.();
    this._notifyDurableState();
    return true;
  }

  /**
   * `atMs` is the moment the subject was first found ABSENT, not the moment the
   * verdict is delivered. Waiting out the pending window must not by itself
   * push a fresh link into the "expired" wording — that word describes the
   * SHARE's age, not how long this client watched for the subject.
   */
  _classifyMissingTrackingTarget(selected, atMs = this.now()) {
    const copiedAt = this._shareCreatedAtMs;
    if (!Number.isFinite(copiedAt)) return 'unavailable';
    const ageMs = atMs - copiedAt;
    return ageMs > selected.expiryWindowMs ? 'expired' : 'unavailable';
  }

  /** Whether the owning layer currently follows the shared subject. */
  _trackingTargetLatched(selected) {
    const params = this.dataManager.getLayerParams?.(selected.layerId);
    const active = params?.[selected.optionKey];
    return active !== null && active !== undefined
      && String(active) === String(selected.targetId);
  }

  /** Stop watching a pending shared subject without deciding its fate. */
  _cancelPendingTrackingWatch() {
    if (this._pendingTrackingTimer !== null) this.clearTimer(this._pendingTrackingTimer);
    this._pendingTrackingTimer = null;
    const pending = this._pendingTrackingContext;
    if (pending?.signal && pending.abortHandler) {
      pending.signal.removeEventListener('abort', pending.abortHandler);
      pending.abortHandler = null;
    }
  }

  /** Publish a share-follow lifecycle update without allowing UI errors to own state. */
  _publishTrackingRestoreStatus(status) {
    try { this.onTrackingRestoreStatus?.(status); } catch { /* status UI is best effort */ }
  }

  /**
   * Revoke a pending shared Follow wholesale.
   *
   * The watch and the LAYER's own deferred-restore latch are two halves of one
   * mechanism, so they must die together. Aborting only the restore controller
   * left the timer alive: the controller has already settled by the time the
   * watch exists, so the abort was a no-op and the orphaned timer went on to
   * announce "Shared … unavailable" for a subject whose latch had been
   * cancelled — a notice about work no longer being attempted.
   */
  _revokePendingTrackingWatch(reason) {
    this._trackingRestoreController?.abort(reason);
    this._trackingRestoreGeneration += 1;
    this._cancelPendingTrackingWatch();
    const pending = this._pendingTrackingContext;
    this._pendingTrackingContext = null;
    if (pending) {
      this.dataManager.cancelPendingLayerRestore?.(pending.selected.layerId, {
        origin: LAYER_RESTORE_ORIGINS.share,
        reason: String(reason || 'cancelled'),
      });
      this._publishTrackingRestoreStatus({
        ...pending.probe,
        ...pending.selected,
        status: 'cancelled',
        classification: 'cancelled',
        reason: String(reason || 'cancelled'),
        cleared: false,
      });
    }
  }

  /**
   * Hold a not-yet-arrived shared subject PENDING instead of declaring it gone.
   *
   * A recipient's first authoritative refresh routinely lands without a given
   * contact — the feed is polled, coverage is partial, and rendering trails the
   * snapshot by a poll. Reload-from-local already survives this: its restore
   * arms the layer's own deferred-restore latch, which re-attempts on every
   * later poll. The shared path used to decide on that single refresh, clear
   * the subject from durable state AND from the URL, then post a failure notice
   * seconds into startup — so the same link healed on reload but never on the
   * share.
   *
   * Arm the SAME latch, then watch it in the background: the caller is never
   * blocked (startup must not wait out a 90 s window before it may write the
   * URL again), and the terminal verdict is deferred until the source-specific
   * window has genuinely expired. The existing wordings are unchanged.
   */
  async _beginPendingTrackingRestore(selected, probe, signal = null) {
    const generation = this._trackingRestoreGeneration;
    const absentAtMs = this.now();
    // Arm the layer's deferred-restore latch under the passive share origin, so
    // it re-attempts each poll and never rewrites recipient preferences.
    let armed = false;
    let armError = null;
    try {
      armed = await this.dataManager.setLayerParams?.(
        selected.layerId,
        { [selected.optionKey]: selected.targetId },
        { origin: LAYER_RESTORE_ORIGINS.share },
      ) === true;
    } catch (error) {
      armError = error;
    }
    if (this._destroyed || generation !== this._trackingRestoreGeneration || signal?.aborted) {
      if (armed) {
        this.dataManager.cancelPendingLayerRestore?.(selected.layerId, {
          origin: LAYER_RESTORE_ORIGINS.share,
          reason: String(signal?.reason || 'superseded'),
        });
      }
      return {
        ...probe,
        ...selected,
        status: 'cancelled',
        classification: 'cancelled',
        reason: String(signal?.reason || 'superseded'),
        cleared: false,
      };
    }
    if (!armed) {
      const terminal = {
        ...probe,
        ...selected,
        status: 'source-unavailable',
        classification: 'source-unavailable',
        reason: String(armError?.message || armError || 'tracking restore latch rejected'),
        cleared: this._passivelyClearTrackingSelection(selected),
      };
      this._publishTrackingRestoreStatus(terminal);
      return terminal;
    }
    const deadline = this.now() + selected.expiryWindowMs;
    const settle = (terminal) => {
      if (this._pendingTrackingContext?.generation !== generation) return;
      this._cancelPendingTrackingWatch();
      this._pendingTrackingContext = null;
      this._publishTrackingRestoreStatus(terminal);
    };
    const poll = () => {
      this._pendingTrackingTimer = null;
      if (this._destroyed || generation !== this._trackingRestoreGeneration) return;
      // The layer that owns the latch may have gone away since the last tick
      // (disable, teardown, replacement). There is nothing left attempting this
      // restore, so abandon it silently rather than announcing a verdict.
      if (this.dataManager.isEffectivelyEnabled?.(selected.layerId) === false) {
        this._revokePendingTrackingWatch('owner-layer-disabled');
        return;
      }
      if (this._trackingTargetLatched(selected)) {
        settle({ ...probe, ...selected, status: 'found', classification: 'followed', cleared: false });
        return;
      }
      if (this.now() >= deadline) {
        // The window really has elapsed — only now does the verdict apply.
        const classification = probe.status === 'missing'
          ? this._classifyMissingTrackingTarget(selected, absentAtMs)
          : 'source-unavailable';
        const cleared = this._passivelyClearTrackingSelection(selected);
        settle({ ...probe, ...selected, classification, cleared });
        return;
      }
      this._pendingTrackingTimer = this.setTimer(poll, PENDING_TRACKING_POLL_MS);
      this._pendingTrackingTimer?.unref?.();
    };
    this._cancelPendingTrackingWatch();
    const pending = { ...probe, ...selected, status: 'pending', classification: 'pending', cleared: false };
    const pendingContext = {
      generation,
      selected,
      probe,
      signal,
      abortHandler: null,
    };
    if (signal) {
      pendingContext.abortHandler = () => {
        if (this._pendingTrackingContext?.generation !== generation) return;
        this._revokePendingTrackingWatch(signal.reason || 'aborted');
      };
      signal.addEventListener('abort', pendingContext.abortHandler, { once: true });
    }
    this._pendingTrackingContext = pendingContext;
    this._publishTrackingRestoreStatus(pending);
    this._pendingTrackingTimer = this.setTimer(poll, PENDING_TRACKING_POLL_MS);
    this._pendingTrackingTimer?.unref?.();
    return pending;
  }

  /**
   * Refresh and restore the one shareable tracked target after destination
   * camera and ordinary layer restoration have settled.
   */
  async restoreShareTrackingSelection({ signal = null } = {}) {
    const selected = this._selectedShareTrackingTarget();
    if (!selected || this._destroyed) return { status: 'skipped', reason: 'no-shared-target' };
    this._revokePendingTrackingWatch('superseded-by-newer-restore');
    const controller = new AbortController();
    const combinedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;
    this._trackingRestoreController = controller;
    const generation = ++this._trackingRestoreGeneration;
    let result;
    try {
      result = await this.dataManager.resolveLayerTrackingTarget(
        selected.layerId,
        selected.targetId,
        { signal: combinedSignal, origin: LAYER_RESTORE_ORIGINS.share },
      );
    } catch (error) {
      result = combinedSignal.aborted
        ? { status: 'cancelled', reason: String(combinedSignal.reason || 'aborted') }
        : { status: 'source-unavailable', reason: String(error?.message || error) };
    }
    if (generation !== this._trackingRestoreGeneration || this._destroyed || combinedSignal.aborted) {
      if (this._trackingRestoreController === controller) this._trackingRestoreController = null;
      return { ...result, status: 'cancelled', reason: String(combinedSignal.reason || 'superseded') };
    }
    if (this._trackingRestoreController === controller) this._trackingRestoreController = null;

    if (result.status === 'found') {
      const terminal = { ...result, ...selected, classification: 'followed', cleared: false };
      this._publishTrackingRestoreStatus(terminal);
      return terminal;
    }
    if (['cancelled', 'superseded', 'destroyed'].includes(result.status)) return result;

    // A subject that is simply not here YET is not a subject that is gone. Hold
    // it on the layer's own deferred-restore latch for its source-specific
    // window before any verdict is reached or shown. `unsupported` layers have
    // no latch to arm, so they still decide immediately.
    if (result.status === 'missing' || result.status === 'source-unavailable') {
      return this._beginPendingTrackingRestore(selected, result, combinedSignal);
    }

    const classification = result.status === 'missing'
      ? this._classifyMissingTrackingTarget(selected)
      : 'source-unavailable';
    const cleared = this._passivelyClearTrackingSelection(selected);
    const terminal = { ...result, ...selected, classification, cleared };
    this._publishTrackingRestoreStatus(terminal);
    return terminal;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const controller of this._restoreControllers.values()) controller.abort('coordinator-destroyed');
    this._restoreControllers.clear();
    this._revokePendingTrackingWatch('coordinator-destroyed');
    this._trackingRestoreController = null;
    this._unsubscribe?.();
    this._unsubscribe = null;
    this._unsubscribeVisibilityRequests?.();
    this._unsubscribeVisibilityRequests = null;
    this.shareLinkManager?.setLayerStateProvider?.(null);
    this.onDurableStateChange = null;
    this.onTrackingRestoreStatus = null;
  }
}
