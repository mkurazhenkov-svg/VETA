// «Сметная стена»: бумага с надписью «Объём завышен». Луч её разбирает и открывает короткий путь.
import { sfx } from '../audio/sfx.js';
import { t } from '../content.js';
import { burst, plate } from '../ui/world.js';

export class EstimateWall {
  constructor(scene, x, y, h, id) {
    this.scene = scene;
    this.id = id;
    this.cells = [];
    for (let j = 0; j < h; j++) {
      const img = scene.solids.create(x * 16 + 8, (y + j) * 16 + 8, 'estwall', j % 2 === 1 ? 1 : 0);
      img.setDepth(12);
      img.estwall = this;
      this.cells.push(img);
    }
    this.rect = { x: x * 16, y: y * 16, w: 16, h: h * 16 };
    this.label = plate(scene, x * 16 + 8, y * 16 - 8, t('estwall.label'), { size: 7 });
    this.alive = true;
  }

  destroyWall() {
    if (!this.alive) return;
    this.alive = false;
    sfx.paper();
    this.cells.forEach((c, i) => {
      c.body.enable = false;
      burst(this.scene, c.x, c.y, 'paperBit', 6, { speed: 90, life: 900 });
      this.scene.tweens.add({ targets: c, alpha: 0, angle: (i % 2 ? 1 : -1) * 40, y: c.y + 10, duration: 400, delay: i * 60, onComplete: () => c.destroy() });
    });
    this.scene.tweens.add({ targets: this.label, alpha: 0, duration: 400, onComplete: () => this.label.destroy() });
    this.scene.onWallDestroyed(this);
  }
}
