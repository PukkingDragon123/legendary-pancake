// Panels opened from the home screen: the wardrobe (try outfits and coats live), decorating the
// tree house (tap a glowing spot, pick a piece), and the map of places Pip can explore.
import { useEffect, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { AREAS, TRINKETS, ZONE_LEVEL, ZONE_NAME } from '../game/catalog.ts';
import { areaOpen, buy, edit, level, placeFurniture, priceOf, save, setCoat, wear, zones } from '../game/store.ts';
import type { OutfitSlot } from '../owl/model.ts';
import { PIECES, SLOT_NAME, SLOT_ORDER } from '../owl/outfits.ts';
import { coatsFor, SKINS, type Skin } from '../owl/palette.ts';
import { ITEMS } from '../world/scene.ts';
import { IcoBrush, IcoCheck, IcoClose, IcoHanger, IcoLock, IcoMap, IcoSparkle } from './icons.tsx';
import { Price, Sheet, Tags, tap, toast } from './kit.tsx';
import { coatIcon, itemIcon, pieceIcon } from './portraits.ts';
import { panel, sceneRef } from './state.ts';

// ------------------------------------------------------------------ wardrobe

export function Wardrobe() {
  const s = save.value, look = s.look;
  const skin: Skin = look.skin ?? 'owl';
  const [slot, setSlot] = useState<OutfitSlot | 'coat'>('head');
  const [trying, setTrying] = useState<string | null>(null);
  useEffect(() => {
    const sc = sceneRef.current;
    sc?.setView('owl');
    sc?.owl.setMood('proud', 2);
    sc && (sc.owl.still = true);
    return () => { if (sc) { sc.owl.still = false; sc.setView('home'); sc.setLook(save.value.look); } };
  }, []);
  // preview something not yet owned on the live owl
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    if (!trying) { sc.setLook(save.value.look); return; }
    if (slot === 'coat') sc.setLook({ ...look, palette: trying });
    else sc.setLook({ ...look, outfit: { ...look.outfit, [slot]: trying } });
  }, [trying, slot]);
  const pieces = PIECES.filter((p) => p.slot === slot);
  const coats = coatsFor(skin);
  const ownsSkin = (k: Skin) => k === 'owl' || s.owned.skins.includes(k);
  return (
    <Sheet class="short" title={<span class="row" style="gap:8px"><IcoHanger size={40} />Wardrobe</span>} onClose={() => { if (panel.value === 'wardrobe') panel.value = null; }}>
      <Tags value={slot} onChange={(v) => { setSlot(v); setTrying(null); }} options={[...SLOT_ORDER.map((k) => ({ v: k as OutfitSlot | 'coat', label: SLOT_NAME[k] })), { v: 'coat', label: 'Coat & look' }]} />
      {slot === 'coat' ? (
        <>
          <div class="grid">{SKINS.map((k) => (
            <button class={'tile' + (skin === k.id ? ' on' : '')} onClick={() => {
              tap();
              if (!ownsSkin(k.id)) { toast(`The ${k.name} look is in the Market`, IcoSparkle); return; }
              const coat = coatsFor(k.id).find((c) => s.owned.palettes.includes(c.id))?.id ?? coatsFor(k.id)[0].id;
              edit((x) => { x.look.skin = k.id; x.look.palette = coat; });
              sceneRef.current?.owl.play('ruffle');
            }}>
              <div class="art"><img src={coatIcon(k.id === 'owl' ? 'tawny' : 'tabby', k.id)} alt="" /></div>
              <div class="nm">{k.name}</div>{ownsSkin(k.id) ? <span class="owned">{skin === k.id ? 'Wearing' : 'Owned'}</span> : <Price gems={k.gems} />}
            </button>
          ))}</div>
          <div class="grid">{coats.map((c) => {
            const owned = s.owned.palettes.includes(c.id), on = look.palette === c.id;
            return (
              <button class={'tile' + (on || trying === c.id ? ' on' : '')} onClick={() => {
                tap();
                if (owned) { setTrying(null); setCoat(c.id); sceneRef.current?.owl.play('ruffle'); sound.play('fabric', { volume: 0.5 }); }
                else setTrying(c.id);
              }}>
                <div class="art"><img src={coatIcon(c.id, c.skin)} alt="" loading="lazy" /></div>
                <div class="nm">{c.name}</div>
                {owned ? <span class="owned">{on ? 'Wearing' : 'Owned'}</span> : c.unlock ? <span class="small muted">Found on adventures</span> : <Price {...priceOf({ kind: 'palette', id: c.id })} />}
              </button>
            );
          })}</div>
        </>
      ) : (
        <div class="grid">
          <button class={'tile' + (!look.outfit[slot] ? ' on' : '')} onClick={() => { tap(); setTrying(null); wear(slot, null); }}><div class="art"><IcoClose size={40} /></div><div class="nm">Nothing</div></button>
          {pieces.map((p) => {
            const owned = s.owned.pieces.includes(p.id), on = look.outfit[slot] === p.id;
            return (
              <button class={'tile' + (on || trying === p.id ? ' on' : '')} onClick={() => {
                tap();
                if (owned) { setTrying(null); wear(slot, p.id); sceneRef.current?.owl.play(slot === 'head' ? 'hop' : 'ruffle'); sound.play('fabric', { volume: 0.5 }); }
                else setTrying(p.id);
              }}>
                <div class="art"><img src={pieceIcon(p.id, p.slot, look)} alt="" loading="lazy" /></div>
                <div class="nm">{p.name}</div>
                {owned ? <span class="owned">{on ? 'Wearing' : 'Owned'}</span> : p.area ? <span class="small muted">Found in {AREAS.find((a) => a.id === p.area)?.name}</span> : <Price {...priceOf({ kind: 'piece', id: p.id })} />}
              </button>
            );
          })}
        </div>
      )}
      {trying && (() => {
        const kind = slot === 'coat' ? 'palette' : 'piece';
        const def = slot === 'coat' ? coats.find((c) => c.id === trying) : PIECES.find((p) => p.id === trying);
        const found = slot === 'coat' ? !!(def as { unlock?: string })?.unlock : !!(def as { area?: string })?.area;
        return (
          <div class="card row" style="position:sticky;bottom:0">
            <div class="grow"><b>{def?.name}</b><div class="small muted">{found ? 'Pip can find this on an adventure.' : 'Trying it on'}</div></div>
            <button class="btn soft sm" onClick={() => { tap('ui_back'); setTrying(null); }}>Back</button>
            {!found && <button class="btn pillow honey sm" onClick={() => {
              const err = buy({ kind, id: trying });
              if (err) { tap('ui_error'); toast(err); return; }
              sound.play('ui_buy', { volume: 0.6 });
              if (kind === 'palette') setCoat(trying); else wear(slot as OutfitSlot, trying);
              setTrying(null);
              sceneRef.current?.owl.play('dance');
            }}>Buy <Price {...priceOf({ kind, id: trying })} /></button>}
          </div>
        );
      })()}
    </Sheet>
  );
}

