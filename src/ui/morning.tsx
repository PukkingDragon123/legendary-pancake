// The morning. Pip flies home at dawn with a bundle (the arrival cinematic), the gift sack bounces
// in, and each find comes out as a wrapped present: pull the ribbon, the paper tears into pixel
// confetti, the lid pops and the furniture or outfit rises in its rarity's light. Then today's haul
// with the rewards, a streak strip, tomorrow's teaser, Pip's travel note and last night's report.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { sound } from '../audio/sound.ts';
import { AREA, ITEM_BY_ID, RARITY_COLOR as RARITY_RAW, RARITY_NAME, TRINKET, trinketUrl, type Rarity } from '../game/catalog.ts';
import { calm } from './px/calm.js';
import { giftSack } from './chrome/objects.ts'; // [ui4] the burlap gift sack, relief-painted
import { pxGlowURL, PxBurst } from './pxfx.tsx';
// [ui3] rarity colours graded into the calm palette, and their stepped pixel glows
const RARITY_COLOR = Object.fromEntries(Object.entries(RARITY_RAW).map(([k, v]) => [k, calm(v as string)])) as typeof RARITY_RAW;
const rcStyle = (r: Rarity) => ({ '--rc': RARITY_COLOR[r], '--rc-glow': `url("${pxGlowURL(RARITY_COLOR[r], 48, 0.75)}")` }) as JSX.CSSProperties;
import { collectAdventure } from '../game/night.ts';
import { dayKey, edit, save } from '../game/store.ts';
import { nightKey, stickerFor } from '../game/routine.ts';
import type { Find } from '../game/adventure.ts';
import { PIECES } from '../owl/outfits.ts';
import { PALETTE } from '../owl/palette.ts';
import { getClip, listClips, type ClipMeta, type SleepSession, type Stage } from '../sleep/index.ts';
import { Px } from './icons.tsx';
import { fmtDur, fmtTime, Sheet, tap, toast } from './kit.tsx';
import { CountUp, Letters } from './text3d.tsx';
import { coatIcon, itemIcon, pieceIcon } from './portraits.ts';
import { lines, panel, say, sceneRef } from './state.ts';
import { TalkText } from './talkview.tsx'; // [dialog10] the caption types on like a voice
import { progress } from '../game/quests.ts';
import { flyReward } from './fx.tsx';
import { voice, type Tts } from './voice.ts';
import { playArrival } from '../world/cinematics.ts';
import { GIFT_LOOK, present, sack, stickerURL } from './px/sleepprops.ts';
import { injectSleepFrames, PaintCanvas, Paper } from './sleepkit.tsx';
import { paintPresent } from './real/present.ts';
import { uiBurst } from './chrome/uifx.ts';
import { fxMoment } from './fx/moment.ts'; // [fx10]
import { Postcard } from './globe/postcard.tsx'; // [postcard]
import { postcardDate } from '../game/postcards.ts';
import './morning.css';

// ------------------------------------------------------------------ the night report

const STAGE_Y: Record<Stage, number> = { awake: 0, rem: 1, light: 2, deep: 3 };
const STAGE_C: Record<Stage, string> = { awake: '#ceb39d', rem: '#938ca4', light: '#9ab0be', deep: '#516271' };

