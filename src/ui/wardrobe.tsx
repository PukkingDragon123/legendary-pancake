// Pip's dressing room: a wardrobe drawer of real owl species (each with a live portrait, its Latin
// name, a field-guide blurb and how to get it), special skins, and a drawer per outfit slot.
// Tapping anything tries it on the live 3D owl above the sheet; a brass plaque at the bottom says
// what it is and offers Wear / Buy / Claim. Everything is pixel art: hanging wooden tags for tabs,
// brass specimen slots, a museum plaque, acorn and moon gem prices.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { AREAS } from '../game/catalog.ts';
import { edit, grant, level, save, wear } from '../game/store.ts';
import type { OutfitSlot, OwlLook } from '../owl/model.ts';
import { PIECES, type PieceDef } from '../owl/outfits.ts';
import { SPECIAL_SKINS, type SkinDef2 } from '../owl/skins.ts';
import { resolveSpecies, SPECIES, type SpeciesDef } from '../owl/species.ts';
import { frameStyle } from './px/frames.js';
import { spriteURL } from './px/sprites.js';
import { CSS_TOKENS } from '../gfx/palette.ts';
import { uiBurstAt } from './chrome/uifx.ts';
import './px/wardrobe.js';
import { IcoClose, IcoHanger, Px } from './icons.tsx';
import { Price, Sheet, tap, toast } from './kit.tsx';
import { useOwlIcon, usePieceIcon } from './portraits.ts';
import { panel, sceneRef } from './state.ts';

type Tab = 'species' | 'skins' | OutfitSlot;
const TABS: { v: Tab; label: string; icon: string }[] = [
  { v: 'species', label: 'Owls', icon: 'wd_feather' },
  { v: 'skins', label: 'Skins', icon: 'sparkle' },
  { v: 'head', label: 'Hats', icon: 'tophat' },
  { v: 'face', label: 'Face', icon: 'wd_glasses' },
  { v: 'neck', label: 'Neck', icon: 'wd_scarf' },
  { v: 'body', label: 'Clothes', icon: 'wd_sweater' },
  { v: 'back', label: 'Back', icon: 'wd_cape' },
];
const SERIES_NAME: Record<string, string> = { frostlight: 'Frostlight Festival', starfall: 'Starfall Dreams' };

// ------------------------------------------------------------------ styles

