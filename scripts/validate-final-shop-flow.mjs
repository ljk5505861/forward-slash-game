import { RunStates } from '../src/core/CombatEvents.js';
import { onShopClosed } from '../src/systems/ShopFlow.js';

const makeScene = () => {
  const scene = {
    runState: RunStates.RUNNING,
    pendingShop: null,
    modalPausedAt: 1234,
    enemies: [],
    shopPanel: { isOpen: false },
    resultPanel: { isOpen: false }, artifactRewardPanel: { isOpen: false }, upgradePanel: { isOpen: false }, playtestPanel: { isOpen: false }, restPanel: { isOpen: false }, professionPanel: { isOpen: false }, playerInfoPanel: { isOpen: false },
    midBossRewardOpen: false,
    upgradeSystem: { panelOpen: false, pending: 0, maybeShow(){ throw new Error('unexpected upgrade panel'); } },
    stageSystem: { phaseId: 'rest', enterPhaseById(id){ this.phaseId = id; if (id === 'finalBoss') { scene.runState = RunStates.BOSS; scene.enemies.push({ isFinalBoss:true, isBoss:true, isDefeated:false }, { isBoss:false, isDefeated:false }, { isBoss:false, isDefeated:false }); return true; } return false; }, phase(){ return { id:this.phaseId }; } },
    hasBlockingModal(){ return ![RunStates.RUNNING, RunStates.BOSS].includes(this.runState)||this.shopPanel?.isOpen||this.resultPanel?.isOpen||this.artifactRewardPanel?.isOpen||this.upgradePanel?.isOpen||this.playtestPanel?.isOpen||this.restPanel?.isOpen||this.professionPanel?.isOpen||this.playerInfoPanel?.isOpen||this.midBossRewardOpen||!!this.upgradeSystem?.panelOpen; },
    canEndGameplayPause(){ return this.runState!==RunStates.STARTING&&!this.hasBlockingModal(); },
    endGameplayPause(){ if(this.modalPausedAt!==null&&this.canEndGameplayPause()) this.modalPausedAt=null; },
    resumeModalFlow(){ this.resumed = true; if(this.modalPausedAt!==null) this.modalPausedAt=null; },
    onShopClosed(reason){ return onShopClosed(this, reason); },
  };
  scene.shopSystem = { currentShopReason:null, openedReasons:new Set(), reset(){ this.currentShopReason=null; this.openedReasons.clear(); } };
  return scene;
};

const second = makeScene();
second.shopSystem.currentShopReason = 'second';
second.shopPanel.isOpen = false;
second.onShopClosed('second');
if (second.shopPanel.isOpen) throw new Error('second shop should be closed');
if (second.pendingShop !== null) throw new Error('pendingShop should be cleared');
if (second.stageSystem.phase().id !== 'finalBoss') throw new Error('second shop should enter finalBoss phase');
if (!second.enemies.some(e => e.isFinalBoss && !e.isDefeated)) throw new Error('final boss should be generated');
if (second.enemies.filter(e => !e.isBoss && !e.isDefeated).length <= 0) throw new Error('final boss minions should be generated');
if (second.runState !== RunStates.BOSS) throw new Error('runState should be BOSS');
if (second.modalPausedAt !== null) throw new Error('modal pause should be released');
if (second.hasBlockingModal()) throw new Error('second shop flow should not be blocked');

const first = makeScene();
let resumed = false;
first.resumeModalFlow = () => { resumed = true; };
first.onShopClosed('first');
if (!resumed) throw new Error('first shop should resume normal modal flow');
if (first.stageSystem.phase().id === 'finalBoss') throw new Error('first shop must not enter finalBoss');

const cleanup = makeScene();
cleanup.runState = RunStates.VICTORY;
cleanup.onShopClosed('second');
if (cleanup.stageSystem.phase().id === 'finalBoss') throw new Error('closed shop during result must not start finalBoss');

console.log('[validate:final-shop-flow] PASS second shop closes into final boss, first shop resumes, result cleanup is inert');
