import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import MeatBehavior from '../src/enemies/behaviors/MeatBehavior.js';
import StageSystem from '../src/systems/StageSystem.js';
import { ENEMIES } from '../src/config/enemies.js';

const scene={runMode:'normal'}, stage=new StageSystem(scene);
for(const level of [1,10,19]){
  stage.currentEnemyLevel=level;
  const meat=stage.tunedEnemy('armored_guard');
  assert.equal(meat.name,'肉怪'); assert.equal(meat.behavior,'meat');
  assert.equal(meat.hp,Math.round(128*(1+(level-1)*0.18)));
  assert.equal(meat.damage,Math.round(3*(1+(level-1)*0.03)));
  assert.equal(stage.tunedEnemy('grunt').speed,120,'warrior unchanged');
}
scene.runMode='test';
assert.equal(stage.tunedEnemy('armored_guard').behavior,ENEMIES.armored_guard.behavior);

function fixture(){
  const g={destroyed:false};
  for(const key of ['setDepth','clear','lineStyle','lineBetween','fillStyle','fillRect'])g[key]=()=>g;
  g.destroy=()=>{g.destroyed=true;};
  const e={x:400,y:400,width:90,height:116,active:true,damage:3,attackRange:112,attackIntervalMs:2400,body:{setVelocityX(){}}};
  const target={x:160,y:392,live:true,isAlive(){return this.live;}};
  const hits=[];
  const s={add:{graphics:()=>g},combatSystem:{getAttackableTargets:()=>[target]},getGameplayTime:()=>0};
  const helpers={approach(){},getEnemyAttackDelay:(_e,ms)=>ms,
    chooseAnyTarget:()=>target,chooseTarget:()=>Math.hypot(e.x-target.x,e.y-target.y)<=e.attackRange?target:null,
    targetDamage:(_s,t,_e,damage,meta)=>hits.push({t,damage,meta})};
  const b=new MeatBehavior(s,e,helpers);
  return {b,e,s,target,hits,g};
}
{
  const {b,hits}=fixture();
  b.update(0); b.update(4499); assert.equal(b.state,'idle');
  b.update(4500); assert.equal(b.state,'windup'); assert.equal(hits.length,0);
  b.update(5150); assert.equal(b.state,'outbound');
  b.update(5500); assert.equal(hits.length,1); assert.equal(b.state,'recall');
  assert.equal(hits[0].damage,6); assert.equal(hits[0].meta.knockbackDistance,36);
  b.update(5650); b.update(5850); assert.equal(hits.length,1,'recall never deals damage');
  assert.equal(b.state,'idle'); assert.equal(b.nextThrow,12350);
}
{
  const {b,target,hits}=fixture(); target.x=320;
  b.update(0); assert.equal(hits.length,1,'normal melee works');
  b.update(4500); b.update(5150); assert.equal(hits.length,1,'windup and flight do not overlap melee');
  target.live=false; b.update(5700); b.update(6050);
  assert.equal(hits.length,1,'dead target receives no projectile hit');
}
{
  const {b,target,hits}=fixture();
  b.update(0); b.update(4500); b.update(5150);
  target.y=600; b.update(5700); b.update(6050);
  assert.equal(hits.length,0,'moving away from aimed trajectory dodges the blade');
}
for(const phase of ['windup','outbound','recall']){
  const {b,hits,g}=fixture();
  b.update(0); b.update(4500);
  if(phase!=='windup')b.update(5150);
  if(phase==='recall')b.update(5500);
  const before=hits.length;
  b.interrupt(5501); assert.equal(b.state,'idle'); assert.equal(b.knife,null);
  b.update(5600); assert.equal(hits.length,before,'control interruption causes no delayed hit');
  b.onRecycle(); assert.equal(b.knife,null);
  b.destroy(); b.destroy(); assert(g.destroyed); assert.equal(b.graphics,null);
}
{
  const {b,e,hits}=fixture();
  b.h.targetDamage=()=>{hits.push(1);e.isDefeated=true;b.destroy();};
  b.update(0); b.update(4500); b.update(5150); b.update(5500);
  assert.equal(hits.length,1); assert.equal(b.graphics,null,'synchronous reflected death is safe');
}
console.log('PASS meat profile/growth/mode isolation, melee, windup, swept hit, recall, miss, interruption, recycling and synchronous death');

