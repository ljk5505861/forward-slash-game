import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';
import { triggerArmorBreakShockwave } from './DefenseAdvancedSkills.js';

const SOURCE_BLACK_TORTOISE='black_tortoise_body';
const SHIELD_DURATION_MS=8000;

const levels = (values) => values.map(([durationMs,defenseBonus,damageReduction,shieldDefenseScale,flatShield,cooldownMs,healingReceivedBonus,endShockwave,endShieldMultiplier],index)=>({
  durationMs, defenseBonus, damageReduction, shieldDefenseScale, flatShield, cooldownMs, healingReceivedBonus, endShockwave, endShieldMultiplier,
  milestoneText: index+1===3 ? '玄武状态持续时间提高至3.5秒，防御与减伤进一步提升。' : index+1===6 ? '玄武状态期间，所有生命恢复效果提高20%。' : index+1===9 ? '玄武结束时再次释放碎甲震荡，恢复的护盾提高50%。' : undefined,
  desc:`进入玄武状态${(durationMs/1000).toFixed(2)}秒，防御+${defenseBonus}，伤害减免+${Math.round(damageReduction*100)}%，并立即释放一次碎甲震荡；结束时获得护盾。`
}));

const DEFENSE_ULTIMATE_SKILLS={
  [SOURCE_BLACK_TORTOISE]:{
    id:SOURCE_BLACK_TORTOISE, name:'玄武之躯', rarity:'MYTHIC', handler:SOURCE_BLACK_TORTOISE, passive:false, maxLevel:9,
    requiredSkillId:'immovable_mountain', ultimateSkill:true, targetType:'self',
    tags:[TAGS.SHIELD,'physical',TAGS.BUILD_DEFENSE], color:0x123f3f, short:'玄',
    description:'主动进入玄武状态，大幅提高防御与减伤，并立即释放一次碎甲震荡；状态结束时恢复护盾。',
    levels:levels([
      [3000,12,0.12,1.4,8,22000,0,false,1],
      [3150,14,0.13,1.5,9,21000,0,false,1],
      [3500,16,0.15,1.6,10,20000,0,false,1],
      [3650,18,0.16,1.7,11,19000,0,false,1],
      [3800,20,0.17,1.8,12,18000,0,false,1],
      [4000,22,0.18,2.0,13,17000,0.20,false,1],
      [4150,25,0.20,2.2,14,16000,0.20,false,1],
      [4300,28,0.22,2.4,16,15000,0.20,false,1],
      [4500,32,0.25,2.7,18,14000,0.20,true,1.5]
    ])
  }
};

export function configureDefenseUltimateSkills(){ Object.entries(DEFENSE_ULTIMATE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

function applyBonuses(s,data){
  const p=s.playerData;
  p.defenseBonuses??={};
  p.damageReductionBonuses??={};
  p.healingReceivedMultiplierBonuses??={};
  p.defenseBonuses[SOURCE_BLACK_TORTOISE]=data.defenseBonus;
  p.damageReductionBonuses[SOURCE_BLACK_TORTOISE]=data.damageReduction;
  if(data.healingReceivedBonus>0) p.healingReceivedMultiplierBonuses[SOURCE_BLACK_TORTOISE]=data.healingReceivedBonus;
  else delete p.healingReceivedMultiplierBonuses[SOURCE_BLACK_TORTOISE];
}

function clearBonuses(s){
  const p=s.playerData;
  if(!p) return;
  if(p.defenseBonuses) delete p.defenseBonuses[SOURCE_BLACK_TORTOISE];
  if(p.damageReductionBonuses) delete p.damageReductionBonuses[SOURCE_BLACK_TORTOISE];
  if(p.healingReceivedMultiplierBonuses) delete p.healingReceivedMultiplierBonuses[SOURCE_BLACK_TORTOISE];
}

function createAura(s){
  const outer=s.add.circle(s.player.x,s.player.y-8,70,0x0d3236,0.18).setStrokeStyle(6,0x1e8a8a,0.72).setDepth(32);
  const inner=s.add.circle(s.player.x,s.player.y-8,48,0x061b20,0.12).setStrokeStyle(3,0x76d0c8,0.55).setDepth(33);
  return { outer, inner, destroy(){ outer.destroy?.(); inner.destroy?.(); }, update(now){ const pulse=1+Math.sin(now/230)*0.035; outer.setPosition(s.player.x,s.player.y-8).setScale(pulse); inner.setPosition(s.player.x,s.player.y-8).setScale(1/pulse); } };
}

function currentDefense(s){
  const bonuses=s.playerData.defenseBonuses||{};
  return (s.playerData.defense||0)+Object.values(bonuses).reduce((sum,value)=>sum+(Number(value)||0),0);
}

export const BlackTortoiseBodySkill={
  cast(system,cfg,data,level){
    const s=system.scene;
    system.active.forEach(a=>{ if(a.skillId===SOURCE_BLACK_TORTOISE) a.onEnd?.('refresh'); });
    system.active=system.active.filter(a=>a.skillId!==SOURCE_BLACK_TORTOISE);
    applyBonuses(s,data);
    const burst=s.add.circle(s.player.x,s.player.y-8,42,0x0b2a2e,0.28).setStrokeStyle(7,0x4bb7ad,0.9).setDepth(145);
    s.tweens.add({targets:burst,alpha:0,scale:2.35,duration:320,onComplete:()=>burst.destroy()});
    s.floatText(s.player.x,s.player.y-126,'玄武之躯','#77e0d4');
    triggerArmorBreakShockwave(system,{ sourceSkillId:SOURCE_BLACK_TORTOISE, showText:true });
    const aura=createAura(s);
    const active={ skillId:SOURCE_BLACK_TORTOISE,cfg,data,level,nextAt:s.getGameplayTime()+100,endAt:s.getGameplayTime()+data.durationMs,
      tick(){ aura.update(s.getGameplayTime()); this.nextAt=s.getGameplayTime()+100; },
      onEnd(reason='complete'){
        if(this.ended) return;
        this.ended=true;
        aura.destroy();
        const normal=reason==='complete';
        if(!normal){ clearBonuses(s); return; }
        const defense=currentDefense(s);
        const shieldAmount=Math.max(0,Math.round(((defense*data.shieldDefenseScale)+data.flatShield)*(data.endShieldMultiplier||1)));
        clearBonuses(s);
        const effect=s.statusEffects?.add(StatusEffects.SHIELD,s.playerData,{ durationMs:SHIELD_DURATION_MS,value:shieldAmount,remainingValue:shieldAmount,sourceId:SOURCE_BLACK_TORTOISE });
        if(data.endShockwave) triggerArmorBreakShockwave(system,{ sourceSkillId:SOURCE_BLACK_TORTOISE, showText:true });
        if(effect?.remainingValue>0) s.floatText(s.player.x,s.player.y-116,`玄武盾 +${effect.remainingValue}`,'#8ff0e6');
        s.hud?.update();
      }
    };
    system.active.push(active);
  },
  cleanup(system){ clearBonuses(system.scene); }
};
