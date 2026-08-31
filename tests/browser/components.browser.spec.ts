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
  'phase-10-menu--horizontal-navigation',
  'phase-10-menu--application-menu',
  'phase-10-contextmenu--pointer-opened',
  'phase-10-contextmenu--cancellation-and-focus-return',
  'phase-10-dropdownbutton--commands',
  'phase-10-dropdownbutton--arbitrary-content',
  'phase-10-splitbutton--default',
  'phase-10-toolbar--full',
  'phase-10-toolbar--narrow-popup',
  'phase-11-layoutbreakpoint--named-bands',
  'phase-11-tabs--controlled-closable-reorderable',
  'phase-11-stepper--controlled-horizontal',
  'phase-11-accordion--controlled-disclosure',
  'phase-11-formlayout--standard-responsive',
  'phase-12-treeview--nested-descriptors',
  'phase-14-lookupgrid--local-item-lookup',
  'phase-15-filterbuilder--explicit-nested',
  'phase-15-pager--numeric-buttons',
  'phase-15-advanced-grid--typed-filters-and-numeric-pager',
  'phase-16-calendar--single-and-range',
  'phase-16-daterangepicker--explicit-with-presets',
  'phase-16-toast--positions-actions-and-limits',
  'phase-16-confirmation--variants-and-queueing',
  'phase-17-fileuploader--basic-automatic',
  'phase-18-splitter--horizontal-live',
  'phase-18-splitter--arabic-rtl-narrow',
  'phase-18-drawer--shrink-start',
  'phase-18-drawer--overlay-open',
  'phase-19-rangeselector--number-range',
  'phase-19-tooltip--hover-focus',
  'phase-19-statusbadge--types-and-appearances',
  'phase-20-chart--cartesian-mixed',
  'phase-21-treelist--flat-chart-of-accounts',
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

test('Phase 15 Pager navigates, commits Unicode digits, and preserves chronological RTL keys', async ({ page }) => {
  await openStory(page, 'phase-15-pager--input-box');
  const input = page.getByRole('textbox', { name: 'Page' });
  await input.fill('١٢'); await input.press('Enter');
  await expect(input).toHaveValue('12');
  await openStory(page, 'phase-15-pager--numeric-buttons', 'theme:light;density:comfortable;direction:rtl');
  const current = page.locator('button[aria-current="page"]');
  await current.focus(); await current.press('ArrowRight');
  await expect(page.locator('button[aria-current="page"]')).toHaveText('7');
});

test('Phase 15 FilterBuilder retains invalid rows and exposes associated validation', async ({ page }) => {
  await openStory(page, 'phase-15-filterbuilder--invalid-draft');
  await expect(page.getByRole('button', { name: 'Apply' })).toBeDisabled();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('Phase 15 cell editing enters by command and commits with Enter', async ({ page }) => {
  await openStory(page, 'phase-15-advanced-grid--cell-editing');
  await page.getByRole('button', { name: 'Edit' }).first().click();
  const editor = page.locator('tbody').getByRole('textbox', { name: /^Customer/u });
  await editor.fill('Updated customer'); await editor.press('Enter');
  await expect(page.getByText('Updated customer')).toBeVisible();
});

test('Phase 15 forced-colors stories retain visible controls and focus', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openStory(page, 'phase-15-filterbuilder--forced-colors');
  const clear = page.getByRole('button', { name: 'Clear', exact: true }); await clear.focus();
  await expect(clear).toBeFocused();
  await expect.poll(() => clear.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
});

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

test('Menu preserves native navigation semantics and application-menu keyboard ownership', async ({ page }) => {
  await openStory(page, 'phase-10-menu--horizontal-navigation');
  const home = page.getByRole('link', { name: 'Home' });
  await expect(home).toHaveAttribute('href', '/');
  await page.evaluate(() => {
    const state = window as typeof window & { __cgMiddleClickPrevented?: boolean };
    delete state.__cgMiddleClickPrevented;
    window.addEventListener('auxclick', (event) => {
      state.__cgMiddleClickPrevented = event.defaultPrevented;
      event.preventDefault();
    }, { once: true });
  });
  await home.click({ button: 'middle' });
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __cgMiddleClickPrevented?: boolean }).__cgMiddleClickPrevented)).toBe(false);

  await openStory(page, 'phase-10-menu--application-menu');
  const menu = page.getByRole('menubar');
  const first = menu.getByRole('menuitem', { name: 'Home' });
  await first.focus();
  await first.press('ArrowRight');
  const sales = menu.getByRole('menuitem', { name: 'Sales' });
  await expect(sales).toBeFocused();
  await sales.press('ArrowDown');
  const orders = page.getByRole('menuitem', { name: 'Orders' });
  await expect(orders).toBeFocused();
  await orders.press('Escape');
  await expect(sales).toBeFocused();
});

test('ContextMenu supports pointer, keyboard, long-press, nested ownership, cancellation, and focus return', async ({ page }) => {
  await openStory(page, 'phase-10-contextmenu--pointer-opened');
  const target = page.getByText('Right-click order SO-1042');
  await target.focus();
  await target.click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Open order' })).toBeFocused();
  await page.getByRole('menuitem', { name: 'Status' }).hover();
  await expect(page.getByRole('menuitemradio', { name: 'Open' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(target).toBeFocused();
  await target.press('Shift+F10');
  await expect(page.getByRole('menuitem', { name: 'Open order' })).toBeVisible();
  await page.keyboard.press('Escape');
  await target.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 42, clientX: 100, clientY: 100 });
  await page.waitForTimeout(650);
  await expect(page.getByRole('menuitem', { name: 'Open order' })).toBeVisible();
  await target.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 42, clientX: 100, clientY: 100 });
  await page.keyboard.press('Escape');

  await openStory(page, 'phase-10-contextmenu--cancellation-and-focus-return');
  const protectedTarget = page.getByRole('button', { name: 'Protected order' });
  await protectedTarget.focus();
  await protectedTarget.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'Protected command' }).click();
  await expect(page.getByLabel('Command status')).toHaveText('Cancelled by policy');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(protectedTarget).toBeFocused();
});

