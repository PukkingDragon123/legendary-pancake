// The floating words (ui/talk.ts) as a Preact piece, for speakers in the game's scenes: Pip's lines at home, Barnaby
// in his store, the morning's narration. The words hang from the bottom (over a speaker's head) or the top of their
// box, type on with the speaker's voice, and drift away when the line is cleared; `onIdle` says when they are gone.
// A tap on the words finishes a line that is still typing, a second tap moves on (`onNext`).
import type { Ref } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { TalkView, type TalkOpts } from './talk.ts';

let cssDone = false;
function installCSS() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const st = document.createElement('style');
  st.id = 'hh-talk';
  // the old paper bubbles step aside: the words float on their own now
  st.textContent = `
.hh-talk { position: relative; display: block; line-height: 0; }
.hh-talk.tap { pointer-events: auto; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.hh-bubble.hh-float, .lg-bubble.hh-float { padding: 0 !important; max-width: none !important; border: 0 !important; border-image: none !important; background: none !important; filter: none !important; box-shadow: none !important; animation: none !important; }
.hh-bubble.hh-float::after, .hh-bubble.hh-float::before, .lg-bubble.hh-float::after, .lg-bubble.hh-float::before { display: none !important; }
.hh-bubble.hh-float { transform: translate(-50%, -100%); pointer-events: none; }
.hh-cap { display: flex; justify-content: center; padding: 0 !important; text-shadow: none !important; pointer-events: none; }
`;
  document.head.appendChild(st);
}

export interface TalkTextProps {
  /** the line (null: the words drift away) and a key that changes with every new line */
  text: string | null;
  id?: number | string;
  who?: string;
  opts: TalkOpts;
  /** a tap on the finished line (the typing one is finished by the first tap) */
  onNext?: () => void;
  onDone?: () => void;
  onBlip?: () => void;
  /** nothing left on screen */
  onIdle?: () => void;
  /** the view, for hosts that move it (drift) */
  viewRef?: Ref<TalkView | null>;
  class?: string;
}

export function TalkText(p: TalkTextProps) {
  installCSS();
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<TalkView | null>(null);
  const cb = useRef(p);
  cb.current = p;
  useEffect(() => {
    const v = new TalkView(p.opts);
    view.current = v;
    if (p.viewRef) (p.viewRef as { current: TalkView | null }).current = v;
    box.current?.appendChild(v.canvas);
    v.onDone = () => cb.current.onDone?.();
    v.onBlip = () => cb.current.onBlip?.();
    let raf = 0, last = performance.now(), wasIdle = true;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      if (v.idle) { if (!wasIdle) { wasIdle = true; v.step(dt); cb.current.onIdle?.(); } return; }
      wasIdle = false;
      v.step(dt);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); v.dispose(); view.current = null; if (p.viewRef) (p.viewRef as { current: TalkView | null }).current = null; };
  }, []);
  useEffect(() => { view.current?.set(p.opts); }, [p.opts.size, p.opts.maxWidth]);
  useEffect(() => { view.current?.say(p.text, { who: p.who }); }, [p.id, p.text]);
  const tap = (e: Event) => {
    const v = view.current;
    if (!v || v.idle) return;
    e.stopPropagation();
    if (v.typing) v.finish(); else cb.current.onNext?.();
  };
  return <div ref={box} class={'hh-talk' + (p.onNext ? ' tap' : '') + (p.class ? ' ' + p.class : '')} onPointerDown={p.onNext ? tap : undefined} />;
}
