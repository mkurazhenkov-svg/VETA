// Пауза: продолжить, начать уровень заново, звук, выход в меню.
import Phaser from 'phaser';
import { BRAND, SHADE, textStyle, CornerFrame } from '../brand.js';
import { t } from '../content.js';
import { setSound, isSoundOn } from '../audio/sfx.js';
import { resetTouch } from '../input.js';
import { Button, MenuNav } from '../ui/Button.js';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    this.add.rectangle(0, 0, 960, 540, SHADE.blueNight, 0.75).setOrigin(0).setInteractive();
    const w = 420;
    const h = 340;
    const x = 480 - w / 2;
    const y = 270 - h / 2;
    this.add.rectangle(x, y, w, h, BRAND.blueDeep).setOrigin(0);
    new CornerFrame(this, x, y, w, h, { thickness: 6, length: 40 });
    this.add.text(480, y + 46, t('pause.title'), textStyle('head', 32, BRAND.white)).setOrigin(0.5);

    const soundLabel = () => t(isSoundOn() ? 'title.sound.on' : 'title.sound.off');
    const resume = new Button(this, 480, y + 112, t('pause.resume'), () => this.resume(), { style: 'primary', w: 320, h: 46 });
    const restart = new Button(this, 480, y + 168, t('pause.restart'), () => this.restart(), { w: 320, h: 42, size: 18 });
    const sound = new Button(this, 480, y + 220, soundLabel(), () => {
      setSound(!isSoundOn());
      sound.setLabel(soundLabel());
    }, { style: 'ghost', w: 320, h: 42, size: 18 });
    const menu = new Button(this, 480, y + 272, t('pause.menu'), () => this.toMenu(), { style: 'ghost', w: 320, h: 42, size: 18 });
    new MenuNav(this, [resume, restart, sound, menu], { escape: () => this.resume() });
    this.input.keyboard.on('keydown-P', () => this.resume());
  }

  resume() {
    resetTouch();
    this.scene.stop();
    this.scene.resume('Level');
  }

  restart() {
    resetTouch();
    const level = this.scene.get('Level');
    this.scene.stop();
    this.scene.resume('Level');
    level.restartLevel();
  }

  toMenu() {
    resetTouch();
    this.scene.stop('HUD');
    this.scene.stop('Level');
    this.scene.start('Title');
  }
}
