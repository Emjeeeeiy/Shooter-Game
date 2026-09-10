/**
 * Procedural background music — zero assets, one lazy AudioContext.
 * Two moods: 'menu' (slow synth pads) and 'game' (driving bass + arp + kit).
 * A small lookahead scheduler keeps timing tight; master gain follows the
 * mute / music-toggle / volume settings from outside.
 */

let ctx = null;
let master = null;
let noiseBuf = null;
let timer = null;
let step = 0;
let nextTime = 0;
let mood = null;

let muted = false;
let enabled = true;
let volume = 0.7;
const MUSIC_LEVEL = 0.42;

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Am — F — C — G, voiced to flow into each other.
const CHORDS = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [55, 60, 64], // C (2nd inversion, close to neighbors)
  [55, 59, 62], // G
];
const ROOTS = [33, 29, 36, 31]; // A1 F1 C2 G1

const BPM = { menu: 84, game: 134 };
const STEP16 = (m) => 60 / BPM[m] / 4;

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
    master.gain.value = 0;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return true;
  } catch {
    return false;
  }
}

function applyGain() {
  if (!ctx || !master) return;
  const target = muted || !enabled || !mood ? 0 : volume * MUSIC_LEVEL;
  master.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
}

function kick(t) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.16);
}

function hat(t) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.4);
  src.stop(t + 0.06);
}

function bass(t, m, dur) {
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.value = midi(m);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(700, t);
  f.frequency.exponentialRampToValueAtTime(220, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.24, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function pad(t, chord, dur) {
  for (const m of chord) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = midi(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.055, t + Math.min(0.9, dur * 0.3));
    g.gain.setValueAtTime(0.055, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

function pluck(t, m, vol = 0.055, dur = 0.22) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = midi(m);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function schedule(s, t) {
  const bar = Math.floor(s / 16) % 4;
  const st = s % 16;
  if (mood === 'menu') {
    if (st === 0) pad(t, CHORDS[bar], STEP16('menu') * 16);
    if (st % 4 === 2 && Math.random() < 0.55) {
      const tone = CHORDS[bar][Math.floor(Math.random() * 3)] + 12;
      pluck(t, tone, 0.04, 0.5);
    }
    if (st === 0 && bar === 0) bass(t, ROOTS[0] + 12, STEP16('menu') * 4);
  } else if (mood === 'game') {
    if (st % 4 === 0) kick(t);
    if (st % 4 === 2) hat(t);
    if (st % 2 === 0) bass(t, st === 14 ? ROOTS[bar] + 12 : ROOTS[bar], STEP16('game') * 1.8);
    const arpTones = [...CHORDS[bar].map((m) => m + 12), CHORDS[bar][0] + 24, CHORDS[bar][2] + 12];
    pluck(t, arpTones[s % arpTones.length], 0.045, 0.16);
  }
}

function tick() {
  if (!ctx || !mood) return;
  while (nextTime < ctx.currentTime + 0.25) {
    schedule(step, nextTime);
    nextTime += STEP16(mood);
    step += 1;
  }
}

export const music = {
  unlock() {
    if (ensure()) applyGain();
  },
  playMood(m) {
    if (m !== 'menu' && m !== 'game') m = null;
    if (!ensure()) return;
    if (mood !== m) {
      mood = m;
      step = 0;
      nextTime = ctx.currentTime + 0.08;
    }
    if (!timer) timer = setInterval(tick, 80);
    applyGain();
  },
  stop() {
    mood = null;
    applyGain();
  },
  setMuted(m) {
    muted = !!m;
    applyGain();
  },
  setEnabled(v) {
    enabled = v !== false;
    applyGain();
  },
  setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    applyGain();
  },
};
