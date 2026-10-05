import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import HellEnvoyBehavior,{ HellSummonBehavior } from '../src/enemies/behaviors/HellEnvoyBehavior.js';
import WarDrumPriestBehavior from '../src/enemies/behaviors/WarDrumPriestBehavior.js';
import ArtifactSystem from '../src/systems/ArtifactSystem.js';
import StageSystem,{ FLOW_GROUPS } from '../src/systems/StageSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { ENEMIES, NORMAL_ENEMY_PROFILES, HELL_ENVOY_TUNING as HELL } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen,shiftEnemyColdTimers } from '../src/systems/EnemyColdControl.js';

const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',{
  HellEnvoyBehavior,HellSummonBehavior,WarDrumPriestBehavior,
  ShieldGuardBehavior:class {},MeatBehavior:class {},
  Phaser:{Math:{Between:()=>0}},getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,isEnemyFrozen,updateGravityPull,shiftEnemyColdTimers
});

function fixture(level=1,cap=BALANCE.enemyPopulation.hardCap) {
  const graphics=[],events=[],awards=[],listeners=new Map();
  function node(x=0,y=0,w=0,h=0) {
    const n={x,y,width:w,height:h,active:true,destroy(){this.active=false;}};
    for(const name of ['setStrokeStyle','setDepth','setOrigin','setPosition','setVisible','setAlpha','setText','add','setFillStyle','setDisplaySize'])n[name]=()=>n;
    n.body={velocity:{x:0},enable:true,setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){},
      setVelocityX(v){this.velocity.x=v;},reset(x,y){n.x=x;n.y=y;}};
    return n;
  }
  const s={runMode:'normal',runState:'RUNNING',now:0,getGameplayTime(){return this.now;},enemies:[],killCount:0,
    balance:{...BALANCE,enemyPopulation:{...BALANCE.enemyPopulation,hardCap:cap}},player:node(200,BALANCE.groundTopY-45),
    playerData:{hp:50,maxHp:100,gold:0,artifacts:[{id:'blood_jade'}],skills:[]},physics:{add:{existing(){}}},
    hud:{update(){}},floatText(){},statusEffects:{clearTarget(){},absorbShield(damage){return {absorbed:0,remainingDamage:damage};}},tweens:{add(p){p.onComplete?.();}},
    add:{rectangle:node,text:(x,y)=>node(x,y),container:node,graphics(){const g={destroyed:false,destroy(){this.destroyed=true;}};
      for(const name of ['setDepth','clear','lineStyle','lineBetween','strokeCircle','strokeRect'])g[name]=()=>g;graphics.push(g);return g;}},
    targeting:{valid:e=>e?.active&&!e.isDefeated,isEnemyFullyInsideViewport:()=>true,shouldRecycleEnemyLeft:()=>false,getEnemyRightRespawnX:()=>900},
    eventBus:{on(k,fn){const list=listeners.get(k)||[];list.push(fn);listeners.set(k,list);return()=>listeners.set(k,list.filter(v=>v!==fn));},
      emit(k,p){events.push({k,p});for(const fn of [...(listeners.get(k)||[])])fn(p);}},
    awardGold(amount){awards.push(amount);this.playerData.gold+=amount;},
    healPlayer(amount){const n=Math.min(amount,this.playerData.maxHp-this.playerData.hp);this.playerData.hp+=n;return n;}}
  s.combatSystem=new CombatSystem(s);s.enemyBehaviors=new Manager(s);s.stageSystem=new StageSystem(s);s.stageSystem.currentEnemyLevel=level;
  const owner=s.stageSystem.spawn('elite_hell_envoy',500),b=s.enemyBehaviors.items.get(owner);
  assert(b instanceof HellEnvoyBehavior);
  return {s,owner,b,graphics,events,awards,tick(t){s.now=t;s.enemyBehaviors.update(t);},
    kill(e){s.combatSystem.killEnemy(e,{source:'attack'});},heads(){return s.enemies.filter(e=>e.enemyId==='hell_head');},small(){return s.enemies.filter(e=>e.enemyId==='hell_small');}};
}

