import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openStory } from './storybook';

test('scheduler views, editing, validation, delete and focus restoration', async ({ page }) => {
  await openStory(page, 'data-scheduler--day');
  const planning = page.getByRole('button', { name: /Project planning,/ });
  await planning.focus(); await planning.press('Enter');
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await dialog.getByLabel('Title', { exact: true }).fill('Updated planning');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  const updated = page.getByRole('button', { name: /Updated planning,/ }); await expect(updated).toBeFocused();
  await updated.press('Delete');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(updated).toHaveCount(0);
  await page.getByRole('button', { name: 'Create appointment', exact: true }).click();
  await dialog.getByLabel('Title', { exact: true }).fill('New appointment');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: /New appointment,/ })).toBeVisible();
  for (const view of ['workWeek', 'week', 'month', 'timeline']) { await page.getByRole('combobox', { name: 'View', exact: true }).selectOption(view); await expect(page.getByRole('grid')).toBeVisible(); }
});

test('scheduler timed drag and resize use dedicated callbacks', async ({ page }) => {
  await openStory(page, 'data-scheduler--day');
  const appointment = page.getByRole('button', { name: /Project planning,/ });
  const box = await appointment.boundingBox(); expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 25, box!.y + 15); await page.mouse.down(); await page.mouse.move(box!.x + 25, box!.y + 79, { steps: 8 }); await page.mouse.up();
  await expect(page.getByTestId('last-action')).toContainText('drag: Project planning 2026-09-07T10:00:00.000Z');
  const handle = appointment.locator('..').locator('[data-resize="end"]'); const resize = await handle.boundingBox(); expect(resize).not.toBeNull();
  await page.mouse.move(resize!.x + resize!.width / 2, resize!.y + 2); await page.mouse.down(); await page.mouse.move(resize!.x + resize!.width / 2, resize!.y + 34, { steps: 6 }); await page.mouse.up();
  await expect(page.getByTestId('last-action')).toContainText('resize: Project planning');
  await expect(page.getByTestId('last-action')).toContainText('2026-09-07T12:00:00.000Z');
});

test('scheduler Timeline snaps within a scale cell', async ({ page }) => {
  await openStory(page, 'data-scheduler--timeline');
  const appointment = page.getByRole('button', { name: /Project planning,/ });
  await appointment.scrollIntoViewIfNeeded();
  const box = await appointment.boundingBox(); const cell = await page.locator('[data-scheduler-cell]').nth(9).boundingBox();
  expect(box).not.toBeNull(); expect(cell).not.toBeNull();
  expect(Math.abs(box!.x - cell!.x)).toBeLessThan(2);
  await page.mouse.move(box!.x + 12, box!.y + 15); await page.mouse.down(); await page.mouse.move(box!.x + 12 + cell!.width / 2, box!.y + 15, { steps: 8 }); await page.mouse.up();
  await expect(page.getByTestId('last-action')).toContainText('drag: Project planning 2026-09-07T09:30:00.000Z');
});

test('scheduler partial Timeline scale keeps appointments aligned to cells', async ({ page }) => {
  await openStory(page, 'data-scheduler--partial-timeline');
  const cells = page.locator('[data-scheduler-cell]'); await expect(cells).toHaveCount(3);
  const first = await cells.nth(0).boundingBox(); const last = await cells.nth(2).boundingBox();
  const appointment = await page.getByRole('button', { name: /Partial scale,/ }).boundingBox();
  expect(Math.abs(first!.width / 2 - last!.width)).toBeLessThan(2);
  expect(Math.abs(appointment!.x + appointment!.width - last!.x - last!.width)).toBeLessThan(2);
});

test('scheduler selection, keyboard, RTL and read-only behavior', async ({ page }) => {
  await openStory(page, 'data-scheduler--week');
  const first = page.locator('[data-scheduler-cell][data-all-day="true"]').first();
  await first.focus(); await first.press('ArrowRight'); await expect(page.locator('[data-scheduler-cell][data-all-day="true"]').nth(1)).toBeFocused();
  await openStory(page, 'data-scheduler--arabic-rtl');
  const rtl = page.locator('[data-scheduler-cell][data-all-day="true"]');
  await rtl.first().focus(); await rtl.first().press('ArrowLeft'); await expect(rtl.nth(1)).toBeFocused();
  await openStory(page, 'data-scheduler--read-only');
  await expect(page.getByRole('grid')).toHaveAttribute('aria-readonly', 'true');
  await page.getByRole('button', { name: /Project planning,/ }).dblclick(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create appointment' })).toHaveCount(0);
});

test('scheduler all-day dragging, range selection and Escape cancellation', async ({ page }) => {
  await openStory(page, 'data-scheduler--week');
  const offsite = page.getByRole('button', { name: /Team offsite,/ });
  const box = await offsite.boundingBox(); const day = await page.locator('[data-scheduler-cell][data-all-day="true"]').first().boundingBox();
  expect(box).not.toBeNull(); expect(day).not.toBeNull();
  await page.mouse.move(box!.x + 20, box!.y + 12); await page.mouse.down(); await page.mouse.move(box!.x + 20 + day!.width, box!.y + 12, { steps: 8 }); await page.mouse.up();
  await expect(page.getByTestId('last-action')).toContainText('drag: Team offsite 2026-09-09T00:00:00.000Z 2026-09-11T00:00:00.000Z');
  await openStory(page, 'data-scheduler--day');
  // Select 11:00–12:30 in an empty interval.
  const cells = page.locator('[data-scheduler-cell][data-all-day="false"]');
  const origin = await cells.nth(6).boundingBox(); expect(origin).not.toBeNull();
  await page.mouse.move(origin!.x + 10, origin!.y + 10); await page.mouse.down(); await page.mouse.move(origin!.x + 10, origin!.y + 74, { steps: 8 }); await page.mouse.up();
  await expect(cells.nth(6)).toHaveAttribute('aria-selected', 'true'); await expect(cells.nth(8)).toHaveAttribute('aria-selected', 'true');
  await cells.nth(6).focus(); await page.keyboard.press('Escape'); await expect(cells.nth(6)).toHaveAttribute('aria-selected', 'false');
  // A canceled drag must not persist anything.
  const appointment = page.getByRole('button', { name: /Project planning,/ }); const a = await appointment.boundingBox();
  await page.mouse.move(a!.x + 20, a!.y + 15); await page.mouse.down(); await page.mouse.move(a!.x + 20, a!.y + 60, { steps: 5 }); await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.getByTestId('last-action')).toHaveText('');
});

test('scheduler has accessible grid and popup semantics', async ({ page }) => {
  for (const story of ['dark', 'arabic-rtl', 'week']) {
    await openStory(page, `data-scheduler--${story}`, story === 'dark' ? 'theme:dark;density:comfortable;direction:ltr' : undefined);
    expect((await new AxeBuilder({ page }).include('#storybook-root').analyze()).violations).toEqual([]);
  }
  await page.getByRole('button', { name: 'Create appointment' }).click();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
});

test('scheduler month overflow and provider navigation', async ({ page }) => {
  await openStory(page, 'data-scheduler--month');
  await page.getByRole('button', { name: '+1 more' }).click(); await expect(page.getByRole('dialog').getByRole('button', { name: 'Retrospective', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeHidden();
  await openStory(page, 'data-scheduler--remote-loading');
  await expect(page.getByRole('button', { name: /Project planning,/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await expect(page.getByRole('grid')).toHaveAttribute('aria-busy', 'false'); await expect(page.getByRole('button', { name: /Project planning,/ })).toHaveCount(0);
});
