// Dev preview of the hollow oak: ?hour=21&view=home&floors=f1,f2&open=all&q=low&build=f1&yaw=0.5
// `open=all` unpacks every box; `open=f1_pip,f1_cozy` just those; `stack=1` adds a lamp on a table.
import { Scene, type View } from '../world/scene.ts';
import { FINISH, FINISHES, type Finish } from '../assets/registry.ts';
import { freshSave } from '../game/store.ts';
import { openBox, putItem, seedHome, unlockFloor } from '../game/home.ts';
import type { FloorId } from '../world/house/plan.ts';

const q = new URLSearchParams(location.search);
// two stand-in finishes so the wallpaper/flooring pipeline can be previewed before the content pack lands
if (q.get('demo')) {
  const add = (f: Finish) => { if (!FINISH[f.id]) { FINISHES.push(f); FINISH[f.id] = f; } };
  add({ id: 'wall_demo_starry', name: 'Starry Night Paper', kind: 'wallpaper', price: 120, blurb: 'Little gold stars on deep blue.', swatch: ['#3a5aa8', '#24386e', '#141f44'], paint: (u, v) => {
    if (v < 14) return Math.floor(u / 6) % 2 ? 0x5a3a24 : 0x6a4428;
    if (v < 15.5) return 0xe8c070;
    const s = (Math.floor(u / 10) * 7 + Math.floor(v / 10) * 13) % 11, cx = Math.floor(u / 10) * 10 + 5 + ((s * 3) % 4) - 2, cy = Math.floor(v / 10) * 10 + 5;
    if (s < 4 && Math.abs(u - cx) + Math.abs(v - cy) < 1.6) return 0xffe48a;
    return Math.floor(v / 3) % 7 === 0 ? 0x2a3f7a : 0x24386e;
  } });
  add({ id: 'floor_demo_check', name: 'Mossy Checker Tiles', kind: 'flooring', price: 90, blurb: 'Cool stone squares with moss in the cracks.', swatch: ['#c8c0b0', '#8a9a6a', '#5a6a4a'], paint: (u, v) => ((u % 12) < 1 || (v % 12) < 1 ? 0x5f8a44 : (Math.floor(u / 12) + Math.floor(v / 12)) % 2 ? 0xd8cfbe : 0x9aa08a) });
}
const s = freshSave();
seedHome(s);
s.coins = 99999;
for (const f of (q.get('floors') ?? 'f1').split(',') as FloorId[]) if (f !== 'f1') unlockFloor(s, f, 99);
const open = q.get('open');
if (open) for (const id of open === 'all' ? [...s.home.boxes] : open.split(',')) openBox(s, id);
if (q.get('wall') && s.home.floors.f1) s.home.floors.f1.wall = q.get('wall')!;
if (q.get('floor') && s.home.floors.f1) s.home.floors.f1.floor = q.get('floor')!;
if (q.get('extra')) for (const [id, x, z, r] of [['cuckoo', 26, 0, 0], ['painting', 31, 0, 0], ['fireplace', -2, -8, 0]] as const) putItem(s, 'f1', { id, x, z, rot: r, wall: id === 'fireplace' ? undefined : 30 });
const sc = new Scene(document.getElementById('c') as HTMLCanvasElement, { species: 'tawny', palette: 'tawny', outfit: {} } as never, (q.get('q') as 'low') ?? 'high');
(window as unknown as { sc: Scene; save: unknown }).sc = sc;
(window as unknown as { save: unknown }).save = s;
/** for staged screenshots: dev.open('f1_cozy') plays the unpacking, dev.unlock('f2') pops the boards */
(window as unknown as { dev: unknown }).dev = {
  s,
  open(id: string) {
    const at = sc.rooms.boxWorld(id)!;
    sc.rooms.openBox(id, () => { const r = openBox(s, id); sc.setHome(s.home); r?.placed.forEach((p, i) => sc.rooms.flyIn(p.uid, at.clone().setY(at.y + 0.7), i * 0.22)); });
  },
  unlock(f: FloorId) { unlockFloor(s, f, 99); sc.setHome(s.home, true); },
};
sc.setZones({ garden: true });
sc.setHome(s.home);
sc.setView((q.get('view') ?? 'home') as View);
if (q.get('hour')) sc.setHour(+q.get('hour')!);
if (q.get('place')) sc.placeOwl(q.get('place') as never);
if (q.get('build')) {
  const f = q.get('build') as FloorId;
  sc.house.setBuildView(f);
  const yaw = +(q.get('yaw') ?? 0), pitch = +(q.get('pitch') ?? 1.25), dist = +(q.get('dist') ?? 16);
  const tgt = sc.house.toWorld(0, 0, 4);
  tgt.y = sc.floorY(f);
  sc.director = () => ({ yaw, pitch, dist, target: tgt, snap: true });
}
sc.snapCamera();
for (let i = 0; i < 60; i++) sc.step(1 / 30, false);
sc.start();
