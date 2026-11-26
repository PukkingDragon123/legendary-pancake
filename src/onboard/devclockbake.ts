// dev-clockbake.html: bake the loading clock's layers (clockbake.ts) and show them; window.__bake() for the tools script.
import { bake } from './clockbake.ts';

const W = window as unknown as { __bake: typeof bake; __done?: boolean };
W.__bake = bake;
if (!new URLSearchParams(location.search).has('quiet')) {
  void bake().then((r) => {
    const out = document.getElementById('out')!;
    for (const c of r.preview) { c.style.cssText = 'max-width:100%;margin:6px;border:1px solid #0004;vertical-align:top'; out.append(c); }
    W.__done = true;
  });
}
