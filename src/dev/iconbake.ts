// [ui5] The icon bake: every interface icon is a little 3D model, lit, then pixel-finished. Models are the game's own
// GLBs where one exists (furniture, outfits, the firefly jar...) or small purpose-made models built here (enamel
// tokens, a brass padlock, an alarm clock, a burlap bag of glossy acorns...). Each is rendered big with a bright, soft
// studio light (a strong sky fill, a warm key from the top left, no cast shadows), then finished as pixel art: re-sampled
// to a few art pixels by the most common colour (crisp clusters, no blur), shaded in a few steps per colour with
// shadows leaning violet and lights leaning gold, brushed with a painterly break-up so every material keeps a
// hand-painted texture, a little more colour, and a coloured outline. Two sizes per icon (24 and 16 art px) so small
// icons stay clear; the currency (the acorn bag and the moon gem) also gets glinting idle frames.
//
//   /dev-iconbake.html               bake everything and show it on paper (big, then at 1:1)
//   /dev-iconbake.html?only=regex     just some
//   window.__module                   the generated src/ui/px/icons3d.ts (a tools script writes it to disk)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { instanceGLB } from '../gfx/glb.ts';

const q = new URLSearchParams(location.search);
const SS = 8; // supersampling per art pixel

// ------------------------------------------------------------------ renderer and light
const canvas = document.createElement('canvas');
const R = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
R.setClearColor(0x000000, 0);
R.outputColorSpace = THREE.SRGBColorSpace;
R.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
{
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pm.dispose();
}
scene.add(new THREE.HemisphereLight(0xfffaf0, 0xd9c7a6, 1.55));
const key = new THREE.DirectionalLight(0xfff0d8, 2.1); key.position.set(-3, 5, 4.5); scene.add(key);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.45); fill.position.set(4, 1, 3); scene.add(fill);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 500);

// ------------------------------------------------------------------ hand-painted material maps
function paintTex(kind: 'dab' | 'grain' | 'weave' | 'burlap' | 'scale', seed = 1): THREE.Texture {
  const n = 64, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, n, n);
  const dab = (x: number, y: number, w: number, h: number, v: number) => { g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(x, y, w, h, rnd() * 3, 0, Math.PI * 2); g.fill(); };
  if (kind === 'dab') for (let i = 0; i < 70; i++) dab(rnd() * n, rnd() * n, 3 + rnd() * 6, 2 + rnd() * 4, 205 + rnd() * 50);
  if (kind === 'grain') for (let y = 0; y < n; y += 2) { const v = 200 + rnd() * 55; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y + Math.sin(y) * 0.5, n, 1 + rnd() * 2); if (rnd() > 0.85) dab(rnd() * n, y, 3, 1.5, 180); }
  if (kind === 'weave' || kind === 'burlap') { const st = kind === 'burlap' ? 4 : 3; for (let y = 0; y < n; y += st) for (let x = 0; x < n; x += st) { const v = ((x + y) / st) % 2 ? 236 : 200 + rnd() * 20; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, st, st); } for (let i = 0; i < 20; i++) dab(rnd() * n, rnd() * n, 4 + rnd() * 6, 3, 210 + rnd() * 40); }
  if (kind === 'scale') for (let y = 0; y < n; y += 5) for (let x = (y / 5) % 2 ? 2 : 0; x < n; x += 5) { dab(x + 2, y + 2, 2.4, 2, 180); dab(x + 1.5, y + 1.5, 1.5, 1.1, 245); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TEX: Record<string, THREE.Texture> = {};
const tex = (k: Parameters<typeof paintTex>[0], seed = 1) => (TEX[k + seed] ??= paintTex(k, seed));

interface MOpt { metal?: number; rough?: number; tex?: Parameters<typeof paintTex>[0] | null; glow?: number; flat?: boolean; rep?: number; opacity?: number }
const mats = new Map<string, THREE.Material>();
/** a material: colour plus a hand-painted map (dabs unless told otherwise) */
function M(color: number, o: MOpt = {}): THREE.MeshStandardMaterial {
  const k = color + JSON.stringify(o);
  let m = mats.get(k) as THREE.MeshStandardMaterial | undefined;
  if (m) return m;
  const map = o.tex === null ? null : tex(o.tex ?? 'dab', color % 7);
  if (map && o.rep) { map.repeat.set(o.rep, o.rep); }
  m = new THREE.MeshStandardMaterial({ color, metalness: o.metal ?? 0, roughness: o.rough ?? 0.62, map, flatShading: !!o.flat, emissive: o.glow ? color : 0x000000, emissiveIntensity: o.glow ?? 0 });
  if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; }
  mats.set(k, m);
  return m;
}
const C = {
  brass: () => M(0xf4c24c, { metal: 0.38, rough: 0.34 }), gold: () => M(0xffd44a, { metal: 0.4, rough: 0.3 }), silver: () => M(0xe2e9f2, { metal: 0.35, rough: 0.32 }),
  iron: () => M(0x8d9aac, { metal: 0.3, rough: 0.42 }), wood: () => M(0xc07a3c, { tex: 'grain' }), dark: () => M(0x7a4524, { tex: 'grain' }), oak: () => M(0xe0a35a, { tex: 'grain' }),
  red: () => M(0xe8463c, { rough: 0.3 }), green: () => M(0x3fb85c, { rough: 0.3 }), blue: () => M(0x3d7fe0, { rough: 0.3 }), sky: () => M(0x62c0f2, { rough: 0.28 }),
  rose: () => M(0xf06a86, { rough: 0.3 }), plum: () => M(0x9a5cd0, { rough: 0.35 }), cream: () => M(0xfff0cc, { rough: 0.5 }), paper: () => M(0xf8ead0, { rough: 0.8, tex: 'grain' }),
  leaf: () => M(0x5cc04a, { rough: 0.55 }), leather: () => M(0xb84a30, { rough: 0.55, tex: 'dab' }), burlap: () => M(0xd6a560, { rough: 0.85, tex: 'burlap', rep: 2 }), white: () => M(0xffffff, { rough: 0.4 }),
  ink: () => M(0x33263a, { rough: 0.5, tex: null }), flame: () => M(0xffa030, { glow: 1.1, tex: null }), flameIn: () => M(0xfff07a, { glow: 1.2, tex: null }), glass: () => M(0xc4ecff, { rough: 0.08, metal: 0.1, tex: null }),
  kraft: () => M(0xd9a86a, { rough: 0.8, tex: 'weave' }), snow: () => M(0xf2f8ff, { rough: 0.5 }),
};

// ------------------------------------------------------------------ modelling helpers
type O = THREE.Object3D;
const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
function mesh(geo: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh { return new THREE.Mesh(geo, m); }
function grp(...ch: O[]): THREE.Group { const g = new THREE.Group(); for (const c of ch) g.add(c); return g; }
function at<T extends O>(o: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s: number | [number, number, number] = 1): T {
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
  if (Array.isArray(s)) o.scale.set(s[0], s[1], s[2]); else o.scale.setScalar(s);
  return o;
}
const shape = (pts: [number, number][]) => new THREE.Shape(pts.map(([x, y]) => V2(x, y)));
function circlePath(r: number, n = 40, cx = 0, cy = 0): [number, number][] { return Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]); }
function starPath(R: number, r: number, n = 5, rot = Math.PI / 2): [number, number][] { return Array.from({ length: n * 2 }, (_, i) => { const a = rot + (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r : R; return [Math.cos(a) * rr, Math.sin(a) * rr]; }); }
/** an extruded 2D shape with a rounded bevel, centred on z */
function ext(sh: THREE.Shape | THREE.Shape[], depth: number, m: THREE.Material, bevel = 0.1, segs = 3): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: segs, curveSegments: 24 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return mesh(g, m);
}
function lathe(pts: [number, number][], m: THREE.Material, seg = 32): THREE.Mesh { return mesh(new THREE.LatheGeometry(pts.map(([r, y]) => V2(Math.max(0.0001, r), y)), seg), m); }
function cyl(rt: number, rb: number, h: number, m: THREE.Material, seg = 28): THREE.Mesh { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); }
function ball(r: number, m: THREE.Material, w = 24, h = 16): THREE.Mesh { return mesh(new THREE.SphereGeometry(r, w, h), m); }
function tor(R0: number, r: number, m: THREE.Material, arc = Math.PI * 2): THREE.Mesh { return mesh(new THREE.TorusGeometry(R0, r, 12, 40, arc), m); }
function tube(pts: [number, number, number][], r: number, m: THREE.Material, closed = false): THREE.Mesh {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed);
  return mesh(new THREE.TubeGeometry(c, 48, r, 10, closed), m);
}
function rbox(w: number, h: number, d: number, m: THREE.Material, r = 0.08): THREE.Mesh { return mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.1, h / 2.1, d / 2.1)), m); }
/** a rounded bar from (x0, y0) to (x1, y1), thickness t, depth d */
function bar(x0: number, y0: number, x1: number, y1: number, t: number, d: number, m: THREE.Material): THREE.Mesh {
  const len = Math.hypot(x1 - x0, y1 - y0);
  return at(rbox(len + t, t, d, m, t * 0.48), (x0 + x1) / 2, (y0 + y1) / 2, 0, 0, 0, Math.atan2(y1 - y0, x1 - x0));
}
/** a round enamel button (a coin standing up, facing the viewer) */
function button(r: number, m: THREE.Material, d = 0.34): THREE.Mesh { return ext(shape(circlePath(r, 48)), d, m, 0.12, 4); }
function crescentShape(R0: number, cut: number, off: [number, number]): THREE.Shape {
  const s = new THREE.Shape(); s.absarc(0, 0, R0, 0, Math.PI * 2, false);
  const h = new THREE.Path(); h.absarc(off[0], off[1], cut, 0, Math.PI * 2, true);
  // a crescent: the outer disc minus an offset disc (via points sampled outside the cut)
  const pts: [number, number][] = [];
  for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2, x = Math.cos(a) * R0, y = Math.sin(a) * R0; if (Math.hypot(x - off[0], y - off[1]) > cut) pts.push([x, y]); }
  const inner: [number, number][] = [];
  for (let i = 64; i >= 0; i--) { const a = (i / 64) * Math.PI * 2, x = off[0] + Math.cos(a) * cut, y = off[1] + Math.sin(a) * cut; if (Math.hypot(x, y) < R0) inner.push([x, y]); }
  void s; void h;
  return shape([...pts, ...inner]);
}
const heartPath = (): [number, number][] => Array.from({ length: 60 }, (_, i) => { const t = (i / 60) * Math.PI * 2; return [16 * Math.sin(t) ** 3 / 16, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]; });
/** a glossy acorn: a golden nut, a scaly cap with a rim, a little stem */
function acorn(s = 1, tilt = 0): THREE.Group {
  const nut = lathe([[0, -0.62], [0.12, -0.6], [0.3, -0.45], [0.4, -0.2], [0.42, 0.02], [0.38, 0.14], [0, 0.16]], M(0xf5a62c, { rough: 0.2, tex: 'grain' }));
  const cap = lathe([[0, 0.42], [0.2, 0.38], [0.36, 0.28], [0.46, 0.14], [0.47, 0.06], [0.4, 0.04], [0, 0.06]], M(0x4a2a12, { rough: 0.8, tex: 'scale', rep: 2 }));
  const stem = at(cyl(0.035, 0.05, 0.2, C.dark()), 0.02, 0.5, 0, 0, 0, -0.3);
  return at(grp(nut, cap, stem), 0, 0, 0, 0, 0, tilt, s);
}
/** the acorn bag: a plump burlap sack tied at the neck with a red cord and bow, its ruffled top standing up, a golden
 * acorn stitched on the front, glossy acorns spilled at its foot */
