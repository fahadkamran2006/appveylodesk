/**
 * Lightweight sound effects using the Web Audio API.
 * No external audio files needed — all sounds are synthesized.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Pleasant two-tone chime for upload completion */
export function playUploadCompleteSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.15, now);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  master.connect(ctx.destination);

  // First tone — C5
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(523.25, now);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(1, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc1.connect(g1).connect(master);
  osc1.start(now);
  osc1.stop(now + 0.4);

  // Second tone — E5 (a major third up, sounds positive)
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(659.25, now + 0.1);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, now);
  g2.gain.setValueAtTime(1, now + 0.1);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  osc2.connect(g2).connect(master);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.55);
}

/** Soft bell-like ping for new notifications */
export function playNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.12, now);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  master.connect(ctx.destination);

  // Bell tone — A5
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(830, now + 0.3);

  const g = ctx.createGain();
  g.gain.setValueAtTime(1, now);
  g.gain.exponentialRampToValueAtTime(0.3, now + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

  osc.connect(g).connect(master);
  osc.start(now);
  osc.stop(now + 0.7);

  // Soft harmonic overtone
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1320, now);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.3, now);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc2.connect(g2).connect(master);
  osc2.start(now);
  osc2.stop(now + 0.4);
}
