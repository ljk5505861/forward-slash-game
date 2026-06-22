export const SHOP_ITEMS = [
  { id:'whetstone', name:'磨锋石', icon:'◇', description:'攻击力 +10%', price:25, effect:p=>{ p.attack=Math.round(p.attack*1.10); }, stat:'attack' },
  { id:'arcane_dust', name:'奥术粉尘', icon:'✦', description:'技能伤害 +12%', price:30, effect:p=>{ p.skillDamageMultiplier=Number(((p.skillDamageMultiplier||1)+0.12).toFixed(3)); }, stat:'skillDamageMultiplier' },
  { id:'cooldown_gear', name:'冷却齿轮', icon:'⚙', description:'冷却缩减 +8%', price:35, effect:p=>{ p.cooldownReduction=Math.min(0.5,Number(((p.cooldownReduction||0)+0.08).toFixed(3))); }, stat:'cooldownReduction' },
  { id:'life_fruit', name:'生命果实', icon:'●', description:'最大生命 +15%，并恢复增加生命', price:30, effect:p=>{ const before=p.maxHp; p.maxHp=Math.round(p.maxHp*1.15); p.hp=Math.min(p.maxHp,(p.hp||0)+(p.maxHp-before)); }, stat:'maxHp' },
  { id:'armor_plate', name:'铁甲片', icon:'▣', description:'受到伤害降低 5%', price:40, effect:p=>{ p.damageReduction=Math.min(0.6,Number(((p.damageReduction||0)+0.05).toFixed(3))); }, stat:'damageReduction' },
  { id:'swift_feather', name:'迅捷羽毛', icon:'➤', description:'攻击速度 +10%', price:25, effect:p=>{ p.attackSpeedMultiplier=Number(((p.attackSpeedMultiplier||1)+0.10).toFixed(3)); }, stat:'attackSpeedMultiplier' },
  { id:'vampire_charm', name:'吸血符', icon:'♦', description:'吸血 +3%', price:45, effect:p=>{ p.lifeSteal=Math.min(0.3,Number(((p.lifeSteal||0)+0.03).toFixed(3))); }, stat:'lifeSteal' },
  { id:'crit_badge', name:'暴击徽章', icon:'✹', description:'暴击率 +5%', price:40, effect:p=>{ p.critChance=Math.min(0.8,Number(((p.critChance||0)+0.05).toFixed(3))); }, stat:'critChance' },
];
