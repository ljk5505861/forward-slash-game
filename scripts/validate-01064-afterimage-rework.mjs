import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { EntryMovementSkill } from '../src/skills/handlers/AfterimageEntryRuntime.js';
import { PhantomStepSkill, TracelessSkill } from '../src/skills/handlers/AfterimageCoreSkills.js';
import { InstantStepSkill } from '../src/skills/handlers/AfterimageAdvancedSkills.js';
import { MyriadAfterimageSkill } from '../src/skills/handlers/AfterimageUltimateSkills.js';

class Bus {
  constructor(){ this.map=new Map(); }
  on(event,fn){ const listeners=this.map.get(event)||[]; listeners.push(fn); this.map.set(event,listeners); return ()=>this.map.set(event,(this.map.get(event)||[]).filter(item=>item!==fn)); }
  emit(event,payload={}){ (this.map.get(event)||[]).slice().forEach(fn=>fn(payload)); }
}

class Clock {
  constructor(){ this.now=0; this.timers=[]; }
  delayedCall(delay,fn){ const timer={at:this.now+Math.max(0,delay||0),fn,removed:false,remove(){this.removed=true;},once(){return this;}}; this.timers.push(timer); return timer; }
  advance(ms){ const end=this.now+ms; let guard=0; while(guard++<10000){ const next=this.timers.filter(timer=>!timer.removed&&timer.at<=end).sort((a,b)=>a.at-b.at)[0]; if(!next) break; next.removed=true; this.now=next.at; next.fn?.(); } this.now=end; }
}

const makeNode=(x=0,y=0)=>({
  x,y,alpha:1,scaleX:1,scaleY:1,active:true,width:0,height:0,
  setStrokeStyle(){return this;},setDepth(){return this;},setPosition(nx,ny){this.x=nx;this.y=ny;return this;},
  setAlpha(value){this.alpha=value;return this;},setScale(xValue,yValue=xValue){this.scaleX=xValue;this.scaleY=yValue;return this;},
  setOrigin(){return this;},setScrollFactor(){return this;},setInteractive(){return this;},disableInteractive(){return this;},on(){return this;},removeAllListeners(){return this;},
  destroy(){this.destroyed=true;this.active=false;return this;},clear(){return this;},fillStyle(){return this;},beginPath(){return this;},moveTo(){return this;},lineTo(){return this;},closePath(){return this;},fillPath(){return this;},lineStyle(){return this;},strokePoints(){return this;},lineBetween(){return this;},fillTriangle(){return this;},setText(value){this.text=value;return this;}
});
const enemy=(options={})=>({x:options.x??520,y:options.y??500,hp:options.hp??5000,maxHp:options.maxHp??5000,active:true,isDefeated:false,isBoss:false,isElite:false,nextAttackAt:0,body:{setVelocityX(){}},...options});

