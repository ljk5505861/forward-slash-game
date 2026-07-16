import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.window={};globalThis.document={documentElement:{},createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:[0,0,0,255]}),fillRect(){},clearRect(){},putImageData(){},createImageData:()=>({data:[0,0,0,0]})})})};Object.defineProperty(globalThis,'navigator',{value:{userAgent:'node'},configurable:true});globalThis.HTMLCanvasElement=class {};globalThis.Image=class { set src(value){ this._src=value; this.onload?.(); } };
const { createPlayerRuntime } = await import('../src/config/balance.js');
const { SKILLS } = await import('../src/config/skills.js');
const { CombatEvents } = await import('../src/core/CombatEvents.js');
await import('../src/skills/handlers/index.js');
const SkillSystem=(await import('../src/systems/SkillSystem.js')).default;
const { StatusEffects } = await import('../src/systems/StatusEffectSystem.js');
const { MYRIAD_AFTERIMAGE_SKILL_ID } = await import('../src/skills/handlers/AfterimageUltimateSkills.js');
const { SPIRIT_WOLVES_ID, inheritRatioForLevel } = await import('../src/skills/handlers/SpiritWolvesSkill.js');

function node(x=0,y=0,r=0){ return {x,y,radius:r,active:true,alpha:1,setStrokeStyle(){return this},setDepth(){return this},setOrigin(){return this},setScale(){return this},setPosition(x,y){this.x=x;this.y=y;return this},destroy(){this.active=false},lineStyle(){return this},lineBetween(){return this}}; }
function bus(){ return {h:{},emit(n,p){(this.h[n]||[]).slice().forEach(f=>f(p));},on(n,f){(this.h[n]??=[]).push(f);return()=>this.h[n]=this.h[n].filter(x=>x!==f)}}; }
function events(){ return {h:{},on(n,f){(this.h[n]??=[]).push(f);},once(n,f){const wrap=p=>{this.off(n,wrap);f(p);};this.on(n,wrap);},off(n,f){this.h[n]=(this.h[n]||[]).filter(x=>x!==f);},emit(n,p){(this.h[n]||[]).slice().forEach(f=>f(p));}}; }
function advanceSceneTo(scene,targetTime){
  scene.now=targetTime;
  let progressed=true;
  while(progressed){
    progressed=false;
    const ready=scene.scheduledTimers.filter(timer=>!timer.removed&&timer.at<=targetTime).sort((a,b)=>a.at-b.at||a.order-b.order);
    for(const timer of ready){
      if(timer.removed) continue;
      timer.removed=true;
      timer.callback?.();
      progressed=true;
    }
  }
}
function scene(){
  let timerOrder=0,id=1;
  const s={now:0,scheduledTimers:[],tweenList:[],damage:[],enemies:[],eventBus:bus(),events:events(),player:{x:100,y:100},playerData:createPlayerRuntime(),isGameplayPaused:()=>false,getGameplayTime(){return this.now;},add:{circle:(x,y,r)=>node(x,y,r),rectangle:(x,y,w,h)=>node(x,y,0),ellipse:(x,y,w,h)=>node(x,y,0),graphics:()=>node()},tweens:{add(c){const tw={...c,removed:false,remove(){this.removed=true;},complete(){if(!this.removed){this.removed=true;this.onComplete?.();}}};s.tweenList.push(tw);return tw;}},time:{delayedCall(delay,callback){const timer={at:s.now+Math.max(0,delay),order:timerOrder++,callback,removed:false,remove(){this.removed=true;},destroy(){this.removed=true;}};s.scheduledTimers.push(timer);return timer;}},targeting:{valid:e=>!!e&&e.active!==false&&!e.isDefeated&&(e.hp??0)>0,all(){return s.enemies.filter(this.valid)},nearestAhead(){return this.all()[0]||null},random(){return this.all()[0]||null},aroundPlayer(){return this.all()},isEnemyFullyInsideViewport(){return true}},combatSystem:{damageEnemy(e,amount,meta){if(!s.targeting.valid(e))return false;const value=Math.max(1,Math.round(amount));s.damage.push({e,amount:value,meta});e.hp=Math.max(0,e.hp-value);if(e.hp<=0)e.isDefeated=true;return true;}},professionSystem:{getDamageMultiplier(){return 1},onActiveSkillCast(){}},artifactSystem:{highHpDamageMultiplier(){return 1},level(){return 0}},statusEffects:{effects:[],add(type,target,opt={}){const old=this.effects.find(e=>e.type===type&&e.target===target&&e.sourceId===opt.sourceId);if(old){Object.assign(old,opt);old.stacks=(old.stacks||1)+(opt.stacks||1);return old;}const effect={id:id++,type,target,stacks:opt.stacks||1,nextTickAt:s.now+(opt.intervalMs||0),...opt};this.effects.push(effect);return effect;},getStackCount(target,type){return this.effects.filter(e=>e.target===target&&e.type===type).reduce((n,e)=>n+(e.stacks||1),0)},getEffects(target,type){return this.effects.filter(e=>e.target===target&&e.type===type)},has(target,type){return this.getStackCount(target,type)>0},absorbShield(damage){return{absorbed:0,remainingDamage:damage}},clearTarget(){}},floatText(){},hud:{update(){},setStatus(){}},skillBar:{update(){}},afterimages:{list:[],getAll(){return this.list},getById(i){return this.list.find(a=>a.id===i)},createAfterimage(o){const a={id:id++,ownerSkillId:o.ownerSkillId,view:node(120,100,12)};this.list.push(a);return a;},removeAfterimage(i){this.list=this.list.filter(a=>a.id!==i)}}};
  s.healPlayer=function(amount){const value=Math.max(0,Math.round(Number(amount)||0));const before=this.playerData.hp;this.playerData.hp=Math.min(this.playerData.maxHp,before+value);return this.playerData.hp-before;};
  return s;
}
const enemy=(x=280,hp=1000)=>({x,y:100,hp,maxHp:hp,active:true,isDefeated:false,body:{setVelocityX(){}}});

