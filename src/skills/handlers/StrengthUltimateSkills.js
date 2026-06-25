import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';

const ID='last_stand';
const levels=(values,build,milestones={})=>values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}),
}));

const STRENGTH_ULTIMATE_SKILLS={
  last_stand:{
    id:ID,name:'血战到底',rarity:'MYTHIC',handler:ID,passive:true,maxLevel:9,
    requiredSkillId:'blood_rage_burst',ultimateSkill:true,
    tags:['physical','lifesteal',TAGS.BUILD_STRENGTH],cooldownMs:999999,targetType:'passive',color:0x7f1d1d,short:'战',
    description:'受到致命伤时生命锁定为1，并进入短暂血战。血战期间无法接受普通治疗，只能依靠攻击吸血恢复生命；状态结束时生命仍为1则死亡。',
    levels:levels([
      [2400,18000],[2550,17000],[2700,16000],[2850,15000],[3000,14000],[3150,13000],[3300,12000],[3450,11000],[3600,10000]
    ],([durationMs,cooldownMs])=>({ durationMs,cooldownMs,desc:`致死伤害锁定至1生命并进入${(durationMs/1000).toFixed(2)}秒血战；结束后内部冷却${(cooldownMs/1000).toFixed(0)}秒。` }),{
      3:'血战持续时间提高',
      6:'内部冷却进一步缩短',
      9:'血战持续3.6秒，内部冷却缩短至10秒'
    })
  }
};

export function configureStrengthUltimateSkills(){ Object.entries(STRENGTH_ULTIMATE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

function removeUpdater(system,updater){ const i=system.passiveUpdaters.indexOf(updater); if(i>=0) system.passiveUpdaters.splice(i,1); }
function makeVisuals(s){
  const nodes=new Set();
  const ring=s.add.circle(s.player.x,s.player.y-48,82,0x7f1d1d,0.18).setStrokeStyle(6,0xdc2626,0.9).setDepth(151);
  nodes.add(ring);
  s.tweens.add({targets:ring,alpha:0,scale:1.55,duration:360,onComplete:()=>{ nodes.delete(ring); ring.destroy(); }});
  const aura=s.add.circle(s.player.x,s.player.y-50,66,0x7f1d1d,0.08).setStrokeStyle(4,0x991b1b,0.42).setDepth(94);
  nodes.add(aura);
  return { nodes, aura, clear(){ nodes.forEach(o=>o.destroy?.()); nodes.clear(); } };
}

export const LastStandSkill={
  bind(system){
    const s=system.scene;
    const state={ active:false, endsAt:0, cooldownUntil:0, resolvingDeath:false, visuals:null };
    const clearVisuals=()=>{ state.visuals?.clear?.(); state.visuals=null; };
    const end=(survived=true)=>{
      if(!state.active) return;
      state.active=false;
      state.endsAt=0;
      const data=system.getData(ID);
      state.cooldownUntil=s.getGameplayTime()+(data?.cooldownMs||0);
      clearVisuals();
      if(survived && s.playerData.hp>1){ s.floatText?.(s.player.x,s.player.y-126,'夺命而归','#ff9aa2'); return; }
      state.resolvingDeath=true;
      s.playerData.hp=0;
      s.hud?.update();
      s.playerHealthBar?.update();
      s.finishRun?.(false);
    };
    const updater=()=>{
      const data=system.getData(ID), now=s.getGameplayTime();
      if(!data){ clearVisuals(); state.active=false; return; }
      if(state.active){
        s.playerData.hp=Math.max(1,s.playerData.hp||0);
        state.visuals?.aura?.setPosition(s.player.x,s.player.y-50);
        state.visuals?.aura?.setAlpha(0.07+0.04*Math.sin(now/120));
        if(now>=state.endsAt) end(true);
      }
    };
    system.passiveUpdaters.push(updater);
    system.passiveState.lastStand=state;
    return ()=>{ removeUpdater(system,updater); clearVisuals(); delete system.passiveState.lastStand; };
  },
  beforePlayerHpDamage(system,payload){
    const s=system.scene, state=system.passiveState.lastStand, data=system.getData(ID), now=s.getGameplayTime();
    if(!state||!data||payload?.noLastStand||state.resolvingDeath||s.playerData.hp<=0) return null;
    if(state.active) return payload.hpDamage>=s.playerData.hp ? { hpDamage:Math.max(0,s.playerData.hp-1), lastStandLocked:true } : null;
    if(now<state.cooldownUntil||payload.hpDamage<s.playerData.hp) return null;
    state.active=true; state.endsAt=now+data.durationMs; state.visuals=makeVisuals(s);
    s.floatText?.(s.player.x,s.player.y-126,'血战到底','#ff6b6b');
    s.eventBus.emit(CombatEvents.LAST_STAND_TRIGGERED,{ skillId:ID, durationMs:data.durationMs, cooldownMs:data.cooldownMs });
    return { hpDamage:Math.max(0,s.playerData.hp-1), lastStandTriggered:true };
  }
};
