import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ShieldGuardBehavior from '../src/enemies/behaviors/ShieldGuardBehavior.js';
import StageSystem from '../src/systems/StageSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { ENEMIES, SHIELD_GUARD_TUNING as GUARD } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { TUNING } from '../src/config/tuning.js';
import { getEnemyMoveSpeed, getEnemyAttackDelay, isGravityReversalControlled } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen } from '../src/systems/EnemyColdControl.js';

const scene={runMode:'normal'},stage=new StageSystem(scene),catalog=JSON.stringify(ENEMIES);
for(const level of [1,6,10,19,100]) {
  stage.currentEnemyLevel=level;
  const cfg=stage.tunedEnemy('elite'),offset=level-1;
  assert.equal(cfg.name,'盾卫'); assert.equal(cfg.behavior,'shieldGuard');
  assert.equal(cfg.id,'elite'); assert.equal(cfg.kind,'elite');
  assert.equal(cfg.hp,Math.round(150*(1+offset*0.18)));
  assert.equal(cfg.damage,Math.round(6*(1+offset*0.03)));
  assert.equal(cfg.attackIntervalMs,2000); assert.equal(cfg.speed,ENEMIES.elite.speed);
  for(const mode of ['test',undefined]) {
    scene.runMode=mode;
    const legacy=stage.tunedEnemy('elite');
    assert.equal(legacy.name,'精英傀儡'); assert.equal(legacy.behavior,undefined);
    assert.equal(legacy.hp,Math.round(ENEMIES.elite.hp*TUNING.difficulty.eliteHpMultiplier*(1+offset*TUNING.leveling.enemyHpGrowthPerLevel)));
    assert.equal(legacy.damage,Math.round(ENEMIES.elite.damage*TUNING.difficulty.eliteDamageMultiplier*(1+offset*TUNING.leveling.enemyDamageGrowthPerLevel)));
    assert.equal(legacy.attackIntervalMs,ENEMIES.elite.attackIntervalMs);
  }
  scene.runMode='normal';
}
assert.equal(JSON.stringify(ENEMIES),catalog,'legacy catalog is never mutated');

