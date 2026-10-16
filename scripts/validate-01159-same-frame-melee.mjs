import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import CombatSystem,{isAttackRecovering,NORMAL_MODE_KNOCKBACK_DURATION_MS,ENEMY_LANDING_STUN_MS} from '../src/systems/CombatSystem.js';
import StageSystem from '../src/systems/StageSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import MovementSystem from '../src/systems/MovementSystem.js';
import GameSpeedSystem from '../src/systems/GameSpeedSystem.js';
import createPlayer from '../src/entities/createPlayer.js';
import {BALANCE,createPlayerRuntime} from '../src/config/balance.js';
import {ELITE_BERSERKER_TUNING as AXE,THORNLESS_ROSE_TUNING as ROSE,UNCROWNED_KING_TUNING as KING} from '../src/config/enemies.js';
import {CombatEvents,RunStates} from '../src/core/CombatEvents.js';

// Spawn, positions, targeting, combat, AI, stage sequencing and the scene's
// frame loop are production code; rendering and inactive skills use small fixtures.
global.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
global.document={documentElement:{style:{}},createElement(){return {getContext(){return new Proxy({},{get(_,k){return k==='getImageData'?()=>({data:[0,0,0,0]}):()=>{};}});},style:{}};},addEventListener(){},removeEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
global.Image=class {set src(v){setTimeout(()=>this.onload?.(),0);}};
global.HTMLCanvasElement=class {};
const {default:EnemyBehaviorManager}=await import('../src/enemies/behaviors/EnemyBehaviorManager.js');
const {applyEnemyCold}=await import('../src/systems/EnemyColdControl.js');
const sceneSource=fs.readFileSync(new URL('../src/scenes/GameScene.js',import.meta.url),'utf8');
const frameLine=sceneSource.split('\n').find(line=>line.startsWith('  update(_time,delta)'));
const frame=vm.runInNewContext(`(class {${frameLine}}).prototype.update`);

function node(x=0,y=0,width=0,height=0){
  const n={x,y,width,height,active:true,alpha:1,destroy(){this.active=false;},
    setPosition(x,y){this.x=x;this.y=y;return this;},setX(x){this.x=x;return this;},setText(v){this.text=v;return this;},
    setDisplaySize(w,h){this.width=w;this.height=h;return this;},add(){return this;}};
  for(const key of ['setStrokeStyle','setDepth','setOrigin','setVisible','setAlpha','setFillStyle','setScale','clear',
    'lineStyle','lineBetween','strokeCircle','strokeRect','fillStyle','fillRect','setRotation','fillRoundedRect',
    'strokeRoundedRect','fillCircle','fillEllipse','strokeEllipse','fillTriangle','strokeTriangle','beginPath',
    'moveTo','lineTo','closePath','strokePath','strokePoints','fillPoints'])n[key]=()=>n;
  n.body={enable:true,velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){n.x=x;n.y=y;},
    setAllowGravity(){},setCollideWorldBounds(){},setMaxVelocity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}};
  return n;
}
function fixture(mode='normal',id='grunt',distance=86){
  const events=[],listeners=new Map(),graphics=[],tweens=[];
  const s={runMode:mode,runState:RunStates.RUNNING,paused:false,enemies:[],killCount:0,
    balance:{...BALANCE,groundTopY:1000,stageWorldWidth:4000},playerData:createPlayerRuntime(),
    getGameplayTime(){return this.gameSpeed?.gameplayTimeMs||0;},isGameplayPaused(){return this.paused;},
    floatText(){},awardGold(){},hud:{update(){},setStatus(){}},physics:{add:{existing(){}}},
    events:{on(){},once(){},off(){}},time:{delayedCall(){return {remove(){}};}},
    add:{rectangle:(...a)=>Object.assign(node(...a),{scene:s}),text:(x,y)=>node(x,y),circle:node,ellipse:node,triangle:node,container:node,
      graphics(){const g=node();graphics.push(g);return g;}},
    tweens:{add(config){const t={config,stop(){},remove(){},pause(){},resume(){}};tweens.push(t);return t;}},
    cameras:{main:{worldView:{x:0,width:720},width:720,scrollX:0}},
    eventBus:{on(type,fn){const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);return ()=>set.delete(fn);},
      emit(type,payload){events.push({type,payload});for(const fn of [...(listeners.get(type)||[])])fn(payload);}},
    statusEffects:{update(){},clearTarget(){},getEffects:()=>[],has:()=>false,absorbShield:d=>({absorbed:0,remainingDamage:d})},
    skillSystem:{passiveState:{},update(){},beforePlayerDamage(){},beforePlayerHpDamage(){}},
    artifactSystem:{update(){},highHpDamageMultiplier:()=>1},flyingSwords:{update(){}},afterimages:{update(){}},
    syncAttachedVisuals(){},updateDebugOverlay(){},
    finishRun(){this.paused=true;this.combatSystem.reset();this.enemyBehaviors.destroy();}};
  s.player=createPlayer(s,BALANCE.player,s.balance.groundTopY);
  s.playerData.critChance=0;
  if(mode==='normal'){s.playerData.attack*=2;s.playerData.baseAttack*=2;}
  s.targeting=new TargetingSystem(s);s.combatSystem=new CombatSystem(s);
  s.enemyBehaviors=new EnemyBehaviorManager(s);s.stageSystem=new StageSystem(s);
  s.stageSystem.flowState='BOSS_FIGHT'; // Isolate a live fight from automatic next-wave rewards.
  const e=s.stageSystem.spawn(id,s.player.x+distance);
  s.movementSystem=new MovementSystem(s);s.gameSpeed=new GameSpeedSystem(s);
  const f={s,e,events,tweens,graphics,step(time){s.gameSpeed.gameplayTimeMs=time;s.movementSystem.update(time);s.combatSystem.update(time);s.stageSystem.update(time);},
    finish(){const c=e.knockbackTween.config;c.targets.t=1;c.onUpdate();c.onComplete();},
    destroy(){s.combatSystem.reset();s.enemyBehaviors.destroy();s.gameSpeed.destroy();graphics.forEach(g=>g.destroy());}};
  return f;
}
const enemyHits=f=>f.events.filter(v=>v.type===CombatEvents.PLAYER_DAMAGED);
const swings=f=>f.events.filter(v=>v.type===CombatEvents.PLAYER_ATTACK_RESOLVED);

