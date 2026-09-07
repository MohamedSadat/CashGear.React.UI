# Vendored PDF.js runtime

This directory contains the browser-only generic distribution of Mozilla PDF.js used by `CgPdfViewer`.

- Package: `pdfjs-dist`
- Version: `6.2.108`
- License: Apache-2.0 (see `LICENSE`)
- Registry artifact: `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.2.108.tgz`
- npm integrity: `sha512-YxFb+SQcodN2rnX9Tn3dHYlqfb7NjlzzfONPpJd+AKoKtUjEdevTfbC07d5TcczzOK6261auRkP/M8OBHs9vFQ==`
- Upstream commit/release: `v6.2.108`

Only runtime assets required by the component are checked in: the generic main and worker modules, viewer module/CSS/images, CMaps, standard fonts, ICC profiles, image decoder, and non-eval image-codec fallbacks. Source maps, the scripting sandbox, editor runtime, Node-only dependencies, and QuickJS eval assets are intentionally excluded.

`integrity-manifest.json` records a SHA-256 digest for every checked-in vendor file. The test suite recalculates each digest to detect accidental or unauthorized changes. To upgrade, review the upstream release and security advisories, replace the files from a single npm artifact, update provenance here, and regenerate the manifest.
