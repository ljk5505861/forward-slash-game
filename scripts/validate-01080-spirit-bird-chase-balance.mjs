import assert from 'node:assert/strict';
import fs from 'node:fs';
import pkg from '../package.json' with { type: 'json' };
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { SPIRIT_BIRD_HEAL_RATIOS, SPIRIT_BIRD_HEAL_MULTIPLIERS, SPIRIT_BIRD_INTERVALS, SPIRIT_BIRD_FOLLOW_DISTANCE, SPIRIT_BIRD_CATCHUP_SPEED } from '../src/skills/handlers/SpiritBirdSkill.js';

class Bus{on(){return()=>{}} emit(){}}
function events(){ const map=new Map(); return {on(n,fn){ const a=map.get(n)||[]; a.push(fn); map.set(n,a); return this;}, once(n,fn){ return this.on(n,fn);}, off(n,fn){ if(!fn){ map.delete(n); return this;} const a=map.get(n)||[]; map.set(n,a.filter(x=>x!==fn)); return this;}, emit(n){ for(const fn of [...(map.get(n)||[])]) fn();}, count(n){ return (map.get(n)||[]).length; }}; }
const node=(x=0,y=0)=>({x,y,active:true,setDepth(){return this},setStrokeStyle(){return this},setOrigin(...args){this.origin=args;return this},setScale(x,y){this.scale={x,y};return this},setPosition(x,y){this.x=x;this.y=y;return this},setDisplaySize(){return this},add(){return this},destroy(){this.active=false}});
function scene({playerX=220}={}){ const ev=events(), lines=[]; const s={now:0,lines,player:{x:playerX,y:850.25,groundY:850.25,height:100},playerData:{hp:1000,maxHp:1000,baseMaxHp:1000,baseDefense:20,skills:[],cooldownReduction:0},enemies:[],floatTexts:[],eventBus:new Bus(),paused:false,isGameplayPaused(){return this.paused},getGameplayTime(){return this.now},healPlayer(a){const b=this.playerData.hp; this.playerData.hp=Math.min(this.playerData.maxHp,b+Math.max(0,Math.round(a))); return this.playerData.hp-b},floatText(x,y,text,color){this.floatTexts.push({x,y,text,color})},hud:{update(){}},skillBar:{update(){}},events:ev,cameras:{main:{worldView:{left:5000,right:5960,width:960},scrollX:5000}},add:{container:(x,y)=>node(x,y),ellipse:(x,y)=>node(x,y),circle:(x,y)=>node(x,y),rectangle:(x,y)=>node(x,y),line:(x,y,x1,y1,x2,y2)=>{ const l=node(x,y); Object.assign(l,{x1,y1,x2,y2}); lines.push(l); return l;}},tweens:{add(c){c.onComplete?.();return{}},killTweensOf(){}},targeting:{valid:e=>!!e&&!e.isDefeated&&(e.hp??1)>0,isEnemyFullyInsideViewport(){return true},all(){return s.enemies.filter(this.valid)}},balance:{stageWorldWidth:10000,enemyFadeMs:1,groundTopY:900},professionSystem:{getDamageMultiplier(){return 1}},artifactSystem:{highHpDamageMultiplier(){return 1}},finishRun(){}}; s.skillSystem=new SkillSystem(s); s.combatSystem=new CombatSystem(s); return s; }
function tick(s,ms,{post=true}={}){ s.now+=ms; s.skillSystem.update(s.now); if(post) s.events.emit('postupdate'); }
function addLevels(s,n){ for(let i=0;i<n;i++) s.skillSystem.addOrLevel('spirit_bird'); s.skillSystem.update(s.now); return s.spiritBirdRuntime.get(); }
const close=(actual,expected,epsilon=1e-9)=>Math.abs(actual-expected)<=epsilon;

