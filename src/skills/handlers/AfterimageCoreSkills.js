import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { getWeapon } from '../../config/weapons.js';

const levels=(values,build,milestones={})=>values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}),
}));
const sumBonuses=bonuses=>Object.values(bonuses||{}).reduce((sum,value)=>sum+(Number(value)||0),0);
const PHANTOM_COUNTS=[2,2,3,3,3,4,4,4,5];
const PHANTOM_RATIOS=[0.40,0.46,0.52,0.58,0.64,0.70,0.78,0.86,0.95];
const TRACES_DODGE=[0.20,0.22,0.24,0.26,0.28,0.30,0.32,0.34,0.36];
const TRACES_HEAL=[5,7,10,13,16,20,24,29,35];

const AFTERIMAGE_CORE_SKILLS={
  traceless:{
    id:'traceless',name:'无踪',rarity:'EPIC',handler:'traceless',passive:true,maxLevel:9,coreSkill:true,
    tags:['shadow','dodge',TAGS.BUILD_AFTERIMAGE],cooldownMs:999999,targetType:'passive',color:0xa855f7,short:'踪',
    description:'永久提高闪避率；每次真实闪避立即回复固定生命，无内置冷却。',
    levels:levels(TRACES_DODGE.map((dodgeChance,i)=>[dodgeChance,TRACES_HEAL[i]]),([dodgeChance,dodgeHeal])=>({
      dodgeChance,dodgeHeal,desc:`永久闪避率+${Math.round(dodgeChance*100)}%；真实闪避时回复${dodgeHeal}生命。`
    }),{
      3:'无踪闪避提高至24%，真实闪避回复10生命',
      6:'无踪闪避提高至30%，真实闪避回复20生命',
      9:'无踪闪避提高至36%，真实闪避回复35生命'
    })
  },
  phantom_step:{
    id:'phantom_step',name:'幻影步',rarity:'RARE',handler:'phantom_step',passive:true,maxLevel:9,coreSkill:true,
    tags:['shadow','afterimage',TAGS.NORMAL_ATTACK,TAGS.BUILD_AFTERIMAGE],cooldownMs:999999,targetType:'passive',color:0x8e83ff,short:'幻',
    description:'真实闪避生成持续6秒的残影；残影自动攻击，命中叠加短暂攻速。',
    levels:levels(PHANTOM_COUNTS.map((maxAfterimages,i)=>[maxAfterimages,PHANTOM_RATIOS[i]]),([maxAfterimages,damageRatio],level)=>({
      maxAfterimages,damageRatio,durationMs:6000,spawnCount:level>=3?2:1,hitAttackSpeedBonus:0.02,hitBuffMs:5000,maxStacks:level>=6?20:10,attackIntervalMs:900,
      desc:`每次闪避生成${level>=3?2:1}个残影，最多${maxAfterimages}个；残影攻击造成普攻${Math.round(damageRatio*100)}%伤害，命中叠加2%攻速，最多${level>=6?20:10}层，持续5秒。`
    }),{
      3:'重影：每次闪避生成2个残影，残影上限提高至3个',
      6:'疾影：攻速叠层上限提高至20层，残影上限提高至4个',
      9:'万影齐动：满残影时再次闪避会刷新全部残影至6秒，并让全部残影立即攻击一次'
    })
  }
};