let styled = false;
function installStyles() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const paper = spriteURL('wd_paper', 2);
  // a stepped pixel oval (no smooth circles): the fitting mirror's opening
  const oval = (() => {
    const L: string[] = [], R: string[] = [], n = 18;
    for (let i = 0; i <= n; i++) {
      const y = Math.round((i / n) * 100), w = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 50) / 50) ** 2)) * 47);
      const y2 = Math.round(((i + 1) / n) * 100);
      L.push(`${50 - w}% ${y}%`, `${50 - w}% ${Math.min(100, y2)}%`);
      R.unshift(`${50 + w}% ${y}%`, `${50 + w}% ${Math.min(100, y2)}%`);
    }
    return `polygon(${[...L, ...R].join(',')})`;
  })();
  const css = `${CSS_TOKENS}
.wd .sheet-body{gap:6px;padding-top:0}
.wd .sheet-head h2{font-size:21px;white-space:nowrap}
.wd .sheet-head h2 .ico{margin:-6px 0}
.wd-purse{display:flex;flex-direction:column;gap:0;align-items:flex-end}
.wd-purse .price{display:flex;align-items:center;gap:1px;font-size:15px;color:var(--ink);line-height:1;text-shadow:0 1px 0 var(--paper)}
.wd-purse .price .ico{margin:-5px -1px}
.wd-rail{position:relative;display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;padding:12px 4px 4px;margin:0 -4px;flex:none}
.wd-rail::-webkit-scrollbar{display:none}
.wd-rail::before{content:'';position:absolute;left:0;right:0;top:4px;height:6px;min-width:100%;background:var(--wood);box-shadow:0 2px 0 var(--wood-deep),0 -2px 0 var(--wood-light),inset 0 2px 0 var(--wood-pale),inset 0 -2px 0 var(--wood-dark)}
.wd-rail::after{content:'';position:absolute;left:6px;right:6px;top:4px;height:6px;background:repeating-linear-gradient(90deg,transparent 0 22px,var(--wood-dark) 22px 24px,transparent 24px 46px);pointer-events:none}
.wd-tag{position:relative;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;width:54px;height:60px;${frameStyle('tab', 2)};color:var(--ink);font-size:12px;line-height:1;transform-origin:50% -8px;transition:transform .25s cubic-bezier(.3,1.6,.5,1);filter:saturate(.7)}
.wd-tag::before{content:'';position:absolute;top:-12px;left:50%;width:2px;height:9px;margin-left:-1px;background:var(--wood-deep);box-shadow:1px 0 0 var(--wood)}
.wd-tag .ico{margin:-4px 0 -2px}
.wd-tag span{text-shadow:0 1px 0 var(--paper);white-space:nowrap}
.wd-tag.on{${frameStyle('button_gold', 2)};transform:translateY(3px) rotate(-3deg);color:var(--ink);filter:saturate(.62) brightness(1.04);animation:wdSway 2.4s steps(8) infinite}
.wd-tag:active{transform:rotate(6deg)}
.wd-tag .dot{position:absolute;top:-2px;right:-2px;width:8px;height:8px;background:var(--berry);box-shadow:0 0 0 2px var(--ink)}
.wd-hint{font-size:14px;color:var(--ink-2);text-align:center;margin:-2px 0 0}
.wd-room{position:relative;margin:0 -6px;padding:12px 6px 8px;background:url(${paper}) 0 0/32px 32px repeat,var(--oat);image-rendering:pixelated;box-shadow:inset 0 4px 0 var(--wood-dark),inset 0 6px 0 rgba(46,43,36,.25),inset 0 -4px 0 var(--wood-dark)}
.wd-room::before{content:'';position:absolute;left:0;right:0;top:4px;height:4px;background:repeating-linear-gradient(90deg,var(--wood-light) 0 8px,var(--wood) 8px 16px)}
.wd-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(102px,1fr));gap:14px 4px;padding-top:6px}
.wd-card{position:relative;isolation:isolate;display:flex;flex-direction:column;align-items:center;gap:0;padding:0 2px 2px;color:var(--paper);text-align:center;filter:var(--drop);transition:transform .15s var(--pop);animation:wdIn .35s var(--ease) both;transform-origin:50% -10px}
.wd-card::before{content:'';position:absolute;inset:0;${frameStyle('slot_brass', 2)};filter:saturate(.62) brightness(.98);z-index:-1;pointer-events:none}
.wd-card:active{transform:translateY(2px) scale(.97)}
.wd-card.on{animation:wdIn .35s var(--ease) both,wdSway 2.6s steps(10) .35s infinite}
.wd-card.on::before{${frameStyle('slot_gold_active', 2)};filter:saturate(.6) brightness(1.03)}
.wd-card.locked::before{${frameStyle('slot_locked', 2)};filter:saturate(.5)}
.wd-card .hook{position:absolute;top:-13px;left:50%;margin-left:-17px;pointer-events:none}
.wd-card .pic{position:relative;width:86px;height:78px;display:grid;place-items:center;overflow:hidden;margin-top:3px}
.wd-card .pic img{max-width:100%;max-height:100%;transition:transform .3s var(--pop)}
.wd-card.on .pic img{transform:scale(1.06)}
.wd-card.locked .pic img{filter:brightness(.42) saturate(.35) contrast(1.1)}
.wd-card .pic .spin{width:22px;height:22px;opacity:.6;animation:wdSpin 1s steps(8) infinite}
.wd-card .nm{font-size:14px;line-height:1.05;min-height:30px;display:grid;place-items:center;text-shadow:1px 1px 0 var(--ink)}
.wd-card .st{font-size:13px;display:flex;align-items:center;gap:2px;min-height:20px;text-shadow:1px 1px 0 var(--ink)}
.wd-card .st.own{color:var(--sage-light)}
.wd-card .st.wear{color:var(--lamp)}
.wd-card .st.lock{color:var(--rose)}
.wd-card .st.muted{color:var(--linen);font-size:12px}
.wd-card .price{display:flex;align-items:center;gap:2px;font-size:16px;color:var(--lamp)}
.wd-card .price .ico{margin:-6px -2px}
.wd-card .ribbon{position:absolute;top:-4px;left:-6px;padding:1px 5px;font-size:11px;color:var(--paper);background:var(--dusk);box-shadow:0 0 0 2px var(--slate),0 2px 0 rgba(46,43,36,.4);z-index:2}
.wd-card .ribbon.gold{background:var(--ochre);box-shadow:0 0 0 2px var(--wood-deep),0 2px 0 rgba(46,43,36,.4)}
.wd-card .ribbon.red{background:var(--berry);box-shadow:0 0 0 2px var(--plum),0 2px 0 rgba(46,43,36,.4)}
.wd-card .check{position:absolute;top:2px;right:2px}
.wd-plaque{position:sticky;top:0;margin:0 -2px;padding:0 2px;${frameStyle('wood_dark', 2)};background:var(--wood-deep);display:flex;gap:6px;align-items:center;z-index:3;animation:wdUp .3s var(--ease) both;flex:none}
.wd-plaque .face{position:relative;flex:none;width:76px;height:76px;display:grid;place-items:center}
.wd-plaque .face .glass{position:absolute;inset:5px 6px;clip-path:${oval};background:linear-gradient(180deg,var(--mist) 0 48%,var(--sky) 48% 74%,var(--lake) 74%);display:grid;place-items:center;overflow:hidden}
.wd-plaque .face .glass::after{content:'';position:absolute;left:18%;top:12%;width:4px;height:12px;background:var(--snow);opacity:.7;box-shadow:6px 4px 0 -1px var(--snow)}
.wd-plaque .face img{width:100%;height:100%;object-fit:contain;animation:wdBob 3s steps(6) infinite}
.wd-plaque .face .rim{position:absolute;inset:0;pointer-events:none}
.wd-plaque .txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;color:var(--paper);padding:2px 0}
.wd-plaque h3{margin:0;font-size:17px;color:var(--lamp);text-shadow:1px 2px 0 var(--ink);line-height:1}
.wd-plaque .lat{font-size:12px;font-style:italic;color:var(--straw);font-family:var(--font-small);line-height:1.1}
.wd-plaque p{margin:0;font-size:13px;line-height:1.12;color:var(--oat);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wd-plaque .fact{display:none;font-size:12px;color:var(--ice);gap:4px;align-items:flex-start;line-height:1.1}
.wd-plaque .fact .ico{flex:none;margin:-4px 0}
.wd-plaque .act{display:flex;flex-direction:column;gap:2px;justify-content:center;align-items:center;flex:none}
.wd-plaque .act .btn{min-width:84px;font-size:15px;white-space:nowrap;padding-left:6px;padding-right:6px}
.wd-plaque .act .btn .price{color:inherit}
.wd-plaque .act .note{font-size:11px;color:var(--rose);text-align:center;max-width:92px;line-height:1.05}
@media (min-width:420px){.wd-plaque .fact{display:flex}.wd-plaque .face{width:90px;height:90px}}
@keyframes wdIn{from{opacity:0;transform:translateY(-10px) rotate(-4deg)}}
@keyframes wdUp{from{opacity:0;transform:translateY(16px)}}
@keyframes wdSpin{to{transform:rotate(360deg)}}
@keyframes wdSway{0%,100%{transform:rotate(0)}25%{transform:rotate(1.6deg)}75%{transform:rotate(-1.6deg)}}
@keyframes wdBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){.wd-card,.wd-plaque,.wd-card.on,.wd-tag.on,.wd-plaque .face img{animation:none}}
`;
  const st = document.createElement('style');
  st.id = 'hh-wardrobe';
  st.textContent = css;
  document.head.appendChild(st);
}

