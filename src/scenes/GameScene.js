import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';
import { BALANCE, createPlayerRuntime } from '../config/balance.js';
import { ARTIFACTS } from '../config/artifacts.js';
import EventBus from '../core/EventBus.js';
import { CombatEvents, RunStates, ACTIVE_STATES } from '../core/CombatEvents.js';
import createPlayer from '../entities/createPlayer.js';
import TargetingSystem from '../systems/TargetingSystem.js';
import MovementSystem from '../systems/MovementSystem.js';
import CombatSystem from '../systems/CombatSystem.js';
import SkillSystem from '../systems/SkillSystem.js';
import ArtifactSystem from '../systems/ArtifactSystem.js';
import UpgradeSystem from '../systems/UpgradeSystem.js';
import StageSystem from '../systems/StageSystem.js';
import StatusEffectSystem from '../systems/StatusEffectSystem.js';
import Hud from '../ui/Hud.js';
import UpgradePanel from '../ui/UpgradePanel.js';
import ResultPanel from '../ui/ResultPanel.js';
import SkillBar from '../ui/SkillBar.js';
import RunStatsSystem from '../systems/RunStatsSystem.js';
import PlaytestPanel from '../ui/PlaytestPanel.js';
import { GAME_VERSION_LABEL } from '../config/version.js';

const updateDebugStatus = (message) => window.updateGameDebugStatus?.(message);

