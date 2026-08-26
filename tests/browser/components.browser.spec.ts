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
  'phase-4-listbox--default',
  'phase-5-tagbox--default',
  'phase-6-dropdownbox--default',
  'phase-7-keycombobox--default',
  'phase-8-dateedit--default',
  'phase-8-dateedit--open-calendar',
  'phase-8-dateedit--arabic-rtl',
  'phase-9-flyout--default',
  'phase-9-popup--default',
  'phase-9-window--default',
  'phase-9-maskedinput--default',
  'phase-9-popup--nested-flyout-ownership',
  'phase-9-popup--third-party-boundary',
  'phase-9-window--multiple-windows',
  'phase-9-maskedinput--validation',
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

test('KeyComboBox binds scalar keys, submits and resets forms, and rejects controlled proposals', async ({ page }) => {
  await openStory(page, 'phase-7-keycombobox--default');
  const controlled = page.getByRole('combobox', { name: 'Customer id' });
  await controlled.fill('Northwind');
  await controlled.press('ArrowDown');
  await controlled.press('Enter');
  await expect(controlled).toHaveValue('C-300 - Northwind Traders');
  await expect(page.getByLabel('Bound customer id')).toHaveText('3');

  await openStory(page, 'phase-7-keycombobox--native-form');
  const formInput = page.getByRole('combobox', { name: 'Form customer key' });
  await formInput.fill('Contoso');
  await formInput.press('ArrowDown');
  await formInput.press('Enter');
  const form = formInput.locator('xpath=ancestor::form');
  await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
  await expect(page.getByLabel('Submitted customer id')).toHaveText('2');
  await form.evaluate((element: HTMLFormElement) => element.reset());
  await expect(formInput).toHaveValue('C-100 - Acme Manufacturing');

  await openStory(page, 'phase-7-keycombobox--rejected-controlled-fixture');
  const rejected = page.getByRole('combobox', { name: 'Authoritative customer key' });
  await rejected.fill('Contoso');
  await rejected.press('ArrowDown');
  await rejected.press('Enter');
  await expect(rejected).toHaveValue('C-100 - Acme Manufacturing');
  await expect(page.getByLabel('Attempted customer id')).toHaveText('2');
});

test('ListBox supports keyboard navigation, modifier ranges, Ctrl+A, and pointer selection', async ({ page }) => {
  await openStory(page, 'phase-4-listbox--controlled-and-uncontrolled');
  const listbox = page.getByRole('listbox', { name: 'Controlled warehouses' });
  await listbox.focus();
  await listbox.press('End');
  await listbox.press(' ');
  await expect(page.getByLabel('Selected warehouse codes')).toHaveText('AR-01');
  await listbox.press('Shift+Home');
  await expect(page.getByLabel('Selected warehouse codes')).toHaveText('CAI-01, GIZ-01, ALX-01, ASW-01, AR-01');
  await listbox.press('Control+a');
  await expect(listbox.getByRole('option', { name: /CAI-02/u })).toHaveAttribute('aria-disabled', 'true');
  await listbox.getByRole('option', { name: /GIZ-01/u }).click({ modifiers: ['Control'] });
  await expect(page.getByLabel('Selected warehouse codes')).not.toContainText('GIZ-01');
  await listbox.press('Home');
  await listbox.press('PageDown');
  await expect(listbox).toHaveAttribute('aria-activedescendant', /option-/u);
});

test('ListBox clears search, selects the filtered set, and submits and resets native forms', async ({ page }) => {
  await openStory(page, 'phase-4-listbox--checkboxes-and-filtered-select-all');
  const search = page.getByRole('searchbox', { name: 'Search list' });
  const listbox = page.getByRole('listbox', { name: 'Filtered warehouse selection' });
  await expect(listbox.getByRole('option')).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Select all visible items' }).click();
  await expect(listbox.getByRole('option', { name: /CAI-01/u })).toHaveAttribute('aria-selected', 'true');
  await expect(listbox.getByRole('option', { name: /CAI-02/u })).toHaveAttribute('aria-selected', 'false');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(listbox.getByRole('option')).toHaveCount(6);
  await expect(listbox.getByRole('option', { name: /ALX-01/u })).toHaveAttribute('aria-selected', 'true');

  await openStory(page, 'phase-4-listbox--native-forms');
  const formList = page.getByRole('listbox', { name: 'Form warehouses' });
  await formList.getByRole('option', { name: /GIZ-01/u }).click();
  await page.getByRole('button', { name: 'Submit selection' }).click();
  await expect(page.getByLabel('Submitted warehouse keys')).toHaveText('1, 3');
  await page.getByRole('button', { name: 'Reset selection' }).click();
  await expect(formList.getByRole('option', { name: /CAI-01/u })).toHaveAttribute('aria-selected', 'true');
  await expect(formList.getByRole('option', { name: /GIZ-01/u })).toHaveAttribute('aria-selected', 'false');

  await openStory(page, 'phase-4-listbox--required-native-form');
  const requiredList = page.getByRole('listbox', { name: 'Required form warehouses' });
  await page.getByRole('button', { name: 'Submit required list' }).click();
  await expect(requiredList).toBeFocused();
  await expect(requiredList).toHaveAttribute('aria-invalid', 'true');
});

