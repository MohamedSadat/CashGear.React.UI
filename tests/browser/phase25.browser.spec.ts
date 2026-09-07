import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

test('Phase 25 PdfViewer lazily renders, navigates, searches, and rotates', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  await openStory(page, 'phase-25-pdfviewer--interactive');
  const viewer = page.getByTestId('pdf-primary');
  await expect(viewer).toHaveAttribute('data-cg-pdf-ready', 'true', { timeout: 30_000 });
  await expect(viewer).toHaveAttribute('data-cg-pdf-page-count', '48');
  await expect(viewer.locator('.page canvas').first()).toBeVisible();
  const canvases = Number(await viewer.getAttribute('data-cg-pdf-rendered-canvases'));
  expect(canvases).toBeGreaterThan(0);
  expect(canvases).toBeLessThan(13);

  await page.getByTestId('pdf-go-page-24').click();
  await expect(page.getByTestId('pdf-page-overlay')).toContainText('Page 24 / 48');
  await page.getByRole('button', { name: 'Find warehouse' }).click();
  await expect(page.getByLabel('PDF story event')).toContainText('Search', { timeout: 15_000 });
  await viewer.getByRole('button', { name: 'Rotate clockwise' }).click();
  await expect(viewer).toHaveAttribute('data-cg-pdf-rotation', '90');
  expect(problems).toEqual([]);
});

test('Phase 25 PdfViewer handles incorrect and successful passwords', async ({ page }) => {
  await openStory(page, 'phase-25-pdfviewer--password-protected');
  const viewer = page.getByTestId('pdf-protected');
  const dialog = viewer.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  const password = dialog.getByLabel('Password');
  await password.fill('wrong-password');
  await dialog.getByRole('button', { name: 'Open document' }).click();
  await expect(dialog).toContainText('incorrect', { ignoreCase: true, timeout: 15_000 });
  await password.fill('cashgear-demo');
  await dialog.getByRole('button', { name: 'Open document' }).click();
  await expect(viewer).toHaveAttribute('data-cg-pdf-page-count', '2', { timeout: 15_000 });
  await expect(dialog).toHaveCount(0);
});

test('Phase 25 PdfViewer keeps links and forms opt-in and host-cancellable', async ({ page }) => {
  await openStory(page, 'phase-25-pdfviewer--security-defaults-and-opt-in');
  const secure = page.getByTestId('pdf-secure-default');
  const optedIn = page.getByTestId('pdf-security-opt-in');
  await expect(secure).toHaveAttribute('data-cg-pdf-ready', 'true', { timeout: 30_000 });
  await expect(optedIn).toHaveAttribute('data-cg-pdf-ready', 'true', { timeout: 30_000 });
  await expect(secure.locator('.annotationLayer input')).toHaveCount(0);
  const external = optedIn.locator(".annotationLayer a[href^='https://example.com']").first();
  await expect(external).toBeVisible();
  await external.click();
  await expect(page.getByLabel('PDF link policy')).toContainText('Host canceled navigation');
  await optedIn.locator('[data-cg-pdf-viewport]').focus();
  await page.keyboard.press('End');
  await expect(optedIn.locator('.annotationLayer input').first()).toBeVisible();
});

test('Phase 25 PdfViewer supports authorized providers and typed error templates', async ({ page }) => {
  await openStory(page, 'phase-25-pdfviewer--provider-source');
  await expect(page.getByRole('region', { name: 'Page 1 of 48' })).toBeVisible({ timeout: 30_000 });
  await openStory(page, 'phase-25-pdfviewer--states-and-templates');
  await expect(page.getByText('No evidence document is attached to this record.')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('invalidSignature');
  await expect(page.getByRole('region', { name: 'Disabled PDF viewer' })).toHaveAttribute('aria-disabled', 'true');
});

for (const [story, globals, narrow, waitForPdf] of [
  ['phase-25-pdfviewer--interactive', undefined, false, true],
  ['phase-25-pdfviewer--states-and-templates', undefined, false, false],
  ['phase-25-pdfviewer--dark', 'theme:dark;density:compact;direction:ltr', false, true],
  ['phase-25-pdfviewer--arabic-rtl', 'theme:light;density:comfortable;direction:rtl', false, true],
  ['phase-25-pdfviewer--narrow', undefined, true, true],
] as const) {
  test(`Phase 25 ${story} has no serious or critical Axe violations`, async ({ page }) => {
    if (narrow) await page.setViewportSize({ width: 390, height: 780 });
    await openStory(page, story, globals);
    if (waitForPdf) await expect(page.locator('[data-cg-pdf-ready]').first()).toBeVisible({ timeout: 30_000 });
    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
  });
}
