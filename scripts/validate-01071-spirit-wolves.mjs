import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { GAME_VERSION } from '../src/config/version.js';
import { createPlayerRuntime } from '../src/config/balance.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import ArtifactSystem from '../src/systems/ArtifactSystem.js';
import EnemyBehaviorManager from '../src/enemies/behaviors/EnemyBehaviorManager.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { SPIRIT_WOLVES_ID, inheritRatioForLevel, basePlayerStats } from '../src/skills/handlers/SpiritWolvesSkill.js';

const PLAYER_IMAGE_SHA='64ff69eeac2842999789317e5d1ce0687016943dfaa211c4f24308d294c17135';
const CREATE_PLAYER_SHA='70cdcbe0ede9a8a1eb366820d904977aff61f90d46a71b40b2436cda58c8a103';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function node(x=0,y=0,r=0){ return {x,y,radius:r,active:true,scale:1,alpha:1,setStrokeStyle(){return this},setDepth(){return this},setOrigin(){return this},setScale(v){this.scale=v;return this},setPosition(x,y){this.x=x;this.y=y;return this},destroy(){this.active=false}}; }
function makeBus(){ return {handlers:{},emit(n,p){ (this.handlers[n]||[]).forEach(fn=>fn(p)); },on(n,fn){(this.handlers[n]??=[]).push(fn); return()=>this.handlers[n]=this.handlers[n].filter(x=>x!==fn);}}; }
function makeEvents(){ return {handlers:{},on(n,fn){(this.handlers[n]??=[]).push(fn);},off(n,fn){this.handlers[n]=(this.handlers[n]||[]).filter(x=>x!==fn);},once(n,fn){this.on(n,fn);},emit(n,p){(this.handlers[n]||[]).slice().forEach(fn=>fn(p));}}; }
function enemy(x=220,y=100,hp=500){ return {x,y,hp,maxHp:hp,active:true,isDefeated:false,defense:0,damageReduction:0,width:60,height:80}; }
function makeScene(){ let now=0; const calls={damage:[],crits:0,attacks:0,artifacts:0,healed:0}; const enemies=[]; const tweens=[]; const eventBus=makeBus(); const scene={ calls,enemies,eventBus,events:makeEvents(),player:{x:100,y:100},playerData:createPlayerRuntime(),getGameplayTime:()=>now,setTime:t=>now=t,isGameplayPaused:()=>false,add:{circle:(x,y,r)=>node(x,y,r),rectangle:(x,y,w,h)=>node(x,y,0)},tweens:{add(config){ tweens.push(config); return {remove(){},stop(){},play(){},complete(){config.onComplete?.();}};}},completeTweens(){ while(tweens.length) tweens.shift().onComplete?.(); },floatText(){},hud:{update(){},setStatus(){}},skillBar:{update(){}},targeting:{valid:e=>e&&e.hp>0&&!e.isDefeated,all:()=>enemies,isEnemyFullyInsideViewport:()=>true,nearestAhead:()=>enemies.find(e=>e.hp>0)||null,random:()=>enemies.find(e=>e.hp>0)||null,aroundPlayer:()=>enemies.filter(e=>e.hp>0),shouldRecycleEnemyLeft:()=>false,getEnemyRightRespawnX:()=>1000},combatSystem:{damageEnemy(e,amount,meta){ calls.damage.push({e,amount,meta}); e.hp=Math.max(0,e.hp-amount); return amount>0; }},professionSystem:{getDamageMultiplier(){ return 99; },onActiveSkillCast(){},onDirectHit(){}},artifactSystem:{highHpDamageMultiplier(){ calls.artifacts+=1; return 99; }},statusEffects:{addPermanentShield(){}},healPlayer(amount){ const actual=Math.min(amount,this.playerData.maxHp-this.playerData.hp); this.playerData.hp+=actual; calls.healed+=actual; return actual; }}; scene.playerData.hp=scene.playerData.maxHp; return scene; }
function makeRealScene(){ const s=makeScene(); s.balance={stageWorldWidth:50000,enemyFadeMs:1,enemies:{rangeBuffer:24}}; s.killCount=0; s.awardGold=()=>{}; s.statusEffects={getEffects:()=>[],getStackCount:()=>0,has:()=>false,clearTarget(){},addPermanentShield(){},absorbShield:damage=>({absorbed:0,remainingDamage:damage})}; s.combatSystem=new CombatSystem(s); return s; }
function addSkillToScene(s,level=1){ const sys=new SkillSystem(s); s.skillSystem=sys; sys.addOrLevel(SPIRIT_WOLVES_ID); while(sys.getLevel(SPIRIT_WOLVES_ID)<level) sys.addOrLevel(SPIRIT_WOLVES_ID); return {s,sys,state:()=>sys.passiveState.spiritWolves}; }
function makeSystemWithSkill(level=1){ return addSkillToScene(makeScene(),level); }
function makeRealSystemWithSkill(level=1){ return addSkillToScene(makeRealScene(),level); }
function update(sys,s,time){ s.setTime(time); sys.update(time); }

