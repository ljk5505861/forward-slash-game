import assert from 'node:assert/strict';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import UpgradeSystem from '../src/systems/UpgradeSystem.js';
import { normalSkillRarityWeights, rollNormalSkillCandidates } from '../src/config/normalSkillRewards.js';
import { createWeightedCandidates } from '../src/utils/rewardWeighting.js';
const seeded=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const make=(level,skills=[],runMode='normal')=>new UpgradeSystem({runMode,playerData:{level,skills,artifacts:[],professionId:null}});
const expected=[[70,25,5,0,0,0],[45,30,20,5,0,0],[25,30,30,15,0,0],[15,20,30,25,7,3],[10,15,25,30,12,8]];
for(const [level,index] of [[1,0],[3,0],[4,1],[6,1],[7,2],[9,2],[10,3],[12,3],[13,4],[99,4]]) assert.deepEqual(Object.values(normalSkillRarityWeights(level)),expected[index]);
for(const level of [undefined,NaN,-1]) assert.deepEqual(Object.values(normalSkillRarityWeights(level)),expected[0]);
for(const level of [1,4,7,10,13]){
 const sys=make(level),random=seeded(100+level),counts=Object.fromEntries(Object.keys(normalSkillRarityWeights(level)).map(k=>[k,0]));
 for(let i=0;i<15000;i++){
  const options=sys.rollOptions({random});assert.equal(options.length,3);assert.equal(new Set(options.map(o=>o.skillId)).size,3);
  for(const o of options) assert(normalSkillRarityWeights(level)[SKILLS[o.skillId].rarity]>0);
  counts[SKILLS[options[0].skillId].rarity]++;
 }
 for(const [rarity,weight] of Object.entries(normalSkillRarityWeights(level))) assert(Math.abs(counts[rarity]/15000-weight/100)<0.016,`${level} ${rarity} distribution`);
 console.log('level',level,'first-slot percent',Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,+(v/150).toFixed(2)])));
}
const owned=Object.values(SKILLS).filter(s=>['MYTHIC','LEGENDARY'].includes(s.rarity)).slice(0,6).map(s=>({id:s.id,level:1}));
for(let i=1;i<=200;i++){
 const options=make(1,owned).rollOptions({random:seeded(i)});
 assert(options.some(o=>o.type==='skillLevel'),'full slots retain upgrades even when owned rarity is locked');
 assert.equal(options.length,3);
 for(const o of options) if(o.type==='skillLevel') assert.equal(o.nextLevel,2);else assert(normalSkillRarityWeights(1)[SKILLS[o.skillId].rarity]>0);
}
const allMax=Object.values(SKILLS).map(s=>({id:s.id,level:s.maxLevel}));assert.deepEqual(make(1,allMax).rollOptions(),[]);
const fresh=Object.values(SKILLS).filter(s=>s.rarity==='COMMON').slice(0,2).map(s=>({type:'newSkill',skillId:s.id,weight:6}));
assert.equal(rollNormalSkillCandidates(fresh,13,{random:seeded(1)}).length,2,'exhausted pool returns no duplicates');
const red=Object.values(SKILLS).find(s=>s.rarity==='MYTHIC');
assert.deepEqual(rollNormalSkillCandidates([{type:'newSkill',skillId:red.id,weight:6}],1),[],'never use locked rarities as fallback');
// Test mode preserves the previous weighted draw exactly, including RNG usage.
for(const level of [1,13]) for(let seed=1;seed<=100;seed++){
 const sys=make(level,[],'test'),context=sys.buildBiasContext();
 const candidates=Object.values(SKILLS).map(skill=>sys.weightSkillOption({type:'newSkill',id:`new_${skill.id}`,title:`获得：${skill.name}`,skillId:skill.id,nextLevel:1},skill,6,context));
 assert.deepEqual(sys.rollOptions({random:seeded(seed)}),createWeightedCandidates(candidates,{count:3,random:seeded(seed),uniqueKey:o=>o.skillId}));
}
console.log('normal rarity progression and test-mode isolation passed');
