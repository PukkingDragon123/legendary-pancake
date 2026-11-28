// Light and air: banks of lit cumulus, a dream haze with bokeh, the night falling with a moon, dawn over painted hills,
// a snow flurry with frost creeping over the glass, fireflies swarming in at dusk, and a plain painted dusk.
import * as THREE from 'three';
import { additive, backdrop, backPose, blobTex, cells, clamp01, done, ease, hh, hide, hvAt, hwAt, instanced, type Kit, paint, patch, place, rig, type Set3D, Shadows, smooth, TAU } from './kit.ts';

/**
 * A flat glowing (or softly lit) thing facing the camera, many at once: `fs` sets `vec4 c` (sRGB colour, alpha) from
 * q (-1..1 across the quad), vCol (the instance colour: its brightness) and the uniforms. Additive or normal blending.
 */
function glowMat(fs: string, o: { additive?: boolean; uniforms?: Record<string, THREE.IUniform>; head?: string } = {}): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; varying vec3 vCol;
void main(){ vUv = uv; vCol = vec3(1.0);
#ifdef USE_INSTANCING_COLOR
  vCol = instanceColor;
#endif
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vCol; uniform float uTime; ${o.head ?? ''}
void main(){ vec2 q = vUv * 2.0 - 1.0; vec4 c = vec4(0.0); ${fs}
  if (c.a < 0.003) discard; gl_FragColor = c; }`,
    uniforms: { uTime: { value: 0 }, ...(o.uniforms ?? {}) },
    transparent: true, depthWrite: false, toneMapped: false,
  });
  return o.additive ? additive(m) : m;
}
const _c = new THREE.Color();
const setCol = (m: THREE.InstancedMesh, i: number, r: number, g: number, b: number) => m.setColorAt(i, _c.setRGB(r, g, b, THREE.SRGBColorSpace));
/** give an instanced mesh an instance colour buffer (so the shader gets USE_INSTANCING_COLOR from the first compile) */
const withColors = (m: THREE.InstancedMesh) => { for (let i = 0; i < m.count; i++) setCol(m, i, 1, 1, 1); return m; };

// ------------------------------------------------------------------ clouds

/** a cumulus puff, lit from the upper left with a silver rim and a cool blue-violet underside; alpha eroded */
function puffTex(): THREE.Texture {
  return paint('puff', 160, 160, (g) => {
    const N = 160, img = g.createImageData(N, N), d = img.data;
    const sn = (x: number, y: number, c: number) => { const ix = Math.floor(x / c), iy = Math.floor(y / c), fx = x / c - ix, fy = y / c - iy; const a = hh(ix, iy), b = hh(ix + 1, iy), e = hh(ix, iy + 1), f = hh(ix + 1, iy + 1); const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return a + (b - a) * u + (e - a) * v + (a - b - e + f) * u * v; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const nx = (x - N / 2) / (N * 0.47), ny = (y - N / 2) / (N * 0.47), r2 = nx * nx + ny * ny;
      const n = sn(x, y, 16) * 0.5 + sn(x + 300, y, 7) * 0.3 + sn(x, y + 500, 3) * 0.2;
      const a = clamp01((1 - r2 - (n - 0.5) * 0.5) * 3.2);
      const nz = Math.sqrt(Math.max(0, 1 - r2));
      const lit = clamp01(-nx * 0.45 - ny * 0.7 + nz * 0.5 + (n - 0.5) * 0.3);
      const rim = Math.pow(clamp01(1 - nz), 3) * clamp01(-nx - ny) * 0.4;
      const R = 0.62 + lit * 0.42 + rim, G = 0.65 + lit * 0.38 + rim, B = 0.8 + lit * 0.22 + rim * 0.8;
      const i = (y * N + x) * 4;
      d[i] = Math.min(255, R * 248); d[i + 1] = Math.min(255, G * 244); d[i + 2] = Math.min(255, B * 240); d[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
  }, { mips: false });
}

export function clouds(k: Kit): Set3D {
  const scene = new THREE.Scene();
  const back = backdrop(/* glsl */ `
    // white sky closing in from both sides behind the clouds, parting in the middle after
    float x = abs(uv.x - 0.5) * 2.0;
    float edgeN = (fbm3(vec2(uv.y * 5.0, T * 1.5)) - 0.5) * 0.14;
    if (T < 1.0) { float f = 1.0 - smoothstep(0.0, 1.0, T) * 1.18 + edgeN; a = smoothstep(f - 0.07, f + 0.07, x); }
    else { float f = smoothstep(0.0, 1.0, T - 1.0) * 1.18 + edgeN; a = smoothstep(f - 0.07, f + 0.07, x); }
    if (a < 0.002) discard;
    float sh = fbm3(uv * vec2(3.0, 4.0) + vec2(uTime * 0.03, 0.0));
    col = mix(vec3(0.68, 0.74, 0.88), vec3(0.98, 0.96, 0.94), smoothstep(0.15, 0.9, uv.y * 0.7 + sh * 0.5));
    col = mix(col, vec3(1.0, 0.94, 0.86), smoothstep(0.6, 1.0, uv.y) * 0.4);`);
  scene.add(back);
  const nC = 12, per = 9, n = nC * per;
  const mat = glowMat('c = texture2D(uMap, vUv); c.rgb *= vCol;', { uniforms: { uMap: { value: puffTex() } }, head: 'uniform sampler2D uMap;' });
  const puffs = withColors(instanced(new THREE.PlaneGeometry(1, 1), mat, n));
  // the lower puffs of each cloud a little darker and cooler (shade under the bank)
  const off: [number, number, number, number][] = [];
  for (let c = 0; c < nC; c++) for (let j = 0; j < per; j++) {
    const a = hh(c * 31 + j, 2) * TAU, rr = Math.sqrt(hh(c * 31 + j, 3));
    const low = j < 3;
    off.push([Math.cos(a) * rr * 2.0, Math.sin(a) * rr * 0.8 + (low ? -0.45 : 0.25), (hh(c, j) - 0.5) * 0.6 + (low ? -0.2 : 0), 1.5 + hh(c * 7 + j, 4) * 1.5]);
    const s = low ? 0.82 : 1;
    setCol(puffs, c * per + j, s * 0.97, s * 0.98, s);
  }
  // draw far puffs first
  scene.add(puffs);
  const sh = new Shadows(nC, 18, 0.16, 0x1a2440);
  scene.add(sh.mesh);
  return {
    scene,
    pose(T, time) {
      backPose(back, k, T, time);
      for (let c = 0; c < nC; c++) {
        const side = c % 2 ? 1 : -1, z = -12 + (hh(c, 5) - 0.5) * 5, hw = hwAt(k, -z), hv = hvAt(k, -z);
        const home = side * (0.05 + hh(c, 6) * 0.6) * hw, out = side * (hw + 4.5);
        const e = T < 1 ? smooth(T * 1.06 - hh(c, 7) * 0.06) : 1 - smooth(T - 1 - hh(c, 8) * 0.05);
        const cx = out + (home - out) * e + Math.sin(time * 0.3 + c) * 0.1, cy = (hh(c, 9) * 2 - 1) * hv * 0.95;
        const s = 1.25 + hh(c, 10) * 0.8;
        const on = e > 0.001;
        for (let j = 0; j < per; j++) {
          const i = c * per + j;
          if (!on) { hide(puffs, i); continue; }
          const [ox, oy, oz, ps] = off[i];
          place(puffs, i, cx + ox * s, cy + oy * s, z + oz, 0, 0, 0, ps * s);
        }
        if (on) sh.set(c, cx, cy - 0.5, z, s * 4.5, 1.4); else sh.hide(c);
      }
      done(puffs); sh.done();
    },
  };
}

// ------------------------------------------------------------------ dream

export function dream(k: Kit): Set3D {
  const scene = new THREE.Scene();
  const back = backdrop(/* glsl */ `
    // a lavender haze closing in from the edges (opening from the middle), drifting nebula and pinprick stars
    float r = length(p) / (0.5 * sqrt(uAspect * uAspect + 1.0));
    float edgeN = (fbm3(vec2(atan(p.y, p.x) * 3.0, uTime * 0.2)) - 0.5) * 0.18;
    if (T < 1.0) { float f = 1.0 - smoothstep(0.0, 1.0, T) * 1.25 + edgeN; a = smoothstep(f - 0.12, f + 0.12, r); }
    else { float f = smoothstep(0.0, 1.0, T - 1.0) * 1.3 + edgeN; a = smoothstep(f - 0.12, f + 0.12, r); }
    if (a < 0.002) discard;
    float neb = fbm(p * 3.0 + vec2(uTime * 0.05, -uTime * 0.03));
    col = mix(vec3(0.07, 0.06, 0.2), vec3(0.38, 0.27, 0.58), smoothstep(0.25, 0.85, neb) * (0.4 + r * 0.8));
    col += vec3(0.95, 0.72, 0.9) * pow(smoothstep(0.55, 0.95, neb), 3.0) * 0.3;
    float st = step(0.996, h21(floor(uv * vec2(260.0 * uAspect, 260.0))));
    col += vec3(1.0, 0.95, 0.85) * st * (0.5 + 0.5 * sin(uTime * 3.0 + h21(floor(uv * 200.0)) * 40.0));`);
  scene.add(back);
  const n = 96;
  const mat = glowMat(`float r = length(q); float a = smoothstep(1.0, 0.86, r) * (0.4 + 0.6 * smoothstep(0.55, 0.95, r)) + exp(-r * r * 3.0) * 0.15; c = vec4(vCol * a, a);`, { additive: true });
  const bokeh = withColors(instanced(new THREE.PlaneGeometry(1, 1), mat, n));
  const cols = [[1, 0.84, 0.94], [0.75, 0.66, 1], [1, 0.91, 0.69], [0.62, 0.85, 1]];
  scene.add(bokeh);
  return {
    scene,
    pose(T, time) {
      backPose(back, k, T, time);
      const fadeIn = Math.min(1, T * 3), fadeOut = T > 1.6 ? Math.max(0, (2 - T) / 0.4) : 1;
      for (let i = 0; i < n; i++) {
        const z = -12 + (hh(i, 2) - 0.5) * 8, hw = hwAt(k, -z), hv = hvAt(k, -z);
        const R0 = Math.hypot(hw, hv) * (0.7 + hh(i, 3) * 0.6);
        const r = T < 1 ? R0 * (1 - smooth(T) * 0.75) : R0 * (0.25 + smooth(T - 1) * 1.1);
        const a = hh(i, 4) * TAU + T * (1.6 + hh(i, 5)) * (i % 2 ? 1 : -1);
        const s = (0.25 + hh(i, 6) * 0.9) * (0.75 + 0.25 * Math.sin(time * 2 + i));
        place(bokeh, i, Math.cos(a) * r, Math.sin(a) * r * 0.75, z, 0, 0, 0, s);
        const c = cols[i % 4], b = (0.3 + hh(i, 1) * 0.4) * fadeIn * fadeOut * (1 - 0.55 * smooth(1 - Math.abs(T - 1) * 2)); // dimmer where they crowd together
        setCol(bokeh, i, c[0] * b, c[1] * b, c[2] * b);
      }
      done(bokeh); if (bokeh.instanceColor) bokeh.instanceColor.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------ stars

function moonTex(): THREE.Texture {
  return paint('moon', 256, 128, (g, W, H) => {
    g.fillStyle = '#d8d4c8'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(110,110,120,${0.12 + hh(i, 1) * 0.2})`; g.beginPath(); g.ellipse(hh(i, 2) * W, 20 + hh(i, 3) * 88, 8 + hh(i, 4) * 26, 6 + hh(i, 5) * 16, hh(i, 6) * 3, 0, TAU); g.fill(); }
    for (let i = 0; i < 70; i++) {
      const x = hh(i, 7) * W, y = 8 + hh(i, 8) * (H - 16), r = 1 + hh(i, 9) * 5;
      g.strokeStyle = 'rgba(255,255,250,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(x - 0.6, y - 0.6, r, Math.PI * 0.8, Math.PI * 1.9); g.stroke();
      g.strokeStyle = 'rgba(60,60,70,0.3)'; g.beginPath(); g.arc(x + 0.6, y + 0.6, r, -0.2, Math.PI * 0.9); g.stroke();
    }
  });
}

