// Маленький «пиксельный холст»: рисуем спрайты кодом по пикселям.
// Без зависимостей — используется и в игре, и в скрипте экспорта шаблона героя.

export class PixelArt {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Int32Array(w * h).fill(-1);
  }

  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (this.inb(x, y)) this.px[y * this.w + x] = c;
    return this;
  }

  get(x, y) {
    return this.inb(x, y) ? this.px[y * this.w + x] : -1;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.35);
        const dy = (y - cy) / (ry + 0.35);
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
    return this;
  }

  circle(cx, cy, r, c) {
    return this.ellipse(cx, cy, r, r, c);
  }

  line(x0, y0, x1, y1, c, thick = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const o = Math.floor((thick - 1) / 2);
    for (;;) {
      this.rect(x0 - o, y0 - o, thick, thick, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Обводка: пустые пиксели рядом с закрашенными становятся цветом c. */
  outline(c, diagonal = false) {
    const src = this.px.slice();
    const at = (x, y) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : -1);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== -1) continue;
        let n = at(x - 1, y) !== -1 || at(x + 1, y) !== -1 || at(x, y - 1) !== -1 || at(x, y + 1) !== -1;
        if (!n && diagonal)
          n = at(x - 1, y - 1) !== -1 || at(x + 1, y - 1) !== -1 || at(x - 1, y + 1) !== -1 || at(x + 1, y + 1) !== -1;
        if (n) this.px[y * this.w + x] = c;
      }
    }
    return this;
  }

  replace(from, to) {
    for (let i = 0; i < this.px.length; i++) if (this.px[i] === from) this.px[i] = to;
    return this;
  }

  /** Рисунок по строкам-шаблонам: каждый символ — цвет из палитры, '.' — прозрачный. */
  map(rows, pal, ox = 0, oy = 0) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        if (pal[ch] === undefined) throw new Error(`PixelArt.map: нет цвета для «${ch}»`);
        this.set(ox + x, oy + y, pal[ch]);
      }
    });
    return this;
  }

  blit(other, ox = 0, oy = 0) {
    for (let y = 0; y < other.h; y++)
      for (let x = 0; x < other.w; x++) {
        const c = other.px[y * other.w + x];
        if (c !== -1) this.set(ox + x, oy + y, c);
      }
    return this;
  }

  clone() {
    const p = new PixelArt(this.w, this.h);
    p.px.set(this.px);
    return p;
  }

  flipX() {
    const p = new PixelArt(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.px[y * this.w + x] = this.px[y * this.w + (this.w - 1 - x)];
    return p;
  }

  /** Отрисовка в 2D-контекст canvas. */
  drawTo(ctx, ox = 0, oy = 0) {
    const img = ctx.getImageData(ox, oy, this.w, this.h);
    const d = img.data;
    for (let i = 0; i < this.px.length; i++) {
      const c = this.px[i];
      if (c === -1) continue;
      d[i * 4] = (c >> 16) & 255;
      d[i * 4 + 1] = (c >> 8) & 255;
      d[i * 4 + 2] = c & 255;
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, ox, oy);
  }
}

/** Простой детерминированный генератор случайных чисел (одинаковая картинка при каждом запуске). */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
