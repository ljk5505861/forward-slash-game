// Normal-mode items are deliberately small, repeatable additions.
// Test mode retains its previous catalog below.
const bonus = (p, bucket, id, amount) => {
  p[bucket] ||= {};
  const next = Math.round(((p[bucket][id] || 0) + amount) * 1e8) / 1e8;
  if (Math.abs(next) < 1e-7) delete p[bucket][id]; else p[bucket][id] = next;
};
const scalar = (p, key, amount) => { p[key] = Math.round(((p[key] || 0) + amount) * 1e8) / 1e8; };
const resource = (p, key, amount) => {
  const max = key === 'hp' ? 'maxHp' : 'maxMana';
  const base = key === 'hp' ? 'baseMaxHp' : 'baseMaxMana';
  p[base] = (p[base] ?? p[max]) + amount;
  p[max] += amount;
  // Remove the same resource on sale: buying/selling cannot become free healing.
  p[key] = Math.min(p[max], Math.max(key === 'hp' && p[key] > 0 ? 1 : 0, p[key] + amount));
};
const item = (id, name, description, price, icon, color, stat, amount, apply) => ({
  id, name, description, price, icon, color, stat, amount, rarity:'COMMON', kind:'item',
  effect:p => apply(p, amount), remove:p => apply(p, -amount),
});
export const SHOP_ITEMS = [
  item('iron_blade','铁刃','攻击 +1',8,'blade',0xcbdbea,'attack',1,(p,n)=>bonus(p,'attackBonuses','shop_iron_blade',n)),
  item('strength_bracer','力量护腕','力量 +1（同时增加攻击）',12,'bracer',0xdc9869,'strength',1,(p,n)=>bonus(p,'strengthBonuses','shop_strength_bracer',n)),
  item('life_stone','生命石','最大生命 +50，同时恢复50生命',14,'heart',0xf27086,'maxHp',50,(p,n)=>resource(p,'hp',n)),
  item('mana_bead','蓄魔珠','最大法力 +10，同时恢复10法力',8,'bead',0x69bbff,'maxMana',10,(p,n)=>resource(p,'mana',n)),
  item('light_gloves','轻巧手套','攻击速度 +5%',12,'glove',0xe8c27a,'attackSpeedMultiplier',0.05,(p,n)=>bonus(p,'attackSpeedMultiplierBonuses','shop_light_gloves',n)),
  item('copper_guard','护身铜片','防御 +1',10,'shield',0xc99469,'defense',1,(p,n)=>bonus(p,'defenseBonuses','shop_copper_guard',n)),
  item('agility_charm','轻身符','闪避率 +2个百分点',12,'feather',0x7ed8bc,'dodgeChance',0.02,(p,n)=>bonus(p,'dodgeChanceBonuses','shop_agility_charm',n)),
  item('eagle_eye','鹰眼石','暴击率 +2个百分点',10,'eye',0xffd273,'critChance',0.02,(p,n)=>scalar(p,'critChance',n)),
  item('sharp_fang','尖牙','暴击伤害倍率 +0.05',8,'fang',0xe4eaf4,'critMultiplier',0.05,(p,n)=>bonus(p,'critMultiplierBonuses','shop_sharp_fang',n)),
  item('rune_shard','魔纹碎片','技能伤害 +5%',12,'rune',0xc0a0ff,'skillDamageMultiplier',0.05,(p,n)=>scalar(p,'skillDamageMultiplier',n)),
  item('battle_badge','战斗徽记','普通攻击伤害 +5%',8,'badge',0xf0b565,'normalAttackDamage',0.05,(p,n)=>bonus(p,'normalAttackDamageBonuses','shop_battle_badge',n)),
  item('hourglass_shard','沙漏碎片','冷却缩减 +2个百分点',12,'hourglass',0xe7d594,'cooldownReduction',0.02,(p,n)=>scalar(p,'cooldownReduction',n)),
  item('mana_crystal','回魔水晶','每秒法力恢复 +0.2',10,'crystal',0x68d5ec,'manaRegenPerSecond',0.2,(p,n)=>bonus(p,'manaRegenPerSecondBonuses','shop_mana_crystal',n)),
];
export const SHOP_SKILL_CHANCE = 0.25;
export const SHOP_SKILL_PRICES = Object.freeze({COMMON:20,FINE:28,RARE:40,EPIC:56,LEGENDARY:76,MYTHIC:100});
export const shopRefreshPrice = count => 4 + 2 * count;
export const shopSellPrice = paidPrice => Math.floor(paidPrice / 2);

export const LEGACY_SHOP_ITEMS = [
  { id:'whetstone', name:'磨锋石', icon:'◇', description:'攻击力 +10%', price:25, effect:p=>{ p.attack=Math.round(p.attack*1.10); }, stat:'attack' },
  { id:'arcane_dust', name:'奥术粉尘', icon:'✦', description:'技能伤害 +12%', price:30, effect:p=>{ p.skillDamageMultiplier=Number(((p.skillDamageMultiplier||1)+0.12).toFixed(3)); }, stat:'skillDamageMultiplier' },
  { id:'cooldown_gear', name:'冷却齿轮', icon:'⚙', description:'冷却缩减 +8%', price:35, effect:p=>{ p.cooldownReduction=Math.min(0.5,Number(((p.cooldownReduction||0)+0.08).toFixed(3))); }, stat:'cooldownReduction' },
  { id:'life_fruit', name:'生命果实', icon:'●', description:'最大生命 +15%，并恢复增加生命', price:30, effect:p=>{ const before=p.maxHp; p.maxHp=Math.round(p.maxHp*1.15); p.hp=Math.min(p.maxHp,(p.hp||0)+(p.maxHp-before)); }, stat:'maxHp' },
  { id:'armor_plate', name:'铁甲片', icon:'▣', description:'受到伤害降低 5%', price:40, effect:p=>{ p.damageReduction=Math.min(0.6,Number(((p.damageReduction||0)+0.05).toFixed(3))); }, stat:'damageReduction' },
  { id:'swift_feather', name:'迅捷羽毛', icon:'➤', description:'攻击速度 +10%', price:25, effect:p=>{ p.attackSpeedMultiplier=Number(((p.attackSpeedMultiplier||1)+0.10).toFixed(3)); }, stat:'attackSpeedMultiplier' },
  { id:'vampire_charm', name:'吸血符', icon:'♦', description:'吸血 +3%', price:45, effect:p=>{ p.lifeSteal=Math.min(0.3,Number(((p.lifeSteal||0)+0.03).toFixed(3))); }, stat:'lifeSteal' },
  { id:'crit_badge', name:'暴击徽章', icon:'✹', description:'暴击率 +5%', price:40, effect:p=>{ p.critChance=Math.min(0.8,Number(((p.critChance||0)+0.05).toFixed(3))); }, stat:'critChance' },
];
