// Things on (and around) Pip's desk, built in code: the green banker's lamp, the brass-and-walnut nameplate,
// in/out trays, a cut-glass water carafe on a tray, a fountain pen, the rubber stamp on its ink pad, the client
// folder, a brass carriage clock, a sticky note, Pip's own paperwork, wall sconces, and a tall leaf-card plant.
import * as THREE from 'three';
import { at, Batch, bbox, cyl, lathe, mat } from './kit.ts';
import type { OfficeMats } from './mats.ts';
import { C, crispText, hash, hexCSS, lerpRamp, measure, mix3, mul3, paper as paperFill, rgb, Tex, vnoise, type RGB } from './tex.ts';
import { F } from './fonts.ts';
import { DESK_TOP } from './furnish.ts';

const T = DESK_TOP;

// ------------------------------------------------------------------ the banker's lamp

export interface Lamp { group: THREE.Group; bulb: THREE.Mesh; shadeIn: THREE.Mesh; chain: THREE.Object3D }
export function bankersLamp(m: OfficeMats): Lamp {
  const g = new THREE.Group();
  g.name = 'lamp';
  const b = new Batch();
  // a stepped oval brass base, a slim column with a knuckle, the yoke holding the shade
  b.add(m.brass, at(lathe([[0, 0], [0.1, 0], [0.104, 0.008], [0.1, 0.016], [0.085, 0.022], [0.07, 0.03], [0.045, 0.036], [0.03, 0.045], [0, 0.046]], 28), 0, 0, 0));
  b.add(m.brass, at(lathe([[0.012, 0], [0.012, 0.22], [0.018, 0.23], [0.018, 0.25], [0.012, 0.26], [0.011, 0.3], [0, 0.3]], 12), 0, 0.04, 0));
  b.add(m.brass, at(bbox(0.36, 0.012, 0.014, { r: 0.004, center: true }), 0, 0.33, 0));
  for (const sx of [-1, 1]) b.add(m.brass, at(bbox(0.012, 0.05, 0.014, { r: 0.004, center: true }), sx * 0.175, 0.35, 0));
  // the green glass shade: a half cylinder, open below
  const shadeGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.36, 24, 1, true, 0, Math.PI);
  shadeGeo.rotateZ(Math.PI / 2);
  const shade = new THREE.Mesh(shadeGeo, m.greenGlass);
  shade.position.set(0, 0.38, 0); shade.scale.set(1, 0.85, 1.1);
  shade.castShadow = true;
  const inGeo = shadeGeo.clone();
  const inMat = new THREE.MeshBasicMaterial({ color: 0xffe3a6, side: THREE.BackSide, toneMapped: false });
  const shadeIn = new THREE.Mesh(inGeo, inMat);
  shadeIn.position.copy(shade.position); shadeIn.scale.set(0.99, 0.84, 1.09);
  // end caps (brass)
  for (const sx of [-1, 1]) {
    const cap = new THREE.CircleGeometry(0.1, 24, 0, Math.PI);
    cap.rotateY(sx * Math.PI / 2);
    cap.scale(1, 0.85, 1.1);
    b.add(m.brass, at(cap, sx * 0.181, 0.38, 0));
  }
  // the bulb glowing inside, the pull chain
  const bulb = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.12, 4, 10), new THREE.MeshBasicMaterial({ color: 0xfff1c8, toneMapped: false }));
  bulb.rotation.z = Math.PI / 2; bulb.position.set(0, 0.36, 0);
  const chain = new THREE.Group();
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 6, 4), m.brass); s.position.set(0.04, -i * 0.012, 0.07); chain.add(s); }
  const knob = new THREE.Mesh(lathe([[0, 0], [0.006, 0.004], [0.008, 0.012], [0.004, 0.02], [0, 0.022]], 8), m.brass);
  knob.position.set(0.04, -0.13, 0.07);
  chain.add(knob);
  chain.position.set(0, 0.36, 0);
  g.add(b.build('lampbase'), shade, shadeIn, bulb, chain);
  return { group: g, bulb, shadeIn, chain };
}

// ------------------------------------------------------------------ nameplate

