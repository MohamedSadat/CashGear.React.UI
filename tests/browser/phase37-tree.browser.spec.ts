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

async function expectNoSeriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`)).toEqual([]);
}

const row = (page: Page, key: string) => page.locator(`[data-node-key="${key}"] > [data-cg-tree-row]`);
const output = (page: Page) => page.getByTestId('last-tree-action');

for (const [story, globals] of [
  ['phase-12-treeview--page-tree-arabic', RTL],
  ['phase-12-treeview--page-tree-dark', DARK_RTL],
  ['phase-12-treeview--virtual-five-thousand', LIGHT],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-story-root]')).toBeVisible();
    if (story.endsWith('dark')) await expect(page.locator('[data-cg-tree-status="error"]')).toBeVisible();
    await expectNoSeriousViolations(page);
    expect(problems).toEqual([]);
  });
}

test.describe('CgTreeView page tree', () => {
  test('drops a page inside another with the pointer, and cancels on Escape', async ({ page }) => {
    await openStory(page, 'phase-12-treeview--page-tree-arabic', RTL);
    const tree = page.getByRole('tree', { name: 'الصفحات' });
    await expect(tree).toBeVisible();
    const before = await output(page).textContent();
    const from = (await row(page, 'welcome').boundingBox())!;
    const target = (await row(page, 'projects').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + 30, { steps: 4 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(output(page)).toHaveText(before ?? '');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + 20, { steps: 3 });
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
    await expect(page.locator('[data-node-key="projects"] > [data-cg-tree-row][data-cg-drop-inside], [data-node-key="projects"][data-cg-drop-inside]')).toHaveCount(1);
    await page.mouse.up();
    await expect(output(page)).toHaveText('move:welcome:inside:projects:projects:2');
  });

  test('moves a page with Alt+Shift+arrows, keeping focus, and announces it', async ({ page }) => {
    await openStory(page, 'phase-12-treeview--page-tree-arabic', RTL);
    const welcome = page.getByRole('treeitem', { name: /مرحبًا بك/u });
    await welcome.focus();
    await page.keyboard.press('Alt+Shift+ArrowDown');
    await expect(output(page)).toHaveText('move:welcome:after:guide:start:1');
    await expect(page.getByRole('treeitem', { name: /مرحبًا بك/u })).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'نُقلت' })).toContainText('نُقلت «مرحبًا بك»');
  });

  test('renames with F2: Enter commits, Escape reverts', async ({ page }) => {
    await openStory(page, 'phase-12-treeview--page-tree-arabic', RTL);
    const welcome = page.getByRole('treeitem', { name: /مرحبًا بك/u });
    await welcome.focus();
    await page.keyboard.press('F2');
    const field = page.getByRole('textbox', { name: 'عنوان الصفحة' });
    await expect(field).toBeFocused();
    await page.keyboard.type('أهلًا');
    await page.keyboard.press('Escape');
    await expect(field).toBeHidden();
    await page.getByRole('treeitem', { name: /مرحبًا بك/u }).focus();
    await page.keyboard.press('F2');
    await page.keyboard.type('أهلًا وسهلًا');
    await page.keyboard.press('Enter');
    await expect(output(page)).toHaveText('rename:welcome:أهلًا وسهلًا');
  });

  test('loads lazy children, and retries a failed load', async ({ page }) => {
    await openStory(page, 'phase-12-treeview--page-tree-arabic', RTL);
    await page.getByRole('button', { name: 'توسيع الأرشيف' }).click();
    await expect(page.getByRole('treeitem', { name: /جارٍ تحميل الصفحات/u })).toHaveAttribute('aria-disabled', 'true');
    await expect(output(page)).toHaveText('load:archive:loaded', { timeout: 5000 });
    await expect(page.locator('[data-node-key="archive-2025"]')).toBeVisible();
    await page.getByRole('button', { name: 'توسيع مصدر مشترك' }).click();
    await expect(page.locator('[data-cg-tree-status="error"]')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'أعد المحاولة' }).click();
    await expect(output(page)).toHaveText('load:shared:loaded', { timeout: 5000 });
  });

  test('shows row buttons on hover only, and adds a page inside', async ({ page }) => {
    await openStory(page, 'phase-12-treeview--page-tree-arabic', RTL);
    await expect(page.getByRole('button', { name: 'إضافة صفحة داخل «المشاريع»' })).toHaveCount(0);
    // Row buttons appear on hover or focus, as for a person.
    await row(page, 'projects').hover();
    await page.getByRole('button', { name: 'إضافة صفحة داخل «المشاريع»' }).click();
    await expect(output(page)).toHaveText('add:projects:new-1');
  });
});

test.describe('CgTreeView virtualised', () => {
  test('draws only the rows in view of five thousand, with correct positions and one tab stop', async ({ page }) => {
    await openStory(page, 'phase-12-treeview--virtual-five-thousand', LIGHT);
    const tree = page.getByRole('tree', { name: 'Five thousand pages' });
    expect(await tree.getByRole('treeitem').count()).toBeLessThan(40);
    await page.getByTestId('expand-all').click();
    await expect.poll(async () => tree.evaluate((element) => (element.querySelector(':scope > [role="none"]') as HTMLElement | null)?.getBoundingClientRect().height ?? 0)).toBeGreaterThan(100000);
    expect(await tree.getByRole('treeitem').count()).toBeLessThan(60);
    await tree.getByRole('treeitem').first().focus();
    await page.keyboard.press('End');
    const last = tree.locator('[role="treeitem"]:focus');
    await expect(last).toHaveAttribute('aria-level', '2');
    await expect(last).toHaveAttribute('aria-posinset', '99');
    await expect(tree.locator('[tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press('Home');
    await expect(tree.getByRole('treeitem').first()).toBeFocused();
  });
});
