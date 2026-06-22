import { RunStates } from '../core/CombatEvents.js';

export function onShopClosed(scene, reason){
  if([RunStates.VICTORY,RunStates.DEFEAT].includes(scene.runState)) return false;
  scene.pendingShop=null;
  if(reason==='second'){
    scene.runState=RunStates.RUNNING;
    scene.stageSystem?.enterPhaseById('finalBoss');
    scene.endGameplayPause?.();
    return true;
  }
  scene.resumeModalFlow?.();
  return true;
}
