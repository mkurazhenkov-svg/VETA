// NPC: юрист заказчика у ворот суда.
import Phaser from 'phaser';
import { Bubble } from '../ui/world.js';
import { t } from '../content.js';

export class Npc extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, key, line) {
    super(scene, x, y, key, 0);
    this.line = line;
    this.said = false;
    scene.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(13);
    scene.time.addEvent({ delay: 1400, loop: true, callback: () => this.setFrame(this.frame.name === 0 ? 1 : 0) });
  }

  update(hero) {
    this.setFlipX(hero.x < this.x);
    if (!this.said && Math.abs(hero.x - this.x) < 90 && Math.abs(hero.y - this.y) < 60) {
      this.said = true;
      this.say(t(this.line));
    }
  }

  say(text, duration = 5000) {
    this.bubble?.destroy();
    this.bubble = new Bubble(this.scene, this, text, { duration, name: t('who.lawyer') });
  }
}
