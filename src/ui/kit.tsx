// Shared interface pieces: sheets, toggles, tags, toasts, speech bubbles, the slide-to-confirm
// fabric slider, and the small helpers that make every tap feel physical (sound + haptics).
import { signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { IcoAcorn, IcoBack, IcoClose, IcoStone, Px } from './icons.tsx';

// ------------------------------------------------------------------ feel

export function haptic(ms = 8) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* */ } }
export function tap(id = 'ui_tap', volume = 0.6) { sound.play(id, { volume, gap: 40 }); haptic(); }

// ------------------------------------------------------------------ toasts

export interface Toast { id: number; text: string; icon?: (p: { size?: number }) => JSX.Element; out?: boolean }
export const toasts = signal<Toast[]>([]);
let tid = 0;
export function toast(text: string, icon?: Toast['icon'], ms = 2800) {
  const id = ++tid;
  toasts.value = [...toasts.value, { id, text, icon }].slice(-3);
  setTimeout(() => { toasts.value = toasts.value.map((t) => (t.id === id ? { ...t, out: true } : t)); }, ms);
  setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id); }, ms + 400);
}
export function Toasts() {
  return <div class="toasts">{toasts.value.map((t) => <div key={t.id} class={'toast' + (t.out ? ' out' : '')}>{t.icon ? <t.icon size={40} /> : null}<span>{t.text}</span></div>)}</div>;
}

// ------------------------------------------------------------------ sheet

export function Sheet(p: { title?: ComponentChildren; sub?: ComponentChildren; onClose?: () => void; onBack?: () => void; full?: boolean; children: ComponentChildren; right?: ComponentChildren; class?: string; style?: string }) {
  const [closing, setClosing] = useState(false);
  const close = () => { if (!p.onClose) return; tap('ui_close', 0.5); setClosing(true); setTimeout(() => p.onClose?.(), 300); };
  return (
    <section class={'sheet' + (p.full ? ' full' : '') + (closing ? ' closing' : '') + (p.class ? ' ' + p.class : '')} style={p.style} role="dialog">
      <div class="grab" />
      {(p.title || p.onClose || p.onBack) && (
        <header class="sheet-head">
          {p.onBack && <button class="icon-btn" aria-label="Back" onClick={() => { tap('ui_back', 0.5); p.onBack!(); }}><IcoBack size={30} /></button>}
          <div class="grow">{p.title && <h2>{p.title}</h2>}{p.sub && <p class="muted small">{p.sub}</p>}</div>
          {p.right}
          {p.onClose && <button class="icon-btn" aria-label="Close" onClick={close}><IcoClose size={30} /></button>}
        </header>
      )}
      <div class="sheet-body">{p.children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ controls

export function Toggle(p: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button role="switch" aria-checked={p.on} aria-label={p.label} class={'toggle' + (p.on ? ' on' : '')} onClick={() => { tap('ui_toggle', 0.55); p.onChange(!p.on); }}><Px name={p.on ? 'switch_on' : 'switch_off'} size={64} /></button>;
}

export function Tags<T extends string | number>(p: { value: T; options: { v: T; label: ComponentChildren; color?: string }[]; onChange: (v: T) => void; round?: boolean }) {
  return (
    <div class="tags">
      {p.options.map((o) => (
        <button class={'tag' + (o.v === p.value ? ' on' : '') + (p.round ? ' round' : '')} style={o.color ? `--tag:${o.color}` : undefined} onClick={() => { tap('ui_tab', 0.45); p.onChange(o.v); }}>{o.label}</button>
      ))}
    </div>
  );
}

export function Seg<T extends string>(p: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return <div class="seg">{p.options.map((o) => <button class={o.v === p.value ? 'on' : ''} onClick={() => { tap('ui_tab', 0.45); p.onChange(o.v); }}>{o.label}</button>)}</div>;
}

export function Setting(p: { icon?: JSX.Element; title: ComponentChildren; sub?: ComponentChildren; children?: ComponentChildren; onClick?: () => void }) {
  return (
    <div class="setting" onClick={p.onClick} style={p.onClick ? 'cursor:pointer' : undefined}>
      {p.icon}
      <div class="t"><b>{p.title}</b>{p.sub && <small>{p.sub}</small>}</div>
      {p.children}
    </div>
  );
}

export function Price(p: { coins?: number; gems?: number }) {
  if (p.gems) return <span class="price"><IcoStone size={20} />{p.gems}</span>;
  if (p.coins) return <span class="price"><IcoAcorn size={20} />{p.coins.toLocaleString()}</span>;
  return <span class="price">Free</span>;
}

/** A soft fabric slider: drag the brass knob all the way to confirm (prevents accidental taps at night). */
export function SlideToConfirm(p: { label: string; onDone: () => void; icon?: JSX.Element }) {
  const ref = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const st = useRef({ down: false, start: 0, max: 1 });
  const onDown = (e: PointerEvent) => {
    const el = ref.current!;
    st.current = { down: true, start: e.clientX - x, max: el.clientWidth - 64 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    haptic(6);
  };
  const onMove = (e: PointerEvent) => { if (!st.current.down) return; setX(Math.max(0, Math.min(st.current.max, e.clientX - st.current.start))); };
  const onUp = () => {
    if (!st.current.down) return;
    st.current.down = false;
    if (x >= st.current.max - 6) { haptic(20); tap('ui_confirm', 0.6); p.onDone(); setTimeout(() => setX(0), 600); }
    else setX(0);
  };
  return (
    <div class="slide" ref={ref}>
      <div class="lbl" style={{ opacity: 1 - x / Math.max(1, st.current.max) }}>{p.label}</div>
      <div class="knob" style={{ transform: `translateX(${x}px)`, transition: st.current.down ? 'none' : 'transform .45s cubic-bezier(.34,1.56,.64,1)' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>{p.icon}</div>
    </div>
  );
}

/** Re-render every `ms` (clocks, countdowns). */
export function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const id = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(id); }, [ms]);
}

/** A number that counts up smoothly when it changes (acorn counters). */
export function Rolling(p: { value: number }) {
  const [shown, setShown] = useState(p.value);
  const raf = useRef(0);
  useEffect(() => {
    const from = shown, to = p.value, t0 = performance.now();
    if (from === to) return;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900), e = 1 - (1 - k) ** 3;
      setShown(Math.round(from + (to - from) * e));
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [p.value]);
  return <>{shown.toLocaleString()}</>;
}

export const fmtTime = (t: number | Date, hour12: boolean) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12 });
export const fmtHM = (hhmm: string, hour12: boolean) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return fmtTime(d, hour12); };
export const fmtDur = (ms: number) => { const m = Math.round(ms / 60000); const h = Math.floor(m / 60); return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`; };
