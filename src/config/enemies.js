export const ENEMIES = {
  elite_golden_guard: { id:'elite_golden_guard', name:'黄金殿卫', kind:'elite', behavior:'goldenHallGuard', width:68, height:102, bodyWidth:60, bodyHeight:94, hp:112, damage:9, attackIntervalMs:2200, attackRange:165, speed:160, color:0xb49246, stroke:0x59431c },
  elite_gambler: { id:'elite_gambler', name:'赌师', kind:'elite', behavior:'archer', width:58, height:94, bodyWidth:50, bodyHeight:86, hp:60, damage:7, attackIntervalMs:2300, attackRange:480, speed:360, color:0x675184, stroke:0x30223f },
  elite_hell_envoy: { id:'elite_hell_envoy', name:'地狱使', kind:'elite', behavior:'hellEnvoy', width:60, height:98, bodyWidth:52, bodyHeight:90, hp:76, damage:3, attackIntervalMs:2600, attackRange:420, preferredRange:420, speed:300, color:0x6c354e, stroke:0x2d1424 },
  hell_head: { id:'hell_head', name:'头魔', kind:'summon', width:64, height:64, bodyWidth:56, bodyHeight:56, hp:38, damage:4, attackIntervalMs:2300, attackRange:86, speed:216, color:0xa1444a, stroke:0x471b25 },
  hell_small: { id:'hell_small', name:'小魔', kind:'summon', width:32, height:44, bodyWidth:28, bodyHeight:38, hp:16, damage:2, attackIntervalMs:2000, attackRange:72, speed:250, color:0xa86875, stroke:0x4e2937 },
  elite_thunder_mage: { id:'elite_thunder_mage', name:'雷法师', kind:'elite', behavior:'archer', width:58, height:94, bodyWidth:50, bodyHeight:86, hp:62, damage:8, attackIntervalMs:2400, attackRange:480, speed:360, color:0x4776a8, stroke:0x173858 },
  elite_berserker: { id:'elite_berserker', name:'狂战士', kind:'elite', behavior:'eliteBerserker', width:64, height:96, bodyWidth:56, bodyHeight:88, hp:104, damage:10, attackIntervalMs:1800, attackRange:110, speed:300, color:0xa83b36, stroke:0x4a181b },
  elite_war_drum_priest: { id:'elite_war_drum_priest', name:'战鼓祭司', kind:'elite', behavior:'healer', width:60, height:94, bodyWidth:52, bodyHeight:86, hp:68, damage:3, attackIntervalMs:2600, attackRange:480, speed:360, color:0xaa7242, stroke:0x50301d },
  elite_sharpshooter: { id:'elite_sharpshooter', name:'神射手', kind:'elite', behavior:'archer', width:58, height:92, bodyWidth:50, bodyHeight:84, hp:56, damage:8, attackIntervalMs:2200, attackRange:500, speed:360, color:0x367b7d, stroke:0x163a43 },
  grunt: { id:'grunt', name:'训练傀儡', kind:'normal', width:52, height:83, bodyWidth:45, bodyHeight:76, hp:16, damage:3, attackIntervalMs:1650, attackRange:86, speed:216, color:0xe84343, stroke:0x4b0000 },
  elite: { id:'elite', name:'精英傀儡', kind:'elite', width:74, height:105, bodyWidth:64, bodyHeight:97, hp:77, damage:8, attackIntervalMs:1450, attackRange:96, speed:216, color:0xcc7832, stroke:0x5a2600 },
  armored_guard: { id:'armored_guard', name:'重甲守卫', kind:'normal', behavior:'armored', width:69, height:104, bodyWidth:60, bodyHeight:95, hp:24, defense:1, damageReduction:0.08, damage:2, attackIntervalMs:1800, attackRange:112, speed:216, color:0x667085, stroke:0x1f2937 },
  charger: { id:'charger', name:'冲锋兽', kind:'normal', behavior:'charger', width:59, height:74, bodyWidth:53, bodyHeight:67, hp:21, damage:4, chargeDamage:9, attackIntervalMs:1600, attackRange:82, speed:216, chargeTriggerRange:260, chargeWindupMs:520, color:0xf97316, stroke:0x7c2d12 },
  archer: { id:'archer', name:'弓箭手', kind:'normal', behavior:'archer', width:55, height:86, bodyWidth:47, bodyHeight:77, hp:18, damage:3, attackIntervalMs:2000, attackRange:450, speed:360, color:0x8b5a2b, stroke:0x1f3d2b },
  bomber: { id:'bomber', name:'投弹怪', kind:'normal', behavior:'bomber', width:57, height:83, bodyWidth:50, bodyHeight:74, hp:24, damage:3, bombDamage:3, attackIntervalMs:2300, attackRange:480, bombWarningMs:1050, speed:360, color:0xfacc15, stroke:0x713f12 },
  healer: { id:'healer', name:'治疗祭司', kind:'normal', behavior:'healer', width:55, height:87, bodyWidth:48, bodyHeight:78, hp:22, damage:2, healAmount:18, attackIntervalMs:2800, attackRange:480, speed:360, color:0x22c55e, stroke:0x14532d },
  berserker_boss: { id:'berserker_boss', name:'狂暴巨兽', kind:'boss', bossType:'boss1', behavior:'berserkerBoss', width:97, height:129, bodyWidth:85, bodyHeight:119, hp:640, damage:10, chargeDamage:16, chargeCooldownMs:4000, chargeWindupMs:600, chargeRecoveryMs:800, attackIntervalMs:1450, attackRange:155, speed:272, chargeSpeed:240, color:0xb45309, stroke:0x431407 },
  mid_boss: { id:'mid_boss', name:'铁甲暴君', kind:'boss', bossType:'mid', behavior:'midBoss', width:90, height:125, bodyWidth:80, bodyHeight:116, hp:960, damage:14, slamDamage:11, chargeDamage:14, attackIntervalMs:1450, enragedAttackIntervalMs:1080, attackRange:155, speed:272, color:0x475569, stroke:0x020617 },
  boss: { id:'boss', name:'训练场守卫', kind:'boss', bossType:'final', width:94, height:133, bodyWidth:85, bodyHeight:125, hp:1408, damage:19, attackIntervalMs:1250, enragedAttackIntervalMs:800, attackRange:155, speed:272, color:0x7b2cff, stroke:0x24005b },
};

