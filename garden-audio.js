// Linear envelopes retain their actual value when interrupted, including on
// browsers without cancelAndHoldAtTime. No reliance on AudioParam.value timing.
class GardenEnvelope {
  constructor(param, value) { this.param=param; this.points=[{time:0,value}]; param.value=value; }
  valueAt(time) {
    let previous=this.points[0];
    for(const point of this.points.slice(1)) {
      if(time<point.time) return previous.value+(point.value-previous.value)*Math.max(0,(time-previous.time)/(point.time-previous.time));
      previous=point;
    }
    return previous.value;
  }
  hold(time) {
    const value=this.valueAt(time);
    this.param.cancelScheduledValues(time); this.param.setValueAtTime(value,time);
    this.points=[{time,value}];
    return this;
  }
  to(value,time) { this.param.linearRampToValueAtTime(value,time); this.points.push({time,value}); return this; }
  ramp(value,now,seconds) { return this.hold(now).to(value,now+seconds); }
}

// Repair codec edge samples with a short circular overlap after decoding.
// The longer, 2–3 second field-recording transitions are baked into the assets.
function gardenLoopBuffer(ctx,buffer) {
  const overlap=Math.min(Math.round(buffer.sampleRate*.06),Math.floor(buffer.length/4));
  const length=buffer.length-overlap,loop=ctx.createBuffer(buffer.numberOfChannels,length,buffer.sampleRate);
  for(let channel=0;channel<buffer.numberOfChannels;channel++) {
    const input=buffer.getChannelData(channel),output=loop.getChannelData(channel);
    for(let i=0;i<overlap;i++) { const weight=i/overlap; output[i]=input[length+i]*(1-weight)+input[i]*weight; }
    output.set(input.subarray(overlap,length),overlap);
  }
  return loop;
}

