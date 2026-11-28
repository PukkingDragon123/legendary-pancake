// Things that cover the screen as one surface: a page turning over, a blueprint unrolling, velvet curtains on a brass
// rail, wooden blinds, flipping wooden tiles, a camera iris, and a clock face painted by its sweeping hand.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cloth, wood } from '../paint3d.ts';
import { backdrop, backPose, brass, cells, clamp01, done, ease, hh, hide, hvAt, hwAt, instanced, type Kit, paint, patch, place, rig, type Set3D, smooth, strokes, tint, TAU } from './kit.ts';

/** a soft shadow strip: black, darkest along its left edge (uv.x = 0), fading to the right */
function strip(k0 = 0.45): THREE.Mesh & { material: THREE.ShaderMaterial } {
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK; varying vec2 vUv; void main(){ float e = 1.0 - vUv.x; float y = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y); gl_FragColor = vec4(0.06, 0.03, 0.0, e * e * uK * y); }',
    uniforms: { uK: { value: k0 } }, transparent: true, depthWrite: false, toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat) as THREE.Mesh & { material: THREE.ShaderMaterial };
  m.frustumCulled = false;
  return m;
}
/** place a strip: its dark edge at (x, y), extending w along angle a, h tall */
function setStrip(m: THREE.Mesh, x: number, y: number, z: number, a: number, w: number, h: number) {
  m.position.set(x + Math.cos(a) * w / 2, y + Math.sin(a) * w / 2, z);
  m.rotation.set(0, 0, a);
  m.scale.set(w, h, 1);
}

// ------------------------------------------------------------------ page

/** the page: laid paper, its front ruled with a margin and a few lines of sepia handwriting, its back plain (left/right halves) */
function pageTex(): THREE.Texture {
  return paint('page', 512, 384, (g) => {
    for (const half of [0, 1]) {
      g.save(); g.translate(half * 256, 0);
      const gr = g.createLinearGradient(0, 0, 256, 384); gr.addColorStop(0, '#f6eedb'); gr.addColorStop(1, '#ead9b8');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 384);
      // fibres, chain lines of laid paper, foxing
      strokes(g, 256, 384, ['#fffaf0', '#d8c4a0'], 260, 14, 0.8, 0, 3 + half, 0.25);
      g.fillStyle = 'rgba(150,120,80,0.06)'; for (let x = 6; x < 256; x += 22) g.fillRect(x, 0, 1, 384);
      for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(170,120,60,0.08)'; g.beginPath(); g.arc(hh(i, 4 + half) * 256, hh(i, 5) * 384, 2 + hh(i, 6) * 7, 0, TAU); g.fill(); }
      if (half === 0) {
        g.fillStyle = 'rgba(80,110,170,0.3)'; for (let y = 52; y < 372; y += 19) g.fillRect(0, y, 256, 1.2);
        g.fillStyle = 'rgba(190,80,70,0.35)'; g.fillRect(36, 0, 1.4, 384);
        // a few lines of Pip's handwriting: joined-up words of humps, loops, tall loops and tails
        g.strokeStyle = 'rgba(70,40,20,0.6)'; g.lineWidth = 1.1; g.lineCap = 'round'; g.lineJoin = 'round';
        let seed = 1;
        for (let l = 0; l < 9; l++) {
          const y = 69 + l * 19, end = l === 8 ? 140 : 236;
          let x = 44 + (l === 0 ? 20 : 0);
          while (x < end) {
            const letters = 2 + Math.floor(hh(seed++, 3) * 6);
            g.beginPath(); g.moveTo(x, y);
            for (let c = 0; c < letters && x < end; c++) {
              const r = hh(seed++, 5), h = 4 + hh(seed, 6) * 1.5;
              if (r < 0.45) { g.quadraticCurveTo(x + 2.2, y - h * 1.5, x + 4.4, y); x += 4.4; }
              else if (r < 0.7) { g.bezierCurveTo(x + 4, y - h, x + 0.5, y - h * 1.2, x + 1.5, y); g.quadraticCurveTo(x + 3, y + 0.5, x + 4.5, y); x += 4.5; }
              else if (r < 0.88) { g.bezierCurveTo(x + 4, y - h * 2.6, x + 0.5, y - h * 2.8, x + 1.8, y); g.quadraticCurveTo(x + 3, y + 0.5, x + 4.2, y); x += 4.2; }
              else { g.bezierCurveTo(x + 3, y + h * 2, x - 1, y + h * 2, x + 2, y); g.quadraticCurveTo(x + 3.5, y - h * 0.8, x + 4.5, y); x += 4.5; }
            }
            g.stroke();
            x += 5 + hh(seed++, 7) * 4;
          }
        }
      } else {
        g.fillStyle = 'rgba(80,110,170,0.07)'; for (let y = 52; y < 372; y += 19) g.fillRect(0, y, 256, 1.2);
      }
      // a soft deckle darkening at the edges
      const v = g.createRadialGradient(128, 192, 120, 128, 192, 260); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(120,80,30,0.25)');
      g.fillStyle = v; g.fillRect(0, 0, 256, 384);
      g.restore();
    }
  });
}

