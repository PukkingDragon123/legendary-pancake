// Falling and sweeping things: leaves, a leafy branch, acorns, wing feathers (plumes) and down (feathers).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bark } from '../paint3d.ts';
import { backdrop, backPose, cells, done, hh, hide, hvAt, hwAt, instanced, type Kit, paint, place, rig, type Set3D, Shadows, smooth, tint, translucent, TAU } from './kit.ts';

// ------------------------------------------------------------------ leaves

/** four leaves in a 2 x 2 atlas (oak, maple, beech, birch), painted pale so the instance colour tints them */
function leafAtlas(): THREE.Texture {
  return paint('leaves', 256, 256, (g) => {
    for (let c = 0; c < 4; c++) {
      const ox = (c % 2) * 128, oy = (1 - Math.floor(c / 2)) * 128; // cell c at uv ((c%2)/2, floor(c/2)/2): canvas rows are flipped
      g.save(); g.translate(ox, oy);
      const path = new Path2D();
      if (c === 1) {
        // maple: five pointed lobes, serrated, a notch at the stalk
        for (let k = 0; k <= 160; k++) {
          const th = (k / 160) * TAU - Math.PI / 2, a = th - Math.PI / 2;
          const lobe = Math.pow(Math.abs(Math.cos(2.5 * a)), 2.5), ser = Math.abs(Math.sin(k * 1.9)) * 0.05;
          const r = 54 * (0.42 + 0.58 * lobe + ser) * (Math.abs(th - Math.PI / 2) < 0.18 ? 0.5 : 1);
          const x = 64 + Math.cos(th) * r, y = 66 - Math.sin(th) * r * 0.96;
          if (k) path.lineTo(x, y); else path.moveTo(x, y);
        }
      } else {
        const w = (t: number) => c === 0 ? 0.36 * Math.pow(Math.sin(Math.PI * t), 0.9) * (0.62 + 0.38 * Math.abs(Math.sin(t * Math.PI * 4.5))) + 0.02
          : c === 2 ? 0.3 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.75) * (1 + 0.06 * Math.abs(Math.sin(t * 60)))
            : 0.4 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 1.1) * (1 + 0.04 * Math.abs(Math.sin(t * 80)));
        const y0 = 118, y1 = 8;
        path.moveTo(64, y0);
        for (let k = 0; k <= 60; k++) { const t = k / 60; path.lineTo(64 - w(t) * 128, y0 + (y1 - y0) * t); }
        for (let k = 60; k >= 0; k--) { const t = k / 60; path.lineTo(64 + w(t) * 128, y0 + (y1 - y0) * t); }
      }
      path.closePath();
      const gr = g.createRadialGradient(60, 60, 4, 64, 64, 64);
      gr.addColorStop(0, '#fff6d8'); gr.addColorStop(0.6, '#eadcc0'); gr.addColorStop(1, '#b8a080');
      g.fillStyle = gr; g.fill(path);
      g.save(); g.clip(path);
      // blotches and a darker, drier rim
      for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(${hh(i, c) > 0.5 ? '120,60,20' : '255,240,200'},0.22)`; g.beginPath(); g.arc(20 + hh(i, c + 4) * 88, 14 + hh(i, c + 7) * 100, 3 + hh(i, c + 9) * 9, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(70,36,12,0.45)'; g.lineWidth = 5; g.stroke(path);
      // veins: a pale midrib and paired side veins
      g.strokeStyle = 'rgba(255,250,230,0.7)'; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(64, 124); g.lineTo(64, c === 1 ? 18 : 12); g.stroke();
      g.lineWidth = 1.2;
      if (c === 1) for (const a of [0.35, -0.35, 1.25, -1.25]) { g.beginPath(); g.moveTo(64, 70); g.lineTo(64 + Math.sin(a) * 46, 70 - Math.cos(a) * 42); g.stroke(); }
      else for (let k = 0; k < 6; k++) { const y = 104 - k * 15; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + s * 14, y - 6, 64 + s * 30 * (1 - k * 0.08), y - 16); g.stroke(); } }
      g.restore();
      // the stalk
      g.strokeStyle = '#a08060'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 112); g.lineTo(65, 127); g.stroke();
      g.restore();
    }
  });
}
/** a leaf: a small plane, curled along its length and cupped across */
function leafGeo(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, 4, 5);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k); p.setZ(k, -0.22 * (y + 0.5) * (y + 0.5) + 0.3 * x * x + 0.08 * x * y); }
  geo.computeVertexNormals();
  return geo;
}
const AUTUMN = [0xe89a2a, 0xc0521c, 0xa8281e, 0xe8bc3a, 0x9a9a30, 0x8a4e22, 0xd8782a];
const SUMMER = [0x5a8a2e, 0x7aa83a, 0x4a7a30, 0x98b03c, 0xc8a83a];

/** the falling front for leaves/acorns/feathers: covered above it while covering, below it while uncovering */
const FRONT = /* glsl */ `
  float y = 1.0 - uv.y; float sh = 0.0;
  float edgeN = (fbm3(vec2(uv.x * 9.0, T * 1.7)) - 0.5) * 0.11 + (vn(vec2(uv.x * 40.0, 3.0)) - 0.5) * 0.03;
  float f = smoothstep(0.0, 1.0, fract(min(T, 1.999))) * 1.22 - 0.08 + edgeN;
  if (T < 1.0) { a = 1.0 - smoothstep(f - 0.012, f + 0.012, y); sh = exp(-max(0.0, y - f) * 30.0) * step(f, y) * 0.7; }
  else { a = smoothstep(f - 0.012, f + 0.012, y); sh = 0.0; }
  if (a < 0.002 && sh < 0.01) discard;`;

function fallSet(k: Kit, o: {
  n: number; geo: THREE.BufferGeometry; mat: THREE.Material; cols?: number[]; back: string; dur: number; spread: number; size: [number, number];
  spin: (i: number, t: number, out: number[]) => void; sway: number; shadow?: number; up?: boolean; cell?: (i: number) => number; sky?: number;
}): Set3D & { mesh: THREE.InstancedMesh } {
  const scene = new THREE.Scene();
  rig(scene, k, { keyI: 2.4, fill: 0.9, sky: o.sky });
  const back = backdrop(o.back);
  scene.add(back);
  if (o.cell) cells(o.geo, o.n, o.cell);
  const mesh = instanced(o.geo, o.mat, o.n);
  if (o.cols) tint(mesh, o.cols);
  scene.add(mesh);
  const sh = o.shadow ? new Shadows(o.n, 16, o.shadow) : null;
  if (sh) scene.add(sh.mesh);
  const rot = [0, 0, 0];
  const pose = (T: number, time: number) => {
    backPose(back, k, T, time);
    const u = (o.mat.userData.u as { uTime?: { value: number } } | undefined); if (u?.uTime) u.uTime.value = time;
    for (let i = 0; i < o.n; i++) {
      const wave = i % 2, d0 = wave ? 1.0 + hh(i, 1) * o.spread : hh(i, 1) * o.spread;
      const t = (T - d0) / o.dur;
      if (t < -0.02 || t > 1.05) { hide(mesh, i); sh?.hide(i); continue; }
      const z = -(6 + hh(i, 2) * 9), hw = hwAt(k, -z), hv = hvAt(k, -z);
      const s = o.size[0] + hh(i, 3) * (o.size[1] - o.size[0]);
      const sw = Math.sin(t * 5.5 + hh(i, 4) * 6) * o.sway * (0.6 + hh(i, 5) * 0.6);
      const x = (hh(i, 6) * 2.2 - 1.1) * hw + sw;
      const span = 2 * hv + 2.4 * s + 1;
      const y = o.up ? -hv - s - 0.5 + t * span : hv + s + 0.5 - (t * 0.75 + t * t * 0.25) * span;
      o.spin(i, t, rot);
      place(mesh, i, x, y, z, rot[0], rot[1], rot[2] + sw * 0.35, s);
      sh?.set(i, x, y, z, s * 1.1);
    }
    done(mesh); sh?.done();
  };
  return { scene, pose, mesh };
}

export function leaves(k: Kit): Set3D {
  const mat = translucent(leafAtlas(), 2, 2, { trans: 0.75 });
  return fallSet(k, {
    n: 240, geo: leafGeo(), mat, cols: AUTUMN, dur: 0.85, spread: 0.42, size: [0.42, 0.85], sway: 0.9, shadow: 0.2, cell: (i) => Math.floor(hh(i, 11) * 4),
    spin: (i, t, r) => { r[0] = 0.5 + Math.sin(t * 7 + i) * 0.7; r[1] = hh(i, 7) * 6 + t * (2 + hh(i, 8) * 3); r[2] = hh(i, 9) * 6; },
    back: FRONT + /* glsl */ `
    // an autumn wood at dusk: russet and umber strokes, dark leaf shapes far off, a low amber glow
    vec3 c = painted(p * 2.0, normalize(vec2(1.0, 0.35)), vec3(0.17, 0.08, 0.05), vec3(0.42, 0.18, 0.07), 1.0);
    float lv = smoothstep(0.62, 0.7, fbm(p * 7.0 + 3.0)) * 0.5;
    c = mix(c, vec3(0.09, 0.04, 0.03), lv);
    c += vec3(0.5, 0.26, 0.08) * exp(-dot(p - vec2(0.15, -0.35), p - vec2(0.15, -0.35)) * 2.5) * 0.5;
    col = c; shadeIn(col, a, sh * 0.3);`,
  });
}

export function plumes(k: Kit, down = false): Set3D {
  const mat = translucent(featherAtlas(), 4, 1, { trans: 0.5, flutter: 0.1, alphaTest: 0.04, transparent: true });
  const geo = new THREE.PlaneGeometry(0.55, 1.1, 3, 8);
  { const p = geo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, x * x * 0.7 - y * y * 0.12); } geo.computeVertexNormals(); }
  return fallSet(k, {
    n: down ? 100 : 80, geo, mat, dur: down ? 1.0 : 0.92, spread: 0.5, size: down ? [0.7, 1.4] : [0.9, 1.7], sway: down ? 1.4 : 0.8, shadow: down ? 0.08 : 0.12, up: down, sky: 0xe8dcc8,
    cell: (i) => (down ? (hh(i, 12) > 0.55 ? 3 : hh(i, 12) > 0.2 ? 2 : 0) : Math.floor(hh(i, 12) * 3.3)) + hh(i, 13) * 0.99,
    spin: (i, t, r) => { r[0] = Math.sin(t * 5 + i) * 0.7 + 0.3; r[1] = t * 2 + hh(i, 7) * 6; r[2] = hh(i, 8) * TAU; },
    back: down ? /* glsl */ `
    // down blown up from below: cream linen rising from the bottom
    float y = uv.y; float sh = 0.0;
    float edgeN = (fbm3(vec2(uv.x * 6.0, T * 1.3)) - 0.5) * 0.12;
    float f = smoothstep(0.0, 1.0, fract(min(T, 1.999))) * 1.24 - 0.1 + edgeN;
    if (T < 1.0) a = 1.0 - smoothstep(f - 0.03, f + 0.03, y); else a = smoothstep(f - 0.03, f + 0.03, y);
    if (a < 0.002) discard;
    float weave = vn(uv * vec2(260.0, 6.0) * vec2(uAspect, 1.0)) * 0.5 + vn(uv * vec2(6.0, 300.0)) * 0.5;
    col = vec3(0.95, 0.9, 0.8) * (0.9 + weave * 0.08 + fbm3(p * 3.0) * 0.08) * (0.85 + 0.2 * exp(-dot(p, p) * 1.5));` : FRONT + /* glsl */ `
    // oat paper, softly lit, its fibres and a deckle shadow at the edge
    float fib = fbm3(uv * vec2(90.0, 120.0)) * 0.06 + fbm3(uv * 7.0) * 0.07;
    col = vec3(0.94, 0.89, 0.79) * (0.88 + fib) * (0.84 + 0.22 * exp(-dot(p, p) * 1.6));
    shadeIn(col, a, sh * 0.22);`,
  });
}

/** feathers in a 4 x 1 atlas: two barred wing feathers, a cream contour feather, a white down fluff */
function featherAtlas(): THREE.Texture {
  const tones: [string, string, string][] = [['#e0bc86', '#a8703a', '#5e3a18'], ['#cfa06a', '#8e5a2a', '#4a2a10'], ['#f6eedc', '#e0d0b4', '#b8a284'], ['#ffffff', '#f4eee6', '#d8d0c4']];
  return paint('feathers', 512, 256, (g) => {
    for (let c = 0; c < 4; c++) {
      g.save(); g.translate(c * 128, 0);
      const tone = tones[c], fluff = c === 3;
      const shape = (y: number) => { const t = y / 256; return fluff ? Math.sin(Math.min(1, t * 1.05) * Math.PI) * 52 + 6 : Math.sin(Math.min(1, t * 1.15) * Math.PI) * 48 * (t < 0.15 ? t / 0.15 : 1) + 4; };
      for (let y = 6; y < 240; y += fluff ? 2.2 : 1.6) {
        const w = shape(y), soft = fluff || y > 190;
        for (const side of [-1, 1]) {
          const ang = -0.55 - (y / 256) * 0.35, len = w * (0.85 + hh(y, c + side) * 0.2) * (side > 0 ? 1 : 0.82);
          const gr = g.createLinearGradient(64, y, 64 + side * len, y + ang * len * 0.6);
          gr.addColorStop(0, tone[0]); gr.addColorStop(0.55, tone[1]); gr.addColorStop(1, soft ? 'rgba(255,255,255,0)' : tone[2]);
          g.strokeStyle = gr; g.globalAlpha = soft ? 0.45 : 0.88 - hh(y, c) * 0.25; g.lineWidth = soft ? 1.6 : 1.1;
          g.beginPath(); g.moveTo(64, y);
          if (fluff) g.bezierCurveTo(64 + side * len * 0.3, y - 10, 64 + side * len * 0.8, y + 6 * Math.sin(y), 64 + side * len, y + ang * len * 0.3 + Math.sin(y * 0.3) * 6);
          else g.quadraticCurveTo(64 + side * len * 0.5, y + ang * len * 0.15, 64 + side * len, y + ang * len * 0.55);
          g.stroke();
        }
        if (!fluff && hh(y, c + 9) > 0.985) g.clearRect(64 + (hh(y, 2) > 0.5 ? 6 : -40), y - 2, 34, 3);
      }
      if (c < 2) {
        g.globalCompositeOperation = 'source-atop';
        for (let y = 18; y < 190; y += 22 + c * 4) { g.fillStyle = 'rgba(48,26,10,0.5)'; g.beginPath(); g.ellipse(64, y, 60, 4.5, -0.25, 0, TAU); g.fill(); }
        g.globalCompositeOperation = 'source-over';
      }
      g.globalAlpha = 1;
      const q = g.createLinearGradient(60, 0, 68, 0); q.addColorStop(0, '#cfc2a8'); q.addColorStop(0.5, '#fbf3e2'); q.addColorStop(1, '#b8a888');
      g.strokeStyle = q; g.lineWidth = fluff ? 1.5 : 3; g.beginPath(); g.moveTo(64, fluff ? 40 : 4); g.quadraticCurveTo(66, 130, 63, 252); g.stroke();
      g.restore();
    }
  });
}

// ------------------------------------------------------------------ acorns

function cupTex() {
  return paint('cup', 256, 128, (g) => {
    g.fillStyle = '#6e5232'; g.fillRect(0, 0, 256, 128);
    for (let row = 0; row < 9; row++) for (let i = 0; i < 18; i++) {
      const x = i * 14.2 + (row % 2) * 7, y = row * 14 + 4;
      const gr = g.createLinearGradient(x, y - 8, x, y + 8); gr.addColorStop(0, '#b89464'); gr.addColorStop(0.6, '#7d5f3a'); gr.addColorStop(1, '#3e2c18');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 8, 9, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,18,8,.6)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y + 1, 7.5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    }
  });
}
function nutTex() {
  return paint('nut', 128, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#d2a462'); gr.addColorStop(0.14, '#9a581f'); gr.addColorStop(0.65, '#723a12'); gr.addColorStop(1, '#3e1c06');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(${hh(i, 1) > 0.5 ? '255,220,160' : '50,24,8'},${0.05 + hh(i, 2) * 0.09})`; g.lineWidth = 0.6 + hh(i, 3) * 1.4; const x = hh(i, 4) * 128; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 3, 40, x - 3, 85, x + 1, 128); g.stroke(); }
  });
}

