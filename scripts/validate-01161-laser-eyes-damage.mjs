import assert from 'node:assert/strict';
import '../src/skills/handlers/index.js';
import {SKILLS} from '../src/config/skills.js';
import {BALANCE,createPlayerRuntime} from '../src/config/balance.js';
import {CombatEvents} from '../src/core/CombatEvents.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import GameSpeedSystem from '../src/systems/GameSpeedSystem.js';
import {getLaserEyesDataForMode,getLaserEyesConfigForMode} from '../src/skills/handlers/SuperheroFlowSkills.js';
import {getSkillDetailData} from '../src/ui/skillDetailContent.js';
import {formatSkillSelectionOption} from '../src/ui/selectionFormatters.js';

// Rendering stubs only: targeting, skill casts, laser ticks, generic damage,
// cast modifiers and mode resolution all run their production implementations.
global.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
global.document={documentElement:{style:{}},createElement(){return {getContext(){return new Proxy({},{get(_,k){return k==='getImageData'?()=>({data:[0,0,0,0]}):()=>{};}});},style:{}};}};
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
global.Image=class {set src(v){setTimeout(()=>this.onload?.(),0);}};
global.HTMLCanvasElement=class {};
const {default:UpgradePanel}=await import('../src/ui/UpgradePanel.js');
const {default:ShopPanel}=await import('../src/ui/ShopPanel.js');

class Bus{
  constructor(){this.handlers=new Map();}
  on(type,fn){const list=this.handlers.get(type)||[];list.push(fn);this.handlers.set(type,list);return ()=>this.handlers.set(type,(this.handlers.get(type)||[]).filter(x=>x!==fn));}
  emit(type,payload){for(const fn of [...(this.handlers.get(type)||[])])fn(payload);}
}
function node(x=0,y=0,text=''){
  const n={x,y,text,width:100,height:30,active:true,list:[],setText(v){this.text=v;return this;},destroy(){this.active=false;},
    setPosition(x,y){this.x=x;this.y=y;return this;},on(){return this;},getBounds(){return {x:this.x,y:this.y,width:this.width,height:this.height};}};
  const proxy=new Proxy(n,{get(target,key){if(key in target)return target[key];return (..._args)=>proxy;}});
  return proxy;
}
function enemy(kind='normal',x=420,y=500,hp=100000){
  return {x,y,width:80,height:90,hp,maxHp:hp,active:true,isDefeated:false,isBoss:kind==='boss',isElite:kind==='elite',
    enemyId:kind==='boss'?'boss':kind==='elite'?'elite':'grunt',defense:0,damageReduction:0,body:{setVelocityX(){}},destroy(){this.active=false;}};
}
function fixture(mode='normal',level=1,kind='normal'){
  const texts=[],events=[],hits=[];
  const s={runMode:mode,now:0,paused:false,balance:BALANCE,player:{x:0,y:500,body:{setVelocityX(){}}},
    playerData:createPlayerRuntime(),enemies:[],killCount:0,
    cameras:{main:{worldView:{x:0,width:720},width:720,scrollX:0}},getGameplayTime(){return this.now;},isGameplayPaused(){return this.paused;},
    eventBus:new Bus(),events:{on(){},once(){},off(){}},hud:{update(){}},skillBar:{update(){}},
    artifactSystem:{highHpDamageMultiplier:()=>1},professionSystem:{getDamageMultiplier:()=>1,onActiveSkillCast(){},onDirectHit(){}},
    statusEffects:{has:()=>false,getEffects:()=>[],clearTarget(){}},floatText(){},awardGold(){},
    add:{graphics:()=>node(),circle:()=>node(),rectangle:()=>node(),text:(x,y,t)=>{const n=node(x,y,t);texts.push(n);return n;}},
    tweens:{add:()=>node(),killTweensOf(){}},time:{},
    shopSystem:{syncSkillOffer(){},purchased:new Set(),canBuy:()=>true},
    finishRun(){this.paused=true;this.combatSystem.reset();this.skillSystem.reset();}};
  s.playerData.skills=[{id:'laser_eyes',level}];s.playerData.mana=s.playerData.maxMana=1000;s.playerData.critChance=0;
  s.targeting=new TargetingSystem(s);s.combatSystem=new CombatSystem(s);s.skillSystem=new SkillSystem(s);
  const e=enemy(kind);s.enemies=[e];
  s.eventBus.on(CombatEvents.ENEMY_HIT,payload=>{hits.push({enemy:payload.enemy,damage:payload.damage,time:s.now,meta:payload});});
  s.eventBus.on(CombatEvents.SKILL_CAST_COMPLETED,payload=>events.push(payload));
  const f={s,e,texts,events,hits,at(t){s.now=t;s.skillSystem.syncAttachedVisuals();s.skillSystem.updateActive(t);},
    cast(data=SKILLS.laser_eyes.levels[level-1],meta={manaCost:0}){return s.skillSystem.cast(SKILLS.laser_eyes,data,level,meta);},
    destroy(){s.skillSystem.reset();s.combatSystem.reset();}};
  return f;
}
const cfg=SKILLS.laser_eyes,original=JSON.stringify(cfg),oldDamage=[18,20,22,24,26,22,24,26,28];
const newDamage=[9,10,11,12,13,11,12,13,14],totals={};
assert.deepEqual(cfg.levels.map(x=>x.damage),oldDamage,'shared legacy config stays untouched');

