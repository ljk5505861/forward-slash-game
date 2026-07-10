import assert from 'node:assert/strict';
import pkg from '../package.json' with { type: 'json' };
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { getRarity } from '../src/config/rarities.js';
import { createPlayerRuntime } from '../src/config/balance.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import StatusEffectSystem, { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import { getSkillBarStateText } from '../src/ui/skillBarState.js';
import fs from 'node:fs';

class Bus{constructor(){this.m=[]} on(t,f){this.m.push([t,f]);return()=>{this.m=this.m.filter(x=>x[1]!==f)}} emit(t,p){for(const [k,f] of [...this.m]) if(k===t) f(p)} count(t){return this.m.filter(x=>x[0]===t).length}}
const enemy=()=>({x:300,y:850,hp:1000,maxHp:1000,active:true,defense:0,damageReduction:0,physicalDamageTakenBonuses:{}});
function scene(){ const bus=new Bus(), p=createPlayerRuntime(); const s={now:0,paused:0,player:{x:220,y:850},playerData:p,enemies:[],eventBus:bus,floatTexts:[],balance:{enemyFadeMs:1,stageWorldWidth:10000},targeting:{valid:e=>!!e&&e.active!==false&&!e.isDefeated&&(e.hp??0)>0,isEnemyFullyInsideViewport(){return true},all(){return s.enemies.filter(this.valid)}},professionSystem:{getDamageMultiplier(){return 1}},artifactSystem:{highHpDamageMultiplier(){return 1}},statusEffects:null,skillSystem:null,isGameplayPaused(){return false},getGameplayTime(){return this.now},runStats:{get pausedDurationMs(){return s.paused}},floatText(){},hud:{update(){}},finishRun(){},awardGold(){},tweens:{add(c){c.onComplete?.();return{}}}}; s.statusEffects=new StatusEffectSystem(s); s.combatSystem=new CombatSystem(s); s.skillSystem=new SkillSystem(s); return s; }
const run=s=>s.skillSystem.passiveUpdaters.forEach(f=>f());
const update=(s,t)=>{s.now=t; run(s); s.statusEffects.update(t);};
const effects=s=>s.statusEffects.getEffects(s.playerData,StatusEffects.SHIELD);
const guardians=s=>effects(s).filter(e=>String(e.sourceId||'').startsWith('guardian_shield'));
const normal=s=>guardians(s).filter(e=>e.guardianShieldKind==='normal');
const regen=s=>guardians(s).filter(e=>e.guardianShieldKind==='regen');
const addLevels=(s,n)=>{for(let i=0;i<n;i++) s.skillSystem.addOrLevel('guardian_shield'); run(s);};
const slotText=(s,id='guardian_shield',level=s.skillSystem.getLevel(id)||1)=>{ const cfg=SKILLS[id], rarity=getRarity(cfg.rarity); return `${rarity.name} ${cfg.name}\nLv.${level}　${getSkillBarStateText(s,{id,level},cfg)}`; };
const state=s=>s.guardianShieldRuntime?.getSkillBarState?.()||null;

assert.equal(GAME_VERSION,'0.11.3');
assert.equal(pkg.version,'0.11.3');
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.rechargeMs),[5000,4800,4600,4400,4200,4000,3800,3600,3400]);
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.durationMs),[8000,8000,8000,8000,8000,null,null,null,null]);
assert.equal(SKILLS.guardian_shield.levels[8].regenRatio,0.4);
assert.equal(SKILLS.guardian_shield.levels[8].regenDelayMs,1000);
assert.equal(SKILLS.guardian_shield.levels[8].regenCooldownMs,8000);
const source=fs.readFileSync('src/skills/handlers/DefenseCoreSkills.js','utf8');
assert(!source.includes('cooldowns.set(\'guardian_shield\''));

