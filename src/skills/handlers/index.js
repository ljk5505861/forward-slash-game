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
import { configureSuperheroKineticRuntime } from './SuperheroKineticRuntime.js';
import { configureCultivationCoreSkill, NinefoldDaoSkill } from './CultivationCoreSkill.js';
import { configureCultivationAlchemySkill, CultivationAlchemySkill } from './CultivationAlchemySkill.js';
import { configureCultivationActiveSkills, SkyCoveringPalmSkill } from './CultivationActiveSkills.js';
import { configureCultivationSoulDestroyingNeedleSkill, SoulDestroyingNeedleSkill } from './CultivationSoulDestroyingNeedleSkill.js';
import { configureMantraHeavenlyBookSkill, MantraHeavenlyBookSkill } from './MantraHeavenlyBookSkill.js';

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
configureSuperheroKineticRuntime({ SuperSpeedSkill, LaserEyesSkill, FreezingBreathSkill });
configureCultivationCoreSkill();
configureCultivationAlchemySkill();
configureCultivationActiveSkills();
configureCultivationSoulDestroyingNeedleSkill();
configureMantraHeavenlyBookSkill();

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

function dedupeActiveVisualSync(active, scene) {
  const baseSyncVisual = active?.syncVisual;
  if (typeof baseSyncVisual !== 'function') return;
  active.lastFrameVisualSyncAt = scene.getGameplayTime?.() ?? 0;
  active.syncVisual = () => {
    const now = scene.getGameplayTime?.() ?? 0;
    if (active.lastFrameVisualSyncAt === now) return;
    active.lastFrameVisualSyncAt = now;
    baseSyncVisual();
  };
}

const baseLaserEyesCast = LaserEyesSkill.cast;
LaserEyesSkill.cast = (system, cfg, data, level, ctx) => {
  const previous = new Set(system.active);
  const result = baseLaserEyesCast(system, cfg, data, level, ctx);
  if (result?.failed) return result;
  const active = system.active.find(candidate => !previous.has(candidate) && candidate.skillId === 'laser_eyes');
  dedupeActiveVisualSync(active, system.scene);
  return result;
};

const baseFreezingBreathCast = FreezingBreathSkill.cast;
FreezingBreathSkill.cast = (system, cfg, data, level, ctx) => {
  const previous = new Set(system.active);
  const result = baseFreezingBreathCast(system, cfg, data, level, ctx);
  if (result?.failed) return result;
  const active = system.active.find(candidate => !previous.has(candidate) && candidate.skillId === 'freezing_breath' && candidate.activeKind === 'breath');
  if (!active) return result;

  dedupeActiveVisualSync(active, system.scene);

  const baseOnEnd = active.onEnd?.bind(active);
  let finalized = false;
  let completionQueued = false;
  active.onEnd = reason => {
    if (finalized) return;
    const now = system.scene.getGameplayTime?.() ?? 0;
    const naturalExpiry = now > active.endAt;
    if (reason === 'complete' && data.zoneDurationMs && naturalExpiry) {
      if (completionQueued) return;
      completionQueued = true;
      const finish = () => {
        if (finalized) return;
        finalized = true;
        const stillOwned = system.getLevel('freezing_breath') >= 9;
        const playerAlive = (system.scene.playerData?.hp || 0) > 0;
        baseOnEnd?.(stillOwned && playerAlive ? 'complete' : 'cleanup');
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(finish);
      else Promise.resolve().then(finish);
      return;
    }
    finalized = true;
    baseOnEnd?.(reason);
  };

  return result;
};

export const SKILL_HANDLERS={entry_fireball:EntryFireballSkill,entry_sword:EntrySwordSkill,entry_poison_needle:EntryPoisonNeedleSkill,entry_iron_wall:EntryIronWallSkill,entry_movement:EntryMovementSkill,fire_seed:FireSeedSkill,burn_burst:BurnBurstSkill,solar_flame:SolarFlameSkill,sword_sheath:SwordSheathSkill,sword_tomb:SwordTombSkill,giant_force:GiantForceSkill,spinning_blade:SpinningBladeSkill,bloodthirst:BloodthirstSkill,last_stand:LastStandSkill,thorn_armor:ThornArmorSkill,guardian_shield:GuardianShieldSkill,phantom_step:PhantomStepSkill,traceless:TracelessSkill,instant_step:InstantStepSkill,myriad_afterimage:MyriadAfterimageSkill,parasitic_gu:ParasiticGuHostVisualSkill,poison_chain:PoisonChainActiveSkill,poison_king:PoisonKingSkillWithSpiritSlime,spirit_wolves:SpiritWolvesSkill,spirit_bird:SpiritBirdSkill,spirit_slime:SpiritSlimeSkill,lightning_enchant:LightningEnchantSkill,lightning_mark:LightningMarkSkill,lightning_tribulation:LightningTribulationSkill,gravity_crush:GravityCrushFixedSkill,gravity_reversal:GravityReversalSkill,gravity_orb:GravityOrbSkill,black_hole:BlackHoleFixedSkill,neutron_star:NeutronStarSkill,white_dwarf:WhiteDwarfSkill,super_speed:SuperSpeedSkill,laser_eyes:LaserEyesSkill,freezing_breath:FreezingBreathSkill,ninefold_dao:NinefoldDaoSkill,alchemy:CultivationAlchemySkill,sky_covering_palm:SkyCoveringPalmSkill,soul_destroying_needle:SoulDestroyingNeedleSkill,mantra_heavenly_book:MantraHeavenlyBookSkill};
