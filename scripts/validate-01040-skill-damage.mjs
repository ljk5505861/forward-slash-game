import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';

const nums=(id,key)=>SKILLS[id]?.levels?.map(l=>l[key]);
const eq=(actual,expected,label)=>assert.deepEqual(actual,expected,label);
const approx=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-9, `${label}: expected ${expected}, got ${actual}`);
const src=file=>readFileSync(new URL(`../${file}`, import.meta.url),'utf8');

const archetypes={
  fire:['fireball','flame_spray','burn_burst','wildfire','meteor','eternal_flame_heart'],
  sword:['sword_wave','split_sword','rotating_sword','execution_sword','myriad_swords','heaven_splitting_sword'],
  strength:['giant_force','spinning_blade','bloodthirst','frenzy','blood_rage_burst','last_stand'],
  defense:['healing','thorn_armor','guardian_shield','armor_break_shockwave','immovable_mountain','black_tortoise_body'],
  afterimage:['shadow_fist','phantom_step','shadow_assault','swift_shadow','instant_step','myriad_afterimage'],
  poison:['poison_cloud','parasitic_gu','bone_eating_insect','poison_chain','poison_king','plague_mother'],
};
const expectedIds=Object.values(archetypes).flat();
eq(expectedIds.length,36,'36技能检查清单');
eq(new Set(expectedIds).size,36,'36技能无重复覆盖');
expectedIds.forEach(id=>assert.ok(SKILLS[id],`missing skill ${id}`));
eq(GAME_VERSION,'0.10.40','game version');

const fixedDamageChecks={
  fireball:{ damage:[50,58,68,78,90,104,120,138,160], burnDamage:[6,6,8,8,10,10,12,12,14] },
  flame_spray:{ burnDamage:[8,10,10,12,12,14,14,16,18] },
  burn_burst:{ damagePerStack:[18,20,20,22,22,24,24,26,28] },
  meteor:{ damage:[104,120,138,158,180,206,234,264,300], burnDamage:Array(9).fill(14) },
  sword_wave:{ damage:[34,42,44,54,64,68,82,96,104] },
  split_sword:{ damage:[24,30,30,36,42,44,52,60,68] },
  rotating_sword:{ damage:[44,52,56,66,72,84,92,104,120] },
  execution_sword:{ bossDamage:[44,54,64,76,88,104,120,140,164], executeFloor:[180,190,200,210,220,230,240,250,260] },
  myriad_swords:{ damage:[52,60,64,72,80,84,92,100,108] },
  heaven_splitting_sword:{ waveDamage:[320,360,410,470,540,620,710,810,940], abyssDamage:[64,76,90,108,128,152,180,212,244], closingDamage:[0,0,0,0,0,0,0,0,395] },
  thorn_armor:{ flatDamage:[4,4,6,6,8,8,10,10,12] },
  armor_break_shockwave:{ damage:[90,110,132,156,180,204,224,242,260] },
  instant_step:{ damage:[110,132,156,180,208,240,264,284,300] },
  poison_cloud:{ damage:[26,32,40,48,58,70,84,100,120], poisonDamage:[6,6,8,8,10,10,12,14,16] },
  bone_eating_insect:{ damage:[14,16,16,18,20,20,22,24,28] },
  poison_king:{ biteDamage:[36,44,54,66,80,96,116,140,170], burstDamagePerStack:[10,12,14,16,18,20,22,24,26] },
  plague_mother:{ basePoisonDamage:Array(9).fill(6) },
};
Object.entries(fixedDamageChecks).forEach(([id,checks])=>Object.entries(checks).forEach(([field,expected])=>eq(nums(id,field),expected,`${id}.${field} doubled`)));

const skillSpecificCoefficientChecks={
  shadow_assault:{ damageRatio:[0.44,0.50,0.56,0.62,0.68,0.76,0.84,0.92,1.04] },
  parasitic_gu:{ damagePerGrowth:[0.20,0.22,0.24,0.26,0.28,0.32,0.36,0.40,0.46] },
  poison_chain:{ damageRatio:[0.70,0.80,0.88,0.96,1.00,1.00,1.00,1.00,1.00] },
};
Object.entries(skillSpecificCoefficientChecks).forEach(([id,checks])=>Object.entries(checks).forEach(([field,expected])=>eq(nums(id,field),expected,`${id}.${field} skill-specific damage coefficient adjusted`)));

