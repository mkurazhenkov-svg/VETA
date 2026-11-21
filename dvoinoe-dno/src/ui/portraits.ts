import { content } from '../content';
import { paintPortrait } from '../scene/painter';

const cache = new Map<string, string>();
export function portraitUrl(who: string, mood = 'calm'): string | null {
  const id = who === 'zharov_chamber' ? 'zharov' : who;
  const p = content.case.persons.find((x) => x.id === id);
  if (!p) return null;
  const key = `${id}:${mood}`;
  if (!cache.has(key)) cache.set(key, paintPortrait(p.portrait, mood, id).toDataURL('image/jpeg', 0.85));
  return cache.get(key)!;
}
export function nameOf(who: string) {
  const id = who === 'zharov_chamber' ? 'zharov' : who;
  return content.case.persons.find((x) => x.id === id)?.name ?? who;
}
