// Босс: Главный волк — генподрядчик в костюме из овечьей шерсти, со щитом «Заключение-пустышка».
// Фаза 1: бросает сметы и акты, зовёт двух субподрядчиков.
// Фаза 2: щит снимается только ходатайством о повторной экспертизе (нужен полный пакет документов).
import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { t } from '../content.js';
import { burst, plate, Bubble } from '../ui/world.js';
import { BRAND } from '../brand.js';

export class Boss extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'boss', 0);
    scene.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(22);
    this.phase = 'wait';
    this.hp = 3;
    this.facing = -1;
    this.nextThrow = 0;
    this.invulnUntil = 0;
    this.walkDir = -1;
    this.homeX = x;
    this.shield = scene.add.image(x, y, 'shield').setOrigin(0.5, 1).setDepth(23);
    this.lastBlockMsg = -9999;
  }

  setup() {
    this.body.setSize(34, 56).setOffset(13, 12);
    this.body.setImmovable(true);
  }

  say(key, duration = 3000) {
    this.bubble?.destroy();
    this.bubble = new Bubble(this.scene, this, t(key), { duration, name: t('boss.name'), offsetY: 4, width: 190 });
  }

  get hasShield() {
    return this.phase === 'wait' || this.phase === 'intro' || this.phase === 'p1' || this.phase === 'p2wait';
  }

  get exposed() {
    return this.phase === 'exposed';
  }

  startPhase1() {
    if (this.phase !== 'wait' && this.phase !== 'intro') return;
    this.phase = 'p1';
    this.nextThrow = this.scene.time.now + 1500;
    this.say('boss.summon', 2200);
    this.scene.summonSubs();
  }

  update(time) {
    if (this.phase === 'defeated') return;
    const hero = this.scene.hero;
    this.facing = hero.x < this.x ? -1 : 1;
    this.setFlipX(this.facing < 0);
    const b = this.body;

    if (this.phase === 'p1') {
      b.velocity.x = 0;
      if (time > this.nextThrow) {
        this.nextThrow = time + 1700;
        this.throwAt(hero, this.throwN = (this.throwN || 0) + 1);
      }
      if (time > this.throwFrameUntil) this.setFrame(0);
      if (this.scene.subsCleared()) this.startPhase2();
    } else if (this.phase === 'p2wait' || this.phase === 'intro' || this.phase === 'wait') {
      b.velocity.x = 0;
      this.setFrame(this.phase === 'p2wait' ? 2 : 0);
    } else if (this.phase === 'skin' || this.phase === 'exposed') {
      const exposed = this.phase === 'exposed';
      const hit = time < this.invulnUntil;
      const speed = exposed ? 55 : 35;
      const arena = this.scene.arena;
      if (this.x < arena.x0 + 40) this.walkDir = 1;
      if (this.x > arena.x1 - 40) this.walkDir = -1;
      if (!exposed && Math.abs(hero.x - this.x) > 30) this.walkDir = Math.sign(hero.x - this.x);
      b.velocity.x = hit ? 0 : this.walkDir * speed;
      this.setFlipX(this.walkDir < 0);
      if (time > this.nextThrow && !hit) {
        this.nextThrow = time + (exposed ? 2000 : 2400);
        this.throwAt(hero, this.throwN = (this.throwN || 0) + 1);
      }
      if (exposed) this.setFrame(hit ? 4 : Math.floor(time / 160) % 2 ? 5 : 3);
      else this.setFrame(time < this.throwFrameUntil ? 1 : 0);
      this.setAlpha(hit ? (Math.floor(time / 70) % 2 ? 0.5 : 1) : 1);
    }

    // щит перед волком
    if (this.shield.visible) {
      this.shield.setPosition(this.x + (this.flipX ? -24 : 24), this.y - 6).setFlipX(this.flipX);
    }
  }

  throwAt(hero, n) {
    this.throwFrameUntil = this.scene.time.now + 300;
    this.setFrame(1);
    const sx = this.x + (this.flipX ? -20 : 20);
    const sy = this.y - 52;
    const vy = -240;
    const vx = this.scene.aimVx(sx, sy, hero.x + Phaser.Math.Between(-16, 16), hero.y - 20, vy, 260);
    this.scene.spawnProjectile(sx, sy, vx, vy, n % 3 === 0 ? 1 : 0);
    sfx.throw();
  }

  startPhase2() {
    this.phase = 'p2wait';
    this.say('boss.phase2', 2400);
    this.scene.time.delayedCall(1600, () => this.scene.bossDocCheck());
  }

  /** Ходатайство о повторной экспертизе: щит рассыпается. */
  breakShield() {
    if (this.phase !== 'p2wait') return;
    this.phase = 'skin';
    this.nextThrow = this.scene.time.now + 1800;
    sfx.shieldBreak();
    burst(this.scene, this.shield.x, this.shield.y - 18, 'paperBit', 26, { speed: 120, life: 1100 });
    this.scene.tweens.add({ targets: this.shield, alpha: 0, scaleY: 0.2, angle: 25, duration: 450, onComplete: () => this.shield.setVisible(false) });
    this.scene.toast(t('boss.shieldBroken'), t('boss.ripHint'), 'ok');
  }

  onBeam() {
    const time = this.scene.time.now;
    if (this.hasShield) {
      sfx.shieldBlock();
      burst(this.scene, this.shield.x, this.shield.y - 18, 'sparkW', 6, { speed: 60 });
      if (time - this.lastBlockMsg > 4000) {
        this.lastBlockMsg = time;
        this.scene.toast(t('boss.block'), null, 'warn');
      }
      return 'block';
    }
    if (this.phase === 'skin') {
      this.phase = 'exposed';
      this.setTexture('boss', 3);
      sfx.rip();
      burst(this.scene, this.x, this.y - 36, 'wool', 24, { speed: 120, life: 1100 });
      return 'rip';
    }
    return null;
  }

  stomp() {
    const time = this.scene.time.now;
    if (this.phase !== 'exposed' || time < this.invulnUntil) return false;
    this.hp -= 1;
    this.invulnUntil = time + 1100;
    sfx.bossHit();
    this.scene.cameras.main.shake(180, 0.008);
    burst(this.scene, this.x, this.y - 60, 'spark', 10, { speed: 80 });
    if (this.hp <= 0) this.defeat();
    else this.say('boss.hit', 1500);
    return true;
  }

  defeat() {
    this.phase = 'defeated';
    this.body.enable = false;
    this.bubble?.destroy();
    this.setFrame(4);
    sfx.stomp();
    const sign = plate(this.scene, this.x, this.y - 78, t('wolf.claim'), { size: 8, fill: BRAND.white, color: BRAND.black, depth: 41 });
    this.scene.onBossDefeated(this);
    this.scene.time.delayedCall(700, () => sfx.runaway());
    this.scene.tweens.add({
      targets: [this, sign],
      x: '+=520',
      delay: 900,
      duration: 2600,
      ease: 'Sine.easeIn',
      onStart: () => this.setFlipX(false),
      onUpdate: () => this.setFrame(Math.floor(this.scene.time.now / 110) % 2 ? 5 : 3),
      onComplete: () => {
        sign.destroy();
        this.setVisible(false);
      },
    });
  }
}
