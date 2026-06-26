import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { StatusEffects } from '../src/systems/StatusEffectSystem.js';

const src=p=>fs.readFileSync(p,'utf8');
assert.equal(GAME_VERSION,'0.10.53','game version is 0.10.53');
const poisonIds=Object.values(SKILLS).filter(s=>s.tags?.includes('build_poison_summon')||['poison_cloud','parasitic_gu','poison_chain','poison_king'].includes(s.id)).map(s=>s.id).sort();
assert.deepEqual(poisonIds,['parasitic_gu','poison_chain','poison_cloud','poison_king'].sort(),'poison summon pool has exactly four skills');
for (const removed of ['bone_eating_insect','plague_mother']) assert.equal(SKILLS[removed],undefined,`${removed} removed from skill pool/details`);
const production=[src('src/skills/handlers/index.js'),src('src/skills/handlers/PoisonSummonCoreSkills.js'),src('src/skills/handlers/PoisonSummonAdvancedSkills.js'),src('src/ui/skillDetailContent.js')].join('\n');
assert(!/bone_eating_insect|plague_mother|PlagueMother|BoneEating|infectionSnapshot|consumeRatio|burstDamagePerStack|tempInsects|poisonSummonBonusUtils|hp-=0\*dt/.test(production),'old poison production remnants removed');
assert.equal(SKILLS.parasitic_gu.requiredSkillId,'poison_cloud');
assert.equal(SKILLS.poison_chain.requiredSkillId,'parasitic_gu');
assert.equal(SKILLS.poison_king.requiredSkillId,'poison_chain');
assert.equal(SKILLS.poison_cloud.levels[0].maxHits,3,'poison needle base max hits 3');
assert.equal(SKILLS.poison_cloud.levels[5].maxHits,999,'poison needle level 6 pierces all');
assert.equal(SKILLS.poison_cloud.levels[0].poisonNeedleLineWidth,56,'poison needle line width configured');
assert.equal(SKILLS.poison_cloud.levels[0].poisonNeedleMaxRange,760,'poison needle max range configured');
assert.equal(SKILLS.poison_cloud.levels[8].poisonHealingRatio,0.03,'poison needle level 9 healing ratio');
assert.equal(SKILLS.poison_cloud.levels[8].poisonHealingCapMaxHpPerSecond,0.01,'poison needle healing cap');
const core=src('src/skills/handlers/PoisonSummonCoreSkills.js');
for (const token of ['system.getLevel(\'parasitic_gu\')>=9','system.getLevel(\'parasitic_gu\')>=3','system.getLevel(\'parasitic_gu\')>=6','tenaciousLossMultiplier','bloodLeechDamageMultiplier','berserkMs']) assert(core.includes(token),`gu level-gated runtime includes ${token}`);
const adv=src('src/skills/handlers/PoisonSummonAdvancedSkills.js');
for (const token of ['WeakMap','edgeKey','STATUS_STACK_CHANGED','chainTransfer:true','chainDeathRelay:true','isAlive:','takeDamage:','getHp:','getMaxHp:','maxStage','domainRadius','domainIntervalMs']) assert(adv.includes(token),`advanced runtime includes ${token}`);
assert(/noPoisonChain:true/.test(adv),'poison chain recursion guard present');
assert(/normalPoison/.test(adv),'poison king grows only from normal poison ticks');
assert(/king\.domain\?\.destroy/.test(adv),'poison king domain destroyed on death');

function eventBus(){ const handlers={}; return { on(type,fn){ (handlers[type]??=[]).push(fn); return ()=>handlers[type]=handlers[type].filter(x=>x!==fn); }, emit(type,p){ (handlers[type]||[]).forEach(fn=>fn(p)); } }; }
function fakeScene(){ const bus=eventBus(); const visuals=[]; const scene={ player:{x:0,y:100}, playerData:{hp:50,maxHp:100,skills:[]}, getGameplayTime(){return this.now||0;}, now:0, eventBus:bus, targeting:{ enemies:[], all(){return this.enemies;}, valid:e=>e&&e.active!==false&&!e.isDefeated, isEnemyFullyInsideViewport:()=>true }, add:{ circle(x,y){ const o={x,y,active:true,destroy(){this.active=false;},setStrokeStyle(){return this;},setDepth(){return this;},setFillStyle(){return this;},setScale(){return this;}}; visuals.push(o); return o; }, graphics(){ const o={destroyed:false,clear(){return this;},lineStyle(){return this;},lineBetween(){return this;},setDepth(){return this;},destroy(){this.destroyed=true;}}; visuals.push(o); return o; }, container(x,y){ const o={x,y,add(){},setDepth(){return this;},setScale(v){this.scale=v;return this;},destroy(){this.destroyed=true;}}; visuals.push(o); return o; }, ellipse(){ return {setStrokeStyle(){return this;}}; } }, tweens:{add(){}}, floatText(){}, combatSystem:{ damageEnemy(e,d){ e.hp=Math.max(0,(e.hp||0)-d); return true; } }, statusEffects:{ poisoned:new Set(), has(e){return this.poisoned.has(e);}, add(_type,e,opt){ this.poisoned.add(e); const effect={...opt,type:_type,target:e,poisonMeta:opt.poisonMeta||{}}; bus.emit(CombatEvents.STATUS_APPLIED,{type:_type,target:e,effect,stacks:opt.stacks||1}); return effect; }, getStackCount(e){return e.stacks||1;} }, healCalls:[], healPlayer(amount,source,meta){ const heal=Math.max(0,Math.floor(amount)); this.healCalls.push({amount:heal,source,meta}); const actual=Math.min(heal,this.playerData.maxHp-this.playerData.hp); this.playerData.hp+=actual; return actual; } }; scene.visuals=visuals; return scene; }

