import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import { syncEnemyUi } from '../src/entities/createEnemy.js';
import { PoisonChainActiveSkill } from '../src/skills/handlers/PoisonSummonInteractionFixes.js';
import { PoisonKingSkill } from '../src/skills/handlers/PoisonSummonAdvancedSkills.js';
import SkillSystem from '../src/systems/SkillSystem.js';

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
    playerData:{skills:[{id:'poison_chain',level:1}],hp:100,maxHp:100,mana:100,maxMana:100,cooldownReduction:0,skillDamageMultiplier:1},
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
      },
      nearestAhead(range){
        return this.all()
          .filter(enemy=>enemy.x>=scene.player.x-20&&enemy.x-scene.player.x<=range)
          .sort((a,b)=>Math.hypot(a.x-scene.player.x,a.y-scene.player.y)-Math.hypot(b.x-scene.player.x,b.y-scene.player.y))[0]||null;
      },
      isEnemyFullyInsideViewport(enemy){
        return this.valid(enemy);
      }
    },
    created:{graphics:[],circles:[]},
    add:{
      ellipse:(x,y)=>visual(x,y),
      graphics:()=>{ const g=visual(); scene.created.graphics.push(g); return g; },
      circle:(x,y)=>{ const c=visual(x,y); scene.created.circles.push(c); return c; },
      container:(x,y)=>({x,y,active:true,visible:true,children:[],destroyed:false,setDepth(){return this;},add(items){this.children.push(...items);return this;},setVisible(v){this.visible=v;return this;},destroy(){this.active=false;this.destroyed=true;}}),
      rectangle:(x,y,w,h,color,alpha)=>({...visual(x,y),displayWidth:w,displayHeight:h,width:w,height:h,color,alpha,origin:null,setOrigin(x,y){this.origin={x,y};return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;}})
    },
    tweens:{ add(config){ config?.onComplete?.(); return config; } },
    hud:{ update(){} },
    skillBar:{ update(){} },
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


function makeRealSkillSystem(scene){
  const system=Object.create(SkillSystem.prototype);
  Object.assign(system,{
    scene,
    cooldowns:new Map(),
    active:[],
    nextCastId:1,
    boundPassives:new Map(),
    passiveState:{},
    passiveUpdaters:[],
    attachedVisualSyncers:[]
  });
  return system;
}

assert.equal(GAME_VERSION,'0.10.83');
assert.equal(SKILLS.poison_chain.passive,false);
assert.equal(SKILLS.poison_chain.targetType,'nearestAhead');
assert.equal(SKILLS.poison_chain.levels[0].damage,34);
assert.equal(SKILLS.poison_chain.levels[0].cooldownMs,5200);
assert.equal(SKILLS.poison_chain.levels[0].prisonMs,2000);
assert(SKILLS.poison_chain.tags.includes('activeSkill'));
assert(SKILLS.poison_chain.tags.includes('projectile'));


// End-to-end auto cast: SkillSystem.update drives target checks, handler preflight, cast and cooldown.
{
  const scene=makeScene();
  const clean=enemy('auto-clean',120);
  scene.enemies=[clean];
  const system=makeRealSkillSystem(scene);
  const cleanup=PoisonChainActiveSkill.bind(system);
  scene.now=1000;
  system.update(scene.now);
  assert.equal(scene.created.graphics.length,1,'auto cast creates a visible chain line');
  assert.equal(scene.created.circles.length,1,'auto cast creates a projectile visual');
  assert.equal(clean.hp,1000-34,'auto cast deals level 1 poison chain damage');
  assert.equal(scene.statusEffects.getStackCount(clean,StatusEffects.POISON),1,'auto cast applies one poison stack');
  assert(scene.poisonChainRuntime.hasNode(clean),'auto cast seeds the poison web node');
  assert.equal(scene.poisonChainRuntime.isPrisoned(clean),true,'auto cast prisons normal enemy');
  assert.equal(system.cooldowns.get('poison_chain'),1000+5200,'successful auto cast writes level 1 cooldown');
  cleanup();
}

// End-to-end no target: SkillSystem.update does not cast and does not consume cooldown.
{
  const scene=makeScene();
  scene.enemies=[];
  const system=makeRealSkillSystem(scene);
  const cleanup=PoisonChainActiveSkill.bind(system);
  scene.now=1000;
  system.update(scene.now);
  assert.equal(scene.created.graphics.length,0,'no target creates no chain line');
  assert.equal(scene.created.circles.length,0,'no target creates no projectile');
  assert.equal(system.cooldowns.has('poison_chain'),false,'no target does not write cooldown');
  cleanup();
}

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


