import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';

const nums=(id,key)=>SKILLS[id]?.levels?.map(level=>level[key]);
const eq=(actual,expected,label)=>assert.deepEqual(actual,expected,label);
const src=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

const archetypes={
  fire:['fireball','flame_spray','burn_burst','wildfire','meteor','eternal_flame_heart'],
  sword:['sword_wave','split_sword','rotating_sword','execution_sword','myriad_swords','heaven_splitting_sword'],
  strength:['giant_force','spinning_blade','bloodthirst','frenzy','blood_rage_burst','last_stand'],
  defense:['healing','thorn_armor','guardian_shield','armor_break_shockwave','immovable_mountain','black_tortoise_body'],
  afterimage:['shadow_fist','phantom_step','shadow_assault','swift_shadow','instant_step','myriad_afterimage'],
  poison:['poison_cloud','parasitic_gu','bone_eating_insect','poison_chain','poison_king','plague_mother'],
};
const allSkillIds=Object.values(archetypes).flat();
eq(GAME_VERSION,'0.10.40','game version');
eq(allSkillIds.length,36,'all 36 skills listed');
eq(new Set(allSkillIds).size,36,'all 36 skills unique');
allSkillIds.forEach(id=>assert.ok(SKILLS[id],`missing skill ${id}`));

const damageChecks={
  fireball:{damage:[50,58,68,78,90,104,120,138,160],burnDamage:[6,6,8,8,10,10,12,12,14]},
  flame_spray:{burnDamage:[8,10,10,12,12,14,14,16,18]},
  burn_burst:{damagePerStack:[18,20,20,22,22,24,24,26,28]},
  meteor:{damage:[104,120,138,158,180,206,234,264,300],burnDamage:Array(9).fill(14)},
  sword_wave:{damage:[34,42,44,54,64,68,82,96,104]},
  split_sword:{damage:[24,30,30,36,42,44,52,60,68]},
  rotating_sword:{damage:[44,52,56,66,72,84,92,104,120]},
  execution_sword:{bossDamage:[44,54,64,76,88,104,120,140,164],executeFloor:[180,190,200,210,220,230,240,250,260]},
  myriad_swords:{damage:[52,60,64,72,80,84,92,100,108]},
  heaven_splitting_sword:{waveDamage:[320,360,410,470,540,620,710,810,940],abyssDamage:[64,76,90,108,128,152,180,212,244],closingDamage:[0,0,0,0,0,0,0,0,395]},
  thorn_armor:{flatDamage:[4,4,6,6,8,8,10,10,12]},
  armor_break_shockwave:{damage:[90,110,132,156,180,204,224,242,260]},
  instant_step:{damage:[110,132,156,180,208,240,264,284,300]},
  poison_cloud:{damage:[26,32,40,48,58,70,84,100,120],poisonDamage:[6,6,8,8,10,10,12,14,16]},
  bone_eating_insect:{damage:[14,16,16,18,20,20,22,24,28]},
  poison_king:{biteDamage:[36,44,54,66,80,96,116,140,170],burstDamagePerStack:[10,12,14,16,18,20,22,24,26]},
  plague_mother:{basePoisonDamage:Array(9).fill(6)},
};
Object.entries(damageChecks).forEach(([id,fields])=>Object.entries(fields).forEach(([field,expected])=>eq(nums(id,field),expected,`${id}.${field}`)));

eq(nums('shadow_assault','damageRatio'),[0.44,0.50,0.56,0.62,0.68,0.76,0.84,0.92,1.04],'影袭专属伤害倍率');
eq(nums('parasitic_gu','damagePerGrowth'),[0.20,0.22,0.24,0.26,0.28,0.32,0.36,0.40,0.46],'寄生蛊成长伤害换算');
eq(nums('poison_chain','damageRatio'),[0.70,0.80,0.88,0.96,1.04,1.12,1.18,1.24,1.30],'毒链完整两倍伤害倍率');

const pureOrBuffOnly=['wildfire','eternal_flame_heart','giant_force','spinning_blade','bloodthirst','frenzy','blood_rage_burst','last_stand','healing','guardian_shield','immovable_mountain','black_tortoise_body','shadow_fist','phantom_step','swift_shadow','myriad_afterimage'];
const covered=new Set([...Object.keys(damageChecks),'shadow_assault','parasitic_gu','poison_chain',...pureOrBuffOnly]);
eq([...covered].sort(),[...allSkillIds].sort(),'all 36 skills categorized');

