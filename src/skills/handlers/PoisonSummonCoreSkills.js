import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

export const POISON_SUMMON_TUNING = Object.freeze({
  gu:{
    baseMaxCount:2,
    baseHp:48,
    freeLifeLossPerSecond:4,
    attachedLifeLossPerSecond:2.5,
    leechIntervalMs:1000,
    leechDamage:10,
    leechHealRatio:1,
    poisonAbsorbRatio:0.35,
    poisonEnergyRatio:0.8,
    splitEnergy:28,
    reviveMs:3500,
    transferMs:400,
    berserkHpRatio:0.3,
    berserkMs:6000,
    berserkIntervalMultiplier:0.5,
    berserkDamageMultiplier:1.5,
    berserkPoisonEnergyMultiplier:2
  }
});

const levels=(rows,build,milestones={})=>rows.map((row,i)=>({
  ...build(row,i+1),
  ...(milestones[i+1]?{milestoneText:milestones[i+1]}:{})
}));
const removeUpdater=(system,fn)=>{
  const i=system.passiveUpdaters.indexOf(fn);
  if(i>=0) system.passiveUpdaters.splice(i,1);
};
const isNormalPoisonTick=p=>
  p?.type===StatusEffects.POISON
  && p.actualDamage>0
  && !p.effect?.poisonMeta?.nonNormal
  && !p.effect?.noPoisonKingRecursive;
const healEntity=(entity,amount,max)=>{
  const before=entity.hp??entity.currentHp??0;
  const cap=max??entity.maxHp??entity.maxHealth??before;
  entity.hp=Math.min(cap,before+Math.max(0,amount));
  return entity.hp-before;
};

const CONFIGS={
  parasitic_gu:{
    id:'parasitic_gu',
    name:'寄生蛊',
    rarity:'RARE',
    handler:'parasitic_gu',
    passive:true,
    maxLevel:9,
    coreSkill:true,
    requiredSkillId:'poison_cloud',
    tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],
    cooldownMs:999999,
    targetType:'passive',
    color:0x8ad66f,
    short:'蛊',
    description:'生成拥有独立生命的寄生蛊，附体中毒敌人，吸血、吸毒并积累毒能分裂。',
    levels:levels(
      [[48,2,4,10,28],[54,2,4,11,28],[60,2,2.4,12,26],[66,2,2.4,13,26],[72,2,2.4,14,24],[78,2,2.4,21,24],[86,2,2.4,23,22],[94,2,2.4,25,22],[104,2,2.4,38,20]],
      ([hp,maxCount,lifeLossPerSecond,leechDamage,splitEnergy],level)=>({
        hp,
        maxCount,
        lifeLossPerSecond,
        leechDamage,
        splitEnergy,
        leechIntervalMs:POISON_SUMMON_TUNING.gu.leechIntervalMs,
        poisonAbsorbRatio:POISON_SUMMON_TUNING.gu.poisonAbsorbRatio,
        poisonEnergyRatio:POISON_SUMMON_TUNING.gu.poisonEnergyRatio,
        reviveMs:POISON_SUMMON_TUNING.gu.reviveMs,
        desc:level>=9
          ?'低生命会狂暴，吸血更快更痛，吸毒能量翻倍。'
          :level>=6
            ?'蚀血解锁后吸取生命伤害提高50%。'
            :level>=3
              ?'顽强寄生解锁后自然生命流失降低40%。'
              :'生成1只寄生蛊，最多分裂到2只。'
      }),
      {
        3:'顽强寄生：自然生命流失速度降低40%',
        6:'蚀血：吸取生命伤害提高50%',
        9:'狂暴：低生命时短暂强化吸血与吸毒'
      }
    )
  }
};

export function configurePoisonSummonCoreSkills(){
  Object.entries(CONFIGS).forEach(([id,cfg])=>{ SKILLS[id]={...cfg}; });
}

