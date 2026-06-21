import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { formatArtifactSelectionOption, formatSkillSelectionOption, resolveSelectionMode, SELECTION_ICON_STYLE, SelectionState } from './selectionFormatters.js';

const WHITE='#f2f6ff', MUTED='#cbd6ee', GREEN='#62e883';
const DEPTH=3000;

export default class UpgradePanel {
  constructor(scene){ this.scene=scene; this.nodes=[]; this.cards=[]; this.detailNodes=[]; this.state=new SelectionState(); this.isOpen=false; }
  show(titleOrConfig, optionsArg, onPickArg){
    const config=typeof titleOrConfig==='object'?titleOrConfig:{ title:titleOrConfig, options:optionsArg, onConfirm:onPickArg };
    this.hide(); this.isOpen=true; this.state.open(); this.options=config.options||[]; this.mode=resolveSelectionMode(this.options, config.mode); this.onConfirm=config.onConfirm; this.formatted=this.options.map(o=>this.mode==='icon'?formatArtifactSelectionOption(o):formatSkillSelectionOption(o,this.scene.playerData));
    const bg=this.scene.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,DESIGN_WIDTH,DESIGN_HEIGHT,0x07101f,0.18).setScrollFactor(0).setDepth(DEPTH);
    const label=this.scene.add.text(DESIGN_WIDTH/2,120,config.title||'选择奖励',{fontFamily:'Arial',fontSize:'36px',color:'#fff',stroke:'#000',strokeThickness:4,wordWrap:{width:650}}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+1);
    this.nodes.push(bg,label);
    this.createIconOptions();
    this.createDetails(null); this.createDebug();
  }
  makeText(x,y,text,style={},origin=[0,0]){ const n=this.scene.add.text(x,y,text,{fontFamily:'Arial',fontSize:'22px',color:WHITE,wordWrap:{width:540,useAdvancedWrap:true},...style}).setOrigin(...origin).setScrollFactor(0).setDepth(DEPTH+2); this.nodes.push(n); return n; }
  createIcon(x,y,f,index,size=92){ const color=f.iconColor||SELECTION_ICON_STYLE.colors[index%SELECTION_ICON_STYLE.colors.length]; const g=this.scene.add.circle(x,y,size/2,color,0.9).setStrokeStyle(4,0xffffff,0.28).setScrollFactor(0).setDepth(DEPTH+2); const t=this.scene.add.text(x,y,f.iconText||'?',{fontFamily:'Arial',fontSize:'36px',color:'#10172a',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+3); this.nodes.push(g,t); return [g,t]; }
  wire(nodes,index){ nodes.forEach(n=>n.setInteractive?.({useHandCursor:true}).on('pointerdown',()=>this.select(index))); }
  createCardOptions(){ this.createIconOptions(); }
  createIconOptions(){ const gap=190, startX=DESIGN_WIDTH/2-gap; this.formatted.forEach((f,i)=>{ const x=startX+i*gap, y=294; const hit=this.scene.add.rectangle(x,y,132,132,0x1b2c55,0.16).setStrokeStyle(4,f.rarityColor||0x5278c8,0.45).setScrollFactor(0).setDepth(DEPTH+1); const icon=this.createIcon(x,y-8,f,i,92); const rarity=this.makeText(x,y+70,f.rarity||f.subtitle||'',{fontSize:'16px',color:GREEN,alpha:0.72,align:'center',wordWrap:{width:130}},[0.5,0]); const group=[hit,...icon,rarity]; this.nodes.push(hit); this.cards[i]={root:hit,nodes:group,x,y}; this.wire(group,i); }); }
  select(index){ const result=this.state.selectOrConfirm(index,this.options[index],(o)=>this.onConfirm?.(o)); if(result==='locked') return; if(result==='rejected'){ this.updateDebug(); return; } if(result==='confirmed'){ this.cards.forEach(c=>c.nodes.forEach(n=>n.disableInteractive?.())); this.hide(); return; } this.cards.forEach((c,i)=>{ const on=i===index; c.root.setStrokeStyle(on?6:4,on?0x9fffb6:0x5278c8,on?1:0.45); c.nodes.forEach(n=>n.setAlpha?.(on?1:0.62)); c.nodes.forEach(n=>{ if(n!==c.root) this.scene.tweens.add({targets:n,scale:on?1.06:1,duration:140}); }); c.root.y=c.y+(on?-8:0); }); this.createDetails(this.formatted[index]); this.updateDebug(); }
  createDetails(f){ this.detailNodes.forEach(n=>{n.removeAllListeners?.();n.destroy();}); this.detailNodes=[]; const top=500; const lines=f?(f.detailLines||[]):[]; const title=lines[0]||'点击上方选项查看详情'; const body=lines.slice(1).join('\n'); const titleNode=this.scene.add.text(DESIGN_WIDTH/2,top,title,{fontFamily:'Arial',fontSize:f?'42px':'24px',color:f?WHITE:MUTED,stroke:'#000',strokeThickness:5,align:'center',wordWrap:{width:620,useAdvancedWrap:true}}).setOrigin(0.5,0).setScrollFactor(0).setDepth(DEPTH+2); const bodyNode=this.scene.add.text(DESIGN_WIDTH/2,top+72,body,{fontFamily:'Arial',fontSize:'23px',color:WHITE,stroke:'#000',strokeThickness:3,lineSpacing:9,align:'center',wordWrap:{width:620,useAdvancedWrap:true}}).setOrigin(0.5,0).setScrollFactor(0).setDepth(DEPTH+2); this.detailNodes.push(titleNode,bodyNode); this.nodes.push(titleNode,bodyNode); }
  createDebug(){ if(!this.scene.debugMode) return; this.debugText=this.makeText(28,1220,'',{fontSize:'14px',color:'#ffd166',wordWrap:{width:400}}); this.updateDebug(); }
  updateDebug(){ if(this.debugText) this.debugText.setText(`mode=${this.mode} index=${this.state.selectedIndex} id=${this.state.selectedOption?.skillId||this.state.selectedOption?.artifactId||this.state.selectedOption?.id||'-'} locked=${this.state.confirmed}`); }
  hide(){ this.nodes.forEach(n=>{ n.removeAllListeners?.(); n.destroy(); }); this.nodes=[]; this.cards=[]; this.detailNodes=[]; this.state.close(); this.isOpen=false; }
}
