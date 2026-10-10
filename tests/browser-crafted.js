// Fresh page after a real click on #startButton. Tests the new optional
// interactions against a real Three.js scene and WebAudio parameter scheduling.
(async()=>{
  const $=id=>document.getElementById(id),canvas=document.querySelector('.garden-3d'),results=[];
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const assert=(ok,label)=>{if(!ok)throw Error(label);results.push(label)};
  const until=async condition=>{for(let i=0;i<500&&!condition();i++)await wait(20);assert(condition(),'scene reaches expected state')};
  let world;const update=GardenWorld.prototype.update;
  GardenWorld.prototype.update=function(now){world=this;GardenWorld.prototype.update=update;return update.call(this,now)};
  await until(()=>world&&canvas.dataset.ready==='true');
  $('totalTime').click();$('timerCancel').click();
  if(Number($('volume-cat').value)===0){$('soundButton').click();$('mute-cat').click();$('soundOverlay').querySelector('.close-sheet').click()}
  const saved=()=>JSON.parse(localStorage.getItem('sleepGarden.v1')||'{}');
  const initialRecords=(saved().records||[]).length;
  $('focusButton').click();await until(()=>world.follow&&canvas.dataset.catPose==='resting');
  assert($('app').classList.contains('focused')&&!$('petActions').hidden,'companion view exposes keyboard access and a resting cat');
  assert([...document.querySelectorAll('.pet-access button')].every(b=>getComputedStyle(b).clipPath==='inset(50%)'),'pet buttons do not cover the rendered scene');
  await until(()=>canvas.dataset.catExpression==='yawning');
  assert(world.cat.userData.expression==='yawning','a settled cat naturally yawns in the rendered scene');
  const beforeMix=JSON.stringify(saved().mix),beforePet=Number(canvas.dataset.petCount);
  const originalTarget=AudioParam.prototype.setTargetAtTime,originalResume=AudioContext.prototype.resume;
  let targets=[],resumes=0;
  AudioParam.prototype.setTargetAtTime=function(...args){targets.push(args);return originalTarget.apply(this,args)};
  AudioContext.prototype.resume=function(...args){resumes++;return originalResume.apply(this,args)};
  try{
    $('petButton').click();await wait(50);
    assert(Number(canvas.dataset.petCount)===beforePet+1&&canvas.dataset.petting==='true','petting triggers the real 3D actor');
    assert(canvas.dataset.catExpression==='content','petting has immediate visible feedback');
    assert(targets.length===2&&targets[0][0]>targets[1][0]&&targets[1][1]>targets[0][1],'petting schedules a gentle purr increase and return');
    assert(JSON.stringify(saved().mix)===beforeMix,'petting does not overwrite the saved sound recipe');
    await wait(300);
    assert(canvas.dataset.catExpression==='content','petting takes priority over the idle yawn');
    $('petButton').click();await wait(30);
    assert(Number(canvas.dataset.petCount)===beforePet+1,'rapid repeated petting is coalesced');
    $('soundButton').click();if($('mute-cat').getAttribute('aria-pressed')==='true')$('mute-cat').click();$('soundOverlay').querySelector('.close-sheet').click();await wait(700);targets=[];
    const mutedCount=Number(canvas.dataset.petCount);$('petButton').click();await wait(50);
    assert(Number(canvas.dataset.petCount)===mutedCount+1&&targets.length===0&&$('volume-cat').value==='0','a muted cat reacts visually without unmuting its channel');
    $('playButton').click();await wait(700);targets=[];
    const elapsed=$('elapsed').textContent;
    $('chinButton').click();await wait(80);
    assert(world.cat.userData.petZone==='chin'&&canvas.dataset.catExpression==='content'&&$('petHint').textContent===world.cat.userData.reactionLabel, 'chin scratching produces its own pose and matching explanation');
    await wait(1120);
    assert(targets.length===0&&resumes===0&&$('app').dataset.audio==='paused','petting while paused cannot open or adjust audio');
    assert($('elapsed').textContent===elapsed,'petting while paused cannot advance the listening clock');
    assert((saved().records||[]).length===initialRecords,'optional interactions never create a plant record');
    $('backFocus').click();await wait(1200);
    assert(!$('app').classList.contains('focused')&&!world.follow,'returning to the garden resumes wandering');
    const touches=Number(canvas.dataset.waterTouches||0),beforeWaterTargets=targets.length;canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));await wait(50);
    assert(!document.querySelector('.water-touch')&&getComputedStyle(document.querySelector('.water-access')).clipPath==='inset(50%)','water interaction leaves no floating button on the lawn');
    assert(Number(canvas.dataset.waterTouches)===touches+1&&world.touchRings.some(r=>r.visible),'keyboard water interaction creates visible ripples');
    assert($('app').dataset.audio==='paused'&&targets.length===beforeWaterTargets,'water touch adds no audio scheduling');
    await wait(2700);assert(world.touchRings.every(r=>!r.visible),'touch ripples clean up after their short response');
    world.state.reduced=true;world.touchWater(world.water.position);await wait(50);
    assert(world.touchRings.every(r=>Math.abs(r.scale.x-.65)<.001),'reduced motion uses static rings instead of expansion');
    const frozenTime=world.t,frozenPosition=world.cat.position.clone();await wait(150);
    assert(world.t===frozenTime&&world.cat.position.equals(frozenPosition)&&canvas.dataset.catExpression!=='yawning','reduced motion freezes wandering and suppresses idle yawns');
    world.state.reduced=false;
    const projected=world.water.position.clone().project(world.camera),r=canvas.getBoundingClientRect();
    const ray=world.pick(r.left+(projected.x+1)*r.width/2,r.top+(1-projected.y)*r.height/2);
    assert(ray.intersectObject(world.details.pond).length>0,'visible pond supports an actual geometry hit');
    const radioPoint=world.craft.radio.localToWorld(world.cat.position.clone().set(0,.29,.17)).project(world.camera);
    const radioHit=world.visibleHit(world.pick(r.left+(radioPoint.x+1)*r.width/2,r.top+(1-radioPoint.y)*r.height/2));
    assert(radioHit?.object.userData.soundControl,'the physical radio has visible pickable geometry after scenery batching');
    canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'m',bubbles:true}));
    assert(!$('soundOverlay').hidden&&$('app').dataset.audio==='paused'&&resumes===0,'the keyboard radio opens sound settings without resuming a paused session');
    $('soundOverlay').querySelector('.close-sheet').click();
    $('focusButton').click();await until(()=>world.follow&&canvas.dataset.catPose==='resting');await until(()=>world.camera.position.distanceTo(world.catView().target.add(world.catView().offset))<.06);
    const head=world.storyCat.head.getWorldPosition(world.cat.position.clone()).project(world.camera),box=canvas.getBoundingClientRect();
    const x=box.left+(head.x+1)*box.width/2,y=box.top+(1-head.y)*box.height/2;
    // Synthetic two-finger input exercises the DOM/OrbitControls integration.
    // Pointer capture itself requires trusted input and is verified separately.
    const capture=canvas.setPointerCapture,release=canvas.releasePointerCapture;
    canvas.setPointerCapture=function(id){if(id!==901&&id!==902)capture.call(this,id)};
    canvas.releasePointerCapture=function(id){if(id!==901&&id!==902)release.call(this,id)};
    const pointer=(type,id,px,py)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:id===901,clientX:px,clientY:py,buttons:type==='pointerup'?0:1,bubbles:true}));
    try{
      const location=(local,object=world.storyCat.head)=>{const p=object.localToWorld(world.cat.position.clone().set(...local)).project(world.camera);return {x:box.left+(p.x+1)*box.width/2,y:box.top+(1-p.y)*box.height/2}};
      const downCount=world.cat.userData.petCount||0,downAudio=targets.length;
      pointer('pointerdown',901,x,y);await wait(80);
      assert(world.cat.userData.contact&&world.cat.userData.expression==='content','holding the cat maintains physical contact');
      const left=location([-.24,.05,.46]);pointer('pointermove',901,left.x,left.y);await wait(180);
      const leftTilt=world.storyCat.head.rotation.z;
      const right=location([.24,.05,.46]);pointer('pointermove',901,right.x,right.y);await wait(180);
      assert(leftTilt>.005&&world.storyCat.head.rotation.z<-.005,'stroking left and right changes the lean instead of replaying one canned response');
      const heldCamera=world.camera.position.clone();await wait(1400);
      assert(world.camera.position.distanceTo(heldCamera)<.001,'contact freezes the companion camera beneath the hand');
      assert(world.cat.userData.contact&&world.cat.userData.response>.75,'a held touch does not fade while the hand remains on the cat');
      assert(world.cat.userData.petCount===downCount+1&&targets.length===downAudio&&resumes===0,'continuous stroking counts one contact and adds no repeated audio scheduling');
      const heldResponse=world.cat.userData.response;pointer('pointercancel',901,right.x,right.y);await wait(160);
      assert(!world.cat.userData.contact&&world.cat.userData.response>0&&world.cat.userData.response<heldResponse&&world.controls.enabled&&world.activePointers.size===0,'cancelling contact eases the pose out and restores camera input');
      await wait(350);
      const chin=location([0,-.30,.46]);
      pointer('pointerdown',901,chin.x,chin.y);await wait(80);
      assert(world.cat.userData.petZone==='chin'&&world.storyCat.head.rotation.x<0,'touching the rendered chin lifts the head without a visible button');
      await wait(320);
      assert(world.storyCat.head.rotation.x<-.32&&world.storyCat.head.position.y>1.11&&world.storyCat.reaction.visible,'a chin scratch raises the muzzle clearly and acknowledges contact with a brief reaction');
      const chinCamera=world.camera.position.clone(),chinPetCount=world.cat.userData.petCount;
      for(const [dx,dy]of [[5,-2],[-5,1],[6,0],[-4,3]]){pointer('pointermove',901,chin.x+dx,chin.y+dy);await wait(60);assert(world.cat.userData.petZone==='chin'&&world.cat.userData.contact,'small finger movements keep chin contact while the head lifts')}
      await wait(700);
      assert(!world.storyCat.reaction.visible&&world.storyCat.head.rotation.x<-.32,'the acknowledgment ends once while the relaxed chin pose remains held');
      assert(world.camera.position.distanceTo(chinCamera)<.001&&world.cat.userData.petCount===chinPetCount&&targets.length===downAudio&&resumes===0,'sustained chin scratching keeps the camera still and adds no repeated audio or contact events');
      let stableRub=true;
      for(let i=0;i<3;i++)for(const dy of [8,16,24,16,8,0,-8,-16,-24,-16,-8,0]){pointer('pointermove',901,chin.x,chin.y+dy);await wait(35);stableRub&&=world.cat.userData.contact&&world.cat.userData.petZone==='chin'&&world.storyCat.head.rotation.x<-.32&&!world.storyCat.reaction.visible}
      assert(stableRub,'holding the chin and repeatedly rubbing up/down keeps the chin pose without nodding or replaying the reaction');
      const upper=location([0,.20,.46]),lower=location([.29,.15,.37],world.cat);
      let wideRub=true;
      for(let i=0;i<3;i++)for(const p of [lower,upper,lower,upper,chin]){pointer('pointermove',901,p.x,p.y);await wait(70);wideRub&&=world.cat.userData.contact&&world.cat.userData.petZone==='chin'&&world.storyCat.head.rotation.x<-.32&&!world.storyCat.reaction.visible}
      assert(wideRub,'wide rubbing across face and body remains one chin scratch until the hand clearly leaves the cat');
      const outsideY=world.gesture.contactBounds.max.y+40;
      pointer('pointermove',901,chin.x,outsideY);await wait(100);
      assert(!world.cat.userData.contact,'dragging below the cat ends contact instead of sticking to the chin');
      for(let i=0;i<3;i++){pointer('pointermove',901,chin.x,chin.y);await wait(120);assert(world.cat.userData.contact&&world.cat.userData.petZone==='chin'&&!world.storyCat.reaction.visible,'returning to the chin in the same press cannot restart the reaction');pointer('pointermove',901,chin.x,outsideY);await wait(120)}
      pointer('pointermove',901,chin.x,chin.y);await wait(160);
      assert(world.camera.position.distanceTo(chinCamera)<.001&&world.cat.userData.petCount===chinPetCount&&targets.length===downAudio&&resumes===0,'dragging away and back adds no camera movement, sound or repeated contact events');
      pointer('pointerup',901,chin.x-4,chin.y+3);await wait(160);
      assert(!world.cat.userData.contact&&world.cat.userData.chinResponse>0&&world.controls.enabled,'releasing a chin scratch eases out of the pose and restores camera input');
      await wait(500);
      const back=location([.43,.70,-.40],world.cat);pointer('pointerdown',901,back.x,back.y);await wait(80);
      assert(world.cat.userData.petZone==='back','touching the flank picks the body response');
      pointer('pointerup',901,back.x,back.y);await wait(500);
      pointer('pointerdown',901,x,y);
      assert(!world.controls.enabled&&$('app').classList.contains('focused'),'first finger on the cat begins a stroke');
      pointer('pointerdown',902,x+60,y);
      assert(world.controls.enabled&&!$('app').classList.contains('focused'),'second finger switches a stroke to camera control');
      const distance=world.camera.position.distanceTo(world.controls.target);
      pointer('pointermove',902,x+100,y);await wait(80);
      assert(world.camera.position.distanceTo(world.controls.target)<distance,'two-finger separation zooms the camera');
      pointer('pointerup',901,x,y);pointer('pointerup',902,x+100,y);
      assert(world.controls.enabled&&world.activePointers.size===0,'releasing both fingers leaves camera input available');
    }finally{pointer('pointercancel',901,x,y);pointer('pointercancel',902,x,y);canvas.setPointerCapture=capture;canvas.releasePointerCapture=release}

  }finally{AudioParam.prototype.setTargetAtTime=originalTarget;AudioContext.prototype.resume=originalResume}
  return {passed:results.length,results};
})();
