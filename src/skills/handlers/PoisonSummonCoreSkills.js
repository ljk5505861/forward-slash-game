import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

export const POISON_SUMMON_TUNING=Object.freeze({
  gu:{
    baseMaxCount:2,
    baseHp:48,
    leechIntervalMs:1000,
    leechDamage:10,
    poisonAbsorbRatio:0.03,
    poisonEnergyRatio:0.8,
    splitEnergy:28,
    reviveMs:3500,
    transferMs:400,
    berserkHpRatio:0.3,
    berserkMs:6000,
    berserkIntervalMultiplier:0.5,
    berserkDamageMultiplier:1.5,
    berserkPoisonEnergyMultiplier:2
  },
  poison:{
    normalKinds:new Set(['poison'])
  }
});

const levels=(rows,build,milestones={})=>rows.map((row,index)=>({
  ...build(row,index+1),
  ...(milestones[index+1]
    ?{milestoneText:milestones[index+1]}
    :{})
}));

const removeUpdater=(system,fn)=>{
  const index=system.passiveUpdaters.indexOf(fn);
  if(index>=0) system.passiveUpdaters.splice(index,1);
};

const isNormalPoisonTick=payload=>
  payload?.type===StatusEffects.POISON
  &&payload.actualDamage>0
  &&!payload.effect?.poisonMeta?.nonNormal
  &&!payload.effect?.noPoisonKingRecursive;

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
    description:'生成拥有独立生命的寄生蛊，攻击宿主叠毒，只能吸收宿主受到的毒伤恢复生命并积累毒能分裂。',
    levels:levels(
      [
        [48,2,4,10,28],
        [54,2,4,11,28],
        [60,2,2.4,12,26],
        [66,2,2.4,13,26],
        [72,2,2.4,14,24],
        [78,2,2.4,21,24],
        [86,2,2.4,23,22],
        [94,2,2.4,25,22],
        [104,2,2.4,38,20]
      ],
      ([hp,maxCount,lifeLossPerSecond,leechDamage,splitEnergy],level)=>({
        hp,
        maxCount,
        lifeLossPerSecond,
        leechDamage,
        attackDamage:leechDamage,
        poisonStacks:level>=6?2:1,
        splitEnergy,
        leechIntervalMs:POISON_SUMMON_TUNING.gu.leechIntervalMs,
        poisonAbsorbRatio:POISON_SUMMON_TUNING.gu.poisonAbsorbRatio,
        poisonEnergyRatio:POISON_SUMMON_TUNING.gu.poisonEnergyRatio,
        reviveMs:POISON_SUMMON_TUNING.gu.reviveMs,
        desc:level>=9
          ?'低生命进入狂暴，攻击更快更痛，吸毒恢复与毒能翻倍。'
          :level>=6
            ?'攻击伤害提高50%，每次攻击给宿主叠加2层毒。'
            :level>=3
              ?'自然生命流失降低40%，寄生蛊更顽强。'
              :'寄生蛊每次攻击给宿主叠加1层毒，只能通过毒伤恢复生命。'
      }),
      {
        3:'顽强寄生：自然生命流失速度降低40%',
        6:'蛊毒加深：攻击伤害提高50%，每次攻击叠2层毒',
        9:'狂暴：低生命时短暂强化攻击与吸毒'
      }
    )
  }
};

export function configurePoisonSummonCoreSkills(){
  Object.entries(CONFIGS).forEach(([id,config])=>{
    SKILLS[id]={...config};
  });
}

