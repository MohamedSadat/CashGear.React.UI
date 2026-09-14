import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const direction of ['ltr', 'rtl']) test(`Phase 32C mounted reminders and occurrence actions ${direction}`, async ({ page }) => {
  await openStory(page, direction === 'rtl' ? 'phase-32c-actions--rtl-review' : 'phase-32c-actions--review', `theme:light;direction:${direction}`);
  await page.getByRole('button', { name: 'Advance reminder clock', exact: true }).click(); await expect(page.getByLabel('Reminders delivered')).toHaveText('1');
  await page.getByRole('button', { name: 'Advance reminder clock', exact: true }).click(); await expect(page.getByLabel('Reminders delivered')).toHaveText('1');
  await page.getByRole('button', { name: 'Delete occurrence', exact: true }).click(); await expect(page.getByRole('button', { name: /Daily planning,/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore occurrence', exact: true }).click(); await expect(page.getByRole('button', { name: /Daily planning,/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit occurrence', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Preview iCalendar', exact: true }).click(); await expect(page.getByLabel('Calendar text')).toHaveValue(/RRULE:FREQ=DAILY;COUNT=3/);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download calendar', exact: true }).click(); expect((await download).suggestedFilename()).toBe('team.ics');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
