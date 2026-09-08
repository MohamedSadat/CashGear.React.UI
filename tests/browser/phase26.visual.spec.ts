import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

for (const [name, globals, width] of [
  ['phase-26-transaction', 'theme:light;direction:ltr', 1280],
  ['phase-26-transaction-dark', 'theme:dark;direction:ltr', 1280],
  ['phase-26-transaction-rtl', 'theme:light;direction:rtl', 390],
] as const) {
  test(name, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await openStory(page, 'phase-26-editor-commit--transaction-editing', globals);
    await page.getByRole('button', { name: 'Edit transaction', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
  });
}
