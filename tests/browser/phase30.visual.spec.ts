import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const [name, globals, width] of [['phase-30-analysis', 'theme:light;direction:ltr', 1280], ['phase-30-analysis-dark', 'theme:dark;direction:ltr', 1280], ['phase-30-analysis-rtl', 'theme:light;direction:rtl', 480]] as const) {
  test(name, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openStory(page, name.endsWith('-rtl') ? 'phase-30-analysis--rtl-review' : 'phase-30-analysis--review', globals);
    await expect(page.getByText('Account 1', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Collapse analysis', exact: true }).click();
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
  });
}
