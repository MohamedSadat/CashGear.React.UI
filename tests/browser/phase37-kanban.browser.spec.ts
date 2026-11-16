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

for (const [story, globals] of [
  ['phase-37-kanbanboard--arabic-board', RTL],
  ['phase-37-kanbanboard--arabic-board-dark', DARK_RTL],
  ['phase-37-kanbanboard--left-to-right', LIGHT],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.getByTestId('kanban-board')).toBeVisible();
    await expectNoSeriousViolations(page);
    expect(problems).toEqual([]);
  });
}

const FIRST = 'مراجعة فاتورة المورد رقم 1';

test.describe('CgKanbanBoard', () => {
  test('names its board, columns and cards, with one tab stop and a windowed long column', async ({ page }) => {
    await openStory(page, 'phase-37-kanbanboard--arabic-board', RTL);
    const board = page.getByRole('region', { name: 'لوحة مهام الحسابات' });
    await expect(board).toBeVisible();
    const todo = page.getByRole('region', { name: 'لم يبدأ، 300 بطاقة' });
    await expect(page.getByRole('region', { name: 'بلا حالة، 0 بطاقة' })).toContainText('لا توجد بطاقات');
    expect(await todo.getByRole('listitem').count()).toBeLessThan(60);
    await expect(todo.getByRole('listitem', { name: FIRST, exact: true })).toHaveAttribute('aria-setsize', '300');
    await expect(page.locator('[data-testid="kanban-board"] [role="listitem"][tabindex="0"]')).toHaveCount(1);
  });

  test('picks a card up with Space, carries it with the arrows (mirrored in right to left) and drops it', async ({ page }) => {
    await openStory(page, 'phase-37-kanbanboard--arabic-board', RTL);
    const card = page.getByRole('listitem', { name: FIRST, exact: true });
    await card.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('status').filter({ hasText: 'التُقطت' })).toContainText(`التُقطت «${FIRST}»`);
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('status').filter({ hasText: 'قيد التنفيذ' })).toContainText('قيد التنفيذ، 1 من 7');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('last-move')).toHaveText('todo-1 todo:0 → doing:0 (keyboard)');
  });

  test('drags a card to another column with a copy and a drop line, and keeps the card closed after the drop', async ({ page }) => {
    await openStory(page, 'phase-37-kanbanboard--arabic-board', RTL);
    const opened = await page.getByTestId('opened-card').textContent();
    const card = page.getByRole('listitem', { name: FIRST, exact: true });
    const target = page.getByRole('region', { name: /^قيد التنفيذ، 6/u });
    const from = (await card.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 - 12, from.y + from.height / 2 + 4, { steps: 2 });
    await expect(page.locator('body > [data-cg-drag-ghost]')).toHaveCount(1);
    await page.mouse.move(to.x + to.width / 2, to.y + 140, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('[data-cg-drag-ghost]')).toHaveCount(0);
    await expect(page.getByTestId('last-move')).toHaveText(/^todo-1 todo:0 → doing:\d+ \(pointer\)$/u);
    await expect(page.getByTestId('opened-card')).toHaveText(opened ?? '');
  });

  test('moves a card through its handle menu, which Axe accepts', async ({ page }) => {
    await openStory(page, 'phase-37-kanbanboard--arabic-board', RTL);
    const card = page.getByRole('listitem', { name: FIRST, exact: true });
    await card.hover();
    await page.getByRole('button', { name: `نقل «${FIRST}»` }).click();
    const menu = page.getByRole('menu', { name: `نقل «${FIRST}»` });
    await expect(menu.getByRole('menuitem', { name: 'نقل لأعلى' })).toBeDisabled();
    await expectNoSeriousViolations(page);
    await menu.getByRole('menuitem', { name: 'نقل إلى منجز' }).click();
    await expect(page.getByTestId('last-move')).toHaveText('todo-1 todo:0 → done:4 (pointer)');
  });

  test('opens, collapses, shows a hidden column and adds a card', async ({ page }) => {
    await openStory(page, 'phase-37-kanbanboard--arabic-board', RTL);
    await page.getByRole('listitem', { name: FIRST, exact: true }).click();
    await expect(page.getByTestId('opened-card')).toHaveText('todo-1');
    await page.getByRole('button', { name: 'طي قيد المراجعة' }).click();
    await expect(page.getByRole('button', { name: 'توسيع قيد المراجعة' })).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'إظهار مؤرشف' }).click();
    await expect(page.getByRole('region', { name: 'مؤرشف، 2 بطاقة' })).toBeVisible();
    await page.getByRole('button', { name: 'بطاقة جديدة في بلا حالة' }).click();
    await expect(page.getByRole('region', { name: 'بلا حالة، 1 بطاقة' }).getByRole('listitem')).toHaveCount(1);
  });

  test('carries a card to the next column with ArrowRight in left to right', async ({ page }) => {
    await openStory(page, 'phase-37-kanbanboard--left-to-right', LIGHT);
    await page.getByRole('listitem', { name: 'Review the supplier invoice #1', exact: true }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('last-move')).toHaveText(/^\S+ \S+:0 → \S+:0 \(keyboard\)$/u);
  });
});
