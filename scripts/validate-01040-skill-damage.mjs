import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';

const nums=(id,key)=>SKILLS[id]?.levels?.map(level=>level[key]);
const eq=(actual,expected,label)=>assert.deepEqual(actual,expected,label);
const src=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const hasHandler=(handler)=>new RegExp(`${handler}:`).test(src('src/skills/handlers/index.js'));

const archetypes={
  fire:['fireball','fire_seed','burn_burst','solar_flame'],
  sword:['sword_wave','sword_sheath','sword_tomb'],
  strength:['giant_force','spinning_blade','bloodthirst','last_stand'],
  defense:['healing','thorn_armor','guardian_shield','armor_break_shockwave','immovable_mountain','black_tortoise_body'],
  afterimage:['shadow_fist','phantom_step','shadow_assault','swift_shadow','instant_step','myriad_afterimage'],
  poison:['poison_cloud','parasitic_gu','poison_chain','poison_king'],
};
const allSkillIds=Object.values(archetypes).flat();
assert.equal(GAME_VERSION,'0.10.60','game version for v0.10.60 skill regression');
eq(allSkillIds.length,27,'all current 27 skills listed');
eq(new Set(allSkillIds).size,27,'all current 27 skills unique');
eq(Object.keys(SKILLS).sort(),[...allSkillIds].sort(),'skill pool exactly matches current archetype list');
allSkillIds.forEach(id=>assert.ok(SKILLS[id],`missing skill ${id}`));

// Fire archetype damage and burn regressions.
eq(nums('fireball','damage'),[30,34,38,42,46,42,46,50,54],'fireball.damage');
eq(nums('fireball','burnDamage'),Array(9).fill(5),'fireball.burnDamage');
eq(nums('fireball','cooldownMs'),[1900,1800,1350,1300,1250,1250,1200,1150,1100],'fireball.cooldownMs');
eq(nums('fireball','burnIntervalMs'),Array(9).fill(600),'fireball.burnIntervalMs');
eq(nums('fire_seed','damage'),[28,31,34,38,42,46,50,55,60],'fire_seed.damage');
eq(nums('fire_seed','splitDamage'),[14,15,16,17,18,18,19,20,21],'fire_seed.splitDamage');
eq(nums('fire_seed','burnDamage'),Array(9).fill(5),'fire_seed.burnDamage');
eq(nums('fire_seed','cooldownMs'),[3600,3500,3400,3300,3200,3100,3000,2900,2800],'fire_seed.cooldownMs');
eq(nums('burn_burst','zoneDamage'),[7,8,8,9,10,10,11,12,13],'burn_burst.zoneDamage');
eq(nums('burn_burst','burstDamage'),[44,48,52,56,60,64,68,72,78],'burn_burst.burstDamage');
eq(nums('burn_burst','burnDamage'),Array(9).fill(5),'burn_burst.burnDamage');
eq(nums('solar_flame','damage'),[8,9,10,11,12,13,14,15,16],'solar_flame.damage');
eq(nums('solar_flame','burnDamage'),Array(9).fill(5),'solar_flame.burnDamage');
eq(nums('solar_flame','intervalMs'),[900,880,860,840,820,800,780,760,740],'solar_flame.intervalMs');

// Sword archetype smoke checks only; full sword rework rules live in validate:01045-sword-rework.
eq(archetypes.sword,['sword_wave','sword_sheath','sword_tomb'],'sword archetype uses current three-skill list');
eq(nums('sword_wave','damage'),[34,42,50,58,68,78,90,102,116],'sword_wave.damage');
eq(nums('sword_wave','attackIntervalMs'),[1300,1220,1180,1100,1030,980,920,860,780],'sword_wave.attackIntervalMs');
eq(nums('sword_sheath','damage'),[32,38,44,52,60,70,82,96,104],'sword_sheath.damage');
eq(nums('sword_sheath','warmupMs'),[6000,5700,5200,5000,4700,4500,4300,4100,4000],'sword_sheath.warmupMs');
eq(nums('sword_tomb','executeRatio'),[0.10,0.11,0.12,0.13,0.14,0.15,0.16,0.17,0.18],'sword_tomb.executeRatio');
['split_sword','rotating_sword','execution_sword','myriad_swords','heaven_splitting_sword'].forEach(id=>assert.equal(SKILLS[id],undefined,`${id} removed from skill pool`));

// Strength / lifesteal archetype.
eq(nums('spinning_blade','ratio'),[0.4,0.45,0.55,0.58,0.62,0.65,0.7,0.75,0.8],'spinning_blade.ratio');
eq(nums('bloodthirst','lifeSteal'),[0.05,0.06,0.07,0.08,0.09,0.10,0.11,0.12,0.12],'bloodthirst.lifeSteal');
eq(nums('bloodthirst','empoweredLifeSteal'),[0.10,0.11,0.14,0.15,0.17,0.20,0.21,0.22,0.24],'bloodthirst.empoweredLifeSteal');
assert.equal(SKILLS.bloodthirst.levels[8].lowHpLifeSteal,0.30,'bloodthirst low hp empowered lifesteal');
assert.ok(SKILLS.giant_force.levels.every(l=>l.strength>0&&l.hpPerStrength>=3),'giant_force strength bonuses valid');
eq(nums('last_stand','physicalDamageBonus'),[0.15,0.18,0.22,0.26,0.30,0.35,0.40,0.45,0.50],'last_stand.physicalDamageBonus');
eq(nums('last_stand','physicalCritChance'),[0.15,0.18,0.22,0.25,0.28,0.37,0.41,0.45,0.50],'last_stand.physicalCritChance');
eq(nums('last_stand','physicalCritMultiplierBonus'),[0.40,0.50,0.60,0.75,0.90,1.05,1.20,1.35,1.50],'last_stand.physicalCritMultiplierBonus');

