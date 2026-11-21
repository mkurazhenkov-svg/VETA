// Состояние игры строится из журнала: reduce(state, event) — чистая функция.
import type { Content, PhotoKind, SkillId } from '../content/schemas';
import { SKILLS } from '../content/schemas';
import type { CaseFolder, Condition, GameEvent, Mode, Settings } from './events';
import type { Vec2 } from './geometry';
import { parseClock } from './clock';
import { roll2d6 } from './rng';

export interface PhotoRec {
  plate: number;
  loc: string;
  target: string;
  kind: PhotoKind;
  scale: boolean;
  magnesium: boolean;
  quality: number;
  ok: boolean;
  inSitu: boolean;
  defects: string[];
  t: number;
  distanceArshin: number;
  tripod?: Vec2;
}

export interface EvState {
  detected: boolean;
  via?: string;
  examined: boolean;
  examinedAt?: number;
  lupa: boolean;
  searched: boolean;
  touched: boolean;
  touchedBeforeFix: boolean;
  moved: boolean;
  condition: Condition;
  collected: boolean;
  method?: string;
  pack?: string;
  sealed?: boolean;
  signedBy?: string[];
  measured: Record<string, number>;
  plan?: Vec2;
  origin?: string;
  originCorrect?: boolean;
}

export interface GameState {
  started: boolean;
  ended: boolean;
  mode: Mode;
  settings: Settings;
  seed: number;
  rng: number;
  clock: number;
  archetype: string;
  skills: Record<SkillId, number>;
  location: string | null;
  visited: string[];
  pos: Record<string, Vec2>;
  sectorsVisited: Record<string, string[]>;
  sectorsLooked: Record<string, string[]>;
  roomDescribed: Record<string, boolean>;
  steppedInBeforeGeneral: Record<string, boolean>;
  evidence: Record<string, EvState>;
  platesUsed: Record<string, number>;
  photos: PhotoRec[];
  tripod: { loc: string; pos: Vec2 } | null;
  lamp: boolean;
  smokeUntil: number;
  witnesses: { chosen: string[]; present: string[] };
  facts: Record<string, { t: number; source: string; unreliable: boolean }>;
  factOrder: string[];
  notes: { t: number; text: string; about?: string }[];
  checks: Record<string, { ok: boolean; factCount: number; t: number; repeatable: boolean }>;
  trust: Record<string, number>;
  flags: Record<string, boolean | number | string>;
  theories: Record<string, 'revealed' | 'internalized' | 'discarded'>;
  voices: Record<SkillId, { suggested: number; shortcuts: number; followed: number; shortcutsFollowed: number }>;
  interview: Record<string, Record<string, number>>;
  timelineDone: string[];
  telegram: { t: number; destination: string; steamer: boolean; description: string[]; text: string } | null;
  qr: string[];
  hints: number;
  folder: CaseFolder | null;
  exhibitFinale: { signs: string[]; suspects: string[] } | null;
  eventCount: number;
}

export const DEFAULT_SETTINGS: Settings = {
  variant: 'truth_main',
  platesOverride: null,
  noRandom: false,
  timePressure: true,
  showReveal: true,
  studentName: '',
};

export function emptyEv(): EvState {
  return {
    detected: false,
    examined: false,
    lupa: false,
    searched: false,
    touched: false,
    touchedBeforeFix: false,
    moved: false,
    condition: 'intact',
    collected: false,
    measured: {},
  };
}

export function initialState(content: Content): GameState {
  const evidence: Record<string, EvState> = {};
  for (const e of content.evidence) evidence[e.id] = emptyEv();
  const voices = {} as GameState['voices'];
  const skills = {} as Record<SkillId, number>;
  for (const s of SKILLS) {
    voices[s] = { suggested: 0, shortcuts: 0, followed: 0, shortcutsFollowed: 0 };
    skills[s] = 1;
  }
  return {
    started: false,
    ended: false,
    mode: 'practicum',
    settings: { ...DEFAULT_SETTINGS },
    seed: 1,
    rng: 1,
    clock: parseClock(content.case.startTime),
    archetype: content.skills.defaultArchetype,
    skills,
    location: null,
    visited: [],
    pos: {},
    sectorsVisited: {},
    sectorsLooked: {},
    roomDescribed: {},
    steppedInBeforeGeneral: {},
    evidence,
    platesUsed: {},
    photos: [],
    tripod: null,
    lamp: false,
    smokeUntil: 0,
    witnesses: { chosen: [], present: [] },
    facts: {},
    factOrder: [],
    notes: [],
    checks: {},
    trust: {},
    flags: {},
    theories: {},
    voices,
    interview: {},
    timelineDone: [],
    telegram: null,
    qr: [],
    hints: 0,
    folder: null,
    exhibitFinale: null,
    eventCount: 0,
  };
}