const pureOrBuffOnly={
  wildfire:'spreads existing burn damage; chance/stacks/range unchanged',
  eternal_flame_heart:'amplifies doubled burn ticks; pulse ratio unchanged and cap doubled',
  giant_force:'attack/knockback buff only, no fixed skill damage',
  spinning_blade:'heavy hit multiplier only, no fixed skill damage',
  bloodthirst:'lifesteal only',
  frenzy:'low-HP attack/heavy/attack-speed bonuses only',
  blood_rage_burst:'temporary attack/heavy/lifesteal/attack-speed bonuses only',
  last_stand:'survival utility only',
  healing:'defense/reduction only',
  guardian_shield:'shield generation only',
  immovable_mountain:'defense/reduction stacks only',
  black_tortoise_body:'defense/reduction/shield utility; damage comes from already-doubled shockwave trigger',
  shadow_fist:'dodge only in current archetype setup',
  phantom_step:'afterimage creation only',
  swift_shadow:'movement/attack-speed/dodge/afterimage bonus only',
  myriad_afterimage:'copies already-doubled source skill damage; copy ratios unchanged',
};
Object.keys(pureOrBuffOnly).forEach(id=>assert.ok(SKILLS[id],`allowlisted pure/buff skill exists: ${id}`));

// Non-damage fields and general multipliers stay on v0.10.39 baselines.
eq(nums('fireball','cooldownMs'),[1900,1800,1750,1680,1620,1560,1500,1440,1360],'火球 cooldown unchanged');
eq(nums('fireball','burnMs'),Array(9).fill(3600),'火球 burn duration unchanged');
eq(nums('fireball','burnIntervalMs'),Array(9).fill(600),'火球 burn interval unchanged');
eq(nums('poison_cloud','poisonMs'),Array(9).fill(4200),'毒针 poison duration unchanged');
eq(nums('poison_cloud','poisonIntervalMs'),Array(9).fill(700),'毒针 poison interval unchanged');
eq(nums('poison_cloud','pierce'),[1,1,1,1,1,2,2,2,3],'毒针 pierce unchanged');
eq(nums('sword_wave','swords'),[1,1,2,2,2,3,3,3,4],'御剑术 sword count unchanged');
eq(nums('sword_wave','attackIntervalMs'),[1300,1220,1180,1100,1030,980,920,860,780],'御剑术 attack interval unchanged');
eq(nums('split_sword','extraSwords'),[1,1,2,2,2,3,3,3,4],'分剑术 sword count unchanged');
eq(nums('split_sword','attackIntervalMs'),[1500,1420,1360,1280,1210,1140,1070,1000,920],'分剑术 attack interval unchanged');
eq(nums('rotating_sword','pierce'),[3,3,4,4,5,5,6,6,7],'旋转剑 pierce unchanged');
eq(nums('rotating_sword','range'),[430,450,470,490,510,530,550,575,610],'旋转剑 range unchanged');
eq(nums('execution_sword','executeThreshold'),[0.10,0.11,0.12,0.13,0.14,0.15,0.16,0.17,0.18],'斩命剑 execute threshold unchanged');
eq(nums('myriad_swords','temporarySwords'),[2,2,3,3,3,4,4,4,5],'万剑归宗 sword count unchanged');
eq(nums('myriad_swords','attackIntervalMs'),[760,720,700,660,620,600,560,530,500],'万剑归宗 attack interval unchanged');
eq(nums('heaven_splitting_sword','cooldownMs'),[16000,15300,14600,13900,13200,12500,12000,11500,11000],'一剑开天 cooldown unchanged');
eq(nums('heaven_splitting_sword','afterimageScale'),[0.34,0.36,0.38,0.40,0.42,0.44,0.46,0.48,0.50],'一剑开天 afterimageScale unchanged');
eq(nums('spinning_blade','heavyHitMultiplier'),[1.55,1.7,1.8,1.95,2.1,2.2,2.35,2.5,2.65],'重击 heavyHitMultiplier unchanged');
eq(nums('bloodthirst','lifeSteal'),[0.02,0.025,0.03,0.035,0.04,0.045,0.05,0.055,0.06],'嗜血 lifesteal unchanged');
eq(nums('healing','defense'),[2,3,5,7,9,12,15,18,22],'铁壁 defense unchanged');
eq(nums('healing','damageReduction'),[0,0,0,0.02,0.03,0.04,0.05,0.06,0.08],'铁壁 damage reduction unchanged');
eq(nums('guardian_shield','flatShield'),[6,7,8,9,10,11,12,13,15],'守护盾 flat shield unchanged');
eq(nums('guardian_shield','intervalMs'),[7200,6900,6600,6300,6000,5700,5400,5100,4700],'守护盾 interval unchanged');
eq(nums('armor_break_shockwave','physicalVulnerability'),[0.08,0.09,0.10,0.12,0.13,0.15,0.16,0.17,0.18],'碎甲震荡 vulnerability unchanged');
eq(nums('instant_step','cooldownMs'),[7000,6700,6400,6100,5800,5500,5200,4900,4500],'瞬身 cooldown unchanged');
eq(nums('phantom_step','maxAfterimages'),[1,1,2,2,2,3,3,3,4],'幻影步 afterimage count unchanged');
eq(nums('swift_shadow','afterimageDamageBonus'),[0.05,0.055,0.060,0.065,0.070,0.076,0.080,0.082,0.085],'疾影 afterimage bonus unchanged');
eq(nums('myriad_afterimage','copyDamageRatio'),[0.25,0.28,0.30,0.34,0.37,0.40,0.43,0.46,0.50],'万象残身 copyDamageRatio unchanged');
eq(nums('myriad_afterimage','shadowSwordDamageRatio'),[0.25,0.28,0.30,0.34,0.37,0.40,0.43,0.46,0.50],'万象残身 shadowSwordDamageRatio unchanged');
eq(nums('parasitic_gu','absorbRatio'),[0.18,0.21,0.24,0.27,0.30,0.34,0.38,0.42,0.48],'寄生蛊 absorb ratio unchanged');
eq(nums('parasitic_gu','maxGrowth'),[18,20,22,24,26,28,30,32,36],'寄生蛊 max growth unchanged');
eq(nums('poison_chain','maxLinks'),[1,1,2,2,2,2,3,3,3],'毒链 link count unchanged');
eq(nums('poison_chain','internalCooldownMs'),[700,650,620,580,540,500,470,440,400],'毒链 internal cooldown unchanged');
eq(nums('poison_king','attackIntervalMs'),[1500,1450,1400,1350,1300,1240,1180,1120,1050],'毒王 attack interval unchanged');
eq(nums('plague_mother','spreadChance'),[0.04,0.045,0.055,0.06,0.065,0.075,0.08,0.09,0.10],'瘟疫母体 spread chance unchanged');