export function page(k: Kit): Set3D {
  const scene = new THREE.Scene();
  rig(scene, k, { keyI: 2.2, fill: 1.0, sky: 0xc8c8d8 });
  const D = 10;
  const u = { uXc: { value: 0 }, uR: { value: 0.5 }, uDir: { value: new THREE.Vector2(1, 0) }, uSize: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2() }, uFlip: { value: 0 } };
  const mat = new THREE.MeshLambertMaterial({ map: pageTex(), side: THREE.DoubleSide });
  patch(mat, 'pagecurl', (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uXc; uniform float uR; uniform vec2 uDir; uniform vec2 uSize; uniform vec2 uOff;
void curl(vec3 pos, out vec3 P, out vec3 N){
  vec2 q = pos.xy * uSize + uOff; float d = dot(q, uDir) - uXc; P = vec3(q, 0.0); N = vec3(0.0, 0.0, 1.0);
  if (d > 0.0) { float th = d / uR; vec2 b = q - uDir * d;
    if (th < PI) { P.xy = b + uDir * (uR * sin(th)); P.z = uR * (1.0 - cos(th)); N = vec3(-uDir * sin(th), cos(th)); }
    else { P.xy = b - uDir * (d - PI * uR); P.z = 2.0 * uR; N = vec3(0.0, 0.0, -1.0); } }
}`)
      .replace('#include <beginnormal_vertex>', 'vec3 cP, cN; curl(position, cP, cN); vec3 objectNormal = cN;')
      .replace('#include <begin_vertex>', 'vec3 transformed = cP;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlip;')
      .replace('#include <map_fragment>', `bool fr = gl_FrontFacing;
  float ux = fr ? vMapUv.x : 1.0 - vMapUv.x; if (uFlip > 0.5) ux = 1.0 - ux;
  vec4 sampledDiffuseColor = texture2D(map, vec2(fr ? ux * 0.5 : 0.5 + ux * 0.5, vMapUv.y)); diffuseColor *= sampledDiffuseColor;`);
  });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 56, 10), mat);
  sheet.frustumCulled = false;
  const g = new THREE.Group(); g.add(sheet); scene.add(g);
  const edgeSh = strip(0.5), lineSh = strip(0.4);
  g.add(edgeSh, lineSh);
  return {
    scene,
    pose(T) {
      const hw = hwAt(k, D), hv = hvAt(k, D), R = Math.min(hw, hv) * 0.22, X = hw + 0.28;
      // One motion played both ways: a page lying over the screen peeled away from the right edge, its curl rolling
      // leftwards and the turned part lying over itself, until it is gone off the left (uncovering). Covering plays
      // it backwards and mirrored, so the page rolls in from the right, curl first, and lays itself down flat.
      const cover = T < 1, e = cover ? 1 - smooth(T) : smooth(T - 1);
      const mir = (k.run.rev ? -1 : 1) * (cover ? -1 : 1);
      g.scale.set(mir, 1, 1); g.position.z = -D;
      u.uFlip.value = cover ? 1 : 0; // the mirrored page shows its texture the right way round
      u.uR.value = R; u.uSize.value.set(X * 2, hv * 3); u.uOff.value.set(0, 0);
      const a = 0.3 * Math.sin(e * Math.PI), x0 = hw + 0.08, xe = -hw - R * 1.3;
      u.uDir.value.set(Math.cos(a), Math.sin(a));
      const xs = x0 + (xe - x0) * e;
      u.uXc.value = xs * Math.cos(a); // the curl line through (xs, 0), across uDir
      const fx = 2 * xs - X + Math.PI * R; // where the turned part's free edge has got to
      const on = e > 0.001 && e < 0.999;
      edgeSh.visible = lineSh.visible = on;
      setStrip(edgeSh, fx, 0, 0.012, Math.PI - a, R * 1.2 + 0.2, hv * 3); edgeSh.material.uniforms.uK.value = 0.35 * Math.min(1, e * 6);
      setStrip(lineSh, xs + R * 0.15, 0, -0.01, a, R * 2.4 + 0.3, hv * 3); lineSh.material.uniforms.uK.value = 0.5 * Math.min(1, e * 6) * (1 - e * 0.4);
    },
  };
}

// ------------------------------------------------------------------ blueprint

function blueprintTex(): THREE.Texture {
  return paint('blueprint', 512, 768, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#1f4f8f'); gr.addColorStop(0.5, '#1a4682'); gr.addColorStop(1, '#173d74');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // the cyanotype's mottle
    strokes(g, W, H, ['#2a62a8', '#123466', '#2e5a96'], 220, 70, 16, 0.4, 7, 0.12);
    g.strokeStyle = 'rgba(220,235,250,0.13)'; g.lineWidth = 1;
    for (let x = 0; x <= W; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = 'rgba(220,235,250,0.25)'; for (let x = 0; x <= W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // the tree house: a trunk in plan, rooms off it, a stair, dimension lines
    g.strokeStyle = 'rgba(240,248,255,0.85)'; g.lineWidth = 2.4; g.lineCap = 'round';
    const cx = 256, cy = 330;
    g.beginPath(); g.arc(cx, cy, 120, 0, TAU); g.stroke();
    g.lineWidth = 1.4; g.beginPath(); g.arc(cx, cy, 104, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(cx - 104, cy); g.lineTo(cx + 104, cy); g.moveTo(cx, cy - 104); g.lineTo(cx, cy - 20); g.stroke();
    g.beginPath(); g.arc(cx - 30, cy, 30, Math.PI, Math.PI * 1.5); g.stroke(); // a door swing
    for (let i = 0; i < 9; i++) { const a = 0.3 + i * 0.16; g.beginPath(); g.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40); g.lineTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100); g.stroke(); } // the stair
    g.lineWidth = 2; g.strokeRect(cx - 200, cy - 230, 140, 90); g.strokeRect(cx + 70, cy - 220, 120, 80);
    g.beginPath(); g.moveTo(cx - 130, cy - 140); g.lineTo(cx - 80, cy - 100); g.moveTo(cx + 130, cy - 140); g.lineTo(cx + 80, cy - 100); g.stroke();
    g.lineWidth = 1; g.setLineDash([6, 5]); g.beginPath(); g.arc(cx, cy, 160, 0, TAU); g.stroke(); g.setLineDash([]);
    const dim = (x1: number, y1: number, x2: number, y2: number) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); for (const [x, y] of [[x1, y1], [x2, y2]]) { g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5); g.stroke(); } };
    dim(cx - 120, cy + 190, cx + 120, cy + 190); dim(cx + 190, cy - 120, cx + 190, cy + 120);
    g.fillStyle = 'rgba(240,248,255,0.8)'; g.font = 'italic 15px Fraunces, Georgia, serif'; g.textAlign = 'center';
    g.fillText('8 ft', cx, cy + 184); g.fillText('the old oak, first floor', cx, cy - 250);
    // a compass rose and the title block
    g.save(); g.translate(80, 640); g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(0, -46); g.lineTo(8, 0); g.lineTo(0, 46); g.lineTo(-8, 0); g.closePath(); g.stroke(); g.fillText('N', 0, -52); g.restore();
    g.lineWidth = 2; g.strokeRect(300, 620, 190, 120); g.beginPath(); g.moveTo(300, 660); g.lineTo(490, 660); g.moveTo(300, 700); g.lineTo(490, 700); g.stroke();
    g.font = 'bold 17px Fraunces, Georgia, serif'; g.fillText('HOOT HOLLOW', 395, 646); g.font = '13px Figtree, sans-serif'; g.fillText('tree house  -  sheet 1 of 3', 395, 685); g.fillText('drawn by Pip', 395, 724);
    // the edge of the sheet: a pale border
    g.strokeStyle = 'rgba(230,240,250,0.6)'; g.lineWidth = 3; g.strokeRect(14, 14, W - 28, H - 28);
  });
}
function rollTex(): THREE.Texture {
  // the back of the paper wound on the roll: pale cyan with the drawing showing through faintly, stripes of the turns
  return paint('roll', 256, 64, (g, W, H) => {
    g.fillStyle = '#8fb2d8'; g.fillRect(0, 0, W, H);
    strokes(g, W, H, ['#a8c8e8', '#6a90bc'], 80, 40, 3, 0, 5, 0.4);
    for (let x = 0; x < W; x += 9 + (x % 5)) { g.fillStyle = 'rgba(30,60,110,0.18)'; g.fillRect(x, 0, 1.5, H); }
  }, { repeat: true });
}
function spiralTex(): THREE.Texture {
  return paint('rollend', 128, 128, (g) => {
    g.fillStyle = '#7aa2cc'; g.beginPath(); g.arc(64, 64, 63, 0, TAU); g.fill();
    g.strokeStyle = '#1c3e70'; g.lineWidth = 2;
    g.beginPath(); for (let a = 0; a < TAU * 7; a += 0.1) { const r = 8 + a * 1.25; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.stroke();
    g.fillStyle = '#2a2018'; g.beginPath(); g.arc(64, 64, 7, 0, TAU); g.fill();
  });
}

export function blueprint(k: Kit): Set3D {
  const scene = new THREE.Scene();
  rig(scene, k, { keyI: 2.0, fill: 1.1, sky: 0xd0dcf0 });
  const D = 10;
  const tex = blueprintTex();
  const sheetM = new THREE.MeshLambertMaterial({ map: tex });
  // the sheet's uv is cropped from the top so only the unrolled part shows (no stretching)
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sheetM);
  sheet.geometry.translate(0, -0.5, 0); // anchored at its top edge
  sheet.frustumCulled = false;
  const rt = rollTex();
  const rollM = new THREE.MeshLambertMaterial({ map: rt });
  const endM = new THREE.MeshLambertMaterial({ map: spiralTex() });
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28, 1), [rollM, endM, endM]);
  roll.rotation.z = Math.PI / 2;
  const rollG = new THREE.Group(); rollG.add(roll);
  const sh = strip(0.55);
  scene.add(sheet, rollG, sh);
  const uvAttr = sheet.geometry.attributes.uv as THREE.BufferAttribute, uv0 = Float32Array.from(uvAttr.array as Float32Array);
  return {
    scene,
    pose(T) {
      const hw = hwAt(k, D), hv = hvAt(k, D), top = hv + 0.05, W = hw * 2.06, H = hv * 2.1;
      const R = Math.min(hw, hv) * 0.13;
      // how much of the sheet is down: 0..1 (rolls down covering, back up uncovering)
      const f = T < 1 ? ease(T) : 1 - ease(T - 1);
      const len = f * (H + R * 3);
      const yc = top - len;
      const shown = Math.min(H, len);
      sheet.position.set(0, top, -D);
      sheet.scale.set(W, Math.max(0.001, shown), 1);
      sheet.visible = shown > 0.002;
      // crop the uvs: the top `shown / H` of the drawing
      const fr = shown / H, a = uvAttr.array as Float32Array;
      for (let i = 0; i < uv0.length; i += 2) { a[i] = uv0[i]; a[i + 1] = 1 - (1 - uv0[i + 1]) * fr; }
      uvAttr.needsUpdate = true;
      // the roll, resting on the screen at the bottom of the sheet, turning as it goes; it shrinks a little as it unwinds
      const r = R * (1.1 - f * 0.25);
      rollG.position.set(0, yc - r * 0.15, -D + r);
      roll.scale.set(r, W * 1.02, r);
      roll.rotation.x = -len / r;
      rt.offset.x = 0;
      rollG.visible = yc > -hv - r * 2.2 && f > 0.001;
      setStrip(sh, 0, yc - r * 0.9, 0.005, -Math.PI / 2, r * 2.4, W * 1.05);
      sh.rotation.z = -Math.PI / 2; sh.visible = rollG.visible; sh.material.uniforms.uK.value = 0.55;
    },
  };
}

// ------------------------------------------------------------------ curtain

export function curtain(k: Kit): Set3D {
  const scene = new THREE.Scene();
  rig(scene, k, { key: 0xffd8a8, keyI: 2.8, fill: 0.55, rimI: 1.8 });
  const D = 9;
  const vel = cloth('#74182c', 'velvet', 6);
  vel.map.repeat.set(2, 3);
  const mk = (side: number) => {
    const u = { uX0: { value: 0 }, uW: { value: 1 }, uA: { value: 0.2 }, uNF: { value: 5.5 }, uLag: { value: 0 }, uTop: { value: 1 }, uH: { value: 2 }, uSide: { value: side }, uPh: { value: side > 0 ? 0 : 1.3 } };
    const mat = new THREE.MeshLambertMaterial({ map: vel.map });
    patch(mat, 'velvet', (s) => {
      Object.assign(s.uniforms, u);
      s.vertexShader = s.vertexShader
        .replace('#include <common>', `#include <common>
uniform float uX0; uniform float uW; uniform float uA; uniform float uNF; uniform float uLag; uniform float uTop; uniform float uH; uniform float uSide; uniform float uPh;
varying float vFold;
void drape(vec3 pos, out vec3 P, out vec3 N){
  float u = uSide > 0.0 ? pos.x + 0.5 : 0.5 - pos.x, v = 0.5 - pos.y;
  float ph = u * uNF * 6.2832 + uPh + 0.9 * sin(u * 9.1 + uPh * 3.0) + v * 0.5;
  float A = uA * (0.75 + 0.5 * v) * (0.6 + 0.4 * smoothstep(0.0, 0.08, u));
  float x = uX0 + uSide * (u * uW + uLag * v * v * u);
  P = vec3(x, uTop - v * uH, A * sin(ph));
  float dzdu = A * (uNF * 6.2832 + 0.9 * 9.1 * cos(u * 9.1 + uPh * 3.0)) * cos(ph);
  N = normalize(vec3(-uSide * dzdu / max(0.01, uW), 0.12 * cos(ph), 1.0));
  vFold = sin(ph);
}`)
        .replace('#include <beginnormal_vertex>', 'vec3 cP, cN; drape(position, cP, cN); vec3 objectNormal = cN;')
        .replace('#include <begin_vertex>', 'vec3 transformed = cP;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFold;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= 0.5 + 0.5 * smoothstep(-1.0, 0.9, vFold);')
        .replace('#include <opaque_fragment>', `{ float g = 1.0 - abs(normal.z); outgoingLight += vec3(0.75, 0.3, 0.36) * pow(g, 2.5) * 0.32 + diffuseColor.rgb * pow(g, 4.0) * 0.5; }
#include <opaque_fragment>`);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 64, 12), mat);
    m.frustumCulled = false;
    return { m, u };
  };
  const L = mk(1), Rt = mk(-1);
  scene.add(L.m, Rt.m);
  const rail = new THREE.Group();
  const br = brass(k, 0.28);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14), br); bar.rotation.z = Math.PI / 2;
  const fin = new THREE.SphereGeometry(1, 16, 12);
  const f1 = new THREE.Mesh(fin, br), f2 = new THREE.Mesh(fin, br);
  rail.add(bar, f1, f2);
  const nR = 9;
  const rings = instanced(new THREE.TorusGeometry(1, 0.22, 6, 16), br, nR * 2);
  scene.add(rail, rings);
  const shL = strip(0.5), shR = strip(0.5);
  scene.add(shL, shR);
  return {
    scene,
    pose(T) {
      const hw = hwAt(k, D), hv = hvAt(k, D);
      const cov = (t: number) => (t < 1 ? ease(t) : 1 - ease(t - 1));
      const c = cov(T), vel0 = (cov(T + 0.01) - cov(T - 0.01)) / 0.02;
      // the rail drops in first and lifts away last
      const railIn = T < 1 ? smooth(T / 0.25) : 1 - smooth((T - 1.75) / 0.25);
      const railY = hv - 0.26 + (1 - railIn) * 0.9, rr = Math.min(hw, hv) * 0.016 + 0.03;
      rail.position.set(0, railY, -D + 0.35);
      bar.scale.set(rr, hw * 2.4, rr);
      f1.position.set(-hw * 1.2, 0, 0); f2.position.set(hw * 1.2, 0, 0); f1.scale.setScalar(rr * 2.2); f2.scale.setScalar(rr * 2.2);
      const edge = hw + 0.3, full = edge + 0.18;
      const stack = Math.min(hw, hv) * 0.2;
      const w = stack + (full - stack) * c;
      const A0 = full / 5.5;
      const amp = Math.sqrt(Math.max(0, A0 * A0 * 1.5 - (w / 5.5) * (w / 5.5))) * 0.55 + 0.07;
      for (const [P, side, z] of [[L, 1, 0.02], [Rt, -1, 0]] as const) {
        P.u.uX0.value = -side * edge; P.u.uW.value = w; P.u.uA.value = amp; P.u.uLag.value = -vel0 * 0.18 * side * side;
        P.u.uTop.value = railY + 0.25; P.u.uH.value = railY + 0.25 + hv + 0.4;
        P.m.position.set(0, 0, -D + z);
      }
      for (let i = 0; i < nR * 2; i++) {
        const side = i < nR ? 1 : -1, j = i % nR, uu = (j + 0.2) / nR;
        place(rings, i, -side * edge + side * uu * w, railY, -D + 0.35, 0, Math.PI / 2, 0, rr * 2.6);
      }
      done(rings);
      rail.visible = rings.visible = railIn > 0.001;
      // the leading edges shadow the screen beyond them
      const lx = -edge + w, k0 = 0.32 * Math.min(1, c * 5) * (c < 0.98 ? 1 : 0);
      setStrip(shL, lx - 0.1, 0, -D - 0.25, 0, 1.4, hv * 2.4); shL.material.uniforms.uK.value = k0;
      setStrip(shR, -lx + 0.1, 0, -D - 0.25, Math.PI, 1.4, hv * 2.4); shR.material.uniforms.uK.value = k0;
    },
  };
}

