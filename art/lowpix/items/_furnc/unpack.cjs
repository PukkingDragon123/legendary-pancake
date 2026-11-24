// Undo EXT_meshopt_compression on a borrowed GLB (Gacha Garage models are meshopt + WebP) so the Python composer can
// read it: every compressed buffer view is decoded into one plain buffer. Images and the rest are copied as they are.
//   node art/lowpix/items/_furnc/unpack.cjs in.glb out.glb
const fs = require('fs');
const path = require('path');
const { MeshoptDecoder } = require(path.join(__dirname, '../../../../node_modules/meshoptimizer'));

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

(async () => {
  await MeshoptDecoder.ready;
  const [src, dst] = process.argv.slice(2);
  const { json, bin } = readGlb(fs.readFileSync(src));
  const parts = [];
  let off = 0;
  for (const v of json.bufferViews) {
    const ext = v.extensions && v.extensions.EXT_meshopt_compression;
    let data;
    if (ext) {
      const source = new Uint8Array(bin.buffer, bin.byteOffset + (ext.byteOffset || 0), ext.byteLength);
      data = new Uint8Array(ext.count * ext.byteStride);
      MeshoptDecoder.decodeGltfBuffer(data, ext.count, ext.byteStride, source, ext.mode, ext.filter || 'NONE');
      delete v.extensions.EXT_meshopt_compression;
      if (!Object.keys(v.extensions).length) delete v.extensions;
      if (ext.mode === 'ATTRIBUTES') v.byteStride = ext.byteStride;
    } else {
      data = new Uint8Array(bin.buffer, bin.byteOffset + (v.byteOffset || 0), v.byteLength);
    }
    const pad = (4 - (off % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    v.buffer = 0; v.byteOffset = off; v.byteLength = data.byteLength;
    parts.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    off += data.byteLength;
  }
  const out = Buffer.concat(parts);
  json.buffers = [{ byteLength: out.length }];
  const drop = (a) => (a || []).filter((e) => e !== 'EXT_meshopt_compression');
  json.extensionsUsed = drop(json.extensionsUsed);
  json.extensionsRequired = drop(json.extensionsRequired);
  fs.writeFileSync(dst, writeGlb(json, out));
})();
