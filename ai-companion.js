function createAiCompanion(hooks){
  const $=id=>document.getElementById(id),P=window.CompanionPlan,app=$('app'),panel=$('companionOverlay'),log=$('companionLog'),form=$('companionForm'),input=$('companionInput');
  const memoryKey='sleepGarden.companion.preferences.v1';
  let memory={muted:[],scene:null,music:null},history=[],plan=null,planContext=null,controller=null,busy=false,applying=false,version=0,returnFocus=null,inert=[];
  function syncBusy(){$('companionSend').disabled=busy||applying;}
  try{memory=P.normalizeMemory(JSON.parse(localStorage.getItem(memoryKey)||'null'))}catch{}
  const snapshot=()=>hooks.snapshot();
  function bubble(role,text){const item=document.createElement('p');item.className='companion-bubble '+role;item.textContent=text;log.append(item);while(log.children.length>16)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;return item;}
  function status(text){$('companionStatus').textContent=text;$('companionStatus').hidden=!text;}
  function showMemory(){
    const names={sun:'鸟鸣',wind:'风声',rain:'雨声',bugs:'虫鸣',cat:'呼噜',water:'流水',footsteps:'猫咪脚步',chime:'风铃',music:'音乐'},scenes={garden:'花园',quanzhou:'泉州',guangzhou:'广州',shenzhen:'深圳'};
    const parts=[...memory.muted.map(k=>'不放'+names[k]),...(memory.scene?['偏爱'+scenes[memory.scene]]:[]),...(memory.music!==null?[memory.music?'喜欢轻音乐':'只听自然声']:[])];
    $('companionMemoryText').textContent=parts.length?'你让我记住的：'+parts.join('、'):'只记住你确认过的声音与场景偏好';$('companionForget').hidden=!parts.length;
  }
  async function check(){
    status('正在连接小猫…');
    try{const res=await fetch('/api/companion/status',{cache:'no-store'}),data=await res.json();status(data.configured?'':'AI 暂未连接，请稍后再试');$('companionConnection').hidden=true;}
    catch{status('AI 暂未连接，请稍后再试');$('companionConnection').hidden=true;}
  }
  function open(){
    if(!panel.hidden)return;
    hooks.leaveRest?.();returnFocus=document.activeElement;panel.hidden=false;
    inert=[...app.children].filter(x=>x!==panel).map(x=>[x,x.inert]);for(const[node]of inert)node.inert=true;
    if(!log.children.length)bubble('assistant','我在。想聊聊，还是让我帮你调调声音、天气和光线？');
    showMemory();check();input.focus({preventScroll:true});
  }
  function close(){
    if(applying)return;
    version++;controller?.abort();controller=null;busy=false;form.removeAttribute('aria-busy');syncBusy();
    panel.hidden=true;for(const[node,value]of inert)node.inert=value;inert=[];returnFocus?.isConnected&&returnFocus.focus({preventScroll:true});
  }
  const describe=p=>P.describePlan(p);
  function renderPlan(){
    const summary=plan&&describe(plan);$('companionPlan').hidden=!plan||(!summary&&!plan.memory&&plan.interaction==='keep');
    if(!plan)return;
    $('companionReason').textContent=plan.reason||'按你刚才说的，留一段舒服的声音。';
    $('companionChanges').textContent=summary||'保持当前声音，继续陪你聊聊。';
    $('companionApply').hidden=!summary&&plan.interaction==='keep';
    $('companionApply').textContent='应用调整';$('companionApply').disabled=false;
    $('companionRemember').hidden=!plan.memory;$('companionListen').hidden=true;
  }
  async function send(message){
    if(busy||applying||!message.trim())return;
    if(message.length>600){status('这句话有点长，缩短到 600 字以内吧。');return;}
    const myVersion=++version;busy=true;plan=null;renderPlan();bubble('user',message);input.value='';
    controller=new AbortController();form.setAttribute('aria-busy','true');syncBusy();status('小猫正在听，也在想怎么陪你…');
    const timeout=setTimeout(()=>controller?.abort(),50000);
    try{
      const context=snapshot();const res=await fetch('/api/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history,context,memory}),signal:controller.signal});
      const data=await res.json();if(!res.ok)throw Error(data.message||'小猫暂时没收到回应，稍后再试试。');
      if(myVersion!==version)return;
      plan=P.normalizePlan(data.plan);planContext=context.scene;bubble('assistant',plan.reply);history=[...history,{role:'user',content:message},{role:'assistant',content:plan.reply}].slice(-8);renderPlan();
      status('');
    }catch(error){if(myVersion!==version)return;const text=error.name==='AbortError'?'这次回应等得有点久，原来的声音保持不变。':error.message;status(text);bubble('notice',text);input.value=message;}
    finally{clearTimeout(timeout);if(myVersion===version){busy=false;controller=null;form.removeAttribute('aria-busy');syncBusy();}}
  }
  async function apply(){
    if(!plan||applying||busy)return;
    if(snapshot().scene!==planContext){status('风景已经变了，再告诉我一次现在想怎么陪你吧。');return;}
    applying=true;syncBusy();$('companionApply').disabled=true;
    // Release the dialog's inert state before a city transition adds controls.
    for(const[node,value]of inert)node.inert=value;inert=[];
    try{
      const result=await hooks.apply(plan);$('companionApply').hidden=true;$('companionListen').hidden=result.playing;$('companionListen').textContent=plan.playback==='pause'?'想继续时再听':'听听这段';status(plan.playback==='pause'?'声音和计时已暂停，小猫还在这里。':result.playing?'安排已采用，声音继续陪你。':'安排已采用，点击“听听这段”开始声音。');
      bubble('notice',result.summary||'声音与风景已按这段安排调整。');planContext=snapshot().scene;
    }catch{status('这次没能完成调整，可以再试一次。');$('companionApply').disabled=false;}
    finally{applying=false;syncBusy();if(!panel.hidden){inert=[...app.children].filter(x=>x!==panel).map(x=>[x,x.inert]);for(const[node]of inert)node.inert=true;}}
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
  $('companionClear').onclick=()=>{if(applying)return;version++;controller?.abort();busy=false;history=[];plan=null;log.replaceChildren();bubble('assistant','我们从现在开始。想怎么待一会儿？');renderPlan();syncBusy();form.removeAttribute('aria-busy');};
  $('companionClose').onclick=close;$('companionButton').onclick=open;
  for(const b of document.querySelectorAll('[data-companion-prompt]'))b.onclick=()=>{if(busy||applying)return;input.value=b.dataset.companionPrompt;input.focus({preventScroll:true});};
  panel.addEventListener('click',e=>{if(e.target===panel)close()});
  panel.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
    if(e.key==='Tab'){const all=[...panel.querySelectorAll('button,input,summary')].filter(x=>!x.disabled&&x.getClientRects().length),first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
  });
  window.addEventListener('garden:talk-to-cat',open);
  window.addEventListener('garden:session-ended',()=>{if(!panel.hidden)close();});
  return {open,close};
}
