// Герой: Терентьев-прораб. Бег, прыжок (с «запасом» и буфером), луч нивелира, урон.
import Phaser from 'phaser';
import { BALANCE } from '../config.js';
import { sfx } from '../audio/sfx.js';

const RUN_SPEED = 118;
const JUMP_V = 335;

export class Hero extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, health) {
    super(scene, x, y, 'hero', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.body.setSize(14, 42).setOffset(9, 6);
    this.body.setMaxVelocity(400, 640);
    this.setDepth(30);
    this.facing = 1;
    this.coyote = 0;
    this.buffer = 0;
    this.beamReadyAt = 0;
    this.invulnUntil = 0;
    this.hurtUntil = 0;
    this.shootUntil = 0;
    this.locked = false;
    this.won = false;
    this.health = health;
    this.maxHealth = health;
    this.ride = null;
    this.wasGround = true;
    this.speedMul = 1;
    this.jumpMul = 1;
    this.anims.play('hero-idle');
  }

  get onGround() {
    return this.body.blocked.down || this.body.touching.down;
  }

  /** Луч выходит из нивелира в руке. */
  beamOrigin() {
    return { x: this.x + this.facing * 13, y: this.y - 22 };
  }

  update(time, dt, input) {
    const k = dt / 16.667;
    const body = this.body;
    const ground = this.onGround;
    const hurt = time < this.hurtUntil;

    // --- ходьба ---
    let dir = 0;
    if (!this.locked && !hurt) dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) this.facing = dir;
    const target = dir * RUN_SPEED * this.speedMul;
    const accel = ground ? 0.32 : 0.18;
    if (!hurt) body.velocity.x += (target - body.velocity.x) * Math.min(1, accel * k);

    // невысокая ступенька (до одного тайла) — герой шагает на неё сам, без прыжка
    if (ground && dir !== 0 && (dir > 0 ? body.blocked.right : body.blocked.left)) {
      const fx = this.x + dir * 10;
      const s = this.scene;
      if (s.isSolidAt(fx, this.y - 6) && !s.isSolidAt(fx, this.y - 20) && !s.isSolidAt(fx, this.y - 40) && !s.isSolidAt(this.x, this.y - 50)) {
        this.y -= 17;
        this.x += dir * 2;
        body.reset(this.x, this.y);
      }
    }

    // --- прыжок: «запас» после схода с края и буфер нажатия ---
    if (ground) this.coyote = BALANCE.coyoteMs;
    else this.coyote -= dt;
    if (input.jumpPressed && !this.locked) this.buffer = BALANCE.jumpBufferMs;
    else this.buffer -= dt;
    if (this.buffer > 0 && this.coyote > 0 && !hurt) {
      body.velocity.y = -JUMP_V * this.jumpMul;
      this.buffer = 0;
      this.coyote = 0;
      sfx.jump();
    }
    // отпустили кнопку раньше — прыжок ниже
    if (!input.jump && body.velocity.y < -140 && !this.bouncing) body.velocity.y = -140;
    if (body.velocity.y >= 0) this.bouncing = false;

    if (ground && !this.wasGround && body.velocity.y >= 0) sfx.land();
    this.wasGround = ground;

    // --- луч нивелира ---
    if (input.beamPressed && !this.locked && time >= this.beamReadyAt) {
      this.beamReadyAt = time + BALANCE.beamCooldownMs;
      this.shootUntil = time + 200;
      this.scene.fireBeam(this);
    }

    // --- анимация ---
    this.setFlipX(this.facing < 0);
    let anim;
    if (this.won) anim = 'hero-win';
    else if (hurt) anim = 'hero-hurt';
    else if (time < this.shootUntil) anim = 'hero-shoot';
    else if (!ground) anim = body.velocity.y < 0 ? 'hero-up' : 'hero-down';
    else if (Math.abs(body.velocity.x) > 12) anim = 'hero-run';
    else anim = 'hero-idle';
    if (this.anims.currentAnim?.key !== anim) this.anims.play(anim, true);

    // мигание после урона
    this.setAlpha(time < this.invulnUntil && !this.won ? (Math.floor(time / 80) % 2 ? 0.35 : 1) : 1);
  }

  /** Отскок после прыжка на волка. */
  bounce(strong = false) {
    this.body.velocity.y = strong ? -380 : -290;
    this.bouncing = true;
  }

  /** Мягкий толчок от волка в шкуре (без урона). */
  shove(fromX) {
    const time = this.scene.time.now;
    if (time < (this.shoveUntil || 0)) return;
    this.shoveUntil = time + 400;
    this.hurtUntil = time + 180;
    this.body.velocity.x = (this.x < fromX ? -1 : 1) * 150;
    if (this.onGround) this.body.velocity.y = -110;
  }

  /** Урон. Возвращает true, если каска потеряна. */
  hurt(fromX, { force = false, knock = true } = {}) {
    const time = this.scene.time.now;
    if (this.won || this.dead) return false;
    if (!force && time < this.invulnUntil) return false;
    this.health -= 1;
    this.invulnUntil = time + 1400;
    this.hurtUntil = time + 320;
    if (knock) {
      const dir = fromX === undefined ? -this.facing : this.x < fromX ? -1 : 1;
      this.body.velocity.x = dir * 170;
      this.body.velocity.y = -210;
    } else this.hurtUntil = time + 120;
    sfx.hurt();
    this.scene.cameras.main.shake(160, 0.006);
    this.scene.onHeroHurt();
    return true;
  }
}
