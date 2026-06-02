import { chromium } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artDir = resolve(root, 'scripts/art');
const svgs = readdirSync(artDir).filter((f) => f.endsWith('.svg'))
  .map((f) => ({ name: basename(f, '.svg'), svg: readFileSync(resolve(artDir, f), 'utf8') }));

const cards = svgs.map(({ name, svg }) => `
  <div class="card">
    <div class="art">${svg}</div>
    <div class="label">${name}</div>
  </div>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  * { margin:0; box-sizing:border-box; }
  body {
    font-family: sans-serif; padding: 40px;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 28px;
    background:
      radial-gradient(circle at top left, rgba(255,207,227,0.45), transparent 30%),
      radial-gradient(circle at top right, rgba(153,216,253,0.35), transparent 32%),
      linear-gradient(180deg, #fff8fc 0%, #f6fbff 42%, #f9fcff 100%);
  }
  .card {
    background: rgba(255,255,255,0.82); border:1px solid rgba(154,207,243,0.55);
    border-radius: 28px; box-shadow: 0 14px 40px rgba(154,207,243,0.18);
    padding: 24px; display:flex; flex-direction:column; align-items:center; gap:10px;
  }
  .art svg { width: 240px; height: auto; display:block; }
  .label { color:#6f7894; font-size:14px; font-weight:700; }
</style></head><body>${cards}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(root, 'scripts/art-preview.png'), fullPage: true });
await browser.close();
console.log('previewed', svgs.map((s) => s.name).join(', '));
