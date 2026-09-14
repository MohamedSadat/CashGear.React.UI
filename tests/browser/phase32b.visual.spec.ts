import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const [name, globals, width] of [['phase-32b-resources', 'theme:light;direction:ltr', 1280], ['phase-32b-resources-dark', 'theme:dark;direction:ltr', 1280], ['phase-32b-resources-rtl', 'theme:light;direction:rtl', 480]] as const) test(name, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await openStory(page, name.endsWith('-rtl') ? 'phase-32b-resources--rtl-review' : 'phase-32b-resources--review', globals);
  await expect(page.getByRole('button', { name: /Project planning,/ })).toBeVisible(); await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
});