// ------------------------------------------------------------------ helpers

const owlLook = (look: OwlLook): OwlLook => ({ ...look, outfit: { ...look.outfit } });
const progressDress = () => { void import('../game/quests.ts').then((q) => q.progress('dress')); };

function speciesState(sp: SpeciesDef) {
  const s = save.value, lv = level.value.level;
  const owned = s.owned.species.includes(sp.id);
  const free = !owned && sp.starter;
  const lockedAt = !owned && !free && sp.level && lv < sp.level ? sp.level : 0;
  const price = sp.gems ? { gems: sp.gems } : { coins: sp.price };
  return { owned, free, lockedAt, price };
}
function pieceState(p: PieceDef) {
  const s = save.value;
  const owned = s.owned.pieces.includes(p.id);
  return { owned, series: !owned && p.series ? p.series : '', area: !owned && p.area ? p.area : '', price: p.premium ? { gems: p.price } : { coins: p.price } };
}
/** Pieces anyone can see in the wardrobe (Queen Neve's own regalia stays with her). */
const visiblePieces = (slot: OutfitSlot) => PIECES.filter((p) => p.slot === slot && !(p.noStore && !p.series));

function afford(price: { coins?: number; gems?: number }): string | null {
  const s = save.value;
  if (price.gems && s.gems < price.gems) return 'Not enough moon gems';
  if (price.coins && s.coins < price.coins) return 'Not enough acorns';
  return null;
}