// Runtime: poison needle line only hits enemies near the ray and level 6 pierces all.
{ const scene=fakeScene(); const enemies=[{x:100,y:100,hp:10},{x:180,y:103,hp:10},{x:220,y:210,hp:10},{x:260,y:98,hp:10},{x:340,y:101,hp:10}]; scene.targeting.enemies=enemies; const system={scene,getLevel:()=>5,getData:()=>SKILLS.poison_cloud.levels[4],damageValue:v=>v,baseDamageValue:v=>v,projectile(){this.projectiles=(this.projectiles||0)+1;},hit(e,d){e.hit=(e.hit||0)+1;e.hp-=d;return true;}}; SKILL_HANDLERS.entry_poison_needle.cast(system,SKILLS.poison_cloud,SKILLS.poison_cloud.levels[4],5,{}); assert.equal(enemies[2].hit||0,0,'off-ray enemy is not hit'); assert.equal(enemies.filter(e=>e.hit).length,3,'level 5 hits max three on ray'); assert.equal(system.projectiles,1,'one poison needle visual'); const sys6={...system,getLevel:()=>6,getData:()=>SKILLS.poison_cloud.levels[5],projectiles:0}; enemies.forEach(e=>{e.hit=0;e.hp=10;}); SKILL_HANDLERS.entry_poison_needle.cast(sys6,SKILLS.poison_cloud,SKILLS.poison_cloud.levels[5],6,{}); assert.equal(enemies.filter(e=>e.hit).length,4,'level 6 pierces all on ray'); }

// Runtime: poison healing uses healPlayer, cap, and ignore cap.
{ const scene=fakeScene(); scene.playerData.skills=[{id:'poison_cloud',level:9}]; const system={scene,getLevel:()=>9,getData:()=>SKILLS.poison_cloud.levels[8]}; const off=SKILL_HANDLERS.entry_poison_needle.bind(system); const effect={poisonMeta:{normal:true}}; scene.eventBus.emit(CombatEvents.STATUS_TICK,{type:StatusEffects.POISON,actualDamage:1000,effect}); assert.equal(scene.healCalls[0].amount,1,'poison heal capped at 1% max hp'); scene.playerData.ignorePoisonHealingCap=true; scene.now=1200; scene.eventBus.emit(CombatEvents.STATUS_TICK,{type:StatusEffects.POISON,actualDamage:1000,effect}); assert(scene.healCalls.at(-1).amount>1,'ignorePoisonHealingCap removes cap'); off(); }

// Runtime: poison king exposed target can be damaged, die, destroy domain, revive, and grow to cap.
{ const scene=fakeScene(); scene.playerData.skills=[{id:'poison_king',level:9}]; const system={scene,passiveState:{},passiveUpdaters:[],getLevel:()=>9,getData:()=>SKILLS.poison_king.levels[8]}; const off=SKILL_HANDLERS.poison_king.bind(system); system.passiveUpdaters.forEach(fn=>fn()); const api=system.passiveState.poisonKing; assert(api?.isAlive(),'poison king spawns alive'); api._debug().domain={destroyed:false,destroy(){this.destroyed=true;}}; api.takeDamage(api.getHp(),'test'); assert.equal(system.passiveState.poisonKing,null,'poison king dies at zero hp'); scene.now=SKILLS.poison_king.levels[8].reviveMs+1; system.passiveUpdaters.forEach(fn=>fn()); assert(system.passiveState.poisonKing?.isAlive(),'poison king revives'); const k=system.passiveState.poisonKing._debug(); for(let i=0;i<100;i++) scene.eventBus.emit(CombatEvents.STATUS_TICK,{type:StatusEffects.POISON,actualDamage:100,effect:{poisonMeta:{normal:true}}}); assert.equal(k.stage,SKILLS.poison_king.levels[8].maxStage,'poison king growth cap applies'); off(); }
console.log('validate-01053-poison-summon-rework: ok');
