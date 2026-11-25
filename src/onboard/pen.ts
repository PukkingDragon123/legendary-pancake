// The floating fountain pen: a detailed pen modelled and painted in code (a two-tone gold nib with its slit,
// breather hole and engraved scroll, a finned ebonite feed, a black grip section, a jade-and-amber marbled celluloid
// barrel with gold bands, the cap posted on the end with a ball clip and a jewelled finial) that hovers over the
// interview's form, follows your finger or cursor, writes your name as you type, ticks the answers you choose and
// signs the contract. It lives in the overlay's perspective screen pass, so it tilts and foreshortens like a pen
// held in a hand, and it casts a soft shadow on the paper that tightens as the nib comes down.
import * as THREE from 'three';
import type { Overlay3D } from './overlay3d.ts';
import { softShadow } from './overlay3d.ts';
import { rgb, Tex, vnoise, hash, mix3, type RGB } from './tex.ts';
import { strokes, tint, turn, wear } from './props.ts';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const along = (g: THREE.BufferGeometry, x0: number) => { g.rotateZ(-Math.PI / 2); g.translate(x0, 0, 0); return g; };
const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** pen length, nib tip to finial (metres) */
export const PEN_LEN = 0.168;

/** periodic marble: jade green with black and amber veins, swirled */
function marble(w: number, h: number, seed: number, base: RGB, vein: RGB, gold: RGB): Tex {
  const t = new Tex(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = (x / w) * Math.PI * 2, p = y / h;
    const cx = Math.cos(a) * 1.6, cy = Math.sin(a) * 1.6;
    const warp = vnoise(cx + p * 6, cy + 3, seed) * 3.2;
    const v = Math.sin(p * 26 + warp * 4 + cx * 0.8);
    const k = vnoise(cx * 2 + p * 14, cy * 2, seed + 4);
    let c = mix3(base, tint(base, 0.35, 0.4), k);
    if (v > 0.82) c = mix3(c, vein, (v - 0.82) * 5);
    else if (v < -0.9) c = mix3(c, gold, 0.75);
    t.set(x, y, c);
  }
  strokes(t, 0, 0, w, h, (x, y) => t.get(x, y), { seed, ang: Math.PI / 2, angJ: 0.6, len: 5, val: 0.12, hue: 0.6, wrap: true, n: Math.round(w * h / 3) });
  return t;
}
const tx = (t: Tex) => t.texture({ q: 64 });