// Reproduce the report at real ground-aligned centers, including the 86px edge.
for(const distance of [80,86]){
  const f=fixture('normal','grunt',distance),{s,e}=f;
  assert.notEqual(s.player.y,e.y,'real actors have different center heights');
  assert(s.combatSystem.chooseEnemyAttackTarget(e));
  f.step(0);
  assert.equal(e.hp,44);assert.equal(s.playerData.hp,499,'both ready basic attacks land');
  assert(e.isKnockbackActive);assert.equal(enemyHits(f).length,1);assert.equal(swings(f).length,1);
  assert.equal(e.nextAttackAt,2800);assert.equal(s.combatSystem.nextPlayerAttackAt,500);
  assert.equal(s.combatSystem.playerAttackRecoveryUntil,500);
  assert.equal(e.knockbackTween.config.duration,NORMAL_MODE_KNOCKBACK_DURATION_MS);
  assert.equal(s.combatSystem.pendingEnemyAttacks,null);
  f.finish();assert.equal(e.x,s.player.x+distance+144);assert.equal(e.landingRecoveryUntil,ENEMY_LANDING_STUN_MS);
  f.destroy();
}

// Independent release-time checks must agree with selection at their own range edge.
for(const id of ['elite_golden_guard','mountain_general','thornless_rose','uncrowned_king']){
  const f=fixture('normal',id),{s,e}=f,b=s.enemyBehaviors.items.get(e);
  e.x=s.player.x+e.attackRange;f.step(0);
  assert(b.until>0,id+': starts windup at exact horizontal range');
  f.step(b.until);assert.equal(enemyHits(f).length,1,id+': release-time range check agrees');
  f.destroy();
}
for(const [id,range,release] of [
  ['elite_berserker',AXE.range,b=>b.slash(0,true)],
  ['thornless_rose',ROSE.drainRange,b=>b.stab(0,true)],
  ['uncrowned_king',KING.thrustRange,b=>b.thrust(0,true)]
]){
  const f=fixture('normal',id);f.e.x=f.s.player.x+range;
  release(f.s.enemyBehaviors.items.get(f.e));
  assert.equal(enemyHits(f).length,1,id+': independent melee recheck uses the same distance');f.destroy();
}
{
  const f=fixture('normal','grunt',86.01);f.step(0);
  assert.equal(swings(f).length,0);assert.equal(enemyHits(f).length,0);
  assert.equal(f.e.nextAttackAt,0);assert.equal(f.s.combatSystem.nextPlayerAttackAt,0);f.destroy();
}
for(const reason of ['cooldown','recovery','landing','flight','freeze','gravity','offscreen','dead']){
  const f=fixture(),{s,e}=f;
  if(reason==='cooldown')e.nextAttackAt=1000;
  if(reason==='recovery')e.attackRecoveryUntil=1000;
  if(reason==='landing')e.landingRecoveryUntil=1000;
  if(reason==='flight')s.combatSystem.applyKnockback(e,{knockback:72});
  if(reason==='freeze')assert(applyEnemyCold(e,{sourceId:'test',now:0,data:{normalFreezeStacks:1,normalFreezeMs:1000}}).frozen);
  if(reason==='gravity')e.gravityReversalState={};
  if(reason==='offscreen'){e.x=2000;}
  if(reason==='dead'){e.hp=0;e.isDefeated=true;}
  f.step(0);assert.equal(enemyHits(f).length,0,reason+': no unearned attack');f.destroy();
}