export function Hypnogram(p: { s: SleepSession; h12: boolean; compact?: boolean }) {
  const st = p.s.stages ?? [];
  if (!st.length) return null;
  const W = 320, H = p.compact ? 64 : 120, top = p.compact ? 5 : 8, rowH = p.compact ? 14 : 24, n = st.length;
  const x = (i: number) => (i / n) * W;
  let d = '';
  st.forEach((s, i) => { const y = top + STAGE_Y[s] * rowH; d += (i ? `L${x(i)} ${y}` : `M0 ${y}`) + `L${x(i + 1)} ${y}`; });
  const start = p.s.start, end = p.s.end ?? start + n * 30000;
  const hours: number[] = [];
  for (let t = Math.ceil(start / 3.6e6) * 3.6e6; t < end; t += 3.6e6) hours.push(t);
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} width="100%" aria-label="Sleep stages through the night">
      {(['awake', 'rem', 'light', 'deep'] as Stage[]).map((k) => <g><rect x="0" y={top + STAGE_Y[k] * rowH - rowH * 0.38} width={W} height={rowH * 0.76} fill={STAGE_C[k]} opacity=".14" />{!p.compact && <text x="3" y={top + STAGE_Y[k] * rowH + 4} font-size="9" font-weight="800" fill={STAGE_C[k]} opacity=".9">{k === 'rem' ? 'REM' : k[0].toUpperCase() + k.slice(1)}</text>}</g>)}
      {st.map((s, i) => (i % 2 === 0 ? <rect x={x(i)} y={top + STAGE_Y[s] * rowH - rowH * 0.25} width={Math.max(0.6, x(i + 2) - x(i))} height={rowH * 0.5} fill={STAGE_C[s]} opacity=".55" /> : null))}
      <path d={d} fill="none" stroke="#382d22" stroke-width="2" stroke-linejoin="miter" shape-rendering="crispEdges" />
      {hours.map((t) => { const xx = ((t - start) / (end - start)) * W; return <g><line x1={xx} y1={top - 4} x2={xx} y2={H - 4} stroke="#382d22" stroke-opacity=".15" stroke-dasharray="2 3" /><text x={xx} y={H + 14} font-size="10" font-weight="700" text-anchor="middle" fill="#8f7665">{new Date(t).toLocaleTimeString([], { hour: 'numeric', hour12: p.h12 }).replace(':00', '')}</text></g>; })}
    </svg>
  );
}

const MOODS = ['Groggy', 'Meh', 'Okay', 'Good', 'Wonderful'];

function Clips(p: { id: string }) {
  const [clips, setClips] = useState<ClipMeta[]>([]);
  useEffect(() => { void listClips(p.id).then(setClips).catch(() => setClips([])); }, [p.id]);
  if (!clips.length) return null;
  const play = async (id: string) => { const b = await getClip(id); if (b) { const a = new Audio(URL.createObjectURL(b)); void a.play(); } };
  return (
    <div class="card col"><h3>Night sounds</h3>
      {clips.map((c) => <button class="row" style="text-align:left" onClick={() => { tap(); void play(c.id); }}><Px name="play" size={40} /><span class="grow">{c.kind === 'snore' ? 'Snoring' : 'Sleep talk'} · {fmtTime(c.t, save.value.settings.hour12)}</span><span class="small muted">{Math.round(c.dur ?? 0)}s</span></button>)}
    </div>
  );
}

