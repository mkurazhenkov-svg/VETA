// Звуки генерируются кодом (WebAudio): никаких звуковых файлов, всё внутри игры.
import { prefs } from '../state.js';

let ctx = null;
let master = null;
let noiseBuf = null;

/** Браузеры разрешают звук только после касания/клика — вызываем при первом действии игрока. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = prefs.sound ? 0.32 : 0;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    unlockListeners.forEach((fn) => fn());
  } catch {
    /* без звука */
  }
}

const unlockListeners = [];
/** Для музыки: вызвать fn, когда звук станет доступен. */
export function onAudioUnlock(fn) {
  unlockListeners.push(fn);
}

export function getAudio() {
  return ctx && master ? { ctx, master, noiseBuf } : null;
}

export function setSound(on) {
  prefs.sound = on;
  if (master) master.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.02);
}

export function isSoundOn() {
  return prefs.sound;
}

function ready() {
  return ctx && master && prefs.sound && ctx.state === 'running';
}

/** Один тон с огибающей и сдвигом частоты. */
function tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.12, vol = 0.25, delay = 0, attack = 0.004 }) {
  if (!ready()) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Шумовой всплеск (шерсть, бумага, вода). */
function noise({ dur = 0.15, vol = 0.2, freq = 2000, q = 0.8, type = 'bandpass', delay = 0, f1 }) {
  if (!ready()) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.setValueAtTime(freq, t0);
  if (f1) filt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  filt.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function arp(notes, { type = 'square', step = 0.07, dur = 0.12, vol = 0.18 } = {}) {
  notes.forEach((f, i) => tone({ type, f0: f, dur, vol, delay: i * step }));
}

export const sfx = {
  blip: () => tone({ type: 'square', f0: 880, f1: 880, dur: 0.035, vol: 0.05 }),
  click: () => tone({ type: 'square', f0: 660, f1: 880, dur: 0.05, vol: 0.12 }),
  jump: () => tone({ type: 'square', f0: 260, f1: 520, dur: 0.12, vol: 0.14 }),
  land: () => noise({ dur: 0.05, vol: 0.08, freq: 400, type: 'lowpass' }),
  beam: () => {
    tone({ type: 'sawtooth', f0: 1400, f1: 700, dur: 0.16, vol: 0.09 });
    tone({ type: 'sine', f0: 2200, f1: 1800, dur: 0.1, vol: 0.05 });
  },
  rip: () => {
    noise({ dur: 0.25, vol: 0.3, freq: 3000, f1: 800, q: 0.6 });
    tone({ type: 'square', f0: 500, f1: 180, dur: 0.18, vol: 0.1, delay: 0.03 });
  },
  baa: () => {
    tone({ type: 'triangle', f0: 420, f1: 380, dur: 0.22, vol: 0.12 });
    tone({ type: 'triangle', f0: 430, f1: 400, dur: 0.18, vol: 0.1, delay: 0.05 });
  },
  stomp: () => {
    tone({ type: 'square', f0: 180, f1: 90, dur: 0.12, vol: 0.2 });
    arp([523, 659, 784], { step: 0.05, dur: 0.08, vol: 0.12 });
  },
  runaway: () => arp([784, 659, 523, 392], { type: 'triangle', step: 0.06, dur: 0.1, vol: 0.1 }),
  doc: () => arp([659, 784, 988, 1319], { step: 0.06, dur: 0.12, vol: 0.14 }),
  defect: () => {
    tone({ type: 'square', f0: 330, f1: 330, dur: 0.08, vol: 0.14 });
    tone({ type: 'square', f0: 494, f1: 494, dur: 0.16, vol: 0.14, delay: 0.08 });
  },
  clean: () => arp([880, 1175], { type: 'sine', step: 0.08, dur: 0.14, vol: 0.12 }),
  checkpoint: () => arp([523, 659, 784, 1047], { type: 'triangle', step: 0.08, dur: 0.16, vol: 0.16 }),
  hurt: () => {
    tone({ type: 'sawtooth', f0: 300, f1: 90, dur: 0.25, vol: 0.18 });
    noise({ dur: 0.12, vol: 0.12, freq: 600 });
  },
  fall: () => tone({ type: 'triangle', f0: 600, f1: 80, dur: 0.5, vol: 0.16 }),
  throw: () => noise({ dur: 0.12, vol: 0.1, freq: 1800, f1: 3000 }),
  paper: () => noise({ dur: 0.3, vol: 0.22, freq: 4000, f1: 1500, q: 1.2 }),
  gateLocked: () => {
    tone({ type: 'square', f0: 200, dur: 0.1, vol: 0.14 });
    tone({ type: 'square', f0: 160, dur: 0.18, vol: 0.14, delay: 0.1 });
  },
  gateOpen: () => arp([392, 523, 659, 784, 1047], { type: 'square', step: 0.07, dur: 0.14, vol: 0.12 }),
  splash: () => noise({ dur: 0.3, vol: 0.18, freq: 900, f1: 300, type: 'lowpass' }),
  drip: () => tone({ type: 'sine', f0: 1600, f1: 900, dur: 0.06, vol: 0.05 }),
  crumble: () => {
    noise({ dur: 0.4, vol: 0.25, freq: 500, f1: 120, type: 'lowpass' });
    tone({ type: 'square', f0: 120, f1: 60, dur: 0.3, vol: 0.12 });
  },
  shieldBlock: () => tone({ type: 'square', f0: 900, f1: 600, dur: 0.08, vol: 0.12 }),
  shieldBreak: () => {
    noise({ dur: 0.5, vol: 0.3, freq: 3500, f1: 600 });
    arp([392, 494, 587, 784], { step: 0.07, dur: 0.15, vol: 0.14 });
  },
  bossHit: () => {
    tone({ type: 'sawtooth', f0: 220, f1: 70, dur: 0.3, vol: 0.2 });
    noise({ dur: 0.2, vol: 0.16, freq: 800 });
  },
  victory: () =>
    arp([523, 659, 784, 1047, 784, 1047, 1319], { type: 'square', step: 0.11, dur: 0.18, vol: 0.14 }),
  water: () => noise({ dur: 0.6, vol: 0.1, freq: 500, type: 'lowpass' }),
};
