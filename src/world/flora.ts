// Planting: decides where every tree, bush, rock, log, mushroom cluster, flower drift, grass clump
// and bit of forest-floor litter goes, then draws each variety as one instanced mesh.
// [world3] The woods are borrowed from BUSHED (the owner's lumberjack game) and restyled in the calm palette:
// procedural low-poly oaks, birches, spruces and firs with root flare, curved limbs and V-folded foliage
// cards painted from Poly Haven twig scans (woods.ts); shrubs, ferns, cattails, lily pads, moss cushions and
// mushroom clusters from its ground-cover prototypes; Poly Haven boulders, stumps, a fallen trunk and bark
// debris (BUSHED's conversions, public/models/world). Flowers and grass grow in the instanced grass field
// (grass.ts, now painted from BUSHED's ground-cover atlas). setSeason() dresses everything for the year.
import * as THREE from 'three';
import { hash, rng, type Rng } from '../gfx/noise.ts';
import type { SeasonInfo } from './astro.ts';
import { loadKit } from './forestkit.ts';
import { clearing, groundY, HALF, houseD, inGarden, pathD, POND, pondD, SEED, type Collider } from './layout.ts';
import { FG, grassReady, type GrassItem } from './grass.ts';
import { LT, Litter, litterReady, type LitterItem } from './litter.ts';
import { SURFACE_Y, surfaceY } from './terrain.ts';
import { mossMat, treeMaterials, treeProto, vegMat, vegProto, type VegKind } from './woods.ts';
import type { SpeciesId } from './bushed/species.ts';

interface Spot { x: number; y: number; z: number; yaw: number; s: number; tint?: number }
export interface LeafSource { x: number; y: number; z: number; r: number; color: number }

export interface ForestPlan {
  lists: Map<string, Spot[]>;
  colliders: Collider[];
  shade: Collider[];
  leafSources: LeafSource[];
  /** places an animal might wander to: flower patches, the shore, logs */
  flowers: { x: number; z: number }[];
  perches: THREE.Vector3[];
  seats: { x: number; y: number; z: number; rot: number }[];
  /** the instanced grass field: grasses, flowers, ferns, reeds */
  grass: GrassItem[];
  /** [world3] decals lying on the forest floor */
  litter: LitterItem[];
}

