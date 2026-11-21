// The globe's stand: a turned oak pedestal with carved rings and a brass collar, and the brass meridian ring
// engraved with degree marks, with axle pins at the poles. Built in code (lathe + a flat band) and wrapped in
// hand-painted pixel textures, lit with banded, dithered light so it sits in the pixel-art render.
// [globe] OWNED BY THE GLOBE BUILDER.
import * as THREE from 'three';

const NOISE = /* glsl */ `
float bayer(vec2 p){ vec2 q = mod(floor(p), 4.0);
  float b = q.x == 0.0 ? (q.y == 0.0 ? 0.0 : q.y == 1.0 ? 12.0 : q.y == 2.0 ? 3.0 : 15.0)
          : q.x == 1.0 ? (q.y == 0.0 ? 8.0 : q.y == 1.0 ? 4.0 : q.y == 2.0 ? 11.0 : 7.0)
          : q.x == 2.0 ? (q.y == 0.0 ? 2.0 : q.y == 1.0 ? 14.0 : q.y == 2.0 ? 1.0 : 13.0)
          : (q.y == 0.0 ? 10.0 : q.y == 1.0 ? 6.0 : q.y == 2.0 ? 9.0 : 5.0);
  return (b + 0.5) / 16.0; }`;

const VS = /* glsl */ `varying vec3 vWN; varying vec3 vWP; varying vec2 vUv;
void main(){ vUv = uv; vWN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = /* glsl */ `uniform sampler2D map; uniform float uShine; varying vec3 vWN; varying vec3 vWP; varying vec2 vUv;
${NOISE}
void main(){
  vec3 c = texture2D(map, vUv).rgb;
  vec3 n = normalize(vWN);
  float b = bayer(gl_FragCoord.xy);
  vec3 key = normalize(vec3(-0.55, 0.75, 0.6));
  float l = dot(n, key) * 0.5 + 0.5 + (b - 0.5) * 0.16;
  float f = l > 0.72 ? 1.06 : l > 0.48 ? 0.9 : l > 0.28 ? 0.74 : 0.6;
  vec3 col = c * f;
  if (n.y < -0.35) col = mix(col, vec3(0.16, 0.2, 0.27), 0.3);
  if (uShine > 0.0) {
    vec3 v = normalize(cameraPosition - vWP);
    float s = pow(max(dot(reflect(-key, n), v), 0.0), 14.0);
    if (s > 0.6 + b * 0.25) col = mix(col, vec3(0.99, 0.93, 0.75), 0.8 * uShine);
    else if (s > 0.25 + b * 0.2) col = mix(col, vec3(0.9, 0.8, 0.58), 0.35 * uShine);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ pixel painting

const rgb = (c: number) => `rgb(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255})`;
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function canvasTex(w: number, h: number, paint: (set: (x: number, y: number, c: number) => void) => void): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  paint((x, y, c) => { g.fillStyle = rgb(c); g.fillRect(x, y, 1, 1); });
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** Oak ramp, darkest first (hue-shifted: cool shadows, warm lights). */
const OAK = [0x3a2c22, 0x4a392b, 0x5e4834, 0x6f553d, 0x84674a, 0x9c7a56, 0xb08c64, 0xc4a57c];
const BRASS = [0x4f3f22, 0x6e5730, 0x8e7440, 0xab8f52, 0xc8a764, 0xd8bf82, 0xe8d7a6];

/** Turned wood: grain running up the turning, carved grooves where the profile turns sharply. */
function woodTexture(grooves: number[], bands: [number, number][]): THREE.Texture {
  const W = 96, H = 128;
  return canvasTex(W, H, (set) => {
    const colT: number[] = [];
    for (let x = 0; x < W; x++) colT.push((rnd() - 0.5) * 1.4);
    for (let x = 0; x < W; x++) {
      let run = 0, off = 0;
      for (let y = 0; y < H; y++) {
        if (run-- <= 0) { run = 3 + Math.floor(rnd() * 9); off = (rnd() - 0.5) * 1.2; }
        const v = 1 - y / (H - 1);
        let t = 4.2 + colT[x] * 0.8 + off + Math.sin(x * 0.7 + y * 0.05) * 0.4;
        if (x % 7 === 3 && rnd() < 0.7) t -= 1.2;                 // dark grain lines
        for (const [a, b] of bands) if (v >= a && v <= b) t -= 1.4;    // the darker carved collar
        for (const gv of grooves) {
          const d = (v - gv) * (H - 1);
          if (Math.abs(d) < 0.6) t = 1;                               // the cut
          else if (d > 0.6 && d < 1.6) t += 1.6;                     // lit lip above it
        }
        const i = Math.max(0, Math.min(OAK.length - 1, Math.round(t)));
        set(x, y, OAK[i]);
      }
    }
  });
}

/** The meridian band: polished brass, engraved every 10 degrees with a longer mark every 30, rimmed edges. */
function brassTexture(): THREE.Texture {
  const W = 360, H = 12;
  return canvasTex(W, H, (set) => {
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
      let t = 4 + Math.sin(x * 0.11) * 0.6 + (rnd() - 0.5) * 0.6;
      if (y === 0 || y === H - 1) t = 2;
      if (y === 1) t = 5.6;
      if (y === H - 2) t = 3;
      const deg = x;
      if (deg % 10 === 0 && y >= 2 && y <= (deg % 30 === 0 ? 7 : 4)) t = 1;
      if (deg % 10 === 1 && y >= 2 && y <= (deg % 30 === 1 ? 7 : 4)) t = 5.8;
      if (deg % 30 === 15 && (y === 8 || y === 9)) t = 1.5;   // little engraved dots between the numbers
      set(x, y, BRASS[Math.max(0, Math.min(BRASS.length - 1, Math.round(t)))]);
    }
  });
}

function plainBrass(): THREE.Texture {
  return canvasTex(16, 16, (set) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) set(x, y, BRASS[Math.max(0, Math.min(6, Math.round(4 + (rnd() - 0.5) * 1.6 + (y < 3 ? 1 : 0))))]); });
}

