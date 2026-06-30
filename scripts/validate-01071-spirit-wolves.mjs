import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
globalThis.window={};globalThis.document={documentElement:{},createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:[0,0,0,255]}),fillRect(){},clearRect(){},putImageData(){},createImageData:()=>({data:[0,0,0,0]})})})};Object.defineProperty(globalThis,'navigator',{value:{userAgent:'node'},configurable:true});globalThis.HTMLCanvasElement=class {};globalThis.Image=class { set src(value){ this._src=value; this.onload?.(); } };
const { GAME_VERSION } = await import('../src/config/version.js');
const { createPlayerRuntime } = await import('../src/config/balance.js');
const SkillSystem = (await import('../src/systems/SkillSystem.js')).default;
const CombatSystem = (await import('../src/systems/CombatSystem.js')).default;
const ArtifactSystem = (await import('../src/systems/ArtifactSystem.js')).default;
const EnemyBehaviorManager = (await import('../src/enemies/behaviors/EnemyBehaviorManager.js')).default;
const { CombatEvents } = await import('../src/core/CombatEvents.js');
await import('../src/skills/handlers/index.js');
const { SKILLS } = await import('../src/config/skills.js');
const { SPIRIT_WOLVES_ID, inheritRatioForLevel, basePlayerStats } = await import('../src/skills/handlers/SpiritWolvesSkill.js');

const PLAYER_IMAGE_SHA='64ff69eeac2842999789317e5d1ce0687016943dfaa211c4f24308d294c17135';
const CREATE_PLAYER_SHA='70cdcbe0ede9a8a1eb366820d904977aff61f90d46a71b40b2436cda58c8a103';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function node(x=0,y=0,r=0){ return {x,y,radius:r,active:true,scale:1,alpha:1,setStrokeStyle(){return this},setDepth(){return this},setOrigin(){return this},setScale(v){this.scale=v;return this},setPosition(x,y){this.x=x;this.y=y;return this},destroy(){this.active=false}}; }
function makeBus(){ return {handlers:{},emit(n,p){ (this.handlers[n]||[]).forEach(fn=>fn(p)); },on(n,fn){(this.handlers[n]??=[]).push(fn); return()=>this.handlers[n]=this.handlers[n].filter(x=>x!==fn);}}; }
function makeEvents(){ return {handlers:{},on(n,fn){(this.handlers[n]??=[]).push(fn);},off(n,fn){this.handlers[n]=(this.handlers[n]||[]).filter(x=>x!==fn);},once(n,fn){const wrap=p=>{this.off(n,wrap); fn(p);}; this.on(n,wrap);},emit(n,p){(this.handlers[n]||[]).slice().forEach(fn=>fn(p));}}; }
function enemy(x=220,y=100,hp=500){ return {x,y,hp,maxHp:hp,active:true,isDefeated:false,defense:0,damageReduction:0,width:60,height:80}; }
function makeScene(){ let now=0; const calls={damage:[],crits:0,attacks:0,artifacts:0,healed:0,directHits:0}; const enemies=[]; const tweens=[]; const eventBus=makeBus(); const scene={ calls,enemies,eventBus,events:makeEvents(),player:{x:100,y:100},playerData:createPlayerRuntime(),cameras:{main:{worldView:{left:0,right:640,width:640}}},getGameplayTime:()=>now,setTime:t=>now=t,isGameplayPaused:()=>false,add:{circle:(x,y,r)=>node(x,y,r),rectangle:(x,y,w,h)=>node(x,y,0)},tweens:{add(config){ tweens.push(config); return {remove(){},stop(){},play(){},complete(){config.onComplete?.();}};}},completeTweens(){ while(tweens.length) tweens.shift().onComplete?.(); },floatText(){},hud:{update(){},setStatus(){}},skillBar:{update(){}},targeting:{valid:e=>e&&e.hp>0&&!e.isDefeated,all:()=>enemies,isEnemyFullyInsideViewport:()=>true,nearestAhead:()=>enemies.find(e=>e.hp>0)||null,random:()=>enemies.find(e=>e.hp>0)||null,aroundPlayer:()=>enemies.filter(e=>e.hp>0),shouldRecycleEnemyLeft:()=>false,getEnemyRightRespawnX:()=>1000},combatSystem:{damageEnemy(e,amount,meta){ calls.damage.push({e,amount,meta}); e.hp=Math.max(0,e.hp-amount); return amount>0; }},professionSystem:{getDamageMultiplier(){ return 99; },onActiveSkillCast(){},onDirectHit(){ calls.directHits+=1; }},artifactSystem:{highHpDamageMultiplier(){ calls.artifacts+=1; return 99; }},statusEffects:{addPermanentShield(){}},healPlayer(amount){ const actual=Math.min(amount,this.playerData.maxHp-this.playerData.hp); this.playerData.hp+=actual; calls.healed+=actual; return actual; }}; scene.playerData.hp=scene.playerData.maxHp; return scene; }
function makeRealScene(){ const s=makeScene(); s.balance={stageWorldWidth:50000,enemyFadeMs:1,enemies:{rangeBuffer:24}}; s.killCount=0; s.awardGold=()=>{}; s.statusEffects={getEffects:()=>[],getStackCount:()=>0,has:()=>false,clearTarget(){},addPermanentShield(){},absorbShield:damage=>({absorbed:0,remainingDamage:damage})}; s.combatSystem=new CombatSystem(s); return s; }
function addSkillToScene(s,level=1){ const sys=new SkillSystem(s); s.skillSystem=sys; sys.addOrLevel(SPIRIT_WOLVES_ID); while(sys.getLevel(SPIRIT_WOLVES_ID)<level) sys.addOrLevel(SPIRIT_WOLVES_ID); return {s,sys,state:()=>sys.passiveState.spiritWolves}; }
function makeSystemWithSkill(level=1){ return addSkillToScene(makeScene(),level); }
function makeRealSystemWithSkill(level=1){ return addSkillToScene(makeRealScene(),level); }
function update(sys,s,time){ s.setTime(time); sys.update(time); }

