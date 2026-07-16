import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';
import { ParasiticGuSkill } from './PoisonSummonCoreSkills.js';
import { POISON_ADVANCED_TUNING } from './PoisonSummonAdvancedSkills.js';

const CHAIN_DAMAGE=[34,40,48,56,66,78,90,104,120];
const CHAIN_COOLDOWNS=[5200,5000,4700,4500,4300,4000,3800,3600,3400];
const CHAIN_PRISON_MS=2000;
const CHAIN_CAST_RANGE=760;

const removeUpdater=(system,updater)=>{
  const index=system.passiveUpdaters.indexOf(updater);
  if(index>=0) system.passiveUpdaters.splice(index,1);
};

const dist=(a,b)=>Math.hypot(
  (a?.x||0)-(b?.x||0),
  (a?.y||0)-(b?.y||0)
);

function addPoison(system,target,stacks,durationMs,value,sourceId,meta={},ctx=null){
  const poison=system.getData('poison_cloud')||{};
  return system.scene.statusEffects.add(StatusEffects.POISON,target,{
    durationMs,
    intervalMs:poison.poisonIntervalMs||700,
    value:value||poison.poisonDamage||6,
    stacks,
    maxStacks:Math.max(poison.maxStacks||15,stacks),
    sourceId,
    damageMultiplier:ctx?.damageMultiplier||1,
    baseDamageMultiplierWithoutProfession:ctx?.baseDamageMultiplierWithoutProfession||1,
    professionMultiplier:ctx?.professionMultiplier||1,
    professionApplied:true,
    poisonMeta:meta
  });
}

export function configurePoisonChainActiveSkill(){
  const base=SKILLS.poison_chain;
  if(!base) return;
  SKILLS.poison_chain={
    ...base,
    passive:false,
    targetType:'nearestAhead',
    cooldownMs:CHAIN_COOLDOWNS[0],
    tags:[...new Set([
      ...(base.tags||[]),
      TAGS.ACTIVE_SKILL,
      TAGS.PROJECTILE
    ])],
    description:'自动向前方敌人投出毒链，命中造成毒系伤害并施加1层中毒。普通和精英敌人被禁锢2秒；Boss免疫禁锢，但仍会受到伤害、上毒并成为毒网节点。',
    levels:base.levels.map((level,index)=>({
      ...level,
      damage:CHAIN_DAMAGE[index],
      cooldownMs:CHAIN_COOLDOWNS[index],
      prisonMs:CHAIN_PRISON_MS,
      castRange:CHAIN_CAST_RANGE,
      desc:index>=8
        ?'投出毒链造成毒系伤害并施加1层中毒；普通或精英被完全禁锢2秒，节点死亡时毒网自动续接。Boss免疫禁锢但仍会成为毒网节点。'
        :index>=5
          ?'投出毒链造成毒系伤害并施加1层中毒；普通或精英禁锢2秒，新施加毒层会向相邻节点传递1层。Boss免疫禁锢但仍会成为毒网节点。'
          :index>=2
            ?'投出毒链造成毒系伤害并施加1层中毒；普通或精英禁锢2秒，毒网更容易且更频繁扩张。Boss免疫禁锢但仍会成为毒网节点。'
            :'投出毒链造成毒系伤害并施加1层中毒；普通或精英禁锢2秒，再从该目标向附近中毒敌人扩张。Boss免疫禁锢但仍会成为毒网节点。'
    }))
  };
}

export const ParasiticGuHostVisualSkill={
  bind(system){
    const cleanup=ParasiticGuSkill.bind(system);
    const updater=()=>{
      system.scene.parasiticGuRuntime?.list?.().forEach(gu=>{
        gu.view?.setVisible?.(!!gu.host);
      });
    };
    system.passiveUpdaters.push(updater);
    updater();
    return ()=>{
      removeUpdater(system,updater);
      cleanup?.();
    };
  }
};