/** The pen as a model: lying along +x, the nib's tip at the origin, the nib's top facing +y. */
export function detailedPen(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pen';
  const goldT = new Tex(64, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) goldT.set(x, y, mix3(rgb(0xb07a22), rgb(0xf4d27a), vnoise(x * 0.12, y * 0.4, 3)));
  strokes(goldT, 0, 0, 64, 32, (x, y) => goldT.get(x, y), { seed: 2, ang: 0, len: 6, val: 0.15, hue: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ map: tx(goldT), metalness: 1, roughness: 0.26 });
  const resin = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.16, metalness: 0.1 });
  const jade = rgb(0x1f6a52), black = rgb(0x0e1210), amber = rgb(0xd89a3a);
  const barrelM = new THREE.MeshStandardMaterial({ map: tx(marble(128, 64, 5, jade, black, amber)), roughness: 0.14, metalness: 0.05 });
  const capM = new THREE.MeshStandardMaterial({ map: tx(marble(128, 64, 9, jade, black, amber)), roughness: 0.14, metalness: 0.05 });

  // ---- the nib: a tapering plate curved round the pen's axis, painted gold with a rhodium tip, engraved
  const NL = 0.027, nt = new Tex(96, 48);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 96; x++) {
    const u = x / 96, s = (y / 48) * 2 - 1; // u along the nib (0 tip), s across (-1..1)
    let c = mix3(rgb(0xc8962e), rgb(0xf8dc88), vnoise(x * 0.15, y * 0.3, 7));
    if (u < 0.22) c = mix3(rgb(0x9aa0a8), rgb(0xe8ecf0), vnoise(x * 0.3, y * 0.3, 2)); // the plated tip
    // engraved scrollwork on the shoulders
    if (u > 0.5 && Math.abs(Math.sin(u * 60 + s * 4)) > 0.92 && Math.abs(s) > 0.2) c = tint(c, -0.35);
    if (u > 0.55 && u < 0.6 && Math.abs(s) < 0.6) c = tint(c, -0.4);
    // the slit, the breather hole
    if (Math.abs(s) < 0.035 && u < 0.46) c = rgb(0x1a120a);
    if (Math.hypot((u - 0.47) * 3.2, s) < 0.12) c = rgb(0x120c06);
    nt.set(x, y, c);
  }
  wear(nt, (x) => (x < 6 ? 1 : 0), { seed: 4, k: 0.3 });
  const NX = 24, NS = 10, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const half = (u: number) => 0.0007 + 0.0049 * ss(0, 0.72, u) - (u > 0.9 ? 0.0004 * (u - 0.9) * 10 : 0);
  const rad = (u: number) => 0.0012 + 0.0041 * ss(0, 0.8, u);
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NS; j++) {
    const u = i / NX, s = (j / NS) * 2 - 1, w = half(u) * s, r = rad(u), phi = Math.max(-1.25, Math.min(1.25, w / r));
    pos.push(u * NL, Math.cos(phi) * r - r * 0.12 + (1 - u) * -0.0008, Math.sin(phi) * r);
    uv.push(u, (s + 1) / 2);
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NS; j++) { const a = i * (NS + 1) + j, b = a + NS + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ng.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  ng.setIndex(idx); ng.computeVertexNormals();
  const nib = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ map: tx(nt), metalness: 1, roughness: 0.22, side: THREE.DoubleSide }));

  // ---- the feed under it: ebonite with combed fins
  const ft = new Tex(32, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) ft.set(x, y, y % 5 < 2 && y > 24 ? rgb(0x050505) : tint(rgb(0x221c18), (hash(x, y, 3) - 0.5) * 0.2));
  const fd = turn([[0, 0], [0.0011, 0.002], [0.0024, 0.01], [0.0034, 0.02], [0.0038, 0.026], [0, 0.0262]], 16);
  const feed = new THREE.Mesh(along(fd.g, 0.0015), new THREE.MeshStandardMaterial({ map: tx(ft), roughness: 0.5 }));
  feed.scale.set(1, 0.72, 1); feed.position.y = -0.0012;

  // ---- grip section, barrel, bands
  const sec = new THREE.Mesh(along(turn([[0.0043, 0], [0.004, 0.008], [0.0039, 0.016], [0.0044, 0.022], [0.0052, 0.025], [0.0052, 0.027]], 28).g, 0.024), resin);
  const bar = new THREE.Mesh(along(turn([[0.0055, 0], [0.006, 0.006], [0.0062, 0.04], [0.006, 0.07], [0.0055, 0.082], [0.005, 0.084]], 32).g, 0.051), barrelM);
  const band = (x: number, r: number, w: number) => { const m = new THREE.Mesh(along(turn([[r, 0], [r + 0.0003, w * 0.2], [r + 0.0003, w * 0.8], [r, w]], 28).g, x), gold); g.add(m); };
  band(0.0505, 0.0057, 0.0016);

  // ---- the cap, posted on the barrel's end: two cap bands, the ball clip, the jewelled finial
  const capX = 0.103;
  const cap = new THREE.Mesh(along(turn([[0.0066, 0], [0.0068, 0.002], [0.0069, 0.03], [0.0066, 0.055], [0.006, 0.062], [0.0035, 0.064], [0, 0.0645]], 32).g, capX), capM);
  band(capX + 0.0015, 0.0068, 0.0022);
  band(capX + 0.0045, 0.0069, 0.0012);
  const fin = new THREE.Mesh(along(turn([[0.0036, 0], [0.004, 0.0012], [0.0036, 0.0024], [0.0026, 0.0036], [0.0012, 0.0042], [0, 0.0044]], 20).g, capX + 0.064), gold);
  const jewel = new THREE.Mesh(along(turn([[0.0016, 0], [0.0018, 0.0006], [0.001, 0.0014], [0, 0.0016]], 12).g, capX + 0.0682), new THREE.MeshStandardMaterial({ color: 0x1a7a5a, roughness: 0.1, metalness: 0.3, emissive: 0x062a1c }));
  const clipCurve = [V(capX + 0.06, 0.0062, 0), V(capX + 0.058, 0.0082, 0), V(capX + 0.04, 0.0086, 0), V(capX + 0.02, 0.0082, 0), V(capX + 0.012, 0.0078, 0)];
  const cg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(clipCurve), 24, 0.0011, 6, false);
  cg.scale(1, 1, 1.7);
  const clip = new THREE.Mesh(cg, gold);
  const ball = new THREE.Mesh(along(turn([[0, 0], [0.0012, 0.0004], [0.0016, 0.0016], [0.0012, 0.0028], [0, 0.0032]], 12).g, capX + 0.0095), gold);
  ball.position.y = 0.0076;
  g.add(nib, feed, sec, bar, cap, fin, jewel, clip, ball);
  g.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
  return g;
}

