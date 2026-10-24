const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const E=require('../garden-environment.js');
const noon=Date.parse('2026-10-23T04:00:00Z');
const weather=(code=61,timezone='Asia/Shanghai')=>({timezone,current:{weather_code:code,is_day:1},daily:{sunrise:[1792706400],sunset:[1792749600]}});
function fixture({geolocation,fetch,cache,timezone='Asia/Shanghai'}={}){
  const storage=new Map(cache?[[E.CACHE_KEY,JSON.stringify(cache)]]:[]),events=[],intervals=[];
  let at=noon;
  const env=E.create({now:()=>at,timezone,geolocation,fetch,storage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},onChange:e=>events.push(e),setInterval:(fn,ms)=>{intervals.push({fn,ms});return intervals.length},clearInterval(){}});
  return {env,storage,events,intervals,time(value){at=value}};
}
const position={latitude:23.13,longitude:113.26};
const geo={getCurrentPosition:ok=>ok({coords:position})};
const reply=data=>({ok:true,json:async()=>data});

test('the same instant has different local clocks, including date rollover',()=>{
  assert.equal(E.localClock(noon,'Asia/Shanghai').text,'12:00');
  assert.equal(E.localClock(noon,'Asia/Tokyo').text,'13:00');
  assert.equal(E.localClock(noon,'America/Los_Angeles').date,'2026-10-22');
  assert.equal(E.localClock(Date.parse('2026-10-23T23:00:00Z'),'Asia/Tokyo').date,'2026-10-24');
});
test('sunrise and sunset produce continuous dawn, daylight, dusk and night',()=>{
  const phase=h=>E.daylight(Date.parse('2026-10-23T'+String(h).padStart(2,'0')+':00:00Z'),'UTC');
  assert.equal(phase(6).phase,'黎明');assert.equal(phase(12).phase,'正午');assert.equal(phase(18).phase,'黄昏');assert.equal(phase(23).phase,'深夜');
  assert.equal(phase(12).night,0);assert.equal(phase(23).night,1);assert.ok(phase(18).warmth>.9);
  const sunset=Date.parse('2026-10-23T18:00:00Z');
  assert.ok(Math.abs(E.daylight(sunset-1000,'UTC').night-E.daylight(sunset+1000,'UTC').night)<.001);
  const solar=[{rise:Date.parse('2026-10-23T08:00:00Z'),set:Date.parse('2026-10-23T16:00:00Z')}];
  assert.equal(E.daylight(Date.parse('2026-10-23T17:00:00Z'),'UTC',solar).night,1);
  assert.equal(E.daylight(Date.parse('2026-10-24T17:00:00Z'),'UTC',solar).night,0,'old solar dates must not control a new day');
});
test('weather mapping separates rain, snow and fog without triggering fantasy effects',()=>{
  assert.equal(E.weatherForCode(0).kind,'clear');assert.equal(E.weatherForCode(3).cloud,1);
  assert.equal(E.weatherForCode(61).kind,'rain');assert.equal(E.weatherForCode(95).kind,'rain');
  assert.equal(E.weatherForCode(71).kind,'snow');assert.equal(E.weatherForCode(71).rain,0);assert.equal(E.weatherForCode(45).kind,'fog');
  for(let code=0;code<100;code++)assert.ok(['clear','cloudy','rain','snow','fog'].includes(E.weatherForCode(code).kind));
});
test('live weather resolves independently of optional city lookup and stores a usable snapshot',async()=>{
  const requests=[];
  const f=fixture({geolocation:geo,fetch:async url=>{requests.push(url);return reply(url.includes('bigdatacloud')?{city:'广州市'}:weather())}});
  await f.env.refresh();
  const last=f.events.at(-1);assert.equal(last.source,'live');assert.equal(last.city,'广州市');assert.equal(last.time,'12:00');assert.equal(last.weather.kind,'rain');
  assert.equal(requests.length,2);assert.ok(E.validSnapshot(JSON.parse(f.storage.get(E.CACHE_KEY))));
  await f.env.refresh();assert.equal(requests.length,2,'fresh nearby observations should be cached');
});
test('denied location keeps a cached environment and makes no network requests',async()=>{
  const cached=E.readWeather(weather(),position,noon,'广州');let calls=0;
  const f=fixture({cache:cached,geolocation:{getCurrentPosition:(_ok,bad)=>bad({code:1})},fetch:async()=>{calls++;throw Error('must not call')}});
  f.env.start();await f.env.refresh();f.env.tick();
  assert.equal(f.events.at(-1).source,'cache');assert.equal(f.events.at(-1).city,'广州');assert.equal(calls,0);f.env.stop();
});
test('weather failures keep a usable preset, without waiting to begin listening',async()=>{
  const f=fixture({geolocation:geo,fetch:async()=>{throw Error('offline')}});
  f.env.tick();assert.equal(f.events.at(-1).source,'preset');assert.equal(f.events.at(-1).time,'12:00');
  await f.env.refresh();assert.equal(f.events.at(-1).city,'花园');
});
test('a non-responsive location provider times out and permits a later retry',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let calls=0;
  const f=fixture({geolocation:{getCurrentPosition(){calls++}},fetch:async()=>{throw Error('must not call')}});
  f.env.tick();const pending=f.env.refresh();t.mock.timers.tick(9000);await pending;
  assert.equal(f.events.at(-1).source,'preset');
  const retry=f.env.refresh();t.mock.timers.tick(9000);await retry;assert.equal(calls,2);
});
test('a stalled weather request times out and never replaces the cached scene',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const cached=E.readWeather(weather(),position,noon-3600000,'广州');
  const f=fixture({cache:cached,geolocation:geo,fetch:()=>new Promise(()=>{})});f.env.tick();
  const pending=f.env.refresh();await Promise.resolve();t.mock.timers.tick(9000);await pending;
  assert.equal(f.events.at(-1).source,'cache');assert.equal(f.events.at(-1).city,'广州');
});
test('manual overrides survive later API responses; follow restores both automatic controls',async()=>{
  let resolveWeather;
  const f=fixture({geolocation:geo,fetch:async url=>url.includes('bigdatacloud')?reply({city:'广州'}):new Promise(resolve=>{resolveWeather=resolve})});
  const pending=f.env.refresh();await new Promise(resolve=>setImmediate(resolve));
  f.env.overrideWeather();resolveWeather(reply(weather()));await pending;
  assert.equal(f.events.at(-1).manualWeather,true);assert.equal(f.events.at(-1).manualTime,true);
  await f.env.follow();assert.equal(f.events.at(-1).manualTime,false);assert.equal(f.events.at(-1).manualWeather,false);
});
test('moving to a new place does not carry over the previous city or timezone',async()=>{
  let location=position;
  const f=fixture({geolocation:{getCurrentPosition:ok=>ok({coords:location})},fetch:async url=>reply(url.includes('bigdatacloud')?{city:location.longitude<0?'伦敦':'广州'}:weather(3,location.longitude<0?'Europe/London':'Asia/Shanghai'))});
  await f.env.refresh();location={latitude:51.5,longitude:-.12};await f.env.refresh();
  assert.equal(f.events.at(-1).city,'伦敦');assert.equal(f.events.at(-1).timezone,'Europe/London');assert.equal(f.events.at(-1).time,'05:00');
});
test('a nearby city change beyond two kilometers is rechecked instead of reusing a broad area label',async()=>{
  let latitude=23.13,cityCalls=0;
  const f=fixture({geolocation:{getCurrentPosition:ok=>ok({coords:{latitude,longitude:113.26}})},fetch:async url=>{
    if(url.includes('bigdatacloud')){cityCalls++;return reply({city:latitude===23.13?'广州':'新地点'})}return reply(weather());
  }});
  await f.env.refresh();latitude=23.16;await f.env.refresh();assert.equal(cityCalls,2);assert.equal(f.events.at(-1).city,'新地点');
});
test('corrupt caches and malformed API data cannot replace a usable environment',async()=>{
  const f=fixture({cache:{city:'wrong',timezone:'Invalid/Zone'},geolocation:geo,fetch:async url=>reply(url.includes('bigdatacloud')?{}:{current:{weather_code:61},timezone:'bad'})});
  f.env.tick();await f.env.refresh();assert.equal(f.events.at(-1).source,'preset');
  assert.throws(()=>E.readWeather({timezone:'UTC',current:{weather_code:null}},position,noon));
  assert.throws(()=>E.readWeather({timezone:'UTC',current:{weather_code:0},daily:{sunrise:[1e300],sunset:[2e300]}},position,noon));
});
test('expired or future-dated caches fall back to the device timezone instead of stale travel weather',()=>{
  for(const fetchedAt of [noon-7*3600000,noon+3600000]){
    const cache=E.readWeather(weather(75,'Europe/London'),position,fetchedAt,'伦敦');
    const f=fixture({cache});f.env.tick();assert.equal(f.events.at(-1).source,'preset');assert.equal(f.events.at(-1).timezone,'Asia/Shanghai');
  }
});
test('a city lookup failure is retried using fresh consented coordinates even while weather is cached',async()=>{
  let cityCalls=0,weatherCalls=0;
  const f=fixture({geolocation:geo,fetch:async url=>{
    if(url.includes('bigdatacloud')){cityCalls++;if(cityCalls===1)throw Error('temporary outage');return reply({city:'广州'})}
    weatherCalls++;return reply(weather());
  }});
  await f.env.refresh();assert.equal(f.events.at(-1).city,'当地');
  await f.env.refresh();assert.equal(f.events.at(-1).city,'广州');assert.equal(weatherCalls,1);assert.equal(cityCalls,2);
});
test('long-running offline sessions expire old observations without losing manual overrides',async()=>{
  const f=fixture({geolocation:geo,fetch:async url=>reply(url.includes('bigdatacloud')?{city:'广州'}:weather())});
  await f.env.refresh();f.env.overrideWeather();f.time(noon+7*3600000);f.env.tick();
  assert.equal(f.events.at(-1).source,'preset');assert.equal(f.events.at(-1).manualWeather,true);assert.equal(f.events.at(-1).manualTime,true);
});
test('rendering targets preserve independent day/rain controls and frame-rate-independent transitions',async()=>{
  const {environmentTargets,approach}=await import('../world-environment.js');
  const state={night:false,weather:'rain',mix:{rain:0,music:0},playing:false,elapsed:42,localSky:{night:.3,warmth:.9,altitude:.1,sunX:10},localWeather:{cloud:1,rain:.6}};
  const before=structuredClone(state),target=environmentTargets(state);
  assert.equal(target.night,.3);assert.equal(target.rain,.6);assert.ok(target.warmth<.2);assert.deepEqual(state,before);
  let at30=0,at60=0;for(let i=0;i<30;i++)at30=approach(at30,1,1/30);for(let i=0;i<60;i++)at60=approach(at60,1,1/60);assert.ok(Math.abs(at30-at60)<1e-9);
});
test('production application preserves audio, camera, records and manual environment while paused',()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../source.html'),'utf8');
  const body=html.slice(html.indexOf('localEnvironment=GardenEnvironment.create('),html.indexOf("$('followLocal').onclick="));
  const state={mode:'session',playing:true,night:false,weather:'clear',mix:{rain:0,music:25},elapsed:32,records:[{id:1}],focused:true};
  let apply,notices=0;
  const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{hidden:true});return elements.get(id)};
  const context=vm.createContext({state,environmentStorage:undefined,localEnvironment:null,localStatus:{},localNotice:{update(){}},app:{dataset:{}},GardenEnvironment:{create:opts=>{apply=opts.onChange;return {}}},$,worldEngine:{weatherChanged:()=>notices++},setNight:v=>{state.night=v},updateEnvironment(){},updateWeatherUI(){},updateTitle(){}});
  vm.runInContext(body,context);
  const update={city:'广州',time:'18:32',source:'live',weather:{kind:'rain',name:'小雨',cloud:1,rain:.6},sky:{phase:'黄昏',night:.3,light:42},manualTime:false,manualWeather:false};
  const before=structuredClone(state);apply(update);
  assert.deepEqual(state.mix,before.mix);assert.equal(state.elapsed,32);assert.deepEqual(state.records,before.records);assert.equal(state.focused,true);assert.equal(state.weather,'rain');assert.equal(notices,1);
  state.playing=false;apply({...update,weather:{kind:'clear'},sky:{night:1}});assert.equal(state.weather,'rain');assert.equal(state.night,false);
  state.playing=true;state.weather='aurora';state.night=true;apply({...update,manualTime:true,manualWeather:true});assert.equal(state.weather,'aurora');assert.equal(state.night,true);
  apply({...update,source:'preset'});assert.equal(elements.get('followLocal').hidden,false,'location failure must leave an explicit retry control');
});
test('manual rain preserves twilight, aligns camera and focus UI, and manual special skies still switch day/night',()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../source.html'),'utf8');
  const handlers=html.slice(html.indexOf('function setNight('),html.indexOf('function updateTitle('));
  const sky={night:.35,warmth:.8},state={focused:true,night:false,weather:'cloudy',localSky:sky,localWeather:{cloud:1},mix:{rain:0,music:35}};
  const elements=new Map();let homes=0,shows=0,overrides=0;
  const $=id=>{if(!elements.has(id))elements.set(id,{setAttribute(){}});return elements.get(id)};
  const context=vm.createContext({state,$,app:{dataset:{},classList:{toggle(){}}},icon:()=>'',document:{querySelectorAll:()=>[]},localEnvironment:{overrideTime(){},overrideWeather(){overrides++}},changedMix(){},showMode(){shows++},updateTitle(){},worldEngine:{weatherChanged(){},home(){homes++}}});
  vm.runInContext(handlers,context);context.setWeather('rain');
  assert.equal(state.focused,false);assert.equal(homes,1);assert.equal(shows,1);assert.equal(overrides,1);assert.equal(state.localSky,sky);assert.equal(state.mix.rain,45);assert.equal(state.mix.music,35);
  context.setWeather('aurora');assert.equal(state.night,true);assert.equal(state.localSky,null);
  context.setWeather('rainbow');assert.equal(state.night,false);
});
test('starting companionship keeps the current day/night and weather while retaining session metadata',()=>{
  const script=fs.readFileSync(require('node:path').join(__dirname,'../garden-experience.js'),'utf8');
  const begin=script.slice(script.indexOf(' function begin(mix){'),script.indexOf('\n function attach(record)'));
  const state={weather:'rain',night:false},elements={stageText:{textContent:''}};
  const context=vm.createContext({state,$:id=>elements[id],context:{need:'sleepy'},plan:{line:'陪你听一会儿',title:'晚间陪伴'},leaveRest(){},renderBefore(){},setNight(){throw Error('must not force night')}});
  vm.runInContext("let finishedRecord={},replayRecord=null,active,before=null;"+begin,context);context.begin();
  assert.equal(state.night,false);assert.equal(state.weather,'rain');assert.equal(elements.stageText.textContent,'陪你听一会儿');
});

