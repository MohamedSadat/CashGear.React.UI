import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

test('Phase 27 preserves exact decimal arithmetic and rejected drafts', async ({ page }) => {
  await openStory(page, 'phase-27-decimal-edit--exact-arithmetic');
  await page.getByLabel('Exact amount', { exact: true }).fill('9007199254740993.01+0.01');
  await page.getByLabel('Exact amount', { exact: true }).press('Enter');
  await expect(page.getByLabel('Canonical decimal')).toHaveText('9007199254740993.02');
  await page.getByLabel('Bounded amount').fill('101');
  await page.getByLabel('Bounded amount').press('Tab');
  await expect(page.getByLabel('Bounded amount')).toHaveValue('101');
  await expect(page.getByLabel('Bounded amount')).toHaveAttribute('aria-invalid', 'true');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
