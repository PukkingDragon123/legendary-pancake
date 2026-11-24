// Dev page: bake the interface's main icons from real 3D models (BUSHED / Gacha Garage props, CC0 and CC BY,
// see docs/credits/ui3.md) into detailed pixel art, like BUSHED's inventory icons: an orthographic three-quarter
// render with warm lamplight, re-sampled to art pixels with a hard alpha, a soft coloured outline and the calm grade.
//   /dev-iconbake.html            every icon, big, on paper (for choosing)
//   window.__icons                 { id: dataURL } once done (tools/ scripts save them to public/ui/icons)
import * as THREE from 'three';
import { loadGLB } from '../gfx/glb.ts';
import { calmRGB } from '../ui/px/calm.js';

interface Spec { id: string; model: string; n: number; yaw?: number; pitch?: number; pad?: number; roll?: number; tint?: number }
// [id, model under public/models, texels, yaw, pitch]
const q = new URLSearchParams(location.search);
export const SPECS: Spec[] = [
  { id: 'sleep_bed', model: 'items/canopy_bed.glb', n: 60, yaw: 0.75, pitch: 0.42 },
  { id: 'sleep_daybed', model: 'uibake/daybed.glb', n: 60, yaw: 0.7, pitch: 0.4 },
  { id: 'sleep_blanket', model: 'uibake/blanket_pillows.glb', n: 60, yaw: 0.6, pitch: 0.55 },
  { id: 'clock_mantel', model: 'uibake/mantel_clock_01.glb', n: 60, yaw: 0.45, pitch: 0.2 },
  { id: 'clock_gg', model: 'uibake/clock_mantel.glb', n: 60, yaw: 0.45, pitch: 0.2 },
  { id: 'clock_alarm', model: 'uibake/clock_alarm.glb', n: 60, yaw: 0.45, pitch: 0.25 },
  { id: 'clock_wall', model: 'uibake/wall_clock.glb', n: 60, yaw: 0.25, pitch: 0.1 },
  { id: 'book_old', model: 'uibake/books_old.glb', n: 60, yaw: 0.6, pitch: 0.45 },
  { id: 'book_stack', model: 'uibake/books_stack.glb', n: 60, yaw: 0.6, pitch: 0.45 },
  { id: 'book_note', model: 'uibake/old_notebook.glb', n: 60, yaw: 0.5, pitch: 0.7 },
  { id: 'build_hammer', model: 'uibake/wooden_hammer_01.glb', n: 44, yaw: 0.9, pitch: 0.6 },
  { id: 'build_plane', model: 'uibake/hand_plane_no4.glb', n: 44, yaw: 0.7, pitch: 0.5 },
  { id: 'build_toolbox', model: 'uibake/toolbox.glb', n: 44, yaw: 0.6, pitch: 0.4 },
  { id: 'shop_basket', model: 'uibake/wicker_basket_01.glb', n: 44, yaw: 0.5, pitch: 0.45 },
  { id: 'shop_register', model: 'uibake/cash_register.glb', n: 44, yaw: 0.6, pitch: 0.3 },
  { id: 'dress_vanity', model: 'items/vanity.glb', n: 44, yaw: 0.6, pitch: 0.3 },
  { id: 'dress_mirror', model: 'uibake/mirror.glb', n: 44, yaw: 0.35, pitch: 0.15 },
  { id: 'dress_sewing', model: 'uibake/sewing_machine2.glb', n: 44, yaw: 0.7, pitch: 0.35 },
  { id: 'quest_note', model: 'uibake/old_notebook.glb', n: 44, yaw: 0.5, pitch: 0.75 },
  { id: 'quest_board', model: 'uibake/chalkboard.glb', n: 44, yaw: 0.4, pitch: 0.15 },
  { id: 'quest_suitcase', model: 'uibake/vintage_suitcase.glb', n: 44, yaw: 0.6, pitch: 0.35 },
  { id: 'map_compass', model: 'uibake/seadogs_compass.glb', n: 44, yaw: 0.4, pitch: 0.8 },
  { id: 'map_binoculars', model: 'uibake/binoculars.glb', n: 44, yaw: 0.7, pitch: 0.45 },
  { id: 'set_radio', model: 'uibake/vintage_radio_transceiver.glb', n: 44, yaw: 0.6, pitch: 0.3 },
  { id: 'set_lamp', model: 'uibake/vintage_oil_lamp.glb', n: 44, yaw: 0.5, pitch: 0.2 },
  { id: 'set_lantern', model: 'uibake/wooden_lantern_01.glb', n: 44, yaw: 0.5, pitch: 0.2 },
  { id: 'set_camera', model: 'uibake/camera_vintage.glb', n: 44, yaw: 0.6, pitch: 0.3 },
];

