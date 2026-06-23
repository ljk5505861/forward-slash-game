import { strict as assert } from 'node:assert';
import { BALANCE, createPlayerRuntime } from '../src/config/balance.js';
import { ENEMIES } from '../src/config/enemies.js';
import { WEAPONS } from '../src/config/weapons.js';
import { SKILLS } from '../src/config/skills.js';
import StageSystem, { FLOW_GROUPS, LevelFlowStates } from '../src/systems/StageSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import createEnemy from '../src/entities/createEnemy.js';
import createPlayer from '../src/entities/createPlayer.js';

const RANGED = new Set(['bomber', 'healer']);
const noop = () => {};
const makeNode = (x = 0, y = 0, w = 10, h = 10) => ({
  x, y, width: w, height: h, active: true, isDefeated: false,
  setStrokeStyle(){ return this; }, setDepth(){ return this; }, setOrigin(){ return this; }, setScrollFactor(){ return this; }, setFillStyle(){ return this; }, setScale(v){ this.scale=v; return this; }, setDisplaySize(w2,h2){ this.width=w2; this.height=h2; return this; }, setPosition(x2,y2){ this.x=x2; this.y=y2; return this; }, destroy(){ this.active=false; },
  body: { width: w, height: h, vx:0, setCollideWorldBounds(){}, setAllowGravity(){}, setImmovable(){}, setSize(w2,h2){ this.width=w2; this.height=h2; }, setOffset(x2,y2){ this.offsetX=x2; this.offsetY=y2; }, setMaxVelocity(){}, setVelocityX(v){ this.vx=v; }, reset(x2,y2){ this.owner.x=x2; this.owner.y=y2; }, enable:true }
});
function makeScene(){
  const scene = { balance: BALANCE, scale:{height:1280}, playerData:createPlayerRuntime(), enemies:[], runState:'RUNNING', player:{x:220,y:881,body:{}}, cameras:{main:{worldView:{right:720}, scrollX:0, width:720, setBounds(){}}}, physics:{world:{setBounds(){}}, add:{existing(o){ o.body.owner=o; }}}, add:{rectangle:(x,y,w,h)=>makeNode(x,y,w,h), text:(x,y)=>makeNode(x,y), circle:(x,y,r)=>makeNode(x,y,r*2,r*2), arc:(x,y,r)=>makeNode(x,y,r*2,r*2)}, tweens:{add({onComplete}={}){ onComplete?.(); }}, eventBus:{events:[], emit(type,payload){ this.events.push({type,payload}); }}, hud:{setStage(v){this.stage=v;}, setStatus(v){this.status=v;}, update(){}}, enemyBehaviors:{attach(){}, update(){}, destroyEnemy(){}}, statusEffects:{clearTarget(){}}, targeting:{valid:e=>!!e&&!e.isDefeated, all(){return scene.enemies.filter(e=>!e.isDefeated);}, isEnemyFullyInsideViewport(){return true;}, shouldRecycleEnemyLeft(){return false;}, getEnemyRightRespawnX(e){return e.x+100;}}, professionSystem:{getDamageMultiplier(){return 1;}, onDirectHit(){}}, artifactSystem:{highHpDamageMultiplier(){return 1;}}, isGameplayPaused(){return false;}, awardGold(){}, floatText(){}, finishRun(){}, runStats:{}, skillSystem:{beforePlayerDamage(){}}, resumeModalFlow:noop };
  return scene;
}

