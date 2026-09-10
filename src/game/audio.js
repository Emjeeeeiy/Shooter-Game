/**
 * Tiny WebAudio synth SFX — zero assets, lazy AudioContext, master gain.
 * The engine emits `sfx` events; `useGame` forwards them here.
 */

let ctx = null;
let master = null;
let muted = false;
let volume = 0.7;

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    return true;
  } catch {
    return false;
  }
}

function env(gainNode, t0, peak, decay) {
  gainNode.gain.setValueAtTime(0.0001, t0);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
}

function tone({ freq = 440, end = null, type = 'square', dur = 0.12, vol = 0.25, delay = 0 }) {
  if (!ensure()) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
  env(g, t0, vol, dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.25, vol = 0.3, low = 400, high = 4000, delay = 0 }) {
  if (!ensure()) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = (low + high) / 2;
  filter.Q.value = 0.8;
  const g = ctx.createGain();
  env(g, t0, vol, dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  unlock() {
    ensure();
  },
  setMuted(m) {
    muted = !!m;
    if (master && ctx) master.gain.value = muted ? 0 : volume;
  },
  setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (master && ctx && !muted) master.gain.value = volume;
  },
  play(name) {
    if (muted) return;
    switch (name) {
      case 'shoot':
        tone({ freq: 880 + Math.random() * 120, end: 220, type: 'square', dur: 0.07, vol: 0.08 });
        break;
      case 'dash':
        noise({ dur: 0.18, vol: 0.22, low: 800, high: 5000 });
        tone({ freq: 220, end: 660, type: 'sawtooth', dur: 0.14, vol: 0.1 });
        break;
      case 'missile':
        noise({ dur: 0.3, vol: 0.2, low: 300, high: 2500 });
        tone({ freq: 180, end: 520, type: 'sawtooth', dur: 0.25, vol: 0.14 });
        break;
      case 'shock':
        tone({ freq: 90, end: 40, type: 'sine', dur: 0.5, vol: 0.5 });
        noise({ dur: 0.4, vol: 0.3, low: 100, high: 1200 });
        break;
      case 'rampart':
        tone({ freq: 140, end: 60, type: 'square', dur: 0.3, vol: 0.28 });
        tone({ freq: 420, end: 180, type: 'triangle', dur: 0.25, vol: 0.14 });
        noise({ dur: 0.2, vol: 0.18, low: 800, high: 3000 });
        break;
      case 'vortex':
        tone({ freq: 80, end: 400, type: 'sawtooth', dur: 0.5, vol: 0.18 });
        tone({ freq: 160, end: 800, type: 'sine', dur: 0.45, vol: 0.14, delay: 0.05 });
        noise({ dur: 0.4, vol: 0.12, low: 200, high: 1500 });
        break;
      case 'stasis':
        tone({ freq: 1200, end: 200, type: 'sine', dur: 0.5, vol: 0.22 });
        tone({ freq: 1800, end: 300, type: 'triangle', dur: 0.4, vol: 0.1, delay: 0.05 });
        noise({ dur: 0.3, vol: 0.08, low: 5000, high: 9000 });
        break;
      case 'explosion':
        noise({ dur: 0.22, vol: 0.25, low: 200, high: 2000 });
        tone({ freq: 160, end: 50, type: 'triangle', dur: 0.2, vol: 0.2 });
        break;
      case 'hurt':
        tone({ freq: 200, end: 60, type: 'sawtooth', dur: 0.25, vol: 0.3 });
        break;
      case 'pickup':
        tone({ freq: 660, end: 990, type: 'sine', dur: 0.12, vol: 0.22 });
        tone({ freq: 990, end: 1320, type: 'sine', dur: 0.1, vol: 0.15, delay: 0.07 });
        break;
      case 'buff':
        tone({ freq: 523, type: 'triangle', dur: 0.12, vol: 0.22 });
        tone({ freq: 659, type: 'triangle', dur: 0.12, vol: 0.22, delay: 0.09 });
        tone({ freq: 784, type: 'triangle', dur: 0.18, vol: 0.24, delay: 0.18 });
        break;
      case 'wave':
        tone({ freq: 440, end: 880, type: 'triangle', dur: 0.3, vol: 0.2 });
        break;
      case 'boss':
        tone({ freq: 110, end: 55, type: 'sawtooth', dur: 0.6, vol: 0.35 });
        noise({ dur: 0.5, vol: 0.2, low: 80, high: 600 });
        break;
      case 'bossdie':
        noise({ dur: 0.7, vol: 0.4, low: 100, high: 3000 });
        tone({ freq: 220, end: 30, type: 'sawtooth', dur: 0.6, vol: 0.3 });
        break;
      case 'bossspawn':
        tone({ freq: 140, end: 90, type: 'square', dur: 0.2, vol: 0.2 });
        break;
      case 'lunge':
        noise({ dur: 0.12, vol: 0.18, low: 1000, high: 6000 });
        break;
      case 'deny':
        tone({ freq: 160, type: 'square', dur: 0.08, vol: 0.12 });
        break;
      case 'gameover':
        tone({ freq: 330, end: 110, type: 'sawtooth', dur: 0.7, vol: 0.3 });
        tone({ freq: 220, end: 55, type: 'triangle', dur: 0.9, vol: 0.25, delay: 0.15 });
        break;
      case 'click':
        tone({ freq: 700, type: 'sine', dur: 0.05, vol: 0.12 });
        break;
      default:
        break;
    }
  },
};
