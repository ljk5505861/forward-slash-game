import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import EnemyBehaviorManager from '../src/enemies/behaviors/EnemyBehaviorManager.js';

const src=path=>fs.readFileSync(path,'utf8');
assert.equal(GAME_VERSION,'0.10.53','game version is 0.10.53');
const poisonIds=Object.values(SKILLS).filter(skill=>skill.tags?.includes('build_poison_summon')||['poison_cloud','parasitic_gu','poison_chain','poison_king'].includes(skill.id)).map(skill=>skill.id).sort();
assert.deepEqual(poisonIds,['parasitic_gu','poison_chain','poison_cloud','poison_king'].sort(),'poison summon pool has exactly four skills');
for(const removed of ['bone_eating_insect','plague_mother']) assert.equal(SKILLS[removed],undefined,`${removed} removed from skill pool/details`);
const production=[src('src/skills/handlers/index.js'),src('src/skills/handlers/PoisonSummonCoreSkills.js'),src('src/skills/handlers/PoisonSummonAdvancedSkills.js'),src('src/ui/skillDetailContent.js')].join('\n');
assert(!/bone_eating_insect|plague_mother|PlagueMother|BoneEating|infectionSnapshot|consumeRatio|burstDamagePerStack|tempInsects|poisonSummonBonusUtils|hp-=0\*dt/.test(production),'old poison production remnants removed');
assert.equal(SKILLS.parasitic_gu.requiredSkillId,'poison_cloud');
assert.equal(SKILLS.poison_chain.requiredSkillId,'parasitic_gu');
assert.equal(SKILLS.poison_king.requiredSkillId,'poison_chain');
assert.equal(SKILLS.poison_cloud.levels[0].maxHits,3);
assert.equal(SKILLS.poison_cloud.levels[5].maxHits,999);
assert.equal(SKILLS.poison_cloud.levels[0].poisonNeedleLineWidth,56);
assert.equal(SKILLS.poison_cloud.levels[0].poisonNeedleMaxRange,760);
assert.equal(SKILLS.poison_cloud.levels[8].poisonHealingRatio,0.03);
assert.equal(SKILLS.poison_cloud.levels[8].poisonHealingCapMaxHpPerSecond,0.01);
assert.equal(SKILLS.parasitic_gu.levels[2].lifeLossPerSecond,2.4);
assert.equal(SKILLS.parasitic_gu.levels[5].leechDamage,21);
assert.equal(SKILLS.poison_king.levels[5].biteDamage,58);

function eventBus(){
  const handlers={};
  return {
    on(type,fn){ (handlers[type]??=[]).push(fn); return ()=>{ handlers[type]=handlers[type].filter(item=>item!==fn); }; },
    emit(type,payload){ [...(handlers[type]||[])].forEach(fn=>fn(payload)); },
    count(type){ return (handlers[type]||[]).length; }
  };
}
function visual(x=0,y=0){ return {x,y,active:true,destroyed:false,setStrokeStyle(){return this;},setDepth(){return this;},setFillStyle(){return this;},setScale(value){this.scale=value;return this;},setOrigin(){return this;},clear(){return this;},lineStyle(){return this;},lineBetween(){return this;},add(){return this;},destroy(){this.active=false;this.destroyed=true;}}; }
function fakeScene(){
  const bus=eventBus();
  const scene={now:0,player:{x:0,y:100},playerData:{hp:50,maxHp:100,skills:[],dodgeChance:0,defense:0,damageReduction:0,temporaryDamageReduction:0,healingReceivedMultiplierBonuses:{},defenseBonuses:{},damageReductionBonuses:{},dodgeChanceBonuses:{},attackDamageBonuses:{},normalAttackDamageBonuses:{},heavyHitDamageBonuses:{},attackSpeedMultiplierBonuses:{},lifeStealBonuses:{},heavyHitLifeStealBonuses:{},moveSpeedMultiplierBonuses:{},afterimageDamageBonuses:{}},enemies:[],eventBus:bus,getGameplayTime(){return this.now;},isGameplayPaused(){return false;},targeting:{all(){return scene.enemies.filter(enemy=>enemy.active!==false&&!enemy.isDefeated&&enemy.hp>0);},valid(enemy){return !!enemy&&enemy.active!==false&&!enemy.isDefeated&&enemy.hp>0;},isEnemyFullyInsideViewport(){return true;},shouldRecycleEnemyLeft(){return false;},getEnemyRightRespawnX(){return 500;}},statusEffects:{poisoned:new Set(),stacks:new Map(),has(enemy){return this.poisoned.has(enemy);},getStackCount(enemy){return this.stacks.get(enemy)||0;},getEffects(){return [];},absorbShield(damage){return {absorbed:0,remainingDamage:damage};},clearTarget(){},add(type,enemy,options){const existed=this.poisoned.has(enemy);const before=this.stacks.get(enemy)||0;this.poisoned.add(enemy);this.stacks.set(enemy,before+(options.stacks||1));const effect={...options,type,target:enemy,poisonMeta:options.poisonMeta||{}};if(existed)bus.emit(CombatEvents.STATUS_STACK_CHANGED,{type,target:enemy,effect,delta:options.stacks||1});else bus.emit(CombatEvents.STATUS_APPLIED,{type,target:enemy,effect,stacks:options.stacks||1});return effect;}},add:{circle:(x,y)=>visual(x,y),ellipse:(x,y)=>visual(x,y),container:(x,y)=>visual(x,y),graphics:()=>visual(),line:()=>visual(),triangle:(x,y)=>visual(x,y)},tweens:{add(){}},time:{delayedCall(_delay,fn){fn();}},floatText(){},balance:{groundTopY:100,stageWorldWidth:1000,enemyFadeMs:10,enemies:{rangeBuffer:24}},hud:{update(){},setStatus(){}},finishRun(){},awardGold(){},professionSystem:{getDamageMultiplier(){return 1;}},artifactSystem:{highHpDamageMultiplier(){return 1;}}};
  scene.combatSystem={damageEnemy(enemy,damage){const before=enemy.hp;enemy.hp=Math.max(0,enemy.hp-damage);return before!==enemy.hp;}};
  return scene;
}

