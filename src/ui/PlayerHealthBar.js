const WIDTH=82;
const HEIGHT=9;
const DEPTH=1200;

export default class PlayerHealthBar {
  constructor(scene){
    this.scene=scene;
    this.bg=scene.add.rectangle(0,0,WIDTH,HEIGHT,0x120608,0.9).setOrigin(0.5).setDepth(DEPTH);
    this.fill=scene.add.rectangle(0,0,WIDTH,HEIGHT,0xe83f45,1).setOrigin(0,0.5).setDepth(DEPTH+1);
    this.outline=scene.add.rectangle(0,0,WIDTH+4,HEIGHT+4,0xffffff,0).setOrigin(0.5).setStrokeStyle(2,0xffd6d6,0.75).setDepth(DEPTH+2);
    this.nodes=[this.bg,this.fill,this.outline];
    this.update();
  }
  update(){
    const player=this.scene.player;
    const p=this.scene.playerData;
    if(!player||!p){ this.setVisible(false); return; }
    const x=player.x;
    const y=player.y-(player.height||140)/2-26;
    const ratio=p.maxHp>0?Phaser.Math.Clamp(p.hp/p.maxHp,0,1):0;
    this.bg.setPosition(x,y);
    this.outline.setPosition(x,y);
    this.fill.setPosition(x-WIDTH/2,y).setDisplaySize(Math.round(WIDTH*ratio),HEIGHT);
    this.setVisible(p.hp>0 && player.active!==false);
  }
  setVisible(visible){ this.nodes.forEach(n=>n.setVisible(visible)); }
  destroy(){ this.nodes.forEach(n=>n?.destroy()); this.nodes=[]; }
}
