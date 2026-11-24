// Decode an EXT_meshopt_compression GLB into a plain GLB (for Blender import). node unmeshopt.mjs in.glb out.glb
import { MeshoptDecoder } from 'meshoptimizer';
import { readFileSync, writeFileSync } from 'node:fs';
await MeshoptDecoder.ready;
const [inp, out] = process.argv.slice(2);
const b = readFileSync(inp);
const jl = b.readUInt32LE(12);
const J = JSON.parse(b.subarray(20, 20 + jl).toString());
const binStart = 20 + jl + 8;
const bin = b.subarray(binStart);
const chunks = []; let off = 0;
const views = [];
for (const v of J.bufferViews) {
  const ext = v.extensions && v.extensions.EXT_meshopt_compression;
  let data;
  if (ext) {
    const src = bin.subarray(ext.byteOffset || 0, (ext.byteOffset || 0) + ext.byteLength);
    data = new Uint8Array(ext.count * ext.byteStride);
    MeshoptDecoder.decodeGltfBuffer(data, ext.count, ext.byteStride, new Uint8Array(src), ext.mode, ext.filter || 'NONE');
  } else if (v.buffer === 0 || v.buffer === undefined) {
    data = new Uint8Array(bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength));
  } else {
    data = new Uint8Array(v.byteLength);
  }
  const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(new Uint8Array(pad)); off += pad; }
  const nv = { buffer: 0, byteOffset: off, byteLength: data.length };
  if (v.byteStride) nv.byteStride = v.byteStride;
  if (v.target) nv.target = v.target;
  views.push(nv); chunks.push(data); off += data.length;
}
J.bufferViews = views;
J.buffers = [{ byteLength: off }];
J.extensionsUsed = (J.extensionsUsed || []).filter((e) => e !== 'EXT_meshopt_compression');
J.extensionsRequired = (J.extensionsRequired || []).filter((e) => e !== 'EXT_meshopt_compression');
const binBuf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
let js = Buffer.from(JSON.stringify(J)); const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
const bp = (4 - (binBuf.length % 4)) % 4; const bb = Buffer.concat([binBuf, Buffer.alloc(bp)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bb.length, 8);
const c0 = Buffer.alloc(8); c0.writeUInt32LE(js.length, 0); c0.writeUInt32LE(0x4e4f534a, 4);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(bb.length, 0); c1.writeUInt32LE(0x004e4942, 4);
writeFileSync(out, Buffer.concat([head, c0, js, c1, bb]));
console.log('wrote', out);
