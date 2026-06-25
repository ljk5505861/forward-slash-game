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
      [1,12,1500],[1,15,1420],[2,15,1360],[2,18,1280],[2,21,1210],[3,22,1140],[3,26,1070],[3,30,1000],[4,34,920]
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
    targetType:'nearestAhead', color:0xc8fbff, short:'旋',
    description:'驱使飞剑高速旋转贯穿前方敌群，适合穿透清场。',
    levels:levels([
      [3,22,430,4400],[3,26,450,4200],[4,28,470,4050],[4,33,490,3900],[5,36,510,3750],[5,42,530,3600],[6,46,550,3450],[6,52,575,3300],[7,60,610,3100]
    ],([pierce,damage,range,cooldownMs])=>({ pierce,damage,range,cooldownMs,width:64,desc:`贯穿前方最多${pierce}个敌人，造成${damage}点伤害。` }),{
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
    const targets=s.targeting.all()
      .filter(e=>e.x>=s.player.x-20&&e.x-s.player.x<=data.range&&Math.abs(e.y-s.player.y)<170)
      .sort((a,b)=>a.x-b.x)
      .slice(0,data.pierce);
    if(!targets.length) return;
    const sword=s.flyingSwords.createSword({ ownerSkillId:'rotating_sword', type:'rotating', temporary:true, durationMs:360, color:cfg.color, inheritedTags:cfg.tags });
    const finalTarget=targets[targets.length-1];
    s.flyingSwords.markAttack(sword.id,finalTarget,{ skillId:'rotating_sword', tags:cfg.tags, piercing:true, targetCount:targets.length });
    const slash=s.add.rectangle(s.player.x+data.range*0.45,s.player.y-58,data.range,data.width,cfg.color,0.28).setDepth(132);
    s.tweens.add({ targets:slash, angle:360, alpha:0, duration:320, onComplete:()=>slash.destroy() });
    targets.forEach(target=>system.hit(target,system.damageValue(data.damage,ctx),cfg,level,ctx,system.baseDamageValue(data.damage,ctx)));
  }
};
