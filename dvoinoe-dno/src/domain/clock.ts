// Игровое время: минуты от полуночи.
export function parseClock(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}
export function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}