function addUnique(arr: string[] | undefined, v: string | null): string[] {
  const a = arr ?? [];
  if (v == null || a.includes(v)) return a;
  return [...a, v];
}

/** Применяет событие к состоянию. Не мутирует вход. */
export function reduce(prev: GameState, ev: GameEvent): GameState {
  const s: GameState = { ...prev, eventCount: prev.eventCount + 1 };
  s.clock = Math.max(prev.clock, ev.t + (ev.dt ?? 0));
  const evMut = (id: string) => {
    s.evidence = { ...s.evidence, [id]: { ...(s.evidence[id] ?? emptyEv()) } };
    return s.evidence[id];
  };

  switch (ev.type) {
    case 'session.started':
      s.started = true;
      s.mode = ev.mode;
      s.settings = ev.settings;
      s.seed = ev.seed;
      s.rng = ev.seed >>> 0;
      s.archetype = ev.archetype;
      s.skills = { ...ev.skills };
      break;
    case 'location.entered':
      s.location = ev.loc;
      s.visited = addUnique(s.visited, ev.loc);
      s.tripod = null;
      s.lamp = false;
      break;
    case 'player.moved': {
      s.pos = { ...s.pos, [ev.loc]: ev.to };
      s.sectorsVisited = { ...s.sectorsVisited, [ev.loc]: addUnique(s.sectorsVisited[ev.loc], ev.sector) };
      if (ev.threshold === false && !s.roomDescribed[ev.loc])
        s.steppedInBeforeGeneral = { ...s.steppedInBeforeGeneral, [ev.loc]: true };
      break;
    }
    case 'scene.looked':
      s.sectorsLooked = { ...s.sectorsLooked, [ev.loc]: addUnique(s.sectorsLooked[ev.loc], ev.sector) };
      break;
    case 'room.described':
      s.roomDescribed = { ...s.roomDescribed, [ev.loc]: true };
      break;
    case 'evidence.detected': {
      const e = evMut(ev.id);
      if (!e.detected) {
        e.detected = true;
        e.via = ev.via;
      }
      break;
    }
    case 'evidence.examined': {
      const e = evMut(ev.id);
      e.detected = true;
      if (!e.examined) e.examinedAt = ev.t;
      e.examined = true;
      if (ev.lupa) e.lupa = true;
      break;
    }
    case 'evidence.searched':
      evMut(ev.id).searched = true;
      break;
    case 'lamp.toggled':
      s.lamp = ev.on;
      break;
    case 'tripod.placed':
      s.tripod = { loc: ev.loc, pos: ev.pos };
      break;
    case 'photo.taken': {
      s.platesUsed = { ...s.platesUsed, [ev.loc]: (s.platesUsed[ev.loc] ?? 0) + 1 };
      const ok = ev.quality >= 0.55 && !ev.defects.includes('wrong_kind');
      s.photos = [
        ...s.photos,
        {
          plate: ev.plate,
          loc: ev.loc,
          target: ev.target,
          kind: ev.kind,
          scale: ev.scale,
          magnesium: ev.magnesium,
          quality: ev.quality,
          ok,
          inSitu: ev.inSitu,
          defects: ev.defects,
          t: ev.t,
          distanceArshin: ev.distanceArshin,
          tripod: ev.tripod,
        },
      ];
      if (ev.magnesium) s.smokeUntil = ev.t + (ev.dt ?? 0) + 10;
      break;
    }
    case 'measure.taken': {
      const e = evMut(ev.target);
      e.measured = { ...e.measured, [ev.landmark]: ev.arshin };
      break;
    }
    case 'evidence.touched': {
      const e = evMut(ev.id);
      e.touched = true;
      if (!ev.fixed) e.touchedBeforeFix = true;
      break;
    }
    case 'evidence.picked_up': {
      const e = evMut(ev.id);
      e.touched = true;
      e.moved = true;
      if (!ev.fixed) e.touchedBeforeFix = true;
      break;
    }
    case 'evidence.condition': {
      const e = evMut(ev.id);
      const order: Condition[] = ['intact', 'degraded', 'destroyed'];
      if (order.indexOf(ev.condition) > order.indexOf(e.condition)) e.condition = ev.condition;
      break;
    }
    case 'evidence.packaged': {
      const e = evMut(ev.id);
      e.collected = true;
      e.moved = true;
      e.touched = true;
      e.method = ev.method;
      e.pack = ev.pack;
      e.sealed = ev.sealed;
      e.signedBy = ev.signedBy;
      break;
    }
    case 'evidence.origin': {
      const e = evMut(ev.id);
      e.origin = ev.origin;
      e.originCorrect = ev.correct;
      break;
    }
    case 'note.written':
      s.notes = [...s.notes, { t: ev.t, text: ev.text, about: ev.about }];
      break;
    case 'witnesses.changed':
      s.witnesses = { chosen: ev.chosen, present: ev.present };
      break;
    case 'check.rolled':
      // бросок продвигает генератор так же, как при расчёте; кубы уже в событии
      s.rng = roll2d6(s.rng).seed;
      s.checks = { ...s.checks, [ev.key]: { ok: ev.ok, factCount: s.factOrder.length, t: ev.t, repeatable: ev.repeatable } };
      break;
    case 'dialogue.choice': {
      const iv = { ...(s.interview[ev.npc] ?? {}) };
      for (const tag of ev.tags) iv[tag] = (iv[tag] ?? 0) + 1;
      iv['_total'] = (iv['_total'] ?? 0) + 1;
      s.interview = { ...s.interview, [ev.npc]: iv };
      const voiceTag = ev.tags.find((t) => t.startsWith('voice:'));
      if (voiceTag) {
        const v = voiceTag.slice(6) as SkillId;
        if (s.voices[v]) {
          const vs = { ...s.voices[v] };
          vs.followed++;
          if (ev.tags.includes('shortcut')) vs.shortcutsFollowed++;
          s.voices = { ...s.voices, [v]: vs };
        }
      }
      break;
    }
    case 'fact.learned':
      if (!s.facts[ev.id]) {
        s.facts = { ...s.facts, [ev.id]: { t: ev.t, source: ev.source, unreliable: ev.unreliable } };
        s.factOrder = [...s.factOrder, ev.id];
      }
      break;
    case 'trust.changed':
      s.trust = { ...s.trust, [ev.npc]: (s.trust[ev.npc] ?? 0) + ev.delta };
      break;
    case 'time.spent':
      break;
    case 'flag.set':
      s.flags = { ...s.flags, [ev.id]: ev.value };
      break;
    case 'theory.revealed':
      if (!s.theories[ev.id]) s.theories = { ...s.theories, [ev.id]: 'revealed' };
      break;
    case 'theory.internalized':
      s.theories = { ...s.theories, [ev.id]: 'internalized' };
      break;
    case 'theory.discarded':
      s.theories = { ...s.theories, [ev.id]: 'discarded' };
      break;
    case 'voice.suggested': {
      const vs = { ...s.voices[ev.voice] };
      vs.suggested++;
      if (ev.shortcut) vs.shortcuts++;
      s.voices = { ...s.voices, [ev.voice]: vs };
      break;
    }
    case 'timeline.fired':
      s.timelineDone = addUnique(s.timelineDone, ev.id);
      break;
    case 'museum.qr':
      s.qr = addUnique(s.qr, ev.code);
      break;
    case 'telegram.sent':
      s.telegram = { t: ev.t, destination: ev.destination, steamer: ev.steamer, description: ev.description, text: ev.text };
      break;
    case 'plan.marked': {
      const e = evMut(ev.id);
      e.plan = ev.pos;
      break;
    }
    case 'hint.used':
      s.hints++;
      break;
    case 'exhibit.finale':
      s.exhibitFinale = { signs: ev.signs, suspects: ev.suspects };
      s.ended = true;
      break;
    case 'folder.submitted':
      s.folder = ev.doc;
      s.ended = true;
      break;
  }
  return s;
}

export function replay(content: Content, journal: GameEvent[]): GameState {
  let s = initialState(content);
  for (const e of journal) s = reduce(s, e);
  return s;
}
