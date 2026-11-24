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

const bar = (page: Page, key: string) => page.locator(`[data-cg-timeline-item="${key}"]`);
const link = (page: Page, id: string) => page.locator(`[data-cg-timeline-link="${id}"]`);
const route = (page: Page, id: string) => link(page, id).locator('path').first().getAttribute('d');

/**
 * Every drawn route sampled along its length, in the viewport, against every bar but its own two:
 * the points that fall inside another bar (none, when routed round them). Mirrored in right to left.
 */
function pointsInBars(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('[data-cg-timeline-links]');
    if (!svg) return ['no drawing'];
    const box = svg.getBoundingClientRect();
    const rtl = getComputedStyle(svg).direction === 'rtl';
    const bars = [...document.querySelectorAll<HTMLElement>('[data-cg-timeline-item]')].map((element) => ({ key: element.dataset.cgTimelineItem!, rect: element.getBoundingClientRect() }));
    const hits: string[] = [];
    for (const group of svg.querySelectorAll<SVGGElement>('[data-cg-timeline-link]')) {
      const id = group.dataset.cgTimelineLink!;
      const own = [group.dataset.cgTimelineLinkFrom, group.dataset.cgTimelineLinkTo];
      const path = group.querySelector('path')!;
      const length = path.getTotalLength();
      for (let along = 0; along <= length; along += 2) {
        const point = path.getPointAtLength(along);
        const x = rtl ? box.right - point.x : box.left + point.x;
        const y = box.top + point.y;
        for (const { key, rect } of bars) {
          if (own.includes(key)) continue;
          if (x > rect.left + 1 && x < rect.right - 1 && y > rect.top + 1 && y < rect.bottom - 1) hits.push(`${id} crosses ${key}`);
        }
      }
    }
    return [...new Set(hits)];
  });
}

for (const [story, globals] of [
  ['phase-37-timeline--arabic-links', RTL],
  ['phase-37-timeline--arabic-links-dark', DARK_RTL],
  ['phase-37-timeline--english-links', LIGHT],
  ['phase-37-timeline--fifty-thousand-with-links', RTL],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-timeline-link]').first()).toBeAttached();
    expect((await new AxeBuilder({ page }).include('[data-cg-story-root]').analyze()).violations).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test.describe('CgTimeline links in Arabic, right to left', () => {
  test('draws each arrow into the start of what it blocks, mirrored, never through a bar, and leaves the links out of the tab order', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--arabic-links', RTL);
    const drawing = page.locator('[data-cg-timeline-links]');
    await expect(drawing).toHaveAttribute('aria-hidden', 'true');
    await expect(drawing).toHaveCSS('pointer-events', 'none');
    // Time runs from right to left: the arrowhead sits just to the right of the blocked bar's start, its right edge.
    const head = (await link(page, 'scope-budget').locator('[data-head]').boundingBox())!;
    const budget = (await bar(page, 'budget').boundingBox())!;
    expect(Math.abs(head.x - (budget.x + budget.width))).toBeLessThanOrEqual(2);
    expect(Math.abs(head.y + head.height / 2 - (budget.y + budget.height / 2))).toBeLessThanOrEqual(2);
    expect(await pointsInBars(page)).toEqual([]);
    // A conflict is dashed in the danger colour; the others are not.
    await expect(link(page, 'suppliers-branch')).toHaveAttribute('data-conflict', '');
    await expect(link(page, 'scope-budget')).not.toHaveAttribute('data-conflict');
    const dashes = await link(page, 'suppliers-branch').locator('path').first().evaluate((path) => getComputedStyle(path).strokeDasharray);
    expect(dashes).not.toBe('none');
    const [conflict, plain, danger] = await page.evaluate(() => {
      const stroke = (selector: string) => getComputedStyle(document.querySelector(selector)!).stroke;
      const probe = document.createElement('span');
      probe.style.color = 'var(--cg-danger-text)';
      document.querySelector('[data-cg-timeline]')!.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return [stroke('[data-cg-timeline-link="suppliers-branch"] path'), stroke('[data-cg-timeline-link="scope-budget"] path'), color];
    });
    expect(conflict).toBe(danger);
    expect(plain).not.toBe(danger);
    // Tabbing from the timeline's one stop leaves it: no link is a stop.
    const grid = page.getByRole('grid');
    await grid.getByRole('button').first().focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-cg-timeline-links] :focus')).toHaveCount(0);
  });

  test('names what blocks each bar and what it blocks in its description, the conflicts too', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--arabic-links', RTL);
    const grid = page.getByRole('grid');
    await expect(grid.getByRole('button', { name: /^مراجعة الميزانية/u })).toHaveAccessibleDescription(/^تنتظر تحديد نطاق المشروع\. تنتظرها اجتماع الانطلاق\./u);
    await expect(grid.getByRole('button', { name: /^تجهيز الفرع الجديد/u })).toHaveAccessibleDescription(/^تنتظر جرد المخزون والتعاقد مع الموردين\. تبدأ قبل أن تنتهي التعاقد مع الموردين\./u);
    await expect(grid.getByRole('button', { name: /^التعاقد مع الموردين/u })).toHaveAccessibleDescription(/تنتظرها تجهيز الفرع الجديد\. تجهيز الفرع الجديد تبدأ قبل أن تنتهي هذه\./u);
  });

  test('follows a bar while it is dragged and moved to another lane, and returns when the drag is cancelled', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--arabic-links', RTL);
    const before = await route(page, 'budget-kickoff');
    const start = (await bar(page, 'budget').boundingBox())!;
    const x = start.x + start.width / 2;
    const y = start.y + start.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    // Three days later (to the left), then over التنفيذ's lines.
    for (let step = 1; step <= 6; step += 1) await page.mouse.move(x - step * 10, y);
    const moved = await route(page, 'budget-kickoff');
    expect(moved).not.toBe(before);
    expect(await pointsInBars(page)).toEqual([]);
    const lineBelow = (await bar(page, 'stock').boundingBox())!;
    for (let step = 1; step <= 6; step += 1) await page.mouse.move(x - 60, y + ((lineBelow.y + lineBelow.height / 2 - y) * step) / 6);
    const [, firstY] = /^M\S+ (\S+) /u.exec((await route(page, 'budget-kickoff'))!)!;
    const [, beforeY] = /^M\S+ (\S+) /u.exec(moved!)!;
    expect(Number(firstY)).toBeGreaterThan(Number(beforeY));
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect.poll(() => route(page, 'budget-kickoff')).toBe(before);
  });
});

