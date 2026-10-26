import * as T from './vendor/three/build/three.module.js';
import { createCityWater } from './city-water.js';
import { createGraniteTexture, createStoneMaterial, createWornStoneGeometry } from './city-stone.js';
import { buildCityEntrance } from './city-entrance.js';
import { createCitySky } from './city-atmosphere.js';

export const CITY_FLOOR=.055;
export const CITY_OBSTACLES=[
  {x:-4.25,z:2.2,hx:1.22,hz:.65},
  {x:5.4,z:1.1,r:1.96},
  {x:3.35,z:-1.0,r:.34},{x:5.65,z:-1.0,r:.34},
  {x:-5.5,z:-2.7,hx:.75,hz:.75},{x:5.5,z:-2.7,hx:.75,hz:.75},
  {x:-6.55,z:6.0,hx:2.55,hz:2.12},
];

// Both actors and every route segment share this clearance mask. Bridge railings,
// the river, the monument plinth and banyan roots cannot become destinations.
export function cityWalkable(x,z,radius=.32){
  const plaza=x>-8+radius&&x<8-radius&&z>-4+radius&&z<12-radius;
  const bridge=Math.abs(x)<2.25-radius&&z>=-40+radius&&z<=-3.4;
  const farLanding=Math.abs(x)<5.7-radius&&z>=-43.5+radius&&z<-39.6;
  const villageApproach=Math.abs(x)<2.25-radius&&z>=-65+radius&&z<-43.2;
  if(!plaza&&!bridge&&!farLanding&&!villageApproach)return false;
  for(const o of CITY_OBSTACLES){
    if(o.r?Math.hypot(x-o.x,z-o.z)<o.r+radius:Math.abs(x-o.x)<o.hx+radius&&Math.abs(z-o.z)<o.hz+radius)return false;
  }
  return true;
}

