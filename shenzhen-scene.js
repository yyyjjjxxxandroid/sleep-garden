import * as T from './vendor/three/build/three.module.js';
import { createCitySky } from './city-atmosphere.js';
import { createCityWater } from './city-water.js';
import { createFacadeMaterial } from './city-facade.js';

export const SHENZHEN_FLOOR=.055;
const obstacles=[{x:0,z:-11.5,hx:1.7,hz:1.05},{x:-4.65,z:-7,hx:1.05,hz:.58},{x:4.65,z:-20,hx:1.05,hz:.58},{x:-4.65,z:-33,hx:1.05,hz:.58},{x:5,z:5.5,hx:1.38,hz:1.02},{x:-4.7,z:8.1,hx:.72,hz:.48}];

// The deck is deliberately narrower than the bay so water and wetland remain
// visible from the opening camera; navigation excludes every piece of furniture.
export function shenzhenWalkable(x,z,radius=.32){
  const plaza=x>-6.45+radius&&x<6.45-radius&&z>-3.8+radius&&z<12-radius;
  const boardwalk=x>-6.45+radius&&x<6.45-radius&&z>=-39+radius&&z<=-3.2;
  const turningDeck=x>5.15+radius&&x<10.2-radius&&z>=-39.8+radius&&z<-34.6-radius;
  if(!plaza&&!boardwalk&&!turningDeck)return false;
  return !obstacles.some(o=>o.r?Math.hypot(x-o.x,z-o.z)<o.r+radius:Math.abs(x-o.x)<o.hx+radius&&Math.abs(z-o.z)<o.hz+radius);
}

