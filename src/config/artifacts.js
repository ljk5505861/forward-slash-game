import { CombatEvents } from '../core/CombatEvents.js';
export const ARTIFACTS = {
  thunder_orb: { id:'thunder_orb', name:'雷鸣珠', description:'暴击时额外落雷', listenEvent:CombatEvents.PLAYER_CRIT, internalCooldownMs:1200, tags:['lightning'] },
  blood_jade: { id:'blood_jade', name:'血玉', description:'击杀后回复生命', listenEvent:CombatEvents.ENEMY_KILLED, internalCooldownMs:300, tags:['heal'] },
  flame_heart: { id:'flame_heart', name:'炎心', description:'火焰技能命中附加燃烧', listenEvent:CombatEvents.SKILL_HIT, internalCooldownMs:350, tags:['fire','burn'] },
};
