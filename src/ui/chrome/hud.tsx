// OWNED BY THE UI-CHROME BUILDER: the HUD and the home-screen controls, as real objects (v4).
//   Hud       a varnished walnut name sign hanging on ropes: Pip in a brass-bezelled porthole, the level
//             on an enamel medallion, the magic level bar as a glowing glass tube (left); the acorn and
//             moon-gem boards on brass chains with enamel "+" buttons (right)
//   SideTools small walnut tiles with brass corners and coloured felt, hung on a rope down the right
//             side (Build, Shop, Dress up, Quests, Map, Settings), each with a paper label tag
//   MainNav   three big objects on a walnut shelf with engraved brass name plates: a moon lamp (Sleep),
//             a brass twin-bell alarm clock showing the real time (Clock), a leather journal (Book)
// Everything is painted with the relief painter (src/ui/px/relief.ts, src/ui/chrome/objects.ts): real
// materials lit from the top left. Signs swing when tapped or hit by rewards and sway in the breeze; they
// are pulled up out of the way when a full-screen place opens and drop back in when it closes. Opening a
// place plays a pixel transition (transition.ts) and throws 2D pixel particles (uifx.ts).
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { bedtimeOf, phase } from '../../game/night.ts';
import { claimable, todaysQuests } from '../../game/quests.ts';
import { dayKey, level, save } from '../../game/store.ts';
import { OwlPortrait } from './livepip.tsx'; // [ui5] the live 3D owl in its frame
import { haptic } from '../kit.tsx';
import { breathing, panel, say, sceneRef, type Panel } from '../state.ts';
import { framesOf, hold, PxAnim, rep, seq, type Timeline } from './pxanim.tsx';
import { MagicBar } from './magicbar.tsx';
import { addSwing, kick, makeSwing, reducedMotion, removeSwing, type Swing } from './swing.ts';
import { clearTransition, installPanelTransitions, panelTransition, previewTransition, transition, type TransitionKind, type TransitionOpts } from './transition.ts'; // [motion3] panelTransition, installPanelTransitions
import { installUiFxAuto, lastPointer, uiAdvance, uiAmbient, uiBurst, uiBurstAt, type UiFxKind } from './uifx.ts';
import { installChromeSkin } from './skin.ts';
import { iconSrc } from './iconset.ts';
import { installSurfaces } from './surfaces.ts';
import { alagardWidth } from '../font.ts';
import { punch } from '../text3d.tsx';
import { alarmClock, alarmHands, board, brassChain, hempRope, contactShadow, DESK_HUD, DESK_NAV, journal, kFor, lampHalo, medallion, moonLamp, plate, plusButton, shelfBoard, toolIcon, toolTile, type PalRamp, type ToolIcon } from './objects.ts';
import './chrome.css';
import '../px/currency.js';

installChromeSkin();
installSurfaces(); // [ui4] panels as physical objects: walnut cabinet sheets, the cork quest board, carved signs
installUiFxAuto(); // [ui3] small pixel bursts on every press, toggle, slider, tab, sheet, dialog and toast
installPanelTransitions(); // [motion3] every open, close and switch of a place plays a pixel transition

/**
 * Lets another screen keep parts of the HUD up: 'currency' keeps the acorn and gem signs (e.g. a
 * shop that wants them), 'all' keeps everything, 'none' hides everything. null = automatic.
 */
export const hudOverride = signal<null | 'all' | 'currency' | 'none'>(null);

const hidden = () => phase.value !== 'day' || !!breathing.value || !save.value.onboarded;

