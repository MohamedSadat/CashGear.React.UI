import { expect,test } from '@playwright/test';
import { openStory } from './storybook';

for(const story of ['sales-analysis','calculated-measures','arabic-rtl','dark-comfortable','empty','limits','narrow','provider-error']){
  test(`Phase 22 PivotTable ${story}`,async({page})=>{
    await openStory(page,`phase-22-pivottable--${story}`);await expect(page.getByRole('grid')).toHaveAttribute('aria-busy','false');
    await expect(page).toHaveScreenshot(`pivot-${story}.png`,{animations:'disabled',caret:'hide',fullPage:true,maxDiffPixelRatio:0.001});
  });
}
for(const kind of ['fields','filter','drill']){
  test(`Phase 22 PivotTable ${kind} popup`,async({page})=>{
    await openStory(page,'phase-22-pivottable--sales-analysis');await expect(page.getByRole('grid')).toHaveAttribute('aria-busy','false');
    if(kind==='fields')await page.getByRole('button',{name:'Field list',exact:true}).click();
    else if(kind==='filter'){await page.getByLabel('Region Filters',{exact:true}).click();await expect(page.getByRole('checkbox',{name:'Cairo',exact:true})).toBeVisible();}
    else{await page.getByRole('gridcell',{name:'2,004.00',exact:true}).first().dblclick();await expect(page.getByRole('dialog').getByRole('grid')).toBeVisible();}
    await expect(page.getByRole('dialog')).toBeVisible();await expect(page).toHaveScreenshot(`pivot-${kind}.png`,{animations:'disabled',caret:'hide',fullPage:true,maxDiffPixelRatio:0.001});
  });
}