{
  const s=scene(), sys=new SkillSystem(s); s.skillSystem=sys;
  sys.addOrLevel(SPIRIT_WOLVES_ID); sys.addOrLevel(MYRIAD_AFTERIMAGE_SKILL_ID);
  s.playerData.myriadAfterimageSkillId=SPIRIT_WOLVES_ID;
  s.afterimages.createAfterimage({ownerSkillId:'phantom_step'});
  s.enemies.push(enemy(),enemy(300),enemy(320));
  s.eventBus.emit(CombatEvents.SKILL_CAST_COMPLETED,{skillId:SPIRIT_WOLVES_ID,skill:SKILLS[SPIRIT_WOLVES_ID],level:1,data:sys.getData(SPIRIT_WOLVES_ID),ctx:{castId:'snapshot',castModifierSnapshot:{appliedDamageMultiplier:2.04}},targets:[]});
  assert.equal(s.damage.length,0,'myriad wolf copy is scheduled and not immediate');
  advanceSceneTo(s,240);
  s.tweenList.forEach(t=>t.complete?.());
  advanceSceneTo(s,500);
  const bite=s.damage.find(d=>d.meta.damageKind==='myriadSpiritWolfBite');
  const expected=Math.max(1,Math.round(Math.max(1,Math.round(s.playerData.baseAttack*inheritRatioForLevel(1)*2.04))*0.15));
  assert.equal(bite.amount,expected,'myriad wolf bite uses original active modifier snapshot');
  assert.equal(bite.meta.fromMyriadAfterimage,true);
  assert.equal(bite.meta.originalSkillId,SPIRIT_WOLVES_ID);
  assert.equal(bite.meta.professionMultiplier,1);
  const removed=s.time.delayedCall(10,()=>{ throw new Error('removed timer fired'); });
  removed.remove();
  advanceSceneTo(s,300);
}
{
  const s=scene(), sys=new SkillSystem(s); s.skillSystem=sys;
  const target=enemy();
  s.enemies.push(target);
  sys.addOrLevel('poison_cloud'); sys.addOrLevel('poison_chain');
  const cfg=SKILLS.poison_chain, data=sys.getData('poison_chain');
  sys.cast(cfg,data,1,{castId:'first'});
  const first=s.statusEffects.getEffects(target,StatusEffects.POISON).find(e=>e.poisonMeta?.poisonChainApplied);
  assert.equal(first.sourceId,'poison_chain_hit_first');
  const firstSnapshot={...first};
  sys.cast(cfg,data,1,{castId:'second'});
  const direct=s.statusEffects.getEffects(target,StatusEffects.POISON).filter(e=>e.poisonMeta?.poisonChainApplied);
  assert.equal(direct.length,2,'overlapping poison-chain direct poisons remain independent');
  assert.notEqual(direct[0].id,direct[1].id);
  assert.notEqual(direct[0].sourceId,direct[1].sourceId);
  assert.equal(first.damageMultiplier,firstSnapshot.damageMultiplier);
  assert.equal(first.nextTickAt,firstSnapshot.nextTickAt);
  assert.equal(s.statusEffects.getStackCount(target,StatusEffects.POISON)<=15,true);
}
{
  let s=scene(); s.playerData.hp=50; s.playerData.maxHp=100; assert.equal(s.healPlayer(2),2); assert.equal(s.playerData.hp,52);
  s=scene(); s.playerData.hp=50; s.playerData.maxHp=100; assert.equal(s.healPlayer(2),2); assert.equal(s.playerData.hp,52);
}
assert.equal(Object.keys(SKILLS).length,40);
assert.equal(new Set(Object.keys(SKILLS)).size,40);
assert.equal(Object.keys(SKILLS).includes('__test_failed_active'),false);
assert.match(readFileSync('src/skills/handlers/AfterimageUltimateSkills.js','utf8'),/castModifierSnapshot\?\.appliedDamageMultiplier/);
assert.match(readFileSync('src/skills/handlers/PoisonSummonInteractionFixes.js','utf8'),/poison_chain_hit_\$\{ctx\.castId\}/);
console.log('v0.11.3 active skill modifier follow-up validation passed.');
