import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import UpgradeSystem from '../src/systems/UpgradeSystem.js';

const makeScene=()=>({
  playerData:{
    skills:[],
    artifacts:[],
    professionId:null,
    upgradesChosen:[]
  }
});

const seededRandom=seed=>()=>{
  seed=(seed*1664525+1013904223)>>>0;
  return seed/4294967296;
};

assert.equal(GAME_VERSION,'0.11.23');
assert.equal(SKILLS.poison_king.rarity,'MYTHIC');
assert.equal(SKILLS.poison_king.ultimateSkill,true);

const system=new UpgradeSystem(makeScene());
assert.equal(
  system.isSkillUnlocked(SKILLS.poison_king),
  true,
  'skills no longer require a prerequisite skill'
);
assert.equal(
  system.isSkillUnlocked(SKILLS.parasitic_gu),
  true,
  'requiredSkillId metadata no longer blocks rewards'
);
assert.equal(SKILLS.lightning_mark.requiredSkillId,undefined,'lightning_mark has no prerequisite');
assert.equal(system.isSkillUnlocked(SKILLS.lightning_mark),true,'lightning_mark is unlocked without lightning_enchant');
assert.equal(SKILLS.lightning_tribulation.requiredSkillId,undefined,'lightning_tribulation has no prerequisite');
assert.equal(SKILLS.lightning_tribulation.rarity,'MYTHIC','lightning tribulation is mythic');
assert.equal(SKILLS.lightning_tribulation.ultimateSkill,true,'lightning tribulation is an ultimate/mythic starting skill');
assert.equal(system.isSkillUnlocked(SKILLS.lightning_tribulation),true,'lightning tribulation is unlocked independently');
assert.equal(SKILLS.spirit_slime.rarity,'RARE','spirit slime is rare');
assert.equal(SKILLS.spirit_slime.requiredSkillId,undefined,'spirit slime has no prerequisite');
assert.equal(system.isSkillUnlocked(SKILLS.spirit_slime),true,'spirit slime is unlocked independently');

const source=fs.readFileSync(
  new URL('../src/systems/UpgradeSystem.js',import.meta.url),
  'utf8'
);
assert.doesNotMatch(
  source,
  /if\s*\(\s*!this\.isSkillUnlocked/,
  'normal reward rolling does not filter by prerequisites'
);
const random=seededRandom(20260627);
const seen=[new Set(),new Set(),new Set()];
for(let i=0;i<10000;i+=1){
  const options=system.rollStartingOptions({random});
  assert.equal(options.length,3);
  assert.equal(new Set(options.map(o=>o.skillId)).size,3);
  options.forEach((option,index)=>{
    assert.equal(option.type,'startingSkill');
    assert.equal(option.nextLevel,1);
    assert(SKILLS[option.skillId]);
    seen[index].add(option.skillId);
  });
}
for(const slot of seen) assert.deepEqual([...slot].sort(),Object.keys(SKILLS).sort(),'each slot can roll every skill, without a fixed rarity');
console.log('validate-01056-open-skill-pool: ok');
