import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openStory } from './storybook';

const LIGHT = 'theme:light;density:comfortable;direction:ltr';
const DARK = 'theme:dark;density:comfortable;direction:ltr';
const RTL = 'theme:light;density:comfortable;direction:rtl';

function watchProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text()); });
  return problems;
}

const box = async (locator: Locator) => (await locator.boundingBox())!;
/** Opens from the keyboard, because Safari doesn't focus a clicked button, which leaves nothing to return focus to. */
async function openWithKeyboard(page: Page, button: Locator) {
  await button.focus();
  await page.keyboard.press('Enter');
}
const activeName = (page: Page) => page.evaluate(() => {
  const active = document.activeElement;
  return active?.getAttribute('aria-label') ?? active?.textContent?.trim() ?? '';
});

for (const [story, globals] of [
  ['phase-1-2-icon--spreadsheet', LIGHT],
  ['phase-1-2-icon--spreadsheet-dark', DARK],
  ['phase-1-2-icon--spreadsheet-rtl', RTL],
  ['phase-34-colorpicker--full-palette', LIGHT],
  ['phase-34-colorpicker--inside-split-button', LIGHT],
  ['phase-34-colorpicker--standard-only', LIGHT],
  ['phase-34-colorpicker--custom-shades', LIGHT],
  ['phase-34-colorpicker--disabled', LIGHT],
  ['phase-34-colorpicker--dark', DARK],
  ['phase-34-colorpicker--arabic-rtl', RTL],
  ['phase-34-gallery--table-styles', LIGHT],
  ['phase-34-gallery--open-on-arrival', LIGHT],
  ['phase-34-gallery--inline', LIGHT],
  ['phase-34-gallery--conditional-format-in-split-button', LIGHT],
  ['phase-34-gallery--text-swatches-and-scrolling', LIGHT],
  ['phase-34-gallery--disabled', LIGHT],
  ['phase-34-gallery--dark', DARK],
  ['phase-34-gallery--arabic-rtl', RTL],
  ['phase-34-borderpicker--all-presets', LIGHT],
  ['phase-34-borderpicker--inside-split-button', LIGHT],
  ['phase-34-borderpicker--some-presets-and-styles', LIGHT],
  ['phase-34-borderpicker--disabled', LIGHT],
  ['phase-34-borderpicker--dark', DARK],
  ['phase-34-borderpicker--arabic-rtl', RTL],
  ['phase-34-ribbon--spreadsheet', LIGHT],
  ['phase-34-ribbon--shrinking-by-group', LIGHT],
  ['phase-34-ribbon--narrow', LIGHT],
  ['phase-34-ribbon--very-narrow', LIGHT],
  ['phase-34-ribbon--collapsed', LIGHT],
  ['phase-34-ribbon--controlled-tabs-and-slots', LIGHT],
  ['phase-34-ribbon--dark', DARK],
  ['phase-34-ribbon--arabic-rtl', RTL],
  ['phase-34-ribbon--arabic-rtl-narrow', RTL],
  ['phase-10-toolbar--layouts', LIGHT],
  ['phase-11-tabs--header-content', LIGHT],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('#storybook-root svg, #storybook-root button').first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes[0]?.target.join(' ')})`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test.describe('CgIcon spreadsheet set', () => {
  test('draws every icon at its size in the text color, and colors only the bar', async ({ page }) => {
    await openStory(page, 'phase-1-2-icon--spreadsheet');
    const sheet = page.getByTestId('icon-sheet');
    const icon = sheet.getByRole('img', { name: 'freeze-panes' });
    await expect(icon).toHaveAttribute('viewBox', '0 0 20 20');
    expect((await box(icon)).width).toBe(24);
    const color = await icon.evaluate((element) => getComputedStyle(element).color);
    await expect(icon).toHaveCSS('fill', color);
    for (const name of ['border-inside-horizontal', 'border-inside-vertical', 'number-thousands', 'text-wrap', 'chart-pie', 'row-insert', 'column-delete', 'filter']) {
      const drawn = await sheet.getByRole('img', { name, exact: true }).evaluate((element) => (element.querySelector('path') as SVGPathElement).getBBox().width);
      expect(drawn, name).toBeGreaterThan(4);
    }
    const accent = page.getByRole('img', { name: 'Fill colour, yellow' }).locator('[data-cg-icon-accent]');
    await expect(accent).toHaveCSS('fill', 'rgb(255, 192, 0)');
    await expect(page.getByRole('img', { name: 'Font colour, none chosen' }).locator('[data-cg-icon-accent]')).toHaveCount(0);
  });
});

test.describe('CgColorPicker', () => {
  const output = (page: Page) => page.getByRole('status', { name: 'Chosen color' }).or(page.locator('output[aria-label="Chosen color"]'));

  test('joins each color and its shades into a strip, set apart from the base row', async ({ page }) => {
    await openStory(page, 'phase-34-colorpicker--full-palette');
    const picker = page.getByTestId('picker');
    const base = await box(picker.getByRole('gridcell', { name: 'Blue, Accent 1', exact: true }));
    const first = await box(picker.getByRole('gridcell', { name: 'Blue, Accent 1, lighter 80%' }));
    const second = await box(picker.getByRole('gridcell', { name: 'Blue, Accent 1, lighter 60%' }));
    expect(first.x).toBe(base.x);
    expect(first.y - (base.y + base.height)).toBeGreaterThan(0);
    expect(second.y - (first.y + first.height)).toBe(0);
    await expect(picker.getByRole('gridcell', { name: 'Blue, Accent 1, lighter 40%' })).toHaveAttribute('aria-selected', 'true');
    await expect(picker.getByRole('grid', { name: 'Recent colors' }).getByRole('gridcell')).toHaveCount(2);
  });

  test('chooses with a click, and keeps a theme color as a reference', async ({ page }) => {
    await openStory(page, 'phase-34-colorpicker--full-palette');
    const picker = page.getByTestId('picker');
    await picker.getByRole('gridcell', { name: 'Orange, Accent 2, darker 25%' }).click();
    await expect(output(page)).toContainText('"kind":"theme","key":"accent2","tint":-0.25,"color":"#c55a11"');
    await expect(picker.getByRole('grid', { name: 'Recent colors' }).getByRole('gridcell').first()).toHaveAttribute('data-color', '#c55a11');
    await picker.getByRole('button', { name: 'No color' }).click();
    await expect(output(page)).toContainText('"kind":"none"');
    await expect(picker.getByRole('button', { name: 'No color' })).toHaveAttribute('aria-pressed', 'true');
    await picker.getByRole('button', { name: 'Automatic' }).click();
    await expect(output(page)).toContainText('"kind":"automatic"');
  });

  test('takes a custom color from the browser control', async ({ page }) => {
    await openStory(page, 'phase-34-colorpicker--full-palette');
    const picker = page.getByTestId('picker');
    const input = picker.getByLabel('More colors…');
    await input.fill('#abcdef');
    // Windows WebKit has no color control, so its text field reports the change on blur.
    await input.blur();
    await expect(output(page)).toContainText('"kind":"rgb","color":"#abcdef"');
    await expect(picker.getByRole('grid', { name: 'Recent colors' }).getByRole('gridcell').first()).toHaveAttribute('data-color', '#abcdef');
  });

  test('has one tab stop across sections, moved by arrows and chosen with Enter', async ({ page }) => {
    await openStory(page, 'phase-34-colorpicker--full-palette');
    const picker = page.getByTestId('picker');
    await picker.getByRole('button', { name: 'Automatic' }).focus();
    await page.keyboard.press('Tab');
    await expect(picker.getByRole('gridcell', { name: 'Blue, Accent 1, lighter 40%' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(picker.getByRole('grid', { name: 'Theme colors' }).getByRole('gridcell', { name: 'Orange, Accent 2, lighter 40%' })).toBeFocused();
    for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
    await expect(picker.getByRole('gridcell', { name: 'Green', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(output(page)).toContainText('#00b050');
    await page.keyboard.press('Tab');
    await expect(picker.getByRole('button', { name: 'No color' })).toBeFocused();
    await expect(picker.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);
  });

  test('mirrors its columns and arrow keys in RTL', async ({ page }) => {
    await openStory(page, 'phase-34-colorpicker--arabic-rtl', RTL);
    const picker = page.getByTestId('picker');
    await expect(picker.getByRole('grid', { name: 'ألوان السمة' })).toBeVisible();
    const white = picker.getByRole('gridcell', { name: 'أبيض، الخلفية ١', exact: true });
    const black = picker.getByRole('gridcell', { name: 'أسود، النص ١', exact: true });
    expect((await box(white)).x).toBeGreaterThan((await box(black)).x);
    await white.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(black).toBeFocused();
  });

  test('remembers the last color in a split button: the main part reapplies it and the bar shows it', async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, 'phase-34-colorpicker--inside-split-button');
    const main = page.getByTestId('fill-button');
    const accent = main.locator('[data-cg-icon-accent]');
    const applied = page.getByTestId('applied');
    await expect(accent).toHaveCSS('fill', 'rgb(255, 255, 0)');
    await main.click();
    await expect(applied).toHaveText('#ffff00');

    const arrow = page.getByRole('button', { name: 'Choose fill color' });
    await openWithKeyboard(page, arrow);
    const dialog = page.getByRole('dialog', { name: 'Fill color' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('gridcell', { name: 'Yellow' })).toBeFocused();
    await dialog.getByRole('gridcell', { name: 'Blue, Accent 1, lighter 40%' }).click();
    await expect(dialog).toBeHidden();
    await expect(arrow).toBeFocused();
    await expect(accent).toHaveCSS('fill', 'rgb(143, 170, 220)');
    await expect(applied).toHaveText('#ffff00 #8faadc');

    await main.click();
    await expect(applied).toHaveText('#ffff00 #8faadc #8faadc');
    await openWithKeyboard(page, arrow);
    await expect(dialog.getByRole('gridcell', { name: 'Blue, Accent 1, lighter 40%' }).first()).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('grid', { name: 'Recent colors' }).getByRole('gridcell')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(arrow).toBeFocused();
    await expect(applied).toHaveText('#ffff00 #8faadc #8faadc');
    expect(problems).toEqual([]);
  });

  test('shows its whole palette without scrolling inside the flyout', async ({ page }) => {
    await openStory(page, 'phase-34-colorpicker--inside-split-button');
    await page.getByRole('button', { name: 'Choose fill color' }).click();
    const dialog = page.getByRole('dialog', { name: 'Fill color' });
    await expect(dialog).toBeVisible();
    const scrolling = await dialog.evaluate((element) => {
      const surface = element.closest('[data-cg-overlay-surface]')!;
      return [...surface.querySelectorAll('*'), surface].some((node) => node.scrollHeight > node.clientHeight + 1 && getComputedStyle(node).overflowY !== 'visible');
    });
    expect(scrolling).toBe(false);
  });
});

test.describe('CgGallery', () => {
  test('opens from its button, moves with arrows, chooses, and returns focus', async ({ page }) => {
    await openStory(page, 'phase-34-gallery--table-styles');
    const trigger = page.getByRole('button', { name: 'Format as table' });
    await openWithKeyboard(page, trigger);
    const dialog = page.getByRole('dialog', { name: 'Table styles' });
    await expect(dialog).toBeVisible();
    const selected = dialog.getByRole('gridcell', { name: 'medium blue' });
    await expect(selected).toHaveAttribute('aria-selected', 'true');
    await expect(selected).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('gridcell', { name: 'medium orange' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(dialog.getByRole('gridcell', { name: 'dark orange' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator('output[aria-label="Chosen style"]')).toHaveText('dark-orange');
  });

  test('closes on Escape and an outside click without choosing', async ({ page }) => {
    await openStory(page, 'phase-34-gallery--table-styles');
    const trigger = page.getByRole('button', { name: 'Format as table' });
    await openWithKeyboard(page, trigger);
    const dialog = page.getByRole('dialog', { name: 'Table styles' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(900, 600);
    await expect(dialog).toBeHidden();
    await expect(page.locator('output[aria-label="Chosen style"]')).toHaveText('medium-blue');
  });

  test('draws host swatches inside the flyout, in the library font, and lays out rows by column count', async ({ page }) => {
    await openStory(page, 'phase-34-gallery--open-on-arrival');
    const dialog = page.getByRole('dialog', { name: 'Table styles' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('grid', { name: 'Medium' }).getByRole('gridcell')).toHaveCount(5);
    const first = await box(dialog.getByRole('gridcell', { name: 'light blue' }));
    const fifth = await box(dialog.getByRole('gridcell', { name: 'light green' }));
    expect(first.y).toBe(fifth.y);
    const heading = dialog.getByText('Medium', { exact: true });
    await expect(heading).toHaveCSS('font-family', /Inter|system-ui/u);
    const preview = await box(dialog.getByRole('gridcell', { name: 'light blue' }).locator('> span'));
    expect(preview.width).toBeGreaterThan(40);
  });

  test('passes over disabled swatches, and scrolls a long gallery to the focused swatch', async ({ page }) => {
    await openStory(page, 'phase-34-gallery--inline');
    const gallery = page.getByTestId('inline-gallery');
    const unavailable = gallery.getByRole('gridcell', { name: 'Unavailable scale' });
    await expect(unavailable).toBeDisabled();
    await gallery.getByRole('gridcell', { name: 'Blue, white, red scale' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(gallery.getByRole('gridcell', { name: 'Blue, white, red scale' })).toBeFocused();

    await openStory(page, 'phase-34-gallery--text-swatches-and-scrolling');
    const long = page.getByTestId('inline-gallery');
    await long.getByRole('gridcell', { name: 'Style 1', exact: true }).focus();
    await page.keyboard.press('Control+End');
    const last = long.getByRole('gridcell', { name: 'Style 24' });
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
    const scroller = await last.evaluate((element) => {
      let node = element.parentElement;
      while (node && getComputedStyle(node).overflowY === 'visible') node = node.parentElement;
      return node ? node.scrollTop : 0;
    });
    expect(scroller).toBeGreaterThan(0);
  });

  test('hosts inside a split button, whose main part stays separate', async ({ page }) => {
    await openStory(page, 'phase-34-gallery--conditional-format-in-split-button');
    await page.getByRole('button', { name: 'Conditional format', exact: true }).click();
    await expect(page.locator('output[aria-label="Applied count"]')).toHaveText('1');
    await page.getByRole('button', { name: 'Choose format' }).click();
    const dialog = page.getByRole('dialog', { name: 'Formats' });
    await dialog.getByRole('gridcell', { name: 'Green data bar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('output[aria-label="Chosen format"]')).toHaveText('bar-green');
    await expect(page.locator('output[aria-label="Applied count"]')).toHaveText('1');
  });

  test('mirrors columns and arrows in RTL', async ({ page }) => {
    await openStory(page, 'phase-34-gallery--arabic-rtl', RTL);
    const gallery = page.getByTestId('inline-gallery');
    const first = gallery.getByRole('gridcell', { name: 'أزرق فاتح' });
    const second = gallery.getByRole('gridcell', { name: 'برتقالي فاتح' });
    expect((await box(first)).x).toBeGreaterThan((await box(second)).x);
    await first.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(second).toBeFocused();
  });
});

test.describe('CgBorderPicker', () => {
  const applied = (page: Page) => page.locator('output[aria-label="Applied border"]');

  test('reports a preset with its edges, the chosen line style and color', async ({ page }) => {
    await openStory(page, 'phase-34-borderpicker--all-presets');
    const picker = page.getByTestId('border-picker');
    await picker.getByRole('radio', { name: 'Dashed' }).click();
    await picker.getByRole('gridcell', { name: 'Top and bottom borders' }).click();
    await expect(applied(page)).toContainText('"preset":"top-bottom"');
    await expect(applied(page)).toContainText('{"edge":"top","lineStyle":"dashed"},{"edge":"bottom","lineStyle":"dashed"}');
    await expect(picker.getByRole('gridcell', { name: 'Top and bottom borders' })).toHaveAttribute('aria-selected', 'true');
    await picker.getByRole('gridcell', { name: 'Thick outside borders' }).click();
    await expect(applied(page)).toContainText('{"edge":"top","lineStyle":"thick"}');
    await picker.getByRole('gridcell', { name: 'No border' }).click();
    await expect(applied(page)).toContainText('"clear":true,"edges":[]');
  });

  test('moves a preset with arrows, and selects line styles as a radio group', async ({ page }) => {
    await openStory(page, 'phase-34-borderpicker--all-presets');
    const picker = page.getByTestId('border-picker');
    await expect(picker.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);
    const outside = picker.getByRole('gridcell', { name: 'Outside borders', exact: true });
    await outside.focus();
    await page.keyboard.press('ArrowDown');
    await expect(picker.getByRole('gridcell', { name: 'Left border' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(applied(page)).toContainText('"preset":"left"');
    await page.keyboard.press('Tab');
    const thin = picker.getByRole('radio', { name: 'Thin' });
    await expect(thin).toBeFocused();
    await page.keyboard.press('ArrowRight');
    const medium = picker.getByRole('radio', { name: 'Medium' });
    await expect(medium).toBeFocused();
    await expect(medium).toHaveAttribute('aria-checked', 'true');
    await expect(thin).toHaveAttribute('aria-checked', 'false');
  });

  test('draws distinct line samples', async ({ page }) => {
    await openStory(page, 'phase-34-borderpicker--all-presets');
    const picker = page.getByTestId('border-picker');
    await expect(picker.getByRole('radio', { name: 'Double' }).locator('line')).toHaveCount(2);
    await expect(picker.getByRole('radio', { name: 'Dashed' }).locator('line')).toHaveAttribute('stroke-dasharray', '4 3');
    const thick = await picker.getByRole('radio', { name: 'Thick' }).locator('line').getAttribute('stroke-width');
    const thin = await picker.getByRole('radio', { name: 'Thin' }).locator('line').getAttribute('stroke-width');
    expect(Number(thick)).toBeGreaterThan(Number(thin));
  });

  test('picks a line color in a nested flyout, and Escape closes only that flyout', async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, 'phase-34-borderpicker--inside-split-button');
    await page.getByRole('button', { name: 'Choose border' }).click();
    const borders = page.getByRole('dialog', { name: 'Borders' });
    await expect(borders).toBeVisible();
    const lineColor = borders.getByRole('button', { name: 'Line color' });
    await openWithKeyboard(page, lineColor);
    const colors = page.getByRole('dialog', { name: 'Line color' });
    await expect(colors).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(colors).toBeHidden();
    await expect(borders).toBeVisible();
    await expect(lineColor).toBeFocused();
    await lineColor.click();
    await colors.getByRole('gridcell', { name: 'Red', exact: true }).click();
    await expect(colors).toBeHidden();
    await expect(borders).toBeVisible();
    await expect(lineColor.locator('[data-cg-icon-accent]')).toHaveCSS('fill', 'rgb(255, 0, 0)');
    await borders.getByRole('gridcell', { name: 'All borders' }).click();
    await expect(borders).toBeHidden();
    await expect(page.getByTestId('applied')).toHaveText('all');
    await page.getByTestId('border-button').click();
    await expect(page.getByTestId('applied')).toHaveText('all all');
    expect(problems).toEqual([]);
  });

  test('keeps the nested picker on screen in RTL, and leaves edges physical', async ({ page }) => {
    await openStory(page, 'phase-34-borderpicker--arabic-rtl', RTL);
    const picker = page.getByTestId('border-picker');
    await picker.getByRole('button', { name: 'لون الخط' }).click();
    const colors = page.getByRole('dialog', { name: 'لون الخط' });
    await expect(colors).toBeVisible();
    await expect(colors).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Escape');
    await picker.getByRole('gridcell', { name: 'الحد الأيسر' }).click();
    await expect(applied(page)).toContainText('"edge":"left"');
  });
});

test.describe('CgRibbon', () => {
  const group = (page: Page, key: string) => page.locator(`[data-cg-ribbon-group="${key}"]`);
  const modeOf = (page: Page, key: string) => group(page, key).getAttribute('data-mode');
  const stageOf = async (page: Page) => Number(await page.locator('[data-cg-ribbon-stage]').getAttribute('data-cg-ribbon-stage'));
  const log = (page: Page) => page.getByTestId('log');

  test('fills each group as declared when there is room: large items over small stacks, with named groups', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    await expect(page.getByRole('region', { name: 'Ribbon' })).toBeVisible();
    expect(await stageOf(page)).toBe(0);
    const clipboard = group(page, 'clipboard');
    const paste = await box(clipboard.getByRole('button', { name: 'Paste', exact: true }));
    const cut = await box(clipboard.getByRole('button', { name: 'Cut' }));
    const copy = await box(clipboard.getByRole('button', { name: 'Copy' }));
    const painter = await box(clipboard.getByRole('button', { name: 'Format Painter' }));
    expect(cut.x).toBe(copy.x);
    expect(copy.x).toBe(painter.x);
    expect(copy.y).toBeGreaterThan(cut.y);
    expect(painter.y).toBeGreaterThan(copy.y);
    expect(cut.x).toBeGreaterThan(paste.x);
    const icon = await box(clipboard.getByRole('button', { name: 'Paste', exact: true }).locator('svg'));
    expect(icon.height).toBeGreaterThan(24);
    const label = await box(clipboard.getByText('Clipboard', { exact: true }));
    expect(label.y).toBeGreaterThanOrEqual(painter.y + painter.height - 1);
    await expect(page.getByRole('toolbar', { name: 'Clipboard' })).toBeVisible();
  });

  test('lays out rows groups with font boxes, and keeps the panel the same height on every tab', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    const font = group(page, 'font');
    const name = await box(font.getByRole('combobox', { name: 'Font name' }));
    const bold = await box(font.getByRole('button', { name: 'Bold' }));
    expect(bold.y).toBeGreaterThan(name.y + name.height - 1);
    const panel = page.locator('[data-cg-ribbon-stage]');
    const height = (await box(panel)).height;
    await page.getByRole('tab', { name: 'Data' }).click();
    await expect(page.getByRole('toolbar', { name: 'Sort & Filter' })).toBeVisible();
    expect((await box(panel)).height).toBe(height);
    await page.getByRole('tab', { name: 'Insert' }).click();
    await expect(page.getByRole('toolbar', { name: 'Charts' })).toBeVisible();
    expect((await box(panel)).height).toBe(height);
  });

  test('leaves out a hidden tab and blocks a disabled one', async ({ page }) => {
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    await expect(page.getByRole('tab', { name: 'Table Design', exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Table Design 2' })).toBeDisabled();
  });

  test('shrinks by group as width falls, never overflows while a step is left, and restores as it grows', async ({ page }) => {
    const problems = watchProblems(page);
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    const panel = page.locator('[data-cg-ribbon-stage]');
    const overflow = () => panel.evaluate((element) => element.firstElementChild!.getBoundingClientRect().width - element.clientWidth);
    let previous = 0;
    for (const width of [1400, 1200, 1000, 800, 700]) {
      await page.setViewportSize({ width, height: 400 });
      await expect.poll(overflow).toBeLessThanOrEqual(0);
      const stage = await stageOf(page);
      expect(stage, `stage at ${width}`).toBeGreaterThanOrEqual(previous);
      previous = stage;
    }
    expect(previous).toBeGreaterThan(5);
    await page.setViewportSize({ width: 1700, height: 400 });
    await expect.poll(() => stageOf(page)).toBe(0);
    await expect.poll(() => modeOf(page, 'clipboard')).toBe('full');
    expect(problems).toEqual([]);
  });

  test('gives up large buttons, then text, then collapses, keeping higher priority groups longest', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    const paste = page.getByRole('button', { name: 'Paste', exact: true });
    await page.setViewportSize({ width: 1240, height: 400 });
    await expect.poll(() => modeOf(page, 'editing')).not.toBe('full');
    await page.setViewportSize({ width: 700, height: 400 });
    await expect.poll(() => modeOf(page, 'editing')).toBe('collapsed');
    await expect(group(page, 'clipboard')).not.toHaveAttribute('data-mode', 'collapsed');
    await expect(paste).toBeVisible();
    await expect(paste).not.toContainText('Paste');
    await expect(paste).toHaveAttribute('title', 'Paste');
  });

  test('opens a collapsed group as a flyout with the group as declared, and closes after a command', async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, 'phase-34-ribbon--narrow');
    await expect(group(page, 'editing')).toHaveAttribute('data-mode', 'collapsed');
    const button = group(page, 'alignment').getByRole('button', { name: 'Alignment' });
    await openWithKeyboard(page, button);
    const flyout = page.getByRole('dialog', { name: 'Alignment' });
    await expect(flyout).toBeVisible();
    await expect(flyout).toBeInViewport({ ratio: 1 });
    await expect(flyout.getByRole('toolbar', { name: 'Alignment' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(flyout).toBeHidden();
    await expect(button).toBeFocused();
    await button.click();
    await flyout.getByRole('button', { name: 'Align left' }).click();
    await expect(flyout).toBeHidden();
    await expect(log(page)).toHaveText('left');
    expect(problems).toEqual([]);
  });

  test('keeps a flyout wider than the window on screen, scrolling inside it', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 500 });
    await openStory(page, 'phase-34-ribbon--very-narrow');
    await group(page, 'font').getByRole('button', { name: 'Font' }).click();
    const flyout = page.getByRole('dialog', { name: 'Font' });
    await expect(flyout).toBeVisible();
    const surface = page.locator('[data-cg-overlay-surface="flyout"]').filter({ has: flyout });
    await expect(surface).toBeInViewport({ ratio: 1 });
    expect((await box(surface)).width).toBeLessThanOrEqual(360);
    const scrolls = await surface.evaluate((element) => [...element.querySelectorAll('*')].some((node) => node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== 'visible'));
    expect(scrolls).toBe(true);
  });

  test('scrolls instead of losing commands when even collapsed groups do not fit', async ({ page }) => {
    await openStory(page, 'phase-34-ribbon--very-narrow');
    const panel = page.locator('[data-cg-ribbon-stage]');
    await expect(group(page, 'editing')).toHaveAttribute('data-mode', 'collapsed');
    expect(await panel.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    const button = group(page, 'editing').getByRole('button', { name: 'Editing' });
    await button.focus();
    await expect(button).toBeInViewport();
    expect(await panel.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  });

  test('has one tab stop per group, arrows inside a group, and ArrowDown for a menu', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    const home = page.getByRole('tab', { name: 'Home' });
    await home.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Collapse the ribbon' })).toBeFocused();
    await page.keyboard.press('Tab');
    const paste = page.getByRole('button', { name: 'Paste', exact: true });
    await expect(paste).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Cut' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('button', { name: 'Format Painter' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(paste).toBeFocused();
    await page.keyboard.press('ArrowDown');
    const item = page.getByRole('menuitem', { name: 'Paste values' });
    await expect(item).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(item).toBeHidden();
    await page.keyboard.press('Tab');
    await expect.poll(() => activeName(page)).toBe('Clipboard: more options');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox', { name: 'Font name' })).toBeFocused();
    // A combo box also has its own list button as a tab stop.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox', { name: 'Font size' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Increase font size' })).toBeFocused();
  });

  test('lets a font box keep its keyboard: spaces, caret arrows and its list all work', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    const font = page.getByRole('combobox', { name: 'Font name' });
    await font.click();
    await font.fill('');
    await page.keyboard.type('Times New');
    await expect(font).toHaveValue('Times New');
    await page.keyboard.press('ArrowLeft');
    await expect(font).toBeFocused();
    expect(await font.evaluate((element: HTMLInputElement) => element.selectionStart)).toBe(8);
    await page.getByRole('option', { name: 'Times New Roman' }).click();
    await expect(font).toHaveValue('Times New Roman');
  });

  test('runs commands, toggles through the host, and reports launchers', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    await page.getByRole('button', { name: 'Cut' }).click();
    await expect(log(page)).toHaveText('cut');
    const bold = page.getByRole('button', { name: 'Bold' });
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    await bold.click();
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Number: more options' }).click();
    await expect(log(page)).toHaveText('cut number-dialog');
    await page.getByRole('button', { name: 'Paste: more options' }).click();
    await page.getByRole('menuitem', { name: 'Paste values' }).click();
    await expect(log(page)).toHaveText('cut number-dialog paste-values');
  });

  test('remembers a fill color in its split button, and hosts the border and gallery flyouts', async ({ page }) => {
    const problems = watchProblems(page);
    await page.setViewportSize({ width: 1700, height: 500 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    const fill = page.getByRole('button', { name: 'Fill color', exact: true });
    await expect(fill.locator('[data-cg-icon-accent]')).toHaveCSS('fill', 'rgb(255, 255, 0)');
    await page.getByRole('button', { name: 'Fill color: more options' }).click();
    const colors = page.getByRole('dialog', { name: 'Fill color' });
    await expect(colors).toBeVisible();
    await colors.getByRole('gridcell', { name: 'Blue', exact: true }).click();
    await expect(colors).toBeHidden();
    await expect(fill.locator('[data-cg-icon-accent]')).toHaveCSS('fill', 'rgb(0, 112, 192)');
    await fill.click();
    await expect(log(page)).toHaveText('fill-#0070c0 fill-#0070c0');

    await page.getByRole('button', { name: 'Borders: more options' }).click();
    const borders = page.getByRole('dialog', { name: 'Borders' });
    await borders.getByRole('gridcell', { name: 'Outside borders', exact: true }).click();
    await expect(borders).toBeHidden();
    await expect(log(page)).toContainText('border-outside');

    await page.getByRole('button', { name: 'Format as Table' }).click();
    const gallery = page.getByRole('dialog', { name: 'Format as Table' });
    await gallery.getByRole('gridcell', { name: 'Format as Table 2' }).click();
    await expect(gallery).toBeHidden();
    await expect(log(page)).toContainText('table-two');
    expect(problems).toEqual([]);
  });

  test('collapses from the button, Ctrl+F1 and a double-click, and restores', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    const toolbar = page.getByRole('toolbar', { name: 'Clipboard' });
    await page.getByRole('button', { name: 'Collapse the ribbon' }).click();
    await expect(toolbar).toHaveCount(0);
    const expand = page.getByRole('button', { name: 'Expand the ribbon' });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expand.press('Control+F1');
    await expect(toolbar).toBeVisible();
    await page.getByRole('tab', { name: 'Home' }).dblclick();
    await expect(toolbar).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
  });

  test('opens a collapsed tab over the content, closing on the same tab, outside, Escape or a command', async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, 'phase-34-ribbon--collapsed');
    const home = page.getByRole('tab', { name: 'Home' });
    const logBefore = await box(log(page));
    const toolbar = page.getByRole('toolbar', { name: 'Clipboard' });
    await expect(toolbar).toHaveCount(0);

    await home.click();
    await expect(toolbar).toBeVisible();
    expect((await box(log(page))).y).toBe(logBefore.y);
    await home.click();
    await expect(toolbar).toHaveCount(0);

    await home.click();
    await expect(toolbar).toBeVisible();
    await page.mouse.click(1100, 600);
    await expect(toolbar).toHaveCount(0);

    await home.focus();
    await page.keyboard.press('Enter');
    await expect(toolbar).toBeVisible();
    await expect(page.getByRole('button', { name: 'Paste', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(toolbar).toHaveCount(0);
    await expect(home).toBeFocused();

    await home.click();
    await page.getByRole('button', { name: 'Cut' }).click();
    await expect(toolbar).toHaveCount(0);
    await expect(log(page)).toHaveText('cut');

    await page.getByRole('tab', { name: 'Insert' }).click();
    await expect(page.getByRole('toolbar', { name: 'Charts' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('leaves focus on an input clicked below an open tab or flyout', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 500 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    await page.getByRole('button', { name: 'Fill color: more options' }).click();
    await expect(page.getByRole('dialog', { name: 'Fill color' })).toBeVisible();
    const font = page.getByRole('combobox', { name: 'Font size' });
    await font.click();
    await expect(page.getByRole('dialog', { name: 'Fill color' })).toBeHidden();
    await expect(font).toBeFocused();
  });

  test('stays controlled by its host, with content before and after the tabs', async ({ page }) => {
    await openStory(page, 'phase-34-ribbon--controlled-tabs-and-slots');
    await expect(page.getByRole('tab', { name: 'Insert' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Data' }).click();
    await expect(page.locator('output[aria-label="Active tab"]')).toHaveText('data');
    await page.getByRole('button', { name: 'Collapse the ribbon' }).click();
    await expect(page.locator('output[aria-label="Collapsed state"]')).toHaveText('true');
    const file = await box(page.getByText('File', { exact: true }));
    const tab = await box(page.getByRole('tab', { name: 'Home' }));
    const saved = await box(page.getByText('Saved', { exact: true }));
    expect(file.x).toBeLessThan(tab.x);
    expect(saved.x).toBeGreaterThan(tab.x);
  });

  test('mirrors tabs, groups, arrows and flyouts in RTL with Arabic labels', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--arabic-rtl', RTL);
    await expect(page.getByRole('region', { name: 'الشريط' })).toBeVisible();
    const home = await box(page.getByRole('tab', { name: 'الصفحة الرئيسية' }));
    const insert = await box(page.getByRole('tab', { name: 'إدراج' }));
    expect(home.x).toBeGreaterThan(insert.x);
    const clipboard = await box(group(page, 'clipboard'));
    const font = await box(group(page, 'font'));
    expect(clipboard.x).toBeGreaterThan(font.x);
    const paste = page.getByRole('button', { name: 'لصق', exact: true });
    await paste.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('button', { name: 'قص' })).toBeFocused();
    const merge = await box(page.getByRole('button', { name: 'دمج وتوسيط', exact: true }));
    const mergeArrow = await box(page.getByRole('button', { name: 'دمج وتوسيط: خيارات أخرى' }));
    expect(mergeArrow.x).toBeLessThan(merge.x);
    await page.getByRole('button', { name: 'لون التعبئة: خيارات أخرى' }).click();
    const colors = page.getByRole('dialog', { name: 'لون التعبئة' });
    await expect(colors).toBeVisible();
    await expect(colors).toBeInViewport({ ratio: 1 });
    await expect(colors.getByRole('button', { name: 'بلا تعبئة' })).toBeVisible();
  });

  test('shrinks in RTL, with flyouts staying on screen', async ({ page }) => {
    await openStory(page, 'phase-34-ribbon--arabic-rtl-narrow', RTL);
    await expect(group(page, 'editing')).toHaveAttribute('data-mode', 'collapsed');
    await group(page, 'number').getByRole('button', { name: 'الرقم' }).click();
    const flyout = page.getByRole('dialog', { name: 'الرقم' });
    await expect(flyout).toBeVisible();
    await expect(flyout).toBeInViewport({ ratio: 1 });
  });

  test('follows the dark theme', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--dark', DARK);
    const panel = page.locator('[data-cg-ribbon-stage]');
    const background = await panel.evaluate((element) => {
      let node: Element | null = element;
      while (node) {
        const color = getComputedStyle(node).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)') return color;
        node = node.parentElement;
      }
      return '';
    });
    expect(background).toBe('rgb(21, 27, 36)');
    await expect(page.getByRole('button', { name: 'Cut' })).toHaveCSS('color', 'rgb(230, 237, 247)');
  });

  test('draws a control focus ring inside the groups, where it cannot be clipped', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    const paste = page.getByRole('button', { name: 'Paste', exact: true });
    await paste.focus();
    await page.keyboard.press('ArrowRight');
    const cut = page.getByRole('button', { name: 'Cut' });
    await expect(cut).toBeFocused();
    await expect(cut).toHaveCSS('outline-offset', '-2px');
  });

  test('narrows its rows in compact density', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 400 });
    await openStory(page, 'phase-34-ribbon--spreadsheet');
    const comfortable = (await box(page.getByRole('button', { name: 'Cut' }))).height;
    await openStory(page, 'phase-34-ribbon--spreadsheet', 'theme:light;density:compact;direction:ltr');
    const compact = (await box(page.getByRole('button', { name: 'Cut' }))).height;
    expect(compact).toBeLessThan(comfortable);
  });
});

test.describe('CgToolbar and CgTabs additions', () => {
  test('stacks a toolbar item over its column and starts rows, with a working flyout', async ({ page }) => {
    await openStory(page, 'phase-10-toolbar--layouts');
    const columns = page.getByRole('toolbar', { name: 'Columns' });
    const paste = await box(columns.getByRole('button', { name: 'Paste', exact: true }));
    const cut = await box(columns.getByRole('button', { name: 'Cut' }));
    const copy = await box(columns.getByRole('button', { name: 'Copy' }));
    expect(copy.y).toBeGreaterThan(cut.y);
    expect(cut.x).toBeGreaterThan(paste.x);
    const rows = page.getByRole('toolbar', { name: 'Rows' });
    const input = rows.getByRole('textbox', { name: 'Name' });
    const italic = await box(rows.getByRole('button', { name: 'Italic' }));
    expect(italic.y).toBeGreaterThan((await box(input)).y);
    await input.fill('');
    await input.pressSequentially('a b');
    await expect(input).toHaveValue('a b');
    await rows.getByRole('button', { name: 'Flyout' }).click();
    await page.getByRole('button', { name: 'Close this flyout' }).click();
    await expect(page.getByRole('button', { name: 'Close this flyout' })).toHaveCount(0);
  });

  test('shows tabs header content on either side of the tabs', async ({ page }) => {
    await openStory(page, 'phase-11-tabs--header-content');
    const tab = await box(page.getByRole('tab', { name: 'General' }));
    expect((await box(page.getByRole('button', { name: 'File' }))).x).toBeLessThan(tab.x);
    expect((await box(page.getByRole('button', { name: 'Share' }))).x).toBeGreaterThan(tab.x);
  });
});
