import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';

const levels=(values,build,milestones={})=>values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}),
}));

const STRENGTH_ADVANCED_SKILLS={
  frenzy:{ id:'frenzy',name:'狂怒',rarity:'EPIC',handler:'frenzy',passive:true,maxLevel:9,coreSkill:true,requiredSkillId:'bloodthirst',tags:['physical',TAGS.NORMAL_ATTACK,TAGS.HEAVY_HIT,TAGS.BUILD_STRENGTH],cooldownMs:999999,targetType:'passive',color:0xb91c1c,short:'狂',description:'生命越低，普通攻击速度与普通/重击伤害越高。',levels:levels([
    [[0.70,0.06,0.05,0],[0.45,0.12,0.10,0],[0.25,0.20,0.18,0.04]],
    [[0.70,0.065,0.055,0],[0.45,0.13,0.11,0],[0.25,0.22,0.19,0.05]],
    [[0.70,0.07,0.06,0],[0.45,0.15,0.12,0],[0.25,0.24,0.20,0.06]],
    [[0.70,0.075,0.062,0],[0.45,0.16,0.13,0],[0.25,0.26,0.215,0.07]],
    [[0.70,0.08,0.065,0],[0.45,0.17,0.14,0],[0.25,0.28,0.23,0.08]],
    [[0.70,0.085,0.07,0],[0.45,0.18,0.15,0],[0.25,0.30,0.25,0.11]],
    [[0.70,0.09,0.073,0],[0.45,0.19,0.155,0],[0.25,0.315,0.26,0.12]],
    [[0.70,0.095,0.076,0],[0.45,0.195,0.158,0],[0.25,0.325,0.27,0.13]],
    [[0.70,0.10,0.08,0],[0.45,0.20,0.16,0],[0.25,0.34,0.28,0.15]],
  ],(tiers)=>({tiers,desc:`低于70%/45%/25%生命时，攻速提高${tiers.map(t=>Math.round(t[1]*100)).join('/')}%，伤害提高${tiers.map(t=>Math.round(t[2]*100)).join('/')}%。`}),{3:'中低血档增强',6:'最低血档额外提高重击伤害',9:'最低血档攻击速度进一步提高'})},
  blood_rage_burst:{ id:'blood_rage_burst',name:'血怒爆发',rarity:'EPIC',handler:'blood_rage_burst',passive:true,maxLevel:9,coreSkill:true,requiredSkillId:'frenzy',tags:['physical',TAGS.HEAVY_HIT,'lifesteal',TAGS.BUILD_STRENGTH],cooldownMs:999999,targetType:'passive',color:0xe11d48,short:'怒',description:'首次跌入危险血线时短暂强化攻击、重击与吸血，然后进入内部冷却。',levels:levels([
    [0.30,4000,0.20,0.30,0.03,0.06,0.06,16000],
    [0.30,4250,0.22,0.33,0.034,0.07,0.07,15500],
    [0.30,4600,0.24,0.36,0.038,0.08,0.08,15000],
    [0.30,4850,0.26,0.39,0.042,0.085,0.09,14500],
    [0.30,5100,0.28,0.42,0.046,0.09,0.10,14000],
    [0.30,5400,0.30,0.46,0.05,0.105,0.11,13500],
    [0.30,5600,0.32,0.49,0.054,0.11,0.12,13000],
    [0.30,5800,0.34,0.52,0.058,0.115,0.13,12500],
    [0.30,6000,0.35,0.55,0.06,0.12,0.15,12000],
  ],([triggerRatio,durationMs,damageBonus,heavyDamageBonus,lifeStealBonus,heavyLifeStealBonus,attackSpeedBonus,cooldownMs])=>({triggerRatio,rearmRatio:0.50,durationMs,damageBonus,heavyDamageBonus,lifeStealBonus,heavyLifeStealBonus,attackSpeedBonus,cooldownMs,desc:`跌破${Math.round(triggerRatio*100)}%生命触发${(durationMs/1000).toFixed(1)}秒血怒，普攻伤害+${Math.round(damageBonus*100)}%，重击伤害+${Math.round(heavyDamageBonus*100)}%。`}),{3:'持续时间增加',6:'重击额外吸血提高',9:'爆发期间重击伤害与攻击速度进一步提高'})}
};

