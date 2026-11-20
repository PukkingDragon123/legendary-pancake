// The morning: last night written up in Pip's journal (score seal, an ink hypnogram, the numbers that
// matter, a few friendly notes, your mood), then the adventure story and the treasure reveal.
import { useEffect, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { AREA, ITEM_BY_ID, RARITY_COLOR, RARITY_NAME, TRINKET, trinketUrl } from '../game/catalog.ts';
import { collectAdventure } from '../game/night.ts';
import { edit, save } from '../game/store.ts';
import { PIECES } from '../owl/outfits.ts';
import { PALETTE } from '../owl/palette.ts';
import { getClip, listClips, type ClipMeta, type SleepSession, type Stage } from '../sleep/index.ts';
import { IcoAcorn, IcoPlay, IcoSatchel, IcoStar, IcoStone, Px } from './icons.tsx';
import { fmtDur, fmtTime, Sheet, tap, toast } from './kit.tsx';
import { coatIcon, itemIcon, pieceIcon } from './portraits.ts';
import { lines, say, sceneRef } from './state.ts';
import { progress } from '../game/quests.ts';
import { flyReward } from './fx.tsx';
import { voice, type Tts } from './voice.ts';

const STAGE_Y: Record<Stage, number> = { awake: 0, rem: 1, light: 2, deep: 3 };
const STAGE_C: Record<Stage, string> = { awake: '#f2a65a', rem: '#9a7ae0', light: '#7fb0e8', deep: '#3f5aa8' };

export function Hypnogram(p: { s: SleepSession; h12: boolean }) {
  const st = p.s.stages ?? [];
  if (!st.length) return null;
  const W = 320, H = 120, top = 8, rowH = 24, n = st.length;
  const x = (i: number) => (i / n) * W;
  let d = '';
  st.forEach((s, i) => { const y = top + STAGE_Y[s] * rowH; d += (i ? `L${x(i)} ${y}` : `M0 ${y}`) + `L${x(i + 1)} ${y}`; });
  const start = p.s.start, end = p.s.end ?? start + n * 30000;
  const hours: number[] = [];
  for (let t = Math.ceil(start / 3.6e6) * 3.6e6; t < end; t += 3.6e6) hours.push(t);
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} width="100%" aria-label="Sleep stages through the night">
      {(['awake', 'rem', 'light', 'deep'] as Stage[]).map((k) => <g><rect x="0" y={top + STAGE_Y[k] * rowH - 9} width={W} height="18" rx="6" fill={STAGE_C[k]} opacity=".12" /><text x="3" y={top + STAGE_Y[k] * rowH + 4} font-size="9" font-weight="800" fill={STAGE_C[k]} opacity=".9">{k === 'rem' ? 'REM' : k[0].toUpperCase() + k.slice(1)}</text></g>)}
      {st.map((s, i) => (i % 2 === 0 ? <rect x={x(i)} y={top + STAGE_Y[s] * rowH - 6} width={Math.max(0.6, x(i + 2) - x(i))} height="12" fill={STAGE_C[s]} opacity=".55" /> : null))}
      <path d={d} fill="none" stroke="#3a2718" stroke-width="2" stroke-linejoin="round" />
      {hours.map((t) => { const xx = ((t - start) / (end - start)) * W; return <g><line x1={xx} y1={top - 6} x2={xx} y2={H - 4} stroke="#3a2718" stroke-opacity=".15" stroke-dasharray="2 3" /><text x={xx} y={H + 14} font-size="10" font-weight="700" text-anchor="middle" fill="#8f7663">{new Date(t).toLocaleTimeString([], { hour: 'numeric', hour12: p.h12 }).replace(':00', '')}</text></g>; })}
    </svg>
  );
}

const MOODS = ['Groggy', 'Meh', 'Okay', 'Good', 'Wonderful'];
function MoodFace(p: { n: number }) { return <Px name={'mood' + p.n} size={40} />; }

function Clips(p: { id: string }) {
  const [clips, setClips] = useState<ClipMeta[]>([]);
  useEffect(() => { void listClips(p.id).then(setClips).catch(() => setClips([])); }, [p.id]);
  if (!clips.length) return null;
  const play = async (id: string) => { const b = await getClip(id); if (b) { const a = new Audio(URL.createObjectURL(b)); void a.play(); } };
  return (
    <div class="card col"><h3>Night sounds</h3>
      {clips.map((c) => <button class="row" style="text-align:left" onClick={() => { tap(); void play(c.id); }}><IcoPlay size={40} /><span class="grow">{c.kind === 'snore' ? 'Snoring' : 'Sleep talk'} · {fmtTime(c.t, save.value.settings.hour12)}</span><span class="small muted">{Math.round(c.dur ?? 0)}s</span></button>)}
    </div>
  );
}

