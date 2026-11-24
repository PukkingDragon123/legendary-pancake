// Pip in the 2D interface: always a render of the real 3D model (portraits.ts), re-sampled to art
// pixels with a hard alpha and a warm-ink outline so it sits inside the pixel-art UI. There are no
// 2D drawings of the owl anywhere. OWNED BY THE UI BUILDER (ui3).
import { useEffect, useState } from 'preact/hooks';
import { save } from '../game/store.ts';
import { owlIconAsync, type OwlShot } from './portraits.ts';
import { pixelate } from './pxfx.tsx';

/** Pip as a pixelated render: `n` art pixels across, shown `size` CSS px wide. */
export function PipPix(p: { n?: number; size?: number; shot?: OwlShot; class?: string; style?: string; label?: string }) {
  const look = save.value.look, key = JSON.stringify(look), n = p.n ?? 40, size = p.size ?? n * 3;
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true;
    void owlIconAsync(look, p.shot ?? 'full').then((src) => (src ? pixelate(src, n) : '')).then((u) => { if (live) setUrl(u); }).catch(() => { /* no WebGL */ });
    return () => { live = false; };
  }, [key, n, p.shot]);
  return (
    <span class={'pip-pix' + (p.class ? ' ' + p.class : '')} role={p.label ? 'img' : undefined} aria-label={p.label} aria-hidden={p.label ? undefined : 'true'}
      style={`display:inline-block;width:${size}px;height:${size}px;${p.style ?? ''}`}>
      {url && <img src={url} alt="" draggable={false} style="width:100%;height:100%;image-rendering:pixelated;display:block" />}
    </span>
  );
}
