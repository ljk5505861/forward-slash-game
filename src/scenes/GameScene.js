import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';
import { BALANCE, estimateDemoDurationSeconds } from '../config/balance.js';
import CombatSystem from '../systems/CombatSystem.js';
import UpgradeSystem from '../systems/UpgradeSystem.js';
import Hud from '../ui/Hud.js';

const GROUND_TOP_Y = 920;
const GROUND_HEIGHT = 360;
const ATTACK_BUTTON_RADIUS = 72;
const SAFE_AREA_MARGIN = 34;

const updateDebugStatus = (message) => window.updateGameDebugStatus?.(message);

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.initStage = '尚未开始';
  }

  create() {
    this.balance = BALANCE;
    this.state = 'running';
    this.stateBeforeLevelUp = null;
    this.currentEnemy = null;
    this.boss = null;
    this.encounterables = new Set();
    this.defeatedEnemies = 0;
    this.canPlayerAttack = true;
    this.playerStats = {
      level: 1,
      hp: BALANCE.player.maxHp,
      maxHp: BALANCE.player.maxHp,
      damage: BALANCE.player.damage,
      speedX: BALANCE.player.speedX,
      xp: 0,
      xpToNext: BALANCE.leveling.baseRequiredXp,
    };

    try {
      this.runInitStage('设置世界边界', () => this.configureWorldBounds());
      this.runInitStage('设置相机背景色', () => this.createBackground());
      this.runInitStage('创建路标', () => this.createRoadMarkers());
      this.runInitStage('创建地面', () => this.createGround());
      this.runInitStage('创建玩家', () => this.createPlayer());
      this.runInitStage('设置相机', () => this.configureCameraFollow());
      this.combatSystem = new CombatSystem(this);
      this.upgradeSystem = new UpgradeSystem(this);
      this.runInitStage('创建敌人', () => this.createEnemies());
      this.runInitStage('创建 UI', () => this.createUi());
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupRun());
      updateDebugStatus('场景创建完成');
    } catch (error) {
      this.showInitError(error);
      throw error;
    }
  }

  update() {
    if (!this.player?.body || ['combat', 'bossCombat', 'levelUp', 'ended'].includes(this.state)) return;
    this.player.body.setVelocityX(this.playerStats.speedX);
    this.checkEncounter();
  }

  runInitStage(stageName, callback) { this.initStage = stageName; callback(); }

  configureWorldBounds() {
    this.physics.world.setBounds(0, 0, BALANCE.worldWidth, DESIGN_HEIGHT);
    this.cameras.main.setBounds(0, 0, BALANCE.worldWidth, DESIGN_HEIGHT);
  }

  createBackground() { this.cameras.main.setBackgroundColor('#8fd3ff'); }

  createRoadMarkers() {
    for (let x = 400; x < BALANCE.worldWidth; x += 400) {
      this.add.rectangle(x, GROUND_TOP_Y - 90, 12, 180, 0x777777, 0.75).setDepth(5);
      this.add.text(x + 18, GROUND_TOP_Y - 170, String(x), { fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#555', stroke: '#fff', strokeThickness: 4 }).setOrigin(0, 0.5).setDepth(5);
    }
  }

  createGround() {
    this.add.rectangle(BALANCE.worldWidth / 2, GROUND_TOP_Y + GROUND_HEIGHT / 2, BALANCE.worldWidth, GROUND_HEIGHT, 0x2fa84f, 1).setDepth(10);
    this.physicsGround = this.add.rectangle(BALANCE.worldWidth / 2, GROUND_TOP_Y + GROUND_HEIGHT / 2, BALANCE.worldWidth, GROUND_HEIGHT, 0x000000, 0);
    this.physics.add.existing(this.physicsGround, true);
  }

  createPlayer() {
    const p = BALANCE.player;
    this.player = this.add.rectangle(p.startX, p.startY, p.width, p.height, 0x1687ff, 1).setStrokeStyle(8, 0x0b4fb3, 1).setDepth(20);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setAllowGravity(true);
    this.player.body.setSize(p.width, p.height);
    this.physics.add.collider(this.player, this.physicsGround);
  }

  configureCameraFollow() { this.cameras.main.startFollow(this.player, false, 1, 0, DESIGN_WIDTH * 0.2, 0); }

  createEnemies() {
    for (let i = 0; i < BALANCE.enemies.countBeforeBoss; i += 1) {
      this.createEnemy(BALANCE.enemies.firstX + i * BALANCE.enemies.spacing, BALANCE.enemies.y, false);
    }
  }

  createEnemy(x, y, isBoss) {
    const cfg = isBoss ? BALANCE.boss : BALANCE.enemies;
    const enemy = this.add.rectangle(x, y, cfg.width, cfg.height, isBoss ? 0x7b2cff : 0xe84343, 1).setStrokeStyle(6, 0x4b0000, 1).setDepth(20);
    this.physics.add.existing(enemy);
    enemy.body.setAllowGravity(true);
    enemy.body.setImmovable(true);
    enemy.isBoss = isBoss;
    enemy.isDefeated = false;
    enemy.hp = cfg.hp;
    enemy.maxHp = cfg.hp;
    enemy.damage = cfg.damage;
    enemy.xp = cfg.xp;
    enemy.attackIntervalMs = cfg.attackIntervalMs;
    enemy.attackTimer = null;
    this.physics.add.collider(enemy, this.physicsGround);
    this.encounterables.add(enemy);
    return enemy;
  }

  spawnBoss() {
    if (this.boss?.active) return this.boss;
    const bossX = BALANCE.enemies.firstX + (BALANCE.enemies.countBeforeBoss - 1) * BALANCE.enemies.spacing + BALANCE.boss.xOffsetAfterFinalEnemy;
    this.boss = this.createEnemy(bossX, BALANCE.boss.y, true);
    this.hud?.setStatus('Boss 已出现，继续前进！');
    return this.boss;
  }

  checkEncounter() {
    const nextEnemy = [...this.encounterables]
      .filter((enemy) => this.combatSystem.isEncounterable(enemy))
      .sort((a, b) => a.x - b.x)
      .find((enemy) => Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= BALANCE.player.encounterDistance);

    if (nextEnemy) this.combatSystem.enterCombat(nextEnemy);
  }

  createUi() {
    this.hud = new Hud(this);
    this.hud.setStatus(`预计 Demo 时长约 ${Math.round(estimateDemoDurationSeconds() / 60)} 分钟`);
    this.hud.updatePlayer(this.playerStats);
    this.createTitle();
    this.createAttackButton();
    this.createRestartButton();
  }

  createTitle() {
    this.add.text(DESIGN_WIDTH / 2, 42, '自动前进动作肉鸽 Demo', { fontFamily: 'Arial, sans-serif', fontSize: '34px', color: '#14324a', stroke: '#ffffff', strokeThickness: 5 }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000);
  }

  createAttackButton() {
    this.attackButton = this.add.circle(0, 0, ATTACK_BUTTON_RADIUS, 0xff6b35, 0.88).setStrokeStyle(6, 0xffffff, 0.95).setScrollFactor(0).setInteractive({ useHandCursor: true }).setDepth(1000);
    this.attackLabel = this.add.text(0, 0, '攻击', { fontFamily: 'Arial, sans-serif', fontSize: '30px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    this.attackButton.on('pointerdown', () => this.combatSystem.playerAttack());
    this.positionAttackButton();
    this.scale.on('resize', this.positionAttackButton, this);
  }

  createRestartButton() {
    this.restartButton = this.add.text(DESIGN_WIDTH - 22, 28, '重新开始', { fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#fff', backgroundColor: '#333', padding: { left: 12, right: 12, top: 8, bottom: 8 } }).setOrigin(1, 0).setScrollFactor(0).setInteractive({ useHandCursor: true }).setDepth(2000);
    this.restartButton.on('pointerdown', () => this.scene.restart());
  }

  showUpgradeChoices() {
    this.upgradeCards = ['damage', 'health', 'speed'].map((choice, index) => {
      const labels = { damage: '攻击 +8', health: '满血 +20', speed: '速度 +18' };
      return this.add.text(DESIGN_WIDTH / 2, 390 + index * 115, labels[choice], { fontFamily: 'Arial, sans-serif', fontSize: '32px', color: '#fff', backgroundColor: '#203a74', padding: { left: 26, right: 26, top: 18, bottom: 18 } }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true }).setDepth(3000).on('pointerdown', () => this.upgradeSystem.applyUpgrade(choice));
    });
  }

  hideUpgradeChoices() {
    this.upgradeCards?.forEach((card) => card.destroy());
    this.upgradeCards = [];
  }

  positionAttackButton() {
    if (!this.attackButton || !this.attackLabel) return;
    const x = DESIGN_WIDTH - ATTACK_BUTTON_RADIUS - SAFE_AREA_MARGIN;
    const y = DESIGN_HEIGHT - ATTACK_BUTTON_RADIUS - SAFE_AREA_MARGIN;
    this.attackButton.setPosition(x, y);
    this.attackLabel.setPosition(x, y);
  }

  finishRun(won) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.player?.body?.setVelocityX(0);
    this.currentEnemy && this.combatSystem.cancelEnemyAttackTimer(this.currentEnemy);
    this.resultPanel = this.add.text(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, won ? '胜利！' : '失败，点击重新开始', { fontFamily: 'Arial, sans-serif', fontSize: '46px', color: '#fff', backgroundColor: '#111', padding: { left: 24, right: 24, top: 18, bottom: 18 } }).setOrigin(0.5).setScrollFactor(0).setDepth(4000);
  }

  cleanupRun() {
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.hideUpgradeChoices();
    this.resultPanel?.destroy();
    this.encounterables?.forEach((enemy) => enemy.destroy());
    this.encounterables?.clear();
    if (this.boss?.active) this.boss.destroy();
    this.currentEnemy = null;
    this.boss = null;
  }

  showInitError(error) {
    const message = `初始化失败：${this.initStage}\n${error.name || 'Error'}: ${error.message || String(error)}`;
    this.add.text(24, 220, message, { fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#ffffff', backgroundColor: 'rgba(190, 0, 0, 0.92)', padding: { left: 18, right: 18, top: 14, bottom: 14 }, wordWrap: { width: DESIGN_WIDTH - 48 } }).setOrigin(0, 0).setScrollFactor(0).setDepth(10000);
  }
}