export function NightReport(p: { s: SleepSession; onNext?: () => void; onClose?: () => void }) {
  const s = p.s, r = s.report!, h12 = save.value.settings.hour12;
  const qual = { restless: 'A restless night', okay: 'An okay night', good: 'A good night', great: 'A wonderful night' }[r.quality];
  const setMood = (n: number) => { tap('stamp', 0.5); edit((x) => { const ni = x.nights.find((y) => y.id === s.id); if (ni) ni.mood = n; }); progress('mood'); };
  const mood = save.value.nights.find((y) => y.id === s.id)?.mood;
  return (
    <Sheet title={qual} sub={new Date(s.start).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + (s.simulated ? ' · demo night' : '')} onClose={p.onClose}>
      <div class="journal-cover"><div class="page col gap-lg">
        <div class="row" style="gap:16px">
          <div class="seal"><div><b>{r.score}</b><small>SCORE</small></div></div>
          <div class="col" style="gap:2px">
            <div class="num" style="font-size:30px">{fmtDur(r.asleep)}</div>
            <div class="muted small">asleep · {fmtTime(r.asleepAt, h12)} – {fmtTime(r.wokeAt, h12)}</div>
            <div class="muted small">in bed {fmtDur(r.inBed)}{s.micUsed ? '' : ' · estimated'}</div>
          </div>
        </div>
        <Hypnogram s={s} h12={h12} />
        <div class="stats">
          <div class="stat"><b>{Math.round(r.efficiency * 100)}%</b><small>of time in bed asleep</small></div>
          <div class="stat"><b>{Math.round(r.latencyMin)} min</b><small>to fall asleep</small></div>
          <div class="stat"><b>{Math.round(r.deep * 100)}%</b><small>deep sleep</small></div>
          <div class="stat"><b>{Math.round(r.rem * 100)}%</b><small>dreaming (REM)</small></div>
          <div class="stat"><b>{r.awakenings}</b><small>times awake</small></div>
          <div class="stat"><b>{Math.round(r.snoreMin)} min</b><small>snoring</small></div>
        </div>
        {r.notes.length > 0 && <div class="col" style="gap:6px">{r.notes.map((n) => <p class="note">“{n}”</p>)}</div>}
        <div><div class="label" style="margin-bottom:8px">How do you feel?</div>
          <div class="moods">{MOODS.map((m, i) => <button class={'mood' + (mood === i ? ' on' : '')} aria-label={m} onClick={() => setMood(i)}><MoodFace n={i} /></button>)}</div>
        </div>
        <textarea class="field" placeholder="Dreams, thoughts, anything…" value={save.value.nights.find((y) => y.id === s.id)?.note ?? ''} onInput={(e) => { const v = (e.target as HTMLTextAreaElement).value; edit((x) => { const ni = x.nights.find((y) => y.id === s.id); if (ni) ni.note = v; }); if (v.trim().length > 3) progress('note'); }} />
      </div></div>
      {save.value.plus.active && <Clips id={s.id} />}
      {p.onNext && <button class="btn pillow honey big block" onClick={() => { tap('paper_flip', 0.6); p.onNext!(); }}><IcoSatchel size={40} />See what Pip found</button>}
    </Sheet>
  );
}

function findArt(f: { kind: string; id: string }) {
  const look = save.value.look;
  if (f.kind === 'trinket') return trinketUrl(f.id, 6);
  if (f.kind === 'item') return itemIcon(f.id);
  if (f.kind === 'piece') { const pc = PIECES.find((x) => x.id === f.id); return pc ? pieceIcon(f.id, pc.slot, look) : ''; }
  return coatIcon(f.id, PALETTE[f.id]?.skin ?? 'owl');
}
function findName(f: { kind: string; id: string }) {
  if (f.kind === 'trinket') return TRINKET[f.id]?.name ?? f.id;
  if (f.kind === 'item') return ITEM_BY_ID[f.id]?.name ?? f.id;
  if (f.kind === 'piece') return PIECES.find((x) => x.id === f.id)?.name ?? f.id;
  return (PALETTE[f.id]?.name ?? f.id) + ' coat';
}

