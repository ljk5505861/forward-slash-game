import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import WarDrumPriestBehavior from '../src/enemies/behaviors/WarDrumPriestBehavior.js';
import DoctorBehavior from '../src/enemies/behaviors/DoctorBehavior.js';
import StageSystem,{ FLOW_GROUPS } from '../src/systems/StageSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { ENEMIES, WAR_DRUM_TUNING as DRUM } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen,shiftEnemyColdTimers } from '../src/systems/EnemyColdControl.js';

const scene={runMode:'normal'},stage=new StageSystem(scene),catalog=JSON.stringify(FLOW_GROUPS);
for(const level of [1,9,19,100]) {
  stage.currentEnemyLevel=level;const e=stage.tunedEnemy('elite_war_drum_priest'),offset=level-1;
  assert.equal(e.name,'战鼓祭司');assert.equal(e.kind,'elite');assert.equal(e.behavior,'healer');
  assert.equal(e.hp,Math.round(68*(1+offset*0.08)));assert.equal(e.damage,Math.round(3*(1+offset*0.03)));
  assert.equal(e.attackIntervalMs,2600);assert.equal(e.speed,360);assert.equal(e.attackRange,480);
}
let first=null,gold=0,oldGold=0;
for(const group of FLOW_GROUPS)for(let wave=0;wave<4;wave+=1) {
  stage.currentGroup=group.group;scene.runMode='normal';
  const items=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);
  scene.runMode='test';const legacy=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);
  const expected=group.group>=9&&group.group%3===0&&group.ids[wave].includes('elite')?1:0;
  assert.equal(items.filter(v=>v.id==='elite_war_drum_priest').length,expected);
  assert.equal(items.length,group.waves[wave]);assert.equal(items.length,legacy.length);
  assert.deepEqual(items.map(v=>['elite_sharpshooter','elite_war_drum_priest','elite_berserker'].includes(v.id)?'elite':v.id).sort(),legacy.map(v=>v.id).sort());
  assert(!legacy.some(v=>['elite_sharpshooter','elite_war_drum_priest','elite_berserker'].includes(v.id)));
  const index=items.findIndex(v=>v.id==='elite_war_drum_priest');
  if(index>=0){first??=`${group.group}-${wave+1}`;assert.equal(items[index].role,'back');assert(items.slice(index+1).every(v=>v.role==='back'));}
  if(wave<3) {
    const income=arr=>arr.reduce((n,v)=>n+(ENEMIES[v.id].kind==='elite'?15:1),0);
    gold+=income(items);oldGold+=income(legacy);
  }
}
assert.equal(first,'9-3');assert.equal(gold,oldGold);assert.equal(JSON.stringify(FLOW_GROUPS),catalog);

