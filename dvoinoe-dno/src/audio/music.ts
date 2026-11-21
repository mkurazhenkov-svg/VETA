// Негромкая музыка в духе 1910-х, синтезированная Web Audio (без файлов, офлайн).
// Три собственные пьесы в стилистике эпохи: городской вальс (фортепиано), романс (виолончель с фортепиано)
// и наигрыш гармони «издалека». Мелодии оригинальные — это не переложения конкретных песен.

type Inst = 'piano' | 'cello' | 'garmon';
type Note = [number | null, number]; // midi | пауза, длительность в долях
interface Voice {
  inst: Inst;
  notes: Note[];
  gain: number;
}
export interface Piece {
  id: string;
  title: string;
  bpm: number;
  voices: Voice[];
  wet: number; // доля «зала»
  far?: boolean; // приглушить верх — звучит издалека
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(n: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(n);
  if (!m) throw new Error(`нота ${n}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const freq = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** "E5:2 D5:1 | r:1" → ноты. */
function line(src: string): Note[] {
  return src
    .split(/\s+/)
    .filter((t) => t && t !== '|')
    .map((t) => {
      const [n, d] = t.split(':');
      return [n === 'r' ? null : midi(n), Number(d)] as Note;
    });
}

const CHORDS: Record<string, string[]> = {
  Am: ['A', 'C', 'E'], Dm: ['D', 'F', 'A'], E: ['E', 'G#', 'B'], E7: ['E', 'G#', 'D'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'],
  C: ['C', 'E', 'G'], A7: ['A', 'C#', 'G'], Gm: ['G', 'Bb', 'D'], D: ['D', 'F#', 'A'], D7: ['D', 'F#', 'C'], Bb: ['Bb', 'D', 'F'],
};
const at = (pc: string, oct: number) => midi(pc + oct);

function triad(c: string, oct: number): number[] {
  const [r, ...rest] = CHORDS[c];
  const R = at(r, oct);
  return [R, ...rest.map((pc) => {
    let m = at(pc, oct);
    while (m <= R) m += 12;
    return m;
  })];
}

/** Аккомпанемент вальса: бас на «раз», аккорд на «два-три». */
function waltzBass(chords: string[]): Voice[] {
  const bass: Note[] = [];
  const chord: Note[][] = [[], [], []];
  for (const c of chords) {
    bass.push([at(CHORDS[c][0], 2), 1], [null, 2]);
    triad(c, 3).forEach((n, i) => chord[i].push([null, 1], [n, 1], [n, 1]));
  }
  return [{ inst: 'piano', notes: bass, gain: 0.55 }, ...chord.map((n) => ({ inst: 'piano' as Inst, notes: n, gain: 0.2 }))];
}

/** Арпеджио романса восьмыми: бас — квинта — терция — квинта — октава — квинта — терция — квинта. */
function arpeggio(chords: string[]): Voice {
  const notes: Note[] = [];
  for (const c of chords) {
    const [r, t, f] = CHORDS[c];
    const R = at(r, 2);
    const F = R + ((PC[f[0]] + (f[1] === '#' ? 1 : f[1] === 'b' ? -1 : 0) - PC[r[0]] + 12) % 12) + 12;
    const T = R + ((PC[t[0]] + (t[1] === '#' ? 1 : t[1] === 'b' ? -1 : 0) - PC[r[0]] + 12) % 12) + 12;
    for (const n of [R, F, T + 12, F, R + 24, F, T + 12, F]) notes.push([n, 0.5]);
  }
  return { inst: 'piano', notes, gain: 0.28 };
}

/** Гармонь: бас — аккорд — бас — аккорд (размер 2/4). */
function garmonBass(chords: string[]): Voice[] {
  const bass: Note[] = [];
  const ch: Note[][] = [[], []];
  for (const c of chords) {
    const [r, t, f] = CHORDS[c];
    bass.push([at(r, 3), 0.5], [null, 0.5], [at(f, 2 + (PC[f[0]] < PC[r[0]] ? 1 : 0)), 0.5], [null, 0.5]);
    for (const [i, pc] of [t, f].entries()) ch[i].push([null, 0.5], [at(pc, 4), 0.5], [null, 0.5], [at(pc, 4), 0.5]);
  }
  return [{ inst: 'garmon', notes: bass, gain: 0.35 }, ...ch.map((n) => ({ inst: 'garmon' as Inst, notes: n, gain: 0.16 }))];
}

export const PIECES: Record<string, Piece> = {
  waltz: {
    id: 'waltz',
    title: 'Вальс-романс (в духе городского вальса 1910-х)',
    bpm: 132,
    wet: 0.3,
    voices: [
      {
        inst: 'piano',
        gain: 0.42,
        notes: line(`E5:2 D5:1 | C5:2 B4:1 | A4:1.5 B4:0.5 C5:1 | E5:3 | F5:2 E5:1 | D5:2 C5:1 | B4:1.5 C5:0.5 D5:1 | E5:3 |
          A5:2 G5:1 | F5:2 E5:1 | D5:1 E5:1 F5:1 | E5:2 C5:1 | B4:2 C5:1 | D5:1 C5:1 B4:1 | A4:1.5 G#4:0.5 B4:1 | A4:3`),
      },
      ...waltzBass(['Am', 'Am', 'Dm', 'E', 'Dm', 'Am', 'E', 'Am', 'F', 'Dm', 'G', 'C', 'E', 'E7', 'E', 'Am']),
    ],
  },
  romance: {
    id: 'romance',
    title: 'Романс для виолончели и фортепиано (в духе салонного романса)',
    bpm: 58,
    wet: 0.38,
    voices: [
      {
        inst: 'cello',
        gain: 0.34,
        notes: line(`A3:2 D4:1 F4:1 | E4:3 D4:1 | C#4:2 E4:1 G4:1 | F4:4 | Bb4:2 A4:1 G4:1 | F4:2 E4:1 D4:1 | E4:1.5 F4:0.5 E4:1 C#4:1 | D4:4`),
      },
      arpeggio(['Dm', 'A7', 'A7', 'Dm', 'Gm', 'Dm', 'A7', 'Dm']),
    ],
  },
  garmon: {
    id: 'garmon',
    title: 'Наигрыш гармони издалека (в народном духе)',
    bpm: 92,
    wet: 0.55,
    far: true,
    voices: [
      {
        inst: 'garmon',
        gain: 0.3,
        notes: line(`D5:0.5 B4:0.5 B4:0.5 D5:0.5 | C5:0.5 A4:0.5 A4:1 | B4:0.5 G4:0.5 A4:0.5 B4:0.5 | C5:0.5 B4:0.5 A4:1 |
          D5:0.5 B4:0.5 B4:0.5 D5:0.5 | E5:0.5 C5:0.5 C5:1 | B4:0.5 A4:0.5 G4:0.5 F#4:0.5 | G4:1 r:1`),
      },
      ...garmonBass(['G', 'D', 'G', 'D', 'G', 'C', 'D', 'G']),
    ],
  },
};