const oldPlayer = { width:64, height:112, bodyWidth:46, bodyHeight:101, stopBuffer:12 };
assert.deepEqual({ width:BALANCE.player.width, height:BALANCE.player.height, bodyWidth:BALANCE.player.bodyWidth, bodyHeight:BALANCE.player.bodyHeight, stopBuffer:BALANCE.player.stopBuffer }, { width:45, height:78, bodyWidth:32, bodyHeight:71, stopBuffer:8 }, 'player size and contact buffer are rounded from 0.10.2 * 0.7');
assert.equal(BALANCE.player.width, Math.round(oldPlayer.width * 0.7)); assert.equal(BALANCE.player.height, Math.round(oldPlayer.height * 0.7));
assert.equal(BALANCE.enemies.rangeBuffer, 24, 'ranged positioning buffer is unchanged'); assert.equal('entrySpeed' in BALANCE.enemies, false, 'entrySpeed no longer drives runtime movement');
const oldEnemies = { grunt:{width:74,height:118,bodyWidth:64,bodyHeight:108,attackRange:92}, elite:{width:106,height:150,bodyWidth:92,bodyHeight:138,attackRange:105}, armored_guard:{width:98,height:148,bodyWidth:86,bodyHeight:136,attackRange:104}, charger:{width:84,height:106,bodyWidth:76,bodyHeight:96,attackRange:86,chargeTriggerRange:360}, bomber:{width:82,height:118,bodyWidth:72,bodyHeight:106,attackRange:520,preferredRange:350}, healer:{width:78,height:124,bodyWidth:68,bodyHeight:112,attackRange:500,preferredRange:350}, berserker_boss:{width:138,height:184,bodyWidth:122,bodyHeight:170,attackRange:122,chargeSpeed:240}, mid_boss:{width:128,height:178,bodyWidth:114,bodyHeight:166,attackRange:118}, boss:{width:134,height:190,bodyWidth:122,bodyHeight:178,attackRange:118} };
Object.values(ENEMIES).forEach(cfg => assert.equal(cfg.speed, cfg.kind === 'boss' ? 272 : 240, `${cfg.id} base speed`));
for (const [id, old] of Object.entries(oldEnemies)) { const cfg=ENEMIES[id]; ['width','height','bodyWidth','bodyHeight'].forEach(k=>assert.equal(cfg[k], Math.round(old[k]*0.7), `${id} ${k} scaled`)); }
['grunt','elite','armored_guard','charger','berserker_boss','mid_boss','boss'].forEach(id => assert.equal(ENEMIES[id].attackRange, Math.round(oldEnemies[id].attackRange*0.7), `${id} melee range scaled`));
assert.equal(ENEMIES.bomber.attackRange, 520); assert.equal(ENEMIES.bomber.preferredRange, 350); assert.equal(ENEMIES.healer.attackRange, 500); assert.equal(ENEMIES.healer.preferredRange, 350); assert.equal(ENEMIES.charger.chargeTriggerRange, 360); assert.equal(ENEMIES.berserker_boss.chargeSpeed, oldEnemies.berserker_boss.chargeSpeed, 'berserker boss charge speed unchanged');
global.window={cordova:undefined, navigator:{userAgent:''}, addEventListener(){}, removeEventListener(){}}; global.document={documentElement:{style:{}}, createElement(){return {getContext(){return new Proxy({},{get(_,k){ if(k==='getImageData') return ()=>({data:[0,0,0,0]}); return ()=>{}; }});}, style:{}};}, addEventListener(){}, removeEventListener(){}}; Object.defineProperty(globalThis,'navigator',{value:global.window.navigator, configurable:true}); global.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } }; global.HTMLCanvasElement=class {};
const { default: EnemyBehaviorManager, approach, entryMove } = await import('../src/enemies/behaviors/EnemyBehaviorManager.js');
const speedScene = makeScene(); const speedEnemy = createEnemy(speedScene, ENEMIES.grunt, 760, BALANCE.groundTopY); assert.equal(speedEnemy.speed, 240); assert.equal('entrySpeed' in speedEnemy, false); assert.equal('combatSpeed' in speedEnemy, false); entryMove(speedScene, speedEnemy); const entryV=speedEnemy.body.vx; approach(speedScene, speedEnemy, speedEnemy.attackRange); assert.equal(Math.abs(entryV), 240); assert.equal(Math.abs(speedEnemy.body.vx), 240, 'entry and active approach use same base speed');
const playerScene = makeScene(); const player = createPlayer(playerScene, BALANCE.player, BALANCE.groundTopY); assert.equal(player.width, BALANCE.player.width); assert.equal(player.height, BALANCE.player.height); assert.equal(player.body.width, BALANCE.player.bodyWidth); assert.equal(player.body.height, BALANCE.player.bodyHeight); assert.equal(player.y + player.height/2, BALANCE.groundTopY, 'player feet stay on ground');
const uiScene = makeScene(); const made = createEnemy(uiScene, ENEMIES.boss, 900, BALANCE.groundTopY); assert.equal(made.width, ENEMIES.boss.width); assert.equal(made.height, ENEMIES.boss.height); assert.equal(made.body.width, ENEMIES.boss.bodyWidth); assert.equal(made.body.height, ENEMIES.boss.bodyHeight); assert.equal(made.y + made.height/2, BALANCE.groundTopY, 'enemy feet stay on ground'); assert.equal(made.hpBarBg.width, ENEMIES.boss.width, 'hp bar width follows scaled width'); assert.equal(made.hpBarBg.y, made.y - made.height/2 - 18); assert.equal(made.nameText.y, made.y - made.height/2 - 42);

