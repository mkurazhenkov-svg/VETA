// Навигация: сетка по проходимым многоугольникам минус основания предметов + A* и сглаживание пути.
import type { SceneDef } from '../content/schemas';
import { pointInPoly, type Vec2 } from './iso';

export class NavGrid {
  readonly cell = 0.2;
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oy: number;
  private open: Uint8Array;

  constructor(private scene: SceneDef, extraBlocked: Vec2[] = []) {
    const pts = scene.walkable.flat();
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    this.ox = Math.min(...xs);
    this.oy = Math.min(...ys);
    this.w = Math.ceil((Math.max(...xs) - this.ox) / this.cell) + 1;
    this.h = Math.ceil((Math.max(...ys) - this.oy) / this.cell) + 1;
    this.open = new Uint8Array(this.w * this.h);
    const blocks = scene.props
      .filter((p) => !p.walkable && (p.z ?? 0) < 0.6 && p.shape !== 'line')
      .map((p) => {
        const m = 0.18;
        return [p.pos[0] - p.size[0] / 2 - m, p.pos[1] - p.size[1] / 2 - m, p.pos[0] + p.size[0] / 2 + m, p.pos[1] + p.size[1] / 2 + m];
      });
    for (let j = 0; j < this.h; j++)
      for (let i = 0; i < this.w; i++) {
        const p: Vec2 = [this.ox + i * this.cell, this.oy + j * this.cell];
        let ok = scene.walkable.some((poly) => pointInPoly(p, poly));
        if (ok) ok = !blocks.some((b) => p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3]);
        if (ok) ok = !extraBlocked.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.35);
        this.open[j * this.w + i] = ok ? 1 : 0;
      }
  }

  private idx(p: Vec2): [number, number] {
    return [Math.round((p[0] - this.ox) / this.cell), Math.round((p[1] - this.oy) / this.cell)];
  }
  private pos(i: number, j: number): Vec2 {
    return [this.ox + i * this.cell, this.oy + j * this.cell];
  }
  isOpen(i: number, j: number) {
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.open[j * this.w + i] === 1;
  }
  walkable(p: Vec2) {
    const [i, j] = this.idx(p);
    return this.isOpen(i, j);
  }

  /** Ближайшая проходимая точка. */
  nearest(p: Vec2): Vec2 | null {
    const [ci, cj] = this.idx(p);
    for (let rad = 0; rad < 40; rad++)
      for (let dj = -rad; dj <= rad; dj++)
        for (let di = -rad; di <= rad; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue;
          if (this.isOpen(ci + di, cj + dj)) return this.pos(ci + di, cj + dj);
        }
    return null;
  }

  private lineOpen(a: Vec2, b: Vec2) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.ceil(d / (this.cell * 0.5));
    for (let k = 0; k <= n; k++) {
      const t = k / Math.max(1, n);
      if (!this.walkable([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return false;
    }
    return true;
  }

  findPath(from: Vec2, to: Vec2): Vec2[] | null {
    const start = this.walkable(from) ? from : this.nearest(from);
    const goal = this.walkable(to) ? to : this.nearest(to);
    if (!start || !goal) return null;
    const [si, sj] = this.idx(start);
    const [gi, gj] = this.idx(goal);
    const N = this.w * this.h;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap: [number, number][] = [];
    const push = (f: number, n: number) => {
      heap.push([f, n]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const s0 = sj * this.w + si;
    const goalN = gj * this.w + gi;
    g[s0] = 0;
    push(0, s0);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length) {
      const [, n] = pop();
      if (closed[n]) continue;
      closed[n] = 1;
      if (n === goalN) break;
      const i = n % this.w;
      const j = (n / this.w) | 0;
      for (const [di, dj, c] of dirs) {
        const ni = i + di;
        const nj = j + dj;
        if (!this.isOpen(ni, nj)) continue;
        if (di && dj && (!this.isOpen(i + di, j) || !this.isOpen(i, j + dj))) continue;
        const nn = nj * this.w + ni;
        const ng = g[n] + c;
        if (ng < g[nn]) {
          g[nn] = ng;
          came[nn] = n;
          push(ng + Math.hypot(gi - ni, gj - nj), nn);
        }
      }
    }
    if (came[goalN] === -1 && goalN !== s0) return null;
    const raw: Vec2[] = [];
    for (let n = goalN; n !== -1; n = came[n]) raw.push(this.pos(n % this.w, (n / this.w) | 0));
    raw.reverse();
    raw[0] = start;
    raw[raw.length - 1] = goal;
    // сглаживание: «натягиваем нить» по прямой видимости
    const out: Vec2[] = [raw[0]];
    let k = 0;
    while (k < raw.length - 1) {
      let far = k + 1;
      for (let m = raw.length - 1; m > k + 1; m--)
        if (this.lineOpen(raw[k], raw[m])) {
          far = m;
          break;
        }
      out.push(raw[far]);
      k = far;
    }
    return out;
  }
}
