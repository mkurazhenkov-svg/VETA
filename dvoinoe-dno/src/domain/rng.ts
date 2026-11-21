// Детерминированный генератор (mulberry32). Состояние генератора хранится в GameState.
export function nextRandom(seed: number): [number, number] {
  let a = (seed + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  a = a >>> 0;
  return [value, a];
}

/** Бросок 2д6 из состояния генератора: возвращает кубы и новое состояние. */
export function roll2d6(seed: number): { dice: [number, number]; seed: number } {
  const [v1, s1] = nextRandom(seed);
  const [v2, s2] = nextRandom(s1);
  return { dice: [1 + Math.floor(v1 * 6), 1 + Math.floor(v2 * 6)], seed: s2 };
}