test('DropDownButton and SplitButton keep trigger, dialog, and primary-action semantics isolated', async ({ page }) => {
  await openStory(page, 'phase-10-dropdownbutton--commands');
  const trigger = page.getByRole('button', { name: 'Actions' });
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'New invoice' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();

  await openStory(page, 'phase-10-dropdownbutton--arbitrary-content');
  await page.getByRole('button', { name: 'Filters' }).click();
  await expect(page.getByRole('dialog', { name: 'Button menu' })).toBeVisible();
  await expect(page.getByRole('textbox')).toBeFocused();

  await openStory(page, 'phase-10-splitbutton--default');
  await expect(page.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-haspopup');
  const toggle = page.getByRole('button', { name: 'Open menu' });
  await toggle.click();
  await expect(page.getByRole('menuitem', { name: 'Save and close' })).toBeVisible();
});

test('Toolbar roves focus, opens shared menus, overflows in narrow containers, and adapts inside Popup', async ({ page }) => {
  await openStory(page, 'phase-10-toolbar--full');
  const toolbar = page.getByRole('toolbar');
  const first = toolbar.getByRole('button', { name: 'New invoice' });
  await first.focus();
  await first.press('ArrowRight');
  await expect(toolbar.getByRole('button', { name: 'Save' })).toBeFocused();
  const exportButton = toolbar.getByRole('button', { name: 'Export' });
  await exportButton.focus();
  await exportButton.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeFocused();
  await page.keyboard.press('Escape');

  await openStory(page, 'phase-10-toolbar--narrow-overflow');
  const narrow = page.getByRole('toolbar');
  await expect(narrow).not.toHaveAttribute('data-cg-toolbar-stage', '0');
  await expect(narrow.getByRole('button', { name: 'More commands' })).toBeVisible();

  await openStory(page, 'phase-10-toolbar--narrow-popup');
  await expect(page.getByRole('dialog', { name: 'Toolbar in popup' })).toBeVisible();
  await expect(page.getByRole('toolbar')).toBeVisible();
});

test('LayoutBreakpoint switches at every exact viewport boundary', async ({ page }) => {
  for (const [width, active] of [[575, 'x-small'], [576, 'small'], [767, 'small'], [768, 'medium'], [991, 'medium'], [992, 'large'], [1199, 'large'], [1200, 'x-large']] as const) {
    await page.setViewportSize({ width, height: 720 });
    await openStory(page, 'phase-11-layoutbreakpoint--named-bands');
    await expect(page.getByTestId(`${active}-state`)).toHaveText(`${active}: active`);
  }
});

test('Tabs support keyboard, retained content, close, reorder, overflow, and RTL', async ({ page }) => {
  await openStory(page, 'phase-11-tabs--controlled-closable-reorderable');
  const general = page.getByRole('tab', { name: 'General' });
  const lines = page.getByRole('tab', { name: 'Order lines' });
  await general.focus(); await general.press('ArrowRight'); await expect(lines).toBeFocused(); await lines.press('Enter');
  const draft = page.getByRole('textbox', { name: 'Line state' }); await draft.fill('retained');
  await general.click(); await lines.click(); await expect(draft).toHaveValue('retained');
  const from = page.locator('[data-tab-key="general"]'); const to = page.locator('[data-tab-key="lines"]');
  const fromBox = await from.boundingBox(); const toBox = await to.boundingBox();
  if (fromBox && toBox) { await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2); await page.mouse.down(); await page.mouse.move(toBox.x + toBox.width, toBox.y + toBox.height / 2, { steps: 5 }); await page.mouse.up(); }
  await expect(page.getByRole('tab').first()).toHaveText(/Order lines/u);
  await page.getByRole('button', { name: 'Close Order lines' }).click(); await expect(lines).toHaveCount(0);

  await openStory(page, 'phase-11-tabs--overflow-buttons'); await expect(page.getByRole('button', { name: 'Next tabs' })).toBeVisible();
  await openStory(page, 'phase-11-tabs--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const rtlFirst = page.getByRole('tab', { name: 'عام' }); await rtlFirst.focus(); await rtlFirst.press('ArrowLeft'); await expect(page.getByRole('tab', { name: 'السطور' })).toBeFocused();
});

test('Stepper preserves linear keyboard and physical RTL navigation with active content', async ({ page }) => {
  await openStory(page, 'phase-11-stepper--controlled-horizontal');
  const customer = page.getByRole('button', { name: /Customer/u }); await customer.focus(); await customer.press('ArrowRight');
  const lines = page.getByRole('button', { name: /Lines/u }); await expect(lines).toBeFocused(); await lines.press('Enter'); await expect(page.getByRole('region')).toContainText('Line editor');
  await openStory(page, 'phase-11-stepper--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const first = page.getByRole('button', { name: /العميل/u }); await first.focus(); await first.press('ArrowLeft'); await expect(page.getByRole('button', { name: /السطور/u })).toBeFocused();
});

test('Accordion supports tree navigation, route anchors, filtering, and retryable lazy failure', async ({ page }) => {
  await openStory(page, 'phase-11-accordion--nested-tree');
  await expect(page.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/sales/orders');
  const sales = page.getByRole('button', { name: 'Sales' }); await sales.focus(); await sales.press('ArrowRight'); await expect(page.getByRole('link', { name: 'Orders' })).toBeFocused();

  await openStory(page, 'phase-11-accordion--filtered');
  const filter = page.getByRole('searchbox', { name: 'Filter items' }); await filter.fill('not present'); await expect(page.getByText('No matching sections.')).toBeVisible();
  await filter.fill('aging'); await expect(page.getByText('Aging report')).toBeVisible();

  await openStory(page, 'phase-11-accordion--lazy-failure');
  await page.getByRole('button', { name: 'Remote children' }).click(); await expect(page.getByRole('alert')).toContainText('Could not load items'); await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('TreeView supports separated pointer selection, expansion, recursive checking, filtering, and dynamic nodes', async ({ page }) => {
  await openStory(page, 'phase-12-treeview--recursive-checking');
  const products = page.locator('[data-node-key="products"]');
  const hardware = page.locator('[data-node-key="hardware"]');
  const keyboard = page.locator('[data-node-key="keyboard"]');
  await expect(products).toHaveAttribute('role', 'treeitem');
  await expect(products).toHaveAttribute('aria-level', '1');
  await products.locator(':scope > div > button[role="checkbox"]').click();
  await expect(products).toHaveAttribute('aria-checked', 'true');
  await keyboard.locator(':scope > div > button[role="checkbox"]').click();
  await expect(products).toHaveAttribute('aria-checked', 'mixed');
  await hardware.locator(':scope > div').first().click();
  await expect(hardware).toHaveAttribute('aria-selected', 'true');
  await expect(hardware).toHaveAttribute('aria-expanded', 'true');
  await hardware.locator(':scope > div > button').first().click();
  await expect(hardware).toHaveAttribute('aria-expanded', 'false');
  await expect(hardware).toHaveAttribute('aria-selected', 'true');

  await openStory(page, 'phase-12-treeview--filtering');
  const filter = page.getByRole('searchbox', { name: 'Filter tree' });
  await expect(page.locator('[data-node-key="mouse"]')).toBeVisible();
  await filter.fill('not present');
  await expect(page.getByText('No matching nodes')).toBeVisible();
  await filter.fill('bluetooth');
  await expect(page.locator('[data-node-key="products"]')).toHaveAttribute('aria-expanded', 'true');
  await filter.fill('');
  await expect(page.locator('[data-node-key="products"]')).toHaveAttribute('aria-expanded', 'false');

  await openStory(page, 'phase-12-treeview--dynamic-removal');
  await expect(page.locator('[data-node-key="mouse"]')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('toggle-mouse').click();
  await expect(page.locator('[data-node-key="mouse"]')).toHaveCount(0);
});

test('TreeView implements one roving tab stop, physical arrows in RTL, activation keys, and keyboard context menus', async ({ page }) => {
  await openStory(page, 'phase-12-treeview--multiple-checking');
  const root = page.locator('[data-node-key="products"]');
  await root.focus();
  await root.press('ArrowDown');
  const hardware = page.locator('[data-node-key="hardware"]');
  await expect(hardware).toBeFocused();
  await hardware.press('End');
  await expect(page.locator('[data-node-key="services"]')).toBeFocused();
  await page.locator('[data-node-key="services"]').press('ArrowDown');
  await expect(root).toBeFocused();
  await root.press('ArrowRight');
  await expect(hardware).toBeFocused();
  await hardware.press('Enter');
  await expect(hardware).toHaveAttribute('aria-selected', 'true');
  await hardware.press(' ');
  await expect(hardware).toHaveAttribute('aria-checked', 'true');
  await hardware.press('ArrowLeft');
  await expect(hardware).toHaveAttribute('aria-expanded', 'false');
  await hardware.press('Home');
  await expect(root).toBeFocused();
  await expect(page.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1);

  await openStory(page, 'phase-12-treeview--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const rtlRoot = page.locator('[data-node-key="sales-ar"]');
  await rtlRoot.focus();
  await rtlRoot.press('ArrowLeft');
  await expect(rtlRoot).toHaveAttribute('aria-expanded', 'false');
  await rtlRoot.press('ArrowRight');
  await expect(rtlRoot).toHaveAttribute('aria-expanded', 'true');

  await openStory(page, 'phase-12-treeview--context-menus');
  const contextRoot = page.locator('[data-node-key="products"]');
  await contextRoot.focus();
  await contextRoot.press('Shift+F10');
  await expect(page.getByRole('menuitem', { name: 'Collapse' })).toBeVisible();
  await page.keyboard.press('Escape');
  await contextRoot.focus();
  await contextRoot.dispatchEvent('keydown', { key: 'ContextMenu', code: 'ContextMenu', bubbles: true });
  await expect(page.getByRole('menuitem', { name: 'Open' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Open' }).click();
  await expect(contextRoot).toHaveAttribute('aria-selected', 'true');
});

test('FormLayout uses exact container boundaries and adapts in Popup and Window', async ({ page }) => {
  await openStory(page, 'phase-11-formlayout--exact-container-boundaries');
  const layout = page.getByTestId('boundary-layout'); const item = page.getByTestId('boundary-item');
  for (const [width, span] of [[575, 12], [576, 11], [767, 11], [768, 9], [991, 9], [992, 7], [1199, 7], [1200, 5], [1399, 5], [1400, 3]] as const) {
    await layout.evaluate((element, value) => { element.style.inlineSize = `${value}px`; }, width);
    await expect.poll(() => item.evaluate((element) => getComputedStyle(element).gridColumnStart)).toBe(`span ${span}`);
  }
  await layout.evaluate((element) => { element.style.inlineSize = '559px'; });
  const inner = item.locator(':scope > div').first(); const narrowColumns = await inner.evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  await layout.evaluate((element) => { element.style.inlineSize = '560px'; });
  await expect.poll(() => inner.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).not.toBe(narrowColumns);

  await openStory(page, 'phase-11-formlayout--popup-container'); await expect(page.getByRole('dialog', { name: 'Narrow form' })).toBeVisible(); await expect(page.getByRole('textbox', { name: 'Customer' })).toBeVisible();
  await openStory(page, 'phase-11-formlayout--window-container'); await expect(page.getByRole('dialog', { name: 'Modeless form' })).toBeVisible(); await expect(page.getByRole('textbox', { name: 'Customer' })).toBeVisible();
});

test('Phase 13 Grid supports accessible sorting, selection, grouping, personalization, CRUD, and context commands', async ({ page }) => {
  const browserProblems: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });
  page.on('pageerror', (error) => browserProblems.push(error.message));
  await openStory(page, 'phase-13-grid--basic-local');
  const grid = page.getByRole('grid', { name: 'Invoice grid' });
  await expect(grid).toHaveAttribute('aria-rowcount', '37');
  await expect(grid).toHaveAttribute('aria-colcount', '7');
  const amountHeader = page.getByRole('columnheader', { name: /Amount/u });
  await amountHeader.getByRole('button').click();
  await expect(amountHeader).toHaveAttribute('aria-sort', 'ascending');

  await openStory(page, 'phase-13-grid--selection');
  const selectAll = page.getByRole('checkbox', { name: 'Select all visible rows' });
  await selectAll.click();
  await expect(selectAll).toBeChecked();
  await expect(page.getByRole('row', { selected: true })).toHaveCount(36);
  const firstCell = page.getByRole('gridcell').first();
  await firstCell.focus();
  await firstCell.press('ArrowRight');
  await expect(page.locator('[role="gridcell"][data-column-id="id"][tabindex="0"]')).toBeFocused();

  await openStory(page, 'phase-13-grid--local-grouping');
  const firstGroup = page.locator('tbody tr[aria-expanded]').first();
  await firstGroup.getByRole('button').click();
  await expect(firstGroup).toHaveAttribute('aria-expanded', 'false');

  await openStory(page, 'phase-13-grid--column-personalization');
  await page.getByRole('button', { name: 'Columns' }).click();
  const chooser = page.getByRole('dialog', { name: 'Columns' });
  await expect(chooser.getByRole('button', { name: 'Show all' })).toBeVisible();
  await chooser.getByRole('button', { name: 'Hide all' }).click();
  await expect(page.getByRole('columnheader', { name: /Invoice/u })).toBeVisible();
  const separator = page.getByRole('separator', { name: 'Resize Invoice' });
  await separator.focus();
  await separator.press('ArrowRight');

  await openStory(page, 'phase-13-grid--popup-crud');
  await page.getByRole('button', { name: 'Edit' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Edit row' });
  await dialog.getByRole('textbox', { name: /Customer/u }).fill('Updated Customer');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('grid')).toContainText('Updated Customer');

  await openStory(page, 'phase-13-grid--context-menus');
  await page.getByRole('columnheader', { name: /Customer/u }).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Sort ascending' })).toBeVisible();

  await openStory(page, 'phase-13-grid--remote-grouping');
  const remoteGroup = page.locator('tbody tr[aria-expanded]').first();
  await remoteGroup.getByRole('button').click();
  await expect(page.getByRole('grid')).toContainText('Acme Trading');

  await openStory(page, 'phase-13-grid--empty-state');
  await expect(page.getByText('No records found')).toBeVisible();
  await openStory(page, 'phase-13-grid--loading-state');
  await expect(page.getByText('Loading…')).toBeVisible();
  await openStory(page, 'phase-13-grid--error-state');
  await expect(page.getByRole('alert')).toContainText('Unable to load records');
  await openStory(page, 'phase-13-grid--arabic-rtl-narrow', 'theme:light;density:comfortable;direction:rtl');
  await expect(page.locator('[dir="rtl"]').first()).toBeVisible();
  expect(browserProblems).toEqual([]);
});

test('Phase 14 LookUpGrid covers lookup interaction, ERP context, accessibility, and dismissal', async ({ page, browserName }) => {
  test.slow();
  const browserProblems: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });
  page.on('pageerror', (error) => browserProblems.push(error.message));

  await openStory(page, 'phase-14-lookupgrid--local-item-lookup');
  let input = page.getByRole('combobox', { name: 'Local item' });
  await expect(page.getByRole('grid')).toBeVisible();
  await input.fill('Drive Shaft 2');
  await expect(page.getByRole('row').filter({ hasText: 'ITM-0002' })).toBeVisible();
  await page.getByRole('row').filter({ hasText: 'ITM-0002' }).click();
  await expect(input).toHaveValue(/ITM-0002/u);
  await expect(input).toHaveAttribute('aria-expanded', 'false');

  await openStory(page, 'phase-14-lookupgrid--server-customer-lookup');
  input = page.getByRole('combobox', { name: 'Server customer' });
  await input.fill('Precision');
  await input.fill('Hydraulic');
  await expect(page.getByRole('row').filter({ hasText: 'Hydraulic' }).first()).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Precision' })).toHaveCount(0);

  await openStory(page, 'phase-14-lookupgrid--existing-key-resolved-asynchronously');
  await expect(page.getByRole('combobox', { name: 'Resolved item' })).toHaveValue(/ITM-0078/u);
  await expect(page.getByRole('combobox', { name: 'Resolved item' })).toHaveAttribute('aria-expanded', 'false');

  await openStory(page, 'phase-14-lookupgrid--column-filter-row');
  input = page.getByRole('combobox', { name: 'Filtered item' });
  await input.press('Tab');
  const firstFilter = page.getByRole('textbox', { name: 'Filter code' });
  await expect(firstFilter).toBeFocused();
  await firstFilter.fill('ITM-0003');
  await expect(page.getByRole('row').filter({ hasText: 'ITM-0003' })).toBeVisible();
  await firstFilter.press('Escape');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-expanded', 'false');

  await openStory(page, 'phase-14-lookupgrid--append-paging');
  await expect(page.locator('[role="rowgroup"] > [role="row"]')).toHaveCount(8);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.locator('[role="rowgroup"] > [role="row"]')).toHaveCount(16);

  await openStory(page, 'phase-14-lookupgrid--sorting');
  const codeHeader = page.getByRole('columnheader', { name: 'Item' });
  await codeHeader.getByRole('button').click();
  await expect(codeHeader).toHaveAttribute('aria-sort', 'ascending');
  input = page.getByRole('combobox', { name: 'Sorted item' });
  await input.press('Control+ArrowDown');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-expanded', 'true');

  await openStory(page, 'phase-14-lookupgrid--disabled-ledger-rows');
  input = page.getByRole('combobox', { name: 'Ledger account' });
  const disabledRow = page.locator('[role="row"][aria-disabled="true"]').first();
  await disabledRow.click({ force: true });
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  await input.press('Home');
  await expect(input).not.toHaveAttribute('aria-activedescendant', await disabledRow.getAttribute('id') ?? '');

  await openStory(page, 'phase-14-lookupgrid--validation-and-required-field');
  input = page.getByRole('combobox', { name: 'Required product' });
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(input).toBeFocused();

  await openStory(page, 'phase-14-lookupgrid--view-all-integration');
  await page.getByRole('button', { name: 'View all' }).click();
  await expect(page.getByRole('dialog', { name: 'Advanced item search' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Item with advanced search' })).toHaveAttribute('aria-expanded', 'false');

  await openStory(page, 'phase-14-lookupgrid--multiple-instances');
  const first = page.getByRole('combobox', { name: 'First item' });
  const second = page.getByRole('combobox', { name: 'Second item' });
  await first.click();
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  await second.click();
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await expect(second).toHaveAttribute('aria-expanded', 'true');
  await second.press('Escape');
  await expect(second).toHaveAttribute('aria-expanded', 'false');

  await openStory(page, 'phase-14-lookupgrid--narrow-viewport-and-flyout-flip');
  await expect(page.locator('[data-cg-flyout-placed="top"]')).toBeVisible();
  await expect(page.getByRole('grid')).toBeVisible();

  await openStory(page, 'phase-14-lookupgrid--arabic-rtl-lookup', 'theme:light;density:comfortable;direction:rtl');
  await expect(page.locator('[dir="rtl"]').first()).toBeVisible();
  input = page.getByRole('combobox', { name: 'الصنف' });
  await input.fill('احمد');
  await expect(page.getByRole('row').filter({ hasText: 'أَحْمَد' })).toBeVisible();

  if (browserName === 'chromium') {
    await page.emulateMedia({ forcedColors: 'active' });
    await openStory(page, 'phase-14-lookupgrid--templates-and-custom-footer');
    const selectedRow = page.locator('[role="row"][aria-selected="true"]').first();
    await expect(selectedRow).toBeVisible();
    await expect(selectedRow).toHaveCSS('forced-color-adjust', 'none');
    await page.emulateMedia({ forcedColors: 'none' });
  }

  expect(browserProblems).toEqual([]);
});

test('Phase 16 date and feedback families support semantic interaction and focus contracts', async ({ page }) => {
  const browserProblems: string[] = [];
  page.on('pageerror', (error) => browserProblems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });

  await openStory(page, 'phase-16-calendar--single-and-range');
  const singleCalendar = page.getByRole('grid').first();
  const selectedDay = singleCalendar.getByRole('button', { name: /August 21, 2026/u });
  await selectedDay.focus();
  await selectedDay.press('ArrowRight');
  await expect(singleCalendar.locator('[data-date="2026-08-22"]')).toBeFocused();

  await openStory(page, 'phase-16-daterangepicker--explicit-with-presets');
  const editor = page.getByRole('combobox', { name: 'Posting period' });
  await expect(editor).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Prior month' }).click();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(editor).toHaveAttribute('aria-expanded', 'false');

  await openStory(page, 'phase-16-toast--positions-actions-and-limits');
  await page.getByRole('button', { name: 'Error toast' }).click();
  await expect(page.getByRole('alert')).toContainText('Posting failed.');
  await page.getByRole('button', { name: 'Dismiss notification' }).click();

  await openStory(page, 'phase-16-confirmation--variants-and-queueing');
  const trigger = page.getByRole('button', { name: 'Destructive confirmation' });
  await trigger.click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete vendor?' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  expect(browserProblems).toEqual([]);
});

test('Phase 17 FileUploader supports real files, retries, native forms, and resumable endpoint recovery', async ({ page }) => {
  test.slow();
  const browserProblems: string[] = [];
  page.on('pageerror', (error) => browserProblems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });
  const selectFile = async (name: string, content: string, lastModified = 1_777_000_000_000) => {
    await page.locator('input[type="file"]').evaluate((element, payload) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([payload.content], payload.name, { type: payload.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain', lastModified: payload.lastModified }));
      Object.defineProperty(element, 'files', { configurable: true, value: transfer.files });
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, { name, content, lastModified });
  };

  await openStory(page, 'phase-17-fileuploader--basic-automatic');
  await selectFile('invoice.pdf', 'invoice');
  await expect(page.getByText('Uploaded', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove invoice.pdf' }).click();
  await expect(page.getByText('invoice.pdf')).toHaveCount(0);
  await selectFile('invoice.pdf', 'invoice');
  await expect(page.getByText('Uploaded', { exact: true })).toBeVisible();

  await openStory(page, 'phase-17-fileuploader--manual-upload');
  await selectFile('evidence.pdf', 'evidence');
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(page.getByText('Uploaded', { exact: true })).toHaveCount(2);

  await openStory(page, 'phase-17-fileuploader--failed-retry');
  await selectFile('retry.pdf', 'retry');
  await expect(page.getByRole('alert')).toContainText('Virus scanner');
  await page.getByRole('button', { name: 'Retry retry.pdf' }).click();
  await expect(page.getByText('Uploaded', { exact: true })).toBeVisible();

  await openStory(page, 'phase-17-fileuploader--native-form');
  await page.getByRole('button', { name: 'Submit attachments' }).click();
  await expect(page.getByLabel('Submitted attachment IDs')).toHaveText('invoice-2026');
  await page.getByRole('button', { name: 'Remove invoice-2026.pdf' }).click();
  await page.getByRole('button', { name: 'Submit attachments' }).click();
  await expect(page.locator('input[type="file"]')).toBeFocused();
  await page.getByRole('button', { name: 'Reset attachments' }).click();
  await expect(page.getByText('invoice-2026.pdf')).toBeVisible();

  await openStory(page, 'phase-17-fileuploader--paused-recovery');
  await expect(page.getByText('Select the same file to resume', { exact: true })).toBeVisible();
  await expect.poll(async () => (await page.locator('input[type="file"]').boundingBox())?.height ?? 0).toBeGreaterThan(100);
  const recoveredDropZone = await page.locator('input[type="file"]').locator('..').boundingBox();
  const recoveredRow = await page.locator('[data-status="awaiting-reselection"]').boundingBox();
  expect(recoveredDropZone && recoveredRow && recoveredRow.y >= recoveredDropZone.y + recoveredDropZone.height).toBe(true);

  const upload = { id: 'browser-upload-1', token: 'browser-private-token', chunkSize: 4, received: new Set<number>() };
  let firstChunk = true;
  let releaseFirstChunk: (() => void) | undefined;
  const requestHeaders: Array<Record<string, string>> = [];
  await page.route('**/_cg-story-upload/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requestHeaders.push(request.headers());
    if (url.pathname.endsWith('/antiforgery')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ headerName: 'X-Story-CSRF', requestToken: 'story-csrf' }) }); return;
    }
    if (request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ state: 'uploading', chunkSize: upload.chunkSize, receivedChunks: [...upload.received] }) }); return;
    }
    if (request.method() === 'PUT') {
      const chunk = Number(url.pathname.split('/').at(-1));
      if (firstChunk) {
        firstChunk = false;
        await new Promise<void>((resolve) => { releaseFirstChunk = resolve; });
      }
      upload.received.add(chunk);
      try { await route.fulfill({ status: 204 }); } catch { /* The first XHR is deliberately aborted by Pause. */ }
      return;
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/complete')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ storedFile: { id: 'endpoint-stored-1', location: '/files/endpoint-stored-1', name: 'resume.txt', size: 10, contentType: 'text/plain', metadata: {} } }) }); return;
    }
    if (request.method() === 'DELETE') { await route.fulfill({ status: 204 }); return; }
    await route.fallback();
  });
  await page.route('**/_cg-story-upload', async (route) => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    requestHeaders.push(route.request().headers());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ state: 'uploading', uploadId: upload.id, sessionToken: upload.token, chunkSize: upload.chunkSize, receivedChunks: [] }) });
  });

  await openStory(page, 'phase-17-fileuploader--endpoint-resumable');
  await selectFile('resume.txt', '0123456789');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
  releaseFirstChunk?.();
  await openStory(page, 'phase-17-fileuploader--endpoint-resumable');
  await expect(page.getByText('Select the same file to resume')).toBeVisible();
  await selectFile('resume.txt', '0123456789');
  await expect(page.getByText('Uploaded', { exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(upload.token);
  await page.getByRole('button', { name: 'Remove resume.txt' }).click();
  await expect(page.getByText('resume.txt')).toHaveCount(0);
  expect(requestHeaders.some((headers) => headers['x-cg-upload-token'] === upload.token)).toBe(true);
  expect(requestHeaders.some((headers) => headers['x-story-csrf'] === 'story-csrf')).toBe(true);
  expect(browserProblems).toEqual([]);
});

test('Phase 18 Splitter preserves pair totals for pointer, deferred, keyboard, collapse, and RTL input', async ({ page }) => {
  const browserProblems: string[] = [];
  page.on('pageerror', (error) => browserProblems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });

  await openStory(page, 'phase-18-splitter--horizontal-live');
  let panes = page.locator('[data-cg-splitter-pane]');
  let separator = page.getByRole('separator').first();
  const beforeStart = await panes.nth(0).boundingBox();
  const beforeEnd = await panes.nth(1).boundingBox();
  const separatorBox = await separator.boundingBox();
  expect(beforeStart && beforeEnd && separatorBox).toBeTruthy();
  await page.mouse.move(separatorBox!.x + separatorBox!.width / 2, separatorBox!.y + separatorBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(separatorBox!.x + 42, separatorBox!.y + separatorBox!.height / 2);
  await page.mouse.up();
  const afterStart = await panes.nth(0).boundingBox();
  const afterEnd = await panes.nth(1).boundingBox();
  expect(afterStart!.width).toBeGreaterThan(beforeStart!.width + 25);
  expect(Math.abs((afterStart!.width + afterEnd!.width) - (beforeStart!.width + beforeEnd!.width))).toBeLessThan(1.5);
  await expect(separator).toHaveAttribute('aria-valuenow', /\d+/u);
  await expect(panes.nth(0)).toHaveAttribute('style', /px/u);

  await openStory(page, 'phase-18-splitter--vertical-deferred');
  panes = page.locator('[data-cg-splitter-pane]');
  separator = page.getByRole('separator');
  const beforeHeight = (await panes.first().boundingBox())!.height;
  const verticalBox = await separator.boundingBox();
  await page.mouse.move(verticalBox!.x + verticalBox!.width / 2, verticalBox!.y + verticalBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(verticalBox!.x + verticalBox!.width / 2, verticalBox!.y + verticalBox!.height / 2 - 35);
  await expect(page.locator('[data-cg-splitter-preview]')).toHaveAttribute('data-cg-visible', '');
  expect((await panes.first().boundingBox())!.height).toBeCloseTo(beforeHeight, 0);
  await page.mouse.up();
  expect((await panes.first().boundingBox())!.height).toBeLessThan(beforeHeight - 20);

  await openStory(page, 'phase-18-splitter--horizontal-live');
  separator = page.getByRole('separator').first();
  panes = page.locator('[data-cg-splitter-pane]');
  const keyboardBefore = (await panes.first().boundingBox())!.width;
  await separator.press('Shift+ArrowRight');
  expect((await panes.first().boundingBox())!.width).toBeGreaterThan(keyboardBefore + 80);
  await separator.press('Enter');
  await expect(panes.first()).toHaveAttribute('data-cg-collapsed', 'true');
  expect((await panes.first().boundingBox())!.width).toBeCloseTo(40, 0);

  await page.setViewportSize({ width: 390, height: 680 });
  await openStory(page, 'phase-18-splitter--arabic-rtl-narrow', 'theme:light;density:comfortable;direction:rtl');
  separator = page.getByRole('separator');
  panes = page.locator('[data-cg-splitter-pane]');
  const rtlBefore = (await panes.first().boundingBox())!.width;
  await separator.press('ArrowRight');
  expect((await panes.first().boundingBox())!.width).toBeLessThan(rtlBefore);

  await page.setViewportSize({ width: 1280, height: 720 });
  await openStory(page, 'phase-18-splitter--nested-splitters');
  const roots = page.locator('[data-cg-splitter]');
  await expect(roots).toHaveCount(2);
  const outerNavigation = roots.first().locator('[data-cg-splitter-pane="navigation"]');
  const outerBefore = (await outerNavigation.boundingBox())!.width;
  await roots.nth(1).getByRole('separator').press('ArrowUp');
  expect((await outerNavigation.boundingBox())!.width).toBeCloseTo(outerBefore, 0);
  await expect(roots.nth(1).locator('[data-cg-splitter-pane="editor"]')).toHaveAttribute('style', /px/u);
  expect(browserProblems).toEqual([]);
});

test('Phase 18 Drawer retains DOM state and changes responsive presentation without changing open intent', async ({ page }) => {
  const browserProblems: string[] = [];
  page.on('pageerror', (error) => browserProblems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });

  await openStory(page, 'phase-18-drawer--retained-mini');
  const drawerInput = page.getByLabel('Quick filter');
  await drawerInput.evaluate((element) => {
    (window as Window & { phase18DrawerInput?: Element }).phase18DrawerInput = element;
    (element as HTMLInputElement).value = 'persisted';
  });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('[data-cg-drawer]')).toHaveAttribute('data-cg-open', 'true');
  expect(await drawerInput.evaluate((element) => element === (window as Window & { phase18DrawerInput?: Element }).phase18DrawerInput)).toBe(true);
  await expect(drawerInput).toHaveValue('persisted');
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await expect(page.locator('[data-cg-drawer]')).toHaveAttribute('data-cg-mini', 'true');
  expect(await drawerInput.evaluate((element) => element === (window as Window & { phase18DrawerInput?: Element }).phase18DrawerInput)).toBe(true);

  await page.setViewportSize({ width: 500, height: 700 });
  await openStory(page, 'phase-18-drawer--responsive-narrow');
  const root = page.locator('[data-cg-drawer]');
  await expect(root).toHaveAttribute('data-cg-mode', 'overlay');
  await expect(root).toHaveAttribute('data-cg-open', 'true');
  await expect(page.getByRole('dialog', { name: 'Drawer' })).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('[data-cg-drawer-content]')).toHaveAttribute('inert', '');
  await page.setViewportSize({ width: 900, height: 700 });
  await expect(root).toHaveAttribute('data-cg-mode', 'shrink');
  await expect(root).toHaveAttribute('data-cg-open', 'true');
  await expect(page.getByRole('complementary', { name: 'Drawer' })).not.toHaveAttribute('aria-modal');
  expect(browserProblems).toEqual([]);
});

