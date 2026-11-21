// Panels opened from the home screen: the wardrobe (try outfits and coats live), decorating the
// tree house (tap a glowing spot, pick a piece), and the globe of places Pip can explore.
import { useEffect, useState } from 'preact/hooks';
import { ZONE_LEVEL, ZONE_NAME } from '../game/catalog.ts'; // [globe] AREAS/TRINKETS moved to the globe
import { buy, level, placeFurniture, save, zones } from '../game/store.ts'; // [globe]
import { ITEMS } from '../world/scene.ts';
import { IcoBrush, IcoCheck, IcoClose, IcoLock } from './icons.tsx'; // [globe]
import { Sheet, Tags, tap } from './kit.tsx'; // [globe]
import { itemIcon } from './portraits.ts';
import { panel, sceneRef } from './state.ts';

// ------------------------------------------------------------------ wardrobe

// [owl] the dressing room lives in its own module (species, skins and outfit drawers)
export { Wardrobe } from './wardrobe.tsx';

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

// [globe] the map is now the globe of twenty real places (src/ui/globe/globe.tsx)
export { GlobePanel as MapPanel } from './globe/globe.tsx';

export const _k = { buy };
