import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

test('Phase 24 TimeEdit commits canonical precision and applies off-step picker minutes', async ({ page }) => {
  await openStory(page, 'phase-24-timeedit--controlled');
  const input = page.getByRole('combobox', { name: 'Controlled shift start' });
  await input.fill('2:31:40 PM');
  await input.press('Enter');
  await expect(page.getByLabel('Canonical time')).toHaveText('14:31:40.456');

  await openStory(page, 'phase-24-timeedit--primary');
  const minute = page.getByRole('combobox', { name: 'Minute' });
  await expect(minute.locator('option[value="17"]')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Second' }).selectOption('40');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('combobox', { name: 'Posting time' })).toHaveValue('1:17:40 PM');
});

test('Phase 24 TimeEdit integrates native validation, submission, and reset', async ({ page }) => {
  await openStory(page, 'phase-24-timeedit--validation-and-form');
  const input = page.getByRole('combobox', { name: 'Required cutoff' });
  await input.fill('');
  await page.getByRole('button', { name: 'Submit time' }).click();
  await expect(input).toBeFocused();
  await input.fill('06:45');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Submit time' }).click();
  await expect(page.getByLabel('Submitted canonical time')).toHaveText('06:45:42.250');
  await page.getByRole('button', { name: 'Reset time' }).click();
  await expect(input).toHaveValue('17:05');
});

test('Phase 24 GridLayout preserves keyed content while descriptors change', async ({ page }) => {
  await openStory(page, 'phase-24-gridlayout--responsive-descriptors');
  const layout = page.locator('[data-layout]');
  const notes = page.getByRole('textbox', { name: 'Grid notes' });
  await notes.fill('Unsaved retained note');
  await page.getByRole('button', { name: 'Toggle grid width' }).click();
  await expect(layout).toHaveAttribute('data-layout', 'narrow');
  await expect(notes).toHaveValue('Unsaved retained note');
  expect(await layout.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns)).toBe('1fr');
});

test('Phase 24 WaitIndicator exposes status and decorative semantics', async ({ page }) => {
  await openStory(page, 'phase-24-waitindicator--animations-and-sizes');
  await expect(page.getByRole('status')).toHaveCount(3);
  await expect(page.locator('[data-cg-wait-animation="spinner"]')).toHaveCount(1);
  await expect(page.locator('[data-cg-wait-animation="dots"] i')).toHaveCount(3);
  await openStory(page, 'phase-24-waitindicator--custom-and-decorative');
  await expect(page.getByRole('status', { name: 'Importing records' })).toBeVisible();
  await expect(page.locator('[data-cg-wait-indicator][aria-hidden="true"]')).toHaveCount(1);
});

test('Phase 24 MessageBox shares FIFO ordering with confirmation', async ({ page }) => {
  await openStory(page, 'phase-24-messagebox--mixed-alert-confirmation-queue');
  await page.getByRole('button', { name: 'Queue alert and confirmation' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Import complete' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Post imported batch?' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByLabel('Dialog queue result')).toHaveText('Batch posted');
});

for (const [story, globals, narrow] of [
  ['phase-24-timeedit--validation-and-form', undefined, false],
  ['phase-24-timeedit--dark-compact', 'theme:dark;density:compact;direction:ltr', false],
  ['phase-24-timeedit--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', true],
  ['phase-24-gridlayout--named-areas', undefined, false],
  ['phase-24-gridlayout--rtl-narrow', 'theme:light;density:comfortable;direction:rtl', true],
  ['phase-24-waitindicator--custom-and-decorative', undefined, false],
  ['phase-24-messagebox--dark', 'theme:dark;density:comfortable;direction:ltr', false],
  ['phase-24-messagebox--arabic-rtl-narrow', 'theme:light;density:comfortable;direction:rtl', true],
] as const) {
  test(`Phase 24 ${story} has no serious or critical Axe violations`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 780 });
    await openStory(page, story, globals);
    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
  });
}

test('Phase 24 WaitIndicator honors forced colors and reduced motion', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await openStory(page, 'phase-24-waitindicator--animations-and-sizes');
  const spinner = page.locator('[data-cg-wait-animation="spinner"]');
  await expect(spinner).toHaveCSS('animation-name', 'none');
  await expect(spinner).toHaveCSS('border-right-color', await spinner.evaluate((element) => getComputedStyle(element).color));
});
