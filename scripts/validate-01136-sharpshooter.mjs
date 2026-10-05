import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import SharpshooterBehavior from '../src/enemies/behaviors/SharpshooterBehavior.js';
import StageSystem,{ FLOW_GROUPS } from '../src/systems/StageSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { ENEMIES, SHARPSHOOTER_TUNING as SHOT } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen } from '../src/systems/EnemyColdControl.js';

const s={runMode:'normal'},stage=new StageSystem(s),before=JSON.stringify(FLOW_GROUPS);
for(const level of [1,8,19,100]) {
  stage.currentEnemyLevel=level;const e=stage.tunedEnemy('elite_sharpshooter'),offset=level-1;
  assert.equal(e.name,'神射手');assert.equal(e.kind,'elite');assert.equal(e.behavior,'archer');
  assert.equal(e.hp,Math.round(56*(1+offset*0.05)));
  assert.equal(e.damage,Math.round(8*(1+offset*0.12)));
  assert.equal(e.attackIntervalMs,Math.round(2200/(1+Math.min(0.15,offset*0.01))));
  assert.equal(e.speed,360);assert.equal(e.attackRange,500);
}
let first=null,normalGold=0,legacyGold=0;
for(const group of FLOW_GROUPS)for(let wave=0;wave<3;wave+=1) {
  stage.currentGroup=group.group;stage.currentWave=wave+1;s.runMode='normal';
  const items=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);
  s.runMode='test';const legacy=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);
  const newCount=items.filter(e=>e.id==='elite_sharpshooter').length;
  assert.equal(items.length,legacy.length);assert.equal(items.length,group.waves[wave]);
  const priestGroup=group.group>=9&&group.group%3===0;
  const berserkerGroup=group.group>=11&&group.group%3===2;
  const mageWave=wave===2&&group.group>=10&&group.group%3===1;
  assert.equal(newCount,!mageWave&&!priestGroup&&!berserkerGroup&&group.group>=8&&group.group%2===0&&group.ids[wave].includes('elite')?1:0);
  assert.deepEqual(items.map(e=>['elite_sharpshooter','elite_war_drum_priest','elite_berserker','elite_thunder_mage'].includes(e.id)?'elite':e.id).sort(),legacy.map(e=>e.id).sort(),'only existing elite slot changes');
  assert(!legacy.some(e=>['elite_sharpshooter','elite_war_drum_priest','elite_berserker','elite_thunder_mage'].includes(e.id)),'test mode never receives new elites');
  const index=items.findIndex(e=>e.id==='elite_sharpshooter');
  if(index>=0){first??=`${group.group}-${wave+1}`;assert.equal(items[index].role,'back');assert(items.slice(index+1).every(e=>e.role==='back'),'ranged elite is behind all front units');}
  const gold=ids=>ids.reduce((sum,e)=>sum+(ENEMIES[e.id].kind==='elite'?15:1),0);
  normalGold+=gold(items);legacyGold+=gold(legacy);
}
assert.equal(first,'8-1');assert.equal(normalGold,legacyGold,'no extra scheduled kill gold');
assert.equal(JSON.stringify(FLOW_GROUPS),before,'legacy shared wave catalog is untouched');

