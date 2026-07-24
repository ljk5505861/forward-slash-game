import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import { syncEnemyUi } from '../src/entities/createEnemy.js';
import { PoisonChainActiveSkill } from '../src/skills/handlers/PoisonSummonInteractionFixes.js';

class Bus {
  constructor(){ this.handlers=new Map(); }
  on(event,handler){
    const list=this.handlers.get(event)||[];
    list.push(handler);
    this.handlers.set(event,list);
    return ()=>this.handlers.set(
      event,
      (this.handlers.get(event)||[]).filter(item=>item!==handler)
    );
  }
  emit(event,payload){
    [...(this.handlers.get(event)||[])].forEach(handler=>handler(payload));
  }
}

const visual=(x=0,y=0)=>({
  x,
  y,
  active:true,
  visible:true,
  text:'',
  destroyed:false,
  setStrokeStyle(){ return this; },
  setDepth(){ return this; },
  setAlpha(){ return this; },
  setAlpha(){ return this; },
  setPosition(nextX,nextY){ this.x=nextX; this.y=nextY; return this; },
  setVisible(value){ this.visible=value; return this; },
  setText(value){ this.text=value; return this; },
  setDisplaySize(){ return this; },
  clear(){ return this; },
  lineStyle(){ return this; },
  lineBetween(){ this.drewLine=true; return this; },
  destroy(){ this.active=false; this.destroyed=true; }
});

