import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { SKILLS } from '../config/skills.js';
import { getRarity } from '../config/rarities.js';
import { formatSkillSelectionOption } from './selectionFormatters.js';
import { drawShopIcon } from './shopIcons.js';
import { makeInteractive } from './interactive.js';

const DEPTH=4400;
const WHITE='#edf4ff',MUTED='#aebdd0';
export default class ShopPanel {
  constructor(scene) { this.scene=scene; this.nodes=[]; this.itemNodes=[]; this.isOpen=false; this.reason=null; }
  show({items=[],reason=null}={}) {
    if(this.isOpen) return;
    this.isOpen=true; this.items=items; this.reason=reason; this.mode='buy';
    this.selectedId=null; this.page=0; this.detailPage=0; this.expanded=false; this.notice='';
    this.scene.beginGameplayPause?.(); this.render();
  }
  add(node,depth=DEPTH+2) { node.setScrollFactor(0).setDepth(depth); this.nodes.push(node); return node; }
  text(x,y,value,style={},origin=[0,0]) {
    return this.add(this.scene.add.text(x,y,value,{
      fontFamily:'Arial',fontSize:'24px',color:WHITE,stroke:'#071322',strokeThickness:2,
      wordWrap:{width:620,useAdvancedWrap:true},...style
    }).setOrigin(...origin));
  }
  button(x,y,width,label,callback,{disabled=false}={}) {
    const box=this.add(this.scene.add.rectangle(x,y,width,52,0x263e55,0.85).setStrokeStyle(1,0x7d9bab,0.6));
    this.text(x,y,label,{fontSize:'23px',color:disabled?'#718194':WHITE,wordWrap:{width:width-16},align:'center'},[0.5,0.5]);
    if(!disabled) makeInteractive(box).on('pointerdown',()=>{ if(this.isOpen) callback(); });
    return box;
  }
  clearNodes() {
    this.nodes.forEach(node=>{node.removeAllListeners?.();node.destroy();}); this.nodes=[]; this.itemNodes=[];
  }
  render() {
    if(!this.isOpen) return;
    this.clearNodes();
    const system=this.scene.shopSystem;
    // Transparent wash, no opaque description/card panels. It also blocks the battlefield HUD.
    makeInteractive(this.add(this.scene.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,DESIGN_WIDTH,DESIGN_HEIGHT,0x071322,0.28),DEPTH));
    this.text(40,245,this.mode==='sell'?'出售道具':this.mode==='replace'?'选择替换的技能':'商店',{fontSize:'32px'});
    this.goldText=this.text(680,252,'金币 '+(this.scene.playerData.gold||0),{fontSize:'25px',color:'#ffda80'},[1,0]);
    if(this.mode==='replace') { this.renderReplacement(); return; }
    this.items=system.currentItems;
    const selling=this.mode==='sell', all=selling?system.ownedItems():this.items;
    this.page=Math.min(this.page,Math.max(0,Math.ceil(all.length/4)-1));
    const items=selling?all.slice(this.page*4,this.page*4+4):all;
    items.forEach((item,index)=>this.card(item,index,selling));
    if(selling && !all.length) this.text(360,410,'还没有可出售的道具',{color:MUTED},[0.5,0]);
    if(selling && all.length>4) {
      this.button(248,584,100,'上一页',()=>{this.page--;this.selectedId=null;this.render();},{disabled:this.page===0});
      this.text(360,584,(this.page+1)+' / '+Math.ceil(all.length/4),{fontSize:'20px'},[0.5,0.5]);
      this.button(472,584,100,'下一页',()=>{this.page++;this.selectedId=null;this.render();},{disabled:(this.page+1)*4>=all.length});
    }
    const selected=items.find(item=>item.id===this.selectedId);
    if(selected) this.details(selected,selling); else this.text(42,632,selling?'点击道具查看返还金额':'点击商品查看效果',{color:MUTED});
    this.message=this.text(42,842,this.notice||'',{fontSize:'21px',color:'#b0e5c0',wordWrap:{width:636}});
    if(system.normal) {
      this.button(183,934,280,selling?'返回购买':'切换出售',()=>{
        this.mode=selling?'buy':'sell';this.selectedId=null;this.page=0;this.notice='';this.render();
      });
      if(!selling) this.button(537,934,280,'刷新 · '+system.refreshPrice+' 金币',()=>{
        const result=system.refresh();this.notice=result.message||result.reason;
        if(result.ok) {this.selectedId=null;this.expanded=false;} this.render();
      },{disabled:(this.scene.playerData.gold||0)<system.refreshPrice});
      else this.text(360,895,'按购入价的50%返还，每次出售一件',{fontSize:'20px',color:MUTED},[0.5,0]);
    }
    this.button(537,1022,280,'离开',()=>this.hide({resume:true}));
  }
  card(item,index,selling) {
    const system=this.scene.shopSystem, x=111+index*166, bought=!selling&&system.purchased.has(item.id);
    const rarity=getRarity(item.rarity), selected=item.id===this.selectedId;
    const hit=this.add(this.scene.add.rectangle(x,431,152,202,0x13253b,selected?0.20:0).setStrokeStyle(selected?2:0,rarity.color,0.75));
    makeInteractive(hit).on('pointerdown',()=>{this.selectedId=item.id;this.expanded=false;this.detailPage=0;this.notice='';this.render();});
    if(item.kind==='skill') {
      this.add(this.scene.add.rectangle(x,389,72,72,0x15283e,0).setStrokeStyle(2,rarity.color,0.85));
      this.text(x,389,item.icon,{fontSize:'38px',color:rarity.uiColor},[0.5,0.5]).setAlpha(bought?0.3:1);
    } else this.add(drawShopIcon(this.scene,x,389,item.icon,item.color,76)).setAlpha(bought?0.3:1);
    this.text(x,454,item.name,{fontSize:'22px',color:bought?MUTED:rarity.uiColor,align:'center',wordWrap:{width:152}},[0.5,0]);
    this.text(x,508,bought?'已售出':item.price+' 金币',{fontSize:'23px',color:bought?MUTED:'#ffda80'},[0.5,0.5]);
    if(selling) this.text(x,530,'×'+item.units,{fontSize:'18px',color:MUTED},[0.5,0]);
    else if(system.normal&&!bought) {
      const lock=this.add(this.scene.add.graphics());
      lock.lineStyle(3,item.locked?0xffda80:0x97aabe,1);
      lock.strokeRoundedRect(x-8,558,16,16,3);
      lock.beginPath();lock.arc(x+(item.locked?0:6),558,6,Math.PI,Math.PI*2,false);lock.strokePath();
      const lockHit=this.add(this.scene.add.rectangle(x,566,60,48,0xffffff,0.001),DEPTH+3);
      makeInteractive(lockHit).on('pointerdown',()=>{system.toggleLock(item.id);this.render();});
    }
  }
  details(item,selling) {
    const system=this.scene.shopSystem;
    if(item.kind==='skill') system.syncSkillOffer(item);
    const formatted=item.kind==='skill'?formatSkillSelectionOption(item,this.scene.playerData):null;
    const heading=item.name+(formatted?'  '+formatted.levelText:'');
    this.text(42,616,heading,{fontSize:'27px',fontStyle:'bold'});
    const main=formatted?(formatted.purposeLines||[]).join('；'):item.description;
    if(this.expanded && formatted) {
      const rows=[main,...(formatted.effectLines||[]),...(formatted.milestoneRows||[]).map(row=>'Lv.'+row.level+'：'+row.text)];
      // Short pages keep every line within the viewport; no cropping or browser-specific mask.
      const lines=rows.flatMap(row=>this.wrap(row,25)), pages=Math.max(1,Math.ceil(lines.length/3));
      this.detailPage=Math.min(this.detailPage,pages-1);
      this.text(42,662,lines.slice(this.detailPage*3,this.detailPage*3+3).join('\n'),{fontSize:'22px',lineSpacing:4,color:MUTED});
      this.button(595,808,164,(this.detailPage+1)+'/'+pages+' 下一页',()=>{this.detailPage=(this.detailPage+1)%pages;this.render();},{disabled:pages===1});
    } else this.text(42,668,this.wrap(main,25).slice(0,3).join('\n'),{fontSize:'24px',lineSpacing:5});
    if(formatted) this.button(132,808,180,this.expanded?'收起详情':'完整详情',()=>{this.expanded=!this.expanded;this.detailPage=0;this.render();});
    const bought=!selling&&system.purchased.has(item.id);
    const label=selling?'出售一件 · '+item.price+' 金币':bought?'已售出':'购买 · '+item.price+' 金币';
    this.button(360,808,252,label,()=>{
      const result=selling?system.sell(item.unitId):system.buy(item.id);
      if(result.needsReplacement) {this.mode='replace';this.pendingOfferId=item.id;this.replacementIndex=null;this.render();return;}
      this.notice=result.message||result.reason;
      if(selling&&result.ok)this.selectedId=null;
      this.render();
    },{disabled:bought||(!selling&&!system.canBuy(item))});
  }
  wrap(value,width) {
    const out=[];
    for(const paragraph of String(value||'').split('\n')) {
      let row='',units=0;
      for(const char of paragraph) {
        const size=/[\x00-\xff]/.test(char)?0.55:1;
        if(units+size>width) {out.push(row);row='';units=0;}
        row+=char;units+=size;
      }
      if(row)out.push(row);
    }
    return out;
  }
  renderReplacement() {
    this.text(42,318,'选中要换掉的技能，再确认购买；取消不扣金币。',{fontSize:'23px'});
    this.scene.playerData.skills.forEach((skill,index)=>{
      const x=140+(index%3)*220,y=458+Math.floor(index/3)*132;
      this.button(x,y,200,(SKILLS[skill.id]?.name||skill.id)+'\nLv.'+skill.level,()=>{
        this.replacementIndex=index;this.render();
      });
      if(this.replacementIndex===index) this.text(x,y+38,'已选中',{fontSize:'20px',color:'#ffda80'},[0.5,0]);
    });
    this.text(42,722,this.notice||'',{color:'#b0e5c0'});
    this.button(190,850,280,'取消 / 返回商店',()=>{this.mode='buy';this.pendingOfferId=null;this.notice='';this.render();});
    this.button(530,850,280,'确认替换并购买',()=>{
      const result=this.scene.shopSystem.buy(this.pendingOfferId,{replaceIndex:this.replacementIndex});
      this.notice=result.message||result.reason;
      if(result.ok) {this.mode='buy';this.pendingOfferId=null;}
      this.render();
    },{disabled:this.replacementIndex===null});
  }
  buy(itemId) {
    const result=this.scene.shopSystem.buy(itemId);this.notice=result.message||result.reason;this.render();
  }
  hide({resume=true}={}) {
    if(!this.isOpen) return;
    this.isOpen=false;this.clearNodes();this.pendingOfferId=null;this.items=[];this.selectedId=null;
    this.goldText=null;this.message=null;
    const reason=this.reason;this.reason=null;
    if(resume) this.scene.shopSystem?.closeCurrent({resume:true});
    else if(this.scene.shopSystem?.currentShopReason===reason) this.scene.shopSystem.currentShopReason=null;
  }
  destroy({resume=false}={}) { this.hide({resume}); }
}