{ const s=scene(); addLevels(s,1); assert.deepEqual(state(s),{phase:'recharge',label:'充能',remainingMs:5000}); assert.equal(slotText(s),'稀有 守护盾\nLv.1　充能 5s'); update(s,1000); assert.equal(slotText(s),'稀有 守护盾\nLv.1　充能 4s'); update(s,4999); assert.equal(slotText(s),'稀有 守护盾\nLv.1　充能 1s'); assert.equal(guardians(s).length,0); update(s,5000); assert.equal(normal(s).length,1); assert.equal(state(s),null); assert(!slotText(s).includes('充能')); assert(!s.skillSystem.cooldowns.has('guardian_shield')); }
{ const s=scene(), e=enemy(); addLevels(s,1); update(s,5000); s.combatSystem.damagePlayer(e,100,{source:'enemyMelee',undodgeable:true}); assert.equal(slotText(s),'稀有 守护盾\nLv.1　充能 5s'); update(s,6000); assert.equal(state(s).remainingMs,4000); update(s,9999); assert.equal(guardians(s).length,0); update(s,10000); assert.equal(normal(s).length,1); }
{ const s=scene(), e=enemy(); addLevels(s,6); update(s,4000); s.combatSystem.damagePlayer(e,100,{source:'enemyMelee',undodgeable:true}); assert.equal(slotText(s),'稀有 守护盾\nLv.6　充能 4s'); update(s,7999); assert.equal(guardians(s).length,0); update(s,8000); assert.equal(normal(s).length,1); }
{ const s=scene(); addLevels(s,1); update(s,5000); update(s,12999); assert.equal(normal(s).length,1); assert(!slotText(s).includes('充能')); update(s,13000); assert.equal(guardians(s).length,0); assert.deepEqual(state(s),{phase:'recharge',label:'充能',remainingMs:5000}); assert.equal(slotText(s),'稀有 守护盾\nLv.1　充能 5s'); update(s,14000); assert.equal(slotText(s),'稀有 守护盾\nLv.1　充能 4s'); update(s,18000); assert.equal(normal(s).length,1); }
{ const s=scene(); addLevels(s,6); update(s,4000); const id=normal(s)[0].id; update(s,999999); assert.equal(normal(s)[0].id,id); assert.equal(state(s),null); }
{ const s=scene(), e=enemy(); addLevels(s,9); update(s,3400); s.combatSystem.damagePlayer(e,100,{source:'enemyMelee',undodgeable:true}); assert.deepEqual(state(s),{phase:'regen',label:'再生',remainingMs:1000}); assert.equal(slotText(s),'稀有 守护盾\nLv.9　再生 1s'); assert.equal(state(s).phase,'regen'); update(s,4399); assert.equal(regen(s).length,0); update(s,4400); assert.equal(regen(s).length,1); assert.equal(regen(s)[0].remainingValue,62); assert.equal(state(s),null); s.combatSystem.damagePlayer(e,100,{source:'enemyMelee',undodgeable:true}); assert.deepEqual(state(s),{phase:'recharge',label:'充能',remainingMs:3400}); assert.equal(slotText(s),'稀有 守护盾\nLv.9　充能 4s'); update(s,4800); assert.equal(slotText(s),'稀有 守护盾\nLv.9　充能 3s'); update(s,7799); assert.equal(guardians(s).length,0); update(s,7800); assert.equal(normal(s).length,1); }
{ const s=scene(); s.playerData.skills.push({id:'fireball',level:9}); s.skillSystem.cooldowns.set('fireball',s.getGameplayTime()+2500); assert.equal(getSkillBarStateText(s,{id:'fireball',level:9},SKILLS.fireball),'冷却 3s'); s.skillSystem.cooldowns.set('fireball',0); assert.equal(getSkillBarStateText(s,{id:'fireball',level:9},SKILLS.fireball),'已满级'); assert.equal(getSkillBarStateText(s,{id:'fireball',level:1},SKILLS.fireball),'就绪'); }
{ const s=scene(); addLevels(s,1); update(s,2000); s.paused=10000; update(s,12000); assert.equal(slotText(s),'稀有 守护盾\nLv.1　充能 3s'); assert.equal(guardians(s).length,0); s.paused=0; update(s,5000); assert.equal(normal(s).length,1); }
{ const s=scene(), e=enemy(); addLevels(s,9); update(s,3400); s.combatSystem.damagePlayer(e,100,{source:'enemyMelee',undodgeable:true}); s.paused=10000; update(s,13900); assert.equal(slotText(s),'稀有 守护盾\nLv.9　再生 1s'); assert.equal(regen(s).length,0); }
{ const s=scene(); addLevels(s,1); const runtime=s.guardianShieldRuntime; assert(runtime); const updaters=s.skillSystem.passiveUpdaters.length, damagedListeners=s.eventBus.count(CombatEvents.PLAYER_DAMAGED), removedListeners=s.eventBus.count(CombatEvents.STATUS_REMOVED); s.playerData.skills=[]; s.skillSystem.removeSkillRuntime('guardian_shield'); assert.equal(s.guardianShieldRuntime,null); assert.equal(state(s),null); s.skillSystem.removeSkillRuntime('guardian_shield'); assert.equal(s.skillSystem.passiveUpdaters.length,updaters-1); assert.equal(s.eventBus.count(CombatEvents.PLAYER_DAMAGED),damagedListeners-1); assert.equal(s.eventBus.count(CombatEvents.STATUS_REMOVED),removedListeners-1); addLevels(s,1); assert(s.guardianShieldRuntime); assert.notEqual(s.guardianShieldRuntime,runtime); assert.equal(s.skillSystem.passiveUpdaters.length,updaters); assert.equal(s.eventBus.count(CombatEvents.PLAYER_DAMAGED),damagedListeners); assert.equal(s.eventBus.count(CombatEvents.STATUS_REMOVED),removedListeners); const old=s.guardianShieldRuntime; s.skillSystem.reset(); assert.equal(s.guardianShieldRuntime,null); assert.equal(s.eventBus.count(CombatEvents.PLAYER_DAMAGED),0); assert.equal(s.eventBus.count(CombatEvents.STATUS_REMOVED),0); assert.equal(s.skillSystem.passiveUpdaters.length,0); addLevels(s,1); assert(s.guardianShieldRuntime); assert.notEqual(s.guardianShieldRuntime,old); assert.equal(s.eventBus.count(CombatEvents.PLAYER_DAMAGED),1); assert.equal(s.eventBus.count(CombatEvents.STATUS_REMOVED),1); assert.equal(s.skillSystem.passiveUpdaters.length,1); }
{ const s=scene(); addLevels(s,1); assert(!s.skillSystem.cooldowns.has('guardian_shield')); s.skillSystem.cooldowns.set('fireball',10000); s.skillSystem.reduceActiveCooldowns(9000); assert(!s.skillSystem.cooldowns.has('guardian_shield')); update(s,5000); assert.equal(normal(s).length,1); }
{ const s=scene(); addLevels(s,1); s.statusEffects.add(StatusEffects.SHIELD,s.playerData,{durationMs:99999,value:80,remainingValue:80,sourceId:'other'}); update(s,5000); assert.equal(guardians(s).length,0); assert.deepEqual(state(s),{phase:'recharge',label:'充能',remainingMs:5000}); assert.equal(slotText(s),'稀有 守护盾\nLv.1　充能 5s'); assert(!s.skillSystem.cooldowns.has('guardian_shield')); }
console.log('v0.11.1 guardian shield skillbar validation passed.');
