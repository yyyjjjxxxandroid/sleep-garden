const {test}=require('node:test');
const assert=require('node:assert/strict');

test('garden outskirts provide a boundary, country approach and connected wetland',async()=>{
  const T=await import('../vendor/three/build/three.module.js');
  const {installGardenOutskirts}=await import('../story-garden-outskirts.js');
  const world={scene:new T.Scene(),quality:'low',walkObstacles:[],waterMat:new T.MeshBasicMaterial({color:'#789f9b'}),groundHeight:()=>0,streamX:z=>-2.5+Math.sin(z*.18)*1.2,place:()=>new T.Group()};
  const outskirts=installGardenOutskirts(world,T);
  for(const name of ['country-lane','garden-boundary','country-mailbox','flower-handcart','outer-wetland','wetland-footbridge'])assert.ok(outskirts.root.getObjectByName(name),`${name} exists`);
  assert.equal(outskirts.root.getObjectsByProperty('name','hay-bale').length,3);
  assert.equal(world.walkObstacles.length,3);
  outskirts.wetland.geometry.computeBoundingBox();
  assert.ok(outskirts.wetland.geometry.boundingBox.min.z<-58,'wetland reaches beyond the garden forest');
});
