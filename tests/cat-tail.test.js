const {test}=require('node:test'),assert=require('node:assert/strict');
async function fixture(){
 const T=await import('../vendor/three/build/three.module.js'),{createStoryCat}=await import('../story-cat.js');let time=0;
 const actor=createStoryCat({clock:()=>time,random:()=>.5});return {T,actor,step(){time+=1/60;actor.animate(time,false,0,true,1/60)}};
}
test('tail has a sealed root and tip, with no exposed boundary edges',async()=>{
 const {actor,step}=await fixture();step();const g=actor.root.getObjectByName('companion-tail-surface').geometry,p=g.attributes.position,ids=[],vertices=new Map(),edges=new Map();
 // Weld the repeated radial seam geometrically before counting topology.
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e5)).join(',');if(!vertices.has(key))vertices.set(key,vertices.size);ids.push(vertices.get(key))}
 for(let i=0;i<g.index.count;i+=3){const face=[0,1,2].map(j=>ids[g.index.getX(i+j)]);assert.equal(new Set(face).size,3);for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)||0)+1)}}
 assert.ok([...edges.values()].every(n=>n===2),'every tail edge must meet two faces, including both caps');
});
test('tail stays attached, round and outward-facing through sitting, lying and getting up',async()=>{
 const {T,actor,step}=await fixture(),mesh=actor.root.getObjectByName('companion-tail-surface'),torso=actor.root.getObjectByName('companion-torso'),geometry=mesh.geometry,p=geometry.attributes.position,index=geometry.index;
 const centre=Array.from({length:41},()=>new T.Vector3()),v=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),radial=new T.Vector3(),inverse=new T.Matrix4();const previous=p.array.slice();const phases=new Set();
 actor.pet('head');actor.touch('head',{x:0,y:0});
 for(let frame=0;frame<60*36;frame++){
  step();if(frame===47)actor.release();phases.add(actor.root.userData.companionPhase);actor.root.updateMatrixWorld(true);inverse.copy(torso.matrixWorld).invert();
  for(let j=0;j<12;j++){v.fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);assert.ok(v.length()<.98,'the root ring must stay inside the torso as it rotates and squashes')}
  assert.equal(mesh.geometry,geometry,'posture changes must reuse geometry');
  for(let i=0;i<p.array.length;i++)assert.ok(Math.abs(p.array[i]-previous[i])<.04,`shape changes remain continuous at frame ${frame}`);previous.set(p.array);
  if(frame%12)continue;
  for(let ring=0;ring<41;ring++){
   centre[ring].set(0,0,0);for(let j=0;j<12;j++)centre[ring].add(v.fromBufferAttribute(p,ring*13+j));centre[ring].multiplyScalar(1/12);
   let min=Infinity,max=0;for(let j=0;j<12;j++){const radius=v.fromBufferAttribute(p,ring*13+j).distanceTo(centre[ring]);min=Math.min(min,radius);max=Math.max(max,radius)}
   assert.ok(min>.10&&max<.16&&max/min<1.001,'morphing must not flatten or twist a cross-section');
  }
  for(let i=0;i<40*12*6;i+=3){
   const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);normal.subVectors(b,a).cross(v.subVectors(c,a)).normalize();radial.set(0,0,0);
   for(const id of ids)radial.add(v.fromBufferAttribute(p,id).sub(centre[Math.floor(id/13)]));
   assert.ok(normal.dot(radial.normalize())>.1,'the inner curl must not fold faces inward');
  }
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);assert.ok(v.y>-.015,'tail must not intersect the ground')}
 }
 for(const phase of ['sitting','lying-down','resting','getting-up','none'])assert.ok(phases.has(phase));
});
