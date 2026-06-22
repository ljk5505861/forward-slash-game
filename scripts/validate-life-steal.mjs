import { applyLifeStealFromDamage } from '../src/systems/LifeSteal.js';

const events=[];
const scene={
  playerData:{ hp:50, maxHp:100, lifeSteal:0.25 },
  hud:{ update(){ scene.hudUpdated=true; } },
  playerHealthBar:{ update(){ scene.healthBarUpdated=true; } },
  eventBus:{ emit:(event,payload)=>events.push({event,payload}) },
  healPlayer(amount,source){ const value=Math.max(0,Math.floor(amount||0)); if(value<=0||this.playerData.hp>=this.playerData.maxHp) return 0; const before=this.playerData.hp; this.playerData.hp=Math.min(this.playerData.maxHp,this.playerData.hp+value); const actual=this.playerData.hp-before; if(actual>0){ this.eventBus.emit('PLAYER_HEALED',{amount:actual,source}); this.hud.update(); this.playerHealthBar.update(); } return actual; }
};

applyLifeStealFromDamage(scene,20,{source:'attack',allowLifeSteal:true});
if(scene.playerData.hp!==55) throw new Error(`attack should heal from actual damage, got ${scene.playerData.hp}`);
if(!events.some(e=>e.event==='PLAYER_HEALED'&&e.payload.source==='lifeSteal'&&e.payload.amount===5)) throw new Error('life steal should emit PLAYER_HEALED');
if(!scene.hudUpdated||!scene.healthBarUpdated) throw new Error('life steal should update HUD and player health bar');

scene.playerData.hp=90;
applyLifeStealFromDamage(scene,10,{source:'skill'});
if(scene.playerData.hp!==92) throw new Error('skill should heal from reduced actual damage only');

scene.playerData.hp=92;
applyLifeStealFromDamage(scene,20,{source:'burn',allowLifeSteal:false});
if(scene.playerData.hp!==92) throw new Error('DOT/burn should not trigger life steal');
applyLifeStealFromDamage(scene,20,{source:'burn_burst'});
if(scene.playerData.hp!==92) throw new Error('death explosion should not trigger life steal by default');

scene.playerData.hp=99;
applyLifeStealFromDamage(scene,20,{source:'attack',allowLifeSteal:true});
if(scene.playerData.hp!==100) throw new Error('life steal must not exceed maxHp');
scene.playerData.hp=100;
applyLifeStealFromDamage(scene,20,{source:'attack',allowLifeSteal:true});
if(scene.playerData.hp!==100) throw new Error('full hp should not overflow');

console.log('[validate:life-steal] PASS attack/skill life steal heals from actual damage, DOT/death burst blocked, maxHp capped');
