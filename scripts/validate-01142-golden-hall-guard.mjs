import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import GoldenHallGuardBehavior from '../src/enemies/behaviors/GoldenHallGuardBehavior.js';
import StageSystem,{ FLOW_GROUPS } from '../src/systems/StageSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { ENEMIES, GOLDEN_HALL_GUARD_TUNING as SPEAR } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen,shiftEnemyColdTimers } from '../src/systems/EnemyColdControl.js';

function fixture() {
  const g={destroyed:false,lines:[],clear(){this.lines=[];return this;},lineBetween(...p){this.lines.push(p);return this;},destroy(){this.destroyed=true;}};
  for(const name of ['setDepth','lineStyle'])g[name]=()=>g;
  const e={...ENEMIES.elite_golden_guard,enemyId:'elite_golden_guard',isElite:true,isBoss:false,x:500,y:400,active:true,nextAttackAt:0};
  e.hp=e.maxHp=112;e.body={velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){e.x=x;e.y=y;}};
  const target={type:'player',x:350,y:400,live:true,isAlive(){return this.live;}},targets=[target],hits=[];
  const s={runMode:'normal',now:0,getGameplayTime(){return this.now;},enemies:[e],player:target,playerData:{hp:100,maxHp:100},balance:BALANCE,
    add:{graphics:()=>g},hud:{update(){}},floatText(){},eventBus:{emit(){}},
    targeting:{valid:v=>v?.active&&!v.isDefeated,isEnemyFullyInsideViewport:()=>true,shouldRecycleEnemyLeft:()=>false,getEnemyRightRespawnX:()=>900},
    tweens:{items:[],add(cfg){this.items.push(cfg);return {stop(){},remove(){}};}}};
  const choose=(v,range)=>targets.find(t=>t.isAlive()&&Math.hypot(v.x-t.x,v.y-t.y)<=range);
  s.combatSystem={getOrLockEnemyTarget:()=>targets.find(t=>t.isAlive()),chooseEnemyAttackTarget:choose,
    damageAttackTarget:(target,damage,meta)=>hits.push({target,damage,meta,t:s.now})};
  const h={getEnemyAttackDelay,chooseTarget:(_s,v,r)=>choose(v,r),
    approach(_s,v){v.body.setVelocityX(Math.hypot(v.x-target.x,v.y-target.y)>v.attackRange?-getEnemyMoveSpeed(v,v.speed,s.now):0);},
    targetDamage:(_s,target,_e,damage,meta)=>hits.push({target,damage,meta,t:s.now})};
  const b=new GoldenHallGuardBehavior(s,e,h);return {s,e,g,target,targets,h,hits,b,tick(t){s.now=t;b.update(t);}};
}
{
  const f=fixture();let at=0;
  for(let i=1;i<=6;i++) {
    const heavy=i%3===0,wind=heavy?SPEAR.heavyWindup:SPEAR.windup;
    f.tick(at);assert.equal(f.b.state,'windup');assert.equal(f.b.heavy,heavy);assert.equal(f.e.body.velocity.x,0);
    f.tick(at+wind-1);assert.equal(f.hits.length,i-1);
    f.tick(at+wind);assert.equal(f.hits.length,i);assert.equal(f.b.state,'recovery');
    assert.equal(f.hits.at(-1).damage,heavy?14:9);assert.equal(f.hits.at(-1).meta.source,heavy?'goldenGuardHeavyThrust':'goldenGuardThrust');
    assert.equal(f.hits.at(-1).meta.knockbackDistance,0);assert.equal(f.b.thrusts,i%3);
    const recovery=heavy?SPEAR.heavyRecovery:SPEAR.recovery;
    f.tick(at+wind+recovery-1);assert.equal(f.b.state,'recovery');assert.equal(f.hits.length,i);
    f.tick(at+wind+recovery);assert.equal(f.b.state,'idle');assert.equal(f.hits.length,i);
    f.tick(f.b.nextAttack-1);assert.equal(f.hits.length,i);assert.equal(f.b.state,'idle');
    at=f.b.nextAttack;
  }
  assert.deepEqual(f.hits.map(v=>v.meta.source),['goldenGuardThrust','goldenGuardThrust','goldenGuardHeavyThrust','goldenGuardThrust','goldenGuardThrust','goldenGuardHeavyThrust']);
  f.b.destroy();
}
{
  const f=fixture();f.target.x=330;f.tick(0);assert.equal(f.hits.length,0);assert.equal(f.b.state,'idle');assert.equal(f.e.body.velocity.x,-160);
  f.target.x=335;f.tick(1);f.tick(251);assert.equal(f.hits.length,1,'long spear reaches beyond ordinary warrior range');
  f.b.thrusts=2;f.tick(f.b.nextAttack);assert(f.b.heavy);const due=f.b.until,interval=f.b.nextAttack;
  f.target.x=330;f.tick(due);assert.equal(f.hits.length,1);assert.equal(f.b.thrusts,2);assert.equal(f.b.nextAttack,interval,'failed heavy thrust spends no interval');
  f.target.live=false;const replacement={x:360,y:400,isAlive:()=>true};f.targets.push(replacement);f.tick(due+1);f.tick(due+1+SPEAR.heavyWindup);
  assert.equal(f.hits.at(-1).target,replacement);assert.equal(f.hits.at(-1).damage,14);assert.equal(f.b.thrusts,0);f.b.destroy();
}
for(const replacement of [false,true]) {
  const f=fixture();f.tick(0);f.target.live=false;
  const other={x:360,y:400,isAlive:()=>true};if(replacement)f.targets.push(other);
  f.tick(250);assert.equal(f.hits.length,replacement?1:0);assert.equal(f.b.thrusts,replacement?1:0);
  if(replacement)assert.equal(f.hits[0].target,other);else {assert.equal(f.b.nextAttack,0);assert.equal(f.b.state,'idle');}
  f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(99999);assert.equal(f.hits.length,1,'lag releases only one thrust');
  f.tick(100000);assert.equal(f.hits.length,1);f.b.destroy();
}
{
  const f=fixture();f.b.thrusts=2;f.tick(0);f.b.shiftTimers(1000,100);f.tick(600);assert.equal(f.hits.length,0);
  f.tick(1600);assert.equal(f.hits.length,1);assert.equal(f.b.nextAttack,3800);
  f.b.shiftTimers(500,1700);f.tick(2150);assert.equal(f.b.state,'recovery');f.tick(2650);assert.equal(f.b.state,'idle');
  assert.equal(f.b.nextAttack,4300);f.b.destroy();
}
for(const heavy of [false,true])for(const invalidation of ['caster','scene']) {
  const f=fixture();f.b.thrusts=heavy?2:0;f.tick(0);
  f.h.targetDamage=()=>{f.hits.push(1);if(invalidation==='caster')f.e.isDefeated=true;f.b.destroy();};
  f.tick(heavy?600:250);assert.equal(f.hits.length,1);assert.equal(f.b.graphics,null);assert(f.g.destroyed);f.b.destroy();
}

