import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';
import { applyElementalSouls, mainSwordStats } from './SwordFlowState.js';

const nineLevels = (values, build, milestones={}) => values.map((value, index) => ({
  ...build(value, index + 1),
  ...(milestones[index + 1] ? { milestoneText:milestones[index + 1] } : {}),
}));

const configs = {
  fireball: {
    id:'fireball', name:'火球', rarity:'COMMON', handler:'entry_fireball', maxLevel:9,
    tags:[TAGS.MAGIC,TAGS.SPELL,TAGS.FIRE,TAGS.ACTIVE_SKILL,TAGS.PROJECTILE,TAGS.BUILD_FIRE], cooldownMs:1900,
    targetType:'nearestAhead', color:0xff6533, short:'火', manaCost:3,
    description:'自动锁定最近敌人发射法系火球，命中附加灼烧，9级后命中爆炸。',
    levels:nineLevels([
      [30,0,1,1900],[34,0,1,1800],[38,0,1,1350],[42,0,1,1300],[46,0,1,1250],[42,0,2,1250],[46,0,2,1200],[50,0,2,1150],[54,82,2,1100]
    ],([damage,radius,shots,cooldownMs],level)=>({ damage,radius,shots,cooldownMs,manaCost:3,burnDamage:5,burnMs:3200,burnIntervalMs:600,maxStacks:5,explosionScale:0.45,desc:level>=9?'火球命中后产生法系范围爆炸，爆炸也附加灼烧。':level>=6?'每次发射2颗火球，优先攻击不同目标。':'发射1颗法系火球并附加1层灼烧。' }),{
      3:'明显缩短冷却',
      6:'每次发射2颗火球',
      9:'命中后产生范围爆炸'
    })
  },
  sword_wave: {
    id:'sword_wave', name:'御剑术', rarity:'COMMON', handler:'entry_sword', passive:true, maxLevel:9,
    tags:['physical',TAGS.SUMMON,TAGS.PROJECTILE,TAGS.BUILD_SWORD], cooldownMs:999999,
    targetType:'passive', color:0xb8f7ff, short:'剑',
    description:'召出常驻飞剑悬浮身后，自动出击斩杀敌人。',
    levels:nineLevels([
      [1,34,1300],[1,42,1220],[1,50,1180],[1,58,1100],[1,68,1030],[1,78,980],[1,90,920],[1,102,860],[1,116,780]
    ],([swords,damage,attackIntervalMs],level)=>({ swords,damage,attackIntervalMs,desc:level===1?'召出1把常驻主剑自动攻击。':'主剑更快、更大、更强，但始终只有一把。' }),{
      3:'御剑迅捷：主剑飞行速度提高25%，攻击间隔缩短15%',
      6:'剑意锋芒：主剑暴击率+15%，暴击伤害+50%',
      9:'剑威大成：主剑最终伤害+50%，剑体与剑光尺寸+30%'
    })
  },
  poison_cloud: {
    id:'poison_cloud', name:'毒针', rarity:'COMMON', handler:'entry_poison_needle', maxLevel:9,
    tags:[TAGS.POISON,TAGS.DOT,TAGS.ACTIVE_SKILL,TAGS.PROJECTILE,TAGS.BUILD_POISON_SUMMON], cooldownMs:1700,
    targetType:'nearestAhead', color:0x40d060, short:'毒',
    description:'自动向前方发射直线毒针，命中路径上的敌人并施加中毒。',
    levels:nineLevels([
      [26,6,1,1700,3],[32,6,1,1620,3],[52,10,2,1550,3],[62,10,2,1480,3],[75,13,2,1420,3],[91,13,3,1360,999],[109,16,3,1300,999],[130,18,3,1240,999],[156,21,4,1160,999]
    ],([damage,poisonDamage,poisonStacks,cooldownMs,maxHits],level)=>({
      damage,
      poisonDamage,
      poisonStacks,
      cooldownMs,
      maxHits,
      pierce:maxHits,
      poisonMs:4200,
      poisonIntervalMs:700,
      maxStacks:15,
      poisonNeedleLineWidth:56,
      poisonNeedleMaxRange:760,
      poisonHealingRatio:0.03,
      poisonHealingCapMaxHpPerSecond:0.01,
      desc:level>=9
        ?'正常中毒伤害会按实际毒伤3%治疗玩家，每秒最多为最大生命1%。'
        :level>=6
          ?'毒针完全贯穿直线路径上的全部敌人。'
          :level>=3
            ?'剧毒淬炼后，直接伤害与中毒伤害提高30%。'
            :'发射直线毒针，最多命中路径上的3名敌人。'
    }),{
      3:'剧毒淬炼：毒针直接伤害和中毒持续伤害提高30%',
      6:'无尽穿透：取消最多命中3人的限制',
      9:'毒血回生：正常毒伤按3%治疗玩家，每秒上限1%最大生命'
    })
  },
  healing: {
    id:'healing', name:'铁壁', rarity:'COMMON', handler:'entry_iron_wall', passive:true, maxLevel:9,
    tags:[TAGS.SHIELD,TAGS.BUILD_DEFENSE], cooldownMs:999999,
    targetType:'passive', color:0x8aa0b8, short:'壁',
    description:'永久提高防御，并在高等级获得少量伤害减免。',
    levels:nineLevels([
      [3,0],[4,0],[6,0.02],[8,0.02],[10,0.03],[13,0.05],[16,0.06],[20,0.07],[25,0.10]
    ],([defense,damageReduction],level)=>({ defense,damageReduction,desc:`当前等级防御+${defense}，伤害减免${Math.round(damageReduction*100)}%。铁壁不生成护盾。` }),{
      3:'铁骨：防御提高至6点，并获得2%伤害减免。',
      6:'铜墙：防御提高至13点，伤害减免提高至5%。',
      9:'金刚铁壁：防御提高至25点，伤害减免提高至10%。'
    })
  },
  shadow_fist: {
    id:'shadow_fist', name:'身法', rarity:'COMMON', handler:'entry_movement', passive:true, maxLevel:9,
    tags:['shadow',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0x7766ff, short:'身',
    description:'提高攻击速度与闪避率；成功闪避是残影体系的核心入口。',
    levels:nineLevels([
      [0.06,0.05],[0.09,0.07],[0.13,0.10],[0.17,0.12],[0.21,0.14],[0.26,0.17],[0.31,0.19],[0.36,0.22],[0.42,0.25]
    ],([attackSpeedBonus,dodgeChance],level)=>({ attackSpeedBonus,dodgeChance,desc:`攻击速度+${Math.round(attackSpeedBonus*100)}%，闪避率+${Math.round(dodgeChance*100)}%。` }),{
      3:'攻速提高至13%，闪避率提高至10%',
      6:'攻速提高至26%，闪避率提高至17%',
      9:'攻速提高至42%，闪避率提高至25%'
    })
  },
  spirit_wolves:{id:'spirit_wolves',name:'召唤灵狼',rarity:'COMMON',tags:[TAGS.SUMMON,'physical',TAGS.MELEE],maxLevel:9,cooldownMs:8000,targetType:'self',color:0x9fd7ff,short:'狼',handler:'spirit_wolves',description:'独立召唤两只可被攻击和击退的灵狼，全部死亡后才重新冷却。召唤伤害不触发玩家吸血、普攻附带效果、暴击、法宝或普攻事件。',levels:[
    {inheritRatio:.20,hpInheritRatio:.15,cooldownMs:8000,desc:'首次正式释放立即同时召唤2只灵狼；每只继承玩家基础攻击和基础防御20%、基础最大生命15%，两只全部死亡后才进入8秒冷却。'},
    {inheritRatio:.21,hpInheritRatio:.16,cooldownMs:8000,desc:'灵狼基础攻击和基础防御继承提高到21%、基础最大生命继承提高到16%，仍可被敌人攻击和击退。'},
    {inheritRatio:.22,hpInheritRatio:.17,cooldownMs:8000,splashRadius:90,splashScale:.35,milestoneText:'群狼撕咬',desc:'灵狼基础攻击和基础防御继承提高到22%、基础最大生命继承提高到17%；灵狼普通攻击对主目标造成完整伤害，并对90范围内其他敌人造成35%溅射，主目标不重复受伤。'},
    {inheritRatio:.23,hpInheritRatio:.18,cooldownMs:8000,splashRadius:90,splashScale:.35,desc:'灵狼基础攻击和基础防御继承提高到23%、基础最大生命继承提高到18%，全部死亡后才进入下一轮冷却。'},
    {inheritRatio:.24,hpInheritRatio:.19,cooldownMs:8000,splashRadius:90,splashScale:.35,desc:'灵狼基础攻击和基础防御继承提高到24%、基础最大生命继承提高到19%，召唤伤害仍不触发玩家本体连锁。'},
    {inheritRatio:.25,hpInheritRatio:.20,cooldownMs:8000,splashRadius:90,splashScale:.35,deathBurstRadius:120,deathBurstScale:.8,milestoneText:'亡命爆裂',desc:'灵狼基础攻击和基础防御继承提高到25%、基础最大生命继承提高到20%；灵狼生命归零自然死亡时产生120范围爆炸，造成自身攻击力80%伤害，清理/重启/移除不触发。'},
    {inheritRatio:.26,hpInheritRatio:.21,cooldownMs:8000,splashRadius:90,splashScale:.35,deathBurstRadius:120,deathBurstScale:.8,desc:'灵狼基础攻击和基础防御继承提高到26%、基础最大生命继承提高到21%，被击退后会继续追踪敌人。'},
    {inheritRatio:.28,hpInheritRatio:.23,cooldownMs:8000,splashRadius:90,splashScale:.35,deathBurstRadius:120,deathBurstScale:.8,desc:'灵狼基础攻击和基础防御继承提高到28%、基础最大生命继承提高到23%；即使被击退到玩家身后，也会依靠自身速度重新向前推进。'},
    {inheritRatio:.30,hpInheritRatio:.25,cooldownMs:8000,splashRadius:90,splashScale:.35,deathBurstRadius:120,deathBurstScale:.8,scaleBonus:.15,milestoneText:'狼王血脉',desc:'每只灵狼继承30%玩家基础攻击和基础防御、25%基础最大生命，并获得约15%体型强化；仍只召唤2只。'}]},
  spirit_bird:{id:'spirit_bird',name:'灵鸟',rarity:'COMMON',tags:[TAGS.SUMMON],maxLevel:9,cooldownMs:8000,targetType:'self',color:0xf8fafc,short:'鸟',handler:'spirit_bird',description:'召唤一只常驻治疗灵鸟。灵鸟每隔数秒治疗生命比例最低的玩家或召唤物，可以受到敌人攻击，死亡8秒后重新召唤。',milestones:{3:'治疗强化——灵鸟治疗量提高30%。',6:'快速治疗——治疗间隔从3秒缩短为2秒。',9:'群体治疗——每次治疗同时恢复玩家和所有存活召唤物的生命。'},levels:[
    {hpRatio:.10,defenseRatio:.10,healRatio:.020,healMultiplier:1,healIntervalMs:3000,desc:'继承玩家基础最大生命10%、基础防御10%；每3秒治疗玩家当前最大生命2.00%，治疗生命比例最低的玩家或召唤物。'},
    {hpRatio:.11,defenseRatio:.11,healRatio:.022,healMultiplier:1,healIntervalMs:3000,desc:'继承玩家基础最大生命11%、基础防御11%；每3秒治疗玩家当前最大生命2.20%。'},
    {hpRatio:.12,defenseRatio:.12,healRatio:.024,healMultiplier:1.3,healIntervalMs:3000,milestoneText:'治疗强化',desc:'继承玩家基础最大生命12%、基础防御12%；治疗强化生效，每3秒治疗玩家当前最大生命3.12%。'},
    {hpRatio:.13,defenseRatio:.13,healRatio:.027,healMultiplier:1.3,healIntervalMs:3000,desc:'继承玩家基础最大生命13%、基础防御13%；治疗强化生效，每3秒治疗玩家当前最大生命3.51%。'},
    {hpRatio:.14,defenseRatio:.14,healRatio:.030,healMultiplier:1.3,healIntervalMs:3000,desc:'继承玩家基础最大生命14%、基础防御14%；治疗强化生效，每3秒治疗玩家当前最大生命3.90%。'},
    {hpRatio:.15,defenseRatio:.15,healRatio:.033,healMultiplier:1.3,healIntervalMs:2000,milestoneText:'快速治疗',desc:'继承玩家基础最大生命15%、基础防御15%；治疗强化生效，快速治疗使间隔缩短为2秒，治疗玩家当前最大生命4.29%。'},
    {hpRatio:.16,defenseRatio:.16,healRatio:.036,healMultiplier:1.3,healIntervalMs:2000,desc:'继承玩家基础最大生命16%、基础防御16%；治疗强化和快速治疗生效，每2秒治疗玩家当前最大生命4.68%。'},
    {hpRatio:.18,defenseRatio:.18,healRatio:.038,healMultiplier:1.3,healIntervalMs:2000,desc:'继承玩家基础最大生命18%、基础防御18%；治疗强化和快速治疗生效，每2秒治疗玩家当前最大生命4.94%。'},
    {hpRatio:.20,defenseRatio:.20,healRatio:.040,healMultiplier:1.3,healIntervalMs:2000,groupHeal:true,milestoneText:'群体治疗',desc:'继承玩家基础最大生命20%、基础防御20%；每2秒群体治疗玩家当前最大生命5.20%，同时恢复玩家和所有存活召唤物，不包括灵鸟自己。'}]},
};

export function configureEntryArchetypeSkills(){
  const keep=new Set(Object.keys(configs));
  Object.keys(SKILLS).forEach(id=>{ if(!keep.has(id)) delete SKILLS[id]; });
  Object.entries(configs).forEach(([id,config])=>{ SKILLS[id]={...config}; });
}

function passiveUpdater(system, key, apply){
  const updater=()=>apply(system.getData(key),system.getLevel(key));
  system.passiveUpdaters.push(updater);
  updater();
  return ()=>{};
}

export const EntryFireballSkill={
  cast(system,cfg,data,level,ctx){ return system.castFireball(cfg,data,level,ctx); }
};

const poisonNeedleAimPoint=enemy=>({
  x:enemy.x,
  y:enemy.y-45
});

export const EntryPoisonNeedleSkill={
  bind(system){
    const s=system.scene;
    let windowStart=0;
    let healedThisWindow=0;
    let pendingPoisonHealing=0;
    const off=s.eventBus.on(CombatEvents.STATUS_TICK,p=>{
      const data=system.getData('poison_cloud');
      const level=system.getLevel('poison_cloud');
      if(level<9||!data||p.type!==StatusEffects.POISON||p.actualDamage<=0||p.effect?.poisonMeta?.nonNormal) return;
      const now=s.getGameplayTime();
      if(now-windowStart>=1000){
        windowStart=now;
        healedThisWindow=0;
        pendingPoisonHealing=Math.min(1,Math.max(0,pendingPoisonHealing%1));
      }
      const player=s.playerData;
      const max=player.maxHp||player.maxHealth||player.hp||0;
      const finiteCap=!player.ignorePoisonHealingCap;
      const cap=finiteCap?max*(data.poisonHealingCapMaxHpPerSecond||0.01):Infinity;
      const room=Math.max(0,cap-healedThisWindow);
      if(finiteCap&&room<1){
        pendingPoisonHealing=Math.min(1,Math.max(0,pendingPoisonHealing%1));
        return;
      }
      if(player.hp>=max){
        pendingPoisonHealing=Math.min(1,Math.max(0,pendingPoisonHealing%1));
        return;
      }
      pendingPoisonHealing+=p.actualDamage*(data.poisonHealingRatio||0.03);
      const request=Math.floor(pendingPoisonHealing);
      if(request<=0) return;
      const actual=s.healPlayer?.(request,'poison_cloud',{
        skillId:'poison_cloud',
        maxActualHeal:finiteCap?room:undefined
      })||0;
      healedThisWindow+=actual;
      pendingPoisonHealing=Math.min(1,Math.max(0,pendingPoisonHealing-request));
    });
    return ()=>off?.();
  },
  cast(system,cfg,data,level,ctx){
    const s=system.scene;
    const origin={x:s.player.x,y:s.player.y-55};
    const maxRange=data.poisonNeedleMaxRange||760;
    const halfWidth=(data.poisonNeedleLineWidth||56)/2;
    const ahead=s.targeting.all()
      .filter(enemy=>s.targeting.valid(enemy)&&enemy.x>=origin.x-10)
      .map(enemy=>{
        const aim=poisonNeedleAimPoint(enemy);
        return {
          enemy,
          aim,
          distance:Math.hypot(aim.x-origin.x,aim.y-origin.y)
        };
      })
      .filter(item=>item.distance<=maxRange)
      .sort((left,right)=>left.distance-right.distance);
    const first=ahead[0];
    if(!first) return {failed:true};

    const length=Math.max(1,first.distance);
    const direction={
      x:(first.aim.x-origin.x)/length,
      y:(first.aim.y-origin.y)/length
    };
    const candidates=ahead
      .map(item=>{
        const dx=item.aim.x-origin.x;
        const dy=item.aim.y-origin.y;
        return {
          ...item,
          along:dx*direction.x+dy*direction.y,
          perpendicular:Math.abs(dx*direction.y-dy*direction.x)
        };
      })
      .filter(item=>item.along>=0&&item.along<=maxRange&&item.perpendicular<=halfWidth)
      .sort((left,right)=>left.along-right.along);
    const targets=candidates
      .slice(0,data.maxHits||data.pierce||3)
      .map(item=>item.enemy);
    if(!targets.length) return {failed:true};

    ctx.originalTargets=targets;
    ctx.originalTarget=targets[0];
    const farthest=candidates[Math.min(targets.length,candidates.length)-1];
    const endDistance=Math.min(maxRange,farthest?.along||first.distance);
    system.projectile(
      origin.x,
      origin.y,
      origin.x+direction.x*endDistance,
      origin.y+direction.y*endDistance,
      0x60e878
    );
    targets.forEach(target=>{
      system.hit(
        target,
        system.damageValue(data.damage,ctx),
        cfg,
        level,
        ctx,
        system.baseDamageValue(data.damage,ctx)
      );
      s.statusEffects.add(StatusEffects.POISON,target,{
        durationMs:data.poisonMs,
        intervalMs:data.poisonIntervalMs,
        value:data.poisonDamage,
        stacks:data.poisonStacks,
        maxStacks:data.maxStacks,
        sourceId:'entry_poison_needle',
        poisonMeta:{normal:true,sourceSkillId:'poison_cloud'},
        damageMultiplier:ctx.damageMultiplier,
        baseDamageMultiplierWithoutProfession:ctx.baseDamageMultiplierWithoutProfession,
        professionMultiplier:ctx.professionMultiplier,
        professionApplied:true
      });
    });
    return {targets};
  }
};

export const EntrySwordSkill={
  bind(system){
    const state={ readyAt:0, chain:null };
    const hitTarget=(target,stats)=>{
      const s=system.scene;
      if(!target||!s.targeting.valid(target)) return false;
      const damaged=s.combatSystem.damageEnemy(target,stats.damage,{source:'skill',skillId:'sword_wave',tags:SKILLS.sword_wave.tags,allowLifeSteal:false,noKnockback:true,canCrit:true,bonusCritChance:stats.critChance,bonusCritMultiplier:stats.critMultiplierBonus});
      if(damaged) applyElementalSouls(system,target,stats,'sword_wave',false);
      return damaged;
    };
    return passiveUpdater(system,'sword_wave',(data,level)=>{
      const s=system.scene;
      if(!data||level<=0){ s.flyingSwords?.getAll().filter(x=>x.ownerSkillId==='sword_wave').forEach(x=>s.flyingSwords.removeSword(x.id,'skillRemoved')); state.chain=null; return; }
      const owned=s.flyingSwords?.getAll().filter(x=>x.ownerSkillId==='sword_wave')||[];
      while(owned.length<1) owned.push(s.flyingSwords.createSword({ownerSkillId:'sword_wave',type:'imperial',damageScale:1,color:0xb8f7ff}));
      while(owned.length>1){ const removed=owned.pop(); s.flyingSwords.removeSword(removed.id,'singleMainSword'); }
      const sword=owned[0], now=s.getGameplayTime(), stats=mainSwordStats(system,data);
      if(sword){ sword.flightSpeed=stats.speed; sword.bodyScale=stats.bodySize; sword.glowScale=stats.glowSize; s.flyingSwords.applySwordVisualScale?.(sword.id,stats.bodySize,stats.glowSize); }
      if(state.chain){
        const chain=state.chain;
        if(chain.returning){
          if(sword.state!=='orbit') s.flyingSwords.returnToOrbit(sword.id);
          if(now>=chain.returnDoneAt){ state.chain=null; state.readyAt=now+stats.intervalMs; }
          return;
        }
        let target=chain.targets[chain.index];
        while(target&&!s.targeting.valid(target)){ chain.index+=1; target=chain.targets[chain.index]; }
        if(!target){ chain.returning=true; chain.returnDoneAt=now+260; s.flyingSwords.returnToOrbit(sword.id); return; }
        if(sword.target!==target) s.flyingSwords.markAttack(sword.id,target,{skillId:'sword_wave',mythic:true});
        const arrived=sword.view?Math.hypot(sword.view.x-target.x,sword.view.y-(target.y-48))<=42*stats.glowSize:true;
        if(arrived){ if(!chain.hit.has(target)){ hitTarget(target,stats); chain.hit.add(target); } chain.index+=1; }
        return;
      }
      if(sword.attackEndsAt&&now>=sword.attackEndsAt){ hitTarget(sword.target,stats); sword.attackEndsAt=0; s.flyingSwords.returnToOrbit(sword.id); }
      if(now<state.readyAt||sword.state==='attack') return;
      if(stats.mythic){
        const targets=s.targeting.all().filter(e=>e.active&&!e.isDefeated);
        if(!targets.length) return;
        state.chain={ targets:[...targets], index:0, hit:new Set(), returning:false, returnDoneAt:0 };
        s.flyingSwords.markAttack(sword.id,targets[0],{skillId:'sword_wave',mythic:true});
        return;
      }
      const target=s.targeting.nearestAhead(760); if(!target) return;
      s.flyingSwords.markAttack(sword.id,target,{skillId:'sword_wave'});
      sword.attackEndsAt=now+Math.max(90,Math.round(170/stats.speed)); state.readyAt=now+stats.intervalMs;
    });
  }
};

export const EntryIronWallSkill={
  bind(system){
    const updater=()=>{
      const p=system.scene.playerData;
      p.defenseBonuses??={};
      p.damageReductionBonuses??={};
      const data=system.getData('healing');
      if(data){
        p.defenseBonuses.healing=data.defense||0;
        if(data.damageReduction) p.damageReductionBonuses.healing=data.damageReduction;
        else delete p.damageReductionBonuses.healing;
      } else {
        delete p.defenseBonuses.healing;
        delete p.damageReductionBonuses.healing;
      }
      system.scene.hud?.update?.();
      if(system.scene.playerInfoPanel?.isOpen) system.scene.playerInfoPanel.render();
    };
    system.passiveUpdaters.push(updater);
    updater();
    return ()=>{ const p=system.scene.playerData; delete p.defenseBonuses?.healing; delete p.damageReductionBonuses?.healing; system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==updater); };
  }
};

export const EntryMovementSkill={
  bind(system){
    let appliedDodge=0, appliedAttackSpeed=0;
    const updater=()=>{
      const data=system.getData('shadow_fist');
      const p=system.scene.playerData;
      p.dodgeChance=Math.max(0,(p.dodgeChance||0)-appliedDodge);
      p.attackSpeedMultiplier=Math.max(0.2,(p.attackSpeedMultiplier||1)-appliedAttackSpeed);
      appliedDodge=data?.dodgeChance||0;
      appliedAttackSpeed=data?.attackSpeedBonus||0;
      p.dodgeChance=Math.min(0.70,p.dodgeChance+appliedDodge);
      p.attackSpeedMultiplier+=appliedAttackSpeed;
    };
    system.passiveUpdaters.push(updater); updater();
    return ()=>{ const p=system.scene.playerData; p.dodgeChance=Math.max(0,(p.dodgeChance||0)-appliedDodge); p.attackSpeedMultiplier=Math.max(0.2,(p.attackSpeedMultiplier||1)-appliedAttackSpeed); system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==updater); };
  }
};
