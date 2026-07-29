import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { createPlayerRuntime } from '../src/config/balance.js';
import { SKILLS } from '../src/config/skills.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import {
  SUMMON_CREATURE_CONTRACTS,
  SUMMON_CREATURE_CONTRACT_IDS,
  getSummonCreatureContract
} from '../src/config/summonCreatureContracts.js';
import ProfessionSystem from '../src/systems/ProfessionSystem.js';
import {
  correctedPoisonKingGrowthHp,
  poisonKingContractData
} from '../src/skills/handlers/PoisonKingSpiritSlimeCompat.js';
import { POISON_ADVANCED_TUNING } from '../src/skills/handlers/PoisonSummonAdvancedSkills.js';

class Bus {
  constructor(){ this.map=new Map(); }
  on(event,listener){
    const list=this.map.get(event)||[];
    list.push(listener);
    this.map.set(event,list);
    return ()=>this.map.set(event,(this.map.get(event)||[]).filter(item=>item!==listener));
  }
  emit(event,payload={}){ for(const listener of [...(this.map.get(event)||[])]) listener(payload); }
}

function makeScene(){
  const scene={
    playerData:createPlayerRuntime(),
    eventBus:new Bus(),
    runStats:{setProfession(){}},
    hud:{update(){}},
    playerInfoPanel:{isOpen:false,render(){}},
    statusEffects:{add(type,target,options){return {type,target,...options};},getEffects(){return[];}},
    targeting:{all:()=>[]},
    combatSystem:{damageEnemy(enemy,amount){enemy.hp-=amount;return true;}},
    skillSystem:{getData(id){const owned=scene.playerData.skills.find(skill=>skill.id===id);return owned?SKILLS[id]?.levels?.[owned.level-1]:null;},recoverMana(){}},
    healPlayer(){return 0;}
  };
  scene.professionSystem=new ProfessionSystem(scene);
  return scene;
}

assert.equal(GAME_VERSION,'0.11.14');
assert.deepEqual(
  [...SUMMON_CREATURE_CONTRACT_IDS].sort(),
  ['spirit_wolves','spirit_bird','spirit_slime','parasitic_gu','poison_king'].sort()
);
for(const excluded of ['sword_wave','sword_sheath','sword_tomb','poison_chain']){
  assert.equal(getSummonCreatureContract(excluded),null,`${excluded} is not a summon-creature contract skill`);
}

{
  const scene=makeScene();
  const p=scene.playerData;
  p.skills=[
    {id:'sword_wave',level:1},
    {id:'spirit_bird',level:1},
    {id:'spirit_wolves',level:1}
  ];
  assert.equal(scene.professionSystem.summonContract(),null,'non-summoner has no contract');
  scene.professionSystem.selectProfession('summoner');
  assert.equal(scene.professionSystem.summonContract(),'spirit_bird','first summon creature by slot order is contracted');
  assert.equal(p.summonContractSkillId,'spirit_bird');
  assert.equal(scene.professionSystem.bindSummonContract('spirit_wolves'),false,'manual binding cannot override slot order');
  p.skills.splice(0,1,{id:'poison_king',level:1});
  scene.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'poison_king'});
  assert.equal(scene.professionSystem.summonContract(),'poison_king','earlier replacement automatically receives contract');
  p.skills.splice(0,1,{id:'fireball',level:1});
  assert.equal(scene.professionSystem.summonContract(),'spirit_bird','removing contracted creature transfers to next creature');
}

{
  const scene=makeScene();
  scene.playerData.skills=[{id:'spirit_wolves',level:1}];
  scene.professionSystem.selectProfession('summoner');
  const wolf={baseAttack:10,baseDefense:0,baseMaxHp:100,attack:10,defense:0,maxHp:100,hp:100};
  scene.professionSystem.applyEntitySummonStats(wolf,'spirit_wolves');
  assert.equal(wolf.maxHp,144,'wolf gets summoner 15% life and contract 25% life');
  const enemy={hp:500,x:0,y:0};
  scene.combatSystem.damageEnemy(enemy,110,{
    source:'skill',
    skillId:'spirit_wolves',
    tags:['summon'],
    professionApplied:true,
    professionMultiplier:1.1,
    baseAmountBeforeProfession:100,
    summonDirectSingleTarget:true
  });
  assert.equal(enemy.hp,362,'wolf base damage 100 becomes 125 before summoner 10% bonus');
}

