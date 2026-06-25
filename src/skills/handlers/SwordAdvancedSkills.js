import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { mergeTags } from '../../utils/tagUtils.js';

const levels = (values, build, milestones={}) => values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{ milestoneText:milestones[index+1] }:{}),
}));

const SWORD_ADVANCED_SKILLS = {
  execution_sword: {
    id:'execution_sword', name:'斩命剑', rarity:'EPIC', handler:'execution_sword', passive:true, maxLevel:9,
    requiredSkillId:'rotating_sword', tags:['physical',TAGS.SUMMON,TAGS.PROJECTILE,TAGS.BUILD_SWORD],
    cooldownMs:999999, targetType:'passive', color:0xf7fbff, short:'斩',
    description:'飞剑命中低血敌人时追加斩命伤害，普通敌人极低血量会被直接处决。',
    levels:levels([
      [0.10,22,90,700],[0.11,27,95,660],[0.12,32,100,620],[0.13,38,105,590],[0.14,44,110,560],[0.15,52,115,520],[0.16,60,120,490],[0.17,70,125,460],[0.18,82,130,420]
    ],([executeThreshold,bossDamage,executeFloor,cooldownMs])=>({ executeThreshold,bossDamage,executeFloor,cooldownMs,desc:`飞剑命中生命低于${Math.round(executeThreshold*100)}%的敌人时触发斩命，Boss受到${bossDamage}点追加伤害。` }),{
      3:'处决线提高至12%',
      6:'处决线提高至15%，内部冷却缩短',
      9:'处决线提高至18%，斩命伤害提高'
    })
  },
  myriad_swords: {
    id:'myriad_swords', name:'万剑归宗', rarity:'EPIC', handler:'myriad_swords', maxLevel:9,
    requiredSkillId:'execution_sword', tags:['physical',TAGS.SUMMON,TAGS.PROJECTILE,TAGS.ACTIVE_SKILL,TAGS.BUILD_SWORD],
    cooldownMs:9200, targetType:'nearestAhead', color:0xdafcff, short:'万',
    description:'短时间召来临时飞剑爆发攻击，并与斩命剑、分剑术和旋转剑共用飞剑命中事件。',
    levels:levels([
      [2,4_000,26,760,9200,1.00,false,false],[2,4_400,30,720,8900,1.05,false,false],[3,4_600,32,700,8600,1.08,false,false],[3,5_000,36,660,8300,1.12,false,false],[3,5_300,40,620,8000,1.16,false,false],[4,5_500,42,600,7700,1.20,true,false],[4,5_800,46,560,7400,1.28,true,false],[4,6_100,50,530,7100,1.34,true,false],[5,6_400,54,500,6800,1.45,true,true]
    ],([temporarySwords,durationMs,damage,attackIntervalMs,cooldownMs,speedMultiplier,instantExisting,endVolley])=>({ temporarySwords,durationMs,damage,attackIntervalMs,cooldownMs,speedMultiplier,instantExisting,endVolley,desc:`召来${temporarySwords}把临时飞剑，持续${(durationMs/1000).toFixed(1)}秒，每剑造成${damage}点伤害。` }),{
      3:'临时飞剑增加至3把',
      6:'施放时现有飞剑立即追加一次攻击',
      9:'临时飞剑增加至5把，结束时追加齐射'
    })
  }
};

export function configureSwordAdvancedSkills(){
  Object.entries(SWORD_ADVANCED_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; });
}

const isSwordEvent = (payload) => payload?.sword && mergeTags(payload.tags, payload.sword.inheritedTags).includes(TAGS.BUILD_SWORD);

