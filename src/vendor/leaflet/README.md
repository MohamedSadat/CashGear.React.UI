# Leaflet 1.9.4 assets

Source package: https://registry.npmjs.org/leaflet/-/leaflet-1.9.4.tgz

Bundled files are unmodified package LICENSE, package.json, dist/leaflet-src.esm.js, dist/leaflet.css and dist/images/*.png (the dist prefix is removed). Leaflet is distributed under BSD-2-Clause; see LICENSE.

integrity-manifest.json records SHA-256 digests of all redistributed upstream files. CgUtilityComponentsTests verifies the version and each digest. CgMap dynamically imports the ES module and stylesheet; no global L symbol or CDN script is required.

Run `npm ci && npm run build` from `vendor-src/leaflet` to reproduce the runtime files and integrity manifest from the locked upstream package. For an upgrade, update the pin and lockfile together, rebuild every runtime file, preserve the upstream license, and run the map browser tests. Do not update assets independently.