test('Phase 18 Drawer arbitrates nested and multiple overlays, focus return, scroll locks, and disposal', async ({ page, browserName }) => {
  const browserProblems: string[] = [];
  page.on('pageerror', (error) => browserProblems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });

  await openStory(page, 'phase-18-drawer--nested-overlay-ownership');
  await expect(page.getByRole('dialog', { name: 'Owned approval' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Owned approval' })).toBeHidden();
  await expect(page.locator('[data-cg-drawer]')).toHaveAttribute('data-cg-open', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-cg-drawer]')).toHaveAttribute('data-cg-open', 'false');

  await openStory(page, 'phase-18-drawer--multiple-overlay-drawers');
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(page.locator('#secondary-drawer')).toHaveAttribute('data-cg-open', 'false');
  await expect(page.locator('#primary-drawer')).toHaveAttribute('data-cg-open', 'true');
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(page.locator('#primary-drawer')).toHaveAttribute('data-cg-open', 'false');
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');

  await openStory(page, 'phase-18-drawer--controlled-lifecycle');
  const opener = page.getByRole('button', { name: 'Async toggle' });
  await opener.click();
  await expect(page.locator('[data-cg-drawer]')).toHaveAttribute('data-cg-open', 'true');
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-cg-drawer]')).toHaveAttribute('data-cg-open', 'false');
  await expect(opener).toBeFocused();

  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await openStory(page, 'phase-18-drawer--overlay-open');
  await expect(page.locator('[data-cg-drawer-panel]')).toHaveCSS('transition-duration', '0s');
  if (browserName === 'chromium') await expect(page.locator('[data-cg-drawer-panel]')).toHaveCSS('forced-color-adjust', 'none');
  await openStory(page, 'phase-18-drawer--shrink-start');
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
  expect(browserProblems).toEqual([]);
});

test('Phase 19 RangeSelector supports exact pointer, range, track, keyboard, RTL, and cancellation behavior', async ({ page }) => {
  const browserProblems: string[] = [];
  page.on('pageerror', (error) => browserProblems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });
  await openStory(page, 'phase-19-rangeselector--number-range');
  const start = page.getByRole('slider', { name: 'Start value' });
  const end = page.getByRole('slider', { name: 'End value' });
  await expect(start).toHaveAttribute('aria-valuemin', '0'); await expect(start).toHaveAttribute('aria-valuenow', '18'); await expect(end).toHaveAttribute('aria-valuemax', '100');
  const startBox = await start.boundingBox(); expect(startBox).toBeTruthy();
  await page.mouse.move(startBox!.x + startBox!.width / 2, startBox!.y + startBox!.height / 2); await page.mouse.down(); await page.mouse.move(startBox!.x + 120, startBox!.y + startBox!.height / 2); await page.mouse.up();
  expect(Number(await start.getAttribute('aria-valuenow'))).toBeGreaterThan(25);

  await openStory(page, 'phase-19-rangeselector--range-dragging');
  const selection = page.locator('[data-cg-range-selection]'); const selectionBox = await selection.boundingBox();
  const rangeStart = page.getByRole('slider', { name: 'Start value' }); const beforeStart = Number(await rangeStart.getAttribute('aria-valuenow'));
  await page.mouse.move(selectionBox!.x + selectionBox!.width / 2, selectionBox!.y + selectionBox!.height / 2); await page.mouse.down(); await page.mouse.move(selectionBox!.x + selectionBox!.width / 2 + 90, selectionBox!.y + selectionBox!.height / 2); await page.mouse.up();
  expect(Number(await rangeStart.getAttribute('aria-valuenow'))).toBeGreaterThan(beforeStart);
  const trackBox = await page.locator('[data-cg-range-track]').boundingBox(); await page.mouse.click(trackBox!.x + 25, trackBox!.y + trackBox!.height / 2);
  expect(Number(await rangeStart.getAttribute('aria-valuenow'))).toBeLessThan(20);

  await openStory(page, 'phase-19-rangeselector--span-constraints');
  const constrained = page.getByRole('slider', { name: 'Start value' });
  await constrained.press('End'); await expect(constrained).toHaveAttribute('aria-valuenow', '35'); await constrained.press('Home'); await expect(constrained).toHaveAttribute('aria-valuenow', '10'); await constrained.press('PageUp'); await expect(constrained).toHaveAttribute('aria-valuenow', '35');

  await openStory(page, 'phase-19-rangeselector--controlled-value-rejection');
  const authoritative = page.getByRole('slider', { name: 'Start value' }); await expect(authoritative).toHaveAttribute('aria-valuenow', '22.5'); await authoritative.press('ArrowUp');
  await expect(page.getByLabel('Attempted range')).toContainText('30'); await expect(authoritative).toHaveAttribute('aria-valuenow', '22.5');
  const authoritativeBox = await authoritative.boundingBox(); await page.mouse.move(authoritativeBox!.x + authoritativeBox!.width / 2, authoritativeBox!.y); await page.mouse.down(); await page.mouse.move(authoritativeBox!.x + 80, authoritativeBox!.y); await page.setViewportSize({ width: 1100, height: 700 }); await page.mouse.up();
  await expect(authoritative).toHaveAttribute('aria-valuenow', '22.5');

  await page.setViewportSize({ width: 1280, height: 720 }); await openStory(page, 'phase-19-rangeselector--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const rtlStart = page.getByRole('slider', { name: 'بداية النطاق' }); await expect(rtlStart).toHaveAttribute('aria-valuenow', '15'); await rtlStart.press('ArrowRight'); await expect(rtlStart).toHaveAttribute('aria-valuenow', '14'); await rtlStart.press('ArrowUp'); await expect(rtlStart).toHaveAttribute('aria-valuenow', '15');
  expect(browserProblems).toEqual([]);
});

test('Phase 19 Tooltip coordinates timing, interactive boundaries, overlay dismissal, placement, and ARIA ownership', async ({ page }) => {
  const browserProblems: string[] = [];
  page.on('pageerror', (error) => browserProblems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });
  await openStory(page, 'phase-19-tooltip--hover-focus');
  const hoverTarget = page.getByRole('button', { name: 'Account help' }); await hoverTarget.hover(); await expect(page.getByRole('tooltip')).toBeVisible();
  const tooltipId = await page.getByRole('tooltip').getAttribute('id'); await expect(hoverTarget).toHaveAttribute('aria-describedby', new RegExp(tooltipId!));
  await page.mouse.move(10, 10); await expect(page.getByRole('tooltip')).toBeHidden(); await expect(hoverTarget).not.toHaveAttribute('aria-describedby'); await hoverTarget.focus(); await expect(page.getByRole('tooltip')).toBeVisible();

  await openStory(page, 'phase-19-tooltip--interactive-content'); await page.getByRole('button', { name: 'Invoice status' }).click();
  const inside = page.getByRole('link', { name: 'Open invoice' }); await expect(inside).toBeVisible(); await inside.focus(); await expect(inside).toBeFocused(); await page.keyboard.press('Escape'); await expect(inside).toBeHidden();

  await openStory(page, 'phase-19-tooltip--click'); await page.getByRole('button', { name: 'Click for details' }).click(); await expect(page.getByRole('tooltip')).toBeVisible(); await page.mouse.click(1000, 500); await expect(page.getByRole('tooltip')).toBeHidden();
  await openStory(page, 'phase-19-tooltip--edge-flip-and-shift');
  for (const surface of await page.getByRole('tooltip').all()) { const box = await surface.boundingBox(); expect(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1280 && box.y + box.height <= 720).toBe(true); }
  await openStory(page, 'phase-19-tooltip--arabic-rtl', 'theme:light;density:comfortable;direction:rtl'); await expect(page.getByRole('tooltip')).toHaveAttribute('data-side', 'left');
  expect(browserProblems).toEqual([]);
});