/** [world3] tree kinds: species, prototype seeds, age (shape) and the base height in blocks. */
const TREES: Record<string, { species: SpeciesId; seeds: number[]; age: number; h: number }> = {
  oak1: { species: 'oak', seeds: [5, 9], age: 0.55, h: 5.6 }, oak2: { species: 'oak', seeds: [14, 23], age: 0.6, h: 6.0 }, oak3: { species: 'oak', seeds: [31], age: 0.5, h: 5.2 },
  maple: { species: 'oak', seeds: [21], age: 0.5, h: 5.0 },
  birch1: { species: 'birch', seeds: [3, 7], age: 0.5, h: 6.4 }, birch2: { species: 'birch', seeds: [11], age: 0.45, h: 5.8 },
  blossom: { species: 'birch', seeds: [17], age: 0.4, h: 5.0 },
  pine1: { species: 'spruce', seeds: [2, 6], age: 0.45, h: 7.4 }, pine2: { species: 'fir', seeds: [4, 8], age: 0.5, h: 6.8 },
  sapling: { species: 'fir', seeds: [30], age: 0.16, h: 2.4 },
};
/** [world3] everything else that is instanced: a veg prototype or a model, and its metres-to-blocks scale. */
const SMALL: Record<string, { veg?: VegKind; model?: string; seeds?: number[]; scale: number; shadow?: boolean }> = {
  bush: { veg: 'alder', seeds: [1, 2], scale: 1.1, shadow: true }, bushBerry: { veg: 'blueberry', seeds: [3, 4], scale: 2.3 }, bushFlower: { veg: 'raspberry', seeds: [5], scale: 2.0 },
  fern: { veg: 'swordFern', seeds: [1, 2], scale: 1.35 }, ostrich: { veg: 'ostrich', seeds: [3], scale: 1.2 }, bracken: { veg: 'bracken', seeds: [4], scale: 1.4 },
  cattails: { veg: 'cattails', seeds: [1, 2], scale: 0.8 }, lilies: { veg: 'lilies', seeds: [1, 2, 3], scale: 2.2 },
  toadstool: { veg: 'agaric', seeds: [1, 2], scale: 3.2 }, bolete: { veg: 'bolete', seeds: [3], scale: 3.2 }, chanterelle: { veg: 'chanterelle', seeds: [4], scale: 3.6 },
  glow: { veg: 'puffball', seeds: [5], scale: 3.4 }, honey: { veg: 'honey', seeds: [6], scale: 3.4 }, cones: { veg: 'cones', seeds: [7], scale: 3.0 },
  moss: { veg: 'moss', seeds: [1, 2], scale: 1.8 },
  rock1: { model: 'boulder_01', scale: 0.85, shadow: true }, rock2: { model: 'rock_07', scale: 2.8, shadow: true },
  stump: { model: 'tree_stump_01', scale: 1.05, shadow: true }, stump2: { model: 'tree_stump_02', scale: 1.05, shadow: true },
  log: { model: 'dead_tree_trunk', scale: 1.0, shadow: true }, debris: { model: 'bark_debris_01', scale: 0.8 },
};
const MUSHROOMS = new Set(['toadstool', 'bolete', 'chanterelle', 'glow', 'honey']);
// leaf colours for the falling-leaf particles
const LEAF_COLOR: Record<string, number> = { oak1: 0x66844f, oak2: 0x5c7845, oak3: 0x718a52, birch1: 0x8fa66a, birch2: 0x8fa66a, blossom: 0xe2bab8, maple: 0xa6644d };
/** grass-field flowers each drift is made of */
const DRIFT_CELLS: Record<string, number[]> = {
  daisy: [FG.daisy, FG.daisy, FG.mid], buttercup: [FG.buttercup, FG.buttercup, FG.short], forgetme: [FG.forgetme, FG.forgetme, FG.short],
  campion: [FG.campion, FG.mid, FG.campion], bluebell: [FG.bluebell, FG.bluebell, FG.shade], violet: [FG.violet, FG.violet, FG.short],
  primrose: [FG.primrose, FG.primrose, FG.short], anemone: [FG.anemone, FG.anemone, FG.shade], foxglove: [FG.foxglove, FG.mid, FG.tall],
  garlic: [FG.garlic, FG.garlic, FG.shade],
};

