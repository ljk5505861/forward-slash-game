import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import '../src/skills/handlers/index.js';
import { TAGS, BUILD_TAGS } from '../src/config/tags.js';
assert.equal(GAME_VERSION,'0.11.6');
assert.equal(Object.keys(SKILLS).length,42,'skill total 41');
const counts={COMMON:0,FINE:0,RARE:0,EPIC:0,MYTHIC:0}; Object.values(SKILLS).forEach(s=>counts[s.rarity]++);
assert.deepEqual(counts,{COMMON:9,FINE:2,RARE:12,EPIC:10,MYTHIC:9});
assert.equal(TAGS.SUPERPOWER,'superpower'); assert.equal(TAGS.ICE,'ice'); assert.equal(TAGS.BUILD_SUPERHERO,'buildSuperhero'); assert.ok(BUILD_TAGS.includes(TAGS.BUILD_SUPERHERO));
const expected=[['super_speed','超级速度','COMMON'],['laser_eyes','镭射眼','FINE'],['freezing_breath','冰冻吐息','RARE']];
for(const [id,name,rarity] of expected){ const s=SKILLS[id]; assert.ok(s,`${id} exists`); assert.equal(s.name,name); assert.equal(s.rarity,rarity); assert.equal(s.maxLevel,9); assert.equal(s.requiredSkillId,undefined); assert.ok(s.tags.includes(TAGS.BUILD_SUPERHERO)); assert.equal(s.tags.includes('mythicSkill'),false); assert.notEqual(s.ultimateSkill,true); }
assert.ok(SKILLS.super_speed.tags.includes(TAGS.SUPERPOWER));
assert.ok(SKILLS.laser_eyes.tags.includes(TAGS.SUPERPOWER)&&SKILLS.laser_eyes.tags.includes(TAGS.MAGIC)&&SKILLS.laser_eyes.tags.includes(TAGS.SPELL)&&SKILLS.laser_eyes.tags.includes(TAGS.ACTIVE_SKILL));
assert.equal(SKILLS.laser_eyes.tags.includes(TAGS.NORMAL_ATTACK),false);
assert.ok(SKILLS.freezing_breath.tags.includes(TAGS.ICE));
assert.ok(Object.values(SKILLS).filter(s=>!s.ultimateSkill&&s.rarity!=='MYTHIC').some(s=>s.id==='super_speed')); assert.ok(Object.values(SKILLS).filter(s=>!s.ultimateSkill&&s.rarity!=='MYTHIC').some(s=>s.id==='laser_eyes')); assert.ok(Object.values(SKILLS).filter(s=>!s.ultimateSkill&&s.rarity!=='MYTHIC').some(s=>s.id==='freezing_breath'));
assert.ok(!Object.values(SKILLS).filter(s=>s.rarity==='MYTHIC'||s.ultimateSkill).some(s=>['super_speed','laser_eyes','freezing_breath'].includes(s.id)));
console.log('v0.11.1 superhero flow config validation passed');