function acornBag(o: { squash?: number; pouch?: 'burlap' | 'leather'; spill?: number; open?: boolean } = {}): THREE.Group {
  const sq = o.squash ?? 0, leather = o.pouch === 'leather';
  const m = leather ? M(0x9a3f26, { rough: 0.5, tex: 'dab' }) : M(0xc99a58, { rough: 0.9, tex: 'burlap', rep: 2 });
  const prof: [number, number][] = [[0, -0.8], [0.5, -0.78], [0.76, -0.6], [0.86, -0.3], [0.82, 0.0], [0.64, 0.24], [0.38, 0.4], [0.24, 0.46], [0.26, 0.54], [0.4, 0.68], [0.52, 0.84], [0.46, 0.9], [0.3, 0.8], [0.12, 0.7], [0, 0.68]];
  const body = lathe(prof, m, 40);
  const pos = body.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x);
    const ruffle = y > 0.56 ? 1 + Math.sin(a * 7) * 0.16 : 1;
    const k = (1 + Math.sin(a * 3 + y * 2) * 0.05 + Math.sin(a * 5 - 1) * 0.03) * ruffle;
    pos.setXYZ(i, x * k * (1 + sq * 0.5), (y > 0.56 ? y + Math.sin(a * 7) * 0.04 : y) * (1 - sq), z * k * (1 + sq * 0.5));
  }
  body.geometry.computeVertexNormals();
  const RED = M(0xe8363c, { rough: 0.4, tex: 'weave' });
  const cord = at(tor(0.28, 0.08, RED), 0, 0.46 * (1 - sq), 0, Math.PI / 2, 0, 0);
  const bow = grp(at(tor(0.15, 0.06, RED), -0.16, 0, 0, 0, 0.3, 0), at(tor(0.15, 0.06, RED), 0.16, 0, 0, 0, -0.3, 0), at(ball(0.08, RED), 0, 0, 0.02),
    bar(-0.02, -0.02, -0.16, -0.36, 0.08, 0.05, RED), bar(0.02, -0.02, 0.18, -0.36, 0.08, 0.05, RED));
  at(bow, 0.04, 0.44 * (1 - sq), 0.3);
  const g = grp(body, cord, bow);
  // a golden acorn stitched on the front
  const GOLD = M(0xffc83a, { rough: 0.5, tex: null }), CAPC = M(0x6a3a1a, { rough: 0.8, tex: null });
  const nutS = shape(Array.from({ length: 28 }, (_, i) => { const t = (i / 28) * Math.PI * 2, y = Math.cos(t); return [Math.sin(t) * 0.2 * (y < 0 ? 1 - (-y) * 0.35 : 1), y * 0.24 - 0.04] as [number, number]; }));
  const capS = shape(Array.from({ length: 18 }, (_, i) => { const t = (i / 17) * Math.PI; return [Math.cos(t) * 0.24, Math.sin(t) * 0.13] as [number, number]; }));
  g.add(at(grp(at(ext(nutS, 0.02, GOLD, 0.01), 0, -0.08, 0), at(ext(capS, 0.02, CAPC, 0.01), 0, 0.1, 0.01), at(rbox(0.04, 0.12, 0.03, CAPC, 0.01), 0.02, 0.27, 0.01)), 0.03, -0.22 * (1 - sq), 0.84, -0.12, 0.08, 0));
  const spill = o.spill ?? 2;
  if (spill > 0) g.add(at(acorn(0.6, 0.6), 0.7, -0.56, 0.52));
  if (spill > 1) g.add(at(acorn(0.5, -0.55), -0.64, -0.64, 0.5));
  return g;
}

// ------------------------------------------------------------------ the icon models
type Make = () => O | Promise<O>;
interface Spec { make: Make; yaw?: number; pitch?: number; pad?: number; vivid?: number }
const glb = (path: string, fix?: (o: O) => void): Make => async () => { const { root } = await instanceGLB(path); fix?.(root); return root; };
const flatOn = (o: O) => o; // tokens face the viewer
const T = 0.34; // token depth

