// Pip's lines as 3D floating text: chunky pixel letters extruded with stacked layers, each popping
// in on a springy wave, bobbing and turning gently in 3D, with a soft glow, a drop shadow and a
// little voice blip per letter (pitched by the letter). Tap to finish a line, tap again to go on.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';

export interface Line { id: number; text: string; who?: string }

interface Ch { ch: string; em: boolean; i: number }
/** Split into words of letters; *stars* mark emphasised words. */
function parse(text: string): Ch[][] {
  const words: Ch[][] = [];
  let em = false, i = 0, cur: Ch[] = [];
  for (const c of text) {
    if (c === '*') { em = !em; continue; }
    if (c === ' ') { if (cur.length) words.push(cur); cur = []; i++; continue; }
    cur.push({ ch: c, em, i: i++ });
  }
  if (cur.length) words.push(cur);
  return words;
}
const plain = (text: string) => text.replace(/\*/g, '');
const VOICES = ['voice_a', 'voice_b', 'voice_c', 'voice_d', 'voice_e'];
/** extrusion layers (fewer on low-quality devices) */
const LAYERS = { high: [0, 1, 2, 3, 4, 5], low: [1, 3, 5] };

/** Delay before the next letter: a beat after punctuation. */
const pause = (c: string) => (c === '.' || c === '!' || c === '?' ? 210 : c === ',' || c === ':' ? 110 : 0);

export function FloatText(p: { line: Line | null; onTalk?: () => void; fast?: boolean; done?: (id: number) => void; finish?: number; low?: boolean }) {
  const line = p.line;
  const [shown, setShown] = useState(0);
  const [prev, setPrev] = useState<Line | null>(null);
  const last = useRef<Line | null>(null);
  const words = useMemo(() => (line ? parse(line.text) : []), [line?.id]);
  const total = line ? plain(line.text).length : 0;

  // the old line blows away while the new one pops in
  useEffect(() => {
    if (last.current && last.current.id !== line?.id) {
      setPrev(last.current);
      const id = window.setTimeout(() => setPrev(null), 520);
      last.current = line;
      return () => clearTimeout(id);
    }
    last.current = line;
    return undefined;
  }, [line?.id]);

  // type the letters out, a blip per letter
  useEffect(() => {
    if (!line) return;
    if (p.fast) { setShown(total); p.done?.(line.id); return; }
    setShown(0);
    let i = 0, timer = 0;
    const txt = plain(line.text);
    const step = () => {
      i++;
      setShown(i);
      const c = txt[i - 1] ?? '';
      if (/[a-z0-9]/i.test(c) && i % 2 === 1) {
        const code = c.toLowerCase().charCodeAt(0);
        sound.play(VOICES[code % VOICES.length], { volume: 0.16, rate: 1.3 + ((code * 7) % 13) / 34, gap: 34 });
      }
      if (i % 3 === 1) p.onTalk?.();
      if (i >= txt.length) { p.done?.(line.id); return; }
      timer = window.setTimeout(step, 30 + pause(c));
    };
    timer = window.setTimeout(step, 120);
    return () => clearTimeout(timer);
  }, [line?.id]);

  // the parent can ask to finish the line at once (a tap)
  useEffect(() => { if (line && p.finish && shown < total) { setShown(total); p.done?.(line.id); } }, [p.finish]);

  const complete = !!line && shown >= total;
  return (
    <div class="ft-wrap" aria-live="polite">
      {prev && <Words key={'p' + prev.id} words={parse(prev.text)} shown={1e9} out who={prev.who} layers={p.low ? LAYERS.low : LAYERS.high} />}
      {line && <Words key={line.id} words={words} shown={shown} who={line.who} layers={p.low ? LAYERS.low : LAYERS.high} />}
      {line && <span class="sr-only">{plain(line.text)}</span>}
      {complete && <i class="ft-next" key={'n' + line.id} />}
    </div>
  );
}

function Words(p: { words: Ch[][]; shown: number; out?: boolean; who?: string; layers: number[] }) {
  return (
    <div class={'ft-line' + (p.out ? ' out' : '')} aria-hidden="true">
      {p.who && <span class="ft-who"><b>{p.who}</b></span>}
      <div class="ft-text">
        {p.words.map((w, wi) => (
          <span class="ft-w" key={wi}>
            {w.map((c) => {
              const on = c.i < p.shown;
              return (
                <span class={'ft-c' + (on ? ' in' : '') + (c.em ? ' em' : '')} style={`--i:${c.i}`} key={c.i}>
                  <span class="ft-b">
                    <i class="ft-s">{c.ch}</i>
                    {p.layers.map((k) => <i class={'ft-d d' + k} key={k}>{c.ch}</i>)}
                    <i class="ft-o">{c.ch}</i>
                    <i class="ft-g">{c.ch}</i>
                    <b class="ft-f">{c.ch}</b>
                  </span>
                </span>
              );
            })}
          </span>
        ))}
      </div>
    </div>
  );
}
