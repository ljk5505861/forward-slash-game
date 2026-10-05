import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import UncrownedKingBehavior from '../src/enemies/behaviors/UncrownedKingBehavior.js';
import StatusEffectSystem,{StatusEffects} from '../src/systems/StatusEffectSystem.js';
import ThornlessRoseBehavior from '../src/enemies/behaviors/ThornlessRoseBehavior.js';
import MountainGeneralBehavior from '../src/enemies/behaviors/MountainGeneralBehavior.js';
import CombatSystem,{ isBossUsingSkill, isUncrownedShadowActive, NORMAL_ATTACK_KNOCKBACK_DURATION_MS } from '../src/systems/CombatSystem.js';
import StageSystem,{ LevelFlowStates as F } from '../src/systems/StageSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import { UNCROWNED_KING_TUNING as K } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { ENEMY_UI_LAYOUT } from '../src/ui/EnemyStatusIndicators.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen,shiftEnemyColdTimers,applyEnemyCold } from '../src/systems/EnemyColdControl.js';

// Run the actual manager with Phaser's rendering import replaced by a minimal node shim.
const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ')
  .replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const imports={ UncrownedKingBehavior,ThornlessRoseBehavior,MountainGeneralBehavior,getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,
  updateGravityPull,isEnemyFrozen,shiftEnemyColdTimers,Phaser:{Math:{Between:()=>0}} };
for(const name of ['MeatBehavior','DoctorBehavior','MasterBehavior','ShieldGuardBehavior','SharpshooterBehavior',
  'WarDrumPriestBehavior','EliteBerserkerBehavior','ThunderMageBehavior','HellEnvoyBehavior','HellSummonBehavior',
  'GamblerBehavior','GoldenHallGuardBehavior'])imports[name]=class {};
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',imports);

function node(x=0,y=0,w=0,h=0) {
  const n={x,y,width:w,height:h,active:true,alpha:1,circles:[],lines:[],
    destroy(){this.active=false;this.destroyed=true;},setX(x){this.x=x;return this;},
    setPosition(x,y){this.x=x;this.y=y;return this;},setText(text){this.text=text;return this;},
    setAlpha(alpha){this.alpha=alpha;return this;},setFillStyle(color){this.color=color;return this;},add(){return this;},
    clear(){this.circles=[];this.lines=[];return this;},strokeCircle(x,y,r){this.circles.push({x,y,r});return this;},
    lineStyle(width,color,alpha){this.lineWidth=width;this.lineColor=color;this.lineAlpha=alpha;return this;},
    lineBetween(x1,y1,x2,y2){this.lines.push({x1,y1,x2,y2,width:this.lineWidth,color:this.lineColor});return this;}};
  for(const key of ['setStrokeStyle','setDepth','setOrigin','setVisible','setScale','setDisplaySize',
    'strokeRect'])n[key]=()=>n;
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
  const stage=new StageSystem(s);s.stageSystem=stage;stage.currentEnemyLevel=10;
  if(boss){stage.activeRush='boss3';stage.spawnBoss('boss3');}
  else stage.spawn('uncrowned_king',500);
  const e=s.enemies[0];e.x=500;e.y=400;e.scene=s;
  const b=s.enemyBehaviors.items.get(e);
  return {s,e,b,stage,graphics,tweens,hits,events,heals,tick(t){s.now=t;s.enemyBehaviors.update(t);stage.updateBossKnockbackCounterattacks(t);},
    destroy(){s.combatSystem.clearAllKnockbacks();s.enemyBehaviors.destroy();}};
}
const sources=f=>f.hits.map(h=>h.meta.source);
const isolate=(f,skill)=>{for(const name of ['Thrust','Cleave','Rain','Shadow'])if(name.toLowerCase()!==skill)f.b['next'+name]=Infinity;};
const begin=(f,skill)=>{isolate(f,skill);f.tick(K[skill+'First']);assert.equal(f.b.state,skill+'Windup');};
const release=(f,skill)=>{begin(f,skill);f.tick(K[skill+'First']+K[skill+'Windup']);};
const wolf=(x=350,y=400)=>({type:'spiritWolf',x,y,hp:100,active:true,view:node(x,y),hpBarBg:node(x,y-50),hpBar:node(x-20,y-50),
  isAlive(){return this.active&&this.hp>0;},takeDamage(n){this.hp=Math.max(0,this.hp-n);}});
