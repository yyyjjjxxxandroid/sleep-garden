// Requires npm start and an isolated Chrome with remote-debugging-port=9558.
// A generated audio track exercises the real MediaRecorder without a physical microphone.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const tab=await(await fetch('http://127.0.0.1:9558/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r));let n=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async expr=>{for(let i=0;i<220;i++){if(await ev(expr))return;await wait(100)}throw Error('timeout '+expr)};
const click=async s=>{await wait(350);await ev(`document.querySelector(${JSON.stringify(s)}).scrollIntoView({block:'nearest'})`);await wait(100);const p=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(s)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1})};
const touch=async()=>{await click('#petLauncher');await click('.pet-card[data-kind=ball]');await click('.pet-card[data-kind=pet]')};
const open=async()=>{await click('#petLauncher');await click('#petVoiceEntry');await until("!!document.querySelector('#petVoiceRecord')");await wait(350)};
const upload=async path=>{const {root}=await call('DOM.getDocument');const {nodeId}=await call('DOM.querySelector',{nodeId:root.nodeId,selector:'#petVoiceInput'});await call('DOM.setFileInputFiles',{nodeId,files:[path]})};
await call('Runtime.enable');await call('Page.enable');await call('Page.bringToFront');
const injection=await call('Page.addScriptToEvaluateOnNewDocument',{source:`
 window.voiceQA={mode:'tone',streams:[],contexts:[],delay:0,plays:0};
 navigator.mediaDevices.getUserMedia=async()=>{
  if(voiceQA.mode==='denied')throw new DOMException('denied','NotAllowedError');
  await new Promise(r=>setTimeout(r,voiceQA.delay));
  const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain(),destination=ctx.createMediaStreamDestination();
  osc.frequency.value=440;gain.gain.value=voiceQA.mode==='silent'?0:.18;osc.connect(gain).connect(destination);osc.start();await ctx.resume();
  voiceQA.streams.push(destination.stream);voiceQA.contexts.push(ctx);return destination.stream;
 };
`});
await call('Emulation.setDeviceMetricsOverride',{width:1100,height:850,deviceScaleFactor:1,mobile:false});
await call('Page.navigate',{url:'http://127.0.0.1:8766/index.html?pet-voice=qa'});await until("!!document.querySelector('#petLauncher')");await ev("localStorage.removeItem('sleep-garden-pet-voice-v1')");await call('Page.reload');await until("!!document.querySelector('#petLauncher')");
await ev("(()=>{const play=GardenAudio.prototype.playPetRecording;GardenAudio.prototype.playPetRecording=async function(v){const result=await play.call(this,v);if(result){voiceQA.plays++;voiceQA.engine=this}return result}})()");
await click('#startButton');await until("document.querySelector('#app').dataset.audio==='running'");await open();assert.equal(await ev("document.querySelector('#petVoiceApply').disabled"),true);
await ev("voiceQA.mode='denied'");await click('#petVoiceRecord');await until("document.querySelector('#petVoiceStatus').dataset.error==='true'");assert.match(await ev("document.querySelector('#petVoiceStatus').textContent"),/权限/);assert.equal(await ev("document.querySelector('#app').dataset.audio"),'paused');
await ev("voiceQA.mode='tone';voiceQA.delay=1000");await click('#petVoiceRecord');await click('#petVoiceCancel');await wait(1200);assert.equal(await ev("voiceQA.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))"),true,'late microphone permission cannot leave a live track');assert.equal(await ev("document.querySelector('#petVoiceRecord').getAttribute('aria-pressed')"),'false');
await ev('voiceQA.delay=0');await click('#petVoiceRecord');await until("document.querySelector('#petVoiceRecord').getAttribute('aria-pressed')==='true'");await wait(900);await click('#petVoiceRecord');await until("!document.querySelector('#petVoiceApply').disabled");assert.equal(await ev("voiceQA.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))"),true);
await click('#petVoicePreview');assert.equal(await ev("document.querySelector('#petVoicePreview').textContent"),'停止试听');await click('#petVoicePreview');assert.equal(await ev("document.querySelector('#petVoicePreview').textContent"),'试听');
for(const [width,height]of [[1100,850],[390,844],[320,568]]){
 await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await wait(300);
 const layout=await ev("['#petVoiceApply','#petVoiceReset'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})");
 assert.ok(layout.every(r=>r.x>=0&&r.x+r.w<=width+1&&r.y>=0&&r.y+r.h<=height+1),JSON.stringify(layout));assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true);
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/pet-voice-'+width+'.png',Buffer.from(shot.data,'base64'));console.log('LAYOUT',width,layout);
}
await click('#petVoiceApply');await until("document.querySelector('#petCareOverlay').hidden");assert.ok(await ev("JSON.parse(localStorage.getItem('sleep-garden-pet-voice-v1')).data.startsWith('data:audio/wav;base64,')"));
await click('#playButton');await until("document.querySelector('#app').dataset.audio==='running'");await touch();await until('voiceQA.plays===1');
await click('#playButton');await until("voiceQA.engine.petVoiceSource===null");await touch();await wait(400);assert.equal(await ev('voiceQA.plays'),1,'touch while paused stays silent');
await open();await ev("voiceQA.mode='silent'");await click('#petVoiceRecord');await wait(700);await click('#petVoiceRecord');await until("document.querySelector('#petVoiceStatus').dataset.error==='true'");assert.match(await ev("document.querySelector('#petVoiceStatus').textContent"),/听清/);assert.equal(await ev("document.querySelector('#petVoiceApply').disabled"),true,'silent retry retains the saved voice');
await ev("voiceQA.mode='tone'");await click('#petVoiceRecord');await until("document.querySelector('#petVoiceRecord').getAttribute('aria-pressed')==='true'");await click('.pet-panel-back');assert.equal(await ev("voiceQA.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))"),true,'leaving releases microphone');
await click('#petVoiceEntry');await click('#petVoiceRecord');await until("document.querySelector('#petVoiceRecord').getAttribute('aria-pressed')==='true'");await until("!document.querySelector('#petVoiceApply').disabled && document.querySelector('#petVoiceRecord').getAttribute('aria-pressed')==='false'");assert.ok(await ev("document.querySelector('.pet-voice-counter').textContent.includes('8.0')"),'automatic eight second cap');
await click('.pet-panel-back');await click('#petVoiceEntry');assert.equal(await ev("document.querySelector('#petVoiceApply').disabled"),true,'discarded new take does not replace saved audio');
const data=await ev("JSON.parse(localStorage.getItem('sleep-garden-pet-voice-v1')).data.split(',')[1]");await writeFile('/tmp/pet-voice-import.wav',Buffer.from(data,'base64'));await upload('/tmp/pet-voice-import.wav');await until("document.querySelector('#petVoiceStatus').textContent.includes('录好了')");
await call('Page.reload');await until("!!document.querySelector('#petLauncher')");await click('#startButton');await until("!document.querySelector('#petLauncher').hidden");await open();assert.equal(await ev("document.querySelector('#petVoicePreview').disabled"),false);assert.equal(await ev("document.querySelector('#petVoiceApply').disabled"),true);
await click('#petVoiceReset');await click('#petVoiceApply');assert.equal(await ev("localStorage.getItem('sleep-garden-pet-voice-v1')"),null);
await ev("Promise.all(voiceQA.contexts.map(c=>c.close()))");await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier});assert.deepEqual(errors,[]);
console.log('PASS real MediaRecorder, denial, pending cancellation, trimming, preview, layouts, live touch playback, pause guard, silence rejection, exit cleanup, 8-second cap, import, reload, reset; microphone source is synthetic.');
ws.close();await fetch('http://127.0.0.1:9558/json/close/'+tab.id);