function makeScene(){
  const bus=new Bus();
  const scene={
    now:0,
    player:{x:0,y:100},
    enemies:[],
    eventBus:bus,
    getGameplayTime(){ return this.now; },
    targeting:{
      all(){
        return scene.enemies.filter(enemy=>
          enemy.active!==false
          &&!enemy.isDefeated
          &&enemy.hp>0
        );
      },
      valid(enemy){
        return !!enemy
          &&enemy.active!==false
          &&!enemy.isDefeated
          &&enemy.hp>0;
      }
    },
    add:{
      ellipse:(x,y)=>visual(x,y),
      graphics:()=>visual()
    },
    floatMessages:[],
    floatText(x,y,text,color){
      this.floatMessages.push({x,y,text,color});
    }
  };
  scene.statusEffects={
    effects:[],
    has(target,type){
      return this.effects.some(effect=>
        effect.target===target&&effect.type===type
      );
    },
    getStackCount(target,type){
      return this.effects
        .filter(effect=>effect.target===target&&effect.type===type)
        .reduce((sum,effect)=>sum+(effect.stacks||1),0);
    },
    getEffects(target,type){
      return this.effects.filter(effect=>
        effect.target===target&&effect.type===type
      );
    },
    add(type,target,options={}){
      const old=this.effects.find(effect=>
        effect.type===type
        &&effect.target===target
        &&effect.sourceId===(options.sourceId||'')
      );
      if(old){
        const previous=old.stacks||1;
        Object.assign(old,options,{type,target});
        old.stacks=previous+(options.stacks||1);
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
        ...options,
        sourceId:options.sourceId||'',
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
    }
  };
  scene.combatSystem={
    clearKnockback(enemy){
      enemy.knockbackTween=null;
      enemy.isKnockbackActive=false;
    },
    damageEnemy(enemy,amount){
      if(!scene.targeting.valid(enemy)) return false;
      const before=enemy.hp;
      enemy.hp=Math.max(0,enemy.hp-amount);
      if(enemy.hp<=0) enemy.isDefeated=true;
      return before!==enemy.hp;
    }
  };
  return scene;
}

const enemy=(name,x,{boss=false,hp=1000}={})=>{
  const target={
    name,
    x,
    y:100,
    width:60,
    height:100,
    hp,
    maxHp:hp,
    active:true,
    isDefeated:false,
    isBoss:boss,
    isKnockbackActive:false,
    nextAttackAt:0
  };
  target.body={
    velocity:{x:50},
    setVelocityX(value){ this.velocity.x=value; }
  };
  return target;
};

function makeSystem(scene,level=1){
  const lines=[];
  const projectiles=[];
  return {
    scene,
    passiveUpdaters:[],
    lines,
    projectiles,
    getLevel:id=>id==='poison_chain'?level:9,
    getData(id){
      if(id==='poison_chain') return SKILLS.poison_chain.levels[level-1];
      if(id==='poison_cloud') return SKILLS.poison_cloud.levels[8];
      return null;
    },
    damageValue:value=>value,
    baseDamageValue:value=>value,
    line(...args){ lines.push(args); },
    projectile(...args){ projectiles.push(args); },
    hit(target,damage){
      return scene.combatSystem.damageEnemy(target,damage);
    }
  };
}

assert.equal(GAME_VERSION,'0.11.6');
assert.equal(SKILLS.poison_chain.passive,false);
assert.equal(SKILLS.poison_chain.targetType,'nearestAhead');
assert.equal(SKILLS.poison_chain.levels[0].damage,34);
assert.equal(SKILLS.poison_chain.levels[0].cooldownMs,5200);
assert.equal(SKILLS.poison_chain.levels[0].prisonMs,2000);
assert(SKILLS.poison_chain.tags.includes('activeSkill'));
assert(SKILLS.poison_chain.tags.includes('projectile'));

// Normal enemy: the thrown chain deals damage, seeds the network and fully disables it for 2 seconds.
{
  const scene=makeScene();
  const first=enemy('first',120);
  const second=enemy('second',180);
  scene.enemies=[first,second];
  [first,second].forEach(target=>scene.statusEffects.add(
    StatusEffects.POISON,
    target,
    {sourceId:'seed',stacks:1}
  ));
  const system=makeSystem(scene,1);
  const cleanup=PoisonChainActiveSkill.bind(system);
  assert.equal(PoisonChainActiveSkill.canCast(system),true);
  const hpBefore=first.hp;
  const result=PoisonChainActiveSkill.cast(
    system,
    SKILLS.poison_chain,
    SKILLS.poison_chain.levels[0],
    1,
    {}
  );
  assert.equal(result.failed,undefined);
  assert.equal(first.hp,hpBefore-34);
  assert.equal(system.lines.length,1,'one visible chain line is thrown');
  assert.equal(system.projectiles.length,1,'one chain head projectile is thrown');
  assert(scene.poisonChainRuntime.hasNode(first));
  assert.equal(scene.poisonChainRuntime.isPrisoned(first),true);
  assert.equal(first.isKnockbackActive,true,'existing attack and movement gates are engaged');
  assert.equal(first.body.velocity.x,0);
  assert(first.nextAttackAt>=2000);

  const oldRandom=Math.random;
  Math.random=()=>0;
  scene.now=250;
  system.passiveUpdaters.forEach(update=>update());
  Math.random=oldRandom;
  assert(scene.poisonChainRuntime.hasNode(second));
  assert(scene.poisonChainRuntime.hasEdge(first,second));

  scene.now=1999;
  system.passiveUpdaters.forEach(update=>update());
  assert.equal(first.isKnockbackActive,true);
  scene.now=2001;
  system.passiveUpdaters.forEach(update=>update());
  assert.equal(scene.poisonChainRuntime.isPrisoned(first),false);
  assert.equal(first.isKnockbackActive,false);
  cleanup();
}

// Boss takes direct damage and becomes a node, but never receives the prison state.
{
  const scene=makeScene();
  const boss=enemy('boss',120,{boss:true,hp:2000});
  scene.enemies=[boss];
  scene.statusEffects.add(StatusEffects.POISON,boss,{
    sourceId:'seed',
    stacks:3
  });
  const system=makeSystem(scene,1);
  const cleanup=PoisonChainActiveSkill.bind(system);
  const before=boss.hp;
  PoisonChainActiveSkill.cast(
    system,
    SKILLS.poison_chain,
    SKILLS.poison_chain.levels[0],
    1,
    {}
  );
  assert.equal(boss.hp,before-34);
  assert(scene.poisonChainRuntime.hasNode(boss));
  assert.equal(scene.poisonChainRuntime.isPrisoned(boss),false);
  assert.equal(boss.isKnockbackActive,false);
  assert(scene.floatMessages.some(message=>message.text==='禁锢免疫'));
  cleanup();
}

// No valid target means no cast and no cooldown-consuming false launch.
{
  const scene=makeScene();
  scene.enemies=[];
  const system=makeSystem(scene,1);
  const cleanup=PoisonChainActiveSkill.bind(system);
  assert.equal(PoisonChainActiveSkill.canCast(system),false);
  assert.equal(
    PoisonChainActiveSkill.cast(
      system,
      SKILLS.poison_chain,
      SKILLS.poison_chain.levels[0],
      1,
      {}
    ).failed,
    true
  );
  cleanup();
}

// Enemy UI refresh must preserve both orange burn and green poison numbers.
{
  const text=()=>({
    value:'',
    x:0,
    setPosition(x){ this.x=x; return this; },
    setText(value){ this.value=value; return this; }
  });
  const target={
    active:true,
    x:100,
    y:100,
    width:60,
    height:100,
    hp:90,
    maxHp:100,
    hpBarBg:visual(),
    hpBar:visual(),
    nameText:visual(),
    levelText:visual(),
    statusIndicatorContainer:visual(),
    burnIndicator:{IconPlaceholder:visual(),StackText:text()},
    poisonIndicator:{StackText:text()}
  };
  target.scene={
    statusEffects:{
      getStackCount(_target,type){ return type==='BURN'?3:12; }
    }
  };
  syncEnemyUi(target);
  assert.equal(target.burnIndicator.StackText.value,'3');
  assert.equal(target.poisonIndicator.StackText.value,'12');
}

const combatSource=fs.readFileSync(new URL('../src/systems/CombatSystem.js',import.meta.url),'utf8');
assert.match(combatSource,/meta\.source===['"]poison['"]\?['"]#63ff72['"]/, 'poison damage numbers use bright green');

const interactionSource=fs.readFileSync(
  new URL('../src/skills/handlers/PoisonSummonInteractionFixes.js',import.meta.url),
  'utf8'
);
assert.match(
  interactionSource,
  /setVisible\?\.\(!!gu\.host\)/,
  'free parasitic gu is hidden until it has a poisoned host'
);

console.log('validate-01055-poison-chain-control-fix: ok');