export function buildCityScene({text=true}={}){
  const root=new T.Group();root.name='luoyang-bridge-3d';
  let seed=4179;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const granite=createGraniteTexture(),stoneMaterial=color=>createStoneMaterial(color,granite);
  const stone=stoneMaterial('#949a96'),lightStone=stoneMaterial('#c2c5bf'),darkStone=stoneMaterial('#707974');
  const green=new T.MeshStandardMaterial({color:'#556653',roughness:1});
  const bark=stoneMaterial('#625f51');
  const wornBlocks=Array.from({length:6},(_,i)=>createWornStoneGeometry(173+i*319));let blockIndex=0;
  const walkSurfaces=[],trees=[],mooredBoats=[];
  function mesh(g,m,x=0,y=0,z=0,parent=root){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o}
  const box=(w,h,d,m,x,y,z,parent=root)=>{
    if(!m.userData.cityStone)return mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
    const o=mesh(wornBlocks[blockIndex++%wornBlocks.length],m,x,y,z,parent);o.scale.set(w,h,d);return o;
  };
  const solid=o=>{o.userData.citySolid=true;return o};
  const grout=new T.MeshStandardMaterial({color:'#383e36',roughness:1});
  const ground=box(16,.48,16,grout,0,-.29,4);ground.name='bridgehead-plaza';walkSurfaces.push(ground);
  const deck=box(4.5,.70,36.5,darkStone,0,-.40,-21.75);deck.name='walkable-stone-bridge';walkSurfaces.push(deck);
  // Photo 04: staggered transverse flagstones on the approach. Photo 03/09:
  // four unequal lanes of long granite beams on the bridge, not square tiles.
  const slabs=[];
  for(let z=-3.50;z<11.95;){
    const depth=Math.min(.46+random()*.32,12-z);let x=-7.99;
    while(x<7.97){
      const width=Math.min(.85+random()*1.50,8-x);
      slabs.push({x:x+width/2,z:z+depth/2,w:Math.max(.03,width-.025-random()*.018),d:depth-.025,c:random(),bridge:false});x+=width;
    }z+=depth;
  }
  const widths=[1.04,1.12,1.02,1.14];let laneX=-2.20;
  for(const width of widths){
    for(let z=-3.50;z>-39.99;){
      const length=Math.min(2.0+random()*2.35,z+40);
      slabs.push({x:laneX+width/2,z:z-length/2,w:width-.035,d:Math.max(.03,length-.04-random()*.025),c:random(),bridge:true});z-=length;
    }laneX+=width;
  }
  const paving=new T.Group();paving.name='granite-paving-slabs';root.add(paving);const dummy=new T.Object3D();
  for(let variant=0;variant<6;variant++){
    const pieces=slabs.filter((_,i)=>i%6===variant),slabMesh=new T.InstancedMesh(wornBlocks[variant],lightStone,pieces.length);
    pieces.forEach((p,i)=>{
      dummy.position.set(p.x,-.020,p.z);dummy.rotation.set(0,(random()-.5)*.008,0);dummy.scale.set(p.w,.15,p.d);dummy.updateMatrix();slabMesh.setMatrixAt(i,dummy.matrix);
      slabMesh.setColorAt(i,new T.Color('#a2a9a3').lerp(new T.Color('#eeeee6'),p.c));
    });
    slabMesh.castShadow=false;slabMesh.receiveShadow=true;slabMesh.name='worn-granite-flagstones';slabMesh.userData.stoneSlabs=pieces;
    paving.add(slabMesh);walkSurfaces.push(slabMesh);
  }
  const cracks=new T.Group();cracks.name='old-granite-hairline-fractures';root.add(cracks);
  const fractureMaterial=new T.MeshStandardMaterial({color:'#555b55',roughness:1});
  for(const p of slabs){
    if(random()>(p.bridge?.27:.09))continue;
    const points=[],start=(random()-.5)*p.d*.55,reach=.18+random()*.35;
    for(let i=0;i<5;i++)points.push(new T.Vector3(p.x-p.w*.46+p.w*reach*i/4,.054,p.z+start+(random()-.5)*.09));
    const curve=new T.CatmullRomCurve3(points);const line=mesh(new T.TubeGeometry(curve,8,.002+random()*.002,3,false),fractureMaterial,0,0,0,cracks);line.castShadow=false;
  }
  // Edge course stays outside the bridge opening, avoiding coplanar paving.
  for(const side of [-1,1])box(5.72,.15,.46,stone,side*5.14,-.020,-3.75);
  // Earth and darker damp margins beside the bridgehead path.
  const earth=stoneMaterial('#665b49');
  for(const side of [-1,1])box(1.02,.09,3.4,earth,side*3.10,.022,-2.18);
  // The riverside retaining walls leave a real opening for the bridge deck.
  for(const side of [-1,1]){
    box(5.75,1.6,.5,darkStone,side*5.125,-.8,-3.8);
    for(let row=0;row<3;row++)for(let i=0;i<5;i++)box(1.07,.40,.12,row%2?stone:darkStone,side*(2.85+i*1.12),-.30-row*.47,-4.10);
    for(let row=0;row<3;row++)for(let i=0;i<37;i++)box(.31,.27,.93,row%2?darkStone:stone,side*2.12,-.39-row*.29,-4.02-i*.98);
  }
  const piers=new T.Group();piers.name='boat-shaped-granite-piers';root.add(piers);
  for(const z of [-6,-13.8,-21.6,-29.4,-37.2]){
    const outline=[[-2.5,-.84],[2.5,-.84],[3.85,0],[2.5,.84],[-2.5,.84],[-3.85,0]];
    const shape=new T.Shape(outline.map(p=>new T.Vector2(...p)));
    const g=new T.ExtrudeGeometry(shape,{depth:1.9,bevelEnabled:true,bevelSize:.05,bevelThickness:.04,bevelSegments:1,steps:1});g.rotateX(-Math.PI/2);
    mesh(g,darkStone,0,-2.28,z,piers);
    for(let row=0;row<6;row++)for(let edge=0;edge<outline.length;edge++){
      const a=new T.Vector2(...outline[edge]),b=new T.Vector2(...outline[(edge+1)%outline.length]),length=a.distanceTo(b);
      const count=Math.ceil(length/(.63+((row+edge)%3)*.08));
      for(let i=0;i<count;i++){
        const t=(i+.5)/count,point=a.clone().lerp(b,t),width=length/count;
        const block=box(width-.025,.292,.22,(i+row)%3?darkStone:stone,point.x,-.53-row*.305,z+point.y,piers);
        block.rotation.y=-Math.atan2(b.y-a.y,b.x-a.x);
      }
    }
    for(let i=0;i<8;i++){
      const x=-3.36+i*.96,depth=Math.abs(x)>2.5?Math.max(.24,(3.85-Math.abs(x))/1.35*1.66):1.66;
      box(.93,.17,depth,stone,x,-.40,z,piers);
    }
  }
  const railings=new T.Group();railings.name='stone-bridge-railings';root.add(railings);
  for(const side of [-1,1]){
    for(let i=0;i<30;i++){
      const z=-4.7-i*1.18;
      box(.29,1.02,.30,stone,side*2.18,.55,z,railings);
      box(.33,.36,.34,lightStone,side*2.18,.97,z,railings);
      box(.32,.055,.33,darkStone,side*2.18,.765,z,railings);
      box(.37,.14,.38,darkStone,side*2.18,.12,z,railings);
      if(i<29)box(.22,.24,1.19,lightStone,side*2.18,.56,z-.60,railings);
    }
  }
  solid(railings);
  // Photo 03: weathered polygonal pagodas, recessed niches and broad tier eaves.
  function pagoda(x,z){
    const g=new T.Group();g.position.set(x,0,z);g.name='bridgehead-stone-pagoda';root.add(g);solid(g);
    box(1.42,.22,1.42,darkStone,0,.11,0,g);
    mesh(new T.CylinderGeometry(.61,.68,.21,8),stone,0,.33,0,g);
    mesh(new T.CylinderGeometry(.48,.59,.25,8),lightStone,0,.55,0,g);
    for(let level=0;level<5;level++){
      const y=.78+level*.60,r=.46-level*.045;
      mesh(new T.CylinderGeometry(r,r+.035,.43,8),stone,0,y+.16,0,g);
      mesh(new T.CylinderGeometry(r*.92,r+.18,.13,8),lightStone,0,y+.43,0,g);
      mesh(new T.CylinderGeometry(r+.18,r+.23,.075,8),darkStone,0,y+.34,0,g);
      for(let side=0;side<4;side++){
        const angle=side*Math.PI/2,rr=r*.94;
        const niche=box(.13,.18,.025,darkStone,Math.sin(angle)*rr,y+.17,Math.cos(angle)*rr,g);niche.rotation.y=angle;
        const inner=box(.072,.12,.035,stone,Math.sin(angle)*(rr+.01),y+.15,Math.cos(angle)*(rr+.01),g);inner.rotation.y=angle;
      }
    }
    mesh(new T.CylinderGeometry(.11,.14,.67,8),darkStone,0,4.03,0,g);
    mesh(new T.ConeGeometry(.14,.26,8),stone,0,4.47,0,g);
  }
  pagoda(-5.5,-2.7);pagoda(5.5,-2.7);

  // Photo 04: two small stone shelters frame the narrower bridge opening.
  const shelters=new T.Group();shelters.name='paired-bridgehead-stone-shelters';root.add(shelters);solid(shelters);
  for(const side of [-1,1]){
    const shelter=new T.Group();shelter.position.set(side*3.12,0,-4.75);shelters.add(shelter);
    box(1.72,.24,1.65,darkStone,0,-.06,0,shelter);
    for(const x of [-.57,.57])for(const z of [-.45,.45]){
      box(.20,1.72,.23,lightStone,x,.99,z,shelter);box(.31,.13,.34,stone,x,.22,z,shelter);
      box(.33,.16,.34,stone,x,1.81,z,shelter);
    }
    box(1.46,.23,1.24,stone,0,1.98,0,shelter);
    const positions=[],uvs=[],roofHeight=(x,z)=>2.39-Math.abs(x)*.44+Math.pow(Math.abs(x)/.86,5)*.11+Math.pow(Math.abs(z)/.74,6)*.075;
    const point=(x,z)=>new T.Vector3(x,roofHeight(x,z),z);
    const triangle=(a,b,c)=>{for(const v of [a,b,c]){positions.push(v.x,v.y,v.z);uvs.push(v.x,v.z);}};
    for(let i=0;i<12;i++)for(let j=0;j<12;j++){
      const x=-.86+i*1.72/12,z=-.74+j*1.48/12,dx=1.72/12,dz=1.48/12;
      triangle(point(x,z),point(x,z+dz),point(x+dx,z));triangle(point(x+dx,z),point(x,z+dz),point(x+dx,z+dz));
    }
    const roofGeometry=new T.BufferGeometry();roofGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));roofGeometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));roofGeometry.computeVertexNormals();
    mesh(roofGeometry,stone,0,0,0,shelter);
    for(const z of [-.74,.74]){
      const gable=new T.BufferGeometry(),vertices=[-.86,2,z,0,2.39,z,.86,2,z];
      if(z>0)vertices.splice(0,9,.86,2,z,0,2.39,z,-.86,2,z);
      gable.setAttribute('position',new T.Float32BufferAttribute(vertices,3));gable.setAttribute('uv',new T.Float32BufferAttribute([0,0,.5,1,1,0],2));gable.computeVertexNormals();mesh(gable,stone,0,0,0,shelter);
      for(const x of [-.42,.42]){const eave=box(.96,.10,.14,lightStone,x,2.21,z,shelter);eave.rotation.z=x<0?.34:-.34;}
    }
    for(let i=0;i<11;i++){
      const z=-.69+i*.138;
      for(const sideRoof of [-1,1]){
        const curve=new T.CatmullRomCurve3([0,.38,.82].map(x=>new T.Vector3(x*sideRoof,roofHeight(x,z)+.025,z)));
        mesh(new T.TubeGeometry(curve,8,.026,5,false),lightStone,0,0,0,shelter);
      }
    }
    box(.12,.11,1.56,lightStone,0,2.46,0,shelter);
    // A small stone guardian silhouette sits within each shelter.
    mesh(new T.CylinderGeometry(.16,.23,.48,7),darkStone,0,.50,0,shelter);
    mesh(new T.SphereGeometry(.16,8,6),stone,0,.85,0,shelter);
    mesh(new T.ConeGeometry(.16,.22,6),stone,0,1.04,0,shelter);
  }

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
  const tree=new T.Group();tree.position.set(5.4,.74,1.1);tree.scale.set(1,1.45,1);tree.name='bridgehead-banyan';root.add(tree);solid(tree);
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
  const leafMaterial=new T.MeshStandardMaterial({color:'#a3b19a',roughness:1});
  const foliageTime={value:0};
  leafMaterial.onBeforeCompile=shader=>{
    shader.uniforms.cityTime=foliageTime;shader.vertexShader='uniform float cityTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase=instanceMatrix[3].x*.6+instanceMatrix[3].z*.5;
      transformed.x+=sin(cityTime*.65+phase)*.032*(position.y+1.);
      transformed.z+=cos(cityTime*.47+phase)*.025;`);
  };
  const leaves=new T.InstancedMesh(new T.IcosahedronGeometry(1,2),leafMaterial,360);leaves.castShadow=leaves.receiveShadow=true;leaves.name='banyan-volumetric-canopy';
  for(let i=0;i<360;i++){
    const a=i*2.39996,r=Math.sqrt(random())*4.6;
    dummy.position.set(Math.cos(a)*r,4.0+Math.sqrt(Math.max(0,1-r*r/23))*1.15+random()*.30,Math.sin(a)*r);
    dummy.rotation.set(random(),random()*3,random());dummy.scale.set(.45+random()*.55,.23+random()*.29,.42+random()*.53);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
    leaves.setColorAt(i,new T.Color('#3e5848').lerp(new T.Color('#849775'),random()*.8));
  }tree.add(leaves);trees.push(tree);
  for(let i=0;i<13;i++){
    const x=-2.8+random()*5.3,z=-2.5+random()*5,y=4.1+random()*.5;
    branch([[x,y,z],[x-.05,y-1,z+.1],[x+.08,y-1.6-random(),z+.13]],.012);
  }

  buildCityEntrance({root,mesh,box,stone,lightStone,darkStone,stoneMaterial});

  // Shore strips and the distant city give the orbit camera a complete world.
  const land=box(160,5.2,88,new T.MeshStandardMaterial({color:'#666c58',roughness:1}),0,-2.70,56);land.name='southern-riverbank';
  box(190,1,48,green,0,-1.5,-89);
  // The historic span must visibly arrive somewhere. A solid northern bank,
  // stone landing and narrow continuation toward the village replace the old
  // stretch of open water between the last bridge slab and the distant shore.
  const farShore=new T.Group();farShore.name='luoyang-bridge-connected-northern-bank';root.add(farShore);
  const farEarth=box(150,4.8,29,new T.MeshStandardMaterial({color:'#626652',roughness:1}),0,-2.46,-54.3,farShore);farEarth.name='solid-northern-riverbank';
  const farLanding=box(11.4,.22,8.6,lightStone,0,-.055,-43.9,farShore);farLanding.name='northern-stone-bridge-landing';walkSurfaces.push(farLanding);
  const villagePath=box(4.5,.18,17.2,stone,0,-.035,-56.7,farShore);villagePath.name='northern-village-approach-path';
  for(const side of [-1,1]){
    box(69,1.72,.62,darkStone,side*40.2,-.91,-40.1,farShore);
    box(69,.18,.82,lightStone,side*40.2,-.01,-40.1,farShore);
  }
  for(let z=-47.5;z>-64.8;z-=1.08){
    const seam=box(4.22,.025,.045,darkStone,0,.066,z,farShore);seam.castShadow=false;
  }
  const tidalFlat=new T.MeshStandardMaterial({color:'#8b9470',roughness:1});
  for(const side of [-1,1]){
    const flat=mesh(new T.SphereGeometry(1,36,12),tidalFlat,side*58,-1.70,-39);flat.scale.set(13,.35,23);
    const marsh=mesh(new T.SphereGeometry(1,32,12),green,side*68,-1.44,-51);marsh.scale.set(13,.5,25);
  }
  const rocks=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),darkStone,95);rocks.name='tidal-oyster-rocks';
  for(let i=0;i<95;i++){
    const side=i%2?1:-1;dummy.position.set(side*(40+random()*22),-1.15,-22-random()*37);dummy.rotation.set(random()*2,random()*6,random());dummy.scale.set(.12+random()*.45,.06+random()*.18,.14+random()*.4);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
  }rocks.receiveShadow=true;root.add(rocks);
  const distant=new T.MeshStandardMaterial({color:'#829b9c',roughness:1});
  const buildings=new T.InstancedMesh(new T.BoxGeometry(1,1,1),distant,36);buildings.name='soft-quanzhou-skyline';
  for(let i=0;i<36;i++){
    const h=2.0+random()*5;dummy.position.set(-63+i*3.6,h/2-1,-106-random()*15);dummy.rotation.set(0,0,0);dummy.scale.set(1.5+random()*1.1,h,1.4+random());dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);buildings.setColorAt(i,new T.Color('#abb3ad').lerp(new T.Color('#768f90'),random()));
  }root.add(buildings);
  const skylineWindows=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:'#778f90',roughness:1}),36*24);
  let windowIndex=0;
  for(let i=0;i<36;i++){
    buildings.getMatrixAt(i,dummy.matrix);dummy.matrix.decompose(dummy.position,dummy.quaternion,dummy.scale);
    const position=dummy.position.clone(),scale=dummy.scale.clone();
    for(let floor=0;floor<8;floor++)for(let col=0;col<3;col++){
      dummy.position.set(position.x+(col-1)*scale.x*.27,position.y-scale.y/2+.35+(floor+.25)*scale.y/8,position.z+scale.z/2+.012);
      dummy.rotation.set(0,0,0);dummy.scale.set(scale.x*.12,scale.y*.055,1);dummy.updateMatrix();skylineWindows.setMatrixAt(windowIndex++,dummy.matrix);
    }
  }skylineWindows.name='distant-city-window-rhythm';root.add(skylineWindows);
  // Photo 05: a lower, irregular village/tree layer between the water and towers.
  const shoreVillage=new T.Group();shoreVillage.name='quanzhou-waterfront-village';root.add(shoreVillage);
  const plaster=new T.MeshStandardMaterial({color:'#b8b8aa',roughness:1}),brick=new T.MeshStandardMaterial({color:'#947c68',roughness:1});
  const windowMaterial=new T.MeshStandardMaterial({color:'#3c5050',roughness:.8});
  for(let i=0;i<24;i++){
    const x=-47+i*4.1,z=-67-random()*7,w=2.2+random()*1.5,h=1.4+random()*2.3;
    box(w,h,2.0,i%3?plaster:brick,x,-1+h/2,z,shoreVillage);
    box(w+.14,.12,2.2,darkStone,x,h-.94,z,shoreVillage);
    for(let floor=0;floor<2;floor++)for(let col=0;col<3;col++)box(.32,.37,.035,windowMaterial,x+(col-1)*w*.26,-.45+floor*h*.46,z+1.02,shoreVillage);
    if(i%3===0){const tiled=mesh(new T.ConeGeometry(w*.75,.72,4),brick,x,h-.66,z,shoreVillage);tiled.rotation.y=Math.PI/4;tiled.scale.z=.68;}
  }
  const shoreTrees=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#728372',roughness:1}),780);
  for(let i=0;i<780;i++){
    const cluster=Math.floor(i/6),angle=i*2.39996,r=.32+random()*.53;
    const x=-59+(cluster/129)*118+Math.cos(angle)*.8,z=-66+Math.sin(cluster*5.8)*1.2+Math.sin(angle)*.7;
    dummy.position.set(x,-.35+Math.sin(cluster*2.31)*.45+(i%6)*.21,z);dummy.rotation.set(random(),random()*6,random());dummy.scale.set(r*1.4,r*.8,r);dummy.updateMatrix();shoreTrees.setMatrixAt(i,dummy.matrix);
    shoreTrees.setColorAt(i,new T.Color('#3b5147').lerp(new T.Color('#809477'),random()));
  }shoreTrees.name='layered-waterfront-trees';root.add(shoreTrees);
  // Small reeds at the distant shore break the straight water/land edge while
  // leaving the near water open. Their ochre echoes the margins in photo 06.
  const reeds=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#72745a',roughness:1}),90);
  for(let i=0;i<90;i++){
    dummy.position.set(-65+random()*130,-1.13+random()*.08,-62-random()*3.4);
    dummy.rotation.set(0,random()*6,0);dummy.scale.set(.7+random()*1.1,.12+random()*.13,.45+random()*.7);dummy.updateMatrix();reeds.setMatrixAt(i,dummy.matrix);
  }reeds.name='muted-distant-reed-margin';root.add(reeds);
  const boats=new T.Group();boats.name='moored-estuary-fishing-boats';root.add(boats);
  const boatWood=stoneMaterial('#877c69'),boatPaint=stoneMaterial('#a5afa0');
  for(const [x,z,angle] of [[-13,-17,.8],[17,-26,-.3],[-25,-40,.2],[12,-52,-.9]]){
    const boat=new T.Group();boat.position.set(x,-1.16,z);boat.rotation.y=angle;boat.userData.cityAnimated=true;boats.add(boat);mooredBoats.push(boat);
    const outline=[[-.43,-.8],[-.24,-1.35],[.24,-1.35],[.43,-.8],[.43,.8],[0,1.5],[-.43,.8]],hull=new T.Shape(outline.map(p=>new T.Vector2(...p)));
    const g=new T.ExtrudeGeometry(hull,{depth:.22,bevelEnabled:true,bevelSize:.07,bevelThickness:.07,bevelSegments:1,steps:1});g.rotateX(-Math.PI/2);mesh(g,boatPaint,0,-.07,0,boat);
    box(.65,.055,1.84,boatWood,0,.21,-.05,boat);
    for(let i=0;i<3;i++)box(.75,.06,.15,boatWood,0,.28,-.65+i*.60,boat);
    if(x>0){
      for(const side of [-1,1])box(.035,.62,1.2,boatWood,side*.35,.53,-.15,boat);
      const cover=mesh(new T.CylinderGeometry(.40,.40,1.26,12,1,true,0,Math.PI),boatPaint,0,.82,-.15,boat);cover.rotation.x=Math.PI/2;
    }
    const rope=new T.CatmullRomCurve3([new T.Vector3(0,.15,1.4),new T.Vector3(.4,.08,2.2),new T.Vector3(.7,.03,3.3)]);
    mesh(new T.TubeGeometry(rope,10,.012,4,false),boatWood,0,0,0,boat);
  }
  // A small Fujian roof silhouette across the estuary, away from the route.
  const pavilion=new T.Group();pavilion.position.set(-21,-.6,-67);root.add(pavilion);
  for(const x of [-1,1])for(const z of [-1,1])box(.18,2.1,.18,stone,x,1.05,z,pavilion);
  const roof=mesh(new T.ConeGeometry(2.05,.90,4),new T.MeshStandardMaterial({color:'#a07d64',roughness:1}),0,2.45,0,pavilion);roof.rotation.y=Math.PI/4;roof.scale.z=1.2;

  const water=createCityWater();root.add(water);
  const sky=createCitySky('dusk');root.add(sky);
  return {root,walkSurfaces,water,stele,plaque,trees,update(time){
    water.material.uniforms.time.value=time;foliageTime.value=time;sky.material.uniforms.time.value=time;
    mooredBoats.forEach((boat,i)=>{boat.position.y=-1.16+Math.sin(time*.40+i*1.7)*.013;boat.rotation.z=Math.sin(time*.32+i)*.005;boat.rotation.x=Math.cos(time*.28+i)*.004;});
  }};
}
