(()=>{
  const $=id=>document.getElementById(id),overlay=$('cityOverlay'),experience=$('cityExperience'),location=$('cityLocationCard'),app=$('app');
  if(!overlay||!experience||!location)return;
  const city={world:null,loading:null,loadToken:null,playing:false,accumulated:0,started:0,timer:null,sound:null,water:true,wind:true,music:false,moods:{quanzhou:'dusk',guangzhou:'dusk',shenzhen:'night'},mix:{water:52,wind:24,music:16},version:0,id:'quanzhou'};
  const cities={quanzhou:{title:'泉州 · 洛阳桥',name:'泉州',place:'洛阳桥',enter:'进入洛阳桥',walk:'走上桥 →',loading:'石桥与树荫正在醒来…',description:'潮汐快照<br>石桥、树荫与一只愿意陪你的小猫',welcome:'一段石板路，一只小猫，和此刻的你。',views:{entrance:['潮汐快照 · 桥头树荫','先在桥头站一会儿，让风慢慢经过。'],courtyard:['桥头庭院 · 红砖石亭','树荫落在石阶上，坐一会儿也很好。'],bridge:['石板路 · 桥上漫游','慢慢走，不需要急着抵达哪里。'],left:['向左看 · 潮水与远岸','水从桥下经过，风也轻轻经过你。'],right:['向右看 · 石桥与水面','把目光放远一点，把呼吸放慢一点。'],follow:['跟随人物 · 一起慢慢走','小猫会在你身旁，陪你走过这一段石板路。'],free:['自由视角 · 桥头漫游','拖动看看四周，点一下石板路，让我们走过去。']}},guangzhou:{title:'广州 · 珠江边',name:'广州',place:'珠江边',enter:'进入珠江边',walk:'沿江慢走 →',loading:'珠江与城市天际线正在醒来…',description:'江风快照<br>珠江、榕树与一只愿意陪你的小猫',welcome:'一段滨江步道，一只小猫，和此刻的你。',views:{entrance:['江畔快照 · 城市天际线','先在江边站一会儿，让风慢慢经过。'],courtyard:['榕树广场 · 江畔休憩','树荫落在石阶上，坐一会儿也很好。'],bridge:['滨江步道 · 慢慢前行','沿着珠江慢慢走，不需要急着抵达哪里。'],left:['向左看 · 江面与塔影','把目光放远一点，让呼吸跟着江面舒展开。'],right:['向右看 · 树影与城市','水从身边经过，风也轻轻经过你。'],follow:['跟随人物 · 一起慢慢走','小猫会在你身旁，陪你走过这一段江边。'],free:['自由视角 · 珠江漫游','拖动看看四周，点一下步道，让我们走过去。']}},shenzhen:{title:'深圳 · 深圳湾',name:'深圳',place:'深圳湾',enter:'进入深圳湾',walk:'沿湾慢走 →',loading:'深圳湾、红树林与城市灯带正在醒来…',description:'海湾快照<br>红树林、城市灯带与一只愿意陪你的小猫',welcome:'一段海湾栈道，一只小猫，和此刻的你。',views:{entrance:['湾畔快照 · 海风与灯带','先在海湾边站一会儿，让风慢慢经过。'],courtyard:['红树林下 · 静静停留','树影落在木栈道上，坐一会儿也很好。'],bridge:['海湾栈道 · 慢慢前行','沿着深圳湾慢慢走，不需要急着抵达哪里。'],left:['向左看 · 红树林与海面','把目光交给海湾，让呼吸慢一点。'],right:['向右看 · 城市与塔尖','城市灯光很远，海风就在身边。'],follow:['跟随人物 · 一起慢慢走','小猫会在你身旁，陪你走过这一段海湾。'],free:['自由视角 · 深圳湾漫游','拖动看看四周，点一下木栈道，让我们走过去。']}}};
  const current=()=>cities[city.id];
  function selectCity(id){
    city.id=id;const info=current();experience.dataset.city=id;location.dataset.city=id;document.querySelectorAll('[data-city-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.cityChoice===id)));
    $('cityLocateButton').textContent=info.enter;experience.dataset.mood=city.moods[id];moodButton.hidden=id==='quanzhou';syncMood();$('cityLocationStatus').dataset.ready='true';$('cityLocationText').textContent='已选择：'+info.title;$('cityMatchCard').hidden=false;$('cityMatchName').textContent=info.name;$('cityMatchPlace').textContent=info.place;$('cityMatchTitle').textContent=info.title;$('cityMatchDescription').innerHTML=info.description;$('cityExperienceTitle').textContent=info.title;$('cityExperience').setAttribute('aria-label',info.title+'三维漫游');$('cityWalkButton').textContent=info.walk;
    const labels=id==='guangzhou'?{entrance:'江畔',courtyard:'榕下',bridge:'步道',left:'江面',right:'塔影'}:id==='shenzhen'?{entrance:'湾畔',courtyard:'红树',bridge:'栈道',left:'海面',right:'城景'}:{entrance:'桥头',courtyard:'庭院',bridge:'桥上',left:'左看',right:'右看'};
    const home=id==='guangzhou'?'江畔':id==='shenzhen'?'湾畔':'桥头';
    document.querySelectorAll('[data-city-view]').forEach(button=>{if(labels[button.dataset.cityView])button.textContent=labels[button.dataset.cityView]});$('cityViewSwitcher').setAttribute('aria-label',info.title+'视角');$('cityControlsHelp').textContent=id==='guangzhou'?'拖动环绕 · 双指缩放 · 点击滨江步道一起走':id==='shenzhen'?'拖动环绕 · 双指缩放 · 点击海湾栈道一起走':'拖动环绕 · 双指缩放 · 点击石板路一起走';$('cityHomeButton').setAttribute('aria-label','回到'+home+'全景');$('cityHomeButton').title=home+'全景';message(info.welcome);
  }
  const courtyardButton=document.createElement('button');courtyardButton.type='button';courtyardButton.dataset.cityView='courtyard';courtyardButton.textContent='庭院';courtyardButton.setAttribute('aria-pressed','false');
  experience.querySelector('[data-city-view="entrance"]').after(courtyardButton);
  function message(text){$('cityMessage').textContent=text;}
  const quietButton=document.createElement('button');quietButton.type='button';quietButton.className='city-quiet-toggle';quietButton.textContent='静赏';quietButton.title='静赏 · 收起面板';quietButton.setAttribute('aria-label','静赏，收起操作面板');quietButton.setAttribute('aria-pressed','false');
  experience.querySelector('.city-tools').append(quietButton);
  const quietPlayer=document.createElement('button');quietPlayer.type='button';quietPlayer.className='city-quiet-player';quietPlayer.hidden=true;quietPlayer.textContent='开始陪伴';quietPlayer.addEventListener('click',togglePlaying);experience.append(quietPlayer);
  const moodButton=document.createElement('button');moodButton.type='button';moodButton.className='city-mood-toggle';experience.append(moodButton);
  function syncMood(){const night=city.moods[city.id]==='night';moodButton.textContent=night?'夜色 · 切换黄昏':'黄昏 · 切换夜色';moodButton.setAttribute('aria-label',night?'当前夜色，切换黄昏':'当前黄昏，切换夜色');}
  moodButton.addEventListener('click',()=>{const mood=city.moods[city.id]==='night'?'dusk':'night';city.moods[city.id]=mood;experience.dataset.mood=mood;city.world?.setMood(mood);syncMood();});
  function syncPlayer(){const label=city.playing?'暂停陪伴':city.accumulated?'继续陪伴':'开始陪伴';$('cityPlayButton').textContent=label;quietPlayer.textContent=label;quietPlayer.setAttribute('aria-pressed',String(city.playing));}
  function setQuiet(quiet){
    experience.dataset.quiet=String(quiet);quietPlayer.hidden=!quiet;quietButton.setAttribute('aria-pressed',String(quiet));quietButton.textContent=quiet?'展开':'静赏';
    quietButton.setAttribute('aria-label',quiet?'展开操作面板':'静赏，收起操作面板');quietButton.title=quiet?'展开操作面板':'静赏 · 收起面板';
    // Hidden controls must also leave the keyboard and accessibility navigation.
    for(const selector of ['.city-dock','.city-view-switcher'])experience.querySelector(selector).inert=quiet;
    for(const button of experience.querySelectorAll('.city-tools button:not(.city-quiet-toggle)'))button.inert=quiet;
  }
  new ResizeObserver(entries=>{const height=entries[0].target.getBoundingClientRect().height;if(height)experience.style.setProperty('--city-dock-height',height+'px');}).observe(experience.querySelector('.city-dock'));
  quietButton.addEventListener('click',()=>setQuiet(experience.dataset.quiet!=='true'));
  function viewChanged(view){
    const meta=current().views[view]||current().views.free;experience.dataset.view=view;$('cityViewTitle').textContent=meta[0];$('cityCaption').textContent=meta[1];
    document.querySelectorAll('[data-city-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cityView===view)));
    $('cityFollowButton').setAttribute('aria-pressed',String(view==='follow'));
  }
  function elapsed(){return city.accumulated+(city.playing?(performance.now()-city.started)/1000:0);}
  function updateTime(){const seconds=Math.floor(elapsed());$('cityElapsed').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
  function updateMix(){if(!city.sound)return;const profile=city.sound.profile;city.sound.setMix(Object.fromEntries(['water','wind','music'].map(key=>[key,city[key]?city.mix[key]/((key==='music'?.16:profile[key])*100):0])));}
  function pause(){
    if(city.playing)city.accumulated=elapsed();city.playing=false;city.version++;
    if(city.timer)clearInterval(city.timer);city.timer=null;
    city.world?.setPlaying(false);city.sound?.stop();syncPlayer();updateTime();
  }
  function sceneError(text){pause();$('citySceneStatus').hidden=false;$('citySceneStatusText').textContent=text;$('cityRetryButton').hidden=false;}
  async function ensureWorld(){
    if(city.world)return city.world;
    if(city.loading)return city.loading;
    $('citySceneStatus').hidden=false;$('cityRetryButton').hidden=true;$('citySceneStatusText').textContent=current().loading;
    const token=city.loadToken=Symbol('city-load'),id=city.id;
    city.loading=(async()=>{
      await Promise.resolve(window.GARDEN_READY);
      if(city.loadToken!==token||overlay.hidden||experience.hidden)return null;
      if(!window.CityWorld)throw Error('City 3D module unavailable');
      const world=new window.CityWorld({host:$('cityWorldHost'),onMessage:message,onView:viewChanged,onError:sceneError,city:id});
      city.world=world;$('citySceneStatus').hidden=true;return world;
    })();
    try{return await city.loading;}catch(error){if(city.loadToken===token){console.error(error);sceneError('三维场景暂时没有载入，点击重试。');}return null;}finally{if(city.loadToken===token)city.loading=null;}
  }
  async function enter(){
    location.hidden=true;experience.hidden=false;const version=++city.version;
    const world=await ensureWorld();if(!world||version!==city.version||overlay.hidden||experience.hidden)return;
    world.reset();world.setMood(city.moods[city.id],true);setQuiet(true);world.activate();$('cityWorldHost').querySelector('canvas')?.focus({preventScroll:true});
  }
  async function togglePlaying(){
    if(city.playing){pause();message('在这里停一会儿，想继续时再开始。');return;}
    if(!city.world){message('等石桥和小猫准备好，再开始吧。');return;}
    city.playing=true;city.started=performance.now();const version=++city.version;
    city.world.setPlaying(true);syncPlayer();message('声音轻轻响起，小猫陪你在这里停一会儿。');
    city.timer=setInterval(updateTime,250);
    try{
      if(!city.sound)city.sound=new window.CitySoundscape({city:city.id,onInterruption:()=>{pause();message('声音已暂停，点击继续陪伴即可恢复。');}});
      const sound=city.sound;updateMix();const started=await sound.start();
      if(version!==city.version||!city.playing){if(!city.playing)sound.stop();return;}
      if(!started)message('当前浏览器未开启声音，仍可带着小猫漫游。');
    }catch(error){if(version===city.version){pause();message('声音暂时没能开启，点击继续陪伴重试。');city.sound?.close();city.sound=null;}}
  }
  function reset(){setQuiet(false);pause();city.accumulated=0;city.world?.reset();updateTime();syncPlayer();message(current().welcome);}
  function open(){
    reset();overlay.hidden=false;location.hidden=false;experience.hidden=true;app.classList.add('city-open');
    city.world?.deactivate();$('cityLocateButton').disabled=false;selectCity(city.id);

    window.dispatchEvent(new Event('garden:city-enter'));$('cityLocateButton').focus({preventScroll:true});
  }
  function close(){pause();city.world?.deactivate();overlay.hidden=true;app.classList.remove('city-open');$('cityButton').focus({preventScroll:true});}
  $('cityButton').addEventListener('click',open);$('cityCloseButton').addEventListener('click',close);$('cityExitButton').addEventListener('click',close);
  $('cityBackButton').addEventListener('click',()=>{pause();city.world?.deactivate();experience.hidden=true;location.hidden=false;$('cityLocateButton').focus({preventScroll:true});});
  function chooseCity(id){
    if(!cities[id]||city.id===id)return;
    pause();city.world?.dispose();city.world=null;city.loadToken=null;city.loading=null;city.sound?.close();city.sound=null;city.accumulated=0;
    city.mix={water:id==='guangzhou'?58:id==='shenzhen'?43:52,wind:id==='guangzhou'?18:id==='shenzhen'?30:24,music:16};
    updateTime();city.id=id;selectCity(id);
  }
  document.querySelectorAll('[data-city-choice]').forEach(button=>button.addEventListener('click',()=>chooseCity(button.dataset.cityChoice)));
  $('cityLocateButton').addEventListener('click',enter);
  $('cityWalkButton').addEventListener('click',()=>city.world?.walkBridge());
  $('cityFollowButton').addEventListener('click',()=>{if(city.world?.follow)city.world.setView('entrance');else city.world?.focusPerson();});
  $('cityZoomIn').addEventListener('click',()=>city.world?.canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'+'})));
  $('cityZoomOut').addEventListener('click',()=>city.world?.canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'-'})));
  $('cityHomeButton').addEventListener('click',()=>city.world?.setView('entrance'));
  $('cityPetButton').addEventListener('click',()=>city.world?.actors.pet());
  document.querySelectorAll('[data-city-view]').forEach(b=>b.addEventListener('click',()=>city.world?.setView(b.dataset.cityView)));
  $('cityPlayButton').addEventListener('click',togglePlaying);$('cityResetButton').addEventListener('click',reset);
  $('cityFinishButton').addEventListener('click',()=>{pause();message('这一段风景先留在这里。你还可以继续走走。');syncPlayer();});
  for(const [id,key,label] of [['cityWaterButton','water','水声'],['cityWindButton','wind','风声'],['cityMusicButton','music','轻音乐']])$(id).addEventListener('click',()=>{city[key]=!city[key];$(id).dataset.on=String(city[key]);$(id).setAttribute('aria-pressed',String(city[key]));$(id).textContent=label+' · '+(city[key]?'开':'关');updateMix();});
  $('cityRetryButton').addEventListener('click',()=>{city.world?.dispose();city.world=null;city.loadToken=null;city.loading=null;enter();});
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(experience.dataset.quiet==='true'){setQuiet(false);quietButton.focus();}else close();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&city.playing){pause();message('回来后，再继续听这段声音。');}});
  window.addEventListener('pagehide',()=>{pause();city.world?.dispose();city.world=null;city.sound?.close();city.sound=null;});
  window.CityPrototype={open,close,get world(){return city.world;},
    get snapshot(){return {active:!overlay.hidden&&!experience.hidden,scene:city.id,mood:city.moods[city.id],playing:city.playing,mix:Object.fromEntries(['water','wind','music'].map(key=>[key,city[key]?city.mix[key]:0]))};},
    play(){if(!overlay.hidden&&!experience.hidden&&!city.playing)return togglePlaying();},
    async prepare(plan){
      if(overlay.hidden||experience.hidden||city.id!==plan.scene){open();chooseCity(plan.scene);await enter();}
      if(!city.world||overlay.hidden||experience.hidden)throw Error('City unavailable');
      if(plan.mood!=='keep'){city.moods[city.id]=plan.mood;experience.dataset.mood=plan.mood;city.world.setMood(plan.mood);syncMood();}
      for(const [key,label]of [['water','水声'],['wind','风声'],['music','轻音乐']]){
        if(Number.isFinite(plan.mix[key])){city[key]=plan.mix[key]>0;if(city[key])city.mix[key]=plan.mix[key];const button=$('city'+key[0].toUpperCase()+key.slice(1)+'Button');button.dataset.on=String(city[key]);button.setAttribute('aria-pressed',String(city[key]));button.textContent=label+' · '+(city[key]?'开':'关');}
      }
      updateMix();if(plan.playback==='pause')pause();
      if(plan.catAction==='approach')city.world.focusPerson();
      if(plan.catAction==='pet')city.world.actors.pet();
      if(plan.catAction==='rest')city.world.actors.rest();
      if(plan.interaction==='quiet')setQuiet(true);else if(plan.interaction==='talk')setQuiet(false);
      return {playing:city.playing,summary:current().title+'的声音与小猫已按这段安排调整。'};
    }
  };
})();
