import Phaser from 'phaser';
export const validEnemies = (s) => s.targeting.all();
export const dist = Phaser.Math.Distance.Between;
export function ring(s,x,y,r,c){ const o=s.add.circle(x,y,r,c,0.16).setStrokeStyle(4,c,0.9).setDepth(150); s.tweens.add({targets:o,alpha:0,scale:1.15,duration:360,onComplete:()=>o.destroy()}); return o; }
export function line(s,x1,y1,x2,y2,c,w=6){ const g=s.add.graphics().setDepth(155); g.lineStyle(w,c,1).lineBetween(x1,y1,x2,y2); s.tweens.add({targets:g,alpha:0,duration:220,onComplete:()=>g.destroy()}); return g; }
export function projectile(s,x1,y1,x2,y2,c,duration=220){ const o=s.add.circle(x1,y1,16,c,1).setDepth(155); s.tweens.add({targets:o,x:x2,y:y2,duration,onComplete:()=>o.destroy()}); return o; }
