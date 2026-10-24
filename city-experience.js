(()=>{
  const $=id=>document.getElementById(id),overlay=$('cityOverlay'),experience=$('cityExperience'),location=$('cityLocationCard'),app=$('app');
  if(!overlay||!experience||!location)return;
  const city={world:null,loading:null,playing:false,accumulated:0,started:0,timer:null,sound:null,water:true,wind:true,version:0,locationTimer:null};
  const views={entrance:['潮汐快照 · 桥头树荫','先在桥头站一会儿，让风慢慢经过。'],courtyard:['桥头庭院 · 红砖石亭','树荫落在石阶上，坐一会儿也很好。'],bridge:['石板路 · 桥上漫游','慢慢走，不需要急着抵达哪里。'],left:['向左看 · 潮水与远岸','水从桥下经过，风也轻轻经过你。'],right:['向右看 · 石桥与水面','把目光放远一点，把呼吸放慢一点。'],follow:['跟随人物 · 一起慢慢走','小猫会在你身旁，陪你走过这一段石板路。'],free:['自由视角 · 桥头漫游','拖动看看四周，点一下石板路，让我们走过去。']};
  const courtyardButton=document.createElement('button');courtyardButton.type='button';courtyardButton.dataset.cityView='courtyard';courtyardButton.textContent='庭院';courtyardButton.setAttribute('aria-pressed','false');
  experience.querySelector('[data-city-view="entrance"]').after(courtyardButton);
  function message(text){$('cityMessage').textContent=text;}
  const quietButton=document.createElement('button');quietButton.type='button';quietButton.className='city-quiet-toggle';quietButton.textContent='静赏';quietButton.title='静赏 · 收起面板';quietButton.setAttribute('aria-label','静赏，收起操作面板');quietButton.setAttribute('aria-pressed','false');
  experience.querySelector('.city-tools').append(quietButton);
  function setQuiet(quiet){
    experience.dataset.quiet=String(quiet);quietButton.setAttribute('aria-pressed',String(quiet));quietButton.textContent=quiet?'展开':'静赏';
    quietButton.setAttribute('aria-label',quiet?'展开操作面板':'静赏，收起操作面板');quietButton.title=quiet?'展开操作面板':'静赏 · 收起面板';
    // Hidden controls must also leave the keyboard and accessibility navigation.
    for(const selector of ['.city-dock','.city-view-switcher'])experience.querySelector(selector).inert=quiet;
    for(const button of experience.querySelectorAll('.city-tools button:not(.city-quiet-toggle)'))button.inert=quiet;
  }
  quietButton.addEventListener('click',()=>setQuiet(experience.dataset.quiet!=='true'));
  function viewChanged(view){
    const meta=views[view]||views.free;experience.dataset.view=view;$('cityViewTitle').textContent=meta[0];$('cityCaption').textContent=meta[1];
    document.querySelectorAll('[data-city-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cityView===view)));
    $('cityFollowButton').setAttribute('aria-pressed',String(view==='follow'));
  }
  function elapsed(){return city.accumulated+(city.playing?(performance.now()-city.started)/1000:0);}
  function updateTime(){const seconds=Math.floor(elapsed());$('cityElapsed').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
  function updateMix(){city.sound?.setMix({water:(city.playing&&city.water)? .72:0,wind:(city.playing&&city.wind)? .38:0});}
  function pause(){
    if(city.playing)city.accumulated=elapsed();city.playing=false;city.version++;
    if(city.timer)clearInterval(city.timer);city.timer=null;
    city.world?.setPlaying(false);city.sound?.stop();$('cityPlayButton').textContent=city.accumulated?'继续陪伴':'开始陪伴';updateTime();
  }
  function sceneError(text){pause();$('citySceneStatus').hidden=false;$('citySceneStatusText').textContent=text;$('cityRetryButton').hidden=false;}
  async function ensureWorld(){
    if(city.world)return city.world;
    if(city.loading)return city.loading;
    $('citySceneStatus').hidden=false;$('cityRetryButton').hidden=true;$('citySceneStatusText').textContent='石桥与树荫正在醒来…';
    city.loading=(async()=>{
      await Promise.resolve(window.GARDEN_READY);
      if(!window.CityWorld)throw Error('City 3D module unavailable');
      const world=new window.CityWorld({host:$('cityWorldHost'),onMessage:message,onView:viewChanged,onError:sceneError});
      city.world=world;$('citySceneStatus').hidden=true;return world;
    })();
    try{return await city.loading;}catch(error){console.error(error);sceneError('三维场景暂时没有载入，点击重试。');return null;}finally{city.loading=null;}
  }
  async function enter(){
    location.hidden=true;experience.hidden=false;const version=++city.version;
    const world=await ensureWorld();if(!world||version!==city.version||overlay.hidden||experience.hidden)return;
    world.reset();world.activate();$('cityWorldHost').querySelector('canvas')?.focus({preventScroll:true});
  }
  async function togglePlaying(){
    if(city.playing){pause();message('在这里停一会儿，想继续时再开始。');return;}
    if(!city.world){message('等石桥和小猫准备好，再开始吧。');return;}
    city.playing=true;city.started=performance.now();const version=++city.version;
    city.world.setPlaying(true);$('cityPlayButton').textContent='暂停陪伴';message('声音轻轻响起，小猫陪你在桥头停一会儿。');
    city.timer=setInterval(updateTime,250);
    try{
      if(!city.sound)city.sound=new window.CitySoundscape();
      const started=await city.sound.start();
      if(version!==city.version||!city.playing){if(!city.playing)city.sound.stop();return;}
      updateMix();if(!started)message('当前浏览器未开启声音，仍可带着小猫漫游。');
    }catch(error){if(version===city.version)message('声音暂时没能开启，仍可带着小猫漫游。');}
  }
  function reset(){setQuiet(false);pause();city.accumulated=0;city.world?.reset();updateTime();$('cityPlayButton').textContent='开始陪伴';message('一段石板路，一只小猫，和此刻的你。');}
  function open(){
    reset();overlay.hidden=false;location.hidden=false;experience.hidden=true;app.classList.add('city-open');
    city.world?.deactivate();clearTimeout(city.locationTimer);$('cityLocateButton').disabled=false;$('cityLocateButton').textContent='模拟定位泉州';
    $('cityLocationStatus').dataset.ready='false';$('cityLocationText').textContent='尚未匹配城市';$('cityMatchCard').hidden=true;
    window.dispatchEvent(new Event('garden:city-enter'));$('cityLocateButton').focus({preventScroll:true});
  }
  function close(){pause();clearTimeout(city.locationTimer);city.world?.deactivate();overlay.hidden=true;app.classList.remove('city-open');$('cityButton').focus({preventScroll:true});}
  $('cityButton').addEventListener('click',open);$('cityCloseButton').addEventListener('click',close);$('cityExitButton').addEventListener('click',close);
  $('cityBackButton').addEventListener('click',()=>{pause();city.world?.deactivate();experience.hidden=true;location.hidden=false;$('cityLocateButton').focus({preventScroll:true});});
  $('cityLocateButton').addEventListener('click',()=>{
    if($('cityLocationStatus').dataset.ready==='true'){enter();return;}
    $('cityLocateButton').disabled=true;$('cityLocationText').textContent='正在匹配泉州…';
    city.locationTimer=setTimeout(()=>{$('cityLocationStatus').dataset.ready='true';$('cityLocationText').textContent='已匹配：泉州（模拟定位）';$('cityMatchCard').hidden=false;$('cityLocateButton').disabled=false;$('cityLocateButton').textContent='进入洛阳桥';},450);
  });
  $('cityWalkButton').addEventListener('click',()=>city.world?.walkBridge());
  $('cityFollowButton').addEventListener('click',()=>{if(city.world?.follow)city.world.setView('entrance');else city.world?.focusPerson();});
  $('cityZoomIn').addEventListener('click',()=>city.world?.canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'+'})));
  $('cityZoomOut').addEventListener('click',()=>city.world?.canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'-'})));
  $('cityHomeButton').addEventListener('click',()=>city.world?.setView('entrance'));
  $('cityPetButton').addEventListener('click',()=>city.world?.actors.pet());
  document.querySelectorAll('[data-city-view]').forEach(b=>b.addEventListener('click',()=>city.world?.setView(b.dataset.cityView)));
  $('cityPlayButton').addEventListener('click',togglePlaying);$('cityResetButton').addEventListener('click',reset);
  $('cityFinishButton').addEventListener('click',()=>{pause();message('这一段风景先留在这里。你还可以继续走走。');$('cityPlayButton').textContent='继续陪伴';});
  for(const [id,key,label] of [['cityWaterButton','water','水声'],['cityWindButton','wind','风声']])$(id).addEventListener('click',()=>{city[key]=!city[key];$(id).dataset.on=String(city[key]);$(id).setAttribute('aria-pressed',String(city[key]));$(id).textContent=label+' · '+(city[key]?'开':'关');updateMix();});
  $('cityRetryButton').addEventListener('click',()=>{city.world?.dispose();city.world=null;enter();});
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(experience.dataset.quiet==='true'){setQuiet(false);quietButton.focus();}else close();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&city.playing){pause();message('回来后，再继续听这段潮水。');}});
  window.addEventListener('pagehide',()=>{pause();city.world?.dispose();city.world=null;city.sound?.close();city.sound=null;});
  window.CityPrototype={open,close,get world(){return city.world;}};
})();
