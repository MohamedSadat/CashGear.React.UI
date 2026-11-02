import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

for (const [name, story, globals] of [
  ['phase-34-status-bar-light', 'phase-34-statusbar--spreadsheet', 'theme:light;density:comfortable;direction:ltr'],
  ['phase-34-status-bar-zoom', 'phase-34-statusbar--zoom-control', 'theme:light;density:comfortable;direction:ltr'],
  ['phase-34-status-bar-truncated', 'phase-34-statusbar--long-text-truncates', 'theme:light;density:comfortable;direction:ltr'],
  ['phase-34-status-bar-sizes', 'phase-34-statusbar--sizes', 'theme:light;density:comfortable;direction:ltr'],
  ['phase-34-status-bar-dark', 'phase-34-statusbar--dark', 'theme:dark;density:comfortable;direction:ltr'],
  ['phase-34-status-bar-rtl', 'phase-34-statusbar--arabic-rtl', 'theme:light;density:comfortable;direction:rtl'],
  ['phase-34-slider-light', 'phase-34-slider--sizes-marks-and-disabled', 'theme:light;density:comfortable;direction:ltr'],
  ['phase-34-slider-zoom', 'phase-34-slider--zoom-with-steppers-and-marks', 'theme:light;density:comfortable;direction:ltr'],
  ['phase-34-slider-dark', 'phase-34-slider--dark', 'theme:dark;density:comfortable;direction:ltr'],
  ['phase-34-slider-rtl', 'phase-34-slider--arabic-rtl', 'theme:light;density:comfortable;direction:rtl'],
] as const) {
  test(name, async ({ page }) => {
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-status-bar], [data-cg-slider]').first()).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
  });
}