export function stars(k: Kit): Set3D {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0x405080, 0x101020, 0.25));
  const sun = new THREE.DirectionalLight(0xfff4e0, 3.2); sun.position.set(-3, 1.2, 2.2); scene.add(sun);
  const back = backdrop(/* glsl */ `
    // the night falling from the top (lifting after): indigo with a painted milky way and a soft glow low down
    float y = 1.0 - uv.y;
    float edgeN = (fbm3(vec2(uv.x * 4.0, T)) - 0.5) * 0.1;
    float f = smoothstep(0.0, 1.0, fract(min(T, 1.999))) * 1.3 - 0.15 + edgeN;
    if (T >= 1.0) f = 1.0 - f; // lifting: the night's lower edge rises back up
    a = 1.0 - smoothstep(f - 0.12, f + 0.02, y);
    if (a < 0.002) discard;
    vec3 c = mix(vec3(0.04, 0.05, 0.13), vec3(0.11, 0.12, 0.28), smoothstep(0.0, 1.0, y));
    vec2 mw = vec2(dot(p, normalize(vec2(1.0, 0.55))), dot(p, normalize(vec2(-0.55, 1.0))));
    float band = exp(-mw.y * mw.y * 18.0) * (0.4 + 0.6 * fbm(mw * vec2(3.0, 9.0) + 3.0));
    c += vec3(0.22, 0.2, 0.36) * band * 0.6 + vec3(0.36, 0.25, 0.35) * pow(fbm(p * 5.0), 3.0) * band;
    c += vec3(0.25, 0.16, 0.22) * smoothstep(0.55, 1.0, y) * 0.5;
    float st = step(0.9975, h21(floor(uv * vec2(300.0 * uAspect, 300.0))));
    c += vec3(0.9, 0.9, 1.0) * st * 0.6;
    col = c;`);
  scene.add(back);
  const n = 140;
  const mat = glowMat(`float r = length(q);
    float core = exp(-r * r * 60.0), glow = exp(-r * r * 7.0) * 0.35;
    float sp = exp(-abs(q.x) * 28.0) * exp(-abs(q.y) * 2.6) + exp(-abs(q.y) * 28.0) * exp(-abs(q.x) * 2.6);
    float a = core + glow + sp * 0.6; c = vec4(vCol * a, a);`, { additive: true });
  const st = withColors(instanced(new THREE.PlaneGeometry(1, 1), mat, n));
  const moonM = new THREE.MeshStandardMaterial({ map: moonTex(), roughness: 0.95, emissive: 0x1a2040, emissiveIntensity: 0.5 });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), moonM);
  const haloM = additive(new THREE.MeshBasicMaterial({ map: blobTex(), color: 0x8090c0, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloM);
  // a thin cloud passing under the moon
  const wispM = new THREE.MeshBasicMaterial({ map: blobTex(), color: 0x30365a, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
  const wisps = instanced(new THREE.PlaneGeometry(1, 1), wispM, 5);
  scene.add(st, halo, moon, wisps);
  const D = 16;
  return {
    scene,
    pose(T, time) {
      backPose(back, k, T, time);
      // the front (shared with the backdrop): screen y (0 top) above which it is night
      const f = smooth(T < 1 ? T : T - 1) * 1.3 - 0.15;
      const hw = hwAt(k, D), hv = hvAt(k, D);
      for (let i = 0; i < n; i++) {
        const sy = hh(i, 2) * 0.95, sx = hh(i, 1);
        const on = T < 1 ? sy < f - 0.05 : sy < 1 - f; // stars come out behind the front, and set ahead of it
        if (!on) { hide(st, i); continue; }
        const z = -(D + hh(i, 3) * 4), w = hwAt(k, -z), v = hvAt(k, -z);
        const big = hh(i, 4) > 0.86, s = (big ? 0.55 : 0.22) * (0.6 + hh(i, 5) * 0.6);
        place(st, i, (sx * 2 - 1) * w, (1 - sy * 2) * v, z, 0, 0, hh(i, 6) * 0.5, s);
        const tw = 0.55 + 0.45 * Math.sin(time * (1.5 + hh(i, 7) * 3) + i), warm = hh(i, 8);
        const b = (big ? 1 : 0.7) * tw * Math.min(1, (T < 1 ? f - 0.05 - sy : 1 - f - sy) * 8);
        setCol(st, i, b * (0.85 + warm * 0.15), b * 0.9, b * (1 - warm * 0.2));
      }
      done(st); if (st.instanceColor) st.instanceColor.needsUpdate = true;
      // the moon comes down with the night and goes up with it
      const e = T < 1 ? ease(T) : 1 - ease(T - 1);
      const mr = Math.min(hw, hv) * 0.3, my = hv * 0.55 + (1 - e) * (hv * 0.8 + mr * 2), mx = hw * 0.45;
      moon.position.set(mx, my, -D); moon.scale.setScalar(mr); moon.rotation.set(0.3, time * 0.05, 0.1);
      halo.position.set(mx, my, -D - 0.5); halo.scale.setScalar(mr * 6.5);
      haloM.opacity = 0.5 * e;
      for (let i = 0; i < 5; i++) {
        const x = mx - hw * 0.4 + ((time * 0.12 + i * 0.37) % 1.6) * hw * 0.8, y = my - mr * (0.6 + hh(i, 1) * 0.8);
        place(wisps, i, x, y, -D + 1 + i * 0.1, 0, 0, 0, mr * (2.5 + hh(i, 2) * 2), mr * 0.5);
      }
      done(wisps); wispM.opacity = 0.55 * e;
    },
  };
}

// ------------------------------------------------------------------ sunrise

/** one painted hill: a strip of columns (top edge, just under it, the bottom) with its distance below the crest */
function hillGeo(seed: number, amp: number, trees: number): THREE.BufferGeometry {
  const N = 160, pos: number[] = [], dep: number[] = [], idx: number[] = [];
  const crowns: [number, number, number][] = [];
  for (let t = 0; t < trees; t++) { const w = 0.012 + hh(t, seed + 2) * 0.022; crowns.push([hh(t, seed) * 2.6 - 1.3, w * (0.9 + hh(t, seed + 1) * 0.6), w]); }
  for (let i = 0; i <= N; i++) {
    const x = -1.3 + (2.6 * i) / N;
    let y = amp * (Math.sin(x * 2.1 + seed) * 0.5 + Math.sin(x * 4.7 + seed * 2) * 0.22 + Math.sin(x * 9.3 + seed * 3) * 0.08);
    for (const [cx, h, w] of crowns) { const d = (x - cx) / w; if (d * d < 1) y = Math.max(y, y + h * Math.sqrt(1 - d * d)); }
    pos.push(x, y, 0, x, y - 0.06, 0, x, -2.5, 0);
    dep.push(0, 0.06, 2.5);
  }
  for (let i = 0; i < N; i++) { const a = i * 3, b = a + 3; idx.push(a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDep', new THREE.Float32BufferAttribute(dep, 1));
  g.setIndex(idx);
  return g;
}

export function sunrise(k: Kit): Set3D {
  const scene = new THREE.Scene();
  const su = { uSun: { value: new THREE.Vector2(0.5, 0.2) }, uOpen: { value: 0 }, uGlow: { value: 0 } };
  const back = backdrop(/* glsl */ `
    // dawn: violet overhead to rose and gold at the hills, streaks of cloud lit from below, the sun's glow and rays;
    // rising from the bottom while covering, then opening out from the sun in a flood of light
    vec2 sp = vec2((uSun.x - 0.5) * uAspect, uSun.y - 0.5);
    float ds = length(p - sp);
    if (T < 1.0) { float f = smoothstep(0.0, 1.0, T) * 1.25 - 0.05 + (fbm3(vec2(uv.x * 4.0, 2.0)) - 0.5) * 0.08; a = 1.0 - smoothstep(f - 0.1, f + 0.02, uv.y); }
    else { a = smoothstep(uOpen - 0.18, uOpen + 0.1, ds + (fbm3(p * 3.0) - 0.5) * 0.12); }
    if (a < 0.002) discard;
    float y = uv.y;
    vec3 c = mix(vec3(0.98, 0.78, 0.5), vec3(0.93, 0.56, 0.5), smoothstep(0.1, 0.45, y));
    c = mix(c, vec3(0.42, 0.36, 0.62), smoothstep(0.42, 0.95, y));
    float cl = fbm(vec2(p.x * 1.6 + uTime * 0.01, p.y * 9.0)) ; float band = smoothstep(0.55, 0.75, cl) * smoothstep(0.25, 0.5, y) * (1.0 - smoothstep(0.75, 0.95, y));
    c = mix(c, mix(vec3(1.0, 0.66, 0.5), vec3(0.7, 0.45, 0.6), smoothstep(0.3, 0.8, y)), band * 0.6);
    c += vec3(1.0, 0.85, 0.55) * exp(-ds * 3.5) * 0.55 + vec3(1.0, 0.95, 0.8) * exp(-ds * 12.0) * 0.4;
    float ang = atan(p.y - sp.y, p.x - sp.x);
    c += vec3(1.0, 0.85, 0.6) * smoothstep(0.55, 0.95, vn(vec2(ang * 9.0, uTime * 0.2))) * exp(-ds * 1.6) * 0.18;
    c = mix(c, vec3(1.0, 0.97, 0.9), uGlow * smoothstep(uOpen + 0.5, uOpen, ds));
    col = c;`, su, 'uniform vec2 uSun; uniform float uOpen; uniform float uGlow;');
  scene.add(back);
  // four layers of hills, far (pale, hazed into the sky) to near (deep green-blue), their crests lit by the sun
  const L = [
    { z: 30, y: -0.06, amp: 0.07, top: [0.82, 0.6, 0.68], low: [0.72, 0.52, 0.64], rim: 0.3, trees: 14 },
    { z: 22, y: -0.17, amp: 0.09, top: [0.6, 0.44, 0.6], low: [0.44, 0.32, 0.5], rim: 0.4, trees: 26 },
    { z: 16, y: -0.28, amp: 0.1, top: [0.3, 0.3, 0.42], low: [0.2, 0.2, 0.32], rim: 0.55, trees: 34 },
    { z: 11, y: -0.4, amp: 0.09, top: [0.13, 0.2, 0.2], low: [0.07, 0.1, 0.12], rim: 0.6, trees: 40 },
  ];
  const hills = L.map((l, i) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: 'attribute float aDep; varying float vDep; varying vec3 vW; void main(){ vDep = aDep; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uLow; uniform float uRim; uniform vec2 uSunW; varying float vDep; varying vec3 vW;
        ${'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }'}
        void main(){ vec3 c = mix(uTop, uLow, smoothstep(0.0, 0.9, vDep));
          float side = exp(-abs(vW.x - uSunW.x) * 0.25);
          c += vec3(1.0, 0.7, 0.4) * uRim * (smoothstep(0.06, 0.0, vDep) * (0.4 + 0.6 * side));
          c *= 0.94 + 0.06 * h(floor(vW.xy * 30.0));
          gl_FragColor = vec4(c, 1.0); }`,
      uniforms: { uTop: { value: new THREE.Vector3(...l.top) }, uLow: { value: new THREE.Vector3(...l.low) }, uRim: { value: l.rim }, uSunW: { value: new THREE.Vector2() } },
      toneMapped: false,
    });
    const m = new THREE.Mesh(hillGeo(i * 7 + 3, l.amp, l.trees), mat);
    m.frustumCulled = false;
    scene.add(m);
    return { m, mat, l };
  });
  // the sun: a hot disc and its glow, set between the second and third hills so the near ones hide it as it rises
  const sunM = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float r = length(vUv * 2.0 - 1.0); float d = smoothstep(0.2, 0.185, r); float g = exp(-r * r * 9.0) * 0.6 + exp(-r * 4.0) * 0.25; vec3 c = mix(vec3(1.0, 0.8, 0.45) * g, vec3(1.0, 0.97, 0.86), d); float a = max(d, g) * uA; gl_FragColor = vec4(c * a, a); }',
    uniforms: { uA: { value: 1 } }, transparent: true, depthWrite: false, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const sunQ = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sunM);
  sunQ.renderOrder = -90;
  scene.add(sunQ);
  const SD = 34;
  return {
    scene,
    pose(T, time) {
      backPose(back, k, T, time);
      const rise = T < 1 ? ease(T) : 1;
      const out = T < 1 ? 0 : ease(T - 1);
      const sx = k.run.cx;
      // the sun: from behind the hills at the end of covering, up into the sky while uncovering
      const shw = hwAt(k, SD), shv = hvAt(k, SD);
      const sunY = (-0.1 + (T < 1 ? -0.3 * (1 - rise) : out * 0.6)) * shv * 2;
      const sunX = (sx * 2 - 1) * shw;
      sunQ.position.set(sunX, sunY, -SD); sunQ.scale.setScalar(Math.min(shw, shv) * 1.4);
      sunM.uniforms.uA.value = T < 1 ? rise : 1 - smooth((out - 0.3) / 0.45);
      su.uSun.value.set(sx, 0.5 + sunY / (shv * 2));
      su.uOpen.value = T < 1 ? 0 : smooth((out - 0.2) / 0.8) * 2.6;
      su.uGlow.value = T < 1 ? 0 : Math.sin(Math.min(1, out * 1.4) * Math.PI) * 0.85;
      for (const { m, mat, l } of hills) {
        const hw = hwAt(k, l.z), hv = hvAt(k, l.z);
        // rise from below (the near hills a little later), sink away while the light floods in
        const up = T < 1 ? smooth((T - (1 - l.z / 30) * 0.25) / 0.75) : 1 - smooth((out - 0.15 - (l.z / 30) * 0.2) / 0.6);
        m.position.set(0, (l.y - (1 - up) * 1.4) * hv * 2, -l.z);
        m.scale.set(Math.max(hv * 2, hw * 0.8), hv * 2, 1); void hw;
        m.visible = up > 0.001;
        mat.uniforms.uSunW.value.set(sunX * (l.z / SD), sunY);
      }
    },
  };
}

// ------------------------------------------------------------------ snow

/** snowflakes in a 2 x 2 atlas: two six-armed dendrites, a hexagonal plate, a soft round clump */
function flakeTex(): THREE.Texture {
  return paint('flakes', 256, 256, (g) => {
    g.lineCap = 'round';
    for (let c = 0; c < 4; c++) {
      const ox = (c % 2) * 128 + 64, oy = (1 - Math.floor(c / 2)) * 128 + 64;
      g.save(); g.translate(ox, oy);
      if (c === 3) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 50); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(240,248,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.fill(); g.restore(); continue; }
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.fillStyle = 'rgba(235,245,255,0.85)';
      for (let a = 0; a < 6; a++) {
        g.save(); g.rotate((a / 6) * TAU);
        if (c === 2) { g.beginPath(); g.moveTo(0, 0); g.lineTo(-24, -42); g.lineTo(24, -42); g.closePath(); g.fill(); g.lineWidth = 2; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, -38); g.stroke(); }
        else {
          g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -54); g.stroke();
          g.lineWidth = 3;
          for (const [y, l] of (c === 0 ? [[-18, 14], [-32, 12], [-44, 8]] : [[-22, 20], [-40, 10]])) { g.beginPath(); g.moveTo(0, y); g.lineTo(-l, y - l * 0.8); g.moveTo(0, y); g.lineTo(l, y - l * 0.8); g.stroke(); }
        }
        g.restore();
      }
      g.fillStyle = 'rgba(255,255,255,1)'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
      g.restore();
    }
  });
}

export function snow(k: Kit): Set3D {
  const scene = new THREE.Scene();
  rig(scene, k, { key: 0xfff4e8, keyI: 2.2, sky: 0xc0d0f0, fill: 1.0, rim: 0xb0d0ff, rimI: 1.6, env: 0.6 });
  const back = backdrop(/* glsl */ `
    // frost creeping in over the glass from the edges, ferns of ice at its front; it melts from the middle after
    // how far in from the glass's edge (0 at the edge, 1 in the middle): between a box and an ellipse, wandering
    vec2 b2 = abs(p) / vec2(0.5 * uAspect, 0.5);
    float edge = 1.0 - mix(max(b2.x, b2.y), length(b2) * 0.75, 0.55) + (fbm3(p * 2.5 + 7.0) - 0.5) * 0.35;
    float fern = 1.0 - abs(2.0 * vn(p * 9.0 + vec2(fbm3(p * 3.0) * 3.0)) - 1.0);
    float n = fbm(p * 4.0) * 0.35 + fern * 0.12;
    float r = length(p) / (0.5 * sqrt(uAspect * uAspect + 1.0));
    float rim;
    if (T < 1.0) { float f = smoothstep(0.0, 1.0, T) * 1.35 - 0.1; float v = f - edge - n * 0.6 + 0.2; a = smoothstep(0.0, 0.05, v); rim = exp(-abs(v) * 30.0); }
    else { float f = smoothstep(0.0, 1.0, T - 1.0) * 1.5 - 0.1; float v = r - f + n * 0.6 - 0.15; a = smoothstep(0.0, 0.06, v); rim = exp(-abs(v) * 30.0) * 0.6; }
    if (a < 0.002) discard;
    vec3 c = mix(vec3(0.72, 0.8, 0.92), vec3(0.94, 0.97, 1.0), smoothstep(0.2, 0.9, fbm3(p * 2.0) * 0.6 + fern * 0.5));
    c *= 0.92 + 0.12 * exp(-dot(p, p) * 1.5);
    c = mix(c, vec3(1.0), rim * 0.5);
    float sp = step(0.994, h21(floor(uv * vec2(220.0 * uAspect, 220.0)))) * (0.5 + 0.5 * sin(uTime * 4.0 + h21(floor(uv * 90.0)) * 30.0));
    c += vec3(0.9, 0.95, 1.0) * sp * 0.7;
    col = c;`);
  scene.add(back);
  const n = 220;
  const geo = new THREE.PlaneGeometry(1, 1); cells(geo, n, (i) => Math.floor(hh(i, 9) * 4));
  const mat = new THREE.MeshStandardMaterial({ map: flakeTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.2, metalness: 0, color: 0xffffff, emissive: 0xdde6f6, emissiveIntensity: 0.95 });
  patch(mat, 'flakes', (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCell;').replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = (vMapUv + vec2(mod(aCell, 2.0), floor(aCell / 2.0))) * 0.5;');
  });
  const flakes = instanced(geo, mat, n);
  scene.add(flakes);
  return {
    scene,
    pose(T, time) {
      backPose(back, k, T, time);
      for (let i = 0; i < n; i++) {
        // gusts from the upper left: each flake crosses once while covering and once while uncovering
        const wave = i % 2, d0 = wave ? 0.95 + hh(i, 1) * 0.5 : hh(i, 1) * 0.5;
        const t = (T - d0) / 0.75;
        if (t < 0 || t > 1) { hide(flakes, i); continue; }
        const z = -(4 + hh(i, 2) * 12), hw = hwAt(k, -z), hv = hvAt(k, -z);
        const sx = hh(i, 3) * 2.4 - 1.7, sy = hh(i, 4) * 2.4 - 0.6; // start, in view units, up and to the left
        const x = (sx + t * 2.2) * hw + Math.sin(t * 9 + i) * 0.15, y = (sy - t * 1.9) * hv + Math.cos(t * 7 + i) * 0.12;
        const s = 0.14 + hh(i, 5) * 0.3 * (hh(i, 9) > 0.75 ? 0.7 : 1);
        place(flakes, i, x, y, z, t * (5 + hh(i, 6) * 6), t * (4 + hh(i, 7) * 5), hh(i, 8) * 6 + t * 2, s);
      }
      done(flakes);
    },
  };
}

// ------------------------------------------------------------------ fireflies

export function fireflies(k: Kit): Set3D {
  const scene = new THREE.Scene();
  const NG = 6;
  const glowPts = Array.from({ length: NG }, () => new THREE.Vector3());
  const back = backdrop(/* glsl */ `
    // dusk closing in from the edges round the centre (opening from it after): deep teal-blue, grass at the bottom,
    // and warm pools where the brightest fireflies light it
    vec2 q = vec2((uv.x - uC.x) * uAspect, uv.y - uC.y);
    float r = length(q) / (0.5 * sqrt(uAspect * uAspect + 1.0)) * 0.8;
    float edgeN = (fbm3(vec2(atan(q.y, q.x) * 2.5, T * 2.0)) - 0.5) * 0.2;
    if (T < 1.0) { float f = 1.15 - smoothstep(0.0, 1.0, T) * 1.4 + edgeN; a = smoothstep(f - 0.1, f + 0.1, r); }
    else { float f = smoothstep(0.0, 1.0, T - 1.0) * 1.4 - 0.15 + edgeN; a = smoothstep(f - 0.1, f + 0.1, r); }
    if (a < 0.002) discard;
    vec3 c = painted(p * 1.6, normalize(vec2(1.0, 0.2)), vec3(0.03, 0.06, 0.09), vec3(0.08, 0.14, 0.18), 1.0);
    c = mix(c, vec3(0.1, 0.12, 0.22), smoothstep(0.3, 1.0, uv.y));
    float blades = smoothstep(0.0, 0.02, 0.16 + fbm3(vec2(uv.x * 60.0 * uAspect, 0.0)) * 0.16 - uv.y);
    c = mix(c, vec3(0.01, 0.03, 0.03), blades);
    for (int i = 0; i < ${NG}; i++) { vec3 g = uGlow[i]; vec2 d = vec2((uv.x - g.x) * uAspect, uv.y - g.y); c += vec3(0.9, 0.7, 0.25) * g.z * exp(-dot(d, d) * 40.0) * 0.35; }
    col = c;`, { uGlow: { value: glowPts } }, `uniform vec3 uGlow[${NG}];`);
  scene.add(back);
  const n = 70;
  const mat = glowMat(`float r = length(q); float core = exp(-r * r * 70.0); float halo = exp(-r * r * 7.0) * 0.38 * (1.0 - r * r * 0.3);
    c = vec4(vCol * halo + vec3(1.0, 1.0, 0.8) * core * vCol.g * 1.3, core + halo);`, { additive: true });
  const flies = withColors(instanced(new THREE.PlaneGeometry(1, 1), mat, n));
  scene.add(flies);
  return {
    scene,
    pose(T, time) {
      backPose(back, k, T, time);
      const D0 = 10, hw0 = hwAt(k, D0), hv0 = hvAt(k, D0);
      const cx = (k.run.cx * 2 - 1) * hw0, cy = (1 - k.run.cy * 2) * hv0;
      const gather = T < 1 ? ease(T) : 1 - ease(T - 1);
      let gi = 0;
      for (let i = 0; i < n; i++) {
        const z = -(6 + hh(i, 2) * 9), sc = -z / D0;
        const rOut = Math.hypot(hw0, hv0) * (1.1 + hh(i, 3) * 0.4), rIn = Math.min(hw0, hv0) * (0.2 + hh(i, 4) * 0.7);
        const r = rOut + (rIn - rOut) * gather;
        const a = hh(i, 5) * TAU + time * (0.4 + hh(i, 6) * 0.5) * (i % 3 ? 1 : -1) + gather * 2;
        const x = (cx + Math.cos(a) * r + Math.sin(time * 1.3 + i) * 0.2) * sc, y = (cy + Math.sin(a * 1.3) * r * 0.75 + Math.cos(time * 1.1 + i * 2) * 0.2) * sc;
        const blink = 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(time * (1.4 + hh(i, 7) * 2) + i * 2.1), 3);
        const fade = T < 1 ? Math.min(1, T * 4) : Math.min(1, (2 - T) * 4);
        const b = blink * fade;
        place(flies, i, x, y, z, 0, 0, 0, 0.32 + hh(i, 8) * 0.3);
        setCol(flies, i, b * 0.85, b * 0.95, b * 0.28);
        if (i % 9 === 0 && gi < NG) { glowPts[gi++].set(0.5 + x / hwAt(k, -z) / 2, 0.5 + y / hvAt(k, -z) / 2, b * (1 - (-z - 6) / 12)); }
      }
      done(flies); if (flies.instanceColor) flies.instanceColor.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------ dusk (dither, fade)

export function dusk(k: Kit): Set3D {
  const scene = new THREE.Scene();
  const back = backdrop(/* glsl */ `
    // a painted dusk swept on diagonally in broad brush strokes from the top left (bottom right reversed)
    float s = (uv.x * uAspect + (1.0 - uv.y)) / (uAspect + 1.0); if (uRev > 0.5) s = 1.0 - s;
    vec2 dir = normalize(vec2(1.0, -1.0 / uAspect));
    vec2 bq = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
    float brush = (fbm3(vec2(bq.x * 1.5, bq.y * 14.0)) - 0.5) * 0.16;
    float f = smoothstep(0.0, 1.0, fract(min(T, 1.999))) * 1.36 - 0.18;
    float v = f - s + brush;
    if (T < 1.0) a = smoothstep(-0.02, 0.06, v); else a = 1.0 - smoothstep(-0.02, 0.06, v);
    if (a < 0.002) discard;
    vec3 c = painted(p * 1.8, vec2(dir.x, dir.y), vec3(0.08, 0.1, 0.2), vec3(0.2, 0.2, 0.36), 1.0);
    c = mix(c, vec3(0.32, 0.2, 0.3), smoothstep(0.3, 1.0, 1.0 - uv.y) * 0.35);
    c += vec3(0.9, 0.55, 0.3) * exp(-abs(v) * 14.0) * 0.18;
    col = c;`);
  scene.add(back);
  const n = 24;
  const mat = glowMat('float r = length(q); float a = exp(-r * r * 6.0); c = vec4(vCol * a, a);', { additive: true });
  const motes = withColors(instanced(new THREE.PlaneGeometry(1, 1), mat, n));
  scene.add(motes);
  return {
    scene,
    pose(T, time) {
      backPose(back, k, T, time);
      const cov = T < 1 ? smooth(T) : 1 - smooth(T - 1);
      for (let i = 0; i < n; i++) {
        const z = -(6 + hh(i, 1) * 8), hw = hwAt(k, -z), hv = hvAt(k, -z);
        const x = (hh(i, 2) * 2 - 1) * hw + Math.sin(time * 0.5 + i) * 0.3, y = (hh(i, 3) * 2 - 1) * hv + ((time * 0.15 + hh(i, 4)) % 1) * 0.8;
        place(motes, i, x, y, z, 0, 0, 0, 0.18 + hh(i, 5) * 0.2);
        const b = cov * (0.25 + 0.25 * Math.sin(time * 2 + i * 3));
        setCol(motes, i, b, b * 0.75, b * 0.45);
      }
      done(motes); if (motes.instanceColor) motes.instanceColor.needsUpdate = true;
    },
  };
}