assert.equal(GAME_VERSION,'0.10.71');
assert.equal(Object.keys(SKILLS).length,24);
assert.ok(SKILLS.spirit_wolves);
assert.equal(SKILLS.spirit_wolves.requiredSkillId,undefined);
assert.equal(SKILLS.spirit_wolves.rarity,'EPIC');
assert.equal(SKILLS.spirit_wolves.levels.length,9);
assert.equal(fs.existsSync('src/player_idle.png'),true);
assert.equal(sha('src/player_idle.png'),PLAYER_IMAGE_SHA,'player image SHA is unchanged');
assert.equal(sha('src/entities/createPlayer.js'),CREATE_PLAYER_SHA,'createPlayer.js hookup SHA is unchanged');
const realPlayer=createPlayerRuntime();
assert.equal(Number.isFinite(realPlayer.baseAttack),true); assert.equal(Number.isFinite(realPlayer.baseMaxHp),true); assert.equal(Number.isFinite(realPlayer.baseDefense),true);
assert.deepEqual(basePlayerStats(realPlayer),{attack:realPlayer.baseAttack,maxHp:realPlayer.baseMaxHp,defense:realPlayer.baseDefense});

{
  const {s,sys,state}=makeSystemWithSkill(1);
  assert.equal(state().updater&&sys.passiveUpdaters.includes(state().updater),true,'runtime updater is bound on obtain');
  update(sys,s,0); assert.equal(state().wolves.length,0); assert.equal(sys.cooldowns.get(SPIRIT_WOLVES_ID),8000);
  update(sys,s,7999); assert.equal(state().wolves.length,0);
  update(sys,s,8000); assert.equal(state().wolves.length,2); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false,'summon clears normal cooldown while wolves live');
  for(const w of state().wolves){ assert.equal(w.attack,Math.round(realPlayer.baseAttack*.2)); assert.equal(w.maxHp,Math.round(realPlayer.baseMaxHp*.2)); assert.equal(w.defense,Math.round(realPlayer.baseDefense*.2)); }
  s.playerData.attack=999; s.playerData.maxHp=9999; s.playerData.defense=99; s.playerData.defenseBonuses.skill=999; s.playerData.skillDamageMultiplier=99; s.playerData.cooldownReduction=.9;
  update(sys,s,9000); assert.equal(state().wolves.length,2,'live wolves block duplicate summons'); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false);
  state().wolves[0].takeDamage(999,{enemy:{x:0,isElite:false},attackType:'melee'}); assert.equal(state().wolves.length,1); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false,'one wolf death does not start cooldown');
  update(sys,s,9999); assert.equal(state().wolves.length,1); s.setTime(10000);
  state().wolves[0].takeDamage(999,{enemy:{x:0,isElite:false},attackType:'melee'}); assert.equal(state().wolves.length,0); assert.equal(sys.cooldowns.get(SPIRIT_WOLVES_ID),18000); assert.equal(state().cooldownStarts,1);
  update(sys,s,16000); assert.equal(state().wolves.length,0,'old generic cooldown must not cause early summon');
  update(sys,s,17999); assert.equal(state().wolves.length,0);
  update(sys,s,18000); assert.equal(state().wolves.length,2); assert.equal(state().cooldownStarts,1); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false);
}

