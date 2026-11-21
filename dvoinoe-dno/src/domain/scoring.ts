// Итоговая оценка «Практикума» (100 баллов, 5 критериев, потолки) и итог «Экспозиции».
// Считается только из журнала и состояния: броски на оценку не влияют.
import type { Content, Role } from '../content/schemas';
import type { GameEvent } from './events';
import type { GameState } from './state';
import { evaluateRules, type RuleViolation } from './rules-engine';
import { activeEvidence, docStatus, evidenceDef, variantDef } from './queries';
import { checkPlan, findConclusions } from './protocol-check';
import { parseClock } from './clock';

export type CriterionId = 'procedure' | 'evidence' | 'fixation' | 'interview' | 'folder';
export const CRITERIA_TITLES: Record<CriterionId, string> = {
  procedure: 'Процедура',
  evidence: 'Полнота и сохранность улик',
  fixation: 'Фиксация',
  interview: 'Опрос',
  folder: 'Папка дела и версии',
};

export interface CriterionScore {
  id: CriterionId;
  title: string;
  max: number;
  score: number;
  items: { text: string; value: number }[];
}

export type Outcome = 'A' | 'B' | 'V' | 'G';
/** Буквы исходов как в ТЗ: А, Б, В, Г. */
export const OUTCOME_LETTER: Record<Outcome, string> = { A: 'А', B: 'Б', V: 'В', G: 'Г' };
export const OUTCOME_TITLES: Record<Outcome, string> = {
  A: '«Дело для окружного суда»',
  B: '«Мастерская да, люди нет»',
  V: '«Ложный след»',
  G: '«Протокол опротестован»',
};

export interface PersonVerdict {
  id: string;
  truth: Role;
  accused: Role;
  proven: boolean;
}

