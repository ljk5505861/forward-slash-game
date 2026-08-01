import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import GameSpeedSystem, { GAME_SPEEDS, DEFAULT_GAME_SPEED, normalizeGameSpeed, nextGameSpeed } from '../src/systems/GameSpeedSystem.js';
import RunStatsSystem from '../src/systems/RunStatsSystem.js';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(GAME_VERSION,'0.11.15'); assert.equal(pkg.version,'0.11.15');
assert.deepEqual(GAME_SPEEDS,[1,1.5,2]); assert.equal(DEFAULT_GAME_SPEED,1);
assert.deepEqual(GAME_SPEEDS.map(nextGameSpeed),[1.5,2,1]);
for(const invalid of [0,-1,1.25,3,NaN,null,undefined]) assert.equal(normalizeGameSpeed(invalid),1);

const fakeScene=()=>{ const world={_frameTime:1/60,_frameTimeMS:1000/60}; return {time:{timeScale:1},physics:{world},tweens:{setGlobalTimeScale(value){this.scale=value;}},isGameplayPaused(){return false;}}; };
for(const speed of GAME_SPEEDS){ const scene=fakeScene(), clock=new GameSpeedSystem(scene); clock.setSpeed(speed); clock.advance(1000); assert.equal(clock.gameplayTimeMs,1000*speed); assert.equal(clock.realActivePlayTimeMs,1000); assert.equal(scene.time.timeScale,speed); assert.equal(scene.tweens.scale,speed); assert(Math.abs(scene.physics.world._frameTime-(speed/60))<1e-12); }
const scene=fakeScene(), clock=new GameSpeedSystem(scene); scene.gameSpeed=clock;
clock.advance(1000); clock.setSpeed(2); clock.advance(500); const remainingReadyAt=5000-clock.gameplayTimeMs; assert.equal(remainingReadyAt,3000);
clock.advance(500,true); assert.equal(clock.gameplayTimeMs,2000); assert.equal(clock.realActivePlayTimeMs,1500); assert.equal(scene.time.timeScale,0); assert.equal(scene.tweens.scale,0);
clock.advance(500); clock.setSpeed(1); clock.advance(1000); assert.equal(clock.gameplayTimeMs,4000); assert.equal(clock.realActivePlayTimeMs,3000);
for(let i=0;i<30;i+=1) assert(GAME_SPEEDS.includes(clock.cycle()));

// A single game-time scheduler represents the production readyAt/nextAt/endAt pattern used by attacks,
// skills, DOT/statuses, summons, enemies, bosses, waves and delayed combat effects.
const simulate=(speed)=>{ const sc=fakeScene(), c=new GameSpeedSystem(sc); c.setSpeed(speed); const periods={attack:800,skill:1200,mana:500,dot:400,status:2000,summon:700,sword:600,enemy:900,boss:1500,wave:1000,tween:300}; const next=Object.fromEntries(Object.entries(periods).map(([k,v])=>[k,v])); const counts=Object.fromEntries(Object.keys(periods).map(k=>[k,0])); while(c.gameplayTimeMs<6000){ c.advance(10); for(const [key,period] of Object.entries(periods)) while(next[key]<=c.gameplayTimeMs){counts[key]+=1;next[key]+=period;} } return counts; };
assert.deepEqual(simulate(1),simulate(1.5)); assert.deepEqual(simulate(1),simulate(2));

const statsScene={...scene,eventBus:{on(){return ()=>{};}},playerData:{skills:[],artifacts:[]},getGameplayTime:()=>clock.gameplayTimeMs,getRealActivePlayTime:()=>clock.realActivePlayTimeMs};
const stats=new RunStatsSystem(statsScene).snapshot(); assert.equal(stats.gameplayTimeMs,clock.gameplayTimeMs); assert.equal(stats.realActivePlayTimeMs,clock.realActivePlayTimeMs); assert.equal(stats.currentGameSpeed,clock.speed); assert(stats.speedChanges.length>=2);
const hud=fs.readFileSync('src/ui/Hud.js','utf8'), skillBar=fs.readFileSync('src/ui/SkillBar.js','utf8'), gameScene=fs.readFileSync('src/scenes/GameScene.js','utf8');
assert(hud.includes("this.settings=scene.add.text")); assert(hud.includes("scene.cycleGameSpeed")); assert(skillBar.includes('globalThis.setTimeout')); assert(!skillBar.includes('time.delayedCall(SKILL_DETAIL_LONG_PRESS_MS'));
assert(gameScene.includes('const time=this.gameSpeed.advance(delta,paused)')); assert(!gameScene.includes('shiftTimers(pausedDuration'));
console.log('v0.11.15 authoritative game-speed clock and regression validation passed.');
