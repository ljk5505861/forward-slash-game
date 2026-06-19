import { CombatEvents } from '../core/CombatEvents.js';

export const ARTIFACT_CATEGORIES = Object.freeze({
  growth: { id:'growth', name:'通用成长型' },
  mechanic: { id:'mechanic', name:'独立机制型' },
  synergy: { id:'synergy', name:'技能联动型' },
});

export const ARTIFACTS = {
  thunder_orb: { id:'thunder_orb', name:'雷鸣珠', category:'growth', description:'暴击率 +5%；暴击触发额外落雷，拥有落雷后强化', listenEvent:CombatEvents.PLAYER_CRIT, internalCooldownMs:1200, statBonus:{ critChance:0.05 }, tags:['lightning'] },
  blood_jade: { id:'blood_jade', name:'血玉', category:'mechanic', description:'击杀回复生命，满血转化为护盾', listenEvent:CombatEvents.ENEMY_KILLED, internalCooldownMs:300, tags:['heal'] },
  flame_heart: { id:'flame_heart', name:'炎心', category:'synergy', requiredSkillId:'fireball', description:'火球命中附加燃烧，燃烧击杀引发火焰爆发', listenEvent:CombatEvents.SKILL_HIT, internalCooldownMs:250, tags:['fire','burn'] },
  venom_sac: { id:'venom_sac', name:'毒囊', category:'synergy', requiredSkillId:'poison_cloud', description:'毒云持续更久，中毒死亡扩散范围增加', listenEvent:CombatEvents.SKILL_HIT, internalCooldownMs:250, tags:['poison'] },
  wind_wheel: { id:'wind_wheel', name:'风轮', category:'synergy', requiredSkillId:'spinning_blade', description:'旋转刃命中缩短下一次旋转刃冷却', listenEvent:CombatEvents.SKILL_HIT, internalCooldownMs:80, tags:['physical','area'] },
  battle_mark: { id:'battle_mark', name:'战意印', category:'mechanic', description:'普通攻击累计战意，5 层强化下个自动技能', listenEvent:CombatEvents.PLAYER_HIT, internalCooldownMs:0, tags:['physical'] },
};