function celebrate(kind: 'buy' | 'wear') {
  const sc = sceneRef.current;
  if (!sc) return;
  if (kind === 'buy') { sc.owl.play('dance'); sc.owl.setMood('excited', 2.4); } else { sc.owl.play('ruffle'); sc.owl.setMood('happy', 1.6); }
  try {
    const p = sc.owl.node.position;
    (sc as unknown as { fx?: { burst?: (k: string, x: number, y: number, z: number, n: number) => void } }).fx?.burst?.(kind === 'buy' ? 'confetti' : 'sparkle', p.x, p.y + 1.1, p.z, kind === 'buy' ? 22 : 10);
  } catch { /* effects are a bonus */ }
}

// ------------------------------------------------------------------ cards

function Spinner() { return <Px name="sparkle" size={22} class="spin" />; }

function SpeciesCard(p: { sp: SpeciesDef; on: boolean; wearing: boolean; onPick: (e: MouseEvent) => void; i: number }) {
  const st = speciesState(p.sp);
  const url = useOwlIcon({ skin: 'owl', species: p.sp.id, palette: p.sp.id, outfit: {} }, 'face');
  return (
    <button class={'wd-card' + (p.on ? ' on' : '') + (st.lockedAt ? ' locked' : '')} style={{ animationDelay: `${p.i * 30}ms` }} onClick={p.onPick}>
      <Px name="wd_hanger" size={34} class="hook" />
      {p.sp.gems && !st.owned ? <span class="ribbon">Rare</span> : st.free ? <span class="ribbon gold">Free</span> : null}
      <div class="pic">{url ? <img src={url} alt="" /> : <Spinner />}</div>
      <div class="nm">{p.sp.name}</div>
      {p.wearing ? <span class="st wear">Wearing</span>
        : st.owned ? <span class="st own">Owned</span>
        : st.free ? <span class="st own">Free to claim</span>
        : st.lockedAt ? <span class="st lock"><Px name="lock" size={18} /> Level {st.lockedAt}</span>
        : <Price {...st.price} />}
    </button>
  );
}

function SkinCard(p: { skin: SkinDef2 | null; on: boolean; wearing: boolean; owned: boolean; species: string; onPick: (e: MouseEvent) => void; i: number }) {
  const id = p.skin?.id ?? 'owl';
  const url = useOwlIcon({ skin: id, species: p.species, palette: id === 'meowl' ? 'tabby' : p.species, outfit: {} }, 'face');
  return (
    <button class={'wd-card' + (p.on ? ' on' : '') + (p.owned ? '' : ' locked')} style={{ animationDelay: `${p.i * 30}ms` }} onClick={p.onPick}>
      <Px name="wd_hanger" size={34} class="hook" />
      {p.skin?.series && <span class="ribbon red">{p.skin.series === 'frostlight' ? 'Frostlight' : 'Starfall'}</span>}
      <div class="pic">{url ? <img src={url} alt="" /> : <Spinner />}</div>
      <div class="nm">{p.skin ? p.skin.name : 'Natural plumage'}</div>
      {p.wearing ? <span class="st wear">Wearing</span> : p.owned ? <span class="st own">Owned</span> : <span class="st muted">In the boutique</span>}
    </button>
  );
}

