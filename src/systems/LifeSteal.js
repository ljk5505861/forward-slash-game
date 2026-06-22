export function applyLifeStealFromDamage(scene, actualDamage, meta={}){
  const source=meta.source;
  const allowed=meta.allowLifeSteal ?? (source==='attack'||source==='skill');
  if(!allowed||actualDamage<=0) return 0;
  const rate=scene.playerData?.lifeSteal||0;
  if(rate<=0||scene.playerData.hp>=scene.playerData.maxHp) return 0;
  const heal=Math.floor(actualDamage*rate);
  if(heal<=0) return 0;
  return scene.healPlayer?.(heal,'lifeSteal')||0;
}
