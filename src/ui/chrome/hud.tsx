// OWNED BY THE UI-CHROME BUILDER: the HUD and the home-screen controls.
//   Hud       carved wooden signs hanging by ropes and chains from leafy branches at the top edge:
//             Pip's name, portrait and the magic level bar (left); acorns and moon gems (right)
//   SideTools wooden tags strung on a rope down the right side (Build, Shop, Dress up, Quests,
//             Map, Settings) with animated pixel icons
//   MainNav   three big carved plaques on a shelf (Sleep, Clock, Book) with animated scenes
// Signs swing when tapped or hit by rewards and sway in the breeze; they are pulled up out of the
// way when a full-screen place opens and drop back in when it closes. Opening a place plays a
// pixel transition (transition.ts) and throws 2D pixel particles (uifx.ts).
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { bedtimeOf, phase } from '../../game/night.ts';
import { claimable, todaysQuests } from '../../game/quests.ts';
import { dayKey, level, save } from '../../game/store.ts';
import { portrait } from '../portraits.ts';
import { haptic } from '../kit.tsx';
import { breathing, panel, say, sceneRef, type Panel } from '../state.ts';
import { branch, chainTile, plank, plaque, ropeTile, shelf, tag, type Inner } from './paint.ts';
import { framesOf, hold, PxAnim, rep, seq, type Timeline } from './pxanim.tsx';
import { MagicBar } from './magicbar.tsx';
import { addSwing, kick, makeSwing, removeSwing, type Swing } from './swing.ts';
import { clearTransition, previewTransition, transition, type TransitionKind, type TransitionOpts } from './transition.ts';
import { lastPointer, uiAdvance, uiAmbient, uiBurst, uiBurstAt, type UiFxKind } from './uifx.ts';
import { installChromeSkin } from './skin.ts';
import './chrome.css';
import '../px/currency.js';

installChromeSkin();

/**
 * Lets another screen keep parts of the HUD up: 'currency' keeps the acorn and gem signs (e.g. a
 * shop that wants them), 'all' keeps everything, 'none' hides everything. null = automatic.
 */
export const hudOverride = signal<null | 'all' | 'currency' | 'none'>(null);

const hidden = () => phase.value !== 'day' || !!breathing.value || !save.value.onboarded;

/** How each place is entered. */
export const VIA: Partial<Record<NonNullable<Panel>, TransitionKind>> = {
  sleep: 'stars', clock: 'iris', book: 'page', build: 'blueprint', decorate: 'blueprint', shop: 'snow', wardrobe: 'iris', map: 'leaves', quests: 'leaves',
};
/** Open a place with its transition (and the screen point to centre an iris on). */
export function openPanel(id: Panel, o: TransitionOpts = {}) {
  if ((window as unknown as { __chromeHold?: boolean }).__chromeHold) return; // screenshots: stay on the press
  const k = id ? VIA[id] : undefined;
  if (!k) { panel.value = id; return; }
  if (id === 'wardrobe' && o.x === undefined) {
    const sc = sceneRef.current;
    if (sc) { const p = sc.screenOf(sc.owl.headWorld); o = { ...o, x: p.x, y: p.y }; }
  }
  void transition(k, () => { panel.value = id; }, { speed: id === 'quests' ? 1.5 : id === 'map' ? 1.2 : 1, ...o });
}

/** A pendulum bound to an element: returns [ref callback, swing]. */
function useSwing(o: Partial<Swing> = {}): [(el: HTMLElement | null) => void, Swing] {
  const s = useMemo(() => makeSwing(o), []);
  useEffect(() => { addSwing(s); return () => removeSwing(s); }, []);
  return [(el) => { s.el = el; }, s];
}

const px = (n: number) => `${n}px`;
const bg = (url: string) => (url ? `url("${url}")` : 'none');

// ------------------------------------------------------------------ rolling digits

