// Движок правил и итоговая оценка. Всё считается только по журналу событий.
import { initialState, reduce } from './store.js';

const ZONE_ORDER = { landing: 0, hall: 1, bath: 2, kitchen: 3, room: 4, balcony: 5 };
const KIND_RANK = { orienting: 0, overview: 1, node: 2, detail: 3 };

export function evaluate(log, C) {
  const V = [];
  const once = new Set();
  const add = (ruleId, ev, extra = {}) => {
    const key = extra.onceKey;
    if (key) { if (once.has(key)) return; once.add(key); }
    V.push({ ruleId, t: ev?.t ?? 0, ...extra, ...C.RULES[ruleId] });
  };
  const E = Object.fromEntries(C.EVIDENCE.map((e) => [e.id, e]));
  let s = initialState(C);
  let entryT = null;
  let endT = 0;

  for (const ev of log) {
    const p = s; // состояние до события
    switch (ev.type) {
      case 'player.zone':
        if (!p.entered && C.APARTMENT_ZONES.includes(ev.zone)) {
          entryT = ev.t;
          const basis = C.DWELLING_BASIS.find((b) => b.id === p.decisions.basis);
          if (!basis || !basis.ok) add('R_BASIS', ev, { detail: basis ? `Выбрано: «${basis.label}»` : 'Основание не выбрано' });
          if (p.decisions.witnesses !== 'yes' && !p.video.on) add('R_NO_FIXATION', ev, { detail: 'На момент входа: понятых нет, видеозапись не ведётся' });
          if (!p.ppe.gloves || !p.ppe.shoecovers) add('R_NO_PPE', ev, { detail: [!p.ppe.gloves && 'без перчаток', !p.ppe.shoecovers && 'без бахил'].filter(Boolean).join(', ') });
          if (p.decisions.dutyGuard !== 'yes' && p.decisions.guard !== 'yes') add('R_NO_GUARD', ev, { onceKey: 'guard' });
        }
        break;
      case 'scene.event':
        if (ev.key === 'neighbor_intruded') add('R_NO_GUARD', ev, { onceKey: 'guard', detail: 'Соседка зашла в прихожую «посмотреть»' });
        break;
      case 'player.stepped': {
        const fz = C.FRAGILE_ZONES.find((z) => z.id === ev.zone);
        const victims = fz.evidence.filter((id) => !p.evidence[id].collected && !p.evidence[id].damaged);
        if (victims.length) add('R_FRAGILE', ev, { evidence: victims[0], detail: victims.map((id) => E[id].title).join(', ') });
        break;
      }
      case 'door.opened': {
        const st = p.evidence.ev10_prints;
        if (!st.collected && !st.photos.detail) add('R_DOOR_PRINTS', ev, { evidence: 'ev10_prints' });
        break;
      }
      case 'evidence.touched':
        if (!ev.gloves) add('R_NO_GLOVES', ev, { evidence: ev.id, detail: E[ev.id].title });
        break;
      case 'evidence.flagged':
        if (E[ev.id].kind !== 'false') add('R_FALSE_FLAG', ev, { evidence: ev.id, detail: E[ev.id].title });
        break;
      case 'powder.applied': {
        const st = p.evidence[ev.id];
        if (!st.photos.detail) add('R_POWDER_BEFORE_PHOTO', ev, { evidence: ev.id });
        if (ev.result === 'none') add('R_WRONG_POWDER', ev, { evidence: ev.id, detail: `${ev.powderName} на поверхности «${C.SURFACES[E[ev.id].surface]?.name}»` });
        break;
      }
      case 'evidence.collected': {
        const e = E[ev.id];
        const st = p.evidence[ev.id];
        const m = e.collect.methods.find((x) => x.id === ev.method);
        const ph = st.photos;
        if (!ev.noTouch && !(ph.overview || ph.node || ph.detail)) add('R_TOUCH_BEFORE_PHOTO', ev, { evidence: ev.id, detail: e.title });
        if (!ev.noTouch && !ev.gloves) add('R_NO_GLOVES', ev, { evidence: ev.id, detail: e.title });
        if (m && !m.ok) add('R_BAD_METHOD', ev, { evidence: ev.id, detail: `${e.title}: ${m.why}` });
        if (!ev.noTouch) {
          if (ev.pack && e.collect.packs[ev.pack] === false) add('R_PACKAGING', ev, { evidence: ev.id, detail: `${e.title}: ${C.PACKS[ev.pack].label}. ${e.collect.packWhy}` });
          else if (m?.wet) add('R_PACKAGING', ev, { evidence: ev.id, detail: `${e.title}: упакован влажным — объект деградирует` });
          const L = ev.label ?? {};
          const missing = ['what', 'where', 'when', 'kusp', 'sign', 'seal'].filter((k) => !L[k]);
          if (missing.length) add('R_LABEL', ev, { evidence: ev.id, detail: `${e.title}: не указано — ${missing.length} реквизит(а)` });
        }
        if (p.decisions.witnesses !== 'yes' && !p.video.on) add('R_VIDEO_GAP', ev, { evidence: ev.id, detail: e.title });
        if (e.dna && p.glovePairDna && p.glovePairDna !== ev.id) add('R_CROSS_DNA', ev, { evidence: ev.id, detail: `${E[p.glovePairDna].title} → ${e.title}` });
        if (m?.needsPowder && !st.photoAfterPowder) add('R_LIFT_BEFORE_PHOTO', ev, { evidence: ev.id });
        break;
      }
      case 'dialogue.choice':
      case 'dialogue.present': {
        const npc = C.NPCS[ev.npc];
        const ns = p.npcs[ev.npc];
        if (ns.closed) break;
        const tags = ev.type === 'dialogue.present' ? ['present'] : npc.choices.find((c) => c.id === ev.choice)?.tags ?? [];
        const q = tags.some((t) => ['open', 'clarify', 'control', 'present', 'leading'].includes(t));
        if (npc.requiresRights && !ns.rights && q) add('R_RIGHTS', ev, { onceKey: 'rights_' + ev.npc, detail: npc.name });
        if (tags.includes('leading')) add('R_LEADING', ev, { detail: npc.name });
        if (tags.includes('pressure')) add('R_PRESSURE', ev, { detail: npc.name });
        if (tags.includes('threat')) add('R_THREAT', ev, { detail: npc.name });
        if (tags.includes('seize')) add('R_SEIZE_SHOES', ev);
        break;
      }
      default:
        break;
    }
    s = reduce(s, ev, C);
    endT = Math.max(endT, ev.t ?? 0);
  }

  const final = s;
  const doc = final.protocol;

  // Итоговые проверки
  if (!(final.facts.includes('f_officer_route') && final.facts.includes('f_officer_bath'))) add('R_CHANGES_UNKNOWN', { t: endT });
  if (final.entered && final.decisions.witnesses !== 'yes' && final.decisions.intro !== 'yes') add('R_NO_INTRO', { t: endT });

  const proto = checkProtocol(final, doc, C, add, endT);

  // ---------- Баллы ----------
  const W = C.SCORE.weights;
  const pen = { procedure: 0, completeness: 0, photo: 0, interview: 0, protocol: 0 };
  for (const v of V) pen[C.SCORE.categoryTo[v.category]] += v.penalty;

  const relevant = C.EVIDENCE.filter((e) => e.kind !== 'false');
  let got = 0, tot = 0;
  const evStatus = {};
  for (const e of relevant) {
    const st = final.evidence[e.id];
    let val = 0;
    let status = 'missed';
    if (st.damaged) { val = 0.1; status = 'damaged'; }
    else if (e.mustCollect) {
      const m = st.collected && e.collect.methods.find((x) => x.id === st.collected.method);
      if (m && m.ok && !m.partial && !st.contaminated && e.collect.packs[st.collected.pack] !== false && !m.wet) { val = 1; status = 'ok'; }
      else if (m && m.partial && st.photos.detail) { val = 0.6; status = 'partial'; }
      else if (st.collected) { val = 0.4; status = st.contaminated ? 'contaminated' : 'flawed'; }
      else if (st.detected && (st.inspected || Object.keys(st.photos).length)) { val = 0.3; status = 'found'; }
    } else {
      const documented = e.docRequired.some((k) => st.photos[k]);
      if (st.inspected && documented) { val = 1; status = 'ok'; }
      else if (st.inspected || documented) { val = 0.6; status = 'partial'; }
    }
    if (st.contaminated && val > 0.4) { val = 0.4; status = 'contaminated'; }
    evStatus[e.id] = status;
    got += e.weight * val;
    tot += e.weight;
  }
  const falses = C.EVIDENCE.filter((e) => e.kind === 'false');
  const falseOk = falses.filter((e) => final.evidence[e.id].flagged === e.origin).length;
  for (const e of falses) evStatus[e.id] = final.evidence[e.id].flagged === e.origin ? 'ok' : 'missed';
  const completeness = clamp((got / tot) * (W.completeness - 3) + (falseOk / falses.length) * 3 - pen.completeness, 0, W.completeness);

  // Фиксация
  let docSum = 0;
  for (const e of relevant) {
    const st = final.evidence[e.id];
    docSum += e.docRequired.filter((k) => st.photos[k]).length / e.docRequired.length;
  }
  const photosSorted = final.photos;
  const hasOrienting = photosSorted.some((ph) => ph.credits.some((c) => c.kind === 'orienting'));
  const firstOk = photosSorted.find((ph) => ph.ok);
  const generalFirst = firstOk && ['orienting', 'overview'].includes(firstOk.declaredKind);
  let videoPart = 0;
  if (final.decisions.witnesses === 'yes') videoPart = 1;
  else if (entryT !== null) {
    const ints = final.video.intervals.concat(final.video.on ? [[final.video.since, endT]] : []);
    const dur = Math.max(1, endT - entryT);
    const cov = ints.reduce((a, [x, y]) => a + Math.max(0, Math.min(y, endT) - Math.max(x, entryT)), 0) / dur;
    videoPart = clamp(cov / 0.8, 0, 1);
  }
  const photoScore = clamp((docSum / relevant.length) * 14 + (hasOrienting ? 2 : 0) + (generalFirst ? 2 : 0) + videoPart * 2 - pen.photo, 0, W.photo);

  // Опрос
  const choices = log.filter((ev) => ev.type === 'dialogue.choice').map((ev) => C.NPCS[ev.npc].choices.find((c) => c.id === ev.choice)).filter(Boolean);
  const qs = choices.filter((c) => !c.tags.includes('order'));
  const good = qs.filter((c) => c.tags.some((t) => ['open', 'clarify', 'control', 'rights'].includes(t))).length;
  const keyGot = C.KEY_INTERVIEW_FACTS.filter((f) => final.facts.includes(f)).length;
  const interview = qs.length ? clamp((keyGot / C.KEY_INTERVIEW_FACTS.length) * 9 + (good / qs.length) * 6 - pen.interview, 0, W.interview) : 0;

  const protocolScore = clamp(proto.score - pen.protocol, 0, W.protocol);
  const procedure = clamp(W.procedure - pen.procedure, 0, W.procedure);

  const scores = { procedure, completeness, photo: photoScore, interview, protocol: protocolScore };
  let total = Object.values(scores).reduce((a, b) => a + b, 0);
  let cap = null;
  const criticals = V.filter((v) => v.severity === 'critical');
  const majorsBy = {};
  for (const v of V) if (v.severity === 'major' && v.evidence) majorsBy[v.evidence] = (majorsBy[v.evidence] ?? 0) + 1;
  if (criticals.length) cap = C.SCORE.criticalCap;
  else if (Object.values(majorsBy).some((n) => n >= 2)) cap = C.SCORE.majorsOnOneEvidenceCap;
  if (cap !== null) total = Math.min(total, cap);
  total = Math.round(total);

  const hyp = C.HYPOTHESES.find((h) => h.id === doc?.hypothesis);
  let outcome;
  if (criticals.length) outcome = 'G';
  else if (!hyp?.correct) outcome = 'V';
  else if (total >= 75) outcome = 'A';
  else outcome = 'B';

  const grade = C.SCORE.grades.find((g) => total >= g.min).label;
  V.sort((a, b) => a.t - b.t);
  return { violations: V, scores, total, cap, outcome, grade, evStatus, proto, final, entryT, endT };
}

