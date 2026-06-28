import assert from 'node:assert/strict';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { EntryMovementSkill } from '../src/skills/handlers/AfterimageEntryRuntime.js';
import { PhantomStepSkill, TracelessSkill } from '../src/skills/handlers/AfterimageCoreSkills.js';
import { InstantStepSkill } from '../src/skills/handlers/AfterimageAdvancedSkills.js';
import { MyriadAfterimageSkill } from '../src/skills/handlers/AfterimageUltimateSkills.js';
import UpgradePanel from '../src/ui/UpgradePanel.js';

class Bus{
  constructor(){ this.map=new Map(); }
  on(event,fn){ const list=this.map.get(event)||[]; list.push(fn); this.map.set(event,list); return ()=>this.map.set(event,(this.map.get(event)||[]).filter(item=>item!==fn)); }
  emit(event,payload={}){ (this.map.get(event)||[]).slice().forEach(fn=>fn(payload)); }
}
class Clock{
  constructor(){ this.now=0; this.timers=[]; }
  delayedCall(delay,fn){ const timer={at:this.now+Math.max(0,delay||0),fn,removed:false,remove(){this.removed=true;},once(){return this;}}; this.timers.push(timer); return timer; }
  advance(ms){ const end=this.now+ms; let guard=0; while(guard++<10000){ const next=this.timers.filter(timer=>!timer.removed&&timer.at<=end).sort((a,b)=>a.at-b.at)[0]; if(!next) break; next.removed=true; this.now=next.at; next.fn?.(); } this.now=end; }
}
const makeNode=(x=0,y=0)=>({x,y,alpha:1,scaleX:1,scaleY:1,active:true,width:0,height:0,displayWidth:0,displayHeight:0,setStrokeStyle(){return this;},setDepth(){return this;},setPosition(nx,ny){this.x=nx;this.y=ny;return this;},setAlpha(value){this.alpha=value;return this;},setScale(xValue,yValue=xValue){this.scaleX=xValue;this.scaleY=yValue;return this;},setOrigin(){return this;},setScrollFactor(){return this;},setInteractive(){return this;},disableInteractive(){return this;},on(){return this;},removeAllListeners(){return this;},destroy(){this.destroyed=true;this.active=false;return this;},clear(){return this;},fillStyle(){return this;},beginPath(){return this;},moveTo(){return this;},lineTo(){return this;},closePath(){return this;},fillPath(){return this;},lineStyle(){return this;},strokePoints(){return this;},lineBetween(){return this;},fillTriangle(){return this;},setText(value){this.text=value;return this;}});
const enemy=(options={})=>({x:options.x??520,y:options.y??500,hp:options.hp??5000,maxHp:options.maxHp??5000,active:true,isDefeated:false,isBoss:false,isElite:false,nextAttackAt:0,body:{setVelocityX(){}},...options});
function makeScene(){
  const eventBus=new Bus(),clock=new Clock();
  const scene={
    eventBus,time:clock,player:makeNode(300,560),playerData:{hp:100,maxHp:500,maxShield:500,shield:0,attack:100,weaponId:'starter_sword',attackSpeedMultiplier:1,skillDamageMultiplier:1,dodgeChance:0,critChance:0,critMultiplier:1.5,skills:[],attackDamageBonuses:{},normalAttackDamageBonuses:{},attackSpeedMultiplierBonuses:{},dodgeChanceBonuses:{},afterimageDamageBonuses:{},physicalCritChanceBonuses:{},physicalCritMultiplierBonuses:{}},
    enemies:[],currentTarget:null,visuals:[],damageCalls:[],heals:[],shieldEffects:[],runState:'RUNNING',
    getGameplayTime(){return clock.now;},isGameplayPaused(){return false;},beginGameplayPause(){this.paused=true;},resumeModalFlow(){this.resumed=true;this.runState='RUNNING';},floatText(){},
    add:{rectangle(x=0,y=0,w=0,h=0){const node=makeNode(x,y);node.width=w;node.height=h;scene.visuals.push(node);return node;},circle(x=0,y=0){const node=makeNode(x,y);scene.visuals.push(node);return node;},text(x=0,y=0,text=''){const node=makeNode(x,y);node.text=text;scene.visuals.push(node);return node;},graphics(){const node=makeNode();scene.visuals.push(node);return node;}},
    tweens:{add(config={}){config.onComplete?.();return {stop(){},remove(){}};}},
    targeting:{all:()=>scene.enemies.filter(item=>item.active!==false&&!item.isDefeated&&item.hp>0),valid:item=>!!item&&item.active!==false&&!item.isDefeated&&item.hp>0,isEnemyFullyInsideViewport:()=>true},
    professionSystem:{currentAttackProfile:()=>null,getDamageMultiplier:()=>1},artifactSystem:{highHpDamageMultiplier:()=>1},
    combatSystem:{calcAttackDamage(){return {damage:100,baseBeforeProfession:100,professionMult:1,crit:true,critResolved:true};},damageEnemy(target,amount,meta={}){if(!scene.targeting.valid(target))return false;const actual=Math.max(0,Math.min(target.hp,Math.round(amount)));target.hp-=actual;if(target.hp<=0)target.isDefeated=true;scene.damageCalls.push({target,amount:actual,meta});if(actual>0)eventBus.emit(CombatEvents.ENEMY_HIT,{enemy:target,damage:actual,baseAmountBeforeProfession:meta.baseAmountBeforeProfession??amount,professionMultiplier:meta.professionMultiplier||1,critResolved:meta.critResolved,crit:meta.crit,...meta});return actual>0;}},
    healPlayer(amount,source='heal',meta={}){const before=scene.playerData.hp;scene.playerData.hp=Math.min(scene.playerData.maxHp,before+Math.max(0,Math.floor(amount)));const actual=scene.playerData.hp-before;if(actual>0){scene.heals.push({amount:actual,source,meta});eventBus.emit(CombatEvents.PLAYER_HEALED,{amount:actual,source,...meta});}return actual;},
    statusEffects:{add(type,target,options={}){const effect={type,target,durationMs:options.durationMs||0,initialValue:options.value||0,remainingValue:options.remainingValue??options.value??0,...options};if(type==='SHIELD'){scene.shieldEffects.push(effect);eventBus.emit(CombatEvents.SHIELD_GAINED,{effect,target,amount:effect.remainingValue,initialValue:effect.initialValue,sourceId:options.sourceId});}return effect;}},
    afterimages:{items:[],nextId:1,createAfterimage(options={}){const afterimage={id:this.nextId++,ownerSkillId:options.ownerSkillId||'',createdAt:clock.now,expiresAt:options.durationMs?clock.now+options.durationMs:0,view:makeNode(scene.player.x-20,scene.player.y-52),...options};this.items.push(afterimage);eventBus.emit(CombatEvents.AFTERIMAGE_CREATED,{afterimage});return afterimage;},getAll(){return [...this.items];},getById(id){return this.items.find(item=>item.id===id)||null;},removeAfterimage(id){const index=this.items.findIndex(item=>item.id===id);if(index<0)return false;const [removed]=this.items.splice(index,1);removed.view?.destroy?.();eventBus.emit(CombatEvents.AFTERIMAGE_REMOVED,{afterimage:removed});return true;}},
    upgradePanel:{show(config){scene.selectionConfig=config;},hide(){scene.selectionHidden=true;}}
  };
  return scene;
}
function makeSystem(scene){return {scene,passiveUpdaters:[],passiveState:{},getLevel:id=>scene.playerData.skills.find(item=>item.id===id)?.level||0,getData:(id,level)=>SKILLS[id]?.levels[(level??(scene.playerData.skills.find(item=>item.id===id)?.level||1))-1],damageValue:(raw,ctx)=>Math.round(raw*(ctx?.damageMultiplier||1)),baseDamageValue:(raw,ctx)=>Math.round(raw*(ctx?.baseDamageMultiplierWithoutProfession||ctx?.damageMultiplier||1))};}
function runUpdaters(system){system.passiveUpdaters.slice().forEach(fn=>fn());}

