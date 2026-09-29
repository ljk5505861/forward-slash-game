import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import DoctorBehavior, { doctorHealAmount } from '../src/enemies/behaviors/DoctorBehavior.js';
import StageSystem from '../src/systems/StageSystem.js';
import { BALANCE } from '../src/config/balance.js';
import { ENEMIES } from '../src/config/enemies.js';

const scene={runMode:'normal'}, stage=new StageSystem(scene);
for (const level of [1,5,10,19]) {
  stage.currentEnemyLevel=level;
  const e=stage.tunedEnemy('healer');
  assert.equal(e.name,'医师'); assert.equal(e.behavior,'healer');
  assert.equal(e.hp,Math.round(36*(1+(level-1)*0.06)));
  assert.equal(e.damage,Math.round(2*(1+(level-1)*0.02)));
  assert.equal(doctorHealAmount(e),Math.round(12*(1+(level-1)*0.1)));
  for(const key of ['speed','attackRange','width','height']) assert.equal(e[key],ENEMIES.healer[key]);
  assert.equal(e.attackIntervalMs,2800);
}
scene.runMode='test';
assert.equal(stage.tunedEnemy('healer').name,'治疗祭司');
assert.equal(stage.tunedEnemy('healer').healAmount,18);

function fixture() {
  const g={destroyed:false,clear(){return this;},setDepth(){return this;},lineStyle(){return this;},lineBetween(){return this;},destroy(){this.destroyed=true;}};
  const e={active:true,x:500,y:400,hp:1,maxHp:36,level:1,healAmount:12,damage:2,attackRange:480,attackIntervalMs:2800,body:{setVelocityX(){}}};
  const a={active:true,x:300,y:400,hp:40,maxHp:100};
  const b={active:true,x:200,y:400,hp:10,maxHp:100};
  const hits=[], s={runMode:'normal',balance:BALANCE,enemies:[e,a,b],now:0,getGameplayTime(){return this.now;},add:{graphics:()=>g},floatText(){}};
  const helpers={approach(){},getEnemyAttackDelay:(_e,ms)=>ms,chooseTarget:()=>null,targetDamage:()=>hits.push(1)};
  const behavior=new DoctorBehavior(s,e,helpers);
  const tick=t=>{s.now=t;behavior.update(t);};
  return {g,e,a,b,s,hits,helpers,behavior,tick};
}
{
  const f=fixture(); f.tick(0);f.tick(2799);assert.equal(f.b.hp,10);
  f.tick(2800);assert.equal(f.b.hp,22);assert.equal(f.e.hp,1,'never self-heals');
  assert.equal(f.a.hp,40,'one target per action');
  f.tick(2801);assert.equal(f.b.hp,22,'no per-frame healing');
  f.a.hp=100;f.b.hp=99;f.tick(5600);assert.equal(f.b.hp,100,'no overheal');
  f.s.now=5961;f.behavior.syncVisual();assert.equal(f.behavior.target,null);
}
{
  const f=fixture();f.b.isDefeated=true;f.a.x=1100;f.tick(0);f.tick(2800);
  assert.equal(f.a.hp,40);assert.equal(f.b.hp,10,'dead/out-of-range excluded');
  f.a.x=300;f.tick(2801);assert.equal(f.a.hp,52,'no-target does not spend cooldown');
  f.behavior.onRecycle();assert.equal(f.behavior.next,null);assert.equal(f.behavior.target,null);
  f.tick(3000);f.tick(5799);assert.equal(f.a.hp,52,'recycle restarts cadence');
  f.tick(5800);assert.equal(f.a.hp,64);
  f.behavior.destroy();f.behavior.destroy();assert(f.g.destroyed);assert.equal(f.behavior.graphics,null);
}
{
  const f=fixture();f.a.hp=f.b.hp=100;
  f.helpers.chooseTarget=(_s,_e,range)=>{assert.equal(range,86);return {isAlive:()=>true};};
  f.helpers.targetDamage=()=>{f.hits.push(1);f.e.isDefeated=true;f.behavior.destroy();};
  f.tick(0);f.tick(2800);assert.equal(f.hits.length,1,'melee callback may synchronously destroy doctor');
}
{
  const f=fixture();f.tick(0);f.behavior.shiftTimers(1000,1000);
  f.tick(2800);assert.equal(f.b.hp,10);f.tick(3800);assert.equal(f.b.hp,22);
}
// Real manager attachment and crowd-control gates, not only behavior mocks.
const code=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const Manager=vm.runInNewContext(code+'\nEnemyBehaviorManager',{
  DoctorBehavior,MeatBehavior:class {},Phaser:{},
  getEnemyMoveSpeed:(_e,v)=>v,getEnemyAttackDelay:(_e,v)=>v,updateGravityPull:()=>false,
  isGravityReversalControlled:e=>!!e.reversed,isEnemyFrozen:e=>!!e.frozen,shiftEnemyColdTimers(){}
});
{
  const f=fixture();f.e.behavior='healer';f.s.enemies=[f.e,f.a];
  f.s.targeting={isEnemyFullyInsideViewport:()=>true,shouldRecycleEnemyLeft:()=>false};
  f.s.combatSystem={getPlayerAttackTarget:()=>({x:20,y:400})};
  const manager=new Manager(f.s);manager.attach(f.e);
  assert(manager.items.get(f.e) instanceof DoctorBehavior);
  manager.update(0);
  for(const key of ['isKnockbackActive','frozen','reversed']){
    f.e[key]=true;manager.update(3000);assert.equal(f.a.hp,40,key+' suppresses healing');f.e[key]=false;
  }
  manager.update(6000);assert.equal(f.a.hp,52);
  manager.pause();manager.update(9000);assert.equal(f.a.hp,52);manager.resume();
  f.e.isDefeated=true;manager.update(9100);assert.equal(manager.items.size,0);assert(f.g.destroyed);
  f.s.runMode='test';f.e.isDefeated=false;manager.attach(f.e);
  assert(!(manager.items.get(f.e) instanceof DoctorBehavior),'test-mode keeps old healer');
  manager.destroy();
}
// Real spawn preserves the heal amount/level used by the behavior.
const node=(x=0,y=0,w=0,h=0)=>({x,y,width:w,height:h,active:true,
  setStrokeStyle(){return this;},setDepth(){return this;},setOrigin(){return this;},setPosition(){return this;},setVisible(){return this;},setAlpha(){return this;},setText(){return this;},add(){return this;},
  body:{setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}}});
Object.assign(scene,{runMode:'normal',balance:BALANCE,enemies:[],physics:{add:{existing(){}}},
  add:{rectangle:node,text:(x,y)=>node(x,y),circle:node,container:node},enemyBehaviors:{attach(e){e.attached=true;}},eventBus:{emit(){}}});
stage.currentEnemyLevel=10;const spawned=stage.spawn('healer',600);
assert.equal(spawned.healAmount,12);assert.equal(spawned.level,10);assert.equal(doctorHealAmount(spawned),23);assert(spawned.attached);
console.log('PASS doctor growth, isolation, target choice, timing, range, cap, controls, recycling, cleanup, synchronous death and real spawn');
