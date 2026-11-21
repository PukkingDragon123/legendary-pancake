// OWNED BY THE UI-CHROME BUILDER: the HUD (name, level bar, currencies), the three big main buttons
// (Sleep, Clock, Book) and the side tools (Build, Shop, Wardrobe, Quests, Map, Settings).
// This first version is a plain placeholder; it will be replaced by hanging wooden signs, a magic
// level bar and animated pixel icons.
import { phase } from '../../game/night.ts';
import { claimable } from '../../game/quests.ts';
import { level, save } from '../../game/store.ts';
import { IcoAcorn, IcoStone, Px } from '../icons.tsx';
import { Rolling, tap } from '../kit.tsx';
import { breathing, panel, type Panel } from '../state.ts';

const hidden = () => phase.value !== 'day' || !!breathing.value || !save.value.onboarded;

export function Hud() {
  const s = save.value, lv = level.value;
  const away = hidden() || (panel.value !== null && panel.value !== 'shop');
  return (
    <div class={'hud-top' + (away ? ' away' : '')}>
      <button class="profile" onClick={() => { tap(); panel.value = 'wardrobe'; }} aria-label={`${s.name}, level ${lv.level}`}>
        <span style="text-align:left">
          <span class="name">{s.name}<span class="lvtag">Lv {lv.level}</span></span>
          <span class="lvbar" style="display:block"><i style={{ width: `${Math.max(8, Math.round((lv.into / lv.need) * 100))}%` }} /></span>
        </span>
      </button>
      <div class="chips">
        <button class="chip" data-chip="coin" onClick={() => { tap(); panel.value = 'shop'; }} aria-label="Owl coins"><IcoAcorn size={40} /><Rolling value={s.coins} /></button>
        <button class="chip" data-chip="gem" onClick={() => { tap(); panel.value = 'shop'; }} aria-label="Moon gems"><IcoStone size={40} /><Rolling value={s.gems} /></button>
      </div>
    </div>
  );
}

const TOOLS: { id: Panel; label: string; sprite: string }[] = [
  { id: 'build', label: 'Build', sprite: 'hammer' }, { id: 'shop', label: 'Shop', sprite: 'shop' },
  { id: 'wardrobe', label: 'Dress up', sprite: 'hanger' }, { id: 'quests', label: 'Quests', sprite: 'clipboard' },
  { id: 'map', label: 'Map', sprite: 'map' }, { id: 'settings', label: 'Settings', sprite: 'gear' },
];
export function SideTools() {
  const away = hidden() || !!panel.value;
  const ready = claimable();
  return (
    <div class={'tools' + (away ? ' away' : '')}>
      {TOOLS.map((t) => (
        <div class="tool">
          <button class="icon-btn" aria-label={t.label} onClick={() => { tap('ui_open', 0.5); panel.value = t.id; }}><Px name={t.sprite} size={30} />{t.id === 'quests' && ready > 0 && <span class="badge-dot" />}</button>
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

const MAIN: { id: Panel; label: string; sprite: string }[] = [
  { id: 'sleep', label: 'Sleep', sprite: 'moon' }, { id: 'clock', label: 'Clock', sprite: 'alarm' }, { id: 'book', label: 'Book', sprite: 'book' },
];
export function MainNav() {
  const away = hidden() || !!panel.value;
  return (
    <nav class={'dock' + (away ? ' away' : '')} aria-label="Main">
      <div class="dock-in" style="grid-template-columns:repeat(3,1fr)">
        {MAIN.map((m) => (
          <button class="dock-item" onClick={() => { tap('ui_tab', 0.55); panel.value = m.id; }}><Px name={m.sprite} size={40} /><span>{m.label}</span></button>
        ))}
      </div>
    </nav>
  );
}