{
  const scene=fakeScene(); const enemies=[{x:100,y:100,hp:500,active:true},{x:180,y:103,hp:500,active:true},{x:220,y:210,hp:500,active:true},{x:260,y:98,hp:500,active:true},{x:340,y:101,hp:500,active:true}]; scene.enemies=enemies;
  const system={scene,getLevel:()=>5,getData:()=>SKILLS.poison_cloud.levels[4],damageValue:value=>value,baseDamageValue:value=>value,projectile(){this.projectiles=(this.projectiles||0)+1;},hit(enemy,damage){enemy.hit=(enemy.hit||0)+1;enemy.hp-=damage;return true;}};
  SKILL_HANDLERS.entry_poison_needle.cast(system,SKILLS.poison_cloud,SKILLS.poison_cloud.levels[4],5,{});
  assert.equal(enemies[2].hit||0,0,'off-ray enemy is not hit'); assert.equal(enemies.filter(enemy=>enemy.hit).length,3,'level 5 hits max three'); assert.equal(system.projectiles,1,'one poison needle visual');
  const level6={...system,getLevel:()=>6,getData:()=>SKILLS.poison_cloud.levels[5],projectiles:0}; enemies.forEach(enemy=>{enemy.hit=0;enemy.hp=500;}); SKILL_HANDLERS.entry_poison_needle.cast(level6,SKILLS.poison_cloud,SKILLS.poison_cloud.levels[5],6,{}); assert.equal(enemies.filter(enemy=>enemy.hit).length,4,'level 6 pierces all'); assert.equal(level6.projectiles,1,'level 6 still uses one visual');
}
{
  const scene=fakeScene(); scene.playerData.hp=100;scene.playerData.maxHp=300;scene.playerData.healingReceivedMultiplierBonuses={test:0.2};scene.healCalls=[];scene.healPlayer=(amount,source,meta)=>{const actual=Math.floor(amount*1.2);scene.healCalls.push({amount,actual,source,meta});scene.playerData.hp+=actual;return actual;};
  const system={scene,getLevel:()=>9,getData:()=>SKILLS.poison_cloud.levels[8]}; const off=SKILL_HANDLERS.entry_poison_needle.bind(system); const effect={poisonMeta:{normal:true}}; scene.eventBus.emit(CombatEvents.STATUS_TICK,{type:StatusEffects.POISON,actualDamage:1000,effect}); assert.equal(scene.playerData.hp,103,'20% healing bonus still capped at 3 actual'); assert.equal(scene.healCalls[0].actual,3); scene.playerData.ignorePoisonHealingCap=true;scene.now=1200;scene.eventBus.emit(CombatEvents.STATUS_TICK,{type:StatusEffects.POISON,actualDamage:1000,effect});assert(scene.healCalls.at(-1).actual>3,'ignorePoisonHealingCap removes cap');off();
}
{
  const scene=fakeScene();const system={scene,passiveState:{},passiveUpdaters:[],getLevel:()=>1,getData:()=>SKILLS.parasitic_gu.levels[0]};const off=SKILL_HANDLERS.parasitic_gu.bind(system);scene.now=10000;system.passiveUpdaters.forEach(update=>update());const gu=system.passiveState.parasiticGu.getSnapshot()[0];assert.equal(Math.round(gu.hp*10)/10,8,'level 1 loses 4 hp per second');assert.equal(gu.berserkUntil,0,'level 1 cannot berserk');off();
}
{
  const scene=fakeScene();const system={scene,passiveState:{},passiveUpdaters:[],getLevel:()=>3,getData:()=>SKILLS.parasitic_gu.levels[2]};const off=SKILL_HANDLERS.parasitic_gu.bind(system);scene.now=1000;system.passiveUpdaters.forEach(update=>update());const gu=system.passiveState.parasiticGu.getSnapshot()[0];assert.equal(Math.round(gu.hp*10)/10,57.6,'level 3 loses exactly 2.4 hp');off();
}
{
  const scene=fakeScene();const system={scene,passiveState:{},passiveUpdaters:[],getLevel:()=>9,getData:()=>SKILLS.parasitic_gu.levels[8]};const off=SKILL_HANDLERS.parasitic_gu.bind(system);scene.now=31000;system.passiveUpdaters.forEach(update=>update());const gu=system.passiveState.parasiticGu.getSnapshot()[0];assert(gu.berserkUntil>scene.now,'level 9 low-health gu berserks');const firstUntil=gu.berserkUntil;scene.now+=500;system.passiveUpdaters.forEach(update=>update());assert.equal(system.passiveState.parasiticGu.getSnapshot()[0].berserkUntil,firstUntil,'berserk cannot refresh while active');off();
}
for(const [level,index,expected] of [[5,4,14],[6,5,21]]){const scene=fakeScene();const host={x:30,y:100,hp:1000,active:true};scene.enemies=[host];scene.statusEffects.poisoned.add(host);scene.statusEffects.stacks.set(host,1);const system={scene,passiveState:{},passiveUpdaters:[],getLevel:()=>level,getData:()=>SKILLS.parasitic_gu.levels[index]};const off=SKILL_HANDLERS.parasitic_gu.bind(system);scene.now=400;system.passiveUpdaters.forEach(update=>update());assert.equal(1000-host.hp,expected,`level ${level} leech damage is exact`);off();}
{
  const scene=fakeScene();const a={x:0,y:100,hp:100,active:true};const b={x:50,y:100,hp:100,active:true};const c={x:90,y:100,hp:100,active:true};scene.enemies=[a,b,c];[a,b,c].forEach(enemy=>{scene.statusEffects.poisoned.add(enemy);scene.statusEffects.stacks.set(enemy,1);});let level=6;const system={scene,passiveState:{},passiveUpdaters:[],getLevel:()=>level,getData:id=>id==='poison_chain'?SKILLS.poison_chain.levels[level-1]:SKILLS.poison_cloud.levels[8]};const off=SKILL_HANDLERS.poison_chain.bind(system);const runtime=system.passiveState.poisonChain;runtime._debug.addNode(a);runtime._debug.addNode(b);runtime._debug.connect(a,b);const before=scene.statusEffects.getStackCount(b);scene.eventBus.emit(CombatEvents.STATUS_STACK_CHANGED,{type:StatusEffects.POISON,target:a,effect:{poisonMeta:{}},delta:1});assert.equal(scene.statusEffects.getStackCount(b),before+1,'stack change transfers exactly one poison stack');const after=scene.statusEffects.getStackCount(b);scene.eventBus.emit(CombatEvents.STATUS_STACK_CHANGED,{type:StatusEffects.POISON,target:a,effect:{poisonMeta:{chainTransfer:true}},delta:1});assert.equal(scene.statusEffects.getStackCount(b),after,'chain transfer cannot recurse');assert.equal(runtime.getSnapshot().edgeCount,1);runtime._debug.removeNode(a);assert.equal(runtime.getSnapshot().edgeCount,0,'edge visual is destroyed');level=9;a.isDefeated=false;runtime._debug.addNode(a);runtime._debug.connect(a,b);a.isDefeated=true;scene.eventBus.emit(CombatEvents.ENEMY_KILLED,{enemy:a,poisonStacksBeforeDeath:4});assert(runtime.hasConnection(c,b),'death relay reconnects to surviving network');off();assert.equal(scene.eventBus.count(CombatEvents.STATUS_APPLIED),0);assert.equal(scene.eventBus.count(CombatEvents.STATUS_STACK_CHANGED),0);
}
{
  const scene=fakeScene();const target={x:100,y:100,hp:1000,active:true};scene.enemies=[target];const system={scene,passiveState:{},passiveUpdaters:[],getLevel:()=>6,getData:id=>id==='poison_king'?SKILLS.poison_king.levels[5]:SKILLS.poison_cloud.levels[5]};const off=SKILL_HANDLERS.poison_king.bind(system);scene.now=500;system.passiveUpdaters.forEach(update=>update());assert.equal(1000-target.hp,58,'level 6 bite damage is exactly 58');const king=system.passiveState.poisonKing._debug();for(let i=0;i<100;i++)system.passiveUpdaters.forEach(update=>update());assert(Math.abs(king.view.x-(target.x-34))<1,'king uses attackable close x offset');assert(Math.abs(king.view.y-(target.y-24))<1,'king uses attackable close y offset');off();
}
{
  const scene=fakeScene();const system={scene,passiveState:{},passiveUpdaters:[],getLevel:()=>9,getData:id=>id==='poison_king'?SKILLS.poison_king.levels[8]:SKILLS.poison_cloud.levels[8]};const off=SKILL_HANDLERS.poison_king.bind(system);system.passiveUpdaters.forEach(update=>update());const api=system.passiveState.poisonKing;assert(api?.isAlive(),'poison king spawns alive');const domain={destroyed:false,destroy(){this.destroyed=true;}};api._debug().domain=domain;api.takeDamage(api.getHp(),'test');assert.equal(system.passiveState.poisonKing,null,'poison king dies at zero hp');assert(domain.destroyed,'domain is destroyed on death');scene.now=SKILLS.poison_king.levels[8].reviveMs+1;system.passiveUpdaters.forEach(update=>update());assert(system.passiveState.poisonKing?.isAlive(),'poison king revives');const revived=system.passiveState.poisonKing._debug();for(let i=0;i<100;i++)scene.eventBus.emit(CombatEvents.STATUS_TICK,{type:StatusEffects.POISON,actualDamage:100,effect:{poisonMeta:{normal:true}}});assert.equal(revived.stage,SKILLS.poison_king.levels[8].maxStage,'poison king growth cap applies');off();
}
{
  const scene=fakeScene();scene.player={x:0,y:100};scene.playerData.hp=100;scene.playerData.maxHp=100;const kingState={hp:100,x:70,y:100};scene.skillSystem={passiveState:{poisonKing:{isAlive:()=>kingState.hp>0,getPosition:()=>({x:kingState.x,y:kingState.y}),takeDamage:damage=>{const actual=Math.min(kingState.hp,damage);kingState.hp-=actual;return actual;}}},beforePlayerDamage(){},beforePlayerHpDamage(){}};scene.eventBus=eventBus();scene.floatText=()=>{};const combat=new CombatSystem(scene);scene.combatSystem=combat;const enemy={x:100,y:100,hp:20,maxHp:20,active:true,attackRange:64,attackIntervalMs:1000,nextAttackAt:0,damage:5};const selected=combat.chooseEnemyAttackTarget(enemy,enemy.attackRange,{requireInRange:true});assert.equal(selected.type,'poisonKing','normal enemy selects nearby king');combat.updateEnemyAttack(enemy,0);assert.equal(kingState.hp,95,'normal attack damages king');kingState.x=20;combat.damageAttackTargetsInArea(enemy,10,100,20,4,{source:'testArea',dodgeable:false});assert.equal(kingState.hp,91,'area damages king near center');assert.equal(scene.playerData.hp,96,'area damages player near center');
}
{
  const scene=fakeScene();scene.player={x:0,y:100};scene.playerData.hp=100;scene.playerData.maxHp=100;const kingState={hp:100,x:100,y:92};scene.skillSystem={passiveState:{poisonKing:{isAlive:()=>kingState.hp>0,getPosition:()=>({x:kingState.x,y:kingState.y}),takeDamage:damage=>{const actual=Math.min(kingState.hp,damage);kingState.hp-=actual;return actual;}}},beforePlayerDamage(){},beforePlayerHpDamage(){}};scene.eventBus=eventBus();scene.floatText=()=>{};const combat=new CombatSystem(scene);scene.combatSystem=combat;const bomber={x:200,y:100,hp:20,maxHp:20,active:true,isDefeated:false,behavior:'bomber',attackRange:480,preferredRange:360,attackIntervalMs:1000,bombWarningMs:10,bombDamage:7,speed:0,body:{setVelocityX(){},velocity:{x:0}}};scene.enemies=[bomber];const manager=new EnemyBehaviorManager(scene);manager.attach(bomber);const kingTarget=combat.getAttackableTargets(bomber).find(target=>target.type==='poisonKing');manager.items.get(bomber).drop(0,kingTarget);manager.items.get(bomber).update(20);assert.equal(kingState.hp,93,'bomb at king position damages king');assert.equal(scene.playerData.hp,100,'player outside bomb stays unharmed');const healer={x:50,y:100,hp:20,maxHp:20,active:true,isDefeated:false,behavior:'healer',attackRange:480,attackIntervalMs:1,damage:10,speed:0,body:{setVelocityX(){},velocity:{x:0}}};scene.enemies=[healer];manager.attach(healer);manager.items.get(healer).update(100);assert.equal(kingState.hp,93,'healer fallback never attacks king');assert(scene.playerData.hp<100,'healer fallback attacks player');
}
console.log('validate-01053-poison-summon-rework: ok');
