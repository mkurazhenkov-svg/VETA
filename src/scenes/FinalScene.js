// Финальный экран: итоги, оценка по документам, призыв и кнопки.
import Phaser from 'phaser';
import { BRAND, SHADE, textStyle, CornerFrame } from '../brand.js';
import { CONTACTS } from '../config.js';
import { t } from '../content.js';
import { session, prefs, DOCS } from '../state.js';
import { DOC_VARIANT } from '../gfx/textures.js';
import { Button, MenuNav } from '../ui/Button.js';
import { ctaUrl, openUrl, shareGame } from '../share.js';
import { track } from '../analytics.js';
import { addLogo } from './TitleScene.js';
import { sfx } from '../audio/sfx.js';

function fmtTime(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class FinalScene extends Phaser.Scene {
  constructor() {
    super('Final');
  }

  create() {
    const run = session.run;
    this.cameras.main.setBackgroundColor(BRAND.blueDeep);
    this.cameras.main.fadeIn(500, 2, 79, 153);
    new CornerFrame(this, 0, 0, 960, 540, { thickness: 8, length: 64 });
    addLogo(this, 52, 52, 30);
    this.add.text(480, 52, t('final.title'), textStyle('head', 34, BRAND.white)).setOrigin(0.5);
    track('final', { score: run.score, docs: run.docs.length });

    const totals = Object.values(run.totals || {});
    const defTotal = totals.reduce((a, b) => a + (b.defects || 0), 0) || 9;
    const wolfTotal = totals.reduce((a, b) => a + (b.wolves || 0), 0) || run.wolves.length;
    const newBest = prefs.submitScore(run.score);

    // итоги
    const rows = [
      [t('final.score'), String(run.score)],
      [t('final.defects'), t('final.of', { x: run.defects.length, y: defTotal })],
      [t('final.docs'), t('final.of', { x: run.docs.length, y: 9 })],
      [t('final.wolves'), t('final.of', { x: run.wolves.length, y: wolfTotal })],
      [t('final.false'), String(run.falseSusp)],
      [t('final.time'), fmtTime(run.totalTimeMs)],
    ];
    const lx = 76;
    this.add.rectangle(lx - 16, 96, 452, 236, SHADE.blueNight, 0.6).setOrigin(0);
    rows.forEach(([a, b], i) => {
      const y = 110 + i * 36;
      this.add.text(lx, y, a, textStyle('text', 19, BRAND.white));
      this.add.text(lx + 420, y - 1, b, textStyle('head', 21, BRAND.white)).setOrigin(1, 0);
    });
    if (newBest && run.score > 0) {
      this.add.text(lx + 420, 334, t('final.newBest'), textStyle('head', 15, BRAND.red, { stroke: '#ffffff', strokeThickness: 3 })).setOrigin(1, 0);
    }

    // оценка по документам
    const docs = run.docs.length;
    const ratingKey = docs >= 9 ? 'final.rating.perfect' : docs >= 7 ? 'final.rating.strong' : 'final.rating.weak';
    const rx = 720;
    this.add.image(rx - 150, 124, 'checkBig').setScale(1.5);
    this.add
      .text(rx - 124, 124, t(ratingKey), textStyle('head', docs >= 7 ? 24 : 17, BRAND.white, { wordWrap: { width: 300, useAdvancedWrap: true } }))
      .setOrigin(0, 0.5);
    if (run.easy) this.add.text(rx - 124, 152, t('final.easy'), textStyle('text', 13, BRAND.white)).setOrigin(0, 0.5).setAlpha(0.8);
    // папка дела
    DOCS.forEach((d, i) => {
      const x = rx - 150 + (i % 9) * 34;
      const has = run.docs.includes(d.id);
      const img = this.add.image(x, 192, has ? 'doc' : 'docEmpty', has ? DOC_VARIANT[d.id] : undefined).setScale(1.8);
      if (has) this.add.image(x + 9, 202, 'check');
      img.setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, delay: 300 + i * 90, duration: 200 });
    });
    // герой празднует
    const hero = this.add.sprite(rx, 330, 'hero', 13).setOrigin(0.5, 1).setScale(2.5);
    hero.play('hero-win');
    this.add.sprite(rx + 90, 330, 'wolf', 3).setOrigin(0.5, 1).setScale(2);
    this.add.sprite(rx - 96, 330, 'sheep', 2).setOrigin(0.5, 1).setScale(2).setFlipX(true);
    sfx.victory();

    // призыв
    this.add.text(480, 378, t('final.cta.text'), textStyle('head', 21, BRAND.white, { align: 'center', wordWrap: { width: 820 } })).setOrigin(0.5);

    const cta = new Button(this, 250, 438, t('final.cta.button'), () => {
      track('cta');
      openUrl(ctaUrl());
    }, { style: 'primary', w: 320, h: 50, size: 21 });
    const share = new Button(this, 540, 438, t('final.share'), () => this.share(), { w: 220, h: 50, size: 19 });
    const again = new Button(this, 776, 438, t('final.again'), () => this.scene.start('Title'), { style: 'ghost', w: 220, h: 50, size: 18 });
    new MenuNav(this, [cta, share, again]);

    // контакты
    const phone = this.add.text(400, 496, CONTACTS.phone, textStyle('bold', 18, BRAND.white)).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    this.add.text(480, 496, '·', textStyle('bold', 18, BRAND.red)).setOrigin(0.5);
    const site = this.add.text(560, 496, CONTACTS.site, textStyle('bold', 18, BRAND.white)).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    phone.on('pointerup', () => (window.location.href = CONTACTS.phoneHref));
    site.on('pointerup', () => openUrl(CONTACTS.siteUrl));

    this.msg = this.add.text(540, 404, '', textStyle('bold', 14, BRAND.white)).setOrigin(0.5).setVisible(false);
  }

  async share() {
    track('share');
    const res = await shareGame(t('final.shareTitle'), t('final.shareText', { docs: session.run.docs.length }));
    if (res === 'copied') this.flash(t('final.copied'));
    else if (res === 'failed') this.flash(t('final.copyFail', { url: window.location.href }));
  }

  flash(text) {
    this.msg.setText(text).setVisible(true).setAlpha(1).setY(470);
    this.tweens.add({ targets: this.msg, alpha: 0, delay: 1800, duration: 400 });
  }
}
