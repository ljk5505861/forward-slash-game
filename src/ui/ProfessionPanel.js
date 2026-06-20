import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { getProfessionChoices } from '../config/professions.js';

const bonusLines = (id) => ({
  warrior: ['基础伤害 +12%', '最大生命 +24'],
  mage: ['技能伤害 +16%', '冷却缩减 +10%'],
  ranger: ['攻击速度 +15%', '暴击率 +8%'],
}[id] || []);

export default class ProfessionPanel {
  constructor(scene){ this.scene=scene; this.nodes=[]; this.isOpen=false; this.chosen=false; }
  show(onChoose){ this.hide(); this.isOpen=true; this.chosen=false; const bg=this.scene.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,700,1040,0x0b101a,0.96).setScrollFactor(0).setDepth(3900); const title=this.scene.add.text(DESIGN_WIDTH/2,150,'选择职业',{fontFamily:'Arial',fontSize:'46px',color:'#ffffff',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setScrollFactor(0).setDepth(3901); this.nodes.push(bg,title);
    getProfessionChoices({ currentSkills:this.scene.playerData.skills, currentArtifacts:this.scene.playerData.artifacts }).forEach((p,i)=>{ const y=285+i*285; const card=this.scene.add.rectangle(DESIGN_WIDTH/2,y,620,245,p.color,0.22).setStrokeStyle(4,p.color,0.9).setScrollFactor(0).setInteractive({useHandCursor:true}).setDepth(3901); const name=this.scene.add.text(80,y-95,p.name,{fontFamily:'Arial',fontSize:'34px',color:'#fff',stroke:'#000',strokeThickness:4}).setScrollFactor(0).setDepth(3902); const desc=this.scene.add.text(80,y-48,p.description,{fontFamily:'Arial',fontSize:'21px',color:'#dfe8ff',wordWrap:{width:560}}).setScrollFactor(0).setDepth(3902); const bonus=this.scene.add.text(80,y+15,bonusLines(p.id).join('    '),{fontFamily:'Arial',fontSize:'24px',color:'#72ff8a',stroke:'#062b10',strokeThickness:3}).setScrollFactor(0).setDepth(3902); const mech=this.scene.add.text(80,y+62,p.mechanic,{fontFamily:'Arial',fontSize:'22px',color:'#ffffff',wordWrap:{width:560}}).setScrollFactor(0).setDepth(3902); const choose=()=>{ if(this.chosen) return; this.chosen=true; this.hide(); onChoose?.(p.id); }; [card,name,desc,bonus,mech].forEach(n=>n.setInteractive?.({useHandCursor:true}).on?.('pointerdown',choose)); this.nodes.push(card,name,desc,bonus,mech); }); }
  hide(){ this.nodes.forEach(n=>{ n.removeAllListeners?.(); n.destroy(); }); this.nodes=[]; this.isOpen=false; }
  destroy(){ this.hide(); }
}
