// Use the garden's licensed, loop-prepared recordings. These are designed
// soundscapes, not recordings made at the depicted city landmarks.
const CITY_SOUND_PROFILES={
  quanzhou:{water:.52,wind:.24,waterCutoff:1700,windCutoff:850},
  guangzhou:{water:.58,wind:.18,waterCutoff:1400,windCutoff:700},
  shenzhen:{water:.43,wind:.30,waterCutoff:2100,windCutoff:1100},
};
class CitySoundscape {
  constructor({city='quanzhou',Audio=window.GardenAudio,sources=window.GARDEN_AUDIO_ASSETS,onInterruption=()=>{}}={}){
    this.profile=CITY_SOUND_PROFILES[city]||CITY_SOUND_PROFILES.quanzhou;
    this.mix={water:1,wind:1,music:0};this.active=false;this.closed=false;this.version=0;
    this.audio=new Audio({sources:{water:sources.water,wind:sources.wind,music:sources.music},
      readMix:()=>({mix:Object.fromEntries(Object.entries(this.mix).map(([key,value])=>[key,value*(key==='music'?.16:this.profile[key])*100])),playing:this.active}),
      onInterruption:()=>{if(this.active){this.active=false;onInterruption();}}});
    const audio=this.audio;
    audio.ready=audio.ready.then(()=>{
      if(this.closed)return;
      for(const key of ['water','wind']){
        const track=audio.tracks[key],filter=audio.ctx.createBiquadFilter();
        filter.type='lowpass';filter.frequency.value=this.profile[key+'Cutoff'];filter.Q.value=.5;
        track.source.disconnect();track.source.connect(filter).connect(track.gain);
      }
    });
    audio.ready.catch(()=>{});
  }
  async start(){
    if(this.closed)return false;
    const version=++this.version;this.active=true;
    try{return await this.audio.play(()=>this.active&&!this.closed&&version===this.version);}
    catch(error){if(version===this.version)this.active=false;throw error;}
  }
  setMix(mix){this.mix={...this.mix,...mix};if(!this.closed)this.audio.mix();}
  stop(){this.active=false;this.version++;if(!this.closed)this.audio.pause();}
  close(){
    if(this.closed)return;
    this.stop();this.closed=true;
    // Let the existing 300 ms envelope finish before releasing this context.
    setTimeout(()=>this.audio.close(),380);
  }
}
if(typeof window!=='undefined')window.CitySoundscape=CitySoundscape;
if(typeof module!=='undefined')module.exports={CitySoundscape,CITY_SOUND_PROFILES};