export function planForest(quality: 'low' | 'high'): ForestPlan {
  const r = rng(SEED);
  const lists = new Map<string, Spot[]>();
  const put = (kind: string, x: number, z: number, s = 1, yaw = r.range(0, Math.PI * 2), y = surfaceY(x, z), tint?: number) => {
    if (!lists.has(kind)) lists.set(kind, []);
    lists.get(kind)!.push({ x, y, z, yaw, s, tint });
  };
  const colliders: Collider[] = [], shade: Collider[] = [], leafSources: LeafSource[] = [], trunks: (Collider & { kind: string })[] = [];
  const flowers: { x: number; z: number }[] = [], perches: THREE.Vector3[] = [], seats: ForestPlan['seats'] = [];
  const grass: GrassItem[] = [], litter: LitterItem[] = [];
  const dry = (x: number, z: number, pond = 1.25, path = 1.0) => pondD(x, z) > pond && pathD(x, z) > path && houseD(x, z) > 1.2 && Math.abs(x) < HALF - 1 && Math.abs(z) < HALF - 1;
  const nearTrunk = (x: number, z: number, d: number) => trunks.some((t) => Math.hypot(t.x - x, t.z - z) < d);
  const lit = (cell: number, x: number, z: number, size: number, o: Partial<LitterItem> = {}) => {
    if (Math.abs(x) > HALF - 0.6 || Math.abs(z) > HALF - 0.6) return;
    litter.push({ x, y: o.y ?? surfaceY(x, z), z, rot: o.rot ?? r.range(0, Math.PI * 2), size, cell, tint: o.tint ?? r.range(0.88, 1.08), group: o.group ?? 0 });
  };
  const grassAt = (cell: number, x: number, z: number, size: number, tint = 1) => grass.push({ x, y: surfaceY(x, z), z, rot: r.range(0, Math.PI), size, cell, tint });

  const tree = (kind: string, x: number, z: number, s: number) => {
    put(kind, x, z, s);
    trunks.push({ x, z, r: 0.5 * s, kind });
    const cr = (kind.startsWith('pine') ? 1.6 : kind.startsWith('birch') ? 1.6 : kind === 'blossom' ? 1.8 : 2.6) * s;
    shade.push({ x: x + 0.5, z: z - 0.3, r: cr * 1.15 });
    if (Math.hypot(x, z) < 13.5) colliders.push({ x, z, r: 0.55 * s });
    if (LEAF_COLOR[kind] && Math.hypot(x, z) < 16) leafSources.push({ x, y: surfaceY(x, z) + 4.2 * s, z, r: cr, color: LEAF_COLOR[kind] });
  };

  // feature trees around the clearing, then the forest proper on a jittered grid
  tree('oak1', -9.4, -6.8, 1.3); tree('blossom', 8.2, -7.2, 1.15); tree('birch1', -12.6, 1.2, 1.1); tree('oak3', 11.8, -2.6, 1.2); tree('maple', -6.2, -11.2, 1.1); tree('oak2', 14.6, 6.4, 1.2); tree('birch2', -14.2, 7.2, 1.1); tree('pine1', 5.2, -12.4, 1.2);
  for (let gz = -23; gz < 23; gz += 3) for (let gx = -23; gx < 23; gx += 3) {
    const x = gx + r.range(0.2, 2.6), z = gz + r.range(0.2, 2.6);
    if (clearing(x, z) > 0.04 || !dry(x, z, 1.5, 1.6) || nearTrunk(x, z, 2.6) || r.chance(0.08)) continue;
    // keep the wedge between the camera and the clearing free of tall trees
    if (z > 7 && Math.abs(x) < (z - 7) * 1.25 + 9) continue;
    const far = Math.hypot(x, z) > 16.5, k = r();
    const kind = far ? (k < 0.55 ? r.pick(['pine1', 'pine2']) : k < 0.85 ? r.pick(['oak1', 'oak2', 'oak3']) : 'birch1')
      : (k < 0.42 ? r.pick(['oak1', 'oak2', 'oak3']) : k < 0.66 ? r.pick(['birch1', 'birch2']) : k < 0.8 ? 'pine2' : k < 0.88 ? 'maple' : k < 0.94 ? 'blossom' : 'sapling');
    tree(kind, x, z, far ? r.range(1.05, 1.35) : r.range(0.9, 1.2));
  }

  // fallen trunk, stumps
  put('log', 1.2, 2.6, 1.0, 0.1); colliders.push({ x: 1.2, z: 2.6, r: 0.95 }, { x: 0.3, z: 2.7, r: 0.7 }, { x: 2.1, z: 2.5, r: 0.7 });
  seats.push({ x: 1.2, y: 0.5, z: 2.6, rot: 0 }); perches.push(new THREE.Vector3(1.2, 0.52, 2.6));
  ([[-10.6, -1.4, 'stump'], [9.6, -5.2, 'stump2']] as const).forEach(([x, z, k]) => { put(k, x, z, 1.0); colliders.push({ x, z, r: 0.6 }); seats.push({ x, y: 0.6, z, rot: Math.atan2(-x, -z) }); perches.push(new THREE.Vector3(x, 0.6, z)); });

  for (let i = 0; i < 90; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(8.2, 22), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (clearing(x, z) > 0.7 || !dry(x, z, 1.3, 1.15) || nearTrunk(x, z, 1.1)) continue;
    put(r() < 0.45 ? 'bush' : r() < 0.55 ? 'bushBerry' : 'bushFlower', x, z, r.range(0.8, 1.3));
    if (d < 13) colliders.push({ x, z, r: 0.55 });
  }
  const rocks: { x: number; z: number; s: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(7.5, 22), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!dry(x, z, 1.2, 1.1) || nearTrunk(x, z, 0.9) || inGarden(x, z, -0.6)) continue;
    const s = r.range(0.7, 1.3), big = r.chance(0.45);
    put(big ? 'rock1' : 'rock2', x, z, s);
    rocks.push({ x, z, s });
    if (d < 13) { colliders.push({ x, z, r: 0.6 }); perches.push(new THREE.Vector3(x, surfaceY(x, z) + (big ? 0.85 : 0.45) * s, z)); }
  }
  // stones and cattails round the shore, lily pads on the water
  for (let i = 0; i < 30; i++) {
    const a = r.range(0, Math.PI * 2);
    const at = (k: number): [number, number] => [POND.x + Math.cos(a) * POND.rx * 1.05 * k, POND.z + Math.sin(a) * POND.rz * 1.05 * k];
    const kind = i % 3;
    if (kind === 0) { const [x, z] = at(1.16); if (pathD(x, z) > 1.2 && pondD(x, z) > 1.05) put('rock2', x, z, r.range(0.35, 0.6)); }
    else if (kind === 1 && i < 22) { const [x, z] = at(r.range(0.25, 0.72)); put('lilies', x, z, r.range(0.8, 1.15), undefined, SURFACE_Y + 0.01); }
    else { const [x, z] = at(r.range(0.98, 1.1)); if (pathD(x, z) > 1.0) put('cattails', x, z, r.range(0.85, 1.2), undefined, Math.max(SURFACE_Y - 0.1, surfaceY(x, z))); }
  }

  // mushrooms cluster in the shade near trunks, on moss; a fairy ring of toadstools in the open
  for (let i = 0; i < 26; i++) {
    const t = r.pick(trunks.filter((t) => Math.hypot(t.x, t.z) < 17));
    const a = r.range(0, Math.PI * 2), d = r.range(0.9, 1.6), cx = t.x + Math.cos(a) * d, cz = t.z + Math.sin(a) * d;
    if (!dry(cx, cz, 1.2, 0.9) || groundY(cx, cz) < 0) continue;
    const kind = r.pick(['toadstool', 'toadstool', 'bolete', 'chanterelle', 'honey', 'bolete', 'glow']);
    put(kind, cx, cz, r.range(0.8, 1.1));
    put('moss', cx + r.range(-0.3, 0.3), cz + r.range(-0.3, 0.3), r.range(0.7, 1.1));
  }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; put(i % 3 ? 'toadstool' : 'glow', 5.4 + Math.cos(a) * 1.25, -2.6 + Math.sin(a) * 1.25, r.range(0.6, 0.8), a); }

  // flowers grow in drifts of one kind, in the grass field
  const drift = (kind: string, cx: number, cz: number, n: number, rad: number) => {
    flowers.push({ x: cx, z: cz });
    const cells = DRIFT_CELLS[kind] ?? DRIFT_CELLS.daisy;
    for (let i = 0; i < n; i++) {
      const a = r.range(0, Math.PI * 2), d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (dry(x, z, 1.18, 0.75) && groundY(x, z) >= 0 && !nearTrunk(x, z, 0.6) && !inGarden(x, z, 0.4)) grassAt(cells[i % cells.length], x, z, r.range(0.6, 0.95), r.range(0.92, 1.08));
    }
  };
  const driftKinds = Object.keys(DRIFT_CELLS);
  const fixed: [string, number, number][] = [['daisy', -6.4, -2.6], ['campion', 3.6, 6.2], ['violet', -8.2, 7.6], ['buttercup', 4.4, -0.4], ['bluebell', -5.6, -6.2], ['primrose', -3.4, 0.4], ['daisy', 9.6, -0.6], ['foxglove', -3.8, 8.6], ['forgetme', 10.6, 6.6], ['daisy', 5.2, 8.4]];
  fixed.push(['forgetme', -1.6, 6.4], ['buttercup', 6.8, -4.6], ['anemone', 2.6, -1.2], ['buttercup', -9.4, 2.4], ['foxglove', -6.8, -3.4]);
  for (const [k, x, z] of fixed) drift(k, x, z, quality === 'high' ? 26 : 14, 1.8);
  for (let i = 0; i < 18; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(9.5, 17);
    drift(r.pick(driftKinds), Math.cos(a) * d, Math.sin(a) * d, quality === 'high' ? 16 : 9, 1.6);
  }

  // ferns in the shade round the trunks, moss cushions, bark debris and fallen cones
  for (let i = 0; i < (quality === 'high' ? 70 : 40); i++) {
    const t = r.pick(trunks), a = r.range(0, Math.PI * 2), d = r.range(0.9, 2.2), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
    if (!dry(x, z, 1.2, 1) || clearing(x, z) > 0.6) continue;
    const k = r();
    put(k < 0.45 ? 'fern' : k < 0.65 ? 'ostrich' : k < 0.8 ? 'bracken' : k < 0.9 ? 'moss' : t.kind.startsWith('pine') ? 'cones' : 'debris', x, z, r.range(0.8, 1.2));
  }
  for (let i = 0; i < 80; i++) {
    const x = r.range(-13, 13), z = r.range(-13, 13);
    if (dry(x, z, 1.2, 1) && groundY(x, z) >= 0) grassAt(FG.clover, x, z, r.range(0.5, 0.75));
  }

  // ---- the forest floor: what falls from each tree lies under it
  for (const t of trunks) {
    if (Math.hypot(t.x, t.z) > 21) continue;
    const pine = t.kind.startsWith('pine'), n = quality === 'high' ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const a = r.range(0, Math.PI * 2), d = r.range(0.6, 2.6) * (t.r * 1.6 + 0.4), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (!dry(x, z, 1.1, 0.5)) continue;
      const k = r();
      if (pine) lit(k < 0.6 ? LT.needles : LT.twig, x, z, r.range(0.6, 0.9));
      else if (k < 0.55) lit(r.pick([LT.leaves, LT.leaves2, LT.leafdry]), x, z, r.range(0.7, 1.0), { group: 1 });
      else if (k < 0.8) lit(r.pick([LT.twig, LT.twigs]), x, z, r.range(0.6, 0.9));
      else lit(LT.moss, x, z, r.range(0.6, 0.9));
    }
    if (t.kind === 'blossom') for (let i = 0; i < 10; i++) { const a = r.range(0, Math.PI * 2), d = r.range(0.5, 3); lit(LT.petals, t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, r.range(0.5, 0.8), { group: 2 }); }
  }
  for (const k of rocks) for (let i = 0; i < 2; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(0.6, 1.0) * k.s, x = k.x + Math.cos(a) * d, z = k.z + Math.sin(a) * d;
    if (dry(x, z, 1.1, 0.6)) { if (i) lit(LT.pebbles, x, z, r.range(0.5, 0.8)); else put('moss', x, z, r.range(0.6, 0.9)); }
  }
  for (let i = 0; i < (quality === 'high' ? 300 : 160); i++) {
    const x = r.range(-15, 15), z = r.range(-15, 24);
    const p = pathD(x, z);
    if (p > 1.15 || pondD(x, z) < 1.1 || houseD(x, z) < 0.6 || Math.abs(z) > HALF - 1) continue;
    if (p > 0.55) lit(r.pick([LT.gravel, LT.pebbles, LT.twig, LT.leafdry]), x, z, r.range(0.4, 0.65));
  }
  for (let i = 0; i < (quality === 'high' ? 200 : 100); i++) {
    const x = r.range(-20, 20), z = r.range(-20, 20);
    if (!dry(x, z, 1.15, 0.7) || inGarden(x, z, -0.3)) continue;
    const k = r();
    lit(k < 0.55 ? r.pick([LT.leaves, LT.leaves2, LT.leafdry]) : k < 0.8 ? LT.twig : LT.clover, x, z, r.range(0.5, 0.85), { group: k < 0.55 ? 1 : 0 });
  }

  // grass: the instanced field. Lush meadow in the clearing (with wildflowers), woodland plants in the
  // shade, reeds round the pond, short tufts along the paths.
  const want = quality === 'high' ? 8000 : 3400;
  const meadowCells = [FG.short, FG.mid, FG.mid, FG.tall, FG.short, FG.mid, FG.clover, FG.daisy, FG.buttercup, FG.forgetme, FG.campion, FG.seed, FG.sorrel];
  const woodCells = [FG.shade, FG.shade, FG.mid, FG.fern, FG.bracken, FG.moss, FG.litter, FG.woodrush, FG.violet, FG.primrose, FG.garlic, FG.bluebell, FG.anemone, FG.strawberry];
  for (let i = 0, placed = 0; i < want * 4 && placed < want; i++) {
    const x = r.range(-21, 21), z = r.range(-21, 21);
    const pd = pondD(x, z), path = pathD(x, z);
    if (pd < 1.0 || houseD(x, z) < 0.35 || Math.abs(x) > HALF - 1.5 || Math.abs(z) > HALF - 1.5) continue;
    const open = clearing(x, z), lawn = inGarden(x, z, 0.2);
    let cell: number, size: number;
    if (pd < 1.35) { cell = r.chance(0.6) ? FG.reed : r.chance(0.5) ? FG.cattail : FG.tall; size = r.range(0.8, 1.2); }
    else if (path < 0.62) { if (r.chance(0.85)) continue; cell = FG.short; size = r.range(0.35, 0.5); }
    else if (path < 1.05) { cell = r.chance(0.6) ? FG.short : r.chance(0.5) ? FG.seed : FG.dry; size = r.range(0.45, 0.65); }
    else if (lawn) { cell = r.chance(0.85) ? FG.short : FG.clover; size = r.range(0.4, 0.55); }
    else if (houseD(x, z) < 1.4) { cell = r.pick([FG.moss, FG.fern, FG.shade, FG.litter, FG.primrose]); size = r.range(0.5, 0.8); }
    else if (r() < open) { cell = r.pick(meadowCells); size = r.range(0.65, 1.05); }
    else { if (r.chance(0.25)) continue; cell = r.pick(woodCells); size = r.range(0.6, 1.0); }
    const t = r();
    grass.push({ x, y: surfaceY(x, z), z, rot: r.range(0, Math.PI), size, cell, tint: t < 0.25 ? 1.08 : t < 0.7 ? 1 : 0.9 });
    placed++;
  }
  return { lists, colliders, shade, leafSources, flowers, perches, seats, grass, litter };
}

