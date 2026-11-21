// Dev contact sheet for furnB's furniture (beds, seating, tables, storage, lights, plants, rugs): every
// GLB under public/models/items rendered through src/gfx/glb.ts, lit like the house.
//   ?night=1           night light (lamps and flames glow, item point lights on)
//   ?cat=lights        one category   ?ids=a,b  only these
//   ?compare=1         the old box-built fallback next to each new model
//   ?one=<id>          a single item, live on a slow turntable, its clips playing (&spin=0 to hold still)
//   ?room=1            a mock room at the in-game viewing distance, everything on the floor
//   ?cell=220 ?yaw=0.62 ?pitch=0.42
import * as THREE from 'three';
import { BEDS_AND_SEATS } from '../assets/decor/beds.ts';
import { TABLES_AND_STORAGE } from '../assets/decor/tables.ts';
import { LIGHTS } from '../assets/decor/lights.ts';
import { GREEN } from '../assets/decor/green.ts';
import { itemObject } from '../assets/decor/kit.ts';
import type { ItemDef } from '../assets/furniture.ts';
import { PX } from '../gfx/box.ts';
import { instanceGLB } from '../gfx/glb.ts';
import { P } from '../gfx/palette.ts';

const q = new URLSearchParams(location.search);
let items: ItemDef[] = [...BEDS_AND_SEATS, ...TABLES_AND_STORAGE, ...LIGHTS, ...GREEN];
if (q.get('cat')) items = items.filter((i) => i.cat === q.get('cat'));
if (q.get('ids')) { const ids = q.get('ids')!.split(','); items = items.filter((i) => ids.includes(i.id)); }
const CELL = +(q.get('cell') ?? 220);
const YAW = +(q.get('yaw') ?? 0.62), PITCH = +(q.get('pitch') ?? 0.42);
const NIGHT = q.get('night') === '1';
const COMPARE = q.get('compare') === '1';

const css = `
html,body{margin:0;background:#232a27;color:#efe6cf;font-family:'TBME Body',monospace}
body{padding:14px 16px 40px}
h1{font-size:22px;margin:0 0 4px;color:#f1d39a;letter-spacing:1px}
h2{font-size:16px;margin:20px 0 8px;color:#c4cfa3;border-bottom:2px solid #3f5a3b;padding-bottom:4px}
.sub{font-size:13px;color:#a7b788;margin-bottom:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(${CELL}px,1fr));gap:10px}
.cell{background:#2c4030;border:2px solid #557343;box-shadow:3px 3px 0 #1b222d;padding:6px}
.cell img{width:100%;display:block;background:#344a37}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.nm{font-size:14px;margin-top:5px;color:#f4eedd}
.meta{font-size:11px;color:#c9b78d;margin-top:2px}
#one,#room{display:block;width:100vw;height:100vh}
body.one{padding:0;overflow:hidden}
.label{position:fixed;left:12px;top:10px;font-size:18px;color:#f1d39a;text-shadow:2px 2px 0 #1b222d}
`;
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);

function stage(night: boolean) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(night ? 0x5f6f98 : 0xfff4e0, night ? 0x1b222d : 0x7d8a70, night ? 0.5 : 1.45));
  const d = new THREE.DirectionalLight(night ? 0x8a9ad8 : 0xfff0d8, night ? 0.45 : 1.9);
  d.position.set(-3, 6, 7);
  d.castShadow = true;
  d.shadow.mapSize.set(1024, 1024);
  d.shadow.bias = -0.0006;
  d.shadow.normalBias = 0.02;
  scene.add(d, d.target);
  return { scene, sun: d };
}

function backdrop(def: ItemDef, b: THREE.Box3): THREE.Object3D {
  const g = new THREE.Group();
  const w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) + 1.2;
  if (!def.wall) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.2, w * 2.2), new THREE.MeshLambertMaterial({ color: P.woodDark }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = Math.min(0, b.min.y) - 0.002;
    floor.receiveShadow = true;
    g.add(floor);
  } else {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.4, (b.max.y - b.min.y) * 2 + 2), new THREE.MeshLambertMaterial({ color: P.linen }));
    wall.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, -0.01);
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
  const l = new THREE.PointLight(def.light.color, (night ? 3.2 : 0.6) * def.light.power, 5, 1.6);
  l.position.set(def.light.x * PX, def.light.y * PX, def.light.z * PX);
  return l;
}

/** The new model with its clips running (mixer advanced to time t). */
async function glbObject(def: ItemDef, t: number) {
  const { root, clips } = await instanceGLB(def.model ?? `items/${def.id}.glb`);
  const mixer = new THREE.AnimationMixer(root);
  for (const c of clips) mixer.clipAction(c).play();
  mixer.update(t);
  return { obj: root, mixer };
}

function shoot(r: THREE.WebGLRenderer, cam: THREE.OrthographicCamera, def: ItemDef, obj: THREE.Object3D): string {
  const { scene, sun } = stage(NIGHT);
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  scene.add(backdrop(def, b));
  const l = lightFor(def, NIGHT);
  if (l) scene.add(l);
  sun.target.position.copy(b.getCenter(new THREE.Vector3()));
  const ext = b.getSize(new THREE.Vector3()).length();
  sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext; sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
  sun.position.copy(sun.target.position).add(new THREE.Vector3(-3, 6, 7));
  sun.shadow.camera.updateProjectionMatrix();
  frame(cam, b, def.wall ? 0.32 : YAW, def.wall ? 0.16 : def.rug ? 0.9 : PITCH);
  r.render(scene, cam);
  return r.domElement.toDataURL('image/png');
}

