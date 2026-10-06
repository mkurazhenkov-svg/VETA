// Вступление — комикс из 4 кадров. Проигрывается сам по таймингу: реплики печатаются по буквам,
// у говорящего открывается рот. Клик/пробел — допечатать реплику сразу, «Пропустить»/Esc — сразу к игре.
import Phaser from 'phaser';
import { BRAND, SHADE, textStyle, CornerFrame } from '../brand.js';
import { t } from '../content.js';
import { dialogPanel, typeText } from '../ui/Dialog.js';
import { Button } from '../ui/Button.js';
import { playMusic } from '../audio/music.js';

const PANELS = [
  { who: 'client', name: 'who.client', text: 'intro.1.text' },
  { who: 'hero', name: 'who.hero', text: 'intro.2.text' },
  { who: 'lawyer', name: 'who.lawyer', text: 'intro.3.text' },
  { who: 'hero', name: 'who.hero', text: 'intro.4.text' },
];

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create() {
    // сцена переиспользуется Phaser'ом — сбрасываем флаги прошлого показа
    this.done = false;
    this.typer = null;
    this.cameras.main.setBackgroundColor(SHADE.blueNight);
    this.cameras.main.fadeIn(300, 1, 55, 107);
    this.drawHeader();
    this.add.text(480, 22, t('intro.title'), textStyle('head', 22, BRAND.white)).setOrigin(0.5);

    const w = 444;
    const h = 170;
    this.slots = [
      [24, 150],
      [492, 150],
      [24, 332],
      [492, 332],
    ];
    this.panels = PANELS.map((p, i) => {
      const [x, y] = this.slots[i];
      const c = dialogPanel(this, x, y, w, h, { who: p.who, name: t(p.name), text: t(p.text), size: 16 });
      c.setAlpha(0);
      return c;
    });
    this.i = -1;

    this.skipBtn = new Button(this, 870, 24, t('intro.skip'), () => this.finish(), { style: 'ghost', w: 150, h: 34, size: 15 });
    this.hint = this.add.text(480, 521, t('intro.hint'), textStyle('text', 14, BRAND.white)).setOrigin(0.5).setAlpha(0.7);
    const hurry = () => this.typer && !this.typer.done && this.typer.finish();
    this.input.keyboard.on('keydown-SPACE', hurry);
    this.input.keyboard.on('keydown-ENTER', hurry);
    this.input.on('pointerdown', (p, over) => {
      if (!over.length) hurry();
    });
    this.input.keyboard.on('keydown-ESC', () => this.finish());
    playMusic('title');
    this.time.delayedCall(500, () => this.next());
  }

  /** Шапка-иллюстрация: дом в разрезе с затопленным подвалом. */
  drawHeader() {
    const g = this.add.graphics();
    g.fillStyle(BRAND.blueDeep, 1).fillRect(0, 0, 960, 140);
    // земля
    g.fillStyle(SHADE.blackLight, 1).fillRect(0, 96, 960, 44);
    // дом
    g.fillStyle(BRAND.gray, 1).fillRect(330, 36, 300, 60);
    g.fillStyle(SHADE.grayMid, 1).fillRect(330, 36, 300, 6);
    for (let i = 0; i < 6; i++) {
      g.fillStyle(SHADE.blueNight, 1).fillRect(346 + i * 48, 48, 28, 16);
      g.fillStyle(SHADE.blueNight, 1).fillRect(346 + i * 48, 72, 28, 16);
      g.fillStyle(SHADE.blueLight, 1).fillRect(348 + i * 48, 50, 6, 4);
    }
    // подвал с водой
    g.fillStyle(SHADE.grayDark, 1).fillRect(330, 96, 300, 40);
    g.fillStyle(SHADE.blackSoft, 1).fillRect(338, 99, 284, 33);
    g.fillStyle(BRAND.blue, 0.9).fillRect(338, 114, 284, 18);
    g.fillStyle(SHADE.blueLighter, 1).fillRect(338, 114, 284, 2);
    for (let i = 0; i < 8; i++) g.fillStyle(BRAND.white, 1).fillRect(350 + i * 34, 112, 6, 1);
    // волк в овечьей шкуре рядом с домом
    this.add.image(700, 96, 'wolfskin', 0).setOrigin(0.5, 1).setScale(2);
    this.add.image(260, 96, 'client', 0).setOrigin(0.5, 1).setScale(2);
    new CornerFrame(this, 0, 0, 960, 140, { thickness: 5, length: 30 });
  }

  next() {
    if (this.i >= PANELS.length - 1) {
      this.finish();
      return;
    }
    this.i += 1;
    const i = this.i;
    const c = this.panels[i];
    const [x, y] = this.slots[i];
    c.setPosition(x, y + 14);
    // прошлая реплика приглушается — видно, кто говорит сейчас
    if (i > 0) this.tweens.add({ targets: this.panels[i - 1], alpha: 0.55, duration: 250 });
    this.tweens.add({
      targets: c,
      alpha: 1,
      y,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.typer = typeText(this, c, {
          cps: 32,
          onDone: () => {
            // пауза на прочтение зависит от длины реплики
            const pause = 700 + c.fullText.length * 15;
            const last = i === PANELS.length - 1;
            this.time.delayedCall(last ? pause + 600 : pause, () => (last ? this.finish() : this.next()));
          },
        });
      },
    });
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(300, 1, 55, 107);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Level', { level: 1 }));
  }
}
