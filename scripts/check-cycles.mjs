import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';

const sourceRoot = resolve('src');
const extensions = ['.ts', '.tsx'];
const files = [];
function collect(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) collect(path);
    else if (extensions.includes(extname(path)) && !/\.(test|stories)\.tsx?$/.test(path) && !path.endsWith('.d.ts')) files.push(normalize(path));
  }
}
collect(sourceRoot);
const known = new Set(files);

function resolveImport(from, specifier) {
  if (!specifier.startsWith('.')) return undefined;
  const base = resolve(dirname(from), specifier);
  const candidates = [base, ...extensions.map((extension) => `${base}${extension}`), ...extensions.map((extension) => join(base, `index${extension}`))];
  return candidates.map(normalize).find((candidate) => known.has(candidate));
}

const graph = new Map(files.map((file) => {
  const source = readFileSync(file, 'utf8');
  const imports = [...source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)]
    .map((match) => resolveImport(file, match[1]))
    .filter(Boolean);
  return [file, imports];
}));
const visiting = new Set();
const visited = new Set();
const path = [];
function visit(file) {
  if (visiting.has(file)) {
    const start = path.indexOf(file);
    throw new Error(`Relative-import cycle:\n${[...path.slice(start), file].map((item) => `  ${relative(sourceRoot, item)}`).join('\n')}`);
  }
  if (visited.has(file)) return;
  visiting.add(file); path.push(file);
  for (const dependency of graph.get(file) ?? []) visit(dependency);
  path.pop(); visiting.delete(file); visited.add(file);
}
for (const file of files) visit(file);
console.log(`No relative-import cycles in ${files.length} source modules.`);
