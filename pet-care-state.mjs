export const PET_KEY='sleep-garden-pet-life-v1';
export const OUTFITS={collar:['none','sage','rose'],scarf:['none','cream','blue'],head:['none','flower','bow','rose']};
export const PET_LOOKS=[
  {name:'毛绒原色',premium:false,outfit:{collar:'none',scarf:'none',head:'none'}},
  {name:'奶油小雏菊',premium:true,outfit:{collar:'none',scarf:'cream',head:'flower'}},
  {name:'雾蓝蝴蝶结',premium:true,outfit:{collar:'rose',scarf:'blue',head:'bow'}},
  {name:'玫瑰花园',premium:true,outfit:{collar:'rose',scarf:'none',head:'rose'}}
];
export function canWearLook(look,member){return !!look&&(!look.premium||member===true)}
export function readPetState(storage){
  let raw={};try{raw=JSON.parse(storage?.getItem(PET_KEY)||'{}')||{}}catch{}
  const outfit={};for(const [slot,values] of Object.entries(OUTFITS))outfit[slot]=values.includes(raw.outfit?.[slot])?raw.outfit[slot]:'none';
  // Upgrade the old rose look, without rewriting outfits stored in memories.
  if(outfit.collar==='rose'&&outfit.scarf==='none'&&outfit.head==='flower')outfit.head='rose';
  if(outfit.collar==='sage'&&outfit.scarf==='none'&&outfit.head==='none')outfit.collar='none';
  const count=value=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
  return {outfit,demoMember:raw.demoMember===true,care:count(raw.care),visits:count(raw.visits),foods:{meal:count(raw.foods?.meal),treat:count(raw.foods?.treat),water:count(raw.foods?.water)},
    used:Array.isArray(raw.used)?raw.used.filter(v=>['box','scratch','cushion'].includes(v)):[],
    memories:Array.isArray(raw.memories)?raw.memories.filter(m=>m&&typeof m.title==='string'&&typeof m.at==='number').slice(0,12):[],
    firsts:Array.isArray(raw.firsts)?raw.firsts.filter(x=>typeof x==='string'):[],lastFeed:count(raw.lastFeed)};
}
export function savePetState(storage,state){try{storage?.setItem(PET_KEY,JSON.stringify(state));return true}catch{return false}}
export function relationship(care){return care>=12?'熟悉的家人':care>=5?'安心的朋友':'刚刚认识'}
export function remember(state,event,context={},now=Date.now()){
  if(state.firsts.includes(event.key))return null;
  state.firsts.push(event.key);
  const memory={id:`${now}-${event.key}`,key:event.key,title:event.title,at:now,weather:context.weather||'晴天',music:context.music||'安静的花园',outfit:{...state.outfit},image:context.image||'',portraitVersion:context.portraitVersion||0};
  state.memories.unshift(memory);state.memories=state.memories.slice(0,12);return memory;
}
