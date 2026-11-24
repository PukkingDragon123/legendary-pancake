// Build mode: the tree house seen top-down like a blueprint. A floor switcher and view controls up
// top; a blueprint drawer at the bottom with illustrated category tabs and a scrolling strip of item
// cards (buy, or place from storage); a floating action bubble over the selected piece (move,
// rotate, store, buy another). The 3D side lives in src/build/controller.ts.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ALL_ITEMS, FINISHES, ITEMS, type ItemDef } from '../assets/registry.ts';
import type { Finish } from '../assets/finishes.ts';
import { sound } from '../audio/sound.ts';
import { bstate, controller } from '../build/controller.ts';
import { buildFocus } from '../build/home-sync.ts';
import '../build/px.js';
import { canUnlock, doFinish, doUnlock, isOpen, kindOf, priceOfItem } from '../game/home.ts';
import { SERIES_BY_ID } from '../game/series.ts';
import { level, save } from '../game/store.ts';
import { FLOOR_IDS, FLOOR_NAME, FLOOR_SHORT, UNLOCK, type FloorId } from '../world/house/plan.ts';
import { ask } from './fx.tsx';
import { Px } from './icons.tsx';
import { haptic, toast } from './kit.tsx';
import { iconVersion, itemIcon } from './portraits.ts';
import { blueprintTile, tape, thumbtack } from './chrome/surfaces.ts';

// [ui4] the blueprint is real cyanotype paper (its chalk grid printed in), taped down with masking tape and
// brass drawing pins, all painted with the relief painter
let bpStyled = false;
function installBlueprint() {
  if (bpStyled || typeof document === 'undefined') return;
  bpStyled = true;
  const st = document.createElement('style');
  st.id = 'hh-blueprint';
  st.textContent = `
.bm-drawer{background-color:#1f4a78;background-image:url("${blueprintTile()}");background-size:64px 64px;image-rendering:pixelated}
.bm-floors{background:url("${blueprintTile()}") 0 0/64px 64px}
.bm-note{background:url("${blueprintTile()}") 0 0/64px 64px}
.bm-drawer::before,.bm-drawer::after{width:52px;height:14px;top:-9px;background:url("${tape(52)}") 0 0/52px 14px;clip-path:none;box-shadow:none;filter:drop-shadow(2px 2px 0 rgba(12,34,64,.4))}
.bm-pin{width:16px;height:16px;top:-6px;background:url("${thumbtack()}") 0 0/16px 16px;image-rendering:pixelated}
.bm-pin > *{display:none}
`;
  document.head.appendChild(st);
}

import { panel, sceneRef } from './state.ts';
import './build.css';

type TabId = 'stored' | 'beds' | 'seating' | 'tables' | 'storage' | 'lights' | 'decor' | 'plants' | 'rugs' | 'wall' | 'fun' | 'wallpaper' | 'flooring' | 'seasonal';
const TABS: { id: TabId; name: string; icon: string; cats?: string[] }[] = [
  { id: 'stored', name: 'Stored', icon: 'bp_box' },
  { id: 'beds', name: 'Beds', icon: 'bp_bed', cats: ['beds'] },
  { id: 'seating', name: 'Seating', icon: 'bp_chair', cats: ['seating'] },
  { id: 'tables', name: 'Tables', icon: 'bp_table', cats: ['tables'] },
  { id: 'storage', name: 'Storage', icon: 'bp_shelf', cats: ['storage'] },
  { id: 'lights', name: 'Lights', icon: 'bp_lamp', cats: ['lights'] },
  { id: 'decor', name: 'Decor', icon: 'bp_decor', cats: ['decor'] },
  { id: 'plants', name: 'Plants', icon: 'bp_plant', cats: ['plants'] },
  { id: 'rugs', name: 'Rugs', icon: 'bp_rug', cats: ['rugs'] },
  { id: 'wall', name: 'Wall', icon: 'bp_wall', cats: ['wall'] },
  { id: 'fun', name: 'Fun', icon: 'bp_fun', cats: ['fun', 'play'] },
  { id: 'wallpaper', name: 'Wallpaper', icon: 'bp_wallpaper' },
  { id: 'flooring', name: 'Flooring', icon: 'bp_floor' },
  { id: 'seasonal', name: 'Seasonal', icon: 'bp_season' },
];

