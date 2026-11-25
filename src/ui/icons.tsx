// Icons are pixel-art sprites from The Bear Must Eat's sprite kit (ui/px/sprites.js), plus Hoot
// Hollow's own drawn in the same kit (ui/px/hollow.js). Each is shown at a whole-number scale so
// every art pixel lands on whole screen pixels.
import type { JSX } from 'preact';
import { SPRITES, spriteURL } from './px/sprites.js';
import { iconFit } from './chrome/iconset.ts';
import './px/hollow.js';
import './px/currency.js';

type P = { size?: number; class?: string; style?: string };

const dpr = () => Math.min(4, Math.max(1, Math.round((typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1)));

/** A pixel sprite at roughly `size` CSS px tall, snapped so art pixels stay square and crisp. */
export function Px(p: { name: string; size?: number; class?: string; style?: string; alt?: string }) {
  const sp = (SPRITES as Record<string, { w: number; h: number; i3d?: unknown }>)[p.name];
  const w0 = sp?.w ?? 20, h0 = sp?.h ?? 20;
  const want = p.size ?? 30;
  const k = dpr();
  // [icons8] the pixel-art icon family: one of its two drawings at a whole number of device pixels per art pixel,
  // as near the asked size as that allows (crisp, never blurred)
  if (sp?.i3d) {
    const f = iconFit(p.name, want, k), css = f?.css ?? want;
    return <img class={'px ico ' + (p.class ?? '')} style={p.style} src={f?.src ?? ''} width={css} height={css} alt={p.alt ?? ''} draggable={false} />;
  }
  // css px per art px, a multiple of 1/dpr so it maps to whole device pixels
  const per = Math.max(1 / k, Math.round((want / Math.max(w0, h0)) * k) / k);
  const devScale = Math.max(1, Math.round(per * k));
  return <img class={'px ico ' + (p.class ?? '')} style={p.style} src={spriteURL(p.name, devScale)} width={Math.round(w0 * per)} height={Math.round(h0 * per)} alt={p.alt ?? ''} draggable={false} />;
}

const mk = (name: string) => (p: P): JSX.Element => <Px name={name} size={p.size} class={p.class} style={p.style} />;

/** Kept for compatibility: pixel icons need no shared SVG defs. */
export function IconDefs() { return null; }

export const IcoHouse = mk('treehouse');
export const IcoClock = mk('alarm');
export const IcoJar = mk('jar');
export const IcoJournal = mk('book');
export const IcoSatchel = mk('satchel');
export const IcoAcorn = mk('acorn');
export const IcoStone = mk('moonstone');
export const IcoCandle = mk('candle');
export const IcoStar = mk('star');
export const IcoBrush = mk('brush');
export const IcoHanger = mk('hanger');
export const IcoMap = mk('map');
export const IcoGear = mk('gear');
export const IcoMic = mk('mic');
export const IcoBell = mk('bell');
export const IcoMoon = mk('moon');
export const IcoSun = mk('sun');
export const IcoRain = mk('rain');
export const IcoWaves = mk('waves');
export const IcoWind = mk('wind');
export const IcoFire = mk('campfire');
export const IcoLeaf = mk('leaf');
export const IcoStream = mk('drop');
export const IcoMute = mk('speaker_off');
export const IcoNote = mk('music');
export const IcoShield = mk('shield');
export const IcoPhoneOff = mk('phone_off');
export const IcoPlay = mk('play');
export const IcoPause = mk('pause');
export const IcoCheck = mk('check');
export const IcoClose = mk('cross');
export const IcoBack = mk('arrow_left');
export const IcoPlus = mk('plus');
export const IcoMinus = mk('minus');
export const IcoLock = mk('lock');
export const IcoSparkle = mk('sparkle');
export const IcoPaw = mk('heart');
export const IcoBed = mk('nest');
export const IcoInfo = mk('info');
export const IcoRefresh = mk('rotate_right');
export const IcoBreath = mk('lantern');
export const IcoOwl = mk('owl');
export const IcoZzz = mk('zzz');
export const IcoHeart = mk('heart');
export const IcoCalendar = mk('calendar');

export const SOUNDSCAPE_ICON: Record<string, (p: P) => JSX.Element> = {
  none: IcoMute, amb_rain: IcoRain, amb_waves: IcoWaves, amb_brown: IcoWind, amb_forest_night: IcoLeaf, amb_fire: IcoFire, amb_stream: IcoStream, music_lullaby: IcoNote,
};
