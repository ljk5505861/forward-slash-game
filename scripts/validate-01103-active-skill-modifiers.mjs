import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { TAGS } from '../src/config/tags.js';
import { CULTIVATION_UNIVERSAL_ACTIVE_MODIFIERS, getCultivationUniversalModifiers, getCultivationSpellModifiers } from '../src/skills/handlers/CultivationCoreSkill.js';
import { getActiveSkillCastModifierSnapshot, manaCostValue, rangeValue } from '../src/systems/ActiveSkillModifierSystem.js';
import SkillSystem from '../src/systems/SkillSystem.js';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(GAME_VERSION,'0.11.3'); assert.equal(pkg.version,'0.11.3');
const formal=Object.values(SKILLS).filter(s=>s?.id&&!s.hidden); assert.equal(formal.length,40);
function scene(realmIndex=0,alchemy=false){ const listeners={}; const passiveState={ninefoldDao:{realmIndex}, ...(alchemy?{alchemy:{alchemyBuffUntil:99999}}:{})}; const sc={playerData:{skills:[{id:'ninefold_dao',level:1}],hp:100,maxHp:100,mana:100,maxMana:100,cooldownReduction:0,skillDamageMultiplier:2,battleMarkStacks:5}, player:{x:0,y:0}, passiveState, getGameplayTime:()=>0, eventBus:{emit(){},on(e,f){(listeners[e]??=[]).push(f); return()=>{};}}, events:{on(){},once(){},off(){}}, targeting:{all:()=>[],aroundPlayer:()=>[],nearestAhead:()=>null,random:()=>null,isEnemyFullyInsideViewport:()=>true}, artifactSystem:{level:id=>id==='battle_mark'?2:0,highHpDamageMultiplier:()=>1.25}, professionSystem:{calls:0,getDamageMultiplier:()=>1.5,onActiveSkillCast(){this.calls++;}}, hud:{update(){}}, skillBar:{update(){}}, floatText(){}, combatSystem:{damageEnemy(e,d,m){ e.damage=(e.damage||0)+d; e.meta=m; return true; }}}; sc.skillSystem={passiveState}; return sc; }
for(let i=0;i<9;i++){ const sc=scene(i); assert.deepEqual(getCultivationUniversalModifiers(sc),{...CULTIVATION_UNIVERSAL_ACTIVE_MODIFIERS[i]}); }
assert.deepEqual(getCultivationUniversalModifiers({}),{activeSkillDamageMultiplier:1,activeSkillCooldownMultiplier:1});
const fire=SKILLS.fireball; assert.equal(getActiveSkillCastModifierSnapshot(scene(0),fire).appliedDamageMultiplier,1); assert.equal(getActiveSkillCastModifierSnapshot(scene(2),fire).appliedDamageMultiplier,1.06); assert.equal(getActiveSkillCastModifierSnapshot(scene(3),fire).appliedCooldownMultiplier,.96); assert.equal(getActiveSkillCastModifierSnapshot(scene(8,true),fire).appliedDamageMultiplier,2.04);
const cult={id:'test_cultivation_active',passive:false,tags:[TAGS.CULTIVATION]}; let snap=getActiveSkillCastModifierSnapshot(scene(8,true),cult); assert.equal(snap.appliedDamageMultiplier,90); assert.equal(snap.appliedRangeMultiplier,2.5); assert.equal(snap.appliedCooldownMultiplier,.45); assert.equal(snap.appliedManaCostMultiplier,.5); assert.equal(manaCostValue(33,snap),16.5); assert.equal(rangeValue(100,snap),250);
assert.equal(getActiveSkillCastModifierSnapshot(scene(8,true),{id:'passive',passive:true}).appliedDamageMultiplier,1);
const sc=scene(8,true); const sys=new SkillSystem(sc); sc.skillSystem=sys; sys.passiveState={ninefoldDao:{realmIndex:8},alchemy:{alchemyBuffUntil:99999}}; const ctx=sys.createCastContext('fireball',fire,{castModifierSnapshot:getActiveSkillCastModifierSnapshot(sys,fire),manaCost:0}); assert.equal(ctx.baseDamageMultiplierWithoutProfession,2*1.45*1.25*2.04); assert.equal(ctx.damageMultiplier,ctx.baseDamageMultiplierWithoutProfession*1.5); sys.finalizeCastContext(ctx); assert.equal(sc.playerData.battleMarkStacks,0); assert.equal(sc.professionSystem.calls,1); sys.finalizeCastContext(ctx); assert.equal(sc.professionSystem.calls,1);
const manaScene=scene(8,true); manaScene.playerData.mana=1; manaScene.playerData.maxMana=1; manaScene.playerData.skills=[{id:'fireball',level:1}]; const sys2=new SkillSystem(manaScene); manaScene.skillSystem=sys2; sys2.update(1000); assert.equal(manaScene.playerData.mana,1); assert.equal(sys2.cooldowns.size,0); assert.equal(manaScene.professionSystem.calls,0);
assert.equal(Object.values(SKILLS).filter(s=>s?.id&&!s.hidden).length,40);
console.log('v0.11.3 active skill modifier validation passed.');