test('ListBox renders columns, virtual windows, touch targets, dark mode, and Arabic RTL', async ({ page }) => {
  await openStory(page, 'phase-4-listbox--columns-groups-and-templates');
  const columns = page.getByRole('listbox', { name: 'Warehouse columns and groups' });
  await expect(page.getByText('Code', { exact: true })).toBeVisible();
  await expect(columns.getByRole('separator')).toHaveCount(5);

  await openStory(page, 'phase-4-listbox--virtual-large-data');
  const virtual = page.getByRole('listbox', { name: 'Virtual warehouses' });
  expect(await virtual.getByRole('option').count()).toBeLessThan(1_000);
  const firstBox = await virtual.getByRole('option').first().boundingBox();
  expect(firstBox?.height).toBeGreaterThanOrEqual(40);
  await virtual.focus();
  await virtual.press('End');
  await expect(virtual).toHaveAttribute('aria-activedescendant', /option-999$/u);
  await expect(virtual.getByRole('option', { name: /WH-1000/u })).toBeVisible();

  await openStory(page, 'phase-4-listbox--dark-compact', 'theme:dark;density:compact;direction:ltr');
  await expect(page.locator('[data-cg-theme="dark"]')).toBeVisible();

  await openStory(page, 'phase-4-listbox--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const arabic = page.getByRole('listbox', { name: 'المستودعات' });
  expect(await arabic.evaluate((element) => getComputedStyle(element).direction)).toBe('rtl');
  await expect(arabic.getByRole('option', { name: /أَحْمَد/u })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'بحث المستودعات' })).toHaveValue('احمد');
});

test('TagBox supports keyboard, pointer, removal, ARIA ownership, and controlled objects', async ({ page }) => {
  await openStory(page, 'phase-5-tagbox--controlled-and-uncontrolled');
  const input = page.getByRole('combobox', { name: 'Controlled customers', exact: true });
  await input.fill('Contoso');
  const option = page.getByRole('option', { name: /Contoso Retail/u });
  await expect(option.locator('xpath=..')).toHaveAttribute('role', 'listbox');
  await option.click();
  await expect(page.getByLabel('Selected customer codes')).toContainText('C-200');
  await expect(input).toBeFocused();
  await input.press('ArrowDown');
  await input.press('End');
  await expect(input).toHaveAttribute('aria-activedescendant', /option-/u);
  await input.press('Enter');
  await input.press('Backspace');
  await input.press('ArrowDown');
  await page.locator('body').click({ position: { x: 8, y: 8 } });
  await expect(input).not.toHaveAttribute('aria-controls', /.+/u);
  await input.press('ArrowDown');
  await input.press('Escape');
  await expect(input).not.toHaveAttribute('aria-controls', /.+/u);
});

test('TagBox handles remote minimum, loading, error recovery, and selection', async ({ page }) => {
  await openStory(page, 'phase-5-tagbox--remote-loading-minimum-and-error');
  const input = page.getByRole('combobox', { name: 'Remote customers' });
  await input.fill('c');
  await expect(page.getByText('Type at least 2 characters to search.')).toBeVisible();
  await input.fill('contoso');
  await expect(page.getByText('Loading…')).toBeVisible();
  await page.getByRole('option', { name: /Contoso Retail/u }).click();
  await expect(page.getByRole('button', { name: /Remove C-200/u })).toBeVisible();
  await input.fill('error');
  await expect(page.getByText('Unable to load results.')).toBeVisible();
  await input.fill('north');
  await expect(page.getByRole('option', { name: /Northwind Traders/u })).toBeVisible();
});