const addWolves=(f,wolves)=>{f.s.skillSystem={beforePlayerDamage(){},beforePlayerHpDamage(){},passiveState:{spiritWolves:{wolves}}};};

// Crown geometry stays below the shared burn/poison row, including after movement/re-entry.
{
  const f=fixture();
  for(const [x,y] of [[500,400],[855,600]]) {
    f.e.x=x;f.e.y=y;f.b.syncVisual();
    const crown=f.graphics[0].lines.filter(line=>line.color===0xe0bb64);
    assert.equal(crown.length,7);
    const statusBottom=y-f.e.height/2-ENEMY_UI_LAYOUT.statusRowOffsetY+12;
    assert(crown.every(line=>Math.min(line.y1,line.y2)-line.width/2>=statusBottom));
    assert(crown.every(line=>Math.min(line.x1,line.x2)>=x-22&&Math.max(line.x1,line.x2)<=x+22));
  }
  f.destroy();
}

// Actual normal/test Boss 3 spawn, title, event/reward identity and preserved Lv10 first-fight values.
for(const mode of ['normal','test']) {
  const f=fixture(mode,true),e=f.e;
  assert.equal(e.enemyId,mode==='normal'?'uncrowned_king':'boss');
  assert.equal(e.name,mode==='normal'?'无冕之王':'训练场守卫');assert.equal(e.hp,2929);assert.equal(e.damage,21);
  assert.equal(e.attackIntervalMs,mode==='normal'?2400:1250);assert(!e.isMidBoss&&!e.isFinalBoss);
  assert.equal(e.flowBossType,'boss3');assert.equal(f.stage.flowState,F.BOSS_FIGHT);
  assert.equal(f.b instanceof UncrownedKingBehavior,mode==='normal');
  assert.match(f.s.status,mode==='normal'?/无冕之王/:/训练场守卫/);
  assert.equal(f.events.find(v=>v.meta?.kind==='boss').meta.bossId,e.enemyId);
  let reward;f.s.queueArtifactReward=value=>{reward=value;};f.stage.onBossKilled('boss3');
  assert.match(reward.name,mode==='normal'?/无冕之王/:/训练场守卫/);f.destroy();
}
{
  const f=fixture();
  for(const level of [1,10,19,100]){
    f.stage.currentEnemyLevel=level;const e=f.stage.tunedEnemy('uncrowned_king');
    assert.equal(e.hp,Math.round(1408*(1+(level-1)*.12)));assert.equal(e.damage,Math.round(16*(1+(level-1)*.035)));
    assert.equal(e.attackIntervalMs,2400);assert.equal(e.speed,272);assert.equal(e.attackRange,175);
  }
  f.destroy();
}
{
  const f=fixture();f.tick(0);assert.equal(f.b.state,'attackWindup');assert(!isBossUsingSkill(f.e));
  f.tick(109);assert.equal(f.hits.length,0);f.tick(110);assert.deepEqual(sources(f),['uncrownedKingStab']);
  assert.equal(f.s.playerData.hp,479);f.e.hp=100;f.s.combatSystem.updateEnemyAttack(f.e,2000);
  assert.equal(f.hits.length,1);assert(!f.e.enraged);assert.equal(f.b.nextAttack,2510);f.destroy();
}
for(const skill of ['thrust','cleave','rain','shadow']){
  const f=fixture();isolate(f,skill);f.s.playerData.hp=0;f.tick(99999);
  assert.equal(f.b['next'+skill[0].toUpperCase()+skill.slice(1)],K[skill+'First']);assert(!isBossUsingSkill(f.e));f.destroy();
}
for(const skill of ['thrust','cleave','rain','shadow']){
  const f=fixture();isolate(f,skill);f.tick(0);f.s.combatSystem.applyKnockback(f.e,{knockback:72});
  f.tick(K[skill+'First']);assert.equal(f.b.state,skill+'Windup');assert(!f.e.isKnockbackActive);
  assert(!f.s.combatSystem.applyKnockback(f.e,{knockback:72}));const hp=f.e.hp;
  assert(f.s.combatSystem.damageEnemy(f.e,20,{source:'skill'}));assert.equal(f.e.hp,hp-20,'windup knockback immunity is not damage immunity');
  f.tick(K[skill+'First']+K[skill+'Windup']);
  assert.equal(f.b['next'+skill[0].toUpperCase()+skill.slice(1)],K[skill+'First']+K[skill+'Windup']+K[skill+'Cooldown']);
  for(const name of ['Thrust','Cleave','Rain','Shadow'])if(name.toLowerCase()!==skill)assert.equal(f.b['next'+name],Infinity);
  f.destroy();
}
// Every thrust independently rechecks range and target; only a successful first release spends the skill clock.
for(const replacement of [false,true]){
  const f=fixture();f.tick(0);f.s.playerData.hp=0;const w=wolf(390);if(replacement)addWolves(f,[w]);
  f.tick(110);assert.equal(f.hits.length,replacement?1:0);assert.equal(f.b.nextAttack,replacement?2510:0);
  if(replacement)assert.equal(f.hits[0].target,w);f.destroy();
}
{
  const f=fixture();f.tick(0);f.s.player.x=200;f.tick(110);assert.equal(f.hits.length,0);assert.equal(f.b.nextAttack,0);f.destroy();
}
for(const replacement of [false,true]){
  const f=fixture();begin(f,'thrust');f.s.playerData.hp=0;const w=wolf(390);if(replacement)addWolves(f,[w]);
  f.tick(3420);assert.equal(f.hits.length,replacement?1:0);assert.equal(f.b.nextThrust,replacement?9920:3000);
  if(replacement)assert.equal(f.hits[0].target,w);f.destroy();
}
{
  const f=fixture();begin(f,'thrust');f.s.player.x=200;f.tick(3420);assert.equal(f.hits.length,0);assert.equal(f.b.nextThrust,3000);f.destroy();
}
{
  const f=fixture();release(f,'thrust');assert.equal(f.s.playerData.hp,483);
  f.s.playerData.hp=0;const w=wolf(380);addWolves(f,[w]);
  f.tick(3639);assert.equal(f.hits.length,1);f.tick(3640);assert.equal(w.hp,83);
  w.x=100;f.tick(3860);assert.equal(w.hp,83,'third thrust misses after target leaves range');
  assert.equal(f.b.state,'thrustEnd');assert.equal(f.b.strikes,3);assert.equal(f.b.nextThrust,9920);
  f.tick(4039);assert(isBossUsingSkill(f.e));f.tick(4040);assert.equal(f.b.state,'recovery');assert(!isBossUsingSkill(f.e));f.destroy();
}
{
  const f=fixture();release(f,'thrust');f.tick(9999);assert.equal(f.hits.length,2,'lag releases one thrust, not a burst of queued melee hits');
  f.tick(10000);assert.equal(f.hits.length,2);f.tick(10219);assert.equal(f.hits.length,3);f.destroy();
}
// Cleave is one frontal heavy hit with actual player/summon displacement; targets behind or above are excluded.
{
  const f=fixture();begin(f,'cleave');
  const w=wolf(400),behind=wolf(560),high=wolf(400,250);addWolves(f,[w,behind,high]);f.tick(6700);
  assert.deepEqual(sources(f),['uncrownedKingCleave','uncrownedKingCleave']);assert.equal(f.s.playerData.hp,454);
  assert.equal(f.s.player.x,270);assert.equal(w.hp,54);assert.equal(w.x,320);assert.equal(w.view.x,320);assert.equal(w.hpBar.x,300);
  assert.equal(behind.hp,100);assert.equal(high.hp,100);assert(isBossUsingSkill(f.e));
  f.tick(6880);assert.equal(f.b.state,'recovery');assert(!isBossUsingSkill(f.e));
  const until=f.b.until,clocks=[f.b.nextThrust,f.b.nextCleave,f.b.nextRain,f.b.nextShadow];
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));f.tick(until-1);
  assert.equal(f.b.until,until);assert.deepEqual([f.b.nextThrust,f.b.nextCleave,f.b.nextRain,f.b.nextShadow],clocks);f.destroy();
}
// Rain locks one area, emits three warned batches and resolves each spear once, including offscreen re-entry.
{
  const f=fixture();begin(f,'rain');f.s.player.x=650;f.tick(9500);assert.equal(f.b.spears.length,9);
  assert.deepEqual([...new Set(f.b.spears.map(p=>p.x))],[260,350,440]);
  const center=wolf(350),left=wolf(260),outside=wolf(550);addWolves(f,[center,left,outside]);
  f.tick(10099);assert.equal(f.hits.length,0);f.tick(10100);assert.equal(f.hits.length,0);
  f.tick(10319);assert.equal(f.hits.length,0);f.tick(10320);assert.equal(center.hp,86);assert.equal(left.hp,86);
  f.tick(10321);assert.equal(f.hits.length,2);assert.equal(f.b.spears.length,6);
  f.e.x=-50;f.tick(10400);assert.equal(f.e.x,855);assert.equal(f.e.entryState,'recycled');assert(isBossUsingSkill(f.e));
  assert(f.graphics[0].circles.some(p=>p.x===350&&p.y===400&&p.r===32));
  f.tick(10770);assert.equal(center.hp,72);f.tick(11220);assert.equal(center.hp,58);assert.equal(left.hp,58);
  f.tick(11221);assert.equal(f.hits.length,6);assert.equal(outside.hp,100);assert.equal(f.s.playerData.hp,500);
  assert.equal(f.b.spears.length,0);assert.equal(f.b.nextRain,19500);assert.equal(f.b.state,'recovery');assert(!isBossUsingSkill(f.e));f.destroy();
}
{
  const f=fixture();release(f,'rain');f.tick(11220);assert.equal(f.s.playerData.hp,458);
  assert.equal(sources(f).filter(v=>v==='uncrownedKingRain').length,3,'late frame resolves each distinct center spear once');
  f.tick(11230);assert.equal(f.hits.length,3);f.destroy();
}
// Shadow stays mobile and uses only ordinary stabs. All damage routes and knockback are blocked only before the deadline.
{
  const f=fixture();release(f,'shadow');assert.equal(f.e.alpha,.3);assert.equal(f.e.uncrownedShadowUntil,15350);
  assert.equal(f.b.state,'shadow');const hp=f.e.hp,hits=f.events.filter(v=>v.type===CombatEvents.ENEMY_HIT).length;
  for(const source of ['attack','skill','burn','poison','reflect']){
    assert.equal(f.s.combatSystem.damageEnemy(f.e,9999,{source,knockback:72}),false);
    assert.equal(f.s.combatSystem.damageEnemy(f.e,9999,{source,damageAlreadyResolved:true}),false);
  }
  assert.equal(f.e.hp,hp);assert.equal(f.events.filter(v=>v.type===CombatEvents.ENEMY_HIT).length,hits);
  assert(!f.s.combatSystem.applyKnockback(f.e,{knockback:72}));f.b.nextThrust=12360;
  f.tick(12500);assert.equal(f.b.state,'shadowAttackWindup');f.tick(12610);assert.deepEqual(sources(f),['uncrownedKingStab']);
  assert.equal(f.s.playerData.hp,479);f.s.player.x=100;f.tick(12900);assert.equal(f.e.body.velocity.x,-272);
  assert.equal(f.b.nextThrust,12360,'shadow phase neither fires another skill nor resets its overdue clock');
  f.s.now=15350;assert(!isUncrownedShadowActive(f.e,f.s.now));assert(!isBossUsingSkill(f.e));
  assert(f.s.combatSystem.damageEnemy(f.e,20,{source:'attack',knockback:72}));
  assert.equal(f.e.hp,hp-20);assert(f.e.isKnockbackActive,'deadline is respected even before the manager updates');
  f.tick(15350);assert.equal(f.e.alpha,1);assert.equal(f.e.uncrownedShadowUntil,0);assert.equal(f.b.state,'recovery');f.destroy();
}
{
  const f=fixture();release(f,'shadow');f.s.statusEffects=new StatusEffectSystem(f.s);
  f.s.statusEffects.add(StatusEffects.BURN,f.e,{sourceId:'test-burn',durationMs:5000,intervalMs:200,value:5});
  f.s.statusEffects.add(StatusEffects.POISON,f.e,{sourceId:'test-poison',durationMs:5000,intervalMs:200,value:4});
  const hp=f.e.hp;
  for(let t=12550;t<15350;t+=200){f.s.now=t;f.s.statusEffects.update(t);assert.equal(f.e.hp,hp);}
  f.s.now=15350;f.s.statusEffects.update(15350);assert(f.e.hp<hp,'existing DOT tick pipeline resumes damage at shadow end');
  f.s.statusEffects.reset();f.destroy();
}
{
  const f=fixture();f.b.shiftTimers(1000,-1);assert.equal(f.e.uncrownedShadowUntil,0,'shifting timers never activates a zero-duration shadow sentinel');f.destroy();
}
{
  const f=fixture();release(f,'shadow');f.b.shiftTimers(1000,12350);
  assert.equal(f.e.uncrownedShadowUntil,16350);assert.equal(f.b.nextShadow,25850);
  f.s.now=14000;f.s.enemyBehaviors.recycleEnemy(f.e);assert.equal(f.e.x,855);assert.equal(f.e.uncrownedShadowUntil,16350);
  f.tick(16349);assert(isBossUsingSkill(f.e));f.tick(16350);assert.equal(f.e.uncrownedShadowUntil,0);assert.equal(f.e.alpha,1);
  assert(!isBossUsingSkill(f.e));assert.equal(f.b.state,'recovery');f.destroy();
}
{
  const f=fixture();release(f,'rain');f.b.shiftTimers(1000,9500);assert.equal(f.b.spears[0].landAt,11320);
  f.tick(10320);assert.equal(f.hits.length,0);f.tick(11320);assert.equal(f.hits.length,1);
  applyEnemyCold(f.e,{now:f.s.now,stacks:4,data:{maxStacks:8,slowPerStack:.04,attackSlowPerStack:.03}});
  assert(getEnemyMoveSpeed(f.e,272,f.s.now)<272);assert(getEnemyAttackDelay(f.e,2400,f.s.now)>2400);f.destroy();
}
for(const cadence of [333,180]){
  const f=fixture();f.e.x=460;isolate(f,'thrust');let nextHit=0,started=null;
  for(let t=0;t<=3000;t+=5){
    f.s.now=t;
    for(const tw of f.tweens)if(!tw.stopped&&tw.started!==undefined){
      const p=Math.min(1,(t-tw.started)/tw.config.duration);tw.config.targets.t=Math.sin(p*Math.PI/2);tw.config.onUpdate?.();
      if(p===1){tw.stopped=true;tw.config.onComplete?.();}
    }
    f.e.x+=f.e.body.velocity.x*.005;
    if(t>=nextHit){f.s.player.x=f.e.x-110;f.s.cameras.main.worldView.x=Math.max(0,f.s.player.x-280);
      f.s.combatSystem.applyKnockback(f.e,{knockback:72});f.tweens.at(-1).started=t;nextHit+=cadence;}
    f.tick(t);if(f.b.state==='thrustWindup'){started=t;break;}
  }
  const stabs=sources(f).filter(v=>v==='uncrownedKingStab').length;
  if(cadence===333)assert(stabs>0);else assert.equal(stabs,0);
  assert.equal(started,3000,'independent skill starts on time under ordinary hit pressure');f.destroy();
}
{
  const f=fixture();assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  const tw=f.tweens.at(-1);assert.equal(tw.config.duration,150);tw.config.targets.t=1;tw.config.onComplete();assert.equal(f.e.x,558);
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));const second=f.tweens.at(-1);second.config.targets.t=1;second.config.onComplete();assert.equal(f.e.x,616);
  const old={...f.e,x:500,behavior:'midBoss',attackState:'idle',behaviorState:'idle',uncrownedShadowUntil:99999};
  assert(!isUncrownedShadowActive(old,0));assert(f.s.combatSystem.applyKnockback(old,{knockback:72}));
  const legacy=f.tweens.at(-1);assert.equal(legacy.config.duration,NORMAL_ATTACK_KNOCKBACK_DURATION_MS);
  legacy.config.targets.t=1;legacy.config.onComplete();assert.equal(old.x,510);f.destroy();
}
// Pause/recycle/death cleanup in every meaningful phase, with released rain/shadow duration preserved.
for(const phase of ['attackWindup','thrustWindup','thrust','thrustEnd','cleaveWindup','cleaveStrike','rainWindup','rain','shadowWindup','shadow','shadowAttackWindup','recovery']){
  const f=fixture();
  if(phase==='attackWindup')f.tick(0);
  else if(['thrustWindup','cleaveWindup','rainWindup','shadowWindup'].includes(phase))begin(f,phase.replace('Windup',''));
  else if(phase==='thrust'||phase==='thrustEnd'){release(f,'thrust');if(phase==='thrustEnd'){f.tick(3640);f.tick(3860);}}
  else if(phase==='cleaveStrike'||phase==='recovery'){release(f,'cleave');if(phase==='recovery')f.tick(6880);}
  else if(phase==='rain')release(f,'rain');
  else {release(f,'shadow');if(phase==='shadowAttackWindup')f.tick(12500);}
  assert.equal(f.b.state,phase);
  const now=f.s.now,count=f.hits.length,clocks=[f.b.nextThrust,f.b.nextCleave,f.b.nextRain,f.b.nextShadow],until=f.b.until,shadow=f.e.uncrownedShadowUntil;
  f.s.paused=true;f.s.enemyBehaviors.pause();f.tick(99999);assert.equal(f.hits.length,count);assert.equal(f.b.until,until);
  f.s.now=now;f.s.paused=false;f.s.enemyBehaviors.resume();f.s.enemyBehaviors.recycleEnemy(f.e);
  assert.equal(f.e.x,855);assert.deepEqual([f.b.nextThrust,f.b.nextCleave,f.b.nextRain,f.b.nextShadow],clocks);
  if(shadow)assert.equal(f.e.uncrownedShadowUntil,shadow);if(phase==='rain')assert.equal(f.b.spears.length,9);
  f.s.combatSystem.killEnemy(f.e);assert(f.e.isDefeated);assert.equal(f.s.enemyBehaviors.items.size,0);
  assert.equal(f.b.graphics,null);assert(f.graphics[0].destroyed);assert.equal(f.b.spears.length,0);
  assert.equal(f.e.uncrownedShadowUntil,0);assert.equal(f.e.alpha,1);assert(!isBossUsingSkill(f.e));f.destroy();
}
{
  const f=fixture('normal',true);release(f,'rain');let gold=0,rewards=0,campfires=0;
  f.s.awardGold=n=>{gold+=n;};f.s.queueArtifactReward=()=>{rewards++;f.s.paused=true;f.s.enemyBehaviors.pause();};
  f.s.showCampfire=()=>{campfires++;};f.s.combatSystem.damageEnemy(f.e,9999,{source:'reflect'});
  assert(f.e.isDefeated);assert.equal(f.b.spears.length,0);assert(f.graphics[0].destroyed);
  f.tick(99999);assert.equal(f.hits.length,0);assert.equal(gold,0);assert.equal(rewards,1);
  f.s.combatSystem.killEnemy(f.e);assert.equal(rewards,1);f.stage.beginAfterBossReward('boss3');f.stage.beginAfterBossReward('boss3');
  assert.equal(campfires,1);assert(f.events.some(v=>v.type===CombatEvents.BOSS_KILLED&&v.meta.flowBossType==='boss3'));f.destroy();
}
for(const during of ['thrust','cleave','rain'])for(const end of ['caster','scene']){
  const f=fixture();addWolves(f,[wolf(340)]);
  if(during==='rain')release(f,during);else begin(f,during);
  f.s.eventBus.emit=type=>{if(type===CombatEvents.PLAYER_DAMAGED){
    if(end==='caster')f.s.combatSystem.damageEnemy(f.e,9999,{source:'reflect'});
    else {f.s.paused=true;f.s.enemyBehaviors.destroy();}
  }};
  f.tick(during==='thrust'?3420:during==='cleave'?6700:10320);
  assert.equal(f.hits.length,1);assert.equal(f.s.skillSystem.passiveState.spiritWolves.wolves[0].hp,100);
  assert.equal(f.b.graphics,null);assert.equal(f.b.spears.length,0);assert.equal(f.e.body.velocity.x,0);f.destroy();
}
{
  const f=fixture();release(f,'shadow');const hp=f.e.hp;
  f.s.eventBus.emit=type=>{if(type===CombatEvents.PLAYER_DAMAGED)f.s.combatSystem.damageEnemy(f.e,9999,{source:'reflect'});};
  f.tick(12500);f.tick(12610);assert.equal(f.e.hp,hp);assert(!f.e.isDefeated,'shadow ordinary stab still attacks and rejects reflected damage');
  f.s.finishRun();assert.equal(f.b.graphics,null);assert.equal(f.e.uncrownedShadowUntil,0);assert.equal(f.e.alpha,1);f.destroy();
}
{
  const f=fixture();begin(f,'cleave');f.s.player.x=100;const w=wolf(400),other=wolf(360);addWolves(f,[w,other]);
  w.takeDamage=n=>{w.hp-=n;f.s.combatSystem.killEnemy(f.e);};f.tick(6700);
  assert.equal(w.hp,54);assert.equal(w.x,400);assert.equal(other.hp,100);assert.equal(f.b.graphics,null);f.destroy();
}
console.log('PASS uncrowned king actual Boss3 spawn/modes/growth/rewards, independent four-skill clocks/ordinary knockback pressure, per-thrust range/replacement/lag, frontal cleave player+summon displacement, fixed warned batched rain/one hit per spear/offscreen effects, shadow movement/ordinary attacks/all damage routes/real DOT/exact expiry, immunity/recovery/old Boss isolation, timers/pause/recycle/synchronous callbacks/death/scene cleanup');
