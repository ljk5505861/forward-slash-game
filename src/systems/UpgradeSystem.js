import Phaser from 'phaser';
import { SKILLS } from '../config/skills.js';
import { RunStates, CombatEvents } from '../core/CombatEvents.js';
export const ATTRIBUTE_UPGRADES = [
  { id:'attack_15', title:'攻击力 +15%', apply:p=>{p.attack=Math.round(p.attack*1.15);} }, { id:'hp_20', title:'最大生命 +20', apply:p=>{p.maxHp+=20;p.hp=Math.min(p.maxHp,p.hp+20);} }, { id:'as_10', title:'攻击速度 +10%', apply:p=>{p.attackSpeedMultiplier+=0.1;} }, { id:'skill_15', title:'技能伤害 +15%', apply:p=>{p.skillDamageMultiplier+=0.15;} }, { id:'cdr_8', title:'冷却缩减 +8%', apply:p=>{p.cooldownReduction=Math.min(0.5,p.cooldownReduction+0.08);} }, { id:'crit_5', title:'暴击率 +5%', apply:p=>{p.critChance=Math.min(0.8,p.critChance+0.05);} },
];
export default class UpgradeSystem {
  constructor(scene){ this.scene=scene; this.pending=0; this.panelOpen=false; }
  reset(){ this.pending=0; this.panelOpen=false; }
  gainExperience(amount, { defer=false }={}){ const p=this.scene.playerData; p.xp+=amount; while(p.xp>=p.xpToNext){ p.xp-=p.xpToNext; p.level+=1; p.xpToNext+=28; this.pending+=1; } this.scene.hud?.update(); if(!defer) this.maybeShow(); }
  maybeShow(){ const s=this.scene; if(this.panelOpen||this.pending<=0) return; if(s.upgradePanel?.isOpen||s.rewardPanel?.isOpen||s.resultPanel?.isOpen) return; if([RunStates.REWARD,RunStates.VICTORY,RunStates.DEFEAT].includes(s.runState)) return; this.panelOpen=true; s.beginGameplayPause?.(); s.runState=RunStates.UPGRADING; s.eventBus.emit(CombatEvents.LEVEL_UP,{ level:s.playerData.level }); s.upgradePanel.show('升级三选一', this.rollOptions(), (o)=>this.applyOption(o)); }
  rollOptions(){ const p=this.scene.playerData; const opts=[]; Object.values(SKILLS).forEach(skill=>{ const own=p.skills.find(s=>s.id===skill.id); if(!own) opts.push({ type:'newSkill', id:`new_${skill.id}`, title:`获得技能：${skill.name}`, skillId:skill.id }); else if(own.level<skill.maxLevel) opts.push({ type:'skillLevel', id:`lv_${skill.id}`, title:`升级技能：${skill.name} Lv.${own.level+1}`, skillId:skill.id }); }); ATTRIBUTE_UPGRADES.forEach(a=>opts.push({ type:'attr', id:a.id, title:a.title, attr:a })); return Phaser.Utils.Array.Shuffle(opts).filter((o,i,a)=>a.findIndex(x=>x.id===o.id)===i).slice(0,3); }
  applyOption(o){ const p=this.scene.playerData; if(o.type==='newSkill'||o.type==='skillLevel') this.scene.skillSystem.addOrLevel(o.skillId); if(o.type==='attr') o.attr.apply(p); p.upgradesChosen.push(o.id); this.pending=Math.max(0,this.pending-1); this.panelOpen=false; this.scene.upgradePanel.hide(); this.scene.hud?.update(); this.scene.resumeModalFlow(); }
}
