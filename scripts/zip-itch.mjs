// Packs dist-itch/ into hoot-hollow-itch.zip with index.html at the zip's root, ready to upload to
// itch.io as an HTML5 game ("This file will be played in the browser"). Drops the service worker
// and PWA files, which don't apply there. Needs the `zip` command.
import { execFileSync } from 'node:child_process';
import { rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-itch', out = 'hoot-hollow-itch.zip';
for (const f of ['sw.js', 'manifest.webmanifest']) rmSync(join(dir, f), { force: true });
if (existsSync(out)) rmSync(out);
execFileSync('zip', ['-r', '-q', '-9', `../${out}`, '.'], { cwd: dir, stdio: 'inherit' });

let files = 0, bytes = 0;
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else { files++; bytes += s.size; } } };
walk(dir);
console.log(`itch: ${out} (${files} files, ${(bytes / 1e6).toFixed(1)} MB unpacked, ${(statSync(out).size / 1e6).toFixed(1)} MB zipped)`);
if (files > 1000) console.warn('itch: more than 1000 files; itch.io may refuse the upload');
