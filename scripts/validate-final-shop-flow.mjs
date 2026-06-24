import assert from 'node:assert/strict';
import { onShopClosed } from '../src/systems/ShopFlow.js';

const makeScene=()=>({
  runState:'RUNNING',
  pendingShop:'second',
  delayedUpgradeUnlockAt:123,
  stageSystem:{enterPhaseById(){throw new Error('legacy enterPhaseById must not be called');}},
  endGameplayPause(){this.unpaused=true;}
});

let scene=makeScene();
assert.equal(onShopClosed(scene,'second'),true);
assert.equal(scene.pendingShop,null);
assert.equal(scene.runState,'RUNNING');
assert.equal(scene.delayedUpgradeUnlockAt,0);
assert.equal(scene.unpaused,true);

scene=makeScene();
assert.equal(onShopClosed(scene,'first'),false);
assert.equal(scene.pendingShop,null);
assert.equal(scene.unpaused,true);

console.log('[validate:final-shop-flow] PASS shop helper clears pause state without calling removed phase APIs');