interface Stroke { pts: { x: number; y: number; down: boolean }[]; dur: number; t: number; resolve: () => void }

/**
 * The pen's behaviour over the form (all coordinates CSS px, y down). It follows the pointer while one is about,
 * otherwise drifts to its resting place; `trace` runs the nib along a path on the paper (ticks, loops, writing).
 */
export class FloatingPen {
  readonly group = new THREE.Group();
  private model = detailedPen();
  private shadow = softShadow(0.32);
  private stops: (() => void)[] = [];
  /** nib position (CSS px, y down) and height above the paper (px) */
  private p = { x: innerWidth * 0.8, y: innerHeight * 0.55, z: 60 };
  private v = { x: 0, y: 0 };
  private ptr: { x: number; y: number; t: number } | null = null;
  rest = { x: innerWidth * 0.8, y: innerHeight * 0.55 };
  /** where to rest, asked every frame (follows the form as it slides in); null: use `rest` */
  restAt: (() => { x: number; y: number } | null) | null = null;
  /** the angle it leans at while resting (radians from +x, screen up; 0.72 points up and right), or null */
  restLean: number | null = null;
  private lean = 0.72;
  /** pen length on screen, CSS px */
  len = 150;
  private queue: Stroke[] = [];
  private time = 0;
  visible = true;
  /** a gentle hover height (px) when not writing */
  hover = 34;
  /** called each time the nib touches down (a scratch sound) */
  onScratch: (() => void) | null = null;
  private wasDown = false;

  constructor(private ov: Overlay3D) {
    this.group.add(this.model);
    this.shadow.renderOrder = -1;
    this.stops.push(ov.actor(this.shadow, () => undefined), ov.actor(this.group, (dt, t) => this.update(dt, t)));
  }

  /** the pointer moved over the screen (mouse, or a finger on the form) */
  follow(x: number, y: number) { this.ptr = { x, y, t: this.time }; }
  /** forget the pointer (it left), drift home */
  release() { this.ptr = null; }

  /** Run the nib along a path (CSS px): segments with down=false are travelled lifted. Resolves when done. */
  trace(pts: { x: number; y: number; down?: boolean }[], dur: number): Promise<void> {
    return new Promise((resolve) => this.queue.push({ pts: pts.map((p) => ({ x: p.x, y: p.y, down: p.down !== false })), dur, t: 0, resolve }));
  }
  /** an ink tick at (x, y), size s */
  tick(x: number, y: number, s = 14) {
    return this.trace([{ x: x - s * 0.5, y: y - s * 0.1, down: false }, { x: x - s * 0.5, y: y - s * 0.05 }, { x: x - s * 0.1, y: y + s * 0.4 }, { x: x + s * 0.7, y: y - s * 0.7 }], 0.42);
  }
  /** a loop drawn round a word (cx, cy, half-width, half-height) */
  loop(cx: number, cy: number, rx: number, ry: number, dur = 0.55) {
    const pts: { x: number; y: number; down?: boolean }[] = [{ x: cx - rx * 0.9, y: cy - ry * 1.1, down: false }];
    for (let i = 0; i <= 26; i++) { const a = -2.2 - (i / 26) * Math.PI * 2.15; pts.push({ x: cx + Math.cos(a) * rx * (1 + i * 0.004), y: cy + Math.sin(a) * ry * (1 - i * 0.003) }); }
    return this.trace(pts, dur);
  }
  /** a flowing signature along a line from x0 to x1 at baseline y */
  sign(x0: number, x1: number, y: number, dur = 0.9) {
    const pts: { x: number; y: number; down?: boolean }[] = [{ x: x0, y: y - 6, down: false }];
    const n = 34;
    for (let i = 0; i <= n; i++) { const k = i / n, x = x0 + (x1 - x0) * k; pts.push({ x: x + Math.sin(k * 26) * 5, y: y - 6 - Math.abs(Math.sin(k * 13)) * 12 + Math.sin(k * 3) * 3 }); }
    pts.push({ x: x1 + 8, y: y - 2 });
    return this.trace(pts, dur);
  }
  /** a quick little scribble where a letter is being written */
  letter(x: number, y: number, h = 16) {
    const pts: { x: number; y: number; down?: boolean }[] = [{ x: x - 6, y: y - h * 0.3, down: false }];
    for (let i = 0; i <= 6; i++) pts.push({ x: x - 6 + i * 1.4, y: y - h * 0.15 - Math.abs(Math.sin(i * 1.3)) * h * 0.6 });
    this.queue.length = Math.min(this.queue.length, 1);
    return this.trace(pts, 0.16);
  }
  get busy() { return this.queue.length > 0; }
  /** jump straight to the resting place (the first time it shows) */
  snap() { const r = this.restAt?.() ?? this.rest; this.p.x = r.x; this.p.y = r.y; this.p.z = this.hover; this.v.x = this.v.y = 0; this.lean = this.restLean ?? 0.72; }

