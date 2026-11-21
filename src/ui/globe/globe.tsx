// The Wide World: where Pip flies at night. A pixel-art globe on its stand (src/world/globe/stage.ts) with a
// waving flag on each of the twenty real places. Drag to spin, tap a flag to fly there and read its postcard
// (illustration, local time, souvenirs found and still to find, nights spent, unlock state, "Explore
// tonight"). The passport collects an ink stamp for every place Pip has slept over.
// [globe] OWNED BY THE GLOBE BUILDER. Replaces the old MapPanel (panels.tsx re-exports this as MapPanel).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { AREA, AREAS, ITEM_BY_ID, type Area } from '../../game/catalog.ts';
import { areaOpen, edit, level, save } from '../../game/store.ts';
import { homeGuess, isNightAt, localTime } from '../../world/globe/earth.ts';
import { GlobeStage, type PinView } from '../../world/globe/stage.ts';
import { souvenirIcon, SOUVENIR_INFO } from '../../assets/souvenirs.ts';
import { transition } from '../chrome/transition.ts';
import { uiBurst, uiBurstAt } from '../chrome/uifx.ts';
import { Px } from '../icons.tsx';
import { haptic, tap, toast } from '../kit.tsx';
import { frameStyle } from '../px/frames.js';
import { panel, sceneRef } from '../state.ts';
import { homeSprite, inkFrame, moonIcon, padlock, paperFrame, paperTile, passportCover, passportTile, PIN_H, PIN_W, pinSheet, postageStamp, postmark, ringSheet, stampArt, type PinState } from './art.ts';
import './globe.css';
import { devScale } from './pix.ts';
import { postcardArt } from './postcards.ts';
import { nightsAt, startTravel, travelOf } from './travel.ts';

startTravel();

let cssDone = false;
function injectCSS() {
  if (cssDone) return;
  cssDone = true;
  const el = document.createElement('style');
  const k = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
  el.textContent = `
.gb-board{border-style:solid;border-width:9px;border-image:url("${inkFrame(3 * k)}") ${7 * 3 * k} / 9px round;background:url("${paperTile(2 * k, 0xeae0c8)}") 0 0/48px 48px,#eae0c8;background-clip:padding-box;color:#2e2b24}
.gb-card{border-style:solid;border-width:10px;border-image:url("${paperFrame(2 * k)}") ${5 * 2 * k} / 10px round;background:url("${paperTile(2 * k)}") 0 0/48px 48px,#f4eedd;background-clip:padding-box}
.gb-page{background:url("${passportTile(2 * k)}") 0 0/64px 64px,#e9e3cf}
.gb-cover{background-image:url("${passportCover(3 * k)}")}
`;
  document.head.appendChild(el);
}

const isSide = () => innerWidth >= 760 && innerWidth / innerHeight > 1.05;
const home = homeGuess();

function pinState(a: Area): PinState {
  const s = save.value;
  if (s.area === a.id) return 'tonight';
  if (!areaOpen(a.id)) return 'locked';
  return nightsAt(s, a.id) > 0 ? 'visited' : 'open';
}

function requirement(a: Area): string {
  const s = save.value, L = level.value.level;
  const parts: string[] = [];
  if (L < a.level) parts.push(`reach level ${a.level}`);
  if ((a.streak ?? 0) > s.bestStreak) parts.push(`sleep ${a.streak} good nights in a row`);
  return parts.length ? parts.join(' and ') : '';
}

// ------------------------------------------------------------------ the panel

