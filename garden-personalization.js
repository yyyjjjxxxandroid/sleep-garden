// Explicit choices and local feedback only: no inferred mood or sleep detection.
(function(root){
 const needs={
  busy:{label:'脑袋停不下来',title:'让思绪慢下来',minutes:20,line:'事情可以留到明天。先听听水声，不必急着睡着。',mix:{sun:0,wind:18,rain:0,bugs:5,cat:10,water:32,music:22}},
  company:{label:'想被陪一会儿',title:'今晚，有个小伴',minutes:15,line:'不用找话说，小猫会在这里陪你。',mix:{sun:0,wind:16,rain:0,bugs:8,cat:28,water:16,music:26}},
  sleepy:{label:'已经有点困',title:'把今晚轻轻收好',minutes:30,line:'不用努力睡着。让声音轻一点，眼睛也休息一下。',mix:{sun:0,wind:12,rain:24,bugs:0,cat:8,water:8,music:14}}
 };
 const levels=['很紧绷','有点紧绷','一般','比较放松','很放松'];
 function context(input={}){input=input||{};return {need:Object.hasOwn(needs,input.need)?input.need:'busy',environment:['quiet','noise','shared'].includes(input.environment)?input.environment:'quiet',device:['speaker','headphones'].includes(input.device)?input.device:'speaker',music:input.music!==false};}
 function rating(value){return Number.isInteger(value)&&value>=1&&value<=5?value:null;}
 function normalizeExperience(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const c=value.context,validContext=c&&Object.hasOwn(needs,c.need)&&['quiet','noise','shared'].includes(c.environment)&&['speaker','headphones'].includes(c.device)&&typeof c.music==='boolean';
  return {...value,context:validContext?context(c):null,before:rating(value.before),after:rating(value.after),returnIntent:['yes','maybe','no'].includes(value.returnIntent)?value.returnIntent:null,deferred:value.deferred===true};
 }
 function sameContext(a,b){const x=context(a),y=context(b);return Object.keys(x).every(k=>x[k]===y[k]);}
 function validMix(m){return m&&Object.keys(needs.busy.mix).every(k=>Number.isFinite(m[k])&&m[k]>=0&&m[k]<=100);}
 function recommend(input,records=[]){
  const c=context(input),base=needs[c.need],mix={...base.mix},reasons=[];
  reasons.push(c.need==='busy'?'用稳定流水和轻音乐，给注意力一个温柔的落点。':c.need==='company'?'让轻音乐和小猫呼噜靠近一些，留一点被陪伴的感觉。':'减少鸟鸣和虫鸣，让细雨保持平稳，音乐更轻。');
  if(c.environment==='noise'){mix.rain=Math.max(mix.rain,32);mix.water=Math.max(mix.water,20);reasons.push('加入连续雨声，减少环境声变化带来的分心；不自动提高总音量。');}
  if(c.environment==='shared'){Object.keys(mix).forEach(k=>mix[k]=Math.round(mix[k]*.7));reasons.push('共享空间先用更轻的配比，请再确认设备音量。');}
  if(c.device==='headphones'){mix.cat=Math.min(mix.cat,16);mix.bugs=Math.min(mix.bugs,5);reasons.push('耳机模式收轻近处呼噜和虫鸣，让声音留一点距离。');}
  if(!c.music){mix.music=0;reasons.push('按你的选择，只保留自然声。');}
  // The latest explicit response wins, including a changed mind on an old record.
  // Unanswered sessions neither erase a preference nor manufacture a positive one.
  const latest=records.map((record,index)=>({record,index,time:Date.parse(record.experience?.respondedAt||record.date)||0})).sort((a,b)=>b.time-a.time||b.index-a.index).map(x=>x.record).find(r=>r.experience?.context&&sameContext(r.experience.context,c)&&(['yes','maybe','no'].includes(r.experience.returnIntent)||rating(r.experience.after)!==null||['没有','一些','很明显'].includes(r.feedback)));
  const remembered=latest&&latest.experience.returnIntent==='yes'&&(rating(latest.experience.after)!==null&&rating(latest.experience.before)!==null?latest.experience.after>latest.experience.before:latest.feedback==='很明显')&&validMix(latest.mix)?latest:null;
  return {context:c,title:base.title,line:base.line,minutes:base.minutes,mix:remembered?{...remembered.mix,...(!c.music?{music:0}:{})}:mix,reason:remembered?'沿用你在相同状态和环境下，明确反馈有效且愿意再听的配方。仍可随时调节。':reasons.join(''),remembered:!!remembered};
 }
 function summarize(records=[]){
  const eligible=records.filter(r=>r.experience),pairs=eligible.filter(r=>rating(r.experience.before)!==null&&rating(r.experience.after)!==null),intents=eligible.filter(r=>['yes','maybe','no'].includes(r.experience.returnIntent));
  return {sessions:eligible.length,paired:pairs.length,meanChange:pairs.length?pairs.reduce((s,r)=>s+r.experience.after-r.experience.before,0)/pairs.length:null,intentResponses:intents.length,yes:intents.filter(r=>r.experience.returnIntent==='yes').length};
 }
 const api={needs,levels,context,rating,normalizeExperience,sameContext,recommend,summarize};
 if(typeof module!=='undefined')module.exports=api;else root.GardenPersonalization=api;
})(typeof window==='undefined'?globalThis:window);
