import assert from 'node:assert/strict';
import ForeseerBehavior,{ForeseerOrbBehavior} from '../src/enemies/behaviors/ForeseerBehavior.js';
import MovementSystem from '../src/systems/MovementSystem.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import { SKILLS } from '../src/config/skills.js';
import { isForeseerBound } from '../src/systems/ForeseerBindingControl.js';
import { SpiritWolvesSkill } from '../src/skills/handlers/SpiritWolvesSkill.js';
import { SpiritBirdSkill } from '../src/skills/handlers/SpiritBirdSkill.js';
import { MantraHeavenlyBookSkill,chooseMantraMode } from '../src/skills/handlers/MantraHeavenlyBookSkill.js';
import fs from 'node:fs';
import vm from 'node:vm';
import UncrownedKingBehavior from '../src/enemies/behaviors/UncrownedKingBehavior.js';
import StatusEffectSystem,{StatusEffects} from '../src/systems/StatusEffectSystem.js';
import ThornlessRoseBehavior from '../src/enemies/behaviors/ThornlessRoseBehavior.js';
import MountainGeneralBehavior from '../src/enemies/behaviors/MountainGeneralBehavior.js';
import CombatSystem,{ isBossUsingSkill, isUncrownedShadowActive, NORMAL_ATTACK_KNOCKBACK_DURATION_MS } from '../src/systems/CombatSystem.js';
import StageSystem,{ LevelFlowStates as F } from '../src/systems/StageSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import { FORESEER_TUNING as K } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { ENEMY_UI_LAYOUT } from '../src/ui/EnemyStatusIndicators.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen,shiftEnemyColdTimers,applyEnemyCold } from '../src/systems/EnemyColdControl.js';

// Run the actual manager with Phaser's rendering import replaced by a minimal node shim.
const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ')
  .replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const imports={ ForeseerBehavior,ForeseerOrbBehavior,UncrownedKingBehavior,ThornlessRoseBehavior,MountainGeneralBehavior,getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,
  updateGravityPull,isEnemyFrozen,shiftEnemyColdTimers,Phaser:{Math:{Between:()=>0}} };
for(const name of ['MeatBehavior','DoctorBehavior','MasterBehavior','ShieldGuardBehavior','SharpshooterBehavior',
  'WarDrumPriestBehavior','EliteBerserkerBehavior','ThunderMageBehavior','HellEnvoyBehavior','HellSummonBehavior',
  'GamblerBehavior','GoldenHallGuardBehavior'])imports[name]=class {};
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',imports);

