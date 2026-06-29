import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
globalThis.window={};globalThis.document={documentElement:{},createElement:()=>({getContext:()=>({})})};Object.defineProperty(globalThis,'navigator',{value:{userAgent:'node'},configurable:true});
const { GAME_VERSION } = await import('../src/config/version.js');
const { createPlayerRuntime } = await import('../src/config/balance.js');
const { SKILLS } = await import('../src/config/skills.js');
await import('../src/skills/handlers/index.js');
const SkillSystem = (await import('../src/systems/SkillSystem.js')).default;
const { SPIRIT_WOLVES_ID, inheritRatioForLevel, basePlayerStats } = await import('../src/skills/handlers/SpiritWolvesSkill.js');
const PLAYER_IMAGE_SHA='64ff69eeac2842999789317e5d1ce0687016943dfaa211c4f24308d294c17135';
const CREATE_PLAYER_SHA='70cdcbe0ede9a8a1eb366820d904977aff61f90d46a71b40b2436cda58c8a103';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function node(x=0,y=0,r=0){ return {x,y,radius:r,active:true,scale:1,alpha:1,setStrokeStyle(){return this},setDepth(){return this},setOrigin(){return this},setScale(v){this.scale=v;return this},setPosition(x,y){this.x=x;this.y=y;return this},destroy(){this.active=false}}; }
function makeBus(){ return {handlers:{},emit(n,p){ (this.handlers[n]||[]).forEach(fn=>fn(p)); },on(n,fn){(this.handlers[n]??=[]).push(fn); return()=>this.handlers[n]=this.handlers[n].filter(x=>x!==fn);}}; }
function makeEvents(){ return {handlers:{},on(n,fn){(this.handlers[n]??=[]).push(fn);},off(n,fn){this.handlers[n]=(this.handlers[n]||[]).filter(x=>x!==fn);},once(n,fn){this.on(n,fn);},emit(n,p){(this.handlers[n]||[]).slice().forEach(fn=>fn(p));}}; }
function enemy(x=220,y=100,hp=500){ return {x,y,hp,maxHp:hp,active:true,isDefeated:false,defense:0,damageReduction:0,width:60,height:80}; }
function makeScene(){ let now=0; const calls={damage:[]}; const enemies=[]; return {calls,enemies,eventBus:makeBus(),events:makeEvents(),player:{x:100,y:100},playerData:createPlayerRuntime(),cameras:{main:{worldView:{left:0,right:640,width:640}}},getGameplayTime:()=>now,setTime:t=>now=t,isGameplayPaused:()=>false,add:{circle:(x,y,r)=>node(x,y,r),rectangle:(x,y,w,h)=>node(x,y,0)},tweens:{add(config){ return {remove(){},stop(){},play(){},complete(){config.onComplete?.();}};}},time:{delayedCall(ms,fn){return {remove(){},fn}}},floatText(){},hud:{update(){},setStatus(){}},skillBar:{update(){}},targeting:{valid:e=>e&&e.hp>0&&!e.isDefeated,all:()=>enemies,isEnemyFullyInsideViewport:()=>true,nearestAhead:()=>enemies.find(e=>e.hp>0)||null,random:()=>enemies.find(e=>e.hp>0)||null,aroundPlayer:()=>enemies.filter(e=>e.hp>0)},combatSystem:{damageEnemy(e,amount,meta){ calls.damage.push({e,amount,meta}); e.hp=Math.max(0,e.hp-amount); return amount>0; }},professionSystem:{getDamageMultiplier(){ return 99; },onActiveSkillCast(){}},artifactSystem:{highHpDamageMultiplier(){ return 99; }},statusEffects:{addPermanentShield(){}}}; }
function makeSystem(level=1){ const s=makeScene(); s.playerData.hp=s.playerData.maxHp; const sys=new SkillSystem(s); s.skillSystem=sys; sys.addOrLevel(SPIRIT_WOLVES_ID); while(sys.getLevel(SPIRIT_WOLVES_ID)<level) sys.addOrLevel(SPIRIT_WOLVES_ID); return {s,sys,state:()=>sys.passiveState.spiritWolves}; }
function update(sys,s,time){ s.setTime(time); sys.update(time); }
assert.equal(GAME_VERSION,'0.10.71');
assert.equal(SKILLS.spirit_wolves.rarity,'COMMON');
assert.equal(sha('src/player_idle.png'),PLAYER_IMAGE_SHA); assert.equal(sha('src/entities/createPlayer.js'),CREATE_PLAYER_SHA);
const realPlayer=createPlayerRuntime(); assert.deepEqual(basePlayerStats(realPlayer),{attack:realPlayer.baseAttack,maxHp:realPlayer.baseMaxHp,defense:realPlayer.baseDefense});
{
 const {s,sys,state}=makeSystem(1); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false,'no artificial first cooldown on obtain'); update(sys,s,0); assert.equal(state().wolves.length,2,'first normal update immediately summons two wolves'); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false,'live wolves do not start normal cooldown');
 s.playerData.cooldownReduction=.95; update(sys,s,1000); assert.equal(state().wolves.length,2,'live wolves block duplicate summons'); state().wolves[0].takeDamage(999,{enemy:{x:999},attackType:'melee'}); assert.equal(state().wolves.length,1); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false,'one death does not cooldown'); s.setTime(2000); state().wolves[0].takeDamage(999,{enemy:{x:999},attackType:'melee'}); assert.equal(sys.cooldowns.get(SPIRIT_WOLVES_ID),10000,'wipe cooldown is exact now + 8000 and ignores cooldownReduction'); update(sys,s,9999); assert.equal(state().wolves.length,0,'7999ms cannot resummon'); update(sys,s,10000); assert.equal(state().wolves.length,2,'8000ms allows normal SkillSystem recast');
}
{
 const {s,sys,state}=makeSystem(1); update(sys,s,0); const w=state().wolves[0]; const x0=w.x; update(sys,s,1000); assert.ok(w.x>x0,'no enemies: wolf moves right'); s.player.x=100; s.cameras.main.worldView.right=360; for(let t=1050;t<=3000;t+=50) update(sys,s,t); assert.ok(w.x<=312,'wolf clamps to right camera margin instead of leaving screen');
 const xs=[]; for(let i=0;i<3;i++){ w.takeDamage(1,{enemy:{x:w.x+20},attackType:'melee'}); xs.push(w.x); } assert.ok(xs[0]>xs[1]&&xs[1]>xs[2],'three knockbacks cumulatively reduce x'); w.x=s.player.x+5; w.takeDamage(1,{enemy:{x:w.x+20},attackType:'melee'}); assert.ok(w.x<s.player.x,'wolf can be behind player'); const knocked=w.x; update(sys,s,s.getGameplayTime()+200); assert.equal(w.x,knocked,'no forward compensation during knockback recovery'); update(sys,s,s.getGameplayTime()+400); assert.ok(w.x>knocked,'after recovery wolf resumes moving right');
}
{
 const a=makeSystem(1), b=makeSystem(1); update(a.sys,a.s,0); update(b.sys,b.s,0); const wa=a.state().wolves[0], wb=b.state().wolves[0]; const ax=wa.x,bx=wb.x; for(let t=1000/30;t<=1000;t+=1000/30) update(a.sys,a.s,t); for(let t=1000/120;t<=1000;t+=1000/120) update(b.sys,b.s,t); assert.ok(Math.abs((wa.x-ax)-(wb.x-bx))<20,'30fps and 120fps one-second displacement is close');
}
assert.equal(/SNAP|LEASH|initialized/.test(fs.readFileSync('src/skills/handlers/SpiritWolvesSkill.js','utf8')),false,'obsolete SNAP/LEASH/initialized logic removed');
assert.equal(inheritRatioForLevel(1),.20); assert.equal(inheritRatioForLevel(9),.30);
console.log('v0.10.71 spirit wolves validation passed.');
