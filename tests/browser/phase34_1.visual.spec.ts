import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

const LIGHT = 'theme:light;density:comfortable;direction:ltr';
const DARK = 'theme:dark;density:comfortable;direction:ltr';
const RTL = 'theme:light;density:comfortable;direction:rtl';

for (const [name, story, globals] of [
  ['phase-34-1-icons-light', 'phase-1-2-icon--spreadsheet', LIGHT],
  ['phase-34-1-icons-dark', 'phase-1-2-icon--spreadsheet-dark', DARK],
  ['phase-34-1-icons-rtl', 'phase-1-2-icon--spreadsheet-rtl', RTL],
  ['phase-34-1-color-picker-light', 'phase-34-colorpicker--full-palette', LIGHT],
  ['phase-34-1-color-picker-shades', 'phase-34-colorpicker--custom-shades', LIGHT],
  ['phase-34-1-color-picker-disabled', 'phase-34-colorpicker--disabled', LIGHT],
  ['phase-34-1-color-picker-dark', 'phase-34-colorpicker--dark', DARK],
  ['phase-34-1-color-picker-rtl', 'phase-34-colorpicker--arabic-rtl', RTL],
  ['phase-34-1-gallery-open', 'phase-34-gallery--open-on-arrival', LIGHT],
  ['phase-34-1-gallery-inline', 'phase-34-gallery--inline', LIGHT],
  ['phase-34-1-gallery-disabled', 'phase-34-gallery--disabled', LIGHT],
  ['phase-34-1-gallery-dark', 'phase-34-gallery--dark', DARK],
  ['phase-34-1-gallery-rtl', 'phase-34-gallery--arabic-rtl', RTL],
  ['phase-34-1-border-picker-light', 'phase-34-borderpicker--all-presets', LIGHT],
  ['phase-34-1-border-picker-disabled', 'phase-34-borderpicker--disabled', LIGHT],
  ['phase-34-1-border-picker-dark', 'phase-34-borderpicker--dark', DARK],
  ['phase-34-1-border-picker-rtl', 'phase-34-borderpicker--arabic-rtl', RTL],
  ['phase-34-1-ribbon-light', 'phase-34-ribbon--spreadsheet', LIGHT],
  ['phase-34-1-ribbon-narrow', 'phase-34-ribbon--narrow', LIGHT],
  ['phase-34-1-ribbon-collapsed', 'phase-34-ribbon--collapsed', LIGHT],
  ['phase-34-1-ribbon-dark', 'phase-34-ribbon--dark', DARK],
  ['phase-34-1-ribbon-rtl', 'phase-34-ribbon--arabic-rtl', RTL],
  ['phase-34-1-ribbon-rtl-narrow', 'phase-34-ribbon--arabic-rtl-narrow', RTL],
  ['phase-34-1-toolbar-layouts', 'phase-10-toolbar--layouts', LIGHT],
] as const) {
  test(name, async ({ page }) => {
    await openStory(page, story, globals);
    await expect(page.locator('#storybook-root svg, #storybook-root button').first()).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
  });
}

test('phase-34-1-ribbon-wide', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 400 });
  await openStory(page, 'phase-34-ribbon--spreadsheet', LIGHT);
  await expect(page.locator('[data-cg-ribbon-stage="0"]')).toBeVisible();
  await expect(page).toHaveScreenshot('phase-34-1-ribbon-wide.png', { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
});

test('phase-34-1-ribbon-collapsed-open', async ({ page }) => {
  await openStory(page, 'phase-34-ribbon--collapsed', LIGHT);
  await page.getByRole('tab', { name: 'Home' }).click();
  await expect(page.getByRole('toolbar', { name: 'Clipboard' })).toBeVisible();
  await expect(page).toHaveScreenshot('phase-34-1-ribbon-collapsed-open.png', { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
});

test('phase-34-1-ribbon-color-flyout', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 500 });
  await openStory(page, 'phase-34-ribbon--spreadsheet', DARK);
  await page.getByRole('button', { name: 'Fill color: more options' }).click();
  await expect(page.getByRole('dialog', { name: 'Fill color' })).toBeVisible();
  await expect(page).toHaveScreenshot('phase-34-1-ribbon-color-flyout.png', { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
});
