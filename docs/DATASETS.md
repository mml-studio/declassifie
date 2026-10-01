# The dataset box — plug in any dataset

Updated: Sep 8, 2026.

This document says how a dataset gets into Surplomb without anyone writing a
layer, what it receives on the way in, and what it does not. It is the
contract; the code is in `src/data/dataset*.js`.

## Why

Before this work, adding a layer cost **17 to 23 files** — measured on
`medecins-fr`, `petite-enfance-fr` and `meteo-stations-fr`: a 2,000-line
module, a feed, a 300-line proxy plugin, a share token, a taxonomy row, a
credit, a voice alias, two README tables, a QA harness. Eleven of those files
did nothing but **state a fact** about the dataset: where it comes from, which
group it shows in, who publishes it, under which license. A manifest states
those facts once, in JSON, and the box derives every registry entry from it.

The gap was not the data — French platforms answer with open CORS, measured on
2026-09-08: data.gouv.fr (tabular API, metadata, `r/<uuid>` redirect, static
host), the IGN Géoplateforme (WFS) and Opendatasoft portals all send
`access-control-allow-origin: *`. The gap was the **plumbing**. The box is that
plumbing, written once.

## Three ways to plug in a dataset

### 1. In the app — a subject, or an address

Under the layer list, *＋ BRANCHER UN JEU DE DONNÉES* (＋ PLUG IN A DATASET). A
single field takes both, and the button says which one it read: *CHERCHER*
(SEARCH) for words, *ANALYSER* (ANALYZE) for an address.

The box is the panel's guest, not its tenant: at rest it fits on one line, a
click opens only the field, and it takes room from the layers only once there
is something to read — a shortlist on screen, or a draft in hand. Even then,
the list keeps two rows and the box scrolls the rest. Closing it gives
everything back and loses nothing: the draft and the shortlist are still there
when it reopens.

