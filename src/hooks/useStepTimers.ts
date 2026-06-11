import { useEffect, useRef, useState, useCallback } from 'react';
import { unlockChime, timerDoneAlert } from '../lib/timerChime';

interface RunningTimer {
  endsAt: number;
  total: number;
}

export type TimerPhase = 'idle' | 'running' | 'done';

/**
 * Per-step countdown timers for cooking. Several can run in parallel (pasta
 * boiling while the sauce simmers). When one runs out it moves to 'done' —
 * with a chime + vibration — and stays there until dismissed, so the UI can
 * nudge the cook even if they look at the screen a minute later.
 */
export function useStepTimers(onFinish?: (id: string) => void) {
  const [running, setRunning] = useState<Record<string, RunningTimer>>({});
  const [finished, setFinished] = useState<Record<string, true>>({});
  const [now, setNow] = useState(() => Date.now());
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    if (Object.keys(running).length === 0) return;
    const interval = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const expired = Object.keys(running).filter(id => running[id].endsAt <= t);
      if (expired.length === 0) return;
      setRunning(r => {
        const copy = { ...r };
        for (const id of expired) delete copy[id];
        return copy;
      });
      setFinished(f => {
        const copy = { ...f };
        for (const id of expired) copy[id] = true;
        return copy;
      });
      timerDoneAlert();
      for (const id of expired) onFinishRef.current?.(id);
    }, 500);
    return () => clearInterval(interval);
  }, [running]);

  const start = useCallback((id: string, seconds: number) => {
    // Inside the user's tap — unlock audio now so the chime may sound later
    unlockChime();
    setFinished(f => {
      if (!f[id]) return f;
      const copy = { ...f };
      delete copy[id];
      return copy;
    });
    setRunning(r => ({ ...r, [id]: { endsAt: Date.now() + seconds * 1000, total: seconds } }));
    setNow(Date.now());
  }, []);

  const cancel = useCallback((id: string) => {
    setRunning(r => {
      const copy = { ...r };
      delete copy[id];
      return copy;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setFinished(f => {
      const copy = { ...f };
      delete copy[id];
      return copy;
    });
  }, []);

  const phase = useCallback(
    (id: string): TimerPhase => (running[id] ? 'running' : finished[id] ? 'done' : 'idle'),
    [running, finished],
  );

  const remainingSeconds = useCallback(
    (id: string): number => (running[id] ? Math.max(0, Math.ceil((running[id].endsAt - now) / 1000)) : 0),
    [running, now],
  );

  return { start, cancel, dismiss, phase, remainingSeconds };
}
