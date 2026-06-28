import { configureEntryArchetypeSkills, EntryFireballSkill, EntrySwordSkill, EntryPoisonNeedleSkill, EntryIronWallSkill, EntryMovementSkill } from './EntryArchetypeSkills.js';
import { configureFlameCoreSkills, FireSeedSkill, BurnBurstSkill, SolarFlameSkill } from './FlameCoreSkills.js';
import { configureSwordReworkSkills, SwordSheathSkill, SwordTombSkill } from './SwordReworkSkills.js';
import { configureStrengthCoreSkills, GiantForceSkill, SpinningBladeSkill, BloodthirstSkill, LastStandSkill } from './StrengthCoreSkills.js';
import { configureDefenseCoreSkills, ThornArmorSkill, GuardianShieldSkill } from './DefenseCoreSkills.js';
import { configureAfterimageCoreSkills, PhantomStepSkill, TracelessSkill } from './AfterimageCoreSkills.js';
import { configureAfterimageAdvancedSkills, InstantStepSkill } from './AfterimageAdvancedSkills.js';
import { configureAfterimageUltimateSkills, MyriadAfterimageSkill } from './AfterimageUltimateSkills.js';
import { configurePoisonSummonCoreSkills } from './PoisonSummonCoreSkills.js';
import { configurePoisonSummonAdvancedSkills, PoisonKingSkill } from './PoisonSummonAdvancedSkills.js';
import { configurePoisonChainActiveSkill, ParasiticGuHostVisualSkill, PoisonChainActiveSkill } from './PoisonSummonInteractionFixes.js';
import { configureTemporaryStartingPool } from './TemporaryStartingPool.js';

configureEntryArchetypeSkills();
configureFlameCoreSkills();
configureSwordReworkSkills();
configureStrengthCoreSkills();
configureDefenseCoreSkills();
configureAfterimageCoreSkills();
configureAfterimageAdvancedSkills();
configureAfterimageUltimateSkills();
configurePoisonSummonCoreSkills();
configurePoisonSummonAdvancedSkills();
configurePoisonChainActiveSkill();
configureTemporaryStartingPool();

export const SKILL_HANDLERS={entry_fireball:EntryFireballSkill,entry_sword:EntrySwordSkill,entry_poison_needle:EntryPoisonNeedleSkill,entry_iron_wall:EntryIronWallSkill,entry_movement:EntryMovementSkill,fire_seed:FireSeedSkill,burn_burst:BurnBurstSkill,solar_flame:SolarFlameSkill,sword_sheath:SwordSheathSkill,sword_tomb:SwordTombSkill,giant_force:GiantForceSkill,spinning_blade:SpinningBladeSkill,bloodthirst:BloodthirstSkill,last_stand:LastStandSkill,thorn_armor:ThornArmorSkill,guardian_shield:GuardianShieldSkill,phantom_step:PhantomStepSkill,traceless:TracelessSkill,instant_step:InstantStepSkill,myriad_afterimage:MyriadAfterimageSkill,parasitic_gu:ParasiticGuHostVisualSkill,poison_chain:PoisonChainActiveSkill,poison_king:PoisonKingSkill};
