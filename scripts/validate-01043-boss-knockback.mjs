import fs from 'node:fs';

const files = {
  version: fs.readFileSync('src/config/version.js','utf8'),
  tuning: fs.readFileSync('src/config/tuning.js','utf8'),
  combat: fs.readFileSync('src/systems/CombatSystem.js','utf8'),
  behavior: fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8'),
  skills: fs.readFileSync('src/systems/SkillSystem.js','utf8'),
  pkg: fs.readFileSync('package.json','utf8'),
};
const checks = [];
const check = (name, ok) => checks.push({ name, ok: !!ok });

check('version is 0.11.2', /GAME_VERSION\s*=\s*['"]0.11.2['"]/.test(files.version));
check('unified boss knockback distance config exists', /bossKnockbackDistance\s*:\s*10/.test(files.tuning) && /export const bossKnockbackDistance/.test(files.combat));
check('boss knockback is capped at configured distance', /enemy\.isBoss\s*\?\s*Math\.min\(requestedDistance\s*,\s*bossKnockbackDistance\)/.test(files.combat));
check('boss vertical knockback lift is zero', /const lift\s*=\s*enemy\.isBoss\s*\?\s*0\s*:\s*NORMAL_ATTACK_KNOCKBACK_LIFT_PX/.test(files.combat));
check('normal and elite enemies still use configured vertical lift', /enemy\.isBoss\s*\?\s*0\s*:\s*NORMAL_ATTACK_KNOCKBACK_LIFT_PX/.test(files.combat) && !/NORMAL_ATTACK_KNOCKBACK_LIFT_PX\s*=\s*0/.test(files.combat));
check('normal enemy knockback is not globally capped to 10', /enemy\.isBoss\s*\?\s*Math\.min\(requestedDistance\s*,\s*bossKnockbackDistance\)\s*:\s*requestedDistance/.test(files.combat));
check('elite knockback multiplier remains unchanged', /enemy\.isElite\s*\?\s*0\.35/.test(files.combat));
check('unified boss skill-state predicate exists', /export const isBossUsingSkill\s*=/.test(files.combat));
const apply = files.combat.slice(files.combat.indexOf('applyKnockback'));
check('boss skill check happens before knockback state/tween creation', apply.indexOf('isBossUsingSkill(enemy)') > -1 && apply.indexOf('isBossUsingSkill(enemy)') < apply.indexOf('enemy.isKnockbackActive=true') && apply.indexOf('isBossUsingSkill(enemy)') < apply.indexOf('this.scene.tweens.add'));
check('casting knockback returns not applied', /if\(isBossUsingSkill\(enemy\)\)\{ this\.clearKnockback\(enemy\); return false; \}/.test(files.combat));
check('casting path cannot create tween', apply.indexOf('return false') < apply.indexOf('this.scene.tweens.add'));
check('casting path cannot write knockback velocity', apply.indexOf('return false') < apply.indexOf('setVelocityX'));
check('casting path cannot write knockback target position', apply.indexOf('return false') < apply.indexOf('const endX='));
check('boss skill start clears existing knockback', /syncBossSkillState[\s\S]*clearKnockback/.test(files.behavior));
check('clearing existing knockback does not restore old position', !/knockbackStart|preKnockback|originalX|resetPosition/.test(files.combat + files.behavior));
check('damage still resolves before knockback rejection', files.combat.indexOf('enemy.hp=Math.max') < files.combat.indexOf('this.applyKnockback(enemy, meta)'));

const failed = checks.filter(item => !item.ok);
if (failed.length) {
  console.error(failed);
  process.exit(1);
}
console.log(`v0.11.1 boss knockback validation passed (${checks.length} checks).`);
