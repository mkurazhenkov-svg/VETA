// Движущиеся платформы: крюк крана (едет туда-обратно) и лифтовая клеть (вверх-вниз).
import Phaser from 'phaser';
import { SHADE } from '../brand.js';

export class MovingPlatform extends Phaser.Physics.Arcade.Image {
  /**
   * @param {'hook'|'lift'} type
   * @param {{ax:number, ay:number, bx:number, by:number, speed:number, pause?:number, phase?:number}} path
   *   ax/ay → bx/by — крайние точки (верх площадки), в пикселях
   */
  constructor(scene, type, path) {
    super(scene, path.ax, path.ay, type);
    this.type = type;
    this.path = path;
    scene.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(type === 'lift' ? 7 : 16);
    const len = Math.hypot(path.bx - path.ax, path.by - path.ay);
    this.duration = (len / path.speed) * 1000 || 1;
    this.pause = path.pause ?? 600;
    this.t = (path.phase || 0) * (this.duration * 2 + this.pause * 2);
    this.cable = scene.add.rectangle(0, 0, 1, 800, SHADE.blackMid).setOrigin(0.5, 1).setDepth(this.depth - 0.1);
  }

  setup() {
    const b = this.body;
    b.allowGravity = false;
    b.setImmovable(true);
    b.moves = false;
    const h = this.height;
    b.setSize(this.width, 6).setOffset(0, h - 6);
    this.place();
  }

  /** Позиция по времени: туда — пауза — обратно — пауза. */
  pos() {
    const { ax, ay, bx, by } = this.path;
    const D = this.duration;
    const P = this.pause;
    const cycle = 2 * D + 2 * P;
    const t = this.t % cycle;
    let k;
    if (t < D) k = t / D;
    else if (t < D + P) k = 1;
    else if (t < 2 * D + P) k = 1 - (t - D - P) / D;
    else k = 0;
    k = 0.5 - Math.cos(k * Math.PI) / 2; // плавный разгон и торможение
    return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k };
  }

  place() {
    const p = this.pos();
    // ay/by — верх площадки; спрайт привязан за низ
    this.setPosition(Math.round(p.x), Math.round(p.y + 6));
    this.body.updateFromGameObject();
    this.cable.setPosition(this.x, this.y - this.height + 1);
  }

  /** Сдвинуть платформу; возвращает смещение, чтобы «везти» стоящего героя. */
  step(dt) {
    const ox = this.x;
    const oy = this.y;
    this.t += dt;
    this.place();
    return { dx: this.x - ox, dy: this.y - oy };
  }
}
