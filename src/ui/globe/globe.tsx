// The Wide World: where Pip flies at night. A realistic Earth in space (src/world/globe/stage.ts) with a pin on
// each of the twenty real places. Drag to turn the planet; tap a pin and the camera flies down to the place,
// its country lit in gold, and the place view rises: big real photographs, a few friendly facts, the souvenir
// turning in its glass case, how the place opens (or "Explore tonight") and its passport stamp. One button
// ("Earth") flies back up to space. The passport collects a stamp for every place Pip has slept over.
// [globe] OWNED BY THE GLOBE BUILDER. Replaces the old MapPanel (panels.tsx re-exports this as MapPanel).
import { useEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { AREA, AREAS, type Area } from '../../game/catalog.ts';
import { PLACE_INFO } from '../../game/places.ts';
import { areaOpen, save } from '../../game/store.ts';
import { homeGuess } from '../../world/globe/earth.ts';
import { GlobeStage, type GlobePlace, type PinView } from '../../world/globe/stage.ts';
import { b9, brassPlate, leatherFrame as reliefLeather, signBoard } from '../chrome/surfaces.ts';
import { transition } from '../chrome/transition.ts';
import { Px } from '../icons.tsx';
import { haptic, tap } from '../kit.tsx';
import { panel, sceneRef } from '../state.ts';
import { moonIcon, passportCover, passportTile, PIN_H, PIN_W, pinSheet, ringSheet, stampArt, type PinState } from './art.ts';
import './globe.css';
import { PLACE_SAT, SHEET, sheetUrl } from './photos.ts';
import { loadSheet, loadThumbs, photoStamp, thumbsReady } from './placephoto.ts';
import { devScale } from './pix.ts';
import { PlaceView } from './placeview.tsx';
import { nightsAt, startTravel, travelOf } from './travel.ts';

startTravel();

let cssDone = false;
function injectCSS() {
  if (cssDone) return;
  cssDone = true;
  const el = document.createElement('style');
  const k = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
  // physical pieces (ui4's relief surfaces): a carved walnut title sign, brass plates for buttons and tonight's
  // trip, the passport bound in pebbled green leather
  el.textContent = `
.gb .gb-title{${b9(signBoard('walnut'), true)};background:none;color:#fbe3a0}
.gb .gb-plate{${b9(brassPlate(), true)};background:none}
.gb-page{${b9(reliefLeather('emerald', 22))};background:url("${passportTile(2 * k)}") 0 0/64px 64px,#e9e3cf;background-clip:padding-box}
.gb-cover{background-image:url("${passportCover(3 * k)}")}
`;
  document.head.appendChild(el);
}

const isSide = () => innerWidth >= 760 && innerWidth / innerHeight > 1.05;
const home = homeGuess();
const SAT_RECT: [number, number, number, number] = [SHEET.cw, SHEET.ch, SHEET.cw, SHEET.ch];

function pinState(a: Area): PinState {
  const s = save.value;
  if (s.area === a.id) return 'tonight';
  if (!areaOpen(a.id)) return 'locked';
  return nightsAt(s, a.id) > 0 ? 'visited' : 'open';
}
const placeOf = (a: Area): GlobePlace => ({
  id: a.id, lat: a.lat, lon: a.lon, color: a.color, open: areaOpen(a.id), span: PLACE_INFO[a.id]?.span,
  sheet: PLACE_SAT[a.id] ? sheetUrl(a.id) : undefined, sat: PLACE_SAT[a.id], satRect: SAT_RECT,
});

// ------------------------------------------------------------------ the panel

export function GlobePanel() {
  injectCSS();
  const sc = sceneRef.current;
  const s = save.value;
  const [sel, setSel] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [pass, setPass] = useState(false);
  const [ready, setReady] = useState(false);
  const [side, setSide] = useState(isSide());
  const [leaving, setLeaving] = useState(false);
  const stageRef = useRef<GlobeStage | null>(null);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const lblW = useRef(new Map<string, number>()).current;
  const countryRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<string | null>(null);
  const sheetRef = useRef(false);
  const passRef = useRef(false);
  selRef.current = sel;
  sheetRef.current = sheet;
  passRef.current = pass;
  const openCount = AREAS.filter((a) => areaOpen(a.id)).length;
  const visitedCount = Object.keys(travelOf(s).nights).length;
  const px = 2;

  // the stage: up while the panel is open
  useEffect(() => {
    if (!sc) return;
    let st: GlobeStage | null = null;
    try { st = new GlobeStage(sc.renderer, sc.quality); } catch (e) { console.warn('globe failed', e); return; }
    stageRef.current = st;
    st.setPlaces(AREAS.map(placeOf));
    st.setOwl(save.value.look);
    const tonight = AREA[save.value.area];
    st.lookAt(tonight ? tonight.lat * 0.7 + 8 : home.lat * 0.6, tonight ? tonight.lon : home.lon);
    if (tonight) st.setRoute(home, tonight);
    loadThumbs();
    // the globe draws through its own picture chain (full resolution, MSAA, bloom), so the world's steps aside
    const postWas = sc.post.enabled;
    sc.post.enabled = false;
    sc.setStage(st);
    st.onFrame = (pins) => placePins(pins);
    st.onReady = () => setReady(true);
    st.onSpin = (v) => { if (v > 25) sound.play('rustle_grass', { volume: 0.2, rate: 1.4, gap: 300 }); };
    sound.play('tp_shimmer', { volume: 0.25 });
    const onResize = () => setSide(isSide());
    addEventListener('resize', onResize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (passRef.current) setPass(false); else if (selRef.current) pick(null); else close(); }
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    addEventListener('keydown', onKey);
    if (import.meta.env.DEV) (window as unknown as { hhGlobe: unknown }).hhGlobe = { stage: st, pick: (id: string | null) => pick(id), passport: () => setPass(true) };
    return () => {
      removeEventListener('resize', onResize);
      removeEventListener('keydown', onKey);
      if (sc.stage === st) sc.setStage(null);
      sc.post.enabled = postWas;
    };
  }, []);

  // frame the planet round the header and the dock, and the close view round the place card
  useEffect(() => {
    const layout = () => {
      const st = stageRef.current;
      if (!st) return;
      const w = innerWidth, h = innerHeight;
      const top = (document.querySelector('.gb-top') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 90;
      const dockEl = document.querySelector('.gb-dock') as HTMLElement | null;
      const dock = dockEl ? dockEl.getBoundingClientRect().top : h - 110;
      if (isSide()) {
        st.setView(w / 2, (top + dock) / 2, Math.min(w * 0.3, (dock - top) * 0.44));
        const right = w - Math.min(460, w * 0.4) - 28;
        st.setPlaceFrame(right / 2, (top + h) / 2, right);
      } else {
        st.setView(w / 2, (top + dock) / 2, Math.min(w * 0.46, (dock - top) * 0.42));
        st.setPlaceFrame(w / 2, (top + h * 0.4) / 2 + 6, w);
      }
    };
    layout();
    const t1 = setTimeout(layout, 80), t2 = setTimeout(layout, 500);
    addEventListener('resize', layout);
    return () => { clearTimeout(t1); clearTimeout(t2); removeEventListener('resize', layout); };
  }, [side, ready, !!sel]);

  // the route always runs to tonight's place
  useEffect(() => { const st = stageRef.current, t = AREA[s.area]; if (st) st.setRoute(home, t ?? null); }, [s.area]);

  /** pins follow the planet; their name tags only where there is room for them */
  function placePins(pins: PinView[]) {
    const st = stageRef.current!;
    const selId = selRef.current, near = st.closeness;
    if (selId && !sheetRef.current && near > 0.55 && st.flightT > 0.62) { sheetRef.current = true; setSheet(true); }
    type Box = [number, number, number, number];
    const hit = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const order = [...pins].sort((a, b) => rank(b.id) - rank(a.id) || a.depth - b.depth);
    // every visible flag first (a name tag never hides under another place's flag) ...
    const flags = new Map<string, Box>();
    for (const p of order) {
      const el = pinEls.current.get(p.id);
      if (!el) continue;
      if (p.facing < 0.04 || (selId && p.id !== selId && near > 0.4)) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.opacity = String(Math.min(1, (p.facing - 0.04) * 8));
      el.style.transform = `translate(${Math.round(p.x - 3.5 * px)}px,${Math.round(p.y - (PIN_H - 0.5) * px)}px)`;
      el.style.zIndex = String(p.id === selId ? 999 : Math.round((1 - p.depth) * 500));
      flags.set(p.id, [p.x - 8, p.y - PIN_H * px, p.x + 18, p.y]);
    }
    // ... then the name tags, most important first, kept on screen, only where they fit
    const taken: Box[] = [];
    for (const p of order) {
      const el = pinEls.current.get(p.id), lbl = el?.lastElementChild as HTMLElement | null;
      if (!el || !lbl || !flags.has(p.id)) continue;
      let lw = lblW.get(p.id);
      if (!lw) { lw = lbl.offsetWidth; if (lw) lblW.set(p.id, lw); }
      const w = (lw || 80) + 2, h = 20;
      // under the flag, else beside it (right, then left), kept on screen
      const fits = (b: Box) => !taken.some((t) => hit(b, t)) && ![...flags].some(([id, f]) => id !== p.id && hit(b, f));
      const cands: Box[] = [[p.x - w / 2, p.y + 2], [p.x + 13, p.y - 26], [p.x - 9 - w, p.y - 26]].map(([x, y]) => {
        const s = Math.max(4 - x, 0) + Math.min(innerWidth - 4 - (x + w), 0);
        return [x + s, y, x + s + w, y + h] as Box;
      });
      let box: Box | undefined = p.facing > 0.18 ? cands.find(fits) : undefined;
      if (!box && p.id === selId) box = cands[0];
      lbl.style.visibility = box ? 'visible' : 'hidden';
      if (box) {
        lbl.style.left = `${Math.round(box[0] - (p.x - 3.5 * px))}px`;
        lbl.style.top = `${Math.round(box[1] - (p.y - (PIN_H - 0.5) * px))}px`;
        taken.push(box);
      }
    }
    // the country's name floats over it in the close view
    const c = countryRef.current;
    if (c) {
      const info = selId ? st.country(selId) : null;
      if (info && near > 0.45) {
        const q = st.project(info.lat, info.lon, 1.01);
        c.style.display = q.facing > 0 ? '' : 'none';
        c.style.opacity = String(Math.min(1, (near - 0.45) * 4));
        if (c.textContent !== info.name) c.textContent = info.name;
        // kept inside the clear part of the screen (never under the card or the header)
        const W = innerWidth, H = innerHeight, cw = c.offsetWidth, ch = c.offsetHeight;
        const right = isSide() ? W - Math.min(460, W * 0.4) - 28 : W, bottom = isSide() ? H : H * 0.41;
        const x = Math.max(cw / 2 + 8, Math.min(right - cw / 2 - 8, q.x)), y = Math.max(70 + ch / 2, Math.min(bottom - ch / 2 - 8, q.y));
        c.style.transform = `translate(${Math.round(x - cw / 2)}px,${Math.round(y - ch / 2)}px)`;
      } else c.style.display = 'none';
    }
  }
  function rank(id: string) {
    if (id === selRef.current) return 9;
    const a = AREA[id];
    if (!a) return 0;
    return a.id === save.value.area ? 8 : areaOpen(a.id) ? 5 : 2;
  }

  function pick(id: string | null) {
    const st = stageRef.current;
    if (id === selRef.current) return;
    const a = id ? AREA[id] : null;
    setSel(a?.id ?? null);
    selRef.current = a?.id ?? null;
    setSheet(false);
    sheetRef.current = false;
    if (a) {
      loadSheet(a.id);
      st?.focus(placeOf(a));
      tap('paper_flip', 0.4);
      sound.play('wings_flutter', { volume: 0.3, rate: 1.1 });
      sound.play('tp_shimmer', { volume: 0.18, rate: 1.2 });
      haptic(10);
    } else {
      st?.focus(null);
      tap('ui_back', 0.4);
      sound.play('wings_flutter', { volume: 0.22, rate: 0.9 });
    }
  }
  function step(d: number) {
    const i = AREAS.findIndex((a) => a.id === (selRef.current ?? save.value.area));
    pick(AREAS[(i + d + AREAS.length) % AREAS.length].id);
  }
  function close() {
    if (leaving) return;
    setLeaving(true);
    tap('ui_close', 0.5);
    void transition('stars', () => { const st = stageRef.current; if (sc && st && sc.stage === st) { sc.setStage(null); sc.post.enabled = true; } panel.value = null; }, { speed: 1.3 });
  }

  const a = sel ? AREA[sel] : null;
  const tonight = AREA[s.area];
  const dev = devScale(px);
  return (
    <div class={'gb' + (side ? ' side' : ' tall') + (a ? ' placing' : '') + (sheet ? ' has-sheet' : '')} style={{ '--k': `${px}px` } as Record<string, string>}>
      <div class="gb-pins">
        {AREAS.map((ar) => {
          const stt = pinState(ar);
          const on = sel === ar.id;
          return (
            <button key={ar.id} class={'gb-pin ' + stt + (on ? ' on' : '')} ref={(el) => { if (el) pinEls.current.set(ar.id, el); else pinEls.current.delete(ar.id); }}
              style={{ width: `${PIN_W * px}px`, height: `${PIN_H * px}px`, display: 'none' }} aria-label={ar.title} onClick={(e) => { e.stopPropagation(); pick(ar.id); }}>
              {on && <i class="gb-ring" style={{ backgroundImage: `url(${ringSheet(dev)})`, width: `${17 * px}px`, height: `${7 * px}px`, backgroundSize: `${34 * px}px ${7 * px}px`, left: `${-4.5 * px}px`, top: `${(PIN_H - 4) * px}px` }} />}
              <i class="gb-flag" style={{ backgroundImage: `url(${pinSheet(ar.color, stt, dev)})`, backgroundSize: `${PIN_W * 2 * px}px ${PIN_H * px}px`, animationDelay: `${-(ar.lon + 180) / 90}s` }} />
              <span class={'gb-lbl ' + stt}>{ar.title.replace(/^The /, '')}</span>
            </button>
          );
        })}
      </div>
      <div class="gb-country" ref={countryRef} style={{ display: 'none' }} />

      <header class="gb-top">
        {a ? (
          <button class="gb-plate gb-back" onClick={() => pick(null)} aria-label="Back to space"><Px name="arrow_left" size={22} /><span>Earth</span></button>
        ) : (
          <button class="gb-plate gb-back" onClick={close} aria-label="Back home"><Px name="arrow_left" size={22} /><span>Home</span></button>
        )}
        {!a && (
          <div class="gb-title">
            <b>The Wide World</b>
            <small>{openCount} of {AREAS.length} places open · {visitedCount} stamped</small>
          </div>
        )}
        <button class="gb-passbtn" onClick={() => { tap('paper_flip', 0.5); setPass(true); }} aria-label="Passport">
          <i style={{ backgroundImage: `url(${passportCover(Math.max(1, Math.round(dev / 2)))})` }} />
          <span>Passport</span>
        </button>
      </header>

      {!a && (
        <footer class="gb-dock">
          <button class="gb-plate gb-arrow" onClick={() => step(-1)} aria-label="Previous place"><Px name="arrow_left" size={24} /></button>
          <button class="gb-plate gb-tonight" onClick={() => tonight && pick(tonight.id)}>
            <img src={moonIcon(devScale(3))} alt="" />
            <span><small>Tonight Pip flies to</small><b>{tonight?.title ?? 'somewhere new'}</b></span>
          </button>
          <button class="gb-plate gb-arrow" onClick={() => step(1)} aria-label="Next place"><Px name="arrow_right" size={24} /></button>
          <p class="gb-hint">Drag to turn the Earth · tap a place to fly there</p>
        </footer>
      )}
      {!ready && <div class="gb-loading"><img src={moonIcon(devScale(3))} alt="" /><span>Loading the Earth…</span></div>}

      {a && <PlaceView a={a} shown={sheet} side={side} onBack={() => pick(null)} onStep={step} />}
      {pass && <Passport onClose={() => { tap('paper_flip', 0.4); setPass(false); }} onPick={(id) => { setPass(false); setTimeout(() => pick(id), 120); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ the passport

function Passport(p: { onClose: () => void; onPick: (id: string) => void }) {
  const s = save.value;
  const k = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
  const log = travelOf(s);
  const stamped = AREAS.filter((a) => log.nights[a.id]).length;
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setOpen(true); sound.play('paper_flip', { volume: 0.5 }); }, 380); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (!open || !stamped) return;
    const ts = Array.from({ length: Math.min(stamped, 6) }, (_, i) => setTimeout(() => sound.play('stamp', { volume: 0.35, rate: 0.95 + i * 0.04 }), 480 + i * 140));
    return () => ts.forEach(clearTimeout);
  }, [open]);
  void thumbsReady.value;
  return (
    <div class="gb-passport" onClick={p.onClose}>
      <div class={'gb-book' + (open ? ' open' : '')} onClick={(e) => e.stopPropagation()}>
        <div class="gb-cover" />
        <div class="gb-page">
          <header>
            <small>Hoot Hollow · Passport of</small>
            <b>{s.name}</b>
            <span>{stamped} of {AREAS.length} stamps · {Object.values(log.nights).reduce((t, e) => t + e.n, 0)} nights abroad</span>
            <button class="gb-close" onClick={p.onClose} aria-label="Close passport"><Px name="cross" size={20} /></button>
          </header>
          <div class="gb-stamps">
            {AREAS.map((a, i) => {
              const e = log.nights[a.id];
              const st = e ? 'visited' : areaOpen(a.id) ? 'open' : 'locked';
              return (
                <button class={'gb-st ' + st} style={{ '--d': `${i * 30}ms`, '--r': `${((i * 37) % 7) - 3}px` } as Record<string, string>} onClick={() => { tap('ui_tap', 0.4); p.onPick(a.id); }} title={a.title}>
                  <img src={photoStamp(a, { date: e?.first, state: st, seed: i + 3 }, 2 * k) ?? stampArt(a, { date: e?.first, state: st, seed: i + 3 }, 2 * k)} alt="" draggable={false} />
                  <span>{a.title.replace(/^The /, '')}</span>
                  {st === 'locked' && <small>Level {a.level}</small>}
                  {e && <small>{e.n} {e.n === 1 ? 'night' : 'nights'}</small>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