export const ParasiticGuSkill={
  bind(system){
    const scene=system.scene;
    const guList=[];
    const visuals=new Set();
    let nextReviveAt=0;
    let lastAt=scene.getGameplayTime();

    const runtime={
      list:()=>guList.filter(gu=>!gu.dead),
      first:()=>guList.find(gu=>!gu.dead),
      forceHp:value=>{
        const gu=guList.find(item=>!item.dead);
        if(gu) gu.hp=value;
        return gu;
      }
    };
    scene.parasiticGuRuntime=runtime;

    const infected=()=>scene.targeting.all().filter(
      enemy=>scene.targeting.valid(enemy)
        &&scene.statusEffects.has(enemy,StatusEffects.POISON)
    );
    const occupied=target=>guList.some(
      gu=>!gu.dead&&gu.host===target
    );
    const choose=()=>infected()
      .filter(enemy=>!occupied(enemy))
      .sort(
        (left,right)=>scene.statusEffects.getStackCount(
          right,
          StatusEffects.POISON
        )-scene.statusEffects.getStackCount(
          left,
          StatusEffects.POISON
        )
      )[0]||null;
    const makeVisual=(x,y)=>{
      const circle=scene.add.circle(x,y,8,0x8ad66f,0.88)
        .setStrokeStyle(2,0xe4ffd0,0.9)
        .setDepth(152);
      visuals.add(circle);
      return circle;
    };
    const attach=(gu,target)=>{
      if(!gu||gu.dead) return;
      gu.host=target&&!occupied(target)?target:null;
      gu.freeUntil=scene.getGameplayTime()
        +POISON_SUMMON_TUNING.gu.transferMs;
    };
    const spawn=(seed={})=>{
      const data=system.getData('parasitic_gu');
      if(
        !data
        ||guList.filter(gu=>!gu.dead).length>=data.maxCount
      ){
        return null;
      }
      const gu={
        id:`gu_${scene.getGameplayTime()}_${guList.length}`,
        hp:data.hp,
        maxHp:data.hp,
        energy:seed.energy||0,
        host:null,
        freeUntil:0,
        nextLeechAt:scene.getGameplayTime()+350,
        berserkUntil:0,
        lowHpArmed:true,
        view:makeVisual(scene.player.x,scene.player.y-40),
        dead:false
      };
      guList.push(gu);
      attach(gu,choose());
      return gu;
    };
    const kill=gu=>{
      if(!gu||gu.dead) return;
      gu.dead=true;
      gu.host=null;
      gu.view?.destroy?.();
      visuals.delete(gu.view);
    };
    const split=(gu,data)=>{
      if(
        guList.filter(item=>!item.dead).length>=data.maxCount
        ||!choose()
      ){
        return false;
      }
      gu.energy-=data.splitEnergy;
      spawn({energy:0});
      return true;
    };
    const applyAttackPoison=(host,data)=>{
      if(!scene.targeting.valid(host)) return null;
      const poisonData=system.getData('poison_cloud')||{};
      return scene.statusEffects.add(StatusEffects.POISON,host,{
        durationMs:poisonData.poisonMs||4200,
        intervalMs:poisonData.poisonIntervalMs||700,
        value:poisonData.poisonDamage||6,
        stacks:data.poisonStacks||1,
        maxStacks:poisonData.maxStacks||15,
        sourceId:'parasitic_gu_attack',
        poisonMeta:{
          normal:true,
          sourceSkillId:'parasitic_gu'
        },
        damageMultiplier:1,
        baseDamageMultiplierWithoutProfession:1,
        professionMultiplier:1,
        professionApplied:true
      });
    };

    const offTick=scene.eventBus.on(CombatEvents.STATUS_TICK,payload=>{
      if(!isNormalPoisonTick(payload)) return;
      const data=system.getData('parasitic_gu');
      if(!data) return;
      guList
        .filter(
          gu=>!gu.dead&&gu.host===payload.target
        )
        .forEach(gu=>{
          const berserk=system.getLevel('parasitic_gu')>=9
            &&scene.getGameplayTime()<gu.berserkUntil;
          const multiplier=berserk
            ?POISON_SUMMON_TUNING.gu.berserkPoisonEnergyMultiplier
            :1;
          healEntity(
            gu,
            payload.actualDamage*data.poisonAbsorbRatio*multiplier,
            gu.maxHp
          );
          gu.energy+=payload.actualDamage
            *data.poisonEnergyRatio
            *multiplier;
          if(gu.energy>=data.splitEnergy) split(gu,data);
        });
    });
    const offKill=scene.eventBus.on(CombatEvents.ENEMY_KILLED,payload=>{
      guList
        .filter(gu=>gu.host===payload.enemy)
        .forEach(gu=>attach(gu,choose()));
    });

    const updater=()=>{
      const now=scene.getGameplayTime();
      const deltaSeconds=Math.max(0,now-lastAt)/1000;
      lastAt=now;
      const data=system.getData('parasitic_gu');
      if(!data){
        guList.forEach(kill);
        return;
      }
      if(!guList.some(gu=>!gu.dead)&&now>=nextReviveAt){
        spawn();
      }
      guList.forEach(gu=>{
        if(gu.dead) return;
        if(
          !gu.host
          ||!scene.targeting.valid(gu.host)
          ||!scene.statusEffects.has(gu.host,StatusEffects.POISON)
        ){
          attach(gu,choose());
        }
        gu.hp-=data.lifeLossPerSecond*deltaSeconds;
        if(gu.hp<=0){
          kill(gu);
          nextReviveAt=now+data.reviveMs;
          return;
        }
        if(gu.hp/gu.maxHp>0.55) gu.lowHpArmed=true;
        if(
          system.getLevel('parasitic_gu')>=9
          &&gu.lowHpArmed
          &&gu.hp/gu.maxHp<POISON_SUMMON_TUNING.gu.berserkHpRatio
          &&now>=gu.berserkUntil
        ){
          gu.berserkUntil=now+POISON_SUMMON_TUNING.gu.berserkMs;
          gu.lowHpArmed=false;
        }
        const berserk=system.getLevel('parasitic_gu')>=9
          &&now<gu.berserkUntil;
        if(gu.view){
          const target=gu.host||scene.player;
          gu.view.x+=(target.x-gu.view.x)*0.22;
          gu.view.y+=((target.y||scene.player.y)-70-gu.view.y)*0.22;
          gu.view.setFillStyle(berserk?0xff4b55:0x8ad66f,0.9);
          gu.view.setScale(berserk?1.25:1);
        }
        if(gu.host&&now>=gu.nextLeechAt){
          const interval=data.leechIntervalMs*(
            berserk
              ?POISON_SUMMON_TUNING.gu.berserkIntervalMultiplier
              :1
          );
          gu.nextLeechAt=now+interval;
          const damage=Math.round(
            (data.attackDamage??data.leechDamage)
              *(berserk
                ?POISON_SUMMON_TUNING.gu.berserkDamageMultiplier
                :1)
          );
          const host=gu.host;
          scene.combatSystem.damageEnemy(host,damage,{
            source:'skill',
            skillId:'parasitic_gu',
            damageKind:'guAttack',
            tags:[TAGS.POISON,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],
            allowLifeSteal:false,
            noKnockback:true,
            noPoisonChain:true
          });
          applyAttackPoison(host,data);
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
      visuals.forEach(view=>view.destroy?.());
      visuals.clear();
      if(scene.parasiticGuRuntime===runtime){
        scene.parasiticGuRuntime=null;
      }
    };
  }
};
