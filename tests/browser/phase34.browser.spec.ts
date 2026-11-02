import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
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

async function centre(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2, box: box! };
}

for (const [story, globals] of [
  ['phase-34-statusbar--spreadsheet', LIGHT],
  ['phase-34-statusbar--zoom-control', LIGHT],
  ['phase-34-statusbar--long-text-truncates', LIGHT],
  ['phase-34-statusbar--priority-hiding', LIGHT],
  ['phase-34-statusbar--sizes', LIGHT],
  ['phase-34-statusbar--dark', DARK],
  ['phase-34-statusbar--arabic-rtl', RTL],
  ['phase-34-slider--controlled-and-uncontrolled', LIGHT],
  ['phase-34-slider--zoom-with-steppers-and-marks', LIGHT],
  ['phase-34-slider--sizes-marks-and-disabled', LIGHT],
  ['phase-34-slider--dark', DARK],
  ['phase-34-slider--arabic-rtl', RTL],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-status-bar], [data-cg-slider]').first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test('Phase 34 StatusBar is a thin bar with items at both ends, live region semantics, and buttons', async ({ page }) => {
  await openStory(page, 'phase-34-statusbar--spreadsheet');
  const bar = page.getByTestId('status-bar');
  await expect(bar).toHaveRole('status');
  await expect(bar).toHaveAttribute('aria-live', 'polite');
  await expect(bar).toHaveAttribute('aria-atomic', 'false');
  const barBox = (await bar.boundingBox())!;
  expect(barBox.height).toBe(24);
  const ready = (await page.getByTestId('status-ready').boundingBox())!;
  const sum = (await page.getByTestId('status-sum').boundingBox())!;
  expect(ready.x).toBeCloseTo(barBox.x, 0);
  expect(sum.x + sum.width).toBeCloseTo(barBox.x + barBox.width, 0);
  await expect(page.getByTestId('status-caps')).toHaveRole('button');
  await expect(page.getByTestId('status-ready')).toHaveAttribute('data-cg-status-bar-item', 'ready');
  await expect(page.getByTestId('status-caps').evaluate((element) => getComputedStyle(element, '::before').content)).resolves.not.toBe('none');
  await expect(page.getByTestId('status-ready').evaluate((element) => getComputedStyle(element, '::before').content)).resolves.toBe('none');
});

test('Phase 34 StatusBar sizes stay on one line at their own heights', async ({ page }) => {
  await openStory(page, 'phase-34-statusbar--sizes');
  for (const [size, height] of [['small', 20], ['medium', 24], ['large', 28]] as const) {
    const box = (await page.getByTestId(`status-bar-${size}`).boundingBox())!;
    expect(box.height).toBe(height);
  }
});

test('Phase 34 StatusBar truncates long text with an ellipsis without wrapping or growing', async ({ page }) => {
  await openStory(page, 'phase-34-statusbar--long-text-truncates');
  const bar = (await page.getByTestId('status-bar').boundingBox())!;
  expect(bar.height).toBe(24);
  expect(bar.width).toBe(420);
  const message = page.getByTestId('status-message');
  await expect(message).toHaveCSS('text-overflow', 'ellipsis');
  await expect(message).toHaveCSS('white-space', 'nowrap');
  const { scrollWidth, clientWidth } = await message.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
  expect(scrollWidth).toBeGreaterThan(clientWidth);
  await expect(page.getByTestId('status-sum')).toHaveText('Sum: 50');
  const sum = await page.getByTestId('status-sum').evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
  expect(sum.scrollWidth).toBe(sum.clientWidth);
  const messageBox = (await message.boundingBox())!;
  const sumBox = (await page.getByTestId('status-sum').boundingBox())!;
  expect(messageBox.x + messageBox.width).toBeLessThanOrEqual(sumBox.x + 1);
  expect(sumBox.x + sumBox.width).toBeLessThanOrEqual(bar.x + bar.width + 1);
});

