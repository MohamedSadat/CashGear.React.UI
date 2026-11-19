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
  ['phase-37-timeline--arabic-lane-moves', RTL],
  ['phase-37-timeline--english-lane-moves', LIGHT],
  ['phase-37-timeline--fifty-thousand-in-lanes', RTL],
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

/** The middle of a lane's header button, on its header line. */
async function lanePoint(page: Page, lane: string) {
  const box = (await page.locator(`[data-cg-timeline-lane="${lane}"]`).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses at `from`, travels past the drag threshold, then moves to `to` in steps. */
async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 8, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
}

const scrollTop = (page: Page) => page.locator('[data-cg-timeline-scroller]').evaluate((element) => element.scrollTop);

test.describe('CgTimeline moving between lanes, right to left', () => {
  const STORY = 'phase-37-timeline--arabic-lane-moves';

  test('drags a bar onto another lane\'s line while it moves by days, the lane marked, and the focus follows it there', async ({ page }) => {
    await openStory(page, STORY, RTL);
    const from = await barPoint(page, 'budget');
    // Two days later (further left), over the line of «التعاقد مع الموردين» in التنفيذ.
    const target = await barPoint(page, 'suppliers');
    await dragTo(page, from, { x: from.x - 40, y: target.y });
    const budget = page.locator('[data-cg-timeline-item="budget"]');
    await expect(budget).toHaveAttribute('data-cg-dragging', '');
    const mark = page.locator('[data-cg-timeline-lane-drop][data-shown]');
    await expect(mark).toHaveAttribute('data-lane', 'build');
    // The lane's header and its four lines are marked, and the bar is drawn on the line under the pointer.
    expect((await mark.boundingBox())!.height).toBeCloseTo(5 * 36, 0);
    expect(Math.abs((await budget.boundingBox())!.y - (await page.locator('[data-cg-timeline-item="suppliers"]').boundingBox())!.y)).toBeLessThan(2);
    await page.mouse.up();
    await expect(page.getByTestId('last-action')).toHaveText('move:budget:2026-11-11:2026-11-15:pointer:build');
    await expect(mark).toHaveCount(0);
    await expect(page.locator('[data-cg-live-announcer]')).toHaveText(`نُقل «مراجعة الميزانية» إلى «التنفيذ»، يبدأ ${await fullDate(page, 'ar', '2026-11-11')}`);
    // Now under التنفيذ, below its header, and still focused.
    const header = (await page.locator('[data-cg-timeline-lane="build"]').boundingBox())!;
    expect((await budget.boundingBox())!.y).toBeGreaterThan(header.y);
    await expect(budget).toBeFocused();
    await expect(budget).toBeInViewport();
  });

  test('takes a drop on a collapsed lane\'s header, and drops nothing on Escape', async ({ page }) => {
    await openStory(page, STORY, RTL);
    const grid = page.getByRole('grid');
    // Escape while over another lane: nothing marked, nothing moved.
    const from = await barPoint(page, 'budget');
    await dragTo(page, from, await barPoint(page, 'suppliers'));
    await expect(page.locator('[data-cg-timeline-lane-drop][data-shown]')).toHaveAttribute('data-lane', 'build');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-cg-timeline-lane-drop][data-shown]')).toHaveCount(0);
    await expect(page.locator('[data-cg-timeline-item="budget"]')).not.toHaveAttribute('data-cg-dragging', '');
    await page.mouse.up();
    await expect(page.getByTestId('last-action')).toHaveText('');

    await grid.getByRole('button', { name: 'التخطيط', exact: true }).click();
    await expect(grid.getByRole('button', { name: 'التخطيط', exact: true })).toHaveAttribute('aria-expanded', 'false');
    const stock = await barPoint(page, 'stock');
    const plan = await lanePoint(page, 'plan');
    await dragTo(page, stock, { x: stock.x, y: plan.y });
    await expect(page.locator('[data-cg-timeline-lane-drop][data-shown]')).toHaveAttribute('data-lane', 'plan');
    await page.mouse.up();
    await expect(page.getByTestId('last-action')).toHaveText('move:stock:2026-11-18:2026-11-20:pointer:plan');
    await expect(page.locator('[data-cg-timeline-item="stock"]')).toHaveCount(0);
    await grid.getByRole('button', { name: 'التخطيط', exact: true }).click();
    await expect(page.locator('[data-cg-timeline-item="stock"]')).toBeVisible();
  });

  test('scrolls the lines while a bar is dragged near the bottom edge, and back up over the header', async ({ page }) => {
    await openStory(page, STORY, RTL);
    expect(await scrollTop(page)).toBe(0);
    const scroller = (await page.locator('[data-cg-timeline-scroller]').boundingBox())!;
    const from = await barPoint(page, 'kickoff');
    await dragTo(page, from, { x: from.x, y: scroller.y + scroller.height - 24 });
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(60);
    // Over the header the lines scroll back up; the first line shown takes the drop.
    await page.mouse.move(from.x, scroller.y + 20, { steps: 4 });
    await expect.poll(() => scrollTop(page)).toBe(0);
    await page.mouse.move(from.x, from.y, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByTestId('last-action')).toHaveText('');
  });

  test('moves a focused bar a lane down and up with Alt+ArrowDown and Alt+ArrowUp, keeping its days and the focus', async ({ page }) => {
    await openStory(page, STORY, RTL);
    const budget = page.getByRole('grid').getByRole('button', { name: /^مراجعة الميزانية/u });
    await expect(budget).toHaveAttribute('aria-keyshortcuts', /Alt\+ArrowUp Alt\+ArrowDown/u);
    await budget.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(page.getByTestId('last-action')).toHaveText('move:budget:2026-11-09:2026-11-13:keyboard:build');
    await expect(page.locator('[data-cg-live-announcer]')).toHaveText(`نُقل «مراجعة الميزانية» إلى «التنفيذ»، يبدأ ${await fullDate(page, 'ar', '2026-11-09')}`);
    await expect(budget).toBeFocused();
    expect((await budget.boundingBox())!.y).toBeGreaterThan((await page.locator('[data-cg-timeline-lane="build"]').boundingBox())!.y);
    // The day keys are as they were, mirrored; plain arrows still walk the lines.
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.getByTestId('last-action')).toHaveText('move:budget:2026-11-10:2026-11-14:keyboard');
    await page.keyboard.press('Alt+ArrowUp');
    await expect(page.getByTestId('last-action')).toHaveText('move:budget:2026-11-10:2026-11-14:keyboard:plan');
    await expect(budget).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('grid').getByRole('button', { name: /^اجتماع الانطلاق/u })).toBeFocused();
  });
});