export default class GameScene extends Phaser.Scene {
  constructor(){ super('GameScene'); this.initStage='尚未开始'; }
  create(){ try { this.balance=BALANCE; this.debugMode=new URLSearchParams(window.location.search).get('debug')==='1'; this.runState=RunStates.RUNNING; this.playerData=createPlayerRuntime(); this.enemies=[]; this.killCount=0; this.currentTarget=null; this.pendingArtifactReward=null; this.modalPausedAt=null; this.eventBus=new EventBus(); this.configureWorld(); this.createBackground(); this.createGround(); this.player=createPlayer(this,BALANCE.player,BALANCE.groundTopY); this.physics.add.collider(this.player,this.physicsGround); this.cameras.main.startFollow(this.player,false,1,0,DESIGN_WIDTH*0.2,0); this.targeting=new TargetingSystem(this); this.movementSystem=new MovementSystem(this); this.combatSystem=new CombatSystem(this); this.skillSystem=new SkillSystem(this); this.artifactSystem=new ArtifactSystem(this); this.statusEffects=new StatusEffectSystem(this); this.runStats=new RunStatsSystem(this); this.upgradeSystem=new UpgradeSystem(this); this.stageSystem=new StageSystem(this); this.hud=new Hud(this); this.skillBar=new SkillBar(this); this.upgradePanel=new UpgradePanel(this); this.rewardPanel=new UpgradePanel(this); this.resultPanel=new ResultPanel(this); if(this.debugMode) this.playtestPanel=new PlaytestPanel(this); this.createTitle(); this.createRestartButton(); this.createDebugOverlay(); this.stageSystem.start(); this.artifactSystem.load(); this.hud.setStatus('自动战斗开始'); this.hud.update(); this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.cleanupRun()); updateDebugStatus(GAME_VERSION_LABEL); } catch(e){ this.showInitError(e); throw e; } }
  update(time){ if(!this.isGameplayPaused()){ this.movementSystem.update(time); this.combatSystem.update(time); this.skillSystem.update(time); this.artifactSystem.update(time); this.statusEffects.update(time); this.stageSystem.update(time); } else this.player?.body?.setVelocityX(0); this.hud?.update(); this.skillBar?.update(); this.playtestPanel?.update(); this.updateDebugOverlay(); }
  isGameplayPaused(){ return !ACTIVE_STATES.has(this.runState)||this.upgradePanel?.isOpen||this.rewardPanel?.isOpen||this.resultPanel?.isOpen||this.playtestPanel?.isOpen; }
  getGameplayTime(){ return this.modalPausedAt ?? this.time.now; }
  beginGameplayPause(){ if(this.modalPausedAt!==null) return; this.modalPausedAt=this.time.now; }
  canEndGameplayPause(){ return !this.rewardPanel?.isOpen&&!this.upgradePanel?.isOpen&&!this.resultPanel?.isOpen&&!this.playtestPanel?.isOpen&&!this.pendingArtifactReward&&!(this.upgradeSystem?.pending>0); }
  endGameplayPause(){ if(this.modalPausedAt===null||!this.canEndGameplayPause()) return; if([RunStates.VICTORY,RunStates.DEFEAT].includes(this.runState)) return; const pausedAt=this.modalPausedAt; const pausedDuration=Math.max(0,this.time.now-pausedAt); this.modalPausedAt=null; if(pausedDuration<=0) return; this.combatSystem?.shiftTimers(pausedDuration,pausedAt); this.skillSystem?.shiftTimers(pausedDuration,pausedAt); this.artifactSystem?.shiftTimers(pausedDuration,pausedAt); this.statusEffects?.shiftTimers(pausedDuration,pausedAt); this.runStats?.addPausedDuration(pausedDuration); }
  configureWorld(){ const width=6500; this.physics.world.setBounds(0,0,width,DESIGN_HEIGHT); this.cameras.main.setBounds(0,0,width,DESIGN_HEIGHT); }
  createBackground(){ this.cameras.main.setBackgroundColor('#202638'); for(let x=300;x<6500;x+=420){ this.add.rectangle(x,BALANCE.groundTopY-92,12,185,0x2f3547,0.75).setDepth(5); } }
  createGround(){ this.add.rectangle(3250,BALANCE.groundTopY+BALANCE.groundHeight/2,6500,BALANCE.groundHeight,0x253522,1).setDepth(10); this.physicsGround=this.add.rectangle(3250,BALANCE.groundTopY+BALANCE.groundHeight/2,6500,BALANCE.groundHeight,0x000000,0); this.physics.add.existing(this.physicsGround,true); }
  createTitle(){ this.add.text(DESIGN_WIDTH/2,34,'自动战斗肉鸽框架 Demo',{fontFamily:'Arial',fontSize:'32px',color:'#e9efff',stroke:'#000',strokeThickness:5}).setOrigin(0.5,0).setScrollFactor(0).setDepth(1000); }
  createRestartButton(){ this.restartButton=this.add.text(DESIGN_WIDTH-22,28,'重新开始',{fontFamily:'Arial',fontSize:'24px',color:'#fff',backgroundColor:'#333',padding:{left:12,right:12,top:8,bottom:8}}).setOrigin(1,0).setScrollFactor(0).setInteractive({useHandCursor:true}).setDepth(2000); this.restartButton.on('pointerdown',()=>this.scene.restart()); }
  queueArtifactReward(enemy){ if(this.pendingArtifactReward||[RunStates.VICTORY,RunStates.DEFEAT].includes(this.runState)) return; this.pendingArtifactReward={ enemyId:enemy.id, enemyName:enemy.name }; }
  showArtifactReward(){ if(!this.pendingArtifactReward||[RunStates.VICTORY,RunStates.DEFEAT].includes(this.runState)||this.rewardPanel.isOpen) return; this.beginGameplayPause(); this.runState=RunStates.REWARD; const options=Object.values(ARTIFACTS).sort(()=>Math.random()-0.5).map(a=>({ id:a.id, title:`${a.name}\n${a.description}`, artifactId:a.id })).slice(0,3); this.rewardPanel.show('法宝奖励三选一', options, (o)=>this.claimArtifactReward(o)); }
  claimArtifactReward(option){ if(!this.pendingArtifactReward) return; this.artifactSystem.add(option.artifactId); this.eventBus.emit(CombatEvents.ARTIFACT_CHOSEN,{ artifactId:option.artifactId, option }); this.pendingArtifactReward=null; this.rewardPanel.hide(); this.resumeModalFlow(); }
  resumeModalFlow(){ if([RunStates.VICTORY,RunStates.DEFEAT].includes(this.runState)) return; if(this.resultPanel?.isOpen) return; if(this.rewardPanel?.isOpen) return; if(this.upgradePanel?.isOpen) return; if(this.pendingArtifactReward){ this.showArtifactReward(); return; } if(this.upgradeSystem?.pending>0){ this.upgradeSystem.maybeShow(); return; } this.runState=this.stageSystem?.bossSpawned&&this.enemies?.some(e=>e.isBoss&&!e.isDefeated)?RunStates.BOSS:RunStates.RUNNING; this.endGameplayPause(); }
  finishRun(won){ if([RunStates.VICTORY,RunStates.DEFEAT].includes(this.runState)||this.resultPanel?.isOpen) return; this.beginGameplayPause(); this.runState=won?RunStates.VICTORY:RunStates.DEFEAT; this.player?.body?.setVelocityX(0); this.combatSystem?.reset(); this.skillSystem?.reset(); this.statusEffects?.reset(); this.pendingArtifactReward=null; this.upgradeSystem?.reset(); this.upgradePanel?.hide(); this.rewardPanel?.hide(); this.eventBus.emit(CombatEvents.RUN_ENDED,{ won }); this.resultPanel.show(won,()=>this.scene.restart()); }
  floatText(x,y,text,color){ const t=this.add.text(x,y,text,{fontFamily:'Arial',fontSize:'24px',color,stroke:'#000',strokeThickness:4}).setOrigin(0.5).setDepth(2500); this.tweens.add({targets:t,y:y-42,alpha:0,duration:650,onComplete:()=>t.destroy()}); }
  createDebugOverlay(){ if(!this.debugMode) return; this.debugOverlay=this.add.text(18,260,'',{fontFamily:'monospace',fontSize:'18px',color:'#00ff66',backgroundColor:'rgba(0,0,0,0.72)',padding:{left:10,right:10,top:8,bottom:8}}).setScrollFactor(0).setDepth(2500); }
  updateDebugOverlay(){ if(!this.debugOverlay) return; const cds=[...this.skillSystem.cooldowns.entries()].map(([id,t])=>`${id}:${Math.max(0,Math.ceil((t-this.getGameplayTime())/1000))}`).join(' '); this.debugOverlay.setText([`state:${this.runState}`,`playerX:${Math.round(this.player.x)}`,`target:${this.currentTarget?.name||'-'}`,`enemies:${this.enemies.length}`,`skills:${cds||'-'}`,`stage:${this.stageSystem.stage.name}`]); }
  cleanupRun(){ this.time.removeAllEvents(); this.tweens.killAll(); this.pendingArtifactReward=null; this.modalPausedAt=null; this.upgradeSystem?.reset(); this.artifactSystem?.cleanup(); this.statusEffects?.reset(); this.runStats?.destroy(); this.eventBus?.destroy(); this.upgradePanel?.hide(); this.rewardPanel?.hide(); this.resultPanel?.hide(); this.enemies?.forEach(e=>{ [e.hpBarBg,e.hpBar,e.nameText,e].forEach(o=>o?.destroy()); }); this.enemies=[]; this.skillBar?.destroy(); this.hud?.destroy(); this.debugOverlay?.destroy(); this.playtestPanel?.destroy(); }
  showInitError(error){ this.add.text(24,220,`初始化失败：${this.initStage}\n${error.name||'Error'}: ${error.message||String(error)}`,{fontFamily:'Arial',fontSize:'28px',color:'#fff',backgroundColor:'rgba(190,0,0,0.92)',padding:{left:18,right:18,top:14,bottom:14},wordWrap:{width:DESIGN_WIDTH-48}}).setOrigin(0,0).setScrollFactor(0).setDepth(10000); }
}
