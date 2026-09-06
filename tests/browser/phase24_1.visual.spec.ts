import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

const story = (name: string) => `phase-24-1-reliability-refresh--${name}`;

for (const [name, storyName, globals, narrow, openPicker] of [
  ['phase-24-1-table-style', 'table-styling', undefined, false, false],
  ['phase-24-1-table-style-gallery', 'table-styling', undefined, false, true],
  ['phase-24-1-table-style-dark', 'table-styling', 'theme:dark;density:compact;direction:ltr', false, false],
  ['phase-24-1-table-style-rtl-narrow', 'table-styling', 'theme:light;density:comfortable;direction:rtl', true, false],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 780 });
    if (openPicker) await page.setViewportSize({ width: 1280, height: 1100 });
    await openStory(page, story(storyName), globals);
    await expect(page.getByRole('grid')).toBeVisible();
    if (openPicker) {
      await page.getByRole('button', { name: 'Table Style' }).click();
      await expect(page.locator('[data-cg-grid-table-style-picker]')).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}
