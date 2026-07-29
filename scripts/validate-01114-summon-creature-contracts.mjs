import assert from 'node:assert/strict';
import '../src/skills/handlers/index.js';
import { createPlayerRuntime } from '../src/config/balance.js';
import { SKILLS } from '../src/config/skills.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import {
  SUMMON_CREATURE_CONTRACTS,
  SUMMON_CREATURE_CONTRACT_IDS,
  getSummonCreatureContract
} from '../src/config/summonCreatureContracts.js';
import ProfessionSystem from '../src/systems/ProfessionSystem.js';
import { correctedPoisonKingGrowthHp } from '../src/skills/handlers/PoisonKingSpiritSlimeCompat.js';

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

console.log('v0.11.14 summon creature contract validation passed');
