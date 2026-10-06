// Фоновая музыка в духе 8-битных приставок (Денди / NES): два «пульсовых» голоса, треугольный бас и шумовые барабаны.
// Мелодии оригинальные, написаны для этой игры. Всё синтезируется кодом — файлов нет.
// Музыка подчиняется общей кнопке «Звук».
import { getAudio, onAudioUnlock } from './sfx.js';

// Ноты: «C5», «F#4»; «-» — тянуть предыдущую, «.» — пауза. 16 шагов (шестнадцатых) в такте.
const SONGS = {
  // Титул и вступление: бодрая тема в до мажоре
  title: {
    bpm: 132,
    lead: [
      'E5 - G5 - C6 - B5 - A5 - G5 - E5 - - -',
      'F5 - A5 - D6 - C6 - B5 - G5 - - - - -',
      'E5 - G5 - C6 - E6 - D6 - C6 - A5 - B5 -',
      'C6 - - - G5 - E5 - C5 - - - . . . .',
    ],
    harm: [
      'C5 . . . E5 . . . F5 . . . E5 . . .',
      'D5 . . . F5 . . . D5 . . . B4 . . .',
      'C5 . . . E5 . . . E5 . . . F5 . . .',
      'E5 . . . D5 . . . C5 . . . . . . .',
    ],
    bass: [
      'C3 . G3 . C3 . G3 . C3 . G3 . C3 . G3 .',
      'F2 . C3 . F2 . C3 . G2 . D3 . G2 . D3 .',
      'C3 . G3 . C3 . G3 . A2 . E3 . A2 . E3 .',
      'F2 . C3 . G2 . D3 . C3 . G2 . C3 . . .',
    ],
    drums: ['k . h . s . h . k . h . s . h h'],
  },
  // Уровни: приключенческая тема в ля миноре
  level: {
    bpm: 144,
    lead: [
      'A4 . C5 . E5 - D5 . C5 . A4 - G4 . A4 .',
      'C5 - - . D5 - E5 . G5 - E5 . D5 . C5 .',
      'A4 . C5 . E5 - A5 . G5 . E5 - D5 . E5 .',
      'F5 - E5 - D5 - C5 - B4 - G4 - A4 - - -',
    ],
    harm: [
      'E4 . . . A4 . . . F4 . . . C5 . . .',
      'G4 . . . G4 . . . B4 . . . G4 . . .',
      'E4 . . . A4 . . . E4 . . . C5 . . .',
      'A4 . . . F4 . . . D4 . . . E4 . . .',
    ],
    bass: [
      'A2 . A2 A3 A2 . A2 A3 F2 . F2 F3 F2 . F2 F3',
      'C3 . C3 C4 C3 . C3 C4 G2 . G2 G3 G2 . G2 G3',
      'A2 . A2 A3 A2 . A2 A3 F2 . F2 F3 F2 . F2 F3',
      'D3 . D3 D4 D3 . D3 D4 E2 . E2 E3 E2 . E2 E3',
    ],
    drums: ['k . h . s . h k k . h . s . h h'],
  },
  // Босс: быстрая тревожная тема в ми миноре
  boss: {
    bpm: 168,
    lead: [
      'E5 . E5 . G5 . E5 . A5 . G5 . F#5 . D5 .',
      'E5 . E5 . G5 . B5 . A5 - G5 - F#5 - - -',
      'E5 . E5 . G5 . E5 . A5 . G5 . F#5 . D5 .',
      'C6 - B5 - A5 - G5 - F#5 - G5 - E5 - - -',
    ],
    harm: [
      'B4 . . . B4 . . . C5 . . . A4 . . .',
      'B4 . . . D5 . . . C5 . . . A4 . . .',
      'B4 . . . B4 . . . C5 . . . A4 . . .',
      'E5 . . . D5 . . . B4 . . . B4 . . .',
    ],
    bass: [
      'E2 E3 E2 E3 E2 E3 E2 E3 C3 C4 C3 C4 D3 D4 D3 D4',
      'E2 E3 E2 E3 E2 E3 E2 E3 C3 C4 C3 C4 D3 D4 D3 D4',
      'E2 E3 E2 E3 E2 E3 E2 E3 C3 C4 C3 C4 D3 D4 D3 D4',
      'A2 A3 A2 A3 B2 B3 B2 B3 E2 E3 E2 E3 E2 E3 E2 E3',
    ],
    drums: ['k h s h k k s h k h s h k k s s'],
  },
};

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function freq(name, transpose = 0) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  if (!m) return 0;
  const midi = (parseInt(m[2], 10) + 1) * 12 + NOTE[m[1]] + transpose;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function parse(bars) {
  return bars.join(' ').split(/\s+/).filter(Boolean);
}