assert.equal(GAME_VERSION,'0.10.82');
assert.equal(pkg.version,'0.10.82');
assert.deepEqual(SPIRIT_BIRD_HEAL_RATIOS,[0.018,0.020,0.022,0.025,0.028,0.031,0.034,0.036,0.038]);
assert.deepEqual(SPIRIT_BIRD_HEAL_MULTIPLIERS,[1,1,1.3,1.3,1.3,1.3,1.3,1.3,1.3]);
assert.deepEqual(SPIRIT_BIRD_INTERVALS,[6000,5800,5600,5400,5200,4800,4600,4400,4200]);
['1.80%','2.00%','2.86%','3.25%','3.64%','4.03%','4.42%','4.68%','4.94%'].forEach((t,i)=>assert(SKILLS.spirit_bird.levels[i].desc.includes(t),`Lv${i+1} text ${t}`));
assert.deepEqual(SPIRIT_BIRD_HEAL_RATIOS.map((r,i)=>Math.round(Math.round(1000*r)*SPIRIT_BIRD_HEAL_MULTIPLIERS[i])),[18,20,29,33,36,40,44,47,49]);

const source=fs.readFileSync(new URL('../src/skills/handlers/SpiritBirdSkill.js', import.meta.url),'utf8');
assert(!source.includes('LEFT_MARGIN'));
assert(!source.includes('worldView.left'));
assert(!source.includes('scrollX'));
assert(source.includes('POST_UPDATE'));
assert(source.includes('function renderCoords(b){ return {x:b.x, y:Math.round(b.visualY)}; }'));
assert(!source.includes('container?.(Math.round(bx)'));
assert(!source.includes('rectangle?.(Math.round(bx)'));
assert(!source.includes('Math.round(bx)-20'));
assert.equal((source.match(/updater:null/g)||[]).length,1);
assert.match(source,/view\.spiritBird=b; setVisual\(b\); return b;/);
assert.equal(SPIRIT_BIRD_FOLLOW_DISTANCE,70);
assert.equal(SPIRIT_BIRD_CATCHUP_SPEED,260);


let fractional=scene({playerX:220.35});
let fractionalBird=addLevels(fractional,1);
assert(close(fractionalBird.x,150.35),'fractional spawn logic x');
assert(close(fractionalBird.view.x,150.35),'fractional spawn view x');
assert(close(fractionalBird.hpBarBg.x,150.35),'fractional spawn hp bg x');
assert(close(fractionalBird.hpBar.x,130.35),'fractional spawn hp fg x');
assert.equal(Number.isInteger(fractionalBird.view.y),true,'fractional spawn view y is integer');
assert.equal(Number.isInteger(fractionalBird.hpBarBg.y),true,'fractional spawn hp bg y is integer');
assert.equal(Number.isInteger(fractionalBird.hpBar.y),true,'fractional spawn hp fg y is integer');
assert(close(fractionalBird.view.x,fractionalBird.x));
assert(close(fractionalBird.hpBarBg.x,fractionalBird.x));
assert(close(fractionalBird.hpBar.x+20,fractionalBird.x));
fractionalBird.takeDamage(999);
fractional.player.x=360.45;
tick(fractional,8000,{post:false});
const revived=fractional.spiritBirdRuntime.get();
assert(close(revived.x,290.45),'fractional revive logic x');
assert(close(revived.view.x,290.45),'fractional revive view x');
assert(close(revived.hpBarBg.x,290.45),'fractional revive hp bg x');
assert(close(revived.hpBar.x,270.45),'fractional revive hp fg x');
assert.notEqual(revived.view.x,Math.round(290.45),'revive first frame is not rounded');
assert(close(revived.hpBar.x+20,revived.view.x),'revive first frame bar aligns with bird');
assert.equal(revived.lastMoveAt,fractional.now,'revive lastMoveAt uses current gameplay time');
fractional.events.emit('postupdate');
assert(close(revived.view.x,290.45),'postupdate after revive does not add rounding jump');