// ------------------------------------------------------------------ blinds

function slatTex(): THREE.Texture {
  return paint('slat', 512, 32, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#c89058'); gr.addColorStop(0.5, '#b07a42'); gr.addColorStop(1, '#8a5a2c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    strokes(g, W, H, ['#7a4a22', '#d8a468', '#6a3e1a', '#c08850'], 160, 90, 1.4, 0, 11, 0.5);
    for (let i = 0; i < 4; i++) { const x = hh(i, 2) * W; g.strokeStyle = 'rgba(80,40,14,0.4)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, H * (0.3 + hh(i, 3) * 0.4), 9, 3, 0, 0, TAU); g.stroke(); }
  });
}

export function blinds(k: Kit): Set3D {
  const scene = new THREE.Scene();
  rig(scene, k, { keyI: 2.6, fill: 0.7 });
  const D = 10, N = 22;
  const geo = new THREE.BoxGeometry(1, 1, 0.06, 1, 6, 1);
  { const p = geo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) + 0.07 * (1 - 4 * y * y)); } geo.computeVertexNormals(); }
  const mat = new THREE.MeshLambertMaterial({ map: slatTex() });
  const slats = instanced(geo, mat, N);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: slatTex(), color: 0xd8b088 }));
  const cordM = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });
  const cords = instanced(new THREE.CylinderGeometry(1, 1, 1, 5), cordM, 2);
  // shadows of the slats on the screen behind them (light from the upper left)
  const shM = new THREE.MeshBasicMaterial({ color: 0x140a02, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false });
  const shadows = instanced(new THREE.PlaneGeometry(1, 1), shM, N);
  shadows.renderOrder = -50;
  scene.add(slats, head, cords, shadows);
  return {
    scene,
    pose(T) {
      const hw = hwAt(k, D), hv = hvAt(k, D);
      const n = Math.min(N, Math.max(8, Math.round((k.cam.aspect < 1 ? 15 : 10)))), sh = (hv * 2 + 0.2) / n;
      const top = hv + 0.1, rev = k.run.rev;
      let low = top;
      for (let i = 0; i < N; i++) {
        if (i >= n) { hide(slats, i); hide(shadows, i); continue; }
        const order = rev ? n - 1 - i : i, y0 = top - (i + 0.5) * sh;
        let drop: number, tilt: number;
        if (T < 1) { const t = clamp01(T * 1.6 - (order / n) * 0.6); drop = smooth(t * 1.6); tilt = smooth((t - 0.3) / 0.7); }
        else { const t = clamp01((T - 1) * 1.6 - ((n - 1 - order) / n) * 0.6); tilt = 1 - smooth(t / 0.6); drop = 1 - smooth((t - 0.35) / 0.65); }
        if (drop <= 0.001) { hide(slats, i); hide(shadows, i); continue; }
        // falls into place from the head rail, open (edge on), then tilts shut
        const y = top - (top - y0) * drop, ang = (Math.PI / 2 - 0.12) * (1 - tilt) + 0.12;
        place(slats, i, 0, y, -D, -ang, 0, 0, hw * 2.08, sh * 1.12, 1);
        place(shadows, i, 0.25, y - sh * 0.35 - 0.15, -D - 0.4, 0, 0, 0, hw * 2.08, sh * 1.1 * Math.cos(ang) * 0.9 + 0.02);
        low = Math.min(low, y - sh * 0.5);
      }
      done(slats, shadows);
      const vis = low < top - 0.01;
      head.visible = cords.visible = vis;
      head.position.set(0, top + 0.05, -D + 0.1); head.scale.set(hw * 2.1, sh * 0.8, 0.35);
      for (let c = 0; c < 2; c++) place(cords, c, (c ? 1 : -1) * hw * 0.55, (top + low) / 2, -D + 0.09, 0, 0, 0, 0.018, Math.max(0.01, top - low), 0.018);
      done(cords);
    },
  };
}