function graphic() {
  const g={destroyed:false,rects:[],clear(){this.rects=[];return this;},
    fillRoundedRect(...args){this.rects.push(args);return this;},destroy(){this.destroyed=true;}};
  for(const key of ['setDepth','fillStyle','lineStyle','strokeRoundedRect','lineBetween'])g[key]=()=>g;
  return g;
}
function fixture() {
  const g=graphic(),hits=[];
  const e={x:500,y:400,width:74,height:105,active:true,kind:'elite',isElite:true,enemyId:'elite',
    behavior:'shieldGuard',hp:150,maxHp:150,damage:6,damageReduction:0,speed:216,
    attackRange:96,attackIntervalMs:2000,nextAttackAt:0};
  e.body={velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){e.x=x;e.y=y;}};
  const target={x:250,y:400,type:'player',live:true,isAlive(){return this.live;}};
  const s={runMode:'normal',now:0,getGameplayTime(){return this.now;},balance:BALANCE,
    enemies:[e],player:target,playerData:{hp:100,maxHp:100},add:{graphics:()=>g},floatText(){},
    eventBus:{emit(){}},targeting:{valid:v=>v?.active&&!v.isDefeated,isEnemyFullyInsideViewport:()=>true,shouldRecycleEnemyLeft:()=>false},
    tweens:{items:[],add(cfg){this.items.push(cfg);return {stop(){},remove(){}};}}};
  const combat=new CombatSystem(s);s.combatSystem=combat;
  const h={getEnemyAttackDelay,approach(_s,v){
    v.body.setVelocityX(Math.hypot(v.x-target.x,v.y-target.y)>v.attackRange?-getEnemyMoveSpeed(v,v.speed,s.now):0);
  },chooseTarget:()=>target.live&&Math.hypot(e.x-target.x,e.y-target.y)<=e.attackRange?target:null,
    targetDamage:(_s,victim,_e,damage,meta)=>hits.push({victim,damage,meta})};
  const b=new ShieldGuardBehavior(s,e,h);
  const tick=t=>{s.now=t;b.update(t);};
  return {e,g,s,target,h,hits,b,combat,tick};
}
{
  const f=fixture();f.tick(0);f.tick(GUARD.first-1);
  assert.equal(f.b.state,'idle');assert.equal(f.e.body.velocity.x,-216);
  f.tick(GUARD.first);assert.equal(f.b.state,'guard');
  assert.equal(f.e.damageReduction,0.5);assert.equal(f.e.body.velocity.x,-216*GUARD.moveMultiplier);
  f.target.x=430;f.e.nextAttackAt=0;f.tick(4000);assert.equal(f.hits.length,0,'no melee while guarding');
  f.combat.updateEnemyAttack(f.e,4000);assert.equal(f.s.playerData.hp,100,'no generic melee during guard');
  f.tick(4800);assert.equal(f.b.state,'idle');assert.equal(f.e.damageReduction,0);
  assert.equal(f.b.nextGuard,10000);assert.equal(f.hits.length,0,'lowering has a recovery window');
  f.tick(5149);assert.equal(f.hits.length,0);f.tick(5150);assert.equal(f.hits.length,1);
  assert.equal(f.hits[0].meta.source,'shieldGuardMelee');assert.equal(f.hits[0].damage,6);
  f.combat.updateEnemyAttack(f.e,5150);assert.equal(f.s.playerData.hp,100,'no second generic attack');
  f.tick(7150);assert.equal(f.hits.length,2,'ordinary attack cadence preserved');
  f.tick(10000);assert.equal(f.b.state,'guard');assert.equal(f.hits.length,2,'next guard also excludes melee');
}
{
  const f=fixture();f.target.x=430;f.tick(0);assert.equal(f.hits.length,1);
  f.tick(1999);assert.equal(f.hits.length,1);f.tick(2000);assert.equal(f.hits.length,2);
  f.target.live=false;f.tick(2100);assert.equal(f.hits.length,2,'dead target is never damaged');
  f.e.behavior=undefined;f.target.live=true;f.e.nextAttackAt=0;
  f.combat.updateEnemyAttack(f.e,2200);assert.equal(f.s.playerData.hp,94,'legacy generic melee still operates');
}
{
  const f=fixture();f.combat.damageEnemy(f.e,20,{source:'skill',tags:['magic'],noKnockback:true});
  assert.equal(f.e.hp,130);f.tick(0);f.tick(3000);
  f.combat.damageEnemy(f.e,20,{source:'attack',tags:['physical'],noKnockback:true});
  assert.equal(f.e.hp,120,'actual normal attack takes half damage during guard');
  f.combat.damageEnemy(f.e,20,{source:'skill',tags:['magic'],noKnockback:true});
  assert.equal(f.e.hp,110,'actual skill damage also uses guard reduction');
  assert(f.combat.applyKnockback(f.e,{knockback:72}),'guard is not knockback immune');
  const tween=f.s.tweens.items.at(-1);tween.targets.t=0.5;tween.onUpdate();
  assert.equal(tween.duration,440);assert.equal(f.e.y,376,'original lifted knockback arc');
  f.s.now=3500;f.b.interrupt(3500);assert.equal(f.b.state,'guard');assert.equal(f.b.until,4800,'hit never refreshes defense');
  tween.onComplete();assert.equal(f.e.x,525,'original elite knockback scale');assert.equal(f.e.y,400);
  f.s.now=4800;f.b.syncVisual();assert.equal(f.e.damageReduction,0,'expires even when only visual sync runs');
  f.combat.damageEnemy(f.e,20,{source:'skill',noKnockback:true});assert.equal(f.e.hp,90);
}
{
  const f=fixture();f.e.damageReduction=0.2;f.tick(0);f.tick(3000);
  assert.equal(f.e.damageReduction,0.6,'combine with existing reduction, do not overwrite it');
  f.b.onRecycle();assert.equal(f.e.damageReduction,0.2);assert.equal(f.b.nextGuard,null);
  f.tick(3100);assert.equal(f.b.nextGuard,6100);f.tick(6100);f.b.destroy();f.b.destroy();
  assert.equal(f.e.damageReduction,0.2);assert(f.g.destroyed);
}
{
  const f=fixture();f.tick(0);f.b.shiftTimers(1000,1000);
  f.tick(3000);assert.equal(f.b.state,'idle');f.tick(4000);assert.equal(f.b.until,5800);
  f.b.shiftTimers(500,4100);f.tick(5800);assert.equal(f.b.state,'guard');f.tick(6300);assert.equal(f.b.state,'idle');
}
{
  const f=fixture();f.target.x=430;
  f.h.targetDamage=()=>{f.hits.push(1);f.e.isDefeated=true;f.b.destroy();};
  f.tick(0);assert.equal(f.hits.length,1);assert.equal(f.b.graphics,null,'synchronous reflected death is safe');
}

