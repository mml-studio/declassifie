import * as Cesium from 'cesium';
import { addressMarkerGlyph } from './addressMarkerIcons.js';
import {
  ADDRESS_SCAN_MIN_SHIFT_KM, cameraScanPoint, createAddressScanLayer, mapKeyCarriesSelection,
} from './addressScanLayer.js';
import { clearBuildingTheme, registerBuildingTheme } from './buildingTheme.js';
import { DVF_SECTION_MIN_PRICED, mostRecentMutation, saleKind } from './dvfFeed.js';
import { groundShapeAt } from './groundAreaPaint.js';
import { drawGroundHighlight } from './groundHighlight.js';
import { publishJoin } from './layerJoins.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';
import { drawScanBoundary } from './scanBoundary.js';
import { createScanAreaLevels } from './scanAreaFade.js';
import { SCAN_BANDS, SCAN_CELL_MIN_ALTITUDE_M, scanCellParams } from './scanRegime.js';
import { gpuClassificationTypeForScene } from './urbanismeGpu.js';
import {
  formatDate, formatDecimal, formatEuros, formatEurosPerM2, formatNumber,
} from '../i18n/format.js';
import { labelFor } from '../i18n/messages.js';
import messages, { NATURE, TYPE_LOCAL } from './dvfSales.i18n.js';

/**
 * DVF — what the flats around this point actually sold for, on the buildings
 * they sold in.
 *
 * The register is the file a French buyer opens by hand, one commune at a time.
 * Drawn in place it answers the question that survey does not: not "what is the
 * average in the 13th" but "what did the three buildings I can see change hands
 * for, and when".
 *
 * ── WHY SO MANY DOTS ARE NEUTRAL ───────────────────────────────────────────
 *
 * A price per square metre is a comparable only when the sale bought exactly
 * one dwelling. `dvfFeed.js` carries the measurement: one captured mutation is
 * a €32,000,000 building spread over 179 rows, and the obvious arithmetic turns
 * it into €1.28 million per square metre. Those sales are still drawn — they
 * happened — but in the neutral slate, with no ratio. A colour would be a claim
 * the register does not support.
 *
 * That neutral moved from `#7c8aa0` to `#9aa7bd` on 2026-09-03, and the reason
 * is measured, not aesthetic. Since these sales now also paint BUILDING VOLUMES
 * (below), the neutral has to stay distinguishable from `buildingTheme.js`'s
 * "nobody measured this one" wash. Against the six BD TOPO usage colours washed
 * and then darkened across the layer's whole height range, `#7c8aa0` sat at
 * ΔE76 **25.0** — exactly on `BUILDING_THEME_MIN_DELTA_E`, one rounding away
 * from reading as "no data". `#9aa7bd` measures **35.6** against the same set,
 * while staying at least **45.7** from every price class of the ramp. Two
 * different admissions, two colours nobody has to squint at.
 *
 * ── THE DENOMINATOR, AND WHY IT IS NOT THE VIEWPORT ANY MORE (C1) ──────────
 *
 * Until 2026-09-03 each sale was coloured against the median of the sales
 * inside the scan radius — the median of whatever the camera was pointing at.
 * `docs/CARTOGRAPHY.md` C1 forbids exactly that, and the fixture shows why it
 * is not a theoretical objection: inside ONE arrondissement the local median is
 * 8 857 €/m² from avenue de France and 12 406 €/m² from rue de Tolbiac 1.5 km
 * away, a 40 % swing with no row of data changed. Worse, both the cheapest
 * (6 797 €/m²) and the dearest (12 406 €/m²) sale of the captured sample came
 * out at *exactly* 1.00 × the local median when the camera sat on them — the
 * two extremes of the arrondissement, both painted "average yellow", because
 * the median of one sale is that sale.
 *
 * The ratio itself was never the problem: an absolute €/m² ramp paints all of
 * Paris one colour and stops answering "is this dear FOR HERE". So the fraction
 * stays and the denominator becomes stable and NAMED — the median of the
 * COMMUNE (the arrondissement, where one exists, because that is how DVF itself
 * publishes) over the editions in hand, computed by `dvfFeed.communeReference`
 * from the very rows the proxy already parsed. Against it the same six sales
 * spread across four classes: 6 797 → 0,76 (green), 7 182 → 0,80 (green),
 * 8 857 → 0,99 and 9 054 → 1,01 (yellow), 10 464 → 1,17 (amber), 12 406 → 1,39
 * (red). The extremes stop being average.
 *
 * The denominator is printed in the legend and on every card, because a ratio
 * whose denominator is not written down is not a measurement. It changes when
 * the reader crosses into another commune — which is a change of REFERENCE
 * TERRITORY, announced in the legend, not a phantom of the framing: widening
 * the view, zooming, or sharing the link never moves it. That is the C1
 * conformity test in the doctrine, and `dvfSales.test.mjs` runs it.
 *
 * The class breaks themselves are frozen ratios ({@link DVF_RATIO_BREAKS},
 * ±5 % and ±25 %), never quantiles of the sample, and the legend restates them
 * in €/m² at the current reference so a reader gets the bounds in the unit of
 * the phenomenon as well as in ratio.
 *
 * WHEN THERE IS NO DENOMINATOR. `basis: 'none'` is answered, never a silent
 * substitution — and it is provably unreachable while there is anything to
 * colour: the served sales are a subset of the mutations the reference is
 * computed from, so "no comparable in the commune" implies "no comparable on
 * screen". A sale that somehow arrived with a ratio and no basis is painted
 * `#c46be0` (ΔE76 63.1 from the nearest price class, 66.3 from the wash) and
 * gets its own legend row, because A1 does not admit an unmarked fallback even
 * for a state the test says cannot happen.
 *
 * ── THE VOLUMES (track 1 of the representation audit, #78) ─────────────────
 *
 * The layer registers a building theme (`buildingTheme.js`, precedence 20) so
 * that when Bâti 3D is on, the BD TOPO volumes carry this same ratio and the
 * street becomes the price map instead of a field of pins above the roofs.
 *
 * • **`reduce` takes the MOST RECENT mutation of the building, not a median of
 *   them.** Several sales on one volume is the normal case, and they are not
 *   contemporaries: the editions in hand span up to five years, so a median
 *   would publish a price that was never asked, at a date that does not exist.
 *   "Worst of the block" — the right answer for a DPE label — has no meaning
 *   here either: there is no bad price, only a high one. What a buyer is handed
 *   as a comparable is the last transaction, so that is what the volume shows.
 *   Ties are broken by the larger dwelling surface, then by mutation id, so the
 *   answer never depends on the order the proxy happened to concatenate its
 *   editions in.
 *
 * • **The most recent mutation wins even when it has no €/m².** Falling back to
 *   the most recent *comparable* one would paint a 2021 price onto a building
 *   that changed hands in 2024 for an undisclosed split — presenting a stale
 *   number as current, which is the worse lie. Instead the volume takes the
 *   neutral slate and its own legend row: "the last thing that happened here
 *   cannot be priced" is information, and it is *not* the same statement as
 *   "nothing happened here", which is the wash.
 *
 * • **The marker stays, at full size.** It is the click surface and the card,
 *   it is the only thing on screen when Bâti 3D is off, and it is drawn for
 *   sales the join cannot place on any volume. It is NOT shrunk when the theme
 *   paints, for two reasons: the layer would have to import the BD TOPO module
 *   to know whether volumes are actually loaded — the one-way coupling the
 *   theme registry exists to avoid — and marker size already carries "has a
 *   comparable €/m²" (19 px) versus "does not" (15 px). Making it also carry
 *   another layer's on/off state is A3, twice over.
 *
 * • **An unpainted volume is not a building nobody bought.** The scan asks the
 *   register about a 300 m disc; BD TOPO loads volumes over a box up to 9 km
 *   wide. Most unpainted volumes were therefore never asked about, so the
 *   theme's `unknownLabel` says "hors du rayon de 300 m ou sans mutation" and
 *   never "sans mutation". Publishing the layer's own reach as a fact about the
 *   market is A1 at the scale of a district.
 *
 * • **This layer does not count the volumes it paints.** The painted /
 *   unpainted tally belongs to whoever owns the geometry, and `bdtopo` prints
 *   it on its own row from the join it actually performed. Re-running the join
 *   here to publish a second number would be 2–9 ms of duplicated work for a
 *   figure that would be WRONG whenever Bâti 3D is off or the photoreal stack
 *   is up: this layer would claim 42 painted volumes with none on screen.
 *   What it publishes is what it knows — how many sales it handed over, how
 *   many of those can carry a colour, and what they are divided by.
 *
 * @module data/dvfSales
 */

/** Layer id — also the theme id in the building-theme registry. */
export const DVF_LAYER_ID = 'dvf-sales';

/**
 * WHICH SALES ARE DRAWN — the filter the reader kept thinking was already
 * there.
 *
 * Reported 2026-09-14, from rue des Basques in Bayonne: « j'ai l'impression
 * qu'on peut choisir soit de voir les appartements, soit de voir les maisons
 * […] beaucoup de ventes de maisons apparaissent, il n'y a que du collectif
 * ici ». Both halves of that were wrong and the interface was why. The chips
 * on the row said `Appart.` and `Maison`, and they belonged to the ESTIMATE
 * next door — they chose the subject a value was computed for and never
 * touched a single dot on the map. So the reader, with `Maison` lit, was
 * looking at 257 flats and reading them as houses. The register's own count
 * within 300 m of that point, over five editions: zero houses.
 *
 * Two ways to fix that. Label the chips harder, or make them true. This is
 * the second, and `docs/CARTOGRAPHY.md` G1 is the reason it is not a
 * judgement call — « le filtre est le maillon manquant », named as the most
 * valuable missing component of the whole application. A reader who
 * spontaneously reaches for a control that is not there has said which
 * control to build.
 *
 * THREE VALUES AND NOT FOUR. `autre` — a commercial local, a cellar or a
 * parking space alone, bare land — is not offered as a class of its own
 * because nobody opens a price layer to look for a parking space; it is
 * included in `tous`, counted in the disclosure line when a filter hides it,
 * and named on its own card. `dvfFeed.saleKind` holds the fold and the
 * measurement behind it.
 *
 * IT IS A DRAW-ONLY PARAMETER. The register served every mutation in the
 * radius; filtering is a subset of rows already in memory, so the chip never
 * costs a request (`drawOnlyParams`, `addressScanLayer.js`). And the COLOURS
 * do not move when it changes: the denominator is the commune median over
 * every mutation of the editions, which is what C1 requires and what makes
 * "the flats here are dearer than this commune" a sentence that survives the
 * filter being on.
 *
 * THE VALUES ARE THE ESTIMATE'S OWN WORDS, and that is load-bearing rather
 * than tidy. `avis-valeur` sits on this same fused row and has always taken
 * `type: 'Appartement' | 'Maison'`; sharing the vocabulary is what lets one
 * chip steer both members through the manager's fan-out, so pressing
 * « Maisons » shows the houses AND estimates a house. One control, one reader
 * intention, two layers — instead of the two identical-looking strips of chips
 * that caused the confusion in the first place.
 */
// The ids are DATA: `tous` is a share-link token and the other two are the
// register's own `type_local`, which `avis-valeur` takes as its subject. The
// words are read when a chip is drawn, so one loaded layer labels itself in
// whichever language the page is in.
// i18n-ignore-start — `type_local` values and a share-link token.
export const DVF_TYPE_FILTERS = Object.freeze([
  Object.freeze({
    id: 'tous',
    get label() { return messages().filters.tous.label; },
    get title() { return messages().filters.tous.title; },
  }),
  Object.freeze({
    id: 'Appartement',
    get label() { return messages().filters.appartement.label; },
    get title() { return messages().filters.appartement.title; },
  }),
  Object.freeze({
    id: 'Maison',
    get label() { return messages().filters.maison.label; },
    get title() { return messages().filters.maison.title; },
  }),
]);
// i18n-ignore-end

/**
 * The sales a filter keeps.
 * @param {Array<object>} sales
 * @param {string} filter One of {@link DVF_TYPE_FILTERS} ids.
 * @returns {Array<object>}
 */
export function filterSalesByType(sales, filter) {
  const list = Array.isArray(sales) ? sales : [];
  // i18n-ignore-next-line — `type_local` values in, `saleKind` folds out.
  const wanted = filter === 'Appartement' ? 'appartement' : (filter === 'Maison' ? 'maison' : null);
  if (!wanted) return list;
  return list.filter((sale) => saleKind(sale) === wanted);
}