const SEEN_KEY = 'hoot-hollow:bp-seen';
const loadSeen = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')); } catch { return new Set(); } };
const saveSeen = (s: Set<string>) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch { /* private mode */ } };

const blip = (id: string, volume = 0.5) => { sound.play(id, { volume, gap: 40 }); haptic(6); };
const isSeasonal = (d: ItemDef) => !!d.series || d.cat === 'seasonal';
const forSale = (d: ItemDef) => !d.series && !d.noStore && d.cat !== 'garden' && !isSeasonal(d);

/** A small painted swatch of a finish (cached). */
const swatchCache = new Map<string, string>();
function swatch(f: Finish): string {
  let u = swatchCache.get(f.id);
  if (u) return u;
  const n = 32, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!, img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    // walls read bottom-up (v), floors are seen from above
    const col = f.kind === 'wallpaper' ? f.paint(x * 1.5, (n - 1 - y) * 1.5) : f.paint(x * 1.5, y * 1.5);
    const i = (y * n + x) * 4;
    img.data[i] = (col >> 16) & 255; img.data[i + 1] = (col >> 8) & 255; img.data[i + 2] = col & 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  u = c.toDataURL();
  swatchCache.set(f.id, u);
  return u;
}

/** Item render, made lazily so opening a tab never hitches. */
function Thumb(p: { id: string; i: number }) {
  const [shot, setShot] = useState({ id: '', src: '' });
  // [ui4] re-ask when a model's picture lands (iconVersion), so a card never stays a blank sketch
  const ver = iconVersion.value;
  const src = shot.id === p.id ? shot.src : '';
  useEffect(() => { if (src) return; let live = true; const t = setTimeout(() => { if (live) setShot({ id: p.id, src: itemIcon(p.id) }); }, 30 + p.i * 45); return () => { live = false; clearTimeout(t); }; }, [p.id, ver]);
  return src ? <img class="bm-img" src={src} alt="" draggable={false} /> : <span class="bm-sketch" />;
}

function PriceTag(p: { coins: number; gems: number; short?: boolean }) {
  if (p.gems) return <span class="bm-tag gem"><Px name="moongem" size={18} />{p.gems}</span>;
  if (!p.coins) return <span class="bm-tag free">FREE</span>;
  return <span class="bm-tag"><Px name="owlcoin" size={18} />{p.coins.toLocaleString()}</span>;
}

// ------------------------------------------------------------------ the action bubble

