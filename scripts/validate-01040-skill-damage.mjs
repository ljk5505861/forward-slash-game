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
  strength:['giant_force','spinning_blade','bloodthirst','frenzy','blood_rage_burst','last_stand'],
  defense:['healing','thorn_armor','guardian_shield','armor_break_shockwave','immovable_mountain','black_tortoise_body'],
  afterimage:['shadow_fist','phantom_step','shadow_assault','swift_shadow','instant_step','myriad_afterimage'],
  poison:['poison_cloud','parasitic_gu','bone_eating_insect','poison_chain','poison_king','plague_mother'],
};
const allSkillIds=Object.values(archetypes).flat();
assert.equal(GAME_VERSION,'0.10.46','game version for v0.10.46 skill regression');
eq(allSkillIds.length,31,'all current 31 skills listed');
eq(new Set(allSkillIds).size,31,'all current 31 skills unique');
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
eq(nums('spinning_blade','heavyHitMultiplier'),[1.55,1.7,1.8,1.95,2.1,2.2,2.35,2.5,2.65],'spinning_blade.heavyHitMultiplier');
eq(nums('bloodthirst','lifeSteal'),[0.02,0.025,0.03,0.035,0.04,0.045,0.05,0.055,0.06],'bloodthirst.lifeSteal');
assert.ok(SKILLS.giant_force.levels.every(l=>l.attackBonus>0&&l.knockbackBonus>=0),'giant_force attack/knockback bonuses valid');
assert.ok(SKILLS.frenzy.levels.every(l=>Array.isArray(l.tiers)&&l.tiers.length>=2),'frenzy tier bonuses configured');
assert.ok(SKILLS.blood_rage_burst.levels.every(l=>l.damageBonus>0&&l.lifeStealBonus>0),'blood_rage_burst damage/lifesteal bonuses configured');
assert.ok(SKILLS.last_stand.levels.every(l=>l.durationMs>0&&l.cooldownMs>0),'last_stand timing configured');

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
eq(nums('poison_cloud','damage'),[26,32,40,48,58,70,84,100,120],'poison_cloud.damage');
eq(nums('poison_cloud','poisonDamage'),[6,6,8,8,10,10,12,14,16],'poison_cloud.poisonDamage');
eq(nums('poison_cloud','poisonIntervalMs'),Array(9).fill(700),'poison_cloud.poisonIntervalMs');
eq(nums('parasitic_gu','damagePerGrowth'),[0.20,0.22,0.24,0.26,0.28,0.32,0.36,0.40,0.46],'parasitic_gu.damagePerGrowth');
eq(nums('bone_eating_insect','damage'),[14,16,16,18,20,20,22,24,28],'bone_eating_insect.damage');
eq(nums('poison_chain','damageRatio'),[0.70,0.80,0.88,0.96,1.04,1.12,1.18,1.24,1.30],'poison_chain.damageRatio');
eq(nums('poison_king','biteDamage'),[36,44,54,66,80,96,116,140,170],'poison_king.biteDamage');
eq(nums('poison_king','burstDamagePerStack'),[10,12,14,16,18,20,22,24,26],'poison_king.burstDamagePerStack');
eq(nums('plague_mother','basePoisonDamage'),Array(9).fill(6),'plague_mother.basePoisonDamage');

// Source-level smoke checks for non-sword handlers and the handler registry.
const poisonAdvanced=src('src/skills/handlers/PoisonSummonAdvancedSkills.js');
assert.match(poisonAdvanced,/\[2,1\.04,185,540\].*\[2,1\.12,195,500\].*\[3,1\.18,205,470\].*\[3,1\.24,215,440\].*\[3,1\.30,220,400\]/s,'poison_chain ratios remain in source config');
assert.match(poisonAdvanced,/Math\.min\(360,Math\.max\(1,Math\.round\(Math\.min\(data\.burstMaxStacks,stacks\)\*data\.burstDamagePerStack\*formMult\)\)\)/,'poison_king burst cap remains');
assert.match(src('src/skills/handlers/FlameCoreSkills.js'),/StatusEffects\.BURN/,'fire handlers still use burn status');
assert.match(src('src/skills/handlers/AfterimageCoreSkills.js'),/payload\.damage\|\|0\)\*data\.damageRatio/,'shadow_assault uses configured damage ratio');
assert.match(src('src/skills/handlers/PoisonSummonCoreSkills.js'),/growth\*damagePerGrowth/,'parasitic_gu uses configured growth damage conversion');
assert.ok(['sword_sheath','sword_tomb','fire_seed','burn_burst','solar_flame','poison_chain','poison_king','plague_mother'].every(hasHandler),'current handlers registered');
['split_sword','rotating_sword','execution_sword','myriad_swords','heaven_splitting_sword'].forEach(id=>assert.equal(hasHandler(id),false,`${id} old handler not registered`));

console.log('v0.10.46 skill damage regression validation passed.');