  private update(dt: number, t: number) {
    this.time = t;
    const g = this.group;
    g.visible = this.visible;
    this.shadow.visible = this.visible;
    if (!this.visible) return;
    // where the nib wants to be
    const r = this.restAt?.() ?? this.rest;
    let tx = r.x, ty = r.y, tz = this.hover + Math.sin(t * 1.7) * 5, k = 5;
    const st = this.queue[0];
    if (st) {
      st.t += dt;
      const f = Math.min(1, st.t / st.dur), n = st.pts.length - 1, fi = f * n, i = Math.min(n - 1, Math.floor(fi)), u = fi - i;
      const a = st.pts[i], b = st.pts[i + 1] ?? a;
      tx = a.x + (b.x - a.x) * u; ty = a.y + (b.y - a.y) * u; tz = b.down ? 0 : 10;
      k = 40;
      if (f >= 1) { this.queue.shift(); st.resolve(); }
    } else if (this.ptr && t - this.ptr.t < 3.5) {
      tx = this.ptr.x; ty = this.ptr.y; tz = 14 + Math.sin(t * 2.3) * 3; k = 22;
    }
    // springs: snappy along the path, floaty when following
    // a critically damped spring, sub-stepped (semi-implicit) so slow frames can't make it overshoot and fly off
    const p = this.p, n = Math.max(1, Math.ceil(dt * k * 3)), h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v.x += ((tx - p.x) * k * k - this.v.x * 2 * k) * h; this.v.y += ((ty - p.y) * k * k - this.v.y * 2 * k) * h;
      p.x += this.v.x * h; p.y += this.v.y * h;
    }
    if (!Number.isFinite(p.x)) { p.x = tx; p.y = ty; this.v.x = this.v.y = 0; }
    p.z += (tz - p.z) * Math.min(1, dt * (st ? 30 : 8));
    const down = p.z < 2;
    if (down && !this.wasDown) this.onScratch?.();
    this.wasDown = down;
    // a pen held in a right hand: pointing up and to the right, leaning toward you; it leans into its motion
    const vx = Math.max(-1, Math.min(1, this.v.x / 900)), vy = Math.max(-1, Math.min(1, this.v.y / 900));
    const resting = !st && !(this.ptr && t - this.ptr.t < 3.5);
    this.lean += ((resting && this.restLean !== null ? this.restLean : 0.72) - this.lean) * Math.min(1, dt * 5);
    const alpha = this.lean - vx * 0.25 + vy * 0.12 + Math.sin(t * 0.9) * 0.03, beta = 0.82 - Math.abs(vx) * 0.12 + (st ? -0.06 : 0);
    const d = V(Math.cos(beta) * Math.cos(alpha), Math.cos(beta) * Math.sin(alpha), Math.sin(beta)).normalize();
    const up = V(0, 0, 1).sub(d.clone().multiplyScalar(d.z)).normalize();
    const side = new THREE.Vector3().crossVectors(d, up);
    const m = new THREE.Matrix4().makeBasis(d, up, side);
    g.quaternion.setFromRotationMatrix(m);
    const s = this.len / PEN_LEN;
    g.scale.setScalar(s);
    g.position.set(p.x, -p.y, p.z);
    // the shadow: falls down and right of the pen, softer and fainter the higher it floats
    const L = this.len, ex = p.x + d.x * L, ey = p.y - d.y * L, ez = p.z + d.z * L;
    const sx0 = p.x + p.z * 0.35, sy0 = p.y + p.z * 0.5, sx1 = ex + ez * 0.35, sy1 = ey + ez * 0.5;
    const sh = this.shadow, mx = (sx0 + sx1) / 2, my = (sy0 + sy1) / 2, len = Math.hypot(sx1 - sx0, sy1 - sy0);
    sh.position.set(mx, -my, 0);
    sh.rotation.z = -Math.atan2(sy1 - sy0, sx1 - sx0);
    sh.scale.set(len * 1.05, 10 + p.z * 0.15, 1);
    (sh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.12, 0.36 - p.z * 0.004);
  }

  dispose() { for (const f of this.stops) f(); }
}
