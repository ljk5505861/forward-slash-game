import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ThornlessRoseBehavior from '../src/enemies/behaviors/ThornlessRoseBehavior.js';
import MountainGeneralBehavior from '../src/enemies/behaviors/MountainGeneralBehavior.js';
import CombatSystem,{ isBossUsingSkill, NORMAL_ATTACK_KNOCKBACK_DURATION_MS } from '../src/systems/CombatSystem.js';
import StageSystem,{ LevelFlowStates as F } from '../src/systems/StageSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import { THORNLESS_ROSE_TUNING as R } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen,shiftEnemyColdTimers,applyEnemyCold } from '../src/systems/EnemyColdControl.js';

// Run the actual manager with Phaser's rendering import replaced by a minimal node shim.
const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ')
  .replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const imports={ ThornlessRoseBehavior,MountainGeneralBehavior,getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,
  updateGravityPull,isEnemyFrozen,shiftEnemyColdTimers,Phaser:{Math:{Between:()=>0}} };
for(const name of ['MeatBehavior','DoctorBehavior','MasterBehavior','ShieldGuardBehavior','SharpshooterBehavior',
  'WarDrumPriestBehavior','EliteBerserkerBehavior','ThunderMageBehavior','HellEnvoyBehavior','HellSummonBehavior',
  'GamblerBehavior','GoldenHallGuardBehavior'])imports[name]=class {};
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',imports);

function node(x=0,y=0,w=0,h=0) {
  const n={x,y,width:w,height:h,active:true,alpha:1,circles:[],
    destroy(){this.active=false;this.destroyed=true;},setX(x){this.x=x;return this;},
    setPosition(x,y){this.x=x;this.y=y;return this;},setText(text){this.text=text;return this;},
    setFillStyle(color){this.color=color;return this;},add(){return this;},
    clear(){this.circles=[];return this;},strokeCircle(x,y,r){this.circles.push({x,y,r});return this;}};
  for(const key of ['setStrokeStyle','setDepth','setOrigin','setVisible','setAlpha','setScale','setDisplaySize',
    'lineStyle','lineBetween','strokeRect'])n[key]=()=>n;
  n.body={velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){n.x=x;n.y=y;},
    setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}};
  return n;
}
function fixture(mode='normal',boss=false) {
  const graphics=[],tweens=[],hits=[],events=[],heals=[];
  const s={runMode:mode,now:0,paused:false,balance:BALANCE,enemies:[],killCount:0,player:node(350,400,50,80),
    playerData:{hp:500,maxHp:500,baseMaxHp:500,baseAttack:20,baseDefense:0},
    cameras:{main:{worldView:{x:0,width:720},width:720,scrollX:0}},
    getGameplayTime(){return this.now;},isGameplayPaused(){return this.paused;},
    hud:{update(){},setStatus(text){s.status=text;}},floatText(x,y,text){if(text.startsWith('+'))heals.push(text);},
    finishRun(){s.paused=true;s.enemyBehaviors.destroy();},physics:{add:{existing(){}}},events:{on(){},once(){},off(){}},
    eventBus:{emit(type,meta){events.push({type,meta});}},
    add:{rectangle:node,text:(x,y)=>node(x,y),container:node,circle:node,ellipse:node,
      graphics:()=>{const g=node();graphics.push(g);return g;}},
    tweens:{add(config){const item={config,stopped:false,stop(){this.stopped=true;},remove(){},pause(){},resume(){}};tweens.push(item);return item;}}};
  s.targeting=new TargetingSystem(s);s.combatSystem=new CombatSystem(s);
  const damage=s.combatSystem.damageAttackTarget.bind(s.combatSystem);
  s.combatSystem.damageAttackTarget=(target,amount,meta)=>{
    const result=damage(target,amount,meta);hits.push({target,amount,meta,result,t:s.now});return result;
  };
  s.enemyBehaviors=new Manager(s);
  const stage=new StageSystem(s);s.stageSystem=stage;stage.currentEnemyLevel=7;
  if(boss){stage.activeRush='boss2';stage.spawnBoss('boss2');}
  else stage.spawn('thornless_rose',500);
  const e=s.enemies[0];e.x=500;e.y=400;
  const b=s.enemyBehaviors.items.get(e);
  return {s,e,b,stage,graphics,tweens,hits,events,heals,tick(t){s.now=t;s.enemyBehaviors.update(t);stage.updateBossKnockbackCounterattacks(t);},
    destroy(){s.combatSystem.clearAllKnockbacks();s.enemyBehaviors.destroy();}};
}
const sources=f=>f.hits.map(h=>h.meta.source);
const isolate=(f,skill)=>{for(const name of ['Dash','Rose','Drain'])if(name.toLowerCase()!==skill)f.b['next'+name]=Infinity;};
const begin=(f,skill)=>{isolate(f,skill);f.tick(R[skill+'First']);assert.equal(f.b.state,skill+'Windup');};
const release=(f,skill)=>{begin(f,skill);f.tick(R[skill+'First']+R[skill+'Windup']);};
const wolf=(x=350,y=400)=>({type:'spiritWolf',x,y,hp:100,active:true,view:node(x,y),hpBarBg:node(x,y-50),hpBar:node(x-20,y-50),
  isAlive(){return this.active&&this.hp>0;},takeDamage(n){this.hp=Math.max(0,this.hp-n);}});
