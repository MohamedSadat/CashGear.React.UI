import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const [name, globals, width] of [['phase-31-dates', 'theme:light;direction:ltr', 1280], ['phase-31-dates-dark', 'theme:dark;direction:ltr', 1280], ['phase-31-dates-rtl', 'theme:light;direction:rtl', 480]] as const) {
  test(name, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openStory(page, name.endsWith('-rtl') ? 'phase-31-dates--rtl-review' : 'phase-31-dates--review', globals);
    await expect(page.getByLabel('Selected dates')).toHaveText('2026-09-03');
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
  });
}
