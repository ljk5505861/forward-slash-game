import { getRarity, RARITY_UI_STYLE } from '../config/rarities.js';

export function rarityStyle(rarityId){
  const id = typeof rarityId === 'string' ? rarityId : rarityId?.id;
  return RARITY_UI_STYLE[id] || RARITY_UI_STYLE[getRarity(id)?.id] || RARITY_UI_STYLE.COMMON;
}

export function drawRarityFrame(graphics, { x, y, width, height, rarity, selected=false, alpha=0.9 } = {}){
  const s = rarityStyle(rarity);
  const left=x-width/2, right=x+width/2, top=y-height/2, bottom=y+height/2;
  const cut=18, tab=34;
  graphics.clear();
  graphics.fillStyle(0x0b1020, selected?0.24:0.14);
  graphics.beginPath();
  graphics.moveTo(left+cut, top); graphics.lineTo(right-cut, top); graphics.lineTo(right, top+cut);
  graphics.lineTo(right, bottom-cut); graphics.lineTo(right-cut, bottom); graphics.lineTo(left+cut, bottom);
  graphics.lineTo(left, bottom-cut); graphics.lineTo(left, top+cut); graphics.closePath(); graphics.fillPath();
  graphics.lineStyle(selected?7:5, s.secondaryColor, selected?0.95:0.55);
  graphics.strokePoints([{x:left+cut-5,y:top-5},{x:right-cut+5,y:top-5},{x:right+5,y:top+cut-5},{x:right+5,y:bottom-cut+5},{x:right-cut+5,y:bottom+5},{x:left+cut-5,y:bottom+5},{x:left-5,y:bottom-cut+5},{x:left-5,y:top+cut-5},{x:left+cut-5,y:top-5}], true);
  graphics.lineStyle(selected?5:4, s.mainColor, selected?1:alpha);
  graphics.strokePoints([{x:left+cut,y:top},{x:right-cut,y:top},{x:right,y:top+cut},{x:right,y:bottom-cut},{x:right-cut,y:bottom},{x:left+cut,y:bottom},{x:left,y:bottom-cut},{x:left,y:top+cut},{x:left+cut,y:top}], true);
  graphics.lineStyle(selected?4:3, 0xffffff, selected?0.5:0.2);
  graphics.lineBetween(left+24, top+12, left+tab+52, top+12);
  graphics.lineBetween(right-tab-52, bottom-12, right-24, bottom-12);
  graphics.lineStyle(selected?5:3, s.mainColor, selected?0.95:0.55);
  graphics.lineBetween(left+tab, bottom+10, left+tab+58, bottom+10);
  graphics.lineBetween(right-tab-58, top-10, right-tab, top-10);
  if(selected){
    graphics.fillStyle(s.mainColor, 0.95);
    graphics.fillTriangle(x-10, bottom+18, x+10, bottom+18, x, bottom+31);
  }
  return graphics;
}