export function nameplate(m: OfficeMats, name: string, title: string): { group: THREE.Group; set(name: string): void } {
  const g = new THREE.Group();
  g.name = 'nameplate';
  const b = new Batch();
  const w = 0.34, h = 0.075;
  b.add(m.walnut, at(bbox(w, 0.03, 0.07, { r: 0.006 }), 0, 0, 0));
  b.add(m.walnut, at(bbox(w - 0.02, h, 0.022, { r: 0.004 }), 0, 0.02, 0.0, -0.32, 0, 0));
  g.add(b.build('plate'));
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 52;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.016), mat({ map: tex, metalness: 0.75, roughness: 0.3 }));
  plate.position.set(0, 0.02 + (h / 2) * Math.cos(0.32) + 0.002, 0.012 + (h / 2) * Math.sin(-0.32) * -1 + 0.0035);
  plate.rotation.x = -0.32;
  plate.castShadow = true;
  g.add(plate);
  const draw = (nm: string) => {
    const t = new Tex(256, 52);
    // brushed brass, a bevelled edge
    for (let y = 0; y < 52; y++) for (let x = 0; x < 256; x++) t.set(x, y, lerpRamp(C.brass, 0.62 + (vnoise(x * 0.03, y * 1.5, 4) - 0.5) * 0.15 + (hash(x, y, 2) - 0.5) * 0.05));
    t.bevel(0, 0, 256, 52, 0.22, 2);
    const c = t.canvas(64), cg = c.getContext('2d')!;
    const ink = '#2a1d0c';
    const big = nm.toUpperCase();
    // engraved capitals, as big as fit (a highlight under each stroke), the title beneath
    const f = measure(big, F.caps(24), 2) < 236 ? F.caps(24) : F.caps(12);
    crispText(cg, big, 129, 32, f, '#f7e3a4', { align: 'center', spacing: 2 });
    crispText(cg, big, 128, 31, f, ink, { align: 'center', spacing: 2 });
    crispText(cg, title, 128, 47, F.small(16), '#4a3414', { align: 'center' });
    // scale the name up 2x for weight
    const g2 = cv.getContext('2d')!;
    g2.imageSmoothingEnabled = false;
    g2.clearRect(0, 0, 256, 52);
    g2.drawImage(c, 0, 0);
    tex.needsUpdate = true;
  };
  draw(name);
  return { group: g, set: draw };
}

// ------------------------------------------------------------------ trays, carafe, pen, stamp, folder, clock

export function carafeSet(m: OfficeMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'carafe';
  const b = new Batch();
  // a silver (brass) round tray
  b.add(m.brass, at(lathe([[0, 0], [0.16, 0], [0.165, 0.012], [0.158, 0.014], [0.15, 0.004], [0, 0.004]], 32), 0, 0, 0));
  g.add(b.build('tray'));
  // the carafe: a cut-glass decanter shape, water inside
  const prof: [number, number][] = [[0, 0], [0.055, 0], [0.068, 0.02], [0.072, 0.07], [0.064, 0.13], [0.03, 0.18], [0.022, 0.215], [0.026, 0.235], [0.02, 0.24]];
  const car = new THREE.Mesh(lathe(prof, 24), m.glass);
  car.position.y = 0.006; car.renderOrder = 3;
  const water = new THREE.Mesh(lathe([[0, 0.004], [0.052, 0.004], [0.064, 0.02], [0.067, 0.07], [0.062, 0.11], [0, 0.11]], 20), m.water);
  water.position.copy(car.position); water.renderOrder = 2;
  const stopper = new THREE.Mesh(lathe([[0, 0], [0.014, 0], [0.012, 0.02], [0.028, 0.045], [0.02, 0.06], [0, 0.065]], 12), m.glass);
  stopper.position.set(0, 0.006 + 0.225, 0); stopper.renderOrder = 3;
  g.add(water, car, stopper);
  for (const [gx, gz] of [[0.1, 0.06], [0.07, -0.08]]) {
    const gl = new THREE.Mesh(lathe([[0, 0], [0.028, 0], [0.032, 0.004], [0.034, 0.09], [0.031, 0.09], [0.029, 0.006], [0, 0.006]], 16), m.glass);
    gl.position.set(gx, 0.006, gz); gl.renderOrder = 3;
    g.add(gl);
  }
  return g;
}

