import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const [name, globals, width] of [['phase-32c-actions', 'theme:light;direction:ltr', 1280], ['phase-32c-actions-dark', 'theme:dark;direction:ltr', 1280], ['phase-32c-actions-rtl', 'theme:light;direction:rtl', 480]] as const) test(name, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await openStory(page, name.endsWith('-rtl') ? 'phase-32c-actions--rtl-review' : 'phase-32c-actions--review', globals); await expect(page.getByRole('button', { name: /Daily planning,/ })).toBeVisible(); await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
});
