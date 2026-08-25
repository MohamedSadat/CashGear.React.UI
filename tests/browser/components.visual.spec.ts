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
