// Photo data stays in this browser. This demo estimates a coat palette, not anatomy.
export const PET_PROFILE_KEY='sleep-garden-pet-photo-v1';
export const PET_PATTERNS={solid:'纯色',bicolor:'白胸双色',tabby:'柔和虎斑',points:'重点色'};
export const PET_PRESETS=[
  {name:'奶油橘',base:'#d8a468',accent:'#fff1d9',pattern:'tabby'},
  {name:'奶牛猫',base:'#3c3839',accent:'#f4efe5',pattern:'bicolor'},
  {name:'暹罗猫',base:'#dbc5aa',accent:'#665449',pattern:'points'}
];
export function normalizePetProfile(raw){
  if(!raw||typeof raw!=='object')return null;
  const color=v=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v)?v.toLowerCase():null;
  const base=color(raw.base),accent=color(raw.accent);
  if(!base||!accent||!Object.hasOwn(PET_PATTERNS,raw.pattern))return null;
  const name=typeof raw.name==='string'?Array.from(raw.name.trim()).slice(0,16).join(''):'';
  // Only the small JPEG thumbnail produced here may be persisted, never arbitrary URLs.
  const photo=typeof raw.photo==='string'&&raw.photo.length<100000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(raw.photo)?raw.photo:'';
  return {name:name||'我的小猫',base,accent,pattern:raw.pattern,photo};
}
export function readPetProfile(storage){try{return normalizePetProfile(JSON.parse(storage?.getItem(PET_PROFILE_KEY)||'null'))}catch{return null}}
export function savePetProfile(storage,profile){
  try{if(!storage)return false;if(profile===null)storage.removeItem(PET_PROFILE_KEY);else{const value=normalizePetProfile(profile);if(!value)return false;storage.setItem(PET_PROFILE_KEY,JSON.stringify(value))}return true}catch{return false}
}
export function validatePetPhoto(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('请选择 JPG、PNG 或 WebP 照片。');
  if(!file.size||file.size>8*1024*1024)throw Error('照片需小于 8 MB，请换一张较小的照片。');
}
export function paletteFromPixels(pixels,width,height){
  // Centre-weighted quantization limits the influence of scenery, without claiming segmentation.
  const bins=new Map();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const dx=(x-width/2)/(width*.36),dy=(y-height/2)/(height*.42),d=dx*dx+dy*dy;
    const i=(y*width+x)*4;if(d>1||pixels[i+3]<200)continue;
    const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
    if(g>r*1.2&&g>b*1.15)continue;
    const key=[r,g,b].map(v=>Math.floor(v/32)).join(','),w=1.3-d;
    const bin=bins.get(key)||{rgb:[0,0,0],weight:0};bin.weight+=w;[r,g,b].forEach((v,j)=>bin.rgb[j]+=v*w);bins.set(key,bin);
  }
  const sorted=[...bins.values()].sort((a,b)=>b.weight-a.weight);
  if(!sorted.length)throw Error('中央区域的毛色不太清楚，请换一张近照，或试试下方毛色。');
  const rgb=bin=>bin.rgb.map(v=>v/bin.weight),main=rgb(sorted[0]);
  const secondary=sorted.find(b=>rgb(b).reduce((sum,v,j)=>sum+(v-main[j])**2,0)>75**2);
  const hex=c=>'#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  return {base:hex(main),accent:secondary?hex(rgb(secondary)):'#f5eee3',pattern:'solid'};
}
export async function preparePetPhoto(file){
  validatePetPhoto(file);
  const url=URL.createObjectURL(file),img=new Image();
  try{
    img.src=url;await img.decode();
    if(img.naturalWidth*img.naturalHeight>24000000)throw Error('照片分辨率过大，请缩小到 2400 万像素以内。');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const size=Math.min(img.naturalWidth,img.naturalHeight),x=(img.naturalWidth-size)/2,y=(img.naturalHeight-size)/2;
    ctx.fillStyle='#f4efe5';ctx.fillRect(0,0,256,256);ctx.drawImage(img,x,y,size,size,0,0,256,256);
    const palette=paletteFromPixels(ctx.getImageData(0,0,256,256).data,256,256);
    return {...palette,photo:canvas.toDataURL('image/jpeg',.78)};
  }catch(error){if(error instanceof Error&&/照片|毛色/.test(error.message))throw error;throw Error('这张照片没能读出来，请换一张 JPG、PNG 或 WebP 照片。')}
  finally{URL.revokeObjectURL(url)}
}
