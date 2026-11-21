// A tiny queue for the diary's pictures (renders of furniture and outfits): one job per frame, so
// opening a page full of thumbnails never stalls a page turn. Results are cached by key.
import { useEffect, useState } from 'preact/hooks';

const jobs: (() => void)[] = [];
let running = false;
function pump() {
  if (running) return;
  running = true;
  const step = () => {
    const t0 = performance.now();
    while (jobs.length && performance.now() - t0 < 12) { try { jobs.shift()!(); } catch (e) { console.warn('diary thumb', e); } }
    if (jobs.length) setTimeout(step, 16); else running = false;
  };
  setTimeout(step, 0);
}
const done = new Map<string, string>();
/** A data URL made by `make()` later (one job per frame), cached by key: undefined while pending, '' if it failed. */
export function useLazy(key: string, make: () => string | Promise<string>): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => done.get(key));
  useEffect(() => {
    const have = done.get(key);
    if (have !== undefined) { setUrl(have); return; }
    let live = true;
    setUrl(undefined);
    jobs.push(() => {
      const fin = (u: string) => { done.set(key, u); if (live) setUrl(u); };
      let r: string | Promise<string>;
      try { r = make(); } catch (e) { console.warn('diary picture', key, e); fin(''); return; }
      if (typeof r === 'string') fin(r); else void r.then(fin, () => fin(''));
    });
    pump();
    return () => { live = false; };
  }, [key]);
  return url;
}