/** [ui3] detailed replacements for common sprites: [sprite name, model, yaw, pitch]; baked at 40 texels (res 2) */
export const SPRITE_SPECS: Spec[] = [
  { id: 'bell', model: 'uibake/call_bell_p.glb', n: 40, yaw: 0.5, pitch: 0.35 },
  { id: 'lantern', model: 'uibake/wooden_lantern_01.glb', n: 40, yaw: 0.5, pitch: 0.2 },
  { id: 'alarm', model: 'uibake/clock_alarm.glb', n: 40, yaw: 0.45, pitch: 0.25 },
  { id: 'clock', model: 'uibake/wall_clock.glb', n: 40, yaw: 0.25, pitch: 0.1 },
  { id: 'book', model: 'uibake/books_stack.glb', n: 40, yaw: 0.6, pitch: 0.45 },
  { id: 'nest', model: 'items/basket_nest.glb', n: 40, yaw: 0.6, pitch: 0.5 },
  { id: 'jar', model: 'items/firefly_jar.glb', n: 40, yaw: 0.5, pitch: 0.25 },
  { id: 'camera', model: 'uibake/camera_vintage.glb', n: 40, yaw: 0.6, pitch: 0.3 },
  { id: 'bench', model: 'uibake/painted_wooden_bench.glb', n: 40, yaw: 0.6, pitch: 0.35 },
  { id: 'shop', model: 'uibake/cash_register.glb', n: 40, yaw: 0.6, pitch: 0.3 },
  { id: 'clipboard', model: 'uibake/chalkboard.glb', n: 40, yaw: 0.4, pitch: 0.15 },
];

const S = 384;
const canvas = document.createElement('canvas');
const R = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
R.setSize(S, S, false);
R.setClearColor(0x000000, 0);
R.outputColorSpace = THREE.SRGBColorSpace;
R.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6f6a74, 1.5));
const key = new THREE.DirectionalLight(0xffe8c8, 2.2); key.position.set(-4, 7, 6); scene.add(key);
const rim = new THREE.DirectionalLight(0xc8d6e0, 0.8); rim.position.set(5, 3, -5); scene.add(rim);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 500);

function shoot(obj: THREE.Object3D, yaw: number, pitch: number, pad = 1.06): HTMLCanvasElement {
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3()).length();
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  cam.position.copy(c).addScaledVector(dir, size * 3);
  cam.near = size * 0.1; cam.far = size * 8;
  cam.lookAt(c); cam.updateMatrixWorld();
  const pb = new THREE.Box3();
  for (let i = 0; i < 8; i++) pb.expandByPoint(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(cam.matrixWorldInverse));
  const half = (Math.max(pb.max.x - pb.min.x, pb.max.y - pb.min.y) / 2) * pad, mx = (pb.max.x + pb.min.x) / 2, my = (pb.max.y + pb.min.y) / 2;
  cam.left = mx - half; cam.right = mx + half; cam.top = my + half; cam.bottom = my - half;
  cam.updateProjectionMatrix();
  R.render(scene, cam);
  scene.remove(obj);
  const out = document.createElement('canvas');
  out.width = S; out.height = S;
  out.getContext('2d')!.drawImage(R.domElement, 0, 0);
  return out;
}

