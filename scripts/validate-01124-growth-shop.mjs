import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../src/skills/handlers/index.js';
import ShopSystem from '../src/systems/ShopSystem.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import ProfessionSystem from '../src/systems/ProfessionSystem.js';
import { SHOP_ITEMS, LEGACY_SHOP_ITEMS, shopSellPrice } from '../src/config/shopItems.js';
import { SKILLS } from '../src/config/skills.js';
import { createPlayerRuntime, getEffectiveAttack, getEffectiveDefense, getEffectiveCritMultiplier, sumRuntimeBonuses } from '../src/config/balance.js';
import { getRarity } from '../src/config/rarities.js';
import { formatSkillSelectionOption } from '../src/ui/selectionFormatters.js';
import { drawShopIcon } from '../src/ui/shopIcons.js';

function harness(mode='normal',random=()=>0.8) {
  const s={runMode:mode,playerData:createPlayerRuntime(),enemies:[],player:{x:100,y:100},
    events:{on(){},once(){},off(){}},eventBus:{on(){return ()=>{};},emit(){}},
    getGameplayTime:()=>0,hud:{update(){}},skillBar:{update(){}},shopPanel:{show(){}},
    beginGameplayPause(){this.paused=true;},onShopClosed(){this.closed=(this.closed||0)+1;this.paused=false;}};
  s.skillSystem=new SkillSystem(s);s.professionSystem=new ProfessionSystem(s);
  s.shopSystem=new ShopSystem(s,{random});s.shopSystem.open('first');s.playerData.gold=1000;return s;
}
function offer(s,id) {
  const item=SHOP_ITEMS.find(item=>item.id===id);
  const entry={...item,itemId:id,id:'offer_'+(++s.shopSystem.serial)};
  s.shopSystem.currentItems=[entry];return entry;
}
const stats=p=>[
  getEffectiveAttack(p),sumRuntimeBonuses(p.strengthBonuses),p.maxHp,p.maxMana,
  p.attackSpeedMultiplier+sumRuntimeBonuses(p.attackSpeedMultiplierBonuses),
  getEffectiveDefense(p),sumRuntimeBonuses(p.dodgeChanceBonuses),p.critChance,
  getEffectiveCritMultiplier(p),p.skillDamageMultiplier,sumRuntimeBonuses(p.normalAttackDamageBonuses),
  p.cooldownReduction+sumRuntimeBonuses(p.cooldownReductionBonuses),sumRuntimeBonuses(p.manaRegenPerSecondBonuses),
];
assert.equal(SHOP_ITEMS.length,13);
assert.equal(new Set(SHOP_ITEMS.map(item=>item.icon)).size,13);
for(const item of SHOP_ITEMS) {
  const s=harness(),p=s.playerData;
  // Independent source contributions must survive buying and selling.
  p.attackBonuses.other=4;p.defenseBonuses.other=3;p.critMultiplierBonuses.other=.2;
  const before=stats(p),entry=offer(s,item.id),gold=p.gold;
  assert.equal(s.shopSystem.buy(entry.id).ok,true,item.id);
  assert.notDeepEqual(stats(p),before,item.id+' has a real runtime effect');
  assert.equal(s.shopSystem.buy(entry.id).ok,false,'double buy');
  assert.equal(p.gold,gold-item.price);
  const unit=s.shopSystem.ownedItems()[0];
  assert.equal(s.shopSystem.sell(unit.unitId).ok,true,item.id);
  assert.deepEqual(stats(p),before,item.id+' exact reversal');
  assert.equal(p.gold,gold-item.price+shopSellPrice(item.price));
  assert.equal(s.shopSystem.sell(unit.unitId).ok,false,'double sell');
}
{
  const s=harness(),p=s.playerData;
  p.hp=100;p.mana=20;
  for(const id of ['life_stone','mana_bead']){
    const before={hp:p.hp,mana:p.mana,maxHp:p.maxHp,maxMana:p.maxMana};
    const item=offer(s,id);s.shopSystem.buy(item.id);
    s.professionSystem.refreshResourceMaximums();
    assert.equal(p.maxHp,before.maxHp+(id==='life_stone'?50:0));
    assert.equal(p.maxMana,before.maxMana+(id==='mana_bead'?10:0));
    s.shopSystem.sell(s.shopSystem.ownedItems()[0].unitId);
    s.professionSystem.refreshResourceMaximums();
    for(const key of Object.keys(before))assert.equal(p[key],before[key],'no free healing or resource overwrite');
  }
  for(let i=0;i<3;i++) s.shopSystem.buy(offer(s,'iron_blade').id);
  assert.equal(s.shopSystem.ownedItems()[0].units,3);
  assert.equal(getEffectiveAttack(p),13);
  s.shopSystem.sell(s.shopSystem.ownedItems()[0].unitId);assert.equal(getEffectiveAttack(p),12);
}
{
  const s=harness(),sys=s.shopSystem;
  const locked=sys.currentItems[1];assert.equal(sys.toggleLock(locked.id),true);
  const gold=s.playerData.gold;assert.equal(sys.refresh().ok,true);assert.equal(s.playerData.gold,gold-4);
  assert.equal(sys.currentItems[1],locked);assert.equal(sys.refreshPrice,6);
  sys.closeCurrent();sys.closeCurrent();assert.equal(s.closed,1);
  assert.equal(sys.buy(locked.id).ok,false,'closed shop cannot transact');
  assert.equal(sys.open('second'),true);assert.equal(sys.currentItems[1],locked);assert.equal(sys.refreshPrice,4);
  for(const item of sys.currentItems)if(!item.locked)sys.toggleLock(item.id);
  const allGold=s.playerData.gold;assert.equal(sys.refresh().ok,false);assert.equal(s.playerData.gold,allGold);
  sys.reset();assert.equal(sys.inventory.length,0);assert.equal(sys.currentItems.length,0);
}
function skillOffer(s,id) {
  const cfg=SKILLS[id],owned=s.playerData.skills.find(x=>x.id===id);
  const o={id:'skill_offer',skillId:id,itemId:id,kind:'skill',name:cfg.name,icon:cfg.short,
    rarity:cfg.rarity,price:20,locked:true,type:owned?'skillLevel':'newSkill'};
  s.shopSystem.currentItems=[o];s.shopSystem.syncSkillOffer(o);return o;
}
{
  const s=harness(),sys=s.shopSystem,o=skillOffer(s,'healing');
  assert.equal(sys.buy(o.id).ok,true);assert.equal(s.skillSystem.getLevel('healing'),1);
  sys.purchased.clear();o.locked=true;
  // A free reward between visits upgrades the locked skill; next purchase follows current level.
  s.skillSystem.addOrLevel('healing');sys.closeCurrent();sys.open('second');
  assert.equal(sys.currentItems[0].price,20);assert.equal(sys.currentItems[0].fromLevel,2);
  assert.equal(sys.buy(o.id).ok,true);assert.equal(s.skillSystem.getLevel('healing'),3);
  // Exhaust the skill while the offer remains locked: next visit releases it.
  sys.purchased.clear();o.locked=true;s.playerData.skills.find(x=>x.id==='healing').level=SKILLS.healing.maxLevel;
  sys.closeCurrent();sys.open('third');assert.notEqual(sys.currentItems[0].id,o.id);
}
{
  const s=harness(),sys=s.shopSystem;
  s.playerData.skills=Object.keys(SKILLS).filter(id=>id!=='healing').slice(0,6).map(id=>({id,level:1}));
  const o=skillOffer(s,'healing'),gold=s.playerData.gold,original=s.playerData.skills.map(x=>({...x}));
  assert.equal(sys.buy(o.id).needsReplacement,true);
  assert.equal(s.playerData.gold,gold);assert.deepEqual(s.playerData.skills,original);
  assert.equal(sys.buy(o.id,{replaceIndex:9}).ok,false);
  assert.equal(sys.buy(o.id,{replaceIndex:5}).ok,true);
  assert.equal(s.playerData.skills[5].id,'healing');assert.equal(s.playerData.gold,gold-20);
  assert.equal(s.playerData.skills.length,6);assert.equal(sys.buy(o.id).ok,false);
}
{
  let seed=1234567;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const s=harness('normal',random),sys=s.shopSystem;let skillRounds=0;
  for(let i=0;i<1000;i++) {
    sys.currentItems=[];sys.generateItems();assert.equal(sys.currentItems.length,4);
    const skills=sys.currentItems.filter(o=>o.kind==='skill');assert(skills.length<=1);skillRounds+=skills.length;
    assert(sys.currentItems.some(o=>o.price<=12),'first shop offers affordable basic items');
    assert(skills.every(o=>!['EPIC','LEGENDARY','MYTHIC'].includes(o.rarity)));
  }
  assert(skillRounds>190&&skillRounds<310,'roughly 25% contain one skill');
  const o=skillOffer(s,'healing');s.playerData.level=13;
  for(let i=0;i<100;i++){sys.generateItems();assert.equal(sys.currentItems[0],o);assert.equal(sys.currentItems.filter(o=>o.kind==='skill').length,1);}
  s.playerData.gold=0;const before=sys.currentItems.slice();assert.equal(sys.refresh().ok,false);assert.deepEqual(sys.currentItems,before);
  assert.equal(sys.buy(o.id).ok,false);
}
{
  const s=harness('test'),sys=s.shopSystem;
  assert(sys.currentItems.every(item=>LEGACY_SHOP_ITEMS.some(old=>old.id===item.id&&old.price===item.price)));
  assert.equal(sys.toggleLock(sys.currentItems[0].id),false);assert.equal(sys.refresh().ok,false);
  const item=sys.currentItems[0];assert.equal(sys.buy(item.id).ok,true);assert.equal(sys.inventory.length,0);
}
// Exercise actual panel callbacks with inert Phaser nodes, including all 6 replacement slots,
// inventory paging, lock hit targets and disposal; browser smoke separately checks rendering.
function node(kind,args){
  const target={kind,args,text:kind==='text'?args[2]:'',callbacks:{},dead:false,width:args[2]||100,height:52,
    on(event,fn){this.callbacks[event]=fn;return proxy;},destroy(){this.dead=true;},
    removeAllListeners(){this.callbacks={};},setText(v){this.text=v;return proxy;}};
  const proxy=new Proxy(target,{get(o,k){if(k in o)return o[k];return ()=>proxy;}});return proxy;
}
const panelSource=fs.readFileSync(new URL('../src/ui/ShopPanel.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default class','class')+'\nShopPanel;';
const ShopPanel=vm.runInNewContext(panelSource,{DESIGN_WIDTH:720,DESIGN_HEIGHT:1280,SKILLS,getRarity,formatSkillSelectionOption,drawShopIcon,makeInteractive:n=>n});
{
  const s=harness();s.add=Object.fromEntries(['text','rectangle','graphics'].map(kind=>[kind,(...args)=>node(kind,args)]));
  const panel=s.shopPanel=new ShopPanel(s);
  const entry=offer(s,'iron_blade');panel.show({items:[entry],reason:'first'});assert(s.paused);
  const initial=panel.nodes.slice();panel.selectedId=entry.id;panel.render();assert(initial.every(n=>n.dead));
  assert.equal(panel.nodes.filter(n=>n.kind==='text'&&n.text==='铁刃').length,2);
  panel.buy(entry.id);panel.mode='sell';panel.selectedId='iron_blade';panel.render();
  assert(panel.nodes.some(n=>n.text==='出售一件 · 4 金币'));
  for(const item of SHOP_ITEMS)if(item.id!=='iron_blade')s.shopSystem.buy(offer(s,item.id).id);
  panel.page=3;panel.selectedId=null;panel.render();assert.equal(panel.page,3);
  panel.hide();panel.hide();assert.equal(s.closed,1);assert.equal(panel.nodes.length,0);
  for(const item of SHOP_ITEMS)assert.doesNotThrow(()=>drawShopIcon(s,0,0,item.icon,item.color));
}
console.log('v0.11.24 growth shop: 13 reversible stats, prices, locks, refunds, skills, six-slot replacement, probabilities, legacy and UI lifecycle PASS');
