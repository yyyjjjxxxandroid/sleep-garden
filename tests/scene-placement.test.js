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
  const approaches=world.scene.getObjectByName('garden-bridge-connected-approaches');
  assert.ok(approaches,'bridge has visible paths beyond both landings');
  assert.ok(approaches.getObjectByName('garden-bridge-path-to-main-trail'));
  assert.ok(approaches.getObjectByName('garden-bridge-path-to-cottage'));
  for(const path of approaches.children.filter(child=>child.name.startsWith('garden-bridge-path-'))){
    path.geometry.computeVertexNormals();
    assert.ok(path.geometry.attributes.normal.getY(0)>.8,'approach path faces upward and remains visible from the garden camera');
  }
  const routes=world.bridgeApproachRoutes(),main=routes[1].at(-1),cottage=routes[0].at(-1);
  assert.ok(Math.abs(main.x-world.pathX(main.z))<.01,'right landing reconnects to the main garden trail');
  assert.ok(cottage.x<-9,'left landing continues toward the cottage instead of stopping in grass');
});

test('creek extends into the distant woodland and clears terrain across its width',async()=>{
  globalThis.window??={};
  const T=await import('../vendor/three/build/three.module.js');
  await import('../story-world.js');
  for(const quality of ['low','mid','high']){
    const world=Object.assign(Object.create(window.GardenWorld.prototype),{
      scene:new T.Scene(),quality,mat:color=>new T.MeshBasicMaterial({color}),
      mesh(geo,mat,x=0,y=0,z=0){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);this.scene.add(o);return o;},
    });
    world.buildWater();
    const positions=world.scene.getObjectByName('woodland-stream').geometry.attributes.position;
    assert.ok(world.streamEnd()<-70,'upstream reaches beyond the visible forest');
    for(let i=0;i<positions.count;i+=2){
      const a=new T.Vector3().fromBufferAttribute(positions,i),b=new T.Vector3().fromBufferAttribute(positions,i+1);
      for(let j=0;j<=4;j++){
        const p=a.clone().lerp(b,j/4);
        assert.ok(p.y>=world.terrainSurfaceY(p.x,p.z)+.03,'water remains above the terrain triangles');
      }
    }
    assert.ok(Math.abs(positions.getY(0)+.122)<.001,'mouth joins the pond surface');
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
  const end=world.streamEnd();
  assert.equal(world.clearForScenery(world.streamX(end),end-1.2,2),false,'a tree beyond the endpoint still overlaps the water');
  for(let z=-6;z>=end;z-=.4){
    assert.equal(world.clearForScenery(world.streamX(z)+2,z,2.5),false,'branches beside the stream must clear the water');
    assert.equal(world.onStream(world.streamX(z)+5,z,2),false,'trees well back on the bank remain valid');
  }
});

test('all tree models leave a dry bank along the entire extended creek',async()=>{
  globalThis.window??={};
  const T=await import('../vendor/three/build/three.module.js');
  await import('../story-world.js');
  const models=require('../assets3d-v2/embedded.json').models,templates={};
  const {placeForest}=await import('../story-atmosphere.js');
  for(const [name,gltf] of Object.entries(models)){
    if(!name.startsWith('CommonTree'))continue;
    const bounds=new T.Box3();
    for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
      const a=gltf.accessors[primitive.attributes.POSITION];
      bounds.union(new T.Box3(new T.Vector3(...a.min),new T.Vector3(...a.max)));
    }
    const scene=new T.Group(),size=bounds.getSize(new T.Vector3());
    const model=new T.Mesh(new T.BoxGeometry(size.x,size.y,size.z));
    model.position.copy(bounds.getCenter(new T.Vector3()));scene.add(model);
    templates[name]={scene,height:size.y};
  }
  for(const quality of ['low','mid','high']){
    const world=Object.assign(Object.create(window.GardenWorld.prototype),{
      quality,templates,place:()=>new T.Group(),registerFlower:()=>({}),addScatteredPetals(){},
    });
    world.populateGarden();
    const foregroundCount=world.treePlacements.length;
    placeForest(world);
    assert.ok(world.treePlacements.length>foregroundCount,'audit includes the separate background forest');
    assert.ok(world.treePlacements.length>35,'forest keeps its density');
    for(const tree of world.treePlacements){
      assert.equal(world.onStream(tree.x,tree.z,tree.footprint+3.1),false,
        `${quality} ${tree.name} at ${tree.x},${tree.z} keeps its full crown away from the river`);
    }
    assert.ok(world.treePlacements.filter(t=>t.z<-18&&t.x>world.streamX(t.z)&&t.x<16).length>=9,'right bank has a staggered grove');
  }
});
