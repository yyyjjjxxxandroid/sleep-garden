(function(root){
  const sounds=['sun','wind','rain','bugs','cat','water','footsteps','chime','music'];
  const scenes=['keep','garden','quanzhou','guangzhou','shenzhen'];
  const weathers=['clear','cloudy','snow','fog','rainbow','rain','aurora','meteor'];
  const pick=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
  const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
  function normalizePlan(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||!text(value.reply,240))throw Error('Invalid companion plan');
    const mix={};
    for(const key of sounds)if(Number.isFinite(value.mix?.[key]))mix[key]=Math.round(Math.max(0,Math.min(60,value.mix[key])));
    let memory=null;
    if(value.memory&&typeof value.memory==='object'){
      const muted=Array.isArray(value.memory.muted)?[...new Set(value.memory.muted.filter(k=>sounds.includes(k)))]:[];
      const scene=pick(value.memory.scene,scenes.slice(1),null);
      const music=typeof value.memory.music==='boolean'?value.memory.music:null;
      if(muted.length||scene||music!==null)memory={muted,scene,music};
    }
    const environment={};
    const e=value.environment;
    if(e&&typeof e==='object'&&!Array.isArray(e)){
      if(weathers.includes(e.weather))environment.weather=e.weather;
      for(const key of ['wind','light'])if(Number.isFinite(e[key]))environment[key]=Math.round(Math.max(0,Math.min(100,e[key])));
      for(const key of ['windLink','fireflies','reduced'])if(typeof e[key]==='boolean')environment[key]=e[key];
      if(e.followLocal===true){environment.followLocal=true;delete environment.weather;delete environment.light;}
      // An explicit visual wind level can be independent of the sound mix.
      if(environment.wind!==undefined&&environment.windLink===undefined)environment.windLink=false;
      if(environment.windLink===true&&environment.wind!==undefined)environment.wind=Math.min(60,environment.wind);
    }
    let mood=pick(value.mood,['keep','day','dusk','night'],'keep');
    if(['aurora','meteor'].includes(environment.weather))mood='night';
    if(environment.weather==='rainbow')mood='day';
    if(environment.followLocal)mood='keep';
    if(environment.weather&&mix.rain===undefined)mix.rain=environment.weather==='rain'?35:0;
    const timerMinutes=Number.isInteger(value.timerMinutes)&&value.timerMinutes>=0&&value.timerMinutes<=720?value.timerMinutes:null;
    return {reply:text(value.reply,240),reason:text(value.reason,160),scene:pick(value.scene,scenes,'keep'),mood,mix,environment,timerMinutes,
      catAction:pick(value.catAction,['keep','rest','approach','pet'],'keep'),interaction:pick(value.interaction,['keep','quiet','talk'],'keep'),playback:pick(value.playback,['keep','pause'],'keep'),memory};
  }
  function normalizeMemory(value){
    return normalizePlan({reply:'preferences',memory:value}).memory||{muted:[],scene:null,music:null};
  }
  function resolveGardenSettings(current,plan){
    const e=plan.environment,next={...current,mix:{...current.mix,...plan.mix},...e};
    next.mood=plan.mood==='keep'?current.mood:plan.mood;
    if(plan.mood!=='keep'&&!e.weather&&((next.mood!=='night'&&['aurora','meteor'].includes(next.weather))||(next.mood==='night'&&next.weather==='rainbow')))next.weather='clear';
    if(e.weather&&plan.mix.rain===undefined)next.mix.rain=e.weather==='rain'?Math.max(35,next.mix.rain||0):0;
    if(next.windLink){
      if(e.wind!==undefined||(e.windLink===true&&plan.mix.wind===undefined))next.mix.wind=Math.min(60,next.wind);
      next.wind=next.mix.wind;
    }
    return next;
  }
  function validateScene(plan,currentScene){
    const scene=plan.scene==='keep'?currentScene:plan.scene;
    if(scene!=='garden'&&(Object.keys(plan.environment).length||plan.timerMinutes!==null||plan.mood==='day'||['sun','rain','bugs','cat','footsteps','chime'].some(key=>plan.mix[key]>0)))throw Error('Unsupported city control');
    return scene;
  }
  function describePlan(p){
    const names={sun:'鸟鸣',wind:'风声',rain:'细雨',bugs:'虫鸣',cat:'呼噜',water:'流水',footsteps:'猫咪脚步',chime:'风铃',music:'轻音乐'},places={garden:'花园',quanzhou:'泉州 · 洛阳桥',guangzhou:'广州 · 珠江边',shenzhen:'深圳湾'},weather={clear:'晴朗',cloudy:'阴天',snow:'落雪',fog:'薄雾',rainbow:'彩虹',rain:'细雨',aurora:'极光',meteor:'流星'},e=p.environment;
    return [p.scene!=='keep'?places[p.scene]:null,{day:'白天',dusk:'黄昏',night:'夜色'}[p.mood],weather[e.weather],e.followLocal?'恢复跟随本地天气与时间':null,e.wind!==undefined?'风力 '+e.wind+'%':null,e.light!==undefined?'光照 '+e.light+'%':null,e.windLink!==undefined?'风声联动'+(e.windLink?'开启':'关闭'):null,e.fireflies!==undefined?'萤火虫'+(e.fireflies?'开启':'关闭'):null,e.reduced!==undefined?(e.reduced?'减少动态':'恢复动态'):null,...Object.entries(p.mix).map(([k,v])=>names[k]+' '+v+'%'),p.timerMinutes!==null?(p.timerMinutes===0?'取消定时':'从开始或继续播放起陪伴 '+p.timerMinutes+' 分钟'):null,{rest:'小猫静静休息',approach:'靠近小猫',pet:'摸摸小猫'}[p.catAction],{quiet:'安静陪伴',talk:'互动陪伴'}[p.interaction],p.playback==='pause'?'暂停声音与计时':null].filter(Boolean).join(' · ');
  }
  const api={sounds,scenes,weathers,normalizePlan,normalizeMemory,resolveGardenSettings,validateScene,describePlan};
  if(typeof module!=='undefined')module.exports=api;else root.CompanionPlan=api;
})(typeof window==='undefined'?globalThis:window);
