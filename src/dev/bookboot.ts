// Dev preview of the loading clock and its handoff without the 3D app (dev-book.html?boot=1):
// copies the #boot block out of index.html over a stand-in scene, then plays main.tsx's part.
//   &hold          a new player: the clock strikes and waits for a tap
//   &after=2500    ms before the app is "ready"
//   &bootdive=open:0.5 | dive:0.4   freeze the handoff (see src/onboard/boot.ts)
export {};
const q = new URLSearchParams(location.search);
document.body.style.cssText = 'margin:0;overflow:hidden';
const root = document.getElementById('ui')!;
root.innerHTML = `<div style="position:fixed;inset:0;background:linear-gradient(#aec8cc,#d3e0dc 55%,#86a06a 55%,#557343)"></div>
<div style="position:fixed;left:30%;top:38%;width:40%;height:24%;background:#9c7a56;border:8px solid #4a392b"></div>`;
const html = await (await fetch('/index.html')).text();
const a = html.indexOf('<!-- boot:begin'), z = html.indexOf('<!-- boot:end -->');
const box = document.createElement('div');
box.innerHTML = html.slice(a, z);
document.body.append(...Array.from(box.childNodes));
const b = document.getElementById('boot')!;
if (q.has('hold')) b.classList.add('hold');
const boot = await import('../onboard/boot.ts');
setTimeout(() => b.classList.add('gone'), +(q.get('after') ?? 2500));
if (q.has('hold')) void boot.bootReady().then(() => boot.wakeBoot());
