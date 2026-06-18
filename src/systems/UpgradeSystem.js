import Phaser from 'phaser';

const BLOCKING_STATES = new Set(['reward', 'victory', 'defeat', 'ended']);

export default class UpgradeSystem {
  constructor(scene) {
    this.scene = scene;
    this.panelOpen = false;
  }

  gainExperience(amount, { defer = false } = {}) {
    this.scene.playerStats.xp += amount;
    this.scene.hud?.updatePlayer(this.scene.playerStats);

    if (!defer && this.canShowUpgrade()) {
      this.maybeShow();
    }
  }

  hasPendingLevelUp() {
    return this.scene.playerStats.xp >= this.scene.playerStats.xpToNext;
  }

  canShowUpgrade() {
    if (this.panelOpen || this.scene.upgradeCards?.length) return false;
    if (this.scene.rewardPanel?.visible || this.scene.resultPanel?.visible) return false;
    if (BLOCKING_STATES.has(this.scene.state)) return false;
    return this.hasPendingLevelUp();
  }

  maybeShow() {
    if (!this.canShowUpgrade()) {
      return false;
    }

    this.scene.stateBeforeLevelUp = this.scene.state;
    this.scene.state = 'levelUp';
    this.panelOpen = true;
    this.scene.player.body.setVelocityX(0);
    this.scene.showUpgradeChoices();
    return true;
  }

  applyUpgrade(choice) {
    if (!this.panelOpen) {
      return;
    }

    const stats = this.scene.playerStats;
    stats.xp -= stats.xpToNext;
    stats.level += 1;
    stats.xpToNext += this.scene.balance.leveling.growth;

    if (choice === 'damage') stats.damage += 8;
    if (choice === 'health') stats.maxHp += 20;
    if (choice === 'health') stats.hp = stats.maxHp;
    if (choice === 'speed') stats.speedX += 18;

    this.scene.hideUpgradeChoices();
    this.panelOpen = false;
    this.scene.hud?.updatePlayer(stats);
    this.scene.resumeAfterModal();
  }

  reset() {
    this.panelOpen = false;
  }

  restoreStateAfterLevelUp() {
    const enemy = this.scene.currentEnemy;
    const wasRealCombat = ['combat', 'bossCombat'].includes(this.scene.stateBeforeLevelUp)
      && this.scene.combatSystem.isEncounterable(enemy)
      && Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, enemy.x, enemy.y) <= this.scene.balance.player.encounterDistance;

    this.scene.stateBeforeLevelUp = null;
    return wasRealCombat ? (enemy.isBoss ? 'bossCombat' : 'combat') : null;
  }
}
