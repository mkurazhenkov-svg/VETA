// Волки в овечьих шкурах: субподрядчик (ходит), сметчик (бросает сметы), маскировщик (прячется в отделке).
// Побеждённый волк не погибает: убегает за край экрана с табличкой «Претензия принята».
import Phaser from 'phaser';
import { BALANCE } from '../config.js';
import { sfx } from '../audio/sfx.js';
import { t } from '../content.js';
import { burst, plate } from '../ui/world.js';
import { BRAND } from '../brand.js';

export class Wolf extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {'sub'|'est'|'hider'} kind
   */
  constructor(scene, x, y, kind, id, opts = {}) {
    const key = kind === 'hider' ? `hider-${opts.style || 1}` : kind === 'est' ? 'estskin' : 'wolfskin';
    super(scene, x, y, key, 0);
    this.kind = kind;
    this.id = id;
    this.opts = opts;
    this.state = kind === 'hider' ? 'hidden' : 'skin';
    this.dir = opts.dir || -1;
    this.nextThrow = 0;
    this.exposedUntil = 0;
    scene.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(kind === 'hider' ? 12 : 22);
  }

  /** Вызывается после добавления в физическую группу. */
  setup() {
    const b = this.body;
    if (this.state === 'hidden') {
      b.setSize(14, 30).setOffset(2, 2);
      b.allowGravity = false;
      b.setImmovable(true);
      b.moves = false;
    } else {
      this.skinBody();
    }
  }

  skinBody() {
    const b = this.body;
    b.setSize(20, 15).setOffset(4, 7);
    b.allowGravity = true;
    b.moves = true;
    b.setImmovable(false);
  }

  get active2() {
    return this.state === 'skin' || this.state === 'exposed';
  }

  get skinKey() {
    return this.kind === 'est' ? 'estskin' : 'wolfskin';
  }

  get bareKey() {
    return this.kind === 'est' ? 'est' : 'wolf';
  }

  update(time, dt) {
    if (this.state === 'gone') return;
    if (this.state === 'hidden') {
      this.setFrame(Math.floor(time / 500) % 4 === 0 ? 1 : 0);
      return;
    }
    const hero = this.scene.hero;
    const exposed = this.state === 'exposed';

    if (exposed && time > this.exposedUntil) this.reskin();

    if (this.kind === 'est') {
      this.body.velocity.x = 0;
      const dx = hero.x - this.x;
      this.setFlipX(dx < 0);
      if (exposed) {
        this.setFrame(Math.floor(time / 200) % 2 ? 2 : 0);
        return;
      }
      const near = Math.abs(dx) < 240 && Math.abs(hero.y - this.y) < 150;
      if (near && time > this.nextThrow) {
        this.nextThrow = time + 2300;
        this.setFrame(1);
        this.scene.time.delayedCall(250, () => {
          if (this.state !== 'skin') return;
          this.setFrame(0);
          this.throwAt(hero);
        });
      }
      return;
    }

    // субподрядчик и проявленный маскировщик: ходят туда-обратно
    const speed = exposed ? 52 : 26;
    const b = this.body;
    if (b.blocked.left) this.dir = 1;
    else if (b.blocked.right) this.dir = -1;
    const onGround = b.blocked.down || b.touching.down;
    if (onGround) {
      const aheadX = this.x + this.dir * 12;
      if (!this.scene.isGroundAt(aheadX, this.y + 4)) this.dir *= -1;
      const r = this.opts.range;
      if (r && ((this.dir < 0 && this.x < r[0]) || (this.dir > 0 && this.x > r[1]))) this.dir *= -1;
    }
    b.velocity.x = this.dir * speed;
    this.setFlipX(this.dir < 0);
    const f = Math.floor(time / (exposed ? 120 : 220)) % 2;
    this.setFrame(exposed && time < this.exposedAt + 350 ? 2 : f);
    if (exposed && time > this.exposedUntil - 700) this.setAlpha(Math.floor(time / 90) % 2 ? 0.6 : 1);
    else this.setAlpha(1);
  }

  throwAt(hero) {
    const sx = this.x + (this.flipX ? -8 : 8);
    const sy = this.y - 16;
    const vy = -210;
    const vx = this.scene.aimVx(sx, sy, hero.x, hero.y - 20, vy, 220);
    this.scene.spawnProjectile(sx, sy, vx, vy, Math.random() < 0.7 ? 0 : 1);
    sfx.throw();
  }

  /** Попадание лучом. Возвращает что произошло. */
  onBeam() {
    const time = this.scene.time.now;
    if (this.state === 'hidden') {
      this.state = 'skin';
      burst(this.scene, this.x, this.y - 16, 'dust', 10, { speed: 70 });
      burst(this.scene, this.x, this.y - 16, 'paperBit', 6, { speed: 80 });
      this.setTexture(this.skinKey, 0);
      this.setDepth(22);
      this.skinBody();
      this.body.velocity.y = -160;
      this.dir = this.scene.hero.x < this.x ? 1 : -1;
      sfx.crumble();
      return 'reveal';
    }
    if (this.state === 'skin') {
      this.state = 'exposed';
      this.exposedAt = time;
      this.exposedUntil = time + BALANCE.exposedMs;
      this.setTexture(this.bareKey, 2);
      burst(this.scene, this.x, this.y - 12, 'wool', 12, { speed: 90, life: 900 });
      sfx.rip();
      return 'rip';
    }
    if (this.state === 'exposed') {
      this.exposedUntil = time + BALANCE.exposedMs;
      return 'extend';
    }
    return null;
  }

  reskin() {
    this.state = 'skin';
    this.setTexture(this.skinKey, 0);
    this.setAlpha(1);
    burst(this.scene, this.x, this.y - 12, 'wool', 5, { speed: 30, life: 400 });
    sfx.baa();
  }

  /** Прыжок героя сверху. */
  stomp() {
    if (this.state === 'exposed') {
      this.defeat();
      return true;
    }
    sfx.baa();
    return false;
  }

  defeat() {
    this.state = 'gone';
    this.body.enable = false;
    this.setAlpha(1);
    this.setTexture(this.bareKey, 3);
    const hero = this.scene.hero;
    const dir = this.x >= hero.x ? 1 : -1;
    this.setFlipX(dir < 0);
    sfx.stomp();
    this.scene.time.delayedCall(250, () => sfx.runaway());
    const sign = plate(this.scene, this.x, this.y - 30, t('wolf.claim'), { size: 7, fill: BRAND.white, color: BRAND.black, depth: 41 });
    this.scene.onWolfDefeated(this);
    this.scene.tweens.add({ targets: this, y: this.y - 10, duration: 160, yoyo: true });
    this.scene.tweens.add({
      targets: [this, sign],
      x: `+=${dir * 420}`,
      delay: 450,
      duration: 2200,
      ease: 'Sine.easeIn',
      onUpdate: () => this.setFrame(Math.floor(this.scene.time.now / 90) % 2 ? 3 : 0),
      onComplete: () => {
        sign.destroy();
        this.destroy();
      },
    });
  }
}

