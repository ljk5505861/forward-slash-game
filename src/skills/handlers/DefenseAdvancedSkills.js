import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';

const levels = (values, build, milestones={}) => values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}),
}));

const SOURCE_ARMOR_BREAK='armor_break_shockwave';
const SOURCE_MOUNTAIN='immovable_mountain';
const DR_CAP=0.35;

const DEFENSE_ADVANCED_SKILLS = {
  armor_break_shockwave: {
    id:SOURCE_ARMOR_BREAK, name:'碎甲震荡', rarity:'EPIC', handler:SOURCE_ARMOR_BREAK, passive:true, maxLevel:9,
    requiredSkillId:'guardian_shield',
    tags:['physical',TAGS.SHIELD,TAGS.BUILD_DEFENSE], cooldownMs:999999,
    targetType:'passive', color:0xd8d0b0, short:'震',
    description:'护盾被完全击破时释放物理范围震荡，并短暂提高命中敌人受到的物理伤害。',
    levels:levels([
      [45,125,3000,0.08,1000],[55,132,3200,0.09,950],[66,142,3400,0.10,900],[78,150,3600,0.12,850],[90,158,3800,0.13,800],[102,166,4200,0.15,750],[112,172,4500,0.16,700],[121,176,4800,0.17,650],[130,180,5000,0.18,600]
    ],([damage,radius,armorBreakMs,physicalVulnerability,internalCooldownMs])=>({ damage,radius,armorBreakMs,physicalVulnerability,internalCooldownMs,desc:`护盾破裂时造成${damage}点范围物理伤害，并使目标受到的物理伤害提高${Math.round(physicalVulnerability*100)}%，持续${(armorBreakMs/1000).toFixed(1)}秒。` }),{
      3:'震荡范围扩大，破甲提高至10%',
      6:'破甲提高至15%，持续时间提高至4.2秒',
      9:'震荡伤害提高至130，范围扩大至180'
    })
  },
  immovable_mountain: {
    id:SOURCE_MOUNTAIN, name:'不动如山', rarity:'EPIC', handler:SOURCE_MOUNTAIN, passive:true, maxLevel:9,
    requiredSkillId:SOURCE_ARMOR_BREAK,
    tags:[TAGS.SHIELD,TAGS.BUILD_DEFENSE], cooldownMs:999999,
    targetType:'passive', color:0x9c8260, short:'山',
    description:'交战停步且拥有护盾时逐渐获得山势层数，提升防御与少量减伤；移动或失去护盾后清空或衰减。',
    levels:levels([
      [3,3,0.010,1000,0],[3,3,0.012,950,200],[4,3,0.012,900,300],[4,4,0.014,860,400],[4,4,0.016,820,500],[4,4,0.018,780,650],[5,4,0.018,750,800],[5,5,0.019,720,900],[5,5,0.020,700,1100]
    ],([maxStacks,defensePerStack,damageReductionPerStack,gainIntervalMs,graceMs])=>({ maxStacks,defensePerStack,damageReductionPerStack,gainIntervalMs,graceMs,desc:`交战停步且有护盾时每${(gainIntervalMs/1000).toFixed(1)}秒获得1层山势，最多${maxStacks}层；每层防御+${defensePerStack}、减伤+${Math.round(damageReductionPerStack*100)}%。` }),{
      3:'最大层数提高至4层',
      6:'每层额外减伤提高至1.8%',
      9:'最大层数提高至5层，离开站稳状态后短暂保留'
    })
  }
};

export function configureDefenseAdvancedSkills(){
  Object.entries(DEFENSE_ADVANCED_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; });
}

function clearArmorBreak(enemy){
  if(!enemy) return;
  if(enemy.physicalDamageTakenBonuses) delete enemy.physicalDamageTakenBonuses[SOURCE_ARMOR_BREAK];
  enemy._armorBreakShockwaveUntil=0;
}

function applyArmorBreak(s, enemy, data){
  enemy.physicalDamageTakenBonuses??={};
  enemy.physicalDamageTakenBonuses[SOURCE_ARMOR_BREAK]=data.physicalVulnerability;
  enemy._armorBreakShockwaveUntil=s.getGameplayTime()+data.armorBreakMs;
  s.floatText(enemy.x,enemy.y-86,'碎甲','#d8d0b0');
}

