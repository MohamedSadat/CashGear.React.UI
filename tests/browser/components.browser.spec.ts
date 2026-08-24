import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

const canonicalStories = [
  'phase-1-2-icon--registry',
  'phase-1-2-button--default',
  'phase-1-2-field--default',
  'phase-1-2-textbox--controlled',
  'phase-1-2-memo--controlled',
  'phase-1-2-checkbox--controlled-and-uncontrolled',
  'phase-1-2-switch--controlled-and-uncontrolled',
  'phase-1-2-radio--native-group',
  'phase-1-2-radiogroup--controlled-and-uncontrolled',
  'phase-1-2-numericedit--controlled-and-uncontrolled',
  'phase-1-2-spinedit--controlled-and-uncontrolled',
  'phase-1-2-searchbox--controlled-loading-and-minimum',
  'phase-1-2-loadingpanel--controlled-blocking-overlay',
  'phase-1-2-progressbar--determinate-sizes-and-intents',
  'phase-3-combobox--controlled-local-selection',
] as const;

for (const story of canonicalStories) {
  test(`${story} renders without serious accessibility or browser errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await openStory(page, story);
    await expect(page.locator('#storybook-root')).not.toBeEmpty();
    const result = await new AxeBuilder({ page }).analyze();
    const serious = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('ComboBox preserves ARIA ownership and keyboard and pointer selection', async ({ page }) => {
  await openStory(page, 'phase-3-combobox--controlled-local-selection');
  const input = page.getByRole('combobox', { name: 'Customer' });
  await input.fill('Northwind');
  const option = page.getByRole('option', { name: /Northwind Traders/u });
  await expect(option).toBeVisible();
  await expect(option.locator('xpath=..')).toHaveAttribute('role', 'listbox');
  await option.click();
  await expect(input).toHaveValue('C-300 - Northwind Traders');
  await input.press('ArrowDown');
  await input.press('End');
  const activeId = await input.getAttribute('aria-activedescendant');
  expect(activeId).toBeTruthy();
  await expect(page.locator(`#${activeId}`)).toBeVisible();
  await expect(input).toBeFocused();
  await input.press('Escape');
  await expect(input).toHaveValue('C-300 - Northwind Traders');
  await expect(input).not.toHaveAttribute('aria-controls', /.+/u);
});

test('ComboBox supports Arabic folding, native forms, reset, and rejected controlled commits', async ({ page }) => {
  await openStory(page, 'phase-3-combobox--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const arabic = page.getByRole('combobox', { name: 'العميل' });
  await arabic.fill('احمد');
  await expect(page.getByRole('option', { name: /أَحْمَد/u })).toBeVisible();

  await openStory(page, 'phase-3-combobox--native-form-fixture');
  const formInput = page.getByRole('combobox', { name: 'Form customer' });
  await formInput.fill('Contoso');
  await page.getByRole('option', { name: /Contoso/u }).click();
  await page.getByRole('button', { name: 'Submit selection' }).click();
  await expect(page.getByLabel('Submitted key')).toHaveText('2');
  await page.getByRole('button', { name: 'Reset selection' }).click();
  await expect(formInput).toHaveValue('C-100 - Acme Manufacturing');

  await openStory(page, 'phase-3-combobox--rejected-controlled-fixture');
  const rejected = page.getByRole('combobox', { name: 'Authoritative customer' });
  await rejected.fill('Contoso');
  await page.getByRole('option', { name: /Contoso/u }).click();
  await expect(rejected).toHaveValue('C-100 - Acme Manufacturing');
  await expect(page.getByLabel('Attempted selection')).toHaveText('Contoso Retail');
});

test('LoadingPanel contains and returns focus and covers an external target', async ({ page }) => {
  await openStory(page, 'phase-1-2-loadingpanel--focus-return-fixture');
  const opener = page.getByRole('button', { name: 'Show focus panel' });
  await opener.focus();
  await opener.press('Enter');
  await expect(page.getByRole('button', { name: 'First action' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Last action' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();

  await openStory(page, 'phase-1-2-loadingpanel--portal-geometry');
  const target = page.locator('#loading-story-target');
  const panel = page.getByRole('status');
  const targetBox = await target.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(targetBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(Math.abs((targetBox?.x ?? 0) - (panelBox?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((targetBox?.width ?? 0) - (panelBox?.width ?? 0))).toBeLessThanOrEqual(1);
});

test('SpinEdit repeats a held pointer and stops on release', async ({ page }) => {
  await openStory(page, 'phase-1-2-spinedit--pointer-hold');
  const input = page.getByRole('spinbutton', { name: 'Hold to repeat' });
  const increase = page.getByRole('button', { name: 'Increase value' }).first();
  await increase.hover();
  await page.mouse.down();
  await page.waitForTimeout(850);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const stopped = Number(await input.inputValue());
  expect(stopped).toBeGreaterThan(1);
  await page.waitForTimeout(500);
  await expect(input).toHaveValue(String(stopped));
});
