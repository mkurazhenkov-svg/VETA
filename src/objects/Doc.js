// Документ дела — главный предмет сбора.
import Phaser from 'phaser';
import { DOC_VARIANT } from '../gfx/textures.js';
import { BRAND } from '../brand.js';

export class Doc extends Phaser.GameObjects.Container {
  constructor(scene, x, y, id) {
    super(scene, x, y);
    this.id = id;
    this.glow = scene.add.circle(0, 0, 11, BRAND.white, 0.18);
    this.icon = scene.add.image(0, 0, 'doc', DOC_VARIANT[id] ?? 0);
    this.add([this.glow, this.icon]);
    scene.add.existing(this);
    this.setDepth(18);
    this.setSize(16, 18);
    scene.tweens.add({ targets: this.icon, y: -3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: this.glow, scale: 1.35, alpha: 0.05, duration: 900, yoyo: true, repeat: -1 });
    this.taken = false;
  }

  bounds() {
    return new Phaser.Geom.Rectangle(this.x - 8, this.y - 10, 16, 20);
  }

  take() {
    this.taken = true;
    this.scene.tweens.killTweensOf([this.icon, this.glow]);
    this.scene.tweens.add({
      targets: this,
      y: this.y - 26,
      scale: 1.6,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => this.destroy(),
    });
  }
}
