// OWNED BY THE SLEEP/CLOCK/BOOK BUILDER: the big cuckoo clock (sleep totals, weekly routine on a
// clipboard calendar, tweakable bed and wake times). Placeholder for now.
import { Sheet } from './kit.tsx';
import { panel } from './state.ts';
export function ClockScreen() {
  return <Sheet title="Clock" sub="Coming together..." onClose={() => { if (panel.value === 'clock') panel.value = null; }}><p class="muted">The cuckoo clock is being built.</p></Sheet>;
}
