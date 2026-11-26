// Bakes the loading clock: opens dev-clockbake.html on a running dev server in headless Chromium, runs
// src/onboard/clockbake.ts and writes its layers to public/img/boot/ and its boot block into index.html.
//
//   npx vite --port 5250 &   then   NODE_PATH=<dir holding playwright> node src/onboard/tools/bootbake.mjs [http://localhost:5250]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const base = process.argv[2] ?? 'http://localhost:5173';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`${base}/dev-clockbake.html?quiet`);
await page.waitForFunction(() => typeof window.__bake === 'function', null, { timeout: 300000 });
const { html, files } = await page.evaluate(async () => { const r = await window.__bake(); return { html: r.html, files: r.files }; });
await browser.close();

const dir = here('../../../public/img/boot/');
mkdirSync(dir, { recursive: true });
for (const [name, url] of Object.entries(files)) {
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  writeFileSync(dir + name, buf);
  console.log(name, (buf.length / 1024).toFixed(1), 'KB');
}
const file = here('../../../index.html');
const src = readFileSync(file, 'utf8');
const a = src.indexOf('<!-- boot:begin'), z = src.indexOf('<!-- boot:end -->');
if (a < 0 || z < 0) throw new Error('boot markers missing in index.html');
writeFileSync(file, src.slice(0, a) + html + src.slice(z + '<!-- boot:end -->'.length));
console.log('boot block written:', (html.length / 1024).toFixed(1), 'KB');
