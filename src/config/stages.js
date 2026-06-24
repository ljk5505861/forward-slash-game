export const STAGES = [{
  id:'stage_1', name:'训练场 v0.6', worldWidth:50000,
  phases:[
    { id:'early', name:'阶段1：基础战斗' },
    { id:'boss1', name:'阶段2：狂暴巨兽', boss:{ enemyId:'berserker_boss', x:4850 } },
    { id:'mid', name:'阶段3：第二段普通波次' },
    { id:'boss2', name:'阶段4：铁甲暴君', boss:{ enemyId:'mid_boss', x:9700 } },
    { id:'postBoss2Shop', name:'阶段5：唯一商店前清场' },
    { id:'late', name:'阶段6：第三段普通波次' },
    { id:'boss3', name:'阶段7：最终 Boss', boss:{ enemyId:'boss', x:12180 } },
  ],
}];
