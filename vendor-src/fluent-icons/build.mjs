// Regenerates src/vendor/fluent-icons from the pinned @fluentui/svg-icons package.
// Usage: `npm ci && node build.mjs`, or `node build.mjs <path to an unpacked package>`.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.1.345';
const root = dirname(fileURLToPath(import.meta.url));
const source = process.argv[2] ? resolve(process.argv[2]) : join(root, 'node_modules/@fluentui/svg-icons');
const output = join(root, '../../src/vendor/fluent-icons');

/** CashGear icon name -> Fluent icon, all from the 20 px regular set. */
const ICONS = {
  // Font
  'text-bold': 'text_bold',
  'text-italic': 'text_italic',
  'text-underline': 'text_underline',
  'text-underline-double': 'text_underline_double',
  'text-strikethrough': 'text_strikethrough',
  'text-subscript': 'text_subscript',
  'text-superscript': 'text_superscript',
  'text-font': 'text_font',
  'text-font-size': 'text_font_size',
  'font-size-increase': 'font_increase',
  'font-size-decrease': 'font_decrease',
  'text-color': 'text_color',
  'fill-color': 'color_fill',
  'line-color': 'color_line',
  'clear-formatting': 'text_clear_formatting',
  'format-painter': 'paint_brush',
  // Alignment
  'align-left': 'text_align_left',
  'align-center': 'text_align_center',
  'align-right': 'text_align_right',
  'align-justify': 'text_align_justify',
  'align-top': 'align_top',
  'align-middle': 'align_center_vertical',
  'align-bottom': 'align_bottom',
  'text-wrap': 'text_wrap',
  'text-rotate': 'text_direction_rotate_90_right',
  // Cells, rows and columns
  'cells-merge': 'table_cells_merge',
  'cells-split': 'table_cells_split',
  'row-insert': 'table_insert_row',
  'row-delete': 'table_delete_row',
  'row-height': 'table_resize_row',
  'column-insert': 'table_insert_column',
  'column-delete': 'table_delete_column',
  'column-width': 'table_resize_column',
  'autofit-height': 'auto_fit_height',
  'autofit-width': 'auto_fit_width',
  'freeze-panes': 'table_freeze_column_and_row',
  'freeze-top-row': 'table_freeze_row',
  'freeze-first-column': 'table_freeze_column',
  'freeze-off': 'table_freeze_column_and_row_dismiss',
  gridlines: 'grid',
  // Borders
  'border-all': 'border_all',
  'border-outside': 'border_outside',
  'border-outside-thick': 'border_outside_thick',
  'border-inside': 'border_inside',
  'border-none': 'border_none',
  'border-top': 'border_top',
  'border-bottom': 'border_bottom',
  'border-bottom-thick': 'border_bottom_thick',
  'border-bottom-double': 'border_bottom_double',
  'border-left': 'border_left',
  'border-right': 'border_right',
  'border-left-right': 'border_left_right',
  'border-top-bottom': 'border_top_bottom',
  'border-top-bottom-thick': 'border_top_bottom_thick',
  'border-top-bottom-double': 'border_top_bottom_double',
  // Number formats
  'number-format': 'number_symbol',
  'number-currency': 'currency_dollar_euro',
  'number-percent': 'text_percent',
  'number-thousands': 'comma',
  'decimal-increase': 'decimal_arrow_left',
  'decimal-decrease': 'decimal_arrow_right',
  calendar: 'calendar_ltr',
  clock: 'clock',
  // Sort and filter
  sort: 'arrow_sort',
  'sort-ascending': 'text_sort_ascending',
  'sort-descending': 'text_sort_descending',
  filter: 'filter',
  'filter-clear': 'filter_dismiss',
  // Charts
  'chart-column': 'data_bar_vertical',
  'chart-bar': 'data_bar_horizontal',
  'chart-line': 'data_line',
  'chart-area': 'data_area',
  'chart-pie': 'data_pie',
  'chart-donut': 'data_usage',
  'chart-scatter': 'data_scatter',
  'chart-histogram': 'data_histogram',
  'chart-waterfall': 'data_waterfall',
  'chart-funnel': 'data_funnel',
  'chart-treemap': 'data_treemap',
  'chart-sunburst': 'data_sunburst',
  'chart-box-whisker': 'data_whisker',
  'chart-sparkline': 'data_trending',
  'chart-combo': 'chart_multiple',
  // Tables and styles
  table: 'table_simple',
  'table-add': 'table_add',
  'table-style': 'table_edit',
  'cell-style': 'table_cell_edit',
  'conditional-format': 'table_lightning',
  'data-validation': 'table_simple_checkmark',
  // Commands
  paste: 'clipboard_paste',
  cut: 'cut',
  copy: 'copy',
  undo: 'arrow_undo',
  redo: 'arrow_redo',
  eraser: 'eraser',
  autosum: 'autosum',
  formula: 'math_formula',
  'fill-down': 'arrow_download',
  add: 'add',
  delete: 'delete',
  replace: 'arrow_swap',
  save: 'save',
  open: 'folder_open',
  workbook: 'document_table',
  image: 'image',
  link: 'link',
  comment: 'comment',
  // Protection, notes, error checking, charts, pictures and key tips
  lock: 'lock_closed',
  'shield-lock': 'shield_lock',
  'comment-multiple': 'comment_multiple',
  'error-check': 'error_circle',
  trendline: 'arrow_trending_lines',
  crop: 'crop',
  'image-edit': 'image_edit',
  keyboard: 'keyboard',
  calculator: 'calculator',
  settings: 'settings',
  more: 'more_horizontal',
  // Document blocks
  text: 'text_t',
  paragraph: 'text_paragraph',
  'heading-1': 'text_header_1',
  'heading-2': 'text_header_2',
  'heading-3': 'text_header_3',
  todo: 'checkbox_checked',
  toggle: 'triangle_right',
  quote: 'text_quote',
  callout: 'lightbulb',
  code: 'code',
  divider: 'line_horizontal_1',
  file: 'attach',
  page: 'document_text',
  'page-add': 'document_add',
  'page-link': 'document_link',
  database: 'database',
  toc: 'text_bullet_list_tree',
  embed: 'code_block',
  chart: 'data_bar_vertical_ascending',
  board: 'grid_kanban',
  bookmark: 'bookmark',
  'linked-view': 'window_multiple',
  sync: 'arrow_sync',
  // Views, people and editing
  'calendar-month': 'calendar_month',
  'view-list': 'apps_list',
  gallery: 'image_multiple',
  timeline: 'timeline',
  'drag-handle': 're_order_dots_vertical',
  emoji: 'emoji',
  'emoji-add': 'emoji_add',
  mention: 'mention',
  person: 'person',
  people: 'people',
  tag: 'tag',
  rename: 'rename',
  color: 'color',
  highlight: 'highlight',
  folder: 'folder',
  upload: 'arrow_upload',
};