const addWolves=(f,wolves)=>{f.s.skillSystem={beforePlayerDamage(){},beforePlayerHpDamage(){},passiveState:{spiritWolves:{wolves}}};};

// Real Boss 2 spawn, modes, title/reward identity, and exact legacy first-fight HP/damage.
for(const mode of ['normal','test']) {
  const f=fixture(mode,true),e=f.e;
  assert.equal(e.enemyId,mode==='normal'?'thornless_rose':'mid_boss');
  assert.equal(e.name,mode==='normal'?'无刺蔷薇':'铁甲暴君');assert.equal(e.hp,1651);assert.equal(e.damage,14);
  assert.equal(e.attackIntervalMs,mode==='normal'?2000:1450);assert(e.isMidBoss&&!e.isFinalBoss);
  assert.equal(e.flowBossType,'boss2');assert.equal(f.stage.flowState,F.BOSS_FIGHT);
  assert.equal(f.b instanceof ThornlessRoseBehavior,mode==='normal');
  assert.match(f.s.status,mode==='normal'?/无刺蔷薇/:/铁甲暴君/);
  assert.equal(f.events.find(v=>v.meta?.kind==='boss').meta.bossId,e.enemyId);
  let reward;f.s.queueArtifactReward=value=>{reward=value;};f.stage.onBossKilled('boss2');
  assert.match(reward.name,mode==='normal'?/无刺蔷薇/:/铁甲暴君/);f.destroy();
}
{
  const f=fixture();
  for(const level of [1,7,19,100]) {
    f.stage.currentEnemyLevel=level;const e=f.stage.tunedEnemy('thornless_rose');
    assert.equal(e.hp,Math.round(960*(1+(level-1)*.12)));assert.equal(e.damage,Math.round(11*(1+(level-1)*.04)));
    assert.equal(e.attackIntervalMs,2000);assert.equal(e.attackRange,150);assert.equal(e.speed,300);
  }
  f.destroy();
}
// Ordinary attack owns its cadence; no generic melee/enrage duplicates it.
{
  const f=fixture();f.tick(0);assert.equal(f.b.state,'attackWindup');assert(!isBossUsingSkill(f.e));
  f.tick(R.attackWindup-1);assert.equal(f.hits.length,0);f.tick(R.attackWindup);
  assert.deepEqual(sources(f),['thornlessRoseStab']);assert.equal(f.s.playerData.hp,486);
  f.e.hp=100;f.s.combatSystem.updateEnemyAttack(f.e,1000);assert.equal(f.hits.length,1);assert(!f.e.enraged);
  assert.equal(f.b.nextAttack,R.attackWindup+2000);f.destroy();
}
for(const replacement of [false,true])for(const skill of ['normal','drain']) {
  const f=fixture();if(skill==='normal')f.tick(0);else begin(f,skill);
  f.s.playerData.hp=0;const w=wolf(370);if(replacement)addWolves(f,[w]);
  f.tick(skill==='normal'?R.attackWindup:R.drainFirst+R.drainWindup);
  assert.equal(f.hits.length,replacement?1:0,'cast reacquires a living replacement only');
  if(replacement)assert.equal(f.hits[0].target,w);
  else assert.equal(skill==='normal'?f.b.nextAttack:f.b.nextDrain,skill==='normal'?0:R.drainFirst,'empty cast spends no cooldown');
  f.destroy();
}
for(const skill of ['normal','drain']) {
  const f=fixture();if(skill==='normal')f.tick(0);else begin(f,skill);
  f.s.player.x=200;f.tick(skill==='normal'?R.attackWindup:R.drainFirst+R.drainWindup);
  assert.equal(f.hits.length,0);assert.equal(skill==='normal'?f.b.nextAttack:f.b.nextDrain,skill==='normal'?0:R.drainFirst);f.destroy();
}
for(const skill of ['dash','rose','drain']) {
  const f=fixture();isolate(f,skill);f.s.playerData.hp=0;f.tick(99999);
  assert.equal(f.b['next'+skill[0].toUpperCase()+skill.slice(1)],R[skill+'First']);assert(!isBossUsingSkill(f.e));f.destroy();
}
// Each skill is independently available, updates only its own clock, and preempts ordinary knockback on time.
for(const skill of ['dash','rose','drain']) {
  const f=fixture();isolate(f,skill);f.tick(0);f.s.combatSystem.applyKnockback(f.e,{knockback:72});
  f.tick(R[skill+'First']);assert.equal(f.b.state,skill+'Windup');assert(!f.e.isKnockbackActive);
  assert(!f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  f.tick(R[skill+'First']+R[skill+'Windup']);
  assert.equal(f.b['next'+skill[0].toUpperCase()+skill.slice(1)],R[skill+'First']+R[skill+'Windup']+R[skill+'Cooldown']);
  for(const name of ['Dash','Rose','Drain'])if(name.toLowerCase()!==skill)assert.equal(f.b['next'+name],Infinity);
  f.destroy();
}
{
  const f=fixture();release(f,'dash');assert.equal(f.b.state,'dash');assert.equal(f.e.body.velocity.x,-760);
  const w=wolf(400),behind=wolf(600),high=wolf(400,300);addWolves(f,[w,behind,high]);
  f.e.x=280;f.tick(3800);assert.equal(f.s.playerData.hp,478);assert.equal(f.s.player.x,290);
  assert.equal(w.hp,78);assert.equal(w.x,340);assert.equal(w.view.x,340);assert.equal(w.hpBar.x,320);
  assert.equal(behind.hp,100);assert.equal(high.hp,100);assert.equal(f.b.state,'dash');
  f.s.player.x=650;f.e.x=200;f.tick(3900);assert.equal(f.hits.length,2,'one hit per target including fresh player wrappers');
  assert.equal(f.e.body.velocity.x,-760,'dash never turns toward a moving target');
  f.e.x=-40;f.tick(4200);assert.equal(f.e.x,846);assert.equal(f.e.entryState,'recycled');
  assert.equal(f.b.state,'recovery');assert.equal(f.b.nextDash,10450);assert.equal(f.b.dashHits.size,0);
  assert(!isBossUsingSkill(f.e));assert.equal(f.e.body.velocity.x,-300);f.destroy();
}
{
  const f=fixture();release(f,'dash');f.e.x=-80;f.tick(3500);
  assert.deepEqual(sources(f),['thornlessRoseDash'],'final swept segment is resolved before a low-frame-rate recycle');
  assert.equal(f.s.playerData.hp,478);assert.equal(f.e.x,846);assert.equal(f.e.recycleCount,1);f.destroy();
}
{
  const f=fixture(),king={hp:100,view:node(390,400),domain:node(390,400),hpBar:{container:node(390,369)}};
  f.s.poisonKingRuntime={get:()=>king,getAttackTarget:()=>({type:'poison_king',get x(){return king.view.x;},get y(){return king.view.y;},
    get hp(){return king.hp;},isAlive:()=>king.hp>0,takeDamage(n){king.hp=Math.max(0,king.hp-n);}})};
  release(f,'dash');f.e.x=200;f.tick(3800);f.tick(3810);
  assert.equal(king.hp,78);assert.equal(king.view.x,330);assert.equal(king.domain.x,330);assert.equal(king.hpBar.container.x,330);
  f.destroy();
}
// Synchronous runtime replacement and manager pause cannot leak final-segment effects.
{
  const f=fixture(),old={hp:100,view:node(390,400)},replacement={hp:100,view:node(650,400)};
  let current=old;
  f.s.poisonKingRuntime={get:()=>current,getAttackTarget:()=>{
    const king=current;return {type:'poison_king',get x(){return king.view.x;},get y(){return king.view.y;},get hp(){return king.hp;},
      isAlive:()=>king.hp>0,takeDamage(n){king.hp-=n;current=replacement;}};
  }};
  release(f,'dash');f.e.x=200;f.tick(3800);
  assert.equal(old.hp,78);assert.equal(replacement.hp,100);
  assert.equal(replacement.view.x,650,'a replacement runtime cannot inherit displacement from the old target callback');
  assert.equal(old.view.x,390,'a transferred target no longer receives post-hit effects');f.destroy();
}
{
  const f=fixture();release(f,'dash');f.s.enemyBehaviors.pause();f.e.x=-40;f.s.enemyBehaviors.recycleEnemy(f.e);
  assert.equal(f.hits.length,0,'manager pause prevents final-segment damage even during an explicit recycle');
  assert.equal(f.e.x,-40);f.destroy();
}
// A thrown rose keeps its original point through target movement, ordinary knockback, and recycling.
{
  const f=fixture();begin(f,'rose');f.s.player.x=600;f.tick(6300);
  assert.deepEqual({x:f.b.rose.x,y:f.b.rose.y},{x:350,y:400});assert(isBossUsingSkill(f.e));
  f.tick(6499);assert.equal(f.hits.length,0);f.tick(6500);assert.equal(f.b.state,'roseWait');assert(!isBossUsingSkill(f.e));
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  const w=wolf(350),edge=wolf(430),outside=wolf(431),dead=wolf(350);dead.hp=0;addWolves(f,[w,edge,outside,dead]);
  f.e.x=-40;f.tick(6600);assert.equal(f.e.x,846);assert.equal(f.b.rose.x,350);
  assert(f.graphics[0].circles.some(p=>p.x===350&&p.y===400&&p.r===80),'warning remains at the fixed world point');
  f.tick(7299);assert.equal(f.hits.length,0);f.tick(7300);f.tick(7310);
  assert.deepEqual(sources(f),['thornlessRoseBloom','thornlessRoseBloom']);assert.equal(w.hp,78);assert.equal(edge.hp,78);
  assert.equal(outside.hp,100);assert.equal(f.s.playerData.hp,500);assert.equal(f.b.rose,null);
  assert.equal(f.b.nextRose,14800);assert.equal(f.b.state,'recovery');assert(!isBossUsingSkill(f.e));f.destroy();
}
{
  const f=fixture();release(f,'rose');f.b.nextDash=f.b.nextDrain=6500;
  f.tick(6500);f.tick(7100);assert.equal(f.hits.length,0);assert.equal(f.b.state,'roseWait');
  f.tick(7300);assert.deepEqual(sources(f),['thornlessRoseBloom']);f.tick(7850);
  assert.equal(f.b.state,'dashWindup','due skills wait for the current skill/recovery then use their own clocks');
  assert.equal(f.b.nextDrain,6500);assert.equal(f.b.nextRose,14800);f.destroy();
}
// Lifesteal uses actual HP deduction after defense, shield, interception, dodge and HP cap.
for(const [kind,expected] of [['plain',18],['shield',5],['block',0],['dodge',0],['lethal',4]]) {
  const f=fixture();f.e.hp=1000;
  if(kind==='shield'){
    f.s.playerData.defense=5;f.s.playerData.shield=8;
    f.s.statusEffects={absorbShield(n){const absorbed=Math.min(n,f.s.playerData.shield);f.s.playerData.shield-=absorbed;return {absorbed,remainingDamage:n-absorbed};}};
  }
  if(kind==='block')f.s.skillSystem={beforePlayerDamage:()=>({blocked:true}),beforePlayerHpDamage(){}};
  if(kind==='dodge')f.s.playerData.dodgeChance=.7;
  if(kind==='lethal'){
    f.s.playerData.hp=4;addWolves(f,[wolf(100)]);f.s.finishRun=()=>{};
  }
  const random=Math.random;
  try {if(kind==='dodge')Math.random=()=>0;release(f,'drain');}
  finally {Math.random=random;}
  assert.equal(f.hits[0].result,expected);assert.equal(f.e.hp,1000+expected);assert.equal(f.heals.length,expected?1:0);
  assert.equal(f.b.state,'drainThrust');assert(isBossUsingSkill(f.e));
  f.tick(9730);assert.equal(f.b.state,'recovery');assert(!isBossUsingSkill(f.e));f.destroy();
}
{
  const f=fixture();f.e.hp=f.e.maxHp-2;release(f,'drain');assert.equal(f.e.hp,f.e.maxHp);assert.deepEqual(f.heals,['+2']);f.destroy();
}
for(const skill of ['dash','rose','normal']) {
  const f=fixture();f.e.hp=1000;
  if(skill==='normal'){f.tick(0);f.tick(100);}else {release(f,skill);if(skill==='dash'){f.e.x=200;f.tick(3800);}else f.tick(7300);}
  assert.equal(f.e.hp,1000,'only the independent drain stab heals');f.destroy();
}
// Visible ordinary knockback has no old 10px cap; recovery hits never extend skill clocks.
{
  const f=fixture();f.tick(0);assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  const tw=f.tweens.at(-1);assert.equal(tw.config.duration,140);tw.config.targets.t=1;tw.config.onComplete();
  assert.equal(f.e.x,558);assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  const second=f.tweens.at(-1);second.config.targets.t=1;second.config.onComplete();assert.equal(f.e.x,616);
  f.tick(3000);assert.equal(f.b.state,'dashWindup');const before=f.e.hp;
  f.s.combatSystem.damageEnemy(f.e,20,{source:'attack',knockback:72});assert.equal(f.e.hp,before-20);assert(!f.e.isKnockbackActive);
  f.tick(3450);f.e.x=-40;f.tick(4000);f.e.x=600;
  const until=f.b.until,clocks=[f.b.nextDash,f.b.nextRose,f.b.nextDrain];
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));f.tick(until-1);
  assert.equal(f.b.until,until);assert.deepEqual([f.b.nextDash,f.b.nextRose,f.b.nextDrain],clocks);f.destroy();
}
for(const cadence of [333,180]) {
  const f=fixture();f.e.x=460;isolate(f,'dash');let nextHit=0,started=null;
  for(let t=0;t<=3000;t+=5) {
    f.s.now=t;
    for(const tw of f.tweens)if(!tw.stopped&&tw.started!==undefined) {
      const p=Math.min(1,(t-tw.started)/tw.config.duration);tw.config.targets.t=Math.sin(p*Math.PI/2);tw.config.onUpdate?.();
      if(p===1){tw.stopped=true;tw.config.onComplete?.();}
    }
    f.e.x+=f.e.body.velocity.x*.005;
    if(t>=nextHit){
      f.s.player.x=f.e.x-110; // Keep the attacker in weapon range and follow it with the real viewport.
      f.s.cameras.main.worldView.x=Math.max(0,f.s.player.x-280);
      f.s.combatSystem.applyKnockback(f.e,{knockback:72});f.tweens.at(-1).started=t;nextHit+=cadence;
    }
    f.tick(t);if(f.b.state==='dashWindup'){started=t;break;}
  }
  const stabs=sources(f).filter(v=>v==='thornlessRoseStab').length;
  if(cadence===333)assert(stabs>0,'base cadence leaves a natural normal stab opportunity');
  else assert.equal(stabs,0,'fast attacks can suppress normal stabs');
  assert.equal(started,3000,'ordinary knockback never resets/delays skill readiness');f.destroy();
}
{
  const f=fixture(),legacy={...f.e,behavior:'midBoss',behaviorState:'idle',attackState:'idle',bossSkillKnockbackImmune:false};
  assert(f.s.combatSystem.applyKnockback(legacy,{knockback:72}));const tw=f.tweens.at(-1);
  assert.equal(tw.config.duration,NORMAL_ATTACK_KNOCKBACK_DURATION_MS);tw.config.targets.t=1;tw.config.onComplete();assert.equal(legacy.x,510);
  legacy.behaviorState='windup';assert(!f.s.combatSystem.applyKnockback(legacy,{knockback:72}));f.destroy();
}
for(const phase of ['attackWindup','dashWindup','dash','roseWindup','roseThrow','roseWait','drainWindup','drainThrust','recovery']) {
  const f=fixture();
  if(phase==='attackWindup')f.tick(0);
  else if(phase.endsWith('Windup'))begin(f,phase.replace('Windup',''));
  else if(phase==='dash')release(f,'dash');
  else if(phase==='roseThrow'||phase==='roseWait'){release(f,'rose');if(phase==='roseWait')f.tick(6500);}
  else {release(f,'drain');if(phase==='recovery')f.tick(9730);}
  assert.equal(f.b.state,phase);
  const until=f.b.until,clocks=[f.b.nextDash,f.b.nextRose,f.b.nextDrain],count=f.hits.length;
  f.s.paused=true;f.s.enemyBehaviors.pause();f.tick(99999);assert.equal(f.hits.length,count);assert.equal(f.b.until,until);
  f.s.paused=false;f.s.enemyBehaviors.resume();if(phase==='dash')assert.equal(f.e.body.velocity.x,-760);
  f.s.enemyBehaviors.recycleEnemy(f.e);assert.equal(f.e.x,846);assert.deepEqual([f.b.nextDash,f.b.nextRose,f.b.nextDrain],clocks);
  assert.equal(f.b.dashHits.size,0);assert.equal(f.e.lockedAttackTarget,null);assert(!isBossUsingSkill(f.e));
  f.e.isDefeated=true;f.tick(99999);assert.equal(f.s.enemyBehaviors.items.size,0);assert(f.graphics[0].destroyed);
  assert.equal(f.b.rose,null);assert.equal(f.b.point,null);assert.equal(f.b.graphics,null);f.destroy();
}
{
  const f=fixture();release(f,'rose');f.b.shiftTimers(1000,6300);
  assert.equal(f.b.rose.landAt,7500);assert.equal(f.b.rose.explodeAt,8300);assert.equal(f.b.nextRose,15800);
  f.tick(7300);assert.equal(f.hits.length,0);f.tick(8300);assert.deepEqual(sources(f),['thornlessRoseBloom']);
  applyEnemyCold(f.e,{now:f.s.now,stacks:4,data:{maxStacks:8,slowPerStack:.04,attackSlowPerStack:.03}});
  assert(getEnemyMoveSpeed(f.e,R.dashSpeed,f.s.now)<R.dashSpeed);assert(getEnemyAttackDelay(f.e,2000,f.s.now)>2000);f.destroy();
}
// Real death immediately removes pending flowers before Boss reward modal pauses the manager.
{
  const f=fixture('normal',true);release(f,'rose');let gold=0,midEnd=0,rewards=0,profession=0;
  f.s.awardGold=n=>{gold+=n;};f.s.runStats={endMidBossFight(){midEnd++;}};
  f.s.queueArtifactReward=()=>{rewards++;f.s.paused=true;f.s.enemyBehaviors.pause();};f.s.showProfessionChoice=()=>{profession++;};
  f.s.combatSystem.damageEnemy(f.e,9999,{source:'reflect'});
  assert(f.e.isDefeated);assert.equal(f.s.enemyBehaviors.items.size,0);assert(f.graphics[0].destroyed);assert.equal(f.b.rose,null);
  f.tick(99999);assert.equal(f.hits.length,0);assert.equal(gold,40);assert.equal(midEnd,1);assert.equal(rewards,1);
  f.s.combatSystem.killEnemy(f.e);assert.equal(gold,40);assert.equal(rewards,1);
  f.stage.beginAfterBossReward('boss2');f.stage.beginAfterBossReward('boss2');assert.equal(profession,1);f.destroy();
}
for(const during of ['dash','rose','drain'])for(const end of ['caster','scene']) {
  const f=fixture();f.e.hp=1000;addWolves(f,[wolf(340)]);
  if(during==='rose')release(f,during);else if(during==='dash')release(f,during);else begin(f,during);
  f.s.eventBus.emit=type=>{if(type===CombatEvents.PLAYER_DAMAGED){
    if(end==='caster')f.s.combatSystem.damageEnemy(f.e,9999,{source:'reflect'});
    else {f.s.paused=true;f.s.enemyBehaviors.destroy();}
  }};
  // Killing an offscreen dasher bypasses the viewport damage gate, as an already-resolved death callback can.
  if(during==='dash'){
    f.s.eventBus.emit=type=>{if(type===CombatEvents.PLAYER_DAMAGED){if(end==='caster')f.s.combatSystem.killEnemy(f.e);else {f.s.paused=true;f.s.enemyBehaviors.destroy();}}};
    f.e.x=-40;f.tick(3800);assert.equal(f.e.x,-40,'death/run end prevents post-collision teleport');
  } else f.tick(during==='rose'?7300:9550);
  assert.equal(f.hits.length,1);assert.equal(f.s.skillSystem.passiveState.spiritWolves.wolves[0].hp,100);
  assert.equal(f.b.graphics,null);assert(f.graphics[0].destroyed);assert.equal(f.b.rose,null);assert.equal(f.heals.length,0);
  assert.equal(f.e.body.velocity.x,0);assert(!isBossUsingSkill(f.e));f.destroy();
}
{
  const f=fixture(),w=wolf(400),other=wolf(360);f.s.player.x=100;addWolves(f,[w,other]);
  w.takeDamage=n=>{w.hp-=n;f.s.combatSystem.killEnemy(f.e);};
  release(f,'dash');f.e.x=200;f.tick(3800);
  assert.equal(w.hp,78);assert.equal(w.x,400,'caster death in summon damage stops the post-hit displacement');
  assert.equal(w.view.x,400);assert.equal(other.hp,100);assert.equal(f.b.graphics,null);f.destroy();
}
console.log('PASS thornless rose actual Boss 2/modes/growth/rewards, independent clocks and ordinary attack pressure, continuous left dash/low-frame recycle/one hit per target/player+summon displacement, fixed rose flight/warning/explosion, actual HP lifesteal after defense/shield/block/dodge/caps, skill-only immunity, old Boss isolation, pause/recycle/timers/slow/death callback and visual cleanup');
