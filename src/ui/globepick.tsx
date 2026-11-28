// Choosing tonight's place on the real Earth (the bedtime journey's fourth step, ui/sleepflow.tsx): pins on the planet,
// postcards of the places along the bottom, and the flight's start.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { AREA, AREAS, type Area } from '../game/catalog.ts';
import { areaOpen, edit, save } from '../game/store.ts';
import { PLACE_INFO } from '../game/places.ts';
import { homeGuess } from '../world/globe/earth.ts';
import { GlobeStage, type GlobePlace, type PinView } from '../world/globe/stage.ts';
import type { OwlLook } from '../owl/model.ts';
import { PLACE_SAT, SHEET, sheetUrl } from './globe/photos.ts';
import { loadThumbs, thumbStyle, thumbsReady } from './globe/placephoto.ts';
import { Px } from './icons.tsx';
import { tap, toast } from './kit.tsx';
import { sceneRef } from './state.ts';

const home = homeGuess();
const tripLook = (l: OwlLook): OwlLook => ({ ...l, outfit: { ...(l.outfit ?? {}), back: 'backpack' } });

function placeOf(a: Area): GlobePlace {
  return { id: a.id, lat: a.lat, lon: a.lon, color: a.color, open: areaOpen(a.id), span: PLACE_INFO[a.id]?.span, sheet: PLACE_SAT[a.id] ? sheetUrl(a.id) : undefined, sat: PLACE_SAT[a.id], satRect: [SHEET.cw, SHEET.ch, SHEET.cw, SHEET.ch] };
}

// ------------------------------------------------------------------ choosing tonight's place on the real Earth

export function GlobePick(p: { onBack: () => void; onGo: () => void }) {
  const sc = sceneRef.current;
  const s = save.value;
  const [sel, setSel] = useState<string>(s.area);
  const [ready, setReady] = useState(false);
  const stageRef = useRef<GlobeStage | null>(null);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const rail = useRef<HTMLDivElement>(null);
  const places = useMemo(() => [...AREAS].sort((a, b) => Number(areaOpen(b.id)) - Number(areaOpen(a.id)) || a.level - b.level), []);
  thumbsReady.value;

  useEffect(() => {
    if (!sc) return undefined;
    let st: GlobeStage | null = null;
    try { st = new GlobeStage(sc.renderer, sc.quality); } catch (e) { console.warn('globe failed', e); return undefined; }
    stageRef.current = st;
    st.setPlaces(AREAS.map(placeOf));
    st.setOwl(tripLook(save.value.look));
    const t = AREA[save.value.area];
    st.lookAt(t ? t.lat * 0.7 + 8 : home.lat * 0.6, t ? t.lon : home.lon);
    if (t) st.setRoute(home, t);
    loadThumbs();
    const postWas = sc.post.enabled;
    sc.post.enabled = false;
    sc.setStage(st);
    st.resize(innerWidth, innerHeight);
    const layout = () => { const w = innerWidth, h = innerHeight, bottom = h - Math.min(250, h * 0.36); st!.setView(w / 2, (78 + bottom) / 2, Math.min(w * 0.42, (bottom - 78) * 0.44)); };
    layout();
    addEventListener('resize', layout);
    st.onFrame = (pins) => placePins(pins);
    st.onReady = () => setReady(true);
    st.onSpin = (v) => { if (v > 25) sound.play('globe_spin', { volume: 0.15, gap: 600 }); };
    sound.play('tp_shimmer', { volume: 0.25 });
    return () => { removeEventListener('resize', layout); if (sc.stage === st) sc.setStage(null); sc.post.enabled = postWas; };
  }, []);

  function placePins(pins: PinView[]) {
    for (const pv of pins) {
      const el = pinEls.current.get(pv.id);
      if (!el) continue;
      if (pv.facing < 0.05) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.opacity = String(Math.min(1, (pv.facing - 0.05) * 6));
      el.style.transform = `translate(${Math.round(pv.x)}px, ${Math.round(pv.y)}px)`;
      el.style.zIndex = String(Math.round((1 - pv.depth) * 500));
    }
  }

  function choose(id: string, from: 'pin' | 'card') {
    const a = AREA[id];
    if (!a) return;
    if (!areaOpen(id)) { tap('ui_error', 0.4); toast(`${a.title} opens at level ${a.level}${a.streak ? ` and a ${a.streak}-night streak` : ''}.`); return; }
    tap('pin_tap', 0.5);
    setSel(id);
    const st = stageRef.current;
    if (st) { st.setRoute(home, a); st.lookAt(a.lat * 0.7 + 6, a.lon); }
    if (from === 'pin') rail.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  function go() {
    tap('ui_confirm', 0.6);
    sound.play('owl_wing', { volume: 0.5 });
    edit((x) => { x.area = sel; });
    p.onGo();
  }
  const a = AREA[sel];
  return (
    <div class={'bd bd-globe' + (ready ? ' ready' : '')} role="dialog" aria-label="Choose tonight's place">
      <header class="bd-top">
        <button class="bd-back" aria-label="Back to the bedroom" onClick={() => { tap('ui_back', 0.5); p.onBack(); }}><Px name="arrow_left" size={30} /></button>
        <div class="bd-title hh-wood-sm"><span class="bd-kicker">Tonight’s flight</span><h1>Where to?</h1></div>
      </header>
      <div class="bd-pins">
        {AREAS.map((x) => {
          const open = areaOpen(x.id);
          return <button key={x.id} ref={(el) => { if (el) pinEls.current.set(x.id, el); }} class={'bd-pin' + (open ? '' : ' locked') + (sel === x.id ? ' sel' : '')} style={{ '--c': x.color } as Record<string, string>} onClick={() => choose(x.id, 'pin')} aria-label={x.title}>
            <i /><span>{x.title.replace(/^The /, '')}</span>
          </button>;
        })}
      </div>
      <div class="bd-rail" ref={rail}>
        {places.map((x) => {
          const open = areaOpen(x.id);
          return (
            <button key={x.id} data-id={x.id} class={'bd-place' + (open ? '' : ' locked') + (sel === x.id ? ' sel' : '')} onClick={() => choose(x.id, 'card')}>
              <span class="ph" style={thumbStyle(x.id, 148)} />
              <span class="tx"><b>{x.title}</b><small>{open ? x.country : `Level ${x.level}${x.streak ? ` · ${x.streak}-night streak` : ''}`}</small></span>
              {!open && <span class="lk"><Px name="lock" size={30} /></span>}
            </button>
          );
        })}
      </div>
      <footer class="bd-foot">
        <button class="bd-go btn pillow night" onClick={go} disabled={!a || !areaOpen(sel)}>
          <span class="bd-go-moon" aria-hidden="true" />
          <span class="bd-go-txt"><b>Fly to {a?.title ?? '…'}</b><small>{a ? `${a.country} · a five-minute breathing flight` : ''}</small></span>
        </button>
      </footer>
    </div>
  );
}

