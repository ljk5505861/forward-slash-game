import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { TAGS } from '../src/config/tags.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import StatusEffectSystem, { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import { CULTIVATION_UNIVERSAL_ACTIVE_MODIFIERS, getCultivationUniversalModifiers } from '../src/skills/handlers/CultivationCoreSkill.js';
import { getActiveSkillCastModifierSnapshot, manaCostValue, rangeValue } from '../src/systems/ActiveSkillModifierSystem.js';
import SkillSystem from '../src/systems/SkillSystem.js';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const expectedSkillIds=['fireball','fire_seed','burn_burst','solar_flame','sword_wave','sword_sheath','sword_tomb','giant_force','spinning_blade','bloodthirst','last_stand','healing','thorn_armor','guardian_shield','shadow_fist','traceless','phantom_step','instant_step','myriad_afterimage','poison_cloud','parasitic_gu','poison_chain','poison_king','spirit_wolves','spirit_bird','spirit_slime','lightning_enchant','lightning_mark','lightning_tribulation','gravity_crush','gravity_reversal','gravity_orb','black_hole','neutron_star','white_dwarf','super_speed','laser_eyes','freezing_breath','ninefold_dao','alchemy'];
function assertSkillPool(){
  assert.equal(GAME_VERSION,'0.11.3');
  assert.equal(pkg.version,'0.11.3');
  assert.equal(Object.keys(SKILLS).length,40);
  assert.equal(new Set(Object.keys(SKILLS)).size,40);
  assert.deepEqual(Object.keys(SKILLS).sort(),[...expectedSkillIds].sort());
}
assertSkillPool();

