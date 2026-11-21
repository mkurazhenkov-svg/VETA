// Движок процедурных и тактических правил. Правила (тексты, веса, тяжесть) — в content/rules/rules.yaml,
// здесь — только реестр функций проверки, на которые они ссылаются полем `check`.
import type { Content, Rule } from '../content/schemas';
import type { GameEvent, EventOf } from './events';
import type { GameState } from './state';
import { activeEvidence, evidenceDef, sceneOf } from './queries';
import { findConclusions } from './protocol-check';

export interface Violation {
  rule: string;
  t: number;
  ref?: string;
  detail?: string;
}
export interface RuleViolation extends Violation {
  def: Rule;
}

interface Ctx {
  state: GameState;
  journal: GameEvent[];
  content: Content;
  params: Record<string, string>;
}

const of = <T extends GameEvent['type']>(j: GameEvent[], type: T) => j.filter((e): e is EventOf<T> => e.type === type);

/** Локации, где идёт осмотр с понятыми (на сцене за следователем ходят понятые). */
function inspectionLocs(content: Content): Set<string> {
  return new Set(content.case.locations.filter((l) => l.scene && content.scenes[l.scene]?.followers).map((l) => l.id));
}

function admissibleCount(content: Content, ids: string[]) {
  return ids.filter((id) => {
    const p = content.case.persons.find((x) => x.id === id);
    return p?.witnessCandidate && p.witnessCandidate.admissible !== 'no';
  }).length;
}

function locOf(content: Content, evId: string) {
  return evidenceDef(content, evId)?.location ?? '';
}

