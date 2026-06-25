import { configureEntryArchetypeSkills, EntryFireballSkill, EntrySwordSkill, EntryPoisonNeedleSkill, EntryHeavyHitSkill, EntryIronWallSkill, EntryMovementSkill } from './EntryArchetypeSkills.js';
import { configureFlameCoreSkills, FlameSpraySkill, BurnBurstSkill } from './FlameCoreSkills.js';

configureEntryArchetypeSkills();
configureFlameCoreSkills();

export const SKILL_HANDLERS={
  entry_fireball:EntryFireballSkill,
  entry_sword:EntrySwordSkill,
  entry_poison_needle:EntryPoisonNeedleSkill,
  entry_heavy_hit:EntryHeavyHitSkill,
  entry_iron_wall:EntryIronWallSkill,
  entry_movement:EntryMovementSkill,
  flame_spray:FlameSpraySkill,
  burn_burst:BurnBurstSkill,
};