function fixture() {
  const g={destroyed:false,destroy(){this.destroyed=true;}};
  for(const key of ['setDepth','clear','lineStyle','lineBetween'])g[key]=()=>g;
  const e={...ENEMIES.elite_sharpshooter,enemyId:'elite_sharpshooter',isElite:true,x:500,y:400,active:true,nextAttackAt:0};
  e.body={velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){e.x=x;e.y=y;}};
  const target={x:150,y:400,live:true,isAlive(){return this.live;}};
  const hits=[],s={runMode:'normal',now:0,getGameplayTime(){return this.now;},enemies:[e],balance:BALANCE,
    player:target,playerData:{hp:100,maxHp:100},add:{graphics:()=>g},floatText(){},eventBus:{emit(){}},
    targeting:{valid:v=>v?.active&&!v.isDefeated,isEnemyFullyInsideViewport:()=>true,shouldRecycleEnemyLeft:()=>false,getEnemyRightRespawnX:()=>900}};
  const targets=[target];s.combatSystem={getAttackableTargets:()=>targets,getOrLockEnemyTarget:()=>targets.find(t=>t.isAlive()),
    chooseEnemyAttackTarget:(_e,range)=>targets.find(t=>t.isAlive()&&Math.hypot(e.x-t.x,e.y-t.y)<=range),
    damageAttackTarget:(victim,damage,meta)=>hits.push({victim,damage,meta})};
  const h={getEnemyAttackDelay,approach(_s,v){v.body.setVelocityX(Math.hypot(v.x-target.x,v.y-target.y)>v.attackRange?-getEnemyMoveSpeed(v,v.speed,s.now):0);},
    chooseTarget:(_s,v,range)=>targets.find(t=>t.isAlive()&&Math.hypot(v.x-t.x,v.y-t.y)<=range),
    targetDamage:(_s,victim,_e,damage,meta)=>hits.push({victim,damage,meta})};
  const b=new SharpshooterBehavior(s,e,h),tick=t=>{s.now=t;b.update(t);};
  return {g,e,target,targets,hits,s,h,b,tick};
}
{
  const f=fixture();f.tick(0);assert.equal(f.b.arrows.length,1);assert.equal(f.hits.length,0,'no instant projectile damage');
  f.tick(350);assert.equal(f.hits.length,1);assert.equal(f.hits[0].damage,8);
  f.tick(2199);assert.equal(f.b.arrows.length,0);f.tick(2200);f.tick(2550);assert.equal(f.hits.length,2);
  f.tick(3500);assert.equal(f.b.state,'windup');f.tick(4199);assert.equal(f.b.arrows.length,0);
  f.tick(4200);assert.equal(f.b.shots,1);f.tick(4399);assert.equal(f.b.shots,1);
  f.tick(4400);assert.equal(f.b.shots,2);f.tick(4600);assert.equal(f.b.shots,3);assert.equal(f.b.state,'recovery');
  f.tick(4950);assert.equal(f.hits.length,5);assert.equal(f.hits.filter(h=>h.meta.source==='sharpshooterBurst').length,3);
  assert(f.hits.slice(2).every(h=>h.damage===6&&h.meta.knockbackDistance===0));
  f.tick(5250);assert.equal(f.b.state,'idle');assert.equal(f.b.nextBurst,11250);
  f.tick(7449);assert.equal(f.hits.length,5);f.tick(7450);assert.equal(f.b.arrows.length,1,'normal shooting resumes after recovery');
}
{
  const f=fixture();f.tick(0);f.target.y=800;f.tick(350);assert.equal(f.hits.length,0,'flight does not track moving target');
  f.target.live=false;f.tick(3500);assert.equal(f.b.state,'idle');assert.equal(f.b.nextNormal,2200,'failed normal shot does not spend cooldown');
}
{
  const f=fixture();f.tick(0);f.tick(3500);assert.equal(f.b.state,'windup');
  f.target.live=false;f.tick(4200);assert.equal(f.b.state,'idle');assert.equal(f.b.nextBurst,3500,'failed cast does not spend burst cooldown');
  const replacement={x:300,y:400,isAlive:()=>true};f.targets.push(replacement);f.tick(4300);f.tick(5000);f.tick(5350);
  assert.equal(f.hits.at(-1).victim,replacement,'fresh target after original death');
}
{
  const f=fixture();f.targets.push({x:300,y:400,isAlive:()=>true});f.tick(0);f.tick(350);
  assert.equal(f.hits.length,1);assert.equal(f.hits[0].victim,f.targets[1],'first collision, not every target on trajectory');
  f.tick(351);assert.equal(f.hits.length,1,'arrow cannot hit twice');
}
for(const state of ['windup','burst','recovery']) {
  const f=fixture();f.tick(0);f.tick(3500);if(state!=='windup')f.tick(4200);
  if(state==='recovery'){f.tick(4400);f.tick(4600);}
  const due=f.b.nextBurst,count=f.hits.length;f.b.interrupt(4700);f.tick(5050);
  assert.equal(f.b.arrows.length,0);assert.equal(f.hits.length,count,'control removes in-flight arrows');
  if(state==='windup')assert.equal(f.b.nextBurst,due,'unreleased burst remains available');
  f.b.onRecycle();assert.equal(f.b.nextBurst,null);assert.equal(f.b.arrows.length,0);f.b.destroy();f.b.destroy();assert(f.g.destroyed);
}
{
  const f=fixture();f.tick(0);f.b.shiftTimers(1000,100);
  f.tick(350);assert.equal(f.hits.length,0);f.tick(1350);assert.equal(f.hits.length,1);
  f.tick(4500);assert.equal(f.b.state,'windup');f.b.shiftTimers(500,4600);f.tick(5200);assert.equal(f.b.state,'windup');
  f.tick(5700);assert.equal(f.b.state,'burst');
  f.h.targetDamage=()=>{f.hits.push(1);f.e.isDefeated=true;f.b.destroy();};f.tick(6050);
  assert.equal(f.b.graphics,null);assert.equal(f.b.arrows.length,0,'synchronous reflected death safely clears all arrows');
}

