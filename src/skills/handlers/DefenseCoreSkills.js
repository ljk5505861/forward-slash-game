import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

const levels = (values, build, milestones={}) => values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}),
}));

const DEFENSE_CORE_SKILLS = {
  thorn_armor: {
    id:'thorn_armor', name:'荆棘甲', rarity:'RARE', handler:'thorn_armor', passive:true, maxLevel:9,
    coreSkill:true, requiredSkillId:'healing',
    tags:['physical',TAGS.BUILD_DEFENSE], cooldownMs:999999,
    targetType:'passive', color:0x9fd37a, short:'荆',
    description:'受到攻击后按自身防御值反伤攻击者，护盾吸收的攻击同样可以触发。',
    levels:levels([
      [0.9,4,420],[1.05,4,400],[1.2,6,380],[1.35,6,360],[1.5,8,340],[1.7,8,320],[1.9,10,300],[2.15,10,280],[2.45,12,250]
    ],([defenseScale,flatDamage,internalCooldownMs])=>({ defenseScale,flatDamage,internalCooldownMs,desc:`受击时造成防御值×${defenseScale.toFixed(2)}+${flatDamage}点反伤。` }),{
      3:'反伤提高至防御值×1.20，并附加3点伤害',
      6:'反伤提高至防御值×1.70，触发间隔缩短',
      9:'反伤提高至防御值×2.45，触发间隔缩短至0.25秒'
    })
  },
  guardian_shield: {
    id:'guardian_shield', name:'守护盾', rarity:'RARE', handler:'guardian_shield', passive:true, maxLevel:9,
    coreSkill:true, requiredSkillId:'healing',
    tags:[TAGS.SHIELD,TAGS.BUILD_DEFENSE], cooldownMs:999999,
    targetType:'passive', color:0x8fd7ff, short:'盾',
    description:'周期获得基于防御值的护盾，为后续碎盾爆发提供稳定循环。',
    levels:levels([
      [1.5,6,7200,6500],[1.7,7,6900,6500],[1.9,8,6600,6800],[2.1,9,6300,6800],[2.3,10,6000,7000],[2.6,11,5700,7200],[2.9,12,5400,7400],[3.2,13,5100,7600],[3.6,15,4700,8000]
    ],([defenseScale,flatShield,intervalMs,durationMs])=>({ defenseScale,flatShield,intervalMs,durationMs,desc:`每${(intervalMs/1000).toFixed(1)}秒获得防御值×${defenseScale.toFixed(1)}+${flatShield}点护盾。` }),{
      3:'护盾提高至防御值×1.9+8，生成间隔缩短',
      6:'护盾提高至防御值×2.6+11，持续时间延长',
      9:'护盾提高至防御值×3.6+15，每4.7秒生成一次'
    })
  }
};

export function configureDefenseCoreSkills(){
  Object.entries(DEFENSE_CORE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; });
}

export const ThornArmorSkill={
  bind(system){
    let readyAt=0;
    return system.scene.eventBus.on(CombatEvents.PLAYER_DAMAGED,payload=>{
      const s=system.scene;
      const data=system.getData('thorn_armor');
      const enemy=payload.enemy;
      const suffered=(payload.hpDamage||0)+(payload.shieldAbsorbed||0);
      const now=s.getGameplayTime();
      if(!data||suffered<=0||now<readyAt||!s.targeting.valid(enemy)) return;
      readyAt=now+data.internalCooldownMs;
      const damage=Math.max(1,Math.round((s.playerData.defense||0)*data.defenseScale+data.flatDamage));
      s.combatSystem.damageEnemy(enemy,damage,{ source:'reflect', skillId:'thorn_armor', tags:['physical',TAGS.BUILD_DEFENSE], allowLifeSteal:false, noKnockback:true });
      s.floatText(enemy.x,enemy.y-92,`反伤 ${damage}`,'#b7e887');
    });
  }
};

export const GuardianShieldSkill={
  bind(system){
    let nextReadyAt=0;
    const updater=()=>{
      const s=system.scene;
      const data=system.getData('guardian_shield');
      if(!data){ nextReadyAt=0; return; }
      const now=s.getGameplayTime();
      if(nextReadyAt===0) nextReadyAt=now+500;
      if(now<nextReadyAt) return;
      nextReadyAt=now+data.intervalMs;
      const amount=Math.max(1,Math.round((s.playerData.defense||0)*data.defenseScale+data.flatShield));
      const effect=s.statusEffects.add(StatusEffects.SHIELD,s.playerData,{ durationMs:data.durationMs,value:amount,remainingValue:amount,sourceId:'guardian_shield' });
      if(!effect) return;
      s.floatText(s.player.x,s.player.y-104,`守护盾 +${effect.remainingValue}`,'#8fd7ff');
      s.hud?.update();
    };
    system.passiveUpdaters.push(updater);
    updater();
    return ()=>{ nextReadyAt=0; };
  }
};
