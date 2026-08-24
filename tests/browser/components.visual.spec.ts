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