// Clean target: poison chain works independently, damages, adds poison, seeds node and prisons.
{
  const scene=makeScene();
  const clean=enemy('clean',120);
  scene.enemies=[clean];
  const system=makeSystem(scene,1);
  const cleanup=PoisonChainActiveSkill.bind(system);
  assert.equal(PoisonChainActiveSkill.canCast(system),true);
  const before=clean.hp;
  PoisonChainActiveSkill.cast(system,SKILLS.poison_chain,SKILLS.poison_chain.levels[0],1,{});
  assert.equal(clean.hp,before-34);
  assert.equal(scene.statusEffects.getStackCount(clean,StatusEffects.POISON),1);
  assert(scene.poisonChainRuntime.hasNode(clean));
  assert.equal(scene.poisonChainRuntime.isPrisoned(clean),true);
  cleanup();
}

// Lethal hit: no node and no prison is left on a dead target.
{
  const scene=makeScene();
  const weak=enemy('weak',120,{hp:20});
  scene.enemies=[weak];
  const system=makeSystem(scene,1);
  const cleanup=PoisonChainActiveSkill.bind(system);
  PoisonChainActiveSkill.cast(system,SKILLS.poison_chain,SKILLS.poison_chain.levels[0],1,{});
  assert.equal(weak.isDefeated,true);
  assert.equal(scene.poisonChainRuntime.hasNode(weak),false);
  assert.equal(scene.poisonChainRuntime.isPrisoned(weak),false);
  cleanup();
}

