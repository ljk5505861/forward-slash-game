import assert from 'node:assert/strict';
import { SKILLS } from '../src/config/skills.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { configureEntryArchetypeSkills } from '../src/skills/handlers/EntryArchetypeSkills.js';
import {
  configurePoisonSummonAdvancedSkills,
  PoisonChainSkill,
  PoisonKingSkill
} from '../src/skills/handlers/PoisonSummonAdvancedSkills.js';

configureEntryArchetypeSkills();
configurePoisonSummonAdvancedSkills();

class Bus {
  constructor(){ this.handlers=new Map(); }
  on(event,fn){
    const list=this.handlers.get(event)||[];
    list.push(fn);
    this.handlers.set(event,list);
    return ()=>this.handlers.set(
      event,
      (this.handlers.get(event)||[]).filter(item=>item!==fn)
    );
  }
  emit(event,payload){
    [...(this.handlers.get(event)||[])].forEach(fn=>fn(payload));
  }
}

const visual=(x=0,y=0)=>({
  x,
  y,
  active:true,
  destroyed:false,
  setStrokeStyle(){ return this; },
  setDepth(){ return this; },
  setFillStyle(){ return this; },
  setScale(){ return this; },
  clear(){ return this; },
  lineStyle(){ return this; },
  lineBetween(){ return this; },
  add(){ return this; },
  destroy(){ this.active=false; this.destroyed=true; }
});

function makeScene(){
  const bus=new Bus();
  const scene={
    now:0,
    player:{x:0,y:100},
    playerData:{
      hp:100,
      maxHp:100,
      critChance:0,
      critMultiplier:1.5,
      dodgeChance:0,
      defense:0,
      damageReduction:0,
      temporaryDamageReduction:0,
      attackDamageBonuses:{},
      normalAttackDamageBonuses:{},
      heavyHitDamageBonuses:{},
      attackSpeedMultiplierBonuses:{},
      lifeStealBonuses:{},
      heavyHitLifeStealBonuses:{},
      defenseBonuses:{},
      damageReductionBonuses:{},
      healingReceivedMultiplierBonuses:{},
      moveSpeedMultiplierBonuses:{},
      dodgeChanceBonuses:{},
      afterimageDamageBonuses:{}
    },
    enemies:[],
    eventBus:bus,
    getGameplayTime(){ return this.now; },
    isGameplayPaused(){ return false; },
    targeting:{
      all(){
        return scene.enemies.filter(
          enemy=>enemy.active!==false
            && !enemy.isDefeated
            && enemy.hp>0
        );
      },
      valid(enemy){
        return !!enemy
          && enemy.active!==false
          && !enemy.isDefeated
          && enemy.hp>0;
      },
      isEnemyFullyInsideViewport(){ return true; }
    },
    add:{
      circle:(x,y)=>visual(x,y),
      ellipse:(x,y)=>visual(x,y),
      container:(x,y)=>visual(x,y),
      graphics:()=>visual()
    },
    floatText(){},
    hud:{update(){},setStatus(){}},
    playerHealthBar:{update(){}},
    balance:{stageWorldWidth:1000,enemyFadeMs:10},
    tweens:{add(){}},
    professionSystem:{getDamageMultiplier(){ return 1; }},
    artifactSystem:{highHpDamageMultiplier(){ return 1; }},
    finishRun(){},
    awardGold(){}
  };
  scene.statusEffects={
    effects:[],
    has(target,type){
      return this.effects.some(
        effect=>effect.target===target&&effect.type===type
      );
    },
    getStackCount(target,type){
      return this.effects
        .filter(effect=>effect.target===target&&effect.type===type)
        .reduce((sum,effect)=>sum+(effect.stacks||1),0);
    },
    add(type,target,options={}){
      const old=this.effects.find(
        effect=>effect.type===type
          && effect.target===target
          && effect.sourceId===(options.sourceId||'')
      );
      if(old){
        const previous=old.stacks||1;
        old.stacks=Math.min(
          options.maxStacks||999,
          previous+(options.stacks||1)
        );
        Object.assign(old,options,{type,target});
        old.stacks=Math.min(
          options.maxStacks||999,
          previous+(options.stacks||1)
        );
        bus.emit(CombatEvents.STATUS_STACK_CHANGED,{
          type,
          target,
          effect:old,
          delta:old.stacks-previous
        });
        return old;
      }
      const effect={
        id:this.effects.length+1,
        type,
        target,
        sourceId:options.sourceId||'',
        ...options,
        stacks:options.stacks||1
      };
      this.effects.push(effect);
      bus.emit(CombatEvents.STATUS_APPLIED,{
        type,
        target,
        effect,
        stacks:effect.stacks
      });
      return effect;
    },
    getEffects(target,type){
      return this.effects.filter(
        effect=>effect.target===target&&effect.type===type
      );
    },
    absorbShield(damage){
      return {absorbed:0,remainingDamage:damage};
    },
    clearTarget(target){
      this.effects=this.effects.filter(effect=>effect.target!==target);
    }
  };
  return scene;
}

