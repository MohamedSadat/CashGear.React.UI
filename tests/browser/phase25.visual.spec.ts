import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

for (const [name, story, globals, narrow, ready] of [
  ['phase-25-pdf-primary', 'phase-25-pdfviewer--interactive', undefined, false, true],
  ['phase-25-pdf-security', 'phase-25-pdfviewer--security-defaults-and-opt-in', undefined, false, true],
  ['phase-25-pdf-states', 'phase-25-pdfviewer--states-and-templates', undefined, false, false],
  ['phase-25-pdf-dark', 'phase-25-pdfviewer--dark', 'theme:dark;density:compact;direction:ltr', false, true],
  ['phase-25-pdf-rtl', 'phase-25-pdfviewer--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', false, true],
  ['phase-25-pdf-narrow', 'phase-25-pdfviewer--narrow', undefined, true, true],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 780 });
    await openStory(page, story, globals);
    if (ready) await expect(page.locator('[data-cg-pdf-ready]').first()).toBeVisible({ timeout: 30_000 });
    else await expect(page.getByRole('alert')).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}
