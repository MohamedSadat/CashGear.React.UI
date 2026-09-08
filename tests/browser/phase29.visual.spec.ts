import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

for (const [name, globals, width] of [
  ['phase-29-grid', 'theme:light;direction:ltr', 1280],
  ['phase-29-grid-dark', 'theme:dark;direction:ltr', 1280],
  ['phase-29-grid-rtl', 'theme:light;direction:rtl', 480],
] as const) {
  test(name, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openStory(page, name.endsWith('-rtl') ? 'phase-29-grid--arabic-review' : 'phase-29-grid--virtual-review', globals);
    await expect(page.getByLabel('Virtualization status')).toHaveText('Rows: virtual; columns: virtual');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
  });
}