test('Phase 19 StatusBadge dismisses once and remains legible across forced colors, dark RTL, and reduced motion', async ({ page, browserName }) => {
  await openStory(page, 'phase-19-statusbadge--dismissible-and-async');
  const dismiss = page.getByRole('button', { name: 'Dismiss status' }); await dismiss.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByText('Needs review')).toBeHidden(); await expect(page.getByText('Dismissed once')).toBeVisible(); await page.getByRole('button', { name: 'Re-arm badge' }).click(); await expect(page.getByText('Needs review')).toBeVisible();
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' }); await openStory(page, 'phase-19-statusbadge--forced-colors');
  if (browserName === 'chromium') await expect(page.locator('[data-cg-status-badge]').first()).toHaveCSS('border-top-color', 'rgb(0, 0, 0)');
  await openStory(page, 'phase-19-tooltip--reduced-motion'); await expect(page.getByRole('tooltip')).toHaveCSS('transition-duration', '0s');
  await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' }); await openStory(page, 'phase-19-statusbadge--arabic-rtl', 'theme:dark;density:compact;direction:rtl'); await expect(page.locator('[data-cg-status-badge]')).toHaveCount(2);
});

test('Phase 20 Chart coordinates delegated tooltips, keyboard navigation, selection, and controlled legends', async ({ page }) => {
  const browserProblems: string[] = [];
  page.on('pageerror', (error) => browserProblems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });

  await openStory(page, 'phase-20-chart--cartesian-mixed');
  const points = page.locator('[data-cg-chart-point]');
  await expect(points).toHaveCount(17);
  await points.first().hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Revenue');
  await expect(tooltip).toContainText('January');
  await points.first().focus();
  await points.first().press('ArrowRight');
  await expect(points.nth(1)).toBeFocused();
  await points.nth(1).press('ArrowDown');
  await expect(page.locator('[data-cg-chart-point][data-cg-series-name="Expense"][data-cg-point-index="1"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();

  await openStory(page, 'phase-20-chart--controlled-selection');
  const selectable = page.locator('[data-cg-chart-point]');
  await selectable.first().click();
  await expect(page.getByLabel('Accepted chart selection')).toContainText('Revenue[0]');
  await selectable.nth(1).click({ modifiers: ['Control'] });
  await expect(page.getByLabel('Accepted chart selection')).toContainText('Revenue[0], Revenue[1]');
  await expect(page.locator('[data-cg-selected="true"]')).toHaveCount(2);

  await openStory(page, 'phase-20-chart--controlled-legend-visibility');
  const expense = page.getByRole('button', { name: 'Expense' });
  await expect(expense).toHaveAttribute('aria-pressed', 'false');
  await expense.click();
  await expect(expense).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-cg-chart-series="Expense"]')).toBeVisible();

  await openStory(page, 'phase-20-chart--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const rtlPoints = page.locator('[data-cg-chart-point]');
  await expect(page.getByRole('button', { name: 'الإيرادات' })).toBeVisible();
  await rtlPoints.first().focus();
  await rtlPoints.first().press('ArrowLeft');
  await expect(rtlPoints.nth(1)).toBeFocused();
  expect(browserProblems).toEqual([]);
});

test('Phase 20 Chart buckets responsive Splitter measurements and survives zoom and lifecycle disposal', async ({ page }) => {
  const browserProblems: string[] = [];
  page.on('pageerror', (error) => browserProblems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });

  await openStory(page, 'phase-20-chart--splitter-resize-host');
  const chart = page.locator('[data-cg-chart]');
  const initialWidth = Number(await chart.getAttribute('data-cg-chart-width'));
  expect(initialWidth % 16).toBe(0);
  const separator = page.getByRole('separator');
  const box = await separator.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + 96, box!.y + box!.height / 2);
  await page.mouse.up();
  await expect.poll(async () => Number(await chart.getAttribute('data-cg-chart-width'))).not.toBe(initialWidth);
  const resizedWidth = Number(await chart.getAttribute('data-cg-chart-width'));
  expect(resizedWidth % 16).toBe(0);
  await page.evaluate(() => { document.body.style.zoom = '125%'; });
  await expect.poll(async () => Number(await chart.getAttribute('data-cg-chart-width')) % 16).toBe(0);

  await openStory(page, 'phase-20-chart--actions-and-lifecycle');
  await page.getByRole('button', { name: 'Read SVG' }).click();
  await expect(page.getByLabel('Chart action result')).toContainText(/\d+ SVG characters/u);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export SVG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('quarterly chart.svg');
  await page.locator('[data-cg-chart-point]').first().hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.getByRole('button', { name: 'Unmount chart' }).click();
  await expect(page.getByText('Chart unmounted cleanly')).toBeVisible();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mount chart' }).click();
  await expect(page.locator('[data-cg-chart]')).toBeVisible();
  expect(browserProblems).toEqual([]);
});

