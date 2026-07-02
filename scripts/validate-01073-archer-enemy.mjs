import assert from 'node:assert/strict';
import { ENEMIES } from '../src/config/enemies.js';
import { GAME_VERSION } from '../src/config/version.js';
import StageSystem, { FLOW_GROUPS } from '../src/systems/StageSystem.js';

global.window={cordova:undefined, navigator:{userAgent:''}, addEventListener(){}, removeEventListener(){}};
global.document={documentElement:{style:{}}, createElement(){return {getContext(){return new Proxy({},{get(_,k){ if(k==='getImageData') return ()=>({data:[0,0,0,0]}); return ()=>{}; }});}, style:{}};}, addEventListener(){}, removeEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:global.window.navigator, configurable:true});
global.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } };
global.HTMLCanvasElement=class {};

const { default: EnemyBehaviorManager, entryMove } = await import('../src/enemies/behaviors/EnemyBehaviorManager.js');
const { default: CombatSystem } = await import('../src/systems/CombatSystem.js');

assert.equal(GAME_VERSION,'0.10.99');
assert(ENEMIES.archer, 'archer config exists');
assert.equal(ENEMIES.archer.behavior,'archer');
assert.equal(ENEMIES.archer.attackRange,450);
assert.equal(ENEMIES.archer.attackIntervalMs,2000);
assert.equal('preferredRange' in ENEMIES.archer,false);
assert.notEqual(ENEMIES.archer.kind,'elite');
assert.notEqual(ENEMIES.archer.kind,'boss');
assert(ENEMIES.bomber, 'bomber config remains');
assert.equal('preferredRange' in ENEMIES.bomber,false);
assert(ENEMIES.archer.hp < ENEMIES.bomber.hp && ENEMIES.archer.hp < ENEMIES.armored_guard.hp, 'archer hp is below bomber and armored guard');

const body = () => ({ velocity:{x:0}, vx:0, setVelocityX(v){ this.vx=v; this.velocity.x=v; } });
const target = (x,y=100,type='player') => ({ x, y, type, height:80, hp:100, active:true, isAlive(){ return this.hp>0; }, takeDamage(a){ this.hp-=a; } });
const makeScene = (targets=[]) => {
  const calls=[]; const arrows=[];
  const scene={
    player:target(100), balance:{enemies:{rangeBuffer:24}}, enemies:[],
    targeting:{ isEnemyFullyInsideViewport(){return true;}, shouldRecycleEnemyLeft(){return false;}, getEnemyRightRespawnX(){return 900;} },
    combatSystem:{
      getAttackableTargets(){ return targets; },
      getSelectableEnemyAttackTargets(){ return targets.filter(t=>t.type!=='spiritWolf'||t.x>=scene.player.x); },
      getPlayerAttackTarget(){ return scene.player; },
      chooseEnemyAttackTarget(enemy,range){ return targets.filter(t=>t.isAlive()).map(t=>({t,d:Math.hypot(enemy.x-t.x,enemy.y-t.y)})).filter(o=>o.d<=range).sort((a,b)=>a.d-b.d)[0]?.t ?? null; },
      damageAttackTarget(t,amount,meta){ calls.push({target:t,amount,meta}); t.takeDamage?.(amount,meta); }
    },
    add:{ rectangle(x,y,w,h,color,alpha){ const arrow={x,y,w,h,color,alpha,active:true,destroyed:false,setDepth(){return this;},destroy(){this.active=false;this.destroyed=true;}}; arrows.push(arrow); return arrow; } },
    tweens:{ added:[], add(config){ this.added.push(config); return config; }, killTweensOf(obj){ obj.killed=true; } },
  };
  return {scene,calls,arrows};
};
const enemy = (x=700) => ({ ...ENEMIES.archer, x, y:100, active:true, isDefeated:false, body:body(), setFillStyle(){} });

{ const e=enemy(760); entryMove({},e); assert.equal(e.body.vx,-360,'screen-entry movement still moves left'); }
{ const t=target(100); const {scene}=makeScene([t]); const e=enemy(700); const m=new EnemyBehaviorManager(scene); m.attach(e); assert(m.items.has(e),'ArcherBehavior registers'); m.update(0); assert.equal(e.body.vx,-360,'archer outside 450 range approaches target'); }
{ const t=target(300); const {scene,calls,arrows}=makeScene([t]); const e=enemy(700); const m=new EnemyBehaviorManager(scene); m.attach(e); m.update(0); assert.equal(e.body.vx,0,'archer inside 450 range stops'); assert.equal(calls.length,1,'one arrow attack deals damage once'); assert.equal(calls[0].meta.source,'archerArrow'); assert.equal(calls[0].meta.attackType,'projectile'); assert.equal(calls[0].meta.dodgeable,true); assert.equal(calls[0].meta.knockbackDistance,12); assert.equal(arrows.length,1,'one arrow visual is spawned'); scene.tweens.added[0].onComplete(); assert.equal(arrows[0].destroyed,true,'arrow visual is destroyed after tween'); }
{ const t=target(650); const {scene}=makeScene([t]); const e=enemy(700); const m=new EnemyBehaviorManager(scene); m.attach(e); m.update(0); assert.equal(e.body.vx,0,'archer does not retreat when target is very close'); }
{ const t=target(300); const {scene,arrows}=makeScene([t]); const e=enemy(700); const m=new EnemyBehaviorManager(scene); m.attach(e); m.update(0); assert.equal(arrows[0].destroyed,false); m.recycleEnemy(e); assert.equal(arrows[0].destroyed,true,'recycle destroys unfinished arrows'); }
{ const t=target(300); const {scene,arrows}=makeScene([t]); const e=enemy(700); const m=new EnemyBehaviorManager(scene); m.attach(e); m.update(0); m.destroy(); assert.equal(arrows[0].destroyed,true,'destroy destroys unfinished arrows'); }
{ const t=target(100); const {scene}=makeScene([t]); const e=enemy(700); const m=new EnemyBehaviorManager(scene); m.attach(e); m.update(0); assert.notEqual(e.body.vx,0); m.pause(); assert.equal(e.body.vx,0,'pause stops archer movement'); }
{ const wolf=target(300,100,'spiritWolf'); const {scene,calls}=makeScene([wolf]); const e=enemy(700); const m=new EnemyBehaviorManager(scene); m.attach(e); m.update(0); assert.equal(calls[0].target,wolf,'frontline spirit wolf can be selected as arrow target'); }
{ const player=target(500,100,'player'); const wolf=target(300,100,'spiritWolf'); const {scene,calls}=makeScene([player,wolf]); scene.player=player; const e=enemy(700); const m=new EnemyBehaviorManager(scene); m.attach(e); m.update(0); assert.equal(calls[0].target,player,'backline spirit wolf cannot be selected as arrow target'); }

