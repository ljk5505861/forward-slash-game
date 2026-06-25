import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';

const levels = (values, build, milestones={}) => values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}),
}));

const SWORD_CORE_SKILLS = {
  split_sword: {
    id:'split_sword', name:'分剑术', rarity:'RARE', handler:'split_sword', passive:true, maxLevel:9,
    coreSkill:true, requiredSkillId:'sword_wave',
    tags:['physical',TAGS.SUMMON,TAGS.PROJECTILE,TAGS.BUILD_SWORD], cooldownMs:999999,
    targetType:'passive', color:0x9deaff, short:'分',
    description:'分化出额外常驻飞剑，独立出击并参与其他飞剑联动。',
    levels:levels([
      [1,24,1500],[1,30,1420],[2,30,1360],[2,36,1280],[2,42,1210],[3,44,1140],[3,52,1070],[3,60,1000],[4,68,920]
    ],([extraSwords,damage,attackIntervalMs])=>({ extraSwords,damage,attackIntervalMs,desc:`额外维持${extraSwords}把分化飞剑，单次造成${damage}点伤害。` }),{
      3:'额外飞剑增加至2把',
      6:'额外飞剑增加至3把',
      9:'额外飞剑增加至4把'
    })
  },
  rotating_sword: {
    id:'rotating_sword', name:'旋转剑', rarity:'RARE', handler:'rotating_sword', maxLevel:9,
    coreSkill:true, requiredSkillId:'sword_wave',
    tags:['physical',TAGS.SUMMON,TAGS.PROJECTILE,TAGS.ACTIVE_SKILL,TAGS.BUILD_SWORD], cooldownMs:4400,
    targetType:'self', color:0xc8fbff, short:'旋',
    description:'驱使飞剑向前贯穿敌群，飞至远处后升空折返，再次贯穿沿途敌人。',
    levels:levels([
      [3,44,430,4400],[3,52,450,4200],[4,56,470,4050],[4,66,490,3900],[5,72,510,3750],[5,84,530,3600],[6,92,550,3450],[6,104,575,3300],[7,120,610,3100]
    ],([pierce,damage,range,cooldownMs],level)=>({ pierce,damage,range,cooldownMs,width:64,outboundDurationMs:Math.max(360,460-level*10),riseDurationMs:220,returnDurationMs:Math.max(420,520-level*10),returnHeight:220,desc:`去程与回程均可分别贯穿最多${pierce}个敌人，每次造成${damage}点伤害。` }),{
      3:'贯穿目标增加至4个',
      6:'贯穿目标增加至5个，射程提高至530',
      9:'贯穿目标增加至7个，射程提高至610'
    })
  }
};

export function configureSwordCoreSkills(){
  Object.entries(SWORD_CORE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; });
}

export const SplitSwordSkill={
  bind(system){
    const readyAt=new Map();
    const updater=()=>{
      const s=system.scene;
      const data=system.getData('split_sword');
      const level=system.getLevel('split_sword');
      const owned=s.flyingSwords?.getAll().filter(x=>x.ownerSkillId==='split_sword')||[];
      if(!data||level<=0){ owned.forEach(x=>s.flyingSwords.removeSword(x.id,'skillRemoved')); readyAt.clear(); return; }
      while(owned.length<data.extraSwords){
        const sword=s.flyingSwords.createSword({ ownerSkillId:'split_sword', type:'split', damageScale:1, color:0x9deaff, inheritedTags:SKILLS.split_sword.tags });
        owned.push(sword);
        readyAt.set(sword.id,s.getGameplayTime()+owned.length*120);
      }
      while(owned.length>data.extraSwords){ const sword=owned.pop(); readyAt.delete(sword.id); s.flyingSwords.removeSword(sword.id,'countReduced'); }
      const now=s.getGameplayTime();
      owned.forEach(sword=>{
        if(sword.attackEndsAt&&now>=sword.attackEndsAt){
          const target=sword.target;
          if(s.targeting.valid(target)) s.combatSystem.damageEnemy(target,data.damage,{ source:'skill', skillId:'split_sword', tags:SKILLS.split_sword.tags, allowLifeSteal:false });
          sword.attackEndsAt=0;
          s.flyingSwords.returnToOrbit(sword.id);
          readyAt.set(sword.id,now+data.attackIntervalMs);
          return;
        }
        if(sword.state!=='orbit'||now<(readyAt.get(sword.id)||0)) return;
        const target=s.targeting.nearestAhead(760);
        if(!target) return;
        s.flyingSwords.markAttack(sword.id,target,{ skillId:'split_sword', tags:SKILLS.split_sword.tags });
        sword.attackEndsAt=now+180;
      });
    };
    system.passiveUpdaters.push(updater);
    updater();
    return ()=>{};
  }
};

