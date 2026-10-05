// «Как играть»: управление и главное правило.
import Phaser from 'phaser';
import { BRAND, SHADE, textStyle, CornerFrame } from '../brand.js';
import { t } from '../content.js';
import { Button, MenuNav } from '../ui/Button.js';

export class HowToScene extends Phaser.Scene {
  constructor() {
    super('HowTo');
  }

  create() {
    this.cameras.main.setBackgroundColor(BRAND.blueDeep);
    new CornerFrame(this, 0, 0, 960, 540, { thickness: 8, length: 64 });
    this.add.text(480, 50, t('howto.title'), textStyle('head', 36, BRAND.white)).setOrigin(0.5);
    this.add.text(480, 94, t('howto.rule'), textStyle('head', 24, BRAND.red, { stroke: '#ffffff', strokeThickness: 0 })).setOrigin(0.5);

    // управление
    const rows = [
      ['howto.move', 'howto.move.kb'],
      ['howto.jump', 'howto.jump.kb'],
      ['howto.beam', 'howto.beam.kb'],
      ['howto.pause', 'howto.pause.kb'],
    ];
    const px = 70;
    this.add.rectangle(px - 10, 130, 380, 210, SHADE.blueNight, 0.7).setOrigin(0);
    rows.forEach(([a, b], i) => {
      const y = 152 + i * 40;
      this.add.text(px + 8, y, t(a), textStyle('bold', 19, BRAND.white));
      this.add.text(px + 196, y, t(b), textStyle('pixel', 19, BRAND.white));
    });
    this.add.text(px + 8, 312, t('howto.touch'), textStyle('text', 14, BRAND.white, { wordWrap: { width: 350 } }));

    // правила с картинками
    const items = [
      ['wolfskin', 0, 'howto.p1'],
      ['sheep', 0, 'howto.p2'],
      ['doc', 0, 'howto.p3'],
      ['tell', null, 'howto.p4'],
    ];
    items.forEach(([key, frame, text], i) => {
      const y = 150 + i * 62;
      const img = frame === null ? this.add.image(510, y + 14, 'def-void-1') : this.add.image(510, y + 14, key, frame);
      img.setScale(2);
      this.add.text(548, y, t(text), textStyle('text', 16, BRAND.white, { wordWrap: { width: 360, useAdvancedWrap: true }, lineSpacing: 2 }));
    });

    const back = new Button(this, 480, 478, t('howto.back'), () => this.scene.start('Title'), { style: 'primary', w: 240, h: 46 });
    new MenuNav(this, [back], { escape: () => this.scene.start('Title') });
  }
}
