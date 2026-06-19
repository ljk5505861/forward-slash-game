import Phaser from 'phaser';
import { ring, line } from './common.js';

const pickTarget = (s) => s.targeting.all().sort((a,b)=>(b.isBoss?3:b.isElite?2:1)-(a.isBoss?3:a.isElite?2:1)||b.hp-a.hp)[0];

export default { cast(sys,cfg,data,level,ctx){ const s=sys.scene; let target=pickTarget(s); if(!target)return; const sword=s.add.rectangle(target.x,target.y-210,26,150,cfg.color,0.85).setDepth(155); const active={ nextAt:s.getGameplayTime()+data.delayMs, endAt:s.getGameplayTime()+data.delayMs+20, done:false, tick(){ if(this.done) return; this.done=true; if(!s.targeting.valid(target)) target=pickTarget(s); if(!target){ this.onEnd(); return; } sword.setPosition(target.x,target.y-140); line(s,target.x,target.y-230,target.x,target.y,cfg.color,10); sys.hit(target,sys.damageValue(data.damage,ctx),cfg,level); if(data.radius){ ring(s,target.x,target.y,data.radius,cfg.color); s.targeting.all().filter(e=>e!==target&&Phaser.Math.Distance.Between(e.x,e.y,target.x,target.y)<=data.radius).forEach(e=>sys.hit(e,data.damage*0.55,cfg,level)); } this.onEnd(); }, onEnd(){ if(this.ended) return; this.ended=true; sword.destroy(); } }; sys.active.push(active); }};
