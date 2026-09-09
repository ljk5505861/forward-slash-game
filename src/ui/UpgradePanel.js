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
    this.hide(); this.lastConfig=config; this.isOpen=true; this.state.open(); this.options=config.options||[]; this.mode=resolveSelectionMode(this.options,config.mode); this.onConfirm=config.onConfirm; this.onCancel=config.onCancel; this.formatted=this.options.map(option=>this.mode==='icon'?formatArtifactSelectionOption(option):formatSkillSelectionOption(option,this.scene.playerData));
    const bg=this.scene.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,DESIGN_WIDTH,DESIGN_HEIGHT,0x07101f,0.18).setScrollFactor(0).setDepth(DEPTH);
    const label=config.hideTitle?null:this.scene.add.text(DESIGN_WIDTH/2,120,config.title||'选择奖励',{fontFamily:'Arial',fontSize:'36px',color:'#fff',stroke:'#000',strokeThickness:4,wordWrap:{width:650}}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+1);
    this.nodes.push(bg); if(label) this.nodes.push(label);
    if(config.onCancel) this.createCancelButton(config.cancelText||'取消 / 返回');
    this.createIconOptions();
    this.createDetails(null); this.createDebug();
  }
  makeText(x,y,text,style={},origin=[0,0]){ const node=this.scene.add.text(x,y,text,{fontFamily:'Arial',fontSize:'22px',color:WHITE,wordWrap:{width:540,useAdvancedWrap:true},...style}).setOrigin(...origin).setScrollFactor(0).setDepth(DEPTH+2); this.nodes.push(node); return node; }
  createCancelButton(text){ const cancel=makeInteractive(this.scene.add.text(DESIGN_WIDTH/2,190,text,{fontFamily:'Arial',fontSize:'24px',color:'#fff',backgroundColor:'#4a2d38',padding:{left:18,right:18,top:9,bottom:9}}).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH+2)).on('pointerdown',()=>{ this.hide(); this.onCancel?.(); }); this.nodes.push(cancel); return cancel; }
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
  clearDetails(){
    if(this.detailMove) this.scene.input?.off('pointermove',this.detailMove);
    if(this.detailRelease){ this.scene.input?.off('pointerup',this.detailRelease); this.scene.input?.off('gameout',this.detailRelease); }
    if(this.detailShutdown) this.scene.events?.off('shutdown',this.detailShutdown);
    this.detailMove=null; this.detailRelease=null; this.detailShutdown=null;
    this.detailDrag=null;
    this.detailNodes.forEach(node=>{ node.removeAllListeners?.(); node.destroy(); });
    this.detailNodes=[];
    this.detailMask?.destroy(); this.detailMask=null;
    this.detailClip?.destroy(); this.detailClip=null;
  }
  createDetails(formatted){
    this.clearDetails();
    this.detailShutdown=()=>this.clearDetails();
    this.scene.events?.once('shutdown',this.detailShutdown);
    const top=this.detailTop, left=48, width=624, bottom=1190;
    const addText=(y,text,style={})=>{
      const node=this.scene.add.text(left,y,text,{fontFamily:'Arial',fontSize:'23px',color:WHITE,
        align:'left',lineSpacing:8,wordWrap:{width,useAdvancedWrap:true},...style})
        .setOrigin(0,0).setScrollFactor(0).setDepth(DEPTH+3);
      this.detailNodes.push(node); return node;
    };
    const title=addText(top,formatted?.title||'点击上方选项查看详情',{
      fontSize:formatted?'32px':'24px',fontStyle:'bold',color:formatted?WHITE:MUTED});
    const bodyTop=top+title.height+16;
    if(!formatted) return;
    const moving=[]; let y=bodyTop;
    const append=(text,style={},gap=12)=>{
      if(!text) return;
      const node=addText(y,text,style); moving.push({node,y}); y+=node.height+gap; return node;
    };
    if(formatted.levelText) append(formatted.levelText,{fontSize:'20px',color:MUTED});
    if(formatted.purposeLines){
      append(formatted.purposeLines.join('\n'),{fontSize:'25px',fontStyle:'bold'});
      append((formatted.effectLines||[]).join('\n'));
    }else{
      append((formatted.detailLines||[]).slice(1).join('\n'));
    }
    if(formatted.milestoneRows?.length){
      // The gap starts at the actual bottom of the last wrapped text node.
      y=(moving.length?moving.at(-1).y+moving.at(-1).node.height:bodyTop)+32;
      append('等级成长',{fontSize:'21px',color:'#b6c5d8'},12);
      formatted.milestoneRows.forEach(row=>append(
        `Lv.${row.level}：${row.text}${row.activatesNow?'（本次激活）':row.active?'（已激活）':''}`,
        {color:row.activatesNow?'#ffd166':'#b6c5d8'},8));
    }
    const end=moving.length?moving.at(-1).y+moving.at(-1).node.height:bodyTop;
    const viewportBottom=bottom-28, maxScroll=Math.max(0,end-viewportBottom);
    let offset=0;
    this.detailClip=this.scene.make?.graphics({x:0,y:0,add:false});
    if(this.detailClip){
      this.detailClip.setScrollFactor(0);
      this.detailClip.fillStyle(0xffffff).fillRect(24,bodyTop,672,Math.max(1,viewportBottom-bodyTop));
      this.detailMask=this.detailClip.createGeometryMask();
      moving.forEach(({node})=>node.setMask(this.detailMask));
    }
    if(!maxScroll) return;
    addText(bottom-20,'上下滑动查看完整说明',{fontSize:'18px',color:MUTED});
    const hit=makeInteractive(this.scene.add.rectangle(360,(bodyTop+viewportBottom)/2,672,
      viewportBottom-bodyTop,0x142238,0.001).setScrollFactor(0).setDepth(DEPTH+4));
    this.detailNodes.push(hit);
    const scrollTo=value=>{offset=Math.max(0,Math.min(maxScroll,value)); moving.forEach(({node,y:baseY})=>{node.y=baseY-offset;});};
    hit.on('pointerdown',pointer=>{this.detailDrag={id:pointer.id,y:pointer.y,offset};});
    hit.on('wheel',(_pointer,_dx,dy)=>scrollTo(offset+dy));
    this.detailMove=pointer=>{if(this.detailDrag?.id===pointer.id&&pointer.isDown) scrollTo(this.detailDrag.offset+this.detailDrag.y-pointer.y);};
    this.detailRelease=()=>{this.detailDrag=null;};
    this.scene.input?.on('pointermove',this.detailMove);
    this.scene.input?.on('pointerup',this.detailRelease);
    this.scene.input?.on('gameout',this.detailRelease);
  }
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
  hide(){ this.clearDetails(); this.nodes.forEach(node=>{ node.removeAllListeners?.(); node.destroy(); }); this.nodes=[]; this.cards=[]; this.detailNodes=[]; this.state.close(); this.isOpen=false; this.detailTop=500; }
}
