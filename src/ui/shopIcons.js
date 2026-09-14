// Small local vector pictograms: crisp at phone scale, with no external fonts/assets.
export function drawShopIcon(scene,x,y,icon,color=0x8dd7ed,size=76) {
  const g=scene.add.graphics().setPosition(x,y).setScale(size/80).setScrollFactor(0);
  const poly=(points,fill)=>{g.fillStyle(fill,1);g.fillPoints(points.map(([x,y])=>({x,y})),true);};
  const rect=(x,y,w,h,fill)=>{g.fillStyle(fill,1);g.fillRoundedRect(x,y,w,h,4);};
  const circle=(x,y,r,fill)=>{g.fillStyle(fill,1);g.fillCircle(x,y,r);};
  const line=(points,width=4,fill=0xeef7ff)=>{g.lineStyle(width,fill,1);g.strokePoints(points.map(([x,y])=>({x,y})),false);};
  const dark=0x324f65,light=0xf0f7ff;
  switch(icon) {
    case 'blade':
      poly([[-13,15],[21,-29],[30,-32],[29,-20],[0,24]],color);
      line([[-4,12],[23,-23]],3,light); line([[-20,10],[7,30]],7,0xe9bb67); line([[-13,26],[-24,39]],9,dark); break;
    case 'bracer':
      rect(-22,-23,44,55,color); rect(-26,-27,52,10,dark); rect(-26,22,52,10,dark);
      rect(-25,-5,50,10,0xeac773); circle(0,0,5,light); break;
    case 'heart':
      circle(-13,-10,18,color);circle(13,-10,18,color);
      poly([[-31,-7],[31,-7],[0,33]],color);line([[-21,-16],[-13,-21],[-6,-18]],4,light);break;
    case 'bead':
      circle(0,1,28,dark);circle(0,1,23,color);circle(-8,-7,8,light);
      line([[-15,-26],[0,-35],[15,-26]],4,0xe9c477);break;
    case 'glove':
      rect(-22,-8,41,37,color); rect(-22,-31,9,31,color);rect(-10,-35,9,33,color);
      rect(2,-33,9,30,color);rect(14,-26,9,28,color);
      poly([[-22,5],[-32,-5],[-38,3],[-22,24]],color);rect(-22,24,44,12,dark);break;
    case 'shield':
      poly([[-29,-27],[29,-27],[25,12],[0,35],[-25,12]],dark);
      poly([[-22,-20],[22,-20],[18,8],[0,26],[-18,8]],color);line([[0,-13],[0,18]],5,light);line([[-12,0],[12,0]],5,light);break;
    case 'feather':
      poly([[-24,26],[-22,-1],[0,-27],[29,-35],[24,-6],[6,18]],color);
      line([[-29,34],[22,-28]],4,light);line([[-18,3],[-1,7],[1,20]],3,dark);break;
    case 'eye':
      poly([[-36,0],[-18,-21],[17,-21],[36,0],[17,21],[-18,21]],color);
      circle(0,0,17,light);circle(0,0,11,0x5ab9b9);circle(0,0,6,dark);circle(-3,-5,3,light);break;
    case 'fang':
      poly([[-21,-29],[21,-25],[17,-1],[7,20],[-13,36],[-4,5]],color);
      line([[10,-18],[7,0],[-4,20]],3,light);break;
    case 'rune':
      poly([[-24,-26],[13,-34],[29,-6],[14,31],[-15,28],[-30,3]],color);
      line([[1,-23],[-11,-1],[12,-1],[-3,23]],5,light);break;
    case 'badge':
      poly([[-18,9],[-23,36],[-3,26],[15,36],[20,9]],0xc8635e);
      circle(0,-5,25,color);poly([[0,-23],[6,-11],[20,-9],[10,0],[12,14],[0,7],[-12,14],[-10,0],[-20,-9],[-6,-11]],light);break;
    case 'hourglass':
      poly([[-24,-28],[24,-28],[20,-11],[5,1],[20,15],[24,29],[-24,29],[-20,15],[-5,1],[-20,-11]],0x8abed4);
      poly([[-16,-19],[16,-19],[0,-1]],color);poly([[0,8],[18,25],[-18,25]],color);
      rect(-29,-34,58,9,dark);rect(-29,27,58,9,dark);line([[0,1],[0,10]],3,light);break;
    case 'crystal':
      poly([[0,-36],[24,-14],[21,18],[0,35],[-21,18],[-24,-14]],color);
      poly([[0,-36],[0,35],[-13,11],[-13,-11]],0xa4efff);
      line([[-30,-23],[-36,-17]],3,light);line([[29,20],[35,14]],3,light);break;
    default:
      circle(0,0,25,color);circle(-8,-8,7,light);
  }
  return g;
}
