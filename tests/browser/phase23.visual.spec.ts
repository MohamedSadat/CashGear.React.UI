import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

for (const [name, story, globals, narrow, waitFor] of [
  ['phase-23-button-group-primary', 'phase-23-buttongroup--selection-modes', undefined, false, '[data-cg-button-group]'],
  ['phase-23-button-group-dark', 'phase-23-buttongroup--dark', 'theme:dark;density:comfortable;direction:ltr', false, '[data-cg-button-group]'],
  ['phase-23-map-primary', 'phase-23-map--interactive', undefined, false, '[data-cg-map-ready]'],
  ['phase-23-map-empty', 'phase-23-map--empty', undefined, false, '[data-cg-map]'],
  ['phase-23-map-error', 'phase-23-map--tile-error', undefined, false, '[data-cg-map]'],
  ['phase-23-map-rtl-narrow', 'phase-23-map--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', true, '[data-cg-map-ready]'],
  ['phase-23-editor-primary', 'phase-23-richtexteditor--primary', undefined, false, '.tiptap'],
  ['phase-23-editor-dark', 'phase-23-richtexteditor--dark', 'theme:dark;density:comfortable;direction:ltr', false, '.tiptap'],
  ['phase-23-editor-rtl-narrow', 'phase-23-richtexteditor--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', true, '.tiptap'],
  ['phase-23-editor-disabled-readonly', 'phase-23-richtexteditor--read-only-and-disabled', undefined, false, '.tiptap'],
] as const) {
  test(`${name} visual`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 780 });
    await openStory(page, story, globals);
    await expect(page.locator(waitFor).first()).toBeVisible();
    if (name.includes('map-error')) await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', fullPage: true, maxDiffPixelRatio: 0.001 });
  });
}