/** How each place is entered. */
export const VIA: Partial<Record<NonNullable<Panel>, TransitionKind>> = {
  sleep: 'stars', clock: 'iris', book: 'page', build: 'blueprint', decorate: 'blueprint', shop: 'leaves', wardrobe: 'iris', map: 'leaves', quests: 'leaves',
};
/** Open a place with its transition (and the screen point to centre an iris on). */
export function openPanel(id: Panel, o: TransitionOpts = {}) {
  if ((window as unknown as { __chromeHold?: boolean }).__chromeHold) return; // screenshots: stay on the press
  const pt = panelTransition(panel.peek(), id); // [motion3] each place has its own transition (VIA is the old table)
  if (!pt) { panel.value = id; return; }
  if (id === 'wardrobe' && o.x === undefined) {
    const sc = sceneRef.current;
    if (sc) { const p = sc.screenOf(sc.owl.headWorld); o = { ...o, x: p.x, y: p.y }; }
  }
  void transition(pt[0], () => { panel.value = id; }, { ...pt[1], ...o }); // [motion3]
}

/** A pendulum bound to an element: returns [ref callback, swing]. */
function useSwing(o: Partial<Swing> = {}): [(el: HTMLElement | null) => void, Swing] {
  const s = useMemo(() => makeSwing(o), []);
  useEffect(() => { addSwing(s); return () => removeSwing(s); }, []);
  return [(el) => { s.el = el; }, s];
}

/** [ui4] the detail level (art px per unit) for a media query, kept in step with resizes */
function useK(q: string): number {
  const [k, setK] = useState(() => kFor(q));
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try { mq = matchMedia(q); } catch { return; }
    const on = () => setK(kFor(q));
    mq.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, [q]);
  return k;
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
  const tile = p.chain ? brassChain() : hempRope(); // [ui4] fine twisted hemp and a real brass chain
  const w = p.chain ? 8 : 6;
  return <>{p.xs.map((x) => <i class={'hh-rope' + (p.chain ? ' chain' : '')} style={{ left: px(x - w / 2), top: px(p.top), height: px(p.len), width: px(w), backgroundImage: bg(tile) }} />)}</>;
}

const RANKS: [number, string][] = [[1, 'Fledgling'], [3, 'Owlet'], [5, 'Night Owl'], [8, 'Moon Watcher'], [12, 'Star Keeper'], [16, 'Dream Weaver']];
/** Pip's title for a level (shown on the name sign). */
export const rankOf = (lv: number) => RANKS.filter(([l]) => lv >= l).pop()![1];

function NameSign() {
  const s = save.value, lv = level.value;
  const k = useK(DESK_HUD);
  const [ref, sw] = useSwing({ amp: 0.7, rate: 0.8 });
  const [xp, setXp] = useState(false);
  const [poke, setPoke] = useState(0);
  const tm = useRef(0);
  const tapSign = () => {
    setPoke((n) => n + 1); // [ui5] the owl in the portrait reacts
    kick(sw, 70);
    sound.play('door_creak', { volume: 0.12, rate: 1.15 + Math.random() * 0.3, gap: 300 });
    sound.play('wood_knock', { volume: 0.35, gap: 80 });
    haptic(6);
    setXp(true); clearTimeout(tm.current); tm.current = window.setTimeout(() => setXp(false), 2600);
  };
  // [font6] measured in Alagard: name and rank both shown where they fit, the name in 32 px gilt letters if it can
  const rank = rankOf(lv.level), nw = alagardWidth(s.name), rw = alagardWidth(rank), room = 119;
  const long = 2 * nw + rw + 8 > room && (nw + rw + 8 <= room || 2 * nw > room);
  const fits = (long ? nw : 2 * nw) + rw + 8 <= room;
  return (
    <div class="hh-hang hh-namehang" ref={ref}>
      <Ropes xs={[52, 142]} top={-32} len={40} />
      <button class="hh-board hh-nameboard" style={{ backgroundImage: bg(board(96, 36, k, 1, { seed: 4, hooks: [26, 71], brackets: true })) }} onClick={tapSign} aria-label={`${s.name}, level ${lv.level}, ${lv.into} of ${lv.need} experience`}>
        <span class="hh-portrait"><OwlPortrait size={78} frame={s.frame} pokeKey={poke} /></span>
        <span class={'hh-name' + (long ? ' long' : '')}>{s.name}</span>
        {fits && <span class="hh-rank">{rank}</span>}
        <span class="hh-lvl">
          <MagicBar level={lv.level} into={lv.into} need={lv.need} w={52} />
          <span class={'hh-xp' + (xp ? ' on' : '')}>{lv.into} / {lv.need} XP</span>
        </span>
        <span class="hh-rune" key={lv.level}>
          <img src={medallion(22, k, 1, 'sapphire')} alt="" draggable={false} />
          <b>{lv.level}</b>
        </span>
      </button>
    </div>
  );
}

