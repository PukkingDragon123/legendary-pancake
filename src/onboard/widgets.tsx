// The interview's hands-on answer widgets, one kind of physical toy per question instead of the same card
// grid every time: a name tag you write on, trading cards of the 3D owls, a sticker sheet you peel, a brass
// wake-up dial, a slider of moons, a sheep-counting mini-game, a phone you drag to where it sleeps, a sky
// lever from sunrise to midnight, mugs on a shelf, cassette tapes, a microphone toggle, and the rubber stamp.
// All art is pixel art painted in pixart.ts / wart.ts / obicons.ts (no smooth circles, no 2D owls).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import type { OwlLook } from '../owl/model.ts';
import { speciesOf } from '../owl/species.ts';
import { owlIconAsync, owlIconCached } from '../ui/portraits.ts';
import { uiBurst, uiBurstAt } from '../ui/chrome/uifx.ts';
import { haptic } from '../ui/kit.tsx';
import { pencilURL, stickerFrame, tapeURL } from './cbart.ts';
import { tapSound } from './clipboard.tsx';
import { iconSize, iconURL } from './obicons.ts';
import { frameCSS, hash, Pix, R, step } from './pixart.ts';
import { fmt, hm, toMin, type Opt } from './script.ts';
import { cassetteURL, inkPadURL, knobURL, leverURL, loopURL, moonURL, paintDial, plateURL, shelfURL, skyStripURL, stickerSheetURL } from './wart.ts';
import { P } from '../gfx/palette.ts';

/** A pixel icon at an integer scale. */
export function Ico(p: { n: string; k?: number; class?: string }) {
  const s = iconSize(p.n), k = p.k ?? 2;
  return <img class={'pxi ' + (p.class ?? '')} src={iconURL(p.n)} width={s.w * k} height={s.h * k} alt="" draggable={false} />;
}
/** A pencil loop drawn round a chosen thing (sized to it in texels of 2 px). */
function Loop(p: { w: number; h: number; seed?: number }) {
  const W = Math.max(8, Math.round(p.w / 2)), H = Math.max(8, Math.round(p.h / 2));
  return <img class="wl-loop" src={loopURL(W, H, p.seed ?? 1)} width={W * 2} height={H * 2} alt="" draggable={false} />;
}
/** Measure an element (for loops and drag targets). */
function useSize<T extends HTMLElement>(): [preact.RefObject<T>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [s, setS] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const up = () => setS({ w: el.offsetWidth, h: el.offsetHeight });
    up();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(up) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  return [ref, s];
}
const hoverPeek = (on: (v: boolean) => void) => ({
  onPointerEnter: (e: PointerEvent) => { if (e.pointerType === 'mouse') on(true); },
  onPointerLeave: (e: PointerEvent) => { if (e.pointerType === 'mouse') on(false); },
});

// ================================================================ the name tag

