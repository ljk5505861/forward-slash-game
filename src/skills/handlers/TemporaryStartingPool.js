import { SKILLS } from '../../config/skills.js';

export function configureTemporaryStartingPool(){
  const poisonKing=SKILLS.poison_king;
  if(!poisonKing) return;
  SKILLS.poison_king={
    ...poisonKing,
    rarity:'MYTHIC',
    ultimateSkill:true
  };
}