function makeScene(){
  const eventBus=new Bus(),clock=new Clock();
  const scene={
    eventBus,time:clock,player:makeNode(300,560),
    playerData:{hp:100,maxHp:500,maxShield:500,shield:0,attack:100,weaponId:'starter_sword',attackSpeedMultiplier:1,skillDamageMultiplier:1,dodgeChance:0,critChance:0,critMultiplier:1.5,skills:[],attackDamageBonuses:{},normalAttackDamageBonuses:{},attackSpeedMultiplierBonuses:{},dodgeChanceBonuses:{},afterimageDamageBonuses:{},physicalCritChanceBonuses:{},physicalCritMultiplierBonuses:{}},
    enemies:[],currentTarget:null,damageCalls:[],heals:[],shieldEffects:[],runState:'RUNNING',
    getGameplayTime(){return clock.now;},isGameplayPaused(){return false;},beginGameplayPause(){this.paused=true;},resumeModalFlow(){this.resumed=true;this.runState='RUNNING';},floatText(){},
    add:{rectangle:(x=0,y=0)=>makeNode(x,y),circle:(x=0,y=0)=>makeNode(x,y),text:(x=0,y=0,text='')=>Object.assign(makeNode(x,y),{text}),graphics:()=>makeNode()},
    tweens:{add(config={}){config.onComplete?.();return{stop(){},remove(){}};}},
    targeting:{all:()=>scene.enemies.filter(item=>item.active!==false&&!item.isDefeated&&item.hp>0),valid:item=>!!item&&item.active!==false&&!item.isDefeated&&item.hp>0,isEnemyFullyInsideViewport:()=>true},
    professionSystem:{currentAttackProfile:()=>null,getDamageMultiplier:()=>1},artifactSystem:{highHpDamageMultiplier:()=>1},
    combatSystem:{
      calcAttackDamage(){return{damage:100,baseBeforeProfession:100,professionMult:1,crit:true,critResolved:true};},
      damageEnemy(target,amount,meta={}){ if(!scene.targeting.valid(target)) return false; const actual=Math.max(0,Math.min(target.hp,Math.round(amount))); target.hp-=actual; if(target.hp<=0) target.isDefeated=true; scene.damageCalls.push({target,amount:actual,meta}); if(actual>0) eventBus.emit(CombatEvents.ENEMY_HIT,{enemy:target,damage:actual,baseAmountBeforeProfession:meta.baseAmountBeforeProfession??amount,professionMultiplier:meta.professionMultiplier||1,critResolved:meta.critResolved,crit:meta.crit,...meta}); return actual>0; }
    },
    healPlayer(amount,source='heal',meta={}){ const before=scene.playerData.hp; scene.playerData.hp=Math.min(scene.playerData.maxHp,before+Math.max(0,Math.floor(amount))); const actual=scene.playerData.hp-before; if(actual>0){scene.heals.push({amount:actual,source,meta});eventBus.emit(CombatEvents.PLAYER_HEALED,{amount:actual,source,...meta});} return actual; },
    statusEffects:{add(type,target,options={}){ const effect={type,target,durationMs:options.durationMs||0,initialValue:options.value||0,remainingValue:options.remainingValue??options.value??0,...options}; if(type==='SHIELD'){scene.shieldEffects.push(effect);eventBus.emit(CombatEvents.SHIELD_GAINED,{effect,target,amount:effect.remainingValue,initialValue:effect.initialValue,sourceId:options.sourceId});} return effect; }},
    afterimages:{
      items:[],nextId:1,
      createAfterimage(options={}){ const afterimage={id:this.nextId++,ownerSkillId:options.ownerSkillId||'',createdAt:clock.now,expiresAt:options.durationMs?clock.now+options.durationMs:0,view:makeNode(scene.player.x-20,scene.player.y-52),...options}; this.items.push(afterimage); eventBus.emit(CombatEvents.AFTERIMAGE_CREATED,{afterimage}); return afterimage; },
      getAll(){return[...this.items];},getById(id){return this.items.find(item=>item.id===id)||null;},
      removeAfterimage(id){ const index=this.items.findIndex(item=>item.id===id); if(index<0)return false; const[removed]=this.items.splice(index,1); removed.view?.destroy?.(); eventBus.emit(CombatEvents.AFTERIMAGE_REMOVED,{afterimage:removed}); return true; }
    },
    upgradePanel:{show(config){scene.selectionConfig=config;},hide(){scene.selectionHidden=true;}}
  };
  return scene;
}

function makeSystem(scene){
  return {
    scene,passiveUpdaters:[],passiveState:{},
    getLevel:id=>scene.playerData.skills.find(item=>item.id===id)?.level||0,
    getData:(id,level)=>SKILLS[id]?.levels[(level??(scene.playerData.skills.find(item=>item.id===id)?.level||1))-1],
    damageValue:(raw,ctx)=>Math.round(raw*(ctx?.damageMultiplier||1)),
    baseDamageValue:(raw,ctx)=>Math.round(raw*(ctx?.baseDamageMultiplierWithoutProfession||ctx?.damageMultiplier||1))
  };
}
const runUpdaters=system=>system.passiveUpdaters.slice().forEach(fn=>fn());

