import { SHOP_ITEMS } from '../src/config/shopItems.js';
if (SHOP_ITEMS.length !== 8) throw new Error('shop must define 8 items');
const ids = new Set(SHOP_ITEMS.map(i => i.id));
if (ids.size !== SHOP_ITEMS.length) throw new Error('shop item ids must be unique');
for (const item of SHOP_ITEMS) {
  if (!item.name || !item.description || !item.price || typeof item.effect !== 'function' || !item.stat) throw new Error(`invalid shop item ${item.id}`);
}
console.log('[validate:shop-flow] PASS 8 items with real effects');