export interface Flora {
  group: THREE.Group;
  litter: Litter;
  /** [world] dress the forest for a season */
  setSeason(info: SeasonInfo): void;
  /** [world3] resolves when the borrowed models are in */
  ready: Promise<unknown>;
  /** [world3] night (0..1): the pale puffballs catch the moonlight */
  setNight(k: number): void;
  /** [world3] counts for the dev page */
  stats: { trees: number; tris: number };
  dispose(): void;
}

// ---------------------------------------------------------------- seasons

const H = (i: number, k: number) => hash(i, k, 0, 4242);
/** Foliage tints per season (multiplied over the painted cards), from the calm palette. */
const SEASON_TINT: Record<string, { spring: number; summer: number; autumn: number[]; winter: number | null }> = {
  oak: { spring: 0xd8ecb8, summer: 0xffffff, autumn: [0xe8c27a, 0xd89a5e, 0xf0d08a, 0xc4885c], winter: null },
  maple: { spring: 0xe8d0b0, summer: 0xf4e8d8, autumn: [0xd8805e, 0xe0966a, 0xc87058], winter: null },
  birch: { spring: 0xe4f2c0, summer: 0xffffff, autumn: [0xf6dc86, 0xeccb70, 0xf8e49a], winter: null },
  blossom: { spring: 0xf6d6d4, summer: 0xffffff, autumn: [0xe8b874, 0xdc9e66], winter: null },
  spruce: { spring: 0xf0fff0, summer: 0xffffff, autumn: [0xf2f2e6], winter: 0xd8e2e0 },
  fir: { spring: 0xf0fff0, summer: 0xffffff, autumn: [0xf2f2e6], winter: 0xd8e2e0 },
  bush: { spring: 0xe8f6d0, summer: 0xffffff, autumn: [0xe8b070, 0xf0cc80, 0xd89a68], winter: 0xbcae98 },
};
const tintKey = (kind: string) => (kind === 'maple' ? 'maple' : kind === 'blossom' ? 'blossom' : kind.startsWith('oak') ? 'oak' : kind.startsWith('birch') ? 'birch' : kind === 'pine1' ? 'spruce' : kind === 'pine2' || kind === 'sapling' ? 'fir' : 'bush');
const DECIDUOUS = new Set(['oak1', 'oak2', 'oak3', 'maple', 'birch1', 'birch2', 'blossom']);