assert.equal(GAME_VERSION,'0.10.78');
assert.equal(Object.keys(SKILLS).length,25);
assert.ok(SKILLS.spirit_wolves);
assert.equal(SKILLS.spirit_wolves.requiredSkillId,undefined);
assert.equal(SKILLS.spirit_wolves.rarity,'COMMON');
assert.equal(SKILLS.spirit_wolves.levels.length,9);
assert.equal(fs.existsSync('src/player_idle.png'),true);
assert.equal(sha('src/player_idle.png'),PLAYER_IMAGE_SHA,'player image SHA is unchanged');
assert.equal(sha('src/entities/createPlayer.js'),CREATE_PLAYER_SHA,'createPlayer.js hookup SHA is unchanged');
const realPlayer=createPlayerRuntime();
assert.equal(Number.isFinite(realPlayer.baseAttack),true); assert.equal(Number.isFinite(realPlayer.baseMaxHp),true); assert.equal(Number.isFinite(realPlayer.baseDefense),true);
assert.deepEqual(basePlayerStats(realPlayer),{attack:realPlayer.baseAttack,maxHp:realPlayer.baseMaxHp,defense:realPlayer.baseDefense});

{
  const {s,sys,state}=makeSystemWithSkill(1); let casts=0, completed=0; const offCast=s.eventBus.on(CombatEvents.SKILL_CAST,()=>casts+=1); const offDone=s.eventBus.on(CombatEvents.SKILL_CAST_COMPLETED,event=>{ if(event.skillId===SPIRIT_WOLVES_ID&&event.ctx?.castId) completed+=1; });
  assert.equal(state().updater&&sys.passiveUpdaters.includes(state().updater),true,'runtime updater is bound on obtain');
  assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false,'obtain does not create artificial first cooldown');
  update(sys,s,0); assert.equal(state().wolves.length,2,'first normal update immediately summons two wolves'); assert.equal(casts,1); assert.equal(completed,1,'first summon uses normal active cast context/events'); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false,'summon clears normal cooldown while wolves live');
  for(const w of state().wolves){ assert.equal(w.attack,Math.round(realPlayer.baseAttack*.2)); assert.equal(w.maxHp,Math.round(realPlayer.baseMaxHp*.15)); assert.equal(w.defense,Math.round(realPlayer.baseDefense*.2)); }
  s.playerData.attack=999; s.playerData.maxHp=9999; s.playerData.defense=99; s.playerData.defenseBonuses.skill=999; s.playerData.skillDamageMultiplier=99; s.playerData.cooldownReduction=.9;
  update(sys,s,9000); assert.equal(state().wolves.length,2,'live wolves block duplicate summons'); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false);
  state().wolves[0].takeDamage(999,{enemy:{x:999,isElite:false},attackType:'melee'}); assert.equal(state().wolves.length,1); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false,'one wolf death does not start cooldown');
  update(sys,s,9999); assert.equal(state().wolves.length,1); s.setTime(10000);
  state().wolves[0].takeDamage(999,{enemy:{x:999,isElite:false},attackType:'melee'}); assert.equal(state().wolves.length,0); assert.equal(sys.cooldowns.get(SPIRIT_WOLVES_ID),18000); assert.equal(state().cooldownStarts,1);
  update(sys,s,17999); assert.equal(state().wolves.length,0,'7999ms after wipe cannot resummon');
  update(sys,s,18000); assert.equal(state().wolves.length,2,'8000ms after wipe allows normal recast'); assert.equal(state().cooldownStarts,1); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false);
  offCast(); offDone();
}

