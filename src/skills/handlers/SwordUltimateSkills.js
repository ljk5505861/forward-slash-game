import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { mergeTags } from '../../utils/tagUtils.js';

const levels = (values, build, milestones={}) => values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{ milestoneText:milestones[index+1] }:{}),
}));

const HEAVEN_LEVELS = [
  [320,64,1800,450,8,700,16000,760,132,3,2,16,0.34],
  [360,76,1900,440,9,675,15300,790,136,3,2,18,0.36],
  [410,90,2000,430,10,650,14600,830,150,3,2,20,0.38],
  [470,108,2150,420,11,625,13900,860,156,3,2,22,0.40],
  [540,128,2300,410,12,600,13200,900,162,3,2,24,0.42],
  [620,152,2450,400,13,575,12500,940,176,4,3,27,0.44],
  [710,180,2600,390,14,550,12000,980,184,4,3,30,0.46],
  [810,212,2800,375,15,525,11500,1020,192,4,3,34,0.48],
  [940,244,3000,360,16,500,11000,1080,208,5,4,38,0.50],
];

const SWORD_ULTIMATE_SKILLS = {
  heaven_splitting_sword: {
    id:'heaven_splitting_sword', name:'一剑开天', rarity:'MYTHIC', handler:'heaven_splitting_sword', maxLevel:9,
    requiredSkillId:'myriad_swords', ultimateSkill:true,
    tags:['physical',TAGS.SUMMON,TAGS.PROJECTILE,TAGS.ACTIVE_SKILL,TAGS.BUILD_SWORD], cooldownMs:16000,
    targetType:'self', color:0xeafcff, short:'天',
    description:'万剑归一，短暂收拢当前飞剑后向前挥出贯穿战场的一剑，并留下继承飞剑属性的深渊裂隙。',
    levels:levels(HEAVEN_LEVELS,([waveDamage,abyssDamage,abyssDurationMs,abyssTickMs,maxTargets,chargeMs,cooldownMs,range,width,affinityCap,statusCap,shieldValue,afterimageScale],level)=>({
      waveDamage, abyssDamage, abyssDurationMs, abyssTickMs, maxTargets, chargeMs, cooldownMs, range, width, affinityCap, statusCap, shieldValue, afterimageScale,
      closingDamage:level>=9?Math.round(waveDamage*0.42):0,
      desc:`收拢飞剑蓄势${(chargeMs/1000).toFixed(2)}秒，斩出${waveDamage}点贯穿剑光，并留下${(abyssDurationMs/1000).toFixed(1)}秒深渊。`
    }),{
      3:'剑光和深渊宽度增加',
      6:'属性效果上限提高',
      9:'深渊结束时闭合造成一次伤害'
    })
  }
};

export function configureSwordUltimateSkills(){
  Object.entries(SWORD_ULTIMATE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; });
}

const validEnemy = (s,e)=>s.targeting?.valid?.(e)&&s.targeting?.isEnemyFullyInsideViewport?.(e);
const pointInSlash = (enemy,startX,startY,dir,range,width)=>{
  const dx=(enemy.x-startX)*dir;
  if(dx<0||dx>range) return false;
  return Math.abs((enemy.y-48)-startY)<=width*0.5;
};
const affinityCount = (snapshot,key,cap)=>Math.min(cap,Math.max(0,snapshot?.affinityCounts?.[key]||0));

