import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { SPIRIT_BIRD_INTERVALS } from '../src/skills/handlers/SpiritBirdSkill.js';

class Bus{on(){return()=>{}} emit(){}}
function events(){ const map=new Map(); return {on(n,fn){ const a=map.get(n)||[]; a.push(fn); map.set(n,a); return this;}, once(n,fn){ return this.on(n,fn);}, off(n,fn){ if(!fn){ map.delete(n); return this;} const a=map.get(n)||[]; map.set(n,a.filter(x=>x!==fn)); return this;}, emit(n){ for(const fn of [...(map.get(n)||[])]) fn(); }, count(n){ return (map.get(n)||[]).length; }}; }
const node=(x=0,y=0)=>({x,y,active:true,setDepth(){return this},setStrokeStyle(){return this},setOrigin(...args){this.origin=args;return this},setScale(x,y){this.scale={x,y};return this},setPosition(x,y){this.x=x;this.y=y;return this},setDisplaySize(){return this},add(){return this},destroy(){this.active=false}});
function scene(){ const lines=[]; const s={now:0,lines,player:{x:220,y:850.25,groundY:850.25,height:100},playerData:{hp:500,maxHp:500,baseMaxHp:500,baseDefense:20,skills:[],cooldownReduction:0},enemies:[],floatTexts:[],eventBus:new Bus(),isGameplayPaused(){return false},getGameplayTime(){return this.now},healPlayer(a){const b=this.playerData.hp; this.playerData.hp=Math.min(this.playerData.maxHp,b+Math.max(0,Math.round(a))); return this.playerData.hp-b},floatText(x,y,text,color){this.floatTexts.push({x,y,text,color})},hud:{update(){}},skillBar:{update(){}},events:events(),cameras:{main:{worldView:{left:0,right:960,width:960}}},add:{container:(x,y)=>node(x,y),ellipse:(x,y)=>node(x,y),circle:(x,y)=>node(x,y),rectangle:(x,y)=>node(x,y),line:(x,y,x1,y1,x2,y2)=>{ const l=node(x,y); Object.assign(l,{x1,y1,x2,y2}); lines.push(l); return l;}},tweens:{add(c){c.onComplete?.();return{}},killTweensOf(){}},targeting:{valid:e=>!!e&&!e.isDefeated&&(e.hp??1)>0,isEnemyFullyInsideViewport(){return true},all(){return s.enemies.filter(this.valid)}},balance:{stageWorldWidth:10000,enemyFadeMs:1,groundTopY:900},professionSystem:{getDamageMultiplier(){return 1}},artifactSystem:{highHpDamageMultiplier(){return 1}},finishRun(){}}; s.skillSystem=new SkillSystem(s); s.combatSystem=new CombatSystem(s); return s; }
function tick(s,ms){ s.now+=ms; s.skillSystem.update(s.now); s.events.emit('postupdate'); }
function addLevels(s,n){ for(let i=0;i<n;i++) s.skillSystem.addOrLevel('spirit_bird'); s.skillSystem.update(s.now); return s.spiritBirdRuntime.get(); }

assert.equal(GAME_VERSION,'0.10.94');
assert.deepEqual(SPIRIT_BIRD_INTERVALS,[6000,5800,5600,5400,5200,4800,4600,4400,4200]);
assert.deepEqual(SKILLS.spirit_bird.levels.map(l=>l.healIntervalMs),SPIRIT_BIRD_INTERVALS);
for(let i=1;i<SPIRIT_BIRD_INTERVALS.length;i++) assert(SPIRIT_BIRD_INTERVALS[i]<SPIRIT_BIRD_INTERVALS[i-1],'intervals strictly decrease');
assert.equal(SKILLS.spirit_bird.milestones[3],'治疗强化——灵鸟治疗量提高30%。');
assert.equal(SKILLS.spirit_bird.milestones[6],'快速治疗——治疗间隔明显缩短至4.8秒，之后继续随等级缩短。');
assert.equal(SKILLS.spirit_bird.milestones[9],'群体治疗——每4.2秒同时恢复玩家和所有存活召唤物的生命，不包括灵鸟自己。');
['每6.0秒','每5.8秒','每5.6秒','每5.4秒','每5.2秒','4.8秒','每4.6秒','每4.4秒','每4.2秒'].forEach((t,i)=>assert(SKILLS.spirit_bird.levels[i].desc.includes(t),`level ${i+1} desc includes ${t}`));
assert(!JSON.stringify(SKILLS.spirit_bird).includes('每3秒'));
assert(!JSON.stringify(SKILLS.spirit_bird).includes('每2秒'));
assert(!JSON.stringify(SKILLS.spirit_bird).includes('从3秒缩短为2秒'));

