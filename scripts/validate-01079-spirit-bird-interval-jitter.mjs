import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { configureEntryArchetypeSkills } from '../src/skills/handlers/EntryArchetypeSkills.js';
import { SKILLS } from '../src/config/skills.js';
import { SpiritBirdSkill, SPIRIT_BIRD_ID, SPIRIT_BIRD_INTERVALS, SPIRIT_BIRD_HP_RATIOS, SPIRIT_BIRD_DEFENSE_RATIOS, SPIRIT_BIRD_HEAL_RATIOS, SPIRIT_BIRD_HEAL_MULTIPLIERS } from '../src/skills/handlers/SpiritBirdSkill.js';

configureEntryArchetypeSkills();
const cfg=SKILLS.spirit_bird;
const expected=[6000,5800,5600,5400,5200,4800,4600,4400,4200];
assert.equal(GAME_VERSION,'0.10.79');
assert.deepEqual(SPIRIT_BIRD_INTERVALS,expected);
assert.deepEqual(cfg.levels.map(l=>l.healIntervalMs),expected);
assert.equal(SPIRIT_BIRD_HEAL_MULTIPLIERS[2],1.3);
assert.equal(cfg.levels[5].healIntervalMs,4800);
assert.equal(cfg.levels[8].healIntervalMs,4200);
assert.equal(cfg.levels[8].groupHeal,true);
assert.deepEqual(cfg.levels.map(l=>l.hpRatio),SPIRIT_BIRD_HP_RATIOS);
assert.deepEqual(cfg.levels.map(l=>l.defenseRatio),SPIRIT_BIRD_DEFENSE_RATIOS);
assert.deepEqual(cfg.levels.map(l=>l.healRatio),SPIRIT_BIRD_HEAL_RATIOS);
assert(!JSON.stringify(cfg).includes('每3秒'));
assert(!JSON.stringify(cfg).includes('每2秒'));
assert(!JSON.stringify(cfg).includes('从3秒缩短为2秒'));
for(let i=1;i<expected.length;i++) assert(expected[i]<expected[i-1],`level ${i+1} interval decreases`);

function obj(x=0,y=0){ return {x,y,active:true,setDepth(){return this;},setOrigin(){return this;},setStrokeStyle(){return this;},setScale(a,b){this.scaleX=a;this.scaleY=b;return this;},setPosition(x,y){this.x=x;this.y=y;return this;},add(){return this;},destroy(){this.active=false;}}; }
function makeSystem(level=1){
  let now=0, heals=[];
  const scene={
    player:{x:300.35,y:850,groundY:840,height:80}, balance:{groundTopY:880}, playerData:{hp:50,maxHp:100,baseMaxHp:1000,baseDefense:100},
    add:{container:(x,y)=>obj(x,y),ellipse:(x,y)=>obj(x,y),rectangle:(x,y)=>obj(x,y),line:(x,y)=>obj(x,y)}, tweens:{add({onComplete}){onComplete?.();}},
    cameras:{main:{worldView:{left:0}}}, events:{once(){},off(){}}, floatText(){}, getGameplayTime:()=>now,
    healPlayer(amount){ const before=this.playerData.hp; this.playerData.hp=Math.min(this.playerData.maxHp,this.playerData.hp+amount); const actual=this.playerData.hp-before; if(actual>0) heals.push({type:'player',actual,at:now}); return actual; },
    skillSystem:null
  };
  const system={scene,passiveState:{},passiveUpdaters:[],cooldowns:new Map(),getLevel:id=>id===SPIRIT_BIRD_ID?level:0,setLevel(v){level=v;},getData(){return {};}};
  scene.skillSystem=system;
  return {system,scene,setNow:v=>{now=v;},tick(){system.passiveUpdaters.forEach(fn=>fn());},heals};
}
function summon(level=1){ const h=makeSystem(level); SpiritBirdSkill.cast(h.system,cfg,{},level); SpiritBirdSkill.bind(h.system); return h; }