export function GlobePanel() {
  injectCSS();
  const sc = sceneRef.current;
  const s = save.value;
  const [sel, setSel] = useState<string | null>(null);
  const [pass, setPass] = useState(false);
  const [side, setSide] = useState(isSide());
  const [px, setPx] = useState(2);
  const [leaving, setLeaving] = useState(false);
  const stageRef = useRef<GlobeStage | null>(null);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const cardRef = useRef<HTMLDivElement>(null);
  const openCount = AREAS.filter((a) => areaOpen(a.id)).length;
  const visitedCount = Object.keys(travelOf(s).nights).length;

  // the stage: up while the panel is open
  useEffect(() => {
    if (!sc) return;
    let st: GlobeStage | null = null;
    try { st = new GlobeStage(sc.renderer); } catch (e) { console.warn('globe failed', e); return; }
    stageRef.current = st;
    st.setPlaces([...AREAS.map((a) => ({ id: a.id, lat: a.lat, lon: a.lon })), { id: '@home', lat: home.lat, lon: home.lon }]);
    st.setOwl(save.value.look);
    const tonight = AREA[save.value.area];
    if (tonight) { st.spin = spinFor(st, tonight); st.setRoute(home, tonight); }
    sc.setStage(st);
    setPx(st.px);
    st.onFrame = (pins) => placePins(pins, st!.px);
    st.onTap = (id) => { if (id && id !== '@home') pick(id); else if (!id) { /* empty sky: keep the card */ } };
    st.onSpin = (v) => { if (v > 1.2) sound.play('rustle_grass', { volume: 0.25, rate: 1.4, gap: 300 }); };
    sound.play('amb_wind', { volume: 0.12 });
    const onResize = () => { setSide(isSide()); setPx(st!.px); };
    addEventListener('resize', onResize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (pass) setPass(false); else if (selRef.current) pick(null); else close(); }
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    addEventListener('keydown', onKey);
    if (import.meta.env.DEV) (window as unknown as { hhGlobe: unknown }).hhGlobe = { stage: st, pick: (id: string) => pick(id), passport: () => setPass(true) };
    return () => {
      removeEventListener('resize', onResize);
      removeEventListener('keydown', onKey);
      if (sc.stage === st) sc.setStage(null);
    };
  }, []);

  const selRef = useRef<string | null>(null);
  selRef.current = sel;

  // lay the globe out around the header, the dock and the postcard
  useEffect(() => {
    const layout = () => {
      const st = stageRef.current;
      if (!st) return;
      const w = innerWidth, h = innerHeight;
      const top = (document.querySelector('.gb-top') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 110;
      if (!selRef.current) {
        const bot = h - ((document.querySelector('.gb-dock') as HTMLElement | null)?.offsetHeight ?? 100) - 6;
        const reg = bot - top;
        const r = Math.min(w * 0.36, reg * 0.31);
        st.setView(w / 2, top + r * 1.28, r);
      } else if (isSide()) {
        const left = w - Math.min(440, w * 0.4) - 24;
        st.setView(left / 2, h * 0.54, Math.min(left * 0.4, h * 0.38));
      } else {
        const card = cardRef.current?.firstElementChild as HTMLElement | null | undefined;
        const cardTop = card ? card.offsetTop : h * 0.45;
        const reg = cardTop - top;
        st.setView(w / 2, top + reg / 2 + 4, Math.min(w * 0.6, Math.max(reg * 0.62, w * 0.3)));
      }
    };
    layout();
    const t1 = setTimeout(layout, 60), t2 = setTimeout(layout, 480);
    addEventListener('resize', layout);
    return () => { clearTimeout(t1); clearTimeout(t2); removeEventListener('resize', layout); };
  }, [sel, side]);

  // the route always runs to tonight's place
  useEffect(() => { const st = stageRef.current, t = AREA[s.area]; if (st) st.setRoute(home, t ?? null); }, [s.area]);

  function placePins(pins: PinView[], k: number) {
    const selId = selRef.current;
    for (const p of pins) {
      const el = pinEls.current.get(p.id);
      if (!el) continue;
      if (p.facing < 0.02) { el.style.display = 'none'; continue; }
      el.style.display = '';
      const op = p.facing < 0.08 ? 0.34 : p.facing < 0.16 ? 0.67 : 1;
      el.style.opacity = String(op);
      el.style.transform = `translate(${Math.round(p.x - 3.5 * k)}px,${Math.round(p.y - (PIN_H - 0.5) * k)}px)`;
      el.style.zIndex = String(p.id === selId ? 999 : Math.round((1 - p.depth) * 500));
    }
  }

  function pick(id: string | null) {
    const st = stageRef.current;
    if (id === selRef.current) return;
    setSel(id);
    selRef.current = id;
    const a = id ? AREA[id] : null;
    st?.focus(a ? { id: a.id, lat: a.lat, lon: a.lon } : null);
    if (a) { tap('paper_flip', 0.5); sound.play('wings_flutter', { volume: 0.25, rate: 1.2 }); haptic(10); }
    else tap('ui_back', 0.4);
  }
  function step(d: number) {
    const i = AREAS.findIndex((a) => a.id === (selRef.current ?? save.value.area));
    pick(AREAS[(i + d + AREAS.length) % AREAS.length].id);
  }
  function close() {
    if (leaving) return;
    setLeaving(true);
    tap('ui_close', 0.5);
    void transition('stars', () => { const st = stageRef.current; if (sc && st && sc.stage === st) sc.setStage(null); panel.value = null; }, { speed: 1.3 });
  }

  const a = sel ? AREA[sel] : null;
  const tonight = AREA[s.area];
  const dev = devScale(px);
  return (
    <div class={'gb' + (side ? ' side' : ' tall') + (a ? ' has-card' : '')} style={{ '--k': `${px}px` } as Record<string, string>}>
      <div class="gb-pins">
        {AREAS.map((ar) => {
          const stt = pinState(ar);
          const on = sel === ar.id;
          return (
            <button key={ar.id} class={'gb-pin ' + stt + (on ? ' on' : '')} ref={(el) => { if (el) pinEls.current.set(ar.id, el); else pinEls.current.delete(ar.id); }}
              style={{ width: `${PIN_W * px}px`, height: `${PIN_H * px}px` }} aria-label={ar.title} onClick={(e) => { e.stopPropagation(); pick(ar.id); }}>
              {on && <i class="gb-ring" style={{ backgroundImage: `url(${ringSheet(dev)})`, width: `${17 * px}px`, height: `${7 * px}px`, backgroundSize: `${34 * px}px ${7 * px}px`, left: `${-4.5 * px}px`, top: `${(PIN_H - 4) * px}px` }} />}
              <i class="gb-flag" style={{ backgroundImage: `url(${pinSheet(ar.color, stt, dev)})`, backgroundSize: `${PIN_W * 2 * px}px ${PIN_H * px}px`, animationDelay: `${-(ar.lon + 180) / 90}s` }} />
              <span class={'gb-lbl' + (on ? ' show' : '')}>{ar.title}</span>
            </button>
          );
        })}
        <div class="gb-pin home" ref={(el) => { if (el) pinEls.current.set('@home', el); }} style={{ width: `${13 * px}px`, height: `${15 * px}px` }}>
          <i class="gb-flag still" style={{ backgroundImage: `url(${homeSprite(dev)})`, backgroundSize: `${13 * px}px ${15 * px}px` }} />
          <span class="gb-lbl home">Home</span>
        </div>
      </div>

      <header class="gb-top">
        <button class="btn soft gb-x" onClick={close} aria-label="Back home"><Px name="arrow_left" size={26} /></button>
        <div class="gb-board gb-title">
          <b>The Wide World</b>
          <small>{openCount} of {AREAS.length} places open · {visitedCount} stamped</small>
        </div>
        <button class="gb-passbtn" onClick={() => { tap('paper_flip', 0.5); setPass(true); }} aria-label="Passport">
          <i style={{ backgroundImage: `url(${passportCover(Math.max(1, Math.round(dev / 2)))})` }} />
          <span>Passport</span>
        </button>
      </header>

      {!a && (
        <footer class="gb-dock">
          <button class="btn soft gb-arrow" onClick={() => step(-1)} aria-label="Previous place"><Px name="arrow_left" size={24} /></button>
          <button class="gb-board gb-tonight" onClick={() => tonight && pick(tonight.id)}>
            <img src={moonIcon(devScale(3))} alt="" />
            <span><small>Tonight Pip flies to</small><b>{tonight?.title ?? 'somewhere new'}</b></span>
          </button>
          <button class="btn soft gb-arrow" onClick={() => step(1)} aria-label="Next place"><Px name="arrow_right" size={24} /></button>
          <p class="gb-hint">Drag to spin the globe · tap a flag</p>
        </footer>
      )}

      {a && <div ref={cardRef}><Postcard key={a.id} a={a} px={px} onClose={() => pick(null)} onStep={step} /></div>}
      {pass && <Passport onClose={() => { tap('paper_flip', 0.4); setPass(false); }} onPick={(id) => { setPass(false); setTimeout(() => pick(id), 120); }} />}
    </div>
  );
}

function spinFor(st: GlobeStage, a: Area): number {
  // the spin that brings a place round to the front (see GlobeStage.focus)
  const lon = a.lon * Math.PI / 180, cl = Math.cos(a.lat * Math.PI / 180);
  void st;
  return Math.atan2(-cl * Math.cos(lon), -cl * Math.sin(lon));
}

// ------------------------------------------------------------------ the postcard

function Postcard(p: { a: Area; px: number; onClose: () => void; onStep: (d: number) => void }) {
  const a = p.a, s = save.value;
  const open = areaOpen(a.id);
  const isTonight = s.area === a.id;
  const nights = nightsAt(s, a.id);
  const k = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
  const night = isNightAt(a.lat, a.lon);
  const souv = a.souvenirs.map((id) => ({ id, name: ITEM_BY_ID[id]?.name ?? id, have: s.owned.items.includes(id), rarity: SOUVENIR_INFO[id]?.rarity ?? 'common' }));
  const found = souv.filter((x) => x.have).length;
  const req = requirement(a);
  const btn = useRef<HTMLButtonElement>(null);
  const explore = () => {
    if (!open || isTonight) return;
    edit((x) => { x.area = a.id; });
    tap('ui_confirm');
    sound.play('wings_flutter', { volume: 0.5 });
    uiBurstAt(btn.current, 'stars', 12);
    const r = btn.current?.getBoundingClientRect();
    if (r) uiBurst('sparkle', r.left + r.width / 2, r.top, 10);
    toast(`Tonight Pip flies to ${a.name}`);
  };
  const [peek, setPeek] = useState<string | null>(null);
  const L = level.value.level;
  return (
    <section class="gb-card gb-post" role="dialog" aria-label={a.title}>
      <button class="gb-close" onClick={p.onClose} aria-label="Close postcard"><Px name="cross" size={20} /></button>
      <div class="gb-front">
        <img class="gb-scene" src={postcardArt(a.id, 2 * k)} alt="" draggable={false} />
        {!open && <div class="gb-veil"><img src={padlock(3 * k)} alt="" /></div>}
        <div class="gb-greet"><small>Greetings from</small><b>{a.title}</b></div>
        <img class="gb-stamp" src={postageStamp(a, 2 * k)} alt="" />
        <img class="gb-mark" src={postmark(a, 2 * k)} alt="" />
      </div>
      <div class="gb-back">
        <div class="gb-meta">
          <span>{a.country}{a.country !== a.continent ? ` · ${a.continent}` : ''}</span>
          <span class="gb-time"><Px name={night ? 'moon' : 'sun'} size={18} />{localTime(a.tz, s.settings.hour12)} there</span>
        </div>
        <p class="gb-blurb">{a.blurb}</p>
        <div class="gb-row">
          <div class="gb-souv">
            <h4>Souvenirs <small>{found}/{souv.length}</small></h4>
            <div class="gb-slots">
              {souv.map((x) => (
                <button class={'gb-slot ' + x.rarity + (x.have ? ' have' : '')} onClick={() => { tap('ui_tap', 0.4); setPeek(peek === x.id ? null : x.id); }}>
                  <img src={souvenirIcon(x.id)} alt="" draggable={false} />
                  {!x.have && <i class="gb-q">?</i>}
                </button>
              ))}
            </div>
            {peek && <p class="gb-peek">{souv.find((x) => x.id === peek)?.have ? <><b>{ITEM_BY_ID[peek]?.name}</b> · in your storage, ready to place.</> : <>Pip might bring back a <b>{ITEM_BY_ID[peek]?.name}</b> from a night here.</>}</p>}
          </div>
          <div class="gb-nights">
            <h4>Nights here</h4>
            <div class="gb-moons">{[0, 1, 2, 3, 4].map((i) => <img src={moonIcon(2 * k, i < nights)} alt="" />)}{nights > 5 && <b>+{nights - 5}</b>}</div>
            <small>{nights ? `${nights} ${nights === 1 ? 'night' : 'nights'}${travelOf(s).nights[a.id] ? ` · first ${new Date(travelOf(s).nights[a.id].first).toLocaleDateString([], { day: 'numeric', month: 'short' })}` : ''}` : 'Not yet visited'}</small>
          </div>
        </div>
        {open ? (
          <div class="gb-actions">
            <button class="btn soft gb-arrow" onClick={() => p.onStep(-1)} aria-label="Previous place"><Px name="arrow_left" size={22} /></button>
            <button ref={btn} class={'btn pillow grow' + (isTonight ? ' honey' : '')} onClick={explore} disabled={false}>
              {isTonight ? <><Px name="check" size={22} /> Tonight’s destination</> : <><Px name="moon" size={22} /> Explore tonight</>}
            </button>
            <button class="btn soft gb-arrow" onClick={() => p.onStep(1)} aria-label="Next place"><Px name="arrow_right" size={22} /></button>
          </div>
        ) : (
          <div class="gb-locked">
            <img src={padlock(2 * k)} alt="" />
            <div>
              <b>Locked for now</b>
              <span>To fly here, {req || 'keep sleeping well'}.</span>
              <i class="gb-bar"><i style={{ width: `${Math.min(100, (L / a.level) * 100)}%` }} /></i>
              <small>Level {L} of {a.level}{a.streak ? ` · best streak ${s.bestStreak} of ${a.streak}` : ''}</small>
            </div>
            <span class="gb-steps">
              <button class="btn soft gb-arrow" onClick={() => p.onStep(-1)} aria-label="Previous place"><Px name="arrow_left" size={22} /></button>
              <button class="btn soft gb-arrow" onClick={() => p.onStep(1)} aria-label="Next place"><Px name="arrow_right" size={22} /></button>
            </span>
          </div>
        )}
      </div>
    </section>
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
  useEffect(() => { if (open && stamped) { const t = setTimeout(() => sound.play('stamp', { volume: 0.45 }), 260); return () => clearTimeout(t); } }, [open]);
  const list = useMemo(() => AREAS, []);
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
            {list.map((a, i) => {
              const e = log.nights[a.id];
              const st = e ? 'visited' : areaOpen(a.id) ? 'open' : 'locked';
              return (
                <button class={'gb-st ' + st} style={{ '--d': `${i * 30}ms`, '--r': `${((i * 37) % 7) - 3}px` } as Record<string, string>} onClick={() => { tap('ui_tap', 0.4); p.onPick(a.id); }} title={a.title}>
                  <img src={stampArt(a, { date: e?.first, state: st, seed: i + 3 }, 2 * k)} alt="" draggable={false} />
                  <span>{a.title.replace(/^The /, '')}</span>
                  {st === 'locked' && <small>Lv {a.level}</small>}
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
