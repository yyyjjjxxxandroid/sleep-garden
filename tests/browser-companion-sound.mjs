import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const tabs=await(await fetch('http://127.0.0.1:9558/json/list')).json();const ws=new WebSocket(tabs.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r));
let n=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const v=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async expr=>{for(let i=0;i<200;i++){if(await evaluate(expr))return;await wait(100);}throw Error('timeout '+expr);};
const point=async s=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(s)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
const mouse=async(type,p)=>call('Input.dispatchMouseEvent',{type,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,...p});
const click=async s=>{const p=await point(s);await mouse('mousePressed',p);await mouse('mouseReleased',p);};
const shot=async path=>{const s=await call('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(s.data,'base64'));};
await call('Runtime.enable');await call('Page.enable');
// Fifteen seconds of valid silent PCM isolate interaction tests from the TTS model.
const audio=Buffer.alloc(44+24000*2*15);audio.write('RIFF');audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(24000,24);audio.writeUInt32LE(48000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(audio.length-44,40);
const injected=await call('Page.addScriptToEvaluateOnNewDocument',{source:`
  localStorage.setItem('sleepGarden.companion.speak.v1','true');
  window.switchQA={calls:[],aborts:0,delay:false,quiet:false,aiDelay:0};
  const original=window.fetch;
  window.fetch=async(url,options)=>{
    if(url==='/api/companion'&&options?.method==='POST'){
      await new Promise(r=>setTimeout(r,switchQA.aiDelay));
      return new Response(JSON.stringify({plan:{reply:'今天先不用解释，也不用急着好起来。小猫就在这里，陪你慢慢歇一会儿。',delivery:{voice:switchQA.quiet?'quiet':'soft',cue:'none'},scene:'keep',mix:{},memory:null}}),{headers:{'Content-Type':'application/json'}});
    }
    if(url==='/api/companion/speech'&&options?.method==='POST'){
      switchQA.calls.push(JSON.parse(options.body));
      if(switchQA.delay)return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{switchQA.aborts++;reject(new DOMException('cancelled','AbortError'))},{once:true}));
      return new Response(Uint8Array.from(atob('${audio.toString('base64')}'),c=>c.charCodeAt(0)),{headers:{'Content-Type':'audio/wav'}});
    }
    return original(url,options);
  };
`});
await call('Page.navigate',{url:'http://127.0.0.1:8766/index.html?switch=qa'});await until("typeof document.querySelector('#homeCompanionButton')?.onclick==='function'");await click('#homeCompanionButton');
const checked=()=>evaluate("document.querySelector('#companionSpeakToggle').getAttribute('aria-checked')");
const send=async text=>{await evaluate(`document.querySelector('#companionInput').value=${JSON.stringify(text)};document.querySelector('#companionForm').requestSubmit()`);await until("!document.querySelector('#companionForm').hasAttribute('aria-busy')");};
assert.equal(await checked(),'false','legacy saved enabled flag must not turn sound on');
await send('今天有点累。');assert.equal(await evaluate('switchQA.calls.length'),0);assert.equal(await evaluate("document.querySelector('#companionSpeakReplay').disabled"),true);
await evaluate("document.querySelector('#companionSpeakReplay').onclick()");assert.equal(await evaluate('switchQA.calls.length'),0,'programmatic replay cannot bypass off');
await click('#companionSpeakToggle');assert.equal(await checked(),'true');assert.equal(await evaluate('switchQA.calls.length'),0,'enabling must not read an old reply');
await click('#companionSpeakReplay');await until("document.querySelector('#companionSpeechStatus').textContent==='小猫正轻声说给你听'");
await click('#companionSpeakToggle');assert.equal(await checked(),'false');assert.equal(await evaluate("document.querySelector('#companionSpeakStop').hidden"),true);assert.equal(await evaluate("document.querySelector('#companionSpeakReplay').disabled"),true);
await click('#companionSpeakToggle');await send('我想听你说。');await until("document.querySelector('#companionSpeechStatus').textContent==='小猫正轻声说给你听'");
await evaluate('switchQA.quiet=true');const count=await evaluate('switchQA.calls.length');await send('别说话，安静陪着我。');assert.equal(await evaluate('switchQA.calls.length'),count);assert.match(await evaluate("document.querySelector('#companionSpeechStatus').textContent"),/只留文字/);
await evaluate('switchQA.delay=true');await click('#companionSpeakReplay');await until("switchQA.calls.length>"+count);await click('#companionSpeakToggle');await until('switchQA.aborts===1');assert.equal(await checked(),'false');
await evaluate('switchQA.delay=false;switchQA.quiet=false;switchQA.aiDelay=400');await click('#companionSpeakToggle');
const before=await evaluate('switchQA.calls.length');await evaluate("document.querySelector('#companionInput').value='再聊聊';document.querySelector('#companionForm').requestSubmit()");await click('#companionSpeakToggle');await until("!document.querySelector('#companionForm').hasAttribute('aria-busy')");assert.equal(await evaluate('switchQA.calls.length'),before,'a reply arriving after switch-off cannot start synthesis');
for(const [width,height]of [[1100,850],[390,844],[320,568]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await wait(150);
  const layout=await evaluate("['#companionSpeakToggle','#companionSpeakReplay','#companionForm'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {s,x:r.x,y:r.y,w:r.width,h:r.height};})");
  assert.ok(layout.every(r=>r.x>=0&&r.x+r.w<=width&&r.y>=0&&r.y+r.h<=height),JSON.stringify(layout));assert.ok(layout[0].h>=44);assert.ok(layout[0].y<layout[2].y);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('/tmp/cat-sound-switch-'+width+'.png');console.log('LAYOUT',width,layout);
}
await click('#companionSpeakToggle');assert.equal(await checked(),'true');
await call('Page.reload');await until("typeof document.querySelector('#homeCompanionButton')?.onclick==='function'");await click('#homeCompanionButton');assert.equal(await checked(),'false','a reload must always default to silent');
await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
assert.deepEqual(errors,[]);console.log('PASS default-off with legacy preference, replay guard, explicit opt-in, no old-reply autoplay, toggle stops playback/pending synthesis, quiet request, late AI reply, 3 layouts, reload reset; audio and AI mocked.');ws.close();
