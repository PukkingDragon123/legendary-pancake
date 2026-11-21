// Dev-only contact sheet for the decor and seasonal content: every item rendered in 3D with its
// moving parts, plus every wallpaper and flooring painted as a tile.
//   ?set=decor|seasonal|all   ?cat=lights   ?ids=a,b   ?cell=220   ?yaw=0.6   ?night=1   ?t=1.3
//   ?one=<id>  a single item, live, on a slow turntable (add &spin=0 to hold still)
//   ?finishes=0 hide the finish tiles   ?items=0 hide the items   ?room=wall_x,floor_y  a room corner
import * as THREE from 'three';
import { DECOR_FINISHES, DECOR_ITEMS } from '../assets/decor.ts';
import { SEASONAL_FINISHES, SEASONAL_ITEMS } from '../assets/seasonal.ts';
import { itemObject } from '../assets/decor/kit.ts';
import type { ItemDef } from '../assets/furniture.ts';
import type { Finish } from '../assets/finishes.ts';
import { PX } from '../gfx/box.ts';

const q = new URLSearchParams(location.search);
const set = q.get('set') ?? 'all';
let items: ItemDef[] = set === 'decor' ? DECOR_ITEMS : set === 'seasonal' ? SEASONAL_ITEMS : [...DECOR_ITEMS, ...SEASONAL_ITEMS];
let finishes: Finish[] = set === 'decor' ? DECOR_FINISHES : set === 'seasonal' ? SEASONAL_FINISHES : [...DECOR_FINISHES, ...SEASONAL_FINISHES];
if (q.get('cat')) items = items.filter((i) => i.cat === q.get('cat'));
if (q.get('ids')) { const ids = q.get('ids')!.split(','); items = items.filter((i) => ids.includes(i.id)); finishes = finishes.filter((f) => ids.includes(f.id)); }
if (q.get('finishes') === '0') finishes = [];
if (q.get('items') === '0') items = [];
const CELL = +(q.get('cell') ?? 220);
const YAW = +(q.get('yaw') ?? 0.62), PITCH = +(q.get('pitch') ?? 0.42);
const NIGHT = q.get('night') === '1';
const T = +(q.get('t') ?? 1.3);

function stage(night: boolean) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(night ? 0x6a74b8 : 0xfff4e0, night ? 0x241c30 : 0x8a7a90, night ? 0.55 : 1.55));
  const d = new THREE.DirectionalLight(night ? 0x8a9ad8 : 0xfff0d8, night ? 0.5 : 1.9);
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
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.2, w * 2.2), new THREE.MeshLambertMaterial({ color: 0x6a5450 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = Math.min(0, b.min.y) - 0.002;
  floor.receiveShadow = true;
  if (!def.wall) g.add(floor);
  if (def.wall) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.4, (b.max.y - b.min.y) * 2 + 2), new THREE.MeshLambertMaterial({ color: 0x8a6e62 }));
    wall.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z - 0.01);
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

const meta = (d: ItemDef) => {
  const chips: string[] = [d.cat];
  if (d.size) chips.push(`${d.size[0]}x${d.size[1]}`);
  if (d.surface !== undefined) chips.push(`surface ${d.surface}`);
  if (d.small) chips.push('small');
  if (d.wall) chips.push('wall');
  if (d.rug) chips.push('rug');
  if (d.light) chips.push('light');
  if (d.parts) chips.push('moving');
  if (d.sleep) chips.push('sleep');
  if (d.sit) chips.push('sit');
  if (d.series) chips.push(d.series);
  return chips;
};

function cellFor(d: ItemDef, img: HTMLElement): HTMLElement {
  const c = document.createElement('div');
  c.className = 'cell';
  c.dataset.id = d.id;
  const price = d.gems ? `${d.gems} gems` : d.price ? `${d.price} coins` : d.noStore ? 'prize' : 'free';
  c.append(img);
  c.insertAdjacentHTML('beforeend', `<div class="nm">${d.name}</div><div class="meta"><span class="r-${d.rarity ?? 'common'}">${d.rarity ?? 'common'}</span> · ${price} · ${d.id}</div><div class="chips">${meta(d).map((m) => `<span class="chip">${m}</span>`).join('')}</div>`);
  return c;
}

