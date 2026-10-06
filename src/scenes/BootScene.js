// Загрузка: прогресс-бар в фирменных цветах, генерация графики, подключение фото героя.
import Phaser from 'phaser';
import { BRAND, SHADE, textStyle, CornerFrame } from '../brand.js';
import { USE_PORTRAIT } from '../config.js';
import { t } from '../content.js';
import { HERO_W, HERO_H, HERO_ANIMS } from '../gfx/heroRig.js';
import { makeTileset, makeHero, makeCreatures, makeBoss, makeItems, makeDefects, makeTell, makeBackgrounds } from '../gfx/textures.js';

// Необязательные файлы: если их нет, сборка не падает (берётся пустой список).
const HERO_SHEET = import.meta.glob('../../assets/sprites/hero.png', { eager: true, query: '?inline', import: 'default' });
const HERO_PORTRAIT = import.meta.glob('../../assets/sprites/hero_portrait.png', { eager: true, query: '?inline', import: 'default' });
const HERO_PORTRAIT_TALK = import.meta.glob('../../assets/sprites/hero_portrait_talk.png', { eager: true, query: '?inline', import: 'default' });
const LOGO = import.meta.glob('../../assets/brand/logo.{svg,png}', { eager: true, query: '?inline', import: 'default' });

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const sheet = Object.values(HERO_SHEET)[0];
    const pt = Object.values(HERO_PORTRAIT)[0];
    const logo = Object.values(LOGO)[0];
    this.photoHero = USE_PORTRAIT && !!sheet;
    if (this.photoHero) this.load.spritesheet('hero', sheet, { frameWidth: HERO_W, frameHeight: HERO_H });
    else if (USE_PORTRAIT) console.info('Фото героя не найдено (assets/sprites/hero.png) — используется обезличенный «Прораб». См. README: npm run sprite');
    if (USE_PORTRAIT && pt) this.load.image('pt-hero-photo', pt);
    const ptTalk = Object.values(HERO_PORTRAIT_TALK)[0];
    if (USE_PORTRAIT && pt && ptTalk) this.load.image('pt-hero-photo-talk', ptTalk);
    if (logo) this.load.image('logo', logo);
  }

  create() {
    this.cameras.main.setBackgroundColor(BRAND.blueDeep);
    new CornerFrame(this, 0, 0, 960, 540, { thickness: 8, length: 64 });
    this.add.text(480, 226, t('meta.loading'), textStyle('head', 26, BRAND.white)).setOrigin(0.5);
    const bw = 420;
    this.add.rectangle(480, 280, bw + 8, 22, SHADE.blueNight).setStrokeStyle(2, BRAND.blue);
    const bar = this.add.rectangle(480 - bw / 2, 280, 4, 14, BRAND.white).setOrigin(0, 0.5);

    const steps = [
      () => makeBackgrounds(this),
      () => makeTileset(this, 1),
      () => makeTileset(this, 2),
      () => makeTileset(this, 3),
      () => makeCreatures(this),
      () => makeBoss(this),
      () => makeItems(this),
      () => [1, 2, 3].forEach((s) => makeDefects(this, s)),
      () => makeTell(this),
      () => {
        if (!this.photoHero) makeHero(this);
      },
      () => this.makeAnims(),
    ];
    const t0 = performance.now();
    let i = 0;
    const tick = () => {
      if (i < steps.length) {
        steps[i++]();
        bar.setSize(4 + (bw - 4) * (i / steps.length), 14);
        this.time.delayedCall(16, tick);
        return;
      }
      this.add.image(480 + bw / 2 + 22, 280, 'check').setScale(2);
      // минимальное время показа загрузки, чтобы она не «мигала»
      const wait = Math.max(0, 650 - (performance.now() - t0));
      this.time.delayedCall(wait, () => this.scene.start('Title'));
    };
    tick();
  }

  makeAnims() {
    const a = this.anims;
    const mk = (key, frames, frameRate, repeat = -1) => {
      if (a.exists(key)) a.remove(key);
      a.create({ key, frames: a.generateFrameNumbers('hero', { frames }), frameRate, repeat });
    };
    mk('hero-idle', HERO_ANIMS.idle, 2.5);
    mk('hero-run', HERO_ANIMS.run, 12);
    mk('hero-up', HERO_ANIMS.jumpUp, 1);
    mk('hero-down', HERO_ANIMS.jumpDown, 1);
    mk('hero-shoot', HERO_ANIMS.shoot, 12);
    mk('hero-hurt', HERO_ANIMS.hurt, 1);
    mk('hero-win', HERO_ANIMS.win, 4);
  }
}