assert.equal(GAME_VERSION,'0.10.64');
assert.equal(SKILLS.shadow_assault,undefined);assert.equal(SKILLS.swift_shadow,undefined);
for(const id of ['shadow_fist','traceless','phantom_step','instant_step','myriad_afterimage']){assert.ok(SKILLS[id]);assert.equal(SKILLS[id].requiredSkillId,undefined);}
assert.deepEqual(SKILLS.shadow_fist.levels.map(level=>level.attackSpeedBonus),[.06,.09,.13,.17,.21,.26,.31,.36,.42]);
assert.deepEqual(SKILLS.shadow_fist.levels.map(level=>level.dodgeChance),[.05,.07,.10,.12,.14,.17,.19,.22,.25]);
assert.deepEqual(SKILLS.traceless.levels.map(level=>level.dodgeHeal),[5,7,10,13,16,20,24,29,35]);
assert.deepEqual(SKILLS.phantom_step.levels.map(level=>level.maxAfterimages),[2,2,3,3,3,4,4,4,5]);
assert.deepEqual(SKILLS.phantom_step.levels.map(level=>level.damageRatio),[.40,.46,.52,.58,.64,.70,.78,.86,.95]);
assert.deepEqual(SKILLS.instant_step.levels.map(level=>level.damageRatio),[.60,.68,.76,.84,.92,1.00,1.08,1.18,1.30]);
assert.deepEqual(SKILLS.instant_step.levels.map(level=>level.cooldownMs),[7000,6700,6400,6100,5800,5400,5000,4600,4200]);
assert.deepEqual(SKILLS.instant_step.levels.map(level=>level.convertDodgeCap),[.06,.07,.08,.10,.12,.14,.16,.18,.20]);
assert.deepEqual(SKILLS.myriad_afterimage.levels.map(level=>level.copyRatio),[.15,.18,.21,.24,.27,.30,.34,.38,.45]);

