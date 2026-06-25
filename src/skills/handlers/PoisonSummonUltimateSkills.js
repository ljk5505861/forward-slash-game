import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

const SKILL_ID='plague_mother';
const levels=(values,build,milestones={})=>values.map((value,index)=>({ ...build(value,index+1), ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}) }));
const removeUpdater=(system,updater)=>{ const index=system.passiveUpdaters.indexOf(updater); if(index>=0) system.passiveUpdaters.splice(index,1); };
const dist=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));

const CONFIG={
  id:SKILL_ID,name:'瘟疫母体',rarity:'EPIC',handler:SKILL_ID,passive:true,ultimateSkill:true,maxLevel:9,requiredSkillId:'poison_king',
  tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],cooldownMs:999999,targetType:'passive',color:0xd64b5f,short:'疫',
  description:'让感染网络自行繁殖：毒伤传播、寄生爆发、毒链补位、毒虫播种，并在毒王存在时强化扩散。',
  levels:levels([
    [0.04,125,1,280,1,5200],[0.045,130,1,290,1,5000],[0.055,140,1,300,1,4800],
    [0.06,145,1,310,1,4600],[0.065,150,1,320,1,4400],[0.075,160,2,335,1,4200],
    [0.08,170,2,350,1,4000],[0.09,180,2,365,1,3800],[0.10,195,2,380,2,3400]
  ],([spreadChance,spreadRadius,spreadTargets,parasiteBurstRadius,insectPoisonStacks,reviveIntervalMs])=>({
    spreadChance,spreadRadius,spreadTargets,parasiteBurstRadius,insectPoisonStacks,reviveIntervalMs,
    kingChanceBonus:0.05,kingRadiusBonus:70,basePoisonMs:3200,basePoisonDamage:3,basePoisonIntervalMs:700,
    desc:`感染网络自动繁殖；毒伤传播概率${Math.round(spreadChance*100)}%，寄生宿主死亡感染${parasiteBurstRadius}范围。`
  }),{3:'感染扩散\n持续毒伤有概率传播基础中毒。',6:'寄生繁殖\n寄生宿主死亡后留下临时感染源，并强化大范围感染。',9:'瘟疫不灭\n感染体系仍有任意源头时，周期性寻找新宿主重新播种。'})
};

export function configurePoisonSummonUltimateSkills(){ SKILLS[SKILL_ID]={...CONFIG}; }

function validEnemies(scene){ return scene.targeting.all().filter(e=>scene.targeting.valid(e)); }
function addBasePoison(scene,data,target,stacks=1,source='plague_mother'){
  if(!scene.targeting.valid(target)) return false;
  scene.statusEffects.add(StatusEffects.POISON,target,{ durationMs:data.basePoisonMs,intervalMs:data.basePoisonIntervalMs,value:data.basePoisonDamage,stacks,maxStacks:18,sourceId:`${source}_${scene.getGameplayTime()}_${target.id||target.name||''}`,noPoisonKingBurst:true,noPoisonKingRecursive:true });
  return true;
}