/** re-sample to n x n art pixels: box-filtered colour, hard alpha, the calm grade, a soft coloured outline */
function pixelArt(src: HTMLCanvasElement, n: number): HTMLCanvasElement {
  const k = S / n;
  const sd = src.getContext('2d')!.getImageData(0, 0, S, S).data;
  const out = document.createElement('canvas');
  out.width = n; out.height = n;
  const g = out.getContext('2d')!, img = g.createImageData(n, n), d = img.data;
  const solid = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let r = 0, gg = 0, b = 0, a = 0, cnt = 0;
    for (let j = Math.floor(y * k); j < Math.floor((y + 1) * k); j++) for (let i = Math.floor(x * k); i < Math.floor((x + 1) * k); i++) {
      const o = (j * S + i) * 4, al = sd[o + 3];
      r += sd[o] * al; gg += sd[o + 1] * al; b += sd[o + 2] * al; a += al; cnt++;
    }
    const cov = a / (cnt * 255);
    if (cov < 0.42) continue;
    const c = calmRGB([r / a, gg / a, b / a]);
    // a gentle posterise: pixel-art clusters rather than smooth shading
    const P = 10;
    const i4 = (y * n + x) * 4;
    d[i4] = Math.round(c[0] / P) * P; d[i4 + 1] = Math.round(c[1] / P) * P; d[i4 + 2] = Math.round(c[2] / P) * P; d[i4 + 3] = 255;
    solid[y * n + x] = 1;
  }
  // outline: the darkest neighbour, darkened further (coloured, not black)
  const add: [number, number[]][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (solid[y * n + x]) continue;
    let best: number[] | null = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= n || Y >= n || !solid[Y * n + X]) continue;
      const o = (Y * n + X) * 4, c = [d[o] * 0.42 + 10, d[o + 1] * 0.4 + 9, d[o + 2] * 0.4 + 8];
      if (!best || c[0] + c[1] + c[2] < best[0] + best[1] + best[2]) best = c;
    }
    if (best) add.push([y * n + x, best]);
  }
  for (const [i, c] of add) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return out;
}

/** palette-indexed form of a baked canvas (for src/ui/px/baked.js) */
function indexed(c: HTMLCanvasElement) {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const pal: string[] = [], map = new Map<string, number>(), idx = new Uint8Array(c.width * c.height);
  for (let i = 0; i < idx.length; i++) {
    if (!d[i * 4 + 3]) { idx[i] = 0; continue; }
    const h = '#' + [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    let k = map.get(h);
    if (k === undefined) { k = pal.length + 1; if (k > 255) k = 255; else { map.set(h, k); pal.push(h); } }
    idx[i] = k;
  }
  let bin = '';
  for (const v of idx) bin += String.fromCharCode(v);
  return { w: c.width, h: c.height, pal, idx: btoa(bin) };
}

async function bake() {
  const only = q.get('only');
  const spritesMode = q.get('sprites') === '1';
  const list = (spritesMode ? SPRITE_SPECS : SPECS).filter((s) => !only || new RegExp(only).test(s.id));
  const sprites: Record<string, unknown> = {};
  const host = document.getElementById('out')!;
  const res: Record<string, string> = {};
  for (const s of list) {
    try {
      const gltf = await loadGLB(s.model);
      const root = gltf.scene.clone(true);
      const pix = pixelArt(shoot(root, s.yaw ?? 0.6, s.pitch ?? 0.35, s.pad), s.n);
      res[s.id] = pix.toDataURL('image/png');
      if (spritesMode) sprites[s.id] = indexed(pix);
      const fig = document.createElement('figure');
      fig.innerHTML = `<img src="${res[s.id]}" style="width:${s.n * 3}px;image-rendering:pixelated"><figcaption>${s.id}</figcaption>`;
      host.appendChild(fig);
    } catch (e) { console.error('bake failed', s.id, e); }
  }
  (window as unknown as { __sprites: unknown }).__sprites = sprites;
  (window as unknown as { __icons: unknown }).__icons = res;
}
void bake();
