// [tutor] Pip's words written on paper: the same markup and the same typing rhythm as his floating words
// (ui/talk.ts: *highlight*, _whisper_, ~sing-song~, !shout!), but in dark ink on the card. Every letter is laid out
// from the start (the card never jumps while it types) and fades in at its beat; his voice blips on each syllable.
// A tap finishes the line at once.
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { pace, parse, plainOf, VOICES, type Beat } from '../talk.ts';

const VOWEL_PITCH: Record<string, number> = { a: 0, e: 0.06, i: 0.11, o: -0.05, u: -0.08, y: 0.04 };
const jit = (i: number) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1;
function blip(b: Beat, i: number) {
  const v = VOICES.pip, k = b.c.toLowerCase();
  const rate = v.rate * (1 + (VOWEL_PITCH[k] ?? 0) + b.pitch + (jit(i) - 0.5) * 0.08) * (b.tone === 'yell' ? 1.12 : b.tone === 'hush' ? 0.94 : b.tone === 'hi' ? 1.04 : 1);
  const vol = v.vol * (b.tone === 'yell' ? 1.9 : b.tone === 'hi' ? 1.3 : b.tone === 'hush' ? 0.42 : 1) * (0.85 + jit(i + 9) * 0.3);
  try { sound.play(v.clips[(k.charCodeAt(0) + i) % v.clips.length], { volume: vol, rate, gap: 52 }); } catch { /* no audio */ }
}

/** dev: a time scale for slow headless screenshots (window.hhTalk.k, shared with the floating words) */
const timeK = () => ((window as unknown as { hhTalk?: { k?: number } }).hhTalk?.k ?? 1);

export function InkText(p: { text: string; id: string; done: boolean; /** start typing (the letters wait, laid out, until then) */ run: boolean; onDone?: () => void; onBlip?: () => void }) {
  const beats = useMemo(() => pace(parse(p.text)).beats, [p.text]);
  const end = beats.length ? beats[beats.length - 1].at + 0.05 : 0;
  const cb = useRef(p);
  cb.current = p;
  const k = timeK();
  // the voice, in step with the letters
  useEffect(() => {
    if (p.done || !p.run) return undefined;
    let raf = 0, n = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const t = (now - t0) / 1000 / k;
      while (n < beats.length && beats[n].at <= t) { if (beats[n].blip) { blip(beats[n], n); cb.current.onBlip?.(); } n++; }
      if (t >= end) { cb.current.onDone?.(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [p.id, p.done, p.run]);
  // words keep together; each letter waits for its beat
  const words: Beat[][] = [];
  let cur: Beat[] | null = null;
  for (const b of beats) {
    if (b.c === ' ') { cur = null; words.push([b]); continue; }
    if (!cur) { cur = []; words.push(cur); }
    cur.push(b);
  }
  let i = 0;
  return (
    <p class={'tt-ink' + (p.done ? ' done' : p.run ? '' : ' wait')} key={p.id} aria-label={plainOf(p.text)}>
      {words.map((w, wi) => (w.length === 1 && w[0].c === ' ' ? (i++, ' ') : (
        <span class="tt-w" key={wi} aria-hidden="true">
          {w.map((b) => { const j = i++; return <span key={j} class={'tt-c ' + b.tone + (b.lead ? ' lead' : '')} style={{ animationDelay: `${(b.at * k).toFixed(3)}s`, '--j': j % 7 } as Record<string, string | number>}>{b.c}</span>; })}
        </span>
      )))}
    </p>
  );
}
