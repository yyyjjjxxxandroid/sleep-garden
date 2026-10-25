const {test}=require('node:test');
const assert=require('node:assert/strict');

test('single hero mountain has broad layered shoulders and one offset summit',async()=>{
  const T=await import('../vendor/three/build/three.module.js');
  const {makeHeroMountainGeometry}=await import('../story-atmosphere.js');
  const geometry=makeHeroMountainGeometry(T,42,14),position=geometry.attributes.position;
  assert.equal(position.count,43,'three fourteen-point shoulder rings and one summit');
  assert.equal(geometry.index.count,210,'two shoulder bands plus one summit band');
  assert.equal(geometry.groups.length,3,'foothills, rock and pale summit use separate restrained materials');
  geometry.computeBoundingBox();
  assert.equal(geometry.boundingBox.max.y,1);assert.equal(geometry.boundingBox.min.y,0);
  assert.ok(Math.abs(position.getX(42))>.04,'summit is asymmetric instead of a perfect cone');
  for(let i=0;i<position.count;i++)for(const axis of ['getX','getY','getZ'])assert.ok(Number.isFinite(position[axis](i)));
});
