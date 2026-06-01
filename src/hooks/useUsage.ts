import { useSyncExternalStore } from 'react';
import { subscribe, getUsage, type UsageState } from '../lib/usageStore';

/**
 * Subscribe to the client-side usage cache. Returns the latest per-kind
 * remaining/limit figures the server has reported this session. Display-only.
 */
export function useUsage(): UsageState {
  return useSyncExternalStore(subscribe, getUsage, getUsage);
}
