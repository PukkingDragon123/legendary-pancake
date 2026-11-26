// The loading clock's bake: the real 3D owl cuckoo clock (src/world/stages/cuckoo.ts, bare and plain: no carved
// leaves or acorns, a brass disc pendulum) rendered in soft, realistic lamplight (ACES, an environment for the brass
// and enamel, soft shadows caught on an invisible wall) into a few layers that the boot block in index.html shows
// before any script has loaded:
//   img/boot/clock.webp  the case (door shut, no hands, pendulum or weights) with its shadow on the wall
//   img/boot/door.webp   the door and the owl: shut, ajar, peeking, out, calling, bowing (a strip over the case)
//   img/boot/dial.webp   the dial, the hour hand and the minute hand at three times the density (sharp for the dive)
//   inline               the pendulum, a pine-cone weight, a pull ring and a tile of chain (small WebP data URIs)
// The hands turn at clock speed in CSS from the real time, the pendulum swings, the weights sink with the loading and
// src/onboard/boot.ts plays the door strip for the strike. Units: 1 em = 1/150 m of the clock, which is the office's
// CLOCK_PX (0.003 m) once the office hangs the same model at 0.45 scale (wallclock.ts), so the dive hands over.
//
//   /dev-clockbake.html            bake and show the layers;  window.__bake() -> { html, files } for
//   node src/onboard/tools/bootbake.mjs   (writes public/img/boot/*.webp and the boot block in index.html)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CLOCK_PLAN as P, CuckooStage } from '../world/stages/cuckoo.ts';
import * as K from '../world/stages/cuckookit.ts';

/** em per metre of the clock */
export const EM = 150;
/** px per metre of the case and the parts (a chain period, 0.031 m, is exactly 21 px) and of the dial */
const PPM = 21 / 0.031, PPM_DIAL = PPM * 3;
/** the weights' drop while loading (0 wound .. 1 run down) and the estimated load time */
const F0 = 0.08, F1 = 0.9, LOAD_S = 26;
const QUALITY = 0.86;

type Box = { x: number; y: number; w: number; h: number };