assert.equal(GAME_VERSION,'0.10.95');
assert.equal(SKILLS.shadow_assault,undefined);
assert.equal(SKILLS.swift_shadow,undefined);
for(const id of ['shadow_fist','traceless','phantom_step','instant_step','myriad_afterimage']){
  assert.ok(SKILLS[id]);
  assert.equal(SKILLS[id].requiredSkillId,undefined);
}
assert.deepEqual(SKILLS.shadow_fist.levels.map(level=>level.attackSpeedBonus),[.06,.09,.13,.17,.21,.26,.31,.36,.42]);
assert.deepEqual(SKILLS.shadow_fist.levels.map(level=>level.dodgeChance),[.05,.07,.10,.12,.14,.17,.19,.22,.25]);
assert.deepEqual(SKILLS.traceless.levels.map(level=>level.dodgeHeal),[5,7,10,13,16,20,24,29,35]);
assert.deepEqual(SKILLS.phantom_step.levels.map(level=>level.maxAfterimages),[2,2,3,3,3,4,4,4,5]);
assert.deepEqual(SKILLS.instant_step.levels.map(level=>level.cooldownMs),[7000,6700,6400,6100,5800,5400,5000,4600,4200]);
assert.deepEqual(SKILLS.myriad_afterimage.levels.map(level=>level.copyRatio),[.15,.18,.21,.24,.27,.30,.34,.38,.45]);

{
  const scene=makeScene(); scene.playerData.skills=[{id:'shadow_fist',level:9}]; const system=makeSystem(scene); const off=EntryMovementSkill.bind(system);
  assert.equal(scene.playerData.attackSpeedMultiplierBonuses.shadow_fist,.42); assert.equal(scene.playerData.dodgeChanceBonuses.shadow_fist,.25);
  scene.playerData.skills[0].level=3; runUpdaters(system); assert.equal(scene.playerData.attackSpeedMultiplierBonuses.shadow_fist,.13); assert.equal(scene.playerData.dodgeChanceBonuses.shadow_fist,.10);
  off(); assert.equal(scene.playerData.attackSpeedMultiplierBonuses.shadow_fist,undefined); assert.equal(scene.playerData.dodgeChanceBonuses.shadow_fist,undefined);
}
{
  const scene=makeScene(); scene.playerData.skills=[{id:'traceless',level:3}]; scene.playerData.hp=50; const system=makeSystem(scene); const off=TracelessSkill.bind(system);
  scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{}); scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{}); assert.equal(scene.playerData.hp,70); off();
}
{
  const scene=makeScene(); scene.enemies=[enemy()]; scene.playerData.skills=[{id:'phantom_step',level:3}]; const system=makeSystem(scene); const off=PhantomStepSkill.bind(system);
  scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{}); assert.equal(scene.afterimages.items.length,2); scene.time.advance(200); runUpdaters(system); assert.equal(scene.damageCalls.length,2); off();
}
{
  const scene=makeScene(); scene.enemies=[enemy({hp:50000})]; scene.playerData.skills=[{id:'instant_step',level:9}]; scene.playerData.attackSpeedMultiplier=2.2; const system=makeSystem(scene); const off=InstantStepSkill.bind(system);
  scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{}); scene.time.advance(500); assert.equal(scene.damageCalls.length,6); off();
}

{
  const scene=makeScene(); scene.enemies=[enemy({hp:5000})]; scene.playerData.skills=[{id:'myriad_afterimage',level:1}]; const system=makeSystem(scene); const off=MyriadAfterimageSkill.bind(system);
  assert.equal(scene.playerData.myriadAfterimageSkillId,'normal_attack');
  assert.equal(scene.afterimages.items.filter(item=>item.ownerSkillId==='myriad_afterimage').length,1);
  const innate=scene.afterimages.items[0]; assert.equal(innate.expiresAt,0);
  scene.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:1}); scene.time.advance(0); assert.equal(scene.selectionConfig,undefined);
  scene.eventBus.emit(CombatEvents.PLAYER_ATTACK_RESOLVED,{enemy:scene.enemies[0],weapon:{damageMultiplier:1},profile:null,baseDamage:100,heavy:false}); scene.time.advance(500);
  assert.equal(scene.damageCalls.length,1); assert.equal(scene.damageCalls[0].amount,15); assert.equal(scene.damageCalls[0].meta.allowLifeSteal,false); assert.equal(scene.damageCalls[0].meta.originalSkillId,'normal_attack');
  off(); assert.equal(scene.afterimages.items.filter(item=>item.ownerSkillId==='myriad_afterimage').length,0);
}

