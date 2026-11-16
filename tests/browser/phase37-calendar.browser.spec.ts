import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openStory } from './storybook';

const LIGHT = 'theme:light;density:comfortable;direction:ltr';
const RTL = 'theme:light;density:comfortable;direction:rtl';
const DARK_RTL = 'theme:dark;density:comfortable;direction:rtl';

function watchProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text()); });
  return problems;
}

/** A date's full name as the browser writes it, so digits and separators match the page. */
const fullDate = (page: Page, locale: string, iso: string) => page.evaluate(([language, value]) => new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', dateStyle: 'full' }).format(new Date(`${value}T00:00:00Z`)), [locale, iso] as const);

for (const [story, globals] of [
  ['phase-37-monthcalendar--arabic-month', RTL],
  ['phase-37-monthcalendar--arabic-month-dark', DARK_RTL],
  ['phase-37-monthcalendar--sunday-first-english', LIGHT],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.getByTestId('month-calendar')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test.describe('CgMonthCalendar in Arabic', () => {
  test('is a named grid starting on Saturday, today the one tab stop, arrows mirrored in right to left', async ({ page }) => {
    await openStory(page, 'phase-37-monthcalendar--arabic-month', RTL);
    const grid = page.getByRole('grid', { name: 'تقويم المهام' });
    await expect(grid.getByRole('columnheader').first()).toHaveAttribute('aria-label', 'السبت');
    const today = grid.getByRole('gridcell', { name: await fullDate(page, 'ar', '2026-11-16'), exact: true });
    await expect(today).toHaveAttribute('aria-current', 'date');
    await expect(today).toHaveAttribute('tabindex', '0');
    await expect(grid.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);
    await today.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(grid.getByRole('gridcell', { name: await fullDate(page, 'ar', '2026-11-17'), exact: true })).toBeFocused();
  });

  test('lists a full day in a dialog, opens items, and creates on a day', async ({ page }) => {
    await openStory(page, 'phase-37-monthcalendar--arabic-month', RTL);
    const day24 = await fullDate(page, 'ar', '2026-11-24');
    await page.getByRole('button', { name: `2 عناصر أخرى في ${day24}` }).click();
    const dialog = page.getByRole('dialog', { name: `عناصر ${day24}` });
    await expect(dialog.getByRole('button')).toHaveCount(5);
    await dialog.getByRole('button').last().click();
    await expect(page.getByTestId('last-action')).toHaveText(/^open:[a-z0-9-]+:list$/u);
    await page.getByRole('button', { name: `عنصر جديد في ${await fullDate(page, 'ar', '2026-11-16')}` }).click();
    await expect(page.getByTestId('last-action')).toHaveText('create:2026-11-16:button');
  });

  test('moves an item with Alt+arrows, keeping focus, and announces it; a fixed item does not move', async ({ page }) => {
    await openStory(page, 'phase-37-monthcalendar--arabic-month', RTL);
    const payroll = page.getByRole('button', { name: /صرف الرواتب/u }).first();
    await payroll.focus();
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.getByTestId('last-action')).toHaveText('move:payroll:2026-11-17:-:keyboard');
    await expect(page.getByRole('button', { name: /صرف الرواتب/u }).first()).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'صرف الرواتب' })).toContainText('نُقل «صرف الرواتب»');
    await expect(page.getByRole('button', { name: /موعد تسليم الإقرار/u }).first()).not.toHaveAttribute('aria-keyshortcuts');
  });

  test('moves an item to another day by dragging', async ({ page }) => {
    await openStory(page, 'phase-37-monthcalendar--arabic-month', RTL);
    const bar = page.getByRole('button', { name: /مراجعة الميزانية/u }).first();
    const target = page.getByRole('grid').getByRole('gridcell', { name: await fullDate(page, 'ar', '2026-11-05'), exact: true });
    const from = (await bar.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 - 10, from.y + from.height / 2, { steps: 2 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height - 10, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('last-action')).toHaveText('move:budget:2026-11-05:-:pointer');
  });
});

test.describe('CgMonthCalendar in English', () => {
  test('starts on Sunday and turns months', async ({ page }) => {
    await openStory(page, 'phase-37-monthcalendar--sunday-first-english', LIGHT);
    const grid = page.getByRole('grid', { name: 'Tasks calendar' });
    await expect(grid.getByRole('columnheader').first()).toHaveAttribute('aria-label', /Sunday|Sun/u);
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByTestId('month')).toHaveText('2026-12');
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(page.getByTestId('month')).toHaveText('2026-11');
    const monday = grid.getByRole('gridcell', { name: await fullDate(page, 'en-US', '2026-11-16'), exact: true });
    await monday.focus();
    await page.keyboard.press('ArrowRight');
    await expect(grid.getByRole('gridcell', { name: await fullDate(page, 'en-US', '2026-11-17'), exact: true })).toBeFocused();
  });
});
