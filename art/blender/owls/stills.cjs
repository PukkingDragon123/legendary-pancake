// Save each owl model's still portraits (face + full, rendered in the browser by dev-owl.html?set=stills with the
// game's own portrait camera, ink-dot eyes and all) as public/models/owls/<id>.<shot>.webp: the UI shows them in the
// moment before a model's GLB has loaded, so a portrait is never blank. Needs the dev server and playwright:
//   NODE_PATH=$(npm root -g) node art/blender/owls/stills.cjs http://localhost:5211
// then python3 -I art/blender/owls/rigdata.py (it lists the stills in src/owl/rig.gen.ts).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
(async () => {
  const base = process.argv[2] || 'http://localhost:5173';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.goto(base + '/dev-owl.html?set=stills', { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 2400000 });
  const stills = await page.evaluate(async () => {
    const out = {};
    for (const [id, v] of Object.entries(window.__stills)) {
      if (id === 'queen') continue; // (her stills stay as they are: she is being retired)
      out[id] = {};
      for (const [shot, url] of Object.entries(v)) {
        if (!url) continue;
        const im = new Image();
        im.src = url;
        await im.decode();
        const c = document.createElement('canvas');
        c.width = im.width; c.height = im.height;
        c.getContext('2d').drawImage(im, 0, 0);
        out[id][shot] = c.toDataURL('image/webp', 0.92);
      }
    }
    return out;
  });
  const dir = resolve(__dirname, '../../../public/models/owls');
  for (const [id, v] of Object.entries(stills)) for (const [shot, url] of Object.entries(v)) {
    writeFileSync(resolve(dir, `${id}.${shot}.webp`), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', `${id}.${shot}.webp`);
  }
  await browser.close();
})();
