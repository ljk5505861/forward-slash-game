import { CombatEvents } from '../core/CombatEvents.js';
import { SKILLS } from '../config/skills.js';
import { ARTIFACTS } from '../config/artifacts.js';
import { PROFESSIONS } from '../config/professions.js';
const artifactIdOf = (entry) => typeof entry === 'string' ? entry : entry?.id;
const artifactLevelOf = (entry) => typeof entry === 'string' ? 1 : (entry?.level || 1);

const blank = () => ({ runStartedAt:0, runEndedAt:null, activePlayTimeMs:0, firstSkillObtainedAt:null, firstArtifactObtainedAt:null, levelsGained:0, upgradesChosen:[], artifactChoices:[], artifactLevels:{}, artifactUpgradesChosen:0, enemiesKilled:0, elitesKilled:0, bossesKilled:0, damageDealt:0, attackDamage:0, damageTaken:0, shieldAbsorbed:0, damageBlockedBySkills:0, healingDone:0, skillCasts:{}, skillDamage:{}, artifactTriggers:{}, statusDamage:{ burn:0, poison:0 }, playerAttacks:0, criticalHits:0, longestUpgradeGapMs:0, lastUpgradeAt:0, finalSkills:[], finalArtifacts:[], bossFightStartedAt:null, bossFightDurationMs:null, finalBossFightStartedAt:null, finalBossFightDurationMs:null, midBossesKilled:0, midBossFightStartedAt:null, midBossFightDurationMs:null, restChoice:null, restHealing:0, restSkillChosen:null, enemyKillsByType:{}, buildTags:[], midBossReachedLevel:null, restReachedLevel:null, deathStage:null, finalHp:null, professionId:null, professionMechanicTriggers:0, professionBonusDamage:0 });

export const getBuildTags = (p) => { const ids=p.skills.map(s=>s.id), arts=p.artifacts.map(artifactIdOf), tags=[]; if(ids.includes('fireball')||arts.includes('flame_heart')) tags.push('火焰流'); if(ids.includes('lightning')||arts.includes('thunder_orb')) tags.push('雷电流'); if(ids.includes('poison_cloud')||arts.includes('venom_sac')) tags.push('毒系流'); if(ids.includes('spinning_blade')||ids.includes('sword_wave')||arts.includes('wind_wheel')) tags.push('范围流'); if(ids.includes('healing')||arts.includes('blood_jade')) tags.push('生存流'); return tags; };

