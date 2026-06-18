import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';
import { BOSS_BASE, ENEMY_BASE, PLAYER_BASE, PROGRESSION, WORLD } from '../config/balance.js';
import CombatSystem from '../systems/CombatSystem.js';
import UpgradeSystem from '../systems/UpgradeSystem.js';
import Hud from '../ui/Hud.js';

const PLAYER_SIZE = { width: 80, height: 140 };
const ENEMY_SIZE = { width: 76, height: 126 };
const BOSS_SIZE = { width: 135, height: 210 };
const updateDebugStatus = (message) => window.updateGameDebugStatus?.(message);

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.state = 'starting';
  }

  create() {
    try {
      this.combat = new CombatSystem(this);
      this.upgrades = new UpgradeSystem();
      this.startRun();
    } catch (error) {
      this.showInitError(error);
      throw error;
    }
  }

  update() {
    if (this.state === 'running') this.updateRunning();
    this.updateDebugBar();
  }

  startRun() {
    this.cleanupRound();
    this.state = 'starting';
    this.playerStats = { ...PLAYER_BASE };
    this.level = PROGRESSION.level;
    this.exp = PROGRESSION.exp;
    this.expToNext = PROGRESSION.expToNext;
    this.kills = 0;
    this.enemyAttackEvent = null;
    this.currentEnemy = null;
    this.bossSpawned = false;
    this.enemyAttackCount = 0;
    this.canPlayerAttack = true;
    this.createWorld();
    this.createPlayer();
    this.hud = new Hud(this);
    this.hud.attackButton.on('pointerdown', () => this.performPlayerAttack());
    this.spawnEnemies();
    this.cameras.main.startFollow(this.player, false, 1, 0, DESIGN_WIDTH * 0.2, 0);
    this.state = 'running';
    this.hud.showMessage('开始游戏');
  }

  createWorld() {
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height).setBackgroundColor('#8fd3ff');
    this.worldObjects = [];
    this.worldObjects.push(this.add.rectangle(WORLD.width / 2, WORLD.groundTop + WORLD.groundHeight / 2, WORLD.width, WORLD.groundHeight, 0x2fa84f).setDepth(1));
    for (let x = 500; x < WORLD.width; x += 900) {
      this.worldObjects.push(this.add.rectangle(x, WORLD.groundTop - 90, 14, 180, 0x777777, 0.7));
      this.worldObjects.push(this.add.text(x + 20, WORLD.groundTop - 170, `${x}m`, { fontSize: '24px', color: '#555', stroke: '#fff', strokeThickness: 4 }));
      this.worldObjects.push(this.add.rectangle(x + 260, WORLD.groundTop - 130, 300, 90, 0x99d98c, 0.5));
      this.worldObjects.push(this.add.circle(x - 180, 160, 34, 0xffffff, 0.75));
      this.worldObjects.push(this.add.circle(x - 135, 160, 42, 0xffffff, 0.75));
    }
    this.groundBody = this.add.rectangle(WORLD.width / 2, WORLD.groundTop + WORLD.groundHeight / 2, WORLD.width, WORLD.groundHeight, 0x000000, 0);
    this.physics.add.existing(this.groundBody, true);
  }

  createPlayer() {
    this.player = this.add.rectangle(WORLD.playerStartX, WORLD.playerY, PLAYER_SIZE.width, PLAYER_SIZE.height, 0x1687ff).setStrokeStyle(8, 0x0b4fb3).setDepth(20);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true).setSize(PLAYER_SIZE.width, PLAYER_SIZE.height);
    this.physics.add.collider(this.player, this.groundBody);
  }

  spawnEnemies() {
    this.enemies = [];
    let x = 780;
    for (let i = 0; i < WORLD.bossKillsRequired; i += 1) {
      const tier = Math.floor(i / 3);
      const scale = 1 + tier * 0.1;
      x += 450 + ((i * 73) % 200);
      this.enemies.push(this.createEnemy(x, { ...ENEMY_BASE, maxHp: Math.round(ENEMY_BASE.maxHp * scale), hp: Math.round(ENEMY_BASE.hp * scale), attack: Math.round(ENEMY_BASE.attack * scale), index: i + 1, isBoss: false }));
    }
  }

  createEnemy(x, stats) {
    const size = stats.isBoss ? BOSS_SIZE : ENEMY_SIZE;
    const color = stats.isBoss ? 0x8e44ad : 0xd83a34;
    const rect = this.add.rectangle(x, WORLD.playerY, size.width, size.height, color).setStrokeStyle(6, 0x552222).setDepth(18);
    rect.stats = stats;
    this.physics.add.existing(rect);
    rect.body.setAllowGravity(true).setImmovable(true).setSize(size.width, size.height);
    this.physics.add.collider(rect, this.groundBody);
    if (stats.isBoss) {
      rect.nameLabel = this.add.text(x, WORLD.playerY - 150, stats.name, { fontSize: '30px', color: '#5b247a', stroke: '#fff', strokeThickness: 5, fontStyle: 'bold' }).setOrigin(0.5).setDepth(19);
    }
    return rect;
  }

  updateRunning() {
    this.player.body.setVelocityX(this.playerStats.moveSpeed);
    this.checkEncounter();
    this.refreshHud();
  }

  checkEncounter() {
    const next = this.enemies.find((enemy) => enemy.active && enemy.x > this.player.x);
    if (!next && !this.bossSpawned && this.kills >= WORLD.bossKillsRequired) this.spawnBoss();
    const target = next || this.currentEnemy;
    if (target?.active && target.x - this.player.x <= WORLD.encounterDistance) this.enterCombat(target);
  }

  enterCombat(enemy) {
    this.currentEnemy = enemy;
    this.player.body.setVelocityX(0);
    this.state = enemy.stats.isBoss ? 'bossCombat' : 'combat';
    this.enemyAttackCount = 0;
    this.hud.showMessage(enemy.stats.isBoss ? 'Boss 出现' : '遇到敌人');
    this.enemyAttackEvent?.remove(false);
    this.enemyAttackEvent = this.time.addEvent({ delay: enemy.stats.attackInterval, loop: true, callback: () => this.performEnemyAttack() });
  }

  performPlayerAttack() {
    if (!['combat', 'bossCombat'].includes(this.state) || !this.canPlayerAttack || !this.currentEnemy?.active) return;
    this.canPlayerAttack = false;
    this.hud.setAttackReady(false);
    this.hud.flashButton();
    const previousState = this.state;
    this.state = 'playerAttacking';
    const range = this.add.rectangle(this.player.x + 85, this.player.y, this.playerStats.attackRange, 105, 0xffe066, 0.35).setDepth(16);
    this.tweens.add({ targets: this.player, x: this.player.x + 36, duration: 90, yoyo: true });
    const overlaps = Math.abs(range.x - this.currentEnemy.x) < (this.playerStats.attackRange / 2 + this.currentEnemy.width / 2);
    if (overlaps) this.applyDamageToEnemy(this.combat.rollPlayerDamage(this.playerStats));
    this.time.delayedCall(170, () => range.destroy());
    this.time.delayedCall(260, () => { if (!['victory', 'defeat', 'levelUp'].includes(this.state)) this.state = previousState; });
    this.time.delayedCall(1000 / this.playerStats.attackSpeed, () => { this.canPlayerAttack = true; this.hud?.setAttackReady(true); });
  }

  performEnemyAttack() {
    if (!['combat', 'bossCombat'].includes(this.state) || !this.currentEnemy?.active) return;
    const enemy = this.currentEnemy;
    this.state = 'enemyAttacking';
    this.enemyAttackCount += 1;
    const strong = enemy.stats.isBoss && this.enemyAttackCount % 3 === 0;
    if (strong) this.hud.showMessage('强攻击警告', 450);
    this.tweens.add({ targets: enemy, x: enemy.x - 28, duration: 100, yoyo: true, onComplete: () => {
      this.applyDamageToPlayer(this.combat.enemyDamage(enemy.stats, this.playerStats, strong ? 1.8 : 1));
      if (this.state !== 'defeat') this.state = enemy.stats.isBoss ? 'bossCombat' : 'combat';
    }});
  }

  applyDamageToEnemy(result) {
    const enemy = this.currentEnemy;
    enemy.stats.hp -= result.damage;
    this.floatText(enemy.x, enemy.y - 100, `${result.damage}`, result.critical ? '#ffd447' : '#ffffff');
    if (result.critical) this.hud.showMessage('暴击！', 350);
    this.tweens.add({ targets: enemy, fillColor: 0xffffff, duration: 70, yoyo: true });
    if (enemy.stats.hp <= 0) this.defeatCurrentEnemy();
  }

  applyDamageToPlayer(damage) {
    this.playerStats.hp = Math.max(0, this.playerStats.hp - damage);
    this.floatText(this.player.x, this.player.y - 110, `-${damage}`, '#ff4040');
    this.tweens.add({ targets: this.player, fillColor: 0xffeeee, duration: 80, yoyo: true });
    if (this.playerStats.hp <= 0) this.enterDefeat();
  }

  defeatCurrentEnemy() {
    const enemy = this.currentEnemy;
    this.enemyAttackEvent?.remove(false);
    this.enemyAttackEvent = null;
    this.hud.showMessage('敌人已击败');
    this.tweens.add({ targets: [enemy, enemy.nameLabel].filter(Boolean), alpha: 0, scale: 0.1, duration: 250, onComplete: () => { enemy.nameLabel?.destroy(); enemy.destroy(); } });
    if (enemy.stats.isBoss) { this.enterVictory(); return; }
    this.kills += 1;
    this.gainExperience(enemy.stats.exp);
    if (this.playerStats.killHeal) this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + this.playerStats.killHeal);
    this.currentEnemy = null;
    if (this.kills >= WORLD.bossKillsRequired) this.spawnBoss();
    if (this.state !== 'levelUp') this.state = 'running';
  }

  gainExperience(amount) {
    this.exp += amount;
    if (this.exp >= this.expToNext) this.checkLevelUp();
  }

  checkLevelUp() {
    this.exp -= this.expToNext;
    this.expToNext = Math.round(this.expToNext * PROGRESSION.expGrowth);
    this.level += 1;
    this.showUpgradeChoices();
  }

  showUpgradeChoices() {
    this.state = 'levelUp';
    this.hud.showMessage('升级！请选择强化', 1200);
    this.upgradeObjects = [];
    const panel = this.add.rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, 620, 520, 0x10243a, 0.94).setScrollFactor(0).setDepth(2000);
    this.upgradeObjects.push(panel);
    this.upgrades.getChoices().forEach((choice, index) => {
      const y = DESIGN_HEIGHT / 2 - 150 + index * 150;
      const card = this.add.rectangle(DESIGN_WIDTH / 2, y, 520, 110, 0xffffff, 0.96).setScrollFactor(0).setDepth(2001).setInteractive();
      const text = this.add.text(DESIGN_WIDTH / 2, y, choice.title, { fontSize: '28px', color: '#14324a', align: 'center', fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
      card.on('pointerdown', () => this.applyUpgrade(choice));
      this.upgradeObjects.push(card, text);
    });
  }

  applyUpgrade(choice) {
    this.upgrades.applyUpgrade(choice, this.playerStats);
    this.upgradeObjects.forEach((o) => o.destroy());
    this.upgradeObjects = [];
    this.state = this.currentEnemy?.active ? (this.currentEnemy.stats.isBoss ? 'bossCombat' : 'combat') : 'running';
  }

  spawnBoss() {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    const boss = this.createEnemy(this.player.x + 650, { ...BOSS_BASE, isBoss: true });
    this.currentEnemy = boss;
    this.enemies.push(boss);
    this.hud.showMessage('Boss 出现');
  }

  enterVictory() { this.finishRound('victory'); }
  enterDefeat() { this.finishRound('defeat'); }

  finishRound(result) {
    this.state = result;
    this.player.body?.setVelocityX(0);
    this.enemyAttackEvent?.remove(false);
    this.hud.showMessage(result === 'victory' ? '胜利' : '失败');
    const title = result === 'victory' ? '挑战成功' : '挑战失败';
    const lines = [title, `本局等级 Lv.${this.level}`, `击杀数量 ${this.kills}`, result === 'victory' ? `剩余生命 ${Math.ceil(this.playerStats.hp)}` : ''];
    this.resultObjects = [];
    this.resultObjects.push(this.add.rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, 600, 500, 0x111111, 0.9).setScrollFactor(0).setDepth(3000));
    this.resultObjects.push(this.add.text(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - 150, lines.filter(Boolean).join('\n'), { fontSize: '34px', color: '#fff', align: 'center', fontFamily: 'Arial', lineSpacing: 16 }).setOrigin(0.5).setScrollFactor(0).setDepth(3001));
    const btn = this.add.rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 + 150, 300, 90, 0xff6b35).setScrollFactor(0).setDepth(3001).setInteractive();
    const txt = this.add.text(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 + 150, '重新开始', { fontSize: '32px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
    btn.on('pointerdown', () => this.restartGame());
    this.resultObjects.push(btn, txt);
  }

  restartGame() { this.startRun(); }

  floatText(x, y, text, color) {
    const label = this.add.text(x, y, text, { fontSize: '32px', color, stroke: '#000', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5).setDepth(1200);
    this.tweens.add({ targets: label, y: y - 70, alpha: 0, duration: 650, onComplete: () => label.destroy() });
  }

  refreshHud() {
    this.hud?.update({ player: this.playerStats, level: this.level, exp: this.exp, expToNext: this.expToNext, kills: this.kills, bossKillsRequired: WORLD.bossKillsRequired, boss: this.currentEnemy?.stats.isBoss ? this.currentEnemy.stats : null });
  }

  updateDebugBar() {
    this.refreshHud();
    updateDebugStatus(`状态:${this.state} 敌人:${this.currentEnemy?.active ? Math.ceil(this.currentEnemy.stats.hp) : '无'} Lv:${this.level}`);
  }

  cleanupRound() {
    this.time?.removeAllEvents();
    this.tweens?.killAll();
    this.children?.removeAll(true);
    this.cameras?.main?.stopFollow();
  }

  showInitError(error) {
    this.add.text(24, 220, `初始化失败\n${error.name || 'Error'}: ${error.message || String(error)}`, { fontSize: '28px', color: '#fff', backgroundColor: 'rgba(190,0,0,0.92)', padding: { left: 18, right: 18, top: 14, bottom: 14 }, wordWrap: { width: DESIGN_WIDTH - 48 } }).setScrollFactor(0).setDepth(10000);
  }
}
