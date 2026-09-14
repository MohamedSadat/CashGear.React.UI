import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const [name, globals, width] of [['phase-32a-recurrence', 'theme:light;direction:ltr', 1280], ['phase-32a-recurrence-dark', 'theme:dark;direction:ltr', 1280], ['phase-32a-recurrence-rtl', 'theme:light;direction:rtl', 480]] as const) test(name, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openStory(page, name.endsWith('-rtl') ? 'phase-32a-recurrence--rtl-review' : 'phase-32a-recurrence--review', globals);
  await expect(page.getByRole('button', { name: /Daily planning,/ })).toHaveCount(3);
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
});