// Boss can be selected clean, is poisoned and node-seeded, but is not prisoned.
{
  const scene=makeScene();
  const boss=enemy('boss-clean',120,{boss:true,hp:2000});
  scene.enemies=[boss];
  const system=makeSystem(scene,1);
  const cleanup=PoisonChainActiveSkill.bind(system);
  PoisonChainActiveSkill.cast(system,SKILLS.poison_chain,SKILLS.poison_chain.levels[0],1,{});
  assert.equal(boss.hp,1966);
  assert.equal(scene.statusEffects.getStackCount(boss,StatusEffects.POISON),1);
  assert(scene.poisonChainRuntime.hasNode(boss));
  assert.equal(scene.poisonChainRuntime.isPrisoned(boss),false);
  assert.equal(boss.isKnockbackActive,false);
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


// Poison king hp bar lifecycle and ratio behavior.
{
  const scene=makeScene();
  scene.playerData.skills=[{id:'poison_king',level:1}];
  const system={
    scene,
    passiveUpdaters:[],
    getLevel:id=>id==='poison_king'?1:0,
    getData(id){ return id==='poison_king'?SKILLS.poison_king.levels[0]:null; }
  };
  const cleanup=PoisonKingSkill.bind(system);
  let king=scene.poisonKingRuntime.get();
  assert(king?.hpBar?.container,'poison king creates hp bar');
  assert.equal(king.hpBar.width,46);
  const startX=king.hpBar.container.x;
  scene.enemies=[enemy('dummy',240)];
  scene.now=100;
  system.passiveUpdaters.forEach(update=>update());
  assert.notEqual(king.hpBar.container.x,startX,'hp bar follows movement');
  scene.poisonKingRuntime.forceDamage(25);
  assert.equal(king.hpBar.fill.displayWidth,46*(king.hp/king.maxHp));
  king.hp=Math.min(king.maxHp,king.hp+10);
  system.passiveUpdaters.forEach(update=>update());
  assert.equal(king.hpBar.fill.displayWidth,46*(king.hp/king.maxHp));
  king.maxHp+=50;
  system.passiveUpdaters.forEach(update=>update());
  assert.equal(king.hpBar.fill.displayWidth,46*(king.hp/king.maxHp));
  const oldBar=king.hpBar.container;
  scene.poisonKingRuntime.forceDamage(99999);
  assert.equal(oldBar.destroyed,true,'hp bar is destroyed on death');
  scene.now=5000;
  system.passiveUpdaters.forEach(update=>update());
  king=scene.poisonKingRuntime.get();
  assert(king?.hpBar?.container,'poison king recreates one hp bar on revive');
  assert.notEqual(king.hpBar.container,oldBar);
  cleanup();
  assert.equal(king.hpBar,null,'cleanup destroys current hp bar');
  assert.equal(system.passiveUpdaters.length,0);
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



// Poison king damage text uses actual HP loss, shared by attack target and forceDamage.
{
  const scene=makeScene();
  scene.playerData.skills=[{id:'poison_king',level:1}];
  const system={
    scene,
    passiveUpdaters:[],
    getLevel:id=>id==='poison_king'?1:0,
    getData(id){ return id==='poison_king'?SKILLS.poison_king.levels[0]:null; }
  };
  const cleanup=PoisonKingSkill.bind(system);
  const king=scene.poisonKingRuntime.get();
  king.view.x=321;
  king.view.y=222;
  const hpBefore=king.hp;
  const actual=scene.poisonKingRuntime.getAttackTarget().takeDamage(25);
  assert.equal(actual,25,'attack target returns actual poison king damage');
  assert.equal(king.hp,hpBefore-25,'attack target reduces poison king hp by actual damage');
  assert.equal(scene.floatMessages.length,1,'attack target emits exactly one damage float text');
  assert.deepEqual(scene.floatMessages[0],{x:321,y:174,text:'-25',color:'#ff7777'});
  cleanup();
}

// Poison king overkill damage text is capped to remaining HP and appears before destruction.
{
  const scene=makeScene();
  scene.playerData.skills=[{id:'poison_king',level:1}];
  const system={
    scene,
    passiveUpdaters:[],
    getLevel:id=>id==='poison_king'?1:0,
    getData(id){ return id==='poison_king'?SKILLS.poison_king.levels[0]:null; }
  };
  PoisonKingSkill.bind(system);
  const king=scene.poisonKingRuntime.get();
  king.view.x=180;
  king.view.y=140;
  king.hp=10;
  const view=king.view;
  const bar=king.hpBar.container;
  const actual=scene.poisonKingRuntime.getAttackTarget().takeDamage(100);
  assert.equal(actual,10,'overkill returns remaining HP as actual damage');
  assert.equal(scene.floatMessages.length,1,'overkill emits exactly one damage float text');
  assert.deepEqual(scene.floatMessages[0],{x:180,y:92,text:'-10',color:'#ff7777'});
  assert.equal(view.destroyed,true,'poison king body is destroyed after lethal damage text');
  assert.equal(bar.destroyed,true,'poison king hp bar is destroyed after lethal damage');
  assert.equal(scene.poisonKingRuntime.get(),null,'poison king dies after lethal overkill');
}

// Poison king forceDamage also displays one actual damage float text.
{
  const scene=makeScene();
  scene.playerData.skills=[{id:'poison_king',level:1}];
  const system={
    scene,
    passiveUpdaters:[],
    getLevel:id=>id==='poison_king'?1:0,
    getData(id){ return id==='poison_king'?SKILLS.poison_king.levels[0]:null; }
  };
  const cleanup=PoisonKingSkill.bind(system);
  const king=scene.poisonKingRuntime.get();
  king.view.x=400;
  king.view.y=250;
  const actual=scene.poisonKingRuntime.forceDamage(17);
  assert.equal(actual,17,'forceDamage returns actual poison king damage');
  assert.equal(scene.floatMessages.length,1,'forceDamage emits exactly one damage float text');
  assert.deepEqual(scene.floatMessages[0],{x:400,y:202,text:'-17',color:'#ff7777'});
  cleanup();
}

// Poison king ignores zero damage, dead targets and invalid stale attack targets without text or errors.
{
  const scene=makeScene();
  scene.playerData.skills=[{id:'poison_king',level:1}];
  const system={
    scene,
    passiveUpdaters:[],
    getLevel:id=>id==='poison_king'?1:0,
    getData(id){ return id==='poison_king'?SKILLS.poison_king.levels[0]:null; }
  };
  const cleanup=PoisonKingSkill.bind(system);
  const target=scene.poisonKingRuntime.getAttackTarget();
  assert.equal(target.takeDamage(0),0,'zero damage returns zero');
  assert.equal(scene.poisonKingRuntime.forceDamage(0),0,'zero forceDamage returns zero');
  assert.equal(scene.floatMessages.length,0,'zero damage does not emit text');
  scene.poisonKingRuntime.forceDamage(99999);
  const countAfterDeath=scene.floatMessages.length;
  assert.doesNotThrow(()=>target.takeDamage(5),'stale dead target does not throw');
  assert.equal(target.takeDamage(5),0,'stale dead target returns zero actual damage');
  assert.equal(scene.poisonKingRuntime.forceDamage(5),0,'dead forceDamage returns zero actual damage');
  assert.equal(scene.floatMessages.length,countAfterDeath,'dead or stale target emits no extra text');
  cleanup();
}

// Poison king damage text uses the latest moved body position at the damage instant.
{
  const scene=makeScene();
  scene.playerData.skills=[{id:'poison_king',level:1}];
  const system={
    scene,
    passiveUpdaters:[],
    getLevel:id=>id==='poison_king'?1:0,
    getData(id){ return id==='poison_king'?SKILLS.poison_king.levels[0]:null; }
  };
  const cleanup=PoisonKingSkill.bind(system);
  const king=scene.poisonKingRuntime.get();
  king.view.x=512;
  king.view.y=333;
  scene.poisonKingRuntime.getAttackTarget().takeDamage(8);
  assert.deepEqual(scene.floatMessages[0],{x:512,y:285,text:'-8',color:'#ff7777'});
  cleanup();
}


console.log('validate-01058-poison-king-damage-text: ok');