function CurrencySign(p: { kind: 'coin' | 'gem'; value: number; swing: [(el: HTMLElement | null) => void, Swing]; children?: ComponentChildren }) {
  const [ref, sw] = p.swing;
  const k = useK(DESK_HUD);
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
    uiBurstAt(ico.current, p.kind === 'coin' ? 'acorns' : 'magic', 4);
  };
  const shop = (e: Event) => { e.stopPropagation(); sound.play('ui_open', { volume: 0.5 }); haptic(); uiBurstAt(e.currentTarget as Element, 'sparkle', 8); openPanel('shop'); };
  // [font6] the number punches (squash and stretch) when it changes
  const numRef = useRef<HTMLSpanElement>(null), lastVal = useRef(p.value);
  useEffect(() => { if (p.value !== lastVal.current) { lastVal.current = p.value; window.setTimeout(() => punch(numRef.current), 650); } }, [p.value]);
  return (
    <div class={'hh-hang hh-curhang ' + p.kind} ref={ref}>
      <Ropes xs={[22, 102]} top={p.kind === 'coin' ? -28 : -16} len={p.kind === 'coin' ? 34 : 22} chain />
      <div class="hh-board hh-curboard" style={{ backgroundImage: bg(board(62, 20, k, 1, { seed: p.kind === 'coin' ? 7 : 9, wood: p.kind === 'coin' ? 'oak' : 'walnut', hooks: [11, 51], screws: [[27, 11.5]], bevel: 2 })) }} onClick={tapSign} role="group" aria-label={`${label}: ${p.value.toLocaleString()}`}>
        <span class={'hh-cur-ico ' + p.kind} data-chip={p.kind} ref={ico}>
          <PxAnim tl={tl} size={40} offset={p.kind === 'gem' ? 400 : 0} />
          {p.kind === 'coin' && <i class="hh-glint" />}
        </span>
        <span class={'hh-num' + (p.value >= 100000 ? ' huge' : p.value >= 10000 ? ' long' : '')} ref={numRef}><Odometer value={p.value} /></span>
        <button class="hh-plus" style={{ '--plus': bg(plusButton(14, k, 1)), '--plus-dn': bg(plusButton(14, k, 1, true)) } as Record<string, string>} onClick={shop} aria-label={`Get more ${label.toLowerCase()} in the shop`}><span /></button>
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
    if (v.coins < p.coins) { const lp = lastPointer(); uiBurst('puff', lp.x, lp.y, 6); uiBurst('acorns', lp.x, lp.y, 6); kick(coinSw[1], 45); }
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
      </div>
      <div class={'hh-right' + (curAway ? ' away' : '')}>
        <div class="hh-lift">
          <CurrencySign kind="coin" value={s.coins} swing={coinSw}>
            <CurrencySign kind="gem" value={s.gems} swing={gemSw} />
          </CurrencySign>
        </div>
      </div>
    </div>
  );
}
function claimedCount() { try { return todaysQuests().filter((q) => q.claimed).length; } catch { return 0; } }

// ------------------------------------------------------------------ side tools