test('Phase 34 StatusBar hides by priority as it narrows and restores as it widens', async ({ page }) => {
  const problems = watchProblems(page);
  await openStory(page, 'phase-34-statusbar--priority-hiding');
  const frame = page.getByTestId('priority-frame');
  const setWidth = (width: number) => frame.evaluate((element, next) => { (element as HTMLElement).style.inlineSize = `${next}px`; }, width);
  const items = { ready: page.getByTestId('status-ready'), caps: page.getByTestId('status-caps'), average: page.getByTestId('status-average'), count: page.getByTestId('status-count'), sum: page.getByTestId('status-sum') };
  for (const item of Object.values(items)) await expect(item).toBeVisible();
  const widthOf = (item: typeof items.ready) => item.evaluate((element) => element.getBoundingClientRect().width);
  const [ready, sum, average, caps, count] = await Promise.all([widthOf(items.ready), widthOf(items.sum), widthOf(items.average), widthOf(items.caps), widthOf(items.count)]);
  // Equal priorities hide the later item first, so Count goes before Caps Lock, then Average, Sum, and never Ready.
  await setWidth(Math.ceil(ready + sum + average + caps + count) - 2);
  await expect(items.count).toBeHidden();
  await expect(items.caps).toBeVisible();
  await setWidth(Math.ceil(ready + sum + average + caps) - 2);
  await expect(items.caps).toBeHidden();
  await expect(items.average).toBeVisible();
  await setWidth(Math.ceil(ready + sum + average) - 2);
  await expect(items.average).toBeHidden();
  await expect(items.sum).toBeVisible();
  await setWidth(Math.ceil(ready + sum) - 2);
  await expect(items.sum).toBeHidden();
  await setWidth(20);
  await expect(items.ready).toBeVisible();
  await expect(items.ready).toHaveCSS('min-inline-size', '0px');
  await setWidth(760);
  for (const item of Object.values(items)) await expect(item).toBeVisible();
  const fits = await frame.locator('[data-cg-status-bar]').evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(fits).toBe(true);
  expect(problems).toEqual([]);
});

test('Phase 34 StatusBar mirrors in RTL with Arabic labels', async ({ page }) => {
  await openStory(page, 'phase-34-statusbar--arabic-rtl', RTL);
  const bar = page.getByTestId('status-bar');
  await expect(bar).toHaveAccessibleName('شريط الحالة');
  const barBox = (await bar.boundingBox())!;
  const ready = (await page.getByTestId('status-ready').first().boundingBox())!;
  const sum = (await page.getByTestId('status-sum').first().boundingBox())!;
  expect(ready.x + ready.width).toBeCloseTo(barBox.x + barBox.width, 0);
  expect(sum.x).toBeCloseTo(barBox.x, 0);
  await expect(page.getByTestId('status-ready').first()).toHaveText('جاهز');
});

test('Phase 34 StatusBar carries a working zoom slider whose focus ring is not clipped', async ({ page }) => {
  const problems = watchProblems(page);
  await openStory(page, 'phase-34-statusbar--zoom-control');
  const slider = page.getByRole('slider', { name: 'Zoom' });
  await slider.press('End');
  await expect(page.getByTestId('zoom-value')).toHaveText('400%');
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(page.getByTestId('zoom-value')).toHaveText('390%');
  const bar = (await page.getByRole('status').boundingBox())!;
  const thumb = (await slider.boundingBox())!;
  expect(bar.height).toBe(24);
  expect(thumb.y).toBeGreaterThanOrEqual(bar.y);
  expect(thumb.y + thumb.height).toBeLessThanOrEqual(bar.y + bar.height);
  await expect(slider).toHaveCSS('outline-offset', '0px');
  expect(problems).toEqual([]);
});

