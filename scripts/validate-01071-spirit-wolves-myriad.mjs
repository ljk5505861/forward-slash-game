import assert from 'node:assert/strict';
globalThis.window={};globalThis.document={documentElement:{},createElement:()=>({getContext:()=>({})})};Object.defineProperty(globalThis,'navigator',{value:{userAgent:'node'},configurable:true});
const { GAME_VERSION } = await import('../src/config/version.js');
const { createPlayerRuntime } = await import('../src/config/balance.js');
const { SKILLS } = await import('../src/config/skills.js');
const { CombatEvents } = await import('../src/core/CombatEvents.js');
await import('../src/skills/handlers/index.js');
const SkillSystem=(await import('../src/systems/SkillSystem.js')).default;
const { MyriadAfterimageSkill, selectionOptions, isEligibleMyriadCopySkill } = await import('../src/skills/handlers/AfterimageUltimateSkills.js');
const { SPIRIT_WOLVES_ID, inheritRatioForLevel } = await import('../src/skills/handlers/SpiritWolvesSkill.js');
function node(x=0,y=0,r=0){ return {x,y,radius:r,active:true,alpha:1,setStrokeStyle(){return this},setDepth(){return this},setOrigin(){return this},setScale(){return this},setPosition(x,y){this.x=x;this.y=y;return this},destroy(){this.active=false}}; }
function bus(){ return {h:{},emit(n,p){(this.h[n]||[]).slice().forEach(f=>f(p));},on(n,f){(this.h[n]??=[]).push(f);return()=>this.h[n]=this.h[n].filter(x=>x!==f)}}; }
function events(){ return {on(){},off(){},once(){}}; }
function enemy(x=260,y=100,hp=1000){return {x,y,hp,maxHp:hp,active:true,isDefeated:false,defense:0,damageReduction:0,width:60,height:80};}
function scene(){ let now=0,id=1; const timers=[],tweens=[],damage=[],enemies=[]; const afters=[]; const s={timers,tweens,damage,enemies,eventBus:bus(),events:events(),player:{x:100,y:100},playerData:createPlayerRuntime(),getGameplayTime:()=>now,setTime:t=>now=t,isGameplayPaused:()=>false,add:{circle:(x,y,r)=>node(x,y,r),rectangle:(x,y,w,h)=>node(x,y,0)},tweens:{add(c){tweens.push(c);return{remove(){},complete(){c.onComplete?.();}}}},time:{delayedCall(ms,fn){const t={ms,fn,remove(){this.removed=true}};timers.push(t);return t;}},runTimers(){timers.splice(0).filter(t=>!t.removed).forEach(t=>t.fn());},runTweens(){tweens.splice(0).forEach(t=>t.onComplete?.());},floatText(){},hud:{update(){}},skillBar:{update(){}},targeting:{valid:e=>e&&e.hp>0&&!e.isDefeated,all:()=>enemies,isEnemyFullyInsideViewport:()=>true,nearestAhead:()=>enemies[0]||null,random:()=>enemies[0]||null,aroundPlayer:()=>enemies},combatSystem:{damageEnemy(e,amount,meta){damage.push({e,amount,meta}); e.hp=Math.max(0,e.hp-amount); return true;}},professionSystem:{getDamageMultiplier(){return 99},onActiveSkillCast(){}},artifactSystem:{highHpDamageMultiplier(){return 99}},statusEffects:{addPermanentShield(){}},afterimages:{getAll:()=>afters,getById:i=>afters.find(a=>a.id===i),createAfterimage(o){const a={id:id++,ownerSkillId:o.ownerSkillId,createdAt:now,expiresAt:o.durationMs?now+o.durationMs:0,view:node(100+id*20,100,12)}; afters.push(a); return a;},removeAfterimage(i){const n=afters.findIndex(a=>a.id===i); if(n>=0) afters.splice(n,1);}}}; s.playerData.hp=s.playerData.maxHp; return s; }
function make(level=1,myriadLevel=1){const s=scene(),sys=new SkillSystem(s); s.skillSystem=sys; sys.addOrLevel(SPIRIT_WOLVES_ID); while(sys.getLevel(SPIRIT_WOLVES_ID)<level) sys.addOrLevel(SPIRIT_WOLVES_ID); sys.addOrLevel('myriad_afterimage'); while(sys.getLevel('myriad_afterimage')<myriadLevel) sys.addOrLevel('myriad_afterimage'); s.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:1}); return {s,sys,state:()=>sys.passiveState};}
assert.equal(GAME_VERSION,'0.10.71');
assert.equal(MyriadAfterimageSkill.copyAdapters[SPIRIT_WOLVES_ID],'active');
assert.equal(isEligibleMyriadCopySkill(SKILLS.spirit_wolves),true);
{
 const {s,sys}=make(); assert.equal(s.playerData.myriadAfterimageChangeCount,1); const opts=selectionOptions(sys).map(o=>o.skillId); assert.deepEqual(opts,['normal_attack',SPIRIT_WOLVES_ID]);
}
{
 const {s,sys}=make(1,1); s.playerData.myriadAfterimageSkillId=SPIRIT_WOLVES_ID; s.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:6000}); s.enemies.push(enemy(280,100)); sys.update(0); assert.equal(sys.passiveState.spiritWolves.wolves.length,2,'normal cast still creates exactly two persistent wolves'); s.runTimers(); s.runTweens(); assert.equal(sys.passiveState.spiritWolves.wolves.length,2); assert.equal(sys.passiveState.spiritWolves.wolves.filter(w=>w.type==='spiritWolf').length,2); const bite=s.damage.find(d=>d.meta.damageKind==='myriadSpiritWolfBite'); assert.ok(bite,'spirit wolf cast creates temporary wolf-shadow copy'); assert.equal(bite.amount,Math.max(1,Math.round(Math.round(s.playerData.baseAttack*inheritRatioForLevel(1))*0.15))); assert.equal(bite.meta.fromMyriadAfterimage,true); assert.equal(bite.meta.canTriggerArtifacts,false); assert.equal(bite.meta.allowLifeSteal,false); assert.equal(bite.meta.crit,false); assert.equal(bite.meta.professionMultiplier,1); assert.equal(bite.meta.tags.includes('physical'),false); assert.equal(sys.passiveState.myriadAfterimage,undefined);
}
{
 const {s,sys}=make(6,3); s.playerData.myriadAfterimageSkillId=SPIRIT_WOLVES_ID; s.enemies.push(enemy(260,100),enemy(270,100),enemy(350,100)); sys.update(0); s.runTimers(); s.runTweens(); assert.ok(s.damage.some(d=>d.meta.damageKind==='myriadSpiritWolfSplash'),'level 3 full-shape keeps splash'); assert.ok(s.damage.some(d=>d.meta.damageKind==='myriadSpiritWolfBurst'),'level 6 wolf shadow creates temporary burst'); const cd=sys.cooldowns.get(SPIRIT_WOLVES_ID)||0; assert.equal(cd,0,'temporary burst does not start persistent wolf cooldown');
}
{
 const {s,sys}=make(); s.playerData.myriadAfterimageSkillId=SPIRIT_WOLVES_ID; sys.update(0); const off=sys.boundPassives.get('myriad_afterimage'); off(); assert.equal(s.timers.filter(t=>!t.removed).length,0,'unbind removes timers'); s.events.emit?.('shutdown');
}
console.log('v0.10.71 spirit wolves myriad validation passed.');