// Defense / shield archetype.
eq(nums('healing','defense'),[2,3,5,7,9,12,15,18,22],'healing.defense');
eq(nums('thorn_armor','flatDamage'),[4,4,6,6,8,8,10,10,12],'thorn_armor.flatDamage');
eq(nums('guardian_shield','flatShield'),[6,7,8,9,10,11,12,13,15],'guardian_shield.flatShield');
eq(nums('armor_break_shockwave','damage'),[90,110,132,156,180,204,224,242,260],'armor_break_shockwave.damage');
assert.ok(SKILLS.immovable_mountain.levels.every(l=>l.maxStacks>0&&l.defensePerStack>0),'immovable_mountain stacks/defense configured');
assert.ok(SKILLS.black_tortoise_body.levels.every(l=>l.defenseBonus>0&&l.flatShield>0),'black_tortoise_body defense/shield configured');

// Afterimage / speed archetype.
eq(nums('shadow_assault','damageRatio'),[0.44,0.50,0.56,0.62,0.68,0.76,0.84,0.92,1.04],'shadow_assault.damageRatio');
eq(nums('instant_step','damage'),[110,132,156,180,208,240,264,284,300],'instant_step.damage');
assert.ok(SKILLS.shadow_fist.levels.every(l=>l.dodgeChance>0),'shadow_fist dodge configured');
assert.ok(SKILLS.phantom_step.levels.every(l=>l.maxAfterimages>=1&&l.durationMs>0),'phantom_step afterimage duration configured');
assert.ok(SKILLS.swift_shadow.levels.every(l=>l.attackSpeedBonus>0&&l.afterimageDamageBonus>=0),'swift_shadow speed/damage configured');
assert.ok(SKILLS.myriad_afterimage.levels.every(l=>l.copyDamageRatio>0&&l.shadowSwordDamageRatio>0),'myriad_afterimage copy/shadow sword ratios configured');

// Poison summon archetype.
eq(nums('poison_cloud','damage'),[26,32,52,62,75,91,109,130,156],'poison_cloud.damage');
eq(nums('poison_cloud','poisonDamage'),[6,6,10,10,13,13,16,18,21],'poison_cloud.poisonDamage');
eq(nums('poison_cloud','poisonIntervalMs'),Array(9).fill(700),'poison_cloud.poisonIntervalMs');
eq(nums('poison_cloud','maxHits'),[3,3,3,3,3,999,999,999,999],'poison_cloud.maxHits');
eq(nums('parasitic_gu','leechDamage'),[10,11,12,13,14,21,23,25,38],'parasitic_gu.leechDamage');
eq(nums('parasitic_gu','poisonStacks'),[1,1,1,1,1,2,2,2,2],'parasitic_gu.poisonStacks');
eq(nums('parasitic_gu','poisonAbsorbRatio'),Array(9).fill(0.03),'parasitic_gu.poisonAbsorbRatio');
eq(nums('parasitic_gu','splitEnergy'),[28,28,26,26,24,24,22,22,20],'parasitic_gu.splitEnergy');
eq(nums('poison_chain','extendChance'),[0.38,0.42,0.62,0.64,0.66,0.68,0.7,0.72,0.74],'poison_chain.extendChance');
eq(nums('poison_chain','checkMs'),[1200,1100,760,730,700,680,650,620,600],'poison_chain.checkMs');
eq(nums('poison_king','biteDamage'),[28,31,34,37,40,58,63,68,74],'poison_king.biteDamage');
eq(nums('poison_king','growthRatio'),[0.22,0.24,0.34,0.34,0.34,0.34,0.36,0.38,0.4],'poison_king.growthRatio');

// Source-level smoke checks for non-sword handlers and the handler registry.
const poisonAdvanced=src('src/skills/handlers/PoisonSummonAdvancedSkills.js');
assert.match(src('src/skills/handlers/FlameCoreSkills.js'),/StatusEffects\.BURN/,'fire handlers still use burn status');
assert.match(src('src/skills/handlers/AfterimageCoreSkills.js'),/payload\.damage\|\|0\)\*data\.damageRatio/,'shadow_assault uses configured damage ratio');
assert.match(poisonAdvanced,/'poison_chain_transfer'/,'poison chain uses stable source id');
['split_sword','rotating_sword','execution_sword','myriad_swords','heaven_splitting_sword'].forEach(id=>assert.equal(hasHandler(id),false,`${id} old handler not registered`));

console.log('v0.10.60 skill damage regression validation passed.');