function ActionBubble(p: { onMsg: (m: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const s = bstate.sel.value;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const sc = sceneRef.current, el = ref.current;
      if (!sc || !el) return;
      const a = controller(sc).anchor();
      if (!a || a.behind) { el.style.opacity = '0'; return; }
      el.style.opacity = '1';
      const w = el.offsetWidth;
      el.style.left = `${Math.max(w / 2 + 8, Math.min(innerWidth - w / 2 - 8, a.x))}px`;
      el.style.top = `${Math.max(120, a.y - 6)}px`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [s?.uid, s?.pending]);
  if (!s) return null;
  const sc = sceneRef.current!;
  const ctl = controller(sc);
  const d = ITEMS[s.id];
  const wall = kindOf(s.id).wall;
  const run = (f: () => string | null) => () => { const m = f(); p.onMsg(m); };
  if (s.pending) {
    const pr = priceOfItem(s.id);
    return (
      <div class="bm-bubble pending" ref={ref} key={'p' + s.id}>
        <b class="bm-bname">{d?.name}</b>
        {!s.ok && <span class="bm-why">{s.reason ?? 'Doesn’t fit there'}</span>}
        <div class="bm-acts">
          {!wall && <button class="bm-act turn" onClick={run(() => ctl.rotateSel())} aria-label="Rotate"><Px name="rotate_right" size={26} /><i>Turn</i></button>}
          <button class="bm-act no" onClick={() => { blip('ui_back', 0.4); ctl.cancelPending(); }} aria-label="Cancel"><Px name="cross" size={26} /><i>Cancel</i></button>
          <button class={'bm-act yes' + (s.ok ? '' : ' off')} onClick={run(() => ctl.confirmPending())} aria-label="Place">
            <Px name="check" size={26} /><i>{s.source === 'buy' ? <PriceTag {...pr} /> : 'Place'}</i>
          </button>
        </div>
      </div>
    );
  }
  const pr = priceOfItem(s.id);
  const canBuy = d && !d.series && !d.noStore;
  return (
    <div class={'bm-bubble' + (s.ok ? '' : ' bad')} ref={ref} key={'s' + s.uid}>
      <b class="bm-bname">{d?.name}</b>
      {!s.ok && <span class="bm-why">{s.reason}</span>}
      <div class="bm-acts">
        <button class={'bm-act move' + (bstate.moveMode.value ? ' on' : '')} onClick={() => { ctl.toggleMove(); p.onMsg(bstate.moveMode.value ? 'Tap a spot (or drag it there)' : null); }}><Px name="bp_move" size={26} /><i>Move</i></button>
        {!wall && <button class="bm-act turn" onClick={run(() => ctl.rotateSel())}><Px name="rotate_right" size={26} /><i>Turn</i></button>}
        <button class="bm-act store" onClick={run(() => ctl.storeSel())}><Px name="bp_box" size={26} /><i>Store</i></button>
        {canBuy && <button class="bm-act buy" onClick={run(() => ctl.buyAnother())}><Px name="bp_buy" size={26} /><i><PriceTag {...pr} /></i></button>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ build mode

export function BuildMode() {
  installBlueprint();
  const sc = sceneRef.current;
  const [tab, setTab] = useState<TabId>(() => (Object.values(save.value.inventory).some((n) => n > 0) ? 'stored' : 'beds'));
  const [closing, setClosing] = useState(false);
  const [low, setLow] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState('');
  const [seen, setSeen] = useState(loadSeen);
  const s = save.value;
  const fid = bstate.floor.value;
  const lv = level.value.level;

  useEffect(() => {
    if (!sc) return;
    const ctl = controller(sc);
    const want = buildFocus.value;
    buildFocus.value = null;
    const start = want && isOpen(save.value, want) ? want : 'f1';
    sc.setHour(11.5);
    ctl.enter(start);
    (window as unknown as { hhBuild?: unknown }).hhBuild = ctl; // handy for QA and screenshots
    sound.play('paper_flip', { volume: 0.5 });
    sound.play('ui_open', { volume: 0.35 });
    if (want && !isOpen(save.value, want)) setTimeout(() => tryFloor(want), 500);
    return () => { ctl.exit(); sc.setHour(null); };
  }, []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(t); }, [msg]);
  useEffect(() => { const n = bstate.note.value; if (n) { setMsg(n); bstate.note.value = ''; } }, [bstate.note.value]);
  // stored things count as seen once you've looked at them
  useEffect(() => {
    if (tab !== 'stored') return;
    const t = setTimeout(() => { const n = new Set(seen); for (const id of Object.keys(save.value.inventory)) n.add(id); setSeen(n); saveSeen(n); }, 1800);
    return () => clearTimeout(t);
  }, [tab]);

  if (!sc) return null;
  const ctl = controller(sc);
  const say = (m: string | null) => { if (m) setMsg(m); };
  const nope = (key: string, m: string) => { blip('ui_error', 0.45); setShake(key); setTimeout(() => setShake(''), 400); setMsg(m); };

  const close = () => {
    if (closing) return;
    blip('ui_close', 0.45);
    sound.play('paper_flip', { volume: 0.4, rate: 1.2 });
    ctl.cancelPending();
    setClosing(true);
    setTimeout(() => { if (panel.value === 'build' || panel.value === 'decorate') panel.value = null; }, 380);
  };

  async function tryFloor(f: FloorId) {
    const c = controller(sc!);
    if (isOpen(save.value, f)) { if (f !== bstate.floor.value) { blip('ui_tab', 0.45); c.setFloor(f); } return; }
    const chk = canUnlock(save.value, f, level.value.level);
    if (!chk.ok) {
      if (chk.reason === 'order') return nope('floor-' + f, `Repair the ${FLOOR_NAME.f2} first`);
      if (chk.reason === 'level') return nope('floor-' + f, `The ${FLOOR_NAME[f]} opens at level ${chk.need}`);
    }
    const u = UNLOCK[f];
    const yes = await ask({ title: `Repair the ${FLOOR_NAME[f]}?`, body: <>Pull the boards off and sweep out the cobwebs for <b>{u.coins.toLocaleString()} acorns</b>. A couple of moving boxes are waiting up there.</>, ok: `Repair for ${u.coins.toLocaleString()}`, tone: 'honey' });
    if (!yes) return;
    if (!doUnlock(f)) return nope('floor-' + f, 'Not enough acorns yet');
    blip('ui_buy', 0.6);
    // watch the boards come off from the front, then hop up top-down
    bstate.busy.value = true;
    c.cancelPending(); c.select(null);
    sc!.house.setBuildView(null);
    c.playShot(c.frontShot(f), 3.4, () => { bstate.busy.value = false; c.setFloor(f); sound.play('reward_unlock', { volume: 0.5 }); setMsg(`The ${FLOOR_NAME[f]} is yours! Unpack the boxes up there.`); });
  }

  // ---------------------------------------------------------------- cards
  const inv = s.inventory;
  const cards = useMemo(() => {
    if (tab === 'wallpaper' || tab === 'flooring') return [];
    if (tab === 'stored') return Object.entries(inv).filter(([id, n]) => n > 0 && ITEMS[id]).map(([id]) => ITEMS[id]);
    // limited series pieces never go on sale here: show the ones you own
    if (tab === 'seasonal') return ALL_ITEMS.filter((d) => isSeasonal(d) && (s.owned.items.includes(d.id) || (inv[d.id] ?? 0) > 0));
    const cats = TABS.find((t) => t.id === tab)?.cats ?? [];
    return ALL_ITEMS.filter((d) => cats.includes(d.cat) && forSale(d)).sort((a, b) => (a.level ?? 1) - (b.level ?? 1) || (a.gems ? 1 : 0) - (b.gems ? 1 : 0) || a.price - b.price);
  }, [tab, JSON.stringify(inv)]);

  const pickItem = (d: ItemDef) => {
    const have = inv[d.id] ?? 0;
    let err: string | null = null;
    if (have > 0) err = ctl.startPlacing(d.id, 'inv');
    else if (isSeasonal(d) || d.noStore) {
      const sr = d.series ? SERIES_BY_ID[d.series] : undefined;
      return nope('i-' + d.id, sr ? `From the ${sr.name} at the Lucky Barrel` : 'Pip finds these on adventures');
    } else if (d.level && lv < d.level) return nope('i-' + d.id, `Unlocks at level ${d.level}`);
    else {
      const pr = priceOfItem(d.id);
      if (s.coins < pr.coins || s.gems < pr.gems) return nope('i-' + d.id, pr.gems ? 'Not enough moon gems' : 'Not enough acorns');
      err = ctl.startPlacing(d.id, 'buy');
    }
    if (err) nope('i-' + d.id, err); else { blip('ui_tap', 0.5); setLow(true); }
  };

  const pickFinish = async (f: Finish) => {
    const room = s.home.floors[fid];
    if (!room) return;
    const slot = f.kind === 'wallpaper' ? 'wall' : 'floor';
    if (room[slot] === f.id) return;
    const owned = s.owned.finishes.includes(f.id);
    if (!owned) {
      if (f.series || f.noStore) { const sr = f.series ? SERIES_BY_ID[f.series] : undefined; return nope('f-' + f.id, sr ? `From the ${sr.name} banner` : 'Not sold here'); }
      const yes = await ask({ title: `${f.name}?`, body: <>{f.blurb}<br /><span class="small">{f.gems ? `${f.gems} moon gems` : `${f.price.toLocaleString()} acorns`}</span></>, ok: 'Buy & apply', tone: 'honey' });
      if (!yes) return;
    }
    const err = doFinish(fid, slot, f.id);
    if (err) return nope('f-' + f.id, err);
    blip(owned ? 'paper_flip' : 'ui_buy', 0.6);
    sound.play('sparkle', { volume: 0.4 });
    const c = sc.house.toWorld(0, 0, 0);
    c.y = sc.floorY(fid) + (slot === 'wall' ? 2 : 0.3);
    for (const [dx, dz] of [[0, 0], [2, -1.5], [-2, -1.5], [0, -3]]) sc.celebrate(c.clone().add({ x: dx, y: 0, z: dz } as never));
  };

  const storedCount = Object.values(inv).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const newStored = Object.keys(inv).filter((id) => inv[id] > 0 && !seen.has(id)).length;
  const room = s.home.floors[fid];
  const busy = bstate.busy.value;

  return (
    <div class={'bm' + (closing ? ' out' : '') + (busy ? ' busy' : '')}>
      <div class="bm-wash" aria-hidden="true" />
      <header class="bm-top">
        <button class="bm-done" onClick={close} aria-label="Done building"><Px name="check" size={26} /><span>Done</span></button>
        <nav class="bm-floors" aria-label="Floors">
          {FLOOR_IDS.map((f) => {
            const openF = isOpen(s, f);
            return (
              <button class={'bm-floor' + (f === fid ? ' on' : '') + (openF ? '' : ' locked') + (shake === 'floor-' + f ? ' shake' : '')} onClick={() => void tryFloor(f)} aria-label={FLOOR_NAME[f]}>
                <b>{FLOOR_SHORT[f]}</b>
                <small>{openF ? FLOOR_NAME[f].split(' ')[0] : <><Px name="lock" size={14} />Lv {UNLOCK[f].level}</>}</small>
              </button>
            );
          })}
        </nav>
        <div class="bm-view">
          <button class="bm-vbtn" onClick={() => ctl.rotateView(-1)} aria-label="Turn view left"><Px name="rotate_left" size={22} /></button>
          <button class="bm-vbtn" onClick={() => ctl.rotateView(1)} aria-label="Turn view right"><Px name="rotate_right" size={22} /></button>
          <button class={'bm-vbtn' + (bstate.tilt.value ? ' on' : '')} onClick={() => ctl.toggleTilt()} aria-label="Tilt view"><Px name={bstate.tilt.value ? 'bp_top' : 'bp_tilt'} size={22} /></button>
        </div>
      </header>
      {msg && <div class="bm-note" key={msg}>{msg}</div>}
      {!busy && <ActionBubble onMsg={(m) => { if (m) setMsg(m); }} />}
      <section class={'bm-drawer' + (low ? ' low' : '')}>
        <span class="bm-pin a"><Px name="pushpin" size={22} /></span><span class="bm-pin b"><Px name="pushpin" size={22} /></span>
        <div class="bm-head">
          <span class="bm-label">{FLOOR_SHORT[fid]} · {FLOOR_NAME[fid]}</span>
          <span class="bm-purse"><Px name="owlcoin" size={18} />{s.coins.toLocaleString()} <Px name="moongem" size={18} />{s.gems.toLocaleString()}</span>
          <button class="bm-fold" onClick={() => { blip('drawer', 0.35); setLow(!low); }} aria-label={low ? 'Open drawer' : 'Fold drawer'}><Px name={low ? 'arrow_up' : 'arrow_down'} size={16} /></button>
        </div>
        <div class="bm-tabs" role="tablist">
          {TABS.map((t) => (
            <button role="tab" class={'bm-tab' + (t.id === tab ? ' on' : '')} onClick={() => { blip('ui_tab', 0.4); setTab(t.id); setLow(false); }} aria-label={t.name} title={t.name}>
              <Px name={t.icon} size={26} />
              <span>{t.name}</span>
              {t.id === 'stored' && storedCount > 0 && <i class={'bm-count' + (newStored ? ' new' : '')}>{storedCount}</i>}
            </button>
          ))}
        </div>
        <div class="bm-items" key={tab}>
          {(tab === 'wallpaper' || tab === 'flooring') && FINISHES.filter((f) => f.kind === (tab === 'wallpaper' ? 'wallpaper' : 'flooring')).map((f, i) => {
            const owned = s.owned.finishes.includes(f.id), on = room?.[tab === 'wallpaper' ? 'wall' : 'floor'] === f.id;
            const locked = !owned && (!!f.series || !!f.noStore);
            return (
              <button class={'bm-card finish' + (on ? ' on' : '') + (locked ? ' locked' : '') + (shake === 'f-' + f.id ? ' shake' : '')} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }} onClick={() => void pickFinish(f)}>
                <span class="bm-art"><img class="bm-swatch" src={swatch(f)} alt="" /></span>
                <span class="bm-name">{f.name}</span>
                {on ? <span class="bm-have on"><Px name="check" size={14} />On</span> : owned ? <span class="bm-have">Owned</span> : locked ? <span class="bm-have lock"><Px name="lock" size={14} /></span> : <PriceTag coins={f.gems ? 0 : f.price} gems={f.gems ?? 0} />}
                {f.series && <i class="bm-series" title={SERIES_BY_ID[f.series]?.name}><Px name="sparkle" size={14} /></i>}
              </button>
            );
          })}
          {cards.map((d, i) => {
            const have = inv[d.id] ?? 0, owned = s.owned.items.includes(d.id);
            const lockLv = !have && d.level && lv < d.level ? d.level : 0;
            const seasonalLocked = !have && (isSeasonal(d) || !!d.noStore) && tab !== 'stored';
            const pr = priceOfItem(d.id);
            return (
              <button class={'bm-card' + (lockLv || seasonalLocked ? ' locked' : '') + (shake === 'i-' + d.id ? ' shake' : '')} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }} onClick={() => pickItem(d)} title={d.blurb}>
                <span class="bm-art"><Thumb id={d.id} i={i} /></span>
                <span class="bm-name">{d.name}</span>
                {have > 0 ? <span class="bm-have">x{have} stored</span> : seasonalLocked ? <span class="bm-have lock"><Px name="lock" size={14} />{d.series ? 'Banner' : 'Adventure'}</span> : <PriceTag {...pr} />}
                {lockLv > 0 && <span class="bm-lock"><Px name="lock" size={16} />Lv {lockLv}</span>}
                {have > 0 && !seen.has(d.id) && <i class="bm-new">NEW</i>}
                {d.series && <i class="bm-series" title={SERIES_BY_ID[d.series]?.name}><Px name="sparkle" size={14} /></i>}
                {owned && !have && tab !== 'stored' && !seasonalLocked && <i class="bm-owned">owned</i>}
              </button>
            );
          })}
          {tab === 'stored' && cards.length === 0 && <div class="bm-empty"><Px name="bp_box" size={44} /><span>Storage is empty. Store furniture with the <b>Store</b> button, or buy something from the tabs.</span></div>}
          {tab === 'seasonal' && cards.length === 0 && <div class="bm-empty"><Px name="bp_season" size={44} /><span>Limited series pieces from the Lucky Barrel land here.</span></div>}
        </div>
      </section>
    </div>
  );
}
