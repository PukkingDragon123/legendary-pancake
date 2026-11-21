// Dev-only contact sheet for furnC's lowpix item models (decor, wall, fun, Frostlight, Starfall) and the
// wallpaper / flooring finishes. Renders the real GLBs through src/gfx/glb.ts, lit like a room.
//   ?ids=a,b   ?set=trinkets|fun|frost|starfall   ?cell=220   ?yaw=0.62 ?pitch=0.42   ?night=1   ?t=1.3
//   ?old=1     show the old box model next to each GLB
//   ?one=<id>  a single item, live and animated, on a slow turntable (&spin=0 holds it still)
//   ?finishes=0 / ?items=0   hide a section
import * as THREE from 'three';
import { TRINKETS } from '../assets/decor/trinkets.ts';
import { FUN } from '../assets/decor/fun.ts';
import { FROST_FINISHES, FROST_ITEMS } from '../assets/decor/frost.ts';
import { STARFALL_FINISHES, STARFALL_ITEMS } from '../assets/decor/starfall.ts';
import { DECOR_FINISHES } from '../assets/decor/finishes.ts';
import { itemObject } from '../assets/decor/kit.ts';
import type { ItemDef } from '../assets/furniture.ts';
import type { Finish } from '../assets/finishes.ts';
import { instanceGLB } from '../gfx/glb.ts';
import { P } from '../gfx/palette.ts';
import { PX } from '../gfx/box.ts';

const q = new URLSearchParams(location.search);
const SETS: Record<string, ItemDef[]> = { trinkets: TRINKETS, fun: FUN, frost: FROST_ITEMS, starfall: STARFALL_ITEMS };
let items: ItemDef[] = q.get('set') ? SETS[q.get('set')!] ?? [] : [...TRINKETS, ...FUN, ...FROST_ITEMS, ...STARFALL_ITEMS];
let finishes: Finish[] = [...DECOR_FINISHES, ...FROST_FINISHES, ...STARFALL_FINISHES];
if (q.get('ids')) { const ids = q.get('ids')!.split(','); items = items.filter((i) => ids.includes(i.id)); finishes = finishes.filter((f) => ids.includes(f.id)); }
if (q.get('finishes') === '0') finishes = [];
if (q.get('items') === '0') items = [];
const CELL = +(q.get('cell') ?? 220);
const YAW = +(q.get('yaw') ?? 0.62), PITCH = +(q.get('pitch') ?? 0.42);
const NIGHT = q.get('night') === '1';
const T = +(q.get('t') ?? 1.3);
const OLD = q.get('old') === '1';

function stage(night: boolean) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(night ? 0x8090b8 : 0xfff4e0, night ? 0x2a2630 : 0x8a7a70, night ? 0.6 : 1.45));
  const d = new THREE.DirectionalLight(night ? 0x9aa8d0 : 0xfff0d8, night ? 0.55 : 1.8);
  d.position.set(-3, 6, 7);
  d.castShadow = true;
  d.shadow.mapSize.set(1024, 1024);
  d.shadow.bias = -0.0006;
  scene.add(d, d.target);
  return { scene, sun: d };
}

function backdrop(def: ItemDef, b: THREE.Box3): THREE.Object3D {
  const g = new THREE.Group();
  const w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) + 1.2;
  if (!def.wall) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.2, w * 2.2), new THREE.MeshLambertMaterial({ color: P.woodLight }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = Math.min(0, b.min.y) - 0.002;
    floor.receiveShadow = true;
    g.add(floor);
  } else {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.4, (b.max.y - b.min.y) * 2 + 2), new THREE.MeshLambertMaterial({ color: P.linen }));
    wall.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, Math.min(0, b.min.z) - 0.01);
    wall.receiveShadow = true;
    g.add(wall);
  }
  return g;
}

function frame(cam: THREE.OrthographicCamera, b: THREE.Box3, yaw: number, pitch: number, pad = 1.1) {
  const c = b.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  cam.position.copy(c).addScaledVector(dir, 40);
  cam.lookAt(c);
  cam.updateMatrixWorld();
  const pb = new THREE.Box3();
  for (let i = 0; i < 8; i++) pb.expandByPoint(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(cam.matrixWorldInverse));
  const half = (Math.max(pb.max.x - pb.min.x, pb.max.y - pb.min.y) / 2) * pad + 0.02, mx = (pb.max.x + pb.min.x) / 2, my = (pb.max.y + pb.min.y) / 2;
  cam.left = mx - half; cam.right = mx + half; cam.top = my + half; cam.bottom = my - half;
  cam.near = 0.1; cam.far = 100;
  cam.updateProjectionMatrix();
}