/** A fountain pen lying (or held) along +x: black lacquer barrel, gold bands, a gold nib. Origin at the nib tip. */
export function fountainPen(m: OfficeMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pen';
  const b = new Batch();
  const prof: [number, number][] = [[0, 0], [0.0025, 0.006], [0.004, 0.018], [0.0055, 0.024], [0.0058, 0.03], [0.0062, 0.11], [0.0066, 0.112], [0.0066, 0.15], [0.006, 0.16], [0.0035, 0.165], [0, 0.166]];
  const body = lathe(prof.slice(2), 16);
  b.add(m.blackLacquer, at(body, 0, 0, 0, 0, 0, -Math.PI / 2));
  b.add(m.gilt, at(lathe([[0, 0], [0.0012, 0.0], [0.004, 0.018], [0, 0.019]], 8), 0, 0, 0, 0, 0, -Math.PI / 2));
  for (const x of [0.03, 0.11, 0.155]) b.add(m.gilt, at(cyl(0.0067, 0.004, 14), x, 0, 0, 0, 0, -Math.PI / 2));
  // the clip
  b.add(m.gilt, at(bbox(0.045, 0.002, 0.003, { r: 0.0008, center: true }), 0.13, 0.0075, 0));
  g.add(b.build('pen'));
  return g;
}

/** The rubber stamp: a turned walnut handle on a brass ferrule over a rubber die. Origin at the die's face. */
export function rubberStamp(m: OfficeMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'stamp';
  const b = new Batch();
  b.add(m.rubber, at(bbox(0.075, 0.008, 0.05, { r: 0.002 }), 0, 0, 0));
  b.add(m.walnut, at(bbox(0.082, 0.02, 0.056, { r: 0.004 }), 0, 0.008, 0));
  b.add(m.brass, at(cyl(0.012, 0.012, 14), 0, 0.028, 0));
  b.add(m.walnut, at(lathe([[0.011, 0], [0.009, 0.03], [0.012, 0.045], [0.022, 0.065], [0.024, 0.08], [0.016, 0.095], [0, 0.098]], 16), 0, 0.04, 0));
  g.add(b.build('stamp'));
  return g;
}
export function inkPad(m: OfficeMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'inkpad';
  const b = new Batch();
  b.add(m.brassDark, at(bbox(0.12, 0.016, 0.085, { r: 0.004 }), 0, 0, 0));
  b.add(mat({ color: 0x5a0f12, roughness: 0.95 }), at(bbox(0.104, 0.004, 0.07, { r: 0.001 }), 0, 0.014, 0));
  // the open lid behind
  b.add(m.brassDark, at(bbox(0.12, 0.085, 0.006, { r: 0.002 }), 0, 0.016, -0.046, -0.25, 0, 0));
  g.add(b.build('inkpad'));
  return g;
}

/** A manila client folder lying open-able on the desk: back cover, a tab, the filed pages stack inside. */
export function folder(): { group: THREE.Group; cover: THREE.Object3D; stack: THREE.Mesh; label(text: string): void } {
  const g = new THREE.Group();
  g.name = 'folder';
  const W = 0.27, D = 0.35;
  const manila = new Tex(128, 160);
  for (let y = 0; y < 160; y++) for (let x = 0; x < 128; x++) manila.set(x, y, mix3(rgb(0xc99a55), rgb(0xe0b670), vnoise(x * 0.06, y * 0.06, 3) * 0.5 + (hash(x, y, 1) - 0.5) * 0.1 + 0.25));
  manila.bevel(0, 0, 128, 160, 0.08, 1);
  const tex = manila.texture({ repeat: false });
  const fm = mat({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, D), fm);
  back.rotation.x = -Math.PI / 2; back.position.y = 0.001;
  back.receiveShadow = true;
  // the tab with a typed label
  const lc = document.createElement('canvas'); lc.width = 96; lc.height = 20;
  const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace; lt.magFilter = THREE.NearestFilter; lt.minFilter = THREE.LinearFilter;
  const tab = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.025), mat({ map: lt, roughness: 0.85 }));
  tab.rotation.x = -Math.PI / 2; tab.position.set(-0.05, 0.0015, -D / 2 - 0.012);
  const label = (text: string) => {
    const g2 = lc.getContext('2d')!;
    g2.fillStyle = '#d8ad64'; g2.fillRect(0, 0, 96, 20);
    g2.fillStyle = '#f3ead6'; g2.fillRect(4, 3, 88, 14);
    crispText(g2, text, 48, 14, F.small(16), '#24304e', { align: 'center' });
    lt.needsUpdate = true;
  };
  label('CLIENT FILE');
  // the stack of filed pages (grows as pages go in)
  const stack = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 1, D - 0.02), mat({ color: 0xf3ead6, roughness: 0.9 }));
  stack.position.set(0.004, 0.0015, 0.004); stack.scale.y = 0.0001; stack.visible = false;
  stack.castShadow = true; stack.receiveShadow = true;
  // the front cover, hinged on the left edge (rotates about z at x = -W/2)
  const cover = new THREE.Group();
  const cm = new THREE.Mesh(new THREE.PlaneGeometry(W, D - 0.01), fm);
  cm.rotation.x = -Math.PI / 2; cm.position.x = W / 2;
  cm.castShadow = true; cm.receiveShadow = true;
  cover.add(cm);
  cover.position.set(-W / 2, 0.003, 0.005);
  g.add(back, tab, stack, cover);
  return { group: g, cover, stack, label };
}

