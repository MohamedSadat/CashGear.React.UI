import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

for (const direction of ['ltr', 'rtl'] as const) {
  test(`Phase 29 virtual geometry, focus, selection and exports ${direction}`, async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 850 });
    await openStory(page, 'phase-29-grid--virtual-review', `theme:light;direction:${direction}`);
    const grid = page.getByRole('grid', { name: 'Review records' });
    await expect(page.getByLabel('Virtualization status')).toHaveText('Rows: virtual; columns: virtual');
    expect(await grid.locator('[data-cg-grid-row]').count()).toBeLessThan(25);
    expect(await grid.getByRole('columnheader').count()).toBeLessThan(23);
    await page.getByRole('button', { name: 'Focus record 900', exact: true }).click();
    const focused = grid.locator('[data-row-key="number:900"] [data-column-id="extra18"]');
    await expect(focused).toBeFocused();
    await expect(focused).toBeInViewport();
    const geometry = await grid.evaluate((table, dir) => {
      const scroller = table.parentElement!;
      const name = table.querySelector('th[data-column-id="name"]')!.getBoundingClientRect();
      const amount = table.querySelector('th[data-column-id="amount"]')!.getBoundingClientRect();
      const bounds = scroller.getBoundingClientRect();
      const row = table.querySelector('[data-row-key="number:900"]')!.getBoundingClientRect();
      return { gap: dir === 'rtl' ? name.left - amount.right : amount.left - name.right, edge: dir === 'rtl' ? bounds.right - name.right : name.left - bounds.left, rowHeight: row.height };
    }, direction);
    expect(Math.abs(geometry.gap)).toBeLessThan(2);
    expect(Math.abs(geometry.edge)).toBeLessThan(2);
    expect(geometry.rowHeight).toBe(40);
    const resize = grid.getByRole('separator', { name: 'Resize Name', exact: true });
    await resize.focus();
    await resize.press(direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
    await expect(resize).toHaveAttribute('aria-valuenow', '168');
    const boundary = await grid.locator('th[data-column-id="amount"]').evaluate((cell) => cell.style.getPropertyValue('--cg-grid-frozen-offset'));
    expect(boundary).toBe('168px');
    await focused.focus();
    await focused.press('ArrowDown');
    await expect(grid.locator('[data-row-key="number:901"] [data-column-id="extra18"]')).toBeFocused();
    await grid.locator('[data-row-key="number:901"] [data-column-id="name"]').click();
    await page.getByRole('button', { name: 'Export selection', exact: true }).click();
    await expect(page.getByLabel('Export result')).toHaveText('Exported 1 selected records');
    await page.getByRole('button', { name: 'Export all', exact: true }).click();
    await expect(page.getByLabel('Export result')).toHaveText('Exported 1000 records');
    const metricHeader = grid.getByRole('button', { name: 'Metric 18', exact: true });
    await metricHeader.focus();
    await grid.evaluate((table) => { table.parentElement!.scrollLeft = 0; table.parentElement!.dispatchEvent(new Event('scroll')); });
    await expect(grid.getByRole('button', { name: 'Region', exact: true })).toBeAttached();
    await expect(metricHeader).toBeFocused();
    await grid.getByRole('button', { name: 'Amount', exact: true }).focus();
    await grid.getByRole('button', { name: 'Amount', exact: true }).press(direction === 'rtl' ? 'Control+Shift+ArrowRight' : 'Control+Shift+ArrowLeft');
    await expect(grid.getByRole('columnheader').first().getByRole('button')).toHaveText('Amount');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('Phase 29 grouping and editing use complete rows and restore virtualization', async ({ page }) => {
  await openStory(page, 'phase-29-grid--virtual-review');
  await page.getByRole('button', { name: 'Group by region', exact: true }).click();
  await expect(page.getByLabel('Virtualization status')).toHaveText('Rows: grouped; columns: virtual');
  await page.getByRole('button', { name: 'Clear grouping', exact: true }).click();
  await page.getByRole('button', { name: 'Edit first record', exact: true }).click();
  await expect(page.getByLabel('Virtualization status')).toHaveText('Rows: editing; columns: editing');
  await page.getByRole('textbox', { name: 'Name *', exact: true }).fill('Draft change');
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
  await expect(page.getByLabel('Virtualization status')).toHaveText('Rows: virtual; columns: virtual');
  await expect(page.getByRole('grid').getByText('Record 1', { exact: true })).toBeVisible();
});

test('Phase 29 remote adapter exports beyond the viewport', async ({ page }) => {
  await openStory(page, 'phase-29-grid--remote-adapter');
  await expect(page.getByRole('grid').getByText('Record 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Export all', exact: true }).click();
  await expect(page.getByLabel('Export result')).toHaveText('Exported 1000 records');
});
