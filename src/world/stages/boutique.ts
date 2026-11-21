// The Snow Queen's boutique: a voxel shop carved from ice. Frosted ice-brick walls, fluted ice
// pillars with icicle capitals, an arched window onto a night of aurora with snow drifting in, an
// icicle chandelier, frosted shelves, a silver cheval mirror, a clothes rack, and Queen Neve behind
// her counter. Today's three deals stand on spotlit pedestals in front of her: outfit pieces on
// porcelain owl busts, plumages as owl statues, furniture on turntables.
// OWNED BY THE SHOP BUILDER.
import * as THREE from 'three';
import { box, buildProp, propMesh, PX, type BoxSpec, type Painter, type Texel } from '../../gfx/box.ts';
import { ramp, tone } from '../../gfx/color.ts';
import { cloth, lamp, lvl, metal, R, smooth, solid, type Tint } from '../../gfx/mats.ts';
import { hash } from '../../gfx/noise.ts';
import { ITEMS } from '../../assets/registry.ts';
import { OwlActor, type OwlAction, type OwlFx, type OwlMood } from '../../owl/actor.ts';
import { buildOwl, G, plate, sculpt, type BoneName, type OwlLook, type OwlParts } from '../../owl/model.ts';
import { PIECE } from '../../owl/outfits.ts';
import { palette } from '../../owl/palette.ts';
import { QUEEN_LOOK } from '../../owl/queen.ts';
import { sceneSound } from '../../audio/sound.ts';
import { Fx, SPR } from '../fx.ts';
import type { Stage } from '../scene.ts';

export interface DisplayItem { kind: 'item' | 'piece' | 'species' | 'skin' | 'finish'; id: string }
export type BoutiqueLayout = 'side' | 'top';

// ------------------------------------------------------------------ painters

const U = 16; // px per world unit
const fineJ = (t: Texel, s = 0) => (hash(Math.floor(t.x * 2), Math.floor(t.y * 2), Math.floor(t.z * 2), 31 + s) - 0.5) * 0.5;

/** Ice bricks: pale blue blocks with frosted white mortar, faceted highlights and crystal veins. */
function iceBricks(c: Tint = '#97c6ea', o: { w?: number; h?: number } = {}): Painter {
  const r = R(c), bw = o.w ?? 16, bh = o.h ?? 8, mortar = R('#f2fbff');
  return (t) => {
    const across = t.face < 2 ? t.z : t.x;
    const row = Math.floor(t.y / bh), off = row % 2 ? bw / 2 : 0, col = Math.floor((across + off) / bw);
    const by = t.y - row * bh, bx = across + off - col * bw;
    if (t.face !== 2 && t.face !== 3 && (by < 1 || bx < 1)) return tone(mortar, lvl(t, { noise: 0.4, speck: 0.4 }) * 0.5);
    let L = lvl(t, { noise: 0.55, scale: 3, speck: 0.6 }) * 0.8 + (hash(col, row, t.face, 4) - 0.5) * 0.9;
    // bevel: light top-left lip, shadow bottom-right
    if (by > bh - 2) L += 0.8; else if (by < 2) L -= 0.6;
    if (bx < 2) L += 0.5; else if (bx > bw - 2) L -= 0.4;
    // crystal veins
    const v = Math.abs(((bx * 0.7 + by * 1.3 + hash(col, row, 0, 9) * 20) % 9) - 4.5);
    if (v < 0.4 && hash(col, row, 1, 2) > 0.4) L += 1.1;
    return tone(r, L + fineJ(t));
  };
}
/** Fluted ice for pillars: vertical grooves, a frosty speckle and a slow twisting highlight. */
function fluted(c: Tint = '#bfe3f7'): Painter {
  const r = R(c);
  return (t) => {
    const across = t.face < 2 ? t.bz : t.bx;
    let L = lvl(t, { noise: 0.35, speck: 0.8, scale: 2 }) * 0.7;
    const f = Math.floor(across) % 3;
    if (t.face !== 2 && t.face !== 3) L += f === 0 ? -0.9 : f === 1 ? 0.6 : 0.1;
    const tw = Math.abs(((across + t.y * 0.35) % 12) - 6);
    if (tw < 0.8) L += 1.2;
    return tone(r, L + fineJ(t, 2));
  };
}
/** Polished tiles: two whites and a pale blue in a checker, silver grout, frost glints. */
function tiles(): Painter {
  const a = R('#eef7fc'), b = R('#c9e2f3'), g = R('#93a9c6');
  return (t) => {
    const s = 16, ix = Math.floor(t.x / s), iz = Math.floor(t.z / s), fx = t.x - ix * s, fz = t.z - iz * s;
    if (fx < 0.8 || fz < 0.8) return tone(g, (hash(ix, iz, 3) - 0.5) * 0.6);
    const r = (ix + iz) % 2 ? a : b;
    let L = (hash(ix, iz, 1) - 0.5) * 0.6 + (fx + fz > 26 ? -0.35 : fx + fz < 6 ? 0.45 : 0);
    // a diamond inlay in the pale tiles
    if ((ix + iz) % 2 === 0 && Math.abs(fx - 8) + Math.abs(fz - 8) < 3.2) return tone(R('#9fc8ea'), Math.abs(fx - 8) + Math.abs(fz - 8) < 1.5 ? 1 : 0);
    if (hash(Math.floor(t.x * 2), Math.floor(t.z * 2), 7) > 0.985) L += 1.6;
    return tone(r, L);
  };
}
/** Royal-blue runner with silver borders and little snowflakes. */
function runner(): Painter {
  const b = R('#2e4f9e'), s = R('#d5def0'), d = R('#1f3576');
  return (t) => {
    const hw = t.sx / 2, ax = Math.abs(t.bx - hw);
    if (ax > hw - 1.6) return tone(s, (Math.floor(t.bz) % 2 ? 0.4 : -0.3));
    if (ax > hw - 3) return tone(d, 0);
    const fz = ((t.bz % 14) + 14) % 14, fx = t.bx - hw;
    const flake = (Math.abs(fx) < 0.6 && Math.abs(fz - 7) < 3) || (Math.abs(fz - 7) < 0.6 && Math.abs(fx) < 3) || (Math.abs(Math.abs(fx) - Math.abs(fz - 7)) < 0.5 && Math.abs(fx) < 2);
    if (flake) return tone(s, 0.6);
    return tone(b, lvl(t, { noise: 0.5, speck: 0.3, rim: 0 }) * 0.6);
  };
}
/** Pale frosted wood for shelves and the counter top. */
function frostWood(c: Tint = '#e9f1f8'): Painter {
  const r = R(c);
  return (t) => tone(r, lvl(t, { noise: 0.3, speck: 0.3 }) + (Math.floor((t.face < 2 ? t.z : t.x) / 3) % 4 === 0 ? -0.5 : 0) + fineJ(t, 5));
}
/** Clear ice with depth: lighter rims, inner bubbles. */
function clearIce(c: Tint = '#cdeefc'): Painter {
  const r = R(c);
  return (t) => {
    let L = lvl(t, { noise: 0.5, scale: 4, speck: 0.2 }) * 0.6;
    if (t.u === 0 || t.v === 0 || t.u === t.w - 1 || t.v === t.h - 1) L += 1;
    if (hash(Math.floor(t.x), Math.floor(t.y), Math.floor(t.z), 12) > 0.96) L += 1.4;
    return tone(r, L + 0.3);
  };
}
/** A silvered mirror: cool gradient with diagonal sheen streaks. */
function mirrorGlass(): Painter {
  const r = R('#b9d3ea');
  return (t) => {
    const d = (t.u + t.v) % 17;
    let L = (t.v / Math.max(1, t.h)) * 1.2 - 0.3;
    if (d < 1.2 || (d > 4 && d < 5)) L += 1.6;
    return tone(r, L);
  };
}
const silver = metal('#c4cee2');
const gold = metal('#e8c56a');
const porcelain = (c: Tint = '#f4f8fd'): Painter => smooth(c, { noise: 0.25, speck: 0.15 });
const snow = (): Painter => solid('#f7fbff', { noise: 0.6, speck: 0.4, rim: 0.4 });
const glowIce = lamp('#bfeaff');

