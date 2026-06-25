import { configureEntryArchetypeSkills, EntryFireballSkill, EntrySwordSkill, EntryPoisonNeedleSkill, EntryHeavyHitSkill, EntryIronWallSkill, EntryMovementSkill } from './EntryArchetypeSkills.js';
import { configureFlameCoreSkills, FlameSpraySkill, BurnBurstSkill } from './FlameCoreSkills.js';
import { configureSwordCoreSkills, SplitSwordSkill, RotatingSwordSkill } from './SwordCoreSkills.js';
import { configureStrengthCoreSkills, GiantForceSkill, BloodthirstSkill } from './StrengthCoreSkills.js';

configureEntryArchetypeSkills();
configureFlameCoreSkills();
configureSwordCoreSkills();
configureStrengthCoreSkills();

export const SKILL_HANDLERS={entry_fireball:EntryFireballSkill,entry_sword:EntrySwordSkill,entry_poison_needle:EntryPoisonNeedleSkill,entry_heavy_hit:EntryHeavyHitSkill,entry_iron_wall:EntryIronWallSkill,entry_movement:EntryMovementSkill,flame_spray:FlameSpraySkill,burn_burst:BurnBurstSkill,split_sword:SplitSwordSkill,rotating_sword:RotatingSwordSkill,giant_force:GiantForceSkill,bloodthirst:BloodthirstSkill};
