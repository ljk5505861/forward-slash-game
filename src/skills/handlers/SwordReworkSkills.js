import { CombatEvents } from '../../core/CombatEvents.js';
import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';
import { addSoulFromEnemy, absorbElementalSouls, applyElementalSouls, getSwordFlowState, hasMainSword, mainSwordStats, refreshSwordQuality, sheathInheritedStats, SOUL_THRESHOLDS, SWORD_MYTHIC, tryPromoteSwordTomb } from './SwordFlowState.js';

const PhaserRef = globalThis.Phaser || { Math:{ Distance:{ Between:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1) } } };
const nineLevels = (rows, build, milestones={}) => rows.map((row,index)=>({ ...build(row,index+1), ...(milestones[index+1]?{ milestoneText:milestones[index+1] }:{}) }));
export const SWORD_SHEATH_BACK_OFFSET_X=28;
export const SWORD_SHEATH_BACK_OFFSET_Y=26;
export const SWORD_TOMB_OFFSET_Y=138;
const sheathAnchor=player=>{ const dir=player.flipX?-1:1; return { dir, x:player.x-dir*SWORD_SHEATH_BACK_OFFSET_X, y:player.y-SWORD_SHEATH_BACK_OFFSET_Y, rotation:0 }; };
export function syncSwordAttachedVisuals(system){ const s=system.scene, st=getSwordFlowState(system); if(s?.player&&st.sheath?.container){ const anchor=sheathAnchor(s.player); st.sheath.container.setPosition(anchor.x,anchor.y).setRotation(0); } if(s?.player&&st.tomb?.view){ st.tomb.view.setPosition(s.player.x,s.player.y-SWORD_TOMB_OFFSET_Y); } }

export const SWORD_REWORK_SKILLS = {
  sword_sheath:{
    id:'sword_sheath', name:'剑匣', rarity:'RARE', handler:'sword_sheath', passive:true, maxLevel:9,
    tags:['physical',TAGS.SUMMON,TAGS.PROJECTILE,TAGS.BUILD_SWORD], cooldownMs:999999,
    targetType:'passive', color:0x8fdcff, short:'匣',
    description:'剑匣在身后温养虚幻剑，完成后放出可见剑体直线贯穿敌阵。',
    levels:nineLevels([
      [32,6000,560,0.95],[38,5700,590,1.00],[44,5200,620,1.05],[52,5000,650,1.10],[60,4700,690,1.15],[70,4500,725,1.20],[82,4300,760,1.25],[96,4100,800,1.30],[104,4000,840,1.35]
    ],([damage,warmupMs,range,sizeScale],level)=>({ damage,warmupMs,range,sizeScale,volley:level>=9?2:1,secondDelayMs:level>=9?200:0,desc:level>=9?'温养完成后先后发射两把独立虚幻剑，均不返回。':'温养虚幻剑，完成后以可见剑体高速贯穿路径敌人。' }),{9:'连续发射两道虚幻剑'})
  },
  sword_tomb:{
    id:'sword_tomb', name:'剑冢', rarity:'EPIC', handler:'sword_tomb', passive:true, maxLevel:9,
    tags:['physical','soul',TAGS.SUMMON,TAGS.BUILD_SWORD], cooldownMs:999999,
    targetType:'passive', color:0xcbb6ff, short:'冢',
    description:'悬浮剑形王冠周期性魂斩残血敌人，吸魂强化御剑术或自身。',
    levels:nineLevels([
      [42,0.10,2600,160],[52,0.11,2450,175],[64,0.12,2300,190],[78,0.13,2150,205],[94,0.14,2000,220],[114,0.15,1850,235],[138,0.16,1700,250],[166,0.17,1550,265],[200,0.18,1380,285]
    ],([damage,executeRatio,intervalMs,range],level)=>({ damage,executeRatio,intervalMs,range,desc:level>=9?'具备封神资格：魂量足够且神话名额空闲时化为万魂剑域。':level>=6?'魂魄提纯，并让火魂/毒魂附加实际灼烧/中毒。':'周期性魂斩残血敌人，击杀后吸收魂魄。' }),{6:'魂魄提纯',9:'获得封神资格'})
  }
};