for(const [level,delay] of [[1,6000],[2,5800],[6,4800]]){ const s=scene(); addLevels(s,level); s.playerData.hp=400; tick(s,delay-1); assert.equal(s.playerData.hp,400,`Lv${level} does not heal early`); tick(s,1); assert(s.playerData.hp>400,`Lv${level} first heal at ${delay}ms`); }
{ const s=scene(); const bird=addLevels(s,1); s.playerData.hp=400; tick(s,6000); assert.equal(s.playerData.hp,409,'actual Lv1 heal amount is applied once'); const heals=s.floatTexts.filter(f=>f.color==='#7dff8a'); assert.equal(heals.length,1,'one green heal number is shown for one actual heal'); assert.deepEqual(heals[0],{x:s.player.x,y:s.player.y-100,text:'+9',color:'#7dff8a'}); assert.equal(s.floatTexts.filter(f=>f.text==='+9'&&f.color==='#7dff8a').length,1,'does not duplicate the same heal number'); assert.equal(bird.nextHealAt,12000,'next Lv1 heal is scheduled 6000ms later'); }
{ const s=scene(); const bird=addLevels(s,1); const due=bird.nextHealAt; const hp=s.playerData.hp; tick(s,5999); assert.equal(s.playerData.hp,hp,'full HP unchanged before due time'); assert.equal(s.floatTexts.some(f=>f.text==='+0'),false); assert.equal(s.lines.length,0,'no full-HP heal effect before due time'); assert.equal(bird.nextHealAt,due,'cycle has not fired before due time'); tick(s,1); assert.equal(s.playerData.hp,hp,'full HP unchanged when due time fires'); assert.equal(s.floatTexts.some(f=>f.text==='+0'),false,'full HP due cycle does not show +0'); assert.equal(s.lines.length,0,'full HP due cycle does not create pointless heal effect'); assert.equal(bird.nextHealAt,due+6000,'full HP due cycle is consumed and next Lv1 cycle is scheduled'); }
let s=scene(); addLevels(s,9); const wolf={type:'spiritWolf',x:1,y:1,hp:50,maxHp:100,isAlive(){return this.hp>0},heal(a){const b=this.hp; this.hp=Math.min(this.maxHp,this.hp+a); return this.hp-b}}; s.skillSystem.passiveState.spiritWolves={wolves:[wolf]}; s.playerData.hp=400; tick(s,4199); assert.equal(wolf.hp,50); tick(s,1); assert.equal(s.playerData.hp,425); assert.equal(wolf.hp,75);

s=scene(); let bird=addLevels(s,1); s.playerData.hp=400; tick(s,3000); addLevels(s,1); assert.equal(s.playerData.hp,400,'upgrade does not heal immediately'); tick(s,2999); assert.equal(s.playerData.hp,400,'upgrade does not reset current cycle'); tick(s,1); assert.equal(s.playerData.hp,410,'current cycle completes using original due time'); s.playerData.hp=400; tick(s,5799); assert.equal(s.playerData.hp,400); tick(s,1); assert.equal(s.playerData.hp,410,'next cycle uses Lv2 interval');

s=scene(); bird=addLevels(s,1); s.playerData.hp=400; tick(s,1000); const pauseAt=s.now; s.now+=10000; s.skillSystem.shiftTimers(10000,pauseAt); s.skillSystem.update(s.now); assert.equal(s.playerData.hp,400); tick(s,4999); assert.equal(s.playerData.hp,400); tick(s,1); assert.equal(s.playerData.hp,409);
s=scene(); bird=addLevels(s,1); bird.takeDamage(999); tick(s,1000); const revivePauseAt=s.now; s.now+=10000; s.skillSystem.shiftTimers(10000,revivePauseAt); s.skillSystem.update(s.now); assert.equal(s.spiritBirdRuntime?.get?.()??null,null); tick(s,6999); assert.equal(s.spiritBirdRuntime?.get?.()??null,null); tick(s,1); assert(s.spiritBirdRuntime.get());

s=scene(); bird=addLevels(s,1); const stableY=bird.y, stableVisual=bird.visualY, viewY=bird.view.y, barY=bird.hpBar.y; for(let i=0;i<24;i++){ s.player.y += i%2===0 ? 0.4 : -0.4; tick(s,16); assert.equal(bird.y,stableY); assert.equal(bird.visualY,stableVisual); assert.equal(bird.view.y,viewY); assert.equal(bird.hpBar.y,barY); assert.equal(bird.view.x,bird.x); assert(Number.isInteger(bird.view.y)); assert.equal(bird.hpBar.x,bird.x-20); assert(Number.isInteger(bird.hpBar.y)); }
const bx=bird.x; s.player.x+=4; tick(s,16); assert.equal(bird.x,s.player.x-70); s.player.x-=160; tick(s,16); assert(bird.x>=bx); s.player.x=bird.x+60; const hold=bird.x; tick(s,16); assert.equal(bird.x,hold); s.player.x=bird.x+74; tick(s,16); assert.equal(bird.x,s.player.x-70);
const beforeX=bird.x; bird.takeDamage(20); assert.equal(bird.x,beforeX); assert(bird.hp<bird.maxHp);
assert.equal(bird.attackVisualY,bird.visualY);
const source=fs.readFileSync(new URL('../src/enemies/behaviors/EnemyBehaviorManager.js', import.meta.url),'utf8'); assert.match(source,/toY=target\.attackVisualY \?\? \(target\.y-\(target\.height\|\|60\)\*0\.25\)/);
s.skillSystem.removeSkillRuntime('spirit_bird'); s.playerData.skills=[]; s.playerData.hp=400; tick(s,20000); assert.equal(s.spiritBirdRuntime?.get?.()??null,null); assert.equal(s.playerData.hp,400);
console.log('v0.10.94 spirit bird interval and jitter validation passed.');
