import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, 'node_modules/pdfjs-dist');
const output = join(root, '../../src/vendor/pdfjs');
const version = '6.2.108';
const npmIntegrity = 'sha512-YxFb+SQcodN2rnX9Tn3dHYlqfb7NjlzzfONPpJd+AKoKtUjEdevTfbC07d5TcczzOK6261auRkP/M8OBHs9vFQ==';
const files = [];

async function collect(directory, accept = () => true) {
  const result = [];
  for (const entry of await readdir(join(source, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await collect(path, accept));
    else if (accept(path)) result.push(path);
  }
  return result;
}

files.push(
  'LICENSE',
  'package.json',
  'build/pdf.mjs',
  'build/pdf.worker.mjs',
  'image_decoders/pdf.image_decoders.mjs',
  'web/pdf_viewer.css',
  'web/pdf_viewer.mjs',
  ...await collect('cmaps'),
  ...await collect('iccs'),
  ...await collect('standard_fonts'),
  ...await collect('web/images'),
  ...await collect('wasm', (path) => !/(?:quickjs|sandbox|qcms_nowasm)/iu.test(path)),
);
files.sort((left, right) => left.localeCompare(right));

const packageMetadata = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
if (packageMetadata.version !== version) throw new Error(`Expected pdfjs-dist ${version}, received ${packageMetadata.version}.`);

await rm(output, { recursive: true, force: true });
for (const file of files) {
  const destination = join(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(source, file), destination);
}

const readme = `# Vendored PDF.js runtime\n\nThis directory contains the browser-only generic distribution of Mozilla PDF.js used by \`CgPdfViewer\`.\n\n- Package: \`pdfjs-dist\`\n- Version: \`${version}\`\n- License: Apache-2.0 (see \`LICENSE\`)\n- Registry artifact: \`https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-${version}.tgz\`\n- npm integrity: \`${npmIntegrity}\`\n- Upstream commit/release: \`v${version}\`\n\nOnly runtime assets required by the component are checked in: the generic main and worker modules, viewer module/CSS/images, CMaps, standard fonts, ICC profiles, image decoder, and non-eval image-codec fallbacks. Source maps, the scripting sandbox, editor runtime, Node-only dependencies, and QuickJS eval assets are intentionally excluded.\n\n\`integrity-manifest.json\` records a SHA-256 digest for every checked-in vendor file. The test suite recalculates each digest to detect accidental or unauthorized changes. To upgrade, review the upstream release and security advisories, replace the files from a single npm artifact, update provenance here, and regenerate the manifest.\n`;
await writeFile(join(output, 'README.md'), readme);
files.push('README.md');
files.sort((left, right) => left.localeCompare(right));

const hashes = {};
for (const file of files) {
  hashes[file] = createHash('sha256').update(await readFile(join(output, file))).digest('hex');
}
await writeFile(join(output, 'integrity-manifest.json'), `${JSON.stringify({
  name: 'pdfjs-dist',
  version,
  source: `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-${version}.tgz`,
  npmIntegrity,
  files: hashes,
}, null, 2)}\n`);