// Representative non-damage values stay unchanged.
eq(nums('fireball','cooldownMs'),[1900,1800,1750,1680,1620,1560,1500,1440,1360],'火球冷却 unchanged');
eq(nums('fireball','burnIntervalMs'),Array(9).fill(600),'燃烧间隔 unchanged');
eq(nums('spinning_blade','heavyHitMultiplier'),[1.55,1.7,1.8,1.95,2.1,2.2,2.35,2.5,2.65],'重击倍率 unchanged');
eq(nums('bloodthirst','lifeSteal'),[0.02,0.025,0.03,0.035,0.04,0.045,0.05,0.055,0.06],'嗜血吸血 unchanged');
eq(nums('healing','defense'),[2,3,5,7,9,12,15,18,22],'铁壁防御 unchanged');
eq(nums('guardian_shield','flatShield'),[6,7,8,9,10,11,12,13,15],'守护盾 unchanged');
eq(nums('poison_cloud','poisonIntervalMs'),Array(9).fill(700),'毒伤间隔 unchanged');
eq(nums('sword_wave','attackIntervalMs'),[1300,1220,1180,1100,1030,980,920,860,780],'御剑术频率 unchanged');
eq(nums('myriad_swords','temporarySwords'),[2,2,3,3,3,4,4,4,5],'万剑归宗数量 unchanged');

// Hardcoded handler paths must also use doubled values.
const swordUltimate=src('src/skills/handlers/SwordUltimateSkills.js');
assert.match(swordUltimate,/system\.damageValue\(10\+fire\*6,ctx\)/,'一剑开天火属性固定伤害');
assert.match(swordUltimate,/value:4\+fire\*2/,'一剑开天燃烧跳伤');
assert.match(swordUltimate,/value:4\+poison\*2/,'一剑开天中毒跳伤');

const poisonAdvanced=src('src/skills/handlers/PoisonSummonAdvancedSkills.js');
assert.match(poisonAdvanced,/\[2,1\.04,185,540\].*\[2,1\.12,195,500\].*\[3,1\.18,205,470\].*\[3,1\.24,215,440\].*\[3,1\.30,220,400\]/s,'毒链倍率写在源配置中');
assert.doesNotMatch(poisonAdvanced,/poisonDamage\|\|3/,'毒王不保留旧毒伤兜底');
assert.match(poisonAdvanced,/data\.poisonDamage\|\|6,`poison_king_return_/,'毒王回感染兜底翻倍');
assert.match(poisonAdvanced,/Math\.min\(360,Math\.max\(1,Math\.round\(Math\.min\(data\.burstMaxStacks,stacks\)\*data\.burstDamagePerStack\*formMult\)\)\)/,'毒王爆发上限翻倍');
assert.match(poisonAdvanced,/damage:14,extendMs:700,attackIntervalMs:1400/,'临时毒虫兜底伤害翻倍');
assert.match(poisonAdvanced,/\(data\.damage\|\|14\)\*0\.6\*king\.form\.damage/,'临时毒虫命中兜底翻倍');

const flameUltimate=src('src/skills/handlers/FlameUltimateSkills.js');
assert.match(flameUltimate,/p\.actualDamage\*data\.pulseRatio/,'永燃之心基于翻倍后的燃烧跳伤');
assert.match(flameUltimate,/Math\.min\(data\.pulseDamageCap/,'永燃之心伤害上限仍生效');
const poisonCore=src('src/skills/handlers/PoisonSummonCoreSkills.js');
assert.match(poisonCore,/growth\*damagePerGrowth/,'寄生蛊使用专属伤害换算');
const afterimageCore=src('src/skills/handlers/AfterimageCoreSkills.js');
assert.match(afterimageCore,/payload\.damage\|\|0\)\*data\.damageRatio/,'影袭使用专属伤害倍率');
const handlerIndex=src('src/skills/handlers/index.js');
assert.doesNotMatch(handlerIndex,/poisonChainDamageRatios/,'总入口不含毒链运行时覆盖');

console.log('v0.10.40 full skill damage validation passed.');
