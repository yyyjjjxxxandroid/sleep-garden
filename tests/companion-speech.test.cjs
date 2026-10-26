const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCompanionSpeech}=require('../companion-speech.js');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};};
const wave=()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(48)});
function fixture(fetcher=async()=>wave(),decode,options={}){
  const nodes=[],ducks=[],states=[],contexts=[];
  class Context{
    constructor(){this.state='suspended';this.currentTime=10;this.destination={};contexts.push(this);}
    async resume(){this.state='running';}
    async decodeAudioData(){return decode?decode():{duration:2};}
    createBuffer(numberOfChannels,length,sampleRate){const channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));return {numberOfChannels,length,sampleRate,duration:length/sampleRate,getChannelData:i=>channels[i]};}
    createGain(){return {gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}},connect(){return this},disconnect(){}};}
    createBufferSource(){const node={connect(){return this},start(){this.started=true},stop(){this.stopped=true},disconnect(){}};nodes.push(node);return node;}
  }
  const speech=createCompanionSpeech({Context,fetcher,onState:s=>states.push(s),duck:v=>ducks.push(v),...options});
  return {speech,nodes,ducks,states,contexts};
}

test('speech is silent until requested, ducks only during playback and restores after ending',async()=>{
  const f=fixture();assert.equal(f.contexts.length,0);assert.equal(f.speech.phase,'idle');
  assert.equal(await f.speech.play('今天先不用解释。'),true);assert.equal(f.nodes.length,1);assert.equal(f.nodes[0].started,true);
  assert.deepEqual(f.ducks,[false,true]);assert.equal(f.speech.phase,'playing');
  f.nodes[0].onended();assert.equal(f.ducks.at(-1),false);assert.equal(f.speech.phase,'idle');
});

test('stop aborts a pending request and late network results cannot start sound',async()=>{
  const response=deferred();let signal;const f=fixture(async(_,options)=>{signal=options.signal;return response.promise;});
  const playing=f.speech.play('迟到的声音');await new Promise(setImmediate);f.speech.stop();assert.equal(signal.aborted,true);
  response.resolve(wave());assert.equal(await playing,false);assert.equal(f.nodes.length,0);assert.equal(f.speech.phase,'idle');assert.ok(!f.ducks.includes(true));
});

test('stop during decoding invalidates decoded audio, including when another reply starts',async()=>{
  const decode=deferred();let count=0;const f=fixture(async()=>wave(),()=>++count===1?decode.promise:{duration:2});
  const first=f.speech.play('第一句话');await new Promise(setImmediate);
  const second=f.speech.play('第二句话');assert.equal(await second,true);
  decode.resolve({duration:2});assert.equal(await first,false);assert.equal(f.nodes.length,1);assert.equal(f.speech.phase,'playing');f.speech.stop();assert.equal(f.nodes[0].stopped,true);
});

test('replay interrupts the old source and suppresses frequent meows',async()=>{
  const cues=[],f=fixture(async(_,options)=>{cues.push(JSON.parse(options.body).cue);return wave();});
  await f.speech.play('你好。',{cue:'meow'});const first=f.nodes[0];
  await f.speech.play('还想听一次？',{cue:'purr'});assert.equal(first.stopped,true);assert.equal(first.onended,null);assert.deepEqual(cues,['meow','none']);f.speech.stop();
});

test('unavailable speech leaves a readable status and a later retry can succeed',async()=>{
  let available=false;const f=fixture(async()=>available?wave():{ok:false,json:async()=>({error:'speech_unavailable'})});
  assert.equal(await f.speech.play('文字还在。'),false);assert.equal(f.speech.phase,'error');assert.match(f.states.at(-1).message,/文字/);assert.ok(!f.ducks.includes(true));
  available=true;assert.equal(await f.speech.play('可以再试。'),true);f.speech.stop();
});

test('custom meow replaces the stock speech accent locally and honors cancellation',async()=>{
  const data='data:audio/wav;base64,UklGRg==',calls=[],sample=()=>({sampleRate:24000,length:24000,numberOfChannels:1,duration:1,getChannelData:()=>new Float32Array(24000).fill(.5)});
  const f=fixture(async(url,options)=>{calls.push({url,body:options.body});return wave()},sample,{readPetVoice:()=>({data})});
  assert.equal(await f.speech.play('晚安。',{cue:'meow'}),true);
  assert.deepEqual(JSON.parse(calls[0].body),{text:'晚安。',cue:'none'});assert.equal(calls[1].url,data);assert.equal(calls[1].body,undefined);
  const buffer=f.nodes[0].buffer;assert.equal(buffer.duration,2.12);assert.equal(buffer.getChannelData(0)[0],.5);assert.ok(buffer.getChannelData(0)[30000]>.2);f.speech.stop();
  const pending=deferred();let count=0;
  const stopped=fixture(async()=>wave(),()=>++count===1?sample():pending.promise,{readPetVoice:()=>({data})});
  const playing=stopped.speech.play('先歇一会。',{cue:'meow'});await new Promise(setImmediate);stopped.speech.stop();pending.resolve(sample());assert.equal(await playing,false);assert.equal(stopped.nodes.length,0);
});