/** Last night in Pip's journal: score seal, the ink hypnogram, four numbers, notes, your mood. */
export function NightReport(p: { s: SleepSession; onNext?: () => void; onClose?: () => void }) {
  const s = p.s, r = s.report!, h12 = save.value.settings.hour12;
  const qual = { restless: 'A restless night', okay: 'An okay night', good: 'A good night', great: 'A wonderful night' }[r.quality];
  const setMood = (n: number) => { tap('stamp', 0.5); edit((x) => { const ni = x.nights.find((y) => y.id === s.id); if (ni) ni.mood = n; }); progress('mood'); };
  const mood = save.value.nights.find((y) => y.id === s.id)?.mood;
  return (
    <Sheet title={qual} sub={new Date(s.start).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + (s.simulated ? ' · demo night' : '')} onClose={p.onClose}>
      <div class="journal-cover"><div class="page col gap-lg">
        <div class="row" style="gap:16px">
          <div class="seal"><div><b><CountUp value={r.score} from={0} /></b><small>SCORE</small></div></div>
          <div class="col" style="gap:2px">
            <div class="num" style="font-size:var(--t2)">{fmtDur(r.asleep)}</div>
            <div class="muted small">asleep · {fmtTime(r.asleepAt, h12)} – {fmtTime(r.wokeAt, h12)}</div>
            <div class="muted small">in bed {fmtDur(r.inBed)}{s.micUsed ? '' : ' · estimated'}</div>
          </div>
        </div>
        <Hypnogram s={s} h12={h12} />
        <div class="stats">
          <div class="stat"><b>{Math.round(r.latencyMin)} min</b><small>to fall asleep</small></div>
          <div class="stat"><b>{Math.round(r.deep * 100)}%</b><small>deep sleep</small></div>
          <div class="stat"><b>{r.awakenings}</b><small>times awake</small></div>
          <div class="stat"><b>{r.snoreMin >= 1 ? `${Math.round(r.snoreMin)} min` : 'none'}</b><small>snoring</small></div>
        </div>
        {r.notes.length > 0 && <div class="col" style="gap:6px">{r.notes.map((n) => <p class="note">“{n}”</p>)}</div>}
        <div><div class="label" style="margin-bottom:8px">How do you feel?</div>
          <div class="moods">{MOODS.map((m, i) => <button class={'mood' + (mood === i ? ' on' : '')} aria-pressed={mood === i} onClick={() => setMood(i)}><Px name={'mood' + i} size={44} /><small>{m}</small></button>)}</div>
        </div>
        <textarea class="field" placeholder="Dreams, thoughts, anything…" value={save.value.nights.find((y) => y.id === s.id)?.note ?? ''} onInput={(e) => { const v = (e.target as HTMLTextAreaElement).value; edit((x) => { const ni = x.nights.find((y) => y.id === s.id); if (ni) ni.note = v; }); if (v.trim().length > 3) progress('note'); }} />
      </div></div>
      {save.value.plus.active && <Clips id={s.id} />}
      {p.onNext && <button class="btn pillow honey big block" onClick={() => { tap('paper_flip', 0.6); p.onNext!(); }}><Px name="satchel" size={40} />See what Pip found</button>}
    </Sheet>
  );
}

// ------------------------------------------------------------------ what Pip found

export function findArt(f: { kind: string; id: string }) {
  const look = save.value.look;
  if (f.kind === 'trinket') return trinketUrl(f.id, 6);
  if (f.kind === 'item') return itemIcon(f.id);
  if (f.kind === 'piece') { const pc = PIECES.find((x) => x.id === f.id); return pc ? pieceIcon(f.id, pc.slot, look) : ''; }
  return coatIcon(f.id, PALETTE[f.id]?.skin ?? 'owl');
}
export function findName(f: { kind: string; id: string }) {
  if (f.kind === 'trinket') return TRINKET[f.id]?.name ?? f.id;
  if (f.kind === 'item') return ITEM_BY_ID[f.id]?.name ?? f.id;
  if (f.kind === 'piece') return PIECES.find((x) => x.id === f.id)?.name ?? f.id;
  return (PALETTE[f.id]?.name ?? f.id) + ' coat';
}
const RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
const wearable = (f: Find) => f.kind === 'piece' || f.kind === 'palette' || f.kind === 'skin' || f.kind === 'species';
/** a find's picture: the 3D render, or a sprite while it is not available */
function FindArt(p: { f: Find; size: number }) {
  const u = findArt(p.f);
  return u ? <img src={u} alt="" /> : <Px name={wearable(p.f) ? 'hanger' : 'chair'} size={p.size} />;
}

// ------------------------------------------------------------------ pixel confetti

