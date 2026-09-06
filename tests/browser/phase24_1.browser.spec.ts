import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

const story = (name: string) => `phase-24-1-reliability-refresh--${name}`;

test('Phase 24.1 Grid table styles expose all presets and apply decoration without loading data', async ({ page }) => {
  await openStory(page, story('table-styling'));
  const grid = page.locator('[data-table-intensity]');
  const trigger = page.getByRole('button', { name: 'Table Style' });
  await expect(grid).toHaveAttribute('data-table-intensity', 'medium');
  await trigger.click();
  const picker = page.locator('[data-cg-grid-table-style-picker]');
  await expect(picker.locator('button[aria-pressed]')).toHaveCount(18);
  await picker.getByRole('button', { name: 'Purple Dark' }).click();
  await picker.getByRole('combobox', { name: 'Banding' }).selectOption('columns');
  await picker.getByRole('combobox', { name: 'Borders' }).selectOption('all');
  await picker.getByRole('combobox', { name: 'Row spacing' }).selectOption('comfortable');
  await expect(grid).toHaveAttribute('data-table-intensity', 'dark');
  await expect(grid).toHaveAttribute('data-table-banding', 'columns');
  await expect(grid).toHaveAttribute('data-table-borders', 'all');
  await expect(page.locator('[data-cg-grid-row]').first()).toHaveCSS('height', '48px');
  await picker.getByRole('button', { name: 'Reset appearance', exact: false }).click();
  await expect(grid).toHaveAttribute('data-table-intensity', 'medium');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('Phase 24.1 Grid retains invalid raw drafts and locks every popup editor while saving', async ({ page }) => {
  await openStory(page, story('edit-validation-and-locking'));
  await page.getByRole('button', { name: 'Edit' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Edit row' });
  const balance = dialog.getByRole('textbox', { name: 'Balance' });
  await balance.fill('not-a-number');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(balance).toHaveValue('not-a-number');
  await expect(balance).toHaveAttribute('aria-invalid', 'true');
  await expect(balance).toBeFocused();

  await balance.fill('12000');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Customer' })).toBeDisabled();
  await expect(dialog.getByRole('combobox', { name: 'Region' })).toBeDisabled();
  await expect(dialog).toHaveCount(0, { timeout: 2_000 });
});

test('Phase 24.1 incomplete ComboBox results require an explicit highlight', async ({ page }) => {
  await openStory(page, story('incomplete-combo-results'));
  const input = page.getByRole('combobox', { name: 'Incomplete customer results' });
  await page.getByRole('button', { name: 'Toggle options' }).click();
  await expect(page.getByRole('status')).toContainText('Refine the search');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Toggle options' }).click();
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(input).toHaveValue('Acme Manufacturing');
});

test('Phase 24.1 keyed resolution reports a safe failure and refreshes the selected item', async ({ page }) => {
  await openStory(page, story('keyed-resolution-refresh-and-failure'));
  const input = page.getByRole('combobox', { name: 'Resolved customer key' });
  await expect(input).toHaveValue('404');
  await expect(page.getByRole('alert')).toHaveText('Customer details are temporarily unavailable.');
  await expect(page.getByLabel('Resolution diagnostic')).toHaveText('Resolver diagnostic captured for key 404');
  await page.getByRole('button', { name: 'Refresh selected customer' }).click();
  await expect(input).toHaveValue('C-404 — Recovered customer');
});

test('Phase 24.1 context and data-version changes close stale ComboBox results and rebuild local indexes', async ({ page }) => {
  await openStory(page, story('context-and-data-version-invalidation'));
  const combo = page.getByRole('combobox', { name: 'Versioned customer combo' });
  await page.getByRole('button', { name: 'Toggle options' }).first().click();
  await expect(combo).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Change query context' }).click();
  await expect(combo).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Mutate data and bump version' }).click();
  await combo.fill('New same-reference');
  await expect(page.getByRole('option', { name: 'New same-reference customer' })).toBeVisible();

  const lookup = page.getByRole('combobox', { name: 'Versioned customer lookup' });
  await lookup.fill('New same-reference');
  await expect(page.getByRole('row', { name: /C-700 New same-reference customer/u })).toBeVisible();
});

test('Phase 24.1 SearchBox registers composition events and searches only after composition completes', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'The Phase 24.1 IME regression gate targets Chromium and WebKit.');
  await openStory(page, story('search-box-ime-regression'));
  const input = page.getByRole('searchbox', { name: 'IME search probe' });
  await input.evaluate((element) => {
    const control = element as HTMLInputElement;
    control.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(control, '検索');
    control.dispatchEvent(new InputEvent('input', { bubbles: true, data: '検索', inputType: 'insertCompositionText', isComposing: true }));
    control.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', isComposing: true }));
  });
  await expect(page.getByLabel('IME search count')).toHaveText('0');
  await input.evaluate((element) => element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '検索' })));
  await expect(page.getByLabel('IME search count')).toHaveText('1');
  await expect(page.getByLabel('IME last query')).toHaveText('検索');
});

for (const [label, name, globals, narrow] of [
  ['table-styling light', 'table-styling', undefined, false],
  ['table-styling dark', 'table-styling', 'theme:dark;density:compact;direction:ltr', false],
  ['table-styling RTL narrow', 'table-styling', 'theme:light;density:comfortable;direction:rtl', true],
  ['edit-validation-and-locking', 'edit-validation-and-locking', undefined, false],
  ['incomplete-combo-results', 'incomplete-combo-results', undefined, true],
  ['keyed-resolution-refresh-and-failure', 'keyed-resolution-refresh-and-failure', 'theme:dark;density:comfortable;direction:ltr', false],
  ['context-and-data-version-invalidation', 'context-and-data-version-invalidation', 'theme:light;density:comfortable;direction:rtl', true],
] as const) {
  test(`Phase 24.1 ${label} has no serious or critical Axe violations`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 780 });
    await openStory(page, story(name), globals);
    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
  });
}

test('Phase 24.1 styled Grid remains legible in forced colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openStory(page, story('table-styling'));
  const header = page.getByRole('columnheader').first();
  await expect(header).toHaveCSS('border-color', await header.evaluate((element) => getComputedStyle(element).color));
});
