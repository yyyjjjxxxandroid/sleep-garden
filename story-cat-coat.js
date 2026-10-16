import * as T from './vendor/three/build/three.module.js';

// A single closed surface from shoulder to toe. Shared rings and normals
// eliminate the intersecting ellipsoid seam at the wrist.
function continuousLegGeometry(){
  const geometry=new T.SphereGeometry(1,40,48),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const y=-.155+.305*p.getY(i),angle=Math.atan2(p.getZ(i),p.getX(i));
    // One rounded profile, without the two separate ellipsoid lobes that
    // still read as a ball sitting on a shoe when the limb folds.
    const envelope=Math.sqrt(Math.max(0,1-((y+.155)/.305)**2));
    const foot=T.MathUtils.smoothstep(-y,.16,.35);
    const rx=.16*envelope*(1+.32*foot),rz=.17*envelope*(1+.48*foot);
    const toe=T.MathUtils.smoothstep(-y,.16,.30)*.045;
    p.setXYZ(i,Math.cos(angle)*rx,y,toe+Math.sin(angle)*rz);
  }
  geometry.computeVertexNormals();return geometry;
}

// A subtle, elongated undercoat normal detail, not dark random colour dots.
// Generated data keeps this material usable in the offline HTML and tests.
let undercoat;
function undercoatTexture(){
  if(undercoat)return undercoat;
  const size=256,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const turn=Math.sin(y/size*Math.PI*4)*.8;
    const value=Math.round(128+19*Math.sin(x/size*Math.PI*128+turn)+8*Math.sin(x/size*Math.PI*242-turn*.5));
    const at=(y*size+x)*4;data[at]=data[at+1]=data[at+2]=value;data[at+3]=255;
  }
  undercoat=new T.DataTexture(data,size,size);undercoat.wrapS=undercoat.wrapT=T.RepeatWrapping;
  undercoat.minFilter=T.LinearMipmapLinearFilter;undercoat.magFilter=T.LinearFilter;undercoat.generateMipmaps=true;
  undercoat.repeat.set(2,1);undercoat.needsUpdate=true;return undercoat;
}

