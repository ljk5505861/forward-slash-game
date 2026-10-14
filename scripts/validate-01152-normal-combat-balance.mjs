import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import CombatSystem,{NORMAL_ATTACK_KNOCKBACK_DURATION_MS,NORMAL_MODE_KNOCKBACK_DURATION_MS,NORMAL_ATTACK_KNOCKBACK_LIFT_PX,ENEMY_LANDING_STUN_MS,TEST_ENEMY_LANDING_STUN_MS,isEnemyLandingStunned,isAttackRecovering,ATTACK_RECOVERY_RATIO,MIN_PLAYER_ATTACK_INTERVAL_MS} from '../src/systems/CombatSystem.js';
import { applyEnemyGravity, getEnemyAttackDelay, getEnemyMoveSpeed } from '../src/systems/EnemyGravityControl.js';
import StageSystem from '../src/systems/StageSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import {BALANCE,createPlayerRuntime,getEffectiveAttack} from '../src/config/balance.js';
import {ENEMIES,MOUNTAIN_GENERAL_TUNING,THORNLESS_ROSE_TUNING} from '../src/config/enemies.js';
import MovementSystem from '../src/systems/MovementSystem.js';

import {WEAPONS} from '../src/config/weapons.js';
import {CombatEvents,RunStates} from '../src/core/CombatEvents.js';

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

// Execute the production startRun method, retaining its actual duplicate-start guard.
const source=fs.readFileSync(new URL('../src/scenes/GameScene.js',import.meta.url),'utf8');
const entry=source.slice(source.indexOf('  startRun(mode){'),source.indexOf('  showStartingSkillChoice(){'));
const Entry=vm.runInNewContext(`(class {${entry}})`,{RunStates});
function start(mode) {
  const s=new Entry();s.runMode=null;s.playerData=createPlayerRuntime();s.starts=0;
  s.stageSystem={start(){s.starts++;}};s.hud={setStatus(){}};s.endGameplayPause=()=>{};
  s.showStartingSkillChoice=()=>{};
  assert(s.startRun(mode));return s;
}
for(const mode of ['normal','test']) {
  for(let restart=0;restart<2;restart++) {
    const s=start(mode),attack=mode==='normal'?20:10;
    assert.equal(s.playerData.attack,attack);assert.equal(s.playerData.baseAttack,attack);
    assert.equal(getEffectiveAttack(s.playerData),attack);
    assert.equal(s.startRun(mode),false);assert.equal(s.starts,1);assert.equal(s.playerData.attack,attack);
    s.playerData.attackBonuses.item=1;assert.equal(getEffectiveAttack(s.playerData),attack+1,'flat item bonus remains +1');
  }
  const f=fixture(mode);f.s.playerData=start(mode).playerData;f.s.playerData.critChance=0;
  f.s.player.x=f.e.x-45;f.s.player.y=f.e.y;
  const before=f.e.hp;f.s.combatSystem.update(0);
  assert.equal(before-f.e.hp,mode==='normal'?20:10,'real ordinary attack uses the new opening attack');f.destroy();
}

// Spawn actual normal, elite, boss and summoned enemies at early and late levels.
let spawns=0;
for(const mode of ['normal','test'])for(const level of [1,8])for(const id of Object.keys(ENEMIES)) {
  const f=fixture(mode,id,level),config=f.s.stageSystem.tunedEnemy(id),factor=mode==='normal'?.5:1;
  assert.equal(f.e.damage,config.damage*factor,`${mode}/${id}/Lv${level}: base damage`);
  for(const key of ['chargeDamage','bombDamage','slamDamage']) {
    const old=config[key]===undefined?undefined:Math.max(1,Math.round(config[key]*(config.damage||1)/(ENEMIES[id].damage||1)));
    assert.equal(f.e[key],old===undefined?undefined:old*factor,`${mode}/${id}: ${key} scales once`);
  }
  assert.equal(getEnemyAttackDelay(f.e,f.e.attackIntervalMs,0),f.e.attackIntervalMs,'attack speed is unchanged');
  assert.equal(f.e.hp,config.hp,'enemy health is unchanged');
  assert.equal(f.e.speed,config.speed,'canonical movement input is not scaled twice');
  assert.equal(getEnemyMoveSpeed(f.e,f.e.speed,0),f.e.speed*(mode==='normal'?.75:1),`${mode}/${id}: real movement speed`);
  spawns++;f.destroy();
}

