// Игровое хранилище для UI: журнал → состояние (через домен), лента текста, выборы, экраны.
import { signal, computed, batch } from '@preact/signals';
import { content } from '../content';
import type { SkillId } from '../content/schemas';
import { perform, type Intent } from '../domain/commands';
import type { GameEvent, Mode, Settings } from '../domain/events';
import { DEFAULT_SETTINGS, initialState, reduce, replay, type GameState } from '../domain/state';
import { evaluateRules } from '../domain/rules-engine';
import { evidenceDef, factText, personName } from '../domain/queries';
import { lsGet, lsSet, saveGame, loadGame, clearGame } from './save';

export type FeedKind = 'narr' | 'npc' | 'voice' | 'system' | 'echo' | 'zharov' | 'plate' | 'doc' | 'time';
export interface FeedEntry {
  id: number;
  kind: FeedKind;
  who?: string; // персонаж или навык
  mood?: string;
  text: string;
  img?: string;
  shortcut?: boolean;
}

export interface Choice {
  text: string;
  tags?: string[];
  disabled?: boolean;
  hint?: string; // шанс проверки, причина недоступности
  run: () => void;
}

export type Screen = 'title' | 'attract' | 'hero' | 'game' | 'map' | 'debrief' | 'teacher' | 'exhibit_result';
export type Modal = null | 'notebook' | 'theories' | 'photo' | 'collect' | 'telegram' | 'folder' | 'settings' | 'doc' | 'portfolio' | 'finale' | 'note' | 'qr' | 'measure';

export const journal = signal<GameEvent[]>([]);
export const state = signal<GameState>(initialState(content));
export const feed = signal<FeedEntry[]>([]);
export const choices = signal<Choice[]>([]);
export const screen = signal<Screen>('title');
export const modal = signal<Modal>(null);
export const modalArg = signal<any>(null);
export const speaker = signal<{ who: string; mood: string } | null>(null);
export const tool = signal<'walk' | 'tripod'>('walk');
export const highlight = signal(false);
export const kiosk = signal(false);
export const remarks = signal<{ t: number; text: string; rule: string }[]>([]);

export interface Prefs {
  textScale: number;
  contrast: boolean;
  sound: boolean;
  timePressure: boolean;
}
export const prefs = signal<Prefs>(lsGet('dd.prefs', { textScale: 1, contrast: false, sound: true, timePressure: true }));
export function setPrefs(p: Partial<Prefs>) {
  prefs.value = { ...prefs.value, ...p };
  lsSet('dd.prefs', prefs.value);
}

export interface TeacherConfig {
  variant: Settings['variant'] | 'random';
  plates: number | null;
  noRandom: boolean;
  timePressure: boolean;
  showReveal: boolean;
}
export const teacherConfig = signal<TeacherConfig>(lsGet('dd.teacher', { variant: 'truth_main', plates: null, noRandom: false, timePressure: true, showReveal: true }));
export function setTeacherConfig(c: Partial<TeacherConfig>) {
  teacherConfig.value = { ...teacherConfig.value, ...c };
  lsSet('dd.teacher', teacherConfig.value);
}

export const isPracticum = computed(() => state.value.mode === 'practicum');

let feedId = 0;
export function say(kind: FeedKind, text: string, who?: string, extra: Partial<FeedEntry> = {}) {
  feed.value = [...feed.value, { id: ++feedId, kind, text, who, ...extra }];
}

const listeners = new Set<(evs: GameEvent[]) => void>();
export function onEvents(fn: (evs: GameEvent[]) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let inkStateGetter: (() => string | null) | null = null;
export function setInkStateGetter(fn: () => string | null) {
  inkStateGetter = fn;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = state.value;
    if (!s.started || kiosk.value) return;
    saveGame(s.mode, { journal: journal.value, inkState: inkStateGetter?.() ?? null, savedAt: new Date().toISOString(), mode: s.mode });
  }, 400);
}

/** Единственная точка изменения состояния. */
export function dispatch(intent: Intent): GameEvent[] {
  const before = state.value;
  const evs = perform(before, content, intent);
  if (!evs.length) return evs;
  let s = before;
  for (const e of evs) s = reduce(s, e);
  const prevViol = before.mode === 'practicum' ? evaluateRules(before, journal.value, content) : [];
  batch(() => {
    journal.value = [...journal.value, ...evs];
    state.value = s;
  });
  narrate(evs, s);
  if (s.mode === 'practicum') {
    const now = evaluateRules(s, journal.value, content);
    const count = (arr: typeof now) => arr.reduce<Record<string, number>>((m, v) => ((m[v.rule] = (m[v.rule] ?? 0) + 1), m), {});
    const pc = count(prevViol);
    const nc = count(now);
    for (const v of now) {
      if ((nc[v.rule] ?? 0) > (pc[v.rule] ?? 0)) {
        pc[v.rule] = (pc[v.rule] ?? 0) + 1;
        if (['R_CONCLUSIONS', 'R_NOT_IN_PROTOCOL', 'R_CHANGES_UNKNOWN', 'R_SECTORS_SKIPPED', 'R_FALSE_TRACES'].includes(v.rule)) continue;
        say('zharov', v.def.zharov, 'zharov');
        remarks.value = [...remarks.value, { t: s.clock, text: v.def.zharov, rule: v.rule }];
      }
    }
  }
  for (const l of listeners) l(evs);
  scheduleSave();
  return evs;
}

