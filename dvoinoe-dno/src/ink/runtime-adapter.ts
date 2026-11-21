// Адаптер Ink: истории читают и меняют состояние только через внешние функции → dispatch.
import { Story } from 'inkjs';
import { content } from '../content';
import type { SkillId } from '../content/schemas';
import { SKILLS } from '../content/schemas';
import { effectiveSkill, passiveOk, previewCheck } from '../domain/checks';
import { choices, dispatch, say, speaker, state, stripName, type Choice } from '../store/game';
import { hash } from '../scene/iso';

export function skillTitle(id: string) {
  return content.skills.skills.find((s) => s.id === id)?.title ?? id;
}

function parseTags(tags: string[] | null | undefined) {
  const out: Record<string, string> = {};
  const list: string[] = [];
  for (const raw of tags ?? []) {
    const t = raw.trim();
    list.push(t);
    const i = t.indexOf(':');
    if (i > 0) out[t.slice(0, i)] = t.slice(i + 1);
    else out[t] = '';
  }
  return { map: out, list };
}

export class InkRunner {
  story: Story;
  npc = '';
  knot = '';
  active = false;
  onUi: (cmd: string) => void = () => {};
  onEnd: () => void = () => {};

  constructor() {
    this.story = new Story(content.ink);
    this.bind();
  }

  private bind() {
    const s = this.story;
    const st = () => state.value;
    const bind = (name: string, fn: (...a: any[]) => any, safe = true) => s.BindExternalFunction(name, fn, safe);
    bind('fact', (id: string) => {
      dispatch({ type: 'fact', id, source: this.npc || 'ink' });
    }, false);
    bind('has', (id: string) => !!st().facts[id]);
    bind('skill', (id: string) => (SKILLS.includes(id as SkillId) ? effectiveSkill(st(), content, id as SkillId) : 0));
    bind('variant', () => st().settings.variant.replace('truth_', ''));
    bind('trust', (npc: string) => st().trust[npc] ?? 0);
    bind('add_trust', (npc: string, d: number) => {
      dispatch({ type: 'trust', npc, delta: d });
    }, false);
    bind('spend', (m: number) => {
      dispatch({ type: 'spend', minutes: m, reason: this.knot });
    }, false);
    bind('set_flag', (id: string) => {
      dispatch({ type: 'flag', id, value: true });
    }, false);
    bind('flag', (id: string) => !!st().flags[id]);
    bind('mode', () => st().mode);
    bind('examined', (ev: string) => !!st().evidence[ev]?.examined);
    bind('collected', (ev: string) => !!st().evidence[ev]?.collected);
    bind('condition', (ev: string) => st().evidence[ev]?.condition ?? 'intact');
    bind('clock', () => st().clock);
    bind('invite', (p: string) => {
      const w = st().witnesses;
      if (w.present.includes(p) || w.present.length >= 2) return;
      dispatch({ type: 'witnesses', chosen: [...w.present, p], reason: 'invited' });
    }, false);
    bind('dismiss', (p: string) => {
      const w = st().witnesses;
      dispatch({ type: 'witnesses', chosen: w.present.filter((x) => x !== p), reason: 'dismissed' });
    }, false);
    bind('is_witness', (p: string) => st().witnesses.present.includes(p));
    bind('witnesses_count', () => st().witnesses.present.length);
    bind('ui', (cmd: string) => {
      queueMicrotask(() => this.onUi(cmd));
    }, false);
  }

  saveState(): string {
    return this.story.state.toJson();
  }
  loadState(json: string) {
    try {
      this.story.state.LoadJson(json);
    } catch {
      /* несовместимое состояние — начнём с чистого */
    }
  }

  hasKnot(knot: string) {
    return !!this.story.mainContentContainer.namedContent.get(knot);
  }

  talk(knot: string, npc = '') {
    if (!this.hasKnot(knot)) return;
    this.npc = npc;
    this.knot = knot;
    this.active = true;
    this.story.ChoosePathString(knot);
    this.pump();
  }

  private pump() {
    const s = this.story;
    while (s.canContinue) {
      const text = (s.Continue() ?? '').trim();
      const { map } = parseTags(s.currentTags);
      if (!text) continue;
      if (map.v) {
        const skill = map.v as SkillId;
        if (map.p && !passiveOk(state.value, content, skill, Number(map.p))) continue;
        dispatch({ type: 'voice', voice: skill, key: `${this.knot}:${hash(text)}`, shortcut: 'shortcut' in map });
        say('voice', stripName(text), skill, { shortcut: 'shortcut' in map });
      } else if (map.s) {
        const who = map.s;
        speaker.value = { who, mood: map.m ?? 'calm' };
        say('npc', stripName(text), who, { mood: map.m ?? 'calm' });
      } else {
        say('narr', text);
      }
    }
    const list = s.currentChoices;
    if (!list.length) {
      this.active = false;
      choices.value = [];
      this.onEnd();
      return;
    }
    choices.value = list.map((c, i): Choice => {
      const { map, list: tags } = parseTags(c.tags);
      let hint: string | undefined;
      let disabled = false;
      if (map.check) {
        const [skill, dc, kind, key] = map.check.split(':');
        const p = previewCheck(state.value, content, skill as SkillId, Number(dc), key ?? `${this.knot}:${i}`, kind === 'rep', map.fact);
        hint = `${skillTitle(skill)} · сложность ${p.dc} · шанс ${Math.round(p.chance * 100)}%`;
        if (!p.available) {
          disabled = true;
          hint += p.reason === 'failed_wait_fact' ? ' · нужен новый факт' : ' · уже проверено';
        }
      }
      if (map.voice) hint = (hint ? hint + ' · ' : '') + skillTitle(map.voice);
      return { text: c.text, tags, disabled, hint, run: () => this.choose(i) };
    });
  }

  choose(i: number) {
    const c = this.story.currentChoices[i];
    if (!c) return;
    const { map, list } = parseTags(c.tags);
    if (map.check) {
      const [skill, dc, kind, key] = map.check.split(':');
      const evs = dispatch({ type: 'check', skill: skill as SkillId, dc: Number(dc), key: key ?? `${this.knot}:${i}`, repeatable: kind === 'rep', fact: map.fact });
      const roll = evs.find((e) => e.type === 'check.rolled');
      const ok = roll && roll.type === 'check.rolled' ? roll.ok : false;
      this.story.variablesState['last_check'] = ok;
      if (roll && roll.type === 'check.rolled')
        say('system', roll.noRandom ? `${skillTitle(skill)}: ${ok ? 'успех' : 'неудача'} (без случайности)` : `${skillTitle(skill)}: ${roll.roll[0]} + ${roll.roll[1]} + ${roll.mod} против ${roll.dc} — ${ok ? 'успех' : 'неудача'}`);
    }
    say('echo', c.text);
    dispatch({ type: 'choice', npc: this.npc, knot: this.knot, tags: list.filter((t) => !t.startsWith('check:')), text: c.text });
    this.story.ChooseChoiceIndex(i);
    this.pump();
  }

  stop() {
    this.active = false;
    choices.value = [];
  }
}