const ICONS: Record<string, Spec> = {
  check: { make: () => grp(bar(-0.75, 0.05, -0.25, -0.5, 0.34, T, C.green()), bar(-0.25, -0.5, 0.8, 0.65, 0.34, T, C.green())), yaw: 0.35, pitch: 0.3 },
  cross: { make: () => grp(bar(-0.65, -0.65, 0.65, 0.65, 0.34, T, C.red()), bar(-0.65, 0.65, 0.65, -0.65, 0.34, T, C.red())), yaw: 0.35, pitch: 0.3 },
  plus: { make: () => grp(button(0.9, C.green()), at(grp(bar(-0.5, 0, 0.5, 0, 0.24, 0.16, C.cream()), bar(0, -0.5, 0, 0.5, 0.24, 0.16, C.cream())), 0, 0, 0.24)), yaw: 0.3, pitch: 0.25 },
  minus: { make: () => grp(button(0.9, C.rose()), at(bar(-0.5, 0, 0.5, 0, 0.24, 0.16, C.cream()), 0, 0, 0.24)), yaw: 0.3, pitch: 0.25 },
  info: { make: () => grp(button(0.9, C.blue()), at(grp(at(ball(0.13, C.cream()), 0, 0.42, 0), bar(0, -0.5, 0, 0.12, 0.22, 0.16, C.cream())), 0, 0, 0.24)), yaw: 0.3, pitch: 0.25 },
  arrow_right: { make: () => ext(shape([[-0.8, -0.22], [0.1, -0.22], [0.1, -0.6], [0.85, 0], [0.1, 0.6], [0.1, 0.22], [-0.8, 0.22]]), T, C.green(), 0.1), yaw: 0.35, pitch: 0.3 },
  arrow_left: { make: () => ext(shape([[0.8, -0.22], [-0.1, -0.22], [-0.1, -0.6], [-0.85, 0], [-0.1, 0.6], [-0.1, 0.22], [0.8, 0.22]]), T, C.green(), 0.1), yaw: 0.35, pitch: 0.3 },
  arrow_up: { make: () => ext(shape([[-0.22, -0.8], [0.22, -0.8], [0.22, 0.1], [0.6, 0.1], [0, 0.85], [-0.6, 0.1], [-0.22, 0.1]]), T, C.green(), 0.1), yaw: 0.35, pitch: 0.3 },
  arrow_down: { make: () => ext(shape([[-0.22, 0.8], [0.22, 0.8], [0.22, -0.1], [0.6, -0.1], [0, -0.85], [-0.6, -0.1], [-0.22, -0.1]]), T, C.rose(), 0.1), yaw: 0.35, pitch: 0.3 },
  rotate_right: { make: () => grp(at(tor(0.55, 0.15, C.sky(), Math.PI * 1.5), 0, 0, 0, 0, 0, Math.PI * 0.5), at(ext(shape([[-0.32, 0], [0.32, 0], [0, 0.36]]), 0.22, C.sky(), 0.06), 0.55, -0.02, 0, 0, 0, Math.PI)), yaw: 0.3, pitch: 0.3 },
  rotate_left: { make: () => grp(at(tor(0.55, 0.15, C.sky(), Math.PI * 1.5), 0, 0, 0, 0, Math.PI, Math.PI * 0.5), at(ext(shape([[-0.32, 0], [0.32, 0], [0, 0.36]]), 0.22, C.sky(), 0.06), -0.55, -0.02, 0, 0, 0, Math.PI)), yaw: 0.3, pitch: 0.3 },
  play: { make: () => ext(shape([[-0.5, -0.7], [0.75, 0], [-0.5, 0.7]]), T, C.green(), 0.14), yaw: 0.35, pitch: 0.25 },
  pause: { make: () => grp(at(rbox(0.36, 1.3, T + 0.1, C.blue(), 0.1), -0.3, 0, 0), at(rbox(0.36, 1.3, T + 0.1, C.blue(), 0.1), 0.3, 0, 0)), yaw: 0.35, pitch: 0.25 },
  lock: { make: () => grp(at(rbox(1.1, 0.85, 0.42, C.brass(), 0.12), 0, -0.28, 0), at(tor(0.32, 0.09, C.silver(), Math.PI), 0, 0.14, 0), at(cyl(0.09, 0.09, 0.5, C.silver()), -0.32, 0.02, 0), at(cyl(0.09, 0.09, 0.5, C.silver()), 0.32, 0.02, 0),
    at(grp(at(cyl(0.09, 0.09, 0.08, C.ink()), 0, 0, 0, Math.PI / 2), at(rbox(0.08, 0.2, 0.08, C.ink(), 0.02), 0, -0.12, 0)), 0, -0.26, 0.21)), yaw: 0.45, pitch: 0.3 },
  star: { make: () => ext(shape(starPath(0.95, 0.42)), 0.3, C.gold(), 0.16, 4), yaw: 0.35, pitch: 0.3 },
  heart: { make: () => ext(shape(heartPath().map(([x, y]) => [x * 0.95, y * 0.95 + 0.1])), 0.36, C.rose(), 0.18, 4), yaw: 0.35, pitch: 0.3 },
  sparkle: { make: () => grp(ext(shape(starPath(0.95, 0.22, 4)), 0.22, C.gold(), 0.1), at(ext(shape(starPath(0.35, 0.1, 4)), 0.14, C.cream(), 0.06), 0.62, 0.6, 0.1)), yaw: 0.3, pitch: 0.3 },
  moon: { make: () => ext(crescentShape(0.85, 0.72, [0.38, 0.22]), 0.3, M(0xffd86a, { rough: 0.4 }), 0.14), yaw: 0.35, pitch: 0.3 },
  sun: { make: () => { const g = grp(at(button(0.5, C.gold(), 0.3), 0, 0, 0.06)); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(at(ext(shape([[-0.15, 0], [0.15, 0], [0, 0.32]]), 0.16, M(0xffa83a, { rough: 0.35 }), 0.05), Math.cos(a) * 0.68, Math.sin(a) * 0.68, 0, 0, 0, a - Math.PI / 2)); } return g; }, yaw: 0.3, pitch: 0.3 },
  shield: { make: () => grp(ext(shape([[-0.75, 0.8], [0.75, 0.8], [0.75, 0.05], [0, -0.9], [-0.75, 0.05]]), 0.3, C.blue(), 0.14), at(ext(shape(starPath(0.38, 0.17)), 0.12, C.gold(), 0.06), 0, 0.05, 0.24)), yaw: 0.35, pitch: 0.3 },
  zzz: { make: () => { const Z = (s: number) => shape([[-0.5, 0.5], [0.5, 0.5], [0.5, 0.32], [-0.14, -0.32], [0.5, -0.32], [0.5, -0.5], [-0.5, -0.5], [-0.5, -0.32], [0.14, 0.32], [-0.5, 0.32]].map(([x, y]) => [x * s, y * s] as [number, number])); return grp(at(ext(Z(0.75), 0.22, C.sky(), 0.06), -0.45, -0.4, 0), at(ext(Z(0.55), 0.2, C.sky(), 0.05), 0.15, 0.2, 0), at(ext(Z(0.38), 0.18, C.sky(), 0.05), 0.62, 0.68, 0)); }, yaw: 0.3, pitch: 0.2 },
  bolt: { make: () => ext(shape([[0.15, 0.95], [-0.55, -0.1], [-0.05, -0.1], [-0.25, -0.95], [0.55, 0.15], [0.05, 0.15]]), 0.3, C.gold(), 0.1), yaw: 0.35, pitch: 0.3 },
  ice_flake: { make: () => { const g = grp(); for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; g.add(bar(-Math.cos(a) * 0.85, -Math.sin(a) * 0.85, Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0.16, 0.16, C.sky())); for (const s of [-1, 1]) { const cx = Math.cos(a) * 0.55 * s, cy = Math.sin(a) * 0.55 * s; g.add(bar(cx, cy, cx + Math.cos(a + 0.8) * 0.22 * s, cy + Math.sin(a + 0.8) * 0.22 * s, 0.1, 0.12, C.snow()), bar(cx, cy, cx + Math.cos(a - 0.8) * 0.22 * s, cy + Math.sin(a - 0.8) * 0.22 * s, 0.1, 0.12, C.snow())); } } return g; }, yaw: 0.3, pitch: 0.3 },
  alarm: { make: () => { const face = grp(at(cyl(0.62, 0.62, 0.38, C.red()), 0, 0, 0, Math.PI / 2), at(cyl(0.52, 0.52, 0.06, C.cream()), 0, 0, 0.2, Math.PI / 2), at(bar(0, 0, 0, 0.36, 0.07, 0.04, C.ink()), 0, 0, 0.25), at(bar(0, 0, 0.26, -0.1, 0.07, 0.04, C.ink()), 0, 0, 0.25), at(ball(0.06, C.gold()), 0, 0, 0.27));
    const bells = [-1, 1].map((s) => at(lathe([[0, 0.24], [0.2, 0.2], [0.27, 0.06], [0.28, 0], [0, 0]], C.brass()), s * 0.42, 0.56, 0, 0, 0, -s * 0.5));
    const legs = [-1, 1].map((s) => at(bar(0, 0, s * 0.14, -0.26, 0.1, 0.1, C.brass()), s * 0.36, -0.58, 0));
    return grp(face, ...bells, ...legs, at(tor(0.18, 0.05, C.brass(), Math.PI), 0, 0.64, 0)); }, yaw: 0.35, pitch: 0.2 },
  clock: { make: () => grp(at(cyl(0.9, 0.9, 0.26, C.wood()), 0, 0, 0, Math.PI / 2), at(cyl(0.76, 0.76, 0.06, C.cream()), 0, 0, 0.13, Math.PI / 2), ...Array.from({ length: 12 }, (_, i) => at(rbox(0.06, i % 3 ? 0.08 : 0.16, 0.03, C.ink(), 0.01), Math.sin((i / 12) * Math.PI * 2) * 0.62, Math.cos((i / 12) * Math.PI * 2) * 0.62, 0.17, 0, 0, -(i / 12) * Math.PI * 2)),
    at(bar(0, 0, 0, 0.5, 0.07, 0.04, C.ink()), 0, 0, 0.19), at(bar(0, 0, 0.36, -0.12, 0.08, 0.04, C.ink()), 0, 0, 0.19), at(ball(0.07, C.brass()), 0, 0, 0.2)), yaw: 0.3, pitch: 0.15 },
  hourglass: { make: () => grp(at(cyl(0.6, 0.6, 0.14, C.wood()), 0, 0.82, 0), at(cyl(0.6, 0.6, 0.14, C.wood()), 0, -0.82, 0), ...[-1, 1].map((s) => at(cyl(0.06, 0.06, 1.5, C.dark()), s * 0.5, 0, 0)),
    lathe([[0.42, -0.75], [0.44, -0.5], [0.3, -0.2], [0.08, 0], [0.3, 0.2], [0.44, 0.5], [0.42, 0.75]], M(0xbfe8ff, { rough: 0.05, metal: 0.1, opacity: 0.55, tex: null })), lathe([[0, -0.74], [0.4, -0.74], [0.3, -0.45], [0, -0.3]], M(0xf2c25a, { rough: 0.7 })), lathe([[0, 0.05], [0.18, 0.2], [0.28, 0.32], [0, 0.32]], M(0xf2c25a, { rough: 0.7 }))), yaw: 0.4, pitch: 0.2 },
  calendar: { make: () => grp(at(rbox(1.4, 1.3, 0.14, C.paper(), 0.06), 0, -0.1, 0), at(rbox(1.4, 0.36, 0.2, C.red(), 0.06), 0, 0.5, 0.02), ...[-0.4, 0.4].map((x) => at(tor(0.12, 0.04, C.brass()), x, 0.7, 0.02, 0, Math.PI / 2, 0)),
    ...Array.from({ length: 12 }, (_, i) => at(rbox(0.2, 0.16, 0.04, i === 6 ? C.red() : M(0xc9b08a, { tex: null }), 0.02), -0.45 + (i % 4) * 0.3, 0.12 - Math.floor(i / 4) * 0.27, 0.08))), yaw: 0.35, pitch: 0.25 },
  candle: { make: () => grp(lathe([[0, -0.75], [0.62, -0.72], [0.66, -0.62], [0.5, -0.6], [0, -0.6]], C.brass()), at(cyl(0.26, 0.28, 0.9, M(0xfff3d6, { rough: 0.6 })), 0, -0.15, 0), at(cyl(0.02, 0.02, 0.12, C.ink()), 0, 0.36, 0),
    at(lathe([[0, -0.2], [0.13, -0.1], [0.12, 0.05], [0.05, 0.2], [0, 0.28]], C.flame()), 0, 0.6, 0), at(lathe([[0, -0.12], [0.06, -0.05], [0.04, 0.08], [0, 0.14]], C.flameIn()), 0, 0.56, 0.05), at(tor(0.16, 0.05, C.brass(), Math.PI), 0.62, -0.62, 0, 0, 0, -Math.PI / 2)), yaw: 0.4, pitch: 0.25 },
  lantern: { make: () => grp(at(cyl(0.5, 0.56, 0.12, C.brass()), 0, -0.72, 0), at(cyl(0.36, 0.36, 1.0, M(0xffd77a, { glow: 0.75, tex: null })), 0, -0.14, 0), ...[0, 1, 2, 3].map((i) => at(cyl(0.05, 0.05, 1.04, C.brass()), Math.cos(i * Math.PI / 2 + 0.6) * 0.42, -0.14, Math.sin(i * Math.PI / 2 + 0.6) * 0.42)), at(lathe([[0.5, 0], [0.42, 0.14], [0.2, 0.3], [0, 0.34]], C.brass()), 0, 0.38, 0), at(tor(0.18, 0.05, C.brass()), 0, 0.82, 0), at(ball(0.1, M(0xfff6c8, { glow: 1, tex: null })), 0, -0.16, 0.3)), yaw: 0.4, pitch: 0.2 },
  nest: { make: () => grp(at(tor(0.62, 0.26, M(0xa8743c, { rough: 0.9, tex: 'grain', rep: 3 })), 0, -0.1, 0, Math.PI / 2, 0, 0, [1, 1, 0.75]), at(cyl(0.5, 0.4, 0.2, M(0x8a5a2c, { tex: 'grain' })), 0, -0.22, 0), ...[[-0.2, 0.05, 0.05], [0.18, 0.05, -0.05], [0, 0.04, 0.24]].map(([x, y, z]) => at(ball(0.26, M(0x8fd2f0, { rough: 0.3 })), x * 1.2, y + 0.12, z, 0.3, 0, 0, [0.85, 1.1, 0.85]))), yaw: 0.4, pitch: 0.5 },
  bell: { make: () => grp(at(cyl(0.72, 0.78, 0.14, C.wood()), 0, -0.62, 0), lathe([[0, 0.38], [0.18, 0.36], [0.4, 0.2], [0.56, -0.12], [0.66, -0.48], [0.68, -0.54], [0, -0.54]], C.brass()), at(cyl(0.06, 0.06, 0.16, C.brass()), 0, 0.46, 0), at(ball(0.11, C.brass()), 0, 0.56, 0)), yaw: 0.4, pitch: 0.35 },
  phone_off: { make: () => grp(at(rbox(0.85, 1.5, 0.16, M(0x3a3048, { rough: 0.4 }), 0.14), 0, 0, 0), at(rbox(0.7, 1.22, 0.04, M(0x5fa0e8, { rough: 0.2, glow: 0.25 }), 0.06), 0, 0.02, 0.08), at(bar(-0.7, -0.75, 0.7, 0.75, 0.2, 0.26, C.red()), 0, 0, 0.18)), yaw: 0.35, pitch: 0.2 },
  music: { make: () => grp(at(ball(0.24, C.blue()), -0.42, -0.58, 0, 0, 0, 0, [1.25, 0.95, 0.6]), at(ball(0.24, C.blue()), 0.46, -0.42, 0, 0, 0, 0, [1.25, 0.95, 0.6]), at(rbox(0.1, 1.2, 0.12, C.blue(), 0.04), -0.18, 0.0, 0), at(rbox(0.1, 1.2, 0.12, C.blue(), 0.04), 0.7, 0.16, 0), bar(-0.18, 0.56, 0.7, 0.74, 0.22, 0.14, C.blue())), yaw: 0.3, pitch: 0.2 },
  note: { make: () => grp(at(ball(0.3, C.blue()), -0.2, -0.55, 0, 0, 0, 0, [1.25, 0.95, 0.6]), at(rbox(0.12, 1.3, 0.12, C.blue(), 0.04), 0.13, 0.08, 0), at(ext(shape([[0, 0], [0.42, -0.3], [0.38, -0.5], [0, -0.26]]), 0.12, C.blue(), 0.04), 0.14, 0.74, 0)), yaw: 0.3, pitch: 0.2 },
  mic: { make: () => grp(at(cyl(0.3, 0.3, 0.5, M(0x8d97a6, { metal: 0.6, rough: 0.35, tex: 'weave', rep: 3 })), 0, 0.3, 0), at(ball(0.3, M(0x8d97a6, { metal: 0.6, rough: 0.35, tex: 'weave', rep: 3 })), 0, 0.55, 0), at(cyl(0.32, 0.32, 0.08, C.brass()), 0, 0.06, 0),
    at(tor(0.42, 0.05, C.brass(), Math.PI), 0, 0.18, 0, 0, 0, Math.PI), at(cyl(0.05, 0.05, 0.5, C.brass()), 0, -0.46, 0), at(cyl(0.38, 0.42, 0.1, C.dark()), 0, -0.72, 0)), yaw: 0.4, pitch: 0.25 },
  speaker_on: { make: () => grp(speaker(), at(tor(0.42, 0.08, C.sky(), 1.4), 0.12, 0, 0, 0, 0, -0.7), at(tor(0.72, 0.08, C.sky(), 1.3), 0.12, 0, 0, 0, 0, -0.65)), yaw: 0.25, pitch: 0.15 },
  speaker_off: { make: () => grp(speaker(), bar(0.32, -0.32, 0.88, 0.32, 0.18, 0.2, C.red()), bar(0.32, 0.32, 0.88, -0.32, 0.18, 0.2, C.red())), yaw: 0.25, pitch: 0.15 },
  rain: { make: () => grp(at(ball(0.42, C.snow()), -0.3, 0.3, 0), at(ball(0.5, C.snow()), 0.15, 0.42, -0.05), at(ball(0.36, C.snow()), 0.55, 0.26, 0), at(rbox(1.4, 0.36, 0.6, C.snow(), 0.18), 0.1, 0.12, 0),
    ...[[-0.3, -0.4], [0.2, -0.6], [0.6, -0.35]].map(([x, y]) => at(lathe([[0, -0.14], [0.1, -0.08], [0.09, 0.02], [0, 0.16]], C.sky()), x, y, 0.1, 0, 0, -0.2))), yaw: 0.3, pitch: 0.2 },
  drop: { make: () => lathe([[0, -0.8], [0.34, -0.72], [0.56, -0.45], [0.55, -0.15], [0.36, 0.25], [0.12, 0.65], [0, 0.85]], M(0x4fb2f0, { rough: 0.12, metal: 0.1 })), yaw: 0.3, pitch: 0.2 },
  waves: { make: () => grp(...[0.55, 0, -0.55].map((y, i) => tube(Array.from({ length: 9 }, (_, k) => [-0.9 + k * 0.225, y + Math.sin(k * 1.4 + i) * 0.13, 0] as [number, number, number]), 0.1, M([0x8ad6ff, 0x5fb8f0, 0x3d8fd8][i], { rough: 0.25 })))), yaw: 0.25, pitch: 0.2 },
  wind: { make: () => grp(...([[0.5, 0.9], [0, 1.1], [-0.5, 0.75]] as [number, number][]).map(([y, l]) => tube([[-0.9, y, 0], [-0.9 + l * 0.6, y, 0], [-0.9 + l, y + 0.08, 0], [-0.9 + l + 0.1, y + 0.28, 0], [-0.9 + l - 0.12, y + 0.36, 0]], 0.09, C.cream()))), yaw: 0.25, pitch: 0.2 },
  campfire: { make: () => grp(...[0.5, -0.5, 1.6].map((a) => at(cyl(0.13, 0.13, 1.3, C.dark()), 0, -0.6, 0, Math.PI / 2, a, 0)), ...[0, 2.1, 4.2].map((a) => at(rbox(0.26, 0.2, 0.22, M(0x9aa0a8, { rough: 0.8 }), 0.08), Math.cos(a) * 0.72, -0.76, Math.sin(a) * 0.72)),
    at(lathe([[0, -0.4], [0.36, -0.25], [0.36, 0], [0.2, 0.35], [0, 0.6]], C.flame()), 0, -0.1, 0), at(lathe([[0, -0.3], [0.2, -0.15], [0.16, 0.08], [0, 0.28]], C.flameIn()), 0, -0.18, 0.12)), yaw: 0.4, pitch: 0.35 },
  leaf: { make: () => grp(ext(shape(Array.from({ length: 40 }, (_, i) => { const t = (i / 40) * Math.PI * 2; return [Math.sin(t) * 0.5 * (1 - 0.3 * Math.cos(t)), Math.cos(t) * 0.92] as [number, number]; })), 0.12, C.leaf(), 0.06), at(rbox(0.06, 1.6, 0.06, M(0x3e8a32, { tex: null }), 0.02), 0, -0.15, 0.08)), yaw: 0.3, pitch: 0.3 },
  book: { make: () => grp(at(rbox(1.2, 1.5, 0.36, M(0xc0392b, { rough: 0.5, tex: 'dab' }), 0.08), 0, 0, 0), at(rbox(1.08, 1.4, 0.3, C.paper(), 0.04), 0.07, 0, 0), at(ext(crescentShape(0.3, 0.26, [0.13, 0.08]), 0.06, C.gold(), 0.02), 0, 0.05, 0.19)), yaw: 0.5, pitch: 0.25 },
  pen: { make: () => at(grp(at(cyl(0.14, 0.14, 1.2, M(0x2d4fa8, { rough: 0.25 })), 0, 0.15, 0), at(cyl(0.15, 0.15, 0.1, C.gold()), 0, -0.45, 0), at(lathe([[0.13, 0], [0.1, -0.2], [0, -0.42]], C.gold()), 0, -0.5, 0), at(rbox(0.06, 0.6, 0.06, C.gold(), 0.02), 0.15, 0.4, 0), at(ball(0.14, M(0x2d4fa8, { rough: 0.25 })), 0, 0.75, 0)), 0, 0, 0, 0, 0, -0.75), yaw: 0.3, pitch: 0.3 },
  jar: { make: () => grp(lathe([[0, -0.8], [0.52, -0.78], [0.58, -0.6], [0.58, 0.4], [0.44, 0.56], [0.36, 0.62], [0, 0.62]], M(0xbfe9f4, { rough: 0.08, metal: 0.15, tex: null })), at(cyl(0.4, 0.4, 0.18, C.brass()), 0, 0.7, 0), ...[[-0.2, -0.2], [0.18, 0.1], [0.05, -0.5], [-0.12, 0.28]].map(([x, y]) => at(ball(0.1, M(0xfff27a, { glow: 1.1, tex: null })), x, y, 0.52))), yaw: 0.4, pitch: 0.2 },
  hanger: { make: () => grp(tube([[-0.9, -0.4, 0], [0, 0.15, 0], [0.9, -0.4, 0], [0.8, -0.5, 0], [-0.8, -0.5, 0], [-0.9, -0.4, 0]], 0.08, C.wood()), at(tor(0.2, 0.05, C.brass(), Math.PI * 1.3), 0.05, 0.42, 0, 0, 0, -0.6), at(cyl(0.05, 0.05, 0.14, C.brass()), 0, 0.2, 0)), yaw: 0.3, pitch: 0.25 },
  brush: { make: () => at(grp(at(cyl(0.08, 0.11, 1.1, C.wood()), 0, -0.25, 0), at(cyl(0.14, 0.12, 0.3, C.silver()), 0, 0.42, 0), at(lathe([[0.14, 0], [0.16, 0.18], [0.1, 0.36], [0, 0.46]], M(0xf2d9a0, { tex: 'grain' })), 0, 0.56, 0), at(lathe([[0.1, 0], [0.06, 0.1], [0, 0.16]], M(0x3d7fe0, { rough: 0.2 })), 0, 0.88, 0)), 0, 0, 0, 0, 0, -0.75), yaw: 0.3, pitch: 0.3 },
  pushpin: { make: () => grp(at(cyl(0.02, 0.02, 0.6, C.silver()), 0.2, -0.45, 0, 0, 0, 0.5), at(cyl(0.44, 0.44, 0.14, C.red()), 0, 0, 0, 0, 0, 0.5), at(cyl(0.22, 0.3, 0.42, C.red()), -0.14, 0.22, 0, 0, 0, 0.5), at(cyl(0.36, 0.36, 0.14, C.red()), -0.26, 0.44, 0, 0, 0, 0.5)), yaw: 0.4, pitch: 0.3 },
  magnifier: { make: () => grp(at(tor(0.5, 0.1, C.brass()), -0.2, 0.25, 0), at(cyl(0.48, 0.48, 0.05, M(0xd2f0ff, { rough: 0.05, metal: 0.2, tex: null })), -0.2, 0.25, 0, Math.PI / 2), bar(0.18, -0.12, 0.75, -0.7, 0.18, 0.18, C.wood())), yaw: 0.3, pitch: 0.25 },
  clipboard: { make: () => grp(at(rbox(1.2, 1.55, 0.08, C.wood(), 0.06), 0, 0, 0), at(rbox(1.0, 1.25, 0.04, C.paper(), 0.02), 0, -0.07, 0.05), ...[0.25, 0.05, -0.15, -0.35].map((y) => at(rbox(0.7, 0.05, 0.02, M(0x8a7a8a, { tex: null }), 0.01), 0, y, 0.08)), at(rbox(0.5, 0.22, 0.14, C.silver(), 0.05), 0, 0.68, 0.06)), yaw: 0.3, pitch: 0.2 },
  satchel: { make: () => grp(at(rbox(1.3, 0.95, 0.42, C.leather(), 0.14), 0, -0.25, 0), at(rbox(1.32, 0.5, 0.12, M(0x8f3a24, { rough: 0.5, tex: 'dab' }), 0.08), 0, 0.02, 0.2), at(rbox(0.22, 0.2, 0.06, C.brass(), 0.03), 0, -0.2, 0.28), tube([[-0.6, 0.15, 0], [-0.5, 0.75, 0], [0, 0.95, 0], [0.5, 0.75, 0], [0.6, 0.15, 0]], 0.07, M(0x8f3a24, { rough: 0.5 }))), yaw: 0.35, pitch: 0.25 },
  map: { make: () => { const g = grp(); const tx = mapTex(); for (let i = 0; i < 3; i++) { const p = mesh(new THREE.PlaneGeometry(0.62, 1.4), new THREE.MeshStandardMaterial({ map: tx, side: THREE.DoubleSide, roughness: 0.8 })); const uv = p.geometry.attributes.uv as THREE.BufferAttribute; for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 3); g.add(at(p, -0.6 + i * 0.6, 0, i % 2 ? -0.12 : 0, 0, i % 2 ? 0.35 : -0.35, 0)); } return g; }, yaw: 0.2, pitch: 0.25 },
  gear: { make: () => { const pts: [number, number][] = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2, tooth = Math.floor((i / 64) * 8 * 4) % 4 < 2; pts.push([Math.cos(a) * (tooth ? 0.92 : 0.7), Math.sin(a) * (tooth ? 0.92 : 0.7)]); } const s = shape(pts); const h = new THREE.Path(); h.absarc(0, 0, 0.26, 0, Math.PI * 2, true); s.holes.push(h); return ext(s, 0.3, M(0xf4c24c, { metal: 0.38, rough: 0.34, tex: null }), 0.06); }, yaw: 0.35, pitch: 0.3 },
  treehouse: { make: () => grp(at(cyl(0.22, 0.34, 1.0, M(0x8a5a32, { tex: 'grain' })), 0, -0.45, 0), at(ball(0.55, C.leaf()), -0.3, 0.35, 0), at(ball(0.6, M(0x4aa83e)), 0.3, 0.45, -0.1), at(ball(0.5, M(0x6cc850)), 0, 0.72, 0.1), at(rbox(0.2, 0.28, 0.06, C.red(), 0.04), 0, -0.55, 0.31), at(ball(0.08, M(0xffe28a, { glow: 0.6, tex: null })), 0.2, 0.3, 0.55)), yaw: 0.3, pitch: 0.2 },
  birdhouse: { make: () => grp(at(rbox(0.9, 0.9, 0.8, C.oak(), 0.05), 0, -0.25, 0), at(rbox(0.66, 0.08, 1.0, C.red(), 0.03), -0.3, 0.38, 0, 0, 0, 0.72), at(rbox(0.66, 0.08, 1.0, C.red(), 0.03), 0.3, 0.38, 0, 0, 0, -0.72), at(cyl(0.16, 0.16, 0.06, C.ink()), 0, -0.15, 0.4, Math.PI / 2), at(cyl(0.035, 0.035, 0.3, C.dark()), 0, -0.45, 0.5, Math.PI / 2), at(cyl(0.06, 0.06, 0.5, C.dark()), 0, -0.9, 0)), yaw: 0.45, pitch: 0.2 },
  cursor_hand: { make: () => grp(at(rbox(0.8, 0.75, 0.36, M(0xffe0b8, { rough: 0.6 }), 0.18), 0, -0.35, 0), at(rbox(0.26, 0.8, 0.3, M(0xffe0b8, { rough: 0.6 }), 0.12), -0.18, 0.32, 0), ...[0, 0.22].map((x) => at(rbox(0.24, 0.4, 0.3, M(0xffe0b8, { rough: 0.6 }), 0.11), 0.08 + x, -0.02, 0.02)), at(rbox(0.26, 0.4, 0.3, M(0xffe0b8, { rough: 0.6 }), 0.11), -0.45, -0.38, 0.02, 0, 0, 0.6), at(rbox(0.86, 0.18, 0.4, C.sky(), 0.06), 0, -0.8, 0)), yaw: 0.3, pitch: 0.2 },
  stats: { make: () => grp(at(rbox(1.6, 0.14, 0.5, C.wood(), 0.04), 0, -0.82, 0), at(rbox(0.36, 0.7, 0.36, C.green(), 0.06), -0.5, -0.4, 0), at(rbox(0.36, 1.1, 0.36, C.gold(), 0.06), 0, -0.2, 0), at(rbox(0.36, 1.5, 0.36, C.blue(), 0.06), 0.5, 0, 0)), yaw: 0.45, pitch: 0.3 },
  nights: { make: () => grp(at(ext(crescentShape(0.65, 0.55, [0.3, 0.18]), 0.24, M(0xffd86a, { rough: 0.4 }), 0.1), -0.2, 0, 0), at(ext(shape(starPath(0.28, 0.12)), 0.14, C.gold(), 0.05), 0.62, 0.55, 0), at(ext(shape(starPath(0.2, 0.09)), 0.12, C.gold(), 0.05), 0.72, -0.35, 0)), yaw: 0.3, pitch: 0.3 },
  things: { make: glb('items/chest.glb'), yaw: 0.6, pitch: 0.35, vivid: 1.35 },
  seals: { make: () => { const pts: [number, number][] = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, r = 0.62 + Math.sin(a * 9) * 0.06; pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.2]); } return grp(at(ext(shape([[-0.15, -0.2], [0.05, -0.2], [-0.25, -1], [-0.45, -0.85]]), 0.05, C.red(), 0.02), 0, 0, -0.1), at(ext(shape([[0.15, -0.2], [-0.05, -0.2], [0.25, -1], [0.45, -0.85]]), 0.05, C.red(), 0.02), 0, 0, -0.1), ext(shape(pts), 0.2, M(0xc8343c, { rough: 0.35 }), 0.1), at(ext(shape(starPath(0.26, 0.12)), 0.06, M(0xa8262e, { rough: 0.4 }), 0.03), 0, 0.2, 0.14)); }, yaw: 0.3, pitch: 0.3 },
  wd_feather: { make: () => at(grp(ext(shape(Array.from({ length: 40 }, (_, i) => { const t = (i / 40) * Math.PI * 2; return [Math.sin(t) * 0.32 * (1 + 0.2 * Math.cos(t)), Math.cos(t) * 0.9 + 0.1] as [number, number]; })), 0.06, M(0xc9905a, { tex: 'grain' }), 0.03), at(cyl(0.03, 0.03, 2.0, C.cream()), 0, -0.05, 0.05)), 0, 0, 0, 0, 0, -0.6), yaw: 0.3, pitch: 0.3 },
  tophat: { make: () => grp(lathe([[0, -0.5], [0.95, -0.5], [0.98, -0.44], [0.6, -0.4], [0.55, 0.55], [0.6, 0.62], [0, 0.62]], M(0x3a2a52, { rough: 0.45, tex: 'weave' })), at(cyl(0.565, 0.57, 0.2, C.red()), 0, -0.26, 0)), yaw: 0.4, pitch: 0.35 },
  wd_glasses: { make: () => grp(...[-0.48, 0.48].map((x) => at(tor(0.36, 0.08, C.gold()), x, 0, 0)), ...[-0.48, 0.48].map((x) => at(cyl(0.33, 0.33, 0.04, M(0x8fd8ff, { rough: 0.1, metal: 0.2, tex: null })), x, 0, -0.01, Math.PI / 2)), at(tor(0.14, 0.06, C.gold(), Math.PI), 0, 0.08, 0), ...[-1, 1].map((sx) => at(bar(0, 0, sx * 0.3, -0.05, 0.07, 0.07, C.gold()), sx * 0.84, 0.1, -0.1, 0, sx * 0.9, 0))), yaw: 0.3, pitch: 0.2 },
  wd_scarf: { make: () => { const st = new THREE.MeshStandardMaterial({ map: stripeTex(['#e0363c', '#fff0cc'], [3, 1]), roughness: 0.7 }); return grp(tube([[-0.5, 0.55, 0], [0, 0.72, 0.2], [0.5, 0.55, 0], [0.55, 0.3, 0.1], [0.2, 0.15, 0.25], [-0.25, 0.2, 0.2], [-0.4, -0.3, 0.25], [-0.3, -0.85, 0.2]], 0.2, st), at(rbox(0.36, 0.5, 0.12, st, 0.05), 0.35, -0.45, 0.25, 0, 0, -0.25)); }, yaw: 0.3, pitch: 0.25 },
  wd_sweater: { make: () => sweater(), yaw: 0.3, pitch: 0.15 },
  wd_cape: { make: () => grp(ext(shape([[-0.32, 0.7], [0.32, 0.7], [0.82, -0.72], [0.5, -0.86], [0, -0.78], [-0.5, -0.86], [-0.82, -0.72]]), 0.16, M(0x7a4ad0, { rough: 0.5, tex: 'weave' }), 0.08), at(tor(0.32, 0.1, M(0xb07ae8, { rough: 0.5 })), 0, 0.68, 0.02, Math.PI / 2 - 0.3, 0, 0, [1, 1, 0.6]), at(ext(crescentShape(0.16, 0.14, [0.07, 0.04]), 0.06, C.gold(), 0.02), 0, 0.58, 0.18), ...[[-0.3, -0.2], [0.35, -0.45], [0.1, 0.1]].map(([x, y]) => at(ext(shape(starPath(0.08, 0.035)), 0.02, C.gold(), 0.01), x, y, 0.13))), yaw: 0.3, pitch: 0.2 },
  wd_mirror: { make: () => grp(at(tor(0.48, 0.1, C.brass()), 0, 0.3, 0, 0, 0, 0, [1, 1.2, 1]), at(cyl(0.47, 0.47, 0.06, M(0xcfeeff, { rough: 0.05, metal: 0.4, tex: null })), 0, 0.3, 0, Math.PI / 2, 0, 0, [1, 1, 1.2]), at(cyl(0.09, 0.11, 0.7, C.brass()), 0, -0.6, 0), at(ball(0.13, C.brass()), 0, -0.98, 0)), yaw: 0.3, pitch: 0.2 },
  wd_frame: { make: () => grp(at(tor(0.66, 0.2, C.brass()), 0, 0, 0), at(cyl(0.56, 0.56, 0.08, M(0x6ec2f0, { rough: 0.5 })), 0, 0, -0.05, Math.PI / 2), ...[0, 1, 2, 3].map((i) => at(ball(0.1, C.gold()), Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.66, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.66, 0.16))), yaw: 0.3, pitch: 0.2 },
  bp_box: { make: () => grp(rbox(1.3, 1.0, 1.0, C.kraft(), 0.05), at(rbox(1.32, 0.04, 0.3, M(0xe9d8a6, { tex: null }), 0.01), 0, 0.5, 0), at(rbox(0.3, 1.02, 0.04, M(0xe9d8a6, { tex: null }), 0.01), 0, 0, 0.5)), yaw: 0.6, pitch: 0.35 },
  bp_bed: { make: () => grp(at(rbox(1.0, 0.3, 1.6, C.wood(), 0.05), 0, -0.3, 0), at(rbox(0.94, 0.16, 1.5, C.white(), 0.06), 0, -0.08, 0), at(rbox(1.0, 0.14, 1.0, M(0x3d7fe0, { rough: 0.7, tex: 'weave' }), 0.06), 0, 0, 0.28), at(rbox(0.6, 0.18, 0.34, M(0xfff8ee, { rough: 0.7 }), 0.09), 0, 0.04, -0.5), at(rbox(1.04, 0.8, 0.14, C.wood(), 0.06), 0, 0.12, -0.8), ...[-1, 1].map((x) => at(cyl(0.06, 0.06, 0.5, C.dark()), x * 0.44, -0.55, 0.72))), yaw: 0.65, pitch: 0.42 },
  bp_chair: { make: glb('items/armchair.glb'), yaw: 0.6, pitch: 0.3, vivid: 1.35 },
  bp_table: { make: glb('items/round_table.glb'), yaw: 0.6, pitch: 0.35, vivid: 1.3 },
  bp_shelf: { make: () => { const g = grp(at(rbox(1.2, 1.7, 0.5, C.wood(), 0.05), 0, 0, -0.06), at(rbox(1.04, 1.54, 0.4, M(0x5a3018, { tex: 'grain' }), 0.02), 0, 0, 0.04), ...[-0.25, 0.3].map((y) => at(rbox(1.08, 0.08, 0.44, C.oak(), 0.02), 0, y, 0.06))); const cols = [0xe0453c, 0x3d7fe0, 0x3fb85c, 0xf4c24c, 0x9a5cd0, 0xf06a86]; for (const [row, y0] of [[0, -0.21], [1, 0.34]] as [number, number][]) for (let i = 0; i < 5; i++) { const h = 0.36 + ((i * 7 + row * 3) % 4) * 0.04; g.add(at(rbox(0.16, h, 0.32, M(cols[(i + row * 2) % 6], { rough: 0.6 }), 0.02), -0.38 + i * 0.19, y0 + h / 2, 0.1, 0, 0, i === 3 ? 0.18 : 0)); } return g; }, yaw: 0.35, pitch: 0.15 },
  bp_lamp: { make: () => grp(at(lathe([[0.34, 0], [0.62, -0.5], [0.66, -0.56], [0.6, -0.56], [0.3, -0.04]], M(0xffc46a, { rough: 0.8, glow: 0.35, tex: 'weave' })), 0, 0.72, 0), at(cyl(0.05, 0.05, 1.0, C.brass()), 0, -0.2, 0), at(lathe([[0, -0.86], [0.5, -0.84], [0.52, -0.76], [0.22, -0.66], [0.06, -0.6], [0, -0.6]], C.brass()), 0, 0, 0), at(ball(0.12, M(0xfff4c0, { glow: 1, tex: null })), 0, 0.3, 0)), yaw: 0.4, pitch: 0.25 },
  bp_plant: { make: glb('items/fernpot.glb'), yaw: 0.5, pitch: 0.3, vivid: 1.3 },
  bp_rug: { make: () => at(mesh(new THREE.CylinderGeometry(1, 1, 0.08, 48), new THREE.MeshStandardMaterial({ map: ringTex(), roughness: 0.9 })), 0, 0, 0, 0, 0, 0, [1, 1, 0.75]), yaw: 0.2, pitch: 0.95 },
  bp_wall: { make: glb('items/painting.glb'), yaw: 0.25, pitch: 0.1, vivid: 1.3 },
  bp_decor: { make: () => grp(lathe([[0, -0.85], [0.36, -0.84], [0.48, -0.5], [0.44, -0.2], [0.2, 0.05], [0.24, 0.16], [0, 0.16]], M(0x3d8fd8, { rough: 0.3 })), ...[[-0.3, 0.75, 0xf06a86], [0.1, 0.9, 0xffd44a], [0.38, 0.62, 0xf5f0ff]].map(([x, y, c]) => grp(tube([[0, 0.1, 0], [x * 0.5, y * 0.6, 0], [x, y, 0]], 0.04, M(0x3e9a3a, { tex: null })), at(ball(0.2, M(c, { rough: 0.6 })), x, y, 0.04, 0, 0, 0, [1, 0.8, 1]), at(ball(0.07, M(0xffe070, { tex: null })), x, y, 0.2)))), yaw: 0.35, pitch: 0.2 },
  bp_fun: { make: () => at(mesh(new THREE.SphereGeometry(0.85, 32, 20), new THREE.MeshStandardMaterial({ map: stripeTex(['#e0363c', '#ffd44a', '#3d7fe0', '#fff6e8'], [1, 1, 1, 1], true), roughness: 0.3 })), 0, 0, 0, 0.5, 0.3, 0.4), yaw: 0.3, pitch: 0.3 },
  bp_wallpaper: { make: () => { const t = stripeTex(); const roll = mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.5, 28), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })); const sheet = mesh(new THREE.PlaneGeometry(0.9, 1.5), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, side: THREE.DoubleSide })); return grp(at(roll, -0.35, 0, 0), at(sheet, 0.4, -0.1, 0.25, -0.2, -0.3, 0)); }, yaw: 0.4, pitch: 0.25 },
  bp_floor: { make: () => grp(...[-0.5, 0, 0.5].map((x, i) => at(rbox(0.46, 0.12, 1.5, [C.wood(), C.oak(), C.dark()][i], 0.03), x, 0, i === 1 ? 0.15 : 0))), yaw: 0.5, pitch: 0.6 },
  bp_season: { make: () => grp(rbox(1.1, 0.9, 1.1, M(0xe0363c, { rough: 0.5 }), 0.06), at(rbox(1.16, 0.2, 1.16, M(0xe0363c, { rough: 0.5 }), 0.05), 0, 0.5, 0), at(rbox(0.2, 0.96, 1.14, C.gold(), 0.03), 0, 0.02, 0), at(rbox(1.14, 0.96, 0.2, C.gold(), 0.03), 0, 0.02, 0), at(tor(0.2, 0.07, C.gold()), -0.18, 0.72, 0, 0, 0.4, 0.4), at(tor(0.2, 0.07, C.gold()), 0.18, 0.72, 0, 0, -0.4, -0.4)), yaw: 0.6, pitch: 0.35 },
  bp_move: { make: () => { const s = shape([[-0.12, 0.12], [-0.12, 0.5], [-0.32, 0.5], [0, 0.9], [0.32, 0.5], [0.12, 0.5], [0.12, 0.12], [0.5, 0.12], [0.5, 0.32], [0.9, 0], [0.5, -0.32], [0.5, -0.12], [0.12, -0.12], [0.12, -0.5], [0.32, -0.5], [0, -0.9], [-0.32, -0.5], [-0.12, -0.5], [-0.12, -0.12], [-0.5, -0.12], [-0.5, -0.32], [-0.9, 0], [-0.5, 0.32], [-0.5, 0.12]]); return ext(s, 0.26, C.sky(), 0.08); }, yaw: 0.35, pitch: 0.3 },
  bp_buy: { make: () => { const s = shape([[-0.8, -0.45], [0.35, -0.45], [0.85, 0], [0.35, 0.45], [-0.8, 0.45]]); const h = new THREE.Path(); h.absarc(0.45, 0, 0.1, 0, Math.PI * 2, true); s.holes.push(h); return grp(at(ext(s, 0.1, C.kraft(), 0.04), 0, 0, 0, 0, 0, 0.4), at(acorn(0.5, 0.3), -0.25, -0.1, 0.25, 0, 0, 0.4)); }, yaw: 0.3, pitch: 0.3 },
  // the side tools
  tool_build: { make: () => at(grp(at(cyl(0.1, 0.12, 1.5, C.wood()), 0, -0.25, 0), at(rbox(0.9, 0.34, 0.34, C.iron(), 0.06), 0, 0.55, 0), at(rbox(0.3, 0.3, 0.3, C.iron(), 0.04), -0.5, 0.55, 0), at(ext(shape([[0.45, 0.4], [0.8, 0.62], [0.82, 0.48], [0.45, 0.7]]), 0.3, C.iron(), 0.04), 0, 0, 0)), 0, 0, 0, 0, 0, 0.6), yaw: 0.4, pitch: 0.3 },
  tool_shop: { make: () => grp(lathe([[0, -0.6], [0.7, -0.58], [0.86, 0.1], [0.84, 0.16], [0, 0.16]], M(0xd9a050, { rough: 0.9, tex: 'weave', rep: 2 })), at(tor(0.78, 0.06, M(0xb07a3a, { tex: 'grain' }), Math.PI), 0, 0.15, 0), at(ball(0.3, M(0xe0363c, { rough: 0.3 })), -0.3, 0.3, 0.1), at(acorn(0.62, 0.3), 0.22, 0.38, 0.12), at(ball(0.22, M(0x7ad04a, { rough: 0.4 })), 0.05, 0.25, -0.32), at(rbox(0.9, 0.05, 0.6, M(0xf4e4c4, { tex: 'weave' }), 0.02), 0, 0.17, 0.1, 0.1)), yaw: 0.35, pitch: 0.3 },
  tool_dress: { make: () => grp(at(ICONS.hanger.make() as O, 0, 0.62, -0.05, 0, 0, 0, 0.75), at(sweater(0xe0457a), 0, -0.25, 0, 0, 0, 0, 0.82)), yaw: 0.3, pitch: 0.15 },
  tool_quests: { make: () => grp(at(rbox(1.0, 1.2, 0.04, C.paper(), 0.02), 0, -0.05, 0, 0, 0, 0.05), at(cyl(0.16, 0.16, 1.2, C.paper()), 0, 0.62, 0, 0, 0, Math.PI / 2), at(cyl(0.16, 0.16, 1.2, C.paper()), 0, -0.68, 0, 0, 0, Math.PI / 2), ...[0.25, 0.02, -0.21].map((y) => at(rbox(0.6, 0.05, 0.02, M(0x8a6a5a, { tex: null }), 0.01), -0.05, y, 0.04)), at(ext(shape(circlePath(0.2, 20)), 0.08, M(0xc8343c, { rough: 0.35 }), 0.04), 0.3, -0.4, 0.06)), yaw: 0.3, pitch: 0.2 },
  tool_map: { make: () => grp(at(cyl(0.85, 0.85, 0.22, C.brass()), 0, 0, 0, Math.PI / 2), at(cyl(0.72, 0.72, 0.06, C.cream()), 0, 0, 0.1, Math.PI / 2), at(ext(shape([[0, 0.62], [0.12, 0], [-0.12, 0]]), 0.05, C.red(), 0.02), 0, 0, 0.15), at(ext(shape([[0, -0.62], [0.12, 0], [-0.12, 0]]), 0.05, M(0x3a4a62, { tex: null }), 0.02), 0, 0, 0.15), at(ball(0.07, C.brass()), 0, 0, 0.18), at(tor(0.14, 0.05, C.brass()), 0, 0.95, 0)), yaw: 0.3, pitch: 0.2 },
  tool_settings: { make: () => grp(at(ICONS.gear.make() as O, -0.12, 0.1, 0, 0, 0, 0, 0.85), at(ICONS.gear.make() as O, 0.55, -0.55, 0.05, 0, 0, 0.3, 0.42)), yaw: 0.35, pitch: 0.3 },
  // the currency
  owlcoin: { make: () => acornBag(), yaw: 0.3, pitch: 0.2 },
  coin_pouch: { make: () => acornBag({ pouch: 'leather', spill: 1 }), yaw: 0.35, pitch: 0.18 },
  coin_sack: { make: () => grp(at(acornBag({ spill: 0 }), 0, 0, 0, 0, 0, 0, [1.15, 1.1, 1.15]), at(acorn(0.42, 1.2), 0.7, -0.66, 0.4), at(acorn(0.38, -0.8), -0.72, -0.7, 0.3), at(acorn(0.36, 0.2), 0.1, -0.78, 0.7)), yaw: 0.35, pitch: 0.2 },
  coin_chest: { make: () => grp(lathe([[0, -0.6], [0.7, -0.6], [0.82, 0.3], [0.78, 0.34], [0, 0.34]], C.oak()), at(tor(0.76, 0.04, C.iron()), 0, -0.2, 0, Math.PI / 2), at(tor(0.8, 0.04, C.iron()), 0, 0.22, 0, Math.PI / 2), ...[[-0.3, 0.5, 0.2], [0.25, 0.52, 0.1], [0, 0.68, -0.1], [-0.05, 0.5, 0.45], [0.42, 0.42, -0.3], [-0.45, 0.42, -0.25], [0.1, 0.84, 0.15]].map(([x, y, z], i) => at(acorn(0.4, i - 3), x, y, z)), at(tor(0.6, 0.04, C.iron(), Math.PI), 0, 0.34, 0, 0, 0, 0)), yaw: 0.35, pitch: 0.3 },
  coin_vault: { make: () => grp(at(acornBag({ spill: 0 }), -0.4, 0.05, -0.3, 0, 0.3, 0, 0.8), at(acornBag({ spill: 0, pouch: 'leather' }), 0.5, -0.05, -0.2, 0, -0.4, 0, 0.7), ...Array.from({ length: 9 }, (_, i) => at(acorn(0.36, i * 0.7), -0.8 + (i % 5) * 0.4, -0.75 + Math.floor(i / 5) * 0.2, 0.4 + (i % 2) * 0.15)), at(lathe([[0, -0.3], [0.2, -0.05], [0.22, 0], [0.12, 0.15], [0, 0.18]], M(0xb7a0f0, { rough: 0.15, flat: true, tex: null }), 6), 0.1, -0.55, 0.65, 0.2, 0, 0.3)), yaw: 0.3, pitch: 0.25 },
  moongem: { make: () => moonGem(), yaw: 0.35, pitch: 0.2 },
};
function sweater(col = 0x3fae5a): O {
  const knit = M(col, { rough: 0.85, tex: 'weave', rep: 2 });
  const body = ext(shape([[-0.5, 0.62], [-0.18, 0.7], [0.18, 0.7], [0.5, 0.62], [0.95, 0.15], [0.78, -0.05], [0.5, 0.2], [0.48, -0.75], [-0.48, -0.75], [-0.5, 0.2], [-0.78, -0.05], [-0.95, 0.15]]), 0.3, knit, 0.12);
  const collar = at(tor(0.2, 0.07, M(0xfff0cc, { rough: 0.8, tex: 'weave' }), Math.PI), 0, 0.68, 0.06, 0, 0, Math.PI);
  const hem = at(rbox(0.98, 0.14, 0.44, M(0xfff0cc, { rough: 0.8, tex: 'weave' }), 0.05), 0, -0.72, 0);
  const heart = at(ext(shape(heartPath().map(([x, y]) => [x * 0.2, y * 0.2])), 0.04, M(0xfff0cc, { rough: 0.7, tex: null }), 0.02), 0, 0.02, 0.24);
  return grp(body, collar, hem, heart);
}
function speaker(): O {
  return grp(at(rbox(0.36, 0.6, 0.5, C.brass(), 0.08), -0.55, 0, 0), at(lathe([[0.16, 0], [0.24, 0.2], [0.5, 0.5], [0.56, 0.52], [0.5, 0.54], [0.2, 0.25], [0.12, 0.02]], C.brass()), -0.42, 0, 0, 0, 0, -Math.PI / 2), at(cyl(0.48, 0.48, 0.04, M(0x5a3a28, { tex: 'weave' })), 0.08, 0, 0, 0, 0, Math.PI / 2));
}
function moonGem(): O {
  const gem = lathe([[0, -0.9], [0.62, -0.05], [0.7, 0.12], [0.5, 0.42], [0, 0.48]], M(0xb59cf2, { rough: 0.12, metal: 0.15, flat: true, tex: null }), 8);
  gem.rotation.y = Math.PI / 8;
  const moon = at(ext(crescentShape(0.22, 0.19, [0.09, 0.05]), 0.06, M(0xffd86a, { glow: 0.35, rough: 0.3, tex: null }), 0.02), 0, 0.05, 0.6);
  return grp(gem, moon);
}
const texCache = new Map<string, THREE.Texture>();
function mapTex(): THREE.Texture {
  const hit = texCache.get('map'); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = 96; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4e2b4'; g.fillRect(0, 0, 96, 64);
  g.fillStyle = '#7cc0e8'; g.beginPath(); g.ellipse(70, 20, 22, 14, 0.3, 0, 7); g.fill();
  g.fillStyle = '#8fcf6a'; for (const [x, y, r] of [[22, 40, 14], [40, 16, 10], [60, 48, 12]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.fillStyle = '#4a9a48'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(10 + (i * 37) % 80, 8 + (i * 23) % 50, 3, 0, 7); g.fill(); }
  g.strokeStyle = '#d23a3a'; g.lineWidth = 2.4; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(8, 56); g.bezierCurveTo(30, 30, 50, 60, 84, 12); g.stroke();
  g.setLineDash([]); g.lineWidth = 3; g.beginPath(); g.moveTo(80, 8); g.lineTo(88, 16); g.moveTo(88, 8); g.lineTo(80, 16); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set('map', t); return t;
}
function stripeTex(cols?: string[], widths?: number[], vertical = false): THREE.Texture {
  const key = 'st' + JSON.stringify([cols, widths, vertical]), hit = texCache.get(key); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  if (!cols) {
    g.fillStyle = '#f7d9e0'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#e8708a'; for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 3, 32);
    g.fillStyle = '#fff6da'; for (let y = 4; y < 32; y += 10) for (let x = 5; x < 32; x += 8) g.fillRect(x, y, 2, 2);
  } else {
    const tot = (widths ?? cols.map(() => 1)).reduce((a, b) => a + b, 0);
    let x = 0;
    cols.forEach((col, i) => { const w = ((widths?.[i] ?? 1) / tot) * 32; g.fillStyle = col; if (vertical) g.fillRect(x, 0, w + 0.5, 32); else g.fillRect(0, x, 32, w + 0.5); x += w; });
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(cols ? (vertical ? 1 : 4) : 2, cols ? (vertical ? 1 : 4) : 3); texCache.set(key, t); return t;
}
function ringTex(): THREE.Texture {
  const hit = texCache.get('ring'); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const cols = ['#e0453c', '#fff0cc', '#3fae5a', '#ffd44a', '#3d7fe0', '#fff0cc', '#e0453c'];
  for (let i = 0; i < cols.length; i++) { g.fillStyle = cols[i]; g.beginPath(); g.arc(32, 32, 32 - i * 4.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set('ring', t); return t;
}
void flatOn;

// ------------------------------------------------------------------ render + pixel finish
function shoot(obj: O, n: number, yaw: number, pitch: number, pad = 1.04): ImageData {
  const S = n * SS;
  R.setSize(S, S, false);
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3()).length() || 1;
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  cam.position.copy(c).addScaledVector(dir, size * 3);
  cam.near = size * 0.1; cam.far = size * 8;
  cam.lookAt(c); cam.updateMatrixWorld();
  const pb = new THREE.Box3();
  // fit the projected bounds of the actual vertices (tighter than the box corners)
  obj.traverse((m) => {
    const g = (m as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!g?.attributes?.position) return;
    const p = g.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
    const step = Math.max(1, Math.floor(p.count / 600));
    for (let i = 0; i < p.count; i += step) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).applyMatrix4(cam.matrixWorldInverse); pb.expandByPoint(v); }
  });
  // leave one art pixel each side for the outline
  const half = (Math.max(pb.max.x - pb.min.x, pb.max.y - pb.min.y) / 2) * pad * (n / (n - 2.2)), mx = (pb.max.x + pb.min.x) / 2, my = (pb.max.y + pb.min.y) / 2;
  cam.left = mx - half; cam.right = mx + half; cam.top = my + half; cam.bottom = my - half;
  cam.updateProjectionMatrix();
  R.render(scene, cam);
  scene.remove(obj);
  obj.traverse((m) => { const g = (m as THREE.Mesh).geometry as THREE.BufferGeometry | undefined; g?.dispose?.(); });
  const out = document.createElement('canvas');
  out.width = out.height = S;
  const g2 = out.getContext('2d', { willReadFrequently: true })!;
  g2.drawImage(R.domElement, 0, 0);
  return g2.getImageData(0, 0, S, S);
}

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
function hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function rgb(h: number, s: number, l: number): [number, number, number] {
  const f = (p: number, q: number, t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}
const hash = (x: number, y: number, s: number) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x: number, y: number, s: number) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }

