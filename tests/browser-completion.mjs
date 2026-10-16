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
 await call('Page.navigate',{url});await until("document.getElementById('app')?.dataset.session==='idle'");await evaluate("localStorage.clear()");await call('Page.reload');await until("document.getElementById('app')?.dataset.session==='idle'");await delay(800);
 await evaluate("window.$=id=>document.getElementById(id);window.saved=()=>JSON.parse(localStorage.getItem('sleepGarden.v1'));const oldStart=SessionClock.prototype.start;SessionClock.prototype.start=function(...args){window.qaClock=this;return oldStart.apply(this,args)};");
 await click('#startButton');await until("$('app').dataset.audio==='running'");await click('#soundButton');await evaluate("$('volume-water').value='41';$('volume-water').dispatchEvent(new Event('input',{bubbles:true}))");await click('#soundOverlay .close-sheet');
 const mix=await evaluate('JSON.stringify(saved().mix)'),timer=await evaluate('saved().timerSeconds');
 const point=await evaluate("(()=>{const b=$('finishButton').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()");
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await delay(1000);await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
 await evaluate("$('finishButton').onclick();$('finishButton').onclick()");await until("!$('resultOverlay').hidden");await check("saved().records.length===1",'holding End then repeating the action creates exactly one record');await click('#skipFeedback');
 await check("!$('gardenBottom').hidden&&!$('adjustTonight')&&$('gardenBottom').querySelectorAll(':scope > button').length===1",'completed garden has a single restart action');
 for(const [width,height,zoom]of [[390,844,1],[320,568,1],[844,390,1],[1440,900,1],[520,350,2]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:zoom,mobile:width<900});await delay(350);
  await check("(()=>{const summary=$('gardenSummary').getBoundingClientRect(),nav=document.querySelector('.region-nav').getBoundingClientRect(),cta=$('restartButton').getBoundingClientRect(),dock=$('gardenBottom').getBoundingClientRect();return summary.bottom+6<=nav.top&&nav.bottom+6<=cta.top&&dock.left>=0&&dock.right<=innerWidth+1&&dock.top>=0&&dock.bottom<=innerHeight+1})()",`summary, navigation and CTA do not overlap at ${width}x${height}, pixel ratio ${zoom}`);
  await click('button[data-region="meadow"]');await check("document.querySelector('button[data-region=meadow]').getAttribute('aria-pressed')==='true'",`scene navigation remains clickable at ${width}x${height}`);await shot(`completion-${width}-${zoom}`);
 }
 await evaluate("document.documentElement.style.zoom='1'");await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await click('#restartButton');await check(`!$('home').hidden&&$('app').dataset.session==='idle'&&JSON.stringify(saved().mix)===${JSON.stringify(mix)}&&saved().timerSeconds===${timer}`,'single restart returns to preparation while preserving sound and timer');
 await click('#startButton');await until("$('app').dataset.audio==='running'");await check(`JSON.stringify(saved().mix)===${JSON.stringify(mix)}&&qaClock.elapsed<3&&saved().records.length===1`,'starting again plays the retained mix with a fresh clock and no duplicate record');await click('#playButton');
 if(errors.length)throw Error('Browser exceptions: '+errors.join(', '));
 await writeFile('build/product-qa/completion-results.json',JSON.stringify({passed:passed.length,checks:passed,exceptions:errors},null,2));console.log(JSON.stringify({passed:passed.length,checks:passed},null,2));
}finally{ws.close()}
