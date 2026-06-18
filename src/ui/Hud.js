export default class Hud {
  constructor(scene) {
    this.scene = scene;
    this.status = scene.add.text(18, 88, '', { fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setScrollFactor(0).setDepth(2000);
    this.player = scene.add.text(18, 122, '', { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setScrollFactor(0).setDepth(2000);
    this.enemy = scene.add.text(18, 154, '', { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#ffe5e5', stroke: '#000000', strokeThickness: 4 }).setScrollFactor(0).setDepth(2000);
  }

  setStatus(message) { this.status.setText(message); }

  updatePlayer(stats) {
    this.player.setText(`Lv.${stats.level} HP ${stats.hp}/${stats.maxHp} XP ${stats.xp}/${stats.xpToNext} ATK ${stats.damage}`);
  }

  updateEnemy(enemy) {
    this.enemy.setText(enemy ? `${enemy.isBoss ? 'Boss' : '敌人'} HP ${enemy.hp}/${enemy.maxHp}` : '');
  }

  destroy() {
    this.status.destroy();
    this.player.destroy();
    this.enemy.destroy();
  }
}
