import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';

const failures=[];
const assert=(cond,msg)=>{ if(!cond) failures.push(msg); };
const eq=(a,b,msg)=>assert(JSON.stringify(a)===JSON.stringify(b),`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const nums=(id,key)=>SKILLS[id]?.levels?.map(l=>l[key]);
const ids=['fireball','flame_spray','burn_burst','wildfire','meteor','eternal_flame_heart','sword_wave','split_sword','rotating_sword','execution_sword','myriad_swords','heaven_splitting_sword','spinning_blade','giant_force','bloodthirst','frenzy','blood_rage_burst','last_stand','healing','thorn_armor','guardian_shield','armor_break_shockwave','immovable_mountain','black_tortoise_body','shadow_fist','phantom_step','shadow_assault','swift_shadow','instant_step','myriad_afterimage','poison_cloud','parasitic_gu','bone_eating_insect','poison_chain','poison_king','plague_mother'];
ids.forEach(id=>assert(SKILLS[id],`missing skill ${id}`));
eq(GAME_VERSION,'0.10.40','game version');

// Direct and ticking damage values doubled from v0.10.39 baselines.
eq(nums('fireball','damage'),[50,58,68,78,90,104,120,138,160],'火球 direct damage');
eq(nums('fireball','burnDamage'),[6,6,8,8,10,10,12,12,14],'火球 burn tick damage');
eq(nums('flame_spray','burnDamage'),[8,10,10,12,12,14,14,16,18],'烈焰喷射 burn tick damage');
eq(nums('burn_burst','damagePerStack'),[18,20,20,22,22,24,24,26,28],'燃爆 damage per consumed stack');
eq(nums('meteor','damage'),[104,120,138,158,180,206,234,264,300],'陨石 impact damage');
eq(nums('meteor','burnDamage'),Array(9).fill(14),'陨石 ground burn tick damage');
eq(nums('eternal_flame_heart','pulseDamageCap'),[160,176,192,210,230,250,270,284,300],'永燃之心 pulse damage cap');

eq(nums('sword_wave','damage'),[34,42,44,54,64,68,82,96,104],'御剑术 single sword damage');
eq(nums('split_sword','damage'),[24,30,30,36,42,44,52,60,68],'分剑术 single sword damage');
eq(nums('rotating_sword','damage'),[44,52,56,66,72,84,92,104,120],'旋转剑 damage');
eq(nums('execution_sword','bossDamage'),[44,54,64,76,88,104,120,140,164],'斩命剑 boss damage');
eq(nums('execution_sword','executeFloor'),[180,190,200,210,220,230,240,250,260],'斩命剑 fixed execute floor');
eq(nums('myriad_swords','damage'),[52,60,64,72,80,84,92,100,108],'万剑归宗 single sword damage');
eq(nums('heaven_splitting_sword','waveDamage'),[320,360,410,470,540,620,710,810,940],'一剑开天 waveDamage');
eq(nums('heaven_splitting_sword','abyssDamage'),[64,76,90,108,128,152,180,212,244],'一剑开天 abyssDamage');
eq(nums('heaven_splitting_sword','closingDamage'),[0,0,0,0,0,0,0,0,395],'一剑开天 closingDamage derived from doubled waveDamage');

eq(nums('thorn_armor','flatDamage'),[4,4,6,6,8,8,10,10,12],'荆棘甲 flat reflect damage');
eq(nums('armor_break_shockwave','damage'),[90,110,132,156,180,204,224,242,260],'碎甲震荡 damage');
eq(nums('instant_step','damage'),[110,132,156,180,208,240,264,284,300],'瞬身 afterimage damage');
eq(nums('poison_cloud','damage'),[26,32,40,48,58,70,84,100,120],'毒针 direct damage');
eq(nums('poison_cloud','poisonDamage'),[6,6,8,8,10,10,12,14,16],'毒针 poison tick damage');
eq(nums('bone_eating_insect','damage'),[14,16,16,18,20,20,22,24,28],'蚀骨毒虫 summon damage');
eq(nums('poison_king','biteDamage'),[36,44,54,66,80,96,116,140,170],'毒王 bite damage');
eq(nums('poison_king','burstDamagePerStack'),[10,12,14,16,18,20,22,24,26],'毒王 burst damage per stack');
eq(nums('plague_mother','basePoisonDamage'),Array(9).fill(6),'瘟疫母体 base poison tick damage');

// Non-damage and multiplier fields intentionally unchanged.
eq(nums('spinning_blade','heavyHitMultiplier'),[1.55,1.7,1.8,1.95,2.1,2.2,2.35,2.5,2.65],'重击倍率 unchanged');
eq(nums('healing','defense'),[2,3,5,7,9,12,15,18,22],'铁壁 defense unchanged');
eq(nums('healing','damageReduction'),[0,0,0,0.02,0.03,0.04,0.05,0.06,0.08],'铁壁 damage reduction unchanged');
eq(nums('guardian_shield','flatShield'),[6,7,8,9,10,11,12,13,15],'守护盾 flat shield unchanged');
eq(nums('bloodthirst','lifeSteal'),[0.02,0.025,0.03,0.035,0.04,0.045,0.05,0.055,0.06],'嗜血 life steal unchanged');
eq(nums('fireball','burnMs'),Array(9).fill(3600),'燃烧 duration unchanged');
eq(nums('fireball','burnIntervalMs'),Array(9).fill(600),'燃烧 interval unchanged');
eq(nums('poison_cloud','poisonMs'),Array(9).fill(4200),'中毒 duration unchanged');
eq(nums('poison_cloud','poisonIntervalMs'),Array(9).fill(700),'中毒 interval unchanged');
eq(nums('sword_wave','attackIntervalMs'),[1300,1220,1180,1100,1030,980,920,860,780],'御剑术 attack interval unchanged');
eq(nums('split_sword','attackIntervalMs'),[1500,1420,1360,1280,1210,1140,1070,1000,920],'分剑术 attack interval unchanged');
eq(nums('myriad_swords','temporarySwords'),[2,2,3,3,3,4,4,4,5],'万剑归宗 sword count unchanged');
eq(nums('meteor','cooldownMs'),[7600,7300,7000,6700,6400,6100,5800,5500,5100],'陨石 cooldown unchanged');

if(failures.length){ console.error('v0.10.40 skill damage validation failed:'); failures.forEach(f=>console.error(`- ${f}`)); process.exit(1); }
console.log('v0.10.40 skill damage validation passed.');
