// Pip in the 2D interface: always a render of the real 3D model (portraits.ts), re-sampled to art
// pixels with a hard alpha and a warm-ink outline so it sits inside the pixel-art UI. There are no
// 2D drawings of the owl anywhere. OWNED BY THE UI BUILDER (ui3).
import { useEffect, useState } from 'preact/hooks';
import { save } from '../game/store.ts';
import { owlIconAsync, type OwlShot } from './portraits.ts';

/**
 * Pip as a pixelated render: `n` art pixels across, shown `size` CSS px wide. [artpass] Without `n` he is drawn at the
 * game's own art pixel (as many art pixels as fit in `size`), each a whole number of device pixels, never smoothed;
 * `smooth`: the render itself, drawn smoothly (beside the realistic 3D objects, e.g. the alarm clock).
 */
export function PipPix(p: { n?: number; size?: number; shot?: OwlShot; class?: string; style?: string; label?: string; smooth?: boolean }) {
  const size = p.size ?? 120, n = p.n ?? size;
  const look = save.value.look, key = JSON.stringify(look);
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true;
    void owlIconAsync(look, p.shot ?? 'full').then((src) => src ?? '').then((u) => { if (live) setUrl(u); }).catch(() => { /* no WebGL */ });
    return () => { live = false; };
  }, [key, n, p.shot, p.smooth]);
  return (
    <span class={'pip-pix' + (p.class ? ' ' + p.class : '')} role={p.label ? 'img' : undefined} aria-label={p.label} aria-hidden={p.label ? undefined : 'true'}
      style={`display:inline-block;width:${size}px;height:${size}px;${p.style ?? ''}`}>
      {url && <img src={url} alt="" draggable={false} style={`width:100%;height:100%;display:block;object-fit:contain;image-rendering:auto`} />}
    </span>
  );
}
