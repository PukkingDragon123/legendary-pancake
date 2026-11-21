// The interview clipboard: a pixel hardboard with a spring clip and ruled paper. Each question is a
// page: answer cards with little pixel vignettes and pencil tick boxes, a wake-up dial, a pillow
// counter, a name line. Answers get pencilled onto the paper, pages flip up over the clip, and
// the plan page takes an APPROVED stamp.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { Px } from '../ui/icons.tsx';
import { haptic } from '../ui/kit.tsx';
import { uiBurstAt } from '../ui/chrome/uifx.ts';
import { boxURL, stampToolURL } from './cbart.ts';
import { decoURL } from './paper.js';
import { fmt, toMin, hm, type Opt } from './script.ts';
import './sprites.js';

export const tapSound = (id = 'ui_tap', v = 0.5) => { sound.play(id, { volume: v, gap: 40 }); haptic(); };

/** Pencil handwriting: the text is revealed stroke by stroke while a pencil scribbles along. */
export function Hand(p: { text: string; delay?: number; speed?: number; onDone?: () => void; class?: string; fast?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState(0);
  const n = Math.max(1, [...p.text].length);
  const dur = p.fast ? 1 : Math.round(Math.min(2200, Math.max(380, n * 55)) / (p.speed ?? 1));
  const delay = p.fast ? 0 : p.delay ?? 0;
  useLayoutEffect(() => { setW(ref.current?.offsetWidth ?? 0); }, [p.text]);
  useEffect(() => {
    const a = window.setTimeout(() => { if (!p.fast) sound.play('pencil', { volume: 0.45, gap: 120 }); }, delay);
    const b = window.setTimeout(() => p.onDone?.(), delay + dur + 120);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [p.text]);
  return (
    <span class={'hw ' + (p.class ?? '')} style={`--hn:${n};--hd:${delay}ms;--hdur:${dur}ms;--hw:${w}px`}>
      <span ref={ref} class="hw-t">{p.text}</span>
      {!p.fast && <img class="hw-pencil" src={decoURL('pencil', { len: 40 })} alt="" draggable={false} />}
    </span>
  );
}

/** One answer card: a little parchment tag with a pixel vignette and a pencil tick box. */
export function Card(p: { o: Opt; on: boolean; i: number; onPick: () => void; onPeek: (on: boolean) => void; small?: boolean }) {
  const r = ((p.i * 37) % 7) - 3;
  return (
    <button
      type="button"
      class={'obc-opt' + (p.on ? ' on' : '') + (p.small ? ' sm' : '')}
      style={`--r:${(r * 0.45).toFixed(2)}deg;--d:${p.i * 45}ms`}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') p.onPeek(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') p.onPeek(false); }}
      onClick={(e) => { uiBurstAt(e.currentTarget, p.on ? 'puff' : 'sparkle', p.on ? 5 : 9); p.onPick(); }}
    >
      <img class="obc-box" src={boxURL(p.on)} alt="" draggable={false} />
      <span class="obc-vig"><Px name={p.o.icon} size={p.small ? 34 : 44} /></span>
      <span class="obc-txt">
        <b class="obc-lbl">{p.o.label}</b>
        {p.o.sub && !p.small && <small class="obc-sub">{p.o.sub}</small>}
      </span>
      {p.on && <svg class="obc-circle" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M8 34 C 6 12, 40 4, 62 6 S 98 18, 94 36 S 60 58, 36 56 S 4 46, 12 22" /></svg>}
    </button>
  );
}

export function Cards(p: { opts: Opt[]; value: string[]; multi?: boolean; cols?: number; small?: boolean; rows?: boolean; onPick: (v: string) => void; onPeek: (v: string | null) => void }) {
  return (
    <div class={'obc-opts' + (p.small ? ' sm' : '') + (p.rows ? ' rows' : '')} style={`--cols:${p.rows ? 1 : p.cols ?? 2}`}>
      {p.opts.map((o, i) => <Card key={o.v} o={o} i={i} on={p.value.includes(o.v)} small={p.small && !p.rows} onPick={() => p.onPick(o.v)} onPeek={(on) => p.onPeek(on ? o.v : null)} />)}
    </div>
  );
}