const idsOf = items => items.map(item => item.id);
const assertNoRanged = (ids, label) => assert.deepEqual(ids.filter(id => RANGED.has(id)), [], label);

FLOW_GROUPS.slice(0,3).forEach(group => group.waves.forEach((count, i) => assertNoRanged(idsOf(new StageSystem(makeScene()).makeWaveIds(group.ids[i], count, group.rangedCounts?.[i] ?? 0)), `group ${group.group} wave ${i+1} has no ranged`)));
const later = new StageSystem(makeScene()).makeWaveIds(['elite','grunt','bomber','healer'],8,2);
assert.equal(later.length, 8); assert.equal(later.filter(x=>x.id==='elite').length,1); assert.equal(later.filter(x=>x.id==='healer').length,1); assert(later.some(x=>x.id==='bomber'), 'later stages still allow bomber');

const rushScene = makeScene(); const rush = new StageSystem(rushScene); rush.startRush('boss1'); const oldRandom = Math.random; Math.random = () => 0.999; rush.updateRush(100); Math.random = oldRandom;
assert.equal(rush.waveQueue.length, 10, 'boss1 rush is exactly 10 and random-proof'); assertNoRanged(idsOf(rush.waveQueue), 'boss1 rush has no ranged');
rush.drainWaveQueue(9999); assert.equal(rushScene.enemies.length, 10); rush.updateRush(10000); assert.equal(rush.flowState, LevelFlowStates.BOSS_RUSH, 'boss does not spawn while rush enemies live');
rushScene.enemies.forEach(e => { e.isDefeated = true; }); rush.updateRush(10001); assert.equal(rush.flowState, LevelFlowStates.BOSS_FIGHT); assert.equal(rushScene.enemies.filter(e=>e.isBoss).length, 1); rush.updateRush(10002); assert.equal(rushScene.enemies.filter(e=>e.isBoss).length, 1, 'same boss spawns once');

const spacingScene = makeScene(); const spacingStage = new StageSystem(spacingScene); const spaced = spacingStage.assignWaveSpawnXs([{id:'grunt'},{id:'elite'},{id:'charger'}]);
assert.equal(new Set(spaced.map(i=>i.x)).size, 3, 'three scheduled monsters do not share one spawn X');
for(let i=1;i<spaced.length;i+=1){ const prev=ENEMIES[spaced[i-1].id], cur=ENEMIES[spaced[i].id]; const min=(prev.bodyWidth||prev.width)/2+(cur.bodyWidth||cur.width)/2+10; assert(spaced[i].x-spaced[i-1].x>=min, `spawn spacing ${i} uses half widths plus safety`); }
spaced.forEach(item => { const cfg=ENEMIES[item.id]; const half=(cfg.bodyWidth||cfg.width)/2; assert(item.x>=half+8 && item.x<=BALANCE.stageWorldWidth-half-8, `${item.id} stays inside world`); });
spacingStage.groupIndex = 2; spacingStage.queueGroupWave(0); assert.equal(new Set(spacingStage.waveQueue.map(i=>i.x)).size, spacingStage.waveQueue.length, 'formal wave queue stores distinct spawn X values');


