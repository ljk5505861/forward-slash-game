import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { TAGS, BUILD_TAGS } from '../src/config/tags.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import pkg from '../package.json' with { type:'json' };
assert.equal(GAME_VERSION,'0.11.7'); assert.equal(pkg.version,'0.11.7'); assert.equal(Object.keys(SKILLS).length,43);
assert.equal(Object.values(SKILLS).filter(s=>s.rarity==='MYTHIC').length,10);
for (const id of ['solar_flame','myriad_afterimage','poison_king','lightning_tribulation','black_hole','neutron_star','white_dwarf']) assert.equal(SKILLS[id].rarity,'MYTHIC');
assert.equal(TAGS.BUILD_CELESTIAL,'buildCelestial'); assert(BUILD_TAGS.includes(TAGS.BUILD_CELESTIAL));
for (const id of ['neutron_star','white_dwarf']) { const s=SKILLS[id]; assert(s); assert.equal(s.rarity,'MYTHIC'); assert.equal(s.ultimateSkill,true); assert.equal(s.passive,true); assert.equal(s.maxLevel,9); assert.equal(s.requiredSkillId,undefined); assert.equal(s.levels.length,9); assert.equal(typeof SKILL_HANDLERS[id].bind,'function'); }
assert.deepEqual(SKILLS.neutron_star.levels.map(x=>x.singlePulseDamage),[72,80,90,101,113,128,144,162,184]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x=>x.sweepDamage),[54,60,68,77,87,99,113,129,148]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x=>x.roundCooldownMs),[7200,7000,6800,6600,6400,6100,5900,5700,5400]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x=>x.pulseGapMs),[460,450,440,430,420,410,400,390,380]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x=>x.sweepWarningMs),[380,370,360,350,340,330,320,310,300]);
assert.equal(SKILLS.neutron_star.levels.some(x => 'sweepChargeMs' in x || 'fullViewportSweep' in x || 'sweepHalfAngleDeg' in x), false);
assert.deepEqual(SKILLS.white_dwarf.levels.map(x=>x.damageReduction),[.12,.13,.15,.16,.17,.19,.20,.21,.24]);
assert.deepEqual(SKILLS.white_dwarf.levels.map(x=>x.guardCharges),[1,1,1,1,1,1,1,1,2]);
for (const id of ['solar_flame','black_hole','neutron_star','white_dwarf']) { assert(SKILLS[id].tags.includes(TAGS.CELESTIAL),id); assert(SKILLS[id].tags.includes(TAGS.BUILD_CELESTIAL),id); }
assert(SKILLS.solar_flame.tags.includes(TAGS.FIRE)); assert(SKILLS.solar_flame.tags.includes(TAGS.BUILD_FIRE));
assert(SKILLS.black_hole.tags.includes(TAGS.GRAVITY)); assert(SKILLS.black_hole.tags.includes(TAGS.BUILD_GRAVITY));
assert.equal((720*.15+720/2)/2,234);
assert.match(SKILLS.neutron_star.description,/两次单体脉冲/); assert.match(SKILLS.white_dwarf.description,/护体/);
console.log('v0.11.1 celestial flow config validation passed');
