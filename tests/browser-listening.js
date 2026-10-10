// Manual browser regression after a trusted click on Start. This script is
// not part of the Node suite; run only when browser access is permitted.
(async()=>{
  const $=id=>document.getElementById(id),app=$('app'),results=[];
  const assert=(ok,label)=>{if(!ok)throw Error(label);results.push(label)};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const recipe=()=>JSON.stringify(JSON.parse(localStorage.getItem('sleepGarden.v1')||'{}').mix);
  const records=()=>JSON.parse(localStorage.getItem('sleepGarden.v1')||'{}').records?.length||0;
  const beforeRecipe=recipe(),beforeRecords=records();
  assert(app.dataset.audio==='running','fresh listening session is playing');
  assert(!$('quietButton')&&!$('sceneGuide'),'the dock uses main’s original control groups');
  assert($('playButton').getBoundingClientRect().height>=44&&$('soundButton').getClientRects().length>0,'pause and sound settings remain visible');
  $('playButton').click();await wait(100);const elapsed=$('elapsed').textContent;await wait(1100);
  assert(app.dataset.audio==='paused'&&$('elapsed').textContent===elapsed,'pause stops sound and listening time');
  assert($('sessionStatus').getAttribute('aria-label')==='声音和计时已暂停','pause scope remains accessible');
  let world;const update=GardenWorld.prototype.update;
  GardenWorld.prototype.update=function(now){world=this;GardenWorld.prototype.update=update;return update.call(this,now)};
  for(let i=0;i<100&&!world;i++)await wait(20);assert(!!world,'rendered world is available');
  const position=world.cat.position.clone(),heading=world.cat.rotation.y;
  $('focusButton').click();await wait(1500);
  assert(world.cat.position.distanceTo(position)<.001&&world.cat.rotation.y===heading,'approaching moves the camera without sliding or turning the cat');
  world.cat.updateMatrixWorld(true);const paws=[];world.cat.traverse(o=>{if(o.name.startsWith('paw-'))paws.push(o)});
  assert(paws.length===4&&paws.filter(o=>o.name.includes('front')).every(o=>Math.abs(o.getWorldPosition(position.clone()).y-world.cat.position.y-.13*world.cat.scale.x)<.015),'front paws keep ground contact');
  $('backFocus').click();await wait(300);
  assert(world.cat.position.distanceTo(position)<.001&&world.cat.rotation.y===heading,'returning to the garden keeps the actor in place during the transition');
  assert(app.dataset.audio==='paused'&&$('elapsed').textContent===elapsed&&recipe()===beforeRecipe&&records()===beforeRecords,'camera commands neither resume audio nor change the recipe or records');
  $('finishButton').click();$('finishButton').click();
  assert(records()===beforeRecords+1,'ending saves only one record');
  return {passed:results.length,results};
})();
