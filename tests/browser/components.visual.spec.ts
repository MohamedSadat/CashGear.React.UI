import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

const primaryStories = [
  ['icon', 'phase-1-2-icon--registry'],
  ['button', 'phase-1-2-button--intent-appearance-and-size'],
  ['field', 'phase-1-2-field--default'],
  ['text-box', 'phase-1-2-textbox--controlled'],
  ['memo', 'phase-1-2-memo--controlled'],
  ['check-box', 'phase-1-2-checkbox--controlled-and-uncontrolled'],
  ['switch', 'phase-1-2-switch--controlled-and-uncontrolled'],
  ['radio', 'phase-1-2-radio--native-group'],
  ['radio-group', 'phase-1-2-radiogroup--controlled-and-uncontrolled'],
  ['numeric-edit', 'phase-1-2-numericedit--controlled-and-uncontrolled'],
  ['spin-edit', 'phase-1-2-spinedit--controlled-and-uncontrolled'],
  ['search-box', 'phase-1-2-searchbox--controlled-loading-and-minimum'],
  ['loading-panel', 'phase-1-2-loadingpanel--controlled-blocking-overlay'],
  ['progress-bar', 'phase-1-2-progressbar--determinate-sizes-and-intents'],
  ['combo-box', 'phase-3-combobox--controlled-local-selection'],
  ['list-box', 'phase-4-listbox--default'],
  ['tag-box', 'phase-5-tagbox--default'],
  ['drop-down-box', 'phase-6-dropdownbox--default'],
  ['key-combo-box', 'phase-7-keycombobox--default'],
  ['date-edit', 'phase-8-dateedit--default'],
] as const;

