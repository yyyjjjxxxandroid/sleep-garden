import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){return next(specifier==='three'?new URL('../vendor/three/build/three.module.js',import.meta.url).href:specifier,context);}});
globalThis.window={};
const T=await import('../vendor/three/build/three.module.js');
const {GardenCompanion}=await import('../garden-companion.js');
await import('../story-world.js');
const {createStoryCat}=await import('../story-cat.js');
function world(){return {cat:new T.Group(),scene:new T.Scene(),groundHeight:()=>0,inPond:(x,z)=>(x+10)**2+(z+10)**2<4,walkObstacles:[],state:{reduced:false},canvas:{dataset:{}},onExplore(){},onCatInteraction(){}};}
function advance(c,seconds){for(let t=0;t<seconds;t+=.05)c.update(.05);}

test('activity boundary permits nearby landmarks and blocks routes into the forest',()=>{
  const w=world(),c=new GardenCompanion(w);
  for(const [x,z] of [[4,4],[15,-10],[1,-12],[-7,-10]])assert.equal(c.walkable(x,z),true);
  for(const [x,z] of [[0,-25],[5,-32],[30,0],[-25,4]])assert.equal(c.walkable(x,z),false);
  assert.equal(c.goTo({x:5,z:-27}),false);
  w.cat.position.set(14,0,-15);c.stop();
  for(let i=0;i<4000;i++){c.update(.1);assert.equal(c.walkable(w.cat.position.x,w.cat.position.z),true,'successive roaming routes stay in the activity area');}
});

test('destination arrival rests briefly; replacing a target continues from the current location',()=>{
  const w=world(),c=new GardenCompanion(w);assert.equal(c.goTo({x:3,z:0}),true);advance(c,1);const start=w.cat.position.clone();assert.ok(start.x>1&&start.x<3);
  c.goTo({x:0,z:2});assert.deepEqual(w.cat.position,start);advance(c,4);assert.ok(w.cat.position.distanceTo(new T.Vector3(0,0,2))<.001);advance(c,1);assert.equal(c.phase,'idle');assert.ok(w.cat.position.distanceTo(new T.Vector3(0,0,2))<.001);
});
test('flower animation starts only after arrival, then resets and stays near the flower',()=>{
  const w=world(),c=new GardenCompanion(w),f=new T.Group();f.position.set(2,0,2);let sway=0;f.userData={approachRadius:.8,sway:x=>sway=x};
  assert.equal(c.visit(f),true);assert.equal(c.pose,null);advance(c,2);assert.equal(c.phase,'interacting');assert.ok(Math.abs(w.cat.position.distanceTo(f.position)-.8)<.001);assert.ok(c.pose);advance(c,.2);assert.notEqual(sway,0);advance(c,4);assert.equal(sway,0);assert.equal(c.pose,null);assert.equal(c.phase,'idle');
});
test('new commands and focusing the cat cancel and restore the flower pose',()=>{
  const w=world(),c=new GardenCompanion(w),f=new T.Group();f.position.set(1,0,0);let sway=0;f.userData={approachRadius:.8,sway:x=>sway=x};c.visit(f);advance(c,1);assert.notEqual(sway,0);c.goTo({x:2,z:2});assert.equal(sway,0);c.stop();assert.equal(c.phase,'idle');assert.equal(c.route.length,0);
});
test('explicit navigation remains functional when ambient motion is reduced',()=>{
  const w=world(),c=new GardenCompanion(w);w.state.reduced=true;c.goTo({x:1,z:1});advance(c,2);assert.equal(c.phase,'idle');assert.ok(w.cat.position.distanceTo(new T.Vector3(1,0,1))<.001);
});
test('six plots and record-to-plant mapping stay aligned, with one slot reserved during a session',()=>{
  const w=Object.create(window.GardenWorld.prototype);Object.assign(w,{scene:new T.Scene(),canvas:{dataset:{}},walkObstacles:[],state:{mode:'garden',records:Array.from({length:8},(_,id)=>({id:id+1,type:'wind',complete:true})),elapsed:0}});
  w.buildPlots();w.place=(_name,x,z)=>{const root=new T.Group();root.position.set(x,0,z);w.scene.add(root);return root;};w.updateGrowth();assert.equal(w.plots.length,6);assert.deepEqual(w.grown.map(p=>p.userData.record.id),[3,4,5,6,7,8]);
  assert.deepEqual(w.grown.map(p=>[p.position.x,p.position.z]),w.plots.map(p=>[p.position.x,p.position.z]));
  w.state.mode='session';w.updateGrowth();assert.deepEqual(w.grown.map(p=>p.userData.record?.id),[4,5,6,7,8,undefined]);
});
test('bite and rub are distinct poses and restore the neutral rig',()=>{
  const cat=createStoryCat({clock:()=>0,random:()=>.5});
  const animate=interaction=>cat.animate(2,false,0,false,.016,false,0,interaction);
  animate({action:'bite',time:1});assert.ok(cat.head.rotation.x>.3);assert.equal(cat.root.userData.flowerAction,'bite');
  animate({action:'rub',time:1});assert.ok(Math.abs(cat.head.position.x)>.01);assert.equal(cat.root.userData.flowerAction,'rub');
  animate(null);assert.equal(cat.head.rotation.x,0);assert.equal(cat.head.position.x,0);assert.equal(cat.root.userData.flowerAction,null);
});