// Real pursuit and retreat use the halved rate, while attacks retain their timing.
{
  const f=fixture('normal','foreseer');f.s.player.x=f.e.x-45;f.s.player.y=f.e.y;
  f.s.enemyBehaviors.items.get(f.e).nextAttack=1000; // Retreat between beam casts, rather than during windup.
  f.s.enemyBehaviors.update(0);
  assert.equal(f.e.body.velocity.x,f.e.speed*.75,'actual ranged retreat uses current movement multiplier');f.destroy();
}
for(const mode of ['normal','test'])for(const id of ['grunt','archer','mountain_general']) {
  const f=fixture(mode,id);f.s.player.x=0;f.s.player.y=f.e.y;f.s.enemyBehaviors.update(0);
  assert.equal(Math.abs(f.e.body.velocity.x),f.e.speed*(mode==='normal'?.75:1),`${mode}/${id}: actual pursuit velocity`);
  f.destroy();
}
{
  const f=fixture('normal','mountain_general'),b=f.s.enemyBehaviors.items.get(f.e);b.startCharge(0);
  assert.equal(Math.abs(f.e.body.velocity.x),MOUNTAIN_GENERAL_TUNING.chargeSpeed*.75,'actual boss charge velocity retains the current movement multiplier');f.destroy();
}
{
  const f=fixture('normal','thornless_rose'),b=f.s.enemyBehaviors.items.get(f.e);b.startDash(0);
  assert.equal(Math.abs(f.e.body.velocity.x),THORNLESS_ROSE_TUNING.dashSpeed*.75,'actual boss dash velocity retains the current movement multiplier');f.destroy();
}
{
  const f=fixture();applyEnemyGravity(f.e,{sourceId:'move-test',expiresAt:Infinity,moveSlow:.5});
  assert.equal(getEnemyMoveSpeed(f.e,f.e.speed,0),f.e.speed*.375,'existing movement slow combines once with balance reduction');f.destroy();
}
for(const mode of ['normal','test']) {
  const f=fixture(mode);f.s.player.x=f.e.x-45;f.s.player.y=f.e.y;
  f.s.combatSystem.updateEnemyAttack(f.e,0);
  assert.equal(f.s.playerData.hp,1000-(mode==='normal'?1:2),'real grunt damage uses halved normal attack; legacy difficulty scaling is preserved');
  assert.equal(f.e.nextAttackAt,f.e.attackIntervalMs,'damage reduction does not change attack rate');
  const ally={type:'spiritWolf',x:455,y:f.e.y,hp:100,isAlive(){return this.hp>0;},takeDamage(amount){this.hp-=amount;}};
  f.s.combatSystem.damageAttackTarget(ally,f.e.damage*2,{enemy:f.e,source:'enemyMelee'});
  assert.equal(ally.hp,100-f.e.damage*2,'summons receive the same reduced enemy attack');f.destroy();
}

// Extra outgoing distance is applied after resistance/caps, and never to incoming displacement.
for(const mode of ['normal','test']) {
  const f=fixture(mode);f.s.combatSystem.applyKnockback(f.e,{knockback:72});
  assert.equal(f.e.knockbackTween.config.duration,mode==='normal'?NORMAL_MODE_KNOCKBACK_DURATION_MS:NORMAL_ATTACK_KNOCKBACK_DURATION_MS);
  f.finish();assert.equal(f.e.x,500+(mode==='normal'?144:72));
  assert.equal(f.e.landingRecoveryUntil,mode==='normal'?200:100);
  const x=f.s.player.x;f.s.combatSystem.damagePlayer({x:500},6,{source:'emperorKick',knockbackDistance:96});
  assert.equal(f.s.player.x,x-96,'incoming knockback is not doubled');f.destroy();
}

// Spawned boss offspring copy the reduced attack rather than applying a second half.
{
  const f=fixture('normal','abyss_apostle'),b=f.s.enemyBehaviors.items.get(f.e);
  f.e.hp=f.e.maxHp*.5;assert(b.trySplit(0));
  const twin=f.s.enemies.find(e=>e!==f.e&&e.behavior==='abyssApostle');assert(twin);
  assert.equal(twin.damage,f.e.damage);assert.equal(twin.speed,f.e.speed);f.destroy();
}
{
  const f=fixture('normal','foreseer'),b=f.s.enemyBehaviors.items.get(f.e);
  b.releaseSplit(0);const orbs=f.s.enemies.filter(e=>e.enemyId==='foreseer_orb');assert.equal(orbs.length,2);
  for(const orb of orbs)assert.equal(orb.damage,f.s.stageSystem.tunedEnemy('foreseer_orb').damage*.5);f.destroy();
}
console.log(`PASS 01152: 10→20 player entry/real attacks/restart; ${spawns} enemy spawn cases; normal-only halved attack and current movement multiplier, unchanged enemy attack clocks/HP, real pursuit/ally damage, 2x original outgoing knockback (half v0.11.54), incoming displacement/landing preserved, boss offspring scaling once.`);
