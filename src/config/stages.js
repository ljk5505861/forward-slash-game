export const STAGES = [{
  id:'stage_1', name:'训练场 v0.5', worldWidth:7600,
  phases:[
    { id:'early', name:'阶段1：基础战斗', waves:[['grunt',760],['grunt',1090],['charger',1420],['grunt',1750],['elite',2180]] },
    { id:'mixed', name:'阶段2：混合敌人', waves:[['armored_guard',2700],['bomber',2940],['grunt',3180],['healer',3420],['armored_guard',3660],['bomber',3900],['elite',4250]] },
    { id:'midBoss', name:'阶段3：铁甲暴君', boss:{ enemyId:'mid_boss', x:4850 } },
    { id:'late', name:'阶段4：高密度战斗', waves:[['charger',5450],['grunt',5600],['bomber',5800],['armored_guard',6020],['healer',6240],['charger',6460],['bomber',6680],['elite',6960],['armored_guard',7160],['grunt',7340]] },
    { id:'rest', name:'阶段5：最终整备' },
    { id:'finalBoss', name:'阶段6：最终 Boss', boss:{ enemyId:'boss', x:7420 } },
  ],
}];
