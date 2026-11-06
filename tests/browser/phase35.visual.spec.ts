import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

const LIGHT = 'theme:light;density:comfortable;direction:ltr';
const DARK = 'theme:dark;density:comfortable;direction:ltr';
const RTL = 'theme:light;density:comfortable;direction:rtl';

for (const [name, story, globals] of [
  ['phase-35-chart-column', 'phase-35-chart-document--excel-clustered-column', LIGHT],
  ['phase-35-chart-bar', 'phase-35-chart-document--excel-clustered-bar', LIGHT],
  ['phase-35-chart-line', 'phase-35-chart-document--excel-line-with-markers', LIGHT],
  ['phase-35-chart-area', 'phase-35-chart-document--excel-area', LIGHT],
  ['phase-35-chart-pie', 'phase-35-chart-document--excel-pie', LIGHT],
  ['phase-35-chart-doughnut', 'phase-35-chart-document--excel-doughnut', LIGHT],
  ['phase-35-chart-scatter', 'phase-35-chart-document--excel-scatter-markers', LIGHT],
  ['phase-35-chart-scatter-smooth', 'phase-35-chart-document--excel-scatter-smooth', LIGHT],
  ['phase-35-chart-combo', 'phase-35-chart-document--excel-combo-secondary-axis', LIGHT],
  ['phase-35-chart-dark', 'phase-35-chart-document--excel-dark-colours', DARK],
  ['phase-35-chart-theme-defaults', 'phase-35-chart-document--theme-defaults', LIGHT],
  ['phase-35-chart-small', 'phase-35-chart-document--small-sizes', LIGHT],
  ['phase-35-chart-rtl', 'phase-35-chart-document--excel-arabic-rtl', RTL],
  ['phase-35-chart-hit-testing', 'phase-35-chart-document--element-hit-testing', LIGHT],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    await openStory(page, story, globals);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('[data-cg-chart-canvas]').first()).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}