interface ToolDef { id: NonNullable<Panel>; label: string; tl: Timeline; act: Timeline; fx: UiFxKind; icon?: string; felt: PalRamp }
const TOOLS: ToolDef[] = [
  { id: 'build', label: 'Build', tl: [['tool_build_0', 2600], ['tool_build_1', 90], ['tool_build_2', 120], ['tool_build_3', 90], ['tool_build_4', 120], ['tool_build_5', 260]], act: rep(seq('tool_build', 5, 70, 1), 2), fx: 'chips', icon: 'tool_build', felt: 'sapphire' },
  { id: 'shop', label: 'Shop', tl: seq('tool_shop', 6, 260), act: seq('tool_shop', 6, 80), fx: 'acorns', icon: 'tool_shop', felt: 'rose' },
  { id: 'wardrobe', label: 'Dress up', tl: [...seq('tool_dress', 8, 150), ['tool_dress_6', 1600]], act: rep(seq('tool_dress', 8, 60), 2), fx: 'hearts', icon: 'tool_dress', felt: 'plum' },
  { id: 'quests', label: 'Quests', tl: [['tool_quest_0', 2400], ['tool_quest_1', 90], ['tool_quest_2', 90], ['tool_quest_3', 380], ['tool_quest_4', 1400]], act: seq('tool_quest', 4, 90), fx: 'stars', icon: 'tool_quests', felt: 'emerald' },
  { id: 'map', label: 'Map', tl: [['tool_map_0', 2800], ['tool_map_1', 120], ['tool_map_2', 1400], ['tool_map_3', 300], ['tool_map_2', 600], ['tool_map_1', 120]], act: [['tool_map_1', 90], ['tool_map_2', 200], ['tool_map_3', 260]], fx: 'leaves', icon: 'tool_map', felt: 'sky' },
  { id: 'settings', label: 'Settings', tl: seq('tool_gear', 4, 220), act: rep(seq('tool_gear', 4, 50), 3), fx: 'sparkle', icon: 'tool_settings', felt: 'iron' },
];

/** [ui5] the side tools' icons: little 3D models from the icon family (src/ui/chrome/iconset.ts) */
const TOOL_ICON: Partial<Record<string, string>> = { build: 'tool_build', shop: 'tool_shop', wardrobe: 'tool_dress', quests: 'tool_quests', map: 'tool_map', settings: 'tool_settings' };
const dpr = () => Math.min(4, Math.max(1, Math.round((typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1)));

function ToolTag(p: { t: ToolDef; i: number; badge?: number; isNew?: boolean }) {
  const [ref, sw] = useSwing({ amp: 1.1, rate: 1.1 + p.i * 0.07, k: 34 });
  const k = useK(DESK_HUD);
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
        <button class="hh-tag" style={{ backgroundImage: bg(toolTile(26, p.t.felt, k, 1, p.i + 1)) }} onClick={go} aria-label={p.t.label + (p.badge ? ` (${p.badge} ready to claim)` : '')}>
          <img class={'hh-ticon' + (act % 2 ? ' tap' : act ? ' tap2' : '')} src={iconSrc(TOOL_ICON[p.t.id] ?? '', Math.round(44 * dpr()), dpr()) ?? toolIcon(p.t.id as ToolIcon, k, 1)} width={44} height={44} alt="" draggable={false} style={{ '--i': p.i } as Record<string, number>} />
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
      <i class="hh-toolrope" style={{ '--rope': bg(hempRope()) } as Record<string, string>} />
      {TOOLS.map((t, i) => <ToolTag key={t.id} t={t} i={i} badge={t.id === 'quests' ? ready : 0} isNew={t.id === 'shop' && fresh} />)}
    </div>
  );
}

// ------------------------------------------------------------------ main buttons: three objects on a shelf

