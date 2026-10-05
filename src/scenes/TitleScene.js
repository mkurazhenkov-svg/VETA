// Титульный экран: название, логотип (пока текстовая заглушка «VETA»), кнопки, режимы.
import Phaser from 'phaser';
import { BRAND, textStyle, CornerFrame } from '../brand.js';
import { DEBUG } from '../config.js';
import { t } from '../content.js';
import { session, prefs, newRun, clone, DOCS } from '../state.js';
import { setSound, isSoundOn, unlockAudio } from '../audio/sfx.js';
import { T } from '../gfx/textures.js';
import { Button, MenuNav } from '../ui/Button.js';
import { track } from '../analytics.js';

/** Логотип: официальный файл из assets/brand/ или текстовая заглушка «VETA». */
export function addLogo(scene, x, y, height = 40) {
  if (scene.textures.exists('logo')) {
    const img = scene.add.image(x, y, 'logo').setOrigin(0, 0.5);
    img.setScale(height / img.height);
    return img;
  }
  return scene.add.text(x, y, 'VETA', textStyle('head', height, BRAND.white, { letterSpacing: 4 })).setOrigin(0, 0.5);
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor(BRAND.blueDeep);
    this.cameras.main.fadeIn(300, 2, 79, 153);

    // земля и персонажи — декорация
    this.add.tileSprite(480, 540, 320, 16, 'tiles-1', T.TOP).setOrigin(0.5, 1).setScale(3);
    const hero = this.add.sprite(150, 492, 'hero', 0).setOrigin(0.5, 1).setScale(3);
    hero.play('hero-idle');
    const wolf = this.add.sprite(820, 492, 'wolfskin', 0).setOrigin(0.5, 1).setScale(3).setFlipX(true);
    this.time.addEvent({ delay: 330, loop: true, callback: () => wolf.setFrame(wolf.frame.name === 0 ? 1 : 0) });
    // луч нивелира время от времени «проверяет» овцу
    this.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => {
        hero.play('hero-shoot');
        const g = this.add.graphics();
        g.fillStyle(BRAND.red, 1).fillRect(190, 424, 560, 3);
        g.fillStyle(BRAND.red, 0.12).fillTriangle(190, 425, 750, 395, 750, 455);
        this.tweens.add({ targets: g, alpha: 0, duration: 260, delay: 80, onComplete: () => g.destroy() });
        this.time.delayedCall(300, () => hero.play('hero-idle'));
      },
    });

    new CornerFrame(this, 0, 0, 960, 540, { thickness: 8, length: 64 });
    // логотип — с охранным полем, без искажений
    addLogo(this, 52, 58, 34);
    if (prefs.best > 0) this.add.text(904, 58, t('title.best', { n: prefs.best }), textStyle('bold', 16, BRAND.white)).setOrigin(1, 0.5);

    this.add.text(480, 132, t('title.name'), textStyle('head', 54, BRAND.white)).setOrigin(0.5);
    this.add.text(480, 186, t('title.subtitle'), textStyle('text', 22, BRAND.white)).setOrigin(0.5);
    this.add.rectangle(480, 214, 60, 4, BRAND.red);

    const saved = prefs.savedRun;
    let y = 262;
    const play = new Button(this, 480, y, t('title.play'), () => this.play(), { style: 'primary', w: 320, h: 50, size: 24 });
    const buttons = [play];
    if (saved) {
      y += 56;
      buttons.push(new Button(this, 480, y, t('title.continue', { n: saved.level }), () => this.continueRun(saved), { w: 320, h: 44, size: 19 }));
    }
    y += 56;
    buttons.push(new Button(this, 480, y, t('title.howto'), () => this.scene.start('HowTo'), { w: 320, h: 44, size: 19 }));

    const soundLabel = () => t(isSoundOn() ? 'title.sound.on' : 'title.sound.off');
    const easyLabel = () => t(prefs.easy ? 'title.easy.on' : 'title.easy.off');
    const soundBtn = new Button(this, 340, 432, soundLabel(), () => {
      unlockAudio();
      setSound(!isSoundOn());
      soundBtn.setLabel(soundLabel());
    }, { style: 'ghost', w: 240, h: 40, size: 17 });
    const easyBtn = new Button(this, 620, 432, easyLabel(), () => {
      prefs.easy = !prefs.easy;
      easyBtn.setLabel(easyLabel());
      note.setAlpha(prefs.easy ? 1 : 0.6);
    }, { style: 'ghost', w: 280, h: 40, size: 17 });
    buttons.push(soundBtn, easyBtn);
    const note = this.add.text(480, 466, t('title.easyNote'), textStyle('text', 14, BRAND.white)).setOrigin(0.5).setAlpha(prefs.easy ? 1 : 0.6);

    this.nav = new MenuNav(this, buttons);
    this.input.keyboard.once('keydown', () => unlockAudio());
  }

  play() {
    unlockAudio();
    session.run = newRun();
    track('play', { easy: prefs.easy });
    // отладка: ?debug&level=3 — сразу на нужный уровень с документами прошлых уровней
    const lv = DEBUG ? parseInt(new URLSearchParams(window.location.search).get('level') || '', 10) : NaN;
    if (lv >= 2 && lv <= 3) {
      session.run.level = lv;
      session.run.docs = DOCS.filter((d) => d.level < lv).map((d) => d.id);
      this.scene.start('Level', { level: lv });
      return;
    }
    this.scene.start('Intro');
  }

  continueRun(saved) {
    unlockAudio();
    session.run = clone(saved);
    session.run.easy = prefs.easy;
    this.scene.start('Level', { level: saved.level });
  }
}

