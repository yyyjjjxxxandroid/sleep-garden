/* Local time and weather only; this module never controls audio or sessions. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GardenEnvironment=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const CACHE_KEY='sleepGarden.environment.v1',REFRESH_MS=20*60*1000,MAX_CACHE_MS=6*60*60*1000;
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
  function validZone(zone){try{new Intl.DateTimeFormat('en',{timeZone:zone});return typeof zone==='string'}catch{return false}}
  function localClock(now,timezone){
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(now));
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return {hour:Number(p.hour)+Number(p.minute)/60+Number(p.second)/3600,text:p.hour+':'+p.minute,date:p.year+'-'+p.month+'-'+p.day};
  }
  function weatherForCode(code){
    if(code===0)return {kind:'clear',name:'晴',cloud:0,rain:0};
    if(code===1||code===2)return {kind:'cloudy',name:'多云',cloud:code===1?.3:.55,rain:0};
    if(code===3)return {kind:'cloudy',name:'阴',cloud:1,rain:0};
    if(code===45||code===48)return {kind:'fog',name:'雾',cloud:1,rain:0,fog:1};
    if([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code))return {kind:'rain',name:code<60?'细雨':code===61||code===80?'小雨':code>=95?'雷雨':'雨',cloud:1,rain:code===51?.35:code===61||code===80?.6:1};
    if([71,73,75,77,85,86].includes(code))return {kind:'snow',name:code===71||code===85?'小雪':'雪',cloud:.85,rain:0,snow:code===71||code===85?.45:code===75||code===86?1:.7};
    return {kind:'cloudy',name:'多云',cloud:.55,rain:0};
  }
  function daylight(now,timezone,solar=[]){
    const clock=localClock(now,timezone);
    const today=solar.find(p=>Number.isFinite(p.rise)&&Number.isFinite(p.set)&&p.set>p.rise&&localClock(p.rise,timezone).date===clock.date);
    const rise=today?localClock(today.rise,timezone).hour:6;
    const set=today?localClock(today.set,timezone).hour:18;
    const h=clock.hour;
    const morning=smooth(rise-.75,rise+.75,h),evening=smooth(set-.75,set+.75,h);
    const night=clamp(1-morning+evening);
    const dawn=Math.exp(-Math.pow((h-rise)/.85,2)),dusk=Math.exp(-Math.pow((h-set)/1.05,2));
    const middle=(rise+set)/2,noon=Math.exp(-Math.pow((h-middle)/1.8,2));
    const afternoon=Math.exp(-Math.pow((h-(middle+2.5))/2,2));
    const warmth=clamp(dawn*.65+dusk*.95+afternoon*.16);
    const altitude=clamp(Math.sin(clamp((h-rise)/(set-rise))*Math.PI));
    const phase=h<rise-1?'深夜':h<rise+.15?'黎明':h<Math.min(middle-.9,rise+(set-rise)*.22)?'清晨':h<middle-.9?'上午':h<middle+.9?'正午':h<set-1.1?'午后':h<set+.75?'黄昏':h<23?'入夜':'深夜';
    const deepNight=night*clamp(1-smooth(3,5,h)+smooth(21.5,24,h));
    return {...clock,phase,night,warmth,dawn,noon,deepNight,altitude,light:Math.round(35+altitude*35),sunX:Math.cos(clamp((h-rise)/(set-rise))*Math.PI)*-24};
  }
  function validSnapshot(x){
    return !!x&&typeof x.city==='string'&&x.city.length>0&&x.city.length<=100&&validZone(x.timezone)&&Number.isFinite(x.latitude)&&Math.abs(x.latitude)<=90&&Number.isFinite(x.longitude)&&Math.abs(x.longitude)<=180&&Number.isInteger(x.code)&&x.code>=0&&x.code<=99&&Number.isFinite(x.fetchedAt)&&x.fetchedAt>=0&&x.fetchedAt<8.64e15&&Array.isArray(x.solar)&&x.solar.length<=7&&x.solar.every(p=>p&&Number.isFinite(p.rise)&&Number.isFinite(p.set)&&p.rise>=0&&p.set>p.rise&&p.set<8.64e15);
  }
  function readWeather(data,position,now,city='当地'){
    const code=data?.current?.weather_code;
    if(!Number.isInteger(code)||code<0||code>99||!validZone(data?.timezone))throw Error('Invalid weather response');
    const solar=(data.daily?.sunrise||[]).map((rise,i)=>({rise:rise*1000,set:data.daily.sunset?.[i]*1000})).filter(p=>Number.isFinite(p.rise)&&Number.isFinite(p.set)&&p.set>p.rise);
    const snapshot={latitude:position.latitude,longitude:position.longitude,timezone:data.timezone,code,solar,city,fetchedAt:now};
    if(!validSnapshot(snapshot))throw Error('Invalid weather observation');
    return snapshot;
  }
  function nearby(a,b){return Math.hypot((a.latitude-b.latitude)*111,(a.longitude-b.longitude)*111*Math.cos(a.latitude*Math.PI/180))<2}
  function create(options={}){
    const now=options.now||Date.now,onChange=options.onChange||(()=>{});
    const fetcher=options.fetch||globalThis.fetch?.bind(globalThis),geo=options.geolocation??globalThis.navigator?.geolocation;
    const storage=options.storage,schedule=options.setInterval||globalThis.setInterval,cancel=options.clearInterval||globalThis.clearInterval;
    let timezone=options.timezone;try{timezone=timezone||Intl.DateTimeFormat().resolvedOptions().timeZone}catch{}
    if(!validZone(timezone))timezone='Asia/Shanghai';
    const preset=()=>({city:'花园',timezone,latitude:23.13,longitude:113.26,code:2,solar:[],fetchedAt:0});
    const usable=entry=>validSnapshot(entry)&&now()-entry.fetchedAt>=-300000&&now()-entry.fetchedAt<MAX_CACHE_MS;
    let snapshot=preset();
    let source='preset',manualTime=false,manualWeather=false,stopped=false,denied=false,busy=false,version=0,timers=[];
    try{const cached=JSON.parse(storage?.getItem(CACHE_KEY)||'null');if(usable(cached)){snapshot=cached;source='cache'}}catch{}
    function emit(){
      if(stopped)return;
      if(source!=='preset'&&!usable(snapshot)){snapshot=preset();source='preset';try{storage?.removeItem?.(CACHE_KEY)}catch{}}
      const sky=daylight(now(),snapshot.timezone,snapshot.solar),weather=weatherForCode(snapshot.code);
      onChange({city:snapshot.city,timezone:snapshot.timezone,time:sky.text,sky,weather,source,manualTime,manualWeather});
    }
    function persist(){try{storage?.setItem(CACHE_KEY,JSON.stringify(snapshot))}catch{}}
    async function json(url){
      if(!fetcher)throw Error('Offline');
      const controller=new AbortController();let timer;
      try{return await Promise.race([
        (async()=>{const r=await fetcher(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('Weather unavailable');return r.json()})(),
        new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Request timeout'))},8000)})
      ])}finally{clearTimeout(timer)}
    }
    function locate(){return new Promise((resolve,reject)=>{
      if(!geo)return reject(Error('Location unavailable'));
      let settled=false;
      const timer=setTimeout(()=>done(Error('Location timeout')),8500);
      function done(error,position){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(position)}
      try{geo.getCurrentPosition(p=>done(null,p.coords),e=>{if(e.code===1)denied=true;done(e)},{enableHighAccuracy:false,maximumAge:300000,timeout:8000})}catch(error){done(error)}
    })}
    async function refresh(){
      if(stopped||busy||denied)return;
      busy=true;const request=++version;
      try{
        const position=await locate();
        if(stopped||request!==version)return;
        if(!Number.isFinite(position.latitude)||Math.abs(position.latitude)>90||!Number.isFinite(position.longitude)||Math.abs(position.longitude)>180)throw Error('Invalid position');
        const same=source!=='preset'&&usable(snapshot)&&nearby(snapshot,position);
        const city=same?snapshot.city:'当地';
        // City lookup is optional and only receives fresh, consented device
        // coordinates. Never send stored coordinates to this client-only API.
        const cityTask=same&&!['当地','花园'].includes(city)?Promise.resolve(city):json('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+position.latitude+'&longitude='+position.longitude+'&localityLanguage=zh').then(data=>String(data.city||data.locality||data.principalSubdivision||'当地').slice(0,100)).catch(()=>city);
        if(same&&now()-snapshot.fetchedAt>=0&&now()-snapshot.fetchedAt<REFRESH_MS){
          const resolvedCity=await cityTask;
          if(!stopped&&request===version){snapshot={...snapshot,city:resolvedCity};persist();emit()}
          return;
        }
        const data=await json('https://api.open-meteo.com/v1/forecast?latitude='+position.latitude+'&longitude='+position.longitude+'&current=weather_code,is_day&daily=sunrise,sunset&timezone=auto&timeformat=unixtime&forecast_days=2');
        if(stopped||request!==version)return;
        snapshot=readWeather(data,position,now(),city);source='live';persist();emit();
        const resolvedCity=await cityTask;
        if(!stopped&&request===version){snapshot={...snapshot,city:resolvedCity};persist();emit()}
      }catch{/* Keep the last usable environment; listening must not depend on the network. */}
      finally{busy=false}
    }
    return {
      start(){if(timers.length||stopped)return;emit();timers=[schedule(emit,15000),schedule(refresh,REFRESH_MS)];void refresh()},
      tick:emit,refresh,
      overrideTime(){manualTime=true;emit()},
      overrideWeather(){manualWeather=true;manualTime=true;emit()},
      follow(){manualTime=false;manualWeather=false;denied=false;emit();return refresh()},
      stop(){stopped=true;version++;timers.forEach(cancel);timers=[]}
    };
  }
  // A quiet time card, not a permanently updating status bar. The environment
  // itself keeps updating even when this presentation is hidden.
  function createNotice(options){
    const now=options.now||Date.now,schedule=options.setTimeout||setTimeout,cancel=options.clearTimeout||clearTimeout;
    let first=true,lastHour=null,lastPlace=null,lastShown=-Infinity,timer=null,visible=false,deferred=null,latest=null;
    function hide(){if(timer!==null)cancel(timer);timer=null;if(visible)options.hide();visible=false}
    function update(context){
      latest=context;
      options.render(context);
      const hour=context.timezone+'|'+context.sky.date+'|'+context.time.slice(0,2);
      const located=context.source!=='preset'&&!['当地','花园'].includes(context.city);
      const place=located?context.city+'|'+context.timezone:null;
      const changedPlace=place!==null&&place!==lastPlace;
      const onHour=lastHour!==null&&lastHour!==hour&&context.time.endsWith(':00');
      lastHour=hour;
      if(!options.available()){if(place!==null)lastPlace=place;if(deferred!==null)cancel(deferred);deferred=null;hide();return}
      if(visible){if(place!==null)lastPlace=place;return}
      if(!first&&!changedPlace&&!onHour)return;
      // A late location response may refine the card while it is visible, but
      // never replay the entrance or extend it on every asynchronous update.
      if(!first&&now()-lastShown<12000){
        if(changedPlace&&deferred===null)deferred=schedule(()=>{deferred=null;update(latest)},12000-(now()-lastShown));
        return;
      }
      if(deferred!==null)cancel(deferred);deferred=null;if(place!==null)lastPlace=place;
      first=false;lastShown=now();visible=true;options.show();timer=schedule(hide,8000);
    }
    return {update,hide};
  }
  return {create,createNotice,daylight,localClock,weatherForCode,readWeather,validSnapshot,CACHE_KEY};
});
