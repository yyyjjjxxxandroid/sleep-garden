function createGardenExperience(hooks){
 const {state,clock,save,modal,closeModal,pause,setNight,updateEnvironment,changedMix,syncClock,updateProgress,showPlantResult,toast}=hooks;
 const $=id=>document.getElementById(id),P=GardenPersonalization;
 let stored={};try{stored=JSON.parse(localStorage.getItem('sleepGarden.tonight.v1')||'{}')||{}}catch{}
 let context=P.context(stored),before=null,plan,active=null,replayRecord=null,rest=false,breathingAt=null,lastPhase='',finishedRecord=null;
 const store=()=>{try{localStorage.setItem('sleepGarden.tonight.v1',JSON.stringify(context))}catch{toast('浏览器暂时无法保存偏好，本次仍可使用。')}};
 function ratings(root,value,onChange){
  root.replaceChildren();
  P.levels.forEach((label,i)=>{const b=document.createElement('button');b.textContent=String(i+1);b.title=label;b.setAttribute('aria-label',`${i+1}，${label}`);b.setAttribute('aria-pressed',String(value===i+1));b.onclick=()=>{onChange(value===i+1?null:i+1);document.getElementById(root.id)?.querySelectorAll('button')[i]?.focus()};root.append(b)});
  const legend=document.createElement('p');legend.className='rating-legend';legend.textContent='1 很紧绷 — 5 很放松 · 再点可取消';root.append(legend);
 }
 function renderBefore(){ratings($('beforeRating'),before,n=>{before=n;renderBefore()})}
 function refresh(changeTimer=false,preserveMix=false){
  plan=P.recommend(context,state.records);if(preserveMix){plan.mix={...state.mix};plan.remembered=false;plan.retained=true;plan.reason='保留了你刚才的声音和时长。可以直接开始，也可以按现在的感受换一种。'}else state.mix={...plan.mix};state.wind=state.mix.wind;
  if(changeTimer){clock.setTimer(plan.minutes*60,performance.now());syncClock();}
  updateEnvironment();changedMix();updateProgress();
  updatePlanLabel();$('planHeading').textContent=plan.title;$('planReason').textContent=plan.reason;
  $('recommendation').textContent=context.music?'轻音乐 · 自然声 · 小猫陪伴':'自然声 · 小猫陪伴';
  document.querySelectorAll('[data-need]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.need===context.need)));
  for(const key of ['environment','device'])document.querySelectorAll(`[data-${key}]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===context[key])));
  $('includeMusic').checked=context.music;
  renderBefore();store();
 }
 document.querySelectorAll('[data-need]').forEach(b=>b.onclick=()=>{context.need=b.dataset.need;refresh(true)});
 for(const key of ['environment','device'])document.querySelectorAll(`[data-${key}]`).forEach(b=>b.onclick=()=>{context[key]=b.dataset[key];refresh(false)});
 $('includeMusic').onchange=e=>{context.music=e.target.checked;refresh(false)};
 $('personalizeButton').onclick=()=>modal('personalizeOverlay');$('confirmPlan').onclick=closeModal;
 // This is a new session baseline, never copied from a previous listening record.
 function begin(mix){
  leaveRest(false);finishedRecord=null;
  const c=replayRecord?.experience?.context;
  active={context:mix?(c?P.context(c):null):{...context},before:mix?null:before,after:null,returnIntent:null,recipe:mix?'replay':plan.title,startedAt:new Date().toISOString(),feedbackTiming:null};
  if(!mix){$('stageText').textContent=plan.line;}
  replayRecord=null;before=null;renderBefore();
 }
 function attach(record){record.experience={...active,context:active?.context?{...active.context}:null};}
 const siblings=()=>[...$('app').children].filter(x=>x!==$('restScreen'));
 let previousInert=[],returnFocus=null;
 function enterRest(breathing=false){
  if(state.mode!=='session'&&!finishedRecord)return;
  if(!rest){returnFocus=document.activeElement;closeModal(false);previousInert=siblings().map(el=>[el,el.inert]);for(const[el]of previousInert)el.inert=true;}
  rest=true;$('restScreen').hidden=false;$('app').classList.add('resting');
  breathingAt=breathing?clock.elapsed:null;lastPhase='';sync();$('restPause').hidden?$('restBack').focus():$('restPause').focus();
 }
 function leaveRest(restoreFocus=true){
  if(!rest)return;
  rest=false;breathingAt=null;$('restScreen').hidden=true;$('app').classList.remove('resting');
  for(const[el,value]of previousInert)el.inert=value;previousInert=[];
  if(restoreFocus){const target=returnFocus?.isConnected&&!returnFocus.closest('[hidden]')?returnFocus:$(state.mode==='garden'?'restartButton':state.mode==='session'?'restButton':'startButton');target?.focus()}
 }
 function prepare(){before=null;if(active?.context)context=P.context(active.context);refresh(false,true);pending()}
 function updatePlanLabel(){if(!plan)return;const text=plan.title+(plan.retained?' · 保留配方':plan.remembered?' · 上次喜欢':'')+' · '+(state.timerSeconds?Math.round(state.timerSeconds/60)+' 分钟':'不限时');if($('planTitle').textContent!==text)$('planTitle').textContent=text;}
 function textIfChanged(id,value){if($(id).textContent!==value)$(id).textContent=value}
 function sync(){
  updatePlanLabel();
  if(!rest)return;
  const done=!!finishedRecord,playing=state.playing&&!state.starting;
  textIfChanged('restTitle',done?'今晚的声音，轻轻停下了':'可以闭上眼睛了');
  const status=done?'不用现在回应。等你愿意时，再告诉花园。':state.starting?'正在准备声音…':$('app').dataset.audio==='unavailable'?'声音暂时没能开启，请点继续重试。':playing?'声音在陪你，不必盯着时间。':'声音和计时已暂停，轻点继续。';
  if($('restStatus').textContent!==status)$('restStatus').textContent=status;
  $('restPause').hidden=done;$('restPause').disabled=state.starting;textIfChanged('restPause',playing?'暂停':'继续');$('restFeedback').hidden=!done;
  const elapsed=breathingAt===null?60:Math.max(0,clock.elapsed-breathingAt),guiding=!done&&elapsed<60;
  $('skipBreathing').hidden=!guiding;$('breathOrb').hidden=!guiding;
  let cue='按你舒服的节奏呼吸就好';
  if(guiding){const phase=elapsed%10;cue=!playing?'先停一会儿，按自己的节奏呼吸':phase<4?'轻轻吸气':'慢慢呼气';const scale=phase<4 ? .82+.18*(phase/4):1-.18*((phase-4)/6);$('breathOrb').style.transform=`scale(${state.reduced?1:scale})`;}
  else if(breathingAt!==null){cue='这一分钟已经结束，接下来按自己的节奏就好。';}
  if(cue!==lastPhase){$('breathCue').textContent=cue;lastPhase=cue;}
 }
 function quietFinish(record){
  if(!record.experience)return false;
  finishedRecord=record;record.experience.deferred=true;
  $('completionNotice').hidden=true;$('toast').hidden=true;enterRest(false);pending();return true;
 }
 $('restButton').onclick=()=>enterRest(false);$('breathButton').onclick=()=>enterRest(true);
 $('restPause').onclick=pause;$('restBack').onclick=()=>leaveRest();$('skipBreathing').onclick=()=>{breathingAt=null;sync()};
 $('restFeedback').onclick=()=>{const r=finishedRecord;leaveRest(false);showPlantResult(r)};
 $('restScreen').addEventListener('click',e=>{if(e.target===$('restScreen')){e.stopImmediatePropagation();}},true);
 function renderFeedback(record){
  const root=$('experienceFeedback');root.replaceChildren();$('feedback').hidden=!!record.experience;$('feedback').previousElementSibling.hidden=!!record.experience;if(!record.experience)return;
  const x=record.experience;
  const label=document.createElement('p');label.textContent='回想这段陪伴结束时，你有多放松？';root.append(label);
  const options=document.createElement('div');options.id='afterRating';options.className='rating-options';options.setAttribute('role','group');options.setAttribute('aria-label','结束时的放松程度');root.append(options);
  const recordChange=()=>{x.feedbackTiming=Date.now()-Date.parse(record.date)>3600000?'later':'same-session';x.respondedAt=new Date().toISOString();save();pending();renderFeedback(record)};
  ratings(options,P.rating(x.after),value=>{x.after=value;recordChange()});
  const prior=document.createElement('p');prior.className='muted-help';prior.textContent=P.rating(x.before)!==null?`开始前：${x.before} / 5${P.rating(x.after)!==null?' · 结束时：'+x.after+' / 5':''}`:'未填写开始前感受，不计算前后变化。';root.append(prior);
  const question=document.createElement('p');question.textContent='下次状态相近时，还想听这段吗？';root.append(question);
  const group=document.createElement('div');group.className='feedback';group.setAttribute('role','group');group.setAttribute('aria-label','再次使用意愿');
  for(const[key,text]of [['yes','愿意'],['maybe','再看看'],['no','想换一种']]){const b=document.createElement('button');b.textContent=text;b.dataset.intent=key;b.setAttribute('aria-pressed',String(x.returnIntent===key));b.onclick=()=>{x.returnIntent=x.returnIntent===key?null:key;recordChange();document.querySelector('[data-intent="'+key+'"]')?.focus()};group.append(b);}root.append(group);
 }
 function pending(){const r=[...state.records].reverse().find(r=>r.experience?.deferred&&P.rating(r.experience.after)===null&&!r.experience.returnIntent);$('pendingFeedback').hidden=!r;$('pendingFeedback').onclick=()=>showPlantResult(r);}
 function summary(){const n=P.summarize(state.records);$('feedbackSummary').textContent=`本机 ${n.sessions} 次体验 · ${n.paired} 份前后感受${n.paired?'，平均变化 '+(n.meanChange>=0?'+':'')+n.meanChange.toFixed(1)+' / 5':''} · ${n.intentResponses} 份再听意愿中 ${n.yes} 份愿意。仅为自报体验，不代表睡眠改善。`;}
 $('recordFeedback').onclick=()=>showPlantResult(state.selected);
 $('exportFeedback').onclick=()=>{const output={version:1,exportedAt:new Date().toISOString(),note:'本机自报体验。没有记录即没有测量，不推断睡眠或临床效果。',summary:P.summarize(state.records),records:state.records.map(({growth,...r})=>r)};const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='眠境花园-本机体验记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 refresh(!Number.isInteger(hooks.savedTimer));pending();
 return {prepare,begin,attach,renderFeedback,summary,sync,leaveRest,quietFinish,replay:record=>{replayRecord=record}};
}