function lightFor(def: ItemDef, night: boolean): THREE.PointLight | null {
  if (!def.light) return null;
  const l = new THREE.PointLight(def.light.color, (night ? 3.2 : 0.8) * def.light.power, 5, 1.6);
  l.position.set(def.light.x * PX, def.light.y * PX, def.light.z * PX);
  return l;
}

async function glbObject(def: ItemDef, t: number): Promise<{ obj: THREE.Object3D; mixer: THREE.AnimationMixer | null; tris: number }> {
  const { root, clips } = await instanceGLB(def.model!);
  let mixer: THREE.AnimationMixer | null = null;
  if (clips.length) {
    mixer = new THREE.AnimationMixer(root);
    const clip = clips.find((c) => c.name === 'idle') ?? clips[0];
    mixer.clipAction(clip).play();
    mixer.setTime(t);
  }
  let tris = 0;
  root.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) tris += (m.geometry.index?.count ?? 0) / 3; });
  return { obj: root, mixer, tris };
}

function cellFor(d: ItemDef, imgs: HTMLElement[], note: string): HTMLElement {
  const c = document.createElement('div');
  c.className = 'cell';
  c.dataset.id = d.id;
  const row = document.createElement('div');
  row.className = 'pics';
  row.append(...imgs);
  c.append(row);
  c.insertAdjacentHTML('beforeend', `<div class="nm">${d.name}</div><div class="meta"><span class="r-${d.rarity ?? 'common'}">${d.rarity ?? 'common'}</span> · ${d.id} · ${d.size?.join('x') ?? ''}${d.wall ? ' wall' : ''}${d.small ? ' small' : ''}${d.rug ? ' rug' : ''}</div><div class="meta">${note}</div>`);
  return c;
}

