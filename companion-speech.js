(function(root){
  'use strict';
  function createCompanionSpeech({Context=root.AudioContext||root.webkitAudioContext,fetcher=(...args)=>fetch(...args),readPetVoice=()=>null,onState=()=>{},duck=()=>{}}={}){
    let context=null,source=null,gain=null,controller=null,version=0,phase='idle',lastCueAt=-Infinity;
    const emit=(next,message='')=>{phase=next;onState({phase:next,message});};
    async function unlock(){
      if(!Context)throw Error('这台设备暂时不能播放小猫的声音。');
      if(!context||context.state==='closed')context=new Context();
      await context.resume();
      if(context.state!=='running')throw Error('请再点一下“听这句”，让小猫轻声说给你听。');
    }
    function stop(){
      version++;controller?.abort();controller=null;
      const old=source,oldGain=gain;source=null;gain=null;
      if(old){old.onended=null;try{const now=context.currentTime;oldGain.gain.cancelScheduledValues(now);oldGain.gain.setValueAtTime(oldGain.gain.value,now);oldGain.gain.linearRampToValueAtTime(0,now+.06);old.stop(now+.07);}catch{}setTimeout(()=>{old.disconnect();oldGain.disconnect();},100);}
      duck(false);emit('idle');
    }
    async function play(text,{cue='none'}={}){
      stop();if(typeof text!=='string'||!text.trim())return false;
      const current=version;controller=new AbortController();const abort=controller;
      emit('loading','小猫正在准备轻声回应…');
      const timeout=setTimeout(()=>abort.abort(),48000);
      try{
        // Run resume synchronously inside the user gesture, before network I/O.
        await unlock();if(current!==version)return false;
        // A cat sound is an occasional accent, including when replay is tapped.
        const accent=Date.now()-lastCueAt<60000?'none':cue;
        const recording=accent==='meow'?readPetVoice()?.data:null;
        const response=await fetcher('/api/companion/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,cue:recording?'none':accent}),signal:abort.signal});
        if(!response.ok){
          let code;try{code=(await response.json()).error;}catch{}
          throw Error(code==='speech_unavailable'?'这台设备的小猫声音还没准备好，文字会继续陪你。':'小猫这次没能说出声音，稍后可以再听这句。');
        }
        const bytes=await response.arrayBuffer();if(current!==version)return false;
        let buffer=await context.decodeAudioData(bytes);if(current!==version)return false;
        if(recording){
          // Append the user's clip locally; never send pet recordings to the speech server.
          try{
            const response=await fetcher(recording,{signal:abort.signal}),clip=await context.decodeAudioData(await response.arrayBuffer());
            if(current!==version)return false;
            if(readPetVoice()?.data===recording){
              const rate=buffer.sampleRate,gap=Math.round(rate*.12),length=Math.min(clip.length,Math.floor(clip.sampleRate*8));
              const outputLength=Math.floor(length/clip.sampleRate*rate),joined=context.createBuffer(buffer.numberOfChannels,buffer.length+gap+outputLength,rate);
              for(let channel=0;channel<buffer.numberOfChannels;channel++){
                const out=joined.getChannelData(channel),input=clip.getChannelData(Math.min(channel,clip.numberOfChannels-1));out.set(buffer.getChannelData(channel));
                for(let i=0;i<outputLength;i++)out[buffer.length+gap+i]=input[Math.min(length-1,Math.floor(i/rate*clip.sampleRate))]*.55*Math.min(1,i/(rate*.025),(outputLength-1-i)/(rate*.025));
              }
              buffer=joined;
            }
          }catch{/* A damaged local clip must not prevent the spoken reply. */}
          if(current!==version)return false;
        }
        if(context.state!=='running')throw Error('点“听这句”，让小猫轻声说给你听。');
        const node=context.createBufferSource(),envelope=context.createGain();source=node;gain=envelope;node.buffer=buffer;
        const now=context.currentTime;envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(.64,now+.10);envelope.gain.setValueAtTime(.64,now+Math.max(.10,buffer.duration-.09));envelope.gain.linearRampToValueAtTime(0,now+buffer.duration);
        node.connect(envelope).connect(context.destination);node.onended=()=>{if(current!==version)return;source=null;gain=null;node.disconnect();envelope.disconnect();duck(false);emit('idle');};
        duck(true);emit('playing','小猫正轻声说给你听');node.start();if(accent!=='none')lastCueAt=Date.now();return true;
      }catch(error){if(current===version){duck(false);emit('error',error.name==='AbortError'?'小猫的声音等得有些久，文字已经留在这里。':error.message);}return false;}
      finally{clearTimeout(timeout);if(current===version)controller=null;}
    }
    return {play,stop,unlock,get phase(){return phase;}};
  }
  if(typeof module!=='undefined')module.exports={createCompanionSpeech};else root.createCompanionSpeech=createCompanionSpeech;
})(typeof window==='undefined'?globalThis:window);