/** Refresh cadence. Editions are annual; this is about camera movement. */
const UPDATE_INTERVAL_MS = 600_000;
const SCAN_RADIUS_M = 300;

/**
 * The PLOT a sale bought, washed onto the ground under its marker.
 *
 * A euro sign floating over an oblique photoreal city names no building. The
 * register already says which ground changed hands — `id_parcelle` on every
 * mutation row, the same 14-character key Etalab's open cadastre is indexed
 * by, and the proxy joins the two (400 of 400 within 300 m of rue des
 * Basques in Bayonne; 170 distinct plots). So the layer draws the plot.
 *
 * CLAMPED, NOT EXTRUDED. `classificationType` paints the surface the globe is
 * actually drawing — terrain under a map basemap, the 3D tileset under the
 * photoreal stack — which is the one way a mark stays on the roofs instead of
 * 83 pixels beside them. It is also why the layer redraws on a map-stack
 * change: a classified primitive chooses its surface when it is BUILT.
 *
 * LIGHTER INK THAN THE CADASTRE'S OWN 0.28. The parcels are not the subject
 * here — the sale is — and the wash is a locator under a marker, not a plan.
 * The boundary is the part that survives being small, so it keeps most of the
 * opacity, exactly as `adsUrbanisme.js` found for its emprises.
 *
 * ONE PLOT, ONE COLOUR, AND IT IS THE MOST RECENT SALE'S. Several mutations
 * on one plot is the normal case and they are not contemporaries; this is the
 * same reduction {@link dvfMostRecentSale} makes for a building volume, and
 * it is the same function, so a plot and the volume standing on it can never
 * be painted from two different transactions.
 */
const PARCEL_FILL_ALPHA = 0.2;
const PARCEL_OUTLINE_ALPHA = 0.85;
const PARCEL_OUTLINE_WIDTH_PX = 1.4;

/**
 * Marker size, in CSS px. A sale with a comparable ratio is the one worth
 * reading, so it gets the pixels; a neutral one still has to be visible enough
 * to click, because WHY it has no ratio is on its card.
 */
const SIZE_COMPARABLE_PX = 19;
const SIZE_NO_RATIO_PX = 15;

/**
 * The sale happened, the register cannot price it. Measured ΔE76 35.6 from the
 * nearest "no data" wash of `buildingTheme.js` and 45.7 from the nearest class
 * of the ramp below — see the header for why it is no longer `#7c8aa0`.
 */
export const COLOR_NO_RATIO = '#9aa7bd';

/**
 * The sale has a €/m² and there is no commune median to divide it by. Provably
 * unreachable with a well-formed payload (see the header); painted loudly
 * rather than folded into {@link COLOR_NO_RATIO}, because A1 does not allow one
 * sign for two different admissions.
 */
export const COLOR_NO_BASIS = '#c46be0';

/**
 * The frozen class breaks, in RATIO to the commune median — domain thresholds,
 * published, never quantiles of whatever is on screen (C1).
 *
 * ±5 % is the band inside which two flats in the same street are the same
 * price; ±25 % is where a buyer stops calling it a variation and starts asking
 * what is wrong with it. Five classes, not seven: B3 caps what a reader can
 * separate, and neighbouring classes measure ΔE76 26.0 (amber/yellow) to 48.9
 * (yellow/light green) apart, all above the ~10 at which two colours stop
 * sharing a name.
 *
 * GREEN BELOW, NOT TEAL, since 2026-09-21. The bottom class was `#3dd6c4`, a
 * turquoise nobody reads as "cheap": green for below and red for above is the
 * pair a reader decodes without the key. The two greens are kept apart by
 * LIGHTNESS rather than by hue — `#7ed957` light, `#0f8f55` deep, ΔE76 42.1 —
 * because two greens of one lightness become one class at 19 px. The price is
 * a protanope, who sees the deep green and the red at nearly the same grey
 * (ΔE76 ≈ 8 simulated): the two ends of the scale, never neighbours, and the
 * card always prints the €/m².
 *
 * Diverging on purpose, and centred on the reference rather than on a range:
 * green below, yellow at the median, red above. The lightness peak sits at the
 * centre class, which is what a diverging ramp is supposed to do — the ORDER a
 * reader has to recover here is "away from the reference, in which direction",
 * not "more of something".
 */
export const DVF_RATIO_BREAKS = Object.freeze([1.25, 1.05, 0.95, 0.75]);

/** @type {ReadonlyArray<{id: string, min: number, color: string, label: string, blurb: string}>} */
export const DVF_RATIO_CLASSES = Object.freeze([
  Object.freeze({
    id: 'very-high',
    min: 1.25,
    color: '#ff6b4a',
    get label() { return messages().classes.veryHigh.label; },
    get blurb() { return messages().classes.veryHigh.blurb; },
  }),
  Object.freeze({
    id: 'high',
    min: 1.05,
    color: '#ffb03d',
    get label() { return messages().classes.high.label; },
    get blurb() { return messages().classes.high.blurb; },
  }),
  Object.freeze({
    id: 'at-median',
    min: 0.95,
    color: '#ffe066',
    get label() { return messages().classes.atMedian.label; },
    get blurb() { return messages().classes.atMedian.blurb; },
  }),
  Object.freeze({
    id: 'low',
    min: 0.75,
    color: '#7ed957',
    get label() { return messages().classes.low.label; },
    get blurb() { return messages().classes.low.blurb; },
  }),
  Object.freeze({
    id: 'very-low',
    min: -Infinity,
    color: '#0f8f55',
    get label() { return messages().classes.veryLow.label; },
    get blurb() { return messages().classes.veryLow.blurb; },
  }),
]);

/**
 * The €/m² a colour may be computed from, or null.
 *
 * `prixM2` is already null for everything `dvfFeed.js` refuses to price. The
 * one thing left to refuse here is a ratio of zero: a mutation declared at
 * €0 divides to 0 €/m², which is a finite number the ramp would happily paint
 * as "75 % below the commune" — the same shape of error as the €2,295 swap the
 * feed already rejects. No captured row shows it; the guard is one comparison.
 * @param {?object} sale
 * @returns {?number}
 */
