import { getWeapon } from '../config/weapons.js';

const getStopDistance = (scene, target, weapon) => {
  const playerHalf = (scene.player?.body?.width || scene.player?.width || 0) / 2;
  const enemyHalf = (target?.body?.width || target?.width || 0) / 2;
  return Math.max(weapon.attackRange * 0.72, playerHalf + enemyHalf + (scene.balance.player.stopBuffer || 10));
};

export default class MovementSystem {
  constructor(scene){ this.scene=scene; }
  update(){
    const s=this.scene;
    if(s.isGameplayPaused?.()||!s.player?.body){ s.player?.body?.setVelocityX(0); return; }
    const target=s.targeting.nearestAhead(s.balance.player.encounterDistance);
    s.currentTarget=target;
    const weapon=getWeapon(s.playerData.weaponId);
    if(target){
      const d=target.x-s.player.x;
      const stopDistance=getStopDistance(s,target,weapon);
      if(d<=stopDistance){
        s.player.body.setVelocityX(0);
        if(d<stopDistance-2) s.player.x=Math.max(0,target.x-stopDistance);
      } else {
        s.player.body.setVelocityX(d>weapon.attackRange ? s.balance.player.speedX : s.balance.player.pressSpeedX);
      }
    } else s.player.body.setVelocityX(s.balance.player.speedX);
  }
}
