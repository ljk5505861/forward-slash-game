import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { applyEnemyGravity } from '../../systems/EnemyGravityControl.js';
import { rangeValue } from '../../systems/ActiveSkillModifierSystem.js';

export const SKY_COVERING_PALM_ID='sky_covering_palm';
export const SKY_COVERING_PALM_LEVELS=[
  {damage:48,radius:110,cooldownMs:6500,manaCost:12},{damage:54,radius:115,cooldownMs:6300,manaCost:12},{damage:62,radius:130,cooldownMs:6100,manaCost:12},
  {damage:71,radius:135,cooldownMs:5900,manaCost:13},{damage:81,radius:145,cooldownMs:5700,manaCost:13},{damage:93,radius:155,cooldownMs:5400,manaCost:13},
  {damage:106,radius:165,cooldownMs:5200,manaCost:14},{damage:121,radius:175,cooldownMs:5000,manaCost:14},{damage:138,radius:185,cooldownMs:4600,manaCost:15}
].map((l,i)=>({warningMs:600,palmRippleDelayMs:250,palmRippleDamageRatio:.4,palmRippleRadiusRatio:1.35,shatterDelayMs:450,shatterDamageRatio:.7,shatterRadiusRatio:1.25,...l,desc:i===0?'在可视范围内最密集敌群上方凝聚弥天大手印，短暂蓄势后拍落，造成大范围修仙法术伤害。':'弥天大手印伤害、范围、冷却或耗蓝成长。',milestoneText:i===2?'掌纹震荡':i===5?'镇压山河':i===8?'一掌遮天':undefined}));
const alive=e=>!!e&&e.active!==false&&!e.isDefeated&&e.hp>0;
const now=s=>s.getGameplayTime?.()??s.now??0;
const validEnemies=s=>(s.enemies||s.targeting?.all?.()||[]).filter(e=>alive(e)&&s.targeting?.valid?.(e)!==false&&s.targeting?.isEnemyFullyInsideViewport?.(e)!==false);
const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
function destroyVisuals(system,visuals=[]){ visuals.forEach(v=>{ system.scene?.tweens?.killTweensOf?.(v); v?.destroy?.(); }); visuals.length=0; }
function addVisual(arr,node){ if(node) arr.push(node); return node; }
function removeVisual(arr,node){ const index=arr.indexOf(node); if(index>=0) arr.splice(index,1); }
function nodeContainer(scene,x,y){ return scene.add?.container?.(x,y)||null; }
function palmVisual(scene,center,radius,visuals){
  const palm=nodeContainer(scene,center.x,center.y-180), parts=[];
  const addPart=node=>{ if(node){ parts.push(node); palm?.add?.(node); } return node; };
  const size=Math.max(36,radius*.42), gold=0xf59e0b, red=0xb91c1c;
  addPart(scene.add?.ellipse?.(0,15,size*1.22,size*.92,gold,.34)?.setStrokeStyle?.(3,0xfacc15,.7));
  addPart(scene.add?.rectangle?.(0,size*.64,size*.52,size*.55,red,.34)?.setStrokeStyle?.(2,0xfacc15,.55));
  [-.58,-.29,0,.29,.58].forEach((offset,index)=>{
    const fingerLength=size*(index===2?1.36:index===1||index===3?1.2:1.03);
    addPart(scene.add?.ellipse?.(offset*size*1.6,-size*.5-fingerLength*.27,size*.28,fingerLength,gold,.36)?.setStrokeStyle?.(2,0xfacc15,.62));
  });
  if(!palm) parts.forEach(part=>addVisual(visuals,part));
  else addVisual(visuals,palm);
  return palm||parts[0];
}
function drawWarning(system,active){
  const s=system.scene,c=active.lockedCenter,r=active.finalRadius,v=active.visuals;
  addVisual(v,s.add?.circle?.(c.x,c.y,r,0x7f1d1d,.18)?.setStrokeStyle?.(3,0xf59e0b,.45)?.setDepth?.(18));
  const palm=palmVisual(s,c,r,v); palm?.setDepth?.(20); active.palmVisual=palm;
  s.tweens?.add?.({targets:palm,y:c.y-20,scaleX:1.35,scaleY:1.35,alpha:.62,duration:active.data.warningMs});
}
function transient(system,active,r,color=0xf59e0b,alpha=.28){ const n=addVisual(active.visuals,system.scene.add?.circle?.(active.lockedCenter.x,active.lockedCenter.y,r,color,alpha)?.setStrokeStyle?.(2,0xffd166,.55)?.setDepth?.(21)); system.scene.tweens?.add?.({targets:n,alpha:0,scaleX:1.2,scaleY:1.2,duration:260,onComplete:()=>{ removeVisual(active.visuals,n); n?.destroy?.(); }}); }
function rippleVisual(system,active){
  const s=system.scene,c=active.lockedCenter,r=active.finalRadius*.72, palm=nodeContainer(s,c.x,c.y);
  const pieces=[];
  [-.58,-.29,0,.29,.58].forEach((offset,index)=>{ const length=r*(index===2?1.35:index===1||index===3?1.2:1.05); const n=s.add?.ellipse?.(offset*r*.9,-length*.12,r*.16,length,0xdc2626,.12)?.setStrokeStyle?.(2,0xfacc15,.65); if(n){ pieces.push(n); palm?.add?.(n); } });
  if(palm) addVisual(active.visuals,palm); else pieces.forEach(n=>addVisual(active.visuals,n));
  s.tweens?.add?.({targets:palm||pieces,scaleX:1.8,scaleY:1.8,alpha:0,duration:260,onComplete:()=>{ if(palm){ removeVisual(active.visuals,palm); palm.destroy?.(); } else pieces.forEach(n=>{ removeVisual(active.visuals,n); n.destroy?.(); }); }});
}
function crackVisual(system,active){
  const s=system.scene,c=active.lockedCenter,r=active.finalRadius*.48;
  [-.48,-.16,.16,.48].forEach(offset=>{
    const x=c.x+offset*r;
    const line=s.add?.line?.(0,0,x-r*.14,c.y-r*.14,x+r*.12,c.y+r*.34,0xffd166,.85);
    line?.setOrigin?.(0);
    line?.setLineWidth?.(2,2);
    line?.setDepth?.(22);
    addVisual(active.visuals,line);
    s.tweens?.add?.({targets:line,alpha:0,duration:260,onComplete:()=>{ removeVisual(active.visuals,line); line?.destroy?.(); }});
  });
}
function applySuppression(system,active,e){
  if(!alive(e)||e.isBoss) return;
  const t=now(system.scene), elite=!!e.isElite;
  applyEnemyGravity(e,{sourceId:'sky_covering_palm_suppression',moveSlow:elite?.15:.30,attackSlow:elite?.12:.25,expiresAt:t+(elite?2000:2500),countsAsGravitySuppression:false});
  const ring=addVisual(active.visuals,system.scene.add?.circle?.(e.x,e.y+(e.height||80)/2,Math.max(18,(e.width||50)*.42),0xb91c1c,.16)?.setDepth?.(19));
  if(ring) ring.skyCoveringPalmSuppressionVisual=true;
  system.scene.tweens?.add?.({targets:ring,alpha:0,duration:350,onComplete:()=>{ removeVisual(active.visuals,ring); ring?.destroy?.(); }});
}
function enemiesIn(system,center,radius){ return validEnemies(system.scene).filter(e=>dist(e.x,e.y,center.x,center.y)<=radius); }
function damagePhase(system,active,ratio,radius,kind,suppress=false){ const {cfg,data,level,ctx}=active,base=data.damage*ratio; enemiesIn(system,active.lockedCenter,radius).forEach(enemy=>{ const target=enemy; if(!alive(target)) return; const ok=system.hit(target,system.damageValue(base,ctx),cfg,level,ctx,system.baseDamageValue(base,ctx),[TAGS.MAGIC,TAGS.SPELL,TAGS.CULTIVATION,'area']); if(ok&&suppress) applySuppression(system,active,target); }); active.phaseLog?.push?.({kind,castId:ctx.castId,ctx}); }
function endActive(active,system){ if(active.ended) return; destroyVisuals(system,active.visuals||[]); active.ended=true; }
function tickPalm(system,active){
  const t=now(system.scene);
  if(!active.mainResolved&&t>=active.mainAt){ active.mainResolved=true; damagePhase(system,active,1,active.finalRadius,'main',active.level>=6); active.palmVisual?.setFillStyle?.(0xf59e0b,.52); transient(system,active,active.finalRadius,0xf59e0b,.32); system.scene.cameras?.main?.shake?.(80,.002); }
  if(active.level>=3&&!active.rippleResolved&&t>=active.rippleAt){ active.rippleResolved=true; rippleVisual(system,active); damagePhase(system,active,active.data.palmRippleDamageRatio,active.finalRadius*active.data.palmRippleRadiusRatio,'ripple'); }
  if(active.level>=9&&!active.shatterResolved&&t>=active.shatterAt){ active.shatterResolved=true; crackVisual(system,active); transient(system,active,active.finalRadius*active.data.shatterRadiusRatio,0xffb703,.30); damagePhase(system,active,active.data.shatterDamageRatio,active.finalRadius*active.data.shatterRadiusRatio,'shatter'); }
  if(t>=active.endAt) endActive(active,system);
}
export function selectSkyCoveringPalmCenter(system,radius){ const s=system?.scene||system,enemies=validEnemies(s),player=s?.player||{x:0,y:0}; if(!enemies.length) return null; const candidates=enemies.map(e=>{ const inside=enemies.filter(o=>dist(o.x,o.y,e.x,e.y)<=radius); return {x:e.x,y:e.y,count:inside.length,hp:inside.reduce((sum,o)=>sum+(o.hp||0),0),playerDist:dist(e.x,e.y,player.x||0,player.y||0)}; }); candidates.sort((a,b)=>b.count-a.count||b.hp-a.hp||a.playerDist-b.playerDist||a.x-b.x||a.y-b.y); return {x:candidates[0].x,y:candidates[0].y}; }
export const SkyCoveringPalmSkill={
  canCast(system,cfg,data){ return !!selectSkyCoveringPalmCenter(system,rangeValue(data.radius,{rangeMultiplier:1})); },
  cast(system,cfg,data,level,ctx={}){ const finalRadius=rangeValue(data.radius,ctx),center=selectSkyCoveringPalmCenter(system,finalRadius); if(!center) return false; const t=now(system.scene),mainAt=t+data.warningMs,rippleAt=mainAt+data.palmRippleDelayMs,shatterAt=mainAt+data.shatterDelayMs,finalPhaseAt=level>=9?shatterAt:level>=3?rippleAt:mainAt; const active={skillId:SKY_COVERING_PALM_ID,cfg,data,level,ctx,lockedCenter:center,finalRadius,mainAt,rippleAt,shatterAt,nextAt:t,endAt:finalPhaseAt+260,mainResolved:false,rippleResolved:false,shatterResolved:false,visuals:[],tick(){ this.nextAt=now(system.scene)+16; tickPalm(system,this); },onEnd(){ endActive(this,system); }}; drawWarning(system,active); system.active.push(active); return active; },
  shiftTimers(system,pausedDuration,pausedAt){ system.active.filter(a=>a.skillId===SKY_COVERING_PALM_ID).forEach(a=>['mainAt','rippleAt','shatterAt'].forEach(key=>{ if(a[key]>pausedAt) a[key]+=pausedDuration; })); },
  cleanup(system){ system.active.filter(a=>a.skillId===SKY_COVERING_PALM_ID).forEach(a=>a.onEnd?.('cleanup')); }
};
export function configureCultivationActiveSkills(){ SKILLS[SKY_COVERING_PALM_ID]={id:SKY_COVERING_PALM_ID,name:'弥天大手印',rarity:'EPIC',type:'主动范围修仙法术',tags:[TAGS.MAGIC,TAGS.SPELL,TAGS.ACTIVE_SKILL,TAGS.CULTIVATION,TAGS.BUILD_CULTIVATION],maxLevel:9,handler:SKY_COVERING_PALM_ID,targetType:'random',passive:false,manaCost:12,color:0xd97706,short:'掌',description:'在可视范围内最密集的敌群上方凝聚弥天大手印，短暂蓄势后拍落，造成大范围修仙法术伤害。伤害、范围、冷却和法力消耗随九转大道境界提升。',milestones:{3:'掌纹震荡：主掌落下后，掌纹向外扩散，造成主伤害40%的额外范围伤害。',6:'镇压山河：主掌命中的普通和精英敌人短暂降低移动速度和攻击速度，Boss不受镇压影响。',9:'一掌遮天：主掌残影在450毫秒后崩碎，造成主伤害70%的额外范围伤害。'},levels:SKY_COVERING_PALM_LEVELS}; }