// Exercise the real manager attachment and its control/pause/death paths.
const managerSource=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const Manager=vm.runInNewContext(managerSource+'\nEnemyBehaviorManager',{
  MeatBehavior,Phaser:{},getEnemyMoveSpeed:(_e,v)=>v,getEnemyAttackDelay:(_e,v)=>v,
  updateGravityPull:()=>false,isGravityReversalControlled:()=>false,isEnemyFrozen:(_e)=>!!_e.frozen,shiftEnemyColdTimers(){}
});
{
  const {e,s,g}=fixture(); e.behavior='meat';
  s.enemies=[e];s.targeting={isEnemyFullyInsideViewport:()=>true,shouldRecycleEnemyLeft:()=>false};
  const manager=new Manager(s);manager.attach(e);
  const b=manager.items.get(e);assert(b instanceof MeatBehavior);
  b.state='windup';b.until=100;
  e.isKnockbackActive=true;manager.update(200);assert.equal(b.state,'idle');
  e.isKnockbackActive=false;b.state='outbound';b.knife={x:200,y:400};
  e.frozen=true;manager.update(250);assert.equal(b.knife,null);
  manager.pause();assert(manager.paused);manager.resume();assert(!manager.paused);
  e.isDefeated=true;manager.update(300);assert.equal(manager.items.size,0);assert(g.destroyed);
  manager.destroy();
}

const combatSource=fs.readFileSync('src/systems/CombatSystem.js','utf8');
const damageMethod=combatSource.slice(combatSource.indexOf('  damagePlayer('),combatSource.indexOf('  killEnemy('));
const Damage=vm.runInNewContext('(class {'+damageMethod+'})',{
  isDirectEnemyAttack:()=>true,getEffectiveDefense:()=>0,getEffectiveDamageReduction:()=>0,
  sumBonuses:()=>0,CombatEvents:{PLAYER_DAMAGED:'damaged',PLAYER_LOW_HP:'low'}
});
{
  const combat=new Damage();combat.canDodge=()=>false;
  const p={x:200,y:400,width:40,setX(x){this.x=x;},body:{width:40,reset(x){p.x=x;}}};
  combat.scene={player:p,playerData:{hp:100,maxHp:100},balance:{stageWorldWidth:1000},floatText(){},eventBus:{emit(){}},finishRun(){}};
  combat.damagePlayer({x:400},6,{source:'meatKnife',knockbackDistance:36});
  assert.equal(p.x,164);assert.equal(combat.scene.playerData.hp,94);
  combat.damagePlayer({x:400},6,{source:'archerArrow',knockbackDistance:12});
  assert.equal(p.x,164,'existing arrows do not gain player knockback');
  p.x=35;combat.damagePlayer({x:400},6,{source:'meatKnife',knockbackDistance:36});assert.equal(p.x,28,'world boundary clamp');
  // Use certain skill blocking rather than probabilistic dodge to verify no displacement.
  combat.canDodge=()=>false;combat.scene.skillSystem={beforePlayerDamage:()=>({blocked:true})};
  p.x=200;combat.damagePlayer({x:400},6,{source:'meatKnife',knockbackDistance:36});assert.equal(p.x,200);
}
const genericMethod=combatSource.slice(combatSource.indexOf('  updateEnemyAttack('),combatSource.indexOf('\n',combatSource.indexOf('  updateEnemyAttack(')));
const Generic=vm.runInNewContext('(class {'+genericMethod+'})',{
  BEHAVIOR_ATTACKERS:new Set(['meat']),isGravityReversalControlled:()=>false,isEnemyFrozen:()=>false
});
const generic=new Generic();generic.scene={targeting:{valid:()=>true}};
generic.chooseEnemyAttackTarget=()=>assert.fail('generic melee must not execute for meat');
generic.updateEnemyAttack({behavior:'meat'},1);
console.log('PASS manager wiring/control/death, actual player knockback, world bounds, blocking, and no duplicate generic melee');
