import { RunStates } from '../core/CombatEvents.js';

export function onShopClosed(scene, reason){
  if([RunStates.VICTORY,RunStates.DEFEAT].includes(scene.runState)) return false;
  scene.pendingShop=null;
  scene.runState=RunStates.RUNNING;
  scene.delayedUpgradeUnlockAt=0;
  if(reason==='second') scene.stageSystem?.enterPhaseById('late');
  scene.endGameplayPause?.();
  return reason==='second';
}