// ------------------------------------------------------------------ mosaic

function tileTex(): THREE.Texture {
  // a carved wooden tile: grain, a sunk border and a little carved motif in the middle (tinted per tile)
  return paint('tile', 128, 128, (g) => {
    g.fillStyle = '#e8dcc8'; g.fillRect(0, 0, 128, 128);
    strokes(g, 128, 128, ['#c8b090', '#fff4e0', '#b09878'], 70, 60, 2, 0.05, 4, 0.5);
    g.strokeStyle = 'rgba(70,40,20,0.35)'; g.lineWidth = 4; g.strokeRect(14, 14, 100, 100);
    g.strokeStyle = 'rgba(255,248,230,0.5)'; g.lineWidth = 1.5; g.strokeRect(18, 18, 92, 92);
    g.save(); g.translate(64, 64);
    g.fillStyle = 'rgba(60,34,14,0.38)';
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.ellipse(0, -18, 7, 16, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,240,210,0.55)'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill();
    g.restore();
  });
}

export function mosaic(k: Kit): Set3D {
  const scene = new THREE.Scene();
  rig(scene, k, { keyI: 2.6, fill: 0.75 });
  const D = 10, MAX = 170;
  const mat = new THREE.MeshLambertMaterial({ map: tileTex() });
  const tiles = instanced(new RoundedBoxGeometry(1, 1, 0.22, 2, 0.08), mat, MAX);
  tint(tiles, [0x6a8a42, 0xd8b078, 0xb07a42, 0xe8dcc0, 0x8a5a30, 0x5a7a3a, 0xe0c890], 7, 0.08);
  const back = backdrop(/* glsl */ `
    float w = (uv.x * uCols + (1.0 - uv.y) * uRows) / (uCols + uRows); if (uRev > 0.5) w = 1.0 - w;
    float cov = T < 1.0 ? smoothstep(0.0, 1.0, T) : 1.0 - smoothstep(0.0, 1.0, T - 1.0);
    a = smoothstep(0.75, 0.95, cov * 1.7 - w * 0.7);
    if (a < 0.002) discard;
    col = vec3(0.13, 0.08, 0.05) * (0.8 + fbm3(p * 30.0) * 0.4);`, { uCols: { value: 7 }, uRows: { value: 14 } }, 'uniform float uCols; uniform float uRows;');
  scene.add(back, tiles);
  return {
    scene,
    pose(T, time) {
      const hw = hwAt(k, D), hv = hvAt(k, D);
      const s = Math.min(hw, hv) * 2 / 7, nx = Math.ceil((hw * 2) / s), ny = Math.ceil((hv * 2) / s);
      backPose(back, k, T, time);
      back.material.uniforms.uCols.value = nx; back.material.uniforms.uRows.value = ny;
      const ox = -nx * s / 2 + s / 2, oy = ny * s / 2 - s / 2;
      const cov = T < 1 ? smooth(T) : 1 - smooth(T - 1);
      let i = 0;
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++, i++) {
        if (i >= MAX) break;
        let w = (x + y) / (nx + ny); if (k.run.rev) w = 1 - w;
        const d = clamp01(cov * 1.7 - w * 0.7);
        if (d <= 0) { hide(tiles, i); continue; }
        // flips over about the wave's diagonal, lifting towards you as it turns and settling to full size; leaves the same way
        const e = smooth(d), side = hh(i, 1) > 0.5 ? 1 : -1;
        const ang = (T < 1 ? side : -1) * (1 - e) * (Math.PI / 2);
        const lift = Math.sin(e * Math.PI) * s * 0.6, sc = s * (0.55 + 0.45 * e) * 0.985;
        place(tiles, i, ox + x * s, oy - y * s, -D + lift + 0.11, ang * 0.75, ang * 0.75, 0, sc, sc, s);
      }
      for (; i < MAX; i++) hide(tiles, i);
      done(tiles);
    },
  };
}

