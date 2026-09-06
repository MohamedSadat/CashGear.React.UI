import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = '../../src/vendor/rich-text-editor';
await mkdir(output, { recursive: true });
const result = await build({
  entryPoints: ['editor.js'],
  outfile: `${output}/editor.js`,
  bundle: true,
  format: 'esm',
  minify: true,
  target: ['es2022'],
  legalComments: 'eof',
  metafile: true,
});
const roots = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
  const parts = input.split('/');
  const index = parts.lastIndexOf('node_modules');
  if (index >= 0) roots.add(parts.slice(0, index + (parts[index + 1].startsWith('@') ? 3 : 2)).join('/'));
}
let notices = 'Bundled runtime dependencies. Regenerate with npm ci && npm run build.\n';
for (const root of [...roots].sort()) {
  const pkg = JSON.parse(await readFile(`${root}/package.json`, 'utf8'));
  notices += `\n===== ${pkg.name} ${pkg.version} (${pkg.license}) =====\n`;
  for (const file of await readdir(root)) {
    if (/^(license|copying)(\.|$)/i.test(file)) notices += `${await readFile(path.join(root, file), 'utf8')}\n`;
  }
}
await writeFile(`${output}/THIRD-PARTY-NOTICES.txt`, notices);
const digest = async (file) => createHash('sha256').update(await readFile(`${output}/${file}`)).digest('hex');
const files = ['editor.js', 'THIRD-PARTY-NOTICES.txt'];
await writeFile(`${output}/integrity-manifest.json`, `${JSON.stringify({
  packages: { tiptap: '3.31.3', dompurify: '3.4.14', esbuild: '0.28.2' },
  files: await Promise.all(files.map(async (file) => ({ file, sha256: await digest(file) }))),
}, null, 2)}\n`);