test('Phase 34 Slider jumps on a track click, drags under pointer capture, and commits on release', async ({ page }) => {
  const problems = watchProblems(page);
  await openStory(page, 'phase-34-slider--controlled-and-uncontrolled');
  const root = page.getByTestId('controlled-slider');
  const thumb = root.getByRole('slider');
  const live = page.getByLabel('Live value');
  const committed = page.getByLabel('Committed value');
  await expect(thumb).toHaveAttribute('aria-valuenow', '40');
  await expect(thumb).toHaveAttribute('aria-valuetext', '40%');

  const track = (await root.locator('[data-cg-slider-track]').boundingBox())!;
  const y = track.y + track.height / 2;
  await page.mouse.click(track.x + track.width * 0.75, y);
  await expect(thumb).toHaveAttribute('aria-valuenow', '75');
  await expect(committed).toHaveText('75');
  await expect(thumb).toBeFocused();

  const start = await centre(page, '[data-testid="controlled-slider"] [data-cg-slider-thumb]');
  expect(start.x).toBeCloseTo(track.x + track.width * 0.75, 0);
  await page.mouse.move(start.x + 3, start.y);
  await page.mouse.down();
  await expect(thumb).toHaveAttribute('aria-valuenow', '75');
  await page.mouse.move(track.x + track.width * 0.25 + 3, y + 200);
  await expect(live).toHaveText('25');
  await expect(committed).toHaveText('75');
  await page.mouse.move(Math.max(1, track.x - 30), y + 100);
  await expect(live).toHaveText('0');
  await page.mouse.up();
  await expect(committed).toHaveText('0');
  await page.mouse.move(track.x + track.width / 2, y);
  await expect(live).toHaveText('0');

  await page.mouse.click(track.x + track.width + 4, y);
  await expect(thumb).toHaveAttribute('aria-valuenow', '100');
  expect(problems).toEqual([]);
});

test('Phase 34 Slider never stays in a drag after a release outside the viewport', async ({ page }) => {
  // Chromium and WebKit deliver this release through pointer capture. Playwright's Firefox delivers
  // nothing outside the viewport, so there the next move, with no button held, has to end the drag.
  await openStory(page, 'phase-34-slider--controlled-and-uncontrolled');
  const root = page.getByTestId('controlled-slider');
  const thumb = root.getByRole('slider');
  const live = page.getByLabel('Live value');
  const committed = page.getByLabel('Committed value');
  const track = (await root.locator('[data-cg-slider-track]').boundingBox())!;
  const y = track.y + track.height / 2;
  const start = await centre(page, '[data-testid="controlled-slider"] [data-cg-slider-thumb]');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * 0.25, y);
  await expect(live).toHaveText('25');
  await page.mouse.move(track.x - 300, y - 200);
  await page.mouse.up();
  await page.mouse.move(track.x + track.width * 0.9, y);
  await expect(committed).not.toHaveText('40');
  await expect(live).toHaveText((await committed.textContent())!);
  await expect(thumb).not.toHaveAttribute('aria-valuenow', '90');
});

test('Phase 34 Slider keeps its value on a secondary click and lets Tab reach the thumb', async ({ page }) => {
  await openStory(page, 'phase-34-slider--controlled-and-uncontrolled');
  const root = page.getByTestId('uncontrolled-slider');
  const thumb = root.getByRole('slider');
  const track = (await root.locator('[data-cg-slider-track]').boundingBox())!;
  await page.mouse.click(track.x + track.width * 0.8, track.y + track.height / 2, { button: 'right' });
  await expect(thumb).toHaveAttribute('aria-valuenow', '25');
  await page.keyboard.press('Escape');
  await page.getByTestId('controlled-slider').getByRole('slider').focus();
  await page.keyboard.press('Tab');
  await expect(thumb).toBeFocused();
  await thumb.press('ArrowRight');
  await expect(thumb).toHaveAttribute('aria-valuenow', '30');
  await thumb.press('PageUp');
  await expect(thumb).toHaveAttribute('aria-valuenow', '80');
  await thumb.press('PageDown');
  await expect(thumb).toHaveAttribute('aria-valuenow', '30');
  await thumb.press('End');
  await expect(thumb).toHaveAttribute('aria-valuenow', '100');
  await thumb.press('Home');
  await expect(thumb).toHaveAttribute('aria-valuenow', '0');
});