// Enemies with their own state machines participate once, at their real release time.
for(const id of ['elite','armored_guard','charger','healer','elite_berserker','elite_war_drum_priest','elite_hell_envoy',
  'elite_golden_guard','mountain_general','thornless_rose','uncrowned_king','emperor','abyss_apostle']){
  const f=fixture('normal',id),{s,e}=f,b=s.enemyBehaviors.items.get(e);
  if(id==='healer')b.next=0;
  if(['elite_golden_guard','mountain_general','thornless_rose','uncrowned_king','emperor','abyss_apostle'].includes(id)){
    // Prepare the authored basic windup at its release deadline, rather than skipping it.
    s.combatSystem.nextPlayerAttackAt=1;
    f.step(0);
    assert(b.until>0,id+': actual windup started');
    s.combatSystem.nextPlayerAttackAt=b.until;
    f.step(b.until);
  }else f.step(0);
  assert.equal(swings(f).length,1,id+': one player release');
  assert.equal(enemyHits(f).length,1,id+': one enemy basic release despite same-frame player knockback');
  assert.equal(s.playerData.hp,500-Math.max(1,Math.round(e.damage)),id+': authored basic damage with existing integer HP rounding');
  assert(isAttackRecovering(e,s.getGameplayTime()),id+': existing recovery remains');
  const hits=enemyHits(f).length;f.step(s.getGameplayTime()+1);
  assert.equal(enemyHits(f).length,hits,id+': no duplicate stage/AI update or extra hit');
  f.destroy();
}

// Fatal simultaneous strikes are already released; future/unreleased attacks are cancelled.
{
  const f=fixture();f.e.hp=20;f.s.playerData.hp=1;f.step(0);
  assert(f.e.isDefeated);assert.equal(f.s.playerData.hp,0);assert.equal(enemyHits(f).length,1);
  assert(f.s.paused);assert.equal(f.s.combatSystem.pendingEnemyAttacks,null);f.destroy();
}
{
  const f=fixture();f.e.hp=20;f.e.nextAttackAt=1000;f.step(0);
  assert(f.e.isDefeated);assert.equal(enemyHits(f).length,0,'not ready before death means no retaliation');f.destroy();
}
for(const action of ['reset','pause','target-death','target-replacement']){
  const f=fixture(),{s,e}=f;
  s.eventBus.on(CombatEvents.PLAYER_ATTACK,()=>{
    if(action==='reset')s.combatSystem.reset();
    if(action==='pause')s.paused=true;
    if(action==='target-death'||action==='target-replacement')s.combatSystem.killEnemy(e);
    if(action==='target-replacement')s.stageSystem.spawn('grunt',s.player.x+60);
  });
  f.step(0);
  assert.equal(enemyHits(f).length,['reset','pause'].includes(action)?0:1,action+': only previously released strike survives');
  assert.equal(s.combatSystem.pendingEnemyAttacks,null);assert.equal(s.combatSystem.collectingEnemyAttacks,false);
  if(action==='target-replacement')assert.equal(s.enemies[0].hp,64,'new enemy gets no inherited strike or damage');
  f.destroy();
}
for(const control of ['freeze','gravity']){
  const f=fixture();f.s.eventBus.on(CombatEvents.PLAYER_ATTACK,()=>{
    if(control==='freeze')assert(applyEnemyCold(f.e,{now:0,data:{normalFreezeStacks:1,normalFreezeMs:1000}}).frozen);
    else f.e.gravityReversalState={};
  });
  f.step(0);assert.equal(enemyHits(f).length,1,control+': an already released strike still lands');f.destroy();
}
{
  const f=fixture(),{s}=f;
  s.eventBus.on(CombatEvents.PLAYER_DAMAGED,({enemy})=>s.combatSystem.killEnemy(enemy,{source:'reflect'}));
  f.step(0);assert.equal(enemyHits(f).length,1);assert(f.e.isDefeated);
  assert.equal(s.combatSystem.knockbackTargets.size,0);f.destroy();
}

