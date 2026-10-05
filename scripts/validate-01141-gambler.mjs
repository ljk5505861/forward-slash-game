import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import GamblerBehavior from '../src/enemies/behaviors/GamblerBehavior.js';
import StageSystem,{ FLOW_GROUPS } from '../src/systems/StageSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { ENEMIES,GAMBLER_TUNING as CARD } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen,shiftEnemyColdTimers } from '../src/systems/EnemyColdControl.js';

function fixture() {
  const g={destroyed:false,circles:[],clear(){this.circles=[];return this;},strokeCircle(...p){this.circles.push(p);return this;},destroy(){this.destroyed=true;}};
  for(const name of ['setDepth','lineStyle','lineBetween','strokeRect'])g[name]=()=>g;
  const e={...ENEMIES.elite_gambler,enemyId:'elite_gambler',isElite:true,x:500,y:400,active:true,nextAttackAt:0};
  e.body={velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){e.x=x;e.y=y;}};
  const target={type:'player',x:150,y:400,live:true,isAlive(){return this.live;}},targets=[target],hits=[];
  const s={runMode:'normal',now:0,getGameplayTime(){return this.now;},enemies:[e],player:target,playerData:{hp:100,maxHp:100},balance:BALANCE,
    add:{graphics:()=>g},hud:{update(){}},floatText(){},eventBus:{emit(){}},
    targeting:{valid:v=>v?.active&&!v.isDefeated,isEnemyFullyInsideViewport:()=>true,shouldRecycleEnemyLeft:()=>false,getEnemyRightRespawnX:()=>900}};
  const choose=(v,range)=>targets.find(t=>t.isAlive()&&Math.hypot(v.x-t.x,v.y-t.y)<=range);
  s.combatSystem={getAttackableTargets:()=>targets,getOrLockEnemyTarget:()=>targets.find(t=>t.isAlive()),chooseEnemyAttackTarget:choose,
    damageAttackTarget:(target,damage,meta)=>hits.push({target,damage,meta,t:s.now})};
  const h={getEnemyAttackDelay,chooseTarget:(_s,v,r)=>choose(v,r),
    approach(_s,v){v.body.setVelocityX(Math.hypot(v.x-target.x,v.y-target.y)>v.attackRange?-getEnemyMoveSpeed(v,v.speed,s.now):0);},
    targetDamage:(_s,target,_e,damage,meta)=>hits.push({target,damage,meta,t:s.now})};
  const b=new GamblerBehavior(s,e,h);return {s,e,g,target,targets,h,hits,b,tick(t){s.now=t;b.update(t);}};
}
{
  const f=fixture();let at=0;
  for(let i=1;i<=4;i++) {
    if(i===4)f.targets.push({x:120,y:400,isAlive:()=>true},{x:250,y:500,isAlive:()=>true});
    f.tick(at);assert.equal(f.b.state,'windup');assert.equal(f.e.body.velocity.x,0);
    const wind=i===4?CARD.explosiveWindup:CARD.windup;f.tick(at+wind-1);assert.equal(f.b.card,null);
    f.tick(at+wind);assert.equal(f.b.card.explosive,i===4);assert.equal(f.hits.length,i-1,'no instant damage');
    f.tick(at+wind+CARD.flight);assert.equal(f.b.card,null);
    if(i<4){assert.equal(f.hits.length,i);assert.equal(f.hits.at(-1).damage,7);assert.equal(f.hits.at(-1).meta.source,'gamblerCard');}
    at=f.b.nextThrow;
  }
  assert.equal(f.hits.length,5,'explosive card replaces direct hit with two area hits');
  assert.deepEqual(f.hits.slice(3).map(v=>v.damage),[9,9]);assert(f.hits.slice(3).every(v=>v.meta.source==='gamblerExplosion'&&v.meta.singleTarget===false));
  assert(f.hits.every(v=>v.meta.knockbackDistance===0));assert.equal(f.b.cardsThrown,0);assert.equal(f.b.nextIsExplosive(),false);
  f.tick(f.s.now+1);assert.equal(f.hits.length,5,'no repeated explosion');assert(f.g.circles.length>0);
  f.tick(f.b.flashUntil);assert.equal(f.g.circles.length,0,'no lingering ground effect');f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(350);const nearer={x:300,y:400,isAlive:()=>true};f.targets.push(nearer);f.tick(800);
  assert.equal(f.hits.length,1);assert.equal(f.hits[0].target,nearer,'large-frame sweep hits first collision');f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(350);f.target.y=800;f.tick(800);assert.equal(f.hits.length,0,'normal card does not track a moving target');
  assert.equal(f.b.cardsThrown,1,'released miss still counts');f.b.cardsThrown=3;f.target.y=400;f.tick(2650);f.tick(3300);
  const endpoint={...f.b.card.to};f.target.y=800;f.tick(3750);assert.equal(f.hits.length,0);assert.deepEqual(f.b.impact,endpoint,'missed explosive card bursts at its fixed range endpoint');f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.target.live=false;f.tick(350);assert.equal(f.b.cardsThrown,0);assert.equal(f.b.nextThrow,0);assert.equal(f.b.card,null,'target death before release spends nothing');
  const other={x:250,y:400,isAlive:()=>true};f.targets.push(other);f.tick(351);f.tick(701);f.tick(1151);
  assert.equal(f.hits[0].target,other,'next launch reacquires valid target');f.b.destroy();
}
for(const invalidation of ['caster','scene','target','move']) {
  const f=fixture();f.b.cardsThrown=3;f.tick(0);f.tick(650);
  const other={x:120,y:400,live:true,isAlive(){return this.live;}};f.targets.push(other);
  f.h.targetDamage=(_s,target)=>{f.hits.push(target);if(invalidation==='target')other.live=false;
    else if(invalidation==='move')other.y=800;
    else {if(invalidation==='caster')f.e.isDefeated=true;f.b.destroy();}};
  f.tick(1100);assert.equal(f.hits.length,1,'revalidate targets/caster after synchronous callback');assert.equal(f.b.card,null);f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.b.shiftTimers(1000,100);f.tick(350);assert.equal(f.b.card,null);f.tick(1350);assert(f.b.card);
  f.b.shiftTimers(500,1400);f.tick(1800);assert.equal(f.hits.length,0);f.tick(2300);assert.equal(f.hits.length,1);f.b.destroy();
}

