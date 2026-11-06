import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
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

for (const [story, globals] of [
  ['phase-35-chart-document--excel-clustered-column', LIGHT],
  ['phase-35-chart-document--excel-clustered-bar', LIGHT],
  ['phase-35-chart-document--excel-line-with-markers', LIGHT],
  ['phase-35-chart-document--excel-area', LIGHT],
  ['phase-35-chart-document--excel-pie', LIGHT],
  ['phase-35-chart-document--excel-doughnut', LIGHT],
  ['phase-35-chart-document--excel-scatter-markers', LIGHT],
  ['phase-35-chart-document--excel-scatter-smooth', LIGHT],
  ['phase-35-chart-document--excel-combo-secondary-axis', LIGHT],
  ['phase-35-chart-document--excel-dark-colours', DARK],
  ['phase-35-chart-document--theme-defaults', LIGHT],
  ['phase-35-chart-document--small-sizes', LIGHT],
  ['phase-35-chart-document--excel-arabic-rtl', RTL],
  ['phase-35-chart-document--element-hit-testing', LIGHT],
] as const) {
  test(`${story} has no accessibility violations or browser errors`, async ({ page }) => {
    const problems = watchProblems(page);
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-chart-canvas]').first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes[0]?.target.join(' ')})`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test.describe('CgChart document layout', () => {
  test('draws at the exact size without the card frame', async ({ page }) => {
    await openStory(page, 'phase-35-chart-document--excel-clustered-column', LIGHT);
    const surface = page.locator('[data-cg-chart-surface]');
    const box = (await surface.boundingBox())!;
    expect(box.width).toBe(480);
    expect(box.height).toBe(288);
    await expect(surface).toHaveCSS('border-top-width', '0px');
    await expect(page.locator('[data-cg-chart-canvas]')).toHaveAttribute('viewBox', '0 0 480 288');
    await expect(page.locator('[data-cg-element="chartArea"] rect')).toHaveAttribute('stroke', '#D9D9D9');
  });

  test('takes its own colours from the theme tokens of the nearest data-cg-theme', async ({ page }) => {
    await openStory(page, 'phase-35-chart-document--theme-defaults', LIGHT);
    const fills = await page.locator('[data-cg-element="chartArea"] rect').evaluateAll((rects) => rects.map((rect) => getComputedStyle(rect).fill));
    expect(fills).toEqual(['rgb(255, 255, 255)', 'rgb(21, 27, 36)']);
  });

  test('shows nothing on hover when not interactive', async ({ page }) => {
    await openStory(page, 'phase-35-chart-document--excel-clustered-column', LIGHT);
    await page.locator('[data-cg-chart-point]').first().hover();
    await expect(page.getByRole('tooltip', { includeHidden: true })).toBeHidden();
    await expect(page.locator('[data-cg-hovering]')).toHaveCount(0);
  });

  test('reports the element under the pointer and outlines it', async ({ page }) => {
    await openStory(page, 'phase-35-chart-document--element-hit-testing', LIGHT);
    const output = page.getByLabel('Selected chart element');
    await expect(output).toHaveText('kind: plotArea');
    await page.locator('[data-cg-element="legendEntry"][data-cg-series-name="Cost"] text').click();
    await expect(output).toHaveText('kind: legendEntry, seriesName: Cost');
    await page.locator('[data-cg-chart-point][data-cg-series-name="Revenue"][data-cg-point-index="2"]').click();
    await expect(output).toHaveText('kind: point, seriesName: Revenue, pointIndex: 2');
    await page.locator('[data-cg-element="title"] text').click();
    await expect(output).toHaveText('kind: title');
    await page.locator('[data-cg-element="axisTitle"][data-cg-axis-name="ratio"] text').click();
    await expect(output).toHaveText('kind: axisTitle, axis: value, axisName: ratio');
    await expect(page.locator('[data-cg-chart-selection] path')).toHaveCount(2);
  });
});