export const ArmorBreakShockwaveSkill={
  bind(system){
    let readyAt=0;
    let active=true;
    const damaged=new Map();
    const onShieldBroken=payload=>{
      if(!active) return;
      const s=system.scene;
      const data=system.getData(SOURCE_ARMOR_BREAK);
      const now=s.getGameplayTime();
      if(!data||s.isGameplayPaused?.()||payload?.target!==s.playerData||now<readyAt) return;
      if((payload?.absorbedTotal||0)<=0) return;
      readyAt=now+data.internalCooldownMs;
      const ring=s.add.circle(s.player.x,s.player.y-8,data.radius,0xd8d0b0,0.16).setStrokeStyle(5,0xf5f0d0,0.9).setDepth(138);
      s.tweens.add({targets:ring,alpha:0,scale:1.18,duration:260,onComplete:()=>ring.destroy()});
      const targets=s.targeting.aroundPlayer(data.radius);
      targets.forEach(enemy=>{
        applyArmorBreak(s,enemy,data);
        s.combatSystem.damageEnemy(enemy,data.damage,{ source:SOURCE_ARMOR_BREAK, skillId:SOURCE_ARMOR_BREAK, tags:['physical',TAGS.SHIELD,TAGS.BUILD_DEFENSE], allowLifeSteal:false, noKnockback:true });
        damaged.set(enemy,enemy._armorBreakShockwaveUntil);
      });
      if(targets.length) s.floatText(s.player.x,s.player.y-118,'碎甲震荡','#f5f0d0');
    };
    const offBroken=system.scene.eventBus.on(CombatEvents.SHIELD_BROKEN,onShieldBroken);
    const updater=()=>{
      if(!active) return;
      const now=system.scene.getGameplayTime();
      damaged.forEach((until,enemy)=>{ if(!system.scene.targeting.valid(enemy)||now>=until){ clearArmorBreak(enemy); damaged.delete(enemy); } });
    };
    system.passiveUpdaters.push(updater);
    return ()=>{ active=false; offBroken?.(); damaged.forEach((_until,enemy)=>clearArmorBreak(enemy)); damaged.clear(); readyAt=0; };
  }
};

function setMountainBonuses(s, stacks, data){
  const p=s.playerData;
  p.defenseBonuses??={};
  p.damageReductionBonuses??={};
  if(stacks>0&&data){
    p.defenseBonuses[SOURCE_MOUNTAIN]=stacks*data.defensePerStack;
    p.damageReductionBonuses[SOURCE_MOUNTAIN]=Math.min(DR_CAP,stacks*data.damageReductionPerStack);
  } else {
    delete p.defenseBonuses[SOURCE_MOUNTAIN];
    delete p.damageReductionBonuses[SOURCE_MOUNTAIN];
  }
}

export const ImmovableMountainSkill={
  bind(system){
    let stacks=0, nextGainAt=0, lastStableAt=0, aura=null, active=true;
    const clear=()=>{ if(stacks>0) system.scene.floatText(system.scene.player.x,system.scene.player.y-112,'山势消散','#b79b75'); stacks=0; setMountainBonuses(system.scene,0); aura?.destroy?.(); aura=null; nextGainAt=0; };
    const updater=()=>{
      if(!active) return;
      const s=system.scene;
      const data=system.getData(SOURCE_MOUNTAIN);
      if(!data){ clear(); return; }
      const now=s.getGameplayTime();
      const shielded=(s.playerData.shield||0)>0;
      const velocity=Math.abs(s.player?.body?.velocity?.x||0);
      const engaged=!!s.targeting.nearestAhead((s.playerData.attackRange||s.balance?.player?.encounterDistance||520));
      const stable=shielded&&engaged&&velocity<8;
      if(stable){
        lastStableAt=now;
        if(nextGainAt===0) nextGainAt=now+data.gainIntervalMs;
        if(now>=nextGainAt&&stacks<data.maxStacks){
          stacks+=1;
          setMountainBonuses(s,stacks,data);
          s.floatText(s.player.x,s.player.y-118,'山势 +1','#c7aa78');
          if(!aura) aura=s.add.circle(s.player.x,s.player.y-4,54,0x7f6848,0.16).setStrokeStyle(4,0xc7aa78,0.7).setDepth(30);
        }
        while(now>=nextGainAt) nextGainAt+=data.gainIntervalMs;
      } else if(!shielded) clear();
      else if(stacks>0 && now-lastStableAt>(data.graceMs||0)) clear();
      if(aura){ aura.setPosition(s.player.x,s.player.y-4); aura.setScale(1+stacks*0.08); aura.setAlpha(Math.min(0.32,0.10+stacks*0.04)); }
      setMountainBonuses(s,stacks,data);
    };
    system.passiveUpdaters.push(updater);
    return ()=>{ active=false; clear(); };
  }
};
