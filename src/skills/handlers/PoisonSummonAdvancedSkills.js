import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

export const POISON_ADVANCED_TUNING=Object.freeze({
  chain:{
    rebuildMs:1800,
    extendRadius:230,
    extendChance:0.38,
    extendChanceL3:0.62,
    checkMs:1200,
    checkMsL3:760,
    maxLinksPerNode:2,
    transferStacksOnDeathRatio:0.5
  },
  king:{
    reviveMs:4200,
    baseHp:180,
    biteIntervalMs:900,
    biteDamage:28,
    poisonDamage:8,
    poisonStacks:1,
    growthRatio:0.22,
    growthRatioL3:0.34,
    growthStage:45,
    maxStage:6,
    hpPerStage:35,
    damagePerStage:6,
    poisonPerStage:1,
    scalePerStage:0.08,
    stageHealL3:24,
    kingTargetOffsetX:34,
    kingTargetOffsetY:24,
    biteStacksL6:2,
    biteHealRatioL6:0.12,
    biteHealCapMaxHpRatio:0.015,
    domainRadius:135,
    domainIntervalMs:900,
    domainDamage:7
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
const dist=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));
const normalPoison=p=>
  p?.type===StatusEffects.POISON
  && p.actualDamage>0
  && !p.effect?.poisonMeta?.nonNormal
  && !p.effect?.noPoisonKingRecursive;

function addPoison(system,target,stacks,durationMs,value,sourceId,meta={}){
  const d=system.getData('poison_cloud')||{};
  return system.scene.statusEffects.add(StatusEffects.POISON,target,{
    durationMs,
    intervalMs:d.poisonIntervalMs||700,
    value:value||d.poisonDamage||6,
    stacks,
    maxStacks:Math.max(d.maxStacks||15,stacks),
    sourceId,
    damageMultiplier:1,
    baseDamageMultiplierWithoutProfession:1,
    professionMultiplier:1,
    professionApplied:true,
    poisonMeta:meta
  });
}

function healEntity(entity,amount,max){
  const before=entity.hp??0;
  entity.hp=Math.min(max??entity.maxHp??before,before+Math.max(0,amount));
  return entity.hp-before;
}

const CONFIGS={
  poison_chain:{
    id:'poison_chain',
    name:'毒链',
    rarity:'EPIC',
    handler:'poison_chain',
    passive:true,
    maxLevel:9,
    requiredSkillId:'parasitic_gu',
    tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],
    cooldownMs:999999,
    targetType:'passive',
    color:0x42e76d,
    short:'链',
    description:'投出毒链建立会自行扩张的感染网络，节点逐步连接附近中毒敌人。',
    levels:levels(
      [[0.38,1200],[0.42,1100],[0.62,760],[0.64,730],[0.66,700],[0.68,680],[0.7,650],[0.72,620],[0.74,600]],
      ([extendChance,checkMs],level)=>({
        extendChance,
        spreadChance:extendChance,
        checkMs,
        intervalMs:checkMs,
        extendRadius:POISON_ADVANCED_TUNING.chain.extendRadius,
        range:POISON_ADVANCED_TUNING.chain.extendRadius,
        maxLinksPerNode:POISON_ADVANCED_TUNING.chain.maxLinksPerNode,
        maxLinks:POISON_ADVANCED_TUNING.chain.maxLinksPerNode,
        rebuildMs:POISON_ADVANCED_TUNING.chain.rebuildMs,
        desc:level>=9
          ?'节点死亡时会把毒网续接到附近目标。'
          :level>=6
            ?'新施加毒层会向相邻节点传递1层，但不会递归。'
            :level>=3
              ?'毒链更容易且更频繁扩张。'
              :'选择一名中毒敌人作为初始节点并逐步扩张。'
      }),
      {
        3:'毒链蔓延：提高延伸概率并缩短判定间隔',
        6:'毒素传导：新毒层向相邻节点传递1层',
        9:'瘟疫不绝：节点死亡时立即续网'
      }
    )
  },
  poison_king:{
    id:'poison_king',
    name:'毒王',
    rarity:'EPIC',
    handler:'poison_king',
    passive:true,
    maxLevel:9,
    requiredSkillId:'poison_chain',
    targetType:'passive',
    tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],
    color:0x1f9d45,
    short:'王',
    description:'召唤一只常驻毒王，拥有独立血量，撕咬上毒并吸收全场正常毒伤成长。',
    levels:levels(
      [[180,28,0.22],[195,31,0.24],[210,34,0.34],[225,37,0.34],[240,40,0.34],[260,58,0.34],[280,63,0.36],[305,68,0.38],[330,74,0.4]],
      ([hp,biteDamage,growthRatio],level)=>({
        hp,
        biteDamage,
        growthRatio,
        biteIntervalMs:POISON_ADVANCED_TUNING.king.biteIntervalMs,
        poisonDamage:POISON_ADVANCED_TUNING.king.poisonDamage,
        poisonStacks:level>=6?2:1,
        growthStage:POISON_ADVANCED_TUNING.king.growthStage,
        maxStage:POISON_ADVANCED_TUNING.king.maxStage,
        reviveMs:POISON_ADVANCED_TUNING.king.reviveMs,
        desc:level>=9
          ?'毒王周围形成跟随移动的毒领域。'
          :level>=6
            ?'剧毒撕咬伤害提高，上毒层数增加并对中毒目标回血。'
            :level>=3
              ?'毒伤转化成长更快，阶段提升时额外回血。'
              :'常驻毒王撕咬敌人并施加中毒。'
      }),
      {
        3:'吸毒成长：成长效率提高，升阶额外恢复生命',
        6:'剧毒撕咬：撕咬更强、上毒更多并回血',
        9:'毒领域：周围敌人周期性受毒伤并被上毒'
      }
    )
  }
};

