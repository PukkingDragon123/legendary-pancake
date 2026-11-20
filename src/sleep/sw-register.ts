// Service worker registration + small helpers for notification round-trips (see public/sw.js).

export interface SWNotificationMessage {
  type: 'hoot:notification';
  /** notification tag, e.g. "hoot-alarm" or "hoot-reminder-bedtime-<ts>" */
  tag: string;
  /** 'open' for a plain click, or the action id ('snooze' | 'dismiss' on alarm notifications) */
  action: string;
  data: unknown;
}

export const ALARM_TAG = 'hoot-alarm';

interface ActionNotificationOptions extends NotificationOptions {
  actions?: { action: string; title: string; icon?: string }[];
  vibrate?: number[];
  renotify?: boolean;
  timestamp?: number;
}

/**
 * Register /sw.js (relative to the Vite base). Skipped in dev unless the URL has ?sw=1, in insecure contexts and where
 * service workers are unavailable (e.g. sandboxed iframes); resolves null then.
 */
export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('sw') !== '1') return null;
  if (!window.isSecureContext) return null;
  try {
    const base = import.meta.env.BASE_URL || '/';
    return await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
  } catch (err) {
    console.warn('[sw] registration failed', err);
    return null;
  }
}

/** Activate a waiting service worker update (the page reloads on controllerchange if you ask it to). */
export function applySWUpdate(reg: ServiceWorkerRegistration, reload = true): void {
  if (!reg.waiting) return;
  if (reload) navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
}

/** Listen for notification clicks relayed by the service worker. Returns an unsubscribe function. */
export function onSWMessage(cb: (msg: SWNotificationMessage) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => undefined;
  const handler = (e: MessageEvent) => {
    const d = e.data as Partial<SWNotificationMessage> | null;
    if (d && d.type === 'hoot:notification' && typeof d.tag === 'string') cb({ type: d.type, tag: d.tag, action: d.action ?? 'open', data: d.data ?? null });
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

/**
 * If the app was opened by a notification click while closed, returns { tag, action } once and removes the query
 * parameters from the address bar.
 */
export function consumeLaunchAction(): { tag: string; action: string } | null {
  if (typeof location === 'undefined') return null;
  const url = new URL(location.href);
  const tag = url.searchParams.get('notification');
  if (!tag) return null;
  const action = url.searchParams.get('action') || 'open';
  url.searchParams.delete('notification');
  url.searchParams.delete('action');
  try {
    history.replaceState(history.state, '', url.href);
  } catch {
    /* ignore */
  }
  return { tag, action };
}

/**
 * Show the ringing-alarm notification (with Snooze / Dismiss actions where supported) — useful when the alarm rings
 * while the page is hidden. Returns false when notifications are unavailable or not permitted.
 */
export async function showAlarmNotification(opts: { title?: string; body?: string; icon?: string; snoozeMin?: number } = {}): Promise<boolean> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  const title = opts.title ?? 'Good morning from Hoot Hollow';
  const options: ActionNotificationOptions = {
    body: opts.body ?? 'Time to wake up! The owl is back from its night adventure.',
    tag: ALARM_TAG,
    renotify: true,
    requireInteraction: true,
    icon: opts.icon,
    badge: opts.icon,
    vibrate: [400, 200, 400, 200, 400],
    data: { type: 'alarm' },
    timestamp: Date.now(),
    actions: [
      { action: 'snooze', title: `Snooze ${opts.snoozeMin ?? 9} min` },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
    const { actions: _drop, ...plain } = options; // page notifications cannot have actions
    new Notification(title, plain);
    return true;
  } catch (err) {
    console.warn('[sw] alarm notification failed', err);
    return false;
  }
}

/** Close the alarm notification (after the alarm is dismissed in-app). */
export async function closeAlarmNotification(): Promise<void> {
  try {
    const reg = typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    (await reg?.getNotifications({ tag: ALARM_TAG }))?.forEach((n) => n.close());
  } catch {
    /* ignore */
  }
}