function paintFinish(f: Finish, w: number, h: number, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // walls: v grows upwards from the floor; floors: v runs away from the viewer
    const v = f.kind === 'wallpaper' ? h - 1 - y + 0.5 : y + 0.5;
    const col = f.paint(x + 0.5, v);
    const k = (y * w + x) * 4;
    im.data[k] = (col >> 16) & 255; im.data[k + 1] = (col >> 8) & 255; im.data[k + 2] = col & 255; im.data[k + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  c.style.width = w * scale + 'px';
  c.style.height = h * scale + 'px';
  return c;
}

function finishCell(f: Finish): HTMLElement {
  const c = document.createElement('div');
  c.className = 'cell fin';
  const cv = paintFinish(f, 96, 64, 1);
  cv.style.width = '100%'; cv.style.height = 'auto';
  c.append(cv);
  const price = f.gems ? `${f.gems} gems` : f.price ? `${f.price} coins` : f.noStore ? 'prize' : 'free';
  c.insertAdjacentHTML('beforeend', `<div class="nm">${f.swatch.map((s) => `<span class="sw" style="background:${s}"></span>`).join('')} ${f.name}</div><div class="meta"><span class="r-${f.rarity ?? 'common'}">${f.rarity ?? 'common'}</span> · ${price} · ${f.id}</div><div class="meta">${f.blurb}</div>`);
  return c;
}

// ------------------------------------------------------------------ single live item

function liveOne(id: string) {
  const def = [...DECOR_ITEMS, ...SEASONAL_ITEMS].find((i) => i.id === id);
  document.body.className = 'one';
  if (!def) { document.body.textContent = 'no item ' + id; return; }
  const canvas = document.createElement('canvas');
  canvas.id = 'one';
  document.body.append(canvas);
  document.body.insertAdjacentHTML('beforeend', `<div class="label">${def.name} <span style="font-size:13px;color:#c0a888">${def.id}</span></div>`);
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  r.setSize(innerWidth, innerHeight, false);
  r.shadowMap.enabled = true;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x3a2e32);
  const { scene, sun } = stage(NIGHT);
  const { obj } = itemObject(def);
  (window as any).__obj = obj;
  const holder = new THREE.Group();
  holder.add(obj);
  scene.add(holder);
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  scene.add(backdrop(def, b));
  const l = lightFor(def, NIGHT);
  if (l) obj.add(l);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const aspect = innerWidth / innerHeight;
  const spin = q.get('spin') !== '0' && !def.wall;
  sun.target.position.copy(b.getCenter(new THREE.Vector3()));
  const t0 = performance.now();
  const loop = () => {
    const t = (performance.now() - t0) / 1000 + T;
    holder.rotation.y = spin ? Math.sin(t * 0.4) * 0.9 : 0;
    def.animate?.(obj, t, 1 / 60);
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
  document.body.style.setProperty('--cell', CELL + 'px');
  document.body.insertAdjacentHTML('beforeend', `<h1>Hoot Hollow: decor sheet</h1><div class="sub">${items.length} items · ${finishes.length} finishes · ${NIGHT ? 'night' : 'day'} light</div>`);
  const S = Math.round(CELL * 1.25);
  const c = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true });
  r.setSize(S, S, false);
  r.shadowMap.enabled = true;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x000000, 0);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const cats = [...new Set(items.map((i) => (i.series ? 'series: ' + i.series : i.cat)))];
  for (const cat of cats) {
    const list = items.filter((i) => (i.series ? 'series: ' + i.series : i.cat) === cat);
    document.body.insertAdjacentHTML('beforeend', `<h2>${cat} <span style="font-size:12px;color:#b9a58a">(${list.length})</span></h2>`);
    const g = document.createElement('div');
    g.className = 'grid';
    document.body.append(g);
    for (const def of list) {
      const { scene, sun } = stage(NIGHT);
      let url = '';
      try {
        const { obj, prop } = itemObject(def);
        scene.add(obj);
        for (let k = 0; k < 3; k++) def.animate?.(obj, T + k * 0.016, 0.016);
        obj.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(obj);
        if (q.get('debug')) console.warn(def.id, 'bounds px', [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => Math.round(v * 16 * 10) / 10).join(' '));
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
        url = c.toDataURL('image/png');
        prop.geo.dispose(); prop.tex.dispose();
      } catch (e) { console.error('render failed', def.id, e); }
      const img = new Image();
      img.src = url;
      img.width = CELL; img.height = CELL;
      g.append(cellFor(def, img));
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  if (finishes.length) {
    for (const kind of ['wallpaper', 'flooring'] as const) {
      const list = finishes.filter((f) => f.kind === kind);
      if (!list.length) continue;
      document.body.insertAdjacentHTML('beforeend', `<h2>${kind === 'wallpaper' ? 'wallpapers' : 'floorings'} <span style="font-size:12px;color:#b9a58a">(${list.length})</span></h2>`);
      const g = document.createElement('div');
      g.className = 'grid';
      document.body.append(g);
      for (const f of list) g.append(finishCell(f));
    }
  }
  (window as any).__ready = true;
}

if (q.get('one')) liveOne(q.get('one')!);
else grid();