interface TreeSet { kind: string; foliage: THREE.InstancedMesh[]; idx: number[][] }

export function buildFlora(plan: ForestPlan, quality: 'low' | 'high' = 'high'): Flora {
  const group = new THREE.Group();
  group.name = 'flora';
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const stats = { trees: 0, tris: 0 };
  const make = (geo: THREE.BufferGeometry, mat: THREE.Material, depth: THREE.Material | undefined, spots: Spot[], scale: (s: Spot) => [number, number, number], shadow: boolean, name: string, colors = false) => {
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    mesh.name = name; mesh.castShadow = shadow; mesh.receiveShadow = true;
    if (depth) mesh.customDepthMaterial = depth;
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.yaw);
      const [sx, sy, sz] = scale(s);
      m.compose(pv.set(s.x, s.y, s.z), q, sv.set(sx, sy, sz));
      mesh.setMatrixAt(i, m);
      if (colors) mesh.setColorAt(i, c.setRGB(1, 1, 1));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    stats.tris += (geo.index ? geo.index.count / 3 : 0) * spots.length;
    return mesh;
  };

  // ---- trees: per kind and prototype seed, the near ones in full detail and the rest at the reduced LOD
  const sets: TreeSet[] = [];
  for (const [kind, list] of plan.lists) {
    const T = TREES[kind];
    if (!T) continue;
    const set: TreeSet = { kind, foliage: [], idx: [] };
    const mats = treeMaterials(T.species);
    T.seeds.forEach((seed, vi) => {
      for (const near of [true, false]) {
        const ids: number[] = [];
        list.forEach((s, i) => { if (i % T.seeds.length === vi && (quality === 'high' && Math.hypot(s.x, s.z) < 12.8) === near) ids.push(i); });
        if (!ids.length) continue;
        const proto = treeProto(T.species, seed, T.age, near);
        const lod = near ? proto.lod0 : proto.lod1;
        const spots = ids.map((i) => list[i]);
        const sc = (s: Spot): [number, number, number] => { const k = (T.h * s.s) / proto.height; return [k, k, k]; };
        make(lod.bark, mats.bark, mats.barkDepth, spots, sc, true, `${kind}:${seed}:bark`);
        if (lod.foliage) { set.foliage.push(make(lod.foliage, mats.foliage, mats.foliageDepth, spots, sc, true, `${kind}:${seed}:leaves`, true)); set.idx.push(ids); }
        stats.trees += spots.length;
      }
    });
    sets.push(set);
  }

  // ---- shrubs, ferns, cattails, lily pads, mushrooms, moss: BUSHED ground-cover prototypes on the veg atlas
  const veg = vegMat(), small = new Map<string, THREE.InstancedMesh[]>(), shrubs: THREE.InstancedMesh[] = [];
  const glows: THREE.MeshStandardMaterial[] = [];
  for (const [kind, list] of plan.lists) {
    const S = SMALL[kind];
    if (!S?.veg) continue;
    const seeds = S.seeds ?? [1];
    seeds.forEach((seed, vi) => {
      const spots = list.filter((_, i) => i % seeds.length === vi);
      if (!spots.length) return;
      const p = vegProto(S.veg!, seed);
      const sc = (s: Spot): [number, number, number] => [S.scale * s.s, S.scale * s.s, S.scale * s.s];
      const mat = S.veg === 'moss' ? mossMat() : kind === 'glow' ? glowMat(veg.mat, glows) : veg.mat;
      const mesh = make(p.leaves, mat, S.veg === 'moss' ? undefined : veg.depth, spots, sc, !!S.shadow, `${kind}:${seed}`, kind.startsWith('bush'));
      if (p.wood) make(p.wood, treeMaterials('birch').bark, treeMaterials('birch').barkDepth, spots, sc, !!S.shadow, `${kind}:${seed}:wood`);
      if (!small.has(kind)) small.set(kind, []);
      small.get(kind)!.push(mesh);
      if (kind.startsWith('bush')) shrubs.push(mesh);
    });
  }

  // ---- Poly Haven rocks, stumps, the fallen trunk and bark debris (BUSHED's conversions)
  const jobs: Promise<unknown>[] = [];
  for (const [kind, list] of plan.lists) {
    const S = SMALL[kind];
    if (!S?.model) continue;
    jobs.push(loadKit(S.model, { sway: 0 }).then((k) => {
      if (!k.wood) return;
      // the kit loader works in 1/16 units; these models are in metres
      const base = 16 * S.scale;
      const sc = (s: Spot): [number, number, number] => kind === 'log' ? [base * 0.72, base * 1.8, base * 1.8] : [base * s.s, base * s.s, base * s.s];
      const mat = k.wood.mat as THREE.MeshLambertMaterial;
      mat.side = THREE.FrontSide; mat.alphaTest = 0;
      make(k.wood.geo, mat, undefined, list, sc, !!S.shadow, kind);
    }));
  }

  const litter = new Litter(plan.litter);
  group.add(litter.group);
  const ready = Promise.allSettled([...jobs, grassReady, litterReady]).then((res) => { for (const x of res) if (x.status === 'rejected') console.warn('[world] forest model failed', x.reason); });

  function setSeason(info: SeasonInfo) {
    const s = info.season, late = s === 'autumn' ? Math.max(0, (info.t - 0.45) / 0.55) : 0, early = s === 'autumn' ? Math.max(0, 1 - info.t / 0.3) : 0;
    for (const set of sets) {
      const T = SEASON_TINT[tintKey(set.kind)];
      const bare = DECIDUOUS.has(set.kind) && s === 'winter';
      set.foliage.forEach((mesh, mi) => {
        mesh.visible = !bare;
        set.idx[mi].forEach((gi, i) => {
          let tint: number;
          if (s === 'spring') tint = T.spring;
          else if (s === 'summer') tint = T.summer;
          else if (s === 'autumn') {
            const green = H(gi, set.kind.length) < early * 0.7;
            tint = green ? T.summer : T.autumn[Math.floor(H(gi, 7) * T.autumn.length)];
            if (late > 0 && !green) tint = new THREE.Color(tint).lerp(new THREE.Color(0xb08a68), late * 0.4 * H(gi, 9)).getHex();
          } else tint = T.winter ?? 0xffffff;
          // a little per-tree variety keeps the forest from looking cloned
          c.setHex(tint).multiplyScalar(0.93 + H(gi, 3) * 0.12);
          mesh.setColorAt(i, c);
        });
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      });
    }
    const B = SEASON_TINT.bush;
    for (const mesh of shrubs) {
      for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, c.setHex(s === 'spring' ? B.spring : s === 'summer' ? B.summer : s === 'autumn' ? B.autumn[Math.floor(H(i, 5) * B.autumn.length)] : B.winter!));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    litter.setSeason(info);
    // mushrooms love autumn and hide from winter; ferns die back; lily pads sink under the ice
    for (const [kind, meshes] of small) for (const mesh of meshes) {
      const n = (mesh.userData.full ??= mesh.count) as number;
      let k = 1;
      if (MUSHROOMS.has(kind)) k = s === 'winter' ? 0.15 : s === 'spring' ? 0.5 : 1;
      else if (kind === 'fern' || kind === 'ostrich' || kind === 'bracken') k = s === 'winter' ? 0.3 : 1;
      else if (kind === 'lilies') k = s === 'winter' ? 0 : 1;
      mesh.count = Math.round(n * k);
      mesh.visible = mesh.count > 0;
    }
  }

  return {
    group, litter, setSeason, ready, stats,
    setNight(k: number) { for (const g of glows) g.emissive.setRGB(0.42, 0.45, 0.55).multiplyScalar(k * 0.6); },
    dispose() { litter.dispose(); group.traverse((o) => { const im = o as THREE.InstancedMesh; if (im.isInstancedMesh) im.dispose(); }); },
  };
}

/** The puffballs glow faintly at night: a copy of the veg material with an emissive map. */
function glowMat(base: THREE.MeshStandardMaterial, list: THREE.MeshStandardMaterial[]) {
  const m = base.clone();
  m.onBeforeCompile = base.onBeforeCompile;
  m.customProgramCacheKey = base.customProgramCacheKey;
  m.emissiveMap = base.map; m.emissive = new THREE.Color(0, 0, 0);
  list.push(m);
  return m;
}

export type { Rng };
