const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {SessionClock}=require('../session-clock.js');
const html=fs.readFileSync(require('node:path').join(__dirname,'../source.html'),'utf8');
function fixture({records=[],timer=0,quiet=false}={}){
  let now=0,resting=false;const events=[],plants=[],results=[],beginnings=[],cues=[],elements=new Map(),storage=new Map();
  const state={mode:'home',playing:false,starting:false,records,seedChoice:'fern',elapsed:0,mix:{rain:80},replayPending:false};
  const clock=new SessionClock(timer);
  const context=vm.createContext({state,clock,performance:{now:()=>now},Event,window:{GARDEN_PLOT_COUNT:6,dispatchEvent:event=>events.push(event.type)},
    $:id=>{if(!elements.has(id))elements.set(id,{hidden:false,dataset:{},style:{},textContent:'',classList:{remove(){}},firstElementChild:{textContent:''},focus(){},setAttribute(){},removeAttribute(){},querySelectorAll:()=>[]});return elements.get(id)},localStorage:{setItem:(key,value)=>storage.set(key,value),getItem:key=>storage.get(key)||null},

    app:{dataset:{},classList:{contains:()=>resting}},document:{hidden:false,querySelectorAll:()=>[]},flowerCatalog:{fern:{name:'雨蕨'},bellflower:{name:'铃花'},waterleaf:{name:'水叶草'}},
    experience:{begin:mix=>beginnings.push(mix),attach(){},leaveRest(){},quietFinish:()=>quiet},
    worldEngine:{plantSeed:(...args)=>plants.push(args),clearSeedFeedback(){},updateGrowth(){}},
    syncClock:()=>{state.elapsed=clock.elapsed},normalizeMix:mix=>({...mix}),dominant:()=> 'rain',
    format:s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0'),
    createAudio:()=>({play:async valid=>valid(),plantGrowthCue:stage=>cues.push(stage),mix(){},pause(){},close(){}}),
    closeModal(){},renderPlots(){},showMode(){},updateSliders(){},toast(){},save(){},scheduleSessionEnd(){},clearTimeout(){},updateSessionChrome(){},
    showPlantResult:record=>results.push(record),console
  });
  vm.runInContext("let playbackVersion=0,audio,sessionEnded=false,lastStage='',sessionEndTimer;",context);
  const persist=html.slice(html.indexOf('function save(){'),html.indexOf('\nif(recoveredPlant)save();'));
  const persistGrowing=html.slice(html.indexOf('function persistGrowingPlant('),html.indexOf('\nfunction toast('));
  const recovery=html.slice(html.indexOf('function restorePendingPlant('),html.indexOf('\nconst recovered='));
  const stats=html.slice(html.indexOf('function gardenStats('),html.indexOf('\nfunction updateGardenStats()'));
  vm.runInContext(persist+'\n'+persistGrowing+'\n'+recovery+'\n'+stats,context);
  // Execute the production session handlers, replacing only rendering boundaries.
  let flow=html.slice(html.indexOf('async function start(mix)'),html.indexOf('function returnGarden()'));
  flow=flow.slice(0,flow.indexOf('function showPlantResult('))+flow.slice(flow.indexOf('function finish(){'));
  const helpers=html.slice(html.indexOf('function playPendingPlantCue()'),html.indexOf('function pauseForInterruption()'));
  const progress=html.slice(html.indexOf('function updateProgress(){'),html.indexOf('function setTimer('));
  const select=html.slice(html.indexOf('function selectSeed(type)'),html.indexOf("document.querySelectorAll('[data-seed]').forEach(b=>b.onclick"));
  vm.runInContext(helpers+'\n'+flow+'\n'+progress+'\n'+select,context);
  return {state,clock,plants,results,beginnings,cues,storage,events,stats:(records,seedPlanted)=>context.gardenStats(records,seedPlanted),restore:snapshot=>context.restorePendingPlant(snapshot),recover:(records,snapshot)=>context.recoverPendingPlant(records,snapshot),select:type=>context.selectSeed(type),start:()=>context.start(),pause:()=>context.pause(),reset:()=>context.resetSession(),finish:()=>context.finish(),progress:()=>context.updateProgress(),tick:()=>{clock.tick(now);context.syncClock()},time:ms=>{now=ms},rest:value=>{resting=value},hide:value=>{context.document.hidden=value}};
}
test('garden stats show planted seeds and completed healing sessions separately',()=>{
  const f=fixture({records:[{id:1,complete:true},{id:2,complete:false},{id:3}]});
  assert.deepEqual({...f.stats(f.state.records,false)},{planted:3,completed:1});
  assert.deepEqual({...f.stats(f.state.records,true)},{planted:4,completed:1});
  assert.deepEqual({...f.stats(null,true)},{planted:1,completed:0});
});
test('choosing a flower previews it; repeated start, pause, resume and reset plant once',async()=>{
  const f=fixture();f.select('bellflower');assert.equal(f.state.seedChoice,'bellflower');assert.equal(f.plants.length,0);
  await Promise.all([f.start(),f.start()]);assert.equal(f.plants.length,1);assert.deepEqual(f.plants[0],['bellflower',0]);
  f.select('waterleaf');assert.equal(f.state.seedChoice,'bellflower');
  f.time(10000);await f.pause();f.time(20000);await f.pause();f.reset();assert.equal(f.plants.length,1);assert.equal(f.clock.elapsed,0);assert.equal(f.state.playing,false);
});
test('finishing keeps flower choice, independent sound, partial growth and one record',async()=>{
  const f=fixture();f.select('waterleaf');await f.start();f.time(45000);f.finish();f.finish();
  assert.deepEqual(f.events,['garden:session-ended']);
  assert.equal(f.state.records.length,1);const r=f.state.records[0];assert.equal(r.type,'waterleaf');assert.equal(r.soundType,'rain');assert.equal(r.plantSize,.56);assert.equal(r.duration,45);assert.equal(r.complete,false);assert.equal(f.results.length,1);assert.equal(f.state.seedPlanted,false);
});
test('full gardens reserve the sixth slot and timed completion shows the plant result',async()=>{
  const f=fixture({records:Array.from({length:8},(_,id)=>({id,type:id%2?'rain':'bellflower'})),timer:60,quiet:true});
  await f.start();assert.equal(f.plants[0][1],5);f.time(70000);f.finish();assert.equal(f.state.records.length,9);assert.equal(f.state.records.at(-1).complete,true);assert.equal(f.state.records.at(-1).duration,60);assert.equal(f.results.length,1);assert.equal(f.state.mode,'home');
});
test('prepared replay still begins with replay metadata only after explicit start',async()=>{
  const f=fixture();f.state.replayPending=true;f.state.mix={water:41};assert.equal(f.plants.length,0);await f.start();assert.equal(f.beginnings[0].water,41);assert.equal(f.state.replayPending,false);assert.equal(f.plants.length,1);
});
test('planting and each growth phase cue once, and pauses stay quiet',async()=>{
  const f=fixture();await f.start();assert.deepEqual(f.cues,[0]);
  f.time(30000);f.tick();f.progress();f.progress();assert.deepEqual(f.cues,[0,1]);
  await f.pause();f.state.elapsed=f.clock.elapsed;f.progress();assert.deepEqual(f.cues,[0,1]);
  f.time(40000);await f.pause();f.progress();assert.deepEqual(f.cues,[0,1]);
  f.time(70000);f.tick();f.progress();assert.deepEqual(f.cues,[0,1,2]);
  f.time(100000);f.tick();f.progress();assert.deepEqual(f.cues,[0,1,2,3]);
});
test('rest and background growth remain silent without replaying skipped cues',async()=>{
  const f=fixture();await f.start();f.rest(true);f.time(30000);f.tick();f.progress();
  f.rest(false);f.progress();assert.deepEqual(f.cues,[0]);
  f.hide(true);f.time(60000);f.tick();f.progress();f.hide(false);f.progress();assert.deepEqual(f.cues,[0]);
  f.time(90000);f.tick();f.progress();assert.deepEqual(f.cues,[0,3]);
});
test('an in-progress seed is saved, restored once as a growing plant, and finalized without duplication',async()=>{
  const f=fixture();f.select('bellflower');await f.start();
  let stored=JSON.parse(f.storage.get('sleepGarden.v1'));
  assert.equal(stored.pendingPlant.seed,'bellflower');assert.equal(stored.pendingPlant.elapsed,0);assert.equal(stored.records.length,0);
  f.time(16000);f.tick();f.progress();stored=JSON.parse(f.storage.get('sleepGarden.v1'));
  assert.equal(stored.pendingPlant.elapsed,16);
  const recovered=f.restore(stored.pendingPlant);assert.equal(recovered.type,'bellflower');assert.equal(recovered.duration,16);assert.equal(recovered.interrupted,true);assert.ok(Math.abs(recovered.plantSize-(.12+16/90*.88))<1e-9);
  const reload=f.recover([],stored.pendingPlant);assert.equal(reload.records.length,1);assert.equal(reload.records[0].id,stored.pendingPlant.id);
  assert.equal(f.recover(reload.records,stored.pendingPlant).records.length,1,'reloading the same snapshot must not duplicate its plant');
  f.finish();stored=JSON.parse(f.storage.get('sleepGarden.v1'));assert.equal(stored.pendingPlant,null);assert.equal(stored.records.length,1);assert.equal(stored.records[0].type,'bellflower');
  assert.equal(f.restore({...stored.pendingPlant,elapsed:16}),null,'malformed snapshots are ignored');
});