test('five idle seconds resume safe roaming continuously from the current position',()=>{
  const w=world(),c=new GardenCompanion(w);w.cat.position.set(4,0,4);w.follow=true;
  let explores=0,notifications=0;w.onExplore=()=>explores++;w.onCatInteraction=()=>notifications++;
  c.stop();const origin=w.cat.position.clone();c.update(4.99);assert.equal(c.phase,'idle');assert.deepEqual(w.cat.position,origin);
  c.update(.02);assert.equal(c.phase,'roaming');assert.ok(w.cat.position.distanceTo(origin)>0);assert.ok(w.cat.position.distanceTo(origin)<=.64*.02+.00001);
  assert.equal(w.follow,true);assert.equal(explores,0);assert.equal(notifications,0);assert.equal(w.canvas.dataset.catCommand,undefined);
  for(let i=0;i<400&&c.phase==='roaming';i++)c.update(.05);
  assert.equal(c.phase,'idle');const resting=w.cat.position.clone();c.update(4.99);assert.deepEqual(w.cat.position,resting);c.update(.02);assert.equal(c.phase,'roaming');
});
test('petting resets the five-second countdown and new destinations interrupt autonomous walking',()=>{
  const w=world(),c=new GardenCompanion(w);c.stop();c.update(4);c.stop();c.update(4);assert.equal(c.phase,'idle');c.update(1.01);assert.equal(c.phase,'roaming');
  const origin=w.cat.position.clone();c.goTo({x:5,z:5});assert.equal(c.phase,'walking');assert.equal(c.autonomous,false);assert.deepEqual(w.cat.position,origin);assert.equal(w.canvas.dataset.catCommand,'1');assert.equal(c.marker.visible,true);
});
test('a long user-directed walk and a flower action each finish before their idle countdown',()=>{
  const w=world(),c=new GardenCompanion(w),flower=new T.Group();flower.position.set(15,0,0);flower.userData={approachRadius:.8,sway(){}};
  c.visit(flower);advance(c,6);assert.equal(c.phase,'walking');assert.equal(c.autonomous,false);
  for(let i=0;i<400&&c.phase==='walking';i++)c.update(.05);
  assert.equal(c.phase,'interacting');advance(c,3);assert.equal(c.phase,'interacting');
  for(let i=0;i<40&&c.phase==='interacting';i++)c.update(.05);
  c.update(4.99);assert.equal(c.phase,'idle');c.update(.02);assert.equal(c.phase,'roaming');
});
test('reduced motion and unavailable routes keep the cat safely resting',()=>{
  const w=world(),c=new GardenCompanion(w);c.stop();w.state.reduced=true;c.update(10);assert.equal(c.phase,'idle');assert.equal(w.catMoving,false);
  w.state.reduced=false;c.routeTo=()=>null;c.update(.05);assert.equal(c.phase,'idle');assert.equal(c.elapsed,0);assert.deepEqual(w.cat.position,new T.Vector3());
});

test('seeds appear only after start and keep their model through growth and saved records',()=>{
  const w=Object.create(window.GardenWorld.prototype);
  Object.assign(w,{scene:new T.Scene(),canvas:{dataset:{}},walkObstacles:[],state:{mode:'home',records:[],elapsed:0,seedChoice:'bellflower'}});
  w.buildPlots();w.place=(name,x,z)=>{const root=new T.Group();root.name=name;root.position.set(x,0,z);w.scene.add(root);return root;};
  w.updateGrowth();assert.ok(w.grown.every(p=>!p.visible));assert.equal(w.seedFeedback,undefined);
  for(const [seed,model] of [['fern','Grass_Common_Tall'],['bellflower','Flower_4_Group'],['waterleaf','Bush_Common_Flowers']]){
    w.state.mode='session';w.state.elapsed=0;w.plantSeed(seed,0);
    assert.equal(w.grown[0].name,model);assert.equal(w.grown[0].scale.x,.12);assert.equal(w.grown.filter(p=>p.visible).length,1);
    assert.equal(w.seedFeedback.position.x,w.plots[0].position.x);
    w.state.elapsed=90;w.updateGrowth();assert.equal(w.grown[0].scale.x,1);
    w.state.mode='garden';w.state.records=[{id:seed,type:seed,complete:true}];w.clearSeedFeedback();w.updateGrowth();
    assert.equal(w.grown[0].name,model);assert.equal(w.grown[0].scale.x,1);assert.equal(w.seedFeedback,null);
    w.state.records=[];
  }
});
