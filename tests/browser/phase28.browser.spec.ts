import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

test('Phase 28 keeps guarded selection and missing key labels', async ({ page }) => {
  await openStory(page, 'phase-28-selection--guarded-selection');
  await expect(page.getByLabel('Selected keys')).toHaveText('1, 2001');
  await page.getByRole('button', { name: 'Remove Unavailable 2001' }).click();
  await expect(page.getByLabel('Selected keys')).toHaveText('1');
  await page.getByRole('option', { name: 'Account 1', exact: true }).click();
  await expect(page.getByLabel('Guarded selection')).toHaveText('Account 1');
  await page.getByRole('searchbox').fill('Account 2');
  await page.getByRole('option', { name: 'Account 2', exact: true }).click();
  await expect(page.getByLabel('Guarded selection')).toHaveText('Account 1');
  await page.getByRole('searchbox').fill('');
  await expect(page.getByRole('option', { name: 'Account 1', exact: true })).toBeVisible();
  await page.getByRole('listbox', { name: 'Accounts' }).press('End');
  const id = await page.getByRole('listbox', { name: 'Accounts' }).getAttribute('aria-activedescendant');
  if (id) await expect(page.locator(`[id="${id}"]`)).toBeAttached();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
