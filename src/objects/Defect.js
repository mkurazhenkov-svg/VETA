// Скрытый дефект: выглядит как обычная отделка, луч нивелира его проявляет.
// Некоторые опасны до проявления: проваливающийся пол и течь.
import Phaser from 'phaser';
import { DEFECT_KINDS, T } from '../gfx/textures.js';
import { sfx } from '../audio/sfx.js';
import { t } from '../content.js';
import { burst, plate } from '../ui/world.js';

export class Defect {
  /**
   * @param {object} def  {kind, x, y, w, h} в тайлах
   * @param {number[][]} frames  кадры тайлсета под дефектом (чтобы выглядеть как отделка)
   */
  constructor(scene, def, id, style, frames, revealed) {
    this.scene = scene;
    this.def = def;
    this.id = id;
    this.style = style;
    this.meta = DEFECT_KINDS[def.kind];
    this.revealed = false;
    this.collapsed = false;
    this.rect = new Phaser.Geom.Rectangle(def.x * 16, def.y * 16, def.w * 16, def.h * 16);
    this.parts = [];
    this.bodies = [];
    const tiles = `tiles-${style}`;
    for (let j = 0; j < def.h; j++) {
      for (let i = 0; i < def.w; i++) {
        const x = (def.x + i) * 16 + 8;
        const y = (def.y + j) * 16 + 8;
        if (this.meta.collapse) {
          // пол, который может провалиться: свои физические тела вместо тайлов
          const img = scene.solids.create(x, y, tiles, frames[j][i] || T.TOP);
          img.defect = this;
          img.setDepth(9);
          this.bodies.push(img);
        }
        const tell = scene.add.image(x, y, 'tell').setDepth(10).setAlpha(0.55);
        this.parts.push(tell);
      }
    }
    if (this.meta.drip) {
      this.dripTimer = scene.time.addEvent({
        delay: 1500,
        loop: true,
        startAt: Math.random() * 1500,
        callback: () => this.drip(),
      });
    }
    if (revealed) this.reveal(false, true);
  }

  drip() {
    if (this.revealed) return;
    const x = this.rect.centerX + (this.def.kind === 'pipe' ? 6 : Phaser.Math.Between(-4, 4));
    const y = this.def.kind === 'pipe' ? this.rect.y + 12 : this.rect.bottom + 1;
    this.scene.spawnDrip(x, y);
  }

  /** Проявить дефект. byBeam — найден экспертизой (с очками); иначе — «нашёлся ногами». */
  reveal(byBeam, silent = false) {
    if (this.revealed) return false;
    this.revealed = true;
    this.dripTimer?.remove();
    this.parts.forEach((p) => p.destroy());
    this.parts = [];
    const key = `def-${this.def.kind}-${this.style}`;
    for (let j = 0; j < this.def.h; j++) {
      for (let i = 0; i < this.def.w; i++) {
        if (this.collapsed) continue; // пол уже провалился — рисовать нечего
        const x = (this.def.x + i) * 16 + 8;
        const y = (this.def.y + j) * 16 + 8;
        const img = this.scene.add.image(x, y, key).setDepth(10);
        this.parts.push(img);
        if (!silent) {
          img.setScale(0.2);
          this.scene.tweens.add({ targets: img, scale: 1, duration: 280, delay: (i + j) * 60, ease: 'Back.easeOut' });
        }
      }
    }
    if (this.meta.collapse && !this.collapsed) {
      // найденная пустота огорожена лентой — по ней можно пройти
      for (let i = 0; i < this.def.w; i++) {
        this.parts.push(this.scene.add.image((this.def.x + i) * 16 + 8, this.rect.y - 2, 'tape').setDepth(11));
      }
    }
    const check = this.scene.add.image(this.rect.centerX, this.rect.y - 8, 'check').setDepth(42);
    this.parts.push(check);
    if (silent) return true;
    sfx.defect();
    const label = plate(this.scene, this.rect.centerX, this.rect.y - 20, t(this.meta.label), { size: 7.5, depth: 43 });
    this.scene.tweens.add({ targets: label, y: label.y - 6, alpha: 0, delay: 3200, duration: 600, onComplete: () => label.destroy() });
    this.scene.tweens.add({ targets: check, scale: { from: 2, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    burst(this.scene, this.rect.centerX, this.rect.centerY, 'spark', 10, { speed: 50 });
    this.scene.onDefectFound(this, byBeam);
    return true;
  }

  /** Герой встал на непроверенный пол — он проваливается. */
  startCollapse() {
    if (this.revealed || this.collapsing) return;
    this.collapsing = true;
    sfx.crumble();
    this.bodies.forEach((b) => this.scene.tweens.add({ targets: b, x: b.x + 1, duration: 50, yoyo: true, repeat: 3 }));
    this.scene.time.delayedCall(380, () => {
      this.collapsed = true;
      this.bodies.forEach((b) => {
        b.body.enable = false;
        burst(this.scene, b.x, b.y, 'dust', 5, { speed: 50 });
        this.scene.tweens.add({ targets: b, y: b.y + 30, alpha: 0, angle: Phaser.Math.Between(-30, 30), duration: 500, onComplete: () => b.destroy() });
      });
      this.bodies = [];
      this.reveal(false);
    });
  }

  destroy() {
    this.dripTimer?.remove();
    this.parts.forEach((p) => p.destroy());
  }
}

