// Dev-only contact sheet for the hand-made lowpix furniture (public/models/items/*.glb), lit like a room.
//   ?ids=a,b      only these items (default: every item with a `model`)
//   ?night=1      night lighting (lamp items get their point light)      ?cell=220  cell size
//   ?yaw=0.62&pitch=0.42   camera angle      ?t=1.2  clip time for the snapshot
//   ?one=<id>     a single item, live, turning slowly, clips playing (add &spin=0 to hold still)
//   ?box=1        draw the old box model next to the GLB (size check)
// Each cell lists the GLB bounds in px next to the build() fallback bounds and flags a mismatch.
import * as THREE from 'three';
import { ALL_ITEMS } from '../assets/registry.ts';
import type { ItemDef } from '../assets/furniture.ts';
import { buildProp, propMesh, PX } from '../gfx/box.ts';
import { boundsOf } from '../game/home.ts';
import { instanceGLB } from '../gfx/glb.ts';

const q = new URLSearchParams(location.search);
const CELL = +(q.get('cell') ?? 220);
const YAW = +(q.get('yaw') ?? 0.62), PITCH = +(q.get('pitch') ?? 0.42);
const NIGHT = q.get('night') === '1';
const T = +(q.get('t') ?? 1.2);
let items = ALL_ITEMS.filter((i) => i.model);
if (q.get('ids')) { const ids = q.get('ids')!.split(','); items = ALL_ITEMS.filter((i) => ids.includes(i.id) && i.model); }

function stage(night: boolean) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? 0x1b222d : 0x27313f);
  scene.add(new THREE.HemisphereLight(night ? 0x617f8c : 0xf4eedd, night ? 0x1b222d : 0x6a655c, night ? 0.6 : 1.5));
  const d = new THREE.DirectionalLight(night ? 0x86a9b0 : 0xf1e6cc, night ? 0.45 : 1.8);
  d.position.set(-3, 6, 7);
  d.castShadow = true;
  d.shadow.mapSize.set(1024, 1024);
  d.shadow.bias = -0.0006;
  scene.add(d, d.target);
  return { scene, sun: d };
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

function backdrop(def: ItemDef, b: THREE.Box3): THREE.Object3D {
  const g = new THREE.Group();
  const w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) + 1.2;
  if (def.wall) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.4, (b.max.y - b.min.y) * 2 + 2), new THREE.MeshLambertMaterial({ color: 0x6f553d }));
    wall.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z - 0.01);
    wall.receiveShadow = true;
    g.add(wall);
  } else {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.2, w * 2.2), new THREE.MeshLambertMaterial({ color: 0x9c7a56 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = Math.min(0, b.min.y) - 0.002;
    floor.receiveShadow = true;
    g.add(floor);
  }
  return g;
}

function lightFor(def: ItemDef, night: boolean): THREE.PointLight | null {
  if (!def.light) return null;
  const l = new THREE.PointLight(def.light.color, (night ? 3.2 : 0.6) * def.light.power, 5, 1.6);
  l.position.set(def.light.x * PX, def.light.y * PX, def.light.z * PX);
  return l;
}

async function load(def: ItemDef) {
  const { root, clips } = await instanceGLB(def.model!);
  const mixer = new THREE.AnimationMixer(root);
  const clip = clips.find((c) => c.name === 'idle') ?? clips[0];
  if (clip) mixer.clipAction(clip).play();
  return { root, mixer, clips };
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();
function boundsText(def: ItemDef, b: THREE.Box3) {
  const g = { minX: b.min.x / PX, maxX: b.max.x / PX, minY: b.min.y / PX, maxY: b.max.y / PX, minZ: b.min.z / PX, maxZ: b.max.z / PX };
  const o = boundsOf(def.build());
  const keys = ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'] as const;
  const worst = Math.max(...keys.map((k) => Math.abs(g[k] - o[k])));
  const row = (n: string, r: typeof g) => `${n} x ${fmt(r.minX)}..${fmt(r.maxX)} y ${fmt(r.minY)}..${fmt(r.maxY)} z ${fmt(r.minZ)}..${fmt(r.maxZ)}`;
  return `<div class="meta">${row('glb', g)}</div><div class="meta ${worst > 2.5 ? 'warn' : ''}">${row('box', o)} (off ${fmt(worst)})</div>`;
}

async function sheet() {
  document.body.insertAdjacentHTML('beforeend', `<h1>Furniture models</h1><div class="sub">${items.length} furniture models (lowpix + borrowed) · ${NIGHT ? 'night' : 'day'} · ?one=&lt;id&gt; for a live turntable</div>`);
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.setProperty('--cell', CELL + 'px');
  document.body.append(grid);
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(CELL * 2, CELL * 2);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.OrthographicCamera();
  for (const def of items) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const cv = document.createElement('canvas');
    cv.width = CELL * 2; cv.height = CELL * 2;
    cell.append(cv);
    grid.append(cell);
    try {
      const { root, mixer } = await load(def);
      mixer.update(T);
      const { scene, sun } = stage(NIGHT);
      scene.add(root);
      root.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(root);
      scene.add(backdrop(def, b));
      const l = lightFor(def, NIGHT);
      if (l) scene.add(l);
      if (q.get('box') === '1') {
        const m = propMesh(buildProp(def.build()));
        m.position.x = (b.max.x - b.min.x) + 0.3;
        scene.add(m);
        b.expandByObject(m);
      }
      sun.target.position.copy(b.getCenter(new THREE.Vector3()));
      frame(cam, b, YAW, PITCH);
      renderer.render(scene, cam);
      cv.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
      cell.insertAdjacentHTML('beforeend', `<div class="nm">${def.name}</div><div class="meta">${def.id} · ${def.model}</div>${boundsText(def, b)}`);
    } catch (e) {
      cell.insertAdjacentHTML('beforeend', `<div class="nm warn">${def.id}: ${String(e)}</div>`);
    }
  }
  document.body.dataset.ready = '1';
}

