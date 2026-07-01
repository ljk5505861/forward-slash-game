import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { TAGS, BUILD_TAGS } from '../src/config/tags.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { getEnemyGravityState, getEnemyMoveSpeed, getEnemyAttackDelay, applyEnemyGravity, applyGravityPull, updateGravityPull, isExternallyGravitySuppressed } from '../src/systems/EnemyGravityControl.js';
import { validateSkillDetailContent, getSkillDetailData } from '../src/ui/skillDetailContent.js';
assert.equal(GAME_VERSION,'0.10.87'); assert.equal(JSON.parse(fs.readFileSync('package.json','utf8')).version,'0.10.87');
assert.equal(Object.keys(SKILLS).length,33); assert.equal(Object.values(SKILLS).filter(s=>s.rarity==='RARE'&&s.tags.includes(TAGS.GRAVITY)).length,2); assert.equal(Object.values(SKILLS).filter(s=>s.rarity==='EPIC'&&s.tags.includes(TAGS.GRAVITY)).length,1); assert.equal(Object.values(SKILLS).filter(s=>s.rarity==='MYTHIC'&&s.tags.includes(TAGS.GRAVITY)).length,1);
assert.equal(TAGS.GRAVITY,'gravity'); assert.equal(TAGS.CELESTIAL,'celestial'); assert.equal(TAGS.BUILD_GRAVITY,'buildGravity'); assert(BUILD_TAGS.includes(TAGS.BUILD_GRAVITY));
for (const id of ['gravity_crush','gravity_field','gravity_orb','black_hole']){ const s=SKILLS[id]; assert(s); assert.equal(s.requiredSkillId,undefined); for(const t of [TAGS.MAGIC,TAGS.GRAVITY,TAGS.BUILD_GRAVITY]) assert(s.tags.includes(t)); assert(SKILL_HANDLERS[s.handler]); assert.equal(s.levels.length,9); }
for (const id of ['gravity_crush','gravity_field','gravity_orb']) assert(SKILLS[id].tags.includes(TAGS.ACTIVE_SKILL)); assert(SKILLS.gravity_orb.tags.includes(TAGS.PROJECTILE)); assert(SKILLS.black_hole.tags.includes(TAGS.CELESTIAL)); assert(SKILLS.black_hole.tags.includes('mythicSkill')); assert.equal(SKILLS.black_hole.passive,true); assert.equal(SKILLS.black_hole.ultimateSkill,true);
assert.deepEqual(SKILLS.gravity_crush.levels.map(x=>x.damage),[68,75,84,93,102,114,126,138,150]); assert.deepEqual(SKILLS.gravity_field.levels.map(x=>x.fieldCount),[1,1,1,1,1,1,1,1,2]); assert.deepEqual(SKILLS.gravity_orb.levels.map(x=>x.orbCount),[1,1,1,1,1,2,2,2,2]); assert.deepEqual(SKILLS.black_hole.levels.map(x=>x.collapseDamage),[90,100,112,124,136,155,170,185,210]);
let e={active:true,hp:100}; applyEnemyGravity(e,{sourceId:'a',moveSlow:.2,attackSlow:.1,expiresAt:1000,external:true}); applyEnemyGravity(e,{sourceId:'b',moveSlow:.5,attackSlow:.2,expiresAt:1000,external:false}); assert.deepEqual(getEnemyGravityState(e,0),{moveSlow:.5,attackSlow:.2,suppressed:true,externalSuppressed:true}); assert.equal(getEnemyMoveSpeed(e,100,0),50); assert.equal(Math.round(getEnemyAttackDelay(e,1000,0)),1250); assert(isExternallyGravitySuppressed(e,0));
let boss={active:true,hp:100,isBoss:true}; applyEnemyGravity(boss,{sourceId:'a',moveSlow:.5,attackSlow:.5,expiresAt:1000,external:true}); assert.equal(getEnemyMoveSpeed(boss,100,0),80);
const scene={targeting:{isEnemyFullyInsideViewport:()=>true},physics:{world:{bounds:{width:1000}}}}; let pull={active:true,hp:100,x:200,y:50,width:40,body:{reset(x,y){pull.x=x;pull.y=y},setVelocityX(v){pull.v=v}}}; assert(applyGravityPull(pull,300,80,200,0,scene)); updateGravityPull(pull,100,scene); assert(pull.x>200&&pull.x<300); updateGravityPull(pull,250,scene); assert.equal(pull.gravityPull,undefined);
assert.deepEqual(validateSkillDetailContent(), []); for(const id of ['gravity_crush','gravity_field','gravity_orb','black_hole']) for(const level of [1,3,6,8,9]){ const d=getSkillDetailData(id,{skill:{id,level}}); assert(d.currentEffects.join(' ').match(/\d/)); if(level<9) assert(d.nextLevelPreview.join(' ').match(/[\d%秒]/)); }
console.log('v0.10.87 gravity flow validation passed');
