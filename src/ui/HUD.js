// HUD — интерфейс поверх уровня: каски слева, папка дела по центру, счёт справа,
// пауза, всплывающие подсказки, кнопка-действие и экранные кнопки на телефоне.
import Phaser from 'phaser';
import { BRAND, SHADE, textStyle, CornerFrame } from '../brand.js';
import { t } from '../content.js';
import { bus } from '../bus.js';
import { DOCS } from '../state.js';
import { DOC_VARIANT } from '../gfx/textures.js';
import { TouchControls } from './TouchControls.js';
import { isTouchDevice } from '../input.js';
import { Button } from './Button.js';

export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    this.add.rectangle(0, 0, 960, 58, SHADE.blueNight, 0.6).setOrigin(0);
    this.add.rectangle(0, 58, 960, 2, BRAND.blueDeep, 0.8).setOrigin(0);

    // каски
    this.helms = [];
    // папка дела
    const slotW = 30;
    const gap = 14;
    const total = 9 * slotW + 2 * gap;
    const x0 = 480 - total / 2 + slotW / 2 + 40;
    this.add.rectangle(480 + 20, 29, total + 104, 48, BRAND.blueDeep, 0.95).setStrokeStyle(1, BRAND.blue);
    new CornerFrame(this, 480 + 20 - (total + 104) / 2, 5, total + 104, 48, { thickness: 3, length: 12 });
    this.add.text(480 + 20 - (total + 104) / 2 + 14, 29, t('hud.folder').replace(' ', '\n'), textStyle('bold', 11, BRAND.white, { align: 'left' })).setOrigin(0, 0.5);
    this.slots = DOCS.map((d, i) => {
      const x = x0 + i * slotW + Math.floor(i / 3) * gap;
      const empty = this.add.image(x, 29, 'docEmpty').setScale(1.6);
      const icon = this.add.image(x, 29, 'doc', DOC_VARIANT[d.id]).setScale(1.6).setVisible(false);
      const chk = this.add.image(x + 8, 37, 'check').setVisible(false);
      return { id: d.id, empty, icon, chk };
    });

    // счёт
    this.scoreText = this.add.text(888, 29, '0', textStyle('pixel', 30, BRAND.white, { stroke: '#1a1a1a', strokeThickness: 4 })).setOrigin(1, 0.5);

    // пауза
    const pb = this.add.rectangle(930, 29, 42, 42, BRAND.blue).setStrokeStyle(2, BRAND.white).setInteractive({ useHandCursor: true });
    this.add.rectangle(924, 29, 5, 18, BRAND.white);
    this.add.rectangle(936, 29, 5, 18, BRAND.white);
    pb.on('pointerdown', () => bus.emit('pause'));

    // уведомления
    this.toastBox = this.add.container(480, 100).setVisible(false).setDepth(10);
    this.hintBox = this.add.container(480, 0).setVisible(false).setDepth(9);
    this.banner = this.add.container(480, 210).setDepth(11);

    // кнопка-действие (ходатайство у босса)
    this.actionBtn = new Button(this, 480, 446, '', () => bus.emit('action'), { w: 480, h: 58, style: 'primary', size: 21 });
    this.actionBtn.setVisible(false).setDepth(12);
    this.actionKey = this.add.text(480, 490, 'E / Enter', textStyle('bold', 14, BRAND.white)).setOrigin(0.5).setVisible(false);

    this.touchMode = isTouchDevice();
    this.touch = new TouchControls(this, this.touchMode);
    // если на ноутбуке с сенсорным экраном коснулись экрана — тоже показываем кнопки
    this.input.on('pointerdown', (p) => {
      if (p.wasTouch && !this.touch.visible) this.touch.show();
    });

    this.handlers = {
      'hud:health': (cur, max) => this.setHealth(cur, max),
      'hud:docs': (ids, newId) => this.setDocs(ids, newId),
      'hud:score': (n) => this.setScore(n),
      'hud:toast': (title, sub, kind, ms) => this.showToast(title, sub, kind, ms),
      'hud:hint': (text) => this.showHint(text),
      'hud:banner': (a, b) => this.showBanner(a, b),
      'hud:action': (label) => this.showAction(label),
    };
    for (const [ev, fn] of Object.entries(this.handlers)) bus.on(ev, fn);
    this.events.once('shutdown', () => {
      for (const [ev, fn] of Object.entries(this.handlers)) bus.off(ev, fn);
    });
  }

  update() {
    this.touch.update();
  }

  setHealth(cur, max) {
    if (this.helms.length !== max) {
      this.helms.forEach((h) => h.destroy());
      this.helms = [];
      for (let i = 0; i < max; i++) this.helms.push(this.add.image(30 + i * 38, 29, 'helm').setScale(2.2));
    }
    this.helms.forEach((h, i) => {
      const full = i < cur;
      const was = h.texture.key === 'helm';
      h.setTexture(full ? 'helm' : 'helmEmpty');
      if (was && !full) this.tweens.add({ targets: h, scale: { from: 3, to: 2.2 }, duration: 250 });
    });
  }

  setDocs(ids, newId) {
    for (const s of this.slots) {
      const has = ids.includes(s.id);
      s.icon.setVisible(has);
      s.chk.setVisible(has);
      s.empty.setVisible(!has);
      if (s.id === newId) {
        this.tweens.add({ targets: s.icon, scale: { from: 3.2, to: 1.6 }, duration: 400, ease: 'Back.easeOut' });
        this.tweens.add({ targets: s.chk, scale: { from: 2.5, to: 1 }, duration: 400, delay: 150, ease: 'Back.easeOut' });
      }
    }
  }

  setScore(n) {
    this.scoreText.setText(String(n));
    this.tweens.add({ targets: this.scoreText, scale: { from: 1.18, to: 1 }, duration: 200 });
  }

  showToast(title, sub, kind = 'info', ms = 2200) {
    const c = this.toastBox;
    c.removeAll(true);
    this.tweens.killTweensOf(c);
    const titleT = this.add.text(0, 0, title, textStyle('head', 19, BRAND.white, { align: 'center', wordWrap: { width: 620, useAdvancedWrap: true } })).setOrigin(0.5, 0);
    let h = titleT.height;
    let subT;
    if (sub) {
      subT = this.add.text(0, h + 4, sub, textStyle('text', 16, BRAND.white, { align: 'center', wordWrap: { width: 620, useAdvancedWrap: true } })).setOrigin(0.5, 0);
      h += 4 + subT.height;
    }
    const w = Math.max(titleT.width, subT ? subT.width : 0) + 60;
    const accent = kind === 'warn' ? BRAND.red : kind === 'doc' || kind === 'ok' ? BRAND.red : BRAND.blue;
    const bg = this.add.rectangle(0, -10, w, h + 20, BRAND.blueDeep, 0.96).setOrigin(0.5, 0).setStrokeStyle(2, kind === 'warn' ? BRAND.red : BRAND.blue);
    const bar = this.add.rectangle(-w / 2, -10, 6, h + 20, accent).setOrigin(0, 0);
    c.add([bg, bar, titleT]);
    if (subT) c.add(subT);
    if (kind === 'doc' || kind === 'ok') c.add(this.add.image(-w / 2 + 24, h / 2, 'check').setScale(1.6));
    // если сверху висит подсказка — уведомление встаёт под ней
    const y = this.hintBox.visible && this.hintBox.alpha > 0.05 ? this.hintBox.y + this.hintH / 2 + 16 : 78;
    c.setVisible(true).setAlpha(1).setY(y);
    this.tweens.add({ targets: c, y: { from: y - 10, to: y }, duration: 160 });
    this.tweens.add({ targets: c, alpha: 0, delay: ms || 2200, duration: 300, onComplete: () => c.setVisible(false) });
  }

  showHint(text) {
    const c = this.hintBox;
    c.removeAll(true);
    this.tweens.killTweensOf(c);
    const maxW = 680;
    const tx = this.add.text(0, 0, text, textStyle('bold', 17, BRAND.white, { align: 'center', wordWrap: { width: maxW - 40, useAdvancedWrap: true } })).setOrigin(0.5);
    const w = Math.max(320, tx.width + 48);
    const h = tx.height + 28;
    const bg = this.add.rectangle(0, 0, w, h, BRAND.blueDeep, 0.95);
    const frame = new CornerFrame(this, -w / 2, -h / 2, w, h, { thickness: 4, length: 16 });
    c.add([bg, frame, tx]);
    // подсказка — сверху, под панелью HUD: внизу она закрывала бы героя и кнопки
    this.hintH = h;
    const y = 66 + h / 2;
    c.setPosition(480, y).setVisible(true).setAlpha(0);
    if (this.toastBox.visible) this.toastBox.setY(y + h / 2 + 16);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    this.tweens.add({ targets: c, alpha: 0, delay: 7000, duration: 400, onComplete: () => c.setVisible(false) });
  }

  showBanner(top, main) {
    const c = this.banner;
    c.removeAll(true);
    const a = this.add.text(0, -30, top, textStyle('head', 22, BRAND.red, { stroke: '#ffffff', strokeThickness: 0 })).setOrigin(0.5);
    const b = this.add.text(0, 12, main, textStyle('head', 52, BRAND.white, { stroke: '#01376b', strokeThickness: 8 })).setOrigin(0.5);
    c.add([a, b]).setAlpha(0).setScale(0.9);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 2200, duration: 500 });
  }

  showAction(label) {
    const on = !!label;
    if (on) this.actionBtn.setLabel(label);
    this.actionBtn.setVisible(on);
    this.actionKey.setVisible(on && !this.touch.visible);
    if (on) this.tweens.add({ targets: this.actionBtn, scale: { from: 0.8, to: 1 }, duration: 300, ease: 'Back.easeOut' });
  }
}