export const HeavenSplittingSwordSkill = {
  cast(system,cfg,data,level,ctx){
    const s=system.scene;
    const previous=system.active.filter(a=>a.skillId===cfg.id);
    previous.forEach(a=>{ a.ended=true; a.onEnd?.(); });
    system.active=system.active.filter(a=>a.skillId!==cfg.id);

    const now=s.getGameplayTime();
    const dir=s.player?.flipX?-1:1;
    const gathered=(s.flyingSwords?.getAll?.()||[]).filter(sword=>!sword.shadowSword);
    const affinitySnapshot=s.flyingSwords?.getAffinitySnapshot?.(gathered)||{ totalSwordCount:gathered.length, normalSwordCount:gathered.length, affinityCounts:{ fire:0, poison:0, blood:0, shield:0, afterimage:0 } };
    const saved=gathered.map((sword,index)=>({
      id:sword.id, state:sword.state, target:sword.target, attackEndsAt:sword.attackEndsAt, nextMyriadAttackAt:sword.nextMyriadAttackAt,
      visible:sword.view?.visible!==false, x:sword.view?.x, y:sword.view?.y, rotation:sword.view?.rotation, index
    }));
    gathered.forEach((sword,index)=>{
      sword.state='gathered';
      sword.target=null;
      if(sword.attackEndsAt) sword.attackEndsAt=Math.max(sword.attackEndsAt,now+data.chargeMs+120);
      if(sword.nextMyriadAttackAt) sword.nextMyriadAttackAt=Math.max(sword.nextMyriadAttackAt,now+data.chargeMs+120);
      if(sword.view){
        sword.view.setVisible?.(true);
        const tx=s.player.x+dir*(54+index*5);
        const ty=s.player.y-78+(index%5-2)*8;
        s.tweens.add({ targets:sword.view, x:tx, y:ty, rotation:dir>0?0:Math.PI, duration:data.chargeMs, ease:'Sine.easeOut' });
      }
    });

    const charge=s.add.circle(s.player.x+dir*58,s.player.y-76,34,cfg.color,0.22).setStrokeStyle(4,0xffffff,0.85).setDepth(146);
    const visuals=[charge];
    s.tweens.add({ targets:charge, scale:1.9, alpha:0.05, duration:data.chargeMs, onComplete:()=>charge.destroy() });

    const active={
      skillId:cfg.id,cfg,data,level,ctx,nextAt:now+data.chargeMs,endAt:now+data.chargeMs+data.abyssDurationMs+450,data:{ intervalMs:50 },
      phase:'charging', startedAt:now, chargeAt:now+data.chargeMs, nextAbyssAt:0, abyssEndAt:0, ended:false,
      gathered:saved, affinitySnapshot, visuals, abyss:null, releasePath:null, closed:false, afterimageDone:false,
      tick(){
        const time=s.getGameplayTime();
        if(this.phase==='charging'){
          if(time<this.chargeAt) return;
          this.phase='abyss';
          this.abyssEndAt=time+data.abyssDurationMs;
          this.nextAbyssAt=time;
          this.releasePath={ startX:s.player.x+dir*72, startY:s.player.y-66, dir, range:data.range, width:data.width };
          this.releaseWave(false);
          this.createAbyss();
          this.restoreSwords();
          return;
        }
        if(this.phase==='abyss'){
          while(time>=this.nextAbyssAt&&this.nextAbyssAt<this.abyssEndAt&&!this.ended){
            this.tickAbyss();
            this.nextAbyssAt+=data.abyssTickMs;
          }
          if(!this.afterimageDone&&affinityCount(this.affinitySnapshot,'afterimage',data.affinityCap)>0&&time>=this.chargeAt+180){
            this.afterimageDone=true;
            this.releaseWave(true);
          }
          if(time>=this.abyssEndAt){
            if(data.closingDamage&&!this.closed){ this.closed=true; this.releaseClosing(); }
            this.ended=true;
          }
        }
      },
      path(){ return this.releasePath; },
      targets(mult=1){
        const p=this.path();
        if(!p) return [];
        return s.targeting.all().filter(e=>validEnemy(s,e)&&pointInSlash(e,p.startX,p.startY,p.dir,p.range,p.width*mult)).sort((a,b)=>(a.x-b.x)*p.dir).slice(0,data.maxTargets);
      },
      releaseWave(afterimage=false){
        const p=this.path();
        if(!p) return;
        const color=afterimage?0xb9caff:cfg.color;
        const alpha=afterimage?0.25:0.48;
        const rect=s.add.rectangle(p.startX+p.dir*p.range*0.5,p.startY,p.range,p.width,color,alpha).setDepth(afterimage?143:148);
        rect.rotation=0;
        this.visuals.push(rect);
        s.tweens.add({ targets:rect, x:rect.x+p.dir*90, alpha:0, scaleY:afterimage?0.65:1.1, duration:afterimage?220:300, onComplete:()=>rect.destroy() });
        const hit=new Set();
        const scale=afterimage?(data.afterimageScale+0.04*Math.max(0,affinityCount(this.affinitySnapshot,'afterimage',data.affinityCap)-1)):1;
        this.targets(afterimage?0.72:1).forEach(enemy=>{
          if(hit.has(enemy)) return;
          hit.add(enemy);
          const amount=system.damageValue(data.waveDamage*scale,ctx);
          s.combatSystem.damageEnemy(enemy,amount,{ source:'skill', skillId:cfg.id, damageKind:afterimage?'heavenSplitAfterimage':'heavenSplitWave', tags:mergeTags(cfg.tags), level, allowLifeSteal:false, noKnockback:true, noSwordTrigger:true, noHeavenSplit:true, noDeathExplosion:true, noPoisonSpread:true, professionApplied:true, professionMultiplier:ctx?.professionMultiplier||1, baseAmountBeforeProfession:system.baseDamageValue(data.waveDamage*scale,ctx) });
        });
      },
      createAbyss(){
        const p=this.path();
        if(!p) return;
        const g=s.add.graphics().setDepth(126);
        const fire=affinityCount(this.affinitySnapshot,'fire',data.affinityCap)>0;
        const poison=affinityCount(this.affinitySnapshot,'poison',data.affinityCap)>0;
        const blood=affinityCount(this.affinitySnapshot,'blood',data.affinityCap)>0;
        const shield=affinityCount(this.affinitySnapshot,'shield',data.affinityCap)>0;
        const left=p.dir>0?p.startX:p.startX-p.range;
        g.fillStyle(0x1b1026,0.44); g.fillRect(left,p.startY-p.width*0.28,p.range,p.width*0.56);
        g.lineStyle(3,fire?0xff6a2a:poison?0x54e878:blood?0x8b1428:shield?0xaeefff:0xeafcff,0.82); g.lineBetween(p.startX,p.startY,p.startX+p.dir*p.range,p.startY);
        this.abyss=g; this.visuals.push(g);
        s.tweens.add({ targets:g, alpha:0.2, yoyo:true, repeat:Math.max(1,Math.floor(data.abyssDurationMs/260)), duration:130, onComplete:()=>g.destroy() });
      },
      tickAbyss(){
        const hit=new Set();
        this.targets(0.72).forEach(enemy=>{
          if(hit.has(enemy)) return;
          hit.add(enemy);
          s.combatSystem.damageEnemy(enemy,system.damageValue(data.abyssDamage,ctx),{ source:'skill', skillId:cfg.id, damageKind:'heavenSplitAbyss', tags:mergeTags(cfg.tags), level, allowLifeSteal:false, noKnockback:true, noSwordTrigger:true, noHeavenSplit:true, noDeathExplosion:true, noPoisonSpread:true, professionApplied:true, professionMultiplier:ctx?.professionMultiplier||1, baseAmountBeforeProfession:system.baseDamageValue(data.abyssDamage,ctx) });
          const fire=affinityCount(this.affinitySnapshot,'fire',data.affinityCap);
          if(fire>0){
            const fireDamage=system.damageValue(5+fire*3,ctx);
            s.combatSystem.damageEnemy(enemy,fireDamage,{ source:'skill', skillId:cfg.id, damageKind:'heavenSplitFireAbyss', tags:[TAGS.FIRE,TAGS.DOT], allowLifeSteal:false, noKnockback:true, noSwordTrigger:true, noHeavenSplit:true, noDeathExplosion:true, noPoisonSpread:true, professionApplied:true, professionMultiplier:ctx?.professionMultiplier||1, baseAmountBeforeProfession:system.baseDamageValue(5+fire*3,ctx) });
            s.statusEffects.add(StatusEffects.BURN,enemy,{ durationMs:2200, intervalMs:700, value:2+fire, stacks:Math.min(data.statusCap,fire), maxStacks:10, sourceId:'heaven_split_fire_abyss', damageMultiplier:ctx?.damageMultiplier||1, baseDamageMultiplierWithoutProfession:ctx?.baseDamageMultiplierWithoutProfession||1, professionMultiplier:ctx?.professionMultiplier||1, professionApplied:true, noDeathExplosion:true, noPoisonSpread:true, noHeavenSplit:true, noSwordTrigger:true });
          }
          const poison=affinityCount(this.affinitySnapshot,'poison',data.affinityCap);
          if(poison>0){
            s.statusEffects.add(StatusEffects.POISON,enemy,{ durationMs:2600+poison*300, intervalMs:700, value:2+poison, stacks:Math.min(data.statusCap,poison), maxStacks:12, sourceId:'heaven_split_poison_abyss', canSpread:false, damageMultiplier:ctx?.damageMultiplier||1, baseDamageMultiplierWithoutProfession:ctx?.baseDamageMultiplierWithoutProfession||1, professionMultiplier:ctx?.professionMultiplier||1, professionApplied:true, noDeathExplosion:true, noPoisonSpread:true, noHeavenSplit:true, noSwordTrigger:true });
          }
        });
      },
      releaseClosing(){
        const hit=new Set();
        this.targets(0.82).forEach(enemy=>{
          if(hit.has(enemy)) return;
          hit.add(enemy);
          s.combatSystem.damageEnemy(enemy,system.damageValue(data.closingDamage,ctx),{ source:'skill', skillId:cfg.id, damageKind:'heavenSplitClosing', tags:mergeTags(cfg.tags), level, allowLifeSteal:false, noKnockback:true, noSwordTrigger:true, noHeavenSplit:true, noDeathExplosion:true, noPoisonSpread:true, professionApplied:true, professionMultiplier:ctx?.professionMultiplier||1, baseAmountBeforeProfession:system.baseDamageValue(data.closingDamage,ctx) });
        });
      },
      restoreSwords(){
        this.gathered.forEach(snapshot=>{
          const sword=s.flyingSwords?.getById?.(snapshot.id);
          if(!sword) return;
          sword.state=snapshot.state==='gathered'?'orbit':snapshot.state;
          sword.target=snapshot.target;
          sword.attackEndsAt=snapshot.attackEndsAt;
          sword.nextMyriadAttackAt=snapshot.nextMyriadAttackAt;
          if(sword.view){ sword.view.setVisible?.(snapshot.visible); }
          if(sword.state==='attack'&&!s.targeting.valid(sword.target)) s.flyingSwords.returnToOrbit(sword.id);
        });
        this.gathered=[];
        const shield=affinityCount(this.affinitySnapshot,'shield',data.affinityCap);
        if(shield>0){
          const amount=Math.min(data.shieldValue*data.affinityCap,data.shieldValue+(shield-1)*8);
          s.statusEffects?.add(StatusEffects.SHIELD,s.playerData,{ durationMs:5200, value:amount, remainingValue:amount, sourceId:'heaven_split_shield_abyss' });
          s.hud?.update?.();
        }
      },
      onEnd(){
        this.restoreSwords();
        this.visuals?.forEach(o=>{ o?.destroy?.(); });
        this.visuals=[]; this.abyss=null; this.releasePath=null; this.affinitySnapshot=null; this.gathered=[]; this.ended=true;
      }
    };
    system.active.push(active);
    s.floatText?.(s.player.x,s.player.y-128,'一剑开天','#eafcff');
    s.eventBus?.emit?.(CombatEvents.SKILL_HIT,{ skill:cfg, level, tags:cfg.tags, chargeOnly:true });
  }
};
