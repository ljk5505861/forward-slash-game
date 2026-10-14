import assert from 'node:assert/strict';
import CombatSystem,{NORMAL_ATTACK_KNOCKBACK_DURATION_MS,NORMAL_ATTACK_KNOCKBACK_LIFT_PX,ENEMY_LANDING_STUN_MS,TEST_ENEMY_LANDING_STUN_MS,isEnemyLandingStunned,isAttackRecovering,ATTACK_RECOVERY_RATIO,MIN_PLAYER_ATTACK_INTERVAL_MS} from '../src/systems/CombatSystem.js';
import { applyEnemyGravity, getEnemyAttackDelay, getEnemyMoveSpeed } from '../src/systems/EnemyGravityControl.js';
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
function fixture(runMode='normal',id='grunt',level=1) {
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
  s.targeting=new TargetingSystem(s);s.combatSystem=new CombatSystem(s);s.stageSystem=new StageSystem(s);s.stageSystem.currentEnemyLevel=level;
  const e=s.stageSystem.spawn(id,500);e.isKnockbackActive=false;s.enemyBehaviors=new EnemyBehaviorManager(s);s.enemyBehaviors.attach(e);
  if(id==='foreseer_orb'){e.foreseerOwner=s.stageSystem.spawn('foreseer',680);e.foreseerExpiresAt=20000;}
  const damage=s.combatSystem.damageAttackTarget.bind(s.combatSystem);
  s.combatSystem.damageAttackTarget=(target,amount,meta)=>{const result=damage(target,amount,meta);hits.push({target,amount,meta,result});return result;};
  return {s,e,tweens,hits,events,graphics,finish(target=e){const c=target.knockbackTween.config;c.targets.t=1;c.onUpdate();c.onComplete();},
    destroy(){s.enemyBehaviors.destroy();s.skillSystem?.reset();s.combatSystem.clearAllKnockbacks();graphics.forEach(g=>g.destroy());}};
}

const {default:GetEaseFunction}=await import('../node_modules/phaser/src/tweens/builders/GetEaseFunction.js');
const near=(a,b,label)=>assert(Math.abs(a-b)<1e-6,`${label}: ${a} != ${b}`);
const ids=['grunt','elite','armored_guard','archer','mountain_general','thornless_rose',
  'uncrowned_king','foreseer','abyss_apostle','boss'];
