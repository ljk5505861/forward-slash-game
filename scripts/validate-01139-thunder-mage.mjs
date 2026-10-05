import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ThunderMageBehavior from '../src/enemies/behaviors/ThunderMageBehavior.js';
import StageSystem,{ FLOW_GROUPS } from '../src/systems/StageSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { ENEMIES, THUNDER_MAGE_TUNING as THUNDER } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen,shiftEnemyColdTimers } from '../src/systems/EnemyColdControl.js';

const scene={runMode:'normal'},stage=new StageSystem(scene),catalog=JSON.stringify(FLOW_GROUPS);
const newIds=['elite_berserker','elite_war_drum_priest','elite_sharpshooter','elite_thunder_mage'];
for(const level of [1,10,19,100]) {
  stage.currentEnemyLevel=level;const e=stage.tunedEnemy('elite_thunder_mage'),offset=level-1;
  assert.equal(e.name,'雷法师');assert.equal(e.kind,'elite');assert.equal(e.behavior,'archer');
  assert.equal(e.hp,Math.round(62*(1+offset*0.06)));assert.equal(e.damage,Math.round(8*(1+offset*0.11)));
  assert.equal(e.attackIntervalMs,Math.round(2400/(1+Math.min(0.10,offset*0.01))));assert.equal(e.speed,360);assert.equal(e.attackRange,480);
}
let first=null,gold=0,oldGold=0;
for(const group of FLOW_GROUPS)for(let wave=0;wave<4;wave+=1) {
  stage.currentGroup=group.group;stage.currentWave=wave+1;scene.runMode='normal';
  const items=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);
  scene.runMode='test';const legacy=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);
  const expected=wave===2&&group.group>=10&&group.group%3===1&&group.ids[wave].includes('elite')?1:0;
  assert.equal(items.filter(v=>v.id==='elite_thunder_mage').length,expected);
  assert.equal(items.length,group.waves[wave]);assert.equal(items.length,legacy.length);
  assert.deepEqual(items.map(v=>newIds.includes(v.id)?'elite':v.id).sort(),legacy.map(v=>v.id).sort());
  assert(!legacy.some(v=>newIds.includes(v.id)),'test mode retains old lineup');
  const index=items.findIndex(v=>v.id==='elite_thunder_mage');
  if(index>=0){first??=`${group.group}-${wave+1}`;assert.equal(items[index].role,'back');assert(items.slice(index+1).every(v=>v.role==='back'));}
  if(wave<3){const income=arr=>arr.reduce((n,v)=>n+(ENEMIES[v.id].kind==='elite'?15:1),0);gold+=income(items);oldGold+=income(legacy);}
}
assert.equal(first,'10-3');assert.equal(gold,oldGold);assert.equal(JSON.stringify(FLOW_GROUPS),catalog);
// Real queueGroupWave passes the current wave into rotation, not a stale/reset index.
{
  const s={runMode:'normal',balance:BALANCE,enemies:[],eventBus:{emit(){}},hud:{setStage(){},update(){}}};
  const st=new StageSystem(s);st.groupIndex=9;st.currentWave=2;st.queueGroupWave(1000);
  assert.equal(st.currentGroup,10);assert.equal(st.currentWave,3);assert.equal(st.waveQueue.filter(v=>v.id==='elite_thunder_mage').length,1);
  st.groupIndex=15;st.currentWave=0;st.waveQueue=[];st.queueGroupWave(1000);
  assert(st.waveQueue.some(v=>v.id==='elite_sharpshooter'),'other wave retains previous ranged elite');
}

