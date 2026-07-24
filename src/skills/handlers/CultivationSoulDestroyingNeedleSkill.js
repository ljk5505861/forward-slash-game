import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';

export const SOUL_DESTROYING_NEEDLE_ID='soul_destroying_needle';
export const SOUL_DESTROYING_NEEDLE_LEVELS=[
  [72,5800,10],[80,5600,10],[90,5400,10],[101,5200,11],[113,5000,11],[126,4800,12],[141,4600,12],[157,4400,13],[175,4200,14]
].map(([damage,cooldownMs,manaCost],index)=>({damage,cooldownMs,manaCost,flightMs:180,needleCount:index===8?3:1,desc:index===0?'凝聚灭神针攻击当前威胁最高的敌人，造成高额单体修仙法术伤害。':'灭神针伤害、冷却或耗蓝成长。',milestoneText:index===2?'追魂索命':index===5?'破神':index===8?'三针灭神':undefined}));
const now=s=>s.getGameplayTime?.()??s.now??0;
const alive=e=>!!e&&e.active!==false&&!e.isDefeated&&!e.dead&&Number(e.hp)>0;
const rank=e=>e.isBoss?2:e.isElite?1:0;
const valid=(s,e)=>alive(e)&&s?.targeting?.valid?.(e)!==false&&s?.targeting?.isEnemyFullyInsideViewport?.(e)!==false;
const destroy=(system,node)=>{ system.scene?.tweens?.killTweensOf?.(node); node?.destroy?.(); };
const remove=(arr,node)=>{ const i=arr.indexOf(node); if(i>=0) arr.splice(i,1); };
export function selectSoulDestroyingNeedleTarget(systemOrScene){
  const s=systemOrScene?.scene||systemOrScene, p=s?.player||{x:0,y:0};
  const enemies=(s?.targeting?.all?.()||s?.enemies||[]).filter(e=>valid(s,e));
  enemies.sort((a,b)=>rank(b)-rank(a)||(b.hp||0)-(a.hp||0)||Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)||(a.x||0)-(b.x||0)||(a.y||0)-(b.y||0));
  return enemies[0]||null;
}
function addVisual(active,node){ if(node) active.visuals.push(node); return node; }
function transient(system,active,x,y,level){
  const flash=addVisual(active,system.scene?.add?.circle?.(x,y,18,0xfbbf24,.45)?.setStrokeStyle?.(2,0xd8b4fe,.9)?.setDepth?.(150));
  system.scene?.tweens?.add?.({targets:flash,alpha:0,scaleX:1.45,scaleY:1.45,duration:220,onComplete:()=>{remove(active.visuals,flash);destroy(system,flash);}});
  [-1,0,1].forEach(i=>{const crack=addVisual(active,system.scene?.add?.line?.(0,0,x+i*7,y-10,x+i*12,y+12,0xd8b4fe,level>=6?.9:.6)?.setOrigin?.(0)?.setLineWidth?.(2,2)?.setDepth?.(151)); system.scene?.tweens?.add?.({targets:crack,alpha:0,duration:220,onComplete:()=>{remove(active.visuals,crack);destroy(system,crack);}});});
}
function needleVisual(system,active,x,y){
  const n=addVisual(active,system.scene?.add?.rectangle?.(x,y,30,4,0xfbbf24,.95)?.setStrokeStyle?.(1,0xd8b4fe,.95)?.setDepth?.(149));
  return n;
}
function targetFor(system,needle,level){ return valid(system.scene,needle.target)?needle.target:(level>=3?selectSoulDestroyingNeedleTarget(system):null); }
function resolve(system,active,needle){
  if(needle.resolved) return; const target=targetFor(system,needle,active.level); needle.resolved=true;
  if(!target){ destroy(system,needle.visual); remove(active.visuals,needle.visual); return; }
  needle.target=target; const base=active.data.damage*needle.damageRatio*(target.isElite||target.isBoss?1.2:1);
  system.hit(target,system.damageValue(base,active.ctx),active.cfg,active.level,active.ctx,system.baseDamageValue(base,active.ctx),[TAGS.MAGIC,TAGS.SPELL,TAGS.PROJECTILE,TAGS.CULTIVATION],{defenseIgnore:active.level>=6?.5:0,damageTextColor:'#d8b4fe'});
  transient(system,active,target.x,target.y,active.level); destroy(system,needle.visual); remove(active.visuals,needle.visual);
}
function launch(system,active,needle,t){
  const target=targetFor(system,needle,active.level); if(!target){ needle.resolved=true; return; }
  needle.target=target; needle.launched=true; needle.launchedAt=t; needle.hitAt=t+active.data.flightMs;
  const p=system.scene.player||{x:0,y:0}; needle.startX=p.x-24; needle.startY=p.y-72+(needle.index-1)*12; needle.visual=needleVisual(system,active,needle.startX,needle.startY);
}
function cleanup(system,active){ if(active.ended) return; active.ended=true; active.visuals.forEach(v=>destroy(system,v)); active.visuals.length=0; }
function tick(system,active){
  const t=now(system.scene); active.nextAt=t;
  active.needles.forEach(n=>{ if(n.resolved) return; if(!n.launched){ if(t>=n.fireAt) launch(system,active,n,t); return; }
    const target=targetFor(system,n,active.level); if(!target){ n.resolved=true; destroy(system,n.visual); remove(active.visuals,n.visual); return; } n.target=target;
    const progress=Math.max(0,Math.min(1,(t-n.launchedAt)/active.data.flightMs)); const x=n.startX+(target.x-n.startX)*progress,y=n.startY+(target.y-n.startY)*progress; n.visual?.setPosition?.(x,y); n.visual?.setRotation?.(Math.atan2(target.y-n.startY,target.x-n.startX)); if(t>=n.hitAt) resolve(system,active,n);
  });
  if(active.needles.every(n=>n.resolved)&&t>=active.endAt) cleanup(system,active);
}
export const SoulDestroyingNeedleSkill={
  canCast(system){ return !!selectSoulDestroyingNeedleTarget(system); },
  cast(system,cfg,data,level,ctx={}){ const initial=selectSoulDestroyingNeedleTarget(system); if(!initial) return false; const t=now(system.scene), ratios=level>=9?[1,.6,.6]:[1]; const active={skillId:SOUL_DESTROYING_NEEDLE_ID,cfg,data,level,ctx,needles:ratios.map((damageRatio,index)=>({index,damageRatio,fireAt:t+index*160,hitAt:t+index*160+data.flightMs,launchedAt:null,target:initial,launched:false,resolved:false,visual:null,startX:0,startY:0})),nextAt:t,endAt:t+(level>=9?500:180)+260,visuals:[],ended:false,tick(){tick(system,this);},onEnd(){cleanup(system,this);}}; const p=system.scene.player||{x:0,y:0}; addVisual(active,system.scene?.add?.circle?.(p.x-24,p.y-72,20,0xfbbf24,.18)?.setStrokeStyle?.(2,0xd8b4fe,.65)?.setDepth?.(140)); system.active.push(active); tick(system,active); return active; },
  shiftTimers(system,duration,pausedAt){ system.active.filter(a=>a.skillId===SOUL_DESTROYING_NEEDLE_ID).forEach(a=>a.needles.forEach(n=>{if(!n.launched){if(n.fireAt>pausedAt)n.fireAt+=duration;if(n.hitAt>pausedAt)n.hitAt+=duration;}else if(!n.resolved&&n.launchedAt<=pausedAt&&n.hitAt>pausedAt){n.launchedAt+=duration;n.hitAt+=duration;}})); },
  cleanup(system){ system.active.filter(a=>a.skillId===SOUL_DESTROYING_NEEDLE_ID).forEach(a=>a.onEnd?.('cleanup')); }
};
export function configureCultivationSoulDestroyingNeedleSkill(){ SKILLS[SOUL_DESTROYING_NEEDLE_ID]={id:SOUL_DESTROYING_NEEDLE_ID,name:'灭神针',rarity:'EPIC',type:'主动单体修仙法术',maxLevel:9,passive:false,targetType:'random',handler:SOUL_DESTROYING_NEEDLE_ID,short:'针',color:0xd8b4fe,tags:[TAGS.MAGIC,TAGS.SPELL,TAGS.PROJECTILE,TAGS.ACTIVE_SKILL,TAGS.CULTIVATION,TAGS.BUILD_CULTIVATION],description:'凝聚灭神针攻击当前威胁最高的敌人，造成高额单体修仙法术伤害。伤害、冷却和法力消耗随九转大道境界提升。',milestones:{3:'追魂索命：灭神针飞行途中若目标死亡或失效，会自动追踪新的威胁目标。',6:'破神：灭神针忽略目标50%防御，并对精英和Boss额外造成20%伤害。',9:'三针灭神：一次施法连续射出三根灭神针，第二、第三根分别造成60%伤害。'},levels:SOUL_DESTROYING_NEEDLE_LEVELS}; }
