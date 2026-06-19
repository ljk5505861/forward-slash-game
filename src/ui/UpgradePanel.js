import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { SKILLS } from '../config/skills.js';
import { getRarity } from '../config/rarities.js';
import { ARTIFACTS, ARTIFACT_CATEGORIES, getArtifactLevelText } from '../config/artifacts.js';

const GREEN = '#62e883';
const WHITE = '#f2f6ff';
const MUTED = '#cbd6ee';
const ATTRIBUTE_CARD_LABELS = {
  attack_15: ['攻击强化', '攻击力 +15%'],
  hp_20: ['生命强化', '最大生命 +20'],
  as_10: ['速度强化', '攻击速度 +10%'],
  skill_15: ['技能强化', '技能伤害 +15%'],
  cdr_8: ['冷却强化', '冷却缩减 +8%'],
  crit_5: ['暴击强化', '暴击率 +5%'],
};

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
    const y=360+index*242;
    const width=604;
    const height=236;
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
    else if(option.artifactId) this.createArtifactCard(option,x,y,width);
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
    const top=y-104;
    const owned=this.scene.playerData.skills.find(s=>s.id===skill.id);
    const currentLevel=owned?.level||0;
    const targetLevel=option.type==='skillLevel'?Math.min(skill.maxLevel,currentLevel+1):1;
    const levelData=skill.levels[targetLevel-1]||skill.levels[0];
    const changes=(levelData.changes||[]).slice(0,4);
    const levelText=option.type==='skillLevel'?`Lv.${currentLevel} → Lv.${targetLevel}`:'获得 Lv.1';

    this.createText(left,top,`${rarity.name}｜${skill.name}`,{fontSize:'25px',color:rarity.uiColor,stroke:'#000',strokeThickness:3});
    this.createText(left,top+32,levelText,{fontSize:'23px',color:GREEN,stroke:'#0b3319',strokeThickness:2});
    this.createText(left,top+62,levelData.desc||skill.description,{fontSize:'20px',color:MUTED,lineSpacing:2});
    if(changes.length) this.createText(left,top+110,changes.join('\n'),{fontSize:'20px',color:GREEN,lineSpacing:1,wordWrap:{width:552}});
  }


  createArtifactCard(option,x,y,width){
    const left=x-width/2+24;
    const top=y-104;
    const artifact=ARTIFACTS[option.artifactId];
    const category=ARTIFACT_CATEGORIES[artifact?.category]?.name||artifact?.category||'法宝';
    const levelText=option.type==='upgrade'?`Lv.${option.level} → Lv.${option.nextLevel}`:`Lv.${option.nextLevel||1}`;
    this.createText(left,top,`${artifact?.name||option.artifactId}｜${category}`,{fontSize:'25px',color:WHITE,stroke:'#000',strokeThickness:3});
    this.createText(left,top+32,levelText,{fontSize:'23px',color:option.type==='upgrade'?GREEN:WHITE,stroke:'#0b3319',strokeThickness:2});
    if(option.requiredSkillName) this.createText(left,top+62,`关联技能：${option.requiredSkillName}`,{fontSize:'19px',color:'#ffd866'});
    const effectY=option.requiredSkillName?92:66;
    if(option.type==='upgrade'){
      this.createText(left,top+effectY,`当前：${getArtifactLevelText(option.artifactId,option.level)}`,{fontSize:'19px',color:MUTED,lineSpacing:1});
      this.createText(left,top+effectY+58,`升级后：${getArtifactLevelText(option.artifactId,option.nextLevel)}`,{fontSize:'20px',color:GREEN,lineSpacing:1,wordWrap:{width:552}});
    } else {
      this.createText(left,top+effectY,getArtifactLevelText(option.artifactId,option.nextLevel||1),{fontSize:'21px',color:GREEN,lineSpacing:2,wordWrap:{width:552}});
    }
  }

  createAttributeCard(option,x,y,width,onPick){
    const left=x-width/2+24;
    const top=y-72;
    const fallback=String(option.title||'属性提升').split('\n');
    const mapped=ATTRIBUTE_CARD_LABELS[option.id];
    const title=mapped?.[0]||fallback[0]||'属性强化';
    const change=mapped?.[1]||fallback.slice(1).join('\n')||fallback[0]||'属性提升';
    this.createText(left,top,title,{fontSize:'28px',color:WHITE,stroke:'#000',strokeThickness:3});
    this.createText(left,top+52,change,{fontSize:'25px',color:GREEN,stroke:'#0b3319',strokeThickness:2});
  }

  hide(){ this.nodes.forEach(n=>{ n.removeAllListeners?.(); n.destroy(); }); this.nodes=[]; this.isOpen=false; }
}
