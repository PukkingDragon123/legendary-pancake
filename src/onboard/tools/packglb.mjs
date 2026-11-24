// Packs several GLBs into one (one file instead of many): each source's scene becomes a top-level node named by
// its id. Handles plain and meshopt-compressed sources (EXT_meshopt_compression, with fallback buffers) and drops
// KHR_materials_unlit so everything is lit.
//
//   node src/onboard/tools/packglb.mjs out.glb id=path.glb id2=path2.glb ...
import { readFileSync, writeFileSync } from 'node:fs';

function readGLB(file) {
  const b = readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('not a glb: ' + file);
  let off = 12, json = null, bin = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = Buffer.from(data);
    off += 8 + len;
  }
  return { json, bin: bin ?? Buffer.alloc(0) };
}

const [out, ...specs] = process.argv.slice(2);
const J = { asset: { version: '2.0', generator: 'hoot-hollow packglb' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }], materials: [], textures: [], images: [], samplers: [], extensionsUsed: [], extensionsRequired: [] };
const bins = [];
let binLen = 0;
const used = new Set(), required = new Set();

for (const spec of specs) {
  const [id, file] = spec.split('=');
  const { json: j, bin } = readGLB(file);
  // the source's binary chunk lands at binLen (8-aligned)
  const pad = (8 - (binLen % 8)) % 8;
  if (pad) { bins.push(Buffer.alloc(pad)); binLen += pad; }
  const base = binLen;
  bins.push(bin); binLen += bin.length;
  // buffers: 0 is the GLB body; others are meshopt fallbacks (no data) -> new buffer entries
  const bufMap = (j.buffers ?? []).map((bf, i) => {
    if (i === 0 && bf.uri === undefined) return 0;
    J.buffers.push({ byteLength: bf.byteLength, ...(bf.extensions ? { extensions: bf.extensions } : {}) });
    return J.buffers.length - 1;
  });
  const o = { acc: J.accessors.length, bv: J.bufferViews.length, mesh: J.meshes.length, mat: J.materials.length, tex: J.textures.length, img: J.images.length, smp: J.samplers.length, node: J.nodes.length };
  for (const v of j.bufferViews ?? []) {
    const nv = { ...v, buffer: bufMap[v.buffer] };
    if (nv.buffer === 0) nv.byteOffset = (v.byteOffset ?? 0) + base;
    const ext = v.extensions?.EXT_meshopt_compression;
    if (ext) {
      const e = { ...ext, buffer: bufMap[ext.buffer] };
      if (e.buffer === 0) e.byteOffset = (ext.byteOffset ?? 0) + base;
      nv.extensions = { ...v.extensions, EXT_meshopt_compression: e };
    }
    J.bufferViews.push(nv);
  }
  for (const a of j.accessors ?? []) {
    const na = { ...a };
    if (a.bufferView !== undefined) na.bufferView = a.bufferView + o.bv;
    if (a.sparse) na.sparse = { ...a.sparse, indices: { ...a.sparse.indices, bufferView: a.sparse.indices.bufferView + o.bv }, values: { ...a.sparse.values, bufferView: a.sparse.values.bufferView + o.bv } };
    J.accessors.push(na);
  }
  for (const im of j.images ?? []) J.images.push({ ...im, ...(im.bufferView !== undefined ? { bufferView: im.bufferView + o.bv } : {}) });
  for (const s of j.samplers ?? []) J.samplers.push(s);
  for (const t of j.textures ?? []) {
    const nt = { ...t };
    if (t.source !== undefined) nt.source = t.source + o.img;
    if (t.sampler !== undefined) nt.sampler = t.sampler + o.smp;
    if (t.extensions) { nt.extensions = {}; for (const [k, v] of Object.entries(t.extensions)) nt.extensions[k] = { ...v, source: v.source + o.img }; }
    J.textures.push(nt);
  }
  const remapTex = (ti) => (ti ? { ...ti, index: ti.index + o.tex } : ti);
  for (const m of j.materials ?? []) {
    const nm = JSON.parse(JSON.stringify(m));
    if (nm.pbrMetallicRoughness) { nm.pbrMetallicRoughness.baseColorTexture = remapTex(nm.pbrMetallicRoughness.baseColorTexture); nm.pbrMetallicRoughness.metallicRoughnessTexture = remapTex(nm.pbrMetallicRoughness.metallicRoughnessTexture); }
    for (const k of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) if (nm[k]) nm[k] = remapTex(nm[k]);
    if (nm.extensions) { delete nm.extensions.KHR_materials_unlit; if (!Object.keys(nm.extensions).length) delete nm.extensions; }
    J.materials.push(nm);
  }
  for (const me of j.meshes ?? []) {
    J.meshes.push({ ...me, primitives: me.primitives.map((p) => {
      const np = { ...p, attributes: Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, v + o.acc])) };
      if (p.indices !== undefined) np.indices = p.indices + o.acc;
      if (p.material !== undefined) np.material = p.material + o.mat;
      if (p.targets) np.targets = p.targets.map((t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v + o.acc])));
      return np;
    }) });
  }
  for (const n of j.nodes ?? []) {
    const nn = { ...n };
    if (n.mesh !== undefined) nn.mesh = n.mesh + o.mesh;
    if (n.children) nn.children = n.children.map((c) => c + o.node);
    delete nn.skin; delete nn.camera;
    J.nodes.push(nn);
  }
  const roots = (j.scenes?.[j.scene ?? 0]?.nodes ?? []).map((r) => r + o.node);
  J.nodes.push({ name: id, children: roots });
  J.scenes[0].nodes.push(J.nodes.length - 1);
  for (const e of j.extensionsUsed ?? []) if (e !== 'KHR_materials_unlit') used.add(e);
  for (const e of j.extensionsRequired ?? []) if (e !== 'KHR_materials_unlit') required.add(e);
}
J.buffers[0].byteLength = binLen;
J.extensionsUsed = [...used]; J.extensionsRequired = [...required];
for (const k of ['textures', 'images', 'samplers', 'extensionsUsed', 'extensionsRequired']) if (!J[k].length) delete J[k];
const bin = Buffer.concat(bins);
const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
let js = Buffer.from(JSON.stringify(J), 'utf8');
js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + binPad.length, 8);
const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
writeFileSync(out, Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(binPad.length, 0x004e4942), binPad]));
console.log('packed', specs.length, 'models ->', out, (12 + 16 + js.length + binPad.length) / 1024 | 0, 'KB');
