'use client';

import { useEffect } from 'react';
import { api } from './api';

const CHECKED_KEY = 'heytoolie:tz-checked';

/**
 * Keeps users.timezone matching this device's zone, so reminders, the streak's
 * "today" and the week are local (lib/time.ts). Checks once per browser session
 * and only writes when it changed — e.g. after travelling.
 */
export function TimezoneSync() {
  useEffect(() => {
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!zone || sessionStorage.getItem(CHECKED_KEY) === zone) return;
    } catch {
      return;
    }
    api<{ user: { timezone?: string } }>('/api/me')
      .then(async ({ user }) => {
        if (user.timezone !== zone) await api('/api/me', { method: 'PATCH', body: { timezone: zone } });
        try {
          sessionStorage.setItem(CHECKED_KEY, zone);
        } catch {}
      })
      .catch(() => {});
  }, []);
  return null;
}
