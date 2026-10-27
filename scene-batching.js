import * as T from './vendor/three/build/three.module.js';
import { mergeGeometries } from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
import { getNatureLOD } from './nature-lod.js';

// Keep nearby props together. One map-wide instance batch cannot discard any
// of its trees/flowers when the camera zooms in or looks away from them.
export function instanceScenery(scene,roots,cellSize=16){
  scene.updateMatrixWorld(true);
  const buckets=new Map(),position=new T.Vector3(),batches=[];
  for(const root of roots)root.traverseVisible(mesh=>{
    if(!mesh.isMesh)return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    position.setFromMatrixPosition(mesh.matrixWorld);
    const key=[mesh.geometry.uuid,...materials.map(m=>m.uuid),mesh.customDepthMaterial?.uuid,
      mesh.castShadow,mesh.receiveShadow,Math.floor(position.x/cellSize),Math.floor(position.z/cellSize)].join(':');
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(mesh);
  });
  for(const meshes of buckets.values()){
    const first=meshes[0],batch=new T.InstancedMesh(first.geometry,first.material,meshes.length);
    batch.name='garden-scenery-cell';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
    batch.customDepthMaterial=first.customDepthMaterial;batch.matrixAutoUpdate=false;
    batch.userData.detailGeometry=first.geometry;batch.userData.distantGeometry=getNatureLOD(first.geometry);
    if(/Leaves|Grass|Flowers|leaf|grass|color/i.test(first.material?.name||''))batch.userData.skipReflection=true;
    meshes.forEach((mesh,index)=>{
      batch.setMatrixAt(index,mesh.matrixWorld);
      mesh.userData.flowerTarget?.userData.instances.push({mesh:batch,index,base:mesh.matrixWorld.clone()});
    });
    batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();
    // Shader wind and the flower's touch bend extend beyond the rest pose.
    batch.boundingBox.expandByScalar(2);batch.boundingSphere.radius+=2;
    scene.add(batch);batches.push(batch);
  }
  for(const root of roots)scene.remove(root);
  return batches;
}

// Only call this for explicitly static landmarks. Keep named source objects
// for navigation/inspection and share their live materials (including dusk).
export function mergeStaticMeshes(root,cellSize=16){
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(),transform=new T.Matrix4(),position=new T.Vector3(),buckets=new Map(),batches=[];
  root.traverseVisible(mesh=>{
    if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||!mesh.material?.isMeshStandardMaterial||mesh.material.transparent||mesh.morphTargetInfluences)return;
    for(let parent=mesh;parent&&parent!==root;parent=parent.parent)if(parent.userData.gardenAnimated)return;
    position.setFromMatrixPosition(mesh.matrixWorld);
    const attributes=Object.keys(mesh.geometry.attributes).sort().map(k=>`${k}:${mesh.geometry.attributes[k].itemSize}`).join(',');
    const key=[mesh.material.uuid,attributes,mesh.castShadow,mesh.receiveShadow,
      mesh.userData.skipReflection,Math.floor(position.x/cellSize),Math.floor(position.z/cellSize)].join(':');
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(mesh);
  });
  for(const meshes of buckets.values()){
    if(meshes.length<3)continue;
    const parts=meshes.map(mesh=>{
      const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      transform.multiplyMatrices(inverse,mesh.matrixWorld);return geometry.applyMatrix4(transform);
    });
    const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());
    if(!geometry)continue;
    const first=meshes[0],batch=new T.Mesh(geometry,first.material);
    batch.name='garden-static-cell';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
    batch.userData.skipReflection=first.userData.skipReflection;batch.matrixAutoUpdate=false;
    geometry.computeBoundingSphere();root.add(batch);batches.push(batch);
    meshes.forEach(mesh=>{mesh.visible=false;mesh.matrixAutoUpdate=false;});
  }
  return batches;
}
