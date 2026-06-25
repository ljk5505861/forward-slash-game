import BoneBoomerangSkill from './BoneBoomerangSkill.js';
import ShadowFistSkill from './ShadowFistSkill.js';
import BulletEaterSkill from './BulletEaterSkill.js';
import ParasiteLanternSkill from './ParasiteLanternSkill.js';
import HangingBladeSkill from './HangingBladeSkill.js';
import MirrorMarchSkill from './MirrorMarchSkill.js';
import JudgmentPendulumSkill from './JudgmentPendulumSkill.js';
import TimeLoanSkill from './TimeLoanSkill.js';
import { configureEntryArchetypeSkills, EntryFireballSkill, EntrySwordSkill, EntryPoisonNeedleSkill, EntryHeavyHitSkill, EntryIronWallSkill, EntryMovementSkill } from './EntryArchetypeSkills.js';

configureEntryArchetypeSkills();

export const SKILL_HANDLERS={entry_fireball:EntryFireballSkill,entry_sword:EntrySwordSkill,entry_poison_needle:EntryPoisonNeedleSkill,entry_heavy_hit:EntryHeavyHitSkill,entry_iron_wall:EntryIronWallSkill,entry_movement:EntryMovementSkill,bone_boomerang:BoneBoomerangSkill,shadow_fist:ShadowFistSkill,bullet_eater:BulletEaterSkill,parasite_lantern:ParasiteLanternSkill,hanging_blade:HangingBladeSkill,mirror_march:MirrorMarchSkill,judgment_pendulum:JudgmentPendulumSkill,time_loan:TimeLoanSkill};