function noticeFixture(){
  let now=0,available=true,scheduled;const events=[];
  const notice=E.createNotice({now:()=>now,available:()=>available,render(){},show:()=>events.push('show'),hide:()=>events.push('hide'),setTimeout:(fn,delay)=>{scheduled={fn,at:now+delay};return 1},clearTimeout:()=>{scheduled=null}});
  const context={city:'广州',source:'live',timezone:'Asia/Shanghai',time:'10:58',sky:{date:'2026-10-23'},weather:{name:'晴'}};
  return {notice,events,context,setAvailable(value){available=value},advance(ms){now+=ms;if(scheduled&&scheduled.at<=now){const fn=scheduled.fn;scheduled=null;fn()}}};
}
test('the time card fades away after 8 seconds and does not reappear on periodic updates',()=>{
  const f=noticeFixture();f.notice.update(f.context);assert.deepEqual(f.events,['show']);
  f.advance(7999);assert.deepEqual(f.events,['show']);f.advance(1);assert.deepEqual(f.events,['show','hide']);
  f.advance(15000);f.notice.update({...f.context,time:'10:59'});f.notice.update({...f.context,time:'10:59'});assert.deepEqual(f.events,['show','hide']);
});
test('an hour boundary or new location shows the card once, without repeating on every API response',()=>{
  const f=noticeFixture();f.notice.update(f.context);f.advance(120000);f.notice.update({...f.context,time:'11:00'});f.notice.update({...f.context,time:'11:00'});assert.equal(f.events.filter(e=>e==='show').length,2);
  f.advance(20000);f.notice.update({...f.context,city:'东京',timezone:'Asia/Tokyo',time:'12:00'});f.notice.update({...f.context,city:'东京',timezone:'Asia/Tokyo',time:'12:00'});assert.equal(f.events.filter(e=>e==='show').length,3);
});
test('the time card waits for the world and stays quiet during overlays or background use',()=>{
  const f=noticeFixture();f.setAvailable(false);f.notice.update(f.context);assert.deepEqual(f.events,[]);
  f.setAvailable(true);f.notice.update(f.context);assert.deepEqual(f.events,['show']);
  f.advance(120000);f.setAvailable(false);f.notice.update({...f.context,time:'11:00'});assert.deepEqual(f.events,['show','hide']);
  f.setAvailable(true);f.notice.update({...f.context,time:'11:01'});assert.deepEqual(f.events,['show','hide']);
});
test('a real city arriving just after the intro is deferred, not silently lost to the cooldown',()=>{
  const f=noticeFixture();f.notice.update({...f.context,source:'preset',city:'花园'});f.advance(8000);f.advance(2000);
  f.notice.update(f.context);assert.deepEqual(f.events,['show','hide']);
  f.advance(1999);assert.equal(f.events.filter(e=>e==='show').length,1);f.advance(1);assert.equal(f.events.filter(e=>e==='show').length,2);
});
test('the lower-left card clears actual docks on narrow screens, and hides when there is no space',()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../source.html'),'utf8');
  const position=html.slice(html.indexOf('function positionLocalNotice(){'),html.indexOf('\nconst localNoticeObserver='));
  const localStatus={style:{},dataset:{}},stage={left:0,bottom:844,width:390,height:844};
  const panel={closest:()=>false,getBoundingClientRect:()=>({width:374,height:380,left:8,right:382,top:440})};
  const context=vm.createContext({app:{getBoundingClientRect:()=>stage},$:()=>panel,localStatus});vm.runInContext(position,context);context.positionLocalNotice();
  assert.equal(localStatus.style.bottom,'424px');assert.equal(localStatus.dataset.space,'true');
  stage.width=1440;context.positionLocalNotice();assert.equal(localStatus.style.bottom,'424px','a dock overlapping the left must still be cleared on desktop');
  stage.height=480;context.positionLocalNotice();assert.equal(localStatus.dataset.space,'false');
});