{ const wolf=target(300,100,'spiritWolf'); wolf.damageEvents=[]; wolf.takeDamage=function(amount,meta){ this.damageEvents.push({amount,meta}); this.hp-=amount; }; const {scene,calls}=makeScene([wolf]); const e=enemy(700); e.nextAttackAt=0; scene.enemies=[e]; scene.skillSystem={passiveState:{spiritWolves:{wolves:[wolf]}}}; scene.playerData={hp:100,maxHp:100,weaponId:'short_sword'}; scene.targeting.all=()=>scene.enemies; scene.targeting.valid=x=>!!x?.active&&!x.isDefeated; scene.targeting.nearestAhead=()=>null; scene.professionSystem={currentAttackProfile:()=>null}; scene.combatSystem=new CombatSystem(scene); const manager=new EnemyBehaviorManager(scene); manager.attach(e); manager.update(1000); scene.combatSystem.update(1000); assert.equal(wolf.damageEvents.length,1,'archer behavior plus CombatSystem same-frame update deals damage once'); assert.deepEqual(wolf.damageEvents.map(d=>d.meta.source),['archerArrow']); assert.equal(wolf.damageEvents.some(d=>d.meta.source==='enemyMelee'),false,'archer does not also produce generic enemyMelee damage'); manager.update(1200); scene.combatSystem.update(1200); assert.equal(wolf.damageEvents.length,1,'archer cooldown prevents another hit before next arrow'); manager.destroy(); }


const stage = new StageSystem({});
const idsOf = (group,wave) => stage.makeWaveIds(group.ids[wave], group.waves[wave], group.rangedCounts?.[wave] ?? 0).map(x=>x.id);
const ranged = new Set(['archer','bomber','healer']);
FLOW_GROUPS.slice(0,3).forEach(g=>g.waves.forEach((_,i)=>assert.equal(idsOf(g,i).some(id=>ranged.has(id)),false,`group ${g.group} wave ${i+1} has no ranged`)));
assert(idsOf(FLOW_GROUPS[3],0).includes('archer'),'group 4 starts archers');
FLOW_GROUPS.slice(3,11).forEach(g=>g.waves.forEach((_,i)=>assert.equal(idsOf(g,i).includes('bomber'),false,`group ${g.group} wave ${i+1} has no bomber`)));
FLOW_GROUPS.slice(0,11).forEach(g=>g.waves.forEach((_,i)=>assert.equal(idsOf(g,i).includes('bomber'),false,`before group 12 no bomber`)));
const bomberWaves=[]; let totalArchers=0, totalBombers=0;
FLOW_GROUPS.forEach(g=>g.waves.forEach((count,i)=>{ const ids=idsOf(g,i); assert.equal(ids.length,count,`group ${g.group} wave ${i+1} count`); const b=ids.filter(id=>id==='bomber').length; const h=ids.filter(id=>id==='healer').length; const a=ids.filter(id=>id==='archer').length; totalArchers+=a; totalBombers+=b; assert(b<=1,`group ${g.group} wave ${i+1} bomber cap`); assert(h<=1,`group ${g.group} wave ${i+1} healer cap`); if(b) bomberWaves.push(`${g.group}-${i+1}`); const expectedBack=g.rangedCounts?.[i]??0; assert.equal(ids.filter(id=>ranged.has(id)).length, expectedBack,`group ${g.group} wave ${i+1} ranged count`); }));
assert.deepEqual(bomberWaves,['12-3','14-3','16-3','17-3','18-3']);
assert(totalArchers > totalBombers * 8, 'archers are clearly the main ranged source');
assert.equal(stage.makeWaveIds(['grunt','healer'],6,3).filter(x=>x.id==='archer').length,2,'archer fills ranged fallback when no ranged damage unit is in pool');
assert.equal(stage.makeWaveIds(['grunt','bomber'],8,5).filter(x=>x.id==='bomber').length,1,'bomber does not fill high rangedCount loops');
['boss1','boss2','boss3','boss4','boss5','boss6'].forEach(id=>{ const text=StageSystem.prototype.updateRush.toString(); assert(!new RegExp(`activeRush==='${id}'\\?\\[[^\\]]*(archer|bomber|healer)`).test(text), `${id} rush has no direct ranged special assertion placeholder`); });
assert(!StageSystem.prototype.updateRush.toString().includes("'archer'"),'boss rush code does not spawn archers');
assert(!StageSystem.prototype.updateRush.toString().includes("'bomber','healer'"),'boss rush code does not spawn bomber/healer pair');

console.log('[validate:01073-archer-enemy] PASS archer config, behavior cleanup, no-retreat ranged movement, and v0.10.99 wave rules');
