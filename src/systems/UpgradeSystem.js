import Phaser from 'phaser';
export default class UpgradeSystem {
  constructor(scene) {
    this.scene = scene;
  }

  gainExperience(amount) {
    this.scene.playerStats.xp += amount;
    this.scene.hud?.updatePlayer(this.scene.playerStats);
    this.checkLevelUp();
  }

  checkLevelUp() {
    if (this.scene.state === 'levelUp') {
      return;
    }
    if (this.scene.playerStats.xp < this.scene.playerStats.xpToNext) {
      return;
    }

    this.scene.stateBeforeLevelUp = this.scene.state;
    this.scene.state = 'levelUp';
    this.scene.player.body.setVelocityX(0);
    this.scene.showUpgradeChoices();
  }

  applyUpgrade(choice) {
    const stats = this.scene.playerStats;
    stats.xp -= stats.xpToNext;
    stats.level += 1;
    stats.xpToNext += this.scene.balance.leveling.growth;

    if (choice === 'damage') stats.damage += 8;
    if (choice === 'health') stats.maxHp += 20;
    if (choice === 'health') stats.hp = stats.maxHp;
    if (choice === 'speed') stats.speedX += 18;

    this.scene.hideUpgradeChoices();
    this.scene.hud?.updatePlayer(stats);
    this.restoreStateAfterLevelUp();
    this.checkLevelUp();
  }

  restoreStateAfterLevelUp() {
    const enemy = this.scene.currentEnemy;
    const wasRealCombat = ['combat', 'bossCombat'].includes(this.scene.stateBeforeLevelUp)
      && this.scene.combatSystem.isEncounterable(enemy)
      && Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, enemy.x, enemy.y) <= this.scene.balance.player.encounterDistance;

    this.scene.state = wasRealCombat ? (enemy.isBoss ? 'bossCombat' : 'combat') : 'running';
    this.scene.stateBeforeLevelUp = null;
  }
}
