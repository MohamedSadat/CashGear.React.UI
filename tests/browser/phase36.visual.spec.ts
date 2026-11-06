import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

const LIGHT = 'theme:light;density:comfortable;direction:ltr';
const DARK = 'theme:dark;density:comfortable;direction:ltr';
const RTL = 'theme:light;density:comfortable;direction:rtl';

for (const [name, story, globals] of [
  ['phase-36-pivot-field-list-light', 'phase-36-pivotfieldlist--sales-example', LIGHT],
  ['phase-36-pivot-field-list-empty', 'phase-36-pivotfieldlist--empty', LIGHT],
  ['phase-36-pivot-field-list-side-by-side', 'phase-36-pivotfieldlist--side-by-side', LIGHT],
  ['phase-36-pivot-field-list-read-only', 'phase-36-pivotfieldlist--read-only', LIGHT],
  ['phase-36-pivot-field-list-disabled-field', 'phase-36-pivotfieldlist--disabled-field', LIGHT],
  ['phase-36-pivot-field-list-dark', 'phase-36-pivotfieldlist--dark', DARK],
  ['phase-36-pivot-field-list-rtl', 'phase-36-pivotfieldlist--arabic-rtl', RTL],
] as const) {
  test(name, async ({ page }) => {
    await openStory(page, story, globals);
    await expect(page.getByTestId('field-list')).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
  });
}

test('phase-36-pivot-field-list-item-menu', async ({ page }) => {
  await openStory(page, 'phase-36-pivotfieldlist--sales-example', LIGHT);
  await page.getByRole('listbox', { name: 'Values' }).getByRole('option', { name: 'Sum of Units' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Value Field Settings…' })).toBeVisible();
  await expect(page).toHaveScreenshot('phase-36-pivot-field-list-item-menu.png', { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
});
