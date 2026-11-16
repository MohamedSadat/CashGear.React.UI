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
  ['phase-37-select--default', RTL],
  ['phase-37-select--dark', DARK_RTL],
  ['phase-37-select--left-to-right', LIGHT],
  ['phase-37-filepicker--folder', RTL],
  ['phase-37-optionpicker--arabic-normalisation', RTL],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-story-root]')).toBeVisible();
    await expectNoSeriousViolations(page);
    expect(problems).toEqual([]);
  });
}

test('CgSelect chooses with the keyboard and reports the value', async ({ page }) => {
  await openStory(page, 'phase-37-select--default', RTL);
  const select = page.getByRole('combobox', { name: /نوع الخاصية/u });
  await select.selectOption('relation');
  await expect(page.getByTestId('select-value')).toHaveText('relation');
  await expect(select).not.toHaveAttribute('aria-invalid', 'true');
});

test('CgOptionPicker folds Arabic with the caller\'s rule', async ({ page }) => {
  await openStory(page, 'phase-37-optionpicker--arabic-normalisation', RTL);
  await page.getByRole('combobox').fill('مستشفي');
  await expect(page.getByRole('option')).toHaveText(['مستشفى']);
});

test('CgCommandMenu reads its active option\'s second line at 4.5:1 or more', async ({ page }) => {
  await openStory(page, 'phase-37-commandmenu--search-palette', RTL);
  const ratio = await page.locator('[role="option"][aria-selected="true"] [dir="auto"]:nth-child(2)').first().evaluate((element) => {
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
    let background = 'rgba(0, 0, 0, 0)';
    for (let node: Element | null = element; node && /rgba\(0, 0, 0, 0\)/u.test(background); node = node.parentElement) background = getComputedStyle(node).backgroundColor;
    const [a, b] = [parse(getComputedStyle(element).color), parse(background)].sort((x, y) => y - x);
    return (a! + 0.05) / (b! + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('CgSelectionToolbar docked keeps 44 px tools and scrolls when they are wider than the screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openStory(page, 'phase-37-selectiontoolbar--docked-touch', RTL);
  const bar = page.locator('[data-cg-selection-toolbar="docked"]');
  const button = bar.getByRole('button').first();
  const box = (await button.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const scroll = await bar.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
  expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
  const last = bar.getByRole('button').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});

test('CgMentionArea reads "a", Enter, Enter, "b" as one empty line', async ({ page }) => {
  await openStory(page, 'phase-37-mentionarea--comment-composer', RTL);
  await page.getByRole('textbox', { name: 'تعليق جديد' }).click();
  await page.keyboard.type('a');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('b');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('sent')).toHaveText('a\n\nb', { useInnerText: false });
});