test('TagBox submits and resets forms, focuses invalid input, and rejects controlled proposals', async ({ page }) => {
  await openStory(page, 'phase-5-tagbox--native-forms');
  const formInput = page.getByRole('combobox', { name: 'Form customers' });
  await formInput.fill('Contoso');
  await page.getByRole('option', { name: /Contoso Retail/u }).click();
  await formInput.press('Escape');
  await page.getByRole('button', { name: 'Submit selections' }).click();
  await expect(page.getByLabel('Submitted customer keys')).toHaveText('1, 2');
  await page.getByRole('button', { name: 'Reset selections' }).click();
  await expect(page.getByRole('button', { name: /Remove C-100/u })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Remove C-200/u })).toHaveCount(0);

  await openStory(page, 'phase-5-tagbox--required-native-form');
  const required = page.getByRole('combobox', { name: 'Required form customers' });
  await page.getByRole('button', { name: 'Submit required tags' }).click();
  await expect(required).toBeFocused();
  await expect(required).toHaveAttribute('aria-invalid', 'true');

  await openStory(page, 'phase-5-tagbox--rejected-controlled-fixture');
  const rejected = page.getByRole('combobox', { name: 'Authoritative customers' });
  await rejected.fill('Contoso');
  await page.getByRole('option', { name: /Contoso Retail/u }).click();
  await expect(page.getByRole('button', { name: /Remove C-100/u })).toBeVisible();
  await expect(page.getByRole('button', { name: /Remove C-200/u })).toHaveCount(0);
  await expect(page.getByLabel('Attempted customers')).toContainText('Contoso Retail');
});