function PieceCard(p: { piece: PieceDef; look: OwlLook; on: boolean; wearing: boolean; onPick: (e: MouseEvent) => void; i: number }) {
  const st = pieceState(p.piece);
  const url = usePieceIcon(p.piece.id, p.piece.slot, p.look);
  const locked = !st.owned && (st.series || st.area);
  return (
    <button class={'wd-card' + (p.on ? ' on' : '') + (locked ? ' locked' : '')} style={{ animationDelay: `${p.i * 25}ms` }} onClick={p.onPick}>
      <Px name="wd_hanger" size={34} class="hook" />
      {p.piece.series ? <span class="ribbon red">{p.piece.series === 'frostlight' ? 'Frostlight' : 'Starfall'}</span> : p.piece.premium && !st.owned ? <span class="ribbon">Premium</span> : null}
      <div class="pic">{url ? <img src={url} alt="" /> : <Spinner />}</div>
      <div class="nm">{p.piece.name}</div>
      {p.wearing ? <span class="st wear">Wearing</span>
        : st.owned ? <span class="st own">Owned</span>
        : st.series ? <span class="st muted">Series banner</span>
        : st.area ? <span class="st muted">Found on trips</span>
        : <Price {...st.price} />}
    </button>
  );
}

// ------------------------------------------------------------------ plaques

function Plaque(p: { face: string; title: string; latin?: string; text: string; fact?: string; children: preact.ComponentChildren }) {
  return (
    <div class="wd-plaque" key={p.title}>
      <div class="face"><div class="glass">{p.face ? <img src={p.face} alt="" /> : <Spinner />}</div><Px name="wd_frame" size={90} class="rim" /></div>
      <div class="txt">
        <h3>{p.title}</h3>
        {p.latin && <span class="lat">{p.latin}</span>}
        <p>{p.text}</p>
        {p.fact && <span class="fact"><Px name="magnifier" size={18} />{p.fact}</span>}
      </div>
      <div class="act">{p.children}</div>
    </div>
  );
}

function SpeciesPlaque(p: { sp: SpeciesDef; wearing: boolean }) {
  const st = speciesState(p.sp);
  const face = useOwlIcon({ skin: 'owl', species: p.sp.id, palette: p.sp.id, outfit: {} }, 'face');
  const wearIt = () => {
    edit((x) => { x.look.species = p.sp.id; x.look.palette = p.sp.id; if (x.look.skin !== 'meowl') x.look.skin = 'owl'; });
    progressDress();
  };
  return (
    <Plaque face={face} title={p.sp.name} latin={p.sp.latin} text={p.sp.blurb} fact={p.sp.fact}>
      {p.wearing ? <button class="btn soft sm" disabled>Wearing</button>
        : st.owned ? <button class="btn pillow sm" onClick={() => { tap('fabric', 0.6); wearIt(); celebrate('wear'); }}>Wear</button>
        : st.free ? <button class="btn pillow honey sm" onClick={() => { tap('reward_unlock', 0.6); edit((x) => grant(x, { kind: 'species', id: p.sp.id })); wearIt(); celebrate('buy'); toast(`${p.sp.name} joined your wardrobe`, IcoHanger); }}>Claim</button>
        : st.lockedAt ? <><button class="btn pillow sm" disabled>Locked</button><span class="note">Reach level {st.lockedAt} to unlock</span></>
        : <button class="btn pillow honey sm" onClick={() => {
          const err = afford(st.price);
          if (err) { tap('ui_error'); toast(err); return; }
          sound.play('ui_buy', { volume: 0.6 });
          edit((x) => { x.coins -= st.price.coins ?? 0; x.gems -= st.price.gems ?? 0; grant(x, { kind: 'species', id: p.sp.id }); });
          wearIt(); celebrate('buy'); toast(`${p.sp.name} unlocked!`, IcoHanger);
        }}>Buy <Price {...st.price} /></button>}
    </Plaque>
  );
}

