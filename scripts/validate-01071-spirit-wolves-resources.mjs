import assert from 'node:assert/strict';
import { SpiritWolvesSkill, SPIRIT_WOLVES_ID } from '../src/skills/handlers/SpiritWolvesSkill.js';

let calls=0;
const original=skillId=>{ calls+=1; return { skillId, normal:true }; };
const system={
  nextCastId:1,
  passiveState:{},
  passiveUpdaters:[],
  cooldowns:new Map(),
  scene:{events:{once(){},off(){}},targeting:{valid(){return false;},all(){return[];}},player:{x:0,y:0},playerData:{hp:1},getGameplayTime(){return 0;}},
  createCastContext:original
};
const off=SpiritWolvesSkill.bind(system);
assert.equal(SpiritWolvesSkill.independentSummonCast,undefined);
assert.equal(system.createCastContext,original);
assert.equal(system.createCastContext(SPIRIT_WOLVES_ID).normal,true);
assert.equal(system.createCastContext(SPIRIT_WOLVES_ID).normal,true);
assert.equal(calls,2);
off();
assert.equal(system.createCastContext,original);
console.log('v0.10.77 spirit wolf normal active cast validation passed.');
