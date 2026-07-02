import { configureEntryArchetypeSkills, EntryFireballSkill, EntrySwordSkill, EntryPoisonNeedleSkill, EntryIronWallSkill } from './EntryArchetypeSkills.js';
import { EntryMovementSkill } from './AfterimageEntryRuntime.js';
import { configureFlameCoreSkills, FireSeedSkill, BurnBurstSkill, SolarFlameSkill } from './FlameCoreSkills.js';
import { configureSwordReworkSkills, SwordSheathSkill, SwordTombSkill } from './SwordReworkSkills.js';
import { configureStrengthCoreSkills, GiantForceSkill, SpinningBladeSkill, BloodthirstSkill, LastStandSkill } from './StrengthCoreSkills.js';
import { configureDefenseCoreSkills, ThornArmorSkill, GuardianShieldSkill } from './DefenseCoreSkills.js';
import { configureAfterimageCoreSkills, PhantomStepSkill, TracelessSkill } from './AfterimageCoreSkills.js';
import { configureAfterimageAdvancedSkills, InstantStepSkill } from './AfterimageAdvancedSkills.js';
import { configureAfterimageUltimateSkills, MyriadAfterimageSkill } from './AfterimageUltimateSkills.js';
import { configurePoisonSummonCoreSkills } from './PoisonSummonCoreSkills.js';
import { configurePoisonSummonAdvancedSkills } from './PoisonSummonAdvancedSkills.js';
import { PoisonKingSkillWithSpiritSlime } from './PoisonKingSpiritSlimeCompat.js';
import { configurePoisonChainActiveSkill, ParasiticGuHostVisualSkill, PoisonChainActiveSkill } from './PoisonSummonInteractionFixes.js';
import { configureTemporaryStartingPool } from './TemporaryStartingPool.js';
import { SpiritWolvesSkill } from './SpiritWolvesSkill.js';
import { SpiritBirdSkill } from './SpiritBirdSkill.js';
import { SpiritSlimeSkill } from './SpiritSlimeSkill.js';
import { configureWeaponCoreSkills, LightningEnchantSkill, LightningMarkSkill, LightningTribulationSkill } from './WeaponCoreSkills.js';
import { configureGravityFlowSkills, GravityReversalSkill, GravityOrbSkill } from './GravityFlowSkills.js';
import { GravityCrushFixedSkill, BlackHoleFixedSkill } from './GravityFlowFollowupFixes.js';
import { configureCelestialFlowSkills, NeutronStarSkill, WhiteDwarfSkill } from './CelestialFlowSkills.js';
import { configureSuperheroFlowSkills, SuperSpeedSkill, LaserEyesSkill, FreezingBreathSkill } from './SuperheroFlowSkills.js';

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
configureWeaponCoreSkills();
configureTemporaryStartingPool();
configureGravityFlowSkills();
configureCelestialFlowSkills();
configureSuperheroFlowSkills();

const baseSuperSpeedShiftTimers = SuperSpeedSkill.shiftTimers;
SuperSpeedSkill.shiftTimers = (system, duration, pausedAt) => {
  const state = system.passiveState.superSpeed;
  const previousLastUpdateAt = state?.lastUpdateAt;
  baseSuperSpeedShiftTimers?.(system, duration, pausedAt);
  if (state && Number.isFinite(previousLastUpdateAt) && previousLastUpdateAt <= pausedAt) {
    state.lastUpdateAt = previousLastUpdateAt + duration;
  }
};

// EnemyBehaviorManager is the single owner of enemy cold timer pause compensation.
FreezingBreathSkill.shiftTimers = () => {};

export const SKILL_HANDLERS={entry_fireball:EntryFireballSkill,entry_sword:EntrySwordSkill,entry_poison_needle:EntryPoisonNeedleSkill,entry_iron_wall:EntryIronWallSkill,entry_movement:EntryMovementSkill,fire_seed:FireSeedSkill,burn_burst:BurnBurstSkill,solar_flame:SolarFlameSkill,sword_sheath:SwordSheathSkill,sword_tomb:SwordTombSkill,giant_force:GiantForceSkill,spinning_blade:SpinningBladeSkill,bloodthirst:BloodthirstSkill,last_stand:LastStandSkill,thorn_armor:ThornArmorSkill,guardian_shield:GuardianShieldSkill,phantom_step:PhantomStepSkill,traceless:TracelessSkill,instant_step:InstantStepSkill,myriad_afterimage:MyriadAfterimageSkill,parasitic_gu:ParasiticGuHostVisualSkill,poison_chain:PoisonChainActiveSkill,poison_king:PoisonKingSkillWithSpiritSlime,spirit_wolves:SpiritWolvesSkill,spirit_bird:SpiritBirdSkill,spirit_slime:SpiritSlimeSkill,lightning_enchant:LightningEnchantSkill,lightning_mark:LightningMarkSkill,lightning_tribulation:LightningTribulationSkill,gravity_crush:GravityCrushFixedSkill,gravity_reversal:GravityReversalSkill,gravity_orb:GravityOrbSkill,black_hole:BlackHoleFixedSkill,neutron_star:NeutronStarSkill,white_dwarf:WhiteDwarfSkill,super_speed:SuperSpeedSkill,laser_eyes:LaserEyesSkill,freezing_breath:FreezingBreathSkill};
