// Normal-mode attributes stack additively; later visits unlock larger purchases.
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
const attributeEffects = {
  attack:(p,n)=>bonus(p,'attackBonuses','shop_attributes',n),
  strength:(p,n)=>bonus(p,'strengthBonuses','shop_attributes',n),
  attackSpeed:(p,n)=>bonus(p,'attackSpeedMultiplierBonuses','shop_attributes',n),
  moveSpeed:(p,n)=>bonus(p,'moveSpeedMultiplierBonuses','shop_attributes',n),
  defense:(p,n)=>bonus(p,'defenseBonuses','shop_attributes',n),
  maxHp:(p,n)=>resource(p,'hp',n),
  maxMana:(p,n)=>resource(p,'mana',n),
  lifeSteal:(p,n)=>bonus(p,'lifeStealBonuses','shop_attributes',n),
  critChance:(p,n)=>scalar(p,'critChance',n),
  critMultiplier:(p,n)=>bonus(p,'critMultiplierBonuses','shop_attributes',n),
  armorPenetration:(p,n)=>bonus(p,'armorPenetrationBonuses','shop_attributes',n),
  healthRegen:(p,n)=>bonus(p,'healthRegenPerSecondBonuses','shop_attributes',n),
  manaRegen:(p,n)=>bonus(p,'manaRegenPerSecondBonuses','shop_attributes',n),
  attackRange:(p,n)=>bonus(p,'attackRangeMultiplierBonuses','shop_attributes',n),
  healingReceived:(p,n)=>bonus(p,'healingReceivedMultiplierBonuses','shop_attributes',n),
  damageReduction:(p,n)=>bonus(p,'damageReductionBonuses','shop_attributes',n),
  skillDamage:(p,n)=>scalar(p,'skillDamageMultiplier',n),
  cooldownReduction:(p,n)=>scalar(p,'cooldownReduction',n),
};
const attributeItem = (id,name,description,price,icon,color,attributes,minVisit=1) => ({
  id,name,description,price,icon,color,attributes,minVisit,kind:'item',
  rarity:minVisit>=5?'EPIC':minVisit>=3?'RARE':price>=20?'FINE':'COMMON',
  stat:Object.keys(attributes).length===1?Object.keys(attributes)[0]:'attributes',
  effect:p=>Object.entries(attributes).forEach(([key,n])=>attributeEffects[key](p,n)),
  remove:p=>Object.entries(attributes).forEach(([key,n])=>attributeEffects[key](p,-n)),
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
  attributeItem('light_boots','轻羽靴','移动速度 +5%',8,'boot',0x9edaca,{moveSpeed:.05}),
  attributeItem('blood_fang','血牙','吸血 +2个百分点；允许吸血的实际伤害累计回血',16,'drop',0xd86b83,{lifeSteal:.02}),
  attributeItem('armor_piercer','穿甲锥','物理伤害无视目标1点防御，最低降至0',8,'pierce',0xd7c1a0,{armorPenetration:1}),
  attributeItem('regen_sprout','再生嫩芽','每秒生命恢复 +0.5；战斗和赶路均生效',14,'sprout',0x83d58b,{healthRegen:.5}),
  attributeItem('long_handle','长柄配件','普通攻击距离 +5%',10,'range',0xb9c8e7,{attackRange:.05}),
  attributeItem('revival_leaf','复苏叶','自身获得的治疗量 +5%，包括自然恢复和吸血',10,'leaf',0x8be2bc,{healingReceived:.05}),
  attributeItem('ward_scale','护体鳞片','受到的伤害减少2%',16,'scale',0x8dacf0,{damageReduction:.02}),
  attributeItem('steel_blade','精钢刃','攻击 +3',22,'blade',0xb8d6ef,{attack:3}),
  attributeItem('giant_bracer','巨力护腕','力量 +3（同时增加攻击）',32,'bracer',0xc9966b,{strength:3}),
  attributeItem('thick_life_stone','厚重生命石','最大生命 +150，同时恢复150生命',38,'heart',0xea718c,{maxHp:150}),
  attributeItem('regen_branch','再生枝条','每秒生命恢复 +1.5',36,'sprout',0x5cbf85,{healthRegen:1.5}),
  attributeItem('giant_blade','巨刃','攻击 +8',58,'blade',0xd8d9eb,{attack:8},2),
  attributeItem('mighty_armlet','巨力臂环','力量 +6（同时增加攻击）',64,'bracer',0xe6af74,{strength:6},2),
  attributeItem('steel_plate','钢铁胸甲','防御 +6',54,'shield',0xa8bbc9,{defense:6},2),
  attributeItem('giant_belt','巨人腰带','最大生命 +300，同时恢复300生命',76,'heart',0xe65d7a,{maxHp:300},2),
  attributeItem('regen_orb','再生宝珠','每秒生命恢复 +2',50,'sprout',0x5ce59a,{healthRegen:2},2),
  attributeItem('vampire_fang','血族獠牙','吸血 +8个百分点',58,'drop',0xdc416e,{lifeSteal:.08},2),
  attributeItem('eagle_jewel','猎鹰宝钻','暴击率 +12个百分点',56,'eye',0xffdb80,{critChance:.12},2),
  attributeItem('storm_gloves','风暴手套','攻击速度 +25%',54,'glove',0x9bdbea,{attackSpeed:.25},2),
  attributeItem('arcane_jewel','秘法宝钻','最大法力 +100，同时恢复100法力；每秒法力恢复 +1',110,'crystal',0x72cfff,{maxMana:100,manaRegen:1},3),
  attributeItem('war_axe','战争重斧','攻击 +12；力量 +6（同时增加攻击）',148,'blade',0xd5a679,{attack:12,strength:6},3),
  attributeItem('gale_crown','烈风王冠','攻速 +35%；暴击率 +12个百分点；移动速度 +15%',150,'feather',0x91e0e5,{attackSpeed:.35,critChance:.12,moveSpeed:.15},3),
  attributeItem('sage_tome','贤者法典','技能伤害 +60%；冷却缩减 +10个百分点；最大法力 +100并恢复100法力',250,'rune',0xb8a1ff,{skillDamage:.6,cooldownReduction:.1,maxMana:100},3),
  attributeItem('end_blade','终焉之刃','攻击 +25；攻速 +25%；暴伤倍率 +0.5',300,'blade',0xd4a0fb,{attack:25,attackSpeed:.25,critMultiplier:.5},5),
  attributeItem('blood_core','神血心核','最大生命 +1000并恢复1000生命；每秒生命恢复 +2',300,'heart',0xf371a5,{maxHp:1000,healthRegen:2},5),
  attributeItem('guardian_armor','守护重甲','最大生命 +800并恢复800生命；防御 +10；受到伤害减少5%',330,'shield',0xb19eff,{maxHp:800,defense:10,damageReduction:.05},5),
  attributeItem('eternal_mana_core','永恒魔核','最大法力 +200并恢复200法力；每秒回蓝 +3；技能伤害 +40%',360,'crystal',0xa7a1ff,{maxMana:200,manaRegen:3,skillDamage:.4},5),
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
