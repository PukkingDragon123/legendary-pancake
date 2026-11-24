// The artifact host serves only web file types, and .glb is not one of them. For `build:artifact`
// this turns every dist-artifact/**/*.glb into a self-contained glTF JSON file beside it
// (<name>.glb.json, the binary chunk embedded as a base64 data URI) and removes the .glb.
// src/gfx/glb.ts asks for the .json in artifact mode; GLTFLoader reads both forms.
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
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  if (!json) throw new Error(`${p}: no JSON chunk`);
  if (bin) {
    const b0 = json.buffers?.[0];
    if (!b0 || b0.uri !== undefined) throw new Error(`${p}: unexpected buffer layout`);
    b0.uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;
  }
  const out = JSON.stringify(json);
  writeFileSync(`${p}.json`, out);
  unlinkSync(p);
  n++; inBytes += buf.length; outBytes += Buffer.byteLength(out);
}

walk(root);
console.log(`glb2json: ${n} models, ${(inBytes / 1e6).toFixed(1)}MB -> ${(outBytes / 1e6).toFixed(1)}MB`);
