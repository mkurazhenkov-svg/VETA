// Чтение состояния: удобные запросы для команд, правил, оценки и UI.
import type { Content, Evidence, SceneDef } from '../content/schemas';
import { documentationStatus } from './photo-judge';
import type { GameState } from './state';

export function locationDef(content: Content, id: string | null) {
  return content.case.locations.find((l) => l.id === id) ?? null;
}

export function sceneOf(content: Content, loc: string | null): SceneDef | null {
  const l = locationDef(content, loc);
  return l?.scene ? content.scenes[l.scene] ?? null : null;
}

export function evidenceDef(content: Content, id: string): Evidence | undefined {
  return content.evidence.find((e) => e.id === id);
}

/** Улики, существующие в выбранном варианте истины. */
export function activeEvidence(state: GameState, content: Content, loc?: string): Evidence[] {
  return content.evidence.filter((e) => e.variants.includes(state.settings.variant) && (!loc || e.location === loc));
}

export function platesLimit(state: GameState, content: Content, loc: string): number {
  const l = locationDef(content, loc);
  if (!l) return 0;
  if (state.settings.platesOverride != null && l.plates > 0) return loc === 'cellar' ? state.settings.platesOverride : l.plates;
  return l.plates;
}

export function platesLeft(state: GameState, content: Content, loc: string): number {
  return Math.max(0, platesLimit(state, content, loc) - (state.platesUsed[loc] ?? 0));
}

export function hasOkPhoto(state: GameState, id: string) {
  return state.photos.some((p) => p.target === id && p.ok && p.inSitu);
}

/** Улика «зафиксирована»: описана, и (если требует съёмки) есть хороший снимок на месте. */
export function isFixed(state: GameState, content: Content, id: string): boolean {
  const ev = evidenceDef(content, id);
  const e = state.evidence[id];
  if (!ev || !e) return false;
  if (!e.examined) return false;
  if (ev.documentation.required.length === 0) return true;
  return hasOkPhoto(state, id);
}

export function docStatus(state: GameState, content: Content, id: string) {
  const ev = evidenceDef(content, id);
  return documentationStatus(state, id, ev?.documentation.required ?? []);
}

export function personName(content: Content, id: string) {
  return content.case.persons.find((p) => p.id === id)?.name ?? id;
}

export function admissibleWitnesses(state: GameState, content: Content, ids = state.witnesses.present) {
  return ids.filter((id) => {
    const p = content.case.persons.find((x) => x.id === id);
    return p?.witnessCandidate && p.witnessCandidate.admissible !== 'no';
  });
}

export function factDef(content: Content, id: string) {
  return content.facts.find((f) => f.id === id);
}

export function variantDef(state: GameState, content: Content) {
  return content.case.variants.find((v) => v.id === state.settings.variant)!;
}

export function knows(state: GameState, id: string) {
  return !!state.facts[id];
}

export function evidenceDescribe(state: GameState, ev: Evidence): string {
  return ev.byVariant?.[state.settings.variant]?.describe ?? ev.describe;
}

export function evidenceFacts(state: GameState, ev: Evidence): string[] {
  return ev.byVariant?.[state.settings.variant]?.facts ?? ev.facts;
}

export function evidenceLupa(state: GameState, ev: Evidence): string | undefined {
  return ev.byVariant?.[state.settings.variant]?.lupa ?? ev.lupa?.text;
}

export function factText(state: GameState, content: Content, id: string): string {
  const f = content.facts.find((x) => x.id === id);
  if (!f) return id;
  return f.textByVariant?.[state.settings.variant] ?? f.text;
}
