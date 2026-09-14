import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const [name, globals, width] of [['phase-33-exports', 'theme:light;direction:ltr', 1280], ['phase-33-exports-dark', 'theme:dark;direction:ltr', 1280], ['phase-33-exports-rtl', 'theme:light;direction:rtl', 480]] as const) test(name, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await openStory(page, name.endsWith('-rtl') ? 'phase-33-exports--rtl-review' : 'phase-33-exports--review', globals); await expect(page.getByRole('combobox', { name: 'Choose record' })).toHaveValue('Alpha'); await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
});
