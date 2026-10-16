// Run after starting a local server and isolated Chrome with a CDP port.
// GARDEN_CDP=http://127.0.0.1:9556 GARDEN_URL=http://127.0.0.1:8766/index.html node tests/browser-experience.mjs
import {mkdir,writeFile} from 'node:fs/promises';
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
 await call('Page.navigate',{url});await until("!!document.getElementById('needChoices')&&document.getElementById('app').dataset.session==='idle'");
 await evaluate("localStorage.clear()");await call('Page.reload');await until("document.getElementById('app')?.dataset.session==='idle'");await delay(1200);
 await evaluate("window.$=id=>document.getElementById(id);window.records=()=>JSON.parse(localStorage.getItem('sleepGarden.v1')).records;window.mix=()=>JSON.parse(localStorage.getItem('sleepGarden.v1')).mix;window.qaRenders=0;const renderWorld=GardenWorld.prototype.update;GardenWorld.prototype.update=function(...args){window.qaRenders++;return renderWorld.apply(this,args)};window.originalStart=SessionClock.prototype.start;SessionClock.prototype.start=function(...args){window.qaClock=this;return window.originalStart.apply(this,args)};");
 await check("mix().music>0&&!$('home').hidden&&$('app').dataset.audio!=='running'",'one-click recommendation includes music without autoplay');
 await shot('01-home-390');
 await click('[data-need="company"]');await click('#personalizeButton');await click('[data-environment="shared"]');await click('[data-device="headphones"]');await click('#beforeRating button:nth-child(2)');
 await check("document.querySelector('#beforeRating button:nth-child(2)').getAttribute('aria-pressed')==='true'&&mix().cat<=16",'optional baseline, shared room and headphone choices apply');await shot('02-personalize-390');
 await click('#confirmPlan');await click('#startButton');await until("$('app').dataset.audio==='running'");await check("$('app').classList.contains('night')&&qaClock.status==='playing'",'trusted start activates audio and night session');
 await click('#breathButton');await check("!$('restScreen').hidden&&!$('breathOrb').hidden&&$('controls').inert",'breathing surface isolates background controls');await shot('03-breath-390');const darkRenders=await evaluate('qaRenders');await delay(300);await check(`qaRenders===${darkRenders}`,'low-light listening stops hidden 3D rendering');
 await click('#restPause');await until("$('app').dataset.session==='paused'");const paused=await evaluate('qaClock.elapsed');await delay(600);await check(`qaClock.elapsed===${paused}`,'rest pause freezes playback clock and breathing phase');
 await click('#restPause');await until("$('app').dataset.session==='running'");await click('#skipBreathing');await check("$('breathOrb').hidden",'breathing can be skipped without stopping listening');
 await click('#restBack');await check("$('restScreen').hidden&&!$('controls').inert",'returning restores main controls');await delay(100);await check(`qaRenders>${darkRenders}`,'returning to the garden resumes rendering');
 await click('#finishButton');await until("!$('resultOverlay').hidden");await check("records().length===1&&records()[0].experience.before===2&&records()[0].experience.context.device==='headphones'",'ending records context and baseline once');
 await click('#experienceFeedback .rating-options button:nth-child(4)');await click('[data-intent="yes"]');await check("records()[0].experience.after===4&&records()[0].experience.returnIntent==='yes'",'result saves paired feeling and reuse intention');await shot('04-feedback-390');
 await click('#returnGarden');await click('#restartButton');await click('#startButton');await until("$('app').dataset.audio==='running'");
 await evaluate('qaClock.setTimer(.5,performance.now())');await until("!$('restScreen').hidden&&!$('restFeedback').hidden");
 await check("$('resultOverlay').hidden&&$('completionNotice').hidden&&records().length===2&&records()[1].experience.before===null",'expiry stays dim, creates one record and never copies the old baseline');await shot('05-quiet-ending-390');
 await call('Page.reload');await until("document.getElementById('app')?.dataset.session==='idle'");await evaluate("window.$=id=>document.getElementById(id)");
 await check("!$('pendingFeedback').hidden&&$('planTitle').textContent.includes('上次喜欢')",'next visit offers deferred feedback and reuses explicit positive preference');
 await click('#pendingFeedback');await check("!$('resultOverlay').hidden&&$('experienceFeedback').textContent.includes('未填写')",'deferred feedback does not fabricate a baseline');
 await click('#returnGarden');await click('#gardenButton');await check("$('feedbackSummary').textContent.includes('1 份前后感受')",'local summary exposes valid response denominators');
 await call('Page.reload');await until("document.getElementById('app')?.dataset.session==='idle'");
 for(const [width,height]of [[320,640],[1440,900]]){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await delay(400);await check("(()=>{const b=document.getElementById('homeDock').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1&&b.top>=0&&b.bottom<=innerHeight+1})()",`start dock fits ${width} by ${height}`);await shot('home-'+width);}
 if(errors.length)throw Error('Browser exceptions: '+errors.join(', '));
 await writeFile('build/product-qa/results.json',JSON.stringify({passed:passed.length,checks:passed,exceptions:errors},null,2));console.log(JSON.stringify({passed:passed.length,checks:passed},null,2));
}finally{ws.close()}
