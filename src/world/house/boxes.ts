// Moving boxes: real-looking corrugated cardboard (kraft brown, the flutes showing at the cut edges, scuffed
// corners, a coffee ring or two), brown packing tape over the flaps and down the sides, a paper label lettered in
// marker ("PIP'S STUFF", "FRAGILE" with red arrows...) and a stamped star. Built in code; the flaps and the tape are
// nodes (flapF, flapB, flapL, flapR, tape) so a tap can burst them open: it wobbles, the tape rips off, the flaps
// burst open in a puff of dust and sparkles, and then it folds itself away.
import * as THREE from 'three';
import { PX } from '../../gfx/box.ts';
import { hash } from '../../gfx/noise.ts';
import { BOX } from '../../game/home.ts';
import { canvasTex, patchCut } from './kit.ts';
import { fontReady, canvasText, textWidth } from '../../ui/font.ts';

/** box size in px (the model's body) */
export const BOX_W = 18, BOX_H = 14, BOX_D = 16;

/** split a label into at most two short lines (the box art does the same); one word stays whole */
export function labelLines(s: string): string[] {
  if (s.length <= 7) return [s];
  const sp = s.indexOf(' ');
  return sp > 0 ? [s.slice(0, sp), s.slice(sp + 1)] : [s];
}

export interface BoxModel {
  /** the whole box (wobbles and squashes); world units */
  root: THREE.Group;
  /** flapF, flapB, flapL, flapR, tape (house px inside the model) */
  bones: Record<string, THREE.Object3D | undefined>;
  ready: Promise<void>;
  dispose(): void;
}

const TPX = 4; // texels per px
const rgb = (r: number, g: number, b: number) => `rgb(${Math.round(Math.max(0, Math.min(255, r)))},${Math.round(Math.max(0, Math.min(255, g)))},${Math.round(Math.max(0, Math.min(255, b)))})`;

/** Kraft cardboard: faint vertical flutes, fibre speckle, scuffs and a darker crushed rim (w x h px). */
function card(g: CanvasRenderingContext2D, w: number, h: number, seed: number, flutes: 'v' | 'h' = 'v') {
  const W = w * TPX, H = h * TPX;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const f = flutes === 'v' ? i : j;
    let k = 1 + (f % 3 === 0 ? -0.05 : 0) + (hash(i, j, seed, 3) - 0.5) * 0.08;
    const edge = Math.min(i, j, W - 1 - i, H - 1 - j);
    if (edge < 2) k *= 0.78 + edge * 0.06;
    if (hash(Math.floor(i / 3), Math.floor(j / 3), seed, 5) > 0.985) k *= 0.82;
    g.fillStyle = rgb(186 * k, 140 * k, 92 * k);
    g.fillRect(i, j, 1, 1);
  }
  // a scuff and a ring stain
  g.fillStyle = 'rgba(240,220,190,0.35)';
  g.fillRect(Math.floor(hash(seed, 1, 0) * W * 0.6), H - 6, 10, 2);
  g.strokeStyle = 'rgba(110,70,40,0.25)';
  g.beginPath(); g.arc(W * (0.2 + hash(seed, 2, 0) * 0.6), H * 0.3, 5, 0, Math.PI * 2); g.stroke();
}

/** Brown packing tape strip (vertical) at x..x+w texels. */
function tape(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const shine = (i + j) % 9 < 2 ? 1.12 : 1;
    const wrinkle = (j * 3 + i) % 13 === 0 ? 0.9 : 1;
    g.fillStyle = rgb(176 * shine * wrinkle, 128 * shine * wrinkle, 70 * shine * wrinkle);
    g.fillRect(x + i, y + j, 1, 1);
  }
  g.fillStyle = 'rgba(80,50,20,0.35)'; g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
}

