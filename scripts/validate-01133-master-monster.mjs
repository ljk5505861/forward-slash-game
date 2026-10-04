import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import MasterBehavior from '../src/enemies/behaviors/MasterBehavior.js';
import StageSystem from '../src/systems/StageSystem.js';
import { ENEMIES } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';

const scene={runMode:'normal'},stage=new StageSystem(scene);
for(const level of [1,5,10,19,100]){
  stage.currentEnemyLevel=level;const e=stage.tunedEnemy('charger'),offset=level-1;
  assert.equal(e.name,'大师');assert.equal(e.behavior,'charger');
  assert.equal(e.hp,Math.round(44*(1+offset*0.06)));
  assert.equal(e.damage,Math.round(7*(1+offset*0.12)));
  assert.equal(e.speed,360);assert.equal(e.attackRange,110);
  assert.equal(e.attackIntervalMs,Math.round(1500/(1+Math.min(0.15,offset*0.01))));
}
scene.runMode='test';assert.equal(stage.tunedEnemy('charger').name,'冲锋兽');
assert.equal(stage.tunedEnemy('charger').speed,ENEMIES.charger.speed);

function fixture(){
  const g={destroyed:false,destroy(){this.destroyed=true;}};
  for(const key of ['clear','setDepth','lineStyle','lineBetween'])g[key]=()=>g;
  const e={x:400,y:400,width:56,active:true,damage:7,attackRange:110,attackIntervalMs:1500,body:{setVelocityX(){}}};
  const target={x:150,y:392,live:true,isAlive(){return this.live;}};
  const hits=[],s={runMode:'normal',balance:BALANCE,add:{graphics:()=>g},getGameplayTime:()=>0,combatSystem:{getAttackableTargets:()=>[target]}};
  const h={approach(){},getEnemyAttackDelay:(_e,v)=>v,chooseAnyTarget:()=>target,
    chooseTarget:()=>Math.hypot(target.x-e.x,target.y-e.y)<=e.attackRange?target:null,
    targetDamage:(_s,victim,_e,damage,meta)=>hits.push({victim,damage,meta})};
  return {g,e,target,hits,s,h,b:new MasterBehavior(s,e,h)};
}
{
  const f=fixture();f.b.update(0);f.b.update(3499);assert.equal(f.b.state,'idle');
  f.b.update(3500);assert.equal(f.b.state,'windup');assert.equal(f.hits.length,0);
  f.b.update(3899);assert.equal(f.b.state,'windup');
  f.b.update(3900);assert.equal(f.b.state,'wave');
  f.b.update(4350);assert.equal(f.hits.length,1,'swept hit survives coarse update');
  assert.equal(f.hits[0].damage,11);assert.equal(f.hits[0].meta.knockbackDistance,0);
  assert.equal(f.hits[0].meta.source,'masterWave');assert.equal(f.b.wave,null);
  f.b.update(4400);assert.equal(f.hits.length,1,'single hit only');
  assert.equal(f.b.nextWave,9350);
}
{
  const f=fixture();f.target.x=320;f.b.update(0);assert.equal(f.hits.length,1);
  assert.equal(f.hits[0].meta.source,'masterMelee');
  f.b.update(1499);assert.equal(f.hits.length,1);f.b.update(1500);assert.equal(f.hits.length,2);
  f.b.update(3500);f.b.update(3700);assert.equal(f.hits.length,2,'no melee while casting');
}
{
  const f=fixture();f.b.update(0);f.b.update(3500);f.target.live=false;f.b.update(3900);
  assert.equal(f.hits.length,0);assert.equal(f.b.state,'idle','dead aim target cancels');
  assert.equal(f.b.nextWave,3500,'failed windup does not spend skill cooldown');
}
{
  const f=fixture();f.b.update(0);f.b.update(3500);f.b.update(3900);
  f.target.y=800;f.b.update(4350);assert.equal(f.hits.length,0,'wave follows fixed release trajectory');
}
for(const state of ['windup','wave']){
  const f=fixture();f.b.update(0);f.b.update(3500);if(state==='wave')f.b.update(3900);
  f.b.interrupt(3950);assert.equal(f.b.state,'idle');assert.equal(f.b.wave,null);
  if(state==='windup')assert.equal(f.b.nextWave,3500,'control before release preserves cooldown');
  f.b.update(4350);assert.equal(f.hits.length,0);
  f.b.onRecycle();assert.equal(f.b.nextWave,null);assert.equal(f.b.target,null);
  f.b.destroy();f.b.destroy();assert(f.g.destroyed);
}
{
  const f=fixture();f.b.update(0);f.b.update(3500);f.b.update(3900);
  f.b.shiftTimers(1000,3950);assert.equal(f.b.started,4900);
  f.b.update(4950);assert.equal(f.hits.length,0);
  f.h.targetDamage=()=>{f.hits.push(1);f.e.isDefeated=true;f.b.destroy();};
  f.b.update(5350);assert.equal(f.hits.length,1);assert.equal(f.b.graphics,null,'synchronous reflected death is safe');
}
const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8').replace(/^import .*;\n/gm,'')
  .replace(/export const /g,'const ').replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',{
  MasterBehavior,MeatBehavior:class {},DoctorBehavior:class {},ShieldGuardBehavior:class {},Phaser:{},
  getEnemyMoveSpeed:(_e,v)=>v,getEnemyAttackDelay:(_e,v)=>v,updateGravityPull:()=>false,
  isGravityReversalControlled:e=>!!e.reversed,isEnemyFrozen:e=>!!e.frozen,shiftEnemyColdTimers(){}
});
{
  const f=fixture();f.e.behavior='charger';f.s.enemies=[f.e];
  f.s.targeting={isEnemyFullyInsideViewport:()=>true,shouldRecycleEnemyLeft:()=>false};
  const manager=new Manager(f.s);manager.attach(f.e);
  assert(manager.items.get(f.e) instanceof MasterBehavior);
  const b=manager.items.get(f.e);
  for(const key of ['isKnockbackActive','frozen','reversed']){
    b.state='wave';b.from={x:380,y:392};b.to={x:-20,y:392};b.wave={x:200,y:392};f.e[key]=true;manager.update(4000);
    assert.equal(b.state,'idle');assert.equal(b.wave,null);f.e[key]=false;
  }
  manager.pause();manager.update(5000);assert.equal(f.hits.length,0);manager.resume();
  f.e.isDefeated=true;manager.update(6000);assert.equal(manager.items.size,0);assert(f.g.destroyed);
  f.s.runMode='test';f.e.isDefeated=false;manager.attach(f.e);
  assert(!(manager.items.get(f.e) instanceof MasterBehavior));manager.destroy();
}
// The real player damage path must deal damage without any position change.
const combat=fs.readFileSync('src/systems/CombatSystem.js','utf8');
const method=combat.slice(combat.indexOf('  damagePlayer('),combat.indexOf('  killEnemy('));
const Damage=vm.runInNewContext('(class {'+method+'})',{
  isDirectEnemyAttack:()=>true,getEffectiveDefense:()=>0,getEffectiveDamageReduction:()=>0,
  sumBonuses:()=>0,CombatEvents:{PLAYER_DAMAGED:'damaged',PLAYER_LOW_HP:'low'}
});
const damage=new Damage();damage.canDodge=()=>false;
damage.scene={player:{x:200,y:400,setX(){assert.fail('master cannot move player');},body:{reset(){assert.fail('master cannot reset player body');}}},
  playerData:{hp:100,maxHp:100},floatText(){},eventBus:{emit(){}},finishRun(){}};
damage.damagePlayer({x:400},11,{source:'masterWave',attackType:'projectile',knockbackDistance:0});
assert.equal(damage.scene.playerData.hp,89);assert.equal(damage.scene.player.x,200);
console.log('PASS master growth, mode isolation, melee/cast timing, single swept hit, zero knockback, miss, controls, pause, cleanup and synchronous death');
