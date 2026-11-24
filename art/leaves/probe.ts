// [look4] dev probe: leaf points, puffs and canopy size per tree kind (vite-node art/leaves/probe.ts)
import { buildTree, leafPoints } from '../../src/world/bushed/build.ts';
import { puffsFromPoints } from '../../src/world/foliage.ts';

const kinds: [string, 'oak' | 'birch' | 'spruce' | 'fir', number, number][] = [
  ['oak1', 'oak', 5, 0.55], ['oak2', 'oak', 14, 0.6], ['maple', 'oak', 21, 0.5], ['birch1', 'birch', 3, 0.5], ['birch2', 'birch', 11, 0.45], ['blossom', 'birch', 17, 0.4], ['pine1', 'spruce', 2, 0.45], ['sapling', 'fir', 30, 0.16],
];
for (const [k, sp, seed, age] of kinds) {
  const m = buildTree(sp, seed, { age });
  const pts = leafPoints(m);
  const R = Math.max(1, m.crownRadius);
  const puffs = puffsFromPoints(pts, { cell: R * (sp === 'birch' ? 0.5 : 0.6), grow: 0.82, max: sp === 'birch' ? 12 : 16, minR: R * 0.28 });
  const ys = pts.map((p) => p.y);
  console.log(k, 'H', m.height.toFixed(1), 'crownR', m.crownRadius.toFixed(2), 'pts', pts.length, 'y', Math.min(...ys).toFixed(1), '..', Math.max(...ys).toFixed(1), 'puffs', puffs.length, puffs.slice(0, 3).map((p) => `${p.r.toFixed(1)}@${p.y.toFixed(1)}`).join(' '));
}
