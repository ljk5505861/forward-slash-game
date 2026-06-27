import { getEffectiveAttack, getTotalStrength } from '../config/balance.js';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { SKILLS } from '../config/skills.js';
import { ARTIFACTS } from '../config/artifacts.js';
import { PROFESSIONS } from '../config/professions.js';

const DEPTH=4300;
export default class PlayerInfoPanel {
  constructor(scene){ this.scene=scene; this.nodes=[]; this.content=[]; this.page=0; this.isOpen=false; }
  show(){ if(this.isOpen) return; this.isOpen=true; this.page=0; const s=this.scene; s.beginGameplayPause?.();
    this.nodes.push(s.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,DESIGN_WIDTH,DESIGN_HEIGHT,0x030712,0.48).setScrollFactor(0).setDepth(DEPTH));
    this.nodes.push(s.add.rectangle(DESIGN_WIDTH/2,620,620,640,0x0b1020,0.96).setStrokeStyle(4,0x7da7ff,0.86).setScrollFactor(0).setDepth(DEPTH+1));
    this.title=this.text(DESIGN_WIDTH/2,330,'角色信息',{fontSize:'34px',color:'#fff'},[0.5,0]);
    const close=this.text(DESIGN_WIDTH/2+266,326,'×',{fontSize:'40px',color:'#fff',backgroundColor:'#633',padding:{left:14,right:14,top:2,bottom:2}},[0.5,0]).setInteractive({useHandCursor:true}); close.on('pointerdown',()=>this.hide());
    const prev=this.text(DESIGN_WIDTH/2-245,885,'‹',{fontSize:'46px',color:'#dbeafe',backgroundColor:'#24324f',padding:{left:20,right:20,top:0,bottom:0}},[0.5,0]).setInteractive({useHandCursor:true}); prev.on('pointerdown',()=>this.flip(-1));
    const next=this.text(DESIGN_WIDTH/2+245,885,'›',{fontSize:'46px',color:'#dbeafe',backgroundColor:'#24324f',padding:{left:20,right:20,top:0,bottom:0}},[0.5,0]).setInteractive({useHandCursor:true}); next.on('pointerdown',()=>this.flip(1));
    this.pageText=this.text(DESIGN_WIDTH/2,900,'1/2',{fontSize:'22px',color:'#cbd6ee'},[0.5,0]);
    this.render(); }
  text(x,y,t,style={},origin=[0,0]){ const n=this.scene.add.text(x,y,t,{fontFamily:'Arial',fontSize:'22px',color:'#e5edff',stroke:'#000',strokeThickness:3,lineSpacing:8,wordWrap:{width:540,useAdvancedWrap:true},...style}).setOrigin(...origin).setScrollFactor(0).setDepth(DEPTH+2); this.nodes.push(n); return n; }
  flip(d){ this.page=(this.page+d+2)%2; this.render(); }
  render(){ this.content.forEach(n=>n.destroy()); this.content=[]; this.pageText?.setText(`${this.page+1}/2`); const p=this.scene.playerData; if(this.page===0) this.renderList('基础属性', [ ['攻击力',getEffectiveAttack(p)],['力量',getTotalStrength(p)],['法术强度',p.spellPower??0],['攻击速度',`${Math.round((p.attackSpeedMultiplier||1)*100)}%`],['护甲',p.defense??0],['闪避率',`${Math.round((p.dodgeChance||0)*100)}%`],['最大生命',p.maxHp],['当前生命',p.hp],['最大法力',p.maxMana??0],['当前法力',p.mana??0],['暴击率',`${Math.round((p.critChance||0)*100)}%`],['暴击伤害',`${Math.round((p.critMultiplier||1.5)*100)}%`],['技能急速',`${Math.round((p.skillHaste||0)*100)}%`],['冷却缩减',`${Math.round((p.cooldownReduction||0)*100)}%`],['吸血',`${Math.round((p.lifeSteal||0)*100)}%`],['技能伤害倍率',`${Math.round((p.skillDamageMultiplier||1)*100)}%`],['普攻伤害倍率',`${Math.round((p.normalAttackDamageMultiplier||1)*100)}%`] ]); else this.renderBuild(); }
  addContent(n){ this.content.push(n); this.nodes.push(n); return n; }
  renderList(title, rows){ this.addContent(this.scene.add.text(DESIGN_WIDTH/2,388,title,{fontFamily:'Arial',fontSize:'28px',color:'#9fd0ff',stroke:'#000',strokeThickness:3}).setOrigin(0.5,0).setScrollFactor(0).setDepth(DEPTH+2)); rows.forEach(([k,v],i)=>{ const col=i%2,row=Math.floor(i/2),x=DESIGN_WIDTH/2-250+col*270,y=442+row*48; this.addContent(this.scene.add.text(x,y,`${k}：${v ?? 0}`,{fontFamily:'Arial',fontSize:'21px',color:'#f2f6ff',stroke:'#000',strokeThickness:3}).setScrollFactor(0).setDepth(DEPTH+2)); }); }
  renderBuild(){ const p=this.scene.playerData, prof=PROFESSIONS[p.professionId]?.name||'未觉醒'; const skills=p.skills.map(s=>`${SKILLS[s.id]?.name||s.id} Lv.${s.level}`).join('\n')||'无'; const arts=p.artifacts.map(a=>ARTIFACTS[typeof a==='string'?a:a.id]?.name||(typeof a==='string'?a:a.id)).join('、')||'无'; const lines=[`当前阶段：${this.scene.stageSystem?.phase?.()?.name||'-'}`,`当前等级：${p.level}`,`进度等级：${p.level}`,`法力：${p.mana??0}/${p.maxMana??0}`,`体力：${p.stamina??0}/${p.maxStamina??0}`,`二阶职业：${p.advancedProfessionId||'未进阶'}`,`击杀数：${this.scene.killCount}`,`runState：${this.scene.runState}`,`护盾：${p.shield||0}/${p.maxShield||0}`,`战意：${p.battleMarkStacks||0}`,`破军：${this.scene.artifactSystem?.highHpDamageMultiplier?.()>1?'ON':'OFF'}`,`减伤：${Math.round((p.temporaryDamageReduction||p.damageReduction||0)*100)}%`,`职业：${prof}`,`技能：\n${skills}`,`法宝：${arts}`]; this.addContent(this.scene.add.text(DESIGN_WIDTH/2-260,392,lines.join('\n'),{fontFamily:'Arial',fontSize:'22px',color:'#f2f6ff',stroke:'#000',strokeThickness:3,lineSpacing:10,wordWrap:{width:520,useAdvancedWrap:true}}).setScrollFactor(0).setDepth(DEPTH+2)); }
  hide(){ if(!this.isOpen) return; this.nodes.forEach(n=>{n.removeAllListeners?.();n.destroy();}); this.nodes=[]; this.content=[]; this.isOpen=false; this.scene.resumeModalFlow?.(); }
  destroy(){ this.hide(); }
}