const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',{
  SharpshooterBehavior,ShieldGuardBehavior:class {},MasterBehavior:class {},DoctorBehavior:class {},MeatBehavior:class {},
  Phaser:{Math:{Between:()=>0}},getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,isEnemyFrozen,
  updateGravityPull:()=>false,shiftEnemyColdTimers(){}
});
{
  const f=fixture();f.b.destroy();f.g.destroyed=false;const m=new Manager(f.s);m.attach(f.e);
  const b=m.items.get(f.e);assert(b instanceof SharpshooterBehavior);
  const tick=t=>{f.s.now=t;m.update(t);};tick(0);tick(3500);assert.equal(b.state,'windup');
  f.e.isKnockbackActive=true;tick(3600);assert.equal(b.state,'idle');assert.equal(b.arrows.length,0);f.e.isKnockbackActive=false;
  tick(4000);tick(4700);assert.equal(b.state,'burst');m.interruptGravityReversal(f.e,4701);assert.equal(b.arrows.length,0);
  f.e.gravityReversalState={};tick(4800);assert.equal(f.e.body.velocity.x,0);delete f.e.gravityReversalState;
  b.state='windup';f.e.coldSources=new Map([['freeze',{expiresAt:7000,frozenUntil:7000}]]);tick(5000);assert.equal(b.state,'idle');f.e.coldSources.clear();
  m.pause();tick(6000);assert.equal(b.state,'idle');m.resume();
  m.recycleEnemy(f.e);assert.equal(f.e.x,900);assert.equal(b.nextBurst,null);assert.equal(b.arrows.length,0);
  f.e.isDefeated=true;tick(8000);assert.equal(m.items.size,0);assert(f.g.destroyed);m.destroy();
}
// Real generic attack/player damage paths must not add melee or displace player.
{
  const f=fixture(),combat=new CombatSystem(f.s);combat.updateEnemyAttack(f.e,0);assert.equal(f.s.playerData.hp,100);
  f.s.player.setX=()=>assert.fail('sharpshooter must not knock back player');
  combat.damagePlayer(f.e,6,{source:'sharpshooterBurst',attackType:'projectile',knockbackDistance:0});
  assert.equal(f.s.playerData.hp,94);assert.equal(f.target.x,150);
}
console.log('PASS sharpshooter growth, unchanged wave counts/gold/test flow, back-row elite rotation, timed three-shot burst, no extra melee/knockback, swept single hits, misses, retargeting, control and cleanup');
