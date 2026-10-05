// Чекпоинт — красная «галочка» на шесте.
import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { burst } from '../ui/world.js';

export class Checkpoint extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, id, active) {
    super(scene, x, y, 'cp', active ? 1 : 0);
    this.id = id;
    this.active2 = active;
    scene.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(14);
    if (active) this.wave();
  }

  wave() {
    this.scene.time.addEvent({ delay: 260, loop: true, callback: () => this.setFrame(this.frame.name === 1 ? 2 : 1) });
  }

  activate() {
    if (this.active2) return false;
    this.active2 = true;
    this.setFrame(1);
    this.wave();
    sfx.checkpoint();
    burst(this.scene, this.x + 6, this.y - 40, 'spark', 14, { speed: 70 });
    this.scene.tweens.add({ targets: this, scaleY: { from: 0.85, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    return true;
  }
}