// Exercise the real registry, viewport/control gates, pause, recycling and removal.
const code=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const Manager=vm.runInNewContext(code+'\nEnemyBehaviorManager',{
  ShieldGuardBehavior,MasterBehavior:class {},DoctorBehavior:class {},MeatBehavior:class {},
  Phaser:{Math:{Between:()=>0}},getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,isEnemyFrozen,
  updateGravityPull:()=>false,shiftEnemyColdTimers(){}
});
{
  const f=fixture();f.b.destroy();f.g.destroyed=false;
  const m=new Manager(f.s);m.attach(f.e);const b=m.items.get(f.e);
  assert(b instanceof ShieldGuardBehavior);
  const tick=t=>{f.s.now=t;m.update(t);};
  tick(0);tick(3000);assert.equal(b.state,'guard');
  f.e.isKnockbackActive=true;tick(4000);assert.equal(b.state,'guard');assert.equal(f.e.body.velocity.x,0);
  tick(4800);assert.equal(b.state,'idle');assert.equal(f.e.damageReduction,0);
  tick(10000);assert.equal(b.state,'idle','cannot newly raise shield during knockback');
  f.e.isKnockbackActive=false;tick(10001);assert.equal(b.state,'guard');
  f.e.coldSources=new Map([['test_freeze',{expiresAt:11000,frozenUntil:11000}]]);
  tick(10002);assert.equal(b.state,'idle','freeze interrupts guard');
  f.e.coldSources.clear();tick(15202);assert.equal(b.state,'guard');
  // GravityReversalSkill calls interruption BEFORE assigning the control field.
  m.interruptGravityReversal(f.e,15203);
  assert.equal(b.state,'idle');assert.equal(f.e.damageReduction,0,'no stale reduction when reversal starts');
  f.e.gravityReversalState={};
  tick(16000);assert.equal(f.e.body.velocity.x,0);delete f.e.gravityReversalState;
  tick(22000);assert.equal(b.state,'guard');m.pause();tick(23000);assert.equal(b.state,'guard');m.resume();
  f.e.isDefeated=true;tick(24000);assert.equal(m.items.size,0);assert(f.g.destroyed);assert.equal(f.e.damageReduction,0);
  f.e.isDefeated=false;f.e.behavior=undefined;f.s.runMode='test';m.attach(f.e);
  assert.equal(m.items.size,0,'test mode retains legacy generic elite');m.destroy();
}
// Real spawn -> createEnemy -> manager uses the profile, UI name, kind and registry.
{
  const node=(x=0,y=0,w=0,h=0)=>({x,y,width:w,height:h,active:true,
    setStrokeStyle(){return this;},setDepth(){return this;},setOrigin(){return this;},setPosition(){return this;},
    setVisible(){return this;},setAlpha(){return this;},setText(){return this;},add(){return this;},
    body:{setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}}});
  const f=fixture();f.b.destroy();f.s.enemies=[];
  f.s.physics={add:{existing(){}}};Object.assign(f.s.add,{rectangle:node,text:(x,y)=>node(x,y),container:node});
  const m=new Manager(f.s);f.s.enemyBehaviors=m;
  const stage=new StageSystem(f.s);stage.currentEnemyLevel=6;
  const e=stage.spawn('elite',600);assert.equal(e.hp,285);assert.equal(e.damage,7);assert.equal(e.name,'盾卫');
  assert.equal(e.isElite,true);assert.equal(e.isBoss,false);assert(m.items.get(e) instanceof ShieldGuardBehavior);
  m.destroy();
}
console.log('PASS shield guard growth/mode isolation, real spawn/registry, damage reduction, no duplicate melee, recovery, unchanged knockback, controls, timers, death and cleanup');
