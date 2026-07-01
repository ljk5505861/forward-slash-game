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

assert.equal(GAME_VERSION,'0.10.86');
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

const source=fs.readFileSync(
  new URL('../src/systems/UpgradeSystem.js',import.meta.url),
  'utf8'
);
assert.doesNotMatch(
  source,
  /if\s*\(\s*!this\.isSkillUnlocked/,
  'normal reward rolling does not filter by prerequisites'
);
assert.match(
  source,
  /rarity===['"]MYTHIC['"]\|\|skill\.ultimateSkill/,
  'starting third slot uses the mythic pool'
);

const originalRandom=Math.random;
Math.random=seededRandom(20260627);
try{
  const mythicSeen=new Set();
  const regularSeen=new Set();
  const thirdCounts=new Map();
  const mythicIds=Object.values(SKILLS)
    .filter(skill=>skill.rarity==='MYTHIC'||skill.ultimateSkill)
    .map(skill=>skill.id);
  const regularIds=Object.values(SKILLS)
    .filter(skill=>!mythicIds.includes(skill.id))
    .map(skill=>skill.id);

  for(let i=0;i<4000;i+=1){
    const options=system.rollStartingOptions();
    assert.equal(options.length,3,'starting choice always contains three skills');
    assert.equal(new Set(options.map(option=>option.skillId)).size,3,'starting skills never repeat');
    options.forEach(option=>{
      assert.equal(option.type,'startingSkill');
      assert.equal(option.nextLevel,1,'starting skills are acquired at level 1');
    });

    const first=SKILLS[options[0].skillId];
    const second=SKILLS[options[1].skillId];
    const third=SKILLS[options[2].skillId];
    assert(first&&second&&third);
    assert.equal(
      !!(first.rarity==='MYTHIC'||first.ultimateSkill),
      false,
      'first starting slot is drawn from the non-mythic pool'
    );
    assert.equal(
      !!(second.rarity==='MYTHIC'||second.ultimateSkill),
      false,
      'second starting slot is drawn from the non-mythic pool'
    );
    assert.equal(
      !!(third.rarity==='MYTHIC'||third.ultimateSkill),
      true,
      'third starting option is always mythic'
    );

    regularSeen.add(first.id);
    regularSeen.add(second.id);
    mythicSeen.add(third.id);
    thirdCounts.set(third.id,(thirdCounts.get(third.id)||0)+1);
  }

  assert.deepEqual(
    [...mythicSeen].sort(),
    [...mythicIds].sort(),
    'every mythic skill can appear in the third slot'
  );
  assert.deepEqual(
    [...regularSeen].sort(),
    [...regularIds].sort(),
    'the first two slots can roll every non-mythic skill regardless of old prerequisites'
  );
  assert(mythicSeen.has('poison_king'),'poison king can appear in the fixed mythic slot');
  assert(mythicSeen.has('lightning_tribulation'),'lightning tribulation can appear in the fixed mythic slot');
  assert(regularSeen.has('poison_chain'),'poison chain can appear without parasitic gu');
  assert(regularSeen.has('lightning_mark'),'lightning mark can appear in a regular non-mythic starting slot');
  assert(!regularSeen.has('lightning_tribulation'),'lightning tribulation cannot appear in regular non-mythic starting slots');
  assert(regularSeen.has('parasitic_gu'),'parasitic gu can appear without poison needle');

  const counts=[...thirdCounts.values()];
  assert(
    Math.max(...counts)/Math.min(...counts)<1.2,
    'mythic starting skills have approximately equal probability'
  );
} finally {
  Math.random=originalRandom;
}

console.log('validate-01056-open-skill-pool: ok');
