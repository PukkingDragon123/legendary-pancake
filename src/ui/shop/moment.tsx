// Moments that float above everything: the reward (a big acorn or moon gem that pops, spins and bounces, then
// showers into the HUD counter), the "yours!" prize pop-up (a ledger page pinned to a board), and the rubber stamp the
// store uses for every purchase. They mount their own host element, so anyone can call them. OWNED BY THE SHOP BUILDER.
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { flyReward } from '../fx.tsx';
import { haptic } from '../kit.tsx';
import { SPRITES, spriteURL } from '../px/sprites.js';
import { frameAt } from '../px/anim.ts';
import { iconSrc } from '../chrome/iconset.ts';
import { injectLodgeCSS } from './art.js';
import './shop.css';

const dpr = () => Math.min(4, Math.max(1, Math.round(devicePixelRatio || 1)));
const fmt = (n: number) => n.toLocaleString('en-US');

// ------------------------------------------------------------------ host

let host: HTMLElement | null = null;
function ensureHost() {
  if (host || typeof document === 'undefined') return;
  injectLodgeCSS();
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
  const art = (SPRITES as Record<string, { w: number; h: number }>)[n] ?? { w: 24, h: 24 };
  // [ui10] the painted icon family (detailed 128 px drawings) is shown smoothly at its device size, never blown up in hard pixels
  const k = dpr(), smooth = iconSrc(n, Math.round(p.size * k), k) ?? iconSrc(p.name, Math.round(p.size * k), k);
  if (smooth) return <img class={p.class ?? ""} style={"image-rendering:auto;" + (p.style ?? "")} src={smooth} width={p.size} height={p.size} alt="" draggable={false} />;
  // whole art pixels: snap the shown size to a multiple of the sprite's own size
  const per = Math.max(1, Math.round(p.size / Math.max(art.w, art.h)));
  return <img class={"px " + (p.class ?? "")} style={p.style} src={spriteURL(n, per * dpr())} width={art.w * per} height={art.h * per} alt="" draggable={false} />;
}

/** The purchase as a rubber stamp: a turned wooden handle on a red rubber block; it thumps down when pressed. */
export function Stamp(p: { label: ComponentChildren; cost?: ComponentChildren; short?: boolean; onPress: () => void }) {
  const [down, setDown] = useState(false);
  return (
    <button class={'lg-stampbtn' + (down ? ' down' : '') + (p.short ? ' short' : '')} onClick={(e) => { e.stopPropagation(); setDown(true); setTimeout(() => setDown(false), 320); p.onPress(); }}>
      <span class="lg-stamp-handle" />
      <span class="lg-stamp-block"><span class="lg-stamp-label">{p.label}</span>{p.cost && <span class="lg-stamp-cost">{p.cost}</span>}</span>
    </button>
  );
}

// ------------------------------------------------------------------ the reward moment

interface Moment { id: number; kind: 'coin' | 'gem'; n: number; title?: string }
const moments = signal<Moment[]>([]);
let mid = 0;
/**
 * The big reward moment: a glowing acorn (or moon gem) pops up, spins and bounces, then bursts into a shower that flies
 * into the HUD counter. `n` is the amount gained.
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
    <div class={'lg-moment s' + stage + ' ' + m.kind} onClick={() => setStage(2)}>
      <div class="lg-mrays" />
      <div class="lg-moment-burst" />
      <div class="lg-moment-art"><AnimPx name={big} size={size} fps={10} /></div>
      <div class="lg-moment-shower">
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return <img class="px" src={spriteURL(tiny, 3 * dpr())} style={{ '--dx': `${Math.cos(a) * (90 + (i % 3) * 40)}px`, '--dy': `${Math.sin(a) * (70 + (i % 4) * 26) - 40}px`, animationDelay: `${(i % 5) * 30}ms` } as unknown as string} alt="" />;
        })}
      </div>
      <div class="lg-moment-label">
        <b class="lg-outline">+{fmt(m.n)}</b>
        <span>{m.title ?? (m.kind === 'gem' ? 'Moon Gems' : 'Acorns')}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the prize pop-up

interface Prize { title: string; art: ComponentChildren; name: string; sub?: string; actions: { label: string; tone?: string; run?: () => void }[] }
const prizeBox = signal<Prize | null>(null);
/** A "yours!" pop-up after a purchase: a ledger page pinned to an oak board. */
export function showPrize(p: Prize) { ensureHost(); prizeBox.value = p; }

function PrizeView() {
  const p = prizeBox.value;
  if (!p) return null;
  const close = () => { prizeBox.value = null; };
  return (
    <div class="lg-modal-back" onClick={close}>
      <div class="lg-prize lf-lg_board_gold" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div class="lg-mrays" />
        <div class="lg-prize-page">
          <span class="lg-pin" />
          <b class="lg-prize-title">{p.title}</b>
          <div class="lg-prize-art">{p.art}</div>
          <b class="lg-prize-name">{p.name}</b>
          {p.sub && <div class="lg-prize-sub">{p.sub}</div>}
        </div>
        <div class="lg-row">
          {p.actions.map((a) => <button class={'lg-btn grow ' + (a.tone ?? 'gold')} onClick={() => { sound.play('ui_tap', { volume: 0.5 }); close(); a.run?.(); }}>{a.label}</button>)}
        </div>
      </div>
    </div>
  );
}

function Host() {
  return (
    <>
      {moments.value.map((m) => <MomentView key={m.id} m={m} onDone={() => { moments.value = moments.value.filter((x) => x.id !== m.id); }} />)}
      <PrizeView />
    </>
  );
}
