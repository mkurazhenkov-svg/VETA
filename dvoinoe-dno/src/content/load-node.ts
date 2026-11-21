// Загрузка и проверка контента в Node: используется плагином Vite (при сборке и в dev)
// и командой `pnpm validate`. Любая ошибка валидации или компиляции Ink валит сборку.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Compiler } from 'inkjs/compiler/Compiler';
import {
  SkillsFile, ToolsFile, PackagingFile, RulesFile, BridgeFile, ExhibitsFile, QrFile, CaseFile, FactsFile,
  EvidenceFile, TheoriesFile, SceneFile, DocumentFile, StringsFile, type Content,
} from './schemas.ts';
import type { z } from 'zod';

export class ContentError extends Error {}

function yamlFile<T extends z.ZodTypeAny>(path: string, schema: T): z.infer<T> {
  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(path, "utf8"));
  } catch (e) {
    throw new ContentError(`Ошибка YAML в ${path}: ${(e as Error).message}`);
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    const issues = res.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new ContentError(`Ошибка в ${path}:\n${issues}`);
  }
  return res.data;
}

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(ext)).sort().map((f) => join(dir, f));
}

export function parseDocument(path: string) {
  const src = readFileSync(path, 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(src);
  if (!m) throw new ContentError(`Документ ${path}: нет заголовка ---`);
  const meta = parseYaml(m[1]) as Record<string, string>;
  return DocumentFile.parse({ id: meta.id ?? basename(path, '.md'), title: meta.title, old: m[2].trim() });
}

export function compileInk(dir: string): { json: string; knots: string[] } {
  const main = join(dir, 'main.ink');
  const src = readFileSync(main, 'utf8');
  const errors: string[] = [];
  const compiler = new Compiler(src, {
    fileHandler: {
      ResolveInkFilename: (name: string) => join(dir, name),
      LoadInkFileContents: (full: string) => readFileSync(full, 'utf8'),
    },
    errorHandler: (msg: string, type: number) => {
      if (type === 2) errors.push(msg); // 2 = Error
    },
  } as any);
  let story: any;
  try {
    story = compiler.Compile();
  } catch (e) {
    errors.push(String(e));
  }
  if (errors.length || !story) throw new ContentError(`Ошибка компиляции Ink:\n${errors.join('\n')}`);
  const knots = [...story.mainContentContainer.namedContent.keys()] as string[];
  return { json: story.ToJson(), knots };
}

export function loadContent(root: string): Content {
  const rules = join(root, 'rules');
  const museum = join(root, 'museum');
  const caseDir = join(root, 'cases', 'chetvertnye-1913');

  const scenes: Content['scenes'] = {};
  const scenesDir = join(caseDir, 'scenes');
  for (const d of readdirSync(scenesDir)) {
    const p = join(scenesDir, d, 'scene.json');
    if (statSync(join(scenesDir, d)).isDirectory() && existsSync(p)) {
      const res = SceneFile.safeParse(JSON.parse(readFileSync(p, 'utf8')));
      if (!res.success) throw new ContentError(`Ошибка в ${p}:\n${res.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')}`);
      scenes[res.data.id] = res.data;
    }
  }
  const documents: Content['documents'] = {};
  for (const f of listFiles(join(caseDir, 'documents'), '.md')) {
    const doc = parseDocument(f);
    documents[doc.id] = doc;
  }
  const ink = compileInk(join(caseDir, 'ink'));

  const content: Content = {
    case: yamlFile(join(caseDir, 'case.yaml'), CaseFile),
    facts: yamlFile(join(caseDir, 'facts.yaml'), FactsFile).facts,
    evidence: yamlFile(join(caseDir, 'evidence.yaml'), EvidenceFile).evidence,
    theories: yamlFile(join(caseDir, 'theories.yaml'), TheoriesFile).theories,
    skills: yamlFile(join(rules, 'skills.yaml'), SkillsFile),
    tools: yamlFile(join(rules, 'tools.yaml'), ToolsFile),
    packaging: yamlFile(join(rules, 'packaging.yaml'), PackagingFile),
    rules: yamlFile(join(rules, 'rules.yaml'), RulesFile),
    bridge: yamlFile(join(rules, 'bridge-today.yaml'), BridgeFile),
    exhibits: yamlFile(join(museum, 'exhibits.yaml'), ExhibitsFile),
    qr: yamlFile(join(museum, 'qr.yaml'), QrFile),
    strings: yamlFile(join(root, 'i18n', 'ru.yaml'), StringsFile),
    scenes,
    documents,
    ink: ink.json,
  };
  crossCheck(content, ink.knots);
  return content;
}

/** Перекрёстные ссылки: улики ↔ сцены, факты, версии, правила-карточки, экспонаты. */
export function crossCheck(c: Content, knots: string[]) {
  const errs: string[] = [];
  const factIds = new Set(c.facts.map((f) => f.id));
  const evIds = new Set(c.evidence.map((e) => e.id));
  const thIds = new Set(c.theories.map((t) => t.id));
  const bridgeIds = new Set(c.bridge.cards.map((b) => b.id));
  const exhibitIds = new Set(c.exhibits.exhibits.map((e) => e.id));
  const methodIds = new Set(c.packaging.methods.map((m) => m.id));
  const packIds = new Set(c.packaging.packs.map((m) => m.id));
  const personIds = new Set(c.case.persons.map((p) => p.id));
  const locIds = new Set(c.case.locations.map((l) => l.id));
  const dup = (arr: string[], what: string) => {
    const s = new Set<string>();
    for (const a of arr) { if (s.has(a)) errs.push(`Повтор ${what}: ${a}`); s.add(a); }
  };
  dup(c.facts.map((f) => f.id), 'факта');
  dup(c.evidence.map((e) => e.id), 'улики');

  for (const e of c.evidence) {
    const loc = c.case.locations.find((l) => l.id === e.location);
    if (!loc) { errs.push(`Улика ${e.id}: нет локации ${e.location}`); continue; }
    const scene = loc.scene ? c.scenes[loc.scene] : undefined;
    if (!scene) { errs.push(`Улика ${e.id}: у локации нет сцены`); continue; }
    if (!scene.hotspots.some((h) => h.id === e.hotspot)) errs.push(`Улика ${e.id}: нет хотспота ${e.hotspot} в сцене ${scene.id}`);
    if (!scene.sectors.some((s) => s.id === e.sector)) errs.push(`Улика ${e.id}: нет сектора ${e.sector}`);
    for (const f of [...e.facts, ...(e.lupa?.fact ? [e.lupa.fact] : []), ...Object.values(e.byVariant ?? {}).flatMap((v) => [...(v.facts ?? []), ...(v.lupaFact ? [v.lupaFact] : [])])])
      if (!factIds.has(f)) errs.push(`Улика ${e.id}: нет факта ${f}`);
    for (const r of e.reveals) if (!evIds.has(r)) errs.push(`Улика ${e.id}: reveals → нет улики ${r}`);
    if (e.visibility.parent && !evIds.has(e.visibility.parent)) errs.push(`Улика ${e.id}: нет родителя ${e.visibility.parent}`);
    for (const m of e.collection.methods) if (!methodIds.has(m)) errs.push(`Улика ${e.id}: нет способа изъятия ${m}`);
    for (const p of e.collection.packs) if (!packIds.has(p)) errs.push(`Улика ${e.id}: нет упаковки ${p}`);
    for (const t of [...e.supports, ...e.contradicts]) if (!thIds.has(t)) errs.push(`Улика ${e.id}: нет версии ${t}`);
    if (e.museum.exhibit && !exhibitIds.has(e.museum.exhibit)) errs.push(`Улика ${e.id}: нет экспоната ${e.museum.exhibit}`);
    if (e.visibility.via === 'lamp' && !scene.hidden.some((h) => h.id === e.id)) errs.push(`Улика ${e.id}: видна только под лампой, но нет в hidden сцены`);
  }
  for (const f of c.facts) for (const x of f.infer ?? []) if (!factIds.has(x)) errs.push(`Факт ${f.id}: вывод из неизвестного ${x}`);
  for (const t of c.theories) for (const f of [...t.revealedBy, ...t.supports, ...t.contradicts]) if (!factIds.has(f)) errs.push(`Версия ${t.id}: нет факта ${f}`);
  for (const r of c.rules.rules) if (!bridgeIds.has(r.bridgeToday)) errs.push(`Правило ${r.id}: нет карточки ${r.bridgeToday}`);
  for (const v of c.case.variants) {
    for (const p of Object.keys(v.roles)) if (!personIds.has(p)) errs.push(`Вариант ${v.id}: нет персонажа ${p}`);
    for (const [p, groups] of Object.entries(v.proofs)) {
      if (!personIds.has(p)) errs.push(`Вариант ${v.id}: доказательства для неизвестного ${p}`);
      for (const g of groups) for (const f of g) if (!factIds.has(f)) errs.push(`Вариант ${v.id}: нет факта ${f}`);
    }
    for (const f of v.workshopLink) if (!factIds.has(f)) errs.push(`Вариант ${v.id}: нет факта ${f}`);
  }
  for (const q of c.qr.codes) {
    if (!c.documents[q.document]) errs.push(`QR ${q.code}: нет документа ${q.document}`);
    if (q.fact && !factIds.has(q.fact)) errs.push(`QR ${q.code}: нет факта ${q.fact}`);
  }
  for (const o of c.case.examination.objects) if (!evIds.has(o.evidence)) errs.push(`Экспертиза: нет улики ${o.evidence}`);
  for (const s of c.case.exhibitFinale.signs) for (const e of s.evidence) if (!evIds.has(e)) errs.push(`Финал: нет улики ${e}`);
  if (!factIds.has(c.case.telegram.steamerFact)) errs.push('Телеграмма: нет факта парохода');
  for (const l of c.case.locations) {
    if (l.scene && !c.scenes[l.scene]) errs.push(`Локация ${l.id}: нет сцены ${l.scene}`);
    if (l.enterKnot && !knots.includes(l.enterKnot)) errs.push(`Локация ${l.id}: нет узла Ink ${l.enterKnot}`);
    if (l.requiresFact && !factIds.has(l.requiresFact)) errs.push(`Локация ${l.id}: нет факта ${l.requiresFact}`);
  }
  for (const s of Object.values(c.scenes)) {
    for (const n of s.npcs) if (!knots.includes(n.knot)) errs.push(`Сцена ${s.id}: нет узла Ink ${n.knot}`);
    for (const x of s.exits) if (!locIds.has(x.to) && x.to !== 'map') errs.push(`Сцена ${s.id}: выход в неизвестную локацию ${x.to}`);
    const props = new Set(s.props.map((p) => p.id));
    for (const h of s.hotspots) {
      if (h.prop && !props.has(h.prop)) errs.push(`Сцена ${s.id}: хотспот ${h.id} → нет предмета ${h.prop}`);
      if (h.knot && !knots.includes(h.knot)) errs.push(`Сцена ${s.id}: хотспот ${h.id} → нет узла Ink ${h.knot}`);
    }
  }
  if (errs.length) throw new ContentError(`Перекрёстная проверка контента:\n  - ${errs.join('\n  - ')}`);
}