export default class RunStatsSystem {
  constructor(scene){ this.scene=scene; this.unsubs=[]; this.reset(); this.bind(); }
  reset(){ this.stats=blank(); this.stats.runStartedAt=this.scene.getGameplayTime?.() ?? this.scene.time.now; this.stats.lastUpgradeAt=0; this.pausedDurationMs=0; this.locked=false; }
  destroy(){ this.unsubs.forEach(o=>o()); this.unsubs=[]; }
  bind(){ const b=(e,fn)=>this.unsubs.push(this.scene.eventBus.on(e,fn));
    b(CombatEvents.PLAYER_ATTACK,()=>{ this.stats.playerAttacks+=1; });
    b(CombatEvents.PLAYER_CRIT,()=>{ this.stats.criticalHits+=1; });
    b(CombatEvents.ENEMY_HIT,p=>this.recordDamage(p));
    b(CombatEvents.PROFESSION_CHOSEN,p=>this.setProfession(p.professionId));
    b(CombatEvents.PLAYER_DAMAGED,p=>{ this.stats.damageTaken+=(p.hpDamage ?? p.damage ?? 0); this.stats.shieldAbsorbed+=(p.shieldAbsorbed||0); this.stats.damageBlockedBySkills+=(p.skillBlocked||0); });
    b(CombatEvents.PLAYER_HEALED,p=>{ this.stats.healingDone+=(p.amount||0); });
    b(CombatEvents.SKILL_CAST,p=>{ const id=p.skill?.id||p.skillId; this.stats.skillCasts[id]=(this.stats.skillCasts[id]||0)+1; });
    b(CombatEvents.ARTIFACT_TRIGGERED,p=>{ const id=p.artifact?.id||p.artifactId; this.stats.artifactTriggers[id]=(this.stats.artifactTriggers[id]||0)+1; });
    b(CombatEvents.ENEMY_KILLED,p=>{ const id=p.enemy?.enemyId||'unknown'; this.stats.enemyKillsByType[id]=(this.stats.enemyKillsByType[id]||0)+1; if(p.enemy?.isMidBoss){this.stats.midBossesKilled+=1; this.stats.bossesKilled+=1;} else if(p.enemy?.isBoss)this.stats.bossesKilled+=1; else if(p.enemy?.isElite)this.stats.elitesKilled+=1; else this.stats.enemiesKilled+=1; });
    b(CombatEvents.UPGRADE_CHOSEN,p=>this.recordUpgrade(p));
    b(CombatEvents.STARTING_SKILL_CHOSEN,p=>this.recordStartingSkill(p));
    b(CombatEvents.ARTIFACT_CHOSEN,p=>this.recordArtifact(p));
    b(CombatEvents.BOSS_SPAWNED,p=>{ this.stats.bossFightStartedAt=this.activeMs(); if(p.bossType==='mid'){ this.stats.midBossFightStartedAt=this.activeMs(); this.stats.midBossReachedLevel=this.scene.playerData.level; } if(p.bossType==='final')this.stats.finalBossFightStartedAt=this.activeMs(); });
    b(CombatEvents.BOSS_KILLED,p=>{ if(this.stats.bossFightStartedAt!=null)this.stats.bossFightDurationMs=this.activeMs()-this.stats.bossFightStartedAt; if(p.bossType==='mid'&&this.stats.midBossFightStartedAt!=null)this.stats.midBossFightDurationMs=this.activeMs()-this.stats.midBossFightStartedAt; if(p.bossType==='final'&&this.stats.finalBossFightStartedAt!=null)this.stats.finalBossFightDurationMs=this.activeMs()-this.stats.finalBossFightStartedAt; });
    b(CombatEvents.REST_REACHED,()=>{ this.stats.restReachedLevel=this.scene.playerData.level; });
    b(CombatEvents.REST_CHOSEN,p=>{ this.stats.restChoice=p.choice||this.stats.restChoice; this.stats.restHealing+=p.healing||0; if(p.skillId)this.stats.restSkillChosen=p.skillId; });
    b(CombatEvents.RUN_ENDED,p=>{ if(!p?.won) this.stats.deathStage=this.scene.stageSystem?.phase()?.name||this.scene.runState; this.lock(); }); }
  startMidBossFight(){ if(this.stats.midBossFightStartedAt==null)this.stats.midBossFightStartedAt=this.activeMs(); }
  endMidBossFight(){ if(this.stats.midBossFightStartedAt!=null)this.stats.midBossFightDurationMs=this.activeMs()-this.stats.midBossFightStartedAt; }
  now(){ return this.scene.getGameplayTime?.() ?? this.scene.time.now; }
  addPausedDuration(ms){ this.pausedDurationMs+=Math.max(0,ms||0); }
  activeMs(){ return (this.locked?this.stats.activePlayTimeMs:Math.max(0,this.now()-this.stats.runStartedAt-this.pausedDurationMs)); }
  recordDamage(p){ const d=p.damage||0; this.stats.professionBonusDamage+=p.professionBonusDamage||0; if(p.source==='profession') this.stats.professionBonusDamage+=d; this.stats.damageDealt+=d; if(p.source==='attack') this.stats.attackDamage+=d; if(p.source==='skill'&&p.skillId) this.stats.skillDamage[p.skillId]=(this.stats.skillDamage[p.skillId]||0)+d; if(p.source==='burn'||p.source==='burn_burst') this.stats.statusDamage.burn+=d; if(p.source==='poison') this.stats.statusDamage.poison+=d; }
  setProfession(id){ this.stats.professionId=id; }
  recordProfessionTrigger(){ this.stats.professionMechanicTriggers+=1; }
  recordStartingSkill(p){ const t=this.activeMs(); if(!this.stats.firstSkillObtainedAt)this.stats.firstSkillObtainedAt=t; this.stats.upgradesChosen.push(`start_${p.skillId}`); }
  recordUpgrade(p){ const t=this.activeMs(); this.stats.levelsGained+=1; this.stats.upgradesChosen.push(p.optionId); this.stats.longestUpgradeGapMs=Math.max(this.stats.longestUpgradeGapMs,t-this.stats.lastUpgradeAt); this.stats.lastUpgradeAt=t; if((p.type==='newSkill'||p.type==='startingSkill')&&!this.stats.firstSkillObtainedAt)this.stats.firstSkillObtainedAt=t; }
  recordArtifact(p){ const t=this.activeMs(); this.stats.artifactChoices.push(p.artifactId||p.option?.id); if(!this.stats.firstArtifactObtainedAt)this.stats.firstArtifactObtainedAt=t; this.stats.artifactLevels={ ...(this.scene.playerData.artifactLevels||{}) }; }
  lock(){ this.stats.runEndedAt=this.now(); this.stats.finalHp=this.scene.playerData.hp; this.stats.activePlayTimeMs=this.activeMs(); this.stats.finalSkills=this.scene.playerData.skills.map(s=>({ ...s, name:SKILLS[s.id]?.name||s.id })); this.stats.artifactLevels={ ...(this.scene.playerData.artifactLevels||{}) }; this.stats.finalArtifacts=this.scene.playerData.artifacts.map(a=>{ const id=artifactIdOf(a); const level=artifactLevelOf(a); return { id, level, name:ARTIFACTS[id]?.name||id, category:ARTIFACTS[id]?.category||'-' }; }); this.stats.buildTags=getBuildTags(this.scene.playerData); this.locked=true; }
  snapshot(){ const active=this.activeMs(); return { ...this.stats, professionName:PROFESSIONS[this.stats.professionId]?.name||this.stats.professionId||'-', activePlayTimeMs:active, msSinceLastUpgrade:active-this.stats.lastUpgradeAt, buildTags:getBuildTags(this.scene.playerData) }; }
}
