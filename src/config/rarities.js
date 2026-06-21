export const RARITY_IDS = Object.freeze({ COMMON:'COMMON', FINE:'FINE', RARE:'RARE', EPIC:'EPIC', LEGENDARY:'LEGENDARY', MYTHIC:'MYTHIC' });
export const RARITIES = {
  COMMON:{id:'COMMON',name:'普通',color:0xffffff,uiColor:'#ffffff',weight:60},
  FINE:{id:'FINE',name:'精良',color:0x48d46a,uiColor:'#48d46a',weight:28},
  RARE:{id:'RARE',name:'稀有',color:0x4aa3ff,uiColor:'#4aa3ff',weight:9},
  EPIC:{id:'EPIC',name:'史诗',color:0xb66cff,uiColor:'#b66cff',weight:2},
  LEGENDARY:{id:'LEGENDARY',name:'传说',color:0xffc247,uiColor:'#ffc247',weight:0},
  MYTHIC:{id:'MYTHIC',name:'神话',color:0xff4b4b,uiColor:'#ff4b4b',weight:0},
};
export const STARTING_RARITIES = new Set(['COMMON','FINE']);
export const UPGRADE_RARITY_WEIGHTS = { COMMON:60, FINE:28, RARE:9, EPIC:2, LEGENDARY:0, MYTHIC:0 };
export const RARITY_UI_STYLE = {
  COMMON: { label: '普通', mainColor: 0xf2f2f2, secondaryColor: 0xbfc5cc, textColor: '#f2f2f2' },
  FINE: { label: '精良', mainColor: 0x63dc86, secondaryColor: 0x309e58, textColor: '#63dc86' },
  RARE: { label: '稀有', mainColor: 0x58aaff, secondaryColor: 0x286fc7, textColor: '#58aaff' },
  EPIC: { label: '史诗', mainColor: 0xa77bff, secondaryColor: 0x6d42c7, textColor: '#a77bff' },
  LEGENDARY: { label: '传说', mainColor: 0xffa43a, secondaryColor: 0xcf671c, textColor: '#ffa43a' },
  MYTHIC: { label: '神话', mainColor: 0xff5d4f, secondaryColor: 0xffc34d, textColor: '#ff6759' },
};
export const getRarity = (id) => RARITIES[id] || RARITIES.COMMON;