/**
 * Icons Fluent draws twice, once for each writing direction (a list's bullets or numbers, and an
 * indent's arrow, stay at the line's start). The left-to-right drawing is the icon's path; the right-to-left one is drawn
 * instead inside a right-to-left container.
 */
const DIRECTIONAL = {
  'list-bullet': ['text_bullet_list_ltr', 'text_bullet_list_rtl'],
  'list-number': ['text_number_list_ltr', 'text_number_list_rtl'],
  'list-todo': ['task_list_ltr', 'task_list_rtl'],
  'indent-increase': ['text_indent_increase_ltr', 'text_indent_increase_rtl'],
  'indent-decrease': ['text_indent_decrease_ltr', 'text_indent_decrease_rtl'],
};

/** The colour bar under an icon, drawn separately so it can take the current colour. */
const ACCENTS = {
  'text-color': 'text_color_accent_20_filled',
  'fill-color': 'color_fill_accent_20_regular',
  'line-color': 'color_line_accent_20_regular',
};

/** Fluent has no inside-only line icons, so these add one line to its dotted `border_none` box. */
const DERIVED = {
  'border-inside-horizontal': { base: 'border_none', add: 'M5.5 9.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1 0-1z' },
  'border-inside-vertical': { base: 'border_none', add: 'M10 5a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-1 0v-9A.5.5 0 0 1 10 5z' },
};

