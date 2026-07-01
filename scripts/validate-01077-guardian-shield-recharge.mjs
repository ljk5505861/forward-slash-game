import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { createPlayerRuntime } from '../src/config/balance.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import StatusEffectSystem, { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import fs from 'node:fs';

class Bus{constructor(){this.m=[]} on(t,f){this.m.push([t,f]);return()=>{this.m=this.m.filter(x=>x[1]!==f)}} emit(t,p){for(const [k,f] of [...this.m]) if(k===t) f(p)}}
const enemy=(o={})=>({x:300,y:850,hp:1000,maxHp:1000,active:true,defense:0,damageReduction:0,physicalDamageTakenBonuses:{},...o});
function scene(){ const bus=new Bus(), p=createPlayerRuntime(); const s={now:0,paused:0,player:{x:220,y:850},playerData:p,enemies:[],eventBus:bus,floatTexts:[],balance:{enemyFadeMs:1,stageWorldWidth:10000},targeting:{valid:e=>!!e&&e.active!==false&&!e.isDefeated&&(e.hp??0)>0,isEnemyFullyInsideViewport(){return true},all(){return s.enemies.filter(this.valid)}},professionSystem:{getDamageMultiplier(){return 1}},artifactSystem:{highHpDamageMultiplier(){return 1}},statusEffects:null,skillSystem:null,isGameplayPaused(){return false},getGameplayTime(){return this.now},runStats:{get pausedDurationMs(){return s.paused}},floatText(){},hud:{update(){}},finishRun(){this.finished=true},awardGold(){},tweens:{add(c){c.onComplete?.();return{}}}}; s.statusEffects=new StatusEffectSystem(s); s.combatSystem=new CombatSystem(s); s.skillSystem=new SkillSystem(s); return s; }
const run=s=>s.skillSystem.passiveUpdaters.forEach(f=>f());
const update=(s,t)=>{s.now=t; s.statusEffects.update(t); run(s);};
const effects=s=>s.statusEffects.getEffects(s.playerData,StatusEffects.SHIELD);
const g=s=>effects(s).filter(e=>String(e.sourceId||'').startsWith('guardian_shield'));
const normal=s=>g(s).filter(e=>e.guardianShieldKind==='normal');
const regen=s=>g(s).filter(e=>e.guardianShieldKind==='regen');
const addLevels=(s,n)=>{for(let i=0;i<n;i++) s.skillSystem.addOrLevel('guardian_shield'); run(s);};

assert.equal(GAME_VERSION,'0.10.88');
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.rechargeMs),[5000,4800,4600,4400,4200,4000,3800,3600,3400]);
assert(SKILLS.guardian_shield.levels.every(l=>l.intervalMs===undefined));
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.generatedShieldMultiplier),[1,1,1.3,1.3,1.3,1.3,1.3,1.3,1.3]);
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.maxShieldBonus),[30,36,42,50,58,68,80,92,105]);
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.defenseScale),[0.80,0.90,1.00,1.15,1.30,1.50,1.70,1.90,2.20]);
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.flatShield),[12,14,16,18,20,24,28,32,36]);
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.durationMs),[8000,8000,8000,8000,8000,null,null,null,null]);
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.persistent),[false,false,false,false,false,true,true,true,true]);
assert(!SKILLS.guardian_shield.levels[2].milestoneText.includes('迎战'));
const source=fs.readFileSync('src/skills/handlers/DefenseCoreSkills.js','utf8');
assert(!/guardian_shield[\s\S]*COMBAT_STARTED/.test(source));

