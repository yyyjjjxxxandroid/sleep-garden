import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/build/three.module.js';
import {readNatureLOD,setNatureLOD,getNatureLOD,updateSceneryLOD} from '../nature-lod.js';
import {instanceScenery} from '../scene-batching.js';
import {createStoryCat} from '../story-cat.js';

test('offline nature LODs have valid attributes, indices and reduced geometry',async()=>{
  const source=JSON.parse(await readFile(new URL('../assets3d-v2/embedded.json',import.meta.url)));
  const lods=JSON.parse(await readFile(new URL('../assets3d-v2/nature-lod.json',import.meta.url)));
  let original=0,reduced=0;
  for(const [name,meshes]of Object.entries(lods))for(const [key,encoded]of Object.entries(meshes)){
    const geometry=readNatureLOD(encoded),p=geometry.attributes.position;
    const [material,count]=key.split(':');
    const model=source.models[name];
    const primitive=model.meshes.flatMap(m=>m.primitives).find(p=>model.materials[p.material].name===material&&model.accessors[p.attributes.POSITION].count===Number(count));
    assert.ok(primitive,`${name}/${key} maps to its original model`);
    const accessor=model.accessors[primitive.attributes.POSITION];
    assert.ok(p.count>0&&p.count<Number(count));
    for(const attr of Object.values(geometry.attributes)){
      assert.equal(attr.count,p.count);
      assert.ok(attr.array.every(Number.isFinite));
    }
    assert.ok(geometry.index.array.every(i=>i<p.count));
    assert.equal(geometry.index.count%3,0);
    for(let axis=0;axis<3;axis++){
      const min=geometry.boundingBox.min.getComponent(axis),max=geometry.boundingBox.max.getComponent(axis);
      const span=accessor.max[axis]-accessor.min[axis];
      assert.ok(min>=accessor.min[axis]-1e-4&&max<=accessor.max[axis]+1e-4);
      assert.ok(max-min>=span*.5,`${name} retains its silhouette bounds`);
    }
    original+=model.accessors[primitive.indices].count;reduced+=geometry.index.count;
    geometry.dispose();
  }
  assert.ok(reduced<original*.5);
  assert.equal(readNatureLOD(null),null);
});

test('spatial batches retain LODs through shared clones and restore detail nearby with hysteresis',()=>{
  const scene=new T.Scene(),detail=new T.BoxGeometry(),distant=new T.TetrahedronGeometry();
  setNatureLOD(detail,distant);
  const template=new T.Mesh(detail,new T.MeshStandardMaterial()),clone=template.clone();
  assert.equal(getNatureLOD(clone.geometry),distant);
  scene.add(clone);const batches=instanceScenery(scene,[clone]),batch=batches[0];
  const camera=new T.PerspectiveCamera();
  camera.position.set(0,0,30);updateSceneryLOD(batches,camera);assert.equal(batch.geometry,distant);
  camera.position.set(0,0,15);updateSceneryLOD(batches,camera);assert.equal(batch.geometry,distant);
  camera.position.set(0,0,5);updateSceneryLOD(batches,camera);assert.equal(batch.geometry,detail);
  camera.position.set(0,0,15);updateSceneryLOD(batches,camera);assert.equal(batch.geometry,detail);
});

test('mobile kitten reduces geometry while retaining skinned fur, customization and articulated poses',()=>{
  const counts=[];
  for(const quality of ['high','mid','low']){
    const actor=createStoryCat({quality,clock:()=>2,random:()=>.4});let triangles=0;
    actor.root.traverseVisible(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
    counts.push(triangles);
    const fur=actor.root.getObjectByName('kitten-round-face-fur');
    assert.ok(fur.isSkinnedMesh&&fur.geometry.attributes.skinWeight.count>0);
    actor.animate(2,true,.2,false,.016);
    assert.ok(Number.isFinite(actor.root.getObjectByName('companion-head').rotation.x));
    actor.setAppearance({name:'测试',base:'#e8cba5',accent:'#ffffff',pattern:'bicolor'});
    assert.equal(actor.root.userData.petAppearance.name,'测试');
  }
  assert.ok(counts[1]<counts[0]*.5);assert.ok(counts[2]<counts[1]);
});