const metadata = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
if (metadata.name !== '@fluentui/svg-icons' || metadata.version !== VERSION) {
  throw new Error(`Expected @fluentui/svg-icons ${VERSION}, received ${metadata.name} ${metadata.version}.`);
}
if (metadata.license !== 'MIT') throw new Error(`Expected an MIT package, received ${metadata.license}.`);

/** Accepts only the plain path markup Fluent ships, so nothing else can reach the inline SVG. */
async function readPath(file) {
  const svg = (await readFile(join(source, 'icons', file), 'utf8')).trim();
  const match = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="20" height="20" viewBox="0 0 20 20">((?:<path d="[^"]+"\/>)+)<\/svg>$/u.exec(svg);
  if (!match) throw new Error(`${file} is not a plain 20 px path icon.`);
  const data = [...match[1].matchAll(/ d="([^"]+)"/gu)].map((path) => path[1]).join(' ');
  if (!/^[MmLlHhVvCcSsQqTtAaZz0-9 ,.-]+$/u.test(data)) throw new Error(`${file} has unexpected path data.`);
  return data;
}

const paths = {};
for (const [name, fluent] of Object.entries(ICONS)) paths[name] = await readPath(`${fluent}_20_regular.svg`);
for (const [name, { base, add }] of Object.entries(DERIVED)) paths[name] = `${await readPath(`${base}_20_regular.svg`)} ${add}`;
const rtlPaths = {};
for (const [name, [ltr, rtl]] of Object.entries(DIRECTIONAL)) {
  paths[name] = await readPath(`${ltr}_20_regular.svg`);
  rtlPaths[name] = await readPath(`${rtl}_20_regular.svg`);
}
const accents = {};
for (const [name, file] of Object.entries(ACCENTS)) accents[name] = await readPath(`${file}.svg`);

const names = Object.keys(paths);
const property = (name) => (/^[a-z]+$/u.test(name) ? name : `'${name}'`);
const entries = (record) => Object.entries(record).map(([name, data]) => `  ${property(name)}: '${data}',`).join('\n');
const generated = `// Generated by vendor-src/fluent-icons/build.mjs from @fluentui/svg-icons ${VERSION} (MIT). Do not edit.
export type FluentIconName =
${names.map((name) => `  | '${name}'`).join('\n')};

export type FluentAccentIconName = ${Object.keys(accents).map((name) => `'${name}'`).join(' | ')};

export const fluentIconPaths: Readonly<Record<FluentIconName, string>> = {
${entries(paths)}
};

export const fluentIconAccentPaths: Readonly<Record<FluentAccentIconName, string>> = {
${entries(accents)}
};

export type FluentDirectionalIconName = ${Object.keys(rtlPaths).map((name) => `'${name}'`).join(' | ')};

/** The right-to-left drawing of the icons Fluent draws once for each direction. */
export const fluentIconRtlPaths: Readonly<Record<FluentDirectionalIconName, string>> = {
${entries(rtlPaths)}
};
`;

await mkdir(output, { recursive: true });
await writeFile(join(output, 'icons.ts'), generated);
await copyFile(join(root, 'LICENSE'), join(output, 'LICENSE'));

const sha256 = async (file) => createHash('sha256').update(await readFile(join(output, file))).digest('hex');
await writeFile(join(output, 'integrity-manifest.json'), `${JSON.stringify({
  package: '@fluentui/svg-icons',
  version: VERSION,
  source: `https://registry.npmjs.org/@fluentui/svg-icons/-/svg-icons-${VERSION}.tgz`,
  licenseSource: 'https://github.com/microsoft/fluentui-system-icons/blob/main/LICENSE',
  icons: names.length,
  files: await Promise.all(['icons.ts', 'LICENSE'].map(async (file) => ({ file, sha256: await sha256(file) }))),
}, null, 2)}\n`);
console.log(`Wrote ${names.length} icons, ${generated.length} bytes.`);
