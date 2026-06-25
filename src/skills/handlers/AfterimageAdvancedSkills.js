import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';

const SOURCE_SWIFT='swift_shadow';
const SOURCE_STEP='instant_step';
const sumBonuses = bonuses => Object.values(bonuses||{}).reduce((sum,value)=>sum+(Number(value)||0),0);
const levels=(values,build,milestones={})=>values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{ milestoneText:milestones[index+1] }:{})
}));

const AFTERIMAGE_ADVANCED_SKILLS={
  swift_shadow:{
    id:'swift_shadow', name:'疾影', rarity:'EPIC', handler:'swift_shadow', passive:true, maxLevel:9,
    advancedSkill:true, requiredSkillId:'shadow_assault',
    tags:['shadow','movement','dodge','afterimage',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0xb7f7ff, short:'疾',
    description:'战斗中的闪避、残影与高速推进会积累疾影层数，提高机动、攻速和残影伤害。',
    levels:levels([
      [3,0.04,0.03,0.05,0.010,3000],[3,0.045,0.033,0.055,0.011,3200],[4,0.047,0.036,0.060,0.012,3400],[4,0.050,0.039,0.065,0.012,3600],[4,0.052,0.042,0.070,0.013,3800],[4,0.055,0.045,0.076,0.014,4000],[4,0.057,0.047,0.080,0.014,4200],[4,0.059,0.049,0.082,0.015,4350],[5,0.060,0.050,0.085,0.015,4500]
    ],([maxStacks,moveSpeedBonus,attackSpeedBonus,afterimageDamageBonus,dodgeBonus,durationMs])=>({ maxStacks,moveSpeedBonus,attackSpeedBonus,afterimageDamageBonus,dodgeBonus,durationMs,highSpeedIntervalMs:850,eventThrottleMs:320,decayIntervalMs:900,desc:`最多${maxStacks}层；每层移动+${Math.round(moveSpeedBonus*100)}%、攻速+${Math.round(attackSpeedBonus*100)}%、残影伤害+${Math.round(afterimageDamageBonus*100)}%。` }),{
      3:'最大层数提高至4层',
      6:'残影伤害加成提高，疾影维持时间延长',
      9:'最大层数提高至5层，层数持续4.5秒'
    })
  },
  instant_step:{
    id:'instant_step', name:'瞬身', rarity:'EPIC', handler:'instant_step', passive:true, maxLevel:9,
    advancedSkill:true, requiredSkillId:'swift_shadow',
    tags:['shadow','movement','dodge','afterimage','physical',TAGS.BUILD_AFTERIMAGE], cooldownMs:999999,
    targetType:'passive', color:0xe8fbff, short:'瞬',
    description:'成功闪避且冷却结束时瞬间虚化，并在原地留下强化残影攻击前方敌人。',
    levels:levels([
      [55,110,7000,150],[66,118,6700,160],[78,126,6400,170],[90,135,6100,180],[104,143,5800,190],[120,152,5500,200],[132,160,5200,215],[142,166,4900,230],[150,174,4500,250]
    ],([damage,radius,cooldownMs,phaseDurationMs])=>({ damage,radius,cooldownMs,phaseDurationMs,dodgeEventWindowMs:16,desc:`闪避时瞬间虚化，在原地留下残影造成${damage}点物理伤害，冷却${(cooldownMs/1000).toFixed(1)}秒。` }),{
      3:'残影伤害与攻击范围提高',
      6:'残影伤害显著提高',
      9:'冷却缩短至4.5秒，范围扩大，虚化时间略微延长'
    })
  }
};

export function configureAfterimageAdvancedSkills(){ Object.entries(AFTERIMAGE_ADVANCED_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

function removeUpdater(system,updater){ const i=system.passiveUpdaters.indexOf(updater); if(i>=0) system.passiveUpdaters.splice(i,1); }
function ensureBonusFields(p){ p.moveSpeedMultiplierBonuses??={}; p.attackSpeedMultiplierBonuses??={}; p.dodgeChanceBonuses??={}; p.afterimageDamageBonuses??={}; }
function clearSwiftBonuses(p){ ['moveSpeedMultiplierBonuses','attackSpeedMultiplierBonuses','dodgeChanceBonuses','afterimageDamageBonuses'].forEach(f=>{ if(p?.[f]) delete p[f][SOURCE_SWIFT]; }); }
function inCombat(s){ return !!s.targeting?.nearestAhead?.(s.balance?.player?.encounterDistance||520); }
function refreshSwiftVisual(s,state){
  if(state.stacks<=0){ state.aura?.destroy?.(); state.aura=null; return; }
  if(!state.aura) state.aura=s.add.rectangle(s.player.x,s.player.y-50,62,88,0xb7f7ff,0.08).setStrokeStyle(3,0xe8fbff,0.22).setDepth(93);
  state.aura.setPosition(s.player.x,s.player.y-50); state.aura.setAlpha(Math.min(0.24,0.06+state.stacks*0.035));
}
function applySwift(system,state,data,force=false){
  const p=system.scene.playerData; ensureBonusFields(p);
  const key=`${state.stacks}:${system.getLevel('swift_shadow')}`;
  if(!force && state.appliedKey===key) return;
  clearSwiftBonuses(p);
  if(data&&state.stacks>0){
    p.moveSpeedMultiplierBonuses[SOURCE_SWIFT]=state.stacks*data.moveSpeedBonus;
    p.attackSpeedMultiplierBonuses[SOURCE_SWIFT]=state.stacks*data.attackSpeedBonus;
    p.dodgeChanceBonuses[SOURCE_SWIFT]=state.stacks*data.dodgeBonus;
    p.afterimageDamageBonuses[SOURCE_SWIFT]=state.stacks*data.afterimageDamageBonus;
  }
  state.appliedKey=key;
}
function gainSwift(system,state,kind,payload={}){
  const s=system.scene, data=system.getData('swift_shadow');
  if(!data||!inCombat(s)) return;
  const now=s.getGameplayTime();
  const eventKey=payload.afterimage?.id?`${kind}:${payload.afterimage.id}`:`${kind}:${payload.enemy?.name||''}:${Math.floor(now/16)}`;
  if(state.lastEventKey===eventKey) return;
  if(now-(state.lastByKind[kind]||0)<data.eventThrottleMs) return;
  state.lastEventKey=eventKey; state.lastByKind[kind]=now; state.expiresAt=now+data.durationMs;
  const before=state.stacks; state.stacks=Math.min(data.maxStacks,state.stacks+1);
  if(state.stacks!==before){ s.floatText?.(s.player.x,s.player.y-120,'疾影 +1','#b7f7ff'); applySwift(system,state,data,true); }
}

export const SwiftShadowSkill={
  bind(system){
    const s=system.scene;
    const state={ stacks:0, expiresAt:0, lastHighSpeedAt:0, lastByKind:{}, lastEventKey:'', appliedKey:'', aura:null };
    const clear=()=>{ state.stacks=0; state.expiresAt=0; clearSwiftBonuses(s.playerData); state.aura?.destroy?.(); state.aura=null; state.appliedKey=''; };
    const offDodge=s.eventBus.on(CombatEvents.PLAYER_DODGED,p=>gainSwift(system,state,'dodge',p));
    const offCreated=s.eventBus.on(CombatEvents.AFTERIMAGE_CREATED,p=>gainSwift(system,state,'afterimage',p));
    const offHit=s.eventBus.on(CombatEvents.ENEMY_HIT,p=>{ if(p.afterimage||p.damageKind==='afterimageAttack'||(p.tags||[]).includes(TAGS.BUILD_AFTERIMAGE)) gainSwift(system,state,'afterimageHit',p); });
    const updater=()=>{
      const data=system.getData('swift_shadow'); if(!data){ clear(); return; }
      const now=s.getGameplayTime();
      if(inCombat(s) && Math.abs(s.player?.body?.velocity?.x||0)>=((s.balance?.player?.speedX||185)*0.9) && now-state.lastHighSpeedAt>=data.highSpeedIntervalMs){ state.lastHighSpeedAt=now; gainSwift(system,state,'highSpeed'); }
      if(state.stacks>0 && now>state.expiresAt){ state.stacks=Math.max(0,state.stacks-1); state.expiresAt=state.stacks>0?now+data.decayIntervalMs:0; applySwift(system,state,data,true); }
      applySwift(system,state,data); refreshSwiftVisual(s,state);
    };
    system.passiveUpdaters.push(updater);
    return ()=>{ offDodge?.(); offCreated?.(); offHit?.(); removeUpdater(system,updater); clear(); };
  }
};

function attackAfterimage(s,x,y,data){
  const mult=1+sumBonuses(s.playerData.afterimageDamageBonuses);
  const amount=Math.max(1,Math.round(data.damage*mult));
  const targets=s.targeting.all().filter(e=>Math.abs(e.x-x)<=data.radius && e.x>=x-35).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x));
  targets.forEach(enemy=>{
    s.combatSystem.damageEnemy(enemy,amount,{ source:'skill', damageKind:'afterimageAttack', skillId:SOURCE_STEP, tags:['shadow','physical',TAGS.BUILD_AFTERIMAGE], afterimage:true, allowLifeSteal:false, noKnockback:true, noInstantStep:true });
  });
}

export const InstantStepSkill={
  bind(system){
    const s=system.scene;
    let readyAt=0;
    let lastFrame=-1;
    let triggering=false;
    let phaseTimer=null;
    let restoreVisual=null;
    const visuals=new Set();

    const destroyVisual=obj=>{ if(!obj) return; visuals.delete(obj); obj.destroy?.(); };
    const restorePlayer=()=>{
      phaseTimer?.remove?.(false);
      phaseTimer=null;
      restoreVisual?.();
      restoreVisual=null;
    };
    const beginPhase=data=>{
      restorePlayer();
      const player=s.player;
      if(!player) return;
      const originalAlpha=player.alpha;
      const originalScaleX=player.scaleX;
      const originalScaleY=player.scaleY;
      restoreVisual=()=>{
        if(!player?.active) return;
        player.setAlpha?.(originalAlpha);
        player.setScale?.(originalScaleX,originalScaleY);
      };
      player.setAlpha?.(Math.min(originalAlpha,0.35));
      player.setScale?.(originalScaleX*0.96,originalScaleY*0.96);
      phaseTimer=s.time.delayedCall(data.phaseDurationMs,restorePlayer);
    };

    const off=s.eventBus.on(CombatEvents.PLAYER_DODGED,payload=>{
      const data=system.getData('instant_step');
      if(!data) return;
      const now=s.getGameplayTime();
      const frame=Math.floor(now/data.dodgeEventWindowMs);
      if(triggering||payload?.noInstantStep||frame===lastFrame||now<readyAt) return;
      lastFrame=frame;
      triggering=true;
      readyAt=now+data.cooldownMs;
      const ox=s.player.x;
      const oy=s.player.y;
      beginPhase(data);
      const ghost=s.add.rectangle(ox,oy-52,34,76,0xe8fbff,0.26).setStrokeStyle(2,0xb7f7ff,0.45).setDepth(96);
      const flash=s.add.circle(ox,oy-52,34,0xe8fbff,0.24).setStrokeStyle(4,0xe8fbff,0.7).setDepth(150);
      visuals.add(ghost);
      visuals.add(flash);
      s.floatText?.(ox,oy-130,'瞬身','#e8fbff');
      attackAfterimage(s,ox,oy,data);
      s.tweens.add({targets:ghost,alpha:0,x:ox-18,duration:260,onComplete:()=>destroyVisual(ghost)});
      s.tweens.add({targets:flash,alpha:0,scale:1.5,duration:220,onComplete:()=>destroyVisual(flash)});
      triggering=false;
    });

    return ()=>{
      off?.();
      restorePlayer();
      visuals.forEach(obj=>obj.destroy?.());
      visuals.clear();
      readyAt=0;
      lastFrame=-1;
      triggering=false;
    };
  }
};