/** Pip's own paperwork: a slightly messy stack and a letter he's reading. */
export function paperwork(m: OfficeMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'paperwork';
  const b = new Batch();
  b.add(m.paperStack, at(bbox(0.21, 0.025, 0.28, { r: 0 }), 0, 0, 0, 0, 0.08, 0));
  const t = new Tex(96, 128);
  paperFill(t, 0, 0, 96, 128, { base: 0.82 });
  for (let y = 18; y < 120; y += 5) for (let x = 10; x < 86 - (hash(y, 1, 4) > 0.7 ? 30 : 0); x++) if (hash(x >> 2, y, 3) > 0.15) t.set(x, y, rgb(0x3a3a48), 0.7);
  for (let x = 10; x < 60; x++) t.set(x, 10, rgb(0x5a1a1a));
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), mat({ map: t.texture({ repeat: false }), roughness: 0.9 }));
  top.rotation.set(-Math.PI / 2, 0, -0.12); top.position.set(0.01, 0.0265, 0.01);
  top.receiveShadow = true;
  g.add(b.build('paperwork'), top);
  return g;
}

/** A brass wall sconce with a candle bulb and a little pleated shade. */
export function sconce(m: OfficeMats): { group: THREE.Group; bulb: THREE.Mesh } {
  const g = new THREE.Group();
  const b = new Batch();
  b.add(m.brass, at(lathe([[0, 0], [0.045, 0], [0.05, 0.012], [0.03, 0.03], [0, 0.032]], 14), 0, 0, 0, Math.PI / 2, 0, 0));
  b.add(m.brass, at(new THREE.TorusGeometry(0.1, 0.008, 6, 14, Math.PI / 2), 0, -0.1, 0.02, 0, -Math.PI / 2, 0));
  b.add(m.brass, at(lathe([[0, 0], [0.025, 0], [0.03, 0.02], [0.012, 0.03], [0, 0.03]], 12), 0, 0.0, 0.12));
  b.add(m.ivory, at(cyl(0.01, 0.06, 8), 0, 0.03, 0.12));
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf3dcae, emissive: 0xffc070, emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide });
  b.add(shadeMat, at(cyl(0.06, 0.09, 12, { r2: 0.035, open: true }), 0, 0.07, 0.12));
  g.add(b.build('sconce'));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false }));
  bulb.position.set(0, 0.1, 0.12);
  g.add(bulb);
  return { group: g, bulb };
}

// ------------------------------------------------------------------ plants: leaf cards (hand-pixelled leaves on alpha cards)

