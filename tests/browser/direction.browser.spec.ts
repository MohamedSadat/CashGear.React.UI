import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openStory, storyUrl } from './storybook';

const RTL_PAGE = 'theme:light;density:comfortable;direction:rtl';
const RTL_STORY = 'foundation-direction--inherits-rtl';
const LTR_ISLAND_STORY = 'foundation-direction--inherits-ltr-island';

const CONTROLS = [
  'Accordion', 'Calendar', 'ComboBox', 'DateEdit', 'DateRangePicker', 'DateRangePresetSelect', 'DropDownBox',
  'DropDownButton', 'FileUploader', 'FormLayout', 'Grid', 'ListBox', 'LookUpGrid', 'MaskedInput', 'Menu', 'PdfViewer',
  'RichTextEditor', 'Scheduler', 'SplitButton', 'Stepper', 'Tabs', 'TagBox', 'TimeEdit', 'Toolbar', 'TreeList', 'TreeView',
];

/** Popups close when an ancestor scrolls, so let the scroll to the control finish before opening one. */
async function scrollIntoPlace(page: Page, section: Locator) {
  await section.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(resolve); }); }));
}

function rootDirections(page: Page) {
  return page.locator('[data-direction-parent]').evaluateAll((parents) => Object.fromEntries(parents.map((parent) => {
    const root = parent.firstElementChild as HTMLElement;
    return [parent.closest<HTMLElement>('[data-direction-control]')!.dataset.directionControl!, `${root.dir}/${getComputedStyle(root).direction}`];
  })));
}

test('every control that writes its own dir follows an RTL page with direction omitted', async ({ page }) => {
  await openStory(page, RTL_STORY, RTL_PAGE);
  expect(await rootDirections(page)).toEqual(Object.fromEntries(CONTROLS.map((name) => [name, 'rtl/rtl'])));
});

test('every control follows an LTR island inside an RTL page', async ({ page }) => {
  await openStory(page, LTR_ISLAND_STORY, RTL_PAGE);
  expect(await rootDirections(page)).toEqual(Object.fromEntries(CONTROLS.map((name) => [name, 'ltr/ltr'])));
});

test('controls follow the page when its direction changes after mount', async ({ page }) => {
  await openStory(page, RTL_STORY, RTL_PAGE);
  const setPageDirection = (direction: 'ltr' | 'rtl') => page.locator('main').evaluate((main, value) => { main.setAttribute('dir', value); }, direction);
  await setPageDirection('ltr');
  await expect.poll(() => rootDirections(page)).toEqual(Object.fromEntries(CONTROLS.map((name) => [name, 'ltr/ltr'])));
  await setPageDirection('rtl');
  await expect.poll(() => rootDirections(page)).toEqual(Object.fromEntries(CONTROLS.map((name) => [name, 'rtl/rtl'])));
});