export interface ScoreReport {
  criteria: CriterionScore[];
  raw: number;
  total: number;
  capped: boolean;
  grade: string;
  outcome: Outcome;
  violations: RuleViolation[];
  persons: PersonVerdict[];
  telegramInTime: boolean | null;
  workshopLinked: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

export function provenPersons(state: GameState, content: Content) {
  const v = variantDef(state, content);
  const res: Record<string, boolean> = {};
  for (const [p, groups] of Object.entries(v.proofs)) res[p] = groups.some((g) => g.every((f) => state.facts[f]));
  return res;
}

export function telegramInTime(state: GameState, content: Content): boolean | null {
  const v = variantDef(state, content);
  if (!v.fugitive) return null;
  const tg = state.telegram;
  if (!tg) return false;
  return tg.t <= parseClock(content.case.telegram.deadline) && tg.steamer && tg.destination === content.case.telegram.correctDestination;
}

export function scoreSession(state: GameState, journal: GameEvent[], content: Content): ScoreReport {
  const violations = evaluateRules(state, journal, content);
  const sc = content.rules.scoring;
  const penaltyFor = (crit: CriterionId) =>
    violations.filter((v) => v.def.criterion === crit).reduce((s, v) => s + sc.penalty[v.def.severity], 0);
  const variant = variantDef(state, content);
  const folder = state.folder;

  // --- Процедура ---
  const procPen = penaltyFor('procedure');
  const procedure: CriterionScore = {
    id: 'procedure',
    title: CRITERIA_TITLES.procedure,
    max: sc.max.procedure,
    score: clamp(sc.max.procedure - procPen, 0, sc.max.procedure),
    items: [{ text: 'Штрафы за нарушения процедуры', value: -procPen }],
  };

  // --- Полнота и сохранность ---
  const evs = activeEvidence(state, content).filter((e) => e.kind === 'evidence' && e.weight > 0);
  const totalW = evs.reduce((s, e) => s + e.weight, 0) || 1;
  const gotW = evs.reduce((s, e) => {
    const es = state.evidence[e.id];
    if (!es?.examined) return s;
    const k = es.condition === 'intact' ? 1 : es.condition === 'degraded' ? 0.5 : 0;
    return s + e.weight * k;
  }, 0);
  const falseTr = activeEvidence(state, content).filter((e) => e.kind === 'false_trace');
  const falseOk = falseTr.filter((e) => state.evidence[e.id]?.originCorrect).length;
  const cellarScene = content.scenes['cellar'];
  const looked = new Set([...(state.sectorsLooked['cellar'] ?? []), ...(state.sectorsVisited['cellar'] ?? [])]);
  const sectorRatio = cellarScene ? cellarScene.sectors.filter((s) => looked.has(s.id)).length / cellarScene.sectors.length : 0;
  const evPen = penaltyFor('evidence');
  const evItems = [
    { text: 'Найденные и сохранённые улики (по весам)', value: r1((gotW / totalW) * 19) },
    { text: 'Отделены ложные следы', value: r1(falseTr.length ? (falseOk / falseTr.length) * 3 : 3) },
    { text: 'Системный обход секторов подвала', value: r1(sectorRatio * 3) },
    { text: 'Штрафы', value: -evPen },
  ];
  const evidence: CriterionScore = {
    id: 'evidence',
    title: CRITERIA_TITLES.evidence,
    max: sc.max.evidence,
    score: clamp(r1(evItems.reduce((s, i) => s + i.value, 0)), 0, sc.max.evidence),
    items: evItems,
  };

  // --- Фиксация ---
  const docEvs = evs.filter((e) => e.documentation.required.length > 0 && (e.location === 'cellar' || e.location === 'yard'));
  const docCredit = docEvs.reduce((s, e) => {
    const st = docStatus(state, content, e.id);
    const es = state.evidence[e.id];
    if (st.complete) return s + 1;
    if (es.examined && (st.done.length > 0 || Object.keys(es.measured).length >= 2)) return s + 0.5;
    return s;
  }, 0);
  const evPhotos = state.photos.filter((p) => evidenceDef(content, p.target));
  const inSituRatio = evPhotos.length ? evPhotos.filter((p) => p.inSitu).length / evPhotos.length : 0;
  const general = (state.roomDescribed['cellar'] && !state.steppedInBeforeGeneral['cellar'] ? 2 : 0) +
    (state.photos.some((p) => p.loc === 'cellar' && p.ok && (p.kind === 'orienting' || p.kind === 'overview')) ? 1 : 0);
  const plan = checkPlan(state, content, 'cellar');
  const planRatio = plan.length ? plan.filter((p) => p.bound && p.placed && p.accurate).length / plan.length : 0;
  const details = state.photos.filter((p) => p.kind === 'detail');
  const scaleOk = details.length && details.every((p) => p.scale) ? 2 : 0;
  const fixPen = penaltyFor('fixation');
  const fixItems = [
    { text: 'Улики зафиксированы как требуется (снимки или описание с привязкой)', value: r1(docEvs.length ? (docCredit / docEvs.length) * 9 : 0) },
    { text: 'Снимки сделаны до изменения положения', value: r1(inSituRatio * 3) },
    { text: 'От общего к частному: описание с порога, обзорный снимок', value: general },
    { text: 'Привязки на плане восстанавливают место находки', value: r1(planRatio * 4) },
    { text: 'Масштаб на детальных снимках', value: scaleOk },
    { text: 'Штрафы', value: -fixPen },
  ];
  const fixation: CriterionScore = {
    id: 'fixation',
    title: CRITERIA_TITLES.fixation,
    max: sc.max.fixation,
    score: clamp(r1(fixItems.reduce((s, i) => s + i.value, 0)), 0, sc.max.fixation),
    items: fixItems,
  };

  // --- Опрос ---
  const keyFacts = content.facts.filter((f) => f.key && f.kind === 'testimony' && (!f.variants || f.variants.includes(state.settings.variant)));
  const kfCredit = keyFacts.reduce((s, f) => (state.facts[f.id] ? s + (state.facts[f.id].unreliable ? 0.5 : 1) : s), 0);
  let open = 0;
  let present = 0;
  for (const iv of Object.values(state.interview)) {
    open += (iv['open'] ?? 0) + (iv['clarify'] ?? 0);
    present += iv['present'] ?? 0;
  }
  const ivPen = penaltyFor('interview');
  const ivItems = [
    { text: 'Ключевые показания получены (ненадёжные — наполовину)', value: r1(keyFacts.length ? (kfCredit / keyFacts.length) * 9 : 0) },
    { text: 'Открытые и уточняющие вопросы, предъявление улик', value: r1(Math.min(6, open * 0.4 + present * 1)) },
    { text: 'Штрафы', value: -ivPen },
  ];
  const interview: CriterionScore = {
    id: 'interview',
    title: CRITERIA_TITLES.interview,
    max: sc.max.interview,
    score: clamp(r1(ivItems.reduce((s, i) => s + i.value, 0)), 0, sc.max.interview),
    items: ivItems,
  };

  // --- Папка дела и версии ---
  const proven = provenPersons(state, content);
  const persons: PersonVerdict[] = Object.entries(variant.roles).map(([id, truth]) => ({
    id,
    truth,
    accused: folder?.accusation[id] ?? 'none',
    proven: !!proven[id],
  }));
  let protocolPts = 0;
  let examPts = 0;
  let accPts = 0;
  let tgPts = 0;
  let thPts = 0;
  if (folder) {
    const inc = new Set(folder.protocol.include);
    const collected = Object.entries(state.evidence).filter(([, e]) => e.collected).map(([id]) => id);
    if (collected.length && collected.every((id) => inc.has(id))) protocolPts += 2;
    if (folder.protocol.extra.trim().length >= 40) protocolPts += 1;
    if (!findConclusions(folder.protocol.extra, content.rules.protocolConclusionWords).length) protocolPts += 1;
    if (plan.some((p) => p.placed)) protocolPts += 1;

    const objs = content.case.examination.objects.filter((o) => state.evidence[o.evidence]?.collected);
    const qs = content.case.examination.questions;
    const goodObjs = objs.filter((o) => {
      const sent = folder.examination.find((x) => x.evidence === o.evidence);
      if (!sent || !o.correct.includes(sent.addressee)) return false;
      const chosen = qs.filter((q) => sent.questions.includes(q.id));
      return chosen.some((q) => q.good && (q.for.includes(o.evidence) || q.for.includes('*'))) && !chosen.some((q) => !q.good);
    });
    examPts = objs.length ? (goodObjs.length / content.case.examination.objects.length) * 4 : 0;

    const guilty = persons.filter((p) => p.truth !== 'none');
    const right = guilty.filter((p) => p.accused === p.truth || (p.accused !== 'none' && p.truth === 'concealer' && p.accused === 'concealer')).length;
    const partly = guilty.filter((p) => p.accused !== 'none' && p.accused !== p.truth).length;
    const wrongAccused = Object.entries(folder.accusation).filter(([id, r]) => r !== 'none' && (variant.roles[id] ?? 'none') === 'none').length;
    accPts = clamp(((right + partly * 0.5 - wrongAccused) / Math.max(1, guilty.length)) * 4, 0, 4);

    const tg = telegramInTime(state, content);
    tgPts = tg === null ? 1 : tg ? 1 : 0;
    const handled = Object.values(state.theories).filter((s) => s === 'internalized' || s === 'discarded').length;
    const trueChosen = folder.theories.some((t) => content.theories.find((x) => x.id === t)?.trueIn.includes(state.settings.variant));
    thPts = trueChosen && handled >= 2 ? 1 : trueChosen ? 0.5 : 0;
  }
  const flPen = penaltyFor('folder');
  const flItems = [
    { text: 'Протокол: полнота, описательный язык, план', value: protocolPts },
    { text: 'Объекты, адресат и вопросы исследования', value: r1(examPts) },
    { text: 'Участники и их роли установлены верно', value: r1(accPts) },
    { text: 'Телеграмма о розыске', value: tgPts },
    { text: 'Версия обоснована, альтернативы проверены', value: thPts },
    { text: 'Штрафы', value: -flPen },
  ];
  const folderScore: CriterionScore = {
    id: 'folder',
    title: CRITERIA_TITLES.folder,
    max: sc.max.folder,
    score: clamp(r1(flItems.reduce((s, i) => s + i.value, 0)), 0, sc.max.folder),
    items: flItems,
  };

  const criteria = [procedure, evidence, fixation, interview, folderScore];
  const raw = Math.round(criteria.reduce((s, c) => s + c.score, 0));
  const critical = violations.some((v) => v.def.severity === 'critical');
  const total = critical ? Math.min(raw, sc.cap) : raw;
  const grade = [...sc.grades].sort((a, b) => b.min - a.min).find((g) => total >= g.min)?.title ?? 'неудовлетворительно';

  const workshopLinked = variant.workshopLink.filter((f) => state.facts[f]).length >= 2;
  const tgOk = telegramInTime(state, content);
  let outcome: Outcome;
  const makerOrg = persons.filter((p) => p.truth === 'maker' || p.truth === 'organizer');
  const falseMain = folder
    ? Object.entries(folder.accusation).some(([id, r]) => (r === 'maker' || r === 'organizer') && (variant.roles[id] ?? 'none') === 'none')
    : false;
  const realMakerMissed = makerOrg.some((p) => p.accused === 'none' || !p.proven);
  if (critical) outcome = 'G';
  else if (falseMain && realMakerMissed) outcome = 'V';
  else if (
    workshopLinked &&
    persons.filter((p) => p.truth !== 'none' && p.truth !== 'concealer' && p.truth !== 'patron').every((p) => p.accused === p.truth && p.proven) &&
    tgOk !== false &&
    total >= 75
  )
    outcome = 'A';
  else outcome = 'B';

  return { criteria, raw, total, capped: critical && raw > sc.cap, grade, outcome, violations, persons, telegramInTime: tgOk, workshopLinked };
}

export interface ExhibitReport {
  found: string[];
  missed: string[];
  total: number;
  signsCorrect: number;
  signsTotal: number;
  suspectsCorrect: boolean;
  twins: string[];
}

export function exhibitSummary(state: GameState, content: Content): ExhibitReport {
  const evs = activeEvidence(state, content, 'cellar').filter((e) => e.kind === 'evidence');
  const found = evs.filter((e) => state.evidence[e.id]?.examined).map((e) => e.id);
  const missed = evs.filter((e) => !state.evidence[e.id]?.examined).map((e) => e.id);
  const fin = state.exhibitFinale;
  const signs = content.case.exhibitFinale.signs;
  const signsCorrect = fin ? fin.signs.filter((s) => {
    const sign = signs.find((x) => x.id === s);
    return sign && sign.evidence.some((e) => found.includes(e));
  }).length : 0;
  const v = variantDef(state, content);
  const guilty = Object.entries(v.roles).filter(([, r]) => r !== 'none').map(([id]) => id);
  const sus = fin?.suspects ?? [];
  const suspectsCorrect = sus.length > 0 && sus.every((s) => guilty.includes(s));
  const twins = content.evidence.filter((e) => e.museum.exhibit && found.includes(e.id)).map((e) => e.id);
  return { found, missed, total: evs.length, signsCorrect, signsTotal: signs.length, suspectsCorrect, twins };
}
