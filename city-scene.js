import * as T from './vendor/three/build/three.module.js';
import { configureSkyBackground } from './world-sky.js';

export const CITY_FLOOR=.055;
export const CITY_OBSTACLES=[
  {x:-4.25,z:2.2,hx:1.22,hz:.65},
  {x:5.4,z:1.1,r:1.05},
  {x:3.35,z:-1.0,r:.34},{x:5.65,z:-1.0,r:.34},
];

// Both actors and every route segment share this clearance mask. Bridge railings,
// the river, the monument plinth and banyan roots cannot become destinations.
export function cityWalkable(x,z,radius=.32){
  const plaza=x>-8+radius&&x<8-radius&&z>-4+radius&&z<12-radius;
  const bridge=Math.abs(x)<2.25-radius&&z>=-40+radius&&z<=-3.4;
  if(!plaza&&!bridge)return false;
  for(const o of CITY_OBSTACLES){
    if(o.r?Math.hypot(x-o.x,z-o.z)<o.r+radius:Math.abs(x-o.x)<o.hx+radius&&Math.abs(z-o.z)<o.hz+radius)return false;
  }
  return true;
}

function stoneMaterial(color){
  const m=new T.MeshStandardMaterial({color,roughness:.96});
  m.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 cityStoneP;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 stonePoint=vec4(position,1.);
      #ifdef USE_INSTANCING
      stonePoint=instanceMatrix*stonePoint;
      #endif
      cityStoneP=(modelMatrix*stonePoint).xyz;`);
    shader.fragmentShader='varying vec3 cityStoneP;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float grain=fract(sin(dot(floor(cityStoneP*150.),vec3(12.9898,78.233,43.13)))*43758.5453);
      float weather=sin(cityStoneP.x*2.7+sin(cityStoneP.z*1.9))*sin(cityStoneP.y*3.1+cityStoneP.z*.8);
      diffuseColor.rgb*=.94+grain*.09+weather*.035;`);
  };
  m.customProgramCacheKey=()=> 'luoyang-weathered-granite';
  return m;
}

