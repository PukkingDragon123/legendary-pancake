import { Scene, type View } from '../world/scene.ts';
const q = new URLSearchParams(location.search);
const sc = new Scene(document.getElementById('c') as HTMLCanvasElement, { palette: q.get('pal') ?? 'tabby', outfit: q.get('outfit') ? JSON.parse(q.get('outfit')!) : {} }, (q.get('tier') as 'high' | 'medium' | 'low' | 'auto' | null) ?? 'high');
(window as any).sc = sc;
// [look4] preview the weather and the season: ?wx=clear|clouds|rain|storm|snow|fog&season=spring|summer|autumn|winter
if (q.get('wx')) sc.weather.set(q.get('wx') as any);
if (q.get('season')) sc.weather.setSeason(q.get('season') as any, +(q.get('st') ?? 0.5));
if (q.get('hour')) sc.setHour(+q.get('hour')!);
sc.setZones({ loft: !!q.get('loft'), deck: !!q.get('deck'), garden: !!q.get('garden') });
sc.setFurniture({ g_back: 'nestbed', g_left: 'moonlamp', g_right: 'bookshelf', g_mid: 'roundrug', w_back: 'cuckoo', g_frontL: 'fernpot', l_left: 'armchair', l_right: 'telescope' });
sc.setView((q.get('view') ?? 'home') as View);
if (q.get('place')) sc.placeOwl(q.get('place') as any);
if (q.get('hour')) sc.setHour(+q.get('hour')!);
if (q.get('decor')) sc.setDecorating(true);
sc.snapCamera();
for (let i = 0; i < 60; i++) sc.step(1 / 30, false);
sc.start();
// [look4] preview a stage through the world's post chain: ?stage=shop|office|globe
const stage = q.get('stage');
if (stage === 'shop') void import('../world/stages/lodge.ts').then(({ Lodge }) => { const b = new Lodge([]); b.attach(sc.renderer, sc as never); sc.setStage(b); (window as any).stage = b; }); // [shop4] the lodge store
if (stage === 'office') void import('../onboard/room.ts').then(({ InterviewRoom }) => { const r = new InterviewRoom({ palette: 'tawny', outfit: {} } as never, 'high', sc); sc.setStage(r); (window as any).stage = r; });
if (stage === 'globe') void import('../world/globe/stage.ts').then(({ GlobeStage }) => { const g = new GlobeStage(sc.renderer); g.setPlaces([]); sc.setStage(g); (window as any).stage = g; });
