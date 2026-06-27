import '../skills/handlers/index.js';
import { SKILLS } from '../config/skills.js';
import { SOUL_THRESHOLDS, SWORD_MYTHIC, getSwordFlowReadSnapshot, mainSwordStatsReadOnly, tombStatsReadOnly } from '../skills/handlers/SwordFlowState.js';

const QUALITY_NAMES={COMMON:'普通',RARE:'稀有',EPIC:'史诗',MYTHIC:'神话'};
const MYTHIC_NAMES={ [SWORD_MYTHIC.NONE]:'无', [SWORD_MYTHIC.MAIN]:'御剑术', [SWORD_MYTHIC.TOMB]:'剑冢' };
const BLOCKED=['该技能会在战斗中自动生效','技能说明缺失','造成伤害','提高属性','强化技能','效果增强','能力提升','提升当前技能关键数值','解锁新的战斗表现','关键数值方向明确变化'];

const FIELD_META=[
  ['damage','伤害','number'],['splitDamage','分裂伤害','number'],['zoneDamage','区域每次伤害','number'],['burstDamage','爆发伤害','number'],['burnBurstDamage','燃爆伤害','number'],['biteDamage','撕咬伤害','number'],['burstDamagePerStack','每层爆发伤害','number'],['burnDamage','灼烧每跳伤害','number'],['poisonDamage','中毒每跳伤害','number'],['basePoisonDamage','基础中毒伤害','number'],['flatDamage','固定伤害','number'],
  ['attackBonus','攻击加成','number'],['knockbackBonus','额外击退距离','distance'],['defense','防御','number'],['defenseBonus','防御加成','number'],['maxShieldBonus','最大护盾增加','number'],['flatShield','固定护盾','number'],['hp','生命值','number'],['healPerSecondCap','每秒治疗上限','number'],['manaCost','法力消耗','number'],
  ['cooldownMs','冷却时间','seconds'],['attackIntervalMs','攻击间隔','seconds'],['intervalMs','攻击/结算间隔','seconds'],['warmupMs','温养时间','seconds'],['durationMs','持续时间','seconds'],['internalCooldownMs','内部冷却','seconds'],['baseCooldownMs','基础生成间隔','seconds'],['minCooldownMs','最短生成间隔','seconds'],['echoDelayMs','残影出手间隔','seconds'],['phaseDurationMs','虚化时间','seconds'],['activeCooldownReduceMs','主动技能减冷却','seconds'],['gainIntervalMs','叠层间隔','seconds'],['graceMs','保留时间','seconds'],['armorBreakMs','破甲持续时间','seconds'],['streakWindowMs','连续闪避窗口','seconds'],['streakReductionMs','每次连闪减冷却','seconds'],['highSpeedIntervalMs','高速积层间隔','seconds'],['eventThrottleMs','同类事件间隔','seconds'],['decayIntervalMs','层数衰减间隔','seconds'],['reviveIntervalMs','重新播种间隔','seconds'],['extendMs','中毒延长时间','seconds'],['poisonMs','中毒持续时间','seconds'],['poisonIntervalMs','中毒跳伤间隔','seconds'],['burnMs','灼烧持续时间','seconds'],['burnIntervalMs','灼烧跳伤间隔','seconds'],['basePoisonMs','基础中毒持续时间','seconds'],['basePoisonIntervalMs','基础中毒间隔','seconds'],['burnBurstCooldownMs','燃爆触发间隔','seconds'],['secondDelayMs','第二把剑延迟','seconds'],
  ['radius','范围','distance'],['range','射程','distance'],['burstRadius','爆发范围','distance'],['burnBurstRadius','燃爆范围','distance'],['spreadRadius','传播范围','distance'],['parasiteBurstRadius','寄生爆发范围','distance'],['kingRadiusBonus','毒王额外范围','distance'],['width','宽度','distance'],['projectileSpeed','飞行速度','number'],
  ['shots','发射数量','count'],['swords','飞剑数量','count'],['suns','太阳数量','count'],['pierce','命中目标数','count'],['splitCount','每次分裂数量','count'],['maxSplitGeneration','最大分裂代数','count'],['maxSeedsPerCast','单次最多火种','count'],['maxStacks','最大层数','count'],['poisonStacks','施加中毒层数','count'],['burnStacks','施加灼烧层数','count'],['retainBurnStacksAfterBurst','燃爆后保留层数','count'],['heavyHitEvery','重击触发所需攻击数','count'],['maxAfterimages','最大残影数','count'],['maxCopyAfterimages','参与继承的残影数','count'],['maxLinks','最大连接目标','count'],['maxCount','最大召唤数量','count'],['baseCount','基础召唤数量','count'],['stacksPerExtra','每增加一只所需层数','count'],['maxGrowth','成长上限','number'],['volley','每轮剑数','count'],['spreadTargets','传播目标数','count'],['insectPoisonStacks','毒虫施加中毒层数','count'],['burstStackThreshold','爆发所需感染层数','count'],['burstMaxStacks','爆发计算层数上限','count'],['burstPoisonStacks','爆发附加中毒层数','count'],
  ['damageReduction','伤害减免','percent'],['dodgeChance','闪避率','percent'],['critChance','暴击率','percent'],['critMultiplierBonus','额外暴击伤害','percent'],['lifeSteal','普通攻击吸血','percent'],['heavyLifeSteal','重击额外吸血','percent'],['heavyHitLifeSteal','重击吸血','percent'],['triggerRatio','触发生命线','percent'],['rearmRatio','重新待命生命线','percent'],['damageBonus','伤害加成','percent'],['heavyDamageBonus','重击伤害加成','percent'],['lifeStealBonus','吸血加成','percent'],['heavyLifeStealBonus','重击吸血加成','percent'],['attackSpeedBonus','攻击速度加成','percent'],['moveSpeedBonus','移动速度加成','percent'],['afterimageDamageBonus','残影伤害加成','percent'],['dodgeBonus','闪避加成','percent'],['physicalVulnerability','目标受到物理伤害增加','percent'],['defensePerStack','每层防御加成','number'],['damageReductionPerStack','每层伤害减免','percent'],['healingReceivedBonus','受到治疗加成','percent'],['absorbRatio','毒伤吸收比例','percent'],['sufferedRatio','本次承伤附加','percent'],['regenRatio','护盾再生比例','percent'],['damageRatio','伤害比例','percent'],['executeRatio','斩杀线','percent'],['copyDamageRatio','继承伤害比例','percent'],['guGrowthContributionRatio','寄生成长贡献比例','percent'],['consumeRatio','感染吞噬比例','percent'],['absorbBonus','寄生吸收加成','percent'],['growthCapBonus','寄生成长上限加成','percent'],['guDamageBonus','寄生伤害加成','percent'],['insectDamageBonus','毒虫伤害加成','percent'],['insectAttackSpeedBonus','毒虫攻速加成','percent'],['insectExtendBonus','毒虫延长加成','percent'],['spreadChance','传播概率','percent'],['kingChanceBonus','毒王传播概率加成','percent'],['healRatio','伤害转治疗比例','percent'],['secondarySunDamageMultiplier','第二太阳伤害比例','percent'],['explosionScale','爆炸伤害比例','percent'],['secondGenerationScale','后续分裂伤害比例','percent'],['lifeStealScale','残影吸血比例','percent'],
  ['heavyHitMultiplier','重击伤害倍率','multiplier'],['defenseScale','防御系数','multiplier'],['defenseIgnore','防御无视','percent'],['shieldDefenseScale','护盾防御系数','multiplier'],['endShieldMultiplier','结束护盾倍率','multiplier'],['sizeScale','剑体尺寸倍率','multiplier'],['shadowSwordDamageRatio','影剑伤害比例','percent'],['shadowSwordIntervalMultiplier','影剑攻击间隔倍率','multiplier'],['damagePerGrowth','每点成长伤害','number'],
  ['extraSeedOnBurning','灼烧目标额外生成火种','boolean'],['endShockwave','结束时再次释放震荡','boolean'],['inheritHalfStatusStacks','继承一半异常层数','boolean'],['allAfterimages','全部残影参与继承','boolean']
];

