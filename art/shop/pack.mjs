// Pack a model for the shop: WebP textures (resized to <= SIZE), meshopt geometry and animation, nothing else lost.
//   node art/shop/pack.mjs <in.glb> <out.glb> [size=2048] [quality=86]
// (needs @gltf-transform/{core,extensions,functions}, meshoptimizer and sharp on the module path: run a copy of this
// file from a folder that has them, e.g. a scratch folder with @gltf-transform/cli installed)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, textureCompress, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [src, out, sizeS = '2048', qS = '86'] = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
await doc.transform(dedup(), weld({ tolerance: 0.00001 }), resample(), prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: +qS, resize: [+sizeS, +sizeS] }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, doc);
const tris = doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);
console.log(out.split('/').pop(), Math.round(tris), 'tris', doc.getRoot().listAnimations().map((a) => a.getName()).join(','));