export function buildCityScene({text=true}={}){
  const root=new T.Group();root.name='luoyang-bridge-3d';
  let seed=4179;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const stone=stoneMaterial('#afa590'),lightStone=stoneMaterial('#c2b69e'),darkStone=stoneMaterial('#8d8977');
  const green=new T.MeshStandardMaterial({color:'#84966b',roughness:1});
  const bark=stoneMaterial('#7b7057');
  const walkSurfaces=[],trees=[];
  function mesh(g,m,x=0,y=0,z=0,parent=root){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o}
  const box=(w,h,d,m,x,y,z,parent=root)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
  const solid=o=>{o.userData.citySolid=true;return o};
  const ground=box(16,.48,16,darkStone,0,-.27,4);ground.name='bridgehead-plaza';walkSurfaces.push(ground);
  const deck=box(4.5,.70,36.5,stone,0,-.38,-21.75);deck.name='walkable-stone-bridge';walkSurfaces.push(deck);
  // All paving is actual instanced geometry. Uneven colour and slender joints
  // preserve the long granite slabs visible in the reference photographs.
  const slabs=[];
  for(let row=0;row<13;row++)for(let col=0;col<11;col++){
    const x=-7.27+col*1.45,z=-3.35+row*1.20;
    slabs.push({x,z,w:1.42,d:1.17,c:random()});
  }
  for(let row=0;row<31;row++)for(let col=0;col<3;col++)slabs.push({x:(col-1)*1.49,z:-3.5-row*1.18,w:1.46,d:1.15,c:random()});
  const slabMesh=new T.InstancedMesh(new T.BoxGeometry(1,.065,1),lightStone,slabs.length),dummy=new T.Object3D();
  slabs.forEach((p,i)=>{dummy.position.set(p.x,.017,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(p.w,1,p.d);dummy.updateMatrix();slabMesh.setMatrixAt(i,dummy.matrix);slabMesh.setColorAt(i,new T.Color('#bdb59e').lerp(new T.Color('#ddd1b7'),p.c*.55))});
  slabMesh.castShadow=false;slabMesh.receiveShadow=true;slabMesh.name='granite-paving-slabs';root.add(slabMesh);walkSurfaces.push(slabMesh);
  // The riverside retaining walls leave a real opening for the bridge deck.
  for(const side of [-1,1]){
    box(5.75,1.6,.5,darkStone,side*5.125,-.8,-3.8);
    for(let row=0;row<3;row++)for(let i=0;i<5;i++)box(1.07,.40,.12,row%2?stone:darkStone,side*(2.85+i*1.12),-.30-row*.47,-4.10);
    box(.30,1.3,36.5,darkStone,side*2.09,-.91,-21.75);
  }
  const piers=new T.Group();piers.name='boat-shaped-granite-piers';root.add(piers);
  for(const z of [-6,-13.8,-21.6,-29.4,-37.2]){
    const shape=new T.Shape();shape.moveTo(-1.4,-.7);shape.lineTo(1.4,-.7);shape.lineTo(2.55,0);shape.lineTo(1.4,.7);shape.lineTo(-1.4,.7);shape.lineTo(-2.55,0);shape.closePath();
    const g=new T.ExtrudeGeometry(shape,{depth:1.9,bevelEnabled:true,bevelSize:.05,bevelThickness:.04,bevelSegments:1,steps:1});g.rotateX(-Math.PI/2);
    mesh(g,darkStone,0,-2.28,z,piers);
    box(4.7,.25,1.5,stone,0,-.48,z,piers);
  }
  const railings=new T.Group();railings.name='stone-bridge-railings';root.add(railings);
  for(const side of [-1,1]){
    for(let i=0;i<30;i++){
      const z=-4.7-i*1.18;
      box(.23,1.00,.24,stone,side*2.18,.51,z,railings);
      box(.32,.10,.33,lightStone,side*2.18,1.04,z,railings);
      if(i<29)box(.15,.14,1.16,lightStone,side*2.18,.75,z-.60,railings);
    }
  }
  solid(railings);
  // Two compact Song-style stone pagodas frame the first span.
  function pagoda(x,z){
    const g=new T.Group();g.position.set(x,0,z);g.name='bridgehead-stone-pagoda';root.add(g);solid(g);
    box(1.13,.22,1.13,darkStone,0,.11,0,g);
    mesh(new T.CylinderGeometry(.47,.55,.30,6),stone,0,.36,0,g);
    mesh(new T.CylinderGeometry(.28,.38,.90,6),lightStone,0,.96,0,g);
    for(let level=0;level<3;level++){
      const y=1.36+level*.55;
      mesh(new T.CylinderGeometry(.29,.61,.12,6),stone,0,y,0,g);
      mesh(new T.CylinderGeometry(.21,.26,.43,6),lightStone,0,y+.26,0,g);
    }
    mesh(new T.ConeGeometry(.19,.70,8),stone,0,3.12,0,g);
    mesh(new T.SphereGeometry(.08,12,8),darkStone,0,3.51,0,g);
  }
  pagoda(-3.12,-4.55);pagoda(3.12,-4.55);

  function inscription(words,{width=512,height=1024,color='#823b38',size=112,vertical=true}={}){
    if(!text||typeof document==='undefined')return new T.MeshStandardMaterial({color,roughness:1});
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');
    c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font=`500 ${size}px "Songti SC","STSong","Noto Serif CJK SC",serif`;
    if(vertical){[...words].forEach((word,i)=>c.fillText(word,width/2,height*(.2+i*.29)))}else c.fillText(words,width/2,height/2,width*.9);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=2;
    return new T.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-2});
  }
  const stele=new T.Group();stele.position.set(-4.25,0,2.2);stele.rotation.y=.12;stele.name='luoyang-bridge-inscribed-stele';root.add(stele);solid(stele);
  box(2.35,.24,1.10,darkStone,0,.12,0,stele);box(2.10,.13,.88,stone,0,.30,0,stele);
  const shape=new T.Shape();shape.moveTo(-.87,0);shape.lineTo(.87,0);shape.lineTo(.87,2.75);shape.quadraticCurveTo(.87,2.98,.60,3.0);shape.lineTo(-.56,3.06);shape.quadraticCurveTo(-.90,3.04,-.90,2.72);shape.closePath();
  mesh(new T.ExtrudeGeometry(shape,{depth:.38,bevelEnabled:true,bevelSize:.055,bevelThickness:.045,bevelSegments:3,steps:1,curveSegments:12}),lightStone,0,.36,-.19,stele);
  mesh(new T.PlaneGeometry(.69,2.55),inscription('洛阳桥',{width:256,size:180}),.32,1.94,.242,stele);
  mesh(new T.PlaneGeometry(.24,2.25),inscription('福建省',{color:'#756553',size:76}),-.40,1.83,.243,stele);
  const plaque=new T.Group();plaque.position.set(4.5,0,-1);plaque.rotation.y=-.12;plaque.name='heritage-plaque-and-stone-frame';root.add(plaque);solid(plaque);
  for(const side of [-1,1]){box(.31,2.9,.38,lightStone,side*1.15,1.45,0,plaque);box(.48,.15,.52,darkStone,side*1.15,.11,0,plaque)}
  box(2.66,1.43,.42,lightStone,0,3.02,0,plaque);box(2.24,1.07,.06,darkStone,0,3.02,.24,plaque);
  mesh(new T.PlaneGeometry(1.82,.64),inscription('洛阳桥',{vertical:false,width:1024,height:512,size:170,color:'#cbb98c'}),0,3.08,.278,plaque);
  mesh(new T.PlaneGeometry(1.85,.21),inscription('一座石桥 · 一段潮汐',{vertical:false,width:1024,height:128,size:62,color:'#d0c29e'}),0,2.73,.279,plaque);

  // A broad banyan with curved branches, visible roots and volumetric foliage.
  const tree=new T.Group();tree.position.set(5.4,0,1.1);tree.name='bridgehead-banyan';root.add(tree);solid(tree);
  function branch(points,radius,parent=tree){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(new T.TubeGeometry(curve,14,radius,7,false),bark,0,0,0,parent)}
  branch([[0,0,0],[-.12,1.3,.12],[.13,2.6,0],[-.30,4.25,-.18]],.34);
  for(let i=0;i<9;i++){
    const a=i/9*Math.PI*2,r=1.3+random()*.8;
    branch([[0,.25,0],[Math.cos(a)*.7,.14,Math.sin(a)*.7],[Math.cos(a)*r,.05,Math.sin(a)*r]],.10);
  }
  for(let i=0;i<10;i++){
    const a=i*2.39996,r=2.2+random()*1.8;
    branch([[0,2.3,0],[Math.cos(a)*r*.42,3.45,Math.sin(a)*r*.42],[Math.cos(a)*r,4.0+random()*.7,Math.sin(a)*r]],.12);
  }
  const leafMaterial=new T.MeshStandardMaterial({color:'#a1b88a',roughness:1});
  const foliageTime={value:0};
  leafMaterial.onBeforeCompile=shader=>{
    shader.uniforms.cityTime=foliageTime;shader.vertexShader='uniform float cityTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase=instanceMatrix[3].x*.6+instanceMatrix[3].z*.5;
      transformed.x+=sin(cityTime*.65+phase)*.032*(position.y+1.);
      transformed.z+=cos(cityTime*.47+phase)*.025;`);
  };
  const leaves=new T.InstancedMesh(new T.IcosahedronGeometry(1,2),leafMaterial,116);leaves.castShadow=leaves.receiveShadow=true;leaves.name='banyan-volumetric-canopy';
  for(let i=0;i<116;i++){
    const a=i*2.39996,r=Math.sqrt(random())*4.6;
    dummy.position.set(Math.cos(a)*r,4.0+Math.sqrt(Math.max(0,1-r*r/23))*1.15+random()*.30,Math.sin(a)*r);
    dummy.rotation.set(random(),random()*3,random());dummy.scale.set(.75+random()*.6,.38+random()*.38,.65+random()*.6);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
    leaves.setColorAt(i,new T.Color('#52704c').lerp(new T.Color('#9bac6d'),random()*.8));
  }tree.add(leaves);trees.push(tree);
  for(let i=0;i<13;i++){
    const x=-2.8+random()*5.3,z=-2.5+random()*5,y=4.1+random()*.5;
    branch([[x,y,z],[x-.05,y-1,z+.1],[x+.08,y-1.6-random(),z+.13]],.012);
  }

  // Shore strips and the distant city give the orbit camera a complete world.
  const land=box(160,1,88,new T.MeshStandardMaterial({color:'#9b9b75',roughness:1}),0,-1.65,56);land.name='southern-riverbank';
  box(190,1,48,green,0,-1.5,-89);
  const tidalFlat=new T.MeshStandardMaterial({color:'#8b9470',roughness:1});
  for(const side of [-1,1]){
    const flat=mesh(new T.SphereGeometry(1,36,12),tidalFlat,side*22,-1.60,-12);flat.scale.set(13,.35,23);
    const marsh=mesh(new T.SphereGeometry(1,32,12),green,side*32,-1.44,-24);marsh.scale.set(13,.5,25);
  }
  const rocks=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),darkStone,95);rocks.name='tidal-oyster-rocks';
  for(let i=0;i<95;i++){
    const side=i%2?1:-1;dummy.position.set(side*(10+random()*22),-1.15,-3-random()*37);dummy.rotation.set(random()*2,random()*6,random());dummy.scale.set(.12+random()*.45,.06+random()*.18,.14+random()*.4);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
  }rocks.receiveShadow=true;root.add(rocks);
  const distant=new T.MeshStandardMaterial({color:'#b8b49b',roughness:1});
  const buildings=new T.InstancedMesh(new T.BoxGeometry(1,1,1),distant,36);buildings.name='soft-quanzhou-skyline';
  for(let i=0;i<36;i++){
    const h=1.0+random()*4;dummy.position.set(-55+i*3.2,h/2-1,-68-random()*9);dummy.rotation.set(0,0,0);dummy.scale.set(1.5+random()*1.1,h,1.4+random());dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);buildings.setColorAt(i,new T.Color('#c3bdab').lerp(new T.Color('#a6b6a4'),random()));
  }root.add(buildings);
  // A small Fujian roof silhouette across the estuary, away from the route.
  const pavilion=new T.Group();pavilion.position.set(-15,-.6,-50);root.add(pavilion);
  for(const x of [-1,1])for(const z of [-1,1])box(.18,2.1,.18,stone,x,1.05,z,pavilion);
  const roof=mesh(new T.ConeGeometry(2.05,.90,4),new T.MeshStandardMaterial({color:'#a07d64',roughness:1}),0,2.45,0,pavilion);roof.rotation.y=Math.PI/4;roof.scale.z=1.2;

  const waterMaterial=new T.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:`varying vec3 worldP;void main(){worldP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(worldP,1.);}`,
    fragmentShader:`varying vec3 worldP;uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      void main(){vec2 p=worldP.xz;float n=noise(p*.70+vec2(time*.05,-time*.035));
      float ripple=sin(p.x*3.3+p.y*2.8+n*5.-time*.7)*sin(p.y*3.6-time*.31);
      float fresnel=pow(1.-max(0.,normalize(cameraPosition-worldP).y),2.);
      vec3 c=mix(vec3(.31,.48,.43),vec3(.68,.75,.64),.25+fresnel*.6);
      c+=n*.04+pow(max(0.,ripple),17.)*.08;
      float bridgeShadow=(1.-smoothstep(2.,4.2,abs(p.x)))*smoothstep(-43.,-39.,p.y)*(1.-smoothstep(-4.,-1.,p.y));
      c*=1.-bridgeShadow*.14;
      gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
  const water=mesh(new T.PlaneGeometry(200,200),waterMaterial,0,-1.18,-38);water.rotation.x=-Math.PI/2;water.castShadow=false;water.name='moving-estuary-water';
  const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,depthTest:false,uniforms:{},vertexShader:'',fragmentShader:`varying vec3 d;void main(){float h=clamp(normalize(d).y,0.,1.);vec3 c=mix(vec3(.91,.86,.72),vec3(.57,.73,.75),pow(h,.65));float clouds=sin(d.x*.032+d.z*.021)*sin(d.z*.047-d.x*.011);c=mix(c,vec3(.96,.94,.83),smoothstep(.40,.83,clouds)*.22);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
  const sky=new T.Mesh(new T.SphereGeometry(100,32,16),skyMaterial);configureSkyBackground(sky);root.add(sky);
  return {root,walkSurfaces,water,stele,plaque,trees,update(time){waterMaterial.uniforms.time.value=time;foliageTime.value=time;}};
}
