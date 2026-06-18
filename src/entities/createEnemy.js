export default function createEnemy(scene, config, x, groundTopY) {
  const enemy = scene.add.rectangle(x, groundTopY - config.height / 2, config.width, config.height, config.color, 1).setStrokeStyle(6, config.stroke, 1).setDepth(20);
  scene.physics.add.existing(enemy); enemy.body.setAllowGravity(false); enemy.body.setImmovable(false); enemy.body.setSize(config.width, config.height);
  Object.assign(enemy, { enemyId:config.id, name:config.name, kind:config.kind, isBoss:config.kind === 'boss', isElite:config.kind === 'elite', isDefeated:false, hp:config.hp, maxHp:config.hp, damage:config.damage, attackIntervalMs:config.attackIntervalMs, baseAttackIntervalMs:config.attackIntervalMs, enragedAttackIntervalMs:config.enragedAttackIntervalMs, attackRange:config.attackRange, xp:config.xp, nextAttackAt:0, enraged:false, burnTick:null });
  enemy.hpBarBg = scene.add.rectangle(x, enemy.y - config.height / 2 - 18, config.width, 8, 0x221111).setDepth(21);
  enemy.hpBar = scene.add.rectangle(x - config.width / 2, enemy.y - config.height / 2 - 18, config.width, 8, 0xff4444).setOrigin(0, 0.5).setDepth(22);
  enemy.nameText = scene.add.text(x, enemy.y - config.height / 2 - 42, config.name, { fontFamily:'Arial', fontSize:'18px', color:'#fff', stroke:'#000', strokeThickness:3 }).setOrigin(0.5).setDepth(22);
  return enemy;
}
export function syncEnemyUi(enemy) { if (!enemy?.active) return; const w = enemy.width; enemy.hpBarBg?.setPosition(enemy.x, enemy.y - enemy.height / 2 - 18); enemy.hpBar?.setPosition(enemy.x - w / 2, enemy.y - enemy.height / 2 - 18).setDisplaySize(w * Math.max(0, enemy.hp / enemy.maxHp), 8); enemy.nameText?.setPosition(enemy.x, enemy.y - enemy.height / 2 - 42); }
