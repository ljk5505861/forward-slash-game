import assert from 'node:assert/strict';
import fs from 'node:fs';
import World from '../node_modules/phaser/src/physics/arcade/World.js';
import Body from '../node_modules/phaser/src/physics/arcade/Body.js';
import Clock from '../node_modules/phaser/src/time/Clock.js';
import { GAME_VERSION } from '../src/config/version.js';
import GameSpeedSystem, { GAME_SPEEDS, DEFAULT_GAME_SPEED, normalizeGameSpeed, nextGameSpeed } from '../src/systems/GameSpeedSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import StatusEffectSystem, { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import StageSystem from '../src/systems/StageSystem.js';
import { SpiritWolvesSkill } from '../src/skills/handlers/SpiritWolvesSkill.js';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(GAME_VERSION,'0.11.15'); assert.equal(pkg.version,'0.11.15');
assert.deepEqual(GAME_SPEEDS,[1,1.5,2]); assert.equal(DEFAULT_GAME_SPEED,1);
assert.deepEqual(GAME_SPEEDS.map(nextGameSpeed),[1.5,2,1]);
for(const invalid of [0,-1,1.25,3,NaN,null,undefined]) assert.equal(normalizeGameSpeed(invalid),1);

const makeWorld=()=>new World({sys:{scale:{width:10000,height:1000}}},{fps:60,width:10000,height:1000,useTree:false});
const makeClockScene=(world=makeWorld())=>({time:{timeScale:1},physics:{world},tweens:{setGlobalTimeScale(value){this.timeScale=value;}},isGameplayPaused(){return false;}});
const runPhysics=(speed,frames=120)=>{ const world=makeWorld(), scene=makeClockScene(world), clock=new GameSpeedSystem(scene), body=new Body(world); world.bodies.add(body); body.setVelocity(100,0); clock.setSpeed(speed); for(let i=0;i<frames;i+=1) world.update(i*1000/120,1000/120); return {x:body.position.x,world,scene,clock,body}; };
const distances=GAME_SPEEDS.map(speed=>runPhysics(speed).x);
assert(Math.abs(distances[0]-100)<0.01); assert(Math.abs(distances[1]/distances[0]-1.5)<0.02); assert(Math.abs(distances[2]/distances[0]-2)<0.02);
const switched=runPhysics(1,60), beforeSwitch=switched.body.position.x, velocity=switched.body.velocity.x;
switched.clock.setSpeed(2); assert.equal(switched.body.position.x,beforeSwitch); assert.equal(switched.body.velocity.x,velocity); for(let i=0;i<30;i+=1) switched.world.update(500+i*1000/120,1000/120); const beforePause=switched.body.position.x;
switched.clock.advance(0,true); for(let i=0;i<60;i+=1) switched.world.update(750+i*1000/120,1000/120); assert.equal(switched.body.position.x,beforePause);
switched.clock.advance(0,false); assert.equal(switched.world.timeScale,.5); for(let i=0;i<30;i+=1) switched.world.update(1250+i*1000/120,1000/120); assert(switched.body.position.x>beforePause); switched.clock.destroy(); assert.equal(switched.world.timeScale,1);

const clockScene=makeClockScene(), gameClock=new GameSpeedSystem(clockScene); gameClock.advance(1000); gameClock.setSpeed(2); gameClock.advance(500); assert.equal(5000-gameClock.gameplayTimeMs,3000); gameClock.advance(500,true); assert.equal(gameClock.gameplayTimeMs,2000); assert.equal(gameClock.realActivePlayTimeMs,1500); gameClock.advance(500); assert.equal(gameClock.gameplayTimeMs,3000);

// Production CombatSystem: normal attack and enemy/Boss readyAt gates.
let playerAttacks=0, enemyAttacks=0; const target={active:true,isDefeated:false,x:100,hp:100}, enemy={...target,nextAttackAt:0,attackIntervalMs:900,attackRange:200,damage:1,behavior:'grunt',body:{}};
const combatScene={playerData:{hp:100,weaponId:'training_sword',attackSpeedMultiplier:1,attackRangeMultiplierBonuses:{}},enemies:[enemy],targeting:{all:()=>[enemy],nearestAhead:()=>target,valid:()=>true},isGameplayPaused:()=>false};
const combat=new CombatSystem(combatScene); combat.performAttack=()=>{playerAttacks+=1;}; combat.updateEnemyAttack=CombatSystem.prototype.updateEnemyAttack.bind(combat); combat.chooseEnemyAttackTarget=()=>({type:'player'}); combat.damageAttackTarget=()=>{enemyAttacks+=1;};
combat.update(0); const attackReady=combat.nextPlayerAttackAt; combat.update(attackReady-1); assert.equal(playerAttacks,1); combat.update(attackReady); assert.equal(playerAttacks,2); assert(enemyAttacks>=1);

