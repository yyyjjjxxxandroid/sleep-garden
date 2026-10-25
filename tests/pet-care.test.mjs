import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readPetState,savePetState,remember,relationship,PET_KEY,PET_LOOKS} from '../pet-care-state.mjs';
import {createStoryCat} from '../story-cat.js';
import {PetCare} from '../pet-care.js';
import * as T from '../vendor/three/build/three.module.js';
import {PET_LAYOUT,inPetClearing} from '../pet-layout.mjs';
import {GardenCompanion} from '../garden-companion.js';
import {installGardenContent} from '../story-garden-content.js';

test('care state survives refresh; malformed storage cannot invent outfits or counters',()=>{
  let saved;const storage={getItem:()=>saved,setItem:(k,v)=>{assert.equal(k,PET_KEY);saved=v}};
  const state=readPetState(storage);state.care=6;state.outfit.scarf='blue';state.foods.meal=2;
  remember(state,{key:'meal',title:'第一碗饭'},{weather:'细雨',music:'自然声陪伴'},100);
  assert.equal(savePetState(storage,state),true);assert.deepEqual(readPetState(storage),state);
  saved='{"care":-99,"outfit":{"head":"random"},"memories":[null]}';
  assert.equal(readPetState(storage).care,0);assert.equal(readPetState(storage).outfit.head,'none');
  saved='broken';assert.deepEqual(readPetState(storage).memories,[]);
  assert.equal(savePetState({setItem(){throw Error('quota')}},state),false);
});
test('first memories deduplicate and snapshot actual outfit instead of mutating the past',()=>{
  const state=readPetState();state.outfit.collar='rose';
  remember(state,{key:'outfit',title:'新装扮'},{weather:'晴天'},10);state.outfit.collar='sage';
  assert.equal(remember(state,{key:'outfit',title:'duplicate'}),null);
  assert.equal(state.memories[0].outfit.collar,'rose');
  for(let i=0;i<20;i++)remember(state,{key:`photo-${i}`,title:'此刻'},{},i+20);
  assert.equal(state.memories.length,12);assert.equal(relationship(0),'刚刚认识');assert.equal(relationship(12),'熟悉的家人');
});
test('object actions deform real bones smoothly and recover before walking',()=>{
  let time=0;const cat=createStoryCat({clock:()=>time,random:()=>.4});
  for(const action of ['meal','water','treat','scratch','ball','cushion','box']){
    const duration=6;let previous=cat.head.rotation.x,maxStep=0,low=Infinity,high=-Infinity;
    for(let f=0;f<360;f++){time+=1/60;cat.animate(time,false,0,true,1/60,false,0,{action,time:f/60,duration});maxStep=Math.max(maxStep,Math.abs(cat.head.rotation.x-previous));previous=cat.head.rotation.x;low=Math.min(low,previous);high=Math.max(high,previous)}
    assert.ok(maxStep<.15,`${action} pose must not snap`);
    if(['meal','water','treat'].includes(action))assert.ok(high-low>.35,`${action} lowers its head`);
    for(let f=0;f<120;f++){time+=1/60;cat.animate(time,true,0,false,1/60,false,time*4,{action:'walk',time:0})}
    assert.ok(cat.root.userData.lieWeight<.02);assert.equal(cat.root.userData.careAction,null);
  }
});
test('prop placement uses dry clear reachable land and respects other props',()=>{
  const care=Object.create(PetCare.prototype);care.props={box:{position:{x:5,z:5},userData:{radius:1}}};
  care.w={plots:[{position:{x:8,z:5}}],companion:{walkable:(x,z)=>x>2&&z>2,routeTo:()=>[{}]}};
  const p=care.findSpot(5,5,.6);assert.ok(p);assert.ok(Math.hypot(p.x-5,p.z-5)>=1.95);assert.ok(Math.hypot(p.x-8,p.z-5)>=2.6);
  care.w.companion.walkable=()=>false;assert.equal(care.findSpot(0,0),null);
});
test('actual action completion, not button clicks, earns care and food records',()=>{
  const care=Object.create(PetCare.prototype);care.data=readPetState();care.elapsed=30;care.props={};care.treat={visible:true};care.w={companion:{stop(){}}};care.services={toast(){}};care.save=()=>{};care.queueMemory=(k)=>care.event=k;
  care.complete({kind:'meal',automatic:false});assert.equal(care.data.foods.meal,1);assert.equal(care.data.care,1);assert.equal(care.event,'meal');assert.equal(care.cooldown,42);
});
test('accessories are attached to moving head/body bones and previews are reversible',()=>{
  const care=Object.create(PetCare.prototype);const cat=createStoryCat();care.w={cat:cat.root,storyCat:cat,canvas:{dataset:{}}};care.buildClothes();
  care.applyOutfit({collar:'sage',scarf:'blue',head:'flower'});assert.equal(care.hair.parent,cat.head);assert.equal(care.scarf.parent.name,'companion-body');assert.ok(care.flower.visible);
  care.applyOutfit({collar:'none',scarf:'none',head:'none'});assert.equal(care.hair.visible,false);assert.equal(care.scarf.visible,false);assert.equal(care.collar.visible,false);
  assert.ok(care.scarfEnd.geometry.attributes.position.count>100,'bandana has curved fabric geometry');
  assert.ok(care.scarfBand.material.bumpMap,'cloth has a woven surface');
  assert.equal(care.bowMaterial.color.getHexString(),'98b4bd','blue outfit has blue ribbon');
  care.applyOutfit(PET_LOOKS.find(l=>l.name==='玫瑰花园').outfit);
  assert.equal(care.rose.visible,true);assert.equal(care.flower.visible,false);assert.equal(care.bow.visible,false);
  assert.equal(care.rose.children.filter(o=>o.name.startsWith('rose-petal')).length,18);
});

