// Конструктор карты уровня: сетка тайлов 16×16 + список объектов.
// Координаты — в тайлах. Для объектов y — строка, в которой стоят их «ноги».
//
// Символы тайлов:  # грунт/бетон/пол   = доска (запрыгнуть снизу можно)   f щит опалубки/коробки
//                  b гипсокартон   B плитка санузла   C потолок
// Декор (без столкновений):  c колонна  r арматура  | труба  - труба  ~ лужа  i стойка
//                  s леса  o окно  l светильник  x связи  : трос

export const SOLID = new Set(['#', 'f', 'b', 'B', 'C']);
export const ONEWAY = new Set(['=']);
export const DECOR = new Set(['c', 'r', '|', '-', '~', 'i', 's', 'o', 'l', 'x', ':']);

export class LevelGrid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = Array.from({ length: h }, () => Array(w).fill('.'));
    this.decor = Array.from({ length: h }, () => Array(w).fill('.'));
    this.objects = [];
  }

  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** Заливка прямоугольника (включительно). Декор кладётся в отдельный слой. */
  fill(x0, y0, x1, y1, ch) {
    const layer = DECOR.has(ch) ? this.decor : this.tiles;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.inb(x, y)) layer[y][x] = ch;
    return this;
  }

  clear(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.inb(x, y)) this.tiles[y][x] = '.';
    return this;
  }

  /** Земля/пол: столбцы x0..x1 залиты от строки top до низа карты. */
  ground(x0, x1, top, ch = '#') {
    return this.fill(x0, top, x1, this.h - 1, ch);
  }

  plat(x0, x1, y, ch = '=') {
    return this.fill(x0, y, x1, y, ch);
  }

  put(x, y, ch) {
    return this.fill(x, y, x, y, ch);
  }

  obj(type, x, y, props = {}) {
    this.objects.push({ type, x, y, ...props });
    return this;
  }

  /** Скрытый дефект: прямоугольник тайлов. У проваливающихся тайлы под ним убираются. */
  defect(kind, x, y, w = 1, h = 1, props = {}) {
    this.objects.push({ type: 'defect', kind, x, y, w, h, ...props });
    return this;
  }

  isSolid(x, y) {
    return this.inb(x, y) && SOLID.has(this.tiles[y][x]);
  }

  /** Отладка: карта в виде текста. */
  toString() {
    return this.tiles.map((r, y) => r.map((c, x) => (c === '.' ? this.decor[y][x] : c)).join('')).join('\n');
  }
}
