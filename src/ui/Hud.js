import PlayerHealthBar from './PlayerHealthBar.js';

const HUD_CENTER_X = 360;

export default class Hud {
  constructor(scene) {
    this.scene = scene;
    this.status = scene.add.text(18, 84, '', { fontFamily: 'Arial', fontSize: '24px', color: '#fff', stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(2000);
    this.stage = scene.add.text(18, 120, '', { fontFamily: 'Arial', fontSize: '22px', color: '#fff', stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(2000);
    this.vitals = scene.add.text(18, 154, '', { fontFamily: 'Arial', fontSize: '22px', color: '#fff', stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(2000);
    this.boss = scene.add.text(HUD_CENTER_X, 78, '', { fontFamily: 'Arial', fontSize: '24px', color: '#ffd1ff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    this.playerHealthBar = new PlayerHealthBar(scene);
  }

  setStatus(message) { this.status.setText(message); }

  setStage(stageNumber) { this.stage.setText(`阶段：${stageNumber}`); }

  update() {
    const p = this.scene.playerData;
    this.vitals.setText(`Lv.${p.level}  HP ${p.hp}/${p.maxHp}  MP ${p.mana ?? 0}/${p.maxMana ?? 0}  XP ${p.xp}/${p.xpToNext}`);
    this.playerHealthBar.update();
    const boss = this.scene.enemies.find(e => e.isBoss);
    this.boss.setText(boss ? `${boss.name} ${boss.hp}/${boss.maxHp}` : '');
  }

  destroy() {
    [this.status, this.stage, this.vitals, this.boss].forEach(x => x.destroy());
    this.playerHealthBar.destroy();
  }
}
