import { ACTIVE_STATES } from '../core/CombatEvents.js';
import { getWeapon } from '../config/weapons.js';
export default class MovementSystem { constructor(scene){ this.scene=scene; }
  update(){ const s=this.scene; if(!ACTIVE_STATES.has(s.runState)||!s.player?.body){ s.player?.body?.setVelocityX(0); return; } const target=s.targeting.nearestAhead(s.balance.player.encounterDistance); s.currentTarget=target; const weapon=getWeapon(s.playerData.weaponId); const desiredDistance=Math.max(72, weapon.attackRange*0.82); if(target){ const d=target.x-s.player.x; if(d>weapon.attackRange) s.player.body.setVelocityX(s.balance.player.speedX); else if(d<desiredDistance) s.player.body.setVelocityX(-s.balance.player.pressSpeedX); else s.player.body.setVelocityX(s.balance.player.pressSpeedX); } else s.player.body.setVelocityX(s.balance.player.speedX); }
}