const overlapScene = makeScene(); overlapScene.enemyBehaviors = new EnemyBehaviorManager(overlapScene); const overlapStage = new StageSystem(overlapScene); overlapScene.stageSystem = overlapStage;
const a = overlapStage.spawn('grunt', 600), b = overlapStage.spawn('grunt', 600), c = overlapStage.spawn('grunt', 600); a.nextAttackAt = 0; b.nextAttackAt = 100; c.nextAttackAt = 200; [a,b,c].forEach(e => { e.x = 500; e.body.reset(500, e.y); });
for(let t=0;t<5;t+=1) overlapStage.update(t*16);
assert.deepEqual([a.x,b.x,c.x], [500,500,500], 'overlapping monsters are not separated during updates'); assert.deepEqual([a.hp,b.hp,c.hp], [a.maxHp,b.maxHp,c.maxHp], 'overlapping monsters keep independent hp'); assert.deepEqual([a.nextAttackAt,b.nextAttackAt,c.nextAttackAt], [0,100,200], 'overlapping monsters keep independent attack timers');
const kbCombat = new CombatSystem(overlapScene); a.x=500; b.x=500; c.x=500; kbCombat.applyKnockback(a, {knockback:72}); assert(a.isKnockbackActive || a.x > 500, 'hit monster starts knockback'); assert.equal(b.x, 500); assert.equal(c.x, 500);
const overlapSpaced = overlapStage.assignWaveSpawnXs([{id:'grunt'},{id:'grunt'},{id:'grunt'}]); assert.equal(new Set(overlapSpaced.map(i=>i.x)).size, 3, 'same wave keeps initial spawn offsets');

assert.equal(BALANCE.enemyPopulation.waveClearDelayMs, 1500);
const waitScene = makeScene(); const waitStage = new StageSystem(waitScene); waitStage.waveSpawnFinished=true; waitStage.currentWave=1; waitStage.waveState='fighting'; waitStage.updateGroup(0); assert.equal(waitStage.waveState, 'waitingNextWave'); waitStage.updateGroup(1499); assert.equal(waitStage.currentWave, 1); waitStage.updateGroup(1500); assert.equal(waitStage.currentWave, 2);

Object.values(WEAPONS).forEach(w => assert(Number.isFinite(w.knockback) && w.knockback >= 0, `${w.id} has valid knockback`)); assert.equal(WEAPONS.short_sword.knockback, 72); assert.equal(WEAPONS.short_sword.attackRange, 88); assert.equal(WEAPONS.short_sword.attackRange, Math.round(125*0.7));
const combatScene = makeScene(); const combat = new CombatSystem(combatScene); let seenMeta; combat.damageEnemy = (_enemy,_damage,meta) => { seenMeta=meta; return true; }; const enemy = { active:true, isDefeated:false, body:{}, x:300, y:850, hp:10, width:74 }; combatScene.playerData.attack=1; combat.performDefaultAttack(enemy, WEAPONS.short_sword); assert.equal(seenMeta.knockback, WEAPONS.short_sword.knockback, 'normal attack reads weapon config knockback');
assert.equal(SKILLS.sword_wave.levels[5].knockback, 26, 'skill knockback is not globally doubled'); assert.equal(SKILLS.spinning_blade.levels[8].knockback, 18, 'skill knockback is unchanged');
const applyText = CombatSystem.prototype.applyKnockback.toString(); assert(!/base\s*\*\s*2|2\s*\*\s*base|knockback\s*\*\s*2|2\s*\*\s*knockback/.test(applyText), 'attack knockback logic does not multiply by 2');
console.log('[validate:enemy-population] PASS pre-boss melee-only pools, fixed boss1 rush count, formal spawn spacing, wave delay, weapon knockback config');
