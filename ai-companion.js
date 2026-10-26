function createAiCompanion(hooks){
  const $=id=>document.getElementById(id),P=window.CompanionPlan,app=$('app'),panel=$('companionOverlay'),log=$('companionLog'),form=$('companionForm'),input=$('companionInput');
  const memoryKey='sleepGarden.companion.preferences.v1';
  let memory={muted:[],scene:null,music:null},history=[],plan=null,planContext=null,controller=null,busy=false,applying=false,version=0,returnFocus=null,inert=[];
  let autoSpeak=false,lastSpeech=null;
  // Sound is opt-in for this page visit; never restore an old enabled flag.
  const speakToggle=$('companionSpeakToggle'),speakReplay=$('companionSpeakReplay'),speakStop=$('companionSpeakStop'),speechStatus=$('companionSpeechStatus');
  const speech=window.createCompanionSpeech({duck:active=>hooks.duck?.(active),onState:s=>{
    const active=['loading','playing'].includes(s.phase);speakStop.hidden=!active;speakReplay.hidden=active;
    speechStatus.textContent=s.message||(autoSpeak?'声音已开启，下一句回复会读给你听。':'声音已关闭，只显示文字。');
  }});
  function syncSpeech(){speakToggle.setAttribute('aria-checked',String(autoSpeak));$('companionSpeakLabel').textContent=autoSpeak?'开启':'关闭';speakReplay.disabled=!autoSpeak||!lastSpeech||busy||applying;}
  function speakLast(){
    if(!autoSpeak||!lastSpeech||busy||applying)return;cancelVoice();speech.play(lastSpeech.reply,{cue:lastSpeech.delivery.cue});
  }
  speakToggle.onclick=()=>{
    autoSpeak=!autoSpeak;
    syncSpeech();speech.stop();if(autoSpeak)speech.unlock().catch(()=>{});
  };
  speakReplay.onclick=speakLast;speakStop.onclick=()=>speech.stop();syncSpeech();
  const hold=$('companionHold'),toggle=$('companionInputToggle'),voiceHint=$('companionVoiceHint'),transcript=$('companionVoiceTranscript');
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition,voiceSupported=!!Recognition&&window.isSecureContext;
  let voiceMode=voiceSupported,pointer=null,heldKey=null;
  const voiceIdleHint='松开发送，上滑取消 · 最长 60 秒';
  function syncVoiceMode(focus=false){
    input.hidden=voiceMode;input.required=!voiceMode;$('companionSend').hidden=voiceMode;hold.hidden=!voiceMode;
    toggle.setAttribute('aria-label',voiceMode?'切换文字输入':'切换语音输入');toggle.title=voiceMode?'切换文字输入':'切换语音输入';
    toggle.innerHTML=voiceMode?'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M5 9h2m3 0h2m3 0h3M5 12h2m3 0h2m3 0h3M7 15h10"/></svg>':'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3M9 21h6"/></svg>';
    voiceHint.hidden=!voiceMode;if(voiceMode)voiceHint.textContent=voiceIdleHint;
    if(focus)(voiceMode?hold:input).focus({preventScroll:true});
  }
  function syncBusy(){hold.disabled=busy||applying;$('companionSend').disabled=busy||applying;toggle.disabled=busy||applying;}
  const voice=window.createCompanionVoice({Recognition:voiceSupported?Recognition:null,
    onSend:message=>{if(!panel.hidden)send(message);},
    onDraft:text=>{if(panel.hidden)return;input.value=text;voiceMode=false;const hint=voiceHint.textContent;syncVoiceMode(true);voiceHint.hidden=false;voiceHint.textContent=hint;},
    onState:s=>{
      if(s.phase==='starting'){speech.stop();if(autoSpeak)speech.unlock().catch(()=>{});}
      const active=s.phase!=='idle';hold.dataset.phase=s.phase;hold.dataset.cancel=String(s.cancelling);hold.setAttribute('aria-pressed',String(active));
      $('companionHoldLabel').textContent=s.phase==='starting'?'正在开启麦克风…':s.phase==='finishing'?'正在识别…':s.phase==='listening'?(s.cancelling?'松开取消':'松开发送 · '+s.seconds+' 秒'):'按住说话';
      transcript.hidden=!s.text;transcript.textContent=s.text;
      voiceHint.hidden=!voiceMode&&!s.message;
      const hint=s.message||(s.cancelling?'松开手指，这句话不会发送':s.phase==='starting'?'首次使用请允许麦克风；授权后再按住说话':s.phase==='finishing'?'正在确认最后几个字…':voiceIdleHint);
      if(voiceHint.textContent!==hint)voiceHint.textContent=hint;
    }
  });
  function cancelVoice(){pointer=null;heldKey=null;voice.cancel();}
  syncVoiceMode();
  toggle.onclick=()=>{
    cancelVoice();
    if(!voiceSupported){voiceHint.hidden=false;voiceHint.textContent=window.isSecureContext?'当前浏览器不支持语音识别，请用支持语音识别的 Chrome 或 Safari 打开，或先打字。':'语音需要 HTTPS 或本机地址，请先用文字输入。';return;}
    voiceMode=!voiceMode;syncVoiceMode(true);
  };
  hold.addEventListener('pointerdown',e=>{
    if(!e.isPrimary||e.button!==0||busy||applying||voice.active)return;
    e.preventDefault();hold.focus({preventScroll:true});pointer={id:e.pointerId,y:e.clientY};
    try{hold.setPointerCapture(e.pointerId);}catch{}
    if(!voice.begin())pointer=null;
  });
  hold.addEventListener('pointermove',e=>{if(pointer?.id===e.pointerId)voice.setCancelling(pointer.y-e.clientY>=60);});
  hold.addEventListener('pointerup',e=>{if(pointer?.id!==e.pointerId)return;e.preventDefault();pointer=null;voice.release();});
  hold.addEventListener('pointercancel',cancelVoice);
  hold.addEventListener('lostpointercapture',()=>{if(pointer)cancelVoice();});
  hold.addEventListener('contextmenu',e=>e.preventDefault());
  hold.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&voice.active){e.preventDefault();e.stopPropagation();cancelVoice();return;}
    if(![' ','Enter'].includes(e.key))return;e.preventDefault();
    if(!e.repeat&&!voice.active&&!busy&&!applying){heldKey=e.key;voice.begin();}
  });
  hold.addEventListener('keyup',e=>{if(e.key===heldKey){e.preventDefault();heldKey=null;voice.release();}});
  // Assistive technology can activate the button without pointer/key events.
  hold.addEventListener('click',e=>{if(e.detail===0&&!busy&&!applying){if(voice.active)voice.release();else voice.begin();}});
  hold.addEventListener('blur',()=>{if(voice.active)cancelVoice();});
  window.addEventListener('blur',cancelVoice);
  window.addEventListener('pagehide',cancelVoice);
  window.addEventListener('pagehide',()=>speech.stop());
  window.addEventListener('blur',()=>speech.stop());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelVoice();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)speech.stop();});
  try{memory=P.normalizeMemory(JSON.parse(localStorage.getItem(memoryKey)||'null'))}catch{}
  const snapshot=()=>hooks.snapshot();
  function bubble(role,text){const item=document.createElement('p');item.className='companion-bubble '+role;item.textContent=text;log.append(item);while(log.children.length>16)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;return item;}
  function status(text){$('companionStatus').textContent=text;}
  function showMemory(){
    const names={sun:'鸟鸣',wind:'风声',rain:'雨声',bugs:'虫鸣',cat:'呼噜',water:'流水',music:'音乐'},scenes={garden:'花园',quanzhou:'泉州',guangzhou:'广州',shenzhen:'深圳'};
    const parts=[...memory.muted.map(k=>'不放'+names[k]),...(memory.scene?['偏爱'+scenes[memory.scene]]:[]),...(memory.music!==null?[memory.music?'喜欢轻音乐':'只听自然声']:[])];
    $('companionMemoryText').textContent=parts.length?'你让我记住的：'+parts.join('、'):'只记住你确认过的声音与场景偏好';$('companionForget').hidden=!parts.length;
  }
  async function check(){
    status('正在连接小猫…');
    try{const res=await fetch('/api/companion/status',{cache:'no-store'}),data=await res.json();status(data.configured?'AI 小猫已连接，可以说说了':'AI 尚未连接 · 场景和音乐仍可使用');$('companionConnection').hidden=data.configured;}
    catch{status('AI 暂时没有连接，花园仍在这里');$('companionConnection').hidden=false;}
  }
  function open(){
    if(!panel.hidden)return;
    hooks.leaveRest?.();returnFocus=document.activeElement;panel.hidden=false;
    inert=[...app.children].filter(x=>x!==panel).map(x=>[x,x.inert]);for(const[node]of inert)node.inert=true;
    if(!log.children.length)bubble('assistant','我在。想聊聊，还是让我帮你调一段声音？');
    showMemory();check();syncVoiceMode(true);
  }
  function close(){
    if(applying)return;
    cancelVoice();speech.stop();version++;controller?.abort();controller=null;busy=false;form.removeAttribute('aria-busy');syncBusy();syncSpeech();
    panel.hidden=true;for(const[node,value]of inert)node.inert=value;inert=[];returnFocus?.isConnected&&returnFocus.focus({preventScroll:true});
  }
  function describe(p){
    const names={sun:'鸟鸣',wind:'风声',rain:'细雨',bugs:'虫鸣',cat:'呼噜',water:'流水',music:'轻音乐'},scenes={garden:'花园',quanzhou:'泉州 · 洛阳桥',guangzhou:'广州 · 珠江边',shenzhen:'深圳湾'};
    return [p.scene!=='keep'?scenes[p.scene]:null,p.mood==='night'?'夜色':p.mood==='dusk'?'黄昏':null,...Object.entries(p.mix).map(([k,v])=>names[k]+' '+v+'%'),p.catAction==='rest'?'小猫静静休息':p.catAction==='approach'?'靠近小猫':p.catAction==='pet'?'摸摸小猫':null,p.playback==='pause'?'暂停声音':null].filter(Boolean).join(' · ');
  }
  function renderPlan(){
    const summary=plan&&describe(plan);$('companionPlan').hidden=!plan||(!summary&&!plan.memory&&plan.interaction==='keep');
    if(!plan)return;
    $('companionReason').textContent=plan.reason||'按你刚才说的，留一段舒服的声音。';
    $('companionChanges').textContent=summary||'保持当前声音，继续陪你聊聊。';
    $('companionApply').hidden=!summary&&plan.interaction==='keep';
    $('companionApply').textContent='就这样陪我';$('companionApply').disabled=false;
    $('companionRemember').hidden=!plan.memory;$('companionListen').hidden=true;
  }
  async function send(message){
    if(busy||applying||!message.trim())return;
    cancelVoice();
    speech.stop();
    if(autoSpeak)speech.unlock().catch(()=>{});
    if(message.length>600){status('这句话有点长，缩短到 600 字以内吧。');return;}
    const myVersion=++version;busy=true;plan=null;lastSpeech=null;syncSpeech();renderPlan();bubble('user',message);input.value='';
    controller=new AbortController();form.setAttribute('aria-busy','true');syncBusy();status('小猫正在听，也在想怎么陪你…');
    const timeout=setTimeout(()=>controller?.abort(),50000);
    try{
      const context=snapshot();const res=await fetch('/api/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history,context,memory}),signal:controller.signal});
      const data=await res.json();if(!res.ok)throw Error(data.message||'小猫暂时没收到回应，稍后再试试。');
      if(myVersion!==version)return;
      plan=P.normalizePlan(data.plan);planContext=context.scene;bubble('assistant',plan.reply);history=[...history,{role:'user',content:message},{role:'assistant',content:plan.reply}].slice(-8);renderPlan();
      lastSpeech=plan;
      status(describe(plan)||plan.interaction!=='keep'?'小猫的回应 · 采用后才会调整声音与风景':'小猫在听，你可以慢慢说。');
      if(plan.delivery.voice==='quiet')speechStatus.textContent='这句只留文字，小猫安静陪着你。';
      else if(autoSpeak&&!document.hidden&&document.hasFocus())speech.play(plan.reply,{cue:plan.delivery.cue});
    }catch(error){if(myVersion!==version)return;const text=error.name==='AbortError'?'这次回应等得有点久，原来的声音保持不变。':error.message;status(text);bubble('notice',text);input.value=message;voiceMode=false;syncVoiceMode();}
    finally{clearTimeout(timeout);if(myVersion===version){busy=false;controller=null;form.removeAttribute('aria-busy');syncBusy();syncSpeech();}}
  }
  async function apply(){
    if(!plan||applying||busy)return;
    if(snapshot().scene!==planContext){status('风景已经变了，再告诉我一次现在想怎么陪你吧。');return;}
    cancelVoice();speech.stop();applying=true;syncBusy();syncSpeech();$('companionApply').disabled=true;
    // Release the dialog's inert state before a city transition adds controls.
    for(const[node,value]of inert)node.inert=value;inert=[];
    try{
      const result=await hooks.apply(plan);$('companionApply').hidden=true;$('companionListen').hidden=result.playing;$('companionListen').textContent=plan.playback==='pause'?'想继续时再听':'听听这段';status(plan.playback==='pause'?'声音和计时已暂停，小猫还在这里。':result.playing?'安排已采用，声音继续陪你。':'安排已采用，点击“听听这段”开始声音。');
      bubble('notice',result.summary||'声音与风景已按这段安排调整。');planContext=snapshot().scene;
    }catch{status('这次没能完成调整，可以再试一次。');$('companionApply').disabled=false;}
    finally{applying=false;syncBusy();syncSpeech();if(!panel.hidden){inert=[...app.children].filter(x=>x!==panel).map(x=>[x,x.inert]);for(const[node]of inert)node.inert=true;}}
  }
  form.addEventListener('submit',e=>{e.preventDefault();send(input.value.trim())});
  $('companionApply').onclick=apply;
  $('companionListen').onclick=()=>{close();hooks.play();};
  $('companionRemember').onclick=()=>{
    if(!plan?.memory)return;const next=plan.memory;
    const updated=P.normalizeMemory({muted:[...new Set([...memory.muted,...next.muted])],scene:next.scene??memory.scene,music:next.music??memory.music});
    try{localStorage.setItem(memoryKey,JSON.stringify(updated));memory=updated;$('companionRemember').hidden=true;showMemory();status('已记在这台设备，下次对话时也会参考。');}
    catch{status('这台设备暂时无法保存，下次可以再告诉我。');}
  };
  $('companionForget').onclick=()=>{try{localStorage.removeItem(memoryKey);memory={muted:[],scene:null,music:null};showMemory();status('偏好已清除。');}catch{status('暂时无法清除，请检查浏览器存储权限。');}};
  $('companionClear').onclick=()=>{cancelVoice();speech.stop();lastSpeech=null;version++;controller?.abort();busy=false;history=[];plan=null;log.replaceChildren();bubble('assistant','我们从现在开始。想怎么待一会儿？');renderPlan();syncBusy();syncSpeech();form.removeAttribute('aria-busy');};
  $('companionClose').onclick=close;$('companionButton').onclick=open;
  for(const b of document.querySelectorAll('[data-companion-prompt]'))b.onclick=()=>{if(busy||applying)return;cancelVoice();voiceMode=false;input.value=b.dataset.companionPrompt;syncVoiceMode(true);};
  panel.addEventListener('click',e=>{if(e.target===panel)close()});
  panel.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
    if(e.key==='Tab'){const all=[...panel.querySelectorAll('button,input')].filter(x=>!x.disabled&&x.getClientRects().length),first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
  });
  window.addEventListener('garden:talk-to-cat',open);
  window.addEventListener('garden:session-ended',()=>{if(!panel.hidden)close();});
  return {open,close};
}