export function NameTag(p: { kind: 'you' | 'name'; value: string; placeholder: string; disabled: boolean; chips?: string[]; onInput: (v: string) => void; onEnter: () => void; onChip?: (v: string) => void }) {
  const mirror = useRef<HTMLSpanElement>(null);
  const [penX, setPenX] = useState(0);
  const [wiggle, setWiggle] = useState(0);
  const [peeled, setPeeled] = useState<string | null>(null);
  useLayoutEffect(() => { setPenX(mirror.current?.offsetWidth ?? 0); }, [p.value]);
  return (
    <div class={'wn wn-' + p.kind}>
      <div class="wn-tag">
        <div class="wn-head"><b>{p.kind === 'you' ? 'HELLO' : 'OWL NAME'}</b><small>{p.kind === 'you' ? 'my name is' : 'engraved by hand'}</small></div>
        <div class="wn-line">
          <span class="wn-mirror" ref={mirror}>{p.value || ''}</span>
          <input class="wn-input" value={p.value} maxLength={16} placeholder={p.placeholder} disabled={p.disabled} spellcheck={false} autocomplete="off"
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              p.onInput(v);
              setWiggle((w) => w + 1);
              sound.play('pencil', { volume: 0.28, rate: 0.9 + Math.random() * 0.4, gap: 70 });
              const r = (e.target as HTMLElement).getBoundingClientRect();
              if (Math.random() < 0.5) uiBurst('puff', r.left + Math.min(r.width - 10, (mirror.current?.offsetWidth ?? 0) + 6), r.bottom - 10, 1);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); p.onEnter(); } }} />
          <img class={'wn-pencil' + (wiggle % 2 ? ' a' : ' b')} src={pencilURL()} style={`--x:${Math.min(penX, 230)}px`} alt="" draggable={false} />
        </div>
        <i class="wn-rule" />
      </div>
      {p.chips && p.chips.length > 0 && (
        <div class="wn-chips">
          <small>or peel one:</small>
          {p.chips.map((n, i) => (
            <button type="button" key={n} class={'wn-chip' + (peeled === n ? ' peel' : '') + (p.value === n ? ' used' : '')} disabled={p.disabled} style={`--r:${((i * 37) % 7) - 3}deg;${frameCSS(stickerFrame(i % 2 ? 'sage' : 'lamp'), 2)}`}
              onClick={(e) => { setPeeled(n); tapSound('fabric', 0.4); uiBurstAt(e.currentTarget, 'sparkle', 5); window.setTimeout(() => { setPeeled(null); p.onChip?.(n); }, 260); }}>
              {n}<i class="wn-curl" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================================================ species: trading cards of the 3D owls

function Portrait(p: { look: OwlLook; part: 'face' | 'full'; class?: string }) {
  const [url, setUrl] = useState(() => owlIconCached(p.look, p.part) ?? '');
  useEffect(() => {
    let live = true;
    const hit = owlIconCached(p.look, p.part);
    if (hit) { setUrl(hit); return; }
    void owlIconAsync(p.look, p.part, p.part === 'full').then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [p.look.species, p.part]);
  return url ? <img class={'ws-pic ' + (p.class ?? '')} src={url} alt="" draggable={false} /> : <i class={'ws-pic ws-wait ' + (p.class ?? '')} />;
}

export function SpeciesDeck(p: { opts: Opt[]; value: string; look: (id: string) => OwlLook; onPick: (v: string) => void; onPeek: (v: string | null) => void; interactive: boolean }) {
  const sp = speciesOf(p.value);
  const [flip, setFlip] = useState(0);
  return (
    <div class="ws">
      <div class="ws-slot" key={p.value + flip}>
        <span class="ws-corner tl" /><span class="ws-corner tr" /><span class="ws-corner bl" /><span class="ws-corner br" />
        <Portrait look={p.look(p.value)} part="full" class="ws-big" />
        <div class="ws-info">
          <b>{sp.name}</b>
          <i>{sp.latin}</i>
          <small>{sp.blurb}</small>
        </div>
        <img class="ws-tape" src={tapeURL(P.sage, 2)} alt="" />
      </div>
      <div class="ws-hand">
        {p.opts.map((o, i) => {
          const on = o.v === p.value;
          return (
            <button type="button" key={o.v} class={'ws-card' + (on ? ' on' : '')} style={`--i:${i};--n:${p.opts.length}`} disabled={!p.interactive}
              {...hoverPeek((h) => p.onPeek(h ? o.v : null))}
              onClick={(e) => { if (on) return; setFlip((f) => f + 1); uiBurstAt(e.currentTarget, 'sparkle', 8); sound.play('paper_flip', { volume: 0.4, gap: 60 }); p.onPick(o.v); }}>
              <span class="ws-flip">
                <span class="ws-front"><Portrait look={p.look(o.v)} part="face" /><b>{o.label.replace(' Owl', '').replace('Northern ', '')}</b></span>
                <span class="ws-back" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ================================================================ goals: a sheet of stickers to peel

export function StickerSheet(p: { opts: (Opt & { art: string; col: string })[]; value: string[]; onToggle: (v: string) => void; onPeek: (v: string | null) => void; interactive: boolean }) {
  const [peel, setPeel] = useState<string | null>(null);
  const [ref, sz] = useSize<HTMLDivElement>();
  const stuck = p.value;
  const toggle = (v: string, el: Element) => {
    if (!p.interactive || peel) return;
    const on = stuck.includes(v);
    if (on) { tapSound('ui_back', 0.35); p.onToggle(v); return; }
    setPeel(v);
    sound.play('fabric', { volume: 0.5, rate: 1.3, gap: 60 });
    uiBurstAt(el, 'sparkle', 6);
    window.setTimeout(() => { setPeel(null); p.onToggle(v); haptic(14); sound.play('place_item', { volume: 0.35, gap: 60 }); }, 300);
  };
  return (
    <div class="wg">
      <div class="wg-board">
        <small class="wg-lbl">my goals</small>
        {stuck.length === 0 && <span class="wg-empty">stick your goals here</span>}
        {stuck.map((v, i) => {
          const o = p.opts.find((x) => x.v === v)!;
          return (
            <button type="button" key={v} class="wg-stuck" style={`--r:${((i * 53) % 9) - 4}deg;${frameCSS(stickerFrame(o.col as never), 2)}`} onClick={(e) => toggle(v, e.currentTarget)} disabled={!p.interactive} {...hoverPeek((h) => p.onPeek(h ? v : null))}>
              <Ico n={o.art} k={1} />
            </button>
          );
        })}
      </div>
      <div class="wg-sheet" ref={ref} style={sz.w ? `background-image:url(${stickerSheetURL(Math.round(sz.w / 2), Math.round(sz.h / 2))})` : ''}>
        {p.opts.map((o, i) => {
          const gone = stuck.includes(o.v);
          return (
            <button type="button" key={o.v} class={'wg-stk' + (gone ? ' gone' : '') + (peel === o.v ? ' peel' : '')} style={`--d:${i * 50}ms;--r:${((i * 37) % 5) - 2}deg`} disabled={!p.interactive}
              onClick={(e) => toggle(o.v, e.currentTarget)} {...hoverPeek((h) => p.onPeek(h ? o.v : null))}>
              <span class="wg-face" style={frameCSS(stickerFrame(o.col as never), 2)}><Ico n={o.art} k={2} /><i class="wg-curl" /></span>
              <b>{o.label}</b>
            </button>
          );
        })}
      </div>
      <small class="wl-note">Tap to peel. Pick as many as you like.</small>
    </div>
  );
}

// ================================================================ wake-up time: the brass dial

export function WakeDial(p: { value: string; hour12: boolean; onChange: (v: string) => void; interactive: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const min = toMin(p.value);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const art = paintDial(min, p.hour12);
    c.width = art.w; c.height = art.h;
    c.getContext('2d')!.putImageData(new ImageData(art.d, art.w, art.h), 0, 0);
  }, [min, p.hour12]);
  const set = (e: PointerEvent) => {
    const c = cv.current;
    if (!c || !p.interactive) return;
    const b = c.getBoundingClientRect();
    const x = e.clientX - b.left - b.width / 2, y = e.clientY - b.top - b.height / 2;
    let ang = Math.atan2(x, -y);
    if (ang < 0) ang += Math.PI * 2;
    const v = hm(Math.round(((ang / (Math.PI * 2)) * 1440) / 15) * 15);
    if (v !== p.value) { p.onChange(v); sound.play('clock_tick', { volume: 0.3, rate: 1.2 + Math.random() * 0.2, gap: 45 }); haptic(4); }
  };
  const nudge = (d: number) => { tapSound('clock_wind', 0.3); p.onChange(hm(min + d)); };
  return (
    <div class="wd">
      <canvas ref={cv} class="wd-dial" onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); set(e); }} onPointerMove={(e) => { if (e.buttons) set(e); }} />
      <div class="wd-row">
        <button type="button" class="wd-btn" disabled={!p.interactive} onClick={() => nudge(-15)}>-15</button>
        <span class="wd-time" key={p.value}>{fmt(p.value, p.hour12)}</span>
        <button type="button" class="wd-btn" disabled={!p.interactive} onClick={() => nudge(15)}>+15</button>
      </div>
      <small class="wl-note">Drag the sun round the dial.</small>
    </div>
  );
}

// ================================================================ hours of sleep: a slider made of moons

export function MoonSlider(p: { value: number; onChange: (v: number) => void; interactive: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const v = p.value, lo = 5, hi = 11;
  const pct = ((v - lo) / (hi - lo)) * 100;
  const set = (e: PointerEvent) => {
    const t = track.current;
    if (!t || !p.interactive) return;
    const b = t.getBoundingClientRect();
    const k = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
    const n = Math.round((lo + k * (hi - lo)) * 2) / 2;
    if (n !== v) { p.onChange(n); sound.play(n > v ? 'ui_check' : 'ui_back', { volume: 0.25, rate: 0.8 + (n - lo) * 0.08, gap: 40 }); haptic(4); }
  };
  const moons = [];
  for (let h = lo; h <= hi; h++) {
    const lit = v >= h, half = !lit && v >= h - 0.5;
    moons.push(<span key={h} class={'wm-moon' + (lit || half ? ' on' : '')} style={`left:${((h - lo) / (hi - lo)) * 100}%`}><img src={moonURL((h - lo + 1) / (hi - lo + 1), lit || half, half)} alt="" /><small>{h}</small></span>);
  }
  return (
    <div class="wm">
      <div class="wm-num"><span class="wm-big" key={v}>{String(v).replace('.5', '½')}</span><small>hours of sleep</small></div>
      <div class="wm-track" ref={track} onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); set(e); }} onPointerMove={(e) => { if (e.buttons) set(e); }}>
        <div class="wm-sweet" style={`left:${((7 - lo) / (hi - lo)) * 100}%;width:${(2 / (hi - lo)) * 100}%`}><small>sweet spot</small></div>
        <div class="wm-rail" />
        {moons}
        <img class="wm-knob" src={knobURL()} style={`left:${pct}%`} alt="" draggable={false} />
      </div>
      <div class="wm-pillows">{Array.from({ length: Math.ceil(v) }, (_, i) => <Ico key={i} n="pillow" k={1} class={i === Math.ceil(v) - 1 && v % 1 ? 'half' : ''} />)}</div>
      <small class="wl-note">Most grown-ups need 7 to 9 hours.</small>
    </div>
  );
}

// ================================================================ falling asleep: count the sheep

const LAT: { v: string; label: string; upTo: number }[] = [{ v: 'quick', label: 'Minutes', upTo: 3 }, { v: 'normal', label: '10-20 min', upTo: 6 }, { v: 'slow', label: '20-40 min', upTo: 13 }, { v: 'long', label: 'Ages', upTo: 1e9 }];
const latOf = (n: number) => LAT.find((l) => n <= l.upTo)!.v;

export function SheepGame(p: { value: string | null; onPick: (v: string) => void; onPeek: (v: string | null) => void; interactive: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'idle' | 'run' | 'done'>(p.value ? 'done' : 'idle');
  const [count, setCount] = useState(0);
  const st = useRef({ sheep: [] as { x: number; counted: boolean }[], t: 0, next: 0, count: 0, run: false, frozen: false });
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const W = 150, H = 58;
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    {
      const p2 = new Pix(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const hill = 44 + Math.round(Math.sin(x * 0.06) * 2 + Math.sin(x * 0.17 + 2));
        if (y >= hill) p2.set(x, y, step(R.pine, 3 - (y - hill) * 0.12 + (hash(x, y, 2) > 0.9 ? 0.8 : 0), x, y));
        else p2.set(x, y, hash(x, y, 7) > 0.985 ? R.cream[5] : step(R.night, 2.4 + y * 0.03, x, y, 0.6));
      }
      p2.disc(126, 12, 6, 6, (nx, ny, x, y) => step(R.lamp, 4 - nx - ny, x, y));
      p2.disc(128.5, 10.5, 5, 5, (nx, ny, x, y) => step(R.night, 2.6, x, y));
      // the fence
      for (const fx of [72, 80]) for (let y = 30; y < 47; y++) p2.set(fx, y, R.woodLight[fx === 72 ? 4 : 3]), p2.set(fx + 1, y, R.woodLight[2]);
      for (const fy of [33, 40]) for (let x = 68; x < 86; x++) { p2.set(x, fy, R.woodLight[4]); p2.set(x, fy + 1, R.woodLight[2]); }
      bg.getContext('2d')!.putImageData(new ImageData(p2.d, W, H), 0, 0);
    }
    const sheepImg = [new Image(), new Image()];
    sheepImg[0].src = iconURL('sheepgame0'); sheepImg[1].src = iconURL('sheepgame1');
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const s = st.current;
      if (s.run && !s.frozen) {
        s.t += dt;
        if ((s.next -= dt) <= 0) { s.next = 1.25; s.sheep.push({ x: -24, counted: false }); }
        for (const sh of s.sheep) {
          sh.x += dt * 38;
          if (!sh.counted && sh.x > 66) { sh.counted = true; s.count++; setCount(s.count); sound.play('pet_jump', { volume: 0.2, rate: 1.2 + Math.random() * 0.2, gap: 120 }); }
        }
        s.sheep = s.sheep.filter((sh) => sh.x < W + 4);
      }
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, W, H);
      g.drawImage(bg, 0, 0);
      for (const sh of s.sheep) {
        const near = Math.max(0, 1 - Math.abs(sh.x + 11 - 76) / 22);
        const y = 30 - Math.round(Math.sin(near * Math.PI / 2) * 16) + (s.frozen ? 0 : Math.round(Math.abs(Math.sin(sh.x * 0.25))));
        const img = sheepImg[near > 0.2 || Math.floor(sh.x / 6) % 2 ? 1 : 0];
        if (img.complete) g.drawImage(img, Math.round(sh.x), y);
      }
      if (s.frozen) { g.fillStyle = '#f1d39a'; for (const [x, y] of [[100, 18], [104, 14], [108, 10]]) g.fillRect(x, y, 2, 2); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const start = () => { const s = st.current; s.sheep = []; s.count = 0; s.t = 0; s.next = 0; s.run = true; s.frozen = false; setCount(0); setState('run'); tapSound('ui_tap', 0.4); };
  const sleep = () => { const s = st.current; s.frozen = true; setState('done'); const v = latOf(s.count); tapSound('yawn', 0.4); p.onPick(v); };
  const mins = Math.max(2, count * 3);
  return (
    <div class="wsg">
      <div class="wsg-screen"><canvas ref={cv} class="wsg-cv" /><span class="wsg-count">{count}<small>sheep</small></span></div>
      <div class="wsg-ctl">
        {state === 'idle' && <button type="button" class="wbtn moss" disabled={!p.interactive} onClick={start}>Start counting sheep</button>}
        {state === 'run' && <button type="button" class="wbtn honey big" disabled={!p.interactive} onClick={sleep}>Zzz... I'm asleep!</button>}
        {state === 'done' && <span class="wsg-res">{count ? <>Out after <b>{count}</b> sheep (about {mins} min)</> : <>Picked by hand</>}<button type="button" class="wbtn linen sm" disabled={!p.interactive} onClick={start}>again</button></span>}
      </div>
      <div class="wsg-tabs">
        {LAT.map((l) => (
          <button type="button" key={l.v} class={'wsg-tab' + (p.value === l.v ? ' on' : '')} disabled={!p.interactive} {...hoverPeek((h) => p.onPeek(h ? l.v : null))}
            onClick={() => { st.current.frozen = true; setState('done'); setCount(0); tapSound('pencil', 0.4); p.onPick(l.v); }}>
            {l.label}{p.value === l.v && <Loop w={84} h={30} seed={l.v.length} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ================================================================ phone in bed: drag the phone to where it sleeps

const SPOTS: { v: string; icon: string; label: string; sub: string }[] = [
  { v: 'never', icon: 'drawer', label: 'Drawer', sub: 'never in bed' },
  { v: 'sometimes', icon: 'nightstand', label: 'Nightstand', sub: 'a quick peek' },
  { v: 'nightly', icon: 'pillowbed', label: 'Pillow', sub: 'every night' },
];
export function PhoneSort(p: { value: string | null; onPick: (v: string) => void; onPeek: (v: string | null) => void; interactive: boolean }) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const zones = useRef<Record<string, HTMLElement | null>>({});
  const home = useRef<HTMLDivElement>(null);
  const hit = (x: number, y: number) => {
    for (const s of SPOTS) { const el = zones.current[s.v]; if (!el) continue; const b = el.getBoundingClientRect(); if (x >= b.left && x <= b.right && y >= b.top - 20 && y <= b.bottom) return s.v; }
    return null;
  };
  const drop = (v: string) => { p.onPick(v); sound.play('place_item', { volume: 0.5, gap: 60 }); haptic(12); const el = zones.current[v]; if (el) uiBurstAt(el, 'puff', 6); };
  const phone = (cls = '') => <span class={'wp-phone ' + cls}><Ico n="phone" k={2} /></span>;
  return (
    <div class="wp">
      <div class="wp-home" ref={home}>
        {!p.value && !drag && (
          <span class="wp-grab" onPointerDown={(e) => { if (!p.interactive) return; (e.currentTarget as Element).setPointerCapture(e.pointerId); setDrag({ x: e.clientX, y: e.clientY }); tapSound('pickup_item', 0.4); }}
            onPointerMove={(e) => { if (!drag) return; setDrag({ x: e.clientX, y: e.clientY }); const o = hit(e.clientX, e.clientY); if (o !== over) { setOver(o); p.onPeek(o); } }}
            onPointerUp={(e) => { const o = hit(e.clientX, e.clientY); setDrag(null); setOver(null); if (o) drop(o); else p.onPeek(null); }}>
            {phone('bob')}<small>drag me to bed... or not</small>
          </span>
        )}
        {p.value && <small class="wp-hint">Drag it somewhere else, or tap a spot.</small>}
      </div>
      {drag && <span class="wp-drag" style={`left:${drag.x}px;top:${drag.y}px`}>{phone('lift')}</span>}
      <div class="wp-spots">
        {SPOTS.map((s) => (
          <button type="button" key={s.v} ref={(el) => { zones.current[s.v] = el; }} class={'wp-spot' + (p.value === s.v ? ' on' : '') + (over === s.v ? ' over' : '')} disabled={!p.interactive}
            {...hoverPeek((h) => p.onPeek(h ? s.v : null))} onClick={() => drop(s.v)}>
            <span class="wp-art"><Ico n={s.icon} k={2} />{p.value === s.v && phone('in')}</span>
            <b>{s.label}</b><small>{s.sub}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

// ================================================================ early bird or night owl: the sky lever

const CHRONO = [{ v: 'lark', label: 'Early bird', sub: 'up with the sun' }, { v: 'between', label: 'In between', sub: 'it depends' }, { v: 'owl', label: 'Night owl', sub: 'alive after dark' }];
export function SkyLever(p: { value: string | null; onPick: (v: string) => void; onPeek: (v: string | null) => void; interactive: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const idx = p.value ? CHRONO.findIndex((c) => c.v === p.value) : 1;
  const [live, setLive] = useState<number | null>(null);
  const pos = live ?? (idx < 0 ? 1 : idx) * 50;
  const fromEvent = (e: PointerEvent) => { const b = track.current!.getBoundingClientRect(); return Math.max(0, Math.min(100, ((e.clientX - b.left) / b.width) * 100)); };
  const snap = (x: number) => Math.round(x / 50);
  return (
    <div class="wk">
      <div class="wk-ends"><Ico n="sun" k={2} /><Ico n="moon" k={2} /></div>
      <div class="wk-track" ref={track}
        onPointerDown={(e) => { if (!p.interactive) return; (e.currentTarget as Element).setPointerCapture(e.pointerId); setLive(fromEvent(e)); tapSound('ui_drag', 0.3); }}
        onPointerMove={(e) => { if (live === null || !e.buttons) return; const x = fromEvent(e); setLive(x); const k = snap(x); if (CHRONO[k].v !== p.value) p.onPeek(CHRONO[k].v); }}
        onPointerUp={(e) => { if (live === null) return; const k = snap(fromEvent(e)); setLive(null); p.onPick(CHRONO[k].v); sound.play('drawer', { volume: 0.4, rate: 1.5, gap: 60 }); haptic(10); }}>
        <img class="wk-sky" src={skyStripURL()} alt="" draggable={false} />
        {[0, 50, 100].map((x) => <i key={x} class="wk-notch" style={`left:${x}%`} />)}
        <img class={'wk-knob' + (live !== null ? ' held' : '')} src={knobURL()} style={`left:${pos}%`} alt="" draggable={false} />
      </div>
      <div class="wk-labels">
        {CHRONO.map((c) => (
          <button type="button" key={c.v} class={'wk-lab' + (p.value === c.v ? ' on' : '')} disabled={!p.interactive} {...hoverPeek((h) => p.onPeek(h ? c.v : null))}
            onClick={() => { p.onPick(c.v); sound.play('drawer', { volume: 0.4, rate: 1.5, gap: 60 }); }}>
            <b>{c.label}</b><small>{c.sub}</small>{p.value === c.v && <Loop w={96} h={44} seed={3} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ================================================================ caffeine: mugs on a shelf

const MUGS = [{ v: 'none', art: 'milkglass', label: 'None', sub: 'warm milk gang' }, { v: 'morning', art: 'mugsun', label: 'Mornings', sub: 'before noon' }, { v: 'late', art: 'mugmoon', label: 'Afternoon+', sub: 'an evening latte' }];
export function MugShelf(p: { value: string | null; onPick: (v: string) => void; onPeek: (v: string | null) => void; interactive: boolean }) {
  const [ref, sz] = useSize<HTMLDivElement>();
  return (
    <div class="wu">
      <div class="wu-shelf" ref={ref}>
        {MUGS.map((m) => (
          <button type="button" key={m.v} class={'wu-mug' + (p.value === m.v ? ' on' : '')} disabled={!p.interactive} {...hoverPeek((h) => p.onPeek(h ? m.v : null))}
            onClick={(e) => { p.onPick(m.v); sound.play(p.value === m.v ? 'ui_tap' : 'pickup_item', { volume: 0.45, gap: 60 }); uiBurstAt(e.currentTarget, 'puff', 4); }}>
            {p.value === m.v && <span class="wu-steam"><Ico n="steam" k={2} /><Ico n="steam" k={2} /></span>}
            <Ico n={m.art} k={3} />
          </button>
        ))}
        {sz.w > 0 && <img class="wu-plank" src={shelfURL(Math.round(sz.w / 3))} width={Math.round(sz.w / 3) * 3} alt="" />}
      </div>
      <div class="wu-tags">
        {MUGS.map((m) => <span key={m.v} class={'wu-tag' + (p.value === m.v ? ' on' : '')}><b>{m.label}</b><small>{m.sub}</small></span>)}
      </div>
    </div>
  );
}

// ================================================================ what helps you relax: cassette tapes

export function TapeRack(p: { opts: (Opt & { col: string; art: string })[]; value: string[]; onToggle: (v: string) => void; onPeek: (v: string | null) => void; interactive: boolean }) {
  return (
    <div class="wt">
      {p.opts.map((o, i) => {
        const on = p.value.includes(o.v);
        return (
          <button type="button" key={o.v} class={'wt-tape' + (on ? ' on' : '')} style={`--d:${i * 40}ms;--r:${((i * 29) % 5) - 2}deg`} disabled={!p.interactive}
            {...hoverPeek((h) => p.onPeek(h ? o.v : null))}
            onClick={(e) => { p.onToggle(o.v); sound.play(on ? 'ui_back' : 'drawer', { volume: 0.35, rate: on ? 1 : 1.7, gap: 60 }); if (!on) uiBurstAt(e.currentTarget, 'sparkle', 5); }}>
            <img class="wt-shell" src={cassetteURL(o.col as never)} alt="" draggable={false} />
            <span class="wt-ico"><Ico n={o.art} k={1} /></span>
            <b class="wt-name">{o.label}</b>
            {on && <span class="wt-eq"><i /><i /><i /><i /><i /></span>}
            {on && <span class="wt-reel l" />}{on && <span class="wt-reel r" />}
          </button>
        );
      })}
    </div>
  );
}

// ================================================================ sleep sound tracking: the microphone switch

export function MicSwitch(p: { value: boolean | null; onPick: (v: string) => void; onPeek: (v: string | null) => void; interactive: boolean; note: string }) {
  const on = p.value === true;
  return (
    <div class="wx">
      <div class="wx-unit">
        <button type="button" class="wx-plate" disabled={!p.interactive} onClick={() => { const v = on ? 'no' : 'yes'; p.onPick(v); sound.play('ui_toggle', { volume: 0.6 }); sound.play('wood_knock', { volume: 0.3, rate: 1.6 }); haptic(16); }}>
          <img class="wx-bg" src={plateURL()} alt="" draggable={false} />
          <img class="wx-lever" src={leverURL(on)} alt="" draggable={false} />
          <b class="wx-up">LISTEN</b><b class="wx-down">NOT NOW</b>
        </button>
        <div class="wx-side">
          <span class={'wx-lamp' + (on ? ' on' : '')}><i /><small>{on ? 'listening' : p.value === false ? 'off' : 'flip the switch'}</small></span>
          <span class={'wx-meter' + (on ? ' on' : '')}>{Array.from({ length: 9 }, (_, i) => <i key={i} style={`--i:${i}`} />)}</span>
          <Ico n="mic" k={2} />
        </div>
      </div>
      <div class="wx-choices">
        <button type="button" class={'wx-c' + (on ? ' on' : '')} disabled={!p.interactive} {...hoverPeek((h) => p.onPeek(h ? 'yes' : null))} onClick={() => { p.onPick('yes'); sound.play('ui_toggle', { volume: 0.5 }); }}>Yes, listen<small>snores and sleep talk</small></button>
        <button type="button" class={'wx-c' + (p.value === false ? ' on' : '')} disabled={!p.interactive} {...hoverPeek((h) => p.onPeek(h ? 'no' : null))} onClick={() => { p.onPick('no'); sound.play('ui_toggle', { volume: 0.5 }); }}>Not now<small>maybe later</small></button>
      </div>
      <p class="wx-note">{p.note}</p>
    </div>
  );
}

// ================================================================ the rubber stamp

/** Press the stamp: it dips into the ink pad, then you let go and it slams onto the plan. */
export function StampPress(p: { disabled: boolean; onStamp: () => void }) {
  const [state, setState] = useState<'rest' | 'ink' | 'go'>('rest');
  const go = () => { if (state === 'go') return; setState('go'); window.setTimeout(p.onStamp, 380); };
  return (
    <div class={'wst ' + state}>
      <img class="wst-pad" src={inkPadURL()} alt="" draggable={false} />
      <button type="button" class="wst-tool" disabled={p.disabled || state === 'go'} aria-label="Approve the plan"
        onPointerDown={() => { if (p.disabled) return; setState('ink'); sound.play('fabric', { volume: 0.4, rate: 0.8 }); haptic(10); }}
        onPointerUp={go} onPointerLeave={() => { if (state === 'ink') go(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') go(); }} />
      <small class="wst-hint">{state === 'rest' ? 'press the stamp!' : state === 'ink' ? 'let go to stamp' : ''}</small>
    </div>
  );
}