// ------------------------------------------------------------------ model helpers

function mesh(boxes: BoxSpec[], o: { shadow?: boolean } = {}): THREE.Mesh {
  const p = buildProp(boxes, { wind: false });
  const m = propMesh(p);
  m.castShadow = o.shadow ?? true;
  m.receiveShadow = true;
  m.userData.dispose = () => { p.geo.dispose(); p.tex.dispose(); p.mats.forEach((x) => x.dispose()); };
  return m;
}

/** A round-ish disc of boxes (pedestal tops, chandelier rings). */
function disc(x: number, y: number, z: number, r: number, h: number, m: Painter, o: Partial<BoxSpec> = {}): BoxSpec[] {
  const out: BoxSpec[] = [];
  const steps = Math.max(2, Math.round(r / 2.5));
  for (let i = 0; i < steps; i++) {
    const a = ((i + 0.5) / steps) * r, w = 2 * Math.sqrt(Math.max(0, r * r - a * a));
    const dz = r / steps;
    out.push(box(x, y, z + a - dz / 2, w, h, dz, m, o), box(x, y, z - a + dz / 2, w, h, dz, m, o));
  }
  return out;
}

/** A fluted ice pillar with a gold-banded base, a capital and icicles. */
function pillar(x: number, z: number, H: number): BoxSpec[] {
  const ice = fluted(), b = iceBricks('#9ccbea', { w: 12, h: 6 });
  const out: BoxSpec[] = [
    box(x, 0, z, 22, 6, 22, b), box(x, 6, z, 19, 3, 19, clearIce()), box(x, 9, z, 17, 1.5, 17, gold),
    box(x, 10.5, z, 14, H - 26, 14, ice),
    box(x, H - 15.5, z, 17, 1.5, 17, gold), box(x, H - 14, z, 19, 4, 19, clearIce()), box(x, H - 10, z, 23, 4, 23, b), box(x, H - 6, z, 26, 6, 26, iceBricks('#b7dcf3', { w: 13, h: 6 })),
  ];
  // icicles dripping from the capital
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, rr = 11.5, len = 4 + hash(i, x, z) * 9;
    out.push(box(x + Math.cos(a) * rr, H - 14 - len, z + Math.sin(a) * rr, 1.6, len, 1.6, glowIce, { glow: true }));
  }
  return out;
}

/** The porcelain owl form a piece of clothing is shown on, plus the piece itself. */
function bustBoxes(pieceId: string): BoxSpec[] | null {
  const def = PIECE[pieceId];
  if (!def) return null;
  const pal = palette('snowy');
  const bones = {} as Record<BoneName, BoxSpec[]>;
  for (const k of ['body', 'head', 'tuftL', 'tuftR', 'browL', 'browR', 'jaw', 'wingL', 'wingR', 'tail', 'legL', 'legR'] as BoneName[]) bones[k] = [];
  const P: OwlParts = { bones, add: (bone, ...b) => bones[bone].push(...b), pal, tufts: true };
  const pz = porcelain(), pd = porcelain('#dfe9f5');
  P.add('body', ...sculpt(0, G.bodyY, 0, G.bodyW, G.bodyD, [[0, 1, 1.5, 2.4], [1, 2.2, 0.5, 3], [2.2, 9.6, 0, 3.4], [9.6, 11, 0.6, 3.2]], pz));
  P.add('head', ...sculpt(0, G.headY, G.headZ, G.headW, G.headD, [[0, 1, 1.4, 3], [1, 2.2, 0.5, 3.6], [2.2, 10, 0, 4], [10, 11.6, 0.6, 3.8], [11.6, 12.8, 1.9, 3.4]], pz));
  P.add('head', ...plate(-G.eyeX, G.eyeY - 4.25, G.headFront + 0.5, 8.1, 8.5, 0.9, 3.9, pd), ...plate(G.eyeX, G.eyeY - 4.25, G.headFront + 0.58, 8.1, 8.5, 0.9, 3.9, pd));
  P.add('head', box(0, 16.3, G.discFront + 0.65, 2.1, 1.9, 1.3, gold));
  for (const sd of [-1, 1]) P.add('head', box(sd * G.eyeX, G.eyeY - 0.6, G.discFront + 0.5, 3.2, 0.9, 0.5, solid('#8aa6cc')), box(sd * (G.eyeX + 1.6), G.eyeY - 0.2, G.discFront + 0.5, 0.9, 0.9, 0.5, solid('#8aa6cc')));
  for (const sd of [-1, 1]) P.add('tuftL', box(sd * 5.3, 23.9, 0.4, 2.8, 2.8, 2.4, pz));
  P.add('wingL', ...sculpt(-G.wingX, 3.8, -0.5, 2.3, 9.8, [[0, 10, 0, 1]], pz));
  P.add('wingR', ...sculpt(G.wingX, 3.8, -0.5, 2.3, 9.8, [[0, 10, 0, 1]], pz));
  try { def.make(P); } catch { /* a piece that needs more of the owl than the bust has */ }
  // a little turned stand under the bust
  const all = Object.values(bones).flat();
  all.push(box(0, -4, 0, 4, 7, 4, silver), box(0, -6, 0, 11, 2, 11, gold));
  return all.map((b) => ({ ...b, at: [b.at[0], b.at[1] + 6, b.at[2]] as [number, number, number], pivot: b.pivot ? [b.pivot[0], b.pivot[1] + 6, b.pivot[2]] as [number, number, number] : undefined }));
}