let s=scene(); let bird=addLevels(s,1); assert.equal(s.events.count('postupdate'),2); assert.equal(bird.x,150); assert(bird.x<s.cameras.main.worldView.left); assert.equal(bird.view.active,true);
s.player.x=bird.x+170; tick(s,100); assert.equal(bird.x,176); assert.notEqual(bird.x,s.player.x-70);
tick(s,100); assert.equal(bird.x,202); tick(s,100); assert.equal(bird.x,228); tick(s,100); assert.equal(bird.x,250); assert.equal(bird.x,s.player.x-70);
const caught=bird.x; tick(s,16,{post:false}); assert.equal(bird.x,caught,'ordinary updater does not move bird.x'); s.player.x+=4; tick(s,16); assert.equal(s.player.x-bird.x,70,'POST_UPDATE uses final player.x and keeps fixed distance');
for(let i=0;i<120;i++){ s.player.x+=4; tick(s,16); assert.equal(Math.round((s.player.x-bird.x)*1000)/1000,70); }
const stopped=bird.x; tick(s,16); assert.equal(bird.x,stopped,'caught bird stops with stopped player');
s.player.x=bird.x+200; tick(s,16); const lag=bird.x; s.player.x-=120; tick(s,16); assert(bird.x>=lag,'bird does not move backward when player retreats'); s.player.x=bird.x-30; tick(s,16); assert(bird.x>=lag,'bird ahead of target does not retreat'); s.player.x=bird.x+96; tick(s,100); assert.equal(bird.x,s.player.x-70,'bird resumes chasing after player leads again');

s=scene(); bird=addLevels(s,1); s.player.x=bird.x+200; tick(s,16); assert.equal(Math.round((bird.x-150)*1000)/1000,4.16); tick(s,17); assert.equal(Math.round((bird.x-154.16)*1000)/1000,4.42); tick(s,33); assert.equal(Math.round((bird.x-158.58)*1000)/1000,8.58); tick(s,1000); assert.equal(Math.round((bird.x-167.16)*1000)/1000,26,'delta is capped at 100ms');
const beforePause=bird.x; tick(s,50); const pauseAt=s.now; s.now+=10000; s.skillSystem.shiftTimers(10000,pauseAt); tick(s,0); assert(bird.x-beforePause<30,'paused duration is not counted as catchup');
assert.equal(bird.lastMoveAt,s.now);

s=scene(); bird=addLevels(s,9); const wolf={type:'spiritWolf',x:1,y:1,hp:50,maxHp:100,isAlive(){return this.hp>0},heal(a){const b=this.hp; this.hp=Math.min(this.maxHp,this.hp+a); return this.hp-b}}; let kingHp=50; s.skillSystem.passiveState.spiritWolves={wolves:[wolf]}; s.poisonKingRuntime={getHealingTarget(){return {type:'poison_king',x:2,y:2,get hp(){return kingHp},maxHp:100,isAlive(){return kingHp>0},heal(a){const b=kingHp; kingHp=Math.min(100,kingHp+a); return kingHp-b}}}}; s.playerData.hp=500; tick(s,4200); assert.equal(s.playerData.hp,549); assert.equal(wolf.hp,99); assert.equal(kingHp,99); assert.equal(bird.hp,bird.maxHp);

s=scene(); bird=addLevels(s,1); const y=bird.y, vy=bird.visualY, viewY=bird.view.y; for(let i=0;i<20;i++){ s.player.y += i%2 ? -0.5 : 0.5; tick(s,16); assert.equal(bird.y,y); assert.equal(bird.visualY,vy); assert.equal(bird.view.y,viewY); assert.equal(bird.view.x,bird.x); assert.equal(bird.hpBar.x,bird.x-20); }
const bx=bird.x; bird.takeDamage(20); assert.equal(bird.x,bx); assert(bird.hp<bird.maxHp); bird.takeDamage(999); assert.equal(s.spiritBirdRuntime?.get?.()??null,null); tick(s,8000); assert(s.spiritBirdRuntime.get()); s.skillSystem.removeSkillRuntime('spirit_bird'); assert.equal(s.events.count('postupdate'),1); s.skillSystem.removeSkillRuntime('spirit_bird'); assert.equal(s.events.count('postupdate'),1);
console.log('v0.10.82 spirit bird chase balance validation passed.');