export const MUSIC_FOR: Record<string, string> = {
  title: 'waltz',
  museum: 'romance',
  bank: 'waltz',
  shop: 'waltz',
  map: 'waltz',
  yard: 'garmon',
  cellar: 'romance',
  flophouse: 'garmon',
  chamber: 'romance',
};

export class MusicPlayer {
  private ctx: AudioContext;
  private out: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private tone: BiquadFilterNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private piece: Piece | null = null;
  private cursors: { i: number; t: number }[] = [];
  volume = 0.3;

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 6000;
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(2.6);
    this.tone.connect(this.dry).connect(this.out);
    this.tone.connect(verb).connect(this.wet).connect(this.out);
    this.out.connect(dest);
  }

  private impulse(sec: number) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return b;
  }

  play(id: string | null) {
    const next = id ? PIECES[id] ?? null : null;
    if (next?.id === this.piece?.id) return;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + 1.5);
    const start = () => {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.piece = next;
      if (!next) return;
      const t0 = this.ctx.currentTime + 0.1;
      this.cursors = next.voices.map(() => ({ i: 0, t: t0 }));
      this.dry.gain.value = 1 - next.wet * 0.6;
      this.wet.gain.value = next.wet;
      this.tone.frequency.value = next.far ? 1800 : 6000;
      this.out.gain.cancelScheduledValues(t0);
      this.out.gain.setValueAtTime(0, t0);
      this.out.gain.linearRampToValueAtTime(this.volume, t0 + 3);
      this.timer = setInterval(() => this.schedule(), 250);
      this.schedule();
    };
    if (this.piece) setTimeout(start, 1600);
    else start();
  }

  stop() {
    this.play(null);
  }

  private schedule() {
    const p = this.piece;
    if (!p) return;
    const beat = 60 / p.bpm;
    const horizon = this.ctx.currentTime + 1.2;
    p.voices.forEach((v, k) => {
      const c = this.cursors[k];
      while (c.t < horizon) {
        const [n, d] = v.notes[c.i];
        const human = (Math.random() - 0.5) * 0.012; // чуть «живого» неровного ритма
        if (n != null) this.note(v.inst, freq(n), c.t + human, d * beat, v.gain * (0.85 + Math.random() * 0.2));
        c.t += d * beat;
        c.i = (c.i + 1) % v.notes.length;
      }
    });
  }

  private note(inst: Inst, f: number, t: number, dur: number, vel: number) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(this.tone);
    if (inst === 'piano') {
      // несколько гармоник с быстрой атакой и затуханием, верх гаснет быстрее
      const decay = Math.min(3.2, 0.9 + dur * 1.5) * (f > 600 ? 0.7 : 1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.006);
      g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      for (const [mul, amp, type] of [[1, 1, 'sine'], [2, 0.32, 'sine'], [3, 0.12, 'triangle'], [4.01, 0.05, 'sine']] as const) {
        const o = ctx.createOscillator();
        const a = ctx.createGain();
        o.type = type;
        o.frequency.value = f * mul;
        o.detune.value = (Math.random() - 0.5) * 6;
        a.gain.value = amp;
        o.connect(a).connect(g);
        o.start(t);
        o.stop(t + decay + 0.05);
      }
    } else if (inst === 'cello') {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1300;
      lp.Q.value = 0.8;
      const vib = ctx.createOscillator();
      const vibAmt = ctx.createGain();
      vib.frequency.value = 5.2;
      vibAmt.gain.setValueAtTime(0, t);
      vibAmt.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.5, dur * 0.6));
      vib.connect(vibAmt).connect(o.frequency);
      const end = t + dur;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.14);
      g.gain.setValueAtTime(vel * 0.85, Math.max(t + 0.15, end - 0.15));
      g.gain.linearRampToValueAtTime(0.0001, end + 0.25);
      o.connect(lp).connect(g);
      o.start(t);
      vib.start(t);
      o.stop(end + 0.3);
      vib.stop(end + 0.3);
    } else {
      // гармонь: два чуть расстроенных голоса + «мех» (тремоло)
      const end = t + dur * 0.92;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(2400, f * 2.2);
      bp.Q.value = 0.7;
      const trem = ctx.createOscillator();
      const tremAmt = ctx.createGain();
      trem.frequency.value = 5.5;
      tremAmt.gain.value = vel * 0.15;
      trem.connect(tremAmt).connect(g.gain);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.03);
      g.gain.setValueAtTime(vel, Math.max(t + 0.04, end - 0.05));
      g.gain.linearRampToValueAtTime(0.0001, end + 0.06);
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(bp);
        o.start(t);
        o.stop(end + 0.1);
      }
      bp.connect(g);
      trem.start(t);
      trem.stop(end + 0.1);
    }
  }
}
