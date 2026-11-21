// A pixel iris wipe: the screen closes to a circle around a point (Pip's face), stays dark while
// `mid` swaps the scene, then opens again. Lives on document.body so it survives the interview
// component unmounting halfway through.
const K = 4; // css px per iris pixel

export function iris(at: () => { x: number; y: number }, mid: () => void | Promise<void>, o: { close?: number; open?: number; hold?: number } = {}): Promise<void> {
  const cv = document.createElement('canvas');
  cv.className = 'ob-iris';
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '120', pointerEvents: 'auto', imageRendering: 'pixelated' });
  document.body.appendChild(cv);
  const W = Math.ceil(innerWidth / K), H = Math.ceil(innerHeight / K);
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const maxR = Math.hypot(W, H);
  const draw = (cx: number, cy: number, r: number) => {
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0b0714'; g.fillRect(0, 0, W, H);
    if (r <= 0.5) return;
    // a gold rim, then cut the hole (aliased at iris resolution, so it reads as pixels)
    g.fillStyle = '#ffd86a';
    g.beginPath(); g.arc(cx, cy, r + 1, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  };
  const anim = (ms: number, f: (k: number) => void) => new Promise<void>((res) => {
    const t0 = performance.now();
    const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); f(k); if (k < 1) requestAnimationFrame(step); else res(); };
    step();
  });
  const ease = (k: number) => k * k * (3 - 2 * k);
  return (async () => {
    await anim(o.close ?? 900, (k) => { const p = at(); draw(p.x / K, p.y / K, Math.round(maxR * (1 - ease(k)))); });
    await new Promise((r) => setTimeout(r, o.hold ?? 220));
    await mid();
    await new Promise((r) => setTimeout(r, 120));
    await anim(o.open ?? 1000, (k) => draw(W / 2, H * 0.46, Math.round(maxR * ease(k))));
    cv.remove();
  })();
}
