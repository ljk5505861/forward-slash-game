export function createEnemyStatusIndicators(scene, enemy){
  const container=scene.add.container(enemy.x-enemy.width/2-8, enemy.y-enemy.height/2-80).setDepth(23);
  const icon=scene.add.rectangle(0,0,0,0,0x000000,0).setVisible(false).setAlpha(0).setStrokeStyle(0,0x000000,0);
  const text=scene.add.text(0,0,'',{fontFamily:'Arial',fontSize:'18px',color:'#ff8a33',stroke:'#000',strokeThickness:4}).setOrigin(0,0.5);
  container.add([icon,text]); container.setVisible(false);
  enemy.statusIndicatorContainer=container;
  enemy.burnIndicator={ IconPlaceholder:icon, StackText:text };
  updateEnemyStatusIndicators(enemy, 0);
}
export function updateEnemyStatusIndicators(enemy, burnStacks=0){
  if(!enemy?.active||!enemy.statusIndicatorContainer) return;
  const stacks=Math.max(0, Math.floor(Number(burnStacks)||0));
  enemy.statusIndicatorContainer.setPosition(enemy.x-enemy.width/2-8, enemy.y-enemy.height/2-80);
  enemy.burnIndicator.IconPlaceholder.setVisible(false).setAlpha(0).setStrokeStyle(0,0x000000,0);
  enemy.burnIndicator.StackText.setText(stacks>0?String(stacks):'');
  enemy.statusIndicatorContainer.setVisible(stacks>0);
}
export function destroyEnemyStatusIndicators(enemy){ enemy?.statusIndicatorContainer?.destroy?.(); enemy.statusIndicatorContainer=null; enemy.burnIndicator=null; }