// Frontline locks, summons, ranged targeting and radial skills retain their geometry.
{
  const f=fixture(),{s,e}=f;
  const wolf={type:'spiritWolf',x:s.player.x+30,y:e.y,hp:50,active:true,isAlive(){return this.hp>0;},takeDamage(v){this.hp-=v;}};
  s.skillSystem.passiveState.spiritWolves={wolves:[wolf]};f.step(0);
  assert.equal(wolf.hp,49);assert.equal(s.playerData.hp,500);assert.equal(e.lockedAttackTarget,wolf);
  wolf.y=e.y-100;e.lockedAttackTarget=null;assert.equal(s.combatSystem.chooseEnemyAttackTarget(e),null,'summons still use full distance');
  f.destroy();
}
{
  const f=fixture(),{s,e}=f;
  const wolf={type:'spiritWolf',x:s.player.x+30,y:e.y,hp:50,active:true,isAlive(){return this.hp>0;},takeDamage(v){this.hp-=v;}};
  s.skillSystem.passiveState.spiritWolves={wolves:[wolf]};
  s.eventBus.on(CombatEvents.PLAYER_ATTACK,()=>{wolf.hp=0;});f.step(0);
  assert.equal(s.playerData.hp,500,'a released hit aimed at a dead summon does not transfer to the player');
  assert.equal(enemyHits(f).length,0);f.destroy();
}
{
  const f=fixture('normal','archer',450),{s,e}=f;
  assert.equal(s.combatSystem.chooseEnemyAttackTarget(e),null,'ranged boundary retains vertical component');
  s.player.y=e.y;assert(s.combatSystem.chooseEnemyAttackTarget(e));
  s.player.y=e.y-120;
  assert.equal(s.combatSystem.damageTargetsInRadius(s.player.x,e.y,86,10,{enemy:e,source:'ground',attackType:'ground'}).length,0);
  f.destroy();
}

// Exercise the production scene frame at each speed, with an actual pause between frames.
for(const speed of [1,1.5,2]){
  const f=fixture(),{s}=f;let updates=0;
  const update=s.enemyBehaviors.update.bind(s.enemyBehaviors);
  s.enemyBehaviors.update=t=>{updates++;update(t);};s.gameSpeed.setSpeed(speed);
  frame.call(s,0,10);assert.equal(updates,1);assert.equal(enemyHits(f).length,1);assert.equal(swings(f).length,1);
  assert.equal(f.e.knockbackUntil,10*speed+500);
  s.paused=true;frame.call(s,0,1000);assert.equal(updates,1);assert.equal(s.getGameplayTime(),10*speed);
  s.paused=false;frame.call(s,0,10);assert.equal(updates,2);assert.equal(enemyHits(f).length,1);
  f.destroy();
}
for(const distance of [80,86]){
  const f=fixture('test','grunt',distance);f.step(0);
  assert.equal(enemyHits(f).length,0,'test mode keeps player-first knockback');
  assert.equal(f.s.combatSystem.playerAttackRecoveryUntil,0);assert.equal(swings(f).length,1);f.destroy();
}
{
  const f=fixture('test','grunt',86);assert.equal(f.s.combatSystem.chooseEnemyAttackTarget(f.e),null,'legacy distance remains Euclidean');f.destroy();
}
console.log('PASS 01159: real 86px boundary and simultaneous basic strikes; 13 authored melee AI releases; blocked controls/cooldowns, fatal trades, reset/pause/reflect/death/replacement; frontline/ranged/AOE geometry, one AI update per real scene frame at 1/1.5/2x and legacy test mode.');
