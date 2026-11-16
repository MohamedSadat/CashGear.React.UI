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
  expect(serious.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes[0]?.target.join(' ')})`)).toEqual([]);
}

for (const [story, globals] of [
  ['phase-37-liveannouncer--polite', RTL],
  ['phase-37-liveannouncer--assertive', RTL],
  ['phase-37-liveannouncer--dark', DARK_RTL],
  ['phase-37-avatar--sizes-and-stacks', RTL],
  ['phase-37-avatar--dark', DARK_RTL],
  ['phase-37-avatar--left-to-right', LIGHT],
  ['phase-1-2-icon--document-blocks', LIGHT],
  ['phase-1-2-icon--document-blocks-rtl', RTL],
  ['phase-1-2-icon--document-blocks-dark', DARK_RTL],
  ['phase-37-filepicker--button', RTL],
  ['phase-37-filepicker--drop-zone', RTL],
  ['phase-37-filepicker--drop-zone-dark', DARK_RTL],
  ['phase-37-filepicker--disabled', RTL],
  ['phase-37-breadcrumb--collapsed', RTL],
  ['phase-37-breadcrumb--full', RTL],
  ['phase-37-breadcrumb--dark', DARK_RTL],
  ['phase-37-breadcrumb--left-to-right', LIGHT],
  ['phase-37-inlineeditor--cell-editors', RTL],
  ['phase-37-inlineeditor--standing-fields', RTL],
  ['phase-37-inlineeditor--dark', DARK_RTL],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-story-root]')).toBeVisible();
    await expectNoSeriousViolations(page);
    expect(problems).toEqual([]);
  });
}

test.describe('CgLiveAnnouncer', () => {
  test('speaks a message through the region, again when repeated', async ({ page }) => {
    await openStory(page, 'phase-37-liveannouncer--polite', RTL);
    const region = page.getByTestId('live-region');
    await expect(region).toHaveAttribute('aria-live', 'polite');
    const button = page.getByRole('button', { name: 'أُضيف صف جديد' });
    await button.click();
    await expect(region).toHaveText('أُضيف صف جديد');
    await button.click();
    await expect(region).toHaveText('أُضيف صف جديد');
    await page.getByRole('button', { name: 'مسح' }).click();
    await expect(region).toHaveText('');
    const box = (await region.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(1);
  });
});

test.describe('CgAvatar', () => {
  test('names each person, counts the rest, and overlaps along the line in right to left', async ({ page }) => {
    await openStory(page, 'phase-37-avatar--sizes-and-stacks', RTL);
    const stack = page.getByRole('group', { name: '7 أشخاص في هذه الصفحة' });
    await expect(stack.getByRole('img')).toHaveCount(5);
    await expect(stack.getByRole('img', { name: /^و3 آخرون/u })).toHaveText('+3');
    const first = (await stack.getByRole('img', { name: 'ليلى حسن' }).boundingBox())!;
    const second = (await stack.getByRole('img', { name: 'سامي يوسف' }).boundingBox())!;
    expect(second.x).toBeLessThan(first.x);
    expect(first.x - (second.x + second.width)).toBeLessThan(0);
    await expect(page.getByRole('img', { name: 'مفتوحة لدى ليلى حسن وسامي يوسف ونور الهدى و2 آخرين' })).toBeVisible();
  });
});

test.describe('CgIcon document blocks', () => {
  test('draws a list with its bullets at the line start in each direction', async ({ page }) => {
    await openStory(page, 'phase-1-2-icon--document-blocks-rtl', RTL);
    const icon = page.getByRole('img', { name: 'list-bullet' });
    await expect(icon.locator('path[data-cg-icon-rtl]')).toBeVisible();
    await expect(icon.locator('path:not([data-cg-icon-rtl])')).toBeHidden();
    await openStory(page, 'phase-1-2-icon--document-blocks', LIGHT);
    await expect(page.getByRole('img', { name: 'list-bullet' }).locator('path[data-cg-icon-rtl]')).toBeHidden();
  });
});

test.describe('CgFilePicker', () => {
  test('gives the file chosen in the dialog', async ({ page }) => {
    await openStory(page, 'phase-37-filepicker--drop-zone', RTL);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'اختر ملفاً' }).click();
    await (await chooser).setFiles({ name: 'بيانات.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2') });
    await expect(page.getByTestId('picked')).toHaveText('اختير: بيانات.csv');
  });

  test('takes a dropped file and rejects one of the wrong kind', async ({ page }) => {
    await openStory(page, 'phase-37-filepicker--drop-zone', RTL);
    const zone = page.locator('[data-cg-file-picker]');
    const drop = async (name: string, type: string) => {
      const transfer = await page.evaluateHandle(([fileName, fileType]) => {
        const data = new DataTransfer();
        data.items.add(new File(['x'], fileName!, { type: fileType! }));
        return data;
      }, [name, type]);
      await zone.dispatchEvent('dragenter', { dataTransfer: transfer });
      await expect(zone).toHaveAttribute('data-drag-over', '');
      await zone.dispatchEvent('dragover', { dataTransfer: transfer });
      await zone.dispatchEvent('drop', { dataTransfer: transfer });
    };
    await drop('ملف.csv', 'text/csv');
    await expect(page.getByTestId('picked')).toHaveText('أُفلت: ملف.csv');
    await expect(zone).not.toHaveAttribute('data-drag-over', '');
    await drop('صورة.png', 'image/png');
    await expect(page.getByTestId('picked')).toHaveText('رُفض: صورة.png');
  });
});

test.describe('CgBreadcrumb', () => {
  test('lists the hidden crumbs in a keyboard menu and routes through onNavigate', async ({ page }) => {
    await openStory(page, 'phase-37-breadcrumb--collapsed', RTL);
    const nav = page.getByRole('navigation', { name: 'مسار التنقل' });
    await expect(nav.getByRole('listitem')).toHaveCount(5);
    await expect(nav.locator('[aria-current="page"]')).toContainText('مراجعة نوفمبر');
    const more = nav.getByRole('button', { name: '2 صفحات أخرى' });
    await more.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: '2 صفحات أخرى' });
    await expect(menu.getByRole('menuitem')).toHaveText(['المالية', 'الميزانيات']);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('navigated')).toHaveText('الميزانيات');
    await nav.getByRole('link', { name: '2026' }).click();
    await expect(page.getByTestId('navigated')).toHaveText('2026');
  });

  test('truncates a long current page instead of overflowing its box', async ({ page }) => {
    await openStory(page, 'phase-37-breadcrumb--collapsed', RTL);
    const nav = page.getByRole('navigation', { name: 'مسار التنقل' });
    const box = (await nav.boundingBox())!;
    const list = (await nav.locator('ol').evaluate((element) => element.scrollWidth));
    expect(list).toBeLessThanOrEqual(Math.ceil(box.width) + 1);
  });
});

test.describe('CgInlineTextEditor and CgInlineNumberEditor', () => {
  test('edit a cell in place: Enter commits, Escape reverts, bad numbers stay open', async ({ page }) => {
    await openStory(page, 'phase-37-inlineeditor--cell-editors', RTL);
    await page.getByRole('button', { name: 'أقلام', exact: true }).click();
    const name = page.getByRole('textbox', { name: 'الصنف' });
    await expect(name).toBeFocused();
    await page.keyboard.type('أقلام رصاص');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'أقلام رصاص', exact: true })).toBeVisible();
    await expect(page.getByTestId('inline-log')).toHaveText('حُفظ الاسم (enter)');

    await page.getByRole('button', { name: 'كمية دفاتر' }).click();
    const quantity = page.getByRole('textbox', { name: 'الكمية' });
    await page.keyboard.type('عشرة');
    await page.keyboard.press('Enter');
    await expect(quantity).toHaveAttribute('aria-invalid', 'true');
    await expect(quantity).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('٧٫٥');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'كمية دفاتر' })).toHaveText('7.5');

    await page.getByRole('button', { name: 'حبر', exact: true }).click();
    await page.keyboard.type('xyz');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'حبر', exact: true })).toBeVisible();
  });
});
