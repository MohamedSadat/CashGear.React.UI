import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openStory } from './storybook';

test('Phase 22 PivotTable accessibility, keyboard navigation, field list and drill-down', async ({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await openStory(page,'phase-22-pivottable--sales-analysis');
  const grid=page.getByRole('grid');await expect(grid).toHaveAttribute('aria-busy','false');
  const first=grid.getByRole('gridcell').first();await first.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('[data-pivot-cell="0:1"]')).toBeFocused();
  await page.getByRole('button',{name:'Field list',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await dialog.getByLabel('Product Area',{exact:true}).selectOption('filter');await dialog.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByLabel('Product Area',{exact:true})).toHaveValue('filter');
  await expect(grid).toHaveAttribute('aria-busy','false');await grid.getByRole('gridcell').first().focus();await page.keyboard.press('Control+Enter');await expect(page.getByRole('dialog',{name:'Drill down',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('grid')).toBeVisible();await page.keyboard.press('Escape');
  const axe=await new AxeBuilder({page}).analyze();expect(axe.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);expect(errors).toEqual([]);
});
test('Phase 22 PivotTable drag, member filtering, collapse and complete export',async({page,browserName})=>{
  await openStory(page,'phase-22-pivottable--full-export');await expect(page.getByRole('grid')).toHaveAttribute('aria-busy','false');
  const handle=await page.locator('[data-pivot-drag-handle="product"]').boundingBox();const target=await page.locator('[data-pivot-area="filter"]').boundingBox();
  expect(handle).not.toBeNull();expect(target).not.toBeNull();
  // Chromium needs intermediate mouse movement to initiate native HTML dragging.
  if(browserName==='chromium'){
    await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2);await page.mouse.down();await page.mouse.move(handle!.x+handle!.width/2+10,handle!.y+handle!.height/2+5,{steps:5});await page.mouse.move(target!.x+20,target!.y+20,{steps:20});await page.mouse.up();
  }else await page.locator('[data-pivot-drag-handle="product"]').dragTo(page.locator('[data-pivot-area="filter"]'));
  await expect(page.getByLabel('Product Area',{exact:true})).toHaveValue('filter');
  await page.getByLabel('Region Filters',{exact:true}).click();await expect(page.getByRole('checkbox',{name:'Cairo',exact:true})).toBeVisible();await page.getByRole('button',{name:'Clear all',exact:true}).click();await page.getByRole('checkbox',{name:'Cairo',exact:true}).check();await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByRole('rowheader',{name:'Alexandria',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Collapse all',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export Excel',exact:true}).click();expect((await download).suggestedFilename()).toBe('pivot.xlsx');await expect(page.getByLabel('Export result')).toContainText('logical rows');
});
test('Phase 22 PivotTable virtualizes both axes and reaches the final cell',async({page})=>{
  await openStory(page,'phase-22-pivottable--virtualized');const grid=page.getByRole('grid');await expect(grid).toHaveAttribute('aria-busy','false',{timeout:20000});
  expect(await grid.getByRole('row').count()).toBeLessThan(40);expect(await grid.getByRole('gridcell').count()).toBeLessThan(450);
  await grid.getByRole('gridcell').first().focus();await page.keyboard.press('Control+End');const lastRow=Number(await grid.getAttribute('aria-rowcount'))-2,lastCol=Number(await grid.getAttribute('aria-colcount'))-2;await expect(page.locator(`[data-pivot-cell="${lastRow}:${lastCol}"]`)).toBeFocused();
});
test('Phase 22 PivotTable persists layout and renders remote and RTL variants',async({page})=>{
  await openStory(page,'phase-22-pivottable--saved-layout');await page.getByLabel('Product Area',{exact:true}).selectOption('filter');await expect.poll(()=>page.evaluate(()=>localStorage.getItem('cg-pivot:layout:pivot-sales-demo'))).toContain('"area":"filter"');await page.reload();await expect(page.getByLabel('Product Area',{exact:true})).toHaveValue('filter');
  await openStory(page,'phase-22-pivottable--remote-provider');await expect(page.getByRole('grid')).toHaveAttribute('aria-busy','false');await expect(page.getByRole('gridcell').first()).toBeVisible();
  await openStory(page,'phase-22-pivottable--arabic-rtl');await expect(page.locator('[data-cg-pivot-ready]')).toHaveAttribute('dir','rtl');const axe=await new AxeBuilder({page}).analyze();expect(axe.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
});