{
  const {s,sys,state}=makeSystemWithSkill(3); update(sys,s,0); update(sys,s,8000); s.enemies.push(enemy(160,82,500),enemy(185,82,500),enemy(160,82,500)); const primary=s.enemies[0]; state().wolves[0].x=120; state().wolves[0].y=82; update(sys,s,8900); assert.ok(s.calls.damage.some(d=>d.meta.damageKind==='summonMelee')); assert.ok(s.calls.damage.some(d=>d.meta.damageKind==='summonSplash')); assert.equal(s.calls.damage.filter(d=>d.e===primary).length,1,'primary target is not splashed again');
}
{
  const {s,sys,state}=makeRealSystemWithSkill(1); s.playerData.baseAttack=100; s.playerData.attack=999; s.playerData.physicalDamageBonuses.last_stand=9; update(sys,s,0); update(sys,s,8000); const w=state().wolves[0]; const armored=enemy(w.x+40,w.y,500); armored.defense=5; s.enemies.push(armored); let hitEvent=null; const off=s.eventBus.on(CombatEvents.ENEMY_HIT,p=>{ if(p.skillId===SPIRIT_WOLVES_ID) hitEvent=p; }); update(sys,s,8900); off(); assert.equal(armored.hp,485,'real CombatSystem applies enemy defense exactly once'); assert.equal(hitEvent?.damage,15); assert.equal(hitEvent?.tags?.includes('physical'),false,'summon attack bypasses player physical bonus pipeline'); assert.equal(hitEvent?.canTriggerArtifacts,false); assert.equal(hitEvent?.summon,true);
}
{
  const {s,sys,state}=makeSystemWithSkill(1); update(sys,s,0); update(sys,s,8000); const w=state().wolves[0]; const target=enemy(w.x+180,w.y,500); s.enemies.push(target); const before=w.x; w.takeDamage(1,{enemy:{x:w.x-20,isElite:false},attackType:'melee'}); const knocked=w.x; assert.notEqual(knocked,before,'enemy hit moves the wolf'); update(sys,s,8259); assert.equal(w.x,knocked,'wolf stays in knockback recovery until timer ends'); update(sys,s,8261); assert.notEqual(w.x,knocked,'wolf resumes pursuit after knockback recovery');
}
{
  const {s,sys,state}=makeSystemWithSkill(6); update(sys,s,0); update(sys,s,8000); s.enemies.push(enemy(100,100,100)); state().wolves[0].takeDamage(999,{enemy:{x:0},attackType:'melee'}); assert.ok(s.calls.damage.some(d=>d.meta.damageKind==='summonDeathBurst')); const burst=s.calls.damage.find(d=>d.meta.damageKind==='summonDeathBurst'); assert.equal(burst.meta.canTriggerArtifacts,false); assert.equal(burst.meta.critResolved,true); assert.equal(burst.meta.crit,false); assert.equal(burst.meta.summon,true); const fx=state().fxs.values().next().value; assert.ok(fx?.active); s.completeTweens(); assert.equal(fx.active,false,'death burst fx is destroyed after tween');
}
{
  const {s,sys,state}=makeSystemWithSkill(9); update(sys,s,0); update(sys,s,8000); const w=state().wolves[0]; assert.equal(w.attack,Math.round(realPlayer.baseAttack*.3)); assert.equal(w.maxHp,Math.round(realPlayer.baseMaxHp*.3)); assert.equal(w.defense,Math.round(realPlayer.baseDefense*.3)); assert.ok(Math.abs(w.visualRadius/(w.baseRadius)-1.15)<0.001,'final effective visual size is 1.15x');
}
{
  const {s,sys,state}=makeSystemWithSkill(1); update(sys,s,0); update(sys,s,8000); const updater=state().updater; assert.equal(sys.passiveUpdaters.filter(fn=>fn===updater).length,1); sys.removeSkillRuntime(SPIRIT_WOLVES_ID); s.playerData.skills=[]; assert.equal(sys.passiveUpdaters.includes(updater),false,'remove unbinds updater'); assert.equal(state().wolves.length,0); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false);
  sys.addOrLevel(SPIRIT_WOLVES_ID); assert.ok(state().updater); assert.equal(sys.passiveUpdaters.filter(fn=>fn===state().updater).length,1,'reacquire binds exactly one updater'); update(sys,s,0); update(sys,s,8000); const w=state().wolves[0]; const beforeX=w.x; s.enemies.push(enemy(w.x+160,w.y,500)); update(sys,s,8900); assert.notEqual(w.x,beforeX,'reacquired wolf moves'); s.enemies[0].x=w.x+40; for(let t=9000;t<=9800;t+=100) update(sys,s,t); assert.ok(s.calls.damage.some(d=>d.meta.damageKind==='summonMelee'),'reacquired wolf attacks');
  const callsBefore=s.calls.damage.length; sys.reset(); assert.equal(sys.passiveState.spiritWolves,undefined); assert.equal(sys.passiveUpdaters.length,0); assert.equal(s.calls.damage.length,callsBefore,'reset cleanup does not explode');
}
{
  const {s,sys,state}=makeSystemWithSkill(6); update(sys,s,0); update(sys,s,8000); const before=s.calls.damage.length; sys.removeSkillRuntime(SPIRIT_WOLVES_ID); assert.equal(s.calls.damage.length,before,'remove cleanup does not explode'); sys.addOrLevel(SPIRIT_WOLVES_ID); update(sys,s,0); update(sys,s,8000); const updater=state().updater; s.events.emit('shutdown'); assert.equal(state().wolves.length,0,'shutdown alone destroys wolves'); assert.equal(sys.passiveUpdaters.includes(updater),false,'shutdown alone removes updater'); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false,'shutdown alone clears cooldown'); assert.equal(s.calls.damage.length,before,'shutdown cleanup does not explode');
}
{
  const s=makeRealScene(); s.player.x=500; const wolf={type:'spiritWolf',x:130,y:100,hp:50,maxHp:50,active:true,lastMeta:null,isAlive(){return this.hp>0;},takeDamage(amount,meta){this.lastMeta=meta;this.hp=Math.max(0,this.hp-amount);}}; s.skillSystem={passiveState:{spiritWolves:{wolves:[wolf]}}}; const healer={active:true,isDefeated:false,isBoss:false,behavior:'healer',x:100,y:100,hp:100,maxHp:100,damage:10,speed:40,attackRange:100,preferredRange:80,attackIntervalMs:2200,body:{setVelocityX(v){this.velocityX=v;}},setFillStyle(){}}; s.enemies=[healer]; const manager=new EnemyBehaviorManager(s); manager.attach(healer); manager.update(0); assert.equal(wolf.hp,43,'healer fallback attacks the nearby spirit wolf'); assert.equal(wolf.lastMeta?.source,'healerFallback'); assert.equal(wolf.lastMeta?.attackType,'healer'); manager.destroy();
}
{
  const s=makeScene(); s.playerData.artifacts=[{id:'blood_jade'}]; s.playerData.hp=s.playerData.maxHp-20; const artifacts=new ArtifactSystem(s); artifacts.load(); s.eventBus.emit(CombatEvents.ENEMY_KILLED,{enemy:enemy(),canTriggerArtifacts:false,source:'skill',skillId:SPIRIT_WOLVES_ID}); assert.equal(s.calls.healed,0,'suppressed summon kill does not trigger artifact'); s.eventBus.emit(CombatEvents.ENEMY_KILLED,{enemy:enemy(),canTriggerArtifacts:true,source:'attack'}); assert.equal(s.calls.healed,6,'ordinary eligible kill still triggers artifact'); artifacts.cleanup();
}
assert.equal(inheritRatioForLevel(1),.20); assert.equal(inheritRatioForLevel(9),.30);
console.log('v0.10.71 spirit wolves validation passed.');