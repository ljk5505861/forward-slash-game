import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { SKILLS } from '../config/skills.js';
import { formatArtifactSelectionOption, formatSkillSelectionOption, resolveSelectionMode, SELECTION_ICON_STYLE, SelectionState } from './selectionFormatters.js';
import { drawRarityFrame, rarityStyle } from './selectionFrameRenderer.js';
import { centeredHitArea, makeInteractive } from './interactive.js';

const WHITE='#f2f6ff',MUTED='#cbd6ee';
const DEPTH=3000;

export default class UpgradePanel{
  constructor(scene){ this.scene=scene; this.nodes=[]; this.cards=[]; this.detailNodes=[]; this.state=new SelectionState(); this.isOpen=false; this.detailTop=500; }
  show(titleOrConfig,optionsArg,onPickArg){
    const config=typeof titleOrConfig==='object'?titleOrConfig:{title:titleOrConfig,options:optionsArg,onConfirm:onPickArg};
    this.hide(); this.lastConfig=config; this.isOpen=true; this.state.open(); this.options=config.options||[]; this.mode=resolveSelectionMode(this.options,config.mode); this.onConfirm=config.onConfirm; this.formatted=this.options.map(option=>this.mode==='icon'?formatArtifactSelectionOption(option):formatSkillSelectionOption(option,this.scene.playerData));
    const bg=this.scene.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,DESIGN_WIDTH,DESIGN_HEIGHT,0x07101f,0.18).setScrollFactor(0).setDepth(DEPTH);
    const label=config.hideTitle?null:this.scene.add.text(DESIGN_WIDTH/2,120,config.title||'选择奖励',{fontFamily:'Arial',fontSize:'36px',color:'#fff',stroke:'#000',strokeThickness:4,wordWrap:{width:650}}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+1);
    this.nodes.push(bg); if(label) this.nodes.push(label);
    this.createIconOptions();
    this.createDetails(null); this.createDebug();
  }
  makeText(x,y,text,style={},origin=[0,0]){ const node=this.scene.add.text(x,y,text,{fontFamily:'Arial',fontSize:'22px',color:WHITE,wordWrap:{width:540,useAdvancedWrap:true},...style}).setOrigin(...origin).setScrollFactor(0).setDepth(DEPTH+2); this.nodes.push(node); return node; }
  createIcon(x,y,formatted,index,size=92){ const style=rarityStyle(formatted.rarityId); const color=formatted.iconColor||SELECTION_ICON_STYLE.colors[index%SELECTION_ICON_STYLE.colors.length]; const graphic=this.scene.add.circle(x,y,size/2,color,0.9).setStrokeStyle(5,style.mainColor,0.9).setScrollFactor(0).setDepth(DEPTH+2); const text=this.scene.add.text(x,y,formatted.iconText||'?',{fontFamily:'Arial',fontSize:'36px',color:'#10172a',fontStyle:'bold'}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+3); this.nodes.push(graphic,text); return [graphic,text]; }
  wire(nodes,index,rootHitArea=null){ nodes.forEach(node=>{ makeInteractive(node,node===nodes[0]?rootHitArea:null).on('pointerdown',()=>this.select(index)); }); }
  createCardOptions(){ this.createIconOptions(); }
  createIconOptions(){
    const count=this.formatted.length;
    const columns=Math.min(3,Math.max(1,count));
    const rows=Math.ceil(count/columns);
    const gapX=190,gapY=178;
    const startX=DESIGN_WIDTH/2-gapX*(columns-1)/2;
    const startY=rows>1?254:294;
    this.detailTop=rows>1?650:500;
    this.formatted.forEach((formatted,index)=>{
      const column=index%columns,row=Math.floor(index/columns),x=startX+column*gapX,y=startY+row*gapY;
      const frame=this.scene.add.graphics().setScrollFactor(0).setDepth(DEPTH+1);
      drawRarityFrame(frame,{x,y,width:148,height:148,rarity:formatted.rarityId,selected:false});
      const icon=this.createIcon(x,y-8,formatted,index,92);
      const group=[frame,...icon];
      this.nodes.push(frame); this.cards[index]={root:frame,nodes:group,x,y,rarityId:formatted.rarityId};
      this.wire(group,index,centeredHitArea(x,y,148,148));
    });
  }
  select(index){ if(!this.state.isOpen||this.state.confirmed) return; if(this.state.selectedIndex===index){ this.state.confirmed=true; const option=this.state.selectedOption; this.cards.forEach(card=>card.nodes.forEach(node=>node.disableInteractive?.())); this.hide(); const result=this.onConfirm?.(option); if(result===false){ this.show(this.lastConfig); this.state.select(index,option); this.updateDebug(); } return; } const result=this.state.select(index,this.options[index])?'selected':'locked'; if(result==='locked') return; this.cards.forEach((card,i)=>{ const selected=i===index; drawRarityFrame(card.root,{x:card.x,y:card.y,width:148,height:148,rarity:card.rarityId,selected,alpha:selected?1:0.55}); card.nodes.forEach(node=>node.setAlpha?.(selected?1:0.52)); card.nodes.forEach(node=>{ if(node!==card.root) this.scene.tweens.add({targets:node,scale:selected?1.08:1,duration:140}); }); }); this.createDetails(this.formatted[index]); this.updateDebug(); }
  createDetails(formatted){ this.detailNodes.forEach(node=>{ node.removeAllListeners?.(); node.destroy(); }); this.detailNodes=[]; const top=this.detailTop; const lines=formatted?(formatted.detailLines||[]):[]; const title=lines[0]||'点击上方选项查看详情'; const body=lines.slice(1).join('\n'); const titleNode=this.scene.add.text(DESIGN_WIDTH/2,top,title,{fontFamily:'Arial',fontSize:formatted?'42px':'24px',color:formatted?WHITE:MUTED,stroke:'#000',strokeThickness:5,align:'center',wordWrap:{width:620,useAdvancedWrap:true}}).setOrigin(0.5,0).setScrollFactor(0).setDepth(DEPTH+2); const bodyNode=this.scene.add.text(DESIGN_WIDTH/2,top+72,body,{fontFamily:'Arial',fontSize:'23px',color:WHITE,stroke:'#000',strokeThickness:3,lineSpacing:9,align:'center',wordWrap:{width:620,useAdvancedWrap:true}}).setOrigin(0.5,0).setScrollFactor(0).setDepth(DEPTH+2); this.detailNodes.push(titleNode,bodyNode); this.nodes.push(titleNode,bodyNode); }
  createDebug(){ if(!this.scene.debugMode) return; this.debugText=this.makeText(28,1220,'',{fontSize:'14px',color:'#ffd166',wordWrap:{width:400}}); this.updateDebug(); }
  updateDebug(){ if(this.debugText) this.debugText.setText(`mode=${this.mode} index=${this.state.selectedIndex} id=${this.state.selectedOption?.skillId||this.state.selectedOption?.artifactId||this.state.selectedOption?.id||'-'} locked=${this.state.confirmed}`); }
  showReplacement(option,onReplace,onCancel){
    this.hide(); this.isOpen=true; this.onReplace=onReplace; this.onCancel=onCancel;
    const bg=this.scene.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,DESIGN_WIDTH,DESIGN_HEIGHT,0x07101f,0.28).setScrollFactor(0).setDepth(DEPTH);
    const title=this.scene.add.text(DESIGN_WIDTH/2,132,'点击选择交换一个技能',{fontFamily:'Arial',fontSize:'36px',color:'#fff',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+1);
    const hint=this.scene.add.text(DESIGN_WIDTH/2,188,'新技能不会立即替换；可取消返回三选一界面',{fontFamily:'Arial',fontSize:'22px',color:'#cbd6ee',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+1);
    const cancel=makeInteractive(this.scene.add.text(DESIGN_WIDTH/2,260,'取消 / 返回',{fontFamily:'Arial',fontSize:'26px',color:'#fff',backgroundColor:'#4a2d38',padding:{left:18,right:18,top:10,bottom:10}}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+2)).on('pointerdown',()=>this.onCancel?.());
    this.nodes.push(bg,title,hint,cancel);
    (this.scene.playerData.skills||[]).slice(0,4).forEach((skillData,index)=>{ const config=SKILLS[skillData.id]||{}; const x=116+index*164,y=438; const box=makeInteractive(this.scene.add.rectangle(x,y,142,128,0x263f70,0.96).setStrokeStyle(5,0xffd166,1).setScrollFactor(0).setDepth(DEPTH+2)).on('pointerdown',()=>this.onReplace?.(index)); const text=this.scene.add.text(x,y,`${config.name||skillData.id}\nLv.${skillData.level}`,{fontFamily:'Arial',fontSize:'20px',color:'#fff',align:'center',stroke:'#000',strokeThickness:3,wordWrap:{width:124}}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+3); this.nodes.push(box,text); });
  }
  hide(){ this.nodes.forEach(node=>{ node.removeAllListeners?.(); node.destroy(); }); this.nodes=[]; this.cards=[]; this.detailNodes=[]; this.state.close(); this.isOpen=false; this.detailTop=500; }
}
