// Moments: in-app dialogs, rewards that fly into the HUD counters, the level-up ceremony, and the
// daily quest board. These are what make actions feel like they land.
import { Letters } from './text3d.tsx'; // [font6] per-letter 3D text motion
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { AREAS, ZONE_LEVEL, ZONE_NAME } from '../game/catalog.ts';
import { claim, questDef, todaysQuests } from '../game/quests.ts';
import { level, save } from '../game/store.ts';
import { IcoAcorn, IcoStar, Px } from './icons.tsx';
import { spriteURL } from './px/sprites.js';
import { haptic, Sheet, tap } from './kit.tsx';
import { panel, sceneRef } from './state.ts';
import { owlIconAsync } from './portraits.ts';
import { RuneCircle } from './chrome/lvup.tsx';
import { openPanel } from './chrome/hud.tsx';
import { MagicBar } from './chrome/magicbar.tsx';
import { PxAnim, seq } from './chrome/pxanim.tsx';
import { uiBurst, uiBurstAt } from './chrome/uifx.ts';
import { pixelate, PxBurst } from './pxfx.tsx';

// ------------------------------------------------------------------ dialogs

interface Ask { title: string; body?: ComponentChildren; art?: string; ok: string; cancel?: string; tone?: 'honey' | 'berry' | 'night' | ''; resolve: (v: boolean) => void }
const asking = signal<Ask | null>(null);
/** A pixel dialog (the artifact frame and many webviews refuse window.confirm). */
export function ask(o: Omit<Ask, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => { tap('ui_open', 0.5); asking.value = { ...o, resolve }; });
}
export function Dialogs() {
  const a = asking.value;
  if (!a) return null;
  const done = (v: boolean) => { tap(v ? 'ui_confirm' : 'ui_back', 0.5); asking.value = null; a.resolve(v); };
  return (
    <div class="modal-back" onClick={() => done(false)}>
      <div class="modal card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {a.art && <img class="modal-art px" src={a.art} alt="" />}
        <h2 class="center">{a.title}</h2>
        {a.body && <div class="center muted">{a.body}</div>}
        <div class="row" style="gap:6px;margin-top:4px">
          {a.cancel !== '' && <button class="btn soft grow" onClick={() => done(false)}>{a.cancel ?? 'Not now'}</button>}
          <button class={'btn pillow grow ' + (a.tone ?? 'honey')} onClick={() => done(true)}>{a.ok}</button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ flying rewards

interface Flyer { id: number; sprite: string; x: number; y: number; tx: number; ty: number; delay: number }
const flyers = signal<Flyer[]>([]);
let fid = 0;
// [shop] which sprite flies and which HUD chip it lands in: acorns ('coin', legacy 'acorn') fly as
// spinning acorns into [data-chip="coin"], moon gems ('gem', legacy 'moonstone') into [data-chip="gem"]
const FLY: Record<string, { sprite: string; frames: number; chip: string; gem?: boolean }> = {
  coin: { sprite: 'owlcoin', frames: 8, chip: 'coin' }, acorn: { sprite: 'owlcoin', frames: 8, chip: 'coin' },
  gem: { sprite: 'moongem', frames: 8, chip: 'gem', gem: true }, moonstone: { sprite: 'moongem', frames: 8, chip: 'gem', gem: true },
  star: { sprite: 'star', frames: 0, chip: 'star' },
};
/** Sprites arc from a screen point into the matching HUD counter, which bumps as each one lands. */
export function flyReward(kind: 'coin' | 'gem' | 'star' | 'acorn' | 'moonstone', count: number, from?: { x: number; y: number }) {
  const fly = FLY[kind] ?? FLY.coin;
  const target = document.querySelector(`[data-chip="${fly.chip}"]`) as HTMLElement | null;
  const r = target?.getBoundingClientRect();
  const tx = r ? r.left + 18 : innerWidth - 60, ty = r ? r.top + 18 : 30;
  const f = from ?? { x: innerWidth / 2, y: innerHeight * 0.55 };
  const n = Math.min(12, Math.max(3, Math.round(count / 10)));
  const list: Flyer[] = [];
  for (let i = 0; i < n; i++) list.push({ id: ++fid, sprite: fly.frames ? `${fly.sprite}_f${i % fly.frames}` : fly.sprite, x: f.x + (Math.random() - 0.5) * 90, y: f.y + (Math.random() - 0.5) * 50, tx, ty, delay: i * 70 });
  flyers.value = [...flyers.value, ...list];
  list.forEach((fl, i) => setTimeout(() => {
    sound.play(fly.gem ? 'reward_gem' : 'reward_coin', { volume: 0.35, rate: 1 + i * 0.03, gap: 40 });
    target?.classList.remove('bump'); void target?.offsetWidth; target?.classList.add('bump');
    haptic(4);
  }, fl.delay + 620));
  setTimeout(() => { flyers.value = flyers.value.filter((x) => !list.includes(x)); }, n * 70 + 900);
}
export function Flyers() {
  const k = Math.min(4, Math.max(1, Math.round(devicePixelRatio || 1)));
  return (
    <div class="flyers" aria-hidden="true">
      {flyers.value.map((f) => (
        <img key={f.id} class="flyer px" src={spriteURL(f.sprite, 2 * k)} alt="" style={{ left: `${f.x}px`, top: `${f.y}px`, '--dx': `${f.tx - f.x}px`, '--dy': `${f.ty - f.y}px`, animationDelay: `${f.delay}ms` } as any} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ level-up ceremony

export const ceremony = signal<{ level: number } | null>(null);
// [chrome] the ceremony: a rune circle draws itself in while the magic bar overflows, then a
// burst of magic, the glowing rune medallion with the new level, Pip, and what just opened up.
export function Ceremony() {
  const c = ceremony.value;
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!c) return;
    setStep(0);
    sound.play('tp_shimmer', { volume: 0.45 });
    const ts = [
      setTimeout(() => {
        setStep(1);
        sound.play('reward_levelup', { volume: 0.7 });
        const x = innerWidth / 2, y = innerHeight * 0.4;
        uiBurst('magic', x, y, 40); uiBurst('stars', x, y, 16); uiBurst('confetti', x, y - 40, 34); uiBurst('sparkle', x, y, 14);
        const sc = sceneRef.current;
        if (sc) { sc.owl.play('dance'); const o = sc.owl.node.position; sc.fx.burst('confetti', o.x, o.y + 1.5, o.z, 40); sc.fx.burst('stars', o.x, o.y + 1.2, o.z, 14); }
      }, 1150),
      setTimeout(() => setStep(2), 2000),
    ];
    return () => ts.forEach(clearTimeout);
  }, [c?.level]);
  if (!c) return null;
  const zone = (Object.entries(ZONE_LEVEL) as [keyof typeof ZONE_LEVEL, number][]).find(([, l]) => l === c.level);
  const area = AREAS.find((a) => a.level === c.level);
  return (
    <div class={'lvup' + (step === 0 ? ' pre' : '')} onClick={() => step > 1 && (ceremony.value = null)}>
      <div class="lvup-stack">
        {step > 0 && <PxBurst class="lvup-rays" size={Math.min(900, Math.max(innerWidth, innerHeight) * 1.1)} scale={3} color="#d3cce0" glow="#f1d39a" rays={14} alpha={0.32} />}
        <RuneCircle n={120} drawMs={1000} />
        <div class="lvup-medal"><PxAnim tl={seq('hud_rune', 8, 120)} size={144} /><b>{c.level}</b></div>
        <div class="lvup-title"><Letters text={`Level ${c.level}!`} mode="type" /></div>
        {step === 0 && <div class="lvup-bar spill"><MagicBar level={c.level - 1} into={62} need={100} overflow w={56} big /></div>}
        {step > 0 && <CeremonyOwl />}
      </div>
      {step > 1 && (
        <div class="lvup-card" onClick={(e) => e.stopPropagation()}>
          <h3>Pip is growing up!</h3>
          {zone && <div class="lvup-unlock"><Px name="treehouse" size={40} /><span>New room unlocked: <b>{ZONE_NAME[zone[0]]}</b></span></div>}
          {area && <div class="lvup-unlock"><Px name="map" size={40} /><span>New place to explore: <b>{area.name}</b></span></div>}
          {!zone && !area && <div class="lvup-unlock"><Px name="sparkle" size={40} /><span>Rarer treasures turn up on adventures now.</span></div>}
          <div class="row" style="gap:6px">
            {zone && <button class="btn soft grow" onClick={() => { ceremony.value = null; openPanel('decorate'); }}>Go see</button>}
            {area && !zone && <button class="btn soft grow" onClick={() => { ceremony.value = null; openPanel('map'); }}>Open map</button>}
            <button class="btn pillow honey grow" onClick={(e) => { tap(); uiBurstAt(e.currentTarget as Element, 'stars', 8); ceremony.value = null; }}>Hooray!</button>
          </div>
        </div>
      )}
    </div>
  );
}
/** Pip at the ceremony: a render of the 3D model, re-sampled to art pixels (no 2D owl drawing). */
function CeremonyOwl() {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true;
    void owlIconAsync(save.value.look, 'full').then((src) => (src ? pixelate(src, 60) : '')).then((u) => { if (live && u) setUrl(u); }).catch(() => { /* no WebGL */ });
    return () => { live = false; };
  }, []);
  return <div class="lvup-owl">{url && <img src={url} alt="" />}</div>;
}
let lastLevel = level.value.level;
/** Call once at boot: shows the ceremony whenever the level goes up. */
export function watchLevel() {
  level.subscribe((l) => { if (l.level > lastLevel) ceremony.value = { level: l.level }; lastLevel = l.level; });
}

// ------------------------------------------------------------------ quest board

export function QuestBoard() {
  const list = todaysQuests();
  void save.value;
  const left = Math.max(0, Math.ceil((new Date().setHours(24, 0, 0, 0) - Date.now()) / 3.6e6));
  return (
    <Sheet class="short qb" title={<span class="row" style="gap:6px"><Px name="clipboard" size={40} />Today's quests</span>} sub={`New quests in ${left}h`} onClose={() => { if (panel.value === 'quests') panel.value = null; }}>
      <div class="col" style="gap:8px">
        {list.map((q) => {
          const d = questDef(q.kind), done = q.prog >= d.goal;
          return (
            <div class={'quest card' + (q.claimed ? ' claimed' : done ? ' ready' : '')}>
              <div class="row" style="gap:8px">
                <span class="quest-icon"><Px name={d.sprite} size={40} /></span>
                <div class="grow col" style="gap:4px">
                  <b class="display" style="font-size:16px;font-weight:400">{d.title}</b>
                  <div class="qbar"><i style={{ width: `${(q.prog / d.goal) * 100}%` }} /><span>{q.prog}/{d.goal}</span></div>
                </div>
                {q.claimed ? <span class="stamp">Done!</span> : (
                  <button class={'btn sm ' + (done ? 'pillow honey' : 'soft')} disabled={!done} onClick={(e) => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const got = claim(q.kind);
                    if (got) { sound.play('reward_quest', { volume: 0.6 }); flyReward('acorn', got.coins, { x: r.left + r.width / 2, y: r.top }); }
                  }}><IcoAcorn size={30} />{d.coins}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p class="small muted center row" style="justify-content:center;gap:4px"><IcoStar size={20} />Quests also give XP towards Pip's next level.</p>
    </Sheet>
  );
}

// dev and screenshot hooks
if (typeof window !== 'undefined') (window as unknown as { hhFx: unknown }).hhFx = { ask, ceremony, flyReward };
