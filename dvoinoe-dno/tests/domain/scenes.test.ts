// Каждая точка подхода, выход и собеседник достижимы с точки появления: детали обстановки не перекрывают путь.
import { describe, expect, it } from 'vitest';
import { content } from '../helpers';
import { NavGrid } from '../../src/scene/navmesh';
import type { Vec2 } from '../../src/scene/iso';

describe('проходимость сцен', () => {
  for (const sc of Object.values(content().scenes)) {
    it(sc.id, () => {
      const nav = new NavGrid(sc);
      const targets: [string, Vec2][] = [
        ...sc.hotspots.map((h) => [h.id, h.approach] as [string, Vec2]),
        ...sc.exits.map((x) => [x.id, x.pos] as [string, Vec2]),
      ];
      for (const [id, t] of targets) {
        const path = nav.findPath(sc.spawn, t);
        expect(path, `${sc.id}: ${id}`).not.toBeNull();
        const end = path![path!.length - 1];
        expect(Math.hypot(end[0] - t[0], end[1] - t[1]), `${sc.id}: ${id} — точка подхода занята`).toBeLessThan(0.9);
      }
      // к собеседникам за стойкой подходят до ближайшей свободной точки
      for (const n of sc.npcs) expect(nav.findPath(sc.spawn, [n.pos[0] + 0.9, n.pos[1] + 0.6]), `${sc.id}: ${n.id}`).not.toBeNull();
    });
  }
});