test('Phase 20 Chart retains semantics in tables, dense data, reduced motion, and forced colors', async ({ page, browserName }) => {
  await openStory(page, 'phase-20-chart--static-image-accessibility');
  await expect(page.getByRole('img', { name: /Static accessible chart/u })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('rowheader')).toHaveCount(6);

  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await openStory(page, 'phase-20-chart--dense-reduced-motion');
  await expect(page.locator('[data-cg-chart-point]')).toHaveCount(180);
  await expect(page.locator('[data-cg-chart-canvas]')).toHaveCSS('animation-name', 'none');
  if (browserName === 'chromium') {
    await expect(page.locator('[data-cg-chart-series] path').first()).toHaveCSS('forced-color-adjust', 'auto');
  }
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious, serious.map((violation) => violation.id).join(', ')).toEqual([]);
});

test('Phase 21 TreeList implements treegrid focus, physical hierarchy arrows, selection, and recursive checks', async ({ page }) => {
  const browserProblems: string[] = [];
  page.on('pageerror', (error) => browserProblems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(message.text()); });

  await openStory(page, 'phase-21-treelist--flat-chart-of-accounts');
  const treegrid = page.getByRole('treegrid', { name: 'Chart of accounts' });
  await expect(treegrid).toHaveAttribute('aria-colcount', '5');
  const assetsRow = page.locator('[data-key="1000"]');
  await expect(assetsRow).toHaveAttribute('aria-level', '1');
  await expect(assetsRow).toHaveAttribute('aria-posinset', '1');
  await expect(assetsRow).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: /Collapse 1000/u }).click();
  await expect(page.getByText('Cash and cash equivalents')).toHaveCount(0);
  await expect(assetsRow).toHaveAttribute('aria-selected', 'false');
  const hierarchyCell = assetsRow.getByRole('gridcell').first();
  await hierarchyCell.focus();
  await hierarchyCell.press('ArrowRight');
  await expect(page.getByText('Cash and cash equivalents')).toBeVisible();
  await hierarchyCell.press('ArrowRight');
  await expect(page.locator('[data-key="1100"] [role="gridcell"]').first()).toBeFocused();

  await openStory(page, 'phase-21-treelist--multiple-selection');
  const operating = page.locator('[data-key="1110"]');
  const receivable = page.locator('[data-key="1200"]');
  await operating.click();
  await receivable.click({ modifiers: ['Control'] });
  await expect(operating).toHaveAttribute('aria-selected', 'true');
  await expect(receivable).toHaveAttribute('aria-selected', 'true');

  await openStory(page, 'phase-21-treelist--recursive-checks-disabled-unloaded');
  const assetsCheck = page.getByRole('checkbox', { name: /Check 1000/u });
  await expect(assetsCheck).toHaveAttribute('aria-checked', 'mixed');
  const lockedRow = page.locator('[data-key="2200"]');
  await expect(lockedRow.getByRole('checkbox')).toBeDisabled();

  await openStory(page, 'phase-21-treelist--arabic-rtl', 'theme:light;density:comfortable;direction:rtl');
  const rtlCell = page.locator('[data-key="1"] [role="gridcell"]').first();
  await rtlCell.focus();
  await rtlCell.press('ArrowLeft');
  await expect(page.locator('[data-key="1"]')).toHaveAttribute('aria-expanded', 'false');
  await rtlCell.press('ArrowRight');
  await expect(page.locator('[data-key="1"]')).toHaveAttribute('aria-expanded', 'true');
  expect(browserProblems).toEqual([]);
});

