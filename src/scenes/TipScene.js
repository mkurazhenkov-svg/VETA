// Карточка «Совет эксперта» между уровнями и перед боссом.
import Phaser from 'phaser';
import { BRAND, SHADE, textStyle } from '../brand.js';
import { t } from '../content.js';
import { session } from '../state.js';
import { dialogPanel } from '../ui/Dialog.js';
import { Button, MenuNav } from '../ui/Button.js';

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class TipScene extends Phaser.Scene {
  constructor() {
    super('Tip');
  }

  init(data) {
    this.data2 = data || {};
  }

  create() {
    const d = this.data2;
    const overlay = d.mode === 'boss';
    if (overlay) this.add.rectangle(0, 0, 960, 540, SHADE.blueNight, 0.82).setOrigin(0);
    else {
      this.cameras.main.setBackgroundColor(SHADE.blueNight);
      this.cameras.main.fadeIn(300, 1, 55, 107);
    }

    let top = 120;
    if (!overlay) {
      this.add.image(480, 70, 'checkBig').setScale(2);
      this.add.text(480, 120, t('tip.levelDone', { n: d.after }), textStyle('head', 34, BRAND.white)).setOrigin(0.5);
      this.add
        .text(480, 160, t('tip.summary', { time: fmtTime(d.secs || 0), bonus: d.bonus || 0, score: session.run.score }), textStyle('text', 18, BRAND.white))
        .setOrigin(0.5);
      top = 196;
    }
    const key = overlay ? 'tip.boss' : `tip.${d.after}`;
    const panel = dialogPanel(this, 120, top, 720, 220, { who: 'hero', name: t('tip.title'), text: t(key), size: 21 });
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, y: { from: top + 16, to: top }, duration: 320, ease: 'Cubic.easeOut' });

    const btn = new Button(this, 480, top + 268, t('tip.next'), () => this.next(), { style: 'primary', w: 240, h: 48 });
    new MenuNav(this, [btn]);
  }

  next() {
    if (this.done) return;
    this.done = true;
    const d = this.data2;
    if (d.mode === 'boss') {
      this.scene.stop();
      this.scene.resume('Level');
      return;
    }
    this.cameras.main.fadeOut(300, 1, 55, 107);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Level', { level: d.after + 1 }));
  }
}