export const ParasiticGuSkill={
  bind(system){
    const s=system.scene;
    const guList=[];
    const visuals=new Set();
    let nextReviveAt=0;
    let lastAt=s.getGameplayTime();

    const infected=()=>s.targeting.all().filter(
      e=>s.targeting.valid(e)&&s.statusEffects.has(e,StatusEffects.POISON)
    );
    const occupied=t=>guList.some(g=>!g.dead&&g.host===t);
    const choose=()=>infected()
      .filter(e=>!occupied(e))
      .sort(
        (a,b)=>s.statusEffects.getStackCount(b,StatusEffects.POISON)
          -s.statusEffects.getStackCount(a,StatusEffects.POISON)
      )[0]||null;
    const makeVisual=(x,y)=>{
      const c=s.add.circle(x,y,8,0x8ad66f,0.88)
        .setStrokeStyle(2,0xe4ffd0,0.9)
        .setDepth(152);
      visuals.add(c);
      return c;
    };
    const snapshot=()=>guList
      .filter(g=>!g.dead)
      .map(g=>({
        id:g.id,
        hp:g.hp,
        maxHp:g.maxHp,
        energy:g.energy,
        host:g.host,
        berserkUntil:g.berserkUntil,
        lowHpArmed:g.lowHpArmed,
        nextLeechAt:g.nextLeechAt
      }));
    const runtime={ getSnapshot:snapshot };
    system.passiveState.parasiticGu=runtime;

    const attach=(gu,target)=>{
      if(!gu||gu.dead) return;
      gu.host=target&&!occupied(target)?target:null;
      gu.freeUntil=s.getGameplayTime()+POISON_SUMMON_TUNING.gu.transferMs;
    };
    const spawn=(seed={})=>{
      const data=system.getData('parasitic_gu');
      if(!data||guList.filter(g=>!g.dead).length>=data.maxCount) return null;
      const gu={
        id:`gu_${s.getGameplayTime()}_${guList.length}`,
        hp:data.hp,
        maxHp:data.hp,
        energy:seed.energy||0,
        host:null,
        freeUntil:0,
        nextLeechAt:s.getGameplayTime()+350,
        berserkUntil:0,
        lowHpArmed:true,
        view:makeVisual(s.player.x,s.player.y-40),
        dead:false
      };
      guList.push(gu);
      attach(gu,choose());
      return gu;
    };
    const kill=gu=>{
      if(!gu||gu.dead) return;
      gu.dead=true;
      gu.view?.destroy?.();
      visuals.delete(gu.view);
    };
    const split=(gu,data)=>{
      if(guList.filter(g=>!g.dead).length>=data.maxCount||!choose()) return false;
      gu.energy-=data.splitEnergy;
      spawn({energy:0});
      return true;
    };

    const offTick=s.eventBus.on(CombatEvents.STATUS_TICK,p=>{
      if(!isNormalPoisonTick(p)) return;
      const data=system.getData('parasitic_gu');
      if(!data) return;
      guList.filter(g=>!g.dead&&g.host===p.target).forEach(g=>{
        const berserk=system.getLevel('parasitic_gu')>=9
          && s.getGameplayTime()<g.berserkUntil;
        const multiplier=berserk
          ?POISON_SUMMON_TUNING.gu.berserkPoisonEnergyMultiplier
          :1;
        const heal=p.actualDamage*data.poisonAbsorbRatio*multiplier;
        healEntity(g,heal,g.maxHp);
        g.energy+=p.actualDamage*data.poisonEnergyRatio*multiplier;
        if(g.energy>=data.splitEnergy) split(g,data);
      });
    });
    const offKill=s.eventBus.on(CombatEvents.ENEMY_KILLED,p=>{
      guList.filter(g=>g.host===p.enemy).forEach(g=>attach(g,choose()));
    });

    const updater=()=>{
      const now=s.getGameplayTime();
      const dt=Math.max(0,now-lastAt)/1000;
      lastAt=now;
      const data=system.getData('parasitic_gu');
      if(!data){
        guList.forEach(kill);
        return;
      }
      if(!guList.some(g=>!g.dead)&&now>=nextReviveAt) spawn();
      guList.forEach(g=>{
        if(g.dead) return;
        if(
          !g.host
          || !s.targeting.valid(g.host)
          || !s.statusEffects.has(g.host,StatusEffects.POISON)
        ){
          attach(g,choose());
        }

        g.hp-=data.lifeLossPerSecond*dt;
        if(g.hp<=0){
          kill(g);
          nextReviveAt=now+data.reviveMs;
          return;
        }

        if(g.hp/g.maxHp>0.55) g.lowHpArmed=true;
        if(
          system.getLevel('parasitic_gu')>=9
          && g.lowHpArmed
          && g.hp/g.maxHp<POISON_SUMMON_TUNING.gu.berserkHpRatio
          && now>=g.berserkUntil
        ){
          g.berserkUntil=now+POISON_SUMMON_TUNING.gu.berserkMs;
          g.lowHpArmed=false;
        }

        const berserk=system.getLevel('parasitic_gu')>=9
          && now<g.berserkUntil;
        if(g.view){
          const target=g.host||s.player;
          g.view.x+=(target.x-g.view.x)*0.22;
          g.view.y+=((target.y||s.player.y)-70-g.view.y)*0.22;
          g.view.setFillStyle(berserk?0xff4b55:0x8ad66f,0.9);
          g.view.setScale(berserk?1.25:1);
        }

        if(g.host&&now>=g.nextLeechAt){
          const interval=data.leechIntervalMs*(
            berserk?POISON_SUMMON_TUNING.gu.berserkIntervalMultiplier:1
          );
          g.nextLeechAt=now+interval;
          const damage=Math.round(
            data.leechDamage*(
              berserk?POISON_SUMMON_TUNING.gu.berserkDamageMultiplier:1
            )
          );
          const before=g.host.hp||0;
          s.combatSystem.damageEnemy(g.host,damage,{
            source:'skill',
            skillId:'parasitic_gu',
            damageKind:'guLeech',
            tags:[TAGS.POISON,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],
            allowLifeSteal:false,
            noKnockback:true,
            noPoisonChain:true
          });
          healEntity(g,Math.max(0,before-(g.host.hp||0)),g.maxHp);
        }
      });
    };

    system.passiveUpdaters.push(updater);
    updater();
    return ()=>{
      offTick();
      offKill();
      removeUpdater(system,updater);
      guList.forEach(kill);
      visuals.forEach(v=>v.destroy?.());
      visuals.clear();
      if(system.passiveState.parasiticGu===runtime){
        delete system.passiveState.parasiticGu;
      }
    };
  }
};