interface Bit { x: number; y: number; vx: number; vy: number; c: string; w: number; h: number; life: number; spin: number }
type Burst = (x: number, y: number, colors: string[], n: number, scraps?: boolean) => void;
/** A full-screen pixel particle layer: paper scraps and confetti, drawn at 1/3 resolution. */
function Confetti(p: { api: { current: Burst | null } }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current!, g = c.getContext('2d')!, K = 3;
    const bits: Bit[] = [];
    const size = () => { c.width = Math.ceil(innerWidth / K); c.height = Math.ceil(innerHeight / K); };
    size();
    addEventListener('resize', size);
    const add: Burst = (x, y, colors, n, scraps) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 1.6 + Math.random() * 4;
        bits.push({ x: x / K + (Math.random() - 0.5) * 12, y: y / K + (Math.random() - 0.5) * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, c: colors[i % colors.length], w: scraps ? 2 + Math.floor(Math.random() * 3) : 1 + (i % 2), h: scraps ? 2 + Math.floor(Math.random() * 2) : 1 + ((i >> 1) % 2), life: 70 + Math.random() * 60, spin: Math.random() * 6 });
      }
      if (bits.length > 700) bits.splice(0, bits.length - 700);
    };
    p.api.current = add;
    let raf = 0;
    const draw = () => {
      g.clearRect(0, 0, c.width, c.height);
      for (const b of bits) { g.fillStyle = b.c; g.fillRect(Math.round(b.x), Math.round(b.y), Math.max(1, Math.round(b.w * Math.abs(Math.sin(b.spin)))), b.h); }
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.vy += 0.14; b.vx *= 0.985; b.vy *= 0.985; b.x += b.vx; b.y += b.vy; b.life--; b.spin += 0.3;
        if (b.life <= 0 || b.y > c.height + 4) bits.splice(i, 1);
      }
      draw();
    };
    // (dev) a frozen screenshot shows a burst caught in mid-air
    if ((window as unknown as { __giftStage?: unknown }).__giftStage) {
      (window as unknown as { __confetti: () => void }).__confetti = () => {
        for (const b of bits) { for (let k = 0; k < 9; k++) { b.vy += 0.14; b.x += b.vx; b.y += b.vy; } b.spin += 1; }
        draw();
      };
    } else raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); p.api.current = null; };
  }, []);
  return <canvas ref={cv} class="mr-confetti px" aria-hidden="true" />;
}

// ------------------------------------------------------------------ the morning flow

type Step = 'arrive' | 'sack' | 'gift' | 'haul';
const PAPER_COLORS: Record<string, string[]> = {
  common: ['#869271', '#adb794', '#ebdcc6', '#647253'], uncommon: ['#6f8368', '#9cb295', '#e9d5ae', '#53674c'],
  rare: ['#738996', '#9bb2be', '#f7f1e6', '#526673'], legendary: ['#e6d0aa', '#eae4d7', '#9d756d', '#c1a98b'],
};
const CONFETTI = ['#e9d5ae', '#cda1a4', '#9bb2be', '#a2ae8c', '#f6f2e6', '#a09bb4'];

/** Dev/screenshot hook: window.__giftStage = { step, gift, stage, t } jumps straight to a moment. */
type DevGift = { step?: Step; gift?: number; stage?: number; t?: number };
const devGift = (): DevGift | null => (window as unknown as { __giftStage?: DevGift }).__giftStage ?? null;