for(const level of [1,12,19,100]) {
  const f=fixture(level);
  for(const id of ['elite_hell_envoy','hell_head','hell_small']) {
    const e=f.s.stageSystem.tunedEnemy(id),p=NORMAL_ENEMY_PROFILES[id],offset=level-1;
    assert.equal(e.hp,Math.round(p.hp*(1+offset*p.hpGrowth)));assert.equal(e.damage,Math.round(p.damage*(1+offset*p.damageGrowth)));
    assert.equal(e.attackIntervalMs,p.attackIntervalMs);assert.equal(e.level,level);
  }
  assert.equal(f.owner.name,'地狱使');assert(f.owner.isElite&&!f.owner.isBoss);f.s.enemyBehaviors.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(HELL.first-1);assert.equal(f.heads().length,0);
  f.tick(HELL.first);assert.equal(f.b.state,'windup');assert.equal(f.owner.body.velocity.x,0);
  f.tick(HELL.first+HELL.windup-1);assert.equal(f.heads().length,0);f.tick(HELL.first+HELL.windup);
  assert.equal(f.heads().length,1);const head=f.heads()[0];assert(head.noGoldReward);assert(head.hellSummonGroup===f.b.group);
  assert(f.s.enemyBehaviors.items.get(head) instanceof HellSummonBehavior);
  f.s.combatSystem.updateEnemyAttack(f.owner,99999);assert.equal(f.s.playerData.hp,50,'no generic melee during summon');
  head.x=210;head.y=f.s.player.y;f.s.combatSystem.updateEnemyAttack(head,f.s.now);assert.equal(f.s.playerData.hp,50,'spawn waits before first hit');
  f.s.combatSystem.updateEnemyAttack(head,head.nextAttackAt);assert.equal(f.s.playerData.hp,46,'head uses actual normal melee');
  head.isKnockbackActive=true;f.s.combatSystem.updateEnemyAttack(head,99999);assert.equal(f.s.playerData.hp,46,'usual knockback prevents contact hit');
  head.isKnockbackActive=false;
  const next=f.b.nextSummon;f.tick(next);f.tick(next+HELL.windup);assert.equal(f.heads().length,2);
  f.tick(99999);assert.equal(f.b.state,'idle');assert.equal(f.heads().length,2,'per-owner head cap');
  const artifacts=new ArtifactSystem(f.s);artifacts.load();
  f.kill(head);assert.equal(f.heads().length,1);assert.equal(f.small().length,2);assert.equal(f.s.playerData.gold,0);
  assert.equal(f.s.playerData.hp,52,'real blood jade kill healing still works');
  f.kill(head);assert.equal(f.small().length,2,'same head death cannot split twice');
  f.kill(f.heads()[0]);assert.equal(f.small().length,4);f.tick(100000);assert.equal(f.heads().length,0,'reserve split capacity when small pack is full');
  for(const small of [...f.small()])f.kill(small);
  assert.equal(f.small().length,0);assert.equal(f.heads().length,0,'small demons never split');assert.equal(f.s.playerData.gold,0);
  const kills=f.events.filter(v=>v.k==='ENEMY_KILLED');assert.equal(kills.length,6);assert(kills.every(v=>v.p.canGrantGold===false));
  assert.equal(f.s.killCount,6,'normal kill accounting is retained');
  f.tick(100001);f.tick(100001+HELL.windup);assert.equal(f.heads().length,1,'room freed after clearing pack');
  artifacts.cleanup();f.s.enemyBehaviors.destroy();assert(f.graphics.every(g=>g.destroyed));
}
{
  const f=fixture(12);f.tick(0);f.tick(3200);f.tick(3850);const head=f.heads()[0];
  f.kill(f.owner);f.tick(4000);assert.equal(f.heads().length,1,'owner death does not remove survivors');assert.equal(f.s.playerData.gold,15);
  f.kill(head);assert.equal(f.small().length,2,'head still splits after owner death');assert(f.small().every(e=>e.level===12));
  const st=f.s.stageSystem;st.currentWave=2;st.waveSpawnFinished=true;st.waveState='fighting';st.updateGroup(5000);
  assert.equal(st.waveSettlementAt,null);assert.equal(st.currentWave,2,'survivors must be cleared before advancing');
  for(const small of [...f.small()])f.kill(small);assert.equal(st.activeEnemyCount(),0);assert.equal(f.s.playerData.gold,15);
  st.updateGroup(6000);assert(st.waveSettlementAt>6000);f.s.enemyBehaviors.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(3200);f.tick(3850);
  const other=f.s.stageSystem.spawn('elite_hell_envoy',550),b2=f.s.enemyBehaviors.items.get(other);
  f.tick(3851);f.tick(7051);f.tick(7701);
  const group1=f.heads().filter(e=>e.hellSummonGroup===f.b.group),group2=f.heads().filter(e=>e.hellSummonGroup===b2.group);
  assert.equal(group1.length,1);assert.equal(group2.length,1);assert.notEqual(f.b.group,b2.group,'caps are per owner');
  f.kill(group1[0]);assert.equal(f.small().length,2);assert.equal(f.heads().length,1);
  const priest=f.s.stageSystem.spawn('elite_war_drum_priest',520),drum=f.s.enemyBehaviors.items.get(priest);
  assert(drum instanceof WarDrumPriestBehavior);assert(!drum.targets().some(e=>e.kind==='summon'),'special summons are not ordinary drum targets');
  f.s.enemyBehaviors.destroy();
}
for(const control of ['knockback','freeze','gravity']) {
  const f=fixture();f.tick(0);f.tick(3200);
  if(control==='knockback')f.owner.isKnockbackActive=true;
  if(control==='freeze')f.owner.coldSources=new Map([['freeze',{expiresAt:9000,frozenUntil:9000}]]);
  if(control==='gravity'){f.s.enemyBehaviors.interruptGravityReversal(f.owner,3300);f.owner.gravityReversalState={};}
  f.tick(3300);f.tick(4000);assert.equal(f.heads().length,0);assert.equal(f.b.nextSummon,3200,'interrupted summon spends no full cooldown');
  f.owner.isKnockbackActive=false;f.owner.coldSources?.clear();delete f.owner.gravityReversalState;
  f.tick(4001);f.tick(4651);assert.equal(f.heads().length,1);const group=f.heads()[0].hellSummonGroup;
  f.s.enemyBehaviors.recycleEnemy(f.owner);assert.equal(f.owner.x,900);assert.equal(f.b.group,group);assert.equal(f.b.nextSummon,null);
  f.s.enemyBehaviors.pause();f.tick(99999);assert.equal(f.b.nextSummon,null);f.s.enemyBehaviors.resume();
  f.s.enemyBehaviors.destroy();assert(f.graphics.every(g=>g.destroyed));assert.equal(f.heads()[0].hellSummonGroup,undefined);
}
{
  const f=fixture();f.tick(0);f.b.shiftTimers(1000,100);f.tick(3200);assert.equal(f.b.state,'idle');
  f.tick(4200);f.b.shiftTimers(500,4300);f.tick(4850);assert.equal(f.heads().length,0);f.tick(5350);assert.equal(f.heads().length,1);
  f.s.enemyBehaviors.destroy();f.kill(f.heads()[0]);assert.equal(f.small().length,0,'teardown does not split');
}
{
  const f=fixture(1,2);f.tick(0);f.tick(3200);f.tick(3850);assert.equal(f.heads().length,1);
  f.kill(f.heads()[0]);assert.equal(f.small().length,1,'global population cap wins over split count');assert.equal(f.s.stageSystem.activeEnemyCount(),2);
  f.s.enemyBehaviors.destroy();
}
for(const removal of ['bossCleanup','endRun','statusCallback']) {
  const f=fixture();f.tick(0);f.tick(3200);f.tick(3850);const head=f.heads()[0];
  if(removal==='bossCleanup')f.s.stageSystem.clearBossMinions();
  else if(removal==='endRun'){f.s.runState='DEFEAT';f.kill(head);}
  else {f.s.statusEffects.clearTarget=()=>{f.s.runState='DEFEAT';f.s.enemyBehaviors.destroy();};f.kill(head);}
  assert.equal(f.small().length,0,'no splitting during '+removal);f.s.enemyBehaviors.destroy();assert(f.graphics.every(g=>g.destroyed));
}

