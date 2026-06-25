import { configureEntryArchetypeSkills, EntryFireballSkill, EntrySwordSkill, EntryPoisonNeedleSkill, EntryHeavyHitSkill, EntryIronWallSkill, EntryMovementSkill } from './EntryArchetypeSkills.js';
import { configureFlameCoreSkills, FlameSpraySkill, BurnBurstSkill } from './FlameCoreSkills.js';
import { configureFlameAdvancedSkills, WildfireSkill, MeteorSkill } from './FlameAdvancedSkills.js';
import { configureSwordCoreSkills, SplitSwordSkill, RotatingSwordSkill } from './SwordCoreSkills.js';
import { configureSwordAdvancedSkills, ExecutionSwordSkill, MyriadSwordsSkill } from './SwordAdvancedSkills.js';
import { configureStrengthCoreSkills, GiantForceSkill, BloodthirstSkill } from './StrengthCoreSkills.js';
import { configureStrengthAdvancedSkills, FrenzySkill, BloodRageBurstSkill } from './StrengthAdvancedSkills.js';
import { configureDefenseCoreSkills, ThornArmorSkill, GuardianShieldSkill } from './DefenseCoreSkills.js';
import { configureAfterimageCoreSkills, PhantomStepSkill, ShadowAssaultSkill } from './AfterimageCoreSkills.js';
import { configurePoisonSummonCoreSkills, ParasiticGuSkill, BoneEatingInsectSkill } from './PoisonSummonCoreSkills.js';

configureEntryArchetypeSkills();
configureFlameCoreSkills();
configureFlameAdvancedSkills();
configureSwordCoreSkills();
configureSwordAdvancedSkills();
configureStrengthCoreSkills();
configureStrengthAdvancedSkills();
configureDefenseCoreSkills();
configureAfterimageCoreSkills();
configurePoisonSummonCoreSkills();

export const SKILL_HANDLERS={entry_fireball:EntryFireballSkill,entry_sword:EntrySwordSkill,entry_poison_needle:EntryPoisonNeedleSkill,entry_heavy_hit:EntryHeavyHitSkill,entry_iron_wall:EntryIronWallSkill,entry_movement:EntryMovementSkill,flame_spray:FlameSpraySkill,burn_burst:BurnBurstSkill,wildfire:WildfireSkill,meteor:MeteorSkill,split_sword:SplitSwordSkill,rotating_sword:RotatingSwordSkill,execution_sword:ExecutionSwordSkill,myriad_swords:MyriadSwordsSkill,giant_force:GiantForceSkill,bloodthirst:BloodthirstSkill,thorn_armor:ThornArmorSkill,guardian_shield:GuardianShieldSkill,phantom_step:PhantomStepSkill,shadow_assault:ShadowAssaultSkill,parasitic_gu:ParasiticGuSkill,bone_eating_insect:BoneEatingInsectSkill,frenzy:FrenzySkill,blood_rage_burst:BloodRageBurstSkill};
