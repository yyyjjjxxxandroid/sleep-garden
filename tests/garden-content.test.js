const {test}=require('node:test');
const assert=require('node:assert/strict');

test('cozy landmarks extend the existing garden and respond to dusk',async()=>{
  const T=await import('../vendor/three/build/three.module.js');
  const {installGardenContent}=await import('../story-garden-content.js');
  const world={scene:new T.Scene(),quality:'high',walkObstacles:[],groundHeight:()=>0,mat:color=>new T.MeshStandardMaterial({color}),place(){return new T.Group()}};
  const content=installGardenContent(world,T);
  assert.equal(content.root.name,'cozy-garden-content');
  assert.ok(content.root.getObjectByName('cat-cottage'));
  assert.ok(content.root.getObjectByName('pond-resting-corner'));
  assert.ok(content.root.getObjectByName('garden-lantern'));
  assert.ok(content.root.getObjectByName('cat-cottage-chimney'));
  for(const name of ['garden-entrance-arch','flower-hill-pavilion','firefly-grove','moon-garden','meadow-tea-nook','bird-bath-garden','woodland-swing','woodland-wishing-well','garden-fireflies'])assert.ok(content.root.getObjectByName(name),`${name} is present`);
  assert.equal(content.root.getObjectsByProperty('name','garden-birdhouse').length,5);
  assert.equal(content.root.getObjectsByProperty('name','garden-cairn').length,5);
  assert.equal(content.root.getObjectsByProperty('name','garden-low-fence').length,4);
  assert.equal(world.walkObstacles.length,9,'cat routes avoid all major landmarks');
  assert.equal(content.lamps.length,2,'keep real-time lights intentionally limited');
  content.update(1,0);assert.equal(content.lamps[0].intensity,0);
  content.update(1,1);assert.ok(content.lamps[0].intensity>1);
});