function paintFinish(f: Finish, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = f.kind === 'wallpaper' ? h - 1 - y + 0.5 : y + 0.5;
    const col = f.paint(x + 0.5, v);
    const k = (y * w + x) * 4;
    im.data[k] = (col >> 16) & 255; im.data[k + 1] = (col >> 8) & 255; im.data[k + 2] = col & 255; im.data[k + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

function finishCell(f: Finish): HTMLElement {
  const c = document.createElement('div');
  c.className = 'cell fin';
  const cv = paintFinish(f, 128, 80);
  c.append(cv);
  c.insertAdjacentHTML('beforeend', `<div class="nm">${f.swatch.map((s) => `<span class="sw" style="background:${s}"></span>`).join('')} ${f.name}</div><div class="meta">${f.kind} · ${f.id}</div>`);
  return c;
}

// ------------------------------------------------------------------ single live item

async function liveOne(id: string) {
  const def = [...TRINKETS, ...FUN, ...FROST_ITEMS, ...STARFALL_ITEMS].find((i) => i.id === id);
  document.body.className = 'one';
  if (!def || !def.model) { document.body.textContent = 'no model for ' + id; return; }
  const canvas = document.createElement('canvas');
  canvas.id = 'one';
  document.body.append(canvas);
  document.body.insertAdjacentHTML('beforeend', `<div class="label">${def.name} <span style="font-size:13px;color:#c0a888">${def.id}</span></div>`);
  const r = new THREE.WebGLRenderer({ canvas, antialias: false });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  r.setSize(innerWidth, innerHeight, false);
  r.shadowMap.enabled = true;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(P.night);
  const { scene, sun } = stage(NIGHT);
  const { obj, mixer } = await glbObject(def, 0);
  const holder = new THREE.Group();
  holder.add(obj);
  scene.add(holder);
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  scene.add(backdrop(def, b));
  const l = lightFor(def, NIGHT);
  if (l) holder.add(l);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const aspect = innerWidth / innerHeight;
  const spin = q.get('spin') !== '0' && !def.wall;
  sun.target.position.copy(b.getCenter(new THREE.Vector3()));
  let last = performance.now();
  const t0 = last;
  const loop = () => {
    const now = performance.now(), t = (now - t0) / 1000;
    mixer?.update((now - last) / 1000);
    last = now;
    holder.rotation.y = spin ? Math.sin(t * 0.4) * 0.9 : 0;
    frame(cam, b, YAW, PITCH, 1.25);
    const w = (cam.right - cam.left) / 2, mx = (cam.right + cam.left) / 2;
    cam.left = mx - w * aspect; cam.right = mx + w * aspect;
    cam.updateProjectionMatrix();
    r.render(scene, cam);
    (window as any).__ready = true;
    requestAnimationFrame(loop);
  };
  loop();
}

// ------------------------------------------------------------------ grid

async function grid() {
  document.body.style.setProperty('--cell', (OLD ? CELL * 2 : CELL) + 'px');
  const withModel = items.filter((i) => i.model).length;
  document.body.insertAdjacentHTML('beforeend', `<h1>Hoot Hollow: furnC lowpix items</h1><div class="sub">${items.length} items (${withModel} with models) · ${finishes.length} finishes · ${NIGHT ? 'night' : 'day'} light · t=${T}s</div>`);
  const S = Math.round(CELL * 1.25);
  const c = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: false, preserveDrawingBuffer: true });
  r.setSize(S, S, false);
  r.shadowMap.enabled = true;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x000000, 0);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const groups: [string, ItemDef[]][] = Object.entries(SETS).map(([k, v]) => [k, v.filter((i) => items.includes(i))] as [string, ItemDef[]]).filter(([, v]) => v.length);
  let totalTris = 0;
  for (const [name, list] of groups) {
    document.body.insertAdjacentHTML('beforeend', `<h2>${name} <span style="font-size:12px;color:#b9a58a">(${list.length})</span></h2>`);
    const g = document.createElement('div');
    g.className = 'grid';
    document.body.append(g);
    for (const def of list) {
      const shots: HTMLElement[] = [];
      let note = '';
      const shoot = async (useGlb: boolean) => {
        const { scene, sun } = stage(NIGHT);
        let obj: THREE.Object3D;
        if (useGlb) {
          const o = await glbObject(def, T);
          obj = o.obj;
          totalTris += o.tris;
          note = `${Math.round(o.tris)} tris`;
        } else obj = itemObject(def).obj;
        scene.add(obj);
        obj.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(obj);
        note += ` · ${[b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => (v * 16).toFixed(1)).join(' ')}`;
        scene.add(backdrop(def, b));
        const l = lightFor(def, NIGHT);
        if (l) obj.add(l);
        sun.target.position.copy(b.getCenter(new THREE.Vector3()));
        const ext = b.getSize(new THREE.Vector3()).length();
        sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext; sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
        sun.position.copy(sun.target.position).add(new THREE.Vector3(-3, 6, 7));
        sun.shadow.camera.updateProjectionMatrix();
        frame(cam, b, def.wall ? 0.32 : YAW, def.wall ? 0.16 : def.rug ? 0.9 : PITCH);
        r.render(scene, cam);
        const img = new Image();
        img.src = c.toDataURL('image/png');
        img.width = CELL; img.height = CELL;
        shots.push(img);
      };
      try {
        if (def.model) await shoot(true);
        if (OLD || !def.model) await shoot(false);
      } catch (e) { console.error('render failed', def.id, e); note = 'FAILED ' + String(e); }
      g.append(cellFor(def, shots, note));
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  document.querySelector('.sub')!.insertAdjacentHTML('beforeend', ` · ${Math.round(totalTris)} tris total`);
  if (finishes.length) {
    for (const kind of ['wallpaper', 'flooring'] as const) {
      const list = finishes.filter((f) => f.kind === kind);
      if (!list.length) continue;
      document.body.insertAdjacentHTML('beforeend', `<h2>${kind} <span style="font-size:12px;color:#b9a58a">(${list.length})</span></h2>`);
      const g = document.createElement('div');
      g.className = 'grid';
      document.body.append(g);
      for (const f of list) g.append(finishCell(f));
    }
  }
  (window as any).__ready = true;
}

if (q.get('one')) void liveOne(q.get('one')!);
else void grid();
