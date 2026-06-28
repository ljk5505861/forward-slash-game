import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';

const levels = (values, build, milestones={}) => values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}),
}));
const sumBonuses = bonuses => Object.values(bonuses||{}).reduce((sum,value)=>sum+(Number(value)||0),0);

const PHANTOM_COUNTS=[2,2,3,3,3,4,4,4,5];
const PHANTOM_RATIOS=[0.40,0.46,0.52,0.58,0.64,0.70,0.78,0.86,0.95];
const TRACES_DODGE=[0.20,0.22,0.24,0.26,0.28,0.30,0.32,0.34,0.36];
const TRACES_HEAL=[5,7,10,13,16,20,24,29,35];

const AFTERIMAGE_CORE_SKILLS = {
  traceless: {
    id:'traceless', name:'无踪', rarity:'EPIC', handler:'traceless', passive:true, maxLevel:9,
    coreSkill:true,
    tags:['shadow','dodge',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0xa855f7, short:'踪',
    description:'永久提高闪避率；每次真实闪避立即回复固定生命，无内置冷却。',
    levels:levels(TRACES_DODGE.map((dodgeChance,i)=>[dodgeChance,TRACES_HEAL[i]]),([dodgeChance,dodgeHeal])=>({ dodgeChance,dodgeHeal,desc:`永久闪避率+${Math.round(dodgeChance*100)}%；真实闪避时回复${dodgeHeal}生命。` }),{
      3:'无踪闪避提高至24%，真实闪避回复10生命',
      6:'无踪闪避提高至30%，真实闪避回复20生命',
      9:'无踪闪避提高至36%，真实闪避回复35生命'
    })
  },
  phantom_step: {
    id:'phantom_step', name:'幻影步', rarity:'RARE', handler:'phantom_step', passive:true, maxLevel:9,
    coreSkill:true,
    tags:['shadow','afterimage',TAGS.NORMAL_ATTACK,TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0x8e83ff, short:'幻',
    description:'真实闪避生成持续6秒的残影；残影自动攻击，命中叠加短暂攻速。',
    levels:levels(PHANTOM_COUNTS.map((maxAfterimages,i)=>[maxAfterimages,PHANTOM_RATIOS[i]]),([maxAfterimages,damageRatio],level)=>({ maxAfterimages,damageRatio,durationMs:6000,hitAttackSpeedBonus:0.02,hitBuffMs:5000,maxStacks:level>=6?20:10,attackIntervalMs:900,desc:`最多${maxAfterimages}个残影，自动攻击造成普攻${Math.round(damageRatio*100)}%伤害；命中叠加2%攻速，最多${level>=6?20:10}层，持续5秒。` }),{
      3:'残影上限提高至3个，伤害提高至普攻52%',
      6:'残影上限提高至4个，攻速叠层上限提高至20层',
      9:'残影上限提高至5个，伤害提高至普攻95%'
    })
  }
};

export function configureAfterimageCoreSkills(){ Object.entries(AFTERIMAGE_CORE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

function cleanupPhantomBuff(s,state){ if(s.playerData.attackSpeedMultiplierBonuses) delete s.playerData.attackSpeedMultiplierBonuses.phantom_step; state.hitStacks=[]; state.appliedStacks=-1; }
function applyPhantomBuff(s,state,data){
  s.playerData.attackSpeedMultiplierBonuses??={};
  const now=s.getGameplayTime();
  state.hitStacks=state.hitStacks.filter(expiresAt=>expiresAt>now).slice(-data.maxStacks);
  if(state.appliedStacks===state.hitStacks.length) return;
  state.appliedStacks=state.hitStacks.length;
  if(state.appliedStacks>0) s.playerData.attackSpeedMultiplierBonuses.phantom_step=state.appliedStacks*data.hitAttackSpeedBonus;
  else delete s.playerData.attackSpeedMultiplierBonuses.phantom_step;
}
function targetForAfterimage(s,afterimage){ const x=afterimage.view?.x??s.player.x; return s.targeting.all().filter(e=>e.x>=x-40).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0]||null; }
function attackFromAfterimage(system,state,afterimage,data){
  const s=system.scene;
  if(!s.afterimages?.getById?.(afterimage.id)) return;
  const target=targetForAfterimage(s,afterimage);
  if(!target) return;
  const base=(s.playerData.attack||1)*(1+sumBonuses(s.playerData.attackDamageBonuses)+sumBonuses(s.playerData.normalAttackDamageBonuses));
  const amount=Math.max(1,Math.round(base*data.damageRatio*(1+sumBonuses(s.playerData.afterimageDamageBonuses))));
  const damaged=s.combatSystem.damageEnemy(target,amount,{ source:'skill', damageKind:'phantomStepAfterimage', skillId:'phantom_step', tags:['shadow','physical',TAGS.NORMAL_ATTACK,TAGS.BUILD_AFTERIMAGE], afterimage:true, allowLifeSteal:true, lifeStealScale:0.25, noKnockback:true, noInstantStep:true });
  if(damaged){ state.hitStacks.push(s.getGameplayTime()+data.hitBuffMs); applyPhantomBuff(s,state,data); }
  const x=afterimage.view?.x??s.player.x, y=afterimage.view?.y??s.player.y-52;
  const slash=s.add.rectangle(x+18,y,46,6,0xa9a3ff,0.58).setDepth(148); slash.rotation=-0.35;
  s.tweens.add({targets:slash,x:target.x,alpha:0,duration:140,onComplete:()=>slash.destroy()});
}

export const PhantomStepSkill={
  bind(system){
    const s=system.scene;
    const state={ hitStacks:[], appliedStacks:-1 };
    const offDodge=s.eventBus.on(CombatEvents.PLAYER_DODGED,()=>{
      const data=system.getData('phantom_step');
      if(!data||!s.afterimages) return;
      const owned=s.afterimages.getAll().filter(a=>a.ownerSkillId==='phantom_step');
      if(owned.length>=data.maxAfterimages) return;
      const a=s.afterimages.createAfterimage({ ownerSkillId:'phantom_step', durationMs:data.durationMs, attackRatio:data.damageRatio, attackSpeedBonus:0, color:0x8e83ff });
      a.nextAttackAt=s.getGameplayTime()+120;
    });
    const updater=()=>{
      const data=system.getData('phantom_step');
      if(!data){ cleanupPhantomBuff(s,state); return; }
      const now=s.getGameplayTime();
      applyPhantomBuff(s,state,data);
      s.afterimages?.getAll?.().filter(a=>a.ownerSkillId==='phantom_step').forEach(a=>{ if(now<(a.nextAttackAt||0)) return; a.nextAttackAt=now+Math.max(220,Math.round(data.attackIntervalMs/Math.max(0.2,(s.playerData.attackSpeedMultiplier||1)+sumBonuses(s.playerData.attackSpeedMultiplierBonuses)))); attackFromAfterimage(system,state,a,data); });
    };
    system.passiveUpdaters.push(updater);
    return ()=>{ offDodge?.(); cleanupPhantomBuff(s,state); system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==updater); };
  }
};

export const TracelessSkill={
  bind(system){
    const s=system.scene;
    let appliedDodge=0;
    const apply=()=>{ const data=system.getData('traceless'); s.playerData.dodgeChanceBonuses??={}; delete s.playerData.dodgeChanceBonuses.traceless; appliedDodge=0; if(data){ appliedDodge=data.dodgeChance; s.playerData.dodgeChanceBonuses.traceless=appliedDodge; } };
    const offDodge=s.eventBus.on(CombatEvents.PLAYER_DODGED,payload=>{ const data=system.getData('traceless'); if(!data||payload?.fromMyriadAfterimage) return; const healed=s.healPlayer?.(data.dodgeHeal,'traceless',{ skillId:'traceless' })||0; if(healed>0) s.floatText?.(s.player.x,s.player.y-116,`无踪 +${healed}`,'#d8b4fe'); });
    const updater=()=>apply();
    system.passiveUpdaters.push(updater); apply();
    return ()=>{ offDodge?.(); if(s.playerData.dodgeChanceBonuses) delete s.playerData.dodgeChanceBonuses.traceless; appliedDodge=0; system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==updater); };
  }
};
