// Экранные кнопки для телефона: слева — ходьба, справа — прыжок и луч.
// Состояние считается каждый кадр по всем пальцам на экране, поэтому кнопки
// можно нажимать одновременно и «переползать» пальцем с одной на другую.
import { BRAND, textStyle } from '../brand.js';
import { touch } from '../input.js';
import { t } from '../content.js';

export class TouchControls {
  constructor(scene, visible) {
    this.scene = scene;
    this.visible = false;
    scene.input.addPointer(3);
    this.buttons = [
      { key: 'left', x: 82, y: 462, r: 48, icon: 'left' },
      { key: 'right', x: 196, y: 462, r: 48, icon: 'right' },
      { key: 'beam', x: 774, y: 476, r: 46, label: t('touch.beam'), accent: true },
      { key: 'jump', x: 884, y: 418, r: 54, label: t('touch.jump') },
    ];
    this.layer = scene.add.container(0, 0).setDepth(20);
    for (const b of this.buttons) {
      b.g = scene.add.graphics();
      this.layer.add(b.g);
      if (b.label) {
        b.text = scene.add.text(b.x, b.y, b.label, textStyle('head', 16, BRAND.white)).setOrigin(0.5);
        this.layer.add(b.text);
      }
      this.draw(b, false);
    }
    this.layer.setVisible(false);
    if (visible) this.show();
  }

  show() {
    this.visible = true;
    this.layer.setVisible(true);
  }

  draw(b, pressed) {
    const g = b.g;
    g.clear();
    g.fillStyle(b.accent ? BRAND.red : BRAND.blueDeep, pressed ? 0.85 : 0.45);
    g.fillCircle(b.x, b.y, b.r);
    g.lineStyle(3, BRAND.white, pressed ? 1 : 0.7);
    g.strokeCircle(b.x, b.y, b.r);
    g.fillStyle(BRAND.white, pressed ? 1 : 0.85);
    if (b.icon === 'left') g.fillTriangle(b.x - 18, b.y, b.x + 12, b.y - 18, b.x + 12, b.y + 18);
    if (b.icon === 'right') g.fillTriangle(b.x + 18, b.y, b.x - 12, b.y - 18, b.x - 12, b.y + 18);
    b.pressed = pressed;
  }

  update() {
    if (!this.visible) return;
    const state = { left: false, right: false, jump: false, beam: false };
    for (const p of this.scene.input.manager.pointers) {
      if (!p.isDown) continue;
      for (const b of this.buttons) {
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        // зона нажатия чуть больше нарисованной кнопки
        if (dx * dx + dy * dy <= (b.r + 16) * (b.r + 16)) state[b.key] = true;
      }
    }
    for (const b of this.buttons) {
      touch[b.key] = state[b.key];
      if (b.pressed !== state[b.key]) this.draw(b, state[b.key]);
    }
  }
}

