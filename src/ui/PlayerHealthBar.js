const HEIGHT_RATIO=7/56;
const WIDTH_RATIO=1.25;
const MIN_WIDTH=24;
const MIN_HEIGHT=5;
const OUTLINE_PAD=3;
const DEPTH=1200;
const DEFAULT_PLAYER_WIDTH=45;
const DEFAULT_PLAYER_HEIGHT=78;
const clamp01=value=>Math.max(0,Math.min(1,value));

const basePlayerWidth = player => Math.max(1, player?.body?.width || player?.width || DEFAULT_PLAYER_WIDTH);
const basePlayerHeight = player => Math.max(1, player?.body?.height || player?.height || DEFAULT_PLAYER_HEIGHT);

export const playerHealthBarSize = player => {
  const width = Math.round(Math.max(MIN_WIDTH, basePlayerWidth(player) * WIDTH_RATIO));
  const height = Math.round(Math.max(MIN_HEIGHT, width * HEIGHT_RATIO));
  return { width, height, outlineWidth:width+OUTLINE_PAD*2, outlineHeight:height+OUTLINE_PAD*2 };
};
export const playerHealthBarY = player => player.y-basePlayerHeight(player)/2-10;

export default class PlayerHealthBar {
  constructor(scene){
    this.scene=scene;
    this.size=playerHealthBarSize(scene.player);
    const { width, height, outlineWidth, outlineHeight } = this.size;
    this.bg=scene.add.rectangle(0,0,width,height,0x120608,0.9).setOrigin(0.5).setDepth(DEPTH);
    this.fill=scene.add.rectangle(0,0,width,height,0xe83f45,1).setOrigin(0,0.5).setDepth(DEPTH+1);
    this.outline=scene.add.rectangle(0,0,outlineWidth,outlineHeight,0xffffff,0).setOrigin(0.5).setStrokeStyle(2,0xffd6d6,0.75).setDepth(DEPTH+2);
    this.nodes=[this.bg,this.fill,this.outline];
    this.update();
  }
  update(){
    const player=this.scene.player;
    const p=this.scene.playerData;
    if(!player||!p){ this.setVisible(false); return; }
    const { width, height, outlineWidth, outlineHeight } = this.size;
    const x=player.x;
    const y=playerHealthBarY(player);
    const ratio=p.maxHp>0?clamp01(p.hp/p.maxHp):0;
    this.bg.setPosition(x,y).setDisplaySize(width,height);
    this.outline.setPosition(x,y).setDisplaySize(outlineWidth,outlineHeight);
    this.fill.setPosition(x-width/2,y).setDisplaySize(Math.round(width*ratio),height);
    this.setVisible(p.hp>0 && player.active!==false);
  }
  setVisible(visible){ this.nodes.forEach(n=>n.setVisible(visible)); }
  destroy(){ this.nodes.forEach(n=>n?.destroy()); this.nodes=[]; }
}
