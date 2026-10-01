import * as Cesium from 'cesium';
import { StyleManager } from './ui.js';
import mainMessages from './main.i18n.js';
import { DEFAULT_CITY_VIEW, flyToDefaultCity } from './camera.js';
import { beginBootFlight, endBootFlight, whenBootFlightEnds } from './bootFlight.js';
import {
  MOVING_RESOLUTION_SCALE,
  getGlobeDetailDiagnostics,
  installGlobeDetailGovernor,
  setMovingResolutionScale,
} from './globeDetailGovernor.js';
import { getCameraSensitivityDiagnostics } from './data/cameraSensitivity.js';
import { getCameraSettleDiagnostics } from './data/cameraSettle.js';
import { getZoomFadeDiagnostics } from './data/zoomFade.js';
import { peekShareMapStack } from './sharelink.js';
import { DataLayerManager } from './data/manager.js';
import { LAYER_MANIFEST } from './data/layerManifest.js';
import { createLazyLayer } from './data/lazyLayer.js';
import { LAYER_STATE_REGISTRY } from './data/layerState.js';
import { PAUSED_LAYER_IDS } from './data/pausedLayers.js';
import { LAYER_CATEGORIES, LAYER_TAXONOMY } from './data/layerTaxonomy.js';
import { CATALOG_DATASET_MANIFESTS } from './data/datasetsCatalog.js';
import { initDatasetBox } from './data/datasetBox.js';
import { mountLayerPanelRail } from './data/layerPanelRail.js';
import { registerDataCredits, withdrawDataCredits } from './data/dataCredits.js';
import {
  SWITCHABLE_LAYER_IDS,
  creditKeysOf,
  layerIdsOf,
  offSourcesFromProbe,
} from './nonCommercialSources.js';
import {
  WORLD_BASE_PROBE_WAIT_MS,
  anonymousEsriAllowedByProbe,
  unusedWorldImageryCreditKeys,
} from './data/worldImagery.js';
import { installLegalLinks } from './legalLinks.js';
import { modelAssetUrl } from './data/modelAssets.js';
import { installLazyVoice } from './voice/lazyVoice.js';
import { MapStackController } from './mapStackController.js';
import { describePhotorealFailure, loadPhotorealTileset, photorealDisabled } from './photorealTileset.js';
import {
  PHOTOREAL_ADOPTION_STACK,
  installPhotorealAdoption,
  photorealAlreadyAdopted,
  rememberPhotorealAdoption,
} from './photorealAdoption.js';
import { ignTerrainFlagEnabled } from './data/ignBilTerrain.js';
import { installIconFontFallback } from './iconFontFallback.js';
import { installStarfield } from './starfield.js';
import { initCockpitCloudEffects } from './cockpitCloudEffects.js';
import {
  installRenderGovernor,
  getRenderGovernorDiagnostics,
  governorRequestRender,
  holdContinuousRender,
  releaseContinuousRender,
} from './renderGovernor.js';
import { installScopeMask, setScopeMaskEnabled } from './scopeMask.js';
import { installEdgeShade } from './edgeShade.js';
import { installCameraNoiseFloor } from './cameraNoiseFloor.js';
import { installContextLossRecovery } from './contextLoss.js';
import { installGlobeHeadingTape } from './globeHeadingTape.js';
import { startFirstRunExperience } from './firstRunBoot.js';
import { stopLoaderSun } from './loaderSun.js';
import { trialProbe } from './trialProbe.js';
import { WAITLIST_OPEN_EVENT, requestWaitlistCard } from './trialRefusal.js';
import { loadVoicePremium, markVoicePremiumSpent } from './voicePremium.js';
import { whenIdle } from './whenIdle.js';
import { initKeySetup } from './keySetup.js';
import {
  LITE_GLOBE_SSE,
  LITE_MSAA_SAMPLES,
  LITE_TILE_CACHE_SIZE,
  FULL_MSAA_SAMPLES,
  getPerfProfileDiagnostics,
  initPerfProfile,
  isLiteProfile,
  observeFrameProfile,
  onPerfProfileChange,
} from './perfProfile.js';
import { getInputModeDiagnostics, initInputMode, isPhoneShell } from './inputMode.js';
import { initPhoneSheet } from './phoneSheet.js';
import { initGlobeShell } from './globeShell.js';
import { initGlobeNav } from './globeNav.js';
import { applyPhoneRenderDetail } from './phoneRender.js';
import { applyTouchCameraProfile } from './touchCamera.js';
import { getPickDiagnostics } from './data/pickAt.js';
import { rememberFirstRunSessionDismissed } from './firstRunExperience.js';
import { applyHeroPose, heroOrbit, heroShareHash, orbitHeadingDeg, whenSurfaceSettled } from './vitrine/handoff.js';
import { takeInitialQuery } from './vitrine/query.js';

/**
 * Extract a human-readable error message from any thrown value.
 * Handles Error objects, strings, and plain objects with message/error fields.
 * @param {*} error — caught exception value
 * @returns {string} best-effort error description
 */
function describeError(error) {
  if (!error) return 'Unknown initialization error';
  if (error instanceof Error) {
    if (error.message && error.message.trim()) return error.message.trim();
    return error.name || 'Initialization error';
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error === 'object') {
    const maybeMessage = String(error.message || error.error || '').trim();
    if (maybeMessage) return maybeMessage;
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') return serialized;
    } catch {
      // ignore serialization error
    }
  }
  return String(error);
}

/**
 * SURPLOMB — cockpit entry point
 * Initializes CesiumJS with Google Photorealistic 3D Tiles,
 * style system, intelligence HUD, location presets, and share links.
 *
 * @param {object} [options]
 * @param {{videoTime: number, query?: string, onReady: Function}|null} [options.handoff]
 *   The showcase's wide-screen hand-off (src/vitrine/vitrine.js): boot under
 *   the frozen frame, on the pose it was recorded from, and call `onReady`
 *   once the globe has drawn that view. Null for every other boot.
 * @param {boolean} [options.fromVitrine] The reader came through the showcase.
 * @param {boolean} [options.locate] « Utiliser ma position » was granted on
 *   the showcase: fly to the reader once the globe is up.
 */
