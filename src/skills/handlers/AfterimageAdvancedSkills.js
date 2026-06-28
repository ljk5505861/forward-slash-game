import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';

const SOURCE_STEP='instant_step';
const sumBonuses = bonuses => Object.values(bonuses||{}).reduce((sum,value)=>sum+(Number(value)||0),0);
const levels=(values,build,milestones={})=>values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{ milestoneText:milestones[index+1] }:{})
}));

const AFTERIMAGE_ADVANCED_SKILLS={
  instant_step:{
    id:'instant_step', name:'瞬身', rarity:'EPIC', handler:'instant_step', passive:true, maxLevel:9,
    advancedSkill:true,
    tags:['shadow','movement','dodge','afterimage','physical',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0xe8fbff, short:'瞬',
    description:'成功闪避且冷却结束时瞬间虚化，并在原地留下强化残影攻击前方敌人。',
    levels:levels([
      [110,110,7000,150],[132,118,6700,160],[156,126,6400,170],[180,135,6100,180],[208,143,5800,190],[240,152,5500,200],[264,160,5200,215],[284,166,4900,230],[300,174,4500,250]
    ],([damage,radius,cooldownMs,phaseDurationMs],level)=>({ damage,radius,cooldownMs,phaseDurationMs,dodgeEventWindowMs:16,activeCooldownReduceMs:level>=6?500:0,desc:`闪避时瞬间虚化，在原地留下残影造成${damage}点物理伤害，冷却${(cooldownMs/1000).toFixed(1)}秒${level>=6?'；残影造成实际伤害时使其他主动技能冷却减少0.5秒':''}。` }),{
      3:'残影伤害与攻击范围提高',
      6:'残影造成实际伤害时，其他主动技能冷却减少0.5秒',
      9:'冷却缩短至4.5秒，范围扩大，虚化时间略微延长'
    })
  }
};

export function configureAfterimageAdvancedSkills(){ Object.entries(AFTERIMAGE_ADVANCED_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

function attackAfterimage(s,x,y,data){
  const mult=1+sumBonuses(s.playerData.afterimageDamageBonuses);
  const amount=Math.max(1,Math.round(data.damage*mult));
  const targets=s.targeting.all().filter(e=>Math.abs(e.x-x)<=data.radius && e.x>=x-35).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x));
  let didDamage=false;
  targets.forEach(enemy=>{
    const damaged=s.combatSystem.damageEnemy(enemy,amount,{ source:'skill', damageKind:'afterimageAttack', skillId:SOURCE_STEP, tags:['shadow','physical',TAGS.BUILD_AFTERIMAGE], afterimage:true, allowLifeSteal:false, noKnockback:true, noInstantStep:true });
    didDamage=didDamage||!!damaged;
  });
  if(didDamage && data.activeCooldownReduceMs>0){
    const count=s.skillSystem?.reduceActiveCooldowns?.(data.activeCooldownReduceMs,{ excludeSkillIds:[SOURCE_STEP], sourceSkillId:SOURCE_STEP })||0;
    if(count>0) s.floatText?.(x,y-118,'冷却 -0.5秒','#b7f7ff');
  }
}


export const InstantStepSkill={
  bind(system){
    const s=system.scene;
    let readyAt=0;
    let lastFrame=-1;
    let triggering=false;
    let phaseTimer=null;
    let restoreVisual=null;
    const visuals=new Set();

    const destroyVisual=obj=>{ if(!obj) return; visuals.delete(obj); obj.destroy?.(); };
    const restorePlayer=()=>{
      phaseTimer?.remove?.(false);
      phaseTimer=null;
      restoreVisual?.();
      restoreVisual=null;
    };
    const beginPhase=data=>{
      restorePlayer();
      const player=s.player;
      if(!player) return;
      const originalAlpha=player.alpha;
      const originalScaleX=player.scaleX;
      const originalScaleY=player.scaleY;
      restoreVisual=()=>{
        if(!player?.active) return;
        player.setAlpha?.(originalAlpha);
        player.setScale?.(originalScaleX,originalScaleY);
      };
      player.setAlpha?.(Math.min(originalAlpha,0.35));
      player.setScale?.(originalScaleX*0.96,originalScaleY*0.96);
      phaseTimer=s.time.delayedCall(data.phaseDurationMs,restorePlayer);
    };

    const off=s.eventBus.on(CombatEvents.PLAYER_DODGED,payload=>{
      const data=system.getData('instant_step');
      if(!data) return;
      const now=s.getGameplayTime();
      const frame=Math.floor(now/data.dodgeEventWindowMs);
      if(triggering||payload?.noInstantStep||frame===lastFrame||now<readyAt) return;
      lastFrame=frame;
      triggering=true;
      readyAt=now+data.cooldownMs;
      const ox=s.player.x;
      const oy=s.player.y;
      beginPhase(data);
      const ghost=s.add.rectangle(ox,oy-52,34,76,0xe8fbff,0.26).setStrokeStyle(2,0xb7f7ff,0.45).setDepth(96);
      const flash=s.add.circle(ox,oy-52,34,0xe8fbff,0.24).setStrokeStyle(4,0xe8fbff,0.7).setDepth(150);
      visuals.add(ghost);
      visuals.add(flash);
      s.floatText?.(ox,oy-130,'瞬身','#e8fbff');
      attackAfterimage(s,ox,oy,data);
      s.tweens.add({targets:ghost,alpha:0,x:ox-18,duration:260,onComplete:()=>destroyVisual(ghost)});
      s.tweens.add({targets:flash,alpha:0,scale:1.5,duration:220,onComplete:()=>destroyVisual(flash)});
      triggering=false;
    });

    return ()=>{
      off?.();
      restorePlayer();
      visuals.forEach(obj=>obj.destroy?.());
      visuals.clear();
      readyAt=0;
      lastFrame=-1;
      triggering=false;
    };
  }
};