export function configureSwordReworkSkills(){ Object.entries(SWORD_REWORK_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }
const dist=(a,b)=>PhaserRef.Math.Distance.Between(a.x,a.y,b.x,b.y);
function lineHitTargets(scene,x1,y1,x2,y2,width){ return scene.targeting.all().filter(e=>PhaserRef.Math.Distance.Between(e.x,e.y,x1,y1)+PhaserRef.Math.Distance.Between(e.x,e.y,x2,y2)<=PhaserRef.Math.Distance.Between(x1,y1,x2,y2)+width); }
function addSoul(system, enemy, meta={}){ addSoulFromEnemy(system,enemy); absorbElementalSouls(system,enemy,meta); if(hasMainSword(system)) refreshSwordQuality(system); else tryPromoteSwordTomb(system); }
function makeSheathSword(scene,x,y,color,size){ const blade=scene.add.rectangle(x,y,58*size,8*size,color,0.72).setStrokeStyle(2,0xffffff,0.58).setDepth(146); const glow=scene.add.rectangle(x,y,72*size,14*size,color,0.22).setDepth(145); return { blade, glow, destroy(){ blade.destroy(); glow.destroy(); }, set(x2,y2,rot){ blade.setPosition(x2,y2).setRotation(rot); glow.setPosition(x2,y2).setRotation(rot); } }; }
function spawnSheathProjectile(system, st, data, origin, dir){
  const s=system.scene, inherited=hasMainSword(system)?sheathInheritedStats(system):{damageMultiplier:1,sizeMultiplier:1,glowMultiplier:1,fireSoul:0,poisonSoul:0,hasMain:false};
  const size=data.sizeScale*inherited.sizeMultiplier, color=inherited.hasMain?0xb8f7ff:0x8fdcff;
  const sword=makeSheathSword(s,origin.x,origin.y,color,size), x2=origin.x+dir*data.range, y2=origin.y-24;
  const hit=new Set();
  const damage=Math.round(data.damage*inherited.damageMultiplier+(inherited.fireSoul||0)*6+(inherited.poisonSoul||0)*5);
  const active={ skillId:'sword_sheath', nextAt:s.getGameplayTime(), endAt:s.getGameplayTime()+900, tick(){
    const t=Math.min(1,(s.getGameplayTime()-(this.startedAt||=s.getGameplayTime()))/520);
    const x=origin.x+(x2-origin.x)*t, y=origin.y+(y2-origin.y)*t, rot=Math.atan2(y2-origin.y,x2-origin.x);
    sword.set(x,y,rot);
    lineHitTargets(s,origin.x,origin.y,x,y,28*size).forEach(enemy=>{ if(hit.has(enemy)) return; hit.add(enemy); const ok=s.combatSystem.damageEnemy(enemy,damage,{source:'skill',skillId:'sword_sheath',tags:SKILLS.sword_sheath.tags,allowLifeSteal:false,noKnockback:true}); if(ok) applyElementalSouls(system,enemy,inherited,'sword_sheath',false); });
    if(t>=1){ this.ended=true; sword.destroy(); }
  }, onEnd(){ sword.destroy(); } };
  system.active.push(active);
}

export const SwordSheathSkill = {
  syncAttachedVisuals:syncSwordAttachedVisuals,
  bind(system){
    const updater=()=>{
      const s=system.scene, st=getSwordFlowState(system), data=system.getData('sword_sheath'), level=system.getLevel('sword_sheath');
      if(!data||level<=0){ st.sheath?.container?.destroy?.(); st.sheath=null; return; }
      const now=s.getGameplayTime(), anchor=sheathAnchor(s.player);
      if(!st.sheath){ const container=s.add.container(anchor.x,anchor.y).setDepth(18).setRotation(0); const view=s.add.rectangle(0,0,30,54,0x2a3558,0.82).setStrokeStyle(3,0x9deaff,0.8); const charge=s.add.rectangle(0,0,16,32,0x9deaff,0.15); container.add([view,charge]); st.sheath={ readyAt:now+data.warmupMs, pending:[], container, view, charge, chargeReady:false }; }
      const sh=st.sheath;
      syncSwordAttachedVisuals(system);
      const chargeReady=now>=sh.readyAt;
      if(sh.chargeReady!==chargeReady){ sh.charge?.setAlpha(chargeReady?0.72:0.15); sh.chargeReady=chargeReady; }
      sh.pending=sh.pending.filter(item=>{ if(now<item.at) return true; spawnSheathProjectile(system,st,data,{x:anchor.x,y:anchor.y},anchor.dir); return false; });
      if(now<sh.readyAt || sh.pending.length) return;
      spawnSheathProjectile(system,st,data,{x:anchor.x,y:anchor.y},anchor.dir);
      if(data.volley>=2) sh.pending.push({ at:now+(data.secondDelayMs||200) });
      sh.readyAt=now+data.warmupMs+(data.volley>=2?(data.secondDelayMs||200):0);
    };
    system.passiveUpdaters.push(updater);
    updater();
    return ()=>{
      system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==updater);
      const st=getSwordFlowState(system);
      st.sheath?.container?.destroy?.();
      st.sheath=null;
    };
  }
};

