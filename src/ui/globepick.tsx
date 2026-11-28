// Choosing tonight's place on the real Earth (the bedtime journey's fourth step, ui/sleepflow.tsx): pins on the planet,
// postcards of the places along the bottom, and the flight's start. [postcard] Tap a pin or a card and the camera flies
// down to the place, its country lights up and the place card slides in (globe/placecard.tsx): photos, the time
// there now, the loot, the postcard you unlock and some true facts; "Fly here tonight" starts the flight from there.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { AREA, AREAS, type Area } from '../game/catalog.ts';
import { areaOpen, edit, save } from '../game/store.ts';
import { PLACE_INFO } from '../game/places.ts';
import { hasPostcard } from '../game/postcards.ts';
import { homeGuess } from '../world/globe/earth.ts';
import { GlobeStage, type GlobePlace, type PinView } from '../world/globe/stage.ts';
import type { OwlLook } from '../owl/model.ts';
import { PLACE_SAT, SHEET, sheetUrl } from './globe/photos.ts';
import { loadSheet, loadThumbs, thumbStyle, thumbsReady } from './globe/placephoto.ts';
import { PlaceCard } from './globe/placecard.tsx';
import { textSafe } from './font.ts';
import { Px } from './icons.tsx';
import { haptic, tap } from './kit.tsx';
import { sceneRef } from './state.ts';
import './globepick.css';

const home = homeGuess();
const tripLook = (l: OwlLook): OwlLook => ({ ...l, outfit: { ...(l.outfit ?? {}), back: 'backpack' } });
/** wide screens get the place card on the right, phones a sheet from the bottom (matches placecard.css) */
const isSide = () => innerWidth >= 760 && innerWidth / innerHeight >= 21 / 20;
const cardW = () => Math.min(480, innerWidth * 0.42);

function placeOf(a: Area): GlobePlace {
  return { id: a.id, lat: a.lat, lon: a.lon, color: a.color, open: areaOpen(a.id), span: PLACE_INFO[a.id]?.span, sheet: PLACE_SAT[a.id] ? sheetUrl(a.id) : undefined, sat: PLACE_SAT[a.id], satRect: [SHEET.cw, SHEET.ch, SHEET.cw, SHEET.ch] };
}

// ------------------------------------------------------------------ choosing tonight's place on the real Earth

