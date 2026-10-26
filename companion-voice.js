(function(root){
  'use strict';
  // A released gesture waits for final recognition results; a cancelled gesture
  // invalidates its session immediately, including delayed permission callbacks.
  function createCompanionVoice({Recognition,onState=()=>{},onSend=()=>{},onDraft=()=>{},now=()=>Date.now(),schedule=setTimeout,unschedule=clearTimeout}={}){
    let session=null;
    const idle=(message='')=>onState({phase:'idle',text:'',seconds:0,cancelling:false,message});
    const current=s=>session===s;
    function emit(s,message=''){
      if(current(s))onState({phase:s.released?'finishing':s.started?'listening':'starting',text:s.text,seconds:s.started?Math.floor((now()-s.startedAt)/1000):0,cancelling:s.cancelling,message});
    }
    function dispose(s,abort=true){
      if(!current(s))return;
      session=null;unschedule(s.timer);unschedule(s.tick);unschedule(s.finishTimer);
      if(abort)try{s.recognition.abort();}catch{}
    }
    function cancel(message='已取消，不会发送给小猫。'){
      if(!session)return;dispose(session);idle(message);
    }
    function draft(s,message){
      const text=s.text;dispose(s);idle(message);if(text)onDraft(text);
    }
    function settle(s){
      if(!current(s)||!s.released)return;
      if(s.interim){draft(s,'有些话还没听完整，已放入输入框，确认后再发送。');return;}
      const text=s.final.trim();dispose(s);
      if(!text){idle('没有听清，按住再说一次吧。');return;}
      if(text.length>600){idle('这段话超过 600 字，已放入输入框，请缩短后发送。');onDraft(text);return;}
      idle();onSend(text);
    }
    function release(){
      const s=session;if(!s||s.released)return;
      if(s.cancelling){cancel();return;}
      if(!s.started){cancel('授权麦克风后，请再按住说话。');return;}
      if(now()-s.startedAt<350){cancel('按住久一点，说完再松开。');return;}
      s.released=true;unschedule(s.timer);unschedule(s.tick);emit(s);
      if(s.ended){settle(s);return;}
      // stop() produces the last final result before onend; never send interim
      // words early or let a slow service send a second message later.
      s.finishTimer=schedule(()=>{if(current(s))draft(s,'语音识别有些慢，已听到的内容可在输入框确认。');},4000);
      try{s.recognition.stop();}catch{draft(s,'语音识别中断了，可以确认文字后发送。');}
    }
    function begin(){
      if(session||!Recognition)return false;
      let recognition;try{recognition=new Recognition();}catch{idle('暂时无法开启语音，请先打字告诉小猫。');return false;}
      const s=session={recognition,started:false,startedAt:0,released:false,cancelling:false,ended:false,text:'',final:'',interim:''};
      recognition.lang='zh-CN';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;
      recognition.onstart=()=>{
        if(!current(s)){try{recognition.abort();}catch{}return;}
        unschedule(s.timer);s.started=true;s.startedAt=now();emit(s);
        const tick=()=>{if(!current(s)||s.released)return;emit(s);s.tick=schedule(tick,1000);};s.tick=schedule(tick,1000);
        s.timer=schedule(()=>{if(current(s)){if(s.cancelling)cancel();else release();}},60000);
      };
      recognition.onresult=event=>{
        if(!current(s))return;
        const final=[],interim=[];
        for(let i=0;i<event.results.length;i++){
          const result=event.results[i],text=result[0]?.transcript||'';(result.isFinal?final:interim).push(text);
        }
        s.final=final.join('');s.interim=interim.join('');s.text=(s.final+s.interim).trim();emit(s);
      };
      recognition.onend=()=>{if(!current(s))return;s.ended=true;if(s.released)settle(s);else emit(s,'已听到，松开发送');};
      recognition.onerror=event=>{
        if(!current(s))return;
        if(s.cancelling){cancel();return;}
        const messages={'not-allowed':'麦克风或语音识别权限未开启，请在浏览器的网站设置中允许后重试。','service-not-allowed':'当前浏览器无法使用语音识别，请换用支持语音识别的 Chrome 或 Safari，或先打字。','audio-capture':'没有找到可用的麦克风，请检查设备后重试。','network':'语音识别服务未连上，可以重试，或先打字告诉小猫。','no-speech':'没有听到声音，按住再说一次吧。','language-not-supported':'当前浏览器暂不支持中文语音识别，可以先打字。'};
        draft(s,messages[event.error]||'这次语音没有识别成功，可以重试或打字。');
      };
      emit(s);s.timer=schedule(()=>{if(current(s))cancel('开启麦克风等得有些久，请检查浏览器权限后重试。');},15000);
      try{recognition.start();}catch{cancel('暂时无法开启语音，请检查麦克风权限或使用文字。');return false;}
      return true;
    }
    function setCancelling(value){if(session&&!session.released){session.cancelling=!!value;emit(session);}}
    return {begin,release,cancel,setCancelling,get active(){return !!session;}};
  }
  if(typeof module!=='undefined')module.exports={createCompanionVoice};else root.createCompanionVoice=createCompanionVoice;
})(typeof window==='undefined'?globalThis:window);
