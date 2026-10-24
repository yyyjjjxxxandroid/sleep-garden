import * as T from './vendor/three/build/three.module.js';

// Photo-led reconstruction of the bridgehead courtyard. The photograph fixes
// the vocabulary (brick hall, stone portico, raised banyan bed), not survey data.
export function buildCityEntrance({root,mesh,box,stone,lightStone,darkStone,stoneMaterial}){
  let seed=7923;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const entrance=new T.Group();entrance.name='luoyang-entrance-courtyard';root.add(entrance);
  const dummy=new T.Object3D();
  const brick=stoneMaterial('#925646'),red=stoneMaterial('#713f34');
  const mortar=new T.MeshStandardMaterial({color:'#594d43',roughness:1});
  const wood=stoneMaterial('#493a31'),tile=stoneMaterial('#706e61'),tileLight=stoneMaterial('#8a8879');
  const groundMaterial=stoneMaterial('#96998c');

  // Full-depth connected earth, not a thin deck above water. The upper terrace
  // meets the existing flagstones from below; its front stops at the waterline.
  const foundation=mesh(new T.BoxGeometry(48,5.2,48),groundMaterial,0,-2.69,20,entrance);
  foundation.name='solid-bridgehead-land-foundation';
  const apron=box(36,.14,30,groundMaterial,0,-.17,11.05,entrance);apron.name='connected-entrance-stone-apron';
  const paving=[];
  for(let z=-3.35;z<23;z+=.85)for(let x=-17.5;x<18;x+=1.6){
    if(x>-8.6&&x<8.6&&z<12.4)continue;
    paving.push({x:x+(random()-.5)*.10,z,w:1.56,d:.81});
  }
  const slabs=new T.InstancedMesh(new T.BoxGeometry(1,.08,1),lightStone,paving.length);
  paving.forEach((p,i)=>{dummy.position.set(p.x,-.095,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(p.w,1,p.d);dummy.updateMatrix();slabs.setMatrixAt(i,dummy.matrix);slabs.setColorAt(i,new T.Color('#a9aea5').lerp(new T.Color('#d0d0c1'),random()));});
  slabs.name='entrance-surrounding-courtyard-paving';slabs.receiveShadow=true;entrance.add(slabs);

  // Coursed quay wall wraps the two front shoulders and both flanks, below the
  // terrace down past the tidal surface. It closes the formerly floating edge.
  const quay=new T.Group();quay.name='entrance-quay-retaining-walls';entrance.add(quay);
  for(const side of [-1,1]){
    for(let row=0;row<7;row++)for(let i=0;i<20;i++){
      const x=side*(2.75+i*1.08),z=-3.94;
      box(1.055,.34,.36,row%2?stone:darkStone,x,-.30-row*.36,z,quay);
    }
    for(let row=0;row<6;row++)for(let i=0;i<38;i++)box(.36,.35,1.22,row%2?darkStone:stone,side*23.96,-.30-row*.37,-3.35+i*1.25,quay);
    for(let i=0;i<18;i++)box(1.20,.17,.57,lightStone,side*(3.0+i*1.23),-.06,-3.92,quay);
  }

  function curvedRoof(parent,{width,depth,eave,rise,material=tile,stoneRibs=false}){
    const roof=new T.Group();roof.name='curved-tiled-hip-roof';parent.add(roof);
    const roofY=(x,z)=>{
      const pitch=Math.max(Math.abs(z)/(depth*.5),Math.max(0,Math.abs(x)-width*.30)/(width*.20));
      const turn=Math.pow(Math.abs(x)/(width*.5),6)*Math.pow(Math.abs(z)/(depth*.5),4)*.20;
      return eave+rise*(1-Math.min(1,pitch))+turn;
    };
    const positions=[],uvs=[],nx=32,nz=20;
    const point=(i,j)=>new T.Vector3(-width/2+i*width/nx,roofY(-width/2+i*width/nx,-depth/2+j*depth/nz),-depth/2+j*depth/nz);
    const tri=(a,b,c)=>{for(const p of [a,b,c]){positions.push(p.x,p.y,p.z);uvs.push(p.x,p.z);}};
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){tri(point(i,j),point(i,j+1),point(i+1,j));tri(point(i+1,j),point(i,j+1),point(i+1,j+1));}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();mesh(g,material,0,0,0,roof);
    const ribs=Math.ceil(width/(stoneRibs?.23:.16));
    for(let i=0;i<=ribs;i++){
      const x=-width/2+i*width/ribs;
      for(const side of [-1,1]){
        const points=Array.from({length:10},(_,j)=>{const z=side*depth/2*j/9;return new T.Vector3(x,roofY(x,z)+.035,z);});
        mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),14,stoneRibs?.036:.045,5,false),stoneRibs?lightStone:tileLight,0,0,0,roof);
      }
    }
    // Tile courses cross the rounded pan ribs; each row retains a small lip.
    for(const side of [-1,1])for(let row=1;row<Math.ceil(depth/.38);row++){
      const z=side*row*.19;if(Math.abs(z)>depth/2)continue;
      const points=Array.from({length:25},(_,j)=>{const x=-width/2+j*width/24;return new T.Vector3(x,roofY(x,z)+.015,z);});
      mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,.018,4,false),material,0,0,0,roof);
    }
    for(const side of [-1,1]){
      const points=Array.from({length:25},(_,i)=>{const x=-width/2+i*width/24,z=side*depth/2;return new T.Vector3(x,roofY(x,z)-.025,z);});
      mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,.095,6,false),stoneRibs?stone:tileLight,0,0,0,roof);
    }
    box(width*.62,.14,.17,stoneRibs?lightStone:tileLight,0,eave+rise+.07,0,roof);
    for(const side of [-1,1]){
      const points=[[side*width*.28,eave+rise+.09,0],[side*width*.36,eave+rise+.16,0],[side*width*.40,eave+rise+.38,0]].map(p=>new T.Vector3(...p));
      mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.065,6,false),stoneRibs?stone:tileLight,0,0,0,roof);
    }
    return roof;
  }

  const hall=new T.Group();hall.name='reference-red-brick-entrance-hall';hall.position.set(-12.8,0,5.5);hall.rotation.y=Math.PI/2;hall.userData.citySolid=true;entrance.add(hall);
  box(11.6,.55,6.8,darkStone,0,.15,0,hall);
  // Split front wall leaves a genuine recessed opening, visible from any angle.
  for(const side of [-1,1])box(4.55,3.20,.30,mortar,side*3.275,2.05,2.70,hall);
  box(2,1.15,.30,mortar,0,3.075,2.70,hall);
  box(11.1,3.2,.30,mortar,0,2.05,-2.70,hall);
  for(const side of [-1,1])box(.30,3.2,5.4,mortar,side*5.4,2.05,0,hall);
  const bricks=[];
  for(const face of [-1,1])for(let row=0;row<23;row++)for(let col=0;col<34;col++){
    const x=-5.32+col*.32+(row%2)*.16,y=.55+row*.134;
    if(x>5.36||(face===1&&Math.abs(x)<1.08&&y<2.53))continue;
    bricks.push({x,y,z:face*2.87,angle:0});
  }
  for(const side of [-1,1])for(let row=0;row<23;row++)for(let col=0;col<17;col++)bricks.push({x:side*5.57,y:.55+row*.134,z:-2.59+col*.32+(row%2)*.16,angle:Math.PI/2});
  const brickwork=new T.InstancedMesh(new T.BoxGeometry(.303,.119,.065),brick,bricks.length);
  bricks.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.set(1,1,1);dummy.updateMatrix();brickwork.setMatrixAt(i,dummy.matrix);brickwork.setColorAt(i,new T.Color('#986c54').lerp(new T.Color('#d1a58a'),random()));});
  brickwork.name='individual-aged-red-brick-courses';brickwork.castShadow=brickwork.receiveShadow=true;hall.add(brickwork);
  // Granite skirting, red wall piers and dark wooden double doors.
  for(const side of [-1,1]){
    for(let row=0;row<3;row++)for(let i=0;i<12;i++)box(.90,.18,.22,stone,-5.04+i*.92,.12+row*.18,side*2.94,hall);
    box(.24,3.25,.28,red,side*5.32,2.10,2.98,hall);
    box(.20,2.50,.30,lightStone,side*1.09,1.58,2.95,hall);
    box(.95,2.33,.14,wood,side*.49,1.52,2.15,hall);
    for(let k=0;k<4;k++)box(.18,1.95,.035,red,side*.49+(k-1.5)*.19,1.54,2.24,hall);
    const ring=mesh(new T.TorusGeometry(.06,.012,5,14),darkStone,side*.14,1.55,2.27,hall);
    ring.rotation.y=0;
    const window=new T.Group();window.position.set(side*3.25,1.99,2.96);hall.add(window);
    box(1.08,1.32,.09,lightStone,0,0,0,window);box(.88,1.11,.10,wood,0,0,.06,window);
    for(let i=0;i<5;i++)box(.035,1.03,.055,stone,-.35+i*.175,0,.13,window);
    box(.94,.06,.075,lightStone,0,0,.15,window);
  }
  box(2.41,.23,.43,lightStone,0,2.89,2.94,hall);
  for(let step=0;step<3;step++)box(2.6+step*.24,.13,.44,stone,0,.37-step*.13,3.02+step*.39,hall);
  // Open timber eaves: columns, beams and short brackets below the tiles.
  for(let i=0;i<7;i++){
    const x=-5.15+i*1.72;
    box(.12,.22,6.4,wood,x,3.57,0,hall);
    for(const side of [-1,1]){box(.28,.22,.48,red,x,3.49,side*2.9,hall);box(.15,.17,.65,wood,x,3.67,side*3.0,hall);}
  }
  box(11.9,.18,.19,wood,0,3.55,3.06,hall);box(11.9,.18,.19,wood,0,3.55,-3.06,hall);
  curvedRoof(hall,{width:12.5,depth:7.3,eave:3.78,rise:1.40});

  const portico=new T.Group();portico.name='reference-four-column-stone-portico';portico.position.set(-6.55,0,6.0);portico.rotation.y=Math.PI/2;portico.userData.citySolid=true;entrance.add(portico);
  box(3.95,.38,3.5,stone,0,.20,0,portico);box(3.8,.12,3.38,lightStone,0,.45,0,portico);
  for(const x of [-1.39,1.39])for(const z of [-1.11,1.11]){
    box(.56,.18,.58,darkStone,x,.61,z,portico);box(.34,3.15,.36,lightStone,x,2.25,z,portico);
    box(.55,.18,.57,stone,x,3.83,z,portico);box(.70,.20,.62,lightStone,x,4.01,z,portico);
    for(const direction of [-1,1]){const bracket=box(.22,.24,.54,stone,x,3.94,z+direction*.31,portico);bracket.rotation.x=direction*.33;}
  }
  box(3.53,.34,.32,stone,0,4.18,-1.13,portico);box(3.53,.34,.32,stone,0,4.18,1.13,portico);
  for(const x of [-1.39,1.39])box(.32,.34,2.64,stone,x,4.18,0,portico);
  for(let step=0;step<3;step++)box(2.75+step*.14,.14,.40,lightStone,0,.39-step*.14,1.88+step*.39,portico);
  curvedRoof(portico,{width:4.60,depth:3.95,eave:4.43,rise:.76,material:stone,stoneRibs:true});
  box(1.13,.31,.08,darkStone,0,4.12,1.34,portico);

  // Raised octagonal granite planter from the reference, with soil and exposed
  // roots. The existing banyan is lifted onto this bed by the scene builder.
  const bed=new T.Group();bed.name='reference-octagonal-banyan-planter';bed.position.set(5.4,0,1.1);entrance.add(bed);bed.userData.citySolid=true;
  mesh(new T.CylinderGeometry(1.81,1.96,.25,8),stone,0,.15,0,bed);
  mesh(new T.CylinderGeometry(1.70,1.80,.43,8),lightStone,0,.48,0,bed);
  const soil=new T.MeshStandardMaterial({color:'#514b37',roughness:1});
  mesh(new T.CylinderGeometry(1.57,1.57,.07,8),soil,0,.70,0,bed);
  for(let i=0;i<8;i++){
    const angle=(i+.5)*Math.PI/4,cap=box(1.43,.13,.27,stone,Math.sin(angle)*1.64,.74,Math.cos(angle)*1.64,bed);cap.rotation.y=angle;
    for(let course=0;course<2;course++){const face=box(1.35,.18,.06,lightStone,Math.sin(angle)*1.73,.37+course*.20,Math.cos(angle)*1.73,bed);face.rotation.y=angle;}
  }
  // Lower stone seating, a tapered historical marker and planting complete the
  // shore-side foreground; no structures intrude into the bridge passage.
  const marker=new T.Group();marker.name='reference-tapered-entry-stone-marker';marker.position.set(10.7,0,-1.65);entrance.add(marker);
  box(1.54,.22,1.54,darkStone,0,.13,0,marker);
  for(let i=0;i<9;i++)mesh(new T.CylinderGeometry(.65-i*.062,.71-i*.062,.38,4),lightStone,0,.43+i*.38,0,marker).rotation.y=Math.PI/4;
  for(const side of [-1,1]){
    for(let i=0;i<4;i++){
      const z=13.9+i*2.85;
      box(1.6,.16,.52,stone,side*7.1,.48,z,entrance);for(const end of [-1,1])box(.20,.43,.38,darkStone,side*7.1+end*.58,.22,z,entrance);
    }
  }
  // Background courtyards and low tiled roofs terminate rearward views rather
  // than exposing the former featureless land rectangle.
  const rear=new T.Group();rear.name='entrance-lane-and-low-houses';entrance.add(rear);
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const house=new T.Group();house.position.set(side*(12.7+(i%2)*2.5),0,18+i*6);rear.add(house);
    box(5.7,2.9,4.5,i%2?brick:stone,0,1.39,0,house);box(6.0,.36,4.7,darkStone,0,.15,0,house);
    box(1.0,2.1,.10,wood,0,1.12,2.30,house);
    for(const x of [-1.8,1.8]){box(.85,.95,.08,lightStone,x,1.75,2.28,house);box(.66,.76,.10,wood,x,1.75,2.34,house);}
    curvedRoof(house,{width:6.4,depth:5.2,eave:2.95,rise:.78});
  }
  const shrubs=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#556a4f',roughness:1}),150);
  for(let i=0;i<150;i++){
    const side=i%2?1:-1,z=3+random()*42,x=side*(19+random()*4);
    dummy.position.set(x,.20+random()*.38,z);dummy.rotation.set(random(),random()*6,random());dummy.scale.set(.5+random()*.7,.35+random()*.55,.5+random()*.6);dummy.updateMatrix();shrubs.setMatrixAt(i,dummy.matrix);
  }shrubs.name='entrance-side-planting';shrubs.castShadow=shrubs.receiveShadow=true;entrance.add(shrubs);
  return {entrance,foundation,hall,portico,bed};
}