test('entering the city hides the garden clock and suspends garden rendering until returning',()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../source.html'),'utf8');
  const classes=new Set(),app={classList:{contains:key=>classes.has(key)}};
  let frames=0;
  const localStatus={dataset:{space:'true'}},worldEngine={canvas:{dataset:{ready:'true'}},update(){frames++}};
  const context=vm.createContext({app,localStatus,worldEngine,document:{hidden:false,querySelector:()=>null},positionLocalNotice(){},localNoticeReady:true,lastTime:0,state:{mode:'home'},sceneTime:0,requestAnimationFrame(){}});
  const available=html.match(/available:(\(\)=>\{positionLocalNotice\(\);return [^\n]+?\}),\n render:/)[1];
  const canShow=vm.runInContext('('+available+')',context);
  const animation=html.slice(html.indexOf('function animate(now){'),html.indexOf('requestAnimationFrame(animate);\n})();'));
  vm.runInContext(animation,context);
  assert.equal(canShow(),true);context.animate(1000);assert.equal(frames,1);
  classes.add('city-open');assert.equal(canShow(),false);context.animate(2000);assert.equal(frames,1);
  classes.delete('city-open');assert.equal(canShow(),true);context.animate(3000);assert.equal(frames,2);
  assert.ok(html.includes("window.addEventListener('garden:city-enter',pauseForInterruption)"),'entering city must still pause garden audio and timer');
});
