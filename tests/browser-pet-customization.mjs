// Browser smoke test: npm start plus an isolated Chrome CDP instance on port 9558.
// The synthetic image tests local color extraction; it is not a reconstructed pet.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const tab=await(await fetch('http://127.0.0.1:9558/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r));
let n=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async expr=>{for(let i=0;i<250;i++){if(await ev(expr))return;await wait(100)}throw Error('timeout '+expr)};
const click=async s=>{await wait(350);const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(s)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await wait(350);for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1})};
const upload=async path=>{const {root}=await call('DOM.getDocument');const {nodeId}=await call('DOM.querySelector',{nodeId:root.nodeId,selector:'#petPhotoInput'});await call('DOM.setFileInputFiles',{nodeId,files:[path]})};
const shot=async path=>{const r=await call('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(r.data,'base64'))};
const open=async()=>{await click('#petLauncher');await until("!document.querySelector('#petCareOverlay').hidden");await click('#petCustomizeEntry');await until("document.querySelector('.pet-custom-model img')?.naturalWidth>0");await wait(350)};
await call('Runtime.enable');await call('Page.enable');await call('Page.bringToFront');await call('Emulation.setDeviceMetricsOverride',{width:1100,height:850,deviceScaleFactor:1,mobile:false});
await call('Page.navigate',{url:'http://127.0.0.1:8766/index.html?pet-photo=qa'});
await until("!!document.querySelector('#petLauncher') && typeof document.querySelector('#startButton')?.onclick==='function'");
await ev("localStorage.removeItem('sleep-garden-pet-photo-v1')");await call('Page.reload');await until("!!document.querySelector('#petLauncher') && typeof document.querySelector('#startButton')?.onclick==='function'");
await click('#startButton');await until("!document.querySelector('#petLauncher').hidden");await open();
assert.equal(await ev("document.querySelector('#petPhotoApply').disabled"),true);
const original=await ev("document.querySelector('.pet-custom-model img').src");
await click('.pet-custom-presets button:nth-of-type(2)');await until("document.querySelector('.pet-custom-model img').src!=="+JSON.stringify(original));
await shot('/tmp/pet-photo-bicolor-desktop.png');
await click('.pet-panel-back');await click('#petCustomizeEntry');assert.equal(await ev("document.querySelector('#petPhotoApply').disabled"),true,'back discards preview');
assert.equal(await ev("document.querySelector('#petPhotoBase').value"),'#fff4e6');
const fixture=await ev("(()=>{const c=document.createElement('canvas');c.width=c.height=320;const x=c.getContext('2d');x.fillStyle='#209a35';x.fillRect(0,0,320,320);x.fillStyle='#d2995b';x.beginPath();x.ellipse(160,165,120,140,0,0,7);x.fill();x.fillStyle='#fff4df';x.fillRect(140,200,40,120);return c.toDataURL('image/png').split(',')[1]})()");
await writeFile('/tmp/pet-photo-fixture.png',Buffer.from(fixture,'base64'));await writeFile('/tmp/pet-photo-invalid.png','not an image');await writeFile('/tmp/pet-photo-invalid.txt','not an image');
await upload('/tmp/pet-photo-invalid.txt');await until("document.querySelector('.pet-custom-status').dataset.error==='true'");assert.match(await ev("document.querySelector('.pet-custom-status').textContent"),/JPG/);
await upload('/tmp/pet-photo-invalid.png');await until("document.querySelector('.pet-custom-status').dataset.error==='true' && !document.querySelector('.pet-photo-upload').disabled");assert.match(await ev("document.querySelector('.pet-custom-status').textContent"),/读出来/);
await upload('/tmp/pet-photo-fixture.png');await until("document.querySelector('.pet-custom-reference img').naturalWidth>0 && !document.querySelector('#petPhotoApply').disabled");assert.equal(await ev("document.querySelector('#petPhotoBase').value"),'#d2995b');
await ev("document.querySelector('#petPhotoName').value='团团';document.querySelector('#petPhotoName').dispatchEvent(new Event('input'));document.querySelector('#petPhotoPattern').value='tabby';document.querySelector('#petPhotoPattern').dispatchEvent(new Event('change'))");
for(const [width,height]of [[1100,850],[390,844],[320,568]]){
 await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await wait(250);
 const layout=await ev("(()=>{const b=document.querySelector('#petPhotoApply').getBoundingClientRect(),x=document.querySelector('#petPhotoReset').getBoundingClientRect(),s=document.querySelector('#petCareOverlay .sheet').getBoundingClientRect();return {button:{x:b.x,y:b.y,w:b.width,h:b.height},reset:{x:x.x,y:x.y,w:x.width,h:x.height},sheet:{x:s.x,y:s.y,w:s.width,h:s.height},overflow:document.documentElement.scrollWidth>innerWidth}})()");
 assert.equal(layout.overflow,false);for(const r of [layout.button,layout.reset,layout.sheet])assert.ok(r.x>=0&&r.x+r.w<=width+1&&r.y>=0&&r.y+r.h<=height+1,JSON.stringify(layout));assert.ok(layout.button.h>=44);console.log('LAYOUT',width,layout);
 await shot('/tmp/pet-photo-'+width+'.png');
}
await click('#petPhotoApply');await until("document.querySelector('#petCareOverlay').hidden");
let saved=await ev("JSON.parse(localStorage.getItem('sleep-garden-pet-photo-v1'))");assert.equal(saved.name,'团团');assert.equal(saved.pattern,'tabby');assert.ok(saved.photo.startsWith('data:image/jpeg;base64,'));
await call('Page.reload');await until("!!document.querySelector('#petLauncher') && typeof document.querySelector('#startButton')?.onclick==='function'");await click('#startButton');await until("!document.querySelector('#petLauncher').hidden");await open();assert.equal(await ev("document.querySelector('#petPhotoName').value"),'团团');assert.equal(await ev("document.querySelector('#petPhotoApply').disabled"),true);assert.ok(await ev("document.querySelector('.pet-custom-reference img').naturalWidth>0"));
await ev("(()=>{const original=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=async function(){await new Promise(r=>setTimeout(r,600));return original.call(this)}})()");
await upload('/tmp/pet-photo-fixture.png');await click('.pet-panel-back');await wait(350);await click('#petCustomizeEntry');await until("!!document.querySelector('#petPhotoApply')");await wait(900);assert.equal(await ev("document.querySelector('#petPhotoApply').disabled"),true,'cancelled async upload cannot mutate reopened editor');
await click('#petPhotoReset');assert.equal(await ev("document.querySelector('#petPhotoApply').disabled"),false);await click('#petPhotoApply');await until("document.querySelector('#petCareOverlay').hidden");assert.equal(await ev("localStorage.getItem('sleep-garden-pet-photo-v1')"),null);
await open();assert.equal(await ev("document.querySelector('#petPhotoBase').value"),'#fff4e6');assert.equal(await ev("document.querySelector('#petPhotoApply').disabled"),true);
assert.deepEqual(errors,[]);console.log('PASS upload, invalid/corrupt files, real coat preview, cancel, name/pattern, 3 layouts, save/reload, async cancel, reset; no uncaught errors');
ws.close();await fetch('http://127.0.0.1:9558/json/close/'+tab.id);
