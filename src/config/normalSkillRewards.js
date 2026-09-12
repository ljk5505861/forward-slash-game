import { SKILLS } from './skills.js';
import { weightedPick } from '../utils/rewardWeighting.js';

// Only normal runs use this table. Percentages are conditional on a new-skill
// choice; upgrades keep their existing weights and bypass rarity restrictions.
export const NORMAL_SKILL_RARITY_TIERS = Object.freeze([
  { minLevel:1, weights:{COMMON:70,FINE:25,RARE:5,EPIC:0,LEGENDARY:0,MYTHIC:0} },
  { minLevel:4, weights:{COMMON:45,FINE:30,RARE:20,EPIC:5,LEGENDARY:0,MYTHIC:0} },
  { minLevel:7, weights:{COMMON:25,FINE:30,RARE:30,EPIC:15,LEGENDARY:0,MYTHIC:0} },
  { minLevel:10, weights:{COMMON:15,FINE:20,RARE:30,EPIC:25,LEGENDARY:7,MYTHIC:3} },
  { minLevel:13, weights:{COMMON:10,FINE:15,RARE:25,EPIC:30,LEGENDARY:12,MYTHIC:8} },
].map(tier=>Object.freeze({...tier,weights:Object.freeze(tier.weights)})));

export function normalSkillRarityWeights(level){
  const safeLevel=Number.isFinite(level)?Math.max(1,Math.floor(level)):1;
  return NORMAL_SKILL_RARITY_TIERS.findLast(tier=>safeLevel>=tier.minLevel).weights;
}

export function rollNormalSkillCandidates(candidates,level,{random=Math.random,count=3}={}){
  const weights=normalSkillRarityWeights(level);
  let pool=candidates.filter(option=>option.type==='skillLevel'||weights[SKILLS[option.skillId]?.rarity]>0);
  const picked=[];
  while(pool.length&&picked.length<count){
    const upgrades=pool.filter(option=>option.type==='skillLevel');
    const fresh=pool.filter(option=>option.type==='newSkill');
    // Keep the existing candidate weights for upgrade vs acquisition decisions.
    const groups=[{kind:'upgrade',weight:upgrades.reduce((sum,o)=>sum+o.weight,0)},
      {kind:'new',weight:fresh.reduce((sum,o)=>sum+o.weight,0)}].filter(group=>group.weight>0);
    if(!groups.length) break;
    const group=weightedPick(groups,{random});
    let choice;
    if(group.kind==='upgrade') choice=weightedPick(upgrades,{random});
    else {
      // Empty/exhausted rarities are omitted and the remaining weights normalize.
      const rarities=Object.entries(weights).filter(([rarity,weight])=>weight>0&&fresh.some(o=>SKILLS[o.skillId]?.rarity===rarity))
        .map(([rarity,weight])=>({rarity,weight}));
      const rarity=weightedPick(rarities,{random});
      if(!rarity) break;
      choice=weightedPick(fresh.filter(o=>SKILLS[o.skillId]?.rarity===rarity.rarity),{random});
    }
    if(!choice) break;
    picked.push(choice);
    pool=pool.filter(option=>option.skillId!==choice.skillId);
  }
  return picked;
}
