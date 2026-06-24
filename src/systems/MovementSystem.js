import { getWeapon } from '../config/weapons.js';

const getStopDistance = (_scene, _target, weapon) => {
  return weapon.attackRange;
};

export default class MovementSystem {
  constructor(scene){ this.scene=scene; }
  clampPlayerToCameraRight(){
    const s=this.scene, camera=s.cameras?.main, body=s.player?.body;
    if(!camera||!s.player) return;
    const viewRight=camera.worldView?.right ?? ((camera.scrollX||0)+(camera.width||720));
    const cameraWidth=camera.worldView?.width ?? camera.width ?? 720;
    const worldWidth=s.stageSystem?.stage?.worldWidth ?? s.balance.stageWorldWidth;
    if(viewRight < worldWidth - 1) return;
    const half=(body?.width || s.player.width || 0)/2;
    const anchor=s.balance.camera?.playerScreenAnchorX ?? 0.5;
    const maxVisibleX=viewRight - Math.max(half + 8, cameraWidth * (1 - anchor) * 0.18);
    const maxX=Math.min(worldWidth - half - 8, maxVisibleX);
    if(s.player.x>maxX){ s.player.x=maxX; body?.setVelocityX?.(Math.min(0, body.velocity?.x || 0)); }
  }
  update(){
    const s=this.scene;
    if(s.isGameplayPaused?.()||!s.player?.body){ s.player?.body?.setVelocityX(0); return; }
    if(s.stageSystem?.shouldHoldPlayerForBossIntro?.()){ s.player.body.setVelocityX(0); this.clampPlayerToCameraRight(); return; }
    const target=s.targeting.nearestAhead(s.balance.player.encounterDistance);
    s.currentTarget=target;
    const weapon=getWeapon(s.playerData.weaponId);
    if(target){
      const d=target.x-s.player.x;
      const stopDistance=getStopDistance(s,target,weapon);
      if(d<=stopDistance){
        s.player.body.setVelocityX(0);
      } else {
        s.player.body.setVelocityX(d>weapon.attackRange ? s.balance.player.speedX : s.balance.player.pressSpeedX);
      }
    } else s.player.body.setVelocityX(s.balance.player.speedX);
    this.clampPlayerToCameraRight();
  }
}
