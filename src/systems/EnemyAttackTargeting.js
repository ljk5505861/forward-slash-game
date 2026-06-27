import CombatSystem from './CombatSystem.js';

const BEHAVIOR_ATTACKERS = new Set([
  'charger',
  'bomber',
  'healer',
  'midBoss',
  'berserkerBoss'
]);

const distanceBetween=(enemy,target)=>Math.hypot(
  (enemy?.x||0)-(target?.x||0),
  (enemy?.y||0)-(target?.y||0)
);

export function installEnemyAttackTargeting(){
  if(CombatSystem.prototype.getAttackableTargets?.__poisonKingTargeting) return;

  const getAttackableTargets=function(
    enemy,
    {includePlayer=true,includePoisonKing=true}={}
  ){
    const targets=[];
    if(includePlayer&&this.scene.playerData.hp>0){
      const system=this;
      targets.push({
        type:'player',
        get x(){ return system.scene.player.x; },
        get y(){ return system.scene.player.y; },
        isAlive:()=>system.scene.playerData.hp>0,
        takeDamage:(amount,meta)=>system.damagePlayer(enemy,amount,meta)
      });
    }

    const king=this.scene.skillSystem?.passiveState?.poisonKing;
    if(includePoisonKing&&king?.isAlive?.()){
      targets.push({
        type:'poisonKing',
        get x(){ return king.getPosition().x; },
        get y(){ return king.getPosition().y; },
        isAlive:()=>king.isAlive(),
        takeDamage:(amount,meta)=>king.takeDamage(
          amount,
          meta?.source||'enemy'
        )
      });
    }
    return targets;
  };
  getAttackableTargets.__poisonKingTargeting=true;
  CombatSystem.prototype.getAttackableTargets=getAttackableTargets;

  CombatSystem.prototype.chooseEnemyAttackTarget=function(
    enemy,
    range=Number.POSITIVE_INFINITY,
    {
      requireInRange=false,
      includePlayer=true,
      includePoisonKing=true
    }={}
  ){
    let targets=this.getAttackableTargets(enemy,{
      includePlayer,
      includePoisonKing
    }).filter(target=>target.isAlive());
    if(requireInRange){
      targets=targets.filter(target=>distanceBetween(enemy,target)<=range);
    }
    targets.sort(
      (left,right)=>distanceBetween(enemy,left)-distanceBetween(enemy,right)
    );
    return targets[0]||null;
  };

  CombatSystem.prototype.damageAttackTargetsInArea=function(
    enemy,
    x,
    y,
    radius,
    rawDamage,
    meta={}
  ){
    let hits=0;
    this.getAttackableTargets(enemy).forEach(target=>{
      if(!target.isAlive()) return;
      if(Math.hypot(target.x-x,target.y-y)>radius) return;
      target.takeDamage(rawDamage,{
        ...meta,
        dodgeable:target.type==='player'&&meta.dodgeable!==false
      });
      hits+=1;
    });
    return hits;
  };

  CombatSystem.prototype.damageEnemySummon=function(target,rawDamage,meta={}){
    return target?.takeDamage?.(rawDamage,meta)||0;
  };

  CombatSystem.prototype.updateEnemyAttack=function(enemy,time){
    const scene=this.scene;
    if(!scene.targeting.valid(enemy)||enemy.isKnockbackActive) return;
    if(BEHAVIOR_ATTACKERS.has(enemy.behavior)) return;
    if(
      enemy.isBoss
      && !enemy.enraged
      && enemy.hp<=enemy.maxHp/2
    ){
      enemy.enraged=true;
      enemy.attackIntervalMs=enemy.enragedAttackIntervalMs;
      scene.hud?.setStatus('Boss 半血狂暴：攻击速度提升！');
    }
    const target=this.chooseEnemyAttackTarget(
      enemy,
      enemy.attackRange,
      {requireInRange:true}
    );
    if(!target||time<enemy.nextAttackAt) return;
    enemy.nextAttackAt=time+enemy.attackIntervalMs;
    target.takeDamage(enemy.damage,{
      source:'enemyMelee',
      attackType:'melee',
      dodgeable:target.type==='player'
    });
  };
}

installEnemyAttackTargeting();