function mat(map: THREE.Texture, shine = 0) {
  return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { map: { value: map }, uShine: { value: shine } } });
}

/** A flat band ring in the XY plane (radial width ro-ri, depth 2*d), UV u running round it. */
function bandRing(ri: number, ro: number, d: number, seg = 160): THREE.BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
  const face = (f: (a: number) => [number, number, number][], n: (a: number) => [number, number, number], v0: number, v1: number) => {
    const base = pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const [p, q] = f(a);
      pos.push(...p, ...q);
      const nn = n(a);
      nrm.push(...nn, ...nn);
      uv.push(i / seg, v0, i / seg, v1);
    }
    for (let i = 0; i < seg; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  };
  const c = Math.cos, s = Math.sin;
  face((a) => [[c(a) * ri, s(a) * ri, d], [c(a) * ro, s(a) * ro, d]], () => [0, 0, 1], 0.15, 0.85);
  face((a) => [[c(a) * ro, s(a) * ro, -d], [c(a) * ri, s(a) * ri, -d]], () => [0, 0, -1], 0.85, 0.15);
  face((a) => [[c(a) * ro, s(a) * ro, d], [c(a) * ro, s(a) * ro, -d]], (a) => [c(a), s(a), 0], 0.0, 0.1);
  face((a) => [[c(a) * ri, s(a) * ri, -d], [c(a) * ri, s(a) * ri, d]], (a) => [-c(a), -s(a), 0], 0.9, 1.0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Build the stand. The returned group holds the pedestal; `userData.ring` is the meridian ring, which the
 * stage puts in the globe's tilted frame. */
export async function buildStand(): Promise<THREE.Group> {
  seed = 11;
  const g = new THREE.Group();
  // pedestal profile (radius, height), bottom up: foot, ogee, a waisted baluster, a carved collar, the cup
  const prof: [number, number][] = [
    [0.0, -1.8], [0.6, -1.8], [0.66, -1.77], [0.67, -1.72], [0.62, -1.69], [0.55, -1.67], [0.53, -1.63], [0.45, -1.6], [0.32, -1.57],
    [0.22, -1.53], [0.18, -1.49], [0.2, -1.45], [0.17, -1.41], [0.12, -1.37], [0.1, -1.32], [0.11, -1.28], [0.15, -1.26], [0.15, -1.23], [0.0, -1.23],
  ];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  // grooves where the profile changes direction; v runs along the point list
  const grooves = [3, 6, 11, 15, 17].map((i) => i / (prof.length - 1));
  const lathe = new THREE.LatheGeometry(pts, 48);
  const oak = mat(woodTexture(grooves.map((v) => 1 - v), [[1 - 13 / 18, 1 - 10 / 18]]));
  g.add(new THREE.Mesh(lathe, oak));
  // brass collar holding the ring
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 16), mat(plainBrass(), 1));
  collar.position.y = -1.19;
  g.add(collar);
  // the meridian ring (in the tilted frame) with axle pins and knobs at the poles
  const ring = new THREE.Group();
  const band = new THREE.Mesh(bandRing(1.085, 1.145, 0.024), mat(brassTexture(), 1));
  ring.add(band);
  const brass = mat(plainBrass(), 1);
  for (const sgn of [1, -1]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8), brass);
    pin.position.y = sgn * 1.04;
    ring.add(pin);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6), brass);
    knob.position.y = sgn * 1.17;
    knob.scale.set(1, 0.75, 1);
    ring.add(knob);
  }
  g.userData.ring = ring;
  g.userData.animate = (_t: number) => { /* the stand is still; the globe turns inside it */ };
  return g;
}