function fixture() {
  const g={destroyed:false,circles:[],destroy(){this.destroyed=true;},clear(){this.circles=[];return this;},strokeCircle(...p){this.circles.push(p);return this;}};
  for(const name of ['setDepth','lineStyle','lineBetween'])g[name]=()=>g;
  const e={...ENEMIES.elite_thunder_mage,enemyId:'elite_thunder_mage',isElite:true,isBoss:false,x:500,y:400,active:true,nextAttackAt:0};
  e.body={velocity:{x:0},setVelocityX(n){this.velocity.x=n;},reset(x,y){e.x=x;e.y=y;}};
  const target={x:150,y:400,type:'player',live:true,isAlive(){return this.live;}};
  const targets=[target],hits=[],s={runMode:'normal',now:0,getGameplayTime(){return this.now;},enemies:[e],player:target,
    playerData:{hp:100,maxHp:100},balance:BALANCE,add:{graphics:()=>g},floatText(){},eventBus:{emit(){}},
    targeting:{valid:v=>v?.active&&!v.isDefeated,isEnemyFullyInsideViewport:()=>true,
      shouldRecycleEnemyLeft:()=>false,getEnemyRightRespawnX:()=>900}};
  const choose=(v,range)=>targets.find(t=>t.isAlive()&&Math.hypot(v.x-t.x,v.y-t.y)<=range);
  s.combatSystem={getAttackableTargets:()=>targets,getOrLockEnemyTarget:()=>targets.find(t=>t.isAlive()),chooseEnemyAttackTarget:choose,
    damageAttackTarget:(victim,damage,meta)=>hits.push({victim,damage,meta,t:s.now})};
  const h={getEnemyAttackDelay,approach(_s,v){v.body.setVelocityX(Math.hypot(v.x-target.x,v.y-target.y)>v.attackRange?-getEnemyMoveSpeed(v,v.speed,s.now):0);},
    chooseTarget:(_s,v,range)=>choose(v,range),targetDamage:(_s,victim,_e,damage,meta)=>hits.push({victim,damage,meta,t:s.now})};
  const b=new ThunderMageBehavior(s,e,h),tick=t=>{s.now=t;b.update(t);};
  return {s,e,g,target,targets,h,hits,b,tick};
}
{
  const f=fixture();f.tick(0);assert(f.b.bolt);assert.equal(f.hits.length,0,'no instant bolt damage');f.tick(400);assert.equal(f.hits.length,1);
  f.tick(2399);assert.equal(f.b.bolt,null);f.tick(2400);f.tick(2800);assert.equal(f.hits.length,2);
  f.tick(4000);assert.equal(f.b.state,'windup');assert.deepEqual(f.b.warning,{x:150,y:400});assert.equal(f.e.body.velocity.x,0);
  f.tick(4800);assert.equal(f.hits.length,2,'no normal bolt during warning');f.tick(4899);assert.equal(f.hits.length,2);
  f.tick(4900);assert.equal(f.hits.length,3);assert.equal(f.hits.at(-1).damage,12);assert.equal(f.hits.at(-1).meta.source,'thunderMageStrike');
  assert.equal(f.b.state,'recovery');assert.equal(f.b.warning,null);assert.equal(f.b.nextThunder,12050);
  f.tick(5549);assert.equal(f.hits.length,3);f.tick(5550);assert.equal(f.b.state,'idle');f.tick(7949);assert.equal(f.b.bolt,null);
  f.tick(7950);assert(f.b.bolt);f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.targets.push({x:300,y:400,isAlive:()=>true});f.tick(400);
  assert.equal(f.hits.length,1);assert.equal(f.hits[0].victim,f.targets[1],'bolt hits nearest collision only');f.tick(401);assert.equal(f.hits.length,1);f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.target.y=800;f.tick(400);assert.equal(f.hits.length,0,'bolt does not track');
  f.target.live=false;f.tick(4000);assert.equal(f.b.state,'idle');assert.equal(f.b.nextNormal,2400,'no target does not spend attack cooldown');f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(400);f.tick(4000);const point={...f.b.warning};
  f.target.x=350;f.e.x=600;f.tick(4500);assert.deepEqual(f.b.warning,point);assert(f.g.circles.some(v=>v[0]===150&&v[1]===400&&v[2]===70));
  const count=f.hits.length;f.tick(4900);assert.equal(f.hits.length,count,'moving out avoids fixed strike');
  assert.deepEqual(f.b.impact,point);assert.equal(f.b.nextThunder,12050,'a released strike can miss and still spends cooldown');f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(400);f.tick(4000);f.target.live=false;
  const replacement={x:150,y:400,isAlive:()=>true};f.targets.push(replacement);f.tick(4900);
  assert.equal(f.hits.at(-1).victim,replacement,'new target in warned area can be hit without following old target');f.b.destroy();
}
for(const invalidation of ['caster','scene','other']) {
  const f=fixture();f.tick(0);f.tick(400);f.tick(4000);
  const other={x:160,y:400,live:true,isAlive(){return this.live;}};f.targets.push(other);
  const hits=[];f.h.targetDamage=(s,v,e,d,meta)=>{
    hits.push(v);if(invalidation==='other')other.live=false;
    else {if(invalidation==='caster')f.e.isDefeated=true;f.b.destroy();}
  };
  f.tick(4900);assert.equal(hits.length,1,'later AoE targets revalidated after synchronous damage callback');
  if(invalidation!=='other')assert.equal(f.b.graphics,null);f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.b.shiftTimers(1000,100);f.tick(400);assert.equal(f.hits.length,0);f.tick(1400);assert.equal(f.hits.length,1);
  f.tick(5000);assert.equal(f.b.state,'windup');f.b.shiftTimers(500,5100);f.tick(5900);assert.equal(f.b.state,'windup');f.tick(6400);assert.equal(f.b.state,'recovery');f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.h.targetDamage=()=>{f.e.isDefeated=true;f.b.destroy();};f.tick(400);
  assert.equal(f.b.graphics,null);assert.equal(f.b.bolt,null,'reflected projectile death leaves no bolt');
}