// ------------------------------------------------------------------ iris

export function iris(k: Kit): Set3D {
  const scene = new THREE.Scene();
  rig(scene, k, { keyI: 2.4, fill: 0.6, env: 0.5 });
  const D = 10, N = 9;
  // a blade: a long curved leaf of walnut, its inner edge an arc, a brass strip along it
  const L = 0.62, Wd = 0.95, bow = 0.17;
  const sh = new THREE.Shape();
  sh.moveTo(-L, bow); for (let i = 0; i <= 24; i++) { const x = -L + (2 * L * i) / 24; sh.lineTo(x, bow * (x / L) * (x / L)); }
  sh.lineTo(L, Wd); sh.lineTo(-L, Wd); sh.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 1, curveSegments: 4 });
  const band = new THREE.Shape();
  band.moveTo(-L, bow); for (let i = 0; i <= 24; i++) { const x = -L + (2 * L * i) / 24; band.lineTo(x, bow * (x / L) * (x / L)); }
  for (let i = 24; i >= 0; i--) { const x = -L + (2 * L * i) / 24; band.lineTo(x, bow * (x / L) * (x / L) + 0.028); }
  const bandGeo = new THREE.ExtrudeGeometry(band, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 1 });
  const wd = wood('#5e361a', { seed: 4, contrast: 1.1, knots: 0, rings: 7 });
  wd.map.repeat.set(2.5, 2.5); wd.map.center.set(0.5, 0.5); wd.map.rotation = Math.PI / 2; // the grain along each blade
  const bm = new THREE.MeshPhongMaterial({ map: wd.map, shininess: 40, specular: 0x302018 }); // lacquered walnut
  const blades = instanced(bladeGeo, bm, N), bands = instanced(bandGeo, brass(k, 0.25), N);
  const back = backdrop(/* glsl */ `
    // the aperture's own soft shadow on the screen inside it
    vec2 q = vec2((uv.x - uC.x) * uAspect, uv.y - uC.y);
    float r = length(q);
    a = smoothstep(uA - 0.25, uA + 0.02, r) * 0.55 * step(0.001, uA);
    if (a < 0.002) discard;
    col = vec3(0.04, 0.02, 0.0);`, { uA: { value: 1 } }, 'uniform float uA;');
  scene.add(back, blades, bands);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  return {
    scene,
    pose(T, time) {
      const hw = hwAt(k, D), hv = hvAt(k, D);
      const cx = (k.run.cx * 2 - 1) * hw, cy = (1 - k.run.cy * 2) * hv;
      const Rd = Math.hypot(hw + Math.abs(cx), hv + Math.abs(cy)) * 1.08;
      const c = T < 1 ? smooth(T) : 1 - smooth(T - 1);
      const a = Rd * (1 - c) - 0.012 * Rd * c; // the aperture's radius (just past closed when shut)
      backPose(back, k, T, time);
      back.material.uniforms.uA.value = Math.max(0, a / (hv * 2)) * (c > 0.995 ? 0 : 1);
      const sc = Rd, twist = (1 - c) * 0.9;
      for (let i = 0; i < N; i++) {
        const phi = (i / N) * TAU + twist;
        const nx = Math.cos(phi), ny = Math.sin(phi);
        // local x along the tangent, local y outward; the inner edge at distance a
        // each blade tilted a little along its length (one end up, the other down), so they overlap round in a ring
        e.set(0.06, 0.045, phi - Math.PI / 2, 'ZYX'); q.setFromEuler(e);
        v.set(cx + nx * a, cy + ny * a, -D); s.set(sc, sc, 1);
        m4.compose(v, q, s);
        blades.setMatrixAt(i, m4); bands.setMatrixAt(i, m4);
      }
      done(blades, bands);
      blades.visible = bands.visible = c > 0.001;
    },
  };
}