for(const mode of ['normal','test',null])for(let level=1;level<=9;level++)for(const kind of ['normal','elite','boss']){
  const f=fixture(mode,level,kind),data=cfg.levels[level-1],base=mode==='normal'?newDamage[level-1]:oldDamage[level-1];
  assert(f.cast().ok);const active=f.s.skillSystem.active[0];
  assert.equal(active.data.damage,base);assert.equal(f.s.playerData.mana,1000);
  assert.equal(active.data.durationMs,data.durationMs);assert.equal(active.data.range,760);
  assert.equal(active.data.beamCount,data.beamCount);assert.equal(active.data.beamDamageScale,data.beamDamageScale);
  assert.equal(active.data.focusPerTick,data.focusPerTick);assert.equal(active.data.overloadIntervalMs,data.overloadIntervalMs);
  for(let t=0;t<=2000;t+=20)f.at(t);
  const ticks=[...new Set(f.hits.map(h=>h.time))];
  assert.equal(f.hits.length,ticks.length*data.beamCount,'each beam hits the target once per scheduled tick');
  for(let i=0;i<ticks.length;i++){
    const focus=Math.min(i,data.maxFocus),amount=Math.round(base*data.beamDamageScale*(1+focus*data.focusPerTick));
    assert(f.hits.filter(h=>h.time===ticks[i]).every(h=>h.damage===amount),`${mode}/Lv${level}/${kind}: focus and integer rounding`);
  }
  assert.equal(f.s.skillSystem.active.length,0);assert.equal(active.visuals.length,0);
  if(kind==='normal'&&mode!==null)totals[mode+'_'+level]=f.hits.reduce((n,h)=>n+h.damage,0);
  assert.equal(JSON.stringify(cfg),original,'casts never change another mode\'s config');f.destroy();
}
assert.deepEqual([totals.normal_1,totals.normal_6,totals.normal_9],[63,140,300]);
assert.deepEqual([totals.test_1,totals.test_6,totals.test_9],[126,276,584]);

// Existing global/active/profession damage multipliers scale the halved base, once.
for(const multiplier of [1.5,2.4]){
  const f=fixture('normal',6);f.cast(undefined,{manaCost:0,damageMultiplier:multiplier,baseDamageMultiplierWithoutProfession:multiplier});
  f.at(0);assert.deepEqual(f.hits.map(h=>h.damage),[Math.round(11*.7*multiplier),Math.round(11*.7*multiplier)]);f.destroy();
}
{
  const f=fixture();f.cast(undefined,{manaCost:0,damageMultiplier:3,baseDamageMultiplierWithoutProfession:2,professionMultiplier:1.5});
  f.at(0);assert.equal(f.hits[0].damage,27);assert.equal(f.hits[0].meta.baseAmountBeforeProfession,18);
  assert.equal(f.hits[0].meta.professionMultiplier,1.5,'profession attribution uses the same halved base');f.destroy();
}
{
  const f=fixture('normal',1);f.s.skillSystem.update(0);
  assert.equal(f.s.skillSystem.active[0].data.damage,9);assert.equal(f.s.playerData.mana,995);
  assert.equal(f.s.skillSystem.cooldowns.get('laser_eyes'),5000);f.at(0);assert.equal(f.hits[0].damage,9);
  f.s.skillSystem.removeSkillRuntime('laser_eyes');assert.equal(f.s.skillSystem.active.length,0);
  f.s.skillSystem.forceCast('laser_eyes',{isFreeCast:true});assert.equal(f.s.skillSystem.active[0].data.damage,9);f.destroy();
}
{
  const f=fixture();const data=getLaserEyesDataForMode(cfg.levels[0],'normal');
  assert.equal(getLaserEyesDataForMode(data,'normal'),data,'mode resolution is idempotent');
  f.cast(data,{manaCost:0,isCopiedCast:true});f.at(0);assert.equal(f.hits[0].damage,9,'copied/normalized data is not halved twice');f.destroy();
}