test.describe('CgTimeline links in English, left to right', () => {
  test('draws each arrow into the left edge of what it blocks, a same-day link as a conflict', async ({ page }) => {
    await openStory(page, 'phase-37-timeline--english-links', LIGHT);
    const head = (await link(page, 'close-review').locator('[data-head]').boundingBox())!;
    const review = (await bar(page, 'review').boundingBox())!;
    expect(Math.abs(head.x + head.width - review.x)).toBeLessThanOrEqual(2);
    await expect(link(page, 'standup-payroll')).toHaveAttribute('data-conflict', '');
    expect(await pointsInBars(page)).toEqual([]);
    await expect(page.getByRole('grid').getByRole('button', { name: /^Payroll/u })).toHaveAccessibleDescription(/^Blocked by Team stand-up\. Starts before Team stand-up ends\./u);
  });
});

test.describe('CgTimeline with 50,000 items and 10,000 links', () => {
  test('draws its first bars within 500 ms, only the links in view, and drags a bar at 60 frames a second', async ({ page, browserName }) => {
    await openStory(page, 'phase-37-timeline--fifty-thousand-with-links', RTL);
    await expect(page.getByTestId('first-draw-ms')).toHaveText(/^\d+$/u);
    const firstDraw = Number(await page.getByTestId('first-draw-ms').textContent());
    test.info().annotations.push({ type: 'first bars', description: `${firstDraw} ms` });
    expect(firstDraw).toBeLessThan(500);
    const drawn = await page.locator('[data-cg-timeline-link]').count();
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(60);
    expect(await pointsInBars(page)).toEqual([]);
    test.skip(browserName !== 'chromium', 'Frame times are read in Chrome, as Workspace\'s bench reads them.');

    // The bench's drag: a bar with links, 120 moves out 300 px and back, after a warm-up drag; frames by requestAnimationFrame.
    const first = bar(page, 'row-0');
    const drag = async (measure: boolean) => {
      const box = (await first.boundingBox())!;
      const x0 = box.x + Math.min(box.width / 2, 4);
      const y0 = box.y + box.height / 2;
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      if (measure) {
        await page.evaluate(() => {
          const host = window as unknown as { frames_: number[]; framing: boolean };
          host.frames_ = [];
          host.framing = true;
          let last = performance.now();
          const tick = (now: number) => { host.frames_.push(now - last); last = now; if (host.framing) requestAnimationFrame(tick); };
          requestAnimationFrame((now) => { last = now; requestAnimationFrame(tick); });
        });
      }
      for (let step = 1; step <= 120; step += 1) {
        const along = step <= 60 ? step / 60 : (120 - step) / 60;
        await page.mouse.move(x0 - along * 300, y0 + Math.sin(step / 6) * 6);
      }
      const frames = measure ? await page.evaluate(() => {
        const host = window as unknown as { frames_: number[]; framing: boolean };
        host.framing = false;
        return host.frames_.splice(0).slice(2);
      }) : [];
      await page.mouse.move(x0 - 10, y0);
      await page.mouse.up();
      return frames;
    };
    await drag(false);
    const frames = (await drag(true)).sort((a, b) => a - b);
    const p95 = frames[Math.min(frames.length - 1, Math.floor(frames.length * 0.95))]!;
    test.info().annotations.push({ type: 'drag frames', description: `${frames.length} frames, p95 ${p95.toFixed(1)} ms` });
    expect(frames.length).toBeGreaterThan(10);
    expect(p95).toBeLessThanOrEqual(17.5);
  });
});