// ------------------------------------------------------------------ clock

/** Roman numerals I..XII in a 4 x 3 atlas, dark enamel with a gilt edge */
function numeralTex(): THREE.Texture {
  const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  return paint('numerals', 512, 384, (g) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const x = (i % 4) * 128 + 64, y = (2 - Math.floor(i / 4)) * 128 + 64;
      g.font = `600 ${R[i].length > 3 ? 46 : 58}px Fraunces, Georgia, serif`;
      g.lineWidth = 6; g.strokeStyle = 'rgba(200,150,60,0.9)'; g.strokeText(R[i], x, y);
      g.fillStyle = '#1c1a30'; g.fillText(R[i], x, y);
    }
  }, { mips: true });
}

export function clock(k: Kit): Set3D {
  const scene = new THREE.Scene();
  rig(scene, k, { keyI: 2.4, fill: 0.85, env: 0.55 });
  const D = 10;
  // the dial: cream enamel with a sunburst guilloche, rings and a minute track, painted round by the hand
  const u = { uSweep: { value: 0 }, uOut: { value: 0 }, uRN: { value: 1 }, uDirA: { value: 1 } };
  const dialM = new THREE.MeshLambertMaterial({ color: 0xf4ead4, transparent: true, depthWrite: false });
  patch(dialM, 'dial', (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vLoc;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position.xy;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLoc; uniform float uSweep; uniform float uOut; uniform float uRN; uniform float uDirA;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  float r = length(vLoc), ang = atan(vLoc.x * uDirA, vLoc.y); if (ang < 0.0) ang += 6.28318;
  float behind = uSweep - ang; // radians since the hand passed (it covers while the hand sweeps; uncovers on the second turn)
  float vis = uOut < 0.5 ? smoothstep(-0.004, 0.012, behind) : 1.0 - smoothstep(-0.004, 0.012, behind);
  if (vis < 0.003) discard;
  diffuseColor.a *= vis;
  float burst = 0.5 + 0.5 * sin(ang * 140.0) * smoothstep(uRN * 0.15, uRN * 0.5, r) * (1.0 - smoothstep(uRN * 0.78, uRN * 0.8, r));
  diffuseColor.rgb *= 0.9 + burst * 0.1;
  float ring = smoothstep(0.012, 0.0, abs(r - uRN * 1.17)) + smoothstep(0.008, 0.0, abs(r - uRN * 1.3)) + smoothstep(0.01, 0.0, abs(r - uRN * 0.8));
  float tick = step(0.82, fract(ang / 6.28318 * 60.0 + 0.09)) * step(uRN * 1.17, r) * step(r, uRN * 1.3);
  float big = step(0.92, fract(ang / 6.28318 * 12.0 + 0.04)) * step(uRN * 1.17, r) * step(r, uRN * 1.38);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.14, 0.12, 0.2), clamp(ring + tick + big, 0.0, 1.0) * 0.85);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.58, 0.28), smoothstep(uRN * 1.5, uRN * 1.52, r) * 0.6);`)
      .replace('#include <opaque_fragment>', `{ float lead = uOut < 0.5 ? exp(-max(0.0, behind) * r * 2.2) : exp(-max(0.0, -behind) * r * 2.2);
  outgoingLight += vec3(1.0, 0.78, 0.42) * lead * 0.55 * smoothstep(0.0, 0.3, r); }
