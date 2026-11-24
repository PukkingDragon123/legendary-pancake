// The artifact host serves only web file types, and .glb is not one of them. For `build:artifact`
// this wraps every dist-artifact/**/*.glb as <name>.glb.json, {"glb": "<base64 of the GLB>"}, and
// removes the .glb. src/gfx/glb.ts fetches the JSON, decodes the base64 itself (no data: URL fetch,
// which the host's frame may refuse) and parses the GLB as usual.
import { readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist-artifact';
let n = 0, inBytes = 0, outBytes = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.glb')) convert(p);
  }
}

function convert(p) {
  const buf = readFileSync(p);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${p}: not a binary glTF`);
  const out = JSON.stringify({ glb: buf.toString('base64') });
  writeFileSync(`${p}.json`, out);
  unlinkSync(p);
  n++; inBytes += buf.length; outBytes += out.length;
}

walk(root);
console.log(`glb2json: ${n} models, ${(inBytes / 1e6).toFixed(1)}MB -> ${(outBytes / 1e6).toFixed(1)}MB`);
