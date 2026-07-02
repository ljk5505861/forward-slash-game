import { BlackHoleSkill, GravityCrushSkill, createGravityCrushColumn, mostDenseHorizontal } from './GravityFlowSkills.js';

const time=s=>s.getGameplayTime?.()??s.time?.now??s.now??0;
const destroy=(sys,n)=>{ sys.scene.tweens?.killTweensOf?.(n); sys.scene.gravityRuntime?.visuals?.delete?.(n); n?.destroy?.(); };

function removeUpdater(sys){
  const updater=sys.passiveState.gravityFollowupFixUpdater;
  if(!updater) return;
  sys.passiveUpdaters=sys.passiveUpdaters.filter(fn=>fn!==updater);
  delete sys.passiveState.gravityFollowupFixUpdater;
}

function wrapShutdown(sys){
  const s=sys.scene,rt=s.gravityRuntime;
  if(!rt?.shutdownHandler||rt.gravityFixShutdownWrapped) return;
  const original=rt.shutdownHandler;
  s.events?.off?.('shutdown',original);
  const combined=()=>{ original(); removeUpdater(sys); };
  rt.shutdownHandler=combined;
  rt.gravityFixShutdownWrapped=true;
  s.events?.once?.('shutdown',combined);
}

function showWarning(sys,task,center){
  createGravityCrushColumn(sys,task,center);
  task.executeAt=time(sys.scene)+task.data.warningMs;
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
      const center=mostDenseHorizontal(s,task.data.radius);
      if(!center){
        task.visuals?.forEach(n=>destroy(sys,n));
        rt.pendingStrikes.delete(task);
        return;
      }
      showWarning(sys,task,center);
    });
  };
  if(!sys.passiveUpdaters.includes(state.gravityFollowupFixUpdater)) sys.passiveUpdaters.push(state.gravityFollowupFixUpdater);
  wrapShutdown(sys);
}

export const GravityCrushFixedSkill={
  ...GravityCrushSkill,
  cast(sys,cfg,data,level,ctx={}){
    const previous=new Set(sys.scene.gravityRuntime?.pendingStrikes||[]);
    const castAt=time(sys.scene);
    const result=GravityCrushSkill.cast(sys,cfg,data,level,ctx);
    const tasks=[...(sys.scene.gravityRuntime?.pendingStrikes||[])].filter(x=>!previous.has(x)).sort((a,b)=>a.executeAt-b.executeAt);
    tasks.forEach((task,index)=>{
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
    return ()=>{ off?.(); };
  }
};