{
  const {s,sys,state}=makeSystemWithSkill(3); update(sys,s,0); s.enemies.push(enemy(160,82,500),enemy(185,82,500),enemy(160,82,500)); const primary=s.enemies[0]; state().wolves[0].x=120; state().wolves[0].y=82; state().wolves[0].nextAttackAt=0; update(sys,s,900); assert.ok(s.calls.damage.some(d=>d.meta.damageKind==='summonMelee')); assert.ok(s.calls.damage.some(d=>d.meta.damageKind==='summonSplash')); assert.equal(s.calls.damage.filter(d=>d.e===primary).length,1,'primary target is not splashed again');
}
{
  const {s,sys,state}=makeRealSystemWithSkill(1); s.playerData.baseAttack=100; s.playerData.attack=999; s.playerData.physicalDamageBonuses.last_stand=9; update(sys,s,0); s.calls.artifacts=0; const w=state().wolves[0]; const armored=enemy(w.x+40,w.y,500); armored.defense=5; s.enemies.push(armored); let hitEvent=null, attackEvent=0; const off=s.eventBus.on(CombatEvents.ENEMY_HIT,p=>{ if(p.skillId===SPIRIT_WOLVES_ID) hitEvent=p; }); const offAttack=s.eventBus.on(CombatEvents.PLAYER_ATTACK_RESOLVED,()=>attackEvent+=1); update(sys,s,900); off(); offAttack(); assert.equal(armored.hp,485,'real CombatSystem applies enemy defense exactly once'); assert.equal(hitEvent?.damage,15); assert.equal(hitEvent?.tags?.includes('physical'),false,'summon attack bypasses player physical bonus pipeline'); assert.equal(hitEvent?.canTriggerArtifacts,false); assert.equal(hitEvent?.allowLifeSteal,false); assert.equal(hitEvent?.critResolved,true); assert.equal(hitEvent?.crit,false); assert.equal(hitEvent?.summon,true); assert.equal(s.calls.artifacts,0); assert.equal(s.calls.directHits,0); assert.equal(attackEvent,0,'summon attack does not emit player attack effects');
}

