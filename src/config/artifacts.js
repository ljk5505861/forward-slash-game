import { CombatEvents } from '../core/CombatEvents.js';
import { TAGS } from './tags.js';

export const ARTIFACT_CATEGORIES = Object.freeze({
  growth: { id:'growth', name:'通用成长型' },
  mechanic: { id:'mechanic', name:'独立机制型' },
  synergy: { id:'synergy', name:'技能联动型' },
});

export const ARTIFACTS = {
  thunder_orb: { id:'thunder_orb', name:'雷鸣珠', category:'growth', description:'暴击率 +5%；暴击时额外召唤落雷', levelText:{1:'暴击率 +5%；暴击时额外召唤落雷',2:'暴击率 +8%；暴击时额外召唤落雷'}, listenEvent:CombatEvents.PLAYER_CRIT, internalCooldownMs:1200, statBonusByLevel:{1:{ critChance:0.05 },2:{ critChance:0.08 }}, tags:[TAGS.LIGHTNING,TAGS.CRITICAL], affectedTags:[TAGS.CRITICAL] },
  blood_jade: { id:'blood_jade', name:'血玉', category:'mechanic', description:'击杀回复生命，满血时转化为护盾', levelText:{1:'击杀回复 6/12/18 生命，满血时转化为护盾',2:'击杀回复 8/16/24 生命，满血时转化为护盾'}, listenEvent:CombatEvents.ENEMY_KILLED, internalCooldownMs:300, tags:[TAGS.HEALING,TAGS.SHIELD,TAGS.BUILD_DEFENSE] },
  battle_mark: { id:'battle_mark', name:'战意印', category:'mechanic', description:'普攻与飞剑积累战意；满层时由重击或飞剑引爆额外伤害', levelText:{1:'普攻与飞剑积累战意，5层时由重击或飞剑引爆',2:'普攻与飞剑积累战意，4层时由重击或飞剑引爆'}, listenEvent:CombatEvents.PLAYER_HIT, extraListenEvents:[CombatEvents.SWORD_ATTACKED], internalCooldownMs:0, tags:['physical',TAGS.BUILD_STRENGTH,TAGS.BUILD_SWORD], supportedTags:[TAGS.NORMAL_ATTACK,TAGS.HEAVY_HIT,TAGS.SUMMON] },
  whetstone: { id:'whetstone', name:'磨锋石', category:'growth', description:'获得时攻击力 +15%', levelText:{1:'攻击力 +15%',2:'攻击力 +23%'}, statBonusByLevel:{1:{ attackMultiplier:1.15 },2:{ attackMultiplier:1.23 }}, tags:['attack',TAGS.BUILD_STRENGTH], supportedTags:[TAGS.NORMAL_ATTACK,TAGS.HEAVY_HIT] },
  gale_feather: { id:'gale_feather', name:'疾风羽', category:'growth', description:'获得时攻击速度 +12%', levelText:{1:'攻击速度 +12%',2:'攻击速度 +18%'}, statBonusByLevel:{1:{ attackSpeedMultiplier:0.12 },2:{ attackSpeedMultiplier:0.18 }}, tags:['speed',TAGS.BUILD_AFTERIMAGE,TAGS.BUILD_STRENGTH] },
  black_iron_talisman: { id:'black_iron_talisman', name:'玄铁护符', category:'growth', description:'最大生命 +25；当前生命 +25；防御 +1', levelText:{1:'最大生命 +25\n当前生命 +25\n防御 +1',2:'最大生命额外 +15\n防御额外 +1'}, instantByLevel:{1:{ maxHp:25, heal:25, defense:1 },2:{ maxHp:15, heal:15, defense:1 }}, tags:['survival',TAGS.SHIELD,TAGS.BUILD_DEFENSE] },
  rejuvenation_jade: { id:'rejuvenation_jade', name:'回春佩', category:'mechanic', description:'每击杀5个敌人恢复8点生命；满血时转化为护盾', levelText:{1:'每5次击杀恢复8点生命，满血时转化为护盾',2:'每5次击杀恢复12点生命，满血时转化为护盾'}, listenEvent:CombatEvents.ENEMY_KILLED, internalCooldownMs:0, tags:[TAGS.HEALING,TAGS.SHIELD,TAGS.BUILD_DEFENSE] },
  heart_guard_mirror: { id:'heart_guard_mirror', name:'护心镜', category:'mechanic', description:'进入精英或Boss战时获得20点护盾', levelText:{1:'进入精英或Boss战时获得20点护盾',2:'进入精英或Boss战时获得30点护盾'}, listenEvent:CombatEvents.BOSS_SPAWNED, extraListenEvents:[CombatEvents.ELITE_SPAWNED], internalCooldownMs:0, tags:[TAGS.SHIELD,TAGS.BUILD_DEFENSE] },
  army_breaker_token: { id:'army_breaker_token', name:'破军令', category:'mechanic', description:'生命高于80%时，普通攻击与主动技能伤害 +18%', levelText:{1:'生命高于80%时，普通攻击与主动技能伤害 +18%',2:'生命高于80%时，普通攻击与主动技能伤害 +25%'}, tags:['damage',TAGS.BUILD_STRENGTH,TAGS.BUILD_FIRE,TAGS.BUILD_POISON_SUMMON], supportedTags:[TAGS.NORMAL_ATTACK,TAGS.ACTIVE_SKILL] },
  flame_heart: { id:'flame_heart', name:'炎心', category:'synergy', requiredSkillId:'fireball', description:'强化火焰流：灼烧达到5层燃爆时提高火焰伤害', levelText:{1:'灼烧达到5层燃爆时提高火焰伤害',2:'灼烧达到5层燃爆时进一步提高火焰伤害'}, listenEvent:CombatEvents.STATUS_STACK_CHANGED, internalCooldownMs:250, tags:[TAGS.FIRE,TAGS.DOT,TAGS.BUILD_FIRE], affectedTags:[TAGS.FIRE,TAGS.DOT], synergyTags:[TAGS.BUILD_FIRE] },
  venom_sac: { id:'venom_sac', name:'毒囊', category:'synergy', requiredSkillId:'poison_cloud', description:'毒针施加中毒时，额外增加1层、延长1.2秒，并提高3层上限', levelText:{1:'中毒额外 +1层；持续 +1.2秒；层数上限 +3',2:'中毒额外 +1层；持续时间和层数上限进一步提高'}, listenEvent:CombatEvents.STATUS_APPLIED, internalCooldownMs:250, tags:[TAGS.POISON,TAGS.DOT,TAGS.BUILD_POISON_SUMMON], affectedTags:[TAGS.POISON,TAGS.DOT], synergyTags:[TAGS.BUILD_POISON_SUMMON] },
  wind_wheel: { id:'wind_wheel', name:'震岳轮', category:'synergy', requiredSkillId:'spinning_blade', description:'重击命中时，对目标附近敌人造成35%震荡伤害', levelText:{1:'重击命中时，对附近敌人造成35%震荡伤害',2:'重击震荡范围与伤害进一步提高'}, listenEvent:CombatEvents.PLAYER_HEAVY_HIT, internalCooldownMs:80, tags:['physical',TAGS.HEAVY_HIT,TAGS.BUILD_STRENGTH], affectedTags:[TAGS.MELEE,TAGS.HEAVY_HIT], synergyTags:[TAGS.BUILD_STRENGTH] },
};

export const getArtifactLevelText = (id, level=1) => ARTIFACTS[id]?.levelText?.[level] || ARTIFACTS[id]?.description || '';
