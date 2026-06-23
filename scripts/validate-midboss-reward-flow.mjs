import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
global.window={cordova:undefined, navigator:{userAgent:''}, addEventListener(){}, removeEventListener(){}}; global.document={documentElement:{style:{}}, createElement(){return {getContext(){return new Proxy({},{get(_,k){ if(k==='getImageData') return ()=>({data:[0,0,0,0]}); return ()=>{}; }});}, style:{}};}, addEventListener(){}, removeEventListener(){}}; Object.defineProperty(globalThis,'navigator',{value:global.window.navigator, configurable:true}); global.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } }; global.HTMLCanvasElement=class {};

const combatSource=readFileSync(new URL('../src/systems/CombatSystem.js', import.meta.url),'utf8');
const gameSource=readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url),'utf8');
assert.match(combatSource, /flowBossType==='boss1'\)\{ s\.queueArtifactReward\?\.\(enemy,\{ afterBoss:'boss1' \}\)/, 'static: Boss 1 queues artifact reward');
assert.match(combatSource, /flowBossType==='boss2'\) s\.startMidBossPostFightFlow\?\.\(\)/, 'static: Boss 2 starts profession flow');
assert.match(combatSource, /flowBossType==='boss3'\) s\.finishRun\?\.\(true\)/, 'static: Boss 3 finishes immediately');
assert.doesNotMatch(gameSource, /startBossRewardFlow\(/, 'static: dedicated boss skill reward flow removed from GameScene');
assert.doesNotMatch(gameSource, /rollBossRewardOptions\(/, 'static: GameScene must not roll boss skill rewards');

const { BALANCE, createPlayerRuntime } = await import('../src/config/balance.js');
const { ENEMIES } = await import('../src/config/enemies.js');
const { RunStates } = await import('../src/core/CombatEvents.js');
const { default: CombatSystem } = await import('../src/systems/CombatSystem.js');
const { default: StageSystem } = await import('../src/systems/StageSystem.js');
const { default: ProfessionSystem } = await import('../src/systems/ProfessionSystem.js');
const { onShopClosed } = await import('../src/systems/ShopFlow.js');


const sceneMethods={
  hasBlockingModal(){ return ![RunStates.RUNNING,RunStates.BOSS].includes(this.runState)||this.upgradePanel?.isOpen||this.artifactRewardPanel?.isOpen||this.resultPanel?.isOpen||this.playtestPanel?.isOpen||this.restPanel?.isOpen||this.midBossRewardOpen||this.professionPanel?.isOpen||this.playerInfoPanel?.isOpen||this.shopPanel?.isOpen||!!this.upgradeSystem?.panelOpen; },
  isGameplayPaused(){ return this.hasBlockingModal(); },
  getGameplayTime(){ return this.modalPausedAt ?? this.time.now; },
  beginGameplayPause(){ if(this.modalPausedAt!==null) return; this.modalPausedAt=this.time.now; this.player?.body?.setVelocityX?.(0); this.enemyBehaviors?.pause(); },
  canEndGameplayPause(){ return this.runState!==RunStates.STARTING&&!this.hasBlockingModal(); },
  endGameplayPause(){ if(this.modalPausedAt===null||!this.canEndGameplayPause()) return; this.modalPausedAt=null; this.enemyBehaviors?.resume(); },
  queueArtifactReward(enemy, meta={}){ if(this.pendingArtifactReward||[RunStates.VICTORY,RunStates.DEFEAT].includes(this.runState)) return; this.pendingArtifactReward={ enemyId:enemy.id, enemyName:enemy.name, ...meta }; },
  showArtifactReward(){ if(!this.pendingArtifactReward||[RunStates.VICTORY,RunStates.DEFEAT].includes(this.runState)||this.artifactRewardPanel?.isOpen) return; this.beginGameplayPause(); this.runState=RunStates.REWARD; const options=this.artifactSystem.rollRewardOptions(3); this.artifactRewardPanel.show({ title:'获得一个法宝奖励', options, onConfirm:(o)=>this.claimArtifactReward(o) }); },
  claimArtifactReward(option){ if(!this.pendingArtifactReward) return false; const reward=this.pendingArtifactReward; if(option.type==='fallback') this.artifactSystem.applyFallback(option); else this.artifactSystem.add(option.artifactId); this.pendingArtifactReward=null; this.artifactRewardPanel.hide(); if(reward.afterBoss==='boss2'){ this.midBossFlowStep='complete'; this.midBossRewardOpen=false; this.midBossPostFightFlowStarted=false; this.claimingProfession=false; this.delayedUpgradeUnlockAt=Number.POSITIVE_INFINITY; } if(reward.afterBoss) this.stageSystem?.beginAfterBossReward?.(reward.afterBoss); this.resumeModalFlow(); return true; },
  resumeModalFlow(){ if([RunStates.VICTORY,RunStates.DEFEAT].includes(this.runState)) return; if(this.resultPanel?.isOpen||this.artifactRewardPanel?.isOpen||this.upgradePanel?.isOpen||this.playtestPanel?.isOpen||this.restPanel?.isOpen||this.professionPanel?.isOpen||this.playerInfoPanel?.isOpen||this.shopPanel?.isOpen) return; if(this.midBossPostFightFlowStarted){ if(!this.playerData.professionId||this.midBossFlowStep==='profession'){ this.showProfessionChoice(); return; } this.midBossFlowStep='artifactReward'; this.showActualMidBossReward(); return; } if(this.pendingArtifactReward){ this.showArtifactReward(); return; } if(this.pendingShop){ const reason=this.pendingShop; this.pendingShop=null; this.shopSystem?.open(reason); return; } const activeState=this.enemies?.some(e=>e.isFinalBoss&&!e.isDefeated)?RunStates.BOSS:RunStates.RUNNING; if(this.upgradeSystem?.pending>0){ this.runState=activeState; this.upgradeSystem.panelOpen=false; this.upgradeSystem.maybeShow(); return; } this.runState=activeState; this.endGameplayPause(); },
  showProfessionChoice(){ if(this.playerData.professionId) return false; if(this.playerInfoPanel?.isOpen){ this.midBossFlowStep='profession'; return false; } this.midBossFlowStep='profession'; this.midBossConsumedOneUpgrade=false; this.beginGameplayPause(); this.professionPanel.show((id)=>this.claimProfession(id)); return true; },
  claimProfession(id){ if(this.claimingProfession||this.playerData.professionId) return false; this.claimingProfession=true; const selected=this.professionSystem.selectProfession(id); if(!selected){ this.claimingProfession=false; return false; } return true; },
  onProfessionPanelClosed(){ this.claimingProfession=false; if(this.midBossPostFightFlowStarted) this.midBossFlowStep='levelUps'; this.resumeModalFlow(); },
  startMidBossPostFightFlow(){ if(this.midBossPostFightFlowStarted) return; this.midBossPostFightFlowStarted=true; this.midBossFlowStep='profession'; this.midBossConsumedOneUpgrade=false; this.beginGameplayPause(); this.runState=RunStates.REWARD; this.showProfessionChoice(); },
  showActualMidBossReward(){ if(!this.midBossPostFightFlowStarted||this.midBossRewardOpen||this.artifactRewardPanel?.isOpen) return; this.midBossRewardOpen=true; this.queueArtifactReward({ id:'boss2', name:'铁甲暴君' }, { afterBoss:'boss2' }); this.showArtifactReward(); },
  queueShop(reason){ if(this.pendingShop||[RunStates.VICTORY,RunStates.DEFEAT].includes(this.runState)) return; if(this.shopSystem?.openedReasons?.has(reason)) return; this.pendingShop=reason; this.resumeModalFlow(); }
};

let now=0;
const display=(x=0,y=0,w=10,h=10)=>({ x,y,width:w,height:h,active:true,alpha:1, setStrokeStyle(){return this;}, setDepth(){return this;}, setOrigin(){return this;}, setFillStyle(){return this;}, setScale(){return this;}, setPosition(x2,y2){this.x=x2; this.y=y2; return this;}, setDisplaySize(w2,h2){this.displayWidth=w2; this.displayHeight=h2; return this;}, destroy(){this.active=false;}, removeAllListeners(){return this;}, disableInteractive(){return this;} });
const panel=()=>({ isOpen:false, show(...args){ this.isOpen=true; const cfg=args[0]; this.onConfirm=typeof cfg==='object' ? cfg.onConfirm : args[2]; this.title=typeof cfg==='object' ? cfg.title : args[0]; }, hide(){ this.isOpen=false; } });
function makeScene(){
  const scene={
    balance:BALANCE, scale:{height:1280}, time:{get now(){return now;}}, player:createPlayerRuntime(), playerData:createPlayerRuntime(), enemies:[], killCount:0,
    runState:RunStates.RUNNING, pendingArtifactReward:null, pendingShop:null, modalPausedAt:null, midBossRewardOpen:false, midBossPostFightFlowStarted:false, midBossFlowStep:'complete', claimingProfession:false, delayedUpgradeUnlockAt:0,
    cameras:{main:{scrollX:0,width:720,worldView:{right:720},setBounds(x,y,w,h){this.bounds={x,y,w,h};}}},
    physics:{world:{setBounds(x,y,w,h){this.bounds={x,y,w,h};}}, add:{existing(obj){ obj.body={ width:obj.width, height:obj.height, velocity:{x:0}, enable:true, setAllowGravity(){return this;}, setImmovable(){return this;}, setSize(w,h){this.width=w; this.height=h; return this;}, setOffset(){return this;}, setVelocityX(v){this.velocity.x=v; obj.velocityX=v; return this;}, reset(x,y){obj.x=x; obj.y=y; this.velocity.x=0;} }; }}},
    add:{ rectangle(x,y,w,h){return display(x,y,w,h);}, text(x,y){return display(x,y,0,0);}, circle(x,y,r){return display(x,y,r*2,r*2);}, triangle(x,y){return display(x,y,40,40);}, line(){return display();} },
    tweens:{add(cfg){ cfg?.onComplete?.(); }}, hud:{setStage(){},setStatus(){},update(){}}, playerHealthBar:{update(){}}, eventBus:{emit(){}, on(){return ()=>{};}}, runStats:{endMidBossFight(){}, startMidBossFight(){}, setProfession(){}}, statusEffects:{clearTarget(){}}, professionWeaponView:{refresh(){this.refreshed=true;}, clear(){}},
    enemyBehaviors:{attach(){}, pause(){}, resume(){}, shiftTimers(){}, update(){}, destroyEnemy(){}},
    artifactSystem:{ rollRewardOptions(){return [{type:'new', id:'artifact_test', artifactId:'blood_jade', title:'血玉'}];}, add(id){ scene.playerData.artifacts.push({id}); return true;}, applyFallback(){} },
    upgradeSystem:{ pending:0, panelOpen:false, gainExperience(){}, maybeShow(){ if(this.pending>0 && !(scene.delayedUpgradeUnlockAt && scene.time.now<scene.delayedUpgradeUnlockAt)){ scene.upgradePanel.isOpen=true; this.panelOpen=true; } } },
    upgradePanel:panel(), artifactRewardPanel:panel(), professionPanel:{...panel(), show(cb){this.isOpen=true; this.onChoose=cb;}}, shopPanel:{isOpen:false}, shopSystem:{ openedReasons:new Set(), open(reason){ this.openedReasons.add(reason); this.currentShopReason=reason; scene.beginGameplayPause(); scene.shopPanel.isOpen=true; scene.openedShops.push(reason); return true; } }, openedShops:[], enteredPhases:[], finished:null,
    floatText(){}, getGameplayTime:sceneMethods.getGameplayTime, hasBlockingModal:sceneMethods.hasBlockingModal, isGameplayPaused:sceneMethods.isGameplayPaused, beginGameplayPause:sceneMethods.beginGameplayPause, endGameplayPause:sceneMethods.endGameplayPause, canEndGameplayPause:sceneMethods.canEndGameplayPause,
    queueArtifactReward:sceneMethods.queueArtifactReward, showArtifactReward:sceneMethods.showArtifactReward, claimArtifactReward:sceneMethods.claimArtifactReward, resumeModalFlow:sceneMethods.resumeModalFlow,
    showProfessionChoice:sceneMethods.showProfessionChoice, claimProfession:sceneMethods.claimProfession, onProfessionPanelClosed:sceneMethods.onProfessionPanelClosed, startMidBossPostFightFlow:sceneMethods.startMidBossPostFightFlow, showActualMidBossReward:sceneMethods.showActualMidBossReward,
    queueShop:sceneMethods.queueShop, onShopClosed(reason){ scene.shopPanel.isOpen=false; return onShopClosed(scene, reason); }, finishRun(won){ this.finished=won; this.runState=won?RunStates.VICTORY:RunStates.DEFEAT; }
  };
  scene.player.x=220; scene.player.y=850; scene.professionSystem=new ProfessionSystem(scene); scene.combatSystem=new CombatSystem(scene); scene.stageSystem=new StageSystem(scene); const originalEnter=scene.stageSystem.enterPhase.bind(scene.stageSystem); scene.stageSystem.enterPhase=(i)=>{ originalEnter(i); scene.enteredPhases.push(scene.stageSystem.phase()?.id); };
  scene.targeting={ valid(){return true;}, isEnemyFullyInsideViewport(){return true;}, all(){return scene.enemies.filter(e=>!e.isDefeated);} };
  scene.stageSystem.start();
  return scene;
}
const bossEnemy=(id)=>({ ...ENEMIES[id], enemyId:id, id, name:ENEMIES[id].name, isBoss:true, isMidBoss:id==='mid_boss', isFinalBoss:id==='boss', isDefeated:false, active:true, hp:0, xp:ENEMIES[id].xp, body:{enable:true}, destroy(){this.active=false;} });

// Boss 1 real flow: death -> artifact -> mid, no profession/shop.
let scene=makeScene(); scene.stageSystem.enterPhaseById('boss1'); scene.stageSystem.waveQueue=[]; scene.enemies=[bossEnemy('berserker_boss')]; scene.combatSystem.killEnemy(scene.enemies[0]);
assert.equal(scene.pendingArtifactReward?.afterBoss, 'boss1');
assert.equal(scene.artifactRewardPanel.isOpen, true, 'Boss 1 opens artifact panel');
assert.equal(scene.professionPanel.isOpen, false, 'Boss 1 does not open profession panel');
assert.deepEqual(scene.openedShops, [], 'Boss 1 does not open shop');
scene.artifactRewardPanel.onConfirm({type:'new', artifactId:'blood_jade'});
assert.equal(scene.stageSystem.phase().id, 'mid', 'Boss 1 artifact claim enters mid phase');
assert.deepEqual(scene.openedShops, [], 'Boss 1 flow still has no shop after artifact');

// Boss 2 real flow: profession -> artifact -> one pre-shop wave -> only second shop -> late.
scene=makeScene(); scene.upgradeSystem.pending=2; scene.stageSystem.enterPhaseById('boss2'); scene.stageSystem.waveQueue=[]; scene.enemies=[bossEnemy('mid_boss')]; scene.combatSystem.killEnemy(scene.enemies[0]);
assert.equal(scene.professionPanel.isOpen, true, 'Boss 2 opens profession first');
assert.equal(scene.artifactRewardPanel.isOpen, false, 'Boss 2 artifact does not open before profession');
assert.notEqual(scene.stageSystem.phase().id, 'postBoss2Shop', 'unselected profession cannot advance phase');
assert.equal(scene.upgradePanel.isOpen, false, 'pending level-up does not preempt profession panel');
scene.professionPanel.onChoose('mage'); scene.professionPanel.isOpen=false; scene.onProfessionPanelClosed();
assert.equal(scene.playerData.professionId, 'mage');
assert.equal(scene.professionSystem.currentConfig().professionWeaponId, 'forbidden_book');
assert.equal(scene.professionSystem.currentAttackProfile().id, 'arcane_bolt');
assert.equal(scene.artifactRewardPanel.isOpen, true, 'profession close opens artifact panel');
assert.equal(scene.stageSystem.phase().id, 'boss2', 'artifact confirmation is required before pre-shop wave');
assert.equal(scene.stageSystem.waveQueue.length, 0, 'no pre-shop monsters before artifact confirmation');
scene.artifactRewardPanel.onConfirm({type:'new', artifactId:'blood_jade'});
assert.equal(scene.stageSystem.phase().id, 'postBoss2Shop');
assert.equal(scene.enteredPhases.filter(id=>id==='postBoss2Shop').length, 1, 'postBoss2Shop entered once');
assert.equal(scene.upgradePanel.isOpen, false, 'pending level-up stays deferred during pre-shop wave');
now=1000; scene.stageSystem.maintainPopulation(now); assert.ok(scene.stageSystem.waveQueue.length>0, 'pre-shop wave queued after artifact');
const waveIndexOnce=scene.stageSystem.waveIndex; scene.stageSystem.maintainPopulation(now+1); assert.equal(scene.stageSystem.waveIndex, waveIndexOnce, 'pre-shop wave is not queued twice while pending');
while(scene.stageSystem.waveQueue.length){ now=scene.stageSystem.waveQueue[0].at; scene.stageSystem.maintainPopulation(now); }
assert.equal(scene.stageSystem.waveSpawnFinished, true, 'pre-shop wave fully spawned');
scene.enemies=[]; now+=1; scene.stageSystem.maintainPopulation(now);
assert.deepEqual(scene.openedShops, ['second'], 'clearing pre-shop wave opens exactly one second shop');
assert.equal(scene.shopSystem.openedReasons.has('first'), false, 'first shop is not opened');
assert.equal(scene.runState, RunStates.RUNNING, 'flow is not stuck in REWARD after shop opens');
scene.onShopClosed('second');
assert.equal(scene.stageSystem.phase().id, 'late', 'second shop close enters late');
assert.equal(scene.modalPausedAt, null, 'modal pause is released after shop close');
assert.equal(scene.runState, RunStates.RUNNING, 'flow remains running after shop close');

// Boss 3 real flow: death -> immediate victory only.
scene=makeScene(); scene.stageSystem.enterPhaseById('boss3'); scene.stageSystem.waveQueue=[]; scene.enemies=[bossEnemy('boss')]; scene.combatSystem.killEnemy(scene.enemies[0]);
assert.equal(scene.finished, true, 'Boss 3 calls victory settlement');
assert.equal(scene.artifactRewardPanel.isOpen, false, 'Boss 3 does not open artifact');
assert.equal(scene.professionPanel.isOpen, false, 'Boss 3 does not open profession');
assert.deepEqual(scene.openedShops, [], 'Boss 3 does not open shop');

console.log('[validate:midboss-reward-flow] PASS real Boss 1/Boss 2/Boss 3 reward and shop flows');
