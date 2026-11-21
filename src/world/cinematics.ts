// OWNED BY THE WORLD BUILDER. Cinematic moments in the forest: Pip packing up and flying off on
// the night's adventure, and coming home at dawn with presents. They drive the camera through
// scene.director and the owl through scene.owl. Simple stand-ins until the world builder lands.
import type { Scene } from './scene.ts';

export interface CineOpts { onDone?: () => void }
/** Goodnight: Pip packs the satchel, waves, and flies off across the night sky. */
export function playDeparture(scene: Scene, o: CineOpts = {}): () => void {
  scene.setView('sleep');
  scene.leave(() => o.onDone?.());
  return () => { /* cancel */ };
}
/** Good morning: Pip flies home at dawn with a bundle of presents and lands on the porch. */
export function playArrival(scene: Scene, o: CineOpts & { onLanded?: () => void } = {}): () => void {
  scene.setView('wake');
  scene.arrive(() => { o.onLanded?.(); o.onDone?.(); });
  return () => { /* cancel */ };
}
