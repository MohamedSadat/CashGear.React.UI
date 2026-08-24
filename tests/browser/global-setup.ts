import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';

export default async function startStaticStorybook() {
  const output = resolve('storybook-static');
  if (!existsSync(resolve(output, 'iframe.html'))) {
    throw new Error('storybook-static is missing. Run npm run build-storybook before Playwright.');
  }
  const server = await preview({
    configFile: false,
    build: { outDir: output },
    preview: { host: '127.0.0.1', port: 6006, strictPort: true },
  });
  return async () => server.close();
}
