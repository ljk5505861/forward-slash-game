import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import '../src/skills/handlers/index.js';
import { createPlayerRuntime, getEffectiveAttack, getTotalStrength } from '../src/config/balance.js';
import { getGiantForceStrength } from '../src/skills/handlers/StrengthCoreSkills.js';

assert.equal(GAME_VERSION,'0.10.59');
assert.equal(Object.keys(SKILLS).length,27,'formal skill count');
const strength=['giant_force','spinning_blade','bloodthirst','last_stand'];
assert.deepEqual(Object.keys(SKILLS).filter(id=>SKILLS[id].tags?.includes('buildStrength')).sort(),strength.sort());
assert.equal(SKILLS.frenzy,undefined); assert.equal(SKILLS.blood_rage_burst,undefined);
assert.equal(SKILLS.giant_force.rarity,'COMMON'); assert.equal(SKILLS.spinning_blade.rarity,'RARE'); assert.equal(SKILLS.bloodthirst.rarity,'EPIC'); assert.equal(SKILLS.last_stand.rarity,'MYTHIC');
for(const id of strength){ assert.equal(SKILLS[id].maxLevel,9); assert.equal(SKILLS[id].levels.length,9); assert.equal(SKILLS[id].requiredSkillId,undefined); assert.ok(SKILLS[id].levels[2].milestoneText); assert.ok(SKILLS[id].levels[5].milestoneText); assert.ok(SKILLS[id].levels[8].milestoneText); }
assert.equal(SKILLS.last_stand.ultimateSkill,true); assert.equal(SKILLS.poison_king.ultimateSkill,true);
const p=createPlayerRuntime(); assert.equal(getTotalStrength(p),0); assert.equal(getEffectiveAttack(p),10); p.strengthBonuses.test=10; assert.equal(getTotalStrength(p),10); assert.equal(getEffectiveAttack(p),20); assert.equal(getEffectiveAttack(p),20); delete p.strengthBonuses.test; assert.equal(getEffectiveAttack(p),10);
assert.equal(getGiantForceStrength(SKILLS.giant_force.levels[0]),4); assert.equal(SKILLS.giant_force.levels[0].hpPerStrength*4,12); assert.equal(getGiantForceStrength(SKILLS.giant_force.levels[5]),23); assert.equal(SKILLS.giant_force.levels[5].hpPerStrength*23,69); assert.equal(getGiantForceStrength(SKILLS.giant_force.levels[8]),38); assert.equal(SKILLS.giant_force.levels[8].hpPerStrength*38,152); assert.equal(SKILLS.giant_force.levels[2].attackRangeMultiplier,.05);
assert.equal(SKILLS.spinning_blade.levels[0].ratio,.40); assert.equal(SKILLS.spinning_blade.levels[2].range,253); assert.equal(SKILLS.spinning_blade.levels[5].empoweredEvery,3); assert.equal(SKILLS.spinning_blade.levels[8].explosionRadius,95);
assert.equal(SKILLS.bloodthirst.levels[0].lifeSteal,.03); assert.equal(SKILLS.bloodthirst.levels[2].empoweredLifeSteal,.08); assert.equal(SKILLS.bloodthirst.levels[5].cooldownMs,8000); assert.equal(SKILLS.bloodthirst.levels[8].lowHpLifeSteal,.15);
assert.equal(SKILLS.last_stand.levels[0].physicalDamageBonus,.10); assert.equal(SKILLS.last_stand.levels[5].physicalCritChance,.33); assert.equal(SKILLS.last_stand.levels[8].physicalCritChance,.45); assert.equal(SKILLS.last_stand.levels[8].physicalCritDefenseIgnore,.2);
console.log('validate-01059-strength-rework passed on v0.10.59');