export const SwordTombSkill = {
  syncAttachedVisuals:syncSwordAttachedVisuals,
  bind(system){
    const offKill=system.scene.eventBus.on(CombatEvents.ENEMY_KILLED,(payload={})=>{ if(payload.skillId==='sword_tomb') addSoul(system,payload.enemy,payload); });
    const updater=()=>{
      let data=system.getData('sword_tomb'), level=system.getLevel('sword_tomb'), s=system.scene, st=getSwordFlowState(system), now=s.getGameplayTime();
      if(!data||level<=0){ st.tomb?.view?.destroy?.(); st.tomb=null; st.domain?.views?.forEach(v=>v.destroy?.()); st.domain=null; return; }
      const tx=s.player.x, ty=s.player.y-SWORD_TOMB_OFFSET_Y;
      if(!st.tomb) st.tomb={ nextAt:now+400, view:s.add.triangle(tx,ty,0,34,28,0,56,34,0xcbb6ff,0.8).setStrokeStyle(3,0xffffff,0.55).setDepth(139) };
      syncSwordAttachedVisuals(system);
      if(hasMainSword(system)) refreshSwordQuality(system); else { data={...data, damage:Math.round(data.damage+st.effectiveSouls*1.5+(st.affinities.fire||0)*5+(st.affinities.poison||0)*4), intervalMs:Math.max(620,data.intervalMs-st.effectiveSouls*8) }; }
      tryPromoteSwordTomb(system);
      if(st.mythicOwner===SWORD_MYTHIC.TOMB) updateDomain(system,st,data,now);
      if(now<st.tomb.nextAt) return;
      const target=s.targeting.all().filter(e=>dist(e,s.player)<=data.range).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
      st.tomb.nextAt=now+data.intervalMs; if(!target) return;
      const g=s.add.line(0,0,st.tomb.view.x,st.tomb.view.y,target.x,target.y-40,0xcbb6ff,0.65).setOrigin(0).setDepth(142).setLineWidth(8); s.tweens.add({targets:g,alpha:0,duration:180,onComplete:()=>g.destroy()});
      const hpRatio=target.hp/Math.max(1,target.maxHp||target.hp), ratio=target.isElite?data.executeRatio*0.6:data.executeRatio;
      const damage=target.isBoss?Math.round(data.damage*3.2):hpRatio<=ratio?target.hp:data.damage;
      const ok=s.combatSystem.damageEnemy(target,damage,{source:'skill',skillId:'sword_tomb',tags:SKILLS.sword_tomb.tags,allowLifeSteal:false,noKnockback:true});
      if(ok) applyElementalSouls(system,target,{fireSoul:st.affinities.fire,poisonSoul:st.affinities.poison},'sword_tomb',hasMainSword(system));
    };
    system.passiveUpdaters.push(updater); updater(); return ()=>{ offKill?.(); };
  }
};

function updateDomain(system,st,data,now){
  const s=system.scene; st.domain ||= { lastHit:new Map(), views:[] };
  const count=Math.min(10,3+Math.floor(st.effectiveSouls/35));
  while(st.domain.views.length<count) st.domain.views.push(s.add.rectangle(s.player.x,s.player.y-92,38,7,0xd8c9ff,0.76).setStrokeStyle(2,0xffffff,0.45).setDepth(137));
  while(st.domain.views.length>count) st.domain.views.pop().destroy();
  st.domain.views.forEach((v,i)=>{ const a=now*0.004+i*Math.PI*2/count; v.setPosition(s.player.x+Math.cos(a)*118,s.player.y-70+Math.sin(a)*58).setRotation(a); });
  const radius=170, damage=Math.round(data.damage*0.32+st.effectiveSouls*0.22+(st.affinities.fire||0)*3+(st.affinities.poison||0)*3);
  s.targeting.all().filter(e=>PhaserRef.Math.Distance.Between(e.x,e.y,s.player.x,s.player.y)<=radius).forEach(e=>{ const next=st.domain.lastHit.get(e)||0; if(now<next) return; st.domain.lastHit.set(e,now+520); const ok=s.combatSystem.damageEnemy(e,damage,{source:'skill',skillId:'sword_tomb',damageKind:'soulDomain',tags:[...SKILLS.sword_tomb.tags,'area'],allowLifeSteal:false,noKnockback:true}); if(ok) applyElementalSouls(system,e,{fireSoul:st.affinities.fire,poisonSoul:st.affinities.poison},'sword_tomb_domain',false); });
}
