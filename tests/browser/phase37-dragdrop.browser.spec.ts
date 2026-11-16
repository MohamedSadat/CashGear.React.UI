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

for (const [story, globals] of [['phase-37-dragdrop--block-handles', RTL], ['phase-37-dragdrop--block-handles-dark', DARK_RTL]] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-story-root]')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes[0]?.target.join(' ')})`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test.describe('cgTrackDrag, CgDragHandle and CgDropIndicator', () => {
  test('drags a block with a copy and a drop line, and swallows the click after the drop', async ({ page }) => {
    await openStory(page, 'phase-37-dragdrop--block-handles', RTL);
    const order = page.getByTestId('block-order');
    const handle = page.getByRole('button', { name: 'نقل «مقدمة المشروع»' });
    const target = page.getByText('الميزانية', { exact: true });
    const from = (await handle.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 2 });
    await expect(page.locator('[data-cg-drag-ghost]')).toHaveCount(1);
    await page.mouse.move(to.x + 4, to.y + to.height - 2, { steps: 8 });
    await expect(page.locator('[data-cg-drop-indicator]')).toBeVisible();
    await page.mouse.up();
    await expect(page.locator('[data-cg-drag-ghost]')).toHaveCount(0);
    await expect(page.locator('[data-cg-drop-indicator]')).toBeHidden();
    await expect(order).toHaveText('الأهداف، الجدول الزمني، الميزانية، مقدمة المشروع، المخاطر، الخطوات التالية، ملحق أ، ملحق ب');
  });

  test('cancels a drag on Escape, and moves with the arrows on a focused handle', async ({ page }) => {
    await openStory(page, 'phase-37-dragdrop--block-handles', RTL);
    const order = page.getByTestId('block-order');
    const before = await order.textContent();
    const handle = page.getByRole('button', { name: 'نقل «الأهداف»' });
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 80, { steps: 5 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(order).toHaveText(before!);
    await handle.focus();
    await page.keyboard.press('ArrowDown');
    await expect(order).toHaveText('مقدمة المشروع، الجدول الزمني، الأهداف، الميزانية، المخاطر، الخطوات التالية، ملحق أ، ملحق ب');
    await expect(page.getByRole('button', { name: 'نقل «الأهداف»' })).toBeFocused();
  });
});