export function configurePoisonSummonAdvancedSkills(){
  Object.entries(CONFIGS).forEach(([id,cfg])=>{ SKILLS[id]={...cfg}; });
}

export const PoisonChainSkill={
  bind(system){
    const s=system.scene;
    const nodes=new Map();
    const edges=new Set();
    const visuals=new Map();
    const nodeIds=new WeakMap();
    let nextNodeId=1;
    let nextBuildAt=0;

    const nodeId=enemy=>{
      if(!nodeIds.has(enemy)) nodeIds.set(enemy,nextNodeId++);
      return nodeIds.get(enemy);
    };
    const edgeKey=(a,b)=>{
      const left=nodeId(a);
      const right=nodeId(b);
      return left<right?`${left}:${right}`:`${right}:${left}`;
    };
    const nodeTargets=()=>[...nodes.keys()].filter(
      enemy=>s.targeting.valid(enemy)
        && s.statusEffects.has(enemy,StatusEffects.POISON)
    );
    const addNode=enemy=>{
      if(!enemy||nodes.has(enemy)) return false;
      nodes.set(enemy,{
        nextAt:s.getGameplayTime()+200,
        links:new Set()
      });
      nodeId(enemy);
      return true;
    };
    const disconnect=(a,b)=>{
      const key=edgeKey(a,b);
      nodes.get(a)?.links.delete(b);
      nodes.get(b)?.links.delete(a);
      edges.delete(key);
      visuals.get(key)?.destroy?.();
      visuals.delete(key);
    };
    const removeNode=enemy=>{
      const node=nodes.get(enemy);
      if(!node) return false;
      [...node.links].forEach(other=>disconnect(enemy,other));
      nodes.delete(enemy);
      return true;
    };
    const connect=(a,b)=>{
      const left=nodes.get(a);
      const right=nodes.get(b);
      const max=system.getData('poison_chain')?.maxLinksPerNode
        || POISON_ADVANCED_TUNING.chain.maxLinksPerNode;
      if(
        !left
        || !right
        || left.links.size>=max
        || right.links.size>=max
        || left.links.has(b)
      ){
        return false;
      }
      left.links.add(b);
      right.links.add(a);
      const key=edgeKey(a,b);
      edges.add(key);
      if(!visuals.has(key)){
        visuals.set(key,s.add.graphics().setDepth(145));
      }
      return true;
    };
    const chooseSeed=()=>s.targeting.all().find(
      enemy=>s.targeting.valid(enemy)
        && s.statusEffects.has(enemy,StatusEffects.POISON)
    )||null;
    const extend=(enemy,data)=>{
      const node=nodes.get(enemy);
      if(
        !node
        || node.links.size>=data.maxLinksPerNode
        || Math.random()>data.extendChance
      ){
        return false;
      }
      const candidate=s.targeting.all()
        .filter(
          target=>target!==enemy
            && !nodes.has(target)
            && s.targeting.valid(target)
            && s.statusEffects.has(target,StatusEffects.POISON)
            && dist(target,enemy)<=data.extendRadius
        )
        .sort((a,b)=>dist(a,enemy)-dist(b,enemy))[0];
      if(!candidate||!addNode(candidate)) return false;
      return connect(enemy,candidate);
    };
    const transferOne=payload=>{
      const meta=payload.effect?.poisonMeta||{};
      if(
        payload.type!==StatusEffects.POISON
        || !nodes.has(payload.target)
        || meta.chainTransfer
        || meta.chainDeathRelay
      ){
        return false;
      }
      if(payload.delta!==undefined&&payload.delta<=0) return false;
      if(system.getLevel('poison_chain')<6) return false;
      const adjacent=[...nodes.get(payload.target).links].find(
        target=>s.targeting.valid(target)
          && s.statusEffects.has(target,StatusEffects.POISON)
      );
      if(!adjacent) return false;
      addPoison(
        system,
        adjacent,
        1,
        2600,
        system.getData('poison_cloud')?.poisonDamage||6,
        'poison_chain_transfer',
        {chainTransfer:true}
      );
      return true;
    };

    const runtime={
      nodeCount:()=>nodes.size,
      edgeCount:()=>edges.size,
      hasNode:enemy=>nodes.has(enemy),
      edgeKey,
      hasEdge:(a,b)=>edges.has(edgeKey(a,b)),
      addNode,
      connect,
      removeNode,
      visualFor:(a,b)=>visuals.get(edgeKey(a,b)),
      clear:()=>{
        visuals.forEach(view=>view.destroy?.());
        visuals.clear();
        nodes.clear();
        edges.clear();
      }
    };
    s.poisonChainRuntime=runtime;

    const offApply=s.eventBus.on(CombatEvents.STATUS_APPLIED,transferOne);
    const offStack=s.eventBus.on(CombatEvents.STATUS_STACK_CHANGED,transferOne);
    const offKill=s.eventBus.on(CombatEvents.ENEMY_KILLED,payload=>{
      if(!nodes.has(payload.enemy)) return;
      const old=payload.enemy;
      const oldLinks=[...nodes.get(old).links].filter(
        enemy=>s.targeting.valid(enemy)
      );
      const stacks=payload.poisonStacksBeforeDeath
        || s.statusEffects.getStackCount(old,StatusEffects.POISON);
      removeNode(old);
      if(system.getLevel('poison_chain')<9) return;

      const nearby=s.targeting.all()
        .filter(
          enemy=>enemy!==old
            && s.targeting.valid(enemy)
            && !nodes.has(enemy)
        )
        .sort((a,b)=>dist(a,old)-dist(b,old));
      const poisoned=nearby.find(
        enemy=>s.statusEffects.has(enemy,StatusEffects.POISON)
      );
      const target=poisoned||nearby[0];
      if(!target) return;

      addPoison(
        system,
        target,
        poisoned
          ?Math.max(
            1,
            Math.floor(
              stacks*POISON_ADVANCED_TUNING.chain.transferStacksOnDeathRatio
            )
          )
          :1,
        2600,
        system.getData('poison_cloud')?.poisonDamage||6,
        'poison_chain_death_relay',
        {chainDeathRelay:true}
      );
      if(!addNode(target)) return;
      const anchor=oldLinks.find(
        enemy=>nodes.has(enemy)
          && nodes.get(enemy).links.size
            <(system.getData('poison_chain')?.maxLinksPerNode||2)
      )||[...nodes.keys()]
        .filter(enemy=>enemy!==target)
        .sort((a,b)=>dist(a,target)-dist(b,target))[0];
      if(anchor) connect(target,anchor);
    });

    const updater=()=>{
      const now=s.getGameplayTime();
      const data=system.getData('poison_chain');
      if(!data){
        runtime.clear();
        return;
      }
      nodeTargets().forEach(enemy=>{
        const node=nodes.get(enemy);
        if(now>=node.nextAt){
          node.nextAt=now+data.checkMs;
          extend(enemy,data);
        }
      });
      [...nodes.keys()].forEach(enemy=>{
        if(
          !s.targeting.valid(enemy)
          || !s.statusEffects.has(enemy,StatusEffects.POISON)
        ){
          removeNode(enemy);
        }
      });
      if(!nodes.size&&now>=nextBuildAt){
        nextBuildAt=now+data.rebuildMs;
        const seed=chooseSeed();
        if(seed) addNode(seed);
      }
      visuals.forEach(view=>view.clear());
      nodes.forEach((node,left)=>{
        node.links.forEach(right=>{
          if(nodeId(left)>nodeId(right)) return;
          const view=visuals.get(edgeKey(left,right));
          if(view){
            view.lineStyle(4,0x66ff88,0.8)
              .lineBetween(left.x,left.y-46,right.x,right.y-46);
          }
        });
      });
    };

    system.passiveUpdaters.push(updater);
    updater();
    return ()=>{
      offApply();
      offStack();
      offKill();
      removeUpdater(system,updater);
      runtime.clear();
      if(s.poisonChainRuntime===runtime) s.poisonChainRuntime=null;
    };
  }
};

