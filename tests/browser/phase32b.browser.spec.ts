import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const direction of ['ltr', 'rtl']) test(`Phase 32B resources and tooltip ${direction}`, async ({ page }) => {
  await openStory(page, direction === 'rtl' ? 'phase-32b-resources--rtl-review' : 'phase-32b-resources--review', `theme:light;direction:${direction}`);
  const appointment = page.getByRole('button', { name: /Project planning,/ }); await appointment.click(); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await expect(dialog.getByText('Main office')).toBeVisible(); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await appointment.dblclick(); await expect(dialog).toBeVisible(); await dialog.getByLabel('Room A', { exact: true }).uncheck(); await dialog.getByLabel('Room B', { exact: true }).check(); await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden(); await expect(page.getByLabel('Last operation')).toHaveText('Resources: b');
  await page.getByRole('combobox', { name: 'View', exact: true }).selectOption('timeline'); await expect(page.getByRole('rowheader', { name: 'Room B', exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Visible resources', exact: true }).getByLabel('Room B', { exact: true }).uncheck(); await expect(appointment).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test('Phase 32B cross-resource pointer reassignment', async ({ page }) => {
  await openStory(page, 'phase-32b-resources--review');
  const appointment = page.getByRole('button', { name: /Project planning,/ }); const box = await appointment.boundingBox();
  const target = await page.locator('[data-resource-key="string:b"][data-start="1788771600000"]').boundingBox(); expect(target).not.toBeNull();
  await page.mouse.move(box!.x + 30, box!.y + 15); await page.mouse.down(); await page.mouse.move(target!.x + 30, target!.y + 15, { steps: 10 }); await page.mouse.up();
  await expect(page.getByLabel('Last operation')).toHaveText('Resources: b');
});