// Effective Lv1 stats, exclusive to normal mode. Do not apply the legacy global
// difficulty multipliers again. Each profile overrides only its declared fields;
// remaining movement/visual/attack settings inherit the legacy catalog.
export const NORMAL_ENEMY_PROFILES = Object.freeze({
  elite_golden_guard: Object.freeze({ hp:112, damage:9, attackIntervalMs:2200,
    hpGrowth:0.08, damageGrowth:0.11, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  elite_gambler: Object.freeze({ hp:60, damage:7, attackIntervalMs:2300,
    hpGrowth:0.05, damageGrowth:0.11, attackSpeedGrowth:0.01, maxAttackSpeedBonus:0.15 }),
  elite_hell_envoy: Object.freeze({ hp:76, damage:3, attackIntervalMs:2600,
    hpGrowth:0.08, damageGrowth:0.03, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  hell_head: Object.freeze({ hp:38, damage:4, attackIntervalMs:2300,
    hpGrowth:0.08, damageGrowth:0.05, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  hell_small: Object.freeze({ hp:16, damage:2, attackIntervalMs:2000,
    hpGrowth:0.06, damageGrowth:0.05, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  elite_thunder_mage: Object.freeze({ hp:62, damage:8, attackIntervalMs:2400,
    hpGrowth:0.06, damageGrowth:0.11, attackSpeedGrowth:0.01, maxAttackSpeedBonus:0.10 }),
  elite_berserker: Object.freeze({ hp:104, damage:10, attackIntervalMs:1800,
    hpGrowth:0.06, damageGrowth:0.10, attackSpeedGrowth:0.01, maxAttackSpeedBonus:0.15 }),
  elite_war_drum_priest: Object.freeze({ hp:68, damage:3, attackIntervalMs:2600,
    hpGrowth:0.08, damageGrowth:0.03, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  elite_sharpshooter: Object.freeze({ hp:56, damage:8, attackIntervalMs:2200,
    hpGrowth:0.05, damageGrowth:0.12, attackSpeedGrowth:0.01, maxAttackSpeedBonus:0.15 }),
  elite: Object.freeze({ name:'盾卫', behavior:'shieldGuard', hp:150, damage:6, attackIntervalMs:2000,
    color:0x587087, stroke:0x263848,
    hpGrowth:0.18, damageGrowth:0.03, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  charger: Object.freeze({ name:'大师', hp:44, damage:7, speed:360, attackRange:110, attackIntervalMs:1500,
    width:56, height:92, bodyWidth:48, bodyHeight:84, color:0x774e95, stroke:0x382246,
    hpGrowth:0.06, damageGrowth:0.12, attackSpeedGrowth:0.01, maxAttackSpeedBonus:0.15 }),
  healer: Object.freeze({ name:'医师', hp:36, damage:2, healAmount:12, attackIntervalMs:2800,
    hpGrowth:0.06, damageGrowth:0.02, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  grunt: Object.freeze({ name:'战士', hp:64, damage:2, attackIntervalMs:2800, speed:120,
    hpGrowth:0.18, damageGrowth:0.03, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  archer: Object.freeze({ name:'弓箭手', hp:30, damage:6, attackIntervalMs:2000,
    hpGrowth:0.04, damageGrowth:0.12, attackSpeedGrowth:0.01, maxAttackSpeedBonus:0.20 }),
  armored_guard: Object.freeze({ name:'肉怪', behavior:'meat', width:90, height:116, bodyWidth:78, bodyHeight:106,
    hp:128, defense:0, damageReduction:0, damage:3, attackIntervalMs:2400, color:0x98584e, stroke:0x462721,
    hpGrowth:0.18, damageGrowth:0.03, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
});

export const DOCTOR_TUNING = Object.freeze({ healGrowth:0.10, healRange:520, meleeRange:86, effectMs:360 });

export const MASTER_TIMING = Object.freeze({ first:3500, cooldown:5000, windup:400, flight:450, range:400, damageMultiplier:1.5 });

export const SHIELD_GUARD_TUNING = Object.freeze({ first:3000, duration:1800, cooldown:5200,
  reduction:0.5, moveMultiplier:0.45, recovery:350 });

export const SHARPSHOOTER_TUNING = Object.freeze({ first:3500, cooldown:6000, windup:700,
  shotGap:200, flight:350, recovery:650, burstDamageMultiplier:0.75 });

export const WAR_DRUM_TUNING = Object.freeze({ first:3500, cooldown:6000, windup:600,
  duration:3000, recovery:400, range:520, attackSpeedBonus:0.20, meleeRange:86 });

export const ELITE_BERSERKER_TUNING = Object.freeze({ first:3200, cooldown:6200, windup:550,
  slashGap:250, recovery:900, range:130, effectMs:160 });

export const THUNDER_MAGE_TUNING = Object.freeze({ first:4000, cooldown:6500, warning:900,
  recovery:650, radius:70, damageMultiplier:1.5, flight:400, boltRadius:18, flash:160 });

export const HELL_ENVOY_TUNING = Object.freeze({ first:3200, cooldown:5500, windup:650,
  recovery:400, headCap:2, smallCap:4, meleeRange:86 });

export const GAMBLER_TUNING = Object.freeze({ explosiveEvery:4, windup:350, explosiveWindup:650,
  flight:450, cardRadius:18, explosionRadius:64, explosionDamageMultiplier:1.35, flash:180 });

export const GOLDEN_HALL_GUARD_TUNING = Object.freeze({ heavyEvery:3, windup:250, heavyWindup:600,
  recovery:250, heavyRecovery:550, heavyDamageMultiplier:1.6, effectMs:180 });
