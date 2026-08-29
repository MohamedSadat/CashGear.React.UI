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
const expected = ['CG_FILTER_DEFAULT_LIMITS','CG_FILTER_NULL_VALUE','CG_FILTER_OPERATORS','CG_FILTER_OPERATOR_ORDINALS','CG_FILTER_OPERATOR_REGISTRY','CG_FILTER_PERIODS','CG_FILTER_VALUE_KIND_ORDINALS','CG_GRID_STATE_VERSION','CG_PAGER_DEFAULT_AUTO_INPUT_THRESHOLD','CG_PAGER_DEFAULT_NUMERIC_BUTTONS','CgAccordion','CgButton','CgCalendar','CgCheckBox','CgComboBox','CgConfirmationProvider','CgContextMenu','CgDateEdit','CgDateRangePicker','CgDropDownBox','CgDropDownButton','CgDrawer','CgField','CgFileUploader','CgFilterBuilder','CgFilterCodecError','CgFilterEvaluationError','CgFilterFieldRegistry','CgFilterOperatorRegistry','CgFilterPersistenceError','CgFlyout','CgFormLayout','CgFormLayoutGroup','CgFormLayoutItem','CgFormLayoutTabs','CgGrid','CgGridBrowserViewStore','CgGridFilterConfigurationError','CgGridViewConcurrencyError','CgIcon','CgKeyComboBox','CgLayoutBreakpoint','CgListBox','CgLoadingPanel','CgLookUpGrid','CgMaskedInput','CgMemo','CgMenu','CgNumericEdit','CgPager','CgPopup','CgProgressBar','CgRadio','CgRadioGroup','CgSearchBox','CgSpinEdit','CgSplitButton','CgSplitter','CgStepper','CgSwitch','CgTabs','CgTagBox','CgTextBox','CgToastProvider','CgToolbar','CgTreeView','CgWindow','areFiltersEquivalent','buildFilterSchemaSignature','calculateCustomGridSummaries','calculateGridSummaries','calculateNumericWindow','calculatePageCount','calculatePageSkip','calculatePageSkipChecked','calculateVisibleItemRange','captureFilterSavedView','clampPageIndex','combineFilters','compareDecimalText','compileFilterPredicate','createFilterEvaluationContext','createFilterValue','createGridDataRequest','createGridFilterRowCondition','createGridState','createGridXlsx','currentCivilDate','cx','decodeFilterNode','decodeGridDataRequest','defaultFilterOperator','deserializeFilterNode','deserializeFilterSavedView','downloadGridExport','encodeFilterNode','encodeGridDataRequest','enumerateFilterNodes','evaluateFilter','evaluateGridFilter','filterDepth','filterNodeCount','filterOperatorsForField','filterValueFromUnknown','formatFilter','gridFilterFields','gridFilterRegistry','gridFilterRowValue','hasFilterValue','isCivilDate','isValidFilterValue','loadFilterSavedView','mapFilterFieldIds','migrateGridFilterFields','normalizeFilterNode','normalizeGridFilter','normalizeGridState','normalizeNumericButtonCount','normalizePageCount','normalizePageSize','normalizePageSizeOptions','parseFilterValue','parsePagerDisplayNumber','preserveFirstItemPageIndex','processLocalGridData','processLocalGridDataAsync','providerGridSummaries','pruneFilterFields','pruneGridFilter','removeFilterField','removeFilterSource','replaceFilterRowConditions','resolveFilterPeriod','sanitizeGridExportFileName','savedViewState','serializeFilterNode','serializeFilterSavedView','shouldUsePagerInput','stableSortGridItems','toDisplayPageNumber','toPageIndex','useCgConfirmation','useCgContextMenuTarget','useCgId','useCgLayoutBreakpoint','useCgToast','useControllableState','validateFilter','validateGridFilter','valueCivilDate'];
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