export function GlobePick(p: { onBack: () => void; onGo: () => void }) {
  const sc = sceneRef.current;
  const s = save.value;
  const [sel, setSel] = useState<string>(s.area);
  /** the place the camera is down at (null: the whole planet) */
  const [zoom, setZoom] = useState<string | null>(null);
  const [card, setCard] = useState(false);
  const [ready, setReady] = useState(false);
  const stageRef = useRef<GlobeStage | null>(null);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const countryRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<string | null>(null);
  const cardRef = useRef(false);
  const rail = useRef<HTMLDivElement>(null);
  const selRef = useRef(sel);
  const cardTimer = useRef(0);
  zoomRef.current = zoom;
  cardRef.current = card;
  selRef.current = sel;
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
    // the planet between the title and the cards; the close view in the part of the screen the place card leaves clear
    const layout = () => {
      const w = innerWidth, h = innerHeight, bottom = h - Math.min(250, h * 0.36);
      st!.setView(w / 2, (78 + bottom) / 2, Math.min(w * 0.42, (bottom - 78) * 0.44));
      if (isSide()) { const right = w - cardW() - 32; st!.setPlaceFrame(right / 2, h / 2 + 20, right); }
      else { const clear = h - Math.min(h * 0.66, 720) - 6; st!.setPlaceFrame(w / 2, (70 + clear) / 2 + 4, w); }
    };
    layout();
    addEventListener('resize', layout);
    st.onFrame = (pins) => placePins(pins);
    st.onReady = () => setReady(true);
    st.onSpin = (v) => { if (v > 25) sound.play('globe_spin', { volume: 0.15, gap: 600 }); };
    sound.play('tp_shimmer', { volume: 0.25 });
    const onKey = (e: KeyboardEvent) => {
      if (!zoomRef.current) return;
      if (e.key === 'Escape') { e.stopPropagation(); back(); }
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    addEventListener('keydown', onKey, true);
    if (import.meta.env.DEV) (window as unknown as { hhPick: unknown }).hhPick = { stage: st, choose: (id: string) => choose(id, 'pin'), back: () => back() };
    return () => { clearTimeout(cardTimer.current); removeEventListener('resize', layout); removeEventListener('keydown', onKey, true); if (sc.stage === st) sc.setStage(null); sc.post.enabled = postWas; };
  }, []);

  function placePins(pins: PinView[]) {
    const st = stageRef.current;
    const z = zoomRef.current, near = st?.closeness ?? 0;
    // the card slides in as the camera arrives
    if (st && z && !cardRef.current && near > 0.5 && st.flightT > 0.6) { cardRef.current = true; setCard(true); }
    for (const pv of pins) {
      const el = pinEls.current.get(pv.id);
      if (!el) continue;
      if (pv.facing < 0.05 || (z && pv.id !== z && near > 0.35)) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.opacity = String(Math.min(1, (pv.facing - 0.05) * 6));
      el.style.transform = `translate(${Math.round(pv.x)}px, ${Math.round(pv.y)}px)`;
      el.style.zIndex = String(pv.id === z ? 999 : Math.round((1 - pv.depth) * 500));
    }
    // the lit country's name floats over it in the close view
    const c = countryRef.current;
    if (!c || !st) return;
    const info = z ? st.country(z) : null;
    if (info && near > 0.45) {
      const q = st.project(info.lat, info.lon, 1.01);
      c.style.display = q.facing > 0 ? '' : 'none';
      c.style.opacity = String(Math.min(1, (near - 0.45) * 4));
      const nm = textSafe(info.name);
      if (c.textContent !== nm) c.textContent = nm;
      const W = innerWidth, H = innerHeight, cw = c.offsetWidth, ch = c.offsetHeight;
      const right = isSide() ? W - cardW() - 32 : W, bottom = isSide() ? H : H - Math.min(H * 0.66, 720) - 6;
      const x = Math.max(cw / 2 + 8, Math.min(right - cw / 2 - 8, q.x)), y = Math.max(76 + ch / 2, Math.min(bottom - ch / 2 - 8, q.y));
      c.style.transform = `translate(${Math.round(x - cw / 2)}px,${Math.round(y - ch / 2)}px)`;
    } else c.style.display = 'none';
  }

  /** fly down to a place and open its card (locked places too: their card says how they open) */
  function choose(id: string, from: 'pin' | 'card') {
    const a = AREA[id];
    if (!a) return;
    const st = stageRef.current;
    if (zoomRef.current === a.id) return;
    tap('pin_tap', 0.5);
    sound.play('wings_flutter', { volume: 0.3, rate: 1.1 });
    haptic(10);
    if (areaOpen(a.id)) { setSel(a.id); selRef.current = a.id; }
    zoomRef.current = a.id;
    setZoom(a.id);
    cardRef.current = false;
    setCard(false);
    loadSheet(a.id);
    if (st) { if (areaOpen(a.id)) st.setRoute(home, a); st.focus(placeOf(a)); }
    // the card comes as the camera arrives, or after a moment anyway (a slow device's flight)
    clearTimeout(cardTimer.current);
    cardTimer.current = window.setTimeout(() => { if (zoomRef.current === a.id && !cardRef.current) { cardRef.current = true; setCard(true); } }, st ? 1600 : 0);
    if (from === 'pin') rail.current?.querySelector(`[data-id="${a.id}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  /** back up to the whole planet */
  function back() {
    if (!zoomRef.current) return;
    tap('ui_back', 0.4);
    sound.play('wings_flutter', { volume: 0.22, rate: 0.9 });
    zoomRef.current = null;
    setZoom(null);
    cardRef.current = false;
    setCard(false);
    const st = stageRef.current;
    st?.focus(null);
    const t = AREA[selRef.current];
    if (st && t) st.setRoute(home, t);
  }
  function step(d: number) {
    const i = places.findIndex((a) => a.id === (zoomRef.current ?? selRef.current));
    choose(places[(i + d + places.length) % places.length].id, 'pin');
  }
  function go(id = sel) {
    if (!areaOpen(id)) return;
    tap('ui_confirm', 0.6);
    sound.play('owl_wing', { volume: 0.5 });
    edit((x) => { x.area = id; });
    p.onGo();
  }
  const a = AREA[sel];
  const z = zoom ? AREA[zoom] : null;
  return (
    <div class={'bd bd-globe gp' + (ready ? ' ready' : '') + (z ? ' gp-zoom' : '')} role="dialog" aria-label="Choose tonight's place">
      <div class="bd-pins">
        {AREAS.map((x) => {
          const open = areaOpen(x.id);
          return <button key={x.id} ref={(el) => { if (el) pinEls.current.set(x.id, el); }} class={'bd-pin' + (open ? '' : ' locked') + (sel === x.id ? ' sel' : '') + (zoom === x.id ? ' zoom' : '') + (hasPostcard(s, x.id) ? ' card' : '')} style={{ '--c': x.color } as Record<string, string>} onClick={() => choose(x.id, 'pin')} aria-label={x.title}>
            <i /><span>{x.title.replace(/^The /, '')}</span>
          </button>;
        })}
      </div>
      <div class="gp-country" ref={countryRef} style={{ display: 'none' }} />
      <header class="bd-top">
        <button class="bd-back" aria-label={z ? 'Back to the planet' : 'Back to the bedroom'} onClick={() => { if (z) back(); else { tap('ui_back', 0.5); p.onBack(); } }}><Px name="arrow_left" size={30} /></button>
        <div class="bd-title hh-wood-sm"><span class="bd-kicker">Tonight’s flight</span><h1>{z ? z.title.replace(/^The /, '') : 'Where to?'}</h1></div>
      </header>
      <div class="bd-rail" ref={rail} aria-hidden={z ? 'true' : undefined}>
        {places.map((x) => {
          const open = areaOpen(x.id);
          return (
            <button key={x.id} data-id={x.id} class={'bd-place' + (open ? '' : ' locked') + (sel === x.id ? ' sel' : '')} onClick={() => choose(x.id, 'card')} tabIndex={z ? -1 : 0}>
              <span class="ph" style={thumbStyle(x.id, 148)} />
              <span class="tx"><b>{x.title}</b><small>{open ? x.country : `Level ${x.level}${x.streak ? ` · ${x.streak}-night streak` : ''}`}</small></span>
              {!open && <span class="lk"><Px name="lock" size={30} /></span>}
              {hasPostcard(s, x.id) && <span class="gp-got" title="Postcard collected"><Px name="check" size={14} /></span>}
            </button>
          );
        })}
      </div>
      <p class="gp-hint">Tap a place to fly down and see what Pip could find there</p>
      <footer class="bd-foot">
        <button class="bd-go btn pillow night" onClick={() => go()} disabled={!a || !areaOpen(sel)}>
          <span class="bd-go-moon" aria-hidden="true" />
          <span class="bd-go-txt"><b>Fly to {a?.title ?? '…'}</b><small>{a ? `${a.country} · a five-minute breathing flight` : ''}</small></span>
        </button>
      </footer>
      {z && <PlaceCard a={z} shown={card} onBack={back} onGo={() => go(z.id)} onStep={step} />}
    </div>
  );
}