function node(x=0,y=0,w=0,h=0) {
  const n={x,y,width:w,height:h,active:true,alpha:1,circles:[],lines:[],
    destroy(){this.active=false;this.destroyed=true;},setX(x){this.x=x;return this;},
    setPosition(x,y){this.x=x;this.y=y;return this;},setText(text){this.text=text;return this;},
    setAlpha(alpha){this.alpha=alpha;return this;},setFillStyle(color){this.color=color;return this;},add(){return this;},
    clear(){this.circles=[];this.lines=[];return this;},strokeCircle(x,y,r){this.circles.push({x,y,r});return this;},
    lineStyle(width,color,alpha){this.lineWidth=width;this.lineColor=color;this.lineAlpha=alpha;return this;},
    lineBetween(x1,y1,x2,y2){this.lines.push({x1,y1,x2,y2,width:this.lineWidth,color:this.lineColor});return this;}};
  for(const key of ['setStrokeStyle','setDepth','setOrigin','setVisible','setScale','setDisplaySize',
    'strokeRect'])n[key]=()=>n;
  n.body={velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){n.x=x;n.y=y;},
    setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}};
  return n;
}
function fixture(mode='normal',boss=false) {
  const graphics=[],tweens=[],hits=[],events=[],heals=[];
  const s={runMode:mode,now:0,paused:false,balance:BALANCE,enemies:[],killCount:0,player:node(350,400,50,80),
    playerData:{hp:500,maxHp:500,baseMaxHp:500,baseAttack:20,baseDefense:0},
    cameras:{main:{worldView:{x:0,width:720},width:720,scrollX:0}},
    getGameplayTime(){return this.now;},isGameplayPaused(){return this.paused;},
    hud:{update(){},setStatus(text){s.status=text;}},floatText(x,y,text){if(text.startsWith('+'))heals.push(text);},
    finishRun(){s.paused=true;s.enemyBehaviors.destroy();},physics:{add:{existing(){}}},events:{on(){},once(){},off(){}},
    eventBus:{emit(type,meta){events.push({type,meta});}},
    add:{rectangle:node,text:(x,y)=>node(x,y),container:node,circle:node,ellipse:node,
      graphics:()=>{const g=node();graphics.push(g);return g;}},
    tweens:{add(config){const item={config,stopped:false,stop(){this.stopped=true;},remove(){},pause(){},resume(){}};tweens.push(item);return item;}}};
  s.targeting=new TargetingSystem(s);s.combatSystem=new CombatSystem(s);
  const damage=s.combatSystem.damageAttackTarget.bind(s.combatSystem);
  s.combatSystem.damageAttackTarget=(target,amount,meta)=>{
    const result=damage(target,amount,meta);hits.push({target,amount,meta,result,t:s.now});return result;
  };
  s.enemyBehaviors=new Manager(s);
  const stage=new StageSystem(s);s.stageSystem=stage;stage.currentEnemyLevel=13;
  if(boss){stage.activeRush='boss4';stage.spawnBoss('boss4');}
  else stage.spawn('foreseer',500);
  const e=s.enemies[0];e.x=500;e.y=400;e.scene=s;
  const b=s.enemyBehaviors.items.get(e);
  return {s,e,b,stage,graphics,tweens,hits,events,heals,tick(t){s.now=t;s.enemyBehaviors.update(t);stage.updateBossKnockbackCounterattacks(t);},
    destroy(){s.skillSystem?.reset?.();s.statusEffects?.reset?.();s.combatSystem.clearAllKnockbacks();s.enemyBehaviors.destroy();}};
}
const sources=f=>f.hits.map(h=>h.meta.source);
const isolate=(f,skill)=>{for(const name of ['Bind','Split','Teleport'])if(name.toLowerCase()!==skill)f.b['next'+name]=Infinity;};
const begin=(f,skill)=>{isolate(f,skill);f.tick(K[skill+'First']);assert.equal(f.b.state,skill+'Windup');};
const release=(f,skill)=>{begin(f,skill);f.tick(K[skill+'First']+K[skill+'Windup']);};
const wolf=(x=350,y=400)=>({type:'spiritWolf',x,y,hp:100,active:true,view:node(x,y),hpBarBg:node(x,y-50),hpBar:node(x-20,y-50),
  isAlive(){return this.active&&this.hp>0;},takeDamage(n){this.hp=Math.max(0,this.hp-n);}});
const addWolves=(f,wolves)=>{f.s.skillSystem={beforePlayerDamage(){},beforePlayerHpDamage(){},passiveState:{spiritWolves:{wolves}}};};

function realSkills(f) {
  const s=f.s,listeners=new Map(),sceneListeners=new Map();
  s.eventBus.on=(type,fn)=>{const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);return ()=>set.delete(fn);};
  s.eventBus.emit=(type,meta)=>{f.events.push({type,meta});for(const fn of [...(listeners.get(type)||[])])fn(meta);};
  s.events.on=(type,fn)=>{const set=sceneListeners.get(type)||new Set();set.add(fn);sceneListeners.set(type,set);};
  s.events.off=(type,fn)=>sceneListeners.get(type)?.delete(fn);s.events.emit=type=>{for(const fn of [...(sceneListeners.get(type)||[])])fn();};
  Object.assign(s.playerData,{skills:[],mana:500,maxMana:500,skillDamageMultiplier:1,weaponId:'blade'});
  s.statusEffects=new StatusEffectSystem(s);s.artifactSystem={level:()=>0,highHpDamageMultiplier:()=>1};
  s.healPlayer=n=>{const hp=s.playerData.hp;s.playerData.hp=Math.min(s.playerData.maxHp,hp+n);return s.playerData.hp-hp;};
  s.skillSystem=new SkillSystem(s);s.movementSystem=new MovementSystem(s);return s.skillSystem;
}
const addSkill=(sys,id,level=1)=>{sys.scene.playerData.skills.push({id,level});sys.ensurePassiveBound(id);return sys.getData(id);};

