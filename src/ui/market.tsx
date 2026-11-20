// The market: furniture for the tree house, outfits, coats and the Meowl look, moonstones and
// Hoot Hollow Plus. Purchases go through a small provider interface; the bundled one is a clearly
// labelled demo store (no real payment) so the whole flow can be tried without a backend.
import { useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { PLUS_PERKS, PLUS_PLANS, STONE_PACKS, type Product } from '../game/catalog.ts';
import { buy, edit, ownsEntry, priceOf, save, type Buyable } from '../game/store.ts';
import { PIECES, SLOT_NAME } from '../owl/outfits.ts';
import { coatsFor, PALETTES, SKINS, type Skin } from '../owl/palette.ts';
import { ALL_ITEMS } from '../world/scene.ts';
import { IcoAcorn, IcoLock, IcoSatchel, IcoSparkle, IcoStone } from './icons.tsx';
import { Price, Seg, Sheet, tap, toast } from './kit.tsx';
import { coatIcon, itemIcon, pieceIcon } from './portraits.ts';
import { marketTab, panel } from './state.ts';
import { ask } from './fx.tsx';
import { spriteURL } from './px/sprites.js';

/** Where real payments would plug in (App Store, Play Billing, Stripe...). */
export interface PurchaseProvider { buy(p: Product): Promise<boolean> }
export const demoStore: PurchaseProvider = {
  async buy(p) {
    await new Promise((r) => setTimeout(r, 250));
    return ask({ title: p.name, art: spriteURL(p.stones ? 'moonstone' : 'star', 6), ok: `Grant for testing`, cancel: 'Cancel', tone: 'honey',
      body: <>{p.blurb} · <b>{p.price}</b><br /><span class="small">Demo store: no payment provider is connected, so nothing is charged.</span></> });
  },
};

function Detail(p: { b: Buyable; name: string; blurb: string; art: string; onClose: () => void }) {
  const owned = ownsEntry(save.value, p.b), price = priceOf(p.b);
  return (
    <div class="card col" style="align-items:center;text-align:center;gap:8px;animation:rise .4s var(--ease)">
      <span class="pin" />
      <img src={p.art} alt="" style="width:132px;height:132px;object-fit:contain;filter:drop-shadow(0 8px 6px rgba(60,38,22,.25))" />
      <h3>{p.name}</h3>
      <p class="small muted">{p.blurb}</p>
      <div class="row" style="width:100%;gap:8px">
        <button class="btn soft grow" onClick={() => { tap('ui_back'); p.onClose(); }}>Close</button>
        {owned ? <button class="btn pillow grow" onClick={() => { tap(); panel.value = p.b.kind === 'item' ? 'decorate' : 'wardrobe'; }}>{p.b.kind === 'item' ? 'Place it' : 'Try it on'}</button>
          : <button class="btn pillow honey grow" onClick={() => {
            const err = buy(p.b);
            if (err) { tap('ui_error'); toast(err, price.stones ? IcoStone : IcoAcorn); return; }
            sound.play('ui_buy', { volume: 0.6 }); sound.play('reward_coin', { volume: 0.4 });
            toast(`${p.name} is yours!`, IcoSparkle);
          }}>Buy <Price {...price} /></button>}
      </div>
    </div>
  );
}

function Tile(p: { art: string; name: string; b: Buyable; on?: boolean; onClick: () => void; badge?: string }) {
  const owned = ownsEntry(save.value, p.b);
  return (
    <button class={'tile' + (p.on ? ' on' : '')} onClick={() => { tap('ui_tap', 0.5); p.onClick(); }}>
      {p.badge && <span class="badge">{p.badge}</span>}
      <div class="art"><img src={p.art} alt="" loading="lazy" /></div>
      <div class="nm">{p.name}</div>
      {owned ? <span class="owned">Owned</span> : <Price {...priceOf(p.b)} />}
    </button>
  );
}

function Furniture() {
  const [sel, setSel] = useState<string | null>(null);
  const items = ALL_ITEMS.filter((i) => i.price > 0 || i.gems);
  const it = sel ? items.find((x) => x.id === sel) : null;
  return (
    <>
      {it && <Detail b={{ kind: 'item', id: it.id }} name={it.name} blurb={it.blurb} art={itemIcon(it.id)} onClose={() => setSel(null)} />}
      <div class="grid">{items.map((i) => <Tile art={itemIcon(i.id)} name={i.name} b={{ kind: 'item', id: i.id }} on={sel === i.id} onClick={() => setSel(i.id)} />)}</div>
    </>
  );
}

function Outfits() {
  const [sel, setSel] = useState<string | null>(null);
  const look = save.value.look;
  const shop = PIECES.filter((p) => !p.area && p.price > 0);
  const pc = sel ? PIECES.find((x) => x.id === sel) : null;
  return (
    <>
      {pc && <Detail b={{ kind: 'piece', id: pc.id }} name={pc.name} blurb={pc.blurb} art={pieceIcon(pc.id, pc.slot, look)} onClose={() => setSel(null)} />}
      {(['head', 'face', 'neck', 'body', 'back'] as const).map((slot) => {
        const list = shop.filter((p) => p.slot === slot);
        if (!list.length) return null;
        return <div class="col" style="gap:8px"><div class="label">{SLOT_NAME[slot]}</div><div class="grid">{list.map((p) => <Tile art={pieceIcon(p.id, p.slot, look)} name={p.name} b={{ kind: 'piece', id: p.id }} on={sel === p.id} badge={p.premium ? 'Plus look' : undefined} onClick={() => setSel(p.id)} />)}</div></div>;
      })}
      <p class="small muted center">More outfits turn up on Pip's night adventures.</p>
    </>
  );
}

function Coats() {
  const [sel, setSel] = useState<string | null>(null);
  const s = save.value;
  const ownsSkin = (k: Skin) => k === 'owl' || s.owned.skins.includes(k);
  const c = sel ? PALETTES.find((x) => x.id === sel) : null;
  return (
    <>
      <div class="col" style="gap:8px"><div class="label">Looks</div>
        <div class="grid">{SKINS.map((k) => (
          <button class="tile" onClick={() => {
            tap();
            if (ownsSkin(k.id)) { panel.value = 'wardrobe'; return; }
            if (s.stones < k.stones) { tap('ui_error'); toast('Not enough moonstones', IcoStone); marketTab.value = 'stones'; return; }
            edit((x) => { x.stones -= k.stones; x.owned.skins = [...x.owned.skins, k.id]; if (k.id === 'meowl' && !x.owned.palettes.includes('tabby')) x.owned.palettes.push('tabby'); });
            sound.play('reward_unlock', { volume: 0.6 });
            toast(`The ${k.name} look is yours!`, IcoSparkle);
          }}>
            <div class="art"><img src={coatIcon(k.id === 'owl' ? 'tawny' : 'tabby', k.id)} alt="" /></div>
            <div class="nm">{k.name}</div>
            {ownsSkin(k.id) ? <span class="owned">Owned</span> : <Price stones={k.stones} />}
          </button>
        ))}</div>
      </div>
      {c && <Detail b={{ kind: 'palette', id: c.id }} name={c.name + ' coat'} blurb={c.blurb} art={coatIcon(c.id, c.skin)} onClose={() => setSel(null)} />}
      {(['owl', 'meowl'] as Skin[]).map((k) => (
        <div class="col" style="gap:8px"><div class="label">{k === 'owl' ? 'Owl coats' : 'Meowl coats'}</div>
          <div class="grid">{coatsFor(k).filter((p) => p.price > 0 && !p.unlock).map((p) => (
            <div style="position:relative"><Tile art={coatIcon(p.id, p.skin)} name={p.name} b={{ kind: 'palette', id: p.id }} on={sel === p.id} badge={p.premium ? 'Premium' : undefined} onClick={() => setSel(p.id)} />
              {!ownsSkin(k) && <div class="lockd"><IcoLock size={40} /></div>}</div>
          ))}</div>
        </div>
      ))}
    </>
  );
}

function Stones() {
  const s = save.value;
  const plus = async (p: Product) => {
    tap();
    if (await demoStore.buy(p)) {
      edit((x) => { x.plus = { active: true, plan: p.plan, since: Date.now(), lastStipend: Date.now() }; x.stones += 50; });
      sound.play('reward_levelup', { volume: 0.6 });
      toast('Welcome to Hoot Hollow Plus!', IcoSparkle);
    }
  };
  return (
    <>
      <div class="plus-card col">
        <div class="row" style="gap:10px"><IcoSparkle size={40} /><div><h2 style="color:#fff4d6">Hoot Hollow Plus</h2><p class="small" style="opacity:.85">{s.plus.active ? `Active · ${s.plus.plan === 'yearly' ? 'yearly' : 'monthly'} plan` : 'Optional. Everything important stays free.'}</p></div></div>
        <ul>{PLUS_PERKS.map((p) => <li>{p}</li>)}</ul>
        {!s.plus.active ? <div class="col" style="gap:8px">{PLUS_PLANS.map((p) => <button class="btn pillow honey block" onClick={() => void plus(p)}>{p.blurb} · {p.price}{p.badge && <span class="small" style="opacity:.8"> ({p.badge})</span>}</button>)}</div>
          : <button class="btn soft block" onClick={async () => { tap(); if (await ask({ title: 'Cancel Plus?', body: 'Pip keeps everything already collected. (Demo store, nothing is charged.)', ok: 'Cancel Plus', cancel: 'Keep it', tone: 'berry' })) edit((x) => { x.plus = { active: false }; }); }}>Manage subscription</button>}
      </div>
      <div class="col" style="gap:8px"><div class="label">Moonstones</div>
        {STONE_PACKS.map((p) => (
          <button class="card row" style="text-align:left" onClick={async () => { tap(); if (await demoStore.buy(p)) { edit((x) => { x.stones += p.stones ?? 0; }); sound.play('reward_gem', { volume: 0.6 }); toast(`+${p.stones} moonstones`, IcoStone); } }}>
            <IcoStone size={40} /><div class="grow"><b>{p.name}</b><div class="small muted">{p.blurb}</div></div>
            {p.badge && <span class="rarity" style="--rc:#d9576a">{p.badge}</span>}<b class="num">{p.price}</b>
          </button>
        ))}
      </div>
      <p class="small muted center">Demo store: no payment provider is connected in this build, so nothing is ever charged.</p>
    </>
  );
}

export function Market() {
  return (
    <Sheet title={<span class="row" style="gap:8px"><IcoSatchel size={40} />Market</span>} sub={<span class="row" style="gap:12px"><span class="row" style="gap:3px"><IcoAcorn size={20} />{save.value.acorns.toLocaleString()}</span><span class="row" style="gap:3px"><IcoStone size={20} />{save.value.stones}</span></span>}>
      <Seg value={marketTab.value} onChange={(v) => (marketTab.value = v)} options={[{ v: 'furniture', label: 'Home' }, { v: 'outfits', label: 'Outfits' }, { v: 'coats', label: 'Coats' }, { v: 'stones', label: 'Plus' }]} />
      {marketTab.value === 'furniture' ? <Furniture /> : marketTab.value === 'outfits' ? <Outfits /> : marketTab.value === 'coats' ? <Coats /> : <Stones />}
    </Sheet>
  );
}
