export const STATUS_ITEM_WIDTH=18;

export const ENEMY_UI_LAYOUT=Object.freeze({
  hpBarOffsetY:30,
  nameOffsetY:70,
  levelOffsetY:50,
  statusRowOffsetY:15,
});

function statusRowPosition(enemy){
  const top=enemy.y-enemy.height/2;
  return { x:enemy.x-enemy.width/2, y:top-ENEMY_UI_LAYOUT.statusRowOffsetY };
}

export function createEnemyStatusIndicators(scene, enemy){
  const point=statusRowPosition(enemy);
  const container=scene.add.container(point.x,point.y).setDepth(23);
  const burnIcon=scene.add.rectangle(0,0,0,0,0x000000,0)
    .setVisible(false)
    .setAlpha(0)
    .setStrokeStyle(0,0x000000,0);
  const burnText=scene.add.text(0,0,'',{
    fontFamily:'Arial',
    fontSize:'16px',
    fontStyle:'bold',
    color:'#ff9a3d'
  }).setOrigin(0,0.5);
  const poisonText=scene.add.text(STATUS_ITEM_WIDTH,0,'',{
    fontFamily:'Arial',
    fontSize:'16px',
    fontStyle:'bold',
    color:'#63ff72',
    stroke:'#073d17',
    strokeThickness:2
  }).setOrigin(0,0.5);
  container.add([burnIcon,burnText,poisonText]);
  container.setVisible(false);
  enemy.statusIndicatorContainer=container;
  enemy.burnIndicator={ IconPlaceholder:burnIcon, StackText:burnText };
  enemy.poisonIndicator={ StackText:poisonText };
  updateEnemyStatusIndicators(enemy,0,0);
}

export function updateEnemyStatusIndicators(
  enemy,
  burnStacks=0,
  poisonStacks=0
){
  if(!enemy?.active||!enemy.statusIndicatorContainer) return;
  const burn=Math.max(0,Math.floor(Number(burnStacks)||0));
  const poison=Math.max(0,Math.floor(Number(poisonStacks)||0));
  const point=statusRowPosition(enemy);
  enemy.statusIndicatorContainer.setPosition(point.x,point.y);
  enemy.burnIndicator.IconPlaceholder
    .setVisible(false)
    .setAlpha(0)
    .setStrokeStyle(0,0x000000,0);
  enemy.burnIndicator.StackText
    .setPosition(0,0)
    .setText(burn>0?String(burn):'');
  enemy.poisonIndicator.StackText
    .setPosition(STATUS_ITEM_WIDTH,0)
    .setText(poison>0?String(poison):'');
  enemy.statusIndicatorContainer.setVisible(burn>0||poison>0);
}

export function destroyEnemyStatusIndicators(enemy){
  enemy?.statusIndicatorContainer?.destroy?.();
  enemy.statusIndicatorContainer=null;
  enemy.burnIndicator=null;
  enemy.poisonIndicator=null;
}