// Geometry, not camera-facing cards: the same bones deform the coat and fur.
// Existing actor transforms remain the single owner of gestures and locomotion.
export function installCatCoat(root, surfaces){
  const drivers=[],skins=[];
  const furMaterial=new T.MeshPhysicalMaterial({color:'#fff4e6',roughness:.98,
    metalness:0,sheen:1,sheenColor:new T.Color('#fffaf2'),sheenRoughness:.85,
    envMapIntensity:.25,vertexColors:true,side:T.DoubleSide});
  let seed=19732;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const vector=new T.Vector3(),normal=new T.Vector3(),tangent=new T.Vector3(),cross=new T.Vector3();
  function strandGeometry(geometry,count,length,groom){
    const positions=geometry.attributes.position,normals=geometry.attributes.normal,index=geometry.index;
    const ids=[],areas=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),ab=new T.Vector3(),ac=new T.Vector3();
    let total=0;
    for(let i=0;i<(index?index.count:positions.count);i+=3){
      const tri=[0,1,2].map(j=>index?index.getX(i+j):i+j);ids.push(tri);
      a.fromBufferAttribute(positions,tri[0]);b.fromBufferAttribute(positions,tri[1]);c.fromBufferAttribute(positions,tri[2]);
      total+=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;areas.push(total);
    }
    const p=[],n=[],col=[],roots=[];
    const vertex=(v,norm,shade)=>{p.push(v.x,v.y,v.z);n.push(norm.x,norm.y,norm.z);col.push(shade,shade,shade);roots.push(vector.y)};
    for(let i=0;i<count;i++){
      const area=random()*total;let lo=0,hi=areas.length-1;
      while(lo<hi){const mid=(lo+hi)>>1;if(areas[mid]<area)lo=mid+1;else hi=mid}
      const tri=ids[lo],u=Math.sqrt(random()),v=random(),weights=[1-u,u*(1-v),u*v];
      vector.set(0,0,0);normal.set(0,0,0);
      tri.forEach((id,j)=>{vector.addScaledVector(a.fromBufferAttribute(positions,id),weights[j]);normal.addScaledVector(a.fromBufferAttribute(normals,id),weights[j])});normal.normalize();
      // Keep fitted eyes and their animated lids clear of the face coat.
      if(groom==='face'&&vector.z>.30&&[-1,1].some(side=>((vector.x-side*.205)/.15)**2+((vector.y-.025)/.17)**2<1))continue;
      // Comb the coat along the anatomy. Mostly tangential, curved fibres
      // read as silk-like fur; radial triangles read as spikes or dandruff.
      if(groom==='face')tangent.set(vector.x*1.7,vector.y-.12,-.15);
      else if(groom==='ear')tangent.set(vector.x*.12,1,-.10);
      else if(groom==='tail')tangent.set(.12,1,-.25);
      else if(groom==='leg'){
        const foot=T.MathUtils.smoothstep(-vector.y,.20,.34);
        tangent.set(normal.x*.25,-1+foot*.88,.12+foot*.88);
      }
      else if(groom==='paw')tangent.set(normal.x*.45,-.12,1);
      else tangent.set(vector.x*.18,-.8,-.42);
      tangent.addScaledVector(normal,-normal.dot(tangent));
      if(tangent.lengthSq()<.001)tangent.set(1,0,0).addScaledVector(normal,-normal.x);
      tangent.normalize();
      cross.crossVectors(normal,tangent).normalize();
      const jitter=(random()-.5)*.32;tangent.addScaledVector(cross,jitter).normalize();
      const sole=(groom==='paw'||groom==='leg')?T.MathUtils.smoothstep(normal.y,-.85,-.10):1;
      const side=cross,len=length*(.7+random()*.45)*(.08+.92*sole),width=len*(.017+random()*.014);
      const base=vector.clone().addScaledVector(normal,.0005),mid=base.clone().addScaledVector(normal,len*.38).addScaledVector(tangent,len*.44);
      const tip=base.clone().addScaledVector(normal,len*.55).addScaledVector(tangent,len*.92);
      const l=base.clone().addScaledVector(side,-width),r=base.clone().addScaledVector(side,width);
      const ml=mid.clone().addScaledVector(side,-width*.46),mr=mid.clone().addScaledVector(side,width*.46),shade=.975+random()*.025;
      // Outward winding must agree with the interpolated surface normal.
      // DoubleSide flips normals on back faces: reversed strands become dark
      // pepper-like speckles even though their supplied normals point outward.
      for(const [point,s] of [[l,shade],[ml,shade],[r,shade],[r,shade],[ml,shade],[mr,shade],[ml,shade],[tip,1],[mr,shade]])vertex(point,normal,s);
    }
    const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(p,3));
    result.setAttribute('normal',new T.Float32BufferAttribute(n,3));result.setAttribute('color',new T.Float32BufferAttribute(col,3));result.userData.rootY=roots;return result;
  }
  for(const {mesh:source,count=700,length=.025,paw,groom='body'} of surfaces){
    const parent=source.parent,bone=new T.Bone();bone.name=source.name+'-skin-joint';
    bone.position.copy(source.position);bone.quaternion.copy(source.quaternion);bone.scale.copy(source.scale);parent.add(bone);
    const bones=[bone];let footBone;
    if(paw){footBone=new T.Bone();footBone.name=source.name+'-paw-joint';footBone.position.copy(paw.position);parent.add(footBone);bones.push(footBone)}
    root.updateMatrixWorld(true);
    const transform=source.matrix.clone(),geometry=paw?continuousLegGeometry():source.geometry.clone().applyMatrix4(transform);
    const hairs=strandGeometry(geometry,count,length,groom);
    const surfaceMaterial=source.material.clone();
    if(geometry.attributes.uv){surfaceMaterial.bumpMap=undercoatTexture();surfaceMaterial.bumpScale=.0007}
    const weightsFor=(g)=>{
      const indices=[],weights=[],p=g.attributes.position;
      for(let i=0;i<p.count;i++){
        // The lower leg follows the planted paw, the shoulder follows its hip.
        const w=paw?T.MathUtils.smoothstep(-(g.userData.rootY?.[i]??p.getY(i)),.12,.30):0;
        indices.push(0,paw?1:0,0,0);weights.push(1-w,w,0,0);
      }
      g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    };
    const skeleton=new T.Skeleton(bones);
    for(const [g,mat,suffix]of [[geometry,surfaceMaterial,'surface'],[hairs,furMaterial,'fur']]){
      weightsFor(g);const mesh=new T.SkinnedMesh(g,mat);mesh.name=source.name+'-'+suffix;
      mesh.userData.petZone=source.userData.petZone||'back';mesh.castShadow=suffix==='surface';mesh.receiveShadow=true;
      mesh.userData.groom=groom;
      // Bounds are pose-dependent. The actor is small enough to keep visible;
      // raycasting still computes the current skinned bounding sphere.
      mesh.frustumCulled=false;parent.add(mesh);root.updateMatrixWorld(true);mesh.bind(skeleton);skins.push(mesh);
      if(suffix==='fur')mesh.raycast=()=>{};
    }
    source.visible=false;
    if(paw)paw.visible=false;
    drivers.push({source,bone,paw,footBone});
  }
  function update(){
    for(const {source,bone,paw,footBone}of drivers){
      bone.position.copy(source.position);bone.quaternion.copy(source.quaternion);bone.scale.copy(source.scale);
      if(paw){footBone.position.copy(paw.position);footBone.quaternion.copy(paw.quaternion)}
    }
    for(const skin of skins){skin.boundingSphere=null;skin.boundingBox=null}
  }
  root.userData.model='rigged-fluffy-kitten';root.userData.skinning='weighted-bones';
  return {update,skins};
}
