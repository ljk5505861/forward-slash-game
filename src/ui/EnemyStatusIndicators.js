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
  const icon=scene.add.rectangle(0,0,0,0,0x000000,0).setVisible(false).setAlpha(0).setStrokeStyle(0,0x000000,0);
  const text=scene.add.text(0,0,'',{fontFamily:'Arial',fontSize:'12px',fontStyle:'normal',color:'#ffb36b'}).setOrigin(0,0.5);
  container.add([icon,text]); container.setVisible(false);
  enemy.statusIndicatorContainer=container;
  enemy.burnIndicator={ IconPlaceholder:icon, StackText:text };
  updateEnemyStatusIndicators(enemy,0);
}
export function updateEnemyStatusIndicators(enemy,burnStacks=0){
  if(!enemy?.active||!enemy.statusIndicatorContainer) return;
  const stacks=Math.max(0,Math.floor(Number(burnStacks)||0));
  const point=statusRowPosition(enemy);
  enemy.statusIndicatorContainer.setPosition(point.x,point.y);
  enemy.burnIndicator.IconPlaceholder.setVisible(false).setAlpha(0).setStrokeStyle(0,0x000000,0);
  enemy.burnIndicator.StackText.setPosition(0*STATUS_ITEM_WIDTH,0).setText(stacks>0?`灼${stacks}`:'');
  enemy.statusIndicatorContainer.setVisible(stacks>0);
}
export function destroyEnemyStatusIndicators(enemy){ enemy?.statusIndicatorContainer?.destroy?.(); enemy.statusIndicatorContainer=null; enemy.burnIndicator=null; }
