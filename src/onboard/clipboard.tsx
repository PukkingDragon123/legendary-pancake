// Shared bits of the interview clipboard: the tap sound, pencil handwriting (the text is revealed stroke by
// stroke while a pixel pencil scribbles along), plan rows, and the APPROVED ink the rubber stamp leaves.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { haptic } from '../ui/kit.tsx';
import { uiBurstAt } from '../ui/chrome/uifx.ts';
import { pencilURL } from './cbart.ts';
import { iconSize, iconURL } from './obicons.ts';

export const tapSound = (id = 'ui_tap', v = 0.5) => { sound.play(id, { volume: v, gap: 40 }); haptic(); };

/** Pencil handwriting: the text appears letter by letter while a pencil scribbles along. */
export function Hand(p: { text: string; delay?: number; speed?: number; onDone?: () => void; class?: string; fast?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState(0);
  const n = Math.max(1, [...p.text].length);
  const dur = p.fast ? 1 : Math.round(Math.min(2200, Math.max(380, n * 55)) / (p.speed ?? 1));
  const delay = p.fast ? 0 : p.delay ?? 0;
  useLayoutEffect(() => { setW(ref.current?.offsetWidth ?? 0); }, [p.text]);
  useEffect(() => {
    const a = window.setTimeout(() => { if (!p.fast) sound.play('pencil', { volume: 0.45, gap: 120 }); }, delay);
    const b = window.setTimeout(() => p.onDone?.(), delay + dur + 120);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [p.text]);
  return (
    <span class={'hw ' + (p.class ?? '')} style={`--hn:${n};--hd:${delay}ms;--hdur:${dur}ms;--hw:${w}px`}>
      <span ref={ref} class="hw-t">{p.text}</span>
      {!p.fast && <img class="hw-pencil" src={pencilURL()} alt="" draggable={false} />}
    </span>
  );
}

/** One line of the plan: a pixel icon, a label, dot leaders and a pencilled value. */
export function Row(p: { icon: string; label: string; children: ComponentChildren }) {
  const s = iconSize(p.icon);
  return (
    <div class="obc-row">
      <img class="pxi" src={iconURL(p.icon)} width={s.w} height={s.h} alt="" />
      <span class="obc-row-l">{p.label}</span><i class="obc-dots" /><span class="obc-row-v">{p.children}</span>
    </div>
  );
}

/** The APPROVED ink, slammed onto the plan by the rubber stamp. */
export function StampInk(p: { onHit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      sound.play('stamp', { volume: 0.8 });
      haptic(30);
      uiBurstAt(ref.current, 'puff', 12);
      uiBurstAt(ref.current, 'stars', 10);
      document.querySelector('.obc')?.classList.add('thud');
      p.onHit();
    }, 120);
    return () => clearTimeout(id);
  }, []);
  return (
    <div class="obc-stamp" ref={ref}>
      <span class="obc-ink"><b>APPROVED</b><small>by the Hollow's sleep keeper</small></span>
    </div>
  );
}