const numberText=value=>{ const n=Number(value); if(!Number.isFinite(n)) return String(value); if(n===Number.MAX_SAFE_INTEGER) return '全部'; return Number.isInteger(n)?String(n):String(Math.round(n*100)/100); };
const percentText=value=>`${Math.round((Number(value)||0)*1000)/10}%`;
const secondsText=value=>`${numberText((Number(value)||0)/1000)}秒`;
const fmt=(type,value)=>{ if(type==='seconds') return secondsText(value); if(type==='percent') return percentText(value); if(type==='multiplier') return `${numberText(value)}倍`; if(type==='boolean') return value?'是':'否'; return numberText(value); };
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function tierText(tiers=[]){
  return tiers.map(t=>{ const heavy=t[3]?`、重击伤害+${percentText(t[3])}`:''; return `生命≤${percentText(t[0])}：攻速+${percentText(t[1])}、伤害+${percentText(t[2])}${heavy}`; }).join('；');
}
function fireSeedBonusText(value={}){ return `分裂数量+${numberText(value.splitCountBonus||0)}、额外分裂代数+${numberText(value.maxGenerationBonus||0)}、飞行速度×${numberText(value.speedMultiplier||1)}`; }
function specialLines(data={}){
  const lines=[];
  if(Array.isArray(data.tiers)) lines.push(`狂怒分档：${tierText(data.tiers)}`);
  if(data.fireSeedBonus) lines.push(`火种强化：${fireSeedBonusText(data.fireSeedBonus)}`);
  return lines;
}
function linesFromData(data={}){
  return [...FIELD_META.filter(([key])=>data[key]!==undefined).map(([key,label,type])=>`${label}：${fmt(type,data[key])}`),...specialLines(data)];
}
function diff(a={},b={}){
  const lines=FIELD_META.filter(([key])=>b[key]!==undefined&&!same(a[key],b[key])).map(([key,label,type])=>`${label}：${a[key]===undefined?'未解锁':fmt(type,a[key])} → ${fmt(type,b[key])}`);
  if(!same(a.tiers,b.tiers)&&Array.isArray(b.tiers)) lines.push(`狂怒分档：${Array.isArray(a.tiers)?tierText(a.tiers):'未解锁'} → ${tierText(b.tiers)}`);
  if(!same(a.fireSeedBonus,b.fireSeedBonus)&&b.fireSeedBonus) lines.push(`火种强化：${a.fireSeedBonus?fireSeedBonusText(a.fireSeedBonus):'未解锁'} → ${fireSeedBonusText(b.fireSeedBonus)}`);
  return lines;
}

