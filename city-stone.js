import * as T from './vendor/three/build/three.module.js';

// Original, seamless mineral relief. Generated once per city rather than loading
// photographic scenery: every face keeps its grain scale when the camera moves.
export function createGraniteTexture(size=256){
  let seed=19317;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const layers=[4,8,16,32,64].map(n=>({n,data:Float32Array.from({length:n*n},random)}));
  const sample=(layer,x,y)=>{
    const {n,data}=layer,px=x*n/size,py=y*n/size,ix=Math.floor(px),iy=Math.floor(py);
    let a=px-ix,b=py-iy;a=a*a*(3-2*a);b=b*b*(3-2*b);
    const at=(u,v)=>data[((v+n)%n)*n+(u+n)%n];
    return (at(ix,iy)*(1-a)+at(ix+1,iy)*a)*(1-b)+(at(ix,iy+1)*(1-a)+at(ix+1,iy+1)*a)*b;
  };
  const pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const coarse=sample(layers[0],x,y),cloud=sample(layers[1],x,y)*.55+sample(layers[2],x,y)*.45;
    const aggregate=sample(layers[3],x,y)*.6+sample(layers[4],x,y)*.4;
    const crystal=random(),mica=crystal<.10?-.23:crystal>.86?.13:0;
    const value=.66+cloud*.24+aggregate*.13+mica+(random()-.5)*.09;
    const iron=Math.max(0,coarse-.52)*.24,i=(y*size+x)*4;
    pixels[i]=Math.min(255,(value+iron)*255);pixels[i+1]=Math.min(255,value*255);pixels[i+2]=Math.min(255,(value-iron*.65)*255);
    pixels[i+3]=(aggregate*.48+cloud*.27+crystal*.25)*255;
  }
  const texture=new T.DataTexture(pixels,size,size,T.RGBAFormat);
  texture.name='original-granite-minerals-and-relief';texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
  return texture;
}

export function createStoneMaterial(color,texture,{relief=.014,lichen=.16}={}){
  const material=new T.MeshStandardMaterial({color,roughness:.94,metalness:0});
  material.userData.cityStone=true;material.userData.cityTextures=[texture];
  material.onBeforeCompile=shader=>{
    shader.uniforms.cityGranite={value:texture};
    shader.vertexShader='varying vec3 cityStoneP; varying vec3 cityStoneN;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
      cityStoneN=inverseTransformDirection(transformedNormal,viewMatrix);`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 stonePoint=vec4(position,1.);
      #ifdef USE_INSTANCING
      stonePoint=instanceMatrix*stonePoint;
      #endif
      cityStoneP=(modelMatrix*stonePoint).xyz;`);
    shader.fragmentShader=`
      varying vec3 cityStoneP; varying vec3 cityStoneN; uniform sampler2D cityGranite;
      float stoneHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float stoneNoise(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(stoneHash(i),stoneHash(i+vec3(1,0,0)),f.x),mix(stoneHash(i+vec3(0,1,0)),stoneHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(stoneHash(i+vec3(0,0,1)),stoneHash(i+vec3(1,0,1)),f.x),mix(stoneHash(i+vec3(0,1,1)),stoneHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 stoneWeights=pow(abs(normalize(cityStoneN)),vec3(6.));stoneWeights/=max(.001,stoneWeights.x+stoneWeights.y+stoneWeights.z);
      vec4 mineral=texture2D(cityGranite,cityStoneP.zy*1.6)*stoneWeights.x
        +texture2D(cityGranite,cityStoneP.xz*1.6)*stoneWeights.y
        +texture2D(cityGranite,cityStoneP.xy*1.6)*stoneWeights.z;
      float age=stoneNoise(cityStoneP*2.1),stain=stoneNoise(cityStoneP*.70+7.3);
      diffuseColor.rgb*=mineral.rgb*mix(.72,1.15,age);
      float lichenPatch=smoothstep(.48,.77,stain)*smoothstep(.30,.72,stoneNoise(cityStoneP*18.));
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.66,.73,.56),lichenPatch*${lichen.toFixed(3)});
      float wetStone=1.-smoothstep(-1.15,-.58,cityStoneP.y);
      diffuseColor.rgb*=mix(vec3(1.),vec3(.43,.52,.47),wetStone*.85);
      float stoneHeight=mineral.a*.65+age*.35;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 stoneDx=dFdx(-vViewPosition),stoneDy=dFdy(-vViewPosition);
      vec3 stoneR1=cross(stoneDy,normal),stoneR2=cross(normal,stoneDx);
      float stoneDet=dot(stoneDx,stoneR1);
      vec3 stoneGrad=sign(stoneDet)*(dFdx(stoneHeight)*stoneR1+dFdy(stoneHeight)*stoneR2);
      normal=normalize(abs(stoneDet)*normal-stoneGrad*${relief.toFixed(4)});`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=clamp(.82+mineral.a*.16-wetStone*.22,.56,1.);`);
  };
  material.customProgramCacheKey=()=>`luoyang-granite-relief-${relief}-${lichen}`;
  return material;
}

// Twelve-sided, chipped footprint with worn bevels. Separate top triangles
// keep actual edges and shadowed joints visible at walking distance.
export function createWornStoneGeometry(seed=1){
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const perimeter=[[-.5,-.47],[-.47,-.5],[0,-.5],[.47,-.5],[.5,-.47],[.5,0],[.5,.47],[.47,.5],[0,.5],[-.47,.5],[-.5,.47],[-.5,0]];
  const lower=[],upper=[],top=[];
  for(const [x,z] of perimeter){
    const wobble=.002+random()*.004;
    lower.push(new T.Vector3(x*.99,-.5,z*.99));
    upper.push(new T.Vector3(x,.30+random()*.07,z));
    top.push(new T.Vector3(x*(1-wobble*2),.5-random()*.015,z*(1-wobble*2)));
  }
  const positions=[],uvs=[];
  const triangle=(a,b,c)=>{for(const v of [a,b,c]){positions.push(v.x,v.y,v.z);uvs.push(v.x+.5,v.z+.5);}};
  for(let i=0;i<perimeter.length;i++){
    const j=(i+1)%perimeter.length;
    for(const [a,b] of [[lower,upper],[upper,top]]){triangle(a[i],b[i],b[j]);triangle(a[i],b[j],a[j]);}
    triangle(top[i],new T.Vector3(0,.498,0),top[j]);
    triangle(lower[j],new T.Vector3(0,-.5,0),lower[i]);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
  return geometry;
}
