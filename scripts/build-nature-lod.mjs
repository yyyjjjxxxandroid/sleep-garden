// Offline only: never simplify meshes on the phone's animation thread.
import {readFile,writeFile} from 'node:fs/promises';
import * as T from '../vendor/three/build/three.module.js';
import {SimplifyModifier} from '../vendor/three/examples/jsm/modifiers/SimplifyModifier.js';
const source=JSON.parse(await readFile(new URL('../assets3d-v2/embedded.json',import.meta.url))),result={};
const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array};
const encode=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength).toString('base64');
let originalTriangles=0,lodTriangles=0;
for(const [name,model]of Object.entries(source.models)){
  if(!/^(CommonTree|Flower|Bush|Grass)/.test(name))continue;
  const buffers=model.buffers.map(buffer=>Buffer.from(source.files[buffer.uri].split(',')[1],'base64'));
  function attribute(index){
    const accessor=model.accessors[index],view=model.bufferViews[accessor.bufferView],Type=types[accessor.componentType],size=components[accessor.type];
    if(view.byteStride&&view.byteStride!==size*Type.BYTES_PER_ELEMENT)throw Error('Interleaved source needs an explicit decoder');
    const start=(view.byteOffset||0)+(accessor.byteOffset||0),bytes=buffers[view.buffer].subarray(start,start+accessor.count*size*Type.BYTES_PER_ELEMENT);
    return new T.BufferAttribute(new Type(Uint8Array.from(bytes).buffer),size,accessor.normalized||false);
  }
  for(const mesh of model.meshes)for(const primitive of mesh.primitives){
    const geometry=new T.BufferGeometry();
    for(const [gltf,key]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv'],['COLOR_0','color']]){
      if(primitive.attributes[gltf]!==undefined)geometry.setAttribute(key,attribute(primitive.attributes[gltf]));
    }
    if(primitive.indices!==undefined)geometry.setIndex(attribute(primitive.indices));
    const material=model.materials[primitive.material].name,key=material+':'+geometry.attributes.position.count;
    const simplified=new SimplifyModifier().modify(geometry,Math.floor(geometry.attributes.position.count*.60));
    simplified.computeBoundingBox();geometry.computeBoundingBox();
    // Reject degenerate results rather than dropping a plant from the scene.
    if(!simplified.index?.count||simplified.boundingBox.isEmpty())throw Error(`Empty LOD: ${name}/${key}`);
    const attributes={};
    for(const [key,attribute]of Object.entries(simplified.attributes))attributes[key]={data:encode(attribute.array),itemSize:attribute.itemSize};
    (result[name]??={})[key]={attributes,index:encode(new Uint32Array(simplified.index.array))};
    originalTriangles+=(geometry.index?.count||geometry.attributes.position.count)/3;lodTriangles+=simplified.index.count/3;
    simplified.dispose();geometry.dispose();
  }
}
await writeFile(new URL('../assets3d-v2/nature-lod.json',import.meta.url),JSON.stringify(result));
console.log(JSON.stringify({originalTriangles,lodTriangles,reduction:1-lodTriangles/originalTriangles}));
