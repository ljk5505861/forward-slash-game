import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RunStates } from '../src/core/CombatEvents.js';

const gameSceneSource = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
const professionPanelSource = readFileSync(new URL('../src/ui/ProfessionPanel.js', import.meta.url), 'utf8');
assert.doesNotMatch(gameSceneSource, /time\.delayedCall\(0,\(\)=>this\.continueAfterProfessionChoice/, 'profession continuation no longer guesses panel close with delayedCall');
assert.match(professionPanelSource, /this\.hide\(\); this\.scene\.continueAfterProfessionChoice\?\.\(\)/, 'profession panel hides before continuing');
assert.match(gameSceneSource, /professionContinuationPending/, 'continuation pending lock exists');
assert.match(gameSceneSource, /professionContinuationStarted/, 'continuation started lock exists');

const makeFlow = (pending = 0) => {
  const flow = {
    debugMode:false,
    runState:RunStates.REWARD,
    modalPausedAt:100,
    midBossPostFightFlowStarted:true,
    midBossRewardOpen:false,
    claimingProfession:true,
    professionContinuationPending:true,
    professionContinuationStarted:false,
    professionPanel:{ isOpen:true },
    upgradePanel:{ isOpen:false, hide(){ this.isOpen=false; } },
    artifactRewardPanel:{ isOpen:false },
    restPanel:{ isOpen:false },
    resultPanel:{ isOpen:false },
    playtestPanel:{ isOpen:false },
    upgradeSystem:{ pending, panelOpen:false, maybeShow(){ this.panelOpen=true; flow.upgradePanel.isOpen=true; } },
    stageSystem:{ phase:null, enterPhaseById(id){ this.phase=id; } },
    enemyBehaviors:{ resumed:false, resume(){ this.resumed=true; }, shiftTimers(){} },
    movementSystem:{ calls:0, update(){ this.calls+=1; } },
    player:{ body:{ velocity:{ x:0 }, setVelocityX(v){ this.velocity.x=v; } } },
    enemies:[],
    profLog(){},
    beginGameplayPause(){ if(this.modalPausedAt===null) this.modalPausedAt=100; },
    hasBlockingModal(){ return ![RunStates.RUNNING, RunStates.BOSS].includes(this.runState) || this.professionPanel.isOpen || this.upgradePanel.isOpen || this.artifactRewardPanel.isOpen || this.restPanel.isOpen || this.resultPanel.isOpen || this.midBossRewardOpen || this.professionContinuationPending || this.upgradeSystem.pending>0 || this.upgradeSystem.panelOpen; },
    canEndGameplayPause(){ return this.runState!==RunStates.STARTING && !this.hasBlockingModal(); },
    endGameplayPause(){ if(this.modalPausedAt===null || !this.canEndGameplayPause()) return; this.modalPausedAt=null; this.enemyBehaviors.resume(); },
    processPendingMidBossLevelUps(){ if(!this.midBossPostFightFlowStarted||this.midBossRewardOpen) return; this.beginGameplayPause(); if(this.upgradeSystem.pending>0){ this.runState=RunStates.RUNNING; this.upgradeSystem.panelOpen=false; this.upgradeSystem.maybeShow(); return; } this.showActualMidBossReward(); },
    continueAfterProfessionChoice(){ if(!this.professionContinuationPending||this.professionContinuationStarted) return; if(this.professionPanel?.isOpen){ this.profLog('profession continuation waiting for panel close'); return; } this.professionContinuationStarted=true; this.profLog('profession panel closed'); if(this.midBossPostFightFlowStarted) this.processPendingMidBossLevelUps(); },
    showActualMidBossReward(){ if(!this.midBossPostFightFlowStarted||this.midBossRewardOpen||this.upgradePanel?.isOpen) return; this.midBossRewardOpen=true; this.beginGameplayPause(); this.runState=RunStates.REWARD; this.upgradePanel.isOpen=true; },
    finishHighQualityReward(){ this.upgradePanel.hide(); this.midBossRewardOpen=false; this.midBossPostFightFlowStarted=false; this.claimingProfession=false; this.professionContinuationPending=false; this.professionContinuationStarted=false; this.runState=RunStates.RUNNING; this.stageSystem.enterPhaseById('late'); this.endGameplayPause(); },
    finishOnePendingUpgrade(){ assert.equal(this.upgradePanel.isOpen, true, 'pending upgrade panel should be open'); this.upgradeSystem.pending=Math.max(0,this.upgradeSystem.pending-1); this.upgradeSystem.panelOpen=false; this.upgradePanel.hide(); if(this.upgradeSystem.pending>0) this.processPendingMidBossLevelUps(); else this.showActualMidBossReward(); },
    nextFrame(){ if(!this.hasBlockingModal()) this.movementSystem.update(); else this.player.body.setVelocityX(0); },
  };
  return flow;
};

const assertFinalRunning = (flow) => {
  assert.equal(flow.runState, RunStates.RUNNING);
  assert.equal(flow.modalPausedAt, null);
  assert.equal(flow.midBossPostFightFlowStarted, false);
  assert.equal(flow.midBossRewardOpen, false);
  assert.equal(flow.claimingProfession, false);
  assert.equal(flow.professionContinuationPending, false);
  assert.equal(flow.professionContinuationStarted, false);
  assert.equal(flow.hasBlockingModal(), false);
  assert.equal(flow.enemyBehaviors.resumed, true);
  flow.nextFrame();
  assert.equal(flow.movementSystem.calls, 1, 'MovementSystem updates on the next unblocked frame');
};

{
  const flow = makeFlow(1);
  flow.continueAfterProfessionChoice();
  assert.equal(flow.professionContinuationPending, true, 'open panel does not lose pending continuation');
  assert.equal(flow.professionContinuationStarted, false, 'open panel does not start continuation');
  assert.equal(flow.upgradePanel.isOpen, false, 'open panel does not start rewards');
  flow.professionPanel.isOpen=false;
  flow.continueAfterProfessionChoice();
  assert.equal(flow.professionContinuationStarted, true, 'closed panel starts continuation');
  assert.equal(flow.upgradePanel.isOpen, true, 'pending upgrade opens after panel close');
}

for (const pending of [0, 1, 3]) {
  const flow = makeFlow(pending);
  flow.professionPanel.isOpen=false;
  flow.continueAfterProfessionChoice();
  let safety=10;
  while(flow.upgradeSystem.pending>0 && safety-->0) flow.finishOnePendingUpgrade();
  assert.equal(flow.midBossRewardOpen, true, `high-quality reward opens after pending=${pending}`);
  flow.finishHighQualityReward();
  assertFinalRunning(flow);
}

{
  const flow = makeFlow(0);
  flow.professionPanel.isOpen=false;
  flow.continueAfterProfessionChoice();
  flow.continueAfterProfessionChoice();
  assert.equal(flow.midBossRewardOpen, true, 'duplicate continuation does not duplicate reward state');
}

console.log('profession flow validation passed');