export const PoisonChainActiveSkill={
  bind(system){
    const scene=system.scene;
    const nodes=new Map();
    const edges=new Set();
    const visuals=new Map();
    const prisons=new Map();
    const nodeIds=new WeakMap();
    let nextNodeId=1;

    const nodeId=enemy=>{
      if(!nodeIds.has(enemy)) nodeIds.set(enemy,nextNodeId++);
      return nodeIds.get(enemy);
    };

    const edgeKey=(left,right)=>{
      const a=nodeId(left);
      const b=nodeId(right);
      return a<b?`${a}:${b}`:`${b}:${a}`;
    };

    const removePrison=enemy=>{
      const state=prisons.get(enemy);
      if(!state) return false;
      state.views.forEach(view=>view?.destroy?.());
      prisons.delete(enemy);
      if(enemy){
        enemy.poisonChainPrisonUntil=0;
        if(!enemy.knockbackTween) enemy.isKnockbackActive=false;
        enemy.body?.setVelocityX?.(0);
      }
      return true;
    };

    const createPrisonViews=enemy=>{
      const width=Math.max(56,(enemy.width||52)+22);
      const upper=scene.add.ellipse(
        enemy.x,
        enemy.y-(enemy.height||80)*0.62,
        width,
        20,
        0x2fe36a,
        0.12
      ).setStrokeStyle(4,0x8affaa,0.96).setDepth(148);
      const lower=scene.add.ellipse(
        enemy.x,
        enemy.y-(enemy.height||80)*0.30,
        width+8,
        22,
        0x1ebd55,
        0.10
      ).setStrokeStyle(4,0x42e76d,0.92).setDepth(148);
      return [upper,lower];
    };

    const applyPrison=(enemy,durationMs)=>{
      if(!enemy||enemy.isBoss||!scene.targeting.valid(enemy)) return false;
      const now=scene.getGameplayTime();
      const existing=prisons.get(enemy);
      const until=Math.max(
        existing?.until||0,
        now+Math.max(1,durationMs||CHAIN_PRISON_MS)
      );
      scene.combatSystem?.clearKnockback?.(enemy);
      enemy.poisonChainPrisonUntil=until;
      enemy.isKnockbackActive=true;
      enemy.nextAttackAt=Math.max(enemy.nextAttackAt||0,until);
      enemy.body?.setVelocityX?.(0);
      if(existing){
        existing.until=until;
      }else{
        prisons.set(enemy,{until,views:createPrisonViews(enemy)});
        scene.floatText?.(enemy.x,enemy.y-118,'禁锢','#78ff9b');
      }
      return true;
    };

    const updatePrisons=now=>{
      prisons.forEach((state,enemy)=>{
        if(!scene.targeting.valid(enemy)||now>=state.until){
          removePrison(enemy);
          return;
        }
        scene.combatSystem?.clearKnockback?.(enemy);
        enemy.poisonChainPrisonUntil=state.until;
        enemy.isKnockbackActive=true;
        enemy.nextAttackAt=Math.max(enemy.nextAttackAt||0,state.until);
        enemy.body?.setVelocityX?.(0);
        const upperY=enemy.y-(enemy.height||80)*0.62;
        const lowerY=enemy.y-(enemy.height||80)*0.30;
        state.views[0]?.setPosition?.(enemy.x,upperY);
        state.views[1]?.setPosition?.(enemy.x,lowerY);
      });
    };

    const nodeTargets=()=>[...nodes.keys()].filter(
      enemy=>scene.targeting.valid(enemy)
        &&scene.statusEffects.has(enemy,StatusEffects.POISON)
    );

    const addNode=enemy=>{
      if(!enemy||nodes.has(enemy)) return false;
      nodes.set(enemy,{
        nextAt:scene.getGameplayTime()+200,
        links:new Set()
      });
      nodeId(enemy);
      return true;
    };

    const disconnect=(left,right)=>{
      const key=edgeKey(left,right);
      nodes.get(left)?.links.delete(right);
      nodes.get(right)?.links.delete(left);
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

    const connect=(leftEnemy,rightEnemy)=>{
      const left=nodes.get(leftEnemy);
      const right=nodes.get(rightEnemy);
      const max=system.getData('poison_chain')?.maxLinksPerNode
        ||POISON_ADVANCED_TUNING.chain.maxLinksPerNode;
      if(
        !left
        ||!right
        ||left.links.size>=max
        ||right.links.size>=max
        ||left.links.has(rightEnemy)
      ){
        return false;
      }
      left.links.add(rightEnemy);
      right.links.add(leftEnemy);
      const key=edgeKey(leftEnemy,rightEnemy);
      edges.add(key);
      if(!visuals.has(key)){
        visuals.set(key,scene.add.graphics().setDepth(145));
      }
      return true;
    };

    const castTargets=()=>scene.targeting.all()
      .filter(enemy=>
        scene.targeting.valid(enemy)
        &&enemy.x>=scene.player.x-20
        &&enemy.x-scene.player.x<=CHAIN_CAST_RANGE
      )
      .sort((left,right)=>{
        const leftNode=nodes.has(left)?1:0;
        const rightNode=nodes.has(right)?1:0;
        return leftNode-rightNode||dist(scene.player,left)-dist(scene.player,right);
      });

    const chooseCastTarget=()=>castTargets()[0]||null;

    const extend=(enemy,data)=>{
      const node=nodes.get(enemy);
      if(
        !node
        ||node.links.size>=data.maxLinksPerNode
        ||Math.random()>data.extendChance
      ){
        return false;
      }
      const candidate=scene.targeting.all()
        .filter(target=>
          target!==enemy
          &&!nodes.has(target)
          &&scene.targeting.valid(target)
          &&scene.statusEffects.has(target,StatusEffects.POISON)
          &&dist(target,enemy)<=data.extendRadius
        )
        .sort((a,b)=>dist(a,enemy)-dist(b,enemy))[0];
      if(!candidate||!addNode(candidate)) return false;
      if(connect(enemy,candidate)) return true;
      removeNode(candidate);
      return false;
    };

    const transferOne=payload=>{
      const meta=payload.effect?.poisonMeta||{};
      if(
        payload.type!==StatusEffects.POISON
        ||!nodes.has(payload.target)
        ||meta.chainTransfer
        ||meta.chainDeathRelay
      ){
        return false;
      }
      if(payload.delta!==undefined&&payload.delta<=0) return false;
      if(system.getLevel('poison_chain')<6) return false;
      const adjacent=[...nodes.get(payload.target).links].find(
        target=>scene.targeting.valid(target)
          &&scene.statusEffects.has(target,StatusEffects.POISON)
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

    const castAt=(target,data,cfg,level,ctx)=>{
      if(!target||!scene.targeting.valid(target)) return {failed:true};
      const startX=scene.player.x+18;
      const startY=scene.player.y-58;
      const endX=target.x;
      const endY=target.y-44;
      system.line?.(startX,startY,endX,endY,0x42e76d);
      system.projectile?.(startX,startY,endX,endY,0x78ff9b,180);
      const damage=system.damageValue?.(data.damage,ctx)??data.damage;
      const baseDamage=system.baseDamageValue?.(data.damage,ctx)??data.damage;
      if(system.hit){
        system.hit(target,damage,cfg,level,ctx,baseDamage,[TAGS.POISON]);
      }else{
        scene.combatSystem?.damageEnemy?.(target,damage,{
          source:'skill',
          skillId:'poison_chain',
          tags:cfg.tags,
          level,
          professionApplied:true,
          professionMultiplier:ctx?.professionMultiplier||1,
          baseAmountBeforeProfession:baseDamage,
          noKnockback:true
        });
      }
      ctx.originalTarget=target;
      ctx.originalTargets=[target];
      if(!scene.targeting.valid(target)) return {target,targets:[target]};

      addPoison(
        system,
        target,
        1,
        3200,
        system.getData('poison_cloud')?.poisonDamage||6,
        `poison_chain_hit_${ctx.castId}`,
        {poisonChainApplied:true,sourceSkillId:'poison_chain'},
        ctx
      );
      if(!scene.targeting.valid(target)) return {target,targets:[target]};

      const oldNodes=nodeTargets().filter(enemy=>enemy!==target);
      const added=addNode(target);
      if(added){
        const anchor=oldNodes
          .filter(enemy=>dist(enemy,target)<=data.extendRadius)
          .sort((a,b)=>dist(a,target)-dist(b,target))[0];
        if(anchor) connect(target,anchor);
      }

      if(target.isBoss){
        scene.floatText?.(target.x,target.y-118,'禁锢免疫','#cbd5e1');
      }else{
        applyPrison(target,data.prisonMs||CHAIN_PRISON_MS);
      }
      return {target,targets:[target]};
    };

    const runtime={
      nodeCount:()=>nodes.size,
      edgeCount:()=>edges.size,
      hasNode:enemy=>nodes.has(enemy),
      edgeKey,
      hasEdge:(left,right)=>edges.has(edgeKey(left,right)),
      addNode,
      connect,
      removeNode,
      visualFor:(left,right)=>visuals.get(edgeKey(left,right)),
      chooseCastTarget,
      castAt,
      isPrisoned:enemy=>prisons.has(enemy),
      clear:()=>{
        visuals.forEach(view=>view.destroy?.());
        visuals.clear();
        [...prisons.keys()].forEach(removePrison);
        nodes.clear();
        edges.clear();
      }
    };
    scene.poisonChainRuntime=runtime;

    const offApply=scene.eventBus.on(CombatEvents.STATUS_APPLIED,transferOne);
    const offStack=scene.eventBus.on(CombatEvents.STATUS_STACK_CHANGED,transferOne);
    const offKill=scene.eventBus.on(CombatEvents.ENEMY_KILLED,payload=>{
      removePrison(payload.enemy);
      if(!nodes.has(payload.enemy)) return;
      const old=payload.enemy;
      const oldLinks=[...nodes.get(old).links].filter(
        enemy=>scene.targeting.valid(enemy)
      );
      const stacks=payload.poisonStacksBeforeDeath
        ||scene.statusEffects.getStackCount(old,StatusEffects.POISON);
      removeNode(old);
      if(system.getLevel('poison_chain')<9) return;

      const nearby=scene.targeting.all()
        .filter(enemy=>
          enemy!==old
          &&scene.targeting.valid(enemy)
          &&!nodes.has(enemy)
        )
        .sort((a,b)=>dist(a,old)-dist(b,old));
      const poisoned=nearby.find(
        enemy=>scene.statusEffects.has(enemy,StatusEffects.POISON)
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
      const anchor=oldLinks.find(enemy=>
        nodes.has(enemy)
        &&nodes.get(enemy).links.size
          <(system.getData('poison_chain')?.maxLinksPerNode||2)
      )||[...nodes.keys()]
        .filter(enemy=>enemy!==target)
        .sort((a,b)=>dist(a,target)-dist(b,target))[0];
      if(anchor) connect(target,anchor);
    });

    const updater=()=>{
      const now=scene.getGameplayTime();
      const data=system.getData('poison_chain');
      if(!data){
        runtime.clear();
        return;
      }
      updatePrisons(now);
      nodeTargets().forEach(enemy=>{
        const node=nodes.get(enemy);
        if(now>=node.nextAt){
          node.nextAt=now+data.checkMs;
          extend(enemy,data);
        }
      });
      [...nodes.keys()].forEach(enemy=>{
        if(
          !scene.targeting.valid(enemy)
          ||!scene.statusEffects.has(enemy,StatusEffects.POISON)
        ){
          removeNode(enemy);
        }
      });
      visuals.forEach(view=>view.clear());
      nodes.forEach((node,left)=>{
        node.links.forEach(right=>{
          if(nodeId(left)>nodeId(right)) return;
          visuals.get(edgeKey(left,right))
            ?.lineStyle(4,0x66ff88,0.8)
            .lineBetween(left.x,left.y-46,right.x,right.y-46);
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
      if(scene.poisonChainRuntime===runtime){
        scene.poisonChainRuntime=null;
      }
    };
  },

  canCast(system){
    return !!system.scene.poisonChainRuntime?.chooseCastTarget?.();
  },

  cast(system,cfg,data,level,ctx){
    const runtime=system.scene.poisonChainRuntime;
    const target=runtime?.chooseCastTarget?.();
    if(!runtime||!target) return {failed:true};
    return runtime.castAt(target,data,cfg,level,ctx);
  }
};
