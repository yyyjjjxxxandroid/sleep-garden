(function(root){
  const sounds=['sun','wind','rain','bugs','cat','water','music'];
  const scenes=['keep','garden','quanzhou','guangzhou','shenzhen'];
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
    return {reply:text(value.reply,240),reason:text(value.reason,160),scene:pick(value.scene,scenes,'keep'),mood:pick(value.mood,['keep','dusk','night'],'keep'),mix,
      catAction:pick(value.catAction,['keep','rest','approach','pet'],'keep'),interaction:pick(value.interaction,['keep','quiet','talk'],'keep'),playback:pick(value.playback,['keep','pause'],'keep'),memory};
  }
  function normalizeMemory(value){
    return normalizePlan({reply:'preferences',memory:value}).memory||{muted:[],scene:null,music:null};
  }
  const api={sounds,scenes,normalizePlan,normalizeMemory};
  if(typeof module!=='undefined')module.exports=api;else root.CompanionPlan=api;
})(typeof window==='undefined'?globalThis:window);
