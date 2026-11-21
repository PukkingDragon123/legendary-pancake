// Planting: decides where every tree, bush, rock, log, mushroom cluster, flower drift, grass clump
// and bit of forest-floor litter goes, then draws each variety as one instanced mesh.
// [world3] Trees, bushes, stumps, logs, rocks and mushrooms are hand-made lowpix models
// (forestkit.ts: low poly with dense painted bark, moss and lichen) dressed in 2D pixel leaf cards
// (foliage.ts); flowers, ferns and clover grow in the Moleforge pixel-grass field; pebbles, twigs,
// cones, fallen leaves, moss cushions and lily pads lie on the ground as pixel decals (litter.ts).
// setSeason() dresses everything for the time of year.
import * as THREE from 'three';
import { hash, rng, type Rng } from '../gfx/noise.ts';
import type { SeasonInfo } from './astro.ts';
import { CELLS, Foliage, type CardLook } from './foliage.ts';
import { loadKit, SHAPES, type KitModel } from './forestkit.ts';
import { clearing, groundY, HALF, houseD, inGarden, pathD, POND, pondD, SEED, WATER_Y, type Collider } from './layout.ts';
import { FG, type GrassItem } from './grass.ts';
import { LT, Litter, type LitterItem } from './litter.ts';
import { SURFACE_Y } from './terrain.ts';

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
  /** the pixel-grass field (Moleforge style crossed quads), flowers and ferns included */
  grass: GrassItem[];
  /** [world3] pixel decals lying on the forest floor and the pond */
  litter: LitterItem[];
}

/** [world3] kind -> kit model id. Trees and bushes also carry leaf cards. */
const MODEL: Record<string, string> = {
  oak1: 'oak_a', oak2: 'oak_b', oak3: 'oak_b', birch1: 'birch', birch2: 'birch', pine1: 'pine_a', pine2: 'pine_b',
  blossom: 'blossom', maple: 'maple', sapling: 'sapling', bush: 'bush', bushBerry: 'bush', bushFlower: 'bush',
  rock1: 'rock_a', rock2: 'rock_b', log: 'log', stump: 'stump',
  toadstool: 'toadstools', bolete: 'boletes', chanterelle: 'chanterelles', glow: 'moonglow',
};
const PLANTS = new Set(['oak1', 'oak2', 'oak3', 'birch1', 'birch2', 'pine1', 'pine2', 'blossom', 'maple', 'sapling', 'bush', 'bushBerry', 'bushFlower']);
const MUSHROOMS = new Set(['toadstool', 'bolete', 'chanterelle', 'glow']);
const NO_SHADOW = new Set(['toadstool', 'bolete', 'chanterelle', 'glow']);
// leaf colours for the falling-leaf particles (palette greens, the blossom's rose)
const LEAF_COLOR: Record<string, number> = { oak1: 0x66844f, oak2: 0x5c7845, oak3: 0x718a52, birch1: 0x8fa66a, birch2: 0x8fa66a, blossom: 0xe2bab8, maple: 0xa6644d };
/** grass-atlas flowers each drift is made of */
const DRIFT_CELLS: Record<string, number[]> = {
  daisy: [FG.daisy, FG.daisy, FG.mid], buttercup: [FG.buttercup, FG.buttercup, FG.short], forgetme: [FG.forgetme, FG.forgetme, FG.short],
  campion: [FG.campion, FG.mid, FG.campion], bluebell: [FG.bluebell, FG.bluebell, FG.shade], violet: [FG.violet, FG.violet, FG.moss],
  primrose: [FG.primrose, FG.primrose, FG.short], anemone: [FG.anemone, FG.anemone, FG.shade], foxglove: [FG.foxglove, FG.mid, FG.tall],
  garlic: [FG.garlic, FG.garlic, FG.shade],
};