function checkProtocol(final, doc, C, add, endT) {
  const notes = [];
  if (!doc) return { score: 0, notes: ['Протокол не сдан'] };
  const E = Object.fromEntries(C.EVIDENCE.map((e) => [e.id, e]));
  const inDoc = new Set(doc.blocks.map((b) => b.evId));
  let score = 0;

  for (const [id, st] of Object.entries(final.evidence)) {
    if (st.collected && !st.collected.noTouch && !inDoc.has(id)) add('R_NOT_IN_PROTOCOL', { t: endT }, { evidence: id, detail: E[id].title });
  }
  for (const b of doc.blocks) if (b.wording === 'conclusion') add('R_CONCLUSION', { t: endT }, { detail: `«${E[b.evId].protocol.conclusion}»` });
  const text = (doc.freeText ?? '').toLowerCase();
  for (const w of C.CONCLUSION_WORDS) if (text.includes(w)) add('R_CONCLUSION', { t: endT }, { detail: `В дополнительных сведениях: «${w}…»` });

  const changesKnown = final.facts.some((f) => ['f_officer_route', 'f_officer_bath', 'f_medics_left'].includes(f));
  if (changesKnown && !doc.changesIncluded) add('R_CHANGES_NOT_IN_PROTOCOL', { t: endT });
  if (!doc.presented) add('R_NOT_PRESENTED', { t: endT });

  // Полнота описания: всё выявленное и значимое
  const detectedKey = C.EVIDENCE.filter((e) => e.kind !== 'false' && final.evidence[e.id].detected && (final.evidence[e.id].inspected || Object.keys(final.evidence[e.id].photos).length));
  const covered = detectedKey.filter((e) => inDoc.has(e.id)).length;
  const share = detectedKey.length ? covered / detectedKey.length : 0;
  score += share * 3;
  notes.push(`Описано ${covered} из ${detectedKey.length} выявленных значимых объектов`);
  // Порядок описания
  const ord = doc.blocks.map((b) => ZONE_ORDER[E[b.evId].zone] ?? 0);
  const ordered = ord.every((v, i) => i === 0 || v >= ord[i - 1]);
  if (ordered && doc.blocks.length) { score += 1; notes.push('Порядок описания последовательный — от входа вглубь'); }
  else notes.push('Порядок описания хаотичный: описывайте по ходу осмотра, от входа вглубь');
  // Привязки
  const needRefs = doc.blocks.filter((b) => E[b.evId].kind !== 'false');
  const withRefs = needRefs.filter((b) => final.evidence[b.evId].measured).length;
  if (needRefs.length) score += (withRefs / needRefs.length) * 1;
  notes.push(`Привязки к ориентирам: ${withRefs} из ${needRefs.length}`);
  // Фототаблица
  const kinds = (doc.photoOrder ?? []).map((pid) => final.photos.find((p) => p.photoId === pid)).filter(Boolean).map((p) => KIND_RANK[p.declaredKind]);
  const photoOrdered = kinds.length > 0 && kinds.every((v, i) => i === 0 || v >= kinds[i - 1]);
  if (photoOrdered) { score += 1; notes.push('Фототаблица упорядочена от общего к частному'); }
  else notes.push('Фототаблица не упорядочена от общего к частному');
  if (changesKnown && doc.changesIncluded) { score += 1; notes.push('Изменения обстановки до прибытия СОГ отражены'); }
  if (!doc.blocks.some((b) => b.wording === 'conclusion') && !C.CONCLUSION_WORDS.some((w) => text.includes(w))) { score += 1; notes.push('Выводов в описательной части нет'); }

  // Версии
  const hyp = C.HYPOTHESES.find((h) => h.id === doc.hypothesis);
  if (hyp?.correct) {
    score += 2;
    const chosen = doc.hypFacts ?? [];
    const valid = chosen.filter((f) => hyp.support.includes(f) && final.facts.includes(f)).length;
    const tainted = chosen.filter((f) => C.FACTS[f]?.tainted).length;
    score += clamp(valid / 5, 0, 1) * 2 - tainted * 0.5;
    notes.push(`Версия верная; обосновано фактами: ${valid}${tainted ? `, использованы «загрязнённые» показания: ${tainted}` : ''}`);
  } else notes.push(hyp ? 'Выбрана версия, которую опровергает обстановка' : 'Версия не сформулирована');

  // Экспертизы
  const collected = C.EVIDENCE.filter((e) => final.evidence[e.id].collected && !final.evidence[e.id].collected.noTouch);
  if (collected.length) {
    let ok = 0;
    for (const e of collected) {
      const chosen = doc.exams?.[e.id] ?? [];
      const right = chosen.filter((x) => e.exams.includes(x)).length;
      const wrong = chosen.length - right;
      ok += clamp((right - wrong * 0.5) / e.exams.length, 0, 1);
    }
    score += (ok / collected.length) * 3;
    notes.push(`Назначение исследований: ${Math.round((ok / collected.length) * 100)} % верно`);
  }
  return { score: clamp(score, 0, 15), notes };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const OUTCOMES = {
  A: { title: 'А — «Крепкий материал»', text: 'Версия инсценировки обоснована, ключевые следы изъяты допустимо, назначены нужные исследования.' },
  B: { title: 'Б — «Верная версия, слабая база»', text: 'Версия верна, но часть следов утрачена или изъята с нарушениями.' },
  V: { title: 'В — «Ложный след»', text: 'Вы пошли по версии, которую опровергает обстановка. Посмотрите, какие следы на это указывали.' },
  G: { title: 'Г — «Процессуальный провал»', text: 'Грубые нарушения закона: доказательства под угрозой признания недопустимыми.' },
};
