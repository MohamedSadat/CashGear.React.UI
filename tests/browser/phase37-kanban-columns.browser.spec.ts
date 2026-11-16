import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openStory } from './storybook';

const RTL = 'theme:light;density:comfortable;direction:rtl';
const STORY = 'phase-37-kanbanboard--arabic-columns-and-paging';

function watchProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text()); });
  return problems;
}

test(`${STORY} has no accessibility violations or browser errors`, async ({ page }) => {
  const problems = watchProblems(page);
  await openStory(page, STORY, RTL);
  await expect(page.getByTestId('kanban-board')).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`)).toEqual([]);
  expect(problems).toEqual([]);
});

test.describe('CgKanbanBoard columns, paging and drafts', () => {
  test('moves a column with the keyboard on its grip, keeping focus, and cancels with Escape', async ({ page }) => {
    await openStory(page, STORY, RTL);
    const grip = page.getByRole('button', { name: 'نقل العمود لم يبدأ' });
    await grip.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('last-column-move')).toHaveText('');
    await grip.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-cg-drop-indicator][data-orientation="vertical"]').first()).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('last-column-move')).toHaveText('todo 0 → 1 (keyboard)');
    await expect(page.getByRole('button', { name: 'نقل العمود لم يبدأ' })).toBeFocused();
  });

  test('moves a column from its grip menu', async ({ page }) => {
    await openStory(page, STORY, RTL);
    const grip = page.getByRole('button', { name: 'نقل العمود منجز' });
    await grip.scrollIntoViewIfNeeded();
    await grip.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'نقل لليمين' }).click();
    await expect(page.getByTestId('last-column-move')).toHaveText('done 4 → 3 (pointer)');
  });

  test('asks for the next page as a paged column nears its end, once per page', async ({ page }) => {
    await openStory(page, STORY, RTL);
    await expect(page.getByTestId('end-reached')).toHaveText('');
    const board = page.getByRole('region', { name: 'لوحة مهام الحسابات' });
    await board.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByTestId('end-reached')).toHaveText('todo@20');
    await expect(page.getByRole('region', { name: /^لم يبدأ/u }).getByRole('listitem').first()).toHaveAttribute('aria-setsize', '40');
  });

  test('types a new card in the draft, which keyboard moves pass by', async ({ page }) => {
    await openStory(page, STORY, RTL);
    const field = page.getByRole('textbox', { name: 'عنوان البطاقة الجديدة في قيد التنفيذ' });
    await expect(field).toBeVisible();
    await field.fill('مهمة جديدة');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('draft-text')).toHaveText('مهمة جديدة');
    await expect(page.getByRole('region', { name: 'قيد التنفيذ، 5 بطاقة' }).getByRole('listitem', { name: 'مهمة جديدة' })).toBeVisible();
  });
});