{
  const scene=makeScene();
  scene.playerData.skills=[{id:'spirit_wolves',level:1}];
  scene.professionSystem.selectProfession('summoner');
  scene.playerData.advancedProfessionId='summon_commander';
  scene.professionSystem.applyAdvanced('summon_commander');
  const main={hp:500,x:0,y:0};
  const nearby={hp:500,x:50,y:0};
  scene.targeting.all=()=>[main,nearby];
  scene.professionSystem.applySummonSplash(
    {target:main,x:0,y:0},
    138,
    {skillId:'spirit_wolves',tags:['summon'],summonDirectSingleTarget:true}
  );
  assert.equal(nearby.hp,472,'commander splash uses 20% of already-contracted damage and does not apply wolf contract twice');
}

{
  const scene=makeScene();
  scene.playerData.skills=[{id:'spirit_bird',level:1}];
  scene.professionSystem.selectProfession('summoner');
  assert.equal(scene.professionSystem.summonHealing('spirit_bird',100),138,'bird healing receives summoner and contract bonuses');
  assert.equal(scene.professionSystem.summonActionInterval('spirit_bird',1000),800,'bird healing interval is reduced by 20%');
}

{
  const scene=makeScene();
  scene.playerData.skills=[{id:'spirit_slime',level:1}];
  scene.professionSystem.selectProfession('summoner');
  const modifier=scene.professionSystem.summonSupportModifier('spirit_slime',{
    powerBonus:.4,
    maxHpBonus:.4,
    damageReduction:.1,
    actionSpeedBonus:.1,
    healingReceivedBonus:.2
  });
  assert.equal(modifier.powerBonus,.5);
  assert.equal(modifier.maxHpBonus,.5);
  assert.equal(modifier.damageReduction,.125);
  assert.equal(modifier.actionSpeedBonus,.125);
  assert.equal(modifier.healingReceivedBonus,.25);
}

{
  const scene=makeScene();
  scene.playerData.skills=[{id:'parasitic_gu',level:1}];
  scene.professionSystem.selectProfession('summoner');
  assert.equal(scene.professionSystem.summonCreatureContractMultiplier('parasitic_gu','poisonEnergyMultiplier'),1.3);
  assert.equal(scene.professionSystem.summonCreatureContractMultiplier('parasitic_gu','lifeLossMultiplier'),.7);
}

{
  const scene=makeScene();
  scene.playerData.skills=[{id:'poison_king',level:1}];
  scene.professionSystem.selectProfession('summoner');
  assert.equal(scene.professionSystem.summonCreatureContractMultiplier('poison_king','growthMultiplier'),1.3);
  assert.equal(scene.professionSystem.summonCreatureContractMultiplier('poison_king','stageStatMultiplier'),1.2);
  const base={growthRatio:.25,biteDamage:40};
  const contracted=poisonKingContractData(base,{stage:3,growthMultiplier:1.3,stageStatMultiplier:1.2});
  assert.equal(contracted.growthRatio,.325,'poison damage converts to growth 30% faster');
  assert.equal(
    contracted.biteDamage,
    40+3*POISON_ADVANCED_TUNING.king.damagePerStage*.2,
    'stage attack growth is increased by 20% without wrapping combat damage'
  );
  assert.deepEqual(
    poisonKingContractData(base,{stage:3,growthMultiplier:1,stageStatMultiplier:1}),
    base,
    'moving the contract away removes current poison king data bonuses'
  );
  assert.equal(correctedPoisonKingGrowthHp({
    oldHp:100,
    oldMaxHp:180,
    oldBaseMaxHp:180,
    newMaxHp:222,
    newBaseMaxHp:222,
    stageGain:1,
    poisonKingLevel:1,
    stageStatMultiplier:1.2
  }),142,'contract stage uses 42 life growth instead of 35');
}

for(const [skillId,contract] of Object.entries(SUMMON_CREATURE_CONTRACTS)){
  assert(SKILLS[skillId],`${skillId} exists in production skill pool`);
  assert(contract.name&&contract.description,`${skillId} has readable contract text`);
}

{
  const skillBar=readFileSync(new URL('../src/ui/SkillBar.js',import.meta.url),'utf8');
  assert.match(skillBar,/contractBadge/,'skill bar owns a dedicated contract badge');
  assert.match(skillBar,/showContract\?\s*'契'/,'active contract slot renders the contract mark');
  assert.match(skillBar,/\['召唤契约'/,'contracted skill detail displays the contract section');
}

console.log('v0.11.14 summon creature contract validation passed');
