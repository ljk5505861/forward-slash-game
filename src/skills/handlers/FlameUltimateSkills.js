import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

const SKILL_ID='eternal_flame_heart';
const SPREAD_SOURCE_ID='eternal_flame_spread';
const levels=(values,build,milestones={})=>values.map((value,index)=>({ ...build(value,index+1), ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}) }));
const removeUpdater=(system,updater)=>{ const index=system.passiveUpdaters.indexOf(updater); if(index>=0) system.passiveUpdaters.splice(index,1); };

const CONFIG={
  id:SKILL_ID,name:'永燃之心',rarity:'EPIC',handler:SKILL_ID,passive:true,ultimateSkill:true,maxLevel:9,requiredSkillId:'meteor',
  tags:[TAGS.FIRE,TAGS.DOT,TAGS.BUILD_FIRE],cooldownMs:999999,targetType:'passive',color:0xfff0b0,short:'永',
  description:'高层燃烧化为永燃之火，持续维持火势；永燃目标死亡时将火焰传向周围敌人，陨石更容易直接点燃永燃之火。',
  levels:levels([
    [10,300,8000,0.15,160,150,2,2,2],
    [10,350,8500,0.18,176,160,2,2,2],
    [9,400,9000,0.21,192,170,2,2,2],
    [9,450,9500,0.24,210,180,3,3,2],
    [8,500,10000,0.27,230,190,3,3,2],
    [7,550,10500,0.31,250,205,3,3,3],
    [7,600,11000,0.34,270,215,4,3,3],
    [6,650,11500,0.37,284,225,4,4,3],
    [6,700,12000,0.40,300,230,4,4,3]
  ],([burnStackThreshold,extendPerTickMs,maxRemainingMs,pulseRatio,pulseDamageCap,spreadRadius,spreadTargetCount,spreadBurnStacks,maxSpreadDepth])=>({
    burnStackThreshold,extendPerTickMs,maxRemainingMs,pulseRatio,pulseDamageCap,spreadRadius,spreadTargetCount,spreadBurnStacks,maxSpreadDepth,
    spreadBurnMs:4200,spreadIntervalMs:600,maxStacks:18,
    desc:`总燃烧达到${burnStackThreshold}层时化为永燃；燃烧跳伤延长火势并追加${Math.round(pulseRatio*100)}%跳伤，死亡传播至最多${spreadTargetCount}名敌人。`
  }),{3:'永燃阈值降至9层',6:'永燃阈值降至7层，传播深度提升',9:'永燃阈值降至6层，传播最多4名敌人'})
};

export function configureFlameUltimateSkills(){ SKILLS[SKILL_ID]={...CONFIG}; }

function isValidEnemy(scene,enemy){ return !!enemy&&!enemy.isDefeated&&scene.targeting?.valid?.(enemy); }
function burnStacks(scene,enemy){ return scene.statusEffects?.getStackCount?.(enemy,StatusEffects.BURN)||0; }
function burnEffects(scene,enemy){ return scene.statusEffects?.getEffects?.(enemy,StatusEffects.BURN)||[]; }