export const PlagueMotherSkill={ bind(system){
  const s=system.scene;
  const processedTicks=new Set();
  const processedDeaths=new WeakSet();
  const temporarySources=[];
  let insectCount=0;
  let nextReviveAt=0;

  const runtime={
    active:true,
    getLevel(){ return system.getLevel(SKILL_ID); },
    hasKing(){ return !!s.poisonSummonRuntime?.hasPoisonKing?.(); },
    setInsectCount(count){ insectCount=Math.max(0,Number(count)||0); },
    canInfectUnpoisoned(){ return this.active&&this.getLevel()>0; },
    infectFromInsect(target){ const data=system.getData(SKILL_ID); if(!data||s.statusEffects.has(target,StatusEffects.POISON)) return false; return addBasePoison(s,data,target,data.insectPoisonStacks,'plague_insect'); },
    onParasiticHostDeath(enemy){
      const data=system.getData(SKILL_ID); if(!data||!enemy||processedDeaths.has(enemy)) return;
      processedDeaths.add(enemy);
      const radius=data.parasiteBurstRadius+(this.hasKing()?data.kingRadiusBonus:0);
      const targets=validEnemies(s).filter(e=>e!==enemy&&dist(e,enemy)<=radius).sort((a,b)=>dist(a,enemy)-dist(b,enemy));
      targets.forEach(target=>addBasePoison(s,data,target,system.getLevel(SKILL_ID)>=6?2:1,'plague_parasite'));
      if(system.getLevel(SKILL_ID)>=6){ temporarySources.push({x:enemy.x,y:enemy.y,expiresAt:s.getGameplayTime()+5200,nextPulseAt:s.getGameplayTime()+900}); }
      const ring=s.add.circle(enemy.x,enemy.y,radius,0x8ce86b,0.08).setStrokeStyle(4,0xbaff8c,0.72).setDepth(149);
      s.tweens.add({targets:ring,alpha:0,scale:1.12,duration:420,onComplete:()=>ring.destroy()});
    }
  };
  s.plagueMotherRuntime=runtime;

  const offTick=s.eventBus.on(CombatEvents.STATUS_TICK,p=>{
    const data=system.getData(SKILL_ID), level=system.getLevel(SKILL_ID); if(!data||p.type!==StatusEffects.POISON||p.actualDamage<=0||!s.targeting.valid(p.target)) return;
    if(level<3||p.effect?.sourceId?.startsWith('plague_spread_')) return;
    const key=`${p.statusId||p.effect?.id}:${p.effect?.nextTickAt||s.getGameplayTime()}:${p.target.id||''}`; if(processedTicks.has(key)) return; processedTicks.add(key); if(processedTicks.size>400) processedTicks.clear();
    const chance=Math.min(0.35,data.spreadChance+(runtime.hasKing()?data.kingChanceBonus:0)); if(Math.random()>=chance) return;
    const radius=data.spreadRadius+(runtime.hasKing()?data.kingRadiusBonus:0);
    const targets=validEnemies(s).filter(e=>e!==p.target&&!s.statusEffects.has(e,StatusEffects.POISON)&&dist(e,p.target)<=radius).sort((a,b)=>dist(a,p.target)-dist(b,p.target)).slice(0,data.spreadTargets);
    targets.forEach(target=>addBasePoison(s,data,target,1,'plague_spread'));
  });

  const offKill=s.eventBus.on(CombatEvents.ENEMY_KILLED,p=>{
    const data=system.getData(SKILL_ID), enemy=p?.enemy; if(!data||!enemy) return;
    const chainRuntime=s.poisonSummonRuntime;
    const chainMap=chainRuntime?.recentPoisonChainTargets;
    if(!chainMap?.has(enemy)) return;
    chainMap.delete(enemy);
    const chainTargets=chainRuntime.getRecentPoisonChainTargets?.()||[];
    const replacement=validEnemies(s).filter(e=>e!==enemy&&!chainTargets.includes(e)).sort((a,b)=>s.statusEffects.getStackCount(a,StatusEffects.POISON)-s.statusEffects.getStackCount(b,StatusEffects.POISON)||Math.abs(a.x-s.player.x)-Math.abs(b.x-s.player.x))[0];
    if(replacement){ addBasePoison(s,data,replacement,1,'plague_chain_repair'); chainRuntime.recordPoisonChainTarget?.(replacement,s.getGameplayTime()); s.floatText?.(replacement.x,replacement.y-105,'毒链补位','#82ff8f'); }
  });

  const updater=()=>{
    const data=system.getData(SKILL_ID); if(!data) return;
    const now=s.getGameplayTime();
    for(let i=temporarySources.length-1;i>=0;i--){ const source=temporarySources[i]; if(now>=source.expiresAt){ temporarySources.splice(i,1); continue; } if(now<source.nextPulseAt) continue; source.nextPulseAt=now+900; validEnemies(s).filter(e=>dist(e,source)<=170).slice(0,3).forEach(e=>addBasePoison(s,data,e,1,'plague_larva')); }
    if(system.getLevel(SKILL_ID)<9||now<nextReviveAt) return;
    const enemies=validEnemies(s); if(!enemies.length) return;
    const infected=enemies.filter(e=>s.statusEffects.has(e,StatusEffects.POISON));
    const gu=s.poisonSummonRuntime?.getParasiticGuSnapshot?.();
    const hasSource=infected.length>0||!!(gu?.host&&s.targeting.valid(gu.host))||insectCount>0||runtime.hasKing()||temporarySources.length>0;
    if(!hasSource) return;
    nextReviveAt=now+data.reviveIntervalMs;
    const target=enemies.filter(e=>!s.statusEffects.has(e,StatusEffects.POISON)).sort((a,b)=>Math.abs(a.x-s.player.x)-Math.abs(b.x-s.player.x))[0]||infected.sort((a,b)=>s.statusEffects.getStackCount(a,StatusEffects.POISON)-s.statusEffects.getStackCount(b,StatusEffects.POISON))[0];
    if(target){ addBasePoison(s,data,target,2,'plague_undying'); s.floatText?.(target.x,target.y-108,'瘟疫不灭','#ff8fa0'); }
  };
  system.passiveUpdaters.push(updater);

  return ()=>{ offTick?.(); offKill?.(); removeUpdater(system,updater); runtime.active=false; temporarySources.length=0; if(s.plagueMotherRuntime===runtime) s.plagueMotherRuntime=null; };
} };
