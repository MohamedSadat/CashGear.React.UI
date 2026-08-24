import type { Page } from '@playwright/test';

export function storyUrl(id: string, globals = 'theme:light;density:comfortable;direction:ltr') {
  return `/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(globals)}`;
}

export async function openStory(page: Page, id: string, globals?: string) {
  await page.goto(storyUrl(id, globals), { waitUntil: 'networkidle' });
  await page.locator('#storybook-root').waitFor();
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
}
