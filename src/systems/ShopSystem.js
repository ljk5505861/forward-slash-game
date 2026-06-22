import Phaser from 'phaser';
import { SHOP_ITEMS } from '../config/shopItems.js';
import { CombatEvents } from '../core/CombatEvents.js';

export default class ShopSystem {
  constructor(scene){ this.scene=scene; this.visits=0; this.currentItems=[]; this.purchased=new Set(); }
  reset(){ this.visits=0; this.currentItems=[]; this.purchased.clear(); }
  generateItems(count=4){ this.currentItems=Phaser.Utils.Array.Shuffle([...SHOP_ITEMS]).slice(0,count).map(item=>({...item})); this.purchased.clear(); return this.currentItems; }
  open(reason='stage'){ this.visits+=1; this.generateItems(4); this.scene.shopPanel?.show({ reason, items:this.currentItems }); }
  canBuy(item){ return !!item && !this.purchased.has(item.id) && (this.scene.playerData.gold||0)>=item.price; }
  buy(itemId){ const item=this.currentItems.find(x=>x.id===itemId); if(!item||this.purchased.has(item.id)) return { ok:false, reason:'已购买' }; if((this.scene.playerData.gold||0)<item.price) return { ok:false, reason:'金币不足' }; this.scene.playerData.gold-=item.price; item.effect(this.scene.playerData); this.purchased.add(item.id); this.scene.runStats?.recordShopPurchase?.(item); this.scene.eventBus.emit(CombatEvents.SHOP_PURCHASED,{ itemId:item.id, item }); this.scene.hud?.update(); return { ok:true, message:`${item.name} 生效` }; }
}