/** The pixel finish: n x n art pixels from the supersampled render. */
function pixelFinish(src: ImageData, n: number, seed: number, vivid = 1): ImageData {
  const S = src.width, sd = src.data, out = new ImageData(n, n), d = out.data;
  const solid = new Uint8Array(n * n);
  const k = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const buckets = new Map<number, [number, number, number, number]>();
    let opaque = 0, tot = 0;
    for (let j = Math.floor(y * k); j < Math.floor((y + 1) * k); j++) for (let i = Math.floor(x * k); i < Math.floor((x + 1) * k); i++) {
      const o = (j * S + i) * 4; tot++;
      if (sd[o + 3] < 128) continue;
      opaque++;
      const key = ((sd[o] >> 4) << 8) | ((sd[o + 1] >> 4) << 4) | (sd[o + 2] >> 4);
      const b = buckets.get(key) ?? [0, 0, 0, 0];
      b[0] += sd[o]; b[1] += sd[o + 1]; b[2] += sd[o + 2]; b[3]++;
      buckets.set(key, b);
    }
    if (opaque / tot < 0.42) continue;
    let best: [number, number, number, number] | null = null;
    for (const b of buckets.values()) if (!best || b[3] > best[3]) best = b;
    const [r, g, b] = [best![0] / best![3], best![1] / best![3], best![2] / best![3]];
    // a pixel artist's ramp: lightness in a few steps (broken up by a painterly noise), shadows lean violet, lights gold
    let [h, s, l] = hsl(r, g, b);
    const brush = (vnoise(x * 0.55, y * 0.55, seed) - 0.5) * 0.09 + (hash(x, y, seed + 7) - 0.5) * 0.035;
    const steps = 6;
    let lq = Math.round((l + brush) * steps) / steps;
    lq = clamp(lq * 0.92 + 0.07, 0.06, 0.97);
    const warm = lq - 0.5;
    // hue drift towards gold in light, towards violet-blue in shadow (only for coloured pixels)
    if (s > 0.08) { const target = warm > 0 ? 0.12 : 0.72; let dh = target - h; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1; h = (h + dh * Math.min(0.1, Math.abs(warm) * 0.22) + 1) % 1; }
    s = clamp(s * 1.22 * vivid + 0.03 * (s > 0.08 ? 1 : 0), 0, 0.95);
    const c = rgb(h, s, lq);
    const o = (y * n + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    solid[y * n + x] = 1;
  }
  // a coloured outline: the darkest neighbour, darker and leaning plum; softer on the lit (top-left) side
  const add: [number, number[]][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (solid[y * n + x]) continue;
    let best: number[] | null = null, lit = false, shade = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= n || Y >= n || !solid[Y * n + X]) continue;
      if (dx > 0 || dy > 0) lit = true; else shade = true;
      const o = (Y * n + X) * 4, c = [d[o] * 0.36 + 16, d[o + 1] * 0.28 + 8, d[o + 2] * 0.36 + 22];
      if (!best || c[0] + c[1] + c[2] < best[0] + best[1] + best[2]) best = c;
    }
    if (!best) continue;
    if (lit && !shade) best = [best[0] * 1.25 + 10, best[1] * 1.2 + 6, best[2] * 1.12 + 6];
    add.push([y * n + x, best]);
  }
  for (const [i, c] of add) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
  return out;
}

