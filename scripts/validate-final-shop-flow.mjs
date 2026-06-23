import assert from 'node:assert/strict';
import { onShopClosed } from '../src/systems/ShopFlow.js';
const makeScene=()=>({ runState:'running', pendingShop:'second', entered:[], stageSystem:{enterPhaseById(id){this.scene?.entered?.push(id);}}, endGameplayPause(){this.unpaused=true;} });
let scene=makeScene(); scene.stageSystem.scene=scene; assert.equal(onShopClosed(scene,'second'),true); assert.deepEqual(scene.entered,['late'], 'only shop must continue third normal segment');
scene=makeScene(); scene.stageSystem.scene=scene; assert.equal(onShopClosed(scene,'first'),false); assert.deepEqual(scene.entered,[], 'first shop is removed');
console.log('[validate:final-shop-flow] PASS only Boss 2 shop closes into late combat segment');
