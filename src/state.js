// Состояние партии и сохранение прогресса в браузере (localStorage).
// Если хранилище недоступно (приватный режим, запрет), игра работает без сохранения.
import { BALANCE } from './config.js';

// Девять документов дела: по три на уровень.
export const DOCS = [
  { id: 'act', level: 1 },
  { id: 'scheme', level: 1 },
  { id: 'journal', level: 1 },
  { id: 'contract', level: 2 },
  { id: 'ks2', level: 2 },
  { id: 'ks3', level: 2 },
  { id: 'letters', level: 3 },
  { id: 'photos', level: 3 },
  { id: 'notary', level: 3, bonus: true },
];

const KEY = 'veta-wolves-v1';
const mem = { sound: true, easy: false, best: 0, maxLevel: 0, saved: null };

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) Object.assign(mem, JSON.parse(raw));
  } catch {
    /* хранилище недоступно — работаем без него */
  }
}
function write() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    /* хранилище недоступно — работаем без него */
  }
}
read();

export const prefs = {
  get sound() {
    return mem.sound;
  },
  set sound(v) {
    mem.sound = !!v;
    write();
  },
  get easy() {
    return mem.easy;
  },
  set easy(v) {
    mem.easy = !!v;
    write();
  },
  get best() {
    return mem.best;
  },
  get savedRun() {
    return mem.saved && mem.saved.level > 1 ? mem.saved : null;
  },
  submitScore(score) {
    if (score > mem.best) {
      mem.best = score;
      write();
      return true;
    }
    return false;
  },
  saveRun(run) {
    mem.saved = clone(run);
    mem.maxLevel = Math.max(mem.maxLevel, run.level);
    write();
  },
  clearRun() {
    mem.saved = null;
    write();
  },
};

export function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

export function newRun() {
  return {
    easy: prefs.easy,
    level: 1,
    score: 0,
    docs: [], // собранные документы (id из DOCS)
    defects: [], // найденные дефекты (id объектов)
    wolves: [], // разоблачённые волки (id объектов)
    checkedSheep: [], // честные овцы, которых проверили лучом
    falseSusp: 0,
    levelTimeMs: 0,
    totalTimeMs: 0,
    totals: {}, // по уровням: сколько всего волков и дефектов
    bossNeed: BALANCE.bossNeed,
    bossDefeated: false,
  };
}

// Текущая партия. Создаётся при нажатии «Играть».
export const session = { run: newRun() };

export function docsOfLevel(run, level) {
  return run.docs.filter((id) => DOCS.find((d) => d.id === id)?.level === level).length;
}

export function maxHealth(run) {
  return run.easy ? BALANCE.healthEasy : BALANCE.health;
}
