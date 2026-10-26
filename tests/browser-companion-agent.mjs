// Run npm start and isolated Chrome with --remote-debugging-port=9558 first.
// AI plans are controlled fixtures; the real DOM, scene, sound and clock paths execute.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const tab=await(await fetch('http://127.0.0.1:9558/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r));
let n=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async expr=>{for(let i=0;i<300;i++){if(await ev(expr))return;await wait(100)}throw Error('timeout '+expr)};
const click=async selector=>{await ev(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);await wait(100);const p=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1})};
const send=async(plan,message='帮我调整一下')=>{await ev(`agentQA.next=${JSON.stringify({reply:'按你说的安排，采用后生效。',...plan})};document.querySelector('#companionInput').value=${JSON.stringify(message)}`);await click('#companionSend');await until("!document.querySelector('#companionForm').hasAttribute('aria-busy')");};
const apply=async()=>{await click('#companionApply');await until("document.querySelector('#companionApply').hidden");};
const state=()=>ev("(()=>{const a=document.querySelector('#app');return {weather:a.dataset.weather,night:a.classList.contains('night'),wind:a.dataset.wind,light:a.dataset.sunlight,playing:a.dataset.session,fireflies:document.querySelector('#fireflyToggle').getAttribute('aria-checked'),reduced:a.classList.contains('reduced'),timer:JSON.parse(localStorage.getItem('sleepGarden.v1')).timerSeconds,mix:JSON.parse(localStorage.getItem('sleepGarden.v1')).mix}})()");
try{
 await call('Runtime.enable');await call('Page.enable');await call('Page.bringToFront');
 const injection=await call('Page.addScriptToEvaluateOnNewDocument',{source:`
  localStorage.removeItem('sleepGarden.v1');localStorage.removeItem('sleepGarden.tonight.v1');
  window.agentQA={next:null,requests:[],speech:0,mic:0};
  navigator.mediaDevices.getUserMedia=async()=>{agentQA.mic++;throw Error('chat must not use microphone')};
  navigator.geolocation.getCurrentPosition=(_ok,fail)=>fail({code:1});
  const interval=window.setInterval;window.setInterval=(fn,ms,...args)=>{if(ms===15000)agentQA.tick=fn;return interval(fn,ms,...args)};
  const original=window.fetch;window.fetch=async(url,options)=>{
   if(String(url).startsWith('/api/companion/speech'))agentQA.speech++;
   if(url==='/api/companion'&&options?.method==='POST'){agentQA.requests.push(JSON.parse(options.body));return new Response(JSON.stringify({plan:agentQA.next}),{headers:{'Content-Type':'application/json'}})}
   return original(url,options);
  };
 `});
 await call('Page.navigate',{url:'http://127.0.0.1:8766/index.html?agent=qa'});
 await until("typeof document.querySelector('#companionButton')?.onclick==='function' && !!document.querySelector('#petLauncher')");
 await click('#companionButton');assert.equal(await ev("document.querySelectorAll('#companionHold,#companionInputToggle,#companionSpeakToggle,#companionSpeakReplay').length"),0);
 assert.equal(await ev("document.activeElement.id"),'companionInput');
 const before=await state();
 await send({mood:'night',environment:{weather:'rain',wind:20,light:25,fireflies:false,reduced:true},timerMinutes:20,mix:{sun:0,footsteps:0,chime:0}});
 assert.deepEqual(await state(),before,'preview must not change garden');
 assert.match(await ev("document.querySelector('#companionChanges').textContent"),/细雨 35%/);
 await apply();let s=await state();assert.equal(s.weather,'rain');assert.equal(s.night,true);assert.equal(s.wind,'20');assert.equal(s.light,'25');assert.equal(s.fireflies,'false');assert.equal(s.reduced,true);assert.equal(s.timer,1200);assert.equal(s.mix.sun,0);assert.equal(s.mix.rain,35);assert.equal(s.mix.footsteps,0);assert.equal(s.mix.chime,0);assert.equal(s.playing,'idle');
 await ev('agentQA.tick()');assert.deepEqual(await state(),s,'local update must not overwrite manual environment');
 assert.equal(await ev("document.querySelector('#companionOverlay').hidden"),false,'setting timer must not close chat');
 await send({});assert.equal(await ev('agentQA.requests.at(-1).context.environment.light'),25);assert.equal(await ev('agentQA.requests.at(-1).context.timerMinutes'),20);assert.equal(await ev("document.querySelector('#companionPlan').hidden"),true);assert.deepEqual(await state(),s,'ordinary conversation leaves environment unchanged');
 await send({environment:{weather:'clear'}});await apply();s=await state();assert.equal(s.night,true,'clear skies must preserve night');assert.equal(s.mix.rain,0);
 await send({mood:'day',environment:{weather:'aurora'}});await apply();s=await state();assert.equal(s.weather,'aurora');assert.equal(s.night,true);
 await send({mood:'day'});await apply();s=await state();assert.equal(s.weather,'clear');assert.equal(s.night,false);
 await send({mood:'night',environment:{weather:'rainbow'}});await apply();assert.equal((await state()).night,false);
 await send({environment:{followLocal:true}});await apply();assert.equal((await state()).light,before.light);assert.equal((await state()).weather,before.weather);
 await click('#companionClose');await click('#startButton');await until("document.querySelector('#app').dataset.session==='running'");await wait(1300);
 await click('#companionButton');await send({playback:'pause',timerMinutes:2});await apply();s=await state();assert.equal(s.playing,'paused');assert.equal(s.timer,120);assert.notEqual(await ev("document.querySelector('#elapsed').textContent"),'00:00','timer change must preserve elapsed');
 const elapsed=await ev("document.querySelector('#elapsed').textContent");await wait(1000);assert.equal(await ev("document.querySelector('#elapsed').textContent"),elapsed,'paused countdown stays paused');
 await send({timerMinutes:0});await apply();assert.equal((await state()).timer,0);
 await click('#companionClose');await click('#playButton');await until("document.querySelector('#app').dataset.session==='running'");
 await click('#companionButton');await send({mix:{wind:10},environment:{windLink:true}});await apply();assert.equal((await state()).playing,'running');assert.equal((await state()).wind,'10');assert.equal((await state()).mix.wind,10);
 // Exercise actual city transition and back-to-garden actions through the same chat.
 await send({scene:'shenzhen',mood:'night',mix:{water:20,wind:10}});await apply();assert.equal(await ev('CityPrototype.snapshot.scene'),'shenzhen');assert.equal(await ev('CityPrototype.snapshot.active'),true);
 await send({scene:'garden',mood:'night',environment:{weather:'rain',light:20},timerMinutes:15});await apply();assert.equal(await ev('CityPrototype.snapshot.active'),false);assert.equal((await state()).weather,'rain');assert.equal((await state()).timer,900);
 await send({environment:{weather:'snow',light:30},timerMinutes:30});
 for(const [width,height]of [[1100,850],[390,844],[320,568]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await wait(250);
  await ev("document.querySelector('#companionForm').scrollIntoView({block:'nearest'})");
  const boxes=await ev("['companionInput','companionSend'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})");
  assert.ok(boxes[0].right<=boxes[1].left&&boxes.every(r=>r.left>=0&&r.right<=width&&r.top>=0&&r.bottom<=height),'text form visible without overlap '+JSON.stringify(boxes));
  const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/companion-agent-'+width+'.png',Buffer.from(shot.data,'base64'));
 }
 assert.equal(await ev('agentQA.mic'),0);assert.equal(await ev('agentQA.speech'),0);assert.deepEqual(errors,[]);
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier});
 console.log('PASS text-only chat; preview/apply; weather/time/light/wind/mix; local override; elapsed/paused timers; city roundtrip; three layouts; zero microphone or speech requests.');
}finally{ws.close();await fetch('http://127.0.0.1:9558/json/close/'+tab.id);}
