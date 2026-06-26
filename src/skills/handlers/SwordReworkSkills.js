import { CombatEvents } from '../../core/CombatEvents.js';
import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';

const PhaserRef = globalThis.Phaser || { Math:{ Distance:{ Between:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1) } } };
const RARITIES = ['COMMON','RARE','EPIC','MYTHIC'];
const MYTHIC_NONE = 'none';
const MYTHIC_MAIN = 'main_sword';
const MYTHIC_TOMB = 'sword_tomb';
const SOUL_THRESHOLDS = [0, 12, 36, 80];
const AFFINITY_DAMAGE = { fire:6, poison:5 };

const nineLevels = (rows, build, milestones={}) => rows.map((row,index)=>({
  ...build(row,index+1),
  ...(milestones[index+1]?{ milestoneText:milestones[index+1] }:{}),
}));

export const SWORD_REWORK_SKILLS = {
  sword_sheath:{
    id:'sword_sheath', name:'剑匣', rarity:'RARE', handler:'sword_sheath', passive:true, maxLevel:9,
    tags:['physical',TAGS.SUMMON,TAGS.PROJECTILE,TAGS.BUILD_SWORD], cooldownMs:999999,
    targetType:'passive', color:0x8fdcff, short:'匣',
    description:'剑匣在身后温养虚幻剑，完成后直线贯穿敌阵并消散。',
    levels:nineLevels([
      [32,2100,520,760,1.00],[38,2000,540,800,1.04],[44,1900,560,840,1.08],[52,1800,585,880,1.12],[60,1700,610,920,1.16],[70,1580,640,960,1.20],[82,1460,670,1000,1.24],[96,1340,705,1040,1.28],[104,1220,740,1100,1.32]
    ],([damage,warmupMs,range,speed,sizeScale],level)=>({ damage,warmupMs,range,speed,sizeScale,volley:level>=9?2:1,desc:level>=9?'温养完成后连续发射两道不返回的虚幻剑。':'温养虚幻剑，完成后高速直线贯穿路径敌人。' }),{9:'连续发射两道虚幻剑'})
  },
  sword_tomb:{
    id:'sword_tomb', name:'剑冢', rarity:'EPIC', handler:'sword_tomb', passive:true, maxLevel:9,
    tags:['physical','soul',TAGS.SUMMON,TAGS.BUILD_SWORD], cooldownMs:999999,
    targetType:'passive', color:0xcbb6ff, short:'冢',
    description:'悬浮剑形王冠周期性魂斩残血敌人，吸魂强化御剑术或自身。',
    levels:nineLevels([
      [42,0.18,2600,160],[52,0.20,2450,175],[64,0.22,2300,190],[78,0.24,2150,205],[94,0.26,2000,220],[114,0.28,1850,235],[138,0.30,1700,250],[166,0.32,1550,265],[200,0.35,1380,285]
    ],([damage,executeRatio,intervalMs,range],level)=>({ damage,executeRatio,intervalMs,range,desc:level>=9?'具备封神资格：魂量足够且神话名额空闲时化为万魂剑域。':'周期性魂斩残血敌人，击杀后吸收魂魄。' }),{9:'获得封神资格'})
  }
};

