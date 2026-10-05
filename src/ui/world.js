// Надписи и эффекты внутри игрового мира (камера уровня увеличена в 2 раза).
import Phaser from 'phaser';
import { BRAND, SHADE, hex, textStyle } from '../brand.js';

const RES = 2; // чёткость текста в мире: совпадает с увеличением камеры — пиксель в пиксель

export function worldText(scene, x, y, str, { size = 7, color = BRAND.white, role = 'bold', wrap, align = 'center', stroke } = {}) {
  const style = textStyle(role, size, color, { align });
  if (wrap) style.wordWrap = { width: wrap, useAdvancedWrap: true };
  if (stroke) Object.assign(style, { stroke: hex(stroke), strokeThickness: 2 });
  const t = scene.add.text(x, y, str, style).setResolution(RES);
  return t;
}

/** Табличка с текстом (тёмная подложка). */
export function plate(scene, x, y, str, { size = 7, fill = BRAND.blueDeep, color = BRAND.white, depth = 40, border = BRAND.red } = {}) {
  const t = worldText(scene, 0, 0, str, { size, color }).setOrigin(0.5);
  const w = Math.ceil(t.width) + 8;
  const h = Math.ceil(t.height) + 4;
  const g = scene.add.graphics();
  g.fillStyle(fill, 0.95).fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle(border, 1).fillRect(-w / 2, -h / 2, 3, h);
  const c = scene.add.container(x, y, [g, t]).setDepth(depth);
  c.plateW = w;
  c.plateH = h;
  return c;
}

/** Всплывающий текст (очки и т. п.). */
export function popText(scene, x, y, str, color = BRAND.white, size = 8) {
  const t = worldText(scene, x, y, str, { size, color, role: 'head', stroke: BRAND.black }).setOrigin(0.5).setDepth(60);
  scene.tweens.add({ targets: t, y: y - 18, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  return t;
}

/** Разлёт частиц (шерсть, бумага, искры). */
export function burst(scene, x, y, key, count = 8, { speed = 60, spread = Math.PI * 2, angle = -Math.PI / 2, life = 700, gravity = 120, depth = 45, scale = 1 } = {}) {
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = speed * (0.5 + Math.random() * 0.7);
    const img = scene.add.image(x, y, key).setDepth(depth).setScale(scale * (0.7 + Math.random() * 0.6));
    const vx = Math.cos(a) * v;
    const vy = Math.sin(a) * v;
    const t0 = scene.time.now;
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: life,
      onUpdate: () => {
        const t = (scene.time.now - t0) / 1000;
        img.x = x + vx * t;
        img.y = y + vy * t + 0.5 * gravity * t * t;
        img.rotation += 0.05;
      },
      onComplete: () => img.destroy(),
    });
    scene.tweens.add({ targets: img, alpha: 0, delay: life * 0.5, duration: life * 0.5 });
  }
}

/** Реплика в «баббле» над персонажем. */
export class Bubble {
  constructor(scene, target, str, { duration = 3500, width = 170, offsetY = 6, color = BRAND.black, name } = {}) {
    this.scene = scene;
    this.target = target;
    this.offsetY = offsetY;
    const parts = [];
    const g = scene.add.graphics();
    parts.push(g);
    let ty = 0;
    let nameT;
    if (name) {
      nameT = worldText(scene, 0, 0, name, { size: 6, color: BRAND.red, role: 'head', align: 'left' }).setOrigin(0, 0);
      parts.push(nameT);
      ty = nameT.height;
    }
    const t = worldText(scene, 0, ty, str, { size: 7.5, color, role: 'text', wrap: width, align: 'left' }).setOrigin(0, 0);
    parts.push(t);
    const w = Math.ceil(Math.max(t.width, nameT ? nameT.width : 0)) + 10;
    const h = Math.ceil(ty + t.height) + 8;
    parts.forEach((p) => {
      if (p !== g) {
        p.x += -w / 2 + 5;
        p.y += -h + 4;
      }
    });
    g.fillStyle(BRAND.white, 1).fillRect(-w / 2, -h, w, h);
    g.lineStyle(1, BRAND.black, 1).strokeRect(-w / 2 + 0.5, -h + 0.5, w - 1, h - 1);
    g.fillStyle(BRAND.red, 1).fillRect(-w / 2, -h, 3, h);
    g.fillStyle(BRAND.white, 1).fillTriangle(-4, -1, 4, -1, 0, 5);
    g.lineStyle(1, BRAND.black, 1).lineBetween(-4, 0, 0, 5).lineBetween(4, 0, 0, 5);
    this.w = w;
    this.h = h;
    this.c = scene.add.container(0, 0, parts).setDepth(80);
    this.update();
    this.c.setScale(0.6);
    scene.tweens.add({ targets: this.c, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.timer = scene.time.delayedCall(duration, () => this.destroy());
    this.ev = scene.events.on('postupdate', this.update, this);
  }

  update() {
    if (!this.c || !this.target || !this.target.active) return;
    const cam = this.scene.cameras.main;
    const top = this.target.y - (this.target.displayHeight || 40) * (this.target.originY ?? 1) - this.offsetY;
    // не даём баблу уйти за край экрана
    const view = cam.worldView;
    const x = Phaser.Math.Clamp(this.target.x, view.x + this.w / 2 + 4, view.right - this.w / 2 - 4);
    this.c.setPosition(Math.round(x), Math.round(Math.max(top, view.y + this.h + 26)));
  }

  destroy() {
    if (!this.c) return;
    this.scene.events.off('postupdate', this.update, this);
    this.timer?.remove();
    this.c.destroy();
    this.c = null;
  }
}
