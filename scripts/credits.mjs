// Collects every credits file (docs/credits/*.md and docs/AUDIO-CREDITS.md) into public/CREDITS.txt,
// which Settings > Credits shows in the app. Run: node scripts/credits.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
const parts = ['# Hoot Hollow credits\n\nModels, textures, artworks, photos and sounds by their authors, used under their licences (CC0, public domain, CC BY). Thank you.\n'];
const dir = 'docs/credits';
if (existsSync(dir)) for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) parts.push(readFileSync(`${dir}/${f}`, 'utf8'));
if (existsSync('docs/AUDIO-CREDITS.md')) parts.push(readFileSync('docs/AUDIO-CREDITS.md', 'utf8'));
writeFileSync('public/CREDITS.txt', parts.join('\n\n---\n\n'));
console.log('public/CREDITS.txt', parts.length - 1, 'sections');
