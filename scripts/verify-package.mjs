import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = resolve('.');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const file of ['dist/index.js', 'dist/index.d.ts', 'dist/cashgear-ui.css']) assert.ok(existsSync(join(root, file)), `Missing ${file}`);
assert.equal(manifest.exports['./styles.css'], './dist/cashgear-ui.css');
assert.deepEqual(Object.keys(manifest.exports).sort(), ['.', './package.json', './styles.css']);

const allFiles = [];
function collect(directory) { for (const name of readdirSync(directory)) { const path = join(directory, name); if (statSync(path).isDirectory()) collect(path); else allFiles.push(path); } }
collect(join(root, 'dist'));
assert.ok(allFiles.some((file) => file.endsWith('.d.ts.map')), 'Declaration maps were not generated');
const js = allFiles.filter((file) => file.endsWith('.js')).map((file) => readFileSync(file, 'utf8')).join('\n');
assert.match(js, /from\s+["']react(?:\/jsx-runtime)?["']/, 'React imports should remain external');
assert.doesNotMatch(js, /react\.production|minified React error/i, 'React implementation appears bundled');

const runtime = await import(`${pathToFileURL(join(root, 'dist/index.js')).href}?verify=${Date.now()}`);
const expected = ['CgButton', 'CgCheckBox', 'CgComboBox', 'CgField', 'CgIcon', 'CgListBox', 'CgLoadingPanel', 'CgMemo', 'CgNumericEdit', 'CgProgressBar', 'CgRadio', 'CgRadioGroup', 'CgSearchBox', 'CgSpinEdit', 'CgSwitch', 'CgTagBox', 'CgTextBox', 'cx', 'useCgId', 'useControllableState'];
assert.deepEqual(Object.keys(runtime).sort(), expected.sort());

const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'npm_execpath is required; run this verifier through npm');
const packed = spawnSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, npm_config_cache: join(root, 'node_modules', '.cache', 'npm-verify') },
});
assert.equal(packed.status, 0, packed.stderr || packed.stdout);
const packResult = JSON.parse(packed.stdout);
const packedPaths = new Set(packResult[0].files.map((entry) => entry.path));
for (const file of ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts', 'dist/cashgear-ui.css']) assert.ok(packedPaths.has(file), `Tarball missing ${file}`);
console.log(`Package verified: ${runtime.CgButton ? expected.length : 0} runtime exports, ${packedPaths.size} packed files.`);
