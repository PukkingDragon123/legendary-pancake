// Moments that float above everything: the "artifact" reward (a big glowing acorn or moon gem that
// pops, spins, bounces and showers into the HUD), the boutique's icy confirm box and the prize
// pop-up. They mount their own host element, so anyone can call them from anywhere.
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { flyReward } from '../fx.tsx';
import { haptic } from '../kit.tsx';
import { spriteURL } from '../px/sprites.js';
import { frameAt } from '../px/anim.ts';
import { injectIceCSS } from './art.js';
import './shop.css';

const dpr = () => Math.min(4, Math.max(1, Math.round(devicePixelRatio || 1)));
const fmt = (n: number) => n.toLocaleString('en-US');

// ------------------------------------------------------------------ host

let host: HTMLElement | null = null;
function ensureHost() {
  if (host || typeof document === 'undefined') return;
  injectIceCSS();
  host = document.createElement('div');
  host.id = 'hh-moments';
  document.body.appendChild(host);
  render(<Host />, host);
}

/** An animated pixel sprite (cycles `<name>_f<i>` frames when it has them). */
export function AnimPx(p: { name: string; size: number; fps?: number; class?: string; style?: string }) {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(performance.now()), 1000 / (p.fps ?? 8)); return () => clearInterval(id); }, [p.fps]);
  const n = frameAt(p.name, t || performance.now(), p.fps ?? 8);
  return <img class={'px ' + (p.class ?? '')} style={p.style} src={spriteURL(n, Math.max(1, Math.round((p.size / 24) * dpr())))} width={p.size} height={p.size} alt="" draggable={false} />;
}

// ------------------------------------------------------------------ the artifact moment

interface Moment { id: number; kind: 'coin' | 'gem'; n: number; title?: string }
const moments = signal<Moment[]>([]);
let mid = 0;
/**
 * The big reward moment: a glowing acorn (or moon gem) pops up, spins and bounces, then bursts into
 * a shower that flies into the HUD counter. `n` is the amount gained.
 */
export function rewardMoment(kind: 'coin' | 'gem', n: number, title?: string) {
  ensureHost();
  moments.value = [...moments.value, { id: ++mid, kind, n, title }];
}
function MomentView(p: { m: Moment; onDone: () => void }) {
  const { m } = p;
  const [stage, setStage] = useState(0);
  useEffect(() => {
    sound.play(m.kind === 'gem' ? 'reward_gem' : 'reward_unlock', { volume: 0.55 });
    haptic(12);
    const t1 = setTimeout(() => setStage(1), 1250);
    const t2 = setTimeout(() => {
      setStage(2);
      sound.play('coin_purse', { volume: 0.5 });
      flyReward(m.kind, m.n, { x: innerWidth / 2, y: innerHeight * 0.45 });
    }, 1700);
    const t3 = setTimeout(p.onDone, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  const big = m.kind === 'gem' ? 'gem_big' : 'acorn_big', tiny = m.kind === 'gem' ? 'gem_tiny' : 'acorn_tiny';
  const size = Math.min(200, innerWidth * 0.42);
  return (
    <div class={'nv-moment s' + stage + ' ' + m.kind} onClick={() => setStage(2)}>
      <div class="nv-moment-rays" />
      <div class="nv-moment-art"><AnimPx name={big} size={size} fps={10} /></div>
      <div class="nv-moment-shower">
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return <img class="px" src={spriteURL(tiny, 3 * dpr())} style={{ '--dx': `${Math.cos(a) * (90 + (i % 3) * 40)}px`, '--dy': `${Math.sin(a) * (70 + (i % 4) * 26) - 40}px`, animationDelay: `${(i % 5) * 30}ms` } as unknown as string} alt="" />;
        })}
      </div>
      <div class="nv-moment-label">
        <b class="nv-outline">+{fmt(m.n)}</b>
        <span>{m.title ?? (m.kind === 'gem' ? 'Moon Gems' : 'Acorns')}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ confirm and prize pop-ups

interface Confirm { title: string; art?: ComponentChildren; body?: ComponentChildren; yes: ComponentChildren; no?: string; tone?: 'gold' | 'ice' | 'berry' | 'violet'; resolve: (v: boolean) => void }
const confirmBox = signal<Confirm | null>(null);
/** The boutique's own confirm box (icy, with a price on the button). */
export function iceConfirm(o: Omit<Confirm, 'resolve'>): Promise<boolean> {
  ensureHost();
  sound.play('ui_open', { volume: 0.45 });
  return new Promise((resolve) => { confirmBox.value = { ...o, resolve }; });
}
interface Prize { title: string; art: ComponentChildren; name: string; sub?: string; actions: { label: string; tone?: string; run?: () => void }[] }
const prizeBox = signal<Prize | null>(null);
/** A "yours!" pop-up after a purchase or gift. */
export function showPrize(p: Prize) { ensureHost(); prizeBox.value = p; }

function ConfirmView() {
  const c = confirmBox.value;
  if (!c) return null;
  const done = (v: boolean) => { sound.play(v ? 'ui_confirm' : 'ui_back', { volume: 0.5 }); confirmBox.value = null; c.resolve(v); };
  return (
    <div class="nv-modal-back" onClick={() => done(false)}>
      <div class="nv-modal if-ice_panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div class="nv-modal-title if-ice_ribbon">{c.title}</div>
        {c.art && <div class="nv-modal-art">{c.art}</div>}
        {c.body && <div class="nv-modal-body">{c.body}</div>}
        <div class="nv-row">
          {c.no !== '' && <button class="nv-btn frost grow" onClick={() => done(false)}>{c.no ?? 'Not now'}</button>}
          <button class={'nv-btn grow ' + (c.tone ?? 'gold')} onClick={() => done(true)}>{c.yes}</button>
        </div>
      </div>
    </div>
  );
}
function PrizeView() {
  const p = prizeBox.value;
  if (!p) return null;
  const close = () => { prizeBox.value = null; };
  return (
    <div class="nv-modal-back" onClick={close}>
      <div class="nv-modal nv-prize if-ice_panel_gold" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div class="nv-prize-rays" />
        <div class="nv-modal-title if-ice_ribbon_gold">{p.title}</div>
        <div class="nv-modal-art nv-pop">{p.art}</div>
        <b class="nv-prize-name">{p.name}</b>
        {p.sub && <div class="nv-modal-body">{p.sub}</div>}
        <div class="nv-row">
          {p.actions.map((a) => <button class={'nv-btn grow ' + (a.tone ?? 'gold')} onClick={() => { sound.play('ui_tap', { volume: 0.5 }); close(); a.run?.(); }}>{a.label}</button>)}
        </div>
      </div>
    </div>
  );
}

function Host() {
  return (
    <>
      {moments.value.map((m) => <MomentView key={m.id} m={m} onDone={() => { moments.value = moments.value.filter((x) => x.id !== m.id); }} />)}
      <ConfirmView />
      <PrizeView />
    </>
  );
}
