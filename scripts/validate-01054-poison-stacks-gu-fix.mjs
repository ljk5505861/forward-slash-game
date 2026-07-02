import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import StatusEffectSystem, {
  POISON_STACK_CAP,
  StatusEffects
} from '../src/systems/StatusEffectSystem.js';
import {
  createEnemyStatusIndicators,
  STATUS_ITEM_WIDTH,
  updateEnemyStatusIndicators
} from '../src/ui/EnemyStatusIndicators.js';
import {
  configureEntryArchetypeSkills
} from '../src/skills/handlers/EntryArchetypeSkills.js';
import {
  configurePoisonSummonCoreSkills,
  ParasiticGuSkill
} from '../src/skills/handlers/PoisonSummonCoreSkills.js';

configureEntryArchetypeSkills();
configurePoisonSummonCoreSkills();

class EventBus {
  constructor(){
    this.handlers=new Map();
  }

  on(event,handler){
    const handlers=this.handlers.get(event)||[];
    handlers.push(handler);
    this.handlers.set(event,handlers);
    return ()=>{
      this.handlers.set(
        event,
        (this.handlers.get(event)||[]).filter(item=>item!==handler)
      );
    };
  }

  emit(event,payload){
    [...(this.handlers.get(event)||[])].forEach(
      handler=>handler(payload)
    );
  }
}

function displayObject(x=0,y=0){
  return {
    x,
    y,
    active:true,
    visible:true,
    alpha:1,
    text:'',
    style:{},
    children:[],
    setDepth(){ return this; },
    setOrigin(){ return this; },
    setStrokeStyle(){ return this; },
    setAlpha(value){ this.alpha=value; return this; },
    setVisible(value){ this.visible=value; return this; },
    setPosition(nextX,nextY){ this.x=nextX; this.y=nextY; return this; },
    setText(value){ this.text=value; return this; },
    setFillStyle(){ return this; },
    setScale(){ return this; },
    add(items){ this.children.push(...items); return this; },
    destroy(){ this.active=false; }
  };
}