const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',{
  ThunderMageBehavior,EliteBerserkerBehavior:class {},WarDrumPriestBehavior:class {},DoctorBehavior:class {},SharpshooterBehavior:class {},ShieldGuardBehavior:class {},MasterBehavior:class {},MeatBehavior:class {},
  Phaser:{Math:{Between:()=>0}},getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,isEnemyFrozen,updateGravityPull,shiftEnemyColdTimers
});
for(const control of ['knockback','freeze','gravity'])for(const pending of ['bolt','warning']) {
  const f=fixture();f.b.destroy();f.g.destroyed=false;const m=new Manager(f.s);m.attach(f.e);const b=m.items.get(f.e);
  assert(b instanceof ThunderMageBehavior);const tick=t=>{f.s.now=t;m.update(t);};tick(0);if(pending==='warning'){tick(400);tick(4000);}
  const t=pending==='bolt'?100:4100,count=f.hits.length;
  if(control==='knockback')f.e.isKnockbackActive=true;
  if(control==='freeze')f.e.coldSources=new Map([['freeze',{expiresAt:9000,frozenUntil:9000}]]);
  if(control==='gravity'){m.interruptGravityReversal(f.e,t);f.e.gravityReversalState={};}
  tick(t);tick(t+100);assert.equal(b.bolt,null);assert.equal(b.warning,null);assert.equal(f.hits.length,count);
  if(pending==='warning')assert.equal(b.nextThunder,4000,'interrupted unreleased strike does not spend full cooldown');
  f.e.isKnockbackActive=false;f.e.coldSources?.clear();delete f.e.gravityReversalState;
  m.recycleEnemy(f.e);assert.equal(f.e.x,900);assert.equal(b.nextThunder,null);assert.equal(b.impact,null);
  m.pause();tick(10000);assert.equal(b.nextThunder,null);m.resume();f.e.isDefeated=true;tick(11000);
  assert.equal(m.items.size,0);assert(f.g.destroyed);m.destroy();
}
// Actual player/summon AoE settlement; no added melee, knockback or stun.
{
  const f=fixture(),combat=new CombatSystem(f.s);f.s.combatSystem=combat;
  const summon={type:'spiritWolf',x:160,y:400,hp:30,isAlive(){return this.hp>0;},takeDamage(d){this.hp-=d;return d;}};
  f.s.skillSystem={passiveState:{spiritWolves:{wolves:[summon]}},beforePlayerDamage(){return null;},beforePlayerHpDamage(){return null;}};
  f.s.player.setX=()=>assert.fail('thunder mage cannot knock back player');
  combat.updateEnemyAttack(f.e,0);assert.equal(f.s.playerData.hp,100);
  f.b.warning={x:150,y:400};f.s.now=4900;f.h.targetDamage=(_s,v,e,d,meta)=>combat.damageAttackTarget(v,d,{enemy:e,...meta});f.b.strike(4900);
  assert.equal(f.s.playerData.hp,88);assert.equal(summon.hp,18);assert.equal(f.target.x,150);
  assert.equal(f.e.isKnockbackActive,undefined);assert.equal(f.s.player.stunnedUntil,undefined);f.b.destroy();
}
// Real spawn uses normal profile; test-mode old archer keeps old dispatch.
{
  const f=fixture();f.b.destroy();f.s.enemies=[];
  const node=(x=0,y=0,w=0,h=0)=>({x,y,width:w,height:h,active:true,
    setStrokeStyle(){return this;},setDepth(){return this;},setOrigin(){return this;},setPosition(){return this;},
    setVisible(){return this;},setAlpha(){return this;},setText(){return this;},add(){return this;},
    body:{setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}}});
  f.s.physics={add:{existing(){}}};Object.assign(f.s.add,{rectangle:node,text:(x,y)=>node(x,y),container:node});
  const m=new Manager(f.s);f.s.enemyBehaviors=m;const st=new StageSystem(f.s);st.currentEnemyLevel=10;
  const e=st.spawn('elite_thunder_mage',600);assert.equal(e.hp,95);assert.equal(e.damage,16);assert.equal(e.name,'雷法师');assert(e.isElite&&!e.isBoss);
  assert(m.items.get(e) instanceof ThunderMageBehavior);m.destroy();assert(f.g.destroyed);
  f.s.runMode='test';const archer={...f.e,active:true,isDefeated:false,enemyId:'archer',behavior:'archer'};m.attach(archer);
  assert.equal(m.items.get(archer).constructor.name,'ArcherBehavior');m.destroy();
}
console.log('PASS thunder mage growth/spawn/mode isolation, wave-specific rotation/counts/gold, real queue, single swept bolt, fixed warning/misses/retargeting, ranged-only mutual exclusion, safe AoE callbacks, zero knockback/stun, controls/timers/pause/recycle/scene cleanup');
