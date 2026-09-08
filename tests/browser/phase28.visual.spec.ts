import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

for (const [name, globals, width] of [
  ['phase-28-selection', 'theme:light;direction:ltr', 1280],
  ['phase-28-selection-dark', 'theme:dark;direction:ltr', 1280],
  ['phase-28-selection-rtl', 'theme:light;direction:rtl', 390],
] as const) {
  test(name, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await openStory(page, 'phase-28-selection--guarded-selection', globals);
    await expect(page.getByLabel('Selected keys')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
  });
}
