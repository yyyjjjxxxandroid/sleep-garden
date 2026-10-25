import * as T from './vendor/three/build/three.module.js';

// Freeze the existing rig's deformed vertices into a disposable photo model.
// The live cat never leaves its scene; the photo needs no GPU bone textures.
export function freezePhotoSubject(subject,{softenFur=false}={}){
  subject.updateWorldMatrix(true,false);
  // SkinnedMesh overrides updateMatrixWorld, NOT updateWorldMatrix. This also
  // refreshes attached bindMatrixInverse before evaluating weighted vertices.
  subject.updateMatrixWorld(true);
  const root=new T.Group(),inverse=subject.matrixWorld.clone().invert(),v=new T.Vector3();
  root.scale.copy(subject.scale);root.name='pet-photo-snapshot';
  const geometries=[],materials=[];
  function visit(source,visible=true){
    visible=visible&&(source===subject||source.visible);if(!visible)return;
    if(source.isMesh){
      const relative=new T.Matrix4().multiplyMatrices(inverse,source.matrixWorld);
      let geometry=source.geometry,owned=false;
      if(source.isSkinnedMesh){
        geometry=source.geometry.clone();owned=true;
        const p=geometry.attributes.position;
        for(let i=0;i<p.count;i++){source.getVertexPosition(i,v);p.setXYZ(i,v.x,v.y,v.z)}
        geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.morphAttributes={};
        if(softenFur&&source.name.endsWith('-fur')){
          // Each strand is three triangles (nine vertices). Keep its roots,
          // shorten the tips, and retain soft grooming normals instead of
          // giving every tiny triangle a sharply contrasting flat normal.
          const a=new T.Vector3(),b=new T.Vector3();
          for(let start=0;start+8<p.count;start+=9){a.fromBufferAttribute(p,start);b.fromBufferAttribute(p,start+2);a.add(b).multiplyScalar(.5);for(let j=0;j<9;j++){v.fromBufferAttribute(p,start+j).sub(a).multiplyScalar(.48).add(a);p.setXYZ(start+j,v.x,v.y,v.z)}}
        }else geometry.computeVertexNormals();
        geometry.computeBoundingBox();geometry.computeBoundingSphere();
      }
      if(owned)geometries.push(geometry);
      // Private materials prevent the shared renderer's skinning program state
      // from being reused between the static photo and the live animated cat.
      const mat=Array.isArray(source.material)?source.material.map(m=>m.clone()):source.material.clone();materials.push(...(Array.isArray(mat)?mat:[mat]));
      if(softenFur&&source.name.endsWith('-fur'))for(const material of Array.isArray(mat)?mat:[mat]){material.sheen=.25;material.roughness=1;material.envMapIntensity=.15}
      const mesh=source.isInstancedMesh?source.clone():new T.Mesh(geometry,mat);mesh.geometry=geometry;mesh.material=mat;
      mesh.name=source.name;mesh.matrix.copy(relative);mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;mesh.renderOrder=source.renderOrder;root.add(mesh);
    }
    for(const child of source.children)visit(child,visible);
  }
  try{visit(subject)}catch(error){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());throw error}
  return {root,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}};
}
