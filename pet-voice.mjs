export const PET_VOICE_KEY='sleep-garden-pet-voice-v1';
export const MAX_PET_VOICE_SECONDS=8;
export function normalizePetVoice(value){
  if(!value||typeof value.data!=='string'||value.data.length>560000||!/^data:audio\/wav;base64,[A-Za-z0-9+/=]+$/.test(value.data)||!Number.isFinite(value.duration)||value.duration<.15||value.duration>8.01)return null;
  return {data:value.data,duration:value.duration};
}
export function readPetVoice(storage){try{return normalizePetVoice(JSON.parse(storage?.getItem(PET_VOICE_KEY)||'null'))}catch{return null}}
export function savePetVoice(storage,voice){try{if(!storage)return false;if(voice===null)storage.removeItem(PET_VOICE_KEY);else{const value=normalizePetVoice(voice);if(!value)return false;storage.setItem(PET_VOICE_KEY,JSON.stringify(value))}return true}catch{return false}}

export function petVoiceWav(channels,sampleRate){
  const length=Math.min(...channels.map(c=>c.length),Math.floor(sampleRate*MAX_PET_VOICE_SECONDS));
  if(!channels.length||!Number.isFinite(sampleRate)||sampleRate<8000||length<sampleRate*.15)throw Error('录音太短了，录下完整的一声再试试。');
  const mono=new Float32Array(length);let peak=0;
  for(let i=0;i<length;i++){let sum=0;for(const c of channels)sum+=Number.isFinite(c[i])?c[i]:0;mono[i]=sum/channels.length;peak=Math.max(peak,Math.abs(mono[i]))}
  if(peak<.006)throw Error('还没听清声音，靠近一点再录一次吧。');
  let first=0,last=length-1;const threshold=Math.max(.003,peak*.025),padding=Math.floor(sampleRate*.08);
  while(first<last&&Math.abs(mono[first])<threshold)first++;
  while(last>first&&Math.abs(mono[last])<threshold)last--;
  first=Math.max(0,first-padding);last=Math.min(length,last+padding+1);
  const rate=24000,count=Math.floor((last-first)/sampleRate*rate);
  if(count<rate*.15)throw Error('声音太短了，试着录下一声完整的叫声。');
  const bytes=new Uint8Array(44+count*2),view=new DataView(bytes.buffer);
  const word=(at,s)=>{for(let i=0;i<s.length;i++)bytes[at+i]=s.charCodeAt(i)};
  word(0,'RIFF');view.setUint32(4,bytes.length-8,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,count*2,true);
  const gain=Math.min(2,.65/peak),fade=rate*.025;
  for(let i=0;i<count;i++){const position=first+i*sampleRate/rate,index=Math.floor(position),fraction=position-index;
    const sample=(mono[index]*(1-fraction)+(mono[Math.min(length-1,index+1)]||0)*fraction)*gain*Math.min(1,i/fade,(count-1-i)/fade);
    view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,sample))*32767),true);
  }
  return {bytes,duration:count/rate};
}
export async function preparePetVoice(blob){
  if(!blob?.size||blob.size>10*1024*1024)throw Error('请选择小于 10 MB 的音频，或重新录一段。');
  const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Context)throw Error('当前浏览器不支持音频处理，请换用 Chrome 或 Safari。');
  const ctx=new Context();
  try{
    const buffer=await ctx.decodeAudioData(await blob.arrayBuffer());
    const {bytes,duration}=petVoiceWav(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),buffer.sampleRate);
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return {data:'data:audio/wav;base64,'+btoa(binary),duration};
  }catch(error){if(/录音|声音|音频|浏览器/.test(error.message))throw error;throw Error('这段声音没能读出来，请重录或换一个音频文件。')}
  finally{await ctx.close().catch(()=>{})}
}