// ------------------------------------------------------------------ decorate

type DZone = 'ground' | 'loft' | 'deck' | 'garden';
export const decorSlot = { value: null as string | null, set: (_: string | null) => {} };

export function Decorate() {
  const s = save.value;
  const [zone, setZone] = useState<DZone>('ground');
  const [slot, setSlot] = useState<string | null>(null);
  const z = zones.value;
  const open = zone === 'ground' || z[zone];
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    sc.setView(zone === 'ground' ? 'interior' : zone === 'loft' ? 'loft' : zone === 'deck' ? 'deck' : 'garden');
    sc.setDecorating(open, zone);
    const off = sc.on((e) => { if (e.type === 'tapSlot') { tap('wood_knock', 0.5); setSlot(e.id); } });
    return () => { off(); };
  }, [zone, open]);
  useEffect(() => {
    const sc = sceneRef.current;
    if (sc) sc.owl.node.visible = false; // Pip steps outside so you can see the room
    return () => { if (sc) { sc.setDecorating(false); sc.setView('home'); sc.owl.node.visible = sc.owlPlace !== 'away'; } };
  }, []);
  const def = slot ? sceneRef.current?.house.slots.find((x) => x.id === slot) : null;
  const current = slot ? s.furniture[slot] : undefined;
  const fits = (id: string) => {
    const it = ITEMS[id];
    if (!it || !def) return false;
    if (def.kind === 'wall') return it.cat === 'wall';
    return it.cat !== 'wall';
  };
  const owned = s.owned.items.filter(fits);
  return (
    <Sheet class="short" title={<span class="row" style="gap:8px"><IcoBrush size={40} />Decorate</span>} sub={slot ? def?.label : 'Tap a glowing spot in the house'} onClose={() => { if (panel.value === 'decorate') panel.value = null; }}>
      <Tags value={zone} onChange={(v) => { setZone(v); setSlot(null); }} options={(['ground', 'loft', 'deck', 'garden'] as DZone[]).map((k) => ({ v: k, label: <>{k !== 'ground' && !z[k as 'loft'] && <IcoLock size={20} />}{k === 'ground' ? 'Room' : ZONE_NAME[k as 'loft']}</> }))} />
      {!open ? (
        <div class="card col center" style="align-items:center">
          <IcoLock size={40} />
          <h3>{ZONE_NAME[zone as 'loft']} opens at level {ZONE_LEVEL[zone as 'loft']}</h3>
          <p class="small muted">You're level {level.value.level}. Every good night of sleep brings it closer.</p>
        </div>
      ) : slot ? (
        <>
          <div class="grid">
            {current && <button class="tile" onClick={() => { tap('pickup_item'); placeFurniture(slot, null); }}><div class="art"><IcoClose size={40} /></div><div class="nm">Clear spot</div></button>}
            {owned.map((id) => {
              const inUse = Object.entries(s.furniture).find(([, v]) => v === id)?.[0];
              return (
                <button class={'tile' + (current === id ? ' on' : '')} onClick={() => {
                  tap('place_item', 0.6);
                  placeFurniture(slot, id);
                  setTimeout(() => sceneRef.current?.celebrate(slot), 60);
                }}>
                  <div class="art"><img src={itemIcon(id)} alt="" loading="lazy" /></div>
                  <div class="nm">{ITEMS[id]?.name}</div>
                  {current === id ? <span class="owned"><IcoCheck size={20} /> Here</span> : inUse ? <span class="small muted">Elsewhere</span> : <span class="small muted">Place</span>}
                </button>
              );
            })}
          </div>
          {owned.length === 0 && <p class="muted center">Nothing that fits here yet. Find more in the Market or on adventures.</p>}
          <button class="btn soft" onClick={() => { tap('ui_back'); setSlot(null); }}>Choose another spot</button>
        </>
      ) : (
        <p class="muted center small">Golden rings mark the spots you can fill. Tap one, then pick a piece.</p>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------ map

export function MapPanel() {
  const s = save.value;
  const [sel, setSel] = useState(s.area);
  const a = AREAS.find((x) => x.id === sel)!;
  const isOpen = areaOpen(sel);
  const found = TRINKETS.filter((t) => t.area === sel && s.collection[t.id]).length, total = TRINKETS.filter((t) => t.area === sel).length;
  return (
    <Sheet title={<span class="row" style="gap:8px"><IcoMap size={40} />Where will Pip go tonight?</span>} onClose={() => { if (panel.value === 'map') panel.value = null; }}>
      <div class="map">
        <svg class="terrain" viewBox="0 0 100 105" preserveAspectRatio="none" aria-hidden="true">
          <defs><pattern id="hatch" width="2.5" height="2.5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="2.5" stroke="#6b8f4a" stroke-width=".5" opacity=".5" /></pattern></defs>
          <path d="M8 60 Q20 45 34 52 T58 62 Q66 78 50 86 T18 84 Q4 76 8 60Z" fill="#9cc47a" opacity=".55" />
          <path d="M8 60 Q20 45 34 52 T58 62 Q66 78 50 86 T18 84 Q4 76 8 60Z" fill="url(#hatch)" />
          <path d="M62 34 Q78 26 90 36 Q96 50 84 56 Q70 58 64 48Z" fill="#8fc0e8" opacity=".75" stroke="#4f8fd0" stroke-width=".4" />
          <path d="M4 26 L14 10 L20 20 L26 8 L36 26Z" fill="#c9c2d6" stroke="#6a6280" stroke-width=".5" />
          <path d="M14 10 L16 15 L12 15Z M26 8 L28 13 L24 13Z" fill="#fff" />
          <path d="M36 34 Q46 22 58 30 Q60 40 48 42 Q38 42 36 34Z" fill="#b8a6e0" opacity=".6" />
          <path d="M52 70 Q64 64 74 72 Q72 82 60 82Z" fill="#e0a6c8" opacity=".55" />
          <path d="M30 64 C40 60 50 66 62 72 S78 56 78 44 S56 30 46 30 S24 22 20 18" fill="none" stroke="#c0533f" stroke-width=".7" stroke-dasharray="1.6 1.6" />
          {[[12, 70], [22, 76], [16, 64], [40, 76], [30, 82], [46, 70]].map(([x, y]) => <path d={`M${x} ${y - 4}l2.4 4h-4.8z`} fill="#4f8a3c" />)}
          <text x="50" y="100" text-anchor="middle" font-size="3.4" font-family="Fraunces Variable, serif" fill="#6b4a2c" font-style="italic">The Land around Hoot Hollow</text>
        </svg>
        {AREAS.map((ar) => (
          <button class={'pinpt' + (sel === ar.id ? ' on' : '') + (areaOpen(ar.id) ? '' : ' locked')} style={{ left: `${ar.x * 100}%`, top: `${ar.y * 100}%` }} onClick={() => { tap('paper_flip', 0.4); setSel(ar.id); }}>
            <span class="flag">{!areaOpen(ar.id) && <IcoLock size={20} style="display:inline;vertical-align:-1px;margin-right:3px" />}{ar.name}</span><span class="stem" /><span class="dotp" />
          </button>
        ))}
      </div>
      <div class="card col">
        <div class="spread"><h3 style={{ color: a.color }}>{a.name}</h3><span class="label">{found}/{total} treasures</span></div>
        <p class="small muted">{a.blurb}</p>
        {isOpen ? (
          <button class={'btn ' + (s.area === sel ? 'soft' : 'pillow')} onClick={() => { tap('ui_confirm'); edit((x) => { x.area = sel; }); toast(`Tonight: ${a.name}`, IcoMap); }}>{s.area === sel ? 'Tonight’s destination' : 'Explore here tonight'}</button>
        ) : (
          <p class="small"><IcoLock size={20} style="display:inline;vertical-align:-2px" /> Opens at level {a.level}{a.streak ? ` with a ${a.streak}-night streak` : ''}.</p>
        )}
      </div>
    </Sheet>
  );
}

export const _k = { buy };
