import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/build/three.module.js';
import {instanceScenery,mergeStaticMeshes} from '../scene-batching.js';

test('scenery instances are spatially culled while preserving flower interaction matrices',()=>{
  const scene=new T.Scene(),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial(),roots=[];
  const target={userData:{instances:[]}};
  for(const x of [2,3,100]){
    const root=new T.Group(),mesh=new T.Mesh(geometry,material);
    root.position.set(x,0,0);mesh.position.y=2;mesh.userData.flowerTarget=target;
    root.add(mesh);scene.add(root);roots.push(root);
  }
  const batches=instanceScenery(scene,roots);
  assert.equal(batches.length,2);assert.equal(target.userData.instances.length,3);
  assert.ok(batches.every(mesh=>mesh.frustumCulled&&mesh.boundingSphere));
  assert.ok(roots.every(root=>!root.parent));
  const instance=target.userData.instances[2],matrix=new T.Matrix4();instance.mesh.getMatrixAt(instance.index,matrix);
  assert.deepEqual(matrix.elements,instance.base.elements);
  scene.updateMatrixWorld(true);
  const camera=new T.PerspectiveCamera(45,1,.1,30);camera.position.set(2,3,8);camera.lookAt(2,2,0);camera.updateMatrixWorld(true);
  const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  assert.equal(frustum.intersectsObject(batches[0]),true);assert.equal(frustum.intersectsObject(batches[1]),false);
});

test('static merging preserves parent transforms, live dusk materials and dynamic children',()=>{
  const root=new T.Group(),material=new T.MeshStandardMaterial(),meshes=[];
  root.position.set(3,1,4);root.rotation.y=.3;
  for(let i=0;i<4;i++){
    const mesh=new T.Mesh(new T.BoxGeometry(),material);mesh.position.x=i;mesh.name=`landmark-${i}`;
    root.add(mesh);meshes.push(mesh);
  }
  const animated=new T.Group();animated.userData.gardenAnimated=true;
  for(let i=0;i<3;i++)animated.add(new T.Mesh(new T.BoxGeometry(),material));root.add(animated);
  const points=new T.Points(new T.BufferGeometry(),new T.PointsMaterial());root.add(points);
  const before=new T.Box3().setFromObject(root),batches=mergeStaticMeshes(root);
  assert.equal(batches.length,1);assert.ok(meshes.every(mesh=>!mesh.visible));
  assert.ok(animated.children.every(mesh=>mesh.visible));assert.equal(points.visible,true);
  assert.equal(root.getObjectByName('landmark-1'),meshes[1]);
  const after=new T.Box3().setFromObject(batches[0]);
  for(const key of ['min','max'])for(const axis of ['x','y','z'])assert.ok(Math.abs(before[key][axis]-after[key][axis])<1e-5);
  material.emissiveIntensity=.9;assert.equal(batches[0].material.emissiveIntensity,.9);
});
