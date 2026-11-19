import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

test('ComboBox free text commits on Enter, Tab and an outside click, and Escape restores', async ({ page }) => {
  await openStory(page, 'blazor-parity-2026-11-combobox-free-text--free-text');
  const input = page.getByRole('combobox', { name: 'Unit (type A1, then Enter)' });
  await input.click();
  await input.pressSequentially('A1');
  await expect(page.getByRole('status').filter({ hasText: 'Press Enter to use "A1".' })).toBeVisible();
  await input.press('Enter');
  await expect(input).toHaveValue('A1');
  await expect(page.getByText('Committed: A1 / A1')).toBeVisible();

  await input.fill('box');
  await input.press('Tab');
  await expect(input).toHaveValue('Box');
  await expect(page.getByText('Committed: BOX / Box')).toBeVisible();

  await input.fill('Crate');
  await page.mouse.click(900, 600);
  await expect(page.getByText('Committed: CRATE / Crate')).toBeVisible();

  await input.fill('Drum');
  await input.press('Escape');
  await expect(input).toHaveValue('Crate');

  const key = page.getByRole('combobox', { name: 'Unit code (key editor)' });
  await key.fill('Pallet');
  await key.press('Enter');
  await expect(page.getByText('Key: PALLET')).toBeVisible();
  await expect(key).toHaveValue('Pallet');
});