test('failed photographs retry without creating an empty memory or consuming the first event',()=>{
  const care=Object.create(PetCare.prototype);care.data=readPetState();care.elapsed=30;care.w={};let message='';care.services={toast:s=>message=s};
  care.pendingMemory={key:'meal',title:'第一碗饭',at:30};care.captureMemory();assert.equal(care.data.memories.length,0);assert.equal(care.data.firsts.length,0);assert.equal(care.pendingMemory.retries,1);
  care.captureMemory();care.captureMemory();assert.equal(care.pendingMemory,null);assert.match(message,/未拍好/);
});

test('cat nook occupies the marked cairn clearing; all props fit and remain reachable',async()=>{
  globalThis.window??={};await import('../story-world.js');
  const w=Object.assign(Object.create(window.GardenWorld.prototype),{scene:new T.Scene(),quality:'mid',walkObstacles:[],plots:[],canvas:{dataset:{}},state:{reduced:false},cat:new T.Group(),place:()=>new T.Group()});
  w.cat.position.set(1.7,w.groundHeight(1.7,4.4),4.4);w.companion=new GardenCompanion(w);
  w.cozyContent=installGardenContent(w,T);
  const care=Object.create(PetCare.prototype);care.w=w;care.props={};care.buildProps();
  assert.deepEqual(Object.keys(care.props).sort(),Object.keys(PET_LAYOUT).sort(),'no missing props');
  const nook=care.props.nook;assert.ok(Math.hypot(nook.position.x-10,nook.position.z+1)<.5,'nook stays in the marked spot');
  for(const [key,g]of Object.entries(care.props)){
    assert.ok(inPetClearing(g.position.x,g.position.z),key+' stays in cleared lawn');
    assert.ok(w.companion.routeTo({x:g.position.x,z:g.position.z+(['meal','water'].includes(key)?.80:key==='scratch'?1.10:0)}),key+' accessible from open side');
    const b=new T.Box3().setFromObject(g);
    for(const other of Object.values(care.props))if(other!==g)assert.equal(b.intersectsBox(new T.Box3().setFromObject(other)),false,key+' does not overlap '+other.name);
    for(const scenery of w.cozyContent.root.children.filter(o=>o.isGroup))assert.equal(b.intersectsBox(new T.Box3().setFromObject(scenery)),false,key+' does not overlap '+scenery.name);
    assert.equal(w.clearForPlanting(g.position.x,g.position.z,.3),false,'procedural flowers avoid '+key);
  }
  for(const key of ['meal','water'])assert.ok(care.props[key].position.distanceTo(nook.position)<3.5,'bowls stay by the nook');
  assert.equal(w.companion.walkable(nook.position.x+.96,nook.position.z),false,'solid wall blocks walking');
  assert.equal(w.companion.walkable(nook.position.x,nook.position.z+1.2),true,'front door stays clear');
});

