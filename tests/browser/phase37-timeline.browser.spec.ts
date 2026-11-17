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

/** The centre of a bar, or a point `days` whole days further along the time axis from it (to the left in right to left). */
async function barPoint(page: Page, key: string, days = 0, rtl = true) {
  const bar = page.locator(`[data-cg-timeline-item="${key}"]`);
  const box = (await bar.boundingBox())!;
  const width = await bar.evaluate((element) => parseFloat(getComputedStyle(element.closest('[data-cg-timeline]')!).getPropertyValue('--cg-timeline-day') || '0'));
  return { x: box.x + box.width / 2 + (rtl ? -1 : 1) * days * (width || 20), y: box.y + box.height / 2 };
}

for (const [story, globals] of [
  ['phase-37-timeline--arabic-lanes', RTL],
  ['phase-37-timeline--arabic-lanes-dark', DARK_RTL],
  ['phase-37-timeline--english-days', LIGHT],
  ['phase-37-timeline--fifty-thousand-items', RTL],
  ['phase-37-timeline--arabic-undated-drop', RTL],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.getByTestId('timeline')).toBeVisible();
    await expect(page.getByRole('grid').getByRole('row').first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test.describe('CgTimeline in Arabic', () => {
  test('runs time from right to left, one tab stop over its lines, lanes that collapse', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--arabic-lanes', RTL);
    const grid = page.getByRole('grid', { name: 'الجدول الزمني للمشروع' });
    const scope = grid.getByRole('button', { name: /^تحديد نطاق المشروع/u });
    const budget = grid.getByRole('button', { name: /^مراجعة الميزانية/u });
    // A later item is further left.
    expect((await budget.boundingBox())!.x).toBeLessThan((await scope.boundingBox())!.x);
    await expect(grid.locator('[tabindex="0"]')).toHaveCount(1);
    const plan = grid.getByRole('button', { name: 'التخطيط', exact: true });
    await expect(plan).toHaveAttribute('tabindex', '0');
    await plan.focus();
    await page.keyboard.press('ArrowDown');
    await expect(scope).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(plan).toHaveAttribute('aria-expanded', 'false');
    await expect(budget).toHaveCount(0);
    await page.keyboard.press('Space');
    await expect(plan).toHaveAttribute('aria-expanded', 'true');
  });

  test('moves and resizes a focused bar by keys, mirrored, and announces it', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--arabic-lanes', RTL);
    const budget = page.getByRole('grid').getByRole('button', { name: /^مراجعة الميزانية/u });
    await budget.focus();
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.getByTestId('last-action')).toHaveText('move:budget:2026-11-10:2026-11-14:keyboard');
    await expect(page.locator('[data-cg-live-announcer]')).toHaveText(`نُقل «مراجعة الميزانية» ليبدأ ${await fullDate(page, 'ar', '2026-11-10')}`);
    await page.keyboard.press('Alt+Shift+ArrowLeft');
    await expect(page.getByTestId('last-action')).toHaveText('end:budget:2026-11-10:2026-11-15:keyboard');
    await page.keyboard.press('Control+Shift+ArrowRight');
    await expect(page.getByTestId('last-action')).toHaveText('start:budget:2026-11-09:2026-11-15:keyboard');
    await expect(budget).toBeFocused();
    await expect(budget).toHaveAccessibleName(`مراجعة الميزانية، من ${await fullDate(page, 'ar', '2026-11-09')} إلى ${await fullDate(page, 'ar', '2026-11-15')}`);
  });

  test('drags a bar\'s body and an edge by whole days, and opens it on a click', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--arabic-lanes', RTL);
    const from = await barPoint(page, 'suppliers');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 10, from.y, { steps: 2 });
    await page.mouse.move(from.x - 60, from.y, { steps: 6 });
    await expect(page.locator('[data-cg-timeline-item="suppliers"]')).toHaveAttribute('data-cg-dragging', '');
    await page.mouse.up();
    await expect(page.getByTestId('last-action')).toHaveText('move:suppliers:2026-11-14:2026-11-28:pointer');
    const bar = page.locator('[data-cg-timeline-item="suppliers"]');
    const box = (await bar.boundingBox())!;
    // The end edge is the bar's left side in right to left.
    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 10, box.y + box.height / 2, { steps: 2 });
    await page.mouse.move(box.x - 36, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId('last-action')).toHaveText('end:suppliers:2026-11-14:2026-11-30:pointer');
    await page.getByRole('grid').getByRole('button', { name: /^جرد المخزون/u }).click();
    await expect(page.getByTestId('last-action')).toHaveText('open:stock:pointer');
  });

  test('switches the scale with its buttons and reports the days shown', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--arabic-lanes', RTL);
    await expect(page.getByTestId('range')).toHaveText(/^2026-11-01:2026-1[12]-\d\d$/u);
    const month = page.getByRole('group', { name: 'المقياس' }).getByRole('button', { name: 'شهر' });
    await month.click();
    await expect(month).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('scale')).toHaveText('month');
    await expect(page.getByTestId('range')).not.toHaveText(/^2026-11-01:/u);
  });

  test('takes an undated item dragged onto a day and a lane', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--arabic-undated-drop', RTL);
    const source = page.getByTestId('undated-supplier');
    const from = (await source.boundingBox())!;
    const to = await barPoint(page, 'budget', 2);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 2 });
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await expect(page.locator('[data-cg-timeline-drop][data-shown]')).toHaveCount(1);
    await page.mouse.up();
    await expect(page.getByTestId('last-action')).toHaveText(/^place:supplier:2026-11-1\d:plan:pointer$/u);
    await expect(page.locator('[data-cg-timeline-drop][data-shown]')).toHaveCount(0);
    await expect(page.getByRole('grid').getByRole('button', { name: /^تحديث بيانات المورد/u })).toBeVisible();
  });
});

test.describe('CgTimeline with 50,000 items', () => {
  test('draws its first bars quickly and only the lines in view, and reaches the last line by End', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--fifty-thousand-items', RTL);
    await expect(page.getByTestId('first-draw-ms')).toHaveText(/^\d+$/u);
    expect(Number(await page.getByTestId('first-draw-ms').textContent())).toBeLessThan(500);
    const grid = page.getByRole('grid');
    await expect(grid).toHaveAttribute('aria-rowcount', '50000');
    expect(await grid.getByRole('row').count()).toBeLessThan(60);
    await grid.getByRole('button', { name: /^مهمة رقم 1،/u }).focus();
    await page.keyboard.press('End');
    await expect(grid.getByRole('button', { name: /^مهمة رقم 50000،/u })).toBeFocused();
    expect(await grid.getByRole('row').count()).toBeLessThan(60);
  });
});

test.describe('CgTimeline in English', () => {
  test('runs time from left to right at the day scale, today in view', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--english-days', LIGHT);
    const grid = page.getByRole('grid', { name: 'Project timeline' });
    const close = grid.getByRole('button', { name: /^Quarter close/u });
    const payroll = grid.getByRole('button', { name: /^Payroll/u });
    expect((await payroll.boundingBox())!.x).toBeGreaterThan((await close.boundingBox())!.x);
    await expect(page.getByRole('button', { name: 'Day', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await payroll.focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page.getByTestId('last-action')).toHaveText('move:payroll:2026-11-17:-:keyboard');
  });
});
