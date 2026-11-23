// Dev preview of the pixel transitions (dev-book.html?trans=page&p=0.5&phase=in): a stand-in
// screen with one transition frame frozen over it. window.hhT drives it from screenshots:
//   hhT.show('clock', 'in', 0.6, { reverse: true })   hhT.flourish('levelup')
import { clearTransition, flourish, previewTransition, TRANSITION_KINDS, type TransitionKind } from '../ui/chrome/transition.ts';

const q = new URLSearchParams(location.search);
document.body.style.cssText = 'margin:0;background:#6f8a6a;font:16px sans-serif;overflow:hidden';
const root = document.getElementById('ui')!;
root.innerHTML = `<div style="position:fixed;inset:0;background:repeating-linear-gradient(45deg,#86a06a 0 24px,#a7b788 24px 48px)"></div>
<div style="position:fixed;left:8%;top:12%;width:84%;height:30%;background:#f4eedd;border:6px solid #6f553d"></div>
<div style="position:fixed;left:8%;bottom:8%;width:84%;height:18%;background:#9c7a56;border:6px solid #4a392b"></div>
<b id="lbl" style="position:fixed;left:8px;bottom:6px;z-index:99;color:#fff;background:#2e2b24;padding:2px 6px"></b>`;
const show = (kind: TransitionKind, phase: 'in' | 'out' = 'in', p = 0.5, o: Record<string, unknown> = {}) => {
  previewTransition(kind, phase, p, 0.6, o);
  document.getElementById('lbl')!.textContent = `${kind} ${phase} ${p}${o.reverse ? ' rev' : ''}`;
};
(window as unknown as { hhT: unknown }).hhT = { show, clear: clearTransition, flourish, kinds: TRANSITION_KINDS };
const k = q.get('trans') as TransitionKind;
if (k && k !== ('1' as TransitionKind)) show(k, (q.get('phase') as 'in' | 'out') ?? 'in', +(q.get('p') ?? 0.5), { reverse: q.has('rev') });