test('retired look is absent and previous rose wearers receive a rose without rewriting memories',()=>{
  assert.equal(PET_LOOKS.length,4);assert.ok(!PET_LOOKS.some(l=>l.name==='鼠尾草日常'));
  const old={collar:'rose',scarf:'none',head:'flower'},memory={title:'旧照片',at:10,outfit:old};
  const state=readPetState({getItem:()=>JSON.stringify({outfit:old,memories:[memory]})});
  assert.equal(state.outfit.head,'rose');assert.equal(state.memories[0].outfit.head,'flower');
  assert.equal(readPetState({getItem:()=>JSON.stringify({outfit:{collar:'sage',scarf:'none',head:'none'}})}).outfit.collar,'none');
});

test('scratching paws lift over the board edge, stay above ribs and retract smoothly',()=>{
  let now=0;const cat=createStoryCat({clock:()=>now,random:()=>.4}),root=cat.root,board=new T.Vector3(3,.175,4);
  root.scale.setScalar(.609375);root.position.set(3,.15,5.10);root.rotation.y=Math.PI;
  const previous=new Map();let contact=0,maxStep=0;
  for(let frame=0;frame<=420;frame++){
    now=frame/60;cat.animate(now,false,0,true,1/60,false,0,{action:'scratch',time:now,duration:7,board});root.updateMatrixWorld(true);
    for(const side of [-1,1]){
      const foot=root.getObjectByName(`paw-front-${side}`),p=foot.getWorldPosition(new T.Vector3());
      if(previous.has(side))maxStep=Math.max(maxStep,p.distanceTo(previous.get(side)));previous.set(side,p);
      // Expanded board bounds include the entire paw (not just its centre).
      if(Math.abs(p.x-board.x)<.425+.11&&p.z-board.z<.725+.13){
        const top=board.y+.095+Math.min(.675,p.z-board.z)*.06+.012;
        assert.ok(p.y-.13*.609375>=top-.002,`paw intersects board at ${now.toFixed(2)}: ${p.y-top}`);
        contact++;
      }
    }
  }
  assert.ok(contact>400,'paws actually reach the board');assert.ok(maxStep<.025,`continuous paw motion ${maxStep}`);
});

test('bedding support persists after completion while the scratch station remains on ground',()=>{
  const care=Object.create(PetCare.prototype);care.props={box:{position:new T.Vector3(0,0,0)},nook:{position:new T.Vector3(10,0,0)}};care.w={cat:new T.Group()};
  care.job=null;assert.equal(care.supportHeight,.20);care.w.cat.position.x=10;assert.equal(care.supportHeight,.34);
  care.w.cat.position.set(5,0,5);care.job={kind:'scratch',point:{x:5,z:5}};assert.equal(care.supportHeight,0);
});

test('all prop actions wait for facing alignment before their animation begins',()=>{
  for(const kind of ['meal','water','treat','ball','box','scratch','nook']){
    const care=Object.create(PetCare.prototype),cat=new T.Group(),c={phase:'idle',route:[],stop(){this.phase='idle'}};
    Object.assign(care,{w:{cat,companion:c,state:{mode:'session'},canvas:{dataset:{}}},services:{},launcher:{},overlay:{hidden:true},data:{care:0},elapsed:0,greeted:true,ball:{visible:false},props:{},nextAutonomy:100});
    care.job={kind,stage:'approach',point:{x:0,z:0},lookTarget:{x:0,z:-1},route:c.route,total:0,time:0,duration:7};
    care.update(1/60);assert.equal(care.job.stage,'align');assert.equal(care.pose.action,'align');
    for(let i=0;i<120&&care.job.stage==='align';i++)care.update(1/60);
    assert.equal(care.job.stage,'acting',kind);assert.equal(care.job.time,0);assert.ok(Math.abs(cat.rotation.y-Math.PI)<.035);
  }
});
