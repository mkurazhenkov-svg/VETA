// Ворота суда в конце уровней 1–2: открываются только при нужном числе документов.
import { sfx } from '../audio/sfx.js';
import { t } from '../content.js';
import { plate, burst } from '../ui/world.js';
import { BRAND } from '../brand.js';

export class CourtGate {
  constructor(scene, cx, bottom) {
    this.scene = scene;
    this.cx = cx;
    this.bottom = bottom;
    this.open = false;
    this.frame = scene.add.image(cx, bottom, 'gate').setOrigin(0.5, 1).setDepth(8);
    const doorBottom = bottom - 4;
    this.left = scene.add.image(cx - 22, doorBottom, 'gateDoor').setOrigin(0, 1).setDepth(9);
    this.right = scene.add.image(cx + 22, doorBottom, 'gateDoor').setOrigin(1, 1).setDepth(9).setFlipX(true);
    // невидимая преграда в проёме
    // преграда выше прыжка героя — через закрытые ворота не перепрыгнуть
    this.block = scene.solids.create(cx, doorBottom - 100, 'tiles-1', 0).setVisible(false);
    this.block.setDisplaySize(60, 200).refreshBody();
    this.title = plate(scene, cx, bottom - 92, t('gate.title'), { size: 7.5, depth: 15 });
    this.lastWarn = -99999;
  }

  update(hero, need, have, scope) {
    const near = Math.abs(hero.x - this.cx) < 70 && Math.abs(hero.y - this.bottom) < 60;
    if (!near) return;
    if (!this.open) {
      if (have >= need) this.openGate();
      else if (this.scene.time.now - this.lastWarn > 3500) {
        this.lastWarn = this.scene.time.now;
        sfx.gateLocked();
        this.scene.tweens.add({ targets: [this.left, this.right], x: '+=1', duration: 40, yoyo: true, repeat: 3 });
        const key = scope === 'level' ? 'gate.lockedLevel' : 'gate.locked';
        this.scene.toast(t(key, { need, have }), null, 'warn');
        this.scene.npcs.forEach((n) => n.say(t(n.line), 4000));
      }
    } else if (!this.passed && hero.x > this.cx + 6) {
      this.passed = true;
      this.scene.completeLevel();
    }
  }

  openGate() {
    this.open = true;
    this.block.body.enable = false;
    sfx.gateOpen();
    this.scene.toast(t('gate.open'), null, 'ok');
    this.scene.tweens.add({ targets: [this.left, this.right], scaleX: 0.18, duration: 700, ease: 'Cubic.easeOut' });
    burst(this.scene, this.cx, this.bottom - 60, 'spark', 16, { speed: 80 });
    const chk = this.scene.add.image(this.cx, this.bottom - 98, 'checkBig').setDepth(16).setScale(0.6);
    this.scene.tweens.add({ targets: chk, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.title.list[0].clear().fillStyle(BRAND.red, 1).fillRect(-this.title.plateW / 2, -this.title.plateH / 2, this.title.plateW, this.title.plateH);
  }
}
