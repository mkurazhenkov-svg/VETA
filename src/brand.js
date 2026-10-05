// Фирменный стиль в игре: палитра, шрифты, угловые рамки (CornerFrame).
import Phaser from 'phaser';
import { BRAND, SHADE, hex } from './palette.js';

export { BRAND, SHADE, SKIN, hex, rgba } from './palette.js';

// Шрифты. Замена фирменным Museo Sans Cyrl — одна строка (имя семейства) + файлы в src/fonts.js.
export const FONT_MAIN = 'Manrope';
export const FONT_PIXEL = 'Pixelify Sans';
const FALLBACK = ', "Segoe UI", Roboto, Arial, sans-serif';

// Роли шрифта: заголовки — жирный, текст — обычный, счётчики — пиксельный.
export const FONT = {
  head: { fontFamily: FONT_MAIN + FALLBACK, fontStyle: '800' },
  bold: { fontFamily: FONT_MAIN + FALLBACK, fontStyle: '700' },
  text: { fontFamily: FONT_MAIN + FALLBACK, fontStyle: '500' },
  pixel: { fontFamily: `"${FONT_PIXEL}"` + FALLBACK, fontStyle: '700' },
};

/**
 * Стиль текста для Phaser.
 * @param {'head'|'bold'|'text'|'pixel'} role
 */
export function textStyle(role, size, color = BRAND.white, extra = {}) {
  return {
    ...FONT[role],
    fontSize: `${size}px`,
    color: hex(color),
    ...extra,
  };
}

/**
 * Фирменный идентификатор — угловые рамки.
 * На синем фоне: красные уголки справа сверху и слева снизу, синие — слева сверху и справа снизу.
 * На светлом фоне: все уголки серые. Отступ от края равен толщине линии.
 */
export class CornerFrame extends Phaser.GameObjects.Graphics {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x левый край области
   * @param {number} y верхний край области
   * @param {number} w ширина области
   * @param {number} h высота области
   * @param {{variant?: 'blue'|'light', thickness?: number, length?: number}} [opts]
   */
  constructor(scene, x, y, w, h, opts = {}) {
    super(scene);
    this.opts = { variant: 'blue', thickness: 6, length: Math.round(Math.min(w, h) * 0.14), ...opts };
    this.area = { x, y, w, h };
    this.redraw();
    scene.add.existing(this);
  }

  setArea(x, y, w, h) {
    this.area = { x, y, w, h };
    return this.redraw();
  }

  redraw() {
    const { variant, thickness: t, length } = this.opts;
    const { x, y, w, h } = this.area;
    const L = Math.max(length, t * 3);
    // Отступ от края равен толщине линии.
    const x0 = x + t;
    const y0 = y + t;
    const x1 = x + w - t;
    const y1 = y + h - t;
    const accent = variant === 'blue' ? BRAND.red : SHADE.grayMid;
    const calm = variant === 'blue' ? BRAND.blue : SHADE.grayMid;
    this.clear();
    // Левый верхний — синий (на синем фоне) / серый (на светлом).
    this.fillStyle(calm, 1);
    this.fillRect(x0, y0, L, t);
    this.fillRect(x0, y0, t, L);
    // Правый нижний — синий / серый.
    this.fillRect(x1 - L, y1 - t, L, t);
    this.fillRect(x1 - t, y1 - L, t, L);
    // Правый верхний — красный / серый.
    this.fillStyle(accent, 1);
    this.fillRect(x1 - L, y0, L, t);
    this.fillRect(x1 - t, y0, t, L);
    // Левый нижний — красный / серый.
    this.fillRect(x0, y1 - t, L, t);
    this.fillRect(x0, y1 - L, t, L);
    return this;
  }
}

/** Панель-подложка в фирменном стиле с угловыми рамками. */
export function addPanel(scene, x, y, w, h, opts = {}) {
  const { fill = BRAND.blueDeep, alpha = 0.96, variant = 'blue', thickness = 5, length, depth = 0 } = opts;
  const bg = scene.add.rectangle(x, y, w, h, fill, alpha).setOrigin(0, 0).setDepth(depth);
  const frame = new CornerFrame(scene, x, y, w, h, { variant, thickness, length }).setDepth(depth + 0.1);
  return { bg, frame, destroy: () => (bg.destroy(), frame.destroy()) };
}