function makeScene(){
  const eventBus=new EventBus();
  const scene={
    now:0,
    eventBus,
    player:{x:0,y:100},
    playerData:{
      hp:100,
      maxHp:100,
      maxShield:0,
      shield:0,
      permanentShield:0
    },
    enemies:[],
    passiveUpdaters:[],
    getGameplayTime(){ return this.now; },
    isGameplayPaused(){ return false; },
    add:{
      container(x,y){ return displayObject(x,y); },
      rectangle(x,y){ return displayObject(x,y); },
      circle(x,y){ return displayObject(x,y); },
      text(x,y,text,style){
        const object=displayObject(x,y);
        object.text=text;
        object.style=style;
        return object;
      }
    },
    targeting:{
      all(){
        return scene.enemies.filter(
          enemy=>enemy.active!==false
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
    floatText(){},
    tweens:{add(){}},
    hud:{update(){}},
    finishRun(){}
  };
  scene.statusEffects=new StatusEffectSystem(scene);
  scene.combatSystem={
    damageEnemy(target,amount){
      if(!scene.targeting.valid(target)) return false;
      target.hp=Math.max(0,target.hp-Math.max(0,amount));
      if(target.hp<=0){
        target.isDefeated=true;
        eventBus.emit(CombatEvents.ENEMY_KILLED,{enemy:target});
      }
      return true;
    }
  };
  return scene;
}

function enemy(name,hp=1000){
  return {
    name,
    x:100,
    y:100,
    width:60,
    height:100,
    hp,
    maxHp:hp,
    active:true,
    isDefeated:false
  };
}

assert.equal(GAME_VERSION,'0.10.93');
assert.equal(POISON_STACK_CAP,15);
assert.equal(SKILLS.parasitic_gu.levels[0].poisonAbsorbRatio,0.03);
assert.equal(SKILLS.parasitic_gu.levels[0].poisonStacks,1);
assert.equal(SKILLS.parasitic_gu.levels[5].poisonStacks,2);

// Burn remains orange in slot 0; poison is a bright green number in slot 1.
{
  const scene=makeScene();
  const target=enemy('indicator');
  createEnemyStatusIndicators(scene,target);
  updateEnemyStatusIndicators(target,3,12);
  assert.equal(target.burnIndicator.StackText.text,'3');
  assert.equal(target.burnIndicator.StackText.x,0);
  assert.equal(target.poisonIndicator.StackText.text,'12');
  assert.equal(target.poisonIndicator.StackText.x,STATUS_ITEM_WIDTH);
  assert.equal(target.poisonIndicator.StackText.style.color,'#63ff72');
  assert.equal(target.poisonIndicator.StackText.style.strokeThickness,2);
  assert.equal(target.statusIndicatorContainer.visible,true);
}

// All poison sources share one displayed/global 15-stack cap.
{
  const scene=makeScene();
  const target=enemy('stack-cap');
  scene.enemies=[target];
  createEnemyStatusIndicators(scene,target);
  scene.statusEffects.add(StatusEffects.POISON,target,{
    sourceId:'poison_needle',
    stacks:10,
    maxStacks:15,
    durationMs:1000,
    intervalMs:700,
    value:6
  });
  scene.statusEffects.add(StatusEffects.POISON,target,{
    sourceId:'poison_king',
    stacks:10,
    maxStacks:15,
    durationMs:2000,
    intervalMs:700,
    value:8
  });
  assert.equal(
    scene.statusEffects.getStackCount(target,StatusEffects.POISON),
    15
  );
  assert.equal(target.poisonIndicator.StackText.text,'15');
  assert.equal(
    scene.statusEffects.getEffects(target,StatusEffects.POISON)
      .find(effect=>effect.sourceId==='poison_king')?.stacks,
    5,
    'second source only fills remaining global room'
  );
  const effectsBefore=scene.statusEffects.getEffects(
    target,
    StatusEffects.POISON
  ).length;
  scene.now=500;
  scene.statusEffects.add(StatusEffects.POISON,target,{
    sourceId:'parasitic_gu_attack',
    stacks:2,
    maxStacks:15,
    durationMs:3000,
    intervalMs:700,
    value:6
  });
  assert.equal(
    scene.statusEffects.getStackCount(target,StatusEffects.POISON),
    15
  );
  assert.equal(
    scene.statusEffects.getEffects(target,StatusEffects.POISON).length,
    effectsBefore,
    'at cap, a new source refreshes poison without creating zero-stack effect'
  );
  assert(
    scene.statusEffects.getEffects(target,StatusEffects.POISON)
      .every(effect=>effect.expiresAt>=3500),
    'all shared poison stacks refresh together'
  );
}

function bindGu(level,hostHp=1000){
  const scene=makeScene();
  const host=enemy('host',hostHp);
  scene.enemies=[host];
  scene.statusEffects.add(StatusEffects.POISON,host,{
    sourceId:'seed',
    stacks:1,
    maxStacks:15,
    durationMs:10000,
    intervalMs:700,
    value:6,
    poisonMeta:{normal:true}
  });
  const system={
    scene,
    passiveUpdaters:[],
    getLevel:id=>id==='parasitic_gu'?level:9,
    getData(id){
      if(id==='parasitic_gu') return SKILLS.parasitic_gu.levels[level-1];
      if(id==='poison_cloud') return SKILLS.poison_cloud.levels[8];
      return null;
    }
  };
  const cleanup=ParasiticGuSkill.bind(system);
  return {scene,host,system,cleanup};
}

// Direct gu attack no longer heals; only a normal poison tick restores 3%.
{
  const {scene,host,system,cleanup}=bindGu(1);
  const gu=scene.parasiticGuRuntime.first();
  gu.hp=20;
  scene.now=350;
  system.passiveUpdaters.forEach(update=>update());
  assert.equal(
    Number(gu.hp.toFixed(1)),
    18.6,
    'attack damage gives no self-heal; only natural loss applies'
  );
  assert.equal(
    scene.statusEffects.getStackCount(host,StatusEffects.POISON),
    2,
    'level 1 gu attack adds one poison stack'
  );
  const hpBeforeTick=gu.hp;
  scene.eventBus.emit(CombatEvents.STATUS_TICK,{
    type:StatusEffects.POISON,
    target:host,
    actualDamage:100,
    effect:{poisonMeta:{normal:true}}
  });
  assert.equal(
    Number((gu.hp-hpBeforeTick).toFixed(1)),
    3,
    'normal poison damage restores exactly 3%'
  );
  cleanup();
}

// Level 6 attack adds two poison stacks.
{
  const {scene,host,system,cleanup}=bindGu(6);
  const before=scene.statusEffects.getStackCount(host,StatusEffects.POISON);
  scene.now=350;
  system.passiveUpdaters.forEach(update=>update());
  assert.equal(
    scene.statusEffects.getStackCount(host,StatusEffects.POISON),
    before+2
  );
  cleanup();
}

// Killing the host synchronously may clear gu.host, but the current attack must not crash.
{
  const {scene,host,system,cleanup}=bindGu(1,5);
  assert.doesNotThrow(()=>{
    scene.now=350;
    system.passiveUpdaters.forEach(update=>update());
  });
  assert.equal(host.isDefeated,true);
  assert.equal(scene.parasiticGuRuntime.first().host,null);
  assert.equal(
    scene.statusEffects.getStackCount(host,StatusEffects.POISON),
    1,
    'the pre-existing seed poison remains in this isolated test double'
  );
  assert.equal(
    scene.statusEffects.getEffects(host,StatusEffects.POISON)
      .some(effect=>effect.sourceId==='parasitic_gu_attack'),
    false,
    'dead host receives no post-mortem gu attack poison'
  );
  cleanup();
}

console.log('validate-01054-poison-stacks-gu-fix: ok');
