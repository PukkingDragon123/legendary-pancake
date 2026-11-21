// Dev preview of the hollow oak: ?hour=21&view=home&floors=f1,f2&open=all&q=low&build=f1&yaw=0.5
// `open=all` unpacks every box; `open=f1_pip,f1_cozy` just those; `stack=1` adds a lamp on a table.
import { Scene, type View } from '../world/scene.ts';
import { freshSave } from '../game/store.ts';
import { openBox, putItem, seedHome, unlockFloor } from '../game/home.ts';
import type { FloorId } from '../world/house/plan.ts';

const q = new URLSearchParams(location.search);
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