function SkinPlaque(p: { skin: SkinDef2 | null; owned: boolean; wearing: boolean; species: string }) {
  const id = p.skin?.id ?? 'owl';
  const face = useOwlIcon({ skin: id, species: p.species, palette: id === 'meowl' ? 'tabby' : p.species, outfit: {} }, 'face');
  return (
    <Plaque face={face} title={p.skin ? p.skin.name : 'Natural plumage'} latin={p.skin?.series ? SERIES_NAME[p.skin.series] : undefined} text={p.skin ? p.skin.blurb : 'Pip as nature made them: real feathers, real markings.'}>
      {p.wearing ? <button class="btn soft sm" disabled>Wearing</button>
        : p.owned ? <button class="btn pillow sm" onClick={() => { tap('fabric', 0.6); edit((x) => { x.look.skin = id; }); progressDress(); celebrate('wear'); }}>Wear</button>
        : <><button class="btn pillow night sm" onClick={() => { tap('ui_open', 0.5); panel.value = 'shop'; }}>Store</button><span class="note">{p.skin?.series ? 'Pull it from the series banner' : 'Sold in Barnaby’s lodge store'}</span></>}
    </Plaque>
  );
}

function PiecePlaque(p: { piece: PieceDef; look: OwlLook; wearing: boolean }) {
  const st = pieceState(p.piece);
  const face = usePieceIcon(p.piece.id, p.piece.slot, p.look);
  const area = st.area ? AREAS.find((a) => a.id === st.area)?.name : '';
  return (
    <Plaque face={face} title={p.piece.name} latin={p.piece.series ? SERIES_NAME[p.piece.series] : undefined} text={p.piece.blurb}>
      {p.wearing ? <button class="btn soft sm" onClick={() => { tap('fabric', 0.5); wear(p.piece.slot, null); }}>Take off</button>
        : st.owned ? <button class="btn pillow sm" onClick={() => { tap('fabric', 0.6); wear(p.piece.slot, p.piece.id); celebrate('wear'); }}>Wear</button>
        : st.series ? <><button class="btn pillow night sm" onClick={() => { tap('ui_open', 0.5); panel.value = 'shop'; }}>Banner</button><span class="note">From the {SERIES_NAME[st.series]}</span></>
        : st.area ? <><button class="btn pillow sm" disabled>Trying on</button><span class="note">Pip may find it in {area}</span></>
        : <button class="btn pillow honey sm" onClick={() => {
          const err = afford(st.price);
          if (err) { tap('ui_error'); toast(err); return; }
          sound.play('ui_buy', { volume: 0.6 });
          edit((x) => { x.coins -= st.price.coins ?? 0; x.gems -= st.price.gems ?? 0; grant(x, { kind: 'piece', id: p.piece.id }); });
          wear(p.piece.slot, p.piece.id); celebrate('buy');
        }}>Buy <Price {...st.price} /></button>}
    </Plaque>
  );
}

// ------------------------------------------------------------------ the room