/** glint and twinkle overlays for the currency's idle frames */
function sparkleAt(img: ImageData, x: number, y: number, arm: number, col = [255, 252, 238]) {
  const n = img.width, d = img.data;
  const put = (px: number, py: number, a: number) => { if (px < 0 || py < 0 || px >= n || py >= n) return; const o = (py * n + px) * 4; const t = a / 255; d[o] = d[o] * (1 - t) + col[0] * t; d[o + 1] = d[o + 1] * (1 - t) + col[1] * t; d[o + 2] = d[o + 2] * (1 - t) + col[2] * t; d[o + 3] = Math.max(d[o + 3], a); };
  put(x, y, 255);
  for (let k = 1; k <= arm; k++) { const a = k === arm ? 150 : 225; put(x - k, y, a); put(x + k, y, a); put(x, y - k, a); put(x, y + k, a); }
}
function glint(img: ImageData, f: number) {
  // a bright diagonal band sweeping across the solid pixels on frames 2..5
  const n = img.width, d = img.data, pos = [-99, -99, 0.25, 0.42, 0.6, 0.78, -99, -99][f] * n * 2;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const o = (y * n + x) * 4;
    if (d[o + 3] < 255) continue;
    const t = Math.abs(x + y - pos);
    if (t < 1.2) { d[o] = d[o] + (255 - d[o]) * 0.55; d[o + 1] = d[o + 1] + (250 - d[o + 1]) * 0.55; d[o + 2] = d[o + 2] + (225 - d[o + 2]) * 0.45; }
  }
}