function makeVisual(){ return {active:true,setDepth(){return this;},setStrokeStyle(){return this;},setOrigin(){return this;},setScrollFactor(){return this;},setFillStyle(){return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setScale(){return this;},add(){return this;},destroy(){this.active=false;}}; }
function makeBus(){ const counts={completed:0,cast:0,status:0}; const listeners=new Map(); return {counts,on(e,fn){ const arr=listeners.get(e)||[]; arr.push(fn); listeners.set(e,arr); return()=>this.off(e,fn); },off(e,fn){ const arr=listeners.get(e)||[]; listeners.set(e,arr.filter(x=>x!==fn)); },emit(e,p){ if(e===CombatEvents.SKILL_CAST_COMPLETED) counts.completed++; if(e===CombatEvents.SKILL_CAST) counts.cast++; if(e===CombatEvents.STATUS_APPLIED) counts.status++; (listeners.get(e)||[]).forEach(fn=>fn(p)); }}; }
function makeScene({realmIndex=0,alchemy=false,skills=[{id:'fireball',level:1}],enemies=[{x:260,y:100,hp:1000,maxHp:1000,active:true}],visible=true,cooldownReduction=0,skillDamageMultiplier=1,professionMultiplier=1,mana=100,maxMana=100,battleMarkStacks=0}={}){
  let now=0; const bus=makeBus(); const timers=[]; const scene={now, enemies, playerData:{skills,hp:100,maxHp:100,mana,maxMana,maxShield:999,shield:0,cooldownReduction,skillDamageMultiplier,battleMarkStacks}, player:{x:0,y:100}, passiveState:{ninefoldDao:{realmIndex}, ...(alchemy?{alchemy:{alchemyBuffUntil:999999}}:{})}, getGameplayTime(){return now;}, setTime(t){now=t; this.now=t;}, isGameplayPaused:()=>false, eventBus:bus, events:{on(){},once(){},off(){}}, add:{circle:makeVisual,rectangle:makeVisual,line:makeVisual,container:makeVisual,ellipse:makeVisual,text:makeVisual,graphics(){return {...makeVisual(),lineStyle(){return this;},lineBetween(){return this;}}}}, tweens:{add(o){ o?.onComplete?.(); return {remove(){},stop(){},destroy(){}};},killTweensOf(){}}, time:{delayedCall(delay,fn){ const timer={at:now+delay,fn,removed:false,remove(){this.removed=true;}}; timers.push(timer); return timer;}}, advanceTo(t){ now=t; this.now=t; timers.sort((a,b)=>a.at-b.at).filter(tm=>!tm.removed&&tm.at<=t).forEach(tm=>{tm.removed=true; tm.fn?.();}); }, targeting:{all:()=>enemies.filter(e=>e.active!==false&&e.hp>0),nearestAhead:()=>enemies.find(e=>e.active!==false&&e.hp>0)||null,random:()=>enemies.find(e=>e.active!==false&&e.hp>0)||null,aroundPlayer:()=>enemies.filter(e=>e.active!==false&&e.hp>0),valid:e=>!!e&&e.active!==false&&e.hp>0,isEnemyFullyInsideViewport:()=>visible}, artifactSystem:{level:id=>id==='battle_mark'?2:0,highHpDamageMultiplier:()=>1,has:()=>false}, professionSystem:{calls:0,getDamageMultiplier:()=>professionMultiplier,onActiveSkillCast(){this.calls++;},onDirectHit(){}}, hud:{update(){}}, skillBar:{update(){}}, floatText(){}, combatSystem:{damageLog:[],damageEnemy(e,d,meta={}){ if(!e||e.active===false||e.hp<=0) return false; this.damageLog.push({enemy:e,damage:d,meta}); e.hp-=d; if(e.hp<=0) e.active=false; return true;},clearKnockback(){}}, healPlayer(amount){ const before=this.playerData.hp; this.playerData.hp=Math.min(this.playerData.maxHp,before+Math.max(0,Math.round(amount))); return this.playerData.hp-before; }}; scene.statusEffects=new StatusEffectSystem(scene); scene.skillSystem=new SkillSystem(scene); scene.skillSystem.passiveState={...scene.passiveState}; return scene; }

for(let i=0;i<9;i++) assert.deepEqual(getCultivationUniversalModifiers(makeScene({realmIndex:i})),{...CULTIVATION_UNIVERSAL_ACTIVE_MODIFIERS[i]});
assert.deepEqual(getCultivationUniversalModifiers({}),{activeSkillDamageMultiplier:1,activeSkillCooldownMultiplier:1});
const fire=SKILLS.fireball;
assert.equal(getActiveSkillCastModifierSnapshot(makeScene({realmIndex:8,alchemy:true}),fire).appliedDamageMultiplier,2.04);
const cult={id:'test_cultivation_active',passive:false,tags:[TAGS.CULTIVATION]};
let cultSnap=getActiveSkillCastModifierSnapshot(makeScene({realmIndex:8,alchemy:true}),cult);
assert.equal(cultSnap.appliedDamageMultiplier,90); assert.equal(cultSnap.appliedRangeMultiplier,2.5); assert.equal(cultSnap.appliedCooldownMultiplier,.45); assert.equal(cultSnap.appliedManaCostMultiplier,.5); assert.equal(manaCostValue(33,cultSnap),16.5); assert.equal(rangeValue(100,cultSnap),250);
assert.equal(getActiveSkillCastModifierSnapshot(makeScene({realmIndex:8,alchemy:true}),{id:'passive',passive:true}).appliedDamageMultiplier,1);

for(const [realm,expected] of [[0,1],[2,1.06],[3,1.10],[8,1.70]]){
  const enemy={x:200,y:100,hp:1000,maxHp:1000,active:true};
  const sc=makeScene({realmIndex:realm,enemies:[enemy],professionMultiplier:1.5,skillDamageMultiplier:2,battleMarkStacks:5});
  sc.skillSystem.update(1000);
  const hit=sc.combatSystem.damageLog[0];
  assert.ok(hit,`fireball hit realm ${realm}`);
  assert.equal(hit.meta.professionMultiplier,1.5);
  assert.equal(hit.meta.baseAmountBeforeProfession,Math.round((SKILLS.fireball.levels[0].damage)*2*1.45*expected));
  assert.equal(sc.professionSystem.calls,1);
  assert.equal(sc.eventBus.counts.completed,1);
}
{
  const enemy={x:200,y:100,hp:1000,maxHp:1000,active:true};
  const sc=makeScene({realmIndex:8,alchemy:true,enemies:[enemy],professionMultiplier:1,skillDamageMultiplier:1});
  sc.skillSystem.update(1000);
  const completedReady=sc.skillSystem.cooldowns.get('fireball');
  assert.equal(sc.combatSystem.damageLog[0].damage,Math.round(SKILLS.fireball.levels[0].damage*2.04));
  assert.equal(completedReady,1000+Math.max(300,SKILLS.fireball.levels[0].cooldownMs*.85));
  sc.skillSystem.passiveState.ninefoldDao.realmIndex=0; delete sc.skillSystem.passiveState.alchemy;
  assert.equal(sc.skillSystem.cooldowns.get('fireball'),completedReady,'old readyAt snapshot is stable');
  sc.skillSystem.cooldowns.delete('fireball'); enemy.hp=1000; enemy.active=true; sc.combatSystem.damageLog=[]; sc.skillSystem.update(3000);
  assert.equal(sc.combatSystem.damageLog[0].damage,SKILLS.fireball.levels[0].damage,'next cast reads neutral state');
}
{
  const enemy={x:200,y:100,hp:1000,maxHp:1000,active:true};
  const sc=makeScene({realmIndex:8,alchemy:true,enemies:[enemy],professionMultiplier:1,skillDamageMultiplier:1});
  sc.skillSystem.update(1000);
  const burn=[...sc.statusEffects.effects.values()].find(e=>e.type===StatusEffects.BURN);
  assert.ok(burn); assert.equal(burn.damageMultiplier,2.04); const oldNext=burn.nextTickAt;
  delete sc.skillSystem.passiveState.alchemy; sc.skillSystem.passiveState.ninefoldDao.realmIndex=0;
  sc.statusEffects.update(oldNext);
  assert.equal(sc.combatSystem.damageLog.at(-1).damage,Math.round(burn.value*burn.stacks*2.04));
  sc.skillSystem.cooldowns.delete('fireball'); enemy.hp=1000; enemy.active=true; sc.skillSystem.update(3000);
  const burns=[...sc.statusEffects.effects.values()].filter(e=>e.type===StatusEffects.BURN);
  assert.ok(burns.some(e=>e.damageMultiplier===1));
}

{
  const enemy={x:200,y:100,hp:1000,maxHp:1000,active:true};
  const sc=makeScene({skills:[{id:'__test_false_active',level:1}],enemies:[enemy],mana:50,maxMana:50,battleMarkStacks:5});
  SKILLS.__test_false_active={id:'__test_false_active',passive:false,handler:'__test_false_active',targetType:'nearestAhead',cooldownMs:1000,manaCost:7,maxLevel:1,levels:[{damage:1,cooldownMs:1000,manaCost:7}]};
  SKILL_HANDLERS.__test_false_active={canCast(){return true;},cast(){return false;}};
  try{ sc.skillSystem.update(1000); assert.equal(sc.playerData.mana,50); assert.equal(sc.playerData.battleMarkStacks,5); assert.equal(sc.skillSystem.cooldowns.has('__test_false_active'),false); assert.equal(sc.professionSystem.calls,0); assert.equal(sc.eventBus.counts.completed,0); assert.equal(sc.combatSystem.damageLog.length,0); assert.equal(sc.statusEffects.effects.size,0); assert.equal(sc.passiveState.spiritWolves,undefined); }
  finally{ delete SKILLS.__test_false_active; delete SKILL_HANDLERS.__test_false_active; }
}
{
  const enemy={x:200,y:100,hp:1000,maxHp:1000,active:true};
  const sc=makeScene({skills:[{id:'gravity_crush',level:1}],enemies:[enemy],visible:false,mana:50,maxMana:50,battleMarkStacks:5});
  sc.skillSystem.update(1000);
  assert.equal(sc.playerData.mana,50); assert.equal(sc.playerData.battleMarkStacks,5); assert.equal(sc.professionSystem.calls,0); assert.equal(sc.eventBus.counts.completed,0); assert.equal(sc.skillSystem.cooldowns.has('gravity_crush'),false); assert.equal(sc.gravityRuntime?.pendingStrikes?.size||0,0); assert.equal(sc.gravityRuntime?.visuals?.size||0,0);
}

assertSkillPool();
console.log('v0.11.3 active skill modifier validation passed.');