// Kinetic enhancement still changes duration/width only, not the half-damage rule.
{
  const f=fixture('normal',6);f.s.playerData.skills.push({id:'super_speed',level:6});
  f.s.skillSystem.ensurePassiveBound('super_speed');
  f.s.enemies=[];f.s.skillSystem.update(0);f.s.player.x+=120;f.s.now=1000;f.s.skillSystem.update(1000);
  const state=f.s.skillSystem.passiveState.superSpeed;assert(state.highSpeed&&state.kineticReady);f.s.enemies=[f.e];
  assert(f.cast().ok);const a=f.s.skillSystem.active[0];
  assert.equal(a.data.damage,11);assert.equal(a.data.durationMs,1500);assert.equal(a.data.width,cfg.levels[5].width*1.2);
  assert.equal(state.kineticReady,false);f.at(1000);assert.deepEqual(f.hits.map(h=>h.damage),[8,8]);f.destroy();
}
// Invalid targets spend no mana/cooldown; piercing and kill retarget/extension survive.
{
  const f=fixture();f.s.enemies=[];f.s.skillSystem.update(0);assert.equal(f.s.playerData.mana,1000);
  assert.equal(f.s.skillSystem.cooldowns.size,0);assert(f.cast().failed);assert.equal(f.s.skillSystem.active.length,0);f.destroy();
}
{
  const f=fixture('normal',9),next=enemy('normal',600,514);f.s.enemies.push(next);f.e.hp=1;
  f.cast();const a=f.s.skillSystem.active[0];f.at(0);
  assert(f.e.isDefeated);assert(f.hits.some(h=>h.enemy===next),'beam still pierces behind the first enemy');
  assert.equal(f.hits.filter(h=>h.enemy===f.e).length,1,'dead target cannot be hit by the second beam');
  assert.equal(a.endAt,2100);f.at(16);assert.equal(a.target,next,'Lv9 retarget still works on the next visual frame');
  f.s.eventBus.emit(CombatEvents.ENEMY_KILLED,{skillId:'other'});assert.equal(a.endAt,2100);
  for(let i=0;i<5;i++)f.s.eventBus.emit(CombatEvents.ENEMY_KILLED,{skillId:'laser_eyes'});
  assert.equal(a.endAt,3000,'kill extension remains capped at 1.2 seconds');f.destroy();
}
for(const speed of [1,1.5,2]){
  const f=fixture('normal',1),clock=new GameSpeedSystem(f.s);clock.setSpeed(speed);f.cast();f.at(0);
  f.at(clock.advance(200/speed));assert.equal(f.hits.length,2);assert(f.hits.every(h=>h.damage===9));
  f.s.paused=true;f.s.now=clock.advance(10000,true);f.s.skillSystem.update(f.s.now);assert.equal(f.hits.length,2);
  f.s.paused=false;f.at(clock.advance(200/speed));assert.equal(f.hits.length,3);clock.destroy();f.destroy();
}
{
  const f=fixture();f.cast();const a=f.s.skillSystem.active[0];f.s.skillSystem.reset();
  assert.equal(a.visuals.length,0);assert.equal(f.s.skillSystem.active.length,0);
  f.at(1000);assert.equal(f.hits.length,0,'reset never leaves a delayed laser tick');f.destroy();
}

// Details, next-level preview, reward UI and shop UI use the same mode data.
for(const mode of ['normal','test'])for(let level=1;level<=9;level++){
  const f=fixture(mode,level),expected=mode==='normal'?newDamage[level-1]:oldDamage[level-1];
  const detail=getSkillDetailData('laser_eyes',{scene:f.s});
  assert(detail.currentEffects.some(line=>line===`伤害：${expected}`));
  assert(detail.mechanics.join(' ').includes(`造成${expected}点技能伤害`));
  if(level<9)assert(detail.nextLevelPreview.some(line=>line.startsWith('伤害：')&&line.includes(`${expected} → ${mode==='normal'?newDamage[level]:oldDamage[level]}`)));
  const selection=formatSkillSelectionOption({type:'myriadCopySkill',skillId:'laser_eyes'},f.s.playerData,mode);
  assert(selection.effectLines.join(' ').includes(`造成${expected}点技能伤害`));
  const balanced=getLaserEyesConfigForMode(cfg,mode);assert.equal(balanced.levels[level-1].damage,expected);
  assert.equal(JSON.stringify(cfg),original);f.destroy();
}
for(const mode of ['normal','test']){
  const f=fixture(mode);f.s.playerData.skills=[];const expected=mode==='normal'?9:18;
  const panel=new UpgradePanel(f.s);panel.show({options:[{type:'newSkill',skillId:'laser_eyes'}],onConfirm(){}});
  assert(panel.formatted[0].effectLines.join(' ').includes(`造成${expected}点技能伤害`),'real reward entry passes mode');
  panel.hide();
  const shop=new ShopPanel(f.s);shop.expanded=true;
  for(let page=0;page<4;page++){shop.detailPage=page;shop.details({id:'qa_laser',name:'镭射眼',type:'newSkill',skillId:'laser_eyes',kind:'skill',price:20},false);}
  assert(f.texts.map(n=>n.text).join('').replace(/\n/g,'').includes(`造成${expected}点技能伤害`),'real shop entry passes mode');
  shop.hide();f.destroy();
}
for(const id of ['super_speed','freezing_breath','fireball'])assert.equal(getLaserEyesConfigForMode(SKILLS[id],'normal'),SKILLS[id]);
assert.equal(JSON.stringify(cfg),original);
console.log('PASS 01161: all 9 levels × normal/test/unspecified modes × ordinary/elite/boss actual laser damage; focus/dual rounding, modifiers, copied/force/auto casts, kinetic, pierce/retarget/death/extension, pause/speed/reset, mode-correct details/reward/shop UI and immutable legacy configuration.');