export const RotatingSwordSkill={
  cast(system,cfg,data,level,ctx){
    const s=system.scene;
    const startX=s.player.x+34;
    const startY=s.player.y-72;
    const endX=s.player.x+data.range;
    const endY=startY;
    const peakY=startY-(data.returnHeight||220);
    const outboundHitTargets=new Set();
    const returnHitTargets=new Set();
    const sword=s.flyingSwords.createSword({ ownerSkillId:'rotating_sword', type:'rotating', temporary:true, visible:false, durationMs:(data.outboundDurationMs||420)+(data.riseDurationMs||220)+(data.returnDurationMs||480)+220, color:cfg.color, inheritedTags:cfg.tags });
    const blade=s.add.rectangle(startX,startY,54,9,cfg.color,0.96).setStrokeStyle(2,0xffffff,0.85).setDepth(150);
    const glow=s.add.rectangle(startX-18,startY,72,16,cfg.color,0.22).setDepth(149);
    const trail=s.add.graphics().setDepth(148);
    const hitFlash=(x,y)=>{ const f=s.add.circle(x,y,24,cfg.color,0.28).setStrokeStyle(2,0xffffff,0.7).setDepth(151); s.tweens.add({targets:f,alpha:0,scale:1.4,duration:180,onComplete:()=>f.destroy()}); };
    const distanceToSegment=(px,py,ax,ay,bx,by)=>{
      const dx=bx-ax, dy=by-ay, lenSq=dx*dx+dy*dy;
      if(lenSq<=0.0001) return Math.hypot(px-ax,py-ay);
      const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/lenSq));
      return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
    };
    const cleanup=()=>{
      if(active.ended) return;
      active.ended=true;
      outboundHitTargets.clear();
      returnHitTargets.clear();
      trail.destroy();
      blade.destroy();
      glow.destroy();
      s.flyingSwords.removeSword(sword.id,'rotatingSwordEnded');
    };
    const hitAtSegment=(ax,ay,bx,by,phase)=>{
      const hitSet=phase==='outbound'?outboundHitTargets:returnHitTargets;
      const countKey=phase==='outbound'?'outboundHitCount':'returnHitCount';
      if(active[countKey]>=data.pierce) return;
      s.targeting.all().forEach(target=>{
        if(active[countKey]>=data.pierce||!s.targeting.valid(target)||hitSet.has(target)) return;
        const radius=Math.max(18,(target.displayWidth||target.width||36)*0.35);
        if(distanceToSegment(target.x,target.y-45,ax,ay,bx,by)>(data.width*0.5+radius)) return;
        hitSet.add(target);
        active[countKey]+=1;
        s.flyingSwords.markAttack(sword.id,target,{ source:'skill', skillId:'rotating_sword', tags:cfg.tags, sword:true, phase, piercing:true, targetCount:active[countKey] });
        const damaged=system.hit(target,system.damageValue(data.damage,ctx),cfg,level,{ ...ctx, noRangerMark:true },system.baseDamageValue(data.damage,ctx));
        if(damaged) hitFlash(target.x,target.y-55);
      });
    };
    const active={ skillId:cfg.id,cfg,data,level,ctx,nextAt:s.getGameplayTime(),endAt:s.getGameplayTime()+(data.outboundDurationMs||420)+(data.riseDurationMs||220)+(data.returnDurationMs||480)+80,ended:false,outboundHitCount:0,returnHitCount:0,lastX:startX,lastY:startY,
      tick(){
        if(this.ended||!s.player||s.playerData.hp<=0){ cleanup(); return; }
        const now=s.getGameplayTime();
        const elapsed=now-(this.startedAt||(this.startedAt=now));
        const outboundMs=data.outboundDurationMs||420, riseMs=data.riseDurationMs||220, returnMs=data.returnDurationMs||480;
        let x,y,phase;
        if(elapsed<=outboundMs){ const t=elapsed/outboundMs; x=startX+(endX-startX)*t; y=startY; phase='outbound'; }
        else if(elapsed<=outboundMs+riseMs){ const t=(elapsed-outboundMs)/riseMs; x=endX; y=endY+(peakY-endY)*t; phase='rise'; }
        else if(elapsed<=outboundMs+riseMs+returnMs){ const t=(elapsed-outboundMs-riseMs)/returnMs; const targetX=s.player.x+28, targetY=s.player.y-80; x=endX+(targetX-endX)*t; y=peakY+(targetY-peakY)*t; phase='return'; }
        else { cleanup(); return; }
        const angle=Math.atan2(y-this.lastY,x-this.lastX);
        blade.setPosition(x,y).setRotation(angle);
        glow.setPosition((x+this.lastX)/2,(y+this.lastY)/2).setRotation(angle);
        trail.clear(); trail.lineStyle(6,cfg.color,0.28); trail.lineBetween(this.lastX,this.lastY,x,y);
        if(phase==='outbound'||phase==='return') hitAtSegment(this.lastX,this.lastY,x,y,phase==='outbound'?'outbound':'return');
        this.lastX=x; this.lastY=y; this.nextAt=s.getGameplayTime();
      },
      onEnd:cleanup
    };
    system.active.push(active);
    return { cast:true };
  }
};