// ------------------------------------------------------------------ encoding (palette + run-length, base64)
function encode(img: ImageData): { w: number; h: number; p: string; d: string } {
  const d = img.data, pal: string[] = [], map = new Map<string, number>(), idx: number[] = [];
  for (let i = 0; i < img.width * img.height; i++) {
    if (d[i * 4 + 3] < 128) { idx.push(0); continue; }
    const h = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    let k = map.get(h);
    if (k === undefined) { k = Math.min(255, pal.length + 1); if (pal.length < 255) { map.set(h, k); pal.push(h); } }
    idx.push(k);
  }
  const bytes: number[] = [];
  for (let i = 0; i < idx.length;) { let j = i; while (j < idx.length && idx[j] === idx[i] && j - i < 255) j++; bytes.push(j - i, idx[i]); i = j; }
  let bin = '';
  for (const v of bytes) bin += String.fromCharCode(v);
  return { w: img.width, h: img.height, p: pal.join(''), d: btoa(bin) };
}

// ------------------------------------------------------------------ the bake
const SIZES = { L: 24, S: 16 };
/** the currency's big and animated versions: [name, size, frames] */
const ANIM: [string, string, number, number][] = [['owlcoin', 'owlcoin', 24, 8], ['acorn_big', 'owlcoin', 40, 8], ['moongem', 'moongem', 24, 8], ['gem_big', 'moongem', 40, 8], ['coin_vault', 'coin_vault', 36, 4]];
/** names that share a model */
const ALIAS: Record<string, string> = { acorn: 'owlcoin', wd_hanger: 'hanger' };
/** pack sprites are bigger (their sizes in the store) */
const BIG: Record<string, number> = { coin_pouch: 32, coin_sack: 32, coin_chest: 36 };

