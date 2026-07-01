import Phaser from 'phaser';
import { SHOP_ITEMS } from '../config/shopItems.js';
import { CombatEvents } from '../core/CombatEvents.js';

export default class ShopSystem {
  constructor(scene){ this.scene=scene; this.visits=0; this.openedReasons=new Set(); this.currentItems=[]; this.currentShopReason=null; this.purchased=new Set(); }
  reset(){ this.visits=0; this.openedReasons.clear(); this.currentItems=[]; this.currentShopReason=null; this.purchased.clear(); }
  generateItems(count=4){ this.currentItems=Phaser.Utils.Array.Shuffle([...SHOP_ITEMS]).slice(0,count).map(item=>({...item})); this.purchased.clear(); return this.currentItems; }
  open(reason='stage'){ if(this.openedReasons.has(reason)) return false; this.visits+=1; this.openedReasons.add(reason); this.currentShopReason=reason; this.generateItems(4); this.scene.shopPanel?.show({ reason, items:this.currentItems }); return true; }
  closeCurrent({resume=true}={}){ const reason=this.currentShopReason; this.currentShopReason=null; if(resume) this.scene.onShopClosed?.(reason); return reason; }
  canBuy(item){ return !!item && !this.purchased.has(item.id) && (this.scene.playerData.gold||0)>=item.price; }
  buy(itemId){ const item=this.currentItems.find(x=>x.id===itemId); if(!item||this.purchased.has(item.id)) return { ok:false, reason:'已购买' }; if((this.scene.playerData.gold||0)<item.price) return { ok:false, reason:'金币不足' }; this.scene.playerData.gold-=item.price; item.effect(this.scene.playerData); this.purchased.add(item.id); this.scene.runStats?.recordShopPurchase?.(item); this.scene.eventBus.emit(CombatEvents.SHOP_PURCHASED,{ itemId:item.id, item }); this.scene.hud?.update(); return { ok:true, message:`${item.name} 生效` }; }
}