let h=summon(1); assert(h.system.passiveState.spiritBird.bird,'Lv1 obtained summons immediately'); h.setNow(5999); h.tick(); assert.equal(h.heals.length,0,'Lv1 no heal at 5999ms'); h.setNow(6000); h.tick(); assert.equal(h.heals.length,1,'Lv1 heals at 6000ms');
h=summon(2); h.setNow(5799); h.tick(); assert.equal(h.heals.length,0); h.setNow(5800); h.tick(); assert.equal(h.heals.length,1,'Lv2 heals at 5800ms');
h=summon(6); h.setNow(4800); h.tick(); assert.equal(h.heals.length,1,'Lv6 heals at 4800ms');
h=summon(9); h.scene.playerData.hp=10; h.system.passiveState.spiritWolves={wolves:[{type:'wolf',x:1,y:2,hp:1,maxHp:10,isAlive:()=>true,heal(a){this.hp+=a;return a;}}]}; h.scene.poisonKingRuntime={getHealingTarget:()=>({type:'poison_king',x:2,y:3,hp:1,maxHp:20,isAlive:()=>true,heal(a){this.hp+=a;return a;}})}; h.setNow(4200); h.tick(); assert.equal(h.heals.length,1,'Lv9 group heal includes player at 4200ms'); assert(h.system.passiveState.spiritWolves.wolves[0].hp>1,'Lv9 heals wolf');

h=summon(1); h.setNow(3000); h.tick(); h.system.setLevel(2); h.scene.playerData.hp=10; h.tick(); assert.equal(h.heals.length,0,'level up does not heal immediately'); h.setNow(5999); h.tick(); assert.equal(h.heals.length,0,'old cycle not reset by level up'); h.setNow(6000); h.tick(); assert.equal(h.heals.length,1,'old Lv1 cycle completes'); h.setNow(11799); h.tick(); assert.equal(h.heals.length,1,'next cycle uses Lv2 5800ms'); h.setNow(11800); h.tick(); assert.equal(h.heals.length,2,'Lv2 cycle heals after 5800ms');

h=summon(1); h.setNow(1000); h.tick(); SpiritBirdSkill.shiftTimers(h.system,10000,1000); h.setNow(11000); h.tick(); assert.equal(h.heals.length,0,'pause shift prevents immediate heal'); h.setNow(16000); h.tick(); assert.equal(h.heals.length,1,'remaining effective time heals'); const b=h.system.passiveState.spiritBird.bird; b.takeDamage(9999); assert(!h.system.passiveState.spiritBird.bird); SpiritBirdSkill.shiftTimers(h.system,10000,16000); h.setNow(24000); h.tick(); assert(!h.system.passiveState.spiritBird.bird,'revive timer paused'); h.setNow(34000); h.tick(); assert(h.system.passiveState.spiritBird.bird,'8s revive survives pause compensation');

h=summon(1); const bird=h.system.passiveState.spiritBird.bird; assert.equal(bird.y,840,'uses player.groundY'); const y=bird.y, vy=bird.visualY; const bgY=bird.hpBarBg.y, barY=bird.hpBar.y; h.scene.player.y=849.2; h.tick(); assert.equal(bird.y,y); assert.equal(bird.visualY,vy); h.scene.player.y=850.8; h.tick(); assert.equal(bird.y,y); assert.equal(bird.visualY,vy); for(let i=0;i<20;i++){ h.scene.player.y=i%2?849.2:850.8; h.tick(); assert.equal(bird.y,y); assert.equal(bird.visualY,vy); assert.equal(bird.hpBarBg.y,bgY); assert.equal(bird.hpBar.y,barY); }
const x0=bird.x; h.scene.player.x=400.35; h.tick(); assert(bird.x>x0,'player forward advances bird'); const x1=bird.x; h.tick(); assert.equal(bird.x,x1,'stopped player stops bird'); h.scene.player.x=350; h.tick(); assert.equal(bird.x,x1,'backward player does not reduce bird x'); assert(!Number.isInteger(bird.x),'logic x may stay fractional'); assert(Number.isInteger(bird.view.x)); assert(Number.isInteger(bird.view.y)); assert(Number.isInteger(bird.hpBarBg.x)); assert(Number.isInteger(bird.hpBarBg.y)); assert(Number.isInteger(bird.hpBar.x)); assert(Number.isInteger(bird.hpBar.y)); assert.equal(bird.hpBarBg.x,bird.view.x); assert.equal(bird.hpBarBg.y,bird.view.y-28); assert.equal(bird.hpBar.x,bird.view.x-20); assert.equal(bird.hpBar.y,bird.view.y-28);
const av=bird.attackVisualY; const hpBefore=bird.hp; assert(bird.takeDamage(5)>0,'melee/ranged/aoe damage entry still damages bird'); assert.equal(bird.attackVisualY,av,'attackVisualY remains bird body visual target'); assert.equal(bird.x,x1,'damage does not knock bird back'); assert(bird.hp<hpBefore);
SpiritBirdSkill.cleanup(h.system); h.setNow(999999); h.tick(); assert(!h.system.passiveState.spiritBird.bird,'cleanup prevents heal/revive');
console.log('v0.10.79 spirit bird interval and jitter validation passed.');
