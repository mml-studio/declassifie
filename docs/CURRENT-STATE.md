# Surplomb Current State

Updated: September 24, 2026

> **2026-09-24 — « Aéroports » reads like its approved mock: an airport menu,
> two tiles under the row, and the noise plan as a card in the key.**
>
> - **The row.** `local-airports` + `bruit-fr` keep one fusion row, now with
>   `rowTiles` drawn as LINES (a tile with an `icon` is a line: glyph, name,
>   `blurb`, round light): « Les aéroports » (`plane`) and « Bruit &
>   urbanisme » (`audio-lines`). The mock's third tile, « Aides à
>   l'isolation », was the PGS, dropped by #364. The airports' display floors
>   (TOUS / AÉROPORTS / LIGNES) are the « Afficher » menu under the tiles
>   (`airportFloorSelect`, param `floor` unchanged).
> - **The airport menu.** While « Bruit & urbanisme » is lit, the row opens on
>   a `picker` published by `bruit-fr`: the 224 airports of the arrêté
>   register, named by `src/data/pebAirports.js` (the register's « P. CH.
>   DE-GAULLE » becomes « Paris-Charles-de-Gaulle · CDG », via the OurAirports
>   name and IATA code `/api/bruit-fr/index` now joins on the ICAO code). A
>   pick is an ACTION, not a param: the manager calls
>   `module.pickRowOption('airport', oaci)` and the camera flies south of the
>   field at −50°, 22 km up for an airport with scheduled flights, 14 km for
>   any other — both above the 12 km point-scan ceiling, so the whole plan is
>   drawn. The menu otherwise shows the airport the view is about: the drawn
>   airport nearest the ground at the centre of the screen (the scan centre is
>   pulled at most 6 km from the nadir and snapped to 0.05°, which named
>   Chelles-le-Pin over Roissy).
> - **The key is a card** (`legendHead`, `legendLink`, new generic slots): the
>   airport as kicker, « Bruit & urbanisme » (the tile's own name) as title,
>   « Plan d'exposition au bruit · PEB », the four zones by loudness only, then
>   « Des règles s'appliquent aux constructions. Cliquez sur une zone pour les
>   comprendre. Ce plan ne mesure pas le bruit en direct. » and an outlined
>   « Consulter le plan officiel ↗ » opening the airport's arrêté PDF (the
>   register's `http:` URL upgraded to `https:` on the same host). The rule of
>   each zone moved from the key line to the zone's card.
> - **A clicked zone** prints its card in the key (`legendSelection`), two
>   lines under « Zone A · Bruit très fort »: the rule in words (« Pas de
>   nouveaux logements. ») and the level in Lden (« 70 dB(A) et plus en
>   moyenne sur 24 h »; a pre-2002 plan prints the rule alone). The arrêté and
>   the drawing's precision stay on the globe card a phone still shows; the
>   airport is named over the zone only when it is not the card's own. The
>   globe keeps the tag « Zone A · Bruit très fort » (`compactCard`), as
>   antennas and permits do; an airport tag, clicked, prints its name and its
>   number of zones.
> - **On the globe**, each airport whose plan is drawn wears a chip — Maki's
>   `airport`, its name, its code, in DM Sans on the panels' green — instead of
>   the loudspeaker glyph, up to 150 km of camera distance for a field with
>   scheduled flights and 50 km for the others. While « Les aéroports » is on,
>   its own labels already name every field, so the chips step aside
>   (`airports/labels`, a `layerJoins` entry the airports layer publishes
>   while enabled).

> **2026-09-23 — « Grands incendies » has a second view, « Temps en 3D »:
> the three stages of the Gironde fire float at their own heights.**
>
> - **The switch.** Two segments over the key (`legendSegments`, caption
>   « Vue »): « Au sol » and « Temps en 3D ». They send
>   `setParams({ view: 'ground' | 'strata' })`; any other view returns `false`.
>   `getParams()` and `getStats()` report `view`. The view is module state: it
>   survives switching the layer off and on, and a view set before the pack
>   loads is applied when it lands.
> - **What it draws** (`girondeMegafire.js`, geometry in the pure
>   `megafireStrata.js`). Built on first use, then only shown or hidden: per
>   band a level at 6, 12 and 18 km (`MEGAFIRE_STRATA`, equal steps — height
>   is the ORDER of the stages, not the date to scale) made of the band's own
>   zone filled (`Primitive`, `PolygonGeometry` with `height`, α 0.75 of the
>   ground fill's) and the band's cumulative outline as a `PolylineGlow` halo
>   (12 px, α 0.40, flares to 1 with the ground rings' clock) under a 2.4 px
>   core; for the highest level shown only, dashed verticals from up to eight
>   silhouette tips down to the ground, the time axis (4.5 km west of the
>   scar, over the sea — the east tail sent it under the key when it stood on
>   the right), and the band's outline on the ground (`GroundPolylinePrimitive`,
>   α 0.5); one tick per level on the axis (`PointPrimitiveCollection`) with
>   the date label beside it on the world overlay. Each FIRMS detection moves to
>   its band's height (`placePoints`, one scratch `Cartesian3` for 9 524 writes).
>   The ground zones and rings are hidden; EFFIS stays dashed on the ground at
>   the end. Primitives in the air carry their role on
>   `Symbol.for('surplomb.megafire.air')` for the harness.
> - **The camera.** Switching views flies to the view's framing; in « Temps en
>   3D » every stop, arrow and replay frames the WHOLE stack (heading 16°,
>   pitch −24°, 3.4 × its radius), because the stages still to play rise above
>   the ones shown. `megafireFramingScale` backs the camera off on narrower
>   windows (by the map the key leaves free, up to ×1.6) and in portrait (by
>   height / width, up to ×2.4).
> - **The key** in « Temps en 3D »: « Plus haut = plus tard » over the three
>   dates, the dots « à l’étage de ses jours », EFFIS « au sol », and the note
>   « Une strate montre où les satellites ont vu la chaleur arriver, pas le front
>   des flammes. La hauteur ne mesure rien. »
> - **Proof.** `npm run qa:gironde-megafire`, 48 checks (section vi: the
>   segment by DOM click, three levels aloft and the ground zones gone, the top
>   level's rulers, detections at 6/12/18 km, the stack framing, a stop in the
>   air, and « Au sol » putting everything back).

> **2026-09-23 — « Incendies » replaces « Feux actifs (FIRMS) »: two mode
> tiles, and the Gironde fire of July 2026 replays as three rings of light.**
>
> - **The row.** `local-firms` keeps the row, named « Incendies » / "Fires"
>   (`layerTaxonomy.i18n.js`); its fusion (`layerFusions.js`, entry 16) is now
>   `tiles` + `primaryToggle` + the new `exclusive`: « Détections récentes »
>   (`flame`, `#ffa500`) and « Grands incendies » (`rotate-ccw-clock`,
>   `#ff4a36`) are tiles in the key, and pressing a dark one puts the other out
>   first (`manager._putOutOtherModes`, by visibility INTENT, so two quick
>   presses never leave both lit). Every tiled row now keeps its block in the
>   key while a member is on OR ON ITS WAY, and a whole-layer tile lights on
>   the press (`manager._memberWanted`): switching modes used to empty the key
>   for the second the new mode loaded. The row's toggle still lights the live
>   detections alone (the replay stays `optIn`). A tile label may wrap to two
>   lines (`.map-legend-tile-label`). The FIRMS source line reads « NASA FIRMS
>   · 24 h », not « LIVE ».
> - **Grands incendies** (`gironde-megafire-2026`, named « Gironde · été
>   2026 »). Pressing its tile (a `user` or `voice` origin) brings Dusk
>   (`ROW_PRESETS`) and Satellite (`ROW_BASEMAPS`, `ign-ortho`) — a member of a
>   row can now be keyed there alone — and `ui.js` calls the layer's new
>   `onReaderEnable()`, which flies the camera to a low oblique view over the
>   scar (heading 16°, pitch −34°, aimed a little right of the scar so the key
>   does not cover it). A share link or a session keeps its own camera.
> - **What it draws** (`girondeMegafire.js`). Three rings from `bands.json`
>   (`scripts/build-gironde-megafire-bands.mjs`, method in DATA_SOURCES.md):
>   for each band a translucent fill (one `GroundPrimitive`, one colour, α 0.40
>   / 0.30 / 0.22) and a dark casing + halo + core ring
>   (`GroundPolylinePrimitive`s with a `Color` material whose halo alpha flares
>   for 1.3 s when the ring appears), laid down LATEST FIRST and by kind (all
>   casings, then halos, then cores), so where two regions share an edge it
>   shows the earlier zone's colour and every zone keeps a whole outline; the
>   regions reach the scar's own edge (the build divides the band blur by the
>   blurred footprint); the 9 524 FIRMS
>   detections as one `PointPrimitiveCollection` sorted by paced position
>   (a cursor move is a binary search), 2.1 px at α 0.42 in their band's colour,
>   flashing to 7 px ivory for 0.12 of a stage as the replay reaches them; the
>   EFFIS perimeter dashed (`PolylineDash`) on the finished state only; one
>   date label per ring on the world overlay (source
>   `gironde-megafire-bands`, anchors from `bands.json`). No Copernicus fill,
>   front, flame or smoke is drawn any more: `megafireFire.js` and
>   `megafireFireMath.js` are deleted.
> - **The replay.** `megafireClock.js` takes `segments` (the three band ends)
>   and gives each the same share of an 18 s playthrough, time linear inside
>   each (`position` 0…3; `seekMegafireSegment` parks at a stage's end). The
>   bar is `megafireTimeline.js` (`#megafire-timeline`, style.css and
>   phone.css « THE MEGAFIRE REPLAY BAR »): fixed above the nav bar, width
>   `clamp(420px, 100vw − 800px, 880px)`, date and detection count on the
>   left, Lire / Pause / Reprendre / Rejouer and ‹ › on the right, three stops
>   and « Fin des détections ». While it is mounted `<html>` carries
>   `megafire-timeline-open` (the place chip hides) and the world overlay
>   keeps labels off it. A stop or an arrow parks the replay at that stage's
>   end and eases the camera over it; « Rejouer » from the end reframes the
>   whole scar. The key (`legendTitle` « Gironde · été 2026 », a new manager
>   field that names a block other than by its tile) does not change while
>   the replay runs.
> - **Proof.** `npm run qa:gironde-megafire` (rewritten, 34 checks: the mode
>   tiles by DOM click, Dusk and Satellite, the oblique arrival, one colour per fill, causal
>   detections at a stop, governor held while playing and released after the
>   last flare, arrows, switch-off).

> **2026-09-23 — on a desktop the mic rests in the bottom-right corner as
> « Parler à Surplomb », and opens into a card only while it is used.**
>
> - **Where.** `src/globeShell.js` moves `#gev-voice-control` out of
>   `#command-dock` into `<div id="voice-corner">` (index.html, ships
>   `hidden`; fixed, `right: 24px`, `bottom: 2vh`, z 150) and shows it. The
>   phone never runs the module: its mic stays in the dock, unchanged.
>   `createVoiceControl({ reset: true })` now rebuilds the panel IN PLACE
>   (`replaceWith`), so the controller's rebuild when the voice loads stays in
>   the corner; a panel built from nothing goes to a shown `#voice-corner`,
>   else the dock. `#voice-corner` is a right-rail obstacle (a node the rebuild
>   does not replace, so the rail's ResizeObserver keeps watching it).
> - **At rest.** One 48 px button, the mic glyph in ivory and the caption
>   `.gev-mic-caption` (« Parler à Surplomb » / « Talk to Surplomb »), « IA »
>   and the premium crown still on the ring. Kicker, OFF, STD, ~$0.00, the
>   meter and VOICE STANDBY are not drawn. Hover or keyboard focus raises the
>   help tray (the gesture and three examples) above it, right-aligned.
> - **In use** (`data-status` ≠ `idle`). A 256 px card: the mic (apricot ring
>   while `listening`), `.gev-voice-phase` — a sentence per `data-status`
>   written by `paintStatus()` through `voicePhaseLabel()` (Connexion…, Je vous
>   écoute, Surplomb répond, À vous, J’agis sur la carte…, Voix indisponible) —
>   then the level meter while sound flows (`listening`, or `answering` with
>   `data-speaker="ai"`) or `#gev-voice-detail` otherwise (trial count, waits),
>   and a last row with the tier chip and estimate on the left and
>   `.gev-voice-stop` « Arrêter » on the right, which calls
>   `controller.stopFromCard()`: `stop()`, then focus back on the mic (the mic
>   button still only opens or shuts the mic). Not on a hosted trial:
>   `beginTrialSession` marks the panel `data-trial`, the button is not drawn,
>   and `stopFromCard()` only shuts the mic there, because closing a trial
>   session loses the requests left and opens the waitlist card. Space on a
>   focused « Arrêter » presses it (`shouldHandlePushToTalkKeyDown` skips
>   `.gev-voice-stop`). The transcript stands above the card, labelled « Vous »
>   and « Surplomb » (`.gev-voice-transcript-who`; HEARD/SAID stay for the
>   phone); while you talk it may cover the foot of the right column or of an
>   address sheet. An error drops the stop row and shows the error tray above
>   with a ×. Only a hover on the mic raises the help tray while the card is
>   open. A touchscreen that is not a phone (`html[data-input="coarse"]`, a
>   tablet) keeps its « ? » beside the button at rest.
> - **Accessible name.** The mic button's `aria-label` opens with its visible
>   words, « Parler à Surplomb — <gesture> » (was « Contrôle vocal — … »), on
>   both shells (WCAG 2.5.3). « Arrêter » is named « Arrêter la conversation
>   avec Surplomb ». In the page, `#voice-corner` follows `#command-dock`, so
>   Tab reaches the bottom bar, then the mic.
> - **Rebuild.** In place, the rebuild no longer re-inserts `#location-bar`
>   into the dock either: on the phone it stays in the sheet's search tab once
>   the voice loads (the old reset path moved it back on every rebuild).
> - **Hidden** by the clean view and a recording (opacity/visibility, as the
>   dock) and in the cockpit (`display: none`, as the dock). The dev server's
>   `#key-setup-chip` moves to `bottom: 80px` and hides while the card or a
>   tray is up. `npm run qa:voice-corner` paints each state through the
>   controller (no microphone in headless Chrome) and measures it; `--coarse`
>   boots the tablet case (`?input=coarse`), `--phone` the phone.

> **2026-09-23 — the desktop globe has a navigation bar at the bottom
> centre: previous view, top view, 2D / 3D, north, zoom, reset, and a chip
> naming the place at the centre of the view.**
>
> - **Where (`src/globeNav.js`).** `<nav id="globe-nav">` inside
>   `#command-dock`, so the cockpit, the clean view and the recording mode hide
>   it with the dock. Desktop only: `initGlobeNav` returns null on the phone
>   shell. The dock is `grid-template-areas: 'nav'`, and `'nav voice'` while
>   `#gev-voice-control` is still a child of it. `#reset-globe-view` is MOVED
>   from the « … » menu into the bar with its listener (`resetToGlobeView`),
>   labelled « Réinitialiser »; its accessible name is now « Réinitialiser :
>   revenir au globe entier ». Under 1280 px wide the labels are visually
>   hidden (kept for screen readers and tooltips). `#toast` sits at 132 px.
> - **Camera.** A press takes the camera like a drag (ui.js
>   `takeCameraForGlobeNav`: stops verbs, orbit and flight, no
>   `_stampNavigation`, so the search mark stays); every control but zoom
>   first releases a followed object. Turns and zooms orbit the point at the
>   screen centre (`pickPosition` when it is ground, else the ellipsoid; none →
>   turn in place) with `lookAt` + `lookAtTransform(IDENTITY)` per frame, 650 ms
>   (zoom 380 ms, log-scale distance), instant under reduced motion; a canvas
>   pointerdown or wheel, or a newer camera tween, cancels them.
> - **Controls.** « Vue du dessus » flies to pitch -89.9° keeping the heading
>   (at -90° `lookAt` forces north up) and back to the previous pitch (default
>   -45°). 2D: heading 0, pitch -90°, `enableTilt` and `enableLook` off; a
>   settle more than 3° off that pose (a search, a share link) is levelled
>   again; the cockpit class or « Réinitialiser » leaves 2D without a move; 3D
>   restores the gestures and the pitch. North: heading 0 at the same pitch.
>   − / +: distance to the centre × 2 / ÷ 2, between 60 m and 27 000 km;
>   while following, `camera.zoomIn/zoomOut` in the follow frame. The needle
>   is rotated by `-heading` (sampled on `preRender` every 100 ms, written
>   when it moves 0.5°).
> - **« Vue précédente ».** `createViewHistory`, 30 framings: each
>   `camera.moveEnd` outside the cockpit and not following records the pose
>   (world position, direction, up). A settle within 0.35 camera heights, a
>   zoom ratio under 1.6, a turn under 25° and a tilt under 12° of the
>   framing's FIRST pose refines it; anything else opens a new one. Back pops
>   the current framing and flies to the previous one's last pose (1 s under
>   50 km, Cesium's duration beyond).
> - **Chip.** 350 ms after a settle, the centre point is looked up at
>   `geo.api.gouv.fr/communes?lat=&lon=&fields=nom,departement,region` when it
>   is inside a box around metropolitan France, Corsica or a DROM: commune
>   under 60 km of range, département under 350 km, région under 1 400 km,
>   nothing beyond or on the sea. 64 answers cached by point rounded to 3 dp;
>   a failed lookup is not cached. Text « Paris · Vue 3D » (Vue 2D, Vue du
>   dessus).

> **2026-09-23 — a place search leaves a mark: a pin on a precise place, the
> limits of a commune, a département or a région.**
>
> - **Which.** `searchMarkPlan` (`src/searchResultMark.js`) reads the
>   geocode's Google-shaped `types` through `placeOutlineLevelForTypes`
>   (`src/placeOutline.js`): `locality`/`postal_town` → commune,
>   `administrative_area_level_2` → département, `…_level_1` → région; a
>   `country` or a `natural-region-swath` gets nothing; everything else a pin.
>   `searchAndFlyTo` now returns the geocoded `lat`, `lng` and `types` with its
>   destination (all three return paths).
> - **Outline.** `/api/place-outline?level=&lat=&lon=` (vite.config.js,
>   `placeOutlineProxy`; 30/min per visitor, 120 global; 404 outside
>   metropolitan France): the commune containing the point from
>   `geo.api.gouv.fr/communes?lat=&lon=&geometry=contour` (256 vertices, 5 dp,
>   three largest pieces, kept per ~100 m point), the bundled IGN département
>   containing it (2 km coastal snap), or the région as the dissolve of its
>   départements (`territoires.json` mapping). Otherwise the client asks
>   `resolveAdminOutlineAt` (annotationResolver.js, Overpass `is_in` + relation,
>   the voice annotations' machinery; never a country). Drawn by
>   `drawGroundHighlight`, 3 px `rgba(255, 99, 88, 0.92)`, unpickable. No
>   outline found → a pin on the geocoded centre.
> - **Pin.** A filled SVG drop (`#e5484d`, rim `#5c1414`, ivory core) 30 × 42 px
>   in a `BillboardCollection`, `CLAMP_TO_GROUND`, never depth-tested away, and
>   the first part of the label beside it in a `LabelCollection` (DM Sans 600
>   15 px, ≤ 48 characters).
> - **Lifecycle.** `flyToAddress` shows it after landing (typed search, `?q=`,
>   first-run card); a city pill outlines its commune (`viewBounds` centre), a
>   landmark pill pins its POI. `_landOnSearchedLocation` clears it (so
>   « Autour de moi » does), and so does emptying `#location-search`. One mark
>   at a time: a newer show supersedes an outline still loading. The module
>   loads with the first search.

> **2026-09-23 — the desktop globe has a top row: place search at the top
> centre, « Apparence » and « … » at the top right; the scope and the HUD are
> off by default.**
>
> - **Top row (`src/globeShell.js`).** Desktop only: `initGlobeShell` returns
>   null on the phone shell before touching the DOM, and every rule hangs off
>   `html.globe-shell`, the class it sets once done. It MOVES existing controls
>   with their listeners, as `src/phoneSheet.js` does on a phone:
>   `#location-search-form` into `#place-search`, `#location-pills` and
>   `#poi-row` into its menu, `#style-buttons` and `#param-slider-panel` (with
>   the cockpit portal's comment anchor) into Appearance › Style de carte,
>   `.map-source-section` into Appearance, `#pp-toggles` into « Réglages
>   avancés ». `#top-center-actions` is restyled as the « … » menu (labels are
>   `attr(aria-label)`), and it is no longer a right-rail obstacle.
> - **Search.** ⌘ K on Apple keyboards, Ctrl K elsewhere, and a bare « / »
>   outside a field. The menu lists up to 5 recent places
>   (`localStorage['surplomb.placeRecents.v1']`: a typed search that found
>   somewhere, reported by ui.js as `place-search:found` on the form, or a city
>   shortcut) and the city shortcuts, whose landmarks appear under them once a
>   city is chosen. `#place-search` carries `collapsed` while its menu is shut,
>   so the first-run bubble (variant C) closes when it opens; the bubble hangs
>   under the field (`placement: 'below'`).
> - **Panels by name.** `setPanelCollapsed` redirects an explicit open of
>   `location-bar`, `control-panel` or `pp-toggles` (the voice surface's
>   `set_panel_open`) to where their contents went; the two dock trays stay
>   collapsed. Choosing a style opens nothing on a desktop
>   (`_revealStyleParameters`): its parameters show under the previews.
> - **Style previews.** When Appearance opens, one copy of the Cesium canvas is
>   taken in `postRender` (the drawing buffer is not preserved), scaled to 320
>   px on its long edge, JPEG 0.72, and set as `--style-preview-image`; each
>   style is a CSS filter over it. Reused for 4 s.
> - **Scope off, edge shade on (`src/edgeShade.js`).** `scopeMask.js` starts
>   disabled (the share link reads it before `main.js` runs), and
>   `setScopeMaskEnabled` also switches the keyhole label fade
>   (`celestialRing.setKeyholeFadeActive`): with no circle drawn, labels
>   outside it are not dimmed, and the Fondu / Au-dehors rows hide. The shade
>   is one `<div id="edge-shade">` in the viewer container, CSS radial gradient
>   shaped like the viewport, clear over 55 % of the radius, corner opacity 30
>   % by default. Share key `es` (0-100); a link without `es` restores none, as
>   its author saw none; the showcase hand-off writes `es=30`.
> - **HUD off by default.** `GLOBAL_POST_DEFAULTS.hudVisible` is false and
>   `_initHUDToggle` follows it. `hv=1` links and the CRT/NVG/FLIR presets
>   still turn it on. `#globe-heading-tape` hides while `#intel-hud` is not
>   `.active` (desktop shell).
> - **CCTV panel.** `#cctv-panel` ships `hidden` and follows
>   `dataManager.isEnabled('cctv')` (`_syncCctvPanelPresence`).
> - **Biarritz** joins `CITY_POIS` (5 landmarks from OpenStreetMap), the pill
>   row and the `fly_to_location` enum (tool schema re-frozen: 38 327 bytes).
> - **Removed:** `#style-indicator` (STYLE ACTIF).

> **2026-09-23 — a Lyon camera plays its last hour; the camera panel is plain
> French and carries its own key.**
>
> - **Recording.** `src/data/cctvTimelapse.js`, driven from `cctvProxy()`,
>   records every catalog camera flagged `timelapse: true` (today the Grand
>   Lyon Criter pack, set in `normalizeGrandLyonCamera`): one fetch a minute
>   per camera, placeholder / truncated / byte-identical frames skipped, a
>   640-pixel JPEG (sharp, q68 mozjpeg, 34–54 KB) written to
>   `.gev-cache/cctv-timelapse/<id>/<t>.jpg`, pruned past 60 minutes, and
>   re-indexed from disk at start so a redeploy keeps the hour. Frames are on
>   disk only; memory holds the index. `CCTV_TIMELAPSE` = `on-demand`
>   (default: armed by any frame or timelapse request for such a camera, for
>   `CCTV_TIMELAPSE_WARM_MIN`, 180 min), `always` (set in
>   `deploy/vps/docker-compose.yml`, ≈ 7.3 GB/day inbound) or `off`;
>   `CCTV_TIMELAPSE_WINDOW_MIN` sets the hour. sharp is loaded lazily and the
>   recorder stays off if it cannot load.
> - **Serving.** `GET /api/cctv/timelapse/<id>` → `{ id, recording, mode,
>   windowMs, intervalMs, from, to, lastOutcome, frames: [{ t, url }] }`,
>   `no-store`; 404 `{ timelapse: false }` for a camera without a recording
>   (or with recording off). `lastOutcome` is the last attempt's result
>   (`stored`, `duplicate`, `placeholder`, `truncated`, `failed`…): CWL7033
>   (placeholder) and CWL5801 (truncated) never store a frame, and the panel
>   promises nothing for them. `GET /api/cctv/timelapse/<id>/<t>.jpg` → the
>   stored copy, `public, max-age=86400, immutable`, so a reader who comes
>   back downloads only the new minutes. `/api/cctv/sources` rows carry
>   `timelapse: true` while recording is possible; `/api/cctv/health` gains
>   the recorder's `timelapse` stats. The source disk cache is now
>   `schema: 2`, so the first boot after this change pulls the catalog cold
>   (≈ 11 s) rather than serve rows without the flag.
> - **Playback.** `src/cctvTimelapsePlayer.js` draws the loop on
>   `#cctv-timelapse-canvas`, over the live `#cctv-frame` that keeps
>   refreshing underneath (AGRANDIR and the in-world projection still read
>   it): 8 frames/s, 2 s on the newest, play/pause, a scrubber between the
>   first and last clock times, the frame's time top-left. Five frames
>   minimum; below that the panel says the timelapse is being built. The
>   manifest is re-read every minute; nothing is drawn or fetched while the
>   panel is folded, the tab hidden or the layer off. `prefers-reduced-motion`
>   opens paused on the newest frame.
> - **Panel.** The camera's name heads the panel; `#cctv-meta` reads
>   « <publisher> · direction connue / inconnue (cône en pointillé) » (OSM
>   cameras: « Repérée sur OpenStreetMap »); the badge reads EN DIRECT /
>   ACCÉLÉRÉ / STREET VIEW · PAS D’IMAGE PUBLIQUE / IMAGE · INDISPONIBLE.
>   `#cctv-key` carries the cone key in one sentence, and `cctvLayer` no
>   longer has `getRowControls()`, so the map legend has no camera block. The
>   calibration block, the CAL chip and `#cctv-summary` are `hidden` (the
>   voice `adjust` action and saved calibrations still work).

> **2026-09-22 — the hosted switch covers Google News RSS, the Street View
> CCTV fallback and the TeleGeography cable map too; the CCTV route no longer
> takes coordinates from the request.**
>
> - **Why.** Google News' terms allow personal, non-commercial use only; the
>   TeleGeography map is CC BY-NC-SA 3.0; Google's EEA Street View Static terms
>   forbid its imagery "With any Map", and the CCTV panel sits beside the globe.
>   The owner decided the hosted site drops all three; a clone keeps them.
> - **The list.** `src/nonCommercialSources.js` gains `google-news`,
>   `google-street-view` and `telegeography`. Each entry now carries a
>   `reason` (`non-commercial` by default; `display-terms` for Street View) and
>   the `layers` it alone feeds (the cable row). The variable keeps its name.
>   `/api/trial` and `/healthz` report
>   `["open-meteo","esri-world-imagery","opensky","google-news","google-street-view","telegeography"]`
>   where it is off.
> - **Headlines.** Where Google News is off, `/api/regional-brief` sends no RSS
>   request, asks GDELT first, names the source `GDELT` and adds
>   `googleNewsStatus: "off"` (in the cache key). The Regional News source line
>   reads « GDELT · REQUÊTE PAR LIEU · RÉCENT » / "GDELT · LOCATION QUERY ·
>   RECENT". GDELT answers 429 to a second request inside 5 s, so it is paced
>   in `src/upstreamPacing.js` (one every 6.25 s; a call that would wait more
>   than 5 s is refused, and the brief is then not cached).
> - **CCTV frames, both builds.** `/api/cctv/frame/<id>` takes the Street View
>   position from the server's own record of the camera — a catalog row, or
>   an OSM mapped camera it served from a box still in memory — and never from
>   `lat`/`lon` in the query; an unknown id gets the synthetic placeholder. The
>   aim (heading, FOV, pitch) may still come from the query. **Where the switch
>   is off** there is no Street View call at all: a camera whose frame fails
>   answers `404` with `X-CCTV-Source: unavailable`, and the panel prints its
>   « IMAGE · INDISPONIBLE » / "FRAME · UNAVAILABLE" badge.
> - **Cable map.** The two GeoJSON files are no longer a Vite asset: nothing
>   is emitted into `dist/assets/`. The server reads them from the checkout at
>   `/api/submarine-cables/cable-geo.json` and `/landing-point-geo.json`
>   (gzip at once, brotli-11 once warmed, `private, max-age=86400`, ETag); where
>   the switch is off it answers `404` with `X-Source-Off: telegeography`
>   without reading them. The page withholds the layer (`withholdLayers` in
>   `src/data/manager.js`): no Câbles tile on « Infrastructure numérique », not
>   among the row's followers, `showInTogglePanel: false`, and any request to
>   switch it on is refused with « « Câbles sous-marins » n’est pas disponible
>   sur ce site : la licence de ses données exclut l’usage commercial. » A
>   request made before the probe answered waits for it (5 s at most). Voice:
>   the "infrastructure mode" instruction names two layers where the cables are
>   off, and `set_layer_visibility` answers a withheld layer with
>   `withheld: true`.
> - **Credits.** The Google News RSS, Google Street View (new line) and
>   TeleGeography entries leave the Data attribution popover where the switch
>   is off; GDELT stays.

> **2026-09-22 — flights on the commercial build: OpenSky off, adsb.lol
> primary over four French circles, and adsbdb replaced by the VRS standing
> data in both builds.**
>
> - **OpenSky joins the switch.** `src/nonCommercialSources.js` lists
>   `opensky` (terms: "Any use by a for-profit or commercial entity … requires
>   a written license"). Where `GEV_NONCOMMERCIAL_SOURCES=off`, `/api/opensky`
>   serves adsb.lol only and never fetches OpenSky or its OAuth token;
>   `/api/opensky-track` answers 404 `{status: "off"}`; `/api/pulse` counts
>   « avions » from the four French circles (all four required);
>   `sourcesOff` lists `"opensky"` after `"open-meteo", "esri-world-imagery"`; the OpenSky credit is
>   withdrawn, and the Flights row names adsb.lol (the dormant stub via
>   `src/main.js`, the loaded module via `flights.js` `init`). A clone keeps
>   OpenSky primary, with the adsb.lol circle when its snapshot is stale.
> - **France in four circles.** `src/adsbLolFeed.js`: circles of 250 NM
>   centred on the quarters of 41.3–51.1 N, 5.2 W–9.6 E (farthest point of the
>   box 412 km from a centre, radius 463 km), merged per hex on the freshest
>   last contact, `time` = the oldest circle's. An anchor inside the box gets
>   them (`X-Flight-Coverage-Area: fr-metro`, the chip reads « France
>   métropolitaine et ses abords » / “mainland France and its borders”);
>   elsewhere, one circle, shared within 100 NM. From cold, the circle
>   nearest the anchor answers first and the three others follow one per
>   slot. Measured 2026-09-22 14:51 UTC: 1 033 aircraft in the box (974
>   airborne, 97 % with a designator) against OpenSky's 1 090 (971 airborne)
>   and 605 for one Paris circle; 1 855 drawn in all, borders included.
>   adsb.lol sees no ground traffic on the Paris aprons.
> - **One paced queue for api.adsb.lol**, ≥ 20 s between departures (the
>   limiter measured at ~3 requests/min per IP with a burst of 2), shared by
>   the civil circles and `/v2/mil`; idle when nobody asks; 429/420 pause it
>   60 s. France alone: each circle refreshed every 80 s, 100 s with the
>   military list wanted (the flights layer's military registry asks for it
>   every 60 s).
> - **Routes and type names: VRS standing data (CC0).**
>   `src/vrsStandingData.js` downloads github.com/vradarserver/standing-data
>   as one tarball a day and answers `/api/flight-info/route/:callsign` and
>   `/api/flight-info/type/:hex` in the shapes adsbdb's proxy had. Type
>   requests carry the feed designator (`?t=`); route requests carry the fix,
>   so a multi-leg number answers the leg the aircraft is on. On 756 airborne
>   airline callsigns over France: 637 found (84.3 %), 602 plausible (79.6 %),
>   every found one with its airline name; 946/946 designators named. The
>   airframe table holds 16 873 hexes (267 of 939 OpenSky contacts over
>   France), so on a clone's OpenSky feed most silhouettes wait for adsb.lol.
>   The adsbdb proxy, its calls and its cache are gone.

> **2026-09-22 — the world base under the Satellite stack follows its licence:
> ArcGIS Location Platform with `ARCGIS_API_KEY`, the anonymous Esri endpoint
> only where the deployment allows it, Sentinel-2 cloudless 2016 everywhere
> else.**
>
> - **Why.** Esri on `services.arcgisonline.com`: “as is stated in the terms
>   of use, this service is not available for commercial use”
>   (<https://community.esri.com/t5/arcgis-location-platform-developers-ques/inquiry-about-world-imagery/td-p/1569266>).
>   It is now `esri-world-imagery` in `src/nonCommercialSources.js`, so
>   `sourcesOff` reads `["open-meteo","esri-world-imagery"]` where
>   `GEV_NONCOMMERCIAL_SOURCES=off`.
> - **Choice.** `chooseWorldImagery` (`src/data/worldImagery.js`): a key →
>   `esri-licensed`,
>   `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=<key>`,
>   whatever the switch says; no key and the server said yes →
>   `esri-anonymous`; anything else, and after 6 distinct failed tiles on
>   either Esri path → `s2cloudless`. A dead key never falls back to the
>   anonymous endpoint. `mapStackController.getWorldImageryKind()` reports it.
> - **The page decides, not the server**, because the browser fetches these
>   tiles itself. `anonymousEsriAllowedByProbe` is true only on a `/api/trial`
>   answer that carries `sourcesOff` without the id: a failed probe draws
>   Sentinel-2. When the boot stack is `ign-ortho` and the build has no key,
>   `src/main.js` waits up to `WORLD_BASE_PROBE_WAIT_MS` (500 ms) for that
>   answer before activating it; a later answer calls
>   `setAnonymousEsriAllowed`, which swaps only the base layer in place (IGN
>   and its cache untouched, `show` kept so a sleeping base stays asleep).
>   `_activateGlobeStack` re-reads the base after its await, so an answer that
>   lands mid-switch is not lost. Measured on a preview build over the
>   mid-Atlantic: switch off 0 Esri / 65 EOX requests; switch unset 65 Esri /
>   0 EOX (the probe had answered, no swap); placeholder key 63 ibasemaps
>   requests with `token`, 0 anonymous.
> - **The key** is inlined at build time (`define`, `Dockerfile` ARG,
>   `deploy/vps/docker-compose.yml` build arg), like the Google browser key.
>   On-screen credit while it draws: “Powered by Esri · Source: Esri, Vantor,
>   Earthstar Geographics, and the GIS User Community”. Esri's CDN served
>   tiles to a made-up token on 2026-09-22, so a wrong key does not show on
>   the globe: check usage in the Location Platform dashboard.
> - **Sentinel-2 is the 2016 vintage now** (`s2cloudless_3857`). 2017 is
>   CC BY 4.0 too but covers Europe, North Africa and the Middle East only;
>   every other continent was white land.
> - **Credits.** The popover's one world-base line is three:
>   `world-satellite-keyless` (anonymous, withdrawn by the switch),
>   `world-satellite-arcgis` (licensed), `world-satellite-s2cloudless`. At boot
>   a build withdraws the Esri line it cannot draw
>   (`unusedWorldImageryCreditKeys`).
> - **Check.** `npm run qa:world-imagery-licence -- --url <preview> --expect off|on|licensed`.

> **2026-09-22 — `GEV_NONCOMMERCIAL_SOURCES=off`: a commercial deployment
> drops the sources licensed for non-commercial use only. Open-Meteo was the
> first (the blocks above add the others).**
>
> - **Why.** Open-Meteo's free API terms (<https://open-meteo.com/en/terms>)
>   say “You may only use the free API services for non-commercial purposes”.
>   surplomb.app is run by a company; a clone is its owner's own use.
> - **The list.** `src/nonCommercialSources.js` holds one line per source (id,
>   name, the terms that bind it, its credit keys). Unset or `on` keeps them;
>   any other value turns every listed source off, so a typo errs on the
>   licence's side. Read per request, like every `GEV_*` runtime switch.
> - **Server.** `/api/regional-brief` skips Open-Meteo and answers
>   `weatherStatus: "off"`, `weather: null`; with a place and news it is
>   `ready`, not `partial`. The switch is in its cache key, so a brief cached
>   with weather never answers once it is off. `/api/weather-effects` answers
>   `200 {status: "off", weather: null}` before its rate limiter and without a
>   fetch (`X-Weather-Effects: OFF`). `/api/trial` and `/healthz` carry
>   `sourcesOff` (`[]` on a clone, `["open-meteo"]` where it is off).
> - **Page.** `src/main.js` reads `sourcesOff` from the boot's one
>   `/api/trial` answer (no new request). Without Open-Meteo: the WX toggle is
>   hidden; the cloud pass stops and never asks (the reader's saved WX
>   preference is kept); Local Info shows the place and the position under
>   « LIEU / POSITION » / “PLACE / POSITION” and « OPENSTREETMAP · UTC », with
>   neither the four weather boxes nor the Open-Meteo link; and
>   `withdrawDataCredits` takes the Open-Meteo line out of the “Data
>   attribution” popover. If the probe fails, a route's `off` answer flips the
>   same one-way switch.

> **2026-09-22 — the globe says when a model is talking (EU AI Act art. 50).**
>
> - **The mark.** `src/aiDisclosure.js` builds a 17×13 px cream pill reading
>   « IA » (« AI » in English, `src/aiDisclosure.i18n.js`), `role="img"`, with
>   the sentence it stands for as its `aria-label` and `title`. The disclosure
>   before it was the voice dock's `AI AGENT` kicker: English on both globes,
>   0 px wide at 1440×900, `display: none` on phones and hidden whenever a
>   dock panel opens. The kicker is unchanged (instrument lettering).
> - **On the mic, always.** `createVoiceControl()` puts the mark inside
>   `.gev-mic-orbit`, upper left (`top/left: -3px`), mirroring the premium
>   crown on the upper right; the button's `aria-describedby` is
>   `gev-voice-ai-badge gev-voice-help`. Sentence: « Assistant d’intelligence
>   artificielle — voix de synthèse ». It names no vendor, since the voice
>   provider is OpenAI or OpenRouter per instance.
> - **On the HUD summary, only while a model wrote it.**
>   `IntelHUD._setSummaryText(text, animate, aiGenerated)` sets
>   `data-ai-generated="true"` on `#hud-summary` when `aiGenerated` (only the
>   `/api/openai/hud-summary` answer passes it) and removes it otherwise; the
>   badge beside `SUMMARY` shows through
>   `.hud-summary-wrap:has(#hud-summary[data-ai-generated='true'])`. Setting a
>   line outright now also stops a typewriter still typing an older one.
> - **Machine-readable.** `[data-role="said"] .gev-voice-transcript-text` (the
>   assistant's words) carries `data-ai-generated="true"` in the markup.
> - Checked by `npm run qa:ai-badge` (1440×900, panel open, 820 px, phone,
>   English; it sets `data-voice-premium` itself so the crown is drawn).

> **2026-09-22 — terms of sale at `/cgv`.** A third legal page, `cgv.html`,
> built and served exactly like the two others: a third entry of
> `LEGAL_PAGES` (`src/legalNotice.js`), so the Rollup inputs, the Cesium-free
> page list and `legalPagesPlugin` take it with no new path, and `/cgv` and
> `/cgv.html` both answer, `no-cache`. French in both locales; the French text
> governs. Its `gev:legal:seller` region is filled per request from the
> legal notice's `GEV_LEGAL_*` (publisher, registration, address, email — no
> phone, no director), so `/healthz` `legal: true` also means the seller is
> named. Twelve articles for a B2B sale: professionals only (SIREN or VAT
> number at ordering, no consumer withdrawal right), the comfort features sold
> against the globe and layers that stay free, the price of the order page
> (excl. VAT; the page quotes none, and a test keeps `€` off it), monthly tacit
> renewal cancelled at the end of the running month without refund, the late
> payment terms of Code de commerce L441-10 II and D441-5, the data, valuation,
> risk and AI disclaimers, best-effort availability, liability capped at twelve
> months of payments, French law and the Paris commercial court. A `.notice`
> under the title says the paid offer is not open; a test holds it there
> until payment opens. Linked from the landing footer (« CGV » / “Terms of
> sale”, `vitrine.footer.terms`), the globe's credit line
> (`src/legalLinks.js`, now three links) and the two other legal pages'
> footers; every legal page links to the other two (tested).

> **2026-09-22 — the landing page speaks English too, and the globe's mark
> leads back to it.**
>
> - **One document, two languages.** `#vitrine` is translated like the globe:
>   every text and label carries a `data-i18n*` key, the English lives under
>   `vitrine.*` in `src/i18n/markup.i18n.js`, and what the scripts write
>   (pause/resume, « Finding your location… », « Opening the globe… ») is in
>   `src/vitrine/vitrine.i18n.js`. The page's language is the locale gate's —
>   so a browser in English now gets the English landing page as well as the
>   English globe. `src/boot.js` starts the showcase script only once the
>   markup is translated (it keeps the dock's resting line), and gives an
>   English tab the title « Surplomb — France, X-rayed. ». `<head>` stays
>   French: crawlers and link previews read it.
> - **No French flash.** On an English page `landing.css` keeps every child of
>   `#vitrine` but the picture transparent until `data-i18n-ready`; if the
>   translation never arrives the French shows after 3 s. The translation chunk
>   is 14 kB gzipped and only an English page fetches it.
> - **The switch.** An `EN` pill (`FR` on the English page) sits right of the
>   slogan in the header, and slides with it when the dock folds in. It is a
>   plain link to `/?lang=en|fr`, which works without JavaScript;
>   `src/vitrine/vitrine.js` routes a press through `switchLocale()`, so the
>   address comes back as `/` and `?lang=` never reaches a share link.
> - **One language only: `data-locale-only`.** The waitlist link, the footer's
>   « Liste d'attente premium » and the « premium » badge are French only: the
>   English page sells nothing. The credit — “Surplomb is built on God's Eye
>   View, the open-source globe created by Bilawal Sidhu”, both linked — is
>   English only, in the footer (decision of 2026-09-22). `landing.css` hides
>   each in the other language, and the i18n scanner does not ask them for a key.
> - **The ratchets now count the landing page.** `src/vitrine/` lost its R1,
>   R2, R4 exemption and `#vitrine` its R3 one; all stay at zero. A `<br>`
>   inside a sentence no longer splits it for R3 or `markup.test.mjs`.
> - **The globe's mark is a link to `/`** (`src/homeLink.js`, wired by
>   `src/ui.js`). A plain press opens `#home-confirm`, a native modal dialog:
>   « Revenir à la page d'accueil ? » / “Go back to the home page?”, with
>   Annuler (focused) and Confirmer. Confirm flushes the share hash, then
>   navigates, so Back returns to the same view; Cancel, Escape and a press on
>   the backdrop stay. A new-tab gesture (middle button, Ctrl, ⌘, Shift) is
>   left to the link and asks nothing. Without `<dialog>` the same question goes
>   through `window.confirm`.
> - **Measured.** `qa:landing` 133/134 on a build; the one failure, the
>   phone's 400 kB first screen, already fails on `origin/main` (407 kB; this
>   change makes it 411 kB: +1.1 kB HTML, +0.4 kB CSS, +0.4 kB JS, brotli).

> **2026-09-19 — the globe is bilingual by construction.** `src/i18n/` holds the
> whole mechanism; `docs/i18n/CONVENTIONS.md` is the rulebook every translation
> batch follows. The locale is decided ONCE, by the inline `/* locale-gate */`
> script in `index.html` (after the vitrine gate, before the stylesheet):
> `window.__GEV_LOCALE__` (QA) › `?lang=fr|en` (remembered in `localStorage`
> under `gev:locale:v1`) › the stored choice › `navigator.languages` (OFF:
> `LOCALE_AUTO_DETECT = false` until the language switch ships) › French. It
> writes `<html lang>` and nothing else; every module reads the locale from
> that attribute through `getLocale()` and never from `navigator` (Node has one,
> and `npm test` must stay French on an en-US runner). Switching language is
> store + `shareLink.flushHash()` + reload (`switchLocale()`), so no module ever
> repaints itself. Strings live in co-located catalogs (`<module>.i18n.js`,
> `{ fr, en }` per message, read at CALL time — ratchet R5 holds load-time reads
> at zero); numbers and dates go through `src/i18n/format.js`, whose French
> output is byte-identical to `toLocaleString('fr-FR')`. `src/boot.js` imports
> the static-markup applicator (`data-i18n*` attributes, English in
> `src/i18n/markup.i18n.js`) only when the page is not French: the entry chunk
> grew by 367 B gzipped and a French page fetches nothing more. Guards:
> `src/i18n/i18nRatchet.test.mjs` against `src/i18n/i18n-baseline.json`
> (R1 French literals 4,611, R2 UI literals 1,738, R3 `index.html` text 406,
> R4 `toLocale*('fr-FR')` 135, R5 0 — a count may fall, never rise;
> `npm run i18n:report`, `npm run i18n:tighten`), and
> `src/i18n/messagesParity.test.mjs` over every catalog. QA pages pin their
> locale through `newQaPage()` (French unless `GEV_QA_LOCALE=en`), and
> `npm run qa:i18n-en` opens the English globe, unfolds its panels and reports
> the French a reader can still see (advisory; `--strict` fails).
>
> **Fully bilingual as of 2026-09-20.** Every batch has landed: the shell
> (#285), the registry and statuses (#286), the Address X-ray (#283), real
> estate (#287), transport (#288), energy (#291), planning (#294), crime and
> schools (#293), health, amenities and telecoms (#297), risks and weather
> (#296), the shell's satellites — phone, trial, waitlist, legal links, scenes
> and styles (#295) — and the voice with the server's error codes (#298).
> Ratchets: R1 4,611 → 46, R2 1,738 → 14, R3 406 → 0, R4 135 → 1. What is left
> is the layer modules' `name`/`source` fallbacks (the panel reads the
> taxonomy) and `src/vitrine/*`, the French landing page, which was French by
> decision until 2026-09-22 (see the block above). English plurals go through `plural()`; a test refuses a hand-made
> one (#292).
>
> **Translated as of 2026-09-20 (waves 1 and the pilot):** the static shell and
> every panel (#285, with the FR/EN switch, browser detection and the A/B
> exclusion of non-French readers), the layer registry — 60 names, 7 groups,
> their source lines and the ACTIF/CHARGEMENT/ÉTEINT statuses, which harnesses
> now read through `data-feed-state` — the HUD, the loading screen, the zoom
> card and the credits (#286), the Address X-ray and the building cards (#283),
> real estate (#287), transport and mobility (#288), and the megafire pilot
> (#282). **Still French-only:** planning and land, crime and schools, health,
> amenities and telecoms, risks and environment, the shell's satellites
> (waitlist, phone sheet, legal links), and the voice with the server's error
> prose. Ratchets after wave 1: R1 2,958, R2 951, R3 0, R4 74.

> **2026-09-19 — the top of a phone, like Google Maps.** Under
> `html[data-shell="phone"]` only (`src/phoneSheet.js`, `phone.css`,
> markup `#phone-topbar` / `#phone-basemap-*` in `index.html`):
> the **search bar** is at the top, right of the logo — the
> `#location-search-form` form is adopted there, not copied; focus opens the
> *Recherche* (Search) panel (cities, landmarks) at `full`, under the bar, and
> a submit or a shortcut gives the map back (`peek`). The RECHERCHE (SEARCH)
> tab is hidden, its panel stays. Below it, a **row of chips**
> (`src/phoneLayerChips.js`): the eight *À LA UNE* (FEATURED) layers in a fixed
> order, switched on in place, preceded by any other row that is on, then
> *Toutes les couches* (All layers). A chip calls `dataManager.toggleRow()` and
> rereads `getPanelRowStates()` on every `visibility*` notification — the two
> public methods added to the manager. On the right, a **column of round
> buttons**: basemap, share, around me, globe; it fades out as soon as the
> sheet goes past `peek`. The **basemap** leaves the head of Layers for a panel
> of its own (`#phone-basemap-sheet`), as thumbnails: a real tile for
> Satellite, Plan IGN and OSM (`public/basemaps/`, see NOTICE.md), a pictogram
> for the five keyed basemaps. Rendering the globe on a phone is handled
> separately (`src/phoneRender.js`, #264).

> **2026-09-08 — the dataset box: a dataset is plugged in, no longer coded.**
> Contract and limits in `docs/DATASETS.md`; code in `src/data/dataset*.js`.
> Three doors: **＋ BRANCHER UN JEU DE DONNÉES** (＋ PLUG IN A DATASET) under
> the layer list (paste an address → draft → BRANCHER (PLUG IN), remembered in
> this browser under `gev:plugged-datasets:v1`), a `datasets/<id>.json` file
> (shipped to everyone at build time, validated by `datasetsCatalog.test.mjs`),
> and `npm run dataset:manifest -- <url>` — the command that follows a search
> on the data.gouv.fr MCP. Six adapters (`datasetSources.js`): GeoJSON,
> GeoJSONL, CSV, **data.gouv.fr through the tabular API** (pages of 200 typed
> rows, bounding-box filters on the position columns — never used in this
> repository before), WFS (`CRS:84`, measured against the Géoplateforme) and
> Opendatasoft (`in_bbox`). Everything starts from the browser: the French
> platforms answer with open CORS (measured); `/api/plug` is an allow-listed
> relay for those that refuse an `Origin` (INSEE), tried only after a direct
> attempt has failed.
>
> **What moved in the core.** `localGeojson.js` takes three hooks —
> `loadFeatures`, `cardCopy`, `invalidate` — and nothing else: a plugged
> dataset inherits the stems, cards, label arbitration and occlusion of the
> shipped packs. `manager.js` opens a door after the seal,
> `registerDataset()` / `unregisterDataset()`, which adds the taxonomy row
> derived from the manifest and redraws the panel; share tokens are NOT touched
> (a plugged dataset has none, and `docs/DATASETS.md` says why). A ninth group,
> `plugged` *JEUX BRANCHÉS* (PLUGGED DATASETS), empty at startup and without a
> header for as long as it stays empty. The voice enumeration stays byte for
> byte the same; the executor accepts any registered id, so `ds-<id>` can be
> commanded by voice.
>
> **What the row says** (CARTOGRAPHY A5, D1, F6, H1): *4 000 affichés sur
> 186 137 — plafond 4 000, premières lignes* (“4,000 shown of 186,137 —
> ceiling 4,000, first rows”), *42 dans la vue* (“42 in view”), *n sans
> position* (“n without a position”), *via relais* (“via relay”); beyond
> `maxSpanDeg` a dataset loaded for the view shows *rapprochez-vous* (“move
> closer”) as an instruction (`status: 'zoom-in'`), not as a failure. The
> legend carries one entry per group with its count.
>
> **One shipped manifest**: GeoDAE defibrillators (data.gouv.fr, per view), and
> it has no row of its own — its `fusion` block makes it a chip of *Santé &
> secours* (Health & emergency services), the doctors' row. License confirmed
> on the dataset page and carried in `DATA_SOURCES.md`. Its hours come from
> `c_dispo_horaires` since 2026-10-01, the day GeoDAE dropped `c_disp_j` and
> `c_disp_h`: an OpenStreetMap `opening_hours` value that `format: "hours"`
> reads back in the page's language, `Mo-Su off` (149,874 of 188,147 rows)
> declared blank because those rows hold their hours as free text in
> `c_disp_complt`. Two others were
> withdrawn for the same reason, which is the rule: **a manifest is not shipped
> for what a layer already draws.** The BD TOPO aerodrome footprints — the
> Aéroports layer ships 418 of them — and the remarkable trees of Paris, whose
> 183 are a tier of the Îlots de fraîcheur (Cool islands) layer, and since
> 2026-09-14 a REMARQUABLES (REMARKABLE) chip that loads them for the whole
> city without the 1,500 m limit that governs the rest of the canopy.
>
> **Verified**: 6,393 unit tests, 0 failures (60 new); `npm run
> qa:datasets -- --url … --deep` in a browser, 16 checks green: catalog on the
> panel, inference from an Opendatasoft page, plug/unplug through the API and
> through the form, a real load of the GeoDAE dataset plugged through the form
> (5,000 rows of the default view in 25 requests to the tabular API, capping
> declared), persistence across a reload.
> **Harness trap**: puppeteer's `page.click()` and screenshots time out on
> this page while `evaluate` answers in 1 ms — the harness clicks through the
> DOM and screenshots are opt-in (`--shots`).

> **2026-09-08 — the Site report says where the address stands in the
> country.** `src/data/baremeNational.js` carries eleven national scales
> measured by `npm run bareme:fr` on **1,200 ten-minute walking rings**, drawn
> with probability proportional to population over INSEE's 377,234 1 km grid
> cells (64,089,848 residents), zero refusals. The `Fiche implantation` (Site
> report) prints a **national percentile** per indicator and an **A→E letter**
> for the three whose meaning is not a matter of opinion. Method and
> measurements: #99.
>
> **Geometry is a join key, not a comment.** A value can only be ranked within
> a distribution measured on the same shape. Measured on the same sample, the
> interdecile range of a ring is **74%** of that of a 200 m grid cell: scored
> on `FILOSOFI_RAMPS`, a ring at the 10th percentile would read at the 22nd and
> a ring at the 90th at the 84th — one letter band off at each end. On a 5- or
> 15-minute ring, ring ranks are **refused and the card says so**; the price
> rank, measured on a 300 m disc, survives.
>
> **Eight indicators out of eleven have no letter.** A high price is good for a
> seller and bad for a buyer; a share of social housing is public policy. Those
> get a rank. The three that carry a letter state their convention on the same
> line.
>
> **A bug fell out of the measurement**: `implantationFeed.js` dropped the grid
> cell's `crs`, so every cell in Martinique or La Réunion landed in Hudson Bay
> and the report answered *aucun carreau INSEE habité* (“no inhabited INSEE
> grid cell”) for every overseas address. Fixed, regression test in place.
>
> **Browser QA passed**: `npm run qa:implantation -- --url http://localhost:4173`
> — 40 checks green on Lyon and Paris, including the five new ones. 6,200 unit
> tests, 0 failures.

> **2026-09-03 — the Z axis goes into service.** A follow-up to the
> `docs/CARTOGRAPHY.md` doctrine and to the representation audit of #78 (whose
> “state of application” section carried the detail, the measurements and the
> evidence). Before this pass, **a single** data layer put a datum on height
> (`bdtopo-buildings`, and it was the building's real height). There are now
> **ten**: seven by extrusion (`bdtopo-buildings`, `sitadel-fr`, `irve-fr`,
> `schools-fr`, `sup-fr`, `france-energy`, `local-datacenters`) and three by
> vertical polyline (`marine-buoys`, `earthquakes`, `anfr-fr`).
>
> **Four department/region prisms** replace four count choropleths
> (`choroplethPrism.js`: height = the absolute value on a FROZEN domain,
> color = a rate; shared envelope 4 km → 120 km, base on the ellipsoid).
> **Known trap, not yet declared in the legend**: two prism layers switched on
> together are NOT comparable — `irve-fr` and `france-energy` have the same
> `domainMax` (12,000), the same mode and the same graduations for charge
> points and for megawatts, and `irve-fr` / `schools-fr` / `sup-fr` extrude the
> same 96 polygons from the same base.
>
> **2026-09-10 — an eleventh, and it is register (4), finally named.** The
> `irve-fr` beam carries the site's charge points, as a frozen screen length
> corrected for tilt (`L · cos(tilt)`: 87% at −30°, 50% at −60°, zero at
> nadir). Its legend spells the convention out, which obligation (a) of F7
> requires and which no leader stem does yet. Its 40 km ceiling is not
> cosmetic: with the camera at 1,400 km, 64 px are worth 129 km, above the
> 120 km top of the frozen prisms.
>
> **BD TOPO buildings become a thematic support** (`buildingTheme.js`):
> `dpe-fr`, `dvf-sales` and `ads-fr` register a theme and paint the volumes, by
> precedence 10 < 20 < 30. An unjoined volume keeps its washed-out use tint —
> never the same sign as a measured value (A1).
>
> **Done at integration**, outside the agents' scope: `manager.js:2470` now
> guards with `Number.isFinite` like the on-map legend block, so an entry with
> no count (channel title, rule graduation, hatched key) no longer renders the
> literal string “undefined”; the proxy's three disk cache versions are bumped
> (IRVE 3→4, SCHOOLS 2→3, SUP 1→2) because the three rollups changed shape; and
> `ingestAisStreamEnvelope` finally captures the AIS dimension block, stored
> whole under `row.hull` rather than split again into four offsets.
> **Consequence to know**: `vesselHullFromRow()` only read `to_bow…` /
> `length`, so this wiring turned 100% of contacts into *non mesurés* (“not
> measured”) until the function accepted the three published shapes (reduced
> block first, offsets, then `length`/`beam`), re-validating the block rather
> than trusting it.
>
> **No browser QA was run on this work.** 994 unit tests over 32 files, 0
> failures; the Cesium renderings are argued from the shipped source, not seen
> on screen. It is the largest debt of this pass, and the AIS hull — whose data
> path has only just been closed — is the first thing to look at.

> **2026-09-17 — the showcase at `/`, the globe at `/globe`** (`src/boot.js` is
> the page's only entry; `src/vitrine/` owns the rest; markup `#vitrine` in
> `index.html`, styles `landing.css`).
>
> - **Two addresses, one origin.** `/` is the showcase's, `APP_PATH` (`/globe`,
>   `src/vitrine/gate.js`) is the globe's. Both are `index.html`: the SPA
>   fallback of `vite dev` and `vite preview` answers every path with it, with
>   the same `Cache-Control` and the same pre-compressed body (measured
>   2026-09-17), so there is no middleware and none is needed. One origin and
>   not a subdomain is what makes the swap invisible — `history.replaceState`
>   rewrites a path, never a host — and it keeps one `localStorage`, one cookie
>   jar, one referrer restriction on the browser Google key and one entry in
>   `GEV_PUBLIC_HOST`. `public/manifest.webmanifest` starts on `/globe`, scope
>   `/`.
> - **Which door.** `src/vitrine/gate.js`, mirrored by an inline script in the
>   head (run and compared by `gate.test.mjs` over 480 cases): `?vitrine=1|0`
>   forces; `/globe` (trailing slashes ignored) → cockpit; the QA flag
>   `window.__GEV_SKIP_VITRINE__` (set by `newQaPage` unless
>   `{ vitrine: true }`) → cockpit; a hash containing `=` → cockpit; `?q=`,
>   `?waitlist=`, `?welcome=` → cockpit; otherwise the showcase
>   (`html[data-vitrine]`). **A pure function of the address**: no storage is
>   read, and nothing is written on any arrival.
> - **There is no “already seen” memory** (`gev:vitrine-seen:v1`, #257,
>   retired by #260). It sent every later visit to `/` into the cockpit, which
>   made the home page unreachable at its own URL once a browser had opened the
>   globe. `/globe` replaced its purpose. `forgetVitrineSeen()` (called once by
>   `src/boot.js`) deletes the stale key from browsers that met #257 or #258.
> - **No engine behind the page.** `src/main.js` no longer starts itself:
>   `startCockpit(options)` does. On a wide screen the cockpit graph is
>   imported at idle (evaluated, nothing built); on a phone nothing is fetched
>   before the press. Cesium's widget stylesheet is inert on `index.html`
>   (`deferCesiumWidgets`, vite.config.js) until `boot.js` enables it.
> - **Identity and the 2 bis markup** (Codex “Belvédère”, 2026-09-19): the
>   symbol is inline SVG (`.brand-symbol`, planes in `currentColor`) before the
>   word, in `.top` and `.closing-brand`; `public/icon.svg` is the tab icon and
>   the source of `npm run icons:build` (all four PNG icons, on `#24473C`). The
>   loop is `position: fixed` behind the whole page on EVERY width; *Image
>   fixe* (Still image; `#vitrine-still`, shown only in `data-state="live"`) pauses it on
>   the current frame. The page ends on `.footer-ending`: the city with two
>   opaque blocks. The cockpit carries the same mark since 2026-09-19 (see
>   “Cockpit identity” below).
> - **The background** is a recorded loop (`public/landing/hero-*.mp4`,
>   hashed by `scripts/publish-landing-assets.mjs`), `data-state` poster → live
>   → fallback (reduced motion, Save-Data, 2G, error, 8 s). Renditions: desktop
>   2880×1800 AV1/HEVC and 1920×1200 AV1/H.264, phone 960×2078 AV1/HEVC, all
>   30 fps, recorded frame by frame (`capture-landing-hero.mjs --quality hq`).
>   `src/vitrine/renditions.js` picks the smallest definition covering the
>   box in DEVICE pixels, then smooth, then hardware (`mediaCapabilities`),
>   then AV1 > HEVC > H.264. `src/vitrine/heroLoop.js` (generated) lists them
>   with their `codecs=` strings and the camera law each loop was filmed with.
> - **The gallery is one scene** (2026-09-21, from Memel's mock). « Choisissez
>   une vue. » is no longer six tiles in an ivory panel but one picture at the
>   full width of the page, straight on the city, with the interface on its
>   edges: the heading top left, « Mettre en pause » top right, the view's
>   title and place bottom left, « Ouvrir dans le globe » bottom right (the
>   picture is the same link), and a bar of six tabs under it — Avions,
>   Immobilier, Trafic, Énergie, Bus, Numérique, Lucide icons
>   (`licenses/lucide/`). Markup `.stage` in `index.html`, the bar and the
>   clock in `src/vitrine/stage.js`. On a desktop the scene is sized to fit
>   the screen under the header band (1 143 × 761 px on 1440 × 900); on a
>   phone the picture is cropped to 4:3, the bar folds to 3 × 2, and the door
>   is only an arrow on the picture — the phone's docked « Ouvrir le globe »
>   already says the rest, and a second apricot button said it twice. The views share one grid cell; the incoming one fades in
>   over the outgoing one in 700 ms, and the outgoing one's words go in 200 ms
>   so the two titles never show through each other. Without JavaScript they
>   stand one under the other, each with its door (`@media (scripting: none)`).
> - **The views advance on their own**, a whole recording at a time: as many
>   passes of the view's loop as reach 10 s (`stageDwellMs`) — 12 s for the
>   six-second loops, 14.7 s for the power grid, 29 s for Roissy — and 8 s for
>   a view on its still. The active tab's underline fills in exactly that time.
>   The clock runs only while half the scene is on screen, so the first view a
>   reader meets is the first one, from its start; it holds while the pointer
>   rests on the scene, while the keyboard is inside it, and in a hidden tab.
>   A pointer resting 120 ms on a tab shows its view (a click or a tap does
>   too); the arrows, Home and End move along the bar (ARIA tabs, automatic
>   activation). A view picked any way starts from the beginning of its
>   STORY, never where it was left, and holds that first frame for 400 ms
>   while it fades in (`STAGE_ENTRY_HOLD_MS`): the power-grid file begins on
>   the lit columns (its still), its story — Europe dark, France switching on
>   — 11.67 s in (`openingS`, written by `build-landing-film.mjs` from
>   `--start`, carried by the publisher into `galleryLoops.js`). Such a film
>   is shown on its decoded opening frame before it plays (`data-cued`) and
>   cuts in rather than fading over a still that is not its opening
>   (`data-cut`). The first time the reader reaches for the bar, every view's
>   loop is fetched and cued, so the one they point at is ready. « Mettre en pause » stops the clock and the picture; reduced
>   motion starts paused; « Image fixe » pauses the scene as well.
> - **The loops follow the scene**: the six views and the voice answer are
>   recorded loops (`npm run landing:gallery:capture` then
>   `landing:gallery:build`: 6 s, cockpit interface kept, fixed camera where
>   the data move, a 2–3° orbit where they do not, the Bordeaux buses ×5;
>   the sale card of view 02 and a bus card on 05 are opened through the
>   layers' `selectCard`). 480/960/1440 (600/1200 for the voice band) in AV1
>   + H.264 (1440 AV1 only), the stills are frame 0 of each loop.
>   `src/vitrine/gallery.js` — itself fetched when the scene is three quarters
>   of a screen away — fetches ONLY the view on stage and the next one in line
>   (`stageGate`), plays only the view on stage while the scene is on screen,
>   restarts a view from 0 when it comes up, and obeys the hero's policy and
>   *Image fixe* (Still image). Loops are chosen for a device pixel ratio of at
>   most 2 (`LOOP_MAX_DPR`): the phone's 4:3 crop asked for the 1440 at its
>   native 3 (5.2 MB for Roissy); it takes the 960, like its stills. A scene
>   reached before the loops' list arrives starts on a still's 8 s, and the
>   view gets the rest of its recording when the length is learned.
>   Views 01, 02, 04 and 06 play films in place of their recorded loops (below).
>   `src/vitrine/galleryLoops.js` is generated like `heroLoop.js`. The loop
>   assembly (`assembleLoop`) had repeated one frame in six (concat time base)
>   and one in three on orbits (half-frame phase); fixed, hero re-assembled.
> - **View 01 is a film** (2026-09-21). Its loop is replaced by the Roissy
>   scene cut from the app (29 s, `surplomb-roissy-v9b.mp4`), encoded by
>   `scripts/build-landing-film.mjs --src <film>` into
>   `.context/landing-assets/film/out` under the loop's own names — cropped to
>   the box's 1.65 (centred), a keyframe every 4 s, 480/960/1440 in AV1 + HEVC
>   (+ H.264 at 480), each at VMAF ≈ 90 or its cap: AV1 1.2 / 2.8 / 5.2 MB,
>   HEVC 1.2 / 3.8 / 7.6 MB — which `publish-landing-assets.mjs` reads FIRST,
>   so a republished gallery keeps the film. The enlargement under the pointer
>   that #317 and #318 gave the two films (`data-expand`, `expandGeometry`,
>   `swapForWider`) is gone with the tiles: the scene is already the full
>   width, and a Retina laptop plays the 1440 from the start.
> - **View 04 is the power-grid film** (2026-09-21). The
>   14.7 s `surplomb-grid-v4.mp4` (Europe dark, France lit alone, the nuclear
>   columns filling, the dive onto Cruas and its card, the switch-off) is
>   encoded by `build-landing-film.mjs --view 04 --start 3` into
>   `.context/landing-assets/film/view-04`. `--start` turns the file round: it
>   begins on the filled columns (source 3.0 s), runs to the black end, wraps
>   to the dark opening and stops one frame before 3.0 s, so the loop point is
>   continuous and the still — all a reader with reduced motion, data saver or
>   Low Power Mode sees — shows the grid lit, not an unlit Europe. A night
>   scene weighs far less than Roissy at the same VMAF ≈ 90: AV1 345 kB /
>   773 kB / 1.8 MB, HEVC 474 kB / 1.4 MB / 2.7 MB, H.264 480 545 kB. The
>   publish step reads every `film/*` directory holding a manifest before the
>   gallery's, and writes `galleryLoops.js` in key order.
> - **View 02 is the Lyon film** (2026-09-22). The 10 s
>   `surplomb-lyon-reveal.mp4` (a dive onto the Terreaux, the property sales,
>   a scan line that puts them out and paints the energy-rating parcels, a
>   climb to 693 m) is cut from the app on the photorealistic globe by a
>   harness outside the repository. The landing plays the cut WITHOUT the promo
>   video's two dataset captions (`lyon-reveal-landing-clean.mp4`): the stage's
>   heading sits exactly where the first one does, and the view's title already
>   names both registers. It is exactly 10.0 s (300 frames): at 9.97 s the
>   stage's ten-second floor (`STAGE_MIN_DWELL_S`) played it twice, which
>   `qa:landing` now asserts against. Encoded by `build-landing-film.mjs
>   --view 02 --start 4.5` into `.context/landing-assets/film/view-02`: the
>   still is mid-sweep, sales on one side and parcels on the other. AV1
>   485 kB / 1.2 MB / 2.2 MB, HEVC 695 kB / 2.2 MB / 4.6 MB, H.264 480 1.2 MB,
>   VMAF 91–93. « Ouvrir dans le globe » opens the film's last pose (`l=dp`,
>   693 m, heading 92°, −40°), in the parcel band, where 2,856 parcels are
>   painted. The encoder's work directory is keyed on its source
>   (`sourceTag`): keyed on the view, crop and start alone, it had handed the
>   caption-free cut the captioned cut's encodes. A republish needs every
>   film's staging: view 04's was rebuilt from the committed files and
>   `galleryLoops.js` on 2026-09-22 (same bytes, same names).
> - **View 06 is the digital-infrastructure film** (2026-09-23), in place of
>   the shared bikes and scooters of Paris, which the upstream God's Eye View
>   draws too. Tab « Numérique » (Lucide `radio-tower`), title « Antennes et
>   data centers ». The 24.87 s film (746 frames) is cut from the app on the
>   photorealistic globe by a harness outside the repository: Europe in the
>   dark, France lit antenna by antenna to 72,746 sites, the Alps' 4G dead
>   zones on the relief, Île-de-France's data centres and their 1,555 MW,
>   then the SFR mast on a La Défense roof (ANFR support 647445, 167 m), its
>   card, and its line of sight as a wave over the 3D towers, and a 0.8 s
>   climb back to the opening's dark Europe — the last frame is the first
>   (PSNR 69.5 dB), so the file loops without a seam. Staged, video only: the
>   row imposes Satellite in the app, the film is on Google 3D; the line of
>   sight is drawn over the 3D mesh, which the app does not do; the pings and
>   counters are overlays; no submarine cable is in frame (TeleGeography's
>   licence). The landing's cut moves the promo cut's two counters from the
>   bottom-left corner, where the stage's title covered them, to mid-left
>   (film x 285, y 360–470): measured, the stage's heading and pause cover
>   film y 47–192 and its title, place and door y ≥ 546 on a phone, y ≥ 652
>   on a 1280 × 720 desktop. Only those frames (36–135 and 360–438) were shot
>   again, on the code of the promo take; the other 567 are the promo take's
>   own. Encoded by `build-landing-film.mjs --view 06 --start 18.5`: the still
>   is the wave halfway across the towers, the mast's card open.
>   AV1 1.39 MB / 3.41 MB / 6.20 MB, HEVC 1.22 MB / 3.71 MB / 7.12 MB, H.264
>   480 1.45 MB, VMAF 91–92 — 88 for the 480 HEVC and H.264, held by their
>   1.5 MB cap: 25 s of pulsing antennas weigh more than Roissy's 29 s at
>   480. « Ouvrir dans le globe » opens the film's climb pose over
>   Paris towards La Défense (`l=d.an`, 11,190 m, heading 300°, −48°), where
>   the row holds Satellite and Dusk.
> - **The hand-off (≥ 1 001 px).** The press moves the address to `/globe` by
>   `replaceState` — no navigation, no reload, the same document throughout
>   (`rewriteAddress`, asserted by `qa:landing` case `handoff`) — freezes the
>   loop, `html[data-vitrine="opening"]` shows `#cesiumContainer` under it,
>   `init({ handoff })` poses the camera from the law at `video.currentTime`,
>   boots on `photoreal` (the press counts as the adoption), restores the hero
>   state through a share hash that is never written (`StyleManager`
>   `initialShare`, zero-length flight), and lifts the frame once the surface
>   has drained AND the traffic layer has seated its cars (9 s deadline).
>   `window.__godsEyeView.vitrineHandoff` records it.
> - **`?q=`** is read once by `src/vitrine/query.js` and removed from the
>   address; a non-empty query replaces the boot flight with the search box's
>   own `flyToAddress`; not found → toast, text left in `#location-search`,
>   ordinary arrival. Showcase arrivals get the first-run SESSION suppression.
> - **The live figures** (*En ce moment au-dessus de la France*, “Right now
>   above France”). One `GET /api/pulse` after `load`, at idle
>   (`src/vitrine/counters.js`); the group and each entry ship `hidden` and only
>   a positive integer no older than 10 min is revealed, and taken down again
>   when it passes 10 min on screen — any failure leaves everything hidden,
>   silently.
>   The server (`pulseProxy`, vite.config.js; rules in `src/data/pulse.js`)
>   counts from caches it already holds and fetches nothing: aircraft over
>   French LAND from the OpenSky snapshot — or, where OpenSky is off, from the
>   four French adsb.lol circles, only when all four are in hand (warm only
>   while a reader has the flights layer on), vessels within the 12-mile territorial sea from the
>   AISStream map (warm whenever the key is set and the feed is live — 97.8 %
>   of 10-min windows from 2026-09-12 to 09-19), buses only when EVERY
>   network of the GTFS-RT index was heard in the window (never so far: 0.5 %
>   of windows had even one network, two at a time), weather stations from the
>   SYNOP archive (daily, 11 to 35 h old: never fresh). One counting pass a
>   minute; `why` names the reason for each null.
>
> Acceptance: `npm run qa:landing -- --url <server>` (105 checks against a
> build, 2026-09-19; the byte budget case only asserts against one). Case
> `gallery` (26 checks, 2026-09-21) covers the scene: fit, what is fetched and
> played, hover, the clock by whole passes, pause, *Image fixe*, off screen,
> reduced motion, data saver, a failed download, and the phone. Case
> `adresses` covers the second URL, `handoff` the in-place swap, and `retour`
> the way back — open the globe for real, return to `/`, read the home page.

> **2026-09-17 — first-run card, three French variants** (`src/firstRunExperience.js`
> owns the door, `src/firstRunVariants.js` what a choice does,
> `src/firstRunHint.js` the bubble; `#first-run-launcher`, `#first-run-hint`
> and three `<template data-first-run-variant>` in `index.html`; styles at the
> tail of `style.css` and in `phone.css`). It replaces the 2026-08-23 mission
> launcher, which was upstream's card word for word: English, three tiles out of
> four leaving France (LIVE CONTACTS, SPACE MISSIONS, ENVIRONMENTAL, plus
> EXPLORE MANUALLY), a "Don't show this again" box, and a return on every fresh
> session.
>
> **Three variants, one door** (`FIRST_RUN_VARIANT_IDS = ['A', 'B', 'C']`). The
> aside is a shell — kicker `SURPLOMB · PREMIÈRE VISITE` (first visit), footer
> `Échap pour fermer` (Esc to close), a status line reading
> `59 couches de données publiques · 56 sans clé` (59 public data layers · 56
> without a key) — and the chosen template is cloned into it before the footer.
>
> - **A *Une adresse* (An address, the default).** *Qu’est-ce qui est vrai à
>   cette adresse ?* (What is true at this address?), one field, the chips
>   *Autour de moi* (Around me; revealed only when `canGeolocate()`), *Tour
>   Eiffel, Paris* and *Vieux-Port, Marseille*, and the link *Regarder autour
>   d’ici sans rien taper* (Look around here without typing). Enter calls
>   `styleManager.flyToAddress(query, { onArrival })`, and the card closes as the
>   flight STARTS. The bundle (`FIRST_RUN_ADDRESS_BUNDLE`: `dvf-sales`,
>   `ads-fr`, `dpe-fr`) is switched on exactly ONCE, at the first of
>   `arrived`, `cancelled` — the visitor chose the layers, not the landing
>   spot — or `FIRST_RUN_ARRIVAL_DEADLINE_MS` (10 s). Switching them on before
>   the flight would buy a scan of the place being left. Not found (or a failed
>   geocoder) keeps the card open, with a sticky status line and the field
>   selected. The locate chip goes through
>   `locateMe({ onArrival, notify: false })` and writes a refusal into that
>   status line rather than a toast behind the card. No autofocus on a phone:
>   the soft keyboard would cover the sheet.
> - **B *Trois questions* (Three questions).** *Par où commencer ?* (Where to
>   start?), four tiles, layers only,
>   no camera call: `sales` → `dvf-sales` + `cadastre-fr` (on a phone
>   `cadastre-fr` is skipped because it is badged LOURD (HEAVY), and the subcopy
>   becomes *Ventes DVF, 5 ans*, “DVF sales, 5 years”), `permits` → `ads-fr` + `sitadel-fr`, `live` →
>   `traffic` + `transit-fr` + `flights` (`traffic` is already on at boot;
>   asking again is idempotent), `explore` → nothing. A refused layer fails the
>   tile BY NAME and keeps the card open for a retry.
> - **C *Pas de carte* (No card).** No card: the bubble `#first-run-hint`,
>   *Première visite ? Tapez une adresse ici.* (First visit? Type an address
>   here.), anchored to the LOCATION label on a desktop and, on a phone, hung
>   UNDER the search bar at the top of the screen, caret up (since 2026-09-19;
>   it pointed at the sheet's *Recherche* (Search) tab before). Never a dialog,
>   no keydown handler — ESC and every hotkey go where they always went. It
>   closes on the first pointerdown elsewhere, after 12 s
>   (`FIRST_RUN_HINT_TIMEOUT_MS`), or when an exclusive surface takes the
>   screen; one already up means it never opens. A click inside opens the
>   search: `styleManager.openLocationSearch()` on a desktop,
>   `phoneSheet.openSearch()` on a phone (the search panel at full, the caret in
>   the bar). It is its own element because `phone.css` hides the whole sheet
>   while the launcher is visible, and the sheet is what the bubble points at.
>
> A and B drive eight distinct layers, all already in the shipped
> `set_layer_visibility` enum (unit pin). The card adds no voice tool, and the
> `GEV_REALTIME_TOOLS` sha256 pin still guards the schema.
>
> **Who picks the variant.** `initFirstRunExperience({ styleManager,
> dataManager, variant = 'A', onEvent = null, phoneSheet = null })`, and
> `src/main.js` passes `variant: 'A'`. `?welcome=a|b|c`
> (`forcedFirstRunVariant`, case-insensitive) outranks the caller and replays
> like `?welcome=1`. Assigning B and C to real visitors on the hosted instance
> is a separate change (assignment, beacon, privacy page, report); for where
> `onEvent` goes now, see “2026-09-17 — first-run A/B test” below.
>
> **The `onEvent` contract.** `{type: 'impression', shell}` (`desktop` or
> `phone`); `{type: 'action', kind, outcome, queryLength?, layerIds?}` with
> `kind` ∈ `address`, `geoloc`, `chip`, `tile:sales`, `tile:permits`,
> `tile:live`, `tile:explore`, `explore`, `hint-click` and `outcome` ∈
> `found`, `not-found`, `cancelled`; `{type: 'dismiss', via}` with `via` ∈
> `esc`, `choice`, `yield`, `timeout`, `click-away`. Never the typed text (its
> length only), never a latitude or a longitude. A listener that throws is
> logged and cannot take the card down.
>
> **Revealed once the boot flight has landed.** `src/main.js` still waits for
> the loading veil (`transitionend`, 900 ms fallback), then calls
> `whenBootFlightEnds(() => initFirstRunExperience(…))`: the veil lifts 2.5 to
> 3.5 s before the descent ends, and a card revealed then covered exactly what
> the boot had just paid for. A phone and a share link do not fly, so the call
> is immediate there; the wait is bounded by `BOOT_FLIGHT_DEADLINE_MS` (15 s).
> `?waitlist=1` still takes the card's place.
>
> **Three public seams on StyleManager** (`src/ui.js`), so the card searches
> through the dock's own code rather than a copy:
>
> - `flyToAddress(query, { onArrival })` → `{status, label?}`, `status` ∈
>   `flying`, `not-found`, `failed` (the geocoder threw), `refused` (the
>   navigation gate said no, e.g. Cockpit), `cancelled` (authority moved during
>   the lookup), `superseded` (a newer navigation owns the camera). It resolves
>   when the flight STARTS; the landing comes through
>   `onArrival('arrived' | 'cancelled')`.
> - `locateMe({ onArrival, notify })` → `flying`, `refused`, or `failed` with the
>   French `message`; `notify: false` leaves the toast to the caller.
> - `openLocationSearch()` expands LOCATION and puts the caret in the field.
>   Desktop only: on a phone the field is the bar at the top of the screen.
>
> The dock field and `#locate-me` go through the same seams with unchanged
> behaviour, and every free-text landing shares `_landOnSearchedLocation(label)`.
>
> **Show policy — once per browser.** Precedence, highest first: a share link
> never sees it → `?welcome=0` suppresses → `?welcome=1` or `?welcome=A|B|C`
> replays (past both suppressions, for demos and support) → the durable
> `localStorage['gev:first-run-mission:v1'] === 'suppressed'` → the per-session
> `sessionStorage['gev:first-run-mission-session:v1'] === 'dismissed'`. EVERY
> close — a choice, ESC, a yield, the bubble's click-away or timeout — writes
> BOTH keys: the durable one so the next visit starts on the globe, the session
> one so the tab still holds when a browser refuses `localStorage` (it is also
> the key the QA fleet seeds). The "Don't show this again" box is gone; nothing
> needs it. One impression per browser is also what makes the variants
> comparable. All three variants pass through the same door, so whatever
> suppresses one suppresses them all, C included. Both stores fail open, and a
> store is resolved lazily inside a `try` — never as a default parameter,
> because Safari's private-mode getter throws. Clearing storage brings the card
> back, which is accepted.
>
> **CHOICE → APP STATE, AND WHAT IT IS ALLOWED TO PERSIST** (do not "simplify"
> this). Layer enablement is durable in this app (`gev:layer-state:v2`, written
> by `LayerStateCoordinator._commitExplicit` only for origin
> `user`/`voice`/`tool`). A choice enables **its own** layers at
> `origin: 'user'` — durable, exactly as clicking those rows is, because making
> the choice *is* choosing them — and nothing else durable: no panel opens any
> more (the Context-panel reveal left with the global missions). The camera is
> touched by A only, through the search seams, and never persisted; B and C
> never move it. Off limits: detection mode/density,
> `gev:detection-allocation:v1`, 3D models, feather, and above all
> `_detectionUserOverridden` — setting that flag means "the operator
> hand-edited detection" and would silently disable the CRT/NVG/FLIR
> auto-preset contract for the session. No choice leaves France
> (`setContextMode`, `resetToGlobeView` and `flyToGlobe` are banned from the
> three modules). The full table is the comment block under that heading in
> `src/firstRunExperience.js`, pinned by `src/firstRunExperience.test.mjs`.
>
> **ESC arbitration — three rules, do not collapse them into one.** (1) The
> card **yields**: a MutationObserver watches `body` for the surfaces that take
> the screen (`cockpit-mode`, `scene-playback-mode`, `recording-mode`,
> `ui-clean-view` — `EXCLUSIVE_SURFACE_CLASSES`, kept in step with the CSS hide
> rule by a unit pin) and closes with `via: 'yield'`, leaving focus to the
> surface that took over; a yield is a close like any other and writes both
> keys. If one is already up at init, the card **waits** instead of appearing
> over it. (2) A surface can take the screen with **no class to watch** — the
> Cesium attribution lightbox is full-screen at `z-index: 200` against the
> card's `175` — so `isTopmost()` also **hit-tests the card's own centre** with
> `elementFromPoint`; any overlay, classed or not, disarms the handler. Every
> inconclusive answer counts as uncovered, so the guard can never be why ESC
> stops working. (3) A small control that claims only the **key** (a
> disclosure, a popover) is not something to yield to: whoever handles ESC
> first calls `preventDefault()` **and** `stopImmediatePropagation()`, and the
> card skips `defaultPrevented` events. `stopPropagation()` alone does **not**
> stop later listeners on the same `document` — that is how the compact Radio
> disclosure once made one key close the disclosure *and* the card. ESC also
> works mid-lookup (an exit, not a choice); Tab is confined to the card without
> claiming `aria-modal`; and A's field keeps every other key away from the
> app's bare-letter hotkeys. Variant C has none of this machinery: it holds no
> key, and a surface class simply closes it.
>
> **Accepted:** a surface class that never clears means no launcher for that page
> load, with no timeout. None of the four classes is restored at startup, so an
> already-blocked init is an error path, while a long recording or clean-view
> session is ordinary — a "reveal anyway" timer would trade a benign no-show for
> the card punching through a recording in progress. The no-show is benign: the
> handler is inert, neither key is written, the observer still reveals the card
> if the class clears, and a visit that never saw it still gets it next time.
>
> **What left with the upstream card.** The four mission tiles, the checkbox
> and its "blocked storage un-ticks the box" rule, the Context-panel reveal, the
> keyed/keyless ENVIRONMENTAL branch of `qa-firstrun`, the INFRASTRUCTURE-tile
> note (its memory measurements are in phase 3.1 of the performance plan, #131), and
> the `local_fire_department` glyph (the icon font is down to 27). What stays:
> the voice shorthands "infrastructure mode" and "environmental mode", one
> `NAMED VIEWS` instruction paragraph in `vite.config.js` that never depended
> on the card; the loading reducer's rule that a declared missing optional key
> is a configured terminal state (`src/loadingFeedback.js`), which still serves
> the FIRMS row; and the DISPLAY rail (`pp-toggles`) starting **collapsed** on a
> first run, a stored collapse state still winning.
>
> Gates: `node scripts/qa-firstrun.mjs --url <app>` — independent sections
> `show-policy`, `esc-arbitration`, `variant-A-address`, `variant-A-chip`,
> `variant-A-not-found`, `variant-A-look-around`, `variant-A-locate`,
> `variant-B-tiles`, `variant-B-phone`, `variant-C`, `variant-C-phone`,
> `viewports`, `console` (`--only a,b` runs a subset, `--shots` writes the
> taste-pass captures). The A sections need the keyless geocoder. Its
> `--teeth` negative control removes the card, the bubble and the templates
> before the app can use them, and requires EVERY card-dependent section to go
> red; it always exits non-zero, `1` meaning the control is healthy and `2`
> meaning it is not. `node scripts/qa-firstrun-mutations.mjs` reverts each pinned decision
> one at a time and requires `src/firstRunExperience.test.mjs` to go red. Unit
> pins: `src/firstRunExperience.test.mjs`, `src/firstRunVariants.test.mjs`,
> `src/firstRunHint.test.mjs`, `src/locationSearchSeams.test.mjs`.

> **2026-09-17 — first-run A/B test** (`src/firstRunAb.js` owns the switch, the
> draw and the report schema; `src/firstRunTelemetry.js` what is sent and when;
> `src/firstRunBoot.js` the wiring; `src/firstRunOptOut.js` and
> `src/firstRunOptOutPage.js` the refusal; `src/trialProbe.js` the shared
> `/api/trial` read; the `first-run-ab` plugin in `vite.config.js` the sink;
> `scripts/first-run-ab-report.mjs` the reading). The three variants of the
> block above are drawn for real visitors on the hosted instance, and nowhere
> else.
>
> **One switch, read per request.** `GEV_FIRST_RUN_AB=A,B,C` (case and spaces
> forgiven, unknown letters and repeats dropped; fewer than two distinct
> variants is no test), through `firstRunExperimentFromEnv`, the one reader
> shared by `/api/trial`, the report route, `/healthz` (`abtest`) and the
> privacy page. Absent: every visitor gets A, nothing is sent, the route answers
> 404, and a browser that drew a variant while the test ran deletes its draw on
> its next boot. Rollback is removing the variable.
>
> **The draw is client-side**, so that `/` stays a static, cacheable page and
> removing the variable removes everything. `assignFirstRunVariant`, in order:
> (1) `?welcome=a|b|c` forces that card and leaves the stored draw alone; it is
> measured only while the test runs, flagged `forced: true`, and the report
> leaves those out unless `--include-forced`. (2) No test, or a refusal: A,
> unmeasured, draw deleted. (2b) No ANSWER — `/api/trial` failed, was
> throttled or came late: unmeasured, and the stored draw is kept and still
> shown; reading "no answer" as "no test" would erase it and re-roll the
> visitor, mixing the groups. (3) A draw that cannot be stored: A, unmeasured — it
> would be re-rolled on every visit. (4) Otherwise the stored draw, or a new one
> in equal shares. `localStorage['gev:first-run-variant:v1']` holds
> `{variant, assignedAt, visitorId}`, the id being 16 random base-36
> characters. A draw older than 395 days (13 months, the CNIL ceiling for an
> audience-measurement identifier), dated more than five minutes ahead, or
> naming a variant the test no longer runs is replaced. A draw younger than
> 30 minutes marks the report `newVisitor`.
>
> **The refusal**, which the CNIL audience-measurement exemption requires, is
> either the button on `/confidentialite` that reads *Ne pas être mesuré* (Do
> not measure me) and stores
> `localStorage['gev:first-run-optout:v1'] = 'refused'` (the button flips it
> back), or the Global Privacy Control signal, which needs no click and hides
> the button. Either one means A, nothing sent and the draw deleted, from the
> next boot. The privacy page loads `src/firstRunOptOutPage.js` and nothing of
> the globe.
>
> **One `/api/trial` read per page.** `trialProbe.read()` starts at the top of
> `init()` in `src/main.js`; the mic crown (`loadVoicePremium({ probe })`, at
> idle) and the card share its promise, which never rejects (a failure reads as
> `null`). The card waits at most `FIRST_RUN_PROBE_BUDGET_MS` (1 500 ms,
> `probe.within()`) once the boot flight has landed; past that, unmeasured,
> with the stored card if there is one (case 2b above) — a slow probe never
> deletes a draw. The waitlist card keeps its own fresh read: it opens after the
> trial has moved. `describeTrial(req, config, experiments)` adds
> `experiments: { firstRun: { variants } } | null` to the response.
>
> **English says “hosted demo”, never “premium”.** The mic's help line
> (`src/voicePremium.i18n.js`) and the waitlist card (`src/waitlistCard.i18n.js`)
> name the limit of this server (“Hosted demo · 3 free spoken requests”,
> kicker “SURPLOMB · HOSTED”) rather than a paid tier, which nothing sells
> yet; the French keeps « premium ». The crown stays.
>
> **The wiring.** `src/main.js` no longer passes `variant: 'A'`; the reveal is
> `whenBootFlightEnds(() => { void startFirstRunExperience({ styleManager,
> dataManager, phoneSheet, probe: trialProbe }); })`. `startFirstRunExperience`
> (`src/firstRunBoot.js`) waits for the probe, draws, and hands
> `initFirstRunExperience` the variant and `onEvent: telemetry.record`. When no
> card opens, it arms a `returnVisit: true` report only for a returning visitor:
> test on, not forced, no share state, no `?welcome=0`, and the durable close
> key already written.
>
> **What a report is** (schema v1, `FIRST_RUN_REPORT_FIELDS`): `v`, `exp`
> (`first-run`), `variant`, `forced`, `visitorId`, `sessionId` (random per page,
> never stored), `seq`, `newVisitor`, `returnVisit`, `shell` (`phone` or
> `desktop`), `input` (`coarse` or `fine`), `viewport` (`xs` to `xl`, from the
> smaller side), `reducedMotion`, `bootMs` (rounded to 100 ms), `dwellMs`
> (seq 2 only) and at most 64 `events`, each with `t` in milliseconds since the
> impression: `impression`; `action` with `kind`, `outcome` and `qLen` (the
> typed length in the buckets `0`, `1-3`, `4-10`, `11-30`, `31+`); `dismiss`
> with `via`; `milestone` with `kind` ∈ `layer`, `search`, `waitlist`.
> **Never** the typed text, a position, a layer id, the IP, a header (user
> agent, referrer, cookie), the URL, the language or the time zone.
> `sanitizeFirstRunReport` REBUILDS every record field by field, copies no
> unknown key, and rejects the whole report on any value outside its list; an
> unforced variant must be one the test runs, and a report that is not a return
> visit must carry an impression.
>
> **Two beacons a visit, at most.** The edge in front of the origin counts
> `/api` calls per address (30 per 10 s measured on the Enerlens zone,
> `docs/DEPLOY.md`), so nothing is sent per event. Seq 1 goes at the first
> action or close, one tick later so that a found address carries both; seq 2
> at `visibilitychange → hidden` or `pagehide`, cumulative, with `dwellMs`. The
> report keeps the highest seq per session. A milestone counts only after the
> card has closed, once per kind, and a layer the card itself switched on (its
> `layerIds`) is not the visitor's: `layer` is a user-origin visibility request,
> `search` a non-empty submit of `#location-search-form` (capture phase, the
> text never read beyond its emptiness), `waitlist` the `WAITLIST_OPEN_EVENT`. A
> returning visitor sends one seq 2 with no event. Transport: `sendBeacon`, then
> `fetch` with `keepalive` and `credentials: 'omit'`; a lost beacon is lost, and
> the report prints the seq 2 coverage.
>
> **The sink.** `POST /api/first-run/events` (`firstRunAbPlugin`, dev server and
> `vite preview`): 404 without the variable (body drained, not read), 405 off
> POST, 429 past 12 a minute per address or 1 200 overall (in memory), body
> capped at 16 KiB, 400 without echo when invalid, 204 when stored. It reads no
> header; the address only feeds the limiter. Each record is appended as
> `{receivedAt, ...record}` to `.gev-cache/first-run-ab/events-YYYY-MM-DD.jsonl`
> (UTC day; `GEV_FIRST_RUN_AB_DIR` moves it), on the volume a redeploy keeps. A
> day stops taking lines at 5 MiB. Files older than 90 days are swept when the
> server starts and every hour after, whether or not the test is on — the
> privacy page's ninety days must hold after it is switched off too — and only
> names the route writes are ever considered.
>
> **The privacy page follows the switch.** `CONDITIONAL_SECTIONS` in
> `src/legalNotice.js` gains `abtest` and `noabtest`. With the test on,
> `/confidentialite` describes the draw, every field of a report, what is never
> sent, the 13-month and 90-day retentions, the legal basis and the refusal
> button; with it off, it keeps *pas de mesure d’audience* (no audience
> measurement).
>
> **The reading.** `node scripts/first-run-ab-report.mjs <dir>
> [--include-forced] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--alpha]
> [--delta] [--json]` folds the lines into sessions and prints totals per
> variant, never one session: activation with its Wilson 95 % interval, actions
> and closures, time to the first gesture, return after ≥ 24 h, dwell, seq 2
> coverage; then z-tests of B and of C against A (Bonferroni, α/2) and the
> sample still missing (356 per variant to see 10 points from 0.30 at α 0.05,
> 432 at α 0.025). **Activation** is a found `address`, `geoloc`, `chip` or tile
> other than `tile:explore`, or a `layer` or `search` milestone after the close.
> **Stop rule**: read ONCE, at ≥ 200 unforced impressions per variant or
> 21 days after the first, whichever comes first; adopt B or C only if it beats
> A on activation with p < 0.025 and is not worse on the closures the visitor
> did not choose (`esc`, `click-away`, `timeout`); one extension of three weeks
> at most. On the VPS: `ssh vps 'docker exec gev node
> scripts/first-run-ab-report.mjs /app/.gev-cache/first-run-ab'`. A product
> analytics tool (PostHog) is deferred, decided 2026-09-17
> (`docs/KNOWN-ISSUES.md`).
>
> Gates: `src/firstRunAb.test.mjs`, `src/firstRunAbRoutes.test.mjs`,
> `src/firstRunTelemetry.test.mjs`, `src/firstRunBoot.test.mjs`,
> `src/firstRunOptOut.test.mjs`, `src/trialProbe.test.mjs`,
> `scripts/first-run-ab-report.test.mjs`. In a browser (harness still being
> written), `node scripts/qa-first-run-ab.mjs --url <app>` against a server
> started with `GEV_FIRST_RUN_AB=A,B,C` checks the switch, the draw and its
> persistence, the reports written to the day file, the privacy page and the
> refusal; `--off`, against a server without the variable, checks that nothing
> is measured.

> **2026-08-08 — performance waves 1+2:** the app idles via an explicit render
> governor (`src/renderGovernor.js` — hold/release from every per-frame
> animator; discrete mutators call `governorRequestRender`). Any NEW
> per-frame visual animation MUST register a hold; any new discrete scene
> mutation MUST request a frame — `scripts/qa-perf.mjs` is the gate. The
> circular scope is an explicit canvas (`src/scopeMask.js`, DISPLAY-rail
> SCOPE toggle + FEATHER slider, hash keys `sc`/`scf`) — it is NOT the
> six zero-intensity style stages anymore (those are disabled; see the
> history note in `_initStages`). Hidden tabs stop the render loop.
> The scope's OUTSIDE terminus is **altitude-adaptive** (2026-08-17): 0.94
> at/above **10 Mm**, so
> faint stars survive in the corners of a TRUE full-globe view, fading quickly
> (smoothstep) to fully opaque by **7 Mm** — every working altitude below that
> is solid black, because there the same 6% bleed reads as smeared geometry.
> FEATHER is unaffected by the terminus ramp and there is NO new slider (its own
> default later moved 35 → 0 on 2026-08-22, 0 → 8 on 2026-08-23, and 8 → 11 at
> the 2026-08-24 final lock; see Current
> Global Post Defaults); hash key
> `sce` pins the terminus and is **clamped to 94..100 on BOTH parse and write**
> (out-of-range clamps into the band; absent or non-numeric = the adaptive
> default), so a shared link can neither freeze the ramp by accident nor carry
> an unsupported sub-94 terminus. Repaints are gated on a quantized 0.005 alpha
> step, so a full 20 Mm→ground descent costs 12 canvas repaints (the alpha span
> sets that, not the altitude span) and a parked camera costs zero. That
> quantization also means the PAINTED value plateaus at each end of the band:
> measured, the painted terminus stays 0.94 from the top of the band down to
> ~9.63 Mm (first step), and is solid black from ~7.37 Mm (last step) rather
> than exactly at the 10 Mm / 7 Mm clamp heights. SCOPE OFF costs less still:
> no height sampling and no canvas work after the single clear on the disable
> transition. The hard-crop (FEATHER 0) path honors the same terminus.

This is the current runtime/source-of-truth snapshot for the project.

> [!IMPORTANT]
> **Delta since the July-2 body below** (the detailed sections are still accurate
> for everything they describe; these landed after):
> - **"Never answered yet" is a THIRD state, distinct from empty (2026-08-23):**
>   `sourceState` in `src/data/militaryAwareness.js` treats a dependency that is
>   busy AND has never produced an answer (`loading === true && !lastUpdate`) as
>   unavailable, so the Contacts panel prints `?` and voice says "unknown". This
>   is deliberately NOT "busy": a source that has answered once keeps its real
>   count through every later refresh poll. It is a CONTRACT over the whole
>   dependency list rather than a fix for one layer, and the dependencies reach
>   it by different routes:
>   - **AIS vessels is its reachable producer.** `enable()`/`update()` both
>     resolve as soon as the first `/api/ais-live` poll answers, so the manager's
>     lifecycle settles to `enabled` — but until the server-side socket delivers
>     a position, `firstConnectPhase` stays `'loading'` and `getStats()` reports
>     `loading: true`, `lastUpdate: null`, count 0, and an UNDEFINED status.
>     Without the predicate that window prints an all-clear `0`.
>   - **Mapped installations never reaches that window.**
>     `militaryInstallations.enable()` is synchronous and the manager awaits
>     `update()`, which owns the first Overpass fetch, so the lifecycle stays
>     `enabling` for the whole fetch and the pre-existing `enabling` branch
>     covers it. Confirmed live on :4272 across a held 17 s first fetch (34
>     samples, `enabling` throughout, panel non-numeric) and across a failing
>     one. Its `status: 'idle'` is not what saves it — the lifecycle is; the
>     module has no `loading` status at all.
>
>   Any new dependency that can be slow must report `loading` and `lastUpdate`
>   honestly for the contract to hold, and must be pinned against the shape its
>   own module really returns — a fixture that invents a status the module cannot
>   emit guards nothing (that is exactly how a hole here survived a green suite).
> - **A held ground snap is dropped when measured ground contradicts it
>   (2026-08-23):** the WARM hold described below answers on DISTANCE travelled,
>   which is only a proxy for whether the value still describes the ground. A
>   contact can taxi ~200 m onto a different surface INSIDE the 250 m bound, and
>   since a miss preserves the hold, nothing would ever correct the burial. So
>   `heldSnapM` (`src/data/groundSnap.js`) also consults `cachedMeshFloor` at the
>   contact's CURRENT position: a measured floor more than
>   `HELD_SNAP_CONTRADICTION_M` (5 m) ABOVE the held value drops the hold and the
>   contact is COLD again, back to the floored 2D billboard. The rule is
>   ONE-SIDED on purpose — it targets BURIAL. A cell reading BELOW a real sample
>   is the floor chain's expected under-read (one-shot latch over ~111 m,
>   neighbours lean lowest, `displayFloorHeightM` only ever raises), not evidence
>   of anything, and a two-sided cut was disproved on the track rig by a planted
>   cell 66.7 m below a real sample at the same spot. Accepted residual, stated
>   with its condition: a DOWNHILL taxi floats, and the only correction on this
>   path is a SUCCESSFUL resample — nothing guarantees one. On the OSM fallback
>   `sampleHeight` misses forever, so the float persists for as long as the
>   contact stays inside the 250 m bound, with no timer beside it and no vertical
>   cap of its own beyond whatever the ground drops within that radius. It is
>   accepted because it errs UPWARD and stays visible. Three boundaries are
>   load-bearing — that one direction, MESH cells only
>   (`cachedGroundFloor`'s DEM fallback is a DIFFERENT surface; the skin/DEM
>   spread is what `MESH_FLOOR_BELOW/ABOVE_PRIOR_M` budget 15 m / 80 m for) and
>   the contact's OWN cell only (a neighbour ~111 m away may be a terminal roof —
>   `neighborFloorM` leans lowest for that reason — and must never be borrowed to
>   DISCARD a real measurement). Do not widen either without re-arguing both.
> - **The trail's acceptance bar is visual (2026-08-23):**
>   the trail terminates roughly BACK-CENTRE on the aircraft; MINOR hull overlap
>   is acceptable; there is no conspicuous top, bottom or lateral protrusion; it
>   is stable across headings; and a parked aircraft draws no moving head
>   segment. That is the bar a future change is judged against — NOT sub-metre
>   precision. The pins below are tighter than the bar on purpose, because a
>   measurable property is what a test can hold, but a pin's tolerance is not the
>   product requirement and tightening one is not an improvement to the picture.
>   Measured on live traffic at the shipped transform, the airliner anchor sits
>   24.09 m aft (70 % of the model's rendered envelope, so inside it), 2.22 m
>   below centre (6 %), and 2e-9 m off the centreline.
> - **The tracked trail attaches to REAL HULL, aft and below (2026-08-23):**
>   `MODEL_TRAIL_ANCHOR_NATIVE` (`src/data/modelVisualAnchor.js`) holds, per GLB
>   and in RAW glTF coordinates (see the transform-chain entry below), the point
>   of the hull's CENTRELINE PROFILE (its y = 0 slice) closest to the aft-belly
>   AABB corner. It is NOT the corner: a bounding-box corner is empty
>   space, 4.80 m off the nearest triangle on `airplane.glb` and 6.14 m on
>   `jet.glb`, so the trail ended in mid air beside the aircraft. The head segment
>   is drawn from a point behind the aircraft to this anchor, so the anchor must
>   stay aft (83–96 % of each aft extreme) or the segment enters at the tail and
>   stops inside the fuselage. `modelScale.test.mjs` reads the POSITION BUFFERS —
>   real vertices and triangles, because accessor min/max cannot tell a corner
>   from a surface — and re-derives on-hull, aft, lowest-at-its-station,
>   on-centreline, and the construction itself. Re-measure, never re-guess.
> - **The trail anchor rides CESIUM'S transform chain, not a hand-rolled one
>   (2026-08-23 regression fix):** `MODEL_TRAIL_ANCHOR_NATIVE` stores RAW
>   glTF coordinates and `modelAnchorWorld()` assembles
>   `modelMatrix × components.transform × axisCorrection` — the same chain
>   `ModelSceneGraph` renders with, built from Cesium's own exported
>   `Axis.Y_UP_TO_Z_UP` / `Axis.Z_UP_TO_X_UP` and the model instance's own root
>   transform. The anchors were previously PRE-CONVERTED by a single glTF
>   Y-up → Z-up step (`[x,y,z]` → `[x,−z,y]`) and multiplied straight by
>   `modelMatrix`; that is half the correction (the defaults also apply
>   `Z_UP_TO_X_UP`, the complete mapping being raw `[x,y,z]` → `[z,x,y]`), and an
>   aircraft's longitudinal axis is raw glTF X, so the aft offset landed on the
>   RENDERED model's LATERAL axis. `modelMatrix` carries the heading, so both
>   frames rotated together and the trail terminated a fuselage-length to one
>   SIDE, swapping sides with the course. Measured live in each aircraft's own
>   (aft, cross, up) frame: civil airliner (0.00, −81.47, −7.50) before,
>   (81.47, 0.00, −7.50) after; rotorcraft (0.00, −73.67, −16.33) →
>   (73.67, 0.00, −16.33). **Never pre-convert an anchor** — one transform,
>   Cesium's, or a second hand-maintained convention drifts again. The pin sweeps
>   headings 0/45/90/180/270/315 across every shipped asset plus a hovering
>   rotorcraft and asserts NO lateral component, and it derives its reference axes
>   from the ENU frame and the heading rather than through the function under
>   test: the first version routed them through `modelAnchorWorld` and passed
>   against the very bug it was written for, because a wrong transform rotates the
>   anchor and its reference frame together.
> - **A stationary contact draws no trail head, and the head end NEVER gives
>   (2026-08-23):** grounded tracking starts a trail unconditionally, and on a
>   contact that has not moved the last body point sits where the aircraft is — so
>   the head segment became a line from inside the model out to its own anchor,
>   through half the fuselage. `trailHeadStart()` decides where that segment
>   starts being drawn: nothing while the last body point is no further from the
>   model centre than the ANCHOR'S OWN STATION (every millimetre would be drawn
>   forward of the attachment point, into the fuselage — a parked contact sits at
>   exactly zero), the whole segment once it has cleared the model's rendered
>   ENVELOPE, and between them the drawn start slides along the segment so the
>   visible length grows CONTINUOUSLY from zero. Three earlier cuts are recorded
>   because their shape matters: testing segment LENGTH against the radius HID
>   real trail (58 m aft of `airplane.glb`'s 34.41 m envelope gives a 33.98 m
>   segment, suppressed, though ~23.6 m of it is open air); CLIPPING at the
>   envelope and keeping only what lay outside stopped a moving trail visibly
>   SHORT of the aircraft, since a bounding sphere encloses a lot of empty space
>   around a slender airframe; and a BOOLEAN containment test flashed 10.33 m of
>   trail on and off across 2 cm of travel at the boundary, and again on any fix
>   that fell back inside. The END is never cut — that end is the whole point.
>   `radiusM` carries `computedScale`, so the verdict is the same at every camera
>   distance, and any contact that has moved more than its own size (every
>   airborne one: 30 s of flight is kilometres) gets bit-identical geometry to the
>   containment rule this replaces.
> - **The AIR bracket alpha floor SCALES with the OUTSIDE slider (2026-08-23):**
>   `aircraftBracketAlphaFloor` (`src/data/detectionPolicy.js`) is piecewise
>   linear through 0 → 0, **the default → 0.35**, and 100 % → 1.0. The default
>   value reproduces the previously shipped flat 0.35 exactly at every keyhole
>   alpha, so the approved bracket look is unchanged; a flat floor made every
>   reachable stop below 35 % paint identically. `AIRCRAFT_BRACKET_FLOOR_ANCHOR`
>   mirrors `KEYHOLE_OUTSIDE_OPACITY_DEFAULT` (kept Cesium-free on purpose), the
>   two are pinned together, and **the anchor MOVES WITH THE DEFAULT** — both are
>   `0.01` since the 2026-08-24 final lock (`0.03` on 08-23, `0.05` before). That pin is the
>   tripwire for a default move: the mapping is pinned to bracket BRIGHTNESS,
>   not slider position. The `detection-opacity-slider` `step` is **1** so low values are
>   reachable — the mapping was always continuous from 0, but at the
>   previous step of 5 the entire sub-default range was one stop wide. Both the
>   markup and the ordering of 1–5 % are pinned in `detectionPolicy.test.mjs`.
> - **A grounded contact HOLDS its floor through a terrain outage (2026-08-21):**
>   when the Re:Earth proxy fails, the floor cells a grounded contact stands on
>   never warm, and the un-clamped render height for a contact reporting no
>   altitude at all is the GEOID — ~150 m below the ground at an inland field.
>   Both steps now hold instead. At POLL time `geoidSurfaceLastResortM()`
>   (`src/data/renderAltitude.js`) withholds the geoid guess from any contact
>   that already has a `renderAltitudeM`, so the sentinel path holds that height;
>   the guess is reserved for a genuine first sighting. At DISPLAY time
>   `_heldDisplayFloorM()` (`src/data/flights.js`) answers with the contact's own
>   last resolved floor — valid within `HELD_FLOOR_MAX_DRIFT_KM` (1 km, one
>   rollout's worth of travel) of the cell that supplied it — and otherwise with
>   a resolved ADJACENT cell via `neighborFloorM()`, which takes the LOWEST of
>   at least `NEIGHBOR_FLOOR_MIN_SAMPLES` (2) resolved neighbours and otherwise
>   refuses. An earlier cut leaned HIGH, reasoning from "never below the visible
>   surface"; that principle is about a contact's OWN measured ground and it
>   inverts for a BORROWED cell, as playtesting confirmed — planes
>   floating at terminal gates. The errors are not symmetric: too LOW is inert
>   (`displayFloorHeightM` only ever raises, so an under-reading floor simply
>   does not lift, bounded by one cell of grade), while too HIGH invents a
>   position bounded by BUILDING height and a parked contact holds it — measured
>   at 29.5 m of permanent float from a lone roof neighbour. A plane at a gate is
>   on the apron, never on the roof. The honest residual is the mirror image: on
>   a genuine slope the lowest neighbour under-reads, so the clamp lifts a little
>   less than it could, which shows up as no lift rather than a wrong one and is
>   corrected as soon as the contact's own cell warms. Both tiers are validated
>   measurements out of the shared floor cache; with neither available the
>   position passes through untouched, exactly as before. Adjacent-cell probes
>   are throttled per contact (500 ms) and rationed no further: a probe is eight
>   synchronous `Map` reads with no I/O — every DEM request is driven by
>   `warmGroundFloor` from the poll loop, bounded there — and 200 synchronised
>   all-cold contacts probing on the same tick measure 1.0 ms median / 1.2 ms worst on the all-cold workload (a noisier ad-hoc run of the same workload peaked at 2.1 ms), 1.4% of one 80 ms
>   fleet tick (`scripts/qa-floorhold-probe-cost.mjs`). A global per-tick budget
>   with a fairness queue was built over that and DELETED: it protected single-
>   digit milliseconds and produced two starvation defects. Nothing can starve
>   because there is no shared resource to be starved of.
>   A floor that moves DOWN under a contact standing on a BORROWED one is
>   APPROACHED exponentially (`FLOOR_EASE_TAU_MS`, 360 ms — ~20% of the
>   remaining gap per fleet tick, hard-capped at `FLOOR_EASE_MAX_STEP` so a
>   delayed or stalled tick cannot close more) from the value currently displayed, rather than
>   interpolated from a fixed anchor over a fixed duration. The target moves: a
>   second, lower neighbour can warm mid-approach, and re-evaluating a fixed
>   anchor against a moved target jumps by the eased fraction of the change
>   (measured at 100 m in one tick). Approaching from the displayed value has no
>   such seam. Rises are always taken whole, including mid-approach, since an
>   eased rise is time spent under the mesh; a change between two resolved floors
>   keeps its existing timing. The hold state is retired the moment a contact
>   stops being a grounded billboard (airborne or model-owned), but the floor
>   itself is PARKED as a rehydration seed rather than destroyed: deleting it
>   outright let an `on_ground` flap through a rotation cold-start the contact
>   under the runway (observed with VIR138M at JFK). **A seed is a memory, not
>   a reading**, and three bounds keep it honest. `HELD_FLOOR_MAX_DRIFT_KM`
>   refuses it more than a kilometre from where it was measured.
>   `FLOOR_SEED_GRACE_MS` (90 s, three polls) expires it on wall-clock age,
>   judged BOTH while the contact is away and AGAIN at the moment it re-grounds —
>   a contact that makes no calls in between (off the poll on a cruise, outside
>   the corridor radius, tab hidden) never reaches the first check, and an
>   earlier cut that only had that one reused a floor parked 198 s earlier. And
>   the seed ranks BELOW the neighbour tier: two freshly resolved adjacent cells
>   overrule it, which is what stops a contact re-grounding half a kilometre
>   away from floating on the field it left (measured before that rule: a 200 m
>   seed held over a 100 m/105 m neighbourhood, 100 m in the air). So a short hop
>   back onto the same apron inside the grace window and the drift bound DOES
>   reuse its floor — deliberately, and only while nothing fresh contradicts it.
>   What starts clean is a genuine departure. A model→billboard handoff retires
>   and rehydrates by exactly the same rules. What none of this fixes is the flap
>   tick ITSELF: the display clamp passes airborne positions through by design
>   (an airborne height is the fix-time clamp's job), and at a sea-level field
>   the airborne fix IS baro + geoid N, ~4 m under the runway. That is an
>   accepted one-tick transition residual, and
>   `scripts/qa-floorhold-staircase.mjs` §F1 counts every tick so it stays
>   visible: 1 of 23 ticks below the runway, all of it that airborne tick, 0 of
>   22 grounded ticks — against 12 of 22 grounded and not recovering before the
>   seed existed. **A third tier that read the rendered mesh
>   where no DEM existed to validate it was built and REMOVED** — measured
>   against a real GPU with the proxy down, it recorded a coarse-LOD 20.6 m for
>   ground that is really ~122 m; `tilesLoaded` goes true while coarse tiles are
>   what is loaded, so without a DEM prior there is nothing to tell a surface
>   from a mis-hit. Gates: `scripts/qa-floorhold-mutations.mjs` (22 named
>   defects, each reverted individually and required to go red) and
>   `scripts/qa-floor-hold.mjs` (live, real GPU — the proxy is failed mid-run and
>   the contact is measured against `scene.sampleHeight`). This floor-hold path
>   currently applies to `flights.js`; `militaryFlights.js` does not use it.
> - **Screen picks are validated before conversion (2026-08-21):** anything that
>   comes back from `scene.pickPosition()` must clear
>   `isPickedWorldPosition()` (`src/data/scenePick.js`) before it is converted
>   to a Cartographic. The guard is a magnitude BAND — 6,000,000 m to
>   1,000,000,000 m, plus finite components — not a null check, because a depth
>   read over empty sky can return a Cartesian that Cesium mishandles three
>   different ways: non-finite throws `DeveloperError: normalized result is not
>   a number`, exactly `(0,0,0)` returns undefined, and a near-center value such
>   as `(500,0,0)` converts SILENTLY into a point 6,378 km underground that
>   reverse-geocodes as 0°, 0°. The floor sits ~346 km below the smallest real
>   surface magnitude (WGS84 polar radius 6,356,752 m); the ceiling is ~24×
>   geostationary, so no real contact is rejected. **A degenerate pick is a
>   MISSED pick:** the cascade in `getViewTargetCartesian()` and
>   `pickWorldFromScreen()` falls through to `pickEllipsoid` and then the globe
>   ray, and callers receive the same `null` they already handle for a miss —
>   there is no new sentinel. Two consumers had no owner for a throw and were
>   hardened to match: the moveEnd view-target prewarm runs inside
>   `requestIdleCallback` (now catches and reports once per viewer at
>   `console.debug`), and `IntelHUD._updateSummary()` awaits its context INSIDE
>   a guard, because every caller invokes it as `void this._updateSummary(...)`
>   and a rejection there is ownerless. Gate:
>   `scripts/qa-view-target-prewarm.mjs`.
> - **Scene playback ownership + reconcile (2026-08-20):** five corrections to
>   `src/scenes/director.js`, with the pure decisions in `src/scenes/scenePolicy.js`.
>   (1) A shot reconciles ONLY the layers it declares. The old walk forced every
>   undeclared layer off, so a recipe authored against the original four layers
>   tore down CCTV, vessels and fires with no restore pass. Operator captures
>   snapshot the whole registry, so those still reconcile in full.
>   (2) Playback claims the camera through `runImmediateNavigation('scene', …)`
>   instead of a bare `camera.flyTo`, so it releases the follow camera, respects
>   the navigation policy and lets Cockpit refuse before anything mutates.
>   (3) **Playback NEVER re-establishes tracking.** `SCENE_TRACKING_PARAM_KEYS`
>   (`selectedFlightsTrackingId`, `selectedMilitaryTrackingId`,
>   `selectedSatTrackingId`) are stripped on the way to the layer — a shot
>   captured while following a contact would otherwise hand the camera straight
>   back to the follow loop it was just taken from, recreating the two-writer
>   jitter. The keys stay in the STORED capture; only the apply path drops them.
>   A unit pin sweeps every layer's `getParams()` for the whole selection naming
>   family (`SCENE_SELECTION_PARAM_PATTERN` — `selected…`/`tracked…`, `…TrackingId`,
>   `…Mmsi`/`…Norad`/`…Icao`), and each match must be on the strip list or on
>   `SCENE_KEPT_SELECTION_PARAM_KEYS`; a name like `trackedVesselMmsi` therefore
>   cannot slip through by not matching the older spelling. CCTV's
>   `selectedCameraId` is the one recorded keep: it raises a monitor plane and
>   never writes `viewer.trackedEntity` or the camera.
>   (4) An **isolating Context mode is exited before a shot's layers apply**.
>   Space Missions refuses every enable outside its replay bundle, so with it
>   left dirty all five recipes were refused (or, for Orbital Watch, composed
>   over a replay they never declared). The verdict is read off the shared guard
>   (`contextLayerEnableBlockReason`), not a mode name, so a future isolating
>   mode is covered — the probe id `SCENE_EXCLUSIVITY_PROBE_LAYER_ID` is
>   reserved by a test against the real layer registry. The exit itself is the
>   ordinary `setContextMode('off')` exact-restore path and is deliberately NOT
>   abortable: leaving the mode IS the restore to the operator's pre-mode state,
>   and tearing that transaction in half would strand Context. A refused
>   `setEnabled` is surfaced in the status line and a `shot_layers_refused`
>   telemetry event instead of being reported as success. **Mixed accepted /
>   refused layers are reported honestly, not rolled back** — a shot whose
>   enables partly failed leaves the layers that did move in place.
>   (5) **Cancellation cancels the work, not just the next step.** Checking a
>   flag after an `await` only stops what has not started, so both awaited
>   operations are now themselves cancellable. Layers: the run/LOAD owns an
>   `AbortController` whose signal is passed to every `setEnabled`, and STOP,
>   supersession, and run teardown abort it — the data manager rolls an aborted
>   enable back through the module's own `disable()`, so no layer is left on
>   carrying stale params. Visuals: `styleManager.applyVisualState(state, {
>   isCurrent })` gates BOTH halves of the map-stack switch, which is its only
>   suspension point. The switch is a *mutation*, not just a wait, and
>   `mapStackController` invalidates a switch only when another `setStack()`
>   arrives — a winning state that omits `mapStack` (every normalized shot does)
>   never issues one, so a stale switch would otherwise stand on the globe.
>   So: an already-superseded caller never starts the switch, and one superseded
>   *during* it puts the globe back to the stack the winner inherited — but only
>   while `getSwitchGeneration()` shows no newer switch has claimed it, because
>   a newer switch is a live intent that must not be stomped. The shader-uniform
>   commit after the await keeps its own gate. Precisely: a stale LOAD's
>   *synchronous* prelude (style/sharpen/HUD) can still have landed before it was
>   superseded, and is then overwritten by the newer state; what cannot survive
>   is its map stack, its uniform commit, its layers, or its camera flight.
>   Post-`await` flag checks remain as a backstop. Known remainder: run cleanup
>   still waits on a suspended
>   visual/map operation, because `setRecordingMode(false)` is not idempotent
>   (a second call restores HUD `auto` rather than the operator's saved mode) —
>   worst case is recording chrome staying up until the promise settles, which
>   then restores correctly.
> - **Scenes that do more than fly (2026-09-21):** a recipe keyframe may now
>   carry its own `layers` (merged over the recipe's, so a layer switches on
>   mid-scene), an `easing` (`inOut` default, `in`, `out`, `linear` — a
>   continuous move needs its joins to keep their speed), a `maxHeightM`
>   ceiling (Cesium arcs a 2.3 km hop between two poses 120 m above an apron
>   up to ~1.5 km), an `orbitDegPerSec` slow turn during the hold (around the
>   ground at the centre of the frame, bounded at 20°/s), and an `action`.
>   `track` follows a live aircraft picked where the shot looks — nearest to
>   `near` inside `radiusKm` and an altitude band, among the positions the
>   layer draws — through the layer's own follow camera, announced first by a
>   `shot_action_pending` event and taken after `leadInSec`; `cockpit` enters
>   Contacts, then the upstream Cockpit, for the shot's duration and leaves
>   both. This does NOT contradict (3): a captured tracking id is still
>   stripped; a `track` shot is an explicit instruction to follow, and the
>   next plain shot takes the camera back through the same
>   `runImmediateNavigation('scene', …)` claim, as does the end of the run.
>   `startScene(id, { targets })` names the aircraft outright for a caller
>   that already knows (a filming harness that waited for a departure). No
>   aircraft or a refused Cockpit is reported (`shot_action_failed`) and the
>   run plays on. The built-in **Roissy Departures and Noise Exposure Plan**
>   uses all of it: Terminal 1 turning slowly, a low move to the 09R
>   threshold, a take-off run 15 m above the runway (the mesh stays sharp
>   there) that accelerates and climbs, a jump over the runway end where OpenSky first
>   reports a departure, that departure followed for 2.5 s then ridden in
>   Cockpit, a climb to 15 km,
>   and the noise layer switched on only there — below 12 km it paints the one
>   zone under the reticle, above it every airport's whole plan. It is
>   written for an east flow; OpenSky publishes no fix while an aircraft rolls,
>   so a departure first appears airborne past the runway end.
> - **Ambient contact labels (2026-08-20):** detection callsign callouts paint
>   on the shared normal-blend world-overlay canvas as their own host lane
>   (`detection-callouts`) — NOT on the screen-blended sensor surface. `screen`
>   can only lighten, so a dark backing plate drawn there is a no-op over sunlit
>   ground and the text dissolves into the imagery. Brackets, the scanline wash
>   and the mode banner stay on the sensor surface; the callout lane registers
>   in the same `detection` slot, so callouts keep their z-position beneath every
>   ordinary overlay card and beneath the tracked readout. Plate fills come from
>   per-theme `calloutPlate` / `calloutPlateSpace` tokens (~63% / ~73% of the
>   tracked card's `CARD_PLATE_ALPHA`), resolved once per style change; space-tier
>   contacts take the heavier one. Rows are pooled, and an empty field must clear
>   the replay buffer or the final callsigns strand on the canvas. **Do not move
>   callouts back onto the sensor surface, and do not merge the plate tokens into
>   `labelBg`** — that token is the scanline wash and shifting it retunes the
>   sensor texture. Plates are additionally **backdrop-selective (2026-08-21)**:
>   `skyBackdropFactor()` (`src/data/iconOrientation.js`, exact scaled-space
>   ellipsoid silhouette) feathers the plate FILL ALPHA to `SKY_PLATE_SCALE`
>   (0.18×) for labels above the horizon — sky backdrops read as near-bare text,
>   terrain backdrops keep the full plate — across a smoothstep band of
>   `HORIZON_FEATHER_RAD` (~1.09°/side). Only the plate alpha feathers; text,
>   tier accents, leaders, brackets, and the tracked readout card are untouched.
>   **The test is TWO-REGIME, and only the first regime is a ray test
>   (2026-08-22).** Above the ellipsoid, `1` means the view ray genuinely misses
>   the planet and the function is the exact complement of the occluder. **At and
>   below the ellipsoid the horizon is EYE LEVEL** — the local geodetic
>   horizontal plane through the camera — and that is NOT a ray-miss test: from a
>   −18 m camera the ray to a contact 900 m up crosses the ellipsoid and still
>   reads sky, deliberately, because the ellipsoid it crosses is not a surface
>   anyone can see. It is reached by clamping the tangent cone's half-angle at
>   90°, the continuous limit of the same formula (the horizon dip goes to zero
>   at the surface), and is the convention Cesium's `EllipsoidalOccluder` already
>   uses there, so the two stay sign-consistent. This is not an edge case:
>   coastal airports sit at NEGATIVE ellipsoid height (JFK ramp ≈ −30 m, geoid
>   ≈ −34 m), so a ground-level cockpit is genuinely inside the ellipsoid and
>   **must not** be treated as degenerate — doing so put a full plate behind
>   every label on an empty sky. Fail-closed now covers only unanswerable input
>   (null, zero-length ray, non-finite camera, camera at the planet's centre).
>   Note the pairing: from such a camera the occluder culls every contact BELOW
>   eye level before detection sees it, so ground-backed labels only reappear
>   once the camera clears the ellipsoid. Rendered proof:
>   `scripts/qa-cockpit-plates.mjs`.
> - **Required attribution has two named keep-out rules (2026-08-20):** the
>   Google/Cesium credit line must stay visible in every state, and below 900px
>   two surfaces used to paint over it — the command dock's popover tray (any
>   width ≤900px) and the right context rail, which goes edge-to-edge below
>   720px and covered the credit with every dock panel closed. Both now yield;
>   the credit itself never moves, shrinks, or hides. **The clearance is not a
>   single constant:** `#command-dock` is anchored at `2vh` down to 721px and
>   re-anchors to a flat `8px` at 720px while `#cesium-credits` keeps its `2vh`
>   base, so anything reasoning "the 2vh terms cancel" is only true in the
>   721–900px band. `src/creditAttribution.test.mjs` is a **fail-closed** cascade
>   model: it flattens `style.css`, resolves each anchor by importance →
>   specificity → source order, evaluates a 14×11 viewport grid, and fails
>   loudly on any construct it cannot resolve (`!important`, `inset`/`margin`
>   shorthands, unvetted custom properties, unparsable or nested media queries,
>   or an unrecognized selector positioning one of these elements). Extend the
>   model rather than working around it — a silent skip here ships a ToS
>   violation.
> - **Dock tray stacking is decided by ID count (2026-08-20):** the pinned-tray
>   selectors `#command-dock.dock-has-two-pinned-trays …` carry one ID against
>   five classes, so any narrow-width override written with two IDs outranks
>   them and the upper tray silently loses `var(--dock-lower-pinned-height)`,
>   landing on its pinned sibling. The ≤900px and ≤720px overrides therefore
>   name the panel (`#location-bar` / `#control-panel`) to reach (2,5,0). Adding
>   a new tray rule means checking it against the pinned variants, not just
>   against the base rule.
> - **LOCATION mini-status is data-only today (2026-08-20):** the collapsed
>   readout now follows a free-text geocode search as well as preset pills
>   (`src/locationStatus.js` owns the copy for both), and every other camera
>   destination invalidates the searched label — `_stampNavigation` covers
>   voice/reset/takeover/selection, and scene playback calls the public
>   `clearSearchedLocation()` per shot. `#command-dock` still hides
>   `.location-mini-status` with `display: none !important`, so none of this is
>   on screen; a `display:none` subtree is also out of the accessibility tree,
>   so nothing is announced. Unhiding it is a separate product decision.
> - **The Street Traffic sync chip shows one percentage (2026-08-20):** the
>   settled confirmation flash carries the layer's coverage figure and NO
>   progress number. `reduceTrafficSyncFeedback` returns an empty
>   `progressText` once the sync lands and `#traffic-sync-progress:empty`
>   collapses the slot; the renderer writes the empty value rather than
>   guarding on truthiness, or the busy `...` strands beside the settled label.
> - **`#active-style-name` has exactly one writer (2026-08-20):** the style-name
>   mapping in `setStyle`. Location, search, and scene paths report where the
>   camera is through the LOCATION surfaces, never the style slot.
> - **Share-link selected-subject Follow (2026-08-20):** a copied v2 link adds
>   an ephemeral `at` epoch-seconds field; ordinary live hash updates omit it.
>   A shared Flights, Military Flights, or Satellites selection restores only
>   after the base destination camera, ordinary layer restoration, and a new
>   destination-scoped source refresh settle. The source module—not lifecycle
>   success or the UI—owns the final presence decision: Flights and Military
>   use the exact accepted snapshot, while Satellites waits for the applicable
>   dense catalog and treats a partial CelesTrak catalog as unable to prove
>   absence. A found subject starts the normal moving Follow at its current
>   position regardless of link age. An authoritatively missing subject is
>   `expired` only when copy age is strictly greater than 90 seconds for Flights,
>   45 seconds for Military, or 5 minutes for Satellites; equality, missing or
>   malformed time, and other non-found cases are unavailable. Feed/catalog
>   failure has its own feed-unavailable message. These warnings use the
>   universal top-center status banner and its standard failure dwell, beginning
>   only after the shared-view startup cover clears. If
>   teardown or disable invalidates an in-flight refresh, any selected-subject
>   restore waiting behind it settles as cancelled instead of remaining pending.
>   Terminal non-found cleanup compare-clears only the exact passive ID in memory and the live URL, never
>   recipient local storage. A newer explicit selection, visibility request,
>   destination, pointer gesture, wheel gesture, destroy, or source cancellation
>   wins and suppresses late Follow/status work without cancelling unrelated
>   shared layer visibility or options. Radio station selection remains outside
>   the share payload; Radio restores only its allowlisted filter and volume.
> - **AIS feed watchdog (2026-08-18):** feed liveness is judged by DATA, not
>   socket state — AISStream can complete the handshake and then deliver
>   nothing forever. `/api/ais-live` reports `live | stale | reconnecting |
>   down | auth-failed` (plus the unchanged `missing-key`/`unsupported`) with
>   `silentForMs`, `reconnectAttempt` and `nextAttemptAt`. Silence is REPORTED
>   at 120s and ACTED ON at 300s; recovery walks a 5s/15s/60s/300s ladder and
>   then stops at a terminal `down` with a slow 15-min retry running behind it
>   (a retry never flips the chip back to "connecting" — only real data clears
>   `down`). Liveness credit requires a frame that arrived on a still-owned
>   socket AND decoded into a real AIS record: handshakes, malformed frames and
>   error envelopes are never liveness, and orphan frames are dropped entirely.
>   Failures are CLASSIFIED — auth rejections (error envelope, HTTP 401/403)
>   are terminal with an hourly probe and an actionable chip, 429 honours
>   `Retry-After` and otherwise enters at the slowest rung, and only genuine
>   transport faults use the ladder; worst case is single-digit connection
>   attempts per hour in every class. Degraded states stay visible in the chip
>   even while cached vessels are still drawn.
>   **Locked invariants — do not "fix" these:** teardown is `ws.terminate()`,
>   never `close()` (the built-in WebSocket has no hard-abort and its `close()`
>   never completes against a black-holed peer, leaking the single per-key
>   connection); socket generations are monotonic for the module lifetime and
>   never reused across a dispose, and every socket-map mutation is
>   identity-checked (otherwise a pre-disposal close event orphans a
>   post-disposal socket and two connections race for the one slot); durations
>   use a monotonic clock, wall time only for display. Policy is a pure state
>   machine (`src/data/aisWatchdog.js`) returning actions; the socket lifecycle
>   is `src/data/aisStreamAdapter.js`, tested directly with mock sockets; the
>   transport assumption is pinned in `src/data/aisWatchdogTransport.test.mjs`.
> - **Honest live AIS health:** the vessel layer treats socket connection,
>   first message receipt, raw payload rows, and accepted vessel positions as
>   separate stages. Each enabled session owns one 30-second first-connect
>   grace: an open or connecting socket with no accepted position reads
>   `LOADING`, and polls do not restart that deadline. The first accepted
>   position ends the grace and establishes freshness; expiry, missing
>   credentials, rejected transport, or another definitive failure reads
>   `UNAVAILABLE`. Disable/re-enable starts a new isolated session. A socket
>   with no received message or no usable positions does not advance
>   `lastUpdate` or replace warm accepted vessels;
>   warm selection and trail state remain visible as stale/degraded. Late
>   responses from disabled, destroyed, or replaced layer requests cannot
>   mutate or finalize the current lifecycle. Layer stats expose transport
>   status, message time, and raw/accepted row counts for diagnosis.
> - **Vessel/fire camera transfer:** clicking an actionable AIS vessel sprite
>   or painted card selects that MMSI and requests one close oblique camera
>   transfer; re-clicking the selected vessel refocuses it. FIRMS detection
>   sprites and actionable detection cards do the same using a refetch-stable
>   identity that includes position, acquisition time, and source satellite.
>   Aggregate fire cells remain non-actionable. Painted actionable cards are
>   also mirrored into a named, focusable assistive-control list that exposes
>   selected state and announces focus only after the backing record accepts
>   activation. Global FIRMS cards reject far-side cells before
>   filling the bounded overlay cohort; the shared overlay still owns final
>   horizon culling. The UI validates world-focus
>   requests before releasing tracking, refuses Cockpit-owned moves before any
>   camera mutation, and releases follow owners before accepted flights.
>   Sibling-owned picks win without clearing the vessel/fire selection or
>   issuing a competing camera command. Deferred geocoding stamps intent but
>   retains the current owner until a valid destination resolves; immediately
>   before flight it rechecks shared navigation authority. Newer destinations,
>   voice `move_camera`, `fly_route`, overhead framing, strongest-fire focus,
>   vessel/aircraft/satellite tracking, reset, Cockpit entry, or teardown
>   make older work and its UI completion inert. Teardown removes immediate
>   camera-entry listeners before its first asynchronous restoration step and
>   refuses any new immediate or deferred navigation after disposal begins.
> - **Loading, reset, and Display completion:** every registered layer exposes
>   one normalized manager loading contract. Enable and disable feedback remains
>   lifecycle-authoritative, while manager-owned periodic updates publish
>   refreshing, failure, and recovery without replacing a producer's more
>   specific error or availability state. The shared presentation is delayed to
>   avoid flashes, visible outside the rails, and retained in
>   Cockpit. One continuous overlapping load interval retains the strongest
>   terminal outcome (`failed`, then `cancelled`, then `complete`) until every
>   participant settles, so a later success cannot mask an earlier failure.
>   A participating producer's terminal error, unavailable status, or
>   key-required state also outranks generic completion without requiring a
>   separate manager failure event; AIS first-connect expiry therefore ends as
>   `LOAD FAILED`, not `LOAD COMPLETE`.
>   Slow disable work is labeled as turning live data off rather than
>   as a completed load. Street Traffic's dedicated sync chip shows genuine
>   work and one bounded completion; steady TomTom coverage, including 0%, does
>   not keep it open. Mapped Installations reports its bounded camera-driven
>   requests to the same shared surface, but full-globe `zoom-in` guidance is
>   not presented as loading. Terminal completion, cancellation, and failure
>   labels are centered in that surface without an empty detail slot. The circular `RESET GLOBE` action sits beside the top-center share
>   control in map view; Cockpit hides the complete action group and provides a
>   cockpit-styled `RESET` beside `EXIT COCKPIT`. Both resets share one route
>   with the voice action, release continuous/POI/Cockpit/entity and
>   Space Mission camera ownership, and returns to the 18,000 km globe frame.
>   Reset preserves the selected Contact while invalidating delayed automatic
>   refocus work; the normal Context `FOCUS` action is the explicit route back
>   to that same flight or vessel after the globe view settles. Location
>   navigation uses the same selection-preserving camera
>   handoff once a city, landmark, coordinates, or search destination resolves;
>   failed searches leave the current camera owner untouched, and Context Focus
>   can return to the preserved Contact. Focus also restores the selected
>   aircraft's canonical follow frame after a manual zoom-away.
>   Visual presets retain the order Normal, CRT, NVG, FLIR, Anime, Night, Dusk.
>   Dusk — « Crépuscule », `dusk` in code and in links, key `7` — took Snow's
>   button on 2026-09-23 and Snow was retired (a `style=snow` link opens on
>   Normal). Dusk is Night's machinery at lower defaults (`src/styles/dusk.js`:
>   Darkness 0.14, Desaturation 0.08, Bloom 0.6, Vignette 0.25 — the ground
>   keeps 89 % of its light and 92 % of its colour), with Night's four sliders
>   and share tokens; `nightBasemap.js` multiplies the adjustment of both
>   stages, so a crossfade between them is smooth.
>   Night — « Nuit » on the French page, `noir` in code and in the stage names,
>   `style=night` in a share link (`style=noir` is still read) — is the NIGHT
>   ATLAS since 2026-09-21 (`src/styles/nightAtlas.js`; the one name that
>   changes with the language comes from `src/styles/styleNames.js`): the
>   basemap is dimmed and desaturated inside the scene (`nightBasemap.js` —
>   `ImageryLayer.brightness/saturation` on the active stack's own layers, a
>   `CustomShader` on the photorealistic tileset while it is the ground) and
>   the post pass only blooms bright pixels and vignettes, so every layer keeps
>   its colour, the key stays valid, and traffic keeps its hues. Sliders:
>   Darkness, Desaturation, Bloom, Vignette (share tokens `d`, `s`, `b`, `v`).
>   Configurable preset selection—including same-style reselection—opens the
>   shared Parameters surface directly below Detection and scrolls it into
>   view; share-link restoration
>   does not force that disclosure. Presets remain in the map Display. The
>   shared Parameters surface moves into Cockpit Display for the session and
>   returns on exit, with slider values contained by the panel at its supported widths;
>   the bottom Visual Presets tray owns the MAP SOURCE label, centered status,
>   and four-tile source row. Its compact wing is a keyboard disclosure:
>   Enter/Space opens and focuses Map Source, Escape closes and returns focus,
>   and unavailable sources remain tabbable with their reason exposed. Expanded left-panel
>   headers use the same container-owned background treatment without changing
>   their collapsed launchers; a soft 28% cyan divider identifies expanded
>   titles on both side rails.
>   Cockpit portals HUD, Detection, the single shared Parameters surface, and
>   3D controls, but not the visual-preset grid. Parameters follow the active
>   Cockpit vision treatment and remain directly below Detection. Changing the
>   top vision style does not close an open Display or Radio utility; explicitly
>   opening Display still collapses Live Signals. Its left-side
>   Data Layers and Contact interactions do not collapse an expanded
>   Display or Radio utility. Presentation-only adaptive collapse is reconsidered after HUD
>   and viewport changes, while explicit collapse remains the only persisted
>   user intent.
>   Display orders 3D immediately above Celestial and Clean UI immediately
>   below it. The top-center action group places Clear Layers to the left of
>   Share and Reset Globe to the right. Clear Layers turns off the currently
>   selected manager-owned data layers, including an active Context choice,
>   while retaining visual, HUD, map, and panel settings. A disabled layer may
>   still release camera work that it owns through its normal teardown.
>   Direct Data Layers entry into Space Missions excludes the new mission ON
>   intent from its pre-entry snapshot. Its OFF control therefore leaves Space
>   Missions off and restores Satellites to their exact pre-entry visibility
>   and parameter state.
>   **Cockpit identity (Belvédère, 2026-09-19):** the title bar and the boot
>   screen carry the home page's mark — the inline symbol (two ivory planes,
>   apricot sun) and “surplomb” in Manrope 800 — with *Aucun angle mort.* (No
>   blind spots.)
>   under the word. The old eye (`public/logo.svg`, `src/logoGaze.js`) is
>   removed. Chrome palette: night-green glass (`--glass-bg`), ivory type,
>   apricot accent (`--accent`), DM Sans for prose (`--font-sans`); JetBrains
>   Mono stays the DATA face (readouts, canvas cards), because the canvas
>   layout arithmetic is exact only in a monospace.
>   **The boot veil's sun** (`src/loaderSun.js`, started by `src/boot.js`
>   beside the cockpit import, never on the showcase): the veil is brand green;
>   the sun runs a 6 s arc over the terrace, the terrace's shadow falls on the
>   ground (a clipped `<use>`), and the pointer steers it. `#loading-screen
>   .hidden` lands it back in the mark in 600 ms, inside the veil's 800 ms fade,
>   then every frame and listener stops. Reduced motion, an off-screen veil or a
>   boot error (`stopLoaderSun()`) leave the mark still.
> - **Context, Cockpit, and Radio interaction contract:** explicit Contacts,
>   Space Missions, and successful Cockpit actions reveal the Context panel, while
>   restoration and replay preserve its prior collapsed state. Contacts uses the
>   dedicated right-side chooser; the underlying Global Context coordinator is
>   registered for lifecycle and restoration but is not duplicated in Data Layers.
>   Inside Cockpit, the focused summary card is titled Contact in both visible
>   copy and its accessible control labels.
>   The top-center Cockpit vision cycle shows the inherited map preset name
>   (for example, `NOIR`) followed by CRT, NVG, FLIR, and NOIR. That inherited entry
>   leaves the selected map preset unchanged inside Cockpit. NONE is not offered
>   in the cycle; CRT, NVG, FLIR, and NOIR temporarily override that preset, while returning to it or exiting
>   Cockpit restores the captured map style and its exact shader intensities.
>   Selecting a Cockpit vision treatment with configurable parameters opens
>   Cockpit Display and reveals those parameters through the existing right-side
>   accordion; an inherited parameterless Normal preset does not force it open.
>   Expanded Cockpit Display uses a container-integrated header and soft 28% cyan divider
>   matching the expanded left-side panel treatment; its collapsed launcher
>   keeps the standalone glass surface and muted divider. Cockpit Display and
>   Radio use right-rail chevrons: left to expand and right to collapse.
>   Cockpit side surfaces use one expanded body per side: Display or Radio
>   collapses Live Signals and vice versa. When both utilities close, Live
>   Signals reopens unless the user explicitly collapsed it. Expansion notifications
>   fire only on a real collapsed-to-expanded transition, preventing repeated close
>   synchronization from re-entering the disclosure coordinator. Data Layers collapses
>   Contact, while expanding Contact returns that panel to its visible
>   launchers. Live viewport-height changes remeasure both utility lanes and
>   keep their collapsed launchers inside the obstacle-free corridor above
>   Contact and Live Signals. An expanded Data Layers panel is solved against the
>   viewport rather than the Cockpit cards: the CONTACT card and the peripheral
>   Intel HUD corners stop shortening its corridor while it is open, so it
>   unfurls downward from its collapsed launcher position and renders over them
>   (`#left-panel-stack` is z-index 147, above the Intel HUD readouts at 146 and
>   the Cockpit HUD at 145), scrolling internally when the layer list is longer than
>   the corridor. Cesium's credit line is never passable and still bounds the
>   corridor. Layer toggles stay live from there, and collapsing returns the
>   plain launcher. The map-only Clear, Share, and Reset Globe actions are hidden
>   for the duration of Cockpit, both as a group and as individual controls.
>   It uses the `radar` symbol and provides roving keyboard tab navigation. Its action row
>   places the single Cockpit entry before Search Nearby Sites. Cockpit removes
>   the duplicate floating map entry and topline exit; the bottom-center
>   `EXIT COCKPIT` control (offset downward by a `-95px` bottom margin) plus `Escape`/`C` own exit, with entry/exit focus
>   transfer and failure-safe shortcut routing. The exit control sits at the
>   bottom-center compass position. A Cockpit-only control strip sits
>   directly above Live Signals, anchored 12px under the REC readout it shares
>   the right margin with and clamped to keep 8px above the briefing card,
>   never rising past `max(96px, 12vh)`; Cockpit owns that anchor and
>   republishes it every layout tick (the left accordion no longer donates its
>   corridor). Its minimal Display popover exposes Intel HUD,
>   Detection, Parameters, and 3D aircraft. During Cockpit, those existing
>   standard Display controls move into the Cockpit popover and retain their normal
>   nested interaction: HUD plus Tactical/Operator/Minimal layout, Detection plus
>   Density/Allocation/Fade/Outside tuning, and 3D plus Proximity/All mode. The
>   same nodes and state return to the map Display on exit, so Cockpit does not
>   maintain a second control state. **Detection is owned by the CONTACTS
>   session, not by Cockpit** (validated 2026-08-18): activating Contacts
>   forces detection on at the shared military preset (`MILITARY_DETECTION_PRESET`
>   — Dense @ 75%, the same frozen object the CRT/NVG/FLIR styles apply), and it
>   then stays on for the whole session — cockpit enter, cockpit exit and
>   third-person tracking are moves WITHIN Contacts and do not touch detection at
>   all. A manual DETECT change during the session holds for the rest of it.
>   Deactivating Contacts restores the pre-Contacts state, except that a map
>   style chosen during the session keeps its own auto-enable preset (that rule
>   is younger than the entry snapshot). The trigger lives on
>   `_syncContactsDetection()`, called from `_syncContextModeButtons()` and gated
>   on `!_contextModeChanging` so it fires at transaction settle, never at click
>   — a failed activation cannot strand detection on. Policy in
>   `src/contactsDetectionPolicy.js`. Detection continues to show surrounding
>   aircraft in Cockpit while omitting only the active first-person subject's bracket;
>   handoffs move that suppression to the new subject and exit restores the
>   selected aircraft's map-view bracket. Remaining Cockpit bracket strokes render
>   at 45% of their normal presentation opacity to reduce visor clutter; callouts,
>   density, allocation, fade, and Outside tuning are unchanged and normal bracket
>   opacity returns on exit. AIR presentation follows the same retained 3D mode:
>   Proximity uses 150/185 km and All uses 400/450 km. With 3D off, in-range
>   contacts remain rotating 2D silhouettes; with 3D on, ready admitted models
>   take over under the Cockpit cap of 60. Loading/capped contacts remain 2D,
>   out-of-range contacts use rotation-free dots, and exit restores map treatment.
>   Its Radio popover exposes compact power,
>   transport, station, and volume controls. Cockpit Previous/Next preserves
>   selection, autoplay, and broadcaster fallback audio without starting the
>   map-view station flights that compete with the first-person camera. These
>   are a Cockpit-only accordion:
>   each static header uses the left accordion's label and divider with a dedicated
>   directional-chevron disclosure button and no full-row hover treatment. Only one
>   utility body expands at a time. On desktop, its collapsed sibling remains
>   visible whenever both controls fit above Live Signals; a constrained
>   corridor gives the expanded utility the full height and temporarily hides
>   that sibling, restoring it as soon as room returns. Collapsed Display
>   matches the collapsed Data Layers launcher width. Expanded Display uses the
>   standard map Display panel's 272 px width, glass shell, header surface, and
>   internal spacing. Radio retains its independent compact and expanded widths.
>   Display no longer follows the Data Layers corridor: that corridor is solved
>   against left-lane obstacles and has nothing to say about the right margin,
>   which dropped the strip into Live Signals below roughly 830 px of browser
>   height. Cockpit owns the strip's anchor and republishes it on every layout
>   tick — including the settling pass after HUD transitions and asynchronous
>   map-provider swaps — hanging it 12 px under the REC readout, clamping it up
>   to keep 8 px above Live Signals, and never letting it rise past
>   `max(96 px, 12vh)`. The utility height is measured from that resolved top
>   and floors on a launcher height rather than a fixed minimum, so expansion is
>   bounded to the real corridor below the Cockpit topline and above Live
>   Signals, including when a tall panel takes over the corridor. A hidden
>   sibling is also removed from the accessibility tree, and focus transfers to
>   the expanded utility if a layout transition hides the focused launcher. The
>   shared map Display, Radio detail,
>   ordinary Global Context, and Scenes surfaces stay hidden in Cockpit. Data
>   Layers remains available. Its Cockpit-only stack paints
>   above the curved speed and altitude rulers, matching the existing Context,
>   Signals, Display, and Radio surface ordering without changing map-view
>   stacking. Narrow mobile Cockpit
>   viewports suppress the legacy layer stack, peripheral HUD, and secondary
>   Context/briefing panes so the flight instruments and primary controls remain
>   unobstructed. Outside Cockpit, Radio starts collapsed while off. When Context
>   is collapsed, its Radio header icon opens compact controls whose explicit
>   Enable/Disable action owns power; stable close and full-panel buttons own
>   compact dismissal and one-way detailed expansion independently. When Context
>   is already expanded, that same icon skips the floating compact card, expands
>   the embedded Radio section, scrolls it into view, and moves keyboard focus to
>   its disclosure control. The detailed panel's normal accordion control owns
>   its collapse. Compact/detailed state and playback continuity remain shared.
>   Radio volume in the full, compact, and Cockpit surfaces, plus Space Mission
>   replay speed, use Display / Sharpen's muted 3px rail, circular cyan thumb,
>   glow, and mono value treatment. Their larger transparent hit areas, keyboard
>   focus indication, ranges, disabled states, and mission speed scale remain
>   control-specific.
>   Outside Cockpit, panel collapse state is independent. Multiple expanded
>   panels in either desktop lane share the measured viewport-safe corridor.
>   If a later panel would receive less than half its intrinsic height, the
>   layout presents it as a collapsed, accessible launcher without overwriting
>   the user's saved preference; the panel most recently opened by the user
>   keeps the lane, so an older expanded sibling yields when necessary. In a
>   constrained Tactical lane, later competing panels collapse to their
>   launchers even when they would narrowly exceed that threshold. While the
>   left lane remains constrained, every collapsed sibling launcher is hidden
>   and the primary panel uses the complete safe corridor; the launchers return
>   when that panel closes or the stack fits again. An expanded
>   Tactical Display claims the right lane and hides every collapsed CCTV and
>   Context sibling, including a layout-collapsed Context; those launchers
>   return when Display releases the lane. Display itself remains the single
>   scroll surface when a visual preset adds Parameters: those rows do not form
>   a nested scroll surface. The bottom Visual Presets MAP SOURCE row keeps the
>   `3D` status and four source tiles inside its padded tray; the row wraps
>   from one row to two at 620 px, and live viewport changes keep the complete
>   tray inside the screen.
>   Adaptive remeasurement preserves the user's
>   scroll position across Tactical, Minimal, and HUD Off layouts.
>   During an active Scene run, Clear Selected Layers and Reset Globe remain
>   hidden until playback stops or completes because the Scene transport owns
>   layer and camera sequencing for that interval.
>   The Cockpit Contact summary exposes Previous and Next contact navigation
>   plus its collapse control; it does not offer a Focus action because the
>   first-person Cockpit camera remains owned by the tracked aircraft.
>   A voice Cockpit request that retargets to a filtered civilian or military
>   contact carries voice selection authority through navigation, so the
>   aircraft entered is also the durable target used by Copy Link and reload.
>   Missing context values render as `—` with an accessible “Unavailable” name.
>   Because the panel hosts its own Previous/Next controls, the ONLY condition
>   that hides it is the absence of a context snapshot. Contact identity never
>   gates visibility — hiding on a non-aircraft subject stranded the operator
>   the moment Next landed on a vessel or an installation.
> - **Contact readout: foreign subjects and CONTACT LOST.** When the selected
>   contact is not the tracked aircraft (a vessel, an installation, another
>   aircraft), the panel stays up and keeps its label, cohort counts, nearest
>   contact, distance and evaluated time live. Only the nose-relative direction
>   arrow and BRG readout are dashed: those two are measured in the tracked
>   aircraft's own frame while the rest of that row is measured from the
>   selected contact, and rendering both live presents one mixed-frame reading
>   as a single measurement.
>   A contact that leaves its feed holds the panel in a `CONTACT LOST` state
>   (`data-state="lost"`, the same panel-level cue mechanism as `uncertain`,
>   in the amber the app already spends on unknown/stale inputs): the last
>   rendered values stay on screen rather than being recomputed against a
>   position that stopped updating, and Previous/Next stay operable so the
>   operator can step off. It fires on two paths, and both retain the snapshot:
>   an eviction-origin selection clear (`reason: 'evicted'` — the aged-out
>   branches in `flights.js` / `militaryFlights.js`, AIS pin exhaustion, and a
>   viewport refresh that drops a selected record), and a refresh whose
>   presence check comes back absent. A DELIBERATE clear (click-away, Escape,
>   voice stop, layer disable) still clears the subject and takes the panel
>   down; an untagged clear defaults to deliberate.
> - **Presence contract (`hasContact`).** `flights`, `militaryFlights` and
>   `aisLiveVessels` each expose `hasContact(id)`: `true`/`false` in O(1) from
>   the layer's own keyed map, or `null` when the layer holds no data and
>   therefore cannot answer (disabled, or not yet loaded). Presence consumers
>   MUST use it and must never infer absence from `getAllPositions`, which
>   stops at its cap — the live flights layer routinely carries ~11k contacts
>   against a 1,000-row cap, so "not in the returned rows" is not "gone".
>   `null` leaves the previous verdict untouched, so a silent layer can never
>   fabricate a CONTACT LOST cue.
> - **Compact data-attribution panel:** the complete Cesium credit inventory
>   remains available without taking over the viewport. Its expanded desktop
>   panel is capped at 70dvh/36rem, the wrapped 12px credit list scrolls inside
>   it, and narrow screens retain Cesium's full-screen surface with an internal
>   scroller. The title, close control, links, and persistent Google/Cesium line
>   remain unchanged and visible.
> - **Distant-aircraft recession:** both civilian and military billboard fleets
>   retain their locked class/ground scale and `NearFarScalar`, then multiply a
>   limb-relative taper in the existing ~12 Hz tick. The taper is 1 below 0.5×
>   geometric limb distance and smoothsteps to 0.45 scale plus a 0.35 alpha-haze
>   factor at the limb. That treatment eases continuously back to identity from
>   3,500–4,500 km camera height, avoiding a globe-view threshold pop. These
>   values, the start ratio, blend band, composed floor, and write epsilon remain
>   runtime tunings. No aircraft is count-culled or made fully transparent.
>   Focus emphasis and limb haze multiply at one deadband-gated write site, and
>   their product is clamped to 0.20 before freshness alpha is applied. Ambient
>   fleet models receive that same composed alpha; class/ground/cockpit repaints
>   preserve the current limb scale instead of dropping it for a tick.
> - **Focus-aware contact de-emphasis:** civilian/military aircraft and
>   satellites publish the selected target's padded screen bounds and camera
>   distance from the same per-frame position cache already consumed by their
>   tracked entity. Ambient flight sprites, AIS chevrons, CCTV icons, and
>   satellite points then ease their own alpha where they compete with that
>   target; no draw-order assumption participates. The always-visible rule is
>   narrowly amended rather than removed: emphasis never falls below 0.25,
>   contacts never blink or disappear, entry/exit use 6 px hysteresis, and
>   writes use a 0.005 alpha deadband. Defaults are 18 px padding, 300 ms attack,
>   600 ms release, an 8%-of-target-distance range hysteresis band, and
>   `nearerBehavior: 'allow'`; `dim` and `partial` remain runtime/evidence
>   tunings. Ambient overlap includes each sprite's own rendered extent. The
>   gated AIS, CCTV, and satellite passes retain an active-emphasis count so a
>   settled dim contact always completes its release after tracking ends.
> - **Terrain-height resilience:** `/api/terrain/heights` caches canonical
>   5-decimal points individually, reconstructs reordered/overlapping batches
>   in exact request order, and refreshes only missing or stale points. Network,
>   429, and 5xx failures receive bounded jittered retries with `Retry-After`;
>   stale real heights remain usable per point, while an uncached absent height
>   still returns 502 rather than becoming a fabricated ground value. Client
>   geoid fallbacks wait 60 seconds before retrying and self-heal to Re:Earth on
>   the first later successful fetch.
> - **Provider Settings (POWER UP):** a dev-server-only surface that writes API
>   keys into this checkout's `.env` (or, under Pinokio, `pinokio/ENVIRONMENT`).
>   `GET /api/setup/status` returns presence and source class per registry
>   entry, never a value or a suffix; `POST /api/setup/keys` validates, upserts,
>   sets `process.env` live, and restarts the dev server so the client-exposed
>   defines re-inject. The registry — which keys exist, what they unlock, which
>   env vars they need — lives once in `src/keySetupCore.mjs` and is read by the
>   panel, the endpoints, `npm run doctor`, and `pinokio/_ENVIRONMENT`; tests
>   fail if any of them drifts from it.
>
>   The endpoints install via `configureServer` only and are excluded from the
>   preview-parity map, so they do not exist under `vite preview` — which is
>   what a deployment runs. The client removes both the chip and the dialog from
>   the DOM when the status fetch does not return a payload, so a built bundle
>   carries no credential surface at all rather than a refused one.
>
>   `admitKeySetupRequest` refuses, in order: any request carrying a
>   reverse-proxy or CDN header (`forwarded`, `x-forwarded-*`, `cf-connecting-ip`,
>   …), any launch with Pinokio sharing enabled, a non-loopback socket, a
>   non-local `Host`, a POST with no Origin or a cross Origin, and a POST that
>   is not `application/json`. A credential that reached the process from
>   outside this panel's store — an exported shell variable, the macOS Keychain,
>   another launcher — is reported `managed: 'external'`, rendered read-only,
>   and refused (409) for both replacement and removal; `dev-fresh.sh` passes a
>   names-only provenance marker (`GEV_KEY_SETUP_EXTERNAL_KEYS`) so that holds
>   even when the external value and the stored one are byte-identical. Writes
>   go to a fresh same-directory temp file created `0600`, hardened before any
>   secret is written, fsynced, then renamed over the target.
>
>   Framing: every document this dev server serves carries `X-Frame-Options:
>   DENY` and `frame-ancestors 'none'` EXCEPT `fiche.html`, which is meant to be
>   embedded. Re-navigating an embedded fiche to `/` does not defeat that — the
>   guard is evaluated per navigation, against the response of the document
>   actually being loaded.
>
> - **Overpass cache admission:** `/api/overpass` parses and sanitizes requests,
>   then checks fresh memory, identical in-flight work, and fresh disk entries
>   before invoking its local 90/min limiter. Cache and single-flight responses
>   therefore do not spend quota; upstream-bound misses retain the existing
>   limiter, mirror, stale, and sanitization behavior. One predicate,
>   `overpassPayloadIsData`, governs all three payload decisions — what may be
>   written to the cache, what may be READ back from memory or disk, and what
>   may be replaced by a stale entry — so a refusal can neither be admitted as
>   data nor block its own replacement. Every degraded path, including a caller
>   that JOINED an in-flight request whose outcome was a refusal, serves
>   last-good data through the same reader; a coalesced caller and the caller
>   that originated the request always receive the same answer.
> - **CCTV world-click focus:** clicking an in-world CCTV icon or ambient card
>   activates it and routes the camera flight through the panel FOCUS policy.
>   Aircraft/satellite tracking releases outside cockpit; cockpit retains the
>   view, keeps the CCTV activation, and surfaces the existing refusal toast.
>   Auto-hop and programmatic camera activation remain activation-only. CCTV
>   world clicks must stay within 6 px and 400 ms; drag-like or long gestures
>   are inert, and re-clicking the already active camera emits no focus request.
>   A clean empty-space click clears the active CCTV camera in place without
>   moving the view or disabling the layer. Sibling-layer picks and ADJUST-mode
>   interactions never trigger that clear. The resulting null selection remains
>   stable across rendering and updates; configured auto-hop is held until a
>   later explicit activation or AUTO HOP toggle-on.
> - **Tracked-flight close-range feel:** the existing 150 m camera floor is
>   unchanged, while the selected-only civilian and military model cap is now
>   200 px so minimum range reads as close. Pointer travel over 6 px suppresses
>   selection and empty-space untracking; duration over 400 ms suppresses only
>   untracking, so a stationary slow press on a plane still selects it. Escape
>   still releases tracking in place. The 200 px feel needs close-range field
>   verification; fleet model sizing remains unchanged.
> - **Deterministic sprite stacking:** contact collections reassert the stable
>   bottom-to-top order CCTV, FIRMS, Établissements scolaires, Enseignement supérieur, Bornes IRVE, Réseau gaz, Power Grid, Groupes de prod,
>   bikeshare, Véhicules partagés (FR), Transit FR, AIS,
>   military, then civilian
>   — Véhicules partagés (FR) occupies its slot with FOUR collections (every dot,
>   stations first and vehicles after them; the few vehicle pins; the group
>   bubbles and their operator bars; the group counts), registered in that
>   order, so a pin paints over the dots it stands among and a count over its
>   bubble without any of them escaping the layer's slot.
>   flights after every relevant layer init/enable and immediately after FIRMS
>   lazily registers its detection sprites. Always-visible contact
>   depth settings are unchanged. Cesium OIT weighted blending may soften strict
>   alpha layering on some GPUs, so the ordering remains a real-browser check.
> - **Deterministic card stacking:** CCTV, FIRMS, vessel, and tracked-target
>   cards use the shared world-overlay canvas. Detection paints through the
>   same host/frame contract onto one host-owned blend surface beneath that
>   canvas — parented into `#cesiumContainer` so its `screen` blend still
>   reaches the WebGL scene. The exact detection, ambient-label, ambient-track,
>   ambient-card, thumbnail, selected, and tracked lane sequence is binding;
>   the detection callback runs first and z-index preserves its shipped z5
>   position below the z6 cards.
> - **Cross-layer vessel ownership:** clicking a sibling-layer contact leaves
>   the active vessel card, HUD, context, and trail unchanged while the sibling
>   handles the pick, preventing two camera commands from one click. Starting entity tracking still clears vessel
>   inspection; AIS itself never sets `viewer.trackedEntity`. Own unkeyed or
>   evicted vessel-record picks and `gev-trail:*` remain no-ops. CCTV choices
>   made from the panel dropdown do not currently emit a cross-layer event and
>   therefore do not clear vessel inspection.
> - **World-overlay host and Phase 2–6 source migrations:**
>   `src/overlays/worldOverlay.js` owns one shared DPR-aware text/card canvas,
>   one detection blend surface, and one world-overlay post-render
>   scheduler. Both surfaces share the same sizing, clear, projection,
>   and teardown paths. The host includes bounded per-source/per-collision-domain
>   arbitration, horizon/viewport culling, shared keyhole fading, cached UI
>   exclusions, cockpit source gating, pooled hit
>   rectangles, and development diagnostics. **Stacked-copy cards
>   (`card`/`selected`/`tracked`) are bounded at `WORLD_OVERLAY_STYLE.cardMaxWidth`
>   = 420 CSS px**, tightened further by a narrow viewport, and wrap their title
>   and detail lines under it — breaking mid-word only for a word longer than a
>   whole line. The wrap is a rescue path: a card whose every line already fits
>   is measured exactly as before and allocates nothing, which matters because a
>   moving source republishes its copy every frame. Before it, width was "the
>   longest line" with no ceiling, so one card could span the viewport AND — its
>   clamped centre having left the keyhole — be painted at the 0.01
>   outside-opacity floor. **UI exclusion is a per-rectangle
>   PLACEMENT PREFERENCE over currently visible chrome — it clips no canvas and
>   vetoes no entry.** Rectangles are never coalesced into bounding unions
>   (that requirement existed only for even-odd canvas holes, and the host
>   punches none). Exclusion strength is decided per element by its EFFECTIVE
>   stacking level (the outermost positioned ancestor carrying a z-index, i.e.
>   the stacking context that competes with `#world-overlay-root`): chrome ABOVE
>   the host — map panels z90-1000, the dock, the cockpit windows inside
>   `#cockpit-hud` z145 — is a soft preference, so an entry with no
>   collision-free placement keeps its full placement set and simply renders
>   beneath that chrome. Chrome at or BELOW the host keeps an absolute veto:
>   `#intel-hud` is z2, under both host surfaces (detection z5, cards z6), so a
>   kept placement there would paint over HUD text. Placement runs two passes —
>   prefer variants clear of all chrome, else variants clear of the below-host
>   chrome, else drop the entry. Cockpit line art (rims, arcs, rails, toplines, readouts) is not
>   in the inventory at all: the AR-HUD model puts world-space content beneath
>   the cockpit's screen-space HUD by z-order. Its empty-host path performs no
>   post-setup layout reads or canvas work under resize/mutation noise; removed
>   entry records are pruned, and text measurement uses a host-lifetime,
>   1,024-entry LRU. Steady-state rendering reuses arbiter output, placement,
>   paint-item, and paint-rectangle storage; track display text is rebuilt only
>   when its title or detail changes. DOM mutations only flag exclusions dirty,
>   with selector/layout scans deferred until there is overlay paint work, and
>   host teardown severs pooled record/entry references before releasing every
>   pool. A custom paint-lane contract gives source-owned batched painters the
>   same DPR-sized context, per-frame view-projection matrix, ellipsoid
>   occluder, keyhole geometry, and cached UI rectangles without transferring
>   their selection policy into the host. Datacenters and Dams now publish card
>   entries into that host on their
>   existing 450 ms screen-grid cadence. Each source retains two deterministic
>   contenders per grid cell and publishes at most 160 entries. The legacy
>   700/900 winner ceilings are no longer the effective shipped caps; active
>   `ambient-card` source budgets sum to a bounded 1,150-card shared lane: two
>   96-card infrastructure budgets, FIRMS' shipped 18-card cohort, AIS's
>   existing configured 900-row absolute ceiling, and CCTV's shipped 40-card
>   ambient maximum. Runtime AIS demand still
>   derives from its shipped 118 px grid: 112 candidates at the 1600×900
>   allocation viewport and 170 at full HD; its existing 150 px greedy
>   separation usually admits fewer. The host owns final cross-source declutter
>   without letting source count grow beyond the pre-migration source bounds.
>   Cards use the infrastructure name plus available operator/capacity for
>   datacenters or river for dams. Their native Cesium points, stems, polygons,
>   selection/picking, terrain sampling, and enable/disable lifecycle remain in
>   `localGeojson.js`; it creates no native label graphics.
>   The bundled public-release snapshots omit contact-oriented fields and note
>   values containing email or phone identifiers. Runtime cards and entity
>   context do not depend on those fields; geometry, identity, name,
>   operator/capacity/river metadata, and ODbL attribution remain intact.
>   Stem position and
>   polyline properties are constant between initialization, camera `moveEnd`,
>   and successful near-surface ground samples rather than per-frame callbacks
>   or every 450 ms visibility pass. Unchanged or sub-0.5 m tips do not call
>   `setValue`, and each record alternates between two preallocated two-position
>   stem arrays so real tip changes notify Cesium without steady-state allocation.
>   Shared placement records retain the raw anchor plus one signed integer
>   leader offset; painters apply that offset without materializing four pairs
>   of computed doubles per entry. The arbiter's spread distances and compact
>   placement-availability masks live in pooled numeric buffers. Because solve
>   occupancy only grows, few-placement identities whose complete set is
>   blocked are dismissed once instead of being returned and re-spread; the
>   authoritative collision lookup remains the final semantic check. Protected
>   entries that cannot separate completely choose the placement with the least
>   total protected-rectangle overlap rather than stacking on the first option.
>   Cards use the host's shared keyhole fade and global detection fade/opacity
>   controls with no source-local edge constants; cached keyhole geometry is
>   invalidated by live tuning as well as canvas size, so Fade changes reach the
>   next frame. Outside opacity defaults to the shipped floor (5 % when this
>   landed; 1 % since the 2026-08-24 final lock, 3 % on 08-23). The
>   `KEYHOLE_OUTSIDE_OPACITY_DEFAULT` change from 0 to 0.05 also affects
>   detection: callouts and brackets previously hard-culled outside the keyhole
>   now paint at the OUTSIDE default (1% since the 2026-08-24 final lock;
>   aircraft brackets hold the 0.35 readable floor) and consume ambient budget
>   viewport-wide under the same
>   fade-don't-cull principle; this remains pending visual review. Cards
>   also reproduce the former
>   `scaleByDistance` curve (1.0× at 250 km to 0.62× at 9,000 km).
>   Mapped Military Installations create no empty native labels; selected names
>   remain in the tracked readout. Submarine-cable labels moved into the shared
>   host on 2026-08-18 (Option 2, superseding the Phase-5 Option-1 native
>   exception): the same nearest-160 bounded cohort now publishes
>   `ambient-label` entries on a dirty sweep with exactly two dirty
>   conditions — camera `moveEnd` / layer enable / load completion, plus a
>   motion fallback that samples the camera at most once per 2 s and only
>   re-arms past 250 m of travel since the last swept position, so tracked
>   and orbit cameras (which never emit `moveEnd`) cannot starve the sweep
>   while a parked camera still costs zero. The former 500 ms timer path was
>   removed in the same-day perf round — timer-driven stem re-sizes rebuilt
>   the 2,629-instance batched stem primitive mid-motion. The 2,629 reference
>   stems are staticized constants (no per-frame `CallbackProperty`), and an
>   unchanged cohort is never republished so a parked camera stays
>   governor-idle at the source level.
>   The 2026-08-18
>   host fix extends that to the HOST level: chrome mutation observation is
>   scoped (body childList filtered to inventory-chrome add/remove;
>   per-occluder attribute observation element-only, no subtree) and the
>   right-rail allocator writes `--right-panel-allocated-height` only on real
>   change, so parked idle with ANY live overlay source measures 0 postRender
>   fires / 5 s — empty-scene control parity (pre-fix ~56-61; dams
>   cross-checked at 0). Genuine chrome changes (occluder add/remove,
>   own-attribute flips, resizes) still invalidate;
>   `qa-cables-overlay.mjs` gates idle at ≤6 / 5 s.
> - **Phase 6 detection consolidation:** `src/data/detection.js` retains its own
>   `LabelArbiter` instance and existing 125 ms solve cadence, density/altitude
>   budgets, layer quotas, Elastic/Weighted allocation, manual scalar matrix
>   projection, tier palette, batched bracket paths, callout painter,
>   acquire/keyhole fades, sparse focus ring, banner, scanlines, suspension, and
>   diagnostic object. It no longer creates or sizes a canvas, clears pixels,
>   builds a camera matrix or UI inventory, observes layout, or attaches a
>   render listener. The host creates and lifecycle-manages
>   `#world-overlay-detection-surface`, DPR-sizes it through the same frame path
>   as `#world-overlay-canvas`, and invokes detection against its
>   plain source-over context. Detection writes the exact shipped theme
>   `mixBlendMode` and `filter + drop-shadow(...)` strings to that provided
>   element, preserving scene-level CRT/NVG/FLIR glow and once-per-layer
>   filtering. The surface is host-owned but **parented into `#cesiumContainer`
>   at `z-index:5`**, not into `#world-overlay-root`: the root is a stacking
>   context (`z-index:6`), i.e. an isolated blending group, and a surface inside
>   it has its `mix-blend-mode: screen` silently discarded by the browser
>   instead of compositing against the WebGL scene. z-index (5 under the root's
>   6) keeps it beneath ambient-through-tracked host paint.
>   The >22 ms odd-frame relief valve is restored: the host does not clear the
>   detection surface on a held frame, while unrelated shared lanes repaint,
>   and `throttleSkipCount` remains a live diagnostic. Detection `data-*` fields
>   now live on `#world-overlay-canvas`, while the StyleManager diagnostic API
>   remains unchanged. Disable and suspension deactivate only the detection
>   lane, leaving unrelated host entries intact; teardown unregisters the lane
>   before the host is destroyed. The production-shaped allocation gate covers
>   5,000 visible Dense observations at 2,500 km under the unchanged 154
>   B/observation/frame ceiling. The host owns one world-overlay `postRender`
>   listener; the repository has five `postRender` listeners total (host,
>   celestial ring, annotations SVG, missions frame tick, and traffic).
> - **World-label accounting:** All intended label/card migrations use the
>   shared host. The former native `LabelGraphics` exception for cable reference
>   labels was retired on 2026-08-18; cable text may render over tile geometry,
>   so **zero native world-label creation sites remain**. The mission replay DOM vehicle, awareness
>   compass, annotation SVG callouts, and host-owned detection isolation target
>   are explicit exceptions; the awareness ring and cockpit contact pips are
>   non-text out-of-scope surfaces. Annotation callout text, geometry, leaders,
>   and behavior retain their tested presentation; a future annotation style
>   system is outside this phase. `src/overlays/worldOverlayTokens.js` is the single home for
>   shared world-overlay, CCTV-thumbnail, and detection-theme presentation
>   constants. Former source renderers own no canvas, DPR, or world-overlay
>   listener path; the duplicate detection rounded-rectangle helper and dead
>   tactical compatibility helpers are gone. No temporary dual-renderer flag
>   existed to remove. `activeCameraCardEnabled` remains a product
>   presentation control, and `_detectionUserOverridden` remains the documented
>   style-switch persistence state. Browser/GPU performance comparison remains
>   operator-side; the final accounting records only comparable population
>   reductions and deterministic Node allocation/solve measurements. Those
>   allocation gates are calibrated on Node.js 24.14.x; `package.json` permits
>   supported product runtimes on Node 24 or 26, while the allocation runner
>   separately enforces Node 24 for these two calibrated probes. Each probe
>   compiles synchronously and discards explicit-GC
>   transition chunks before applying the unchanged byte ceilings. The unit
>   runner executes ordinary test files with Node's default parallelism, then
>   runs only the two explicit-GC allocation microbenchmark files sequentially
>   and one at a time with `--expose-gc`, so unrelated tests cannot perturb their
>   calibrated budgets and each isolated test process has the same GC contract
>   as its measurement worker.
>   A worker spawn, exit, output, or availability failure is a failing gate, not
>   a passing skip.
> - **Phase 5 earthquake labels:** Earthquake disc ellipses and pickable
>   entities remain Cesium-native, but their magnitude text is now an
>   `ambient-label` source in the shared world-overlay host. The source formats
>   `M#.#` text and depth-band accent colors, publishes only the 96 largest
>   current events with stable id tie-breaking, and declares a 48-winner
>   ambient-label budget. Host keyhole fading, horizon culling, UI exclusion,
>   and final collision apply. Disable/destroy clear and hide the source; real
>   earthquake entities carry no native label graphic.
> - **Phase 5 bikeshare selection:** The selected station keeps its native cyan
>   point highlight, while its station name, availability counts, capacity, and
>   operational warnings now publish as one protected selected-lane host card.
>   The card reads the point's authoritative Cartesian directly, declares zero
>   ambient quota, and therefore cannot be evicted by ambient budgets. Shared
>   keyhole fading, horizon culling, UI exclusion, and selected-card paint
>   order apply. Clear, disable, and destroy remove the host entry; the selected
>   Cesium entity carries no label graphic.
> - **Phase 5 ISS and tracked-satellite labels:** The ISS path and large red
>   point remain native, while persistent `ISS` text is a one-entry moving
>   ambient-label host source. Its getter reads the already-propagated point
>   cache, preserving the 1 Hz fleet epoch and eliminating the former second ISS
>   propagation. Satellite tracking continues to publish exactly one protected
>   tracked-lane card through `gevLabelModel` and `_trackedDisplayCached`; the
>   tracked entity is point-only. Tracking ISS suppresses the ambient entry and
>   untracking restores it, preventing duplicate ISS text. Disable, orbit-text
>   preference changes, catalog rebuild, and destroy clear/hide the source.
> - **Phase 5 active CCTV projection label:** The active camera's monitor plane
>   remains native Cesium geometry, while its camera-name label is one protected
>   selected-lane host entry. The entry closes over the same cached
>   `positions.label` Cartesian updated whenever the plane geometry moves, so
>   label and plane retain a single placement authority. Only the active,
>   projection-visible camera publishes; hide, disable, runtime destruction,
>   and state clear remove the source. Monitor-plane entities carry no native
>   label graphic.
> - **Phase 5 tracked civil aircraft label:** A tracked flight's Cesium entity
>   is a billboard-only camera target with no native label. The flight source
>   retains callsign/registration fallback, flight-level/altitude, speed, stale
>   state, airline/type, and plausible-route formatting in `gevLabelModel`; the
>   one protected tracked-lane host card renders that complete model. Its
>   position getter reads only `_trackedDisplayCached`, the same authoritative
>   Cartesian already consumed by the tracked visual and camera, and never
>   advances dead reckoning from the host frame.
> - **Aircraft label convention (both flight layers, 2026-08-18):** every civil
>   and military label surface resolves **callsign → registration → icao24**
>   (`_contactLabel()` in `flights.js`; the same chain inline in
>   `militaryFlights.js`) — tracked readout, detection card, `getNearby`,
>   `getDetectableObjects`, `getAllPositions().label`, `getTrackedSubject`, the
>   analyst record, the Context subject/nearest list, the Cockpit signal list,
>   and the `track_entity` voice narration. Registration is aircraft IDENTITY,
>   not route, so unlike origin/destination it is **not** routePlausible-gated.
>   Identity stays `icao24` on every keyed surface (`getNearby().icao24`, the
>   detection `sourceId` declutter hashes, and the `id` that `trackById` and the
>   Context cohorts resolve) — only the displayed string follows the chain.
>   Because enrichment can answer *after* selection, the Context subject
>   re-resolves its label each refresh (`resolveSubjectLabel()`) instead of
>   freezing the selection-time snapshot.
> - **Phase 5 tracked military aircraft label:** The military tracking entity
>   is likewise billboard-only and label-free. Its source-owned model retains
>   callsign/registration fallback, stale cue, aircraft type, registration,
>   operator, altitude, and speed, rendered as the sole protected tracked-lane
>   card with the amber military accent. Its getter reads only the military
>   `_trackedDisplayCached` publisher, keeping the host, visual, and camera on
>   one dead-reckoned frame sample.
> - **Phase 5b Space Mission labels:** Launch markers publish through a bounded
>   48-candidate / 24-winner ambient-label source. Selecting a mission clears
>   that overview and publishes its launch-site, stage re-entry, payload
>   position, and orbit annotations as protected selected-lane entries; every
>   source-formatted line and accent remains intact. Static entries reuse the
>   mission geometry Cartesians, the payload getter reads its per-frame live
>   cache, and catalog-backed orbit text reads the cache updated with the ring
>   matrix. Refresh, deselect, disable, and destroy replace or clear the real
>   sources. Mission Cesium entities carry no label graphics, and the shared
>   host replaces the former quadratic label overlap pass.
> - **Phase 5 cable depth-testing decision (2026-08-02, REVISED 2026-08-18 →
>   Option 2):** the 2026-08-02 ruling kept submarine-cable reference labels
>   native (`disableDepthTestDistance: 0`) as the sole approved world-label
>   exception so photorealistic tiles could occlude label text. On 2026-08-18
>   that exception was retired after performance measurement: the native
>   path evaluated 5,258 `CallbackProperty` channels per frame across 2,629
>   reference entities and re-batched a 160-label `LabelCollection` per sweep,
>   costing the layer ~9.5 ms/frame during camera motion (≈42 → ≈59 fps
>   measured headless at a mid-Atlantic orbit). Cable text is now a bounded
>   nearest-160 `ambient-label` host cohort (`telegeographySubmarineCables.js`
>   publishes on the dirty sweep — `moveEnd`/enable plus the 2 s/250 m motion
>   fallback for tracked and orbit cameras — skipping identical
>   cohorts); stems/points stay Cesium-native, depth-tested, and pickable, so
>   only TEXT lost tile occlusion — the same trade every other host label
>   already shipped: labels may render on top of tiles. The dedicated
>   `submarine-cables` allocation row gates
>   the new source at 17,015 B/frame median (106.3 B/candidate, Node 24)
>   under a 19,000 budget, and the all-live aggregate row was recalibrated
>   with the cable cohort folded in (164,711 B/frame median, 190.6
>   B/candidate, 182,000 budget); the intermediate phase rows keep their
>   historical pre-cable composition. `load()` carries a load-generation
>   ownership token (the militaryAwareness activationId pattern): a stale
>   aborted load bails after every await and never clears a successor's
>   lifecycle, so rapid toggle/destroy sequences cannot double-add data
>   sources.
>   The 639-candidate Phase-5b row (353 painted, 133,769 B/frame, 209.3
>   B/candidate) remains as an intermediate historical gate; as of the
>   2026-08-18 recalibration the all-live aggregate — every shared-host
>   source including Radio and the migrated cable cohort — is 864 candidates
>   / 398 painted at 164,711 B/frame (190.6 B/candidate) under a 182,000
>   budget. The image-inclusive ceiling remains attributable to CCTV, while
>   the isolated mission row measures 108.2 B/candidate/frame under the
>   shared 154 ceiling.
>   FIRMS severity/source formatting, its pre-existing 150 px greedy selector,
>   selected-fire semantics, and LOD distance limits stay in `firmsHeatmap.js`;
>   `firmsLabels.js` is formatting-only. FIRMS entries use the host's tactical
>   card painter, vertical above/below placement, severity top rule, shared UI
>   exclusion/clip, horizon culling, distance-alpha channel, and always-on
>   `edgeFade: 'keyhole'` policy. Selected fires are protected in the selected
>   lane and bypass both the 18-card ambient cohort and distance fade while
>   excluding ambient cards from their footprint. Disable and destroy clear
>   the source rather than leaving a stale host entry. This is not a
>   pixel-for-pixel port: global collision/UI avoidance can choose fewer cards,
>   host horizon culling is explicit, and ordinary map mode now retains the
>   shared Outside floor instead of bypassing edge fade through the former
>   cockpit/celestial gate.
> - **Vessel card ownership:** `aisLiveVessels.js` retains the 800 ms visibility
>   pass, 118 px one-winner grid, priority ranking, 150 px greedy separation,
>   type/detail formatting, and the AIS positions produced by its unchanged sea
>   datum path. It publishes ambient tactical cards and one protected selected
>   card into the host. `vesselLabels.js` is formatting/policy-only: no vessel
>   canvas, projection, paint loop, or post-render listener remains. Ambient
>   vessels share `ambient-card`; the selected entry paints in the selected lane,
>   bypasses the ambient cohort/distance fade, and its protected rectangle
>   excludes sibling ambient cards. Tracked readout still excludes AIS, avoiding
>   a duplicate card for the same selection. Disable and destroy clear the host
>   source. This is not a pixel-for-pixel port: shared cross-source collision,
>   UI exclusion, and horizon culling can admit fewer cards than the isolated
>   canvas, and the shared always-on keyhole policy now applies the shipped
>   Outside floor in ordinary map mode instead of using the interim active-mask
>   gate.
> - **Tracked-readout ownership:** `trackedReadout.js` is now a presentation-model
>   bridge only; it owns no canvas, projection, post-render listener, layout,
>   keyhole fade, or paint path. Civilian flights, military flights, satellites,
>   and mapped installations write explicit `gevLabelModel` objects and expose
>   `gevDisplayPosition` getters backed by their layer-owned frame/display cache.
>   Selected AIS vessels continue using the vessel source's protected selected
>   card, so they do not create a duplicate tracked readout. The host registers
>   the active readout in the protected tracked lane with a zero ambient quota;
>   protected semantics bypass that quota and reserve the painted footprint
>   against ambient cards. Moving sources never fall back to a fresh
>   `entity.position.getValue()` in post-render. Annotation fade queries the
>   host's actual `getOverlayPaintRect('tracked', trackedId)` after layout and
>   unions it with the tracked billboard extent. Untrack, context clear, and UI
>   destroy clear/hide the source. This is not a pixel-for-pixel port: placement
>   is host-rounded, cross-source/UI exclusion and horizon culling now apply,
>   accents are source-stable rather than detection-theme-derived, and the old
>   screen-coordinate deadband was removed in favor of the authoritative layer
>   frame cache.
>   Civilian and military poll reconciliation refreshes this model after fresh
>   kinematics and again when a missed poll enters the `STALE` grace period.
>   Satellite pre-render propagation refreshes its altitude line from the same
>   per-frame SGP4 sample used by the tracked dot and camera.
> - **CCTV thumbnail ownership:** `cctv.js` retains the 20/28/40 zoom selection,
>   40-card shipped maximum, 112 px source declutter, eviction grace, frame
>   fetching/cadence/retry, stable slot cache, last-success persistence, hover
>   pinning, and activation. `cctvCards.js` is now source policy plus pure
>   lifecycle helpers only; it owns no canvas, post-render subscription,
>   Cesium projection, layout solve, paint pass, or hit store. The shared host
>   paints its exact 96×54 thumbnail inside the 104×77 shipped chrome, applies
>   the same 1.0→0.45→0.35 altitude scale and 7,500→9,500 m fade, shared
>   keyhole fade, full UI exclusions, and tracked/protected footprint
>   exclusion. Ambient entries paint nothing before their first successful
>   frame; a user-pinned entry retains the documented immediate empty-chrome
>   exception, and later failures never clear the last successful frame. The
>   active camera is excluded from the 40-card ambient quota and has no host
>   card by default: its monitor plane is the active representation. The
>   product option `cctvLayer.setCardPresentationOptions({
>   activeCameraCardEnabled: true })` may publish it through the retained
>   protected path. CCTV leaders use the source cyan, remain vertical at the
>   camera anchor except for the off-card edge clamp, and counter-scale to one
>   CSS pixel through the altitude transform. Card hits come from
>   `hitTestWorldOverlay` after a
>   scene pick miss with no canonical scene-object ID. CCTV billboard ownership
>   is proven by the owning collection/object rather than a bare upstream ID,
>   so an independent sibling with a colliding ID still wins. As a completed,
>   narrowly extended ownership hardening step, property-bearing Entity picks
>   must also be the exact stored CCTV coverage/projection object; copying the
>   `cctvCameraId` property cannot impersonate a camera. Card hits pass through the
>   6 px / 400 ms gesture guard
>   before activation and the existing click-to-fly event. CCTV cards are not
>   sprite-focus-dimmed. Disable/destroy clear and hide the host source, stop
>   pacing, detach in-flight image handlers, and empty source caches.
> - **Cockpit left-panel chrome:** opening any left-stack panel fades the
>   overlapping left pitch-rail glyphs out. The separately right-anchored pitch
>   rail remains visible, and panel/context-card stacking is unchanged.
> - **Cockpit context stacking:** the context card renders above visor glass,
>   pitch/heading instruments, altitude/speed tapes, and the signal window.
>   Topline vision and exit controls retain the highest in-cockpit layer.
> - **Space Missions dependency shutdown:** disabling a mission dependency or
>   leaving the mode closes mission context and restores the exact pre-entry
>   Satellite enabled state and presentation parameters. Restored parameters
>   never re-show primitives while the Satellite layer is disabled.
> - **Flights 3D/cockpit hardening:** the destination-direction cue is an
>   inline SVG rather than a remotely loaded Material Icons ligature, so a
>   blocked or late font can no longer expand the literal word `navigation`
>   across the cockpit. The grounded `airplane.glb` belly offset is calibrated
>   to the current asset's measured Y-up bounds (`0.063` native units).
>   Contact Previous/Next and Live Signals aircraft handoffs now
>   re-seed the first-person camera anchor at the selected flight immediately;
>   bounded feed-correction smoothing remains scoped to the same aircraft.
>   When NEXT has no flight inside the normal 250 km Context window, it searches
>   both civilian and military feeds at successively doubled radii through
>   16,000 km and transfers the cockpit to the closest available aircraft.
>   Tracked cameras now share one ENU frame across Cesium and the close-range
>   guard: switches relocate to the new aircraft, zoom stops 150 m short of
>   crossing the target, and the icon/model, label, trail head, and camera are
>   prepared from the same frame. The guard frames once and then leaves
>   Cesium's EntityView as the sole continuous camera writer. The tracked
>   entity remains a pure position/billboard target with no unused aircraft
>   orientation input; 3D→2D handoffs seed the current screen-projected course,
>   course projection uses the camera's right/up basis so it remains valid
>   through the >180° rear half of a tracked orbit, and the host readout consumes
>   that same settled frame cache without a second dead-reckon. Selected
>   3D models are seeded at the tracked position before scene insertion and
>   update before scene preparation from one frame-cached sample, retain real-world scale at
>   ordinary ranges, cap at 200 px
>   when very close for a continuous 2D→3D handoff, and use a 40 px selected
>   model floor near the long-range 3D→2D cutoff so the glTF silhouette remains
>   comparable to the selected billboard; ambient model sizing is unchanged.
> - **Minimal HUD right rail:** constrained focus layout keeps the collapsed
>   CCTV and Context launchers visible and accessible while the expanded
>   Display panel scrolls inside an explicit remaining-height budget. The rail
>   reserves both launcher heights and inter-panel gaps without a self-reversing
>   layout measurement. Tactical HUD instead gives the expanded Display, CCTV,
>   or Context panel exclusive use of the rail and hides its collapsed siblings
>   until the active panel is collapsed.
> - **Context-flow hardening:** the cockpit left accordion stays below the HUD
>   inside its measured safe top/bottom lane. Global Context focus guards exist
>   only for the synchronous selection window, history survives same-layer
>   reselection, and NEXT availability uses the same UNKNOWN-cohort gate as the
>   navigation action. Contacts entry does not wait for unrelated serialized
>   layer teardown; Space Missions waits for every incompatible live/current
>   layer to settle off before replay data starts. A rejected teardown keeps
>   that layer authoritatively enabled, restores any siblings already stopped,
>   and aborts replay entry; the isolation
>   guard remains active until Rocket Launches finishes enabling. Manually enabling
>   another Data Layer is additive in both an active mode and the neutral shell:
>   it does not exit Context, and the added layer joins the pre-entry snapshot
>   when the session is eventually restored. Manually disabling a required mode
>   dependency still exits and restores that union.
>   While Space Missions is active, direct incompatible enables are refused
>   before initialization or polling and explain that the mode must be exited.
>   User entry alone owns the pre-entry snapshot; programmatic dependencies do
>   not replace it, and rapid re-entry snapshots the pending settled restore
>   target rather than partial manager state.
>   Contacts-mode entry chooses the nearest aircraft to the current camera from
>   one uncapped civilian-plus-military pool (military wins an exact distance
>   tie), then falls back to the nearest AIS vessel. An initially empty set gets
>   one retry on the next Awareness refresh tick rather than permanently losing
>   automatic acquisition. Clearing a manually selected subject cancels that
>   pending retry so an intentional deselection cannot acquire another contact.
>   NEXT keeps a cycle-scoped visited set separate from PREVIOUS history. Once
>   every current target is visited, it starts a deterministic new walk with the
>   current subject retained as visited instead of re-admitting all candidates
>   into a nearest-contact ping-pong. Expanded flight searches use the same reset
>   rule. Vessel focus uses a 3 km bounding sphere at entry and during cycling.
>   The user-facing mode is **CONTACTS**: it cycles the nearest contact of
>   whichever supported type is selected (civilian or military plane, AIS vessel,
>   or mapped installation). Satellites are explicitly outside the Awareness
>   navigation cohorts and retain their independent tracking UX. The cockpit
>   briefing opt-in is labeled `CYCLE OFF` / `CYCLE ON`, with state-specific help
>   that distinguishes page cycling from continuously refreshed live data. The
>   neutral standby summarizes both chooser modes, while the `CONTACTS` and cycle
>   controls keep their short visible state as the accessible name and expose
>   longer help only as a title.
> - **CCTV focus and teardown:** explicit camera choices still activate during
>   cockpit mode, but they retain aircraft tracking, suppress the view flight,
>   and ask the user to exit cockpit. Layer enable is activation-only when a
>   tracked entity or cockpit owns the view, with no flight or cockpit-exit toast.
>   Voice select/next/previous/nearest actions report when tracking or cockpit
>   refuses their requested flight without hiding the successful selection.
>   Camera deactivation and layer disable both clear temporary probe clamps;
>   disable re-arms the active record, re-enable restores nominal geometry without
>   probing, and the next real activation re-runs the obstruction probe. Disable
>   uses a direct hide sweep; obstruction hits retain the field-derived 12 m floor.
>   Geometry-drain progress notifications are coalesced to roughly 300 ms or ten
>   batches, whichever arrives first. Natural completion publishes its final
>   state; disable publishes the terminal state explicitly when it cancels a drain.
>   Coverage polylines are lazy: catalog init creates none, while enable in the
>   default COVERAGE ON mode materializes the active camera and visible neighbor
>   cohort (70 entities at the 14-camera cap). Activation always materializes the
>   selected frustum, including COVERAGE OFF when projection remains on.
>   Empty-space deselection removes the active projection and active-relative
>   coverage emphasis but preserves the layer, coverage mode, ambient cards,
>   catalog, panel settings, and viewer pose. With no active camera the panel
>   exposes no stale dropdown/FOCUS/calibration target; NEXT starts at the first
>   catalog entry and PREVIOUS starts at the last.
>   While aircraft tracking or cockpit mode owns the view, the geometry drain
>   rechecks ownership per batch and drops to two records every 250 ms. Enable
>   focus decisions conservatively combine pre- and post-await ownership.
> - Share-link camera restoration re-applies its settled pose and requests a
>   render after the flight completes, ensuring Google Photorealistic 3D Tiles
>   stream at a deep-link destination without requiring manual camera input.
> - **Reversible Context handoff:** enabling Global Context snapshots the exact
>   enabled-layer set and every runtime parameter it changes, then clears
>   unrelated active Data Layers. Mode switches, required-dependency disables, direct
>   disable, and teardown restore that pre-entry state before control leaves
>   Context. Directly switching between Flights and Space Missions remains
>   supported without losing the original snapshot. Contacts waits for the
>   dependency releases it owns before restoring that snapshot, so the first
>   Space Missions selection completes without a stale teardown superseding it.
> - **Space Mission horizon occlusion:** mission dots and hover reticles apply
>   their surface-anchor horizon state before Cesium draws or picks the frame,
>   while shared-host labels use the same hidden-globe horizon contract. Rear-side
>   markers therefore cannot remain from the prior camera frame, including in
>   request-on-demand photoreal views; the conservative limb margin remains.
>   Graphics that begin with Cesium's implicit visible default are enrolled in
>   that pass on their first frame rather than bypassing the cull.
>   Selecting a mission isolates its launch anchor until Show All / Deselect
>   or the panel close control clears the selection.
> - **Cockpit flight signals:** Live Signals shows the current and nearest
>   flight names as larger clickable controls. Selecting a name transfers the
>   active cockpit tracker to that flight; type and distance remain secondary
>   text without repetitive event-category headings.
> - **Ground-safe cockpit:** the first-person anchor and final camera position
>   are clamped to the shared mesh-first rendered-surface floor with 12 m of
>   clearance. In the photoreal stack, grounded entry keeps the existing safe
>   map camera until that rendered mesh cell resolves instead of trusting a
>   delayed/raw aircraft height as a temporary surface. Successful one-shot
>   model ground snaps populate the same shared mesh cache, and repeated
>   grounded source timestamps lift their stored history when the floor warms.
>   Landing and taxi tracks therefore cannot place the camera below terrain or
>   inside photoreal 3D Tiles.
> - **Display panel width:** across desktop HUD layouts, the expanded right-rail
>   Display panel uses a 272 px glass-backed surface; its collapsed tab and
>   narrow-screen layout retain their existing responsive widths.
> - **Cockpit rolling telemetry:** the central speed, heading, and altitude
>   values use per-digit vertical rolls when their displayed values change.
>   Increasing and decreasing values move in opposite directions, and heading
>   accounts for the 359°/000° wrap.
> - **Cockpit route cue:** when reliable destination coordinates are available,
>   the estimated-destination arrow occupies a fixed centered slot above the
>   lower telemetry, follows the apparent ground-plane perspective, and rotates
>   to show relative bearing within a legible ±120° steering range. Flights
>   without destination enrichment omit the cue.
> - The skylight feature set and six field-test hardening rounds shipped
>   2026-07-03; **CCTV v2** shipped 2026-07-04.
>   Voice tools were **28** at this milestone (**29** in the live runtime — see
>   the layer-vocabulary note below). Global Context can be entered or exited directly,
>   and Cockpit voice control supports status, entry from a selected or tracked
>   aircraft (establishing Contacts first), exit, and filtered Previous/Next navigation through the full
>   nearby-contact cohort. Contacts exposes source-honest counts inside its
>   250 km subject window.
> - **Height-datum system (2026-07-08):** Caltrans + TfL camera packs (~900
>   cameras) and the height-datum work fix entity heights on the
>   ellipsoidal globe end-to-end (geoid module, keyless Re:Earth terrain for the
>   OSM stack, ground-floor system with rendered-mesh sampling, always-visible
>   sprites/trails, OpenSky credit governor). The 2026-07-08 CHANGELOG entry
>   records the subsystem's architecture, invariants, residuals, and verification.
> - **Height-datum test surface:** `npm test` 184 unit · `npm run
>   test:track` 43 tracking invariants · headless QA harnesses under
>   `scripts/qa-*.mjs` incl. `qa-height-datum.mjs` (numeric heights) and
>   `qa-floor-verify.mjs` (any-airport ground-truth oracle).
> - **2026-08-19 — display-time ground floor (flights layer).** A grounded
>   contact's render height is picked once per poll from the floor of its FIX
>   cell, but what renders is the dead-reckoned position, which drifts across
>   cells for the whole segment and for hundreds of metres while a contact
>   coasts on a stale feed. On a graded apron that buried sprites under the
>   mesh (measured −15.5 m at KAUS; `qa-floor-verify` reported FAIL). The fleet
>   pass and the tracked display path now re-floor the DISPLAYED coordinate
>   against `cachedGroundFloor` — read-only, grounded contacts only, and never
>   while a 3D model owns the visual (T7 ground-snap one-shot). The poll's floor
>   warm/sample batch additionally collects each grounded contact's display
>   CORRIDOR (the ground it is about to cross — toward its newest fix while
>   interpolating, along its course while coasting), need-ranked and deduped so
>   parked contacts never crowd out moving ones. Budget is charged only for cells
>   with no floor yet — warm cells are still emitted, because the mesh sampler
>   must see a cell again once its DEM prior lands — which gives a service bound
>   that falls out of the policy: every contact is served within
>   `ceil(contacts / budget)` polls. Sample spacing along a projected arc derives
>   from its length (never a fixed count, whose spacing widens with speed), and
>   the cell walk steps at an eighth of a cell, so any cell the path occupies for
>   ~14 m of ground or more is collected. The corridor
>   integrates the SAME constant-rate turn the dead-reckon does, so a
>   sustained-turn taxi warms its arc rather than a straight tangent. Visual
>   ownership — not model existence — decides when the clamp stands aside: a model
>   owns the visual only while it is actually RENDERING (`ready && show`, the
>   pair the billboard handoff itself consults), and the tracked path also
>   requires `_trackedModelRegimeActive()`. So neither a retained-but-hidden
>   model (3D off, zoomed out, cockpit) nor one still loading suppresses
>   flooring while the billboard is what the user sees. **The visual/data split is deliberate**: visual
>   consumers are floored at the per-frame cache, while `_describeFlight` — and
>   so `findByQuery`, `getTrackedInfo`, `getTrackedSubject` — keeps reporting
>   sensor truth (barometric `altitudeM`, fix-time `renderAltitudeM`), because a
>   query or an altimeter should answer what the aircraft reported, not where its
>   icon was nudged to clear the tiles. Residual, unchanged by this
>   work: the floor is a ~111 m cell, so intra-cell relief (terminals, jet
>   bridges) and contacts moving faster than the 30 s warm batch can still read
>   metres low. `qa-floor-verify.mjs` now **exits non-zero on FAIL** (1 = FAIL,
>   2 = INCONCLUSIVE); it previously exited 0 on every verdict, which is how the
>   burial stayed invisible. It also honours `QA_BASE_URL` and puppeteer's
>   pinned Chrome-for-Testing, like the other harnesses.
> - **2026-07-16:** the FIRMS Active Fires layer is **LIVE** —
>   the bundled 2026-05-25 snapshot (58 MB) is deleted; a new `/api/firms` proxy
>   (vite.config.js) merges VIIRS NOAA-20/NOAA-21/Suomi-NPP NRT world CSVs
>   (days=2 → trailing-24h clamp, 30 min memory+disk cache, single-flight,
>   serve-stale-on-failure) behind server-side `FIRMS_MAP_KEY` (keyless → 503 +
>   in-app KEY REQUIRED chip). Client polls 10 min (`src/data/firmsHeatmap.js`;
>   adapter `src/data/firmsAdapt.js`, CSV parser `src/data/firmsCsv.js`).
>   `/api/firms/status` reports cache age + MAP_KEY transaction usage.
> - **2026-07-16:** Traffic supports optional live
>   TomTom flow through the server-side, budget-governed `/api/tomtom` proxy;
>   keyless installs retain the byte-identical white-dot simulation.
> - **2026-07-22 (CCTV v3 Parts A+B):** replay, color-coded viewsheds,
>   save-gated direct-manipulation calibration, `viewshed`/`adjust` voice
>   actions, shared-floor E/N drag grounding, and bounded snapshot requests are
>   integrated. Citywide static-plane LOD/pacing work remains outside runtime.

> **2026-07-02 milestone:** the skylight aircraft/satellite/enrichment work and
> pre-ship hardening fixes landed.
> Runtime changes reflected below: **voice tools 17→20 at the 2026-07-02 milestone** (`next_iss_pass` + the 19 already on
> main), type-aware 8-class aircraft sprites + path-derived rate-limited display heading, adsbdb
> flight enrichment (cached proxy + route-plausibility gate), disk-cached CelesTrak TLE proxy,
> ISS pass prediction, and per-layer data attribution. Gate at close: unit 98/98, build clean,
> track 19/19, + five QA harnesses (heading 16/16, sprites 9/9, cctv 5/5, failstate 5/5,
> attribution 18/18). New modules: `src/data/{motionModel,aircraftMeta,aircraftClass,aircraftIcons,issPass,routePlausible,dataCredits}.js`.
> The live runtime now declares **29** voice tools; the 17→20 count above is retained only as milestone history.
>
> **Layer vocabulary (2026-09-09).** The 29th tool is `list_layers`, and it
> arrived with the repair it exists to make checkable. `set_layer_visibility`
> and `show_data_layers_menu` had carried a hand-written enum of **17** layer
> ids since upstream while this fork registered **60** layers, so 43 of them —
> every French one — could not be NAMED by the model, which reported them as
> nonexistent when asked. All four layer enums (`set_layer_visibility`,
> `show_data_layers_menu`, `get_entity_context`, `analyst_query`) are now
> derived from `src/voice/layerVocabulary.js`, which reads `LAYER_TAXONOMY`;
> `src/voice/layerVocabulary.test.mjs` fails if the shipped literals drift from
> it, the same mechanism `src/locations.test.mjs` uses for the fly-to presets.
> `normalizeLayerId` resolves ids, French and English aliases, and panel labels
> with accents and case folded away. An unknown layer now returns
> `suggestions` instead of throwing.
>
> **Reading the data (2026-09-09).** `get_entity_context` reads the selection
> off ANY layer that implements `getSelectedInfo()` — not just the four
> trackable families — and adds `nearby`, the closest loaded records to the view
> target with `distanceKm`. `bikeshare`, `irve-fr`, `medecins-fr`,
> `shared-mobility-fr` and `transit-fr` gained `getSelectedInfo()` and
> `getAnalystRecords()`; `ANALYST_LAYERS` went from 5 entries to 23 (with
> `dvf-sales`), so the French point layers are queryable. The engine now REFUSES a filter naming a
> field the queried layer does not publish and names the real fields — an
> unknown field used to match nothing and answer "zero".
>
> **What a layer has MEASURED (2026-09-09).** Some layers do not answer "how
> many are there" — they answer "what is it worth here", and that number has a
> method behind it (a radius, a set of comparables, a named denominator). A
> layer publishes it by implementing `getVoiceSummary()`, and
> `get_entity_context` carries every enabled layer's under `layerSummaries`.
> `dvf-sales` publishes the block median €/m², its quartiles, how many of the
> sales in the radius carry a price at all, and the commune median they are
> read against; `avis-valeur` publishes the estimate, its `basis`
> (`comparables` / `range` / `none`) and its interval. The figures are LIFTED
> from `getStats()`, never re-derived: an average of the drawn markers would be
> a second number for one question, computed by a different rule than the card.
> Each summary carries `measuredAt`; a summary measured further from the view
> target than the layer's own radius is replaced by `pending`, because the
> camera-driven layers hold the last block they scanned until the next answer
> lands. A layer that has not scanned yet publishes `pending` too — silence read
> as "there is nothing here".
>
> **ON is not VISIBLE, and the view fixes itself (2026-09-09).**
> `set_layer_visibility` results carry `drawing` and, when false,
> `notDrawnBecause`: `loading`, `source-error`, or `nothing-in-view`. `ok` stays
> true; the layer IS on. Loading-versus-broken is decided by the shared
> `layerFeedState()` so a layer that puts its zoom prompt in `stats.error` is
> not reported as down.
>
> When the obstacle is CAMERA HEIGHT the tool descends instead of reporting:
> `descendToLayerScan` flies — through `fly_to_location`, so one navigation
> policy — straight down onto the view target already in frame, calls
> `refreshLayer`, and returns the fresh drawing report plus `viewAdjusted`.
> Measured 23 027 m → 516 m over Bordeaux, 12 sales drawn. The framing follows
> the layer's declared REACH (`scanReachM` on `createAddressScanLayer`; 300 m
> for `dvf-sales` and `avis-valeur`) at three radii — `scanDescentRangeM()` —
> not the ceiling, which for DVF would stop at 7 km. A layer that declares no
> reach falls back to 60 % of its own ceiling, so `bruit-fr` (dormant at 250 km
> because it draws a regional outline) is not dragged to a street corner. With
> no ground point under the camera nothing moves and the layer's own explanation
> stands.
>
> **Situation preamble (2026-09-09).** The OpenRouter text brain posts a short
> `user` message before each turn — camera, place, active layers, selection,
> Contacts window (`buildSituationBrief`, hung off the action runner as
> `describeSituation`). Only the newest one is kept in the history. The Realtime
> session does not use it: it already gets view state from
> `get_current_view_state` and screenshots.

## Canonical Docs Order

Use docs in this order when details conflict:

1. `docs/CURRENT-STATE.md` (this file)
2. `docs/opensky-auth.md` (OpenSky authentication)
3. `docs/CHRONICLE.md` (what the server records and why, and the license line on
   an accumulated database)
4. `CHANGELOG.md` (release history)

Historical planning documents may not match runtime behavior.

## Current Baseline

- The project is **Surplomb** (`mml-studio/surplomb`), a French fork of
  `bilawalsidhu/gods-eye-view`. Repository metadata, public URLs and the
  User-Agent strings sent to data operators carry that identity. The
  `godsEyeView.*` localStorage namespace does NOT: renaming it would wipe every
  existing reader's panel positions, CCTV calibration and saved dossiers, so it
  is deliberately frozen under the old spelling. Runtime behavior is defined by
  this document and the current source tree rather than historical branch notes.

## Runtime Stack

- Vite + CesiumJS app with Google Photorealistic 3D Tiles
- Scene/HUD/style systems in `src/ui.js` and `src/hud.js`
- Layer management in `src/data/manager.js`
- Map stack switching in `src/mapStackController.js`
- Voice control in `src/voice/` (OpenAI Realtime over WebRTC)
- Voice map whiteboard annotations in `src/annotations/`
- 3D aircraft/model tracking surfaces in `src/data/flights.js` and `src/data/militaryFlights.js`
- Detection overlay and tracked-target readout in `src/data/detection.js`, `src/data/detectionDraw.js`, and `src/data/trackedReadout.js`
- Proxy middleware and API wiring in `vite.config.js`

### Active Data Layers in Runtime

Qualified Radio playback requests—category, station, country, coordinates, or
nearby place—always use station selection. Unqualified “turn on/start the radio”
requests use Play; a qualified Play-shaped tool call is normalized to Select so
its criteria cannot be silently ignored.

| Layer | Source | File | Proxy | Update Interval |
|-------|--------|------|-------|-----------------|
| Live Flights ✈️ | OpenSky Network on a clone, with an adsb.lol regional circle when its snapshot is stale; adsb.lol only where `GEV_NONCOMMERCIAL_SOURCES=off` (four merged circles over France, one circle elsewhere); routes, airline and type names from the VRS standing data | `src/data/flights.js` | `/api/opensky` (OAuth, or adsb.lol through the paced queue), `/api/flight-info` | 30s |
| Military Flights 🎖️ | adsb.lol /v2/mil (paced queue, `src/adsbLolFeed.js`) | `src/data/militaryFlights.js` | `/api/adsblol/mil` | 15s |
| Live AIS Vessels 🚢 | AISStream websocket. Keyed vessels move on the shared playback engine (`src/data/contactPlayback.js`, since 2026-09-30): each keeps its last 16 fixes (15 min) stamped with the AIS report time, and is drawn between two of them a steady delay behind real time — one poll plus 15 s to start, then the 95th percentile of its own report-to-next-arrival gaps plus 5 s (5 s to 4 min), slewed at 0.1 s/s, taken at once while the vessel is held on its newest fix — instead of jumping to each new fix once a minute. A 100 ms pass writes positions in place; hulls rebuild at most once a second while vessels glide; a fix more than 60 m/s from the newest is held back until a second fix agrees with it, then waited at rather than slid across (a feed alternating with a placeholder never draws the placeholder). The engine keeps a time offset (`setOffsetMs`) for a later rewind; nothing uses it yet. The selected vessel's trail stops at the fixes the clock has reached, with a live head to the vessel. Measured over the Strait of Dover (`scripts/qa-vessel-glide.mjs`, vessels that got a new report in the 90 s window): one-second steps 99% frozen with jumps (p99 212 m) on main; 24% frozen, median 2.9 m, p99 14 m after six minutes of a running server (47% frozen after three minutes of a fresh one, while tracks still hold one or two fixes) | `src/data/aisLiveVessels.js`, `src/data/contactPlayback.js` | `/api/ais-live` | 60s (+800ms visibility pass, 100 ms playback pass) |
| Mapped Installations ⌖ | OpenStreetMap mapped context | `src/data/militaryInstallations.js` | `/api/military-installations` | viewport-driven; while unavailable, auto-retry 30 s → 240 s backoff |
| Earthquakes | USGS — M2.5+, trailing 24 h, drawn as a 3D phenomenon since 2026-09-03. A POINT at the epicentre whose diameter is in CONSTANT SCREEN PIXELS and carries the MAGNITUDE (6 px at M2.5, +3 px per unit, frozen domain M2.5–M9.5); a vertical RULER rising from it whose length in world metres at 1:1 is the FOCAL DEPTH — declared in the legend as a READING SCALE and not the position of the focus, because both underground options were built and measured away (with `disableDepthTestDistance` the stem draws THROUGH the planet: parked at the antipode of the day's deepest event, 26 of 28 marks were phantoms from the far hemisphere; `scene.globe.translucency` took the WHOLE scene from 0.30 ms to 1.30–2.40 ms median and is a scene property no layer owns); and one COLOUR shared by point and ruler carrying the AGE inside the 24 h window on four frozen bands, re-banded at every 60 s poll and never per frame. **Since 2026-09-10 the key and the card split the job** (D1): the on-map key carries the colour ramp with its counts plus ONE line per shape channel publishing its frozen domain — measured in Chrome at 1440×900 on a 29-event feed, 827 px of content in a 216 px window became 215 px, and 31 lines / 375 words became 11 / 93 — while **clicking a mark, or its floating `M4.1` label, opens a card** carrying that event's magnitude, place, UTC instant + age, focal depth and USGS id, each next to the caveat that belongs to it (`×31,6` of energy per magnitude unit, no footprint, the ruler's direction, the 1 km floor). The click leaves a separate cyan RING rather than repainting the mark, because every channel of the mark is already a datum; Escape, a click on the world, a poll that ages the event out, and switching the layer off all take the card down | `src/data/earthquakes.js` | — | 60s |
| Satellites | CelesTrak | `src/data/satellites.js` | `/api/celestrak` | 120s |
| Space Missions (30d) | Launch Library 2 + CelesTrak | `src/data/rocketLaunches.js` | `/api/launches` + `/api/celestrak/active` | 5 min |
| Marine Buoys ⬡ | NOAA NDBC — one ~106 KB text report carrying the latest observation from every reporting station worldwide. **NOAA is the operator, not the extent**: only about a fifth of reporting stations carry a wave sensor, and one without renders neutral rather than calm. Sea state coloured on the WMO ladder, AND carried a second time by a vertical stem in WORLD METRES: significant wave height at a ×10 000 reading scale published in the legend (1 m of swell = 10 km of stem), linear, floor 2 km, frozen domain 14 m — the top of the last NAMED band of the WMO ladder, so hue and height clip at the same place for the same published reason. The dot's pixel size no longer encodes anything (it was 9 px / 6 px for “has a sensor”); the SHAPE carries that now — filled disc = sensor, hollow grey ring = none — because a vertical stem has zero projected length at nadir and absence cannot rest on the stem alone. Stations are FIXED, so a poll replaces values in place and nothing interpolates | `src/data/marineBuoys.js`, `src/data/ndbcObservations.js` | `/api/ndbc` (keyless, disk cache, serve-stale) | 5 min |
| Aéroports ✈ | OurAirports (public domain, bundled) — **7,466 fields**, from Roissy's 4,215 m to an 82 m strip at La Tour-du-Pin. Worldwide: every large and medium airport plus everything selling a scheduled seat; in France the whole long tail — 1,337 fields across métropole and outre-mer, altiports, hydrobases and one balloon field included. **Second publisher, second licence:** 418 French fields also carry the aerodrome boundary the IGN surveys in **BD TOPO® (Licence Ouverte 2.0, the Etalab Open License, attribution required)**, downloaded by the same build from `data.geopf.fr/wfs/ows` and joined on the ICAO code (377) or on the field's point falling inside an unkeyed outline (41) — 0 shared, 0 refused on the 5 km anchor guard, worst kept offset 1,382 m. **213 fields gain a shape they did not have**, 207 of them aéroclubs, which is the tier upstream georeferenced at 8 %. Drawn as one terrain-clamped wash for all 418 (a batched ground primitive colours by bounding rectangle) with its own 8 px screen floor, so the outline goes away between 24 km and 1,208 km depending on its size while the pastille keeps the tier's longer range; the anchor stays on the published reference point. Refused: héliports (704 of the IGN layer's 1,370 objects), anything under 1 ha (219, of which 205 are BD TOPO's 5.2 m placeholder square), and 30 outlines — 1,457 ha, mostly military, largest Lann Bihoué at 767 ha — that match no packed field | `src/data/localLayers.js`, `src/data/airportsPack.js` | — | static |
| Ports ⚓ | NGA *World Port Index* (US public domain, bundled) — 2,951 ports | `src/data/localLayers.js` | — | static |
| Traffic | OSM Overpass (+ optional TomTom live flow) | `src/data/traffic.js`, `src/data/trafficFlowCard.js` | `/api/overpass` + `/api/tomtom` | viewport-driven; live flow also re-fetched every 125 s on a parked view (5 per camera load) |
| CCTV | Austin + Caltrans (CA) + TfL London + Métropole de Lyon Open Data (+ opt-in viewport-loaded OSM mapped positions) + Street View fallback at the server's own camera position (none where `GEV_NONCOMMERCIAL_SOURCES=off`); Lyon cameras also play their last recorded hour | `src/data/cctv.js`, `src/cctvTimelapsePlayer.js`, `src/data/cctvTimelapse.js` | `/api/cctv` (incl. `/api/cctv/timelapse`) + `/api/osm-cameras` | 10s (active); timelapse 60 s |
| Radio | Radio Browser (public-domain station directory) | `src/data/radio.js` | `/api/radio/stations`, `/api/radio/click/:uuid` | 45 min directory refresh |
| Bikeshare 🚲 | GBFS (Lyft + BCycle, plus Vélib', Vélo'v, vélÔToulouse, Le Vélo TBM). A dock is a dark disc ringed in its network's hue holding a core of that hue as large as it is full (`mobilityDockMark`: core 0.62 / 0.36 of the disc, none when nearly empty, grey disc for no data or closed — two `PointPrimitive`s under one id, the core added after the disc); it stands on the shared floor (`cachedGroundFloor`, else `provisionalFloor`, re-placed by bounded retries as floors land) — until 2026-09-21 a raw `scene.sampleHeight` put all 1,518 Paris docks 46-48 km underground whenever the fleets' layer was on. While the shared fleets draw their groups, its available bikes are counted into them and the dot is not drawn (`mobilityDockBridge.js`), and the layer then stays loaded up to 250 km instead of 50 km. Its block in the « Mobilités partagées » key names each network in view in its ring colour and explains the dock levels — the only block of the row that does (`publishMobilityDockKey`) — and it repaints the key when a proximity pass settles; it takes the row's fanned-out `operator` and `kinds` filters and hides docks by `point.show`, no rebuild | `src/data/bikeshare.js` | `/api/gbfs` | 60s |
| Transit FR 🚌 | transport.data.gouv.fr GTFS-Realtime vehicle positions (~150 French networks; observed footprints in `config/pan_gtfs_rt_feeds.json`), enriched per vehicle with the same networks' `TripUpdate` deviations (150 feeds, 63 in the same body) and `Alert` disruptions (63 feeds) — join rules in `src/data/transitSchedule.js`, companion resources measured into the index — plus, for the SELECTED vehicle, that network's static GTFS GeoJSON conversion for the line's trace and the ordered stops of the run (`config/pan_gtfs_static.json`). Vehicles move on the shared playback engine (`src/data/contactPlayback.js`, since 2026-09-30), like the vessels but with a shorter delay: each keeps its last 16 fixes (15 min) and is drawn between two of them a steady delay behind real time — one poll plus 10 s to start, then the MEDIAN of its own report-to-next-arrival gaps with no margin (5 s to 2 min) — and, once its clock passes the newest fix, the schedule projection carries it along its run on that same clock; with no run it waits at the newest fix. One 800 ms exponential chase follows both. A fix more than 60 m/s from the newest is held back until a second fix agrees. Replayed over 25 min of Bordeaux, Le Havre and Évreux (`scripts/replay-transit-motion.mjs`): median error 92 m → 155 m in Bordeaux, p90 931 m → 880 m in Normandy, 1% of one-second steps faster than 94 m/s → 27 m/s; in Chrome over Bordeaux (`scripts/qa-transit-glide.mjs`), p99 one-second step 106-109 m → 21-31 m, still seconds 12-13% → 20-30% (a bus waiting at its newest fix for a late report). The selected vehicle also draws where it has BEEN (since 2026-09-30, after upstream God's Eye View's selected-vehicle trail): the proxy records every vehicle of every feed body it decodes into a ring (`src/data/transitTrail.js`: 64 samples thinned to 10 s and 15 m, 15 minutes, 8,000 vehicles least-recently-heard first, 6.1 MB at the ceiling), `/api/transit-fr/trail?id=` reads one back without asking any operator, and the layer merges it with each new fix of the selected vehicle (≤128, 15 min). The body is drawn through the fixes the vehicle's playback clock has reached, in the selection cyan with the shared `trailRenderer.js` (no fade, like the flight and vessel trails); a `CallbackProperty` head runs from the last drawn fix to the glyph wherever it is this frame, so the line never gets ahead of a vehicle drawn a delay behind its newest fix. Measured in Bordeaux: after 75 s of proxy decoding a moving bus had 5 kept fixes, and after a page reload its trail was back 257 ms after the selection. Glyphs follow the post-FX style (`src/data/transitPresetStyle.js`, since 2026-09-30, after upstream God's Eye View's transit sensor presets): under NVG and FLIR, whose shaders keep luminance only and turned the kind palette into one grey between luma 0.66 and 0.79, every glyph and heading wedge draws white inside its own dark stroke, the kind still read from the glyph's shape; under CRT the kind colours go saturated and the boxes grow 4 px; Noir and the rest keep the palette | `src/data/transitFrance.js`, `src/data/transitRouteView.js`, `src/data/transitTrail.js`, `src/data/transitPresetStyle.js`, `src/data/contactPlayback.js` | `/api/transit-fr/vehicles`, `/api/transit-fr/feeds`, `/api/transit-fr/trip`, `/api/transit-fr/trail` | 15s fleet, viewport-driven below ~300 km; 25s for the selected run; trip-update bodies cached 45 s and shared by both, alerts 5 min |
| Road Status FR 🇫🇷 🛣 | Bison Futé DATEX II — live `trafficStatusValue` from 16 DIR traffic centres (`TRAFICOLOR-DIR`, 60–360 s) joined to the site geometry in `config/datex_traficolor_sites.json` (1 958 sites, 1 587 located — 844 from a DIR-published coordinate and 743 resolved from a point repère against the Bornage RRN — 608 segments, 975 km, 589 of them drawn along the surveyed centre of their own carriageway from Liaisons RRN), plus the six-minute national flow/speed snapshot (`QTV-DIR`) | `src/data/roadStatusFrance.js`, `src/data/datexRoadStatus.js`, `src/data/roadStatusCoverage.js`, `scripts/lib/rrnBornage.mjs`, `scripts/lib/rrnCentreline.mjs` | `/api/road-status-fr/segments`, `/api/road-status-fr/sources` | 60s, viewport-driven below ~2 000 km; proxy holds ONE national snapshot (TTL 60 s status / 6 min flow, serve-stale 30 min) and filters it per box |
| Événements routiers 🇫🇷 ⚠ | Bison Futé / Tipi *Événementiel-DIR* (DATEX II v2 `SituationPublication`) — every accident, rockfall, closure, roadworks order and diversion the **Directions interdépartementales des routes** declare on the non-conceded national network. **One marker per *situation*, not per record**: an accident and the two lanes it blocked are one incident, with its consequences counted on the card. Planned is not happening — future orders are held apart from what is live now. **Hosted build: the conceded motorways too** — with `BISON_FUTE_RESTRICTED_USER`/`_PASSWORD` set, the proxy starts a background poller on the licensed *Action b* stream (index every 5 min, files one at a time at ≤ 1/s under a `surplomb/1.0` User-Agent, full ~24 h window replayed on a cold start, ~40 min), keeps only live situations in `.gev-cache/bison-fute/action-b.json`, and merges them on situation id with the open feed (later version wins; nothing served until the first replay has read the whole window). Those cards read « Information fournie par <producer> · mise à jour <time> » and the row says *RRN, autoroutes concédées comprises*; `/api/bison-fute/status` reports `actionB` | `src/data/roadEventsFrance.js`, `src/data/bisonFuteFeed.js`, `src/data/bisonFuteActionB.js` | `/api/bison-fute/events` (keyless; Action b where the login is set) | 5 min |
| Véhicules partagés (FR) 🛴 | transport.data.gouv.fr GBFS (135 distinct systems after de-duplication; observed footprints in `config/gbfs_fr_systems.json`; **two tiers since 2026-09-21 (the « Repères discrets » mock)**: every vehicle is a `PointPrimitive` DOT, 7 px of its operator's hue in a 1.5 px near-black rim (10 px, the mock's), ramped to 7 px at 45 km; at or below 3,500 m of VIEW RANGE (altitude over the sine of the pitch, held at 20°: the altitude for a nadir camera) and when the answer is not groups, a few vehicles also wear a PIN (`sharedMobilityPinGlyph` in `src/data/sharedMobilityIcons.js` — dark disc, the form factor in white (Maki, CC0), ring and tail in the operator's hue, 32 × 41 CSS px, hue baked in so one image per kind × operator in view), chosen by `src/data/sharedMobilityPins.js`: greedy on screen with no two pins within 200 CSS px, the selected vehicle first, then the last pass's pins, then an id hash, so a poll or a short pan keeps them; candidates are the vehicles inside the view box whose pin would clear the screen edge and the overlay host's UI rectangles (`worldOverlayUiOcclusionRects`); re-chosen on camera arrival, on reconcile and on selection, never per frame, by diffing the billboards; measured on the landing's Paris view 24 pins on a 1,440 × 900 desktop and 5 on a 390 × 844 phone. The selected vehicle's pin is cyan and survives above the ceiling. **Groups above the ceiling**: the layer asks `cluster=<deg>` (a step of `GBFS_CLUSTER_CELLS_DEG`, 0.001°–0.256°, doubling, chosen for ~160 CSS px on screen from the ground resolution at the screen centre) and, where the requested box holds at least `GBFS_CLUSTER_ABOVE` = 1,500 vehicles — or whatever it holds from a step of `GBFS_CLUSTER_ALWAYS_DEG` = 0.032° up — the proxy answers with `clusters` counted by `clusterGbfsVehicles` over the whole uncapped clip (cells of `cellDeg` × 1.5 cellDeg, centroid inside the box grown by one cell, `system|kind` → count per cell, cells under 3 sent as vehicles) and the stations capped as before, which the client does not draw under groups but counts into the bubble of their cell (`answerDocks`); a sparser box gets the ordinary objects answer. Measured over central Paris from 7 km: 87 bubbles for 14,110 vehicles, 20.7 KB against 1.02 MB. Each group is a 46 × 28 bubble — ONE shared background image, the count as a `LabelCollection` label, the operator bar as tinted segments of one white image, so no atlas entry per number — merged on screen when two would be closer than 58 px, diffed by cell id on arrival and reconcile, grounded like the dots. The key counts the groups; the family filter and the operator focus re-count them without a request; pressing a bubble flies to it (`flyToBoundingSphere`, heading kept, pitch held at −40° or steeper, range 1.5 cells, 1.5–40 km); `getAnalystRecords` returns one `grouped: true` row per counted vehicle at its group's centroid. **The docks of `bikeshare.js` join the groups** through `src/data/mobilityDockBridge.js`: `bikeshare.js` publishes its docks under the row's filters with their available bikes (renting docks only), `addDocksToSharedMobilityBubbles` adds each to the group of its cell — `gbfsClusterCellKey`, the proxy's own key — or opens one, with the network's hue in the bar, and while any bubble is drawn `setMobilityDocksGrouped(true)` makes `bikeshare.js` stop drawing its points (`stationDrawn`) and drop the fill key; new availability or a filter on either layer re-counts from the answer in hand. Measured over central Paris from 7 km: 114 bubbles, 24,417 vehicles of which 10,255 docked, 0 of 1,518 dock points drawn; at 1,300 m all 1,518 are drawn again. The 20 px operator plates and their monogram are no longer drawn. Per-operator hues in `src/data/mobilityOperators.js`: since 2026-09-21 (second pass) the ChatGPT mock's six sampled from its pixels (`#3c8cf6` Dott, `#98e26a` Lime, `#fcd73e` YEGO, `#fb6759` Voi, `#40d4d9` Vélib', `#a765df` Pony) and eleven set at the same OKLCH lightness and chroma, redmean ≥ 92 and OKLab ≥ 0.083 pairwise; a dock is the `mobilityDockMark` above (dark disc, operator ring, core by level), and no data / closed are faded grey discs; empty VIRTUAL bays dropped and declared — empty physical docks kept; a `name` echoing its own `station_id` refused; the 6,000-object cap is spent on the requested screen first and on the margin second, at most a quarter of it — nearest first there, an id hash on screen so a thinned view stays even and stable between polls — and a light device asks for 60 % of it with `limit`; the cached clip is held uncapped and cut per request, since a camera straddling the 0.03° grid doubles its snapped box; GBFS 3.0 dock inventories are resolved through the system's own `vehicle_types.json` (`resolveStationKinds`), so a Clem' `renault-zoe` dock is a car. **Key « Mobilités partagées »** (since 2026-09-21): a segmented family control (`kinds` = `velo`/`trottinette`/`scooter`/`voiture`, a segment only for a family on screen, a family the focused operator lacks greyed), then « Fournisseurs » — dot + name, each a DRAW-ONLY `operator` focus fanned out to the row (`_offerParamsToRow` in `manager.js`; `bikeshare.js` takes `operator` and `kinds` and hides its docks by `point.show`); counts are on screen, faceted, and a filtered-empty block claims no extent. The two row chips « Vélos »/« Le reste » are gone. The key is repainted when an answer lands (it waited for the 60 s poll: 46 s behind the fleet on the landing link). **Every scale answers since 2026-09-21**: the request box is `focusedViewBox` around the screen-centre point (`cameraFocusPoint` in `viewGate.js`), six metres of ground per metre of altitude, never over 3° — a tilted view no longer gets « Zoome pour charger »; the only non-answer is a sky-centred camera (`sky`, reported `idle`, no card). Above 250 km (±10 km hysteresis) the COUNTRY VIEW draws one label per place from `/networks` (`gbfsNetworkPlaces`: live systems plus the four `bikeshare:` redundants, grouped within 25 km of the heaviest, footprints over 1° left out, named after the heaviest member whose area names one town via `gbfsPlaceName`; 81 places, fetched once a session): its name over an equal-share bar of its operators, labels that would overlap a heavier one yield (`placeSharedMobilityLabels`), pressing one flies to its footprint; the key lists operators with no count and the focus narrows the places; label glyphs get three late frames (`settleGlyphs`) because they reach the atlas after the first) | `src/data/sharedMobilityFrance.js`, `src/data/sharedMobilityPins.js`, `src/data/sharedMobilityClusters.js`, `capGbfsObjects`, `clusterGbfsVehicles` and `gbfsNetworkPlaces` in `src/data/gbfsFeeds.js` | `/api/shared-mobility-fr/objects?…&limit=[&cluster=]`, `/api/shared-mobility-fr/networks`, `/api/shared-mobility-fr/systems` | 60s, viewport-driven below 250 km, places above |
| Bornes IRVE 🇫🇷 🔌 | *fichier consolidé des bornes IRVE* (transport.data.gouv.fr, via ODRÉ) — 231,079 charge points measured 2026-08-27, rebuilt daily, folded to one site per coordinate. Three regimes by view span: 96 départements as EXTRUDED PRISMS (≥ 9.5° lat) — height = installed charge points on a frozen domain of 12 000 (≈ 15 % above the highest ever measured, 10 539 on 2026-08-27), colour = density on a frozen geometric ladder 100/250/500/1 000/2 500 per 1 000 km²; the old quantile bins are gone (six EQUAL intervals put 94 of 96 départements in one class, the geometric ladder gives 11·27·28·19·7·4). Four states, four marks: coloured prism, hatched prism (density not computable), filled flat footprint (measured zero), grid footprint (absent from the rollup) — then a **world-locked carroyage** (9.5°–0.35°): cells are squares of the graticule at a step frozen per zoom tier (0.25° / 0.0625° / 0.015625°, a quadtree, doubling itself if the occupied cells overflow the budget), one mark per occupied cell standing on a real site inside it and carrying the cell's COMPLETE charge-point total. Panning a France-wide view by 0.05° kept 179 of 1 100 marks under the old view-relative grid and keeps 1 050 of 1 057 now (G3). Every site with full detail (≤ 0.35°), where the BEAM height is the site's charge points (√, frozen domain of 24 = 98.1 % of sites, corrected for pitch, capped at −70°). The MARK is a tinted plate with Material's `bolt` punched out of it (`src/data/irveMarkIcons.js`), sized against an ink budget — `√(202 800 / marks)` clamped to 16–26 CSS px, so coverage stays flat at 15.6 % of a 1 440 × 900 frame from the ceiling down to the floor at 792 marks, and past that the answer is the power filter rather than a smaller plate. It replaced a 7 px disc that drew 318 marks nobody could find over Bordeaux at 12 653 m, the beam being a WORLD vertical whose shortest projection in that view was 1.1 px. Four rasters serve the whole fleet (the band colour rides on `billboard.color`). The POWER RAMP is monotonic in lightness and spends its whole order in the LIGHT half — L\* 54.1 → 63.3 → 72.3 → 81.7 → 90.9, gaps of 9.2 — because its first version ran from L\* 30.6 and a reader called those plates too dark to pick out: the two bottom rungs are 46 % of the sites in a French city, and a dark plate inside a dark casing is a dark blob whatever its hue. Composited over four control backdrops the smallest adjacent ΔE went 21.4 → 35.5, and the order still survives a simulated deuteranopia (40 → 46 → 52 → 68 → 93). `inconnue` is the HOLLOW plate, a rim with no fill, in the house refusal graphite at L\* 54.8 — the bottom of the ramp rather than the middle of it, so it is as findable as any measured band and what tells it apart is its SHAPE (D3); four power-floor chips `TOUT · > 22 · > 50 · > 150 kW` filter by the band ladder's own cuts (sites regime flips `filteredOut` and never rebuilds the collection, maillage re-picks in 1–12 ms). **Since 2026-09-14 the key answers ONE question — what does the colour mean** — and is one header plus the classes in view with their counts: measured in Chrome over a city view, 13 rows / 301 words / **717 px of content in a 355 px window** (clipped, its last sentence never on screen) became 7 rows / 46 words / **215 px in a 262 px window**, clipping nothing. What left it was true and is one click away: the beam's ruler (four ticks quoted in PIXELS) and its frozen domain of 24 are declared on the SITE CARD beside the exact figure they decode (F7 a, A5); the OPERATORS' clock is on that same card, per site and in French (`🗓 déclaré 15/11/2025 → 30/07/2026`), which is the stronger statement since a tenth of the register has not been touched since 2023; the publisher is named by `dataCredits.js` in the attribution surface; and the maillage cell's size in degrees and km is the first line of its own card. The key keeps only what nothing else says: the classes (D1), the refused one as a hollow ring (D3), the maillage's mark-to-site ratio and — only while a floor is hiding marks — one line saying how many and why slow classes survive it (A5). `inconnue` is labelled **_Puissance inconnue_ (Unknown power)** rather than *non exploitable* (unusable), which described what the value did to the parser rather than what the reader can know | `src/data/irveFrance.js`, `src/data/irveMarkIcons.js`, `src/data/irveFeed.js`, `src/data/irveDepartements.js`, `src/data/irveMesh.js` | `/api/irve-fr/sites`, `/api/irve-fr/departements`, `/api/irve-fr/mesh`, `/api/irve-fr/status` | 30 min (viewport TTL 6 h, national TTL 24 h; upstream consolidation is daily) |
| Établissements scolaires 🇫🇷 🎓 | *Annuaire de l'éducation* (data.education.gouv.fr, MENJ) — 68,939 rows measured 2026-09-01, rebuilt daily, of which 68,158 are open and geolocated over 68,083 distinct UAI. Pupil rolls joined on the UAI from four per-level *effectifs* datasets at rentrée 2025 (91.7% of teaching establishments). The DEPP's **IPS** joined on the same key from four more (`fr-en-ips-ecoles-ap2022` at rentrée 2024-2025, `-colleges-ap2023`, `-lycees-ap2023` and `-erea-ap2022` at 2025-2026 — each dataset discovers its OWN newest rentrée, floored; a global max drops all 32,494 écoles): 43,322 indexed UAI, reaching **40,529 of the 62,857 drawn schools that could carry an index (64.5%)**, with 2,504 `NS` sentinels and 348 indexed establishments this map does not draw. Three regimes by view span: 96 départements as EXTRUDED PRISMS (≥ 9.5° lat) — height = establishments on a frozen linear domain of 2 600 (measured range 150 Lozère → 2 504 Nord, median 577, spread 1:16.7), colour = density per 1 000 km² on frozen ×2 breaks 40/80/160/320/640 (measured class populations 8·34·30·14·4·6, none empty); a missing count is drawn STRIPED even when the rate exists, so it can never be the pixel-identical twin of a measured zero — then a grid-thinned maillage of real positions (9.5°–0.35°), every establishment with full detail (≤ 0.35°). Sites are coloured by level, sized by roll — the IPS changes NEITHER channel and there is no IPS colour scale, opt-in or otherwise; it is a card attribute and a coverage clause in the toggle readout. The maillage carries no IPS (it would undo the 1.66 MB-vs-5.42 MB name decision); a maillage click fetches the register for one coordinate and gets the same card the exact regime draws. 2,762 overseas schools are outside the bundled metropolitan polygons and are reported rather than painted | `src/data/schoolsFrance.js`, `src/data/schoolsFeed.js`, `src/data/schoolsDepartements.js`, `src/data/schoolsMesh.js`, `src/data/ipsFeed.js` | `/api/schools-fr/sites`, `/api/schools-fr/departements`, `/api/schools-fr/mesh`, `/api/schools-fr/status` | 30 min (viewport TTL 6 h, national TTL 24 h; IPS index built once per process — 8 requests, 7.6 MB raw / 750 KB gz, 3.4 s cold; upstream register rebuild is daily, IPS annual) |
| Enseignement supérieur 🇫🇷 🏛 | *Effectifs d'étudiants inscrits — détail par établissements* (data.enseignementsup-recherche.gouv.fr, MESR) — 22,068 rows at rentrée 2024, resolved to **6,294 establishments and 6,914 sites** holding 2,960,012 students. The rentrée and the Parcoursup session are DISCOVERED at build time and floored at 2024/2026. 1,665 establishments carry no `geo`; 977 are placed from *Cartographie des formations Parcoursup* (session 2026) where it gives exactly one point for the UAI, which also supplies 5,705 establishment names and the per-card formation lists — a borrowed coordinate is flagged on its card, and the 688 neither file places are reported. **Two regimes, not three**: 96 départements as EXTRUDED PRISMS over STUDENTS (≥ 9.5° lat) — height on a SQUARE-ROOT scale (declared: the domain is 738 Corse-du-Sud → 394 788 Paris, i.e. 1:535, and a linear rule would crush 51 of the 96 départements onto the 4 km floor, median included), frozen domain 400 000 students, colour = share of students at bac+4 and beyond. Density was REFUSED as the colour on measurement: Spearman ρ 0.974 against the count, so the hue would have repeated the height — then every site in view drawn straight from the national pack — no bbox query, no ceiling and no thinning, because the pack is 6,914 sites and 0.62 MB gzipped with every name on it. Coloured by seven bands folded from the register's 14 categories, sized by the enrolment at that site; 214 overseas sites are outside the bundled metropolitan polygons and are reported rather than painted | `src/data/supFrance.js`, `src/data/supFeed.js`, `src/data/supDepartements.js` | `/api/sup-fr/sites`, `/api/sup-fr/departements`, `/api/sup-fr/status` | 6 h (proxy TTL 7 d, serve-stale 30 d; the register is published once a year at the rentrée) |
| Comptages routiers 🇫🇷 🚦 | *Comptages routiers — capteurs permanents* (Ville de Paris, ODbL, read at `parisdata.opendatasoft.com`: the `opendata.paris.fr` alias stopped resolving on 2026-09-23) — **27,772,889 hourly readings**, of which the last COMPLETE local Monday–Sunday week is folded server-side into **2,977 arcs / 500,136 readings**. The week is DISCOVERED from `max(t_1h)` and floored at 2026-08-24; the feed is a nightly batch landing ~46 h behind the wall clock and is never presented as live. Live build 2026-09-02: 1,730 arcs counting vehicles, 356 occupancy-only, **891 silent** (724 *Invalide* (invalid), 141 *Ouvert* (open), 26 *Barré* (closed)), 31 with no published geometry of which 19 are measuring. Geometry and street names come from the measurement export, NOT from `referentiel-comptages-routiers` (3,739 rows for 3,348 distinct arcs). **Bivariate since 2026-09-03**: hue = the SHAPE OF THE RHYTHM computed over the 168 hours (*nocturne* night 56 · *week-end* weekend 100 · *pendulaire* commuter 367 · *pointe du matin* morning peak 150 · *pointe du soir* evening peak 652 · *continu* continuous 369 · *indéterminé* undetermined 36 — measured on the real pack, no empty class), width = flow, plus an hour cursor of 48 slots transposed from `idfm-frequency`. The four rhythm thresholds are round frozen numbers, never quantiles of the week (C1). No green anywhere in the wheel, on purpose: a traffic-light reading needs green, so the amber *pointe du soir* (evening peak) cannot be read as congestion. The cursor rebuilds NO vertices — geometry is built once per width band and the cursor only writes `show` (G2); 6 287 instances in 8 draw calls, bounded by `comptagesReachableBands()` at 58.1 % of the cartesian product. Default stays *Moyenne ouvrée* (Weekday average), not *À cette heure* (At this hour), because the chips are not serialised into the share link. One regime — Paris is one city and the whole fold is 305 KB gzipped | `src/data/comptagesParis.js`, `src/data/comptagesFeed.js`, `src/data/comptagesRhythm.js` | `/api/comptages-fr/arcs`, `/api/comptages-fr/status` | 6 h (proxy TTL 6 h, serve-stale 14 d; upstream batch is nightly and already J-2) |
| Délinquance enregistrée 🇫🇷 🚓 | *Bases statistiques de la délinquance enregistrée* (SSMSI, via data.gouv.fr, LO 2.0, edition 2026-07-09) — DEP table (101 départements × 18 indicators × 2016–2025) plus the COM table streamed from a 39.9 MB gzip (**5,238,000 rows → 34,920 communes**, folded to the newest year, 8.8 s cold). Two regimes: a département choropleth on published rates, then per-département commune packs joined to geo.api.gouv.fr contours. **Suppression is the layer**: 0 suppressed cells at département grain, 9.0%–69.8% at commune grain depending on indicator. A withheld cell arrives as `[state]` with no number, is excluded from every quantile, and has its own colour. Quantile thresholds are cut ONCE nationally and shared by every pack. The layer OPENS on a computed all-offences total (`tous`) — GEV's arithmetic, not the register's, which publishes no total: 14 commune-grain contributors and 16 at département grain, the two `Usage de stupéfiants` sub-indicators dropped because the parent equals AFD + hors AFD in 101 of 101 départements, and the rate recomputed on `insee_pop` because published rates sit on two denominators. Exact at département grain, a stated **minorant** at commune grain (2025: 9,606 communes positive of which 9,428 are floors, 243 complete zeros, 25,071 with nothing publishable). 45 SSMSI codes have no contour (Paris 20, Marseille 16, Lyon 9 arrondissements) and are reported as `unshaped`. Cards come in two registers: compact by default — one line per claim, ≤ 60 characters, so nothing wraps — and the SSMSI's rules word for word behind a `Méthodo` chip that redraws the card already open | `src/data/delinquanceFrance.js`, `src/data/delinquanceFeed.js`, `src/data/delinquanceDepartements.js` | `/api/delinquance-fr/departements`, `/api/delinquance-fr/communes/:dep`, `/api/delinquance-fr/status` | 24 h (proxy TTL 24 h, serve-stale 120 d; the base is republished about once a year) |
| Antennes mobiles 🇫🇷 📡 | ANFR mobile network observatory (*Observatoire ANFR des réseaux mobiles*; data.anfr.fr, D4C, LOv2, weekly) — edition 2026-08-27, 826,418 rows → **72,700 supports** over 107 department codes, overseas (DOM/COM) included. Two regimes: **mesh** (72,700 tuples `[lat, lon, opérateurs, bande]`, 394 KB gz, thinned to at most 1,100–2,200 points by a pick a pan does not reshuffle since 2026-09-22 — `selectGeoMeshWorld`: one representative per cell LOCKED TO THE GRATICULE (finest power-of-two step from 1/1024° whose cells fit half the budget), then every other support whose fixed coordinate-hash priority is under 2^(−level/4) at the lowest level that fits, so density still follows the network; over a 25-step pan by 2 % of the view, 100 % of the dots stay from one step to the next over France and Paris and 99 % over Brittany, against 18 %, 43 % and 44 % on the former view-relative grid (5–36 % measured in the browser at 1,400 km); 1,060 dots over France, 2,142 over Paris, every support of a view under budget; 7.4 ms for a whole-France pick against 9.8 ms) and **supports** under 0.32° of span (box ≤ 0.35°, the densest in France = 6,462 supports = 113 KB gz). Color = the generation that TRANSMITS (5G 50,148 · 4G 18,698 · 3G 127 · 2G 89); size = number of operators (1→36,671, 4→11,012, 5→1); **height = the shaft, in world units, at the support's real height** — coverage measured at 99.24% (72,149 of 72,700; median 30 m, p95 48 m, max 343.3 m), and the 551 with no height get NO shaft because they are exactly the 506 *intérieur sous-terrain* (indoor underground) + 38 *tunnel* + 7 *galerie* (gallery): ANFR leaves the field empty because there is no mast to measure. A support where nothing transmits gets a DASHED shaft (a height declared on an authorized application, not the measurement of a built object). **Azimuths** come out as 60 m rays, on the selected support's card only: the observatory publishes none (CSV header reread live, 22 columns) and Cartoradio gives 98.8% of them. Pale ring = approved project (3,638 with no transmission at all, 3,776 real extensions out of 15,606 applications). NOT painted: no departmental choropleth (the bundled polygons are mainland-only and would hide the overseas gap — 1.0% 5G in Nouvelle-Calédonie against 84.1% in the Val-d'Oise); no civil aviation, Defense or Interior sites (excluded by law); no FH/TNT/PMR (microwave links, digital terrestrial TV, private mobile radio: named on the card, never drawn); no exposure value per antenna — the closest measurement is that of a PLACE, with its distance and its date. **4G coverage and dead zones (ARCEP)**, off by default: its own tile of the key, *Couverture 4G* (*4G coverage*), independent of the masts (`masts` param, `lo=an.m.0`), and its own block while it is on, since 2026-09-22 — two segments, « Sans 4G » (how many of the four operators reach, at least at limited coverage) and « Par opérateur », which opens a second strip of the four operators (none / limited / good; very good is left unpainted). Both paint one magenta ramp on the globe AND on Google 3D — a second imagery layer over the same pyramid is draped on the photoreal tileset (`tileset.imageryLayers`, experimental in Cesium; `asynchronouslyLoadImagery` keeps the mesh drawn while the drape loads; alpha 0.52 there against 0.6 on the globe, because Cesium blends draped imagery in linear light — both read at 0.58–0.62 on the Mont-Blanc; the colour climbs façades inside painted areas, CARTOGRAPHY F4, accepted because the ink sits where the network is missing) — from a zoom 5–12 pyramid built off the server by `node scripts/build-mobile-coverage.mjs` (edition 2026 T1, as of 31/03/2026: 17 316 tiles, 196 MB). Measured over 548 967 km² of land: dead zones 1.01 % (5 545 km²), one operator only 0.97 %, all four 92.4 %; per operator, no coverage at all: Orange 3.6 %, SFR 3.1 %, Bouygues 4.0 %, Free 3.5 %. A click on bare ground opens a card whose title is the answer (« Zone blanche : pas de 4G ici », « Seul Orange capte ici », « Les 4 opérateurs captent ici »), then each operator's level in everyday words (très bon / bon / faible, dehors seulement / aucun réseau) and « Estimation des opérateurs (ARCEP, mars 2026) ». **Rendering cost (2026-09-22)**: the card is published once, with its answer — a « Chargement… » card only when the read takes over 250 ms — and survives the dot rebuild of a camera settle, as does a selected mast still in view; nothing republishes it per frame, so an open card costs no frames at rest (it used to keep the globe at ~60 frames/s). Tiles are fetched, decoded and repainted in a Web Worker (`mobileCoverage.worker.js`; main-thread fallback without a 2D OffscreenCanvas) through one page-wide store of decoded codes (192 tiles, 96 on a phone, ≤ 72 KB each) that the card reads too; requests still go through Cesium's `RequestScheduler`. A chip press loads the next mode at alpha 0 under the current one on the globe and trades them in one frame (no bare frame; 1.5 s ceiling); on Google 3D the drape is replaced directly, because a second draped layer rebuilds every tile's draw commands (528 ms freeze measured). Measured on production builds, Chrome, 12 s flight over the Mont-Blanc: phone emulation at 4× CPU, chip presses 48 → 58 frames/s and 174 → 0 ms of long tasks; Google 3D, 51 → 60 frames/s and 13 → 1 frames over 50 ms. The mode is share-linked (`lo=an.c.<0|z|o|s|b|f>`); a mode a link asked for on a server without the pyramid keeps its block, unlit, with the reason. The no-coverage rung (none at all in « Sans 4G », this operator absent in « Par opérateur ») is HATCHED on the map and in the key — stripes of its own colour at alpha 0.95 over its 0.6 fill, one texel in eight, three wide (`COVERAGE_HATCH`); the stripes add ink, so the ramp's order holds, and the codes are magnified before they are painted, so a stripe keeps its width past zoom 12. **Camera rest (2026-09-23)**: a rest keeps the masts still in view — record, billboard and shaft, keyed by the mast's id (`anfrSupportId`, `anfrMeshRecordId`) — removes the billboards of those that left and adds only the newcomers' (removed rather than hidden: a hidden billboard costs a `BillboardCollection` two vertex rebuilds, an add or remove one); shafts live in one `PolylineCollection` per appearance (≤ 5 draw commands in any order) and are pooled there. The national pick answers from an index kept beside the mesh (`geoMeshThinning.js`: binary search on latitude, cells counted by runs, 1.9 MB for the 72,746 rows) and returns exactly the former linear pick (804 of 804 real views identical). Measured interleaved on the ThinkCentre, 4× CPU, antennas alone, 8 pan-and-rests per side, two runs: rest handler 207–338 → 95–102 ms per rest over France (pick 174–289 → 67–79 ms), 80–81 → 45–50 ms over Paris at 5 km (2,955 → ~50 billboards created per rest), at 2.5 km with shafts `reconcileSupports` 27–34 → 15 ms and `reconcileMasts` 20–27 → 5 ms; long tasks after a stop 541–805 → 368–396 ms (France), 171–216 → 110–119 ms (Paris 5 km), 353–390 → 178–202 ms (2.5 km); worst main-thread gap after a stop (10 ms heartbeat, median over rests) 188 → 135 ms over Paris and 215 → 137 ms at 2.5 km, unchanged over France (188 → 179); orbit fps unchanged. **Line of sight of the selected mast** (globe only; on Google 3D the card says it is not drawn): from the top of the mast at its registered height, over Mapterhorn's terrain, out to its radio horizon (4/3 Earth, handset at 1.5 m; 27.6 km for a 30 m mast, capped at 40 km), painted in the selection cyan and said on the card as « Visible depuis 2 % du terrain dans un rayon de 28 km » — what the antenna sees, never its coverage; the key adds « D’après le relief, sans bâtiments ni arbres ». **Card and key written for a first-time reader (2026-09-22)**: the mast card is five short lines — « Antenne 5G · 4 opérateurs », the brands, « Réseaux : 5G, 4G, 3G, 2G » (or « Prévu : … — pas encore installé »), what it stands on and the commune (« Sur un toit, à 65 m de haut · Paris 6e »), the nearest wave measurement as a multiple of the legal limit (« … : 51 fois sous la limite légale », with « avant les antennes actuelles » when it predates them) — then « Source : ANFR, <edition> »; frequencies, antenna counts and bearings, owner, register number and licence are off the card. The key is one plain name per colour (« Antenne 5G », « En projet, n’émet pas ») with no statistics. | src/data/anfrFeed.js, src/data/anfrMesh.js, src/data/anfrFrance.js, src/data/mobileCoverage.js, src/data/mobileCoverageImagery.js, src/data/mobileCoverageTiles.js, src/data/mobileCoverageTile.js, src/data/mobileCoverage.worker.js, src/data/mastViewshed.js, src/data/mastViewshedPaint.js, src/data/mastViewshed.worker.js, src/data/mastViewshedImagery.js, src/data/anfrSupportCells.js, scripts/build-mobile-coverage.mjs | /api/anfr-fr/mesh, /api/anfr-fr/supports, /api/anfr-fr/support/:id, /api/anfr-fr/status, /api/anfr-fr/coverage, /tiles/mobile-coverage/:edition/:z/:x/:y.png (outside /api: no limiter, immutable) | poll 6 h; proxy TTL 6 h, serve-stale 14 d, disk cache 5.2 MB; `/mesh` and `/supports` gzipped, kept 6 h by the browser (weak ETag, 304); city-view cells kept 6 h; Cartoradio card 24 h; weekly upstream (cold build 36.4 s / 517 MB) |
| Îlots de fraîcheur 🇫🇷 🌳 | *Îlots de fraîcheur — équipements et activités* (535 points, modified 2026-09-01T05:45:08Z), *— espaces verts frais* (984 footprints, 584 Polygon + 400 MultiPolygon, modified 2026-08-28T05:40:21Z), *Fontaines à boire* (1 323 points, Eau de Paris, modified 2026-08-31T07:42:08Z) and *Les arbres* (219 432 points, modified 2026-08-28T08:35:28Z) — Ville de Paris, read at `parisdata.opendatasoft.com` (the `opendata.paris.fr` alias stopped resolving on 2026-09-23), all four ODbL, keyless. **TWO regimes, and the split is by size not by zoom**: the three refuge registers are folded server-side into ONE document of 3 451 189 B / 643 107 B gzipped (9 929 649 B upstream, 2 454 ms in parallel) and shipped whole — no bbox, no maillage, no thinning — while the trees are a per-viewport `in_bbox` export gated at 1 500 m of camera altitude and a 0,016° box snapped onto a 0,002° grid, preceded by a 36-byte count probe that refuses the download over 12 500 trees (the densest grid-aligned 0,020° window in Paris holds 10 571, the densest 0,022° one 12 269). **FOUR CHIPS, and the trees are OFF by default**: each register is switchable (`PARCS · REFUGES · FONTAINES · ARBRES`) and the key prints only what is drawing — 8 rows with the defaults, 11 with the trees on, against the 18 it printed when all four were painted at once over a screen the 12 500 tree dots take 95 % of. The tree chip gates the REQUEST, not just the paint. Green-space fills are coloured by `indice_veget_sup8m_2024` on TWO fixed bands cut at a quarter of the ground (401 under, 582 over; the 66 at exactly 0 are inside the low band and named in its blurb, the 1 with no index at all is grey and reported in the key's note rather than given a row); the **23** spaces declaring `canicule_ouverture = "Oui"` carry a hot ground stroke, 9 of them also `ouvert_24h`, 11 of them with zero measured canopy. Equipment dots are coloured by THREE mechanisms folded from the 12 published types — you go in (225), you stand under something (156), there is water (154) — with the published `type` kept verbatim on every card; fountains by `dispo` (1 238 OUI / 85 NON, 10 of the NON past their own end date); trees by whether a height was published at all (19 407 are 0) and sized by it, capped at 25 m. Every dot is seated on the surface being DRAWN (`provisionalFloor.js` under the DEM warm, with a doubling retry) rather than on the ellipsoid, which is what stops the whole layer sliding across the city as the camera moves. Open/closed is re-folded in the browser on Europe/Paris every minute (757 spaces open at 14 h vs 367 at 01 h 30, 5,0 ms per re-fold) rather than taken from the proxy's hour-old summary. NOT painted: nothing — all 535 equipment rows, all 1 323 fountains and all 219 432 trees carry a real coordinate, and 984 of 984 spaces keep at least one ring (22 of 3 439 rings fall below a triangle at 1 m and are dropped and counted) | `src/data/fraicheurParis.js`, `src/data/fraicheurFeed.js`, `src/data/fraicheurTrees.js` | `/api/fraicheur-fr/refuges`, `/api/fraicheur-fr/arbres`, `/api/fraicheur-fr/status` | 60 min for the pack + a local re-fold of the clock every minute (proxy TTL 60 min, serve-stale 7 d; the equipment and fountain registers are rebuilt daily). Trees: viewport-driven, 400 ms debounce, proxy TTL 6 h per box, 48 boxes in memory and on disk |
| Autorisations d'urbanisme 🇫🇷 🏗 | Sitadel via DiDo — *liste des autorisations d'urbanisme créant des logements* (rid `8b35affb…`, 1 917 260 rows, millésime 2026-08) and *liste des permis de démolir* (rid `1a9a2f0c…`, 202 895 rows, from 1996), both keyless and `fr-lo`, PLUS `cadastre.data.gouv.fr` Etalab parcels (edition discovered from the `latest` 302, floored at 2026-06-01) and `geo.api.gouv.fr/communes` for the commune under the screen centre. **ONE regime, and the arithmetic forbids a second**: DiDo scans an 889 MB CSV in 3,57–5,01 s per query whatever the query, so 34 945 communes is 39 h for one national pass — the layer answers one commune at a time and names it on the row. The file publishes NO coordinate (`geoFields: ["REG","DEP"]`); every position is a cadastral-reference join, refused when the reference matches more than one parcel. Ground-clamped `GroundPrimitive` fills, one per parcel part, coloured by the lifecycle band of the MOST RECENT permit on that plot (`Autorisé` / `Chantier ouvert` / `Travaux achevés` / `Annulé` / demolition), a `GroundPolylinePrimitive` edge per ring, **one BADGE per placed permit** since 2026-09-23 — a rounded square in the class colour with Lucide's `building` drawn in white, struck through for a demolition, one size for every permit (30 px, scaled down to 40 % by 10 km), a billboard in a `BillboardCollection` — and the parcel under it washed AND outlined in that same colour. The palette is `src/data/permitProjects.js`'s, which `ads-fr` wears too, and the key prints one plain line per class drawn (*Permis accordé*, *Travaux commencés*, *Travaux terminés*, *Annulé ou refusé*, *Permis de démolir*) folded under *Couleurs des projets*, with no count and no sentence. The *Annulé* grey moved from `#6c757d` to `#8c93a3` the same day: `ads-fr` paints the class on roofs, and the darker grey sat at ΔE76 17.2 from the wash of a volume with no dossier (28.0 now, over the theme's bar of 25). **The column is gone** with the dot it replaced: until 2026-09-23 each dossier stood a 12 m-square column, one metre per authorised dwelling (the fix of 2026-09-14 for the extruded PARCEL, which had drawn Ustaritz 06454721B0037 — 45 logements — as 404 000 m³ of orange over a village of 8 m houses). A street of columns in four colours read as a skyline rather than as an answer; the dwelling count is now printed where it is read as a number: the tag the globe keeps over a selected permit (*18 logements*) and the title of its card. **The card is in the map key** (`legendSelection`, the mock's card): the kind of permit, *N logements autorisés*, the address (cased: `5 RUE ANDRE DIGNAC` → *5 rue Andre Dignac*) and the commune, a badge naming the class in its colour, the nature of the project, the declared floor area and the dwellings demolished, a timeline of the three dates (*Permis accordé* → *Début des travaux déclaré* → *Fin des travaux*, *Non renseignée* when the register has not received one), then the file — parcels, land check, placement, number, the commune's and the year's placement rates, the editions, the credit — folded under *Voir les détails du permis*, and *Source : Sitadel · SDES*. The globe keeps the tag alone while the key carries the card, and the whole card when it cannot (`mapKeyCarriesSelection`, watched). **The row's *Période* cuts the pack in hand** by authorisation date (`sitadelPayloadForPeriod`, the same four windows as `ads-fr`, whose share-link option `au.w` this layer now mirrors: `enabled+mirrored-options`): changing it costs a redraw and no request. **Every mark reads ONE floor** (`sitadelFloorM`, 2026-09-14): the shared DEM cell when it is warm, a `provisionalFloor.js` probe of the surface actually being DRAWN while it is not, and `null` — never `0` — when neither answers. Before that the dots took `0` for a cold cell and were never written again: measured over Paris, camera at 500 m, **all 4 753 sat at ellipsoidal height 1.0 m while the drawn mesh under them read 76.7–96.9 m**, and because they paint through depth their screen position followed the camera pose and the layer slid across the rooftops. `reanchorPoints` re-seats the badges already on screen when a better floor lands, on a doubling ladder refilled at every camera settle, and a floor that stops answering never overwrites one that did. A floor outside **−100 m to 5 000 m** is refused as not-French-ground and re-probed on every later pass rather than latched: measured over Nantes with the tileset reporting `tilesLoaded: true`, 81 probes on a 1,3 km grid ALL answered between −424.9 m and −360.2 m in a smooth 5 % ramp (a planet-scale root tile answering for a city), every one passed `provisionalFloor.js`'s world band, and the fill radius lent one of them to the whole commune. Proven by `npm run qa:sitadel-floor`, which refuses `/api/terrain/heights` so the claim is about the DRAWN surface and not about a network round trip. **The layer offers what it drew** (`sitadel/drawnDossiers`, `PERMIT_DRAWN_ON_PARCEL_JOIN`): the dossiers on its parcels, keyed `series|number` as `ads-fr` keys them, republished on every draw, so `ads-fr` lays no second badge and no second wash on the same plot. Selecting a dossier rings the GROUND of every plot it names. And the commune contour as a second polyline — the scope of the answer, decimated (Nantes 804 → 269 vertices, worst displacement 183 m) and labelled *contour communal simplifié* (“simplified municipal outline”). Measured: Paris 4 500 parcels / 70 766 vertices / 4 753 permits, Nantes 3 032 / 47 676 / 2 747. NOT painted and COUNTED instead: 9 449 ambiguous, 1 859 missing and 219 reference-less permits over the six measured communes — never moved to a commune centre, and never given a legend swatch, because the swatch is the colour the object is painted | `src/data/sitadelFrance.js`, `src/data/sitadelFeed.js` | `/api/sitadel-fr/commune`, `/api/sitadel-fr/status` | camera-driven (450 ms debounce, gated on camera ALTITUDE ≤ 12 000 m — 2·h·tan 30° = 13,86 km of ground at Cesium's default 60° FOV, against communes 12,1–17,9 km wide — asking once per 0,01° focus cell and carrying `have=<insee>` so an unchanged commune answers in 53 B instead of 2 085 535 B) + 6 h idle; proxy TTL 24 h memory + `.gev-cache/sitadel-fr/communes/`, serve-stale 30 d, global DiDo semaphore of 2 because the 4th simultaneous request is a 429 |
| Réseau et fréquence IDFM 🇫🇷 Ⓜ | ONE row over TWO Île-de-France Mobilités publications, merged 2026-09-10 — they drew the same stops and the reader was left to do the join. **The referential** (`arrets`, `referentiel-des-lignes`, ODbL 1.0): 37,956 stops and 2,121 lines with their official liveries, drawn below 20 km of altitude as **filled mode badges, 21–27 px** (a pictogram knocked into a disc), at most 100 per 1° box, seated on the terrain under them. The badge replaced naked 14–24 px line-art on 2026-09-10: tinted `#c9d4e0` for the mode this referential is mostly made of, it was pale grey line-art on pale grey roofs, and a filled mark brings its own ground instead of hoping for a luckier hue. IDFM publishes NO GTFS-Realtime vehicle positions at all (0 in Paris intra-muros against 453 in Bordeaux), so this layer draws the offer and never fakes a vehicle. **The hourly offer** (*Offre hebdomadaire moyenne hors vacances*, Licence Ouverte v2.0) — **1,311,578 rows, 22 fields**, edition `data_processed` 2026-08-18T15:54:55+00:00 discovered from the portal and floored there. **The only time-of-day dimension in the app**: average departures per stop for a 7 × 24 (day, band) grid, operating day 04:00→03:59 so bands run 4..27. It draws below a 0.035° view span (leaves at 0.045°) as a small rate disc — **but never on a stop the referential already badges**: one point carries one mark since 2026-09-10, and the badge carries the rate in its FILL, so mode is the shape and rate is the colour. Five upstream calls per box — one identity page plus four band windows, because `offset + limit <= 20000` caps grouped reads and the band axis cannot be pivoted — **3,303,162 bytes in 2.42 s → 540,404 raw / 87,143 gzipped for 805 stops** on a 4 km box on Châtelet. Fixed six-step ladder (2/4/8/16/32 departures per hour), never a quantile, so a colour means the same wait in Paris at 08:00 and in Melun at 01:00; on an average Tuesday that box splits 23/6/17/167/240/237/115 at 08:00 and 397/179/80/103/44/2/0 at 01:00. **The join is `arrets.arrid`** — measured 2026-09-02, 34,903 of the offer's 36,502 stops (95.6 %) join it — and one click prints both halves on one card: mode, arrondissement, fare zone and step-free status, then the rate for the selected band, the day's sparkline, first/peak/last, the day total and the same band across all seven days. **No licence line on the card since 2026-09-10** — both licences are named by `dataCredits.js` in the attribution surface for as long as the row is on, and a card a reader opens to find out what serves their street is not an attribution surface. NOT claimed: a referential stop outside the offer file (**3,053 of 37,956, 8.0 %**) says so instead of showing a zero; **a click above the frequency gate BUYS the profile it cannot draw** — the card carried *offre horaire non lue à cette altitude* (“timetable not read at this altitude”) until 2026-09-10 and a box the proxy had refused as too dense answered a click with a flat *aucun profil publié* (“no published profile”), which was not merely unhelpful but false; a click names one coordinate and the cheapest legal box around one coordinate is one 0.005° cell, so the gate now bounds the DRAWING and never the answer, and every profile that box paid for is kept so the next click on the street is free; the **549 stops (1.50 %) with no coordinate** (473 Train, 69 Bus, 7 Tramway; 2.76 % of a Tuesday's courses) are counted and never placed; a box past the 1,200-stop ceiling is refused after one call with `tooDense` and an *au moins* (“at least”) count; and no stop is drawn for a `stop_times.txt` this layer never opens. **The legend follows the fills**: in a charted view it is the six-rung ramp plus the measured-silence row plus a `#8a93a6` *offre horaire non publiée* (“timetable not published”) row; above the gate, or in a refused box, it is the MODES on screen with their counts — until 2026-09-10 it was six rungs at zero and a silent row at zero, a legend describing nothing that was drawn. **Dropped in the merge**: the eight-département choropleth the frequency row painted above its gate. A choropleth needs an alpha low enough for the imagery underneath to survive, and at that altitude the result read as a faint wash over half of France rather than as a reading. The fold survives server-side at `/api/idfm-frequency/region` (356 aggregate rows + 17 stop censuses → 14,719 bytes raw / 5,864 gzipped) and nothing in the browser imports it | src/data/idfmNetwork.js, src/data/idfmFeed.js, src/data/idfmFrequencyFeed.js, src/data/idfmFrequencyDepartements.js (proxy only) | /api/idfm/stops, /api/idfm/lines, /api/idfm-frequency/stops, /api/idfm-frequency/region, /api/idfm-frequency/status | poll 60 s (a CLOCK tick, not a data poll: the band follows `Europe/Paris` and a scrub is a repaint of the 7 × 24 profile the browser already holds); proxy TTL 24 h per box / 7 d for the région, serve-stale 30 d, disk cache `.gev-cache/idfm-frequency/`; upstream is a yearly average republished a few times a year |
| Bruit des aéroports 🇫🇷 🔊 | *DGAC Plan d'Exposition au Bruit* via Géoplateforme WMS-V `GetFeatureInfo` (`INFO_FORMAT=application/json`, real EPSG:4326 MultiPolygon), plus the `dgac_peb_arrete_wfs` register (224 points, 66 355 B, `numberMatched` 224) cached to `.gev-cache/bruit-fr/`. Keyless, CORS `*`, `<Fees>none</Fees>` + cartes.gouv.fr CGU. **TWO regimes on one route, camera-anchored, on the shared `createAddressScanLayer` shell.** Below 12 000 m, POINT MODE: one probe at the ground point the camera looks at, **scale PINNED at 1e-4°/pixel = 1:39 757** and never derived from the camera, because `dgac_peb_plan_wmsv` stops rendering below ~1:25 000 and then answers HTTP 200 with a 137-byte empty FeatureCollection. Between 12 000 m and 250 000 m, OVERVIEW MODE: the layer adds `km=` to the same request and the proxy answers about the AERODROMES in view instead — one probe each at their own published reference points, at **1e-2°/pixel = 1:3 975 696**, whose GetFeatureInfo buffer is wide enough to return a whole plan rather than the one band the reference point sits in. A PEB is nested rings, so at the fine scale a probe returns zone A and nothing else; measured over 25 aerodromes, 37 distinct bands at 1e-4 against **88 at 1e-2**, and Roissy's zone D and Toussus's zone B return at no finer scale. **That coarse scale is then paid back by a SECOND PASS**, because the same number that widens the `GetFeatureInfo` buffer is what GeoServer generalises the outline to — measured, Roissy's zone C returns 381 vertices at 1:39 757 and 22 at 1:3 975 696, its zone D 664 against 37, so a 65,8 km ring drew with visible facets. The overview probe is therefore demoted to a DISCOVERY pass that only names the bands, and each named band is re-fetched at the probe scale aimed at its own coarse outline — which works because the service does not clip the geometry it returns to the box it was asked through. Seeds are `BRUIT_REFINE_SEEDS` = 6 points spread around the band's own biggest outer ring, each pulled 2 % toward that ring's centroid: measured 2026-09-07 over two disjoint 25-aerodrome slices, **170 of 170 bands recovered**, candidates needed 1→149 2→3 3→9 4→1, 209 fine probes for 170 bands. **That second pass has TWO tempos, and 30 000 m is the boundary.** Above it, it is a BACKGROUND pass — measured cold, the twelve aerodromes around Paris cost 12 probes and ~1,5 s coarse against 85 probes and ~9,5 s refined, so the coarse answer is served at once and the fine geometry lands in the per-aerodrome cache behind it; the refiner yields to any foreground scan rather than competing for the three-concurrent budget. **Below 30 000 m the layer adds `fine=1` and the proxy plays that pass in FRONT of the answer**, nearest aerodrome first, so the frame a reader dezooms to in order to see one airport's plan (≈42 km across at that altitude) is at 1:39 757 on its first paint instead of arriving faceted and redrawing seconds later. The point ceiling is deliberately NOT what moved: a point probe owes its sharpness to an 11 m buffer, and that buffer is exactly why it returns one ring of four — extending POINT MODE to 30 km would have bought a sharp outline by dropping zones B, C and D. The wait is bounded by `BRUIT_FINE_FOREGROUND_BUDGET_MS` = **4 000 ms**, floored by the ~0,8 s one aerodrome costs cold (so the centred aerodrome is always fine on the first paint) and capped under the layer's own 5 s refine poll (so a truncated pass never stacks with the poll behind it); whatever the budget does not reach stays coarse, says so, and is handed back to the background worker. It bounds the SECOND PASS and not the request — the discovery probes run first and are not on that clock. Measured 2026-09-10 at Roissy, radius 25 km, 18 aerodromes and 72 bands, from an empty `zones.json`: **no `fine` 2,66 s and 0 of 72 bands fine; `fine=1` 6,64 s and 27 of 72 fine on the FIRST payload; `fine=1` 0,08 s and 72 of 72 once the background pass has landed** — and on that first fine payload LFPG's own four zones return at 110 / 247 / 381 / 664 vertices, the probe scale's numbers, on the aerodrome the camera is centred on. The foreground pass holds the same gate the refiner yields to, so it never turns three concurrent upstream calls into five, and a pass the BUDGET cut short does not stamp `triedAt` — stamping it would freeze the half-refined plan of the airport under the camera for the 10 min cooldown. The proxy grants `fine` only at the first rung of the radius ladder (≤ 25 km), because at a 50 km radius the screen is ~140 km across, the median band is 1,9 km wide, and 37 vertices against 381 is under a pixel for the same four seconds. Measured end to end over a 100 km radius on Paris: **1 399 vertices at t=0, 9 177 at t+15 s, 12 045 and 94/94 bands refined at t+45 s** — ×8,6. The payload carries `refining` — aerodromes whose pass is queued NOW, not merely coarse, so the count reaches zero and the polling stops even where a band could not be refined at all; an aerodrome whose pass came up short is left alone for 10 min rather than re-probed on every scan. `scheduleBruitRefinePoll` re-asks every 5 s through the shell's new `rescan` hook (the layer's answer improves while its question does not, which neither of the shell's own refetch triggers can see), giving up after 6 polls with no progress because a coarse overview is still complete. **The card never overclaims**: every band carries the scale its own outline was fetched at, a payload reports the COARSEST of them plus `refinedBands`/`coarseBands`, and a mixed draw prints the coarse figure and names how many bands are already better. **The card is written for a reader, not for a cartographer**: the scale is stated as the ground size of one service pixel (*tracé à ~11 m près*, “drawn to within ~11 m”, ~1,1 km in overview) rather than as “1:39 757”; a zone leads with what it means for the ground (*gêne très forte : logements neufs interdits*, “very strong nuisance: new housing forbidden”) and the threshold follows as its evidence; the innermost ring, which the register publishes with its two thresholds equal, prints *70 dB(A) et plus* (“70 dB(A) and above”) rather than a bare “70”; and no card carries the arrêté's PDF URL, because the overlay is a canvas with `interactive: false` where a link is eighty unselectable characters costing two of six rows — the document is named by `arrêté préfectoral du <date> · <OACI>`, which is what the filename is built from. Up to **24 aerodromes** (a complete map to a 75 km radius over Paris, the densest ground in the register), selected nearest-centre-first with a 35 km reach past the radius because a plan is drawn around a point that can be off screen; what the budget drops is counted and said. Overview bands carry `atPoint: false` because nothing was tested against a point, so there is no winner, no runner-up and no dash — the most exposed band of each aerodrome simply takes the strongest wash. Above 250 000 m the layer is dormant with a `zoom-in` GUIDANCE status (never an error). **Every band's interior answers a click** through the shell's `groundCard` hook, re-tested point-in-polygon against the drawn rings and holes: the wash is a polygon, a polygon entity has no position, and without it only the outlines were clickable — measured, a pick on the aerodrome marker's own pixel returns the wash beneath it. `scripts/qa-bruit-overview.mjs` proves the whole boundary in a real scene: one band at 6 km, four at 60 km with no dash among 318 rings and 18 aerodromes drawn at once, a click on a wash opening its band's card, dormancy at 400 km, and the card's printed denominator matching the payload's in whichever refinement state the cache is in. Measured 2026-09-02 over one probe at each of the 224 aerodromes: 215 answer, 9 do not (LFPN/LFPK/LFPT answer at no scale at all), 298 zone rows, features per probe 0→9 1→141 2→67 3→5 4→2, heaviest response 15 041 B / 742 vertices at Le Bourget, whole sweep 473 193 B / 15 619 vertices, so nothing is decimated. Bands are coloured by zone letter (A `#ff2d55` / B `#ff7a1f` / C `#ffcc33` / D `#9fd0ff`), filled as hole-cut ground classification with a stroke on every ring including the interior ones, and painted quietest-last because two classification washes blend. **The stroke carries the band; the wash only marks the answer** (since 2026-09-21): four nested plans washed at 0,22–0,42 laid a tinted sheet over the whole airport — Roissy's zone D alone is a 65,8 km ring — so only the band the rule chose keeps a readable wash and every other band is a tint under the measured floor. Each zone is named by a **badge ON its outer ring** — the app's glass panel as a rounded square, framed in the zone's colour, the code in ivory Inter outlines — because once the wash is a tint, a letter floating between two contours names neither. `bruitBadgeSpots` puts each badge at the point of its ring nearest the reader (the aerodrome's own point in an overview, the scan point under a point scan), most exposed first, and every later badge walks along its ring until it is **750 m** clear (overview; 300 m under a point scan — 30 px at the top of each mode on a 1 440-px window) of every badge and marker already down. The old in-band anchor put Roissy's zone D letter 24 km from the aerodrome, off every frame that shows the airport. A band's widest piece always gets a badge; further pieces only when they are at least half its width, not a duplicate, and clear. **The map key is written for a reader who knows no acronym**, and since 2026-09-24 it is a CARD (the approved mock of « Aéroports »): the airport the view is about, *Bruit & urbanisme* (“Noise & planning”), *Plan d’exposition au bruit · PEB*, then each zone named by how loud it is (*Bruit très fort* … *Bruit plus faible*; the law grades D not at all, so « plus faible » is relative on purpose), each swatch the zone's code cut out of a tile in its colour — the letter the map writes on its badges — then two sentences and a button to the airport's arrêté PDF. What a zone means for a new home is its card, one click away, printed in the key. No count of drawn bands is printed any more: « PEB zone A 14 » placed nothing for a reader. Measured on the real overviews: 90 badges for 72 bands around Roissy and 112 for 94 over Paris at 100 km, placed in ~3 ms; a whole overview redraw costs ~10 ms against ~6 ms before. **The winner is chosen deliberately and named on the card**: only a band containing the point is eligible, then the most exposed zone, then the newest effective arrêté, then the ICAO code, then the feature id — and the card prints *2 zones ici, retenue : la plus exposée* (“2 zones here, kept: the most exposed”) plus the runner-up's own band. Alphas are placed on `urbanismeGpu.js`'s measured ladder, not re-measured (0,28 winner — its "readable" rung / 0,14 also-inside / 0,10 beside, the last two deliberately under its 0,22 floor), and the imported ceiling is enforced at the draw. NOT painted: the noise nuisance plan (*plan de gêne sonore*, PGS, the homes whose soundproofing the aircraft noise tax funds) — drawn beside the PEB in a violet ramp until 2026-09-24 and dropped, so `/api/bruit-fr` probes `dgac_peb_plan_wmsv` alone; any non-aviation noise — there is no CBS on the Géoplateforme (915 layer names, 4 mention bruit) and the per-DDT Géo-IDE archives have no CORS (**re-measured 2026-09-08, and the CORS half is no longer the blocker**: these layers would come through a server proxy, where CORS does not apply. What blocks is the format and the weight — 155 CBS datasets on data.gouv.fr, published per DDT / département / infrastructure / period, four organisations across the first 50 results, WFS advertising **GML only** with `OUTPUTFORMAT=application/json` answering 500-wrapping-400, and `COUNT=1` on Côte-d'Or's rail-noise layer returning **1 080 625 bytes for one band**. So it is a GML parser and a per-DDT collection chantier, not this layer's WMS `GetFeatureInfo` pattern, and national coverage does not exist yet); no PSA (that is obstacle height, not noise); no Bruitparif (licence). NOT converted: indice psophique is never turned into dB | `src/data/bruitFrance.js`, `src/data/bruitFeed.js`, `src/data/bruitArretes.js` | `/api/bruit-fr`, `/api/bruit-fr/index`, `/api/bruit-fr/status` | Camera-driven: 450 ms settle, refetch past 250 m of movement; manager tick 15 min. Proxy: 6 h per ~11 m point in memory (overview centres snapped to a 0,05° grid so panning at altitude hits the cache; an overview's key also carries `fine`/`coarse`, or a complete coarse answer — which reports `refining: 0` and so earns the six-hour shelf life — would be handed to the request that asked to wait for the fine one and hold the facets until it expired), arrêté register 7 d TTL on disk with a 90 d serve-stale and `BRUIT_CACHE_VERSION` 1, **per-aerodrome overview zones 30 d on disk** in `zones.json` at `BRUIT_ZONES_CACHE_VERSION` 2 (an entry now also records whether its outlines have been refined) — measured cold 23 aerodromes / 46 calls (PEB and PGS, before the PGS was dropped) at three concurrent in 0,59 s and 177 KB, warm 11 ms; measured after the second pass, 24 aerodromes served from a restarted process in 59 ms at full fine geometry. An overview still carrying `refining > 0` is cached for **3 s instead of 6 h** and served `Cache-Control: no-store`, because a provisional answer that outlived the refinement it is waiting for would pin the facets for the rest of the day. **The header was the bug that nearly shipped**: the shared route answered every address scan `private, max-age=300`, so measured in a real browser the layer's five-second poll was served entirely from the HTTP cache, not one request reached the server, and the draw stayed at 72 coarse bands for a whole session while the proxy finished all 18 aerodromes in 20 s. `addressCacheControl` now derives the header from the same shelf life as the server cache — `no-store` under a minute, the historical five minutes above it, capped at the server's own TTL. Upstream cadence: the register gained 8 arrêtés in the whole of the 2020s |
| Équipements du quotidien 🇫🇷 🏪 | Insee BPE 2025 (edition discovered via data.gouv `548acaf2c751df1eac4120e7`, floor BPE25, 2,921,770 rows × 95 columns) + FINESS (data.gouv re-exposure `67e43007cd5e91b9fdcbc7b3`, lov2, monthly, extract of 2026-07-02, 103,032 establishments). 126,859 rows kept → **95,406 points** in seven families: doctor 30,215 · food shop 19,354 · pharmacy 19,216 · La Poste 16,832 · gendarmerie/police 3,953 · swimming pool 3,625 · hospital 2,211. Three regimes: **national** (96 departments painted by the SHARE of equipped municipalities — 43.7% of 34,778, from 21.6% in the Gers to 100% in Paris, thresholds 29/43/49/56/69), **mesh** (95,406 tuples `[lat, lon, précision, famille]`, 642 KB gz, thinned from 1,100 to 2,200 points **per family** so that none is crushed — a global sort would keep only 14 hospitals of 2,211 at 1,100 points, the floor keeps 39) and **sites** under 0.32° of span (box ≤ 0.35°; the densest square this ceiling allows in France, at 48.65 N / 2.20 E, holds 9,139 points, 277 KB gz, sent rarest family first so that the display ceiling cuts doctors and never hospitals). NOT drawn: **no school** (79,743 DOM=C rows refused — schools-fr and sup-fr cover them, and the BPE has no UAI column); no charging station (B326, 28,819, a frozen duplicate of irve-fr); no train station or airport (DOM=E, 99,280, of which 96,253 are taxi/ride-hailing addresses); no BPE pharmacy (D307, 20,334, FINESS answers); no BPE emergency department (D106, 695, of which 547 lie within 200 m of a hospital already drawn); **2,182 positions the registers admit they invented** (1,284 *aléatoire dans la commune* (random within the municipality), 898 ADMIN-EXPRESS centroids) and 170 with no coordinate, including the 100 rows of Mayotte. The dot size is NOT a magnitude — no register publishes one — it is a legibility rule, inverse to the national count. | src/data/amenitiesFeed.js, src/data/amenitiesMesh.js, src/data/amenitiesDepartements.js, src/data/amenitiesFrance.js | /api/amenities-fr/departements, /api/amenities-fr/mesh, /api/amenities-fr/sites, /api/amenities-fr/status | poll 6 h; proxy TTL 30 d, serve-stale 120 d, disk cache 37.8 MB (reread cold in 131 ms); BPE upstream yearly, revised monthly, FINESS monthly (cold build 52.9 s, of which 51 s downloading) |
| Accueil du jeune enfant 🇫🇷 🧸 | *Taux de couverture d'accueil du jeune enfant* + *Nombre de places offertes* (data.caf.fr, Cnaf) — seven Opendatasoft datasets, edition **2023**, discovered at build time and floored at 2023. An INDICATOR, not a register: no national list of crèches is published as open data (the measurement is in `petiteEnfanceFeed.js`). **Two regimes, both TERRITORIES — no point anywhere**: 96 département polygons joined by CODE (verified exact — the opposite of the Annuaire, which zero-pads) down to a 0,9° lat span, then the EPCI and commune territories themselves, filled from geo.api.gouv.fr commune contours served by view box. An EPCI has no published contour and is drawn as its member communes under one colour with no internal outline (`codeEpci` rides along with the geometry); below 0,45° the 1 061 published communes are CUT OUT of that wash and filled with their own rate, so no ground carries two numbers. Paris/Lyon/Marseille need a second `type=arrondissement-municipal` request and the arrondissement replaces its parent commune outright. Colour is a RATIO to the national rate (60,9), not a quantile, so it means the same at all three scales; there is no size channel any more and the places count is on the card. Fills are batched one primitive per band colour and the selection is its own pair — a batched `GroundPrimitive` colours by bounding RECTANGLE. Measured payload: 111 KB for a Lyon view (32 KB gzipped), 2,03 MB / 636 KB worst case (1,3° over Île-de-France, 2 261 communes). 6 overseas rows cannot be painted and are all below the national rate; 1 `XX`/`XXX` placeholder row is dropped | `src/data/petiteEnfanceFrance.js`, `src/data/petiteEnfanceFeed.js`, `src/data/petiteEnfanceDepartements.js`, `src/data/communeContours.js` | `/api/petite-enfance-fr/departements`, `/api/petite-enfance-fr/areas`, `/api/petite-enfance-fr/contours?box`, `/api/petite-enfance-fr/status` | 6 h (proxy TTL 7 d, serve-stale 30 d; the Cnaf publishes once a year in January) |
| Médecins 🇫🇷 ✚ | CNAM *Annuaire santé Ameli* — **64,232 practice addresses and 117,922 named doctors**, geocoded at build time against the Base Adresse Nationale because **the register publishes no latitude** (its `coordonnees_*` block is contact details). Three regimes by span: the DREES's *accessibilité potentielle localisée* nationally — a capacity map, not a headcount, because 0.49 % of the population lives beyond 10 km of a GP — then a thinned mesh, then sites. In both close regimes a practice is a tinted plate with its FAMILY of medicine punched out of it (`medecinFamilyIcons.js`: Maki's stethoscope and cross, Temaki's trefoil, Material's adult-and-child, head and scalpel), sized by DISTINCT doctors and riding a distance ramp back down to a coloured speck at mesh altitude. Every mark stands on the GROUND under it — the shared DEM/mesh cell, a rendered-surface probe while that is cold — and is re-placed when a better floor lands: the ellipsoid is 220 m under Lyon and projected 171 px from the street at the median. Practitioner names arrive on the click that wants them, not in the sites payload. **The names are not in git (since 2026-09-22)**: each deployment builds them with a fresh pack into `.gev-cache/medecins-fr/pack/` (`npm run medecins:registry`; weekly on the hosted box, `gev-medecins-refresh.timer`), and the proxy prefers that pair to the repository's name-free `medecins.json.gz`, re-checking it once a minute. Without a build the layer draws every address, count and APL value and its cards say the names are not available on this server. `/praticiens` filters through a suppression list (`GEV_MEDECINS_SUPPRESS`, default `.gev-cache/medecins-fr/suppress.txt`, read again whenever it changes, `no-store`, fails closed) and refuses an index from another pack with 409 | `src/data/medecinsFrance.js`, `src/data/medecinsFrFeed.js`, `src/data/medecinsNames.js` | `/api/medecins-fr/national`, `/api/medecins-fr/mesh`, `/api/medecins-fr/sites`, `/api/medecins-fr/praticiens` | 30 min |
| Mix élec 🇫🇷 ⚡ | éCO2mix national + 12 régions (RTE, via ODRÉ) — région balances as EXTRUDED PRISMS over the bundled département geometry grouped into 12 regions: height = |MW| on a frozen linear domain of 12 000 MW ↔ 120 km (highest observed 7 781; the margin is deliberate — AURA carries ~13.5 GW of nuclear against ~6.5 GW of load), colour = the SIGN of the exchange in two flat hues plus a slate 'balanced' class for the dead band. BOTH prisms rise: a downward one is verifiably unimplementable (`Globe.translucency.enabled` is false by default and is a SCENE property no layer owns; on the photoreal stack the globe is hidden anyway), and a signed bar chart only works because its zero line is straight — here the datum is a sphere. Corsica is a HATCHED flat footprint, never a zero-height prism. Five commercial border flows as arcs | `src/data/franceEnergy.js` | `/api/energy-fr` | 3 min (proxy TTL 4 min; product steps every 15 min) |
| Réseau gaz 🇫🇷 ⬡ | NaTran + Teréga transmission traces (36,106 km, clamped ground polylines), 14 gas-fired power stations, 850 renewable-methane injection points (ODRÉ) | `src/data/gasFrance.js`, `src/data/gasFranceFeed.js` | `/api/gas-fr/network`, `/api/gas-fr/sites`, `/api/gas-fr/status` | 30 min (proxy TTL 7 d for the traces, 12 h for the registers; both are quasi-static) |
| Centrales EDF 🇫🇷 ◈ | EDF Open Data — 3 datasets (nuclear 56 reactors → 18 sites, hydraulic 51 plants, thermal 19 units → 10 sites), 79 site marks sized by installed capacity and shaped by filière (a cooling tower / drop / flame punched out of a tinted plate — above 20 px; the 53 smaller marks keep the plate whole), named by rank of installed power as the camera comes down, filterable by filière then by published category (and the label drops the category the lit chip already says) | `src/data/edfPowerPlants.js` | `/api/edf-plants` | 30 min (proxy TTL 24 h; the files are republished annually) |
| Power Grid ⌁ | OpenStreetMap `power=line`/`cable`/`substation`/`tower` at ≥ 50 kV: all of France from the pre-built national pack at any altitude (≥ 180 kV above 600 km, every band below), then per viewport under 120 km, the viewport answer hiding the national ways it redraws (batched `GroundPolylinePrimitive` strokes by voltage band, dashed underground). Under the Noir preset (the night atlas, `src/styles/nightAtlas.js`) the bands wear a NIGHT DRESS — ivory 400 kV, orange 225 kV, steel-blue 150 kV, slate 63/90 kV, each on a halo of its own colour instead of the dark casing — rebuilt from the geometry in hand when the preset changes. The key is in plain words since 2026-09-21: one row per band named in words with one sentence and no count, and a note that says only that dashes are underground, that an all-underground view has no pylons, where the lines come from and (national pack) that zooming in brings the exact route | `src/data/powerGrid.js`, `src/data/powerGridFeed.js`, `src/data/powerGridNational.js` | static `local_data/power_grid_fr/national.json` + `/api/power-grid` | pack once per session (content-hashed, immutable); viewport-driven (500 ms debounce, ≤ 0.8° box, pylons ≤ 0.25°) + 20 min idle; proxy TTL 10 min memory / 7 d disk; while failing, auto-retry 20 s → 240 s backoff |
| Vigicrues 🇫🇷 ≋ | SCHAPI's own keyless GeoJSON — every monitored *tronçon de vigilance crues* (337 reaches) with the state's 24 h 4-level risk colour. The State's READING of flood risk; Hub'Eau below carries the raw measurement behind it | `src/data/vigicrues.js`, `src/data/vigicruesFeed.js` | `/api/vigicrues`, `/api/vigicrues/geometry` | 5 min |
| Hub'Eau Gauges 🇫🇷 ◉ | Hub'Eau *API Hydrométrie* v2 (PHyC / Vigicrues, mesures DREAL) — up to ~4,000 gauging stations, sized by discharge, with the raw number on the label. **Q is in litres per second and H in millimetres** in the API, converted once at the projection so no card can print a river at 240,000 of anything | `src/data/hubeauHydrometry.js` | `hubeau.eaufrance.fr/api/v2/hydrometrie/*` (keyless, direct) | 3 min |
| Vigilance MF 🇫🇷 ⚠ | Météo-France *Vigilance météorologique* — 9 phenomena assessed twice a day per département and published as a 4-colour level; only raised départements are painted. Served from Météo-France's own data.gouv.fr mirror unless `METEOFRANCE_API_KEY` is set, in which case the contracted API is preferred and the mirror stays the fallback | `src/data/meteoFranceVigilance.js`, `src/data/meteoFranceVigilanceFeed.js` | `/api/vigilance` (keyless mirror; `METEOFRANCE_API_KEY` optional) | 5 min (proxy TTL 5 min) |
| Stations météo 🇫🇷 🌡 | The **190 French stations that publish their readings in the open**, out of Météo-France's 2,144-station real-time network. The pack bundles all 2,144 (`local_data/meteo_stations_fr/stations.json`, joined at build time to the publisher's 191 MB per-parameter inventory); `SHOW_ONLY_PUBLISHING` draws the ones a click can answer and `getStats()` names the **1,954 withheld behind the Météo-France key** — the access request that would open them is in #195. Colour is what each station CAN measure, which across the drawn set is nearly uniform (182 complete synoptic stations) and across the network is not (1,254 of 2,144 measure only temperature and rain). A click fetches the newest observation plus the station's records. The keyless product is a DAILY consolidation of three-hourly observations, so a reading is **11 to 35 hours old** and the card prints its own timestamp | `src/data/meteoStationsFrance.js`, `src/data/meteoStationsFrFeed.js` | `/api/meteo-stations/observations`, `/api/meteo-stations/normals`, `/api/meteo-stations/status` (keyless, lazy) | 30 min (pack); observations 6 h proxy TTL |
| Bâti 3D 🇫🇷 ▤ | IGN BD TOPO® `batiment`, Géoplateforme vector tiles at z15, per viewport — extruded volumes coloured by `usage_1`, seated on their own NGF-IGN69 altitudes (h = H + N), re-anchored by a per-~1.1 km-cell median of the rendered surface measured UNDER EACH BUILDING (`globe.getHeight`), each volume then reaching down to the lowest ground under its footprint. **Since 2026-09-03 it is also the thematic support for the address layers** (`src/data/buildingTheme.js`): a layer registers a theme, the volumes are painted by it, and this layer's legend and stats are replaced by the theme's ramp. Precedence 10 `dpe-fr` < 20 `dvf-sales` < 30 `ads-fr`; smallest footprint wins a point that falls in several; ties broken by id, so tile order can never move a diagnostic from one volume to another. A PAINTED volume takes the theme colour FLAT — the height shading is switched off, otherwise a tall D and a short C land on the same pixel value; an UNJOINED volume keeps the height shading on a WASHED version of its usage tint (s×0.15 / l×0.42 in HSL, ΔE76 ≥ 36.5 against all three target palettes) so it is graphically distinguishable rather than merely absent (A1). Two separate A5 counters travel with the paint: points geocoded but on no loaded footprint, and points with no coordinate at all — `Number(null)` being 0, an empty-longitude row would otherwise sail off Ghana and be counted as “missed a building”. The coupling is one-way: `bdtopoBuildings` subscribes in `init()` and unsubscribes in `destroy()`, so a theme layer only ever calls `registerBuildingTheme` / `clearBuildingTheme` | `src/data/bdtopoBuildings.js`, `src/data/bdtopoBuildingsFeed.js`, `src/data/buildingTheme.js` | none — keyless, CORS-open, `max-age` 21 d, straight from `data.geopf.fr/tms` | viewport-driven (450 ms debounce, ≤ 0.08° box, ≤ 64 tiles, ≤ 14,000 volumes) + 30 min idle; one re-seat 3 s after a load where the terrain was not yet resident under every building |
| Pouls vélo 🇫🇷 ◷ | A typical week of cycling in Lyon and Paris, bundled as `local_data/velo_pulse/pulse.json` — 168 numbers per site, averaged over four weeks of June 2026, read in LOCAL wall-clock hours in both cities. **Two instruments, never one scale**: Lyon is Vélo'v dock occupancy (a STOCK, 450 stations) because the Métropole publishes an availability archive since 2023-03-27; Paris is permanent bike counters (a FLOW, 111 sites) because **no Vélib' availability archive exists anywhere public**. Drawn as a **field of soft ground-clamped blobs, one per station** — a proportional symbol, not a kernel-density heatmap, which is what leaves each station clickable (CARTOGRAPHY G4) — and no longer as 561 extruded squares. Colour is the site's share of its OWN weekly maximum on a five-band ramp **monotone in CIE L\*** and warm at the busy end (93 · 80 · 63 · 45 · 27 — pale where a station is idle, deep carmine at its weekly maximum; ≥ 6.3 L\* apart composited over the backdrops it lands on, ΔE 24 from the map at the busy end and ΔE 19 from the two other magnitude ramps drawn over the same streets; `veloPulseRamp.test.mjs` recomputes the chain — alpha included, read out of `veloPulse.js` — and fails on any inversion, any band that stops separating, and a busiest band that stops being visible), interpolated between the bands; the blob's AREA is the absolute quantity in that city's own unit, **sized in metres with no distance inflation** (B2), so it fades out between 40 and 90 km rather than pretending to be readable — Cesium's fade works on SQUARED distances with a pow(t, 0.2) curve, which puts it at 42 % opacity by 45 km, so that is where the panel and the row say *descendez sous 45 km* (“go below 45 km”, F6). Fill alpha is a flat **0.45** — it stopped being a second encoding of the value (A3), and the basemap keeps 55 % of itself under every blob. Three modes — the current hour of the week, the 168-hour animation, and the network's busiest hour — plus a **panel under the globe** (`veloPulseHud.js`) carrying the hour in words, what the network is doing at it, the week as a 168-bar strip that is also the transport (click/drag/arrows to scrub, which pauses), and the clicked site's fiche with its own week in the map's colours. The panel is **draggable** anywhere in the viewport and remembers where it was left (`src/panelDrag.js`, shared with `ui.js`); double-clicking its header brings it home | `src/data/veloPulse.js`, `src/data/veloPulseFeed.js`, `src/data/veloPulseHud.js`, `src/panelDrag.js` | — (bundled; `npm run velo:pulse` rebuilds) | static; the animation eases between the hours at 520 ms per hour, a whole week in about 87 s |
| Carroyage INSEE 🇫🇷 ▩ | **Four regimes on one row.** Above a 12° box: one screen-space disc per **RÉGION**; from 12° down to the grid's 0.9° ceiling: one per **DÉPARTEMENT** — both from INSEE's **Melodi** API (`DS_FILOSOFI_CC` 2023 + `DS_POPULATIONS_REFERENCE` 2023 + `DS_BTS_SAL_EQTP_SEX_AGE` 2024, keyless, 97 codes in one URL, month-long proxy cache), anchored on a bundled 16.8 KB point pack (`france_territoires/territoires.json`, built from the IGN outlines + API Géo). Six indicators there, two of which the grid cannot compute at all (Gini, D9/D1), on their own measured bands — the grid's ramp spans 15 300–32 400 € and every département sits inside a 10 000 € window, so borrowing it would paint the country in two bands. It is a DIFFERENT dataset and every card says so: a median where the grid has a mean, people where it has households, 2023 where the relay is 2019. The layer therefore has **no `ensureViewGate`** — it no longer needs the camera moved for it. Below 0.9°: INSEE *Filosofi* gridded income and population — **from a local 2021 pack when one is built (`npm run filosofi:pack-2021`), otherwise the Géoplateforme WFS relay, which is still on 2019**. The millésime travels with every answer and is printed on every card, never assumed: INSEE published 2021 on 2026-02-12 and the relay has not moved (2 314 836 cells served against 2 324 577 documented for 2021). The pack holds **2 324 577 cells — INSEE's published total for 2021 exactly** — across all three grids INSEE publishes on: métropole `CRS3035`, Martinique `CRS5490`, La Réunion `CRS2975`. Reading those two took adding an inverse UTM alongside the LAEA one, and fixed a bug the layer had shipped with: **both overseas départements were declared as coverage and drew nothing**, because `parseCellId` accepted `CRS3035` alone — a Réunion box matched 2 502 cells and drew 0. The inverse is checked against the WFS's own geometry: 0.78 mm worst error over La Réunion, 0.50 mm over Martinique. Relayed as WFS by the Géoplateforme — **2,314,836 carreaux at 200 m and 377,234 at 1 km**, per viewport, drawn as **flat translucent proportional discs, one per cell**. **No geometry is transported**: each cell is rebuilt from its own INSPIRE identifier by inverting EPSG:3035, which reproduces the published polygon to eight decimals and cuts a Lyon viewport from 1.63 MB to 0.31 MB. Colour is one of eight indicators on absolute national quantile bands; the disc's AREA is the count each indicator is computed on (`ind` or `men`), never the indicator, in **six national size classes** — the measured population quantiles, per grid (`build-filosofi-ramp.mjs --resolution 1000` added the coarse set: 6 727 cells, p90 at 28 652 people). Classed and not proportional because the drawable range is 3:1 in diameter against 100:1 in the data: proportional put 65 % of a Gironde viewport's 1 907 coarse cells on the floor. **A symbol is capped at 0.68 of the cell side — 36 % of its area — and drawn at α 0.7, so the basemap is readable between the discs and through them**; the extruded blocks it replaced covered every cell edge to edge. Imputed cells are drawn as a ring, grown to keep the area the hole costs it. The two grids disagree about their own column names — `i_car_est` at 200 m, `i_est_1km` at 1 km, and no commune at all on the coarse one. **Since 2026-10-01 the levels fade instead of swapping** (see *Fade on zoom* below): the 1 km grid into the 200 m one between 0.12 and 0.07 on `max(lat, 0.66 × lon)` — both grids are fetched inside that band, the 200 m one only where `resolutionForBox` already allowed it — and the régions into the départements between 12° and 7.2°; the départements ↔ grid change and the `population` indicator stay cuts, without a blank frame | `src/data/filosofiCarreaux.js`, `src/data/filosofiFeed.js`, `src/data/zoomFade.js` | `/api/filosofi/carreaux`, `/api/filosofi/status` (keyless, 30 d disk cache, serve-stale) | viewport-driven (450 ms debounce, ≤ 0.9° box, ≤ 6,000 cells) + 60 min idle |
| Parcelles 🇫🇷 ▦ | IGN Api Carto `cadastre/parcelle` (PCI vecteur, DGFiP), per viewport — ground-clamped classification fills coloured by the SCALE of the `feuille` each parcel was drawn on (four bands from 1:250/1:500 to 1:4000/1:5000, joined on a FIVE-part key incl. `code_arr`), batched ONE `GroundPrimitive` PER BAND COLOUR — a batch mixing colours has each instance repaint its neighbours inside its own bounding rectangle, which is Cesium's classification shader, not a bug here — with the selected parcel drawn as its OWN PAIR of primitives, fill and outline, over the batch (`scripts/qa-cadastre-highlight.mjs` proves the highlight against the polygon on pixels), plus a `GroundPolylinePrimitive` outline per ring. Reports the fraction of the view that is cadastred at all — the rest is public domain. A box over Api Carto's own 5,000-feature ceiling is REFUSED whole (the truncation is scattered, not cropped, so a short draw is indistinguishable from the public-domain gaps) | `src/data/cadastreParcels.js`, `src/data/cadastreFeed.js` | `/api/cadastre-fr/parcelles`, `/api/cadastre-fr/status` | viewport-driven (450 ms debounce, gated on camera ALTITUDE ≤ 1 500 m — not on the view rectangle's span, which on a tilted camera reaches the horizon — and requesting a ≤ 0.02° box anchored on the screen-centre ground point, clipped to the view, 0.002° cache snap) + 60 min idle; proxy TTL 24 h memory + `.gev-cache/cadastre/`, serve-stale 30 d; the PCI is republished monthly |
| Production des centrales 🇫🇷 ☢ | RTE `actual_generations_per_unit` (171 units ≥ 100 MW, hourly) joined by EIC code to ODRÉ's *Registre national des installations de production et de stockage d'électricité*, shipped as a file (positions anchored on EDF Open Data, then OpenStreetMap, then commune centres); 108 stations drawn as a capacity ring plus an output disc — and, between 70 and 800 km of camera altitude, IN RELIEF: a translucent cage as tall as the installed power around a solid column as tall as the output, one fixed scale of 10 m per MW, the filière's mark from `plantFiliereIcons.js` on top (nuclear: Temaki's cooling tower with the punched trefoil), the label on the mark without the kind of plant (`rteShortName`). Faint empty cage = unmeasured, crisp empty cage = stopped, pink column = drawing from the grid. Three batched primitives built synchronously with the stations; the switch fires `gev:layer-draw-changed` so the key follows. The key (plain words since 2026-09-21) reads how to read a station and lists only the filières on screen. Renamed from *Groupes de production* on 2026-09-21 | `src/data/rteGeneration.js`, `src/data/rteGenerationFeed.js`, `src/data/local_data/rte_production_units/units.json` | `/api/rte-generation`, `/api/rte-generation/status` | 3 min (proxy TTL 60 min — RTE's user guide advises one call an hour, and the resource publishes hourly). Needs `RTE_CLIENT_ID`/`RTE_CLIENT_SECRET` for output; the fleet draws keyless |
| Centrales hydro 🇫🇷 ≈ | ODRÉ *Registre national des installations de production et de stockage d'électricité*, hydraulic filière entire — **2,742 installations for 26.02 GW**, shipped as a file because the register publishes NO coordinate, only an INSEE code. 998 placed where they physically are (589 on an IGN BD TOPO® building footprint), the other 1,744 rolled into 1,147 commune rings that claim a count and never a position. Renamed from *Petite hydro (FR)* on 2026-09-14: it holds Grand-Maison (1 690 MW), so nothing about it was small. It also draws **592 stations outside France** that used to ship inside the dams pack as barrages — a SAMPLE, with its own colour, its own legend row and its own four-line card all saying so | `src/data/frHydroPlants.js`, `src/data/frHydroFeed.js`, `local_data/world_hydro/` | — (bundled; `npm run hydro:registry` + `npm run hydro:world` rebuild) | 30 min |
| Datacenters ▣ | OSM extract (bundled, 4 351 objects) — the footprint is drawn where it is, in WORLD METRES, and the anchor dot drops from 10 px to 6 px so size stops being the channel. Four marks, measured on the pack: extruded volume 461 (10.6 %), flat slab 2 739 (63.0 % — the A1 sign for “footprint known, height unknown”), site outline 317 (7.3 %), hollow ring with no footprint 834 (19.2 %). Height is read from `height` first (154 objects) then converted from `building:levels` (374) by a MEASURED factor: the 59 objects carrying both give a median 5.0 m per level (p25 4.0, p75 6.7) — a data hall, not an office floor. A site outline is NEVER extruded, even where a mapper put a height on it (5 cases) | `src/data/localLayers.js`, `src/data/datacentersPack.js`, `src/data/localGeojson.js` | — | static |
| Barrages & digues ▰ | OSM via Overpass for France + a 69-feature OpenInfraMap tail elsewhere (bundled, **6 840 features**) — `height` is MEASURED at 143 of 6 840 (2.09 %) and therefore REFUSED, with the refusal locked by an assertion. The size channel carries `spanM` instead, the longest dimension measured on the geometry at build time, present on 5 328 (77.89 %), 25 m → 6 399 m (median 100, p95 539), in CONSTANT SCREEN PIXELS — four frozen span classes (100/300/1 000 m) at 18/13/9/6 px plus a hollow 8 px ring for the 1 512 unmeasured (22.1 %). **The row was renamed and simplified on 2026-09-14**: 1 267 of its French features are digues, so the name says so; the 592 hydroelectric stations its world half held moved to `world_hydro/` and the *Centrales hydro* layer; and the second chip row (TOUS/NOMMÉS/GRANDS) was deleted, because GRANDS kept 494 features of which only 65 carry a height — it was a hydro filter wearing a size label. Thinning is the zoom's job now, via a per-tier `markerMaxDistance` (900 km / 3 000 km / orbit). One chip row left: TOUS / BARRAGES / DIGUES | `src/data/localLayers.js`, `src/data/damsPack.js`, `src/data/localGeojson.js` | — | static |
| Submarine Cables ◠ | TeleGeography public map (in the checkout, served by the server; withheld where `GEV_NONCOMMERCIAL_SOURCES=off`) | `src/data/telegeographySubmarineCables.js` | `/api/submarine-cables` | static |
| Incendies — Détections récentes ▲ | NASA FIRMS live (VIIRS ×3 NRT, trailing 24h) | `src/data/firmsHeatmap.js` | `/api/firms` (`FIRMS_MAP_KEY`) | 10 min (proxy TTL 30 min) |
| Incendies — Grands incendies (Gironde · été 2026) 🜂 | Frozen pack: Copernicus EMS EMSR899, EFFIS, 9 524 FIRMS detections, and `bands.json` (three day-of-burning rings) | `src/data/girondeMegafire.js`, `megafireClock.js`, `megafireTimeline.js` | none (bundled) | static |

`src/data/militaryAwareness.js` remains registered internally as the Contacts
coordinator, but it is not a user-visible Data Layers entry. Its visible entry
point is the right-side `CONTEXT` chooser's `CONTACTS` mode.

At global scale, ambient Radio cluster badges are hard-opacity shared-host
entries: count/category updates and identity replacement do not run keyhole or
enter/exit ramps. Shared collision, viewport rejection, allocation, and horizon
culling can still remove an invalid placement, and Cesium still owns the cluster
point geometry and picks. Their 50,000 km line-of-sight range covers the
supported full-globe camera above 24,000 km, including farther horizon clusters.
Unclustered visible stations publish nearest-first ambient labels through that
same host, capped at 16 labels globally, 32 at intermediate zoom, and 48 nearby;
cluster and singleton candidates still share the Radio source's 64-entry ambient
cohort. Cesium continues to own each 13 px station point, horizon visibility,
and direct/nearby picking. Native points and shared-host text use one 50,000 km
interaction limit, so a painted singleton or cluster label always retains a
pickable point at its anchor throughout the supported high-global view. No
Radio entity uses native Cesium label text.

Delivery constraint: PR #10 is stack-only and unsafe standalone. PR #11 owns
the required Radio lifecycle/authority repair, so PR #10 must not merge or ship
unless PR #11 is included in the delivered stack.
Selected and singleton globe labels use the same compact 30-character
presentation: a credible explicit or leading-decimal frequency is rendered
first (`93.9 FM — Station`), otherwise the station name is ellipsized. Full
upstream names remain unchanged in the directory, player, and search state.
Fresh Radio sessions open on All stations while enable and restoration remain
silent. Directory refreshes retain cluster overlay identity for unchanged
represented membership and discard only identities containing removed stations.
When the user explicitly clicks Enable inside the expanded Radio section, the
Context panel performs one internal post-render scroll to reveal the station
filter and primary transport together without moving keyboard focus, the page,
or the globe. Compact controls, voice/tools, restoration, Data Layers, and
programmatic activation do not trigger this reveal.

Radio directory admission is atomic on both sides of the proxy boundary. A
refresh is healthy only when it reaches the minimum accepted-query and station
coverage; schema-valid responses with zero normalized stations count as failed
queries rather than inflating refresh health. Each specialist query also needs
an accepted station whose normalized tags match that requested category; rows
tagged only for another category remain usable catalog data but do not earn
specialist health credit. A partial cold result remains
usable but is explicitly `DEGRADED` and has no accepted catalog generation, while a
partial or malformed refresh cannot replace a warm catalog. The client likewise
rejects stale/future freshness metadata, incomplete rows, and empty catalogs as
a whole, preserving its last usable stations with `STALE`/`DEGRADED` state.
Every healthy admission publishes a monotonically increasing generation scoped
to a restart-stable `catalogInstance` token (a new server process starts a
fresh sequence — never read as a repeat or a regression) with a deeply
immutable station snapshot; stale/degraded warm responses retain the same
generation so tuner and cluster consumers can preserve exact station identity.
Generation semantics assume the app's actual single-process dev-server
deployment; concurrent replicas behind one origin are out of scope.
The client snapshot contains only the normalized station-field allowlist,
preserves object identity for an idempotent repeat of the same generation, and
degrades without replacement if a fresh response presents an older generation.
Snapshot records mark community metadata as untrusted, and Radio tool results
omit station names so directory text never becomes model instruction context.
One bounded country parser maps recognized ISO codes and English/common names
through proxy metadata and final station selection, while malformed, non-ISO,
control-containing, and oversized inputs fail closed. Literal or resolved
non-global IPv4/IPv6 targets are refused. Destroy fully releases the Radio audio
session, voice ducking/restoration, request state, filter, selection, volume,
accepted snapshot, and feed telemetry before re-initialization; monotonic
ownership tokens plus the session boundary keep late callbacks from a retired
session inert.
A tuner drag resolves previews against the single accepted snapshot captured at
pointer-down, even while a newer catalog is admitted. Release starts playback
only when the current same-ID record still exactly matches the frozen
presentation and stream metadata; removal or replacement reports the channel as
unavailable and never silently retargets the drag. A cold degraded fallback may
still populate the directory and globe, but its null accepted generation cannot
populate or begin the tuner.

Context entry and exit consider both rejected lifecycle promises and resolved
`false` manager results to be transaction failures. Entry awaits isolation and
restores the exact prior layer snapshot when isolation or activation fails;
when a direct Context shell fails after lifecycle work starts, reconciliation
waits outside the manager notification until that shell's queue settles, then
restores the complete snapshot rather than treating the in-flight layer as an
exclusion. An uncertain shell is retried and incomplete cleanup retains the
snapshot for a later restore. Direct-shell isolation and its compensating
rollback share one operation-scoped notification token, so an inner lifecycle
failure cannot announce separately from the outer blocked action. Context exit
waits for every sibling transition, retains the exact pending snapshot
after failed compensation, and can retry it later instead of silently reporting
a partial restore. User-facing Context chooser, direct Data Layer shell,
mapped-installation Search, rollback/exit, and Radio chip routes settle those
failures through the existing toast surface, release busy controls, and avoid
unhandled promises. A wrapped operation owns exactly one failure or blocked
notification; its synchronous manager event is suppressed only for that
operation, while unwrapped lifecycle failures retain the manager-level fallback.
The toast is a polite atomic status announcement.
When no tracked entity owns the follow camera, Radio Previous/Next and tuner
previews rotate to the requested broadcaster without changing zoom. A local
view whose optical center remains safely over the Earth, or a full globe already
contained in the viewport keyhole, uses one direct station flight and preserves
its initiating view angle. If a fit-capable Earth disc is clipped/off-center, or
a closer oblique view leaves the viewport center outside the Earth disc, Radio
first animates a centered north-up nadir composition, then focuses the latest
station from that canonical frame. Closer views keep their initiating altitude;
an extreme zoom-out is capped at 13,000 km so recovery returns to a useful
whole-globe scale instead of preserving an empty-space view. The two-stage navigation has one generation:
a playback fallback retargets it to the broadcaster that will play, while a newer
Radio action—including direct globe or non-moving voice selection—supersedes
older callbacks, and layer disable/destroy invalidates
the pending stages. While Flights, Military Flights, or any other
`viewer.trackedEntity` is active, Previous/Next and tuner previews continue to
change station and playback without cancelling or flying the camera. Tracking
acquired between the recenter and focus stages suppresses the later stage, and
a delayed fallback rechecks the same live ownership. Voice Radio navigation
remains non-moving; explicit station focus remains a separate user-requested
route and also yields to a live tracked entity.
The Radio tuner exposes the complete current filtered directory, up to 750
stations, in stable catalog and filter order. Needle progress is absolute across
that directory: the left, center, and right of the control resolve to the first,
middle, and last available station. Every position snaps to a real station, so
there are no selectable static gaps. During a drag, the bounded virtual tape
moves left as the needle moves right and travels faster than the needle without
creating DOM nodes for the complete directory. Camera movement never re-ranks or
rebuilds this order. Tuner-owned preview flights remain monotonic on the captured
strip, and release commits the frozen station before selection and playback
settle. That exact release clears older fallback ownership, so a broadcaster
failure cannot silently play a station left over from an earlier non-playing
cycle; the failed target retains its static/error handoff until Stop or another
explicit choice. Pointer cancellation instead cancels the active preview flight and
restores the exact pre-drag station ordering, absolute position, and frozen
presentation-only marker without starting a replacement camera flight,
committing, or autoplaying. That marker is restored even when an
accepted concurrent catalog removes the station or replaces its metadata, but
it never becomes current playback authority. The next accepted healthy catalog
refresh clears that presentation-only marker, including when the accepted
generation repeats and the immutable directory snapshot is intentionally kept
by identity. Every accepted filter action also clears and rebuilds the marker,
including a request for the already-active filter; a lifecycle-rejected filter
event leaves the restored marker and tuner band untouched. An accepted filter
action synchronously rebuilds the complete navigation pool after the layer state
notification, so Previous/Next and the tuner cannot observe an empty interim
directory. This restoration
also holds at either directory endpoint. Previous/Next traverses the same stable
pool and updates the absolute tuner position.
Cluster refresh identity follows the prior cluster contributing the greatest
absolute number of stations to the new cluster. This preserves majority identity
during merges instead of allowing a fully retained minority to win; deterministic
similarity and stable-ID tie breakers cover equal contributors and splits.
Every positive overlap participates in greatest-contributor discovery, so ratio
thresholds cannot discard a diffuse or one-station maximum. Inheritance is
bilateral mutual-best: a current cluster accepts only a greatest contributor and
a prior identity transfers only to a strongest split child. If that identity is
already claimed by an equal or stronger child, the later cluster receives fresh
identity instead of falling through to a historical minority. Disjoint clusters
also receive fresh identity; sequential fresh IDs are allocated in canonical
membership/station order so input permutations do not rename them.

Voice interprets “turn on/start the radio” as Radio Play, including when it is
combined with a camera action. Explicit “show/enable the Radio layer/markers”
remains a silent layer-only action and does not close the voice session.

Successful explicit user playback from Play/Resume, Previous/Next, the tuner,
or a globe station closes an active voice session only after Radio reaches
`playing`; a failed stream leaves voice active.
An interrupted or superseded voice turn aborts pending Radio location resolution
before it can enable the layer or select a station. Radio enable and disable are
abort-aware manager transactions: cancellation restores the authoritative
pre-transaction state only when the compensating lifecycle call succeeds and
emits no settled explicit-intent event for Context persistence. Failed
activation and teardown expose explicit `enabling` and `disabling` lifecycle
states while the manager retains the last authoritative visibility. The public
lifecycle vocabulary is `enabling`, `enabled`, `disabling`, and `disabled`, plus
a separate uncertainty bit. Radio controls present that phase and remain
non-interactive until the lifecycle is certain `enabled`; only a successful
transaction publishes the new `enabled` or `disabled` settlement. Radio's data
layer state, player message, compact status, launch controls, and generic Data
Layers row explicitly show `UNCERTAIN` when cleanup cannot establish authority;
their accessible labels name the uncertainty while Enable/Disable remains
available to reconcile it.
The Radio source, shared overlays, selected marker, and pick handler use the same
manager-owned presentation gate:
they remain hidden and inert throughout enabling, disabling, cancellation,
failure, and uncertain reconciliation, and activate only for certain `enabled`.
The same gate rejects direct station selection, Previous/Next cycling and its
camera/fallback preparation, tuner-static and category-filter mutation, volume
mutation, and every non-Pause playback toggle before fallback, selection, or
audio state changes. Voice volume and station-starting actions require a fresh
manager lifecycle read.
Every returned `control_radio` result, including status, failure,
cancellation, and a missing Radio module, exposes that same authoritative
`lifecycleState` plus `lifecycleUncertain`; the manager lifecycle record takes
precedence over the stable enabled fallback. Status only reads this state and
does not enqueue lifecycle or player work.
Generic `set_layer_visibility` results expose the same atomic `enabled`,
`lifecycleState`, and `lifecycleUncertain` summary for Radio on success,
fulfilled-false failure, rejection, cancellation, reversal, and missing-module
outcomes. Realtime suppression and settlement refresh all three fields together,
so dedicated and generic Radio routes cannot publish mixed lifecycle snapshots.
`disabled` is inert, while a transitional or uncertain shell is reconciled
through the manager and may proceed only after a fresh read confirms certain
`enabled`; false, rejection, or cancellation preserves the prior player state.
The existing immediate Stop/Pause authority is unchanged.
Cancelled-disable compensation reports failure and records whether lifecycle
state remains uncertain. Any same-target request made while state is uncertain
performs the real lifecycle work instead of taking the stable-state no-op, then
clears that reconciliation debt only after a confirmed enable or disable. A module-local
`AbortError` is a cancellation even while the caller signal remains live, while
that settled transaction releases its abort listener so the old caller cannot
disable a later successful retry. A resolved `false` from init, enable, first
update, or disable is a lifecycle
failure. Unrelated sibling tools remain independent, while each Radio control
captures the current playback-handoff epoch. A later Radio
Pause or Stop provisionally freezes prepared or already-started playback
handoff work without aborting active Select/Play auto-enable or an independent
explicit dedicated or generic Radio visibility ON. After semantic success it
cancels the active Select/Play lane and clears the frozen handoff. Semantic
failure leaves active work live and releases and resumes the frozen handoff.
Disable and generic OFF own visibility as well as playback and may cancel both.
These controls commit their authority only after semantic success, so a failed
stronger control cannot suppress a valid completed sibling. Pause uses the
production player's synchronous boolean contract; Stop and Disable additionally
handle their awaited failure paths. The control's function output is sent before a failed reservation releases,
so resumed playback cannot close the voice channel before the failure is
reported. Resumed handoffs own their attempt-scoped cleanup, so a stale predecessor
cannot clear the successor's in-flight result or block a later failed
reservation from resuming it again.
Generic `set_layer_visibility` Radio disable participates in the same ownership
domain as dedicated Radio controls, so an older Select cannot reverse it. Direct OFF
from either Radio control or the Data Layers row publishes intent before joining
the lifecycle queue and aborts in-flight voice work before an intermediate ON
event can settle. Every absolute manager visibility request also advances a
per-layer intent epoch and aborts the older absolute lifecycle transaction,
including a same-target request whose newer origin must own persistence. An
obsolete queued request never starts; obsolete in-flight cleanup keeps
presentation transitional and hidden, and only the latest request may adopt or
reconcile that state and publish settled visibility. The epoch is rechecked
after synchronous lifecycle-presentation callbacks, so a re-entrant newer
request prevents the older transaction from arming a timer or publishing a
settled visibility event. Superseding an uncertain same-target retry also keeps
the last authoritative enabled boolean until cleanup confirms the real module
state. Direct OFF also freezes
prepared or already-started playback handoff
until the manager queue settles; confirmed OFF discards that handoff, while a
failed OFF releases the reservation and resumes the valid prepared result. A
successful Stop cancels stale Radio work across older response ids as well as
its own response. If a Radio action has already completed its station mutation
before the later control succeeds, only its playback handoff is suppressed; its
result reads enabled state from the manager and audio state from the Radio
module. Voice Pause is a playback-only no-op while the layer is disabled; it
never enables Radio and reports a fulfilled-false pause as failure. A
newer-response or user-origin Stop still cancels stale handoff work.
Only a newer user turn or session teardown aborts the complete active-tool set.
A cancelled turn cannot publish a late Radio playback request. Dedicated Radio
controls and generic layer-visibility commands both forward cancellation.
Each explicit Radio play attempt owns one active audio element; replacement
retires the prior element, making its queued callbacks inert. Pause retires the
current stream and fallback attempt, so delayed callbacks from a replaced or
paused stream cannot change current state or start another station.
Pause and Stop settle attempt ownership and authoritative audio state before
synchronous playback-control observers run, so reentrant voice cleanup cannot
overwrite a released stream with a stale paused state. Layer
destruction likewise retains an enabled manager entry when module disable or
destroy fails semantically, preventing an active orphan and allowing retry.
When Context is collapsed, explicitly activating its Radio header icon reveals
the compact transport; hover and focus alone do not open it. When Context is
expanded, the icon instead expands and scrolls to the embedded Radio section.
Its accessible label, controlled region, and expanded state keep describing the
current route throughout enabling, enabled, disabling, and uncertain lifecycle
renders. Both routes preserve Radio power, playback, station, filter, and volume
state.

Bundled datasets live in `src/data/local_data/` with per-folder provenance READMEs; they are lazily loaded via `src/data/localGeojson.js` (Vite `?url` assets) when toggled on.

A bundled dataset that fails to load is a broken install, not a blip, so it is
never swallowed: `localGeojson.js` guards `response.ok`, reports `error` +
`lastUpdate` through `getStats()` (UNAVAILABLE chip, not a green ON over an
empty globe), and commits its Cesium data source only after setup completes so
a partial failure retries on the next enable. The two non-layer packs
(`naturalEarthRegions.js`, `neighborhoodPolygons.js`) have no stats contract to
report into, so they instead refuse to memoize a failure —
`src/data/retryableLoad.js` caches success permanently and retries a failed
load after a doubling cooldown (5 s → 5 min), which keeps one bad load from
silently demoting every later lookup for the session.

#### Cross-layer joins — `layerJoins.js` (September 2026)

The 2026-09 audit counted the joins in this repository and found three: the
Fiche implantation, the BD TOPO volumes' three themes, and the address
radiography. Outside those, **no layer read another layer's data at all**.

The reason was structural rather than an oversight — a layer module is a
singleton with a lifecycle, and importing one from another couples two
lifecycles, loads a pack that may never be enabled, and makes a cycle the
moment the second layer wants anything back. `src/data/layerJoins.js` is the
smallest thing that removes the obstacle: a string-keyed board of provider
functions. `publishJoin(key, fn)` on enable, the returned teardown on disable,
`askJoin(key, ...args)` from anywhere.

Three properties, and they are the whole reason it is a file:

- **No import edge.** `aisLiveVessels.js` never mentions the ports layer.
- **Absence is ordinary.** A key nobody publishes answers `null`, and the
  consumer says LESS — never an error, never a blank where a sentence was
  promised. That is what makes it honest to join two layers a reader can switch
  off independently.
- **A throw is contained.** `askJoin` catches, warns once per key, returns
  `null`. One misbehaving provider cannot blank a card.

It is deliberately not an event bus, not a cache and not a dependency graph:
nothing here can enable a layer, and a card that needs one switched on says so
rather than switching it on.

The cross-referencing plan of #128 and #129 recorded what the 2026-09 audit
asked for, what landed, and — for each item left out — the reason it was left
out.

Published today:

| Key | Publisher | Read by |
|---|---|---|
| `ports/directory` | `local-ports`, while its pack is LOADED (`onFeatures`) | the selected-vessel card |
| `buoys/nearest` | `marine-buoys`, while it is ENABLED | the selected-vessel card |
| `flights/boundFor` | `flights`, while it is ENABLED | the airport card (`airportCardDetails`) |
| `gauges/nearest` | `hubeau-hydro`, while it is ENABLED, over the records IN VIEW | the small-hydro card |
| `dams/nearest` | `local-dams`, while its pack is LOADED (`onFeatures`) | the small-hydro card |

The two lifetimes differ on purpose. A directory is a fact about a file and is
offered as long as the file is held; a sea state is a reading a visitor asked
to see, and a reader who switched the buoys off asked not to be told about
them.

#### The AIS destination, resolved — `portDirectory.js` (September 2026)

Measured 2026-09-09 over **2 250 distinct vessels** with a non-empty
destination, from twelve consecutive `/api/ais-live` snapshots, against the
2 951 harbours in the pack:

| | | |
|---|---|---|
| resolved by UN/LOCODE | 523 | 23.2 % |
| resolved by port name | 614 | 27.3 % |
| unresolved | 1 113 | 49.5 % |

Four shapes are read and there is no fuzzy fifth: a code (`BEANR`, `IT GOA`), a
leg (`DOVER<=>CALAIS`, `NOMON => TRALI` — the LAST segment, or the card would
name the port the ship has left), a name on a folded key, and a name followed
by a berth the field's own twenty-character ceiling cut off
(`ANTWERPEN 4E HAVENDO`). A leading token that names a KIND of place (`PORT`,
`TERMINAL`, `QUAI`) is never tried alone.

Two guards, both measured:

- **`Port Of Le Havre`.** 322 of 2 951 WPI names carry a generic head a master
  never types. The stripped form is indexed ALONGSIDE the published one.
- **`PORT_NAME_MATCH_MAX_M` = 2 500 km.** A code is the master's own identifier
  and is trusted at any range (the longest legitimate one in the sample is
  9 131 km); a name is a spelling that happened to agree. The sample splits
  cleanly: 16 legitimate name matches from 301 km to 1 348 km, then nothing
  until the 18 wrong ones from 5 006 km up — `PORTLAND` and `PORTSMOUTH` from
  the Channel, resolved to Oregon and New Hampshire because the WPI carries no
  English harbour of either name.

The unresolved half is printed exactly as the master typed it, which is what
the card did before this module existed.

#### The hydraulic chain (September 2026)

A small-hydro card names its installed power and its head, and neither register
behind it carries the two facts a reader wants next: how much water is going
past, and what is holding it back. `gauges/nearest` and `dams/nearest` supply
both, and the wording of both lines is the load-bearing part.

- **A DISCHARGE or nothing.** `nearestHubeauGauge` skips every station
  reporting only a stage, however close. A stage is a height above a gauge zero
  specific to that gauge — `hubeauHydrometry.js` spends a paragraph on why two
  stations' stages are not comparable — and putting one beside a plant's
  installed power would invite exactly that comparison. Ceiling 25 km
  (`HUBEAU_JOIN_MAX_M`), and the layer is viewport-driven, so a plant outside
  the current box gets no answer rather than a cached one from another region.
- **A NEIGHBOUR, never an identity.** Nothing in ODRÉ or OSM links a structure
  to a plant. The line says *ouvrage voisin cartographié, aucun registre ne le
  relie à cette centrale* (“neighboring structure on the map, no register links
  it to this plant”), names the distance, and never writes *son barrage* (“its
  dam”).
  Ceiling 10 km (`DAM_JOIN_MAX_M`) — wide enough for an intake and a
  powerhouse kilometres apart, tight enough to stay in the same valley.
- **A named structure beats a closer anonymous one.** 4 579 of the pack's 6 189
  features carry no name, no height and no operator. An unnamed one is still
  returned when it is all there is: "there is something here and OSM does not
  know what" is an answer.

Both lines name the river or the structure so the reader can check the claim,
which is the same standard `buildPlacementLines` already holds this card to.

#### Flight and airport, both directions (September 2026)

`AUS → LAX` becomes `AUS → LAX · 1994 km` on the tracked contact's readout.
The route source publishes the destination's coordinates (adsbdb did, and the
VRS standing data that replaced it on 2026-09-22 does), and until then only
`flightRouteArc` read them. `_remainingLegKm` measures
from the BILLBOARD's position — the same fix `_routeIsPlausible` uses, so the
two halves of one line cannot come from two different positions — and returns
`null` rather than a guess when the leg carries no coordinate.

The other direction is a join: `flights/boundFor` on the board, read by
`airportCardDetails`, which gains a line like `1 en approche — TVF57PQ`. Only a
route `routePlausible` accepts is counted, for the same reason the route LINE
is gated on it: a wrong-leg answer would put traffic on a field the aircraft is
nowhere near. Two codes are passed because the route carries ONE and it is not
always the same one (IATA when the airport has one, ICAO otherwise), and the
pack has both columns.

**Its ceiling is low today and the code says so.** `_requestRouteEnrichment`
fires for the TRACKED contact only, so a fresh session resolves no routes and
the join answers 0/0 for every field; it fills as a reader tracks flights.
Widening it means enqueuing route lookups for the ambient fleet, which is a
change to a token bucket sized by measurement against TYPE lookups
(`ENRICH_AMBIENT_BUDGET_CEIL` = 1000, refill 150/5 min, `qa:enrich-budget`) —
a separate measured decision, and one this change deliberately did not make.

#### The door to the radiography, and the sheet's two missing halves (September 2026)

`src/data/ficheSheet.js` is a layer-owned, self-mounting panel — the same idiom
as `veloPulseHud.js` — that FRAMES `fiche.html` at the point the globe is
scanning. It is opened by a `RADIOGRAPHIE` chip on the `Zone de chalandise`
row, published by `implantation-fr` — which is withheld since 2026-09-24
(`src/data/pausedLayers.js`), so the chip is not offered today.

WHY IT EXISTS. Two surfaces answered the same question about the same door and
nothing linked them: the globe's fiche card is capped at six lines
(`createAddressScanOverlayEntry`, `.slice(0, 6)` — the right cap for a label
pinned on a doorway) and `fiche.html` holds sixty rows, printable, reachable
only by typing its URL.

WHY AN IFRAME. `fiche.html` already ships `?embed=1`, which strips its masthead
form and print button precisely so it can be framed, and it is a Cesium-free
page by explicit decision (`CESIUM_FREE_PAGES`). Re-rendering its sixty rows
inside the globe bundle would mean two renderers for one document, and the
second would be the one nobody prints. Same origin, same session, same server
cache.

The frame is EMPTIED on close, not merely hidden: an iframe left pointed at the
sheet keeps seventeen requests and their timers alive behind a panel nobody is
reading. Re-pointing at the same place is a no-op rather than a reload.

The chip travels through `setParams({sheet})` and is deliberately absent from
`getParams()`: a share link carries what the map SAYS, and whether a reader had
a panel open is not that. It returns `true` because the manager treats `false`
as a rejection and would log a fault for a chip that did what it was asked.

THE SHEET NOW READS SEVENTEEN ROUTES, not fifteen. Two themes were answering
half their own question, and the audit had counted both routes as "in
production for a layer, with no line on the sheet":

- **Nuisances** gains `/api/bruit-fr` — the PEB band under the point,
  with its index, its range and the date of its order (*arrêté*); outside every plan, the
  nearest aerodrome and its distance. A band with `atPoint: false` (the
  overview wash the layer draws AROUND an aerodrome, tested against no point)
  never reaches the sheet.
- **Numérique** (Digital) gains `/api/anfr-fr/supports` — masts around the address by
  generation, counting only what RADIATES (`live`), never what is approved
  (`plan`). An empty NATIONAL register is reported as an empty register and
  never as an empty street; see `docs/KNOWN-ISSUES.md` for the 222-byte
  upstream CSV that made that distinction load-bearing on the day it shipped.

Both join an existing theme rather than founding one of their own — the same
"one subject, one heading" decision the layer panel just made.

#### The desktop Layers panel: a rail of groups, and one list beside it (September 2026)

On a desktop the Layers panel is two columns (`src/data/layerPanelRail.js`,
mounted by `src/main.js` everywhere but the phone shell):

- the **rail**, 88 px: « Chercher », then one button per group — a Lucide glyph
  (`lucideIcons.js`), the group's short name (`categoriesShort` in
  `layerTaxonomy.i18n.js`) and a badge counting the rows that are ON, computed
  as the active strip counts them. Below a 760 px-high window the words go and
  the glyphs stay, so the six groups fit a 1280 × 620 laptop without a hidden
  scroll; the name stays the button's tooltip and accessible name;
- the **list**, 292 px, beside it: the rows of ONE group under its full name,
  its « n/m ACTIVES » tally, a search field, a pin and a close button. The
  active strip still leads it.

Open, the panel is 380 px (the old one was 320); closed, it is the rail alone.
Expanding the panel from its launcher opens the list on the last group shown
(`godsEyeView.v1.dataLayerDrawerCategory`). **Touching the globe folds the
list back into the rail**: a press of any button (a click, the start of a pan,
a right-drag zoom, a tap) or a wheel over the globe's canvas. So do pressing
the open group again, the close button and Escape inside the panel. **A mouse
resting on the panel for 200 ms unfolds it again** on the last group shown; the
pointer leaving the panel folds nothing. A pointer crossing the rail, a mouse
with a button down (a pan dragged over the rail) and a finger unfold nothing,
and a list folded with the pointer on the panel waits for the pointer to leave
and come back. A click on the open group within 500 ms of the hover unfolding
it was aimed before the list appeared, and does not fold it. The **pin** keeps
the list open through the globe; the choice is stored
(`godsEyeView.v1.dataLayerDrawerPin`), and every width starts unpinned.

The **search** matches every word of the query, in any order, accents folded,
against each row's name, source and group — and against the names of the layers
fused into it, so « militaire » finds « Vols en direct ». Results span every
group, each under its header; no match prints « Aucune couche ne correspond à
« … ». ». The first Escape empties the field, the second closes the list.

The rows are still the manager's: `setPanelLayout('rail')` draws every group
and every row as the accordion does, with headings instead of header buttons
and no collapsed group, and the rail only toggles classes (`is-rail-current`,
`is-search-miss`, `drawer-open`, `rail-searching`), so every
`[data-layer-id]` lookup still finds its row and the left stack's layout engine
re-measures on each change. `revealPanelRow(layerId)` opens the group of a row
(a fused layer resolves to its primary) — the voice surface calls it before
scrolling to a row. The phone sheet keeps the accordion.

#### Fused rows — one subject, one line (September 2026)

`src/data/layerFusions.js` is the one table that says which rows are the SAME
SUBJECT. `layerTaxonomy.js` answers "what is this dataset and which group does
it belong to", which is a per-layer question; "are these two rows one subject?"
is a statement about a PAIR, and a per-layer field can only hold half of it.

Sixteen entries fold **26 layers** into the row of the subject they belong to.
The panel goes from **61 rows to 35** (33 core layers plus the two plugged
datasets). What a fusion changes is presentation and nothing else:

- the companion keeps its **id, module, lifecycle, cache and share token**, so a
  link sent before the merge restores exactly what it always restored;
- the companion keeps its own **map-legend entry** — the key is gathered per
  layer from `getAll()` and never went through a row;
- the companion keeps its **credit line**.

On the row, each companion becomes a **fusion chip**: round, dotted (`○` off,
`●` on), against the square option chips the panel already had. The row toggle
enables the primary and the companions that FOLLOW it; a companion marked
`optIn` (the reader's own dossier `comparables-fr`, among others) waits for its
chip. Switching a row OFF takes the whole group down, `optIn` included — a lit
chip under a dark row would be a layer drawing with no visible control.

**The voice surface switches the SUBJECT.** `set_layer_visibility` drives the
primary through the intent protocol — the operator's utterance is reported on
that one transition — and then calls `setRowFollowers`, which moves the
companions beside it and names them back in the result as `companions`. Without
it, *montre les transports en commun* (“show public transit”) lit `transit-fr` alone and left
Île-de-France with no vehicles, which is the exact gap the fusion closes. An
unfused layer's answer is byte-identical to what it was: the key is named only
when there are followers. The bare word *météo* (weather) was moved off
`meteo-stations-fr`'s alias list for the same reason — it names the row now,
and *stations météo* (weather stations) still reaches the instruments.

A row whose primary is off but whose companion a share link left on reads `OFF`
and still shows its chips, so the drawn layer is always controllable. The
button's DIRECTION is read from the primary: pressing it switches the subject
ON rather than switching off the one thing that is drawing.

The chip strip of a fused row carries chips from several modules. Their ids are
namespaced (`comptages-fr::w04`), because two modules can each publish a chip
called `week` and on a shared strip that collision would make one chip apply
the other's params. A companion's option chip carries its owner's name at the
head of its tooltip, and a left edge in the stylesheet.

**Which layer keeps the row** is a product decision stated in the table: where a
fusion mixes a layer that has data everywhere with one that stops at the French
border, the WORLD layer is primary (`bikeshare` over `shared-mobility-fr`,
`local-datacenters` over `anfr-fr`). A row chipped `FR` over a world subject
tells a reader outside France that a layer serving them is not for them.
`layerFusions.test.mjs` asserts it.

**The digital-infrastructure row is laid out as tiles in the key** since
2026-09-22 (`tiles` in the fusion table), after the approved mock of that row.
While any of its members is on, its block of the map key opens with three
tiles — *Câbles*, *Data centers*, *Antennes* (*Cables*, *Data centers*,
*Antennas*), in that order: the wired backbone on one line, the radio network on
the next; a withheld layer gets no tile, so the hosted site shows two (three
since the coverage tile of lot 3, below) — each an icon (Lucide `cable`, `database`, `radio-tower`, vendored in
`src/data/lucideIcons.js`), a name and a drawn switch. A tile is a `<button
aria-pressed>` that goes through the same path as the chip it replaced
(`_toggleFusionMember`: coverage briefing and flight included). A lit tile
wears the colour its layer draws on the map (`#39d5ff`, the data centres'
violet `#a98bff`, the 5G amber `#ffb238` since 2026-09-23;
`layerFusions.test.mjs` pins each literal to its module's constant),
so it is also that member's swatch. The row in the panel keeps its own toggle
and NO strip: the three fusion chips and the five coverage chips moved to the
key, they were not copied. The block stays in the key while the row is on even
when no member prints a class, since the tiles are the row's only member
switches; a dark row keys nothing. The key is rebuilt only when what it draws
changed (see « The panel refresh writes only what changed » under the right
rail); when it is, a focused tile or segment hands its keyboard focus to its
successor (`data-focus-key`). Every other fusion keeps its chips, except
« Urbanisme » below.

**« Urbanisme » opens on its permits, with the zoning dark** (2026-09-23, the
approved mock of that row). Its primary is `ads-fr` (renamed *Urbanisme* /
*Planning* in the taxonomy; the zoning's own label is *Règles d’urbanisme* /
*Planning rules*), `sitadel-fr` follows it, and `urbanisme-gpu` is `optIn`: the
row's toggle, the voice word *urbanisme* and every spoken permit phrase light
the two permit layers and leave the PLU and the easements off. The members are
**tiles under the row, in the Layers panel** (`rowTiles` in the fusion table),
not in the key: *Permis & travaux* (the two permit layers, ONE tile, pressed
lit it puts both out, pressed dark it lights both) and *Règles d’urbanisme*
(the zoning), then the row's *Période* — `ads-fr`'s window as a menu, *3
dernières années* / *6 dernières années* / *Toutes les dates*, offered to
`sitadel-fr` too (`fanOut`) — and *Sélectionnez un projet sur la carte.* while
the permits are lit and no project is open. Eight chips became two tiles and a
menu. The row's button reads and switches the GROUP on such a row: with the
permits out and the zoning on it reads ON, and pressing it puts everything
out. A dark row names its tiles on its meta line.

A **stored session saved before this row changed** comes back with the zoning
dark: `urbanisme-gpu` was the row's primary then, so any session saved with
the row on carries it, and restored as is it lit the PLU on every reload. The
stored blob now carries a revision (`r`, `STORED_LAYER_STATE_REVISION` in
`src/data/layerState.js`); `parseStoredLayerState` drops `urbanisme-gpu` from a
blob without one, and every save writes the current revision, so the zoning a
reader lights afterwards survives a reload. Share links are not rewritten: a
link shows what its sender had on screen.

In the key, members that share a row tile share ONE block: the two permit
layers wear one palette (`src/data/permitProjects.js`) and their classes are
merged, deduplicated and put back in the life of a permit (`mergeTileMembers`).
The block is folded under *Couleurs des projets* (`legendFold`), open while no
project is selected and folded under the card of the project that is.

**« Aéroports » draws its tiles as lines** (2026-09-24, the approved mock of
that row): a row tile with an `icon` is a line — glyph, name, `blurb`, round
light — and a row gives an icon to every tile or to none
(`validateFusionRowTiles`). « Les aéroports » and « Bruit & urbanisme » both
follow the row's toggle, as the two members always did. A lit member may
publish a `picker` (`rowPickerOf` in `manager.js`): a native `<select>` laid
transparent over a face with a glyph, the name and a code box, heading the
row; a change calls the publisher's `pickRowOption(id, value)` instead of
setting a param, since picking an airport flies the camera and a share link
must not. See the banner at the top for the noise layer's side.

**A selected antenna and a read coverage spot are printed in the key**
(2026-09-22, lot 2 of the same mock), as the DVF sale and the DPE site already
were. With the key on screen (`mapKeyCarriesSelection`, now in
`src/data/mapKeySelection.js` and re-exported by `addressScanLayer.js`), the
globe keeps a tag — the antenna's title, or « Point sélectionné » over the
spot — and the card goes to the `legendSelection` slot: under the antenna
classes for a mast (`anfrSelectionPanel`), under the *Couverture 4G* block for
a spot (`coverageSelectionPanel`, carried on that block's `legendBlocks`
entry). On a phone, or with the key folded or hidden, the whole card stays on
the globe; the key's `class` and `hidden` are watched while something is
selected, so folding it after a click puts the card back. The antenna card:
the commune as its name once Cartoradio has answered (« Antenne 5G · 4
opérateurs » until then, under one key so it is revealed once), what it stands
on and the brands as two meta lines, one plate per generation on the air
ringed in its dot colour (`chips.outline`: the 2G slate cannot carry black
text) with the planned ones beside them, the wave line, the line of sight as a
figure (« 28 % · rayon 39 km », swatch in the viewshed blue, « une géométrie,
pas une couverture radio »), « Source : ANFR, <edition> », and « Voir les
équipements · N antennes » folding one line per operator (brand, generations,
antenna count; no frequency). The spot card: « Au point sélectionné », the
answer (« Seul Orange capte ici »), and a table of the four operators with
their level in words and as three phone bars (`rows`, a real `<table>`; bars
rather than a swatch, which would read as one of the key's pinks). Like the
globe's, it appears only with its answer (or « Chargement… » past 250 ms), and
the previous one stays until then. The key's card slot gained `meta` as a list,
`chips.outline`, `metric.heading` and `rows`; a card whose content changes is
revealed again until the reader scrolls, clicks or types in the list
(`_legendSelectionTouched`), because the spot card grew its table under the
fold of a 370 px key at 1280 × 800 — one card at a time, and the one that
opened or learned something: two layers can hold a card at once
(`_legendSelections`, keyed by layer and selection). A meter draws three bars,
the number `style.css` gives it, and `legendSelectionOf` refuses more. Register
communes are cased per part of a compound name (`Saint-Sever`,
`Villeneuve-d’Ascq`, `La Rochelle`), since the commune is now a title.

**`mapKeyCarriesSelection` reads the COMPUTED visibility** (2026-09-22), not
the layout boxes alone: `body.ui-clean-view #map-legend` is `opacity: 0;
visibility: hidden`, and a node hidden that way keeps its boxes, so the key
answered "on screen" through the clean view and a clicked object printed its
title on the globe and its card where nobody could see it — the DVF sale and
the DPE site had it too. The antennas also watch the BODY's class, not only
the key's, so pressing `V` with a card open puts it back on the globe.

**The 4G coverage is a fourth tile, and the cables have a key and a card**
(2026-09-22, lot 3 of the same mock). The row now shows four tiles — *Câbles*,
*Data centers*, *Antennes*, *Couverture 4G* (*4G coverage*, Lucide
`signal-high`, lit in the dead-zone rung `#f0287a`). A fusion tile can switch
PART of its layer (`part` in the fusion table): `anfr-fr` is split into
`masts` (`{masts: true}` / `{masts: false}`, lit by the row's toggle) and
`coverage` (`{coverage: 'gaps'}` / `{coverage: 'off'}`). The manager keeps the
layer following its parts (`_toggleFusionTile`): pressed with the layer off, a
part comes on alone; the last lit part put out switches the layer off and
back to the params the row lights it with (masts on, coverage off). While a
part tile is switching the layer on, the layer counts as on for the next press
(`_tileLayerOn`), so a double press is on-then-off and a second tile pressed in
that window joins the first. A part the loaded module says it cannot draw
(`tilePartNotice`: the coverage on a server without the pyramid, or whose map
failed) is dimmed with the reason in its tooltip. `anfr-fr`
gained the `masts` param, share-linked as `lo=an.m.0` and omitted while true,
so every earlier link keeps its masts; with the masts out the layer asks the
register nothing (no mesh, no supports), keys no mast class and drops a
selected mast, while a read coverage spot stays open; a layer switched on with
neither part lit shows its masts (`anfrMastsShownOnEnable`). The *Couverture
4G* block is printed while the coverage is on, and its segments only choose
the mode: a lit segment sends its own mode again — nothing changes, the
keyboard focus stays on it, and a map that failed to load is retried — and no
longer removes the coverage.

The submarine cables publish a key (`getRowControls`, words in
`src/data/submarineCableKey.js`): « Tracé publié » as a stroke
(`swatch: 'line'`, a new key swatch) in `#39d5ff` and « Point
d’atterrissement » as a dot in `#8fffd2`, under « Tracés schématiques de
TeleGeography (fichier du 24 mai 2026), pas le relevé du câble posé ». EVERY
route is now drawn in that one cyan: TeleGeography's per-system colours (534 in
the file) could not be keyed, and they were not reaching the right lines
anyway — the loader makes one entity per LINE of a MultiLineString (1 913 for
712 features), and the layer joined them to features by position, so the first
712 wore other cables' colours and names and the other 1 201 were unclickable.
Entities are joined to their feature by id now (`id`, `id_2`, …), and cable
lines are no longer hidden by their route's midpoint past the horizon (which
would take the 2Africa line off a view of Marseille). A click on a landing —
its dot, its stem tip or its label, or a cable within 14 CSS px of it
(`LANDING_CLICK_SLOP_PX`: at a hub the lines cover the dot) — opens its card
in the key and keeps a tag on the globe, on its own protected overlay source
(`telegeography-submarine-cables-selected`), its ambient label withheld; the
camera no longer flies. The card: the place as the name, « Point
d’atterrissement · <country> » (TeleGeography's English country read through
the runtime's CLDR, all 1 917 landings resolved), « Voir les N câbles
associés » folding their names, and « Géométries illustratives · câbles dont le
tracé passe à moins de 2 km du point ». The cables of a landing are those with
a drawn vertex within 2 km (`LANDING_JOIN_KM`), computed on the click over the
~14 000 vertices; against TeleGeography's landing-point pages for the 27 French
landings and 32 random ones, all 82 listed cables were found, with 2 extra at
one landing (58 of 59 exact). On a phone, or with the key folded or hidden,
the globe card lists the first four cables and counts the rest
(`watchMapKeyCarriesSelection` in `mapKeySelection.js`). A click on a cable
still flies to it. Escape, the key's close or a click away closes the card.

**The electricity row brings the night.** Since 2026-09-21 the grid and the
power stations are one row, *Réseau électrique et centrales* (*Power grid and
plants*): `power-grid` is primary (the world layer) with a chip of its own
(`primaryToggle`), `rte-generation` follows the row, and `edf-power-plants` and
`fr-hydro-plants` are `optIn` — on this row they drew the same stations a second
time. The row's switch therefore lights what the landing page's scene lights.
It also moves the visual preset (`src/styles/nightAtlasRow.js`, fed from the
manager's settled `visibility` events in `ui.js`): when the row goes from dark to
lit by a reader — origin `user` or `voice` — the preset becomes Night, and when
a reader turns it dark again a night map goes back to Normal, whoever lit the
row — the landing page's link included. A preset the reader picked while the
row was on (CRT, FLIR…) stays. A share link, a restored session, a scene or a
context mode moves layers without moving the preset. The switch lands when the first of the row's layers settles: 1.8 to
2.8 s after the click in headless SwiftShader runs against the dev server.

**The digital-infrastructure row brings Dusk and imposes Satellite**
(2026-09-23, the operator's review of the mock). The same follower moves the
preset to Dusk when a reader lights the row and back to Normal when they put it
out (`ROW_PRESETS` in `nightAtlasRow.js`; with both rows lit, the one still lit
keeps its own ground). The basemap is a condition of the row rather than a
look, so `src/basemapLock.js` holds it for EVERY origin — a link, a stored
session, a context mode: row lit → `MapStackController.setLock` on `ign-ortho`
(« Satellite ») and a switch to it; row dark → release and a switch back to the
stack the reader had. While the lock holds, `setStack()` refuses every other
stack whoever asks (the tray, the voice's `set_map_stack` → `ok: false` with the
reason, a share restore, the 3D adoption, which waits): a refusal is not an
error (`refused` on the returned state, no `lastError`, no toast unless the
reader asked). The tray greys the other chips (`locked`, `aria-disabled`, a
tooltip naming the row), clicks on them do nothing, and a note under the row
reads « Satellite imposé par Infrastructure numérique : les autres fonds de
carte ne sont pas disponibles avec cette couche. » A lock taken before the
first stack is on the globe lands the reader on Satellite directly.

**The row's marks follow the mock of 2026-09-23.** Masts are billboards, not
discs (`src/data/anfrGlyphs.js`): an upright triangle with a halo and a hot
core, the band colour unchanged in meaning (5G now amber `#ffb238`), the size
the operator count, the pale outline an approved project, hollow where nothing
radiates; eleven images in the atlas whatever the view (stable `imageId`s).
The key's band rows draw the triangle (`glyph`). The selected mast is an amber
diamond, and its globe tag wears the amber. The line of sight
(`mastViewshedImagery.js`) is shaded per cell from the computation's own data —
a hillshade of the DEM (sun north-west, 45°), paler and more opaque at the
mast's foot, a near-white rim faded over two cells where lit ground meets
hidden ground (none on the horizon circle) — instead of one cyan at 36 %. The
data centres (`src/data/datacenterGlyphs.js`, new `createLocalGeoJsonLayer`
options `markerGlyphs`, `groupCellPx`, `groupMinHeightM`, `stemPx`) draw a
violet four-pointed sparkle on an 18 px, 1.5 px faint stem (it was a 6 px cyan
dot on a 65 px, 3.5 px cyan stem); above 60 km of camera height the sites that
share a 30 px screen cell merge into a stacked mark led by the most important
of them (`groupLocalMarks`; the selected site always leads its cell). Names
are labels, not cards, eight at most on a 240 px grid, ranked by published
power then hall area (`datacenterLabelPriority`), with the power after the
name (« Colt Paris 3 · 85 MW »). Halls are violet, site outlines a slate
lilac. The key prints two rows, *Site* and *Regroupement* (*Group of sites*),
each with its silhouette. A billboard's image is a data URL, so the 4 638
sites share three atlas entries.

**What the row costs a phone and the network (2026-09-23).** Four changes,
measured in Chrome on the ThinkCentre (Intel GPU) against `main`:

- **The selected mast's line of sight runs in a worker**
  (`src/data/mastViewshed.worker.js`; the pure pipeline — DEM tiles decoded,
  rays, relief, paint — is `src/data/mastViewshedPaint.js`; a browser without a
  2D `OffscreenCanvas` runs it on the main thread). Only the painted RGBA comes
  back, transferred, and `createViewshedImageryLayer` hands it to Cesium as an
  `ImageData` through a `SingleTileImageryProvider` whose `requestImage` is
  replaced — the PNG round trip (`toDataURL`, then Cesium decoding the same
  pixels) is gone. Masts of 30, 48 and 150 m: the longest main-thread stall
  from the call to the texture on the globe went from 226–356 ms to 19–28 ms
  (a 10 ms heartbeat, two rounds each), and the wait until it is drawn from
  380–581 ms to 263–466 ms.
- **The city view keeps the supports by grid cell** (`src/data/anfrSupportCells.js`).
  It used to ask `/supports` about its exact box, keyed to 0.0001° (11 m), so
  every camera stop was a request. The ground is now cut into 0.025° cells;
  the cells a view touches and the layer does not hold are asked for in boxes
  snapped to the grid (one 14 × 14 box covers the 0.32° entry view; a pan asks
  for its strip, a diagonal pan for two, a zoom out for its ring unless one box
  spares more than half), each answer is filed under its cells, and the view is
  assembled from them, cut to the view box and sorted by support id — the
  register's order — so it draws exactly what the exact box returned. 400 cells
  are kept (least recently drawn out first, never one a load in flight is
  reading); a cell is asked for again after the six-hour poll. `/supports`
  accepts a box of exactly its 0.35° ceiling (+1e-9, for the float of snapped
  edges). Over central Paris at 12 km: entry 1 request of 57 kB gzipped where
  `main` sent 580 kB raw; the next nine stops (six pans of 150 m, a zoom in, a
  zoom out, a return) 0 requests where `main` made 9 (4.6 MB raw).
- **`/api/anfr-fr/mesh` and `/supports` are compressed and kept by the browser**
  (`anfrAnswer`, `sendAnfrAnswer` in `vite.config.js`). They went out `no-store`
  and raw: `/mesh` was 1 668 085 bytes on every visit. Now gzip (393 625 bytes),
  `Cache-Control: private, max-age=21600` (300 for a stale answer) and a weak
  ETag over the answer without its clock (`fetchedAt`, the mesh's
  `builtInMs`) and with `stale`, so a six-hourly rebuild of the same edition
  revalidates with a 304; the second visit read `/mesh` from the disk cache,
  0 bytes. The `/mesh` answer is serialised, hashed and gzipped once per
  register build; `/supports` answers are memoised per build and box, up to
  16 MB.
- **On a frame drawn above CSS size, Night and Dusk split their bloom off**
  (`src/styles/nightAtlasStage.js`, pieces shared with `noir.js`). A phone
  renders at `resolutionScale` 2 (`phoneRender.js`), so the one-stage pass read
  the frame 17 times per buffer pixel. There the style is a
  `PostProcessStageComposite`: the bloom at `textureScale` 0.5, same taps at
  the same distances in frame pixels, then a full-resolution finish that reads
  the frame once and the bloom four times (bilinear by hand — stage outputs are
  `NEAREST`) — 9 reads per buffer pixel instead of 17. Its `uniforms` forward to
  the finish stage, so `ui.js`, `nightBasemap.js` and the cockpit policy drive
  it as one stage. Emulated iPhone 13 over Paris at 4 km with Dusk: mean
  difference 0.5 in 255 from `main`, 0.45 % of pixels over 8 (halo edges). The
  GPU time saved is NOT measured: the ThinkCentre's frame is CPU-bound and its
  on/off deltas (−5 to +22 ms) are noise. A desktop keeps the one stage.

Two parts of the audit were narrowed. Its 6.3 ms per hatched coverage tile was
taken at a load of 52 and does not reproduce — 0.51 ms on the ThinkCentre — so
the coverage change is only the stripes painted as a second pass over their own
pixels (`paintCoverageTile`, 0.26 ms, identical output, asserted against the
one-pass paint). And the shafts are still drawn on a phone: dropping them would
change what the row shows.

**A clicked data centre opens its card in the key** (same day, the mock's
card; `keySelection` in `createLocalGeoJsonLayer`, `datacenterSelectionPanel`
in `datacentersPack.js`). The click no longer flies the camera to 5 km: the
site's sparkle turns amber, the globe keeps an amber tag (« Fullsave Toulouse ·
34 MW ») — or the whole card where the key cannot carry it — and the key prints
the name, the operator and fabric as meta lines, the power as the card's figure
with who published it (« Puissance renseignée », « DCWatch · 9 avril 2026 » or
« OpenStreetMap »), the year, « Source : OpenStreetMap et DCWatch (ODbL) », and
« Voir le site » when the site's `website` is https (929 sites carry one, 919
https). A site with no published power says « Puissance non publiée ». Escape,
the key's close or a click on empty ground closes it; the selected site leads
its screen cell and its ambient label steps aside for the tag. The entity
context is still set, so the voice and the Context panel see the selection.

**What the fusion does NOT do**, and is owed separately: deduplicate the 56
plants three registers share (`edf-power-plants`, `rte-generation`,
`fr-hydro-plants`, plus 14 in `gas-fr`), and move the doctor (*médecin*) family out of
`amenities-fr`. The row merge is the first half of that work.

#### Viewport-gated layers and the view gate (September 2026)

Three layers refuse a request box above a ceiling — Bâti 3D at **0.08°**, the
mapped grid at **0.8°**, Hub'Eau at **20°** — because one click from a
continental camera would otherwise ask a public service for half a country.

Two rules keep that ceiling from reading as a broken layer:

- **A gated load is not a failed load.** `load()` answers "did this tick fetch
  anything"; `update()` answers the manager's different question, and only a
  recorded error is a failed refresh. Returning the guidance state as `false`
  made the manager treat it as the module rejecting its lifecycle: the layer was
  torn back down on enable, the toggle flipped to OFF, and the operator got
  `<layer> could not start cleanly` over a healthy feed.
- **The zoom a layer needs is applied, not announced.** A layer may expose
  `ensureViewGate(viewer, { signal })`. Three do: `powerGrid`,
  `bdtopoBuildings`, `cadastreParcels`. It is reached from the **zoom card**
  (`src/zoomPrompt.js`) — the reader presses *Zoomer ici* (Zoom here) and the layer solves
  and flies. A gate that throws or cannot be satisfied is not a failure: the
  layer stays ON with its own guidance text.

  It used to run automatically, awaited by the manager after `enable()` for
  explicit intent only (`user`, `voice`, `tool`). **That call no longer exists
  in `manager.js`** — it was lost somewhere between #35 and today's `main`, and
  for a while the three solvers were dead code nothing called. Which is also
  why `npm run qa:view-gate` was a baseline failure. Restoring the automatic
  flight is a separate decision from offering the button: switching a layer on
  is not, on its own, permission to move somebody's camera.

`src/data/viewGate.js` solves the camera: it sizes the metre budget off
**longitude** (the tighter axis off the equator — sizing off latitude overshoots
by 45% in France), steepens a pitch shallower than **−55°** (a horizon-facing
camera sees to the horizon at any altitude, so altitude alone cannot satisfy a
box ceiling), never flies UP, seats the result on `globe.getHeight()`, then
re-asks the layer's own gate after the flight and tightens twice more before
giving up. The focus is the centre of the current view, pulled onto the layer's
coverage only when that coverage fills ≥5% of the view or the camera is holding
more than 30° (aimed at nothing in particular); a 400 km camera over Berlin that
clips 0.1° of Alsace is looking at Berlin and is left there. Bâti 3D flies only
for `too-wide`, never for `off-coverage`. Hub'Eau has no `ensureViewGate` on
purpose: its gate is 20°, so the only camera it refuses is a global one, and the
zoom that satisfies it over the mid-Pacific still finds no French river gauge.

Proved by `npm run qa:view-gate` in a real browser (420 000 m → ~2 900 m over
France, buildings drawn, no lifecycle failure published) and by
`src/data/viewGate.test.mjs`, which flies the solved camera in an independent
model of what a camera sees and asserts the box lands under the ceiling —
including non-cardinal headings, where the axis-aligned rectangle has to contain
a rotated trapezoid.

#### The zoom card (September 2026)

**Thirteen layers refuse to draw above a ceiling of their own, and at a
continental camera twelve of them are outside it at once.** Every one says so
honestly — a guidance status, a sentence in `loadingLabel`, a chip that stays
green because a zoom gate is not a fault — and all of it lands in a sub-line of
a panel row, in small type, in a panel that can be collapsed to a 0×0 box. The
reader watching an empty globe at 1 000 km never saw it.

`src/zoomPrompt.js` states it at **42% of the viewport height** — above centre,
so the card does not cover the subject it is talking about — as one card for all
the waiting layers: up to three rows, then *+N autres* (“+N more”). The words are the
LAYER'S own `loadingLabel`, never a second sentence written in the card that
could drift from the row. Where the layer exposes `ensureViewGate()`, the row
carries **_Zoomer ici_ (Zoom here)**, which is what finally calls the three solvers.

The ceilings, measured from the source: `road-status-fr` 2 000 km · `transit-fr`
300 km · `bruit-fr` 250 km · `power-grid` 120 km outside France (inside it the national pack draws at any altitude) ·
`idfm-network` 20 km · `sitadel-fr` 12 km · `cadastre-fr` and the `fraicheur-fr`
trees 1,5 km; and by view span rather than altitude, `hubeau-hydro` 20° ·
`military-installations` 10° · `filosofi-fr` 0,9° · `bdtopo-buildings` 0,08°.

Three details that are not obvious:

- **The card is `pointer-events: none`; only its buttons are not.** It sits over
  the middle of a globe people drag.
- **It is repainted twice after a camera stop, at 600 ms and 1 600 ms.** The
  panel repaints on `moveEnd` (`setCoverageView`), but a gated layer's verdict
  about that camera does not exist yet at that instant — the layers debounce
  their own viewport read.
- **A dismissal is remembered against the SET of waiting layers**, not for the
  session: the same situation stays closed, a different one is news again.
- **The card leaves on the PRESS of _Zoomer ici_, in 140 ms** — not when the
  layer stops being gated. It used to stand through the 1,6 s flight and the
  settle behind it, which reads as a button that did nothing. The situation is
  held in `_zoomPromptFlyingSignature` for the length of the flight so the
  scheduled re-reads cannot bring it back mid-camera, and released when the
  flight settles: a flight that did not reach the gate brings the card straight
  back with its button re-armed.

Every prompt is in French and says **zoome** (zoom in), which two layers
already did and eleven did not — three were still in English, the rest said
*descends*, *descendez* (go lower) or *rapprochez-vous* (move closer) for the
same act.

#### Fade on zoom — `zoomFade.js` (October 2026)

**A layer that draws the same statistic at several aggregation levels now
crossfades between them over a band of zoom, instead of swapping one for the
other on a threshold.** Fifteen layers used to change level on a hard cut — a
région disc for département discs, a 1 km cell for twenty-five 200 m cells, a
thinned mesh for every site — usually with a blank frame while the next level
was fetched and built, and the swap read as the map reloading. This is Kyle
Walker's "fade on zoom": each level's opacity is a function of the camera's
scale, so the coarse level is still there, fading, while the finer one comes in.

`src/data/zoomFade.js` is the shared half:

- **A band** (`fadeBand(fine, coarse)`) in the unit the layer already measured
  the camera in — a view span in degrees, an altitude or a view range in
  metres. The weight is interpolated on the LOGARITHM of the scale, because a
  zoom is a multiplication.
- **A shape.** `reveal` (the one every layer here uses): the finer level is at
  full strength 30 % into the band and the coarser one fades out behind it by
  70 %. Every band can only sit on the fine side of the old threshold — the
  finer level's request is capped there — and a symmetric crossfade placed
  there handed most of the band to the aggregate: Lyon from 9 km at −75°, a
  200 m view on the old switch, came back as the 1 km grid. The finer level
  owns the row (legend, stats, share link) from half strength.
- **The cover rule** (`coverAlphas`): a level holds full strength until the
  level replacing it is actually drawn, then the two cross over a 260 ms
  arrival ramp. Layers fetch on `moveEnd`, never per frame, so without it a
  zoom through a band dimmed the coarse level while the finer one was still a
  request in flight. The same rule turns a transition that must stay a hard cut
  into one that never shows an empty frame.
- **One `scene.preRender` read of the camera** for every subscribed layer, and
  adapters that write one weight cheaply, quantised to 64 steps so a parked
  camera writes nothing: a uniform on a `PerInstanceColorAppearance` for a
  `Primitive` of thousands of instances, cached attribute handles for a
  `GroundPrimitive`, a per-item base alpha for point and billboard collections.
  The arrival ramp holds continuous render only while it runs.
- `window.__godsEyeView.getZoomFadeDiagnostics()` publishes each layer's level
  alphas and camera scale, so a harness can tell a crossfade from a blank frame
  without reading pixels.

**A fade claims the two levels are the same statistic at two resolutions, so a
transition between different datasets, different indicators or different
breaks stays a cut** — without the blank frame. The layers:

| Layer | Fades (band, shape: reveal) | Stays a cut, and why |
|---|---|---|
| `filosofi-fr` | 1 km → 200 m grid, 0.12° → 0.07° of `max(lat, 0.66 × lon)`; régions → départements, 12° → 7.2° | Départements ↔ grid at 0.9° (a 2023 median against a 2019/2021 mean); the `population` indicator inside both bands (a count: its breaks differ by level) |
| `irve-fr` | Mesh → every site, 0.35° → 0.21° of the larger span; a site the mesh stands on is drawn once, as the site | Département prisms ↔ mesh, 9.5° / 8° latitude (density against power band) |
| `schools-fr` | Mesh → every school, 0.35° → 0.21° of the larger span, same rule | Prisms ↔ mesh (density against school level) |
| `sup-fr` | — | Prisms ↔ establishments (a share against a kind of establishment) |
| `amenities-fr` | Mesh → every site, 0.30° → 0.18° of the larger span (0.30°, not 0.32°: the sites box is the view padded 8 % a side under the proxy's 0.35°); a shared plate grows from mesh to site size | National choropleth ↔ marks, 9.5° / 8° (a share of communes against positions) |
| `medecins-fr` | Mesh → every practice, 0.60° → 0.36° of the larger span (the proxy's box ceiling); a mesh dot is matched to its practice by its line in the server pack | APL choropleth ↔ marks at 9.5° (another dataset) |
| `anfr-fr` | Mesh → every support, 0.35° → 0.21°; mast shafts 0.09° → 0.06° | — |
| `petite-enfance-fr` | Départements → intercommunalities, 0.9° → 0.54° latitude; intercommunalities → communes, 0.45° → 0.27° (one coverage rate, one national set of ratios) | — |
| `delinquance-fr` | — | Départements ↔ communes, 0.75° / 1.1° (breaks cut over 96 département rates against every commune rate; 16 contributors against 14) |
| `shared-mobility-fr` | Group bubbles → vehicles, 3 500 m → 2 100 m of view range | Grouping by count (1 500 vehicles in the box): a pan crosses it without a change of scale |
| `dvf-sales`, `dpe-fr` | Cadastral sections → plots, 1 800 m → 1 080 m of altitude (a section is the median ratio / most frequent letter of its plots, on the same classes) | Plots ↔ disc at 600 m (a capped sample against an uncapped box) |
| `power-grid` | — (the same lines at two simplifications: crossfaded at rest they read as a blur) | The national pack ↔ the per-view answer swaps way by way without a gap; the ways an answer takes over crossfade over 260 ms on arrival |

Two multi-level layers are left as they were. `local-firms` (NASA FIRMS) draws heat as the
ALPHA of each cell (0.16 + 0.5 × the normalised score), so a fading cell would
read as a cooler one. `radio` groups stations with Cesium's screen-space
clustering (42 px): clusters re-form on pixel distance as the camera moves, not
across a band of scale.

#### French address layers (September 2026)

Six layers scan around the ground point the camera is LOOKING AT — via
`deriveFetchCenter()`, shared with the traffic layer — rather than over the
viewport, because all of their upstreams take a coordinate and a radius, not a
box; the permit registers go further and are published per COMMUNE, which a box
cannot even name. They go dormant and clear their draw above 12 km
(`idfm-network`: 20 km), and report `dormant` in `getStats()` so an empty screen
is never ambiguous between "too high to scan" and "this address is clear".

**The looked-at point is read on the drawn surface, not on the ellipsoid**
(`cameraScanPoint`, since 2026-09-21). It was `camera.pickEllipsoid` at the
canvas centre, and a city is not at height zero: Lyon's Presqu'île stands at
229 m of ellipsoidal height, so under a tilted camera the centre ray met the
street and went on down to the ellipsoid, 328 m further along the ground
(measured at 350 m above the street, −35°). The 200 m DPE disc and the 300 m DVF
disc were drawn wholly beyond the block at the middle of the screen — 0 of 27
DPE badges in the middle half of the view, 264 px above the centre line on
average. `sceneGroundPoint` answers instead — terrain when the globe is shown,
the depth buffer on the photoreal stack, the ellipsoid only when neither
answers — and the same view now puts the scan centre 0 m from the looked-at
street and 39 of 39 badges in the middle half. The box regimes above 600 m are
built from the same point. `scripts/qa-dpe-focus.mjs` measures it.

**Three of the six now paint the BD TOPO volumes instead of only pinning them**
(2026-09-03, via `src/data/buildingTheme.js` — see the Bâti 3D row above for the
registry contract). `dpe-fr` reduces a building to the MODE of its diagnostics,
ties broken by the worst letter, and its badge goes QUIET (14 px instead of 22)
only where the volume underneath already says the letter — so a unanimous block
falls silent and a B→F block keeps every dissenting badge on its roof.
`dvf-sales` takes the MOST RECENT mutation, never a median: the editions span up
to five years, so a median would publish a price nobody paid on a date that does
not exist — and it keeps that mutation even when it has no €/m², painting the
volume a declared neutral rather than sending a building that has just changed
hands back into the “no sale here” wash. `ads-fr` offers only dossiers that can
bear on EXISTING fabric (declared work on an existing building, demolition
permits, and unpublished nature); a declared new build and a development permit (*permis d'aménager*) —
which authorises LAND — are held back, counted, and stay badges. Since
2026-09-23 `ads-fr` paints the classes of the « Urbanisme » row
(`permitProjects.js`: violet granted, amber started, blue finished, grey
cancelled, red demolition, teal under review) — the palette its markers, now
BADGES rather than cranes, and the Sitadel parcels wear too — and a permis de
démolir is the demolition class whatever its state. Its markers skip the
dossiers `sitadel-fr` already draws on their parcels (`sitadel/drawnDossiers`),
so one permit is one badge; what stays is what the parcels cannot show: the
files under review in Paris, Bordeaux and Nantes, the non-residential permits
and the permis d'aménager, and the permits the cadastral join could not place.
Its card is printed in the key, with *Localisation à confirmer* when the marker
is geocoded to a street or a locality, or drawn on the parent of a divided
parcel, and the globe keeps *N logements · Repère approximatif*. Its row line
no longer carries the theme ledger (*8 des 17 dossiers peignent le bâti 3D…*):
`getStats().themeLine` keeps it, and the Bâti 3D row counts what it painted.

**The join is by IDENTIFIER first since 2026-09-07, and by geometry only then.**
The Référentiel National des Bâtiments gives every building in France one stable
key, and the BD TOPO tiles this repository already draws carry it
(`identifiants_rnb`, 95.5 % to 99.2 % of drawn footprints). The ADEME DPE
register publishes the same key as `id_rnb` on 34.5 % to 73.7 % of its rows
depending on the commune, so `dpe-fr` no longer needs a coordinate to reach a
volume — and the coordinate was never a claim about a building. Measured over
four boxes: diagnostics reaching a drawn volume go 81.8 % → 96.3 % (Paris 13e),
40.4 % → 75.7 % (Lyon 2e), 78.8 % → 88.9 % (Marseille), 14.0 % → 41.5 %
(Ustaritz), and 2 to 83 rows per box were being painted on a NEIGHBOUR's roof.
The two paths are counted apart (`themeMatchedById` / `themeMatchedByPoint`,
*96 % par identifiant RNB* (“96% by RNB identifier”) on the Bâti 3D row): they paint the same colour and
are not the same claim. The join costs no request — both registers carry the key
— and `rnbPivot.js` states the two multiplicities that break a naive index (one
emprise merging several RNB buildings; one building drawn as several emprises).
`npm run qa:rnb-pivot` re-measures all of it, including the 573-of-573 agreement
between the RNB's own `bdtopo` identifiers and the tiles' `cleabs`. DVF and the
permits are NOT joined this way and cannot be: the geolocated DVF file publishes
no RNB column, only `id_parcelle`, and the parcel→building relation has no bulk
endpoint.

**A selected volume names itself.** Clicking a building fires one keyless,
unproxied RNB lookup (~170 ms) and the card gains the BAN addresses that
building answers to and the cadastral parcels it stands on. A footprint IGN
published without an identifier (4.5 % of Paris) is resolved by proximity
instead, and the card says so — a guessed identity must not read like a
published key.

**Scope mismatch, declared rather than corrected.** The scans cover 200 m (DPE),
300 m (DVF) and 400 m (ADS) while the building layer loads a box up to 0.08°,
i.e. 8.90 × 6.04 km = 53.8 km² at the 47th parallel — up to 107× more. At most
~1 % of the volumes on screen were ever inside the question. Each theme's
"no data" label therefore names BOTH silences (*hors du rayon de 300 m ou sans
mutation*, “outside the 300 m radius or no sale”), and the honest count lives on the Bâti 3D row rather than being
recomputed on each theme's row, which would give two numbers for one fact.

| Layer | Token | Proxy | Upstream |
|---|---|---|---|
| `georisques` | `gr` | `/api/georisques` | Géorisques (BRGM) — 3 endpoints fanned out per scan |
| `dvf-sales` | `dv` | `/api/dvf` | geo-DVF CSV per commune-year, parsed and cached server-side |
| `avis-valeur` | `vv` | `/api/avis-valeur` | the SAME geo-DVF editions, read as comparables — the estimate, not a source |
| `dpe-fr` | `dp` | `/api/dpe` | ADEME `dpe03existant` — a `geo_distance` query below 600 m; above it the rows of a box (parcels) or a 50 m `values_agg` grid (sections), placed on the Etalab cadastre |
| `urbanisme-gpu` | `ur` | `/api/gpu` | APIcarto `zone-urba` + `assiette-sup-s` |
| `idfm-network` | `if` | `/api/idfm/stops`, `/api/idfm/lines` | Île-de-France Mobilités Opendatasoft |
| `ads-fr` | `au` | `/api/ads-fr` | Sitadel (SDES DiDo, 4 datafiles) + Paris / Bordeaux / Nantes / Tours ADS portals + Brest métropole's granted permits (ArcGIS) + 217 Cart@DS *affichage réglementaire* boards (1 730 municipalities) and Sirap PU boards (1 067 communes), both with a daily archive and both mostly found by `npm run permits:scan` + the e-permis boards of Métropole Nice Côte d'Azur (38 communes), the Agglomération Pau Béarn Pyrénées (28) and eighteen more communes (daily archive) + publication-actes.fr acts and lists of filed dossiers (Ustaritz, Ciboure, Monts) + the lists Marseille, Nîmes, Lyon, Béziers, Aix-en-Provence, Argenteuil, Mulhouse, Annecy, Clermont-Ferrand, Versailles, La Rochelle, Limoges, Saint-Priest, Wattrelos, Lambersart, Achères, Balma and Anzin publish and the arrêtés of Lille's daily bulletin, read by OCR, with a daily archive + Montpellier Méditerranée Métropole's favourable decisions (ODbL, 28 communes), with a daily archive that dates what each edition adds + Etalab cadastre (current and dated editions) + BAL + BAN bulk geocoder |

### `dvf-sales` above 600 m — the cadastre, not discs

Below 600 m the layer is unchanged: a 300 m disc of sales, one € marker each,
the parcel each sale bought washed under it. Above 600 m (`scanRegime.js`,
`SCAN_BANDS[].dvfUnit`) it asks `/api/dvf` about a grid-snapped BOX and paints
the cadastre's own shapes, **not** the 150 m / 850 m discs it drew until
2026-09-21 — a disc fell across two blocks and a boulevard and named no ground
a reader could see:

- **600 m to 1 800 m — plots.** Every parcel a sale in the box names
  (`dvfFeed.aggregateSalesIntoPlots`), painted by its MOST RECENT sale divided
  by its own commune's median: the same sale, picked by the same function
  (`dvfFeed.mostRecentMutation`, shared with the client since this change), and
  therefore the same colour the plot wears under its markers below 600 m. A
  plot whose latest sale has no €/m² is neutral. Geometry is the Etalab commune
  parcel file, cut server-side to the parcels the commune's editions name
  (3 267 of 6 887 in Paris 16e), kept for eight communes and on disk
  (`.gev-cache/address/dvf-parcels-<insee>-<years>.json`), and served as flat
  integer offsets at 1e-5 degree (`dvfFeed.encodeRing`): as `[[lon, lat], …]`
  pairs the Paris 16e answer held 2.05 MB of server heap and 660 KB of JSON,
  encoded 0.97 MB and 416 KB (70 KB gzipped) — and the address cache keeps 300
  answers whole.
- **Above 1 800 m — cadastral sections.** Every section a sale in the box
  falls in (`sectionIdOf`: the parcel id's first ten characters, 0 misses over
  12 039 parcels), drawn WHOLE and painted by the median of the ratios of ALL
  its sales in the editions, from `DVF_SECTION_MIN_PRICED` = 3 priced sales up;
  a thinner section is neutral and its key row says *fewer than 3 priced
  sales*. Geometry is Etalab's `cadastre-<insee>-sections.json.gz`
  (`.gev-cache/address/dvf-sections-e5-<insee>.json`).

Measured before it was built, editions 2023–2025, geometry as nested pairs:
the densest fine box (Paris 17e) is 1 698 plots / 23 692 vertices / 149 KB
gzipped; Paris 16e 1 207 plots, 97 KB (70 KB once encoded); the coarse box west
of Paris would have been 11 547 plots and 875 KB, which is why the band above
1 800 m draws its 413–566 sections instead.
Warm, both answers come back in about 2.5 s; cold, the section box over eleven
communes took 14 s, nearly all of it DVF editions.

**Drawn as primitives, not entities**, the way `cadastreParcels.js` draws its
parcels: one classification `GroundPrimitive` per colour (six at most — a
batch mixing colours repaints its neighbours along their bounding rectangles)
and one `GroundPolylinePrimitive` for every edge. On a Mac, Paris 16e: 3.9 ms of
main thread for 1 207 plots, ready 0.27 s later. The shell tears them down
through `addressScanLayer`'s new `onClear` hook (redraw, dormancy, destroy), and
a click reaches them through `ownsPick` + `groundCard`: the plot or section
under the click is found by geometry (`ringGeometry.pointInPolygons`), not by
the pick. A plot's card is its latest sale's, in the six lines the card shell
paints, ending with *the latest of this parcel's N sales*; a section's says what
its colour is the median of. The key restates the classes in €/m² when the box
lies in one commune and in ratios when it straddles several; the building theme
is withdrawn above 600 m, as it was for the discs. `getAreaDraw()` reports the
draw to harnesses. `/api/dvf` keys the area answer `dvf-area|…`, so no cached
disc answer is served to the new client.

**The surface is on every sale card.** `dvfSaleKindLine` puts it on the type
line — *Appartement + Dépendance — 78 m²*, *… m² au total* for a sale of
several dwellings — because the card shell paints six detail lines and the
surface used to be the seventh.

**The row's toggle no longer switches the estimate on.** `avis-valeur` is an
`optIn` companion of `dvf-sales` since 2026-09-21, like `comparables-fr`: the
*Estimer un bien* (“Value a property”) chip turns it on.

**A selected sale is printed in the key, and its plot is lit** (2026-09-21).
`createAddressScanLayer` gained two hooks: `onSelectionChange(card | null)`,
called on every open and every dismissal (then a `gev:layer-draw-changed` so
the key repaints), and `compactCard(card)`, asked at each paint, which keeps
only the card's title on the globe. `dvf-sales` uses both: on a desktop with
the key open and visible (`dvfKeyCarriesSelection`), the card on the globe is
a one-line address tag and the whole card goes to the key through the new
`legendSelection` slot of `getRowControls()` — title, meta line, headline,
lines, a metric with swatch and captions, a footnote and an `https:` link,
normalised by `manager.legendSelectionOf` and rendered under the block's
classes, with a × that calls the layer's new `clearSelectedCard()`. A new
selection is scrolled into view once, and again each time the list's box
changes size for up to 3 s (`_revealLegendSelection`, a `ResizeObserver`
that a wheel, pointer, touch or key on the list ends): the card lands before
the rail's layout pass shrinks the key, which cut it under the price at
1440 × 900. Since the same day the whole key is set larger — class rows
13 px, notes, sources and blurbs 11.5 px, the card's address 16 px, price
32 px, €/m² 18 px — so the DVF classes stack one per line and the key
scrolls sooner. With the key folded, hidden by the
clean view, or on a phone (`html[data-shell="phone"]` hides the section;
`phoneSelection.js` keeps its tab), the globe card stays whole. The plot the
sale bought — or, above 600 m, the plot or section under the click — is
redrawn as an unpickable `GroundPrimitive` + `GroundPolylinePrimitive` pair
in the class colour (fill 0.6, 3 px ring 0.95), which on the photoreal mesh
paints the building's walls and roof; the ring is NOT the selection cyan,
because a ground polyline drapes down every façade on the boundary.
`selectionFor` redirects a washed plot's edge to the marker of the sale the
wash is painted from. The bottom class of the ramp is `#0f8f55` (was the
turquoise `#3dd6c4`): two greens apart by lightness, ΔE76 42.1.

### `dpe-fr` above 600 m — the cadastre, on the A–G scale

Below 600 m the layer is unchanged: a 200 m disc of ratings grouped into sites,
each on its building's footprint. Above 600 m it asks `/api/dpe` about the same
grid-snapped BOX as the price layer and paints the cadastre's own shapes on the
official A–G scale, **not** the geohash discs it drew until 2026-09-22 — discs
sized by their count and coloured by their share of F and G on a ramp of their
own. The operator's request, over Lyon's Presqu'île: the parcels of the
buildings concerned, and the DPE scale « même sur la vue dézoomée ».

Every shape is painted by the MOST FREQUENT class of its own ratings, ties to
the worse (`dpeSites.dpeSummaryFromCounts`, the rule `dpeBuildingSummary` now
calls), so a parcel wears the colour its building wore close up. No mean of
letters is computed; the card names the mode as « la classe la plus fréquente »
and prints every class present, and the share of F and G the discs carried
stays in the key's note beside the national register's 9.75 %.

- **600 m to 1 800 m — parcels.** The proxy reads the box's ROWS, four fields
  only (`dpeFeed.DPE_AREA_FIELDS`), tile by 0.01° tile (one or two 10 000-row
  pages each; Paris 11e is 12 231 rows), folds them into one point per BAN
  geocode, and places each point on the Etalab parcel it stands on
  (`shapeLocator.js`) — or, within 3 m, on the one whose frontage it touches:
  a BAN point stands on the front door, and over Lyon 1er–2e 534 of 1 107
  points were within 2 m of a parcel and outside it (Paris 11e: 1 177 of 1 185
  inside). Measured over Lyon's Presqu'île, 0.02° box: 22 567 ratings, 11 206
  placed inside, 11 204 from the frontage, 157 on no parcel; 2 469 parcels,
  607 KB of JSON, 99 KB gzipped, 9 ms warm. Tiles are cached a week in memory
  and on disk (`.gev-cache/address/dpe-points-*.json`); a commune's whole
  parcel file is indexed for eight communes at a time, as ONE float32 array of
  offsets per commune (`shapeLocator.js`): Toulouse's 91 938 parcels hold
  46 MB, where GeoJSON's nested pairs held 181 MB.
- **Above 1 800 m — cadastral sections.** A 0.08° box holds 227 114 ratings
  over Lyon and 513 554 over central Paris, 14 to 52 pages of rows per camera
  settle, so the ADEME aggregates them instead: `values_agg` nests a histogram
  on the register's own Lambert-93 coordinates under the commune and over the
  letters (`dpeFeed.buildDpeGridUrl`), one request per 0.04° tile, and every
  50 m square holding a rating comes back with its seven counts (central Paris:
  102 104 ratings, 5 230 squares, 92 KB, 3.2 s, exact sum). 25 m trips the
  ADEME's Elasticsearch circuit breaker over Paris (HTTP 429 « Data too
  large »); the proxy retries a 429 once after 1.5 s. Each square goes to the
  section under its centre, and a section is COLOURED only when at least three
  ratings fall in squares wholly inside it (`DPE_SECTION_MIN_GRADED`): measured
  against point-by-point placement over one Lyon tile, 5.6 % of ratings land in
  a neighbouring section and two sections holding none received 3 and 89; the
  whole-square floor turns both neutral and every coloured section keeps its
  exact letter (14 of 14). Over central Lyon: 402 sections, 345 coloured
  (179 C, 149 D, 13 E, 4 B), 54 KB gzipped, 6 s cold. The section files are
  the price layer's (`loadCommuneSections`, now shared), and each commune is
  named once through the BAN — « Lyon 7e Arrondissement », where the BAN says
  « Lyon ».

**Only the tiles on screen are asked for, and the wait is the ADEME's.** The
client narrows the box to the tiles `viewGate.cameraViewBox` touches, with a
~100 m margin (`scanRegime.scanTileMask`, sent as `tiles=0110`; a bad mask
reads as the whole box, never a wider one), so a low, straight-down view asks
for one or two tiles instead of four; nothing is fetched ahead of the reader.
Measured cold on 2026-09-22, the rows are the whole wait: over Bordeaux
centre, 4.7 s of ADEME pages, 0.9 s of cadastre, 37 ms of placement. A
10 000-row page took 0.2 s to 11 s for the same size of answer. The time is a
matter of ROWS: over untouched tiles, 1 row answers in 0.10–0.17 s, 500 in
0.15–0.25 s, ~5 000 in 0.65–1.0 s, and the register gets through 0.14–0.31 ms
per row whether it is asked one, two or four tiles at a time — so more in
flight wins nothing and the tiles go two at a time. Its own aggregation of the
same tile into points (`values_agg` on the Lambert coordinates) was slower,
1.4 to 2.3 s against 0.75 to 1.6 s for the rows, so the rows stay. Each tile's
parcel files are requested as soon as its rows name them, under the wait.
Cold over the whole box: Lille 1.5 s of rows, Grenoble 4.2 s, Nantes 3.8 s,
Strasbourg 5.0 s, Toulouse 7.4 s; warm 8 to 13 ms.

**The next kilometre is loaded while the reader looks at this one.** Once a
view's answer is built, the proxy queues the ring of tiles around it
(`scanRegime.scanTileRing`, up to twelve, nearest the reader first) and loads
them one at a time, server-side only — the browser still receives only its
screen. The queue pauses whenever a reader's own request is waiting on the
ADEME, the latest view's ring replaces an older one, and a refusal stops it
for a minute. The operator chose this among three measured options (the
ring, the rest of the box, nothing). Measured over Grenoble: the view cold in
4.2 s, its ring of 12 tiles in 7.7 s behind it, then moves of a kilometre east,
north and south-west answered in 64, 12 and 30 ms instead of one to two
seconds; Brest asked cold one second into Dijon's ring answered in 3.1 s, its
normal time.

Drawn through `groundAreaPaint.js`, extracted from the price layer for both:
one classification `GroundPrimitive` per colour (eight at most), one
`GroundPolylinePrimitive` for the edges, a click answered by geometry through
`ownsPick` + `groundCard`. The layer is now `redrawOnMapStack: true`. A click
opens the shape's card in the key — for a parcel its busiest address and up to
two more, the count, the classes present and their range, the mode with a tie
named, the *passoires*, how many ratings were placed from the frontage; for a
section its code and commune, and how many ratings lie in whole squares — and
lights the shape in its class colour ringed in white. The key's seven plates
still filter (`classes`, draw-only): a shape stays if it holds a shown letter
and is repainted from those letters, while the counts stay the whole answer.
The building theme is withdrawn above 600 m, as it was for the discs.
`getAreaDraw()` reports the draw; `npm run qa:dpe-area` checks both bands on
the reader's view, and `qa:scan-cells` checks the switch with the price layer.
The route keys the box answer `dpe-area|…`, so no cached disc answer is served
to the new client.

### `avis-valeur` — the estimate, and the two uncertainties it never merges

`avis-valeur` (`vv`, `/api/avis-valeur`, `src/data/avisValeurFeed.js` +
`src/data/avisValeur.js`) is the seventh address layer and the first whose
product is a NUMBER WE COMPUTED. The Cityscan teardown (#99) put it at the top
of tier 2 (#101): of the eleven data routes behind `app.cityscan.fr` not one
carries a source we do not already have, and their own public translation file
credits *Source : Algorithme* (“Source: Algorithm”) for exactly one module — the
estimate.

**One plugin, two routes.** The estimate reads the SAME memoised commune-year
editions `/api/dvf` was drawn from (`dvfProxy` in `vite.config.js` mounts both),
so a card can never quote a median the dots on screen were not part of, and an
estimate costs zero extra downloads once the sales layer has scanned. The
edition store now memoises the PENDING PROMISE rather than the finished array:
measured before that, eight subjects asked about one doorway concurrently
produced **eight downloads of the same 750 KB edition**, because the shared
in-flight coalescer keys on the whole request and two subjects never met.

**Never a price without its interval, and never an interval without saying which
uncertainty it is.** `prixM2.p25`–`p75` is where comparable goods actually
traded per square metre — the market's own dispersion, which does not shrink
with more data and does not bound the subject. `prixM2.ci90` is the classical
distribution-free interval on the MEDIAN, `[x(k), x(n+1−k)]` with coverage
`1 − 2·P(Bin(n, ½) < k)` accumulated in log space (a Paris commune rung reaches
1 802 comparables and `2 ** 1024` is `Infinity`). Nominal coverage 93,8 / 93,0 /
96,1 / 90,1 % at n = 5 / 8 / 12 / 30; **resampled 3 000 times from the 4 192
Paris 13e flat sales of editions 2023–2025 it measures 93,6 / 93,0 / 96,9 /
90,8 %**, and 94,2 / 92,9 / 95,9 / 89,8 % over Rodez's 1 214.

**Both ends of it are printed, never one `±`.** An interval built from order
statistics is asymmetric whenever the sample is, and half its width is not its
distance from the median: 20 comparables at 600 × 6, 1 000 × 10, 1 400 × 4 give
a median of 1 000 and an interval of [600, 1 000] — half-width 20 %, lower bound
**40 % below the median**. Live on avenue de France the Paris answer reads
**−5,3 % / +3,2 %**, where a `±` would have said 4,3 %.

**The floor of five is derived.** At n = 4 the widest such interval — the whole
sample — covers the median with probability 0.875, so no 90 % interval exists.

**The centre is published only when two clauses hold**: the interval on the
median is STRICTLY narrower than `p75 − p25` (we must know the middle better
than the market is dispersed — no constant in it), and neither of its ends sits
more than 20 % from the median. Strictly, because the equality case is the
degenerate one: a sample with no spread has both quantities at zero, and a `>`
comparison published *1 000 €/m², ±0 %* (“€1,000/m², ±0%”) from twelve identical prices with
96 % confidence attached. Measured on live ground the two clauses catch
different things: around Aurillac at 300 m, 43 sales give 973 €/m² at ±22,6 % —
clause 1 passes, clause 2 refuses, and the 600 m rung answers 1 333 €/m² at
±8,2 %, so the refused answer was 37 % away from the one 159 sales agree on. At
Biarritz the 1 500 m rung returns 7 sales whose interval is wider than the
interquartile range; clause 1 refuses and the commune rung answers 4 127 €/m² at
±6,9 %.

**Two disclosures the arithmetic does not make on its own**, both on the card
and in the legend. *Distribution-free removes an assumption about shape, not
about sampling*: the interval is exact for independent draws, and the
comparables are a near-census of one pocket, so the honest reading is a model
(“these sales behave as an independent draw from the price law of this
pocket”). And *the rung is chosen with the same prices that then set the
interval's width*, which can only lower real coverage — measured by resampling
each commune's own price law onto its own geography, 4 000 draws each:
**92,5 % (Paris 13e), 91,9 % and 92,0 % (Rodez), 92,8 % (Biarritz)** against
nominals of 90,1 to 96,9 %. On a law built to break it — two atoms at 1 000 and
10 000 with the population median at 5 500 — the same procedure covers 89,8 %
across all rungs and **0 % across the 931 centres it agrees to publish**. No
in-sample test catches that; the shape is a commune whose two halves are two
markets, and it is written down rather than patched.

**Three answers, three sentences (A1)**: `comparables` (a centre and a band),
`range` (the band, the centre named as WITHHELD, and the clause that withheld
it), `none` (nothing at all). The subject marker is painted `#00ffa3` for the
first and `#9aa7bd` for the other two, and it is the pack's **target**
silhouette rather than the euro: the comparables are real mutations and keep the
register's own sign, so the one marker that is not a transaction is the one that
is not a euro sign.

**The euro band is not a range anyone paid.** It is the €/m² band multiplied by
the SUBJECT's surface, and it is printed on its own line saying so — *soit
417 000 € à 545 000 € ramené aux 60 m² du sujet — pas des prix payés* (“i.e.
€417,000 to €545,000 scaled to the subject's 60 m² — not prices paid”). Printed
as one sentence with *la moitié des ventes comparables* (“half of the comparable
sales”) it was false whenever
the comparables were not all the subject's size: forty sales of 48 m² and 72 m²
all at 1 000 €/m² give a 60 000 € band that not one of the forty landed in.

**The ladder spends distance before surface**, and the order is measured. Rungs:
300 m ±20 %, 600 m ±20 %, 1,5 km ±20 %, the whole commune ±20 %, the whole
commune ±35 %. Widening the BAND moves the €/m² between the lower and upper half
of the band by 3,0 → 3,6 % in Paris 13e, 4,0 → 10,7 % in Lille and **13,3 →
20,4 % in Ajaccio** going from ±20 % to ±35 % — a bias that never shows.
Widening the RADIUS costs the "for here" premise, but the radius is printed,
drawn as a ring, and every rung tried is reported with the clause that rejected
it. The commune rungs draw NO ring: a commune is not a disc.

**The register's hole, named.** DVF does not cover the Bas-Rhin, the Haut-Rhin,
the Moselle or Mayotte — the *livre foncier* départements. Measured 2026-09-08
on the 2024 edition, `67482`, `57463`, `68224` and `97611` each answer **404
with a 233-byte body** while `97411` (La Réunion) answers 200 with 647 463 bytes
— so the hole is four départements and not "the overseas territories", which is
the guess that would have been wrong. `dvfCoverage()` separates
`register-does-not-cover` from `no-comparable`, and `/api/dvf` carries the same
field so the sales layer stops reading as "nothing was sold in Strasbourg".

**A 404 and a timeout are no longer the same edition.** `loadEdition` used to
cache every failed download as an empty commune-year, in memory with no TTL and
on disk for a week, so one reset made an outage permanent and the estimate
published from the surviving years without saying so. Only a 404 is cached as
empty now; anything else returns `null`, is not remembered, and is passed to the
card as `unavailableYears`, which the card prints as *ces éditions EXISTENT et
ne sont pas arrivées* (“these editions EXIST and did not arrive”).

**Four exclusions, each counted and named on the row.** VEFA (a dwelling that
does not exist yet — measured on Paris 13e editions 2021–2025, the 9 priced VEFA
sit at 13 077 €/m² against 9 150 for ordinary resale, **+43 %**); the one-euro
flat (`round(1/88)` is **0**, a number, which clears every guard upstream — 7 in
Paris 13e, 6 in Bordeaux, 6 in Lille, 1 in Aurillac over editions 2023–2025, one
of them a 166 m² flat on place Pinel); a priced sale with no coordinate, which
no radius can test; and the same mutation handed in twice. That last one is a
query string: `years=2025,2025,2025,2025,2025` used to reach the projection as
five copies of every sale — 28 comparables became 140 and the interval narrowed
from [7 969, 8 359] to [8 052, 8 220] — so the route deduplicates the years and
the projection deduplicates the ids. What is NOT excluded is the low tail above
zero: across 31 609 priced resales in nine communes the declared values run 1 €
→ 160 € → 400 € → 1 800 € → 3 000 € → 4 950 € → 20 000 € with no break, so any
cut would be a plausibility model wearing a constant's clothes. The retained
sales declared under 10 000 € are COUNTED (`symbolicCount`) instead — and the
euro rounding is derived from the magnitude for the same reason, because a flat
1 000 € step turned every positive total under 500 € into *0 €* (“€0”).

**The drift is measured and printed, never applied.** Commune median €/m² 2023 →
2025: Paris 13e −4,3 %, Bordeaux −9,2 %, Lille −3,6 %, Rodez −0,5 %, Ajaccio
+1,6 %. A median comparable in a three-edition window is ~18 months old, so the
residual bias of not correcting is 2–5 %. The correction's own noise — a
commune-year median is itself a sample median, ±7 to ±11 % at 30 sales in the
year — is larger than what it would remove. The per-edition medians and counts
are shown; nothing is restated in another year's money.

**A click pins the subject**, the same wrapper `isochroneRings.js` uses, and the
pin lifts the altitude ceiling. Two things changed in the shared shell for it,
and both are bugs the other six layers had too: `setScanPin` now FORCES the
rescan, because the 250 m movement guard describes camera drift and a pin is not
drift (measured, a pin moved 111 m changed `getParams().centre` and fired no
request at all, leaving the answer describing the previous door); and
`setParams` validates every key before applying any, because it used to write
each key as it checked it and so returned its documented refusal with half the
change already in force.

`npm run qa:avis-valeur` proves the whole boundary in a real browser over Paris,
Les Monts-Verts (Lozère) and Strasbourg: dormancy at 40 km with no request, the
card surviving the factory's own ` · ` splitter, the three band classes counted
against the comparables drawn, the subject changing the comparable SET rather
than rescaling one, the pin, a live `range` refusal naming its clause, and the
livre-foncier sentence.

`ads-fr` is also the only one of the six that carries a CONTROL. It offers
four windows — **6 months, 1 year, 3 years and 13 years**, the *Période* menu
under the « Urbanisme » row (*6 derniers mois* / *Dernière année* / *3 dernières
années* / *Toutes les dates*) — where the query used to carry two frozen
constants, and the default stays at three years so nothing moves for a reader
who touches nothing. 13 years is Sitadel's whole span (`ADS_MAX_MONTHS`), and
the rung that reaches a finished house — Ustaritz's `06454721B0009` was
authorised 2021-07-20 and read in 2026-09, so a 36-month floor of 2023-09-01
hides the permit that built it. A chantier outlives the window that shows it.
The two short windows, since 2026-10-01, show what moved lately: the files under
review and the decisions whose objection period is open. Sitadel runs about six
weeks behind, so in the 6-month window its permits cover about four and a half
months, and the communes' own boards the rest. They replaced a 6-year window
(2026-09-23 to 2026-10-01; three chips before the menu).

The choice rides the share link as `lo=au.w.<code>` — `h` for 6 months, `1`,
`3`, and `d` for the whole register — which makes `ads-fr` the first of the six
address layers to own a layer-state option: a window is a question, and
reopening the same block over another span is a different answer. A link
written with the retired 6-year code `6` opens on the whole register, the
window that still holds every permit its author saw; `6` is never reused. The values
are a CLOSED SET and `setParams` REJECTS anything outside it rather than
clamping — everything reachable through that path is reachable from a
stranger's URL, and snapping a stale link's window to the nearest legal value
would answer a question nobody asked while looking exactly like the one they
did. The chips and the parameter gate are one mechanism seen from two ends;
`addressScanLayer.js` grew `runtimeParams`, `rowControls`, `getParams` and
`setParams` for it, so the other five layers can take controls later without a
second mechanism.

The ACTIVE chip carries the truncation warning, because widening the window is
what causes it: `ADS_MAX_PERMITS` serves the 400 nearest dossiers, so on a dense
block a longer window does not add history — it trades the far edge of the
circle for it, and nothing on screen says so.

`ads-fr` is the only one of the six that reads TWO registers and merges them on
the dossier number. Sitadel is national, monthly, about six weeks behind, and
holds authorisations that were GRANTED only — the SDES dictionary says so, and
there is no national open feed of applications under instruction because
Plat'AU is closed. The three métropole portals supply exactly that missing
half, daily. Since 2026-10-01 two city portals join them: Tours
(`data.tours-metropole.fr`, weekly, the commune only), which lists a dossier
once per parcel and per step — 3 198 rows for 1 887 dossiers in the year to
2026-10-01, folded back into one (`foldLocalRows`) — and writes its numbers
with a five-digit commune (`DP 37261 26 T1181`), rewritten to Sitadel's
`037261…` so the two registers meet; seven of its rows in ten have no point,
so it is asked by commune and placed on the parcel every row names. And Brest
métropole's eight communes, from an ArcGIS map service asked by radius, which
publishes the permis de construire and certificats it has GRANTED only, with
their decision date — three days old on 2026-10-01. Both halves are cached per commune-window on disk for a week: a
cold commune costs four sequential DiDo calls (parallel ones are rate-limited
to HTTP 429) plus one bulk BAN geocode — measured at 13-15 s for Paris — and
every scan inside that commune afterwards is served from cache.

**Since 2026-09-30, 129 more communes answer with what they post themselves.**
Their permits are instructed with Inetum's Cart@DS software, whose public
*affichage réglementaire* board is the same table on every instance: filing
notices (*avis de dépôt*) and decisions, every family, 0 to 7 days after the
fact (`src/data/cartdsFeed.js`). Twenty-two instances are written by hand — Bretagne
romantique (41 communes), Saint-Étienne Métropole (34), Aix-Marseille-Provence
(26), Dijon Métropole (22), Brie Nangissienne (20), Orléans Métropole (12),
Grand Libournais (9), Pays de Fayence (8), Le Cotentin (6), the Grand Nancy
(4), ATD 24 (2), Toulon, Champigny-sur-Marne, Joinville-le-Pont,
Charenton-le-Pont, Maisons-Alfort, Porto-Vecchio, Châtillon, Soultz-Haut-Rhin,
Conches-en-Ouche, Sainte-Marie on La Réunion and the Grand Reims (5: Bétheny,
Cormicy, Hermonville, Taissy, Witry-lès-Reims — not Reims, which its menu
does not offer); the eight added on 2026-10-01 brought 65 communes and 1.13
million inhabitants, the Grand Reims 161 rows on its first reading. Its front
(`portailprourba.grandreims.fr`, outside the `geosphere.fr` family the scan
walks) refuses a board's POST that does not name the page it comes from, so
every board request now carries the page as `Referer` and its origin as
`Origin`, as the page's own form does — a same-origin check, no challenge,
the user agent unchanged. The four
`pemb.fr` hosts send their certificate without the Sectigo intermediate that
signed it, and so has `ads.lecotentin.fr` since it renewed its certificate on
2026-09-30, which Node refuses; the server adds that one intermediate to its
default CA list at start (`trustCartdsIntermediates`), and the chain must
still end at a root Node ships. Toulouse Métropole's board sits behind a
JavaScript challenge and is not read. The proxy honours each host's `robots.txt`,
re-read daily, so a host that adds a refusal stops being read — except the
five that already answered `Disallow: /` on 2026-09-30 (Le Cotentin, Grand
Libournais, Conches-en-Ouche, Sainte-Marie, Brie Nangissienne), which the
project decided to read anyway and which carry `robots: 'overridden'` in the
registry. A filing notice with no decision
posted is drawn as *Déposé* (“Filed”), never as under review — a tacit decision
is posted by some communes and not by others. Private applicants' names are
dropped at collection, and pre-emption notices (`IA`, a sale with its price)
and building-code authorisations (`AT`) are not read. Each commune is read at
most every six hours (one page, two table requests), placed on its parcel
first — 780 of Orléans's 799 posted dossiers on 2026-09-30, 64 of Ventabren's
76 — and geocoded for the rest; a cold Orléans scan takes 25 s with Sitadel,
and a warm one is served from `.gev-cache/address/cartds2-<insee>.json`.

**What a board lets go is kept.** A board holds a decision for its two-month
posting period (Code de l'urbanisme, art. R.424-15) and nothing public keeps
it afterwards, so every row the server reads is stored once, as posted, with
the first and last day it was seen — `.gev-cache/archive/cartds/<insee>.json`,
applicant already filtered, sales never stored (`src/data/cartdsArchive.js`).
The layer draws the archive, not the board: a dossier merges with Sitadel on
the number like a métropole row, and one that has left the board is still
drawn with its decision. Two decisions kept for one dossier — a grant and its
later withdrawal — resolve to the later one. When a board does not answer,
the archive is served alone, marked `live: false` and not cached. Under
`vite preview`, the hosted server, every board is swept once per French
calendar day whether or not anybody looks (about 3 200 requests one second
apart, about an hour since the scan below; `sweep.json` in the same directory says what the
last sweep read); under `vite dev` it is off. `CARTDS_ARCHIVE=daily|off`
overrides either, and `npm run cartds:archive` runs the same sweep from a
shell (`--join <dir>` folds in an archive swept elsewhere). The archive starts
on 2026-09-30: what a board had let go before then is lost, and older dossiers
still come from Sitadel alone.

**Since 2026-10-01, 56 more communes answer from the other family of boards.**
Sirap's « Portail Usager », the filing portal of the NEXT'ADS instruction
software, serves each commune's *affichage réglementaire* as open JSON
(`<host>/api/v1/communes/0<INSEE>/affichage-reglementaire`, no key, no
session; `src/data/sirapFeed.js`): Rennes Métropole's 40 communes (2 475
dossiers posted that day, 798 in Rennes), the Communauté urbaine de
Dunkerque's 14 (799), Antibes (333) and Asnières-sur-Seine (180), whose own
site links no board at all. Dunkerque reads three boards, because the PU still
posts Fort-Mardyck and Saint-Pol-sur-Mer apart, under the codes they had
before Dunkerque absorbed them in 2010; their parcels sit in Dunkerque's
cadastre under those codes as prefix. Each commune is read at most every six
hours, one request per board, placed on its parcel first — 773 of Rennes's
797 dossiers, 327 of Antibes's 332 — and geocoded for the rest; a cold Rennes
scan takes 33 s with Sitadel, a warm one is served from
`.gev-cache/address/sirap1-<insee>.json`. The rows are kept exactly like a
Cart@DS board's, by the same archive code, in `.gev-cache/archive/sirap/`, and
swept on the same daily clock (about 1 100 requests, some 20 minutes since
the scan below). The applicant is filtered and the architect never stored.
Every PU host answers `robots.txt` with its own app page, which is no file; a
host that publishes one is obeyed.

**Since 2026-10-01, a scan of the platforms adds 2 239 communes.** Reading the
sites of the 1 000 most populous communes found boards one by one; asking the
platforms which communes they serve finds them all at once
(`scripts/permit-boards-scan.mjs`, `npm run permits:scan`). Cart@DS: the
Wayback Machine lists some 320 tenants of the `geosphere.fr` hosting family,
the DNS confirms 68 more whose names were guessed from commune and
intercommunality names (the family has no wildcard, so a guess costs its
servers nothing; demonstration and training tenants are left out), and
nineteen boards on hosts of their own were found on the
communes' sites; each host is asked for its board page, its commune menu and
five rows of each board of each commune. Sirap: its shared portal
(`portail-usager.sirap.com`) lists the 2 692 communes it posts for and four
intercommunal PU hosts list theirs, and every board is asked once. A commune
is kept when its board posted within three months (`LIVE_WITHIN_DAYS`, 92
days) and no other register reads it; the result is written to two generated
modules, `src/data/cartdsScanned.js` (180 instances, 1 335 communes) and
`src/data/sirapScanned.js` (1 010 communes, one instance each, so that the
card names the commune as the publisher), which `cartdsFeed.js` and
`sirapFeed.js` append to their documented instances. 129 Cart@DS boards
answered with an empty commune menu — the software is there, the posting is
not switched on — and are left out. Ninety-two of the 180 instances answer
`robots.txt` with `Disallow: /`, the hosting family's default rather than a
commune's choice (173 of the 283 `geosphere.fr` boards say the same), and are
read by the decision of 2026-09-30 that already covered five, confirmed for
them on 2026-10-01, each marked `robots: 'overridden'`; they hold 690
communes and 1.56 million inhabitants (`--respect-robots` writes the registry
without them). The scan asks two hosts at a time, half a second apart.
Menus send a commune three ways, the INSEE code, its last three digits, or —
on two departmental agencies and Pamiers — the INSEE code without its
leading zero (`codes: 'unpadded'`). Measured on 2026-10-01 against geo.api.gouv.fr's
populations: 17.5 % of the population is now seen within days, from 9.7 %;
176 of the 1 000 most populous communes, from 79.

**Since the evening of 2026-10-01, thirteen more hosts.** Checking by hand the
communes ranked 61 to 200 that no register read, and searching the web for the
board's address (`"Login/AffichageReglementaire"`), found Cart@DS boards on
hosts of the communes' own, which neither the archive nor the DNS can name:
the Golfe du Morbihan – Vannes agglomération's (59 communes, 3 682 rows on
2026-10-01), Porte de DrômArdèche's (30), the Pays d'Orange en Provence's
(4), the Vallée de l'Hérault's (2), and Saint-Nazaire, Ivry-sur-Seine,
Clichy, Choisy-le-Roi, Vincennes, Neuilly-sur-Seine, Sanary-sur-Mer, Foix and
La Chapelle-Saint-Ursin (Bourges Plus's board). They are seeds of the scan
(`CARTDS_SCAN_SEEDS`), and Villejuif's own Sirap host joins
`SIRAP_SCAN_HOSTS`. `--ask <host>` asks those hosts alone and puts their
reading into saved ones (`--probes`, `--sirap-probes`), so that adding a seed
costs that seed, not an hour of scanning; written from the readings of the
same day, the registry changed by the new hosts only. Clichy's menu names it
Clichy-la-Garenne, which the COG does not know (`MENU_NAME_ALIASES`).
Narbonne's board is a second path on the Grand Narbonne host, whose first,
Leucate's, the scan kept: the scan asks one path per host, so both are now
written by hand in `cartdsFeed.js`, and asking the path of each of the 37
communes found no third. Measured the same evening against
geo.api.gouv.fr's populations, with the e-permis publishers below: 24.2 % of
the population is seen within days, from 22.7 %; 41 of the 100 most
populous communes, from 35, and 215 of the 1 000, from 198.

**Since 2026-10-02, 25 communes the scan read but could not write.** Their
boards posted between July and September 2026, yet the registry left them
out. Fourteen menu entries named no commune of the COG: two for a ligature
the folding kept (Chambœuf, Morteaux-Coulibœuf; `foldCommuneName` now spells
`œ` and `æ` out), two for an article the COG does not carry (Le Mottier, Les
Verrières de Joux), and ten for a name of the board's own — Colmars les Alpes,
Senez - Le Poil, Château-Arnoux, Fillé-sur-Sarthe, Sanilhac-et-Sagries.
Those still send their number or unpadded code, and in the departments of the
board's other communes it names one commune; `resolveMenuCommune` takes it
when the two names start with the same word. And the Bastides de Lomagne's
board was dropped whole, its menu sending the INSEE code for 24 communes and
the bare number, 13, for Beaumont-de-Lomagne, the one that posts the most:
`menuCodes` now writes the way most entries follow and keeps the odd ones in
`values` (INSEE code → what the menu sends), which `cartdsCommuneValue`
reads first. Written from the reading of 2026-10-01 with `--day 2026-10-01`
— judged a day later, two communes whose last row was 92 days old fell out
of the window — the registry gained these 25 and lost none: 206 instances,
1 561 communes, 19 192 inhabitants more. Seven were asked again on
2026-10-02 and answered with dossiers numbered after their own INSEE code.
Clisson stays out: it posts on Inetum's demonstration tenant, next to a
commune that does not exist.

**Since 2026-10-02, relocated boards add 24 municipalities.** Draguignan's
old `draguignan.geosphere.fr` tenant times out; its municipal website now
links `ads.dracenie.com/portailccs`, which redirects to `/guichet-unique`.
The public menu and both tables post for all 22 municipalities of Dracénie
Provence Verdon Agglomération (1,527 board rows on 2026-10-02), now a seed
of the platform scan. Rixheim's website links the Île Napoléon host's
`/guichet-rixheim` board (34 filings and 38 decisions), while the scan had
stopped at its empty `/guichet-pulversheim` board. Like Narbonne's separate
path, Rixheim is written in `cartdsFeed.js`, with the same hosting-default
robots override as the other geosphere boards. Lapalud's municipal website
links `lapalud.pu.sirap.com`, which posts 29 dossiers; the shared Sirap
portal's municipality list did not name it. Its tenant joins
`SIRAP_SCAN_HOSTS`, adding one municipality to `sirapScanned.js` (1,011
scanned, 1,067 in total). The gain across all three boards is 133,000
residents, with no municipality removed or already covered by another
register. The old scan's readings remain judged on 2026-10-01, so adding
these boards does not age unrelated municipalities out of the registry:
183 scanned instances, 1,382 municipalities; 208 Cart@DS instances and
1,584 municipalities in total. Collection, privacy filtering and the daily
archive use the existing reader.

**Since 2026-10-02, 146 municipalities ranked after the 400 most populous
gain a fresh municipal permit source.** Their population ranks were checked
against [Geo API's municipality populations](https://geo.api.gouv.fr/decoupage-administratif/communes)
on that day, sorted by population descending, with the INSEE code breaking
ties. The added municipalities range from rank 485 (Lannion) to 34,889;
they have 263,056 inhabitants in total and none was already read by another
municipal register. Each posted at least one row within the last 92 days.
The public menus, rather than the authorities' territorial boundaries,
define the coverage:

| Public Cart@DS board | Newly covered municipalities |
| --- | ---: |
| [Lannion-Trégor Communauté](https://urbanisme.lannion-tregor.com/guichet-unique/Login/AffichageReglementaire) | 48 |
| [Clisson Sèvre et Maine Agglo](https://sig.clissonsevremaine.fr/guichet-unique/Login/AffichageReglementaire) | 15 |
| [Privas Centre Ardèche](https://gu-capca.numerian.fr/guichet-unique/Login/AffichageReglementaire) | 26 |
| [CC du Diois](https://gu-diois.numerian.fr/guichet-unique/Login/AffichageReglementaire) | 37 |
| [CC du Rhône aux Gorges de l'Ardèche](https://gu-ccdraga.numerian.fr/guichet-unique/Login/AffichageReglementaire) | 9 |
| [CC Sarrebourg Moselle-Sud](https://urbanisme.cc-sms.fr/guichet-unique/Login/AffichageReglementaire) | 5 |
| [Les Sables d'Olonne Agglomération](https://sig.lsoagglo.fr/guichet-unique/Login/AffichageReglementaire) | 3 |
| [Entre Bièvre et Rhône](https://gu.entre-bievreetrhone.fr/guichet-unique/Login/AffichageReglementaire) | 2 |
| [Grand Verdun](https://portail.grandverdun.fr/Login/AffichageReglementaire) | 1 |

The boards held 2,975 posting rows for these municipalities before family
filtering and dossier folding. The first complete archive sweep read all
146 municipalities successfully and retained 2,969 rows on 2026-10-02.
Clisson's real public board replaces the
demonstration tenant rejected above; La Haye-Fouassière is left to the Nantes
source that already reads it. Twelve Diois menu entries had no recent posting
and are left out. Les Sables d'Olonne's board names Île-d'Olonne, Sainte-Foy
and Saint-Mathurin, not the central city; Grand Verdun's board names Verdun
only. The SDEEG 33 Sirap board was also checked: its 94 municipalities last
posted in February 2026, so they are not counted as fresh coverage.

The nine hosts join `CARTDS_SCAN_SEEDS`, and the measured municipality lists
live in `cartdsFeed.js`. Cart@DS now reads 217 instances and 1,730
municipalities. The existing reader, six-hour cache, daily archive, robots
policy and applicant filtering apply. Clisson's server omits its GlobalSign
GCC R6 AlphaSSL CA 2025 intermediate; `cartdsArchive.mjs` adds that public
certificate alongside Node's default roots, as it already does for the
Sectigo intermediate of the other affected hosts. TLS verification remains
enabled, and the intermediate expires on 2027-05-21.

Auxonne (21038) was checked the same day and posts nothing: its filings go
through the Cart@DS of the CC Auxonne Pontailler Val de Saône
(`valdesaone.geosphere.fr`), whose board is installed with an empty menu, and
a request for each way of writing its code answers an empty table. The
quarterly scan reads that host already and will keep the commune once it
posts.

**Later on 2026-10-02, Pays Voironnais adds eleven municipalities.** The
[public board](https://ads.paysvoironnais.com/guichet-unique/Login/AffichageReglementaire)
posts for La Buisse, Charavines, Charnècles, Massieu, Merlas, Montferrat,
Saint-Blaise-du-Buis, Saint-Bueil, Saint-Cassien, Saint-Étienne-de-Crossey and
Saint-Geoire-en-Valdaine. Its menu sends the bare municipality number, not
its full INSEE code, and does not list Voiron. The municipalities have
18,047 inhabitants and all posted within 92 days without an existing reader.
The initial production archive sweep retained 176 posting rows, all
normalisable. Its documented menu lives in `cartdsFeed.js`, and the host
joins `CARTDS_SCAN_SEEDS`; the existing cache, archive, robots policy and
privacy filter apply.

The [Syndicat d'Urbanisme du Pays de Vitré board](https://supv.pu.sirap.com)
was also checked: fifteen Roche aux Fées municipalities, 26,883 inhabitants
and 273 published dossiers. The parallel integration in #396 already
registered them in `sirapScanned.js`, so this batch preserves that reader
without adding a duplicate documented instance. Both boards were linked by
their authorities' public sites; their menus do not include Voiron or Vitré.
Cahors, Saint-Dizier, Saint-Lô, Riom and Lomagne Gersoise have empty public
menus; Sélestat's portal answers HTTP 503 during announced maintenance.
They are not added.

**Another batch on 2026-10-02 adds 246 municipalities in the Ain.** The
[SIEA's current public portal](https://puu.siea-sig.fr), linked by
[Bugey-Sud](https://ccbugeysud.com/nos-services/urbanisme/) and municipal
websites, uses the existing Sirap PU JSON API despite its own hostname.
[Saint-Genis-sur-Menthon's municipal notice](https://saint-genis-sur-menthon.fr/formulaires-urbanisme/)
records the change of address in January 2026. Its public menu lists 376
entries, including a test municipality. All 372 valid municipalities without
another municipal reader were asked for their boards: no request failed;
246 had a filing or decision within 92 days, holding 5,250 dossiers in
total. Empty and older boards are excluded, as are the test entry and
municipalities already covered by another register. A menu entry alone is
not coverage: Oyonnax and Ambérieu-en-Bugey both answer empty boards.

The added municipalities have 417,326 inhabitants and range from population
rank 595 (Valserhône) to 33,071 in the same Geo API reading. They include
Saint-Genis-Pouilly, Gex, Ferney-Voltaire, Divonne-les-Bains, Belley,
Prévessin-Moëns, Meximieux, Viriat and Trévoux. The measured municipality
list lives in `sirapFeed.js` (`siea`); `puu.siea-sig.fr` joins
`SIRAP_SCAN_HOSTS`. Sirap now reads 1,866 municipalities, including the parallel integration in #396. The existing
six-hour cache, daily archive and private-applicant filtering apply;
`robots.txt` answers the portal's HTML app, which is the absence of a
robots file, as on the other PU hosts.

The initial production archive sweep read all 246 boards, with no failed,
refused or unsaved municipality, retaining 5,246 rows. Every retained row
normalises, 5,182 carry a cadastral parcel, and every dossier number names
the municipality whose board supplied it.

The same day's incremental check of SITMAHP's existing Cart@DS board adds
Vergons (04236, 118 inhabitants): one decision posted on 2026-10-02, with no
existing municipal reader. Its menu sends `4236`, the INSEE code without
its leading zero. `cartdsScanned.js` is regenerated with that municipality
added to the existing instance; the earlier readings keep their original
day and no municipality is removed. Cart@DS now reads 1,803 municipalities across 246 instances, including #396.
The Ain and Vergons additions cover 247 municipalities and 417,444 residents.
With Pays Voironnais, this batch adds 258 municipalities and 435,491 residents;
the retained archive has 5,423 posting rows.

**Since 2026-10-02, Brive-la-Gaillarde answers with its public permit tables**
(`src/data/webdevPermitsFeed.js`, `scripts/lib/permitLists.mjs`). The stable
[municipal permit page](https://www.brive.fr/urbanisme/affichage-municipal-autorisations-durbanisme/)
links an anonymous WEBDEV board on `doc.brive.org`. The server discovers
the current portal link, session and publisher/category/year menu positions,
then opens the newest dated posting under the city's urbanism folder. The
2026 tables are under Documents; older postings use the Urbanisme category.
The current and previous calendar years are checked when the newest year's
collection is empty. Folder and PDF identifiers are discovered afresh;
the JavaScript display program in the portal's XML response is never executed,
only its quoted HTML links read. All four tables are required: prior
declaration filings and decisions, and permit filings and decisions.

The posting of 2026-09-30 holds 329 distinct dossiers: 107 filings and 222
decisions, including 46 refusals and nine withdrawals, with dates through
2026-09-28. The existing positioned grid reader retains wrapped amendment
numbers, project addresses, works, dates, verdicts and published floor areas.
A filing says Filed, with no claim that it is still under review. The
permit card labels a refusal or withdrawal date as Decision, in both locales,
instead of calling it a grant (`adsUrbanisme.js`, `permitProjects.i18n.js`). The
standard six-hour cache, daily archive, applicant filtering, BAN address
placement and Sitadel merge apply: the first live proxy scan places 319 of
329 dossiers at their published project address. Each origin's robots file
is honoured; a challenge, missing table or unreadable file preserves the
shared archive.
Coverage is only Brive (`19031`): the shared filing portal serves surrounding
municipalities, but no shared public permit register has been confirmed.

**Since 2026-10-01, Marseille and Nîmes answer with the lists they publish
as PDF** (`src/data/permitListsFeed.js`, `scripts/lib/permitLists.mjs`).
Marseille links two files from its urbanism page: every dossier still under
review, whatever its year (1 874 on 2026-09-28), and every authorisation
granted over the last two months (825 from 16 July to 29 September; the city
publishes no refusal). Nîmes links one: its register of dossiers under review
(348) followed by its register of decisions (321, of them 86 refusals and 15
withdrawals). The proxy finds each file by the words of its link and reads it
as a table out of the PDF's positioned text (`pdfText.js`): the register the
Cart@DS software prints, a record per « Déposé le » line, and Marseille's
spreadsheet export, a row per dossier number, on which every centred cell of
the row is centred. Every dossier number the three files print came out as a
row. Marseille writes an original dossier with a `P0` suffix Sitadel does not
(`PC 013055 26 00230P0`, `0130552600230`); it is dropped so the two registers
meet, 117 dossiers on the first scan. A dossier on the city's latest list of
dossiers under review is drawn *En cours d'instruction* (“Under review”), the
city's own statement; once a later list drops it with no decision listed, it
falls back to *Déposé*. The lists name no parcel, so every address is
geocoded once and the BAN's answer kept per city, misses included
(`.gev-cache/permit-lists/geocode1-<insee>.json`): 2 556 of Marseille's 2 624
dossiers placed, 642 of Nîmes's 669. A file is parsed once per edition, its
rows kept under its address with its `ETag` (Marseille's 199-page register
reads in half a second); a city is read at most every six hours, a cold
Marseille scan taking 48 s with Sitadel; the rows are archived like a board's
in `.gev-cache/archive/permit-lists/` and swept on the same daily clock. The
applicant's own address is never read, and a person's name is dropped.

**Lyon and Béziers publish theirs as acts**, on Digitech's Webdelib+
platform, which lists a month of acts per page (`…jsp?role=usager&date=MM-YYYY`)
and serves each file through `openfile.jsp`, whose page moves on to
`showFile.jsp` with a script — no cookie, no challenge. Lyon's « Arrêtés »
tab holds a weekly *Droit des sols* file and, since September 2026, a weekly
list of filed déclarations préalables: Word files of records, not tables — a
number, `déposée le …` or `Décision du … à <beneficiary>`, then `Projet`,
`Terrain`, `Demandeur`, `Mandataire`, `Auteur` — under weekly section
headings that say the family and whether the dossiers were filed or issued.
They are read in drawing order (`readLyonList`), a number wrapped over two
or three lines joined back; the mandatary and the architect are never kept.
Béziers's « Affichage légal » tab holds, every week and for each family, a
list of the dossiers still open and a list of those decided, refusals
included: Aspose tables read by `readGridTable`, whose columns are the
clusters of cell starts under each header. Every dossier number of the 14
files checked on 2026-10-01 came out as a row. Lyon's platform answers
`robots.txt` with `Disallow: /` and is read by the project's decision
(`robots: 'overridden'`). A scan reads the last two months of acts; the
daily sweep reads twelve, a month that is over and an act already read
coming from disk. Lyon: 948 dossiers in the two months to 2026-10-01, 938
placed by address, 27 merged with Sitadel; Béziers: 587, 554 placed. One of
Lyon's files, written by Acrobat PDFMaker, declares a two-byte codespace for
one-byte fonts; `pdfText.js` now reads a simple font one byte a code, as the
PDF standard says, whatever its ToUnicode map declares.

**Aix-en-Provence and Argenteuil publish theirs in two more ways.** Aix's
ArcOpole application answers one page with two HTML tables, found by their
legends — the dossiers filed in the last two months and still undecided, and
the decisions of the same two months, refusals included (52 of 312 on
2026-10-01). The numbers leave the commune out (`PC2600200`, `PC24J0209
M01`), so `013001` is put back; a `P01` after a number is a prorogation. Each
row names its parcels (`AC 0080, AB 0123`), and 457 of the 476 dossiers stand
on one; `AT` rows (works permits for public buildings) are not drawn.
Argenteuil posts one PDF per dossier on Digilor Datahall, whose open JSON
index (a POST of `{"controller":"DocumentController","action":"getAll",…}`,
10 MB, every document since 2022) is filtered on the urbanism shelves' ids;
the sheets are the same grid as Béziers's (`readGridTable`), and the numbers
(`DP 95018 26 o0413`) key as Sitadel's `09501826O0413`. A scan fetches at most
60 files it has not read, the sweep 400, so a year's backlog is read over a
few days; a scanned sheet is kept as empty and not fetched again. The
dossiers of both cities go through the cadastre first, the BAN for the rest.

**Mulhouse, Annecy and Clermont-Ferrand.** Mulhouse's page links 73 lists
since 2023, each holding only the dossiers since the one before, so every
link is read (`all`) and an edition already read is never asked for again;
they are Operis exports in the same grid as Béziers's. The grid reader now
carries a row that runs on to the top of the next page, takes the
applicant's organisation from a later line when the first names the person
who signs for it, joins a counter wrapped as `S` / `0089`, and drops a
section title only when it starts in the first column. Annecy's page is a
JavaScript shell; its content is the same path under `/api/`, whose download
blocks give both files. Printed from Firefox, they draw no space between
words: `extractPdfText` now takes `wordGapEm` and reads a gap wider than
0.15 em as a space, for these files only — Word and Excel justify with gaps
that size inside words. Their rows, and Clermont-Ferrand's, are centred on
their middle (`readBandTable`): a row ends at a wide gap (Annecy, Clermont's
decisions) or each line goes to the nearest number (Clermont's filings,
whose four-line applicant leaves a gap as tall as the one between rows).
Annecy's parcels carry the old number of a commune it absorbed (`(268 AL
300)`, Seynod), and 518 of its 541 dossiers stand on one. Clermont-Ferrand's
host sends its certificate without the Sectigo OV R36 intermediate, which
the server supplies as it does for the `pemb.fr` boards; its list of filings
answered 404 on 2026-10-01 and is optional, so its decisions are read
without it. `Octroi` and `Octroi tacite` now read as grants.

**Versailles** posts a register of filed and one of decided dossiers every
fortnight, in a public Google Drive folder its urbanism page links (a folder
per year, in each a folder per board, names typed by hand). The folders are
listed through `embeddedfolderview` — plain HTML, no key — and each file read
once, by its Drive id, through `drive.usercontent.google.com`; Drive's
`robots.txt` disallows both, and the folder is read by the project's decision
(`robots: 'overridden'`). Word draws every cell of these registers under its
own clip rectangle, so `readVersaillesList` takes a row as the runs that
share a clip's top and bottom and a column as the header clip a run's starts
at: all 2 912 numbers of the 34 files of 2026 come out (120 of them `AP`
signs and `PP` pre-projects, not drawn). The parcels (`AX0288`) place 2 748
rows on their plot; `par`, `Représentant` and `Propriétaire` name people, and
only an organisation's `par` is kept.

**La Rochelle** keeps two Liferay document spaces, listed as JSON through the
space's `load-espace-children` resource (5 000 items asked: the page's 250
cut the decisions off in August) — the instance its files' links use, not the
hyphenated one the page embeds, which the file proxy refuses with HTTP 400.
The weekly lists of filings are Excel sheets whose rows sit on their bottom
line (`readLaRochelleFilings`: a line belongs to the nearest number at or
below it, the columns where the rows' baselines start, a date and a number
drawn as one run split); all 889 rows of the 21 lists since May come out. A
decision is one arrêté per file, a third of them scans with an OCR layer: its
verdict is read from the title block or the first article
(`laRochelleVerdict`, 36 of 40 sampled; scans without text are left out), its
number and day from the file's title — the posting day, kept as such, a day
after the signature in the median — and the title, which names the
applicant, is never stored. A four-digit counter is padded to Sitadel's five
(`DP 17300 26 1032` → `0173002601032`). The file proxy is disallowed by
`robots.txt` and read by the project's decision (`robots: 'overridden'`).

**Limoges** posts every act on DigiContent's « Arcade Portail »
(`actesreglementaires.limoges.fr`), whose public JSON search
(`/public/api/entities/search/findBySpecification`, filter `entityType.code =
ACTE,parameters.ACTE_TYPE = Urbanisme`, 200 a page, newest first) answers
without a key: 647 urbanism acts from 15 June to 1 October 2026. A decision is
one act whose arrêté is a 600-dpi scan with no text, so it is read off the
act alone (`limogesDecisionRow`): the title is the number
(`PC2600135_DECISION_SIGNEE`, `DP_ARRÊTÉ_2600984 ÉTAT`; three titles without
their year are left out), `ACTE_DATE_ACT` the signature and
`ACTE_CRAP_DATE_PUB` the posting — 47 of September's acts carry no signature
day and keep the posting only. The verdict is not published: the shelves say
« délivrés », but 5 of 27 arrêtés read by OCR on 2026-10-01 were a refused
permit, three oppositions and a withdrawal, so the row says « Décision
signée », off the ladder (state `depose`), and a Sitadel twin's grant wins
the merge. The lists of filings are two more acts (`LISTE DU 01.09.26 AU
25.09.26`, `AFFICHAGE JUILLET-AOUT 26`), one PDF each, fetched through the
act's files (`parent.id`) and `/arcade/api/entities/content/<id>`, read once
and kept under the act's address. They are Excel sheets whose cells are
centred on their row: `readLimogesList` gives each column's lines to the rows
by `centredRows`, a partition into consecutive runs each centred on its
number — the nearest number fails on a description of fourteen lines — and
joins the July-August file, printed two pages wide, half to half by height.
All 399 numbers come out, 396 with their address (the three others print
none). The decision and its filing fold on the number, the filing giving the
address, the works and the day it was filed: 760 dossiers over the twelve
months, 396 placeable; a decision on a dossier filed before July has no
address yet and is not drawn. A scan reads one search page and the lists not
yet read (three requests on 2026-10-01); the daily sweep reads four pages.
No `robots.txt` (the portal answers 404).

**Lille** publishes every arrêté its mayor signs in a daily « Bulletin
officiel » (BO VDL), one PDF per working day linked from
`lille.fr/Votre-Mairie/Le-conseil-municipal/Les-arretes-et-deliberations`
(181 since 2 January 2026, `bulletinLinks`; a link's words give its day).
Every page is a scan with no text, so the bulletins are read by OCR on the
server — poppler's `pdftoppm` (200 dpi, grey PGM) and Tesseract's French
(`--psm 4`), installed by the Dockerfile, wrapped by `scripts/lib/pdfOcr.mjs`
at nice 19 and one thread — in the daily sweep only (`ocr` of
`sweepPermitLists`). A visitor's scan is handed no OCR and draws the
bulletins the sweep has read out of its ledger
(`.gev-cache/permit-lists/bulletin1-lille.json`, rows only, by the bulletin's
address), without a request. The sweep reads the page, then every bulletin of
its twelve months the ledger does not hold, oldest first, so a day the server
missed is caught up at the next sweep: at most 40 bulletins and no new one
past 1 500 pages a sweep, ten seconds before every request to the host
(`crawlDelayMs`, its `Crawl-delay: 10`). Its `robots.txt` disallows `/content/`
and every PDF: Lille is read by the project's decision, `robots: 'overridden'`.
The host sits behind Imperva; an answer that is a challenge or no PDF, or a
403/429, stops the reading until the next sweep (`bulletinChallenge`). Most
pages are other acts, so each page's top is read first and the page whole
only when it shows a dossier number (`bulletinPageWorthReading`): 214 of 703
pages over 14 bulletins sampled, 0.58 s a page on an M5 core against 2.4 s for
every page as PNG. An arrêté is the run of pages its number heads
(`DOSSIER N° PC 059350 26 00051`, `PAGE 2/3`); the number is voted over them
(`bulletinDossier`: the city's code within one character, the year no later
than the bulletin's, each other character agreed by most pages, the counter
`O` and four digits before 2025 as Sitadel writes it); the verdict is the
first article's (`bulletinVerdict`), the site and works the first page's,
the filing day the « présentée le », the signing day the date stamps
(`bulletinSignedOn`: two digits, at least two stamps or the bulletin's own
day). The sentence that names the applicant and their address is never read.
Hellemmes and Lomme are in the same bulletin under 059350, as in Sitadel;
their sites carry 59260 and 59160 for the geocoder. On the 14 bulletins: 95
arrêtés in 7 of them, 92 decisions, every number agreed by a second reading
at 300 dpi, 90 with a site, every verdict read, 89 with their works, 74 with
their signing day; an arrêté whose number does not settle is left out and
counted (`dropped`). The image's Tesseract 5.3 (Debian bookworm), run on three
of them in a container held to one CPU of an i5-6500T, gave the same 55
decisions as the Mac's 5.5, at 2.1 s a page read whole and 1.8 s a page on
average for bulletins heavy in decisions; the OCR layer adds 111 MB to the
image.

**Six more municipal boards, since 2026-10-01:** Saint-Priest (69290),
Wattrelos (59650), Lambersart (59328), Achères (78005), Balma (31044) and
Anzin (59014), in `src/data/municipalPermitsFeed.js`. These are six communes,
not coverage of their whole metropolitan authorities. They use the same
permit-list archive, dossier folding and cadastral/BAN placement as the
thirteen existing publishers.

**Caluire-et-Cuire and five DematDOC municipalities (2026-10-03).**
`src/data/dematdocRegisterBoards.js` reuses the Cart@DS table reader for
Châteauneuf-sur-Isère, La Tour-de-Salvagny and Saint-Jean-de-Monts,
adds Millery's top-aligned BIRT register, and adapts Vernaison's project
address label only under its exact filing heading. Public shelves use
JSON POST and dated, same-origin PDFs, preferring redacted copies. Private
applicant titles and columns are excluded. Millery's signature dates carry
no verdict, so its decision rows stay signed decisions rather than grants.

`src/data/caluirePermitBoard.js` reads Caluire's weekly scans in the daily
sweep. The background OCR can reread the measured permit-type cell at
400 dpi alongside the year anchor, at most 100 cells per page. Only exact
families and counters form dossier identities; unread cells and changed
table layouts are withheld. Visitors never initiate OCR or download these
unread scans. Explicit negative states are preserved, future dates are
withheld, and the existing cache, archive and geographic placement apply.
Caluire's scan extraction remains partial. Caluire honours robots.txt;
the DematDOC shelves use the existing public-board override.

The live September–October reading retained 531 posting rows from 43
documents, representing 338 distinct dossiers. All have a project address,
503 also have cadastral references. No download failed or remained pending
OCR. The six sources add 70,904 residents: 21,969,835 covered residents,
32.1428% of the same Geo API snapshot, across 4,179 municipalities. Moussac,
Chambœuf and Crozet were checked but keep their existing intercommunal
readers, avoiding duplicate coverage. All 32 Caluire dossiers were placed
in the real API response, 22 by parcel and 10 by address. Desktop, tablet
and mobile rendering was checked without a layer error or horizontal
document overflow. [Research, sources and limits](research/municipal-register-extensions-2026-10-03.md).

**Bry-sur-Marne, Saint-Raphaël, Scionzier and Aiffres (2026-10-03).**
`src/data/municipalRegisterBoards.js` adds four municipal PDF protocols and
readers to the existing six-hour cache and daily permit archive. Bry's
weekly Cart@DS scan combines filing and decision pages; ERP notices are
excluded. Its sideways pages use `ocrRotate: 90` in the background sweep,
never OCR on a visitor request. Only full, readable local dossier numbers
and a project street are accepted; the scan remains a partial extraction.

Saint-Raphaël's eight rolling PC, DP, PA and PD registers use HTTP validators
on each refresh. Scionzier's spreadsheet paints adjacent cells without a
gap, so `extractPdfText` accepts layout-specific `columnEdges` to split the
glyph runs before reading project sites and parcels. The measured edges
exclude applicant and architect columns and preserve continuation pages.
Its decision register explicitly lists granted authorizations. Full
cadastral references are reduced to local section/number references,
with the published prefix retained when it is not `000`.

Aiffres repeats a DDC table per permit family. The site comes from the
terrain's `sis` line, not its owner's address. Signature and notification
dates are separated from the verdict, including grants with prescriptions,
negative certificates and withdrawals. The publisher renews its signed
CDN download URLs on each visit. A file's transient `requestUrl` is used
only for downloading; its stable `runtime_url` remains the edition cache
identity and the returned source URL. Unknown verdicts stay signed
decisions, and a row without a usable site or cadastral reference is dropped.

All four sources honour robots.txt without a new override. Bry-sur-Marne
and Saint-Raphaël reject the word `scan` in a User-Agent; their requests
use the existing honest Surplomb identity without that word. Only project
fields are retained; raw scans, private applicants, owners and architects
are excluded from the archive.

The September–October live check read 15 editions and retained 342 posting
rows representing 329 distinct dossiers: 24 rows in Bry-sur-Marne, 231 in
Saint-Raphaël, 52 in Scionzier and 35 in Aiffres. 337 rows have a published
project address; the remaining five Scionzier rows have cadastral references.
No downloads failed and no files remained skipped or pending OCR. Registry
coverage gains 70,197 residents, from 20,806,381 to 20,876,578 (30.4406% to
30.5433% of the same Geo API snapshot); 4,104 municipalities are registered.
This delivery baseline includes the SPL-Xdemat and discovered-host additions
merged in parallel in #405.
This describes sources, not completeness of all permits. The
[research report](research/municipal-registers-2026-10-03.md) records the
source links, measured counts and extraction limits.

**Eaubonne, Les Pavillons-sous-Bois and Sainte-Luce (2026-10-02).**
`src/data/publishedPermitBoards.js` adds Eaubonne's planning-theme HTML
index and the public Delibs legal boards of Les Pavillons-sous-Bois and
Sainte-Luce. Delibs is paged with `parPage=20`: larger values change its
reported page count while still returning twenty acts, losing records.
Other municipal acts fill the first pages; paging continues even when a
page has no planning order. Only each order PDF is read, never its CERFA
or applicant annexes, and raw act titles are not retained. Delibs disallows
`/api/` in robots.txt; the two registered municipalities explicitly use the
same project override policy as DematDOC's legal postings.

Scans use the existing daily-sweep OCR, not a visitor's request. Eaubonne
uses the `urbanisme` theme rather than the empty `urbanisme-arretes` act
type; its month filters and pagination preserve the collection window.
Sainte-Luce's explicit `source.dossierCode: '972227'` reads the prefix the
publisher prints as `972 227`, while coverage and placement keep INSEE
`97227`. Other readers retain their existing dossier format. Project
addresses, cadastral references and works are separated from applicant
fields and appended planning zones. Ambiguous OCR parcel text is not
repaired into a guessed reference; unknown verdicts stay signed decisions.

The September–October live collection read 25 order PDFs and retained
23 posting rows with project addresses, representing 22 distinct dossiers:
five rows in Eaubonne, twelve in Les Pavillons-sous-Bois (one order posted
twice), and six in Sainte-Luce. Two Sainte-Luce PDFs did not yield an
accepted dossier. No downloads failed; no files remained skipped or
pending OCR. Registry coverage gains 61,425 residents, from 20,372,193 to
20,433,618 (29.8053% to 29.8952% of the same Geo API snapshot); registered
municipalities rise from 3,958 to 3,961, and coverage of the top 1,000 from
286 to 288. The [follow-up report](research/published-permits-2026-10-02.md)
records the verified sources and remaining leads.

**Eight outer Paris municipalities posting their own boards (2026-10-02).**
`src/data/outerParisPermits.js` adds Pontault-Combault's weekly WordPress
lists, Rambouillet's Digilor GDS filing table and scanned orders, Vauréal's
weekly PDF tables, Villepreux's and Igny's Digilor decisions, and the
municipal PDF notices of La Celle-Saint-Cloud, Le Mée-sur-Seine and Crosne.
They use the existing six-hour cache, daily permit-list archive, OCR in the
sweep only and cadastral/BAN placement. Their public indexes and file
requests honour robots.txt; no new override is introduced.

Repeated family headers, split house-number columns and cadastral lines
are read separately from applicants. An operative first article identifies
a decision even if its recitals mention a filing notice. Digilor titles
may abbreviate counter zeros; the PDF's printed number is retained, with
explicit amendment suffixes. Conflicting file numbers are rejected.
Unknown verdicts remain signed decisions; future OCR dates are withheld
and month-only upload paths supply no invented exact posting day. Igny's
individual decisions are covered; its scanned weekly filing registers
still need a section-prefix reader.

The two-month live check read 120 PDF editions and 440 rows: Pontault 29
filings and 23 decisions, Rambouillet 47 and 40, Vauréal 54 and 197,
Villepreux 12 decisions, Igny 12, La Celle-Saint-Cloud 13, Le Mée seven
filings and one decision, and Crosne four and one. They contain 274 distinct
permit files, each with a project address in at least one row; one Vauréal
filing row is unaddressed but another posting of that file supplies it.
No downloads failed and no files remained skipped or pending OCR.
Population coverage gains 155,260 residents: 29.58% to 29.81%, 279 to 286
of the top 1,000 municipalities. The [research report](research/outer-paris-permits-2026-10-02.md)
and its machine-readable survey preserve the 152-municipality screening,
verified sources and unconfirmed leads for the next pass.

**Thirteen more cities posting their own boards (2026-10-02).** Two more
families join `permitBoards.js`. `permitBoardsReports.js` reads the lists an
instruction software prints: Valence's and Décines-Charpieu's Cart@DS
« Liste des avis de dépôt / des décisions » (one reader, `readReportTable`,
for cells centred on their row or hung from its top, and rows a page break
splits), Saint-Genis-Laval's BIRT editions, Arles's quarterly OpenOffice
sheets, and the Word or Excel tables of Saint-Cloud, Tassin-la-Demi-Lune,
Sceaux and Pertuis; a cell that stacks a person's name over a company's
keeps the company's line only. `permitBoardsActs.js` reads acts posted one at
a time or in weekly registers: Romainville's arrêtés (scans, read by the
sweep's OCR), Villeneuve-Saint-Georges's weekly filing tables and decision
extracts, Oullins-Pierre-Bénite's weekly Cart@DS reports printed and scanned
with an OCR layer (listed through its WordPress media API), L'Haÿ-les-Roses's
Docs2Web catalogue and Limeil-Brévannes's page opened for the amended
R.423-6. Live on 2026-10-02 over two months: Valence 145 filings and 152
decisions, Arles 210 and 219, Décines 103 and 114, Saint-Cloud 73 and 58,
Pertuis 78 and 83, Saint-Genis-Laval 61 and 79, Tassin 23 and 49, Sceaux 34
decisions, Villeneuve-Saint-Georges 215 filings, L'Haÿ 55 and 20, Limeil 27
and 41; every row with an address but one; Oullins's twelve-month sweep 772
filings and 684 decisions. Le Plessis-Trévise (DataHall), Les Pavillons-sous-
Bois (delibs.com, numbers without their counter letter) and Bry-sur-Marne
(rotated 150 dpi scans) were left out. Measured against geo.api.gouv.fr's
populations: 430 980 inhabitants more, 28.9 % of the population seen within
days, from 28.3 %; 115 of the 300 most populous communes, from 107, and 274
of the 1 000, from 261.

**Fourteen cities posting their own boards (2026-10-02).**
`src/data/permitBoardCities.js` registers fourteen cities ranked 61 to 200 by
population that had only Sitadel: Cergy, Bourges, Antony, Le Blanc-Mesnil,
Troyes, Pantin, La Roche-sur-Yon, Alès, Saint-Germain-en-Laye, Anglet,
Châlons-en-Champagne, Garges-lès-Gonesse, Poissy and Boulogne-sur-Mer, 742 208
inhabitants. Measured against geo.api.gouv.fr's populations as #391 did,
26.1 % of the population is seen within days, from 25.0 %; 48 of the 100 most
populous communes, from 42, 102 of the 300, from 88, and 240 of the 1 000,
from 226. Their entries join `PERMIT_LISTS` with `source.kind: 'board'`.

`src/data/permitBoards.js` states the contract: one pure protocol per city
(`start` gives the index requests, `index` reads an answer into files, rows
and further requests) and the PDF readers its files name, gathered from three
family modules. `readBoardCity` in `scripts/lib/permitLists.mjs` makes the
requests. The first index must answer, or the reading is null and the archive
keeps what it had; a later index or a file that fails makes it incomplete. A
file is read once and kept by its address, newest first: at most 60 new files
per visitor scan and 400 per daily sweep, a skipped file standing on what its
index said. An `ocr` file whose text yields no row, and a `scan` (a board that
only ever posts scans), are read by OCR in the sweep only, at most 40 a day per
city (`BOARD_SWEEP_OCR_FILES`), `ocrPages` pages each; a visitor's reading
never downloads a `scan`. Files are asked for as `application/pdf`, which
routes them through the proxy's 60-second PDF fetch whatever their address.
A city's `userAgent` goes with every request to its host, robots.txt's
included: Boulogne-sur-Mer's firewall answers 403 to any name containing
« scan », and the same honest name without that word is let through.
`extractPdfText` now accepts blank lines before `%PDF-`, as Bourges serves.

Six post lists (`src/data/permitBoardsLists.js`). Word draws each cell under
its own clipping rectangle (Garges, Troyes, Cergy): `readCellTable` groups runs
by rectangle and rows by height band, finds the header by its words and reads
every section under it. « Print To PDF » and LibreOffice keep no cell
rectangle and centre each cell on its row (Le Blanc-Mesnil, Bourges, Alès):
`readNearestTable` places columns from the first header of the file and gives
each line to the nearest dossier number of its section, section titles and
header lines excluded. Garges and Le Blanc-Mesnil replace a filing table and a
decision table in place under a dated file name; both must be linked or the
page is not read (15 filings and 13 decisions, 93 and 64 on 2026-10-02).
Troyes posts a filing list a week, signs' lists skipped (206 filings over the
twelve files linked). Bourges's document portal lists every act oldest first,
its theme filter held in a session, so the reading walks back from the last
page until the window is passed; its `robots.txt` disallows every agent, read
by decision (`robots: 'overridden'`). Its register prints the applicant, the
applicant's own address and the parcel in one column: only the parcel is
read there (165 filings, 167 decisions over the two months it keeps). Cergy
posts on A2Display, whose JSON lists the urbanism category (619 filings and
1 002 decision rows over twelve months). Alès posts a WordPress article a week
per list, found through the REST API (53 filings, 37 grants); a site column
reading « IDEM » means the applicant's address, whose street lines alone are
then read as the site.

Three post one PDF per dossier (`src/data/permitBoardsNotices.js`). Antony's
Dematii list answers one POST (686 text filing notices and 72 scanned decision
extracts in twelve months); file names, « applicant - address », are never
read, and a filing's site is what lies between its land-area and parcel lines.
La Roche-sur-Yon lists every act on one 1.6 MB page (955 permit acts in twelve
months), all scans: rows carry the file name's number until the sweep's OCR
reads page 1 (40 files read on 2026-10-02, 39 placed). Poissy's register is
asked one month at a time by its own form (one POST, 150 kB, instead of the
6 MB page); only files it marks published are read, the verdict from Article 1
or the register line's closing words, never the applicant's name before them.

Five post HTML lists (`src/data/permitBoardsPages.js`). Châlons-en-Champagne's
citizen portal lists a year's filing notices and planning orders on one page
each (533 notices to 28 September, 85 orders since 13 May); titles give the
number and site, PDFs the filing date and parcels, two orders in five need
OCR. Saint-Germain-en-Laye's acts search gives verdict, site and works in each
title (92 orders over two months), its PDFs the filing date and parcel.
Boulogne-sur-Mer's six folders name each dossier and its site; filings are
typed, orders scanned. Pantin's Docs2Web board is read from the tree its page
loads (`params.js`, 3.7 MB, asked at most every six hours); orders are scans.
Anglet's WebDev lists answer four plain GETs with 207 orders still posted;
no date is printed and the PDFs are session-bound, so its rows carry none,
and only a numbered site and works phrases are kept from each free-text
description. Through the proxy on 2026-10-02, Garges placed 28 dossiers of
28, Cergy 33 of 38, Châlons 79 of 83 and Anglet 184 of 205.
**Fifty-six communes that post on DematDOC (2026-10-02; Aubière on 2026-10-03).**
`src/data/dematdocFeed.js` registers the tenants of the acts platform
`<tenant>.dematdoc.eu` whose urbanism shelves carry dossiers posted since July
— Montélimar, Plaisir, Le Pontet, Fontenay-le-Comte, Saint-Gaudens and 51
smaller communes. A shelf is asked newest first (`POST
/api/public/get-documents/<shelf>`, 100 documents and the ids of the rest),
then 100 at a time through `get-documents-lazy` until a page reaches the
window: two months for a visitor's reading, twelve for the sweep, though a
shelf only shows what is on display. A document is kept when its title or
index fields name a dossier of the commune or a permit's words; road orders,
pre-emptions, plans and aggregate registers are dropped, and the redacted
copy the board itself shows (`bifferPath`) is read when there is one. Each
act is one PDF read once (`dematdoc-notice`, extracted with `wordGapEm`
0.15): the number from the heading or the title, the site from the first
site label (« Sur un terrain sis », « Adresse du terrain / des travaux »,
« Sis à l'adresse suivante », « Lieu ») on its line or under it in its
column, cut at a 30-point gap so the works printed beside it are not read,
and refused unless it names a number or a kind of way; the parcels, with
the commune's own three digits Cart@DS prints before a section dropped
(`150 CX 585` → `CX 585`); the board from the first heading line, so that an
order whose header recalls « l'avis de dépôt » stays a decision; the verdict
from the operative article, which must open a line, then the heading, then
« Décision signée ». A scan waits for the sweep's OCR, showing meanwhile the
number and a street the title ends with — never the title's other words,
which often name the applicant. Measured on 2026-10-02: 1 071 acts posted
since 1 September; the newest eight of each tenant gave 281 dossiers, every
one with its site (86 filings; 195 decisions, of which 131 granted, 19
refused, 16 withdrawn or cancelled and 29 signed with no verdict read); 92
of 130 text acts sampled gave a row. Darnétal, Fontenilles and Plan-d'Orgon
post only scans, and Chavanoz posted nothing since August. Every tenant's
`robots.txt` is the platform's `Disallow: /`, overridden by the project's
decision as for Saint-Priest. Bizanos and Mazères-Lezons also post there and
stay with Pau's e-permis board, which has their parcels, and Le Crès stays
with Montpellier Méditerranée Métropole's open data: a commune on two
registers would have every dossier twice. Viviers, read by Du Rhône aux
Gorges de l'Ardèche's Cart@DS board since #399 (with its parcels), left the
DematDOC list the same day, so 55 tenants were read; Aubière, whose shelf the
2 October sweep missed while the network was down, makes 56 on 2026-10-03. Measured against
geo.api.gouv.fr's populations: 338 535 inhabitants more, 26.8 % of the
population seen within days, from 26.3 %; 105 of the 300 most populous
communes, from 103, and 248 of the 1 000, from 243.

**SPL-Xdemat, seven self-hosted Cart@DS boards and five Sirap tenants
(2026-10-03).** `src/data/permitBoardsXdemat.js` reads the urbanism tab of
SPL-Xdemat's legal boards (`opendata.spl-xdemat.fr`), the acts platform of the
Aube, the Ardennes, the Marne, the Haute-Marne, the Aisne, the Meuse, the
Vosges and Meurthe-et-Moselle: one shared protocol (`spl-xdemat`) for the 54
communes `permitBoardCities.js` lists. The frame's endpoint answers twenty
postings a page, newest first, back to 2024, whatever is asked; pages are read
until one reaches back past the window, the last page, or fifteen. Each
posting gives its full number (`DP 088 160 2600341`, the commune checked),
the site, the works and the posting day; « Récépissé de dépôt » is a filing,
« Arrêté de décision » a decision, any other link nothing. The order's verdict
is only in its PDF, not read: the row says « Décision signée ». The applicant
has a field of its own and is never read. A non-member's answer has no total
and is no board. Measured on 2026-10-02: 139 of the 479 most populous
uncovered communes of the eight departments had a frame and 31 had posted
since July; asking the 4 192 others added 23 smaller ones. Through the reader
on 2026-10-02, Épinal gave 47 filings and 9 decisions over the window, 55 of
56 with their site. `robots.txt` is `Disallow: /`, overridden by the
project's decision as for DematDOC.

Seven Cart@DS boards on hosts no scan could name are written by hand in
`cartdsFeed.js`: Orly, Saint-Mandé, Salazie and the Haute-Bigorre (ten
communes) on hosts of their own, found by asking twenty usual ADS
sub-domains (`urbanisme.`, `ads.`, `sig.`, `cartads.`, …) of the 1 253
intercommunalities' and the uncovered communes' websites from the
service-public directory, wildcard DNS left out; and Moret Seine et Loing,
Terre d'Émeraude and Habsheim's `/guichet-scin` path on geosphere.fr, found by
asking the DNS about tenant names drawn from intercommunalities' and
syndicates' acronyms. Sixteen more boards answer but were empty on
2026-10-03 — Metz Métropole's new host until its migration ends on 8
October, Saint-Lô Agglo, Riom Limagne et Volcans, Creusot-Montceau, La
Roche-sur-Yon Agglomération, Pévèle Carembault, Colombes, Livry-Gargan and
others: they join `CARTDS_SCAN_SEEDS`, and each scan asks them again.

`*.pu.sirap.com` is a wildcard: an unknown tenant name answers Sirap's whole
default catalogue (first entry « AAST »), a tenant its own list. The names
the Wayback Machine saw as `sve-<tenant>.sirap.fr` (2026-10-01) and 23 000
names drawn from intercommunalities, syndicates (BANATIC) and the 4 000 most
populous communes (2026-10-03) give 31 tenants the layer did not read. Five post and are
written by hand in `sirapFeed.js`: the Bassin de Joinville en Champagne (29
communes), the Portes de la Thiérache (18), Lavalette Tude Dronne (17),
Valréas and Duras. The 26 others list their communes but posted nothing in
three months (the Pays du Mans's 96, Tarbes-Lourdes-Pyrénées's 66, Vienne et
Gartempe's 55, the Gironde's SDEEG, which stopped in February); all join
`SIRAP_SCAN_HOSTS`. Measured against geo.api.gouv.fr's populations: 372 763
inhabitants more, 30.44 % of the population seen within days, from 29.90 %;
300 of the 1 000 most populous communes, from 288.
**Six communes that post their instruction lists (2026-10-03).**
`src/data/permitBoardsPostedLists.js` reads the lists an instruction service
prints from Cart@DS — « Liste des avis de dépôt », « Liste des décisions »,
the reports Valence and Décines-Charpieu post too — wherever a commune links
them from a page of its own site: one protocol, `posted-lists`, for the
communes `postedListCities.js` lists. A link is a list when its file name or
words say which (a town may name its own patterns: Haguenau's
`… VILLE DE HAGUENAU DEPOTS.pdf` / `… AUTORISATIONS.pdf`, Lauterbourg's
« Dépôts du 24 septembre 2026 »), a PDF or a document link; its day comes from
the name or words in any of the orders towns write it (`28_09_2026`,
`26-10-01`, `au 22 septembre 2026`), failing that the upload month, failing
that the list is the board refreshed in place and asked again with its
validators. A town whose links open a page of their own (Benfeld's IntraMuros
site, which links the current PDF on its app's file host) follows them. The
files are read by `cartds-report-filings` and `cartds-report-decisions`; a row
whose number is another commune's is dropped. The Bas-Rhin's ATIP 67
instructs for some 400 communes and prints these lists, while its own Cart@DS
board (`appli.atip67.fr`) has an empty menu: its communes' pages are the only
public copy. Haguenau (CA de Haguenau's service), Saverne, Barr, Benfeld,
Offendorf and Lauterbourg posted within the month; read on 2026-10-03, they
gave 230 filings and 322 decisions, every row with its site. Mutzig,
Wittisheim and Huttenheim, said to post the same lists, link none from the
pages found. 65 689 inhabitants more.

**Forty-two towns on Digilor Datahall (2026-10-03).** The platform's
public index answers every document a town's app holds
(`DocumentController` `getAll`, one JSON); asking it for every app id found
the towns that post permits, and 42 with no other source are read by the
existing Digilor reader. `digilorDocuments` now takes a town's `shelves`:
the category, the sub-category, a pattern its titles match (Le Mans posts
its filings and decisions lists on one sub-category, named by title) and the
board, or `auto` — a receipt or an avis de dépôt is a filing, an order a
decision — with a `fallback` when the title says neither; a reader that
names the board itself (`dematdoc-notice`, from the act's heading) has the
last word. Towns with their own layouts live in `digilorTownsA/B/C.js` with
their readers in `permitBoardsDigilorA/B/C.js`: Reims (the weekly Cart@DS
« Liste des avis de dépôt », 210 filings, read by `cartds-report-filings`,
and one granted order per PDF), Le Mans (weekly printed lists: 78 filings and
23 decisions on six of them, every row with its site), Montluçon (Cart@DS
reports), Saint-Laurent-du-Var, Illkirch-Graffenstaden, Concarneau (weekly
registers), Yutz, Verrières-le-Buisson, Harnes, Hénin-Beaumont (one act per
PDF, the scanned orders by the sweep's OCR) and fifteen more. Fifteen small
towns that post one act per PDF are one generated line each
(`digilorTownsActs.js`, read by `dematdoc-notice`): of the 113 towns whose
shelves held permit titles since July, they are the ones whose eight newest
acts gave placeable rows without OCR. Lattes also posts there and stays with
Montpellier Méditerranée Métropole's open data. 720 022 inhabitants more.

**Saint-Joseph, Matoury and Schiltigheim (2026-10-03).** Saint-Joseph (La
Réunion) posts one PDF replaced in place, its « Registre des dossiers en
cours » followed by its « Registre des décisions », the export Marseille and
Nîmes post: it joins `PERMIT_LISTS` with the `register` layout, and read live
it gave 174 pending dossiers and 182 decisions, every row with its site.
Schiltigheim posts its own Cart@DS « Liste des avis de dépôt » and « Liste des
décisions », renamed with each edition's day (`affichage-depots-28.09.2026.pdf`):
one line of `postedListCities.js`, 280 filings still under instruction and
91 decisions. Matoury's Cart@DS board is `ville-matoury.geosphere.fr`, a name
the scan's guesses missed: asking the DNS about `mairie-`, `commune-`,
`ville-de-` and `ville-` before the 6 000 most populous communes' names
answered for `ville-` only (Matoury, which posts, and Créteil and Sélestat,
installed and empty), so `tenantGuesses` now adds `ville-<name>` for each
commune. The rescan of 2026-10-03 found no installed but empty board lit up
since the 1st (Metz Métropole's still empty) and a commune more on Porte de
DrômArdèche and the Val de Sarthe; `cartdsScanned.js` is the reading of the
1st with those boards' and Matoury's readings. 111 041 inhabitants more.

**Fourteen communes that post one act at a time (2026-10-03).** Many small
towns link each receipt and order, one PDF each, from a page of their own
site. The `posted-acts` protocol (`src/data/permitBoardsPostedLists.js`, next
to `posted-lists`) reads such a page for the communes `postedListCities.js`
lists with it: a link is an act when its words, its title (Rouvroy's
« Téléchargement » buttons name their file there) or its file name name one of
the commune's dossiers; its board is what its words say (a receipt or an avis
de dépôt is a filing, an order a decision); a numbered street is taken from
the house number on and stops before the works, the file's weight or the
number again; its day is the name's or the words', failing that the upload
month. An undated act counts when its number is of this year or the last,
forty at most (Dourges keeps every year's decrees on one page). The PDF is
read by `dematdoc-notice`, by OCR in the daily sweep for scans: Rouvroy's
eight newest gave filing days, verdicts and parcels. The reader takes a
decision's verdict from the operative article's first sentence, then from
the whole article: Coulogne's « Il n'est pas fait opposition », followed by
the notice that the act may be withdrawn, read « Retrait » before. Saint-Martin-Boulogne,
Marquette-lez-Lille, Bauvin, Rouvroy, Coulogne, Crespin, Dourges,
Roost-Warendin and Anor are read; Denain answers HTTP 418 to the layer's
user agent and is left out. `src/data/permitBoardsIntramuros.js` reads the
five communes `intramurosCities.js` lists, whose IntraMuros site renders its
legal board as JSON in `__NEXT_DATA__` (`legalDisplayDocuments`): an urbanism
document whose title names a dossier gives its number, a numbered street, its
posting day and its PDF, read by OCR in the sweep. Of the 159 IntraMuros
sites among the uncovered communes above 500 inhabitants, 27 posted urbanism
acts since July and these five give placeable rows. 82 200 inhabitants more.

**Two communes on a Docs2Web kiosk (2026-10-03).** Screensoft's
legal-display kiosk renders its cards from `params.js`, the tree of every
folder (`theme`, `subtheme`) and document (`paper`) of a town's board as XML
in a script. `src/data/permitBoardsDocs2web.js` reads it for the communes
`docs2webCities.js` lists, with one protocol, `docs2web`: a paper is read
when a folder above it is urbanism and its name names one of the commune's
dossiers (`PC0723502600018 - ACCORD AVEC PRESCRIPTIONS - …`, `Arrêté DP 26 0
0039 - 23 rue de Turenne`, whose counter Bousbecque types apart); its day is
`real_date_debut`, else `date_debut`, else the upload day (`dateFileInAdmin`),
and a paper scheduled after the reading's day waits; its board is what its
name says, failing that its folders (Joué-lès-Tours's `AVIS DE DEPÔT > PC`,
`ARRETES MUNICIPAUX > DP`), failing that a decision; certificates, signs,
letters and inquiries are left out, and a paper listed twice is read once.
The PDF is read by `dematdoc-notice`, by OCR in the sweep for scans. The
Wayback Machine lists twelve tenants under `screensoft.eu/Docs2Web/`; with
the kiosks Joué-lès-Tours and Quesnoy-sur-Deûle host themselves, two name a
dossier in their papers, serve their PDFs and have no other source:
Joué-lès-Tours and Bousbecque. Teloché's `content/` redirects to Screensoft's
login, Bassens is read by Bordeaux Métropole's portal, and Quesnoy-sur-Deûle's
kiosk answers over plain HTTP only. La Valette-du-Var names its papers
by applicant, Saint-Amand-les-Eaux posts weekly lists, Varennes-Jarcy and
Font-Romeu posted no urbanism since August; Pantin and L'Haÿ-les-Roses keep
their own readers. 43 401 inhabitants more.

**Thirty additional municipalities from Lorient, Digilor and Rueil
(2026-10-01).** `src/data/municipalPermitExtensions.js` registers the 25
members of Lorient Agglomération and Bondy, Blois, Aubagne, Thionville and
Rueil-Malmaison. These sources use the existing permit-list archive and
six-hour commune cache; the daily sweep progressively reads twelve months.
Lorient's board page supplies the public commune selectors for its
`/apps/ads/api/dossiers.php?TYPE=DEP|DEC` JSON API. Both boards must answer
with the expected commune and family arrays; five empty legacy selectors
outside the agglomeration are excluded. All 25 municipalities answered on
2026-10-01: 1,206 filings and 1,894 decisions, certificates included.
Lorient itself yielded 512 distinct dossiers; the full server placed 510.
Each row reads only the site, project, dates and verdict, never applicant
fields. Filings assert no continuing instruction or implicit grant.
Measured on 2026-10-02 against geo.api.gouv.fr's populations, the thirty add
479 813 inhabitants: 24.9 % of the population is seen within days, from
24.2 %; 42 of the 100 most populous communes, from 41, 87 of the 300, from
81, and 225 of the 1 000, from 215.

The four Digilor tenants are 565, 228, 307 and 222. Their urbanism shelf ids
select the documents, with Blois's mixed shelf separated into deposit lists
and individual acts. Bondy reuses the grid reader, Aubagne the under-review
register; Blois's DDC register reads dates, addresses and compact cadastral
references from three columns while skipping applicants and landowners.
Individual notices read labelled project addresses and the first operative
article. A generic “arrêté” or Thionville's “ARRETE_BAN” is only a signed
decision until its verdict can be read. Scans are cached with `pendingOcr`
and retried only in the background sweep, capped at 40 new/retried files;
visitors never invoke OCR. Completed files are read once. Raw titles and OCR
text are never stored; invalid PDFs are failures and preserve archived rows.

Rueil's monthly Webdelib+ pages give short dossier numbers, modification
suffixes, abbreviated project addresses and separate act/publication dates.
Titles are parsed and scrubbed before a closed month is cached. Individual
PDFs supply the verdict and filing date; an explicit title refusal survives
a missing file, and an unread generic act stays “Decision signed”. The BAN
match must be a house number in 92063, with the same number (including bis
or ter), a matching final street word and score at least 0.3. A wrong match
is counted as unplaced. A fresh server reading on 2026-10-02 placed 28 of
41 dossiers; the thirteen unresolved addresses remain off the map. The
dedicated reader tests cover rejected communes,
verdicts, cadastral references, private fields and OCR cache retries.

Saint-Priest's DematDOC JSON index supplies its newest aggregate filing and
decision lists. The decision list holds 109 rows on 2026-10-01; its filing
PDFs render blank, so the reader reports a failure without inventing filings.
Balma's document library category 163 links regular tables mixing filings
and decisions; their clipping rectangles separate the centred cells, leaving
applicant columns unread. Achères and Anzin publish individual PDF notices;
their titles supply abbreviated dossier numbers and project addresses.
Numbers retain their municipality, counter letters, modifications and
transfers. Notices read labelled project fields, never applicant fields.

Wattrelos and Lambersart use paginated Drupal boards. The daily sweep follows
up to 25 and 40 pages respectively and honours their ten-second crawl delay.
Visitors read a scrubbed snapshot without contacting these slow boards.
Scans are read only in the sweep, through positioned Tesseract TSV words;
Wattrelos's sideways filing tables are rotated in memory before OCR. The
decision's heading/first operative article gives its verdict; an unreadable
verdict stays “Decision signed”, never an inferred grant. Title-derived
records awaiting OCR are marked incomplete and retried on the next sweep.
Only scrubbed rows are cached, never raw titles or OCR text. Municipal
sweeps read at most 40 new files, newest first, and progressively catch up
their twelve-month backlog. Broken PDFs or pages preserve successful rows.
Saint-Priest, Lambersart's files and Anzin's `/documents/` are read by the
user's integration request of 2026-10-01, with `robots: 'overridden'` as for
the existing Lyon and Lille sources.

**Montpellier and 27 communes of its métropole** publish no list a reader
could follow, but the métropole exports every favourable decision since 2006
as one CSV per commune, every night (`src/data/mmmPermitsFeed.js`, ODbL —
read per scan, never bundled). It is anonymised: one row per parcel, the
form, the filing year and nothing finer, no number, no address. The rows of
one dossier are folded back by consecutive ids and equal attributes (24 432
dossiers for Montpellier), placed on their parcel — 21 215 — or on the
file's own Lambert-93 point, and drawn as granted. A dossier
Sitadel already holds is recognised by a parcel in common, the same family
and Sitadel's filing year the file's or the one before (a modification is
filed in its own year here), and is not drawn twice: 317 within two years of
a scan of Montpellier's centre. The file has carried almost no déclaration
préalable since 2025, upstream; a quiet block there says nothing.

**What the file cannot date, its editions do.** The export is rewritten every
night (`Last-Modified` 05:00 UTC), so every edition the server reads is folded
into an archive, `.gev-cache/archive/mmm/<insee>.json`, by the store the
Cart@DS boards use (`scripts/lib/mmmPermits.mjs`): each row with the first and
last edition that held it, dated by the edition's `Last-Modified`, not by the
reading. A dossier whose rows all appeared after the archive's first edition
carries that day as `postedOn`: the card's timeline prints « Au plus tard le
<day> » (“By <day>”) under « Permis accordé », the date line « accordé au plus
tard le <day> ». The decision was recorded by then, and no finer date exists.
The first edition's rows are the stock and carry nothing;
so are an edition's rows when it adds more than 2 % of the rows already kept
(at least 100) — a year adds about 5.5 %, so such a night is a rebuilt or
reworded export, not four months of decisions (`mmmPostedOn`). A row is known
by what it says, never by its `objectid`: every row filed since 2024 sits in
one interleaved range of ids, and the point and `annee_parcelle` come from a
cadastre join the métropole re-runs; identical rows (1 421 of 41 742) are told
apart by their rank. Montpellier's archive is 41 644 rows and 11.6 MB, written
in about 80 ms. Under `vite preview` the files are swept once a French day
after 08:00, when the day's export is out, 10 s apart as `robots.txt` asks
(28 files, about five minutes), on the boards' clock and `CARTDS_ARCHIVE`
switch; a sweep that archived new rows drops the communes' built answers so
the next scan sees them. Each portal reports `edition`, `archive` (`since`,
`through`, `days`, `dated`, `offExport` — rows a later edition no longer
holds — and `rebased`) and `publishedLag`: for the dated dossiers Sitadel
also holds, the days from Sitadel's decision to the export, the measure of
how close « au plus tard » is. The archive starts on the first day a server
reads the file; what was added before is stock. These communes do not count
as covered by a fresh source until that lag is measured.
**Since 2026-10-01, Nice and 37 more communes of its métropole answer from
e-permis.** Métropole Nice Côte d'Azur posts its *affichage réglementaire* on
clicmap's e-permis app (`affichage.e-permis.fr/depot?id=123`, linked from
nice.fr), whose page reads two lists for the whole métropole from clicmap's
API: `api-v2.clicmap.fr/ads/exports/depots`, the filings not yet decided, and
`/decisions` (`src/data/epermisFeed.js`, `scripts/lib/epermisBoards.mjs`).
The API wants a bearer token, which the page obtains for every visitor with a
public OAuth client written in its own script, no login and no challenge; the
project owner accepted on 2026-10-01 that the server do the same. The server
reads that client from the live script — never from the repository — asks a
one-hour token, and reads the script again on a 401; a script that stops
showing the client closes the source, logged, with the archive still served.
The API's `insee` parameter filters nothing, so one reading of the last 62
days serves every commune for six hours, and a dossier belongs to the commune
its number names. The publisher lists 51 communes; 38 posted something in a
month-by-month reading back to November 2012 (39 248 decisions, 4 256 filings
still undecided), and only those are read. Cagnes-sur-Mer,
Saint-Laurent-du-Var, Vence, Carros, La Trinité and eight more never posted
there (Cagnes files through Sirap's portal) and keep Sitadel alone. A page of
decisions takes about six seconds, so the first scan of any of the 38 waits
about a minute for the métropole's reading (75 s at Roquebillière on
2026-10-01, then 4 to 12 s for each other commune). Every row read is kept like
a board's, applicant filtered and architect never stored, in
`.gev-cache/archive/epermis/`; the daily sweep reads the last 62 days and walks
history back a year a day, a calendar month a window, down to the layer's
default three years — the decisions reach back to 1990, but every row kept is
placed again whenever its commune is rebuilt. The decisions of 2026-01-16 make
the server cut the connection on any window that holds them, so a window that
fails is read again a day and a list at a time and the list-day that still
fails is left out, named in `sweep.json`. On 2026-10-01 the three years held
11 154 dossiers (7 616 at Nice): 10 615 drawn on their parcel (95.2 %), 477
placed by address, 62 not placed, and 867 merged with their Sitadel twin.
Parcels are written six ways — the letter O for the zero among them, while Nice
has 18 real sections starting with O — and both spellings are looked up. A
filing reads *Déposé*; the software changed its words in early 2025
(`FAVORABLE`, `rejet implicite` became `Accord`, `Rejet`) and both are read;
`Rejet`, the tacit rejection of a file left incomplete, reads as refused, and
a withdrawal of a granted permit as cancelled.
**Since 2026-10-02, 614 more communes on boards the scan could not see.**
Searching certificate-transparency logs, the Wayback Machine, the
service-public directory of filing portals and the web for boards outside
the scan's reach, and checking the Paris inner ring by hand, found hosts that
post and that no register read (#399 had just written nine of them by hand:
Lannion-Trégor, Clisson, the Numérian Privas, Diois and DRAGA hosts,
Sarrebourg Moselle Sud, Les Sables d'Olonne, Entre Bièvre et Rhône, Verdun;
the scan now leaves those to it). *Cart@DS* (+61 communes): the Landes's
ADACL (34), Colomiers (the first Toulouse Métropole commune read, while
Toulouse's own board stays behind its anti-bot challenge), Kourou, Valenton,
the Numérian `gu-ara` and `gu-valeyrieux` hosts, Saint-Gilles and the Pays de
l'Or, seeds of the scan asked alone with `--ask`; Saint-Maurice, the fifth
Paris-Est-Marne et Bois board, named by the `pemb.fr` certificate; Bayonne,
whose host sends its certificate without GandiCert, the intermediate
DigiCert Global Root G2 signs — the scan cannot ask it, so it is written by
hand with `intermediate: 'gandicert'`, which `trustCartdsIntermediates` adds
as it adds Sectigo's and GlobalSign's; and 18 communes posting on paths of
the vendor's shared host `guichetunique.geosphere.fr/<tenant>` (Lambesc,
Beaumont, La Fare-les-Oliviers, Thaon-les-Vosges, Nuits-Saint-Georges,
Val-d'Isère…), which the scan leaves out as a vendor name and could only ask
one path of anyway: written by hand, one instance each. *Sirap* (+553
communes): seventeen intercommunal tenants of `*.pu.sirap.com` the Wayback
Machine had seen, among them the Pays Sud Toulousain (72), the Pays d'Ancenis
(19), the SIEEEN (103), Charente Limousine (39), Val d'Amboise (14) and Cœur
de Charente (45); a name that is not a tenant answers the shared portal's
whole list, so each was checked by the communes it names. The registry was
written from the saved readings of 2026-10-01 (`--day`), asking the new hosts
and the Dracénie and Lapalud hosts of #397 again, so it changed by the new
hosts only. Measured the same day against geo.api.gouv.fr's populations:
771 109 inhabitants more, 28.3 % of the population seen within days, from
27.2 %; 107 of the 300 most populous communes, from 105, and 261 of the
1 000, from 251.

**Since the evening of 2026-10-01, Pau's agglomeration and eighteen more
communes answer from e-permis too.** The Wayback Machine had seen boards at
`depot?id=70` to `119`, one commune each; asking the configuration of every
`id` from 44 to 160, one every thirty seconds, found the others. Read: the
Agglomération Pau Béarn Pyrénées (`id` 97, 28 communes of its 31 — Gan, Idron
and Lons posted nothing in twelve months, 3 756 decisions for the others;
Pau's and Lescar's own boards post the same dossiers and are not read),
Biarritz, Hendaye, Bidart, Arcachon, Cabestany, Jouars-Pontchartrain,
Maintenon, Saint-Hippolyte, Soorts-Hossegor, Labenne, Seignosse,
Bénesse-Maremne, Vieux-Boucau-les-Bains, Azur, Moliets-et-Maâ, Angresse,
Tosse and Magescq: 46 communes, 263 185 inhabitants. Left out: Hagetmau,
whose lists answer HTTP 500; Saint-Barthélemy, which has its own planning
code; Nantes Métropole, whose portal is read already. Same API, same public
client, an environment each; one page of each list from August on held 1 447
rows, every one naming its commune, 98 % their parcel, the verdicts in Nice's
words, and the same signs (`EN`) and works on public buildings (`AT`) that
are not permits. Each publisher has its reader, its token and its
environment, and all of them wait in ONE queue (`createEpermisGate`), half a
second after the last answer: the API refused an address everything for
about three hours after some forty requests for clients that do not exist,
in half a minute, on 2026-10-01. The first daily sweep of all twenty
publishers, on the hosted server on 2026-10-02, read 84 communes of 84 in 19
minutes with no refusal, failure or skipped day: 13 901 new rows, 23 041
kept, the nineteen back to 2025-08-01 and Nice to 2023-10-01. It filed 710
rows nowhere, and read again that day, every one was a file that is not a
permit — 367 works on public buildings (`AT`), 209 `AP`, 130 signs (`EN`), 4
advertising boards (`PP`), 608 of them the Pau agglomeration's — and none a
permit for a commune its publisher does not list. The sweep now counts the
two apart (`notPermits`, `unlisted` in `sweep.json`) and names in its log
line the communes an unlisted permit names.

**Three more communes answer with the acts they publish.** Ustaritz (64547),
Ciboure (64189) and Monts (37159) publish their permit decisions as acts on
publication-actes.fr, Mégalis Bretagne's white-label platform, whose open API
(`data-api.publication-actes.fr/mq_apis/actes/v1/search`, no key) lists a
commune's urbanism acts by SIREN (`src/data/publicationActesFeed.js`). The
acts themselves are scans, so a decision is read from its TITLE — the dossier
number, the address where the commune types one (Ciboure, Monts), the nature,
and a verdict, which these three communes name only when it is no: a title
with no verdict reads *Accordé*, a flag set per commune where the titles were
counted (`plainDecision`). Ustaritz's titles carry no address; the commune
also publishes a fortnightly *liste des dépôts*, an Excel table exported to
PDF, and the proxy reads its text (`src/data/pdfText.js`, no dependency) for
the parcels, the filing date and the nature, then joins it to the decision on
the dossier number: 33 lists on 2026-09-30, 28 of them text, five scanned.
The three are read at most every six hours (Ustaritz: three API pages and,
once per server, 33 PDFs kept as parsed rows in `.gev-cache/publication-actes/`,
applicant filtered; a cold scan takes 20 s), placed on the parcel first and
geocoded for the rest — Ustaritz 165 on their parcel and 26 by address of
238 dossiers, Ciboure 247 of 263, Monts 413 of 544. Ninety-nine other
authorities publish urbanism acts on the platform; Montbazon, Veigné and
Ferrières-en-Gâtinais publish permits but name no site in their titles, and
are not read. When Sitadel holds a dossier a commune only listed as filed,
Sitadel's state now wins: a filing claims nothing past the filing.

**A PC and a DP with the same digits are no longer merged.** `DAU` is one
series in the register, but many communes count permis de construire and
déclarations préalables separately; the merge now requires the same family
as well as the same number. Measured over deposits since 2024-01-01, every
cross-family match had been another dossier at another address — Nantes 5 of
5, Paris 22 of 365 — and the portal row had been drawn on that dossier's
parcel.

**Bordeaux is the only one of them that publishes the GROUND**, and the layer
draws it: the footprint (*emprise*) of the parcels a dossier names, clamped onto the terrain
under the crane that marks the dossier itself.

**And for a year every plot card in France said so, including the ones Bordeaux
never touched.** The sentence *emprise publiée par Bordeaux Métropole* (“footprint
published by Bordeaux Métropole”) was
hard-coded when Bordeaux was the only source of a shape here; the cadastral
placement below then gave the whole country an outline and the credit was never
moved, so an Ustaritz parcel drawn from the Etalab cadastre was crediting a
métropole 200 km away. Fixed 2026-09-14: `empriseProvenanceLine` reads the
provenance off the dossiers standing on the plot — the portal's own label where
the counter shipped the geometry, *emprise cadastrale — la parcelle nommée par
le dossier* (“cadastral footprint — the parcel named by the dossier”) where this
layer joined it, both where one outline serves both.

Everywhere else the ground is RESOLVED rather than published, and
`cadastreLineage.js` is what does it. Sitadel carries no coordinate but names up
to three cadastral parcels per dossier, and Etalab publishes the cadastre — so
the permit is placed on its own plot before the geocoder is asked anything.
Measured 2026-09-02: **58,1 % of Ustaritz's 543 rows** and **2 307 rows of
Paris** resolve to a parcel that still exists, which is a placement no address
lookup can match and which shrinks the BAN batch by the same amount. A permit
placed this way also survives a geocoder outage, where before this the whole
commune came back empty.

**37,3 % of those rows name a parcel that is gone, and that is the register
working rather than failing**: you file on a field, the field is divided, you
build on a lot. Etalab has published DATED editions of the whole cadastre since
2017-07-06, so the layer walks back at most three editions from the decision
date, finds the parent alive, intersects it with today's parcels and reads the
division off the ground. The area of the children has to account for the parent
to within 12 % or the lineage is refused — a redraw moves vertices by
centimetres, a wrong parent moves them by lots. On `06454721B0009` at Ustaritz:
AN 221 alive at 2021-04-01 and gone at 2021-07-01, three months before the
permit was granted, into AN 511 (811 m²) + AN 512 (527) + AN 513 (34) —
**1 372 m² against the parent's 1 372, to the square metre**.

Which of the lots was built on comes from the same archive's BUILDING files,
and which lot carries which number comes from the commune's *Base Adresse
Locale* — the only published join between a house number and a parcel, and one
that contradicts the counter where they disagree (two Ustaritz dossiers are
filed at "67 impasse d'Haroztegia" and name AN 515, which the BAL numbers 63).
Neither is a guess and neither always answers: over the 125 ambiguous divisions
of Ustaritz since 2018 the building diff names a single lot in **29,6 %** of
cases, 45,6 % have several children built and 24,8 % have none. The rest are
drawn on the PARENT, labelled *emprise avant division* (“footprint before
subdivision”), because a polygon that certainly contains the site beats a
confident dot in the road. A development permit (*permis d'aménager*) always
stays on the parent — it is the act of drawing the lots, not
a project on one — and two dossiers competing for the same built lot both fall
back to the parent unless their own BAL numbers separate them.

The limits are counted rather than hidden. The archive floor is July 2017, so
permits authorised 2013-2016 lose 61 of 161 against 5 of 227 for 2018-2021; a
reference with a letter suffix (`255P`, *partie de parcelle*) is flagged as
provisional instead of being padded into a number that does not exist; and the
scan reports `placed`, `divided`, `resolved`, `onChild` and `onParent`
commune-wide, alongside the geocoding shortfall it already reported.

The snapshots are cached in `.gev-cache/cadastre` as the gzip they arrived as —
676 KB for a commune's parcels, 239 KB for its buildings — because a DATED
edition is immutable and never needs revalidating; only `latest` carries a TTL,
of a month. The first cut stored parsed JSON and one commune's thirteen years
took 186 MB, against 27 MB gzipped, under a 256 MB LRU ceiling. A cold Paris
commune-window costs about 45 s, most of it the twenty arrondissement cadastres
its permits resolve across, downloaded eight at a time; every scan inside that
commune afterwards is served from cache in milliseconds.

The outline belongs to the PLOT, not to the file, and `liftEmprises` in
`adsFeed.js` is what enforces that. Bordeaux repeats the same emprise once per
dossier standing on it: measured on the default 400 m scan of place Pey-Berland
on 2026-09-02, **392 dossiers over 252 distinct plots**, one of them carrying
nine. Shipping it per dossier would be wrong three times over — 166 KB of
repeated geometry against 94 KB of distinct geometry; nine translucent copies
of one plot painting it at 0.83 alpha where a single copy reads 0.18, so the
thickest FILE on the block looks like the biggest project on it; and Cesium's
`StaticGroundGeometryColorBatch` opening a fresh `GroundPrimitive` for every
instance whose bounding rectangle collides with one already batched, which two
copies of a parcel always do. The plot is keyed on its GEOMETRY and merely
NAMED by `refcad`: the same file writes a parcel reference in the short
`063KH215` form and, on 47 of 3 927 rows in 2022 Q1, in the 14-character IDU
form, and one row in a few thousand lists the same parcel twice — any of which
splits one plot into two identical stacked washes. Across 5 186 rows, 2 737
distinct parcel sets produced exactly 2 737 distinct outlines.

**The emprises cost less than nothing.** The same change stopped fetching the
certificats d'urbanisme the projection had always discarded — 174 662 of the
file's 309 094 rows, two thirds of a central Bordeaux circle — by moving the
exclusion into the ODSQL `where` and asking the portal to COUNT them instead.
Measured on that scan: 416 KB as it shipped without outlines, 1 338 KB with
outlines and certificats, **391 KB with outlines and without them**. ODSQL has
no `<>`, and writing one is not a filter that misses — the export endpoint
answers a syntax error with HTTP 200 and a JSON error object, which reads as a
short answer rather than as a failure.

**A published polygon is not a valid one.** Bordeaux ships its emprises out of
Oracle Spatial with the validator's verdict attached: 428 rows carry a
`geom_err` (`ORA-13349` boundary crosses itself, `13350` rings touch, `13356`
adjacent points redundant) and 108 of those are published with no geometry at
all — those keep their point, and their marker. Dropping the other 320 was
tried and rejected: measured against each row's own `superficie` they draw at a
median 0.997 of their stated area, so the flag is not the test.
`sanitisePolygonParts` in `ringGeometry.js` repairs what is structurally
unrenderable instead — it opens every ring (all 137 916 arrive closed) and
removes consecutive duplicate vertices (45 rings, 187 vertices, across 134 413
rows). It does NOT require a hole to lie inside its outer ring, which was also
written and measured out: none of the file's 1 346 inner rings lies entirely
outside, fourteen lie partly outside because they share an edge with the outer
ring, and the three largest of them are courtyards of 787, 754 and 249 m²
that the rule would have silently filled in.
| `isochrone-fr` | `is` | `/api/isochrone` | IGN Géoplateforme, Valhalla over BD TOPO® — three rings per scan; cycling instead from the FOSSGIS OSRM table over OSM |
| `implantation-fr` | `im` | *(none of its own)* | Fans out across `/api/isochrone`, `/api/filosofi/carreaux`, `/api/gpu`, `/api/dvf` and the BAN reverse geocoder, and joins them in the browser |
| `comparables-fr` | `cp` | `/api/dvf` (candidates only) | The dossier itself is keyed in by the reader and lives in `localStorage`; `/api/geocode` and the BAN reverse endpoint turn a typed address into a coordinate |

`implantation-fr` was the only layer in the app with NO SOURCE OF ITS OWN until
`comparables-fr` joined it below; it is still the only one that composes its
answer entirely out of other people's registers. It
uses the shared address-scan factory's `fetchImpl` seam to fan out across four
routes this server already has — all already cached, all already tested — and
does the spatial join locally: which 200 m carreaux fall inside the reachable
ring. A fifth proxy route would have had to duplicate their load logic
server-side and would have missed their caches. The join reports a BRACKET
rather than a number (squares entirely inside, squares the ring touches, and the
centroid convention between them), because at 200 m a ten-minute walk is mostly
boundary — measured at place Bellecour, 24 of the 35 squares the ring touches
are across its edge. It never scales a square by the fraction inside it: that is
areal interpolation and it assumes an even spread INSEE's imputation flag exists
to deny. The `ficheLines()` output is unit-tested for one thing above all — no
line may contain ' · ', which is the separator `cardFromEntity()` splits on, and
a line carrying one arrives on screen in two halves.

`comparables-fr` is the second layer with no source of its own, and the only one
whose data the READER supplies. It holds one property under study and the
comparables retained against it — DVF mutations picked out of the candidate list
the panel offers within 500 m, and listings keyed in by hand — and it computes
what a valuation note computes. Three things about it are structural rather than
cosmetic. **An asking price and a completed sale are never averaged together**:
two samples, two medians, two silhouettes (`euro` for a mutation, the `tag`
added to `addressMarkerIcons.js` for a listing), and the gap between the two
medians printed as its own line, with both sample sizes beside it and a
sentence refusing the reading a reader would otherwise supply: different
properties, different dates, no temporal adjustment, so not a negotiation
margin.
**The estimate is a quartile range on a named sample**, refused below three
ratio-bearing comparables and told when it is short — never a point estimate,
and never called a confidence interval. **Every exclusion is counted and
printed** (A5): no €/m² without a surface, no €/m² recomputed for a multi-lot
mutation (DVF publishes null there and `dvfFeed.js` measured what dividing
anyway produces), no €/m² outside 300–50 000 €.

It sits on the address-scan shell for one specific mechanism: `setScanPin()`. A
dossier belongs to a property, not to wherever the camera drifted, so posing the
property pins the scan to it — and a pinned scan is exempt from the altitude
ceiling, so the dossier does not vanish when the reader pulls back to see the
city. The candidate sales are deliberately NOT drawn: `dvf-sales` already draws
those same mutations coloured by what they say about the local market, and a
second encoding of the same fact on the same street is A3 broken at the scale of
the map. The pool is a list; the map is the selection.

Its panel is layer-owned and self-mounting (`comparablesPanel.js`, the
`veloPulseHud.js` idiom), so `index.html` carries nothing for it. The dossier is
in `localStorage` under `godsEyeView.comparables.v1` and moves as a file: export
writes our own shape, import accepts either that or a bare JSON array of
listings — which is what an agency's own back-office exports — and MERGES rather
than replaces. Nothing is uploaded anywhere, which is why the share token is
`enabled-only`. The precise version of that claim, which is the one on screen:
prices, surfaces and listing links are never transmitted; the ADDRESS a reader
types goes to `/api/geocode` and to the BAN reverse endpoint because that is
what turns an address into a coordinate, and the property's position goes to
`/api/dvf`. *Rien ne quitte le navigateur* (“Nothing leaves the browser”) was the round version, and an
adversarial pass was right to refuse it. A listing's URL is stored as a link and **never
requested**; `scripts/qa-comparables.mjs` watches every request the page makes
and fails if one reaches the host typed into that field.

`/api/isochrone` (IGN Valhalla over BD TOPO®) WAS a service with no surface —
in the repository since 2026-09-01 and drawn by nothing. It is now the
`isochrone-fr` layer, and it is a point-centred layer for the same reason the
five above are: an isochrone has no meaning without a chosen point, so it scans
around the ground the camera is looking at rather than filling a viewport. The
route takes a COMMA LIST of durations and answers one payload holding every
ring — `seconds=300,600,900` — fetched one at a time upstream, because the
Géoplateforme publishes 5 requests per second per IP with no SLA and an explicit
right to cut a client off (the proxy's `geoplateforme-isochrone` pacer holds the
whole server to 4 a second). It reports, per consecutive pair of rings, the
measured area growth against the ×4 that free space would give, which is an
obstruction reading that needs no assumed speed.

Three things about that layer changed on 2026-09-02, all of them because the
same complaint kept arriving in different clothes: you could not see the
catchment you had just measured.

**The ceiling follows the mode.** One 8 km ceiling covered a walking ring 1.9 km
across and a driving ring up to 16.5 km across (measured at fifteen minutes over
Ustaritz, Paris 11e, Lyon, Bordeaux and rural Cantal), and Cesium shows about
0.65 × altitude of ground on the short screen axis at nadir — so the layer
cleared its own driving answer off the screen exactly when the reader pulled back
to look at it. The ceilings are now 8 / 20 / 45 km for walking, cycling and
driving, with movement thresholds of 0.25 / 0.6 / 1.5 km to match.

**A click on the globe pins the centre, and a pinned centre has no ceiling at
all.** The ceiling exists to stop a camera-driven layer from spending a request
per nudge across a country; a pin spends nothing when the camera moves, so it has
nothing to protect against. That is what lets a reader pull back far enough to
see a whole driving catchment. The pin is a runtime parameter (`centre`), a chip
releases it back to the camera, and it is deliberately NOT encoded into a share
link — every option in `layerState.js` is an enum and a coordinate is not one.

**Cycling is measured on OpenStreetMap, and drawn as an envelope.** IGN publishes
no cycling profile at any resource — re-probed that day, HTTP 400 on
`bdtopo-valhalla` and `bdtopo-pgr` alike — so the cycling ring comes from one
FOSSGIS OSRM `/table` request: 36 bearings × 11 samples, and each bearing's reach
is where the measured duration crosses the budget. Every vertex is a real routed
duration; the straight line BETWEEN two vertices is not, so the shape cannot
express an unreachable pocket or a catchment in pieces and its area is an upper
bound. It is therefore drawn with a dashed outline, its area is called a
majorant, and the same method run on the walking network and compared against the
IGN walking polygon measured −32 % to +117 % of area across five communes — the
worst case being rural, where the true shape is a spider. All of that is on the
card, not only in this file.

On 2026-09-03 the same complaint came back once more, in the last clothes it
had: a catchment measured, drawn, and then left half under a panel with its own
card painted on top of it.

**A pinned centre is now FRAMED.** The layer solves an altitude that fits the
drawn rings and flies there top-down — nadir because ground metres per pixel is
one number only when the camera looks straight down, and a catchment fitted with
the flat-ground formula at 20° of pitch overshoots by tens of per cent. Heading
is kept, and the screen-axis offsets are rotated into ground axes rather than
the map being turned back to north. The target is not the canvas centre: the
chrome rectangles are read live from `WORLD_OVERLAY_OCCLUDER_SELECTORS` — the
same inventory the card solver prefers to avoid — edge bands are inset past, and
the rings are centred in what is left. Chrome here sits in a GUTTER
(`--left-stack-x: 52px`), so a band is an element that STARTS within a tenth of
the canvas of an edge; the first version required it to touch, matched nothing,
and framed a catchment with a third of it under the panel stack. An element
touching two edges is charged to whichever inset removes less canvas, and one
too wide to inset past is ignored rather than obeyed. `isochroneFraming.js` is
pure and its headline test re-implements the nadir projection to measure where
the shape actually lands.

**The card opens by itself, off the shape.** A band the height of the card is
reserved at the bottom of the frame, and the card is anchored on the catchment's
lower edge instead of on the centre marker — so the leader touches the outline
it describes and no pixel of the wash is underneath. Two additions to the shared
shell make that possible for any layer with a shape around its marker:
`afterDraw`, which runs once the draw is on screen AND indexed (the first moment
a card can be opened), and `cardAnchor`, which moves an open card off its
marker. Both are opt-in and the other five address layers pass neither.

**And the card is titled by the address.** *Point fixé — à pied* (“Pinned
point — on foot”) named the
layer's own state. The proxy reverse-geocodes the pin through the BAN — folded
into the memo that already answered the INSEE code for DVF and Géorisques, so a
mode switch over one pin costs nothing — and the title is the street within
120 m, the commune beyond it with the distance said out loud, and the coordinate
when there is neither. The details were rewritten short for the same reason the
band exists: the card is painted beside a catchment it is reserved out of, so
every character is width the shape does not get. The full expansion sentences
survive on the ring cards, which a reader reaches by asking about one ring.

**And on 2026-09-24 the layer was redrawn after its approved mock**, the way
« Urbanisme » and « Aéroports » were. The row is a short form under its name
(`rowSections`, a generic slot of `manager.js`): « Depuis ce point » and the
address on two lines under a pin (« Depuis le centre de la vue » while nothing
is pinned), a « Changer le point » button that arms the next click on the map
(pressed, a hint under it, a crosshair on the canvas — the click itself is the
one the layer always took), « Suivre la vue » under it while a point is held
(the old LIBÉRER chip); « Se déplacer », three tiles with Lucide glyphs
(`footprints`, `bike`, `car`) in the mock's order À pied / Vélo / Voiture;
« Durée maximale » 5 / 10 / 15 min; « Sources et calcul », a closed
disclosure saying in plain words what computed the rings, the equivalent
circle, how the network holds the last band back, the snap and the BD TOPO®
edition; « Vue : Zones / Contours ». `max` and `view` are drawing choices over
the three rings already in hand — all three are still asked for in one
request — so they redraw without a request, and a smaller ceiling over a held
pin reframes on the ring it keeps. Both travel in a share link (`is.d`, `is.v`,
omitted at their defaults 15 and `zones`). The key is a card: « À pied ·
jusqu'à 15 min », « Surface cumulée » (« …, au plus » for the cycling
envelope), one line per drawn duration with its area at the right edge
(`value`, a generic slot of the key) and « Temps de trajet estimés » under
them. On the globe each outline is a thin core lifted toward white over a
wide glow in the mock's teal / blue / violet, the durations are dark tags ringed
in their colour on each outline's northern vertex, and the point is an apricot
pin (the place search pins in red). **Nothing opens by itself any more**: the
panel names the point and the key prints the areas, so the frame reserves no
card band; the pin and each tag still open their card on a click.

**« Fiche implantation » is set aside** the same day, at the owner's request:
its code, token and taxonomy entry stay, and `src/data/pausedLayers.js` hands
it to `withholdLayers(…, { reason: 'paused' })` at boot, before the registry is
sealed. So the « Fiche » chip is gone from the row, and a share link, a scene
or the voice agent asking for it is refused with « … est désactivée dans cette
version de Surplomb » rather than the licence sentence. A stored session saved
with it on drops it once (stored-state revision 2).

These five carry the first **two-character** share tokens — `gr`, `dv`, `dp`,
`ur`, `if` — `cadastre-fr` is the sixth, `cd`, and `ads-fr` later took `au`. The single-character space
ran out exactly where this file kept predicting it would: by the time this
branch met main, `0`–`9` and `a`–`y` were all claimed and `z` is the canonical
UNKNOWN token two tests assert on. `cadastre-fr` and `schools-fr` both claimed
`0` on separate branches, and the duplicate-token assertion turned that into a
BOOT failure at the merge rather than a share link that silently enabled the
wrong layer; `schools-fr` kept `0` because it had already shipped and links
carrying it exist, and the unshipped layer moved. Widening
cost nothing on the wire, because `l=` has always been DOT-SEPARATED: `l=f.dv.p`
parses by the same split that read `l=f.7.p`, every link ever issued still
decodes to exactly what it decoded to before, and a two-character token can
never collide with a one-character one. `MAX_ENABLED_LAYERS_CHARS` was raised
from 64 in the same change — it had quietly stopped covering the everything-on
link at 35 layers (69 characters), so sharing every layer at once produced a
link that decoded to `null`; `layerState.test.mjs` now derives that assertion
from the registry instead of a number someone has to remember to update.

**One silhouette per register** (`addressMarkerIcons.js`). All five layers
answer a question about the same building, and drawn as discs they were
indistinguishable from each other on screen. Colour could not carry the source
— DVF spends it on the price ratio, DPE on the official A–G scale, Géorisques
on severity, IDFM on the mode family — so the shape does: **€** for a sale,
**the A–G letter on a plate of its class colour** for a diagnostic, a **hazard triangle**, a **plan
sheet**, and the **mode pictogram** (reused from `transitVehicleIcons.js`,
because a stop is signed in the street with its mode's own symbol). The DPE
marker being the label itself means a grade is readable without a click.

Glyphs are SVG data URIs, cached per kind and raster size, drawn as white
line-art over a dark halo and carrying no hue of their own — Cesium multiplies
`billboard.color` into the texture, so white takes the value colour exactly
while black survives the multiply. That is the same tint-safe discipline
`sharedMobilityIcons.js` and `transitVehicleIcons.js` record, and it is why one
image per shape serves every colour. Drawn here rather than vendored from
Material Symbols: that pack was taken for vehicles because a tram in plan view
is hard to invent recognisably, which is not true of a euro sign, so these
carry no third-party licence obligation. `scripts/qa-address-layers.mjs` proves
no two registers ever resolve to the same image, and that clicking a billboard
still opens its card — a billboard is not a point, and pickability had to be
re-measured rather than assumed.

**Markers are seated on the rendered terrain, not on the ellipsoid.**
`Cartesian3.fromDegrees(lon, lat)` places a marker at height 0, and the globe
draws avenue de France at 79–83 m of ellipsoidal height — so every marker sat
eighty metres under its own street, painted anyway because depth testing is
disabled. Under an oblique camera a vertical error is a HORIZONTAL error on
screen, and one that changes with the camera pose: measured at 700 m and −35°,
a DVF dot landed 83 px from its address, and turning 40° moved the error
sideways. The dots therefore slid across the city as the camera moved. Every
marker is now placed at `globe.getHeight()` — the height of the terrain
triangle actually being rendered, the same call `bdtopoBuildings.js` uses — and
re-seated when terrain finishes streaming (`tileLoadProgressEvent`) and when
the camera settles, because the LOD under a point refines as you fly toward it.
While terrain has not answered for a marker, the scan centre's height stands in
for it and `getStats().seatPending` says so. `scripts/qa-address-layers.mjs`
measures the residual offset in pixels from two camera poses; a unit test
covers the seating arithmetic. Clamped polylines carry no `position` and are
skipped — they were already on the ground.

A height probe is paid **per coordinate, not per mark** (`renderedSurface.js`).
Coincident marks are the normal case rather than the edge case, and the budget
is 24 probes a pass: the DPE layer used to hand it 200 badges carrying 14
distinct coordinates, one of them carrying 42, so the whole budget went on
fourteen questions asked fourteen different numbers of times and dozens of
marks were still on the fallback height six passes later. Readings taken in one
pass are shared by every mark at the same coordinate to 1e-7 degrees (~11 mm),
including the one-shot latch — the same ground is the same reading whoever
bought it. It is a per-pass shortcut, not a cache with a lifetime.

**The DPE layer draws BUILDINGS, not diagnostics** (`dpeSites.js`, since
2026-09-14). It is the only one of the five whose register answers many rows
per address — a block of flats produces one diagnostic per sale — and drawing
one badge per row put 200 marks on 14 pixels, made the card a lottery between
forty-two flats, and exhausted the seating budget described above. The served
rows are grouped into SITES: by the building the register names (`id_rnb`), by
the BAN address when it names none, by the bare coordinate when it has neither.
An address whose identified rows all name the SAME building lends that
identifier to its unidentified rows (111 of 200 rows carry one, 135 after the
loan); an address that names TWO buildings lends neither, because that is a
courtyard building behind a street one and choosing between them would be a
coin flip dressed as a record.

Each site draws its **footprint**, from the RNB's published `shape`, washed in
its own mode letter at alpha 0.26 and outlined — clamped to whichever surface
is being drawn, so on the photoreal stack the tint climbs the facades and the
answer to "which building is this" is a whole building lit in its colour, with
`Bâti 3D` switched off. Under it the **cadastral parcel** is drawn as a dashed
achromatic line and never as a wash: the colour channel is spent on the seven
official letters, and a DPE says nothing about land. The badge stands on the
footprint's own label anchor — the midpoint of its longest interior chord, not
its centroid, which for a building around a courtyard lands in the courtyard.

Both shapes are resolved SERVER-SIDE by the `/api/dpe` proxy, six RNB calls in
flight at a time plus one cadastre box shared with the `cadastre-fr` proxy's
own snapped-box cache; measured 5.9 s cold and 0.39 s once that box is warm,
against 10 sites. Neither upstream can withhold the diagnostics — a site with
no shape keeps its badge and its card, and `getStats()` publishes `sites`,
`sitesOutlined`, `sitesParcelled`, `sitesUnplaceable` and `sitesOverBudget`
rather than implying every address got an outline. Three marks, one subject: a
click on the wash, on its outline or on the parcel line selects the site's
BADGE, through the shell's `selectionFor` hook — a clamped polygon has no size
to grow and no colour to take, so without the redirect a reader clicked a
building, got the right card, and saw nothing change.

Measured on the live app, 1400 × 900, nadir at 420 m, before and after:
200 badges → 10, worst height error 25.2 m → 0.0 m, worst screen offset
25.5 px → 0.0 px, worst slide across a 250 m pan **72.6 px → 0.0 px**.
`scripts/qa-dpe-sites.mjs` recomputes all of it, plus the thing that caused it
(how many badges share a coordinate) and the card's four placement sentences.

**Plates, pills, a card in the key, and a filter** (2026-09-21). A site's badge
is a filled **plate** in its class colour with the letter in dark ink
(`addressMarkerIcons.js`), 22 px, 14 px when the volume under it already says
the letter. Plates that touch on screen fold into one **pill** that prints the
group's letter RANGE, each letter in its colour, and its diagnostics — `C–G ·
33` — grouped greedily in screen space by the pill each group will actually
draw, re-grouped when the camera settles or a plate is re-seated, the selected
plate never folded; a click on a pill flies the camera a third of the way in
(measured 625 m → 216 m) until its plates part. Cesium's `EntityCluster` was
tried first and left 8 overlapping pairs among 26 marks on the reference view,
because its pills are wider than the boxes it groups by; the greedy grouping
leaves none.

A click on a site moves its card into the map key (the #312 hooks, shared with
the DVF): the street and the locality, the diagnostic count large, the classes
present as plates with their range (« De C à E »), « Classe la plus fréquente :
D » with a tie named, the passoires and the median cost, a footnote saying each
rating describes one dwelling and not the building, and a folded list of every
diagnostic, newest first, each linked to its page on the ADEME observatory
(`observatoire-dpe-audit.ademe.fr/afficher-dpe/<numéro>`). The list's open
state survives the key's once-a-second repaint. The globe keeps a tag with the
range and the count (`C–E · 16`); the building is refilled in its class colour
at 0.55 and ringed in white, its parcel ringed in white (`groundHighlight.js`,
now shared with the DVF plot highlight).

The key's DPE block prints the « worse of the two grades » rule once, then the
seven letters as coloured plates that FILTER the map, then the loaded counts
two to a column, then one line — `200 / 904 diagnostics · rayon 200 m · 39
adresses`. A press shows that class alone; the next presses add or remove one;
removing the last shows everything. The runtime param `classes` carries the
letters shown (127 legal values, `ABCDEFG` by default) and is draw-only: no
request. The filter is over DIAGNOSTICS — a building holding C, D and E stays
under an E filter and its plate becomes E with the count of E — and hides
unlabelled ones; the key's counts stay the whole answer. Not in share links
(`enabled-only`, like the DVF's `type`).

**Urbanisme answers a BLOCK below 1 500 m and a POINT above it.** It is the one
layer of the five whose question depends on the camera as well as on where the
camera points, because its own question is about the plot OPPOSITE: "could the
car park across the street become twenty-five metres of construction?" cannot
be answered by a query about the ground underfoot. Below
`GPU_BOX_MAX_ALTITUDE_M` the zoning half is asked for over a box around the
camera's ground point — `focusedViewBox`, clipped to the view so nothing off
screen is fetched, capped at `GPU_MAX_BOX_DEG` (0.02°, the cadastre's number
for the cadastre's reason: at twice that side Paris answers 243 zones and
1.2 MB against 52 and 405 KB). The gate is ALTITUDE, never the span of the view
rectangle, which on a tilted camera reaches the horizon. Above it, the point
regime is unchanged.

The EASEMENT half is always a point, and one measurement decides it: a 390 m
box over Lyon's Presqu'île answers 210 easement features and 2.3 MB. At the
zoning ceiling, upstream / on the wire / entities: Lyon point 725 KB / 409 KB /
153, full box 4 004 KB / 1 823 KB / 1 182, hybrid 888 KB / 506 KB / 218.

It costs bytes, not frames. Measured on the shipped build over IGN ortho in
both regimes: median frame 0.6–1.4 ms, worst frame after a redraw 1.4–2.2 ms,
zero frames over 16 ms. `zone-urba` carries the SAME silent 5 000-feature cap
as `cadastre/parcelle` — a 0.40° Paris box returns 5 000 of 17 182 at HTTP 200
— so a box over it is refused whole and the true count printed; at 0.02° the
densest measured box answers 55 zones.

`atPoint` marks the zone under the operator, and WHO decides it depends on who
was asked. Under a point query APIcarto has already answered — every returned
feature intersects that point by construction — so the flag is simply true.
Under a box query the layer decides, against the ring as PUBLISHED and never
the one it draws: Ustaritz's `UB` ring is 521 vertices decimated to 400, and
the coordinate the service itself answers `UB` for falls outside the decimated
ring. Each zone also carries a label anchor — the midpoint of its longest
interior chord, not its centroid, which for a zone shaped like a meander or a
ring around a hamlet lands outside the zone entirely — and its code is written
on the ground there, because hue gives the family but not `UB` against `UYc`.

The shell rescans when the QUERY changes, not only when the scan centre moves
250 m: zooming straight down through the box altitude moves the centre by
nothing while changing the kind of answer that belongs on screen.

**A PLU zone is not a place, it is a rule over an area,** so `urbanisme-gpu` is
also the one address layer that fills: each zone is a translucent, ground-classified wash with its
interior rings CUT OUT, and the stroke on top of it. The wash says where, the
stroke says exactly where — and the enclave is the part that matters. The
projection kept outer rings only until 2026-09-01, on the reasoning that a hole
in an outline is invisible; it is, and it is the entire point of a fill.
Measured at Ustaritz: the `UB` zone under the village centre is one polygon
with two interior rings, 6 646 m² the same document zones `UE` and 50 686 m²
it zones `UYc`, so the filled-without-holes version painted 57 332 m² of ground
with a rule that does not reach it. Rings are spent out of the vertex budget
WITH the ring they perforate, so a hole is never what a budget drops.

`typezone` carries SEVEN values and the colour table had four. A census over
twelve APIcarto boxes on 2026-09-01 — 4 216 zoning features — found **zero
occurrences of plain `AU`**: every future urban (*à urbaniser*) zone publishes `AUc` (open under
the PLU as it stands) or `AUs` (closed until the document is modified or
revised), so the family this layer exists for was the one drawn in the
unknown-value grey. Both are now coloured, `AUs` cooled and quieter, and
`Ah`/`Nh` take their family's hue brightened. Fill weights were measured rather
than chosen: differenced against an unpainted frame over an IGN orthophoto,
0.18 moved the picture by a mean of 3/255 in red and was invisible, which is
why the shipped ladder runs 0.22 (`A`/`N`) to 0.42 (`AUc`). Servitudes stay
lines and are DASHED — they are not zoning, and one measured `pm1` envelope is
759 polygons spanning kilometres, so a wash of it tints the view, not a plot.

More than one zone under one point is not a bug and `zoneCount` reports it: on
a 35 m grid over a 9 × 6 km box around Ustaritz, 17 of 34 126 points fall in
two zoning polygons, every one at a commune limit where two independently
digitised PLU documents overlap — 73 polygon pairs and 5,3 ha in that box
alone.

**A click anywhere on that ground answers for that ground.** `urbanisme-gpu` is
the only address layer with a `groundCard` — the other four describe things
STANDING on the ground (a sale, a diagnostic, a hazard record) and those have
addresses, while a zoning rule and an easement are properties of the plot
itself. Clicking the wash, an outline, or the bare globe between them resolves
the coordinate geometrically (`groundPick.js`: rendered terrain, then the depth
buffer, then the ellipsoid — `scene.pick` is used only to say WHOSE click it
is, because classification geometry answers a pick with whichever shadow volume
the ray enters first) and reads the answer out of the payload already in hand.
No request, no wait, and it works on the plot OPPOSITE — which is the plot the
layer exists for. Measured at Ustaritz at 900 m: four clicks across one screen
answer `UB`, `UA`, `A` and `UB`. The scan marker keeps its own card, which is
the scan-level summary; every other click is a question about a point.

The answer is read off the DRAWN shapes, and within 30 m of the marker it
deliberately is not: those shapes are decimated by up to 96%, and at the scan
point the register has already answered — `atPoint` for the zoning, and every
easement in the payload by construction, since that half is always a point
query. So near the marker the register wins and the geometry is not consulted;
further out the drawn map answers and the card says its outlines are
simplified. The card also distinguishes the four ways a point can have no zoning
— the answer was refused whole, the box never covered this spot, the camera is
above 1 500 m so only the marker was asked about, or the published document
genuinely stops here — because printing *aucun zonage* (“no zoning”) for all
four would report three of this layer's own limits as facts about the plot.
Easement absence is worded the same way: *aucune servitude à ce point* (“no
easement at this point”) only where the register answered that point, and
*aucune des N servitudes du repère n'atteint ce point* (“none of the marker's N
easements reaches this point”) everywhere else.

**One row, two registers, and since 2026-09-14 two switches.** The row carries
a chip per half — *Zonage PLU* (PLU zoning) and *Servitudes* (Easements) — and they are independent
rather than a three-state selector, because "zoning only", "easements only" and
"both" are three questions a reader actually has. Over a village centre the
wash covers every square metre of the block and the dashed envelopes run across
it, and the only way to see under one used to be to switch off the answer
entirely. Both are `drawOnlyParams`: one request carries both halves — 1,4 MB at
the measured worst case — so hiding one rebuilds the entities from the payload
in hand and spends neither a request nor a rate-limit slot. The chips govern
the GEOMETRY and nothing else: the scan marker and every ground card keep the
whole register answer, and the marker's card names what is hidden (*zonage
masqué sur la carte*, “zoning hidden on the map”) so five easements listed over a bare photograph read as a
switched-off half rather than as a broken layer. Turning both off is allowed and
leaves the marker, so a row that is ON never draws nothing. The key follows the
chips — a swatch for a shape nobody can see is the same defect as a key for a
dormant scan — and the marker falls back to the easement red, then to neutral,
rather than wearing a zone hue the key no longer decodes. **The key itself had
never once painted**: it arrived in #78 declaring `rowControls(payload)` in the
very commit that moved the shell to `rowControls(runtime, summary, payload)` —
the two halves of a rebase — so the family tally ran over the runtime object and
every scan published an empty key: eight zoning families painted on the ground
with nothing anywhere to decode them.

Because the wash is ground-classification geometry, and a classification
surface is read once when the primitive is BUILT, `urbanisme-gpu` is also the
one address layer that sets `redrawOnMapStack`. Switching to the photoreal
tileset hides the globe, and a wash addressed to terrain then draws nothing at
all — the layer reads as switched off. It rebuilds from the payload already in
hand, with no request and no rate limit spent.

Licence note: IDFM is **ODbL 1.0** — attribution and share-alike on derived
databases — while the other five are Licence Ouverte. See `DATA_SOURCES.md`.

#### Ambient labels are a click surface (September 2026)

The name floating above an object on the globe now selects that object, exactly
as its dot does. It did not before, and the reason was mechanical rather than a
policy: the shared world overlay paints every label onto a
`pointer-events: none` canvas stacked over the Cesium viewport, so
`scene.pick()` under a label returns whatever is behind it — usually the globe,
i.e. nothing. A click aimed at a station's name therefore read as *empty space*
and DISMISSED the selection, which is the opposite of the intent. And the name
is what people aim at: it is what says which river or which yard this is, and
it is five to twenty times the target area of the 5–15 px dot it belongs to.

The host already had the two halves — entries flagged `interactive` publish a
screen-space hit rectangle each painted frame, and `hitTestWorldOverlay()`
resolves the topmost one. What was missing was the resolution step in each
layer's click handler. `src/data/overlayLabelPick.js` is that step written once:
it fences the hit test to the asking layer's own overlay source, strips the
entry-id prefix each layer publishes under, and re-checks the id against the
layer's live record map — hit rectangles are pooled and published per painted
frame, so one can name a record that left the viewport a frame ago, and that is
a miss rather than a selection.

**The resolution order is the load-bearing part, and it is the same everywhere:**

1. `scene.pick()` — a native primitive under the cursor wins. Labels float
   above their anchor, so the two rarely overlap; when they do, the thing the
   depth buffer says you are pointing at is the honest answer, and it is also
   the one the pick registry can arbitrate between layers.
2. the label plane, which the depth buffer knows nothing about.
3. only then, empty space → clear the selection.

Putting the label test first would let a label drawn across a NEIGHBOURING
object's dot steal that object's click.

Wired into twelve layers: **Hub'Eau Gauges**, **Réseau électrique**, **Réseau
gaz**, **Production RTE**, **Centrales hydro**, **Événements routiers**,
**Écoles (FR)** and **Bornes IRVE (FR)** (both on their département names at
national altitude), **Radio** (station names only — a cluster badge names a
count, not a station), **Câbles sous-marins** (whose stem tip is a 7 px dot at
the end of a hairline, often out over open ocean), **Satellites** (the ISS
label, where the point is a few pixels of a target moving at orbital speed) and
**Rocket Launches** (the ambient mission markers). Selected-object CARDS stay
non-interactive: a card names what is already selected, so a rectangle there
would do nothing but cover the ambient labels behind it.

Layers deliberately left alone: Vigicrues, Météo-France Vigilance, the
earthquakes, the marine buoys, Mix élec and the transit routes all paint ambient labels
but have no selection to trigger — a click surface with nothing behind it would
be a lie. Mobilité partagée, Transit (FR), État du réseau and Bâti 3D publish
only selected-object cards and no ambient labels, so there is nothing to make
clickable.

Hub'Eau is the layer the request came from and the one where the gap was
widest: its dots draw at `disableDepthTestDistance: 2500` against siblings that
use infinity, so the click handler already has to `drillPick` eight deep just
to find its own dot under a charging point — while the name beside it was inert.
Its ambient label carries the same `hubeau:<code>` id as the dot, so one string
identifies a station across the drill pick, the overlay hit test and the pick
registry, and the label branch resolves straight into the existing
`selectObject()`.

Proved in a real scene by `npm run qa:label-click`, which reads where the host
painted a label, dispatches a real pointer event at its centre — nowhere near
the dot — and asserts the layer's selection changed; and that a click on empty
space still clears it, on the layers that have ever had a deselect branch.

**A paint lane can now publish its own click surfaces (September 2026).** An
ordinary entry gets its hit rectangle for free, because the host lays it out and
therefore knows where it landed. The DETECT overlay is not an entry source: it
solves callout placement against its own collision arbiter and hands the host
nothing but pixels, so its callsigns could only ever be scenery. That was the
widest gap of all — a contact's sprite is a few pixels of a target at 900 km/h,
the callsign beside it is several times that area, so it is what people aim at,
and every one of those clicks fell onto the globe and DESELECTED the aircraft
being followed. `publishWorldOverlayLaneRect()` is the seam that closes it:
same hit-rectangle buffer, same `hitTestWorldOverlay()` resolution, same
one-frame lifetime, re-stated on every painted frame exactly like the text
itself. Callouts fainter than 20 % alpha publish nothing — a rectangle over text
nobody can read is a trap, not a target.

The scope is **per layer**, `detect:<layerId>` (`detectionLabelSourceId()`):
civil and military aircraft share one lane, and a handler that hit-tested the
lane as a whole would resolve its neighbour's callsign as one of its own
contacts. **Vols** and **Vols militaires** consult it, in the same three-step
order as everything else, and select the contact the callsign names.

**What the four bundled packs draw is bounded by TWO screen rules, not by the
horizon (September 2026).** Until `localGeojson.js` gained them, the only
spatial question it asked was `EllipsoidalOccluder` — is this point beyond the
horizon — which is a hemisphere, not a viewport: measured before the change, at
120 km over Lyon with all four packs on, **10 178 of 22 218 features were
`show = true`**, ten thousand of them on the far side of Europe, Africa or the
Atlantic and never once on screen. (1) A **frustum gate** now hides anything
whose whole drawn extent is outside the view volume, sized on a bounding sphere
that reaches from the ground anchor out over the recall stem — which is 65 px
on screen at every range, so ~1 670 km of world at orbit — plus the surveyed
footprint and the runway segments at their maximum stretch. It is deliberately
generous, and it fails OPEN: a scene that cannot describe its frustum culls
nothing. (2) Above **2 000 km of camera height** a **screen-cell budget** keeps
one mark per occupied 26 px cell, ranked by the same priority comparator the
ambient cards use so a name never lands on a dot that is not its own, capped at
600 marks per pack, and with the SELECTED feature always pinned so pulling back
to orbit never deletes the thing under an open card. Below 2 000 km the budget
is not applied at all — a visitor at city range zoomed in to separate two
neighbouring structures. Both answers are re-decided only on a camera settle,
like the marker range and the footprint floor beside them, and both follow the
`lite` render profile (60 % of the marks, grid widened by `1/√0.6` because a
grid loses cells with the SQUARE of its pitch). Cesium's own leftovers went with
them: the pack no longer keeps the **pin billboard** Cesium builds for every
POINT feature (16 834 of them, each drawn under the app's own dot) nor the HTML
**description table** its default `describe` renders per feature (22 218 of
them, 1 995 276 characters on the ports pack alone) — neither was ever read.
`npm run perf:infra` is the bench that holds all of this to a number.

**Where a pack's stems read the ground, and which records ask (since
2026-09-23).** Every record within 75 km of the camera used to read its ground
with `scene.sampleHeight` — a synchronous offscreen pick render plus a
`readPixels` — on every stack, on screen or not; and since `sampleHeight` only
answers from tiles rendered in the current view, a record off screen never got
an answer and asked again every 2 s, with the self-armed retry requesting the
frames it asked on. Measured over Paris at 5 km with the data centres alone, on
the ThinkCentre with the CPU throttled ×4 and the Satellite stack: **1 033
`sampleHeight` calls in the 8 s after the switch** (21.8 s of pick rendering),
~1 000 more every 8 s after that, **0.2 frames per second** while turning the
view and 6.8-16.7 s of long tasks after each stop; `readPixels` was 146 s of a
194 s CPU profile. The walk now builds one `localGroundSource(scene)` per pass
and three rules decide the rest. (1) On the globe — every stack but Google 3D —
the ground is `globe.getHeight`, a CPU lookup in the resident terrain; only the
photoreal mesh, which hides the globe, still pays `sampleHeight`, and only once
its tileset has drained, in bursts of `GROUND_MESH_SAMPLE_BUDGET` = 24 (the
backlog comes back at the walk's 450 ms cadence rather than the 2 s give-up
rhythm), inside the −500…9 500 m band `renderedSurface.js` holds every layer to.
(2) Only a record the settle found on screen, in range, over the horizon and
not filtered out reads or arms a retry. (3) A reading is stamped with its
surface (`groundSurface`: the mesh, or the globe's terrain provider), kept
provisional while the globe's tile queue is not empty (`groundFinal`), and
taken again when the camera stands at half the distance it was taken from.
Same view, same machine, after: 0 `sampleHeight` calls, 17-18 frames per second
turning, 0.6-1.2 s of long tasks after a stop, and the drawn stems at the same
heights (median 84.3 m). On the Mac, same probe: `main` drew **14 of the 70
sites on screen at 0 m** — the reads that never landed — and none after.

**The marks are one primitive batch, and a polygon is held only while it is
drawn (since 2026-09-23).** With the ground fixed, the next cost of the
data-centre pack was Cesium's own entity machinery: a `PointGraphics` or
`BillboardGraphics` on an entity is walked by its visualizer on every frame,
drawn or not — `BillboardVisualizer.update`, `returnPrimitive` and the cluster
lookups were 5.9 s of a 40 s profile over 4 649 entities of which a few dozen
were drawn. The marks now live in `_marks`, one `BillboardCollection` (a glyph
pack) or `PointPrimitiveCollection` (every other pack) per layer, each mark
carrying `id = entity` so a pick resolves to the feature exactly as before;
the entity keeps its position for the selection and the voice, and
`entity.__localMark` points at the mark for the QA harnesses. The footprints
were the cost after that: a hidden ENTITY keeps its polygon in Cesium's
geometry batch, where the 461 extruded halls, clamped relative to the ground,
were re-evaluated on every frame — 14 frames per second turning over Paris
with the 3 528 polygons resident, 22-28 with them taken off. `showSurface()`
now writes `polygon.show`, which takes the polygon out of the batch: it is in
only while its mark is drawn and it spans at least `OWN_SURFACE_MIN_SCREEN_PX`
= 2 px (the airport footprints keep their 8 px floor), and a load starts with
none in. Nothing drawn changes. Measured on the Mac at Paris 5 km, CPU ×4,
two interleaved pairs: `main` 0.4 frames per second turning, 8.5-12.9 s of
long tasks after a stop and 8.9-12.9 s in the 8 s after the switch; after,
32-34 frames per second at a machine load of 12-32 and 55-58 at a load of 11,
against 60 with the layer off; 0.06-0.6 s after a stop, 0.2-0.3 s after the
switch, 0 at rest — and the same 55-58 with every footprint taken off, so the
drawn ones now cost nothing measurable.

**Airport names select and frame, exactly as their pastille does.** The local
infrastructure layers (**Aéroports**, **Ports**, **Barrages & digues**, **Datacenters**)
publish an ambient CARD carrying the feature's name at the tip of a recall stem
whose marker is a few pixels wide; the card was `interactive: false`, so the
larger of the two targets did nothing. It is now the same click as the marker —
selection, Context, and the 5 000 m framing flight. Its label branch yields to a
sibling local layer's own entity and to any pick the registry says another layer
owns — but NOT to an unclaimed pick, and that distinction is what makes the
feature work at all: over a loaded photoreal tileset almost every on-globe pixel
picks a 3D tile feature that no layer owns and nobody can select, so treating a
non-null `scene.pick()` as "occupied" would have left every name on the globe
inert again.

### Context / Contacts coordinator (July 2026)

- The internal Context coordinator is available in every visual style. Its dedicated right-side `CONTEXT` chooser exposes the neutral shell; the coordinator is not duplicated in Data Layers and does not enable a live-data dependency until a mode is selected.
- The expanded `CONTEXT` view offers mutually exclusive `CONTACTS` and `SPACE MISSIONS` modes. Selecting `CONTACTS` enables the context-owned Flights, Military Flights, AIS Vessels, and Mapped Installations dependencies only when they are not already user-enabled; selecting `SPACE MISSIONS` enables the recent-launch layer and its Satellite dependency. `CONTACTS` cycles the nearest supported contact of whatever type is selected. Satellites are deliberately excluded from those Awareness cohorts and keep their own tracking UX. Selecting the active mode again returns to the neutral chooser and releases only mode-owned dependencies.
- If a civilian or military aircraft is already tracked when `CONTACTS` becomes operational, that source-owned track is adopted as the Context subject before nearest-contact autofocus. Context rechecks the tracker after its dependencies settle, so a newer selection wins, while an explicit clear during activation prevents fallback from silently selecting a replacement. Cockpit entry remains unavailable until that Context transaction has settled, so its camera takeover cannot clear Cesium tracking before adoption. Adoption does not recreate tracking or transfer camera ownership; it initializes the normal 250 km ring, history, proximity results, and Cockpit Previous/Next state for the original aircraft.
- Mapped installations arrive from Overpass as ways and relations carrying a
  bounding box rather than a centre — `out center tags geom` honours only the
  last geometry mode, so `center` is never emitted. A feature with no explicit
  point is placed at the midpoint of that box; an inverted, antimeridian-spanning
  or implausibly wide box is refused rather than averaged. Measured over
  Strasbourg on 2026-09-09: 21 elements returned, 2 of which carry a point of
  their own.
- Clicking a mapped installation selects it; clicking it again, clicking empty
  map, or clicking a contact this layer does not own releases the selection and
  clears only this layer's shared context, leaving a sibling layer's freshly
  picked contact intact — the same rule CCTV world clicks follow. A later
  repaint (a debounced refetch, a ground floor resolving) yields to any newer
  selection made elsewhere instead of repainting its own former site.
- The layer holds OpenStreetMap only. The `SEARCH NEARBY SITES` button and its one user-initiated Google Maps Places text search for “military installation” were removed on 2026-09-10: Places has no military type, so every result was classified by NAME alone and drawn as an unverified candidate that vanished at the next camera move. Nothing on this layer is now sourced from anything but a mapped OSM tag.
- The expanded desktop header omits the redundant `ON` label; the active mode button carries state. Expanded Contact results also omit the duplicate `GLOBAL CONTEXT` / `CONTEXT ONLY` status row and begin with the selected subject and its 250 km scope. Global Context does not fabricate a selected-entity model preview: the provisional hand-authored aircraft wireframe was removed because it was not geometry extracted from the selected entity's actual asset.
- Dependency ownership is reversible: disabling Global Context releases only dependencies it enabled, while user-enabled layers remain on. This also removes the Military-layer suppression handoff when Global Context owned Military, allowing an already-enabled civilian Flights layer to resume its normal mixed rendering. If OpenSky is unavailable and has no last-good cache, Flights requests a capped 250 nm adsb.lol point snapshot around the current view anchor and labels that provenance explicitly; it never relabels military-feed rows as civilian data. If both inputs fail, Flights remains `UNKNOWN`.
- Space Missions is replay-isolated: Rocket Launches and Satellites are the only Data Layers permitted while the mode is active. Direct UI and voice entry capture the same pre-entry snapshot; internal dependency and restoration enables do not create a user-owned Context session. Entry waits for incompatible layers to shut down, direct incompatible enables are blocked before lifecycle work, and the entry gate remains active through the complete Rocket Launches enable. A newer same-target ON request takes ownership of the pending entry without releasing its isolation snapshot, including when it arrives while the prior request is awaiting the adoption guard. A caller abort, resource cancellation, newer OFF, or layer teardown waits for exact manager settlement and restores that snapshot without resurrecting Rocket Launches. If an abort lands after only part of a restore settles, Context completes the same exact target without the stale caller signal and then replays newer explicit layer intent. Dedicated Voice Context cancellation reports a stable cancelled result plus the current Context state; generic layer visibility additionally exposes manager phase, reason, successor, and lifecycle details. Once an exact voice visibility intent commits, a newer voice turn cannot relabel it as cancelled while Context settlement completes; pre-commit aborts remain cancellable and final lifecycle mismatches remain failures. Clear Selected Layers reserves its complete captured OFF set before sequential teardown; a newer absolute request of any origin supersedes only its layer reservation and remains authoritative. A rejected layer teardown retains the truthful enabled state, rolls already-stopped siblings back to the captured pre-entry set, and aborts replay; rapid exit/re-entry serializes the full Satellite enabled-state and parameter restore before a new snapshot is taken. Contacts remains additive and restores user-enabled layers normally.
- Enabled Data Layer controls report normalized feed health on the button (`LOADING`, `DEGRADED`, `STALE`, `FALLBACK`, or `UNAVAILABLE`) while the metadata line retains the source and reason. A partial CelesTrak group failure keeps the usable catalog and reports `DEGRADED`; a total outage keeps last-good catalog data visible but reports `UNAVAILABLE`.
- On activation it focuses the nearest currently observed aircraft across the civilian and military feeds, with military winning an exact distance tie; if none are available, it focuses an observed AIS vessel. The aircraft search is deliberately uncapped and one refresh-tick retry handles initially empty feeds. This is an attention-priority navigation shortcut, not a high-risk, affiliation, or threat classification.
- A selected aircraft, AIS vessel, or mapped installation gets a 250 km **context window** with nearby cohort counts, nearest examples, source labels, and stale/unavailable reasons. It emits `NEARBY` or `UNKNOWN`; no detection, engagement, affiliation, or sensor-activity conclusion is calculated.
- For a selected live aircraft or vessel, the context window refreshes from the existing tracker/feed position every 750 ms, so nearest distances and cohort counts follow the subject without introducing a duplicate poll loop.
- Aircraft cohort membership uses every locally loaded, selectable contact inside the 250 km window, including a plane hidden only by horizon culling or because its 3D model owns the visual. Counts and navigation therefore do not change with the current camera angle or billboard/model handoff.
- Nearby examples in the context panel are focus controls: they use their owning layer's existing selection/tracking path, then frame that contact. Static-installation distances use ellipsoidal surface distance so the count matches the ground-projected context disk.
- Context selection transfers camera ownership by subject type: selecting a civilian or military flight keeps that layer's moving follow camera, while selecting an AIS vessel or mapped installation first releases any prior aircraft tracker and performs only the source layer's one-time framing. The camera therefore remains user-controlled after non-aircraft selection instead of continuing to move with the previously selected plane.
- Selected AIS vessels use their layer-owned full-detail presentation model in the shared world-overlay host; mapped installations use the tracked-readout aesthetic. Both remain crisp above post-processing without duplicate selected labels; non-selected AIS cards retain their source-owned grid/visibility selection and are host-batched with other world cards.
- Space Mission ascent replay uses the compact rocket/thrust overlay only through orbit insertion. Once the replay enters its orbit phase, that vehicle glyph is replaced by a fixed-size cyan dot following the same orbit path and callout.
- While a subject is selected, an inner keyhole compass rotates against camera heading and up to three cyan shafted bearing arrows lock to its single faint tick-marked rim, with their labels inset just inside the circle. Labels explicitly separate the geographic bearing (`BRG`) from the contact's reported course (`CRS`) so the pointer direction is not confused with aircraft heading. They point toward the nearest observed/mapped examples; each cohort displays up to ten examples while retaining the complete locally loaded in-range cohort for navigation, with three visible at a time and a ten-second page rotation shared by the panel and arrows. This distinct neutral-context color avoids implying that all context indicators are military-flight symbols. `PREVIOUS`, `FOCUS`, and `NEXT` controls navigate selection history or the next nearby cohort example through the existing tracker. NEXT uses a cycle-scoped visited set and starts a deterministic new walk after exhausting the current candidates instead of re-admitting the nearest visited contact.
- Installations are viewport-bounded OSM map features (`military=airfield|naval_base|range|barracks|base` and `landuse=military`), capped to a 10° non-dateline request and 700 upstream features. The proxy caches five minutes and serves a one-hour stale fallback. Empty, stale, unavailable, and zoom-too-wide states remain visibly distinct.
- The selected-only visual is one static, unfilled blue circle. It marks the 250 km proximity context window only; it is not coverage or a radar/weapon envelope. Missing broadcasts and unmapped sites are explicitly not evidence of absence.
- The right rail's collapsed Display, CCTV, and Context controls use the same compact sizing language as the left rail's collapsed Data Layers and Scenes controls. These compact-state widths do not constrain expanded panel or child-content widths.

### Motion & Symbology Correctness (June 10, 2026)

- **Flights (commercial + military)** render one poll interval behind real time (30s/15s) and interpolate between two known feed-stamped fixes (OpenSky `time_position`; adsb.lol `receipt − seen_pos`). The display latency is an intentional product decision — do not "fix" it away. The whole fleet dead-reckons at ~12Hz (1m² write gating); aircraft get a 3-poll grace period (faded icon) before removal. When a position epoch pauses, both layers coast for at least 60 seconds of contact grace with an absolute five-minute ceiling. Source backoff marks each contact and the cockpit `STALE`; the cockpit then holds the exact layer position instead of continuing inertial flight. Repeated-position kinematic changes create a forward-only synthetic fix rather than mutating history, and grounded history is lifted only when no owned 3D model already controls its datum. A nominally successful worldwide OpenSky response whose own snapshot epoch is more than two minutes old prefers the existing 250-nm viewport-scoped adsb.lol fallback and labels the source/coverage accordingly when that upstream is available. If the fallback is also unavailable, the layer's freshness/error fields use the source epoch—never the cache receipt time—so the UI reports an old snapshot rather than “just now.”
- **World-space headings at every angle** (`src/data/iconOrientation.js`): aircraft/vessel icon rotation uses the camera right/up basis per tick (alignedAxis always ZERO), which is exact at screen center and for orthographic/nadir views and remains stable through >180° tracked orbits. Perspective rays vary across the viewport, so off-center contacts at oblique pitch can diverge from an exact finite-difference window projection; a regression test pins that known regime, and field evidence decides whether to adopt exact projection with the basis method as fallback. Fleet rotations refresh on camera-pose change; tracked entities per frame. Billboards are horizon-culled via a shared EllipsoidalOccluder.
- **Military/OpenSky reconciliation** (`src/data/militaryRegistry.js`): known-military ICAOs render amber in the flights layer (60s self-poll of the cached mil endpoint when the military layer is off) and are suppressed there while the military layer renders them.
- **Satellites**: 838-sat core catalog (stations/visual/GPS/GLONASS/Galileo/GEO), tracking lands ~726km out via `viewFrom` (tracked entity owns a point graphic so the tracking camera engages), rings realign via primitive modelMatrix (no per-second rebuild flicker), optional `setParams({catalog:'dense'})` Starlink mode.
- **Satellite classes** (`src/data/satelliteClass.js`): every satellite is classified from the CelesTrak group it was ingested with — no extra fetch and no heuristics — into STATION (warm white), NAV (cyan; GPS/GLONASS/Galileo deliberately share one color so the GNSS family reads as one thing), GEO (violet), VISUAL (muted blue-gray catch-all), and STARLINK (dim slate, the broadband shell only). That module is the single source of truth for class, label, and color, so the dot, the card, and the legend swatch cannot disagree. Two deliberate palette rules: no class may sit in the 40–48° amber band, which is the app-wide known-military convention; and STARLINK stays far below VISUAL in Rec.601 luminance so the shell stays separable when NVG/FLIR collapse the scene to one channel. The ISS keeps its long-standing red hero dot rather than the STATION color — it carries a permanent name label and its card still reads `STATION · ISS`. `satelliteClassOf` is the single owner of that ISS rule, so the card label and the legend tally can never disagree: during a stations-feed outage the ISS is ingested as `visual`, and both surfaces still file it under STATION.
- Class is also a **text field**, not just a color: `NAV · GPS` / `GEO` / `STARLINK` / `STATION · ISS` leads the tracked card's detail block and replaces the raw CelesTrak tag on the detection-overlay label. Because that canvas composites above the post-FX chain, the class stays readable in NVG/FLIR after the in-scene dot colors are flattened.
- The satellites row in DATA LAYERS carries per-layer sub-controls (`DataLayerManager._syncRowControls`, the first consumer of the optional `getRowControls()` layer hook): a **DENSE** chip exposing the existing `catalog` param. The per-class swatch counts it also used to print inline are published through the same `getRowControls().legend`, but painted only on the map key. Default is the sparse core catalog. The chip is stateless — it declares the params to apply and the manager owns the write — so the Space Missions capture/restore path over the same param stays authoritative. Controls stay hidden while the layer is off. An explicit CORE or DENSE choice participates in versioned local and share-link state; temporary Space Missions overrides do not.
- **The STARLINK chip reports the dense LOAD, not the catalog param.** The param flips synchronously while the Starlink shell takes seconds to arrive over a chunked load, and CelesTrak 502s that feed regularly. So the chip reads `STARLINK ···` (busy, disabled) while loading, ACTIVE only once dense points are actually on screen, and `STARLINK ✕` with the reason on hover when the load fails — a failure also reverts `catalog` to `core`, drops any partial chunk, and leaves the chip clickable to retry. A load is judged by points added, not by HTTP status: a 200 carrying an empty body, a passed-through HTML error page, or only TLEs the core catalog already owns fails with the same revert semantics as a 502. Any explicit request for `core` clears a latched error even when the mode does not change, so a Space Missions restore of an already-core snapshot never leaves the user with a failure they did not cause. Because the load settles asynchronously, the layer pushes a re-render through the optional `setRowControlsListener()` hook; nothing else would repaint that row before the 5-minute catalog refresh, so the count and legend would otherwise sit stale.
- **A dependency owner takes the row with it.** Space Missions borrows this layer for TLE lookup with `showPoints:false`; while points are hidden the layer returns empty row controls, so the legend never describes an empty sky and the chip cannot accept a write that the owner's restore would silently revert.
- The detection-overlay record cache (`_detectionObjects`) is cleared with the catalog on every rebuild: it stamps id/class at creation only, and a rebuild can re-tag a satellite when a partial CelesTrak outage changes which group wins dedupe.
- **FIRMS**: no ground clamping (zero 3D-tiles height sampling), ≤18 screen-decluttered ambient labels, click-to-inspect detail card, 2.5k/3k sprite budgets viewport-clipped by FRP.
- **CCTV v2 foundation:** a pitched
  frustum wireframe (4 corner rays + far-cap rectangle) with a monitor plane at the frustum's
  far cap, retargeting the existing video/canvas texture pipeline. Manual calibration only —
  auto-calibration and the drape mesh pipeline are deleted. A one-shot activation obstruction
  probe (`pickFromRay` on camera activation, clamping the plane short of the first hit) remains;
  ground placement is superseded by the shared-floor v3 behavior below. Calibration persists to
  `godsEyeView.cctv.calibration.v2` (wiped clean, no v1 import); a panel-only CAL badge shows
  `CALIBRATED`/`CURATED`/`RAW PRIOR` (no in-world tint). Panel is titled "CCTV" (not "CCTV
  MESH"). Staggered geometry/frame loading is active-first and uses 4 records per 120 ms normally,
  or 2 per 250 ms while tracking/cockpit owns the view (re-evaluated each batch), with coalesced progress
  notifications (roughly 300 ms or ten batches; natural completion and disable each publish their
  terminal state through their own completion paths) and a LOADING FRAMES
  chip and the preview-first auto-expanding panel are unchanged. Coverage polylines are created
  lazily instead of inserting five entities for every catalog camera during initialization: default
  COVERAGE ON enable creates the active/visible 14-camera cohort, and activation always creates the
  selected frustum even with COVERAGE OFF. **Field validation passed
  2026-07-04** (core look + downtown no-clip confirmed); that round fixed three findings: the
  ground clamp now lifts the cap *center* only so the wireframe stays a true pyramid welded to
  the plane (was a flattened fan / the ~47.5 m divergence — RESOLVED), re-selecting the active
  camera is a no-op (killed a click-flash), and texture swaps gate on canvas content (killed a
  periodic white flash). Coverage is now **metro-wide: 250 cameras** (`CCTV_AUSTIN_MAX_SOURCES`
  default 36 → 250, hard bound 300), filtered to `camera_status === TURNED_ON` (~815 live of
  1,003 rows). City packs (2026-07-04): Caltrans (districts 4/7/11/3 — SF, LA, San Diego,
  Sacramento; cap 300) and TfL London JamCams (cap 250) join Austin (cap 250) as keyless default
  sources — ~800 cameras total, all RAW PRIOR poses, stills-first. The Métropole de Lyon
  "Caméras Web Criter" pack (2026-08-26; keyless `data.grandlyon.com` catalog, cap 60,
  `CCTV_LYON_ENABLED=0` disables) adds the ~15 published Lyon traffic cameras: frames from
  the Métropole's own host, kept only while their `last_update` stamp keeps moving (the
  catalog's only decommissioned-camera signal). The catalog names a destination rather than
  a bearing, so 14 of the 15 carry a **CURATED** heading hand-derived from OSM road geometry
  plus the published frames (`GRANDLYON_CURATED_HEADINGS`), not a RAW PRIOR hash; the
  monitor-plane cap lands a median 6 m from the watched carriageway against 30 m for the
  hash. The fifteenth publishes an "image unavailable" placeholder and keeps the hash.
- **Camera packs** (2026-09-30): every `*.json` in `config/cctv-packs/` (`CCTV_PACKS_DIR`)
  adds one publisher's cameras to the catalog on each 15-minute refresh, BESIDE the live
  packs; `CCTV_SOURCES_FILE`, the older file route, replaces them. `src/data/cctvPacks.js`
  validates each file: pack id `[a-z0-9-]{2,40}` prefixed onto camera ids, finite lat/lon, a
  public http(s) frame URL (no loopback, private, link-local or credentialed host — the server
  fetches it), a known `feedType`, at most `maxCameras` (default 200, ceiling 600). A bad camera
  is skipped with its reason in the server log; a bad file is skipped whole. Each pack's
  `credit` (publisher, licence, links) travels with its cameras through `/api/cctv/sources`
  and becomes one Data attribution entry, « Caméras publiques et images (City): Publisher
  (Licence) », in the reader's language. Upstream God's Eye View's bare-array
  `config/cctv_sources.<city>.json` files load unchanged, credited by their first camera's
  provider; checked with upstream's Warendorf file (1 camera beside the 815 live ones, its
  JPEG served through `/api/cctv/frame/`). `CCTV_PACKS_DISABLED=<ids>` and
  `CCTV_PACKS_ENABLED=0` turn packs off. No pack ships: the folder holds its README, and a
  French city needs a publisher whose licence allows showing its frames.
- **OSM mapped cameras — viewport-loaded** (2026-08-26): an OPT-IN
  (`CCTV_OSM_CAMERAS_ENABLED=1`, off by default) source of publicly mapped OpenStreetMap
  surveillance-camera POSITIONS (`man_made=surveillance`, `surveillance=public|outdoor|traffic`),
  merged into the live CCTV catalog for the viewport in front of the operator — worldwide, with no
  country list and no bundled snapshot. OSM maps where a camera is, never what it sees, so every
  row is registered with NO upstream URL and resolves through the existing frame chain — Street
  View still (`SRC STREETVIEW`, health `degraded`) or the synthetic `NO UPSTREAM CONFIGURED`
  placeholder. That billable fallback is why it is opt-in rather than a fourth default pack.
  Since 2026-09-22 the Street View still is taken at the position the server served for that
  camera (`osmMappedCameraById`), never at coordinates the request carries, and not at all where
  `GEV_NONCOMMERCIAL_SOURCES=off`.
  Pose uses mapped values where OSM has them and priors where it does not: bearing from
  `camera:direction` (high confidence; `direction` or a multi-value `camera:direction` → medium,
  otherwise an id-hash fallback at low), tilt from `camera:angle` (the wiki's tilt-from-horizon,
  clamped to the client's pitch range) falling back to a mount-height step, mount height from
  `height`/`camera:mount`, and cone width from `camera:fov` when present — which is almost never
  (~61 uses worldwide), so width normally comes from the `camera:type` prior. Everything unmapped
  stays a modeled prior, so cameras remain RAW PRIOR until calibrated.
  **Server** (`osmCamerasProxy`, `/api/osm-cameras?south&west&north&east`): one allow-listed tag
  query per box, refused above 2° or across the dateline, snapped OUTWARD onto a 0.02° grid
  (~2.2 km) so neighbouring viewports share one cache entry and a cached answer always covers more
  than was asked for, `out body` capped at 400 with an honest `saturated` flag, 5-min memory cache +
  in-flight coalescing + 7-day disk cache (`.gev-cache/osm-cameras/`) with serve-stale at any age,
  rate-limited, and a 20 s budget in which each Overpass mirror gets a fair share of the REMAINING
  time, floored at 8 s (both numbers are field-observed 2026-08-26: a whole-budget timeout let one
  stalled mirror consume the window before the healthy fallback was ever tried, and an even
  four-way split then cut the PRIMARY mirror off mid-answer while the two that were going to fail
  returned 502 in a second). A failed box throws with EVERY mirror's outcome named, so an outage is
  readable in one line instead of reporting only the last error. A disabled install answers 503
  `disabled` so the client stops asking for the session.
  **Client** (`cctv.js`): requests ride the existing camera-settle listener with a 500 ms debounce,
  never per frame; a move that stays inside the same snapped grid cell is not re-asked at all; new
  rows go through the same `prepareCameraForCatalog` → ground-prior batch → `createCameraRecord`
  path as the startup catalog (bounded at 1.5 s instead of init's 8 s, with `applyLateGroundPriors`
  correcting geometry afterwards); the cohort is capped at 120 and evicted through the shared
  `applyEvictionGrace` planner (3 settle passes / 60 s) so panning back a street re-uses records
  instead of rebuilding them. The active camera and any camera the operator has calibrated are
  never evicted. A failed box arms a 60 s cool-off before any new request: without it a down
  upstream turns every camera settle into another four-mirror attempt, which is how a client earns
  a rate ban and cannot help anyway. Viewshed hue identity for these comes from an id hash, not
  catalog position, so a churning cohort never repaints its neighbours. `getStats()` reports `osmMappedCount`,
  `osmMappedStatus`, and `osmMappedSaturated` separately from the feed-bearing catalog count.
  Mapping logic lives in `src/data/osmCameras.js` (pure, unit-tested).
  Scope reality check (Overpass count, 2026-08-26): OSM maps 76,162 `man_made=surveillance` nodes
  in France and 563,156 worldwide — none of which are downloaded up front.
- **Source-aware frame cadence** (2026-08-26): a pack may declare how often its PUBLISHER
  republishes (`upstreamCadenceMs`, measured server-side and served on `/api/cctv/sources`).
  `frameRefreshMsFor` takes the max of that and the product baseline, so a once-a-minute feed
  (Grand Lyon, measured 62 s between distinct frames) is polled at 60 s instead of 10 s while
  packs that declare nothing are untouched. Bounded at 5 min so a bad catalog value cannot
  freeze a feed.
- **Provider placeholder detection** (2026-08-26): the Métropole serves a fixed traffic-cone
  graphic as a valid 200 JPEG when a camera is down, while the row's `last_update` keeps
  advancing — no status field, freshness check, or HTTP code catches it. `isPlaceholderCctvFrame`
  fingerprints it by SHA-256 and the frame route treats it as a failed fetch, so it falls into
  the existing Street View / synthetic chain and the health line names the placeholder instead
  of reporting `SNAPSHOT · OK`. Fails open on any unrecognised body.
- **Incomplete-frame detection** (2026-08-26): `isTruncatedJpegFrame` rejects a JPEG whose
  end-of-image marker is missing from the tail of the body. Grand Lyon's `CWL5801` publishes
  one every cycle (12/12 fetches incomplete, byte count stable within each publication minute,
  so no retry can win it); a browser paints the decoded rows and leaves the rest transparent,
  rendering the camera as a strip of sky. Same fallback chain, reason on the health line. The
  tail window clears trailing metadata without mistaking an EXIF thumbnail's own marker for the
  frame's, and non-JPEG bodies are never judged.
- **CCTV full-resolution viewer** (2026-08-26): the panel preview is a `role="button"` control
  (pointer + Enter/Space); activating it MOVES `#cctv-frame` into `#cctv-lightbox-stage` and
  back on close. A DOM move never re-fetches — a second `<img>` on the same URL would, because
  `/api/cctv/frame` is `Cache-Control: no-store`. The backdrop is fully opaque so no
  unattributed Google Maps content sits beneath it, the dialog swallows the global single-key
  hotkeys while up (Tab excepted), and the bar prints the frame's `naturalWidth`x`naturalHeight`
  so an upscaled 320x240 camera never implies 1080p detail. `#cctv-lightbox` carries
  `data-panel-satellite="cctv-panel"`, which suppresses the panel's pointerleave/focusout
  auto-collapse while the viewer is open. Regression surface:
  `src/cctvLightboxMarkup.test.mjs`.
- **CCTV v3 UX — viewshed + calibration gizmo** (built 2026-07-05 and field
  validated 2026-07-21): the COVERAGE toggle is a
  tri-state cycle `OFF → ON → VIEWSHED`; viewshed mode renders each visible camera's frustum
  as a translucent **color-coded volume** (golden-angle hue per camera, `cctvViewshed.js`)
  welded to the same 5 points as the wireframe — zero new scene queries or update cadences.
  The 7 calibration sliders are **deleted**: ADJUST mode puts a direct-manipulation **gizmo**
  on the active camera (`cctvGizmo.js` — heading/pitch rings, E/N/U arrows, range handle at
  the cap center, FOV handles on the cap edges; all 7 offset DOF), plus a click-to-edit
  **effective-pose readout** (HDG/PITCH/FOV/RANGE/HGT/ΔN/ΔE, absolute values). Persistence is
  now **save-gated**: edits are live but unsaved (`CAL · EDITED` chip) until SAVE CAL writes
  the v2 store. Do not add
  Translation arrows use a depth-test-free pickable tip so E/N/U ownership remains unambiguous even where shafts overlap
  other handles. Avoid hover effects that mutate gizmo polyline geometry (width) — the primitive rebuild blanks the pick buffer and eats the
  following click (root-caused 2026-07-05). Gizmo input checks the topmost, depth-test-free
  handle with `scene.pick` first and uses `drillPick` only as an overlap fallback; this keeps
  hover and press responsive on software GL without changing the real-GPU interaction. Frame serving is bounded independently from the
  10-second active refresh: upstream and Street View attempts abort after 8 seconds, and the
  panel/monitor plane keep at most one same-camera image request in flight. This prevents a
  slow provider from being cancelled and restarted forever while stale `SNAPSHOT · OK` health
  remains beside a pending preview. Grounding is shared with every other height consumer:
  CCTV warms/resolves `groundFloor.js` cells, reads `cachedGroundFloor()`, and delegates optional
  Google 3D refinement to the unchanged `meshFloorSampler.js`. During E/N gizmo movement the
  prior floor is frozen (constant elevation and zero transient samples); release or reset makes
  one resolution request at the committed anchor. U edits remain pure geometry and enforce the
  2 m minimum mount height above whichever shared floor wins, including a rooftop. Public camera
  state exposes `groundPriorM` as the immutable Re:Earth ellipsoidal datum reference; it is kept
  separate from live frustum geometry because Google-3D can refine the rendered ground to the
  photogrammetric mesh.
- **CCTV monitor plane clears the ground** (2026-09-30, same rule as upstream 12790b36): the
  plane is lifted RIGIDLY — corners still weld to the wireframe rays — by the smallest amount
  that keeps each of nine support points over it (a 3×3 grid, `src/data/cctvFootprint.js`)
  2 m above the ground under that point. Until the ground under the plane is known, the ground
  at the mount stands in for every point, so the bottom edge clears the mount's ground; on
  activation, a committed calibration edit or a reset, `resolveFootprintGround` asks
  `/api/terrain/heights` (Re:Earth DEM, cached) for the nine points of the rendered pose (probe
  clamp included) and rewrites the geometry, dropping a late answer for a pose that moved on.
  What the measured ground adds over the mount rule is capped at 60 m
  (`PLANE_FOOTPRINT_LIFT_CAP_M`) so a tower under the far edge cannot launch the plane. The
  old rule lifted the plane's center alone: on 2026-09-30, 14 of the 15 Lyon planes had their
  bottom edge underground, a median 48% of the frame height (`scripts/qa-cctv-plane-lift.mjs`),
  which the photoreal tiles hide — at Pont de la Mulatière the probe-clamped 13 m plane showed
  an empty outline. After: 0 of 15. « Cadrer » (`cctvFocusFrame`) now frames the mount and the
  plane's four corners together, because the lifted plane left the old mount-centred view at the
  top of the screen. Upstream also ships precomputed Google-3D footprints and lowered its range
  floor from 220 m to 120 m; neither is taken here.
- **CCTV citywide ambient cards** (built 2026-07-29; shared-host migration
  2026-08-02): the LOD-selected nearby static cameras (20/28/40 by zoom,
  `cctvLod.js`) get **screen-space thumbnail cards** through the shared world-overlay host
  showing paced static frames — reselection on `camera.moveEnd` only, at most one frame fetch
  per second layer-wide, per-source cadences (Austin 5 min, TfL/Caltrans/Lyon 3 min). Zero-flicker:
  a card renders nothing until its first frame, a drawn frame persists through failed fetches,
  and eviction grace (2-pass/5 s) stops budget-edge churn. Camera icons stay visible at every
  zoom. Eligible candidates are filtered to in-view stills with valid IDs,
  finite distances, and one deterministic representative per camera before
  ranking; videos, hidden/malformed rows, and duplicate outliers cannot alter
  the density scale or displace a valid winner. They are ranked with a
  deterministic 50/50 blend of eye distance and normalized screen-center offset
  before the existing 5×4 distribution pass, so the center wins contested
  density without removing peripheral coverage or changing the bounded count.
  The active camera keeps the v3 monitor plane and is excluded from the
  40-card ambient ring with no thumbnail by default. An explicit
  `activeCameraCardEnabled` presentation option can publish the retained
  protected-card path. Disable tears the tier down completely.
  Coverage/viewshed semantics unchanged.
- **Satellites**: orbit rings rotate about Earth's Z by ΔGMST every ~1s (exact inertial→ECEF compensation; no SGP4 re-runs); the tracked satellite propagates per frame with one shared epoch for dot/label/camera. Verified: ISS holds <1km perpendicular to its ring while tracked.
- **Space Missions (30d)**: recent launches render as bounded shared-host, horizon-occluded mission markers using Launch Library 2 v2.3 detailed records. Enabling the layer selects the unified right-side Context panel's Space Missions mode and enables the required satellite layer. Before applying its temporary dense/hidden Satellite mode, Space Missions snapshots the complete standalone Satellite parameter set and exact enabled-layer set. Disabling Space Missions from either Context or the left Data Layers rail restores those parameters and the exact prior enabled state, so a Satellite layer that was already on stays on while a mode-owned dependency returns off; enabling Satellites by itself remains independent. Selecting a mission isolates its launch-to-orbit transfer and dashed satellite orbit, fills that same panel with navigation/details, and animates a small phase-colored marker along the exact displayed Cartesian samples. Marker hit testing drill-picks through photorealistic tiles so the depth-test-free tactical dot remains reliably selectable; its text is non-interactive shared-host presentation. The selected pad is the camera's zoom pivot: the overview remains centered on its launch site, wheel zoom approaches that site instead of drifting elsewhere, and camera pitch progressively changes from global nadir to an oblique close 3D view. Its protected shared-host callout remains visible and expands to include both mission and launch-site names. `FOCUS` flies directly to a 12 km oblique frame around the selected launch site and retains the same anchored zoom/orbit behavior. `REPLAY ASCENT` resets the selected marker at the pad, frames it from an oblique third-person angle, and follows it through the mission-specific compressed ascent directly into one orbital lap at the default `1×` rate. A live `0.25×`–`4×` slider changes ascent and orbit playback speed; adjusting it mid-replay preserves the current path position and historical mission timestamp. Re-entry/recovery cannot be inserted into replay. At orbit insertion the camera smoothly pulls back over the first fifth of the orbital replay and pitches to a globe-scale nadir view while continuing to target the moving replay point. Replay Cancel, mission navigation, deselection, layer disable, and data refresh all release camera ownership. Reconstructed paths are one continuous 128-sample geodetic curve: horizontal departure begins near zero while altitude rises quickly, then the climb progressively bends toward insertion without the former hard 120 km corner. Unmatched orbit fallbacks are smooth planar inclined rings rather than longitude/latitude ground-track curves. The panel lists disclosed payload names, types, operators/manufacturers, mass, multiplicity, and destination when supplied; an empty LL2 payload collection is shown as `CLASSIFIED / MULTI-PAYLOAD`. Launcher, spacecraft, and recoverable payload stages appear in a compact stage table with serial/flight/reuse details, recovery outcome/type, destination, and final coordinates when those records exist; an empty recovery collection omits the section. Stage recoveries with confirmed coordinates use those coordinates; return-to-launch-site records use the pad; downrange-only records receive an explicitly labeled estimated endpoint along the ascent azimuth. Available endpoints render as static 2 px dashed descent/recovery paths with a fixed final-position dot and an estimated atmospheric-interface segment when applicable. The ascent is geodetically densified above the ellipsoid toward the orbit's nearest insertion point, then rendered with `ArcType.NONE`, so it neither cuts through Earth nor separates from the marker. Because LL2 does not normally supply continuous ascent telemetry, pad-to-insertion paths without upstream trajectory samples are labeled `RECONSTRUCTED ESTIMATE` / `ASCENT ESTIMATE`; only supplied trajectory samples receive the replay wording. Selected-orbit framing fits the complete ring, rear-side linework uses normal scene depth occlusion, and current distance, speed, and callout data come only from a launch-year-validated satellite match. Speed is the magnitude of the SGP4 inertial velocity vector at the same propagation epoch as position, displayed in km/s with km/h available as hover detail. Unavailable operator, site, launch-time, orbit, current-altitude, and speed values omit their detail rows instead of reserving panel space with placeholders. Newly launched payloads absent from the core operational groups use CelesTrak's cached active TLE feed as a lookup-only fallback; weak constellation-name matches are rejected. The replay callout maps compressed animation progress onto Launch Library's mission-relative timeline, showing the historical UTC date/time at the marker's current path position; unavailable timelines remain explicit. Matched live satellite positions propagate at one-second cadence and use a distinct green dot/callout with the current UTC date/time.
  When no mission is selected, the Context panel presents a scrollable newest-first roster of every launch in the rolling window, including the smaller 5 px operator-colored marker, provider, and launch date. Hovering or keyboard-focusing a row shows four compact cyan corner brackets on both that roster row and its corresponding globe dot, rotates the globe at the current zoom to center it, and gives its label declutter priority without selecting it; the globe label remains unbracketed. Selecting a roster row invokes the same mission isolation and full-orbit framing as clicking its globe marker. The replay vehicle is one screen-space SVG/CSS HUD overlay rather than separate Cesium billboard, label, and reticle graphics. It is hidden during ordinary Focus and manual close views, where the standard selected launch-site label remains visible, and exists only while ascent replay is active. Its fixed pixel scale is shared by ascent and insertion, so camera range never resizes the rocket on screen before the phase boundary. Generic Launch Library pad names are reduced to their identifying suffix, and replay timestamps use a cyan state title over unprefixed white UTC date/time values. `REPLAY ASCENT` holds the unframed cyan/white rocket at the pad for a real-time `T−10` countdown, transitions through `LIFTOFF`, and attaches six tapered cyan/white ellipse waves directly below it from liftoff through insertion to convey thrust without adding scene geometry. While replay is active, the single start button is replaced by compact Play, Pause, and Cancel icon controls. Pause freezes countdown or mission time, vehicle/stage positions, camera target, labels, and thrust-wave animation; Play resumes from that exact frame, and Cancel releases replay camera ownership. The rocket and thrust group rotates from the path's live screen-space tangent, so its nose follows the visible ascent curve while the adjacent text remains upright. The camera begins as a close oblique launch chase, then smoothly widens between roughly 120 and 420 km vehicle altitude into a higher oblique context view that keeps the moving rocket targeted while exposing the ascent bend and orbit connection. At insertion the rocket/thrust glyph is replaced by the fixed-size cyan orbit dot, which the camera follows through the existing globe-scale orbit pullback. The chase camera limits per-frame yaw changes across heading wraps so it cannot abruptly cross in front of the vehicle and make ascent read in reverse; the replay-speed slider affects mission playback but not countdown duration.
  Mission world text has no native `LabelGraphics`: overview launch markers publish at most 48 ambient candidates for a 24-winner budget, while selecting a mission clears that overview source and publishes its launch-site callout, stage re-entry annotations, live/estimated payload-position readout, and orbit annotation as protected selected-lane entries. The source retains the exact former strings and colors. Static anchors reuse the Cartesian values used to build their mission geometry; the moving payload entry reads the layer's per-frame live-position cache; catalog-backed orbit annotation positions are cached in the same one-second matrix update that realigns the orbit primitive. Keyhole edge fade, horizon culling, final collision placement, and UI exclusion are owned by the shared host. Deselect restores the bounded overview, and refresh, disable, and destroy replace or clear both mission sources.
  A selected mission renders its orbit as four repeating tactical sectors, each containing one prominent cyan dot followed by one hundred thin translucent dashes. The bright dots act as orbit anchors while the subdued dash field remains depth-tested against the globe and is shown only for the selected mission.
  Close selected-pad views add one static 500 m-radius cyan launch-zone ring with a low-opacity translucent fill over the sampled photoreal launch-site surface. The single scene primitive is created only for the visible selected site and is otherwise dormant. It appears during Focus, sufficiently close manual zoom, and the replay countdown, but is suppressed above 120 km camera altitude, beyond 180 km direct camera-to-pad range, for unselected missions, and whenever Space Missions is inactive. Focus establishes a launch-site-centered camera transform once; subsequent manual heading and pitch changes remain centered on that site without an automated per-frame correction. Surface mission markers and labels use an additional conservative globe-limb margin before the exact ellipsoid occluder boundary, preventing near-horizon visibility from alternating between frames.
- **AIS vessels**: chevron symbology (naval cyan base, type tints), world-space headings, MMSI-keyed reconciliation (selection survives refreshes; pinned 3 refreshes with STALE marker when absent), detection-overlay integration (`type: 'SEA'`), contextStore registration for voice Q&A. Empty-space clicks, id-less photorealistic-tile picks, and Escape dismiss the vessel card/HUD/context and clear its trail; picks owned by another layer (including `gev-trail:*`) and raw vessel-record picks without a live MMSI key are no-ops for vessel selection. Click and key handlers detach while the layer is disabled and reinstall on enable. Selecting another vessel replaces the selection and trail, and reconciliation clears a trail if its owning vessel is evicted.
- **Track trails**: server accumulates per-MMSI ring buffers (`/api/ais-live/track?mmsi=`, Float32+Uint32, 64 samples, 30s/25m thinning); aircraft backfill proxies `/api/opensky-track` (OAuth, own credit bucket) and `/api/adsblol/trace` (tar1090 readsb, ~24h history, ODbL — credit adsb.lol).
- Shared `src/data/pickRegistry.js` stops the two flight layers' click handlers from fighting over the camera.

### Share-link v2 layer state (August 2026)

- Generated share links use a deterministic v2 hash. Existing camera, visual,
  HUD, detection, post-processing, celestial, scope, and map-stack fields remain,
  with compact fields for enabled layers, allowlisted layer options, panel state,
  and the active preset's allowlisted shader controls. An absent layer field uses
  deterministic defaults; an explicit empty field means no enabled layers.
- The registry seals only after all 16 production layers register, and every
  layer has an explicit serialization disposition. Unknown enabled-layer tokens
  reject the layer payload; unknown option tokens are ignored. Restoration
  settles independently per layer so one failed or unavailable source cannot
  block its siblings.
- Stable visible options are limited to aircraft 3D mode, selected civilian and
  military flight IDs, Satellite catalog and selection, CCTV coverage/projection/
  auto-hop, and Radio filter/volume. Playback and tuning, live-data health,
  calibration, caches, lifecycle state, temporary Context ownership, and derived
  effects are deliberately excluded. Radio restore never selects or plays a
  station.
- Normal loads restore the last successful explicit UI, voice, or tool choice
  from versioned local storage. Any valid camera share wins for the current load
  without overwriting recipient preferences. Restore ownership is split by
  visibility, option/selection, camera, visual, map, and individual panel lane:
  a newer explicit action supersedes only the field it owns. In particular,
  navigation cannot turn unrelated layers off, and an option change cannot
  cancel the same layer's visibility transition. Every explicit HUD, detection,
  post-processing, scope, or celestial action from the UI, keyboard, voice, or
  public tool facade claims the visual lane before mutation. Invalid requests do
  not claim that lane or partially change controls.
  Direct globe pointer and wheel gestures supersede the delayed shared camera
  and selected-subject Follow without aborting unrelated layer visibility or
  display-option restoration.
- The initial restore has one terminal promise spanning the camera flight,
  visual/map/panel callback work, every production layer result, and the
  destination-scoped selected-subject Follow result. Hash writes remain
  suppressed and the startup screen continues to read `Restoring shared view...`
  until that aggregate settles. Destroy settles it as destroyed rather than
  permitting late mutation. A superseded shared visibility intent follows
  the authoritative successor chain to a terminal lifecycle result, including a
  same-target re-enable or opposite-target disable, before releasing the layer
  barrier. Flights, Military, and Satellite first-update
  fetches consume the manager AbortSignal; disable and destroy also abort their
  module-owned feed or dense-catalog requests.
- Only one Flights, Military, or Satellite tracking ID can be durable at once.
  Explicit selection clears the other families, Stop Tracking clears active and
  pending IDs, and ambiguous incoming multi-family selections fail closed rather
  than letting feed arrival order choose the camera owner.
- An explicit aircraft selection made inside Contacts promotes the owning
  Flights or Military layer from a mode-owned dependency into durable state, so
  leaving Context, reloading, or opening the link can restore it. Passive
  Contacts autofocus does not revoke a pending selected aircraft; the exact
  shared/local target wins when its feed row arrives.
- A shared Flights, Military, or Satellite subject that has not arrived yet
  publishes a persistent top-center `ACQUIRING` progress state while the
  existing deferred-restore latch and source-specific deadline remain active.
  Success, expiry/failure, cancellation, superseding intent, owner-layer
  disable, explicit navigation, and teardown all settle and clear that state;
  caller abort remains authoritative after the pending handoff. A latch that
  rejects its deferred selection emits only the terminal failure and never a
  false acquisition state. An unrelated manager failure preempts `ACQUIRING`
  for its full visible dwell; if acquisition is still owned afterward, the
  progress state resumes. A share-specific terminal failure that arrives while
  another failure is visible is queued, and its own fixed dwell starts only
  when that message reaches the screen. Only terminal failures use the existing
  fixed-dwell error presentation.
- Radio category persistence shares the live directory's bounded normalizer,
  including generated genre identifiers with spaces or `&` such as `Hip Hop`
  and `R&B`.
- Shared panel state starts from deterministic defaults and excludes responsive
  auto-collapse. Partial or malformed panel fields cannot import or overwrite
  recipient-local layout preferences.
- A fresh Cockpit entry temporarily collapses the standard left/right map
  panels and opens Cockpit's own Contact and Live Signals rails. This runs only
  on entry: Previous/Next preserves any panel the operator opens while already
  inside. Exit restores the exact standard-panel open/collapsed snapshot from
  before entry; Cockpit-only disclosure changes do not replace that map layout.
  Opening Data Layers while inside Cockpit temporarily collapses the Contact
  panel to prevent overlap. Closing Data Layers restores Contact only when that
  accordion action collapsed it; an operator's own Contact collapse remains
  authoritative.
  Voice selection of the nearest aircraft near a named place follows
  the requested-layer enable → location arrival → destination refresh → nearest
  airborne lookup → aircraft selection path, excludes on-ground records, and
  never enters Contacts or Cockpit unless either mode is named explicitly. The
  destination refresh also runs when the requested layer was already enabled.
  The lookup inspects the full loaded fleet and tracks by stable ICAO identity.
  That complete route is one atomic voice action, so Realtime sibling calls
  cannot race the nearest-aircraft query ahead of layer enablement. A healthy fallback feed is
  queried normally and its source is returned with the selection; fallback with
  no airborne records remains an honest no-data result, not an enable failure.
- Voice treats the parent Context panel and Contacts as separate intents. An
  explicit request to open Context expands only `global-context-panel`; it does
  not choose a mode. An explicit request to open Contacts expands that parent
  first, activates the Contacts sub-view, and returns the settled 250 km window.
  Its `aircraft` count is the exact civilian-plus-military total when both feeds
  can answer, or `unknown` when either component is unavailable.
- Cockpit's top vision switch cycles five rendered looks: the inherited map
  style, CRT, NVG, FLIR, and Noir. There is no empty `NONE` entry.

### Live AIS Vessels (June 2026)

- Server-side `ws` websocket to `wss://stream.aisstream.io/v0/stream` maintained by Vite middleware; `AISSTREAM_API_KEY` never reaches the browser (AISStream has no browser CORS). The `ws` package is used rather than Node's built-in WebSocket specifically because only it can hard-abort a wedged socket (see the watchdog note in the delta block at the top).
- Browser polls same-origin `/api/ais-live` cache every 60s.
- The subscription defaults to **metropolitan France and its approaches** (`[[[41,-8],[51.6,10]]]`, `src/data/aisSubscription.js`), not the world box it used to open on: ~3 750 contacts instead of ~18 300, so the six-minutely identity messages stop losing the race against the position firehose. `AISSTREAM_BOUNDING_BOXES` overrides it; the silence watchdog self-arms for either measured preset, judged on the RESOLVED subscription rather than on whether the variable is set.
- Learned identities (MMSI → type, name, IMO, hull) persist in `.gev-cache/ais-static/registry.json` for **30 days** — loaded once at start, rewritten atomically at most once a minute and synchronously on shutdown (`src/data/aisStaticRegistry.js`). Before this the map re-learned the whole fleet at every restart, six minutes at a time. `destination` is voyage data and is deliberately never persisted. The registry is swept by the same 30-day TTL and a 50 000-entry cap; `pruneAisStreamCache()` used to leave it untouched, so it also leaked for the life of the process.
- The first enable in a session starts one 30-second client grace timer. Until
  an accepted vessel position arrives, `live`/`open`/`connecting` transport reports
  `LOADING`; the timer is not restarted by the 60-second poll. Expiry or a
  definitive transport/credential failure reports `UNAVAILABLE`. Accepted
  warm vessels survive later zero-position refreshes as stale/degraded data,
  while disable/re-enable owns a new timer and superseded responses remain
  inert.
- Client render cap `VITE_AIS_LIVE_MAX_ROWS` (default 12,000); type-colored ship icons (tanker/cargo/passenger/fishing/tug/pleasure-sailing, plus the off-ramp slate for an undeclared type); screen-space label clustering caps active labels at `VITE_AIS_LIVE_LABEL_MAX_ROWS` (default 900).
- Click-to-inspect wired into the voice context store.
- **The click's camera transfer is a standoff MEASURED from the coast** (`src/data/vesselStandoff.js`, consumed through `WORLD_FOCUS_FRAMING.vessel`): `2.68 × the distance to the nearest land`, floor **12 km**, ceiling **45 km**, pitch −38°, the distance read off the bundled IGN département outlines whose seaward edge IS the coastline inside the AIS box. The factor is the optics, not a taste call — at Cesium's 60° FOV in 16:9 and that pitch a coast at D is inside the frame from EVERY bearing at 2.68·D. The floor rules most French clicks (traffic hugs the coast) and is set where the frame holds a port basin AND the town that names it, while the camera still settles at 7.4 km — under `hullAltitudeM()`, so a vessel in port keeps its true-scale hull. Measured on real positions: Le Havre alongside 12 km, mid-Dover-strait 24 km, off Nice 42.4 km, Ouessant and Gascogne at the 45 km ceiling. Without the outlines loaded (they arrive in `requestIdleCallback` on enable) a click falls back to `defaultRangeM` = 20 km. It is NOT the departure port: AIS gives a position, not a track.

### Voice Control (June 2026)

`GEV MIC` button (bottom UI) starts an OpenAI Realtime session over WebRTC:

- **AI disclosure** (2026-09-22): the mic's ring always wears an « IA » / « AI » badge, upper left, on every layout; its `title` and the button's first `aria-describedby` say « Assistant d’intelligence artificielle — voix de synthèse ». The SAID transcript text is marked `data-ai-generated="true"`. See `src/aiDisclosure.js`.

- **Token flow**: browser fetches a short-lived client secret from `/api/realtime/token`; the Vite middleware holds `OPENAI_API_KEY` and posts the full session config (instructions, tool schemas, VAD, truncation) to `api.openai.com/v1/realtime/client_secrets`. SDP exchange goes directly to `api.openai.com/v1/realtime/calls` with the ephemeral token.
- **Session defaults** (env-tunable): model `gpt-realtime-2` (or `gpt-realtime-2.1-mini` when the MINI tier is selected — see the model-tier entry below), voice `marin`, reasoning effort `low`, semantic VAD with low eagerness, no response interruption, context window truncated to ~3,000 post-instruction tokens with 0.5 retention ratio — the conversational window stays short because map state is fetched live per turn.
- **Twenty-eight tools** (schemas defined server-side in `vite.config.js`, executed client-side in `src/voice/gevActions.js`): `fly_to_location`, `select_nearest_aircraft`, `adjust_camera_zoom`, `zoom_to_globe`, `set_layer_visibility`, `show_data_layers_menu`, `set_panel_open`, `set_visual_style`, `get_entity_context`, `get_current_view_state`, `set_hud`, `set_detection`, `set_map_stack`, `set_post_processing`, `control_scene`, `control_cctv`, `set_context_mode`, `control_cockpit`, `control_radio`, `track_entity`, `stop_tracking`, `frame_overhead`, `annotate_map`, `clear_annotations`, `move_camera`, `fly_route`, `analyst_query`, and `next_iss_pass`.
> **Reading `npm test` totals:** the count depends on the Node major. The two
> GC-bracketed allocation microbenchmarks (`src/data/focusAllocations.test.mjs`
> = 1 test, `src/overlays/worldOverlayAllocation.test.mjs` = 13) only RUN on the
> calibrated Node 24 runtime; on any other major the runner skips both files and
> their 14 tests are absent from the total. A branch total quoted without its
> Node version is therefore not reproducible. As of the fly_route cinematic
> branch: **2,281 on Node 25.6.1** (allocation suites skipped) = 2,255 on
> `main` + 26 route pins; the same tree on Node 24 reports 2,295.

- **Camera verbs** (`src/cameraVerbs.js`) — one motion slot, driven per clock tick. `move_camera` orbits/pans/tilts/rotates; `fly_route` is a cinematic dolly along an existing route annotation.
  - **The route dolly is shaped, not linear** (2026-08-20). A trapezoid speed profile (smoothstep up, cruise, smoothstep down, distance taken as the closed-form integral) eases both ends without changing the pace — duration is still `totalM / ROUTE_M_S[speed]`, with one exception: a 0.5 s minimum keeps a degenerate route from being an instant teleport, so routes under 10 m (slow) / 20 m (normal) / 45 m (fast) fly SLOWER than the speed word, never faster. Turns bank up to **10°** (a 90° street corner settles near 7.5°), measured as a triangular pulse over a 4 s window centred on the camera so the roll leads in and unwinds after. Altitude breathes ±20 m around the 260 m mean and lifts up to 26 m into turns. Pitch is LOCKED at −32°; heading comes from a gaze that leads the path by 6.5 s of travel. `prefers-reduced-motion` zeroes the roll and the altitude shaping and keeps the easing.
  - **Invariants — do not "fix" these.** (1) **Every** release levels the roll: completion unwinds it through the ease-out envelope, and `interruptCameraMotion` zeroes it synchronously (heading/pitch/position preserved). Cesium keeps the last up vector it was handed, so skipping this leaves the user holding a tilted horizon. (2) Heading is interpolated as an ANGLE about the local up, never as a Cartesian lerp — a lerp cannot cross an antipodal pair, so an out-and-back route looked backwards for the entire return leg; `signedTurnRad` branches the exact-180° case deterministically because the cross product's sign there is a floating-point coin toss. (3) A COLD floor cell is missing data, not flat ground: route vertices carry height 0, so trusting them flew a mountain corridor at 260 m above the ELLIPSOID. The corridor warm is fire-and-forget, so the dolly ARMS — camera untouched, no teleport onto the route — for up to 1.2 s waiting for real floor data, falls back to a rendered-mesh probe (`scene.sampleHeight`) when the DEM stays cold — latched to ONE firing per flight, for exactly the cells the cache could not answer, so a route costs at most 8 `sampleHeight` calls however long it arms — and otherwise holds the launch altitude for the whole route. A corridor is only RESOLVED when every cell is accounted for: one warm cell says nothing about the ground under the other seven, and treating it as an answer let the dolly descend to 460 m over a 1,600 m rendered surface. The probe reads the rendered surface at the current LOD (rooftops and primitives included) — a better estimate than nothing, not a guaranteed upper bound. Never descend blind. The floor is SMOOTHED in both directions for the ride while the hard clearance clamp reads the RAW sample, so a cell boundary cannot pop the eye but a cliff is still cleared on the frame it is seen. A pre-departure floor is adopted whole; one arriving mid-flight is eased onto, and the eye's descent rate is capped.
  - Pins: `src/routeCinematics.test.mjs` (26 tests), with `scripts/qa-flyroute-mutations.mjs` reverting each fix individually to prove they are load-bearing (19 named defects); rendered proof `scripts/qa-flyroute-cinema.mjs` (drives the real voice runner, measures the real Cesium camera every frame, writes a labelled contact sheet).
- **Public control facade** on StyleManager (`setHudVisible/setHudLayout/setDetection/setMapStack/setSharpen/setOrbit/setCleanView/getControlState` plus `runImmediateNavigation`): every setter syncs DOM sliders + share links + scene snapshots and returns `{ok, ...state}` — voice confirms only what actually happened. Validated `move_camera`, `fly_route`, `frame_overhead`, strongest-fire focus, and entity tracking use the shared navigation transaction, which refuses Cockpit before mutation, advances authority, releases follow owners, cancels stale work, and only then starts the requested action. All four entity layers expose `findByQuery/getNearby/getAllPositions/trackById|selectById/stopTracking/getTrackedInfo`.
- **Scene context** (`get_entity_context`): selected entity from the context store, or visible entities ranked by distance to the view target (≤100km altitude); plus basemap context — view-target picking, 7-point viewport sampling, view-scale classification (global/continental/regional/metro/city/local), reverse geocoding (center ≤750km, viewport samples ≤3,000km), Google Places Nearby via `/api/google/nearby-places` (≤25km), known-landmark matching against `CITY_POIS`, coarse country inference fallback. Context assembly is capped at 1.5s with cache fallbacks; caches are deduped in-flight.
  - **Every selectable layer writes that one slot** (2026-08-21). The tracking layers — flights, military, satellites — publish selection on their own awareness lane (`gev:awareness-subject-selected`, consumed by the readout card and the Contacts panel) and for the life of the voice tools never wrote the shared slot, so `scope:'selected'` silently answered `in_view` with a contact plainly selected on screen. They now call `selectTrackedSubjectContext` / `refreshTrackedSubjectContext` / `clearTrackedSubjectContext` (`src/data/contextStore.js`) on select / poll / deselect. **Invariants: (a)** that write path must NOT dispatch `gev:entity-selected` — tracking layers already own an event lane and a second one makes two surfaces fight over one subject; **(b)** exactly one record per tracking layer, because a frozen snapshot of a moved contact must never reach the visible-entity scan; **(c)** precedence is recency, not layer — one slot, last selection wins, so clicking an overlay entity supersedes a tracked plane as the voice subject while the plane stays tracked. Satellites refresh on the 1 s propagation beat, not per frame.
  - **Context-mode vocabulary is symmetric** (2026-08-21). `set_context_mode` accepts `contacts`; the internal id is `flights`. Every model-readable field (`mode`, `entering`, `priorMode`, nested `context`/`contextRollback`, and the transition diagnostic text) is reported in the accepted vocabulary, with the internal id preserved as `<field>Internal`; an absent secondary mode stays `null` rather than claiming to be `off`. Mapping lives in `src/contextModePolicy.js` so UI text and voice payloads cannot drift. Reporting the internal id made the model read `mode:'flights'` as "Contacts is off" and refuse to answer from the `contactsWindow` counts in the same payload.
  - **Analyst → track handoff carries a key, not just a label** (2026-08-21). `analyst_query` items include `icao24`/`mmsi` alongside the display `id`, and contact lookup uses the shared tiered ranking in `src/data/contactMatch.js`: hex exact → callsign exact → registration exact → callsign prefix → registration prefix → callsign substring → registration substring. The tiers keep an exact callsign ahead of a colliding registration regardless of feed order, and registrations compare separator-insensitively (`G-ABCD`/`GABCD`, `05-8152`/`058152`, `N123AB`/`N-123AB`).
  - **A typed command supersedes the turn it interrupts** (2026-08-21). `sendTextCommand` defers its `response.create` behind an active response instead of colliding with it, marks that response superseded so a late function call from it is refused rather than dispatched, and drops the old turn's queued follow-up. A refused call is still ANSWERED — a terminal `{ok:false, superseded:true}` `function_call_output` — because an unanswered `function_call` strands a pending call and deadlocks the model; the refusal creates no response of its own. A burst of typed commands coalesces into one response while keeping both conversation items.
  - **Subject reconciliation across satellite catalog rebuilds** (2026-08-21). A dense↔core toggle or TLE refresh clears and repopulates the catalog, so the published subject is re-resolved against the new satrec; a subject that did NOT survive releases the slot. The per-frame refresh cannot do this itself — `_getTrackedFramePosition` returns early once the satellite has no catalog entry — so the reconcile runs at rebuild completion. An empty catalog is a rebuild in flight, not a disappearance.
  - **One aircraft-proximity engine** (2026-08-22). `collectAircraftProximityWindow` (`src/data/militaryAwareness.js`) is the single computation behind both the Contacts panel window and the voice analyst's entity-centred "how many nearby", so the panel readout and the spoken count for one centre are identical by construction. **Invariant: do not re-derive a proximity count anywhere else.** They diverged before because the panel read live billboard positions (20,000 cap) while the analyst used last-fix coordinates over a 2,000-record slice — 111 on screen, 15 spoken. Explicit regions and arbitrary points deliberately keep the general record engine. Entity-centred results carry `window: {engine:'contacts-window', centeredOn, radiusKm, flights, military, aircraft}`.
  - **Centre precedence for nearby asks**: explicit place in the question > Contacts subject (a selected non-contact entity never silently becomes the centre) > an entity the user names > the current view, said aloud. Contacts active with no subject uses the view rather than reading an empty panel.
  - **Contact-match ties break on hex ascending.** `track_entity` is a mutation fulfilling "follow that one", and the model's observed answer to a non-ok track result is to retry with guesses rather than ask, so the lookup always commits rather than returning an ambiguity. What it owes the caller is stability: hex is unique and always present, so the same query resolves to the same contact for as long as both are loaded.
- **Visual grounding**: at `local` view scale with no structured identity, the client captures the Cesium canvas (≤1200px JPEG, black-frame detection, double-render for freshness) and sends it as `input_image` with a strict "do not invent labels" instruction.
- **Context window**: only the latest viewport screenshot stays in context — the client deletes the prior image item (`conversation.item.delete`) before adding a new one (images are the most expensive item, re-billed every turn). Text history is bounded by the **server-side** `truncation: { type: 'retention_ratio', retention_ratio, token_limits.post_instructions }` set in `/api/realtime/token` (cache-friendly batched truncation). There is intentionally **no** client-side per-turn conversation-item cap — deleting from the front of history each turn busts the Realtime prompt cache. A spatially-aware summarize-and-prune policy is specced for a future iteration.
- **Model tier + spend guard** (`src/voice/voiceCost.js`, August 2026): the voice heading row carries a `STD`/`MINI` toggle and a running session-cost readout (`~$0.42`).
  - **Tier selection.** `standard` = `gpt-realtime-2` (default), `mini` = `gpt-realtime-2.1-mini` (~3× cheaper per audio token). The client sends `?tier=` to `/api/realtime/token`; the endpoint resolves it through the shared registry, so an unknown, empty, or hostile value falls back to `standard` rather than reaching OpenAI as a model id. Responses echo `X-GEV-Voice-Tier` / `X-GEV-Voice-Model` (plus `X-GEV-Voice-Tier-Fallback: 1` when a bogus tier was downgraded). Persisted at `godsEyeView.voiceCost.tier`.
  - **Applies NEXT session.** The model is fixed when the ephemeral token is minted, so a live session always keeps the model it connected with; toggling mid-session only records the preference (the button title says so). The cost tracker's lifetime is the session's lifetime and its model binding is immutable from `start()` to `stop()` — rebuilding it on toggle would erase accrued spend and let repeated toggles bypass the cap. The tracker may only be replaced once the session is FULLY SETTLED (`isVoiceSessionSettled()`: not active **and** no data channel **and** no peer connection) — `!isActive()` alone is not enough, because the `error` status reports inactive while the transport can still deliver a late `response.done`. The toggle itself reads and writes only the persisted preference, never the live tracker.
  - **Env overrides.** `OPENAI_REALTIME_MODEL` / `OPENAI_REALTIME_MODEL_MINI` remain authoritative per tier, so a drifted upstream model id is a `.env` fix rather than a code change. Because an override can point a tier at any model, the client prices against the model id the server actually echoed, **not** the tier it requested. An unrecognised id is billed at the most expensive known rates plus one console warning — under-metering is what lets a cap be overrun.
  - **Metering.** Token usage from each `response.done` is folded into a per-session estimate. Cached tokens are subtracted from their modality totals; any aggregate-minus-details residual (and any payload with no detail at all) is attributed to audio rates, so uncertainty always resolves *upward*.
  - **Thresholds** (one object, persisted at `godsEyeView.voiceCost.limits`): soft warning at **$2** — amber readout plus exactly one console line; hard cap at **$5** — the session ends through the ordinary stop path (data channel and peer connection closed, mic tracks stopped) and the readout reads `Session ended — cost cap`. `0`/negative disables a threshold and round-trips through storage as an `'off'` sentinel (raw `Infinity` would JSON-serialize to `null` and silently restore the default); a corrupt entry falls back to the defaults rather than disarming the cap.
  - **Cap semantics — in-flight tools COMPLETE and are NOT rolled back.** A session-ending latch (`isSessionEnding()`) is checked at the tool-dispatch site, so no *new* tool is dispatched once the cap trips. `extractFunctionCalls` yields at most one call per event, so that single check covers the whole batch. A tool already executing may still finish its map mutation (a camera flight, a layer toggle, an annotation). This is deliberate: unwinding a partially applied map change has no safe general implementation, and a half-reverted camera/layer/annotation state is worse than a completed one.
  - **In-flight response at teardown → the accounting is INCOMPLETE.** Usage only arrives with `response.done`, which never comes for a response cut off by teardown (`stop()` closes the peer connection, and the server cancels rather than completes it). Rather than invent a token count for it, the tracker is marked `incomplete`: the chip shows a trailing `*` (`~$1.00*`) as a see-note mark and the tooltip carries the reason. Deliberately **not** presented as a lower bound — the estimate can also run high (residuals and unrecognised models bill at worst-case rates, and sub-cent totals round up), so it is partial rather than directional. (A bounded teardown drain was tried and removed: `pc.close()` closes the data channels a drain would listen on, so it was structurally dead.)
  - **⚠️ Model ids and rates are external facts** read from OpenAI's model + pricing pages on 2026-08-18 and marked VERIFY-AT-RELEASE in `voiceCost.js`.
- **Reliability**: tool-call dedupe (2.5s window across call/item/args keys); response-create queueing that respects active responses and defers follow-ups when the user starts speaking; per-tool follow-up instructions so the agent confirms only what actually happened (zoom confirms only on `ok=true`).
  - **Barge-in may cancel a SOUND; it may not tear down a DATA LOAD** (2026-09-14). `input_audio_buffer.speech_started` aborts every in-flight tool controller, and `set_layer_visibility` used to hand that signal straight to the data manager — which rechecks it at four lifecycle phases (init/params/enable/update) and answers an abort with `module.disable()`. A cold first enable takes SECONDS (measured over Bordeaux: 5.5 s for `irve-fr` in a live Realtime session, 3.0–4.5 s headless), so any word spoken inside that window killed the load: `irve-fr` and `medecins-fr` came back OFF and empty with `{ok:false, cancelled:true, phase:'init'}` while the model said the source had failed, and `traffic` came back ON and permanently at 0 records while the tool still reported `ok:true`. All three loaded normally by hand a moment later — because the hand toggle passes no signal at all, and because the dead voice attempt had already paid for `init()`. **That asymmetry — "it only works when I do it myself" — was this line, not any data source.** The manager already supersedes a competing request through its own epoch protocol (`activeVisibilityIntent.controller.abort(SUPERSEDED_VISIBILITY_INTENT)`), so the caller's signal never decided which state wins; it only decided whether the losing transaction left a half-built layer behind. `isCurrent` still gates what is SAID, so a superseded turn reports itself as superseded without breaking the map. **Radio keeps the signal** — its enable starts audio, and talking over a station is a request to stop it (`setRadioEnabled` forwards the same signal deliberately). Pinned by `gevActions.test.mjs` (`barge-in never tears down a data layer load, and radio still stops for it`), which asserts both halves.
- **Aircraft identity honesty:** “What is this aircraft?” reads callsign, operator, registration, type, and route only from the selected contact context. Missing operator, route, or type enrichment is named explicitly rather than silently omitted or inferred from the callsign.
- **Diagnostics**: every client/server event is posted to `/api/realtime/debug-log` and appended to `.gev-logs/realtime-conversations.jsonl` (gitignored) with secret/image redaction; last 30 errors persist in `localStorage` (`gev-realtime-errors`); `window.__gevVoiceCommands.getDiagnostics()` in the console.
- **Counting semantics ("near")** — a CONTRACT; new count-bearing tool work inherits it. Three honest numbers exist for one question: the Contacts cohort (250 km around the subject, what the panel shows), `analyst_query`'s count of *currently-loaded* records for the requested scope, and the layer-wide loaded total in `coverage.layersQueried[].records`. They diverge legitimately — the flights layer loads by viewport, so after a camera dive the loaded set can hold a fraction of the cohort (field case: panel 42, analyst 8). The contract:
  1. **Contacts ACTIVE** → "near / nearby / how many aircraft" means the **Contacts window** — the panel's numbers, spoken verbatim. Mechanism: `contactsWindow` (`{centeredOn, radiusKm, flights, military, vessels}`), carried by both `analyst_query` and `get_current_view_state`, derived by `contactsWindowFromSnapshot()` from the same snapshot the panel renders so the two cannot drift. A cohort whose feed cannot answer reports `'unknown'`, never a confident zero.
  2. **Contacts OFF** → "nearby" means **in view**; "near \<place\>" means a radius around that place. A radius query with Contacts active and no explicit centre is centred on the **active contact**, not the camera.
  3. **Every count names its scope in words** — "42 in your window", "8 in view", "about 30 within 250 km of Austin" — never a bare number. `analyst_query` returns `scopeLabel` so this is mechanical. Two different numbers with named scopes are not a contradiction.
  4. **The loaded-data caveat is stated once when relevant**: counts cover loaded data, and the flights layer loads where you look (appended to `coverage.note` for radius/view scopes over viewport-loaded layers).
- **Degradation**: without `OPENAI_API_KEY`, `/api/realtime/token` returns 503 and the mic button surfaces the error; the rest of the app is unaffected.

### AI HUD Summary (June 2026)

- HUD `SUMMARY` readout requests a five-word intelligence-style summary from `/api/openai/hud-summary` (model `OPENAI_HUD_SUMMARY_MODEL`, default `gpt-5-nano`, minimal reasoning).
- Input is the live basemap label context (place/street/nearby-place labels + enabled layers) — the model is instructed not to infer from coordinates.
- Output is sanitized to exactly five words; falls back to the deterministic telemetry summary on error/timeout (5s abort); typewriter animation on update.
- **Disclosure** (2026-09-22): while the line on screen is the model's, `#hud-summary` carries `data-ai-generated="true"` and an « IA » / « AI » badge sits beside the `SUMMARY` label (tooltip « Résumé rédigé par une intelligence artificielle (OpenAI) »); the deterministic line carries neither. See `src/aiDisclosure.js`.

### Map Stack Switcher (June 2026)

- `src/mapStackController.js` switches between Google Photorealistic 3D (`photoreal` — through its own Google key, or through Cesium ion when that key is refused or absent; see `src/photorealTileset.js`). **The app no longer OPENS on it.** ion bills that globe per reader, so a public opening on it would cost a root tile per visitor; the app opens on the keyless satellite stack (`ign-ortho`, IGN 20 cm over France and a world satellite base beyond — the same picture from orbit, and free) and `src/photorealAdoption.js` swaps in the real mesh on the reader's first rest under 25 km. The boot flight is excluded by construction: `flyToDefaultCity()` descends to 600 m by itself, so it ARMS the watch, and the arming swallows one rest because Cesium raises `flyTo`'s `complete` before the camera's own `moveEnd`. A deliberate pick from the tray retires the watch for the session. **The tileset is bought on the first activation of that stack, never at boot**: ion meters it by "root tile" and one root tile is one successful request, so loading it eagerly charged a `#map=osm` share link for a globe it then hid, and charged each of the 113 QA harnesses — which is how a 1 000-a-month tier ran out on 2026-09-15. One attempt per session, cached on the controller (`canLoadPhotoreal()` / `getPhotorealTileset()`), and a refusal leaves the reader on the basemap they already had rather than on an empty viewer; only a BOOT refusal walks down the ladder to Google's 2D cartography. `?photoreal=0` — and the window flag `newQaPage()` installs — close the door without spending anything, Bing Aerial / Aerial-with-Labels via Cesium ion world imagery (require `CESIUM_ION_TOKEN`), OSM, and the two keyless IGN France stacks. Bing Road is **retired**: it is gone from `MAP_STACKS`, from the `set_map_stack` enum, and from the voice aliases (road phrasings now resolve to OSM, the one shipped road basemap). An old `map=bing-road` link is simply an unknown id and takes `setStack()`'s `_fallbackStack()` — `photoreal` when it is available, otherwise the first source that is — with that tile lit and **no** `lastError`; pinned live in `scripts/qa-map-source-tray.mjs`. The fallback is deliberately availability-aware: resolving an unknown id to a source this build cannot show would raise a credential error about a stack nobody asked for.
- The bottom Visual Presets tray presents an **eight-tile MAP SOURCE row** (`#map-stack-chips`, `src/mapStackChips.js`): Google 3D, Plan Google, Relief Google, Bing Aerial, Bing Labels, OSM, Satellite, Plan IGN. (`Satellite` keeps the id `ign-ortho` — the label follows what the stack draws, the id is the `?map=` share token and must not move.) The duplicate left `#stack-panel` is retired. The row is a 3-column grid — two rows on desktop, keyed sources on the first and keyless ones on the second — and falls to 2 columns below 620 px. Tiles carry `aria-pressed` on the active source and remain keyboard-reachable with a visible focus outline.
- **IGN Géoplateforme stacks (keyless, France).** `ign-ortho` (`ORTHOIMAGERY.ORTHOPHOTOS`, BD ORTHO® 20 cm, JPEG) and `ign-plan` (`GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2`, PNG), z0-19, via `Cesium.WebMapTileServiceImageryProvider` against `https://data.geopf.fr/wmts`. Four request parameters are load-bearing and each was checked against a live GetCapabilities: `style: 'normal'` (Cesium throws synchronously without it), `tileMatrixSetID: 'PM'` (IGN's Web Mercator set, bit-for-bit Cesium's default `WebMercatorTilingScheme`), string `tileMatrixLabels` `'0'..'19'`, and a `rectangle` clamped to `IGN_FRANCE_RECTANGLE` (lon −5.5..9.8 / lat 41.2..51.2). Without the clamp the provider 404s its way around the planet — the layer's declared bbox is France UNION the DOM and covers most of the globe, so it is useless as a coverage mask.
- **Keyless world satellite under the ortho, and the sleep that keeps it free.** `ign-ortho`'s base layer is Esri World Imagery (`services.arcgisonline.com/.../World_Imagery/MapServer/tile/{z}/{y}/{x}`, `maximumLevel: 19`, CORS `*`, no key — or, with `ARCGIS_API_KEY`, the same service through ArcGIS Location Platform; since 2026-09-22 the anonymous endpoint is drawn only where the server allows it, see the note at the top), not OSM: a street map under a photograph reads as a rendering fault outside France. Esri caps at the SAME z19 as the IGN layer, so the base continues the sharp layer past its edge and never outruns it (measured over one Paris tile 2026-09-08: IGN 9.8 kB and Esri 12.2 kB at z19; IGN 404s at z20 while Esri answers 200 with a constant 2521-byte "no data" placeholder, hence the explicit cap). `ign-plan` keeps its OSM base — cartography under cartography. On six DISTINCT failed Esri tiles (`watchTileFailures`, counted per tile because Cesium re-raises `errorEvent` on every retry) the base swaps in place to EOX Sentinel-2 cloudless **2016** (10 m, z0-14, CC BY 4.0; 2017 until 2026-09-22, which covers Europe only and left every other continent white), leaving the IGN layer and its tile cache untouched; the vintage is load-bearing, as EOX publishes 2018-2025 under CC BY-**NC**-SA and this repo is MIT. **`_syncWorldBaseVisibility()` is the performance contract**: Cesium downloads a lower layer in full even when an opaque layer hides it completely, so over Paris the invisible base cost 46 tiles / 874 kB per view — more than the visible orthophoto. On camera rest (`moveEnd`, never per frame: flipping `show` re-requests tiles), if the UNION of the seventeen `IGN_OPAQUE_BOXES` covers the view rectangle the base goes `show = false` and the cost drops to zero. The union rule replaced a "wholly inside ONE box" rule on 2026-09-09, and the boxes were re-derived at the same time, because between them they were losing the case the cockpit spends most of its life in: at the default -30° tilt (`src/camera.js`, `src/orbit.js`) a view over Paris at 9 382 m spans 1.88-2.70 E / 48.93-49.34 N, crossed the northern edge of one box and the western edge of another, and so belonged to neither — while being 81/81 covered when probed tile by tile. Measured on that exact view: **69 requests / 1 362 kB of Esri fetched under an opaque orthophoto, against the 41 requests / 927 kB of IGN actually on screen — the invisible layer cost 1.5x the visible one.** After the change it fetches 0. Across a sweep of realistic view rectangles over the whole clamp, 30-37% more of them now sleep, and `isRectangleCoveredByBoxes` is exact rather than a heuristic (it cuts the view at every box edge and tests one point per cell), so two adjacent boxes cover a view neither contains while a genuine gap still keeps the base awake. `cutoutRectangle` was measured first and rejected — it reads 37 tiles / 813 kB, byte for byte identical to the plain stack, because it cuts the draw and not the fetch. Both harnesses are shipped: `npm run qa:world-imagery` (composition, credits, and one screenshot per border framing) and `npm run qa:world-imagery-cost` (the per-strategy tile and byte table; it stubs out `_syncWorldBaseVisibility` so the strategies do not race the product's own sleep). The boxes are a probed list rather than `IGN_FRANCE_RECTANGLE` because a layer's rectangle is not its coverage: the clamp contains Brussels, where the Géoplateforme answers `<ExceptionReport>No data found`, so sleeping on the clamp would punch white holes outside France. The boxes are now DERIVED rather than drawn, by `npm run qa:ign-opaque-boxes` (2026-09-09): a 15 554-point sweep on a 0.1° grid over the clamp (42% covered), eroded to points whose eight neighbours are covered too, grown into overlapping maximal rectangles from a lattice of seeds in both axis orders, then re-probed at half the sweep spacing and offset by a quarter step so the check lands on midpoints the sweep never saw. Seven of twenty-four candidates were dropped; the seventeen kept answered real orthophoto at all ~17 100 verification points. The probe reads `content-length` and cancels every body, so a full run costs kilobytes rather than the ~200 MB of imagery it inspects. **Two of the five hand-drawn boxes it replaced were not safe**: `0.5,44 -> 5,49` (the largest, and the only one wide enough to carry a 40 km view) and `4.2,43.7 -> 6,45` each contain a confirmed hole, so the app had been sleeping the base over views where the globe had nothing to draw. They passed their original check only because a 9x9 grid over a 4.5° box samples every 0.56°. Two traps are worth keeping written down, both found by re-running the derivation: thinning an over-large verification grid by halving walks the samples back ONTO the sweep grid, so the biggest boxes end up "verified" against the very data that proposed them; and the Géoplateforme intermittently 404s tiles it does serve, which had one box scoring 1024/1024 and then 1022/1024 on an identical lattice — requiring a refusal to be repeated took the yield from 8 boxes to 17 without relaxing the standard. `npm run qa:ign-opaque-boxes:check` re-verifies the shipped list against live IGN. Both IGN stacks use it, so `ign-plan` also stops fetching the 37 OSM tiles / 268 kB it used to waste per Paris view.
- **The orthophoto's no-data white is keyed out** (`src/ignNoData.js`, since 2026-09-23). `ORTHOIMAGERY.ORTHOPHOTOS` is JPEG only (`FORMAT=image/png` answers 400), so past the edge of the survey the Géoplateforme cannot say "nothing here" with transparency: it answers HTTP 200 with white. Measured on the Basque coast: from z13 down, a 1 651-byte tile whose 65 536 pixels are all exactly (255, 255, 255); on the tiles the edge crosses, a photograph with a white block cut into it (47-87 % pure white over the Socoa headland at z13); z11-12 answer the same sea with a real picture or a flat navy fill; further out, a 404 `No data found`. Because `globeDetailGovernor.js` coarsens the globe in motion and restores it at rest, a moving camera drew the z12 sea and a resting one fetched z13-14 and painted it white — a flash on every stop, in a staircase that follows the tile edges, on every coastline and border, and « Infrastructure numérique » imposes this stack. `createIgnWmtsProvider` now wraps `requestImage` for stacks declaring `wmts.whiteIsNoData` (the ortho only; white is a colour on Plan IGN): a tile inside the union of `IGN_OPAQUE_BOXES` is passed through unread, and any other tile holding at least `NO_DATA_MIN_PIXELS` = 256 pure-white pixels has every pixel at or above `NO_DATA_FLOOR` = 240 on all three channels made transparent — the floor sits under 255 because JPEG rings ~1 250 near-white pixels around the block on each edge tile measured — and so is every pixel at or above `NO_DATA_RING_FLOOR` = 160 within `NO_DATA_RING_PX` = 2 pixels of it, so the world base underneath shows through. The ring and one more rule were added after the first version was looked at in the browser: keyed at 240 alone, the block kept a pale dotted outline, from the fringe (one pixel out, a tenth of the ring still reads 233 on its darkest channel; the photograph away from the block tops out at 185-202, p99) and from filtering — Cesium interpolates an imagery texel's colour and alpha apart, so a transparent texel left WHITE lends its white to the one beside it. A keyed pixel therefore takes the mean colour of the pixels kept. Cost, measured in Chrome on the ThinkCentre (Intel GPU): 1.9 ms median per edge tile (read, key, rebuild the bitmap), 0.7 ms to read a tile outside the boxes that turns out to hold no white and is handed back unchanged; nothing inside them. Checked in the browser off Ciboure at 12.8 km with Dusk on: the white block is gone, and so is the pale outline the first version left. The land tiles measured over Ciboure hold no pure-white pixel and at most three at 250 and above, so a photograph without a hole is never altered. The result keeps the kind of its input (an `ImageBitmap` Cesium decoded already flipped stays a bitmap; an `<img>` becomes a canvas, flipped at upload like the image would have been), a throttled request stays `undefined`, and a tile the canvas cannot read is drawn as served.
- **An IGN stack is TWO imagery layers, OSM at index 0 and IGN at index 1.** `MapStackController` therefore owns `this._imageryLayers` (an ordered, bottom-first array) rather than a single `_imageryLayer`. The pairing is not cosmetic: Cesium marks the bottom layer as the BASE layer and, in `ImageryLayer._createTileImagerySkeletons`, collapses every tile outside a base layer's bounds onto its edge — France's coastline would paint the Atlantic and then the rest of Earth. DOM-TOM are deliberately out of scope for this pass (three distinct vertical systems).
- Coverage is partial and the tray says so BEFORE the click: an `ign-*` descriptor carries `coverageNote: 'metropolitan France only'`, which `mapStackChipModel()` puts in both the tooltip and the accessible name. It is **not** an unavailable state — the stack really is selectable, it just changes nothing over Texas.
- **`photoreal` unavailability now names its cause.** `MapStackController` takes `googleKeyConfigured`, so a build with NEITHER credential reports "Google Maps API key or Cesium ion token required for Google 3D" — two credentials open this stack, and an ion token alone is enough — while a build that tried and failed reports "Google 3D Tiles failed to load", naming the door (`Google key: … · Cesium ion: …`) when both were tried. Both arrive as `googleTileset: null`; `null` (caller did not say) keeps the old generic wording. `StyleManager.setMapStack()` quotes `unavailableReason` instead of the hard-coded ion string it used for every stack.

### Keyless build (August 2026)

- **`git clone && npm i && npm run dev` boots with no credential of any kind.** `src/main.js` no longer throws on a missing `GOOGLE_MAPS_API_KEY`; it sets `keylessMode`, skips `createGooglePhotorealistic3DTileset()` entirely (rather than calling it and catching, which spends a doomed round-trip and prints a misleading loader error), and leaves `viewer.scene.globe.show = true` so the first frames are the globe rather than a starfield. `initialStack` is `osm`.
- **The key is never published when absent.** `Cesium.GoogleMaps.defaultApiKey` and `window.__GOOGLE_MAPS_API_KEY__` are only assigned when a key exists, so every consumer sees a falsy value and takes its own degraded path instead of firing `key=undefined`. `annotationResolver.geocodePlace()` and `gevActions.reverseGeocode()` return null; `gevActions.fetchNearbyPlaces()` skips `/api/google/nearby-places` outright, because the dev server brokers it from the same variable and can only answer 503. `locations.searchAndFlyTo()` is the exception — it takes the keyless geocoder below rather than a degraded path.
- **Place search works with no key at all.** `locations.searchAndFlyTo()` no longer throws when there is no key: it asks `/api/geocode` (`keylessGeocodeProxy()` in `vite.config.js`, client in `src/data/keylessGeocode.js`), which answers the same three things Google Geocoding does — a location, a viewport, and Google-shaped `types` — from OpenStreetMap through Nominatim, with the IGN Géoplateforme (BAN addresses + the IGN POI index) as a France-only backstop for what OSM has not mapped. Everything below the lookup is shared, so a keyless search frames a city, a park, a street and a building exactly the way a keyed one does. `NO_GEOCODER_ERROR_FLAG` and its "Search needs a Google Maps API key" toast are gone with it.
- **`viewbox` alone does not bias Nominatim; `bounded=1` does.** Measured 2026-08-31: "sixth street" with an Austin viewbox still answers a village in Kampala at `limit=10`, while the same box as `bounded=1` answers East 6th Street. A biased search therefore runs the bounded pass FIRST — this path's stand-in for the Google Places near-view recovery a keyed search gets from `placesNearViewRecovery()`. The bias is only paid for when the view rectangle is under 6° per axis; a globe view names no neighbourhood.
- **The view wins, unless the world knows that name better.** The bounded hit is kept unless the worldwide pass returns something with Nominatim `importance ≥ 0.35`: "Toulouse" typed while looking at Austin means the city in France (0.73), not the bistro at The Domain (0.0001, a real bounded hit), while the Kampala "Sixth Street" (0.15) never outranks the street on screen. An in-view hit already above the threshold (Zilker Park, 0.41) short-circuits the second request entirely.
- **Both Nominatim callers share one queue.** The cockpit's reverse geocode and the search box's forward one take the `nominatim` pacer of `src/upstreamPacing.js` (one departure per 1.25 s, at most 5 s of waiting; a full queue sends the search straight to the IGN geocoder), carrying the User-Agent and Referer the usage policy asks for and a browser cannot set — the policy counts the application, not the endpoint. Hits are cached 6 h, misses 10 min, identical in-flight queries are coalesced, and a client gets 20 searches a minute.
- **A hairline box is a point, and a low BAN score is a different address.** Nominatim answers "Rocky Mountains" with a 0.0001° box around a single node; framing it would put the camera ~10 km over one arbitrary ridge, so a box under 0.002° on both axes is dropped and the result frames by navigation-mode range instead. BAN, for its part, always answers with its nearest street rather than nothing — an invented "Chemin de Bel Air" comes back as "Chemin de Bellevue" at 0.663, against 0.91-0.97 for exact hits — so the France backstop refuses anything under 0.7 rather than fly you to a street you did not ask for.
- **Still keyed, and still honest about it:** `annotationResolver.geocodePlace()` (annotation anchors), `gevActions.reverseGeocode()` and `fetchNearbyPlaces()` (voice + cockpit place context) remain Google-only and return null without a key. Only the search box is covered.
- Pinned live by `scripts/qa-keyless-boot.mjs` (`npm run qa:keyless-boot`) against a server started with no key: boot, loader clearing, no published key, OSM active, the three keyless sources selectable, an IGN switch that actually returns tiles over Paris, the on-globe IGN credit, a real search that resolves Toulouse and flies there through `/api/geocode`, and zero Google requests.
- `scripts/dev-fresh.sh` warns and continues instead of exiting, and passes the key with `put_env_if_set` so an empty value cannot shadow a configured `.env` entry.

### IGN terrain — DEV-ONLY SPIKE (`?ign_terrain=1`, August 2026)

- `src/data/ignBilTerrain.js` is a `TerrainProvider` over IGN RGE ALTI (`ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES`, BIL float32, TileMatrixSet `WGS84G` z6-14). **It is a decision instrument, never a default.** Enabled, it replaces the keyless terrain provider (and overrides Cesium World Terrain when an ion token is present, so the spike is what you actually look at).
- **With the flag on, ground-clamped objects are wrong, and that is expected.** `surfaceRegimeKey()` has two regimes, and `terrain-globe` MEANS "the Re:Earth point-height prior IS the ground". A different provider under a shown globe breaks that identity everywhere heights are cached from it — `groundFloor`, `meshFloorSampler`, `cctv`, `localGeojson.js` (which re-reads when the terrain provider changes, but not when its heights do) and `traffic.js` (which precomputes a road network from one sample). The third surface regime is the chantier, not the spike.
- **`getTileDataAvailable` is three-valued and all three values are used**, which cost two silent failures to establish. `true` inside France z6-14 → fetch. `false` above z14 inside France → Cesium upsamples the real z14 parent; serving a flat tile there instead replaced Mont Blanc with a plane the moment the camera came in (`globe.getHeight()` read −0.01 m over the summit). `undefined` outside France and below z6 → the flat `EllipsoidTerrainProvider` fallback; returning `false` there is fatal, because `prepareNewTile` marks the tile FAILED and never requests it, and the two level-0 roots are below z6 by definition — the entire globe rendered nothing, with no error.
- **NoData is a smear, not a sentinel.** A Nice z14 tile holds 4143 samples exactly equal to −99999, ~6500 more within half a metre of it, and a ramp of 505 further values (−1046, −3588, −17466, −50806) produced by lossy resampling blending real heights against the sentinel. `=== -99999` and `Number.isFinite()` both pass those as craters. The rule is a per-sample plausibility floor at −100 m, with the residual stated: 14 samples of 65536 survive in (−100, 0) m on the worst tile found, the lowest at −17.2 m.
- **The BIL grid is cell-centre registered; Cesium's heightmap is edge-inclusive.** `HeightmapTessellator` places sample *i* at `west + i·extent/(width−1)`, so feeding the raw grid straight in leaves a full-cell step at every tile boundary. `resampleToEdgeInclusive()` re-grids and linearly EXTRAPOLATES the half cell past each border (clamping reproduces the step). Measured on an Alpine pair: the seam falls from ~100 % of one sample step to 2.9 % at z14, 7.6 % at z13, 12.1 % at z12.
- Two transport facts the guards depend on: the service replies `content-encoding: deflate`, so `content-length` (200 616 B) is not the decoded size (262 144 B) and a header-based guard would reject every valid tile; and an out-of-coverage reply is a **137-byte** XML body, where `137 % 4 === 1` makes `new Float32Array()` throw. Validation is fail-closed on the decoded `byteLength`.
- `scripts/qa-ign-terrain.mjs` (`npm run qa:ign-terrain`) is the exit-criteria harness. It separates HARD criteria from TARGETS on purpose, so a residual is neither quietly threshold-widened nor allowed to sink the run. Current result: every hard criterion met; one target missed (z12 average seam 12.1 % against a 10 % aim). Measured alongside: decode 0.9 ms/tile main-thread, 16 900 B retained per tile, sea meshing at H = 0.00 m at Nice and Brest, Paris at 27.9 m, and Mont Blanc at 4778.8 m — **26.8 m below IGN's own 4805.6 m ice summit**, a ceiling of the published product (the eight neighbouring z14 tiles are all lower and z10-z13 converge on the same value), not of the sampling.
- The lit tile follows controller state, not the click: a rejected switch (no ion token) or a superseded one (rapid A→B) leaves the genuinely active source lit, and the tray heading keeps its short-label status readout (`...` while switching, amber on `lastError`).
- Ion stacks remain visible and keyboard-focusable when no ion token is configured, but expose `aria-disabled="true"` and do not switch. Their accessible label and tooltip quote `getStacks().unavailableReason` — the same string `setStack()` puts in the toast. OSM works keyless. The `ION` badge is gated on the stack's own `requiresIon`, so a `photoreal` chip unavailable because the Google tileset failed says so instead of falsely demanding an ion token.
- Stack choice participates in share links (`src/sharelink.js`) and falls back to OSM when Google 3D tiles fail to load. Share-link restore, the `set_map_stack` voice tool, and the chip row all land on the same `_setMapStack()` path.

### Voice Map Whiteboard / Annotations (June 2026)

- Runtime entry: `src/voice/lazyVoice.js` calls `initAnnotations({ viewer, tileset })`, exposes `window.__gevAnnotations`, and passes the engine into the voice action runner. **It is no longer part of the boot path** (2026-09-09): the engine, its two renderers and the resolver are 155 kB of the entry bundle and none of them draws the map, so they load with the voice stack — at browser idle, or immediately when somebody reaches for the mic. `window.__godsEyeView.annotations` and `.sceneDirector` are therefore `null` for the first moment of a session and `window.__godsEyeView.voiceReady` is the promise to await instead of polling; `npm run qa:lazy-voice` pins both halves.
- Engine contract: `src/annotations/annotationEngine.js` owns annotation state, TTL/fade lifecycle, concurrent anchor resolution, duplicate detection keyed on geometry, cancellation on clear/newer generations, and a hard cap of 120 live marks. Deferred outline upgrades drain FIFO at concurrency 2; queued work retains the owning abort controller and is discarded on a generation change before it can fetch.
- Resolver contract: `src/annotations/annotationResolver.js` converts names/coords/screen pixels into world anchors and optional geometry. The resolver is type-aware: Google Geocode/Places gives a centroid + scope, OSM/Overpass supplies admin/place/footprint/street/enclosing-area geometry, route requests use `/api/route`, and ambiguous/far results are rejected or recovered near the current view instead of drawing misleading blobs. Only explicitly country/state/county-scoped asks bypass near-view recovery and proximity gating; state scope requires a leading `state of …`/`the state of …` phrase, while bare names, proper names ending in “State,” and administrative geocode result types alone remain guarded. Overpass throttles remain distinct from normal transients: `Retry-After` is honored for one retry, and a repeated throttle ends only that mark's outline upgrade.
- Renderer contract: `src/annotations/hybridAnnotationRenderer.js` routes draped `area`/`route` geometry to world-space Cesium rendering and reticles/pins/arrows/callouts to the screen-space SVG renderer. Area labels are screen-space callouts so all captions share one visual language; progressive outline upgrades convert the existing screen group in place when the anchor snaps to the resolved centroid.
- Tooling: voice has `annotate_map` and `clear_annotations` tools. Annotations accumulate and persist by default; clearing is explicit only. Partial failures, approximate synthesized zones, and route fallbacks are returned as structured tool results so the voice layer can be honest.
- Console/dev API: `window.__gevAnnotations.tour()`, `.demo()`, `.annotate()`, `.clear()`, `.count()`, and `.list()` are the deterministic no-mic test surface.
- Current known resolver gap: mall/lifestyle districts such as "The Domain, Austin" can prefer a named building over the broader retail envelope. Product decision is that districts should become envelope + key buildings, but the scoring change still needs a careful multi-case validation pass.

### 3D Aircraft + Tracking (June 2026)

- **The TRACKED contact's 2D↔3D handoff is DEFAULT behaviour (2026-08-19), driven by camera distance alone.** It does NOT consult the DISPLAY-rail `3D` toggle, which continues to own the FLEET (the un-instanced draw-call budget stays the operator's decision). Policy lives in `src/data/trackedModelRegime.js` and is shared by both layers: enter below `TRACKED_MODEL_ENTER_ALT_M` = 150,000 m and hand back to the billboard only above `TRACKED_MODEL_EXIT_ALT_M` = 172,500 m. **The swap distance was set by playtesting on 2026-08-20:** a first pass at 1,000,000 m switched too early; 2D reads correctly at ~600 km and the handoff belongs at ~150 km. **Consequence, recorded on purpose:** the tracked contact now enters 3D NEARER than the FLEET does (`MODEL_ALT_CEIL_M` = 800,000 m, unchanged), so with the DISPLAY-rail `3D` toggle on, 150–800 km draws surrounding contacts as models while the selected one is still a glyph. Nothing double-draws (the fleet pass skips the tracked icao) and aligning the two is a fleet-side decision, deliberately out of scope. **The two thresholds are asymmetric on purpose:** a single threshold makes a tracked orbit sitting ON the boundary strobe billboard↔model as the camera's altitude wobbles across it. Do not collapse them. The latch is scoped per selection, so a new target re-evaluates against the ENTER ceiling rather than inheriting the previous target's exit band. Exactly ONE model is involved; it loads on demand when the regime opens, is HIDDEN (not released) on regime exit so re-entry has no load gap, and is released by the existing teardown on deselect/re-track/destroy. Cockpit and TR-3B suppression are unchanged. **Two invariants around it:** (a) the hysteresis latch AND the load-failure latch are per-selection state cleared by `_resetTrackedSelectionState()` in the tracking lifecycle (deselect / re-track / cross-layer / init / destroy) — the predicate's icao-change guard is defence only, since it needs a drawn frame while nothing is selected and the render governor's idle mode does not promise one; (b) on-demand loading is bounded at 3 attempts per selection with a 1.5 s backoff and one console warning naming the asset — the driver runs every `scene.preUpdate`, so an unbounded catch means a missing GLB spins load→reject at frame rate. The billboard stays the visual throughout a failed load.
- **Grounded 3D handoff is terrain-validity gated (2026-08-23).** A ready civilian or military glTF does not own the visual until `groundSnap` (`src/data/groundSnap.js`) can answer with a MEASURED photoreal-surface height. On success the layer writes `height + the model's measured belly offset` before revealing the model. Cache movement is measured on the WGS84 surface, not across altitude, so a stationary contact keeps its snap through poll-time vertical-datum changes. Model existence or GPU readiness alone never suppresses the billboard floor, and ordinary zoom/style/deselect transitions preserve a valid snap cache. **Two states, and the difference is the whole design.** COLD — nothing has ever resolved for this icao (tiles still streaming on first sight, sample failure, backoff after a first miss): there is no evidence of where the ground is, `heightFor` returns null, the model stays hidden and the depth-test-free 2D billboard remains opaque and floored. WARM — a snap resolved and then a >`MOVE_INVALIDATE_M` (50 m) taxi move stopped it answering directly: the measurement is DEMOTED to a bounded last-known rather than deleted, and it keeps answering while the resample is outstanding, so a taxiing aircraft does not pop 3D→2D→3D across a 2–30 s retry backoff. The bound is `HELD_SNAP_MAX_DRIFT_M` = 250 m from the spot the value was measured at, past which the hold is dropped rather than stretched and the contact is COLD again. It is spatial with no timer beside it (ground under a contact that has not moved does not change; what invalidates the value is the contact MOVING) and deliberately a quarter of the billboard chain's `HELD_FLOOR_MAX_DRIFT_KM` — that hold only ever RAISES a sprite, while a held snap IS the model's placement, so its error shows in both directions. A fresh sample releases the hold, and so does a ground flip (which already calls `forget`). **A loading model is HIDDEN, never zero-scaled:** admission sets `show = false` (Cesium's default is `true`, and an unplaced primitive would claim the visual at the identity matrix), and ownership is `ready && show` — Cesium 1.138's `Model.update` has no `show` guard, so hiding a primitive costs its load nothing.
- Commercial and military aircraft use the same high-level FLEET model regime: 2D billboards when zoomed out, optional glTF models when closer, controlled by the DISPLAY rail `3D` toggle and `Proximity` / `All` modes. Since 2026-08-16 (Hangar fleet) models are PER-CLASS: real CC-BY GLBs for light/bizjet/turboprop/widebody/helicopter/uav (`CLASS_MODEL_REAL` in `src/data/aircraftClass.js` — meters-baked, scale 1, per-model belly/radius; provenance in `public/models/README.md`), the shared `airplane.glb` for the remaining civilian classes, and the military layer maps weight classes (real GLBs / 747 heavies / `jet.glb` fastjets, per-model heading offsets, always flat amber). Textured civilians carry a HEAVY tint, not a light one: `MODEL_COLOR_BLEND_AMOUNT` is `0.94` in BOTH layers under Cesium's `ColorBlendMode.MIX`, so the class colour supplies 94% of the surface and the asset's own texture ~6%. The visual direction is clean light silhouettes with only a weak diffuse contribution from the approved textures, so liveries deliberately do NOT read. IR boost raises the blend to a full `1.0`. Under NVG/FLIR (map preset or Cockpit vision) models render unlit flat-white at full alpha and scene fog is disabled (fog otherwise blacks out distant models with the globe hidden); state restores on exit.
- The DISPLAY-rail `3D` toggle is the user-facing activation path for both aircraft layers. Their small approved GLBs build their render resources without Cesium's frame-spread job queue, preventing continuous Photorealistic 3D Tiles streaming from starving model readiness; model caps, tracking, camera, and fallback billboards are unchanged.
- **The `3D` toggle DEFAULTS ON in `proximity` on a first run.** Proximity is itself the budget — models appear only below `MODEL_ALT_CEIL_M` and only for the nearest `MODEL_MAX` in view — so the default costs nothing at globe scale, and `all` remains a deliberate opt-in. A fresh boot runs NO layer-state restoration (`LayerStateCoordinator.start()` returns early with neither a share payload nor stored state), so four independent initializers decide what a first-run operator sees and must agree: `booleanOption('models3d', 'e', true)` in `src/data/layerState.js`, `_models3dEnabled = true` in BOTH flight layers, `this._models3dEnabled = true` in `src/ui.js`, and the `active` / `visible` classes on `#models3d-toggle` / `#models3d-mode-row` in `index.html`. All four are pinned together in `src/data/layerState.test.mjs`. Explicit state still wins: because the codec omits default-valued options, `models3d: false` is now what travels in a link (`lo=…f.e.0`) and restores OFF at both aircraft layers. **Consequence for returning users:** a stored `gev:layer-state:v2` blob is a FULL options snapshot, so a session that wrote one before this change carries `models3d:false` and keeps 3D off until the operator flips it (or clears the key) — the durable snapshot is treated as the recipient's own state, by design.
- **Consequence of the flip on the recorded tracked/fleet inversion:** the 150–800 km band where surrounding contacts draw as models while the SELECTED one is still a glyph is now what an operator sees WITHOUT arming anything. The inversion itself is unchanged and still deliberate (see `src/data/trackedModelRegime.js`); only its reachability changed.
- Civilian and military 2D aircraft use the established distance scale: `3×` near
  the camera and a `0.5×` floor from 8,000 km outward. A standard 20 px ambient
  icon therefore remains about 10 px at globe altitude while retaining the
  established close-range silhouette. Any compact alternative requires
  before/after visual evidence.
- Fleet model eligibility is distance-based with on-screen priority and hard caps (`MODEL_MAX`, `MODEL_MAX_ALL`) to avoid draw-call explosions. Each model owns its own `modelMatrix`; shared scratch matrices are forbidden because they caused stacking/flicker.
- Tracked aircraft use standalone model primitives driven from the already-settled dead-reckoned display position, while the tracked Cesium entity remains billboard-backed so `viewer.trackedEntity` always has a ready bounding sphere.
- Flights and military layers mirror the same tracking invariants: no warm-up freeze/jump, altitude-scaled framing, trail head glued to the displayed plane, no pull-out when switching targets, and no cross-layer orphan when switching between commercial and military tracks.
- Regression surface: `npm run test:track` drives the real app headless with synthetic aircraft feeds and asserts the tracking invariants without depending on live OpenSky/adsb data. `src/data/trackedModelRegime.test.mjs` pins the tracked contact's threshold math, the enter/exit asymmetry, and the default-on / cockpit / TR-3B / deselect wiring in both layers.

### TR-3B conversion Easter egg (August 2026)

- With a contact tracked, CONTEXT ▸ CONTACTS shows a small 🛸 chip beside COCKPIT (`#tr3b-toggle`, gated by `CockpitView.syncTr3bToggle()` on a tracked contact — not on the cockpit entry policy). Pressing it converts that contact into a TR-3B and pressing it again restores the real aircraft. State lives in `src/data/tr3bRegistry.js`: a session-scoped module-level `Set` keyed by ICAO 24-bit address, shared across both flight layers the same way `militaryRegistry.js` is, so a conversion holds through a civil↔military handoff. It is deliberately NOT persisted (no localStorage, no share-link param, no schema change) and layer teardown deliberately leaves it intact — only a page reload clears conversions.
- The sprite is two hidden kinds (`tr3b`, `tr3bHot`) in `src/data/aircraftIcons.js`, authored in the same 96×96 nose-up pipeline as the eight class silhouettes, so the triangle points along the display course through the existing screen-projected rotation path with `alignedAxis` still `ZERO`. They are unreachable from `classifyAircraft()`. Variant selection rides the existing `irBoost` layer param, so under NVG/FLIR/surveillance the hull stays cold and the four emitters render hot; a style switch re-images only converted contacts, never the rest of the fleet.
- Both layers resolve every `aircraftIcon()` call through a local `_iconKind()` shim (identity for unconverted contacts), so no refresh path — poll reconciler, two-tier raster swap, presentation pass, tracked entity — can revert a conversion.
- The class label follows the conversion across every surface that reports one: tracked card, cockpit/`getTrackedInfo`, Contacts, and the analyst record's `aircraftClass` (`tr3b`, the style-independent id, so a query answers the same in FLIR as in Normal). Callsign, flight level, speed, and route stay live-feed truth.
- A converted contact is billboard-only. It is excluded from model eligibility at SELECTION time, so it never consumes a `MODEL_MAX` cap slot, with the handoff guard and the tracked-model regime guard kept as defence. The billboard stays shown, so the contact keeps satisfying the `getNearby` / `getDetectableObjects` visibility guards and still works in Contacts and Cockpit.
- Regression surface: `src/data/tr3bRegistry.test.mjs`.

### Split-flap status chips (August 2026)

- The three status chips flip their LABELS over character by character when the text changes, like a departure board: `#global-loading-label` ("LOADING LIVE DATA" → "LOAD COMPLETE"), `#traffic-sync-label`, and `#cctv-sync-label` ("loading frames" → "camera grid ready"). All three route through `setSplitFlapText()` in `src/splitFlap.js`; there is no other writer of those three elements. The progress counters (`#*-sync-progress`, `#global-loading-detail`) are deliberately left as plain `textContent` — they tick several times a second, and flapping them reads as a slot machine.
- `#global-loading-label` doubles as the universal top-center status banner, so anything routed through `_showGlobalStatusNotice()` flaps as well — in particular the share-link restore notices, of which "Shared military flight could not be restored — feed unavailable" is the longest at 63 characters. That needs no special case: `planSplitFlap()` compresses the stagger to hold the 620 ms budget (26 ms → 6.9 ms per column at that length), every column is reserved for the whole cascade, and `element.textContent` is the complete notice at every instant, so the `aria-live` region announces the whole sentence rather than a fragment. A notice deferred minutes past boot is equally safe: `ensureHost()` re-validates the shell on every call, and the long-lived `Text` node is never replaced.
- **DOM text is the truth, and its node NEVER moves — do not "fix" this.** The first call upgrades a chip label into a permanent shell (`ensureHost`): a `.gev-flap-text` span holding one long-lived `Text` node, plus an `aria-hidden` `.gev-flap-cells` sibling. After that the ONLY text operation for the life of the chip is `node.data = next`. Nothing is reparented, so the label is never transiently empty and the `aria-live` region never sees a removal/reinsertion pair it could announce twice. `element.textContent` is the settled string at every instant, because the cells carry no text at all: both glyphs are CSS generated content (`::before` from `data-flap-prev` = outgoing, `::after` from `data-flap-next` = incoming), which never reaches `textContent`. This keeps QA pins honest and lets `_updateTrafficSyncChip`'s own `textContent !==` guard keep working. The shell is built on a tick where the text is NOT changing, so no real label change ever carries a structural mutation.
- **No animation loop, and exactly ONE `setTimeout` per change.** CSS `animation`/`transition` only, triggered once per text change and staggered through a per-cell `--gev-flap-delay`. The single timer is the settle that strips the cells; the width ease ends on a `transitionend`/`transitioncancel` listener, never a second timer. Idle cost is zero, there is no periodic work, and nothing requests a Cesium render or takes a render-governor hold. `setSplitFlapText` is a no-op on unchanged text, which is required — the chips are repainted by a 60 ms and a 500 ms ticker.
- **Only what was visible flaps away.** An interrupted cascade (A→B cut short by C) derives each column's outgoing glyph from `visibleGlyphs()` — what that column is actually SHOWING at that instant, which for a column whose stagger has not elapsed is still A, not the pending B. `FLAP_TURN_RATIO` must track the `gev-flap-out`/`gev-flap-in` keyframe crossover in style.css.
- **Columns never renumber mid-cascade — do not "optimise" this away.** For the whole cascade the board keeps one column per index of the LONGER string, each holding its own width; a column the new string does not reach flaps to a BLANK in place (`data-flap-next=" "`) rather than collapsing. Collapsing stacks the absolutely-positioned outgoing glyphs on one x AND lets a later glyph slide into an earlier column, which makes `visibleGlyphs()` lie and the interrupt rule flap the wrong glyph away. Pinned by "a cleared column holds its place instead of letting later glyphs slide left".
- Length changes are eased, never snapped, and the ease is placed so it never fights the flaps (`.gev-flap-sizing`): a GROWING label reserves its columns as the cells go in and eases at the START; a SHRINKING one holds full width for the whole cascade and eases at SETTLEMENT.
- Accessibility: the cells sit in an `aria-hidden` wrapper and the settled string is real text in the a11y tree, so the `aria-live` chips announce the label once per change rather than character fragments. No `aria-label` is used — ARIA prohibits naming a generic `<span>`. Because the text node is permanent and only its data changes, a label update is a single `characterData` mutation and settlement is none — node churn in a live region can double-announce.
- A chip hidden by clean-UI, recording mode, or an un-`.visible` (`opacity: 0`) traffic/CCTV chip swaps instantly instead of animating where nobody can see it; `prefers-reduced-motion: reduce` does the same.
- Kill switch: `SPLIT_FLAP_ENABLED` in `src/splitFlap.js`. Set it `false` and every chip returns to a plain instant swap with no other change.
- Regression surface: `src/splitFlap.test.mjs`.

### Panoptic Detection + Tracked Readout (June 2026)

- `src/data/detection.js` samples enabled layers through each layer's `getDetectableObjects()` contract and renders bounding boxes/labels from the shared host's sole Cesium post-render callback so boxes align with the final camera frame.
- Detection diagnostics count fading labels from the arbiter rows that are
  actually rendered. The label QA harness uses time-weighted label exposure for
  churn and requires conclusive solve/frame samples at both its 12,000-object
  pathological field and 5,200-object normal field without relaxing budgets.
- `src/data/detectionDraw.js` performs the batched, DPI-crisp canvas drawing for tier-colored labels, corner brackets, callouts, and distance-scaled tracked boxes. Unit tests cover label measurement and draw geometry.
- `src/data/trackedReadout.js` publishes a protected shared-host callout above tracked aircraft and satellites or selected mapped installations. It reads only each layer's cached display position—never a fresh entity position evaluation—preventing readout jitter against the rendered target. AIS selection remains in the vessel source's protected card path.

### Not Currently in Runtime

- Weather radar (removed before OSS v1 after QA; no reliable visible payoff)
- General replay/timeline systems outside the Space Missions experience
- LiDAR explorer and paired-point CCTV calibration experiments

## Auth + Launch

- Recommended launcher: `./scripts/dev-fresh.sh` (also: `dev-secure.sh` for stricter bindings, `dev-cctv.sh` for CCTV source-pack tuning)
- Build gate: `npm run build`
- Network access: local-only by default (`HOST=localhost` in dev-fresh.sh); LAN is an explicit opt-in via `HOST=0.0.0.0` (launcher prints a key-exposure warning + LAN URL; see SECURITY.md)
- OpenSky default mode: OAuth (`OPENSKY_AUTH_MODE=oauth`; `anon` works without credentials)
- Google key expected in Keychain service `google-maps-api` (or `GOOGLE_MAPS_API_KEY`, or `.env`)
- OpenSky credentials expected in Keychain service `opensky-network` (or env, or `.env`); `OPENSKY_AUTH_MODE` and `OPENSKY_CREDENTIALS_FILE` read from `.env` too
- Optional-key precedence in `dev-fresh.sh` is uniform — explicit shell env, then `.env`, then Keychain: `OPENAI_API_KEY` (Keychain `openai-api`/`api-key` — voice + HUD summary), `AISSTREAM_API_KEY` (`aisstream-api`/`api-key` — live vessels), `CESIUM_ION_TOKEN` (`cesium-ion`/`token` — Bing stacks), `TOMTOM_API_KEY` (`tomtom-api`/`api-key` — live traffic flow), `FIRMS_MAP_KEY` (`firms-map`/`map-key` — live fires), `LL2_API_TOKEN` (`.env` only)
- An empty string is not "unset" on either side of the launcher, and both sides are handled. `scripts/read-dotenv-value.mjs` hides the requested key from `process.env` for the duration of the read (Vite's `loadEnv` otherwise lets an inherited empty export win over the parsed files) and restores it after. A key the launcher resolves to nothing is then removed from the dev server's environment outright (`env -u`), not merely omitted — the child inherits this shell's environment, and Vite backfills `.env` only over undefined variables, so an empty export in either place would shadow a configured key. `CCTV_CALTRANS_DISTRICTS` is the deliberate exception: empty is its documented Caltrans kill switch and is passed through as-is
- `.env` supported via `.env.example` template

### Proxy/Security Baseline

- CCTV proxy rejects client-specified upstream URLs (server-side source allowlist only).
- CCTV upstream still-image fetches use an explicit abort controller with an
  eight-second timeout; the timer is cleared on every success or failure path.
- OpenSky response cache stores successful upstream responses only; OAuth token refresh calls are coalesced.
- A cold OpenSky failure uses the current camera subpoint only to request a cached adsb.lol point fallback capped at 250 nm. A fresh OpenSky response or last-good cache wins; a nominally successful worldwide snapshot more than two minutes old prefers viewport-scoped adsb.lol when available, otherwise the stale source is reported honestly. The fallback is visibly source-labeled and is never presented as a worldwide snapshot.
- Where `GEV_NONCOMMERCIAL_SOURCES=off`, `/api/opensky` never reaches the OpenSky branch (no snapshot, no OAuth token): an anchor inside 41.3–51.1 N, 5.2 W–9.6 E (or no anchor) is answered with the four French adsb.lol circles merged (`X-Flight-Coverage-Area: fr-metro`, `X-Flight-Coverage-Cells: n/4`), anywhere else with one circle (`X-Flight-Coverage-Nm: 250`); both carry `X-Flight-Source: adsb.lol` and `X-Flight-Ttl-Seconds` (the queue's round, which the page judges age against); nothing to serve after a 25 s wait is a 503 `{error: "adsb.lol unavailable"}`.
- **adsb.lol pacing (`src/adsbLolFeed.js`).** Every api.adsb.lol request — French circles, regional circles, `/v2/mil` — leaves through one queue, ≥ 20 s apart: waiters first, then never-fetched jobs, then the oldest answer; a job not wanted for 75 s stops refreshing; a 429 or 420 pauses the queue 60 s. An answer older than max(150 s, 1.5 rounds) means the queue went idle: the request waits (≤ 25 s) for a fresh one — France reopens on the circle nearest the view and fills in — and falls back to answers up to 10 min old only if adsb.lol does not answer. A regional circle is shared by any anchor within 100 NM of its centre. `/api/adsblol/mil` serves the queue's newest copy (`X-ADS-B-Cache`, `X-ADS-B-Age-Seconds`) and waits at most 25 s when it has none.
- `/api/flight-info/route/:callsign[?lat&lon&alt&vr]` and `/api/flight-info/type/:hex[?t=]` answer from the VRS standing data (`src/vrsStandingData.js`): one tarball a day from codeload.github.com under `.gev-cache/vrs-standing-data/`, indexed in memory (~0.4 s, ~30 MB), refreshed in the background after 24 h, a failed download retried after an hour and never replacing a working copy; 503 while no copy exists (the page then forgets that key). The adsbdb proxy and its `.gev-cache/adsbdb.json` are gone (the file is deleted on first load).
- GBFS response size is capped; CCTV health map is bounded.
- Proxy error payloads are sanitized (no internal error details returned to clients).
- `OPENAI_API_KEY` is server-side only; the browser receives ephemeral Realtime client secrets from `/api/realtime/token`.
- `AISSTREAM_API_KEY` is server-side only; the browser reads the same-origin `/api/ais-live` cache.
- `/api/google/nearby-places` keeps the Google key out of Places requests issued for voice scene context.
- `/api/google/text-search` keeps the Google key server-side for view-biased Places recovery used by annotation resolution.
- `/api/overpass` is bounded by body/response caps, per-client/global rate limits, concurrency limits, mirror fallback, in-flight dedupe, cache bounds, and static validation that every selector is spatially bounded.
- `/api/military-installations` uses an independent limiter with the same 90-per-client/300-global one-minute bounds, so viewport installation refreshes never consume `/api/overpass` annotation/traffic capacity.
- `/api/route` proxies bounded OSRM route requests for annotation routes, with profile allowlisting, distance caps, response caps, caching, and sanitized "no route found" errors.
- **Upstream pacing (`src/upstreamPacing.js`).** Every visitor of a hosted instance reaches the public APIs from the server's one address, so a ceiling published "per IP" is a ceiling for the whole audience. One pacer per upstream, shared by every route that reaches it, spaces departures evenly at 80 % of the published ceiling: Géorisques v1 `resultats_rapport_risque` (1/s → one per 1.25 s) and the rest of `api/v1/**` (5/s → 4/s); Géoplateforme isochrone (5/s → 4/s), WFS (30/s → 24/s), and the geocoder plus `api-adresse.data.gouv.fr` as ONE bucket (50/s → 40/s — the old host is served by the Géoplateforme); INSEE Melodi (20/s per its CGU → 16/s); Nominatim and `routing.openstreetmap.de` (1/s → one per 1.25 s). Each entry cites its source URL. A call waits at most 5 s for its slot and one visitor (`clientKey`) may hold at most half of a queue; past either bound the call is refused, never queued further. What the visitor gets: an address route (`installAddressRoute`) with nothing left answers **503 + `Retry-After`**, code `upstream-paced` (worded in both languages in `serverMessages.i18n.js`); one missing only a paced part is served `no-store` and not cached, server or browser; `/api/geocode` falls through from Nominatim to the IGN geocoder (503 + `Retry-After` only if both are refused); `/api/route` answers 503 + `Retry-After` and the annotation keeps its straight segments; the regional brief comes back partial and uncached; the INSEE grid and national view serve their stale copy or 503 + `Retry-After`. An upstream 429 despite the pacing pauses that pacer for its `Retry-After` (5 s default, 60 s cap). The visitor is carried to the calls by `AsyncLocalStorage` (`runForVisitor` / `asVisitor`); a background call is paced but not capped per visitor. Refusals log one line per upstream per minute (`[upstream-pacing]`). Not paced by this: WMS-V, Overpass (its own slots and relay), OpenSky, AISStream, Bison Futé Action b (its own ≤ 1 file/s).
- Track endpoints: `/api/ais-live/track?mmsi=` (server-accumulated ring buffers; sub-route handled before the rows snapshot), `/api/opensky-track?icao24=` (OAuth, 60s cache, sanitized errors, independent OpenSky credit bucket; 404 `{status: "off"}` without any fetch where OpenSky is off), `/api/adsblol/trace?hex=` (60s cache, 5MB cap, ODbL attribution required in UI).
- Realtime debug logs redact API keys, bearer tokens, client secrets, and image data URLs before writing to disk; request bodies are size-capped.

## UI/UX Runtime Defaults

- Z ladder: panels promote within 100–139 (renormalized on wrap), voice pill 150, toast 200, clean-view exit 300.
- Panel POSITION keys are versioned `v8` (`godsEyeView.v8.panelPos.<id>`); collapsed-state keys remain `v6`. The one-time position reset clears stale DISPLAY placements that could overlap the Context rail.
- Map Source lives in the bottom Visual Presets tray. The left accordion contains no MAP STACK panel, and the `k` panel token that addressed it is gone from the share registry, so legacy `ui=k...` state takes the ordinary unknown-token skip.
- A dock popover (Visual Presets, Location) auto-dismisses on mouse-away unless pinned. Focus inside the tray defers that dismissal only when the browser reports `:focus-visible` — keyboard focus and typed-into fields hold the tray open; a mouse-clicked tile does not, because Chromium focuses a `<button>` on press.
- GEV MIC control is a glass capsule (var(--glass-bg), blur(24px) saturate(1.4), 999px radius; panel radius in error state).
- The desktop right rail (`#right-context-rail`) owns `LEGEND`, `DISPLAY`, `CCTV`, its active parameter controls, and `GLOBAL CONTEXT` as one fixed responsive stack in that order. Its compact buttons use the same 176 px width as the left accordion and one consistent 50 px height, share the left stack's 52 px edge inset and measured top baseline across HUD variants, then constrain themselves against visible HUD/chrome rectangles and the remaining vertical corridor. `DISPLAY` is no longer draggable and legacy saved coordinates are ignored.
- The right rail is labeled **DISPLAY** (formerly "MOVE") and groups, in order, HUD, DETECT, Sharpen, 3D, Clean-UI (HUD + DETECT promoted to the top). Its expanded controls retain the same compact 176 px width as the right-side tabs instead of growing to the wider Context detail-card width. It starts COLLAPSED on first run and respects the user's later `v6` collapse choice. Collapses/expands with directional chevrons (`◀` collapsed, `▶` expanded).
- **The map key (`LEGEND`) leads the rail** since 2026-09-03. It used to be a fixed card in the bottom-left corner, and `body:has(#data-panel:not(.collapsed)) .map-legend { display: none }` switched it OFF whenever DATA LAYERS opened, because that panel (z 100) would have covered it (z 92) anyway. With dozens of layers in DATA LAYERS the reader lost the key at the moment they needed it, so the key moved to the one column DATA LAYERS never reaches and the rule went with the conflict that justified it. It is a full rail member — `data-panel-id="map-legend"`, share token `e`, its own collapse chevron, `v6`-persisted, open by default — and FIRST in the allocation order, which is the one slot `panelStackAutoCollapseIndices` never auto-collapses. `#map-legend-items` is the scrolling surface under the allocated height, and `.map-legend` carries `max-height: var(--right-stack-max-height, 70vh)` as a FLOOR — the allocation is written by an rAF-scheduled pass, and a `requestRenderMode` scene that has gone idle can leave that frame pending (measured: a three-layer key 1 400 px tall in a 900 px viewport with the pass unfired). A legend with nothing to key sets `hidden` and is filtered out of the rail pass entirely, so it cannot hold the leading slot while measuring zero. An open key does NOT count toward `hasExpandedPanel`: it ships open and opens because a layer is on, so counting it would let Tactical exclusivity take the DISPLAY, CCTV and CONTEXT launchers off screen for anyone who merely enabled a layer. Cockpit hides the rail by `visibility` rather than `display` for one reason: the key opts back out from under it and returns to the bottom-left corner, because the rail's own column is where Cockpit puts its DISPLAY and RADIO launchers. Since 2026-09-09 it is the ONLY mount point: the same entries also printed inline under each layer row in `#data-panel`, so every enabled layer published its swatches twice and the left copy pushed the next layer's row down the panel (the seven live-vessel families cost seven lines above `Bouées marines`). `manager.js _syncRowControls()` now renders CHIPS only — they are controls — and one `_refreshTogglePanel()` pass feeds this mount alone.
- **Since 2026-09-10 a legend block states its own EXTENT, and the block with something on screen leads its row.** Over Biarritz the key measured 434 px of content in a 308 px window — `velo-pulse-fr` opened it with six classes over 561 sites, all of them in Paris or Lyon, and pushed the 84 objects actually in view below the fold. A layer may publish `legendScope: {inView, where}` from `getRowControls()`; `_legendRows()` sinks a member declaring `inView: 0` below one that does not, stably, and silence is never a demotion. Two further optional keys share the same hook: `legendBar: true` folds ORDERED classes into one segmented track (`legendBarWidths()`, strictly proportional except for a 3.5 % floor on a non-empty class — the darkest pulse step measures 1.83:1 against the cockpit glass, and two neighbouring steps only ΔE 14.6 in normal vision, which is also why segments carry a 2 px surface gap and a hairline); and `entries[].channel` names the channel an entry answers and lays that channel's entries side by side, so a layer painting SHAPE and COLOUR over one population cannot be read as two populations. A blurb on a side-by-side entry moves to its tooltip — there is no column to hang a sentence under. Measured after: Biarritz 233 px, Paris (six operators, three shapes, six bands) 292 px, neither clipped.
- **Bloom is gone** (2026-09-03, owner decision D1). The global `scene.postProcessStages.bloom` pass, its DISPLAY button and slider, `src/bloom.js`, the `setBloom` facade, the `bloom` half of the `set_post_processing` voice tool and the `bloom`/`bi`/`bv` share tokens are all removed. It shipped `enabled: false, intensity: 0`, so NO rendering changed. The `bloom` uniforms of the NVG and FLIR shaders are a different thing — preset parameters, not the pass — and stay, share token `b` included. Links written before the removal still open: an unknown hash token is simply never read.
- Display and Context use matching 330 px expanded widths and matching compact tab dimensions. The parameter panel is part of Display's expanded content. DISPLAY may remain open beside one contextual panel; CCTV and Context are mutually exclusive. In Tactical HUD, expanding CCTV or Context hides the other contextual launcher while DISPLAY remains independently available. The most recently opened right-rail panel owns the constrained lane even when it appears later in DOM order; passive restoration and automatic disclosure do not replace that explicit owner. Minimal and other HUD layouts retain the collapsed launchers; when their active panel exceeds the measured corridor, the rail reserves sibling heights and gaps and scrolls the active panel internally.
- `STYLE PRESETS` and `LOCATIONS` start collapsed, expand on intentional hover/click, and auto-collapse after hover leave delay.
- Collapsed mini-status indicators show active style and active location/landmark.
- Detection mode is user-controlled and should persist when switching styles. Since 2026-08-22 it also STARTS on for every style on a first run, Normal included — as a `GLOBAL_POST_DEFAULTS` baseline that does NOT set `_detectionUserOverridden`. Since 2026-09-10 it starts at Balanced @ 50% (`FIRST_RUN_DETECTION_PRESET`), not at the tactical Dense @ 75%. Exception (unchanged): selecting a military style (CRT/NVG/FLIR) auto-enables the Dense preset, but only until the user manually changes detection this session (`_detectionUserOverridden` gate), after which style switches never touch it.
- Detection runs in the bottom lane of the shared host's single world-overlay `postRender`
  listener (not `preRender`) to eliminate bounding-box drift at close zoom.
- **Detection takes NO continuous-render hold (2026-08-22, `src/data/detectionRenderDemand.js`).**
  It repaints on CHANGE and asks the governor for exactly one more frame while work that spans
  frames is still outstanding. This is load-bearing for the detection-on-by-default flip: the old
  unconditional `holdContinuousRender('detection')` would have pinned every idle first-run tab at
  60 fps, defeating the render governor. Measured on a parked scene with zero layers: **0 renders
  per 5 s with detection ON, identical to OFF**; reinstating the hold gives 301. Gated by
  `scripts/qa-perf.mjs` §1b, which also counts the PAINTER's own frames so a painter that had been
  disabled outright could not score a perfect idle. The invariants — each of which a live
  adversarial review found broken in the first cut:
  - **Every kind of outstanding work must terminate.** A predicate that can stay true forever is
    the hold under another name. Three qualify: the enable fade-in, label fades, and a solve the
    frame could not run.
  - **Label fades count in BOTH directions.** A newly selected label is `selected`; counting only
    the fade-out tail left it invisible on a parked scene until an unrelated frame arrived.
  - **Paint and demand share ONE monotonic timestamp** — the host frame's `frame.timestamp`
    (`performance.now()`, sampled once per frame). Re-sampling dropped the terminal frame of a fade
    (paint at 219 ms drew alpha 0.99545; a policy re-reading at 220 ms said "done"), and a wall
    clock that jumps backwards keeps demand alive until it catches up. Nothing in the draw pass may
    use `Date.now()`.
  - **A skipped paint DEFERS, never cancels.** The relief valve's skip and its follow-up request
    come from one decision (`detectionPaintSkipDecision`), so it cannot drop the only frame that
    was requested.
  - **A changed detectable set dirties the solve.** Detection PULLS candidates per paint but
    re-solves on a private 125 ms throttle, so a layer tick that swapped contact A for B could be
    spent on a paint that declined to re-solve. `markDetectionSourcesChanged()` is called from the
    manager's layer tick and visibility change, next to the render request each already makes —
    discrete events seconds apart, never per frame — and it deliberately does not request a frame
    itself, because the caller already did.
  - **AIR brackets stay prompt because the AIRCRAFT LAYERS hold the loop, not detection**
    (verified live 2026-08-23). Brackets — including the alpha-floored ones — are painted inside
    `_drawOverlay` from live positions and take no part in the sources-changed notification, so the
    obvious worry is a floored bracket sitting stale on a parked scene. It cannot: an AIR bracket
    exists only while an aircraft layer is enabled, and `flights.enable()` /
    `militaryFlights.enable()` each take a continuous-render hold for their own per-frame fleet
    animation. For exactly as long as there is anything to bracket, the scene renders every frame.
    Measured on a parked camera: `holds: ["flights"]`, `requestRenderMode: false`, and an
    outside-aircraft population change moved the painted bracket count with no camera input. This
    is a COUPLING, so `detectionRenderDemand.test.mjs` pins it — a later perf pass that strips those
    holds the way it stripped detection's would take bracket promptness with it, silently.
  - Known, pre-existing, and deliberately out of scope here: the overlay's backing store does not
    re-derive on a DPR change mid-session (`worldOverlay` sizing — untouched by this work).
- The detection MODE BANNER (`DENSE VIS:… SRC:… DENS:…% ELASTIC …ms`) is
  developer telemetry and is HIDDEN by default. It paints only under
  `?detectDebug=1` (the `trafficDebug` convention), resolved once per
  `initDetection`. The same numbers are always available from
  `getDetectionDiagnostics()`. On a zero-object frame the "armed, nothing in
  view" signal is carried by the scanlines and sparse focus ring, not the banner.
- The HUD summary's `NEAR <landmark>` callout is capped at 150 km (metro scale).
  Beyond that it falls through to the `SECTOR <lat> <lon>` readout. The POI
  catalogue covers eight cities, so a looser bound made the HUD announce
  landmarks on other continents.
- Panoptic mode shows labels on ALL items (no stride skipping). Tracked/selected items keep bounding box but suppress label (skipLabel flag). Tracked items get enlarged bounding boxes (56×44 vs default 22×14).
- The 3D aircraft toggle reveals `Proximity` and `All` modes and drives both commercial and military aircraft layers. It ships ON in `Proximity`, so the button paints lit and the mode row paints open from markup; the panel is therefore ~36 px taller than before, which Cockpit's Display/Radio strip absorbs through its existing primary-only corridor solver.
- The host-painted tracked-target readout sits above the post-FX layer and follows tracked aircraft/satellites or selected mapped installations using each layer's display-position contract.
- Cockpit entry is gated to the operational Contacts context bundle. The
  Context chooser must be in Contacts mode, Live Flights and Military Flights must both
  be enabled, and a civilian or military aircraft must be tracked. The visible
  Cockpit actions and the `C` shortcut use the same gate, so ordinary standalone
  flight-layer selection cannot enter a context-dependent cockpit.
- **Aircraft cockpit view:** selecting a commercial or military aircraft reveals a `COCKPIT` action (`C`). Cockpit mode temporarily releases Cesium's orbit-follow transform and drives a first-person camera from the tracked aircraft's existing smoothed display position and course. Its concave helmet-visor HUD shows callsign, UTC time, coordinates, curved roll/pitch guides, and a seven-division heading tape. Ambient commercial and military AIR contacts use a Cockpit near/far band selected by the shared Display 3D mode: Proximity admits at 150 km and retains to 185 km; All admits at 400 km and retains to 450 km. The shared 3D toggle now applies in Cockpit: Off keeps in-range contacts as rotating 2D aircraft silhouettes, while On lets a ready admitted glTF take over without a drawing gap. The Cockpit model cap remains 60 and can only lower the map budget; in-range contacts that are capped or still loading remain 2D silhouettes instead of degrading to out-of-range dots. Contacts outside the selected band use small rotation-free cyan-white pips for civilian aircraft and amber pips for military. The pilot's own airframe is not drawn in first person, and exiting clears the Cockpit band and restores normal map silhouettes/models. The normal left accordion remains available for Layers and Scenes and keeps the same 26vh HUD-aligned anchor used in map mode, independent of whether the bottom-left Contact card is expanded or collapsed; the right-rail CCTV and Context chooser are hidden to avoid duplicating or overlapping the cockpit presentation. When the intelligence HUD is enabled, its classification, scene summary, collection/orbit metadata, coordinates, and imaging-status text remain visible as reduced peripheral cockpit telemetry; the optical center and flight instruments stay clear, and turning the HUD off still hides it. Ground speed, exact heading, and rendered altitude form one compact lower-center instrument cluster, keeping the horizon and peripheral view open. A second live altitude tape hugs the inside-right visor rim: its rail and nine moving ticks are derived from the same responsive keyhole radius, remain 20 px inside the circular edge even on wide displays, fade deeply at both vertical ends, and move continuously behind a fixed current-altitude pointer; its interval tightens automatically near the surface and it is suppressed on narrow screens. Cockpit mode also has a weather-backed transparent volumetric-cloud pass derived from the supplied FBM/domain-warped R&D shader. It renders at no more than 520×320, uses 24 ray steps/three FBM octaves at 12 FPS, is clipped to the visor, fails clear when Open-Meteo is unavailable, and stops its animation completely on cockpit exit. It does not restore the prior CPU weather canvases, precipitation, scene fog, or any map-mode effect. When Contacts is active for the tracked aircraft, the compact `CONTACT` rail adds the 250 km subject window, four cohort counts, nearest observed/mapped example with relative bearing and distance, freshness, explicit uncertainty, and Previous and Next controls plus its own collapse control. The mirrored right rail is a three-page **cockpit briefing carousel**: source-backed live signals, location-matched regional headlines, and local place/current-weather context from OpenStreetMap Nominatim and Open-Meteo. It is manual-first: Previous, Next, and direct page controls are always available, and the visible `CYCLE OFF` / `CYCLE ON` control starts or stops the nine-second page cycle. The cycle pauses on hover or keyboard focus and stops while collapsed, hidden, or outside cockpit mode; live signal data continues refreshing either way. Empty news matches and unavailable news use compact text states rather than reserving an empty media frame; partial local data remains explicit. Article links open their original publisher, and no headline is treated as verified risk intelligence. On desktop both cockpit rails use the same width and share a bottom-aligned safe baseline in opposite corners above the peripheral MGRS/GSD/time telemetry, leaving both that text and the lower-center instrument cluster readable. They collapse independently to slim tabs without stopping live data updates. Narrow screens use separated top/bottom fallbacks. Empty-space globe clicks are inert while cockpit owns the camera; `C`, `Escape`, or `EXIT COCKPIT` explicitly exits and restores the same tracked entity and standard follow camera. Unknown feeds remain unknown, selection loss still exits safely without inventing a replacement track, and the cockpit never presents the summary as threat scoring or an all-clear. This is a desktop first-person presentation, not a WebXR session.
- **Cockpit left-panel clearance:** the Cockpit Contact card and peripheral HUD participate in the adaptive left accordion's live obstacle measurements, including live viewport-height changes. Expanding Layers or Scenes keeps the active panel in the available upper-left corridor with internal scrolling; it does not cover the Contact card, lower Cockpit controls, or Cesium credit line. Outside Cockpit the hidden card does not alter the normal corridor.
- **Cockpit Context scope:** the 250 km radius applies to the air/sea proximity cohorts. Installation counts come only from the currently loaded viewport and are labeled `CURRENT VIEWPORT ONLY` in the cockpit as well as the normal Context panel; neither surface presents them as a complete 250 km installation survey.
- **Cockpit camera anchor:** first-person mode does not write feed-boundary corrections directly into the camera. A cockpit-only inertial anchor advances from the selected aircraft's displayed course and speed, then converges toward the authoritative delayed track with correction capped below forward motion. The displayed kinematics are derived from the same consecutive fix segment as the rendered position, with raw feed speed/course used only as fallback; a transient zero/missing feed speed therefore cannot freeze a visibly moving aircraft after layer enable or a map/cockpit handoff. Rendered altitude continues to come from that interpolated track position. Late ADS-B fixes and short render stalls can remove drift without accelerating or reversing the view. Camera placement runs before scene update/culling at a bounded 20 Hz so a moving cockpit does not force Photoreal 3D Tiles to retraverse on every display frame; textual instruments update at 10 Hz and context/layout work at 4 Hz. Every far Cockpit contact pip shares one stable Cesium texture-atlas entry and skips unused screen-projected course calculations, while only in-range 2D aircraft silhouettes pay the screen-projected rotation cost; ambient glTF collections are hidden/retained rather than synchronously destroyed at cockpit entry, and context rails lay out only on explicit content/state changes and viewport resize. The deliberate 15/30-second layer interpolation delays and per-Cesium-frame position caches remain unchanged.
- **Cockpit route, vision, and view controls:** visible on-screen `COCKPIT`, `RESET`, and `EXIT COCKPIT` controls replace reliance on the `C` shortcut. RESET uses the same canonical globe route as the map and voice actions, exits Cockpit, and releases its camera ownership rather than exposing the hidden map-style top action. When the tracked commercial flight has a plausible scheduled route (VRS standing data), the top of the right briefing rail shows a compact `FROM → TO` airport strip and the visor shows a centered estimated-destination chevron with its relative bearing; absent or implausible route data hides the strip and cue rather than guessing. The cockpit-local vision control is an interactive `PREV / CURRENT / NEXT` carousel over the inherited map preset, `CRT`, `NVG`, `FLIR`, and `NOIR`; its previous/next actions wrap, and activating the current value advances to the next style. The inherited entry is named directly, such as `NOIR`, and retains that map shader. There is no empty `NONE` entry. CRT, NVG, FLIR, and NOIR temporarily activate the existing Cesium post-process stages, while returning to the inherited entry or exiting Cockpit restores the pre-entry visual style. The regional-news page uses a free Google News RSS locality query first, with the existing GDELT query retained only as a fail-soft fallback; linked headlines remain reporting, not verified incidents or risk intelligence.
- **Cockpit weather status:** the earlier multi-canvas atmospheric compositor remains fail-closed and is not attached to the live viewer. Cockpit clouds are a separate transparent WebGL pass with a capped 520×320 framebuffer, 24 ray steps, three FBM octaves, and a 12 FPS ceiling. It defaults off and starts only when local storage explicitly contains the persisted `WX ON` opt-in (`'1'`). When opted in, observations refresh after five minutes or 25 km of aircraft movement, fail transparent when unavailable or clear, and stop on exit or disable. `WX OFF` governs atmospheric rendering only: the briefing still fetches source-backed Nominatim, headline, and Open-Meteo local-information data, aborting and replacing any in-flight request when the selected aircraft changes. No weather effect runs in map mode and no synthetic fallback is shown. Under `GEV_NONCOMMERCIAL_SOURCES=off` (the hosted deployment) there is no Open-Meteo at all: no `WX` toggle, no cloud pass, and a Local Info page with the place and position only (2026-09-22 note at the top).
- **Cockpit trail visibility:** entering cockpit hides the selected aircraft's trail body and head so they cannot cross the first-person view; exit restores them. This cockpit-only presentation change does not alter the normal map-mode invariant that aircraft trails render through terrain using their depth-fail material.
- **Aircraft course slew:** civilian and military 3D models retain the 60°/s course limiter, but each rendered frame can consume at most 250 ms of accumulated slew time. A long tile/render stall therefore catches up over multiple visible frames instead of turning one delayed frame into a heading snap.
- **Manual-first cockpit briefing:** the right-side Live Signals / Regional News / Local Info carousel does not advance automatically on page load. Previous, Next, and direct page controls remain available; the visible `CYCLE OFF` / `CYCLE ON` toggle explicitly starts or stops the nine-second page cycle, which still pauses on hover/focus and while collapsed, hidden, or outside cockpit mode. Live signal data continues refreshing in either state.
- **Photoreal horizon blend:** Cesium's sky atmosphere remains enabled behind the hidden base globe, but its light intensity, saturation, and brightness are reduced from the library defaults so the distant Google Photorealistic 3D Tiles boundary blends into the sky instead of producing a bright cyan horizon seam.
   - **Cockpit direction and speed tapes:** plausible destination metadata now drives one translucent, isometric visor chevron labeled directly below with the estimated geographic bearing; the prior full geodesic dashed path is not rendered. A mirrored live ground-speed tape follows the inside-left keyhole rim using the same responsive curve, end fades, fixed pointer, and fractional tick motion as the altitude tape on the right. Speed values scroll upward as they increase while altitude values scroll downward. Its tick endpoints and current-speed pointer share the rail's inset-circle origin, so the markings stay attached to the visible curve rather than drifting inward with the text-label gutter.
- Voice control UI (`#gev-voice-control`) shows status states OFF / CONNECTING / LISTENING / EXECUTING / ERROR.

### Current Global Post Defaults

**Reasonable-defaults batch (2026-08-22), extended and partly revised
2026-08-23 and 2026-08-24, and re-read off the owner's own console
2026-09-10.** First-run defaults move together as one coherent console
presentation. Every one is a FIRST-RUN baseline only: a
share link or the operator's own hand still wins over it, and none of them sets
the `_detectionUserOverridden` / explicit-intent flags that would suppress a
separate landed behaviour. Pinned in `src/reasonableDefaults.test.mjs` (feather,
detection, OUTSIDE opacity) and `src/data/layerState.test.mjs` (3D).

**The 2026-09-10 defaults** (superseding the 08-24 values of `DENSE 75%`/`7%`/
`1%`/`11%`): the first-run look is Detection **BALANCED `50%`**, ELASTIC
allocation, Fade **`24%`**, OUTSIDE opacity **`37%`**, scope feather **`49%`**,
and 3D fleet mode PROXIMITY (unchanged), with `AIRCRAFT_BRACKET_FLOOR_ANCHOR`
moved to `0.37` to stay pinned to the OUTSIDE default it calibrates against.
The instruction was a screenshot of the owner's own DISPLAY panel, with the ask
that the settings on it become the shipped defaults — so these four values are
one reading, not four rulings. Two terms that must never be conflated:
scope FEATHER softens the black scope-mask edge; detection FADE is the
label/card fading band around the keyhole. The OUTSIDE slider's `step` stays
`1` so every low stop is reachable.

**What moving OUTSIDE up costs the AIR bracket floor.** The floor lifts side
aircraft brackets so they survive a faint surround, and it is anchored so
`AIRCRAFT_BRACKET_ALPHA_FLOOR` (`0.35`) lands exactly at the default. With the
anchor at `0.37` the whole ramp sits at or below the identity line, so the
rescue is INERT at every setting — including a hand-dialled `1%`, where
brackets now fade with their own labels instead of being held up. That is the
consequence of the anchor tracking the default rather than the slider position,
it is recorded in `detectionPolicy.test.mjs` rather than hidden, and moving the
default back down re-arms the mechanism unchanged.

**Allocation, defined precisely** (matches
`src/data/labelArbiter.js` `allocateLayerQuotas`): **ELASTIC** begins with
roughly equal capacity across active layers and redistributes unused
entitlement (`labelArbiter.js:170`); **WEIGHTED** allocates using visible
demand with square-root demand scaling and semantic layer weights
(`labelArbiter.js:181`). First-run default: ELASTIC.

**A default has THREE surfaces, and a PARSE fallback that is not one of them.**
The value literals (engine constant, markup value, markup readout, `ui.js`
`GLOBAL_POST_DEFAULTS`, the share generator's starting state) must all move
together, because a fresh boot runs no restore and those literals ARE the startup
state. The `scf` / `ko` PARSE fallbacks deliberately do NOT move: they answer
what an OLD LINK that omits the field meant, and such a link was authored under
that era's default (`scf` → 35, `ko` → 5). Every link since carries both fields
explicitly, because the generator always writes them, so no era whose default
later changed depends on a fallback either way.

**They do NOT all persist the same way, and only one of them persists at all.**
Worth stating plainly, because "a default you can override" and "a default that
remembers" are different promises:

- **3D models** have durable storage — `gev:layer-state:v2` in local storage,
  written by `LayerStateCoordinator` on explicit intent. A session that stored a
  snapshot keeps whatever it stored, across tabs and restarts.
- **Detection mode/density and scope feather have NO storage key at all.** Their
  only durable carrier is the URL hash (`dm`/`dd`, `scf`), written on a 500 ms
  debounce. A same-URL reload therefore keeps them only if that debounce already
  fired; a bare URL or a new tab returns to these defaults. That is unchanged by
  this batch — it is simply what these controls have always done — but it is the
  reason "stored state wins" is true of the 3D toggle and not of the other two.

**Known edge (detection, pre-existing, deliberately not redesigned here):** a
hash-restored `dm=OFF` restores the MODE but not `_detectionUserOverridden`,
which is session-scoped. A recipient of an OFF link who then selects a military
style therefore gets the style's auto-enable, where the original author — who had
turned detection off by hand — would not have. The default flip makes this edge
easier to meet (detection is now on more often), but does not create it.

- Sharpen: `ON`, intensity slider at `49%`
- HUD: `ON`, layout `tactical`
- **Detection: `BALANCED` @ `50%`** — ON for EVERY style on a first run, Normal
  included (was `OFF` @ `50%` before 08-22, then `DENSE` @ `75%` until
  2026-09-10). It reads its own frozen
  `FIRST_RUN_DETECTION_PRESET { mode:'balanced', densityPct:50 }`, declared
  beside — and no longer the same object as —
  `MILITARY_DETECTION_PRESET { mode:'dense', densityPct:75 }`, which remains the
  TACTICAL look the military styles and the Contacts context mode apply
  (Contacts OWNS detection while active and restores the prior state on exit —
  `contactsDetectionPolicy.js`; Cockpit deliberately does not touch detection at
  all). Splitting them is the point: a first run is now quieter than
  CRT/NVG/FLIR instead of sharing one number by coincidence. `50` was already
  the density slider's markup value, its readout and the detection engine's own
  `_densityPct`, so the baseline and the DOM finally describe the same console.
  Fade opens at `24%` since 2026-09-10 (`7%` on 08-24, `16%` before). Style-switch semantics are
  unchanged: CRT/NVG/FLIR still carry `detection: MILITARY_DETECTION_PRESET` and
  still yield to `_detectionUserOverridden`; Normal still has no
  `STYLE_PRESET_DEFAULTS` entry, so switching TO Normal touches nothing. A share
  link carrying `dm=OFF` still restores OFF.
- **Detection OUTSIDE opacity: `37%`** (moved `5% → 3% → 1% → 37%`; the world
  beyond the keyhole is readable rather than erased).
  `KEYHOLE_OUTSIDE_OPACITY_DEFAULT` in `src/celestialRing.js`, mirrored by
  `#detection-opacity-slider`'s markup value AND readout,
  `GLOBAL_POST_DEFAULTS.detectionOutsideOpacityPct` in `ui.js`, and
  `_detectionOutsideOpacityPct` in `sharelink.js`. The slider's `step` is now
  `1`, so 1–4 % are reachable at all (at the step of 5 they were not).
  `AIRCRAFT_BRACKET_FLOOR_ANCHOR` in `src/data/detectionPolicy.js` MOVES WITH IT
  — now `0.37` — because the mapping follows bracket brightness rather than
  slider position; see the inert-floor note above for what that costs. The `ko`
  PARSE fallback stays at `5`.
- **Scope feather: `49%`** — a wide, atmospheric falloff (moved
  `35% → 0% → 8% → 11% → 49%`; the `0%` hard crop lasted one day). `SCOPE_FEATHER_RATIO_DEFAULT` in `src/scopeMask.js`,
  mirrored by `#scope-feather-slider`'s markup value AND readout and
  `_scopeFeatherPct` in `sharelink.js`. The slider is untouched and still spans
  0–100, and an explicit `0` is still the hard-crop path — pinned, so moving the
  default cannot quietly delete it. The `scf` PARSE fallback deliberately stays
  at `35`: a link predating `scf` was authored when 35 was what its author saw,
  and restoring the author's view is what a share link is for.
- **3D aircraft models: `ON`, mode `proximity`** — see the 3D Aircraft section
  above and the DISPLAY-rail entry below (was `OFF`).
- Style shader starting params: CRT/NVG/FLIR pixelation `1.2` (just above the native `1.0` floor); thermal/FLIR ships an optional Ironbow "Predator" palette (`palette` uniform, default `0` = accurate grayscale).

## Operational Notes

- **The chronicle is the one middleware that is not a cache.** Five French
  feeds publish only the present and keep no history — GTFS-RT (151 PAN feeds),
  the QualiCharge dynamic charge-point file, Bison Futé DATEX II, AISStream over
  the France box, and Vigicrues. `recordChronicle` (in `vite.config.js`, policy
  in `src/data/chronicle.js`) folds each into a **168-slot typical week in
  Europe/Paris**, kept indefinitely, and appends thirty days of raw ticks under
  `.gev-cache/chronicle/<source>/YYYY-MM-DD.ndjson` — a finished day is gzipped
  in place (measured ratio 7.3). Read back at `/api/chronicle-fr/{status,series,
  profile,anomalies}`; nothing there writes.
  Four of the five ride on fetches the proxies already make and are ON by
  default (`CHRONICLE_DISABLED=1` stops everything). The fifth polls for itself
  — 1.17 MB gzipped every 15 min — and is OPT-IN via `CHRONICLE_IRVE_DYNAMIC=1`,
  armed in `deploy/vps/docker-compose.yml`.
  Three invariants, each pinned in `src/data/chronicle.test.mjs`: a slot counts
  DISTINCT WEEKS and refuses to score anything under three; a non-finite value
  is refused rather than folded as a zero ("the feed said nothing" is not "the
  feed said zero"); and a value is scored BEFORE it is folded, so an
  expectation never contains the value it is judging. Vigicrues declares
  `profile: false` — a flood answers to rainfall, not to Tuesday — and
  `/anomalies` refuses it with the reason rather than returning an empty list.
  The transit fleet series is `feed.reported`, never `feed.inView`: the proxy
  answers per viewport, and folding the in-box count would make one series mean
  two different quantities. Full reasoning in `docs/CHRONICLE.md`; QA harness is
  `npm run qa:chronicle -- --url http://localhost:5173`.
- **Earthquake discs are STATIC geometry.** Every quake is a `CLAMP_TO_GROUND`
  ellipse; a `CallbackProperty` axis re-tessellates its ground primitive every
  frame, which cost 32.4 ms/frame and 30 fps on the shipped 58-event feed. The
  axes are plain numbers, redefined only when a poll brings new data, and the
  former ±15% radius pulse is gone. Because nothing in the layer animates
  per frame, it holds NO continuous-render hold — the governor stays idle with
  earthquakes on, and the manager's `layer-tick` / `layer-visibility` requests
  carry new data to the screen. Pinned in `src/data/earthquakes.test.mjs`.
- **Geocode framing has an off-centre sanity gate.** A viewport that is both
  bigger than any city (>300 km diagonal) and not centred on its own geocoded
  location (anchor >15% of the diagonal from the centroid) is replaced by a
  40 km metro box on that location. This is what stops "Tokyo" — which geocodes
  as the PREFECTURE, islands and all — from framing open Pacific. `country`
  results are EXEMPT by decision (several have the same pathology from overseas
  territories; reframing a country is a product decision, not a bug fix), and an
  explicit `viewMode: 'overview'` ask bypasses the gate entirely so "show me an
  overview of Hawaii" still frames the whole administrative area.
- **Viewport framing is antimeridian-safe.** `flyToViewportBounds` pads from the
  short-way-round longitude span and wraps the padded edges, so a dateline-
  crossing box stays its true width. Raw subtraction inflated a 0.41° metro box
  to 86.7° and a 60° territory to 132°.
- CCTV calibration persists at `godsEyeView.cctv.calibration.v2` (v2 rebuild;
  the store was wiped clean, no import from the old `v1` key).
- CCTV v3 floor QA pins are: zero samples for heading-only edits; zero transient
  samples and constant elevation during E/N drag; one shared-floor resolution on
  release; late one-shot shared-cell work is permitted during viewshed idle. The
  A+B harness intentionally excludes citywide LOD assertions.
- Draggable panel positions persist at `godsEyeView.v7.panelPos.<panel-id>` (collapsed states at `godsEyeView.v6.panelCollapsed.<panel-id>`).
- Legacy draggable-panel position keys may remain in local storage for backward compatibility, but the map-mode right rail ignores them; collapsed states still persist at `godsEyeView.v6.panelCollapsed.<panel-id>`.
- Flight/military tracked entities cache dead-reckoned positions per frame to avoid callback desync flicker.
- Aircraft 3D-model and tracking invariants are covered by `npm run test:track`; run this before touching `flights.js`, `militaryFlights.js`, `detection.js`, or `trackedReadout.js`.
- Annotation resolver behavior is pinned by `src/annotations/annotationResolver.test.mjs`; re-run that suite before changing place-resolution scoring.
- Layer input handlers (click + keydown) are detached on disable for flights/military/satellites/AIS vessels.
- Traffic tile cache is capped and traffic layer supports explicit destroy cleanup.
- Traffic feed state is honest about simulation. `getStats().mode` is the
  CONFIGURED source ('live' = a TomTom key is present, 'sim' = keyless), NOT
  this instant's health — health rides on `error`. Keyless reads FALLBACK with
  `SIMULATED — add TomTom key for live` in both the sync chip and the panel
  meta line; an unreachable `/api/tomtom/status` reads
  `SIMULATED — traffic service unreachable`; a total flow-fetch failure in live
  mode sets `error` (DEGRADED · `SIMULATED — <reason>`) and zeroes the stale
  coverage number. `stats.loading` covers outstanding flow work as well as the
  road fetch, so a failure landing after the 250 ms paint race still ends the
  shared loading batch as LOAD FAILED. Harnesses must gate on `!stats.error`,
  never on `mode === 'live'` alone.
- **The dots obey two things TomTom cannot tell them: signals and speed limits.**
  A dot's cruising speed is `min(highway-class table, OSM maxspeed)` —
  `roadSpeed.js`, a ceiling and never a substitution, so a Paris `primary`
  renders at its posted 30 km/h while a motorway keeps the table's 90 rather
  than jumping to the legal 130. Junctions come from a single global two-phase
  clock (`trafficSignals.js`, `SIGNAL_CYCLE_MS` 70 s): a street's bearing
  folded to 0–180° buckets it into phase 0 (0–90°) or phase 1 (90–180°), and
  one phase holds the green at a time, so perpendicular streets alternate by
  construction with no per-junction data. The junction itself is a vertex two
  ways share, found in the geometry already fetched (`roadJunctions.js`) — no
  second Overpass request, and an exact coordinate match rather than a radius,
  so a bridge over a street is correctly NOT a junction. A dot drives to a stop
  line `STOP_LINE_M` short of the junction ahead of it, `QUEUE_GAP_M` further
  back per dot already queued; it is never teleported onto its place. A dot
  with no room left stops where it stands rather than crossing on a red.
  Grade-separated classes and `junction=roundabout` never queue. `getStats()`
  publishes `signalHeldByPhase`, `signalDotsByPhase`, `signalGreenPhase`,
  `signalRedCrossings` and `stoppedDots`; `__qaRoads()`, `__qaDots()` and
  `__qaJunctions()` publish the model itself. All of it exists because no
  Cesium point primitive paints in headless software GL —
  `qa-traffic-signals.mjs` proves the model, not a pixel, and asserts at one
  crossing at a time as well as viewport-wide: a viewport-wide share can look
  healthy while the junction someone is watching still has both flows moving.
  What it deliberately does not model: junction geometry, turning movements,
  and local phase offsets.
- **Traffic hands its dots to the detection overlay through the `CADRES`
  row chip** (param `vehicleFrames`, session-only like the other two chips),
  **ON by default again since 2026-09-24.** It was OFF from 2026-09-21 (#308),
  because the dots are simulated cars and a bracket and a `VEH-0412` id over
  one claimed a tracked object; the owner then missed the framed cars — what
  made the layer read as traffic at a glance — and asked for them back. The key
  and the flow card still say the cars are simulated. With the chip off
  `getDetectableObjects()` returns nothing. The chip carries the claim:
  `DETECTION_DEMANDING_LAYERS` (`ui.js`) is ORed into the Contacts detection
  claim, gated on the module's `demandsDetection()`, and a `params` event
  re-runs the sync — so with the frames on, detection is switched on (tactical
  Dense @ 75 %) if it was off, and turning them (or the layer) off replays the
  snapshot. A first run already has detection on at Balanced, so the claim
  changes nothing there. The brackets live on the detection overlay's
  `screen`-blended surface: they glow over the satellite and photoreal
  basemaps (the default) and nearly vanish over the light OSM and IGN Plan
  maps, where a pale colour screened over a pale ground stays pale.
- Traffic runs in `sim` mode (light-grey dots, class-table speeds capped by OSM
  `maxspeed`) unless `TOMTOM_API_KEY`
  is configured (env or Keychain `tomtom-api`/`api-key`), which enables `live` mode:
  TomTom flow vector tiles via the budget-governed `/api/tomtom` proxy
  (`.gev-cache/tomtom/`, 120 s TTL, `TOMTOM_DAILY_TILE_BUDGET` default 6,451/day —
  TomTom's free 200,000 tiles a month over 31 days; over it, cached tiles are
  served `STALE-BUDGET`, anything else answers 429 `x-tomtom-limit: budget`
  until midnight UTC and the dots fall back to simulated speeds),
  decoded client-side (`flowTiles.js`), matched onto Overpass roads
  (`flowMatch.js`), and rendered as mint/amber/coral dot color + speed/density
  scaling (`trafficFlowStyle.js`); closures spawn no dots; unmatched roads stay
  light grey (`#d0d6d9` @ 0.7, white under NVG/FLIR/CRT where a dim dot reads as
  a hole). Road fetch bounds center on the camera look-at point (`trafficBounds.js`).
- **Colour is for trouble** (2026-09-21). The shared ladder's free rung is a
  pale mint `#8fd4ab` instead of `#2ecc71` — for `traffic` AND `road-status-fr`,
  which draw the same rungs on the same row — and free dots sit at 0.8 alpha
  against 0.9 for amber and coral. The key lists the rungs best-first like
  `road-status-fr` (Fluide, Ralenti, Bloqué, then Non mesuré, Route fermée),
  with no counts and one plain sentence each ("de 55 à 85 % de sa vitesse sans
  trafic"). Its source line opens on « Véhicules simulés » and prints when the
  OLDEST TomTom tile on screen left TomTom: the proxy stamps
  `x-tomtom-fetched-at` (epoch ms — absolute, because the browser cache replays
  a tile for up to 120 s with frozen headers), `flowTiles.js` copies it onto
  each segment as `fetchedAt`, and a day is added when it is not today. The
  old line said "rafraîchi toutes les 60 s", which was never true.
- **A parked view refreshes its flow quietly** every `FLOW_REFRESH_MS` = 125 s
  (just past the proxy's and the decode cache's 120 s TTL): same box,
  ribbon repainted, dots recoloured in place with EVERY style field rewritten
  (a jam that clears loses its size and city-scale punch; a closure that
  reopens shows its dots again). Quiet means no `_flowPending`, so no loading
  chip, and a failure keeps the last colours without raising an error — the
  key's time is what ages. Live sessions only, never in a hidden tab, and at
  most `FLOW_REFRESH_MAX_PER_VIEW` = 5 per camera load (~10 minutes) so a
  forgotten tab cannot spend the shared TomTom budget. The previous ribbon
  batch stays on screen until the new one has built (`getStats().ribbonReady`),
  so the refresh never blinks. Measured 2026-09-21 over Paris at 3.5 km with the
  camera still: tiles 4 → 8 in 140 s, `loading` never true, no bare frame, key
  12:58 → 13:00.
- **A click on a coloured stretch of the ribbon opens its card**
  (`trafficFlowCard.js`): road class in French, the rung, "roule à 35 % de sa
  vitesse sans trafic" (TomTom's relative tiles carry no km/h, so none is
  printed), "reçu de TomTom à 12:53", and that the vehicles on it are
  simulated; the stretch is redrawn 4 px wider in its rung's colour. Free-flow
  stretches do not answer — they lie under most streets, and every "click the
  map to close this" would open one. The ribbon carries NO pick id on purpose:
  an id is a claim of ownership to every other layer's click handler (flights
  would stop releasing tracking on a street click; on a phone nearly every tap
  would open a traffic card). The layer only looks when the pick is the world
  (`isWorldPick`), reads the ground with `pickPosition`, and searches its own
  records (`nearestFlowStretch`, reach = half the drawn width + 6 px, 12 on
  touch). A repaint re-finds the open stretch by geometry key or closes the
  card; Escape closes it. QA seams: `qaFlowStretches()`,
  `qaSelectStretchAt(lon, lat, metresPerPixel)`, `qaSelectedStretch()`.
- In live mode the layer has TWO halves that degrade separately. The DOTS need
  Overpass. The RIBBON (`flowRibbons.js`) does not: it draws TomTom's own
  polylines as one batched `GroundPolylinePrimitive`, so live congestion reaches
  the screen whether or not the road graph ever arrives. Measured 2026-09-10,
  Paris street band: 2 tiles / 78 KB / 3 942 segments / 9.4 ms to build the
  instances. The `FLUX TOMTOM` row chip (`setParams({flowRibbon:'off'})`) hides
  it. When there are no dots to count, `getRowControls().legend` reports the
  ribbon's per-bucket tally rather than zeroes over a painted map.
- Flow-tile zoom and the ribbon's road-class floor belong to the camera band
  (`ROAD_FETCH_TIERS.flowZoom` / `.ribbonMinClass`), because the band owns the
  box span. z12 over the metro band's 0.30° box is 30 tile requests for one
  viewport against an edge rule that allows 30 per 10 s for all of `/api`; z10
  covers it in 4. A flow tile does not thin out with altitude either — those
  four z10 tiles decode 27 080 segments over Paris — so the metro band keeps
  only motorway/major classes, the same narrowing its Overpass query already does.
- `flowTiles.js` joins concurrent requests for a tile already in flight
  (`stats.tilesJoined`): the decode cache only records a RESOLVED tile, so the
  ribbon warm-up and the road matcher used to miss and fetch the same tiles
  twice. Tile responses carry `Cache-Control: private, max-age=<remaining TTL>`
  (`private`, not `public`: staging is behind Basic auth and no shared cache may
  replay a tile past the gate). A 429 arms a cooldown that honours `Retry-After`
  and serves the last decode instead of hammering.
- A 429 names its author. The proxy stamps its own budget refusal
  (`x-tomtom-limit: budget`, `Retry-After` to the UTC day boundary), so
  `deriveTrafficFlowError` reports `TomTom daily budget reached` only for that
  one; a 429 raised in FRONT of the origin reads `Rate limited by the server,
  not by TomTom`, and an unlabelled one names the status without picking a side.
- The hosted origin reaches `overpass-api.de` over IPv6 ONLY — both of its IPv4
  addresses refuse the connection — so `deploy/vps/docker-compose.yml` declares
  an IPv6-enabled network. Without it the container silently falls through to
  the one community mirror it can reach, which answers 429, and `/api/overpass`
  returns 502 after 25 s. This is not a TomTom failure mode and must not be
  diagnosed as one.
- Development captures opened with `?trafficDebug=1` mint an interaction anchor
  from the exact `camera.changed` event that arms each debounced load, then emit
  scheduling-correlated User Timing entries for production `response.json`, road
  parse, flow-race, dot construction, heat-line rebuild, and next-post-render
  boundaries. Every trace is paired with the exact camera-change that scheduled
  its load; mismatches are counted drops. Cesium's `moveEnd` remains a diagnostic
  mark only: it arrives about 500 ms after stillness, typically after fetch has
  begun, and fetch never waits for it. Production builds remove the flag, hooks,
  counters, and timing labels.
- Voice debug log: `tail -f .gev-logs/realtime-conversations.jsonl` (gitignored).

Replay chase-camera updates run in Cesium `preUpdate` before scene traversal, preventing 3D-tile refinement stutter when the mission replay speed is reduced. Replay Ascent first gives the selected launch site a five-second tile-preparation hold before displaying the T-minus countdown. Replay ascent duration is mission-specific: disclosed insertion, SECO, or separation timing is compressed into the replay, while sparse records use reconstructed path length with bounded fallback timing instead of a universal fixed duration. Replay transitions directly from ascent to orbit; stage re-entry/recovery remains static contextual linework and is never a camera-tracked playback phase. The screen-space rocket/thrust symbol renders at 50% of its 92 × 138 px design box, while the separate callout text remains unchanged. Successful/upcoming selected missions show a current orbit marker: green for a reliable TLE match or amber and explicitly estimated when no live match exists. Failed launches show their source status and suppress live/estimated orbit markers and fallback rings. A retained Launch Library orbit is labeled as the planned target, an absent ascent is reported as unavailable, and replay-only controls remain hidden unless the selected mission has a rendered track; authoritative supplied trajectory points remain visible when present. Mission orbit primitives realign by model matrix each tick from the same current-GMST frame as their marker, preventing ring/marker drift; their host annotation reads the position cache updated in that same tick. During depth-dominant ascent segments, the replay rocket retains its last valid path-facing rotation rather than snapping toward the camera. Mission selection and replay overlays never call photoreal `sampleHeight()` from the render loop; the launch-zone ground primitive and precomputed surface-safe replay path avoid remote tile-refinement probes that previously caused a one-second globe texture pulse. The shared host replaces the former mission-label visibility churn and quadratic overlap loop; the layer's remaining frame sweep only culls native point/billboard geometry and refreshes selected UTC copy when its displayed second changes. Replay samples uneven path vertices by cumulative distance and normalizes camera-yaw easing to frame time.

Orbit replay framing uses one combined bounding sphere for Earth and every sample of the selected orbit. The camera derives its final range from that full envelope, while its look-at target retains a radial bias toward the moving vehicle rather than collapsing onto the singular Earth-center frame. Compact-orbit launchers therefore remain tracked during camera rotation, and highly eccentric transfer orbits still keep both the globe and their distant apogee arc visible. The orbital camera stays on one side of the mission's 3D orbit plane and uses the vehicle radial as visual up, so forward motion remains screen-left through polar/local-heading wraps instead of alternating left and right. The fixed-size cyan orbit dot retains one pixel scale throughout the pullback. While replay owns the camera, the selected launch-site host label is suppressed so it cannot duplicate or overlap the replay vehicle's DOM callout; cancel/completion restores it.

Mission ascent paths use a long cubic insertion transition that matches the incoming climb direction and the sampled orbit tangent. Because a Cartesian cubic can otherwise chord through the ellipsoid for some inclined insertion geometries, every blended sample preserves the original climb's smooth minimum-altitude envelope. This removes the artificial right-angle insertion corner and corresponding rocket heading snap without allowing the ascent path to enter the globe.

Insertion is source-aware: catalog-backed missions propagate the matched satellite to the historical insertion epoch. Projected missions have no authoritative historical phase, so their orbital plane starts over the launch site and follows a plausible launch azimuth—south-southwest for western North American sites and polar missions, eastward otherwise. The projected insertion advances only by the disclosed ascent duration or a ten-minute fallback, producing one continuous downrange climb into the forward orbit tangent instead of using UTC as an arbitrary phase and correcting through a 180-degree hook.

The reconstruction does not add a full revolution around Earth: ordinary launch vehicles use a gravity turn and downrange acceleration before orbital insertion, rather than spiraling around the planet during powered ascent.

At close range, the selected launch site's 500 m highlight is a single material-backed `GroundPrimitive` classified against both terrain and photoreal 3D Tiles. It has no fixed world-space height offset, so the translucent disc and rim remain draped across the rendered launch-site surface during tile refinement. A small render-state polygon depth bias keeps coplanar ring fragments above the photoreal mesh at low oblique angles without making the geometry float or drift.

The Space Missions roster prioritizes data-rich records using available mission, orbit, payload, trajectory, timeline, and recovery fields; launch time remains the tie-breaker.

When no live catalog track is available, the mission view marks the approximate orbital ring as `PROJECTED ORBIT` in purple and renders the ascent-to-insertion transfer in green; catalog-backed satellite orbits remain cyan.

The replay vehicle is a smaller solid cyan silhouette without the former orange flame; its initial pad anchor uses photoreal terrain, globe height, or launch elevation fallback so it remains above the surface during tile loading. Replay begins at a close launch-complex range so pad detail remains visible before the camera widens into the ascent context view. Its initial camera heading is perpendicular to the ascent/orbit direction for a profile view, then eases into tangent tracking. Small screen-space reprojection changes are damped for the animated marker on both ascent and orbit, while large camera or phase changes snap to the authoritative path position.
Space Missions keeps the Satellite layer available for catalog/TLE matching but suppresses its standalone fleet points and orbit rings. While those visuals are hidden, their per-frame dense propagation, one-second core point-buffer rewrite, and one-second orbit-matrix rotation are suspended; selected mission telemetry continues to propagate independently. The selected mission's live or estimated satellite marker uses fractional wall-clock time, so it moves continuously rather than creating a once-per-second position discontinuity and one-frame photoreal globe LOD pulse.

During ascent replay, the camera, Cesium callbacks, and HTML vehicle overlay share one replay sample per rendered frame. The tracked overlay is projected directly from that shared position instead of applying a second screen-space lag filter, preventing the vehicle and globe from repeatedly advancing and snapping back.

After the initial broadside launch profile, the ascent chase camera stays in a rear-quarter view about 30 degrees off the vehicle's forward path bearing, widening smoothly toward 45 degrees as orbit context appears. Cesium's `HeadingPitchRange` already places the camera opposite the supplied heading vector, so replay does not add a second 180-degree inversion; the trajectory therefore travels away toward the horizon while remaining visibly offset from the screen centerline.

During orbit replay, the camera continues following the selected vehicle but eases its look-at target down toward the vehicle's sub-satellite globe anchor. The range expands when necessary for high-altitude missions, keeping both Earth and the tracked label visible through the full revolution. The active replay clock clamps at the final orbital sample rather than wrapping to ascent progress zero; replay completion therefore leaves the final globe/orbit framing in place and does not return to the launch site.

Reconstructed mission orbits use a small downrange launch-to-insertion arc, so their estimated ground track is not artificially drawn directly over the launch pad in top-down views. The ascent remains connected to the ring at its selected insertion point.
Collapsed right-rail controls use the same 176 px width as collapsed left-rail controls, while expanded right-side detail panels retain their independent widths. DISPLAY starts collapsed on first run and then respects persistence; DISPLAY may remain open beside CCTV or Context, while CCTV and Context remain mutually exclusive without persisting forced collapses. Selecting a dedicated Context mode opens its right-side surface and clears unrelated layers after first snapshotting their exact state. Final exit restores the original enabled set and changed parameters. Cockpit View hides the right-side CCTV control because CCTV is not part of the cockpit rail. Airborne cockpit altitude uses the tracked aircraft's reported aviation MSL altitude, never the potentially negative Cesium terrain/ellipsoid render height; confirmed grounded contacts display `0 ft` without rewriting that source field. A cold photoreal floor shows `ACQUIRING SURFACE` for at most five seconds, then uses the source target-height fallback instead of freezing the camera indefinitely.
Replay transport uses one Play/Pause toggle plus Cancel. During ascent only the active thrust ring is visible; stage-recovery handoff uses a pulsing dot.

## Tooling Snapshot

- `tools/cesium-render.mjs`: headless Cesium render capture via Puppeteer.
- `tools/streetview-panorama.mjs`: Street View tile panorama stitcher.
- `tools/streetview-headings.mjs`: heading sweep capture; supports neighbor traversal.
- `tools/pano-pinhole.mjs`: equirectangular-to-pinhole reprojection.
- `tools/sat-ortho.mjs`: Map Tiles ortho stitch and centered crop with georef corners.
- `scripts/track-regression.mjs`: headless real-app regression harness for aircraft tracking/model/detection invariants (`npm run test:track`).
- `scripts/lib/qa-first-run.mjs`: the QA fleet's first-run suppression. Every
  `qa-*.mjs` opens its page with `newQaPage(browser)`, which writes the app's own
  per-session dismissal before any page script runs, so neither the card nor the
  bubble ever paints over a harness's clicks, pixels, or focus — the session seed
  hides every variant, C included, because all three pass through one door.
  `npm test` audits the fleet for it (`src/qaFirstRunSuppression.test.mjs`) — a
  new harness that forgets goes red with the fix in the message.
  `qa-firstrun.mjs` is the single exemption: the card is what it tests. By hand,
  `?welcome=0` on the app URL does the same.
- `scripts/qa-map-source-tray.mjs`: browser proof for the four-source Map Source
  tray — presentation, keyboard disclosure, responsive bounds, unpinned
  auto-dismiss, ACQUIRING status, and retired/unknown stack-id restore
  (`QA_BASE_URL=http://localhost:4173 npm run qa:map-source-tray`). Add
  `-- --keyless` to force the no-ion-token expectations on a keyed server; both
  invocations are gates.
- `scripts/qa-rnb-pivot.mjs`: the pivot re-measured against three live services,
  with no browser and no dev server (`npm run qa:rnb-pivot`, or
  `-- --box lyon`). It decodes the same BD TOPO tiles the layer would draw, with
  the layer's own module, and runs the map's own `joinPointsToBuildings` over
  them. Four checks per box: the tiles still carry `identifiants_rnb` (floor
  80 %, measured 95.5–99.2 %); the RNB's own `bdtopo` identifiers still match
  those tiles' `cleabs` (floor 98 %, measured 573/573 over Lyon 2e); the
  identity join still reaches more DPE rows than the geocoded dot (81.8 → 96.3 %
  Paris, 40.4 → 75.7 % Lyon, 78.8 → 88.9 % Marseille, 14.0 → 41.5 % Ustaritz);
  and, informationally, how many rows the dot was putting on a neighbour's roof.
  A service that is down reports "not testable here" rather than red — three
  upstreams is three ways to have a bad afternoon that says nothing about this
  repository.
- `scripts/qa-view-gate.mjs`: browser proof that a layer gated on a close camera
  is FLOWN there rather than told to zoom (`npm run qa:view-gate --
  --url http://localhost:4173`). Covers Bâti 3D and the mapped grid from a
  420 km camera, the share-restore origin that must keep its own camera, and
  the off-coverage view that must not be flown anywhere.
- `scripts/qa-cadastre-highlight.mjs`: browser proof that the SELECTED parcel's
  highlight covers that parcel and nothing else (`npm run qa:cadastre-highlight
  -- --url http://localhost:4173`). No unit test can see this one: the geometry
  handed to Cesium was right and only the pixels were wrong, because a batched
  `GroundPrimitive` colours a ground pixel by each instance's axis-aligned
  BOUNDING RECTANGLE (`CULL_FRAGMENTS` in `ShadowVolumeAppearanceFS.glsl`), not
  by its polygon. So the check is on pixels: the parcel's own rings are
  reprojected through the camera and compared with the highlight over Ustaritz
  AN 0512, from a nadir and an oblique camera, against a 0.90 floor on
  intersection over union and a 1.5 m bleed ceiling — 0.983 and 0.975 on the
  shipped build, 0.443 and 0.139 before the fix. It also reads `getPrimitiveShapeForQa()` so
  the fills stay batched per band colour: giving every parcel its own primitive
  would pass the pixel checks and cost the frame rate the layer is built around.
  Screenshots land in the gitignored `qa-shots/cadastre-highlight/`.
- `scripts/qa-l9-matrix.mjs`: the L9 release-candidate QA matrix in one command
  (`node scripts/qa-l9-matrix.mjs --url http://localhost:4173`). Orchestrates
  the `qa-*.mjs` fleet plus `track-regression` as subprocesses and adds
  repo/feed/in-browser probes; a check whose key the target lacks is SKIPPED
  with an OWNER-RUN tag rather than failed. Run with `--list` to print the
  manual checks it cannot automate.

## Maintenance Rule

When runtime behavior or architecture changes, update this file in the same change set as code updates.
