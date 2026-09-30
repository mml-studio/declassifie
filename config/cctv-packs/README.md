# Camera packs

One JSON file here adds one city's public cameras to the « Caméras publiques »
layer, beside the live open-data packs (Austin, Caltrans, TfL, Grand Lyon).
The server reads every `*.json` in this folder when it refreshes its camera
catalog (every 15 minutes); no code changes.

A pack is not done until its source has its row in
[`DATA_SOURCES.md`](../../DATA_SOURCES.md), with the licence that allows the
frames to be shown.

## Format

```json
{
  "id": "rennes-trafic",
  "name": "Rennes Métropole — traffic cameras",
  "maxCameras": 100,
  "credit": {
    "text": "Rennes Métropole",
    "url": "https://data.rennesmetropole.fr",
    "license": "Licence Ouverte 2.0",
    "licenseUrl": "https://www.etalab.gouv.fr/licence-ouverte-open-licence"
  },
  "defaults": { "city": "Rennes", "cityId": "rennes", "pitchDeg": -20, "fovDeg": 60, "rangeM": 200, "mountHeightM": 8 },
  "cameras": [
    {
      "id": "gare",
      "name": "Gare — boulevard Solférino",
      "lat": 48.1035,
      "lon": -1.6723,
      "headingDeg": 12,
      "snapshotUrl": "https://…/gare.jpg"
    }
  ]
}
```

- **`id`**: 2-40 lowercase letters, digits or dashes. Camera ids are prefixed
  with it (`rennes-trafic-gare`) unless they already start with it.
- **`credit`**: the publisher and the licence, shown in « Data attribution »
  whenever the pack's cameras are in the catalog. Links must be http(s).
- **`defaults`**: any camera field, applied where a camera leaves it out.
- **`cameras[]`**: `id`, `lat`, `lon`, and a frame URL — `snapshotUrl` for a
  still, `url` with `feedType` (`image`, `mjpeg`, `mp4`, `hls`) for anything
  else. The pose fields are optional: `headingDeg` (compass bearing the camera
  looks along), `headingConfidence` (`high`, `medium`, `low`), `pitchDeg`,
  `fovDeg`, `rangeM`, `mountHeightM`, `groundElevationM`, and
  `poseSource: "curated"` for a pose set by hand. `upstreamCadenceMs` says how
  often the publisher renews its still.
- **`maxCameras`**: how many cameras the pack keeps (default 200, never more
  than 600). **`enabled: false`** keeps the file without loading it.

Frame URLs must be public http(s) hosts: a private or loopback address is
rejected, because the server fetches them. A camera the server cannot read is
skipped with its reason in the server log; the rest of the pack loads.

A bare array of cameras, upstream God's Eye View's
`config/cctv_sources.<city>.json` format, also works: the file name gives the
pack id and the first camera's `provider` and `license` credit the pack.

## Turning packs off

- `CCTV_PACKS_DISABLED=rennes-trafic,other` skips the packs listed.
- `CCTV_PACKS_ENABLED=0` skips them all.

`CCTV_SOURCES_FILE` is a different route: one file that REPLACES the live
packs, for a development box that wants only its own cameras.
