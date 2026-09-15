import Phaser from 'phaser';
import { SHOP_ITEMS, LEGACY_SHOP_ITEMS, SHOP_SKILL_CHANCE, SHOP_SKILL_PRICES, shopRefreshPrice, shopSellPrice } from '../config/shopItems.js';
import { SKILLS } from '../config/skills.js';
import { rollNormalSkillCandidates } from '../config/normalSkillRewards.js';
import { CombatEvents } from '../core/CombatEvents.js';

export default class ShopSystem {
  constructor(scene, {random=Math.random}={}) { this.scene=scene; this.random=random; this.reset(); }
  reset() {
    this.visits=0; this.openedReasons=new Set(); this.currentItems=[];
    this.currentShopReason=null; this.purchased=new Set(); this.inventory=[];
    this.refreshCount=0; this.serial=0; this.trading=false;
  }
  get normal() { return this.scene.runMode==='normal'; }
  shuffle(items) {
    const result=[...items];
    for(let i=result.length-1;i>0;i--) { const j=Math.floor(this.random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
    return result;
  }
  ownedSkill(id) { return (this.scene.playerData.skills||[]).find(skill=>skill.id===id); }
  syncSkillOffer(offer) {
    if(offer?.kind!=='skill') return offer;
    const cfg=SKILLS[offer.skillId], owned=this.ownedSkill(offer.skillId);
    if(!cfg || (owned?.level||0)>=cfg.maxLevel) return null;
    offer.type=owned?'skillLevel':'newSkill';
    offer.fromLevel=owned?.level||0; offer.toLevel=offer.fromLevel+1;
    return offer;
  }
  skillOffer() {
    const candidates=Object.values(SKILLS).filter(cfg=>cfg.id!=='gravity_field' && (this.ownedSkill(cfg.id)?.level||0)<cfg.maxLevel)
      .map(cfg=>({skillId:cfg.id,type:this.ownedSkill(cfg.id)?'skillLevel':'newSkill',weight:1}));
    const choice=rollNormalSkillCandidates(candidates,this.scene.playerData.level,{random:this.random,count:1})[0];
    if(!choice) return null;
    const cfg=SKILLS[choice.skillId], current=this.ownedSkill(cfg.id)?.level||0;
    return {id:'offer_'+(++this.serial),itemId:cfg.id,skillId:cfg.id,kind:'skill',name:cfg.name,
      rarity:cfg.rarity,color:cfg.color,icon:cfg.short||cfg.name[0],description:cfg.description,
      price:SHOP_SKILL_PRICES[cfg.rarity]+current*2,locked:false,...choice,fromLevel:current,toLevel:current+1};
  }
  generateItems(count=4) {
    if(!this.normal) {
      this.currentItems=Phaser.Utils.Array.Shuffle([...LEGACY_SHOP_ITEMS]).slice(0,count).map(item=>({...item}));
    } else {
      const slots=Array.from({length:4},(_,index)=>{
        const offer=this.currentItems[index];
        return offer?.locked && !this.purchased.has(offer.id) ? this.syncSkillOffer(offer) : null;
      });
      const free=slots.map((o,i)=>o?null:i).filter(i=>i!==null);
      if(free.length && !slots.some(o=>o?.kind==='skill') && this.random()<SHOP_SKILL_CHANCE) {
        const skill=this.skillOffer();
        if(skill) slots[free[Math.floor(this.random()*free.length)]]=skill;
      }
      const used=new Set(slots.filter(Boolean).map(o=>o.itemId));
      const pool=this.shuffle(SHOP_ITEMS.filter(item=>!used.has(item.id)));
      this.currentItems=slots.map(offer=>offer||(()=>{
        const item=pool.pop();
        return {...item,itemId:item.id,id:'offer_'+(++this.serial),locked:false};
      })());
    }
    this.purchased.clear();
    return this.currentItems;
  }
  open(reason='stage') {
    if(this.currentShopReason || this.openedReasons.has(reason)) return false;
    this.visits++; this.openedReasons.add(reason); this.currentShopReason=reason;
    this.refreshCount=0; this.generateItems(4);
    this.scene.shopPanel?.show({reason,items:this.currentItems});
    return true;
  }
  closeCurrent({resume=true}={}) {
    const reason=this.currentShopReason; this.currentShopReason=null;
    if(resume && reason) this.scene.onShopClosed?.(reason);
    return reason;
  }
  canBuy(item) {
    return !!item && (!this.normal||!!this.currentShopReason) && !this.trading &&
      !this.purchased.has(item.id) && !!this.syncSkillOffer(item) && (this.scene.playerData.gold||0)>=item.price;
  }
  buy(offerId, {replaceIndex=null}={}) {
    const item=this.currentItems.find(offer=>offer.id===offerId);
    if(!item||this.purchased.has(offerId)) return {ok:false,reason:'已售出'};
    if(this.normal && !this.currentShopReason) return {ok:false,reason:'商店已关闭'};
    if(this.trading) return {ok:false,reason:'交易处理中'};
    if(!this.syncSkillOffer(item)) return {ok:false,reason:'技能已满级，请刷新'};
    const p=this.scene.playerData;
    if((p.gold||0)<item.price) return {ok:false,reason:'金币不足'};
    if(item.kind==='skill' && !this.ownedSkill(item.skillId) && p.skills.length>=6 && replaceIndex===null)
      return {ok:false,needsReplacement:true,offerId};
    if(replaceIndex!==null && (!Number.isInteger(replaceIndex)||replaceIndex<0||replaceIndex>=p.skills.length))
      return {ok:false,reason:'请选择要替换的技能'};
    this.trading=true;
    try {
      if(item.kind==='skill') {
        const result=this.scene.skillSystem.addOrLevel(item.skillId,{replaceIndex});
        if(!result?.applied) return {ok:false,reason:'技能未购买'};
      } else {
        item.effect(p);
        if(this.normal) this.inventory.push({id:'owned_'+(++this.serial),itemId:item.itemId,paidPrice:item.price});
      }
      p.gold-=item.price; item.locked=false; this.purchased.add(offerId);
      this.scene.runStats?.recordShopPurchase?.({...item,id:item.itemId||item.id});
      this.scene.eventBus?.emit(CombatEvents.SHOP_PURCHASED,{itemId:item.itemId||item.id,item});
      this.scene.hud?.update();
      return {ok:true,message:item.name+' 已购买'};
    } finally { this.trading=false; }
  }
  toggleLock(id) {
    const item=this.currentItems.find(o=>o.id===id);
    if(!this.normal||!this.currentShopReason||this.trading||!item||this.purchased.has(id)||!this.syncSkillOffer(item)) return false;
    item.locked=!item.locked; return true;
  }
  get refreshPrice() { return shopRefreshPrice(this.refreshCount); }
  refresh() {
    if(!this.normal||!this.currentShopReason||this.trading) return {ok:false,reason:'暂时无法刷新'};
    const validLocked=this.currentItems.filter(o=>o.locked&&!this.purchased.has(o.id)&&this.syncSkillOffer(o));
    if(validLocked.length===4) return {ok:false,reason:'请先解锁一件商品'};
    const price=this.refreshPrice, p=this.scene.playerData;
    if(p.gold<price) return {ok:false,reason:'金币不足'};
    p.gold-=price; this.refreshCount++; this.generateItems(4); this.scene.hud?.update();
    return {ok:true,message:'商品已刷新'};
  }
  ownedItems() {
    return SHOP_ITEMS.map(item=>{
      const units=this.inventory.filter(entry=>entry.itemId===item.id);
      return units.length?{...item,itemId:item.id,units:units.length,unitId:units.at(-1).id,price:shopSellPrice(units.at(-1).paidPrice)}:null;
    }).filter(Boolean);
  }
  sell(unitId) {
    if(!this.normal||!this.currentShopReason||this.trading) return {ok:false,reason:'暂时无法出售'};
    const index=this.inventory.findIndex(unit=>unit.id===unitId);
    if(index<0) return {ok:false,reason:'道具已售出'};
    const unit=this.inventory[index], item=SHOP_ITEMS.find(cfg=>cfg.id===unit.itemId);
    this.trading=true;
    try {
      item.remove(this.scene.playerData); this.inventory.splice(index,1);
      const refund=shopSellPrice(unit.paidPrice);
      this.scene.playerData.gold+=refund;
      // Refunds are not monster income and do not trigger kill-gold effects.
      this.scene.hud?.update();
      return {ok:true,message:item.name+' 已出售，返还 '+refund+' 金币'};
    } finally { this.trading=false; }
  }
}
