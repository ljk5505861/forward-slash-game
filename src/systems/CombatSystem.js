export default class CombatSystem {
  constructor(scene) {
    this.scene = scene;
  }

  enterCombat(enemy) {
    if (!this.isEncounterable(enemy)) {
      return false;
    }

    this.scene.currentEnemy = enemy;
    this.scene.state = enemy.isBoss ? 'bossCombat' : 'combat';
    this.scene.player.body.setVelocityX(0);
    this.startEnemyAttackTimer(enemy);
    this.scene.hud?.setStatus(enemy.isBoss ? 'Boss 战开始！' : '遭遇敌人！');
    return true;
  }

  playerAttack() {
    const enemy = this.scene.currentEnemy;
    if (!this.isEncounterable(enemy) || !this.scene.canPlayerAttack) {
      return;
    }

    this.scene.canPlayerAttack = false;
    this.scene.time.delayedCall(this.scene.balance.player.attackCooldownMs, () => {
      this.scene.canPlayerAttack = true;
    });

    enemy.hp = Math.max(0, enemy.hp - this.scene.playerStats.damage);
    this.scene.hud?.updateEnemy(enemy);

    if (enemy.hp <= 0) {
      this.defeatCurrentEnemy(enemy);
    }
  }

  defeatCurrentEnemy(enemy = this.scene.currentEnemy) {
    if (!enemy || enemy.isDefeated) {
      return;
    }

    enemy.isDefeated = true;
    enemy.hp = 0;
    if (enemy.body) {
      enemy.body.enable = false;
      enemy.body.setVelocity(0, 0);
    }
    this.cancelEnemyAttackTimer(enemy);
    this.scene.encounterables.delete(enemy);

    if (this.scene.currentEnemy === enemy) {
      this.scene.currentEnemy = null;
    }

    this.scene.defeatedEnemies += enemy.isBoss ? 0 : 1;
    this.scene.hud?.updateEnemy(null);
    this.scene.upgradeSystem.gainExperience(enemy.xp || 0);

    if (!enemy.isBoss && this.scene.defeatedEnemies >= this.scene.balance.enemies.countBeforeBoss) {
      this.scene.spawnBoss();
    }

    if (enemy.isBoss) {
      this.scene.finishRun(true);
    } else if (this.scene.state !== 'levelUp') {
      this.scene.state = 'running';
      this.scene.hud?.setStatus('继续前进');
    }

    this.scene.tweens.add({
      targets: enemy,
      alpha: 0,
      duration: this.scene.balance.enemies.fadeMs,
      onComplete: () => enemy.destroy(),
    });
  }

  startEnemyAttackTimer(enemy) {
    this.cancelEnemyAttackTimer(enemy);
    enemy.attackTimer = this.scene.time.addEvent({
      delay: enemy.attackIntervalMs,
      loop: true,
      callback: () => {
        if (!this.isEncounterable(enemy) || this.scene.currentEnemy !== enemy || this.scene.state === 'levelUp') {
          return;
        }
        this.scene.playerStats.hp = Math.max(0, this.scene.playerStats.hp - enemy.damage);
        this.scene.hud?.updatePlayer(this.scene.playerStats);
        if (this.scene.playerStats.hp <= 0) {
          this.scene.finishRun(false);
        }
      },
    });
  }

  cancelEnemyAttackTimer(enemy) {
    enemy?.attackTimer?.remove(false);
    if (enemy) {
      enemy.attackTimer = null;
    }
  }

  isEncounterable(enemy) {
    return Boolean(enemy?.active && !enemy.isDefeated && enemy.hp > 0);
  }
}
