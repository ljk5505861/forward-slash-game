import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { formatArtifactSelectionOption, formatSkillSelectionOption, resolveSelectionMode, SELECTION_ICON_STYLE, SelectionState } from './selectionFormatters.js';

const WHITE='#f2f6ff', MUTED='#cbd6ee', GREEN='#62e883';
const DEPTH=3000;

export default class UpgradePanel {
  constructor(scene){ this.scene=scene; this.nodes=[]; this.cards=[]; this.detailNodes=[]; this.state=new SelectionState(); this.isOpen=false; }
  show(titleOrConfig, optionsArg, onPickArg){
    const config=typeof titleOrConfig==='object'?titleOrConfig:{ title:titleOrConfig, options:optionsArg, onConfirm:onPickArg };
    this.hide(); this.isOpen=true; this.state.open(); this.options=config.options||[]; this.mode=resolveSelectionMode(this.options, config.mode); this.onConfirm=config.onConfirm; this.formatted=this.options.map(o=>this.mode==='icon'?formatArtifactSelectionOption(o):formatSkillSelectionOption(o,this.scene.playerData));
    const bg=this.scene.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,DESIGN_WIDTH,DESIGN_HEIGHT,0x07101f,0.34).setScrollFactor(0).setDepth(DEPTH);
    const label=this.scene.add.text(DESIGN_WIDTH/2,118,config.title||'选择奖励',{fontFamily:'Arial',fontSize:'36px',color:'#fff',stroke:'#000',strokeThickness:4,wordWrap:{width:650}}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+1);
    this.nodes.push(bg,label);
    this.createIconOptions();
    this.createDetails(null); this.createDebug();
  }
  makeText(x,y,text,style={},origin=[0,0]){ const n=this.scene.add.text(x,y,text,{fontFamily:'Arial',fontSize:'22px',color:WHITE,wordWrap:{width:540,useAdvancedWrap:true},...style}).setOrigin(...origin).setScrollFactor(0).setDepth(DEPTH+2); this.nodes.push(n); return n; }
  createIcon(x,y,f,index,size=86){ const color=f.iconColor||SELECTION_ICON_STYLE.colors[index%SELECTION_ICON_STYLE.colors.length]; const g=this.scene.add.circle(x,y,size/2,color,0.86).setStrokeStyle(4,0xffffff,0.28).setScrollFactor(0).setDepth(DEPTH+2); const t=this.scene.add.text(x,y,f.iconText||'?',{fontFamily:'Arial',fontSize:'34px',color:'#10172a',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+3); this.nodes.push(g,t); return [g,t]; }
  wire(nodes,index){ nodes.forEach(n=>n.setInteractive?.({useHandCursor:true}).on('pointerdown',()=>this.select(index))); }
  createCardOptions(){ this.createIconOptions(); }
  createIconOptions(){ this.formatted.forEach((f,i)=>{ const x=160+i*200, y=292; const hit=this.scene.add.rectangle(x,y,156,188,0x1b2c55,0.28).setStrokeStyle(4,f.rarityColor||0x5278c8,0.72).setScrollFactor(0).setDepth(DEPTH+1); const icon=this.createIcon(x,y-38,f,i,88); const name=this.makeText(x,y+22,f.title,{fontSize:'24px',align:'center',wordWrap:{width:145}},[0.5,0]); const meta=this.makeText(x,y+58,(f.levelText&&f.levelText!=='获得'?f.levelText:(f.rarity||f.subtitle||'')),{fontSize:'18px',color:GREEN,align:'center',wordWrap:{width:150}},[0.5,0]); const badge=this.makeText(x,y-125,'再次点击确认',{fontSize:'16px',color:'#10172a',backgroundColor:'#80ffb0',padding:{left:6,right:6,top:3,bottom:3}},[0.5,0]); badge.setVisible(false); const group=[hit,...icon,name,meta,badge]; this.nodes.push(hit); this.cards[i]={root:hit,nodes:group,badge,x,y}; this.wire(group,i); }); }
  select(index){ const result=this.state.selectOrConfirm(index,this.options[index],(o)=>this.onConfirm?.(o)); if(result==='locked') return; if(result==='confirmed'){ this.cards.forEach(c=>c.nodes.forEach(n=>n.disableInteractive?.())); this.hide(); return; } this.cards.forEach((c,i)=>{ const on=i===index; c.badge?.setVisible(on); c.root.setStrokeStyle(on?6:4,on?0x9fffb6:0x5278c8,on?1:0.55); c.nodes.forEach(n=>n.setAlpha?.(on?1:0.66)); c.nodes.forEach(n=>{ if(n!==c.root) this.scene.tweens.add({targets:n,scale:on?1.05:1,duration:140}); }); c.root.y=c.y+(on?-8:0); }); this.createDetails(this.formatted[index]); this.updateDebug(); }
  createDetails(f){ this.detailNodes.forEach(n=>{n.removeAllListeners?.();n.destroy();}); this.detailNodes=[]; const top=510; const box=this.scene.add.rectangle(DESIGN_WIDTH/2,top+190,620,380,0x0b1020,0.62).setStrokeStyle(3,0x46639b,0.65).setScrollFactor(0).setDepth(DEPTH+1); this.detailNodes.push(box); this.nodes.push(box); const content=f?(f.detailLines||[]).join('\n'):'点击上方选项查看详情'; const t=this.scene.add.text(74,top+28,content,{fontFamily:'Arial',fontSize:'22px',color:f?WHITE:MUTED,lineSpacing:7,wordWrap:{width:572,useAdvancedWrap:true}}).setScrollFactor(0).setDepth(DEPTH+2); this.detailNodes.push(t); this.nodes.push(t); }
  createDebug(){ if(!this.scene.debugMode) return; this.debugText=this.makeText(28,1220,'',{fontSize:'14px',color:'#ffd166',wordWrap:{width:400}}); this.updateDebug(); }
  updateDebug(){ if(this.debugText) this.debugText.setText(`mode=${this.mode} index=${this.state.selectedIndex} id=${this.state.selectedOption?.skillId||this.state.selectedOption?.artifactId||this.state.selectedOption?.id||'-'} locked=${this.state.confirmed}`); }
  hide(){ this.nodes.forEach(n=>{ n.removeAllListeners?.(); n.destroy(); }); this.nodes=[]; this.cards=[]; this.detailNodes=[]; this.state.close(); this.isOpen=false; }
}