for (const [name, story] of primaryStories) {
  test(`${name} primary`, async ({ page }) => {
    await openStory(page, story);
    await expect(page).toHaveScreenshot(`${name}-primary.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

const rtlStories = [
  ['icon', 'phase-1-2-icon--logical-rtl'],
  ['button', 'phase-1-2-button--arabic-rtl'],
  ['field', 'phase-1-2-field--disabled-read-only-and-arabic'],
  ['check-box', 'phase-1-2-checkbox--arabic-rtl'],
  ['text-box', 'phase-1-2-textbox--arabic-rtl'],
  ['memo', 'phase-1-2-memo--states-and-arabic'],
  ['switch', 'phase-1-2-switch--states-sizes-and-arabic'],
  ['radio', 'phase-1-2-radio--states-sizes-and-arabic'],
  ['radio-group', 'phase-1-2-radiogroup--arabic-rtl'],
  ['numeric-edit', 'phase-1-2-numericedit--arabic-rtl-and-drafts'],
  ['spin-edit', 'phase-1-2-spinedit--arabic-rtl'],
  ['search-box', 'phase-1-2-searchbox--states-and-arabic-rtl'],
  ['progress-bar', 'phase-1-2-progressbar--arabic-rtl'],
  ['loading-panel', 'phase-1-2-loadingpanel--indicators-and-inline'],
  ['combo-box', 'phase-3-combobox--arabic-rtl'],
  ['list-box', 'phase-4-listbox--arabic-rtl'],
  ['tag-box', 'phase-5-tagbox--arabic-rtl'],
  ['drop-down-box', 'phase-6-dropdownbox--arabic-rtl'],
  ['date-edit', 'phase-8-dateedit--arabic-rtl'],
] as const;

for (const [name, story] of rtlStories) {
  test(`${name} Arabic RTL`, async ({ page }) => {
    await openStory(page, story, 'theme:light;density:comfortable;direction:rtl');
    await expect(page).toHaveScreenshot(`${name}-arabic-rtl.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

const darkCompactStories = [
  ['button', 'phase-1-2-button--intent-appearance-and-size'],
  ['text-box', 'phase-1-2-textbox--states-and-sizes'],
  ['combo-box', 'phase-3-combobox--states-and-validation'],
  ['loading-panel', 'phase-1-2-loadingpanel--indicators-and-inline'],
  ['progress-bar', 'phase-1-2-progressbar--determinate-sizes-and-intents'],
  ['list-box', 'phase-4-listbox--dark-compact'],
  ['tag-box', 'phase-5-tagbox--dark-compact'],
  ['drop-down-box', 'phase-6-dropdownbox--dark-compact'],
  ['date-edit', 'phase-8-dateedit--dark-compact'],
] as const;

for (const [name, story] of darkCompactStories) {
  test(`${name} dark compact`, async ({ page }) => {
    await openStory(page, story, 'theme:dark;density:compact;direction:ltr');
    await expect(page).toHaveScreenshot(`${name}-dark-compact.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

test('open ComboBox popup', async ({ page }) => {
  await openStory(page, 'phase-3-combobox--keyboard-and-long-content');
  await page.getByRole('combobox', { name: 'Keyboard customer' }).press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page).toHaveScreenshot('combo-box-open.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('remote ComboBox minimum, loading, results, and error states', async ({ page }) => {
  await openStory(page, 'phase-3-combobox--remote-loading-minimum-and-error');
  const comboBox = page.getByRole('combobox', { name: 'Remote customer' });

  await comboBox.fill('c');
  await expect(page.getByText('Type at least 2 characters to search.')).toBeVisible();
  await expect(page).toHaveScreenshot('combo-box-remote-minimum.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });

  await comboBox.fill('contoso');
  await expect(page.getByText('Loading…')).toBeVisible();
  await expect(page).toHaveScreenshot('combo-box-remote-loading.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  await expect(page.getByRole('option', { name: /Contoso Retail/ })).toBeVisible();
  await expect(page).toHaveScreenshot('combo-box-remote-results.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });

  await comboBox.fill('error');
  await expect(page.getByText('Unable to load results.')).toBeVisible();
  await expect(page).toHaveScreenshot('combo-box-remote-error.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('ListBox columns and groups', async ({ page }) => {
  await openStory(page, 'phase-4-listbox--columns-groups-and-templates');
  await expect(page).toHaveScreenshot('list-box-columns-groups.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('ListBox filtered Select All', async ({ page }) => {
  await openStory(page, 'phase-4-listbox--checkboxes-and-filtered-select-all');
  await page.getByRole('checkbox', { name: 'Select all visible items' }).click();
  await expect(page).toHaveScreenshot('list-box-filtered-select-all.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('ListBox virtual window', async ({ page }) => {
  await openStory(page, 'phase-4-listbox--virtual-large-data');
  const listbox = page.getByRole('listbox', { name: 'Virtual warehouses' });
  await listbox.evaluate((element) => {
    const viewport = element.parentElement;
    if (viewport) {
      viewport.scrollTop = 12_000;
      viewport.dispatchEvent(new Event('scroll'));
    }
  });
  await expect(page).toHaveScreenshot('list-box-virtual.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('open TagBox popup', async ({ page }) => {
  await openStory(page, 'phase-5-tagbox--local-search-and-keyboard');
  await page.getByRole('combobox', { name: 'Search customers' }).press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page).toHaveScreenshot('tag-box-open.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('TagBox maximum and custom tags', async ({ page }) => {
  await openStory(page, 'phase-5-tagbox--maximum-and-custom-tags');
  await page.getByRole('combobox', { name: 'Approval recipients' }).press('ArrowDown');
  await expect(page).toHaveScreenshot('tag-box-maximum-custom.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('remote TagBox minimum, loading, results, and error states', async ({ page }) => {
  await openStory(page, 'phase-5-tagbox--remote-loading-minimum-and-error');
  const tagBox = page.getByRole('combobox', { name: 'Remote customers' });

  await tagBox.fill('c');
  await expect(page.getByText('Type at least 2 characters to search.')).toBeVisible();
  await expect(page).toHaveScreenshot('tag-box-remote-minimum.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });

  await tagBox.fill('contoso');
  await expect(page.getByText('Loading…')).toBeVisible();
  await expect(page).toHaveScreenshot('tag-box-remote-loading.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  await expect(page.getByRole('option', { name: /Contoso Retail/u })).toBeVisible();
  await expect(page).toHaveScreenshot('tag-box-remote-results.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });

  await tagBox.fill('error');
  await expect(page.getByText('Unable to load results.')).toBeVisible();
  await expect(page).toHaveScreenshot('tag-box-remote-error.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('open DropDownBox popup', async ({ page }) => {
  await openStory(page, 'phase-6-dropdownbox--immediate-list-box-selection');
  await page.getByRole('combobox', { name: 'Immediate customer' }).click();
  await expect(page.getByRole('dialog', { name: 'Dropdown content' })).toBeVisible();
  await expect(page).toHaveScreenshot('drop-down-box-open.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('DropDownBox explicit pending state', async ({ page }) => {
  await openStory(page, 'phase-6-dropdownbox--explicit-tag-box-selection');
  await page.getByRole('combobox', { name: 'Explicit customer set' }).click();
  const tagBox = page.getByRole('combobox', { name: 'Pending customers' });
  await tagBox.fill('Contoso');
  await page.getByRole('option', { name: /Contoso Retail/u }).click();
  await tagBox.press('Escape');
  await expect(page.getByText('Unapplied selection')).toBeVisible();
  await expect(page).toHaveScreenshot('drop-down-box-explicit-pending.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

for (const [state, story] of [
  ['loading', 'phase-6-dropdownbox--loading-state'],
  ['empty', 'phase-6-dropdownbox--empty-state'],
  ['error', 'phase-6-dropdownbox--error-state'],
] as const) {
  test(`DropDownBox ${state} state`, async ({ page }) => {
    await openStory(page, story);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveScreenshot(`drop-down-box-${state}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

for (const [name, story, globals, narrow] of [
  ['phase-12-tree-basic', 'phase-12-treeview--nested-descriptors', undefined, false],
  ['phase-12-tree-selected-expanded', 'phase-12-treeview--selected-expanded', undefined, false],
  ['phase-12-tree-recursive-mixed', 'phase-12-treeview--recursive-checking', undefined, false],
  ['phase-12-tree-filtered', 'phase-12-treeview--filtering', undefined, false],
  ['phase-12-tree-disabled-readonly', 'phase-12-treeview--disabled-read-only', undefined, false],
  ['phase-12-tree-dark-compact', 'phase-12-treeview--dark-compact', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-12-tree-arabic-rtl-narrow', 'phase-12-treeview--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', true],
  ['phase-12-tree-empty', 'phase-12-treeview--empty-tree', undefined, false],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 680 });
    await openStory(page, story, globals);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

for (const [name, story, globals, narrow] of [
  ['phase-17-fileuploader-paused-recovery', 'phase-17-fileuploader--paused-recovery', undefined, false],
  ['phase-17-fileuploader-disabled-readonly', 'phase-17-fileuploader--disabled-and-read-only', undefined, false],
  ['phase-17-fileuploader-dark-compact', 'phase-17-fileuploader--dark-compact', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-17-fileuploader-rtl', 'phase-17-fileuploader--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', false],
  ['phase-17-fileuploader-narrow', 'phase-17-fileuploader--narrow-layout', undefined, true],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 720 });
    await openStory(page, story, globals);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

test('phase-17-fileuploader basic uploaded visual', async ({ page }) => {
  await openStory(page, 'phase-17-fileuploader--basic-automatic');
  await page.locator('input[type="file"]').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invoice') });
  await expect(page.getByText('Uploaded', { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('phase-17-fileuploader-basic.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('phase-17-fileuploader manual queue visual', async ({ page }) => {
  await openStory(page, 'phase-17-fileuploader--manual-upload');
  await page.locator('input[type="file"]').setInputFiles({ name: 'evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('evidence') });
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('phase-17-fileuploader-manual.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('phase-17-fileuploader multiple progress visual', async ({ page }) => {
  await openStory(page, 'phase-17-fileuploader--multiple-progress');
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'large-ledger.csv', mimeType: 'text/csv', buffer: Buffer.alloc(200, 1) },
    { name: 'small-ledger.csv', mimeType: 'text/csv', buffer: Buffer.alloc(40, 2) },
  ]);
  await expect(page.getByText('Uploading…').first()).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(2);
  await expect(page).toHaveScreenshot('phase-17-fileuploader-progress.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('phase-17-fileuploader validation and failure visual', async ({ page }) => {
  await openStory(page, 'phase-17-fileuploader--validation-and-failure');
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') },
    { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invoice') },
  ]);
  await expect(page.getByText('The storage service rejected this file.', { exact: true })).toBeVisible();
  await expect(page.getByText('Only .pdf files are allowed.', { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('phase-17-fileuploader-validation.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

for (const [name, story, globals, narrow] of [
  ['phase-18-splitter-horizontal-live', 'phase-18-splitter--horizontal-live', undefined, false],
  ['phase-18-splitter-vertical-deferred', 'phase-18-splitter--vertical-deferred', undefined, false],
  ['phase-18-splitter-collapsed-rails', 'phase-18-splitter--collapsed-rails', undefined, false],
  ['phase-18-splitter-controlled-persistence', 'phase-18-splitter--controlled-persistence', undefined, false],
  ['phase-18-splitter-arabic-rtl-narrow', 'phase-18-splitter--arabic-rtl-narrow', 'theme:light;density:comfortable;direction:rtl', true],
  ['phase-18-splitter-dark-compact-states', 'phase-18-splitter--dark-compact-states', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-18-drawer-shrink-start', 'phase-18-drawer--shrink-start', undefined, false],
  ['phase-18-drawer-overlay-open', 'phase-18-drawer--overlay-open', undefined, false],
  ['phase-18-drawer-retained-mini', 'phase-18-drawer--retained-mini', undefined, false],
  ['phase-18-drawer-arabic-rtl-end', 'phase-18-drawer--arabic-rtl-end', 'theme:light;density:comfortable;direction:rtl', false],
  ['phase-18-drawer-responsive-narrow', 'phase-18-drawer--responsive-narrow', undefined, true],
  ['phase-18-drawer-dark-compact', 'phase-18-drawer--dark-compact', 'theme:dark;density:compact;direction:ltr', false],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 720 });
    await openStory(page, story, globals);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

for (const [name, story, globals, narrow] of [
  ['phase-15-filterbuilder-nested', 'phase-15-filterbuilder--explicit-nested', undefined, false],
  ['phase-15-pager-numeric', 'phase-15-pager--numeric-buttons', undefined, false],
  ['phase-15-advanced-grid-filter-pager', 'phase-15-advanced-grid--typed-filters-and-numeric-pager', undefined, false],
  ['phase-15-advanced-grid-dark-cell', 'phase-15-advanced-grid--dark-compact', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-15-advanced-grid-rtl-narrow', 'phase-15-advanced-grid--arabic-rtl-narrow', 'theme:light;density:comfortable;direction:rtl', true],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 500, height: 760 });
    await openStory(page, story, globals);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

test('phase-15-reduced-motion visual', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openStory(page, 'phase-15-advanced-grid--reduced-motion');
  await expect(page).toHaveScreenshot('phase-15-reduced-motion.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

for (const [name, story, globals, narrow] of [
  ['phase-14-lookupgrid-local', 'phase-14-lookupgrid--local-item-lookup', undefined, false],
  ['phase-14-lookupgrid-filters', 'phase-14-lookupgrid--column-filter-row', undefined, false],
  ['phase-14-lookupgrid-disabled', 'phase-14-lookupgrid--disabled-ledger-rows', undefined, false],
  ['phase-14-lookupgrid-error', 'phase-14-lookupgrid--error-and-retry', undefined, false],
  ['phase-14-lookupgrid-dark', 'phase-14-lookupgrid--dark-theme', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-14-lookupgrid-rtl', 'phase-14-lookupgrid--arabic-rtl-lookup', 'theme:light;density:comfortable;direction:rtl', false],
  ['phase-14-lookupgrid-narrow-flip', 'phase-14-lookupgrid--narrow-viewport-and-flyout-flip', undefined, true],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 680 });
    await openStory(page, story, globals);
    await expect(page.getByRole('grid')).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

test('phase-14-lookupgrid-reduced-motion visual', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openStory(page, 'phase-14-lookupgrid--reduced-motion');
  await expect(page.getByText('Loading…')).toBeVisible();
  const animationName = await page.locator('[class*="loading"]').first().evaluate((element) => (
    window.getComputedStyle(element, '::before').animationName
  ));
  expect(animationName).toBe('none');
  await expect(page).toHaveScreenshot('phase-14-lookupgrid-reduced-motion.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

for (const [name, story, globals, narrow] of [
  ['phase-13-grid-basic', 'phase-13-grid--basic-local', undefined, false],
  ['phase-13-grid-grouping', 'phase-13-grid--local-grouping', undefined, false],
  ['phase-13-grid-dark', 'phase-13-grid--dark-theme', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-13-grid-rtl-narrow', 'phase-13-grid--arabic-rtl-narrow', 'theme:light;density:comfortable;direction:rtl', true],
  ['phase-13-grid-error', 'phase-13-grid--error-state', undefined, false],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 480, height: 720 });
    await openStory(page, story, globals);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

test('phase-12-tree-context-menu visual', async ({ page }) => {
  await openStory(page, 'phase-12-treeview--context-menus');
  await page.locator('[data-node-key="products"]').click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page).toHaveScreenshot('phase-12-tree-context-menu.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('DropDownBox custom and nested content', async ({ page }) => {
  await openStory(page, 'phase-6-dropdownbox--custom-display-header-footer-and-buttons');
  await page.getByRole('combobox', { name: 'Custom display and commands' }).click();
  await expect(page).toHaveScreenshot('drop-down-box-custom.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });

  await openStory(page, 'phase-6-dropdownbox--nested-popup');
  const inputs = page.getByRole('combobox');
  await inputs.first().click();
  await inputs.nth(1).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await expect(page).toHaveScreenshot('drop-down-box-nested.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('DropDownBox narrow resizable geometry', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 540 });
  await openStory(page, 'phase-6-dropdownbox--narrow-viewport');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveScreenshot('drop-down-box-narrow.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });

  await page.setViewportSize({ width: 1280, height: 720 });
  await openStory(page, 'phase-6-dropdownbox--width-resize-and-placement');
  await expect(page).toHaveScreenshot('drop-down-box-resizable.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('DateEdit open calendar', async ({ page }) => {
  await openStory(page, 'phase-8-dateedit--open-calendar');
  await expect(page.getByRole('dialog', { name: 'Calendar' })).toBeVisible();
  await expect(page).toHaveScreenshot('date-edit-open.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('DateEdit invalid input', async ({ page }) => {
  await openStory(page, 'phase-8-dateedit--empty-required-invalid');
  await expect(page.getByRole('alert')).toHaveCount(2);
  await expect(page).toHaveScreenshot('date-edit-invalid.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('DateEdit min max and disabled dates', async ({ page }) => {
  await openStory(page, 'phase-8-dateedit--min-max-disabled-dates');
  await expect(page.getByRole('dialog', { name: 'Calendar' })).toBeVisible();
  await expect(page).toHaveScreenshot('date-edit-restrictions.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('DateEdit year panel', async ({ page }) => {
  await openStory(page, 'phase-8-dateedit--month-year-navigation');
  await page.getByRole('button', { name: 'Choose month and year' }).click();
  await page.getByRole('button', { name: 'Choose year' }).click();
  await expect(page.getByRole('grid').getByRole('gridcell')).toHaveCount(12);
  await expect(page).toHaveScreenshot('date-edit-year-panel.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('DateEdit narrow layout', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 540 });
  await openStory(page, 'phase-8-dateedit--narrow-layout');
  await expect(page.getByRole('dialog', { name: 'Calendar' })).toBeVisible();
  await expect(page).toHaveScreenshot('date-edit-narrow.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

for (const [name, story, globals] of [
  ['flyout-primary', 'phase-9-flyout--default', undefined],
  ['flyout-placements', 'phase-9-flyout--placements', undefined],
  ['flyout-dark-compact', 'phase-9-flyout--dark-compact', 'theme:dark;density:compact;direction:ltr'],
  ['flyout-arabic-rtl', 'phase-9-flyout--arabic-rtl', 'theme:light;density:comfortable;direction:rtl'],
] as const) {
  test(`${name} Phase 9 visual`, async ({ page }) => {
    await openStory(page, story, globals);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

for (const [name, story, globals, narrow] of [
  ['popup-primary', 'phase-9-popup--default', undefined, false],
  ['popup-nested-flyout', 'phase-9-popup--nested-flyout-ownership', undefined, false],
  ['popup-drag-resize', 'phase-9-popup--drag-and-resize', undefined, false],
  ['popup-transparent-dark', 'phase-9-popup--transparent-dark', 'theme:dark;density:comfortable;direction:ltr', false],
  ['popup-adaptive-narrow', 'phase-9-popup--adaptive-narrow', undefined, true],
] as const) {
  test(`${name} Phase 9 visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 360, height: 540 });
    await openStory(page, story, globals);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

for (const [name, story, globals, narrow] of [
  ['phase-11-tabs-top', 'phase-11-tabs--controlled-closable-reorderable', undefined, false],
  ['phase-11-tabs-vertical', 'phase-11-tabs--vertical', undefined, false],
  ['phase-11-tabs-overflow-buttons', 'phase-11-tabs--overflow-buttons', undefined, false],
  ['phase-11-tabs-closable-reorderable', 'phase-11-tabs--controlled-closable-reorderable', undefined, false],
  ['phase-11-tabs-dark', 'phase-11-tabs--dark-compact', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-11-tabs-arabic-rtl', 'phase-11-tabs--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', true],
  ['phase-11-stepper-horizontal', 'phase-11-stepper--controlled-horizontal', undefined, false],
  ['phase-11-stepper-vertical', 'phase-11-stepper--vertical', undefined, false],
  ['phase-11-stepper-validation', 'phase-11-stepper--validation-optional-skipped', undefined, false],
  ['phase-11-stepper-optional-skipped', 'phase-11-stepper--validation-optional-skipped', undefined, false],
  ['phase-11-stepper-narrow-scroll', 'phase-11-stepper--narrow-scroll', undefined, true],
  ['phase-11-stepper-rtl', 'phase-11-stepper--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', true],
  ['phase-11-accordion-disclosure', 'phase-11-accordion--controlled-disclosure', undefined, false],
  ['phase-11-accordion-tree', 'phase-11-accordion--nested-tree', undefined, false],
  ['phase-11-accordion-filtered', 'phase-11-accordion--filtered', undefined, false],
  ['phase-11-accordion-dark', 'phase-11-accordion--dark-compact', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-11-accordion-rtl-narrow', 'phase-11-accordion--arabic-rtl-narrow', 'theme:light;density:comfortable;direction:rtl', true],
  ['phase-11-form-standard', 'phase-11-formlayout--standard-responsive', undefined, false],
  ['phase-11-form-horizontal-captions', 'phase-11-formlayout--horizontal-captions', undefined, false],
  ['phase-11-form-stacked-captions', 'phase-11-formlayout--narrow-stacked', undefined, true],
  ['phase-11-form-collapsible-group', 'phase-11-formlayout--nested-collapsible-group', undefined, false],
  ['phase-11-form-tabbed', 'phase-11-formlayout--tabbed-sections', undefined, false],
  ['phase-11-form-popup', 'phase-11-formlayout--popup-container', undefined, true],
  ['phase-11-form-window', 'phase-11-formlayout--window-container', undefined, true],
  ['phase-11-form-dark-compact', 'phase-11-formlayout--dark-compact', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-11-form-rtl', 'phase-11-formlayout--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', true],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 420, height: 720 });
    await openStory(page, story, globals);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

test('phase-11-accordion-lazy-error visual', async ({ page }) => {
  await openStory(page, 'phase-11-accordion--lazy-failure');
  await page.getByRole('button', { name: 'Remote children' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveScreenshot('phase-11-accordion-lazy-error.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('Phase 10 Menu horizontal navigation', async ({ page }) => {
  await openStory(page, 'phase-10-menu--horizontal-navigation');
  await expect(page).toHaveScreenshot('phase-10-menu-horizontal.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

test('Phase 10 Menu open nested submenu', async ({ page }) => {
  await openStory(page, 'phase-10-menu--application-menu');
  await page.getByRole('menuitem', { name: 'Sales' }).click();
  await page.getByRole('menuitem', { name: 'Reports' }).hover();
  await expect(page.getByRole('menuitem', { name: 'Aging report' })).toBeVisible();
  await expect(page).toHaveScreenshot('phase-10-menu-nested.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

for (const [name, story, globals] of [
  ['phase-10-menu-application', 'phase-10-menu--application-menu', undefined],
  ['phase-10-menu-mobile', 'phase-10-menu--mobile', undefined],
  ['phase-10-menu-arabic-rtl', 'phase-10-menu--arabic-rtl', 'theme:light;density:comfortable;direction:rtl'],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    await openStory(page, story, globals);
    if (name.includes('mobile')) await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

for (const [name, story, globals, nested] of [
  ['phase-10-context-pointer', 'phase-10-contextmenu--pointer-opened', undefined, false],
  ['phase-10-context-nested', 'phase-10-contextmenu--pointer-opened', undefined, true],
  ['phase-10-context-check-radio-danger', 'phase-10-contextmenu--pointer-opened', undefined, false],
  ['phase-10-context-dark', 'phase-10-contextmenu--dark', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-10-context-arabic-rtl', 'phase-10-contextmenu--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', false],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    await openStory(page, story, globals);
    await page.getByText('Right-click order SO-1042').click({ button: 'right' });
    if (nested) {
      await page.getByRole('menuitem', { name: 'Status' }).hover();
      await expect(page.getByRole('menuitemradio', { name: 'Open' })).toBeVisible();
    }
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

test('Phase 10 ContextMenu loading visual', async ({ page }) => {
  await openStory(page, 'phase-10-contextmenu--loading');
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page).toHaveScreenshot('phase-10-context-loading.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

for (const [name, story, trigger, globals] of [
  ['phase-10-dropdown-open', 'phase-10-dropdownbutton--commands', 'Actions', undefined],
  ['phase-10-split-open', 'phase-10-splitbutton--default', 'Open menu', undefined],
  ['phase-10-dropdown-arbitrary', 'phase-10-dropdownbutton--arbitrary-content', 'Filters', undefined],
  ['phase-10-split-rtl-start', 'phase-10-splitbutton--arabic-rtl', 'Open menu', 'theme:light;density:comfortable;direction:rtl'],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    await openStory(page, story, globals);
    await page.getByRole('button', { name: trigger }).click();
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

test('Phase 10 DropDownButton busy visual', async ({ page }) => {
  await openStory(page, 'phase-10-dropdownbutton--busy-command');
  await page.getByRole('button', { name: 'Async actions' }).click();
  await page.getByRole('menuitem', { name: 'New invoice' }).click();
  await expect(page.getByRole('menuitem', { name: 'New invoice' })).toHaveAttribute('aria-busy', 'true');
  await expect(page).toHaveScreenshot('phase-10-dropdown-busy.png', { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
});

for (const [name, story, globals, narrow] of [
  ['phase-16-calendar-range', 'phase-16-calendar--single-and-range', undefined, false],
  ['phase-16-calendar-dark-compact', 'phase-16-calendar--dark-compact', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-16-calendar-rtl-narrow', 'phase-16-calendar--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', true],
  ['phase-16-date-range-presets', 'phase-16-daterangepicker--explicit-with-presets', undefined, false],
  ['phase-16-date-range-validation', 'phase-16-daterangepicker--validation-and-restrictions', undefined, false],
  ['phase-16-toast-stacks', 'phase-16-toast--stable-visual-stacks', undefined, false],
  ['phase-16-toast-dark', 'phase-16-toast--dark-compact', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-16-confirmation-destructive', 'phase-16-confirmation--destructive-visual', undefined, false],
  ['phase-16-confirmation-rtl', 'phase-16-confirmation--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', false],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 720 });
    await openStory(page, story, globals);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

for (const [name, story, globals] of [
  ['phase-10-toolbar-full-mixed', 'phase-10-toolbar--full', undefined],
  ['phase-10-toolbar-adaptive-overflow', 'phase-10-toolbar--narrow-overflow', undefined],
  ['phase-10-toolbar-dark-compact', 'phase-10-toolbar--dark-compact', 'theme:dark;density:compact;direction:ltr'],
  ['phase-10-toolbar-arabic-rtl', 'phase-10-toolbar--arabic-rtl', 'theme:light;density:comfortable;direction:rtl'],
  ['phase-10-toolbar-narrow-popup', 'phase-10-toolbar--narrow-popup', undefined],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    await openStory(page, story, globals);
    if (name.includes('overflow')) await expect(page.getByRole('button', { name: 'More commands' })).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

for (const [name, story, globals] of [
  ['window-primary', 'phase-9-window--default', undefined],
  ['window-multiple', 'phase-9-window--multiple-windows', undefined],
  ['window-drag-resize', 'phase-9-window--drag-and-resize', undefined],
  ['window-dark-rtl', 'phase-9-window--dark-rtl', 'theme:dark;density:compact;direction:rtl'],
] as const) {
  test(`${name} Phase 9 visual`, async ({ page }) => {
    await openStory(page, story, globals);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

for (const [name, story, globals, narrow] of [
  ['masked-input-primary', 'phase-9-maskedinput--default', undefined, false],
  ['masked-input-show-modes', 'phase-9-maskedinput--show-mask-modes', undefined, false],
  ['masked-input-validation', 'phase-9-maskedinput--validation', undefined, false],
  ['masked-input-unicode', 'phase-9-maskedinput--unicode', undefined, false],
  ['masked-input-dark-compact', 'phase-9-maskedinput--dark-compact', 'theme:dark;density:compact;direction:ltr', false],
  ['masked-input-arabic-rtl-narrow', 'phase-9-maskedinput--arabic-rtl-narrow', 'theme:light;density:comfortable;direction:rtl', true],
] as const) {
  test(`${name} Phase 9 visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 360, height: 540 });
    await openStory(page, story, globals);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}

for (const [name, story, globals, action] of [
  ['phase-19-range-numeric', 'phase-19-rangeselector--number-range', undefined, undefined],
  ['phase-19-range-decimal-date', 'phase-19-rangeselector--decimal-and-date-visual', undefined, undefined],
  ['phase-19-range-chart-markers', 'phase-19-rangeselector--markers-labels-and-chart', undefined, undefined],
  ['phase-19-range-disabled-readonly', 'phase-19-rangeselector--disabled-and-read-only', undefined, undefined],
  ['phase-19-range-dark-compact', 'phase-19-rangeselector--dark-compact', 'theme:dark;density:compact;direction:ltr', undefined],
  ['phase-19-range-arabic-rtl', 'phase-19-rangeselector--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', undefined],
  ['phase-19-tooltip-hover', 'phase-19-tooltip--hover-focus', undefined, 'Account help'],
  ['phase-19-tooltip-interactive-click', 'phase-19-tooltip--interactive-content', undefined, 'Invoice status'],
  ['phase-19-tooltip-edge', 'phase-19-tooltip--edge-flip-and-shift', undefined, undefined],
  ['phase-19-tooltip-dark-rtl', 'phase-19-tooltip--arabic-rtl', 'theme:dark;density:compact;direction:rtl', undefined],
  ['phase-19-status-variants', 'phase-19-statusbadge--types-and-appearances', undefined, undefined],
  ['phase-19-status-dismissible', 'phase-19-statusbadge--dismissible-and-async', undefined, undefined],
  ['phase-19-status-dark-rtl', 'phase-19-statusbadge--arabic-rtl', 'theme:dark;density:compact;direction:rtl', undefined],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    await openStory(page, story, globals);
    await page.evaluate(() => document.fonts.ready);
    if (action) await page.getByRole('button', { name: action }).hover().then(async () => {
      if (action === 'Invoice status') await page.getByRole('button', { name: action }).click();
    });
    if (name.includes('tooltip')) await expect(page.getByRole('tooltip').first()).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}