export const PoisonKingSkill={
  bind(system){
    const s=system.scene;
    let king=null;
    let nextRespawnAt=0;

    const destroyHpBar=target=>{
      const bar=target?.hpBar;
      if(!bar) return;
      bar.bg?.destroy?.();
      bar.fill?.destroy?.();
      bar.container?.destroy?.();
      target.hpBar=null;
    };
    const updateHpBar=target=>{
      const bar=target?.hpBar;
      if(!target||!bar) return;
      if(target.dead||target.hp<=0){
        bar.container?.setVisible?.(false);
        return;
      }
      const ratio=Math.max(0,Math.min(1,target.hp/Math.max(1,target.maxHp||1)));
      bar.container?.setVisible?.(true);
      bar.container.x=target.view.x;
      bar.container.y=target.view.y-31;
      bar.fill?.setDisplaySize?.(bar.width*ratio,bar.height);
      bar.fill?.setPosition?.(-bar.width/2,0);
    };
    const createHpBar=target=>{
      destroyHpBar(target);
      const width=46;
      const height=6;
      const container=s.add.container(target.view.x,target.view.y-31).setDepth(149);
      const makeRect=(x,y,w,h,color,alpha)=>{
        const rect=s.add.rectangle?.(x,y,w,h,color,alpha)
          ||s.add.ellipse?.(x,y,w,h,color,alpha);
        rect?.setDisplaySize?.(w,h);
        rect.displayWidth=w;
        rect.displayHeight=h;
        return rect;
      };
      const bg=makeRect(0,0,width,height,0x07140b,0.62);
      bg?.setOrigin?.(0.5,0.5);
      const fill=makeRect(-width/2,0,width,height,0x42e76d,0.95);
      fill?.setOrigin?.(0,0.5);
      container.add([bg,fill]);
      target.hpBar={container,bg,fill,width,height};
      updateHpBar(target);
    };

    const die=target=>{
      const current=target||king;
      if(!current||king!==current) return false;
      current.dead=true;
      destroyHpBar(current);
      current.view?.destroy?.();
      current.domain?.destroy?.();
      king=null;
      nextRespawnAt=s.getGameplayTime()
        +((system.getData('poison_king')||{}).reviveMs||4200);
      return true;
    };
    const runtime={
      get:()=>king,
      getAttackTarget:()=>{
        const current=king;
        if(!current||current.dead||current.hp<=0) return null;
        return {
          type:'poison_king',
          get x(){ return current.view?.x??0; },
          get y(){ return current.view?.y??0; },
          get hp(){ return current.hp; },
          isAlive:()=>king===current&&!current.dead&&current.hp>0,
          takeDamage:amount=>{
            if(king!==current||current.dead||current.hp<=0) return 0;
            const before=current.hp;
            current.hp=Math.max(
              0,
              current.hp-Math.max(0,Math.round(amount)||0)
            );
            const actual=before-current.hp;
            updateHpBar(current);
            if(current.hp<=0) die(current);
            return actual;
          }
        };
      },
      forceDamage:amount=>{
        const current=king;
        if(!current||current.dead) return 0;
        const before=current.hp;
        current.hp=Math.max(0,current.hp-Math.max(0,amount||0));
        const actual=before-current.hp;
        updateHpBar(current);
        if(current.hp<=0) die(current);
        return actual;
      }
    };
    s.poisonKingRuntime=runtime;

    const spawn=()=>{
      const data=system.getData('poison_king');
      if(!data||king) return null;
      const view=s.add.container(s.player.x+90,s.player.y-55).setDepth(147);
      const body=s.add.ellipse(0,0,58,38,0x1f9d45,0.95)
        .setStrokeStyle(4,0xb7ff82,0.8);
      const eye=s.add.circle(17,-5,4,0xf2ffd2,1);
      view.add([body,eye]);
      king={
        view,
        hp:data.hp,
        maxHp:data.hp,
        growth:0,
        stage:0,
        target:null,
        nextBiteAt:s.getGameplayTime()+500,
        nextDomainAt:s.getGameplayTime()+700,
        domain:null,
        dead:false,
        hpBar:null
      };
      createHpBar(king);
      return king;
    };
    const grow=amount=>{
      const data=system.getData('poison_king');
      if(!king||!data||king.stage>=data.maxStage) return;
      king.growth+=amount*data.growthRatio;
      while(king.growth>=data.growthStage&&king.stage<data.maxStage){
        king.growth-=data.growthStage;
        king.stage+=1;
        king.maxHp+=POISON_ADVANCED_TUNING.king.hpPerStage;
        king.hp=Math.min(
          king.maxHp,
          king.hp
            +POISON_ADVANCED_TUNING.king.hpPerStage
            +(system.getLevel('poison_king')>=3
              ?POISON_ADVANCED_TUNING.king.stageHealL3
              :0)
        );
        king.view.setScale(
          1+king.stage*POISON_ADVANCED_TUNING.king.scalePerStage
        );
        updateHpBar(king);
      }
    };
    const offTick=s.eventBus.on(CombatEvents.STATUS_TICK,payload=>{
      if(normalPoison(payload)) grow(payload.actualDamage);
    });
    const choose=()=>s.targeting.all()
      .filter(enemy=>s.targeting.valid(enemy))
      .sort((a,b)=>dist(a,king.view)-dist(b,king.view))[0]||null;
    const bite=(target,data)=>{
      const level=system.getLevel('poison_king');
      const poisoned=s.statusEffects.has(target,StatusEffects.POISON);
      const damage=Math.round(
        data.biteDamage
          +king.stage*POISON_ADVANCED_TUNING.king.damagePerStage
      );
      const before=target.hp||0;
      s.combatSystem.damageEnemy(target,damage,{
        source:'skill',
        skillId:'poison_king',
        damageKind:'poisonKingBite',
        tags:[TAGS.POISON,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],
        allowLifeSteal:false,
        noKnockback:true,
        noPoisonChain:true
      });
      const actual=Math.max(0,before-(target.hp||0));
      if(s.targeting.valid(target)){
        addPoison(
          system,
          target,
          data.poisonStacks,
          3600,
          data.poisonDamage
            +king.stage*POISON_ADVANCED_TUNING.king.poisonPerStage,
          'poison_king_bite',
          {poisonKingApplied:true}
        );
      }
      if(level>=6&&poisoned){
        healEntity(
          king,
          Math.min(
            actual*POISON_ADVANCED_TUNING.king.biteHealRatioL6,
            king.maxHp
              *POISON_ADVANCED_TUNING.king.biteHealCapMaxHpRatio
          ),
          king.maxHp
        );
      }
    };
    const domain=data=>{
      if(system.getLevel('poison_king')<9) return;
      if(!king.domain){
        king.domain=s.add.circle(
          king.view.x,
          king.view.y,
          POISON_ADVANCED_TUNING.king.domainRadius,
          0x40e060,
          0.08
        ).setStrokeStyle(3,0x7dff73,0.55).setDepth(143);
      }
      king.domain.x=king.view.x;
      king.domain.y=king.view.y;
      s.targeting.all()
        .filter(
          enemy=>s.targeting.valid(enemy)
            && dist(enemy,king.view)
              <=POISON_ADVANCED_TUNING.king.domainRadius
        )
        .forEach(enemy=>{
          s.combatSystem.damageEnemy(
            enemy,
            POISON_ADVANCED_TUNING.king.domainDamage,
            {
              source:'skill',
              skillId:'poison_king',
              damageKind:'poisonKingDomain',
              tags:[
                TAGS.POISON,
                TAGS.DOT,
                TAGS.SUMMON,
                TAGS.BUILD_POISON_SUMMON
              ],
              allowLifeSteal:false,
              noKnockback:true,
              noPoisonChain:true
            }
          );
          if(s.targeting.valid(enemy)){
            addPoison(
              system,
              enemy,
              1,
              2800,
              data.poisonDamage,
              'poison_king_domain',
              {poisonDomain:true}
            );
          }
        });
    };
    const updater=()=>{
      const now=s.getGameplayTime();
      const data=system.getData('poison_king');
      if(!data){
        die();
        return;
      }
      if(!king&&now>=nextRespawnAt) spawn();
      if(!king) return;
      if(king.hp<=0){
        die(king);
        return;
      }
      const target=choose();
      king.target=target;
      const goal=target
        ?{
          x:target.x-POISON_ADVANCED_TUNING.king.kingTargetOffsetX,
          y:target.y-POISON_ADVANCED_TUNING.king.kingTargetOffsetY
        }
        :{
          x:s.player.x+95,
          y:s.player.y-55
        };
      king.view.x+=(goal.x-king.view.x)*0.1;
      king.view.y+=(goal.y-king.view.y)*0.1;
      if(target&&now>=king.nextBiteAt){
        king.nextBiteAt=now+data.biteIntervalMs;
        bite(target,data);
      }
      if(now>=king.nextDomainAt){
        king.nextDomainAt=now+POISON_ADVANCED_TUNING.king.domainIntervalMs;
        domain(data);
      }
      if(king.domain){
        king.domain.x=king.view.x;
        king.domain.y=king.view.y;
      }
      updateHpBar(king);
    };

    system.passiveUpdaters.push(updater);
    updater();
    return ()=>{
      offTick();
      removeUpdater(system,updater);
      die();
      if(s.poisonKingRuntime===runtime) s.poisonKingRuntime=null;
    };
  },
  cleanup(){}
};