// Production SkillSystem cooldown gate without invoking rendering handlers.
let casts=0; const skill=Object.create(SkillSystem.prototype); skill.scene={playerData:{hp:100,mana:999,maxMana:999,skills:[{id:'fireball',level:1}],cooldownReduction:0},professionSystem:{cooldownReduction:()=>0},isGameplayPaused:()=>false}; skill.cooldowns=new Map(); skill.active=[]; skill.passiveState={}; skill.passiveUpdaters=[]; skill.getOwned=()=>skill.scene.playerData.skills; skill.updateManaRegen=()=>{}; skill.updateActive=()=>{}; skill.hasTarget=()=>true; skill.canSpendMana=()=>true; skill.resolveManaCost=()=>0; skill.cast=()=>{casts+=1;return {};}; skill.update(0); const skillReady=skill.cooldowns.get('fireball'); skill.update(skillReady-1); assert.equal(casts,1); skill.update(skillReady); assert.equal(casts,2);

// Production DOT/status ticking.
let now=0,dotTicks=0; const dotTarget={active:true,isDefeated:false,hp:100}; const statusScene={playerData:{},enemies:[dotTarget],getGameplayTime:()=>now,isGameplayPaused:()=>false,eventBus:{emit(){}},combatSystem:{damageEnemy(t,a){t.hp-=a;dotTicks+=1;}},targeting:{valid:()=>true},professionSystem:{},hud:{update(){}}}; const statuses=new StatusEffectSystem(statusScene); statuses.add(StatusEffects.POISON,dotTarget,{durationMs:2500,intervalMs:500,value:2,stacks:1}); now=499; statuses.update(now); assert.equal(dotTicks,0); now=1500; statuses.update(now); assert.equal(dotTicks,3);

// Production summon runtime repeats attacks on its own nextAttackAt.
let wolfNow=0,wolfHits=0; const wolfTarget={active:true,isDefeated:false,hp:100,x:80,y:0}; const wolfSystem={passiveState:{},passiveUpdaters:[],cooldowns:new Map(),scene:{player:{x:0,y:0},playerData:{hp:100,baseAttack:20,baseMaxHp:100,baseDefense:0},getGameplayTime:()=>wolfNow,professionSystem:{summonCount:()=>1,applyEntitySummonStats(){},summonActionInterval:(_id,v)=>v,getGeneralDamageMultiplier:()=>1},targeting:{valid:e=>!!e?.active,all:()=>[wolfTarget]},combatSystem:{damageEnemy(){wolfHits+=1;return true;}},cameras:{main:{worldView:{left:0,right:720}}},events:{once(){},off(){}},add:{},tweens:{}}}; SpiritWolvesSkill.cast(wolfSystem,null,null,1,{}); const unbind=SpiritWolvesSkill.bind(wolfSystem); wolfNow=100; wolfSystem.passiveUpdaters[0](); wolfNow=1000; wolfSystem.passiveUpdaters[0](); assert.equal(wolfHits,2); unbind();

// Production StageSystem queue timing.
const stage=new StageSystem({}); const spawned=[]; stage.spawn=(id)=>spawned.push(id); stage.waveQueue=[{at:100,id:'grunt'},{at:250,id:'archer'}]; stage.waveState='spawning'; stage.drainWaveQueue(99); assert.deepEqual(spawned,[]); stage.drainWaveQueue(250); assert.deepEqual(spawned,['grunt','archer']);

// Actual Phaser Clock delayedCall observes the public timeScale used by production combat timers.
const events={once(){},on(){},off(){}}; const phaserClock=new Clock({sys:{events,game:{loop:{time:0}}}}); let delayed=0; phaserClock.delayedCall(1000,()=>{delayed+=1;}); phaserClock.preUpdate(); phaserClock.timeScale=2; phaserClock.update(499,499); assert.equal(delayed,0); phaserClock.update(500,1); assert.equal(delayed,1);

assert(!fs.readFileSync('src/systems/GameSpeedSystem.js','utf8').includes('_frameTime'));
assert(/version is 0\.11\.15/.test(fs.readFileSync('scripts/validate-01043-boss-knockback.mjs','utf8')));
console.log(`v0.11.15 game speed passed; physics distances: ${distances.map(x=>x.toFixed(2)).join(', ')}.`);
