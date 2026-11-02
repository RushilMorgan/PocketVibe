'use client';

import { useEffect, useState } from 'react';
import { api } from './api';
import { subscribedWithKey, urlBase64ToUint8Array } from './push-key';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

type State = 'unsupported' | 'off' | 'on' | 'blocked' | 'working';

async function subscribe(reg: ServiceWorkerRegistration): Promise<void> {
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  await api('/api/push', { body: sub.toJSON() });
}

/** "Notify me when it's ready" toggle. Hidden once on, or where push can't work. */
export function EnablePush() {
  const [state, setState] = useState<State>('working');

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('blocked');
      return;
    }
    (async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub && subscribedWithKey(sub.options.applicationServerKey, VAPID_PUBLIC_KEY)) {
        // Re-send so the server always has it (e.g. after signing in again).
        await api('/api/push', { body: sub.toJSON() });
        setState('on');
        return;
      }
      // A subscription made with another key (an older site/key) can never
      // receive our pushes: replace it. Permission is already granted, so
      // re-subscribing doesn't prompt.
      if (sub) await sub.unsubscribe();
      if (sub && Notification.permission === 'granted') {
        await subscribe(reg);
        setState('on');
        return;
      }
      setState('off');
    })().catch(() => setState('off'));
  }, []);

  async function enable() {
    setState('working');
    try {
      await subscribe(await navigator.serviceWorker.ready);
      setState('on');
    } catch {
      setState(Notification.permission === 'denied' ? 'blocked' : 'off');
    }
  }

  if (state === 'off') {
    return (
      <button onClick={enable} className="mt-4 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        🔔 Notify me when an explainer is ready
      </button>
    );
  }
  if (state === 'blocked') {
    return <p className="mt-4 text-sm text-muted">Notifications are blocked for this site in your browser settings.</p>;
  }
  return null;
}
