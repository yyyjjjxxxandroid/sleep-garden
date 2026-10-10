const {test}=require('node:test'),assert=require('node:assert/strict');
test('cupped petals have upward-facing normals and enough curvature for eye-level views',async()=>{
 const {petalGeometry}=await import('../garden-botany.js'),g=petalGeometry(),p=g.attributes.position,n=g.attributes.normal;let min=Infinity,max=-Infinity,normal=0;
 for(let i=0;i<p.count;i++){min=Math.min(min,p.getY(i));max=Math.max(max,p.getY(i));normal+=n.getY(i);for(const a of [p,n])for(let j=0;j<3;j++)assert.ok(Number.isFinite(a.array[i*3+j]));}
 assert.ok(max-min>.2,'the blossom must have a cupped silhouette rather than a flat flower card');assert.ok(normal/p.count>.65,'petal tops must face the daylight');
});
test('flower and tree detail stays finite and merged within a bounded geometry budget',async()=>{
 const {flowerCluster,crownGeometry}=await import('../garden-botany.js');
 for(const v of [0,1]){const root=flowerCluster(v);assert.equal(root.children.length,3,'stems, petals and pollen use three shared surfaces');let triangles=0;root.traverse(o=>{if(!o.isMesh)return;triangles+=o.geometry.index.count/3;assert.ok(o.material.roughness>=.98);o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;assert.ok(b.max.y>.25&&b.max.y<.7);for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value))});assert.ok(triangles<9000);}
 for(let v=0;v<4;v++){const g=crownGeometry(v);assert.ok(g.index.count/3<5000,'leaf sprays must not multiply rendering cost without a limit');for(const value of g.attributes.position.array)assert.ok(Number.isFinite(value));assert.equal(g.attributes.color.count,g.attributes.position.count);}
});

test('grass and stones keep curved silhouettes, stable normals and a mobile-sized geometry budget',async()=>{
 const {grassTuftGeometry,stoneGeometry}=await import('../garden-botany.js');
 for(let v=0;v<3;v++){
  const g=grassTuftGeometry(v);assert.ok(g.index.count/3<=(v===2?48:200),'small lawn tufts must stay affordable when instanced');
  g.computeBoundingBox();assert.ok(g.boundingBox.max.y>.5&&g.boundingBox.max.y<1);assert.ok(g.boundingBox.max.x-g.boundingBox.min.x>.3,'grass must arch outward instead of making rigid vertical spikes');
  for(const name of ['position','normal','color'])for(const n of g.attributes[name].array)assert.ok(Number.isFinite(n));
 }
 for(let v=0;v<2;v++){
  const g=stoneGeometry(v),p=g.attributes.position;g.computeBoundingBox();const b=g.boundingBox;
  assert.ok((b.max.y-b.min.y)/(b.max.x-b.min.x)<.5,'a resting rock should be wider than tall');
  let flatBase=0;for(let i=0;i<p.count;i++){if(Math.abs(p.getY(i)-b.min.y)<1e-5)flatBase++;for(const name of ['position','normal','color'])for(let j=0;j<3;j++)assert.ok(Number.isFinite(g.attributes[name].array[i*3+j]))}
  assert.ok(flatBase>8,'the lower surface can be buried without balancing on a spherical tip');assert.ok(g.index.count/3<400);
 }
});