export function acorns(k: Kit): Set3D {
  const scene = new THREE.Scene();
  rig(scene, k, { keyI: 2.8, fill: 0.6 });
  const back = backdrop(FRONT + /* glsl */ `
    // a warm walnut dusk, grain running across, a soft lamp glow in the middle
    vec3 c = painted(vec2(p.x * 0.6, p.y * 3.0), vec2(1.0, 0.04), vec3(0.15, 0.08, 0.04), vec3(0.36, 0.2, 0.1), 1.6);
    c *= 0.7 + 0.5 * exp(-dot(p, p) * 2.2);
    col = c; shadeIn(col, a, sh * 0.3);`);
  scene.add(back);
  const V2 = (pts: number[][]) => pts.map(([x, y]) => new THREE.Vector2(x, y));
  const nut = new THREE.LatheGeometry(V2([[0, -0.62], [0.12, -0.58], [0.3, -0.4], [0.4, -0.12], [0.42, 0.1], [0.4, 0.22], [0.36, 0.28], [0, 0.3]]), 18);
  const cup = new THREE.LatheGeometry(V2([[0.37, 0.18], [0.46, 0.22], [0.48, 0.34], [0.42, 0.46], [0.24, 0.53], [0.05, 0.55], [0, 0.55]]), 18);
  const stem = new THREE.CylinderGeometry(0.035, 0.05, 0.22, 6); stem.translate(0, 0.64, 0); stem.rotateZ(0.2);
  const cupStem = mergeGeometries([cup, stem]);
  const nm = new THREE.MeshPhongMaterial({ map: nutTex(), shininess: 70, specular: 0x6a4a30 }); // glossy, and much cheaper than PBR
  const cm = new THREE.MeshLambertMaterial({ map: cupTex() });
  const n = 80;
  const nuts = instanced(nut, nm, n), cups = instanced(cupStem, cm, n);
  // a cheap motion blur: a faint copy a moment behind
  const gm = nm.clone(); gm.transparent = true; gm.opacity = 0.28; gm.depthWrite = false;
  const gn = instanced(nut, gm, n);
  const sh = new Shadows(n, 16, 0.3);
  scene.add(nuts, cups, gn, sh.mesh);
  const at = (i: number, T: number, ms: THREE.InstancedMesh[], shadow: boolean) => {
    const wave = i % 2, d0 = wave ? 1.0 + hh(i, 1) * 0.45 : hh(i, 1) * 0.45;
    const t = (T - d0) / 0.78;
    if (t < -0.02 || t > 1.05) { for (const m of ms) hide(m, i); if (shadow) sh.hide(i); return; }
    const z = -12 + (hh(i, 2) - 0.5) * 6, hw = hwAt(k, -z), hv = hvAt(k, -z);
    const s = 0.55 + hh(i, 3) * 0.5;
    const x = (hh(i, 4) * 2.2 - 1.1) * hw, y = hv + 1 - (t * t * 0.55 + t * 0.45) * (2 * hv + 2.4);
    const rx = hh(i, 5) * 6 + t * (4 + hh(i, 6) * 6), ry = hh(i, 7) * 6 + t * 3, rz = hh(i, 8) * 6 + t * (3 + hh(i, 9) * 5);
    for (const m of ms) place(m, i, x, y, z, rx, ry, rz, s);
    if (shadow) sh.set(i, x, y, z, s * 1.3);
  };
  const A = [nuts, cups], G = [gn];
  return {
    scene,
    pose(T, time) {
      backPose(back, k, T, time);
      for (let i = 0; i < n; i++) { at(i, T, A, true); at(i, T - 0.035, G, false); }
      done(nuts, cups, gn); sh.done();
    },
  };
}