export const CHECKS: Record<string, (c: Ctx) => Violation[]> = {
  attestingWitnessesPresentOnCollect: ({ journal, content }) => {
    const locs = inspectionLocs(content);
    return of(journal, 'evidence.packaged')
      .filter((e) => locs.has(locOf(content, e.id)) && admissibleCount(content, e.signedBy) < 2)
      .map((e) => ({ rule: '', t: e.t, ref: e.id }));
  },
  inspectionWithoutWitnesses: ({ journal, content }) => {
    const locs = inspectionLocs(content);
    const first = of(journal, 'evidence.examined').find((e) => locs.has(locOf(content, e.id)) && e.witnesses.length === 0);
    return first ? [{ rule: '', t: first.t, ref: first.id }] : [];
  },
  actionsWithOneWitness: ({ journal, content }) => {
    const locs = inspectionLocs(content);
    const ex = of(journal, 'evidence.examined').filter((e) => locs.has(locOf(content, e.id)) && e.witnesses.length === 1);
    return ex.length ? [{ rule: '', t: ex[0].t, ref: ex[0].id, detail: String(ex.length) }] : [];
  },
  witnessInadmissible: ({ state, content }) =>
    state.witnesses.chosen
      .filter((id) => content.case.persons.find((p) => p.id === id)?.witnessCandidate?.admissible === 'no')
      .map((id) => ({ rule: '', t: 0, ref: id })),
  witnessQuestionable: ({ state, content }) =>
    state.witnesses.chosen
      .filter((id) => content.case.persons.find((p) => p.id === id)?.witnessCandidate?.admissible === 'questionable')
      .map((id) => ({ rule: '', t: 0, ref: id })),
  collectedWithoutDescription: ({ journal }) =>
    of(journal, 'evidence.packaged')
      .filter((e) => !e.described)
      .map((e) => ({ rule: '', t: e.t, ref: e.id })),
  touchedBeforeFix: ({ journal }) => {
    const seen = new Set<string>();
    const out: Violation[] = [];
    for (const e of journal) {
      if ((e.type === 'evidence.touched' || e.type === 'evidence.picked_up') && !e.fixed && !seen.has(e.id)) {
        seen.add(e.id);
        out.push({ rule: '', t: e.t, ref: e.id });
      }
    }
    return out;
  },
  generalBeforeDetail: ({ state, content }) =>
    Object.keys(state.steppedInBeforeGeneral)
      .filter((l) => state.steppedInBeforeGeneral[l] && sceneOf(content, l)?.threshold)
      .map((l) => ({ rule: '', t: 0, ref: l })),
  noOrientingFirst: ({ journal, params }) => {
    const loc = params.loc ?? 'cellar';
    const photos = of(journal, 'photo.taken').filter((p) => p.loc === loc);
    if (!photos.length) return [];
    const firstGeneral = photos.findIndex((p) => p.kind === 'orienting' || p.kind === 'overview');
    const firstDetail = photos.findIndex((p) => p.kind === 'node' || p.kind === 'detail');
    if (firstDetail >= 0 && (firstGeneral < 0 || firstGeneral > firstDetail)) return [{ rule: '', t: photos[firstDetail].t, ref: loc }];
    return [];
  },
  sectorsSkipped: ({ state, content, params }) => {
    const loc = params.loc ?? 'cellar';
    if (!state.visited.includes(loc)) return [];
    const scene = sceneOf(content, loc);
    if (!scene) return [];
    const looked = new Set([...(state.sectorsLooked[loc] ?? []), ...(state.sectorsVisited[loc] ?? [])]);
    const missing = scene.sectors.filter((s) => !looked.has(s.id)).map((s) => s.title);
    return missing.length ? [{ rule: '', t: 0, ref: loc, detail: missing.join(', ') }] : [];
  },
  dialogueTag: ({ journal, params }) => {
    const tag = params.tag;
    const max = Number(params.max ?? 99);
    return of(journal, 'dialogue.choice')
      .filter((e) => e.tags.includes(tag))
      .slice(0, max)
      .map((e) => ({ rule: '', t: e.t, ref: e.npc, detail: e.text }));
  },
  unsealedPackage: ({ journal }) =>
    of(journal, 'evidence.packaged')
      .filter((e) => !e.sealed)
      .map((e) => ({ rule: '', t: e.t, ref: e.id })),
  keyEvidenceDestroyed: ({ state, content }) =>
    activeEvidence(state, content)
      .filter((e) => e.key && state.evidence[e.id]?.condition === 'destroyed')
      .map((e) => ({ rule: '', t: 0, ref: e.id })),
  evidenceDamaged: ({ state, content }) =>
    activeEvidence(state, content)
      .filter((e) => state.evidence[e.id]?.condition === 'degraded' || (!e.key && state.evidence[e.id]?.condition === 'destroyed'))
      .map((e) => ({ rule: '', t: 0, ref: e.id, detail: state.evidence[e.id].condition })),
  factNotEstablished: ({ state, params }) => {
    if (!state.ended && !state.folder) return [];
    if (params.requiresVisit && !state.visited.includes(params.requiresVisit)) return [];
    return state.facts[params.fact] ? [] : [{ rule: '', t: 0, ref: params.fact }];
  },
  detailWithoutScale: ({ journal }) => {
    const p = of(journal, 'photo.taken').find((e) => e.kind === 'detail' && !e.scale);
    return p ? [{ rule: '', t: p.t, ref: p.target }] : [];
  },
  falseTracesNotSeparated: ({ state, content }) =>
    activeEvidence(state, content)
      .filter((e) => e.kind === 'false_trace' && state.evidence[e.id]?.detected && !state.evidence[e.id]?.originCorrect)
      .map((e) => ({ rule: '', t: 0, ref: e.id })),
  conclusionsInProtocol: ({ state, content }) => {
    if (!state.folder) return [];
    const hits = findConclusions(state.folder.protocol.extra, content.rules.protocolConclusionWords);
    return hits.length ? [{ rule: '', t: 0, detail: hits.join(', ') }] : [];
  },
  collectedNotInProtocol: ({ state }) => {
    if (!state.folder) return [];
    const inc = new Set(state.folder.protocol.include);
    return Object.entries(state.evidence)
      .filter(([id, e]) => e.collected && !inc.has(id))
      .map(([id]) => ({ rule: '', t: 0, ref: id }));
  },
};

export function evaluateRules(state: GameState, journal: GameEvent[], content: Content): RuleViolation[] {
  if (state.mode !== 'practicum') return [];
  const out: RuleViolation[] = [];
  for (const def of content.rules.rules) {
    const fn = CHECKS[def.check];
    if (!fn) throw new Error(`Нет функции проверки ${def.check} для правила ${def.id}`);
    for (const v of fn({ state, journal, content, params: def.params ?? {} })) out.push({ ...v, rule: def.id, def });
  }
  return out;
}
