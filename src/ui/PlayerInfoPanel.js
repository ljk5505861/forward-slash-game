import { getEffectiveAttack, getTotalStrength, sumRuntimeBonuses } from '../config/balance.js';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { ARTIFACTS } from '../config/artifacts.js';
import { PROFESSIONS } from '../config/professions.js';

const DEPTH=4300;
const REFRESH_INTERVAL_MS=100;
const pct=v=>`${Math.round((Number(v)||0)*100)}%`;
const cap95=v=>Math.max(0,Math.min(0.95,Number(v)||0));
const bonus=(p,k)=>sumRuntimeBonuses(p?.[k]);

export default class PlayerInfoPanel {
  constructor(scene){ this.scene=scene; this.nodes=[]; this.content=[]; this.valueNodes=new Map(); this.valueSnapshot=new Map(); this.page=0; this.isOpen=false; this.lastRefreshAt=0; }
  show(){ if(this.isOpen) return; this.isOpen=true; this.page=0; this.lastRefreshAt=0; const s=this.scene; s.beginGameplayPause?.();
    this.mask=s.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,DESIGN_WIDTH,DESIGN_HEIGHT,0x030712,0.48).setScrollFactor(0).setDepth(DEPTH).setInteractive();
    this.mask.on('pointerdown',()=>{}); this.mask.on('pointerup',()=>{}); this.nodes.push(this.mask);
    this.nodes.push(s.add.rectangle(DESIGN_WIDTH/2,620,620,640,0x0b1020,0.96).setStrokeStyle(4,0x7da7ff,0.86).setScrollFactor(0).setDepth(DEPTH+1));
    this.title=this.text(DESIGN_WIDTH/2,330,'角色信息',{fontSize:'34px',color:'#fff'},[0.5,0]);
    const close=this.text(DESIGN_WIDTH/2+266,326,'×',{fontSize:'40px',color:'#fff',backgroundColor:'#633',padding:{left:14,right:14,top:2,bottom:2}},[0.5,0]).setInteractive({useHandCursor:true}); close.on('pointerdown',()=>this.hide());
    const prev=this.text(DESIGN_WIDTH/2-245,885,'‹',{fontSize:'46px',color:'#dbeafe',backgroundColor:'#24324f',padding:{left:20,right:20,top:0,bottom:0}},[0.5,0]).setInteractive({useHandCursor:true}); prev.on('pointerdown',()=>this.flip(-1));
    const next=this.text(DESIGN_WIDTH/2+245,885,'›',{fontSize:'46px',color:'#dbeafe',backgroundColor:'#24324f',padding:{left:20,right:20,top:0,bottom:0}},[0.5,0]).setInteractive({useHandCursor:true}); next.on('pointerdown',()=>this.flip(1));
    this.pageText=this.text(DESIGN_WIDTH/2,900,'1/2',{fontSize:'22px',color:'#cbd6ee'},[0.5,0]);
    this.buildPage(); }
  text(x,y,t,style={},origin=[0,0]){ const n=this.scene.add.text(x,y,t,{fontFamily:'Arial',fontSize:'22px',color:'#e5edff',stroke:'#000',strokeThickness:3,lineSpacing:8,wordWrap:{width:540,useAdvancedWrap:true},...style}).setOrigin(...origin).setScrollFactor(0).setDepth(DEPTH+2); this.nodes.push(n); return n; }
  flip(d){ if(!this.isOpen) return; this.page=(this.page+d+2)%2; this.buildPage(); }
  render(){ if(!this.isOpen) return; this.refreshValues(true); }
  update(time=0){ if(!this.isOpen) return; if(time-this.lastRefreshAt<REFRESH_INTERVAL_MS) return; this.lastRefreshAt=time; this.refreshValues(false); }
  addContent(n){ this.content.push(n); this.nodes.push(n); return n; }
  clearContent(){ const old=new Set(this.content); this.content.forEach(n=>{n.removeAllListeners?.();n.destroy();}); this.nodes=this.nodes.filter(n=>!old.has(n)); this.content=[]; this.valueNodes.clear(); this.valueSnapshot.clear(); }
  buildPage(){ this.clearContent(); this.pageText?.setText(`${this.page+1}/2`); if(this.page===0) this.renderList('基础属性', this.pageOneRows()); else this.renderBuild(); this.refreshValues(true); }
  pageOneRows(){ return [ ['attack','攻击力'],['strength','力量'],['spellPower','法术强度'],['attackSpeed','攻击速度'],['defense','护甲'],['dodge','闪避率'],['maxHp','最大生命'],['hp','当前生命'],['maxMana','最大法力'],['mana','当前法力'],['critChance','暴击率'],['critMultiplier','暴击伤害'],['skillHaste','技能急速'],['cooldownReduction','冷却缩减'],['lifeSteal','吸血'],['skillDamage','技能伤害倍率'],['normalAttackDamage','普攻伤害倍率'] ]; }
  snapshot(){ const p=this.scene.playerData||{}; if(this.page!==0){ const prof=PROFESSIONS[p.professionId]?.name||'未觉醒'; const arts=(p.artifacts||[]).map(a=>ARTIFACTS[typeof a==='string'?a:a.id]?.name||(typeof a==='string'?a:a.id)).join('、')||'无'; return new Map([['buildText',[`当前阶段：${this.scene.stageSystem?.phase?.()?.name||'-'}`,`当前等级：${p.level}`,`进度等级：${p.level}`,`法力：${p.mana??0}/${p.maxMana??0}`,`体力：${p.stamina??0}/${p.maxStamina??0}`,`二阶职业：${p.advancedProfessionId||'未进阶'}`,`击杀数：${this.scene.killCount}`,`runState：${this.scene.runState}`,`护盾：${p.shield||0}/${p.maxShield||0}`,`战意：${p.battleMarkStacks||0}`,`破军：${this.scene.artifactSystem?.highHpDamageMultiplier?.()>1?'ON':'OFF'}`,`减伤：${pct(p.temporaryDamageReduction||p.damageReduction||0)}`,`职业：${prof}`,`法宝：${arts}`].join('\n')]]); }
    const strength=getTotalStrength(p), base=Number(p.attack)||0, eff=getEffectiveAttack(p);
    return new Map([['attack',`${eff}（基础${base}＋力量${strength}）`],['strength',strength],['spellPower',p.spellPower??0],['attackSpeed',pct((p.attackSpeedMultiplier||1)+bonus(p,'attackSpeedMultiplierBonuses'))],['defense',Math.round((p.defense||0)+bonus(p,'defenseBonuses'))],['dodge',pct(cap95((p.dodgeChance||0)+bonus(p,'dodgeChanceBonuses')))],['maxHp',p.maxHp??0],['hp',p.hp??0],['maxMana',p.maxMana??0],['mana',p.mana??0],['critChance',pct(cap95((p.critChance||0)+bonus(p,'physicalCritChanceBonuses')))],['critMultiplier',pct((p.critMultiplier||1.5)+bonus(p,'physicalCritMultiplierBonuses'))],['skillHaste',pct(p.skillHaste||0)],['cooldownReduction',pct(p.cooldownReduction||0)],['lifeSteal',pct((p.lifeSteal||0)+bonus(p,'lifeStealBonuses')+bonus(p,'physicalLifeStealBonuses'))],['skillDamage',pct(p.skillDamageMultiplier||1)],['normalAttackDamage',pct(1+bonus(p,'attackDamageBonuses')+bonus(p,'normalAttackDamageBonuses'))]]); }
  refreshValues(force=false){ const next=this.snapshot(); for(const [key,value] of next){ if(!force&&this.valueSnapshot.get(key)===value) continue; this.valueSnapshot.set(key,value); const node=this.valueNodes.get(key); if(!node) continue; node.setText(node._formatter?node._formatter(value,node):`${node._label}：${value}`); } }
  renderList(title, rows){ this.addContent(this.scene.add.text(DESIGN_WIDTH/2,388,title,{fontFamily:'Arial',fontSize:'28px',color:'#9fd0ff',stroke:'#000',strokeThickness:3}).setOrigin(0.5,0).setScrollFactor(0).setDepth(DEPTH+2)); rows.forEach(([key,label],i)=>{ const full=key==='attack', idx=full?0:i-1, col=full?0:idx%2,row=full?0:Math.floor(idx/2)+1,x=DESIGN_WIDTH/2-250+col*270,y=442+row*48; const n=this.scene.add.text(x,y,`${label}：`,{fontFamily:'Arial',fontSize:'21px',color:'#f2f6ff',stroke:'#000',strokeThickness:3,wordWrap:{width:full?520:250,useAdvancedWrap:true}}).setScrollFactor(0).setDepth(DEPTH+2); n._label=label; n._fullWidth=full; n._layout={fullWidth:full,width:full?520:250,x,y}; this.valueNodes.set(key,n); this.addContent(n); }); }
  renderBuild(){ const n=this.scene.add.text(DESIGN_WIDTH/2-260,392,'',{fontFamily:'Arial',fontSize:'22px',color:'#f2f6ff',stroke:'#000',strokeThickness:3,lineSpacing:10,wordWrap:{width:520,useAdvancedWrap:true}}).setScrollFactor(0).setDepth(DEPTH+2); n._label=''; n._formatter=value=>value; this.valueNodes.set('buildText',n); this.addContent(n); }
  hide(){ if(!this.isOpen) return; this.nodes.forEach(n=>{n.removeAllListeners?.();n.destroy();}); this.nodes=[]; this.content=[]; this.valueNodes.clear(); this.valueSnapshot.clear(); this.mask=null; this.isOpen=false; this.lastRefreshAt=0; this.scene.resumeModalFlow?.(); }
  destroy(){ this.hide(); }
}
