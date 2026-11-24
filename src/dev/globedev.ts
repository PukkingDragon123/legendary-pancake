// [globe] Dev page for the globe stage on its own. Query: focus=<place id>, hours=<shift the sun by hours>,
// lat & lon=<point the space view>, route=<place id>, low=1 (no MSAA), noowl=1.
import * as THREE from 'three';
import { AREAS } from '../game/catalog.ts';
import { PLACE_INFO } from '../game/places.ts';
import { PLACE_SAT, SHEET, sheetUrl } from '../ui/globe/photos.ts';
import { GlobeStage, globeClock, type GlobePlace } from '../world/globe/stage.ts';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: false });
r.setPixelRatio(Math.min(2, devicePixelRatio));
r.setSize(innerWidth, innerHeight, false);
r.outputColorSpace = THREE.SRGBColorSpace;
globeClock.offset = Number(q.get('hours') ?? 0) * 3600e3;
const st = new GlobeStage(r, q.get('low') ? 'low' : 'high');
const places: GlobePlace[] = AREAS.map((a) => ({
  id: a.id, lat: a.lat, lon: a.lon, color: a.color, open: a.level <= 3, span: PLACE_INFO[a.id]?.span,
  sheet: PLACE_SAT[a.id] ? sheetUrl(a.id) : undefined, sat: PLACE_SAT[a.id], satRect: [SHEET.cw, SHEET.ch, SHEET.cw, SHEET.ch],
}));
st.setPlaces(places);
if (!q.get('noowl')) st.setOwl({ skin: 'owl', species: 'tawny', palette: 'tawny', outfit: { head: 'nightcap' } } as never);
st.resize(innerWidth, innerHeight);
const portrait = innerWidth < innerHeight;
st.setView(innerWidth / 2, innerHeight * (portrait ? 0.45 : 0.5), Math.min(innerWidth * 0.42, innerHeight * 0.36));
st.setPlaceFrame(portrait ? innerWidth / 2 : innerWidth * 0.34, portrait ? innerHeight * 0.24 : innerHeight / 2, portrait ? innerWidth : innerWidth * 0.62);
if (q.get('lat')) st.lookAt(Number(q.get('lat')), Number(q.get('lon') ?? 0));
const win = window as unknown as { landed: boolean; ready: boolean; st: GlobeStage };
const f = q.get('focus');
if (f) setTimeout(() => st.focus(places.find((p) => p.id === f) ?? null, () => { win.landed = true; }), 300);
if (q.get('route')) st.setRoute({ lat: 51.5, lon: -0.1 }, AREAS.find((a) => a.id === q.get('route'))!);
addEventListener('resize', () => { r.setSize(innerWidth, innerHeight, false); st.resize(innerWidth, innerHeight); });
for (const t of ['down', 'move', 'up'] as const) canvas.addEventListener('pointer' + t, (e) => { const pe = e as PointerEvent; st.pointer(t, pe.clientX, pe.clientY, new THREE.Ray(), pe); });
let last = performance.now();
const fixed = q.get('fixed') ? Number(q.get('fixed')) : 0;
const loop = () => {
  requestAnimationFrame(loop);
  const t = performance.now(), dt = (t - last) / 1000; last = t;
  st.update(fixed || dt, t / 1000);
  r.render(st.scene, st.camera);
};
loop();
st.onReady = () => { win.ready = true; };
win.st = st;
