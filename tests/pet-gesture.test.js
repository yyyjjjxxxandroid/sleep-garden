const {test}=require('node:test');
const assert=require('node:assert/strict');

// Real Three.js geometry and production pointer handlers, without a renderer.
// These tests do not replace browser or physical-device verification.
async function fixture(width=390,height=844,framed=false){
  globalThis.window??={};
  const T=await import('../vendor/three/build/three.module.js');
  const {createStoryCat}=await import('../story-cat.js');
  await import('../story-world.js');
  const elements=new Map();
  globalThis.document={getElementById(id){
    if(!elements.has(id)){const e=new EventTarget();e.textContent='';e.click=()=>{};elements.set(id,e)}
    return elements.get(id);
  }};
  const canvas=new EventTarget(),captured=new Set();
  Object.assign(canvas,{dataset:{},getBoundingClientRect:()=>({left:0,top:0,width,height}),setAttribute(){},setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)});
  let time=0;
  const actor=createStoryCat({clock:()=>time}),cat=actor.root,scene=new T.Scene();scene.add(cat);cat.scale.setScalar(1.06);
  const camera=new T.PerspectiveCamera(42,width/height,.1,100);camera.position.set(3.8,2.8,9);camera.lookAt(0,.65,0);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
  const world=Object.assign(Object.create(window.GardenWorld.prototype),{canvas,storyCat:actor,cat,scene,camera,follow:true,state:{focused:true},controls:{enabled:true},onExplore(){}});
  if(framed){
    document.getElementById('controls').getBoundingClientRect=()=>({left:10,top:height-210,width:width-20,height:194,bottom:height-16});
    document.getElementById('backFocus').getBoundingClientRect=()=>({left:20,top:94,width:104,height:44,bottom:138});
    const view=world.catView();camera.position.copy(view.target).add(view.offset);camera.lookAt(view.target);camera.updateMatrixWorld(true);
  }
  world.bindPicking();let contacts=0,acknowledgments=0;
  document.getElementById('cat').addEventListener('petcontact',e=>{contacts++;actor.pet(e.detail.zone)});
  const touch=actor.touch;actor.touch=(zone,point,ack)=>{if(ack)acknowledgments++;return touch(zone,point,ack)};
  const point=(object,x,y,z)=>{const p=object.localToWorld(new T.Vector3(x,y,z)).project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2}};
  const chin=point(actor.head,0,-.30,.46),face=point(actor.head,0,.2,.46),paw=point(cat,.29,.15,.37);
  function send(type,p){
    const event=new Event(type);Object.assign(event,{pointerId:1,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:p.x,clientY:p.y});canvas.dispatchEvent(event);
    for(let i=0;i<20;i++){time+=.016;actor.animate(time,false,0,true,.016)}scene.updateMatrixWorld(true);
  }
  const advance=seconds=>{for(let i=0;i<Math.ceil(seconds*60);i++){time+=1/60;actor.animate(time,false,0,true,1/60)}scene.updateMatrixWorld(true)};
  return {world,actor,chin,face,paw,send,point,advance,counts:()=>({contacts,acknowledgments})};
}

for(const [width,height]of [[320,740],[390,844],[1280,800]])test(`fitted close-up supports wide chin rubbing while standing and lying at ${width}px`,async()=>{
  const f=await fixture(width,height,true);
  const rub=()=>{
    const chin=f.point(f.actor.head,0,-.30,.46),face=f.point(f.actor.head,0,.2,.46),paw=f.point(f.actor.root,.29,.15,.37);
    f.send('pointerdown',chin);
    for(let round=0;round<3;round++)for(const p of [paw,face,chin]){f.send('pointermove',p);assert.equal(f.actor.root.userData.petZone,'chin');assert.ok(f.actor.head.rotation.x<-.32)}
    f.send('pointerup',chin);
  };
  rub();f.advance(12);assert.ok(f.actor.root.userData.lieWeight>.98);rub();
  assert.ok(f.actor.root.userData.lieWeight>.98,'rubbing a lying cat must not make it get up');assert.deepEqual(f.counts(),{contacts:2,acknowledgments:2});
});

for(const [width,height]of [[320,740],[390,844],[1440,900]])test(`chin scratch stays one action across face/body boundaries at ${width}px`,async()=>{
  const f=await fixture(width,height);f.send('pointerdown',f.chin);const reaction=f.world.cat.userData.reactionName;
  for(let round=0;round<3;round++)for(const p of [f.paw,f.face,f.paw,f.face,f.chin]){
    f.send('pointermove',p);
    assert.equal(f.world.cat.userData.petZone,'chin');
    assert.equal(f.world.cat.userData.contact,true);
    assert.equal(f.world.cat.userData.reactionName,reaction,'rubbing must not reroll the chosen response');
    assert.ok(f.actor.head.rotation.x<-.32,'the head must not drop when rubbing crosses a mesh boundary');
  }
  assert.deepEqual(f.counts(),{contacts:1,acknowledgments:1});
  f.send('pointerup',f.chin);
});