async function bake() {
  const only = q.get('only');
  const host = document.getElementById('out')!;
  const res: Record<string, unknown> = {};
  const show = (name: string, img: ImageData) => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d')!.putImageData(img, 0, 0);
    const fig = document.createElement('figure');
    fig.innerHTML = `<div class="big"></div><div class="one"></div><figcaption>${name}</figcaption>`;
    const big = c.cloneNode() as HTMLCanvasElement; big.getContext('2d')!.drawImage(c, 0, 0); big.style.cssText = `width:${img.width * 3}px;image-rendering:pixelated`;
    fig.querySelector('.big')!.appendChild(big); fig.querySelector('.one')!.appendChild(c);
    host.appendChild(fig);
  };
  const names = Object.keys(ICONS).filter((n) => !only || new RegExp(only).test(n));
  let seed = 1;
  for (const name of names) {
    const sp = ICONS[name];
    try {
      const sizes = BIG[name] ? { L: BIG[name] } : SIZES;
      const out: Record<string, unknown> = {};
      for (const [tag, n] of Object.entries(sizes)) {
        const obj = await sp.make();
        const img = pixelFinish(shoot(obj, n, sp.yaw ?? 0.5, sp.pitch ?? 0.3, sp.pad), n, seed, sp.vivid);
        out[tag] = encode(img);
        if (tag === 'L') show(name, img);
      }
      res[name] = out;
    } catch (e) { console.error('bake failed', name, e); }
    seed++;
  }
  for (const [a, b] of Object.entries(ALIAS)) if (res[b] && (!only || new RegExp(only).test(a))) res[a] = res[b];
  // the idle frames: a bob and squash, a glint across the front, twinkles popping round it
  const anim: Record<string, unknown[]> = {};
  for (const [name, model, n, frames] of ANIM) {
    if (only && !new RegExp(only).test(name)) continue;
    const sp = ICONS[model];
    const list: unknown[] = [];
    for (let f = 0; f < frames; f++) {
      const ph = (f / frames) * Math.PI * 2;
      const obj = await sp.make();
      if (frames === 8) { obj.scale.set(1 + Math.sin(ph) * 0.03, 1 - Math.sin(ph) * 0.03, 1); obj.rotation.z = Math.sin(ph + 1) * 0.04; }
      const img = pixelFinish(shoot(obj, n, sp.yaw ?? 0.5, sp.pitch ?? 0.3, (sp.pad ?? 1.04) * 1.04), n, 77);
      if (frames === 8) glint(img, f);
      const tw: [number, number, number][] = [[0.78, 0.16, 2], [0.18, 0.3, 1], [0.82, 0.62, 1], [0.24, 0.12, 2]];
      const t = tw[f % 4];
      if (f % 2 === 0 || frames === 4) sparkleAt(img, Math.round(t[0] * n), Math.round(t[1] * n), Math.max(1, Math.round(t[2] * n / 24)), model === 'moongem' ? [240, 236, 255] : [255, 250, 230]);
      list.push(encode(img));
      if (f === 2) show(name + '_f2', img);
    }
    anim[name] = list;
  }
  const json = JSON.stringify({ icons: res, anim });
  const module = `// GENERATED by src/dev/iconbake.ts (/dev-iconbake.html, then window.__module): every interface icon is a little 3D model,
// lit and pixel-finished (see that file). { icons: { name: { L, S } }, anim: { name: [frames] } }; each image is
// { w, h, p: palette (6 hex digits per colour), d: base64 run-length pairs (count, palette index; 0 = clear) }.
// Models: the game's own GLBs and small purpose-made ones; credits for borrowed models in docs/credits.
type Img = { w: number; h: number; p: string; d: string };
export const ICONS3D: { icons: Record<string, { L: Img; S?: Img }>; anim: Record<string, Img[]> } = ${json};
`;
  (window as unknown as { __module: string }).__module = module;
  (window as unknown as { __done: boolean }).__done = true;
  document.title = 'baked ' + Object.keys(res).length;
}
void bake();
