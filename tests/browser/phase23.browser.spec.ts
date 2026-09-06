import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

test('Phase 23 ButtonGroup supports selection semantics and RTL-aware roving focus', async ({ page }) => {
  await openStory(page, 'phase-23-buttongroup--selection-modes');
  const radios = page.getByRole('radiogroup', { name: 'Invoice view' }).getByRole('radio');
  await expect(radios.first()).toHaveAttribute('aria-checked', 'true');
  await radios.first().focus();
  await radios.first().press('ArrowRight');
  await expect(radios.nth(1)).toBeFocused();
  await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true');
  const labels = page.getByRole('group', { name: 'Display options' }).getByRole('button', { name: 'Labels' });
  await expect(labels).toHaveAttribute('aria-pressed', 'true');
  await labels.click();
  await expect(labels).toHaveAttribute('aria-pressed', 'false');

  await openStory(page, 'phase-23-buttongroup--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const rtl = page.getByRole('radiogroup').getByRole('radio');
  await rtl.first().focus();
  await rtl.first().press('ArrowLeft');
  await expect(rtl.nth(1)).toBeFocused();
});

test('Phase 23 Map loads local tiles, activates markers, fits bounds, and supports multiple instances', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  await openStory(page, 'phase-23-map--interactive');
  const map = page.getByRole('region', { name: 'Delivery locations' });
  await expect(map.locator('[data-cg-map-ready]')).toBeVisible();
  await expect(map.locator('.leaflet-tile')).not.toHaveCount(0);
  const hq = map.locator('[data-cg-map-marker="hq"]');
  await expect(hq).toHaveAttribute('role', 'button');
  await hq.click();
  await expect(page.getByLabel('Selected map marker')).toHaveText('CashGear HQ');
  await expect(map.getByText('CashGear headquarters')).toBeVisible();
  await page.getByRole('button', { name: 'Fit locations' }).click();
  await expect(map.locator('[data-cg-map-ready]')).toBeVisible();

  await openStory(page, 'phase-23-map--multiple-maps');
  await expect(page.locator('[data-cg-map-ready]')).toHaveCount(2);
  await expect(page.locator('[data-cg-map-marker]')).toHaveCount(2);

  await openStory(page, 'phase-23-map--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  await expect(page.getByRole('region', { name: 'مواقع التسليم' }).locator('[data-cg-map-ready]')).toHaveAttribute('dir', 'ltr');
  expect(problems).toEqual([]);
});

test('Phase 23 Map keeps the empty state lazy and reports tile failure with retry', async ({ page }) => {
  await openStory(page, 'phase-23-map--empty');
  await expect(page.getByRole('region', { name: 'Unconfigured map' })).toContainText('Configure a tile URL');
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  expect(resources.some((resource) => /mapEngine-/u.test(resource))).toBe(false);

  await openStory(page, 'phase-23-map--tile-error');
  await expect(page.getByText(/Some map tiles could not be loaded/u)).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText(/Some map tiles could not be loaded/u)).toBeVisible();
});

test('Phase 23 RichTextEditor retains selection for formatting and insertion dialogs', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await openStory(page, 'phase-23-richtexteditor--primary');
  const editor = page.getByRole('textbox', { name: 'Delivery instructions' });
  await expect(editor).toBeEditable();
  await expect(page.getByLabel('Document statistics')).toContainText('words');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.getByRole('button', { name: 'Bold' }).click();
  await expect(editor.locator('strong')).not.toHaveCount(0);

  await page.getByRole('tab', { name: 'Insert' }).click();
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  const linkDialog = page.getByRole('dialog', { name: 'Edit link' });
  await linkDialog.getByLabel('URL').fill('https://cashgear.example/notes');
  await linkDialog.getByRole('button', { name: 'Apply' }).click();
  await expect(editor.locator('a[href="https://cashgear.example/notes"]')).not.toHaveCount(0);

  await page.getByRole('button', { name: 'Table' }).click();
  const tableDialog = page.getByRole('dialog', { name: 'Insert table' });
  await tableDialog.getByLabel('Rows').fill('2');
  await tableDialog.getByLabel('Columns').fill('3');
  await tableDialog.getByRole('button', { name: 'Apply' }).click();
  await expect(editor.locator('table')).toBeVisible();
  await page.getByRole('tab', { name: 'Table' }).click();
  await expect(page.getByRole('button', { name: 'Row above' })).toBeEnabled();
  await page.getByRole('button', { name: 'Row above' }).click();
  await expect(editor.locator('tr')).toHaveCount(3);
  await page.getByRole('button', { name: 'Flush document' }).click();
  await expect(page.getByLabel('Saved editor size')).toContainText('HTML characters');
  expect(problems).toEqual([]);
});

test('Phase 23 RichTextEditor integrates required forms and RTL/read-only states', async ({ page }) => {
  await openStory(page, 'phase-23-richtexteditor--required-form-integration');
  const editor = page.getByRole('textbox', { name: 'Required notes' });
  await page.getByRole('button', { name: 'Submit notes' }).click();
  await expect(editor).toBeFocused();
  await editor.fill('Approved for dispatch');
  await page.getByRole('button', { name: 'Submit notes' }).click();
  await expect(page.getByLabel('Submitted rich text')).toContainText('Approved for dispatch');

  await openStory(page, 'phase-23-richtexteditor--read-only-and-disabled');
  await expect(page.getByRole('textbox', { name: 'Read-only notes' })).toHaveAttribute('aria-readonly', 'true');
  await expect(page.getByRole('textbox', { name: 'Disabled notes' })).toHaveAttribute('tabindex', '-1');
  await openStory(page, 'phase-23-richtexteditor--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  await expect(page.getByRole('textbox', { name: 'محرر التعليمات' })).toHaveAttribute('dir', 'rtl');
});

for (const [story, globals, narrow] of [
  ['phase-23-buttongroup--states', undefined, false],
  ['phase-23-map--empty', undefined, false],
  ['phase-23-map--dark', 'theme:dark;density:comfortable;direction:ltr', false],
  ['phase-23-map--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', true],
  ['phase-23-richtexteditor--read-only-and-disabled', undefined, false],
  ['phase-23-richtexteditor--dark', 'theme:dark;density:comfortable;direction:ltr', false],
  ['phase-23-richtexteditor--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', true],
] as const) {
  test(`Phase 23 ${story} has no serious or critical Axe violations`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 780 });
    await openStory(page, story, globals);
    if (story.includes('map') && !story.includes('empty')) await expect(page.locator('[data-cg-map-ready]')).toBeVisible();
    if (story.includes('richtexteditor')) await expect(page.locator('.tiptap').first()).toBeVisible();
    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
  });
}