export function buildShenzhenScene(){
  const root=new T.Group();root.name='shenzhen-bay-overcast-walk';
  const wood=new T.MeshStandardMaterial({color:'#8b745b',roughness:.86}),woodLight=new T.MeshStandardMaterial({color:'#bca17d',roughness:.9}),steel=new T.MeshStandardMaterial({color:'#76817c',roughness:.58,metalness:.28}),leaf=new T.MeshStandardMaterial({color:'#526d57',roughness:1}),leafLight=new T.MeshStandardMaterial({color:'#7e9272',roughness:1}),bark=new T.MeshStandardMaterial({color:'#655446',roughness:1}),glass=new T.MeshStandardMaterial({color:'#81908c',roughness:.6,metalness:.08}),facade=createFacadeMaterial({glass:'#6f817e',mullion:'#8d9993',warm:'#c5ad7e'}),stone=new T.MeshStandardMaterial({color:'#91968b',roughness:.92});
  const glow=color=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.72,roughness:.52});
  const walkSurfaces=[],lights=[],boats=[];const mesh=(g,m,x=0,y=0,z=0,parent=root)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o};const box=(w,h,d,m,x=0,y=0,z=0,parent=root)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);const walk=(o,name)=>{o.name=name;walkSurfaces.push(o);return o};

  // Keep the near bank deliberately narrow: this is a waterside promenade,
  // not a second park competing with the timber deck and skyline.
  const bayPark=new T.Group();bayPark.name='shenzhen-bay-near-bank-park';root.add(bayPark);
  const bankEarth=new T.MeshStandardMaterial({color:'#666b67',roughness:1}),parkPaving=new T.MeshStandardMaterial({color:'#9b9c92',roughness:.94});
  box(17.2,2.25,58,bankEarth,2,-1.27,-13.2,bayPark).name='shenzhen-waterfront-promenade-foundation';
  box(3.6,.16,51.5,parkPaving,8.15,-.01,-13.2,bayPark).name='shenzhen-near-bank-promenade';
  box(.30,.52,51.5,stone,-6.44,-.08,-13.2,bayPark).name='shenzhen-bay-retaining-edge';
  // Stop at the exact head of the long deck so the two base plates meet
  // cleanly instead of occupying the same 0.9m strip of the boardwalk.
  walk(box(12.9,.46,15.2,wood,0,-.17,4.45),'shenzhen-bay-arrival-deck');
  walk(box(12.9,.48,36.3,wood,0,-.18,-21.3),'shenzhen-bay-continuous-boardwalk');
  // The long deck ends in a deliberate turning platform and opens onto the
  // shore promenade. It should read as one waterfront route, not a cut bridge.
  const connector=walk(box(5.25,.48,5.25,wood,7.58,-.18,-37.18),'shenzhen-boardwalk-promenade-connector');
  connector.userData.cityRouteConnection=true;
  const shoreThreshold=walk(box(3.75,.22,3.15,parkPaving,8.15,-.08,-33.85),'shenzhen-boardwalk-shore-threshold');
  shoreThreshold.userData.cityRouteConnection=true;
  const planks=new T.InstancedMesh(new T.BoxGeometry(1,1,1),woodLight,294),d=new T.Object3D();let count=0;
  for(let row=0;row<42;row++)for(let col=0;col<7;col++){d.position.set(-5.48+col*1.82,.075,11.3-row*1.2);d.scale.set(1.69,.065,1.1);d.rotation.y=((row+col)%3-1)*.006;d.updateMatrix();planks.setMatrixAt(count,d.matrix);planks.setColorAt(count,new T.Color('#c3a37c').lerp(new T.Color('#735c49'),((row*7+col*13)%9)/22));count++;}
  planks.count=count;planks.name='shenzhen-bay-timber-planks';planks.receiveShadow=true;root.add(planks);walkSurfaces.push(planks);

  const warm=glow('#f5d39c'),cyan=glow('#b9d5c6'),guide=glow('#c1d9c6'),railDetails=new T.Group();railDetails.name='shenzhen-quanzhou-detail-rail';root.add(railDetails);
  for(const side of [-1]){
    box(.24,.68,51,steel,side*6.42,.15,-13,railDetails);
    const edge=box(.055,.035,50.4,guide,side*6.18,.16,-13,railDetails);edge.castShadow=false;lights.push(edge.material);
    for(let i=0;i<35;i++){
      const z=10.7-i*1.46;
      box(.24,.12,.24,stone,side*6.08,.15,z,railDetails);
      box(.11,.92,.11,steel,side*6.08,.57,z,railDetails);
      const cap=mesh(new T.CylinderGeometry(.13,.10,.12,8),steel,side*6.08,1.08,z,railDetails);cap.rotation.y=Math.PI/8;
      if(i<34){box(.07,.08,1.46,steel,side*6.08,.96,z-.73,railDetails);box(.045,.045,1.46,steel,side*6.08,.57,z-.73,railDetails);}
      if(i%4===0){const lamp=mesh(new T.SphereGeometry(.12,10,8),i%8?warm:cyan,side*6.08,1.24,z,railDetails);lamp.userData.skipWaterReflection=true;lights.push(lamp.material);}
    }
  }
  const fasteners=new T.InstancedMesh(new T.CylinderGeometry(.035,.035,.018,8),steel,84);let fastener=0;
  for(let row=0;row<42;row++)for(const x of [-5.64,5.64]){d.position.set(x,.145,11.3-row*1.2);d.scale.setScalar(1);d.rotation.set(0,0,0);d.updateMatrix();fasteners.setMatrixAt(fastener++,d.matrix);}fasteners.name='shenzhen-deck-fasteners';root.add(fasteners);
  const deckInlays=new T.Group();deckInlays.name='shenzhen-boardwalk-cross-inlays';root.add(deckInlays);
  for(let z=8.8;z>-38;z-=6.0){const band=box(11.35,.025,.075,steel,0,.145,z,deckInlays);band.castShadow=false;for(const x of [-4.7,0,4.7]){const light=box(.36,.018,.13,z%12>0?warm:cyan,x,.165,z,deckInlays);light.castShadow=false;lights.push(light.material);}}
  const connectorPlanks=new T.Group();connectorPlanks.name='shenzhen-turning-platform-planks';root.add(connectorPlanks);
  for(let z=-39.25;z<-34.7;z+=.62)for(let x=5.35;x<10;x+=1.12){const plank=box(1.02,.06,.54,woodLight,x,.075,z,connectorPlanks);plank.castShadow=false;}
  const thresholdSeams=new T.Group();thresholdSeams.name='shenzhen-shore-threshold-seams';root.add(thresholdSeams);
  for(const z of [-35.05,-34.25,-33.45]){const seam=box(3.18,.018,.055,steel,8.15,.045,z,thresholdSeams);seam.castShadow=false;}
  const parkEdge=new T.Group();parkEdge.name='shenzhen-promenade-edge';root.add(parkEdge);box(.28,.30,47.2,stone,6.42,.02,-11.3,parkEdge);
  const drainage=new T.Group();drainage.name='shenzhen-boardwalk-drainage-detail';root.add(drainage);box(.24,.025,46.9,steel,5.96,.13,-11.2,drainage);
  for(let z=10.8;z>-34.7;z-=.42){const slot=box(.18,.014,.12,new T.MeshStandardMaterial({color:'#34413d',roughness:.9,metalness:.12}),5.96,.151,z,drainage);slot.castShadow=false;}
  const plantDummy=new T.Object3D();
  const promenadeLights=new T.Group();promenadeLights.name='shenzhen-near-bank-bollard-lights';bayPark.add(promenadeLights);
  for(let z=7;z>-38;z-=9){box(.12,.72,.12,steel,8.05,.37,z,promenadeLights);const lamp=mesh(new T.SphereGeometry(.12,10,8),warm,8.05,.78,z,promenadeLights);lamp.castShadow=false;lights.push(lamp.material);}
  const plantedEdge=new T.Group();plantedEdge.name='shenzhen-quanzhou-style-reed-and-rock-edge';bayPark.add(plantedEdge);
  const edgeRocks=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),stone,42);edgeRocks.name='shenzhen-small-shoreline-rocks';plantedEdge.add(edgeRocks);
  for(let i=0;i<42;i++){const x=8.90+(i*29%41)/40*.82,z=7-(i*17%43)/42*45.5,s=.12+(i%7)*.035;plantDummy.position.set(x,.08+s*.32,z);plantDummy.rotation.set(i*.41,i*.73,i*.19);plantDummy.scale.set(s*1.25,s*.55,s);plantDummy.updateMatrix();edgeRocks.setMatrixAt(i,plantDummy.matrix);}edgeRocks.castShadow=false;
  const pergolas=new T.Group();pergolas.name='shenzhen-near-bank-pergolas-and-seating';bayPark.add(pergolas);
  for(const [x,z] of [[5,5.5],[8.15,-24.5]]){const shelter=new T.Group();shelter.position.set(x,0,z);pergolas.add(shelter);for(const px of [-1.08,1.08])for(const dz of [-.72,.72]){box(.10,2.30,.10,steel,px,1.15,dz,shelter);box(.24,.10,.24,stone,px,.08,dz,shelter);}for(let i=0;i<8;i++){const slat=box(2.65,.09,.12,woodLight,0,2.34,-.77+i*.22,shelter);slat.rotation.z=(i-3.5)*.012;}for(const side of [-1,1])box(.12,.12,1.95,steel,side*1.18,2.25,0,shelter);box(1.72,.10,.54,woodLight,0,.48,0,shelter);for(const px of [-.70,.70])box(.08,.42,.08,steel,px,.25,0,shelter);const lamp=mesh(new T.SphereGeometry(.105,9,7),warm,0,2.16,0,shelter);lamp.castShadow=false;lights.push(lamp.material);}
  const arrivalDetails=new T.Group();arrivalDetails.name='shenzhen-arrival-wayfinding-and-deck-medallion';root.add(arrivalDetails);
  const kiosk=new T.Group();kiosk.position.set(-4.7,0,8.1);kiosk.rotation.y=-.10;arrivalDetails.add(kiosk);box(1.34,.14,.72,stone,0,.08,0,kiosk);for(const x of [-.48,.48])box(.08,1.42,.08,steel,x,.78,0,kiosk);const mapPanel=box(1.24,.78,.08,glass,0,1.27,0,kiosk);mapPanel.rotation.x=-.18;box(1.38,.09,.16,woodLight,0,1.73,-.08,kiosk);for(const x of [-.40,0,.40]){const mark=box(.18,.035,.014,x?cyan:warm,x,1.29,.052,kiosk);mark.castShadow=false;lights.push(mark.material);}
  const medallion=new T.Group();medallion.name='shenzhen-bay-deck-compass-inlay';arrivalDetails.add(medallion);for(const [radius,tube,material] of [[1.12,.035,steel],[.76,.026,cyan],[.34,.020,warm]]){const ring=mesh(new T.TorusGeometry(radius,tube,6,40),material,0,.174,4.45,medallion);ring.rotation.x=Math.PI/2;ring.castShadow=false;if(material!==steel)lights.push(ring.material);}for(let i=0;i<8;i++){const a=i/8*Math.PI*2,tick=box(i%2?.06:.10,.018,i%2?.34:.52,i%2?steel:warm,Math.sin(a)*.92,.176,4.45+Math.cos(a)*.92,medallion);tick.rotation.y=a;tick.castShadow=false;if(i%2===0)lights.push(tick.material);}
  const rescueDetails=new T.Group();rescueDetails.name='shenzhen-waterfront-rescue-and-mooring-details';root.add(rescueDetails);
  for(const z of [4,-13,-30]){const ring=mesh(new T.TorusGeometry(.30,.065,8,22),warm,-6.02,.72,z,rescueDetails);ring.rotation.y=Math.PI/2;ring.castShadow=false;lights.push(ring.material);box(.06,.72,.06,steel,-6.06,.42,z,rescueDetails);const bollard=mesh(new T.CylinderGeometry(.10,.14,.46,10),steel,-5.65,.28,z-1.05,rescueDetails);bollard.userData.citySolid=true;}

  const furniture=new T.Group();furniture.name='shenzhen-bay-waterfront-furniture';root.add(furniture);
  const bench=(x,z,rotation=0)=>{const g=new T.Group();g.name='shenzhen-bay-slat-bench';g.position.set(x,0,z);g.rotation.y=rotation;furniture.add(g);for(let i=0;i<5;i++)box(1.72,.06,.075,woodLight,0,.52,-.15+i*.09,g);for(let i=0;i<3;i++)box(1.72,.06,.06,woodLight,0,.72+i*.13,.24,g);for(const side of [-1,1]){const frame=new T.CatmullRomCurve3([new T.Vector3(side*.65,.08,-.12),new T.Vector3(side*.65,.43,-.04),new T.Vector3(side*.65,.65,.22),new T.Vector3(side*.65,.99,.25)]);mesh(new T.TubeGeometry(frame,12,.035,6,false),steel,0,0,0,g);box(.34,.045,.045,steel,side*.65,.76,.04,g);}};
  bench(-4.65,-7,0);bench(4.65,-20,Math.PI);bench(-4.65,-33,0);

  // A luminous viewing frame supplies a human-scale focal point halfway down the
  // boardwalk, while staying open enough to reveal water and skyline through it.
  const pavilion=new T.Group();pavilion.name='shenzhen-bay-viewing-frame';pavilion.position.set(0,0,-11.5);pavilion.userData.citySolid=true;root.add(pavilion);box(3.45,.18,2.15,steel,0,.10,0,pavilion);for(const x of [-1.38,1.38]){box(.14,2.55,.14,steel,x,1.3,0,pavilion);const lamp=mesh(new T.SphereGeometry(.12,10,8),cyan,x,2.18,0,pavilion);lights.push(lamp.material);}box(3.0,.12,.18,steel,0,2.52,0,pavilion);const frame=mesh(new T.TorusGeometry(1.02,.055,6,28,Math.PI),cyan,0,2.46,.02,pavilion);frame.rotation.y=Math.PI/2;lights.push(frame.material);

  // Keep the coast readable through haze: water, flood wall, promenade,
  // planted belt and road form a clear section before the first building.
  const oppositeShore=new T.Group();oppositeShore.name='shenzhen-bay-distant-shore';root.add(oppositeShore);
  const shoreEarth=new T.MeshStandardMaterial({color:'#59655b',roughness:1}),shoreGreen=new T.MeshStandardMaterial({color:'#747a6d',roughness:1}),shorePaving=new T.MeshStandardMaterial({color:'#a3a397',roughness:.94}),asphalt=new T.MeshStandardMaterial({color:'#555e5b',roughness:.96});
  box(136,1.9,88,shoreEarth,0,-.94,-120,oppositeShore).name='shenzhen-solid-city-bank';
  box(136,1.42,1.45,stone,0,-.52,-75.8,oppositeShore).name='shenzhen-bay-flood-wall';
  box(132,.20,4.2,shorePaving,0,.04,-78.4,oppositeShore).name='shenzhen-waterfront-promenade';
  box(132,.18,8.8,shoreGreen,0,-.13,-84.8,oppositeShore).name='shenzhen-waterfront-greenbelt';
  box(132,.16,5.6,asphalt,0,.02,-92.0,oppositeShore).name='shenzhen-shoreline-road';
  const roadLine=new T.MeshStandardMaterial({color:'#d7d0aa',roughness:.8});for(const x of [-1,1])box(.08,.014,5.2,roadLine,x*15,.11,-92,oppositeShore);for(let x=-58;x<60;x+=5.4)box(2.7,.014,.08,roadLine,x,.11,-92,oppositeShore);
  const shoreTrees=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#728372',roughness:1}),780);shoreTrees.name='shenzhen-procedural-shore-trees';oppositeShore.add(shoreTrees);
  for(let i=0;i<780;i++){const cluster=Math.floor(i/6),a=i*2.39996,r=.32+(i*23%29)/29*.53,x=-59+cluster/129*118+Math.cos(a)*.8,z=-82.6+Math.sin(cluster*5.8)*1.2+Math.sin(a)*.7;plantDummy.position.set(x,-.28+Math.sin(cluster*2.31)*.38+(i%6)*.19,z);plantDummy.rotation.set(i*.09,i*.31,i*.04);plantDummy.scale.set(r*1.4,r*.8,r);plantDummy.updateMatrix();shoreTrees.setMatrixAt(i,plantDummy.matrix);shoreTrees.setColorAt(i,new T.Color('#3f5549').lerp(new T.Color('#879579'),(i%17)/20));}shoreTrees.castShadow=false;
  const inlandTrees=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#748170',roughness:1}),720);inlandTrees.name='shenzhen-layered-inland-greenbelt';oppositeShore.add(inlandTrees);
  for(let i=0;i<720;i++){const row=Math.floor(i/180),local=i%180,cluster=Math.floor(local/3),a=i*2.39996,r=.44+(i*19%31)/31*.48,x=-59+cluster/59*118+Math.cos(a)*r*.72,z=-88.5-row*5.7+Math.sin(cluster*4.9+row)*1.05+Math.sin(a)*r*.62;plantDummy.position.set(x,.06+(i%5)*.18+row*.04,z);plantDummy.rotation.set(i*.08,i*.27,i*.035);plantDummy.scale.set(r*1.42,r*.92,r*1.08);plantDummy.updateMatrix();inlandTrees.setMatrixAt(i,plantDummy.matrix);inlandTrees.setColorAt(i,new T.Color('#536756').lerp(new T.Color('#9aa38c'),Math.min(.82,row*.13+(i%11)/18)));}inlandTrees.castShadow=false;
  for(let i=0;i<24;i++){const x=-58+i*5.0;box(.08,.82,.08,steel,x,.44,-78.4,oppositeShore);const lamp=mesh(new T.SphereGeometry(.10,8,6),warm,x,.91,-78.4,oppositeShore);lamp.castShadow=false;lights.push(lamp.material);}

  const waterfrontBuildings=new T.Group();waterfrontBuildings.name='shenzhen-varied-waterfront-buildings';root.add(waterfrontBuildings);
  for(let i=0;i<18;i++){const x=-54+i*6.25,z=-108-(i%3)*2.5,w=3.25+(i%4)*.72,h=3.5+(i*7%6)*.72,g=new T.Group();g.position.set(x,.16,z);waterfrontBuildings.add(g);if(i%3===0){box(w,h*.52,3.4,glass,0,h*.26,0,g);box(w*1.18,.20,4.0,steel,0,h*.56,0,g);for(const sx of [-1,1])box(.13,h*.45,.16,steel,sx*w*.44,h*.25,1.76,g);}else if(i%3===1){box(w,h*.60,3.1,facade,0,h*.30,0,g);box(w*.72,h*.40,2.55,facade,0,h*.80,-.20,g);box(w*.82,.13,2.78,steel,0,h+ .07,-.20,g);}else{box(w,h*.72,3.0,facade,0,h*.36,0,g);const roof=mesh(new T.CylinderGeometry(w*.34,w*.52,.64,12),steel,0,h*.76,0,g);roof.scale.z=.72;}for(let col=0;col<3;col++){const window=box(.40,.20,.03,(i+col)%4?cyan:warm,(col-1)*w*.24,.82,1.72,g);window.castShadow=false;lights.push(window.material);}}

  // One unmistakable hero is stronger than several approximate landmarks. The
  // Spring Bamboo's stout oval body, dense rings and curved crown own the view.
  const facadeDark=createFacadeMaterial({glass:'#445c60',mullion:'#89999a',warm:'#d8b77d'}),facadeBlue=createFacadeMaterial({glass:'#57747a',mullion:'#a9b8b4',warm:'#e1c38e'});
  const springBamboo=new T.Group();springBamboo.name='shenzhen-spring-bamboo-landmark';springBamboo.position.set(-3,.16,-118);springBamboo.scale.set(.90,1.05,.90);root.add(springBamboo);
  box(9.2,.44,7.4,stone,0,.05,0,springBamboo).name='shenzhen-spring-bamboo-podium';box(7.5,1.15,5.9,facadeDark,0,.72,0,springBamboo);
  const bambooRadius=y=>3.35*Math.pow(Math.max(0,1-y/41),.48)+.30;
  for(let level=0;level<17;level++){const y0=1.3+level*2.25,y1=Math.min(41,1.3+(level+1)*2.25),r0=bambooRadius(y0),r1=bambooRadius(y1),section=mesh(new T.CylinderGeometry(r1,r0,y1-y0,32,1,true),facadeBlue,0,(y0+y1)/2,0,springBamboo);section.scale.z=.76;section.castShadow=false;}
  const crown=mesh(new T.SphereGeometry(.72,24,14,0,Math.PI*2,0,Math.PI/2),facadeBlue,0,41.0,0,springBamboo);crown.scale.set(1,.78,.76);crown.castShadow=false;
  for(let y=2.1;y<40.4;y+=1.28){const r=bambooRadius(y),ring=mesh(new T.TorusGeometry(r,.052,5,36),Math.round(y*10)%5?cyan:warm,0,y,0,springBamboo);ring.rotation.x=Math.PI/2;ring.scale.z=.76;ring.castShadow=false;lights.push(ring.material);}
  const ribs=new T.Group();ribs.name='shenzhen-spring-bamboo-vertical-ribs';springBamboo.add(ribs);
  for(let rib=0;rib<14;rib++){const angle=rib/14*Math.PI*2,points=[];for(let step=0;step<=22;step++){const y=1.35+step/22*39.2,r=bambooRadius(y)+.055;points.push(new T.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r*.76));}const fin=mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),30,.034,5,false),rib%4===0?warm:steel,0,0,0,ribs);fin.castShadow=false;if(rib%4===0)lights.push(fin.material);}

  const skyline=new T.Group();skyline.name='shenzhen-bay-lit-skyline';skyline.scale.y=.82;root.add(skyline);
  for(let i=0;i<35;i++){
    const x=-59+i*3.48,z=-111-(i%3)*5.0,h=4.8+(i*17%11),w=1.48+(i%4)*.40;
    if(Math.abs(x+3)<8.5)continue;
    const g=new T.Group();g.name='shenzhen-landed-building';g.position.set(x,.16,z);skyline.add(g);box(w*1.55,.36,w*1.4,stone,0,.02,0,g);
    if(i%4===0){for(let tier=0;tier<3;tier++){const section=box(w*(1-tier*.16),h/3-.08,w*(.76-tier*.08),tier===1?facadeBlue:facadeDark,0,h/6+tier*h/3,0,g);section.castShadow=false;const ledge=box(w*(1.06-tier*.15),.08,w*(.84-tier*.08),steel,0,(tier+1)*h/3,0,g);ledge.castShadow=false;}}
    else if(i%5===0){const body=mesh(new T.CylinderGeometry(w*.35,w*.56,h,10),facadeBlue,0,h/2,0,g);body.rotation.y=Math.PI/10;}
    else{const body=box(w,h,w*.72,i%3?facadeDark:facadeBlue,0,h/2,0,g);body.castShadow=false;for(const side of [-1,1])box(.06,h*.88,.08,steel,side*w*.43,h*.46,w*.37+.03,g);for(let y=2.7;y<h-1;y+=3.1){const ledge=box(w*1.04,.075,w*.78,steel,0,y,0,g);ledge.castShadow=false;}}
    if(i%3===0){box(w*.72,.22,w*.52,steel,0,h+.11,0,g);mesh(new T.CylinderGeometry(.025,.04,.82,6),steel,0,h+.54,0,g);}
    for(let f=0;f<Math.floor(h/1.55);f++){const window=box(w*.54,.055,.028,(f+i)%5?cyan:warm,0,.68+f*1.42,w*.37+.03,g);window.castShadow=false;lights.push(window.material);}
  }

  const ferry=new T.Group();ferry.name='shenzhen-bay-electric-ferry';ferry.position.set(-15,-1.03,-31);ferry.userData.cityAnimated=true;root.add(ferry);box(2.2,.20,5.9,new T.MeshStandardMaterial({color:'#e7e7dc',roughness:.45,metalness:.12}),0,0,0,ferry);box(1.45,.72,3,glass,0,.46,-.1,ferry);for(let i=0;i<10;i++){const window=box(.18,.17,.02,warm,-.94+(i%2)*1.88,.49,-1.05+Math.floor(i/2)*.43,ferry);lights.push(window.material);}boats.push(ferry);

  const water=createCityWater();water.name='shenzhen-bay-water-with-reflections';water.material.uniforms.color.value.set('#55766c');root.add(water);
  const floatingPlants=new T.Group();floatingPlants.name='shenzhen-bay-floating-leaves-and-duckweed';root.add(floatingPlants);
  const padMaterial=new T.MeshStandardMaterial({color:'#6f8262',roughness:1,side:T.DoubleSide}),pads=new T.InstancedMesh(new T.CircleGeometry(1,18,.16,Math.PI*1.82),padMaterial,56);pads.name='shenzhen-bay-scattered-floating-leaves';floatingPlants.add(pads);
  for(let i=0;i<56;i++){const side=i%2?-1:1,x=side*(8.2+(i*17%25)*.88),z=8-(i*19%61),s=.18+(i*13%17)/17*.34;plantDummy.position.set(x,-1.125+(i%3)*.006,z);plantDummy.rotation.set(-Math.PI/2,0,i*.73);plantDummy.scale.set(s,s*(.78+(i%4)*.06),1);plantDummy.updateMatrix();pads.setMatrixAt(i,plantDummy.matrix);pads.setColorAt(i,new T.Color('#536c51').lerp(new T.Color('#90a079'),(i%11)/14));}pads.userData.skipWaterReflection=true;pads.castShadow=false;
  const duckweed=new T.InstancedMesh(new T.CircleGeometry(1,9),new T.MeshStandardMaterial({color:'#81916d',roughness:1,side:T.DoubleSide}),130);duckweed.name='shenzhen-bay-duckweed-specks';floatingPlants.add(duckweed);
  for(let i=0;i<130;i++){const side=i%2?-1:1,x=side*(8.1+(i*29%29)*.72),z=7-(i*23%63),s=.032+(i%7)*.013;plantDummy.position.set(x,-1.116+(i%4)*.004,z);plantDummy.rotation.set(-Math.PI/2,0,i*.91);plantDummy.scale.set(s,s*.72,1);plantDummy.updateMatrix();duckweed.setMatrixAt(i,plantDummy.matrix);duckweed.setColorAt(i,new T.Color('#667957').lerp(new T.Color('#9fa981'),(i%9)/12));}duckweed.userData.skipWaterReflection=true;duckweed.castShadow=false;
  const reflections=new T.Group();reflections.name='shenzhen-bay-broken-light-reflections';root.add(reflections);for(let i=0;i<96;i++){const side=i%2?-1:1,x=side*(7.1+(i*11%18)*.62),z=8-(i*13%74),length=.22+(i%8)*.13,material=glow(i%5===0?'#e8c895':'#b9d1bf');material.transparent=true;material.opacity=.07+(i%4)*.018;const line=box(.035+(i%3)*.018,.009,length,material,x,-1.155,z,reflections);line.userData.skipWaterReflection=true;lights.push(material);}

  const sky=createCitySky('dusk'),skyMat=sky.material;root.add(sky);
  return {root,walkSurfaces,water,update(time){water.material.uniforms.time.value=time;skyMat.uniforms.time.value=time;lights.forEach((m,i)=>m.emissiveIntensity=.68+.16*Math.sin(time*.72+i*.51));boats.forEach((boat,i)=>{boat.position.y=-1.03+Math.sin(time*.62+i)*.035;boat.position.x+=Math.sin(time*.11+i)*.0015;boat.rotation.z=Math.sin(time*.39+i)*.01;});}};
}
