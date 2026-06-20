import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { getProfessionChoices } from '../config/professions.js';

const bonusLines = (id) => ({
  warrior: ['基础伤害 +12%', '最大生命 +24'],
  mage: ['技能伤害 +16%', '冷却缩减 +10%'],
  ranger: ['攻击速度 +15%', '暴击率 +8%'],
}[id] || []);

const panelDescriptions = (id) => ({
  warrior: '长剑开路，受伤后短暂提升所有伤害。',
  mage: '禁书悬浮施法，释放多次主动技能后蓄势。',
  ranger: '猎弓压制远处目标，连续命中叠加猎印。',
}[id] || '');

export default class ProfessionPanel {
  constructor(scene){ this.scene=scene; this.nodes=[]; this.isOpen=false; this.chosen=false; }
  show(onChoose){ this.hide(); this.isOpen=true; this.chosen=false; const bg=this.scene.add.rectangle(DESIGN_WIDTH/2,585,680,1010,0x0b101a,0.96).setScrollFactor(0).setDepth(3900); const title=this.scene.add.text(DESIGN_WIDTH/2,112,'选择职业',{fontFamily:'Arial',fontSize:'42px',color:'#ffffff',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setScrollFactor(0).setDepth(3901); this.nodes.push(bg,title);
    getProfessionChoices({ currentSkills:this.scene.playerData.skills, currentArtifacts:this.scene.playerData.artifacts }).forEach((p,i)=>{ const y=270+i*295; const card=this.scene.add.rectangle(DESIGN_WIDTH/2,y,620,270,p.color,0.22).setStrokeStyle(4,p.color,0.9).setScrollFactor(0).setInteractive({useHandCursor:true}).setDepth(3901); const left=100; const textWidth=520; const name=this.scene.add.text(left,y-112,p.name,{fontFamily:'Arial',fontSize:'32px',color:'#fff',stroke:'#000',strokeThickness:4}).setScrollFactor(0).setDepth(3902); const desc=this.scene.add.text(left,y-66,panelDescriptions(p.id),{fontFamily:'Arial',fontSize:'19px',color:'#dfe8ff',wordWrap:{width:textWidth,useAdvancedWrap:true},lineSpacing:4}).setScrollFactor(0).setDepth(3902); const bonus=this.scene.add.text(left,y-10,bonusLines(p.id).join('    '),{fontFamily:'Arial',fontSize:'22px',color:'#72ff8a',stroke:'#062b10',strokeThickness:3,wordWrap:{width:textWidth,useAdvancedWrap:true}}).setScrollFactor(0).setDepth(3902); const mech=this.scene.add.text(left,y+40,p.mechanic,{fontFamily:'Arial',fontSize:'19px',color:'#ffffff',wordWrap:{width:textWidth,useAdvancedWrap:true},lineSpacing:4}).setScrollFactor(0).setDepth(3902); const choose=()=>{ if(this.chosen) return; this.chosen=true; this.hide(); onChoose?.(p.id); }; [card,name,desc,bonus,mech].forEach(n=>n.setInteractive?.({useHandCursor:true}).on?.('pointerdown',choose)); this.nodes.push(card,name,desc,bonus,mech); }); }
  hide(){ this.nodes.forEach(n=>{ n.removeAllListeners?.(); n.destroy(); }); this.nodes=[]; this.isOpen=false; }
  destroy(){ this.hide(); }
}
