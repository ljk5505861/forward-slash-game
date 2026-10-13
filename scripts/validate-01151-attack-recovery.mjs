import assert from 'node:assert/strict';
import CombatSystem,{NORMAL_ATTACK_KNOCKBACK_DURATION_MS,NORMAL_ATTACK_KNOCKBACK_LIFT_PX,ENEMY_LANDING_STUN_MS,TEST_ENEMY_LANDING_STUN_MS,isEnemyLandingStunned,isAttackRecovering,ATTACK_RECOVERY_RATIO,MIN_PLAYER_ATTACK_INTERVAL_MS} from '../src/systems/CombatSystem.js';
import GameSpeedSystem from '../src/systems/GameSpeedSystem.js';
import { applyEnemyGravity, getEnemyAttackDelay } from '../src/systems/EnemyGravityControl.js';
import StageSystem from '../src/systems/StageSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import {BALANCE} from '../src/config/balance.js';
import MovementSystem from '../src/systems/MovementSystem.js';

import {WEAPONS} from '../src/config/weapons.js';
import {CombatEvents} from '../src/core/CombatEvents.js';

// Run production movement, combat, targeting and behavior updates with rendering-only DOM shims.
global.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
global.document={documentElement:{style:{}},createElement(){return {getContext(){return new Proxy({},{get(_,k){ if(k==='getImageData') return ()=>({data:[0,0,0,0]}); return ()=>{}; }});},style:{}};},addEventListener(){},removeEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:global.window.navigator,configurable:true});
global.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } };
global.HTMLCanvasElement=class {};
const {default:EnemyBehaviorManager}=await import('../src/enemies/behaviors/EnemyBehaviorManager.js');

function node(x=0,y=0,width=0,height=0) {
  const n={x,y,width,height,active:true,alpha:1,destroy(){this.active=false;},
    setPosition(x,y){this.x=x;this.y=y;return this;},setX(x){this.x=x;return this;},
    setText(text){this.text=text;return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},add(){return this;}};
  for(const key of ['setStrokeStyle','setDepth','setOrigin','setVisible','setAlpha','setFillStyle','setScale',
    'clear','lineStyle','lineBetween','strokeCircle','strokeRect','fillStyle','fillRect','setRotation',
    'fillRoundedRect','strokeRoundedRect','fillCircle','fillEllipse','strokeEllipse','fillTriangle','strokeTriangle','beginPath','moveTo','lineTo','closePath','strokePath','fillPath','strokePoints','fillPoints'])n[key]=()=>n;
  n.body={enable:true,velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){n.x=x;n.y=y;},
    setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}};
  return n;
}
function fixture(runMode='normal',id='grunt') {
  const tweens=[],hits=[],events=[],listeners=new Map(),graphics=[];
  const s={runMode,now:0,paused:false,enemies:[],killCount:0,balance:{...BALANCE,stageWorldWidth:4000,groundTopY:1000},
    player:node(400,960,45,78),playerData:{hp:1000,maxHp:1000,baseMaxHp:1000,baseAttack:2,baseDefense:0,
      skills:[],mana:1000,maxMana:1000,skillDamageMultiplier:1,weaponId:'short_sword'},
    cameras:{main:{worldView:{x:0,width:720},width:720,scrollX:0}},getGameplayTime(){return this.now;},
    isGameplayPaused(){return this.paused;},physics:{add:{existing(){}}},hud:{update(){},setStatus(){}},floatText(){},finishRun(){this.paused=true;},
    time:{delayedCall(){return {remove(){}};}},
    events:{on(){},once(){},off(){}},artifactSystem:{level:()=>0,highHpDamageMultiplier:()=>1},
    eventBus:{on(type,fn){const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);return ()=>set.delete(fn);},
      emit(type,payload){events.push({type,payload});for(const fn of [...(listeners.get(type)||[])])fn(payload);}},
    add:{rectangle:(...a)=>Object.assign(node(...a),{scene:s}),text:(x,y)=>node(x,y),circle:node,ellipse:node,triangle:node,container:node,
      graphics:()=>{const g=node();graphics.push(g);return g;}},
    tweens:{add(config){const t={config,stopped:false,removed:false,paused:false,
      stop(){this.stopped=true;},remove(){this.removed=true;},pause(){this.paused=true;},resume(){this.paused=false;}};
      tweens.push(t);return t;}}};
  s.targeting=new TargetingSystem(s);s.combatSystem=new CombatSystem(s);s.stageSystem=new StageSystem(s);
  const e=s.stageSystem.spawn(id,500);e.isKnockbackActive=false;s.enemyBehaviors=new EnemyBehaviorManager(s);s.enemyBehaviors.attach(e);
  if(id==='foreseer_orb'){e.foreseerOwner=s.stageSystem.spawn('foreseer',680);e.foreseerExpiresAt=20000;}
  const damage=s.combatSystem.damageAttackTarget.bind(s.combatSystem);
  s.combatSystem.damageAttackTarget=(target,amount,meta)=>{const result=damage(target,amount,meta);hits.push({target,amount,meta,result});return result;};
  return {s,e,tweens,hits,events,graphics,finish(target=e){const c=target.knockbackTween.config;c.targets.t=1;c.onUpdate();c.onComplete();},
    destroy(){s.enemyBehaviors.destroy();s.skillSystem?.reset();s.combatSystem.clearAllKnockbacks();graphics.forEach(g=>g.destroy());}};
}