async function init({ handoff: requestedHandoff = null, fromVitrine = false, locate = false } = {}) {
  const loadingScreen = document.getElementById('loading-screen');
  const loaderStatus = loadingScreen.querySelector('.loader-status');

  // The showcase's form lands here as `?q=` (typed, or its no-JavaScript
  // submit). Read once and removed from the address at once, so no later
  // share-link write can carry it. See src/vitrine/query.js.
  const initialQuery = requestedHandoff ? (requestedHandoff.query || '') : takeInitialQuery();
  const orbit = requestedHandoff ? heroOrbit('desktop') : null;
  // A hand-off without a recorded orbit (landing assets never generated)
  // degrades to an ordinary boot: the frame could not be matched anyway.
  const handoff = requestedHandoff && orbit ? requestedHandoff : null;
  if (requestedHandoff && !handoff) requestedHandoff.onReady?.({ status: 'no-orbit' });
  // Whoever reaches the cockpit through the showcase has already been shown
  // what the first-run card says. Session-scoped on purpose: the durable key
  // means « never again », which only the reader's own close may write.
  if (fromVitrine || requestedHandoff || initialQuery !== null) rememberFirstRunSessionDismissed();
  // The picture is the loading screen during a hand-off; the veil must already
  // be gone when the showcase lifts, or it would flash in between.
  if (handoff) loadingScreen.classList.add('hidden');

  try {
    loaderStatus.textContent = mainMessages().configuring;

    // The page's one `/api/trial` read, started now: the voice crown needs it
    // at idle, and the first-run card needs it before it shows anything (it
    // says whether the hosted A/B test runs). See src/trialProbe.js.
    void trialProbe.read();

    // Set Cesium Ion token for World Terrain
    const cesiumToken = import.meta.env.CESIUM_ION_TOKEN;
    if (cesiumToken) {
      Cesium.Ion.defaultAccessToken = cesiumToken;
    }

    // ArcGIS Location Platform key for the world satellite base under the
    // Satellite stack. OPTIONAL: without it the base is the anonymous Esri
    // endpoint where the deployment allows it, Sentinel-2 elsewhere — see
    // src/data/worldImagery.js. Public by design, like the Google browser key:
    // it is restricted by referrer and to the basemap privilege.
    const arcgisApiKey = String(import.meta.env.ARCGIS_API_KEY || '').trim();

    // Google Maps API key for Photorealistic 3D Tiles. OPTIONAL: a missing key
    // is a supported configuration (the keyless build), not a fatal error.
    // Throwing here used to abort init before the viewer existed, so
    // `git clone && npm i && npm run dev` produced a dead page for anyone
    // without a billed Google key — even though the whole downstream fallback
    // path already existed (`tileset === null` → `initialStack: 'osm'`, and
    // `MapStackController` already reports `photoreal` as unavailable with the
    // right reason). Keyless boots onto the keyless globe stacks instead.
    //
    // The key is only PUBLISHED when it exists: `Cesium.GoogleMaps.defaultApiKey`
    // and `window.__GOOGLE_MAPS_API_KEY__` stay untouched otherwise, so every
    // consumer sees a falsy value and takes its own degraded path rather than
    // firing a request with `key=undefined`. Geocoding consumers are the ones
    // that matter: `annotationResolver.geocodePlace()` and `gevActions`'
    // `reverseGeocode()` return null, and `locations.searchAndFlyTo()` rejects
    // with a keyless-specific message the search box turns into a toast.
    const googleApiKey = import.meta.env.GOOGLE_MAPS_API_KEY;
    const keylessMode = !googleApiKey;
    if (googleApiKey) {
      Cesium.GoogleMaps.defaultApiKey = googleApiKey;
      // Expose API key globally for geocoding in locations.js
      window.__GOOGLE_MAPS_API_KEY__ = googleApiKey;
    } else {
      console.info(
        '[Init] No GOOGLE_MAPS_API_KEY — starting keyless. Google 3D Tiles and '
        + 'Google-backed geocoding are unavailable; the globe stacks (OSM, IGN) are not.',
      );
    }

    // What kind of hands this session has, resolved BEFORE the render profile
    // because the profile asks it a question. The inline script in index.html
    // has already put the two attributes on <html> — this call re-poses them,
    // idempotently, for a harness that injected `?input=` after the document
    // was written, and hands the same answer to every module that asks in JS.
    // See src/inputMode.js: one predicate, one threshold, two attributes.
    initInputMode();

    // The render profile, resolved HERE and nowhere else. Two of the four fixed
    // render costs are Viewer construction arguments, so a machine that is
    // going to be treated as small has to be recognised before the next line
    // runs. See src/perfProfile.js for what `lite` may and may not change.
    initPerfProfile();

    // Create the Cesium viewer with minimal chrome
    const viewer = new Cesium.Viewer('cesiumContainer', {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      vrButton: false,
      selectionIndicator: false,
      infoBox: false,
      baseLayer: false,
      // No star field at construction. Cesium's default SkyBox pulls six
      // Tycho-2 JPEGs — 848 kB — on every cold start, and measured on a 2-core
      // laptop at 10 Mbit/s that was 1.7 s of the 5.3 s boot. It comes back,
      // deferred, on the basemaps where a sky means something: see
      // `src/starfield.js`.
      skyBox: false,
      // Visible attribution container — Google Maps / 3D Tiles credits are
      // required by Google's Terms of Service, so they must be shown (styled
      // subtly via #cesium-credits). The credit line stays visible in
      // clean-view AND recording modes too (ToS requires attribution while the
      // content is displayed — those are the exact modes used to record
      // demos), including the "Data attribution" link that opens the per-layer
      // license popover.
      creditContainer: (() => {
        const el = document.createElement('div');
        el.id = 'cesium-credits';
        document.body.appendChild(el);
        return el;
      })(),
      // The two fixed render costs that CANNOT be changed after this call, and
      // the reason `initPerfProfile()` runs above rather than after the globe
      // is up. Both are measured, one lever at a time, by `perf:gpu-ab`.
      //
      // MSAA is the biggest of the four by a wide margin: −26 to −43 % of
      // render work per frame at 1366×768, −49 to −59 % at 2732×1536. The
      // spread is the Mac's load moving under the bench, not the lever.
      msaaSamples: isLiteProfile() ? LITE_MSAA_SAMPLES : FULL_MSAA_SAMPLES,
      contextOptions: {
        webgl: {
          // `preserveDrawingBuffer` keeps the last frame readable after the
          // compositor has taken it, which costs a copy per frame and buys
          // exactly one thing: reading the canvas outside a render. Every such
          // read in this app already draws a fresh frame first
          // (`renderFreshCesiumFrame`), so `lite` declines the copy.
          preserveDrawingBuffer: !isLiteProfile(),
        },
      },
    });

    // The hand-off pose, set before any stack is activated so the first tiles
    // requested are the ones under the frozen frame. The same pose travels in
    // the share hash below, restored with a zero-length flight.
    const handoffPose = handoff ? applyHeroPose(viewer.camera, orbit, handoff.videoTime) : null;
    const handoffShare = handoffPose ? { hash: heroShareHash(handoffPose), cameraDuration: 0 } : null;
    const vitrineHandoff = handoff
      ? {
        videoTime: handoff.videoTime,
        expectedHeadingDeg: orbitHeadingDeg(orbit, handoff.videoTime),
        pose: handoffPose,
        result: null,
      }
      : null;

    // Cap the default render loop at 60 fps. Cesium's loop otherwise runs at
    // the display's refresh rate — 120 Hz on ProMotion panels — doubling GPU
    // and CPU burn for zero visual benefit in a map app whose animation
    // cadences (poll interpolation, trail fades, style crossfades) are all
    // designed against wall-clock time, not frame count. Measured on the
    // 2026-08-05 perf investigation as a strict halving of idle burn on
    // 120 Hz hardware; a no-op on 60 Hz displays. (perf item 2)
    viewer.targetFrameRate = 60;

    // Two fingers, once, before anything can track a contact: `trackedCamera`
    // captures `inertiaZoom` and `minimumZoomDistance` at the first track and
    // restores what it captured, so this profile has to already be in place.
    // A no-op for a cursor.
    applyTouchCameraProfile(viewer.scene);

    // The only honest reading of how small this machine is: how long it takes
    // to draw this scene. The verdict arrives ~60 frames from now — too late
    // for the two construction arguments above, in time for everything else,
    // and remembered so the NEXT visit gets all four. (perf plan 2.1)
    observeFrameProfile(viewer);

    // Register per-layer data attribution into the "Data attribution" popover.
    // Required by each source's license (ODbL, CC BY-NC-SA, NASA FIRMS, etc.);
    // strings are verbatim from DATA_SOURCES.md. Static + always-present in the
    // expandable bottom-left credit lightbox (showOnScreen=false), so they never
    // clutter the on-globe attribution line.
    registerDataCredits(viewer);
    // One of the two Esri paths can never be drawn by this build, so it is not
    // credited either.
    withdrawDataCredits(viewer, unusedWorldImageryCreditKeys(arcgisApiKey));
    installLegalLinks(document.getElementById('cesium-credits'));

    // Hide Cesium's default globe — Google Photorealistic 3D Tiles provide their own
    // globe at all LODs (street level → orbital). The default globe's 2D imagery
    // clips through 3D tile buildings at close range.
    //
    // Keyless, the photoreal globe is never coming, so the Cesium globe IS the
    // product and hiding it here would flash a starfield until the OSM stack
    // settled. `_activateGlobeStack()` shows it again either way; this only
    // decides what the first frames look like.
    viewer.scene.globe.show = keylessMode;

    // Keep a sky behind Google 3D Tiles, but soften Cesium's high-intensity
    // default atmosphere. With the globe hidden its bright limb otherwise
    // reads as a hard cyan seam where distant photoreal tiles meet the sky.
    // The Moon is drawn against a sky this build no longer ships by default,
    // and it drags `moonSmall.jpg` plus the IAU2006 rotation tables into the
    // boot to do it. It goes with the stars.
    viewer.scene.moon = undefined;
    viewer.scene.backgroundColor = Cesium.Color.BLACK;
    // `showWaterEffect` fetches `waterNormals.jpg` (294 kB) the moment a tile
    // carries a water mask, to animate a specular shimmer that is invisible at
    // every altitude this app is read at.
    viewer.scene.globe.showWaterEffect = false;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyAtmosphere.atmosphereLightIntensity = 18;
    viewer.scene.skyAtmosphere.saturationShift = -0.12;
    viewer.scene.skyAtmosphere.brightnessShift = -0.08;

    // The globe's own two knobs in `lite` (perf plan 2.3). Set HERE, before
    // `installGlobeDetailGovernor`, because the governor captures whatever
    // tolerance it finds as the settled one and doubles THAT in motion — set
    // afterwards, the coarse value would be the one the governor hands back.
    if (isLiteProfile()) {
      viewer.scene.globe.maximumScreenSpaceError = LITE_GLOBE_SSE;
      viewer.scene.globe.tileCacheSize = LITE_TILE_CACHE_SIZE;
    }
    // A phone overrides the error the `lite` block just set, and renders at
    // twice its CSS size: at 3 and 1×, one imagery texel covered 6 to 12
    // physical pixels of an iPhone. Same ordering constraint as above — before
    // the governor. See src/phoneRender.js for the measurement and the cost.
    if (isPhoneShell()) applyPhoneRenderDetail(viewer);

    // `?photoreal=0`, or the flag the QA fleet installs. Read first, because
    // the whole point is to not make the call: ion bills one "root tile" per
    // successful request for the tileset, so a session that never asks for it
    // is a session that costs nothing.
    const photorealOff = photorealDisabled();
    // Whether this build has a door to the 3D globe at all. Deliberately NOT
    // "try it and catch": with neither credential there is nothing to attempt,
    // and an attempt would spend a doomed round-trip and then report a network
    // error as if something had gone wrong. Nothing has — that is the keyless
    // build.
    const canLoadPhotoreal = !photorealOff && !!(googleApiKey || cesiumToken);
    if (photorealOff) {
      loaderStatus.textContent = mainMessages().photorealOff;
    } else if (!canLoadPhotoreal) {
      loaderStatus.textContent = mainMessages().keyless;
    }

    // THE PURCHASE, DEFERRED. Handed to the controller rather than called here,
    // so the fetch happens on the first activation of the photoreal stack and
    // not on every page load. What that changes, concretely: a `#map=osm`
    // share link used to buy a photoreal globe and then hide it, and so did
    // every one of the 113 QA harnesses — which is how a 1 000-a-month tier
    // ran out on the fifteenth of September 2026. The cost now follows the
    // reader instead of the page load.
    //
    // Returns the controller's contract — `{tileset, source, error}` — so the
    // controller never has to know the shape of a photoreal failure list.
    const loadPhotoreal = canLoadPhotoreal ? async () => {
      const photoreal = await loadPhotorealTileset(Cesium, {
        googleApiKey,
        // The token already in the build for Bing and world terrain. It also
        // opens Google's photoreal tileset as ion asset 2275207, which is the
        // ONLY route left to the 3D globe on an EEA-billed Google key.
        ionToken: cesiumToken,
        onAttempt: (source) => {
          const messages = mainMessages();
          loaderStatus.textContent = source === 'ion' ? messages.photorealViaIon : messages.photoreal;
        },
      });
      if (photoreal.tileset) {
        if (photoreal.source === 'ion') {
          console.info(
            '[Init] Google 3D Tiles served through Cesium ion (asset 2275207) — '
            + `${photoreal.errors.length ? 'the build key was refused: ' + describePhotorealFailure(photoreal.errors) : 'no Google key in this build'}. `
            + 'Cesium ion credits, including the free tier\'s "Upgrade for commercial use.", are required on screen.',
          );
        }
      } else {
        console.warn('[Init] Google 3D Tiles unavailable, falling back to Cesium globe:', photoreal.errors);
      }
      return {
        tileset: photoreal.tileset,
        source: photoreal.source,
        error: describePhotorealFailure(photoreal.errors),
      };
    } : null;

    loaderStatus.textContent = mainMessages().systems;

    // DEV-ONLY terrain spike. Loud on purpose: with IGN RGE ALTI under the
    // globe, the repo's "terrain-globe means the Re:Earth prior IS the ground"
    // identity no longer holds, so everything clamped to the ground from a
    // cached sample — CCTV, traffic, local GeoJSON, mesh floors — is placed
    // against the wrong surface. Never ship this on.
    const ignTerrainSpike = ignTerrainFlagEnabled();
    if (ignTerrainSpike) {
      console.warn(
        '[Init] ?ign_terrain=1 — DEV SPIKE: IGN RGE ALTI terrain is installed over '
        + 'France. Ground-clamped objects (CCTV, traffic, local GeoJSON, mesh floors) '
        + 'are placed against the wrong surface while this is on.',
      );
    }

    // Where a build that cannot show the 3D globe LANDS. A keyed build with no
    // tileset is the EEA case: Google withholds 3D tiles and satellite from an
    // EEA billing address (403) but still serves roadmap and terrain on the
    // very same key, so Google's own cartography is both a better first
    // impression than OSM and the thing the operator is already paying for.
    // The keyless build lands on OSM only when it has no ion token either:
    // with one, `tileset` is the ion-served photoreal globe and this lands on
    // it, key or no key.
    //
    // `?photoreal=0` lands on OSM even on a keyed build, and that is the rule
    // rather than an exception to it: the flag means "this boot must not spend
    // a metered basemap", and Google's 2D cartography is metered too (100 000
    // tiles a month, ~90 to a view) and needs the server session broker. OSM
    // is the only stack that costs the account nothing, which also makes it
    // the deterministic one for a harness.
    //
    // The ladder no longer asks whether the tileset LOADED, because nothing has
    // been bought yet at this point — it asks whether there is a door. A keyed
    // build whose tiles turn out to be withheld (the EEA case) still lands on
    // Google's 2D cartography, one layer down: the boot activation fails and
    // `setStack`'s fallback walks the same ladder.
    //
    // AND THE APP NO LONGER OPENS ON THE 3D GLOBE, even when it can. ion bills
    // that globe per reader — one "root tile" each — so opening on it makes a
    // visitor cost money before they have asked for anything. It opens on the
    // keyless satellite stack instead, which is the same picture from orbit
    // (IGN's 20 cm orthophoto over France, a world satellite base beyond), and
    // `installPhotorealAdoption` swaps in the real thing on the reader's first
    // rest under 25 km. See that file for why the boot flight itself does not
    // count as a reason to buy.
    //
    // AND A READER WHO ALREADY HAS THE 3D GLOBE OPENS ON IT. The saving above
    // is paid for in a visible swap — one basemap built, then thrown away for
    // another — and there is exactly one way to not show somebody two
    // basemaps, which is to not build two. A reader who adopted the mesh on an
    // earlier visit is a reader who will adopt it again on their first touch,
    // so the root tile is spent either way; opening on it just spends it
    // without the swap. First visits are unaffected, and so is the harness
    // fleet, which never adopts anything.
    //
    // AND A PHONE NEVER ADOPTS AT ALL. `touchstart` is one of the four events
    // that count as taking hold of the globe, so on a handset the FIRST TAP
    // ANYWHERE under 25 km used to buy Google's mesh — the heaviest surface
    // this app can show — and write the memory that makes every later visit
    // open straight onto it. That is the sequence that ends with iOS killing
    // the tab. The chip stays available (`canLoadPhotoreal` is untouched, so
    // `mapStackController` still offers "Google 3D" and still says why when it
    // cannot): a reader who deliberately picks the mesh gets it, with the
    // phone ceilings from `photorealTilesetOptions()`. What is removed is the
    // path where nobody asked. Deliberately NOT `photorealDisabled`, which
    // would grey the chip out and make it blame the credentials for a door
    // this session closed on purpose.
    const phoneShell = isPhoneShell();
    const defaultStack = canLoadPhotoreal ? PHOTOREAL_ADOPTION_STACK : null;
    // A hand-off IS the adoption: the reader pressed « Ouvrir le globe » over
    // a photoreal picture, and only the photoreal globe draws that picture.
    const adoptedBefore = canLoadPhotoreal && !phoneShell
      && (Boolean(handoff) || photorealAlreadyAdopted());
    const startupStack = photorealOff
      ? 'osm'
      : (adoptedBefore ? 'photoreal' : (defaultStack || (keylessMode ? 'osm' : 'google-roadmap')));

    const mapStackController = new MapStackController(viewer, {
      // Deferred rather than loaded: see `loadPhotoreal` above. The controller
      // owns the one attempt, the cache and the error, because it is the thing
      // that knows when the globe is about to be shown.
      loadPhotoreal,
      cesiumToken,
      // Not a failure and not a missing credential — nobody asked for the
      // tileset. Without this the chip would blame the key or the network for
      // a door the session closed on purpose.
      photorealDisabled: photorealOff,
      // Lets the controller say WHY photoreal is unavailable: no key at all
      // (keyless build) reads differently from a keyed build whose tiles
      // failed, and both arrive here as `googleTileset: null`.
      googleKeyConfigured: !keylessMode,
      ignTerrainSpike,
      initialStack: startupStack,
      arcgisApiKey,
      // Task 5 (height-datum fix): rebroadcast stack changes as a window
      // CustomEvent so data layers (CCTV per-regime ground resolution) can
      // react without coupling MapStackController to layer modules. Fires on
      // 'switching'/'ready'/'error'; listeners derive the surface regime from
      // live scene state, so intermediate emissions are harmless.
      onChange: (state) => {
        window.dispatchEvent(new CustomEvent('gev:map-stack-changed', { detail: state }));
      },
      onError: (message) => console.warn('[MapStack]', message),
    });
    // ONE imagery construction per page load. The hash is read HERE, before the
    // first activation, instead of being left to the share restore a second and
    // a half later: `_activateGlobeStack()` destroys and rebuilds every imagery
    // layer, so activating the build's default and then switching made the
    // reader watch one basemap appear, get thrown away, and a second refine
    // coarse→sharp from an empty tile cache. On `#map=ign-plan` that was,
    // literally, OSM followed by Plan IGN on every reload.
    //
    // Availability is asked of the controller rather than re-derived here — it
    // is the one place that decides — and an unavailable or unknown request
    // falls back to `getActiveId()`, which is `startupStack` already resolved
    // against what this build can show. The share restore's own `setStack()`
    // then short-circuits on the live stack.
    const requestedStack = peekShareMapStack(handoffShare?.hash);
    const bootStack = requestedStack && mapStackController.isStackAvailable(requestedStack)
      ? requestedStack
      : mapStackController.getActiveId();
    // The satellite stack's world base must know, before its first tile,
    // whether this deployment may ask the anonymous Esri endpoint: the browser
    // fetches those tiles itself, so nothing downstream could take a request
    // back. The probe started at the top of this function and has usually
    // answered by now; the wait is bounded, and a late answer is still applied
    // below, swapping the base in place. A build with an ArcGIS key does not
    // ask that endpoint at all, and does not wait.
    if (!arcgisApiKey && bootStack === 'ign-ortho') {
      const probe = await trialProbe.within(WORLD_BASE_PROBE_WAIT_MS);
      mapStackController.setAnonymousEsriAllowed(anonymousEsriAllowedByProbe(probe));
    }
    await mapStackController.setStack(bootStack, { silent: true });
    // Same bookkeeping as an adoption, so the next visit opens on the globe
    // this one ended on.
    if (handoff && mapStackController.getActiveId() === 'photoreal') rememberPhotorealAdoption();

    // The star field follows the imagery: it belongs to a photograph of the
    // Earth, not to a drawing of it. Deferred on this first call so a build
    // that opens on a satellite basemap still does not pay 848 kB inside its
    // own boot — see `src/starfield.js`. The boot activation above is silent
    // and emits no event, which is why it is synced here by hand rather than
    // only through the listener below.
    const starfield = installStarfield(viewer.scene, {
      requestRender: governorRequestRender,
      // 848 kB of Tycho-2 JPEGs and six cube-map faces resident on the GPU,
      // for a decoration behind a globe that fills the screen on a handset.
      enabled: !phoneShell,
    });
    starfield.sync(mapStackController.getActiveId(), { defer: true });
    window.addEventListener('gev:map-stack-changed', (event) => {
      if (event.detail?.status === 'switching') return;
      starfield.sync(event.detail?.activeId);
    });

    // Initialize the style manager (post-processing, HUD, locations, share links)
    const styleManager = new StyleManager(viewer, { mapStackController, initialShare: handoffShare });
    // The previous multi-canvas weather compositor remains disabled. Cockpit
    // clouds use a separate, capped low-resolution GPU pass that never attaches
    // Cesium fog or post-process stages and is fully stopped in map mode.
    const weatherEffects = null;
    const cockpitCloudEffects = initCockpitCloudEffects(viewer);

    // The sources this deployment does not use (GEV_NONCOMMERCIAL_SOURCES —
    // src/nonCommercialSources.js), read from the boot's one `/api/trial`
    // answer. A clone, or a failed read, changes nothing. Without Open-Meteo
    // the cockpit loses its WX toggle and weather readings; without Google
    // News its headlines name GDELT alone; and the popover drops the
    // attribution for data it can no longer show. The layers a switched-off
    // source feeds are withheld further down, once the panel exists.
    void trialProbe.read().then((probe) => {
      // Before the early return: on a clone this is what opens the anonymous
      // Esri endpoint, and it waits for this answer like everything else.
      mapStackController.setAnonymousEsriAllowed(anonymousEsriAllowedByProbe(probe));
      const off = offSourcesFromProbe(probe);
      if (!off.size) return;
      withdrawDataCredits(viewer, creditKeysOf(off));
      if (off.has('open-meteo')) {
        cockpitCloudEffects.setSourceAvailable(false);
        styleManager.cockpitView?.setWeatherAvailable(false);
      }
      if (off.has('google-news')) styleManager.cockpitView?.setGoogleNewsAvailable(false);
    });

    // The 3D globe, bought on the reader's first close rest rather than on
    // arrival. Installed here because it needs the boot flight: that flight
    // descends to 600 m by itself, so it ARMS the watch instead of tripping it
    // — otherwise every page load would buy a root tile five seconds in and
    // the keyless opening above would save nothing. See src/photorealAdoption.js.
    // Not installed for a reader who already has the globe: `startupStack` put
    // them on it, so there is nothing left to adopt. Nor on a phone, where the
    // first tap anywhere would trip it — see the block above `defaultStack`.
    const photorealAdoption = defaultStack && !adoptedBefore && !phoneShell
      ? installPhotorealAdoption(viewer, mapStackController, {
        fromStackId: defaultStack,
        onAdopt: ({ altitudeM, reason }) => {
          // Written here rather than inside the module so the decision to
          // persist stays visible at the call site, next to the startup stack
          // it changes on the next visit.
          rememberPhotorealAdoption();
          console.info(
            `[MapStack] Adopting Google 3D Tiles — the reader ${reason === 'input' ? 'took hold of the camera' : 'came to rest'} at ${Math.round(altitudeM)} m.`,
          );
        },
      })
      : null;

    // `?q=` with something in it: the destination IS the arrival, so the boot
    // flight to Paris would only be a detour. The geocoder answers in well
    // under a second; the same boot-flight bracket holds the layers meanwhile.
    // Nothing found: the usual toast, the text left in the search field, and
    // the ordinary arrival.
    const flyToInitialQuery = async (query, { fallback }) => {
      const outcome = await styleManager.flyToAddress(query, {
        onArrival: () => {
          endBootFlight();
          photorealAdoption?.arm();
        },
      });
      if (outcome.status === 'flying') return;
      if (outcome.status === 'cancelled' || outcome.status === 'superseded') {
        // The reader moved the camera first; their choice stands.
        endBootFlight();
        return;
      }
      if (outcome.status === 'not-found') styleManager._showToast('Location not found');
      else if (outcome.status === 'failed') styleManager._showToast('Search failed');
      const field = document.getElementById('location-search');
      if (field) field.value = query;
      fallback();
    };

    // « Utiliser ma position », granted on the showcase: the same fix comes
    // back at once (`maximumAge`), and the flight is the cockpit's own.
    const locateOnArrival = () => {
      if (locate) void styleManager.locateMe();
    };

    if (handoff) {
      loaderStatus.textContent = DEFAULT_CITY_VIEW.label;
      // The frozen frame lifts once the globe under it has drawn the same view.
      // …and once the cars the loop shows are on that ground too.
      const trafficDrawn = () => {
        const stats = dataManager.layers.get('traffic')?.module?.getStats?.();
        return Boolean(stats && stats.count > 0 && !stats.loading
          && (!stats.floorArmed || stats.floorWaiting === 0));
      };
      void whenSurfaceSettled(viewer, mapStackController, {
        requestRender: governorRequestRender,
        alsoReady: trafficDrawn,
      })
        .then((result) => {
          vitrineHandoff.result = result;
          handoff.onReady?.(result);
          if (initialQuery) void flyToInitialQuery(initialQuery, { fallback: () => endBootFlight() });
          else locateOnArrival();
        });
    } else if (!styleManager.hasShareState && initialQuery) {
      loaderStatus.textContent = initialQuery;
      beginBootFlight();
      void flyToInitialQuery(initialQuery, {
        fallback: () => flyToDefaultCity(viewer, DEFAULT_CITY_VIEW, {
          onSettled: () => {
            endBootFlight();
            photorealAdoption?.arm();
          },
        }),
      });
    } else if (!styleManager.hasShareState) {
      // If no share link state, do the default fly-to (Paris)
      // A phone lands instead of flying: the descent is four and a half
      // seconds of continuous rendering and a whole zoom pyramid of tiles
      // nobody looks at, over a mobile connection, in front of the first frame
      // anyone wants. See `flyToDefaultCity`. Nothing else in the sequence
      // changes — `beginBootFlight()` is simply not declared, and
      // `whenBootFlightEnds()` runs its waiters immediately, which is exactly
      // what it already does for a share link and for a second visit.
      const immediate = phoneShell;
      loaderStatus.textContent = immediate
        ? DEFAULT_CITY_VIEW.label
        : mainMessages().flyingTo(DEFAULT_CITY_VIEW.label);
      // Declared BEFORE the flight starts, because a layer restored from the
      // reader's last session is already asking the altimeter what to fetch.
      // See `bootFlight.js` for the four-times-slower arrival this avoids.
      if (!immediate) beginBootFlight();
      flyToDefaultCity(viewer, DEFAULT_CITY_VIEW, {
        immediate,
        onSettled: () => {
          endBootFlight();
          photorealAdoption?.arm();
          locateOnArrival();
        },
      });
    } else {
      loaderStatus.textContent = mainMessages().restoringShared;
      // A shared view IS the reader's choice of where to be, so their own
      // arrival counts: a link to a rooftop gets the 3D globe on landing.
      photorealAdoption?.arm();
    }

    // Initialize data layer manager
    const dataManager = new DataLayerManager(viewer, {
      allowQaRegistration: import.meta.env.DEV,
    });
    // Every production layer registers as a STUB — identity only, no module
    // behind it — and its 30-200 kB of code arrives on the first toggle that
    // needs it. See `src/data/lazyLayer.js`: statically importing all 60 put
    // 4 798 kB of the entry chunk's 7 278 kB (pre-minification, rollup's own
    // module graph, 2026-09-09) in front of a reader who has switched none of
    // them on. The manifest is generated from the modules and re-derived from
    // them on every `npm test`, so a stub can never describe a layer that no
    // longer exists.
    const layers = LAYER_MANIFEST.map((descriptor) => createLazyLayer(descriptor));
    for (const layer of layers) dataManager.register(layer);
    // Where OpenSky is off (GEV_NONCOMMERCIAL_SOURCES), the Flights row names
    // the source it will actually draw, adsb.lol, while it is still switched
    // off. Once loaded, the module says so itself (flights.js, `init`).
    void trialProbe.read().then((probe) => {
      if (!offSourcesFromProbe(probe).has('opensky')) return;
      const flights = layers.find((layer) => layer.id === 'flights');
      if (!flights || flights.__lazy?.isLoaded()) return;
      flights.source = 'adsb.lol';
      dataManager.refreshControls();
    });
    // `rocket-launches` and `military-awareness` read the manager back (one for
    // the satellites layer's params, the other to drive its own camera
    // hand-offs). The stub takes the reference now and passes it on the moment
    // its module loads; the manifest says which two ask for it.
    for (const layer of layers) layer.attachDataManager?.(dataManager);
    // Layers the app has set aside, code kept (src/data/pausedLayers.js).
    // Withheld BEFORE the seal, so the restoration that follows it can never
    // switch one on and have it switched off again a moment later.
    dataManager.withholdLayers(PAUSED_LAYER_IDS, { reason: 'paused' });
    // Restoration starts only after the complete production registry is sealed.
    dataManager.finalizeRegistrations(LAYER_STATE_REGISTRY, LAYER_TAXONOMY, LAYER_CATEGORIES);
    // The layers a switched-off source alone feeds (GEV_NONCOMMERCIAL_SOURCES —
    // src/nonCommercialSources.js; on the hosted site, the TeleGeography cable
    // map, whose files its server refuses) leave the panel once the boot's
    // `/api/trial` answer says so. Until it has, a request to switch one ON
    // waits for that answer — at most 5 s, the probe never rejects — so a share
    // link restored early does not fetch what the server will refuse. The
    // manager's own check runs after this guard and reads the answer.
    const withholding = trialProbe.read().then((probe) => {
      dataManager.withholdLayers(layerIdsOf(offSourcesFromProbe(probe)));
    });
    dataManager.addVisibilityGuard(async (change) => {
      if (!change?.enabled || !SWITCHABLE_LAYER_IDS.includes(change.layerId)) return null;
      await Promise.race([withholding, new Promise((resolve) => { setTimeout(resolve, 5_000); })]);
      return null;
    });
    if (import.meta.env.DEV) {
      window.__gevQaRegisterLayer = (targetManager, layerModule) => {
        if (targetManager !== dataManager) throw new Error('QA layer manager mismatch');
        return dataManager.registerForQa(layerModule);
      };
      window.__gevQaUnregisterLayer = (targetManager, layerId) => {
        if (targetManager !== dataManager) throw new Error('QA layer manager mismatch');
        return dataManager.unregisterForQa(layerId);
      };
    }
    dataManager.buildTogglePanel(document.getElementById('data-toggles'));
    // The dataset box lands AFTER the seal, by design: a plugged dataset is a
    // manifest, not a core layer, and `registerDataset` is its only door. The
    // shipped catalog (`datasets/*.json`) and whatever this browser plugged
    // earlier are registered here, and the panel to plug more is mounted
    // under the layer list.
    let datasetBox = null;
    try {
      datasetBox = initDatasetBox({ dataManager, viewer, catalog: CATALOG_DATASET_MANIFESTS });
    } catch (error) {
      console.warn('[datasets] box init failed:', error);
    }
    // THE DESKTOP'S LAYERS PANEL: the groups as a column of buttons, and the
    // rows of one group in a list beside it (src/data/layerPanelRail.js). The
    // phone sheet keeps the accordion, so the rail is not mounted there.
    let layerPanelRail = null;
    if (!phoneShell) {
      try {
        layerPanelRail = mountLayerPanelRail({ dataManager });
      } catch (error) {
        console.warn('[data] layer rail mount failed:', error);
      }
    }
    styleManager.attachDataManager(dataManager);

    // The voice agent, its annotation engine and the scene director are 360 kB
    // of the boot bundle and none of them draws the map — so they are mounted,
    // not built: the mic panel appears now, its machinery arrives at browser
    // idle (or immediately if somebody reaches for the mic first). See
    // `src/voice/lazyVoice.js`.
    // Republished under the names eight QA harnesses and the console already
    // know. Called from BOTH sides because the order is genuinely undecided:
    // the stack can land before `window.__godsEyeView` is published (nothing
    // between here and there awaits, but nothing promises not to either), and
    // a one-sided version would silently leave the three fields null forever.
    let voiceStack = null;
    const publishVoiceStack = () => {
      if (!voiceStack || !window.__godsEyeView) return;
      window.__godsEyeView.voiceCommands = voiceStack.controller;
      window.__godsEyeView.annotations = voiceStack.annotations;
      window.__godsEyeView.sceneDirector = voiceStack.sceneDirector;
    };
    const voice = installLazyVoice({
      viewer,
      styleManager,
      dataManager,
      // Asked for at voice-load time, not captured here: the 3D globe is
      // bought on first activation now, so at this line it usually does not
      // exist yet — and by the time somebody speaks, it often does.
      getTileset: () => mapStackController.getPhotorealTileset(),
      onReady: (stack) => { voiceStack = stack; publishVoiceStack(); },
      // No idle preload on a phone: 360 kB fetched during boot, over a mobile
      // connection, for a feature most visits never open. The panel is still
      // there and every trigger still loads it — the microphone just pays for
      // itself when somebody reaches for it.
      idleTimeoutMs: phoneShell ? null : undefined,
    });
    // The crown on the mic, where voice is sold (src/voicePremium.js): one
    // small request once the boot burst has drained — nobody is waiting on it,
    // and a phone gets it too, since its voice stack loads only on a tap.
    whenIdle(() => { void loadVoicePremium({ probe: trialProbe }); }, 4_000);

    // Keep startup chrome truthful: a share is not restored until camera,
    // visual/map/panel lanes, and every requested layer have terminated.
    void Promise.all([
      styleManager.initialRestorePromise,
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]).finally(() => {
      loadingScreen.classList.add('hidden');
      // Reveal only after the loading cover has yielded. transitionend can be
      // absent under reduced motion, so a bounded fallback makes this reliable.
      let firstRunRevealed = false;
      const revealFirstRun = () => {
        if (firstRunRevealed) return;
        firstRunRevealed = true;
        // `?waitlist=1` is the link the launch post points at: the waitlist
        // card takes the first-run launcher's place rather than stacking on it.
        if (new URLSearchParams(window.location.search).get('waitlist') === '1') {
          requestWaitlistCard({ reason: 'direct', explicit: true });
          return;
        }
        // After the boot flight has LANDED, not when the veil lifts: the veil
        // lifts 2.5 to 3.5 s before the descent ends, and a card revealed then
        // covers exactly what the boot just paid for. Immediate on a phone and
        // on a share link, which do not fly; bounded by BOOT_FLIGHT_DEADLINE_MS.
        //
        // dataManager is passed explicitly: a choice switches layers on through
        // it, and reaching for styleManager._dataManager would make a private
        // field part of this feature's contract. `phoneSheet` is the sheet
        // controller built further down (variant C opens its Recherche tab);
        // this callback runs long after that line. Which variant, and whether
        // it is measured, is src/firstRunBoot.js's call.
        whenBootFlightEnds(() => {
          void startFirstRunExperience({ styleManager, dataManager, phoneSheet, probe: trialProbe });
        });
      };
      loadingScreen.addEventListener('transitionend', revealFirstRun, { once: true });
      setTimeout(revealFirstRun, 900);
    });

    // The hosted trial's waitlist card (src/waitlistCard.js). Loaded on the
    // first request for it — the HUD, the voice dock or `?waitlist=1` — so a
    // visit that never meets the trial never downloads it.
    let waitlistCard = null;
    window.addEventListener(WAITLIST_OPEN_EVENT, (event) => {
      // Any trial refusal means the voice trial cannot open any more either.
      if (event.detail?.reason === 'voice' || event.detail?.reason === 'exhausted') markVoicePremiumSpent();
      waitlistCard ??= import('./waitlistCard.js')
        .then(({ initWaitlistCard }) => initWaitlistCard())
        .catch((error) => {
          waitlistCard = null;
          throw error;
        });
      waitlistCard
        .then((card) => card.open(event.detail || {}))
        .catch((error) => console.warn('[waitlist] card unavailable:', error));
    });

    // Provider Settings (the POWER UP chip + dialog). DEV ONLY, and it always
    // was: `/api/setup/status` is installed by `configureServer` alone, so it
    // does not exist under `vite preview` and has never existed in a
    // deployment. The module handled that by fetching it anyway and removing
    // its own surface on the failure — one guaranteed 404 on every production
    // page load, on the connection where it costs the most. Asking the build
    // instead costs nothing and drops the module from the bundle.
    if (import.meta.env.DEV) void initKeySetup();

    // Expose for debugging
    // Idle render governor: flips the scene into requestRenderMode whenever
    // nothing animates per frame. Installed AFTER every module above has had
    // its chance to register pre-install holds. (perf wave 2)
    installRenderGovernor(viewer);

    // The system can take the WebGL context back at any moment — iOS under
    // memory pressure, Android on a backgrounded tab, any driver on a reset.
    // CesiumJS listens for none of it: the next frame throws and the widget
    // replaces the globe with its own English "Rendering has stopped" panel,
    // on a page that is otherwise in French, with no way out but a reload the
    // reader has to think of. See src/contextLoss.js. Installed after the
    // governor so the loop it stops is the one that is actually running.
    const contextLoss = installContextLossRecovery(viewer, {
      showNotice: (text, options) => styleManager.showNotice(text, options),
    });

    // Coarser imagery/terrain while the camera moves, full detail the moment it
    // settles. The intro fly-to descends through the whole zoom pyramid over
    // one point, refining every level it passes and discarding it a frame
    // later; this declines that work without touching a still frame.
    //
    // In `lite` the same motion window also trades pixels: 0.8 linear is 36 %
    // fewer of them, and it is the second-biggest of the four fixed costs
    // (−5 to −26 % at 1366×768, −40 to −48 % at twice that — a fill-bound
    // lever only pays where fill is the constraint). One motion state machine
    // owns both trades, and the governor's header says why that is not
    // optional: implemented as its own, this lever loops.
    installGlobeDetailGovernor(viewer, {
      movingResolutionScale: isLiteProfile() ? MOVING_RESOLUTION_SCALE : null,
    });

    // What the DISPLAY-rail switch can still change once the page is up.
    // `msaaSamples` is settable on a live scene even though it is a
    // construction argument; `preserveDrawingBuffer` is not, and that is why
    // the switch persists its choice — the next load completes the trade.
    onPerfProfileChange((profile) => {
      const lite = profile === 'lite';
      viewer.scene.msaaSamples = lite ? LITE_MSAA_SAMPLES : FULL_MSAA_SAMPLES;
      setMovingResolutionScale(lite ? MOVING_RESOLUTION_SCALE : null);
      governorRequestRender('perf-profile');
    });

    // The explicit scope mask replaces the emergent six-pass artifact —
    // see src/scopeMask.js. Installed before the UI so the DISPLAY-rail
    // toggle finds it live.
    // The scope is OFF by default on every shell since 2026-09-23. On a phone
    // it drew a smaller picture on a 390 px screen; on a 16:9 desktop it is
    // sized from the viewport height and blacked out both sides, so the globe
    // read as a view through a porthole. A share link or a stored visual state
    // still restores it, because that is a choice and this is a default; the
    // toggle ships unlit in index.html. What a first run draws instead is the
    // light edge shade below (src/edgeShade.js). Switched off BEFORE the
    // install, so its first paint is the no-op of a disabled mask.
    setScopeMaskEnabled(false);
    installScopeMask(viewer);
    installEdgeShade(viewer);
    // moveEnd must fire once the camera has stopped, at every pose — see
    // src/cameraNoiseFloor.js (a Lyon share link never loaded its sales).
    installCameraNoiseFloor(viewer.scene, { Camera: Cesium.Camera });

    // Where north is, outside the cockpit. See src/globeHeadingTape.js: the
    // cockpit already answered this and the ordinary globe view did not.
    installGlobeHeadingTape(viewer);

    // THE PHONE SHELL. Returns null on anything that is not a phone, before
    // touching the DOM — so on a desktop this line costs one predicate.
    //
    // Here, and not earlier, for two reasons: `#cesium-credits` does not exist
    // until the Viewer is built (it is a constructor argument above), and the
    // data panel has to have been rendered before « À LA UNE » can reorder it.
    const phoneSheet = initPhoneSheet({ dataManager });

    // THE DESKTOP TOP ROW: the place search at the top centre and the
    // « Apparence » bar at the top right (src/globeShell.js). The mirror of the
    // line above — null on a phone, before touching the DOM — and after it for
    // the same reason: the controls it adopts must already be wired.
    styleManager.attachGlobeShell(initGlobeShell({ ui: styleManager, viewer }));

    // THE NAVIGATION BAR at the bottom centre (src/globeNav.js): previous
    // view, top view, 2D / 3D, north, zoom, reset. Desktop only, like the top
    // row, and after it: it takes the reset button the « … » menu was given.
    initGlobeNav({ ui: styleManager, viewer });

    // The follow camera recomputes the tracked target's dead-reckon position
    // every frame — tracking anything is a per-frame animation. (perf wave 2)
    viewer.trackedEntityChanged.addEventListener(() => {
      if (viewer.trackedEntity) holdContinuousRender('tracked-entity');
      else releaseContinuousRender('tracked-entity');
    });

    // Hidden-state suspension (perf wave 2): when the window/tab is hidden,
    // stop the default render loop outright — a hidden canvas repaints for
    // nobody, and browser rAF throttling still lets throttled frames burn
    // GPU. Holder/data state is untouched, so return is seamless: restore
    // the loop, refresh the one DOM surface we gated, render a frame.
    const syncVisibilitySuspension = () => {
      const hidden = document.hidden;
      viewer.useDefaultRenderLoop = !hidden;
      cockpitCloudEffects?.setSuspended?.(hidden);
      if (hidden && phoneShell) {
        // GIVE THE TILES BACK BEFORE THE SYSTEM TAKES THE TAB. A backgrounded
        // tab on a phone is judged on what it still holds, and the mesh is by
        // far the largest thing this app holds — so the moment nobody is
        // looking, release every tile that is not needed for the current view.
        // `trimLoadedTiles` only marks them: the release happens inside a
        // traversal, and a scene in requestRenderMode is not traversing. Hence
        // the explicit synchronous frame, which is the last one this tab draws
        // before it goes quiet.
        mapStackController.getPhotorealTileset()?.trimLoadedTiles?.();
        try {
          viewer.scene.requestRender();
          viewer.render();
        } catch (error) {
          // A tab can be hidden BECAUSE the system took the GPU context away,
          // in which case this frame is the one that throws — and a throw
          // inside a `visibilitychange` handler would take the rest of the
          // suspension with it. `src/contextLoss.js` owns that case.
          console.warn('[phone] the background trim could not draw its frame', error);
        }
      }
      if (!hidden) {
        if (dataManager._panelRefreshPendingOnVisible) {
          dataManager._panelRefreshPendingOnVisible = false;
          dataManager._refreshTogglePanel();
        }
        governorRequestRender('visibility-restore');
      }
    };
    document.addEventListener('visibilitychange', syncVisibilitySuspension);
    // Chrome on Android freezes a backgrounded tab without a second
    // `visibilitychange`, so the trim above would never run on the one path
    // where it matters most. `pagehide` needs nothing: a tab going into the
    // bfcache is a tab the browser has already accounted for.
    document.addEventListener('freeze', syncVisibilitySuspension);
    // Apply the CURRENT state too — bootstrap can complete while the tab is
    // already hidden, and waiting for the next transition would leave the
    // loop burning behind a hidden tab. (perf wave 2 fix)
    syncVisibilitySuspension();

    window.__godsEyeView = {
      viewer,
      styleManager,
      // GETTERS, not values. The photoreal tileset is bought on the first
      // activation of its stack, so a boot-time snapshot would pin `null` on
      // the console and on every harness for the rest of the session — and
      // read `undefined` as "the 3D globe is broken" when it only means
      // "nobody has asked for it yet".
      get tileset() { return mapStackController.getPhotorealTileset(); },
      // 'google-key' | 'ion' | null — which door opened, once one has.
      get tilesetSource() { return mapStackController.photorealSource; },
      // Null on a build with no photoreal door. QA reads `isArmed()`/`isSpent()`
      // to tell "waiting for the reader" from "already decided".
      photorealAdoption,
      dataManager,
      // Null on the phone, which keeps the accordion.
      layerPanelRail,
      // Null until the voice stack lands — `voiceReady` is how a caller waits
      // for it without polling, and `loadVoice()` how it asks for it early.
      sceneDirector: null,
      mapStackController,
      annotations: null,
      voiceReady: voice.ready,
      loadVoice: voice.load,
      weatherEffects,
      cockpitCloudEffects,
      getRenderGovernorDiagnostics,
      // Two of the three session-global knobs the 2026-09-03 reload report
      // turned out to be about — the globe's error tolerance and the camera's
      // change threshold. The third, imagery constructions per page load, is
      // on `mapStackController` above. Exposed so `qa:map-reload` can watch
      // them rather than infer them from pixels.
      getGlobeDetailDiagnostics,
      getCameraSensitivityDiagnostics,
      // Which layers are watching for the camera to come to REST, and the view
      // each last read. `camera.changed` goes quiet before an eased flight
      // lands, so this is the only place a harness can see whether a layer
      // re-read the view it arrived on or is still describing the one it left
      // — see `cameraSettle.js` and `qa:camera-settle`.
      getCameraSettleDiagnostics,
      // The alpha every level of every fading layer was last drawn at, and the
      // camera scale it was drawn for — the only way a harness can tell a
      // crossfade from a blank frame without reading pixels (`zoomFade.js`).
      getZoomFadeDiagnostics,
      // Which render profile this machine got, WHY it got it, and what its own
      // frames measured — so a harness never has to infer "was this a lite
      // run?" from pixels. (perf plan 2.1)
      getPerfProfileDiagnostics,
      // Whether this session has a cursor, whether it gets the phone shell,
      // and the five signals both answers came from. The phone harnesses read
      // this instead of inferring the device from a viewport width — which is
      // the one thing that cannot tell a phone from a narrow window.
      getInputModeDiagnostics,
      // Null off a phone. `snapTo`/`getSnap` are how `qa:phone-shell` drives
      // the sheet without synthesising a drag — a synthetic gesture on this app
      // is its own experiment, and the harness is testing the layout.
      phoneSheet,
      // What the next tap will ask the scene for: a 3-pixel square and one
      // `pick` on a desktop, a 24 CSS-pixel square and a drill on a handset.
      // No harness can measure this from the outcome — SwiftShader answers
      // nothing for the bare globe and no Cesium entity paints headless — so
      // the seam publishes its own numbers instead. See `src/data/pickAt.js`.
      getPickDiagnostics: () => getPickDiagnostics(viewer.scene),
      // `{losses, plan, reloaded}` — what the tab did when the system took its
      // GPU context away. The only honest counter on a real handset: the
      // Safari inspector cannot show GPU memory, so this is what a device run
      // reads to tell "the ceilings are too high" from "the network was slow".
      getContextLossDiagnostics: contextLoss.getDiagnostics,
      // Whether the 848 kB star field has been paid for yet, and on which
      // basemap. `qa:starfield` asserts both halves of the contract.
      starfield,
      requestRender: governorRequestRender,
      // The dataset box: plug / unplug / infer / list, for the QA harness and
      // for anyone driving the app from the console.
      datasets: datasetBox,
      // Null unless this boot came from the showcase's frozen frame: the video
      // time, the pose it maps to, and how the wait for the first frame ended.
      // `qa:landing` reads it to prove the frame and the globe match.
      vitrineHandoff,
      // Logical model name -> the URL this build serves it from. A harness that
      // wants to load a GLB itself (track-regression's independent capability
      // control) cannot guess the content-hashed directory, and hardcoding
      // `/models/` would 404 on any build.
      modelAssetUrl,
    };
    // The other half of the ordering note above: if the voice stack landed
    // first, this is where its three fields stop being null.
    publishVoiceStack();
  } catch (error) {
    console.error("Surplomb initialization failed:", error);
    stopLoaderSun();
    loaderStatus.textContent = mainMessages().error(describeError(error));
    loaderStatus.style.color = '#ffb4a8'; // 6:1 on the veil's green; see src/boot.js
    // A hand-off that dies must not leave the reader in front of a frozen
    // picture: lifting it uncovers the loading screen's error line.
    if (requestedHandoff) {
      loadingScreen.classList.remove('hidden');
      requestedHandoff.onReady?.({ status: 'failed' });
    }
  }
}

let cockpitStarted = null;

/**
 * Start the cockpit, once per page. The module used to run `init()` on
 * import; it no longer does, so the showcase can fetch and evaluate this
 * whole graph at idle (src/vitrine/vitrine.js) and still build nothing until
 * the reader asks. See src/boot.js.
 *
 * @param {Parameters<typeof init>[0]} [options]
 * @returns {Promise<void>}
 */
export function startCockpit(options = {}) {
  if (cockpitStarted) return cockpitStarted;
  installIconFontFallback();
  cockpitStarted = init(options);
  return cockpitStarted;
}