export function configureStrengthAdvancedSkills(){ Object.entries(STRENGTH_ADVANCED_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

function hpRatio(s){ const p=s.playerData; return p?.maxHp>0 ? p.hp/p.maxHp : 1; }
function tierFor(data,ratio){ if(!data?.tiers)return 0; let tier=0; data.tiers.forEach((t,i)=>{ if(ratio<=t[0]) tier=i+1; }); return tier; }
function flash(system,text,color){ const s=system.scene; if(!s.player?.active)return; const ring=s.add.circle(s.player.x,s.player.y-42,74,color,0.16).setStrokeStyle(5,color,0.8).setDepth(142); s.tweens.add({targets:ring,alpha:0,scale:1.25,duration:360,onComplete:()=>ring.destroy()}); s.floatText?.(s.player.x,s.player.y-122,text,'#ffb4b4'); }
function makeAura(s,color,alpha=0.10){ return s.add.circle(s.player.x,s.player.y-45,82,color,alpha).setStrokeStyle(3,color,alpha*3).setDepth(33); }

export const FrenzySkill={ bind(system){ let applied={attack:0,attackSpeed:0,heavy:0}; let currentTier=0; const clear=()=>{ const p=system.scene.playerData; p.attack=Math.max(1,(p.attack||1)-applied.attack); p.attackSpeedMultiplier=Math.max(0.2,(p.attackSpeedMultiplier||1)-applied.attackSpeed); p.heavyHitMultiplier=Math.max(1,(p.heavyHitMultiplier||1)-applied.heavy); applied={attack:0,attackSpeed:0,heavy:0}; };
  const updater=()=>{ const s=system.scene,p=s.playerData,data=system.getData('frenzy'); const nextTier=tierFor(data,hpRatio(s)); if(!data||nextTier<=0){ if(currentTier!==0) currentTier=0; clear(); return; } const tier=data.tiers[nextTier-1]; clear(); const baseAttack=Math.max(1,p.attack||1); applied.attack=Math.max(1,Math.round(baseAttack*tier[2])); applied.attackSpeed=tier[1]; applied.heavy=tier[3]||0; p.attack+=applied.attack; p.attackSpeedMultiplier=Math.min(3,(p.attackSpeedMultiplier||1)+applied.attackSpeed); p.heavyHitMultiplier=(p.heavyHitMultiplier||1)+applied.heavy; if(nextTier!==currentTier){ currentTier=nextTier; flash(system,`狂怒${['','Ⅰ','Ⅱ','Ⅲ'][nextTier]}`,0x8b0000); } };
  system.passiveUpdaters.push(updater); updater(); return ()=>{ currentTier=0; clear(); };
}};

export const BloodRageBurstSkill={ bind(system){ let applied={attack:0,attackSpeed:0,life:0,heavyLife:0,heavy:0}; let activeUntil=0,cooldownUntil=0,prevRatio=1,armed=true,aura=null; const clear=()=>{ const p=system.scene.playerData; p.attack=Math.max(1,(p.attack||1)-applied.attack); p.attackSpeedMultiplier=Math.max(0.2,(p.attackSpeedMultiplier||1)-applied.attackSpeed); p.lifeSteal=Math.max(0,(p.lifeSteal||0)-applied.life); p.heavyHitLifeSteal=Math.max(0,(p.heavyHitLifeSteal||0)-applied.heavyLife); p.heavyHitMultiplier=Math.max(1,(p.heavyHitMultiplier||1)-applied.heavy); applied={attack:0,attackSpeed:0,life:0,heavyLife:0,heavy:0}; aura?.destroy(); aura=null; };
  const apply=(data)=>{ const p=system.scene.playerData; clear(); const baseAttack=Math.max(1,p.attack||1); applied.attack=Math.max(1,Math.round(baseAttack*data.damageBonus)); applied.attackSpeed=data.attackSpeedBonus; applied.life=data.lifeStealBonus; applied.heavyLife=data.heavyLifeStealBonus; applied.heavy=data.heavyDamageBonus; p.attack+=applied.attack; p.attackSpeedMultiplier=Math.min(3,(p.attackSpeedMultiplier||1)+applied.attackSpeed); p.lifeSteal+=applied.life; p.heavyHitLifeSteal+=applied.heavyLife; p.heavyHitMultiplier=(p.heavyHitMultiplier||1)+applied.heavy; aura=makeAura(system.scene,0xe11d48,0.09); flash(system,'血怒爆发',0xe11d48); };
  const updater=()=>{ const s=system.scene,data=system.getData('blood_rage_burst'),now=s.getGameplayTime(),ratio=hpRatio(s); if(!data){ activeUntil=0; clear(); prevRatio=ratio; return; } if(aura){ aura.setPosition(s.player.x,s.player.y-45); aura.setVisible(now<activeUntil); } if(activeUntil&&now>=activeUntil){ activeUntil=0; clear(); } if(ratio>=data.rearmRatio) armed=true; if(armed&&prevRatio>data.triggerRatio&&ratio<=data.triggerRatio&&now>=cooldownUntil){ armed=false; activeUntil=now+data.durationMs; cooldownUntil=now+data.cooldownMs; apply(data); } prevRatio=ratio; };
  system.passiveUpdaters.push(updater); updater(); return ()=>{ activeUntil=0; clear(); };
}};