const scene={runMode:'normal'},stage=new StageSystem(scene),catalog=JSON.stringify(FLOW_GROUPS);
const newIds=['elite_hell_envoy','elite_thunder_mage','elite_berserker','elite_war_drum_priest','elite_sharpshooter','elite_gambler'];
let first=null;
for(const group of FLOW_GROUPS)for(let wave=0;wave<4;wave++) {
  stage.currentGroup=group.group;stage.currentWave=wave+1;scene.runMode='normal';
  const normal=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);scene.runMode='test';
  const legacy=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);
  const expected=wave===1&&group.group>=12&&group.group%3===0?1:0;
  assert.equal(normal.filter(e=>e.id==='elite_hell_envoy').length,expected);
  assert.deepEqual(normal.map(e=>newIds.includes(e.id)?'elite':e.id).sort(),legacy.map(e=>e.id).sort());
  assert.equal(normal.length,group.waves[wave]);assert(!legacy.some(e=>newIds.includes(e.id)));
  if(expected){first??=`${group.group}-${wave+1}`;assert.equal(normal.find(e=>e.id==='elite_hell_envoy').role,'back');}
}
assert.equal(first,'12-2');assert.equal(JSON.stringify(FLOW_GROUPS),catalog);
{
  const f=fixture();f.s.stageSystem.groupIndex=11;f.s.stageSystem.currentWave=1;
  f.s.hud.setStage=()=>{};f.s.stageSystem.queueGroupWave(0);assert.equal(f.s.stageSystem.waveQueue.filter(e=>e.id==='elite_hell_envoy').length,1);
  f.s.enemyBehaviors.destroy();f.s.runMode='test';const e=f.s.stageSystem.spawn('grunt',500);assert.equal(e.name,'训练傀儡');assert.equal(e.noGoldReward,undefined);
  f.kill(e);assert.equal(f.s.playerData.gold,1,'test-mode kill rewards stay intact');f.s.enemyBehaviors.destroy();
}
console.log('PASS hell envoy actual spawn/growth/rotation, summon windup/control/timers, independent caps, delayed melee, actual death/split, no repeat/small split, zero gold with normal artifact kill effects, owner-dead survivors blocking wave, population bounds, recycling and scene/death cleanup');