test('a control in an RTL page is never painted LTR on its way to RTL', async ({ page }) => {
  await page.addInitScript(() => {
    const seen = new Set<string>();
    Object.assign(window, { directionsSeenAtPaint: seen });
    const sample = () => {
      document.querySelectorAll<HTMLElement>('[data-direction-parent] > [dir]').forEach((root) => {
        seen.add(`${root.parentElement!.closest<HTMLElement>('[data-direction-control]')!.dataset.directionControl}:${root.dir}`);
      });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto(storyUrl(RTL_STORY, RTL_PAGE), { waitUntil: 'networkidle' });
  await page.locator('[data-direction-control="TreeView"] [role="tree"]').waitFor();
  const seen = await page.evaluate(() => [...(window as unknown as { directionsSeenAtPaint: Set<string> }).directionsSeenAtPaint]);
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.filter((entry) => entry.endsWith(':ltr'))).toEqual([]);
});

test('arrow keys mirror in an inherited RTL page', async ({ page }) => {
  await openStory(page, RTL_STORY, RTL_PAGE);

  const tabs = page.locator('[data-direction-control="Tabs"]');
  await tabs.getByRole('tab', { name: 'عام' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.getByRole('tab', { name: 'السطور' })).toBeFocused();

  const stepper = page.locator('[data-direction-control="Stepper"]');
  await stepper.getByRole('button', { name: /العميل/u }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(stepper.getByRole('button', { name: /السطور/u })).toBeFocused();

  const toolbar = page.locator('[data-direction-control="Toolbar"]');
  await toolbar.getByRole('button', { name: 'حفظ' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(toolbar.getByRole('button', { name: 'طباعة' })).toBeFocused();

  const calendar = page.locator('[data-direction-control="Calendar"]');
  const focusedDay = () => calendar.locator('[role="gridcell"] button:focus, button[role="gridcell"]:focus').getAttribute('data-date');
  await calendar.locator('[role="gridcell"] button[tabindex="0"], button[role="gridcell"][tabindex="0"]').first().focus();
  const start = await focusedDay();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(focusedDay).not.toBe(start);
  expect((await focusedDay())! > start!).toBe(true);
});

test('popups open RTL and start at the right edge of an inherited RTL control', async ({ page }) => {
  await openStory(page, RTL_STORY, RTL_PAGE);
  for (const name of ['ComboBox', 'TagBox', 'DropDownBox', 'LookUpGrid', 'DateEdit', 'DateRangePicker', 'TimeEdit']) {
    const section = page.locator(`[data-direction-control="${name}"]`);
    await scrollIntoPlace(page, section);
    await section.getByRole('button').last().click();
    const popup = page.locator('body > [dir]:visible');
    await expect(popup, name).toHaveCount(1);
    await expect(popup, name).toHaveAttribute('dir', 'rtl');
    const control = await section.locator('[data-direction-parent] > [dir]').boundingBox();
    const box = await popup.boundingBox();
    expect(Math.abs((control!.x + control!.width) - (box!.x + box!.width)), `${name} popup right edge`).toBeLessThan(2);
    await page.keyboard.press('Escape');
    await expect(popup, name).toHaveCount(0);
  }
});

test('command menus inherit RTL through their surfaces', async ({ page }) => {
  await openStory(page, RTL_STORY, RTL_PAGE);

  const dropDown = page.locator('[data-direction-control="DropDownButton"]');
  await scrollIntoPlace(page, dropDown);
  await dropDown.getByRole('button', { name: 'الإجراءات' }).click();
  const dropDownMenu = page.getByRole('menu');
  await expect(dropDownMenu).toHaveAttribute('dir', 'rtl');
  await page.keyboard.press('Escape');

  const split = page.locator('[data-direction-control="SplitButton"]');
  await scrollIntoPlace(page, split);
  await split.getByRole('button').last().click();
  await expect(page.getByRole('menu')).toHaveAttribute('dir', 'rtl');
  await page.keyboard.press('Escape');

  const context = page.locator('[data-direction-control="ContextMenu"]');
  await scrollIntoPlace(page, context);
  await context.getByRole('button', { name: 'قائمة السياق' }).click({ button: 'right' });
  await expect(page.getByRole('menu', { name: 'قائمة السياق' })).toHaveAttribute('dir', 'rtl');
});

test('a context menu on an LTR island stays LTR inside an RTL page', async ({ page }) => {
  await openStory(page, LTR_ISLAND_STORY, RTL_PAGE);
  const context = page.locator('[data-direction-control="ContextMenu"]');
  await scrollIntoPlace(page, context);
  await context.getByRole('button', { name: 'قائمة السياق' }).click({ button: 'right' });
  await expect(page.getByRole('menu', { name: 'قائمة السياق' })).toHaveAttribute('dir', 'ltr');
});

test('the rich text editor applies an inherited RTL direction to its editing surface', async ({ page }) => {
  await openStory(page, RTL_STORY, RTL_PAGE);
  await expect(page.locator('[data-direction-control="RichTextEditor"]').getByRole('textbox', { name: 'الوصف' })).toHaveAttribute('dir', 'rtl');
});
