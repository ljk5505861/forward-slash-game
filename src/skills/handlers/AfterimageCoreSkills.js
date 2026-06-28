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
    coreSkill:true,
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
  traceless: {
    id:'traceless', name:'无踪', rarity:'RARE', handler:'traceless', passive:true, maxLevel:9,
    coreSkill:true,
    tags:['shadow','movement','dodge',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0xb7f7ff, short:'踪',
    description:'闪避后短暂进入无踪，提高移动速度与残影伤害；再次闪避会刷新持续时间。',
    levels:levels([
      [0.08,0.10,1800],[0.09,0.12,1900],[0.10,0.14,2000],[0.11,0.16,2100],[0.12,0.18,2200],[0.13,0.21,2350],[0.14,0.24,2500],[0.15,0.27,2650],[0.16,0.30,2800]
    ],([moveSpeedBonus,afterimageDamageBonus,durationMs])=>({ moveSpeedBonus,afterimageDamageBonus,durationMs,desc:`闪避后${(durationMs/1000).toFixed(1)}秒内移动速度+${Math.round(moveSpeedBonus*100)}%，残影伤害+${Math.round(afterimageDamageBonus*100)}%。` }),{
      3:'无踪移动速度提高至10%，残影伤害提高至14%',
      6:'无踪持续2.35秒，残影伤害提高至21%',
      9:'无踪持续2.8秒，残影伤害提高至30%'
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
      s.afterimages.createAfterimage({ ownerSkillId:'phantom_step', durationMs:data.durationMs, attackRatio:0, attackSpeedBonus:data.attackSpeedBonus, color:0x8e83ff });
      const reduction=Math.max(0,(streak-1)*data.streakReductionMs);
      nextReadyAt=now+Math.max(data.minCooldownMs,data.baseCooldownMs-reduction);
    });
  }
};

export const TracelessSkill={
  bind(system){
    const s=system.scene;
    const state={ expiresAt:0, aura:null, appliedKey:'' };
    const ensure=()=>{ const p=s.playerData; p.moveSpeedMultiplierBonuses??={}; p.afterimageDamageBonuses??={}; };
    const clear=()=>{ if(s.playerData.moveSpeedMultiplierBonuses) delete s.playerData.moveSpeedMultiplierBonuses.traceless; if(s.playerData.afterimageDamageBonuses) delete s.playerData.afterimageDamageBonuses.traceless; state.aura?.destroy?.(); state.aura=null; state.appliedKey=''; state.expiresAt=0; };
    const apply=data=>{ ensure(); const key=`${system.getLevel('traceless')}:${state.expiresAt}`; if(state.appliedKey===key) return; s.playerData.moveSpeedMultiplierBonuses.traceless=data.moveSpeedBonus; s.playerData.afterimageDamageBonuses.traceless=data.afterimageDamageBonus; state.appliedKey=key; };
    const off=s.eventBus.on(CombatEvents.PLAYER_DODGED,()=>{ const data=system.getData('traceless'); if(!data) return; state.expiresAt=s.getGameplayTime()+data.durationMs; apply(data); s.floatText?.(s.player.x,s.player.y-118,'无踪','#b7f7ff'); });
    const updater=()=>{ const data=system.getData('traceless'); if(!data){ clear(); return; } if(state.expiresAt && s.getGameplayTime()<=state.expiresAt){ apply(data); if(!state.aura) state.aura=s.add.rectangle(s.player.x,s.player.y-50,58,84,0xb7f7ff,0.08).setStrokeStyle(2,0xe8fbff,0.2).setDepth(93); state.aura.setPosition(s.player.x,s.player.y-50); } else if(state.expiresAt) clear(); };
    system.passiveUpdaters.push(updater);
    return ()=>{ off?.(); const i=system.passiveUpdaters.indexOf(updater); if(i>=0) system.passiveUpdaters.splice(i,1); clear(); };
  }
};