test('Phase 34 Slider steppers follow their amount and stop at the limits', async ({ page }) => {
  await openStory(page, 'phase-34-slider--zoom-with-steppers-and-marks');
  const root = page.getByTestId('zoom-slider');
  const thumb = root.getByRole('slider', { name: 'Zoom' });
  await expect(thumb).toHaveAttribute('aria-valuetext', '100%');
  const zoomIn = root.locator('[data-cg-slider-stepper="increase"]');
  const zoomOut = root.locator('[data-cg-slider-stepper="decrease"]');
  await expect(zoomIn).toHaveAccessibleName('Zoom in');
  await expect(zoomOut).toHaveAccessibleName('Zoom out');
  await zoomIn.click();
  await expect(thumb).toHaveAttribute('aria-valuenow', '110');
  await zoomOut.click();
  await zoomOut.click();
  await expect(thumb).toHaveAttribute('aria-valuenow', '90');
  await thumb.press('End');
  await expect(zoomIn).toBeDisabled();
  await thumb.press('Home');
  await expect(zoomOut).toBeDisabled();
  await expect(root.locator('[data-cg-slider-mark]')).toHaveCount(1);
  const rootBox = (await root.boundingBox())!;
  const zoomOutBox = (await zoomOut.boundingBox())!;
  const zoomInBox = (await zoomIn.boundingBox())!;
  expect(zoomOutBox.x).toBeCloseTo(rootBox.x, 0);
  expect(zoomInBox.x + zoomInBox.width).toBeCloseTo(rootBox.x + rootBox.width, 0);
});

test('Phase 34 Slider mirrors in RTL for pointer, keys, and layout', async ({ page }) => {
  const problems = watchProblems(page);
  await openStory(page, 'phase-34-slider--arabic-rtl', RTL);
  const root = page.getByTestId('rtl-slider');
  const thumb = root.getByRole('slider', { name: 'مستوى الصوت' });
  await expect(thumb).toHaveAttribute('aria-valuenow', '30');
  const track = (await root.locator('[data-cg-slider-track]').boundingBox())!;
  const thumbBox = (await thumb.boundingBox())!;
  expect(thumbBox.x + thumbBox.width / 2).toBeCloseTo(track.x + track.width * 0.7, 0);
  await thumb.press('ArrowRight');
  await expect(thumb).toHaveAttribute('aria-valuenow', '29');
  await thumb.press('ArrowLeft');
  await expect(thumb).toHaveAttribute('aria-valuenow', '30');
  await page.mouse.click(track.x + track.width * 0.25, track.y + track.height / 2);
  await expect(thumb).toHaveAttribute('aria-valuenow', '75');

  const zoom = page.getByTestId('zoom-slider');
  const decrease = (await zoom.getByRole('button', { name: 'تصغير' }).boundingBox())!;
  const increase = (await zoom.getByRole('button', { name: 'تكبير' }).boundingBox())!;
  expect(decrease.x).toBeGreaterThan(increase.x);
  await expect(zoom.getByRole('slider')).toHaveAttribute('aria-valuetext', '١٠٠٪');
  expect(problems).toEqual([]);
});

test('Phase 34 Slider with an explicit direction keeps it inside an opposite page', async ({ page }) => {
  await openStory(page, 'phase-34-slider--forced-ltr-inside-rtl', RTL);
  const root = page.getByTestId('ltr-slider');
  const thumb = root.getByRole('slider');
  const track = (await root.locator('[data-cg-slider-track]').boundingBox())!;
  const thumbBox = (await thumb.boundingBox())!;
  expect(thumbBox.x + thumbBox.width / 2).toBeCloseTo(track.x + track.width * 0.25, 0);
  await thumb.press('ArrowRight');
  await expect(thumb).toHaveAttribute('aria-valuenow', '26');
});

test('Phase 34 Slider disabled state blocks pointer and keyboard', async ({ page }) => {
  await openStory(page, 'phase-34-slider--sizes-marks-and-disabled');
  const thumb = page.getByRole('slider', { name: 'Disabled' });
  await expect(thumb).toHaveAttribute('aria-disabled', 'true');
  await expect(thumb).toHaveAttribute('tabindex', '-1');
  const box = (await thumb.boundingBox())!;
  await page.mouse.click(box.x - 40, box.y + box.height / 2);
  await expect(thumb).toHaveAttribute('aria-valuenow', '60');
});