/** A 24-hour dial: night round the top, day round the bottom. Drag the feather to set a time. */
export function WakeDial(p: { value: string; hour12: boolean; onChange: (v: string) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const min = toMin(p.value);
  const a = (min / 1440) * Math.PI * 2;
  const R = 84, cx = 100, cy = 100;
  const pt = (ang: number, r: number) => [cx + Math.sin(ang) * r, cy - Math.cos(ang) * r];
  const set = (e: PointerEvent) => {
    const svg = ref.current;
    if (!svg) return;
    const b = svg.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 200 - cx, y = ((e.clientY - b.top) / b.height) * 200 - cy;
    let ang = Math.atan2(x, -y);
    if (ang < 0) ang += Math.PI * 2;
    const m = Math.round(((ang / (Math.PI * 2)) * 1440) / 15) * 15;
    const v = hm(m);
    if (v !== p.value) { p.onChange(v); sound.play('ui_drag', { volume: 0.25, gap: 50 }); }
  };
  const segs = [];
  for (let h = 0; h < 24; h++) {
    const a0 = (h / 24) * Math.PI * 2, a1 = ((h + 1) / 24) * Math.PI * 2;
    const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), [x2, y2] = pt(a1, R - 20), [x3, y3] = pt(a0, R - 20);
    const night = h < 6 || h >= 20, dusk = h === 6 || h === 19;
    segs.push(<path key={h} d={`M${x0} ${y0} L${x1} ${y1} L${x2} ${y2} L${x3} ${y3} Z`} fill={night ? (h % 2 ? '#26307a' : '#2c3784') : dusk ? (h === 6 ? '#f2a05a' : '#d0705a') : h % 2 ? '#8fd0f2' : '#a4dcf6'} />);
  }
  const [hx, hy] = pt(a, R - 10);
  const [tx, ty] = pt(a, R - 36);
  return (
    <div class="obc-dial">
      <svg ref={ref} viewBox="0 0 200 200" shape-rendering="crispEdges"
        onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); set(e); }}
        onPointerMove={(e) => { if (e.buttons) set(e); }}>
        <circle cx={cx} cy={cy} r={R + 8} fill="#7b4b2c" />
        <circle cx={cx} cy={cy} r={R + 4} fill="#a86d38" />
        {segs}
        <circle cx={cx} cy={cy} r={R - 20} fill="#f6ecd2" />
        {[0, 6, 12, 18].map((h) => { const [x, y] = pt((h / 24) * Math.PI * 2, R - 31); return <text key={h} x={x} y={y + 5} text-anchor="middle" class="obc-dial-n">{p.hour12 ? ((h + 11) % 12) + 1 + (h < 12 ? 'a' : 'p') : h}</text>; })}
        {Array.from({ length: 24 }, (_, h) => { const [x, y] = pt((h / 24) * Math.PI * 2, R - 23); return <rect key={'t' + h} x={x - 1} y={y - 1} width={h % 6 ? 2 : 4} height={h % 6 ? 2 : 4} fill="#7b4b2c" />; })}
        {/* the moon at midnight and the sun at noon */}
        <g transform={`translate(${cx - 6} ${cy - R + 4})`}><rect x="2" y="0" width="8" height="12" fill="#ffe98a" /><rect x="0" y="2" width="12" height="8" fill="#ffe98a" /><rect x="6" y="0" width="6" height="10" fill="#2c3784" /></g>
        <g transform={`translate(${cx - 6} ${cy + R - 16})`}><rect x="2" y="0" width="8" height="12" fill="#ffcc34" /><rect x="0" y="2" width="12" height="8" fill="#ffcc34" /><rect x="3" y="3" width="3" height="3" fill="#fff8c8" /></g>
        <line x1={cx} y1={cy} x2={tx} y2={ty} stroke="#3b2414" stroke-width="6" stroke-linecap="square" />
        <line x1={cx} y1={cy} x2={tx} y2={ty} stroke="#c98f55" stroke-width="2" stroke-linecap="square" />
        <rect x={cx - 6} y={cy - 6} width="12" height="12" fill="#b8924c" stroke="#3b2414" stroke-width="2" />
        <g class="obc-knob" transform={`translate(${hx} ${hy})`}>
          <rect x="-11" y="-11" width="22" height="22" fill="#3b2414" />
          <rect x="-9" y="-9" width="18" height="18" fill="#ffd23f" />
          <rect x="-9" y="-9" width="18" height="4" fill="#fff3a3" />
          <rect x="-3" y="-3" width="6" height="6" fill="#b0661a" />
        </g>
      </svg>
      <div class="obc-dial-row">
        <button type="button" class="obc-wbtn" onClick={() => { tapSound('ui_tap'); p.onChange(hm(min - 15)); }}>-15</button>
        <Hand key={p.value} text={fmt(p.value, p.hour12)} class="obc-big" fast />
        <button type="button" class="obc-wbtn" onClick={() => { tapSound('ui_tap'); p.onChange(hm(min + 15)); }}>+15</button>
      </div>
    </div>
  );
}

/** Hours of sleep: a big pencilled number, wooden +/- buttons and a row of moons. */
export function HoursPick(p: { value: number; onChange: (v: number) => void }) {
  const v = p.value;
  const set = (x: number) => { const n = Math.max(5, Math.min(11, Math.round(x * 2) / 2)); if (n !== v) { p.onChange(n); tapSound(n > v ? 'ui_check' : 'ui_back', 0.4); } };
  return (
    <div class="obc-hours">
      <div class="obc-dial-row">
        <button type="button" class="obc-wbtn big" onClick={() => set(v - 0.5)}>-</button>
        <span class="obc-num"><Hand key={v} text={String(v).replace('.5', '½')} class="obc-huge" fast /><small>hours</small></span>
        <button type="button" class="obc-wbtn big" onClick={() => set(v + 0.5)}>+</button>
      </div>
      <div class="obc-moons">
        {Array.from({ length: 11 }, (_, i) => (
          <button type="button" key={i} class={'obc-moon' + (i < Math.ceil(v) ? ' on' : '') + (i === Math.ceil(v) - 1 && v % 1 ? ' half' : '')} onClick={() => set(i + 1)} aria-label={`${i + 1} hours`}>
            <Px name="moon" size={22} />
          </button>
        ))}
      </div>
      <small class="obc-note">Most grown-ups need 7 to 9 hours.</small>
    </div>
  );
}

/** The rubber stamp coming down on the plan. */
export function Stamp(p: { onHit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const id = window.setTimeout(() => { sound.play('stamp', { volume: 0.8 }); haptic(30); uiBurstAt(ref.current, 'puff', 10); uiBurstAt(ref.current, 'confetti', 18); p.onHit(); }, 420); return () => clearTimeout(id); }, []);
  return (
    <div class="obc-stamp" ref={ref}>
      <img class="obc-stamp-tool" src={stampToolURL()} alt="" draggable={false} />
      <span class="obc-ink">APPROVED</span>
    </div>
  );
}

export function Row(p: { icon: string; label: string; children: ComponentChildren }) {
  return <div class="obc-row"><Px name={p.icon} size={26} /><span class="obc-row-l">{p.label}</span><i class="obc-dots" /><span class="obc-row-v">{p.children}</span></div>;
}