export function planForest(quality: 'low' | 'high'): ForestPlan {
  const r = rng(SEED);
  const lists = new Map<string, Spot[]>();
  const put = (kind: string, x: number, z: number, s = 1, yaw = r.range(0, Math.PI * 2), y = groundY(x, z), tint?: number) => {
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
    litter.push({ x, y: o.y ?? groundY(x, z), z, rot: o.rot ?? r.range(0, Math.PI * 2), size, cell, tint: o.tint ?? r.range(0.88, 1.08), group: o.group ?? 0 });
  };
  const grassAt = (cell: number, x: number, z: number, size: number, tint = 1) => grass.push({ x, y: groundY(x, z), z, rot: r.range(0, Math.PI), size, cell, tint });

  const tree = (kind: string, x: number, z: number, s: number) => {
    put(kind, x, z, s);
    trunks.push({ x, z, r: 0.5 * s, kind });
    const cr = (kind.startsWith('pine') ? 1.5 : kind.startsWith('birch') ? 1.5 : kind === 'blossom' ? 2.1 : 2.4) * s;
    shade.push({ x: x + 0.5, z: z - 0.3, r: cr * 1.15 });
    if (Math.hypot(x, z) < 13.5) colliders.push({ x, z, r: 0.55 * s });
    if (LEAF_COLOR[kind] && Math.hypot(x, z) < 16) leafSources.push({ x, y: groundY(x, z) + 4.2 * s, z, r: cr, color: LEAF_COLOR[kind] });
  };

  // feature trees around the clearing, then the forest proper on a jittered grid
  tree('oak1', -9.4, -6.8, 1.4); tree('blossom', 8.2, -7.2, 1.2); tree('birch1', -12.6, 1.2, 1.15); tree('oak3', 11.8, -2.6, 1.25); tree('maple', -6.2, -11.2, 1.1); tree('oak2', 14.6, 6.4, 1.25); tree('birch2', -14.2, 7.2, 1.15); tree('pine1', 5.2, -12.4, 1.3);
  for (let gz = -23; gz < 23; gz += 3) for (let gx = -23; gx < 23; gx += 3) {
    const x = gx + r.range(0.2, 2.6), z = gz + r.range(0.2, 2.6);
    if (clearing(x, z) > 0.04 || !dry(x, z, 1.5, 1.6) || nearTrunk(x, z, 2.6) || r.chance(0.08)) continue;
    // keep the wedge between the camera and the clearing free of tall trees
    if (z > 7 && Math.abs(x) < (z - 7) * 1.25 + 9) continue;
    const far = Math.hypot(x, z) > 16.5, k = r();
    const kind = far ? (k < 0.5 ? r.pick(['pine1', 'pine2']) : k < 0.85 ? r.pick(['oak1', 'oak2', 'oak3']) : 'birch1')
      : (k < 0.44 ? r.pick(['oak1', 'oak2', 'oak3']) : k < 0.66 ? r.pick(['birch1', 'birch2']) : k < 0.8 ? 'pine1' : k < 0.88 ? 'maple' : k < 0.94 ? 'blossom' : 'sapling');
    tree(kind, x, z, far ? r.range(1.1, 1.45) : r.range(0.9, 1.25));
  }

  // fallen log, stumps
  put('log', 1.2, 2.6, 1.0, 0.1); colliders.push({ x: 1.2, z: 2.6, r: 0.95 }, { x: 0.3, z: 2.7, r: 0.7 }, { x: 2.1, z: 2.5, r: 0.7 });
  seats.push({ x: 1.2, y: 0.66, z: 2.6, rot: 0 }); perches.push(new THREE.Vector3(1.2, 0.68, 2.6));
  for (const [x, z] of [[-10.6, -1.4], [9.6, -5.2]] as const) { put('stump', x, z, 1.0); colliders.push({ x, z, r: 0.5 }); seats.push({ x, y: 0.62, z, rot: Math.atan2(-x, -z) }); perches.push(new THREE.Vector3(x, 0.64, z)); }

  for (let i = 0; i < 90; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(8.2, 22), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (clearing(x, z) > 0.7 || !dry(x, z, 1.3, 1.15) || nearTrunk(x, z, 1.1)) continue;
    put(r() < 0.55 ? 'bush' : r() < 0.5 ? 'bushBerry' : 'bushFlower', x, z, r.range(0.8, 1.35));
    if (d < 13) colliders.push({ x, z, r: 0.55 });
  }
  const rocks: { x: number; z: number; s: number }[] = [];
  for (let i = 0; i < 44; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(7.5, 22), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!dry(x, z, 1.2, 1.1) || nearTrunk(x, z, 0.9) || inGarden(x, z, -0.6)) continue;
    const s = r.range(0.7, 1.3);
    put(r.chance(0.5) ? 'rock1' : 'rock2', x, z, s);
    rocks.push({ x, z, s });
    if (d < 13) { colliders.push({ x, z, r: 0.6 }); perches.push(new THREE.Vector3(x, groundY(x, z) + 0.6 * s, z)); }
  }
  // stones round the shore, lily pads on the water
  for (let i = 0; i < 30; i++) {
    const a = r.range(0, Math.PI * 2);
    const at = (k: number): [number, number] => [POND.x + Math.cos(a) * POND.rx * 1.05 * k, POND.z + Math.sin(a) * POND.rz * 1.05 * k];
    const kind = i % 3;
    if (kind === 0) { const [x, z] = at(1.16); if (pathD(x, z) > 1.2 && pondD(x, z) > 1.05) { const s = r.range(0.32, 0.55); put('rock2', x, z, s); } }
    else if (kind === 1 && i < 24) { const [x, z] = at(r.range(0.25, 0.75)); lit(r.pick([LT.lily, LT.lily, LT.lilies, LT.lotus]), x, z, r.range(0.55, 0.85), { y: SURFACE_Y + 0.012 }); }
    else { const [x, z] = at(1.2); if (pondD(x, z) > 1.12 && pathD(x, z) > 0.8) lit(r.pick([LT.pebbles, LT.gravel]), x, z, r.range(0.5, 0.8)); }
  }

  // mushrooms cluster in the shade near trunks; a fairy ring of toadstools in the open
  for (let i = 0; i < 24; i++) {
    const t = r.pick(trunks.filter((t) => Math.hypot(t.x, t.z) < 17));
    const a = r.range(0, Math.PI * 2), d = r.range(0.9, 1.6), cx = t.x + Math.cos(a) * d, cz = t.z + Math.sin(a) * d;
    if (!dry(cx, cz, 1.2, 0.9) || groundY(cx, cz) < 0) continue;
    const kind = r.pick(['toadstool', 'toadstool', 'bolete', 'chanterelle', 'glow', 'bolete']);
    put(kind, cx, cz, r.range(0.75, 1.05));
    lit(LT.moss, cx + r.range(-0.3, 0.3), cz + r.range(-0.3, 0.3), r.range(0.7, 1.0));
  }
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; put(i % 3 ? 'toadstool' : 'glow', 5.4 + Math.cos(a) * 1.25, -2.6 + Math.sin(a) * 1.25, r.range(0.5, 0.7)); }

  // flowers grow in drifts of one kind, in the pixel-grass field
  const drift = (kind: string, cx: number, cz: number, n: number, rad: number) => {
    flowers.push({ x: cx, z: cz });
    const cells = DRIFT_CELLS[kind] ?? DRIFT_CELLS.daisy;
    for (let i = 0; i < n; i++) {
      const a = r.range(0, Math.PI * 2), d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (dry(x, z, 1.18, 0.75) && groundY(x, z) >= 0 && !nearTrunk(x, z, 0.6) && !inGarden(x, z, 0.4)) grassAt(cells[i % cells.length], x, z, r.range(0.55, 0.9), r.range(0.92, 1.08));
    }
  };
  const driftKinds = Object.keys(DRIFT_CELLS);
  const fixed: [string, number, number][] = [['daisy', -6.4, -2.6], ['campion', 3.6, 6.2], ['violet', -8.2, 7.6], ['buttercup', 4.4, -0.4], ['bluebell', -5.6, -6.2], ['primrose', -3.4, 0.4], ['daisy', 9.6, -0.6], ['foxglove', -3.8, 8.6], ['forgetme', 10.6, 6.6], ['daisy', 5.2, 8.4]];
  fixed.push(['forgetme', -1.6, 6.4], ['buttercup', 6.8, -4.6], ['anemone', 2.6, -1.2], ['buttercup', -9.4, 2.4], ['foxglove', -6.8, -3.4]);
  for (const [k, x, z] of fixed) drift(k, x, z, quality === 'high' ? 30 : 16, 1.8);
  for (let i = 0; i < 18; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(9.5, 17);
    drift(r.pick(driftKinds), Math.cos(a) * d, Math.sin(a) * d, quality === 'high' ? 18 : 10, 1.6);
  }

  // ferns and woodland plants in the shade round the trunks, clover in the open
  for (let i = 0; i < 110; i++) {
    const t = r.pick(trunks), a = r.range(0, Math.PI * 2), d = r.range(0.8, 2.2), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
    if (dry(x, z, 1.2, 1) && clearing(x, z) < 0.6) grassAt(r.chance(0.7) ? FG.fern : FG.bracken, x, z, r.range(0.9, 1.5), r.range(0.9, 1.06));
  }
  for (let i = 0; i < 80; i++) {
    const x = r.range(-13, 13), z = r.range(-13, 13);
    if (dry(x, z, 1.2, 1) && groundY(x, z) >= 0) grassAt(FG.clover, x, z, r.range(0.5, 0.75));
  }

  // ---- the forest floor, placed with care: what falls from each tree lies under it
  for (const t of trunks) {
    if (Math.hypot(t.x, t.z) > 21) continue;
    const pine = t.kind.startsWith('pine'), oakish = t.kind.startsWith('oak'), n = quality === 'high' ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const a = r.range(0, Math.PI * 2), d = r.range(0.6, 2.6) * (t.r * 1.6 + 0.4), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (!dry(x, z, 1.1, 0.5)) continue;
      const k = r();
      if (pine) lit(k < 0.45 ? LT.cone : k < 0.8 ? LT.needles : LT.twig, x, z, r.range(0.45, 0.7));
      else if (oakish && k < 0.25) lit(LT.acorns, x, z, r.range(0.4, 0.55));
      else if (k < 0.45) lit(r.pick([LT.leaves, LT.leaves2, LT.leafdry]), x, z, r.range(0.6, 0.95), { group: 1 });
      else if (k < 0.7) lit(r.pick([LT.twig, LT.twigs]), x, z, r.range(0.55, 0.85));
      else if (k < 0.85) lit(LT.moss, x, z, r.range(0.6, 0.95));
      else lit(LT.leaves, x, z, r.range(0.6, 0.9), { group: 1 });
    }
    if (t.kind === 'blossom') for (let i = 0; i < 10; i++) { const a = r.range(0, Math.PI * 2), d = r.range(0.5, 3); lit(LT.petals, t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, r.range(0.5, 0.8), { group: 2 }); }
  }
  // moss cushions and pebbles round the rocks, gravel scattered along the path edges
  for (const k of rocks) for (let i = 0; i < 3; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(0.55, 1.0) * k.s, x = k.x + Math.cos(a) * d, z = k.z + Math.sin(a) * d;
    if (dry(x, z, 1.1, 0.6)) lit(i ? LT.pebbles : LT.moss, x, z, r.range(0.5, 0.8));
  }
  for (let i = 0; i < (quality === 'high' ? 420 : 220); i++) {
    const x = r.range(-15, 15), z = r.range(-15, 24);
    const p = pathD(x, z);
    if (p > 1.15 || pondD(x, z) < 1.1 || houseD(x, z) < 0.6 || Math.abs(z) > HALF - 1) continue;
    if (p < 0.55 && r.chance(0.22)) lit(r.pick([LT.stone, LT.stone2]), x, z, r.range(0.55, 0.8), { tint: r.range(0.9, 1.05) });
    else if (p > 0.6) lit(r.pick([LT.gravel, LT.gravel, LT.pebbles, LT.twig, LT.leafdry]), x, z, r.range(0.4, 0.65), { group: 0 });
  }
  // a scatter of leaves, twigs and the odd feather across the open ground
  for (let i = 0; i < (quality === 'high' ? 260 : 130); i++) {
    const x = r.range(-20, 20), z = r.range(-20, 20);
    if (!dry(x, z, 1.15, 0.7) || inGarden(x, z, -0.3)) continue;
    const k = r();
    lit(k < 0.5 ? r.pick([LT.leaves, LT.leaves2, LT.leafdry]) : k < 0.7 ? LT.twig : k < 0.9 ? LT.clover : k < 0.97 ? LT.gravel : LT.feather, x, z, r.range(0.45, 0.8), { group: k < 0.5 ? 1 : 0 });
  }

  // grass: Moleforge's crossed pixel-quad field. Lush meadow in the clearing (with wildflowers),
  // woodland plants in the shade, reeds round the pond, short tufts along the paths.
  const want = quality === 'high' ? 9000 : 3600;
  const meadowCells = [FG.short, FG.mid, FG.mid, FG.tall, FG.short, FG.mid, FG.clover, FG.daisy, FG.buttercup, FG.forgetme, FG.campion, FG.seed, FG.sorrel];
  const woodCells = [FG.shade, FG.shade, FG.mid, FG.fern, FG.bracken, FG.moss, FG.litter, FG.woodrush, FG.violet, FG.primrose, FG.garlic, FG.bluebell, FG.anemone, FG.strawberry];
  for (let i = 0, placed = 0; i < want * 4 && placed < want; i++) {
    const x = r.range(-21, 21), z = r.range(-21, 21);
    const pd = pondD(x, z), path = pathD(x, z);
    if (pd < 1.0 || houseD(x, z) < 0.35 || Math.abs(x) > HALF - 1.5 || Math.abs(z) > HALF - 1.5) continue;
    const open = clearing(x, z), lawn = inGarden(x, z, 0.2);
    let cell: number, size: number;
    if (pd < 1.35) { cell = r.chance(0.6) ? FG.reed : r.chance(0.5) ? FG.cattail : FG.tall; size = r.range(0.7, 1.15); }
    else if (path < 0.62) { if (r.chance(0.85)) continue; cell = FG.short; size = r.range(0.32, 0.45); }
    else if (path < 1.05) { cell = r.chance(0.6) ? FG.short : r.chance(0.5) ? FG.seed : FG.dry; size = r.range(0.42, 0.62); }
    else if (lawn) { cell = r.chance(0.85) ? FG.short : FG.clover; size = r.range(0.4, 0.55); }
    else if (houseD(x, z) < 1.4) { cell = r.pick([FG.moss, FG.fern, FG.shade, FG.litter, FG.primrose]); size = r.range(0.5, 0.8); }
    else if (r() < open) { cell = r.pick(meadowCells); size = r.range(0.6, 1.0); }
    else { if (r.chance(0.25)) continue; cell = r.pick(woodCells); size = r.range(0.6, 1.0); }
    const t = r();
    grass.push({ x, y: groundY(x, z), z, rot: r.range(0, Math.PI), size, cell, tint: t < 0.25 ? 1.08 : t < 0.7 ? 1 : 0.9 });
    placed++;
  }
  return { lists, colliders, shade, leafSources, flowers, perches, seats, grass, litter };
}