function leafAtlas(kind: 'fig' | 'palm'): THREE.CanvasTexture {
  // 4 leaf variants, 64 x 96 px each, alpha-cut
  const W = 256, H = 96, t = new Tex(W, H);
  for (let i = 0; i < W * H; i++) t.a[i] = 0;
  const greens: RGB[] = kind === 'fig' ? [rgb(0x12301a), rgb(0x1d4a25), rgb(0x2a6430), rgb(0x3d7f3a), rgb(0x5a9a48), rgb(0x86b860)] : [rgb(0x15331c), rgb(0x214d26), rgb(0x2f6a2e), rgb(0x478a3c), rgb(0x6aa852)];
  for (let v = 0; v < 4; v++) {
    const ox = v * 64;
    for (let y = 0; y < H; y++) for (let x = 0; x < 64; x++) {
      const u = (y + 0.5) / H, cx = 32 + Math.sin(u * 3 + v) * 2;
      let half: number;
      if (kind === 'fig') half = Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.7 * (22 + v * 2) * (u > 0.85 ? 1 - (u - 0.85) * 4 : 1) + (vnoise(u * 20, v, 3) - 0.5) * 3;
      else half = Math.abs(Math.sin(u * 22 + v)) < 0.5 ? (1 - u) * 26 * Math.min(1, u * 6) : 2;
      const dx = x + 0.5 - cx;
      if (Math.abs(dx) > half || u < 0.02) continue;
      const side = dx / Math.max(1, half);
      const vein = Math.abs(dx) < 1.2 ? 0.2 : (kind === 'fig' && Math.abs(((u * 14 + Math.abs(side) * 2.2) % 1) - 0.5) < 0.06) ? -0.1 : 0;
      const k = 0.55 - side * 0.12 + (Math.abs(side) > 0.85 ? -0.12 : 0) + vein + (vnoise(x * 0.2, y * 0.2, v) - 0.5) * 0.18 - u * 0.1;
      t.set(ox + x, y, lerpRamp(greens, k));
      t.alpha(ox + x, y, 1);
    }
  }
  const tex = t.texture({ repeat: false, q: 56 });
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** A tall potted fiddle-leaf fig built from leaf cards. Returns the group and the leaves to sway. */
export function pottedFig(m: OfficeMats, seed = 1, height = 1.7): { group: THREE.Group; leaves: THREE.Mesh } {
  const g = new THREE.Group();
  g.name = 'plant';
  const b = new Batch();
  // a glazed cachepot on a brass foot
  b.add(m.ceramic, at(lathe([[0, 0], [0.15, 0], [0.17, 0.02], [0.2, 0.2], [0.21, 0.36], [0.22, 0.38], [0.2, 0.39], [0, 0.39]], 24), 0, 0.03, 0));
  b.add(m.brass, at(lathe([[0, 0], [0.16, 0], [0.165, 0.03], [0, 0.03]], 20), 0, 0, 0));
  b.add(m.soil, at(cyl(0.195, 0.01, 16), 0, 0.39, 0));
  // trunk and branches
  const bark = mat({ color: 0x5a4632, roughness: 0.9 });
  b.add(bark, at(cyl(0.018, height * 0.7, 6, { r2: 0.012 }), 0, 0.39, 0, 0.03, 0, 0.05));
  g.add(b.build('pot'));
  const tex = leafAtlas('fig');
  const lm = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55 });
  // leaves: cards along spiralling branches, facing outward, drooping a little
  const cards: THREE.BufferGeometry[] = [];
  const n = 64;
  for (let i = 0; i < n; i++) {
    const k = i / n, y = 0.55 + k * (height - 0.6), a = i * 2.39996 + seed;
    const r = 0.06 + Math.sin(k * Math.PI) * 0.32 * (0.7 + hash(i, seed, 3) * 0.5);
    const s = 0.16 + Math.sin(k * Math.PI) * 0.1 + hash(i, 2, seed) * 0.05;
    const q = new THREE.PlaneGeometry(s * 0.66, s);
    const v = Math.floor(hash(i, 5, seed) * 4);
    const uv = q.attributes.uv as THREE.BufferAttribute;
    for (let j = 0; j < uv.count; j++) uv.setX(j, (v + uv.getX(j)) / 4);
    q.translate(0, s / 2, 0);
    q.rotateX(-0.9 - hash(i, 7, seed) * 0.5);
    q.rotateY(-a + Math.PI / 2);
    q.translate(Math.cos(a) * r, y, Math.sin(a) * r);
    cards.push(q);
  }
  const geo = mergeAll(cards);
  const leaves = new THREE.Mesh(geo, lm);
  leaves.castShadow = true; leaves.receiveShadow = true;
  leaves.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  leaves.name = 'leaves';
  g.add(leaves);
  return { group: g, leaves };
}
function mergeAll(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0;
  for (const g of gs) n += (g.index ? g.index.count : g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    uv.set(g.attributes.uv.array as Float32Array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

export const DESK = {
  lamp: new THREE.Vector3(-0.68, T, -1.22),
  phone: new THREE.Vector3(0.66, T, -1.22),
  typewriter: new THREE.Vector3(0.6, T, -0.76),
  nameplate: new THREE.Vector3(-0.58, T, -0.62),
  stamp: new THREE.Vector3(0.22, T, -0.62),
  folder: new THREE.Vector3(0.04, T, -1.12),
  work: new THREE.Vector3(0.32, T, -1.2),
  pen: new THREE.Vector3(-0.22, T + 0.007, -1.06),
};
export { mul3, hexCSS };
