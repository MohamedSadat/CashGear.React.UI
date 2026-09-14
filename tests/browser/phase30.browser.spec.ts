import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

for (const direction of ['ltr', 'rtl']) test(`Phase 30 export scopes and virtual focus ${direction}`, async ({ page }) => {
  await openStory(page, direction === 'rtl' ? 'phase-30-analysis--rtl-review' : 'phase-30-analysis--review', `theme:light;direction:${direction}`);
  await expect(page.getByText('Account 1', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Collapse analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Export current layout', exact: true }).click();
  await expect(page.getByLabel('Export result')).toHaveText('Current layout: 3 rows');
  await page.getByRole('button', { name: 'Export all expanded', exact: true }).click();
  await expect(page.getByLabel('Export result')).toHaveText('All expanded: 203 rows');
  await page.getByRole('button', { name: 'Focus account 190', exact: true }).click();
  const grid = page.getByRole('treegrid', { name: 'Accounts' });
  await expect(grid.getByRole('gridcell').filter({ hasText: 'Account 190' })).toBeFocused();
  expect(await grid.locator('tbody tr[data-row-token]').count()).toBeLessThan(25);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
