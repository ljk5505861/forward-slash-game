import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
globalThis.document={documentElement:{style:{}},createElement:()=>({getContext:()=>({fillRect(){},clearRect(){},drawImage(){},getImageData:()=>({data:[0,0,0,255]}),putImageData(){},createImageData:()=>({data:[0,0,0,0]})})})};
Object.defineProperty(globalThis,'navigator',{value:globalThis.window.navigator,configurable:true});
globalThis.HTMLCanvasElement=class {}; globalThis.Image=class {};
const { GAME_VERSION } = await import('../src/config/version.js');
const { ENEMIES } = await import('../src/config/enemies.js');
const { default: CombatSystem, FRONTLINE_SWITCH_THRESHOLD } = await import('../src/systems/CombatSystem.js');
const { default: EnemyBehaviorManager } = await import('../src/enemies/behaviors/EnemyBehaviorManager.js');
const { SKILLS } = await import('../src/config/skills.js');
const { configureEntryArchetypeSkills } = await import('../src/skills/handlers/EntryArchetypeSkills.js');
const { SpiritWolvesSkill, SPIRIT_WOLVES_ID, inheritRatioForLevel, hpInheritRatioForLevel } = await import('../src/skills/handlers/SpiritWolvesSkill.js');
configureEntryArchetypeSkills();
assert.equal(GAME_VERSION,'0.11.4');
assert.equal(FRONTLINE_SWITCH_THRESHOLD,18);
const wolfSrc=fs.readFileSync('src/skills/handlers/SpiritWolvesSkill.js','utf8');
const combatSrc=fs.readFileSync('src/systems/CombatSystem.js','utf8');
assert.match(wolfSrc,/WOLF_KNOCKBACK_SLIDE_SPEED=360/);
assert.match(wolfSrc,/enemy\?\.isBoss\?32:\(enemy\?\.isElite\?42:48\)/);
assert.doesNotMatch(wolfSrc.match(/function applyWolfKnockback[\s\S]*?function dtFor/)?.[0]||'',/w\.x\s*[-+]?=/);
assert.match(wolfSrc,/w\.x-=step/);
assert.match(wolfSrc,/meta\.enemy&&meta\.attackType&&meta\.singleTarget!==false/);
assert.match(combatSrc,/FRONTLINE_SWITCH_THRESHOLD\s*=\s*18/);
assert.match(combatSrc,/getFrontmostEnemyAttackTarget/);
assert.doesNotMatch(combatSrc,/forcePlayerTargetUntilHit/);

const ratios=[.20,.21,.22,.23,.24,.25,.26,.28,.30], hpRatios=[.15,.16,.17,.18,.19,.20,.21,.23,.25];
ratios.forEach((r,i)=>assert.equal(inheritRatioForLevel(i+1),r));
hpRatios.forEach((r,i)=>assert.equal(hpInheritRatioForLevel(i+1),r));
assert.equal(hpInheritRatioForLevel(0),.15); assert.equal(hpInheritRatioForLevel(99),.25);
SKILLS.spirit_wolves.levels.forEach((l,i)=>{ assert.equal(l.inheritRatio,ratios[i]); assert.equal(l.hpInheritRatio,hpRatios[i]); assert.doesNotMatch(l.desc,/基础攻击、基础最大生命、基础防御\d+%|基础属性继承/); });

