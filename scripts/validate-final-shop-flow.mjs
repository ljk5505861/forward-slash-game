import assert from 'node:assert/strict';
import { onShopClosed } from '../src/systems/ShopFlow.js';
import { RunStates } from '../src/core/CombatEvents.js';

const makeScene=()=>{ const s={ runState:RunStates.RUNNING, pendingShop:null, entered:[], endGameplayPause(){ this.unpaused=true; } }; s.stageSystem={ enterPhaseById(id){ this.phaseId=id; s.entered.push(id); return true; } }; return s; };
let scene=makeScene(); scene.pendingShop='first'; assert.equal(onShopClosed(scene,'first'),true); assert.deepEqual(scene.entered,['mid']); assert.equal(scene.unpaused,true);
scene=makeScene(); scene.pendingShop='second'; assert.equal(onShopClosed(scene,'second'),true); assert.deepEqual(scene.entered,['late'], 'second shop must continue third normal segment, not final boss');
scene=makeScene(); scene.runState=RunStates.VICTORY; assert.equal(onShopClosed(scene,'second'),false); assert.deepEqual(scene.entered,[]);
console.log('[validate:final-shop-flow] PASS shop close resumes mid/late combat segments without direct final boss jump');
