import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';
for (const direction of ['ltr', 'rtl']) test(`Phase 32A occurrence editing ${direction}`, async ({ page }) => {
  await openStory(page, direction === 'rtl' ? 'phase-32a-recurrence--rtl-review' : 'phase-32a-recurrence--review', `theme:light;direction:${direction}`);
  const occurrences = page.getByRole('button', { name: /Daily planning,/ }); await expect(occurrences).toHaveCount(3);
  await occurrences.first().dblclick(); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await dialog.getByLabel('Title', { exact: true }).fill('Occurrence only'); await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden(); await expect(page.getByRole('button', { name: /Occurrence only,/ })).toHaveCount(1); await expect(occurrences).toHaveCount(2);
  await expect(page.getByLabel('Last operation')).toHaveText('occurrence: 2026-03-08T13:00:00.000Z');
  await occurrences.first().dblclick(); await dialog.getByLabel('Edit scope').selectOption('series'); await expect(dialog.getByLabel('Frequency')).toHaveValue('daily');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