function frontTex(id: string, label: string): THREE.CanvasTexture {
  const seed = id.length * 7 + label.length;
  // [font6] painted at 2 texels per art texel so the marker lettering can be the game's pixel face at its 18 px
  // grid; the cardboard, tape and marks are drawn scaled 2x and look exactly as before
  const paint = (g: CanvasRenderingContext2D) => {
    g.setTransform(2, 0, 0, 2, 0, 0);
    card(g, BOX_W, BOX_H, seed);
    tape(g, (BOX_W * TPX) / 2 - 6, 0, 12, 22);
    // the paper label, lettered in marker
    const lines = labelLines(label);
    const fragile = label === 'FRAGILE';
    g.setTransform(1, 0, 0, 1, 0, 0);
    const W2 = BOX_W * TPX * 2;
    const tw = Math.max(...lines.map((l) => textWidth(l))) + 12, th = lines.length * 18 + 8; // [font14] 14-texel capitals
    const lx = Math.round((W2 - tw) / 2), ly = 52 + (lines.length === 1 ? 8 : 0);
    g.fillStyle = 'rgba(60,40,20,0.3)'; g.fillRect(lx + 2, ly + 2, tw, th);
    g.fillStyle = '#efe6d2'; g.fillRect(lx, ly, tw, th);
    g.fillStyle = '#e2d6bc'; g.fillRect(lx, ly + th - 4, tw, 4);
    lines.forEach((l, i) => canvasText(g, l, W2 / 2, ly + 18 + i * 18, fragile ? '#b0301e' : '#2c2a36', { align: 'center' }));
    g.setTransform(2, 0, 0, 2, 0, 0);
    if (fragile) {
      // red "this way up" arrows either side
      for (const x of [6, BOX_W * TPX - 12]) {
        g.fillStyle = '#b0301e';
        g.fillRect(x + 2, 10, 2, 10);
        g.fillRect(x, 12, 6, 2); g.fillRect(x + 1, 11, 4, 1); g.fillRect(x + 2, 10, 2, 1);
      }
    } else {
      // a stamped star in the corner
      g.fillStyle = 'rgba(60,64,90,0.75)';
      const cx = BOX_W * TPX - 9, cy = 8;
      for (const [dx, dy] of [[0, -3], [-1, -2], [0, -2], [1, -2], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-2, 1], [-1, 1], [1, 1], [2, 1], [-3, 2], [3, 2]]) g.fillRect(cx + dx, cy + dy, 1, 1);
    }
  };
  const t = canvasTex(BOX_W * TPX * 2, BOX_H * TPX * 2, paint);
  void fontReady().then(() => { const g = (t.image as HTMLCanvasElement).getContext('2d'); if (g) { paint(g); t.needsUpdate = true; } });
  return t;
}

let sideT: THREE.CanvasTexture | null = null, flapT: THREE.CanvasTexture | null = null;
function sideTex() {
  return (sideT ??= canvasTex(BOX_D * TPX, BOX_H * TPX, (g) => { card(g, BOX_D, BOX_H, 11); tape(g, 0, 0, 0, 0); g.fillStyle = 'rgba(50,40,60,0.7)'; for (let k = 0; k < 4; k++) g.fillRect(BOX_D * TPX - 14 + k * 2, BOX_H * TPX - 10, 1, 5); g.fillRect(BOX_D * TPX - 15, BOX_H * TPX - 8, 9, 1); }));
}
function flapTex() {
  return (flapT ??= canvasTex(BOX_W * TPX, (BOX_D / 2) * TPX, (g) => card(g, BOX_W, BOX_D / 2, 23, 'h')));
}

const mats = new Map<string, THREE.Material>();
function cardMat(key: string, map: THREE.Texture, tint: string): THREE.MeshStandardMaterial {
  const k = key + tint;
  let m = mats.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    const c = new THREE.Color(tint).multiplyScalar(1.25);
    m = new THREE.MeshStandardMaterial({ map, color: c, roughness: 0.92, metalness: 0 });
    patchCut(m);
    mats.set(k, m);
  }
  return m;
}
const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 1 });
const tapeMat = new THREE.MeshStandardMaterial({ color: 0xb07c44, roughness: 0.38, metalness: 0 });

export function buildMovingBox(id: string): BoxModel {
  const root = new THREE.Group();
  root.name = 'movingbox';
  const def = BOX[id];
  const label = def?.label ?? 'STUFF', tint = def ? '#' + new THREE.Color(def.tint).lerp(new THREE.Color(0xc89a62), 0.5).getHexString() : '#c89a62';
  const model = new THREE.Group();
  model.scale.setScalar(PX);
  root.add(model);
  const side = cardMat('side', sideTex(), tint), flap = cardMat('flap', flapTex(), tint), front = new THREE.MeshStandardMaterial({ map: frontTex(id, label), color: new THREE.Color(tint).multiplyScalar(1.25), roughness: 0.92 });
  patchCut(front);
  // the body: front (label), back, sides, a dark inside seen when the flaps are open
  const body = new THREE.Mesh(new THREE.BoxGeometry(BOX_W, BOX_H, BOX_D), [side, side, darkMat, side, front, front]);
  body.position.y = BOX_H / 2;
  const add = (o: THREE.Object3D, parent: THREE.Object3D = model) => { o.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); parent.add(o); return o; };
  add(body);
  // crushed corner edges: thin darker strips down the vertical edges
  const bones: Record<string, THREE.Object3D> = {};
  const flapSpec: [string, [number, number, number], [number, number, number], [number, number, number]][] = [
    ['flapF', [0, BOX_H, BOX_D / 2], [BOX_W, 0.7, BOX_D / 2], [0, 0.35, -BOX_D / 4]],
    ['flapB', [0, BOX_H, -BOX_D / 2], [BOX_W, 0.7, BOX_D / 2], [0, 0.35, BOX_D / 4]],
    ['flapL', [-BOX_W / 2, BOX_H + 0.7, 0], [BOX_W / 2 - 0.2, 0.55, BOX_D - 1], [BOX_W / 4, 0.28, 0]],
    ['flapR', [BOX_W / 2, BOX_H + 0.7, 0], [BOX_W / 2 - 0.2, 0.55, BOX_D - 1], [-BOX_W / 4, 0.28, 0]],
  ];
  for (const [name, piv, size, off] of flapSpec) {
    const b = new THREE.Group();
    b.name = name;
    b.position.set(...piv);
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), [flap, flap, flap, darkMat, flap, flap]);
    m.position.set(...off);
    add(m, b);
    add(b);
    bones[name] = b;
  }
  // tape over the seam (it rips off) and down the front and back
  const t = new THREE.Group();
  t.name = 'tape';
  t.position.set(0, BOX_H + 1.3, 0);
  const tm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, BOX_D + 0.6), tapeMat);
  tm.position.y = 0.15;
  add(tm, t);
  add(t);
  bones.tape = t;
  const back = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.25), tapeMat);
  back.position.set(0, BOX_H - 2.5, -BOX_D / 2 - 0.13);
  add(back);
  root.traverse((n) => { if ((n as THREE.Mesh).isMesh) n.userData = { ...root.userData }; });
  return { root, bones, ready: Promise.resolve(), dispose: () => { (front.map as THREE.Texture).dispose(); front.dispose(); } };
}