export const ExecutionSwordSkill = {
  bind(system){
    const lastTriggered = new WeakMap();
    const onSwordAttacked = (payload={})=>{
      const data=system.getData('execution_sword');
      const level=system.getLevel('execution_sword');
      const s=system.scene;
      const enemy=payload.target;
      if(!data||level<=0||!s.targeting.valid(enemy)||payload.skillId==='execution_sword'||payload.executionSword) return;
      if(!isSwordEvent(payload)) return;
      const now=s.getGameplayTime();
      if(now < (lastTriggered.get(enemy)||0)) return;
      const maxHp=Math.max(1,enemy.maxHp||enemy.hp||1);
      if(enemy.hp/maxHp > data.executeThreshold) return;
      lastTriggered.set(enemy,now+data.cooldownMs);
      const normalExecuteDamage = enemy.isBoss ? data.bossDamage : Math.max(data.executeFloor, enemy.hp);
      const damage = enemy.isBoss ? data.bossDamage : normalExecuteDamage;
      const tags=mergeTags(SKILLS.execution_sword.tags);
      s.floatText(enemy.x,enemy.y-92,'斩命','#f7fbff');
      const flash=s.add.rectangle(enemy.x,enemy.y-54,96,8,0xf7fbff,0.95).setDepth(152);
      flash.rotation=-0.55;
      s.tweens.add({ targets:flash, alpha:0, scaleX:1.35, duration:150, onComplete:()=>flash.destroy() });
      s.combatSystem.damageEnemy(enemy,damage,{ source:'skill', skillId:'execution_sword', tags, level, allowLifeSteal:false, executionSword:true, noKnockback:true });
    };
    return system.scene.eventBus.on(CombatEvents.SWORD_ATTACKED,onSwordAttacked);
  }
};

const hitWithSword = (system, sword, target, cfg, data, level, ctx, damageScale=1) => {
  const s=system.scene;
  if(!s.targeting.valid(target)) return false;
  s.flyingSwords.markAttack(sword.id,target,{ skillId:cfg.id, tags:cfg.tags, myriadSwords:true });
  const base=data.damage*damageScale;
  const damaged=system.hit(target,system.damageValue(base,ctx),cfg,level,{ ...ctx, noRangerMark:true },system.baseDamageValue(base,ctx));
  sword.attackEndsAt=s.getGameplayTime()+150;
  return damaged;
};

export const MyriadSwordsSkill = {
  cast(system,cfg,data,level,ctx){
    const s=system.scene;
    const created=[];
    const now=s.getGameplayTime();
    for(let i=0;i<data.temporarySwords;i+=1){
      created.push(s.flyingSwords.createSword({ ownerSkillId:'myriad_swords', type:'myriad', temporary:true, durationMs:data.durationMs+220, color:cfg.color, angle:i*0.5, damageScale:1, inheritedTags:cfg.tags }));
    }
    const attackInterval=Math.max(180,Math.round(data.attackIntervalMs/data.speedMultiplier));
    const attackAll = (swords, scale=1) => swords.forEach((sword,index)=>{
      const target=s.targeting.nearestAhead(820);
      if(!target) return;
      hitWithSword(system,sword,target,cfg,data,level,ctx,scale);
      sword.nextMyriadAttackAt=s.getGameplayTime()+attackInterval+index*45;
    });
    if(data.instantExisting){
      const existing=s.flyingSwords.getAll().filter(sword=>sword.ownerSkillId!=='myriad_swords'&&sword.ownerSkillId);
      attackAll(existing,0.72);
    }
    const active={ skillId:cfg.id,cfg,data,level,ctx,nextAt:now,endAt:now+data.durationMs,ended:false,
      tick(){
        const time=s.getGameplayTime();
        created.forEach((sword,index)=>{
          if(!s.flyingSwords.getById(sword.id)||time < (sword.nextMyriadAttackAt||0)) return;
          const target=s.targeting.nearestAhead(820);
          if(!target) return;
          hitWithSword(system,sword,target,cfg,data,level,ctx,1);
          sword.nextMyriadAttackAt=time+attackInterval+index*55;
        });
      },
      onEnd(){
        if(data.endVolley){ attackAll(created.filter(sword=>s.flyingSwords.getById(sword.id)),0.85); }
        created.forEach(sword=>s.flyingSwords.removeSword(sword.id,'myriadEnded'));
      }
    };
    created.forEach((sword,index)=>{ sword.nextMyriadAttackAt=now+index*90; });
    system.active.push(active);
    const flare=s.add.circle(s.player.x,s.player.y-76,82,cfg.color,0.18).setStrokeStyle(5,0xffffff,0.85).setDepth(141);
    s.tweens.add({ targets:flare, alpha:0, scale:1.4, duration:420, onComplete:()=>flare.destroy() });
  }
};