export function configureAfterimageCoreSkills(){ Object.entries(AFTERIMAGE_CORE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

function normalAttackRoll(scene,ratio){
  const weapon=getWeapon(scene.playerData.weaponId);
  const profile=scene.professionSystem?.currentAttackProfile?.()||null;
  if(scene.combatSystem?.calcAttackDamage&&weapon){
    const result=scene.combatSystem.calcAttackDamage(weapon,profile,false,true);
    return {
      amount:Math.max(1,Math.round(result.damage*ratio)),
      meta:{
        critResolved:true,
        crit:!!result.crit,
        professionApplied:true,
        professionMultiplier:result.professionMult||1,
        baseAmountBeforeProfession:Math.max(1,Math.round((result.baseBeforeProfession||result.damage)*ratio))
      }
    };
  }
  const base=(scene.playerData.attack||1)*(1+sumBonuses(scene.playerData.attackDamageBonuses)+sumBonuses(scene.playerData.normalAttackDamageBonuses));
  const critChance=Math.max(0,Math.min(0.95,(scene.playerData.critChance||0)+sumBonuses(scene.playerData.physicalCritChanceBonuses)));
  const crit=Math.random()<critChance;
  const critMultiplier=crit?((scene.playerData.critMultiplier||1.5)+sumBonuses(scene.playerData.physicalCritMultiplierBonuses)):1;
  return {amount:Math.max(1,Math.round(base*critMultiplier*ratio)),meta:{critResolved:true,crit,professionApplied:true,professionMultiplier:1,baseAmountBeforeProfession:Math.max(1,Math.round(base*critMultiplier*ratio))}};
}
function clearPhantomBuff(scene,state){
  Reflect.deleteProperty(scene.playerData.attackSpeedMultiplierBonuses||{},'phantom_step');
  state.stackCount=0;
  state.stackExpiresAt=0;
  state.appliedStacks=-1;
}
function applyPhantomBuff(scene,state,data){
  scene.playerData.attackSpeedMultiplierBonuses??={};
  const now=scene.getGameplayTime();
  if(state.stackCount>0&&now>=state.stackExpiresAt){ state.stackCount=0; state.stackExpiresAt=0; }
  state.stackCount=Math.min(state.stackCount,data?.maxStacks||0);
  if(state.appliedStacks===state.stackCount) return;
  state.appliedStacks=state.stackCount;
  if(state.stackCount>0) scene.playerData.attackSpeedMultiplierBonuses.phantom_step=state.stackCount*(data.hitAttackSpeedBonus||0);
  else Reflect.deleteProperty(scene.playerData.attackSpeedMultiplierBonuses,'phantom_step');
}
function gainPhantomStack(scene,state,data){
  state.stackCount=Math.min(data.maxStacks,state.stackCount+1);
  state.stackExpiresAt=scene.getGameplayTime()+data.hitBuffMs;
  state.appliedStacks=-1;
  applyPhantomBuff(scene,state,data);
}
function targetForAfterimage(scene,afterimage){
  const current=scene.currentTarget;
  if(scene.targeting.valid(current)) return current;
  const x=afterimage.view?.x??scene.player.x;
  return scene.targeting.all().filter(enemy=>scene.targeting.valid(enemy)).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0]||null;
}
function attackFromAfterimage(system,state,afterimage,data){
  const scene=system.scene;
  if(!scene.afterimages?.getById?.(afterimage.id)||scene.playerData.hp<=0) return false;
  const target=targetForAfterimage(scene,afterimage);
  if(!target) return false;
  const targetX=target.x,targetY=target.y;
  const bonus=1+sumBonuses(scene.playerData.afterimageDamageBonuses);
  const roll=normalAttackRoll(scene,data.damageRatio*bonus);
  const damaged=scene.combatSystem.damageEnemy(target,roll.amount,{
    source:'skill',damageKind:'phantomStepAfterimage',skillId:'phantom_step',tags:['shadow','physical',TAGS.NORMAL_ATTACK,TAGS.BUILD_AFTERIMAGE],
    afterimage:true,allowLifeSteal:false,noKnockback:true,noInstantStep:true,noSwordTrigger:true,fromAfterimage:true,...roll.meta
  });
  if(damaged) gainPhantomStack(scene,state,data);
  const x=afterimage.view?.x??scene.player.x,y=afterimage.view?.y??scene.player.y-52;
  const slash=scene.add.rectangle(x+18,y,46,6,0xa9a3ff,0.58).setDepth(148); slash.rotation=-0.35;
  scene.tweens.add({targets:slash,x:targetX,y:targetY-45,alpha:0,duration:140,onComplete:()=>slash.destroy()});
  return !!damaged;
}

export const PhantomStepSkill={
  bind(system){
    const scene=system.scene;
    const state={stackCount:0,stackExpiresAt:0,appliedStacks:-1};
    const offDodge=scene.eventBus.on(CombatEvents.PLAYER_DODGED,()=>{
      const data=system.getData('phantom_step');
      if(!data||!scene.afterimages||scene.playerData.hp<=0) return;
      const now=scene.getGameplayTime();
      const owned=scene.afterimages.getAll().filter(afterimage=>afterimage.ownerSkillId==='phantom_step');
      if(owned.length>=data.maxAfterimages){
        if(system.getLevel('phantom_step')>=9){
          owned.forEach(afterimage=>{ afterimage.expiresAt=now+data.durationMs; });
          owned.slice().forEach(afterimage=>attackFromAfterimage(system,state,afterimage,data));
        }
        return;
      }
      const createCount=Math.min(data.spawnCount,data.maxAfterimages-owned.length);
      for(let i=0;i<createCount;i+=1){
        const afterimage=scene.afterimages.createAfterimage({ownerSkillId:'phantom_step',durationMs:data.durationMs,attackRatio:data.damageRatio,attackSpeedBonus:0,color:0x8e83ff});
        afterimage.nextAttackAt=now+120+i*50;
      }
    });
    const updater=()=>{
      const data=system.getData('phantom_step');
      if(!data){ clearPhantomBuff(scene,state); return; }
      applyPhantomBuff(scene,state,data);
      const now=scene.getGameplayTime();
      const attackSpeed=Math.max(0.2,(scene.playerData.attackSpeedMultiplier||1)+sumBonuses(scene.playerData.attackSpeedMultiplierBonuses));
      scene.afterimages?.getAll?.().filter(afterimage=>afterimage.ownerSkillId==='phantom_step').forEach(afterimage=>{
        if(now<(afterimage.nextAttackAt||0)) return;
        afterimage.nextAttackAt=now+Math.max(220,Math.round(data.attackIntervalMs/attackSpeed));
        attackFromAfterimage(system,state,afterimage,data);
      });
    };
    system.passiveUpdaters.push(updater);
    return ()=>{
      offDodge?.();
      clearPhantomBuff(scene,state);
      scene.afterimages?.getAll?.().filter(afterimage=>afterimage.ownerSkillId==='phantom_step').forEach(afterimage=>scene.afterimages.removeAfterimage(afterimage.id,'skillRemoved'));
      system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==updater);
    };
  }
};

export const TracelessSkill={
  bind(system){
    const scene=system.scene;
    const apply=()=>{
      const data=system.getData('traceless');
      scene.playerData.dodgeChanceBonuses??={};
      if(data) scene.playerData.dodgeChanceBonuses.traceless=data.dodgeChance||0;
      else Reflect.deleteProperty(scene.playerData.dodgeChanceBonuses,'traceless');
    };
    const offDodge=scene.eventBus.on(CombatEvents.PLAYER_DODGED,payload=>{
      const data=system.getData('traceless');
      if(!data||payload?.fromMyriadAfterimage||scene.playerData.hp<=0) return;
      const healed=scene.healPlayer?.(data.dodgeHeal,'traceless',{skillId:'traceless'})||0;
      if(healed>0) scene.floatText?.(scene.player.x,scene.player.y-116,`无踪 +${healed}`,'#d8b4fe');
    });
    system.passiveUpdaters.push(apply);
    apply();
    return ()=>{
      offDodge?.();
      Reflect.deleteProperty(scene.playerData.dodgeChanceBonuses||{},'traceless');
      system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==apply);
    };
  }
};