// Handler/source checks for hardcoded damage paths.
const swordUltimate=src('src/skills/handlers/SwordUltimateSkills.js');
assert.match(swordUltimate,/system\.damageValue\(10\+fire\*6,ctx\)/,'一剑开天 fire affinity fixed damage doubled');
assert.match(swordUltimate,/value:4\+fire\*2/,'一剑开天 fire affinity burn tick doubled');
assert.match(swordUltimate,/value:4\+poison\*2/,'一剑开天 poison affinity tick doubled');
const poisonAdvanced=src('src/skills/handlers/PoisonSummonAdvancedSkills.js');
assert.match(poisonAdvanced,/Math\.min\(360,Math\.max\(1,Math\.round\(Math\.min\(data\.burstMaxStacks,stacks\)\*data\.burstDamagePerStack\*formMult\)\)\)/,'毒王 burst cap doubled');
assert.match(poisonAdvanced,/value:value\|\|data\.poisonDamage\|\|6/,'毒王 addPoison fallback doubled');
assert.match(poisonAdvanced,/damage:14,extendMs:700,attackIntervalMs:1400/,'毒王 temporary insect fallback damage doubled');
assert.match(poisonAdvanced,/\(data\.damage\|\|14\)\*0\.6\*king\.form\.damage/,'毒王 temporary insect hardcoded fallback doubled');
const flameUltimate=src('src/skills/handlers/FlameUltimateSkills.js');
assert.match(flameUltimate,/p\.actualDamage\*data\.pulseRatio/,'永燃之心 low-cap pulse scales from already-doubled burn tick');
assert.match(flameUltimate,/Math\.min\(data\.pulseDamageCap/,'永燃之心 doubled cap still applied');
const poisonCore=src('src/skills/handlers/PoisonSummonCoreSkills.js');
assert.match(poisonCore,/growth\*damagePerGrowth/,'寄生蛊 damage uses adjusted skill-specific conversion');
const afterimageCore=src('src/skills/handlers/AfterimageCoreSkills.js');
assert.match(afterimageCore,/payload\.damage\|\|0\)\*data\.damageRatio/,'影袭 damage uses adjusted skill-specific ratio');

const covered=new Set([...Object.keys(fixedDamageChecks),...Object.keys(skillSpecificCoefficientChecks),...Object.keys(pureOrBuffOnly)]);
eq([...covered].sort(),[...expectedIds].sort(),'all 36 skills categorized as damage, coefficient, or pure/buff');
console.log('v0.10.40 full skill damage validation passed.');
