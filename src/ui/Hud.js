import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';
import { UI } from '../config/balance.js';

export default class Hud {
  constructor(scene) {
    this.scene = scene;
    this.objects = [];
    this.create();
  }

  add(object) {
    object.setScrollFactor(0).setDepth(1000);
    this.objects.push(object);
    return object;
  }

  create() {
    const s = this.scene;
    this.hpBack = this.add(s.add.rectangle(24, 28, 300, 28, 0x333333).setOrigin(0));
    this.hpFill = this.add(s.add.rectangle(24, 28, 300, 28, 0x36d15f).setOrigin(0));
    this.hpText = this.add(s.add.text(34, 30, '', { fontSize: '20px', color: '#fff', fontFamily: 'Arial' }));
    this.lvText = this.add(s.add.text(24, 66, '', { fontSize: '22px', color: '#14324a', fontStyle: 'bold', fontFamily: 'Arial' }));
    this.expBack = this.add(s.add.rectangle(110, 70, 250, 16, 0x333333).setOrigin(0));
    this.expFill = this.add(s.add.rectangle(110, 70, 250, 16, 0xffd447).setOrigin(0));
    this.killText = this.add(s.add.text(390, 30, '', { fontSize: '22px', color: '#14324a', fontStyle: 'bold', fontFamily: 'Arial' }));
    this.bossName = this.add(s.add.text(DESIGN_WIDTH / 2, 102, '', { fontSize: '24px', color: '#5b247a', fontStyle: 'bold', fontFamily: 'Arial' }).setOrigin(0.5));
    this.bossBack = this.add(s.add.rectangle(120, 134, 480, 22, 0x333333).setOrigin(0));
    this.bossFill = this.add(s.add.rectangle(120, 134, 480, 22, 0x8e44ad).setOrigin(0));
    this.message = this.add(s.add.text(DESIGN_WIDTH / 2, 260, '', { fontSize: '36px', color: '#fff', stroke: '#14324a', strokeThickness: 6, fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5));
    this.attackButton = this.add(s.add.circle(DESIGN_WIDTH - UI.attackButtonRadius - UI.safeMargin, DESIGN_HEIGHT - UI.attackButtonRadius - UI.safeMargin, UI.attackButtonRadius, 0xff6b35, 0.9).setStrokeStyle(6, 0xffffff).setInteractive({ useHandCursor: true }));
    this.attackLabel = this.add(s.add.text(this.attackButton.x, this.attackButton.y, '攻击', { fontSize: '30px', color: '#fff', fontStyle: 'bold', fontFamily: 'Arial' }).setOrigin(0.5));
    this.setBossVisible(false);
  }

  update(data) {
    this.hpFill.width = 300 * Math.max(0, data.player.hp / data.player.maxHp);
    this.hpText.setText(`HP ${Math.ceil(data.player.hp)} / ${data.player.maxHp}`);
    this.lvText.setText(`Lv.${data.level}`);
    this.expFill.width = 250 * Math.min(1, data.exp / data.expToNext);
    this.killText.setText(`击杀 ${data.kills} / ${data.bossKillsRequired}`);
    if (data.boss) {
      this.setBossVisible(true);
      this.bossName.setText(data.boss.name);
      this.bossFill.width = 480 * Math.max(0, data.boss.hp / data.boss.maxHp);
    } else {
      this.setBossVisible(false);
    }
  }

  setAttackReady(ready) {
    this.attackButton.setFillStyle(ready ? 0xff6b35 : 0x555555, ready ? 0.9 : 0.65);
  }

  flashButton() {
    this.scene.tweens.add({ targets: [this.attackButton, this.attackLabel], scale: 0.9, duration: 60, yoyo: true });
  }

  showMessage(text, duration = 900) {
    this.message.setText(text).setAlpha(1);
    this.scene.tweens.add({ targets: this.message, alpha: 0, delay: duration, duration: 250 });
  }

  setBossVisible(visible) {
    [this.bossName, this.bossBack, this.bossFill].forEach((o) => o.setVisible(visible));
  }

  destroy() {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
  }
}