/** A frosted crate with a question mark: for prizes whose model has not arrived yet. */
function mysteryBoxes(): BoxSpec[] {
  const q = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'];
  const face: Painter = (t) => {
    if (t.face === 4) {
      const gx = Math.floor((t.u - (t.w - 10) / 2) / 2), gy = 6 - Math.floor((t.v - (t.h - 14) / 2) / 2);
      if (gx >= 0 && gx < 5 && gy >= 0 && gy < 7 && q[gy][gx] === '#') return 0xffe07a;
    }
    return clearIce('#9fd2f0')(t);
  };
  return [box(0, 0, 0, 18, 18, 18, face), box(0, 18, 0, 20, 2, 20, silver), box(0, 0, 0, 20, 2, 20, silver)];
}

/** Build the 3D model for something on display, scaled to sit in a ~1.4 x 1.5 unit box. */
export function displayModel(d: DisplayItem): { obj: THREE.Object3D; dispose(): void; owl?: ReturnType<typeof buildOwl> } {
  const fit = (o: THREE.Object3D, W = 1.6, H = 1.7) => {
    const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
    const k = Math.min(1.6, W / Math.max(0.01, s.x, s.z * 0.8), H / Math.max(0.01, s.y));
    o.scale.setScalar(k);
    o.position.y = -b.min.y * k;
  };
  const wrap = new THREE.Group();
  if (d.kind === 'item' && ITEMS[d.id]) {
    const def = ITEMS[d.id];
    const m = mesh(def.build());
    for (const p of def.parts?.() ?? []) m.add(p);
    wrap.add(m);
    fit(m);
    wrap.userData.animate = def.animate ? (t: number, dt: number) => def.animate!(m, t, dt) : null;
    return { obj: wrap, dispose: () => m.userData.dispose?.() };
  }
  if (d.kind === 'piece') {
    const bx = bustBoxes(d.id);
    if (bx) { const m = mesh(bx); wrap.add(m); fit(m, 1.45, 1.75); return { obj: wrap, dispose: () => m.userData.dispose?.() }; }
  }
  if (d.kind === 'species' || d.kind === 'skin') {
    const look: OwlLook = d.kind === 'species' ? { skin: 'owl', species: d.id, palette: d.id, outfit: {} } : { skin: d.id as OwlLook['skin'], species: 'snowy', palette: 'snowy', outfit: {} };
    try {
      const o = buildOwl(look);
      o.eyes.forEach((e) => e.draw({ lid: 0.12, low: 0.2, tilt: 0, lx: 0, ly: 0, pupil: 5.4, mode: 'normal', tear: false }));
      o.rig.bones.jaw.visible = false;
      wrap.add(o.rig.root);
      fit(o.rig.root, 1.45, 1.7);
      return { obj: wrap, dispose: () => o.dispose(), owl: o };
    } catch { /* fall through to the mystery box */ }
  }
  const m = mesh(mysteryBoxes());
  wrap.add(m);
  fit(m, 1.0, 1.0);
  return { obj: wrap, dispose: () => m.userData.dispose?.() };
}

// ------------------------------------------------------------------ the aurora window

function auroraMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 grid = vec2(84.0, 96.0);
        vec2 cell = floor(vUv * grid), uv = cell / grid;
        vec3 col = mix(vec3(0.02, 0.04, 0.14), vec3(0.07, 0.11, 0.30), uv.y);
        float a = 0.0, b = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float y = 0.56 + 0.1 * fi + 0.07 * sin(uv.x * 5.0 + uTime * 0.25 + fi * 2.1) + 0.035 * sin(uv.x * 13.0 - uTime * 0.45 + fi);
          float d = uv.y - y;
          float band = smoothstep(0.11, 0.0, abs(d)) * (d > 0.0 ? 1.0 : 1.6);
          float curtain = 0.55 + 0.45 * sin(uv.x * 38.0 + uTime * 0.8 + fi * 4.0);
          a += band * curtain * (i == 1 ? 1.0 : 0.7);
          b += smoothstep(0.2, 0.0, abs(d - 0.08)) * 0.4;
        }
        col += vec3(0.16, 0.95, 0.66) * a * 0.55 + vec3(0.55, 0.32, 0.95) * b * 0.45;
        // stars
        float s = h21(cell);
        col += vec3(1.0) * step(0.982, s) * (0.5 + 0.5 * sin(uTime * 2.5 + s * 80.0)) * step(0.35, uv.y);
        // the moon
        float m = length((uv - vec2(0.78, 0.86)) * vec2(1.0, 0.875));
        if (m < 0.055) col = mix(vec3(1.0, 0.97, 0.85), vec3(0.85, 0.88, 0.96), step(0.03, length((uv - vec2(0.795, 0.875)) * vec2(1.0, 0.875))));
        col += vec3(0.5, 0.55, 0.7) * smoothstep(0.16, 0.05, m) * 0.25;
        // snowy hills and pines
        float hill = 0.2 + 0.05 * sin(uv.x * 5.3 + 1.0) + 0.025 * sin(uv.x * 17.0);
        float pine = 0.0;
        for (int k = 0; k < 7; k++) {
          float px = (float(k) + 0.5) / 7.0 + 0.04 * sin(float(k) * 7.3);
          float ph = 0.16 + 0.07 * fract(float(k) * 0.618);
          float w = (ph + hill - uv.y) * 0.32;
          if (uv.y > hill - 0.05 && uv.y < hill + ph && abs(uv.x - px) < w) pine = 1.0;
        }
        if (pine > 0.5) col = vec3(0.06, 0.13, 0.2) + vec3(0.0, 0.06, 0.05) * step(0.5, fract(uv.y * 24.0));
        if (uv.y < hill) col = mix(vec3(0.55, 0.66, 0.86), vec3(0.82, 0.9, 0.98), uv.y / hill);
        col = floor(col * 14.0 + 0.5) / 14.0;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** A soft additive cone of light under a spotlight. */
