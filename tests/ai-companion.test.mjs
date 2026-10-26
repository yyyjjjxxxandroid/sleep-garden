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

test('environment and timer plans are bounded deltas, special skies choose a compatible time',()=>{
 const p=Plan.normalizePlan({reply:'试试雨夜。',environment:{weather:'rain',wind:999,light:-2,fireflies:false,reduced:true,windLink:'true',evil:'script'},timerMinutes:20,delivery:{voice:'soft'}});
 assert.deepEqual(p.environment,{weather:'rain',wind:100,light:0,fireflies:false,reduced:true,windLink:false});
 assert.deepEqual(p.mix,{rain:35});assert.equal(p.timerMinutes,20);assert.equal('delivery' in p,false);
 for(const weather of ['aurora','meteor'])assert.equal(Plan.normalizePlan({reply:'夜空',mood:'day',environment:{weather}}).mood,'night');
 assert.equal(Plan.normalizePlan({reply:'彩虹',mood:'night',environment:{weather:'rainbow'}}).mood,'day');
 assert.equal(Plan.normalizePlan({reply:'晴夜',mood:'night',environment:{weather:'clear'}}).mood,'night');
 for(const timerMinutes of [-1,721,1.5,'20',Infinity])assert.equal(Plan.normalizePlan({reply:'好',timerMinutes}).timerMinutes,null);
 assert.equal(Plan.normalizePlan({reply:'好',timerMinutes:0}).timerMinutes,0);
 const local=Plan.normalizePlan({reply:'跟随本地',mood:'night',environment:{followLocal:true,weather:'snow',light:10}});assert.deepEqual(local.environment,{followLocal:true});assert.equal(local.mood,'keep');assert.deepEqual(local.mix,{});
 assert.deepEqual(Plan.normalizePlan({reply:'聊天',environment:{weather:'storm',light:'20',fireflies:'false'}}).environment,{});
});

test('adopting garden controls preserves unspecified settings and handles linked wind and rain overrides',()=>{
 const current={weather:'aurora',mood:'night',wind:35,windLink:true,light:40,fireflies:true,reduced:false,mix:{rain:0,wind:35,water:25,music:15}};
 const resolve=p=>Plan.resolveGardenSettings(current,Plan.normalizePlan({reply:'好',...p}));
 const untouched=resolve({});assert.deepEqual(untouched,current);assert.notEqual(untouched.mix,current.mix);
 assert.equal(resolve({mood:'day'}).weather,'clear');
 const rain=resolve({environment:{weather:'rain',wind:15,light:20},mix:{rain:0}});
 assert.equal(rain.mood,'night');assert.equal(rain.mix.rain,0);assert.equal(rain.wind,15);assert.equal(rain.windLink,false);assert.equal(rain.mix.wind,35);assert.equal(rain.mix.water,25);
 const linked=resolve({environment:{wind:100,windLink:true}});assert.equal(linked.wind,60);assert.equal(linked.mix.wind,60);
 const sound=resolve({mix:{wind:8},environment:{windLink:true}});assert.equal(sound.wind,8);assert.equal(sound.mix.wind,8);
 assert.deepEqual(current.mix,{rain:0,wind:35,water:25,music:15});
});

test('preview lists weather side effects, timing, motion and every executable sound channel',()=>{
 const p=Plan.normalizePlan({reply:'好',environment:{weather:'rain',light:25,fireflies:false,reduced:true},timerMinutes:20,mix:{footsteps:0,chime:10}});
 const label=Plan.describePlan(p);
 for(const fragment of ['细雨','细雨 35%','光照 25%','萤火虫关闭','减少动态','20 分钟','猫咪脚步 0%','风铃 10%'])assert.ok(label.includes(fragment),fragment);
});

test('model sees only allowlisted current controls and can return a real executable garden plan',async()=>{
 let context;
 const fetcher=async(_url,options)=>{const sent=JSON.parse(options.body);context=JSON.parse(sent.input[0].content.split('当前状态和用户已确认的偏好：')[1]).context;return upstream({reply:'把光线放柔些。',environment:{weather:'rain',light:20},mood:'night',timerMinutes:20})()};
 const {plan}=await askCompanion({message:'雨夜20分钟',context:{scene:'garden',mood:'day',playing:true,timerMinutes:30,environment:{weather:'clear',light:65,wind:35,windLink:true,fireflies:true,reduced:false,token:'PRIVATE'}}},settings,{fetcher});
 assert.equal(context.mood,'day');assert.equal(context.environment.light,65);assert.equal(context.environment.token,undefined);assert.equal(context.timerMinutes,30);assert.equal(plan.environment.weather,'rain');assert.equal(plan.timerMinutes,20);
});

test('city plans cannot claim to apply garden-only environment, day, or countdown controls',async()=>{
 for(const controls of [{environment:{weather:'rain'}},{environment:{light:20}},{timerMinutes:20},{mood:'day'},{mix:{chime:15}},{mix:{footsteps:10}}]){
  await assert.rejects(askCompanion({message:'调一下',context:{scene:'shenzhen'}},settings,{fetcher:upstream({reply:'好',scene:'keep',...controls})}),/invalid_response/);
  const {plan}=await askCompanion({message:'回花园调一下',context:{scene:'shenzhen'}},settings,{fetcher:upstream({reply:'回花园安排。',scene:'garden',...controls})});assert.equal(plan.scene,'garden');
 }
});

test('removed speech API is unavailable; text service remains usable',async t=>{
 const server=createGardenServer({settings:async()=>settings,fetcher:upstream({reply:'文字陪着你。'})});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close()});
 const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/api/companion/speech/status')).status,404);
 assert.equal((await fetch(base+'/api/companion/speech',{method:'POST',body:'{}'})).status,405);
 const res=await fetch(base+'/api/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'你好'})});assert.equal(res.status,200);assert.equal((await res.json()).plan.reply,'文字陪着你。');
});