test.describe('CgTimeline moving between lanes, left to right', () => {
  const STORY = 'phase-37-timeline--english-lane-moves';

  test('moves a bar to another lane by a drag and by keys, the keys the same as in right to left', async ({ page }) => {
    await openStory(page, STORY, LIGHT);
    const grid = page.getByRole('grid', { name: 'Project timeline' });
    // Today (Payroll's day) a fifth of the way in, away from the edges where a drag scrolls the days.
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    // A day later (further right), onto Team stand-up's line in In progress.
    const from = await barPoint(page, 'payroll', 0, false);
    const standupLine = await barPoint(page, 'standup', 0, false);
    await dragTo(page, from, { x: from.x + 48, y: standupLine.y });
    await expect(page.locator('[data-cg-timeline-lane-drop][data-shown]')).toHaveAttribute('data-lane', 'doing');
    await page.mouse.up();
    await expect(page.getByTestId('last-action')).toHaveText('move:payroll:2026-11-17:-:pointer:doing');

    const standup = grid.getByRole('button', { name: /^Team stand-up/u });
    await standup.focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(page.getByTestId('last-action')).toHaveText('move:standup:2026-11-16T14:30:00Z:-:keyboard:todo');
    await expect(page.locator('[data-cg-live-announcer]')).toHaveText(/^Team stand-up moved to To do, starting /u);
    await expect(standup).toBeFocused();
    // An item that cannot move keeps its lane.
    await grid.getByRole('button', { name: /^Tax filing due/u }).focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(page.getByTestId('last-action')).toHaveText('move:standup:2026-11-16T14:30:00Z:-:keyboard:todo');
  });
});

test.describe('CgTimeline moving between lanes by touch and pen', () => {
  test.use({ hasTouch: true });

  test('drags a bar onto another lane by touch and by pen as by mouse', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Touch and pen input are sent through the Chrome DevTools Protocol.');
    await openStory(page, 'phase-37-timeline--arabic-lane-moves', RTL);
    const cdp = await page.context().newCDPSession(page);
    const frame = () => page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); }));
    const path = (from: { x: number; y: number }, to: { x: number; y: number }) => Array.from({ length: 8 }, (_, index) => ({
      x: from.x + ((to.x - from.x) * (index + 1)) / 8, y: from.y + 8 + ((to.y - from.y - 8) * (index + 1)) / 8,
    }));

    // Touch, a day later onto the suppliers' line: the bar takes the pointer (touch-action: none), so the lines do not pan.
    const budget = await barPoint(page, 'budget');
    const suppliers = await barPoint(page, 'suppliers');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: budget.x, y: budget.y }] });
    for (const point of path(budget, { x: budget.x - 20, y: suppliers.y })) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
      await frame();
    }
    await expect(page.locator('[data-cg-timeline-lane-drop][data-shown]')).toHaveAttribute('data-lane', 'build');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByTestId('last-action')).toHaveText('move:budget:2026-11-10:2026-11-14:pointer:build');
    expect(await scrollTop(page)).toBe(0);

    // Pen: a day earlier, back onto التخطيط's header line.
    const back = await barPoint(page, 'budget');
    const plan = await lanePoint(page, 'plan');
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: back.x, y: back.y, pointerType: 'pen' });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: back.x, y: back.y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
    for (const point of path(back, { x: back.x + 20, y: plan.y })) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'left', buttons: 1, pointerType: 'pen' });
      await frame();
    }
    await expect(page.locator('[data-cg-timeline-lane-drop][data-shown]')).toHaveAttribute('data-lane', 'plan');
    const last = path(back, { x: back.x + 20, y: plan.y }).at(-1)!;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: last.x, y: last.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' });
    await expect(page.getByTestId('last-action')).toHaveText('move:budget:2026-11-09:2026-11-13:pointer:plan');
  });
});

test.describe('CgTimeline moving between lanes of 50,000 items', () => {
  test('draws its first bars quickly, and follows a bar moved to another lane to its new line', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--fifty-thousand-in-lanes', RTL);
    await expect(page.getByTestId('first-draw-ms')).toHaveText(/^\d+$/u);
    expect(Number(await page.getByTestId('first-draw-ms').textContent())).toBeLessThan(500);
    const grid = page.getByRole('grid');
    await expect(grid).toHaveAttribute('aria-rowcount', '50005');
    const first = grid.getByRole('button', { name: /^مهمة رقم 1،/u });
    await first.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(page.getByTestId('last-action')).toHaveText('move:row-0:2026-01-01:2026-01-02:keyboard:stage-1');
    // The first lane's other 9,999 lines, then the second lane's header: it is first there.
    await expect(first).toBeFocused();
    await expect(first.locator('xpath=ancestor::*[@role="row"]')).toHaveAttribute('aria-rowindex', '10002');
    await expect(first).toBeInViewport();
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