export function configureSwordReworkSkills(){ Object.entries(SWORD_REWORK_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

function passiveUpdater(system,key,apply){ const updater=()=>apply(system.getData(key),system.getLevel(key)); system.passiveUpdaters.push(updater); updater(); return ()=>{}; }
function swordState(system){ const st=system.passiveState.swordFlow ||= { souls:0, affinities:{fire:0,poison:0}, mainQuality:'COMMON', mythicOwner:MYTHIC_NONE, sheath:null, tomb:null, domain:null }; updateMainQuality(system,st); return st; }
function hasSword(system){ return system.getLevel('sword_wave')>0; }
function soulValue(enemy){ return enemy?.isBoss?20:(enemy?.isElite||enemy?.isMidBoss?5:1); }
function qualityIndex(q){ return Math.max(0,RARITIES.indexOf(q)); }
function updateMainQuality(system,st=swordState(system)){
  if(!hasSword(system)){ st.mainQuality='COMMON'; return st.mainQuality; }
  let idx=0; while(idx<SOUL_THRESHOLDS.length-1 && st.souls>=SOUL_THRESHOLDS[idx+1]) idx+=1;
  if(idx>=3){
    if(st.mythicOwner===MYTHIC_TOMB) idx=2;
    else st.mythicOwner=MYTHIC_MAIN;
  }
  st.mainQuality=RARITIES[idx];
  return st.mainQuality;
}
function mainMods(system, data){ const st=swordState(system), idx=qualityIndex(st.mainQuality); const affinityDamage=(st.affinities.fire||0)*AFFINITY_DAMAGE.fire+(st.affinities.poison||0)*AFFINITY_DAMAGE.poison; return { quality:st.mainQuality, damage:Math.round((data?.damage||28)*(1+idx*0.28)+Math.min(80,st.souls*0.45)+affinityDamage), intervalMs:Math.max(360,Math.round((data?.attackIntervalMs||1200)*(1-idx*0.12))), size:1+idx*0.18, mythic:st.mythicOwner===MYTHIC_MAIN }; }
function lineHitTargets(scene,x1,y1,x2,y2,width){ return scene.targeting.all().filter(e=>PhaserRef.Math.Distance.Between(e.x,e.y,x1,y1)+PhaserRef.Math.Distance.Between(e.x,e.y,x2,y2)<=PhaserRef.Math.Distance.Between(x1,y1,x2,y2)+width); }
function drawLine(scene,x1,y1,x2,y2,color,width=7){ const g=scene.add.line(0,0,x1,y1,x2,y2,color,0.55).setOrigin(0).setDepth(142).setLineWidth(width); scene.tweens.add({targets:g,alpha:0,duration:180,onComplete:()=>g.destroy()}); return g; }
function absorbKill(system,enemy,meta={}){ const st=swordState(system); st.souls += soulValue(enemy); if(meta.burnStacksBeforeDeath>0 || system.scene.statusEffects?.getStackCount?.(enemy,StatusEffects.BURN)>0) st.affinities.fire += 1; if(meta.poisonStacksBeforeDeath>0 || system.scene.statusEffects?.getStackCount?.(enemy,StatusEffects.POISON)>0) st.affinities.poison += 1; updateMainQuality(system,st); }

export const SwordSheathSkill = {
  bind(system){
    return passiveUpdater(system,'sword_sheath',(data,level)=>{
      const s=system.scene, st=swordState(system); if(!data||level<=0){ st.sheath?.view?.destroy?.(); st.sheath=null; return; }
      const now=s.getGameplayTime();
      if(!st.sheath){ st.sheath={ readyAt:now+data.warmupMs, view:s.add.rectangle(s.player.x-88,s.player.y-42,34,58,0x2a3558,0.82).setStrokeStyle(3,0x9deaff,0.8).setDepth(138) }; }
      const sh=st.sheath, dir=s.player.flipX?-1:1; sh.view?.setPosition(s.player.x-dir*82,s.player.y-54+Math.sin(now*0.004)*4)?.setRotation(-0.35*dir);
      if(now<sh.readyAt) return;
      const mods=hasSword(system)?mainMods(system,system.getData('sword_wave')):null;
      const shots=data.volley||1;
      for(let i=0;i<shots;i+=1){
        const x1=s.player.x+dir*(10+i*12), y1=s.player.y-70-i*12, x2=x1+dir*data.range, y2=y1-22;
        const damage=Math.round(data.damage+(mods?.damage||0)*0.45);
        drawLine(s,x1,y1,x2,y2,mods?0xb8f7ff:0x8fdcff,Math.round(6*data.sizeScale*(mods?.size||1)));
        lineHitTargets(s,x1,y1,x2,y2,32*data.sizeScale).forEach(enemy=>s.combatSystem.damageEnemy(enemy,damage,{source:'skill',skillId:'sword_sheath',tags:SKILLS.sword_sheath.tags,allowLifeSteal:false,noKnockback:true}));
      }
      sh.readyAt=now+data.warmupMs;
    });
  }
};

export const SwordTombSkill = {
  bind(system){
    const offKill=system.scene.eventBus.on(CombatEvents.ENEMY_KILLED,(payload={})=>{ if(payload.skillId==='sword_tomb') absorbKill(system,payload.enemy,payload); });
    const updater=()=>{
      let data=system.getData('sword_tomb'), level=system.getLevel('sword_tomb'), s=system.scene, st=swordState(system), now=s.getGameplayTime();
      if(!data||level<=0){ st.tomb?.view?.destroy?.(); st.tomb=null; st.domain?.views?.forEach(v=>v.destroy?.()); st.domain=null; return; }
      if(!st.tomb) st.tomb={ nextAt:now+400, view:s.add.triangle(s.player.x,s.player.y-145,0,34,28,0,56,34,0xcbb6ff,0.8).setStrokeStyle(3,0xffffff,0.55).setDepth(139) };
      st.tomb.view?.setPosition(s.player.x,s.player.y-138+Math.sin(now*0.003)*5);
      if(hasSword(system)) updateMainQuality(system,st); else { data={...data, damage:Math.round(data.damage+st.souls*1.8+(st.affinities.fire||0)*5+(st.affinities.poison||0)*4), executeRatio:Math.min(0.6,data.executeRatio+st.souls*0.002), intervalMs:Math.max(620,data.intervalMs-st.souls*9) }; }
      if(level>=9 && st.souls>=SOUL_THRESHOLDS[3] && st.mythicOwner!==MYTHIC_MAIN) st.mythicOwner=MYTHIC_TOMB;
      if(st.mythicOwner===MYTHIC_TOMB) updateDomain(system,st,data,now);
      if(now<st.tomb.nextAt) return;
      const target=s.targeting.all().filter(e=>PhaserRef.Math.Distance.Between(e.x,e.y,s.player.x,s.player.y)<=data.range).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
      st.tomb.nextAt=now+data.intervalMs;
      if(!target) return;
      drawLine(s,st.tomb.view.x,st.tomb.view.y,target.x,target.y-40,0xcbb6ff,8);
      const hpRatio=target.hp/Math.max(1,target.maxHp||target.hp);
      const damage=target.isBoss?Math.round(data.damage*3.2):hpRatio<=data.executeRatio?target.hp:data.damage;
      s.combatSystem.damageEnemy(target,damage,{source:'skill',skillId:'sword_tomb',tags:SKILLS.sword_tomb.tags,allowLifeSteal:false,noKnockback:true});
    };
    system.passiveUpdaters.push(updater); updater(); return ()=>{ offKill?.(); };
  }
};

function updateDomain(system,st,data,now){
  const s=system.scene; st.domain ||= { lastHit:new Map(), views:[] };
  const count=Math.min(10,3+Math.floor(st.souls/35));
  while(st.domain.views.length<count) st.domain.views.push(s.add.rectangle(s.player.x,s.player.y-92,38,7,0xd8c9ff,0.76).setStrokeStyle(2,0xffffff,0.45).setDepth(137));
  while(st.domain.views.length>count) st.domain.views.pop().destroy();
  st.domain.views.forEach((v,i)=>{ const a=now*0.004+i*Math.PI*2/count; v.setPosition(s.player.x+Math.cos(a)*118,s.player.y-70+Math.sin(a)*58).setRotation(a); });
  const radius=170, damage=Math.round(data.damage*0.32+st.souls*0.22+(st.affinities.fire||0)*3+(st.affinities.poison||0)*3);
  s.targeting.all().filter(e=>PhaserRef.Math.Distance.Between(e.x,e.y,s.player.x,s.player.y)<=radius).forEach(e=>{ const next=st.domain.lastHit.get(e)||0; if(now<next) return; st.domain.lastHit.set(e,now+520); s.combatSystem.damageEnemy(e,damage,{source:'skill',skillId:'sword_tomb',damageKind:'soulDomain',tags:[...SKILLS.sword_tomb.tags,'area'],allowLifeSteal:false,noKnockback:true}); });
}
