export const STAGES = [{
  id:'stage_1', name:'训练场', worldWidth:6500,
  waves: Array.from({ length: 8 }, (_, i) => ({ enemyId:'grunt', x:760 + i * 390 })),
  elite: { enemyId:'elite', x:4050 },
  boss: { enemyId:'boss', x:5050 },
}];