export function Wardrobe() {
  installStyles();
  const s = save.value, look = s.look;
  const curSpecies = resolveSpecies(look).id;
  const curSkin = look.skin && look.skin !== 'owl' ? look.skin : 'owl';
  const [tab, setTab] = useState<Tab>('species');
  const [pick, setPick] = useState<string | null>(null);
  const applied = useRef('');

  // frame the owl, hold it still for fitting, and put the real look back when the room closes
  useEffect(() => {
    const sc = sceneRef.current;
    sc?.setView('owl');
    sc?.owl.setMood('happy', 2.5);
    if (sc) sc.owl.still = true;
    return () => { if (sc) { sc.owl.still = false; sc.setView('home'); sc.setLook(save.value.look); } };
  }, []);

  // what Pip is trying on right now
  const preview = useMemo((): OwlLook => {
    const l = owlLook(look);
    if (!pick) return l;
    if (tab === 'species') { l.species = pick; l.palette = pick; if (l.skin !== 'meowl') l.skin = 'owl'; }
    else if (tab === 'skins') l.skin = pick;
    else if (pick === '__none') delete l.outfit[tab];
    else l.outfit[tab] = pick;
    return l;
  }, [look, pick, tab]);
  useEffect(() => {
    const key = JSON.stringify(preview);
    if (key === applied.current) return;
    applied.current = key;
    sceneRef.current?.setLook(preview);
  }, [preview]);

  const choose = (id: string, e?: MouseEvent) => {
    tap('ui_tap', 0.5); sound.play('fabric', { volume: 0.35, gap: 60 }); setPick(id);
    sceneRef.current?.owl.play(tab === 'head' ? 'hop' : tab === 'species' ? 'spin' : 'ruffle');
    if (e?.currentTarget) uiBurstAt(e.currentTarget as Element, tab === 'skins' ? 'magic' : 'sparkle', 7);
  };
  const switchTab = (t: Tab) => { setTab(t); setPick(null); };
  const pieceLook: OwlLook = { skin: curSkin, species: curSpecies, palette: curSpecies, outfit: {} };

  const purse = (
    <div class="wd-purse" aria-label={`${s.coins} acorns, ${s.gems} moon gems`}>
      <Price coins={s.coins || 0} />
      <Price gems={s.gems || 0} />
    </div>
  );

  let shelf: preact.ComponentChildren, plaque: preact.ComponentChildren = null, hint = '';
  if (tab === 'species') {
    hint = 'Real owls from around the world. Tap one to try it on.';
    shelf = SPECIES.map((sp, i) => <SpeciesCard key={sp.id} sp={sp} i={i} on={(pick ?? curSpecies) === sp.id} wearing={curSpecies === sp.id} onPick={(e) => choose(sp.id, e)} />);
    const sp = SPECIES.find((x) => x.id === (pick ?? curSpecies))!;
    plaque = <SpeciesPlaque sp={sp} wearing={sp.id === curSpecies} />;
  } else if (tab === 'skins') {
    hint = 'Special skins replace the feathers but keep your owl’s shape.';
    const list: (SkinDef2 | null)[] = [null, ...SPECIAL_SKINS];
    const owns = (id: string) => id === 'owl' || s.owned.skins.includes(id);
    shelf = list.map((k, i) => { const id = k?.id ?? 'owl'; return <SkinCard key={id} skin={k} i={i} owned={owns(id)} species={curSpecies} on={(pick ?? curSkin) === id} wearing={curSkin === id} onPick={(e) => choose(id, e)} />; });
    const sel = pick ?? curSkin, k = SPECIAL_SKINS.find((x) => x.id === sel) ?? null;
    plaque = <SkinPlaque skin={k} owned={owns(sel)} wearing={sel === curSkin} species={curSpecies} />;
  } else {
    const slot = tab, worn = look.outfit[slot];
    const list = visiblePieces(slot);
    shelf = [
      <button key="none" class={'wd-card' + ((pick ?? worn ?? '__none') === '__none' ? ' on' : '')} onClick={() => { tap('ui_tap', 0.5); setPick('__none'); if (worn) wear(slot, null); }}>
        <div class="pic"><IcoClose size={40} /></div><div class="nm">Nothing</div><span class="st muted">{worn ? 'Take off' : 'Bare feathers'}</span>
      </button>,
      ...list.map((pc, i) => <PieceCard key={pc.id} piece={pc} look={pieceLook} i={i + 1} on={(pick ?? worn) === pc.id} wearing={worn === pc.id} onPick={(e) => choose(pc.id, e)} />),
    ];
    const sel = pick && pick !== '__none' ? list.find((x) => x.id === pick) : worn ? list.find((x) => x.id === worn) : undefined;
    if (sel) plaque = <PiecePlaque piece={sel} look={pieceLook} wearing={worn === sel.id} />;
  }

  return (
    <Sheet class="short wd" title={<span class="row" style="gap:4px"><Px name="wd_mirror" size={34} />Dressing Room</span>} right={purse} onClose={() => { if (panel.value === 'wardrobe') panel.value = null; }}>
      <div class="wd-rail" role="tablist">
        {TABS.map((t) => (
          <button role="tab" aria-selected={tab === t.v} class={'wd-tag' + (tab === t.v ? ' on' : '')} onClick={() => { tap('ui_tab', 0.45); switchTab(t.v); }}>
            <Px name={t.icon} size={30} /><span>{t.label}</span>
          </button>
        ))}
      </div>
      {plaque}
      {!plaque && hint && <p class="wd-hint">{hint}</p>}
      <div class="wd-room"><div class="wd-shelf" key={tab}>{shelf}</div></div>
    </Sheet>
  );
}