export interface BoxAnim { t: number; burst: boolean; done: boolean; tape0?: THREE.Vector3 }
/** One frame of the opening: returns events as they happen. */
export function stepBoxOpen(m: BoxModel, a: BoxAnim, dt: number): ('knock' | 'rip' | 'burst' | 'fold' | 'gone')[] {
  const ev: ('knock' | 'rip' | 'burst' | 'fold' | 'gone')[] = [];
  const prev = a.t;
  a.t += dt;
  const t = a.t, b = m.bones, body = m.root;
  if (prev === 0) ev.push('knock');
  // wobble, building up
  if (t < 0.5) {
    const k = t / 0.5;
    body.rotation.z = Math.sin(t * 38) * 0.12 * k;
    body.rotation.x = Math.sin(t * 31 + 1) * 0.06 * k;
    body.scale.set(1 + Math.sin(t * 40) * 0.04 * k, 1 - Math.sin(t * 40) * 0.05 * k, 1 + Math.sin(t * 40) * 0.04 * k);
  }
  if (prev < 0.42 && t >= 0.42) ev.push('rip');
  if (t >= 0.42 && b.tape) {
    // the tape peels up and flies off, curling (px)
    if (!a.tape0) a.tape0 = b.tape.position.clone();
    const k = t - 0.42;
    b.tape.position.set(a.tape0.x + k * 22, a.tape0.y + k * 35 - k * k * 48, a.tape0.z);
    b.tape.rotation.z = -k * 7;
    b.tape.rotation.x = k * 3;
    b.tape.scale.setScalar(Math.max(0.001, 1 - k * 1.2));
  }
  if (prev < 0.58 && t >= 0.58) { ev.push('burst'); a.burst = true; body.rotation.set(0, 0, 0); body.scale.set(1.12, 0.84, 1.12); }
  if (t >= 0.58) {
    const k = Math.min(1, (t - 0.58) / 0.28), o = 1 + Math.sin(k * Math.PI) * 0.25; // overshoot
    if (b.flapF) b.flapF.rotation.x = k * 2.2 * o;
    if (b.flapB) b.flapB.rotation.x = -k * 2.2 * o;
    if (b.flapL) b.flapL.rotation.z = k * 2.4 * o;
    if (b.flapR) b.flapR.rotation.z = -k * 2.4 * o;
    const s = body.scale.x + (1 - body.scale.x) * Math.min(1, dt * 10);
    body.scale.set(s, 1 - (s - 1) * 1.3, s);
  }
  if (prev < 1.5 && t >= 1.5) ev.push('fold');
  if (t >= 1.5) {
    const k = Math.min(1, (t - 1.5) / 0.4);
    body.scale.set(1 + k * 0.2, Math.max(0.001, 1 - k), 1 + k * 0.2);
  }
  if (prev < 1.95 && t >= 1.95) { ev.push('gone'); a.done = true; }
  return ev;
}

/** Idle: a little hop and shimmy every few seconds so the box asks to be opened. */
export function stepBoxIdle(m: BoxModel, t: number, phase: number) {
  const c = (t + phase) % 4.2;
  const r = m.root;
  if (c < 0.5) {
    const k = c / 0.5;
    r.position.y = Math.sin(k * Math.PI) * 0.08;
    r.rotation.z = Math.sin(k * Math.PI * 3) * 0.06 * (1 - k);
    r.scale.set(1 + Math.sin(k * Math.PI) * -0.04, 1 + Math.sin(k * Math.PI) * 0.06, 1 + Math.sin(k * Math.PI) * -0.04);
  } else { r.position.y = 0; r.rotation.z = 0; r.scale.set(1, 1, 1); }
  if (m.bones.flapF) m.bones.flapF.rotation.x = c < 0.5 ? Math.sin((c / 0.5) * Math.PI) * 0.18 : 0;
}