export interface Flora {
  group: THREE.Group;
  foliage: Foliage;
  litter: Litter;
  /** [world] dress the forest for a season */
  setSeason(info: SeasonInfo): void;
  /** [world3] resolves when the hand-made models are in */
  ready: Promise<unknown>;
  /** [world3] night glow for the moonglow caps (0..1) */
  setNight(k: number): void;
  dispose(): void;
}

// ---------------------------------------------------------------- seasons

type Group = 'deciduous' | 'pine' | 'bush';
const groupOf = (kind: string): Group => (kind.startsWith('pine') ? 'pine' : kind.startsWith('bush') ? 'bush' : 'deciduous');
/** Per-kind crown uniforms: recolour by brightness, and strip leaves away. */
interface CrownU { uRecolor: { value: number }; uBare: { value: number }; uLumK: { value: number } }

const CROWN_VERT = `#include <begin_vertex>
vBareCell = floor(position * 2.6);
#ifdef USE_INSTANCING
vBareCell += floor(instanceMatrix[3].xyz * 7.0);
#endif`;
const CROWN_FRAG = `#include <map_fragment>
if (uBare > 0.001) { vec3 hb = fract(vBareCell * vec3(0.1031, 0.1030, 0.0973)); hb += dot(hb, hb.yxz + 33.33); if (fract((hb.x + hb.y) * hb.z) < uBare) discard; }
{ float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum * uLumK), uRecolor); }`;

