const {test}=require('node:test');
const assert=require('node:assert/strict');

// These measurements are the milk-white cat before the art upgrade.
test('cat body, legs and ears retain the original proportions',async()=>{
  const {createStoryCat}=await import('../story-cat.js');
  const actor=createStoryCat(),root=actor.root;
  const expect=(name,position,scale)=>{
    const part=root.getObjectByName(name);
    assert.deepEqual(part.position.toArray(),position,name+' position');
    assert.deepEqual(part.scale.toArray(),scale,name+' proportion');
  };
  expect('companion-torso',[0,.63,-.20],[.46,.43,.69]);
  expect('companion-chest',[0,.62,.32],[.37,.38,.30]);
  for(const side of [-1,1])for(const front of [true,false]){
    const role=front?'front':'back';
    expect(`hip-${role}-${side}`,[side*.29,.48,front?.32:-.56],[1,1,1]);
    expect(`upper-${role}-${side}`,[0,-.10,0],[.16,.25,.17]);
    expect(`paw-${role}-${side}`,[0,-.33,.045],[.17,.13,.21]);
  }
  for(const side of [-1,1]){
    const options=root.getObjectByName(`ear-${side}`).children[0].geometry.parameters.options;
    assert.equal(options.curveSegments,14);
    assert.equal(options.bevelSegments,5);
  }
});

test('production scene retains original cat size and route',async()=>{
  globalThis.window??={};
  const T=await import('../vendor/three/build/three.module.js');
  await import('../story-world.js');
  const previous=globalThis.document;
  globalThis.document={createElement(){return {getContext(){return {createRadialGradient(){return {addColorStop(){}}},fillRect(){}}}}}};
  try{
    const world=Object.assign(Object.create(window.GardenWorld.prototype),{scene:new T.Scene(),canvas:{dataset:{}}});
    world.makeCat();
    assert.deepEqual(world.cat.scale.toArray(),[.65,.65,.65]);
    assert.deepEqual(world.catPath.points.map(p=>p.toArray()),[[1.7,0,4.4],[4,0,3.2],[5.3,0,1.5],[7,0,3],[6,0,6.6],[3,0,8],[-1.3,0,7.6],[-2,0,5.2]]);
  }finally{globalThis.document=previous}
});