export const EternalFlameHeartSkill={ bind(system){
  const s=system.scene;
  const eternal=new WeakSet();
  const spreadDeaths=new WeakSet();
  const markers=new Map();
  const visuals=new Set();
  const processedTicks=new Set();

  const destroyVisual=obj=>{ obj?.destroy?.(); visuals.delete(obj); };
  const addVisual=obj=>{ if(obj) visuals.add(obj); return obj; };
  const cleanupMarker=enemy=>{ const marker=markers.get(enemy); marker?.destroy?.(); markers.delete(enemy); };
  const markEternal=(enemy)=>{
    const data=system.getData(SKILL_ID); if(!data||!isValidEnemy(s,enemy)||eternal.has(enemy)) return false;
    if(burnStacks(s,enemy)<data.burnStackThreshold) return false;
    eternal.add(enemy);
    s.floatText(enemy.x,enemy.y-112,'永燃','#fff1b8');
    const marker=s.add.circle(enemy.x,enemy.y-52,28,0xfff3c0,0.12).setStrokeStyle(4,0xff8a33,0.95).setDepth(151);
    markers.set(enemy,marker);
    return true;
  };
  const checkFromStatus=payload=>{ if(payload?.type===StatusEffects.BURN) markEternal(payload.target); };

  const offApplied=s.eventBus.on(CombatEvents.STATUS_APPLIED,checkFromStatus);
  const offChanged=s.eventBus.on(CombatEvents.STATUS_STACK_CHANGED,checkFromStatus);
  const offTick=s.eventBus.on(CombatEvents.STATUS_TICK,p=>{
    const data=system.getData(SKILL_ID); if(!data||p.type!==StatusEffects.BURN||!isValidEnemy(s,p.target)||!p.effect||p.actualDamage<=0) return;
    markEternal(p.target);
    if(!eternal.has(p.target)) return;
    const tickKey=`${p.statusId||p.effect.id}:${p.effect.nextTickAt||s.getGameplayTime()}:${p.target.id||''}`;
    if(processedTicks.has(tickKey)) return;
    processedTicks.add(tickKey);
    if(processedTicks.size>512) processedTicks.clear();
    const now=s.getGameplayTime();
    burnEffects(s,p.target).forEach(effect=>{ effect.expiresAt=Math.min(now+data.maxRemainingMs,(effect.expiresAt||now)+data.extendPerTickMs); });
    if(p.effect.noEternalBurnPulse||p.noEternalBurnPulse) return;
    const pulse=Math.min(data.pulseDamageCap,Math.max(1,Math.round(p.actualDamage*data.pulseRatio)));
    s.combatSystem.damageEnemy(p.target,pulse,{ source:'skill', skillId:SKILL_ID, damageKind:'eternalBurnPulse', tags:[TAGS.FIRE,TAGS.DOT,TAGS.BUILD_FIRE], allowLifeSteal:false, noKnockback:true, noEternalBurnPulse:true, noEternalSpread:true, professionApplied:true, professionMultiplier:1, baseAmountBeforeProfession:pulse });
  });

  const spreadFromDeath=(payload)=>{
    const data=system.getData(SKILL_ID), enemy=payload?.enemy, snapshot=payload?.burnSnapshotBeforeDeath;
    if(!data||!enemy||!eternal.has(enemy)||spreadDeaths.has(enemy)||payload.noEternalSpread||!snapshot) return;
    if((payload.burnStacksBeforeDeath||0)<data.burnStackThreshold) return;
    const depth=Number.isFinite(snapshot.eternalSpreadDepth)?snapshot.eternalSpreadDepth:0;
    if(depth>=data.maxSpreadDepth) return;
    spreadDeaths.add(enemy);
    const nextDepth=depth+1;
    const targets=s.targeting.all().filter(t=>t!==enemy&&isValidEnemy(s,t)&&Math.hypot(t.x-enemy.x,t.y-enemy.y)<=data.spreadRadius)
      .sort((a,b)=>{ const ab=burnStacks(s,a)>0?1:0, bb=burnStacks(s,b)>0?1:0; if(ab!==bb) return ab-bb; return Math.hypot(a.x-enemy.x,a.y-enemy.y)-Math.hypot(b.x-enemy.x,b.y-enemy.y); })
      .slice(0,data.spreadTargetCount);
    if(!targets.length) return;
    const ring=addVisual(s.add.circle(enemy.x,enemy.y-44,data.spreadRadius,0xff7b2f,0.10).setStrokeStyle(4,0xfff0b0,0.65).setDepth(150));
    s.tweens.add({targets:ring,alpha:0,scale:1.08,duration:280,onComplete:()=>destroyVisual(ring)});
    targets.forEach(target=>{
      s.statusEffects.add(StatusEffects.BURN,target,{ durationMs:data.spreadBurnMs,intervalMs:snapshot.intervalMs||data.spreadIntervalMs,value:snapshot.value||4,stacks:data.spreadBurnStacks,maxStacks:data.maxStacks,sourceId:SPREAD_SOURCE_ID,damageMultiplier:snapshot.damageMultiplier||1,baseDamageMultiplierWithoutProfession:snapshot.baseDamageMultiplierWithoutProfession||snapshot.damageMultiplier||1,professionMultiplier:snapshot.professionMultiplier||1,professionApplied:!!snapshot.professionApplied,eternalSpreadDepth:nextDepth });
      const line=addVisual(s.add.line(0,0,enemy.x,enemy.y-50,target.x,target.y-50,0xfff0b0,0.9).setOrigin(0,0).setLineWidth(4).setDepth(151));
      s.tweens.add({targets:line,alpha:0,duration:240,onComplete:()=>destroyVisual(line)});
      markEternal(target);
    });
  };
  const offKilled=s.eventBus.on(CombatEvents.ENEMY_KILLED,spreadFromDeath);

  const updater=()=>{
    const data=system.getData(SKILL_ID); if(!data){ markers.forEach(m=>m.destroy?.()); markers.clear(); return; }
    markers.forEach((marker,enemy)=>{ if(!isValidEnemy(s,enemy)){ cleanupMarker(enemy); return; } marker.setPosition(enemy.x,enemy.y-52); });
  };
  system.passiveUpdaters.push(updater);

  return ()=>{ offApplied?.(); offChanged?.(); offTick?.(); offKilled?.(); removeUpdater(system,updater); markers.forEach(m=>m.destroy?.()); markers.clear(); visuals.forEach(v=>v.destroy?.()); visuals.clear(); processedTicks.clear(); };
} };