test('Phase 21 TreeList contains lazy failures, virtualizes fixed rows, and recovers popup conflicts', async ({ page }) => {
  await openStory(page, 'phase-21-treelist--lazy-children-load-more-retry');
  await page.getByRole('button', { name: /Expand 1000/u }).click();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Cash and cash equivalents')).toBeVisible();

  await openStory(page, 'phase-21-treelist--row-and-column-virtualization');
  const virtualTree = page.getByRole('treegrid', { name: 'Virtual cost centers' });
  await expect(virtualTree).toHaveAttribute('aria-rowcount', '220');
  expect(await page.locator('tr[data-row-token]').count()).toBeLessThan(40);
  expect(await page.locator('[data-column-id]').count()).toBeLessThan(220 * 15);

  await openStory(page, 'phase-21-treelist--popup-editing-conflict-recovery');
  await page.getByRole('button', { name: 'Edit operating account' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('alert')).toContainText('changed on the server');
  await dialog.getByRole('button', { name: 'Retry conflict' }).click();
  await expect(dialog).toHaveCount(0);
});

test('Phase 21 TreeList remains usable in forced colors, reduced motion, narrow width, and 400% zoom', async ({ page, browserName }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await page.setViewportSize({ width: 360, height: 720 });
  await openStory(page, 'phase-21-treelist--narrow-mobile-layout');
  await page.evaluate(() => { document.body.style.zoom = '400%'; });
  const scroller = page.locator('[data-cg-tree-list]').locator('div').filter({ has: page.getByRole('treegrid') }).first();
  await expect(page.getByRole('treegrid')).toBeVisible();
  expect(await scroller.evaluate((element) => element.scrollWidth >= element.clientWidth)).toBe(true);
  if (browserName === 'chromium') await expect(page.locator('[data-row-token]').first()).toHaveCSS('forced-color-adjust', 'auto');
  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious, serious.map((violation) => violation.id).join(', ')).toEqual([]);
});