function patchCrown(m: THREE.Material, u: CrownU) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBareCell;')
      .replace('#include <begin_vertex>', CROWN_VERT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBareCell; uniform float uRecolor; uniform float uBare; uniform float uLumK;')
      .replace('#include <map_fragment>', CROWN_FRAG);
  };
  const base = prevKey.call(m);
  m.customProgramCacheKey = () => base + '|crown';
  m.needsUpdate = true;
}

/** Average painted brightness of a texture region is unknown up front; the leaf ramps sit around this. */
const CROWN_LUM: Record<string, number> = { oak_a: 0.2, oak_b: 0.24, maple: 0.22, blossom: 0.5, birch: 0.3, pine_a: 0.14, pine_b: 0.14, sapling: 0.24, bush: 0.2 };
const H = (i: number, k: number) => hash(i, k, 0, 4242);
/** Season colours for each kind: spring, summer (null = as painted), autumn picks, winter. All from the calm palette. */
const SEASON_TINT: Record<string, { spring: number; summer: number | null; autumn: number[]; winter?: number | null }> = {
  oak: { spring: 0x93ab68, summer: null, autumn: [0xc59a52, 0xb0703f, 0xd0a860, 0x9c6a42, 0xa66c55], winter: null },
  birch: { spring: 0xb0bf80, summer: null, autumn: [0xd8b468, 0xc9a050, 0xe0c27a] },
  maple: { spring: 0xa8705a, summer: null, autumn: [0xb05a44, 0xc0704e, 0x9e4f45] },
  blossom: { spring: 0xe2bab8, summer: 0x6a8a4f, autumn: [0xb87448, 0xa6604a] },
  sapling: { spring: 0x9db474, summer: null, autumn: [0xd0a860, 0xc08850] },
  pine: { spring: 0x56755a, summer: null, autumn: [0x4c6852], winter: 0x4f665c },
  bush: { spring: 0x8aa86a, summer: null, autumn: [0xa8683e, 0xc4964e, 0x8a7448, 0x9a5a3c], winter: 0x7a6a50 },
};
const tintKey = (kind: string) => (kind.startsWith('oak') ? 'oak' : kind.startsWith('birch') ? 'birch' : kind.startsWith('pine') ? 'pine' : kind.startsWith('bush') ? 'bush' : kind);
const CARD_SUMMER: Record<string, number> = { oak1: 0x5c7845, oak2: 0x557343, oak3: 0x66844f, birch1: 0x7f9656, birch2: 0x7f9656, pine1: 0x3f5a44, pine2: 0x3f5a44, blossom: 0x66844f, maple: 0x9a5844, sapling: 0x66844f, bush: 0x5f7a4a, bushBerry: 0x557343, bushFlower: 0x66844f };