// Real Boss4 spawn replaces no other Boss or test-mode override; first Lv13 stats and reward identity are preserved.
for(const mode of ['normal','test']) {
  const f=fixture(mode,true),e=f.e;
  assert.equal(e.enemyId,mode==='normal'?'foreseer':'abyss_devourer');
  assert.equal(e.name,mode==='normal'?'预事者':'深渊吞噬者');assert.equal(e.hp,5612);assert.equal(e.damage,28);
  assert.equal(e.attackIntervalMs,mode==='normal'?2600:1180);assert.equal(e.flowBossType,'boss4');
  assert(!e.isMidBoss&&!e.isFinalBoss);assert.equal(f.b instanceof ForeseerBehavior,mode==='normal');
  assert.equal(f.stage.flowState,F.BOSS_FIGHT);assert.match(f.s.status,mode==='normal'?/预事者/:/深渊吞噬者/);
  assert.equal(f.events.find(v=>v.meta?.kind==='boss').meta.bossId,mode==='normal'?'foreseer':'berserker_boss');
  assert.equal(f.events.find(v=>v.type===CombatEvents.BOSS_SPAWNED).meta.enemy,e);
  let reward;f.s.queueArtifactReward=value=>{reward=value;};f.stage.onBossKilled('boss4');
  assert.match(reward.name,mode==='normal'?/预事者/:/深渊吞噬者/);f.destroy();
}
{
  const f=fixture();
  for(const level of [1,13,19,100]) {
    f.stage.currentEnemyLevel=level;const e=f.stage.tunedEnemy('foreseer');
    assert.equal(e.hp,Math.round(2300*(1+(level-1)*.12)));assert.equal(e.damage,Math.round(19*(1+(level-1)*.04)));
    assert.equal(e.attackIntervalMs,2600);assert.equal(e.speed,286);assert.equal(e.preferredRange,380);
  }
  f.destroy();
}
{
  const f=fixture();f.tick(0);assert.equal(f.b.state,'attackWindup');assert(!isBossUsingSkill(f.e));
  assert(f.graphics[0].lines.some(l=>l.width===2));f.tick(349);assert.equal(f.hits.length,0);
  f.tick(350);assert.equal(f.s.playerData.hp,472);assert.deepEqual(sources(f),['foreseerBeam']);
  assert.equal(f.b.nextAttack,2950);f.tick(350);assert.equal(f.hits.length,1);
  f.e.hp=100;f.s.combatSystem.updateEnemyAttack(f.e,2000);assert.equal(f.hits.length,1);assert(!f.e.enraged);f.destroy();
}
for(const replacement of [false,true]) {
  const f=fixture();f.tick(0);f.s.playerData.hp=0;const w=wolf(390);if(replacement)addWolves(f,[w]);
  f.tick(350);assert.equal(f.hits.length,replacement?1:0);assert.equal(f.b.nextAttack,replacement?2950:0);
  if(replacement)assert.equal(f.hits[0].target,w);f.destroy();
}
{
  const f=fixture();f.tick(0);f.s.player.x=350;f.s.player.y=500;f.tick(350);
  assert.equal(f.hits.length,0,'ray stays on its telegraphed direction instead of following the target');assert.equal(f.b.nextAttack,0);f.destroy();
}
for(const skill of ['bind','split','teleport']) {
  const f=fixture();isolate(f,skill);f.s.playerData.hp=0;f.tick(99999);
  assert.equal(f.b['next'+skill[0].toUpperCase()+skill.slice(1)],K[skill+'First']);assert(!isBossUsingSkill(f.e));f.destroy();
}
for(const skill of ['bind','split','teleport']) {
  const f=fixture();isolate(f,skill);f.tick(0);assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  f.tick(K[skill+'First']);assert.equal(f.b.state,skill+'Windup');assert(!f.e.isKnockbackActive);
  assert(!f.s.combatSystem.applyKnockback(f.e,{knockback:72}));const hp=f.e.hp;
  assert(f.s.combatSystem.damageEnemy(f.e,20,{source:'skill'}));assert.equal(f.e.hp,hp-20,'skill windup is not damage immunity');
  f.tick(K[skill+'First']+K[skill+'Windup']);
  assert.equal(f.b['next'+skill[0].toUpperCase()+skill.slice(1)],K[skill+'First']+K[skill+'Windup']+K[skill+'Cooldown']);
  for(const name of ['Bind','Split','Teleport'])if(name.toLowerCase()!==skill)assert.equal(f.b['next'+name],Infinity);f.destroy();
}
// Binding is attached to a stable runtime entity; expiry is observed before the behavior manager's next update.
{
  const f=fixture();realSkills(f);release(f,'bind');assert.equal(f.s.playerData.hp,490);
  assert(isForeseerBound(f.s.player,3500));assert.equal(f.s.player.foreseerBinding.endAt,5300);
  f.e.x=650;f.s.movementSystem.update();assert.equal(f.s.player.body.velocity.x,0);
  f.s.now=5300;assert(!isForeseerBound(f.s.player,5300));f.s.movementSystem.update();assert(f.s.player.body.velocity.x>0);
  f.tick(5300);assert.equal(f.s.player.foreseerBinding,undefined);f.destroy();
}
{
  const f=fixture();const sys=realSkills(f);release(f,'bind');f.tick(3680);
  f.e.x=f.s.player.x+30;const hp=f.e.hp;
  f.s.combatSystem.update(4000);assert(f.e.hp<hp,'rooted player still performs real normal attacks');
  assert(isForeseerBound(f.s.player,4000));f.s.now=4000;addSkill(sys,'fireball');
  sys.update(4000);assert(f.events.some(v=>v.type===CombatEvents.SKILL_CAST_COMPLETED&&v.meta.skillId==='fireball'),'rooted player still completes an independently owned skill');
  f.destroy();
}
for(const fail of ['dead','range']) {
  const f=fixture();begin(f,'bind');if(fail==='dead')f.s.playerData.hp=0;else f.s.player.x=-100;
  f.tick(3500);assert.equal(f.hits.length,0);assert.equal(f.b.nextBind,3000);assert.equal(f.b.bindTarget,null);f.destroy();
}
{
  const f=fixture(),random=Math.random;f.s.playerData.dodgeChance=.95;
  try {Math.random=()=>0;release(f,'bind');} finally {Math.random=random;}
  assert.equal(f.s.playerData.hp,500);assert.equal(f.s.player.foreseerBinding,undefined);assert.equal(f.b.nextBind,10500);f.destroy();
}
// Actual wolf movement is blocked, not melee actions; actual bird follow is blocked, not healing.
{
  const f=fixture();const sys=realSkills(f);addSkill(sys,'spirit_wolves');
  SpiritWolvesSkill.cast(sys,SKILLS.spirit_wolves,sys.getData('spirit_wolves'),1);
  const w=sys.passiveState.spiritWolves.wolves[0];w.x=390;w.y=400;f.s.player.x=100;release(f,'bind');
  assert(isForeseerBound(w,3500));const x=w.x,y=w.y;
  f.s.now=4000;sys.passiveUpdaters.forEach(fn=>fn());assert.equal(w.x,x);assert.equal(w.y,y);
  f.e.x=w.x+30;const hp=f.e.hp;f.s.now=4300;sys.passiveUpdaters.forEach(fn=>fn());assert(f.e.hp<hp,'bound wolf still attacks in range');
  f.e.x=650;f.s.now=5300;sys.passiveUpdaters.forEach(fn=>fn());assert(w.x>x,'wolf resumes movement at exact expiry');f.destroy();
}
{
  const f=fixture();const sys=realSkills(f);addSkill(sys,'spirit_bird');
  SpiritBirdSkill.cast(sys,SKILLS.spirit_bird,sys.getData('spirit_bird'),1);
  const bird=f.s.spiritBirdRuntime.getAttackTarget();bird.x=390;bird.y=400;f.s.player.x=100;release(f,'bind');
  assert(isForeseerBound(bird,3500));f.s.player.x=600;f.s.now=4000;f.s.events.emit('postupdate');assert.equal(bird.x,390);
  f.s.playerData.hp=300;bird.nextHealAt=4000;sys.passiveUpdaters.forEach(fn=>fn());assert(f.s.playerData.hp>300,'bound bird still heals');
  f.s.now=5300;f.s.events.emit('postupdate');assert(bird.x>390);f.destroy();
}
{
  const f=fixture();const sys=realSkills(f);addSkill(sys,'poison_king');
  sys.passiveUpdaters.forEach(fn=>fn());const king=f.s.poisonKingRuntime.get();assert(king);
  king.view.x=390;king.view.y=400;f.s.player.x=100;release(f,'bind');assert(isForeseerBound(king,3500));
  f.s.now=4000;sys.passiveUpdaters.forEach(fn=>fn());assert.equal(king.view.x,390);assert.equal(king.view.y,400);
  f.e.x=420;const hp=f.e.hp;king.nextBiteAt=4100;f.s.now=4100;sys.passiveUpdaters.forEach(fn=>fn());assert(f.e.hp<hp,'bound poison king still bites');
  f.s.poisonKingRuntime.forceDamage(99999);assert.equal(f.s.poisonKingRuntime.get(),null);
  f.s.now=9000;sys.passiveUpdaters.forEach(fn=>fn());const next=f.s.poisonKingRuntime.get();assert(next&&next!==king);
  assert.equal(next.foreseerBinding,undefined);f.tick(9000);assert.equal(king.foreseerBinding,undefined);f.destroy();
}
{
  const f=fixture();const sys=realSkills(f);f.s.player.x=100;
  sys.scene.playerData.skills.push({id:'mantra_heavenly_book',level:6});chooseMantraMode(f.s,'absorb');
  const original=f.stage.spawn('grunt',300);original.y=400;
  const cfg=SKILLS.mantra_heavenly_book,ctx=sys.createCastContext(cfg.id,cfg,{manaCost:0,effectiveManaCost:0});
  MantraHeavenlyBookSkill.cast(sys,cfg,cfg.levels[5],6,ctx);f.s.now=3000;sys.updateActive(3000);
  const ally=sys.passiveState.mantraHeavenlyBook.absorb.ally;assert(ally);f.e.x=ally.x+40;release(f,'bind');
  assert(isForeseerBound(ally,3500));const x=ally.x,y=ally.y,hp=f.e.hp;
  f.s.player.x=500;f.s.now=4000;sys.updateActive(4000);assert.equal(ally.x,x);assert.equal(ally.y,y);assert(f.e.hp<hp,'bound refined ally still attacks');
  f.s.now=5300;sys.updateActive(5300);assert(ally.x>x);f.destroy();
}
// Split produces two separately killable, capped, warned-beam minions. Expiry is not a combat kill/reward.
{
  const f=fixture();release(f,'split');const orbs=f.b.orbs();assert.equal(orbs.length,2);
  assert(orbs.every(o=>f.s.enemyBehaviors.items.get(o) instanceof ForeseerOrbBehavior&&o.noGoldReward));
  assert(orbs.every(o=>o.foreseerExpiresAt===15150&&o.hp===93&&o.damage===10));
  f.b.nextSplit=6651;f.tick(6651);assert.notEqual(f.b.state,'splitWindup');assert.equal(f.b.nextSplit,6651,'full cap does not spend skill clock');
  const first=orbs[0],other=orbs[1];let gold=0;f.s.awardGold=n=>gold+=n;
  f.s.combatSystem.damageEnemy(first,9999,{source:'skill'});assert(first.isDefeated);assert.equal(gold,0);
  assert.equal(other.hp,93);assert.equal(f.b.orbs().length,1);f.tick(7000);assert.notEqual(f.b.state,'splitWindup','one free slot cannot create an extra pair');
  f.s.now=15150;const kills=f.events.filter(v=>v.type===CombatEvents.ENEMY_KILLED).length;
  f.s.enemyBehaviors.items.get(other).advanceEffects(15150);assert(other.isDefeated);assert.equal(f.b.orbs().length,0);
  assert.equal(f.events.filter(v=>v.type===CombatEvents.ENEMY_KILLED).length,kills);f.destroy();
}
{
  const f=fixture();release(f,'split');const orb=f.b.orbs()[0],b=f.s.enemyBehaviors.items.get(orb);
  f.e.nextAttackAt=Infinity;f.b.nextAttack=Infinity;f.s.player.x=350;f.s.player.y=orb.y;
  f.s.now=7250;b.update(7250);assert.equal(b.state,'attackWindup');assert.equal(f.hits.length,0);
  f.s.now=7600;b.update(7600);assert.equal(f.s.playerData.hp,490);assert.equal(f.hits[0].meta.source,'foreseerOrbBeam');
  b.update(7600);assert.equal(f.hits.length,1);f.destroy();
}
{
  const f=fixture();isolate(f,'split');f.s.balance={...BALANCE,enemyPopulation:{...BALANCE.enemyPopulation,hardCap:2}};
  f.tick(6000);assert.notEqual(f.b.state,'splitWindup');assert.equal(f.b.nextSplit,6000);f.destroy();
}
// Teleport stays fully visible on the right, ahead of the player, changes position only and has no damage immunity.
{
  const f=fixture();begin(f,'teleport');assert.equal(f.e.x,500);const hp=f.e.hp;
  assert(f.s.combatSystem.damageEnemy(f.e,20,{source:'skill'}));f.tick(9400);assert.equal(f.e.x,676);
  assert.equal(f.e.hp,hp-20);assert.equal(f.e.alpha,1);assert(f.e.x>f.s.player.x+100);
  assert(f.s.targeting.isEnemyFullyInsideViewport(f.e));assert.equal(f.b.state,'teleportRelease');assert.equal(f.b.nextTeleport,19400);
  f.tick(9580);assert.equal(f.b.state,'recovery');assert(!isBossUsingSkill(f.e));
  const until=f.b.until,clock=f.b.nextTeleport;assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  f.tick(until-1);assert.equal(f.b.until,until);assert.equal(f.b.nextTeleport,clock);f.destroy();
}
{
  const f=fixture();isolate(f,'teleport');f.s.player.x=660;f.tick(9000);assert.notEqual(f.b.state,'teleportWindup');assert.equal(f.b.nextTeleport,9000);f.destroy();
}
{
  const f=fixture();begin(f,'teleport');f.s.player.x=660;f.tick(9400);assert.equal(f.e.x,500);assert.equal(f.b.nextTeleport,9000);f.destroy();
}
// Real cleanup/recycle/pause/timer routes never renew a binding or minion lifetime.
{
  const f=fixture();release(f,'bind');const binding=f.s.player.foreseerBinding;f.b.shiftTimers(1000,3500);
  assert.equal(binding.endAt,6300);assert.equal(f.b.nextBind,11500);
  f.s.now=4000;f.s.enemyBehaviors.recycleEnemy(f.e);assert.equal(f.e.x,852);assert.equal(binding.endAt,6300);
  f.tick(6300);assert.equal(f.s.player.foreseerBinding,undefined);f.destroy();
}
{
  const f=fixture();release(f,'split');const orb=f.b.orbs()[0],b=f.s.enemyBehaviors.items.get(orb);
  f.s.now=7000;f.s.enemyBehaviors.recycleEnemy(f.e);assert.equal(orb.foreseerExpiresAt,15150);
  f.s.enemyBehaviors.shiftTimers(1000,7000);assert.equal(orb.foreseerExpiresAt,16150,'shift once via each minion, not twice via its owner');
  orb.x=-50;f.s.enemyBehaviors.update(16150);assert(orb.isDefeated);assert(!f.s.enemies.includes(orb));f.destroy();
}
for(const phase of ['attackWindup','bindWindup','bindRelease','splitWindup','splitRelease','teleportWindup','teleportRelease','recovery']) {
  const f=fixture();if(phase==='attackWindup')f.tick(0);
  else if(phase.endsWith('Windup'))begin(f,phase.replace('Windup',''));
  else {release(f,phase==='recovery'?'teleport':phase.replace('Release',''));if(phase==='recovery')f.tick(9580);}
  assert.equal(f.b.state,phase);const now=f.s.now,count=f.hits.length,clocks=[f.b.nextBind,f.b.nextSplit,f.b.nextTeleport];
  f.s.paused=true;f.s.enemyBehaviors.pause();f.tick(99999);assert.equal(f.hits.length,count);
  f.s.now=now;f.s.paused=false;f.s.enemyBehaviors.resume();f.s.enemyBehaviors.recycleEnemy(f.e);
  assert.deepEqual([f.b.nextBind,f.b.nextSplit,f.b.nextTeleport],clocks);
  f.s.combatSystem.killEnemy(f.e);assert.equal(f.b.graphics,null);assert.equal(f.b.bindings.length,0);
  assert.equal(f.s.player.foreseerBinding,undefined);assert.equal(f.b.orbs().length,0);assert.equal(f.s.enemyBehaviors.items.size,0);f.destroy();
}
{
  const f=fixture('normal',true);release(f,'bind');f.b.nextSplit=3501;f.tick(4280);f.tick(4930);
  let gold=0,rewards=0,campfires=0;f.s.awardGold=n=>gold+=n;
  f.s.queueArtifactReward=()=>{rewards++;f.s.paused=true;f.s.enemyBehaviors.pause();};f.s.showCampfire=()=>campfires++;
  f.s.combatSystem.damageEnemy(f.e,99999,{source:'reflect'});assert(f.e.isDefeated);
  assert.equal(f.s.player.foreseerBinding,undefined);assert.equal(f.b.orbs().length,0);assert(f.graphics.every(g=>g.destroyed));
  assert.equal(gold,0);assert.equal(rewards,1);f.s.combatSystem.killEnemy(f.e);assert.equal(rewards,1);
  f.stage.beginAfterBossReward('boss4');f.stage.beginAfterBossReward('boss4');assert.equal(campfires,1);f.destroy();
}
for(const end of ['caster','scene','target']) {
  const f=fixture();begin(f,'bind');f.s.eventBus.emit=type=>{if(type===CombatEvents.PLAYER_DAMAGED){
    if(end==='caster')f.s.combatSystem.damageEnemy(f.e,99999,{source:'reflect'});
    else if(end==='scene')f.s.finishRun();else f.s.playerData.hp=0;
  }};
  f.tick(3500);assert.equal(f.s.player.foreseerBinding,undefined);assert.equal(f.b.bindings.length,0);f.destroy();
}
{
  const f=fixture();applyEnemyCold(f.e,{now:0,stacks:4,data:{maxStacks:8,slowPerStack:.04,attackSlowPerStack:.03}});
  assert(getEnemyMoveSpeed(f.e,286,0)<286);assert(getEnemyAttackDelay(f.e,2600,0)>2600);
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));const tw=f.tweens.at(-1);
  assert.equal(tw.config.duration,150);tw.config.targets.t=1;tw.config.onComplete();assert.equal(f.e.x,558);
  f.tick(0);assert.equal(f.b.state,'attackWindup');assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));f.tick(1);
  assert.equal(f.b.state,'idle');assert.equal(f.b.beam,null);assert.equal(f.b.nextBind,3000);f.destroy();
}
console.log('PASS foreseer actual normal/test Boss4 spawn/first stats/growth/rewards, locked warned beams/empty and replacement targets, independent three-skill clocks and knockback immunity, real player/wolf/bird/poison king/refined ally movement binding without attack/spell/heal suppression, split cap/killable minions/expiry/beam/zero gold, legal right-only teleport/no damage immunity, cold/timers/pause/recycle/death/synchronous callbacks/scene cleanup');
