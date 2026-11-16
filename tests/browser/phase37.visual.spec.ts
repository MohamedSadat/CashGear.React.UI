import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

const LIGHT = 'theme:light;density:comfortable;direction:ltr';
const RTL = 'theme:light;density:comfortable;direction:rtl';
const DARK_RTL = 'theme:dark;density:comfortable;direction:rtl';

for (const [name, story, globals] of [
  ['phase-37-avatars-rtl', 'phase-37-avatar--sizes-and-stacks', RTL],
  ['phase-37-avatars-dark', 'phase-37-avatar--dark', DARK_RTL],
  ['phase-37-block-icons-rtl', 'phase-1-2-icon--document-blocks-rtl', RTL],
  ['phase-37-breadcrumb-rtl', 'phase-37-breadcrumb--collapsed', RTL],
  ['phase-37-breadcrumb-ltr', 'phase-37-breadcrumb--left-to-right', LIGHT],
  ['phase-37-file-picker-dark', 'phase-37-filepicker--drop-zone-dark', DARK_RTL],
  ['phase-37-inline-editors-rtl', 'phase-37-inlineeditor--standing-fields', RTL],
  ['phase-37-command-menu-rtl', 'phase-37-commandmenu--open-list', RTL],
  ['phase-37-command-palette-dark', 'phase-37-commandmenu--search-palette-dark', DARK_RTL],
  ['phase-37-menu-panel-rtl', 'phase-37-menupanel--in-place', RTL],
  ['phase-37-menu-panel-dark', 'phase-37-menupanel--dark', DARK_RTL],
  ['phase-37-sortable-list-rtl', 'phase-37-sortablelist--properties-list', RTL],
  ['phase-37-option-picker-groups-rtl', 'phase-37-optionpicker--status-groups', RTL],
  ['phase-37-option-picker-dark', 'phase-37-optionpicker--status-groups-dark', DARK_RTL],
  ['phase-37-item-picker-rtl', 'phase-37-optionpicker--people-results', RTL],
  ['phase-37-mention-area-rtl', 'phase-37-mentionarea--with-mentions', RTL],
  ['phase-37-drag-handles-rtl', 'phase-37-dragdrop--block-handles', RTL],
  ['phase-37-fixes-buttons-dark', 'phase-37-library-fixes--button-contrast-dark', DARK_RTL],
  ['phase-37-fixes-splitter-rtl', 'phase-37-library-fixes--splitter-header-and-fill', RTL],
  ['phase-37-month-calendar-rtl', 'phase-37-monthcalendar--arabic-month', RTL],
  ['phase-37-month-calendar-dark', 'phase-37-monthcalendar--arabic-month-dark', DARK_RTL],
  ['phase-37-month-calendar-ltr', 'phase-37-monthcalendar--sunday-first-english', LIGHT],
  ['phase-37-kanban-rtl', 'phase-37-kanbanboard--arabic-board', RTL],
  ['phase-37-kanban-dark', 'phase-37-kanbanboard--arabic-board-dark', DARK_RTL],
] as const) {
  test(name, async ({ page }) => {
    await openStory(page, story, globals);
    await expect(page.locator('[data-cg-story-root]')).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
  });
}

test('phase-37-emoji-picker-rtl', async ({ page }) => {
  await openStory(page, 'phase-37-emojipicker--page-icon-picker', RTL);
  await expect(page.getByRole('searchbox', { name: 'ابحث عن رمز' })).toBeFocused();
  await expect(page).toHaveScreenshot('phase-37-emoji-picker-rtl.png', { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
});

test('phase-37-slash-menu-rtl', async ({ page }) => {
  await openStory(page, 'phase-37-commandmenu--slash-menu', RTL);
  await page.getByRole('combobox', { name: 'محرر المستند' }).click();
  await page.keyboard.type('/');
  await expect(page.getByRole('listbox', { name: 'الكتل' })).toBeVisible();
  await expect(page).toHaveScreenshot('phase-37-slash-menu-rtl.png', { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
});

test('phase-37-selection-toolbar-rtl', async ({ page }) => {
  await openStory(page, 'phase-37-selectiontoolbar--follows-selection', RTL);
  await expect(page.getByRole('toolbar', { name: 'التنسيق' })).toBeVisible();
  await expect(page).toHaveScreenshot('phase-37-selection-toolbar-rtl.png', { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 });
});