/** A number on little carved wheels: each digit rolls to its new place. */
export function Odometer(p: { value: number }) {
  const s = Math.max(0, Math.round(p.value)).toLocaleString('en-US');
  const chars = [...s];
  return (
    <span class="hh-odo" aria-hidden="true">
      {chars.map((ch, i) => {
        const pos = chars.length - i;
        if (!/\d/.test(ch)) return <span key={'s' + pos} class="hh-sep">{ch}</span>;
        return (
          <span key={'d' + pos} class="hh-dig">
            <span class="hh-strip" style={{ transform: `translateY(${-Number(ch) * 10}%)`, transitionDelay: `${pos * 45}ms` }}>
              {'0123456789'.split('').map((d) => <i>{d}</i>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}

// ------------------------------------------------------------------ HUD

function Ropes(p: { xs: number[]; top: number; len: number; chain?: boolean }) {
  const tile = p.chain ? chainTile() : ropeTile();
  const w = p.chain ? 8 : 6;
  return <>{p.xs.map((x) => <i class={'hh-rope' + (p.chain ? ' chain' : '')} style={{ left: px(x - w / 2), top: px(p.top), height: px(p.len), width: px(w), backgroundImage: bg(tile) }} />)}</>;
}

const RANKS: [number, string][] = [[1, 'Fledgling'], [3, 'Owlet'], [5, 'Night Owl'], [8, 'Moon Watcher'], [12, 'Star Keeper'], [16, 'Dream Weaver']];
/** Pip's title for a level (shown on the name sign). */
export const rankOf = (lv: number) => RANKS.filter(([l]) => lv >= l).pop()![1];

function NameSign() {
  const s = save.value, lv = level.value;
  const [ref, sw] = useSwing({ amp: 0.7, rate: 0.8 });
  const [xp, setXp] = useState(false);
  const tm = useRef(0);
  const pic = useMemo(() => { try { return portrait(s.look); } catch { return ''; } }, [JSON.stringify(s.look)]);
  const night = (sceneRef.current?.sky.night ?? 0) > 0.5;
  const tapSign = () => {
    kick(sw, 70);
    sound.play('door_creak', { volume: 0.12, rate: 1.15 + Math.random() * 0.3, gap: 300 });
    sound.play('wood_knock', { volume: 0.35, gap: 80 });
    haptic(6);
    setXp(true); clearTimeout(tm.current); tm.current = window.setTimeout(() => setXp(false), 2600);
  };
  const long = s.name.length > 8;
  const rank = rankOf(lv.level), fits = s.name.length * (long ? 11 : 14) + rank.length * 7 + 8 < 128;
  return (
    <div class="hh-hang hh-namehang" ref={ref}>
      <Ropes xs={[52, 142]} top={-32} len={42} />
      <button class="hh-board hh-nameboard px" style={{ backgroundImage: bg(plank(96, 36, { seed: 4, nails: [[26, 4], [71, 4]], carve: true })) }} onClick={tapSign} aria-label={`${s.name}, level ${lv.level}, ${lv.into} of ${lv.need} experience`}>
        <span class={'hh-portrait' + (night ? ' night' : '')}>
          {pic ? <img class="hh-face" src={pic} alt="" draggable={false} /> : <span class="hh-face" />}
          <PxAnim tl={[['hud_ring', 1e9]]} size={64} class="hh-ring" />
        </span>
        <span class={'hh-name' + (long ? ' long' : '')}>{s.name}</span>
        {fits && <span class="hh-rank">{rank}</span>}
        <span class="hh-lvl">
          <MagicBar level={lv.level} into={lv.into} need={lv.need} w={56} />
          <span class={'hh-xp' + (xp ? ' on' : '')}>{lv.into} / {lv.need} XP</span>
        </span>
        <span class="hh-rune" key={lv.level}>
          <PxAnim tl={seq('hud_rune', 8, 180)} size={48} />
          <b>{lv.level}</b>
        </span>
      </button>
    </div>
  );
}

function CurrencySign(p: { kind: 'coin' | 'gem'; value: number; swing: [(el: HTMLElement | null) => void, Swing]; children?: ComponentChildren }) {
  const [ref, sw] = p.swing;
  const ico = useRef<HTMLSpanElement>(null);
  const name = p.kind === 'coin' ? 'owlcoin' : 'moongem';
  const tl = useMemo(() => framesOf(name, p.kind === 'coin' ? 120 : 140), []);
  const label = p.kind === 'coin' ? 'Acorns' : 'Moon gems';
  // a reward landing (flyReward adds .bump) jingles the whole sign
  useEffect(() => {
    const el = ico.current;
    if (!el) return;
    const mo = new MutationObserver(() => { if (el.classList.contains('bump')) { kick(sw, 28); uiBurstAt(el, p.kind === 'coin' ? 'sparkle' : 'magic', 2); } });
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  const tapSign = () => {
    kick(sw, 80);
    sound.play(p.kind === 'coin' ? 'coin_purse' : 'reward_gem', { volume: p.kind === 'coin' ? 0.3 : 0.18, rate: 1.1, gap: 200 });
    sound.play('wood_knock', { volume: 0.25, rate: 1.2, gap: 80 });
    haptic(5);
    uiBurstAt(ico.current, p.kind === 'coin' ? 'sparkle' : 'magic', 4);
  };
  const shop = (e: Event) => { e.stopPropagation(); sound.play('ui_open', { volume: 0.5 }); haptic(); uiBurstAt(e.currentTarget as Element, 'snow', 8); openPanel('shop'); };
  return (
    <div class={'hh-hang hh-curhang ' + p.kind} ref={ref}>
      <Ropes xs={[22, 102]} top={p.kind === 'coin' ? -28 : -16} len={p.kind === 'coin' ? 36 : 24} chain />
      <div class="hh-board hh-curboard px" style={{ backgroundImage: bg(plank(62, 20, { seed: p.kind === 'coin' ? 7 : 9, nails: [[11, 3], [51, 3]], tone: p.kind === 'coin' ? 'wood' : 'dwood' })) }} onClick={tapSign} role="group" aria-label={`${label}: ${p.value.toLocaleString()}`}>
        <span class={'hh-cur-ico ' + p.kind} data-chip={p.kind} ref={ico}>
          <PxAnim tl={tl} size={40} offset={p.kind === 'gem' ? 400 : 0} />
          {p.kind === 'coin' && <i class="hh-glint" />}
        </span>
        <span class="hh-num"><Odometer value={p.value} /></span>
        <button class="hh-plus" onClick={shop} aria-label={`Get more ${label.toLowerCase()} in the shop`}><span /></button>
      </div>
      {p.children}
    </div>
  );
}

export function Hud() {
  const s = save.value;
  const ov = hudOverride.value;
  const base = hidden(), pnl = panel.value;
  const nameAway = ov === 'none' || (ov !== 'all' && (base || pnl !== null));
  const curAway = ov === 'none' || (ov !== 'all' && ov !== 'currency' && (base || (pnl !== null && pnl !== 'shop')));
  const coinSw = useSwing({ amp: 0.9, rate: 1.0 });
  const gemSw = useSwing({ amp: 1.2, rate: 1.25, k: 30 });
  // the signs drop back in with a little swing
  const was = useRef({ name: nameAway, cur: curAway });
  useEffect(() => {
    if (was.current.cur && !curAway) setTimeout(() => { kick(coinSw[1], 40, 1); kick(gemSw[1], 70, -1); }, 380);
    if (was.current.name && !nameAway && !base) setTimeout(() => { uiBurst('leaves', 40, 30, 4); uiBurst('leaves', innerWidth - 40, 30, 3); }, 300);
    was.current = { name: nameAway, cur: curAway };
  }, [nameAway, curAway]);
  // purchases, quest claims: particles where it happened
  const prev = useRef({ coins: s.coins, gems: s.gems, claimed: claimedCount() });
  useEffect(() => save.subscribe((v) => {
    const p = prev.current, c = claimedCount();
    if (v.coins < p.coins) { const lp = lastPointer(); uiBurst('puff', lp.x, lp.y, 6); uiBurst('sparkle', lp.x, lp.y, 6); kick(coinSw[1], 45); }
    if (v.gems < p.gems) { const lp = lastPointer(); uiBurst('magic', lp.x, lp.y, 10); kick(gemSw[1], 55); }
    if (c > p.claimed) { const lp = lastPointer(); uiBurst('confetti', lp.x, lp.y, 26); uiBurst('stars', lp.x, lp.y, 8); }
    prev.current = { coins: v.coins, gems: v.gems, claimed: c };
  }), []);
  // fireflies drift over the signs at night
  useEffect(() => {
    const id = setInterval(() => {
      const night = (sceneRef.current?.sky.night ?? 0) > 0.55;
      uiAmbient(night && !hidden() && !panel.value ? { x: 0, y: 10, w: innerWidth, h: 200 } : null);
    }, 1200);
    return () => { clearInterval(id); uiAmbient(null); };
  }, []);
  return (
    <div class="hh-hud">
      <div class={'hh-left' + (nameAway ? ' away' : '')}>
        <div class="hh-lift"><NameSign /></div>
        <img class="hh-branch left px" src={branch(124, 18, 'left', 3)} alt="" draggable={false} />
      </div>
      <div class={'hh-right' + (curAway ? ' away' : '')}>
        <div class="hh-lift">
          <CurrencySign kind="coin" value={s.coins} swing={coinSw}>
            <CurrencySign kind="gem" value={s.gems} swing={gemSw} />
          </CurrencySign>
        </div>
        <img class="hh-branch right px" src={branch(92, 18, 'right', 8)} alt="" draggable={false} />
      </div>
    </div>
  );
}
function claimedCount() { try { return todaysQuests().filter((q) => q.claimed).length; } catch { return 0; } }

// ------------------------------------------------------------------ side tools

interface ToolDef { id: NonNullable<Panel>; label: string; tl: Timeline; act: Timeline; fx: UiFxKind }
const TOOLS: ToolDef[] = [
  { id: 'build', label: 'Build', tl: [['tool_build_0', 2600], ['tool_build_1', 90], ['tool_build_2', 120], ['tool_build_3', 90], ['tool_build_4', 120], ['tool_build_5', 260]], act: rep(seq('tool_build', 5, 70, 1), 2), fx: 'puff' },
  { id: 'shop', label: 'Shop', tl: seq('tool_shop', 6, 260), act: seq('tool_shop', 6, 80), fx: 'snow' },
  { id: 'wardrobe', label: 'Dress up', tl: [...seq('tool_dress', 8, 150), ['tool_dress_6', 1600]], act: rep(seq('tool_dress', 8, 60), 2), fx: 'hearts' },
  { id: 'quests', label: 'Quests', tl: [['tool_quest_0', 2400], ['tool_quest_1', 90], ['tool_quest_2', 90], ['tool_quest_3', 380], ['tool_quest_4', 1400]], act: seq('tool_quest', 4, 90), fx: 'stars' },
  { id: 'map', label: 'Map', tl: [['tool_map_0', 2800], ['tool_map_1', 120], ['tool_map_2', 1400], ['tool_map_3', 300], ['tool_map_2', 600], ['tool_map_1', 120]], act: [['tool_map_1', 90], ['tool_map_2', 200], ['tool_map_3', 260]], fx: 'leaves' },
  { id: 'settings', label: 'Settings', tl: seq('tool_gear', 4, 220), act: rep(seq('tool_gear', 4, 50), 3), fx: 'sparkle' },
];

function ToolTag(p: { t: ToolDef; i: number; badge?: number; isNew?: boolean }) {
  const [ref, sw] = useSwing({ amp: 1.1, rate: 1.1 + p.i * 0.07, k: 34 });
  const [act, setAct] = useState(0);
  const go = (e: MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    kick(sw, 120);
    setAct((n) => n + 1);
    sound.play('wood_knock', { volume: 0.35, rate: 1.3, gap: 60 });
    sound.play('ui_open', { volume: 0.4, gap: 80 });
    haptic(8);
    uiBurstAt(el, 'puff', 5);
    uiBurstAt(el, p.t.fx, 6);
    setTimeout(() => openPanel(p.t.id), 160);
  };
  return (
    <div class="hh-tool" style={{ '--i': p.i } as Record<string, number>}>
      <div class="hh-toolhang" ref={ref}>
        <button class="hh-tag px" style={{ backgroundImage: bg(tag(26, 26, p.i + 2)) }} onClick={go} aria-label={p.t.label + (p.badge ? ` (${p.badge} ready to claim)` : '')}>
          <PxAnim tl={p.t.tl} size={44} offset={p.i * 900} act={p.t.act} actKey={act} />
          {!!p.badge && <span class="hh-badge"><PxAnim tl={[['hud_seal', 1e9]]} size={28} /><b>{p.badge}</b></span>}
          {p.isNew && <span class="hh-new"><PxAnim tl={[['hud_new', 1e9]]} size={44} /></span>}
        </button>
        <span class="hh-toollabel">{p.t.label}</span>
      </div>
    </div>
  );
}

export function SideTools() {
  const away = hudOverride.value === 'none' || (hudOverride.value !== 'all' && (hidden() || !!panel.value));
  void save.value;
  const ready = claimable();
  const fresh = save.value.shop.day !== dayKey();
  return (
    <div class={'hh-tools' + (away ? ' away' : '')} aria-label="Tools">
      <i class="hh-toolrope" style={{ '--rope': bg(ropeTile()) } as Record<string, string>} />
      {TOOLS.map((t, i) => <ToolTag key={t.id} t={t} i={i} badge={t.id === 'quests' ? ready : 0} isNew={t.id === 'shop' && fresh} />)}
    </div>
  );
}

// ------------------------------------------------------------------ main buttons

interface MainDef { id: NonNullable<Panel>; label: string; inner: Inner; tl: Timeline; act: Timeline; fx: UiFxKind[] }
const CUCKOO: Timeline = [['nav_clock_cu_0', 140], ['nav_clock_cu_1', 120], ['nav_clock_cu_2', 220], ['nav_clock_cu_3', 160], ['nav_clock_cu_4', 220], ['nav_clock_cu_5', 160], ['nav_clock_cu_6', 120], ['nav_clock_cu_7', 140]];
const BOOK_OPEN: Timeline = [['nav_book_u', 200], ['nav_book_o1', 110], ['nav_book_o2', 110], ['nav_book_op', 140], ...rep(seq('nav_book_fl', 3, 90), 2), ...rep(seq('nav_book_gl', 2, 200), 2), ['nav_book_op', 260], ['nav_book_o2', 100], ['nav_book_o1', 100], ['nav_book_u', 160]];
const MAIN: MainDef[] = [
  { id: 'sleep', label: 'Sleep', inner: 'night', tl: seq('nav_sleep', 8, 260), act: rep(seq('nav_sleep_tap', 3, 110), 2), fx: ['stars', 'puff'] },
  { id: 'clock', label: 'Clock', inner: 'paper', tl: [...rep(seq('nav_clock', 8, 120), 7), ...CUCKOO], act: CUCKOO, fx: ['sparkle', 'puff'] },
  { id: 'book', label: 'Book', inner: 'velvet', tl: [['nav_book_5', 2600], ...seq('nav_book', 5, 70), ['nav_book_5', 1800], ...BOOK_OPEN], act: BOOK_OPEN.slice(0, 7), fx: ['magic', 'puff'] },
];

function Plaque(p: { m: MainDef; i: number; rec: boolean }) {
  const [state, setState] = useState<'' | 'press' | 'pop'>('');
  const [act, setAct] = useState(0);
  const el = useRef<HTMLButtonElement>(null);
  const down = () => { setState('press'); sound.play('wood_knock', { volume: 0.3, rate: 0.9, gap: 60 }); haptic(6); };
  const up = () => setState((s) => (s === 'press' ? 'pop' : s));
  const go = () => {
    setState('pop');
    setAct((n) => n + 1);
    sound.play('ui_tab', { volume: 0.55, gap: 60 });
    const r = el.current!.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * 0.4;
    uiBurst(p.m.fx[0], x, y, 12);
    uiBurst(p.m.fx[1], x, r.top + r.height * 0.7, 7);
    setTimeout(() => openPanel(p.m.id, { x, y }), 220);
  };
  useEffect(() => { if (state !== 'pop') return; const t = setTimeout(() => setState(''), 520); return () => clearTimeout(t); }, [state]);
  return (
    <button ref={el} class={'hh-plaque px ' + p.m.id + (state ? ' ' + state : '') + (p.rec ? ' rec' : '')} style={{ backgroundImage: bg(plaque(52, 58, p.m.inner, 5 + p.i, 12)), '--i': p.i } as Record<string, string | number>}
      onPointerDown={down} onPointerUp={up} onPointerLeave={() => setState((s) => (s === 'press' ? '' : s))} onClick={go} aria-label={p.m.label}>
      <span class="hh-pic"><PxAnim tl={p.m.tl} size={64} act={p.m.act} actKey={act} offset={p.i * 700} /></span>
      <span class="hh-plate">{p.m.label}</span>
      {p.rec && <><i class="hh-twinkle a" /><i class="hh-twinkle b" /><i class="hh-twinkle c" /></>}
    </button>
  );
}

export function MainNav() {
  const away = hudOverride.value === 'none' || (hudOverride.value !== 'all' && (hidden() || !!panel.value));
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 60000); return () => clearInterval(id); }, []);
  const sp = save.value.sleep;
  const bed = bedtimeOf(sp.wake, sp.goalMin);
  const [h, m] = bed.split(':').map(Number);
  const now = new Date(), t = new Date(now); t.setHours(h, m, 0, 0);
  let diff = t.getTime() - now.getTime();
  if (diff < -6 * 3600_000) diff += 24 * 3600_000;
  const bedtimeNear = diff < 90 * 60_000;
  return (
    <nav class={'hh-nav' + (away ? ' away' : '')} aria-label="Main">
      <div class="hh-plaques">
        {MAIN.map((m, i) => <Plaque key={m.id} m={m} i={i} rec={m.id === 'sleep' && bedtimeNear} />)}
      </div>
      <img class="hh-shelf px" src={shelf(176)} alt="" draggable={false} />
    </nav>
  );
}

// dev and screenshot hooks
if (typeof window !== 'undefined') (window as unknown as { hhChrome: unknown }).hhChrome = { transition, previewTransition, clearTransition, openPanel, uiBurst, uiAdvance, hudOverride, say };

/** Frame sheets for the dev page. */
export const CHROME_TIMELINES = { MAIN, TOOLS, hold };
