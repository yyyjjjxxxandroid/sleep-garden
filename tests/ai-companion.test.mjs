import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Plan from '../companion-plan.js';
import * as T from '../vendor/three/build/three.module.js';
import {GardenCompanion} from '../garden-companion.js';
import {CityCompanions} from '../city-world.js';
import {askCompanion,readSettings} from '../ai-service.mjs';
import {createGardenServer,loadEnv} from '../server.mjs';

const settings={configured:true,model:'gpt-5.6-sol',base:'https://test.invalid/v1',key:'PRIVATE_TEST_KEY',mode:'responses'};
const upstream=plan=>async()=>new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(plan)}]}]}));
const reply={reply:'我陪你待一会儿。',reason:'留一点水声。',scene:'shenzhen',mix:{water:20,wind:8},memory:null};

test('teammates can load a private project .env without Codex credentials, preserving host overrides',async t=>{
 const root=await mkdtemp(join(tmpdir(),'garden-project-env-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const path=join(root,'.env');await writeFile(path,'AI_USE_CODEX_PROVIDER=false\nAI_BASE_URL=https://project.example/codex\nAI_MODEL=gpt-5.6-sol\nAI_WIRE_API=responses\nAI_API_KEY=PRIVATE_PROJECT_TEST_KEY\n');
 const env={};await loadEnv(path,env);const config=await readSettings(env);
 assert.deepEqual(config,{configured:true,base:'https://project.example/codex',model:'gpt-5.6-sol',mode:'responses',key:'PRIVATE_PROJECT_TEST_KEY'});
 const host={AI_API_KEY:'HOST_OVERRIDE'};await loadEnv(path,host);assert.equal((await readSettings(host)).key,'HOST_OVERRIDE');
 const absent={};await loadEnv(join(root,'missing.env'),absent);assert.equal((await readSettings(absent)).configured,false);
});

test('model plans cannot inject URLs, script, arbitrary actions, or excessive levels',()=>{
 const plan=Plan.normalizePlan({...reply,scene:'javascript:evil()',mood:'unknown',catAction:'eval',mix:{wind:999,water:-3,music:NaN,evil:50},memory:{muted:['sun','evil','sun'],scene:'remote',music:false}});
 assert.equal(plan.scene,'keep');assert.equal(plan.mood,'keep');assert.equal(plan.catAction,'keep');
 assert.deepEqual(plan.mix,{wind:60,water:0});assert.deepEqual(plan.memory,{muted:['sun'],scene:null,music:false});
 assert.throws(()=>Plan.normalizePlan({reply:''}));
});

test('Responses request uses the chosen 5.6 model, bounded history, and allowlisted context only',async()=>{
 let sent;
 const fetcher=async(url,options)=>{sent={url,options,body:JSON.parse(options.body)};return upstream(reply)()};
 const result=await askCompanion({message:'去深圳湾，风轻一点',history:Array.from({length:20},()=>({role:'user',content:'你好'})),context:{scene:'garden',mix:{wind:20,evil:10}},memory:{muted:['sun']}},settings,{fetcher});
 assert.equal(result.plan.scene,'shenzhen');assert.equal(sent.url,'https://test.invalid/v1/responses');assert.equal(sent.body.model,'gpt-5.6-sol');assert.equal(sent.body.store,false);assert.equal(sent.body.input.length,10);assert.ok(!JSON.stringify(sent.body).includes('evil'));assert.equal(sent.options.headers.Authorization,'Bearer PRIVATE_TEST_KEY');
});

test('failed, incomplete, or non-JSON model results never become executable plans',async()=>{
 for(const fetcher of [async()=>new Response('secret provider diagnostic',{status:401}),async()=>new Response(JSON.stringify({output_text:'hello'})),async()=>new Response(JSON.stringify({output_text:'{"mix":{"wind":3}}'}))]){
  await assert.rejects(askCompanion({message:'你好'},settings,{fetcher}),/credentials_rejected|invalid_response/);
 }
 await assert.rejects(askCompanion({message:'x'.repeat(601)},settings),/invalid_request/);
 const empty=await readSettings({});assert.equal(empty.configured,false);
});

test('local server protects credentials and static secrets and rejects foreign-origin requests',async t=>{
 const root=await mkdtemp(join(tmpdir(),'garden-ai-test-'));await writeFile(join(root,'index.html'),'garden');await writeFile(join(root,'.env'),'SECRET');await writeFile(join(root,'ai-service.mjs'),'SECRET');
 const server=createGardenServer({root,settings:async()=>settings,fetcher:upstream(reply)});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true})});
 const base='http://127.0.0.1:'+server.address().port;
 const status=await (await fetch(base+'/api/companion/status')).json();assert.deepEqual(status,{configured:true,model:'gpt-5.6-sol'});assert.ok(!JSON.stringify(status).includes(settings.key));
 for(const path of ['/.env','/.env.example','/ai-service.mjs','/server.mjs','/tests/a.js','/node_modules/a.js','/%2eenv'])assert.equal((await fetch(base+path)).status,404,path);
 assert.equal((await fetch(base+'/api/companion',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:JSON.stringify({message:'你好'})})).status,403);
 const hostile=await new Promise((resolve,reject)=>{const req=request(base+'/api/companion/status',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject);req.end()});assert.equal(hostile,403);
 const response=await fetch(base+'/api/companion',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({message:'去深圳湾'})});assert.equal(response.status,200);assert.equal((await response.json()).plan.scene,'shenzhen');
 const tooLarge=await fetch(base+'/api/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'x'.repeat(17000)})});assert.equal(tooLarge.status,400);
});

test('missing credentials remain clearly unavailable instead of returning simulated AI',async t=>{
 const server=createGardenServer({settings:async()=>({configured:false,model:'gpt-5.6-sol'})});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close()});
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'你好'})});assert.equal(response.status,503);const value=await response.json();assert.equal(value.error,'not_configured');assert.equal(value.plan,undefined);
});

test('city plans cannot silently accept nature tracks the city cannot actually play',async()=>{
 await assert.rejects(askCompanion({message:'加点鸟鸣',context:{scene:'shenzhen'}},settings,{fetcher:upstream({...reply,scene:'keep',mix:{sun:20}})}),/invalid_response/);
 const result=await askCompanion({message:'回花园听鸟鸣',context:{scene:'shenzhen'}},settings,{fetcher:upstream({...reply,scene:'garden',mix:{sun:20}})});assert.equal(result.plan.scene,'garden');
});


test('an AI rest request keeps both garden and city cats still until a direct interaction',()=>{
 const cat=new T.Group(),world={cat,state:{reduced:false},inPond:()=>false,groundHeight:()=>0,canvas:{dataset:{}},onExplore(){}};
 const garden=new GardenCompanion(world);garden.rest();
 for(let i=0;i<1800;i++)garden.update(1/30);
 assert.equal(garden.phase,'idle');assert.equal(garden.route.length,0);assert.equal(garden.quiet,true);
 garden.stop();assert.equal(garden.quiet,false);
 const city=new CityCompanions();city.playing=true;city.rest();const position=city.cat.position.clone();
 for(let i=0;i<1800;i++)city.update(1/30);
 assert.ok(city.cat.position.equals(position));assert.equal(city.action,null);
 city.goTo({x:0,z:4});assert.equal(city.resting,false);
});