interface MainDef { id: NonNullable<Panel>; label: string; inner: string; tl: Timeline; act: Timeline; fx: UiFxKind[]; icon?: string }
const MAIN: MainDef[] = [
  { id: 'sleep', label: 'Sleep', inner: 'night', tl: seq('nav_sleep', 8, 260), act: rep(seq('nav_sleep_tap', 3, 110), 2), fx: ['stars', 'motes'] },
  { id: 'clock', label: 'Clock', inner: 'paper', tl: seq('nav_clock', 8, 120), act: seq('nav_clock', 8, 60), fx: ['sparkle', 'puff'] },
  { id: 'book', label: 'Book', inner: 'velvet', tl: seq('nav_book', 5, 70), act: seq('nav_book', 5, 70), fx: ['paper', 'magic'] },
];
const GLOW = [0.4, 0.55, 0.7, 0.85, 0.7, 0.55];

/** The moon lamp: its glow breathes; a press clicks it off and on again in a shower of stars. */
function LampArt(p: { k: number; act: number }) {
  const [g, setG] = useState(2);
  const [off, setOff] = useState(false);
  useEffect(() => {
    if (reducedMotion()) return;
    const id = setInterval(() => { if (!document.hidden) setG((n) => (n + 1) % GLOW.length); }, 520);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (!p.act) return; setOff(true); const t = setTimeout(() => setOff(false), 170); return () => clearTimeout(t); }, [p.act]);
  const glow = GLOW[g];
  return (
    <>
      <img class="hh-halo" src={lampHalo(p.k, 1, 1)} style={{ opacity: off ? 0 : 0.35 + glow * 0.6 }} alt="" draggable={false} />
      <img class="hh-obj" src={moonLamp(p.k, 1, off ? 0.3 : glow, off ? 0 : 1)} alt="" draggable={false} />
    </>
  );
}

/** The alarm clock: real time on its dial (the gold hand points at your wake time); a press rings it. */
function AlarmArt(p: { k: number; act: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const st = useRef({ ring: 0, until: 0, imgs: new Map<number, HTMLImageElement>() });
  const wake = save.value.sleep.wake;
  useEffect(() => {
    const c = cv.current!;
    const g = c.getContext('2d')!;
    const s = st.current;
    const img = (f: number) => {
      let im = s.imgs.get(f);
      if (!im) { im = new Image(); im.src = alarmClock(p.k, 1, f); s.imgs.set(f, im); im.onload = () => draw(); }
      return im;
    };
    const [wh, wm] = wake.split(':').map(Number);
    const draw = () => {
      const now = performance.now(), ringing = now < s.until;
      const f = ringing ? 1 + (Math.floor(now / 45) % 2) : 0;
      const im = img(f);
      if (!im.complete || !im.naturalWidth) return;
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      g.imageSmoothingEnabled = false;
      g.drawImage(im, 0, 0);
      alarmHands(g, p.k, 1, new Date(), wh * 60 + wm);
    };
    img(1); img(2);
    draw();
    let raf = 0, last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const ringing = t < s.until;
      if (!ringing && t - last < 1000) return;
      if (ringing && t - last < 45) return;
      last = t;
      if (!document.hidden) draw();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [p.k, wake]);
  useEffect(() => { if (p.act && !reducedMotion()) st.current.until = performance.now() + 650; }, [p.act]);
  return <canvas ref={cv} class="hh-obj" aria-hidden="true" />;
}

const BOOK_FRAMES = [0, 0.22, 0.5, 0.78];
/** The journal: a gilt glint now and then; a press swings its cover open and shut. */
function BookArt(p: { k: number; act: number }) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (!p.act) return;
    if (reducedMotion()) { setF(2); const t = setTimeout(() => setF(0), 300); return () => clearTimeout(t); }
    const seq = [1, 2, 3, 3, 3, 2, 1, 0], ts: number[] = [];
    seq.forEach((v, i) => ts.push(window.setTimeout(() => setF(v), 70 * (i + 1))));
    return () => ts.forEach(clearTimeout);
  }, [p.act]);
  // paint every frame up front so the swing never stutters
  useEffect(() => { const id = setTimeout(() => BOOK_FRAMES.forEach((o) => journal(p.k, 1, o)), 400); return () => clearTimeout(id); }, [p.k]);
  return <img class="hh-obj" src={journal(p.k, 1, BOOK_FRAMES[f])} alt="" draggable={false} />;
}

