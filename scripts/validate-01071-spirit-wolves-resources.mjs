import assert from 'node:assert/strict';
import { SpiritWolvesSkill, SPIRIT_WOLVES_ID } from '../src/skills/handlers/SpiritWolvesSkill.js';

let originalCalls=0;
const system={
  nextCastId:1,
  passiveState:{},
  passiveUpdaters:[],
  cooldowns:new Map(),
  scene:{events:{once(){},off(){}},targeting:{valid(){return false;},all(){return[];}},player:{x:0,y:0},playerData:{hp:1},getGameplayTime(){return 0;}},
  createCastContext(skillId){ originalCalls+=1; return {skillId,normal:true}; }
};
const off=SpiritWolvesSkill.bind(system);
const first=system.createCastContext(SPIRIT_WOLVES_ID);
const second=system.createCastContext(SPIRIT_WOLVES_ID);
assert.equal(SpiritWolvesSkill.independentSummonCast,true);
assert.equal(originalCalls,0,'wolf summons use their independent cast context');
for(const context of [first,second]) assert.deepEqual({damageMultiplier:context.damageMultiplier,baseDamageMultiplierWithoutProfession:context.baseDamageMultiplierWithoutProfession,professionMultiplier:context.professionMultiplier,consumedBattleMark:context.consumedBattleMark,independentSummonCast:context.independentSummonCast},{damageMultiplier:1,baseDamageMultiplierWithoutProfession:1,professionMultiplier:1,consumedBattleMark:false,independentSummonCast:true});
const normal=system.createCastContext('fireball');
assert.equal(originalCalls,1,'ordinary active skills keep the normal context');
assert.equal(normal.normal,true);
assert.equal(system.independentSummonCastSkillIds.has(SPIRIT_WOLVES_ID),true);
off();
assert.equal(system.independentSummonCastSkillIds.has(SPIRIT_WOLVES_ID),false,'unbind removes the wolf registration');
console.log('v0.10.71 spirit wolf cast context validation passed.');
