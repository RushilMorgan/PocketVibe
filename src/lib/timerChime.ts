/**
 * Kitchen-proof "timer done" alert: a soft double chime + vibration.
 * Browsers only allow audio that traces back to a user gesture, so
 * unlockChime() must be called inside the tap that starts a timer — the
 * chime can then sound minutes later when the countdown ends.
 * Everything here is best-effort: no audio/vibration support is a no-op.
 */

let ctx: AudioContext | null = null;

export function unlockChime(): void {
  try {
    type W = typeof window & { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext ?? (window as W).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function playChime(): void {
  try {
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    [
      { delay: 0, freq: 880 },
      { delay: 0.35, freq: 1175 },
    ].forEach(({ delay, freq }) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.3);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.35);
    });
  } catch {
    // best-effort
  }
}

export function timerDoneAlert(): void {
  playChime();
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // best-effort
  }
}
