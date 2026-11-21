// Команды: намерение игрока → события журнала. Решения принимает домен; сцена и UI сообщают только факты.
import type { Content, PhotoKind, SkillId, Role } from '../content/schemas';
import type { CaseFolder, GameEvent, Mode, Settings } from './events';
import { dist, hotspotPos, sectorAt, type Vec2 } from './geometry';
import { judgePhoto, photoTarget } from './photo-judge';
import { judgePackaging } from './packaging';
import { previewCheck, passiveOk } from './checks';
import { roll2d6 } from './rng';
import { parseClock } from './clock';
import { reduce, type GameState } from './state';
import {
  activeEvidence, evidenceDef, evidenceFacts, hasOkPhoto, isFixed, locationDef, platesLeft, sceneOf,
} from './queries';

export type Intent =
  | { type: 'start'; mode: Mode; settings: Settings; archetype: string; skills: Record<SkillId, number>; seed: number }
  | { type: 'travel'; to: string }
  | { type: 'move'; to: Vec2; sector: string | null; fragileHit?: string; threshold?: boolean }
  | { type: 'look' }
  | { type: 'describeRoom' }
  | { type: 'examine'; id: string; lupa?: boolean }
  | { type: 'search'; id: string }
  | { type: 'lamp'; on: boolean }
  | { type: 'lampReveal'; ids: string[] }
  | { type: 'tripod'; pos: Vec2 }
  | { type: 'photo'; target: string; kind: PhotoKind; scale: boolean; magnesium: boolean }
  | { type: 'measure'; target: string; landmark: string }
  | { type: 'touch'; id: string }
  | { type: 'pickUp'; id: string }
  | { type: 'collect'; id: string; method: string; pack: string; sealed: boolean }
  | { type: 'origin'; id: string; origin: string }
  | { type: 'note'; text: string; about?: string }
  | { type: 'witnesses'; chosen: string[]; reason?: string }
  | { type: 'check'; skill: SkillId; dc: number; key: string; repeatable: boolean; fact?: string }
  | { type: 'choice'; npc: string; knot: string; tags: string[]; text: string }
  | { type: 'fact'; id: string; source: string }
  | { type: 'trust'; npc: string; delta: number }
  | { type: 'spend'; minutes: number; reason: string }
  | { type: 'flag'; id: string; value: boolean | number | string }
  | { type: 'voice'; voice: SkillId; key: string; shortcut: boolean }
  | { type: 'theoryThink'; id: string }
  | { type: 'theoryDiscard'; id: string }
  | { type: 'qr'; code: string }
  | { type: 'telegram'; destination: string; steamer: boolean; description: string[]; text: string }
  | { type: 'plan'; id: string; pos: Vec2 }
  | { type: 'hint'; about: string }
  | { type: 'exhibitFinale'; signs: string[]; suspects: string[] }
  | { type: 'submit'; folder: CaseFolder };

export function cost(content: Content, key: string, fallback = 0): number {
  return content.case.costs[key] ?? fallback;
}

export function travelMinutes(content: Content, from: string | null, to: string): number {
  if (!from) return 0;
  const t = content.case.travel;
  return t[`${from}>${to}`] ?? t[`${to}>${from}`] ?? content.case.travelDefault;
}

export function canEnter(state: GameState, content: Content, loc: string): boolean {
  const l = locationDef(content, loc);
  if (!l) return false;
  if (l.requiresFact && !state.facts[l.requiresFact]) return false;
  return true;
}

