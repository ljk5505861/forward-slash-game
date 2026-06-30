import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { createPlayerRuntime, getEffectiveDefense } from '../src/config/balance.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import StatusEffectSystem, { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import SkillSystem from '../src/systems/SkillSystem.js';

class Bus{constructor(){this.m=[]} on(t,f){this.m.push([t,f]);return()=>{this.m=this.m.filter(x=>x[1]!==f)}} emit(t,p){for(const [k,f] of [...this.m]) if(k===t) f(p)}}
const enemy=(o={})=>({x:300,y:850,hp:1000,maxHp:1000,active:true,defense:0,damageReduction:0,physicalDamageTakenBonuses:{},...o});
function scene(){ const bus=new Bus(), p=createPlayerRuntime(); const s={now:0,player:{x:220,y:850},playerData:p,enemies:[],eventBus:bus,floatTexts:[],balance:{enemyFadeMs:1,stageWorldWidth:10000},targeting:{valid:e=>!!e&&e.active!==false&&!e.isDefeated&&(e.hp??0)>0,isEnemyFullyInsideViewport(){return true},all(){return s.enemies.filter(this.valid)}},professionSystem:{getDamageMultiplier(){return 1}},artifactSystem:{highHpDamageMultiplier(){return 1}},statusEffects:null,skillSystem:null,isGameplayPaused(){return false},getGameplayTime(){return this.now},floatText(){},hud:{update(){}},finishRun(){this.finished=true},awardGold(){},tweens:{add(c){c.onComplete?.();return{}}}}; s.statusEffects=new StatusEffectSystem(s); s.combatSystem=new CombatSystem(s); s.skillSystem=new SkillSystem(s); return s; }
const run=s=>s.skillSystem.passiveUpdaters.forEach(f=>f());

assert.equal(GAME_VERSION,'0.10.80');
assert.equal(Object.values(SKILLS).filter(s=>!s.temporary).length,25);
assert.deepEqual(Object.values(SKILLS).filter(s=>s.tags?.includes('buildDefense')).map(s=>s.id).sort(),['guardian_shield','healing','thorn_armor'].sort());
for(const id of ['armor_break_shockwave','immovable_mountain','black_tortoise_body']){ assert.equal(SKILLS[id],undefined); assert.equal(SKILL_HANDLERS[id],undefined); }
for(const id of ['healing','thorn_armor','guardian_shield']) assert.equal(SKILLS[id].requiredSkillId,undefined);
assert.deepEqual(SKILLS.healing.levels.map(l=>l.defense),[3,4,6,8,10,13,16,20,25]);
assert.deepEqual(SKILLS.healing.levels.map(l=>l.damageReduction),[0,0,0.02,0.02,0.03,0.05,0.06,0.07,0.10]);
assert.deepEqual(SKILLS.thorn_armor.levels.map(l=>l.defenseScale),[0.80,0.95,1.10,1.30,1.50,1.75,2.00,2.30,2.70]);
assert.deepEqual(SKILLS.thorn_armor.levels.map(l=>l.flatDamage),[8,9,10,12,14,16,18,21,25]);
assert.deepEqual(SKILLS.thorn_armor.levels.map(l=>l.internalCooldownMs),[500,480,450,420,390,350,320,280,250]);
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.maxShieldBonus),[30,36,42,50,58,68,80,92,105]);
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.defenseScale),[0.80,0.90,1.00,1.15,1.30,1.50,1.70,1.90,2.20]);
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.flatShield),[12,14,16,18,20,24,28,32,36]);
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.rechargeMs),[5000,4800,4600,4400,4200,4000,3800,3600,3400]);
assert.deepEqual(SKILLS.guardian_shield.levels.map(l=>l.generatedShieldMultiplier),[1,1,1.3,1.3,1.3,1.3,1.3,1.3,1.3]);