export function Morning() {
  injectSleepFrames();
  const pend = save.value.pending;
  const adv = pend?.adventure;
  const night = save.value.nights.find((n) => n.id === pend?.sessionId);
  const dev = devGift();
  const finds = useMemo(() => [...(adv?.finds ?? [])].sort((a, b) => RANK[a.rarity] - RANK[b.rarity]), [adv]);
  const [step, setStep] = useState<Step>(dev?.step ?? 'arrive');
  const [gi, setGi] = useState(dev?.gift ?? 0);
  const [stage, setStage] = useState(dev?.stage ?? 0);
  const [stageT, setStageT] = useState(dev?.t ?? 0);
  const [sackOpen, setSackOpen] = useState(0);
  const [report, setReport] = useState(false);
  const confetti = useRef<Burst | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const cancelArrive = useRef<(() => void) | null>(null);

  // ---- the arrival cinematic
  useEffect(() => {
    if (step !== 'arrive') return;
    const sc = sceneRef.current;
    let done = false;
    const fin = () => { if (done) return; done = true; setStep('sack'); sound.play('wings_flutter', { volume: 0.4 }); if (finds.length) setTimeout(() => fxMoment('morning'), 450); /* [fx10] */ };
    if (!sc) { const id = setTimeout(fin, 1800); return () => clearTimeout(id); }
    try {
      cancelArrive.current = playArrival(sc, { onLanded: () => { sc.owl.setMood('happy', 3); sound.play('owl_hoot', { volume: 0.5 }); sc.owl.react('starry', finds.length ? 'sparkle' : 'notes', 2.4); /* [fx10] */ }, onDone: fin });
    } catch { fin(); }
    const id = setTimeout(fin, 14000);
    return () => clearTimeout(id);
  }, []);
  // (dev) show a burst of paper mid-air for a frozen screenshot
  useEffect(() => {
    if (!dev || dev.step !== 'gift' || (dev.stage ?? 0) < 2) return;
    const id = setTimeout(() => {
      const r = boxRef.current?.getBoundingClientRect();
      if (!r || !finds[gi]) return;
      confetti.current?.(r.left + r.width / 2, r.top + r.height * 0.55, PAPER_COLORS[finds[gi].rarity], 80, true);
      confetti.current?.(r.left + r.width / 2, r.top + r.height * 0.4, CONFETTI, 50);
      (window as unknown as { __confetti?: () => void }).__confetti?.();
    }, 300);
    return () => clearTimeout(id);
  }, []);
  const skipArrive = () => { try { cancelArrive.current?.(); } catch { /* */ } const sc = sceneRef.current; if (sc && sc.owlPlace === 'away') sc.placeOwl('porch'); setStep('sack'); };

  if (!pend || !adv || !night) return null;
  const area = AREA[adv.area];
  const f = finds[gi];
  const look = f ? GIFT_LOOK[f.rarity] ?? GIFT_LOOK.common : GIFT_LOOK.common;

  // ---- unwrapping: ribbon, paper, lid; each stage animates t from 0 to 1
  const animStage = (to: number, ms: number, then?: () => void) => {
    setStage(to); setStageT(0);
    const t0 = performance.now();
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / ms); setStageT(k); if (k < 1) requestAnimationFrame(tick); else then?.(); };
    requestAnimationFrame(tick);
  };
  const boxCentre = () => { const r = boxRef.current?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height * 0.55 } : { x: innerWidth / 2, y: innerHeight / 2 }; };
  const unwrap = () => {
    if (!f || stage > 0) return;
    sound.play('fabric', { volume: 0.6 });
    animStage(1, 380, () => {
      sound.play('paper_flip', { volume: 0.7, rate: 0.8 });
      setTimeout(() => sound.play('rustle_bush', { volume: 0.4 }), 80);
      const c = boxCentre();
      confetti.current?.(c.x, c.y, PAPER_COLORS[f.rarity] ?? PAPER_COLORS.common, 70, true);
      uiBurst('puff', c.x, c.y, 10);
      animStage(2, 520, () => {
        animStage(3, 420, () => {
          const big = f.rarity === 'legendary' || f.rarity === 'rare';
          sound.play(big ? 'reward_unlock' : 'reward_gem', { volume: 0.6 });
          if (big) setTimeout(() => sound.play('sparkle', { volume: 0.6 }), 300);
          const c2 = boxCentre();
          confetti.current?.(c2.x, c2.y - 40, CONFETTI, big ? 120 : 60);
          uiBurst(big ? 'stars' : 'sparkle', c2.x, c2.y - 60, big ? 24 : 12);
          setStage(4);
        });
      });
    });
  };
  const next = () => {
    tap('ui_tap', 0.5);
    if (gi + 1 < finds.length) { setGi(gi + 1); setStage(0); setStageT(0); sound.play('pet_jump', { volume: 0.35 }); }
    else { setStep('haul'); sound.play('reward_quest', { volume: 0.45 }); }
  };
  const openSack = () => {
    if (sackOpen > 0) return;
    sound.play('drawer', { volume: 0.5, rate: 0.8 });
    const t0 = performance.now();
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / 650); setSackOpen(k); if (k < 1) requestAnimationFrame(tick); else setTimeout(() => { sound.play('sparkle', { volume: 0.5 }); setStep(finds.length ? 'gift' : 'haul'); }, 250); };
    requestAnimationFrame(tick);
  };
  const collect = (then?: () => void) => {
    tap('coin_purse', 0.7);
    sound.play('reward_coin', { volume: 0.6 });
    const a = adv;
    collectAdventure();
    flyReward('acorn', a.coins);
    setTimeout(() => flyReward('star', a.xp, { x: innerWidth / 2, y: innerHeight * 0.6 }), 300);
    if (a.gems) setTimeout(() => flyReward('moonstone', a.gems * 10), 600);
    const sc = sceneRef.current;
    if (sc) { sc.owl.play('dance'); const o = sc.owl.node.position; sc.fx.burst('coins', o.x, o.y + 0.8, o.z + 0.3, 14); }
    toast(`+${a.coins} acorns · +${a.xp} XP${a.gems ? ` · +${a.gems} moon gems` : ''}`);
    setTimeout(() => say(lines.morning(save.value.name)), 1200);
    then?.();
  };

  return (
    <div class={'mr step-' + step}>
      {step === 'arrive' && (
        <div class="cine dawn-cine" onClick={() => { tap('ui_tap', 0.3); skipArrive(); }}>
          <div class="bar top" /><div class="bar bot" />
          <div class="cine-cap hh-cap"><TalkText text={`${save.value.name} is flying home with a *bundle*...`} opts={{ size: innerWidth < 600 ? 22 : 26, maxWidth: Math.min(innerWidth - 24, 620), anchor: 'bottom', voice: 'narrator', scrim: 0.3, tag: false }} /></div>
          <span class="cine-skip">Tap to skip</span>
        </div>
      )}
      {step !== 'arrive' && <div class="mr-sky" />}
      {step !== 'arrive' && <PxBurst class={'mr-rays' + (f && stage >= 3 && step === 'gift' ? ' on r-' + f.rarity : '')} size={Math.min(1100, Math.max(innerWidth, innerHeight) * 1.2)} scale={4} color={f && stage >= 3 && step === 'gift' ? RARITY_COLOR[f.rarity] : '#f4eedd'} glow="#f1d39a" rays={16} alpha={f && stage >= 3 && step === 'gift' ? 0.45 : 0.22} spin={f && stage >= 3 ? 0.03 : 0.01} />}

      {step === 'sack' && (
        <div class="mr-stage">
          <div class="mr-sign hh-wood"><h2><Letters text={finds.length ? `${save.value.name} brought presents!` : `${save.value.name} is home!`} mode="wave" /></h2></div>
          <p class="mr-sub">{finds.length ? `${finds.length} ${finds.length === 1 ? 'gift' : 'gifts'} from ${area?.name ?? 'the woods'}` : 'A short trip this time. Sleep 5 hours or more and the sack comes home full.'}</p>
          <button class={'mr-sack' + (sackOpen > 0 ? ' opening' : '')} onClick={openSack} aria-label="Open Pip's gift sack">
            <img class="px mr-sackimg" src={giftSack(Math.round(sackOpen * 4) / 4, 4)} width={224} height={232} alt="" draggable={false} />
          </button>
          <p class="mr-hint"><Px name="cursor_hand" size={30} />Tap the sack</p>
        </div>
      )}

      {step === 'gift' && f && (
        <div class="mr-stage">
          <p class="mr-count">Gift {gi + 1} of {finds.length}</p>
          <div class={'mr-box stage' + stage + ' rar-' + f.rarity} ref={boxRef} style={rcStyle(f.rarity)}
            onClick={unwrap} role="button" aria-label="Pull the ribbon to unwrap">
            <span class="glow" />
            {stage < 4 && <PaintCanvas w={220} h={240} fps={stage === 0 ? 8 : 0} deps={[stage, Math.round(stageT * 20), gi]} label={`A wrapped ${RARITY_NAME[f.rarity].toLowerCase()} present`}
              draw={(g, t) => { g.scale(5, 5); paintPresent(g, look, Math.min(3, stage), stage === 0 ? 0 : stageT, Math.floor(t * 8)); }} />}
            {stage >= 3 && <div class={'mr-item' + (stage === 3 ? ' rising' : '')}><span class="mr-item-art"><FindArt f={f} size={96} /></span></div>}
          </div>
          {stage === 0 && <p class="mr-hint pull"><Px name="cursor_hand" size={30} />Pull the ribbon</p>}
          {stage >= 4 && (
            <div class="mr-card">
              <span class="mr-rarity" style={{ '--rc': RARITY_COLOR[f.rarity] } as JSX.CSSProperties}>{f.dupe ? 'Another one!' : RARITY_NAME[f.rarity]}</span>
              <h2>{findName(f)}</h2>
              <p>{f.dupe ? 'It waits in your storage.' : f.kind === 'item' ? 'New furniture for the hollow.' : 'Something new to wear.'}</p>
              <div class="mr-actions">
                <button class="hh-btn-green" onClick={() => collect(() => { panel.value = wearable(f) ? 'wardrobe' : 'build'; })}><Px name={wearable(f) ? 'hanger' : 'hammer'} size={30} />{wearable(f) ? 'Try it on' : 'Place it'}</button>
                <button class="hh-btn-gold" onClick={next}>{gi + 1 < finds.length ? 'Next gift' : 'See it all'}<Px name="arrow_right" size={30} /></button>
              </div>
            </div>
          )}
          <div class="mr-queue">{finds.map((q, i) => (i > gi ? <span class="q" style={{ animationDelay: `${i * 0.2}s` }}><PaintCanvas w={88} h={96} fps={0} draw={(g) => { g.scale(2, 2); paintPresent(g, GIFT_LOOK[q.rarity], 0, 0, 0); }} /></span> : null))}</div>
        </div>
      )}

      {step === 'haul' && <Haul finds={finds} night={night} onReport={() => setReport(true)} onCollect={collect} />}
      <Confetti api={confetti} />
      {report && <div class="mr-modal"><NightReport s={night} onClose={() => setReport(false)} /></div>}
    </div>
  );
}