const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',{
  GamblerBehavior,ShieldGuardBehavior:class {},MeatBehavior:class {},
  Phaser:{Math:{Between:()=>0}},getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,isEnemyFrozen,updateGravityPull,shiftEnemyColdTimers
});
for(const control of ['knockback','freeze','gravity'])for(const phase of ['windup','flight']) {
  const f=fixture();f.b.destroy();f.g.destroyed=false;const m=new Manager(f.s);m.attach(f.e);const b=m.items.get(f.e);
  b.cardsThrown=3;const tick=t=>{f.s.now=t;m.update(t);};tick(0);if(phase==='flight')tick(650);
  if(control==='knockback')f.e.isKnockbackActive=true;
  if(control==='freeze')f.e.coldSources=new Map([['freeze',{expiresAt:9000,frozenUntil:9000}]]);
  if(control==='gravity'){m.interruptGravityReversal(f.e,700);f.e.gravityReversalState={};}
  tick(700);tick(1100);assert.equal(b.card,null);assert.equal(f.hits.length,0);
  assert.equal(b.cardsThrown,phase==='windup'?3:0);
  assert.equal(b.nextThrow,phase==='windup'?0:2950+(control==='gravity'?400:0),'unreleased card spends nothing; gravity holds existing cooldown for its control duration');
  f.e.isKnockbackActive=false;f.e.coldSources?.clear();delete f.e.gravityReversalState;
  m.recycleEnemy(f.e);assert.equal(f.e.x,900);assert.equal(b.cardsThrown,phase==='windup'?3:0,'recycle retains released-card count');assert.equal(b.impact,null);
  m.pause();tick(99999);assert.equal(b.state,'idle');m.resume();f.e.isDefeated=true;tick(100000);assert.equal(m.items.size,0);assert(f.g.destroyed);m.destroy();
}
{
  const f=fixture(),combat=new CombatSystem(f.s);f.s.combatSystem=combat;
  const wolf={type:'spiritWolf',x:120,y:400,hp:30,isAlive(){return this.hp>0;},takeDamage(d){this.hp-=d;}};
  f.s.skillSystem={passiveState:{spiritWolves:{wolves:[wolf]}},beforePlayerDamage(){},beforePlayerHpDamage(){}};
  f.s.player.setX=()=>assert.fail('gambler cannot knock back player');
  f.h.targetDamage=(_s,target,e,d,meta)=>combat.damageAttackTarget(target,d,{enemy:e,...meta});
  combat.updateEnemyAttack(f.e,0);assert.equal(f.s.playerData.hp,100,'no extra generic melee');
  f.b.cardsThrown=3;f.tick(0);f.tick(650);f.tick(1100);assert.equal(f.s.playerData.hp,91);assert.equal(wolf.hp,21);
  assert.equal(f.s.player.stunnedUntil,undefined);assert.equal(f.s.player.x,150);f.b.destroy();
}
{
  const f=fixture();f.b.destroy();f.s.enemies=[];
  const node=(x=0,y=0,w=0,h=0)=>({x,y,width:w,height:h,active:true,
    setStrokeStyle(){return this;},setDepth(){return this;},setOrigin(){return this;},setPosition(){return this;},setVisible(){return this;},setAlpha(){return this;},setText(){return this;},add(){return this;},
    body:{setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}}});
  f.s.physics={add:{existing(){}}};Object.assign(f.s.add,{rectangle:node,text:(x,y)=>node(x,y),container:node});
  const m=new Manager(f.s);f.s.enemyBehaviors=m;const st=new StageSystem(f.s);st.currentEnemyLevel=13;
  const e=st.spawn('elite_gambler',600);assert.equal(e.name,'赌师');assert.equal(e.hp,96);assert.equal(e.damage,16);assert(m.items.get(e) instanceof GamblerBehavior);m.destroy();
  f.s.runMode='test';m.attach({...e,enemyId:'archer'});assert.equal(m.items.values().next().value.constructor.name,'ArcherBehavior');m.destroy();
}