export function saleRatioPrice(sale) {
  const value = sale?.prixM2;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The class a price falls in, against a NAMED reference median.
 * @param {?number} prixM2
 * @param {?number} referenceMedian The commune median. Never a viewport median.
 * @returns {?object} One of {@link DVF_RATIO_CLASSES}, or null.
 */
export function saleRatioClass(prixM2, referenceMedian) {
  if (!(typeof prixM2 === 'number' && Number.isFinite(prixM2) && prixM2 > 0)) return null;
  if (!(typeof referenceMedian === 'number' && Number.isFinite(referenceMedian)
    && referenceMedian > 0)) return null;
  const ratio = prixM2 / referenceMedian;
  return DVF_RATIO_CLASSES.find((entry) => ratio >= entry.min) || null;
}

/**
 * The CSS colour of a sale.
 *
 * THREE outcomes, three signs (A1): a price class, "sold but not priceable",
 * and "priced but nothing named to divide by".
 * @param {?number} prixM2
 * @param {?number} referenceMedian Commune median, from `summary.reference`.
 * @returns {string} `#rrggbb`
 */
export function saleColorCss(prixM2, referenceMedian) {
  if (!(typeof prixM2 === 'number' && Number.isFinite(prixM2) && prixM2 > 0)) return COLOR_NO_RATIO;
  const klass = saleRatioClass(prixM2, referenceMedian);
  return klass ? klass.color : COLOR_NO_BASIS;
}

/**
 * The Cesium colour of a sale marker.
 * @param {?number} prixM2
 * @param {?number} referenceMedian Commune median. NOT the median on screen.
 * @returns {object} Cesium colour.
 */
export function saleColor(prixM2, referenceMedian) {
  return Cesium.Color.fromCssColorString(saleColorCss(prixM2, referenceMedian));
}

/** A euro amount, in the page's language: `245 000 €` / `€245,000`. */
function euros(value) {
  return Number.isFinite(value) ? formatEuros(value) : '—';
}

/** A €/m², rounded as this layer has always rounded it. */
function eurosPerM2(value) {
  return Number.isFinite(value) ? formatEurosPerM2(Math.round(value)) : '—';
}

/** `1,39` / `1.39` — two decimals. */
function ratioText(ratio) {
  return formatNumber(ratio, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Name the editions the reference was computed over.
 * @param {Array<number>} years
 * @returns {?string}
 */
export function dvfYearsLabel(years) {
  const list = [...new Set((Array.isArray(years) ? years : [])
    .map((year) => Number.parseInt(year, 10))
    .filter((year) => Number.isFinite(year)))].sort((a, b) => a - b);
  if (!list.length) return null;
  const m = messages();
  if (list.length === 1) return m.years.one(list[0]);
  const contiguous = list[list.length - 1] - list[0] === list.length - 1;
  return contiguous
    ? m.years.span(list[0], list[list.length - 1])
    : m.years.list(list.join(', '));
}

/**
 * The denominator, resolved and named, from the payload the proxy served.
 *
 * `basis` is one of `'commune'` (a median exists), `'none'` (the editions hold
 * no comparable at all) or `'absent'` (the payload carries no reference block —
 * an older cached answer). None of the three is allowed to fall back to the
 * median of what is on screen; the last two colour nothing and say so.
 * @param {?object} payload
 * @returns {object}
 */
export function dvfReference(payload) {
  const m = messages();
  const raw = payload?.summary?.reference || null;
  const median = typeof raw?.medianPrixM2 === 'number' && Number.isFinite(raw.medianPrixM2)
    && raw.medianPrixM2 > 0
    ? raw.medianPrixM2
    : null;
  const name = raw?.name || payload?.commune?.name || null;
  const code = raw?.code || payload?.commune?.code || null;
  const territory = name || (code ? m.reference.byCode(code) : null);
  const yearsLabel = dvfYearsLabel(payload?.years);
  return {
    basis: raw ? (median === null ? 'none' : 'commune') : 'absent', // i18n-ignore-line — keys
    medianPrixM2: median,
    name,
    code,
    territory,
    yearsLabel,
    comparableCount: Number.isFinite(raw?.comparableCount) ? raw.comparableCount : 0,
    count: Number.isFinite(raw?.count) ? raw.count : 0,
    unplacedCount: Number.isFinite(raw?.unplacedCount) ? raw.unplacedCount : 0,
    p25PrixM2: Number.isFinite(raw?.p25PrixM2) ? raw.p25PrixM2 : null,
    p75PrixM2: Number.isFinite(raw?.p75PrixM2) ? raw.p75PrixM2 : null,
    /** The sentence that has to travel with every colour this layer draws. */
    label: median === null
      ? (raw
        ? m.reference.none(territory || m.reference.thisCommune)
        : m.reference.absent)
      : m.reference.median(territory || m.reference.theCommune, eurosPerM2(median)),
  };
}

/**
 * The class breaks restated in €/m² at the current reference.
 *
 * D2 asks for bounds a reader can hold. `≥ 1,25 ×` is the frozen rule; `≥
 * 11 195 €/m²` is what the rule means here, and only the second one can be
 * compared to a listing.
 * @param {?number} referenceMedian
 * @param {object} klass One of {@link DVF_RATIO_CLASSES}.
 * @returns {?string}
 */
export function classBoundsText(referenceMedian, klass) {
  if (!(typeof referenceMedian === 'number' && referenceMedian > 0)) return null;
  const index = DVF_RATIO_CLASSES.indexOf(klass);
  const upper = index > 0 ? DVF_RATIO_CLASSES[index - 1].min : null;
  const lower = Number.isFinite(klass.min) ? klass.min : null;
  const lo = lower === null ? null : Math.round(referenceMedian * lower);
  const hi = upper === null ? null : Math.round(referenceMedian * upper);
  const m = messages();
  if (lo === null) return m.bounds.under(eurosPerM2(hi));
  if (hi === null) return m.bounds.over(eurosPerM2(lo));
  // The low bound is a bare number and the high one carries the unit: the
  // French writes `8 508 à 9 404 €/m²`, the English `€8,508 to €9,404/m²`.
  return m.bounds.between(formatNumber(lo), eurosPerM2(hi));
}

/**
 * The sentence that frames the classes: what they are divided by, over what,
 * and by what rule.
 *
 * It is the `legendNote` slot rather than a first entry of the key, and that
 * is the whole of the D1 argument applied honestly. The denominator is not a
 * CLASS — nothing on the map is painted in it — so printing it as a row with
 * an empty swatch and a six-line paragraph made the key open on something a
 * reader has to scroll past to reach the colours. Above the classes, in one
 * line, it does the same job in a tenth of the height.
 *
 * @param {object} reference From {@link dvfReference}.
 * @returns {string}
 */
export function dvfLegendNote(reference, { parcels = 0 } = {}) {
  const m = messages();
  const line = [
    reference.label,
    reference.yearsLabel,
    // The frozen rule, said once. Without it the €/m² bounds below read as
    // quantiles of what is on screen, which is exactly what C1 forbids and
    // exactly what this layer stopped doing on 2026-09-03.
    m.note.frozenClasses,
  ].filter(Boolean).join(' · ');
  // WHAT THE TINTED GROUND IS. The plots wear the same ramp as the markers —
  // one channel, one information — so they need no class of their own; what
  // they need is the sentence that says they are plots, and which of several
  // mutations each one is showing. Only when there are any: a commune Etalab
  // publishes no cadastre for must not be told it is looking at parcels.
  return parcels > 0 ? `${line} · ${m.note.tintedGround}` : line;
}

/**
 * The A5 slot: what this answer had to leave out, in one sentence.
 *
 * Three admissions used to be three legend rows with a paragraph each — the
 * scan radius buried inside the denominator's blurb, the clipping, and the
 * mutations the register publishes with no coordinate. They are not classes
 * and they were pushing the classes off the panel. They are still all here,
 * still all counted, on the line that is FOR what a key had to leave out.
 *
 * @param {object} reference From {@link dvfReference}.
 * @param {object} summary `payload.summary`.
 * @param {number} drawn How many sales were actually drawn.
 * @param {{filter?: string, hidden?: number}} [options] The type filter in
 *   force and how many served mutations it took off the map. A filter is the
 *   loudest reason a count on the row disagrees with the register, so it is
 *   the first thing this line says.
 * @returns {string}
 */
export function dvfLegendDisclosure(reference, summary, drawn, options = {}) {
  const m = messages();
  const parts = [];
  // A4: this silence has a cause, and it is not "these sales bought no
  // ground". Only said when the register DID name plots and the cadastre
  // could not return them — an answer with no `parcels` key at all is an
  // older cached payload, not a failure to report.
  if (Array.isArray(options.parcels) && options.parcels.length === 0 && drawn > 0) {
    parts.push(m.disclosure.noParcels);
  }
  const filter = DVF_TYPE_FILTERS.find((entry) => entry.id === options.filter);
  // i18n-ignore-next-line — share-link token
  if (filter && filter.id !== 'tous' && options.hidden > 0) {
    parts.push(m.disclosure.filtered(filter.label, options.hidden));
  }
  parts.push(m.disclosure.radius(SCAN_RADIUS_M));
  if (summary?.truncated) {
    parts.push(m.disclosure.truncated(drawn, summary.count));
  }
  if (reference.unplacedCount > 0) {
    parts.push(m.disclosure.unplaced(reference.unplacedCount));
  }
  const line = parts.join(' · ');
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}

/**
 * The key to the ramp (D1) — the CLASSES, and nothing that is not one.
 *
 * ── WHY THIS IS SHORTER THAN IT WAS, AND WHAT DID NOT LEAVE ────────────────
 *
 * Measured on Bayonne, 2026-09-14: ten entries, each with a paragraph under
 * it, filling the whole right rail and running off the bottom of the screen
 * before the Avis de valeur block underneath had shown its first line. Every
 * sentence in it was true and most of them were the wrong sentence to put in
 * front of somebody who had just switched the layer on. D1's test is « sans
 * ouvrir aucun panneau, l'utilisateur peut-il traduire une couleur en
 * valeur ? » — and a key you have to READ for a minute fails it as surely as
 * one that is hidden.
 *
 * So the key now holds exactly the six things that are painted, and the three
 * that were never classes moved to the two slots that exist for them:
 *
 *   · the DENOMINATOR and the frozen rule → {@link dvfLegendNote}, the block's
 *     own line, printed ABOVE the classes it divides;
 *   · the radius, the clipping and the mutations with no coordinate →
 *     {@link dvfLegendDisclosure}, the A5 line under the classes;
 *   · each class's sentence → its tooltip, which is where `_refreshMapLegend`
 *     puts a blurb once entries sit side by side.
 *
 * Nothing was deleted. The layer says the same things in a fifth of the
 * height, and the classes are visible without scrolling, which is the whole
 * of what the key is for.
 *
 * ── THE LABELS ARE €/m², NOT RATIOS ────────────────────────────────────────
 *
 * `+25 % et plus · 5 164 €/m² et plus` was both bounds on one line and it was
 * the longest line in the block. D2 asks for bounds a reader can hold, and of
 * those two only the second can be compared to a listing. The ratio is not
 * lost: the rule that produced it is stated once in the note above, where it
 * belongs — it is a property of the whole ramp, not of one class.
 *
 * `counts` is supplied when the caller knows what was drawn (the layer's own
 * row, counting SALES) and omitted when `buildingTheme.js` will fill it in by
 * matching swatch to painted colour (the Bâti 3D row, counting VOLUMES). Same
 * ramp, two populations, and neither of them invented.
 * @param {object} reference From {@link dvfReference}.
 * @param {?Map<string, number>} counts class id → count, or null.
 * @param {{neutral?: ?{label: string, blurb: string}}} [options] The neutral
 *   row's words when the shapes on screen state it differently — a section is
 *   neutral for having too few priced sales, not for having none.
 * @returns {Array<object>}
 */
export function dvfLegendEntries(reference, counts = null, { neutral: neutralWords = null } = {}) {
  const m = messages();
  const entries = [];
  for (const klass of DVF_RATIO_CLASSES) {
    const bounds = classBoundsText(reference.medianPrixM2, klass);
    const entry = {
      label: bounds || klass.label,
      color: klass.color,
      // The ratio leads the tooltip, because that is the class's DEFINITION
      // and the label is only what it means at today's reference.
      blurb: m.classTooltip(klass.label, klass.blurb),
    };
    if (counts) entry.count = counts.get(klass.id) || 0;
    entries.push(entry);
  }
  const neutral = {
    label: neutralWords?.label || m.noRatio.label,
    color: COLOR_NO_RATIO,
    blurb: neutralWords?.blurb || m.noRatio.blurb,
  };
  if (counts) neutral.count = counts.get('no-ratio') || 0;
  entries.push(neutral);
  if (counts && (counts.get('no-basis') || 0) > 0) {
    entries.push({
      label: m.noBasis.label,
      color: COLOR_NO_BASIS,
      count: counts.get('no-basis') || 0,
      blurb: m.noBasis.blurb,
    });
  }
  return entries;
}

/**
 * N sales on one building → the one the volume speaks for.
 *
 * The reduction itself lives in `dvfFeed.js` (`mostRecentMutation`) since
 * 2026-09-21, because the proxy now makes it too — for every plot of a box
 * seen from above 600 m — and a plot must wear the same sale's colour on both
 * sides of that altitude. See the header for why recency and not a median.
 * @param {Array<object>} sales
 * @returns {?object}
 */
export function dvfMostRecentSale(sales) {
  return mostRecentMutation(sales);
}

/* ── the building theme ────────────────────────────────────────────────── */

/**
 * Lower than the default 100 and lower than the permit registers, higher than
 * DPE: when a reader turns on both the energy label and the price, the label is
 * the rarer, more legally loaded reading and keeps the volumes. The number is
 * the layer's claim on the geometry, not a ranking of the datasets.
 */
export const DVF_THEME_PRECEDENCE = 20;

/** The payload the theme currently speaks for, so `enable()` can republish. */
let _themePayload = null;
let _themeEnabled = false;

/**
 * The type filter in force, mirrored out of the shell's runtime.
 *
 * WRITTEN FROM `render`, WHICH IS THE ONLY PLACE THAT CANNOT BE LATE. The
 * first version mirrored it from `rowControls` and drew every filter change
 * one click behind: `setParams` redraws immediately, `rowControls` runs on the
 * next panel refresh, and those are two different ticks. Measured in Bayonne —
 * « Maisons » pressed and 397 flats still on screen, then « Toutes » pressed
 * and the single house appearing.
 *
 * It is mirrored at all because the THEME has no call frame of its own: it is
 * republished from `enable()` and from the registry's notifications, with no
 * runtime in reach, and a theme painting a different subset from the markers
 * above it would put the row, the key and the city in three populations.
 */
let _typeFilter = 'tous'; // i18n-ignore-line — share-link token

/**
 * Publish (or withdraw) the theme for the payload in hand.
 *
 * Withdrawing rather than publishing an empty theme is deliberate: a registered
 * theme with no points washes the WHOLE city to near-grey and labels it "sans
 * mutation", which is a statement about the register. When this layer is off,
 * or dormant above its altitude ceiling, it has nothing to say and must hand
 * the volumes back.
 *
 * Nothing here imports the BD TOPO layer. `registerBuildingTheme` notifies it,
 * it repaints itself, and it stops when the theme is cleared — one direction,
 * so a theme can never leave the city painted after its layer is switched off.
 */
/** Take-down for the per-parcel offer. Null while nothing is offered. */
let _unpublishByParcel = null;

/**
 * Offer the sales this scan already holds, keyed on the parcel they name.
 *
 * The building layer's card asks for "the last sale on this ground" and the
 * answer is ALREADY IN MEMORY: `id_parcelle` travels on every projected
 * mutation, and a BD TOPO volume resolves to the same 14-character id through
 * the RNB. So the join is a lookup, not a second scan of the register — and it
 * is offered rather than imported, so a reader who closes this row takes the
 * line off that card and nothing else changes.
 *
 * WHAT IT IS NOT is a claim about the parcel's whole history: the scan is a
 * disc of {@link SCAN_RADIUS_M} around one point over a bounded run of years,
 * so "no sale" here means "none in what was scanned" — which is why the line
 * exists only when there IS one.
 */
function publishByParcel() {
  const sales = _themeEnabled ? filterSalesByType(_themePayload?.sales, _typeFilter) : [];
  if (!sales.length) {
    _unpublishByParcel?.();
    _unpublishByParcel = null;
    return;
  }
  const byParcel = new Map();
  for (const sale of sales) {
    const key = String(sale?.parcelle || '').trim();
    if (!key) continue;
    const held = byParcel.get(key);
    // Most recent wins. `date` is ISO, so a string compare is a date compare.
    if (!held || String(sale.date || '') > String(held.date || '')) byParcel.set(key, sale);
  }
  _unpublishByParcel?.();
  _unpublishByParcel = publishJoin('dvf/byParcel', (parcelId) => (
    byParcel.get(String(parcelId || '').trim()) || null
  ));
}

function publishTheme() {
  publishByParcel();
  if (!_themeEnabled || !_themePayload) {
    clearBuildingTheme(DVF_LAYER_ID);
    return false;
  }
  const reference = dvfReference(_themePayload);
  // THE SAME SUBSET THE MARKERS DRAW. A filter the volumes did not honour
  // would put the row, the key and the city in three different populations —
  // « Appart. » lit, forty markers on screen, and a hundred and seventy
  // volumes painted from the houses that were filtered out of the count
  // beside them.
  const sales = filterSalesByType(_themePayload.sales, _typeFilter);
  registerBuildingTheme({
    id: DVF_LAYER_ID,
    label: messages().theme.label,
    precedence: DVF_THEME_PRECEDENCE,
    points: sales,
    reduce: dvfMostRecentSale,
    colorFor: (sale) => saleColorCss(saleRatioPrice(sale), reference.medianPrixM2),
    legend: dvfLegendEntries(reference),
    // The denominator travels WITH the swatches, because the row that prints
    // them is not this one: Bâti 3D borrows the ramp, and a ramp of ratios
    // with no named reference territory is unreadable there in exactly the
    // way it would be here.
    legendNote: dvfLegendNote(reference),
    // NOT "sans mutation". The scan asks the register about a 300 m disc while
    // BD TOPO loads volumes over a box up to 9 km wide, so most unpainted
    // volumes were never asked about at all. Labelling them "no sale recorded"
    // would turn the layer's own reach into a statement about the market —
    // the exact shape of A1, applied to a whole city block.
    unknownLabel: messages().theme.unknown(SCAN_RADIUS_M),
  });
  return true;
}

/**
 * Positions for one ring, closed. Three points is the least that encloses
 * anything; the same helper the other ground-polygon layers keep.
 * @param {Array<number[]>} ring
 * @returns {?Array<object>}
 */
function ringPositions(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  return Cesium.Cartesian3.fromDegreesArray(ring.flat());
}

/**
 * Wash the plots the drawn sales name, under the markers.
 *
 * The fill and the outline are SEPARATE entities because a ground-clamped
 * `polygon` cannot draw its own stroke in Cesium — `outline: true` is silently
 * ignored once the polygon is classified. Both carry the same name and
 * description, so the edge of a plot opens the same card as its middle.
 *
 * Exported for its own test: "the plot is painted by its most recent sale, and
 * an unsold plot is not drawn at all" is the contract, and a later
 * simplification to "colour by whatever came first" would undo it silently.
 *
 * @param {object} dataSource
 * @param {Array<object>} parcels `[{id, parts}]` from the proxy.
 * @param {Array<object>} sales The sales that were actually DRAWN.
 * @param {object} reference From {@link dvfReference}.
 * @param {number} classificationType Cesium surface to clamp onto.
 * @param {?Map<string, object>} [saleByParcel] Filled with the sale each drawn
 *   plot is painted from, so a click on its edge can open that sale.
 * @returns {number} Plots drawn.
 */
export function drawDvfParcels(
  dataSource, parcels, sales, reference, classificationType, saleByParcel = null,
) {
  const list = Array.isArray(parcels) ? parcels : [];
  if (!list.length) return 0;
  const byParcel = new Map();
  for (const sale of sales) {
    const key = String(sale?.parcelle || '').trim();
    if (!key) continue;
    const held = byParcel.get(key);
    if (held) held.push(sale); else byParcel.set(key, [sale]);
  }
  const m = messages();
  let drawn = 0;
  for (const parcel of list) {
    // A plot whose every sale was filtered out is ground with nothing to say.
    // Not drawn: a wash with no marker on it reads as a sale the card cannot
    // open — the same rule `adsUrbanisme.js` applies to an emprise with no
    // dossier left in the served cut.
    const sale = dvfMostRecentSale(byParcel.get(parcel.id) || []);
    if (!sale) continue;
    saleByParcel?.set(parcel.id, sale);
    const price = saleRatioPrice(sale);
    const css = saleColorCss(price, reference.medianPrixM2);
    const fill = Cesium.Color.fromCssColorString(css).withAlpha(PARCEL_FILL_ALPHA);
    const stroke = Cesium.Color.fromCssColorString(css).withAlpha(PARCEL_OUTLINE_ALPHA);
    const name = sale.address || sale.commune || m.parcel.fallbackName;
    const description = [
      m.parcel.id(parcel.id),
      sale.date,
      euros(sale.valeur),
      dvfSaleKindLine(sale),
      price === null ? m.card.noComparable : eurosPerM2(price),
      m.parcel.lastSale,
    ].filter(Boolean).join(' · ');
    for (const [index, rings] of (parcel.parts || []).entries()) {
      const outer = ringPositions(rings[0]);
      if (!outer) continue;
      const holes = [];
      for (let h = 1; h < rings.length; h += 1) {
        const hole = ringPositions(rings[h]);
        // A courtyard is not part of the plot. Filled in, the wash would claim
        // ground the sale did not buy.
        if (hole) holes.push(new Cesium.PolygonHierarchy(hole));
      }
      dataSource.entities.add({
        id: `dvf-parcel:${parcel.id}:${index}`,
        name,
        description,
        properties: { kind: 'dvf-parcel', parcelle: parcel.id, saleId: sale.id },
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(outer, holes),
          material: fill,
          classificationType,
          outline: false,
        },
      });
      for (const [ringIndex, ring] of rings.entries()) {
        const positions = ringPositions(ring);
        if (!positions) continue;
        dataSource.entities.add({
          id: `dvf-parcel:${parcel.id}:${index}:${ringIndex}`,
          name,
          description,
          polyline: {
            positions: [...positions, positions[0]],
            width: PARCEL_OUTLINE_WIDTH_PX,
            material: new Cesium.ColorMaterialProperty(stroke),
            clampToGround: true,
            classificationType,
          },
        });
      }
    }
    drawn += 1;
  }
  return drawn;
}

/**
 * One mutation's card.
 *
 * `type_local` LEADS THE SECOND HALF OF IT, and it used to be on no card at
 * all. The map draws flats, houses, shops, cellars and bare land in one
 * vocabulary of dots; a reader looking at a dense city centre had no way to
 * find out which, and that is exactly how 257 Bayonne flats came to be read
 * as houses on 2026-09-14. The register's own wording is used, joined rather
 * than folded: `Appartement + Dépendance` says more than `Appartement` does,
 * and it is the reason the sale below it has no €/m² often enough to matter.
 *
 * THE SURFACE RIDES ON THAT LINE, and it used to be on a line of its own that
 * nobody saw. The shell paints six detail lines and drops the rest
 * (`createAddressScanOverlayEntry`); the surface was the seventh, after the
 * ratio, so every sale that could be compared to its commune — the ones a
 * reader clicks — lost it. Reported 2026-09-21 from Biarritz: a €1,250,000 flat
 * at €16,026/m² and no way to read that it was 78 m². Beside the type it is
 * one line, it survives the cap, and it reads as what it is: the size of what
 * was bought, the figure the €/m² below it was divided by.
 *
 * @param {object} sale One served mutation.
 * @param {object} reference From {@link dvfReference}.
 * @returns {string}
 */
export function dvfSaleCard(sale, reference) {
  const m = messages();
  const price = saleRatioPrice(sale);
  const comparable = price !== null;
  const ratio = comparable && reference.medianPrixM2 ? price / reference.medianPrixM2 : null;
  return [
    sale.date,
    // The register's own words, displayed: the VALUE stays what it parsed.
    labelFor(NATURE, sale.nature),
    euros(sale.valeur),
    dvfSaleKindLine(sale),
    comparable ? eurosPerM2(price)
      // Saying WHY there is no ratio is the point of drawing it neutral.
      : sale.dwellingCount > 1 ? m.card.dwellings(sale.dwellingCount)
        : m.card.noComparable,
    // The denominator travels with every single card, never only with the
    // legend: a ratio a reader cannot trace back to a named territory is a
    // decoration.
    ratio === null
      ? (comparable ? reference.label : null)
      : m.card.ratio(ratioText(ratio), reference.territory || m.reference.theCommune,
        eurosPerM2(reference.medianPrixM2)),
    Number.isFinite(sale.distanceM) ? `${sale.distanceM} m` : null,
  ].filter(Boolean).join(' · ');
}

/**
 * What was bought, and how big it is: `Appartement + Dépendance — 78 m²`.
 *
 * The surface is the register's `surface_reelle_bati` summed over the
 * dwellings of the mutation — the figure `dvfFeed.groupMutations` divides the
 * price by — so the €/m² printed under it can be checked by hand. A sale of
 * several dwellings says the surface is their TOTAL, because a 210 m² beside
 * « 3 logements » would otherwise read as the size of each.
 *
 * @param {object} sale One served mutation.
 * @returns {string}
 */
export function dvfSaleKindLine(sale) {
  const m = messages();
  const types = (sale?.types || []).map((type) => labelFor(TYPE_LOCAL, type)).join(' + ')
    || m.card.typeUnpublished;
  const surface = Number(sale?.dwellingSurface);
  if (!(Number.isFinite(surface) && surface > 0)) return types;
  return m.card.typeWithSurface(types, formatNumber(Math.round(surface)),
    Number(sale?.dwellingCount) > 1);
}

/** Count the drawn sales by the class they were painted in. */
function countByClass(sales, referenceMedian) {
  const counts = new Map();
  for (const sale of sales || []) {
    const price = saleRatioPrice(sale);
    if (price === null) {
      counts.set('no-ratio', (counts.get('no-ratio') || 0) + 1);
      continue;
    }
    const klass = saleRatioClass(price, referenceMedian);
    const key = klass ? klass.id : 'no-basis';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/**
 * One drawn mutation as a plain record the analyst engine can query.
 *
 * `prixM2` is carried EXACTLY as the register supports it — null for every
 * mutation `dvfFeed.js` refuses to price (a block sale, a flat sold with a
 * shop). That null is the whole point: the engine drops non-finite values from
 * min/max, so a €32,000,000 building spread over 179 lots can never enter a
 * price answer, while the sale itself still counts as a sale. `priced` is the
 * same fact as a flag, so "the sales that have a price per square metre" is a
 * filter rather than a thing the model has to infer from a missing field.
 *
 * @param {object} sale One entry of the proxy's `sales` array.
 * @returns {object|null} A record, or null when it has no position to sit on.
 */
export function dvfSaleRecord(sale) {
  if (!sale || !Number.isFinite(sale.lat) || !Number.isFinite(sale.lon)) return null;
  const year = Number(String(sale.date || '').slice(0, 4));
  return {
    id: `dvf:${sale.id}`,
    lat: sale.lat,
    lon: sale.lon,
    prixM2: Number.isFinite(sale.prixM2) ? sale.prixM2 : null,
    valeurEur: Number.isFinite(sale.valeur) ? sale.valeur : null,
    surfaceM2: sale.dwellingSurface > 0 ? sale.dwellingSurface : null,
    rooms: Number.isFinite(sale.rooms) ? sale.rooms : null,
    dwellings: Number.isFinite(sale.dwellingCount) ? sale.dwellingCount : null,
    distanceM: Number.isFinite(sale.distanceM) ? sale.distanceM : null,
    year: Number.isFinite(year) ? year : null,
    date: sale.date || null,
    nature: sale.nature || null,
    propertyType: (sale.types || []).join(', ') || null,
    address: sale.address || null,
    commune: sale.commune || null,
    priced: Number.isFinite(sale.prixM2),
  };
}

/**
 * What this layer has to SAY about the block it just scanned.
 *
 * The numbers are lifted from `getStats()` rather than recomputed, so the
 * sentence the voice speaks and the figures on the panel are the same
 * measurement — the failure this repository keeps guarding against is two
 * honest numbers for one question. Nothing here is derived: the block median,
 * its quartiles and the commune denominator were all computed by the proxy
 * from the rows it parsed, and the voice surface only names them.
 *
 * Null when the layer has nothing to speak for — off, or dormant above its
 * altitude ceiling — because "no median" and "a median of nothing" are
 * different statements and only the first one is true.
 *
 * `pending` is the third state and it earns its own field. A layer switched on
 * a second ago has not scanned yet, and the absence of a summary reads exactly
 * like "this place has no data": measured on a live session, the model was
 * asked for the price at an address it had just flown to and answered that the
 * layers "ne remontent aucune donnée", half a second before they did.
 *
 * @param {object|null} stats The layer's own `getStats()` output.
 * @returns {object|null} Named, speakable fields, or null.
 */
export function dvfVoiceSummary(stats) {
  if (!stats || stats.dormant) return null;
  const subject = messages().voice.subject;
  // THE AREA REGIMES NEED THEIR OWN SENTENCE, and this is not a nicety. Left
  // to fall through, a box answer would have been published with
  // `radiusM: SCAN_RADIUS_M` beside it — a caller would have said "sur les
  // 300 m autour de vous" about ground two kilometres across. The regime is
  // named, the reach is the box, and the per-sale list is declared ABSENT
  // rather than empty: `getAnalystRecords` returns nothing up here, and a
  // caller that read that as "no sales" would be inverting the answer.
  if (stats.scanBasis === 'plots' || stats.scanBasis === 'sections') {
    const plots = stats.scanBasis === 'plots';
    return {
      subject,
      basis: stats.scanBasis,
      measuredAt: stats.scanCentre ? { ...stats.scanCentre } : null,
      communes: stats.communes ?? null,
      years: stats.years ?? null,
      shapesDrawn: stats.shapeCount ?? 0,
      salesInView: stats.salesFound ?? 0,
      pricedSales: stats.comparableCount ?? 0,
      viewMedianPrixM2: stats.localMedianPrixM2 ?? null,
      // One per commune, because the colours were read against several.
      communeReferences: stats.references ?? null,
      // i18n-ignore-start — read by the model, not by the reader; see the
      // note at the top of src/voice/gevActions.js.
      note: (plots
        ? 'The camera is between 600 m and 1,800 m: this layer paints every PLOT '
          + 'sold in the view, each by its most recent sale, and holds no list of '
          + 'sales to rank. '
        : 'The camera is above 1,800 m: this layer paints cadastral SECTIONS by '
          + 'the median of their sales, and holds no list of sales to rank. ')
        + 'Say the view median with the municipalities behind it. For one '
        + `property, fly below ${SCAN_CELL_MIN_ALTITUDE_M} m and ask again.`,
      // i18n-ignore-end
    };
  }
  if (!Number.isFinite(stats.salesFound)) {
    return {
      subject,
      pending: true,
      // i18n-ignore-start — read by the model, not by the reader; see above.
      note: 'The register has not answered for this point yet. Say the reading is '
        + 'coming and ask again in a moment — this is NOT "no sales here".',
      // i18n-ignore-end
    };
  }
  return {
    subject,
    // WHERE it was measured, not just what. A scan does not clear on arrival:
    // fly from Paris to Bordeaux and this summary describes the Paris block
    // until the new answer lands, and a caller with no way to tell would quote
    // one city's median over another's roofs.
    measuredAt: stats.scanCentre ? { ...stats.scanCentre } : null,
    commune: stats.commune ?? null,
    years: stats.years ?? null,
    radiusM: SCAN_RADIUS_M,
    salesInRadius: stats.salesFound,
    salesDrawn: stats.count ?? 0,
    // The gap between these two is what makes the median honest, so it travels
    // with it: a block of 255 sales of which 96 can carry a price per square
    // metre is not a block of 255 prices.
    pricedSales: stats.comparableCount ?? 0,
    truncated: stats.truncated === true,
    blockMedianPrixM2: stats.localMedianPrixM2 ?? null,
    blockP25PrixM2: stats.p25PrixM2 ?? null,
    blockP75PrixM2: stats.p75PrixM2 ?? null,
    // The denominator the colours are read against, named — a ratio whose
    // reference territory is not stated is not a measurement (see the header).
    communeMedianPrixM2: stats.referenceMedianPrixM2 ?? null,
    communeReference: stats.referenceLabel ?? null,
  };
}

/* ── the area regimes ──────────────────────────────────────────────────── */
/**
 * Above 600 m this layer stops drawing one mark per sale and paints the
 * CADASTRE: from 600 m to 1 800 m every plot a sale in the box names, painted
 * by its most recent sale; above that, every cadastral section, painted by the
 * median of its sales. `scanRegime.js` owns the altitudes, and
 * `dvfFeed.aggregateSalesIntoPlots` the measurements that put them there.
 *
 * WHY NOT DISCS ANY MORE. Until 2026-09-21 both bands were grids of discs,
 * 150 m and 850 m wide, sized by their count. The operator's verdict on
 * screen: « je n'aime pas trop ces cercles d'affichage par zone, j'aurais
 * préféré qu'on vienne directement dessiner les parcelles ». A disc fell
 * across two blocks and a boulevard and named no ground a reader could see;
 * a plot is the ground the register says changed hands, and a section is the
 * cadastre's own subdivision of a commune.
 *
 * THE COLOUR LANGUAGE DOES NOT CHANGE. Plots and sections are painted from
 * {@link DVF_RATIO_CLASSES} — the same five frozen bands, each sale divided by
 * the median of ITS OWN commune — so a reader who learned the ramp at street
 * level reads the same ramp from altitude. A plot even keeps the very colour
 * it wears under its markers below 600 m: it is painted from the same sale,
 * picked by the same function (`dvfFeed.mostRecentMutation`).
 *
 * DRAWN BY `groundAreaPaint.js` — primitives, one classification batch per
 * colour, a click answered by geometry — which the energy-rating layer shares
 * since 2026-09-22; the reasons for each of those three are written there.
 */

/**
 * Ink. Heavier than the 0.2 wash under the markers below 600 m, because up
 * here the plot IS the mark — there is no euro sign above it to carry the
 * colour — and lighter for a section, which covers a block where a plot covers
 * a building: the same alpha would put ten times the ink on screen for the
 * same claim, and a layer that hides the map is a replacement, not a layer.
 */
const AREA_STYLE = Object.freeze({
  plots: Object.freeze({ fill: 0.34, outline: 0.9, widthPx: 1.2 }),
  sections: Object.freeze({ fill: 0.24, outline: 0.85, widthPx: 1.4 }),
});

/** Top of the plot band — the altitude the section cards send a reader under. */
const PLOT_BAND_MAX_ALTITUDE_M = SCAN_BANDS.find((band) => band.dvfUnit === 'plots')?.maxAltitudeM;

/**
 * Which area answer the SHELL holds: `'plots'`, `'sections'`, or null for the
 * disc regime. Written by `render` from the payload and read by `minShiftKm`,
 * never derived from the camera: the two disagree for exactly as long as a
 * scan is in flight, and during that window the threshold has to describe what
 * is drawn.
 */
let _areaUnit = null;

/**
 * The plots and the sections on the globe, as two levels that fade into each
 * other between 1 080 m and 1 800 m (`scanRegime.SCAN_SECTION_FADE`), each
 * painted by its own `groundAreaPaint`. The shell's answer is one of them;
 * inside the band the other is the sections, asked for around the same point
 * — see `scanAreaFade.js`.
 *
 * WHY THE TWO MAY FADE: a section is painted by the MEDIAN of the ratios its
 * plots are painted by one at a time (the latest sale's) — the same rows, the
 * same commune medians, the same five frozen classes (`dvfFeed.areaInputs`).
 * A median is the colour a coarser unit of the same ratios takes; a COUNT would
 * not have been, and is not what either level paints.
 *
 * WHAT A FADE STEP COSTS: one colour attribute per instance, written only when
 * the quantised weight moves. The densest plot box measured holds 1 698 plots
 * (Paris 17e, `dvfFeed.aggregateSalesIntoPlots`), a section box ~400 sections:
 * a few thousand typed-array writes in the frames of a zoom through the band,
 * none while the camera is still.
 */
const _areaLevels = createScanAreaLevels({
  ownerId: 'dvf-sales',
  names: { fine: 'plots', coarse: 'sections' },
  renderReason: 'dvf-area-build',
  endpoint: '/api/dvf',
  unitOf: (payload) => {
    const unit = dvfAreaUnit(payload);
    if (unit === 'plots') return 'fine';
    return unit === 'sections' ? 'coarse' : null;
  },
  paintOf: (level, payload) => dvfAreaPaint(payload),
  // The shell's own question, lifted to the coarse band: the box only, as
  // `params` asks it — the type filter never reaches the proxy.
  coarseParams: (point) => scanCellParams(point),
  scanPoint: cameraScanPoint,
});

/**
 * The regime a payload answers in.
 * @param {?object} payload
 * @returns {?string} `'plots'`, `'sections'`, or null for the disc.
 */
export function dvfAreaUnit(payload) {
  if (Array.isArray(payload?.plots)) return 'plots';
  if (Array.isArray(payload?.sections)) return 'sections';
  return null;
}

/**
 * Whether a pick id is one of this layer's area shapes — the ids
 * {@link drawDvfArea} gives its geometry instances.
 * @param {?string} pickedId @returns {boolean}
 */
export function isDvfAreaPickId(pickedId) {
  const id = String(pickedId ?? '');
  return id.startsWith('dvf-plot:') || id.startsWith('dvf-section:');
}

/**
 * The class a ratio falls in.
 * @param {?number} ratio A sale's price over its own commune's median.
 * @returns {?object} One of {@link DVF_RATIO_CLASSES}, or null.
 */
export function dvfRatioClass(ratio) {
  if (!(typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0)) return null;
  return DVF_RATIO_CLASSES.find((entry) => ratio >= entry.min) || null;
}

/**
 * The class a plot is painted in: its latest sale's, or none when that sale
 * carries no €/m² — the rule the plot keeps below 600 m (see the header).
 * @param {object} plot @returns {?object}
 */
export function dvfPlotClass(plot) {
  return dvfRatioClass(plot?.ratio);
}

/**
 * The class a section is painted in: the median of its sales' ratios, and
 * only from {@link DVF_SECTION_MIN_PRICED} priced sales up — see there for why
 * a section needs a floor the discs did not.
 * @param {object} section @returns {?object}
 */
export function dvfSectionClass(section) {
  if (!(Number(section?.pricedCount) >= DVF_SECTION_MIN_PRICED)) return null;
  return dvfRatioClass(section?.medianRatio);
}

/** The class of any area shape, by unit. */
function areaClass(unit, record) {
  return unit === 'plots' ? dvfPlotClass(record) : dvfSectionClass(record);
}

/** The CSS colour of an area shape. Neutral when it has no class. */
export function dvfAreaColorCss(unit, record) {
  return areaClass(unit, record)?.color || COLOR_NO_RATIO;
}

/** class id → number of SHAPES, for the key's bar. */
export function countAreaByClass(unit, records) {
  const counts = new Map();
  for (const record of records || []) {
    const id = areaClass(unit, record)?.id || 'no-ratio';
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

/**
 * The reference an area key is read against, shaped like {@link dvfReference}
 * so the legend builders take it unchanged.
 *
 * `medianPrixM2` IS NULL AS SOON AS THERE ARE TWO COMMUNES, and that is not a
 * missing value. The box then has as many denominators as it has communes, so
 * there is no single €/m² the class breaks can be restated in — and
 * `dvfLegendEntries` falls back to the RATIO labels ("+25 % et plus") when it
 * has no median, which is the only honest label for a key with two references
 * behind it. The denominators are not hidden: they are named one by one in
 * the note. A box inside ONE commune — most of a Paris arrondissement from
 * 1 300 m — has one denominator, and gets the €/m² bounds the key prints
 * below 600 m (D2).
 *
 * @param {object} payload
 * @returns {object}
 */
export function dvfAreaReference(payload) {
  const m = messages();
  const references = payload?.summary?.references || [];
  const named = references.filter((entry) => Number.isFinite(entry?.medianPrixM2));
  return {
    basis: named.length ? 'communes' : 'none', // i18n-ignore-line — keys
    medianPrixM2: named.length === 1 ? named[0].medianPrixM2 : null,
    name: null,
    code: null,
    territory: null,
    yearsLabel: dvfYearsLabel(payload?.years),
    comparableCount: references.reduce((sum, entry) => sum + (entry.comparableCount || 0), 0),
    count: references.reduce((sum, entry) => sum + (entry.count || 0), 0),
    unplacedCount: 0,
    p25PrixM2: null,
    p75PrixM2: null,
    references: named,
    label: named.length ? m.area.reference(named.length) : m.area.noReference,
  };
}

/** The reference of one commune of an area answer, or null. */
function areaCommune(payload, code) {
  return (payload?.summary?.references || []).find((entry) => entry.code === code) || null;
}

/**
 * The key's neutral row in an area regime. For plots it is the one the sales
 * use — the latest sale carries no €/m² — and for sections it is the floor,
 * which is ONE admission and not two: « fewer than three priced sales »
 * includes none, and both say the same thing, that there is no median to
 * paint (A1 allows one sign per statement, not one per cause).
 */
function areaNeutral(unit) {
  const m = messages();
  return unit === 'sections'
    ? { label: m.area.sections.neutral(DVF_SECTION_MIN_PRICED),
      blurb: m.area.sections.neutralBlurb(DVF_SECTION_MIN_PRICED) }
    : null;
}

/**
 * The note above the key in an area regime: what the colours are divided by,
 * every denominator named, and what one painted shape is.
 * @param {object} payload @returns {string}
 */
export function dvfAreaLegendNote(payload) {
  const m = messages();
  const unit = dvfAreaUnit(payload);
  const reference = dvfAreaReference(payload);
  // EVERY DENOMINATOR, NOT A COUNT OF THEM, busiest first, capped at four
  // because a key is not a table. A ratio whose denominator is not written
  // down is not a measurement.
  const named = reference.references.slice(0, 4)
    .map((entry) => `${entry.name || entry.code} ${eurosPerM2(entry.medianPrixM2)}`);
  const more = reference.references.length - named.length;
  return [
    named.length
      ? m.area.references(`${named.join(' · ')}${more > 0 ? ` · +${more}` : ''}`)
      : reference.label,
    reference.yearsLabel,
    m.note.frozenClasses,
    unit === 'sections' ? m.area.sections.unit : m.area.plots.unit,
  ].filter(Boolean).join(' · ');
}

/**
 * The A5 line in an area regime: the box, what was drawn from it, and what the
 * probe and the cadastre could miss.
 * @param {object} payload @returns {string}
 */
export function dvfAreaDisclosure(payload) {
  const m = messages();
  const unit = dvfAreaUnit(payload);
  const summary = payload?.summary || {};
  const communes = payload?.communes || [];
  const spanKm = payload?.box
    ? formatDecimal((payload.box.north - payload.box.south) * 110.54, 1,
      { minimumFractionDigits: 1 })
    : null;
  const span = spanKm ? `${spanKm} km` : m.area.box;
  const parts = [];
  if (unit === 'sections') {
    parts.push(m.area.sections.drawn(span, Number(summary.sections || 0), Number(summary.count || 0)));
  } else {
    parts.push(m.area.plots.drawn(span, Number(summary.count || 0), Number(summary.plots || 0)));
  }
  // A4: the commune list comes from probing the box, not from intersecting it
  // — see `boxSamplePoints`. A commune no probe landed in contributes nothing,
  // and its ground is then empty for the same reason a field is.
  if (communes.length) parts.push(m.area.communes(communes.length, payload.communesProbed || 0));
  if (summary.unplotted > 0) parts.push(m.area.unplotted(summary.unplotted));
  if (summary.unshaped > 0) parts.push(m.area.unshaped(summary.unshaped));
  if ((payload?.unavailableYears || []).length) {
    parts.push(m.area.missingYears(payload.unavailableYears.join(', ')));
  }
  parts.push(unit === 'sections'
    ? m.area.sections.descend(PLOT_BAND_MAX_ALTITUDE_M)
    : m.area.plots.descend(SCAN_CELL_MIN_ALTITUDE_M));
  const line = parts.join(' · ');
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}

/**
 * The card a PLOT opens: the sale it is painted from, in the words the sale
 * card below 600 m uses, and which of the plot's sales that is.
 *
 * Six lines, because the card shell paints six — so the surface rides on the
 * type line ({@link dvfSaleKindLine}) exactly as it does on a marker's card.
 * @param {object} plot @param {object} payload
 * @returns {{title: string, details: string[]}}
 */
export function dvfPlotCard(plot, payload) {
  const m = messages();
  const sale = plot?.sale || {};
  const commune = areaCommune(payload, plot?.communeCode);
  const price = saleRatioPrice(sale);
  const ratio = typeof plot?.ratio === 'number' ? plot.ratio : null;
  return {
    title: sale.address || commune?.name || m.parcel.fallbackName,
    details: [
      [sale.date, labelFor(NATURE, sale.nature)].filter(Boolean).join(' · '),
      euros(sale.valeur),
      dvfSaleKindLine(sale),
      price !== null ? eurosPerM2(price)
        : sale.dwellingCount > 1 ? m.card.dwellings(sale.dwellingCount) : m.card.noComparable,
      ratio !== null && commune
        ? m.card.ratio(ratioText(ratio), commune.name || commune.code,
          eurosPerM2(commune.medianPrixM2))
        : null,
      m.area.plots.which(Number(plot?.count || 1), dvfYearsLabel(payload?.years)),
    ].filter(Boolean),
  };
}

/**
 * The section's own code as the cadastre prints it: `AH`, and `A` rather
 * than the file's zero-padded `0A`.
 */
function sectionCode(id) {
  const code = String(id || '').slice(8);
  return code.startsWith('0') ? code.slice(1) : code;
}

/**
 * The card a SECTION opens: what its colour is the median OF.
 * @param {object} section @param {object} payload
 * @returns {{title: string, details: string[]}}
 */
export function dvfSectionCard(section, payload) {
  const m = messages();
  const commune = areaCommune(payload, section?.communeCode);
  const klass = dvfSectionClass(section);
  const priced = Number(section?.pricedCount || 0);
  return {
    title: m.area.sections.title(sectionCode(section?.id), commune?.name || section?.communeCode || ''),
    details: [
      m.area.sections.sales(Number(section?.count || 0), priced),
      Number.isFinite(section?.medianPrixM2) ? m.area.sections.median(eurosPerM2(section.medianPrixM2)) : null,
      commune && Number.isFinite(commune.medianPrixM2)
        ? m.area.sections.against(eurosPerM2(commune.medianPrixM2), commune.name || commune.code)
        : null,
      klass ? klass.label : m.area.sections.neutral(DVF_SECTION_MIN_PRICED),
      (section?.years || []).length ? m.area.vintages(section.years.join(', ')) : null,
      m.area.sections.descend(PLOT_BAND_MAX_ALTITUDE_M),
    ].filter(Boolean),
  };
}

/**
 * The area shape under a ground point, or null — see `groundShapeAt`.
 * @param {number} lon @param {number} lat
 * @param {Array<object>} [shapes]
 * @returns {?object}
 */
export function dvfAreaShapeAt(lon, lat, shapes = _areaLevels.shapes()) {
  return groundShapeAt(lon, lat, shapes);
}

/**
 * The card for a click on the ground, in an area regime. Null in the disc
 * regime — its plots and markers are entities with cards of their own — and
 * null off every shape, so the click falls through to a dismissal.
 */
function dvfAreaGroundCard({ lon, lat, payload }) {
  if (!dvfAreaUnit(payload) || !_areaLevels.shapes().length) return null;
  const shape = dvfAreaShapeAt(lon, lat);
  if (!shape) return null;
  // Read against the answer the shape was painted from: inside the band a
  // section and a plot come from two answers over two boxes.
  const own = _areaLevels.payloadOf(shape) || payload;
  return shape.kind === 'plot'
    ? dvfPlotCard(shape.record, own)
    : dvfSectionCard(shape.record, own);
}

/** Take both area levels off the globe. Idempotent. */
function clearAreaDraw() {
  _areaLevels.clearAll();
}

/**
 * What one area answer paints: a shape per plot or section, in its class
 * colour, with the ink of its unit.
 * @param {object} payload
 * @returns {{items: Array<object>, style: ?object}}
 */
function dvfAreaPaint(payload) {
  const unit = dvfAreaUnit(payload);
  if (!unit) return { items: [], style: null };
  const kind = unit === 'plots' ? 'plot' : 'section';
  const items = (unit === 'plots' ? payload.plots : payload.sections).map((record) => ({
    id: `dvf-${kind}:${record.id}`,
    kind,
    record,
    parts: record?.parts,
    css: dvfAreaColorCss(unit, record),
  }));
  return { items, style: AREA_STYLE[unit] };
}

/**
 * Paint an area answer as the shell's level; the other level follows
 * (`scanAreaFade.js`).
 * @returns {number} Shapes drawn.
 */
function drawDvfArea(payload, context) {
  if (!dvfAreaUnit(payload) || !context?.viewer?.scene?.primitives) {
    clearAreaDraw();
    return 0;
  }
  return _areaLevels.primary(payload, context);
}

/* ── the selected sale: a lit plot, and its card beside the map ─────────── */

/**
 * Where the register itself can be read, from the card of any sale. The page
 * `dataCredits.js` already credits, so the key and the credits point at one
 * place.
 */
export const DVF_SOURCE_URL = 'https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees/';

/**
 * THE SELECTED PLOT, LIFTED OUT OF THE WASH (2026-09-21).
 *
 * A click used to change one thing on the globe: the marker turned cyan and
 * grew six pixels, while a card nine lines tall opened over the middle of the
 * map — over the very block the reader was looking at. The card now goes to
 * the map key, and the ground says which sale it is: the plot the sale bought
 * is painted again in its own class colour, strongly enough to read as a lit
 * building on the photoreal mesh (a ground classification paints every
 * surface of the tileset inside the plot, walls and roof alike), and ringed in
 * the same colour, thicker.
 *
 * THE RING IS NOT THE SELECTION CYAN, and the first version was. On the
 * photoreal mesh a ground polyline drapes down every wall standing on the
 * boundary, and a plot's boundary is where its façades are: the ring painted
 * the whole street front of 27 rue Port du Temple cyan, a building the colour
 * of no class, beside a key that says cyan means nothing. In the class colour
 * the façade reads as the price it is; the marker keeps the cyan.
 *
 * NOT the wash made thicker for everybody. The 0.2 wash under every marker is
 * a locator; this one is an answer to one question, and it goes when the card
 * does.
 *
 * Primitives rather than entities, and unpickable: an entity in the shell's
 * data source would be indexed as a card of its own (a polyline has a
 * position), and a click on the lit plot has to reach whatever is under it
 * exactly as it did before.
 */
const HIGHLIGHT_FILL_ALPHA = 0.6;
const HIGHLIGHT_OUTLINE_ALPHA = 0.95;
const HIGHLIGHT_OUTLINE_WIDTH_PX = 3;

/** The lit plot, as `drawGroundHighlight` handed it back — see `groundHighlight.js`. */
let _highlight = null;

/** The viewer the last draw went to — the highlight is drawn on the same one. */
let _drawViewer = null;

/**
 * The answer on screen, in either regime. `_themePayload` cannot stand in: it
 * is withdrawn above 600 m, where a plot's card is still a sale.
 */
let _drawnPayload = null;

/**
 * The open card, resolved to what it is about: a sale (and the plot it
 * bought), or an area shape. Null while nothing is selected. The panel is
 * built from this on each repaint rather than stored, so a language switch
 * re-words it.
 * @type {?{card: object, sale: ?object, parcelId: ?string, shape: ?object}}
 */
let _selection = null;

/** Most recent sale of every washed plot, filled by {@link drawDvfParcels}. */
const _saleByParcel = new Map();

/** Take the lit plot off the globe. Idempotent. */
function clearSaleHighlight() {
  _highlight?.clear();
  _highlight = null;
}

/**
 * Light one plot, fill and rings in `css`.
 * @param {object} viewer
 * @param {Array<Array<Array<number[]>>>} parts `[[outer, ...holes], ...]`, in degrees.
 * @param {string} css The class colour of the sale.
 * @returns {boolean} True when something was drawn.
 */
function drawSaleHighlight(viewer, parts, css) {
  clearSaleHighlight();
  if (!Array.isArray(parts) || !parts.length) return false;
  const color = Cesium.Color.fromCssColorString(css);
  _highlight = drawGroundHighlight(viewer, [{
    parts,
    fill: color.withAlpha(HIGHLIGHT_FILL_ALPHA),
    stroke: color.withAlpha(HIGHLIGHT_OUTLINE_ALPHA),
    widthPx: HIGHLIGHT_OUTLINE_WIDTH_PX,
  }], 'dvf-highlight');
  return _highlight !== null;
}

/**
 * What an open card is about.
 *
 * A marker's card is a sale (`dvf:<id>`). A plot edge's card is the plot's
 * most recent sale — the same one its wash is painted from — when that sale
 * has no marker to redirect to (see `selectionFor`). A card opened on bare
 * ground, above 600 m, is the plot or section under that point.
 * @param {object} card
 * @param {?object} payload The answer on screen.
 * @returns {?{card: object, sale: ?object, parcelId: ?string, shape: ?object}}
 */
export function dvfResolveSelection(card, payload, {
  saleByParcel = _saleByParcel, shapeAt = dvfAreaShapeAt,
} = {}) {
  if (!card?.id || !payload) return null;
  const id = String(card.id);
  if (id.startsWith('dvf-parcel:')) {
    const parcelId = id.split(':')[1] || null;
    return { card, sale: saleByParcel.get(parcelId) || null, parcelId, shape: null };
  }
  if (id.startsWith('dvf:')) {
    const sale = (payload.sales || []).find((entry) => `dvf:${entry.id}` === id) || null;
    return { card, sale, parcelId: sale?.parcelle ? String(sale.parcelle).trim() : null, shape: null };
  }
  if (Number.isFinite(card.lon) && Number.isFinite(card.lat) && dvfAreaUnit(payload)) {
    const shape = shapeAt(card.lon, card.lat);
    // The shape's own answer travels with it: inside the fade band a section
    // and a plot are read against two answers.
    return shape
      ? { card, sale: shape.record?.sale || null, parcelId: null, shape, payload: _areaLevels.payloadOf(shape) }
      : null;
  }
  return null;
}

/**
 * The day a sale was signed, spelled out: `29 décembre 2025`. The register
 * publishes a bare `YYYY-MM-DD`, read as UTC midnight and printed in UTC, so no
 * reader's time zone can move it a day.
 * @param {?string} iso
 * @returns {?string}
 */
export function dvfSaleDateLong(iso) {
  const text = String(iso || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text || null;
  return formatDate(`${text}T00:00:00Z`, { dateStyle: 'long', timeZone: 'UTC' });
}

/**
 * The selected sale as the map key prints it: address, the kind of sale and
 * its date, the price large, what was bought, and the €/m² beside the swatch
 * the marker wears — with its ratio to the named commune median, because a
 * colour whose denominator is not written down is a decoration.
 *
 * @param {object} sale One served mutation.
 * @param {{medianPrixM2: ?number, territory: ?string}} reference
 * @param {{parcelId?: ?string, footnote?: ?string}} [extra]
 * @returns {object} The `legendSelection` slot of the key.
 */
export function dvfSalePanel(sale, reference, { parcelId = null, footnote = null } = {}) {
  const m = messages();
  const price = saleRatioPrice(sale);
  const median = reference?.medianPrixM2 ?? null;
  const klass = saleRatioClass(price, median);
  const ratio = price !== null && median ? price / median : null;
  const value = price !== null ? eurosPerM2(price)
    : sale.dwellingCount > 1 ? m.card.dwellings(sale.dwellingCount)
      : m.card.noComparable;
  return {
    key: `sale:${sale.id ?? sale.parcelle ?? ''}`,
    title: sale.address || sale.commune || m.card.fallbackName,
    meta: [labelFor(NATURE, sale.nature), dvfSaleDateLong(sale.date)].filter(Boolean).join(' · '),
    headline: Number.isFinite(sale.valeur) ? euros(sale.valeur) : null,
    lines: [dvfSaleKindLine(sale)].filter(Boolean),
    metric: {
      color: saleColorCss(price, median),
      value,
      caption: [
        klass ? klass.label : null,
        ratio !== null
          ? m.card.ratio(ratioText(ratio), reference.territory || m.reference.theCommune,
            eurosPerM2(median))
          : null,
      ].filter(Boolean),
    },
    footnote: [parcelId ? m.panel.parcel(parcelId) : null, footnote].filter(Boolean).join(' · ') || null,
    link: { href: DVF_SOURCE_URL, label: m.panel.source },
  };
}

/**
 * The key's selection slot for whatever is open, or null.
 * @param {?object} selection From {@link dvfResolveSelection}.
 * @param {?object} payload The answer on screen.
 * @returns {?object}
 */
export function dvfSelectionPanel(selection, drawnPayload) {
  if (!selection || !drawnPayload) return null;
  const { card, sale, shape, parcelId } = selection;
  const payload = selection.payload || drawnPayload;
  if (shape?.kind === 'plot' && sale) {
    const commune = areaCommune(payload, shape.record?.communeCode);
    return dvfSalePanel(sale, {
      medianPrixM2: commune?.medianPrixM2 ?? null,
      territory: commune?.name || commune?.code || null,
    }, {
      parcelId: shape.record?.id || null,
      footnote: messages().area.plots.which(Number(shape.record?.count || 1), dvfYearsLabel(payload.years)),
    });
  }
  if (sale && !shape) return dvfSalePanel(sale, dvfReference(payload), { parcelId });
  // A section, or a card this layer cannot resolve: its own lines, as the
  // card on the globe would have printed them.
  return {
    key: `card:${card.id}:${card.title}`,
    title: card.title,
    lines: Array.isArray(card.details) ? card.details.filter(Boolean) : [],
    link: { href: DVF_SOURCE_URL, label: messages().panel.source },
  };
}

/**
 * Whether the map key is on screen to carry the card — see
 * `mapKeyCarriesSelection`, which the DPE shares.
 * @returns {boolean}
 */
export function dvfKeyCarriesSelection() {
  return mapKeyCarriesSelection();
}

/**
 * The shell's selection hook: resolve the card, light its ground.
 * @param {?object} card
 */
function onDvfSelectionChange(card) {
  _selection = card ? dvfResolveSelection(card, _drawnPayload) : null;
  clearSaleHighlight();
  if (!_selection || !_drawViewer) return;
  if (_selection.shape) {
    drawSaleHighlight(_drawViewer, _selection.shape.parts,
      dvfAreaColorCss(_selection.shape.kind === 'plot' ? 'plots' : 'sections', _selection.shape.record));
    return;
  }
  const parcel = _selection.parcelId
    ? (_themePayload?.parcels || []).find((entry) => entry.id === _selection.parcelId)
    : null;
  if (!parcel || !_selection.sale) return;
  const reference = dvfReference(_themePayload);
  drawSaleHighlight(_drawViewer, parcel.parts,
    saleColorCss(saleRatioPrice(_selection.sale), reference.medianPrixM2));
}


const baseLayer = createAddressScanLayer({
  id: DVF_LAYER_ID,
  // i18n-ignore-start — registry fields, not copy: see src/data/layerTaxonomy.i18n.js.
  name: 'Prix de l’immobilier (DVF)',
  icon: '€',
  source: 'DVF — Etalab / DGFiP',
  // i18n-ignore-end
  endpoint: '/api/dvf',
  updateInterval: UPDATE_INTERVAL_MS,
  runtimeParams: {
    type: {
      values: DVF_TYPE_FILTERS.map((entry) => entry.id),
      defaultValue: 'tous', // i18n-ignore-line — share-link token
    },
  },
  // DELIBERATELY ABSENT FROM `params`. The proxy is asked for every mutation
  // in the radius whatever the chip says, and the filter is applied to the
  // rows it returned — see {@link DVF_TYPE_FILTERS}. Putting `type` in the
  // query string would move the signature, refetch an identical reply, and
  // spend a rate-limit slot to draw a subset of what was already in memory.
  drawOnlyParams: ['type'],
  // TWO QUESTIONS, ONE ROUTE. Below 600 m the disc, above it the box — and the
  // box is ABSENT from the query string rather than flagged, so the proxy reads
  // the regime off the parameters it was given. Same contract as
  // `urbanismeGpu.js`, and it means a share link carries the regime for free.
  params: (point) => {
    const cells = scanCellParams(point);
    return Object.keys(cells).length ? cells : { radius: String(SCAN_RADIUS_M) };
  },
  // BIGGER IN AN AREA REGIME, because the box is already snapped to a tile:
  // inside one tile every camera position asks the identical question, and the
  // shell skips a scan only when BOTH the centre has not moved far enough AND
  // the query string is unchanged. Half a tile is what stops a pan across a
  // block from re-asking a question whose answer is already drawn.
  minShiftKm: () => (_areaUnit ? 0.6 : ADDRESS_SCAN_MIN_SHIFT_KM),
  // ON, since the layer started washing the PLOTS. A ground-classification
  // primitive reads its classification surface once, when it is built, so a
  // draw addressed to terrain survives a switch to the photoreal tileset —
  // which hides the globe — by silently showing nothing. The markers never
  // needed this; the parcels do.
  redrawOnMapStack: true,
  // What the answer covers, so a caller choosing a camera height frames the
  // block this layer speaks for rather than the 12 km its ceiling allows.
  scanReachM: SCAN_RADIUS_M,

  // The area regimes draw primitives beside the shell's entities, so the
  // shell's own teardown — before a redraw, on going dormant, on destroy —
  // has to take them too. See `drawDvfArea`.
  onClear: () => {
    // NOT `clearAreaDraw`: the shell calls this before every redraw too, and
    // the levels keep what they hold until the new draw has built — a pan or
    // a zoom across the band never shows bare ground. When no redraw follows
    // (dormant above the ceiling) they go at the end of the task.
    _areaLevels.cleared();
    clearSaleHighlight();
    _selection = null;
    _drawnPayload = null;
    _areaUnit = null;
  },
  // A plot or a section is a geometry instance, not an entity: this is how a
  // click on one reaches `groundCard` instead of being ignored as nobody's.
  ownsPick: isDvfAreaPickId,
  groundCard: dvfAreaGroundCard,
  // ONE PLOT, ONE CARD. A click on a washed plot's edge opens the sale the
  // wash is painted from — its marker lit, its plot lit, one card — rather
  // than a second, thinner card about the same sale. A plot whose sale has no
  // marker (no published coordinate) keeps its own card: the shell falls back
  // to the entity clicked when the redirect names no card.
  selectionFor: (entityId) => {
    const id = String(entityId || '');
    if (!id.startsWith('dvf-parcel:')) return null;
    const sale = _saleByParcel.get(id.split(':')[1]);
    return sale ? `dvf:${sale.id}` : null;
  },
  // The card goes beside the map and the globe keeps its title, as a tag over
  // the sale — see the section above `baseLayer`.
  onSelectionChange: onDvfSelectionChange,
  compactCard: () => dvfKeyCarriesSelection(),

  render({ payload, dataSource, viewer, runtime, point }) {
    _typeFilter = String(runtime?.type ?? 'tous'); // i18n-ignore-line — share-link token
    _drawViewer = viewer || _drawViewer;
    _drawnPayload = payload;
    _saleByParcel.clear();
    // THE PAYLOAD DECIDES, NOT THE CAMERA. An answer in flight while the reader
    // crossed 600 m lands after the altitude already says the other thing, and
    // drawing a box payload as points — or the reverse — is one frame of
    // garbage plus a key describing neither. `plots` and `sections` are only
    // ever present on a box answer.
    _areaUnit = dvfAreaUnit(payload);
    if (_areaUnit || Array.isArray(payload?.cells)) {
      // `cells` is the shape a box answer had until 2026-09-21; the browser
      // may hold one for the five minutes its HTTP cache allows. Nothing of it
      // is drawn, and the box outline says where the answer will come.
      const drawn = drawDvfArea(payload, {
        viewer, point, classificationType: gpuClassificationTypeForScene(viewer?.scene), runtime,
      });
      drawScanBoundary(dataSource, { id: 'dvf:scan-edge', box: payload.box });
      // The building theme paints volumes from the sales in hand and an area
      // answer holds shapes rather than sales, so it is WITHDRAWN rather than
      // left standing: volumes tinted from the block the reader left is
      // exactly the failure `withdrawIfDormant` exists to prevent, arrived by
      // a different road.
      _themePayload = null;
      publishTheme();
      return drawn;
    }
    // UNDER 600 m THE PLOTS AND SECTIONS GO AT ONCE — a hard cut, not a fade:
    // the disc is a different question (300 m around one point, 400 sales at
    // most, one marker each), not a finer reading of the box's plots. See
    // `scanRegime.scanAreaLevelsAt`.
    clearAreaDraw();
    const reference = dvfReference(payload);
    const sales = filterSalesByType(payload.sales, _typeFilter);
    // THE GROUND FIRST, so the markers are added after and pick above their
    // own wash. Counted separately from the markers: a plot is not a sale, and
    // the row's number has always been "how many mutations are on screen".
    drawDvfParcels(
      dataSource, payload.parcels, sales, reference,
      gpuClassificationTypeForScene(viewer?.scene), _saleByParcel,
    );
    let drawn = 0;
    for (const sale of sales) {
      if (!Number.isFinite(sale.lon) || !Number.isFinite(sale.lat)) continue;
      const price = saleRatioPrice(sale);
      const comparable = price !== null;
      const klass = saleRatioClass(price, reference.medianPrixM2);
      const ratio = comparable && reference.medianPrixM2
        ? price / reference.medianPrixM2
        : null;
      dataSource.entities.add({
        id: `dvf:${sale.id}`,
        position: Cesium.Cartesian3.fromDegrees(sale.lon, sale.lat),
        billboard: {
          // A EURO SIGN, not a disc. Turn this layer on with the DPE layer and
          // both used to draw coloured dots over the same roofs, with nothing
          // to say which register a dot came from — colour was already spent
          // on the price ratio here and on the A–G scale there, so the shape
          // is what carries the source. See `addressMarkerIcons.js`.
          image: addressMarkerGlyph('euro'),
          // Not reduced when the volumes are painted: the marker is the click
          // surface, it is all there is when Bâti 3D is off, and its size
          // already carries "has a comparable €/m²" (A3). See the header.
          width: comparable ? SIZE_COMPARABLE_PX : SIZE_NO_RATIO_PX,
          height: comparable ? SIZE_COMPARABLE_PX : SIZE_NO_RATIO_PX,
          // The glyph is white line-art; this tint IS the price channel, and
          // the same tint the building volume takes.
          color: saleColor(price, reference.medianPrixM2),
          // POSITIVE_INFINITY, not a distance. With a finite value the marker is
          // depth-tested as soon as the camera is further away than that, and
          // the terrain then eats the bottom half of every glyph — the reported
          // symptom was "the dots don't display properly", and at city zoom
          // they were rendering clipped by the ground under them. These are
          // annotations ON the world, not objects IN it.
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          kind: 'dvf-sale',
          prixM2: sale.prixM2,
          comparable,
          ratioClass: klass ? klass.id : null,
          referenceMedianPrixM2: reference.medianPrixM2,
          date: sale.date,
          nature: sale.nature,
          rowCount: sale.rowCount,
        },
        name: sale.address || sale.commune || messages().card.fallbackName,
        description: dvfSaleCard(sale, reference),
      });
      drawn += 1;
    }
    // The edge of the disc, so the field of markers reads as a probe rather
    // than as a layer that stopped drawing halfway. Never counted — see
    // `scanBoundary.js`.
    drawScanBoundary(dataSource, {
      id: 'dvf:scan-edge',
      centre: point,
      radiusM: SCAN_RADIUS_M,
    });
    // The theme speaks for the answer that was just drawn, so it is published
    // here rather than from `update()`: `render` is also what a map-stack
    // redraw calls, and the points must never outlive the payload.
    _themePayload = payload;
    publishTheme();
    return drawn;
  },

  /**
   * The key to the ramp, plus the two admissions A5 asks for: what was clipped
   * and what could not be placed.
   */
  rowControls(runtime, _summary, drawn) {
    // READ, NEVER WRITTEN, here: `render` owns the mirror — see `_typeFilter`.
    // The chips still show the runtime, which is the truth even on the tick
    // before the draw has caught up with it.
    const filter = String(runtime?.type ?? 'tous'); // i18n-ignore-line — share-link token
    const chips = DVF_TYPE_FILTERS.map((entry) => ({
      id: `type:${entry.id}`,
      label: entry.label,
      active: entry.id === filter,
      params: { type: entry.id },
      // OFFERED TO EVERY MEMBER OF THE ROW. The estimate next door asks the
      // same question about the same doorway and takes the same vocabulary;
      // `tous` is not in ITS enum and is simply refused, which is the right
      // outcome — "show me everything on the map" is not an instruction to
      // change what is being valued.
      fanOut: true,
      title: entry.title,
    }));
    // Built from the payload that was actually DRAWN, so a layer that has never
    // scanned — or whose scan went dormant above the ceiling — publishes
    // nothing rather than a key to a wash that is not on screen. The shell
    // hands over a null payload in exactly those two cases. The CHIPS are
    // published either way: a control a reader cannot find until the layer has
    // answered is a control they will not find.
    if (!drawn) return { chips };
    // Inside the fade band the key is the DOMINANT level's: the sections'
    // near the band's top, where they still outweigh the plots the shell holds.
    const payload = _areaLevels.ownerPayload(drawn);
    const unit = dvfAreaUnit(payload);
    if (unit) {
      // NO TYPE CHIPS IN AN AREA REGIME, and they are removed rather than
      // disabled. `drawOnlyParams` filters rows the proxy served; an area
      // answer carries shapes, not rows, so a chip here would be a control
      // that silently does nothing — worse than one that is not offered.
      const records = unit === 'plots' ? payload.plots : payload.sections;
      return {
        legend: dvfLegendEntries(dvfAreaReference(payload), countAreaByClass(unit, records),
          { neutral: areaNeutral(unit) }),
        legendBar: true,
        legendNote: dvfAreaLegendNote(payload),
        note: dvfAreaDisclosure(payload),
        legendSelection: dvfSelectionPanel(_selection, payload),
      };
    }
    const reference = dvfReference(payload);
    const sales = filterSalesByType(payload.sales, filter);
    return {
      chips,
      legend: dvfLegendEntries(reference, countByClass(sales, reference.medianPrixM2)),
      // ORDERED CLASSES, SO ONE BAR. The five steps of the ramp plus the
      // neutral are one distribution of one population — how the block's
      // sales fall around the commune's median IS the layer's argument, and
      // six stacked rows never showed its shape.
      legendBar: true,
      legendNote: dvfLegendNote(reference, { parcels: (payload.parcels || []).length }),
      note: dvfLegendDisclosure(reference, payload.summary || {}, sales.length, {
        filter,
        hidden: (payload.sales || []).length - sales.length,
        parcels: payload.parcels,
      }),
      // The open card, printed under the key it is read against — see the
      // section above `baseLayer`.
      legendSelection: dvfSelectionPanel(_selection, payload),
    };
  },

  summarize(drawn) {
    // The dominant level's answer, as the key — see `rowControls`.
    const payload = _areaLevels.ownerPayload(drawn);
    const summary = payload.summary || {};
    const unit = dvfAreaUnit(payload);
    if (unit) {
      const reference = dvfAreaReference(payload);
      const records = unit === 'plots' ? payload.plots : payload.sections;
      return {
        // NAMED by its unit, so nothing downstream can mistake this for the
        // disc answer. `salesFound` still means "mutations behind the
        // drawing", but it is now the box's and not a radius's, and
        // `scanBasis` is what says which — the voice surface reads it before
        // it quotes a number.
        scanBasis: unit,
        shapeCount: records.length,
        communes: (payload.communes || []).map((entry) => entry.name || entry.code),
        years: payload.years ?? null,
        salesFound: summary.count ?? 0,
        comparableCount: summary.pricedCount ?? 0,
        localMedianPrixM2: summary.medianPrixM2 ?? null,
        referenceBasis: reference.basis,
        referenceLabel: reference.label,
        // Every denominator, not one — see `dvfAreaReference`.
        references: reference.references,
        themeId: DVF_LAYER_ID,
        themePrecedence: DVF_THEME_PRECEDENCE,
        themePoints: 0,
        coverage: dvfAreaDisclosure(payload),
        legend: dvfLegendEntries(reference, countAreaByClass(unit, records),
          { neutral: areaNeutral(unit) }),
      };
    }
    const reference = dvfReference(payload);
    return {
      commune: payload.commune?.name ?? null,
      communeCode: payload.commune?.code ?? null,
      years: payload.years ?? null,
      salesFound: summary.count ?? 0,
      salesServed: summary.served ?? null,
      truncated: summary.truncated === true,
      // The gap between these two is the honesty of the medians below them.
      comparableCount: summary.comparableCount ?? 0,
      // NAMED, both of them. The block statistic and the denominator are two
      // different numbers and neither is allowed to answer to `medianPrixM2`.
      localMedianPrixM2: summary.medianPrixM2 ?? null,
      referenceBasis: reference.basis,
      referenceLabel: reference.label,
      referenceTerritory: reference.territory,
      referenceMedianPrixM2: reference.medianPrixM2,
      referenceComparableCount: reference.comparableCount,
      referenceCount: reference.count,
      referenceUnplacedCount: reference.unplacedCount,
      p25PrixM2: summary.p25PrixM2 ?? null,
      p75PrixM2: summary.p75PrixM2 ?? null,
      perYear: summary.perYear ?? null,
      themeId: DVF_LAYER_ID,
      themePrecedence: DVF_THEME_PRECEDENCE,
      themePoints: (payload.sales || []).length,
      // The ground the register named and the cadastre returned. Reported
      // because "no plot is tinted" has two causes — nothing sold here, or
      // Etalab publishes no parcels for this commune — and a count is the
      // only thing that tells them apart from outside.
      parcelsDrawn: (payload.parcels || []).length,
      // D1 in the stats as well as in the panel: a caller reading this layer
      // programmatically gets the ramp and its denominator, not just a count.
      legend: dvfLegendEntries(reference, countByClass(payload.sales || [], reference.medianPrixM2)),
    };
  },
});

/**
 * Above `ADDRESS_SCAN_MAX_ALTITUDE_M` the shell clears the draw WITHOUT calling
 * `render`, so nothing in this module would otherwise learn that the answer on
 * screen has been retracted — and a theme built from a block in Paris would go
 * on telling the volumes of whatever city the reader lands in next that no sale
 * was ever recorded there.
 *
 * The reconciliation hangs off `getStats()` because that is the only method the
 * shell exposes that runs after an internal scan (the camera-settled path calls
 * `runScan` directly, never `update`). It is idempotent, it touches nothing
 * unless the layer has gone dormant with a theme still published, and in that
 * exact case `getStats()` is at its cheapest — the shell skips `summarize()`
 * when there is no payload.
 * @param {object} stats
 * @returns {object} the same stats
 */
function withdrawIfDormant(stats) {
  if (stats?.dormant && _themePayload) {
    _themePayload = null;
    publishTheme();
  }
  return stats;
}

/**
 * The layer, wrapped so that switching it off also hands the volumes back.
 *
 * `createAddressScanLayer` has no lifecycle hook for this, and it is a shared
 * file this module does not own — so the composition happens here, where the
 * theme is. Every method of the base layer closes over its own state rather
 * than `this`, so spreading it is safe.
 */
const dvfSalesLayer = {
  ...baseLayer,

  init(viewer) {
    _themePayload = null;
    _themeEnabled = false;
    clearBuildingTheme(DVF_LAYER_ID);
    baseLayer.init(viewer);
  },

  getStats() {
    return withdrawIfDormant(baseLayer.getStats());
  },

  enable(viewer) {
    _themeEnabled = true;
    // Claimed so the sibling handlers that track or select read a click on a
    // plot as somebody's and leave it alone — see `pickRegistry.js`.
    registerPickOwner(DVF_LAYER_ID, isDvfAreaPickId);
    _areaLevels.enable(viewer);
    baseLayer.enable(viewer);
    // Republish what is already in hand: a layer switched off and on again
    // repaints immediately instead of waiting for the next scan.
    publishTheme();
  },

  disable() {
    _themeEnabled = false;
    _themePayload = null;
    publishTheme();
    baseLayer.disable();
    // After the shell, which keeps its payload and redraws from a fresh scan
    // on `enable` — so the shapes go now rather than sitting on a hidden
    // layer's ground.
    _areaLevels.disable();
    clearSaleHighlight();
    _selection = null;
    _areaUnit = null;
    unregisterPickOwner(DVF_LAYER_ID);
  },

  destroy(viewer) {
    _themeEnabled = false;
    _themePayload = null;
    publishTheme();
    baseLayer.destroy(viewer);
    _areaLevels.disable();
    clearSaleHighlight();
    _selection = null;
    _drawnPayload = null;
    _drawViewer = null;
    _saleByParcel.clear();
    _areaUnit = null;
    unregisterPickOwner(DVF_LAYER_ID);
  },

  async update(viewer, options) {
    const result = await baseLayer.update(viewer, options);
    // The authoritative moment, and the one that still runs when the panel is
    // hidden and `getStats()` is not being polled.
    withdrawIfDormant(baseLayer.getStats());
    return result;
  },

  /**
   * The drawn mutations, for the analyst engine and for "what is near here".
   *
   * `_themePayload` is the read handle because it IS the payload that was last
   * rendered: the shell keeps its own copy private, and this one is set by
   * `render` and dropped the moment the layer goes off or dormant. So a query
   * can never be answered from a block the reader has already flown away from.
   *
   * @param {number} [maxCount=2000] Ceiling, shared with every other layer.
   * @returns {Array<object>}
   */
  getAnalystRecords(maxCount = 2000) {
    if (!_themeEnabled || !_themePayload) return [];
    const limit = Number.isFinite(maxCount) ? Math.max(1, Math.floor(maxCount)) : 2000;
    const out = [];
    for (const sale of _themePayload.sales || []) {
      if (out.length >= limit) break;
      const record = dvfSaleRecord(sale);
      if (record) out.push(record);
    }
    return out;
  },

  /**
   * What the area regime has on the globe, for the harnesses: a Cesium
   * primitive does not live in the data source the shell counts, so without
   * this a browser check could only read the payload and never the draw.
   * @returns {{unit: ?string, shapes: number, fills: number, ready: boolean}}
   */
  getAreaDraw() {
    return { unit: _areaUnit, ..._areaLevels.stats() };
  },

  /** The mutation the operator clicked, ready to be spoken. */
  getSelectedInfo() {
    const selectedId = baseLayer.getStats()?.selectedId || null;
    if (!selectedId || !_themePayload) return null;
    const sale = (_themePayload.sales || []).find((entry) => `dvf:${entry.id}` === selectedId);
    return sale ? dvfSaleRecord(sale) : null;
  },

  /** The block's own figures, so voice and panel cannot disagree. */
  getVoiceSummary() {
    return _themeEnabled ? dvfVoiceSummary(dvfSalesLayer.getStats()) : null;
  },
};

/** Test seam: the dormancy reconciliation, without a camera. */
export function _dvfWithdrawIfDormantForTest(stats) {
  return withdrawIfDormant(stats);
}

/** Test seam: drive the theme without a viewer. */
export function _dvfSetThemePayloadForTest(payload, enabled = true) {
  _themeEnabled = enabled;
  _themePayload = payload;
  return publishTheme();
}

export default dvfSalesLayer;
