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
  ['phase-37-commandmenu--slash-menu', RTL],
  ['phase-37-commandmenu--search-palette', RTL],
  ['phase-37-commandmenu--search-palette-dark', DARK_RTL],
  ['phase-37-commandmenu--open-list', RTL],
  ['phase-37-selectiontoolbar--follows-selection', RTL],
  ['phase-37-selectiontoolbar--follows-selection-dark', DARK_RTL],
  ['phase-37-selectiontoolbar--docked-touch', RTL],
  ['phase-37-menupanel--property-menu-in-flyout', RTL],
  ['phase-37-menupanel--in-place', RTL],
  ['phase-37-menupanel--dark', DARK_RTL],
  ['phase-37-sortablelist--properties-list', RTL],
  ['phase-37-sortablelist--properties-list-dark', DARK_RTL],
  ['phase-37-optionpicker--tags', RTL],
  ['phase-37-optionpicker--status-groups', RTL],
  ['phase-37-optionpicker--status-groups-dark', DARK_RTL],
  ['phase-37-optionpicker--people-results', RTL],
  ['phase-37-mentionarea--comment-composer', RTL],
  ['phase-37-mentionarea--with-mentions', RTL],
  ['phase-37-mentionarea--dark', DARK_RTL],
  ['phase-37-emojipicker--page-icon-picker', RTL],
  ['phase-37-emojipicker--page-icon-picker-dark', DARK_RTL],
  ['phase-37-emojipicker--english', LIGHT],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-story-root]')).toBeVisible();
    await expectNoSeriousViolations(page);
    expect(problems).toEqual([]);
  });
}

test.describe('CgCommandMenu', () => {
  test('opens at the caret on "/", filters as typed, and inserts with the keyboard while the editor keeps focus', async ({ page }) => {
    await openStory(page, 'phase-37-commandmenu--slash-menu', RTL);
    const editor = page.getByRole('combobox', { name: 'محرر المستند' });
    await editor.click();
    await page.keyboard.type('/');
    const list = page.getByRole('listbox', { name: 'الكتل' });
    await expect(list).toBeVisible();
    await expect(editor).toBeFocused();
    const editorBox = (await editor.boundingBox())!;
    const listBox = (await list.boundingBox())!;
    expect(listBox.y).toBeGreaterThan(editorBox.y + editorBox.height - 1);
    await page.keyboard.type('عنو');
    await expect(list.getByRole('option')).toHaveCount(2);
    const first = (await editor.getAttribute('aria-activedescendant'))!;
    await page.keyboard.press('ArrowDown');
    await expect(editor).not.toHaveAttribute('aria-activedescendant', first);
    const active = (await editor.getAttribute('aria-activedescendant'))!;
    await expect(page.locator(`#${active}`)).toContainText('عنوان 2');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chosen')).toHaveText('عنوان 2');
    await expect(list).toBeHidden();
    await page.keyboard.type('/');
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
  });

  test('as a palette, searches and chooses with the pointer', async ({ page }) => {
    await openStory(page, 'phase-37-commandmenu--search-palette', RTL);
    await page.getByRole('combobox', { name: 'ابحث في الصفحات والأوامر' }).fill('صفحة');
    await expect(page.getByRole('option')).toHaveCount(1);
    await page.getByRole('option', { name: /صفحة جديدة/u }).click();
    await expect(page.getByTestId('chosen')).toHaveText('صفحة جديدة');
  });
});

test.describe('CgSelectionToolbar', () => {
  test('floats above the selection and keeps it while a mark is toggled', async ({ page }) => {
    await openStory(page, 'phase-37-selectiontoolbar--follows-selection', RTL);
    const toolbar = page.getByRole('toolbar', { name: 'التنسيق' });
    await expect(toolbar).toBeVisible();
    const text = page.getByRole('textbox', { name: 'نص المستند' });
    expect((await toolbar.boundingBox())!.y + (await toolbar.boundingBox())!.height).toBeLessThanOrEqual((await text.boundingBox())!.y + 30);
    const selected = await page.evaluate(() => document.getSelection()?.toString());
    await toolbar.getByRole('button', { name: 'غامق' }).click();
    await expect(page.getByTestId('toolbar-log')).toHaveText('غامق: نعم');
    expect(await page.evaluate(() => document.getSelection()?.toString())).toBe(selected);
  });

  test('docks at the bottom of the viewport', async ({ page }) => {
    await openStory(page, 'phase-37-selectiontoolbar--docked-touch', RTL);
    const bar = page.locator('[data-cg-selection-toolbar="docked"]');
    const box = (await bar.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height);
  });
});

