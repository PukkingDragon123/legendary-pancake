// Hoot Hollow Bedtime: page bridge (content script, every http(s) page, document_start).
//
// Inert on every page except the Hoot Hollow app. A page counts as the app only while it carries
// <meta name="hoot-hollow-app" content="1"> AND posts same-origin messages shaped like
//   { source: 'hoot-hollow', type: 'hello' | 'config' | 'sleep', payload?, id? }
// Each one is relayed to the background worker and answered with
//   { source: 'hoot-hollow-ext', type: 'status', payload: BlockStatus, re?: id }
// After the first exchange the bridge also pushes `status` whenever the extension's state changes.
// Nothing about other pages is read, stored or sent anywhere.

(() => {
  if (globalThis.__hootHollowBridge) return; // injected twice (manifest + install-time injection)
  globalThis.__hootHollowBridge = true;

  const api = globalThis.browser ?? globalThis.chrome;
  const TYPES = new Set(['hello', 'config', 'sleep']);
  const isApp = () => !!document.querySelector('meta[name="hoot-hollow-app"][content="1"]');

  let pushing = false;
  let dead = false;

  function post(payload, re) {
    const msg = { source: 'hoot-hollow-ext', type: 'status', payload };
    if (re) msg.re = re;
    window.postMessage(msg, location.origin);
  }

  function startPushing() {
    if (pushing) return;
    pushing = true;
    api.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.status && changes.status.newValue && isApp()) post(changes.status.newValue);
    });
  }

  async function relay(type, payload, id) {
    if (dead) return;
    try {
      const res = await api.runtime.sendMessage({ kind: 'app', type, payload });
      if (res && res.status) {
        post(res.status, typeof id === 'string' ? id.slice(0, 64) : undefined);
        startPushing();
      }
    } catch (err) {
      // "Extension context invalidated": the extension was reloaded or removed; a page reload re-pairs.
      if (/context invalidated/i.test(String(err && err.message))) dead = true;
    }
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window || ev.origin !== location.origin) return;
    const d = ev.data;
    if (!d || typeof d !== 'object' || d.source !== 'hoot-hollow' || !TYPES.has(d.type)) return;
    if (!isApp()) return;
    relay(d.type, d.payload, d.id);
  });

  // If the app page already says who it is (static meta tag, or the bridge was injected after the
  // app loaded), introduce ourselves without waiting for a hello.
  const announce = () => {
    if (isApp()) relay('hello');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', announce, { once: true });
  else announce();
})();