const closeToEnemy = f => { f.s.player.x=f.e.x-45;f.s.player.y=f.e.y; };
const approx = (a,b,label) => assert(Math.abs(a-b)<1e-8,`${label}: ${a} !== ${b}`);
const playerHits = f => f.events.filter(v=>v.type===CombatEvents.PLAYER_ATTACK_RESOLVED).length;

// A real player release stops movement even after its target is knocked out of reach.
for(const multiplier of [.5,1,1.5,1000]) {
  const f=fixture();closeToEnemy(f);f.s.playerData.attackSpeedMultiplier=multiplier;
  const c=f.s.combatSystem,interval=c.getPlayerAttackInterval(WEAPONS.short_sword);
  c.update(0);assert.equal(playerHits(f),1);assert.equal(f.s.player.body.velocity.x,0);
  approx(c.playerAttackRecoveryUntil,interval*ATTACK_RECOVERY_RATIO,'player recovery');
  assert.equal(c.nextPlayerAttackAt,interval,'recovery is part of the attack cycle');
  if(multiplier===1000)assert.equal(interval,MIN_PLAYER_ATTACK_INTERVAL_MS,'existing attack-speed limit');
  f.finish();const movement=new MovementSystem(f.s);
  f.s.now=c.playerAttackRecoveryUntil-.01;movement.update(f.s.now);assert.equal(f.s.player.body.velocity.x,0);
  f.s.now=c.playerAttackRecoveryUntil;movement.update(f.s.now);assert(f.s.player.body.velocity.x>0);
  closeToEnemy(f);f.s.now=interval-.01;c.update(f.s.now);assert.equal(playerHits(f),1);
  f.s.now=interval;c.update(f.s.now);assert.equal(playerHits(f),2,'no additional recovery added to next attack');
  f.destroy();
}
{
  const times=[];
  for(const multiplier of [.5,1]) {
    const f=fixture();closeToEnemy(f);f.s.playerData.attackSpeedMultiplier=multiplier;
    f.s.combatSystem.update(0);times.push(f.s.combatSystem.playerAttackRecoveryUntil);f.destroy();
  }
  approx(times[0]/2,times[1],'doubling effective player attack speed halves recovery');
}
{
  const f=fixture();closeToEnemy(f);f.s.playerData.attackSpeedMultiplierBonuses.item=.5;
  f.s.combatSystem.update(0);
  approx(f.s.combatSystem.playerAttackRecoveryUntil,WEAPONS.short_sword.attackIntervalMs/1.5*ATTACK_RECOVERY_RATIO,'item attack speed also shortens recovery');f.destroy();
}
// Synchronous target death, with or without a replacement, cannot cancel the player's recovery.
for(const replacement of [false,true]) {
  const f=fixture();closeToEnemy(f);
  f.s.eventBus.on(CombatEvents.PLAYER_ATTACK,()=>{
    f.s.combatSystem.killEnemy(f.e);
    if(replacement)f.s.stageSystem.spawn('grunt',f.s.player.x+45);
  });
  f.s.combatSystem.update(0);assert(f.e.isDefeated);
  new MovementSystem(f.s).update(1);assert.equal(f.s.player.body.velocity.x,0);
  assert(f.s.combatSystem.isPlayerAttackRecovering(1));assert.equal(playerHits(f),1);
  f.destroy();
}
// Missing targets spend neither an attack nor recovery; test mode retains its previous movement.
for(const mode of ['normal','test']) {
  const f=fixture(mode);f.s.player.x=10;f.s.combatSystem.update(0);
  assert.equal(f.s.combatSystem.playerAttackRecoveryUntil,0);assert.equal(playerHits(f),0);
  if(mode==='test') {
    closeToEnemy(f);f.s.combatSystem.update(0);f.finish();
    assert.equal(f.s.combatSystem.playerAttackRecoveryUntil,0);
    new MovementSystem(f.s).update(1);assert(f.s.player.body.velocity.x>0);
  }
  f.destroy();
}

