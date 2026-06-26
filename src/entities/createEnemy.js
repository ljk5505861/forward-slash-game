import { ENEMIES } from '../config/enemies.js';

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
    enragedAttackIntervalMs:config.enragedAttackIntervalMs,
    attackRange:config.attackRange,
    nextAttackAt:0,
    enraged:false,
    burnTick:null,
    level:config.level||1,
  });
  enemy.hpBarBg = scene.add.rectangle(x, enemy.y - config.height / 2 - 18, config.width, 8, 0x221111).setDepth(21);
  enemy.hpBar = scene.add.rectangle(x - config.width / 2, enemy.y - config.height / 2 - 18, config.width, 8, 0xff4444).setOrigin(0, 0.5).setDepth(22);
  enemy.nameText = scene.add.text(x, enemy.y - config.height / 2 - 42, config.name, { fontFamily:'Arial', fontSize:'18px', color:'#fff', stroke:'#000', strokeThickness:3 }).setOrigin(0.5).setDepth(22);
  enemy.levelText = scene.add.text(x, enemy.y - config.height / 2 - 62, `Lv.${enemy.level}`, { fontFamily:'Arial', fontSize:'15px', color:'#dbeafe', stroke:'#000', strokeThickness:3 }).setOrigin(0.5).setDepth(22);
  enemy.statusIndicatorContainer = scene.add.container(x, enemy.y - config.height / 2 - 84).setDepth(23);
  enemy.burnIndicator = scene.add.container(0, 0);
  enemy.burnIconPlaceholder = scene.add.rectangle(-7, 0, 0, 0, 0xff8a33, 0).setVisible(false).setAlpha(0);
  enemy.burnStackText = scene.add.text(0, 0, '', { fontFamily:'Arial', fontSize:'18px', color:'#ffb05a', stroke:'#000', strokeThickness:4 }).setOrigin(0.5).setVisible(false);
  enemy.burnIndicator.add([enemy.burnIconPlaceholder, enemy.burnStackText]);
  enemy.statusIndicatorContainer.add(enemy.burnIndicator);
  enemy.statusIndicators = { StatusIndicatorContainer:enemy.statusIndicatorContainer, BurnIndicator:enemy.burnIndicator, IconPlaceholder:enemy.burnIconPlaceholder, StackText:enemy.burnStackText };
  return enemy;
}
export function syncEnemyUi(enemy) {
  if (!enemy?.active) return;
  const w = enemy.width;
  enemy.hpBarBg?.setPosition(enemy.x, enemy.y - enemy.height / 2 - 18);
  enemy.hpBar?.setPosition(enemy.x - w / 2, enemy.y - enemy.height / 2 - 18).setDisplaySize(w * Math.max(0, enemy.hp / enemy.maxHp), 8);
  enemy.nameText?.setPosition(enemy.x, enemy.y - enemy.height / 2 - 42);
  enemy.levelText?.setPosition(enemy.x, enemy.y - enemy.height / 2 - 62);
  enemy.statusIndicatorContainer?.setPosition(enemy.x, enemy.y - enemy.height / 2 - 84);
  const stacks = enemy.scene?.statusEffects?.getStackCount?.(enemy, 'BURN') || 0;
  enemy.burnIconPlaceholder?.setVisible(false)?.setAlpha?.(0);
  enemy.burnIconPlaceholder?.setStrokeStyle?.(0, 0xff8a33, 0);
  enemy.burnStackText?.setText(stacks > 0 ? String(stacks) : '')?.setVisible?.(stacks > 0);
  enemy.burnStackText?.setPosition?.(0, 0);
}