/** Текстовые отклики на события: факты, голоса, события по часам. */
function narrate(evs: GameEvent[], s: GameState) {
  for (const e of evs) {
    switch (e.type) {
      case 'fact.learned': {
        const f = content.facts.find((x) => x.id === e.id);
        if (f && f.kind !== 'testimony') say('system', `В записную книжку: ${factText(s, content, e.id)}`);
        else if (f) say('system', `Записано: ${factText(s, content, e.id)}${e.unreliable ? ' (показание ненадёжно)' : ''}`);
        break;
      }
      case 'voice.suggested': {
        if (e.key.startsWith('notice:')) {
          const ev = evidenceDef(content, e.key.slice(7));
          if (ev) say('voice', `Здесь что-то не так: ${ev.title.toLowerCase()}.`, e.voice);
          break;
        }
        const [evId, idx] = e.key.split(':');
        const ev = evidenceDef(content, evId);
        const v = ev?.voices[Number(idx)];
        if (v) say('voice', stripName(v.text), v.skill, { shortcut: v.shortcut });
        break;
      }
      case 'timeline.fired': {
        const tl = content.case.timeline.find((x) => x.id === e.id);
        if (tl) say('time', tl.text);
        break;
      }
      case 'witnesses.changed':
        if (e.reason.startsWith('left:')) say('system', `${personName(content, e.reason.slice(5))} ушёл. Понятых осталось: ${e.present.length}.`);
        break;
      case 'theory.revealed': {
        const th = content.theories.find((t) => t.id === e.id);
        if (th) say('voice', `Новая версия в картотеке: «${th.title}».`, th.voice);
        break;
      }
      case 'theory.internalized': {
        const th = content.theories.find((t) => t.id === e.id);
        if (th) say('system', `Версия обдумана: «${th.title}». Связанные голоса громче — и тише всё, что ей противоречит.`);
        break;
      }
      case 'evidence.condition': {
        const ev = evidenceDef(content, e.id);
        if (!ev) break;
        const why = e.reason === 'rain' ? 'Дождь' : e.reason === 'trampled' ? ev.fragile.text ?? 'Затоптано' : e.reason === 'touched' ? ev.fragile.text ?? 'Повреждено' : 'При изъятии';
        say('system', `${why}: «${ev.title}» — ${e.condition === 'destroyed' ? 'утрачено' : 'повреждено'}.`);
        break;
      }
    }
  }
}

export function stripName(t: string) {
  return t.replace(/^[А-ЯЁA-Z][^:«»]{1,24}:\s+/, '');
}

export function resetSession() {
  batch(() => {
    journal.value = [];
    state.value = initialState(content);
    feed.value = [];
    choices.value = [];
    remarks.value = [];
    speaker.value = null;
    modal.value = null;
    tool.value = 'walk';
    highlight.value = false;
  });
}

export function startSession(mode: Mode, archetype: string, skills: Record<SkillId, number>, studentName = '') {
  resetSession();
  const tc = teacherConfig.value;
  const variants = ['truth_main', 'truth_landlord', 'truth_guest'] as const;
  const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  const variant = mode === 'exhibit' ? 'truth_main' : tc.variant === 'random' ? variants[seed % 3] : tc.variant;
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    variant,
    platesOverride: mode === 'practicum' ? tc.plates : null,
    noRandom: mode === 'practicum' ? tc.noRandom : false,
    timePressure: mode === 'practicum' ? tc.timePressure && prefs.value.timePressure : false,
    showReveal: tc.showReveal,
    studentName,
  };
  dispatch({ type: 'start', mode, settings, archetype, skills, seed });
}

export async function restoreSession(slot: string): Promise<{ inkState: string | null } | null> {
  const d = await loadGame(slot);
  if (!d || !d.journal?.length) return null;
  resetSession();
  batch(() => {
    journal.value = d.journal;
    state.value = replay(content, d.journal);
  });
  return { inkState: d.inkState };
}

export async function hasSave(slot: string) {
  const d = await loadGame(slot);
  return !!d?.journal?.length && !replay(content, d.journal).ended;
}
export { clearGame };

export function openModal(m: Modal, arg: any = null) {
  modalArg.value = arg;
  modal.value = m;
}

/** Закончить сессию и вернуться в меню (в киоске — на заставку). */
export function closeAll() {
  const mode = state.value.mode;
  if (state.value.ended) clearGame(mode);
  resetSession();
  screen.value = kiosk.value ? 'attract' : 'title';
}
