import { GAME_VERSION_LABEL } from '../config/version.js';

const DESIGN_WIDTH=720;
const DEPTH=2000;
const BAR_W=210, BAR_H=16;
const clamp01=value=>Math.max(0,Math.min(1,value));

export default class Hud {
  constructor(scene){
    this.scene=scene;
    this.stageName='';
    this.statusMessage='';
    this.nodes=[];
    this.leftPanel=scene.add.rectangle(20,24,268,102,0x07101f,0.58).setOrigin(0,0).setScrollFactor(0).setDepth(DEPTH);
    this.heart=scene.add.text(34,34,'♥',{fontFamily:'Arial',fontSize:'32px',color:'#ff5b67',stroke:'#2a0509',strokeThickness:4}).setScrollFactor(0).setDepth(DEPTH+2);
    this.hpBg=scene.add.rectangle(78,39,BAR_W,BAR_H,0x25080c,0.95).setOrigin(0,0).setScrollFactor(0).setDepth(DEPTH+1);
    this.hpFill=scene.add.rectangle(78,39,BAR_W,BAR_H,0xe94444,1).setOrigin(0,0).setScrollFactor(0).setDepth(DEPTH+2);
    this.levelText=scene.add.text(34,86,'Lv.1',{fontFamily:'Arial',fontSize:'18px',color:'#dbeafe',stroke:'#000',strokeThickness:3}).setScrollFactor(0).setDepth(DEPTH+3);
    this.hpText=scene.add.text(183,47,'',{fontFamily:'Arial',fontSize:'14px',color:'#fff7f7',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+3);
    this.mpBg=scene.add.rectangle(78,64,BAR_W,10,0x07152a,0.95).setOrigin(0,0).setScrollFactor(0).setDepth(DEPTH+1);
    this.mpFill=scene.add.rectangle(78,64,BAR_W,10,0x4aa3ff,1).setOrigin(0,0).setScrollFactor(0).setDepth(DEPTH+2);
    this.mpText=scene.add.text(183,69,'',{fontFamily:'Arial',fontSize:'12px',color:'#e0f2fe',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+3);
    this.stBg=scene.add.rectangle(78,80,BAR_W,8,0x1f1807,0.8).setOrigin(0,0).setScrollFactor(0).setDepth(DEPTH+1);
    this.stFill=scene.add.rectangle(78,80,BAR_W,8,0xffd166,0.85).setOrigin(0,0).setScrollFactor(0).setDepth(DEPTH+2);
    this.rightPanel=scene.add.rectangle(DESIGN_WIDTH-22,82,288,46,0x07101f,0.58).setOrigin(1,0).setScrollFactor(0).setDepth(DEPTH);
    this.gold=scene.add.text(DESIGN_WIDTH-292,92,'🪙 0',{fontFamily:'Arial',fontSize:'22px',color:'#ffd166',stroke:'#000',strokeThickness:4}).setScrollFactor(0).setDepth(DEPTH+2);
    this.stage=scene.add.text(DESIGN_WIDTH-182,92,'',{fontFamily:'Arial',fontSize:'20px',color:'#e9efff',stroke:'#000',strokeThickness:4}).setScrollFactor(0).setDepth(DEPTH+2);
    this.settings=scene.add.text(DESIGN_WIDTH-48,88,'⚙',{fontFamily:'Arial',fontSize:'28px',color:'#ffffff',stroke:'#000',strokeThickness:4}).setScrollFactor(0).setDepth(DEPTH+2);
    this.version=scene.add.text(DESIGN_WIDTH/2,76,GAME_VERSION_LABEL,{fontFamily:'Arial',fontSize:'18px',color:'#cbd6ee',stroke:'#000',strokeThickness:3}).setOrigin(0.5,0).setScrollFactor(0).setDepth(DEPTH);
    this.boss=scene.add.text(DESIGN_WIDTH/2,104,'',{fontFamily:'Arial',fontSize:'22px',color:'#ffd1ff',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+1);
    this.nodes=[this.leftPanel,this.heart,this.levelText,this.hpBg,this.hpFill,this.hpText,this.mpBg,this.mpFill,this.mpText,this.stBg,this.stFill,this.rightPanel,this.gold,this.stage,this.settings,this.version,this.boss];
  }
  setStatus(m){ this.statusMessage=m||''; }
  setStage(n){ this.stageName=n||''; }
  setBar(fill,width,current,max){ const ratio=max>0?clamp01(current/max):0; fill.setDisplaySize(Math.round(width*ratio), fill.height); }
  update(){
    const p=this.scene.playerData;
    this.setBar(this.hpFill,BAR_W,p.hp,p.maxHp);
    this.levelText.setText(`Lv.${p.level||1}`);
    this.hpText.setText(`${p.hp}/${p.maxHp}`);
    this.setBar(this.mpFill,BAR_W,p.mana??0,p.maxMana??0);
    this.mpText.setText(`${p.mana??0}/${p.maxMana??0}`);
    this.setBar(this.stFill,BAR_W,p.stamina??0,p.maxStamina??0);
    this.gold.setText(`🪙 ${p.gold??0}`);
    const prof=[p.professionId||'未转职',p.advancedProfessionId||'未进阶'].join('/'); this.stage.setText(this.stageName ? `${this.stageName.replace(/^阶段\d+：?/,'')} ${prof}` : `训练场 ${prof}`);
    const boss=this.scene.enemies.find(e=>e.isBoss&&!e.isDefeated);
    this.boss.setText(boss?`${boss.name} ${boss.hp}/${boss.maxHp}`:'');
  }
  destroy(){ this.nodes.forEach(x=>x?.destroy()); this.nodes=[]; }
}
