import { RunStates } from '../config/runStates.js';

export default class UpgradeSystem {
  constructor(scene) {
    this.scene = scene;
    this.pending = 0;
    this.panelOpen = false;
  }

  reset() {
    this.pending = 0;
    this.panelOpen = false;
  }

  gainExperience(amount, { defer = false } = {}) {
    const data = this.scene.playerData;
    data.xp += amount;

    while (data.xp >= data.xpToNext) {
      data.xp -= data.xpToNext;
      data.level += 1;
      data.xpToNext += this.scene.balance.leveling.growth;
      this.pending += 1;
    }

    this.scene.hud?.updatePlayer(data);
    if (!defer) {
      this.maybeShow();
    }
  }

  maybeShow() {
    if (this.panelOpen || this.pending <= 0) return false;
    if ([RunStates.REWARD, RunStates.VICTORY, RunStates.DEFEAT].includes(this.scene.runState)) return false;
    if (this.scene.rewardPanel?.isOpen || this.scene.resultPanel?.isOpen) return false;

    this.panelOpen = true;
    this.scene.runState = RunStates.LEVEL_UP;
    this.scene.player?.body?.setVelocityX(0);
    this.scene.upgradePanel?.show();
    return true;
  }

  applyUpgrade(choice) {
    if (!this.panelOpen) return;

    const data = this.scene.playerData;
    if (choice === 'damage') data.damage += 8;
    if (choice === 'health') {
      data.maxHp += 20;
      data.hp = data.maxHp;
    }
    if (choice === 'speed') data.speedX += 18;

    this.pending = Math.max(0, this.pending - 1);
    this.scene.upgradePanel?.hide();
    this.panelOpen = false;
    this.scene.hud?.updatePlayer(data);
    this.scene.resumeModalFlow();
  }
}
