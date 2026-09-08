import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

test('Phase 26 flushes delayed input and protects transaction cancellation', async ({ page }) => {
  await openStory(page, 'phase-26-editor-commit--transaction-editing');
  await page.getByRole('button', { name: 'Edit transaction', exact: true }).click();
  await page.getByRole('textbox', { name: 'Reference' }).fill('Invoice 2042');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Saved reference')).toHaveText('Invoice 2042');
  await page.getByRole('textbox', { name: 'Reference' }).fill('Pending');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('textbox', { name: 'Reference' })).toHaveValue('Pending');
  await page.getByLabel('Simulate save failure').check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to save');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