function MainObject(p: { m: MainDef; i: number; rec: boolean; k: number }) {
  const [state, setState] = useState<'' | 'press' | 'pop'>('');
  const [act, setAct] = useState(0);
  const el = useRef<HTMLButtonElement>(null);
  const down = () => { setState('press'); sound.play('tick_wood', { volume: 0.4, rate: 0.9, gap: 60 }); haptic(6); };
  const up = () => setState((s) => (s === 'press' ? 'pop' : s));
  const go = () => {
    setState('pop');
    setAct((n) => n + 1);
    const id = p.m.id;
    if (id === 'sleep') { sound.play('ui_toggle', { volume: 0.7, gap: 60 }); sound.play('chime_sweep', { volume: 0.3, gap: 200 }); }
    else if (id === 'clock') { sound.play('desk_bell', { volume: 0.35, rate: 1.25, gap: 200 }); sound.play('tick_brass', { volume: 0.5, gap: 60 }); }
    else { sound.play('book_open', { volume: 0.6, gap: 200 }); }
    const r = el.current!.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * 0.38;
    uiBurst(p.m.fx[0], x, y, 12);
    uiBurst(p.m.fx[1], x, r.top + r.height * 0.62, 7);
    setTimeout(() => openPanel(p.m.id, { x, y }), 320);
  };
  useEffect(() => { if (state !== 'pop') return; const t = setTimeout(() => setState(''), 560); return () => clearTimeout(t); }, [state]);
  return (
    <button ref={el} class={'hh-mobj ' + p.m.id + (state ? ' ' + state : '') + (p.rec ? ' rec' : '')} style={{ '--i': p.i } as Record<string, number>}
      onPointerDown={down} onPointerUp={up} onPointerLeave={() => setState((s) => (s === 'press' ? '' : s))} onClick={go} aria-label={p.m.label}>
      <img class="hh-cshadow" src={contactShadow(p.m.id === 'book' ? 40 : 34, 6, p.k)} alt="" draggable={false} />
      <span class="hh-pic">
        {p.m.id === 'sleep' ? <LampArt k={p.k} act={act} /> : p.m.id === 'clock' ? <AlarmArt k={p.k} act={act} /> : <BookArt k={p.k} act={act} />}
        {p.m.id === 'sleep' && <><i class="hh-twinkle moon1" /><i class="hh-twinkle moon2" /></>}
      </span>
      <span class="hh-plate" style={{ backgroundImage: bg(plate(44, 9, p.k, 1)) }}>{p.m.label}</span>
      {p.rec && <><i class="hh-twinkle a" /><i class="hh-twinkle b" /><i class="hh-twinkle c" /></>}
      {p.m.id === 'book' && <i class="hh-twinkle gilt" />}
    </button>
  );
}

export function MainNav() {
  const away = hudOverride.value === 'none' || (hudOverride.value !== 'all' && (hidden() || !!panel.value));
  const k = useK(DESK_NAV);
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
        {MAIN.map((m, i) => <MainObject key={m.id} m={m} i={i} rec={m.id === 'sleep' && bedtimeNear} k={k} />)}
      </div>
      <img class="hh-shelf" src={shelfBoard(176, k, 1)} alt="" draggable={false} />
    </nav>
  );
}

// dev and screenshot hooks
if (typeof window !== 'undefined') (window as unknown as { hhChrome: unknown }).hhChrome = { transition, previewTransition, clearTransition, openPanel, uiBurst, uiAdvance, hudOverride, say };

/** Frame sheets for the dev page. */
export const CHROME_TIMELINES = { MAIN, TOOLS, hold };
