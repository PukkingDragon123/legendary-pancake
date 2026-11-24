// Merge many borrowed props into one GLB for the lodge store: each prop becomes one top-level node named after it (the
// game clones it by name), its textures resized (WebP), meshes welded and meshopt-compressed.
//   node merge.mjs <out.glb> <name=path.glb[@texSize]> ...
// (needs @gltf-transform/{core,extensions,functions}, meshoptimizer and sharp on the module path)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, mergeDocuments, unpartition, meshopt, weld, textureCompress, simplify, flatten } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [out, ...specs] = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(specs[0].split('=')[1].split('@')[0]);
const target = doc;
// (the first prop is read as the target document; rename and resize it like the rest)
async function prep(d, name, size, maxTris) {
  const root = d.getRoot();
  for (const m of root.listMaterials()) { m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null); m.setEmissiveTexture(null); }
  await d.transform(prune());
  for (const t of root.listTextures()) {
    const img = t.getImage();
    if (!img) continue;
    const isN = root.listMaterials().some((m) => m.getNormalTexture() === t);
    const s = isN ? Math.min(256, size) : size;
    t.setImage(new Uint8Array(await sharp(Buffer.from(img)).resize(s, s, { fit: 'inside', withoutEnlargement: true, kernel: 'nearest' }).png().toBuffer())).setMimeType('image/png');
    t.setName(name + '_' + (isN ? 'n' : 'c'));
  }
  await d.transform(flatten(), weld({ tolerance: 0.0001 }));
  const tris = () => root.listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  if (maxTris && tris() > maxTris) await d.transform(simplify({ simplifier: MeshoptSimplifier, ratio: maxTris / tris(), error: 0.01 }));
  // one named top node per prop
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const top = d.createNode(name);
  for (const n of scene.listChildren()) { scene.removeChild(n); top.addChild(n); }
  scene.addChild(top);
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
  return tris();
}
const [n0, rest0] = specs[0].split('=');
const [, sz0 = '512', mt0 = '0'] = rest0.split('@');
console.log(n0, Math.round(await prep(target, n0, +sz0, +mt0)));
for (const spec of specs.slice(1)) {
  const [name, rest] = spec.split('=');
  const [path, size = '512', maxT = '0'] = rest.split('@');
  const d = await io.read(path);
  console.log(name, Math.round(await prep(d, name, +size, +maxT)));
  const map = mergeDocuments(target, d);
  const scenes = target.getRoot().listScenes();
  const main = scenes[0];
  for (const s of scenes.slice(1)) { for (const n of s.listChildren()) { s.removeChild(n); main.addChild(n); } s.dispose(); }
  void map;
}
await target.transform(unpartition(), dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 88 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, target);
console.log('nodes', target.getRoot().listScenes()[0].listChildren().map((n) => n.getName()).join(' '));