{
  const scene=makeScene();scene.playerData.skills=[{id:'shadow_fist',level:9}];const system=makeSystem(scene);const off=EntryMovementSkill.bind(system);
  assert.equal(scene.playerData.attackSpeedMultiplierBonuses.shadow_fist,.42);assert.equal(scene.playerData.dodgeChanceBonuses.shadow_fist,.25);assert.equal(scene.playerData.attackSpeedMultiplier,1);assert.equal(scene.playerData.dodgeChance,0);
  scene.playerData.skills[0].level=3;runUpdaters(system);assert.equal(scene.playerData.attackSpeedMultiplierBonuses.shadow_fist,.13);assert.equal(scene.playerData.dodgeChanceBonuses.shadow_fist,.10);off();assert.equal(scene.playerData.attackSpeedMultiplierBonuses.shadow_fist,undefined);assert.equal(scene.playerData.dodgeChanceBonuses.shadow_fist,undefined);
}
{
  const scene=makeScene();scene.playerData.skills=[{id:'traceless',level:3}];scene.playerData.hp=50;const system=makeSystem(scene);const off=TracelessSkill.bind(system);
  scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});assert.equal(scene.playerData.hp,70);assert.equal(scene.playerData.dodgeChanceBonuses.traceless,.24);off();assert.equal(scene.playerData.dodgeChanceBonuses.traceless,undefined);
}
{
  const scene=makeScene();scene.enemies=[enemy()];scene.playerData.skills=[{id:'phantom_step',level:3}];const system=makeSystem(scene);const off=PhantomStepSkill.bind(system);
  scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});assert.equal(scene.afterimages.items.length,2);scene.time.advance(200);runUpdaters(system);assert.equal(scene.damageCalls.length,2);assert.ok(scene.damageCalls.every(call=>call.meta.allowLifeSteal===false&&call.meta.critResolved===true));scene.time.advance(4000);scene.afterimages.items[0].nextAttackAt=scene.getGameplayTime();runUpdaters(system);scene.time.advance(2000);runUpdaters(system);assert.ok(scene.playerData.attackSpeedMultiplierBonuses.phantom_step>0);off();assert.equal(scene.afterimages.items.length,0);assert.equal(scene.playerData.attackSpeedMultiplierBonuses.phantom_step,undefined);
}
{
  const scene=makeScene();scene.enemies=[enemy({hp:20000})];scene.playerData.skills=[{id:'phantom_step',level:9}];const system=makeSystem(scene);const off=PhantomStepSkill.bind(system);
  scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});assert.equal(scene.afterimages.items.length,5);scene.afterimages.items.forEach(item=>{item.expiresAt=scene.getGameplayTime()+100;});const before=scene.damageCalls.length;scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});assert.equal(scene.damageCalls.length-before,5);assert.ok(scene.afterimages.items.every(item=>item.expiresAt===scene.getGameplayTime()+6000));off();
}
{
  const scene=makeScene();scene.enemies=[enemy({hp:50000})];scene.playerData.skills=[{id:'instant_step',level:6}];scene.playerData.attackSpeedMultiplier=2.2;const system=makeSystem(scene);const off=InstantStepSkill.bind(system);runUpdaters(system);assert.equal(scene.playerData.dodgeChanceBonuses.instant_step,.12);
  scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});scene.time.advance(500);const firstDamage=scene.damageCalls.length;assert.equal(firstDamage,3);scene.time.advance(3699);scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});assert.equal(scene.damageCalls.length,firstDamage);scene.time.advance(1);scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});scene.time.advance(500);assert.equal(scene.damageCalls.length,firstDamage+3);off();
}
{
  const scene=makeScene();scene.enemies=[enemy({hp:50000})];scene.playerData.skills=[{id:'instant_step',level:9}];scene.playerData.attackSpeedMultiplier=2.2;const system=makeSystem(scene);const off=InstantStepSkill.bind(system);
  scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});scene.time.advance(500);assert.equal(scene.damageCalls.length,6);scene.time.advance(2499);scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});assert.equal(scene.damageCalls.length,6);scene.time.advance(1);scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{});scene.time.advance(500);assert.equal(scene.damageCalls.length,12);off();
}
{
  const scene=makeScene();scene.playerData.skills=[{id:'myriad_afterimage',level:1},{id:'fireball',level:1},{id:'traceless',level:1},{id:'guardian_shield',level:1},{id:'thorn_armor',level:1},{id:'sword_wave',level:1},{id:'shadow_fist',level:1},{id:'healing',level:1},{id:'giant_force',level:1},{id:'solar_flame',level:1},{id:'phantom_step',level:1},{id:'instant_step',level:1}];const system=makeSystem(scene);const eligible=MyriadAfterimageSkill.eligibleSkills(system);
  for(const id of ['fireball','traceless','guardian_shield','thorn_armor','sword_wave'])assert.ok(eligible.includes(id));
  for(const id of ['shadow_fist','healing','giant_force','solar_flame','phantom_step','instant_step','myriad_afterimage'])assert.ok(!eligible.includes(id));
}
{
  const scene=makeScene();scene.enemies=[enemy({hp:50000})];scene.playerData.skills=[{id:'myriad_afterimage',level:1},{id:'fireball',level:1},{id:'traceless',level:1},{id:'guardian_shield',level:1},{id:'thorn_armor',level:1},{id:'sword_wave',level:1}];const system=makeSystem(scene);const off=MyriadAfterimageSkill.bind(system);
  scene.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:1});scene.time.advance(0);assert.equal(scene.selectionConfig.options.length,5);scene.selectionConfig.onConfirm({skillId:'fireball'});assert.equal(scene.playerData.myriadAfterimageSkillId,'fireball');
  scene.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:6000});scene.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:6000});const before=scene.damageCalls.length;scene.eventBus.emit(CombatEvents.SKILL_CAST_COMPLETED,{skillId:'fireball',skill:SKILLS.fireball,data:{damage:100,shots:1,radius:0},ctx:{castId:1,damageMultiplier:1,baseDamageMultiplierWithoutProfession:1,professionMultiplier:1},target:scene.enemies[0]});scene.time.advance(1000);assert.equal(scene.damageCalls.length-before,2);assert.ok(scene.damageCalls.slice(before).every(call=>call.amount===15));
  scene.playerData.myriadAfterimageSkillId='traceless';scene.playerData.hp=100;scene.eventBus.emit(CombatEvents.PLAYER_HEALED,{amount:10,source:'traceless',skillId:'traceless'});scene.time.advance(1000);assert.equal(scene.playerData.hp,104);
  scene.playerData.myriadAfterimageSkillId='guardian_shield';scene.eventBus.emit(CombatEvents.SHIELD_GAINED,{amount:20,sourceId:'guardian_shield:1',effect:{durationMs:8000,initialValue:20,remainingValue:20}});scene.time.advance(1000);assert.equal(scene.shieldEffects.filter(effect=>String(effect.sourceId).startsWith('myriad_afterimage_guardian')).length,2);
  scene.playerData.myriadAfterimageSkillId='thorn_armor';const thornBefore=scene.damageCalls.length;scene.eventBus.emit(CombatEvents.ENEMY_HIT,{enemy:scene.enemies[0],damage:40,baseAmountBeforeProfession:40,professionMultiplier:1,skillId:'thorn_armor',source:'reflect',tags:['physical']});scene.time.advance(1000);assert.equal(scene.damageCalls.length-thornBefore,2);
  scene.playerData.myriadAfterimageSkillId='sword_wave';const summonBefore=scene.damageCalls.length;scene.eventBus.emit(CombatEvents.ENEMY_HIT,{enemy:scene.enemies[0],damage:50,baseAmountBeforeProfession:50,professionMultiplier:1,skillId:'sword_wave',tags:['physical','summon']});scene.time.advance(1000);assert.equal(scene.damageCalls.length-summonBefore,2);off();
}
{
  const scene=makeScene();scene.enemies=[enemy({hp:50000})];scene.playerData.skills=[{id:'myriad_afterimage',level:6},{id:'fireball',level:1}];scene.playerData.myriadAfterimageSkillId='fireball';const system=makeSystem(scene);const off=MyriadAfterimageSkill.bind(system);const afterimage=scene.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:100});scene.eventBus.emit(CombatEvents.SKILL_CAST_COMPLETED,{skillId:'fireball',skill:SKILLS.fireball,data:{damage:100,shots:1,radius:0},ctx:{castId:6,damageMultiplier:1,baseDamageMultiplierWithoutProfession:1,professionMultiplier:1},target:scene.enemies[0]});assert.equal(afterimage.expiresAt,6000);off();
}
{
  const scene=makeScene();scene.enemies=[enemy({hp:50000})];scene.playerData.skills=[{id:'myriad_afterimage',level:9},{id:'fireball',level:1}];scene.playerData.myriadAfterimageSkillId='fireball';const system=makeSystem(scene);const off=MyriadAfterimageSkill.bind(system);scene.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:6000});scene.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:6000});scene.eventBus.emit(CombatEvents.SKILL_CAST_COMPLETED,{skillId:'fireball',skill:SKILLS.fireball,data:{damage:100,shots:1,radius:0},ctx:{castId:9,damageMultiplier:1,baseDamageMultiplierWithoutProfession:1,professionMultiplier:1},target:scene.enemies[0]});scene.time.advance(2000);assert.deepEqual(scene.damageCalls.map(call=>call.amount),[45,45,23]);off();
}
{
  const scene={playerData:{skills:[{id:'fireball',level:1},{id:'traceless',level:1},{id:'guardian_shield',level:1},{id:'thorn_armor',level:1},{id:'sword_wave',level:1}]},debugMode:false,visuals:[],add:{rectangle:(x,y,w,h)=>{const node=makeNode(x,y);node.width=w;node.height=h;scene.visuals.push(node);return node;},circle:(x,y)=>{const node=makeNode(x,y);scene.visuals.push(node);return node;},text:(x,y,text)=>{const node=makeNode(x,y);node.text=text;scene.visuals.push(node);return node;},graphics:()=>{const node=makeNode();scene.visuals.push(node);return node;}},tweens:{add(){return {};}}};
  const panel=new UpgradePanel(scene);panel.show({title:'万象残身',options:scene.playerData.skills.map(item=>({type:'myriadCopySkill',skillId:item.id,id:`copy_${item.id}`})),onConfirm(){}});assert.equal(panel.cards.length,5);assert.ok(panel.cards.every(card=>card.x-74>=0&&card.x+74<=720));assert.ok(panel.cards.some(card=>card.y>300));panel.hide();
}
console.log('v0.10.64 afterimage behavior validation passed.');