test('TagBox renders maximum selection, custom tags, dark density, and Arabic RTL', async ({ page }) => {
  await openStory(page, 'phase-5-tagbox--maximum-and-custom-tags');
  const maximum = page.getByRole('combobox', { name: 'Approval recipients' });
  await maximum.press('ArrowDown');
  await expect(page.getByRole('option', { name: /Northwind Traders/u })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Unavailable').first()).toBeVisible();

  await openStory(page, 'phase-5-tagbox--dark-compact', 'theme:dark;density:compact;direction:ltr');
  await expect(page.locator('[data-cg-theme="dark"]')).toBeVisible();

  await openStory(page, 'phase-5-tagbox--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const arabic = page.getByRole('combobox', { name: 'العملاء' });
  expect(await arabic.evaluate((element) => getComputedStyle(element).direction)).toBe('rtl');
  await arabic.fill('احمد');
  await expect(page.getByRole('option', { name: /أَحْمَد/u })).toHaveAttribute('aria-selected', 'true');
});

test('DropDownBox supports immediate pointer and keyboard commits, dismissal, and focus return', async ({ page }) => {
  await openStory(page, 'phase-6-dropdownbox--immediate-list-box-selection');
  const input = page.getByRole('combobox', { name: 'Immediate customer' });
  await input.click();
  const popup = page.getByRole('dialog', { name: 'Dropdown content' });
  await expect(popup).toBeVisible();
  await expect(input).toHaveAttribute('aria-controls', await popup.getAttribute('id') ?? 'missing');
  await page.getByRole('option', { name: /Contoso Retail/u }).click();
  await expect(input).toHaveValue('C-200 - Contoso Retail');
  await expect(input).toBeFocused();

  await input.press('F4');
  await expect(popup).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(input).toBeFocused();

  await input.press('Alt+ArrowDown');
  await expect(page.getByRole('dialog', { name: 'Dropdown content' })).toBeVisible();
  await page.evaluate(() => document.dispatchEvent(new Event('scroll')));
  await expect(page.getByRole('dialog', { name: 'Dropdown content' })).toHaveCount(0);
});

test('DropDownBox explicit mode applies once and cancels pending TagBox selections', async ({ page }) => {
  await openStory(page, 'phase-6-dropdownbox--explicit-tag-box-selection');
  const input = page.getByRole('combobox', { name: 'Explicit customer set' });
  await input.click();
  const tags = page.getByRole('combobox', { name: 'Pending customers' });
  await tags.fill('Contoso');
  await page.getByRole('option', { name: /Contoso Retail/u }).click();
  await tags.press('Escape');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(input).toHaveValue('C-100, C-200');

  await input.click();
  await page.getByRole('button', { name: /Remove C-200/u }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(input).toHaveValue('C-100, C-200');
  await expect(input).toBeFocused();
});

test('DropDownBox serializes external forms, resets, focuses invalid controls, and cancels async lifecycle work', async ({ page }) => {
  await openStory(page, 'phase-6-dropdownbox--external-native-form');
  const formInput = page.getByRole('combobox', { name: 'External form customer' });
  await formInput.click();
  await page.getByRole('option', { name: /Contoso Retail/u }).click();
  await page.getByRole('button', { name: 'Submit customer' }).click();
  await expect(page.getByLabel('Submitted customer key')).toHaveText('2');
  await page.getByRole('button', { name: 'Reset customer' }).click();
  await expect(formInput).toHaveValue('C-100 - Acme Manufacturing');

  await openStory(page, 'phase-6-dropdownbox--required-invalid');
  const required = page.getByRole('combobox', { name: 'Required dropdown customer' });
  await page.getByRole('button', { name: 'Submit required dropdown' }).click();
  await expect(required).toBeFocused();
  await expect(required).toHaveAttribute('aria-invalid', 'true');

  await openStory(page, 'phase-6-dropdownbox--async-lifecycle-cancellation');
  const lifecycle = page.getByRole('combobox');
  await page.getByRole('button', { name: 'Request open' }).click();
  await expect(page.getByLabel('Lifecycle log')).toContainText('open cancelled');
  await page.getByRole('button', { name: 'Request open' }).click();
  await expect(page.getByRole('dialog', { name: 'Dropdown content' })).toBeVisible();
  await expect(page.getByLabel('Lifecycle log')).toContainText('after open');
  await lifecycle.press('Escape');
  await expect(page.getByLabel('Lifecycle log')).toContainText('after close');
});

test('DropDownBox stacks nested popups and positions resizable, narrow, dark, and RTL surfaces', async ({ page }) => {
  await openStory(page, 'phase-6-dropdownbox--nested-popup');
  const inputs = page.getByRole('combobox');
  await inputs.first().click();
  await inputs.nth(1).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await openStory(page, 'phase-6-dropdownbox--width-resize-and-placement');
  const resizable = page.getByRole('dialog', { name: 'Dropdown content' });
  const editorBox = await page.getByRole('combobox', { name: 'Content width dropdown' }).boundingBox();
  const popupBox = await resizable.boundingBox();
  expect(popupBox?.width).toBeGreaterThanOrEqual(editorBox?.width ?? 0);
  expect(await resizable.evaluate((element) => getComputedStyle(element).resize)).toBe('both');

  await page.setViewportSize({ width: 360, height: 540 });
  await openStory(page, 'phase-6-dropdownbox--narrow-viewport');
  const narrowEditorBox = await page.getByRole('combobox', { name: 'Narrow viewport dropdown' }).boundingBox();
  const narrowBox = await page.getByRole('dialog', { name: 'Dropdown content' }).boundingBox();
  expect(narrowEditorBox).not.toBeNull();
  expect(narrowEditorBox?.x ?? 0).toBeGreaterThanOrEqual(3);
  expect((narrowEditorBox?.x ?? 0) + (narrowEditorBox?.width ?? 0)).toBeLessThanOrEqual(357);
  expect(narrowBox).not.toBeNull();
  expect(narrowBox?.x ?? 0).toBeGreaterThanOrEqual(3);
  expect((narrowBox?.x ?? 0) + (narrowBox?.width ?? 0)).toBeLessThanOrEqual(357);

  await page.setViewportSize({ width: 1280, height: 720 });
  await openStory(page, 'phase-6-dropdownbox--dark-compact', 'theme:dark;density:compact;direction:ltr');
  await expect(page.getByRole('dialog', { name: 'Dropdown content' })).toHaveAttribute('data-cg-theme', 'dark');

  await openStory(page, 'phase-6-dropdownbox--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const arabic = page.getByRole('combobox', { name: 'العميل' });
  const arabicPopup = page.getByRole('dialog', { name: 'محتوى القائمة' });
  expect(await arabic.evaluate((element) => getComputedStyle(element).direction)).toBe('rtl');
  const arabicEditorBox = await arabic.boundingBox();
  const arabicPopupBox = await arabicPopup.boundingBox();
  expect(Math.abs((arabicEditorBox?.x ?? 0) - (arabicPopupBox?.x ?? 0))).toBeLessThanOrEqual(2);
});

test('DateEdit supports semantic keyboard navigation, panels, selection, Escape, and focus return', async ({ page }) => {
  await openStory(page, 'phase-8-dateedit--open-calendar');
  const input = page.getByRole('combobox', { name: 'Open calendar date' });
  const dialog = page.getByRole('dialog', { name: 'Calendar' });
  const grid = page.getByRole('grid');
  await expect(dialog).toBeVisible();
  await expect(input).toHaveAttribute('aria-controls', await dialog.getAttribute('id') ?? 'missing');
  await expect(grid.getByRole('gridcell')).toHaveCount(42);
  await expect(grid.getByRole('columnheader')).toHaveCount(7);
  await page.locator('[data-focus-value="2026-08-21"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-focus-value="2026-08-22"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-focus-value="2026-08-29"]')).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('End');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('Shift+PageDown');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(input).toBeFocused();

  await input.press('ArrowDown');
  await page.getByRole('button', { name: 'Choose month and year' }).click();
  await expect(page.getByRole('grid').getByRole('gridcell')).toHaveCount(12);
  await page.getByRole('button', { name: 'Choose year' }).click();
  await expect(page.getByRole('grid').getByRole('gridcell')).toHaveCount(12);
  await page.getByRole('button', { name: '2027' }).click();
  await page.getByRole('button', { name: /August/u }).click();
  await page.locator('[data-date="2027-08-24"]').click();
  await expect(input).toHaveValue('2027-08-24');
  await expect(input).toBeFocused();
});

test('DateEdit serializes canonical values, resets external forms, validates required input, and restores rejected controlled proposals', async ({ page }) => {
  await openStory(page, 'phase-8-dateedit--external-form-behavior');
  const formInput = page.getByRole('combobox', { name: 'External form invoice date' });
  await formInput.focus();
  await expect(formInput).toHaveValue('21/08/2026');
  await formInput.fill('22/08/2026');
  await formInput.press('Enter');
  await expect(page.getByLabel('Submitted canonical date')).toHaveText('Not submitted');
  await expect(page.locator('[data-cg-date-edit-form-proxy]')).toHaveValue('2026-08-22');
  await page.getByRole('button', { name: 'Submit date' }).click();
  await expect(page.getByLabel('Submitted canonical date')).toHaveText('2026-08-22');
  await page.getByRole('button', { name: 'Reset date' }).click();
  await expect(formInput).toHaveValue('21 August 2026');

  await openStory(page, 'phase-8-dateedit--required-native-form-validation');
  const required = page.getByRole('combobox', { name: 'Required native date' });
  await page.getByRole('button', { name: 'Submit required date' }).click();
  await expect(required).toBeFocused();
  await expect(required).toHaveAttribute('aria-invalid', 'true');

  await openStory(page, 'phase-8-dateedit--rejected-controlled-fixture');
  const rejected = page.getByRole('combobox', { name: 'Authoritative date' });
  await rejected.fill('2026-08-22');
  await rejected.press('Enter');
  await expect(rejected).toHaveValue('2026-08-21');
  await expect(page.getByLabel('Attempted date')).toHaveText('2026-08-22');
});

test('DateEdit repositions and dismisses outside, supports Arabic RTL, forced colors, reduced motion, and narrow zoomed layouts', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 540 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await openStory(page, 'phase-8-dateedit--narrow-layout');
  const narrowInput = page.getByRole('combobox', { name: 'Narrow date' });
  const narrowDialog = page.getByRole('dialog', { name: 'Calendar' });
  const inputBox = await narrowInput.boundingBox();
  const popupBox = await narrowDialog.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(popupBox).not.toBeNull();
  expect(popupBox?.x ?? -1).toBeGreaterThanOrEqual(3);
  expect((popupBox?.x ?? 0) + (popupBox?.width ?? 0)).toBeLessThanOrEqual(357);
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  await expect(narrowDialog).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
  await openStory(page, 'phase-8-dateedit--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const arabic = page.getByRole('combobox', { name: 'تاريخ القيد' });
  expect(await arabic.evaluate((element) => getComputedStyle(element).direction)).toBe('rtl');
  await expect(page.getByRole('dialog', { name: 'التقويم' })).toBeVisible();
  await page.locator('[data-focus-value="2026-08-21"]').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-focus-value="2026-08-22"]')).toBeFocused();
});

test('DateEdit observes async cancellation without committing a stale value', async ({ page }) => {
  await openStory(page, 'phase-8-dateedit--async-before-change-cancellation');
  const input = page.getByRole('combobox', { name: 'Approval date' });
  await input.fill('2026-08-23');
  await input.press('Enter');
  await expect(page.getByLabel('Async date log')).toHaveText('Cancelled by policy');
  await expect(input).toHaveValue('2026-08-21');
  await input.fill('2026-08-24');
  await input.press('Enter');
  await expect(page.getByLabel('Async date log')).toHaveText('Accepted');
  await expect(input).toHaveValue('2026-08-24');
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

test('Flyout and Popup preserve nested ownership, matched pointer pairs, and Escape ordering', async ({ page }) => {
  await openStory(page, 'phase-9-popup--nested-flyout-ownership');
  const popup = page.getByRole('dialog', { name: 'Customer details' });
  const nested = page.getByRole('button', { name: 'Open ledger' });
  await expect(popup).toBeVisible();
  await expect(nested).toBeVisible();

  const nestedBox = await nested.boundingBox();
  expect(nestedBox).not.toBeNull();
  await page.mouse.move((nestedBox?.x ?? 0) + 4, (nestedBox?.y ?? 0) + 4);
  await page.mouse.down();
  await page.mouse.move(4, 4);
  await page.mouse.up();
  await expect(nested).toBeVisible();
  await expect(popup).toBeVisible();

  await nested.focus();
  await page.keyboard.press('Escape');
  await expect(nested).toHaveCount(0);
  await expect(popup).toBeVisible();
  await page.locator('[data-cg-popup-backdrop]').click({ position: { x: 4, y: 4 } });
  await expect(popup).toHaveCount(0);

  await openStory(page, 'phase-9-popup--third-party-boundary');
  const boundaryPopup = page.getByRole('dialog', { name: 'Boundary ownership' });
  const externalAction = page.getByRole('button', { name: 'External owned action' });
  await externalAction.focus();
  await expect(externalAction).toBeFocused();
  await externalAction.click();
  await expect(boundaryPopup).toBeVisible();
});

test('Popup traps and returns focus, adapts to narrow viewports, and supports pointer drag and resize', async ({ page }) => {
  await openStory(page, 'phase-9-popup--focus-trap-and-return');
  const opener = page.getByRole('button', { name: 'Launch focus Popup' });
  await opener.focus();
  await opener.click();
  await expect(page.getByRole('button', { name: 'First modal action' })).toBeFocused();
  await page.getByRole('button', { name: 'Last modal action' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();

  await openStory(page, 'phase-9-popup--drag-and-resize');
  const dialog = page.getByRole('dialog', { name: 'Resizable posting dialog' });
  const before = await dialog.boundingBox();
  const header = dialog.locator('[data-cg-overlay-header]');
  const headerBox = await header.boundingBox();
  expect(before).not.toBeNull();
  expect(headerBox).not.toBeNull();
  await page.mouse.move((headerBox?.x ?? 0) + 30, (headerBox?.y ?? 0) + 20);
  await page.mouse.down();
  await page.mouse.move((headerBox?.x ?? 0) + 80, (headerBox?.y ?? 0) + 50);
  await page.mouse.up();
  const moved = await dialog.boundingBox();
  expect((moved?.x ?? 0) - (before?.x ?? 0)).toBeGreaterThan(20);
  const handle = dialog.locator('[data-cg-resize="se"]');
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move((handleBox?.x ?? 0) + 3, (handleBox?.y ?? 0) + 3);
  await page.mouse.down();
  await page.mouse.move((handleBox?.x ?? 0) + 43, (handleBox?.y ?? 0) + 33);
  await page.mouse.up();
  const resized = await dialog.boundingBox();
  expect((resized?.width ?? 0) - (moved?.width ?? 0)).toBeGreaterThan(20);

  await page.setViewportSize({ width: 360, height: 540 });
  await openStory(page, 'phase-9-popup--adaptive-narrow');
  const adaptive = await page.getByRole('dialog', { name: 'Adaptive approval' }).boundingBox();
  expect(adaptive).not.toBeNull();
  expect(adaptive?.x ?? -1).toBeGreaterThanOrEqual(11);
  expect((adaptive?.x ?? 0) + (adaptive?.width ?? 0)).toBeLessThanOrEqual(349);
});

test('Window paint order follows focus and Escape is scoped to the focused owner', async ({ page }) => {
  await openStory(page, 'phase-9-window--multiple-windows');
  const journal = page.getByRole('dialog', { name: 'Journal lines' });
  const account = page.getByRole('dialog', { name: 'Account lookup' });
  const accountOrder = await account.locator('xpath=..').evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  await page.getByRole('button', { name: 'Add line' }).click();
  const journalOrder = await journal.locator('xpath=..').evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  expect(journalOrder).toBeGreaterThan(accountOrder);
  await page.keyboard.press('Escape');
  await expect(journal).toHaveCount(0);
  await expect(account).toBeVisible();
});

test('Window drag and resize release pointer gestures cleanly', async ({ page }) => {
  await openStory(page, 'phase-9-window--drag-and-resize');
  const window = page.getByRole('dialog', { name: 'Resizable analysis' });
  const before = await window.boundingBox();
  const headerBox = await window.locator('[data-cg-overlay-header]').boundingBox();
  expect(before).not.toBeNull();
  expect(headerBox).not.toBeNull();
  await page.mouse.move((headerBox?.x ?? 0) + 20, (headerBox?.y ?? 0) + 18);
  await page.mouse.down();
  await page.mouse.move((headerBox?.x ?? 0) + 65, (headerBox?.y ?? 0) + 48);
  await page.mouse.up();
  const moved = await window.boundingBox();
  expect((moved?.x ?? 0) - (before?.x ?? 0)).toBeGreaterThan(15);
  const handleBox = await window.locator('[data-cg-resize="se"]').boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move((handleBox?.x ?? 0) + 3, (handleBox?.y ?? 0) + 3);
  await page.mouse.down();
  await page.mouse.move((handleBox?.x ?? 0) + 33, (handleBox?.y ?? 0) + 33);
  await page.mouse.up();
  const resized = await window.boundingBox();
  expect((resized?.width ?? 0) - (moved?.width ?? 0)).toBeGreaterThan(15);
});

test('MaskedInput handles caret editing, Unicode, controlled rejection, forms, and RTL', async ({ page }) => {
  await openStory(page, 'phase-9-maskedinput--default');
  const controlled = page.getByRole('textbox', { name: 'Controlled mobile' });
  await controlled.focus();
  await controlled.press('End');
  await controlled.evaluate((element) => {
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', { value: { getData: () => '8' } });
    element.dispatchEvent(pasteEvent);
  });
  await expect(controlled).toHaveValue('0101 234 5678');
  await expect(page.getByLabel('Controlled masked value')).toHaveText('0101 234 5678');

  await openStory(page, 'phase-9-maskedinput--unicode');
  const unicode = page.getByRole('textbox', { name: 'Astral Unicode letter' });
  await unicode.focus();
  await unicode.press('End');
  await unicode.press('Backspace');
  await expect(unicode).toHaveValue('𐐀_');
  await page.keyboard.insertText('٢');
  await expect(unicode).toHaveValue('𐐀٢');

  await openStory(page, 'phase-9-maskedinput--controlled-rejection');
  const rejected = page.getByRole('textbox', { name: 'Authoritative code' });
  await rejected.focus();
  await rejected.press('End');
  await page.keyboard.insertText('45');
  await expect(page.getByLabel('Attempted masked value')).toHaveText('123-45');
  await expect(rejected).toHaveValue('123-__');

  await openStory(page, 'phase-9-maskedinput--value-semantics-and-form');
  await page.getByRole('button', { name: 'Submit identifier' }).click();
  await expect(page.getByLabel('Submitted identifier')).toHaveText('123456789');
  await page.getByRole('button', { name: 'Reset identifier' }).click();
  await expect(page.getByRole('textbox', { name: 'Tax identifier' })).toHaveValue('123-456-789');

  await page.setViewportSize({ width: 360, height: 540 });
  await openStory(page, 'phase-9-maskedinput--arabic-rtl-narrow', 'theme:light;density:comfortable;direction:rtl');
  const rtl = page.getByRole('textbox', { name: 'رقم الهاتف' });
  expect(await rtl.evaluate((element) => getComputedStyle(element).direction)).toBe('ltr');
  await rtl.focus();
  await rtl.press('End');
  await page.keyboard.insertText('٨');
  await expect(rtl).toHaveValue('٠١٠١ ٢٣٤ ٥٦٧٨');
});
