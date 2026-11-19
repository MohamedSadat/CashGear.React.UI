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

test('A capped flyout opens below its field when its cap fits there, not where its whole list would', async ({ page }) => {
  await openStory(page, 'blazor-parity-2026-11-overlay-placement--capped-list-opens-below');
  const anchor = page.getByTestId('capped-anchor');
  const flyout = page.getByTestId('capped-flyout');
  await expect(flyout).toBeVisible();
  const field = (await anchor.boundingBox())!;
  // Room below for the 20rem (320px) cap but not for the ~800px list, and more room above than below.
  await page.setViewportSize({ width: 1280, height: Math.round(field.y + field.height + 360) });
  await expect.poll(async () => (await flyout.boundingBox())!.y).toBeGreaterThanOrEqual(field.y + field.height);
  const box = (await flyout.boundingBox())!;
  expect(field.y).toBeGreaterThan(360);
  expect(box.height).toBeLessThanOrEqual(321);
  expect(box.y - (field.y + field.height)).toBeLessThan(8);
});
