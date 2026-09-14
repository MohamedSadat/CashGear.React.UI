import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const direction of ['ltr', 'rtl']) test(`Phase 33 JSON streams and asynchronous selection ${direction}`, async ({ page }) => {
  await openStory(page, direction === 'rtl' ? 'phase-33-exports--rtl-review' : 'phase-33-exports--review', `theme:light;direction:${direction}`);
  await page.getByRole('button', { name: 'Preview JSON', exact: true }).click(); const json = page.getByLabel('JSON text'); const preview = await json.inputValue(); expect(JSON.parse(preview)[0].amount).toBe('9007199254740993.12');
  await page.getByRole('button', { name: 'Stream JSON', exact: true }).click(); await expect(json).toHaveValue(preview);
  for (const [button, filename] of [['Download JSON', 'records.json'], ['Download workbook', 'records.xlsx']]) { const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: button, exact: true }).click(); expect((await downloading).suggestedFilename()).toBe(filename); }
  const lookup = page.getByRole('combobox', { name: 'Choose record' }); await lookup.click(); await page.getByRole('row', { name: 'Beta 2.00', exact: true }).last().click(); await expect(page.getByLabel('Selection status')).toHaveText('Accepted'); await expect(lookup).toHaveValue('Beta');
  await page.getByRole('checkbox', { name: 'Keep the previous selection' }).check(); await lookup.click(); await page.getByRole('row', { name: 'Gamma 3.00', exact: true }).last().click(); await expect(page.getByLabel('Selection status')).toHaveText('Rejected'); await expect(lookup).toHaveValue('Beta');
  await page.getByRole('columnheader', { name: /Name/ }).first().click({ button: 'right' }); await expect(page.getByRole('menuitem', { name: 'Export to JSON' })).toBeVisible(); await page.keyboard.press('Escape');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