function fixture() {
  const graphics=[];
  const graphic=()=>{
    const g={destroyed:false,destroy(){this.destroyed=true;}};
    for(const name of ['setDepth','clear','lineStyle','lineBetween','strokeRect'])g[name]=()=>g;
    graphics.push(g);return g;
  };
  const cfg=id=>{scene.runMode='normal';stage.currentEnemyLevel=1;return stage.tunedEnemy(id);};
  const enemy=(id,x=500)=>{
    const v={...cfg(id),enemyId:id,x,y:400,active:true,isDefeated:false,isElite:ENEMIES[id].kind==='elite',isBoss:ENEMIES[id].kind==='boss',nextAttackAt:0};
    v.maxHp=v.hp;v.baseAttackIntervalMs=v.attackIntervalMs;
    v.body={velocity:{x:0},setVelocityX(n){this.velocity.x=n;},reset(x,y){v.x=x;v.y=y;}};return v;
  };
  const e=enemy('elite_war_drum_priest'),ally=enemy('archer',350),target={x:150,y:400,live:true,isAlive(){return this.live;}};
  const hits=[],s={runMode:'normal',now:0,getGameplayTime(){return this.now;},enemies:[e,ally],player:target,
    playerData:{hp:100,maxHp:100},balance:BALANCE,add:{graphics:graphic},floatText(){},eventBus:{emit(){}},
    targeting:{valid:v=>v?.active&&!v.isDefeated,isEnemyFullyInsideViewport:v=>!v.offscreen,
      shouldRecycleEnemyLeft:()=>false,getEnemyRightRespawnX:()=>900}};
  s.combatSystem={getOrLockEnemyTarget:()=>target.live?target:null,
    chooseEnemyAttackTarget:(v,range)=>target.live&&Math.hypot(v.x-target.x,v.y-target.y)<=range?target:null,
    damageAttackTarget:(victim,damage,meta)=>hits.push({victim,damage,meta})};
  const h={getEnemyAttackDelay,approach(_s,v){v.body.setVelocityX(Math.hypot(v.x-target.x,v.y-target.y)>v.attackRange?-getEnemyMoveSpeed(v,v.speed,s.now):0);},
    chooseTarget:(_s,v,range)=>s.combatSystem.chooseEnemyAttackTarget(v,range),
    targetDamage:(_s,victim,_e,damage,meta)=>hits.push({victim,damage,meta})};
  const b=new WarDrumPriestBehavior(s,e,h),tick=t=>{s.now=t;b.update(t);};
  const cast=()=>{tick(0);tick(DRUM.first);tick(DRUM.first+DRUM.windup);};
  return {s,e,ally,target,h,hits,b,tick,cast,enemy,graphics};
}
{
  const f=fixture(),e=f.ally,base=e.attackIntervalMs;
  f.e.x=210;e.x=200;const hp=e.hp,speed=e.speed,damage=e.damage;e.nextAttackAt=5000;
  f.tick(0);assert.equal(f.hits.length,1,'nearby self defense is allowed');
  f.tick(3500);assert.equal(f.b.state,'windup');assert.equal(f.hits.length,1,'windup starts instead of melee');
  f.tick(4099);assert.equal(e.attackIntervalMs,base);
  f.tick(4100);assert.equal(f.b.state,'recovery');assert.equal(e.attackIntervalMs,1667);
  assert.equal(e.baseAttackIntervalMs,base);assert.equal(e.nextAttackAt,5000,'no retroactive/free attack');
  assert.equal(e.hp,hp);assert.equal(e.speed,speed);assert.equal(e.damage,damage);assert.equal(f.hits.length,1);
  assert.equal(getEnemyAttackDelay(e,e.attackIntervalMs,4100),1667,'live attack delay reads buffed interval');
  e.gravitySources=new Map([['slow',{expiresAt:9000,attackSlow:0.5}]]);
  assert.equal(getEnemyAttackDelay(e,e.attackIntervalMs,4200),3334,'existing slows still apply');
  f.tick(4500);assert.equal(f.b.state,'idle');assert.equal(f.b.nextDrum,10500);assert.equal(f.hits.length,1);
  f.tick(7099);assert.equal(e.attackIntervalMs,1667);f.tick(7100);assert.equal(e.attackIntervalMs,base);assert(!e.warDrumBuff);
  const beforeDead=f.hits.length;f.target.live=false;f.tick(12000);f.tick(12600);assert.equal(f.hits.length,beforeDead,'dead target receives no melee');f.b.destroy();
}
{
  const f=fixture(),shield=f.enemy('elite',420),boss=f.enemy('boss',420),dead=f.enemy('grunt',420),far=f.enemy('charger',1100),off=f.enemy('grunt',420);
  dead.isDefeated=true;off.offscreen=true;f.s.enemies.push(shield,boss,dead,far,off);
  const values=f.s.enemies.map(v=>v.attackIntervalMs);f.cast();
  assert.equal(f.b.buffed.size,1);f.s.enemies.forEach((v,i)=>{if(v!==f.ally)assert.equal(v.attackIntervalMs,values[i]);});
  f.ally.isDefeated=true;f.b.syncVisual();assert.equal(f.b.buffed.size,0);assert.equal(f.ally.attackIntervalMs,2000);f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(3500);f.ally.active=false;f.tick(4100);
  assert.equal(f.b.state,'idle');assert.equal(f.b.nextDrum,3500,'no allies on release does not spend cooldown');
  f.ally.active=true;f.tick(4200);f.tick(4800);assert.equal(f.ally.attackIntervalMs,1667);f.b.destroy();
}
{
  const f=fixture(),other=f.enemy('elite_war_drum_priest',480),b=new WarDrumPriestBehavior(f.s,other,f.h);
  f.s.enemies.push(other);f.cast();b.pulse([f.ally],5000);
  assert.equal(f.ally.attackIntervalMs,1667,'two priests never multiply attack speed');
  f.s.now=7100;f.b.syncVisual();assert.equal(f.ally.attackIntervalMs,1667,'later independent source remains');
  f.s.now=8000;b.syncVisual();assert.equal(f.ally.attackIntervalMs,2000);assert(!f.ally.warDrumBuff);
  f.b.pulse([f.ally],9000);b.pulse([f.ally],9000);f.b.destroy();assert.equal(f.ally.attackIntervalMs,1667);
  b.destroy();b.destroy();assert.equal(f.ally.attackIntervalMs,2000);assert(!f.ally.warDrumBuff);
}
{
  const f=fixture();f.cast();f.b.shiftTimers(1000,4200);
  f.s.now=7100;f.b.syncVisual();assert.equal(f.ally.attackIntervalMs,1667);
  f.s.now=8100;f.b.syncVisual();assert.equal(f.ally.attackIntervalMs,2000);
  f.b.pulse([f.ally],8200);f.b.onRecycle();assert.equal(f.ally.attackIntervalMs,2000);assert.equal(f.b.nextDrum,null);
  f.b.pulse([f.ally],9000);f.e.isDefeated=true;f.b.syncVisual();assert.equal(f.ally.attackIntervalMs,2000);f.b.destroy();
}
// Real doctor keeps heal timing/amount, but its fallback melee can gain attack speed.
{
  const f=fixture(),doctor=f.enemy('healer',400);f.s.enemies.push(doctor);f.ally.hp-=20;
  f.b.pulse([doctor],0);const d=new DoctorBehavior(f.s,doctor,f.h);
  d.update(0);assert.equal(d.next,2800);f.s.now=2333;d.update(2333);assert.equal(f.ally.hp,f.ally.maxHp-20);
  f.s.now=2800;d.update(2800);assert.equal(f.ally.hp,f.ally.maxHp-8);assert.equal(d.next,5600);
  f.ally.hp=f.ally.maxHp;doctor.x=210;d.next=0;f.s.now=2900;d.update(2900);
  assert.equal(f.hits.length,1);assert.equal(d.next,5233,'fallback melee uses attack speed');
  f.ally.hp-=20;f.s.now=5233;d.update(5233);assert.equal(f.ally.hp,f.ally.maxHp-20,'melee cooldown cannot accelerate next heal');
  f.s.now=5700;d.update(5700);assert.equal(f.ally.hp,f.ally.maxHp-8);d.destroy();f.b.destroy();
}