test.describe('CgMenuPanel', () => {
  test('walks from the name field into the items, opens the type panel and comes back', async ({ page }) => {
    await openStory(page, 'phase-37-menupanel--property-menu-in-flyout', RTL);
    const name = page.getByRole('textbox', { name: 'اسم العمود' });
    await expect(name).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: /تغيير النوع/u })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitemcheckbox', { name: 'التفاف النص' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Space');
    await expect(page.getByRole('menuitemcheckbox', { name: 'التفاف النص' })).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('menuitem', { name: /تغيير النوع/u }).click();
    await expect(page.getByRole('menu', { name: 'أنواع العمود' })).toBeVisible();
    await page.getByRole('button', { name: 'رجوع' }).click();
    await expect(page.getByRole('menu', { name: 'خصائص العمود «الكمية»' })).toBeVisible();
  });
});

test.describe('CgSortableList', () => {
  test('moves a row with the keyboard and by dragging its handle', async ({ page }) => {
    await openStory(page, 'phase-37-sortablelist--properties-list', RTL);
    const order = page.getByTestId('order');
    await page.getByRole('button', { name: 'نقل الحالة' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(order).toHaveText('title,owner,status,due,budget');
    await expect(page.getByRole('button', { name: 'نقل الحالة' })).toBeFocused();
    const handle = page.getByRole('button', { name: 'نقل الميزانية' });
    const from = (await handle.boundingBox())!;
    const target = (await page.getByRole('button', { name: 'نقل المسؤول' }).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y - 10, { steps: 3 });
    await page.mouse.move(target.x + target.width / 2, target.y + 4, { steps: 6 });
    await page.mouse.up();
    await expect(order).toHaveText('title,budget,owner,status,due');
  });
});

test.describe('CgOptionPicker', () => {
  test('creates, chooses and recolours an option', async ({ page }) => {
    await openStory(page, 'phase-37-optionpicker--tags', RTL);
    const search = page.getByRole('combobox', { name: 'ابحث أو أنشئ خياراً' });
    await search.fill('تسويق');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('picked')).toContainText('تسويق');
    await page.locator('[data-cg-option-key="t1"] [data-cg-option-menu]').click();
    await page.getByRole('radio', { name: 'أخضر' }).check();
    await page.getByRole('button', { name: 'رجوع' }).click();
    await expect(search).toBeFocused();
  });
});

test.describe('CgMentionArea', () => {
  test('inserts a mention typed after "@" and sends with Ctrl+Enter', async ({ page }) => {
    await openStory(page, 'phase-37-mentionarea--comment-composer', RTL);
    const area = page.getByRole('textbox', { name: 'تعليق جديد' });
    await area.click();
    await page.keyboard.type('شكراً @سا');
    const list = page.getByRole('listbox', { name: 'الإشارات' });
    await expect(list.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(area.locator('[data-cg-mention-id="u2"]')).toHaveText('@سامي يوسف');
    await page.keyboard.type('على المراجعة');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('sent')).toHaveText('شكراً [user:u2] على المراجعة');
  });
});

test.describe('CgEmojiPicker', () => {
  test('searches, walks the grid along the line in right to left, and chooses', async ({ page }) => {
    await openStory(page, 'phase-37-emojipicker--page-icon-picker', RTL);
    const search = page.getByRole('searchbox', { name: 'ابحث عن رمز' });
    await expect(search).toBeFocused();
    await page.keyboard.press('ArrowDown');
    const first = page.locator('[data-cg-emoji-index="0"]');
    await expect(first).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    const second = page.locator('[data-cg-emoji-index="1"]');
    await expect(second).toBeFocused();
    expect((await second.boundingBox())!.x).toBeLessThan((await first.boundingBox())!.x);
    await search.fill('rocket');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'تغيير رمز الصفحة' })).toHaveText('🚀');
  });
});
