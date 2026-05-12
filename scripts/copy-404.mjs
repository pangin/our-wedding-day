import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve('dist');
const indexFile = resolve(distDir, 'index.html');
const fallbackFile = resolve(distDir, '404.html');

if (!existsSync(indexFile)) {
  throw new Error('dist/index.html does not exist. Run vite build first.');
}

copyFileSync(indexFile, fallbackFile);
