import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openStory } from './storybook';

const LIGHT = 'theme:light;density:comfortable;direction:ltr';
const DARK = 'theme:dark;density:comfortable;direction:ltr';
const RTL = 'theme:light;density:comfortable;direction:rtl';

function watchProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text()); });
  return problems;
}

const center = async (locator: Locator) => {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const options = (page: Page, area: string) => page.getByRole('listbox', { name: area }).getByRole('option');

/** Drags with real mouse events, in steps, so the pane sees the move cross its threshold. */
async function dragTo(page: Page, from: Locator, to: { x: number; y: number }) {
  const start = await center(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 8, start.y + 8, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

for (const [story, globals] of [
  ['phase-36-pivotfieldlist--sales-example', LIGHT],
  ['phase-36-pivotfieldlist--empty', LIGHT],
  ['phase-36-pivotfieldlist--side-by-side', LIGHT],
  ['phase-36-pivotfieldlist--deferred', LIGHT],
  ['phase-36-pivotfieldlist--read-only', LIGHT],
  ['phase-36-pivotfieldlist--disabled-field', LIGHT],
  ['phase-36-pivotfieldlist--dark', DARK],
  ['phase-36-pivotfieldlist--arabic-rtl', RTL],
  ['phase-36-pivotfieldlist--arabic-rtl-read-only', RTL],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.getByTestId('field-list')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes[0]?.target.join(' ')})`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test.describe('CgPivotFieldList', () => {
  test('reorders and moves items by dragging, and removes one dropped outside', async ({ page }) => {
    await openStory(page, 'phase-36-pivotfieldlist--sales-example');
    const rows = page.getByRole('listbox', { name: 'Rows' });
    const region = rows.getByRole('option', { name: 'Region' });
    const date = rows.getByRole('option', { name: 'Date' });
    const below = await center(date);
    await dragTo(page, region, { x: below.x, y: below.y + 12 });
    await expect(options(page, 'Rows')).toHaveText(['Date', 'Region']);

    const columns = await center(page.getByRole('listbox', { name: 'Columns' }));
    await dragTo(page, rows.getByRole('option', { name: 'Region' }), { x: columns.x, y: columns.y + 20 });
    await expect(options(page, 'Columns')).toHaveText(['Σ Values', 'Region']);
    await expect(options(page, 'Rows')).toHaveText(['Date']);

    const pane = (await page.getByTestId('field-list').boundingBox())!;
    await dragTo(page, page.getByRole('listbox', { name: 'Columns' }).getByRole('option', { name: 'Region' }), { x: pane.x + pane.width + 120, y: pane.y + 100 });
    await expect(options(page, 'Columns')).toHaveText(['Σ Values']);
    await expect(page.getByRole('checkbox', { name: 'Region' })).not.toBeChecked();
    await expect(page.getByLabel('Last change')).toHaveText('remove region');
  });

  test('shows an insertion marker while dragging a field from the list', async ({ page }) => {
    await openStory(page, 'phase-36-pivotfieldlist--empty');
    const field = page.getByRole('listitem').filter({ hasText: 'Sales' });
    const start = await center(field);
    const values = await center(page.getByRole('listbox', { name: 'Values' }));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(values.x, values.y, { steps: 8 });
    await expect(page.getByRole('region', { name: 'Values' })).toHaveAttribute('data-drop-target', '');
    await expect(page.getByRole('listbox', { name: 'Values' })).toHaveAttribute('data-drop-empty', '');
    await page.mouse.up();
    await expect(options(page, 'Values')).toHaveText(['Sum of Sales']);
    await expect(page.getByRole('checkbox', { name: 'Sales' })).toBeChecked();
  });

  test('does the same from the keyboard through the item menu', async ({ page }) => {
    await openStory(page, 'phase-36-pivotfieldlist--sales-example');
    const region = page.getByRole('listbox', { name: 'Rows' }).getByRole('option', { name: 'Region' });
    await region.focus();
    await page.keyboard.press('Shift+F10');
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Move to Report Filter' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Move Down' }).focus();
    await page.keyboard.press('Enter');
    await expect(options(page, 'Rows')).toHaveText(['Date', 'Region']);
    await expect(page.getByRole('listbox', { name: 'Rows' }).getByRole('option', { name: 'Region' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByRole('menu').getByRole('menuitem', { name: 'Move to Report Filter' }).focus();
    await page.keyboard.press('Enter');
    await expect(options(page, 'Filters')).toHaveText(['Product', 'Region']);
    await expect(page.getByRole('listbox', { name: 'Filters' }).getByRole('option', { name: 'Region' })).toBeFocused();
  });

  test('holds changes until Update when deferred', async ({ page }) => {
    await openStory(page, 'phase-36-pivotfieldlist--deferred');
    await page.getByRole('checkbox', { name: 'Units' }).uncheck();
    await expect(options(page, 'Values')).toHaveText(['Sum of Sales']);
    await expect(page.getByLabel('Last change')).toHaveText('');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByLabel('Last change')).toHaveText('batch of 1');
    // The host drops Σ Values once one value is left.
    await expect(options(page, 'Columns')).toHaveCount(0);
  });

  test('mirrors in RTL', async ({ page }) => {
    await openStory(page, 'phase-36-pivotfieldlist--arabic-rtl', RTL);
    const filters = (await page.getByRole('region', { name: 'عوامل التصفية' }).boundingBox())!;
    const columns = (await page.getByRole('region', { name: 'الأعمدة' }).boundingBox())!;
    expect(filters.x).toBeGreaterThan(columns.x);
    const check = (await page.getByRole('checkbox', { name: 'المنطقة' }).boundingBox())!;
    const label = (await page.getByText('المنطقة', { exact: true }).first().boundingBox())!;
    expect(check.x).toBeGreaterThan(label.x);
  });
});
