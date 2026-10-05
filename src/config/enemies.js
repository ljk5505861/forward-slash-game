export const ENEMIES = {
  foreseer: { id:'foreseer', name:'预事者', kind:'boss', bossType:'boss4', behavior:'foreseer', width:84, height:116, bodyWidth:72, bodyHeight:106, hp:2300, damage:19, attackIntervalMs:2600, attackRange:520, preferredRange:380, speed:286, color:0x756079, stroke:0x302438 },
  foreseer_orb: { id:'foreseer_orb', name:'分裂肉球', kind:'summon', behavior:'foreseerOrb', width:36, height:36, bodyWidth:32, bodyHeight:32, hp:54, damage:7, attackIntervalMs:1800, attackRange:460, preferredRange:320, speed:180, color:0xa96678, stroke:0x522c44 },
  uncrowned_king: { id:'uncrowned_king', name:'无冕之王', kind:'boss', bossType:'boss3', behavior:'uncrownedKing', width:88, height:126, bodyWidth:78, bodyHeight:116, hp:1408, damage:16, attackIntervalMs:2400, attackRange:175, speed:272, color:0x252934, stroke:0x090d16 },
  thornless_rose: { id:'thornless_rose', name:'无刺蔷薇', kind:'boss', bossType:'mid', behavior:'thornlessRose', width:70, height:118, bodyWidth:60, bodyHeight:108, hp:960, damage:11, attackIntervalMs:2000, attackRange:150, speed:300, color:0xb83355, stroke:0x48152b },
  mountain_general: { id:'mountain_general', name:'撼山将军', kind:'boss', bossType:'boss1', behavior:'mountainGeneral', width:97, height:129, bodyWidth:85, bodyHeight:119, hp:640, damage:8, attackIntervalMs:2200, attackRange:155, speed:272, color:0x8c4634, stroke:0x3c211d },
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
  foreseer: Object.freeze({ hp:2300, damage:19, attackIntervalMs:2600,
    hpGrowth:0.12, damageGrowth:0.04, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  foreseer_orb: Object.freeze({ hp:54, damage:7, attackIntervalMs:1800,
    hpGrowth:0.06, damageGrowth:0.04, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  uncrowned_king: Object.freeze({ hp:1408, damage:16, attackIntervalMs:2400,
    hpGrowth:0.12, damageGrowth:0.035, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  thornless_rose: Object.freeze({ hp:960, damage:11, attackIntervalMs:2000,
    hpGrowth:0.12, damageGrowth:0.04, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
  mountain_general: Object.freeze({ hp:640, damage:8, attackIntervalMs:2200,
    hpGrowth:0.12, damageGrowth:0.04, attackSpeedGrowth:0, maxAttackSpeedBonus:0 }),
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

export const MOUNTAIN_GENERAL_TUNING = Object.freeze({ first:3200, cooldown:6000, windup:650,
  sweepRange:180, sweepHeight:90, sweepDamageMultiplier:1.6, sweepKnockback:72,
  pause:240, chargeSpeed:720, chargeDuration:480, chargeRadius:76, chargeDamageMultiplier:2,
  recovery:900, punchWindup:110, punchRecovery:250, knockbackDuration:150, effectMs:180 });

export const THORNLESS_ROSE_TUNING = Object.freeze({ dashFirst:3000, dashCooldown:7000, dashWindup:450,
  dashSpeed:760, dashRadius:70, dashKnockback:60, dashDamageMultiplier:1.6, dashRecovery:700,
  roseFirst:6000, roseCooldown:8500, roseWindup:300, roseFlight:200, roseWarning:800,
  roseRadius:80, roseDamageMultiplier:1.6, roseRecovery:550,
  drainFirst:9000, drainCooldown:7800, drainWindup:550, drainRange:165,
  drainDamageMultiplier:1.3, drainHealMultiplier:1, drainRecovery:600,
  attackWindup:100, attackRecovery:220, knockbackDuration:140, effectMs:180 });

export const UNCROWNED_KING_TUNING = Object.freeze({ thrustFirst:3000, thrustCooldown:6500, thrustWindup:420,
  thrustCount:3, thrustInterval:220, thrustRange:220, thrustDamageMultiplier:0.8, thrustRecovery:650,
  cleaveFirst:6000, cleaveCooldown:8000, cleaveWindup:700, cleaveRange:205, cleaveHeight:95,
  cleaveDamageMultiplier:2.2, cleaveKnockback:80, cleaveRecovery:850,
  rainFirst:9000, rainCooldown:10000, rainWindup:500, rainBatches:3,
  rainOffsets:Object.freeze([-90,0,90]), rainBatchInterval:450, rainWarning:600, rainFall:220,
  rainRadius:32, rainDamageMultiplier:0.65, rainRecovery:650,
  shadowFirst:12000, shadowCooldown:12500, shadowWindup:350, shadowDuration:3000, shadowRecovery:600,
  attackWindup:110, attackRecovery:250, knockbackDuration:150, effectMs:180 });

export const FORESEER_TUNING = Object.freeze({ bindFirst:3000, bindCooldown:7000, bindWindup:500,
  bindRange:480, bindDuration:1800, bindDamageMultiplier:0.35, bindRecovery:600,
  splitFirst:6000, splitCooldown:9500, splitWindup:650, splitRecovery:650,
  orbCap:2, orbDuration:8500, orbFirst:600,
  teleportFirst:9000, teleportCooldown:10000, teleportWindup:400, teleportRecovery:650,
  teleportPlayerGap:100, teleportMinDistance:80,
  beamWindup:350, beamRadius:16, attackRecovery:280, knockbackDuration:150, flash:180 });
