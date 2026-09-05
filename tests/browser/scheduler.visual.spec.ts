import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const story of ['day', 'week', 'month', 'timeline', 'arabic-rtl', 'dark']) {
  test(`scheduler ${story}`, async ({ page }) => {
    await openStory(page, `data-scheduler--${story}`, story === 'dark' ? 'theme:dark;density:comfortable;direction:ltr' : undefined);
    await expect(page.getByRole('region', { name: story === 'arabic-rtl' ? 'الجدول' : 'Scheduler', exact: true })).toHaveScreenshot(`scheduler-${story}.png`);
  });
}
