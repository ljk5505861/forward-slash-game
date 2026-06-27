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

check('version is 0.10.53', /GAME_VERSION\s*=\s*['"]0\.10\.53['"]/.test(files.version));
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
check('casting rejection is not counted as successful knockback', /return false/.test(apply) && /return true/.test(apply));
check('boss normal-state knockback remains active for counterattack', /enemy\.isBoss/.test(files.combat) && /enemy\.isKnockbackActive=true/.test(files.combat) && /updateBossKnockbackCounterattacks/.test(fs.readFileSync('src/systems/StageSystem.js','utf8')));
check('existing knockback validation script is still registered', /validate:0104-balance-knockback/.test(files.pkg));
check('new validation script is registered', /validate:01043-boss-knockback/.test(files.pkg));

const chargerStart = files.behavior.indexOf('class ChargerBehavior');
const chargerEnd = files.behavior.indexOf('class BomberBehavior');
const charger = files.behavior.slice(chargerStart, chargerEnd);
const hasImmediateSync = state => new RegExp(`this\\.state=['"]${state}['"];\\s*syncBossSkillState\\(`).test(charger);
check('ChargerBehavior idle to windup syncs immediately', hasImmediateSync('windup'));
check('ChargerBehavior windup to charge syncs immediately', hasImmediateSync('charge'));
check('ChargerBehavior charge to cooldown syncs immediately', hasImmediateSync('cooldown'));
check('ChargerBehavior cooldown to idle syncs immediately', /this\.state===['"]cooldown['"]&&t>=this\.next\)\{ this\.state=['"]idle['"]; syncBossSkillState\(s,e,this\.state\);/.test(charger));
check('ChargerBehavior finishCharge cooldown sync is immediate', /finishCharge[\s\S]*this\.state=['"]cooldown['"]; syncBossSkillState\(s,e,this\.state\);/.test(charger));
check('ChargerBehavior onRecycle clears skill state', /onRecycle\(\)\{ this\.state=['"]idle['"]; syncBossSkillState\(this\.scene,this\.e,this\.state\);/.test(charger));


const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}`);
if (failed.length) {
  console.error(`\n${failed.length} validation checks failed.`);
  process.exit(1);
}
