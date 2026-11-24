// Pip's lines as 3D floating text: chunky pixel letters with a crisp stepped extrusion (hard text-shadows,
// no blur), a 2px ink outline and a two-tone face, set on a tilted plane in 3D. Each letter pops in on a
// springy wave with a voice blip (pitched by the letter), then bobs gently; the old line lifts away as the
// new one arrives. A translucent stepped slab sits behind the words so they read over any shot.
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

/** Delay before the next letter: a beat after punctuation. */
const pause = (c: string) => (c === '.' || c === '!' || c === '?' ? 210 : c === ',' || c === ':' ? 110 : 0);

export function FloatText(p: { line: Line | null; onTalk?: () => void; fast?: boolean; done?: (id: number) => void; finish?: number; low?: boolean }) {
  const line = p.line;
  const [shown, setShown] = useState(0);
  const [prev, setPrev] = useState<Line | null>(null);
  const last = useRef<Line | null>(null);
  const words = useMemo(() => (line ? parse(line.text) : []), [line?.id]);
  const total = line ? plain(line.text).length : 0;

  // the old line lifts away while the new one pops in
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
    <div class={'ft-wrap' + (p.low ? ' low' : '')} aria-live="polite">
      {prev && <Words key={'p' + prev.id} words={parse(prev.text)} shown={1e9} out who={prev.who} />}
      {line && <Words key={line.id} words={words} shown={shown} who={line.who} />}
      {line && <span class="sr-only">{plain(line.text)}</span>}
      {complete && <i class="ft-next" key={'n' + line.id} />}
    </div>
  );
}

function Words(p: { words: Ch[][]; shown: number; out?: boolean; who?: string }) {
  return (
    <div class={'ft-line' + (p.out ? ' out' : '')} aria-hidden="true">
      <i class="ft-slab" />
      {p.who && <span class="ft-who"><b>{p.who}</b></span>}
      <div class="ft-text">
        {p.words.map((w, wi) => (
          <span class="ft-w" key={wi}>
            {w.map((c) => (
              <span class={'ft-c' + (c.i < p.shown ? ' in' : '') + (c.em ? ' em' : '')} style={`--i:${c.i}`} key={c.i}>
                <span class="ft-b"><i class="ft-x">{c.ch}</i><b class="ft-f">{c.ch}</b></span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
