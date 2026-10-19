const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('the production kitten uses lit bone-skinned fur, not frame-swapped billboards',async()=>{
  const {createStoryCat}=await import('../story-cat.js');
  const actor=createStoryCat(),skins=[];let bones=0;
  actor.root.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);if(o.isBone)bones++;assert.ok(!o.isSprite)});
  assert.equal(actor.root.userData.model,'rigged-fluffy-kitten');assert.ok(bones>=20);assert.ok(skins.length>=20);
  for(const mesh of skins){
    assert.ok(mesh.material.isMeshPhysicalMaterial,'fur shares the garden lighting and tone mapping');
    assert.ok(mesh.material.toneMapped);assert.ok(mesh.skeleton.bones.every(b=>b.isBone));
    const w=mesh.geometry.attributes.skinWeight;
    for(let i=0;i<w.count;i+=31)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);
  }
  const world=fs.readFileSync(require.resolve('../story-world.js'),'utf8');
  assert.ok(!world.includes('installCatSprites('),'production must not load the discarded sprite renderer');
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');assert.ok(!html.includes('window.CAT_SPRITE_ASSETS='));
});

test('leg vertices have blended joint weights and remain continuous during walking',async()=>{
  const T=await import('../vendor/three/build/three.module.js'),{createStoryCat}=await import('../story-cat.js');
  let now=0;const actor=createStoryCat({clock:()=>now,random:()=>.4}),leg=actor.root.getObjectByName('upper-front-1-surface');
  const w=leg.geometry.attributes.skinWeight,vertex=new T.Vector3(),previous=new T.Vector3();
  let mixed=-1;for(let i=0;i<w.count;i++)if(w.getY(i)>.2&&w.getY(i)<.8){mixed=i;break}
  assert.ok(mixed>=0,'the limb must bend between its shoulder and paw, not behave as a rigid cutout');
  let distance=0;
  for(let i=0;i<180;i++){
    now+=1/60;actor.animate(now,true,.35,false,1/60,false,now*5.1);actor.root.updateMatrixWorld(true);
    leg.getVertexPosition(mixed,vertex).applyMatrix4(leg.matrixWorld);
    if(i){const d=vertex.distanceTo(previous);assert.ok(d<.035,'no frame-sized position jumps');distance+=d}previous.copy(vertex);
  }
  assert.ok(distance>.2,'the skinned surface must actually move');
});

test('refined face uses smaller eyes and a combed undercoat instead of untextured skin',async()=>{
  const {createStoryCat}=await import('../story-cat.js');const actor=createStoryCat();
  for(const side of [-1,1]){
    const eye=actor.root.getObjectByName(`eye-${side}`);
    assert.equal(eye.userData.referenceScale,.75);
    assert.ok(eye.children[2].scale.x*2<.24,'complete eye width is about one fifth of the face');
    assert.ok(eye.children[0].scale.x<eye.children[3].scale.x*.8,'brown iris must remain visible around pupil');
  }
  const face=actor.root.getObjectByName('kitten-round-face-surface'),fur=actor.root.getObjectByName('kitten-round-face-fur');
  assert.ok(face.material.bumpMap?.isDataTexture);assert.ok(face.material.bumpScale>0&&face.material.bumpScale<.01);
  assert.equal(fur.userData.groom,'face');assert.ok(fur.isSkinnedMesh);
});

test('fur triangle winding follows outward normals to avoid dark pepper-like fibres',async()=>{
  const T=await import('../vendor/three/build/three.module.js'),{createStoryCat}=await import('../story-cat.js');
  const actor=createStoryCat(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3();
  actor.root.traverse(mesh=>{
    if(!mesh.name.endsWith('-fur'))return;
    const p=mesh.geometry.attributes.position,norm=mesh.geometry.attributes.normal;
    for(let i=0;i<p.count;i+=27){
      a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);n.fromBufferAttribute(norm,i);
      assert.ok(b.sub(a).cross(c.sub(a)).dot(n)>0,`${mesh.name} triangle must face outward`);
    }
  });
});
