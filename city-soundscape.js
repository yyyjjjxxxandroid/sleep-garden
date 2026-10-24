// 泉州场景的原型环境声：浏览器内合成水面与风的连续氛围。
// 这是设计验证用的合成音，不代替洛阳桥现场录音。
class CitySoundscape {
  constructor({Context=window.AudioContext||window.webkitAudioContext}={}) {
    this.Context=Context; this.ctx=null; this.master=null; this.layers={}; this.active=false; this.version=0;
  }
  noiseBuffer(seconds=6) {
    const length=Math.max(1,Math.floor(this.ctx.sampleRate*seconds));
    const buffer=this.ctx.createBuffer(2,length,this.ctx.sampleRate);
    for(let c=0;c<2;c++){
      const data=buffer.getChannelData(c); let brown=0;
      for(let i=0;i<length;i++){
        const white=Math.random()*2-1;
        brown=(brown+white*.045)*.985;
        data[i]=Math.max(-1,Math.min(1,brown*3.2+white*.16));
      }
    }
    return buffer;
  }
  makeLayer(name,{type='lowpass',frequency=1000,Q=.7,gain=.1,rate=.08}={}){
    const source=this.ctx.createBufferSource(); source.buffer=this.noiseBuffer(); source.loop=true;
    const filter=this.ctx.createBiquadFilter(); filter.type=type; filter.frequency.value=frequency; filter.Q.value=Q;
    const amp=this.ctx.createGain(); amp.gain.value=0;
    const lfo=this.ctx.createOscillator(), lfoGain=this.ctx.createGain(); lfo.frequency.value=rate; lfoGain.gain.value=gain*.55;
    lfo.connect(lfoGain).connect(amp.gain); source.connect(filter).connect(amp).connect(this.master);
    source.start(); lfo.start(); this.layers[name]={source,filter,amp,lfo,lfoGain,base:gain}; return this.layers[name];
  }
  async start(){
    if(!this.Context)return false;
    this.version++;
    if(!this.ctx){
      this.ctx=new this.Context(); this.master=this.ctx.createGain(); this.master.gain.value=.72; this.master.connect(this.ctx.destination);
      this.makeLayer('water',{type:'lowpass',frequency:760,Q:.7,gain:.13,rate:.13});
      this.makeLayer('waterDetail',{type:'bandpass',frequency:1800,Q:.55,gain:.025,rate:.31});
      this.makeLayer('wind',{type:'bandpass',frequency:360,Q:.8,gain:.08,rate:.055});
    }
    await this.ctx.resume(); this.master.gain.setTargetAtTime(.72,this.ctx.currentTime,.12); this.active=true; this.setMix({water:.72,wind:.38}); return true;
  }
  setMix({water=0,wind=0}={}){
    if(!this.ctx)return;
    const now=this.ctx.currentTime;
    for(const [name,layer] of Object.entries(this.layers)){
      const value=name.startsWith('water')?water:wind;
      layer.amp.gain.cancelScheduledValues(now); layer.amp.gain.setTargetAtTime(layer.base*value,now,.18);
      layer.lfoGain.gain.cancelScheduledValues(now); layer.lfoGain.gain.setTargetAtTime(layer.base*value*.55,now,.18);
    }
  }
  async stop(){
    if(!this.ctx)return;
    const version=++this.version,context=this.ctx;
    const now=this.ctx.currentTime; this.master.gain.cancelScheduledValues(now); this.master.gain.setTargetAtTime(0,now,.22); this.active=false;
    await new Promise(resolve=>setTimeout(resolve,260)); if(version===this.version&&context===this.ctx&&!this.active)context.suspend().catch(()=>{});
  }
  close(){if(this.ctx){for(const l of Object.values(this.layers)){try{l.source.stop()}catch{}try{l.lfo.stop()}catch{}}this.ctx.close().catch(()=>{})}this.ctx=null;this.layers={};this.active=false}
}
if(typeof window!=='undefined')window.CitySoundscape=CitySoundscape;
if(typeof module!=='undefined')module.exports={CitySoundscape};
