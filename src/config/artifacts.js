import { CombatEvents } from '../core/CombatEvents.js';
export const ARTIFACTS = {
  thunder_orb: { id:'thunder_orb', name:'雷鸣珠', description:'暴击触发额外落雷；拥有落雷后强化，Lv.3 额外弹跳', listenEvent:CombatEvents.PLAYER_CRIT, internalCooldownMs:1200, tags:['lightning'] },
  blood_jade: { id:'blood_jade', name:'血玉', description:'击杀回复生命，满血转化为护盾', listenEvent:CombatEvents.ENEMY_KILLED, internalCooldownMs:300, tags:['heal'] },
  flame_heart: { id:'flame_heart', name:'炎心', description:'火焰命中附加燃烧，燃烧击杀引发火焰爆发', listenEvent:CombatEvents.SKILL_HIT, internalCooldownMs:250, tags:['fire','burn'] },
  venom_sac: { id:'venom_sac', name:'毒囊', description:'毒持续更久，中毒死亡扩散范围增加', listenEvent:CombatEvents.SKILL_HIT, internalCooldownMs:250, tags:['poison'] },
  wind_wheel: { id:'wind_wheel', name:'风轮', description:'旋转刃命中缩短下一次旋转刃冷却', listenEvent:CombatEvents.SKILL_HIT, internalCooldownMs:80, tags:['physical','area'] },
  battle_mark: { id:'battle_mark', name:'战意印', description:'普通攻击累计战意，5 层强化下个自动技能', listenEvent:CombatEvents.PLAYER_HIT, internalCooldownMs:0, tags:['physical'] },
};