// ------------------------------------------------------------------ branch

/** a tapered twig along a curve */
function twig(pts: THREE.Vector3[], r0: number, r1: number, seg = 24): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, seg, 1, 7, false);
  const p = geo.attributes.position as THREE.BufferAttribute, c = new THREE.Vector3();
  for (let j = 0; j <= seg; j++) {
    const u = j / seg; curve.getPointAt(u, c);
    const r = r0 + (r1 - r0) * u;
    for (let i = 0; i <= 7; i++) { const vi = j * 8 + i; p.setXYZ(vi, c.x + (p.getX(vi) - c.x) * r, c.y + (p.getY(vi) - c.y) * r, c.z + (p.getZ(vi) - c.z) * r); }
  }
  geo.computeVertexNormals();
  return geo;
}

export function branch(k: Kit): Set3D {
  const scene = new THREE.Scene();
  rig(scene, k, { keyI: 2.6, fill: 0.8, sky: 0x9ab0c8 });
  const back = backdrop(/* glsl */ `
    // a green canopy at dusk dragged in behind the branch, dappled with low warm light
    float x = uRev > 0.5 ? 1.0 - uv.x : uv.x;
    float edgeN = (fbm3(vec2(uv.y * 7.0, T)) - 0.5) * 0.08 + (vn(vec2(uv.y * 30.0, 1.0)) - 0.5) * 0.03;
    float f = uF + edgeN; float sh = 0.0;
    if (T < 1.0) { a = 1.0 - smoothstep(f - 0.01, f + 0.01, x); sh = exp(-max(0.0, x - f) * 18.0) * step(f, x) * step(0.02, uF); }
    else a = smoothstep(f - 0.01, f + 0.01, x);
    if (a < 0.002 && sh < 0.01) discard;
    vec3 c = painted(p * 2.2, normalize(vec2(0.6, 1.0)), vec3(0.05, 0.11, 0.07), vec3(0.15, 0.27, 0.15), 1.0);
    float lf = smoothstep(0.58, 0.66, fbm(p * 6.0 + 7.0));
    c = mix(c, vec3(0.03, 0.07, 0.05), lf * 0.6);
    float dap = smoothstep(0.66, 0.74, fbm(p * 4.0 + vec2(uTime * 0.05, 0.0)));
    c += vec3(0.45, 0.38, 0.14) * dap * 0.35;
    col = c; shadeIn(col, a, sh * 0.32);`, { uF: { value: 0 } }, 'uniform float uF;');
  scene.add(back);
  // the branch: a crooked main stem and two side twigs, in bark
  const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
  const main = [V(0.15, -2.2), V(-0.05, -1.2, 0.1), V(0.12, -0.2), V(-0.08, 0.8, -0.1), V(0.1, 1.8), V(0.0, 2.4)];
  const side1 = [V(0.1, -0.4), V(0.5, 0.1, 0.1), V(0.85, 0.65), V(1.05, 1.1)];
  const side2 = [V(-0.02, 0.6), V(-0.5, 1.0, 0.1), V(-0.8, 1.6), V(-0.95, 2.0)];
  const side3 = [V(0.08, -1.4), V(-0.4, -1.0), V(-0.8, -0.85, 0.1), V(-1.1, -0.5)];
  const wood = mergeGeometries([twig(main, 0.11, 0.035, 30), twig(side1, 0.06, 0.018), twig(side2, 0.06, 0.018), twig(side3, 0.05, 0.016)]);
  const bk = bark('#6a4a30', 5);
  const wm = new THREE.MeshLambertMaterial({ map: bk.map, bumpMap: bk.bump, bumpScale: 1.5 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(wood, wm));
  // leaves along the twigs, alternating sides, facing out
  const curves = [main, side1, side2, side3].map((c) => new THREE.CatmullRomCurve3(c));
  const nL = 120;
  const lg = leafGeo(); lg.translate(0, 0.5, 0); // pivot at the stalk
  cells(lg, nL, (i) => (hh(i, 3) > 0.7 ? 1 : hh(i, 3) > 0.35 ? 2 : 3) + hh(i, 4) * 0.99);
  const lm = translucent(leafAtlas(), 2, 2, { trans: 0.8 });
  const lv = instanced(lg, lm, nL);
  tint(lv, [...SUMMER, ...SUMMER, 0xd8a030, 0xc06a24], 5, 0.12);
  g.add(lv);
  const base: { p: THREE.Vector3; rz: number; rx: number; s: number }[] = [];
  const tan = new THREE.Vector3();
  for (let i = 0; i < nL; i++) {
    const c = curves[i < 50 ? 0 : 1 + (i % 3)], u = 0.08 + hh(i, 1) * 0.92;
    const pt = c.getPointAt(u); c.getTangentAt(u, tan);
    const side = i % 2 ? 1 : -1;
    base.push({ p: pt, rz: Math.atan2(tan.y, tan.x) - Math.PI / 2 + side * (0.7 + hh(i, 2) * 0.6), rx: (hh(i, 5) - 0.5) * 1.2, s: 0.42 + hh(i, 6) * 0.36 });
  }
  scene.add(g);
  // loose leaves shaken off behind it
  const nF = 36;
  const fg = leafGeo(); cells(fg, nF, (i) => Math.floor(hh(i, 9) * 4));
  const loose = instanced(fg, lm, nF); tint(loose, [...SUMMER, 0xd8a030], 8);
  scene.add(loose);
  const sh = new Shadows(1, 16, 0.25); scene.add(sh.mesh);
  const D = 7;
  // the branch's screen x (0..1) through a sweep: off the left at 0, off the right at 1
  const sweep = (e: number) => -0.7 + e * 2.4;
  return {
    scene,
    pose(T, time) {
      const half = T < 1 ? T : T - 1, e = smooth((half - 0.02) / 0.9);
      const hw = hwAt(k, D), hv = hvAt(k, D), dir = k.run.rev ? -1 : 1;
      const sx = sweep(e), wx = (sx * 2 - 1) * hw * dir;
      g.position.set(wx, -hv * 0.05, -D);
      g.scale.setScalar(Math.min(hv / 2.1, hw / 1.05));
      g.rotation.set(0.15, (0.4 - e * 0.8) * dir, (0.35 - e * 0.7) * dir);
      backPose(back, k, T, time);
      back.material.uniforms.uF.value = T < 1 ? (e <= 0 ? -0.2 : sx - 0.06) : (e >= 1 ? 1.3 : sx - 0.06);
      lm.userData.u.uTime.value = time;
      for (let i = 0; i < nL; i++) {
        const b = base[i], fl = Math.sin(time * 6 + i * 1.7) * 0.12 + Math.sin(e * 20 + i) * 0.25 * Math.sin(e * Math.PI);
        place(lv, i, b.p.x, b.p.y, b.p.z, b.rx + fl, fl * 0.8, b.rz, b.s);
      }
      done(lv);
      // the loose ones: torn off as the branch passes, tumbling down behind it
      for (let i = 0; i < nF; i++) {
        const u0 = 0.1 + hh(i, 1) * 0.8, t = (e - u0 * 0.7) * 2.2;
        if (t < 0 || t > 1.5 || e <= 0 || e >= 1) { hide(loose, i); continue; }
        const z = -(D - 1 + hh(i, 2) * 3), lhw = hwAt(k, -z), lhv = hvAt(k, -z);
        const x = ((sweep(u0 * 0.7 + 0.15) * 2 - 1) * lhw - t * 0.8) * dir, y = (hh(i, 3) * 1.8 - 0.9) * lhv - t * t * lhv * 0.6;
        place(loose, i, x, y, z, t * 6 + i, t * 4, hh(i, 4) * 6, 0.45 + hh(i, 5) * 0.3);
      }
      done(loose);
      sh.set(0, wx, 0, -D, hv * 1.6, 0.35); sh.done();
      sh.mesh.visible = e > 0 && e < 1;
    },
  };
}
