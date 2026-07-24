import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { getCultivationSnapshot } from './CultivationCoreSkill.js';
import { getAlchemyDaoBuffModifiers } from './CultivationAlchemySkill.js';
import { rangeValue } from '../../systems/ActiveSkillModifierSystem.js';

export const MANTRA_HEAVENLY_BOOK_ID='mantra_heavenly_book';
export const MANTRA_MODES=Object.freeze(['life','spirit','slash','soul','curse','absorb']);
const names={life:'生',spirit:'灵',slash:'斩',soul:'神',curse:'咒',absorb:'纳'};
const help={life:'生命不足时恢复生命。',spirit:'恢复法力并推进其他主动技能冷却。',slash:'对残血敌人发动斩杀。',soul:'以元神压迫降低敌人移动和攻击速度。',curse:'施加倒计时诅咒，结束后造成高额伤害。',absorb:'将敌人收入天书炼化为临时己方单位。'};
const cooldown=[8000,7800,7600,7400,7200,6900,6600,6300,5800], mana=[14,14,15,15,16,16,17,18,20];
const life=[.06,.065,.07,.075,.08,.085,.09,.095,.10], spirit=[.08,.085,.09,.095,.10,.105,.11,.115,.12], slash=[80,90,102,116,132,150,171,195,225], curse=[70,79,90,102,116,132,150,171,195];
const execution=[.12,.13,.15,.16,.18,.18,.19,.20,.20], soulDuration=[4000,4100,4200,4300,4400,4800,5000,5200,5600];
const slow=[[.15,.10,.05],[.18,.12,.06],[.22,.15,.08],[.26,.18,.10],[.30,.21,.12],[.34,.24,.14],[.38,.27,.16],[.42,.30,.18],[.48,.34,.20]];
const valid=(s,e)=>!!e&&e.active!==false&&!e.isDefeated&&!e.dead&&Number(e.hp)>0&&s.targeting?.valid?.(e)!==false;
const now=s=>s.getGameplayTime?.()??s.now??0;
const realm=sys=>Math.max(0,Math.min(8,getCultivationSnapshot(sys).realmIndex||0));
const alchemy=sys=>getAlchemyDaoBuffModifiers(sys).cultivationSkillDamageMultiplier>1?1.5:1;
export function getMantraMode(sceneOrSystem){const p=(sceneOrSystem.scene||sceneOrSystem).playerData; return MANTRA_MODES.includes(p?.mantraHeavenlyBookMode)?p.mantraHeavenlyBookMode:null;}
export function chooseMantraMode(sceneOrSystem,mode){const s=sceneOrSystem.scene||sceneOrSystem;if(!MANTRA_MODES.includes(mode)||!s?.playerData)return false;s.playerData.mantraHeavenlyBookMode=mode;s.skillBar?.update?.();return true;}
function targets(sys){const s=sys.scene,p=s.player||{x:0,y:0};return (s.targeting?.all?.()||s.enemies||[]).filter(e=>valid(s,e)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));}
function targetFor(sys,mode){const all=targets(sys),p=sys.scene.player||{};if(mode==='slash'){const r=realm(sys),within=all.filter(e=>e.hp/(e.maxHp||e.hp)<=execution[r]);return within.sort((a,b)=>(b.isBoss?2:b.isElite?1:0)-(a.isBoss?2:a.isElite?1:0)||b.hp-a.hp||Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]||all.sort((a,b)=>a.hp/(a.maxHp||a.hp)-b.hp/(b.maxHp||b.hp))[0];}if(mode==='curse')return all.sort((a,b)=>(b.isBoss?2:b.isElite?1:0)-(a.isBoss?2:a.isElite?1:0)||b.hp-a.hp)[0];if(mode==='absorb')return all.filter(e=>!e.isBoss&&!e.isFinalBoss&&!(e.isElite&&realm(sys)<3)&&!e.mantraAbsorbed&&!e.mantraAlly).sort((a,b)=>(b.isElite?1:0)-(a.isElite?1:0)||b.hp-a.hp)[0];return all[0];}
function addActive(sys,a){sys.active.push(a);return a;}
function clean(a){a.visuals?.forEach(v=>v?.destroy?.());a.visuals=[];a.ended=true;}
export const MantraHeavenlyBookSkill={
  onAcquire(sys){if(!getMantraMode(sys)) chooseMantraMode(sys,'life');},
  canCast(sys){const mode=getMantraMode(sys);if(!mode)return false;const p=sys.scene.playerData;if(mode==='life')return p.hp/p.maxHp<.8;if(mode==='spirit'){const active=sys.getOwned().filter(x=>x.id!==MANTRA_HEAVENLY_BOOK_ID&&!SKILLS[x.id]?.passive).filter(x=>(sys.cooldowns.get(x.id)||0)>now(sys.scene));return p.mana/p.maxMana<.7||active.length>=2;}if(['slash','curse','absorb'].includes(mode))return !!targetFor(sys,mode);return true;},
  cast(sys,cfg,data,level,ctx){const mode=getMantraMode(sys),s=sys.scene,t=now(s),p=s.playerData,bonus=alchemy(sys);if(!mode)return {failed:true};if(mode==='life'){const missing=Math.min(4,Math.floor((p.maxHp-p.hp)/(p.maxHp*.1)))*.01;const amount=Math.round(p.maxHp*(life[level-1]+missing)*bonus);p.hp=Math.min(p.maxHp,p.hp+amount);s.hud?.update?.();if(level>=3)addActive(sys,{skillId:cfg.id,nextAt:t+250,endAt:t+4000,data:{},visuals:[],tick(){p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.04/16*bonus);s.hud?.update?.();},onEnd(){clean(this)}});return {};}
    if(mode==='spirit'){sys.recoverMana(p.maxMana*spirit[level-1]*bonus);if(level>=3){const ratio=[0,0,0,.08,.09,.10,.11,.12,.13,.15][level]||0; const longest=Math.max(0,...sys.getOwned().map(x=>Math.max(0,(sys.cooldowns.get(x.id)||t)-t))); sys.reduceActiveCooldowns(Math.min(1000,Math.round(longest*ratio)),{excludeSkillIds:[cfg.id]});}return {};}
    if(mode==='slash'){const e=targetFor(sys,mode);if(!e)return {failed:true};const hpRatio=e.hp/(e.maxHp||e.hp);if(!e.isBoss&&!e.isElite&&hpRatio<=execution[realm(sys)])return sys.hit(e,Math.max(1,e.hp),cfg,level,ctx,Math.max(1,e.hp),[TAGS.CULTIVATION,TAGS.MAGIC,TAGS.SPELL]);const base=slash[level-1]*(1+Math.min(.4,(1-hpRatio)*.5));return sys.hit(e,sys.damageValue(base,ctx),cfg,level,ctx,sys.baseDamageValue(base,ctx),[TAGS.CULTIVATION,TAGS.MAGIC,TAGS.SPELL]);}
    if(mode==='soul'){const duration=soulDuration[level-1]*bonus,idx=realm(sys);targets(sys).forEach(e=>{e.mantraSoulSources??=new Map();const tier=e.isBoss?2:e.isElite?1:0;e.mantraSoulSources.set(ctx.castId,{slow:slow[idx][tier],attackSlow:level>=3?slow[idx][tier]/2:0,expiresAt:t+duration});});return addActive(sys,{skillId:cfg.id,nextAt:t+100,endAt:t+duration,visuals:[],tick(){targets(sys).forEach(e=>e.mantraSoulSources?.forEach((v,k)=>{if(v.expiresAt<=now(s))e.mantraSoulSources.delete(k);}));},onEnd(){clean(this)}});}
    if(mode==='curse'){const e=targetFor(sys,mode);if(!e)return {failed:true};e.mantraCurse??=null;if(e.mantraCurse)return {failed:true};const delay=[4000,3900,3800,3600,3300,3200,3100,3000,2800][realm(sys)],a={skillId:cfg.id,nextAt:t+100,endAt:t+delay,target:e,data,level,ctx,stacks:0,lastHitAt:-Infinity,visuals:[],tick(){if(now(s)>=this.endAt&&valid(s,e)){const base=curse[level-1]*(1+this.stacks*.05);sys.hit(e,sys.damageValue(base,ctx),cfg,level,ctx,sys.baseDamageValue(base,ctx),[TAGS.CULTIVATION,TAGS.MAGIC,TAGS.SPELL]);clean(this);e.mantraCurse=null;}},onEnd(){e.mantraCurse=null;clean(this)}};e.mantraCurse=a;return addActive(sys,a);}
    return {failed:true};
  },
  cleanup(sys){sys.active.filter(a=>a.skillId===MANTRA_HEAVENLY_BOOK_ID).forEach(a=>a.onEnd?.('cleanup'));},
  shiftTimers(sys,d,pauseAt){sys.active.filter(a=>a.skillId===MANTRA_HEAVENLY_BOOK_ID).forEach(a=>{if(a.nextAt>pauseAt)a.nextAt+=d;if(a.endAt>pauseAt)a.endAt+=d;});}
};
export function configureMantraHeavenlyBookSkill(){SKILLS[MANTRA_HEAVENLY_BOOK_ID]={id:MANTRA_HEAVENLY_BOOK_ID,name:'真言天书',rarity:'MYTHIC',type:'主动修仙法术',maxLevel:9,passive:false,targetType:'self',handler:MANTRA_HEAVENLY_BOOK_ID,short:'言',color:0xc084fc,tags:[TAGS.CULTIVATION,TAGS.MAGIC,TAGS.SPELL,TAGS.ACTIVE_SKILL,TAGS.BUILD_CULTIVATION,TAGS.MYTHIC_SKILL],description:'持有六种可随时切换的真言。当前真言会按统一冷却自动施放，切换不重置冷却。',milestones:{3:'真言显化',6:'天书敕令',9:'道法真言'},levels:cooldown.map((cooldownMs,i)=>({cooldownMs,manaCost:mana[i],lifeRatio:life[i],spiritRatio:spirit[i],slashDamage:slash[i],curseDamage:curse[i],soulDurationMs:soulDuration[i],desc:`当前真言：${names.life}/${names.spirit}/${names.slash}/${names.soul}/${names.curse}/${names.absorb}。${help.life}`}))};}
export { names as MANTRA_MODE_NAMES, help as MANTRA_MODE_HELP };
export function openMantraHeavenlyBookSelection(scene){
  if(!scene||scene.mantraHeavenlyBookSelectionOpen)return false;
  scene.mantraHeavenlyBookSelectionOpen=true; scene.beginGameplayPause?.();
  const nodes=[], depth=5100, cols=[0x4ade80,0x60a5fa,0xf59e0b,0xa78bfa,0x9f1239,0x164e63];
  const close=()=>{nodes.forEach(n=>{n.removeAllListeners?.();n.destroy?.();});scene.mantraHeavenlyBookSelectionOpen=false;scene.endGameplayPause?.();};
  const bg=scene.add.rectangle(360,640,720,1280,0x030712,.90).setScrollFactor(0).setDepth(depth).setInteractive();
  const title=scene.add.text(360,130,'真言天书·选择真言',{fontFamily:'Arial',fontSize:'36px',color:'#fff',stroke:'#000',strokeThickness:5}).setOrigin(.5).setScrollFactor(0).setDepth(depth+2);
  const cancel=scene.add.text(650,84,'取消',{fontFamily:'Arial',fontSize:'22px',color:'#fff',backgroundColor:'#4a2d38',padding:{left:14,right:14,top:8,bottom:8}}).setOrigin(.5).setScrollFactor(0).setDepth(depth+2).setInteractive({useHandCursor:true});
  nodes.push(bg,title,cancel);cancel.on('pointerdown',close);
  MANTRA_MODES.forEach((mode,i)=>{const x=190+(i%3)*170,y=350+Math.floor(i/3)*310,selected=getMantraMode(scene)===mode;const box=scene.add.rectangle(x,y,150,260,cols[i],.85).setStrokeStyle(selected?7:3,selected?0xffffff:0xcbd5e1,1).setScrollFactor(0).setDepth(depth+1).setInteractive({useHandCursor:true});const text=scene.add.text(x,y,`${names[mode]}\n${mode==='life'?'生字':mode==='spirit'?'灵字':mode==='slash'?'斩字':mode==='soul'?'神字':mode==='curse'?'咒字':'纳字'}\n${help[mode]}`,{fontFamily:'Arial',fontSize:'21px',align:'center',color:'#fff',stroke:'#000',strokeThickness:3,wordWrap:{width:130},lineSpacing:8}).setOrigin(.5).setScrollFactor(0).setDepth(depth+2);const select=()=>{chooseMantraMode(scene,mode);close();};box.on('pointerdown',select);text.setInteractive({useHandCursor:true}).on('pointerdown',select);nodes.push(box,text);});
  return true;
}
