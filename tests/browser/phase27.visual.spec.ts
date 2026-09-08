import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

for (const [name, globals, width] of [
  ['phase-27-decimal', 'theme:light;direction:ltr', 1280],
  ['phase-27-decimal-dark', 'theme:dark;direction:ltr', 1280],
  ['phase-27-decimal-rtl', 'theme:light;direction:rtl', 390],
] as const) {
  test(name, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await openStory(page, 'phase-27-decimal-edit--exact-arithmetic', globals);
    await expect(page.getByLabel('Exact amount', { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
  });
}
