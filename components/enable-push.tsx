'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

type State = 'unsupported' | 'off' | 'on' | 'blocked' | 'working';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
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
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        // Re-send an existing subscription so the server always has it.
        if (sub) await api('/api/push', { body: sub.toJSON() });
        setState(sub ? 'on' : 'off');
      })
      .catch(() => setState('off'));
  }, []);

  async function enable() {
    setState('working');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await api('/api/push', { body: sub.toJSON() });
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
