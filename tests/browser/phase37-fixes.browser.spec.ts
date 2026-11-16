import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openStory } from './storybook';

const RTL = 'theme:light;density:comfortable;direction:rtl';
const DARK_RTL = 'theme:dark;density:comfortable;direction:rtl';

function watchProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text()); });
  return problems;
}

async function expectNoSeriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`)).toEqual([]);
}

/** The contrast of an element's text on its own background, both as the browser computed them. */
async function textContrast(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((element) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    const rgb = (css: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = '#000';
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    const luminance = (css: string) => rgb(css).map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
    const style = getComputedStyle(element);
    let background = style.backgroundColor;
    for (let node: Element | null = element; node && /rgba\(0, 0, 0, 0\)|transparent/u.test(background); node = node.parentElement) background = getComputedStyle(node).backgroundColor;
    const [light, dark] = [luminance(style.color), luminance(background)].sort((a, b) => b - a);
    return (light! + 0.05) / (dark! + 0.05);
  });
}

for (const [story, globals] of [
  ['phase-37-library-fixes--button-contrast', RTL],
  ['phase-37-library-fixes--button-contrast-dark', DARK_RTL],
  ['phase-37-library-fixes--splitter-header-and-fill', RTL],
  ['phase-37-library-fixes--drawer-math-size', RTL],
  ['phase-37-library-fixes--tabs-reorderable-click', RTL],
  ['phase-37-library-fixes--flyout-width-and-focus', RTL],
  ['phase-37-library-fixes--context-menu-dark', DARK_RTL],
  ['phase-37-library-fixes--chart-data-toggle', RTL],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-story-root]')).toBeVisible();
    await expectNoSeriousViolations(page);
    expect(problems).toEqual([]);
  });
}

test.describe('CgButton contrast', () => {
  test('solid buttons read at 4.5:1 or more in the dark theme, and soft ones in both themes', async ({ page }) => {
    await openStory(page, 'phase-37-library-fixes--button-contrast-dark', DARK_RTL);
    for (const intent of ['primary', 'secondary', 'info', 'success', 'warning', 'danger', 'neutral']) {
      expect(await textContrast(page, `[data-testid="solid-${intent}"]`), `dark solid ${intent}`).toBeGreaterThanOrEqual(4.5);
      expect(await textContrast(page, `[data-testid="soft-${intent}"]`), `dark soft ${intent}`).toBeGreaterThanOrEqual(4.5);
    }
    await openStory(page, 'phase-37-library-fixes--button-contrast', RTL);
    for (const intent of ['primary', 'secondary', 'info', 'success', 'warning', 'danger', 'neutral']) {
      expect(await textContrast(page, `[data-testid="solid-${intent}"]`), `light solid ${intent}`).toBeGreaterThanOrEqual(4.5);
      expect(await textContrast(page, `[data-testid="soft-${intent}"]`), `light soft ${intent}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe('CgSplitter', () => {
  test('keeps a pane header in place while its content scrolls, and the content fills the pane', async ({ page }) => {
    await openStory(page, 'phase-37-library-fixes--splitter-header-and-fill', RTL);
    await expect(page.getByRole('separator', { name: 'تغيير حجم التنقل والمحتوى' })).toBeVisible();
    const pane = page.getByRole('region', { name: 'المحتوى' });
    const header = pane.locator('header');
    const before = (await header.boundingBox())!;
    const scroller = page.getByTestId('main-content').locator('..');
    await scroller.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    expect(await scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await pane.evaluate((element) => element.scrollTop)).toBe(0);
    expect((await header.boundingBox())!.y).toBe(before.y);
    const navPane = (await page.getByRole('region', { name: 'التنقل' }).boundingBox())!;
    const fill = (await page.getByTestId('nav-content').boundingBox())!;
    const navHeader = (await page.getByRole('region', { name: 'التنقل' }).locator('header').boundingBox())!;
    expect(fill.y + fill.height).toBeGreaterThan(navPane.y + navPane.height - 20);
    expect(fill.y).toBeGreaterThanOrEqual(navHeader.y + navHeader.height);
  });
});

test.describe('CgDrawer', () => {
  test('opens to a min() size', async ({ page }) => {
    await openStory(page, 'phase-37-library-fixes--drawer-math-size', RTL);
    await expect(page.getByTestId('drawer-panel')).toBeVisible();
    const panel = page.locator('[data-cg-drawer-panel]');
    // min(16rem, 40vw) in a 1280 px viewport: 256 px.
    expect(Math.round((await panel.boundingBox())!.width)).toBe(256);
  });
});

test.describe('CgTabs', () => {
  test('selects a reorderable tab with a mouse click, and still reorders by dragging', async ({ page }) => {
    await openStory(page, 'phase-37-library-fixes--tabs-reorderable-click', RTL);
    const board = page.getByRole('tab', { name: 'لوحة' });
    await board.click();
    await expect(board).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('لوحة المهام')).toBeVisible();
    const from = (await page.getByRole('tab', { name: 'عام' }).boundingBox())!;
    const to = (await page.getByRole('tab', { name: 'تقويم' }).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 - 10, from.y + from.height / 2, { steps: 2 });
    await page.mouse.move(to.x + 4, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('tab-order')).toHaveText('board,calendar,general');
    await expect(board).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('CgFlyout', () => {
  test('keeps its explicit width, and mounted open takes focus from onAfterOpen', async ({ page }) => {
    await openStory(page, 'phase-37-library-fixes--flyout-width-and-focus', RTL);
    const surface = page.getByTestId('width-flyout');
    await expect(surface).toBeVisible();
    expect(Math.round((await surface.boundingBox())!.width)).toBe(300);
    await expect(page.getByRole('textbox', { name: 'الاسم' })).toBeFocused();
  });
});

test.describe('CgContextMenu', () => {
  test('draws light text on its dark surface in the dark theme', async ({ page }) => {
    await openStory(page, 'phase-37-library-fixes--context-menu-dark', DARK_RTL);
    await page.getByTestId('menu-target').click({ button: 'right' });
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    expect(await textContrast(page, '[role="menu"] [role="menuitem"]')).toBeGreaterThanOrEqual(4.5);
    await expectNoSeriousViolations(page);
  });
});

test.describe('CgChart', () => {
  test('makes its data toggle at least 24 px high', async ({ page }) => {
    await openStory(page, 'phase-37-library-fixes--chart-data-toggle', RTL);
    const toggle = page.locator('summary').first();
    await expect(toggle).toBeVisible();
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  });
});
