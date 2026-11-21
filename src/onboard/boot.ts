// Glue between the HTML/CSS loading screen (#boot in index.html) and the interview. For a new
// player the splash is held after the app is ready (`hold`; main.tsx still adds `gone` as usual),
// shows "tap to wake Pip", and on tap Pip peeks one eye open and the camera dives into him, which
// hands over to the 3D office where he finishes waking up.
import { sound } from '../audio/sound.ts';

const el = () => document.getElementById('boot');

/** Keep the splash up after main.tsx marks it gone (until the interview takes over). */
export function holdBoot() { el()?.classList.add('hold'); }
export const bootShowing = () => { const b = el(); return !!b && (!b.classList.contains('gone') || b.classList.contains('hold')) && !b.classList.contains('zoom'); };

/** Show "tap to wake Pip"; resolves on the first tap (or at once when there is no splash). */
export function bootReady(): Promise<void> {
  const b = el();
  if (!b || !bootShowing()) return Promise.resolve();
  b.classList.add('ready');
  return new Promise((res) => {
    const go = (e: Event) => {
      e.preventDefault();
      b.removeEventListener('pointerdown', go);
      b.removeEventListener('keydown', go);
      removeEventListener('keydown', go);
      sound.unlock();
      res();
    };
    b.addEventListener('pointerdown', go);
    addEventListener('keydown', go);
  });
}

/** Pip stirs, then the splash zooms into him and fades away. */
export async function wakeBoot(): Promise<void> {
  const b = el();
  if (!b) return;
  b.classList.add('wake');
  sound.play('owl_hoot', { volume: 0.35, rate: 1.15 });
  await new Promise((r) => setTimeout(r, 520));
  b.classList.add('zoom');
  sound.play('tp_shimmer', { volume: 0.3 });
  await new Promise((r) => setTimeout(r, 1250));
  releaseBoot();
}

/** Let go of the splash for good. */
export function releaseBoot() {
  const b = el();
  if (!b) return;
  b.classList.add('gone');
  b.classList.remove('hold');
  window.setTimeout(() => { b.style.display = 'none'; }, 1600);
}