const state = { name: null, transpose: 0, timer: null, step: 0, next: 0, gain: null, pulse: null, duck: 1 };

/** «Пульсовая» волна 25 % — характерный звук приставок того времени. */
function pulseWave(ctx) {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const duty = 0.25;
  for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

function voice(a, type, f, t0, dur, vol) {
  const { ctx } = a;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  if (type === 'pulse') o.setPeriodicWave(state.pulse);
  else o.type = type;
  o.frequency.setValueAtTime(f, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  g.gain.setValueAtTime(vol * 0.75, t0 + Math.min(0.06, dur * 0.5));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(state.gain);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function drum(a, kind, t0) {
  const { ctx, noiseBuf } = a;
  if (kind === 'k') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(160, t0);
    o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
    g.gain.setValueAtTime(0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    o.connect(g).connect(state.gain);
    o.start(t0);
    o.stop(t0 + 0.16);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = kind === 'h' ? 7000 : 1800;
  const g = ctx.createGain();
  const dur = kind === 'h' ? 0.03 : 0.11;
  g.gain.setValueAtTime(kind === 'h' ? 0.12 : 0.28, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(state.gain);
  src.start(t0, Math.random() * 0.4);
  src.stop(t0 + dur + 0.02);
}

/** Длительность ноты: сама нота + все «-» после неё. */
function lengthAt(seq, i) {
  let n = 1;
  while (seq[(i + n) % seq.length] === '-' && n < seq.length) n++;
  return n;
}

function tick() {
  const a = getAudio();
  const song = SONGS[state.name];
  if (!a || !song || a.ctx.state !== 'running') return;
  const stepDur = 60 / song.bpm / 4;
  if (state.next < a.ctx.currentTime) state.next = a.ctx.currentTime + 0.05;
  while (state.next < a.ctx.currentTime + 0.2) {
    const t0 = state.next;
    const tr = state.transpose;
    for (const [seq, type, vol, legato] of [
      [song._lead, 'pulse', 0.075, 0.92],
      [song._harm, 'square', 0.03, 0.85],
      [song._bass, 'triangle', 0.16, 0.9],
    ]) {
      const i = state.step % seq.length;
      const tok = seq[i];
      if (tok !== '.' && tok !== '-') voice(a, type, freq(tok, tr), t0, lengthAt(seq, i) * stepDur * legato, vol);
    }
    const dr = song._drums[state.step % song._drums.length];
    if (dr !== '.') drum(a, dr, t0);
    state.step += 1;
    state.next += stepDur;
  }
}

function ensure() {
  const a = getAudio();
  if (!a) return false;
  if (!state.gain) {
    state.gain = a.ctx.createGain();
    state.gain.gain.value = 0.55;
    state.gain.connect(a.master);
    state.pulse = pulseWave(a.ctx);
  }
  return true;
}

/** Включить мелодию (title | level | boss). Повторный вызов той же мелодии ничего не меняет. */
export function playMusic(name, { transpose = 0 } = {}) {
  if (state.name === name && state.transpose === transpose && state.timer) return;
  const song = SONGS[name];
  if (!song) return;
  for (const k of ['lead', 'harm', 'bass', 'drums']) song[`_${k}`] = song[`_${k}`] || parse(song[k]);
  state.name = name;
  state.transpose = transpose;
  state.step = 0;
  state.next = 0;
  if (!state.timer) state.timer = setInterval(tick, 25);
  if (ensure()) setDuck(state.duck);
}

export function stopMusic() {
  state.name = null;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}

/** Приглушить музыку (пауза) или вернуть громкость. */
export function setDuck(k) {
  state.duck = k;
  const a = getAudio();
  if (a && state.gain) state.gain.gain.setTargetAtTime(0.55 * k, a.ctx.currentTime, 0.05);
}

// Если мелодию попросили до первого касания — она начнётся, как только браузер разрешит звук.
onAudioUnlock(() => ensure());