{ const s=scene(); s.skillSystem.addOrLevel('healing'); run(s); assert.equal(getEffectiveDefense(s.playerData),3); assert.equal(s.playerData.maxShield,50); for(let i=0;i<8;i++) s.skillSystem.addOrLevel('healing'); run(s); assert.equal(getEffectiveDefense(s.playerData),25); assert.equal(s.playerData.damageReductionBonuses.healing,0.10); s.playerData.skills=s.playerData.skills.filter(x=>x.id!=='healing'); s.skillSystem.removeSkillRuntime('healing'); run(s); assert.equal(getEffectiveDefense(s.playerData),0); assert.equal(s.playerData.shield,0); }
{ const s=scene(), e=enemy({defense:10}); s.enemies=[e]; s.playerData.defense=10; s.playerData.defenseBonuses.test=5; s.skillSystem.addOrLevel('thorn_armor'); run(s); s.combatSystem.damagePlayer(e,20,{source:'enemyMelee',undodgeable:true}); assert.equal(e.hp,990); s.combatSystem.damagePlayer(e,20,{source:'enemyMelee',undodgeable:true}); assert.equal(e.hp,990); s.now=501; s.combatSystem.damagePlayer(null,20,{source:'poison',undodgeable:true}); assert.equal(e.hp,990); }
{ const s=scene(), main=enemy({defense:10}), near=enemy({x:360,defense:10}), far=enemy({x:500,defense:10}); s.enemies=[main,near,far]; s.playerData.defense=10; for(let i=0;i<6;i++) s.skillSystem.addOrLevel('thorn_armor'); run(s); s.combatSystem.damagePlayer(main,20,{source:'enemyMelee',undodgeable:true}); assert.equal(main.hp,972); assert.equal(near.hp,986); assert.equal(far.hp,1000); }
{ const s=scene(), e=enemy(); s.enemies=[e]; s.playerData.defense=10; for(let i=0;i<9;i++) s.skillSystem.addOrLevel('thorn_armor'); run(s); s.combatSystem.damagePlayer(e,30,{source:'enemyMelee',undodgeable:true}); assert.equal(e.hp,928); }
{ const s=scene(); s.playerData.defense=10; s.skillSystem.addOrLevel('guardian_shield'); run(s); assert.equal(s.playerData.maxShield,80); s.now=4999; run(s); assert.equal(s.playerData.shield,0); s.now=5000; run(s); assert.equal(s.playerData.shield,20); s.statusEffects.update(13000); run(s); assert.equal(s.playerData.shield,0); s.now=18000; run(s); assert.equal(s.playerData.shield,20); for(let i=0;i<8;i++) s.skillSystem.addOrLevel('guardian_shield'); run(s); assert.equal(s.playerData.maxShield,155); s.statusEffects.getEffects(s.playerData,StatusEffects.SHIELD).forEach(e=>s.statusEffects.removeEffect(e)); s.now=18000; run(s); s.now=22000; run(s); assert.equal(s.playerData.shield,75); s.statusEffects.update(s.now+999999); assert.equal(s.playerData.shield,75); s.playerData.skills=s.playerData.skills.filter(x=>x.id!=='guardian_shield'); s.skillSystem.removeSkillRuntime('guardian_shield'); run(s); assert.equal(s.playerData.maxShield,50); assert.equal(s.playerData.shield,0); }
{ const s=scene(); for(let i=0;i<3;i++) s.skillSystem.addOrLevel('guardian_shield'); run(s); s.eventBus.emit(CombatEvents.COMBAT_STARTED,{kind:'wave',group:1,wave:1}); assert.equal(s.playerData.shield,0); s.now=4600; run(s); assert.equal(s.playerData.shield,21); }
{ const s=scene(), e=enemy(); for(let i=0;i<9;i++) s.skillSystem.addOrLevel('guardian_shield'); run(s); s.now=3400; run(s); assert.equal(s.playerData.shield,47); s.combatSystem.damagePlayer(e,100,{source:'enemyMelee',undodgeable:true}); assert.equal(s.playerData.shield,0); s.now=4399; run(s); assert.equal(s.playerData.shield,0); s.now=4400; run(s); assert.equal(s.playerData.shield,62); }
console.log('validate-01062-defense-rework passed');