async function liveOne(id: string) {
  const def = ALL_ITEMS.find((i) => i.id === id);
  document.body.className = 'one';
  if (!def?.model) { document.body.textContent = 'no model for ' + id; return; }
  const canvas = document.createElement('canvas');
  canvas.id = 'one';
  document.body.append(canvas);
  document.body.insertAdjacentHTML('beforeend', `<div class="label">${def.name} <span style="font-size:13px;color:#aec8cc">${def.id}</span></div>`);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const { root, mixer } = await load(def);
  const { scene, sun } = stage(NIGHT);
  const spin = new THREE.Group();
  spin.add(root);
  scene.add(spin);
  const b = new THREE.Box3().setFromObject(root);
  scene.add(backdrop(def, b));
  const l = lightFor(def, NIGHT);
  if (l) spin.add(l);
  sun.target.position.copy(b.getCenter(new THREE.Vector3()));
  const cam = new THREE.OrthographicCamera();
  const clock = new THREE.Clock();
  const tick = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    frame(cam, b, YAW, PITCH, 1.25);
    const asp = w / h, cx = (cam.left + cam.right) / 2, hw = (cam.top - cam.bottom) / 2;
    cam.left = cx - hw * asp; cam.right = cx + hw * asp; cam.updateProjectionMatrix();
    const dt = clock.getDelta();
    mixer.update(dt);
    if (q.get('spin') !== '0' && !def.wall) spin.rotation.y += dt * 0.4;
    renderer.render(scene, cam);
    requestAnimationFrame(tick);
  };
  tick();
}

/** ?src=/path/a.glb,/path/b.glb : any GLBs (e.g. borrow candidates), same lighting, labelled with size in px. */
async function sources(urls: string[]) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.setProperty('--cell', CELL + 'px');
  document.body.append(grid);
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(CELL * 2, CELL * 2);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.OrthographicCamera();
  for (const url of urls) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const cv = document.createElement('canvas');
    cv.width = CELL * 2; cv.height = CELL * 2;
    cell.append(cv);
    grid.append(cell);
    try {
      const g = await loader.loadAsync(url);
      g.scene.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.castShadow = m.receiveShadow = true; const mt = m.material as THREE.MeshStandardMaterial; if (mt.map) { mt.map.magFilter = THREE.NearestFilter; mt.map.needsUpdate = true; } } });
      const { scene, sun } = stage(NIGHT);
      scene.add(g.scene);
      g.scene.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g.scene);
      sun.target.position.copy(b.getCenter(new THREE.Vector3()));
      frame(cam, b, YAW, PITCH);
      renderer.render(scene, cam);
      cv.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
      const s = b.getSize(new THREE.Vector3());
      cell.insertAdjacentHTML('beforeend', `<div class="nm">${url.split('/').pop()}</div><div class="meta">${fmt(s.x)} x ${fmt(s.y)} x ${fmt(s.z)}</div>`);
    } catch (e) {
      cell.insertAdjacentHTML('beforeend', `<div class="nm warn">${url}: ${String(e)}</div>`);
    }
  }
  document.body.dataset.ready = '1';
}

if (q.get('src')) void sources(q.get('src')!.split(','));
else if (q.get('one')) void liveOne(q.get('one')!);
else void sheet();