function nextPreview(cfg,level,data,next){
  if(!next) return ['已达到最高等级'];
  const changes=diff(data,next);
  if(changes.length) return changes;
  const text=next.desc||cfg.levels?.[level]?.milestoneText||cfg.description;
  return text?[`下一等级机制：${text}`]:[];
}
function milestones(cfg,level){
  return [3,6,9].map(target=>{
    const current=cfg.levels?.[target-1]||{};
    const previous=cfg.levels?.[Math.max(0,target-2)]||{};
    const explicit=cfg.milestones?.[target]||current.milestoneText;
    const changes=diff(previous,current);
    const derived=changes.length?changes.join('，'):(current.desc||cfg.description);
    const text=explicit?(explicit.length>6?explicit:`${explicit}：${derived}`):derived;
    return { level:target, unlocked:level>=target, text };
  });
}

export function getSkillDetailData(skillId,context={}){
  const cfg=SKILLS[skillId]; if(!cfg) return null;
  const owned=context.scene?.playerData?.skills?.find(s=>s.id===skillId)||context.skill||{level:1};
  const level=Math.max(1,Math.min(cfg.maxLevel||1,owned.level||1));
  if(skillId==='sword_wave') return swordDetail(cfg,level,context);
  if(skillId==='sword_tomb') return tombDetail(cfg,level,context);
  const data=cfg.levels?.[level-1]||{};
  const next=cfg.levels?.[level]||null;
  const displayData={...data};
  if(displayData.manaCost===undefined&&cfg.manaCost!==undefined) displayData.manaCost=cfg.manaCost;
  const currentEffects=linesFromData(displayData);
  return { name:cfg.name,level,maxLevel:cfg.maxLevel||1,description:cfg.description,currentEffects:currentEffects.length?currentEffects:[data.desc||cfg.description],mechanics:[data.desc||cfg.description],milestones:milestones(cfg,level),nextLevelPreview:nextPreview(cfg,level,data,next),progress:`${level}/${cfg.maxLevel||1}` };
}
function nextSoulThreshold(souls){ const next=SOUL_THRESHOLDS.find(value=>value>souls); return next===undefined?null:next; }
function swordDetail(cfg,level,{scene}={}){
  const sys=scene?.skillSystem; const data=sys?.getData?.('sword_wave',level)||cfg.levels[level-1]; const snapshot=sys?getSwordFlowReadSnapshot(sys):{}; const stats=sys?mainSwordStatsReadOnly(sys,data,snapshot):{}; const st=stats.state||snapshot||{}; const nextNeed=nextSoulThreshold(st.effectiveSouls||0);
  return { name:cfg.name,level,maxLevel:cfg.maxLevel,description:cfg.description,currentEffects:[`当前品质：${QUALITY_NAMES[stats.quality]||'普通'}`,`当前魂魄进度：${Math.floor(st.effectiveSouls||0)}/${nextNeed??SOUL_THRESHOLDS.at(-1)}`,`下一品质所需魂魄：${nextNeed??'已达到最高品质'}`,`当前伤害：${stats.damage??data.damage}`,`当前伤害倍率：${numberText((stats.damage||data.damage)/(data.damage||1))}倍`,`当前飞行速度倍率：${numberText(stats.speed||1)}倍`,`当前攻击间隔：${secondsText(stats.intervalMs??data.attackIntervalMs)}`,`当前剑体尺寸倍率：${numberText(stats.bodySize||1)}倍`,`当前剑光尺寸倍率：${numberText(stats.glowSize||1)}倍`,`当前额外暴击率：${percentText(stats.critChance||0)}`,`当前额外暴击伤害：${percentText(stats.critMultiplierBonus||0)}`,`当前神话名额归属：${MYTHIC_NAMES[st.mythicOwner]||'无'}`,`当前是否进入神话全敌连斩：${stats.mythic?'是':'否'}`,`当前火魂数量：${stats.fireSoul||0}`,`当前毒魂数量：${stats.poisonSoul||0}`],mechanics:['主剑品质、魂魄、攻击倍率和属性魂均读取当前战斗状态；查看详情不会修改状态。'],milestones:milestones(cfg,level),nextLevelPreview:nextPreview(cfg,level,data,cfg.levels[level]||null),progress:`${level}/${cfg.maxLevel}` };
}
function tombDetail(cfg,level,{scene}={}){
  const sys=scene?.skillSystem; const st=sys?getSwordFlowReadSnapshot(sys):{}; const data=sys?.getData?.('sword_tomb',level)||cfg.levels[level-1]; const stats=sys?tombStatsReadOnly(sys,data,st):{}; const executeRatio=data.executeRatio||0; const eliteExecuteRatio=executeRatio*0.6;
  return { name:cfg.name,level,maxLevel:cfg.maxLevel,description:cfg.description,currentEffects:[`当前总魂魄：${Math.floor(st.totalSouls||0)}`,`当前有效魂魄：${Math.floor(st.effectiveSouls||0)}`,`当前斩杀线：${percentText(executeRatio)}`,`当前精英斩杀线：${percentText(eliteExecuteRatio)}`,`Boss斩杀规则：不受百分比直接斩杀，改为承受3.2倍魂斩伤害`,`当前魂斩伤害：${stats.damage??data.damage}`,`当前魂斩间隔：${secondsText(stats.intervalMs??data.intervalMs)}`,`当前攻击范围：${data.range}`,`当前火魂数量：${st.affinities?.fire||0}`,`当前毒魂数量：${st.affinities?.poison||0}`,`魂魄提纯：${level>=6?'已解锁':'未解锁'}`,`火魂和毒魂附加效果：${level>=6?'已解锁':'未解锁'}`,`当前封神进度：${Math.floor(st.effectiveSouls||0)}/${SOUL_THRESHOLDS[3]}`,`当前神话名额归属：${MYTHIC_NAMES[st.mythicOwner]||'无'}`,`万魂剑域：${st.mythicOwner===SWORD_MYTHIC.TOMB?'已形成':'未形成'}`],mechanics:['魂魄、斩杀线、魂斩数值与神话名额均为只读快照；查看详情不会触发封神。'],milestones:milestones(cfg,level),nextLevelPreview:nextPreview(cfg,level,data,cfg.levels[level]||null),progress:`${level}/${cfg.maxLevel}` };
}
export function validateSkillDetailContent(){
  const problems=[];
  Object.entries(SKILLS).forEach(([id,cfg])=>{
    if(!cfg.description||BLOCKED.some(text=>cfg.description.includes(text))) problems.push(`${id}:description`);
    for(let level=1;level<=(cfg.maxLevel||1);level+=1){
      const detail=getSkillDetailData(id,{skill:{id,level}});
      const current=(detail?.currentEffects||[]).join(' ');
      if(!current||!/\d/.test(current)) problems.push(`${id}:level${level}:currentEffects`);
      if(detail?.milestones?.length!==3||detail.milestones.some(item=>!item.text||BLOCKED.some(text=>item.text.includes(text)))) problems.push(`${id}:level${level}:milestones`);
      if(level<(cfg.maxLevel||1)){
        const preview=(detail?.nextLevelPreview||[]).join(' ');
        if(!preview||preview.includes('已达到最高等级')||!/[\d是否全部]/.test(preview)) problems.push(`${id}:level${level}:nextLevelPreview`);
      }
    }
  });
  return [...new Set(problems)];
}
