const {test}=require('node:test');
const assert=require('node:assert/strict');
const {CitySoundscape}=require('../city-soundscape.js');

class Audio {
  constructor(options){
    this.options=options;this.pauses=0;this.closed=false;
    this.tracks=Object.fromEntries(['water','wind','music'].map(key=>[key,{gain:{},source:{disconnect(){},connect(){return {connect(){}}}}}]));
    this.filters=[];this.ctx={createBiquadFilter:()=>{const f={frequency:{},Q:{}};this.filters.push(f);return f}};
    this.ready=Promise.resolve();
  }
  play(check){return new Promise(resolve=>{this.finish=()=>resolve(check())})}
  mix(){this.lastMix=this.options.readMix().mix}
  pause(){this.pauses++}
  close(){this.closed=true}
}
const make=(city,onInterruption)=>new CitySoundscape({city,Audio,onInterruption,sources:{water:'water',wind:'wind',music:'music'}});

test('city recordings use distinct gentle mixes, with music opt-in and water mute retained',async()=>{
  const river=make('guangzhou'),bay=make('shenzhen');
  await Promise.all([river.audio.ready,bay.audio.ready]);
  river.setMix({water:0,music:1});bay.setMix({});
  assert.equal(river.audio.lastMix.water,0);
  assert.equal(river.audio.lastMix.music,16);
  assert.equal(bay.audio.lastMix.music,0);
  assert.ok(bay.audio.lastMix.wind>river.audio.lastMix.wind);
  assert.ok(river.audio.filters[0].frequency.value<bay.audio.filters[0].frequency.value);
  river.stop();bay.stop();
});

test('a delayed audio start cannot revive a paused or superseded city session',async()=>{
  const sound=make('guangzhou');
  const first=sound.start(),finishFirst=sound.audio.finish;
  sound.stop();finishFirst();assert.equal(await first,false);
  const second=sound.start(),finishSecond=sound.audio.finish;
  const third=sound.start(),finishThird=sound.audio.finish;
  finishSecond();finishThird();assert.equal(await second,false);assert.equal(await third,true);
  sound.stop();
});

test('interruption pauses once and closing prevents further resume during the fade',async()=>{
  let interruptions=0;const sound=make('shenzhen',()=>{sound.stop();interruptions++});
  const started=sound.start();sound.audio.finish();await started;
  sound.audio.options.onInterruption();sound.audio.options.onInterruption();assert.equal(interruptions,1);
  sound.close();assert.equal(await sound.start(),false);
  await new Promise(resolve=>setTimeout(resolve,410));assert.equal(sound.audio.closed,true);
});
