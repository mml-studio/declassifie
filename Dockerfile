# Surplomb — hosted image.
#
# The app is not a static bundle: vite.config.js carries ~35 middleware
# proxies that broker keys, cache upstream responses on disk and hold the AIS
# websocket. So the runtime is `vite preview` (built bundle + those proxies),
# not a file server — which is why the dev dependencies stay in the image.
FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173

WORKDIR /app

# Lille posts its permit decisions as scans: the daily sweep reads them by OCR
# (scripts/lib/pdfOcr.mjs) with poppler's renderer and Tesseract's French.
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-fra \
 && rm -rf /var/lib/apt/lists/*

# Deps first: this layer only rebuilds when the lockfile moves.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

# GOOGLE_MAPS_API_KEY, CESIUM_ION_TOKEN and ARCGIS_API_KEY are inlined into the
# browser bundle at build time (see the `define` block in vite.config.js), so
# they have to be present here, not only at runtime.
ARG GOOGLE_MAPS_API_KEY=""
ARG CESIUM_ION_TOKEN=""
ARG ARCGIS_API_KEY=""
# The one absolute URL in the bundle: the social card's image. Unset, the build
# points it at the public site — correct for the hosted image, and the reason a
# self-hosted one needs a way to say otherwise. See `absolutizeSocialUrls()`.
ARG GEV_PUBLIC_ORIGIN=""
RUN GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY" CESIUM_ION_TOKEN="$CESIUM_ION_TOKEN" \
    ARCGIS_API_KEY="$ARCGIS_API_KEY" GEV_PUBLIC_ORIGIN="$GEV_PUBLIC_ORIGIN" npm run build

EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4173)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
