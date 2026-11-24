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

/** A weekday's or a month's name as the browser writes it in the locale. */
const name = (page: Page, locale: string, options: Intl.DateTimeFormatOptions, utc: number) => page.evaluate(([language, format, value]) => new Intl.DateTimeFormat(language, { ...format, timeZone: 'UTC' }).format(value), [locale, options, utc] as const);

for (const [story, globals] of [
  ['phase-37-recurrencefields--arabic-template', RTL],
  ['phase-37-recurrencefields--arabic-template-dark', DARK_RTL],
  ['phase-37-recurrencefields--english-with-end', LIGHT],
  ['phase-37-recurrencefields--arabic-disabled', RTL],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-recurrence-fields]')).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[data-cg-story-root]').analyze()).violations).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test('the Arabic template rule starts its weeks on Saturday, right to left, and its summary follows each edit', async ({ page }) => {
  await openStory(page, 'phase-37-recurrencefields--arabic-template', RTL);
  const fields = page.getByRole('group', { name: 'تكرار القالب' });
  await expect(fields).toHaveCSS('direction', 'rtl');
  const days = fields.getByRole('group', { name: 'في أيام' }).getByRole('checkbox');
  await expect(days).toHaveCount(7);
  // 12 September 2026 is a Saturday.
  await expect(days.first()).toHaveAccessibleName(await name(page, 'ar', { weekday: 'short' }, Date.UTC(2026, 8, 12)));
  // Right to left: the first day is at the inline start, on the right.
  const [first, second] = [await days.nth(0).boundingBox(), await days.nth(1).boundingBox()];
  expect(first!.x).toBeGreaterThan(second!.x);
  await expect(fields.getByRole('combobox', { name: 'ينتهي' })).toHaveCount(0);
  await expect(fields.getByRole('spinbutton', { name: 'كل' })).toHaveAccessibleDescription('أسبوعين');
  await expect(page.getByTestId('summary')).toHaveText('كل أسبوعين يوم الاثنين والأربعاء');
  await expect(page.getByTestId('next')).toHaveAttribute('data-value', '2026-11-30');

  await days.first().check();
  await expect(page.getByTestId('summary')).toHaveText('كل أسبوعين يوم السبت والاثنين والأربعاء');

  await fields.getByRole('combobox', { name: 'يتكرر' }).selectOption('monthly');
  await expect(fields.getByRole('spinbutton', { name: 'اليوم من الشهر' })).toHaveValue('30');
  await fields.getByRole('combobox', { name: 'في', exact: true }).selectOption('last');
  await expect(fields.getByRole('spinbutton', { name: 'اليوم من الشهر' })).toHaveCount(0);
  await expect(days).toHaveCount(7);
  await expect(page.getByTestId('summary')).toHaveText(/^كل شهرين في .+ الأخير$/u);

  await fields.getByRole('spinbutton', { name: 'كل' }).fill('0');
  await expect(page.getByTestId('summary').getByRole('alert')).toHaveText('الفاصل عدد صحيح أكبر من صفر');
});

test('the English rule offers no repetition and its end, left to right, weeks from Sunday', async ({ page }) => {
  await openStory(page, 'phase-37-recurrencefields--english-with-end', LIGHT);
  const fields = page.getByRole('group', { name: 'Repeat' });
  await expect(page.getByTestId('summary')).toHaveText('Every month on the last Friday, 6 times');
  await expect(page.getByTestId('next')).toHaveAttribute('data-value', '2026-11-27');
  await expect(fields.getByRole('group', { name: 'On' }).getByRole('checkbox').first()).toHaveAccessibleName('Sun');

  await fields.getByRole('combobox', { name: 'Ends' }).selectOption('endByDate');
  await fields.getByLabel('Last day').fill('2027-02-28');
  await expect(page.getByTestId('summary')).toHaveText('Every month on the last Friday, until Feb 28, 2027');
  await expect(page.getByTestId('upcoming')).toHaveText('Nov 27, 2026 · Dec 25, 2026 · Jan 29, 2027 · Feb 26, 2027');

  await fields.getByRole('combobox', { name: 'Repeats' }).selectOption('yearly');
  await fields.getByRole('combobox', { name: 'On', exact: true }).selectOption('none');
  await expect(fields.getByRole('combobox', { name: 'In' })).toHaveValue('11');
  await expect(page.getByTestId('summary')).toHaveText(`Every year on ${await name(page, 'en-US', { month: 'long' }, Date.UTC(2026, 10, 1))} 27, until Feb 28, 2027`);

  await fields.getByRole('combobox', { name: 'Repeats' }).selectOption('none');
  await expect(fields.getByRole('spinbutton')).toHaveCount(0);
  await expect(page.getByTestId('summary')).toHaveText('Does not repeat');
});

test('the disabled rule takes no edits', async ({ page }) => {
  await openStory(page, 'phase-37-recurrencefields--arabic-disabled', RTL);
  const fields = page.getByRole('group', { name: 'تكرار القالب' });
  await expect(fields.getByRole('combobox', { name: 'يتكرر' })).toBeDisabled();
  await expect(fields.getByRole('spinbutton', { name: 'اليوم من الشهر' })).toBeDisabled();
});