interface PlantSet { kind: string; wood: THREE.InstancedMesh | null; crown: THREE.InstancedMesh | null; u: CrownU; spots: Spot[] }

export function buildFlora(plan: ForestPlan, quality: 'low' | 'high' = 'high'): Flora {
  const group = new THREE.Group();
  group.name = 'flora';
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  const place = (mesh: THREE.InstancedMesh, spots: Spot[]) => {
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.yaw);
      m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
  const plants: PlantSet[] = [], small = new Map<string, THREE.InstancedMesh>(), glows: THREE.MeshLambertMaterial[] = [];
  const sorted = new Map<string, Spot[]>();
  for (const [kind, list] of plan.lists) {
    // shuffle so trimming `count` for the season removes a random scatter, not whole drifts
    const r = rng(kind.length * 977 + list.length);
    sorted.set(kind, list.slice().sort(() => r() - 0.5));
  }
  // leaf cards are known up front (shapes.json), so the canopy shows while the models stream in
  const cardKinds = [...sorted.keys()].filter((k) => PLANTS.has(k) && SHAPES[MODEL[k]]);
  const foliage = new Foliage(cardKinds.map((k) => ({ kind: k, model: SHAPES[MODEL[k]], spots: sorted.get(k)! })), quality);
  foliage.group.visible = false;
  group.add(foliage.group);
  const litter = new Litter(plan.litter);
  group.add(litter.group);

  const sets = new Map<string, PlantSet>();
  for (const kind of cardKinds) {
    const set: PlantSet = { kind, wood: null, crown: null, u: { uRecolor: { value: 0 }, uBare: { value: 0 }, uLumK: { value: 1 / (CROWN_LUM[MODEL[kind]] ?? 0.22) } }, spots: sorted.get(kind)! };
    sets.set(kind, set);
    plants.push(set);
  }
  let lastSeason: SeasonInfo | null = null;
  const inst = (model: KitModel, part: 'wood' | 'crown' | 'glow', spots: Spot[], shadows: boolean, name: string) => {
    const pc = model[part];
    if (!pc) return null;
    const mesh = new THREE.InstancedMesh(pc.geo, pc.mat, spots.length);
    mesh.castShadow = shadows; mesh.receiveShadow = true;
    if (pc.depth) mesh.customDepthMaterial = pc.depth;
    mesh.name = name;
    place(mesh, spots);
    group.add(mesh);
    return mesh;
  };
  const jobs = [...sorted.keys()].filter((k) => MODEL[k]).map(async (kind) => {
    const id = MODEL[kind], spots = sorted.get(kind)!, sh = SHAPES[id];
    const model = await loadKit(id, sh ? { sway: sh.sway, top: sh.top } : {});
    if (PLANTS.has(kind)) {
      const set = sets.get(kind)!;
      set.wood = inst(model, 'wood', spots, !kind.startsWith('bush'), kind + ':wood');
      if (model.crown) {
        // each kind recolours its own crowns, so it gets its own material
        const mat = (model.crown.mat as THREE.MeshLambertMaterial).clone();
        mat.onBeforeCompile = model.crown.mat.onBeforeCompile;
        mat.customProgramCacheKey = model.crown.mat.customProgramCacheKey;
        patchCrown(mat, set.u);
        set.crown = inst({ ...model, crown: { ...model.crown, mat } }, 'crown', spots, true, kind + ':crown');
        if (set.crown) for (let i = 0; i < spots.length; i++) set.crown.setColorAt(i, c.setRGB(1, 1, 1));
      }
    } else {
      const mesh = inst(model, 'wood', spots, !NO_SHADOW.has(kind), kind);
      const glow = inst(model, 'glow', spots, false, kind + ':glow');
      if (glow) glows.push(glow.material as THREE.MeshLambertMaterial);
      if (mesh) { small.set(kind, mesh); if (glow) mesh.userData.glow = glow; }
    }
  });
  const ready = Promise.allSettled(jobs).then((res) => {
    for (const x of res) if (x.status === 'rejected') console.warn('[world] forest model failed', x.reason);
    foliage.group.visible = true;
    if (lastSeason) setSeason(lastSeason);
  });

  function setSeason(info: SeasonInfo) {
    lastSeason = info;
    const s = info.season, late = s === 'autumn' ? Math.max(0, (info.t - 0.45) / 0.55) : 0, early = s === 'autumn' ? Math.max(0, 1 - info.t / 0.3) : 0;
    const looks: CardLook[][] = [];
    for (const p of plants) {
      const g = groupOf(p.kind), T = SEASON_TINT[tintKey(p.kind)] ?? SEASON_TINT.oak;
      const per: CardLook[] = [];
      // crown: recolour from the painted brightness and thin out towards winter
      let recolor = 1, bare = 0;
      if (s === 'summer' && T.summer === null) recolor = 0;
      if (s === 'spring' && p.kind === 'blossom') recolor = 0;
      if (g === 'pine') recolor = s === 'winter' ? 1 : 0;
      if (g === 'deciduous') bare = s === 'winter' ? 1 : s === 'autumn' ? 0.12 + late * 0.5 : 0;
      if (g === 'bush') bare = s === 'winter' ? 0.55 : s === 'autumn' ? late * 0.3 : 0;
      p.u.uRecolor.value = recolor; p.u.uBare.value = bare;
      if (p.crown) p.crown.visible = bare < 0.98;
      p.spots.forEach((_, i) => {
        let tint: number;
        if (s === 'spring') tint = T.spring;
        else if (s === 'summer') tint = T.summer ?? -1;
        else if (s === 'autumn') {
          // early autumn keeps some trees green; late autumn browns everything
          const green = H(i, p.kind.length) < early * 0.7;
          tint = green ? (T.summer ?? CARD_SUMMER[p.kind] ?? 0x5c7845) : T.autumn[Math.floor(H(i, 7) * T.autumn.length)];
          if (late > 0 && !green) tint = new THREE.Color(tint).lerp(new THREE.Color(0x8a6a48), late * 0.35 * H(i, 9)).getHex();
        } else tint = T.winter ?? 0x7a6450;
        const crownTint = tint < 0 ? null : tint;
        // recolouring keeps the painted shading; the instance colour carries the hue
        if (p.crown) {
          if (recolor > 0 && crownTint !== null) p.crown.setColorAt(i, c.setHex(crownTint));
          else p.crown.setColorAt(i, c.setRGB(0.95 + H(i, 3) * 0.08, 0.96 + H(i, 4) * 0.07, 0.95 + H(i, 5) * 0.07));
        }
        const cardTint = crownTint ?? CARD_SUMMER[p.kind] ?? 0x5c7845;
        let keep = 1, cells: number[] | undefined, dryC: number | undefined;
        if (g === 'deciduous') {
          if (s === 'winter') { keep = 0; dryC = 0x7a6450; }
          else if (s === 'autumn') { keep = 1 - late * 0.55; dryC = 0x8a6a48; }
          if (p.kind === 'blossom') cells = s === 'spring' ? CELLS.blossom : s === 'winter' ? undefined : CELLS.birch;
        } else if (g === 'bush') {
          if (s === 'winter') { keep = 0.25; dryC = 0x6f5a44; }
          else if (s === 'autumn') keep = 1 - late * 0.3;
          if (p.kind === 'bush') cells = CELLS.bush;
          if (p.kind === 'bushFlower') cells = s === 'autumn' || s === 'winter' ? CELLS.bush : CELLS.flowerbush;
          if (p.kind === 'bushBerry') cells = s === 'spring' ? CELLS.bush : CELLS.berry;
        }
        per.push({ tint: cardTint, keep, cells, dry: dryC });
      });
      if (p.crown?.instanceColor) p.crown.instanceColor.needsUpdate = true;
      looks.push(per);
    }
    foliage.setSeason((src, i) => looks[src][i]);
    litter.setSeason(info);
    // mushrooms love autumn, hide from winter
    for (const [kind, mesh] of small) {
      const n = (mesh.userData.full ??= mesh.count) as number;
      let k = 1;
      if (MUSHROOMS.has(kind)) k = s === 'winter' ? 0.15 : s === 'spring' ? 0.5 : 1;
      mesh.count = Math.round(n * k);
      mesh.visible = mesh.count > 0;
      const glow = mesh.userData.glow as THREE.InstancedMesh | undefined;
      if (glow) { glow.count = mesh.count; glow.visible = mesh.visible; }
    }
  }

  return {
    group, foliage, litter, setSeason, ready,
    setNight(k: number) { for (const g of glows) g.emissive.setRGB(0.55, 0.6, 0.78).multiplyScalar(k * 0.9); },
    dispose() { foliage.dispose(); litter.dispose(); group.traverse((o) => { const im = o as THREE.InstancedMesh; if (im.isInstancedMesh) im.dispose(); }); },
  };
}

export type { Rng };
