import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PET_VOICE_KEY,normalizePetVoice,readPetVoice,savePetVoice,petVoiceWav} from '../pet-voice.mjs';
const {GardenAudio}=createRequire(import.meta.url)('../garden-audio.js');

test('pet recording WAV is bounded, has quiet edges and a safe peak',()=>{
  const rate=48000,input=Float32Array.from({length:rate*10},(_,i)=>Math.sin(i*.08)*.95);
  const {bytes,duration}=petVoiceWav([input,input],rate),v=new DataView(bytes.buffer);
  assert.equal(duration,8);assert.equal(v.getUint16(22,true),1);assert.equal(v.getUint32(24,true),24000);assert.equal(bytes.length,44+8*24000*2);
  assert.equal(v.getInt16(44,true),0);assert.equal(v.getInt16(bytes.length-2,true),0);
  let peak=0;for(let i=44;i<bytes.length;i+=2)peak=Math.max(peak,Math.abs(v.getInt16(i,true))/32767);
  assert.ok(peak<=.651&&peak>.6);
  assert.throws(()=>petVoiceWav([new Float32Array(24000)],24000),/听清/);
  assert.throws(()=>petVoiceWav([new Float32Array(100)],24000),/太短/);
});

test('recordings persist locally, reject arbitrary URLs and recover from unavailable storage',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},voice={data:'data:audio/wav;base64,UklGRg==',duration:1.2};
  assert.equal(savePetVoice(storage,voice),true);assert.deepEqual(readPetVoice(storage),voice);
  for(const value of [{...voice,data:'https://example.com/meow.wav'},{...voice,data:'data:text/html;base64,AA=='},{...voice,duration:Infinity},{...voice,duration:12},{...voice,data:'data:audio/wav;base64,'+'A'.repeat(560000)}])assert.equal(normalizePetVoice(value),null);
  map.set(PET_VOICE_KEY,'bad json');assert.equal(readPetVoice(storage),null);
  savePetVoice(storage,voice);assert.equal(savePetVoice(storage,null),true);assert.equal(readPetVoice(storage),null);
  assert.equal(savePetVoice(null,voice),false);assert.equal(savePetVoice({setItem(){throw Error('full')}},voice),false);
});

function fakeEngine(){
  const state={playing:true,mix:{cat:25}},voice={data:'data:audio/wav;base64,UklGRg==',duration:2};let starts=0,stops=0,decode;
  const node={connect(){return this},disconnect(){},start(){starts++},stop(){stops++},gain:{setValueAtTime(){},linearRampToValueAtTime(){}}};
  const engine=Object.assign(Object.create(GardenAudio.prototype),{closed:false,petVoiceVersion:0,readMix:()=>state,readPetVoice:()=>voice,master:{},tracks:{cat:{}},ctx:{currentTime:10,state:'running',decodeAudioData:()=>new Promise(r=>decode=r),createBufferSource:()=>({...node}),createGain:()=>({...node})}});
  return {engine,state,voice,decoded:()=>decode?.({duration:2}),counts:()=>({starts,stops})};
}
test('a late decode cannot play after pause, mute, or replacement',async()=>{
  for(const change of ['pause','mute','replace']){
    const t=fakeEngine(),promise=t.engine.playPetRecording(t.voice);await new Promise(r=>setImmediate(r));
    if(change==='pause'){t.state.playing=false;t.engine.stopPetVoice()}
    if(change==='mute')t.state.mix.cat=0;
    if(change==='replace')t.engine.readPetVoice=()=>null;
    t.decoded();assert.equal(await promise,false);assert.equal(t.counts().starts,0);
  }
});
test('recorded pet sound plays once through master and stops on interruption',async()=>{
  const t=fakeEngine(),promise=t.engine.playPetRecording(t.voice);await new Promise(r=>setImmediate(r));t.decoded();assert.equal(await promise,true);
  assert.equal(t.counts().starts,1);assert.equal(await t.engine.playPetRecording(t.voice),false,'repeated touches do not overlap');
  t.engine.stopPetVoice();assert.equal(t.engine.petVoiceSource,null);assert.equal(t.counts().stops,2,'scheduled stop plus interruption');
  assert.equal(await t.engine.playPetRecording(t.voice),false,'three second cooldown prevents repeated cries');
});
