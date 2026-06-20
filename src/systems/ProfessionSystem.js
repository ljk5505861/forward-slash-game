import { CombatEvents } from '../core/CombatEvents.js';
import { getProfession, getProfessionAttackProfile, PROFESSION_STATE_DEFAULTS } from '../config/professions.js';

const cloneState = () => ({ ...PROFESSION_STATE_DEFAULTS });

export default class ProfessionSystem {
  constructor(scene){ this.scene=scene; this.unsubs=[]; this.appliedId=null; this.appliedBonuses=null; this.rangerMarks=new WeakMap(); }
  logError(stage, error, extra={}){ console.error(`[ProfessionSystem] ${stage}`, { professionId:this.scene.playerData?.professionId, appliedId:this.appliedId, ...extra, error }); }
  currentConfig(){ return getProfession(this.scene.playerData?.professionId); }
  currentAttackProfile(){ const cfg=this.currentConfig(); return cfg ? getProfessionAttackProfile(cfg.professionAttackProfile) : null; }
  selectProfession(id){
    const cfg=getProfession(id);
    if(!cfg){ console.error('[ProfessionSystem] profession application failed: unknown profession id', { professionId:id }); return false; }
    try {
      this.resetCoreState();
      const p=this.scene.playerData;
      p.professionId=id;
      p.professionState=cloneState();
      this.applyBonuses(cfg.bonuses);
      this.appliedId=id;
      this.appliedBonuses=cfg.bonuses;
      this.bind();
    } catch(error){
      this.logError('profession core application failed', error, { requestedId:id });
      return false;
    }
    this.notifyProfessionChosen(id,cfg);
    this.refreshProfessionPresentation(id);
    return true;
  }
  resetCoreState(){ this.unsubs.forEach(off=>off()); this.unsubs=[]; if(this.appliedBonuses) this.removeBonuses(this.appliedBonuses); this.appliedBonuses=null; this.appliedId=null; this.rangerMarks=new WeakMap(); if(this.scene.playerData){ this.scene.playerData.professionId=null; this.scene.playerData.professionState=cloneState(); } }
  notifyProfessionChosen(id,cfg){
    try { this.scene.runStats?.setProfession?.(id); } catch(error){ this.logError('profession stats update failed', error, { requestedId:id }); }
    try { this.scene.eventBus.emit(CombatEvents.PROFESSION_CHOSEN,{ professionId:id, profession:cfg }); } catch(error){ this.logError('PROFESSION_CHOSEN listener failed', error, { requestedId:id }); }
  }
  refreshProfessionPresentation(id){
    try { this.scene.professionWeaponView?.refresh(); } catch(error){ this.logError('profession weapon refresh failed', error, { requestedId:id }); }
    try { this.scene.hud?.update(); } catch(error){ this.logError('profession hud refresh failed', error, { requestedId:id }); }
  }
  applyBonuses(b={}){ const p=this.scene.playerData; if(b.attackMultiplier) p.attack=Math.max(1,Math.round(p.attack*b.attackMultiplier)); if(b.maxHp){ p.maxHp+=b.maxHp; p.hp+=b.maxHp; } if(b.skillDamageMultiplier) p.skillDamageMultiplier+=b.skillDamageMultiplier; if(b.cooldownReduction) p.cooldownReduction=Math.min(0.8,(p.cooldownReduction||0)+b.cooldownReduction); if(b.attackSpeedMultiplier) p.attackSpeedMultiplier+=b.attackSpeedMultiplier; if(b.critChance) p.critChance+=b.critChance; }
  removeBonuses(b={}){ const p=this.scene.playerData; if(b.attackMultiplier) p.attack=Math.max(1,Math.round(p.attack/b.attackMultiplier)); if(b.maxHp){ p.maxHp-=b.maxHp; p.hp=Math.min(p.hp,p.maxHp); } if(b.skillDamageMultiplier) p.skillDamageMultiplier-=b.skillDamageMultiplier; if(b.cooldownReduction) p.cooldownReduction-=b.cooldownReduction; if(b.attackSpeedMultiplier) p.attackSpeedMultiplier-=b.attackSpeedMultiplier; if(b.critChance) p.critChance-=b.critChance; }
  bind(){ const off=this.scene.eventBus.on(CombatEvents.PLAYER_DAMAGED,p=>this.onPlayerDamaged(p)); this.unsubs.push(off); }
  onPlayerDamaged(payload){ if(this.scene.playerData.professionId!=='warrior') return; if((payload.hpDamage||0)<=0 || payload.blocked) return; this.scene.playerData.professionState.warriorBuffUntil=this.scene.getGameplayTime()+4000; this.scene.runStats?.recordProfessionTrigger?.('warrior'); this.scene.hud?.update(); }
  getDamageMultiplier(source){ const p=this.scene.playerData; let mult=1; if(p.professionId==='warrior' && this.scene.getGameplayTime() < (p.professionState.warriorBuffUntil||0)) mult*=1.2; if(p.professionId==='mage' && source?.type==='activeSkill' && source?.damaging && p.professionState.mageEmpoweredNext){ mult*=1.5; if(!source.preview){ p.professionState.mageEmpoweredNext=false; p.professionState.mageCastCount=0; this.scene.runStats?.recordProfessionTrigger?.('mage'); this.scene.hud?.update(); } } return mult; }
  onActiveSkillCast(){ const p=this.scene.playerData; if(p.professionId!=='mage') return; if(!p.professionState.mageEmpoweredNext){ p.professionState.mageCastCount=Math.min(5,(p.professionState.mageCastCount||0)+1); if(p.professionState.mageCastCount>=5) p.professionState.mageEmpoweredNext=true; } this.scene.hud?.update(); }
  onDirectHit({ enemy, source='attack', baseDamage=0 }={}){ const p=this.scene.playerData; if(p.professionId!=='ranger' || !enemy) return; if(!['attack','skill'].includes(source)) return; const st=p.professionState; const next=(this.rangerMarks.get(enemy)||0)+1; this.rangerMarks.set(enemy,next); st.rangerLastTargetId=enemy.name || enemy.enemyId || '目标'; st.rangerLastTargetMarks=next; if(next>=3){ this.rangerMarks.set(enemy,0); st.rangerLastTargetMarks=0; const extra=Math.max(1,Math.round((baseDamage||p.attack)*0.55)); this.scene.combatSystem?.damageEnemy(enemy,extra,{ source:'profession', tags:['profession','mark'], professionApplied:true, professionMultiplier:1, baseAmountBeforeProfession:extra, noRangerMark:true }); this.scene.runStats?.recordProfessionTrigger?.('ranger'); this.scene.floatText(enemy.x,enemy.y-92,'猎印','#9dff8c'); }
    this.scene.hud?.update(); }
  shiftTimers(pausedDuration, pausedAt){ const st=this.scene.playerData.professionState; if(st?.warriorBuffUntil>pausedAt) st.warriorBuffUntil+=pausedDuration; }
  reset(){ this.resetCoreState(); try { this.scene.professionWeaponView?.clear(); } catch(error){ this.logError('profession weapon clear failed', error); } }
  destroy(){ this.reset(); }
}
