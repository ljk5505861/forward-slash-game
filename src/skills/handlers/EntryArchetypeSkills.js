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
    ],([damage,poisonDamage,poisonStacks,cooldownMs,maxHits],level)=>({ damage,poisonDamage,poisonStacks,cooldownMs,maxHits,pierce:maxHits,poisonMs:4200,poisonIntervalMs:700,maxStacks:15,poisonNeedleLineWidth:56,poisonNeedleMaxRange:760,poisonHealingRatio:0.03,poisonHealingCapMaxHpPerSecond:0.01,desc:level>=9?'正常中毒伤害会按实际毒伤3%治疗玩家，每秒最多为最大生命1%。':level>=6?'毒针完全贯穿直线路径上的全部敌人。':level>=3?'剧毒淬炼后，直接伤害与中毒伤害提高30%。':'发射直线毒针，最多命中路径上的3名敌人。' }),{
      3:'剧毒淬炼：毒针直接伤害和中毒持续伤害提高30%',
      6:'无尽穿透：取消最多命中3人的限制',
      9:'毒血回生：正常毒伤按3%治疗玩家，每秒上限1%最大生命'
    })
  },
  spinning_blade: {
    id:'spinning_blade', name:'重击', rarity:'COMMON', handler:'entry_heavy_hit', passive:true, maxLevel:9,
    tags:['physical',TAGS.NORMAL_ATTACK,TAGS.HEAVY_HIT,TAGS.MELEE,TAGS.BUILD_STRENGTH], cooldownMs:999999,
    targetType:'passive', color:0xffbb66, short:'重',
    description:'每数次普通攻击触发一次重击，造成更高伤害和击退。',
    levels:nineLevels([
      [5,1.55,0],[5,1.7,0],[4,1.8,0.01],[4,1.95,0.01],[4,2.1,0.02],[3,2.2,0.03],[3,2.35,0.04],[3,2.5,0.05],[2,2.65,0.07]
    ],([heavyHitEvery,heavyHitMultiplier,heavyHitLifeSteal],level)=>({ heavyHitEvery,heavyHitMultiplier,heavyHitLifeSteal,desc:level===1?'每5次普通攻击触发一次重击。':`每${heavyHitEvery}次攻击触发${Math.round(heavyHitMultiplier*100)}%伤害重击。` }),{
      3:'每4次攻击触发重击，并获得1%重击吸血',
      6:'每3次攻击触发重击，并获得3%重击吸血',
      9:'每2次攻击触发重击，并获得7%重击吸血'
    })
  },
  healing: {
    id:'healing', name:'铁壁', rarity:'COMMON', handler:'entry_iron_wall', passive:true, maxLevel:9,
    tags:[TAGS.SHIELD,TAGS.BUILD_DEFENSE], cooldownMs:999999,
    targetType:'passive', color:0x8aa0b8, short:'壁',
    description:'永久提高防御，并在高等级获得少量伤害减免。',
    levels:nineLevels([
      [2,0],[3,0],[5,0],[7,0.02],[9,0.03],[12,0.04],[15,0.05],[18,0.06],[22,0.08]
    ],([defense,damageReduction],level)=>({ defense,damageReduction,desc:level===1?'永久获得2点防御。':`获得${defense}点防御${damageReduction?`和${Math.round(damageReduction*100)}%减伤`:''}。` }),{
      3:'防御提高至5点',
      6:'防御提高至12点，并获得4%伤害减免',
      9:'防御提高至22点，并获得8%伤害减免'
    })
  },
  shadow_fist: {
    id:'shadow_fist', name:'身法', rarity:'COMMON', handler:'entry_movement', passive:true, maxLevel:9,
    tags:['shadow',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0x7766ff, short:'身',
    description:'提高闪避率；成功闪避是后续残影技能的核心入口。',
    levels:nineLevels([
      0.05,0.07,0.10,0.12,0.14,0.17,0.19,0.22,0.25
    ],(dodgeChance,level)=>({ dodgeChance,desc:`获得${Math.round(dodgeChance*100)}%闪避率。` }),{
      3:'闪避率提高至10%',
      6:'闪避率提高至17%',
      9:'闪避率提高至25%'
    })
  }
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

export const EntryPoisonNeedleSkill={
  bind(system){
    const s=system.scene;
    let windowStart=0;
    let healedThisWindow=0;
    let pendingPoisonHealing=0;

    const healingMultiplier=()=>{
      const bonuses=s.playerData.healingReceivedMultiplierBonuses||{};
      return Math.max(
        0.01,
        1+Object.values(bonuses).reduce(
          (sum,value)=>sum+(Number(value)||0),
          0
        )
      );
    };
    const maxBaseRequestForActualCap=(actualCap,multiplier)=>{
      if(!Number.isFinite(actualCap)) return Number.POSITIVE_INFINITY;
      const cap=Math.max(0,Math.floor(actualCap));
      if(cap<=0) return 0;
      return Math.max(0,Math.ceil((cap+1)/multiplier)-1);
    };

    const off=s.eventBus.on(CombatEvents.STATUS_TICK,p=>{
      const data=system.getData('poison_cloud');
      const level=system.getLevel('poison_cloud');
      if(
        level<9
        || !data
        || p.type!==StatusEffects.POISON
        || p.actualDamage<=0
        || p.effect?.poisonMeta?.nonNormal
      ){
        return;
      }

      const now=s.getGameplayTime();
      if(now-windowStart>=1000){
        windowStart=now;
        healedThisWindow=0;
      }

      pendingPoisonHealing+=p.actualDamage*(data.poisonHealingRatio||0.03);
      const available=Math.floor(pendingPoisonHealing);
      if(available<=0) return;

      const max=s.playerData.maxHp
        || s.playerData.maxHealth
        || s.playerData.hp
        || 0;
      if((s.playerData.hp||0)>=max){
        pendingPoisonHealing%=1;
        return;
      }

      const uncapped=s.playerData.ignorePoisonHealingCap===true;
      const perSecondCap=uncapped
        ?Number.POSITIVE_INFINITY
        :max*(data.poisonHealingCapMaxHpPerSecond||0.01);
      const remainingActual=uncapped
        ?Number.POSITIVE_INFINITY
        :Math.max(0,Math.floor(perSecondCap-healedThisWindow));
      const baseCap=maxBaseRequestForActualCap(
        remainingActual,
        healingMultiplier()
      );
      const request=Math.min(available,baseCap);
      if(request<=0){
        pendingPoisonHealing%=1;
        return;
      }

      const healed=s.healPlayer?.(
        request,
        'poison_healing',
        {
          skillId:'poison_cloud',
          actualPoisonDamage:p.actualDamage
        }
      )||0;
      pendingPoisonHealing=Math.max(0,pendingPoisonHealing-request);
      if(healed>0) healedThisWindow+=healed;
      else pendingPoisonHealing%=1;
    });
    return ()=>off?.();
  },
  cast(system,cfg,data,level,ctx){
    const s=system.scene;
    const origin={x:s.player.x,y:s.player.y-55};
    const maxRange=data.poisonNeedleMaxRange||760, halfWidth=(data.poisonNeedleLineWidth||56)/2;
    const first=s.targeting.all().filter(e=>s.targeting.valid(e)&&e.x>=origin.x-10).sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y))[0];
    if(!first) return { failed:true };
    const len=Math.max(1,Math.hypot(first.x-origin.x,(first.y-45)-origin.y));
    const dir={x:(first.x-origin.x)/len,y:((first.y-45)-origin.y)/len};
    const candidates=s.targeting.all().map(e=>{ const cx=e.x-origin.x, cy=(e.y-45)-origin.y; const along=cx*dir.x+cy*dir.y; const perp=Math.abs(cx*dir.y-cy*dir.x); return {e,along,perp}; }).filter(h=>h.along>=0&&h.along<=maxRange&&h.perp<=halfWidth&&s.targeting.valid(h.e)).sort((a,b)=>a.along-b.along);
    const targets=candidates.slice(0,data.maxHits||3).map(h=>h.e);
    ctx.originalTargets=targets; ctx.originalTarget=targets[0]||null;
    const endAlong=targets.length?Math.max(...targets.map(t=>{ const cx=t.x-origin.x, cy=(t.y-45)-origin.y; return cx*dir.x+cy*dir.y; })):maxRange;
    const end={x:origin.x+dir.x*Math.min(maxRange,endAlong),y:origin.y+dir.y*Math.min(maxRange,endAlong)};
    system.projectile(origin.x,origin.y,end.x,end.y,0x60e878,220);
    targets.forEach(target=>{
      system.hit(target,system.damageValue(data.damage,ctx),cfg,level,ctx,system.baseDamageValue(data.damage,ctx));
      s.statusEffects.add(StatusEffects.POISON,target,{ durationMs:data.poisonMs,intervalMs:data.poisonIntervalMs,value:data.poisonDamage,stacks:data.poisonStacks,maxStacks:data.maxStacks,sourceId:'entry_poison_needle',poisonMeta:{normal:true,sourceSkillId:'poison_cloud'},damageMultiplier:ctx.damageMultiplier,baseDamageMultiplierWithoutProfession:ctx.baseDamageMultiplierWithoutProfession,professionMultiplier:ctx.professionMultiplier,professionApplied:true });
    });
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

export const EntryHeavyHitSkill={
  bind(system){
    let appliedLifeSteal=0;
    return passiveUpdater(system,'spinning_blade',(data,level)=>{
      const p=system.scene.playerData;
      p.heavyHitEvery=data?.heavyHitEvery||0;
      p.heavyHitMultiplier=data?.heavyHitMultiplier||1.8;
      p.heavyHitLifeSteal=Math.max(0,(p.heavyHitLifeSteal||0)-appliedLifeSteal);
      appliedLifeSteal=data?.heavyHitLifeSteal||0;
      p.heavyHitLifeSteal+=appliedLifeSteal;
      if(level<=0){ p.heavyHitCounter=0; p.nextAttackIsHeavy=false; }
    });
  }
};

export const EntryIronWallSkill={
  bind(system){
    let appliedDefense=0;
    let appliedReduction=0;
    return passiveUpdater(system,'healing',(data)=>{
      const p=system.scene.playerData;
      p.defense=Math.max(0,(p.defense||0)-appliedDefense);
      p.damageReduction=Math.max(0,(p.damageReduction||0)-appliedReduction);
      appliedDefense=data?.defense||0;
      appliedReduction=data?.damageReduction||0;
      p.defense+=appliedDefense;
      p.damageReduction=Math.min(0.8,p.damageReduction+appliedReduction);
    });
  }
};

export const EntryMovementSkill={
  bind(system){
    let appliedDodge=0;
    return passiveUpdater(system,'shadow_fist',(data)=>{
      const p=system.scene.playerData;
      p.dodgeChance=Math.max(0,(p.dodgeChance||0)-appliedDodge);
      appliedDodge=data?.dodgeChance||0;
      p.dodgeChance=Math.min(0.75,p.dodgeChance+appliedDodge);
    });
  }
};
