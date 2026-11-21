// Звук синтезируется Web Audio: гул ярмарки, пароходные гудки, колокола, капель подвала, щелчки и магний.
// Без файлов — работает офлайн и ничего не весит. Настоящие записи — этап M8.
import { prefs } from '../store/game';
import { MusicPlayer, MUSIC_FOR } from './music';

let music: MusicPlayer | null = null;
let musicKey: string | null = null;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambient: { stop: () => void } | null = null;
let currentAmb = '';

function ac(): AudioContext | null {
  if (!prefs.value.sound) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(c: AudioContext, sec = 2) {
  const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // «коричневый» шум
    d[i] = last * 3.5;
  }
  return b;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, when = 0, slide = 0) {
  const c = ac();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + when);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, c.currentTime + when + dur);
  g.gain.setValueAtTime(0, c.currentTime + when);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
  o.connect(g).connect(master);
  o.start(c.currentTime + when);
  o.stop(c.currentTime + when + dur + 0.05);
}

function noiseBurst(dur: number, vol: number, freq = 1200, q = 0.7) {
  const c = ac();
  if (!c || !master) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur + 0.1);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  src.connect(f).connect(g).connect(master);
  src.start();
}

export function sfx(name: 'click' | 'page' | 'shutter' | 'magnesium' | 'tripod' | 'seal' | 'horn' | 'bell' | 'press') {
  switch (name) {
    case 'click':
      tone(900, 0.05, 'square', 0.04);
      break;
    case 'page':
      noiseBurst(0.18, 0.12, 3000, 0.5);
      break;
    case 'shutter':
      noiseBurst(0.06, 0.3, 2000, 2);
      tone(220, 0.08, 'square', 0.05, 0.05);
      break;
    case 'magnesium':
      noiseBurst(0.9, 0.5, 5000, 0.3);
      tone(80, 0.3, 'sawtooth', 0.08);
      break;
    case 'tripod':
      tone(140, 0.12, 'triangle', 0.1);
      tone(110, 0.12, 'triangle', 0.08, 0.1);
      break;
    case 'seal':
      tone(180, 0.2, 'sine', 0.15);
      noiseBurst(0.2, 0.08, 600, 1);
      break;
    case 'horn':
      tone(110, 2.2, 'sawtooth', 0.06, 0, -6);
      tone(165, 2.2, 'sawtooth', 0.04, 0, -8);
      break;
    case 'bell':
      for (const [f, v] of [[392, 0.12], [784, 0.05], [1176, 0.03]] as const) tone(f, 3, 'sine', v);
      break;
    case 'press':
      tone(70, 0.5, 'sawtooth', 0.06, 0, 30);
      break;
  }
}

/** Фон локации. */
export function setAmbient(loc: string | null) {
  if (currentAmb === loc) return;
  currentAmb = loc ?? '';
  ambient?.stop();
  ambient = null;
  const c = ac();
  if (!c || !master || !loc) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 4);
  src.loop = true;
  const f = c.createBiquadFilter();
  const g = c.createGain();
  const outdoor = loc === 'yard' || loc === 'bank' || loc === 'shop';
  f.type = 'lowpass';
  f.frequency.value = outdoor ? 700 : 260;
  g.gain.value = outdoor ? 0.05 : 0.025;
  src.connect(f).connect(g).connect(master);
  src.start();
  const timers: ReturnType<typeof setInterval>[] = [];
  if (loc === 'yard' || loc === 'bank' || loc === 'shop') timers.push(setInterval(() => Math.random() < 0.3 && sfx('horn'), 17000));
  if (loc === 'yard' || loc === 'chamber') timers.push(setInterval(() => Math.random() < 0.3 && sfx('bell'), 23000));
  if (loc === 'cellar') timers.push(setInterval(() => tone(1400 + Math.random() * 600, 0.08, 'sine', 0.03), 2600));
  ambient = {
    stop: () => {
      try {
        src.stop();
      } catch {
        /* ignore */
      }
      timers.forEach(clearInterval);
    },
  };
}

/** Музыка по месту действия: ключ локации или 'title' / 'map'; null — тишина. */
export function setMusic(key: string | null) {
  musicKey = key;
  const c = ac();
  if (!c || !master) return;
  if (!music) music = new MusicPlayer(c, master);
  music.play(prefs.value.music && key ? MUSIC_FOR[key] ?? null : null);
}

prefs.subscribe((p) => {
  if (music) music.play(p.sound && p.music && musicKey ? MUSIC_FOR[musicKey] ?? null : null);
  if (!p.sound) {
    ambient?.stop();
    ambient = null;
    currentAmb = '';
  }
});