class GardenAudio {
  constructor({sources,readMix,readPetVoice=()=>null,onInterruption=()=>{},Context=window.AudioContext||window.webkitAudioContext}) {
    if(!Context) throw Error('Audio unavailable');
    this.ctx=new Context(); this.sources=sources; this.readMix=readMix; this.closed=false; this.tracks={};
    this.readPetVoice=readPetVoice;this.petVoiceVersion=0;
    this.master=this.ctx.createGain(); this.masterEnvelope=new GardenEnvelope(this.master.gain,0);
    this.endGain=this.ctx.createGain(); this.endEnvelope=new GardenEnvelope(this.endGain.gain,1);
    const limiter=this.ctx.createDynamicsCompressor();
    limiter.threshold.value=-18; limiter.knee.value=12; limiter.ratio.value=8; limiter.attack.value=.005; limiter.release.value=.25;
    this.master.connect(this.endGain).connect(limiter).connect(this.ctx.destination);
    this.ctx.onstatechange=()=>{if(!this.closed&&this.ctx.state!=='running')onInterruption(this.ctx.state)};
    this.ready=this.load(); this.ready.catch(()=>{});
    this.sceneVoices=new Set();this.lastStepDistance=null;this.lastChimeContact=null;
    this.sceneTimer=setInterval(()=>this.sceneTick(),80);
  }
  async load() {
    const entries=await Promise.all(Object.entries(this.sources).map(async([key,url])=>{
      const response=await fetch(url); if(!response.ok)throw Error('Audio asset unavailable: '+key);
      const bytes=await response.arrayBuffer();
      if(this.closed)throw Error('Audio closed');
      const buffer=await new Promise((resolve,reject)=>this.ctx.decodeAudioData(bytes,resolve,reject));
      return [key,buffer];
    }));
    if(this.closed)return;
    for(const[key,buffer]of entries) {
      const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
      source.buffer=gardenLoopBuffer(this.ctx,buffer); source.loop=true;
      const envelope=new GardenEnvelope(gain.gain,0);
      source.connect(gain).connect(this.master); source.start();
      this.tracks[key]={source,gain,envelope};
    }
  }
  async play(shouldPlay=()=>true) {
    clearTimeout(this.suspendTimer);
    // Called synchronously from the user's click, before fetching/decoding.
    const resumed=this.ctx.resume();
    await resumed; await this.ready;
    if(this.closed||!shouldPlay())return false;
    if(this.ctx.state!=='running')throw Error('Audio unavailable');
    this.mix(); this.masterEnvelope.ramp(.68,this.ctx.currentTime,.8);
    return true;
  }
  pause() {
    if(this.closed)return;
    this.stopPetVoice?.();
    const now=this.ctx.currentTime;
    this.endEnvelope.hold(now); this.masterEnvelope.ramp(0,now,.3);
    // 在挂起前结束短音效，继续播放时不恢复旧的尾音。
    if(this.plantCue)this.plantCue.stop(this.ctx.state==='running'?now+.3:now);
    clearTimeout(this.suspendTimer);
    this.suspendTimer=setTimeout(()=>{if(!this.closed)this.ctx.suspend().catch(()=>{})},350);
  }
  scheduleStop(seconds) {
    const now=this.ctx.currentTime,envelope=this.endEnvelope.hold(now);
    if(seconds>0&&seconds<=3)envelope.to(0,now+seconds);
    else {
      envelope.to(1,now+.3);
      if(seconds>0)envelope.to(1,now+seconds-3).to(0,now+seconds);
    }
  }
  mix() {
    const {mix,focused}=this.readMix(),now=this.ctx.currentTime;
    if(!mix.cat)this.stopPetVoice?.();
    for(const[key,track]of Object.entries(this.tracks)) {
      let value=Math.max(0,Math.min(100,Number(mix[key])||0))/100;
      if(key==='cat')value*=focused?1.2:.8;
      track.envelope.ramp(value,now,.8);
    }
  }
  pet() {
    const {mix,focused,playing}=this.readMix();
    if(!playing||!mix.cat||this.ctx.state!=='running'||!this.tracks.cat)return;
    const recording=this.readPetVoice();
    if(recording?.data){this.playPetRecording(recording);return}
    const now=this.ctx.currentTime,base=mix.cat/100*(focused?1.2:.8);
    this.tracks.cat.envelope.hold(now).to(Math.min(.85,base*1.15),now+.3).to(base,now+2.4);
  }
  stopPetVoice(){
    this.petVoiceVersion++;
    if(this.petVoiceSource){try{this.petVoiceSource.stop()}catch{}this.petVoiceSource=null}
  }
  async playPetRecording(recording){
    if(this.closed||this.petVoiceSource||this.petVoiceLoading||this.ctx.currentTime-(this.lastPetVoiceAt??-Infinity)<3)return false;
    const version=++this.petVoiceVersion;this.petVoiceLoading=true;
    try{
      let buffer=this.petVoiceCache?.data===recording.data?this.petVoiceCache.buffer:null;
      if(!buffer){
        const response=await fetch(recording.data);const bytes=await response.arrayBuffer();
        buffer=await this.ctx.decodeAudioData(bytes);this.petVoiceCache={data:recording.data,buffer};
      }
      const state=this.readMix();
      if(this.closed||version!==this.petVoiceVersion||!state.playing||!state.mix.cat||this.ctx.state!=='running'||this.readPetVoice()?.data!==recording.data)return false;
      const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),now=this.ctx.currentTime,duration=Math.min(8,buffer.duration);
      const level=Math.min(.65,state.mix.cat/100*.8);
      source.buffer=buffer;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level,now+.025);gain.gain.setValueAtTime(level,now+Math.max(.025,duration-.05));gain.gain.linearRampToValueAtTime(0,now+duration);
      source.connect(gain).connect(this.master);this.petVoiceSource=source;this.lastPetVoiceAt=now;
      source.onended=()=>{source.disconnect();gain.disconnect();if(this.petVoiceSource===source)this.petVoiceSource=null};source.start();source.stop(now+duration);return true;
    }catch{return false}finally{this.petVoiceLoading=false}
  }
  plantGrowthCue(stage=0) {
    const {mix,playing}=this.readMix();
    if(this.closed||!playing||this.ctx.state!=='running')return false;
    const volume=Object.values(mix||{}).reduce((maximum,value)=>Math.max(maximum,Math.max(0,Math.min(100,Number(value)||0))/100),0);
    if(!volume)return false;
    const now=this.ctx.currentTime;
    if(now-(this.lastPlantCueAt??-Infinity)<5)return false;
    this.lastPlantCueAt=now;
    const frequencies=[523.25,587.33,659.25,783.99],frequency=frequencies[Math.max(0,Math.min(frequencies.length-1,Math.floor(stage)))];
    const tone=this.ctx.createOscillator(),gain=this.ctx.createGain();
    tone.type='sine';tone.frequency.setValueAtTime(frequency*1.18,now);tone.frequency.exponentialRampToValueAtTime(frequency,now+.28);
    const peak=.018*Math.sqrt(volume);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(peak,now+.045);gain.gain.exponentialRampToValueAtTime(.0001,now+.72);
    this.plantCue=tone;
    tone.connect(gain).connect(this.master);tone.onended=()=>{tone.disconnect();gain.disconnect();if(this.plantCue===tone)this.plantCue=null};tone.start(now);tone.stop(now+.74);
    return true;
  }
  sceneTick(){
    const state=this.readMix();
    if(this.closed||this.ctx.state!=='running'||!state.playing){this.lastStepDistance=state.catDistance??null;this.lastChimeContact=state.chimeContact??null;return;}
    const distance=state.catDistance||0,contact=state.chimeContact||0;
    if(this.lastStepDistance===null)this.lastStepDistance=distance;
    if(state.catMoving&&distance-this.lastStepDistance>=.24){this.lastStepDistance=distance;if(state.mix.footsteps>0)this.pawStep(state.mix.footsteps/100);}
    if(!state.catMoving)this.lastStepDistance=distance;
    if(this.lastChimeContact!==null&&contact!==this.lastChimeContact&&state.wind>0&&state.mix.chime>0)this.chimeStrike(state.mix.chime/100);
    this.lastChimeContact=contact;
  }
  voice(source,gain,seconds){
    source.connect(gain).connect(this.master);this.sceneVoices.add(source);
    source.onended=()=>{this.sceneVoices.delete(source);source.disconnect();gain.disconnect()};
    source.start();source.stop(this.ctx.currentTime+seconds);
  }
  pawStep(level){
    const ctx=this.ctx,now=ctx.currentTime;
    if(!this.pawBuffer){const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.13),ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);this.pawBuffer=buffer;}
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.pawBuffer;source.playbackRate.value=.9+Math.random()*.2;
    filter.type='lowpass';filter.frequency.value=900+Math.random()*250;filter.Q.value=.4;source.connect(filter);filter.connect(gain);gain.connect(this.master);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level*.10,now+.012);gain.gain.exponentialRampToValueAtTime(.00001,now+.12);
    this.sceneVoices.add(source);source.onended=()=>{this.sceneVoices.delete(source);source.disconnect();filter.disconnect();gain.disconnect()};source.start();source.stop(now+.14);
  }
  chimeStrike(level){
    const ctx=this.ctx,now=ctx.currentTime,base=[523.25,659.25,783.99,880][Math.floor(Math.random()*4)];
    for(const [ratio,volume,decay] of [[1,1,1.6],[2.76,.22,.55],[5.4,.06,.18]]){
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=base*ratio;
      gain.gain.setValueAtTime(.00001,now);gain.gain.linearRampToValueAtTime(level*.065*volume,now+.008);gain.gain.exponentialRampToValueAtTime(.00001,now+decay);
      this.voice(osc,gain,decay+.05);
    }
  }
  close() {
    this.stopPetVoice?.();
    this.closed=true; clearTimeout(this.suspendTimer);clearInterval(this.sceneTimer);this.ctx.onstatechange=null;
    if(this.plantCue)this.plantCue.stop();
    for(const source of this.sceneVoices)try{source.stop()}catch{}
    for(const{source}of Object.values(this.tracks))try{source.stop()}catch{}
    return this.ctx.close().catch(()=>{});
  }
}
if(typeof window!=='undefined')Object.assign(window,{GardenAudio,GardenEnvelope,gardenLoopBuffer});
if(typeof module!=='undefined')module.exports={GardenAudio,GardenEnvelope,gardenLoopBuffer};