const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',{
  WarDrumPriestBehavior,DoctorBehavior,SharpshooterBehavior:class {},ShieldGuardBehavior:class {},MasterBehavior:class {},MeatBehavior:class {},
  Phaser:{Math:{Between:()=>0}},getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,isEnemyFrozen,updateGravityPull,shiftEnemyColdTimers
});
for(const control of ['knockback','freeze','gravity']) {
  const f=fixture();f.b.destroy();const m=new Manager(f.s);m.attach(f.e);const b=m.items.get(f.e);
  assert(b instanceof WarDrumPriestBehavior);const tick=t=>{f.s.now=t;m.update(t);};tick(0);tick(3500);
  if(control==='knockback')f.e.isKnockbackActive=true;
  if(control==='freeze')f.e.coldSources=new Map([['freeze',{expiresAt:9000,frozenUntil:9000}]]);
  if(control==='gravity'){m.interruptGravityReversal(f.e,3600);f.e.gravityReversalState={};}
  tick(3600);assert.equal(b.state,'idle');assert.equal(b.nextDrum,3500,'unreleased pulse stays ready');
  f.e.isKnockbackActive=false;f.e.coldSources?.clear();delete f.e.gravityReversalState;
  tick(4000);tick(4600);assert.equal(f.ally.attackIntervalMs,1667);
  if(control==='gravity'){m.interruptGravityReversal(f.e,4700);f.e.gravityReversalState={};}else if(control==='freeze')f.e.coldSources.set('freeze',{expiresAt:9000,frozenUntil:9000});else f.e.isKnockbackActive=true;
  tick(4700);assert.equal(f.ally.attackIntervalMs,2000,'control clears already-cast buff');
  f.e.isKnockbackActive=false;f.e.coldSources?.clear();delete f.e.gravityReversalState;
  b.pulse([f.ally],5000);m.pause();tick(5200);assert.equal(f.ally.attackIntervalMs,1667);m.resume();
  m.recycleEnemy(f.e);assert.equal(f.e.x,900);assert.equal(f.ally.attackIntervalMs,2000);
  b.pulse([f.ally],6000);f.e.isDefeated=true;tick(6100);assert.equal(f.ally.attackIntervalMs,2000);assert.equal(m.items.size,0);
  assert(f.graphics.at(-1).destroyed);m.destroy();
}
// Generic combat must not add a second melee; reflected synchronous death is safe.
{
  const f=fixture();f.e.x=210;const combat=new CombatSystem(f.s);
  combat.updateEnemyAttack(f.e,0);assert.equal(f.s.playerData.hp,100);
  f.b.pulse([f.ally],0);f.h.targetDamage=()=>{f.hits.push(1);f.e.isDefeated=true;f.b.destroy();};
  f.tick(0);assert.equal(f.hits.length,1);assert.equal(f.ally.attackIntervalMs,2000);assert.equal(f.b.graphics,null);
}
// Real spawn -> createEnemy -> registry, plus unchanged legacy healer dispatch.
{
  const f=fixture();f.b.destroy();f.s.enemies=[];
  const node=(x=0,y=0,w=0,h=0)=>({x,y,width:w,height:h,active:true,
    setStrokeStyle(){return this;},setDepth(){return this;},setOrigin(){return this;},setPosition(){return this;},
    setVisible(){return this;},setAlpha(){return this;},setText(){return this;},add(){return this;},
    body:{setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}}});
  f.s.physics={add:{existing(){}}};Object.assign(f.s.add,{rectangle:node,text:(x,y)=>node(x,y),container:node});
  const m=new Manager(f.s);f.s.enemyBehaviors=m;const st=new StageSystem(f.s);st.currentEnemyLevel=9;
  const e=st.spawn('elite_war_drum_priest',600);assert.equal(e.hp,112);assert.equal(e.damage,4);assert.equal(e.name,'战鼓祭司');assert(e.isElite);
  assert(m.items.get(e) instanceof WarDrumPriestBehavior);m.destroy();
  f.s.runMode='test';const healer=f.enemy('healer');healer.behavior='healer';m.attach(healer);
  assert.equal(m.items.get(healer).constructor.name,'HealerBehavior');m.destroy();
}
console.log('PASS war drum growth/real spawn/mode isolation, unchanged counts/gold, windup/recovery, ordinary-only attack speed, no stacking, source expiry, slows, no heal acceleration, controls, pause/recycle/death/scene cleanup and synchronous reflected death');