test('chin contact leaves the cat, returns without replay, and releases camera input',async()=>{
  const f=await fixture();f.send('pointerdown',f.chin);
  const outside={x:1000,y:1000};
  for(let i=0;i<3;i++){
    f.send('pointermove',outside);assert.equal(f.world.cat.userData.contact,false);assert.equal(f.world.controls.enabled,false);
    f.send('pointermove',f.chin);assert.equal(f.world.cat.userData.contact,true);assert.equal(f.world.cat.userData.petZone,'chin');
  }
  assert.deepEqual(f.counts(),{contacts:1,acknowledgments:1});
  f.send('pointercancel',f.chin);assert.equal(f.world.cat.userData.contact,false);assert.equal(f.world.controls.enabled,true);assert.equal(f.world.activePointers.size,0);
  f.send('pointerdown',f.paw);assert.equal(f.world.cat.userData.petZone,'back','a new press can select the body normally');f.send('pointerup',f.paw);
});

test('entering the chin from the head also starts one continuous scratch',async()=>{
  const f=await fixture();f.send('pointerdown',f.face);assert.equal(f.world.cat.userData.petZone,'head');
  f.send('pointermove',f.chin);assert.equal(f.world.cat.userData.petZone,'chin');
  for(const p of [f.paw,f.face,f.paw]){f.send('pointermove',p);assert.equal(f.world.cat.userData.petZone,'chin');assert.ok(f.actor.head.rotation.x<-.32)}
  assert.deepEqual(f.counts(),{contacts:1,acknowledgments:1});f.send('pointerup',f.paw);
});

test('pointer gaze uses the projected cat as its centre and follows up/down on a narrow screen',async()=>{
  const f=await fixture();f.world.follow=true;
  const centre=f.point(f.actor.head,0,0,0);
  f.world.lookAtPointer(centre.x,centre.y);
  for(let i=0;i<45;i++)f.actor.animate(i/60,false,0,true,1/60);
  assert.ok(Math.abs(f.actor.head.rotation.x)<.005);
  f.world.lookAtPointer(centre.x,centre.y-80);
  for(let i=0;i<45;i++)f.actor.animate(i/60,false,0,true,1/60);
  assert.ok(f.actor.head.rotation.x<-.05,`upward pitch: ${f.actor.head.rotation.x}`);
  f.world.lookAtPointer(centre.x,centre.y+80);
  for(let i=0;i<45;i++)f.actor.animate(i/60,false,0,true,1/60);
  assert.ok(f.actor.head.rotation.x>.05,`downward pitch: ${f.actor.head.rotation.x}`);
  f.world.follow=false;f.world.lookAtPointer(centre.x+80,centre.y+80);
  for(let i=0;i<45;i++)f.actor.animate(i/60,false,0,true,1/60);
  assert.ok(Math.abs(f.actor.head.rotation.x)<.005,'the garden view should release pointer attention');
});

for(const [width,height]of [[320,740],[390,844],[1440,900]])test(`direct face touches follow the hand across both cheeks at ${width}px`,async()=>{
  const f=await fixture(width,height),left=f.point(f.actor.head,-.35,.04,.43),right=f.point(f.actor.head,.35,.04,.43);
  f.send('pointerdown',left);const name=f.actor.root.userData.reactionName;
  assert.equal(f.actor.root.userData.petZone,'head');assert.equal(f.actor.root.userData.touchSide,-1);assert.ok(f.actor.head.position.x<-.01);
  f.send('pointermove',right);f.send('pointermove',right);
  assert.equal(f.actor.root.userData.petZone,'head');assert.equal(f.actor.root.userData.touchSide,1);assert.ok(f.actor.head.position.x>.01);
  assert.equal(f.actor.root.userData.reactionName,name);assert.deepEqual(f.counts(),{contacts:1,acknowledgments:0});
  assert.equal(f.world.controls.enabled,false);f.send('pointerup',right);assert.equal(f.world.controls.enabled,true);
});

for(const [width,height]of [[320,740],[390,844],[1440,900]])test(`the visible back supports a continuous shoulder-to-tail stroke at ${width}px`,async()=>{
  const f=await fixture(width,height),points=[-.1,-.2,-.3,-.4].map(z=>f.point(f.actor.root,.43,.75,z));
  f.send('pointerdown',points[0]);const name=f.actor.root.userData.reactionName;
  assert.equal(f.actor.root.userData.petZone,'back');
  for(const p of points.slice(1)){f.send('pointermove',p);assert.equal(f.actor.root.userData.petZone,'back')}
  assert.equal(f.actor.root.userData.backStrokeCount,1);assert.equal(f.actor.root.userData.reactionName,name);
  assert.deepEqual(f.counts(),{contacts:1,acknowledgments:0});f.send('pointerup',points.at(-1));
});