{ const s=scene(); s.playerData.defense=10; addLevels(s,1); assert.equal(g(s).length,0); update(s,4999); assert.equal(g(s).length,0); update(s,5000); assert.equal(normal(s).length,1); assert.equal(normal(s)[0].remainingValue,20); const p=scene(); addLevels(p,1); p.now=4000; p.paused=3000; run(p); assert.equal(g(p).length,0); p.paused=0; update(p,5000); assert.equal(g(p).length,1); }
{ const s=scene(); s.playerData.defense=20; addLevels(s,3); update(s,4600); const first=normal(s)[0]; assert.equal(first.remainingValue,47); const expires=first.expiresAt; update(s,12000); assert.equal(normal(s).length,1); assert.equal(normal(s)[0].id,first.id); assert.equal(normal(s)[0].expiresAt,expires); assert.equal(normal(s)[0].remainingValue,47); s.statusEffects.add(StatusEffects.SHIELD,s.playerData,{durationMs:99999,value:10,remainingValue:10,sourceId:'other'}); assert.equal(g(s).length,1); }
{ const s=scene(); addLevels(s,1); update(s,5000); assert.equal(g(s).length,1); update(s,12999); assert.equal(g(s).length,1); update(s,13000); assert.equal(g(s).length,0); update(s,17999); assert.equal(g(s).length,0); update(s,18000); assert.equal(g(s).length,1); }
{ const s=scene(), e=enemy(); addLevels(s,1); update(s,5000); s.combatSystem.damagePlayer(e,100,{source:'enemyMelee',undodgeable:true}); assert.equal(g(s).length,0); update(s,9999); assert.equal(g(s).length,0); update(s,10000); assert.equal(g(s).length,1); }
{ const s=scene(); addLevels(s,3); s.eventBus.emit(CombatEvents.COMBAT_STARTED,{kind:'wave',group:1,wave:1}); assert.equal(g(s).length,0); update(s,4600); assert.equal(normal(s)[0].remainingValue,21); addLevels(s,3); assert.equal(s.playerData.maxShield,118); assert.equal(normal(s)[0].remainingValue,21); assert.equal(normal(s)[0].persistent,true); }
{ const s=scene(), e=enemy(); s.playerData.defense=10; addLevels(s,6); update(s,4000); const first=normal(s)[0]; assert.equal(first.persistent,true); update(s,999999); assert.equal(normal(s).length,1); assert.equal(normal(s)[0].id,first.id); s.combatSystem.damagePlayer(e,200,{source:'enemyMelee',undodgeable:true}); update(s,1003998); assert.equal(g(s).length,0); update(s,1003999); assert.equal(normal(s).length,1); }
{ const s=scene(), e=enemy(); addLevels(s,9); update(s,3400); assert.equal(normal(s).length,1); s.combatSystem.damagePlayer(e,100,{source:'enemyMelee',undodgeable:true}); assert.equal(g(s).length,0); update(s,4399); assert.equal(g(s).length,0); update(s,4400); assert.equal(regen(s).length,1); assert.equal(regen(s)[0].remainingValue,62); assert(String(regen(s)[0].sourceId).startsWith('guardian_shield_regen')); update(s,99999); assert.equal(normal(s).length,0); s.combatSystem.damagePlayer(e,100,{source:'enemyMelee',undodgeable:true}); update(s,103398); assert.equal(g(s).length,0); update(s,103399); assert.equal(normal(s).length,1); s.combatSystem.damagePlayer(e,100,{source:'enemyMelee',undodgeable:true}); update(s,103999); assert.equal(regen(s).length,0); }
{ const s=scene(); addLevels(s,1); update(s,2000); s.skillSystem.addOrLevel('guardian_shield'); run(s); update(s,4799); assert.equal(g(s).length,0); update(s,4800); assert.equal(g(s).length,1); const first=g(s)[0]; s.skillSystem.addOrLevel('guardian_shield'); run(s); assert.equal(g(s)[0].id,first.id); assert.equal(g(s)[0].remainingValue,first.remainingValue); }
{ const s=scene(); addLevels(s,1); s.statusEffects.add(StatusEffects.SHIELD,s.playerData,{durationMs:99999,value:80,remainingValue:80,sourceId:'other'}); update(s,5000); assert.equal(g(s).length,0); update(s,9999); assert.equal(g(s).length,0); s.statusEffects.getEffects(s.playerData,StatusEffects.SHIELD).forEach(e=>s.statusEffects.removeEffect(e)); update(s,10000); assert.equal(g(s).length,1); assert(s.playerData.shield<=s.playerData.maxShield); }
{ const s=scene(); addLevels(s,9); update(s,3400); const before=s.skillSystem.passiveUpdaters.length; s.playerData.skills=[]; s.skillSystem.removeSkillRuntime('guardian_shield'); assert.equal(g(s).length,0); assert.equal(s.playerData.maxShield,50); assert.equal(s.skillSystem.passiveUpdaters.length,before-1); s.skillSystem.removeSkillRuntime('guardian_shield'); update(s,999999); assert.equal(g(s).length,0); }
console.log('v0.10.88 guardian shield recharge validation passed.');
