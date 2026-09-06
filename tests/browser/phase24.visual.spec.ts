import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

for (const [name, story, globals, narrow, waitFor, media] of [
  ['phase-24-time-primary', 'phase-24-timeedit--primary', undefined, false, '[data-cg-time-edit-popup]', undefined],
  ['phase-24-time-dark', 'phase-24-timeedit--dark-compact', 'theme:dark;density:compact;direction:ltr', false, '[data-cg-time-edit-popup]', undefined],
  ['phase-24-time-rtl-narrow', 'phase-24-timeedit--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', true, '[data-cg-time-edit-popup]', undefined],
  ['phase-24-time-validation', 'phase-24-timeedit--validation-and-form', undefined, false, 'input[role="combobox"]', undefined],
  ['phase-24-grid-named', 'phase-24-gridlayout--named-areas', undefined, false, '[data-cg-grid-layout]', undefined],
  ['phase-24-grid-dark', 'phase-24-gridlayout--dark', 'theme:dark;density:comfortable;direction:ltr', false, '[data-cg-grid-layout]', undefined],
  ['phase-24-grid-rtl-narrow', 'phase-24-gridlayout--rtl-narrow', 'theme:light;density:comfortable;direction:rtl', true, '[data-cg-grid-layout]', undefined],
  ['phase-24-wait-animations', 'phase-24-waitindicator--animations-and-sizes', undefined, false, '[data-cg-wait-indicator]', undefined],
  ['phase-24-wait-forced-colors', 'phase-24-waitindicator--animations-and-sizes', undefined, false, '[data-cg-wait-indicator]', 'forced'],
  ['phase-24-wait-reduced-motion', 'phase-24-waitindicator--custom-and-decorative', undefined, false, '[data-cg-wait-indicator]', 'reduced'],
  ['phase-24-message-alert', 'phase-24-messagebox--declarative', undefined, false, '[data-cg-message-box]', undefined],
  ['phase-24-message-dark', 'phase-24-messagebox--dark', 'theme:dark;density:comfortable;direction:ltr', false, '[data-cg-message-box]', undefined],
  ['phase-24-message-rtl-narrow', 'phase-24-messagebox--arabic-rtl-narrow', 'theme:light;density:comfortable;direction:rtl', true, '[data-cg-message-box]', undefined],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 780 });
    if (media === 'forced') await page.emulateMedia({ forcedColors: 'active' });
    if (media === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
    await openStory(page, story, globals);
    await expect(page.locator(waitFor).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}