export function Treasure(p: { onDone: () => void }) {
  const pend = save.value.pending;
  const [stage, setStage] = useState<'story' | 'open'>('story');
  const [shown, setShown] = useState(0);
  const adv = pend?.adventure;
  useEffect(() => {
    if (!adv) return;
    if (stage === 'story' && shown < adv.story.length) { const id = setTimeout(() => { setShown(shown + 1); sound.play('pencil', { volume: 0.35 }); }, shown ? 1300 : 400); return () => clearTimeout(id); }
  }, [stage, shown, adv]);
  const [tts, setTts] = useState<Tts | null>(null);
  const [reading, setReading] = useState(false);
  useEffect(() => { let live = true; void voice().then((t) => { if (live && t) { setTts(t); t.onState((st) => setReading(st.state === 'speaking' || st.state === 'paused')); } }); return () => { live = false; }; }, []);
  useEffect(() => () => tts?.stop(), [tts]);
  if (!adv) return null;
  const area = AREA[adv.area];
  const readAloud = () => {
    if (!tts) return;
    tap('page', 0.4);
    if (reading) { tts.stop(); return; }
    setShown(adv.story.length);
    tts.speak(adv.story.map((text) => ({ text, voice: 'rounded', rate: 0.92 })), { voice: 'rounded' }).catch(() => setReading(false));
  };
  const open = () => {
    tap('reward_unlock', 0.7);
    setStage('open');
    const sc = sceneRef.current;
    if (sc) {
      sc.owl.play('present');
      const o = sc.owl.node.position;
      sc.fx.burst('sparkle', o.x, o.y + 1, o.z + 0.4, 20); sc.fx.burst('stars', o.x, o.y + 1, o.z + 0.4, 10);
    }
    adv.finds.forEach((f, i) => setTimeout(() => sound.play(f.rarity === 'legendary' || f.rarity === 'rare' ? 'reward_gem' : 'sparkle', { volume: 0.6 }), 500 + i * 380));
  };
  const collect = () => {
    tap('coin_purse', 0.7);
    sound.play('reward_coin', { volume: 0.6 });
    collectAdventure();
    flyReward('acorn', adv.acorns);
    setTimeout(() => flyReward('star', adv.xp, { x: innerWidth / 2, y: innerHeight * 0.6 }), 300);
    if (adv.stones) setTimeout(() => flyReward('moonstone', adv.stones * 10), 600);
    const sc = sceneRef.current;
    if (sc) { sc.owl.play('dance'); const o = sc.owl.node.position; sc.fx.burst('coins', o.x, o.y + 0.8, o.z + 0.3, 14); }
    toast(`+${adv.acorns} acorns · +${adv.xp} XP${adv.stones ? ` · +${adv.stones} moonstones` : ''}`, IcoAcorn);
    setTimeout(() => say(lines.morning(save.value.name)), 1200);
    p.onDone();
  };
  return (
    <Sheet title={`Adventure in ${area?.name ?? 'the woods'}`} sub="From Pip's travel journal">
      <div class="card col" style="gap:10px">
        <span class="pin" />
        {tts && <button class={'read-aloud icon-btn' + (reading ? ' on' : '')} aria-label={reading ? 'Stop reading' : 'Hear Pip tell it'} onClick={readAloud}><Px name={reading ? 'pause' : 'speaker_on'} size={40} /></button>}
        {adv.story.slice(0, shown).map((l) => <p class="note" style="animation:rise .6s var(--ease)">{l}</p>)}
        {shown < adv.story.length && <p class="note" style="opacity:.5">…</p>}
      </div>
      {stage === 'story' ? (
        <button class="btn pillow honey big block" disabled={shown < adv.story.length} onClick={open}><IcoSatchel size={40} />{adv.finds.length ? 'Open the satchel' : 'Welcome home, Pip'}</button>
      ) : (
        <>
          <div class="loot-cards">
            {adv.finds.map((f, i) => (
              <div class="polaroid" style={{ '--rot': `${(i - (adv.finds.length - 1) / 2) * 5}deg`, '--delay': `${0.3 + i * 0.38}s`, '--glow': RARITY_COLOR[f.rarity] + '55' } as any}>
                <div class="shot"><img src={findArt(f)} alt="" /></div>
                <b>{findName(f)}</b>
                <span class="rarity" style={{ '--rc': RARITY_COLOR[f.rarity] } as any}>{f.dupe ? 'Another one!' : RARITY_NAME[f.rarity]}</span>
              </div>
            ))}
            {!adv.finds.length && <p class="muted center">A short trip, so no treasures this time. A full night of sleep means a fuller satchel!</p>}
          </div>
          <div class="row" style="justify-content:center;gap:16px;font-weight:800">
            <span class="row" style="gap:4px"><IcoAcorn size={40} />+{adv.acorns}</span>
            <span class="row" style="gap:4px"><IcoStar size={40} />+{adv.xp} XP</span>
            {adv.stones > 0 && <span class="row" style="gap:4px"><IcoStone size={40} />+{adv.stones}</span>}
          </div>
          <button class="btn pillow big block" onClick={collect}>Collect</button>
        </>
      )}
    </Sheet>
  );
}

/** The whole morning flow: report first, then the adventure. */
export function Morning() {
  const pend = save.value.pending;
  const [step, setStep] = useState<'report' | 'treasure'>('report');
  useEffect(() => {
    const sc = sceneRef.current;
    if (sc && sc.owlPlace === 'away') sc.arrive(() => { sc.owl.setMood("happy", 3); sound.play("owl_hoot", { volume: 0.5 }); });
  }, []);
  const night = save.value.nights.find((n) => n.id === pend?.sessionId);
  if (!pend || !night) return null;
  return step === 'report' ? <NightReport s={night} onNext={() => setStep('treasure')} /> : <Treasure onDone={() => {}} />;
}