A subject — *défibrillateurs* (defibrillators) — opens the **shortlist**. The
first five data.gouv.fr results are read at once, only those that yield a
valid draft are offered, and each carries four facts read from the platform:
how many features, who publishes, how fresh, which license. What was set aside
is stated with its reason in a few words — *fichiers introuvables* (files not
found), *aucune colonne de position* (no position column). Nothing is
preselected: measured on six subjects, the platform's first result is the right
one half the time, and its mistakes look like successes (nineteen points from
one department where a national base of 186,118 was the target). This is a
call only the reader can make, so the reader makes it — the pull request that
built the box (#113) measured what this shortlist costs and what the visual
feedback is allowed to show while it loads.

A pasted address skips the shortlist and goes straight to the draft. The box
reads what the platform publishes about itself — title, publisher, license,
columns, a sample —, guesses how a row is placed, and shows the draft: name,
color, chosen resource (when there are several), position columns (with the
reason for the guess), and the notes an attentive reader must see. Nothing is
drawn before *BRANCHER* (PLUG IN).

Recognized addresses:

| What you paste | What the box does |
|---|---|
| A data.gouv.fr dataset page (`/datasets/<slug>/`) | picks the most readable resource (GeoJSON, then CSV, then WFS), reads its profile from the tabular API |
| A data.gouv.fr resource (`/datasets/r/<uuid>`, `#/resources/<uuid>`, a bare UUID) | the same, for that resource |
| An Opendatasoft dataset page (`/explore/dataset/<id>/`) | reads the portal's metadata, finds the geographic field |
| A WFS GetFeature with `typeNames=` | a WFS layer loaded for the view |
| A bare `.geojson`, `.geojsonl`, `.csv` | the file, with publisher and license left to fill in |

The plugged dataset is remembered **in this browser** (`localStorage`), with
its on/off state. The ⧉ button copies its manifest: that is the file to drop
into `datasets/` so that it ships to everyone.

### 2. In the repository — one JSON file

A `datasets/<id>.json` file is enough. At the next build the layer is on the
panel, in its group, with its source line, its credit in the attribution
window, its card and its legend. The test
`src/data/datasetsCatalog.test.mjs` rejects any manifest that does not
validate — the same discipline as the core registries, where a layer without a
category is a boot failure.

One example ships: the GeoDAE defibrillators (data.gouv.fr, tabular API,
loaded for the view). It does not take a row in the panel — its `fusion` block
sets it as a chip of *Santé & secours* (Health & emergency services):

```json
"fusion": {
  "into": "medecins-fr",
  "chip": "Défibrillateurs",
  "title": "Base nationale GeoDAE — ce qu'un passant peut décrocher"
}
```

`into` is the id of a core layer, which must exist and must not itself be a
chip; otherwise the plug is refused, instead of laying down a layer nothing
controls. `chip` is 24 characters at most, and `optIn` (optional) leaves the
chip off when the row is turned on.

**A manifest is not shipped for what a layer already draws.** The BD TOPO
aerodrome footprints had one, and it was withdrawn: the Airports layer embeds
418 of those footprints, joined to OurAirports on the ICAO code, and two rows
in the same list for the same subject ask the reader to settle an overlap they
have no way of seeing. What the join leaves out is written in
`src/data/airportsPack.js` — the 704 BD TOPO heliports (hospitals, fire
stations, gendarmeries) and the 30 outlines, mostly military, that no airfield
in the pack claims — and it stays pluggable with one address:
`BDTOPO_V3:aerodrome` on `https://data.geopf.fr/wfs/ows`, pasted into
*＋ BRANCHER UN JEU DE DONNÉES* (＋ PLUG IN A DATASET).

### 3. From the command line — after an MCP search

`.mcp.json` registers the official data.gouv.fr MCP server for the assistant
that works alongside a contributor. The full path:

```
search_datasets("défibrillateurs")        ← MCP: find the dataset
list_dataset_resources("61556e1e…")       ← MCP: see its resources
npm run dataset:manifest -- https://www.data.gouv.fr/datasets/geodae-base-nationale-des-defibrillateurs/
```

The script reads the same REST API the MCP server wraps, writes
`datasets/<id>.json`, prints the columns and the notes, and reminds you that
the license it read must be confirmed on the dataset's page. `--dry` prints
without writing; `--resource <uuid>` picks a resource; `--id` renames.

The MCP server stays out of the product — its CORS preflight answers 403, its
answers are prose, and data.gouv.fr calls it experimental. It is for finding;
the box is for plugging in.

## The manifest

```jsonc
{
  "id": "defibrillateurs-geodae",          // lowercase, digits, hyphens — becomes the layer ds-<id>
  "label": "Défibrillateurs (GeoDAE)",     // the panel name
  "name": "Defibrillators GeoDAE",         // optional: canonical name (voice, LLM context)
  "icon": "♥", "color": "#ff5c7a",         // optional; otherwise the color is drawn from a stable palette
  "category": "built-environment",         // optional: one of the eight groups, otherwise “JEUX BRANCHÉS” (PLUGGED DATASETS)
  "coverage": "fr",                        // global | fr | us | cities → the coverage badge
  "cadence": "periodic",                   // live | periodic | static → the freshness wording
  "source": {
    "kind": "datagouv",                    // geojson | geojsonl | csv | datagouv | wfs | opendatasoft
    "resourceId": "edb6a9e1-…",            // datagouv; otherwise "url" (+ "typeName" WFS, "dataset" ODS)
    "scope": "viewport",                   // all | viewport (datagouv lon/lat, wfs, opendatasoft)
    "maxFeatures": 4000,                   // cap, ≤ 30,000 (H3) — declared on the row (A5)
    "maxSpanDeg": 1.5                      // beyond this, nothing is requested: “rapprochez-vous” (move closer) (F6)
  },
  "geometry": { "lon": "c_long_coor1", "lat": "c_lat_coor1" },
  //  or { "point": "coordonneesXY" }     one cell: [lon,lat] JSON, "lat, lon" ODS, {lon,lat}
  //  or { "wkt": "geom" }                POINT (x y)
  //  or { "x": "x", "y": "y", "crs": "EPSG:2154" }   Lambert-93, reprojected
  //  or { "geojson": "geometry" }        a GeoJSON geometry in the cell
  //  (not needed for geojson, geojsonl, wfs, opendatasoft: the geometry is native)
  "feature": {
    "title": ["c_nom", "c_adr_voie"],      // the first non-empty field makes the title
    "ambient": "label",                    // optional: "card" (title + detail) or "label" (title only,
                                           //   detail on click). Omitted, the layer decides: beyond 160
                                           //   loaded features, one card per feature is impossible
                                           //   anyway — see “What floats next to a mark”
    "blank": ["non renseigné"],            // optional: the spellings that mean “I don't know”.
                                           //   A row that would say only that is not written at all
    "details": [
      { "field": "c_com_nom", "label": "Commune" },
      { "field": "puissance", "unit": "kW" },
      { "field": "c_disp_j", "label": "Jours", "format": "days" },   // "list": Postgres {a,b} literal
                                                                    // "days": + runs compacted into lun–ven (Mon–Fri)
      { "field": "c_dispo_horaires", "label": "Horaires", "format": "hours" },
                                           // "hours": an OpenStreetMap opening_hours value,
                                           //   `Mo-Fr 09:00-18:00` read as lun–ven 09:00–18:00
      { "field": "c_etat_fonct", "label": "État",
        "omitWhen": ["En fonctionnement"] }  // the majority value stays silent, the exception is written
    ],
    "group": {                             // optional: one color per value of a field…
      "field": "c_acc",
      "styles": { "Extérieur": { "color": "#ff5c7a" }, "Intérieur": { "color": "#ffb3c0" } },
      "other": { "color": "#9aa7bd", "label": "Accès non renseigné" }
    },
    // …or, when the distinction the reader is after spans SEVERAL
    // columns, an ordered list of rules, where the first match wins:
    // "group": {
    //   "rules": [
    //     { "key": "h24", "label": "Accessible 24 h/24", "color": "#5ce6a8",
    //       "when": { "c_dispo_horaires": ["24/7"] } },
    //     { "key": "libre", "label": "Accès libre", "color": "#ff5c7a",
    //       "when": { "c_acc_lib": ["t"] } }
    //   ],
    //   "other": { "color": "#7d8aa0", "label": "Accès restreint" }
    // },
    "filters": [                           // optional: the row's chips. Nothing is unloaded —
                                           //   marks of unnamed groups are hidden, and
                                           //   both the count and the legend keep counting everything
      { "id": "tous", "label": "Tous" },   //   a chip without "groups" is the way back to “all” (required)
      { "id": "dehors", "label": "Extérieur", "groups": ["Extérieur"] }
    ]                                      //   "groups" are keys of the "group" above: a value
                                           //   of "styles", a "key" of "rules", or "__other__"
  },
  "attribution": {                         // required — a dataset without publisher and license is not shown
    "publisher": "Atlasanté — GeoDAE",
    "licence": "Licence Ouverte 2.0",
    "url": "https://www.data.gouv.fr/datasets/geodae-base-nationale-des-defibrillateurs/",
    "text": "Défibrillateurs : GeoDAE — Atlasanté (Licence Ouverte 2.0)"   // the credit line
  }
}
```

`datasetManifestFaults()` lists **every** fault in a manifest;
`normalizeDatasetManifest()` fills in the defaults and freezes the result. A
normalized manifest revalidates as is: that is what makes storage and export
possible.

## What a dataset receives on the way in

The local GeoJSON loader (`localGeojson.js`), the one behind airports, dams,
ports and data centers: leader stems, ambient cards arbitrated on screen,
occlusion at the horizon, ground sampling, the click that selects and frames.
Three hooks open it up without it learning anything about the platforms:
`loadFeatures` (where the features come from), `cardCopy` (what a card says)
and `invalidate` (forget, so as to reload).

### What floats next to a mark

The shared host materializes at most **160 ambient entries per source**
(`LOCAL_OVERLAY_COHORT_LIMIT`). A dataset bigger than that therefore CANNOT
show one card per feature: what it shows is a sample of itself, drawn at full
card height, on top of the map. Measured on GeoDAE above Lyon: 1,176 features
in view, ~25 cards of seven lines each on screen, more than 60% of the viewport
covered by a 2% sample.

Beyond that threshold the box therefore switches to `label`: the **title
alone** floats, and the detail waits for the click — which opens the context
card with the whole row, not just the declared fields. Nothing is lost;
everything moves one step back. The leader stem is capped at 18 m in this
regime, for the same reason it is capped at 150 m above an airport: it lifts
the mark above the photorealistic mesh without turning, in a thousand copies,
into hatching over the city.

`feature.ambient` overrides the choice either way when the author knows better.

And what the doctrine (`docs/CARTOGRAPHY.md`) requires of a layer:

| Rule | What the box does |
|---|---|
| A5 · every cap is declared | the layer's row says *4 000 affichés sur 186 137 — plafond 4 000, premières lignes* (4,000 shown of 186,137 — cap 4,000, first rows) |
| D1 · a legend is mandatory where color carries a value | one entry per group with its count, or a single named flat color |
| E2 · the temporal regime is declared | `cadence` in the manifest → *instantané figé* (fixed snapshot) / age / feed |
| F6 · no layer at every altitude | `maxSpanDeg`: beyond it, the row says *rapprochez-vous* (move closer) as an instruction, not a failure |
| H1 · the edge of the data is stated | *n dans la vue* (n in view), *n objets, jeu entier* (n features, whole dataset), *n sans position* (n without position), *via relais* (via relay) |
| H3 · 20,000–30,000 features, the GeoJSON/tiles boundary | `maxFeatures` capped at 30,000 |
| A1 · never the same sign for measured and assumed | a guessed geometry is announced as such in the draft, before anything is drawn |

## Loaded for the view

A `scope: "viewport"` source is requested for the rectangle the camera is
looking at, widened by 20% so that a small jitter does not reload it, and
requested again when the view leaves that box — or when the previous answer
was capped and the reader has moved in by half. Three platforms can answer to
a bounding box:

- **data.gouv.fr** — the tabular API, in pages of 200 typed rows, with
  `<column>__greater` / `__less` on the position columns. The IRVE file is
  161 MB; the Paris view asks for 11,633 rows of it. A resource that was never
  indexed falls back to the raw file, under a 24 MB cap.
- **WFS** — `bbox=…,CRS:84`. `CRS:84` and not `EPSG:4326`: on the
  Géoplateforme, a lat/lon bounding box returns zero features where lon/lat
  returns four — measured.
- **Opendatasoft** — `where=in_bbox(field, lat1, lon1, lat2, lon2)` on the
  GeoJSON export.

## The `/api/plug` relay

The browser talks to the platforms directly. The relay is the fallback for
those that refuse an `Origin` header — INSEE answers 403 — and it is tried only
after a direct failure shaped like a CORS failure. It is narrow by
construction: GET, https, allowlisted hosts (`data.gouv.fr`, `geopf.fr`,
`ign.fr`, `opendatasoft.com`, `insee.fr`… — extensible through
`GEV_PLUG_HOSTS`), redirects followed by hand and re-checked, body capped at
24 MB, no client header forwarded, a one-hour disk cache served stale for a
week when upstream is down, behind the same access gate as every other route.

## What a plugged dataset does not receive — and why

- **A share-link token.** The token registry names only layers the code
  knows; a link that said “load this URL” would make another machine fetch
  whatever the first one typed. What travels is the manifest, as a file.
- **A place in the voice enumeration.** It is pinned by a test (sha256 over
  the tool). But the executor accepts any registered id: *allume
  ds-defibrillateurs-geodae* (turn on ds-defibrillateurs-geodae) works as soon
  as the row exists.
- **A choropleth, a prism, a grid.** The box draws points, lines and polygons
  where they are. A dataset that needs classification, a ratio to a population
  or an extrusion is a layer, and is built on `choroplethPrism.js`,
  `franceDepartements.js`, `geoMeshThinning.js` like the others.
- **A row in the address card.** The Address X-ray chains routes, not layers;
  its hook (`{id, label, question, needs, project}`) is the next workstream,
  not this one.

## How long it takes

Measured bench by bench in #113: from the search to the first marks, the
machine takes **1.7 s at the median** and up to 33 s at the 30,000-feature
cap — and the same measurement settled what a progress indicator is allowed to
show during that time, and what it is not allowed to invent. The benches are
the `measure:plug` commands below.

## Verify

```
npm test                                       # about sixty tests on the box, including every shipped manifest
npm run qa:datasets -- --url http://localhost:4173          # the catalog, inference, plug/unplug, the form, persistence
npm run qa:datasets -- --url http://localhost:4173 --deep   # + actually loading a data.gouv.fr dataset plugged in through the form, via the tabular API (16 checks)
# --shots for screenshots (slow under SwiftShader), --gpu to go through Metal

npm run measure:plug -- --verify 5                          # what the chain costs, platform by platform
npm run measure:plug:render -- --url http://localhost:4415 --gpu   # the same chain in the page, up to the first frame
```
