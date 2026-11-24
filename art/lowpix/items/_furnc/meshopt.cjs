// EXT_meshopt_compression pass for furnC's item GLBs: vertex and index buffer views are meshopt-encoded (the game's
// loader in src/gfx/glb.ts already sets the meshopt decoder). Images and animation data stay as they are.
//   node art/lowpix/items/_furnc/meshopt.cjs in.glb out.glb
const fs = require('fs');
const path = require('path');
const { MeshoptEncoder } = require(path.join(__dirname, '../../../../node_modules/meshoptimizer'));

function readGlb(buf) {
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  return { json, bin };
}

function writeGlb(json, bin) {
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - (js.length % 4), 0x20)]);
  let b = bin;
  if (b.length % 4) b = Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + b.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(b.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, js, bh, b]);
}

const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const CSIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

(async () => {
  await MeshoptEncoder.ready;
  const [src, dst] = process.argv.slice(2);
  const { json, bin } = readGlb(fs.readFileSync(src));
  // which views hold what: element size and count from the accessors that use them
  const info = {};
  for (const a of json.accessors) {
    const v = json.bufferViews[a.bufferView];
    if (!v || !v.target) continue;
    const el = v.byteStride || SIZE[a.type] * CSIZE[a.componentType];
    info[a.bufferView] = { count: a.count, size: el, index: v.target === 34963, csize: CSIZE[a.componentType] };
  }
  const parts = [];
  let off = 0;
  const push = (data) => {
    const pad = (4 - (off % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    const at = off;
    parts.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    off += data.byteLength;
    return at;
  };
  let fallback = 0;
  json.bufferViews.forEach((v, i) => {
    const raw = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const inf = info[i];
    if (inf && inf.size % 4 === 0 && !inf.index) {
      const enc = MeshoptEncoder.encodeGltfBuffer(new Uint8Array(raw), inf.count, inf.size, 'ATTRIBUTES');
      const at = push(enc);
      v.extensions = { EXT_meshopt_compression: { buffer: 0, byteOffset: at, byteLength: enc.byteLength, byteStride: inf.size, count: inf.count, mode: 'ATTRIBUTES' } };
      v.buffer = 1; v.byteOffset = fallback; fallback += v.byteLength; fallback += (4 - (fallback % 4)) % 4;
      if (inf.size !== (v.byteStride || inf.size)) v.byteStride = inf.size;
    } else if (inf && inf.index && inf.count % 3 === 0) {
      const enc = MeshoptEncoder.encodeGltfBuffer(new Uint8Array(raw), inf.count, inf.csize, 'TRIANGLES');
      const at = push(enc);
      v.extensions = { EXT_meshopt_compression: { buffer: 0, byteOffset: at, byteLength: enc.byteLength, byteStride: inf.csize, count: inf.count, mode: 'TRIANGLES' } };
      v.buffer = 1; v.byteOffset = fallback; fallback += v.byteLength; fallback += (4 - (fallback % 4)) % 4;
    } else {
      v.byteOffset = push(new Uint8Array(raw));
      v.buffer = 0;
    }
  });
  const out = Buffer.concat(parts);
  json.buffers = [{ byteLength: out.length }, { byteLength: Math.max(4, fallback), extensions: { EXT_meshopt_compression: { fallback: true } } }];
  json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), 'EXT_meshopt_compression'])];
  json.extensionsRequired = [...new Set([...(json.extensionsRequired || []), 'EXT_meshopt_compression'])];
  fs.writeFileSync(dst, writeGlb(json, out));
  console.log(`${path.basename(dst)} ${(fs.statSync(src).size / 1024).toFixed(0)}KB -> ${(fs.statSync(dst).size / 1024).toFixed(0)}KB`);
})();