function firstRelease(f) {
  closeToEnemy(f);
  for(let t=0;t<=4000;t+=5) {
    f.s.now=t;f.s.enemyBehaviors.update(t);f.s.combatSystem.updateEnemyAttack(f.e,t);
    if(isAttackRecovering(f.e,t))return {time:t,duration:f.e.attackRecoveryUntil-t};
  }
  assert.fail(`${f.e.enemyId} never entered recovery after its first ordinary release`);
}
// Normal, elite and boss paths use their real manager helpers and state machines.
const ids=['grunt','elite','armored_guard','charger','archer','bomber','healer',
  'elite_berserker','elite_war_drum_priest','elite_hell_envoy','hell_head','hell_small',
  'elite_golden_guard','elite_sharpshooter','elite_thunder_mage','elite_gambler',
  'berserker_boss','boss','mountain_general','thornless_rose','uncrowned_king',
  'foreseer','foreseer_orb','emperor','abyss_apostle'];
for(const id of ids) {
  const durations=[];
  for(const speed of [1,2]) {
    const f=fixture('normal',id);f.e.attackIntervalMs/=speed;
    const {time,duration}=firstRelease(f);durations.push(duration);
    const interval=getEnemyAttackDelay(f.e,f.e.attackIntervalMs,time);
    assert(duration>0&&duration<=interval,`${id}: recovery fits the attack cycle`);
    const b=f.s.enemyBehaviors.items.get(f.e);
    if(['recovery','attackRecovery','punchRecovery','shadowAttackRecovery'].includes(b?.state))
      approx(b.until,f.e.attackRecoveryUntil,`${id}: existing normal recovery scales too`);
    f.s.player.x=f.e.x-f.e.attackRange-100;f.s.now=time+duration/2;
    f.s.enemyBehaviors.update(f.s.now);assert.equal(f.e.body.velocity.x,0,`${id}: no chasing during recovery`);
    f.s.now=time+duration;f.s.enemyBehaviors.update(f.s.now);
    assert(!isAttackRecovering(f.e,f.s.now),`${id}: recovery ends on its deadline`);
    if(id==='grunt')assert(f.e.body.velocity.x<0,'ordinary chase resumes at recovery deadline');
    f.destroy();
  }
  approx(durations[0]/2,durations[1],`${id}: twice the attack speed halves recovery`);
}
{
  const f=fixture();closeToEnemy(f);f.s.combatSystem.updateEnemyAttack(f.e,0);
  const hp=f.s.playerData.hp;f.e.nextAttackAt=0;f.s.combatSystem.updateEnemyAttack(f.e,1);
  assert.equal(f.s.playerData.hp,hp,'a ready attack clock cannot bypass ongoing recovery');f.destroy();
}
// Real drum buffs and gravity attack slows feed the same effective attack interval.
{
  const f=fixture(),base=f.e.attackIntervalMs;
  const drummer=f.s.stageSystem.spawn('elite_war_drum_priest',650),b=f.s.enemyBehaviors.items.get(drummer);
  b.pulse([f.e],0);assert(f.e.attackIntervalMs<base);closeToEnemy(f);
  f.s.combatSystem.updateEnemyAttack(f.e,0);
  approx(f.e.attackRecoveryUntil,f.e.attackIntervalMs*ATTACK_RECOVERY_RATIO,'drum buff recovery');f.destroy();
}
{
  const f=fixture();closeToEnemy(f);
  applyEnemyGravity(f.e,{sourceId:'recovery-test',expiresAt:Infinity,attackSlow:.5});
  f.s.combatSystem.updateEnemyAttack(f.e,0);
  approx(f.e.attackRecoveryUntil,f.e.attackIntervalMs*2*ATTACK_RECOVERY_RATIO,'gravity attack slow recovery');f.destroy();
}
// Normal projectile recovery begins at launch and never freezes/restarts the projectile on impact.
for(const id of ['elite_sharpshooter','elite_thunder_mage','elite_gambler']) {
  const f=fixture('normal',id),{time}=firstRelease(f),until=f.e.attackRecoveryUntil;
  const b=f.s.enemyBehaviors.items.get(f.e),projectile=b.arrows?.[0]||b.bolt||b.card;
  assert(projectile,`${id}: projectile released`);const startX=projectile.p.x;
  f.s.now=time+100;f.s.enemyBehaviors.update(f.s.now);
  assert(f.hits.length||projectile.p.x!==startX,`${id}: flight advances during recovery`);
  assert.equal(f.e.attackRecoveryUntil,until,`${id}: impact does not restart recovery`);
  f.destroy();
}
// Deliberate skill burst spacing and skill recovery do not gain ordinary-attack recovery.
{
  const f=fixture('normal','elite_sharpshooter');closeToEnemy(f);
  const b=f.s.enemyBehaviors.items.get(f.e);assert(b.shoot(0,true));
  assert.equal(f.e.attackRecoveryUntil||0,0,'burst shot preserves its own timing');f.destroy();
}
{
  const f=fixture('normal','berserker_boss'),b=f.s.enemyBehaviors.items.get(f.e);
  b.finishCharge(0);assert.equal(b.state,'recovery');
  assert.equal(b.recoverUntil,getEnemyAttackDelay(f.e,f.e.chargeRecoveryMs||800,0));
  assert.equal(f.e.attackRecoveryUntil||0,0,'skill recovery is independent');f.destroy();
}
// Dodge still consumes a released attack; reflected death clears committed recovery synchronously.
{
  const f=fixture();closeToEnemy(f);f.s.playerData.dodgeChance=1;
  const random=Math.random;try {Math.random=()=>0;f.s.combatSystem.updateEnemyAttack(f.e,0);} finally {Math.random=random;}
  assert.equal(f.s.playerData.hp,1000);
  assert(isAttackRecovering(f.e,0),'a dodged release still recovers');f.destroy();
}
{
  const f=fixture('normal','charger');closeToEnemy(f);
  f.s.eventBus.on(CombatEvents.PLAYER_DAMAGED,({enemy})=>{
    f.s.combatSystem.damageEnemy(enemy,enemy.hp,{source:'reflect',noKnockback:true});
  });
  // The release may destroy its behavior inside damage, before manager.update returns.
  f.s.enemyBehaviors.update(0);assert(f.e.isDefeated);
  assert.equal(f.e.attackRecoveryUntil,0);f.destroy();
}
// Gameplay time freezes on pause and scales with game speed, without consuming recovery twice.
{
  const f=fixture();closeToEnemy(f);const clock=new GameSpeedSystem(f.s),c=f.s.combatSystem;
  c.updateEnemyAttack(f.e,0);c.update(0);const playerUntil=c.playerAttackRecoveryUntil,enemyUntil=f.e.attackRecoveryUntil;
  f.s.paused=true;f.s.enemyBehaviors.pause();f.s.now=clock.advance(1000,true);
  new MovementSystem(f.s).update(f.s.now);c.update(f.s.now);
  assert.equal(f.s.now,0);assert.equal(c.playerAttackRecoveryUntil,playerUntil);assert.equal(f.e.attackRecoveryUntil,enemyUntil);
  f.s.paused=false;f.s.enemyBehaviors.resume();clock.setSpeed(2);
  f.s.now=clock.advance(playerUntil/2);assert(!c.isPlayerAttackRecovering(f.s.now));
  assert(isAttackRecovering(f.e,f.s.now));clock.destroy();f.destroy();
}
// Landing recovery is a fixed 200ms in normal mode and remains 100ms in test mode.
for(const mode of ['normal','test']) {
  const f=fixture(mode);f.s.now=500;f.s.combatSystem.applyKnockback(f.e,{knockback:72});
  f.s.now+=NORMAL_ATTACK_KNOCKBACK_DURATION_MS;f.finish();
  const duration=mode==='normal'?ENEMY_LANDING_STUN_MS:TEST_ENEMY_LANDING_STUN_MS;
  assert.equal(duration,mode==='normal'?200:100);assert.equal(f.e.landingRecoveryUntil,f.s.now+duration);
  closeToEnemy(f);f.s.now+=duration-1;const hp=f.s.playerData.hp;
  f.s.enemyBehaviors.update(f.s.now);f.s.combatSystem.updateEnemyAttack(f.e,f.s.now);
  assert.equal(f.e.body.velocity.x,0);assert.equal(f.s.playerData.hp,hp);
  f.s.now++;assert(!isEnemyLandingStunned(f.e,f.s.now));
  f.s.combatSystem.updateEnemyAttack(f.e,f.s.now);assert(f.s.playerData.hp<hp);f.destroy();
}
// Explicit timer shifting, run reset and recycled entities cannot leave stale recovery.
{
  const f=fixture();closeToEnemy(f);f.s.combatSystem.updateEnemyAttack(f.e,0);f.s.combatSystem.update(0);
  const c=f.s.combatSystem,playerUntil=c.playerAttackRecoveryUntil,enemyUntil=f.e.attackRecoveryUntil;
  f.e.landingRecoveryUntil=200;c.shiftTimers(100,0);
  approx(c.playerAttackRecoveryUntil,playerUntil+100,'shift player recovery');
  approx(f.e.attackRecoveryUntil,enemyUntil+100,'shift enemy recovery');assert.equal(f.e.landingRecoveryUntil,300);
  c.reset();assert.equal(c.playerAttackRecoveryUntil,0);assert.equal(f.e.attackRecoveryUntil,0);assert.equal(f.e.landingRecoveryUntil,0);
  c.startEnemyAttackRecovery(f.e,0);f.s.enemyBehaviors.recycleEnemy(f.e);assert.equal(f.e.attackRecoveryUntil,0);
  f.destroy();
}
console.log(`PASS 01151: real player and ${ids.length} enemy paths; attack-speed scaling, movement lock, projectile flight, authored boss recovery, target death, dodge/reflect, pause/speed, 200ms landing, test-mode isolation and cleanup.`);
