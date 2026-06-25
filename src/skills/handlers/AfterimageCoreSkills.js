import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';

const levels = (values, build, milestones={}) => values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}),
}));

const AFTERIMAGE_CORE_SKILLS = {
  phantom_step: {
    id:'phantom_step', name:'幻影步', rarity:'RARE', handler:'phantom_step', passive:true, maxLevel:9,
    coreSkill:true, requiredSkillId:'shadow_fist',
    tags:['shadow',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0x8e83ff, short:'幻',
    description:'成功闪避时生成残影；连续闪避会缩短下一次残影生成间隔。',
    levels:levels([
      [1,4200,5200,0.00],[1,3900,5400,0.00],[2,3600,5600,0.02],[2,3300,5800,0.02],[2,3000,6000,0.03],[3,2700,6200,0.03],[3,2400,6500,0.04],[3,2100,6800,0.04],[4,1750,7200,0.05]
    ],([maxAfterimages,baseCooldownMs,durationMs,attackSpeedBonus])=>({ maxAfterimages,baseCooldownMs,durationMs,attackSpeedBonus,streakWindowMs:1800,streakReductionMs:500,minCooldownMs:650,desc:`闪避后最多维持${maxAfterimages}个残影，基础生成间隔${(baseCooldownMs/1000).toFixed(1)}秒。` }),{
      3:'最多维持2个残影，并获得少量残影攻速增益',
      6:'最多维持3个残影，基础生成间隔缩短至2.7秒',
      9:'最多维持4个残影，基础生成间隔缩短至1.75秒'
    })
  },
  shadow_assault: {
    id:'shadow_assault', name:'影袭', rarity:'RARE', handler:'shadow_assault', passive:true, maxLevel:9,
    coreSkill:true, requiredSkillId:'shadow_fist',
    tags:['shadow','physical',TAGS.NORMAL_ATTACK,TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0xa9a3ff, short:'袭',
    description:'普通攻击命中后，场上残影依次模仿该次攻击。',
    levels:levels([
      [0.22,240],[0.25,230],[0.28,220],[0.31,210],[0.34,200],[0.38,190],[0.42,180],[0.46,170],[0.52,150]
    ],([damageRatio,echoDelayMs])=>({ damageRatio,echoDelayMs,lifeStealScale:0.25,desc:`每个残影造成本次普通攻击${Math.round(damageRatio*100)}%的模仿伤害。` }),{
      3:'残影模仿伤害提高至28%',
      6:'残影模仿伤害提高至38%，出手更快',
      9:'残影模仿伤害提高至52%，出手间隔缩短至0.15秒'
    })
  }
};

export function configureAfterimageCoreSkills(){
  Object.entries(AFTERIMAGE_CORE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; });
}

export const PhantomStepSkill={
  bind(system){
    let nextReadyAt=0;
    let lastDodgeAt=0;
    let streak=0;
    return system.scene.eventBus.on(CombatEvents.PLAYER_DODGED,()=>{
      const s=system.scene;
      const data=system.getData('phantom_step');
      if(!data||!s.afterimages) return;
      const now=s.getGameplayTime();
      if(now-lastDodgeAt<=data.streakWindowMs) streak+=1;
      else streak=1;
      lastDodgeAt=now;
      if(now<nextReadyAt) return;
      const owned=s.afterimages.getAll().filter(a=>a.ownerSkillId==='phantom_step');
      if(owned.length>=data.maxAfterimages) s.afterimages.removeAfterimage(owned[0].id,'replaced');
      s.afterimages.createAfterimage({ ownerSkillId:'phantom_step', durationMs:data.durationMs, attackRatio:0, attackSpeedBonus:data.attackSpeedBonus, color:0x8e83ff, inheritedSkills:['shadow_assault'] });
      const reduction=Math.max(0,(streak-1)*data.streakReductionMs);
      nextReadyAt=now+Math.max(data.minCooldownMs,data.baseCooldownMs-reduction);
    });
  }
};

export const ShadowAssaultSkill={
  bind(system){
    const s=system.scene;
    return s.eventBus.on(CombatEvents.PLAYER_HIT,payload=>{
      const data=system.getData('shadow_assault');
      if(!data||payload.fromMyriadAfterimage||payload.afterimage||payload.source!=='attack'||!s.targeting.valid(payload.enemy)||!s.afterimages) return;
      const afterimages=s.afterimages.getAll();
      afterimages.forEach((afterimage,index)=>{
        s.time.delayedCall(index*data.echoDelayMs,()=>{
          if(!s.targeting.valid(payload.enemy)||!s.afterimages?.getById(afterimage.id)) return;
          const afterimageDamageBonus=Object.values(s.playerData.afterimageDamageBonuses||{}).reduce((sum,value)=>sum+(Number(value)||0),0);
          const amount=Math.max(1,Math.round((payload.damage||0)*data.damageRatio*(1+afterimageDamageBonus)));
          s.combatSystem.damageEnemy(payload.enemy,amount,{ source:'skill', damageKind:'afterimageAttack', skillId:'shadow_assault', tags:[...(payload.tags||[]),'shadow',TAGS.BUILD_AFTERIMAGE], afterimage:true, heavyHit:!!payload.heavyHit, allowLifeSteal:true, lifeStealScale:data.lifeStealScale, noKnockback:true, fromMyriadAfterimage:!!payload.fromMyriadAfterimage, noInstantStep:true });
          const slash=s.add.rectangle(payload.enemy.x-12-index*5,payload.enemy.y-52,payload.heavyHit?66:54,payload.heavyHit?10:7,0xa9a3ff,0.65).setDepth(148);
          slash.rotation=-0.45;
          s.tweens.add({targets:slash,x:payload.enemy.x+22,alpha:0,duration:150,onComplete:()=>slash.destroy()});
        });
      });
    });
  }
};
