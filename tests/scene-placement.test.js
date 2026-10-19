const {test}=require('node:test');
const assert=require('node:assert/strict');

test('bridge crosses the stream with both ends on the banks',async()=>{
  globalThis.window??={};
  const T=await import('../vendor/three/build/three.module.js');
  await import('../story-world.js');
  const world=Object.assign(Object.create(window.GardenWorld.prototype),{
    scene:new T.Scene(),quality:'low',mat:color=>new T.MeshBasicMaterial({color}),
  });
  world.buildBridge();
  const bridge=world.scene.getObjectByName('garden-bridge');
  assert.ok(bridge);
  assert.equal(bridge.position.x,world.streamX(bridge.position.z));
  assert.equal(bridge.position.y,world.groundHeight(bridge.position.x,bridge.position.z)+.15);
  assert.ok(Math.abs(bridge.rotation.y-Math.atan(world.streamSlope(bridge.position.z)))<1e-12);
  for(const side of [-1,1]){
    const end=new T.Vector3(side*1.25,0,0).applyEuler(bridge.rotation).add(bridge.position);
    assert.ok(Math.abs(end.x-world.streamX(end.z))>.9,'bridge end reaches dry land');
  }
});

test('scenery placement keeps water and bridge approaches unobstructed',async()=>{
  globalThis.window??={};
  await import('../story-world.js');
  const world=Object.create(window.GardenWorld.prototype),bridge=world.bridgeCentre();
  assert.equal(world.clearForScenery(-3.5,-3.5),false,'pond surface');
  assert.equal(world.clearForScenery(world.streamX(-20),-20),false,'stream surface');
  assert.equal(world.clearForScenery(bridge.x+1,bridge.z),false,'bridge approach');
  assert.equal(world.clearForScenery(12,4),true,'open flower meadow');
});
