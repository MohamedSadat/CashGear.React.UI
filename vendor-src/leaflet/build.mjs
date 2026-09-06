import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, 'node_modules/leaflet');
const output = join(root, '../../src/vendor/leaflet');
const files = [
  ['dist/images/layers-2x.png', 'images/layers-2x.png'],
  ['dist/images/layers.png', 'images/layers.png'],
  ['dist/images/marker-icon-2x.png', 'images/marker-icon-2x.png'],
  ['dist/images/marker-icon.png', 'images/marker-icon.png'],
  ['dist/images/marker-shadow.png', 'images/marker-shadow.png'],
  ['dist/leaflet-src.esm.js', 'leaflet-src.esm.js'],
  ['dist/leaflet.css', 'leaflet.css'],
  ['LICENSE', 'LICENSE'],
  ['package.json', 'package.json'],
];

const packageMetadata = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
if (packageMetadata.version !== '1.9.4') throw new Error(`Expected Leaflet 1.9.4, received ${packageMetadata.version}.`);

for (const [sourcePath, outputPath] of files) {
  const destination = join(output, outputPath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(source, sourcePath), destination);
}

const sha256 = async (path) => createHash('sha256').update(await readFile(join(output, path))).digest('hex');
await writeFile(join(output, 'integrity-manifest.json'), `${JSON.stringify({
  package: 'leaflet',
  files: await Promise.all(files.map(async ([, file]) => ({ file, sha256: await sha256(file) }))),
  source: 'https://registry.npmjs.org/leaflet/-/leaflet-1.9.4.tgz',
  version: '1.9.4',
}, null, 2)}\n`);