{
  const {s,sys,state}=makeSystemWithSkill(1); update(sys,s,0); const w=state().wolves[0]; w.defense=0; const startX=w.x, startHp=w.hp, startUntil=w.knockbackUntil; w.takeDamage(3,{enemy:{x:w.x+20,isElite:false,behavior:'archer'},source:'archerArrow',attackType:'projectile',dodgeable:true,knockbackDistance:12}); assert.equal(w.hp,startHp-3,'archer arrow damages wolf once'); assert.equal(w.x,startX,'archer arrow does not instantly move wolf'); assert.equal(w.pendingKnockbackDistance,12,'archer arrow queues exact 12px wolf knockback'); assert.ok(w.knockbackUntil>startUntil,'archer arrow sets wolf knockback recovery'); w.takeDamage(3,{enemy:{x:w.x+20,isElite:false,behavior:'archer'},source:'archerArrow',attackType:'projectile',dodgeable:true,knockbackDistance:12}); assert.equal(w.pendingKnockbackDistance,24,'second archer arrow queues another 12px knockback'); for(let t=50;t<=300;t+=50) update(sys,s,t); assert.equal(Math.round(w.x),startX-24,'two archer arrows total 24px smooth knockback');
}
{
  const {s,sys,state}=makeSystemWithSkill(1); update(sys,s,0); const w=state().wolves[0]; w.defense=0; w.takeDamage(1,{enemy:{x:w.x+20,isElite:false},attackType:'melee'}); assert.equal(w.pendingKnockbackDistance,48,'normal enemy default wolf knockback queues 48px'); w.pendingKnockbackDistance=0; w.takeDamage(1,{enemy:{x:w.x+20,isElite:true},attackType:'melee'}); assert.equal(w.pendingKnockbackDistance,42,'elite default wolf knockback queues 42px'); w.pendingKnockbackDistance=0; w.takeDamage(1,{enemy:{x:w.x+20,isBoss:true},attackType:'melee'}); assert.equal(w.pendingKnockbackDistance,32,'boss default wolf knockback queues 32px');
}
{
  const {s,sys,state}=makeSystemWithSkill(1); update(sys,s,0); const w=state().wolves[0]; w.defense=0; let x=w.x; w.takeDamage(1,{enemy:{x:w.x+20,isElite:false},attackType:'projectile',knockbackDistance:0}); assert.equal(w.x,x,'custom 0px wolf knockback does not move'); x=w.x; w.takeDamage(1,{enemy:{x:w.x+20,isElite:false},attackType:'projectile',knockbackDistance:-10}); assert.equal(w.x,x,'negative custom wolf knockback clamps to 0 and does not push forward'); x=w.x; w.takeDamage(1,{enemy:{x:w.x+20,isElite:false},attackType:'projectile',knockbackDistance:'bad'}); assert.equal(w.pendingKnockbackDistance,48,'non-numeric custom wolf knockback falls back to normal default');
}
{
  const {s,sys,state}=makeSystemWithSkill(1); update(sys,s,0); const w=state().wolves[0]; const target=enemy(w.x+180,w.y,500); s.enemies.push(target); const before=w.x; w.takeDamage(1,{enemy:{x:w.x+20,isElite:false},attackType:'melee'}); assert.equal(w.x,before,'enemy hit queues knockback without instant movement'); update(sys,s,50); const knocked=w.x; assert.ok(knocked<before,'smooth knockback decreases wolf world x after update'); update(sys,s,259); assert.ok(w.x<=knocked,'wolf can continue smooth sliding during recovery'); for(let t=300;t<=500;t+=50) update(sys,s,t); assert.equal(w.pendingKnockbackDistance,0,'smooth knockback completes after recovery window');
}
{
  const {s,sys,state}=makeSystemWithSkill(6); update(sys,s,0); s.enemies.push(enemy(100,100,100)); state().wolves[0].takeDamage(999,{enemy:{x:999},attackType:'melee'}); assert.ok(s.calls.damage.some(d=>d.meta.damageKind==='summonDeathBurst')); const burst=s.calls.damage.find(d=>d.meta.damageKind==='summonDeathBurst'); assert.equal(burst.meta.canTriggerArtifacts,false); assert.equal(burst.meta.allowLifeSteal,false); assert.equal(burst.meta.critResolved,true); assert.equal(burst.meta.crit,false); assert.equal(burst.meta.summon,true); const fx=state().fxs.values().next().value; assert.ok(fx?.active); s.completeTweens(); assert.equal(fx.active,false,'death burst fx is destroyed after tween');
}
{
  const {s,sys,state}=makeSystemWithSkill(9); update(sys,s,0); const w=state().wolves[0]; assert.equal(w.attack,Math.round(realPlayer.baseAttack*.3)); assert.equal(w.maxHp,Math.round(realPlayer.baseMaxHp*.25)); assert.equal(w.hpRatio,.25); assert.equal(w.defense,Math.round(realPlayer.baseDefense*.3)); assert.ok(Math.abs(w.visualRadius/(w.baseRadius)-1.15)<0.001,'final effective visual size is 1.15x'); assert.equal(state().wolves.length,2);
}
{
  const {s,sys,state}=makeSystemWithSkill(1); update(sys,s,0); const updater=state().updater; assert.equal(sys.passiveUpdaters.filter(fn=>fn===updater).length,1); sys.removeSkillRuntime(SPIRIT_WOLVES_ID); s.playerData.skills=[]; assert.equal(sys.passiveUpdaters.includes(updater),false,'remove unbinds updater'); assert.equal(state().wolves.length,0); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false);
  sys.addOrLevel(SPIRIT_WOLVES_ID); assert.ok(state().updater); assert.equal(sys.passiveUpdaters.filter(fn=>fn===state().updater).length,1,'reacquire binds exactly one updater'); update(sys,s,0); const w=state().wolves[0]; const beforeX=w.x; s.enemies.push(enemy(w.x+160,w.y,500)); update(sys,s,900); assert.notEqual(w.x,beforeX,'reacquired wolf moves'); s.enemies[0].x=w.x+40; for(let t=1000;t<=1800;t+=100) update(sys,s,t); assert.ok(s.calls.damage.some(d=>d.meta.damageKind==='summonMelee'),'reacquired wolf attacks');
  const callsBefore=s.calls.damage.length; sys.reset(); assert.equal(sys.passiveState.spiritWolves,undefined); assert.equal(sys.passiveUpdaters.length,0); assert.equal(s.calls.damage.length,callsBefore,'reset cleanup does not explode');
}
{
  const {s,sys,state}=makeSystemWithSkill(6); update(sys,s,0); const before=s.calls.damage.length; sys.removeSkillRuntime(SPIRIT_WOLVES_ID); assert.equal(s.calls.damage.length,before,'remove cleanup does not explode'); sys.addOrLevel(SPIRIT_WOLVES_ID); update(sys,s,0); const updater=state().updater; s.events.emit('shutdown'); assert.equal(state().wolves.length,0,'shutdown alone destroys wolves'); assert.equal(sys.passiveUpdaters.includes(updater),false,'shutdown alone removes updater'); assert.equal(sys.cooldowns.has(SPIRIT_WOLVES_ID),false,'shutdown alone clears cooldown'); assert.equal(s.calls.damage.length,before,'shutdown cleanup does not explode');
}
{
  const s=makeRealScene(); s.player.x=150; const wolf={type:'spiritWolf',x:130,y:100,hp:50,maxHp:50,active:true,lastMeta:null,isAlive(){return this.hp>0;},takeDamage(amount,meta){this.lastMeta=meta;this.hp=Math.max(0,this.hp-amount);}}; s.skillSystem={passiveState:{spiritWolves:{wolves:[wolf]}},beforePlayerDamage:()=>null,beforePlayerHpDamage:()=>null}; const healer={active:true,isDefeated:false,isBoss:false,behavior:'healer',x:100,y:100,hp:100,maxHp:100,damage:10,speed:40,attackRange:100,preferredRange:80,attackIntervalMs:2200,body:{setVelocityX(v){this.velocityX=v;}},setFillStyle(){}}; s.enemies=[healer]; const manager=new EnemyBehaviorManager(s); manager.attach(healer); manager.update(0); assert.equal(wolf.hp,50,'healer fallback ignores a spirit wolf behind the player'); assert.equal(s.playerData.hp,s.playerData.maxHp-7,'healer fallback attacks player when all wolves are behind'); manager.destroy();
}
{
  const s=makeScene(); s.playerData.artifacts=[{id:'blood_jade'}]; s.playerData.hp=s.playerData.maxHp-20; const artifacts=new ArtifactSystem(s); artifacts.load(); s.eventBus.emit(CombatEvents.ENEMY_KILLED,{enemy:enemy(),canTriggerArtifacts:false,source:'skill',skillId:SPIRIT_WOLVES_ID}); assert.equal(s.calls.healed,0,'suppressed summon kill does not trigger artifact'); s.eventBus.emit(CombatEvents.ENEMY_KILLED,{enemy:enemy(),canTriggerArtifacts:true,source:'attack'}); assert.equal(s.calls.healed,6,'ordinary eligible kill still triggers artifact'); artifacts.cleanup();
}
{
  const {s,sys,state}=makeSystemWithSkill(1); update(sys,s,0); const w=state().wolves[0]; const start=w.x; update(sys,s,1000); assert.ok(w.x>start,'no enemies: wolf moves right'); const ahead=w.x; s.player.x=50; update(sys,s,1050); assert.ok(w.x>=ahead,'wolf does not move left back to the player'); s.player.x=100; s.cameras.main.worldView.right=360; for(let t=1100;t<=3500;t+=50) update(sys,s,t); assert.ok(w.x<=312,'wolf clamps to right camera margin instead of leaving screen'); assert.ok(w.x<=s.player.x+260+1||w.x===312,'wolf does not run infinitely beyond lead target');
  for(let i=0;i<3;i++) w.takeDamage(1,{enemy:{x:w.x+20},attackType:'melee'}); assert.equal(w.pendingKnockbackDistance,144,'three knockbacks cumulatively queue distance'); { const from=s.getGameplayTime(); for(let t=from+50;t<=from+650;t+=50) update(sys,s,t); } assert.ok(w.x<s.player.x+260,'three knockbacks smooth reduce x'); w.x=s.player.x+5; w.takeDamage(1,{enemy:{x:w.x+20},attackType:'melee'}); { const from=s.getGameplayTime(); for(let t=from+50;t<=from+300;t+=50) update(sys,s,t); } assert.ok(w.x<s.player.x,'wolf can be behind player'); const knocked=w.x; update(sys,s,s.getGameplayTime()+50); assert.ok(w.x<=knocked,'no forward compensation while pending knockback remains'); update(sys,s,s.getGameplayTime()+900); assert.ok(w.x>knocked,'after recovery wolf resumes moving right');
}
{
  const a=makeSystemWithSkill(1), b=makeSystemWithSkill(1); update(a.sys,a.s,0); update(b.sys,b.s,0); const wa=a.state().wolves[0], wb=b.state().wolves[0]; const ax=wa.x,bx=wb.x; for(let t=1000/30;t<=1000;t+=1000/30) update(a.sys,a.s,t); for(let t=1000/120;t<=1000;t+=1000/120) update(b.sys,b.s,t); assert.ok(Math.abs((wa.x-ax)-(wb.x-bx))<20,'30fps and 120fps one-second displacement is close');
}