const enemy=(name,x,y=100,hp=1000)=>({
  name,
  x,
  y,
  hp,
  maxHp:hp,
  active:true,
  isDefeated:false,
  defense:0,
  damageReduction:0
});

// Poison-chain edges must use stable object identity, not mutable X positions.
{
  const scene=makeScene();
  const left=enemy('left',100);
  const middle=enemy('middle',100);
  const right=enemy('right',100);
  scene.enemies=[left,middle,right];
  [left,middle,right].forEach(target=>{
    scene.statusEffects.add(StatusEffects.POISON,target,{
      sourceId:'seed',
      stacks:1
    });
  });
  const system={
    scene,
    passiveUpdaters:[],
    getLevel:()=>9,
    getData:id=>id==='poison_chain'
      ?SKILLS.poison_chain.levels[8]
      :SKILLS.poison_cloud.levels[8]
  };
  const cleanup=PoisonChainSkill.bind(system);
  const runtime=scene.poisonChainRuntime;
  runtime.addNode(left);
  runtime.addNode(middle);
  runtime.addNode(right);
  assert(runtime.connect(left,middle));
  assert(runtime.connect(middle,right));
  assert.equal(runtime.edgeCount(),2,'same-X enemies keep separate edges');
  const firstVisual=runtime.visualFor(left,middle);
  left.x=250;
  middle.x=310;
  system.passiveUpdaters.forEach(update=>update());
  assert.equal(
    runtime.visualFor(left,middle),
    firstVisual,
    'moving nodes keep the same edge identity'
  );
  runtime.removeNode(left);
  assert(firstVisual.destroyed,'removing moved node destroys its edge visual');
  cleanup();
}

// Lethal damage must not read a destroyed poison-king closure or hit its respawn.
{
  const scene=makeScene();
  const system={
    scene,
    passiveUpdaters:[],
    getLevel:()=>9,
    getData:id=>id==='poison_king'
      ?SKILLS.poison_king.levels[8]
      :SKILLS.poison_cloud.levels[8]
  };
  scene.combatSystem={
    damageEnemy(target,amount){
      const before=target.hp;
      target.hp=Math.max(0,target.hp-amount);
      return before!==target.hp;
    }
  };
  const cleanup=PoisonKingSkill.bind(system);
  const oldTarget=scene.poisonKingRuntime.getAttackTarget();
  assert(oldTarget?.isAlive());
  const oldHp=oldTarget.hp;
  assert.equal(oldTarget.takeDamage(oldHp+10),oldHp);
  assert.equal(oldTarget.hp,0,'old attack target remains readable after death');
  assert.equal(oldTarget.isAlive(),false);
  scene.now=SKILLS.poison_king.levels[8].reviveMs+1;
  system.passiveUpdaters.forEach(update=>update());
  const newTarget=scene.poisonKingRuntime.getAttackTarget();
  assert(newTarget?.isAlive(),'poison king respawns');
  const newHp=newTarget.hp;
  assert.equal(oldTarget.takeDamage(10),0,'stale target cannot damage respawn');
  assert.equal(newTarget.hp,newHp);
  cleanup();
}

// CombatSystem must safely process a lethal hit on the poison king.
{
  const scene=makeScene();
  let hp=10;
  const target={
    type:'poison_king',
    get hp(){ return hp; },
    isAlive:()=>hp>0,
    takeDamage(amount){
      const before=hp;
      hp=Math.max(0,hp-amount);
      return before-hp;
    }
  };
  const combat=new CombatSystem(scene);
  assert.equal(combat.damageAttackTarget(target,20,{}),10);
  assert.equal(hp,0);
}

// Repeated bites/domain pulses must stack into stable effects, not create one effect per tick.
{
  const scene=makeScene();
  const victim=enemy('victim',80,100,10000);
  scene.enemies=[victim];
  scene.combatSystem={
    damageEnemy(target,amount){
      target.hp=Math.max(0,target.hp-amount);
      return true;
    }
  };
  const system={
    scene,
    passiveUpdaters:[],
    getLevel:()=>9,
    getData:id=>id==='poison_king'
      ?SKILLS.poison_king.levels[8]
      :SKILLS.poison_cloud.levels[8]
  };
  const cleanup=PoisonKingSkill.bind(system);
  [900,1800,2700,3600].forEach(time=>{
    scene.now=time;
    system.passiveUpdaters.forEach(update=>update());
  });
  const kingEffects=scene.statusEffects.effects.filter(
    effect=>effect.target===victim
      && effect.type===StatusEffects.POISON
      && effect.sourceId.startsWith('poison_king_')
  );
  assert.equal(
    new Set(kingEffects.map(effect=>effect.sourceId)).size,
    kingEffects.length,
    'poison king keeps one effect per poison source'
  );
  assert(kingEffects.length<=2,'bite and domain do not create unbounded effects');
  cleanup();
}

console.log('validate-01053-poison-summon-regressions: ok');