/** Today's haul: the gifts on a shelf, rewards, the streak strip, tomorrow's teaser, last night. */
function Haul(p: { finds: Find[]; night: SleepSession; onReport: () => void; onCollect: (then?: () => void) => void }) {
  const s = save.value, adv = s.pending!.adventure, r = p.night.report!;
  const [tts, setTts] = useState<Tts | null>(null);
  const [reading, setReading] = useState(false);
  useEffect(() => { let on = true; void voice().then((t) => { if (on && t) { setTts(t); t.onState((st) => setReading(st.state === 'speaking' || st.state === 'paused')); } }); return () => { on = false; }; }, []);
  useEffect(() => () => tts?.stop(), [tts]);
  // the last seven mornings
  const strip = useMemo(() => {
    const by = new Map<string, SleepSession>();
    for (const n of s.nights) if (n.report) by.set(nightKey(n), n);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = dayKey(d.getTime()); return { k, d, n: by.get(k) }; });
  }, [s.nights]);
  const long = r.asleep >= 7 * 3600_000;
  return (
    <div class="mr-haul">
      <div class="mr-sign hh-wood"><h2>Today's haul</h2></div>
      <div class="haul-board hh-wood-dark">
        <div class="haul-shelf">
          {p.finds.map((f) => (
            <div class="haul-item" style={rcStyle(f.rarity)}>
              <span class="art"><FindArt f={f} size={52} /></span>
              <b>{findName(f)}</b>
              <small>{f.dupe ? 'Another one' : RARITY_NAME[f.rarity]}</small>
              <button class="hh-btn-cream" onClick={() => p.onCollect(() => { panel.value = wearable(f) ? 'wardrobe' : 'build'; })}>{wearable(f) ? 'Try it on' : 'Place it'}</button>
            </div>
          ))}
          {!p.finds.length && <p class="haul-none">No presents this time, but plenty of stories.</p>}
        </div>
        <div class="haul-rewards">
          <span><Px name="owlcoin" size={40} />+{adv.coins}<small>acorns</small></span>
          <span><Px name="star" size={40} />+{adv.xp}<small>XP</small></span>
          {adv.gems > 0 && <span><Px name="moongem" size={40} />+{adv.gems}<small>moon gems</small></span>}
        </div>
        {/* [postcard] the first night at a place mails its postcard home */}
        {adv.postcard && AREA[adv.postcard] && (
          <div class="haul-postcard">
            <Postcard a={AREA[adv.postcard]} date={postcardDate(s, adv.postcard) ?? Date.now()} />
            <div><b>A postcard from {AREA[adv.postcard].name}!</b><small>Your first night there. It’s in your passport now; tap it to read Pip’s note.</small></div>
          </div>
        )}
      </div>

      <div class="haul-row">
        <Paper kind="cream" opts={{ edge: 0.3, seed: 8 }} class="haul-streak">
          <div class="hs-head"><b>{s.streak > 0 ? `${s.streak}-night streak` : 'A fresh start'}</b><span>best {s.bestStreak}</span></div>
          <div class="hs-days">
            {strip.map((x) => (
              <span class={'hs-day' + (x.k === dayKey() ? ' today' : '')}>
                <small>{x.d.toLocaleDateString([], { weekday: 'narrow' })}</small>
                {x.n ? <img src={stickerURL(stickerFor(x.n.report!.score), 2)} alt="" /> : <i />}
              </span>
            ))}
          </div>
        </Paper>
        <Paper kind="sticky" opts={{ sticky: 1, seed: 5 }} class="haul-tease">
          <span class="tease-gift"><PaintCanvas w={88} h={96} fps={6} draw={(g, t) => { g.scale(2, 2); paintPresent(g, GIFT_LOOK.legendary, 0, 0, Math.floor(t * 6)); }} /><b>?</b></span>
          <span class="tease-txt"><b>Tomorrow</b>{long ? 'Sleep 7h+ again and Pip looks somewhere rarer.' : 'A rarer gift if you sleep 7 hours or more.'}</span>
        </Paper>
      </div>

      <button class="haul-report" onClick={() => { tap('paper_flip', 0.5); p.onReport(); }}>
        <Paper kind="notebook" opts={{ rules: 8, ruleTop: 10, margin: 10, seed: 2 }} class="hr-paper">
          <span class="seal hr-seal"><span><b><CountUp value={r.score} from={0} /></b><small>SCORE</small></span></span>
          <span class="hr-txt"><b>{fmtDur(r.asleep)} asleep</b><small>{fmtTime(r.asleepAt, s.settings.hour12)} – {fmtTime(r.wokeAt, s.settings.hour12)}</small><Hypnogram s={p.night} h12={s.settings.hour12} compact /></span>
          <span class="hr-more">Report ›</span>
        </Paper>
      </button>

      {adv.story.length > 0 && <Paper kind="parchment" opts={{ edge: 0.5, deckle: 1, seed: 4 }} class="haul-story">
        {tts && <button class={'read-aloud icon-btn' + (reading ? ' on' : '')} aria-label={reading ? 'Stop reading' : 'Hear Pip tell it'} onClick={() => { tap('ui_tap', 0.4); if (reading) { tts.stop(); return; } tts.speak(adv.story.map((text) => ({ text, voice: 'rounded', rate: 0.92 })), { voice: 'rounded' }).catch(() => setReading(false)); }}><Px name={reading ? 'pause' : 'speaker_on'} size={40} /></button>}
        <b>From {s.name}'s travel journal</b>
        {adv.story.map((l) => <p>{l}</p>)}
      </Paper>}

      <button class="hh-btn-gold haul-go" onClick={() => p.onCollect()}><Px name="owlcoin" size={40} />Collect and start the day</button>
    </div>
  );
}