/** Честная овца-рабочий. Не враг. */
export class Sheep extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, id, checked) {
    super(scene, x, y, 'sheep', 0);
    this.id = id;
    this.checked = checked;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.pauseUntil = 0;
    this.homeX = x;
    scene.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(21);
  }

  setup() {
    this.body.setSize(20, 15).setOffset(4, 7);
  }

  update(time) {
    const b = this.body;
    if (time < this.pauseUntil || this.happyUntil > time) {
      b.velocity.x = 0;
      this.setFrame(this.happyUntil > time ? 2 : 0);
      return;
    }
    if (Math.random() < 0.004) this.pauseUntil = time + 800 + Math.random() * 1200;
    if (b.blocked.left) this.dir = 1;
    else if (b.blocked.right) this.dir = -1;
    if ((b.blocked.down || b.touching.down) && !this.scene.isGroundAt(this.x + this.dir * 12, this.y + 4)) this.dir *= -1;
    if (Math.abs(this.x - this.homeX) > 80) this.dir = this.x > this.homeX ? -1 : 1;
    b.velocity.x = this.dir * 18;
    this.setFlipX(this.dir < 0);
    this.setFrame(Math.floor(time / 260) % 2);
  }

  onBeam() {
    this.happyUntil = this.scene.time.now + 1500;
    const first = !this.checked;
    this.checked = true;
    sfx.clean();
    const p = plate(this.scene, this.x, this.y - 30, t('sheep.clean'), { size: 8, fill: BRAND.white, color: BRAND.black, depth: 41 });
    const chk = this.scene.add.image(this.x - p.plateW / 2 - 6, this.y - 30, 'check').setDepth(42);
    this.scene.tweens.add({
      targets: [p, chk],
      y: '-=10',
      alpha: { from: 1, to: 0 },
      delay: 900,
      duration: 700,
      onComplete: () => {
        p.destroy();
        chk.destroy();
      },
    });
    return first;
  }
}
