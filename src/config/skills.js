export const SKILLS = {
  fireball: { id:'fireball', name:'火球', tags:['fire'], maxLevel:3, cooldownMs:1800, targetType:'nearestAhead', triggerType:'autoAttack', color:0xff6533, short:'火', levels:[{damage:30,radius:0},{damage:42,radius:45},{damage:56,radius:70}] },
  lightning: { id:'lightning', name:'落雷', tags:['lightning'], maxLevel:3, cooldownMs:2300, targetType:'random', triggerType:'autoAttack', color:0x66ccff, short:'雷', levels:[{damage:24,bounces:0},{damage:30,bounces:1},{damage:38,bounces:2}] },
  spinning_blade: { id:'spinning_blade', name:'旋转刃', tags:['physical','area'], maxLevel:3, cooldownMs:2600, targetType:'aroundPlayer', triggerType:'autoAttack', color:0xd7d7d7, short:'刃', levels:[{damage:16,radius:150},{damage:22,radius:185},{damage:30,radius:220}] },
  healing: { id:'healing', name:'治愈术', tags:['heal'], maxLevel:3, cooldownMs:6500, targetType:'self', triggerType:'lowHp', color:0x66dd77, short:'愈', levels:[{heal:24,threshold:0.6},{heal:34,threshold:0.6,cooldownMs:5600},{heal:46,threshold:0.65,cooldownMs:4800}] },
};
