// Run after starting a local server and isolated Chrome with a CDP port.
// GARDEN_CDP=http://127.0.0.1:9556 GARDEN_URL=http://127.0.0.1:8766/index.html node tests/browser-experience.mjs
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const endpoint=process.env.GARDEN_CDP||'http://127.0.0.1:9556';
const url=process.env.GARDEN_URL||'http://127.0.0.1:8766/index.html';
const tabs=await(await fetch(endpoint+'/json/list')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r));let seq=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await delay(100)}throw Error('Timeout: '+expression)}
const passed=[];async function check(expression,label){if(!await evaluate(expression))throw Error(label);passed.push(label)}
async function click(selector){const p=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});}
async function shot(name){await delay(500);const r=await call('Page.captureScreenshot',{format:'png'});await writeFile('build/product-qa/'+name+'.png',Buffer.from(r.data,'base64'));}
try{
 await mkdir('build/product-qa',{recursive:true});await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Page.navigate',{url});await until("document.getElementById('app')?.dataset.session==='idle'");
 await evaluate(`localStorage.clear();localStorage.setItem('sleepGarden.v1',JSON.stringify({records:[{id:1,type:'water',name:'水叶草',date:new Date().toISOString(),duration:60,complete:true,mix:{sun:0,wind:18,rain:0,bugs:5,cat:10,water:32,music:22},experience:{context:{need:'busy',environment:'quiet',device:'speaker',music:true},before:2,after:4,returnIntent:'yes'}}]}))`);
 await call('Page.reload');await until("document.getElementById('app')?.dataset.session==='idle'");await delay(800);
 await evaluate("window.$=id=>document.getElementById(id);const oldStart=SessionClock.prototype.start;SessionClock.prototype.start=function(...a){window.qaClock=this;return oldStart.apply(this,a)};const oldPlay=GardenAudio.prototype.play;GardenAudio.prototype.play=function(...a){window.qaAudio=this;return oldPlay.apply(this,a)};");
 await click('#startButton');await until("$('app').dataset.audio==='running'");
 await click('#gardenButton');await click('#records .record');await click('#recordFeedback');await click('#skipFeedback');
 await check("!$('controls').hidden&&$('app').dataset.session==='running'&&qaClock.status==='playing'",'closing historical feedback preserves the live session and its controls');
 await click('#gardenButton');await click('#records .record');await check("$('replayButton').disabled",'old-record replay is disabled while another session is active');
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await check("document.activeElement===$('gardenButton')&&!$('controls').inert",'closing nested record dialogs restores focus to the original opener');
 await click('#soundButton');await check("$('controls').inert&&document.querySelector('.scene').inert",'settings isolate background controls from keyboard and pointer input');
 await evaluate('qaClock.setTimer(.5,performance.now())');await until("!$('restFeedback').hidden&&!$('restScreen').hidden");
 await check("[...document.querySelectorAll('.overlay')].filter(e=>!e.hidden).length===1&&!$('restScreen').inert",'timer expiry dismisses an open settings sheet before showing quiet completion');
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await check("$('restScreen').hidden&&!$('gardenBottom').inert&&document.activeElement===$('restartButton')",'escape from quiet completion restores accessible garden controls');
 await click('#restartButton');await click('[data-need="sleepy"]');await click('#personalizeButton');await click('#includeMusic');await click('#confirmPlan');
 await check("$('app').dataset.session==='idle'&&$('planTitle').textContent.includes('30 分钟')&&JSON.parse(localStorage.getItem('sleepGarden.v1')).mix.music===0",'a second visit can choose a new state and opt out of music');
 await click('#environmentButton');await evaluate("$('windMotion').value='43';$('windMotion').dispatchEvent(new Event('input',{bubbles:true}))");await click('#soundOverlay .close-sheet');await click('#personalizeButton');await click('#beforeRating button:nth-child(3)');
 await check("JSON.parse(localStorage.getItem('sleepGarden.v1')).mix.wind===43",'answering the baseline question does not reset a manually tuned sound');await click('#confirmPlan');
 await evaluate("window.realResume=AudioContext.prototype.resume;AudioContext.prototype.resume=()=>Promise.reject(Error('QA unavailable'))");await click('#startButton');await until("$('app').dataset.audio==='unavailable'");
 await check("$('app').dataset.session==='paused'&&!$('playButton').disabled&&qaClock.elapsed===0",'audio activation failure preserves an enabled retry and zero elapsed time');
 await evaluate('AudioContext.prototype.resume=realResume');await click('#playButton');await until("$('app').dataset.audio==='running'");
 await check("qaAudio.ctx.state==='running'",'trusted retry recovers an audio activation failure');
 await click('#restButton');await evaluate("window.dispatchEvent(new Event('pagehide'))");await until("$('app').dataset.session==='paused'");
 const interrupted=await evaluate('qaClock.elapsed');await delay(400);await check(`qaClock.elapsed===${interrupted}&&$('restPause').textContent==='继续'`,'page interruption pauses sound and clock inside the low-light view');
 await click('#restPause');await until("$('app').dataset.session==='running'");await click('#restPause');await click('#restPause');await delay(500);
 await check("$('app').dataset.audio==='running'&&qaAudio.ctx.state==='running'",'rapid pause and resume cancels the delayed audio suspension');
 await click('#restPause');await evaluate("window.actualPlay=GardenAudio.prototype.play;GardenAudio.prototype.play=function(...args){return actualPlay.apply(this,args).then(result=>new Promise(resolve=>setTimeout(()=>resolve(result),200)))}");
 await click('#restPause');await check("$('app').dataset.session==='starting'",'delayed activation exposes a loading state');await evaluate("window.dispatchEvent(new Event('pagehide'))");await delay(500);
 await check("$('app').dataset.session==='paused'&&qaAudio.ctx.state!=='running'&&!$('restPause').disabled",'interruption during audio activation prevents a late promise from restarting playback');
 await evaluate('GardenAudio.prototype.play=actualPlay');await click('#restPause');await until("$('app').dataset.session==='running'");await click('#restBack');
 await evaluate("window.changes=0;window.chromeObserver=new MutationObserver(records=>window.changes+=records.length);chromeObserver.observe($('sessionStatus'),{subtree:true,childList:true,characterData:true})");await delay(500);await check("changes===0",'unchanged playback status is not repeatedly rebuilt or announced');await evaluate('chromeObserver.disconnect()');
 await click('#playButton');await click('#resetButton');await check("qaClock.elapsed===0&&$('app').dataset.session==='paused'",'reset remains paused and returns playback time to zero');
 await click('#finishButton');await until("!$('resultOverlay').hidden");await click('#skipFeedback');await click('#restartButton');
 for(const [width,height]of [[320,568],[844,390],[1440,900]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});await delay(400);
  await check("(()=>{const b=$('homeDock').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1&&b.top>=0&&b.bottom<=innerHeight+1})()",`home controls fit ${width} by ${height}`);
  await click('#personalizeButton');await shot('edge-settings-'+width);await click('#confirmPlan');
  await check("$('personalizeOverlay').hidden",`settings can be completed and dismissed at ${width} by ${height}`);
 }
 await call('Network.enable');await call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await call('Page.navigate',{url:pathToFileURL(resolve('index.html')).href});await until("document.getElementById('app')?.dataset.session==='idle'");await delay(800);
 await click('#startButton');await until("document.getElementById('app').dataset.audio==='running'");await check("location.protocol==='file:'&&document.querySelectorAll('.sound-slider').length===7",'standalone HTML starts all seven embedded channels without a server or network');
 await click('#playButton');await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 if(errors.length)throw Error('Browser exceptions: '+errors.join(', '));
 await writeFile('build/product-qa/edge-results.json',JSON.stringify({passed:passed.length,checks:passed,exceptions:errors},null,2));
 console.log(JSON.stringify({passed:passed.length,checks:passed},null,2));
}finally{ws.close()}