function lightCone(h: number, r: number, color: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.08, r, h, 20, 1, true);
  geo.translate(0, -h / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: 0.22 } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = -position.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 uColor; uniform float uK; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 1.6); float a = uK * f * (1.0 - smoothstep(0.0, ${h.toFixed(2)}, vY) * 0.75); gl_FragColor = vec4(uColor * a, 1.0); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 7;
  return m;
}

/** A soft round glow sprite (chandelier halo, focus rings). */
function glowSprite(color: number, size: number, a = 0.6): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!, grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: a, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

// ------------------------------------------------------------------ the stage

interface Stand { pos: THREE.Vector3; top: number; group: THREE.Group; holder: THREE.Group; model: ReturnType<typeof displayModel> | null; spot: THREE.SpotLight; cone: THREE.Mesh; ring: THREE.Sprite; hit: THREE.Mesh; focus: number; bounce: number }

export class Boutique implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.3, 120);
  readonly queen: OwlActor;
  readonly fx = new Fx(900);
  layout: BoutiqueLayout = 'side';
  /** where the boutique's centre sits on screen (fractions), set by resize() */
  focus = { x: 0.72, y: 0.5 };
  /** taps on a display stand (0..2) or the queen */
  onPick: ((i: number) => void) | null = null;
  onQueen: (() => void) | null = null;
  private queenRig = new THREE.Group();
  private stands: Stand[] = [];
  private aurora!: THREE.ShaderMaterial;
  private chandelier = new THREE.Group();
  private chandLight: THREE.PointLight;
  private disposables: (() => void)[] = [];
  private time = 0;
  private snowT = 0;
  private curtsy = 0;
  private idleT = 4;
  private lookT = 0;
  private enter = 0;
  private cam = { pos: new THREE.Vector3(), target: new THREE.Vector3(0, 1.45, -0.6) };
  private w = 1; private h = 1;
  private ray = new THREE.Raycaster();
  private downAt: { x: number; y: number; t: number } | null = null;

  constructor(deals: DisplayItem[] = []) {
    const S = this.scene;
    S.background = new THREE.Color(0x0d1a38);
    S.fog = new THREE.Fog(0x16285a, 22, 70);
    this.build();

    // light: cool ambience, a moonlit key from the window, warm gold accents
    S.add(new THREE.HemisphereLight(0xd8ecff, 0x3a4470, 1.0));
    const key = new THREE.DirectionalLight(0xcfe2ff, 1.15);
    key.position.set(-4, 9, 7); key.target.position.set(0, 0, -1);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -4; sc.near = 1; sc.far = 30;
    key.shadow.bias = -0.0008;
    S.add(key, key.target);
    const rim = new THREE.DirectionalLight(0x9fb8ff, 0.7);
    rim.position.set(0, 4, -8);
    S.add(rim);
    this.chandLight = new THREE.PointLight(0xbfe6ff, 9, 11, 1.6);
    this.chandLight.position.set(0, 4.6, 0.6);
    S.add(this.chandLight);
    const warm = new THREE.PointLight(0xffd59a, 3.2, 5, 1.8);
    warm.position.set(0, 1.6, -0.2);
    S.add(warm);

    // Queen Neve on her dais behind the counter
    this.queen = new OwlActor(QUEEN_LOOK, {
      fx: (k, at, n) => this.owlFx(k, at, n),
      sound: (id) => sceneSound('owl_' + id),
    });
    this.queen.node.scale.setScalar(1.5);
    this.queen.setMood('happy');
    this.queenRig.position.set(0, 0.5, -2.05);
    this.queenRig.add(this.queen.node);
    S.add(this.queenRig);
    S.add(this.fx.group);
    this.fx.setLight(new THREE.Color(0xe8f2ff));

    // three spotlit stands
    const spots: [number, number, number][] = [[-3.1, 0.52, 0.6], [0, 0.3, 1.45], [3.1, 0.52, 0.6]];
    spots.forEach(([x, top, z], i) => this.stands.push(this.makeStand(i, x, top, z)));
    this.setDeals(deals);
    // let springs and particles settle
    for (let i = 0; i < 30; i++) this.queen.update(1 / 30);
  }

  // ---------------------------------------------------------------- building the room

  private add(boxes: BoxSpec[], o: { shadow?: boolean } = {}) {
    const m = mesh(boxes, o);
    this.scene.add(m);
    this.disposables.push(() => m.userData.dispose?.());
    return m;
  }

  private build() {
    const W = 14 * U, D0 = -3.6 * U, D1 = 11 * U, H = 7.2 * U;
    // floor and a runner up to the counter
    this.add([box(0, -4, (D0 + D1) / 2, W + 32, 4, D1 - D0, tiles())], { shadow: false });
    this.add([box(0, 0, 0.6 * U, 2.2 * U, 0.4, 4.4 * U, runner())], { shadow: false });

    // back wall with an arched window (opening x in [-1.5, 1.5], y in [1.1, 3.6], arch to 5.1)
    const wb = iceBricks(), wz = D0 - 4, T = 8;
    const ox = 1.5 * U, oy0 = 1.1 * U, oy1 = 3.6 * U, ar = ox;
    const wall: BoxSpec[] = [
      box(-(W / 2 + ox) / 2, 0, wz, W / 2 - ox, H, T, wb), box((W / 2 + ox) / 2, 0, wz, W / 2 - ox, H, T, wb),
      box(0, 0, wz, 2 * ox, oy0, T, wb), box(0, oy1 + ar, wz, 2 * ox, H - oy1 - ar, T, wb),
    ];
    for (let y = oy1; y < oy1 + ar; y += 2) {
      const half = Math.sqrt(Math.max(0, ar * ar - (y + 1 - oy1) ** 2));
      const fill = ox - half;
      if (fill > 0.2) for (const sd of [-1, 1]) wall.push(box(sd * (ox - fill / 2), y, wz, fill, 2, T, wb));
    }
    // wainscot: silver-blue panels along the bottom, a crown moulding along the top
    wall.push(box(0, 0, wz + 5, W, 10, 2, iceBricks('#7fb3dd', { w: 28, h: 10 })), box(0, 10, wz + 5.5, W, 1.5, 3, silver));
    wall.push(box(0, H - 6, wz + 5, W, 6, 3, clearIce()), box(0, H - 7, wz + 6, W, 1.5, 4, gold));
    this.add(wall);
    // side walls
    for (const sd of [-1, 1]) this.add([box(sd * (W / 2 + 4), 0, (D0 + 4 * U) / 2, 8, H, 4 * U - D0, iceBricks('#8dbde4'))]);

    // window frame: silver arch, gold keystone, mullions, frosted sill with a snowdrift
    const frame: BoxSpec[] = [];
    for (const sd of [-1, 1]) frame.push(box(sd * (ox + 1.5), oy0, wz + 3, 3, oy1 - oy0, 6, silver));
    for (let a = 0; a <= 180; a += 7.5) {
      const r = (a * Math.PI) / 180, x = Math.cos(r) * (ar + 1.5), y = oy1 + Math.sin(r) * (ar + 1.5);
      frame.push({ ...box(x, y - 1.5, wz + 3, 3.2, 3, 6, silver), rot: [0, 0, a - 90], pivot: [x, y, wz + 3] });
    }
    frame.push(box(0, oy1 + ar, wz + 4, 5, 6, 6, gold), box(0, oy0 - 3, wz + 6, 2 * ox + 10, 3, 12, clearIce()));
    frame.push(box(0, oy0, wz + 1, 1.5, oy1 + ar - oy0 - 1, 2, silver), box(0, oy1 - 1, wz + 1, 2 * ox, 1.5, 2, silver), box(0, oy0 + (oy1 - oy0) / 2, wz + 1, 2 * ox, 1.2, 2, silver));
    frame.push(box(-10, oy0, wz + 8, 18, 3, 8, snow()), box(9, oy0, wz + 8, 12, 2, 7, snow()), box(-2, oy0 + 2.5, wz + 8, 10, 1.5, 5, snow()));
    this.add(frame);
    // the night outside
    this.aurora = auroraMaterial();
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.6), this.aurora);
    sky.position.set(0, (oy0 + (oy1 + ar - oy0) / 2) / U, wz / U - 0.6);
    this.scene.add(sky);
    this.disposables.push(() => { sky.geometry.dispose(); this.aurora.dispose(); });
    const moon = glowSprite(0xbfe0ff, 3.2, 0.25);
    moon.position.set(0, 2.6, wz / U + 0.3);
    this.scene.add(moon);

    // pillars flanking the window and at the corners
    this.add([...pillar(-2.55 * U, D0 + 10, H), ...pillar(2.55 * U, D0 + 10, H), ...pillar(-6.2 * U, D0 + 14, H), ...pillar(6.2 * U, D0 + 14, H)]);

    // frosted display shelves between the pillars
    for (const sd of [-1, 1]) {
      const x = sd * 4.35 * U, z = D0 + 8;
      const sh: BoxSpec[] = [box(x, 4, z - 2, 46, 4.5 * U, 2, clearIce('#b5dcf3'))];
      for (const y of [1.25, 2.3, 3.35]) {
        sh.push(box(x, y * U, z + 3, 48, 2, 10, frostWood()), box(x, y * U - 1, z + 8, 48, 1, 1, gold));
        // icicles under each shelf
        for (let i = 0; i < 6; i++) sh.push(box(x - 20 + i * 8 + hash(i, y, sd) * 3, y * U - 3 - hash(i, sd, y) * 3, z + 7, 1, 3 + hash(y, i, 1) * 3, 1, glowIce, { glow: true }));
      }
      sh.push(box(x - 25, 0, z + 3, 2, 4.4 * U, 10, silver), box(x + 25, 0, z + 3, 2, 4.4 * U, 10, silver), box(x, 0, z + 3, 50, 4, 12, iceBricks('#9ccbea', { w: 10, h: 4 })));
      // things on the shelves: folded sweaters, hats, perfume bottles, little snow globes
      const cols = ['#d9343f', '#3d6fc2', '#f2ede2', '#7a5bc2', '#2f8f6a', '#e8a33a'];
      for (const [row, y] of [[0, 1.25], [1, 2.3], [2, 3.35]] as const) {
        let cx = x - 19;
        for (let k = 0; k < 4; k++) {
          const kind = (row * 4 + k + (sd > 0 ? 1 : 0)) % 4, c = cols[(row * 3 + k * 2 + (sd > 0 ? 3 : 0)) % cols.length];
          const by = y * U + 2;
          if (kind === 0) sh.push(box(cx, by, z + 4, 9, 2, 6, cloth(c)), box(cx, by + 2, z + 4, 9, 2, 6, cloth(cols[(k + 2) % 6])), box(cx, by + 4, z + 4, 9, 1.5, 6, cloth(c, { stripe: '#ffffff' })));
          if (kind === 1) sh.push(box(cx, by, z + 4, 8, 1, 7, cloth(c)), box(cx, by + 1, z + 4, 5, 4, 5, cloth(c)), box(cx, by + 5, z + 4, 2, 2, 2, cloth('#ffffff')));
          if (kind === 2) sh.push(box(cx - 2, by, z + 4, 3, 5, 3, clearIce('#f5b8d8')), box(cx - 2, by + 5, z + 4, 1.5, 1.5, 1.5, gold), box(cx + 2, by, z + 4, 3, 4, 3, clearIce('#c3b5f5')), box(cx + 2, by + 4, z + 4, 1.5, 1.5, 1.5, gold));
          if (kind === 3) sh.push(box(cx, by, z + 4, 6, 1.5, 6, gold), box(cx, by + 1.5, z + 4, 5, 5, 5, clearIce('#e8f6ff'), { glass: false }), box(cx, by + 2, z + 4, 2, 2, 2, solid('#3f8f5f')));
          cx += 12.5;
        }
      }
      this.add(sh);
    }

    // a silver cheval mirror (left) and a clothes rack (right)
    const mx = -5.25 * U, mz = -1.9 * U;
    this.add([
      box(mx, 0, mz, 22, 2, 12, silver), box(mx - 10, 2, mz, 2, 30, 2, silver), box(mx + 10, 2, mz, 2, 30, 2, silver),
      { ...box(mx, 6, mz, 18, 30, 1.5, mirrorGlass()), rot: [0, 18, 0] },
      { ...box(mx, 5, mz - 1, 20, 1.5, 2.5, gold), rot: [0, 18, 0] }, { ...box(mx, 36, mz - 1, 20, 1.5, 2.5, gold), rot: [0, 18, 0] },
      { ...box(mx - 9.5, 5, mz - 1, 1.5, 32, 2.5, gold), rot: [0, 18, 0], pivot: [mx, 20, mz] }, { ...box(mx + 9.5, 5, mz - 1, 1.5, 32, 2.5, gold), rot: [0, 18, 0], pivot: [mx, 20, mz] },
      box(mx, 37.5, mz - 1, 4, 3, 2, gold),
    ]);
    const rx = 5.25 * U, rz = -1.9 * U;
    const rack: BoxSpec[] = [box(rx, 0, rz, 30, 2, 10, silver), box(rx - 14, 2, rz, 2, 34, 2, silver), box(rx + 14, 2, rz, 2, 34, 2, silver), box(rx, 36, rz, 31, 1.5, 1.5, silver)];
    const hang = ['#2e4f9e', '#d9343f', '#f2ede2', '#7a5bc2', '#5aa6d8'];
    hang.forEach((c, i) => {
      const x = rx - 11 + i * 5.5;
      rack.push(box(x, 34, rz, 0.6, 2, 0.6, silver), box(x, 33, rz, 4.5, 0.8, 1, silver));
      rack.push(box(x, 18 + (i % 2) * 2, rz, 4.6, 15 - (i % 2) * 2, 4, cloth(c, { trim: i % 2 ? '#ffffff' : '#e8c56a', hem: 1, collar: 1 })));
    });
    this.add(rack);

    // the counter: carved ice with gold trim and a frosted-wood top, on the queen's dais
    const cz = -1.05 * U;
    this.add([
      box(0, 0, -2.05 * U, 4.4 * U, 8, 1.6 * U, iceBricks('#c4e4f7', { w: 12, h: 4 })), box(0, 8, -2.05 * U, 4.5 * U, 1, 1.7 * U, gold),
      box(0, 0, cz, 3.4 * U, 13, 0.8 * U, iceBricks('#b0d9f2', { w: 10, h: 6 })),
      box(0, 13, cz, 3.6 * U, 1.5, 0.95 * U, gold), box(0, 14.5, cz, 3.6 * U, 2, 0.95 * U, frostWood('#f4f9fd')),
      box(0, 1, cz + 0.4 * U + 0.6, 3.2 * U, 1, 1, gold), box(0, 11, cz + 0.4 * U + 0.6, 3.2 * U, 1, 1, gold),
      // a snowflake medallion on the front
      box(0, 4, cz + 0.4 * U + 0.4, 7, 7, 1, clearIce('#e8f8ff')), box(0, 6.5, cz + 0.4 * U + 0.9, 9, 2, 0.8, gold), box(0, 3, cz + 0.4 * U + 0.9, 2, 9, 0.8, gold),
      // on top: a crystal bell, a ledger, a little pile of acorns
      box(-18, 16.5, cz, 6, 1, 6, gold), box(-18, 17.5, cz, 4, 4, 4, clearIce('#e2f6ff')), box(-18, 21.5, cz, 1, 1.5, 1, gold),
      box(14, 16.5, cz - 1, 10, 1.5, 7, cloth('#2e4f9e', { trim: '#e8c56a', hem: 1 })), box(14, 18, cz - 1, 9, 0.5, 6, solid('#f6efdc')),
      box(24, 16.5, cz + 2, 3, 3, 3, solid('#d08a2e')), box(26.5, 16.5, cz + 1, 3, 3, 3, solid('#c47a3a')), box(25, 19.5, cz + 1.5, 3, 2, 3, solid('#8b5a2b')),
    ]);

    // snowdrifts and crystal clusters in the corners
    const drift: BoxSpec[] = [];
    for (const [x, z, s] of [[-6.4, -3.2, 1], [6.4, -3.2, 1], [-1.6, -3.3, 0.6], [1.9, -3.3, 0.5]] as const) {
      drift.push(box(x * U, 0, z * U, 26 * s, 3, 14 * s, snow()), box(x * U, 3, z * U, 16 * s, 2.5, 9 * s, snow()), box(x * U - 3, 5.5, z * U, 7 * s, 1.5, 5 * s, snow()));
    }
    for (const [x, z] of [[-6.1, 1.2], [6.0, 1.0]] as const) {
      for (let i = 0; i < 5; i++) drift.push({ ...box(x * U + (i - 2) * 3, 0, z * U + hash(i, x, 1) * 4, 2.5, 6 + hash(i, z, 2) * 10, 2.5, glowIce, { glow: true }), rot: [hash(i, 3, x) * 30 - 15, 0, (i - 2) * 12], pivot: [x * U + (i - 2) * 3, 0, z * U] });
    }
    this.add(drift, { shadow: false });

    // the icicle chandelier
    const ch: BoxSpec[] = [box(0, 0, 0, 1, 40, 1, silver)];
    for (let ring = 0; ring < 2; ring++) {
      const r = ring ? 9 : 16, y = ring ? -6 : 0, n = ring ? 8 : 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        ch.push({ ...box(x, y, z, 7.5, 1.5, 2, ring ? gold : silver), rot: [0, -((a * 180) / Math.PI) + 90, 0], pivot: [x, y, z] });
        const len = 6 + hash(i, ring, 4) * 9;
        ch.push(box(x, y - len, z, 1.8, len, 1.8, glowIce, { glow: true }), box(x, y + 1.5, z, 1.5, 2.5, 1.5, lamp('#fff2c6'), { glow: true }));
      }
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; ch.push(box(Math.cos(a) * r * 0.5, y, Math.sin(a) * r * 0.5, 1, 1, 1, silver)); }
    }
    ch.push(box(0, -18, 0, 3, 14, 3, glowIce, { glow: true }), box(0, -20, 0, 1.5, 2, 1.5, lamp('#ffffff'), { glow: true }), box(0, -4, 0, 5, 4, 5, gold));
    const chm = mesh(ch, { shadow: false });
    this.disposables.push(() => chm.userData.dispose?.());
    this.chandelier.add(chm);
    const halo = glowSprite(0xbfe6ff, 2.6, 0.32);
    halo.position.y = -0.6;
    this.chandelier.add(halo);
    this.chandelier.position.set(0, 5.55, 0.9);
    this.scene.add(this.chandelier);
  }

  private makeStand(i: number, x: number, top: number, z: number): Stand {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const T = top * U;
    const ped = mesh([
      ...disc(0, 0, 0, 13, 3, iceBricks('#9ccbea', { w: 8, h: 3 })), ...disc(0, 3, 0, 11, 1.2, gold),
      box(0, 4.2, 0, 13, T - 9.4, 13, fluted('#cfeafa')), ...disc(0, T - 5.2, 0, 11.5, 1.2, gold), ...disc(0, T - 4, 0, 12.5, 4, clearIce('#dff4ff')),
    ]);
    group.add(ped);
    this.disposables.push(() => ped.userData.dispose?.());
    // a glowing frost ring on the pedestal top
    const ring = glowSprite(0xd8f0ff, 1.9, 0.0);
    ring.position.y = top + 0.05;
    group.add(ring);
    const holder = new THREE.Group();
    holder.position.y = top;
    group.add(holder);
    // spotlight from above, with a visible cone
    const spot = new THREE.SpotLight(0xfff1d6, 14, 9, 0.36, 0.55, 1.4);
    spot.position.set(0, 6.2, 0.4);
    spot.target = holder;
    group.add(spot);
    const cone = lightCone(5.9, 0.9, 0xfff3d8);
    cone.visible = i !== 1;
    cone.position.set(0, 6.2, 0.15);
    group.add(cone);
    // an invisible box for taps
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.8, top + 1.7, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = (top + 1.7) / 2;
    hit.userData.stand = i;
    group.add(hit);
    this.disposables.push(() => { (cone.material as THREE.Material).dispose(); cone.geometry.dispose(); hit.geometry.dispose(); });
    this.scene.add(group);
    return { pos: new THREE.Vector3(x, top, z), top, group, holder, model: null, spot, cone, ring, hit, focus: 0, bounce: 0 };
  }

  /** Put today's deals on the stands (missing ids show a mystery crate). */
  setDeals(deals: DisplayItem[]) {
    this.stands.forEach((s, i) => {
      if (s.model) { s.holder.remove(s.model.obj); s.model.dispose(); s.model = null; }
      const d = deals[i];
      if (!d) return;
      s.model = displayModel(d);
      s.holder.add(s.model.obj);
    });
  }

  /** Dim a stand whose deal is sold. */
  setSold(i: number, sold: boolean) {
    const s = this.stands[i];
    if (s) { s.spot.intensity = sold ? 3 : 14; (s.cone.material as THREE.ShaderMaterial).uniforms.uK.value = sold ? 0.06 : 0.22; }
  }

  // ---------------------------------------------------------------- the queen's moments

  /** She waves hello (call when the shop opens). */
  greet() { this.enter = 0; setTimeout(() => { this.queen.play('wave'); this.queen.setMood('joy', 1.6); }, 700); }
  /** She turns and presents a stand; it brightens and bounces. */
  present(i: number) {
    const s = this.stands[i];
    if (!s) return;
    this.stands.forEach((x, k) => (x.focus = k === i ? 1 : 0));
    s.bounce = 1;
    this.queen.lookAt = s.group.position.clone().add(new THREE.Vector3(0, s.top + 0.6, 0));
    this.lookT = 3.2;
    this.queen.play('present');
    const p = s.group.position;
    this.fx.burst('sparkle', p.x, s.top + 0.7, p.z, 12);
  }
  clearFocus() { this.stands.forEach((x) => (x.focus = 0)); }
  /** A purchase: a curtsy, a happy flap, sparkles and acorns raining on the stand. */
  celebrate(i?: number) {
    this.curtsy = 1;
    this.queen.setMood('love', 2.2);
    setTimeout(() => this.queen.play('flap'), 650);
    const h = this.queen.headWorld;
    this.fx.burst('hearts', h.x, h.y + 0.1, h.z, 4);
    this.sparkleRain(h.x, h.y + 0.4, h.z, 18);
    if (i !== undefined && this.stands[i]) { const s = this.stands[i], p = s.group.position; s.bounce = 1; this.fx.burst('stars', p.x, s.top + 0.8, p.z, 12); this.sparkleRain(p.x, s.top + 1.4, p.z, 14); }
  }
  /** Any reaction by name (for lines that come with a gesture). */
  react(a: OwlAction, mood?: OwlMood) { this.queen.play(a); if (mood) this.queen.setMood(mood, 2); }
  /** Screen point (CSS px) above the queen's head, for her speech bubble. */
  queenScreen(): { x: number; y: number } {
    const p = this.queen.headWorld.clone().add(new THREE.Vector3(0, 0.55, 0)).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }
  standScreen(i: number): { x: number; y: number } {
    const s = this.stands[i];
    const p = s.group.position.clone().add(new THREE.Vector3(0, s.top + 0.7, 0)).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }

  private sparkleRain(x: number, y: number, z: number, n: number) {
    for (let k = 0; k < n; k++) this.fx.emit({ x: x + (Math.random() - 0.5) * 1.6, y: y + Math.random() * 0.6, z: z + (Math.random() - 0.5) * 0.8, vy: -0.3 - Math.random() * 0.4, life: 1 + Math.random() * 0.8, frame: SPR.spark1, frames: 3, fps: 8, color: k % 3 ? 0xdff4ff : 0xffe7a0, size: 0.22 + Math.random() * 0.18, add: true, delay: k * 0.03, flutter: 0.3 });
  }
  private owlFx(k: OwlFx, at: THREE.Vector3, n = 4) {
    if (k === 'heart') this.fx.burst('hearts', at.x, at.y, at.z, n);
    else if (k === 'note') this.fx.burst('notes', at.x, at.y, at.z, n);
    else if (k === 'sparkle') this.fx.burst('sparkle', at.x, at.y, at.z, n);
    else if (k === 'feather') for (let i = 0; i < n; i++) this.fx.emit({ x: at.x, y: at.y, z: at.z + 0.2, vx: (Math.random() - 0.5) * 1.2, vy: 0.4 + Math.random() * 0.6, vz: Math.random() * 0.5, life: 1.6, frame: SPR.feather1, frames: 3, fps: 4, color: 0xf4f8ff, size: 0.28, gravity: 0.6, drag: 1.5, flutter: 0.4 });
  }

  // ---------------------------------------------------------------- framing

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    const side = w >= h * 1.05 && w >= 640;
    this.layout = side ? 'side' : 'top';
    const c = this.camera;
    c.fov = side ? 30 : 32;
    if (side) {
      // shop UI on the left: centre the boutique at 72% across
      const fx = Math.min(0.74, 0.5 + Math.max(0.2, Math.min(0.25, 470 / w)));
      const dx = (fx - 0.5) * w, fullW = w + 2 * dx;
      c.aspect = fullW / h;
      c.setViewOffset(fullW, h, 0, 0, w, h);
      this.focus = { x: fx, y: 0.5 };
      // the room (about 9 x 5.4 units around the queen) fills ~52% of the width and 80% of the height
      const vh = 2 * Math.tan(THREE.MathUtils.degToRad(c.fov / 2));
      const dW = 9.4 / (vh * c.aspect * ((0.52 * w) / fullW)), dH = 5.6 / (vh * 0.8);
      this.place(Math.max(dW, dH), 0.2);
    } else {
      // portrait: the boutique fills the top of the screen above the shop sheet
      const fy = 0.25, dy = 0.3 * h, fullH = h + 2 * dy, y0 = h / 2 + dy - fy * h;
      c.aspect = w / fullH;
      c.setViewOffset(w, fullH, 0, Math.max(0, Math.min(2 * dy, y0)), w, h);
      this.focus = { x: 0.5, y: fy };
      const vh = 2 * Math.tan(THREE.MathUtils.degToRad(c.fov / 2));
      const dW = 8.3 / (vh * c.aspect), dH = 4.9 / (vh * ((0.34 * h) / fullH));
      this.place(Math.max(dW, dH), 0.22);
    }
    c.updateProjectionMatrix();
  }
  private place(dist: number, pitch: number) {
    const t = this.cam.target;
    this.cam.pos.set(t.x, t.y + Math.sin(pitch) * dist, t.z + Math.cos(pitch) * dist);
    this.camera.far = dist + 40;
    const f = this.scene.fog as THREE.Fog;
    f.near = dist + 4; f.far = dist + 34;
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number, t: number) {
    this.time += dt;
    this.enter = Math.min(1, this.enter + dt * 0.6);
    this.aurora.uniforms.uTime.value = t;
    // camera: a slow drift and a gentle push-in on arrival
    const e = 1 - Math.pow(1 - this.enter, 3);
    const drift = Math.sin(t * 0.13) * 0.18;
    this.camera.position.copy(this.cam.pos).add(new THREE.Vector3(drift, (1 - e) * 0.8, (1 - e) * 2.2));
    this.camera.lookAt(this.cam.target.x + drift * 0.4, this.cam.target.y, this.cam.target.z);

    // the chandelier sways and its light breathes
    this.chandelier.rotation.y = t * 0.12;
    this.chandelier.rotation.z = Math.sin(t * 0.6) * 0.015;
    this.chandLight.intensity = 9 + Math.sin(t * 1.3) * 0.6;

    // the queen: idle elegance, a curtsy on purchases, glances at her displays
    if (this.curtsy > 0) {
      this.curtsy = Math.max(0, this.curtsy - dt * 0.9);
      const p = 1 - this.curtsy, dip = Math.sin(Math.min(1, p * 1.4) * Math.PI);
      this.queen.node.position.y = -dip * 0.16;
      this.queen.node.rotation.x = dip * 0.16;
    } else { this.queen.node.position.y = 0; this.queen.node.rotation.x = 0; }
    this.queen.node.rotation.y = Math.sin(t * 0.35) * 0.08;
    if ((this.lookT -= dt) <= 0 && this.queen.lookAt) { this.queen.lookAt = null; this.clearFocus(); }
    if ((this.idleT -= dt) <= 0) {
      this.idleT = 7 + Math.random() * 8;
      const r = Math.random();
      if (r < 0.35) { const i = Math.floor(Math.random() * 3), s = this.stands[i]; this.queen.lookAt = s.group.position.clone().add(new THREE.Vector3(0, s.top + 0.5, 0)); this.lookT = 2.4; }
      else if (r < 0.55) this.queen.play('ruffle');
      else if (r < 0.7) this.queen.play('nod');
      else if (r < 0.8) this.queen.setMood('proud', 2.5);
      else { const h = this.queen.headWorld; this.fx.burst('sparkle', h.x, h.y + 0.3, h.z, 6); }
    }
    this.queen.update(dt);

    // stands: turntables, focus glow, bounces
    for (const s of this.stands) {
      s.bounce = Math.max(0, s.bounce - dt * 1.6);
      const b = Math.sin((1 - s.bounce) * Math.PI * 3) * s.bounce * 0.18;
      s.holder.position.y = s.top + Math.max(0, b) + Math.sin(t * 1.4 + s.pos.x) * 0.025;
      if (s.model) s.model.obj.rotation.y = Math.sin(t * 0.45 + s.pos.x * 0.7) * 0.65;
      (s.model?.obj.userData.animate as ((t: number, dt: number) => void) | null)?.(t, dt);
      const want = s.focus ? 0.9 : 0.25 + Math.sin(t * 2 + s.pos.x) * 0.08;
      s.ring.material.opacity += (want - s.ring.material.opacity) * Math.min(1, dt * 4);
      const k = (s.cone.material as THREE.ShaderMaterial).uniforms.uK;
      if (s.spot.intensity > 4) { const wk = s.focus ? 0.42 : 0.22; k.value += (wk - k.value) * Math.min(1, dt * 4); }
    }

    // snow drifting in through the window and falling softly all over the shop
    this.snowT -= dt;
    while (this.snowT <= 0) {
      this.snowT += 0.07;
      const fromWin = Math.random() < 0.45;
      const x = fromWin ? (Math.random() - 0.5) * 2.6 : (Math.random() - 0.5) * 13, y = fromWin ? 1.4 + Math.random() * 3.4 : 5.5 + Math.random();
      const z = fromWin ? -3.4 : -3 + Math.random() * 6;
      this.fx.emit({ x, y, z, vx: (Math.random() - 0.5) * 0.25, vy: fromWin ? -0.15 : -0.35 - Math.random() * 0.2, vz: fromWin ? 0.6 + Math.random() * 0.5 : 0.05, life: 7, frame: Math.random() < 0.3 ? SPR.spark1 : SPR.mote, color: 0xf4faff, size: 0.12 + Math.random() * 0.12, flutter: 0.35, drag: 0.15, fadeIn: 0.6, fadeOut: 1.4, add: Math.random() < 0.25 });
    }
    this.fx.update(dt, t);
  }

  // ---------------------------------------------------------------- input

  pointer(type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray): boolean {
    if (type === 'down') { this.downAt = { x, y, t: performance.now() }; return true; }
    if (type !== 'up' || !this.downAt) return true;
    const d = this.downAt;
    this.downAt = null;
    if (Math.hypot(x - d.x, y - d.y) > 10 || performance.now() - d.t > 700) return true;
    this.ray.ray.copy(ray);
    const hit = this.ray.intersectObjects(this.stands.map((s) => s.hit), false)[0];
    if (hit) { this.onPick?.(hit.object.userData.stand as number); return true; }
    const head = this.queen.headWorld;
    if (ray.distanceToPoint(head) < 0.9 || ray.distanceToPoint(this.queen.node.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.9, 0))) < 0.8) {
      this.queen.poke();
      this.onQueen?.();
    }
    return true;
  }

  dispose() {
    for (const s of this.stands) s.model?.dispose();
    this.queen.model.dispose();
    for (const f of this.disposables) f();
    this.scene.traverse((o) => { const m = (o as THREE.Sprite).material as THREE.SpriteMaterial | undefined; if ((o as THREE.Sprite).isSprite && m) { m.map?.dispose(); m.dispose(); } });
  }
}
