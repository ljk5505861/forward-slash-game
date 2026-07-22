import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import UpgradeSystem, { ensureFullSlotUpgradeGuarantee } from '../src/systems/UpgradeSystem.js';
import { MAX_SKILL_SLOTS } from '../src/systems/SkillSystem.js';

const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const skillIds=Object.keys(SKILLS);
const seeded=seed=>()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/0x100000000; };
const systemFor=skills=>new UpgradeSystem({playerData:{skills,artifacts:[],professionId:null}});
const assertUnique=options=>assert.equal(new Set(options.map(option=>option.skillId)).size,options.length,'options use unique skill IDs');
const assertValidLevels=(options,owned)=>options.filter(option=>option.type==='skillLevel').forEach(option=>{
  const current=owned.find(skill=>skill.id===option.skillId);
  assert(current,'skill upgrades only target owned skills');
  assert.equal(option.nextLevel,current.level+1,'skill upgrade advances exactly one level');
  assert(option.nextLevel<=SKILLS[option.skillId].maxLevel,'skill upgrade does not exceed max level');
});

assert.equal(GAME_VERSION,'0.11.5');
assert.equal(pkg.version,'0.11.5');
assert.equal(Object.keys(SKILLS).length,41);
assert.equal(MAX_SKILL_SLOTS,6);

const fullWithUpgrades=skillIds.slice(0,MAX_SKILL_SLOTS).map((id,index)=>({id,level:index===0?1:Math.min(2,SKILLS[id].maxLevel-1)}));
let sawNewSkill=false;
for(const seed of [1,2,3,4,5,99,777]){
  const options=systemFor(fullWithUpgrades).rollOptions({random:seeded(seed)});
  assert.equal(options.length,3,'full slots still return three options');
  assertUnique(options);
  assert(options.some(option=>option.type==='skillLevel'),'full slots with legal upgrades always include an upgrade');
  assertValidLevels(options,fullWithUpgrades);
  sawNewSkill ||= options.some(option=>option.type==='newSkill');
}
assert(sawNewSkill,'full-slot options retain new-skill replacement entry points');

const oneUpgradable=skillIds.slice(0,MAX_SKILL_SLOTS).map((id,index)=>({id,level:index===0?Math.max(1,SKILLS[id].maxLevel-1):SKILLS[id].maxLevel}));
for(const seed of [10,20,30,40,50,60]){
  const options=systemFor(oneUpgradable).rollOptions({random:seeded(seed)});
  assert.equal(options.length,3,'one-upgrade full slots still return three options');
  assertUnique(options);
  const upgrades=options.filter(option=>option.type==='skillLevel');
  assert.deepEqual(upgrades.map(option=>option.skillId),[oneUpgradable[0].id],'the only legal upgrade is guaranteed');
  assertValidLevels(options,oneUpgradable);
}

const allMaxed=skillIds.slice(0,MAX_SKILL_SLOTS).map(id=>({id,level:SKILLS[id].maxLevel}));
for(const seed of [101,202,303]){
  const options=systemFor(allMaxed).rollOptions({random:seeded(seed)});
  assert.equal(options.length,3,'all-max full slots retain three new-skill choices');
  assertUnique(options);
  assert(options.every(option=>option.type==='newSkill'),'all-max full slots do not generate fake upgrades');
}

const unchanged=[{type:'newSkill',skillId:'a'},{type:'newSkill',skillId:'b'}];
assert.strictEqual(ensureFullSlotUpgradeGuarantee({picked:unchanged,candidates:[...unchanged,{type:'skillLevel',skillId:'owned',weight:8}],fullSlots:false,random:()=>0}),unchanged,'non-full slots keep the original selection unchanged');

const fullMeta=systemFor(fullWithUpgrades).rollOptions({random:()=>0.999999});
assert(fullMeta.some(option=>option.type==='skillLevel'&&option.baseWeight===8),'full-slot upgrade base weight remains 8');
assert(fullMeta.some(option=>option.type==='newSkill'&&option.baseWeight===3),'full-slot new-skill base weight remains 3');
const partialMeta=systemFor([{id:skillIds[0],level:1}]).rollOptions({random:()=>0.999999});
assert(partialMeta.every(option=>option.type==='newSkill'&&option.baseWeight===6),'non-full-slot new-skill base weight remains 6');

console.log('v0.11.5 full-slot upgrade guarantee validation passed.');