function view(x,y){ return {x,y,active:true,setStrokeStyle(){return this},setDepth(){return this},setScale(v){this.scale=v;return this},setPosition(x,y){this.x=x;this.y=y;return this},destroy(){this.active=false}}; }
function scene(){ let now=0; const s={player:{x:200,y:100},playerData:{hp:100,baseAttack:100,baseMaxHp:100,baseDefense:20},cameras:{main:{worldView:{left:0,right:960}}},add:{circle:(x,y)=>view(x,y),rectangle:(x,y)=>view(x,y)},events:{once(){},off(){}},tweens:{add(c){c.onComplete?.();}},eventBus:{emit(){}},floatText(){},getGameplayTime:()=>now,setTime:t=>{now=t},targeting:{valid:e=>!!e?.active&&!e.isDefeated,all:()=>s.enemies},combatSystem:{damageEnemy(e,a){e.hp-=a; return true;}},enemies:[]}; return s; }
function sys(level=1){ const s=scene(); const system={scene:s,passiveState:{},passiveUpdaters:[],cooldowns:new Map()}; SpiritWolvesSkill.bind(system); SpiritWolvesSkill.cast(system,{},null,level); return {s,system,state:system.passiveState.spiritWolves,update(t){s.setTime(t); system.passiveUpdaters.forEach(f=>f());}}; }
for(const [level,atk,def,hp] of [[1,20,4,15],[6,25,5,20],[9,30,6,25]]){ const h=sys(level); const w=h.state.wolves[0]; assert.equal(w.attack,atk); assert.equal(w.defense,def); assert.equal(w.maxHp,hp); assert.equal(w.hp,hp); assert.equal(w.ratio,ratios[level-1]); assert.equal(w.hpRatio,hpRatios[level-1]); }
{ const h=sys(1); h.s.playerData.baseMaxHp=1; h.state.wolves=[]; SpiritWolvesSkill.cast(h.system,{},null,1); assert.equal(h.state.wolves[0].maxHp,1); }
function hitDistance(meta){ const h=sys(1); h.update(0); const w=h.state.wolves[0]; w.defense=0; w.takeDamage(1,meta); return {w,h}; }
assert.equal(hitDistance({enemy:{isElite:false},attackType:'melee'}).w.pendingKnockbackDistance,48);
assert.equal(hitDistance({enemy:{isElite:true},attackType:'melee'}).w.pendingKnockbackDistance,42);
assert.equal(hitDistance({enemy:{isBoss:true,isElite:true},attackType:'melee'}).w.pendingKnockbackDistance,32);
assert.equal(hitDistance({enemy:{behavior:'archer'},attackType:'projectile',knockbackDistance:12}).w.pendingKnockbackDistance,12);
assert.equal(hitDistance({enemy:{isElite:false},attackType:'melee',singleTarget:true}).w.pendingKnockbackDistance,48);
assert.equal(hitDistance({enemy:{isElite:false},attackType:'melee',singleTarget:false}).w.pendingKnockbackDistance,0);
assert.equal(hitDistance({enemy:{},attackType:'melee',knockbackDistance:0}).w.pendingKnockbackDistance,0);
assert.equal(hitDistance({enemy:{},attackType:'melee',knockbackDistance:-5}).w.pendingKnockbackDistance,0);
assert.equal(hitDistance({enemy:{isElite:true},attackType:'melee',knockbackDistance:'bad'}).w.pendingKnockbackDistance,42);
{ const h=sys(1); h.update(0); const w=h.state.wolves[0]; w.defense=0; w.takeDamage(1,{enemy:{},attackType:'melee'}); w.takeDamage(1,{enemy:{},attackType:'melee'}); assert.equal(w.pendingKnockbackDistance,96); assert.equal(w.knockbackUntil,520); }
{ const h=sys(1); h.update(0); const w=h.state.wolves[0]; w.x=300; w.defense=0; w.takeDamage(1,{enemy:{},attackType:'melee'}); h.update(0); assert.equal(w.x,300); assert.equal(w.pendingKnockbackDistance,48); h.update(1000/60); assert.ok(w.x<300&&w.x>252); for(let t=1000/60;t<=150;t+=1000/60) h.update(t); assert.equal(Math.round(w.x),252); const stopped=w.x; h.update(200); assert.equal(w.x,stopped); h.update(300); assert.ok(w.x>=stopped); }
{ const h=sys(1); h.update(0); const w=h.state.wolves[0]; w.x=10; w.defense=0; w.takeDamage(1,{enemy:{},attackType:'melee'}); h.update(100); assert.equal(w.x,8); assert.equal(w.pendingKnockbackDistance,0); }