{
  const {s,sys,state}=makeSystemWithSkill(1); s.player.x=220; update(sys,s,0); const w=state().wolves[0]; w.x=260; w.y=100; w.defense=0; const start=w.x; [0,50,100,150].forEach((t,i)=>{ s.setTime(t); w.takeDamage(1,{enemy:{x:w.x+20,isElite:false},attackType:'melee'}); assert.equal(w.pendingKnockbackDistance,48*(i+1),`hit ${i+1} queues 48px knockback`); assert.equal(w.knockbackUntil,260*(i+1),`hit ${i+1} accumulates recovery`); }); for(let t=200;t<=1000;t+=50) update(sys,s,t); assert.equal(Math.round(w.x),start-192); assert.ok(w.x<s.player.x,'wolf is really pushed behind player'); const knocked=w.x; for(const t of [200,400,800,1000]) update(sys,s,t); assert.equal(w.x,knocked,'wolf cannot move forward during accumulated hit stun'); update(sys,s,1200); assert.ok(w.x>knocked,'wolf resumes forward pursuit after accumulated hit stun');
}
{
  const {s,sys,state}=makeRealSystemWithSkill(1); update(sys,s,0); const w=state().wolves[0]; w.x=s.player.x-10; w.y=s.player.y; w.hp=50; w.defense=0; s.playerData.hp=100; s.playerData.dodgeChance=0; const e={x:s.player.x+20,y:s.player.y,active:true,isDefeated:false,hp:20,maxHp:20,damage:5,attackRange:80,nextAttackAt:0,attackIntervalMs:1000,behavior:'grunt'}; s.enemies=[e]; s.targeting.valid=x=>!!x?.active&&!x.isDefeated; s.combatSystem.updateEnemyAttack(e,0); assert.equal(s.playerData.hp,95,'melee hits player when wolf is behind'); assert.equal(w.hp,50,'behind wolf does not block melee'); w.x=s.player.x+1; e.lockedAttackTarget=null; e.nextAttackAt=0; s.combatSystem.updateEnemyAttack(e,0); assert.equal(w.hp,45,'frontline wolf blocks melee again'); assert.equal(s.playerData.hp,95,'player is not hit while frontline wolf blocks');
}
{
  const {s,sys,state}=makeSystemWithSkill(1); update(sys,s,0); const w=state().wolves[0]; w.defense=0; const hp=w.hp, until=w.knockbackUntil; w.takeDamage(3,{enemy:{x:w.x+20,isElite:false},source:'bomb',attackType:'bomb',dodgeable:false,singleTarget:false}); assert.equal(w.hp,hp-3,'singleTarget:false enemy hit still damages wolf'); assert.equal(w.pendingKnockbackDistance,0,'singleTarget:false enemy hit does not queue knockback'); assert.equal(w.knockbackUntil,until,'singleTarget:false enemy hit does not extend recovery'); w.takeDamage(1,{enemy:{x:w.x+20,isElite:false},attackType:'melee'}); assert.equal(w.pendingKnockbackDistance,48,'missing singleTarget remains compatible with old single-target hits');
}
{
  const {s,sys,state}=makeRealSystemWithSkill(1); update(sys,s,0); const w=state().wolves[0]; w.x=s.player.x-10; w.y=s.player.y; w.hp=50; w.defense=0; s.playerData.hp=100; const beforeUntil=w.knockbackUntil; const e={x:s.player.x,y:s.player.y,active:true,isDefeated:false,hp:20,maxHp:20,damage:5}; const hits=s.combatSystem.damageTargetsInRadius(s.player.x,s.player.y,80,3,{enemy:e,source:'bomb',attackType:'bomb',dodgeable:false}); assert.ok(hits.some(h=>h.target===w&&h.damage===3),'area damage still hits a behind-player wolf'); assert.ok(hits.some(h=>h.target.type==='player'&&h.damage===3),'area damage also hits player'); assert.equal(w.pendingKnockbackDistance,0,'area damage does not knock back behind-player wolf'); assert.equal(w.knockbackUntil,beforeUntil,'area damage does not add wolf hit stun');
}

assert.equal(/SNAP|LEASH|initialized/.test(fs.readFileSync('src/skills/handlers/SpiritWolvesSkill.js','utf8')),false,'obsolete SNAP/LEASH/initialized logic removed');
assert.equal(inheritRatioForLevel(1),.20); assert.equal(inheritRatioForLevel(9),.30);
console.log('v0.10.78 spirit wolves validation passed.');
