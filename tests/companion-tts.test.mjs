import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Plan from '../companion-plan.js';
import {createGardenServer} from '../server.mjs';
import {createCompanionTts} from '../companion-tts.mjs';

test('quiet plans cannot carry a meow, while invalid delivery fields are safe defaults',()=>{
  assert.deepEqual(Plan.normalizePlan({reply:'我在。',delivery:{voice:'quiet',cue:'meow'}}).delivery,{voice:'quiet',cue:'none'});
  assert.deepEqual(Plan.normalizePlan({reply:'我在。',interaction:'quiet',delivery:{voice:'soft',cue:'purr'}}).delivery,{voice:'quiet',cue:'none'});
  assert.deepEqual(Plan.normalizePlan({reply:'你好。',delivery:{voice:'evil',cue:'https://evil.invalid'}}).delivery,{voice:'soft',cue:'none'});
});

test('an absent local model is explicitly unavailable and invalid requests never spawn Python',async()=>{
  const tts=createCompanionTts({root:'/nonexistent-garden-test',env:{}});
  assert.equal(tts.available(),false);await assert.rejects(tts.synthesize({text:'你好'}),/speech_unavailable/);
  for(const input of [{text:''},{text:'x'.repeat(241)},{text:'你好',cue:'remote'}])await assert.rejects(tts.synthesize(input),/invalid_speech/);
  const abort=new AbortController();abort.abort();await assert.rejects(tts.synthesize({text:'你好'},abort.signal),/speech_interrupted/);tts.close();
});

test('local speech API returns private WAVs, rejects unsafe inputs and hides model/backend files',async t=>{
  const root=await mkdtemp(join(tmpdir(),'garden-speech-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'models'));await writeFile(join(root,'models','model.bin'),'PRIVATE MODEL');await writeFile(join(root,'companion-tts.mjs'),'PRIVATE BACKEND');
  let failure=null,calls=0,closed=false;const wav=Buffer.alloc(48);wav.write('RIFF');
  const speech={available:()=>true,close:()=>{closed=true},synthesize:async body=>{calls++;if(failure)throw Error(failure);assert.equal(body.text,'你好');return wav;}};
  const server=createGardenServer({root,speech});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const base='http://127.0.0.1:'+server.address().port,path=base+'/api/companion/speech';
  const post=body=>fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.deepEqual(await (await fetch(path+'/status')).json(),{available:true,engine:'kokoro-local'});
  let response=await post({text:'你好',cue:'none'});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'audio/wav');assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await response.arrayBuffer()),wav);
  for(const body of [null,{},[],{text:''},{text:'x'.repeat(241)},{text:'你好',cue:'remote'},{text:'x'.repeat(5000)}])assert.equal((await post(body)).status,400);
  assert.equal(calls,1,'invalid requests never reach inference');
  assert.equal((await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:'invalid JSON'})).status,400);
  assert.equal((await fetch(path,{method:'POST',body:'你好'})).status,415);
  assert.equal((await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://foreign.invalid'},body:'{}'})).status,403);
  for(const file of ['/models/model.bin','/companion-tts.mjs','/scripts/companion_tts_worker.py','/.venv-tts/pyvenv.cfg'])assert.equal((await fetch(base+file)).status,404);
  failure='speech_busy';assert.equal((await post({text:'你好'})).status,429);
  failure='speech_unavailable';assert.equal((await post({text:'你好'})).status,503);
  failure='PRIVATE PROVIDER DIAGNOSTIC';response=await post({text:'你好'});assert.equal(response.status,503);assert.ok(!(await response.text()).includes('PRIVATE'));
  await new Promise(r=>server.close(r));assert.equal(closed,true);
});

test('disconnecting while synthesis is pending aborts the inference request',async t=>{
  const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};};
  const aborted=deferred(),started=deferred();
  const speech={available:()=>true,close(){},synthesize:(_,signal)=>new Promise((_,reject)=>{started.resolve();signal.addEventListener('abort',()=>{aborted.resolve();reject(Error('speech_interrupted'));},{once:true});})};
  const server=createGardenServer({speech});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
  const controller=new AbortController();const response=fetch('http://127.0.0.1:'+server.address().port+'/api/companion/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'取消朗读'}),signal:controller.signal}).catch(e=>e);
  await started.promise;controller.abort();await response;await aborted.promise;
});