const scene={runMode:'normal'},stage=new StageSystem(scene),catalog=JSON.stringify(FLOW_GROUPS);
const newIds=['elite_gambler','elite_golden_guard','elite_hell_envoy','elite_thunder_mage','elite_berserker','elite_war_drum_priest','elite_sharpshooter'];
for(const level of [1,13,19,100]) {
  stage.currentEnemyLevel=level;const e=stage.tunedEnemy('elite_gambler'),offset=level-1;
  assert.equal(e.hp,Math.round(60*(1+offset*.05)));assert.equal(e.damage,Math.round(7*(1+offset*.11)));
  assert.equal(e.attackIntervalMs,Math.round(2300/(1+Math.min(.15,offset*.01))));assert.equal(e.attackRange,480);assert.equal(e.speed,360);
}
let first=null,gold=0,oldGold=0;
for(const group of FLOW_GROUPS)for(let wave=0;wave<4;wave++) {
  stage.currentGroup=group.group;stage.currentWave=wave+1;scene.runMode='normal';
  const items=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);scene.runMode='test';
  const legacy=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);
  const expected=wave===1&&group.group>=13&&group.group%3===1?1:0;
  assert.equal(items.filter(e=>e.id==='elite_gambler').length,expected);assert.equal(items.length,legacy.length);
  assert.deepEqual(items.map(e=>newIds.includes(e.id)?'elite':e.id).sort(),legacy.map(e=>e.id).sort());assert(!legacy.some(e=>newIds.includes(e.id)));
  if(expected){first??=`${group.group}-${wave+1}`;assert.equal(items.find(e=>e.id==='elite_gambler').role,'back');}
  if(wave<3){const income=arr=>arr.reduce((n,v)=>n+(ENEMIES[v.id].kind==='elite'?15:1),0);gold+=income(items);oldGold+=income(legacy);}
}
assert.equal(first,'13-2');assert.equal(gold,oldGold);assert.equal(JSON.stringify(FLOW_GROUPS),catalog);
{
  const s={runMode:'normal',balance:BALANCE,enemies:[],eventBus:{emit(){}},hud:{setStage(){},update(){}}},st=new StageSystem(s);
  st.groupIndex=12;st.currentWave=1;st.queueGroupWave(0);assert.equal(st.waveQueue.filter(v=>v.id==='elite_gambler').length,1);
}
console.log('PASS gambler growth/spawn/mode/rotation/counts/gold, timed fourth-card explosion replacing direct hit, real swept collision/misses/endpoint burst, safe AoE callbacks, no tracking/knockback/stun/ground residue, no melee, controls/timers/pause/recycle/scene cleanup');