const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',{
  GoldenHallGuardBehavior,ShieldGuardBehavior:class {},MeatBehavior:class {},
  Phaser:{Math:{Between:()=>0}},getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,isEnemyFrozen,updateGravityPull,shiftEnemyColdTimers
});
for(const control of ['knockback','freeze','gravity'])for(const phase of ['lightWindup','heavyWindup','heavyRecovery']) {
  const f=fixture();f.b.destroy();f.g.destroyed=false;const m=new Manager(f.s);m.attach(f.e);const b=m.items.get(f.e);
  b.thrusts=phase==='lightWindup'?0:2;const tick=t=>{f.s.now=t;m.update(t);};tick(0);if(phase==='heavyRecovery')tick(600);
  const released=phase==='heavyRecovery',at=released?650:100,count=f.hits.length;
  if(control==='knockback')f.e.isKnockbackActive=true;
  if(control==='freeze')f.e.coldSources=new Map([['freeze',{expiresAt:9000,frozenUntil:9000}]]);
  if(control==='gravity'){m.interruptGravityReversal(f.e,at);f.e.gravityReversalState={};}
  tick(at);tick(at+50);assert.equal(f.hits.length,count);assert.equal(b.thrusts,released?0:phase==='lightWindup'?0:2);
  assert.equal(b.nextAttack,released?2800+(control==='gravity'?50:0):0,'unreleased thrust does not spend interval; released attack preserves it');
  f.e.isKnockbackActive=false;f.e.coldSources?.clear();delete f.e.gravityReversalState;
  const before=b.thrusts;m.recycleEnemy(f.e);assert.equal(f.e.x,900);assert.equal(b.thrusts,before);assert.equal(b.effectUntil,0);
  m.pause();tick(99999);assert.equal(b.state,'idle');m.resume();
  f.e.isDefeated=true;tick(100000);assert.equal(m.items.size,0);assert(f.g.destroyed);m.destroy();
}
// Real Combat routes own single damage, no generic duplicate, dodge/no displacement and no control immunity.
{
  const f=fixture(),combat=new CombatSystem(f.s);f.s.combatSystem=combat;
  f.s.player.setX=()=>assert.fail('spear cannot knock back player');
  f.h.targetDamage=(_s,target,e,d,meta)=>combat.damageAttackTarget(combat.getPlayerAttackTarget(),d,{enemy:e,...meta});
  combat.updateEnemyAttack(f.e,0);assert.equal(f.s.playerData.hp,100);
  f.tick(0);f.tick(250);assert.equal(f.s.playerData.hp,91);f.b.thrusts=2;f.tick(2450);f.tick(3050);assert.equal(f.s.playerData.hp,77);
  assert.equal(f.s.player.x,350);assert.equal(f.s.player.stunnedUntil,undefined);
  assert(combat.applyKnockback(f.e,{knockback:72}),'golden guard remains knockback-able during heavy thrust');f.b.destroy();
}
{
  const f=fixture(),combat=new CombatSystem(f.s);f.s.combatSystem=combat;
  const wolf={type:'spiritWolf',x:360,y:400,hp:30,isAlive(){return this.hp>0;},takeDamage(d){this.hp-=d;}};
  f.s.skillSystem={passiveState:{spiritWolves:{wolves:[wolf]}}};
  f.h.chooseTarget=(_s,e,range)=>combat.chooseEnemyAttackTarget(e,range);
  f.h.targetDamage=(_s,target,e,d,meta)=>combat.damageAttackTarget(target,d,{enemy:e,...meta});
  f.b.thrusts=2;f.tick(0);f.tick(600);assert.equal(wolf.hp,16);assert.equal(f.s.playerData.hp,100,'single-target thrust can be taken by a front summon');f.b.destroy();
}
{
  const f=fixture(),combat=new CombatSystem(f.s);f.s.combatSystem=combat;
  f.s.eventBus.emit=event=>{if(event===CombatEvents.PLAYER_DAMAGED){f.e.isDefeated=true;f.b.destroy();}};
  f.h.targetDamage=(_s,target,e,d,meta)=>combat.damageAttackTarget(combat.getPlayerAttackTarget(),d,{enemy:e,...meta});
  f.b.thrusts=2;f.tick(0);f.tick(600);assert.equal(f.s.playerData.hp,86);assert.equal(f.b.graphics,null);assert(f.g.destroyed);
}
{
  const f=fixture();f.b.destroy();f.s.enemies=[];
  const node=(x=0,y=0,w=0,h=0)=>({x,y,width:w,height:h,active:true,
    setStrokeStyle(){return this;},setDepth(){return this;},setOrigin(){return this;},setPosition(){return this;},setVisible(){return this;},setAlpha(){return this;},setText(){return this;},add(){return this;},
    body:{setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}}});
  f.s.physics={add:{existing(){}}};Object.assign(f.s.add,{rectangle:node,text:(x,y)=>node(x,y),container:node});
  const m=new Manager(f.s);f.s.enemyBehaviors=m;const st=new StageSystem(f.s);st.currentEnemyLevel=14;
  const e=st.spawn('elite_golden_guard',600);assert.equal(e.name,'黄金殿卫');assert.equal(e.hp,228);assert.equal(e.damage,22);assert.equal(e.attackRange,165);
  assert(e.isElite&&!e.isBoss);assert(m.items.get(e) instanceof GoldenHallGuardBehavior);m.destroy();assert(f.g.destroyed);
  f.s.runMode='test';m.attach({...e,enemyId:'elite',behavior:undefined});assert.equal(m.items.size,0);m.destroy();
}
const scene={runMode:'normal'},stage=new StageSystem(scene),catalog=JSON.stringify(FLOW_GROUPS);
const newIds=['elite_golden_guard','elite_gambler','elite_hell_envoy','elite_thunder_mage','elite_berserker','elite_war_drum_priest','elite_sharpshooter'];
for(const level of [1,14,19,100]) {
  stage.currentEnemyLevel=level;const e=stage.tunedEnemy('elite_golden_guard'),offset=level-1;
  assert.equal(e.hp,Math.round(112*(1+offset*.08)));assert.equal(e.damage,Math.round(9*(1+offset*.11)));
  assert.equal(e.attackIntervalMs,2200);assert.equal(e.attackRange,165);assert.equal(e.speed,160);
}
let first=null,gold=0,oldGold=0;
for(const group of FLOW_GROUPS)for(let wave=0;wave<4;wave++) {
  stage.currentGroup=group.group;stage.currentWave=wave+1;scene.runMode='normal';
  const items=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);scene.runMode='test';
  const legacy=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);
  const expected=wave===1&&group.group>=14&&group.group%3===2?1:0;
  assert.equal(items.filter(e=>e.id==='elite_golden_guard').length,expected);assert.equal(items.length,legacy.length);
  assert.deepEqual(items.map(e=>newIds.includes(e.id)?'elite':e.id).sort(),legacy.map(e=>e.id).sort());assert(!legacy.some(e=>newIds.includes(e.id)));
  if(expected){first??=`${group.group}-${wave+1}`;const index=items.findIndex(e=>e.id==='elite_golden_guard');assert.equal(items[index].role,'front');
    assert(items.slice(0,index).every(e=>e.role==='front'));assert(items.slice(index+1).every(e=>e.role==='back'),'long spear follows normal melee front line');}
  if(wave<3){const income=arr=>arr.reduce((n,v)=>n+(ENEMIES[v.id].kind==='elite'?15:1),0);gold+=income(items);oldGold+=income(legacy);}
}
assert.equal(first,'14-2');assert.equal(gold,oldGold);assert.equal(JSON.stringify(FLOW_GROUPS),catalog);
{
  const s={runMode:'normal',balance:BALANCE,enemies:[],eventBus:{emit(){}},hud:{setStage(){},update(){}}},st=new StageSystem(s);
  st.groupIndex=13;st.currentWave=1;st.queueGroupWave(0);assert.equal(st.waveQueue.filter(v=>v.id==='elite_golden_guard').length,1);
}
console.log('PASS golden hall guard growth/real spawn/mode/rotation/front order/counts/gold, two light/third heavy thrust timing, range and reacquisition/failed release, no duplicate melee/knockback/stun/immunity, real player/summon damage and synchronous callbacks, controls/timers/pause/recycle/scene cleanup');
