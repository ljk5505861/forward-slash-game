import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { SKILLS } from '../config/skills.js';
import { getRarity } from '../config/rarities.js';

const GREEN = '#62e883';
const WHITE = '#f2f6ff';
const MUTED = '#cbd6ee';

export default class UpgradePanel {
  constructor(scene){ this.scene=scene; this.nodes=[]; this.isOpen=false; }

  show(title, options, onPick){
    this.hide();
    this.isOpen=true;
    const bg=this.scene.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,670,880,0x10172a,0.94).setScrollFactor(0).setDepth(3000);
    const label=this.scene.add.text(DESIGN_WIDTH/2,235,title,{fontFamily:'Arial',fontSize:'38px',color:'#fff'}).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
    this.nodes.push(bg,label);
    options.forEach((option,index)=>this.createCard(option,index,onPick));
  }

  createCard(option,index,onPick){
    const x=DESIGN_WIDTH/2;
    const y=350+index*250;
    const width=604;
    const height=220;
    const skill=option.skillId&&SKILLS[option.skillId];
    const rarity=skill&&getRarity(skill.rarity);
    const card=this.scene.add.rectangle(x,y,width,height,0x1b2c55,0.96)
      .setStrokeStyle(4,rarity?.color||0x5278c8,1)
      .setScrollFactor(0)
      .setInteractive({useHandCursor:true})
      .setDepth(3001);
    card.on('pointerdown',()=>onPick(option));
    this.nodes.push(card);

    if(skill) this.createSkillCard(option,skill,rarity,x,y,width,onPick);
    else this.createAttributeCard(option,x,y,width,onPick);
  }

  createText(x,y,text,style={}){
    const node=this.scene.add.text(x,y,text,{fontFamily:'Arial',fontSize:'22px',color:WHITE,wordWrap:{width:540},...style})
      .setOrigin(0,0)
      .setScrollFactor(0)
      .setDepth(3002);
    this.nodes.push(node);
    return node;
  }

  createSkillCard(option,skill,rarity,x,y,width,onPick){
    const left=x-width/2+24;
    const top=y-96;
    const owned=this.scene.playerData.skills.find(s=>s.id===skill.id);
    const currentLevel=owned?.level||0;
    const targetLevel=option.type==='skillLevel'?Math.min(skill.maxLevel,currentLevel+1):1;
    const levelData=skill.levels[targetLevel-1]||skill.levels[0];
    const changes=(levelData.changes||[]).slice(0,4);
    const levelText=option.type==='skillLevel'?`Lv.${currentLevel} → Lv.${targetLevel}`:'获得 Lv.1';

    this.createText(left,top,`${rarity.name}｜${skill.name}`,{fontSize:'25px',color:rarity.uiColor,stroke:'#000',strokeThickness:3});
    this.createText(left,top+36,levelText,{fontSize:'23px',color:GREEN,stroke:'#0b3319',strokeThickness:2});
    this.createText(left,top+70,levelData.desc||skill.description,{fontSize:'21px',color:MUTED,lineSpacing:2});
    if(changes.length) this.createText(left,top+122,changes.join('\n'),{fontSize:'21px',color:GREEN,lineSpacing:3,wordWrap:{width:552}});
  }

  createAttributeCard(option,x,y,width,onPick){
    const left=x-width/2+24;
    const top=y-72;
    const [title,...rest]=String(option.title||'属性提升').split('\n');
    const change=rest.join('\n')||title.replace('强化','').trim();
    this.createText(left,top,title,{fontSize:'28px',color:WHITE,stroke:'#000',strokeThickness:3});
    this.createText(left,top+52,change,{fontSize:'25px',color:GREEN,stroke:'#0b3319',strokeThickness:2});
  }

  hide(){ this.nodes.forEach(n=>{ n.removeAllListeners?.(); n.destroy(); }); this.nodes=[]; this.isOpen=false; }
}
