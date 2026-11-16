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

const fullDate = (page: Page, iso: string) => page.evaluate((value) => new Intl.DateTimeFormat('ar', { calendar: 'gregory', timeZone: 'UTC', dateStyle: 'full' }).format(new Date(`${value}T00:00:00Z`)), iso);

for (const [story, globals] of [
  ['phase-12-treeview--sidebar-sections-arabic', RTL],
  ['phase-12-treeview--sidebar-sections-arabic', DARK_RTL],
  ['phase-37-monthcalendar--arabic-undated-drop', RTL],
] as const) {
  test(`${story} (${globals.split(';')[0]}) has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-story-root]')).toBeVisible();
    await expectNoSeriousViolations(page);
    expect(problems).toEqual([]);
  });
}

test.describe('CgTreeView sidebar', () => {
  test('names rows by their title alone, keeps sections open, and marks the current page', async ({ page }) => {
    await openStory(page, 'phase-12-treeview--sidebar-sections-arabic', RTL);
    await expect(page.getByRole('treeitem', { name: 'دليل الموظفين', exact: true })).toBeVisible();
    const section = page.getByRole('treeitem', { name: 'المساحة', exact: true });
    await expect(section).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'طي المساحة' })).toHaveCount(0);
    await section.focus();
    await page.keyboard.press('ArrowRight');
    await expect(section).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-node-key="welcome"]')).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: 'توسيع المشاريع' }).click();
    await page.locator('[data-node-key="payroll"] > div').first().click();
    await expect(page.getByTestId('current-page')).toHaveText('payroll');
    await expect(page.locator('[data-node-key="payroll"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-node-key="welcome"]')).not.toHaveAttribute('aria-current');
  });

  test('lets the app\'s Ctrl+K through from a focused row, and still walks with the arrows', async ({ page }) => {
    await openStory(page, 'phase-12-treeview--sidebar-sections-arabic', RTL);
    const tasks = page.locator('[data-node-key="tasks"]');
    await tasks.focus();
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('last-tree-action')).toHaveText('shortcut:k');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('last-tree-action')).toHaveText('shortcut:k');
    await expect(tasks).not.toBeFocused();
  });

  test('reads selected text at 4.5:1 or more', async ({ page }) => {
    await openStory(page, 'phase-12-treeview--sidebar-sections-arabic', RTL);
    const ratio = await page.locator('[data-node-key="tasks"]').evaluate((item) => {
      const parse = (css: string) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.fillStyle = css;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3)).map((value) => {
          const channel = value / 255;
          return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
      };
      const text = document.getElementById(item.getAttribute('aria-labelledby') ?? '') ?? item;
      let background = 'rgba(0, 0, 0, 0)';
      for (let node: Element | null = text; node && /rgba\(0, 0, 0, 0\)/u.test(background); node = node.parentElement) background = getComputedStyle(node).backgroundColor;
      const [a, b] = [parse(getComputedStyle(text).color), parse(background)].sort((x, y) => y - x);
      return (a! + 0.05) / (b! + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe('CgMonthCalendar from outside', () => {
  test('takes an undated item dragged onto a day', async ({ page }) => {
    await openStory(page, 'phase-37-monthcalendar--arabic-undated-drop', RTL);
    const source = page.getByTestId('undated-supplier');
    const target = page.getByRole('grid').getByRole('gridcell', { name: await fullDate(page, '2026-11-18'), exact: true });
    const from = (await source.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 2 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await expect(target).toHaveAttribute('data-drop', /.*/u);
    await page.mouse.up();
    await expect(page.getByTestId('last-action')).toHaveText('place:supplier:2026-11-18:pointer');
    await expect(page.locator('[data-drop]')).toHaveCount(0);
  });

  test('follows the selected day and starts a create on it from outside', async ({ page }) => {
    await openStory(page, 'phase-37-monthcalendar--arabic-undated-drop', RTL);
    await page.getByRole('grid').getByRole('gridcell', { name: await fullDate(page, '2026-11-16'), exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('selected-day')).toHaveText('2026-11-17');
    await page.getByTestId('new-on-selected-day').click();
    await expect(page.getByTestId('last-action')).toHaveText('create:2026-11-17:programmatic');
    await expect(page.getByRole('textbox', { name: 'عنوان العنصر' })).toBeFocused();
    await page.keyboard.type('مهمة جديدة');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('last-action')).toHaveText('created:new-1:2026-11-17');
    await expect(page.getByRole('grid').getByRole('button', { name: /مهمة جديدة/u })).toBeVisible();
  });
});