async function grid() {
  document.body.insertAdjacentHTML('beforeend', `<h1>Hoot Hollow: furniture models (furnB)</h1><div class="sub">${items.length} models · ${NIGHT ? 'night' : 'day'} light${COMPARE ? ' · old fallback | new model' : ''}</div>`);
  const S = Math.round(CELL * 1.4);
  const c = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true });
  r.setSize(S, S, false);
  r.shadowMap.enabled = true;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x000000, 0);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  for (const cat of [...new Set(items.map((i) => i.cat))]) {
    const list = items.filter((i) => i.cat === cat);
    document.body.insertAdjacentHTML('beforeend', `<h2>${cat} (${list.length})</h2>`);
    const g = document.createElement('div');
    g.className = 'grid';
    document.body.append(g);
    for (const def of list) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const imgs = document.createElement('div');
      if (COMPARE) imgs.className = 'pair';
      cell.append(imgs);
      try {
        if (COMPARE) {
          const { obj, prop } = itemObject(def);
          const im = new Image();
          im.src = shoot(r, cam, def, obj);
          imgs.append(im);
          prop.geo.dispose(); prop.tex.dispose();
        }
        const { obj } = await glbObject(def, 1.3);
        const im = new Image();
        im.src = shoot(r, cam, def, obj);
        imgs.append(im);
      } catch (e) {
        console.error('render failed', def.id, e);
        imgs.textContent = 'missing: ' + def.id;
      }
      cell.insertAdjacentHTML('beforeend', `<div class="nm">${def.name}</div><div class="meta">${def.id} · ${def.size?.join('x') ?? ''}${def.surface ? ' · surface ' + def.surface : ''}${def.wall ? ' · wall' : ''}${def.light ? ' · light' : ''}</div>`);
      g.append(cell);
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  (window as any).__ready = true;
}

async function liveOne(id: string) {
  const def = items.find((i) => i.id === id) ?? [...BEDS_AND_SEATS, ...TABLES_AND_STORAGE, ...LIGHTS, ...GREEN].find((i) => i.id === id);
  document.body.className = 'one';
  if (!def) { document.body.textContent = 'no item ' + id; return; }
  const canvas = document.createElement('canvas');
  canvas.id = 'one';
  document.body.append(canvas);
  document.body.insertAdjacentHTML('beforeend', `<div class="label">${def.name} <span style="font-size:13px;color:#c9b78d">${def.id}</span></div>`);
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  r.setSize(innerWidth, innerHeight, false);
  r.shadowMap.enabled = true;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x232a27);
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
  const clock = new THREE.Clock();
  let t = 0;
  const loop = () => {
    const dt = clock.getDelta();
    t += dt;
    mixer.update(dt);
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

/** Everything laid out on a big floor (rugs under, wall pieces on a back wall), seen from the room camera. */
async function room() {
  document.body.className = 'one';
  const canvas = document.createElement('canvas');
  canvas.id = 'room';
  document.body.append(canvas);
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  r.setSize(innerWidth, innerHeight, false);
  r.shadowMap.enabled = true;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x232a27);
  const { scene, sun } = stage(NIGHT);
  const W = 16, D = 12;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ color: P.woodDark }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(W, 5), new THREE.MeshLambertMaterial({ color: P.linen }));
  wall.position.set(0, 2.5, -D / 2);
  wall.receiveShadow = true;
  scene.add(floor, wall);
  const mixers: THREE.AnimationMixer[] = [];
  let x = -W / 2 + 0.6, z = -D / 2 + 1.2, rowD = 0, wx = -W / 2 + 1;
  for (const def of items) {
    const { obj, mixer } = await glbObject(def, 0);
    mixers.push(mixer);
    const [bw, bd] = def.size ?? [1, 1];
    if (def.wall) {
      obj.position.set(wx + bw / 2, 2.6, -D / 2 + 0.01);
      wx += bw + 0.5;
    } else {
      if (x + bw > W / 2 - 0.4) { x = -W / 2 + 0.6; z += rowD + 0.5; rowD = 0; }
      obj.position.set(x + bw / 2, 0, z + bd / 2);
      x += bw + 0.4;
      rowD = Math.max(rowD, bd);
    }
    scene.add(obj);
    const l = lightFor(def, NIGHT);
    if (l) { l.position.add(obj.position); scene.add(l); }
  }
  sun.shadow.camera.left = -12; sun.shadow.camera.right = 12; sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
  sun.shadow.mapSize.set(2048, 2048);
  sun.position.set(-4, 9, 8);
  sun.shadow.camera.updateProjectionMatrix();
  const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 200);
  cam.position.set(0, 14, 17);
  cam.lookAt(0, 0, 0.5);
  const clock = new THREE.Clock();
  const loop = () => {
    const dt = clock.getDelta();
    for (const m of mixers) m.update(dt);
    r.render(scene, cam);
    (window as any).__ready = true;
    requestAnimationFrame(loop);
  };
  loop();
}

if (q.get('one')) liveOne(q.get('one')!);
else if (q.get('room')) room();
else grid();
