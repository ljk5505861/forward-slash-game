import { ENEMIES } from '../config/enemies.js';
import { createEnemyStatusIndicators, updateEnemyStatusIndicators, ENEMY_UI_LAYOUT } from '../ui/EnemyStatusIndicators.js';

const enemyTop=enemy=>enemy.y-enemy.height/2;

export default function createEnemy(scene, config, x, groundTopY) {
  const enemy = scene.add.rectangle(x, groundTopY - config.height / 2, config.width, config.height, config.color, 1).setStrokeStyle(6, config.stroke, 1).setDepth(20);
  scene.physics.add.existing(enemy); enemy.body.setAllowGravity(false); enemy.body.setImmovable(true); enemy.body.setSize(config.bodyWidth || Math.round(config.width * 0.86), config.bodyHeight || Math.round(config.height * 0.92)); enemy.body.setOffset((config.width - enemy.body.width) / 2, config.height - enemy.body.height);
  const baseConfig=ENEMIES[config.id]||config;
  const specialDamageScale=(config.damage||1)/(baseConfig.damage||1);
  const scaledSpecialDamage=value=>value===undefined?undefined:Math.max(1,Math.round(value*specialDamageScale));
  Object.assign(enemy, {
    enemyId:config.id,
    name:config.name,
    kind:config.kind,
    isBoss:config.kind === 'boss',
    isMidBoss:config.bossType === 'mid',
    isFinalBoss:config.bossType === 'final' || (config.kind === 'boss' && config.id === 'boss'),
    isElite:config.kind === 'elite',
    behavior:config.behavior,
    speed:config.speed||0,
    defense:config.defense||0,
    damageReduction:config.damageReduction||0,
    baseColor:config.color,
    isDefeated:false,
    hp:config.hp,
    maxHp:config.hp,
    damage:config.damage,
    chargeDamage:scaledSpecialDamage(config.chargeDamage),
    bombDamage:scaledSpecialDamage(config.bombDamage),
    slamDamage:scaledSpecialDamage(config.slamDamage),
    healAmount:config.healAmount,
    preferredRange:config.preferredRange,
    chargeTriggerRange:config.chargeTriggerRange,
    chargeWindupMs:config.chargeWindupMs,
    chargeCooldownMs:config.chargeCooldownMs,
    chargeRecoveryMs:config.chargeRecoveryMs,
    chargeSpeed:config.chargeSpeed,
    bombWarningMs:config.bombWarningMs,
    attackIntervalMs:config.attackIntervalMs,
    baseAttackIntervalMs:config.attackIntervalMs,
    attackRange:config.attackRange,
    nextAttackAt:0,
    enraged:false,
    burnTick:null,
    poisonChainPrisonUntil:0,
    level:config.level||1,
  });
  const top=enemyTop(enemy);
  enemy.hpBarBg = scene.add.rectangle(x, top-ENEMY_UI_LAYOUT.hpBarOffsetY, config.width, 8, 0x221111).setDepth(21);
  enemy.hpBar = scene.add.rectangle(x - config.width / 2, top-ENEMY_UI_LAYOUT.hpBarOffsetY, config.width, 8, 0xff4444).setOrigin(0, 0.5).setDepth(22);
  enemy.nameText = scene.add.text(x, top-ENEMY_UI_LAYOUT.nameOffsetY, config.name, { fontFamily:'Arial', fontSize:'18px', color:'#fff', stroke:'#000', strokeThickness:3 }).setOrigin(0.5).setDepth(22);
  enemy.levelText = scene.add.text(x, top-ENEMY_UI_LAYOUT.levelOffsetY, `Lv.${enemy.level}`, { fontFamily:'Arial', fontSize:'15px', color:'#dbeafe', stroke:'#000', strokeThickness:3 }).setOrigin(0.5).setDepth(22);
  createEnemyStatusIndicators(scene, enemy);
  return enemy;
}
export function syncEnemyUi(enemy) { if (!enemy?.active) return; const w = enemy.width; const top=enemyTop(enemy); enemy.hpBarBg?.setPosition(enemy.x, top-ENEMY_UI_LAYOUT.hpBarOffsetY); enemy.hpBar?.setPosition(enemy.x - w / 2, top-ENEMY_UI_LAYOUT.hpBarOffsetY).setDisplaySize(w * Math.max(0, enemy.hp / enemy.maxHp), 8); enemy.nameText?.setPosition(enemy.x, top-ENEMY_UI_LAYOUT.nameOffsetY); enemy.levelText?.setPosition(enemy.x, top-ENEMY_UI_LAYOUT.levelOffsetY); const status=enemy.scene?.statusEffects; updateEnemyStatusIndicators(enemy, status?.getStackCount?.(enemy,'BURN')||0, status?.getStackCount?.(enemy,'POISON')||0); }