{
  const scene=makeScene(); scene.playerData.skills=[{id:'myriad_afterimage',level:1},{id:'fireball',level:1},{id:'traceless',level:1},{id:'guardian_shield',level:1},{id:'thorn_armor',level:1},{id:'sword_wave',level:1},{id:'shadow_fist',level:1},{id:'healing',level:1},{id:'giant_force',level:1},{id:'solar_flame',level:1},{id:'phantom_step',level:1},{id:'instant_step',level:1}];
  const eligible=MyriadAfterimageSkill.eligibleSkills(makeSystem(scene));
  for(const id of ['normal_attack','fireball','traceless','guardian_shield','thorn_armor','sword_wave']) assert.ok(eligible.includes(id));
  for(const id of ['shadow_fist','healing','giant_force','solar_flame','phantom_step','instant_step','myriad_afterimage']) assert.ok(!eligible.includes(id));
}

{
  const scene=makeScene(); scene.enemies=[enemy({hp:50000})]; scene.playerData.skills=[{id:'myriad_afterimage',level:1},{id:'fireball',level:1}]; const system=makeSystem(scene); const off=MyriadAfterimageSkill.bind(system);
  scene.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:1}); scene.time.advance(0);
  assert.equal(scene.selectionConfig,undefined); assert.equal(scene.playerData.myriadAfterimageChangeCount,1);
  assert.equal(MyriadAfterimageSkill.openSelection(system,'detail'),true);
  assert.equal(scene.selectionConfig.options.length,2); assert.equal(scene.selectionConfig.options[0].skillId,'normal_attack');
  scene.selectionConfig.onConfirm({skillId:'fireball'}); assert.equal(scene.playerData.myriadAfterimageChangeCount,0);
  scene.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:6000}); scene.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:6000});
  scene.eventBus.emit(CombatEvents.SKILL_CAST_COMPLETED,{skillId:'fireball',skill:SKILLS.fireball,data:{damage:100,shots:1,radius:0},ctx:{castId:1,damageMultiplier:1,baseDamageMultiplierWithoutProfession:1,professionMultiplier:1},target:scene.enemies[0]});
  scene.time.advance(1000); assert.deepEqual(scene.damageCalls.map(call=>call.amount),[15,15,15]); off();
}

{
  const scene=makeScene(); scene.enemies=[enemy({hp:50000})]; scene.playerData.skills=[{id:'myriad_afterimage',level:6},{id:'fireball',level:1}]; scene.playerData.myriadAfterimageSkillId='fireball'; const system=makeSystem(scene); const off=MyriadAfterimageSkill.bind(system);
  const innate=scene.afterimages.items.find(item=>item.ownerSkillId==='myriad_afterimage'); const phantom=scene.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:100});
  scene.eventBus.emit(CombatEvents.SKILL_CAST_COMPLETED,{skillId:'fireball',skill:SKILLS.fireball,data:{damage:100,shots:1,radius:0},ctx:{castId:6,damageMultiplier:1,baseDamageMultiplierWithoutProfession:1,professionMultiplier:1},target:scene.enemies[0]});
  assert.equal(innate.expiresAt,0); assert.equal(phantom.expiresAt,6000); off();
}

{
  const scene=makeScene(); scene.enemies=[enemy({hp:50000})]; scene.playerData.skills=[{id:'myriad_afterimage',level:9},{id:'fireball',level:1}]; scene.playerData.myriadAfterimageSkillId='fireball'; const system=makeSystem(scene); const off=MyriadAfterimageSkill.bind(system);
  scene.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:6000}); scene.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:6000});
  scene.eventBus.emit(CombatEvents.SKILL_CAST_COMPLETED,{skillId:'fireball',skill:SKILLS.fireball,data:{damage:100,shots:1,radius:0},ctx:{castId:9,damageMultiplier:1,baseDamageMultiplierWithoutProfession:1,professionMultiplier:1},target:scene.enemies[0]});
  scene.time.advance(2000); assert.deepEqual(scene.damageCalls.map(call=>call.amount),[45,45,45,23]); off();
}

{
  const source=readFileSync(new URL('../src/ui/UpgradePanel.js',import.meta.url),'utf8');
  assert.match(source,/const columns=Math\.min\(3,Math\.max\(1,count\)\)/);
  const count=6,columns=3,gapX=190,startX=720/2-gapX*(columns-1)/2;
  const positions=Array.from({length:count},(_,index)=>({x:startX+(index%columns)*gapX,y:254+Math.floor(index/columns)*178}));
  assert.ok(positions.every(card=>card.x-74>=0&&card.x+74<=720)); assert.ok(positions.some(card=>card.y>300));
}

console.log('v0.10.95 afterimage behavior validation passed.');
