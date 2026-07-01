import { BlackHoleSkill, GravityCrushSkill, mostDense } from './GravityFlowSkills.js';

const time=s=>s.getGameplayTime?.()??s.time?.now??s.now??0;
const destroy=(sys,n)=>{ sys.scene.tweens?.killTweensOf?.(n); sys.scene.gravityRuntime?.visuals?.delete?.(n); n?.destroy?.(); };

function showWarning(sys,task,center){
  const s=sys.scene,rt=s.gravityRuntime;
  const warning=s.add?.circle?.(center.x,center.y,task.data.radius,0x7c3aed,.18)?.setStrokeStyle?.(3,0xc084fc,.75)?.setDepth?.(18);
  const pillar=s.add?.rectangle?.(center.x,center.y-220,28,220,0x2e1065,0)?.setDepth?.(19);
  [warning,pillar].filter(Boolean).forEach(n=>rt?.visuals?.add?.(n));
  task.visuals=[warning,pillar].filter(Boolean);
  task.lockedCenter={x:center.x,y:center.y};
  task.centerAt=()=>task.lockedCenter;
  task.executeAt=time(s)+task.data.warningMs;
  task.gravityWarningStarted=true;
}

function ensureUpdater(sys){
  const state=sys.passiveState;
  state.gravityFollowupFixUpdater ||= ()=>{
    const s=sys.scene,rt=s.gravityRuntime;
    if(!rt) return;
    const t=time(s);
    rt.pendingStrikes?.forEach(task=>{
      if(!task.gravityStagedWarning||task.gravityWarningStarted||t<task.warningAt) return;
      const center=mostDense(s,task.data.radius);
      if(!center){
        task.visuals?.forEach(n=>destroy(sys,n));
        rt.pendingStrikes.delete(task);
        return;
      }
      showWarning(sys,task,center);
    });
    const y=(s.balance?.groundTopY??620)-260;
    rt.transients?.forEach(v=>{
      if(v.skillId==='black_hole') v.visuals?.forEach(n=>n?.setPosition?.(n.x,y));
    });
  };
  if(!sys.passiveUpdaters.includes(state.gravityFollowupFixUpdater)) sys.passiveUpdaters.push(state.gravityFollowupFixUpdater);
}

export const GravityCrushFixedSkill={
  ...GravityCrushSkill,
  cast(sys,cfg,data,level,ctx={}){
    const previous=new Set(sys.scene.gravityRuntime?.pendingStrikes||[]);
    const castAt=time(sys.scene);
    const result=GravityCrushSkill.cast(sys,cfg,data,level,ctx);
    const tasks=[...(sys.scene.gravityRuntime?.pendingStrikes||[])].filter(x=>!previous.has(x)).sort((a,b)=>a.executeAt-b.executeAt);
    tasks.forEach((task,index)=>{
      const initial=task.visuals?.[0];
      if(initial){
        task.lockedCenter={x:initial.x,y:initial.y};
        task.centerAt=()=>task.lockedCenter;
      }
      if(index===0) return;
      task.visuals?.forEach(n=>destroy(sys,n));
      task.visuals=[];
      task.warningAt=castAt+index*(data.followupDelayMs||0);
      task.executeAt=Number.POSITIVE_INFINITY;
      task.gravityStagedWarning=true;
      task.gravityWarningStarted=false;
      task.lockedCenter=null;
    });
    ensureUpdater(sys);
    return result;
  }
};

export const BlackHoleFixedSkill={
  ...BlackHoleSkill,
  bind(sys){
    const off=BlackHoleSkill.bind(sys);
    ensureUpdater(sys);
    return off;
  },
  shiftTimers(sys,d,pausedAt){
    BlackHoleSkill.shiftTimers?.(sys,d,pausedAt);
    sys.scene.gravityRuntime?.pendingStrikes?.forEach(task=>{
      if(task.gravityStagedWarning&&Number.isFinite(task.warningAt)&&task.warningAt>pausedAt) task.warningAt+=d;
    });
  }
};