/** Применяет намерение: возвращает события, которые нужно дописать в журнал (в порядке). */
export function perform(state: GameState, content: Content, intent: Intent): GameEvent[] {
  const out: GameEvent[] = [];
  let st = state;
  const emit = (e: GameEvent) => {
    out.push(e);
    st = reduce(st, e);
  };
  const now = () => st.clock;
  const loc = st.location;
  const scene = sceneOf(content, loc);
  const practicum = st.mode === 'practicum';

  const learn = (id: string, source: string) => {
    if (st.facts[id]) return;
    const f = content.facts.find((x) => x.id === id);
    if (!f) return;
    if (f.variants && !f.variants.includes(st.settings.variant)) return;
    const unreliable = f.kind === 'testimony' && st.flags[`contaminated_${source}`] === true;
    emit({ t: now(), type: 'fact.learned', id, source, unreliable });
  };

  switch (intent.type) {
    case 'start':
      emit({
        t: parseClock(content.case.startTime),
        type: 'session.started',
        mode: intent.mode,
        settings: intent.settings,
        seed: intent.seed,
        archetype: intent.archetype,
        skills: intent.skills,
      });
      return out; // без пост-обработки
    case 'travel': {
      if (!canEnter(st, content, intent.to)) return [];
      emit({ t: now(), dt: travelMinutes(content, loc, intent.to), type: 'location.entered', loc: intent.to, from: loc });
      const sc = sceneOf(content, intent.to);
      if (sc) emit({ t: now(), type: 'player.moved', loc: intent.to, to: sc.spawn, sector: sectorAt(sc, sc.spawn), threshold: sc.threshold ? true : undefined });
      break;
    }
    case 'move': {
      if (!loc) return [];
      emit({ t: now(), type: 'player.moved', loc, to: intent.to, sector: intent.sector, fragileHit: intent.fragileHit, threshold: intent.threshold });
      if (intent.fragileHit) {
        const ev = evidenceDef(content, intent.fragileHit);
        const es = st.evidence[intent.fragileHit];
        if (ev && es && !es.collected && ev.fragile.onWalk && es.condition === 'intact' && ev.variants.includes(st.settings.variant))
          emit({ t: now(), type: 'evidence.condition', id: ev.id, condition: ev.fragile.onWalk, reason: 'trampled' });
      }
      break;
    }
    case 'look': {
      if (!loc || !scene) return [];
      const sector = st.pos[loc] ? sectorAt(scene, st.pos[loc]) : null;
      emit({ t: now(), dt: cost(content, 'look', 3), type: 'scene.looked', loc, sector });
      for (const ev of activeEvidence(st, content, loc)) {
        if (ev.sector !== sector || st.evidence[ev.id]?.detected) continue;
        if (ev.visibility.via === 'look') emit({ t: now(), type: 'evidence.detected', id: ev.id, via: 'look' });
        else if (ev.visibility.via === 'search' && ev.visibility.check) {
          const { skill, dc } = ev.visibility.check;
          if (passiveOk(st, content, skill, dc)) {
            emit({ t: now(), type: 'voice.suggested', voice: skill, key: `notice:${ev.id}`, shortcut: false });
            emit({ t: now(), type: 'evidence.detected', id: ev.id, via: 'check' });
          }
        }
      }
      break;
    }
    case 'describeRoom':
      if (!loc) return [];
      emit({ t: now(), dt: cost(content, 'describeRoom', 5), type: 'room.described', loc });
      break;
    case 'examine': {
      const ev = evidenceDef(content, intent.id);
      if (!ev || !ev.variants.includes(st.settings.variant)) return [];
      const es = st.evidence[ev.id];
      if (!es.detected) {
        if (ev.visibility.via === 'look') emit({ t: now(), type: 'evidence.detected', id: ev.id, via: 'look' });
        else return []; // скрытое под лампой или внутри — сначала найти
      }
      const minutes = (ev.examineMinutes ?? cost(content, 'examine', 2)) + (intent.lupa ? cost(content, 'lupa', 3) : 0);
      emit({ t: now(), dt: minutes, type: 'evidence.examined', id: ev.id, lupa: !!intent.lupa, witnesses: st.witnesses.present });
      for (const f of evidenceFacts(st, ev)) learn(f, 'evidence');
      const lupaFact = ev.byVariant?.[st.settings.variant]?.lupaFact ?? ev.lupa?.fact;
      if (intent.lupa && lupaFact) learn(lupaFact, 'evidence');
      for (const childId of ev.reveals) {
        const child = evidenceDef(content, childId);
        if (child && child.visibility.via === 'inside' && child.variants.includes(st.settings.variant) && !st.evidence[childId].detected)
          emit({ t: now(), type: 'evidence.detected', id: childId, via: 'inside' });
      }
      ev.voices.forEach((v, i) => {
        if (v.variants && !v.variants.includes(st.settings.variant)) return;
        if (v.passive != null && !passiveOk(st, content, v.skill, v.passive)) return;
        emit({ t: now(), type: 'voice.suggested', voice: v.skill, key: `${ev.id}:${i}`, shortcut: !!v.shortcut });
      });
      break;
    }
    case 'search': {
      const ev = evidenceDef(content, intent.id);
      if (!ev) return [];
      emit({ t: now(), dt: ev.searchMinutes ?? cost(content, 'search', 10), type: 'evidence.searched', id: ev.id });
      for (const childId of ev.reveals) {
        const child = evidenceDef(content, childId);
        if (child && child.variants.includes(st.settings.variant) && !st.evidence[childId].detected)
          emit({ t: now(), type: 'evidence.detected', id: childId, via: 'search' });
      }
      break;
    }
    case 'lamp':
      emit({ t: now(), type: 'lamp.toggled', on: intent.on });
      break;
    case 'lampReveal':
      for (const id of intent.ids) {
        const ev = evidenceDef(content, id);
        if (ev && ev.location === loc && ev.visibility.via === 'lamp' && ev.variants.includes(st.settings.variant) && !st.evidence[id].detected)
          emit({ t: now(), dt: 1, type: 'evidence.detected', id, via: 'lamp' });
      }
      break;
    case 'tripod':
      if (!loc) return [];
      emit({ t: now(), dt: cost(content, 'tripod', 1), type: 'tripod.placed', loc, pos: intent.pos });
      break;
    case 'photo': {
      if (!loc || !scene) return [];
      if (!st.tripod || st.tripod.loc !== loc) {
        emit({ t: now(), type: 'photo.refused', target: intent.target, reason: 'no_tripod' });
        break;
      }
      if (platesLeft(st, content, loc) <= 0) {
        emit({ t: now(), type: 'photo.refused', target: intent.target, reason: 'no_plates' });
        break;
      }
      const target = photoTarget(content, scene, intent.target);
      if (!target) return [];
      const j = judgePhoto(st, content, scene, st.tripod.pos, target, intent.kind, intent.scale, intent.magnesium, now());
      if (j.refused) {
        emit({ t: now(), type: 'photo.refused', target: intent.target, reason: 'chemicals' });
        break;
      }
      const es = target.evidence ? st.evidence[target.evidence] : undefined;
      emit({
        t: now(),
        dt: cost(content, 'photo', 5) + (intent.magnesium ? cost(content, 'magnesium', 2) : 0),
        type: 'photo.taken',
        plate: (st.platesUsed[loc] ?? 0) + 1,
        loc,
        target: intent.target,
        kind: intent.kind,
        distanceArshin: j.distance,
        scale: intent.scale,
        magnesium: intent.magnesium,
        quality: j.quality,
        defects: j.defects,
        inSitu: !(es && (es.moved || es.collected)),
        witnesses: st.witnesses.present,
        tripod: st.tripod.pos,
      });
      break;
    }
    case 'measure': {
      if (!scene) return [];
      const ev = evidenceDef(content, intent.target);
      const lm = scene.landmarks.find((l) => l.id === intent.landmark);
      if (!ev || !lm) return [];
      const p = hotspotPos(scene, ev.hotspot);
      if (!p) return [];
      emit({ t: now(), dt: cost(content, 'measure', 2), type: 'measure.taken', target: ev.id, landmark: lm.id, arshin: Math.round(dist(p, lm.pos) * 16) / 16 });
      break;
    }
    case 'touch':
    case 'pickUp': {
      const ev = evidenceDef(content, intent.id);
      if (!ev) return [];
      const fixed = isFixed(st, content, ev.id);
      emit({ t: now(), dt: 1, type: intent.type === 'touch' ? 'evidence.touched' : 'evidence.picked_up', id: ev.id, fixed });
      if (!hasOkPhoto(st, ev.id) && ev.fragile.onTouchBeforePhoto)
        emit({ t: now(), type: 'evidence.condition', id: ev.id, condition: ev.fragile.onTouchBeforePhoto, reason: 'touched' });
      break;
    }
    case 'collect': {
      const ev = evidenceDef(content, intent.id);
      if (!ev || !ev.collection.collectable) return [];
      const es = st.evidence[ev.id];
      if (es.collected) return [];
      const fixed = isFixed(st, content, ev.id);
      if (!es.moved) {
        emit({ t: now(), type: 'evidence.picked_up', id: ev.id, fixed });
        // правильный способ изъятия бережёт даже несфотографированный предмет; нарушение порядка всё равно в журнале
        if (!hasOkPhoto(st, ev.id) && ev.fragile.onTouchBeforePhoto && !ev.collection.methods.includes(intent.method))
          emit({ t: now(), type: 'evidence.condition', id: ev.id, condition: ev.fragile.onTouchBeforePhoto, reason: 'touched' });
      }
      const r = judgePackaging(content, ev, intent.method, intent.pack);
      const minutes = intent.method === 'plaster_cast' ? cost(content, 'cast', 20) : cost(content, 'collect', 6);
      const signedBy = practicum ? st.witnesses.present : ['exhibit'];
      emit({
        t: now(),
        dt: minutes,
        type: 'evidence.packaged',
        id: ev.id,
        method: intent.method,
        pack: intent.pack,
        sealed: intent.sealed,
        signedBy,
        outcome: r.outcome,
        described: es.examined,
      });
      if (r.outcome !== 'intact') emit({ t: now(), type: 'evidence.condition', id: ev.id, condition: r.outcome, reason: 'packaging' });
      break;
    }
    case 'origin': {
      const ev = evidenceDef(content, intent.id);
      if (!ev?.origin) return [];
      emit({ t: now(), dt: cost(content, 'origin', 2), type: 'evidence.origin', id: ev.id, origin: intent.origin, correct: intent.origin === ev.origin.correct });
      break;
    }
    case 'note':
      emit({ t: now(), dt: cost(content, 'note', 1), type: 'note.written', text: intent.text, about: intent.about });
      break;
    case 'witnesses':
      emit({ t: now(), type: 'witnesses.changed', chosen: intent.chosen, present: intent.chosen, reason: intent.reason ?? 'chosen' });
      break;
    case 'check': {
      const p = previewCheck(st, content, intent.skill, intent.dc, intent.key, intent.repeatable, intent.fact);
      if (!p.available) return [];
      let dice: [number, number] = [0, 0];
      let ok: boolean;
      if (st.settings.noRandom) ok = p.value + 7 >= p.dc;
      else {
        dice = roll2d6(st.rng).dice;
        const [a, b] = dice;
        ok = (a === 6 && b === 6) || (!(a === 1 && b === 1) && a + b + p.value >= p.dc);
      }
      emit({ t: now(), dt: 1, type: 'check.rolled', skill: intent.skill, dc: p.dc, roll: dice, mod: p.value, ok, key: intent.key, repeatable: intent.repeatable, noRandom: st.settings.noRandom });
      if (ok && intent.fact) learn(intent.fact, 'check');
      break;
    }
    case 'choice': {
      const minTag = intent.tags.find((t) => t.startsWith('min:'));
      const dt = minTag ? Number(minTag.slice(4)) : cost(content, 'dialogue', 2);
      emit({ t: now(), dt, type: 'dialogue.choice', npc: intent.npc, knot: intent.knot, tags: intent.tags, text: intent.text });
      // наводящий вопрос, давление и угроза загрязняют показания: дальнейшие слова свидетеля ненадёжны
      if (['leading', 'pressure', 'threat'].some((t) => intent.tags.includes(t)) && !st.flags[`contaminated_${intent.npc}`])
        emit({ t: now(), type: 'flag.set', id: `contaminated_${intent.npc}`, value: true });
      break;
    }
    case 'fact':
      learn(intent.id, intent.source);
      break;
    case 'trust':
      emit({ t: now(), type: 'trust.changed', npc: intent.npc, delta: intent.delta });
      break;
    case 'spend':
      emit({ t: now(), dt: intent.minutes, type: 'time.spent', reason: intent.reason });
      break;
    case 'flag':
      emit({ t: now(), type: 'flag.set', id: intent.id, value: intent.value });
      break;
    case 'voice':
      emit({ t: now(), type: 'voice.suggested', voice: intent.voice, key: intent.key, shortcut: intent.shortcut });
      break;
    case 'theoryThink': {
      const th = content.theories.find((t) => t.id === intent.id);
      if (!th || st.theories[th.id] !== 'revealed') return [];
      emit({ t: now(), dt: th.thinkMinutes, type: 'theory.internalized', id: th.id });
      break;
    }
    case 'theoryDiscard':
      if (!st.theories[intent.id]) return [];
      emit({ t: now(), dt: 2, type: 'theory.discarded', id: intent.id });
      break;
    case 'qr': {
      const q = content.qr.codes.find((c) => c.code.toLowerCase() === intent.code.trim().toLowerCase());
      if (!q) return [];
      if (!st.qr.includes(q.code)) emit({ t: now(), type: 'museum.qr', code: q.code });
      if (q.fact) learn(q.fact, 'qr');
      break;
    }
    case 'telegram':
      if (st.telegram) return [];
      emit({ t: now(), dt: cost(content, 'telegram', 10), type: 'telegram.sent', destination: intent.destination, steamer: intent.steamer, description: intent.description, text: intent.text });
      break;
    case 'plan':
      emit({ t: now(), type: 'plan.marked', id: intent.id, pos: intent.pos });
      break;
    case 'hint':
      emit({ t: now(), type: 'hint.used', about: intent.about });
      break;
    case 'exhibitFinale':
      emit({ t: now(), type: 'exhibit.finale', signs: intent.signs, suspects: intent.suspects });
      return out;
    case 'submit':
      emit({ t: now(), type: 'folder.submitted', doc: intent.folder });
      return out;
  }

  // ---- пост-обработка: выводные факты, версии из фактов, события по часам ----
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of content.facts) {
      if (!f.infer || st.facts[f.id]) continue;
      if (f.variants && !f.variants.includes(st.settings.variant)) continue;
      if (f.infer.every((x) => st.facts[x])) {
        emit({ t: now(), type: 'fact.learned', id: f.id, source: 'inference', unreliable: false });
        grew = true;
      }
    }
  }
  for (const th of content.theories) {
    if (!st.theories[th.id] && th.revealedBy.some((f) => st.facts[f])) emit({ t: now(), type: 'theory.revealed', id: th.id });
  }
  if (st.mode === 'practicum' && st.settings.timePressure) {
    for (const tl of content.case.timeline) {
      if (st.timelineDone.includes(tl.id)) continue;
      if (tl.unlessFlag && st.flags[tl.unlessFlag]) continue;
      const at = tl.delayIfFlag && st.flags[tl.delayIfFlag.flag] ? parseClock(tl.delayIfFlag.at) : parseClock(tl.at);
      if (st.clock < at) continue;
      emit({ t: Math.max(at, 0), type: 'timeline.fired', id: tl.id, effect: tl.effect });
      for (const e of timelineEffect(st, content, tl.effect, at)) emit(e);
    }
  }
  return out;
}

/** Реестр последствий событий по часам. Имя эффекта задаётся в case.yaml: "имя" или "имя:параметр". */
export function timelineEffect(st: GameState, content: Content, effect: string, at: number): GameEvent[] {
  const [name, param] = effect.split(':');
  const out: GameEvent[] = [];
  switch (name) {
    case 'witness_leaves':
      if (st.witnesses.present.includes(param))
        out.push({ t: at, type: 'witnesses.changed', chosen: st.witnesses.chosen, present: st.witnesses.present.filter((w) => w !== param), reason: `left:${param}` });
      break;
    case 'rain':
      for (const ev of activeEvidence(st, content, param)) {
        const es = st.evidence[ev.id];
        if (!ev.materials.includes('soil_trace') || es.collected || es.condition === 'destroyed') continue;
        out.push({ t: at, type: 'evidence.condition', id: ev.id, condition: hasOkPhoto(st, ev.id) ? 'degraded' : 'destroyed', reason: 'rain' });
      }
      break;
    case 'flag':
      out.push({ t: at, type: 'flag.set', id: param, value: true });
      break;
  }
  return out;
}

export type { Role };
