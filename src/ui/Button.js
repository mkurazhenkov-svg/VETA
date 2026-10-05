// Кнопки меню в фирменном стиле + управление с клавиатуры (стрелки, Enter).
import Phaser from 'phaser';
import { BRAND, SHADE, textStyle } from '../brand.js';
import { sfx, unlockAudio } from '../audio/sfx.js';

const STYLES = {
  primary: { fill: BRAND.red, hover: SHADE.redLight, text: BRAND.white, border: BRAND.red },
  secondary: { fill: BRAND.blue, hover: SHADE.blueLight, text: BRAND.white, border: BRAND.blue },
  ghost: { fill: BRAND.blueDeep, hover: SHADE.blueDeepLight, text: BRAND.white, border: BRAND.white },
  light: { fill: BRAND.white, hover: BRAND.gray, text: BRAND.blueDeep, border: BRAND.white },
};

export class Button extends Phaser.GameObjects.Container {
  constructor(scene, x, y, label, onClick, { w = 300, h = 52, style = 'secondary', size = 21 } = {}) {
    super(scene, x, y);
    this.w = w;
    this.h = h;
    this.st = STYLES[style];
    this.onClick = onClick;
    this.bg = scene.add.rectangle(0, 0, w, h, this.st.fill).setStrokeStyle(2, this.st.border);
    this.focusRing = scene.add.rectangle(0, 0, w + 10, h + 10).setStrokeStyle(2, BRAND.white).setVisible(false);
    this.label = scene.add.text(0, 1, label, textStyle('head', size, this.st.text)).setOrigin(0.5);
    this.add([this.focusRing, this.bg, this.label]);
    scene.add.existing(this);
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => this.setHover(true));
    this.bg.on('pointerout', () => {
      this.setHover(false);
      this.setScale(1);
    });
    this.bg.on('pointerdown', () => this.setScale(0.97));
    this.bg.on('pointerup', () => {
      this.setScale(1);
      this.fire();
    });
  }

  fire() {
    if (this.disabled) return;
    unlockAudio();
    sfx.click();
    this.onClick?.();
  }

  setHover(on) {
    this.bg.setFillStyle(on ? this.st.hover : this.st.fill);
  }

  setFocus(on) {
    this.focusRing.setVisible(on);
    this.setHover(on);
  }

  setLabel(text) {
    this.label.setText(text);
    return this;
  }
}

/** Навигация по кнопкам с клавиатуры: ↑ ↓ — выбор, Enter/Пробел — нажать. */
export class MenuNav {
  constructor(scene, buttons, { escape } = {}) {
    this.scene = scene;
    this.buttons = buttons;
    this.i = -1;
    const kb = scene.input.keyboard;
    this.handlers = {
      'keydown-DOWN': () => this.move(1),
      'keydown-UP': () => this.move(-1),
      'keydown-TAB': (e) => {
        e.preventDefault?.();
        this.move(1);
      },
      'keydown-ENTER': () => this.press(),
      'keydown-SPACE': () => this.press(),
    };
    if (escape) this.handlers['keydown-ESC'] = () => escape();
    for (const [ev, fn] of Object.entries(this.handlers)) kb.on(ev, fn);
    scene.events.once('shutdown', () => this.destroy());
  }

  move(d) {
    const vis = this.buttons.filter((b) => b.visible);
    if (!vis.length) return;
    const cur = vis.indexOf(this.buttons[this.i]);
    const next = vis[(cur + d + vis.length) % vis.length];
    this.buttons.forEach((b) => b.setFocus(false));
    this.i = this.buttons.indexOf(next);
    next.setFocus(true);
    sfx.click();
  }

  press() {
    const b = this.buttons[this.i] || this.buttons.find((x) => x.visible);
    if (b) b.fire();
  }

  destroy() {
    const kb = this.scene.input?.keyboard;
    if (!kb) return;
    for (const [ev, fn] of Object.entries(this.handlers)) kb.off(ev, fn);
  }
}