{ const h=sys(1); h.s.combatSystem=new CombatSystem(h.s); h.s.skillSystem={...h.system,beforePlayerDamage:()=>null,beforePlayerHpDamage:()=>null}; h.s.statusEffects={clearTarget(){},getEffects:()=>[],absorbShield:d=>({absorbed:0,remainingDamage:d})}; h.s.player.x=-1000; h.update(0); const w=h.state.wolves[0]; w.x=300; w.y=100; w.defense=0; const hp=w.hp,x=w.x,pending=w.pendingKnockbackDistance,until=w.knockbackUntil; const bomber={x:300,y:100,active:true,isDefeated:false,hp:20,maxHp:20,damage:3,behavior:'bomber'}; const hits=h.s.combatSystem.damageTargetsInRadius(w.x,w.y,100,3,{enemy:bomber,source:'bomb',attackType:'bomb',dodgeable:false,singleTarget:false}); assert.ok(hits.some(hit=>hit.target===w&&hit.damage===3)); assert.equal(w.hp,hp-3); assert.equal(w.x,x); assert.equal(w.pendingKnockbackDistance,pending); assert.equal(w.knockbackUntil,until); }
{ const h=sys(1); h.s.combatSystem=new CombatSystem(h.s); h.s.skillSystem={...h.system,beforePlayerDamage:()=>null,beforePlayerHpDamage:()=>null}; h.s.statusEffects={clearTarget(){},getEffects:()=>[],absorbShield:d=>({absorbed:0,remainingDamage:d})}; h.s.player.x=-1000; h.update(0); const w=h.state.wolves[0]; w.x=320; w.y=100; w.defense=0; const hp=w.hp,until=w.knockbackUntil; const boss={x:320,y:100,active:true,isDefeated:false,hp:200,maxHp:200,damage:11,isBoss:true,behavior:'midBoss'}; h.s.combatSystem.damageTargetsInRadius(w.x,w.y,160,11,{enemy:boss,source:'midBossSlam',attackType:'ground',dodgeable:false,singleTarget:false}); assert.equal(w.hp,hp-11); assert.equal(w.pendingKnockbackDistance,0); assert.equal(w.knockbackUntil,until); }
{ const h=sys(1); h.s.combatSystem=new CombatSystem(h.s); h.s.skillSystem={...h.system,beforePlayerDamage:()=>null,beforePlayerHpDamage:()=>null}; h.s.statusEffects={clearTarget(){},getEffects:()=>[],absorbShield:d=>({absorbed:0,remainingDamage:d})}; h.update(0); h.s.player.x=220; const w=h.state.wolves[0]; w.x=180; w.y=h.s.player.y; w.defense=0; const hp=w.hp; const bomber={x:180,y:w.y,active:true,isDefeated:false,hp:20,maxHp:20,damage:3,behavior:'bomber'}; const hits=h.s.combatSystem.damageTargetsInRadius(w.x,w.y,100,3,{enemy:bomber,source:'bomb',attackType:'bomb',dodgeable:false,singleTarget:false}); assert.ok(hits.some(hit=>hit.target===w&&hit.damage===3)); assert.equal(w.hp,hp-3); assert.equal(w.pendingKnockbackDistance,0); }
{ const h=sys(1); h.update(0); const w=h.state.wolves[0]; w.defense=0; w.takeDamage(1,{enemy:{},attackType:'melee'}); assert.equal(w.pendingKnockbackDistance,48); const until=w.knockbackUntil,hp=w.hp; w.takeDamage(1,{enemy:{behavior:'bomber'},source:'bomb',attackType:'bomb',singleTarget:false}); assert.equal(w.hp,hp-1); assert.equal(w.pendingKnockbackDistance,48); assert.equal(w.knockbackUntil,until); }
assert.equal(ENEMIES.grunt.attackRange,86); assert.equal(ENEMIES.elite.attackRange,96); assert.equal(ENEMIES.armored_guard.attackRange,112); assert.equal(ENEMIES.charger.attackRange,82);
assert.equal(ENEMIES.archer.attackRange,450); assert.equal(ENEMIES.bomber.attackRange,480); assert.equal(ENEMIES.healer.attackRange,480); assert.equal(ENEMIES.berserker_boss.attackRange,155); assert.equal(ENEMIES.mid_boss.attackRange,155); assert.equal(ENEMIES.boss.attackRange,155);
function target(type,x){ return {type,x,y:100,hp:50,maxHp:50,active:true,isDefeated:false,isAlive(){return this.hp>0},takeDamage(n){this.hp-=n;}}; }
function body(){ return {vx:0,velocity:{x:0},setVelocityX(v){this.vx=v;this.velocity.x=v;}}; }
{ const wolf=target('spiritWolf',300), player=target('player',200); const s={player,playerData:{hp:100,maxHp:100,dodgeChance:0},enemies:[],balance:{enemies:{rangeBuffer:0}},isGameplayPaused:()=>false,floatText(){},finishRun(){},hud:{update(){},setStatus(){}},eventBus:{emit(){}},targeting:{valid:e=>!!e?.active&&!e.isDefeated,isEnemyFullyInsideViewport:()=>true,shouldRecycleEnemyLeft:()=>false},statusEffects:{clearTarget(){},getEffects:()=>[],absorbShield:d=>({absorbed:0,remainingDamage:d})},skillSystem:{passiveState:{spiritWolves:{wolves:[wolf]}},beforePlayerDamage:()=>null,beforePlayerHpDamage:()=>null}}; s.combatSystem=new CombatSystem(s); const e={x:386,y:100,active:true,isDefeated:false,hp:20,maxHp:20,damage:5,attackRange:86,attackIntervalMs:100,nextAttackAt:0,speed:40,body:body(),behavior:'grunt'}; s.enemies=[e]; const m=new EnemyBehaviorManager(s); m.updateEnemyApproach(e); assert.equal(e.body.vx,0); s.combatSystem.updateEnemyAttack(e,0); assert.equal(wolf.hp,45); wolf.x-=48; m.updateEnemyApproach(e); assert.notEqual(e.body.vx,0); assert.notEqual(e.body.vx,-48); e.x=330; m.updateEnemyApproach(e); assert.equal(e.body.vx,0); wolf.x=210; e.lockedAttackTarget=wolf; assert.equal(s.combatSystem.getOrLockEnemyTarget(e),wolf); wolf.x=181; assert.equal(s.combatSystem.getOrLockEnemyTarget(e).type,'player'); wolf.x=219; assert.equal(s.combatSystem.getOrLockEnemyTarget(e),wolf); }
console.log('v0.11.1 wolf pressure balance validation passed.');