export async function bake(): Promise<{ html: string; files: Record<string, string>; preview: HTMLCanvasElement[] }> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const st = new CuckooStage({ skin: 'owl', species: 'tawny', palette: 'tawny', outfit: {} }, { finish: K.FINISHES[0].id, mute: true, wound: [Date.now(), Date.now()] }, { bare: true, plain: true });
  await st.ready;
  const S = st.scene, parts = st.parts;

  // ---- light: a warm lamp up and to the left, a soft fill, a studio environment for the brass and the enamel
  const pm = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  S.environment = pm.fromScene(room, 0.04).texture;
  (S as unknown as { environmentIntensity: number }).environmentIntensity = 0.4;
  const hemi = new THREE.HemisphereLight(0xfff0dc, 0x4a3022, 0.55);
  const key = new THREE.DirectionalLight(0xffe0b8, 2.3);
  key.position.set(-1.0, 1.6, 5.2);
  key.target.position.set(0, 0.25, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera;
  sc.left = -1.3; sc.right = 1.3; sc.top = 1.8; sc.bottom = -1.4; sc.near = 1; sc.far = 12;
  key.shadow.bias = -0.0002; key.shadow.normalBias = 0.01; key.shadow.radius = 6;
  const fill = new THREE.PointLight(0xffc890, 0.9, 6, 1.6);
  fill.position.set(0.9, 0.3, 1.6);
  // the wall only catches shadows: the boot block paints the plain lamplit wall itself
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.36, color: 0x0a0604 }));
  wall.position.z = 0.0008;
  wall.receiveShadow = true;
  S.add(hemi, key, key.target, fill, wall);
  const always = new Set<THREE.Object3D>([hemi, key, key.target, fill, wall]);
  const moving: THREE.Object3D[] = [parts.hour, parts.minute, parts.pend, ...parts.cones, ...parts.rings, parts.links, parts.perch];
  /** show the case (null) or only these moving parts */
  const show = (only: THREE.Object3D[] | null) => {
    for (const c of S.children) c.visible = always.has(c) || (only ? only.includes(c) : !moving.includes(c));
  };
  const owl = st.owl;
  owl.lookAt = new THREE.Vector3(0, 0.95, 4);
  const settle = (n = 40) => { for (let i = 0; i < n; i++) owl.update(1 / 30); };

  // ---- the stage: the case's box, the weights at their lowest, room for shadows
  show(null); st.setDrop(1);
  const caseB = new THREE.Box3();
  S.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && o !== wall && (m.material as THREE.Material).visible !== false && !moving.some((p) => p === o || isIn(o, p))) caseB.expandByObject(o); });
  const loB = new THREE.Box3().setFromObject(parts.cones[0]);
  const half = Math.max(-caseB.min.x, caseB.max.x) + 0.1;
  const X0 = -half, YT = caseB.max.y + 0.03, YB = Math.min(loB.min.y, P.PEND.y - P.PEND.len - 0.16) - 0.1;
  const SW = +((2 * half) * EM).toFixed(2), SH = +((YT - YB) * EM).toFixed(2);
  const em = (m: number) => +(m * EM).toFixed(3);
  const ex = (x: number) => em(x - X0), ey = (y: number) => em(YT - y);

  // ---- rendering a box (stage px at a density) through an orthographic camera, supersampled
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
  cam.position.set(0, 0, 10);
  const SS = 2;
  // each layer is rendered over black and over white and the matte pulled from the difference (alpha that the
  // renderer writes is not to be trusted with tone mapping), then downsampled
  const shot = (px: number, py: number, w: number, h: number, ppm: number) => {
    const W2 = w * SS, H2 = h * SS;
    renderer.setSize(W2, H2, false);
    cam.left = X0 + px / ppm; cam.right = X0 + (px + w) / ppm; cam.top = YT - py / ppm; cam.bottom = YT - (py + h) / ppm;
    cam.updateProjectionMatrix();
    const grab = (bg: number) => {
      renderer.setClearColor(bg, 1);
      renderer.render(S, cam);
      // raw pixels (the game's ink pass keeps a material class in the alpha channel, so the canvas's alpha is not
      // coverage): flipped to top-down
      const gl = renderer.getContext(), raw = new Uint8Array(W2 * H2 * 4), im = new ImageData(W2, H2);
      gl.readPixels(0, 0, W2, H2, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      for (let y = 0; y < H2; y++) im.data.set(raw.subarray((H2 - 1 - y) * W2 * 4, (H2 - y) * W2 * 4), y * W2 * 4);
      return im;
    };
    const B = grab(0x000000), Wh = grab(0xffffff), out = new ImageData(W2, H2);
    for (let i = 0; i < W2 * H2 * 4; i += 4) {
      const a = Math.max(0, Math.min(1, 1 - ((Wh.data[i] - B.data[i]) + (Wh.data[i + 1] - B.data[i + 1]) + (Wh.data[i + 2] - B.data[i + 2])) / 765));
      out.data[i + 3] = Math.round(a * 255);
      if (a > 0.002) for (let k = 0; k < 3; k++) out.data[i + k] = Math.min(255, Math.round(B.data[i + k] / a));
    }
    const big = document.createElement('canvas');
    big.width = W2; big.height = H2;
    big.getContext('2d')!.putImageData(out, 0, 0);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(big, 0, 0, w, h);
    return c;
  };
  /** a world box (metres) -> whole stage px at a density */
  const pxBox = (x0: number, y1: number, x1: number, y0: number, ppm: number) => {
    const px = Math.floor((x0 - X0) * ppm), py = Math.floor((YT - y1) * ppm);
    return { px, py, w: Math.ceil((x1 - X0) * ppm) - px, h: Math.ceil((YT - y0) * ppm) - py };
  };
  const emBox = (b: { px: number; py: number; w: number; h: number }, ppm: number): Box => ({ x: em(b.px / ppm), y: em(b.py / ppm), w: em(b.w / ppm), h: em(b.h / ppm) });
  const webp = (c: HTMLCanvasElement) => c.toDataURL('image/webp', QUALITY);

  // ---- the case (door shut) and the door strip
  const CB = pxBox(X0, YT, -X0, Math.max(YB, -0.42), PPM);
  const pose = (door: number, out: number, bow: number, mood: 'calm' | 'happy' | 'joy') => {
    show(null);
    st.poseDoor(door, out, bow);
    owl.setMood(mood, 5);
    settle();
    return shot(CB.px, CB.py, CB.w, CB.h, PPM);
  };
  const closed = pose(0, 0, 0, 'calm');
  const states = [pose(0.42, 0, 0, 'calm'), pose(1, 0.3, 0, 'calm'), pose(1, 1, 0, 'happy'), pose(1, 1, 0.12, 'joy'), pose(1, 1, 0.36, 'joy')];
  // the box round everything the states change
  const base = closed.getContext('2d')!.getImageData(0, 0, CB.w, CB.h).data;
  let bx0 = CB.w, by0 = CB.h, bx1 = 0, by1 = 0;
  for (const s of states) {
    const d = s.getContext('2d')!.getImageData(0, 0, CB.w, CB.h).data;
    for (let y = 0; y < CB.h; y++) for (let x = 0; x < CB.w; x++) {
      const i = (y * CB.w + x) * 4;
      if (Math.abs(d[i] - base[i]) + Math.abs(d[i + 1] - base[i + 1]) + Math.abs(d[i + 2] - base[i + 2]) + Math.abs(d[i + 3] - base[i + 3]) > 12) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x + 1); by1 = Math.max(by1, y + 1); }
    }
  }
  bx0 = Math.max(0, bx0 - 3); by0 = Math.max(0, by0 - 3); bx1 = Math.min(CB.w, bx1 + 3); by1 = Math.min(CB.h, by1 + 3);
  const DW = bx1 - bx0, DH = by1 - by0;
  const strip = document.createElement('canvas');
  strip.width = DW * 6; strip.height = DH;
  [closed, ...states].forEach((s, i) => strip.getContext('2d')!.drawImage(s, bx0, by0, DW, DH, i * DW, 0, DW, DH));
  const DB = emBox({ px: CB.px + bx0, py: CB.py + by0, w: DW, h: DH }, PPM);
  st.poseDoor(0, 0, 0);

  // ---- the dial and the hands, three times as fine
  const R = P.DIAL.r + 0.045;
  const DLB = pxBox(-R, P.DIAL.y + R, R, P.DIAL.y - R, PPM_DIAL);
  show(null);
  const dial = shot(DLB.px, DLB.py, DLB.w, DLB.h, PPM_DIAL);
  parts.hour.rotation.z = 0; parts.minute.rotation.z = 0;
  show([parts.hour]); wall.visible = false;
  const hourC = shot(DLB.px, DLB.py, DLB.w, DLB.h, PPM_DIAL);
  show([parts.minute]); wall.visible = false;
  const minC = shot(DLB.px, DLB.py, DLB.w, DLB.h, PPM_DIAL);
  const dialAtlas = document.createElement('canvas');
  dialAtlas.width = DLB.w * 3; dialAtlas.height = DLB.h;
  [dial, hourC, minC].forEach((c, i) => dialAtlas.getContext('2d')!.drawImage(c, i * DLB.w, 0));
  const DLE = emBox(DLB, PPM_DIAL);
  // the exact centre of the dial in em, and the boss (the brass nut over the hands)
  const dcx = ex(0), dcy = ey(P.DIAL.y);

  // ---- the pendulum at rest, its shadow on the wall
  show([parts.pend]);
  parts.pend.rotation.z = 0;
  const pb = new THREE.Box3().setFromObject(parts.pend);
  const PB = pxBox(pb.min.x - 0.02, P.PEND.y + 0.01, pb.max.x + 0.06, pb.min.y - 0.08, PPM);
  const pendC = shot(PB.px, PB.py, PB.w, PB.h, PPM);
  const PBE = emBox(PB, PPM);

  // ---- a weight, a ring, a tile of chain (their shadows on the wall with them)
  st.setDrop(0.5);
  const cone = parts.cones[0], ring = parts.rings[0];
  show([cone]);
  const cb = new THREE.Box3().setFromObject(cone);
  const CNB = pxBox(cb.min.x - 0.01, cb.max.y + 0.005, cb.max.x + 0.07, cb.min.y - 0.09, PPM);
  const coneC = shot(CNB.px, CNB.py, CNB.w, CNB.h, PPM);
  const CNE = emBox(CNB, PPM);
  const coneO = { x: ex(cone.position.x), y: ey(cone.position.y) };
  show([ring]);
  const rb = new THREE.Box3().setFromObject(ring);
  const RGB = pxBox(rb.min.x - 0.01, rb.max.y + 0.005, rb.max.x + 0.05, rb.min.y - 0.06, PPM);
  const ringC = shot(RGB.px, RGB.py, RGB.w, RGB.h, PPM);
  const RGE = emBox(RGB, PPM);
  const ringO = { x: ex(ring.position.x), y: ey(ring.position.y) };
  st.setDrop(1);
  show([parts.links]);
  const wx = P.WEIGHTS[0].x;
  const CHB = pxBox(wx - 0.012, P.CHAIN.top - 0.12, wx + 0.05, P.CHAIN.top - 0.2, PPM);
  CHB.h = 21; // one period: two links
  const chainC = shot(CHB.px, CHB.py, CHB.w, CHB.h, PPM);
  const CHE = { x: em(CHB.px / PPM) - ex(wx), w: em(CHB.w / PPM), h: em(21 / PPM) };

  // ---- the layout (em, stage top-left)
  const wy = (f: number) => P.CHAIN.wTop + (P.CHAIN.wBot - P.CHAIN.wTop) * f;
  const ry = (f: number) => P.CHAIN.wBot + (P.CHAIN.wTop - P.CHAIN.wBot) * f - 0.036;
  const TRAVEL = em((P.CHAIN.wTop - P.CHAIN.wBot) * (F1 - F0));
  const CHAIN_L = 98; // em of chain above each end (reaches behind the plinth at the bottom, stays behind the case at the top)
  const files = { 'clock.webp': webp(closed), 'door.webp': webp(strip), 'dial.webp': webp(dialAtlas) };
  const CBE = emBox(CB, PPM);
  const pendURL = webp(pendC), coneURL = webp(coneC), ringURL = webp(ringC), chainURL = webp(chainC);
  const box = (b: Box) => `left:${b.x}em;top:${b.y}em;width:${b.w}em;height:${b.h}em`;
  const r2 = (v: number) => +v.toFixed(2);
  // a weight's element: the cone sprite where the cone hangs at F0; the chain rises from 0.012 m over its origin
  const wEl = (i: number) => { const x = ex(P.WEIGHTS[i].x), y = ey(wy(F0)); return { x: r2(x + (CNE.x - coneO.x)), y: r2(y + (CNE.y - coneO.y)), chainLeft: r2(-(CNE.x - coneO.x) + CHE.x), chainBottom: r2(CNE.h - (coneO.y - CNE.y) + em(0.012)) }; };
  const rEl = (i: number) => { const x = ex(P.WEIGHTS[i].ring), y = ey(ry(F0)); return { x: r2(x + (RGE.x - ringO.x)), y: r2(y + (RGE.y - ringO.y)), chainLeft: r2(-(RGE.x - ringO.x) + CHE.x), chainBottom: r2(RGE.h - (ringO.y - RGE.y) + em(0.02)) }; };
  const prog = (t: number) => { const a = Math.min(1, t / 7); return 0.9 * (1 - (1 - a) ** 2.4) + 0.07 * Math.max(0, (t - 7) / (LOAD_S - 7)); };
  const sink = () => {
    const out: string[] = [];
    for (let i = 0; i <= 16; i++) { const t = (i / 16) ** 1.6 * LOAD_S; out.push(`${((t / LOAD_S) * 100).toFixed(1)}%{transform:translateY(calc(var(--d)*${(prog(t) * TRAVEL).toFixed(1)}em))}`); }
    return `@keyframes bt-wt{${out.join('')}}`;
  };
  const dA = `url(img/boot/dial.webp) 0 0/${r2(DLE.w * 3)}em ${r2(DLE.h)}em no-repeat`;
  const bossR = em(0.016);
  const CSS = `
#boot{--k:min(calc(88vw / ${SW}),calc(84vh / ${SH}));font-size:var(--k);position:fixed;inset:0;z-index:99;overflow:hidden;display:flex;align-items:center;justify-content:center;
background:radial-gradient(ellipse 120% 100% at 50% 46%,rgba(2,8,5,0) 38%,rgba(2,8,5,.42) 72%,rgba(2,8,5,.86) 100%),#143a2a;
user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:opacity .7s}
#boot.gone:not(.hold):not(.js){opacity:0;pointer-events:none}
#boot *{position:absolute;display:block;-webkit-user-drag:none;pointer-events:none}
#boot .bt-pool{width:${r2(SW * 1.5)}em;height:${r2(SH * 1.05)}em;left:50%;top:50%;margin:-${r2(SH * 0.56)}em 0 0 -${r2(SW * 0.75)}em;background:radial-gradient(closest-side,rgba(255,190,110,.34),rgba(255,180,96,.2) 40%,rgba(255,170,90,.07) 72%,rgba(255,170,90,0));animation:bt-flick 4s ease-in-out infinite}
#boot .bt-mote{width:1.6em;height:1.6em;border-radius:50%;background:radial-gradient(#fff2c8,rgba(255,216,144,0) 70%);opacity:0;animation:bt-mote 9s ease-in-out infinite}
#boot .bt-stage{position:relative;width:${SW}em;height:${SH}em;flex:none;transform-origin:${r2((dcx / SW) * 100)}% ${r2((dcy / SH) * 100)}%;opacity:0;transition:opacity .4s}
#boot.lit .bt-stage{opacity:1}
#boot .bt-case{${box(CBE)}}
#boot .bt-door{${box(DB)};background:url(img/boot/door.webp) 0 0/${r2(DB.w * 6)}em ${r2(DB.h)}em no-repeat}
#boot .bt-dial{${box(DLE)};border-radius:50%;object-fit:cover;object-position:0 0}
#boot .bt-h{${box(DLE)};animation:bt-turn 3600s linear calc(var(--tm,0)*-1s) infinite;filter:drop-shadow(.5em .9em .5em rgba(20,10,4,.45))}
#boot .bt-hh{background:${dA.replace(' 0 0/', ` -${r2(DLE.w)}em 0/`)};animation-duration:43200s;animation-delay:calc(var(--th,0)*-1s)}
#boot .bt-mh{background:${dA.replace(' 0 0/', ` -${r2(DLE.w * 2)}em 0/`)}}
#boot .bt-boss{left:${r2(dcx - bossR)}em;top:${r2(dcy - bossR)}em;width:${r2(bossR * 2)}em;height:${r2(bossR * 2)}em;border-radius:50%;background:${dA.replace(' 0 0/', ` -${r2(dcx - bossR - DLE.x)}em -${r2(dcy - bossR - DLE.y)}em/`)}}
#boot .bt-pend{${box(PBE)};background:url(${pendURL}) 0 0/100% 100%;transform-origin:${r2(dcx - PBE.x)}em ${r2(ey(P.PEND.y) - PBE.y)}em;animation:bt-pend .8s ease-in-out infinite alternate}
#boot .bt-wt,#boot .bt-rg{--d:1;animation:bt-wt ${LOAD_S}s linear forwards}
#boot .bt-rg{--d:-1}
#boot .bt-wt{width:${CNE.w}em;height:${CNE.h}em;background:url(${coneURL}) 0 0/100% 100%}
#boot .bt-rg{width:${RGE.w}em;height:${RGE.h}em;background:url(${ringURL}) 0 0/100% 100%}
#boot .bt-wt::before,#boot .bt-rg::before{content:'';position:absolute;width:${r2(CHE.w)}em;height:${CHAIN_L}em;background:url(${chainURL}) 0 100%/${r2(CHE.w)}em ${r2(CHE.h)}em repeat-y}
#boot .bt-wt::before{left:${wEl(0).chainLeft}em;bottom:${wEl(0).chainBottom}em}
#boot .bt-rg::before{left:${rEl(0).chainLeft}em;bottom:${rEl(0).chainBottom}em}
${[0, 1].map((i) => `#boot .bt-wt.w${i}{left:${wEl(i).x}em;top:${wEl(i).y}em}\n#boot .bt-rg.w${i}{left:${rEl(i).x}em;top:${rEl(i).y}em}`).join('\n')}
#boot .bt-tap{left:${r2(dcx + em(0.12))}em;top:${r2(dcy + em(0.11))}em;width:24em;height:24em;margin:-12em 0 0 -12em;border-radius:50%;border:1.6em solid #ffe9b0;box-shadow:0 0 0 .9em rgba(20,12,16,.55),inset 0 0 0 .9em rgba(20,12,16,.55);opacity:0}
#boot .bt-note{width:9em;height:12em;opacity:0}
#boot.ready{cursor:pointer}
#boot.ready *{pointer-events:none}
#boot.ready .bt-tap{animation:bt-tap 1.5s ease-out infinite}
#boot.call .bt-note{animation:bt-note .9s ease-out forwards}
#boot.zoom .bt-tap{opacity:0;animation:none}
@keyframes bt-turn{to{transform:rotate(360deg)}}
@keyframes bt-pend{from{transform:rotate(-6.3deg)}to{transform:rotate(6.3deg)}}
@keyframes bt-flick{0%,100%{opacity:1}35%{opacity:.93}70%{opacity:.97}}
@keyframes bt-mote{0%{opacity:0;transform:translate(0,0)}15%{opacity:.75}50%{transform:translate(8em,-18em)}85%{opacity:.5}100%{opacity:0;transform:translate(3em,-36em)}}
${sink()}
@keyframes bt-tap{0%{opacity:0;transform:scale(.55)}25%{opacity:.95}100%{opacity:0;transform:scale(1.25)}}
@keyframes bt-note{0%{opacity:1;transform:translate(0,0) rotate(0)}70%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(14deg)}}
@media (prefers-reduced-motion:reduce){#boot *:not(.bt-h){animation-duration:0s!important;animation-iteration-count:1!important}}
`.trim().replace(/\n+/g, '\n');
  const motes = [[-60, 40, 0], [56, 12, -2.1], [-28, -52, -4.4], [70, -70, -6.2], [-80, -10, -1.3], [18, 80, -3.6], [40, -90, -7.7], [-46, 90, -5.1]];
  const hy = ey(P.DOOR.y + 0.17), notes = [[dcx - em(0.2), hy, -12, -18], [dcx + em(0.12), hy - 4, 13, -20], [dcx - em(0.05), hy - 12, -3, -24]];
  const NOTE = `<svg class="bt-note" style="left:%Xem;top:%Yem;--dx:%DXem;--dy:%DYem" viewBox="0 0 14 18"><path d="M5.5 14.2a3 2.3-22 1 1-.9-2.6V2l7.4 2v3.4L6.6 5.6v8.4z" fill="#ffd978" stroke="#140c10" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
  const script = `(function(){try{var d=new Date(),m=d.getMinutes()*60+d.getSeconds()+d.getMilliseconds()/1e3,b=document.getElementById('boot'),s=b.style;s.setProperty('--tm',m.toFixed(1));s.setProperty('--th',((d.getHours()%12)*3600+m).toFixed(1));var n=0,im=b.querySelectorAll('img'),on=function(){b.classList.add('lit')},one=function(){if(++n>=im.length)on()};for(var i=0;i<im.length;i++){if(im[i].complete)one();else{im[i].addEventListener('load',one);im[i].addEventListener('error',one)}}setTimeout(on,4000)}catch(e){}})()`;
  const html = `<!-- boot:begin (generated by src/onboard/clockbake.ts via src/onboard/tools/bootbake.mjs; edit the generator, not this block) -->
    <style>${CSS}</style>
    <div id="boot" role="progressbar" aria-label="Loading" data-art='${JSON.stringify({ cx: r2(dcx), dy: r2(dcy), rd: em(P.DIAL.r), w: SW, sh: SH, dw: r2(DB.w), wt: TRAVEL })}'>
      <i class="bt-pool"></i>${motes.map(([x, y, d]) => `<i class="bt-mote" style="left:calc(50% + ${x}em);top:calc(50% + ${y}em);animation-delay:${d}s"></i>`).join('')}
      <div class="bt-stage">
        <i class="bt-pend"></i>
        <i class="bt-wt w0"></i><i class="bt-wt w1"></i><i class="bt-rg w0"></i><i class="bt-rg w1"></i>
        <img class="bt-case" src="img/boot/clock.webp" alt="" />
        <i class="bt-door"></i>
        <img class="bt-dial" src="img/boot/dial.webp" alt="" />
        <i class="bt-h bt-hh"></i><i class="bt-h bt-mh"></i><i class="bt-boss"></i>
        <i class="bt-tap"></i>
        ${notes.map(([x, y, dx, dy]) => NOTE.replace('%X', String(r2(x))).replace('%Y', String(r2(y))).replace('%DX', String(dx)).replace('%DY', String(dy))).join('')}
      </div>
    </div>
    <script>${script}</script>
    <!-- boot:end -->`;
  renderer.dispose();
  return { html, files, preview: [closed, strip, dialAtlas, pendC, coneC, ringC, chainC] };
}

function isIn(o: THREE.Object3D, p: THREE.Object3D): boolean {
  for (let q: THREE.Object3D | null = o; q; q = q.parent) if (q === p) return true;
  return false;
}
