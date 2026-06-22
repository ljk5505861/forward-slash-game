import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
const DEPTH=4400;
export default class ShopPanel {
  constructor(scene){ this.scene=scene; this.nodes=[]; this.itemNodes=[]; this.isOpen=false; this.items=[]; this.reason=null; }
  show({items=[], reason=null}={}){ if(this.isOpen) return; this.isOpen=true; this.items=items; this.reason=reason; const s=this.scene; s.beginGameplayPause?.();
    this.nodes.push(s.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,DESIGN_WIDTH,DESIGN_HEIGHT,0x030712,0.56).setScrollFactor(0).setDepth(DEPTH));
    this.nodes.push(s.add.rectangle(DESIGN_WIDTH/2,610,640,650,0x0b1020,0.97).setStrokeStyle(4,0xf6c453,0.9).setScrollFactor(0).setDepth(DEPTH+1));
    this.title=this.text(DESIGN_WIDTH/2,320,'商店',{fontSize:'36px',color:'#ffe08a'},[0.5,0]);
    this.goldText=this.text(DESIGN_WIDTH/2,372,'',{fontSize:'24px',color:'#ffd166'},[0.5,0]);
    this.message=this.text(DESIGN_WIDTH/2,825,'',{fontSize:'22px',color:'#9fffb6'},[0.5,0]);
    const leave=this.text(DESIGN_WIDTH/2,884,'离开商店',{fontSize:'28px',color:'#fff',backgroundColor:'#3b2b12',padding:{left:36,right:36,top:14,bottom:14}},[0.5,0]).setInteractive({useHandCursor:true});
    leave.on('pointerdown',()=>this.hide({resume:true})); this.render(); }
  text(x,y,t,style={},origin=[0,0]){ const n=this.scene.add.text(x,y,t,{fontFamily:'Arial',fontSize:'22px',color:'#e5edff',stroke:'#000',strokeThickness:3,align:'center',wordWrap:{width:560},...style}).setOrigin(...origin).setScrollFactor(0).setDepth(DEPTH+2); this.nodes.push(n); return n; }
  render(){ this.itemNodes.forEach(n=>n.destroy()); this.itemNodes=[]; this.goldText?.setText(`当前金币：${this.scene.playerData.gold||0}`); this.items.forEach((item,i)=>{ const col=i%2,row=Math.floor(i/2),x=DESIGN_WIDTH/2-155+col*310,y=440+row*170; const bought=this.scene.shopSystem.purchased.has(item.id); const affordable=(this.scene.playerData.gold||0)>=item.price; const color=bought?0x253247:affordable?0x172039:0x2a1d24; const card=this.scene.add.rectangle(x,y,280,140,color,0.98).setStrokeStyle(3,bought?0x7da7ff:affordable?0xf6c453:0x6b3a45,0.9).setScrollFactor(0).setDepth(DEPTH+2).setInteractive({useHandCursor:true}); const label=bought?'已购买':affordable?'购买':'金币不足'; const text=this.scene.add.text(x,y-54,`${item.icon} ${item.name}\n${item.description}\n价格：${item.price}    ${label}`,{fontFamily:'Arial',fontSize:'20px',color:bought?'#a8c7ff':affordable?'#fff7d6':'#d8a0a0',stroke:'#000',strokeThickness:3,align:'center',lineSpacing:6,wordWrap:{width:250}}).setOrigin(0.5,0).setScrollFactor(0).setDepth(DEPTH+3); card.on('pointerdown',()=>this.buy(item.id)); this.itemNodes.push(card,text); }); }
  buy(itemId){ const r=this.scene.shopSystem.buy(itemId); this.message?.setText(r.ok?r.message:r.reason); this.render(); }
  hide({resume=true}={}){ if(!this.isOpen) return; this.nodes.concat(this.itemNodes).forEach(n=>{n.removeAllListeners?.();n.destroy();}); this.nodes=[]; this.itemNodes=[]; this.isOpen=false; const reason=this.reason; this.reason=null; if(resume) this.scene.shopSystem?.closeCurrent({resume:true}); else if(this.scene.shopSystem?.currentShopReason===reason) this.scene.shopSystem.currentShopReason=null; }
  destroy({resume=false}={}){ this.hide({resume}); }
}
