import { CombatEvents } from '../core/CombatEvents.js';
import { TAGS } from './tags.js';

export const ARTIFACT_CATEGORIES = Object.freeze({
  growth: { id:'growth', name:'通用成长型' },
  mechanic: { id:'mechanic', name:'独立机制型' },
  synergy: { id:'synergy', name:'技能联动型' },
});

export const ARTIFACTS = {
  thunder_orb: { id:'thunder_orb', name:'雷鸣珠', category:'growth', description:'暴击率 +5%；暴击触发额外落雷，拥有落雷后强化', levelText:{1:'暴击率 +5%；暴击触发额外落雷',2:'暴击率 +8%；暴击触发额外落雷'}, listenEvent:CombatEvents.PLAYER_CRIT, internalCooldownMs:1200, statBonusByLevel:{1:{ critChance:0.05 },2:{ critChance:0.08 }}, tags:[TAGS.LIGHTNING,TAGS.CRITICAL], affectedTags:[TAGS.LIGHTNING] },
  blood_jade: { id:'blood_jade', name:'血玉', category:'mechanic', description:'击杀回复生命，满血转化为护盾', levelText:{1:'击杀回复 6/12/18 生命，满血转护盾',2:'击杀回复 8/16/24 生命，满血转护盾'}, listenEvent:CombatEvents.ENEMY_KILLED, internalCooldownMs:300, tags:[TAGS.HEALING,TAGS.SHIELD] },
  battle_mark: { id:'battle_mark', name:'战意印', category:'mechanic', description:'普通攻击累计战意，5 层强化下个自动技能', levelText:{1:'普通攻击累计战意，5 层强化下个自动技能',2:'普通攻击累计战意，4 层强化下个自动技能'}, listenEvent:CombatEvents.PLAYER_HIT, internalCooldownMs:0, tags:['physical'], supportedTags:[TAGS.NORMAL_ATTACK,TAGS.ACTIVE_SKILL] },
  whetstone: { id:'whetstone', name:'磨锋石', category:'growth', description:'获得时攻击力 +15%', levelText:{1:'攻击力 +15%',2:'攻击力 +23%'}, statBonusByLevel:{1:{ attackMultiplier:1.15 },2:{ attackMultiplier:1.23 }}, tags:['attack'], supportedTags:[TAGS.NORMAL_ATTACK] },
  gale_feather: { id:'gale_feather', name:'疾风羽', category:'growth', description:'获得时攻击速度 +12%', levelText:{1:'攻击速度 +12%',2:'攻击速度 +18%'}, statBonusByLevel:{1:{ attackSpeedMultiplier:0.12 },2:{ attackSpeedMultiplier:0.18 }}, tags:['speed'] },
  black_iron_talisman: { id:'black_iron_talisman', name:'玄铁护符', category:'growth', description:'最大生命 +25；当前生命 +25；防御 +1', levelText:{1:'最大生命 +25\n当前生命 +25\n防御 +1',2:'最大生命额外 +15\n防御额外 +1'}, instantByLevel:{1:{ maxHp:25, heal:25, defense:1 },2:{ maxHp:15, heal:15, defense:1 }}, tags:['survival',TAGS.SHIELD] },
  rejuvenation_jade: { id:'rejuvenation_jade', name:'回春佩', category:'mechanic', description:'每击杀5个敌人恢复8点生命；满血转化为护盾', levelText:{1:'每 5 次击杀恢复 8 点生命，满血转护盾',2:'每 5 次击杀恢复 12 点生命，满血转护盾'}, listenEvent:CombatEvents.ENEMY_KILLED, internalCooldownMs:0, tags:[TAGS.HEALING,TAGS.SHIELD] },
  heart_guard_mirror: { id:'heart_guard_mirror', name:'护心镜', category:'mechanic', description:'每次进入精英或 Boss 战时获得20点护盾', levelText:{1:'进入精英或 Boss 战获得 20 护盾',2:'进入精英或 Boss 战获得 30 护盾'}, listenEvent:CombatEvents.BOSS_SPAWNED, extraListenEvents:[CombatEvents.ELITE_SPAWNED], internalCooldownMs:0, tags:[TAGS.SHIELD] },
  army_breaker_token: { id:'army_breaker_token', name:'破军令', category:'mechanic', description:'生命高于80%时普通攻击和技能伤害 +18%', levelText:{1:'生命高于 80% 时，普通攻击和技能伤害 +18%',2:'生命高于 80% 时，普通攻击和技能伤害 +25%'}, tags:['damage'], supportedTags:[TAGS.NORMAL_ATTACK,TAGS.ACTIVE_SKILL] },
  flame_heart: { id:'flame_heart', name:'炎心', category:'synergy', requiredSkillId:'fireball', description:'火球命中附加燃烧，燃烧击杀引发火焰爆发', levelText:{1:'火球命中附加燃烧',2:'火球命中附加更强燃烧'}, listenEvent:CombatEvents.SKILL_HIT, internalCooldownMs:250, tags:[TAGS.FIRE,'burn'], affectedTags:[TAGS.FIRE], synergyTags:[TAGS.DOT] },
  venom_sac: { id:'venom_sac', name:'毒囊', category:'synergy', requiredSkillId:'poison_cloud', description:'毒云持续更久，中毒死亡扩散范围增加', levelText:{1:'毒云持续 +1.2 秒，扩散范围增加',2:'毒云持续 +1.8 秒，扩散范围进一步增加'}, listenEvent:CombatEvents.SKILL_HIT, internalCooldownMs:250, tags:[TAGS.POISON], affectedTags:[TAGS.POISON,TAGS.DOT] },
  wind_wheel: { id:'wind_wheel', name:'风轮', category:'synergy', requiredSkillId:'spinning_blade', description:'旋转刃命中缩短下一次旋转刃冷却', levelText:{1:'旋转刃命中缩短冷却 180ms',2:'旋转刃命中缩短冷却 260ms'}, listenEvent:CombatEvents.SKILL_HIT, internalCooldownMs:80, tags:['physical','area'], affectedTags:[TAGS.MELEE,TAGS.ACTIVE_SKILL] },
};

export const getArtifactLevelText = (id, level=1) => ARTIFACTS[id]?.levelText?.[level] || ARTIFACTS[id]?.description || '';