#include <opaque_fragment>`);
  });
  const dial = new THREE.Mesh(new THREE.CircleGeometry(1, 96), dialM);
  dial.frustumCulled = false;
  // twelve numerals, a brass hand (spade, counterweight) with its shadow, a domed brass boss
  const nGeo = new THREE.PlaneGeometry(1, 1); cells(nGeo, 12, (i) => i);
  const nMat = new THREE.MeshLambertMaterial({ map: numeralTex(), transparent: true, depthWrite: false });
  patch(nMat, 'numerals', (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCell;').replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = (vMapUv + vec2(mod(aCell, 4.0), floor(aCell / 4.0))) / vec2(4.0, 3.0);');
  });
  const nums = instanced(nGeo, nMat, 12);
  // the hand: a tapered blade with a spade near its tip and a fine point, and a round counterweight on its tail
  const hs = new THREE.Shape();
  hs.moveTo(-0.03, -0.22); hs.lineTo(-0.022, 0); hs.lineTo(-0.012, 0.55);
  hs.bezierCurveTo(-0.1, 0.55, -0.11, 0.67, -0.035, 0.7); hs.lineTo(-0.008, 0.74); hs.lineTo(-0.004, 1.0); hs.lineTo(0, 1.04);
  hs.lineTo(0.004, 1.0); hs.lineTo(0.008, 0.74); hs.lineTo(0.035, 0.7); hs.bezierCurveTo(0.11, 0.67, 0.1, 0.55, 0.012, 0.55);
  hs.lineTo(0.022, 0); hs.lineTo(0.03, -0.22); hs.closePath();
  const cw = new THREE.Shape(); cw.absarc(0, -0.22, 0.075, 0, TAU, false);
  const ex = { depth: 0.006, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 3, curveSegments: 12 };
  const handGeo = mergeGeometries([new THREE.ExtrudeGeometry(hs, ex), new THREE.ExtrudeGeometry(cw, ex)]);
  const hm = brass(k, 0.32); hm.metalness = 0.75; hm.envMapIntensity = 1.1;
  const hand = new THREE.Mesh(handGeo, hm);
  const shadowM = new THREE.MeshBasicMaterial({ color: 0x1a0c00, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false });
  const hShadow = new THREE.Mesh(handGeo, shadowM), hShadow2 = new THREE.Mesh(handGeo, shadowM);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2), brass(k, 0.25)); boss.rotation.x = Math.PI / 2;
  const g = new THREE.Group();
  g.add(dial, nums, hShadow, hShadow2, hand, boss);
  scene.add(g);
  return {
    scene,
    pose(T) {
      const hw = hwAt(k, D), hv = hvAt(k, D);
      const cx = (k.run.cx * 2 - 1) * hw, cy = (1 - k.run.cy * 2) * hv;
      const Rd = Math.hypot(hw + Math.abs(cx), hv + Math.abs(cy)) * 1.04;
      const RN = Math.min(hw, hv) * 0.7;
      g.position.set(cx, cy, -D);
      const dir = k.run.rev ? -1 : 1;
      const sweep = (T < 1 ? smooth(T) : smooth(T - 1)) * TAU;
      u.uSweep.value = sweep; u.uOut.value = T < 1 ? 0 : 1; u.uRN.value = RN / Rd; u.uDirA.value = dir;
      dial.scale.setScalar(Rd);
      const L = Rd * 1.02, ha = -sweep * dir; // the hand's angle (clockwise from twelve)
      hand.scale.set(L * 0.6, L, L * 0.5); hand.rotation.z = ha; hand.position.z = 0.06;
      hShadow.scale.copy(hand.scale); hShadow.rotation.z = ha; hShadow.position.set(0.1, -0.14, 0.012);
      hShadow2.scale.set(hand.scale.x * 1.6, hand.scale.y * 1.01, hand.scale.z); hShadow2.rotation.z = ha; hShadow2.position.set(0.16, -0.22, 0.008);
      boss.scale.setScalar(RN * 0.07); boss.position.z = 0.08;
      const moving = sweep > 0.001 && sweep < TAU - 0.001;
      hand.visible = hShadow.visible = hShadow2.visible = boss.visible = moving || Math.abs(T - 1) < 0.002;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU, behind = sweep - a;
        const on = T < 1 ? behind > 0 : behind <= 0;
        if (!on) { hide(nums, i); continue; }
        const pop = T < 1 ? Math.min(1, behind * 3) : Math.min(1, -behind * 3 + 0.0001), s = RN * 0.26 * (0.6 + 0.4 * smooth(pop)) * (T < 1 ? 1 : 1);
        place(nums, i, Math.sin(a) * dir * RN, Math.cos(a) * RN, 0.02, 0, 0, -a * dir, s);
      }
      done(nums);
      dial.visible = T < 1 ? sweep > 0.0005 : sweep < TAU - 0.0005;
    },
  };
}