for(const id of ids)for(const mode of ['normal','test']) {
  const f=fixture(mode,id),startX=f.e.x,groundY=f.e.y;
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));const c=f.e.knockbackTween.config;
  assert.equal(c.ease,mode==='normal'?'Linear':'Sine.easeOut');
  const easing=GetEaseFunction(c.ease);let previousX=startX,previousTime=0;
  for(const fraction of [.1,.3,.6,.9]) {
    const elapsed=fraction*c.duration;c.targets.t=easing(fraction);f.s.now=elapsed;c.onUpdate();
    if(mode==='normal')near(Math.abs(f.e.x-previousX)/(elapsed-previousTime),Math.abs(f.e.x-startX)/elapsed,`${id}: constant horizontal speed`);
    previousX=f.e.x;previousTime=elapsed;
    assert(f.e.isKnockbackActive);assert.equal(f.e.landingRecoveryUntil||0,0,'no landing stun while flying');
  }
  f.s.now=c.duration;f.finish();
  if(mode==='normal')assert.equal(c.duration,1000,`${id}: fixed one-second flight`);
  else assert.equal(c.duration,['mountain_general','uncrowned_king','foreseer','abyss_apostle'].includes(id)?150:id==='thornless_rose'?140:440,'legacy test flight is unchanged');
  assert.equal(f.e.y,groundY);assert(!f.e.isKnockbackActive);
  assert.equal(f.e.landingRecoveryUntil||0,f.e.isBoss?0:f.s.now+(mode==='normal'?200:100));f.destroy();
}
// Different knockback distances and actor movement speeds must never change flight time.
{
  const durations=[];
  for(const distance of [36,72,144])for(const speed of [0,40,120,240]) {
    const f=fixture();f.e.speed=speed;f.s.combatSystem.applyKnockback(f.e,{knockback:distance});
    const c=f.e.knockbackTween.config;durations.push(c.duration);
    f.s.now=1000;f.finish();near(f.e.x,500+distance*4,'requested distance preserved');f.destroy();
  }
  assert(durations.every(duration=>duration===1000),'distance and speed do not change one-second duration');
}
// Real movement increases from the last version's 60 to 90px/s for the ordinary warrior.
{
  const f=fixture();assert.equal(f.e.speed,120);assert.equal(getEnemyMoveSpeed(f.e,f.e.speed,0),90);
  f.s.player.x=0;f.s.player.y=f.e.y;f.s.enemyBehaviors.update(0);assert.equal(f.e.body.velocity.x,-90);f.destroy();
}
// Slows and boundary-clamped distances also keep the same fixed flight time.
{
  const f=fixture();applyEnemyGravity(f.e,{sourceId:'flight-slow',moveSlow:.5,expiresAt:Infinity});
  assert.equal(getEnemyMoveSpeed(f.e,f.e.speed,0),45);
  f.s.combatSystem.applyKnockback(f.e,{knockback:72});assert.equal(f.e.knockbackTween.config.duration,1000,'slowed flight');f.destroy();
}
for(const x of [3950,3966]) {
  const f=fixture();f.e.x=x;f.s.combatSystem.applyKnockback(f.e,{knockback:72});
  const c=f.e.knockbackTween.config;assert(Number.isFinite(c.duration)&&c.duration>0);
  assert.equal(c.duration,1000,'boundary, including zero distance, preserves duration');
  f.finish();assert.equal(f.e.x,3966);f.destroy();
}
// Zero-speed actors still finish rather than creating an infinite-duration tween.
{
  const f=fixture();f.e.coldSources=new Map([['freeze',{expiresAt:Infinity,frozenUntil:5000}]]);
  assert.equal(getEnemyMoveSpeed(f.e,f.e.speed,0),0,'production cold control freezes movement');
  f.s.combatSystem.applyKnockback(f.e,{knockback:72});
  assert.equal(f.e.knockbackTween.config.duration,1000,'frozen flight is independent of movement');
  f.finish();assert(!f.e.isKnockbackActive);f.destroy();
}
{
  const f=fixture();f.e.speed=0;f.s.combatSystem.applyKnockback(f.e,{knockback:72});
  assert.equal(f.e.knockbackTween.config.duration,1000);f.finish();assert(!f.e.isKnockbackActive);f.destroy();
}
// Repeated hits replace the old tween with a fresh one-second flight, retaining the landing ground.
{
  const f=fixture(),groundY=f.e.y;f.s.combatSystem.applyKnockback(f.e,{knockback:72});
  const old=f.e.knockbackTween;old.config.targets.t=.5;f.s.now=500;old.config.onUpdate();
  f.s.combatSystem.applyKnockback(f.e,{knockback:36});
  assert(old.stopped&&old.removed);assert.equal(f.e.knockbackTween.config.duration,1000);
  assert.equal(f.e.knockbackUntil,1500);assert.equal(f.e.landingRecoveryUntil||0,0);
  f.s.now=1500;f.finish();assert.equal(f.e.y,groundY);assert.equal(f.e.landingRecoveryUntil,1700);f.destroy();
}
// Airborne control lasts until the actual new landing time, then exactly 200ms more.
{
  const f=fixture();f.s.combatSystem.applyKnockback(f.e,{knockback:72});const c=f.e.knockbackTween.config;
  f.s.now=c.duration-1;c.targets.t=GetEaseFunction(c.ease)((c.duration-1)/c.duration);c.onUpdate();
  f.s.player.x=f.e.x-45;f.s.player.y=f.e.y;f.s.combatSystem.updateEnemyAttack(f.e,f.s.now);assert.equal(f.s.playerData.hp,1000);
  f.s.now=c.duration;f.finish();f.s.player.y=f.e.y;f.s.now+=199;
  f.s.combatSystem.updateEnemyAttack(f.e,f.s.now);assert.equal(f.s.playerData.hp,1000);
  f.s.now++;f.s.combatSystem.updateEnemyAttack(f.e,f.s.now);assert(f.s.playerData.hp<1000);f.destroy();
}
console.log('PASS fixed flight: real Phaser easing; 20 ordinary/elite/boss mode paths; fixed 1000ms across distance/speed/slow/freeze/boundary/relaunch; movement remains 90px/s; legacy test mode and 200ms landing control preserved.');
