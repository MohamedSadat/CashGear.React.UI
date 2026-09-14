import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const direction of ['ltr', 'rtl']) test(`Phase 31 multiple dates and presets ${direction}`, async ({ page }) => {
  await openStory(page, direction === 'rtl' ? 'phase-31-dates--rtl-review' : 'phase-31-dates--review', `theme:light;direction:${direction}`);
  await page.locator('[data-date="2026-09-03"]').click();
  await page.locator('[data-date="2026-09-07"]').click({ modifiers: ['Shift'] });
  await expect(page.getByLabel('Selected dates')).toHaveText('2026-09-03, 2026-09-04, 2026-09-06, 2026-09-07');
  await page.locator('[data-date="2026-09-04"]').click({ modifiers: ['Control'] });
  await expect(page.getByLabel('Selected dates')).toHaveText('2026-09-03, 2026-09-06, 2026-09-07');
  await page.getByLabel('Reporting period').selectOption('lastMonth');
  await expect(page.getByLabel('Selected range')).toHaveText('2026-08-01 to 2026-08-31');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByLabel('Selected dates')).toHaveText('No dates selected');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
