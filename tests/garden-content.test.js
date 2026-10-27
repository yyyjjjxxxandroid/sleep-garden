const {test}=require('node:test');
const assert=require('node:assert/strict');

test('cozy landmarks extend the existing garden and respond to dusk',async()=>{
  const T=await import('../vendor/three/build/three.module.js');
  const {installGardenContent}=await import('../story-garden-content.js');
  const world={scene:new T.Scene(),quality:'high',walkObstacles:[],groundHeight:()=>0,mat:color=>new T.MeshStandardMaterial({color}),place(){return new T.Group()}};
  const content=installGardenContent(world,T);
  assert.equal(content.root.name,'cozy-garden-content');
  assert.equal(content.root.getObjectByName('cat-cottage'),undefined);
  assert.ok(content.root.getObjectByName('pond-resting-corner'));
  assert.ok(content.root.getObjectByName('garden-lantern'));
  assert.equal(content.root.getObjectByName('cat-cottage-chimney'),undefined);
  assert.equal(content.root.getObjectByName('garden-entrance-arch'),undefined);
  for(const name of ['flower-hill-pavilion','firefly-grove','moon-garden','meadow-tea-nook','bird-bath-garden','woodland-swing','woodland-wishing-well','garden-fireflies'])assert.ok(content.root.getObjectByName(name),`${name} is present`);
  assert.equal(content.root.getObjectsByProperty('name','garden-birdhouse').length,5);
  assert.equal(content.root.getObjectsByProperty('name','garden-cairn').length,5);
  assert.equal(content.root.getObjectsByProperty('name','garden-low-fence').length,4);
  assert.equal(world.walkObstacles.length,7,'removed cottage and gates leave no invisible collision');
  assert.equal(content.root.getObjectByName('moon-gate'),undefined);
  assert.equal(content.root.getObjectsByProperty('name','garden-lantern').length,8,'removed gate also removes its lamps');
  assert.equal(content.lamps.length,2,'keep real-time lights intentionally limited');
  content.update(1,0);assert.equal(content.lamps[0].intensity,0);
  content.update(1,1);assert.ok(content.lamps[0].intensity>1);
});
