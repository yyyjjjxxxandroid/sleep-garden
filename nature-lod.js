import * as T from './vendor/three/build/three.module.js';
const distantGeometries=new WeakMap();
export function setNatureLOD(geometry,distant){if(distant)distantGeometries.set(geometry,distant);}
export function getNatureLOD(geometry){return distantGeometries.get(geometry);}

export function readNatureLOD(encoded){
  if(!encoded)return null;
  const decode=(text,Type)=>new Type(Uint8Array.from(atob(text),character=>character.charCodeAt(0)).buffer);
  const geometry=new T.BufferGeometry();
  for(const [name,{data,itemSize}]of Object.entries(encoded.attributes))geometry.setAttribute(name,new T.BufferAttribute(decode(data,Float32Array),itemSize));
  geometry.setIndex(new T.BufferAttribute(decode(encoded.index,Uint32Array),1));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

// A cell's nearest edge determines detail, so moving close to any of its
// flowers restores the full mesh. Hysteresis prevents flickering at the edge.
export function updateSceneryLOD(batches,camera){
  for(const batch of batches||[]){
    const detail=batch.userData.detailGeometry,distant=batch.userData.distantGeometry;
    if(!distant)continue;
    const distance=batch.boundingBox.distanceToPoint(camera.position),usingDistant=batch.geometry===distant;
    if(!usingDistant&&distance>14)batch.geometry=distant;
    else if(usingDistant&&distance<11)batch.geometry=detail;
  }
}
